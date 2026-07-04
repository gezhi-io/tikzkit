# Nodes And Anchors

Node 是 TikZ 中最容易影响视觉一致性的部分：文字大小、公式大小、边框大小、anchor、箭头吸附都依赖 node 模型。

## 基本 node

```tex
\node at (1,1) {text};
\node[circle,draw] (A) at (0,0) {$A$};
\draw (1,1) node {text} -- (2,2);
```

node 可以：

- 独立作为 statement。
- 挂在 path 内。
- 有名字供后续引用。
- 有 shape 和 style。
- 包含普通文本或数学公式。

## 命名节点

```tex
\node[circle,draw] (A) {$\alpha$};
\draw (A) -- (B);
```

命名 node 不只是一个点。解释器至少要存：

```text
name
center point
shape
text
text metrics
layout width / height
visible width / height
inner sep
outer sep
minimum size
style
```

## Anchor

```tex
(A.center)
(A.north)
(A.south east)
(A.30)
```

anchor 分两类：

- named anchors: `north/south/east/west/center/base/text/...`
- angle anchors: `30/45/120/...`

对于 circle/ellipse，angle anchor 通常沿射线与边界求交。对于 rectangle，沿射线与矩形边界求交。

## 自动吸附边界

```tex
\draw[-stealth] (A) -- (B);
```

如果 A/B 是 node，TikZ 不应该从中心画到中心，而应当：

1. 取 A、B 的中心。
2. 计算中心连线方向。
3. 对 A 的 shape boundary 求出射点。
4. 对 B 的 shape boundary 求入射点。
5. 根据 arrow tip、line width、shorten 进一步修剪端点。

## 公式节点尺寸

公式节点不能只用字符数估算。至少要考虑：

- KaTeX/TeX 字体的 ascent/descent。
- 上下标导致的高度变化。
- fraction、matrix、sqrt、over/under annotation。
- `inner sep` 和 `minimum size`。
- `text width` 对换行和 box 宽度的影响。

如果公式尺寸不准，会导致：

- 圆形外接圆太小或太大。
- 箭头插入文字内部。
- label 看起来偏上/偏下。
- node box 与 native TikZ 不一致。

## 实现检查清单

- node text 和 node box 必须使用同一套 text metrics。
- `circle` 的直径应至少包住文字外接矩形对角线或 TikZ 的 shape 规则。
- `rectangle` anchor 应按矩形边界求交。
- `inner sep=0pt`、`minimum width/height`、`text width` 必须参与布局。
- `right=... of A` 等 positioning 应基于 A 的 shape bbox，而不是中心点。
