# Section 20 - Matrices and Alignment

这份记录对应 TikZ manual section 20。矩阵不是简单的 HTML table，也不是固定等宽网格；TikZ matrix 的核心是“每个 cell 是一个小 picture，按 cell picture 的 bounding box 与 origin 对齐，然后 matrix 本身再作为一个 node 参与 anchor、draw、fill、positioning 和连线”。

## Web Renderer Thesis

TikZKit 的 matrix 应拆成两层：

```text
\matrix / node[matrix] source
-> matrix parser: rows, columns, per-cell options, cell picture source
-> cell picture interpreter: produce cell bbox + origin + local nodes
-> matrix layout solver: row heights/depths, column left/right extents, sep rules
-> matrix node: outer node bbox, anchors, optional shape/frame/fill
-> ordinary node/path IR for cells and matrix frame
```

这意味着 matrix 的正确性依赖四件事：

- cell 内部内容的真实 bbox。
- 每个 cell 的 origin，而不是只看视觉中心。
- `row sep` / `column sep` 的 spacing list 语义。
- matrix 自身作为 node 的 anchor 和内部 cell anchor 同时可用。

当前很多 matrix case 的位置、外框、箭头终点和右侧 label 偏差，本质上不是单个坐标写错，而是 matrix layout model 还没有完全按 TikZ 的 bbox/origin 规则实现。

## Matrices Are Nodes

TikZ matrix 本质上是特殊 node：

```tex
\node[matrix] (m) at (0,0) { ... };
\matrix (m) at (0,0) [matrix of nodes] { ... };
```

规则：

- `matrix` option 表示 node 的 text box 被 matrix contents 替代。
- `\matrix` 是 `\path node[matrix]` 的缩写。
- matrix 可以 `draw`、`fill`、有 shape、可以命名、可以被 `(m.west)` 这类 anchor 引用。
- `every matrix` 应作用于 matrix 及其内容。
- `every outer matrix` 只作用于外层 matrix node。
- rotation/scale 默认不会作为整体作用到 matrix；TikZ 会在 typeset matrix 前重置 transform 的旋转和缩放部分。
- `text width` 等 text options 对 matrix 外层通常无效，但可能影响 cell nodes。

当前代码：

- `src/parser.js:parseMatrix` 支持 `\matrix [options] (name) at (...) [options] {body}` 的常见顺序。
- `src/interpreter.js:createMatrix` 将 matrix 作为命名 node 注册到 `env.nodes` 和 `env.coordinates`。
- `src/libraries/matrix.js` 声明了 matrix library，并提供 cell text、row options、delimiter helper。

当前缺口：

- `node[matrix] { ... }` 与 `\matrix` 的语义还没有完全统一到同一套 matrix parser。
- `every matrix` / `every outer matrix` 没有完整安装顺序。
- matrix 的 scale/rotate 处理仍是近似；`transform shape` 与 TikZ 默认“重置 matrix 整体 transform”的关系需要明确。
- `matrix anchor=<node.anchor>` 这种以内部 cell node anchor 对齐 matrix 的规则尚未完整实现。

## Cell Pictures

TikZ matrix cell 不只是文本。每个 cell 可以包含轻量 picture：

```tex
\matrix {
  \draw (0,0) circle (4mm); & \node[rotate=10] {Hello}; \\
  \draw (0.2,0) circle (2mm); & \fill[red] (0,0) circle (3mm); \\
};
```

Section 20 的关键点：

- 每一行必须以 `\\` 结束，包括最后一行。
- `&` 分隔 cell。
- 每个 cell picture 有自己的 bbox 和 origin。
- 同一行按 cell origin 的 y 坐标对齐。
- 同一列按 cell origin 的 x 坐标对齐。
- row height = 该行所有 cell bbox 的最大上伸高度。
- row depth = 该行所有 cell bbox 的最大下伸深度。
- column left/right extent 由该列所有 cell bbox 相对 origin 的左右伸出决定。

