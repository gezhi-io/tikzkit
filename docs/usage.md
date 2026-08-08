# TikZKit 使用指南

TikZKit 是一个仍在测试中的纯 JavaScript TikZ 解释器。浏览器和 Node.js
渲染不会调用本机 LaTeX；本机 MacTeX 与 `tikztosvg` 只用于开发时对照。
它适合编辑、研究和逐案例校准 TikZ，尚不是 TeX/TikZ/PGFPlots 的通用替代品。

当前维护语料的语义基线应由 `npm run gallery:audit` 实时生成。这只表示这批
案例被解释器接收；是否与原生 TikZ 视觉一致，仍必须按第 4 节生成并检查三方
参考图。新近验收的 `tkz-euclide` 例子包括带圆周节点的
`\\tkzInterCC[with nodes]`；其他未登记的几何、排版和 package 语义依然可能
是 partial 或 unsupported。近期验收的 `shapes.multipart` 圆角分栏案例说明了
这一区别：只有外缘应当圆角，内部格子的接缝仍应是直角；请不要用“页面有图”
代替三方图的实际检查。

## 快速选择

| 想做什么 | 使用方式 | 完成条件 |
| --- | --- | --- |
| 在线编辑和预览 | 启动网页编辑器 | SVG 出现且 diagnostics 已检查；不代表已与 LaTeX 一致。 |
| 导出一个 SVG | 运行 CLI | 输出 SVG 已写入目标路径。 |
| 改一个真实案例 | 先 audit，再生成三方图和 diff | 实际检查 TikZKit、`tikztosvg`、MacTeX 和 diff 面板，写明遗留差异。 |
| 提交兼容性改动 | 运行聚焦测试、语义基线和视觉验收 | 只提交实现、测试、fixture、registry、QA 记录。 |

`outputs/` 和 `output/` 都是被 Git 忽略的本地生成目录。可放心在其中放 SVG、PNG、
审计 JSON 和对照页；不要将它们加入提交。

## 提交前核对

一次兼容性提交只承诺一个清晰的 library、命令族或共享语义切片。提交前按下面顺序
核对，避免“页面有图”被误当成与 LaTeX 一致：

1. 用 `case:audit` 列出该真实源码使用的 package、library、命令、选项、变量、数值
   和表达式，并明确哪些属于本轮边界、哪些仍未实现。
2. 阅读对应的本机 MacTeX/TeX Live 源码或文档，记录实际采用的几何、默认值或布局
   规则；不要只凭浏览器画面猜测。
3. 运行相关的最小回归测试，再生成同一 fixture 的 TikZKit、`tikztosvg`、MacTeX、
   网格和 diff 工件，打开 `outputs/qa-*/index.html` 实际检查。
4. 只在真实视觉有改善、diagnostics 没有增加时更新实现；随后更新 extension registry
   和 `docs/qa/` 记录。提交实现、测试、fixture、登记表和 QA Markdown，绝不提交
   `outputs/` 中的 SVG、PNG 或差分图。

完整测试套件用于发现跨模块回归；日常修复优先以与改动直接相关的窄测试和三方视觉
面板为验收依据。若完整测试中已有与本次无关的失败，需要在提交说明中明确列出，不能
把它们误报为通过。

### 一次合格改动应包含什么

浏览器中出现 SVG 只说明解释器没有立刻失败。若要把一个兼容性改动提交到仓库，
请把同一份真实源码固定为 fixture，并且只提交以下可复现内容：

1. 共享实现或 library/extension 的修改，而不是为单一案例写坐标特例。
2. 最小语义回归测试与 fixture manifest 记录。
3. `docs/extension-registry.*` 中的状态、实现位置、本机源码阅读记录与明确边界。
4. 一份 QA Markdown：描述 MacTeX、`tikztosvg`、TikZKit 和 diff 面板的可见差异、
   修复前后变化、执行命令和剩余限制。

