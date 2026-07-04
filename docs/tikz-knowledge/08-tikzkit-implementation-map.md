# TikZKit Implementation Map

这个文件记录 TikZ 概念到 TikZKit 当前代码的映射，方便后续修复 case 时定位。

## Core pipeline

```text
source
-> parser
-> TeX-lite expansion
-> semantic interpreter
-> drawing IR
-> SVG renderer
```

## 当前主要文件

| TikZ 概念 | 当前位置 | 说明 |
| --- | --- | --- |
| parser / statements | `src/parser.js` | 负责切 statement、解析 path/node/matrix/axis 等结构。 |
| semantic interpreter | `src/interpreter.js` | 最大的语义层文件，处理坐标、path、node、library 近似实现。 |
| options/style | `src/options.js` | key-value option、style expansion、颜色解析入口。 |
| math / dimension | `src/math.js` | pgfmath、dimension、变量替换。 |
| geometry | `src/geometry.js` | path flatten、intersection、length sampling。 |
| renderer | `src/renderer.js` | IR 到 SVG。 |
| calc library | `src/libraries/calc.js` | calc coordinate expression。 |
| positioning library | `src/libraries/positioning.js` | `right=of` 等 positioning 语义。 |
| matrix library | `src/libraries/matrix.js` | matrix of nodes 支持。 |
| commands | `src/commands/` | 正在拆分的常用命令模块。 |
| libraries | `src/libraries/` | 内置 TikZ library 的分离位置。 |
| packages/extensions | `src/packages/`, `src/extensions/` | 第三方 package 或扩展兼容层。 |

## Section 12 落地规则

TikZ manual section 12 明确了 package、library、picture、scope、path、node 的层级关系。TikZKit 对应实现应遵循：

- package/library 负责注册能力和默认语义，不直接生成 SVG。
- `tikzpicture[...]` 是图级 scope，options 应作为内部 path/node 的默认上下文。
- `every picture` 必须在每张图开始时自动安装。
- `scope[...]` 是局部上下文，transform、clip、style、font、pictureOptions 都不能泄漏到外层。
- `every scope` 必须在每个 scope 开始时自动安装。
- `/.style`、`/.append style`、`/.prefix style`、`/.default` 是定义层 option，不能作为普通 SVG style 透传。

已落实：

- `src/interpreter.js`: picture 初始化会注入 `every picture`。
- `src/interpreter.js`: scope 初始化会注入 `every scope`。
- `test/hierarchical-structures.test.js`: 覆盖图级和 scope 级默认样式。

## Section 13 坐标系统落地规则

TikZ manual section 13 解释了定位不准的核心来源：坐标不是一种格式，而是多个 coordinate system 的入口。

已落实：

- `src/interpreter.js`: 隐式 `(x,y)` 会区分 canvas dimension、xyz factor 和 mixed coordinate。
- `src/interpreter.js`: dimension 表达式中的裸数字在带单位上下文里按 pt 解释，例如 `2+3cm` 等价于 `2pt+3cm`。
- `src/interpreter.js`: 隐式 polar 会区分 `(30:1cm)` 的 canvas polar 与 `(30:1)` 的 xyz polar。
- `src/interpreter.js`: 支持显式 `canvas cs:`、`xyz cs:`、`canvas polar cs:`、`xyz polar cs:`、基础 `node cs:`。
- `test/coordinates-section13.test.js`: 覆盖上述关键坐标规则。

## Section 14 path specification 落地规则

TikZ manual section 14 说明 path 是 operation stream。路径内部 `[options]` 不能丢弃，`every path` 也必须在每条路径开始时安装。

已落实：

- `src/parser.js`: path-stream 中裸 `[options]` 会保留为 `options` segment。
- `src/interpreter.js`: `every path` 自动注入每条 path。
- `src/interpreter.js`: path-stream 中的 `draw` / `fill` 会让 `\path` 可见。
- `src/interpreter.js`: path-stream 中的颜色、线宽、dash、arrow 等会进入最终 path style。
- `test/paths-section14.test.js`: 覆盖 `every path` 和 `\path ... [draw, red, thick] ...`。

