# Section 17 - Nodes and Edges

这份记录对应 TikZ manual section 17。对 TikZKit 来说，`node` 和 `edge` 不是简单的 SVG `<text>` 或 `<line>`，而是一套布局和拓扑连接系统：先测量文字/公式，构造 node box 和 shape boundary，再把路径端点、label、pin、edge 都绑定到这些元数据上。

## Web Renderer Thesis

TikZ 的 node 至少包含四层数据：

1. 文本内容：普通文本、TeX 数学、换行、段落宽度、字体命令。
2. box model：`inner sep`、`outer sep`、`minimum width/height/size`、`text width`。
3. shape boundary：rectangle、circle、ellipse、diamond、coordinate 等形状的边界和 anchors。
4. 拓扑引用：`(A)`、`(A.north)`、`(A.120)`、path border clipping、edge start/end、label/pin。

因此 Web 端不能只在 renderer 里画文字。解释器必须先登记 node 的中心、尺寸、shape、anchor 函数和 rotation，然后 path/edge 再通过同一套 anchor resolver 使用它。

## Node Operation

TikZ 的完整 node operation 语法允许 option、name、`at`、内容以多种顺序出现：

```tex
\node[draw] (A) at (0,0) {Text};
\path (0,0) node[above] {$x$};
\coordinate (P) at (1,2);
```

实现要点：

- `\node` 本质上是 `\path node ...;` 的快捷方式。
- `\coordinate` 是一种特殊 node，shape 为 coordinate，没有文字和尺寸。
- node 内容通常来自 `{...}`，也可由 `node contents=...` 提供。
- node 可以有 `name`、`alias`、`name prefix`、`name suffix`。
- `behind path` / `in front of path` 决定 node 与当前 path 的绘制顺序。
- `every node`、`every <shape> node`、`execute at begin/end node` 都是 node 构造前后的样式或 hook。

当前代码：

- `src/parser.js:parseNode`
- `src/parser.js:parseInlineNodeSegment`
- `src/interpreter.js:createNode`
- `src/interpreter.js:addInlinePathNode`
- `src/commands/node.js`

当前状态：

- 已支持基础 `\node`、命名节点、`at`、常用 options、matrix node 分流。
- 已支持 path 内 inline node 的基础解析和渲染。
- 未完整支持 `node contents`、`alias`、`name prefix/suffix`、`behind path` / `in front of path`、node-level begin/end hooks、node spec 中的 foreach。

## Node Box Model

TikZ node 的尺寸不是文本尺寸本身：

```text
visible text box
+ inner sep
+ minimum width/height/size
=> shape visible boundary
+ outer sep
=> anchor/border spacing boundary
```

关键参数：

- `inner sep` / `inner xsep` / `inner ysep`：文字到 shape 边界的内边距。
- `outer sep` / `outer xsep` / `outer ysep`：shape 到外部 anchor/border 的外边距，默认接近半个 line width。
- `outer sep=auto`：TikZ 会按 line width、fill/draw 和 scale 做补偿。
- `minimum width` / `minimum height` / `minimum size`：最小 shape 尺寸。
- `text width`：固定段落宽度，会触发换行和 `align`。
- `text height` / `text depth`：显式覆盖 TeX box 的高度/深度。
- `font` 与 `node font`：`node font` 会影响 node 尺寸计算环境，`font` 更偏文本排版。

Web 端实现要求：

- KaTeX/HTML/SVG text 的 CSS 不能改变已经测量好的 box。
- 公式节点要有 deterministic metrics，否则 circle/rectangle 外框和边界吸附都会漂。
- `text width` 不能让浏览器自然换行成不可控宽度，需要解释器或 renderer 固定 wrapping 宽度。

当前代码：

- `src/interpreter.js:estimateNodeLayoutSize`
- `src/interpreter.js:estimateNodeAnchorSize`
- `src/interpreter.js:estimatePositioningSelfSize`
- `src/math-metrics.js`
- `src/tex-text.js`
- `src/math-scoped-css.js`
- `src/renderer-svg.js`

当前状态：