`outputs/` 下的 SVG、PNG、diff 和 HTML 是本地验收证据，不应加入 Git。这样一次
提交既能在干净检出中重新生成，也不会把大量二进制图片当成实现本身。

## 1. 启动网页编辑器

```bash
npm install
npm run web
```

在浏览器打开 <http://127.0.0.1:5173/>。页面可以选择维护中的案例、编辑源码，
并显示 TikZKit 的 SVG 与诊断结果。

已有一个网页服务时，启动独立端口：

```bash
PORT=5174 npm run web
```

然后访问 <http://127.0.0.1:5174/>。网页修改后刷新即可；服务对静态文件与案例
目录使用 `no-store`，不需要手动清理浏览器缓存。

## 2. 转换一个文件

```bash
node bin/tikz2svg.js path/to/diagram.tex -o outputs/diagram.svg
```

省略 `-o` 时，会在输入文件旁写入同名 `.svg`。`outputs/` 是本地生成目录，已经
被 Git 忽略，适合放临时 SVG、PNG 和视觉对照，不应加入兼容性提交。

## 3. 在 JavaScript 中调用

```js
import { tikzToSvg } from "./src/index.js";

const source = String.raw`
\begin{tikzpicture}
  \draw[->] (0,0) -- (2,1) node[right] {$x$};
\end{tikzpicture}`;

const result = tikzToSvg(source);

if (result.diagnostics.length) {
  console.warn(result.diagnostics);
}
document.querySelector("#preview").innerHTML = result.svg;
```

常用接口：

- `parseTikz(source)`：源码到 AST。
- `interpretTikz(ast)`：AST 到绘图 IR。
- `renderSvg(ir)`：IR 到 SVG 字符串。
- `tikzToSvg(source)`：一次完成解析、解释和 SVG 输出。

当 PNG 或 SVG 比较工具不支持 `foreignObject` 时，传入
`{ mathRenderer: "svg-text" }`，让数学内容走兼容的 SVG 文本输出。

## 4. 验证一个真实案例

一次兼容性改动不能只看网页“有图”。先盘点语义，再生成三份参考：

```bash
# 列出案例使用的 package、library、命令、参数、数值和表达式。
npm run case:audit -- path/to/case.tex \
  --output outputs/case-audit.md \
  --init-review outputs/case-review.json

# 生成 TikZKit、tikztosvg、MacTeX 的 SVG/PNG，以及带 1cm 网格的版本。
npm run examples:render -- --fixtures test/fixtures/examples \
  --only <fixture-id> \
  --output outputs/qa-my-change \
  --native-reference \
  --comparison-grid-mode svg \
  --strict-tikztosvg

# 生成差异图与同页对照。
npm run examples:diff -- --output outputs/qa-my-change \
  --register --alignment-radius 3
```

打开 `outputs/qa-my-change/index.html`，逐项检查：

1. 图元是否缺失，包括节点、箭头、填充、图片和图例。
2. 坐标原点、尺度、裁剪与边界框是否一致；网格只辅助判断，不能代替几何检查。
3. 字体、公式、标签锚点、线宽、颜色、透明度和绘制层次是否一致。
4. TikZKit、`tikztosvg` 与 MacTeX 是否在同一处偏差；最终以 MacTeX 为准。

差分数值仅用于发现候选问题。接收修改前仍须实际看 JS、`tikztosvg`、MacTeX 与
diff 面板，写下可见的修复前后变化和遗留边界。

### `calc` 坐标计算

`\usetikzlibrary{calc}` 的已验证坐标计算支持带正负号的任意项序列。每一项可带
PGF math 系数，并可先使用已有的插值、距离、角度或投影修饰。首项是计算的基准
坐标；后续显式 `(dx,dy)` 坐标继续按局部向量处理，因此它们会随当前 `x`/`y` 基向量
变化而不会把 scope 的平移重复加进去。