待实现：

- `rounded corners` / `sharp corners` 的后续 corner 几何改写。
- path 内 option scope `{[options] ...}`。
- path-stream transform options 对后续坐标的局部影响。

## Section 15 actions on paths 落地规则

TikZ manual section 15 说明 path 构造完成后会被 action 使用。`draw`、`fill`、`shade`、`clip`、`use as bounding box`、`preaction`、`postaction` 都是对同一份 path geometry 的不同消费方式。

已落实：

- `src/options.js`: `draw`、`fill`、`color`、裸颜色 token、line width、line cap、line join、dash、opacity、fill rule、pattern metadata 的基础归一化。
- `src/interpreter.js`: `draw` / `fill` / `filldraw`、path-stream action 可见性、部分 shading、double path、postaction decorations 的近似。
- `src/renderer-svg.js`: stroke/fill、dash、fill-rule、pattern defs、部分 gradients、double path 的 SVG 输出。

待实现或需视觉校准：

- action IR 拆分为同一 geometry 的多次消费，覆盖 `preaction` / `postaction` / `path picture`。
- `clip` 作为 scope-local graphic state，而不是普通 invisible path。
- `use as bounding box`、`current bounding box`、`current path bounding box` 对 viewBox 和对比网格的影响。
- `dash phase`、`miter limit`、`double distance between line centers`、`double equal sign distance`。
- tips-only path，即没有 draw 但有 arrow tips 的 path。
- pattern/shading/fill 的覆盖顺序和 native/tikztosvg 视觉对齐。

## Section 16 arrows 落地规则

TikZ manual section 16 说明 arrow tip 是 path action 的一部分，不只是 SVG marker。完整实现需要 arrow specification parser、tip sequence、tip-local options、path shortening、curve flex/bend 和 `arrows.meta` tip catalog。

已落实：

- `src/options.js`: 解析 `->`、`<-`、`<->`、`*-`、`-*`、`-stealth`、`-latex'`、`-{Stealth[...]}`、基础 `width` / `length` / `line width` / `color` / `fill`。
- `src/tikz-metrics.js`: 内置 `to`、`stealth`、`latex`、`two-heads`、`hook`、`open-circle`、`circle`、`open-triangle`、`bar`、`dimline`。
- `src/renderer-svg.js`: inline arrow path 渲染、endpoint shorten、直线/简单曲线 terminal tangent、dashed stem butt cap。
- `test/interpreter.test.js`、`test/renderer.test.js`: 覆盖常见 arrow shorthand、Bar、star endpoint、inline shorten、dashed arrow caps。

缺失或 partial：

- 通用 `shorten <=` / `shorten >=`，当前主要是 circuitikz 局部处理。
- `tips` key、tips-only path、degenerate path arrows、closed subpath 禁止 arrows。
- multi-tip sequence：`>>>`、`Stealth[] Latex[]`、`sep`、`.`。
- `/.tip`、`>=...` 完整 shorthand registry、scope-level `arrows={[...]}` defaults。
- 大部分 `arrows.meta` tip kinds：Arc Barb、Bracket、Hooks、Straight Barb、Computer Modern Rightarrow、Implies、Diamond、Kite、Triangle、caps、Rays 等。
- arrow-local `open`、bare color、`scale`、`width'`、`inset`、`angle`、`slant`、`harpoon`、`swap`、`left/right`、`round/sharp`、`arc`、`cap angle`、`n`。
- `quick` / `flex` / `flex'` / `bend` 和 bending library。
- double-line arrow size outer factor 和 `double equal sign distance`。

待实现：

- `baseline=(coordinate)` 的 inline 对齐 metadata。
- `execute at begin/end picture` 与 `execute at begin/end scope` hook。
- `\scoped[...]` 单命令 scope。
- `scopes` library 的 `{ [options] ... }` 简写。

## Section 17 nodes and edges 落地规则

TikZ manual section 17 说明 node 是带文本度量、box model、shape boundary 和 anchor resolver 的对象；edge 是从当前点派生出来的独立 path operation。Web 渲染不能只把它们当 SVG text/line。

已落实：

