# Section 21 - Making Trees Grow

这份记录对应 TikZ manual section 21。这里的 trees 指 TikZ 原生 `child` path operation，不是 Section 19 的 `graphs` library，也不是 `forest` / `tikz-qtree` 这类第三方 tree package。

## Web Renderer Thesis

TikZ 原生 tree 应作为 node path command 的一部分实现：

```text
node operation
-> collect following child operations
-> count children, including missing children
-> for each child: compute local child origin by growth function
-> interpret child path in translated coordinate system
-> find first node/coordinate as child node
-> add edge from parent path
-> recurse for grandchildren
```

关键边界：

- 基础 TikZ tree layout 不是完整自动避让算法。默认 child placement 只依赖当前 child index 和 siblings count，不依赖子树 bbox。
- `graphdrawing`、`forest`、`tikz-qtree` 的更复杂布局是另一层，不应混入 `child` operation 的基础语义。
- 但 `child` operation 自身的 options、naming、edge from parent、missing child、anchors 和 foreach 必须尽量接近 TikZ，否则真实 case 的层级、连线和 label 会不稳定。

## Child Operation

基础语法：

```tex
\node {root}
  child {node {left}}
  child {node {right}
    child {node {child}}
    child {node {child}}
  };
```

更完整的形式：

```tex
\path ... child[<options>] foreach <variables> in {<values>} {<child path>} ...;
```

规则：

- `child` 应直接跟在一个完成的 `node` operation 或另一个 `child` 后。
- 第一个 `child` 前允许出现一段 option list，这段 options 作用于所有 children。
- TikZ 会先收集并计数同一个 parent 的所有 children，然后再生成 child nodes。
- `child foreach` 等价于展开成多个 `child[...] { ... }`。
- children 的文本会在收集阶段 tokenized，原生 TikZ 因此不支持 verbatim text。

当前代码：

- `src/parser.js:parseNodeTreeChildren` 解析 node 后面的 `child` 序列。
- `src/parser.js:parseNodeTreeChild` 支持 `child[options] { node ... }`。
- `src/interpreter.js:createNodeTreeChildren` 根据 child 数量和 index 创建 child node 和 edge。

当前缺口：

- `child foreach \x in {...}{...}` 未实现。
- `child;` 或 `child` 没有 body 时应自动生成 coordinate child，当前 parser 需要 `{...}`。
- child path 中非 node 开头的 path material 应自动插入 coordinate child，并执行 child-local path；当前主要支持 node/coordinate 型 child。
- child collection 的“直到下一个非 child path operation”语义还只是 node trailing parser 的近似。

## Child Paths and Child Nodes

每个 child 的 body 是一个 child path：

```tex
child {node {y}}
child {[fill] circle (2pt)}
child
```

规则：

- child path 的第一个 node 或 coordinate 是 child node。
- 如果 child path 缺失，或不以 node/coordinate 开头，TikZ 自动添加一个 shape 为 coordinate 的空 child node。
- 在 child path 开头自动插入 move-to `(0,0)`。
- child path 可以包含 node 后面的任意 path material。
- child path 末尾如果没有 `edge from parent`，TikZ 自动添加。

当前代码：

- `src/parser.js:parseNodeTreeChildBody` 支持以 `node` / `\node` 开头的 child body。
- `src/interpreter.js:createNodeTreeChildren` 直接调用 `createNode` 创建 child node。
- `src/interpreter.js:addTreeEdge` 自动添加 straight tree edge。

当前缺口：

- 不以 node/coordinate 开头的 child path 没有通用解释。
- child path 内普通 `\draw` / inline path operations 没有在 child-local coordinate system 下执行。
- `edge from parent` 后面的 node labels 尚未按 `pos=0.5` 放到 parent-child edge 上。

## Naming Child Nodes

TikZ 自动命名未显式命名的 child nodes：

```tex
\node (root) {root}
  child
  child {
    child {coordinate (special)}
    child
  };
```

命名规则：

- parent 名为 `root` 时，第一个 child 自动名为 `root-1`。
- 第二个 child 自动名为 `root-2`。
- 递归命名：`root-2-1`、`root-2-2`。
- 如果 child node 有显式 name，则不再分配自动 name。
- sibling counter 仍继续增长，显式命名不会重排后续 automatic names。

当前状态：

- `createNodeTreeChildren` 创建 child node 时依赖 child body 的 explicit node name。
- 当前没有完整实现“未命名 child 自动生成 parent-<n> 名称”的 TikZ 规则。

影响：

- `(root-1)`、`(root-2-2)` 这类坐标引用可能缺失。
- 后续 edge、label、fit、calc coordinate 会受影响。

## Tree and Child Options

Section 21 定义了 tree options 的层级：

```tex
\scoped
  [...]              % whole tree
  \node[...] {root}  % root node only
    [...]            % all children of root
    child[...]       % this child and descendants
    {
      node[...] {}   % child node only
    };
```