当前代码：

- `src/interpreter.js:splitMatrixRows` 按顶层 `\\` 拆行。
- `src/interpreter.js:splitMatrixCells` 按顶层 `&` 或 `\&` 拆 cell。
- `src/interpreter.js:parseMatrixCell` 支持 cell 前缀 `|[options]|`、简单 `\node[...] (name) {text}`、calendar spec。
- `src/interpreter.js:createMatrix` 先估算所有 cell 的最大宽高，然后用统一 `cellWidth` / `cellHeight` 和固定 step 布局。

当前缺口：

- cell picture 内的任意 `\draw` / `\fill` / 多 node 内容还没有作为一个局部 picture 解释。
- 当前布局使用全局最大 cell 宽高，未按每列左右 extent、每行 height/depth 独立计算。
- cell origin 对齐未建模，导致 baseline、`anchor=base`、不同文字高度的 cell 对齐会偏。
- row/column 长短不一致时，TikZ 会自动补空 cell；当前只在 `nodes in empty cells` 下保留可见空 cell。
- cell 内 layer 不支持是 TikZ 原生限制，可以不用实现 layer，但要保证 bbox 计算一致。

## Row and Column Separation

TikZ 的 `row sep` / `column sep` 不是简单数字：

```tex
\matrix [column sep=1cm] { ... };
\matrix [column sep={1cm,between origins}] { ... };
\matrix [row sep={3mm,between borders}] { ... };
```

spacing list 规则：

- list 中所有 dimension 相加得到 spacing。
- `between borders` 表示两个 row/column 的 bbox 边界之间的距离。
- `between origins` 表示两个 row/column 的 origin line 之间的距离。
- 如果都没有写，默认等价于 `between borders`。
- `\\[<spacing list>]` 可以给某两行之间追加 spacing list。
- `&[<spacing list>]` 可以给某两列之间追加 spacing list，但只在第一次引入该列时生效。

当前代码：

- `src/interpreter.js:createMatrix` 使用 `parseFiniteDimension(matrixOptions["column sep"], env, 0)` 和 `parseFiniteDimension(matrixOptions["row sep"], env, 0)`。
- 对 `column sep=-\pgflinewidth`、`row sep=0.5mm` 等简单 dimension 可用。

当前缺口：

- `{1cm,between origins}` 这种 spacing list 会被当成普通 dimension，语义不完整。
- `between origins` / `between borders` 没有区别。
- `\\[...]` 和 `&[...]` 局部 row/column spacing 尚未建模。
- 由于没有独立 column extents，`between borders` 的 native 宽度对齐也只能近似。

## Cell Styles and Matrix Library Styles

Section 20 定义了一套 cell 级 style 系统：

```tex
\matrix [
  nodes={draw,minimum size=5mm},
  row 1/.style={red},
  column 2/.style={green!50!black},
  row 3 column 3/.style={blue}
] { ... };
```

重要 style/key：

- `every cell={row}{column}`
- `cells=<options>`
- `nodes=<options>`
- `column <n>`
- `row <n>`
- `every odd/even column`
- `every odd/even row`
- `row <r> column <c>`
- `matrix/inner style order`
- `execute at begin cell`
- `execute at end cell`
- `execute at empty cell`
- `matrix of nodes`
- `matrix of math nodes`
- `nodes in empty cells`

默认应用顺序：

```tex
every cell,
column,
even odd column,
row,
even odd row,
cell
```

当前代码：

- `src/libraries/matrix.js:matrixInheritedNodeOptions` 继承部分 text/font/minimum size options。
- `src/libraries/matrix.js:matrixRowNodeOptions` 支持 `row <n>/.style` 的一部分，并从其中抽取 `nodes={...}`。
- `src/interpreter.js:createMatrix` 支持 matrix-level `nodes={...}`、`nodes in empty cells`、cell-level `|[options]|`。
- `matrix of math nodes` 会把非 math cell 包成 `$...$`。