- `src/parser.js`: 支持独立 `\node`、path 内 inline `node`、repeated `label` / `pin` options。
- `src/interpreter.js`: `createNode` 会计算 node layout、anchor size、注册 named node，并支持 matrix node 分流。
- `src/interpreter.js`: `addInlinePathNode` 支持 path label、`pos`、`auto`、`swap`、`sloped` 的常用近似。
- `src/interpreter.js`: `nodeAnchorCoordinate` 支持常用 compass/numeric/custom anchors。
- `src/interpreter.js`: `nodeLabels` / `nodePins` 支持基础 label/pin 与 pin edge。
- `src/libraries/positioning.js`: 支持 `right/left/above/below=... of`、corner placement、`node distance`。
- `src/interpreter.js`: path segment `edge` 会生成单独 subtype `edge` path，并支持 bend/out/in/loop 的近似。

缺失或 partial：

- `node contents`、`alias`、`name prefix/suffix`、node spec 中的 foreach。
- `behind path` / `in front of path`、node begin/end hook、`every <shape> node` 的完整语义。
- `outer sep=auto`、`node font` 与 `font` 的 TeX 级差异、`text height` / `text depth`、multipart `\nodepart`。
- `on grid`、`base left/right`、`mid left/right`、baseline positioning 的完整 positioning library 语义。
- Bézier `pos` 按 parameter time、`|-` / `-|` corner label、path-wide implicit node scope 的精确行为。
- `quotes` library 的 `"..." options`、`every edge quotes`、node quotes/pin quotes。
- edge 的 `\tikztostart`、edge 前置 node 作为 start、consecutive edge 不更新 current point 的完整一致性。
- `remember picture`、`overlay`、`current page`、`node also`、`late options`。

待实现切片：

- Node metrics core：KaTeX scoped CSS、font/node font、text width、align、height/depth。
- Box/anchor core：outer sep auto、shape boundary、rotated anchors、coordinate shape exception。
- Path label core：pos/auto/swap/sloped、corner segments、curve parameter。
- Edge core：every edge、tikztostart、edge quotes、edge-local labels。
- Labels/pins/quotes：label/pin node generation 与 quotes library 统一。

## Section 18 pics 落地规则

TikZ manual section 18 说明 pic 是 path 上的 small picture：遇到 pic 时挂起当前 path，在局部 scope 中执行 pic type 对应的 TikZ code，再恢复外层 path。Pic 自身通常不可引用，但 pic 内部 nodes/coordinates 可以通过 name prefix 暴露。

已落实：

- `src/parser.js`: 支持独立 `\pic[options] (name) at (...) {body}` 和 path 内 `pic [options] {body}` 的基础解析。
- `src/parser.js`: `collectPicDefinitions` / `parseTikzPics` 支持简单 `name/.pic={...}` 定义。
- `src/interpreter.js`: `createCustomPic` 会把 pic definition 解析成 statements 并在 translated child env 中解释。
- `src/interpreter.js`: `picNamePrefix` / `resolvePicScopedName` 支持 pic 内 `-anchor` 名称暴露到外部。
- `src/interpreter.js`: `pic actions` 通过 child env style 做了基础传递。
- `src/interpreter.js`: `buildAnglePic` / `createAnglePic` 对 `pic {angle=A--B--C}` 有特例实现。

缺失或 partial：

- Pic spec 任意顺序、`pic type=...`、pic spec foreach、path pic 的 name/at/foreach/animation attribute。
- `every pic` 自动安装与 pic-local option 覆盖顺序。
- Generic path pic 展开；当前 path pic 主要覆盖 angle 特例。
- `pics/<name>/.style={code=...}`、`pics/code={...}`、参数化 pic style。
- `/tikz/pics/background code`、`/tikz/pics/foreground code`。
- `behind path` / `in front of path` 与 node/pic/path 的统一 layering。
- `name prefix ..`、nested pic prefix stack。
- `pic text`、`pic text options`、`every pic quotes` 的通用 quotes 机制。
- `src/libraries/angles.js` 仍标记 unsupported，但 interpreter 已有 angle pic 特例，library status 需要校准。

待实现切片：

