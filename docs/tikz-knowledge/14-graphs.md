# Section 19 - Graphs

这份记录对应 TikZ manual section 19。`graphs` library 的目标不是自动布局，而是用 dot-like 语法高效描述“哪些 node 存在、哪些 edge 存在”。它最终仍应落到普通 TikZ node 和 edge 上，复用同一套 node registry、anchor clipping、arrow shortening、path label 和 style 合并。

## Web Renderer Thesis

`graphs` 应作为一个高层语法展开器：

```text
\graph options + group specification
-> graph parser
-> graph semantic model: nodes, groups, color classes, edge specs
-> placement strategy assigns node coordinates
-> create ordinary \node records
-> create ordinary edge paths
-> renderer sees normal TikZ IR
```

边界必须清楚：

- `graphs` library 提供 graph grammar 和简单 online placement。
- `graphdrawing` / LuaTeX graph drawing algorithms 是另一层 offline layout，不属于 `graphs` library 本身。
- TikZKit 第一阶段应实现 graph grammar 到 node/edge 的可预测转换，不应直接承诺完整自动图布局。

## Graph Command

基础语法：

```tex
\usetikzlibrary{graphs}
\tikz \graph { a -> {b, c} -> d };

\path ... graph[<options>]{<group specification>} ...;
```

规则：

- `\graph` 是 `\path graph` 的快捷方式。
- 遇到 graph path command 时，当前 path 被挂起，类似 node/edge/pic。
- graph options 以 `/tikz/graphs` 为 key path 执行。
- `every graph` 在每个 graph command 开始时安装，早于 graph-local options。
- graph command 生成普通 nodes 和普通 edges。
- graph nodes 的绘制顺序等价于在 graph 位置创建多个 node。
- graph edges 的绘制顺序等价于在 graph 位置创建多个 edge。

当前代码：

- `src/libraries/graphs.js` 只是标记为 builtin，说明为 “current gallery graph compatibility layer”。
- `src/preprocess.js:expandTkzGraphMacros` 处理的是 `tkz-graph` package 的 `\Vertex` / `\Edge`，不是 TikZ `graphs` library 的 `\graph` grammar。
- `src/extensions/tikz-feynman.js` 有自己的 graph parser，但只服务 tikz-feynman。

当前状态：

- 核心 `\graph { ... }` parser/semantic interpreter 基本未实现。
- `graphs.standard` 未作为独立 library module 出现在 `src/libraries/index.js`。
- 现有 graph 相关能力主要来自 tkz-graph/tikz-feynman/tikz-network 等第三方兼容层，不等于 Section 19 的 `graphs`。

## Core Concepts

Section 19 的核心模型：

- Node chain: `foo -> bar -> baz` 创建或引用 nodes，并连接相邻 nodes。
- Chain group: `{ b -> c, d -> e }` 是多个 chain 的组合，可整体与其他 node/group 连接。
- Exit/entry points: group 与 group 连接时，使用 target/source color classes 决定哪些节点被连接。
- Edge specification: `->`、`--`、`<-`、`<->`、`-!-`。
- Node set: `(name)` 可引用外部 node 或 node set。
- Graph macro: `subgraph K_n` / user `declare={name}{spec}` 展开为 graph group。
- Color class: graph 构造期的逻辑颜色，不是 SVG 颜色。

Web 实现应先建立 Graph AST，再输出普通 TikZ statements。不要边扫描字符串边画 SVG。

## Graph Options

常见 graph-level keys：

```tex
\graph [
  nodes={draw,circle},
  edges={red,thick},
  edge node={node[near end]{X}},
  edge label=x,
  edge label'=y
] { a -> b -> c };
```

规则：