```tex
\usetikzlibrary{calc}
\coordinate (sum) at ($(A)+(B)+(C)$);
\coordinate (weighted) at ($2*(A)-.5*(B)+(C)$);
\coordinate (shifted) at ($(A)!.5!(B)+(0,1)$);
```

这不是完整的 TeX 展开器：需要任意宏展开的系数、模糊的未加花括号嵌套因子，以及
所有 PGF 显式坐标系统组合仍需做真实案例验收。可复现本轮三方对照：

```bash
node --test --test-name-pattern='signed calc coordinate' test/interpreter.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --only calc-multi-term-coordinate-sums --output outputs/qa-calc \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-calc --register --alignment-radius 3
```

### PGFPlots 中轴科学计数法标签

2D `axis y line=middle` 的大数 y 轴会显示 `\cdot 10^{n}`。TikZKit 已按本机
PGFPlots 的 `yticklabel* cs:1.03,-0.3em` 规则把它放到左侧刻度列外、顶部上方，避免
与位于 y 轴顶部的水平 `ylabel` 重叠。该规则适用于普通数值轴与自动 scientific
scale；自定义 `every y tick scale label`、自定义 `ticklabel* cs`、对数轴和完整数字
格式仍是 partial。

可直接复现双纵轴 CSV 案例：

```bash
node --test test/pgfplots-csv-overlay.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --only latex-examples-csv-line-plot-two-axes \
  --output outputs/qa-pgfplots-middle-y-scale-label \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-pgfplots-middle-y-scale-label
```

三方视觉记录见
[2026-08-07-pgfplots-middle-y-scale-label.md](qa/2026-08-07-pgfplots-middle-y-scale-label.md)。

### PGFPlots 3D 等比例单位盒

已验证的 `scale mode=scale uniformly, scale uniformly strategy=units only`
子集用于保持 3D x/y/z 方向的一致单位比例。它不会把投影图形强行拉满请求的
`width` 与 `height`；仅相对的 x/y/z 数据跨度会改变盒形状，三个范围同时乘以同一
倍数后仍会得到同样的紧凑图盒。未指定 `colormap name` 的 `surf` 使用 PGFPlots 默认
`hot` 色图：`blue -> yellow -> orange -> red`。

```tex
\begin{axis}[
  width=6cm, height=3cm, scale only axis,
  scale mode=scale uniformly,
  scale uniformly strategy=units only,
  view={65}{35},
  xmin=0, xmax=1, ymin=0, ymax=1, zmin=0, zmax=2,
  grid=major
]
  \addplot3[surf,domain=0:1,y domain=0:1,samples=9] {x+y};
\end{axis}
```

对应 fixtures 是 `pgfplots-scale-mode-uniform-3d` 与
`pgfplots-scale-mode-uniform-3d-large-range`。完整 `auto`、`change horizontal limits`、
`change vertical limits`、混合的显式 unit-vector 比例、复杂 3D 描述与精确文字边界
仍是 partial；请按第 4 节的三方流程验收。

### PGFPlots 3D quiver

已验收的 `\addplot3` quiver 子集包含 `quiver/u`、`quiver/v`、`quiver/w`、
`quiver/scale arrows` 与 `quiver/update limits`。解释器会先 survey 箭头起点；
默认 `update limits=true` 时，还会 survey 缩放后的终点。因此箭头所在平面、3D
底面、网格、刻度和 SVG 裁剪会来自同一份范围，不会把 `z=-4` 这样的常量矢量场
画在 range 之外。

```tex
\addplot3[/pgfplots/quiver,
  quiver/u={sin(x)}, quiver/v={cos(y)}, quiver/w=0,
  quiver/scale arrows=4, -stealth] {-4};
```

若源码明确使用 `quiver/update limits=false`，只将箭头起点计入范围。点元数据
映射、完整 `every arrow` 风格、table/stream handler、对数 3D survey 与复杂裁剪
组合仍是 partial，修改这些情形必须重新做三方图片验收。

