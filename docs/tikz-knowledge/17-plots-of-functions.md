# Section 22 - Plots of Functions

这份记录对应 TikZ manual section 22。这里讨论的是 TikZ core 的 `plot` path operation，不是 `pgfplots` 的完整科学绘图系统。`pgfplots` 更适合真实坐标轴、ticks、legend、axis layout；TikZ `plot` 更像 path 里的一个“用一串采样点继续当前路径”的低层操作。

## Web Renderer Thesis

TikZKit 应把原生 `plot` 作为 path operation 实现：

```text
path segments before plot
-> plot parser: coordinates | file | coordinate expression | function
-> point provider: inline list | table file | sampled expression | gnuplot/table bridge
-> plot handler: sharp | smooth | const | jump | comb | bar | only marks
-> path commands + optional plot marks
-> same path action pipeline: draw/fill/shade/clip/arrow/bbox
```

边界必须清楚：

- TikZ `plot` 不自动生成 axes、ticks、labels 或 legends。
- `pgfplots` / `axis` / `\addplot` 是 package 层，当前在 `src/preprocess.js` 里展开成 TikZ-like statements。
- 浏览器端不应默认执行外部 `gnuplot`。TikZKit 可以用 JS sampling 近似常见 `function{...}`，但应把真正 gnuplot 语义、file cache 和 shell escape 作为显式边界。

## Plot Path Operation

基本形式：

```tex
\path ... plot <further arguments> ...;
\path ... -- plot <further arguments> ...;
```

区别：

- `plot ...`：先 move-to 第一个 plot point。
- `-- plot ...`：从当前 path current point line-to 第一个 plot point，然后继续 plot。

常见 point sources：

```tex
plot[<local options>] coordinates { (0,0) (1,1) }
plot[<local options>] file {plots/data.table}
plot[<local options>] (\x,{sin(\x r)})
plot[<local options>] function {sin(x)}
```

当前代码：

- `src/parser.js:parsePlotSegment` 支持 `plot coordinates{...}`、`plot function{...}`、`plot (<coordinate expression>)`。
- `src/interpreter.js` 对应 `segment.kind === "plot"`、`plotFunction`、`plotCoordinates`。
- `src/interpreter.js:buildPlot` 对 coordinate expression 进行 sampling。
- `src/interpreter.js:buildPlotFunction` 对 `function{...}` 进行 JS/pgfmath sampling。
- `src/interpreter.js:buildPlotCoordinates` 解析 inline coordinates。

当前缺口：

- `-- plot` 与 `plot` 的 current path continuation 需要专门验收：`-- plot` 的第一个 point 应是 `lineTo`，普通 `plot` 应是 `moveTo`。
- `plot file{...}` 未作为 core plot source 完整支持。
- `every plot` style hook 未完整安装。
- plot local options 只能影响 plot point generation / transform / marks；不能单独改变同一 path 中某一段 stroke color。这一点需要在 renderer 行为中保持清楚。

## Inline Coordinates

语法：

```tex
\draw plot coordinates {(0,0) (1,1) (2,0) (10:2cm)};
```

规则：

- 每个 coordinate 走普通 TikZ coordinate resolver。
- 可以混合笛卡尔坐标、极坐标、named anchors、calc/shifted coordinates。
- plot points 默认用 straight line 连接。

当前代码：

- `parsePlotCoordinateList` 按 balanced `(...)` 提取坐标。
- `buildPlotCoordinates` 对每个 coordinate 调用 `resolveCoordinate`。
- 已有测试覆盖 named anchors 与 shifted anchors：
  - `test/parser.test.js`: plot smooth coordinates。
  - `test/interpreter.test.js`: plot marks and coordinate sampling。

当前缺口：

- inline coordinate list 中出现数据集断点、undefined/outlier marker 的语义不存在；这些主要属于 file/table source。
- `smooth cycle`、const/jump/bar handlers 对 inline coordinates 未完整覆盖。

## Plot File Source

TikZ file format：

```text
# comment
0.00000 0.00000 i
0.52632 0.50235 i
...
```

规则：

- 每行前两个 numbers 是 x/y。
- 空行、`#`、`%` 开头通常开启新 data set。
- `o` 表示 outlier，`u` 表示 undefined，默认会断开 subpath。
- file source 与 gnuplot table cache 使用同一种数据模型。

当前缺口：

- 原生 `plot file{...}` 未在 `parsePlotSegment` 中实现。
- file IO 在浏览器端需要明确安全边界；可以只允许 workspace/corpus 中已注册的 table，或预处理阶段内联。
- data set split/outlier/undefined 没有统一 point-provider 模型。

## Plotting Coordinate Expressions

语法：

```tex
\draw[domain=0:4] plot (\x,{sin(\x r)});
\draw[domain=-3.141:3.141,smooth,variable=\t]
  plot ({\t*sin(\t r)},{\t*cos(\t r)});
```

关键 keys：

- `variable=<macro>`，默认 `\x`。
- `samples=<number>`，默认 25。
- `domain=<start>:<end>`，默认 `-5:5`。
- `samples at=<sample list>`。

规则：

