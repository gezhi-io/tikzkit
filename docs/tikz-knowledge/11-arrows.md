# Arrows

TikZ manual section 16 说明：arrow tip 不是普通 SVG marker 的简单替换，而是 path action 的一部分。箭头需要解析 specification、tip kind、tip-local options、path shortening、curve tangent/flex/bend、multi-tip sequence，以及 start/end 两端不同方向的语义。

## Core Semantics

箭头成立需要同时满足：

```text
1. path 有 arrow specification，例如 ->、<-、<->、-{Stealth[...]}
2. tips key 允许绘制
3. path 不是 closed path
4. path 至少有一个有效 open subpath
5. clip 没有禁止 arrow tips
```

核心语法：

```tex
\draw[->] (0,0) -- (1,0);
\draw[<-] (0,0) -- (1,0);
\draw[<->] (0,0) -- (1,0);
\draw[-stealth] (0,0) -- (1,0);
\draw[-{Stealth[length=8pt,open]}] (0,0) -- (1,0);
\draw[arrows={Stealth[]-Latex[]}] (0,0) -- (1,0);
```

`arrows=<start spec>-<end spec>` 是完整形式。常见 `->` 只是 shorthand。未知 option 里只要包含 `-`，TikZ 会尝试把它作为 arrow specification。

## Placement Rules

TikZ 只给最后一个 open subpath 放 arrow tips：

```tex
\draw[<->] (0,0) -- (1,0) (2,0) -- (3,0);
```

上面只给第二条 subpath 放箭头。

禁止放箭头的情况：

- 没有 arrow specification。
- `tips=false` 或 `tips=never`。
- `tips=on draw` / `on proper draw` 但 path 没有 draw action。
- path 为空。
- 任意 subpath closed，例如 `cycle`、`circle`、`rectangle`。
- `clip` action 存在。

退化 path：

```tex
\draw[<->] (0,0);
```

`tips=true` / `tips=on draw` 可以在单点上画向上的箭头；`proper` 会禁止这种退化箭头。

TikZKit 当前没有完整实现 `tips` key 和 degenerate path arrows。当前主要靠 `markerStart` / `markerEnd` 存在来决定可见性。

## Arrow Tip Specification

Section 16.4 的完整 specification 支持一端多个 tip：

```tex
\draw[<<<->>>>] (0,0) -- (2,0);
\draw[-{Stealth[] Latex[]}] (0,0) -- (2,0);
\draw[-{Stealth[sep] . Stealth[] Stealth[]}] (0,0) -- (2,0);
```

语法要点：

- end spec 中最后一个 tip 在最末端。
- start spec 顺序相反。
- `sep` 控制多个 tip 间距。
- `.` 指定 path body 应该停在哪个 tip 附近。
- `[]` 可放在 spec 开头，作为后续所有 tips 的默认 option。
- `/.tip` 可以定义 shorthand。
- `>=Latex` 等价于设置 `<->/.tip=Latex` 的常用 shorthand。

TikZKit 当前只支持单个 start tip 和单个 end tip。`>>>`、`Stealth[] Latex[]`、`.`、`sep`、`/.tip` 的完整语义都未实现。

## Arrow Keys

### Size

常见 size keys：

```tex
Stealth[length=5mm]
Latex[width=10pt,length=10pt]
Stealth[inset=2pt]
Triangle[angle=60:1pt 3]
Stealth[width'=0pt .5]
```

Section 16 的 size 不是简单 dimension：

```text
length = dimension + lineWidthFactor * chosenLineWidth
width  = dimension + lineWidthFactor * chosenLineWidth
outer factor controls double-line width contribution
width' / inset' can depend on computed length
angle / angle' compute width/length from tip angle
```

TikZKit 当前只解析 `length`、`width`、`line width` 的简单 dimension，不支持：

- `length=0pt 5` 这类 line width factor。
- outer factor 对 double path 的影响。
- `width'` / `inset` / `inset'`。
- `angle` / `angle'`。
- size key 的顺序依赖。

