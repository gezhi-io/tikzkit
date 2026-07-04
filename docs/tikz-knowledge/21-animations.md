# Section 26 - Animations

本节记录 TikZ `animations` library 的语义和 TikZKit 的实现路线。动画不是预渲染多帧图片；TikZ 的模型是给输出文件添加“某个对象的某个属性随时间变化”的 annotation。原生 TikZ 当前主要面向 SVG/SMIL，PDF 不真正支持动态动画，但可以通过 snapshot 生成静态帧。

## Core Model

```text
animate specification
-> select future object(s)
-> select attribute(s)
-> build timeline entries: time -> value
-> attach timeline metadata to target IR item
-> renderer outputs either SVG animation or static snapshot value
```

动画系统有五个核心字段：

- `object`: 被动画影响的对象。
- `attribute`: 被动画影响的属性。
- `id`: 同一对象同一属性的 timeline id，默认 `default`。
- `time`: 时间点。
- `value`: 该时间点的属性值。

当这五项足够完整时，`entry` 会向对应 object/attribute/id timeline 添加一个 time-value pair。

## Output Target

TikZ 手册明确说：真实动画目前主要适用于 SVG，使用 SMIL flavor。PDF 不具备等价动态动画能力。

对 TikZKit 来说应拆成两条路径：

1. Dynamic SVG mode
   - 输出 `<animate>`、`<animateTransform>`、`<animateMotion>` 或 CSS/JS metadata。
   - 保留交互事件，例如 click、mouseover、begin/end。
   - 主要服务网页端。

2. Snapshot/static mode
   - 解析 animation timeline。
   - 在指定时间点求值。
   - 把求值后的属性写回普通 IR style/transform/path。
   - 主要服务 native PNG 对比、静态网页预览、PDF fallback。

第一阶段更建议先实现 snapshot mode，因为它能直接帮助视觉对比和 case 校准。

## Objects

可以动画的对象包括：

- nodes。
- graphic scopes。
- view boxes。
- paths，包括 node background path。

重要规则：

- animation 必须在对象创建前声明。
- 通过 `animate={...}` 远程引用的 object name 指向未来对象，不影响已经创建的同名对象。
- `myself` 是特殊对象名，指当前使用 `animate` key 的 node/scope/path，不是名为 `myself` 的节点。
- `name path` 与动画对象命名无关；动画使用 `name` 或 node `(name)`。

TikZKit 实现含义：

- 需要 pending animation registry：先收集动画 spec，再绑定到后续创建的 IR item。
- `myself` 可以在 node/path/scope 创建时立即绑定。
- 对 scope 的动画要求 IR 保留 group boundary；当前 items 平铺模型不足。

## Attributes

手册列出的 animation attributes 包括：

- `dash phase`
- `dash pattern`
- `dash`
- `draw opacity`
- `draw`
- `fill opacity`
- `fill`
- `line width`
- `opacity`
- `position`
- `path`
- `rotate`
- `scale`
- `stage`
- `text opacity`
- `text`
- `translate`
- `view`
- `visible`
- `xscale`
- `xshift`
- `xskew`
- `xslant`
- `yscale`
- `yshift`
- `yskew`
- `yslant`

Shorthands and special attributes:

- `color` 是 `{draw, fill, text}` 的 shorthand，不是独立 timeline。
- `opacity` 通常应作为 transparency group 语义处理。
- `visible` 为 false 时对象不可点击，也无需渲染。
- `stage` 等同 `visible`，但默认 base 为 false。
- `shift` 是相对运动，可配合 `along` 沿 path 移动。
- `position` 是绝对位置语义，坐标按 `animate` key 所在坐标系解释。
- `path` 动画会 morph path 本身。
- `view` 依赖 views library。

## Animate Key

基础入口：

```tex
\usetikzlibrary{animations}

\tikz \node [
  animate = {
    myself:fill = {0s = "red", 2s = "blue", begin on = click}
  }
] {Click me};
```

`animate` 可以出现在：

- `tikzpicture` / `\tikz` options。
- `scope` options。
- `node` options。
- path options。

`animate` 的值在 `/tikz/animate` key path 下解释，可以定义 style：