- `nodes=<options>` 累加到 graph 内新建 node。
- `edges=<options>` / `edge=<options>` 累加到 graph 内新建 edge。
- `edge node=<node spec>` 为每条新边添加 implicit node。
- `edge label=<text>` 等价于 `edge node=node[auto]{text}`。
- `edge label'=<text>` 等价于 `edge node=node[auto,swap]{text}`。
- 未知 `/tikz/graphs` edge option 通常传给 `edge` key，使 `red`、`thick` 这类 options 直接作用到 edge。

实现切片：

- 建一个 `GraphContext`，包含 inherited graph options、node options stack、edge options stack、edge node stack。
- 输出 edge 时复用 Section 17 edge 语义，而不是直接生成线段。

## Group Specifications

Group syntax：

```tex
{ [<graph options>] <chain spec>, <chain spec>; ... }
```

规则：

- comma 和 semicolon 都可分隔 chains。
- option list 内部的 comma 不能被当成 group separator。
- group 开头的 options 只在该 group 内生效。
- `\foreach` 可出现在 group 中，body 被当作新的 chain specification。
- `parse=<text>` 可把宏展开后的 graph text 插入 group 开头；普通 TeX macro 不能随意改 graph 语法结构。

实现要求：

- graph parser 必须是 balanced parser：保护 `{}`、`[]`、quoted node names、TeX groups。
- foreach 应复用 TeX-lite 展开，但展开结果要重新进入 graph parser。
- `parse/.expand once` 可以后做，先记录 unsupported diagnostics。

## Chain And Edge Specifications

Chain 是 node/group/spec 与 edge spec 的交替：

```tex
a -> b --[thick] {c, d} <-> e -!- f
```

Edge spec 五种：

- `-> [options]`: directed edge left to right。
- `-- [options]`: undirected edge。
- `<- [options]`: directed edge right to left。
- `<-> [options]`: bidirected edge。
- `-!- [options]`: no-edge marker；在 simple graph 中可删除已有 edge。

默认创建 edge 的方式是调用这些 semantic keys：

- `/tikz/graphs/new ->`
- `/tikz/graphs/new --`
- `/tikz/graphs/new <-`
- `/tikz/graphs/new <->`
- `/tikz/graphs/new -!-`

默认 `new ->` 语义近似：

```tex
\path [->, every new ->]
  (<left node><left anchor>) edge [<edge options>] <edge nodes>
  (<right node><right anchor>);
```

相关 anchors：

- `left anchor=<anchor>`
- `right anchor=<anchor>`

TikZKit 实现要求：

- graph edge 最终应转成普通 edge path，复用 node anchor clipping。
- `left anchor` / `right anchor` 必须参与 endpoint coordinate。
- `every new ->` 等 styles 要参与 style merge。
- `-!-` 不能简单丢弃；在 simple graph 中它是删除边的记录。

## Node Specifications

三类 node spec：

```tex
name/text [options]      % direct node
(externalNodeOrSet)      % reference node or node set
{ group specification }  % group node spec
```

Direct node 规则：

- 默认 node name 和 text 相同。
- `name/text` 或 `name [as=text]` 可让显示文本不同于 node name。
- quoted node name 可包含 comma、dash、bracket 等特殊字符。
- graph 内第一次出现 direct node 创建 fresh node，之后同名 node 引用已有 graph node。
- graph 外已有同名 node 不会自动复用，除非使用 `(name)` 或 `use existing nodes`。

Fresh/reference 控制：

- `use existing nodes`: 所有 direct nodes 都当 reference。
- `fresh nodes`: 同名也创建新节点，重复名通过追加 apostrophe 区分。
- `number nodes` / `number nodes sep`: 自动给 node name 追加编号。

Name path：

- `name=<text>` 为 group 内 node full name 增加 path prefix。
- `name separator=<symbols>` 控制 name path 分隔符。

Typesetting：

- `as=<text>` 优先级最高。
- slash 右侧文本进入 `\tikzgraphnodetext`。
- `typeset=<code>` 决定最终 node text。
- `empty nodes` 让 node text 为空。
- `math nodes` 让 node text 进入 math mode。