### Scaling

```tex
Stealth[scale=2]
Stealth[scale length=1.5]
Stealth[scale width=2]
```

TikZKit 当前未实现这些 arrow-local scale key。

### Slant / Reverse / Halves

```tex
Stealth[slant=.3]
Stealth[reversed]
Stealth[harpoon]
Stealth[left]
Stealth[right]
Stealth[harpoon,swap]
```

TikZKit 当前未实现 `slant`、tip-local `reversed`、`harpoon`、`swap`、`left`、`right`。现有 `<-` / start marker 只是通过 renderer 旋转方向实现，不等于 tip-local reversed。

### Color / Fill / Open

```tex
Stealth[color=blue]
Stealth[blue]
Stealth[fill=white]
Stealth[fill=none]
Stealth[open]
```

TikZKit 当前支持：

- `color=<color>` / `draw=<color>` 的一部分。
- `fill=<color>` 的一部分。

未完整支持：

- 裸颜色 arrow key，例如 `Stealth[blue]`。
- `open` 作为 `fill=none` shorthand。
- `pgffillcolor`。
- `color` 与 `fill` 的顺序语义：`color` 会重置 fill，必须先 color 后 fill。

### Arrow Tip Line Style

```tex
Stealth[round]
Stealth[sharp]
Computer Modern Rightarrow[line cap=round]
Computer Modern Rightarrow[line join=miter]
Latex[line width=0pt]
```

TikZKit 当前 renderer 对所有 inline arrow tip 基本统一使用 round cap/join 或固定几何；未完整支持 tip-local:

- `line cap`
- `line join`
- `round`
- `sharp`
- `line width'`

### Curves: Quick / Flex / Bend

```tex
Stealth[quick]
Stealth[flex]
Stealth[flex=.5]
Stealth[flex']
Stealth[bend]
```

TikZ 对曲线箭头有三种策略：

- `quick`: 沿终端 tangent 简单修剪，会改变曲线局部形状。
- `flex`: 沿曲线长度修剪，尽量保持原曲线形状。
- `bend`: 箭头 tip 自身沿曲线弯曲。

TikZKit 当前：

- 对 cubic/quad terminal 使用 tangent 做 renderer 侧 shorten。
- 不实现 path-length accurate flex。
- 不实现 bent arrow tip geometry。
- 不处理 bending library 改变默认行为。

这也是曲线箭头、弯曲边框箭头和 snake decoration 附近容易出视觉差异的关键原因。

## Predefined Arrow Tip Kinds

Section 16.5 `arrows.meta` 分类：

Barbed:

```text
Arc Barb
Bar
Bracket
Hooks
Parenthesis
Straight Barb
Tee Barb
```

Mathematical:

```text
Classical TikZ Rightarrow
Computer Modern Rightarrow
Implies
To
```

Geometric:

```text
Circle
Diamond
Ellipse
Kite
Latex / LaTeX
Rectangle
Square
Stealth
Triangle
Turned Square
```

Caps:

```text
Butt Cap
Fast Round
Fast Triangle
Round Cap
Triangle Cap
```

Special:

```text
Rays
```

TikZKit 当前 `src/tikz-metrics.js` 只内置：

```text
to
stealth
latex
two-heads
hook
open-circle
circle
open-triangle
bar
dimline
dimline reverse
```

这意味着大部分 `arrows.meta` tip kind 还没有专门几何。很多未知 tip 会退回成 `to` 或一种近似曲线箭头，视觉不会像 native TikZ。

## Current TikZKit Support

已支持或部分支持：

- `->`、`<-`、`<->`。
- `-stealth`、`stealth-`。
- `-latex'`。
- `-{Stealth[color=...,fill=...,width=...,length=...]}` 的基础解析。
- `Bar[...]`。
- `*-` / `-*` endpoint dot。
- `open circle`、`open triangle`，主要服务 BPMN/tikz-cd/circuitikz。
- line width 驱动的默认 `to` tip 尺寸近似。
- renderer inline path arrow，不再依赖 SVG marker，能做 endpoint shorten。
- 直线和简单曲线 terminal tangent shortening。
- dashed arrow stem 使用 butt cap，arrow tip 使用独立 path。