当前缺口：

- `column <n>/.style`、`every odd/even row/column`、`row <r> column <c>` 未完整应用。
- `matrix/inner style order` 未实现。
- `cells=...`、`every cell` 未完整作为 cell style hook。
- `execute at begin/end/empty cell` 尚未通用展开；当前 `matrix of nodes` 是解释器特例，而不是由这些 hooks 派生。
- `matrix of nodes` 与 `matrix of math nodes` 应最好定义在 `src/libraries/matrix.js` 中，以后从解释器里逐步抽出。

## Matrix Anchoring

TikZ 有两类 anchor：

```tex
\matrix [matrix anchor=west] at (0,0) { ... };
\matrix [matrix anchor=inner node.south] at (1,1) { ... };
```

规则：

- `matrix anchor=<anchor>` 只作用于外层 matrix node，不应改变内部 cell nodes 的 anchor。
- `anchor=<anchor>` 作为 matrix option 时可能会被内部 nodes 继承。
- `matrix anchor=<node.anchor>` 或 `anchor=<node.anchor>` 可让整个 matrix 平移，使内部某个 node 的 anchor 正好落在 matrix 的 `at` 坐标上。

当前缺口：

- 当前 matrix origin 基本按中心点/positioning 结果放置。
- `matrix anchor` 尚未完整接入 node anchor resolver。
- 内部 cell node anchor 作为 matrix placement reference 的机制缺失。

这会影响：

- matrix 作为流程图 block 时的对齐。
- `fit={(m-1-4.north west) ...}` 这类后续引用。
- 箭头连到 matrix 或 cell anchor 时的端点位置。

## Active Characters and Ampersand Replacement

TikZ 内部并不直接依赖普通 `&`，而是用 `\pgfmatrixnextcell`。当 matrix 被放进宏参数或 path 参数里时，`&` 可能失去 active char 语义，所以提供：

```tex
\matrix [ampersand replacement=\&] {
  A \& B \\
};
```

当前代码：

- `src/interpreter.js:splitMatrixCells` 支持顶层 `\&` 作为 cell separator。

当前缺口：

- `ampersand replacement=<macro>` 没有作为 option 定义任意替换宏；当前只是识别 `\&`。
- `\pgfmatrixnextcell` 直接分隔尚未明确支持。
- 如果 cell 文本内部有 LaTeX tabular/array，需要继续保证 balanced parser 不误拆。

## Delimiters

常见 matrix library 用法：

```tex
\matrix [matrix of math nodes, left delimiter={[}, right delimiter={]}] {
  a \\ b \\
};
```

当前代码：

- `src/libraries/matrix.js:addMatrixDelimiters` 支持 `[` 和 `]`。
- `src/interpreter.js:addMatrixDelimiters` 在 cell items 后、matrix stroke 前调用。

当前缺口：

- `(`、`)`、`\{`、`\}`、`|`、`\|` 等 delimiter 未完整实现。
- delimiter 的 font/math glyph 尺寸和 native TeX stretch delimiter 不一致。
- delimiter sep、line width、bbox 对齐仍是近似。

## Current TikZKit Gap Summary

已支持或接近可用：

- `\matrix` statement。
- `matrix of nodes`。
- `matrix of math nodes`。
- `nodes={...}`。
- `nodes in empty cells`。
- cell 前缀 `|[options]|`。
- 显式 cell node 名称。
- `m-<row>-<column>` 形式的 cell anchors。
- 简单 `row <n>/.style`。
- `left delimiter=[` / `right delimiter=]`。
- 简单 `row sep` / `column sep`。
- `ampersand replacement=\&` 的常见拆分。

主要未支持或 partial：

