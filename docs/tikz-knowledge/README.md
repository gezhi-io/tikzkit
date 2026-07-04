# TikZ Knowledge Base

这个目录用于沉淀 TikZ 基础知识，并把这些知识映射到 TikZKit 的解释器实现。目标不是写成泛泛的教程，而是形成以后修复 case、实现 library/package、对齐 MacTeX/tikztosvg 时可以直接查的工程知识库。

## 目录

- [01-design-principles.md](./01-design-principles.md): TikZ 前端的设计原则。
- [02-coordinates.md](./02-coordinates.md): 点、坐标、极坐标、相对坐标和 anchor。
- [03-paths-and-actions.md](./03-paths-and-actions.md): path specification、draw/fill/shade/clip 的关系。
- [04-nodes-and-anchors.md](./04-nodes-and-anchors.md): node 语法、命名节点、anchor、自动吸附边界。
- [05-styles-scopes.md](./05-styles-scopes.md): key-value options、style、scope 和继承。
- [06-transformations.md](./06-transformations.md): coordinate transformation 与 canvas transformation。
- [07-trees-and-graphs.md](./07-trees-and-graphs.md): trees 与 graphs 语法层。
- [08-tikzkit-implementation-map.md](./08-tikzkit-implementation-map.md): TikZ 概念到当前代码模块的映射。
- [09-hierarchical-structures.md](./09-hierarchical-structures.md): package、library、tikzpicture、scope、style 的层级结构。
- [10-actions-on-paths.md](./10-actions-on-paths.md): draw/fill/shade/clip/bbox/preaction 等 path action 语义。
- [11-arrows.md](./11-arrows.md): arrow specification、arrows.meta、shorten、multi-tip 和当前缺口。
- [12-nodes-and-edges.md](./12-nodes-and-edges.md): node box、anchor、path label、label/pin、edge 的 Web 渲染语义。
- [13-pics.md](./13-pics.md): pic 语法、pic scope、pic actions、name prefix、quotes 和 angle pic。
- [14-graphs.md](./14-graphs.md): graphs library、graph grammar、operators、placement 和 graphs.standard 实现边界。
- [15-matrices-and-alignment.md](./15-matrices-and-alignment.md): matrix 作为 node、cell picture、row/column alignment、spacing list 和 matrix library 实现边界。
- [16-making-trees-grow.md](./16-making-trees-grow.md): 原生 child tree operation、growth function、missing child、edge from parent 和 tree style cascade。
- [17-plots-of-functions.md](./17-plots-of-functions.md): TikZ core plot path operation、function sampling、plot marks、plot handlers 与 pgfplots 边界。
- [18-transparency.md](./18-transparency.md): opacity channels、blend modes、fadings、scope fading 与 transparency group。
- [19-decorated-paths.md](./19-decorated-paths.md): decorations 的 morph/replace/remove 三类语义、subpath decorate、pre/post length 和当前实现边界。
- [20-transformations-section25.md](./20-transformations-section25.md): xy/xyz basis、coordinate matrix、canvas transform、transform shape 与当前实现缺口。
- [21-animations.md](./21-animations.md): animations library、object/attribute/timeline 模型、colon syntax、snapshot 和 SVG 动画实现路线。
- [22-data-visualization.md](./22-data-visualization.md): datavisualization pipeline、function data format、scientific axes、pin/legend 与当前实现边界。
- [23-datavisualization-axes.md](./23-datavisualization-axes.md): datavis axis mapper、axis systems、ticks/grid visualizers 与 TikZKit PGFPlots-like 实现差距。
- [24-datavisualization-styles-legends.md](./24-datavisualization-styles-legends.md): datavis style sheets、legend matrix、`\tikzdatavisualizationset` 与当前实现边界。
- [glossary.md](./glossary.md): 术语表。

## 使用方式

每次实现一个 TikZ 功能时，先把它归类到对应文件：

1. 这个语法属于 coordinate、path、node、style、transform、library 还是 package。
2. MacTeX/TikZ 原理是什么。
3. TikZKit 当前文件在哪里实现。
4. 已支持、部分支持、未支持的边界是什么。
5. 对应真实 case 或最小测试是什么。

如果修复来源于某个真实 case，建议在相关笔记末尾增加一条记录：

```md
## Case Notes

- Case 005: `decoration={snake,...}` 暴露 path decoration 的 pre/post length 与 arrow shortening 需要同一套 path length 参数化。
```