Node sets：

- `/tikz/new set=<set name>` 创建 node set。
- `/tikz/set=<set name>` 把当前 node 加入 set。
- graph 中 `(set name)` 引用整个 node set。

实现切片：

- 先支持 direct node、reference node、group node。
- node 创建必须调用现有 `createNode` 等同路径，不能另造 renderer。
- node set 可先记录 unsupported，后续与 env.nodes/env.coordinates 集成。

## Edge Labels And Per-node Edge Options

Edge label/styling 有三层：

1. Edge spec options:

```tex
a ->[red, "label"] b
```

2. Incoming/outgoing edge options at target/source node:

```tex
a -> { b [> red], c [> "foo"'] }
a [< blue] -> b
```

3. Explicit keys:

- `target edge style`
- `target edge node`
- `target edge clear`
- `source edge style`
- `source edge node`
- `source edge clear`
- `clear >`
- `clear <`

Rules:

- For an edge, direct edge options apply first.
- Source node contributed options apply next.
- Target node contributed options apply last.
- `>` first-char syntax maps to target edge style/node.
- `<` first-char syntax maps to source edge style/node.
- quoted labels inside `>` / `<` become target/source edge nodes.

Text-on-edge helpers:

- `put node text on incoming edges`
- `put node text on outgoing edges`

These move node display text onto incoming/outgoing edge labels and set the node text to empty.

Implementation requirement:

- Store per-node incoming/outgoing edge option bags in GraphNode records.
- Edge creation must merge options in TikZ order.
- Edge labels should reuse Section 17 inline node placement and quotes logic.

## Simple And Multi Graphs

TikZ graph 默认是 multi graph：

- 多次指定同一 pair 会创建多条 edge。

`simple` graph：

- 每个 unordered pair 最多一条 edge。
- 后出现的 edge specification wins。
- `-!-` 在 simple graph 中删除已有/候选 edge。
- simple graph 通常要延迟到 scope 结束时 flush edges。

Implementation requirement:

- `multi`: edge specs 可立即 emit。
- `simple`: store edge records by canonical pair，scope end 再 flush。
- Edge key 需要保留 kind、options、edge nodes、source/target ordering。

## Color Classes And Operators

Graph logical color classes：

- `all`: 默认每个 node 都属于 all。
- `source` / `target`: group 的 entry/exit nodes。
- `source'` / `target'`: joining 两个 groups 时的临时 colors。
- user classes from `color class=<name>`。

Operators:

- `operator=<code>` 在 group 解析完成后执行。
- `default edge kind` 控制 operator 创建 `--` / `->` / `<-` / `<->` / `-!-`。
- `clique`
- `cycle`
- `path`
- `induced independent set`
- `complete bipartite`
- `induced complete bipartite`
- `matching`
- `matching and star`
- `butterfly`

Joining groups:

```tex
{a,b,c} -> {d, e -> f}
```

TikZ 先分别解析左右 groups，然后：

1. 左 group 的 target recolor 为 `target'`。
2. 右 group 的 source recolor 为 `source'`。
3. union 两个 graphs。
4. 执行 joining operator，默认 `matching and star`。
5. 删除临时 color。

Implementation strategy:

- First milestone can implement only default `matching and star` and `complete bipartite`.
- Color class engine should be explicit data, not derived from visual colors.
- Full operator code execution can remain unsupported with diagnostics.

## Graph Macros And graphs.standard

User macros:

```tex
\tikzgraphsset{
  declare={claw}{1 -- {2,3,4}}
}
\graph { claw[name=left], claw[name=right] };
```

Standard subgraphs from `graphs.standard`:

- `subgraph I_n`: independent set over `V` or `n`.
- `subgraph I_nm`: two independent shores `V` and `W`.
- `subgraph K_n`: complete clique.
- `subgraph K_nm`: complete bipartite graph.
- `subgraph P_n`: path.
- `subgraph C_n`: cycle.
- `subgraph Grid_n`: grid with `wrap after`.