关键 styles：

- `every child`
- `every child node`
- `level/.style={...}`
- `level <number>/.style={...}`

规则：

- root node options 不会自动作用于 children。
- path/tree options 才会作用于 edges 和 descendants。
- `level=<n>` 在每一组 children 开始时执行，并把当前 level 作为参数。
- `level <n>` 在 `level=<n>` 后执行。
- `child[options]` 作用于整个 child path 和其 grandchildren。
- `node[options]` 只作用于 child node 自身。

当前代码：

- `parseNodeTreeChildren` 支持 root node 后、first child 前的 option list，存为 `treeOptions`。
- `createNodeTreeChildren` 合并 `levelOptions`、`treeOptions`、`child.options`。
- `treeLevelOptions` 支持 `env.styles.level` 与 `env.styles["level <n>"]`。

当前缺口：

- `every child` 和 `every child node` 未完整作为 style hook 安装。
- `level/.style={sibling distance=20mm/#1}` 这种带参数的 `level` style 需要确认是否完全展开；当前更像普通 style 合并。
- child option 与 node option、edge option 的作用域隔离仍是近似。

## Default Growth Function

基础 TikZ tree 的 default growth function：

- children 位于一条直线上。
- 这条线与 growth direction 垂直。
- parent 到 child line 的距离是 `level distance`。
- 相邻 child anchors 间距是 `sibling distance`。
- child order 由 `grow` / `grow'` 决定。
- placement 只使用 child index 和 child count，不看 child/subtree 尺寸。

常用 keys：

```tex
level distance=15mm
sibling distance=15mm
grow=down
grow'=up
```

`grow=<direction>`：

- direction 可为角度，也可为 down/up/left/right/north/south/east/west 等文本。
- 会安装 default growth function。
- 会把“当前 level”的 sibling distance 设置为 `0pt`，但保留后续 level 的 sibling distance。
- 当 `grow` 放在所有 children 前，它影响整组 children 的方向。
- 当 `grow` 放在某个 child 上，它让这个 child 沿指定方向直接偏移，同时这个 child 的 children 后续正常展开。

当前代码：

- `treeGrowDirection` 支持 `up`、`down`、`left`、`right` 和 numeric angle。
- `treeChildOffset` 根据 count/index/sibling distance/level distance 计算 offset。
- `grow cyclic` 被 mindmap 复用。

当前缺口：

- `grow'` 未实现，child order 不能反转。
- 文本方向支持不完整：north/south/east/west/north east 等应映射到角度或方向。
- `grow` 设置当前 level sibling distance 为 `0pt` 的副作用未完整建模。
- `growth parent anchor`、`growth function` 未实现或只是近似。
- custom growth function macro 不应第一阶段完整实现，但需要 diagnostics 或明确 unsupported。

## Missing Children

TikZ 支持占位但不渲染的 child：

```tex
\node {root} [grow=down]
  child {node {1}}
  child[missing] {node {2}}
  child {node {3}};
```

规则：

- missing child 会计入 total children 和 current child index。
- missing child 自身内容完全忽略。
- 不生成 node，不生成 edge。

当前缺口：

- parser 会把 `child[missing] {...}` 作为普通 child options。
- `createNodeTreeChildren` 未跳过 missing child，也没有保留它对 sibling count 的占位语义。

这是 tree/mindmap 视觉错位的重要来源：如果 missing child 被画出来，元素会多；如果直接删除但不占位，剩余 siblings 的位置会错。

## Growth Parent Anchor and Custom Growth Functions

`growth parent anchor=<anchor>` 控制 child placement 的 parent reference point：

```tex
\node [rectangle,draw] (a) {root}
  [growth parent anchor=south] child;
```

规则：

- child anchor 位于 parent 的指定 anchor 出发、沿 growth direction 偏移 `level distance` 的位置。
- child node 自己的 `anchor=...` 决定该 child node 的哪个 anchor 放到 computed position。
- `growth function=<macro>` 是低层 hook。宏被调用时可访问 `\tikznumberofchildren` 与 `\tikznumberofcurrentchild`。

当前缺口：

- 当前 offset 从 parent center 开始，没有按 `growth parent anchor` 调整。
- child node anchor 对 computed child position 的影响不完整。
- custom `growth function` macro 不支持。

实现建议：

- 第一阶段只实现 `growth parent anchor` + child node `anchor`。
- custom growth function 先进入 diagnostics，除非真实 case 需要有限白名单。

## Edge From Parent

每个 child 默认会自动添加：

```tex
edge from parent
```

默认 path：

```tex
(\tikzparentnode\tikzparentanchor) -- (\tikzchildnode\tikzchildanchor)
```

关键 keys：

- `edge from parent/.style`
- `edge from parent path=<path>`
- `edge from parent macro=<macro>`
- `parent anchor=<anchor>`
- `child anchor=<anchor>`

规则：