### Regular polygon and curved terminal arrows

The verified `shapes.geometric` slice covers a regular polygon's PGF-style
content sizing, circumcircle `minimum size`, odd/even default orientation,
`shape border rotate`/`regular polygon rotate`, and the border crop for a
curved terminal arrow. Use both libraries explicitly:

```tex
\usetikzlibrary{arrows.meta,shapes.geometric}
\begin{tikzpicture}
  \node[draw,regular polygon,regular polygon sides=6,minimum size=1.7cm]
    (hex) {hexagon};
  \draw[-{Latex[length=4mm]},very thick]
    (0,0) to[out=30,in=190] (hex);
\end{tikzpicture}
```

The maintained driver is
`test/fixtures/examples/arrows/regular-polygon-curved-terminal.tex`. Its QA
workflow is the same as section 4, with
`--only arrows-regular-polygon-curved-terminal`. This does not cover the full
PGF border-anchor algorithm: rectangle, diamond, star, trapezium, custom
shapes, and tip-specific padding/separation keys are still partial.

### 树的子节点与边锚点

`\usetikzlibrary{trees}` 的已验收子集会从 `growth parent anchor` 放置下一层，
在生成子节点前应用 `every child node`，并把生成树边的 `parent anchor` 与
`child anchor` 交给同一套节点锚点计算。未设置这两个 key 时，`border` 仍按节点
轮廓自动裁剪；`edge from parent fork down/up/left/right` 使用这些已解析的端点。

```tex
\begin{tikzpicture}[level distance=1cm,
  every node/.style={rectangle,draw,minimum height=6mm,inner sep=2pt},
  every child node/.style={anchor=north}]
  \node (root) {root}
    [growth parent anchor=south,parent anchor=south,child anchor=north]
    child {node {child} edge from parent[blue,thick]};
\end{tikzpicture}
```

对应 driver 是 `trees-anchor-routing`。图形绘制算法、碰撞回避、任意
`edge from parent path` TeX 代码和复杂 forest 风格仍在测试中。

### Chains 中插入既有节点

`\usetikzlibrary{chains}` 的 `\chainin` 会把已创建的节点加入当前链，而不会重画
节点。TikZKit 按本机链库的顺序先应用 `every chain in`，再应用 `\chainin` 方括号内
的直接选项；因此可把连接箭头和样式集中放在链级样式中。

```tex
\begin{tikzpicture}[
  start chain=walk going right,
  every join/.style={-{Stealth[length=1.8mm]}},
  every chain in/.style={join=by {red,very thick}}
]
  \node (existing) at (0,2) {existing};
  \node[draw,on chain,join] {A};
  \node[draw,on chain,join] {B};
  \chainin (existing);
  \node[draw,on chain,join] {C};
\end{tikzpicture}
```

该子集包括 `start chain`、`continue chain`、`start branch`、`continue branch`、
`on chain`、`join`、`every join` 与 `every chain in`。`\chainin` 之后继续同一条任意
路径的完整 TeX late-options 行为仍在测试中。

### 路径替换装饰

`\usetikzlibrary{decorations.pathreplacing}` 当前已验证 `brace`、`ticks`、`border`、
`waves` 和 `expanding waves`。`ticks` 将路径替换为沿局部法线的独立短线，`amplitude`
是短线的半长；`border` 使用单侧短线，其方向由 `angle` 决定。`waves` 用固定
`radius` 的圆弧替换路径；`expanding waves` 先空走一个 segment，再按累计路径长度
增大圆弧半径。它们都按完整的 `segment length` 状态推进；固定 `waves` 的
最后不足一个状态的路径尾部不会强行补到几何终点，而 `expanding waves` 在终点
恰好落在完整状态边界时仍会执行原生的零宽终态。

