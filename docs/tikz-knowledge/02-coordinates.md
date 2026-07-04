# Coordinates

TikZ 的坐标语法是解释器的核心。大量错位、箭头歪、公式框位置不对，本质上都可能是坐标、单位、anchor 或 transform 没统一。

## 基本坐标

```tex
(1cm,2pt)
(2,1)
(1,2cm)
```

- 两个分量都带单位时，使用 `canvas` 坐标系统，直接按 TeX dimension 解析。
- 两个分量都不带单位时，使用 `xyz` 坐标系统，数值是当前 `x/y/z` basis 的 factor。
- 一个分量带单位、另一个不带单位时，TikZ 会把两个坐标相加：带单位分量走 canvas，不带单位分量走当前 basis。
- 默认情况下 `x` 单位向右 1cm，`y` 单位向上 1cm。

这点是定位准确性的核心。比如：

```tex
\begin{tikzpicture}[x=2cm,y=3cm]
  (1,1)       % -> (2cm,3cm), xyz factor
  (1cm,1cm)  % -> (1cm,1cm), canvas dimension
  (1,1cm)    % -> (2cm,1cm), mixed
\end{tikzpicture}
```

如果解释器把 `(1cm,1cm)` 也乘以 `x=2cm,y=3cm`，整个图会系统性错位。

## 显式坐标系统

TikZ 支持显式写法：

```tex
(canvas cs:x=1cm,y=2mm)
(xyz cs:x=1,y=0,z=0)
(canvas polar cs:angle=30,radius=1cm)
(xyz polar cs:angle=30,radius=1)
(node cs:name=A,anchor=north)
```

显式坐标系统的判断应早于普通 polar `angle:radius` 判断，否则 `canvas cs:x=...` 会被误读成冒号极坐标。

## 极坐标

```tex
(30:1cm)
(30:1)
(60:-5mm)
```

极坐标也要按半径是否带单位区分：

- `(30:1cm)`: `canvas polar`，半径是画布长度。
- `(30:1)`: `xyz polar`，半径是当前 `x/y` basis 的 factor。

canvas polar 语义：

```text
x = cos(angle) * radius
y = sin(angle) * radius
```

xyz polar 语义：

```text
point = cos(angle) * radius * xVector
      + sin(angle) * radius * yVector
```

注意负半径不是错误，表示沿相反方向。真实 case 中 `E at (60:-5mm)` 就依赖这个规则。

方向词也属于角度：

```tex
(up:1cm) == (90:1cm)
(south east:1cm) == (-45:1cm)
```

## 三维坐标

```tex
(1,1,1)
```

三维坐标会使用当前 `x/y/z` basis 投影到二维画布：

```text
point = x * xVector + y * yVector + z * zVector
```

这影响 `tikz-3dplot`、斜投影图、网络层叠图等。

## 相对坐标

```tex
(1,0) ++(1,0) ++(0,1)
(1,0) +(1,0) +(0,1)
```

- `++(...)`: 相对当前点，并更新 current point。
- `+(...)`: 相对当前点，但不更新 current point。

解释器需要维护：

- `current`: 当前绘制点。
- `currentBase`: 当前逻辑点，通常用于 node clipping 和 relative coordinate。
- `currentNodeRef`: 当前点是否来自命名 node/anchor。

## 命名坐标和节点 anchor

```tex
\coordinate (A) at (0,0);
\node (N) at (1,0) {Text};
\draw (A) -- (N.east);
\draw (N.45) -- +(1,0);
```

命名坐标只有点；命名 node 还应该记录：

- center point
- text/formula measured size
- inner sep / outer sep
- minimum width/height/size
- shape
- anchor border resolver

## `intersection cs`

```tex
\coordinate (X) at (intersection cs:first line={(A)--(B)}, second line={(E)--(F)});
```

这是一个 coordinate system，不是普通路径。最小实现可先支持 line-line intersection：

```text
1. 解析 first line / second line。
2. 每条线解析成两个 TikZ coordinate。
3. 求两条无限直线交点。
4. 把结果注册为 coordinate。
```

后续需要扩展：

- segment intersection 与 infinite line intersection 的区别。
- line/path、path/path。
- 与 `intersections` library 的 `name path` / `name intersections` 合流。

## 实现检查清单

- 坐标分量要先判断是否带单位，再决定 canvas 还是 xyz。
- `2+3cm` 这种混合 dimension 表达式里，裸 `2` 应升级为 `2pt`，不是 `2cm`。
- 裸数字是否按 cm 还是 pt，取决于上下文。坐标裸数字通常是 basis factor；`xshift=-120` 这种 dimension 裸数字更接近 pt 语义。
- 极坐标也必须区分 canvas polar 和 xyz polar。
- 显式 `canvas cs:`、`xyz cs:`、`canvas polar cs:`、`xyz polar cs:` 应在冒号 polar fallback 前解析。
- transform 应用顺序是否明确。
- `calc` 结果是否再经过当前 transform。
- node anchor 是否基于 shape border，而不是中心点。
- polar negative radius 是否正确。

## Case Notes

- Section 13: 修复 `resolveCoordinate` 中隐式坐标分量判定。新增 `test/coordinates-section13.test.js` 覆盖 canvas/xyz/mixed 坐标、dimension 中裸数字按 pt、dimensionless polar 使用当前 basis。
