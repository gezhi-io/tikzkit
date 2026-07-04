# Glossary

## action

对 path 的动作，例如 draw、fill、shade、clip。path 本身只是几何，action 决定是否以及如何渲染。

## animation attribute

动画作用的属性，例如 `fill`、`draw opacity`、`line width`、`path`、`rotate`、`xshift`。TikZ animation 的基本单位是某个 object 的某个 attribute 随 timeline 变化。

## animation object

动画作用的目标对象，可以是 node、path、scope、view 或 node background path。`animate={...}` 可以引用未来对象；`myself` 指当前安装 animation key 的对象。

## arrow specification

选择 path 起点和终点 arrow tips 的语法，例如 `->`、`<->`、`-{Stealth[length=8pt]}`、`arrows={Latex-Stealth}`。

## arrow tip sequence

同一端连续多个 arrow tips 的序列，例如 `>>>` 或 `Stealth[] Latex[]`。TikZ 支持 `sep` 控制间距、`.` 控制 line end。

## axis

data visualization 中把某个 data point attribute 映射到页面位置的命名对象。axis 不是画出来的坐标轴线，坐标轴线、ticks、grid 和 labels 都是额外 visualizer。

## axis scaling mapper

axis 的 survey 阶段对象，负责收集 attribute 的数据范围，并把原始数据区间变成适合映射的数值区间。`include value`、`min value`、`max value`、`scaling` 都应该进入这一层。

## axis system

datavisualization 的预设轴系统，例如 `scientific axes`、`scientific axes=clean`、`school book axes`。它创建 axes、安装默认 scaling，并决定 axis/ticks/grid/labels 如何可视化。

## axis transformer

把 axis scaling mapper 的结果转换为页面位移的对象。Cartesian axis 通常是沿某个 unit vector 的线性变换；log、polar、3D 等需要不同转换逻辑。

## clipping path

用于限制后续绘制区域的 path。clip 是 graphic state，会在 scope 结束时恢复，多次 clip 取交集。

## decoration

在 path 构造完成、path action 执行前运行的路径重写或副作用机制。它可以把路径变形、替换成别的路径，或移除路径并沿路径放置 text/nodes/marks。

## compound path

由多个 subpath 组成的同一个 path。`even odd rule` 和 `nonzero rule` 只有在复合路径保持为同一个 SVG path 时才能正确挖洞或处理自交。

## colon animation syntax

TikZ `animations` library 中用冒号同时选择 object 和 attribute 的语法，例如 `mynode:fill={...}`、`:rotate={...}` 或 `object:attribute_id={...}`。

## anchor

node 或 shape 上可引用的位置，例如 `center`、`north`、`south east`、`45`。连线到 node 时，TikZ 会用 anchor/border 算法避免直接连到文字中心。

## bbox / bounding box

图形最终占据的边界框。SVG viewBox、网页对比、native PNG 对齐都依赖 bbox。

## blend mode

透明或重叠对象与背景合成时使用的混合算法，例如 multiply、screen、overlay。TikZ 的 `blend mode` 与浏览器 CSS `mix-blend-mode` 接近但不完全等价，需要 native/tikztosvg 视觉校准。

## blend group

先把一个 group 的内容内部合成，再用指定 blend mode 与外部背景混合的机制。它需要保留渲染 group 边界，不能把所有 path 平铺输出。

## begin/end hook

`execute at begin picture`、`execute at end picture`、`execute at begin scope`、`execute at end scope` 这类在层级开始或结束时执行的 TikZ hook。它们常用于 backgrounds、默认样式、bbox 辅助逻辑。

## basis vector

TikZ 的 `x`、`y`、`z` 基向量。坐标 `(a,b,c)` 会先被解释成 `a*x + b*y + c*z`，再进入 coordinate transformation matrix。

## canvas transformation

低层画布变换，会影响最终绘制坐标和可能影响线宽、文字等。TikZ 不推荐普通用户频繁使用。

## canvas transformation matrix

PDF/PostScript/SVG 层面的画布矩阵。与 coordinate transformation 不同，它会拉伸画布本身，通常会让线宽和文字一起变形，并让 bbox/anchor 追踪变困难。

## cm transform