- 已支持 `inner sep`、minimum size、部分 `text width` / `align` / font scaling。
- `outer sep` 部分参与 anchor clipping，但 `outer sep=auto` 和 line-width compensation 仍需校准。
- `node font` 与 `font` 的 TeX 级差异仍是 partial。
- `text height`、`text depth`、多行 TeX paragraph 的精确度仍需补齐。

## Shapes And Anchors

Node 被当作坐标时有两类语义：

```tex
(A.center)
(A.north)
(A.south east)
(A.45)
(A)
```

规则：

- `(A.anchor)` 是显式 anchor。
- `(A.45)` 是角度 anchor，通常表示从 node 中心沿 45 度射线与 shape boundary 的交点。
- `(A)` 在 path construction 中通常不是 center，而是根据下一段路径方向自动使用 boundary point。
- coordinate shape 例外：`(P)` 就是中心点，不做边界裁剪。
- rectangle、circle、ellipse、diamond 等 shape 都需要独立的 boundary 函数。
- node rotation 后，anchor 的局部点也要跟随旋转。

当前代码：

- `src/interpreter.js:nodeAnchorCoordinate`
- `src/interpreter.js:clipNodeLineEndpoints`
- `src/interpreter.js:clipNodeCurveEndpoints`
- `src/interpreter.js:resolveAnchoredNodeCoordinate`

当前状态：

- 已支持常用 compass anchor、numeric anchor、部分 custom shape anchor、line/curve endpoint clipping。
- 需要继续对齐 circle/ellipse/rectangle 的真实 TikZ boundary path，尤其是 rotated shape、outer sep、line width 与 arrow shorten 的联动。

## Positioning Library

`positioning` library 将 node 放置从“中心坐标”提升为“box-to-box spacing”：

```tex
\node[box] (A) {A};
\node[box, right=1cm of A] (B) {B};
\node[box, below right=3mm and 8mm of A] (C) {C};
```

规则：

- `right=of A` 使用 `node distance` 默认距离。
- `right=1cm of A` 表示 A 的右边界到当前 node 左边界相距 1cm。
- `below right=<vertical> and <horizontal> of A` 中 `and` 前后顺序是 y and x。
- 单个 diagonal distance 会按斜向距离处理。
- `on grid` 会改为 center-to-center 逻辑。
- `of <coordinate>` 和 `of <node>` 不一样：coordinate 没有尺寸。

当前代码：

- `src/libraries/positioning.js`
- `src/interpreter.js:resolvePositioning`

当前状态：

- 已支持 `right/left/above/below=... of`、corner directions、`node distance`、legacy `right of`。
- `on grid`、`base left/right`、`mid left/right`、精确 TeX baseline 语义仍需补齐。

## Nodes On Paths

Path 内 node 是最容易导致文字位置错乱的部分：

```tex
\draw (0,0) -- node[above] {mid} (1,0);
\draw (0,0) -- node[pos=.25,sloped,above] {$x$} (1,1);
```

规则：

- `pos=<fraction>` 默认放在当前 path segment 上。
- 直线 segment 使用线性插值。
- Bézier curve 的 `pos` 是 curve parameter time，不是 arc length。
- `|-` / `-|` 的 `pos=.5` 是拐角点。
- `midway` = `pos=.5`，`near start` = `.25`，`near end` = `.75`。
- `auto=left/right` 根据 path 方向把 label 推到左侧或右侧。
- `swap` 或 `'` 反转 auto side。
- `sloped` 让 node 跟随 path tangent；默认会保持文字不倒置，除非 `allow upside down`。

当前代码：

- `src/parser.js:parseInlineNodeSegment`
- `src/interpreter.js:addInlinePathNode`
- `src/interpreter.js:slopedInlineNodeRotation`
- `src/interpreter.js:resolveAutoInlineNodePoint`

当前状态：

- 已支持 inline node、`pos`、`auto`、`swap`、`sloped` 的实用近似。
- 需要补齐 Bézier parameter time、`|-` / `-|` corner semantics、path-wide implicit node scoping、`'` quotes alias 的完整一致性。

## Labels, Pins, And Quotes

