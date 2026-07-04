# Transformations

TikZ 有两类变换：coordinate transformation 和 canvas transformation。它们都影响图形，但语义不同。

## Coordinate transformation

常见选项：

```tex
\begin{tikzpicture}[scale=2]
\begin{scope}[xshift=1cm, rotate=30]
\draw[xscale=2, yscale=.5] (0,0) -- (1,1);
```

coordinate transformation 主要影响坐标计算。TikZ 推荐优先使用这类变换，因为它仍能追踪 node、shape 和 bbox。

## Canvas transformation

常见选项：

```tex
transform canvas={scale=2}
\pgftransformcm{...}{...}{...}{...}{...}
```

canvas transformation 更底层，可能导致：

- 线宽跟着缩放。
- 文字大小不符合预期。
- node 的逻辑位置和画布位置脱节。
- bounding box 计算困难。

TikZ manual 明确提醒：canvas transformation 要谨慎使用。

## Basis vectors

TikZ 的 `(x,y,z)` 不是固定屏幕坐标，而是依赖 basis：

```tex
[x={(1cm,0cm)}, y={(0cm,1cm)}, z={(-.38cm,-.38cm)}]
```

解释器应维护：

```text
basis.x
basis.y
basis.z
transform matrix
canvas scale
```

## 实现检查清单

- `scale`、`xscale`、`yscale` 是否作用到坐标，而不是盲目缩放所有文本。
- `transform shape` 是否允许 node shape/text 跟随 transform。
- `xshift/yshift` 裸数字是否按 dimension 上下文处理。
- bbox 是否基于最终渲染 item 计算。
- SVG renderer 的 y 轴翻转是否只做一次。