TikZ/PGF 的通用 2D affine matrix 变换，形式类似 `cm={a,b,c,d,(p)}` 或低层 `\pgftransformcm{a}{b}{c}{d}{\pgfpoint{x}{y}}`。

## coordinate transformation

坐标层变换，例如 scale、rotate、xshift。通常比 canvas transformation 更安全，因为 TikZ 还能追踪 node 和 bbox。

## coordinate transformation matrix

TikZ 在坐标解释后应用的 affine matrix。`shift`、`scale`、`rotate`、`xslant`、`yslant` 等都会累积到这个矩阵，但它不应直接缩放线宽或 dash pattern。

## flex / bend arrow

曲线箭头的高级定位方式。`flex` 沿 path length 修剪并旋转箭头，`bend` 会让 arrow tip 自身沿曲线弯曲。

## graph command

TikZ `graphs` library 提供的 path command：`\graph { a -> b }`。它把 graph grammar 展开成普通 node 和 edge，不等同于 LuaTeX graphdrawing engine。

## graph color class

`graphs` library 构造期使用的逻辑颜色集合，例如 `all`、`source`、`target`、`source'`、`target'`。它们用于 graph operators，不是最终绘制颜色。

## graph operator

`graphs` library 中对一个 group 的 nodes 批量加边或改逻辑颜色的算法，例如 `clique`、`cycle`、`path`、`complete bipartite`、`matching`、`butterfly`。

## graph placement strategy

`graphs` library 的 online node placement 机制，例如 `grow right`、`branch down`、`grid placement`、`clockwise`。它只做简单在线布局，不是完整 graphdrawing。

## matrix

TikZ 中的特殊 node。它的 text box 被 rows/columns 组成的 matrix contents 替代，matrix 本身仍可 draw/fill/anchor/name，并能作为连线目标。

## matrix cell picture

matrix 中每个 cell 内部的轻量 TikZ picture。TikZ 根据它的 bounding box 和 origin 计算行列对齐，而不是只按文本宽高或固定格子处理。

## matrix spacing list

`row sep` / `column sep` 的列表语义，例如 `{1cm,between origins}`。所有 dimension 相加，最后出现的 `between origins` 或 `between borders` 决定 spacing 是 origin-to-origin 还是 border-to-border。

## matrix anchor

matrix 专用定位 key。`matrix anchor=west` 只影响外层 matrix node；`matrix anchor=<inner node>.<anchor>` 可让内部 cell node 的某个 anchor 对齐到 matrix 的 `at` 坐标。

## child operation

TikZ 原生 tree 语法中的 path operation，例如 `node {root} child {node {leaf}}`。它会收集同一 parent 的 children，计算 child origin，解释 child path，并自动添加 edge from parent。

## child node

child path 中第一个 node 或 coordinate。它是 parent-child edge 的目标，也是自动命名和递归 children 的锚点。

## edge from parent

TikZ tree 中 parent 到 child 的自动连线操作。默认 path 是 `(\tikzparentnode\tikzparentanchor) -- (\tikzchildnode\tikzchildanchor)`，可通过 style、anchors 或 custom path 改写。

## growth function

TikZ tree 用来把当前 child index、children count、level distance、sibling distance 和 grow direction 转成 child origin 的函数。基础 TikZ 的默认函数不做 subtree 避让。

## missing child

`child[missing]`。它参与 sibling count 和 child index，但不生成 node、edge 或 child body 内容，用于保留树布局中的空位。

## plot path operation

TikZ core path operation，例如 `plot coordinates{...}` 或 `plot (\x,{sin(\x r)})`。它把一串采样点转换为当前 path 的 segments，不负责 axis、ticks 或 legend。

## plot point provider

生成 plot points 的来源层。可能来自 inline coordinates、table file、coordinate expression sampling，或 `function{...}` 的 gnuplot/JS sampling。

## plot handler

把 plot points 转成 path geometry 的策略，例如 sharp、smooth、const plot、jump plot、ycomb、xcomb、ybar、only marks。

## plot mark

绘制在 plot points 上的 glyph，例如 `mark=x`、`mark=*`。marks 通常在 path action 之后绘制，类似 text nodes 的 layering。

## tick placement strategy

datavisualization 中自动选择 tick/grid 位置的策略。线性轴常用 linear steps，logarithmic axis 使用 exponential steps；`few`、`some`、`many`、`about`、`step`、`phase` 都会影响它。