手册常用的 `postaction={decorate,draw,red}` 形式会保留原路径，再叠加使用外层
`decoration=...` 的彩色装饰。它目前只对解释器已有的路径装饰生效；任意 TeX
postaction 代码与 `show path construction` 仍在测试中。

```sh
node --test --test-name-pattern='fixed-radius and expanding wave arcs|border decoration|normal ticks|brace decoration' \
  test/interpreter.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --only decorations-pathreplacing-waves \
  --output outputs/qa-pathreplacing-waves \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-pathreplacing-waves \
  --register --alignment-radius 3
```

查看生成页时，确认原始黑色路径仍存在、装饰短线独立且连续跟随曲线切线，并将
TikZKit、`tikztosvg`、MacTeX 和 diff 面板一起判断。

### 旧 `snakes` 写法

`\usetikzlibrary{snakes}` 在本机 MacTeX 中已经提示由 decorations 取代，但仍保留
直接写在路径上的 `snake` 选项。它和 `decorate, decoration={...}` 不同：每一个
`--` 都会单独启动旧状态机。TikZKit 当前支持默认的旧式 `zigzag`、`snake=snake`、
`segment amplitude`、`segment length`、`mirror snake`、`raise snake`，以及
`line/gap before|after|around snake`。

```tex
\usetikzlibrary{snakes}
\draw[snake,segment length=4mm,segment amplitude=1mm,
  line before snake=5mm,line after snake=4mm,
  mirror snake,raise snake=.4mm,-stealth]
  (0,0) -- (4,0) -- (4,2);
```

尚未实现任意 `\pgfdeclaresnake` 状态、`snake triangles 45/60/90` 与旧的 segment
object 形状。新项目应优先使用 `decorations.pathmorphing`。最小验证：

```sh
node --test test/snakes-legacy-options.test.js
```

### 路径文字重复

`\usetikzlibrary{decorations.text}` 的文本效果装饰支持路径文字的受限重复形式。
`repeat text` 不带数值时会重复到无法容纳下一个完整字符盒；`repeat text=N` 则在
首轮之后再绘制 `N` 轮。花括号中的结尾空格是文字序列的一部分，可用于控制每轮之间
的间隔。

```tex
\path[decorate,decoration={text effects along path,text={AB },
  text effects/.cd,repeat text}] (0,0) -- (8,0);
\path[decorate,decoration={text effects along path,text={WXY},
  text effects/.cd,repeat text=1}] (0,-1) -- (8,-1);
```

该子集只处理完整字符盒的循环与路径末端截断。字符专属样式、任意替换 TikZ 代码，
以及与 `fit text to path` / `scale text to path` 的组合仍在测试中；后两种组合在本机
PGF 手册中也标为未定义行为。

### 路径文字的多个后置装饰

同一个路径可重复写 `postaction`。TikZKit 保留源码顺序，并为每一个装饰单独解释
`text color` 与 `reverse path`；后者只改变沿路径取样的方向，不会等同于 `reverse text`
而把字符次序颠倒。下面是本机 PGF 手册的真实模式：

```tex
\draw[gray,->]
  [postaction={decorate,decoration={text along path,text={a big juicy apple},
    text color=red,raise=2pt},decorate}]
  [postaction={decorate,decoration={text along path,text={a big juicy apple},
    text color=blue,raise=2pt,reverse path},decorate}]
  (5.5,.4) .. controls (5.5,2.5) and (.5,2.5) .. (.5,.4);
```

用仓库 fixture 复现三方检查：

```sh
node --test --test-name-pattern='repeated decorations.text postactions|reverses the sampled decorations.text path' \
  test/interpreter.test.js test/svg-renderer.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --only decorations-text-reverse-path \
  --output outputs/qa-decorations-text-postactions \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-decorations-text-postactions \
  --register --alignment-radius 3
```

这不是任意 `postaction` TeX 代码的通用执行器。路径文字以外的后置图形操作、任意
宏回调，以及完整 TeX 盒子度量仍需按案例实现和复核。

