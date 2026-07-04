# Actions On Paths

TikZ manual section 15 的关键点是：path 构造完成以后，TikZ 会把同一条 path 交给一个或多个 action 使用。视觉一致性不能只看 path geometry，还必须看 action ordering、graphic parameters、bbox、clip 和多次复用 path 的语义。

## Core Rule

```tex
\path (0,0) circle (1cm);
\path[draw] (0,0) circle (1cm);
\path (0,0) [draw] circle (1cm);
\path (0,0) circle (1cm) [draw];
\draw (0,0) circle (1cm);
```

第一行只构造 path，不产生可见图形。后四行都应该画出同一个圆。`draw` 可以出现在 path option 流的任意位置，`\draw` 只是 `\path[draw]` 的缩写。

同理：

```text
\draw             = \path[draw]
\fill             = \path[fill]
\filldraw         = \path[fill,draw]
\pattern          = \path[pattern]
\shade            = \path[shade]
\shadedraw        = \path[shade,draw]
\clip             = \path[clip]
\useasboundingbox = \path[use as bounding box]
```

实现要求：parser 只负责保留 path 和 option stream；interpreter 负责把 command shortcut 归一化成 action set；renderer 负责按 action set 输出 SVG。

## Action Ordering

当同一条 path 上有多个 action 时，TikZ 有默认顺序：

```text
preaction(s)
-> fill / pattern / shade
-> path picture
-> draw / arrow tips
-> postaction(s)
-> clip / use as bounding box effects
```

Section 15 明确说明 filldraw 不是简单的“填充并同一层画线”：先 fill，再 draw。因此粗线会让 `filldraw` 的视觉面积比纯 fill 更大。

TikZKit 实现时应避免把 `fill`、`draw`、`shade`、`pattern` 混成一个布尔值。更稳的 IR 模型是：

```js
{
  geometry,
  actions: [
    { kind: "fill", style },
    { kind: "draw", style },
    { kind: "clip", rule }
  ]
}
```

当前 TikZKit 多数 path 仍以单个 `path` item 携带 `style`。这能覆盖基础 SVG，但对 `preaction/postaction/path picture/clip` 会不够精确。

## Color Semantics

`color=<name>` 是通用颜色，影响 draw、fill 和 text 的默认颜色。TikZ 还允许省略 `color=`：

```tex
\fill[color=red!20] (0,0) circle (1ex);
\fill[red!20]       (0,0) circle (1ex);
```

规则：

- `draw=<color>` 只设置 stroke color，并打开 draw action。
- `fill=<color>` 只设置 fill color，并打开 fill action。
- `color=<color>` 设置当前 scope 的通用颜色，后续 draw/fill/text 可继承。
- `draw=none` 关闭 draw action。
- `fill=none` 关闭 fill action。
- 未识别 option 会获得一次“作为颜色名解析”的机会。

TikZKit 当前相关位置：

- `src/options.js`: `draw`、`fill`、`color`、裸颜色 token 归一化。
- `src/interpreter.js`: path-stream option 合并和可见性判断。

需要注意：`color` 在 TikZ 里会 overrule 之前特殊 draw/fill color；如果后续 case 出现颜色回退不一致，应优先查 action 级颜色继承顺序。

## Draw Parameters

Draw action 是 stroking。影响 stroke 的参数包括：

| TikZ key | SVG/IR 对应 | Section 15 要点 |
| --- | --- | --- |
| `line width=<dimension>` | `stroke-width` | 初始 0.4pt。 |
| `ultra thin` | `0.1pt` | 预设 line width。 |
| `very thin` | `0.2pt` | 预设 line width。 |
| `thin` | `0.4pt` | 默认线宽。 |
| `semithick` | `0.6pt` | 预设 line width。 |
| `thick` | `0.8pt` | 预设 line width。 |
| `very thick` | `1.2pt` | 预设 line width。 |
| `ultra thick` | `1.6pt` | 预设 line width。 |
| `line cap=butt|round|rect` | `stroke-linecap` | TikZ 初始 butt；`rect` 对应 SVG square。 |
| `line join=miter|round|bevel` | `stroke-linejoin` | TikZ 初始 miter。 |
| `miter limit=<factor>` | `stroke-miterlimit` | sharp corner 超限后退化为 bevel。 |

当前 TikZKit 已支持 line width、line cap、line join 的基础映射。`miter limit` 需要单独核查 SVG 输出是否完整携带。

## Dash Parameters

TikZ dash 不是 CSS 名字，而是由 `on/off` 序列定义：

```tex
\draw[dash pattern=on 2pt off 3pt on 4pt off 4pt] (0,0) -- (3.5cm,0);
\draw[dash phase=10pt] (0,0) -- (3.5cm,0);
\draw[dash=on 20pt off 10pt phase 10pt] (0,0) -- (3.5cm,0);
```

常用 shorthand：

```text
solid
dotted
densely dotted
loosely dotted
dashed
densely dashed
loosely dashed
dash dot
densely dash dot
loosely dash dot
dash dot dot
densely dash dot dot
loosely dash dot dot
```