## pgfplots

LaTeX package，提供 `axis`、`\addplot`、ticks、labels、legend、坐标轴变换等完整图表系统。它不是 TikZ core `plot` operation，但最终可展开到 TikZ/PGF drawing primitives。

## current point

path 解析过程中的当前位置。相对坐标 `++(...)`、`+(...)`、inline node、edge 都依赖它。

## edge

path 内用于连接当前点和目标点的操作，常见于 tree、graph 和普通 path：

```tex
(A) edge [red] (B)
```

TikZ 中 `edge` 会生成一条独立 path，不会像 `--` 那样更新当前点。

## edge node

放在 `edge` 操作内部的 label node，例如 `edge node[midway] {x} (B)`。它应沿 edge path 的几何位置放置，并继承 edge/path 相关文本语义。

## every picture

在每张 `tikzpicture` 开始时自动安装的 style。用于设置图级默认线宽、字体、颜色等。

## every scope

在每个 `scope` 开始时自动安装的 style。只影响该 scope 内部，不应泄漏到外层。

## event-triggered animation

由 click、mouseover、focus、begin/end/repeat、key 等事件启动或结束的 animation timeline。Web/SVG 输出需要保留事件 target，snapshot 输出通常会忽略交互事件。

## fading / soft mask

一种由亮度决定透明度的 mask。TikZ 的 fading picture 中白色趋近不透明、黑色趋近透明，最终通常应在 SVG 中映射为 `<mask>` 或等价 group mask。

## fill rule

判断复合路径或自交路径哪些区域属于内部的规则。TikZ 默认 `nonzero rule`，也支持 `even odd rule`。

## path morphing decoration

把原 path 变形成拓扑相近 path 的 decoration，例如 snake、zigzag、bumps。实现上需要 path length parameterization、tangent 和 normal。

## path replacing decoration

用另一组 path 完全替换原 path 的 decoration，例如 brace、crosses、ticks。它不一定保留原 path 的 fill/draw 直觉。

## path removing decoration

移除原 path、只产生副作用的 decoration，例如 text along path。它通常生成 text/nodes/marks，而不是返回主 path geometry。

## inner sep

node 中文字内容到 shape 边界的内边距。它直接影响 node box、circle 半径和 anchor border。

## label

node option 中创建额外 label node 的机制，例如 `label=above:$A$`。label 不是普通文本属性，而是依赖主 node box、label distance 和方向的派生 node。

## keyframe

animation timeline 中的一个 time-value pair，例如 `0s="red"` 或 `2s="{(1,1)}"`。TikZ 在相邻 keyframes 之间按 attribute 类型插值或保持。

## library

通过 `\usetikzlibrary{...}` 加载的 TikZ/PGF 能力模块。TeX 中通常对应 `tikzlibrary<name>.code.tex` 或 `pgflibrary<name>.code.tex`。

## node

TikZ 中承载文字/公式/shape 的对象。node 可以命名，后续作为坐标引用。

## node as coordinate

把 node 名称当坐标使用的语义。`(A.anchor)` 使用显式 anchor；`(A)` 在 path construction 中通常会按路径方向裁剪到 shape boundary，而 coordinate shape 例外。

## node box model

node 的尺寸构造模型：文本/公式 box 加 `inner sep`，再应用 minimum size，得到可见 shape boundary；再叠加 `outer sep` 得到 anchor/border spacing boundary。

## outer sep

node shape 外侧到 anchor/border 计算边界的外边距。TikZ 默认与 line width 相关，`outer sep=auto` 会根据 draw/fill/scale 进行补偿。

## opacity channels

TikZ 中按绘制通道区分的透明度：`opacity`、`draw opacity`、`fill opacity`、`text opacity`。Web 端实现必须避免把 fill opacity 错加到 stroke 或 text。

## package

通过 `\usepackage{...}` 加载的 LaTeX package。对 TikZKit 来说，package 层通常注册宏、环境、默认样式或 extension，而不是直接画图。

## simple graph

`graphs` library 中每个 node pair 最多保留一条 edge 的模式。后出现的 edge specification wins，`-!-` 可删除 edge。

## snapshot

TikZ animation 的静态求值模式，例如 `make snapshot of=<time>`。它把某个时间点的 animation attribute 值写回普通 drawing commands，用于 PDF、PNG 对比或静态预览。