```tex
\tikzset{
  animate/shake/.style = {
    myself:xshift = {
      begin on=click,
      0s = "0mm",
      50ms = "#1",
      150ms = "-#1",
      300ms = "0mm"
    }
  }
}
```

## Colon Syntax

在 `animate={...}` 中，冒号 syntax 同时选择 object 和 attribute：

```tex
object:attribute = { timeline options }
object:attribute_id = { timeline options }
```

两边都可省略，用于继承上层 selection：

```tex
animate = {
  mynode: = {
    :opacity = {0s="1", 5s="0"},
    :color   = {0s="red", 5s="blue"}
  }
}
```

多个对象可以分组：

```tex
{a,b,c}:opacity = {0s="1", 2s="0"}
```

Node/scope shorthand：

```tex
\node
  :fill opacity = {0s="1", 2s="0", begin on=click}
  :rotate       = {0s="0", 2s="90", begin on=click}
  [fill=blue!20] {Here};
```

注意：这种特殊解析会在遇到普通 `[...]` options 后停止。TikZKit parser 需要在 node/scoped/tikzpicture 的 option 解析前识别这些 animation attribute fragments。

## Time Syntax

时间可以写成：

```tex
0s = "red"
500ms later = "blue"
1:20 = "value"
```

时间解析规则：

- `s`: 秒，无缩放。
- `ms`: 毫秒，除以 1000。
- `min`: 分钟，乘以 60。
- `h`: 小时，乘以 3600。
- `:`: 类似时分秒，`1:20` 为 80s。
- 支持 math expression。
- `later` 表示相对上一 time/resume 的 offset。

Timeline time tools：

- `fork=<time>`: 开启局部分支时间。
- `remember=<macro>`: 记录当前绝对时间。
- `resume=<absolute time>`: 恢复到指定绝对时间。
- `scope={...}`: 局部 animation key scope。
- `sync={...}`: 类似 scope，但退出后保留内部最后时间。

## Value Syntax

值通常用引号：

```tex
0s = "red"
1s = "{(1,1)}"
"red" = 0s
```

规则：

- value 语法取决于 attribute：颜色、dimension、scalar、coordinate、path 等都不同。
- 含逗号的值需要额外花括号，例如 `"{(1,1)}"`。
- `current value` 可作为首个 timeline value，但限制很多，且不能用于 snapshot。
- `base` 可以指定 timeline 非激活时的值：

```tex
1s = "red" base
base = "orange"
```

## Timeline Controls

常用控制：

- `begin=<time>`: 页面显示后的开始时间，默认 0s。
- `end=<time>`: 截断结束。
- `begin on={event options}`: 由事件开始。
- `end on={event options}`: 由事件提前结束。
- `restart=true|false|never|when not active`。
- `repeats` / `repeat`。
- `repeats=<number>`。
- `repeats=for <time>`。
- `repeats=accumulating`。
- `forever` / `freeze`。
- `exit control={t}{v}`。
- `entry control={t}{v}`。
- `ease in` / `ease out` / `ease`。
- `stay` / `jump`。

Supported SVG-style events:

- click
- focus in / focus out
- mouse down / mouse up
- mouse over / mouse move / mouse out
- begin / end of another animation
- repeat
- key
- delay

Event object references:

- `of=<id>` points to already existing object.
- `of next=<id>` points to future object.
- If omitted, event applies to the animated object itself.

## Animated Paths

`:path` animation changes path geometry itself. Values are path specifications:

```tex
\draw :path = {
  0s = "{(0,0) -- (1,0)}" base,
  2s = "{(0,1) -- (1,0)}",
  arrows = ->
};
```

Rules:

- All path values must have compatible structure; generally same path command sequence.
- Coordinates may vary; command topology should not.
- Animated path arrows must be specified inside animation using `arrows`, not as normal static path arrows.
- `shorten <` / `shorten >` for animated paths also belong inside animation.

Implementation implication:

- TikZKit already has path commands and arrow metadata, but no path morphing timeline.
- Snapshot mode can interpolate matching command arrays.
- Dynamic SVG mode can use SVG path `d` animation only if command structures match.

## Animated Motion

Transform attributes include:

- `scale`, `xscale`, `yscale`
- `rotate`
- `xskew`, `yskew`
- `xslant`, `yslant`
- `xshift`, `yshift`
- `shift`
- `position`