- Pic parser parity：完整 pic spec 顺序、`pic type`、foreach、path pic placement。
- Pic registry：`.pic`、`pics/name/.style`、`pics/code`、参数和 code key。
- Pic scope：`every pic`、transform shape、pic-local transforms、action isolation。
- Pic layering：behind/front path、foreground/background code。
- Pic text/quotes：统一 quotes library，让 angle pic 使用 `pic text`。
- Pic module split：把 angle/cube/TQFT pic 从 `interpreter.js` 拆到 library/extension 文件。

## Section 19 graphs 落地规则

TikZ manual section 19 说明 `graphs` library 是 graph grammar 到普通 node/edge 的高层展开器，不是完整 graphdrawing engine。TikZKit 应先实现 graph parser 和简单 online placement，再考虑 graphdrawing/offline layout。

已落实或相关：

- `src/libraries/graphs.js`: 当前仅声明为 builtin compatibility layer。
- `src/preprocess.js:expandTkzGraphMacros`: 支持 `tkz-graph` package 的 `\Vertex` / `\Edge`，这不是 Section 19 `\graph` grammar。
- `src/extensions/tikz-feynman.js`: 有独立 graph parser，仅服务 tikz-feynman。
- `src/interpreter.js`: 已有普通 node/edge、anchor clipping、edge label 的底层能力，可供未来 graph 展开复用。

缺失或 partial：

- `\graph[options]{...}` parser。
- `/tikz/graphs` key path、`every graph`、`nodes`、`edges`、`edge node`、`edge label`。
- group/chain parser：comma/semicolon、balanced option list、nested groups、foreach、parse key。
- edge specs：`->`、`--`、`<-`、`<->`、`-!-` 与 `new ->` 等 semantic hooks。
- direct/reference/group node specs，`as`、slash text、quoted names、fresh/reference/use existing/number nodes。
- node sets：`new set`、`set`、`(set name)`。
- graph edge quotes、`>` / `<` target/source edge syntax。
- simple/multi graph semantics and delayed simple edge table。
- color classes、operators、joining operators。
- online placement：grow/branch/grid/circular/size-aware sep。
- `graphs.standard`: `I_n`、`I_nm`、`K_n`、`K_nm`、`P_n`、`C_n`、`Grid_n`。

待实现切片：

- Graph parser MVP：direct chains + `->` / `--`。
- Node creation: `nodes={...}`、`as`、slash text、`empty nodes`、`math nodes`。
- Edge creation: `edges={...}`、left/right anchor、edge label、quotes。
- Groups + default `matching and star` joining。
- Placement MVP：grow/branch、x/y/at/no placement。
- Incoming/outgoing edge syntax：`>` / `<`。
- Simple graph and `-!-` deletion。
- `graphs.standard` graph macros。

## Section 20 matrices and alignment 落地规则

TikZ manual section 20 说明 matrix 是特殊 node，内部每个 cell 是轻量 picture。正确布局必须基于每个 cell picture 的 bbox 和 origin，而不是统一最大 cell 宽高网格。

已落实或相关：

- `src/parser.js:parseMatrix`: 支持常见 `\matrix` statement 顺序。
- `src/interpreter.js:createMatrix`: 注册 matrix node、cell nodes、`m-<row>-<column>` anchors，并输出 matrix frame/cells。
- `src/libraries/matrix.js`: 提供 `matrix of nodes` / `matrix of math nodes` helper、row node options、bracket delimiter helper。
- `test/petarv-compat.test.js`、`test/walmes-compat.test.js`、`test/tikz-cd.test.js`: 覆盖 matrix of nodes、cell anchors、Case 024/025、tikzcd matrix spacing 的部分行为。

缺失或 partial：

- matrix layout 仍按统一最大 cell 宽高近似，未按每个 cell 的 bbox/origin、row height/depth、column left/right extents 计算。
- `row sep` / `column sep` 的 spacing list 未完整支持：`between origins`、`between borders`、局部 `\\[...]` / `&[...]`。
- 通用 cell picture 解释缺失；当前 cell 主要按文本或简单 node 处理。
- `every matrix`、`every outer matrix`、`every cell`、`cells`、column/even/odd/cell style cascade 未完整实现。
- `execute at begin/end/empty cell` 还不是通用机制。
- `matrix anchor=<node.anchor>` 还没有完整接入 anchor resolver。
- arbitrary `ampersand replacement=<macro>`、`\pgfmatrixnextcell` 支持不足。
- delimiter catalog 只支持 bracket 子集。