## SMIL

SVG 的同步多媒体动画模型。TikZ `animations` library 的动态输出主要面向 SVG/SMIL，通常映射到 `<animate>`、`<animateTransform>` 或 `<animateMotion>`。

## pin

node option 中创建 label node 和 pin edge 的机制，例如 `pin=45:$p$`。pin 同时受 `pin distance`、`pin edge`、`every pin` 和 `every pin edge` 影响。

## path specification

path 的几何描述，例如 `(0,0) -- (1,0) -- cycle`。

## path picture

用当前 path 作为 clipping path，然后在其中执行一段 TikZ code 的机制。常配合 `path picture bounding box` 放置文字、图片或内部装饰。

## path fading

把某个 fading mask 应用于当前 path action 的机制，例如 `path fading=west`。它只影响当前 path，不等同于 `scope fading`。

## path sampler

把 path 按长度参数化的工具，能在任意 distance/ratio 上返回 point、tangent、normal 和 segment 信息。decorations、markings、sloped nodes、arrow shortening 都应复用它。

## postaction

主 action 完成后，再用同一条已完成 path 按另一组选项绘制一次或多次。

## preaction

主 action 之前，先用同一条已完成 path 按另一组选项绘制一次或多次。常用于 shadow、highlight 和复杂 layered style。

## pgf coordinate system

TikZ/PGF 的坐标系统。裸坐标 `(2,1)` 默认表示 2 个 x 单位、1 个 y 单位，默认单位向量是 1cm。

## pic

TikZ 中可复用的小图形片段。`angles` library 的 `pic {angle=A--B--C}` 是典型用法。

## pic actions

Pic code 内部使用的 style，用来接收调用 `\pic[...]` 时给出的 draw/fill/shade/clip action。只有显式写了 `[pic actions]` 的内部 path 才应继承这些 action。

## pic text

传递给 pic type 的文本参数。Quotes library 会把 pic option 中的 `"text"` 转成 `pic text=text` 和 `pic text options={...}`。

## pic type

Pic 要执行的类型名或 key list，例如 `seagull`、`angle=A--B--C`。TikZ 会在 `/tikz/pics/` key path 下解析它，并最终设置 `/tikz/pics/code`。

## sloped node

path 上带 `sloped` 的 node。它跟随当前 path segment 的切线旋转，默认保持文字不倒置，`allow upside down` 会关闭该修正。

## scope

局部图形参数组。scope 内部继承外层参数，也可以覆盖。

## shift only

TikZ transformation option，保留当前 origin shift，但移除已有 rotation、scale、slant 等线性部分。常用于“走到某个位置后正常绘制”。

## scope fading

安装到当前 scope 的 soft mask，会影响 scope 内后续绘制。它需要 scope-level graphic state，通常还要与 transparency group 一起实现。

## scoped

TikZ 的单命令 scope 写法：`\scoped[options]<path command>`。语义上等价于临时包一层 `\begin{scope}[options] ... \end{scope}`。

## style

可复用 option 集合。例如：

```tex
\tikzset{block/.style={rectangle,draw,fill=blue!20}}
```

## TikZ unit

默认 TikZ 坐标单位，通常 1 unit = 1cm。对比网格建议按 1cm 画，方便定位 JS/native 差异。

## timeline

TikZ animation 中某个 object/attribute/id 的时间序列。它由多个 keyframes 和控制项组成，例如 begin/end、base、repeats、restart、ease、begin on。

## transform canvas

TikZ key，用 coordinate-style options 修改 canvas transformation matrix，例如 `transform canvas={scale=2}`。它与普通 `scale=2` 不同，通常会影响线宽、文字和 bbox 追踪。

## transform shape

让 node shape/text 跟随当前 transform 缩放或旋转的选项。默认 coordinate transform 主要影响 node position，不应直接缩放 node 内容。

## transparency group

把 scope 内内容先合成到独立 buffer，再整体输出到外层的机制。它用于避免半透明 path 自叠加，也支撑 blend group、scope fading 和 knockout。

## knockout group

transparency group 的一种模式，后画内容会从同组早画内容中挖掉对应区域。SVG 中需要额外 mask/filter 处理，不能只用普通 `<g opacity="...">` 表达。