- matrix 作为普通 `node[matrix]` 的完整统一语义。
- cell picture 通用解释。
- 按 bbox/origin 的 row/column layout solver。
- spacing list：`between origins`、`between borders`、局部 `\\[...]` / `&[...]`。
- `every matrix`、`every outer matrix`、`every cell`、`cells`。
- column/even/odd/cell-specific style order。
- `execute at begin/end/empty cell`。
- `matrix anchor`，尤其是内部 node anchor。
- arbitrary `ampersand replacement=<macro>`。
- delimiter catalog 和 TeX-like stretching。

## Implementation Slices

### 1. Matrix Layout Model

目标：替换统一最大 cell 网格。

实现方向：

- 每个 cell 先得到 `{left, right, height, depth, origin}`。
- 每列记录 `leftExtent`、`rightExtent`。
- 每行记录 `height`、`depth`。
- column positions 根据 border/origin spacing list 计算。
- row positions 根据 border/origin spacing list 计算。

验收 snippets：

```tex
\matrix [draw,nodes=draw,column sep={1cm,between origins}] {
  \node(a) {123}; & \node(b) {1}; \\
};
```

`a.center` 到 `b.center` 应为 1cm，而不是 bbox 边距 1cm。

### 2. Spacing List Parser

目标：把 row/column spacing 从 dimension 变成结构。

数据结构：

```js
{
  amount: <canvas units>,
  mode: "between-borders" | "between-origins"
}
```

需要支持：

- `1cm`
- `{1cm,between origins}`
- `{2mm,-\pgflinewidth,between borders}`
- `\\[1cm,between origins]`
- `&[2mm]`

### 3. Cell Style Cascade

目标：实现 Section 20 的 style order。

输入：

- matrix options。
- row/column index。
- cell-local `|[options]|`。

输出：

- final cell picture options。
- final implicit node options。

先支持默认顺序，再支持 `matrix/inner style order`。

### 4. Execute Cell Hooks

目标：让 `matrix of nodes` 从特例变成 style 展开。

关键 keys：

- `execute at begin cell`
- `execute at end cell`
- `execute at empty cell`

第一阶段可以只识别 TikZ matrix library 常用定义：

```tex
matrix of nodes/.style={
  execute at begin cell=\node\bgroup,
  execute at end cell=\egroup;
}
```

### 5. Matrix Anchor Resolver

目标：matrix placement 支持外层 anchor 与内部 node anchor。

验收：

```tex
\matrix[matrix anchor=inner.south] at (1,1) {
  \node(inner) {b}; \\
};
```

`inner.south` 应落在 `(1,1)`。

### 6. Cell Picture Interpreter

目标：cell 中不只有文本时，能局部解释 `\draw` / `\fill` / `\node`。

第一阶段边界：

- cell local origin 为 `(0,0)`。
- cell contents 解释到临时 IR，计算 bbox。
- 最终将 cell IR translate 到 matrix cell position。
- 不实现 cell picture layer，因为 TikZ 原生也不支持 cell layers。

### 7. Delimiter Catalog

目标：补全 `(`、`)`、`{`、`}`、`|`、`||`，并统一 bbox。

第一阶段用 SVG path 近似。
第二阶段参考 native/tikztosvg 的 path 或 font glyph 伸缩。

## Case Notes

- Case 024: `matrix of nodes`、`row sep=-\pgflinewidth`、`column sep=-\pgflinewidth`、`nodes in empty cells`、right-of labels 和 palette arrow 都依赖 matrix bbox、cell anchors 和 positioning 的一致性。
- Case 025: 缩放背景 tile matrix 暴露 matrix outer box、cell box 与 `scale/transform shape` 的差异。
- Walmes matrix cases: `matrix of math nodes`、delimiter、node anchor 和 right-of matrix 的组合需要 Section 20 的 matrix-as-node 语义。
- TikZ-CD cases: `row sep` / `column sep` 与 arrow shaft length 相关，不能只靠固定网格近似。
- Case 043: 大公式里嵌套 `\begin{matrix}` 属于 math layout，不是 TikZ matrix，但暴露同一类“矩阵尺寸估算/文本 bbox”问题，应在 math metrics 和 TikZ matrix 之间共享度量思想。