实现要点：

- dash length 使用 TikZ dimension，需要经过当前 unit/pt 换算。
- dotted/dashed 默认应使用 PGF 风格的 butt cap，不能被浏览器默认 round cap 污染。
- `dash phase` 对应 SVG `stroke-dashoffset`，当前需要核查是否已输出。
- `dash expand off` 依赖 decorations，属于后续增强。

## Double Lines

`double` 不是两条真实独立 path，而是同一条 path 被画两次：

```text
outer stroke: normal draw color, wider
inner stroke: core color, narrower
```

相关 key：

- `double=<core color>`，默认 core color 是 white。
- `double distance=<dimension>`，设置两条主线内边界之间的距离，并隐式启用 `double`。
- `double distance between line centers=<dimension>`，按中心线距离计算。
- `double equal sign distance`，让 double spacing 贴近等号间距。

TikZKit 当前已有 double path 近似渲染。后续 case 对齐时应重点检查：

- dashed double path 的 cap 是否为 butt。
- arrow tip 是否只出现在最终可见端点，而不是内外 stroke 各自乱出。
- `double distance between line centers` 和 `double equal sign distance` 是否缺失。

## Arrow Tips As Action

Section 15 的一个容易漏掉的点：`tips` 可以让一条没有 draw 的 path 只显示 arrow tips。

```tex
\path[tips, -{Latex[open,length=10pt,bend]}] (0,0) to[bend left] (1,0);
```

这意味着“arrow tip 是否渲染”不能完全绑定到 `draw` action。更正确的模型是：

```text
path geometry exists
-> tips action may consume endpoints
-> draw action may stroke path body
```

当前 TikZKit 对常见 `->`、`-stealth`、`arrows.meta` 有近似实现，但如果出现 only-tip path 或 open/bending tip，应按 Section 16 继续拆 arrow 专项。

## Fill Parameters

`fill` action 会把未闭合子路径先闭合，再填充区域。

```tex
\fill (0,0) -- (1,1) -- (2,1);
\fill[even odd rule] (0,0) circle (.5cm) (0.5,0) circle (.5cm);
```

规则：

- `fill=<color>` 打开 fill action。
- `fill=none` 关闭 fill action。
- `draw + fill` 时先 fill 后 draw。
- 自交和多闭合区域依赖 fill rule。

Fill rule:

```text
nonzero rule   -> SVG fill-rule="nonzero" 默认
even odd rule  -> SVG fill-rule="evenodd"
```

当前 TikZKit 已有 `fillRule` 基础支持。真实 case 如果出现洞、交叠区域、复合路径缺失，应优先核查 path 是否被拆成了多个 SVG path。fill rule 必须作用在同一个 compound path 上才有意义。

## Pattern And Shading

`pattern` 类似 fill color，但使用重复 tile 填充：

```tex
\draw[pattern=dots] (0,0) circle (1cm);
\draw[pattern color=red, pattern=fivepointed stars] (0,0) rectangle (3,1);
```

规则：

- `pattern=<name>` 打开 pattern fill。
- `pattern color=<color>` 只影响 form-only pattern。
- 设置新的 solid fill color 会覆盖 pattern fill。
- 需要 `patterns` library 注册 pattern 名称。

`shade` 是渐变填充：

```tex
\shade (0,0) circle (1ex);
\shadedraw [shading=axis] (0,0) rectangle (1,1);
\shadedraw [left color=red,right color=blue] (0,0) rectangle (1,1);
```

规则：

- `shade` 打开 shading action。
- `shading=<name>` 会选择 shading 并隐式 shade。
- 常见预设：`axis`、`radial`、`ball`。
- `shading angle` 旋转 shading，不旋转 path。
- `left/right/top/bottom/middle color` 影响 shading colors。

当前 TikZKit 已有 pattern 和部分 shading/ball shading 支持。后续需要用 native/tikztosvg 对比 pattern tile size、gradient vector、ball highlight 位置。

## Path Picture

`path picture=<code>` 是“用 arbitrary TikZ code 填充 path”的机制：

```tex
\filldraw [fill=blue!10,draw=blue,thick] (1.5,1) circle (1)
  [path picture={
    \node at (path picture bounding box.center) {Text};
  }];
```

执行顺序：

```text
normal fill/pattern/shade
-> open local scope
-> install current path as clipping path
-> execute path picture code
-> close scope
-> draw path if requested
```

特殊 node：

- `path picture bounding box`

它是当前 path bbox 的 rectangle node。很多复杂图形用它定位内部图片、斜线、文字。

TikZKit 当前有 node `pathPicture` 和 renderer overlay 的近似。完整实现需要 interpreter 支持在 clipping scope 中执行 nested TikZ code。

## Bounding Box Actions

`use as bounding box` 和 `\useasboundingbox` 用 path 手动控制图片 bbox：

```tex
\useasboundingbox (0,0) rectangle (3,1);
```

规则：