- 每个 sample 把 variable 绑定到一个数值。
- coordinate expression 再走普通 coordinate resolver。
- 表达式里常见 `{...}` 是为了避免 coordinate parser 被括号误拆。
- `\x r` 代表把 degree input 转为 radians 的 TikZ/PGF math 后缀语义。

当前代码：

- `buildPlot` 支持 `domain`、`samples`、`variable`。
- `resolveCoordinate` 负责表达式和 basis transform。
- 已有测试覆盖 polar basis 和 radian suffix。

当前缺口：

- `samples at={...}` 未实现。
- `samples at` 的 foreach range `1,4,...,10` 未实现。
- `domain` 对 reversed ranges、expression ranges 的边界行为需要验收。
- `plot` coordinate expression 的 z coordinate 支持需要与 3D basis 对齐验证。

## Plotting Function

TikZ 原生 `plot function{...}` 是 gnuplot bridge：

```tex
\draw plot[id=sin] function{sin(x)};
\draw plot[parametric,id=p] function{t*sin(t),t*cos(t)};
```

TikZ 原生行为：

- 第一次遇到时生成 `<prefix><id>.gnuplot`。
- 如果 table cache 存在且 gnuplot script 匹配，就读 `<prefix><id>.table`。
- 需要 shell escape 和本地 gnuplot 才能自动生成 table。
- `parametric=true` 时用 `t`，formula 返回两个 comma-separated functions。
- `id` 和 `prefix` 控制 cache 文件名。
- `raw gnuplot` 直接传 gnuplot commands。

当前 TikZKit 行为：

- `buildPlotFunction` 不调用外部 gnuplot。
- 它用 JS/pgfmath 对 expression sampling，默认 variable 是 `x`。
- 支持 `domain`、`samples`、常见 math functions、变量替换和当前 transform。
- 支持 `ycomb` / `xcomb` handler 的 function samples。

当前缺口：

- 这不是完整 gnuplot 语义，`raw gnuplot`、cache files、shell escape 都未实现。
- `parametric` function 未按 gnuplot formula 拆成 x/y。
- `range` / `yrange` / `xrange` 没有作为 outlier break 处理。
- `id` / `prefix` 目前主要是解析保留，未用于 cache。
- `function{...}` 中 gnuplot 语法与 PGF math 语法不同，当前会按 JS/PGF math 近似解释。

浏览器实现建议：

- 默认继续禁止外部命令。
- 为 corpus/native QA 可以离线生成 `.table` 或 tikztosvg/MacTeX 参考。
- core runtime 优先实现 deterministic JS sampling 与 explicit diagnostics。

## Plot Marks

常用语法：

```tex
\draw plot[mark=x] coordinates{(0,0) (1,1)};
\draw plot[mark=*,mark repeat=3,mark phase=6] file {data.table};
\draw plot[mark indices={1,4,...,10},smooth] coordinates{...};
```

关键 keys：

- `mark=<mnemonic>`。
- `mark repeat=<r>`。
- `mark phase=<p>`。
- `mark indices=<list>`。
- `mark size=<dimension>`。
- `every mark`。
- `mark options=<options>`。
- `no marks` / `no markers`。

默认 marks：

- `*`: filled circle。
- `+`: plus。
- `x`: cross。
- `o`: open circle。
- `plotmarks` library 增加更多 mark catalog。

当前代码：

- `src/libraries/plotmarks.js` 标记为 partial。
- `src/interpreter.js:buildPlotMark` 支持 `*`、`.`、`o`、`+`、`|`、`-`、`square`、`square*`、`triangle`、`triangle*`，其他 fallback 为 `x`。
- `mark size` 支持。
- `plotCoordinates` 会对每个 point 生成 mark。

当前缺口：

- `mark repeat`、`mark phase`、`mark indices` 未完整实现。
- `every mark`、`mark options` 未完整作为 style cascade。
- `only marks` 应禁止 plot path segments，目前需要验收或补齐。
- marks 应在整条 path draw/fill/shade 后绘制；当前作为额外 shapes 近似，需要关注 layering。
- `ball` mark 和完整 `plotmarks` catalog 未实现。

## Plot Handlers

Section 22 定义了多种 plot handler：

- `sharp plot`: 默认 straight lines。
- `smooth`: 用平滑曲线连接 points。
- `tension=<value>`: 控制 smooth tightness。
- `smooth cycle`: 闭合 smooth curve。
- `const plot` / `const plot mark left/right/mid`。
- `jump mark left/right/mid`。
- `ycomb` / `xcomb` / `polar comb`。
- `ybar` / `xbar`。
- `ybar interval` / `xbar interval`。
- `only marks`。

当前代码：

- sharp line plot 是默认。
- `smooth` 对 coordinates/function samples 使用 `smoothPlotCoordinateCommands`。
- `tension` 参与 smooth factor。
- `ycomb` / `xcomb` 对 function samples 有支持。
- pgfplots `axis` 预处理里另有 axis-level bar/comb/mark 近似。

当前缺口：