待实现切片：

- Matrix layout solver：cell bbox/origin -> row/column extents。
- Spacing list parser：dimension list + between origins/borders。
- Cell style cascade：every cell、row/column/even/odd/cell order。
- Execute cell hooks：把 `matrix of nodes` 从特例变成 style 展开。
- Matrix anchor resolver：支持外层 anchor 和内部 node anchor。
- Cell picture interpreter：局部解释 cell 内 draw/fill/node 并 translate 到 cell position。
- Delimiter catalog：补全 parens/braces/bars 和 native-like stretching。

## Section 21 making trees grow 落地规则

TikZ manual section 21 说明原生 tree 是 node 后面的 `child` path operation。基础 TikZ tree placement 只依赖 child index 和 siblings count，不依赖 subtree bbox；但 child options、missing child、automatic naming、edge from parent 和 growth anchors 必须正确。

已落实或相关：

- `src/parser.js:parseNodeTreeChildren`: 解析 node trailing child 序列。
- `src/parser.js:parseTreeEdgeFromParent`: 支持 `edge from parent[options]`。
- `src/interpreter.js:createNodeTreeChildren`: 递归创建 child nodes。
- `src/interpreter.js:treeGrowDirection` / `treeChildOffset`: 支持基础 grow、level distance、sibling distance。
- `src/interpreter.js:addTreeEdge`: 生成 clipped straight parent-child edge。
- `src/libraries/trees.js`: 标记 trees library 为 partial。
- `test/parser.test.js`、`test/interpreter.test.js`: 覆盖基础 child tree、tree options、edge from parent options、mindmap cyclic child placement。

缺失或 partial：

- `child foreach` 未实现。
- body-less `child`、non-node child path 的 automatic coordinate child 未实现。
- automatic child naming：`parent-1`、`parent-2-1`。
- `every child`、`every child node`、parameterized `level/.style={...#1...}`。
- `grow'`、direction aliases、`grow` 设置当前 level sibling distance 为 0 的副作用。
- `missing` child 应计数但不渲染。
- `growth parent anchor` 与 child node anchor placement。
- custom `growth function`。
- `edge from parent/.style`、`edge from parent path`、`edge from parent macro`。
- edge from parent 后的 node labels。

待实现切片：

- Parser parity：body-less child、child foreach、non-node child path。
- Automatic naming：parent-index recursive node names。
- Missing child layout：占位但不渲染。
- Tree style cascade：every child、every child node、level parameter。
- Growth anchors：grow'、direction aliases、growth parent anchor。
- Edge from parent semantics：style hook、anchors、custom path、edge labels。

## Section 22 plots of functions 落地规则

TikZ manual section 22 说明 core `plot` 是 path operation，用 point list 继续当前 path。它不生成 axis/ticks/legend；这些属于 `pgfplots` 或 datavisualization。

已落实或相关：

- `src/parser.js:parsePlotSegment`: 支持 `plot coordinates{...}`、`plot function{...}`、`plot (<coordinate expression>)`。
- `src/interpreter.js:buildPlot`: coordinate expression sampling。
- `src/interpreter.js:buildPlotFunction`: JS/pgfmath function sampling 近似。
- `src/interpreter.js:buildPlotCoordinates`: inline coordinate list。
- `src/interpreter.js:smoothPlotCoordinateCommands`: `smooth` / `tension` 子集。
- `src/interpreter.js:buildPlotMark`: 常见 plot marks。
- `src/libraries/plotmarks.js`: plotmarks library partial catalog。
- `src/packages/pgfplots.js`、`src/commands/axis.js`、`src/commands/addplot.js`: pgfplots package 子集。

缺失或 partial：