Current status:

- `graphs.standard` module is not present in `src/libraries/index.js`.
- These should be added as graph macro definitions, not as custom SVG shapes.

## Placement Strategies

`graphs` includes only online placement:

- `no placement`: nodes default to origin unless `at` / `x` / `y` / shifts are used.
- `x=<dimension>` / `y=<dimension>` are graph keys that become node placement.
- `Cartesian placement`: default. Tracks logical width/depth.
- `chain shift=(...)`: shift along chain width.
- `group shift=(...)`: shift by group depth.
- `grow up/down/left/right=<distance>`: set chain shift.
- `branch up/down/left/right=<distance>`: set group shift.
- `grid placement`: map nodes to grid, uses `n` and `wrap after`.
- `grow right sep` etc: account for real node sizes and anchors.
- `circular placement`: uses polar placement.
- `clockwise` / `counterclockwise`: arrange group around circle.
- `level`, `level <n>` styles: apply styles by tree-like level.

Implementation strategy:

- Phase 1: `grow right/down/left/up`, `branch right/down/left/up`, `x`, `y`, `at`, `no placement`.
- Phase 2: `grid placement`, `clockwise/counterclockwise`, `radius`, `phase`.
- Phase 3: size-aware `grow right sep` / `branch down sep`, using node measured anchors.
- Leave custom `placement/compute position` as unsupported until graph core is stable.

## Quick Graphs

`quick` restricts syntax to speed parsing:

- quoted node names are mandatory.
- no group-to-node connection like `a->{b,c}`.
- no subgraphs, graph sets, color classes, anonymous nodes, simple graphs, edge annotations.
- placement strategies mostly not available; explicit `x` / `y` / `at` or graphdrawing needed.

TikZKit does not need to implement quick first. A JS parser should be fast enough for normal syntax. But quick is useful as a constrained first parser target if needed.

## Current TikZKit Gap Summary

Supported indirectly:

- Basic node/edge rendering exists.
- Tree syntax has partial support elsewhere.
- tkz-graph package macros `\Vertex` / `\Edge` are preprocessed.
- tikz-feynman has its own graph parser.

Not currently implemented as Section 19:

- `\graph` command parsing.
- `/tikz/graphs` option path.
- graph group/chain parser.
- direct/reference/group node specs.
- graph-local node creation and reuse.
- graph operators, color classes, simple/multi graph semantics.
- `graphs.standard` subgraphs.
- online placement strategies.
- graph edge labels and `>` / `<` first-char syntax.

## Implementation Slices

1. Parser MVP: `\graph[options]{...}` with direct node chains and `->` / `--` / `<-` / `<->`.
2. Node creation: `nodes={...}`, `as=...`, slash text, `math nodes`, `empty nodes`, graph-local name registry.
3. Edge creation: `edges={...}`, `edge label`, quotes, left/right anchor, ordinary edge IR.
4. Groups: `{b,c}` and group-to-group default `matching and star`.
5. Placement MVP: grow/branch, x/y/at, no placement.
6. Incoming/outgoing edge options: `>` / `<`, target/source edge style/node.
7. Simple graph: delayed edge table and `-!-`.
8. `graphs.standard`: I_n, K_n, P_n, C_n, K_nm, Grid_n.
9. Circular/grid placement.
10. Color classes/operators beyond defaults.

## Case Notes

- Any corpus case using `\usetikzlibrary{graphs}` and `\graph { a -> {b,c} }` should currently be treated as a missing core parser feature, not a node/anchor bug.
- Cases using `tkz-graph` `\Vertex` / `\Edge` are separate package compatibility and already have a preprocessor path.
- Cases using `graphdrawing` / `layered layout` require a separate offline layout strategy; do not conflate with Section 19 graph grammar.