TikZ 的 `label` 和 `pin` 不是普通文本属性，它们会生成额外 node：

```tex
\node[label=above:$A$] (A) at (0,0) {};
\node[pin=45:$p$] (P) at (1,1) {};
```

规则：

- `label=<angle or direction>:<text>` 生成一个 label node。
- `label distance` 控制 label 与主 node 的距离。
- `pin` 生成 label node 和 pin edge。
- `pin distance`、`pin edge`、`every pin`、`every pin edge` 参与样式。
- `quotes` library 允许 `"text"` 作为 edge/node label 的简写。

当前代码：

- `src/parser.js`: repeated `label` / `pin` option 保留为数组。
- `src/interpreter.js:nodeLabels`
- `src/interpreter.js:nodePins`
- `src/libraries/quotes.js`

当前状态：

- 已支持基础 repeated label/pin、label distance、pin edge 的近似。
- `quotes` 目前主要登记能力，完整 `"..." options`、`every edge quotes`、node quotes/pin quotes 还需要系统实现。

## Edge Operation

TikZ 的 `edge` 不是普通 `--`。它会“挂起”当前 path，单独生成一条从 start 到 target 的 path：

```tex
\path (A) edge[red] node[midway,above] {$e$} (B)
          edge[blue,bend left] (C);
```

规则：

- `edge` 使用 edge 前的 last coordinate 作为 start。
- 如果 edge 前紧跟 node operation，则刚声明的 node 是 start。
- `edge` 不更新当前 point；连续多个 edge 共享同一个 start。
- edge 继承外层 path options，再叠加 `every edge` 和 edge local options。
- `every edge` 默认包含 draw 行为。
- edge 中的 node/quotes 是 edge label，按 edge path 放置。

当前代码：

- `src/parser.js`: path segments 中已有 `edge` / `to`。
- `src/interpreter.js`: `segment.kind === "edge"` 单独生成 subtype `edge` path。
- `src/interpreter.js:edgeDrawableStyle`
- `src/interpreter.js:edgeCurveSpec`

当前状态：

- 已支持基础 `edge`、bend/out/in/loop、edge label node 的近似。
- 需要校准 `\tikztostart`、edge 前置 node 作为 start、`every edge`/`every edge quotes`、edge 不改变 current point 的完整语义。

## Cross-picture Nodes

Section 17 还包含：

- `remember picture`
- `overlay`
- `current page`
- `node also`
- `late options`

这些功能依赖跨 picture 的全局坐标、页面级 bbox 和延迟修改 node。对当前 Web 单图渲染器来说，应先标记为 advanced/partial，不要混入普通 node 修复。

## Implementation Slices

建议按下面顺序推进，不要按单个 case 硬编码：

1. Node metrics core：`font` / `node font`、`text width`、`align`、`text height/depth`、KaTeX scoped CSS。
2. Box model：`inner sep`、`outer sep=auto`、minimum size、shape-specific visible vs anchor boundary。
3. Anchor resolver：compass、angle、base/mid、rotated anchors、coordinate shape exception。
4. Path label placement：`pos`、`auto`、`swap`、`sloped`、`|-`/`-|` corner semantics。
5. Edge engine：`every edge`、`\tikztostart`、edge-local node/quotes、consecutive edge start preservation。
6. Labels/pins/quotes：`label`、`pin`、`every label/pin`、`quotes` library。
7. Ordering and hooks：`behind path`、`in front of path`、node begin/end hooks。
8. Cross-picture layer：`remember picture`、`overlay`、`current page`、`node also`、`late options`。

## Case Notes

- `angles,calc,quotes` sample: `pic {angle=F--X--A}` depends on `angles` library, intersection coordinate, quotes label parsing, and path/node layering.
- Case 158 / formula clipping: likely belongs to Node metrics core and KaTeX scoped CSS. If CSS changes display correctly but scripts break, measurement and renderer CSS must be bound under TikZKit-specific classes.
- Cases with arrows ending inside boxes/circles: anchor resolver, outer sep, and arrow endpoint shortening must be treated as one shared geometry problem.
