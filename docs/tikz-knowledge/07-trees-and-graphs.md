# Trees And Graphs

Trees 和 graphs 是建立在 node/path 之上的高层语法。它们不应该绕开 node、anchor、style、edge 的基础模型。

## Trees

```tex
\begin{tikzpicture}
  \node {root}
    child {node {left}}
    child {node {right}
      child {node {child}}
      child {node {child}}
    };
\end{tikzpicture}
```

tree 的基本语义：

- 每个 child 是一个 node。
- parent/child 之间自动生成 edge。
- `sibling distance` 控制同级间距。
- `level distance` 控制层级间距。
- `edge from parent` 控制连线样式。
- `parent anchor` / `child anchor` 控制连接点。

更完整的 Section 21 实现笔记见 [16-making-trees-grow.md](./16-making-trees-grow.md)。这里保留 trees/graphs 的入口概览，详细的 child operation、growth function、missing child 和 edge from parent 语义以 Section 21 文档为准。

## Graphs

```tex
\usetikzlibrary {graphs}
\tikz \graph [grow down, branch right] {
  root -> { left, right -> {child, child} }
};
```

graph 语法借鉴 Graphviz dot notation。它是 node/edge 的另一层语法糖：

```text
graph syntax
-> graph nodes
-> node records
-> graph edges
-> path edges
```

## 实现策略

第一阶段可以做最小兼容：

- 支持常见 `root -> { left, right }`。
- 自动创建同名 node。
- 按 `grow`、`branch right/down` 做简单布局。
- edge 复用 path edge renderer。

不要一开始实现完整 graphdrawing engine。真正的自动 graph layout 是另一类问题，TikZ 自身也依赖 LuaTeX graph drawing algorithms。

更完整的 Section 19 实现笔记见 [14-graphs.md](./14-graphs.md)。这里保留为 trees/graphs 的概览，详细的 graph command、operators、placement、graphs.standard 以 Section 19 文档为准。

## 实现检查清单

- tree/graph 生成的 node 必须进入同一套 node registry。
- edge 必须复用同一套 anchor clipping 和 arrow shortening。
- style 如 `every node`、`edge from parent/.style` 必须参与合并。
- layout 参数不能硬编码到单 case。