`:shift` is relative to the animation coordinate system. `:position` is absolute in the coordinate system active where `animate` is used.

`along` moves an object along a path:

```tex
:shift = {
  along = {(0,0) circle[radius=5mm]} sloped in 2s,
  0s = "0",
  2s = "1"
}
```

Modes:

- `upright`: object stays upright.
- `sloped`: object rotates along path tangent.

Options:

- `origin=<coordinate>` shifts rotation/scale origin.
- `transform={...}` changes the animation coordinate system only, not the object itself.

## Snapshots

Snapshot keys:

- `make snapshot of=<time>`
- `make snapshot after=<time>`
- `make snapshot if necessary=<time>`
- `begin snapshot=<time>`

Snapshot semantics:

- Instead of emitting animation metadata, TikZ computes attribute values at a time and emits ordinary drawing commands.
- Works for output formats without animation support.
- User interaction events are ignored except `begin snapshot`.
- `current value` is forbidden.
- Accumulating repeats are not reliably supported.

TikZKit priority:

1. Implement `make snapshot of` first.
2. Reuse timeline parser and static style/path/transform application.
3. Use this to show animation examples as static frame strips in the web viewer.
4. Add dynamic SVG output after snapshot parity is usable.

## Current TikZKit Status

Observed in current code:

- No `src/libraries/animations.js`.
- `animations` is not in `src/libraries/index.js`.
- `animations` is not in `test/library-modules.test.js` observed library list.
- No parser support found for node/scope colon animation syntax like `:rotate = {...}`.
- No `animate={...}` semantic pipeline found.
- No SVG animation renderer found.
- No `make snapshot of` support found.

Reusable existing pieces:

- Static opacity/color/line width/dash/path style normalization.
- Coordinate transform and canvas-scale subsets.
- Path sampler / flattening for markings and decorations.
- Renderer can already output SVG paths/text/groups; animation metadata could attach to these items later.

## Implementation Plan

1. Library registry
   - Add `src/libraries/animations.js` with status `unsupported` or `partial`.
   - Add `animations` to library index and observed library test list.
   - Add registry row with local TeX source/doc references when corpus requires it.

2. Parser MVP
   - Parse `animate={...}` option as structured animation spec, not generic style text.
   - Parse `object:attribute = {...}` and `:attribute = {...}`.
   - Parse timeline entries `time = "value"` and quoted values.
   - Parse node/scope shorthand `:rotate = {...}` before ordinary `[options]`.

3. Animation IR
   - Add `ir.animations` or item-level `animations`.
   - Store target selector, attribute, id, entries, timeline options.
   - Support `myself` binding during item creation.
   - Support future object binding by name.

4. Snapshot engine
   - Parse time units: s/ms/min/h/colon/later.
   - Evaluate linear interpolation for number/dimension/color/opacity.
   - Apply snapshot value to static IR items.
   - Start with fill/draw/text opacity/xshift/yshift/rotate.

5. Dynamic SVG renderer
   - Map color/opacity/line width to `<animate>`.
   - Map transform attributes to `<animateTransform>`.
   - Map path `d` to SVG path animation when structures match.
   - Event triggers: click/mouseover/begin/end via SMIL attributes.

6. Full timeline controls
   - base/forever/freeze.
   - begin/end/begin on/end on.
   - repeats/restart.
   - easing controls.
   - `along` path motion.

## Visual QA Notes

Animation cases need two kinds of verification:

- Static snapshot: compare `make snapshot of` generated frame with MacTeX snapshot/native PNG.
- Dynamic SVG: inspect browser behavior manually or with Playwright screenshots at different times/events.

Check specifically:

- Animation target binding: future object vs previous object.
- `myself` semantics inside node/scope.
- `:shift` vs `:position`.
- color interpolation and opacity group semantics.
- path animation command compatibility.
- bbox expansion for animated shifts.
- event triggers and repeats.

## Case Notes

- `animation-dynamic_labels.tex` in collected package registry suggests real corpus contains animation-related examples, but current TikZKit has no animation library support.
- Timeline-themed cases in the corpus are mostly static custom timeline diagrams, not TikZ `animations` library; do not confuse those with Section 26 animation timelines.