- `smooth cycle` 未完整实现。
- `const plot`、`const plot mark left/right/mid` 未实现。
- `jump mark left/right/mid` 未实现。
- `polar comb` 未实现。
- `ycomb` / `xcomb` 对 inline coordinates 需要统一处理。
- `ybar` / `xbar` / interval bars 未作为 core TikZ plot handler 实现。
- `bar width` / `bar shift` 属于 plothandlers library 的参数，需要独立记录和实现。
- handler 应先从 point list 生成 geometry，再走同一套 path action，否则 fill/bbox/marks layering 会不一致。

## PGFPlots Boundary

用户常见代码：

```tex
\usepackage{pgfplots}
\begin{axis}[domain=0:1,samples=50]
  \addplot[color=blue]{x};
  \addplot[color=red]{-x*ln(x)};
\end{axis}
```

这不是 Section 22 的 `plot` operation，而是 package `pgfplots`：

- `axis` 负责坐标轴、ticks、labels、legend、scale。
- `\addplot` 负责数据或函数。
- 最终可以被 TikZKit 预处理成普通 TikZ paths/nodes。

当前代码：

- `src/packages/pgfplots.js` 标记 package 为 partial。
- `src/preprocess.js:expandPgfplotsAxes` 是主要实现入口。
- `src/commands/axis.js` 和 `src/commands/addplot.js` 记录当前命令能力。

实现原则：

- 修原生 `plot` 时改 `parser/interpreter`。
- 修 `axis` / `\addplot` 时改 `preprocess` 和 `commands/axis.js` / `commands/addplot.js`。
- 两者共享 sampling、plot handler、plot mark 的底层工具，避免两套曲线采样算法越走越远。

## Current TikZKit Gap Summary

已支持或部分支持：

- `plot coordinates{...}`。
- `plot (<coordinate expression>)`。
- `plot function{...}` 的 JS sampling 近似。
- `domain`、`samples`、`variable`。
- `smooth`、`tension` 子集。
- `mark=x/+/*/o` 和 square/triangle 子集。
- `mark size`。
- function `ycomb` / `xcomb`。
- pgfplots `axis` / `addplot` package 子集。

主要未支持或 partial：

- `-- plot` vs `plot` 的 explicit continuation parity。
- `plot file{...}`。
- `samples at`。
- gnuplot cache/id/prefix/raw gnuplot。
- `parametric` function。
- `range` / `yrange` / `xrange` outlier breaks。
- `every plot`。
- mark repeat/phase/indices/every mark/mark options/no marks。
- smooth cycle、const plot、jump plot、polar comb。
- core ybar/xbar/interval bars。
- full plotmarks catalog。

## Implementation Slices

### 1. Point Provider Abstraction

目标：统一 inline coordinates、file table、coordinate expression、function sampling。

输出：

```js
{
  points: [{ x, y, sourceX, sourceY }],
  breaks: [index],
  outliers: [index],
  undefineds: [index]
}
```

### 2. Samples At Parser

目标：

- 支持 `samples at={1,2,8,9}`。
- 支持 `1,4,...,10`。
- `samples at` 覆盖 `samples/domain`。

### 3. Plot File Source

目标：

- parser 支持 `plot file {name}`。
- preprocessor 或 runtime 从允许目录读 table。
- `#` / `%` / empty / `o` / `u` 生成 breaks。

浏览器安全：

- 默认不随意读任意路径。
- corpus/gallery 可以预注册 table content。

### 4. Plot Handler Module

建议新增：

```text
src/plots/points.js
src/plots/handlers.js
src/plots/marks.js
src/plots/function-sampler.js
```

先迁移：

- sharp。
- smooth/tension。
- ycomb/xcomb。
- marks。

再补：

- const/jump。
- smooth cycle。
- polar comb。
- ybar/xbar/interval bars。

### 5. Mark Cadence

实现：

- `mark repeat`。
- `mark phase`。
- `mark indices`。
- `no marks/no markers`。
- `only marks`。

### 6. Function Sampling Boundary

目标：

- 保留 JS sampling。
- 对 `raw gnuplot` 生成 warning diagnostic。
- 对 `parametric` 实现 common `function{fx,fy}` sampling。
- 对 `range/xrange/yrange` 实现 point filtering + path breaks。

### 7. PGFPlots Sharing

目标：

- `\addplot` function sampling 复用 Section 22 sampler。
- `axis` plot handlers 复用 Section 22 handlers。
- pgfplots 只负责 axis coordinate transform、ticks、legend、labels。

## Case Notes

- Case 181: `\addplot[color=blue]{x}; \addplot[color=red]{-x*ln(x)};` 属于 pgfplots package，不是 core TikZ `plot`。如果曲线缺失，先查 `src/preprocess.js:parseAddplots` / expression sampler。
- Plot 10 曲线不够圆滑：优先检查 `smooth` handler、samples 数量和 tension；不要只加 CSS 或 SVG scale。
- Function-heavy corpus cases: 如果 native/tikztosvg 使用 gnuplot/table，而 TikZKit 用 JS sampling，必须保存 samples/domain/range 信息，避免曲线形状、断点、端点处理偏差。
- Plotmarks cases: 缺 mark cadence 时，图形整体可能“点太多/太少”，视觉 diff 不一定大，但语义明显错。