### 路径文字按词分组

`text effects/.cd` 中的 `group letters` 与 `group letters into words` 会将简单的
连续文字合并成一个沿路径切线旋转的文字盒；单词之间的分隔符保留为单独的盒。默认
分隔符为 `space`，也可以设置一个字符。`reverse text` 与分组按源代码顺序执行：先
分组再反转会反转整个词的顺序，先反转再分组则会合并反转后的字母。

```tex
\path[decorate,decoration={text effects along path,text={group words},
  text effects/.cd,group letters into words}]
  (0,0) .. controls (2,2) and (4,2) .. (6,0);
\path[decorate,decoration={text effects along path,text={left-right},
  text effects/.cd,word separator=-,group letters}]
  (0,-1) -- (6,-1);
```

带逐字符样式、替换回调、内联数学盒或复杂 TeX 组的文字目前不会跨盒合并；这些内容会
保留为单独的路径文字盒。

### Calendar 列表布局

`\usetikzlibrary{calendar}` 当前支持 Monday-first `week list`、四种线性日列表
（`day list downward`、`upward`、`right`、`left`）和紧凑 `month list`。月份切换
会先加入对应的 `month xshift` 或 `month yshift`；`month list` 即使从月中开始，仍按
该月 1 日的星期决定列偏移。可使用 `month label left` 将月份文字放在当月行左端。

```tex
\begin{tikzpicture}
  \calendar [dates=2000-01-01 to 2000-02-05,
    month list, month label left,
    day xshift=3mm, month yshift=7mm,
    every day/.style={draw, minimum size=3.3mm}]
    if (Sunday) [red];
\end{tikzpicture}
```

运行 `calendar-list-arrangements` 可以同时核对四种线性方向、跨月额外间距与
month-list 的星期列：

```bash
node --test test/calendar.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --only calendar-list-arrangements \
  --output outputs/qa-calendar \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-calendar --register --alignment-radius 3
```

当前不支持本地化月份名称、`month label right`/vertical 变体、任意 `day code`/
`month code` 和可执行 calendar hook；不要把没有验证的这些选项当作兼容承诺。

### xcolor 默认色与混色

TikZKit 会优先使用 TeX/xcolor 的自然色模型，而不是浏览器同名 CSS 颜色。已有
`red`、`green`、`blue` 的 RGB 默认色；`cyan`、`magenta`、`yellow`、`olive`
则按本机 `color.sty`/`xcolor.sty` 的 CMYK 默认色处理。因此 `cyan!50!black`
不是浏览器的深青色，而是先在 CMYK 通道中混色、再转换成 SVG `rgb(73 118 141)`。

当前这一切片覆盖上述四个默认色及常见 `!` 混色，也继续支持 `\definecolor` 的
`HTML`、`rgb`、`RGB`、`gray` 模型。它不覆盖 `\selectcolormodel`、颜色序列、
遮罩或任意的 `\color[model]{...}` 声明。修改颜色语义时，可用以下基准和真实案例
复核：

```bash
npm test -- test/options.test.js test/pgfplots-csv-overlay.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --only xcolor-natural-cmyk \
  --only latex-examples-csv-2d-gaussian-multivarate-distributions \
  --output outputs/qa-xcolor-cmyk \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-xcolor-cmyk \
  --register --alignment-radius 3
```

检查 `xcolor-natural-cmyk` 的八个色块是否逐一一致，并在散点图中确认
`cyan!50!black` 点云为蓝灰色而不是明亮青绿色。

### bchart 横向柱图

