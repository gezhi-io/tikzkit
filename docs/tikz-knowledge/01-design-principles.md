# TikZ Design Principles

来源：用户提供的 TikZ manual 第 11 节摘录，主题是 TikZ frontend 的设计原则。

TikZ 的定位是一个“绘图前端”：它不是完整的排版系统，而是给 TeX/LaTeX 用户提供一种易学、易写、可组合的图形描述语言。TikZ 的语法吸收了多种系统的思想：

- path 操作来自 MetaFont / MetaPost 风格。
- option 机制来自 PSTricks。
- style 概念接近 SVG。
- graph 语法受到 Graphviz dot notation 影响。
- TikZ 自己补充了坐标变换系统等机制。

## 九个核心原则

1. Special syntax for specifying points  
   TikZ 为点和坐标设计了专门语法，例如 `(1cm,2pt)`、`(30:1cm)`、`(node.south)`。

2. Special syntax for path specifications  
   TikZ 的核心工作是描述 path，例如 `(0,0) -- (1,0) -- cycle`。

3. Actions on paths  
   path 本身只是几何骨架，`draw`、`fill`、`shade`、`clip` 决定如何使用它。

4. Key-value syntax for graphic parameters  
   颜色、线宽、dash、arrow、fill 等都走 key-value option。

5. Special syntax for nodes  
   node 是文字和 shape 的统一模型，能独立出现，也能挂在 path 上。

6. Special syntax for trees  
   tree 是 node 语法之上的层，`child { node {...} }` 表达层级结构。

7. Special syntax for graphs  
   graph 是更高层的图结构语法，借鉴 Graphviz 的 dot-like 写法。

8. Grouping of graphic parameters  
   `scope` 和 `tikzpicture[...]` 都能批量施加图形参数，内部命令可覆盖外层设置。

9. Coordinate transformation system  
   TikZ 区分 coordinate transformation 和 canvas transformation。前者是常规推荐方式，后者更底层，容易导致线宽、文字和节点追踪出问题。

## 对解释器的意义

TikZKit 不能只把 `\draw`、`\node` 当作孤立命令。更准确的模型是：

```text
tikzpicture
  -> scope/options/style state
  -> statements
  -> path geometry
  -> path actions
  -> nodes/anchors
  -> renderer IR
```

因此实现时要避免“单 case 硬编码”。正确方向是把 TikZ 的层次拆开：

- parser 负责识别语法结构。
- TeX-lite 负责宏、foreach、style 定义等轻量展开。
- semantic interpreter 负责 coordinate、path、node、style、transform 的语义。
- geometry engine 负责 path length、intersection、anchor border、decorations。
- renderer 负责 SVG 的 stroke/fill/text/marker/filter/viewBox。

## 当前高优先级原则

- 坐标系统必须统一：所有命令最终都要进入同一套单位、basis、transform。
- path 与 action 必须分离：`\path ... edge ... pic ...` 即使没有显式 `draw`，内部 edge/pic 仍可能产生可见图元。
- node 必须有真实尺寸：公式、文字、inner sep、minimum size、shape border 都影响 anchor 和箭头吸附。
- option 必须可组合：局部 option、style、scope、library 默认值要按 TikZ 的覆盖顺序合并。