- `-- plot` vs `plot` continuation parity 需要专门验收。
- `plot file{...}` table source。
- `samples at`。
- gnuplot bridge：`id`、`prefix`、`raw gnuplot`、cache table。
- `parametric` function。
- `range` / `yrange` / `xrange` outlier breaks。
- `every plot` style hook。
- mark repeat/phase/indices/every mark/mark options/no marks/only marks。
- smooth cycle、const plot、jump plot、polar comb。
- core ybar/xbar/interval bars。

待实现切片：

- Point provider abstraction：coordinates/file/expression/function。
- Samples-at parser and foreach range expansion。
- Plot file reader with safe corpus table registry。
- Plot handlers module：sharp/smooth/comb/marks first, const/jump/bar later。
- Mark cadence and mark style cascade。
- Parametric/range-aware JS function sampler。
- Share sampler/handlers between core TikZ plot and pgfplots `\addplot`。

## Section 23 transparency 落地规则

TikZ manual section 23 说明 transparency 不只是 path style，而是 action、scope、mask、blend 和 group compositing 的组合语义。TikZKit 必须把简单 opacity、text opacity、fading、blend mode 和 transparency group 分层实现。

已落实或相关：

- `src/options.js`: 已解析 `opacity`、`fill opacity`、`draw opacity` / `stroke opacity`、`text opacity`、`path fading`。
- `src/renderer-svg.js`: path style 会输出 `opacity`、`fill-opacity`、`stroke-opacity`。
- `src/renderer-svg.js`: 对 `path fading=west/east/north/south` 有简单 SVG mask 输出。
- `src/parser.js`: radial shading stop 里对 `pgftransparent!...` 做了 opacity 归一化。
- `test/interpreter.test.js`、`test/renderer.test.js`、`test/petarv-compat.test.js`: 覆盖基础 opacity、fill opacity、stroke opacity、radial stop opacity 和 path fading 子集。

缺失或 partial：

- `text opacity` 已解析但尚未完整输出到 `textNode`、KaTeX foreignObject 和 SVG text fallback。
- `fill opacity` 对 text/image 的 TikZ 默认影响未完整建模。
- predefined opacity styles 没有集中 catalog。
- `src/libraries/fadings.js` 仍标记 unsupported，但 renderer 已有少量 `path fading` 内置能力，metadata 与实现不一致。
- `\tikzfadingfrompicture`、`\tikzfading`、`fit fading`、`fading transform`、`fading angle` 未完整实现。
- `scope fading` 缺少 scope-level graphic state 和 group renderer。
- `blend mode` / `blend group` 缺少 IR 与 renderer 输出。
- `transparency group`、`knockout`、`isolated=false` 缺少 group compositing 语义。

待实现切片：

- Opacity catalog：预设样式、数值 clamp、path/node/text 通道映射。
- Text opacity pipeline：plain text、SVG math fallback、KaTeX foreignObject 同步支持。
- Fadings library：把 west/east/north/south 升级为 partial library，并加 fading registry。
- Custom fading parser：`\tikzfading` 轴向/径向子集，`fading angle` 和 transform。
- Scope group IR：为 scope fading、blend group、transparency group、layers 共享。
- Blend modes：normal/multiply/screen MVP，再扩展其他 modes。
- Transparency group QA：专门比较自叠加半透明路径与 isolated group 的 native 差异。

## Section 24 decorated paths 落地规则

TikZ manual section 24 说明 decorations 是 path construction 和 path action 中间的一层 path rewrite/side-effect 机制。它分为 path morphing、path replacing、path removing 三类，不能只用一个 SVG stroke style 表达。

已落实或相关：

- `src/libraries/decorations.js`: 基础 decorations library metadata。
- `src/libraries/decorations.pathmorphing.js`: 标记 snake/zigzag approximation。
- `src/libraries/decorations.pathreplacing.js`: brace path replacement、mirror、raise、amplitude、aspect。
- `src/libraries/decorations.text.js`: text along path midpoint tangent 近似。
- `src/libraries/decorations.markings.js`: arrow markings subset。
- `src/libraries/snakes.js`: 旧 snakes 兼容。
- `src/interpreter.js:applyPathMorphing`: snake/zigzag、pre/post length、arrow endpoint shortening 协调。
- `src/interpreter.js:applyBraceDecoration`: brace replacement。
- `src/interpreter.js:addDecorationTextItems`: text along path side effects。
- `src/interpreter.js:addDecorationMarkers`: marking arrows。
- `test/interpreter.test.js`: 覆盖 snake、snake post length + arrow、brace raise/mirror/amplitude、text along path、markings。