- 当前 path bbox 用来决定 picture size。
- 后续 path 的 bbox 不再扩大 picture。
- 如果之前已经有更大的 bbox，通常不会缩小，除非配合 `\pgfresetboundingbox`。
- scope 内设置只持续到 scope 结束。
- `current bounding box` 和 `current path bounding box` 是 rectangle node。
- `trim left` / `trim right` 是对最终图片 bbox 的水平裁切/对齐控制。

这直接影响网页对比：如果 JS viewBox 与 native PNG 不一致，先查 bbox action，而不是盲调 CSS。

## Clip

`clip` 是 graphic state，不是普通可见图元：

```tex
\clip (0,0) circle (1cm);
\fill[red] (1,0) circle (1cm);
```

规则：

- clip 限制后续 drawing。
- clip 的作用域到当前 scope 结束。
- 多次 clip 取交集。
- clip 自交区域使用当前 fill rule。
- clip 也影响后续 bbox 计算。

SVG 对应通常是 `<clipPath>` 加 group。TikZKit 如果只把 `clip` 当成 invisible path 丢掉，会导致后续内容超出。

## Preaction And Postaction

`preaction` / `postaction` 会复用同一条完整 path，多次以不同 options 绘制：

```tex
\draw
  [preaction={draw,line width=4mm,blue}]
  [line width=2mm,red] (0,0) rectangle (2,2);
```

规则：

- preaction 在主 action 前执行。
- postaction 在主 action 后执行。
- 多个 preaction/postaction 按出现顺序逐个执行，不合并成一个 option set。
- preaction/postaction 看到的是已经构造完成的 path。
- coordinate transformation 对已经完成的 path 不生效；canvas transformation 可以影响绘制。

这解释了 shadows、highlight、decorations.markings 等很多 case 的图层问题。实现上应生成多个 IR item，且共享同一份 geometry。

## Decoration And Morphing

Section 15 只指出入口：path 使用前可以先 decorate/morph。具体算法在 decorations 章节。

```tex
\draw [red, decorate, decoration=zigzag]
      (0,0) rectangle (3,2);
```

实现要点：

- decoration 是对 path geometry 的重写或沿 path 放置 marks。
- decoration 应发生在 action 使用 path 前。
- snake/zigzag/brace/markings 都必须使用统一的 path length 参数化。
- arrow shortening、dash、decoration 的顺序要稳定，否则箭头附近会多出线段。

## TikZKit Implementation Checklist

- action shortcut 归一化：`\draw`、`\fill`、`\filldraw`、`\shade`、`\shadedraw`、`\clip`、`\useasboundingbox`。
- path-stream action accumulation：`[draw]`、`[fill]` 出现在 path 任意位置都应生效。
- action ordering：fill/pattern/shade before draw; preaction before main; postaction after main.
- color inheritance：`color`、`draw`、`fill`、裸颜色 token 的覆盖顺序。
- stroke parameters：line width/cap/join/miter limit。
- dash parameters：dash pattern、dash phase、dash shorthand、dash cap。
- double path：outer/inner stroke 两次绘制，double distance 正确换算。
- tips-only path：没有 draw 但有 `tips` 时仍可见 arrow tips。
- fill rule：复合 path 要保持在同一个 SVG path 内。
- path picture：支持 `path picture bounding box` 和 clipping scope。
- bbox action：`use as bounding box`、`current bounding box`、`current path bounding box`。
- clip：scope-local `<clipPath>`，多次 clip 取交集。
- preaction/postaction：多次复用同一 geometry，不合并 options。
- decorations：统一 path length、arrow shortening 和 decoration 顺序。

## Current TikZKit Status

已基本支持：

- `draw` / `fill` / `filldraw` 基础 action。
- path-stream `[draw]` / `[fill]` 可见性。
- line width 预设和 `line width=<dimension>`。
- line cap / line join 基础映射。
- dash pattern 和常用 dash shorthand。
- draw/fill/text opacity 基础映射。
- `even odd rule` / `nonzero rule` 基础映射。
- pattern metadata 和部分 SVG pattern renderer。
- ball/axis/radial shading 的部分近似。
- double path 的部分近似。
- decoration markings 的部分 postaction 近似。

需要继续对齐：

- `dash phase`、`miter limit` 的完整 SVG 输出。
- `pattern` 与 `fill` 的覆盖顺序。
- `shade` 与 `fill` 同时出现时的优先级。
- `path picture` 的真正 nested TikZ execution。
- `clip` 的 scope-local 图形状态。
- `use as bounding box` 对 viewBox/native 对比的影响。
- `preaction` / `postaction` 多次复用 path 的通用 IR。
- tips-only path。
- `double distance between line centers` 和 `double equal sign distance`。

## Case Notes

- Case 005: `decoration={snake,...}` 暴露 decoration、arrow shortening、post length 必须共用同一套 path length。
- Case 014: `double, dashed, thick` 暴露 double path 应按两次 stroke 处理，不是简单加粗。
- Case 024: `use as bounding box`、matrix 外框和 arrow label 位置应联动 bbox 和 action ordering。
- Case 158/179: 公式节点显示位置异常时，不能只查 KaTeX CSS，也要确认 path label、text bbox、clip/bbox action 是否影响外层 viewBox。