- `edge from parent` 的 style 先执行，然后执行 edge local options。
- 如果 child path 内没有 `edge from parent`，TikZ 自动追加。
- `edge from parent` 后面的 node specs 等价于在 edge path 上加 `pos=0.5`。
- `child anchor=border` / `parent anchor=border` 表示自动用 node boundary clipping，不写显式 anchor。
- `edge from parent path` 可把 straight line 替换成 curve。

当前代码：

- `parseTreeEdgeFromParent` 支持 `edge from parent[options]`。
- `addTreeEdge` 生成 subtype `tree-edge` 的 straight line。
- tree edge 使用 node boundary clipping。
- `edge from parent[draw=none]` 可隐藏边。

当前缺口：

- `edge from parent/.style` 未按 TikZ style hook 完整安装。
- `edge from parent path` 未展开。
- `edge from parent macro` 未实现。
- `parent anchor` / `child anchor` 未完整支持。
- `edge from parent node {...}` 或 edge 后 node label 未实现为 `pos=0.5` labels。
- curved edge from parent 与 arrow/label/shorten 的统一还缺失。

## Current TikZKit Gap Summary

已支持或部分支持：

- node trailing `child { node {...} }`。
- nested children。
- tree options between root node and first child。
- `level <n>/.style` 的一部分。
- `grow=up/down/left/right` 和 numeric angle。
- `level distance` / `sibling distance`。
- basic straight `edge from parent`。
- `edge from parent[draw=none]`。
- mindmap 使用 `grow cyclic` 的部分布局。

主要未支持或 partial：

- `child foreach`。
- body-less `child` 和 non-node child path 的 automatic coordinate child。
- automatic child naming：`parent-1`、`parent-2-1`。
- `every child` / `every child node`。
- parameterized `level/.style={...#1...}`。
- `grow'` 和完整 direction aliases。
- `missing` child 的占位但不渲染语义。
- `growth parent anchor`、child node anchor placement。
- custom `growth function`。
- `edge from parent/.style` hook、`edge from parent path`、`edge from parent macro`。
- edge from parent labels/nodes。

## Implementation Slices

### 1. Parser Parity for Child Operations

目标：

- 支持 `child;` / body-less child。
- 支持 child body 不以 node 开头时自动 coordinate child。
- 支持 `child foreach \x in {...}{...}` 展开。
- 支持 `edge from parent node {...}` 这类 following node specs 的保留。

验收：

```tex
\node {root} child child;
\node {root} child foreach \x in {1,2} {node {\x}};
\node {root} child {[fill] circle (2pt)};
```

### 2. Automatic Child Naming

目标：

- parent explicit name 存在时，自动生成 `parent-<index>`。
- 递归生成 `parent-2-1`。
- explicit child name 不创建第二个 automatic name，但 sibling count 继续。

验收：

```tex
\node (root) {root}
  child
  child { child {coordinate (special)} child };
\node at (root-2-2) {root-2-2};
```

### 3. Missing Child Layout

目标：

- `missing` child 计数但不生成 node/edge。
- siblings 的 count/index 与 TikZ 一致。

验收：

```tex
\node {root}
  child {node {1}}
  child[missing] {node {2}}
  child {node {3}};
```

### 4. Tree Style Cascade

目标：

- 安装 `every child` 到 child operation。
- 安装 `every child node` 到 child node。
- 支持 parameterized `level/.style={...#1...}`。
- 保持 root node options、tree options、child options、child node options 的边界。

### 5. Growth Direction and Anchors

目标：

- 支持 `grow'`。
- 支持 direction aliases：north/south/east/west/north east 等。
- 实现 `growth parent anchor`。
- computed child point 应对应 child node 的 anchor，而不是始终 center。

### 6. Edge From Parent Semantics

目标：

- `edge from parent/.style` 作为 style hook。
- `parent anchor` / `child anchor`。
- `edge from parent path` 的 limited expansion。
- edge labels as `pos=0.5` inline nodes。

第一阶段只支持 default straight path 和常见 curved path：

```tex
edge from parent path={
  (\tikzparentnode.south) .. controls +(0,-1) and +(0,1) .. (\tikzchildnode.north)
}
```

### 7. Child Path Local Interpreter

目标：

- child path 在 translated local env 里执行。
- 非 child-node 的 drawing commands 能被渲染。
- 自动 edge from parent 仍以第一个 node/coordinate 为 child node。

## Case Notes

- Mindmap cases: `grow cyclic`、`sibling angle`、`level <n> concept` 目前已有特例，但仍依赖 tree style cascade 和 child count。
- Case 119 / tikz-qtree: qtree/forest 有自己的 subtree-width layout，不等于 Section 21；但 edge、anchor、level distance 和 node metrics 可复用。
- Chemistry/molecular trees: `child[grow=up]` 这类 local grow 需要正确处理当前 level sibling distance 为 0 的副作用。
- Any case using `child[missing]` should be优先检查 missing child 是否占位但不渲染。