缺失或 partial：

- `decorate[options]{subpath}` path operation 未作为独立 parser segment 实现。
- nested decorate 未通用支持。
- `decorations.shapes`、`decorations.fractals` 未作为 library 文件和 registry 条目覆盖。
- pathmorphing catalog 缺 `coil`、`bumps`、`random steps`、`saw`、`expanding waves`。
- pathreplacing catalog 缺 `crosses`、`ticks`、`triangles` 等。
- text along path 目前是 midpoint label，不是逐字沿 path。
- `raise` / `mirror` / `transform` 没有覆盖所有 decoration 类型。
- `pre` / `post` decoration type 缺失，当前主要支持 pre/post length。
- node background decoration 仍是局部近似。
- removing decoration 的 side-effect model 没有形成通用接口。

待实现切片：

- Decoration engine interface：输入 path sampler，输出 geometry/sideEffects/removesPath/bbox。
- Decorate path operation parser：支持 `decorate[...]{...}` 和 nested decorate。
- Path sampler standardization：decorations、markings、arrow shorten、sloped node 共用 distance/tangent/normal。
- Move modules out of `interpreter.js`: pathmorphing/pathreplacing/text/markings 独立实现。
- Catalog MVP：coil、bumps、random steps、crosses、ticks、triangles。
- Text along path：逐 glyph placement 和 text style parsing。
- Library registry：补齐 `decorations.shapes`、`decorations.fractals`。

## Section 25 transformations 落地规则

TikZ manual section 25 说明坐标最终位置来自多层变换：xy/xyz basis、coordinate transformation matrix、backend/page placement、canvas transformation matrix。TikZKit 必须把 basis、coordinate transform 和 canvas transform 分层处理，否则 node anchor、bbox、line width、formula size 会一起漂。

已落实或相关：

- `src/interpreter.js:parsePictureBasis` / `composeBasis`: 维护 `x/y/z` basis。
- `src/interpreter.js:composeTransform`: 合成 picture/scope coordinate transform。
- `src/interpreter.js:coordinateLocalTransform`: 支持 `shift`、`xshift`、`yshift`、`scale`、`xscale`、`yscale`、`rotate`、`xslant`、`yslant`。
- `src/interpreter.js:parseShiftDimension`: 裸 `xshift/yshift` 按 pt 解析。
- `src/interpreter.js:applyTransform` / `applyTransformVector`: 点和向量变换。
- `src/parser.js:parsePgfTransformCm` + `src/interpreter.js:composePgfTransform`: 支持低层 `\pgftransformcm`。
- `\pgftransformreset`: 已支持 transform 重置。
- `src/interpreter.js:transformCanvasScale`: 支持 `transform canvas={scale=...}` 子集。
- `transform shape`: node geometry/text 缩放已有 partial 支持。
- `test/interpreter.test.js`、`test/petarv-compat.test.js`: 覆盖 xscale/yscale、xslant/yslant、transform canvas scale、pgftransformcm/reset、transform shape。

缺失或 partial：

- `z=<dimension>` basis 应为 `(dimension,dimension)`，当前实现需要补测试确认并修正。
- `scale around={factor:coordinate}` coordinate transform 未完整实现。
- `rotate around={degree:coordinate}` 未完整实现。
- `rotate around x/y/z` 未完整作用到 xyz basis。
- TikZ key `cm={a,b,c,d,(coordinate)}` 未完整处理；目前只有低层 `\pgftransformcm` statement。
- TikZ key `reset cm` 未完整处理；目前只有低层 `\pgftransformreset` statement。
- `shift only` 未实现。
- path-stream 中间 transform option 对后续坐标的即时作用仍是缺口。
- `transform canvas={rotate=...}`、shift、slant、cm 等未完整实现，当前主要是 `canvasScale`。
- 奇异/病态矩阵没有 diagnostics。