`\usepackage{bchart}` 的当前兼容切片覆盖 `bchart`、`\bcbar`、`\bclabel`、
`\bcskip`、`\smallskip`/`\medskip`/`\bigskip` 和 `\bcxlabel`，包括 `min`、
`max`、`step`、`steps`、`width`、`unit`、`plain`、`scale` 与柱的
`color`/`text`/`label`/`value`。与本机 `bchart.sty` 一致，`scale` 只缩放柱和
坐标轴，不缩放文字；可在每个图表之前用零参数
`\renewcommand{\bcfontstyle}{\bfseries}` 改为粗体，或定义为空以回到文档字体。
通用 TeX 宏展开、任意长度寄存器和完整 bchart API 仍在测试范围之外。

```sh
npm test -- test/bchart.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --only bchart-font-style \
  --output outputs/qa-bchart-font-style \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-bchart-font-style \
  --register --alignment-radius 3
```

### 图例和文字锚点

PGFPlots 的 `legend cell align=left` 不是把每一行文字“看起来靠左”即可；本机
PGFPlots 会将 legend 矩阵单元格设为 `anchor=west`。因此所有图例行应从同一个
左边缘开始，不能因为文字宽度不同而被不同的节点中心推开。TikZKit 的缓存 SVG
文字也会保留这种显式 `start`/`end` 锚点。

修改图例、文字缓存、字体或 bbox 时，用实际图表验证锚点，而不是只看单行文本：

```bash
node --test --test-name-pattern='explicit SVG text anchors|legend cell alignment' \
  test/svg-renderer.test.js test/pgfplots-seams.test.js

npm run examples:render -- --fixtures test/fixtures/examples \
  --only latex-examples-2d-epochs-overfitting \
  --output outputs/qa-pgfplots-legend-anchor \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-pgfplots-legend-anchor \
  --register --alignment-radius 3
```

打开 `outputs/qa-pgfplots-legend-anchor/index.html`，检查 legend 边框、每条样线、
每行文字的共同左边缘，以及最长文字是否被 SVG 裁切。普通公式与 tiny `pmatrix`
图例可用下列两个真实案例复核其框宽；自定义多列布局、任意 font 组合与最终
浏览器/TeX bbox 校准仍在测试中。

```bash
node --test --test-name-pattern='pmatrix legends|math-heavy entries' \
  test/pgfplots-seams.test.js

npm run examples:render -- --fixtures test/fixtures/examples \
  --only latex-examples-activation-functions \
  --only latex-examples-faktorraum \
  --output outputs/qa-pgfplots-legend-matrix \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-pgfplots-legend-matrix \
  --register --alignment-radius 3
```

## 5. 日常检查与提交

```bash
# 维护案例的语义检查；以本次输出的 rendered 数和 diagnostics 为准。
npm run gallery:audit

# 只运行正在修改的功能测试，例如 multipart。
node --test test/shapes-multipart-vertical.test.js

# package/library 行为改动后，重建支持登记表。
npm run extension-registry

# 提交前检查空白与冲突标记。
git diff --check
```

完整 `npm test` 适合观察实验性基线，但不是当前发布门槛；其中仍有已知的历史失败。
提交一个功能时，应只包含共享实现、最小回归测试、对应 fixture、registry 更新和
`docs/qa/` 的视觉验收记录。不要加入 `outputs/`、`output/` 或浏览器临时截图。

提交前至少运行以下检查，并确认视觉-QA 页面已经实际查看过：

```bash
npm test -- test/<focused-test>.test.js
npm run gallery:audit
git diff --check
git status --short
```

`git status --short` 中的 `outputs/`、`output/`、临时 PNG/SVG 不是源代码，保持
未暂存即可。一次提交只覆盖一个经过验收的功能切片；不要把尚未检查的案例、无关
重构或本地图片混入同一次提交。

三维 `pgfplots` 即使没有 diagnostics，也必须单独生成三方参考：默认透视、
`axis lines=left`、网格面、刻度短线和 colorbar 的投影与边界框都仍按功能切片校准。
对 `hypersurface-*` 等曲面使用足够长的本机参考超时，并实际确认网格/刻度落在投影
凸包的正确边缘；曲面出现本身不是视觉验收。