## Missing Or Partial

优先级按对真实 case 的影响排序：

1. **manual shorten keys**
   - 缺 `shorten <=` / `shorten >=` 的通用 path 支持。
   - 目前只在 circuitikz post lead 有局部处理。

2. **tips key**
   - 缺 `tips=true|proper|on draw|on proper draw|never|false`。
   - 缺 tips-only path，例如 `\path[tips, -{Latex}] ...`。
   - 缺 closed subpath 禁止 arrows 的完整判断。

3. **multi-tip specification**
   - 缺 `>>>`。
   - 缺 `Stealth[] Latex[]`。
   - 缺 `sep`。
   - 缺 `.` line-end marker。
   - 缺 start/end spec 顺序反转的完整模型。

4. **arrow shorthand system**
   - 缺 `/.tip`。
   - 缺 `>=...` 的完整 shorthand semantics。
   - 缺 scope-level `arrows={[bend]}` arrow-key defaults。

5. **arrows.meta tip catalog**
   - 缺 Arc Barb、Bracket、Hooks、Parenthesis、Straight Barb、Tee Barb。
   - 缺 Computer Modern Rightarrow / Classical TikZ Rightarrow / Implies 的真实几何。
   - 缺 Diamond、Ellipse、Kite、Rectangle、Square、Triangle、Turned Square。
   - 缺 Butt/Round/Triangle caps、Fast Round/Fast Triangle、Rays。

6. **arrow-local options**
   - 缺 `open`。
   - 缺 bare color key。
   - 缺 `scale`、`scale length`、`scale width`。
   - 缺 `width'`、`inset`、`inset'`、`angle`、`angle'`。
   - 缺 `slant`。
   - 缺 `harpoon` / `swap` / `left` / `right`。
   - 缺 tip-local `line cap` / `line join` / `round` / `sharp`。
   - 缺 `arc`、`cap angle`、`n`。

7. **curve mode**
   - 缺 `quick` / `flex` / `flex'` / `bend`。
   - 缺 bending library 改默认 flex mode。
   - 缺多箭头在曲线上独立沿 path length 排布。

8. **double-line interaction**
   - `length` outer factor 未实现。
   - Implies + `double equal sign distance` 未实现。
   - double path arrow tip 仍需要 native/tikztosvg 校准。

9. **renderer consistency**
   - interpreter 和 renderer 都有 shortening 逻辑，需明确职责，避免部分场景双重修剪或修剪不一致。
   - arrow tip bbox 是否纳入 SVG viewBox 需要继续校准。

## Recommended Implementation Slices

不要一次实现完整 Section 16。建议按真实 case 和视觉收益拆：

1. `shorten <=/>=` 通用 path support。
2. `open`、bare color、`scale`、`sep` 的 parser/options support。
3. multi-tip model：把 `markerStart/End` 从单个 tip 升级为 tip sequence。
4. `>=...` 和 `/.tip` shorthand registry。
5. Stealth/Latex/Triangle/Bar/Circle 的 native-like geometry 与 `open/round/sharp/slant/left/right`。
6. `tips` key + tips-only path。
7. curve `flex` approximation based on flattened path length。
8. remaining arrows.meta catalog。

## Case Notes

- Case 005: snake decoration + arrow 暴露 decoration 后 path length、post length、arrow shorten 顺序问题。
- Case 014: dashed double arrow 暴露 double path + arrow tip + dash cap 的组合问题。
- Case 024/030/136: arrow endpoint 与 node/component/frame 对齐暴露 shorten、anchor clipping、arrow geometry 需要统一。
- circuitikz cases: component lead arrows 需要 `shorten <=/>=` 通用化，不能只在 circuitikz 局部处理。