待实现切片：

- Transform module：集中 affine helper、option parser、matrix compose/inverse。
- Basis correctness：补 z dimension、rotate around x/y/z。
- Around transforms：`scale around`、`rotate around`。
- TikZ matrix keys：`cm`、`reset cm`、`shift only`。
- Path-stream transform：`[xshift=...]` 只影响后续 coordinates。
- Canvas matrix：从 `canvasScale` 升级为完整 `canvasTransform`，并明确 bbox 策略。
- Transform shape QA：node box、text、anchor、outer sep、arrow clipping 统一校准。

## Section 26 animations 落地规则

TikZ manual section 26 说明 `animations` library 是把 object attribute timeline 写入 SVG 动画 annotation，不是预渲染多帧图片。PDF 不真正支持动态动画，但 TikZ 可以用 `make snapshot of` 生成静态帧。TikZKit 应先实现 snapshot/static fallback，再实现动态 SVG。

已落实或相关：

- 静态 style pipeline 已能处理 color、opacity、line width、dash、transform 子集。
- path commands 和 path flattening 已存在，可作为 `:path` animation 和 `along` motion 的基础。
- renderer 已能输出 SVG path/text/node/group，但尚无 animation metadata。

缺失或 partial：

- `src/libraries/animations.js` 不存在。
- `animations` 未进入 `src/libraries/index.js` 和 observed library list。
- `animate={...}` 没有结构化 parser。
- node/scope shorthand `:rotate = {...}`、`:fill opacity = {...}` 未支持。
- colon syntax `object:attribute_id={...}` 未支持。
- time syntax、quote syntax、timeline entry 解析未支持。
- future object binding、`myself`、scope/path/node animation targets 未支持。
- `make snapshot of` / `make snapshot after` / `begin snapshot` 未支持。
- dynamic SVG `<animate>` / `<animateTransform>` / path `d` animation 未支持。
- timeline controls：base、begin/end、begin on/end on、repeats、restart、ease/stay/jump 未支持。

待实现切片：

- Library registry：新增 `animations` library module，先标 unsupported 或 partial。
- Parser MVP：`animate={...}`、colon syntax、time/value syntax、node shorthand。
- Animation IR：item-level or global timelines，支持 future target binding 和 `myself`。
- Snapshot MVP：线性插值 color/opacity/dimension/number，应用到静态 IR。
- Transform snapshot：xshift/yshift/rotate/scale。
- Dynamic SVG MVP：fill/draw/opacity/transform 的 `<animate>` 输出。
- Event and repeat controls：click/mouseover/begin/end/repeats。
- Path animation：结构兼容的 path `d` interpolation，animated arrows via animation `arrows` key。

## 建议拆分方向

后续应该减少 `src/interpreter.js` 的持续膨胀。推荐逐步拆：

```text
src/commands/draw.js
src/commands/path.js
src/commands/node.js
src/commands/coordinate.js
src/commands/pic.js
src/libraries/angles.js
src/libraries/intersections.js
src/libraries/decorations-pathmorphing.js
src/libraries/decorations-pathreplacing.js
src/libraries/arrows-meta.js
```

拆分原则：

- 不先抽象大框架，先迁移已经稳定的函数族。
- 每迁移一个功能族，保留现有测试。
- 新模块暴露窄接口，例如 `buildAnglePic(...)`、`resolveIntersectionCoordinate(...)`。
- 不让 library 直接操作 SVG，只生成 IR 或语义片段。

## Case-driven 记录格式

```md
## Case 005 - snake decoration arrow

- Source feature: `decoration={snake, pre length=..., post length=...}, decorate`
- Native behavior: 波浪只覆盖 active path length，箭头前后留白。
- TikZKit gap: snake path length 与 arrow shorten 分离，导致箭头附近多一段。
- Owner: `src/interpreter.js` decoration path morphing, future `src/libraries/decorations-pathmorphing.js`
- Test: add focused regression in `test/interpreter.test.js`
```