对于没有显式 `width`/`height` 且不含 colorbar 的默认透视 3D 轴，浏览器会预留 x/y
刻度文字的实际字形盒，以对齐本机 TeX 的下边界。请不要将这视为任意透视、自定义
tick label style 或 colorbar 的通用规则；这些组合仍需按第 4 节走三方视觉验收。可使用
`latex-examples-3d-manhattan-bar-plot` 复现本切片：

```bash
node --test --test-name-pattern='default 3d geometry matches the native Manhattan plot footprint' \
  test/pgfplots-seams.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --only latex-examples-3d-manhattan-bar-plot \
  --output outputs/qa-3d-manhattan --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-3d-manhattan
```

## Basic `graphs` chains

The `graphs` library is supported as a **partial**, visually tested Cartesian
subset. TikZKit lowers `\graph` to normal `\node` and `edge` paths before the
ordinary parser runs, retaining shared border clipping, anchors, curves,
inline labels and arrow tips. The verified basic syntax is:

```tex
\usetikzlibrary{graphs}
\tikz \graph[
  grow right=1.4cm,
  branch down=1cm,
  nodes={draw,circle,minimum size=6mm},
  edges={thick}
] { a -> {b,c} -> d; };
```

The focused edge-label syntax requires TikZ's `quotes` library in the source:

```tex
\usetikzlibrary{graphs,quotes}
\tikz \graph[
  grow right=1.5cm,
  nodes={draw,circle,minimum size=6mm},
  edges={thick}
] {
  a ->[red, "start"] b --["middle"'] c ->[blue,bend left, "return"] a;
};
```

Supported in this slice:

- named node chains and comma-separated chain groups;
- `->`, `--`, `<-`, `<->`;
- graph-wide `nodes={...}` and `edges={...}` styles;
- local edge styles after a connector, including colors, widths and `bend left`
  or `bend right`;
- quoted edge labels (`"text"`) using the default `auto` side, plus the
  apostrophe form (`"text"'`) for `swap`;
- Cartesian `grow right|left|up|down` and `branch right|left|up|down`, using
  `cm`, `mm` or `pt` distances;
- the inline `\tikz \graph ...;` wrapper and `\graph ...;` inside a
  `tikzpicture`.

Subgraphs, graph-drawing algorithms, node sets, circular/grid placement,
aliases, graph operators, source/target edge options (`>` / `<`), arbitrary
quote styles/callbacks, per-edge node syntax and TeX key callbacks are not yet
supported. Run the focused fixtures and inspect all three renderers before
extending this subset:

```bash
node --test test/graphs.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --only graphs-basic-chain-group,graphs-edge-labels-and-styles --output outputs/qa-graphs \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-graphs --register --alignment-radius 3
```

The source review, parameter audit and visual acceptance records are in
[`docs/qa/2026-08-07-graphs-basic-chain-group.md`](qa/2026-08-07-graphs-basic-chain-group.md)
and [`docs/qa/2026-08-07-graphs-edge-labels-and-styles.md`](qa/2026-08-07-graphs-edge-labels-and-styles.md).

## 6. 常见问题

**网页打不开或端口被占用**：使用 `PORT=5174 npm run web` 启动另一份服务，确认
访问的端口与终端输出一致。

**SVG 出来了但与 LaTeX 不一样**：先看 `result.diagnostics`，然后用第 4 节的命令
做三方对照。无诊断只表示已处理，不表示视觉兼容。

**本机没有 `tikztosvg`**：网页与 CLI 仍可使用；视觉验收会少一份独立 SVG 参照。
不要在浏览器流程中联网安装它，先记录缺失原因并使用本机 MacTeX 作为原生基准。

**需要了解某个 library 是否已实现**：查看 `docs/extension-registry.md`，再到
`src/tikz/libraries/` 找对应名称文件。条目的 `partial` 状态意味着只有登记的功能
族经过真实案例验证，不代表整个 TikZ library 已完成。
