# Hierarchical Structures

来源：TikZ manual section 12, `Package, Environments, Scopes, and Styles`。

这一节的核心不是某一个绘图命令，而是 TikZ 的层级模型。很多“位置不稳”“样式泄漏”“默认样式没生效”的问题，本质上都来自层级和 option 生效范围没有模拟对。

## 层级模型

TikZ 文件可以按下面的栈理解：

```text
TeX document
-> \usepackage{tikz}
-> \usetikzlibrary{...}
-> tikzpicture
-> scope
-> path command
-> path operation / node / pic / edge
```

每一层都可以带 options，但 package 层除外。越内层越具体，通常应覆盖外层。

## Package And Libraries

```tex
\usepackage{tikz}
\usetikzlibrary{arrows.meta,positioning,calc}
```

TikZ package 会加载 PGF 和 `pgffor`。`\usetikzlibrary{foo}` 的真实机制是尝试加载：

```text
tikzlibraryfoo.code.tex
pgflibraryfoo.code.tex
```

对 TikZKit 的含义：

- `src/packages/tikz.js` 应代表 package 层入口。
- `src/libraries/<name>.js` 应代表 `\usetikzlibrary{name}` 的语义兼容层。
- 同一个 library 重复加载应是 no-op，不应重复注入样式或命令。
- 未实现 library 必须进入 registry/diagnostics，而不能静默吞掉。

## Picture

`tikzpicture` 是 TikZ 的最外层图形 scope。

```tex
\begin{tikzpicture}[ultra thick, every node/.style={draw}]
  \draw (0,0) -- (1,0);
\end{tikzpicture}
```

图级 options 应成为整张图的默认上下文，影响内部 path、node、matrix、pic 等。图结束后这些 options 应失效。

两个特殊样式很关键：

```tex
\tikzset{every picture/.style={line width=1pt}}
```

`every picture` 会在每张图开始时安装。它不是普通全局 option，而是图级默认样式入口。TikZKit 不能把 `\tikzset{line width=1pt}` 当成“全局默认线宽”的唯一方式，真实 TikZ 推荐通过 `every picture` 设置。

## Bounding Box

PGF 的 bbox 主要靠遇到坐标时持续扩展得到，是一个近似模型：

- 线宽对斜线 bbox 的影响可能不完全准确。
- Bezier 控制点可能在曲线外部，会让 bbox 过大。
- `use as bounding box` 可以手动指定 bbox。

对 TikZKit 的含义：

- renderer 的 viewBox 不能只看 path 端点，还要考虑 node box、line width、marker、foreignObject/math box。
- 对比 MacTeX 时，bbox 差异会导致整张图缩放/偏移，看起来像坐标错。
- 网格对比应基于 TikZ unit，而不是最终 SVG 像素。

## Baseline

```tex
\tikz[baseline=(X.base)] \node (X) {world};
```

`baseline` 影响图片作为 inline box 时和周围文字的垂直对齐。它可以是 dimension，也可以是 picture 结束后才求值的 coordinate。

TikZKit 当前重点是独立 SVG 渲染；但如果后续要像 KaTeX 一样 inline 嵌入网页，baseline 必须进入 IR 或 renderer metadata。

## Begin/End Hooks

```tex
\begin{tikzpicture}[
  execute at begin picture={...},
  execute at end picture={...}
]
```

这些 hook 只能在 `tikzpicture` options 上真正影响当前图；多次设置会累积。TikZ 常用它们实现 `every picture`、background 等机制。

TikZKit 建议：

- 先把常见 hook 记录为 diagnostics/registry capability。
- 对 `backgrounds`、bbox frame、grid overlay 这类真实需求，可以把 hook 编译成 IR background items。

## Scope

```tex
\begin{scope}[red]
  \draw (0,0) -- (1,0);
\end{scope}
```

scope options 只影响内部内容。clip path、transform、style、font 都应局部化。

```tex
\tikzset{every scope/.style={blue,thick}}
```

`every scope` 会在每个 scope 开始时安装。它不能泄漏到外层，也不能影响 scope 之前的 path。

## Scopes Library

`scopes` library 允许这种简写：

```tex
\usetikzlibrary{scopes}
\begin{tikzpicture}
  { [ultra thick]
    \draw (0,0) -- (1,0);
  }
\end{tikzpicture}
```

只有在特定位置且 `{` 后紧跟 `[...]` 时，它才代表 scope。否则只是普通 TeX group。

TikZKit 当前需要把它作为 parser/preprocess 层能力处理，而不是 renderer 层能力。

## Single-command Scope

```tex
\scoped[on background layer]
  \draw (0,0) grid (3,2);
```

`\scoped` 等价于把后续单个 path command 包进一个临时 scope。它常见于 background layer 或 graph drawing 相关代码。

## Options Processing Order

TikZ 处理 option key 的顺序可以压缩为：

```text
absolute key starting with /
-> /tikz/<key>
-> /pgf/<key>
-> color shorthand
-> arrow shorthand containing dash
-> shape shorthand
-> error / diagnostic
```

这解释了为什么：

```tex
[red, ->, circle]
```

分别会变成 color、arrow、shape，而不是三个普通 boolean。

## Styles

```tex
block/.style={rectangle,draw,fill=blue!20}
block/.append style={rounded corners}
block/.prefix style={font=\small}
outline/.style={draw=#1,fill=#1!50}
outline/.default=black
```

实现要点：

- `/.style` 是定义，不应作为普通绘图 option 继续传递。
- `/.append style` 后追加，后面的 key 最终 wins。
- `/.prefix style` 前追加，原 style 后续可以覆盖它。
- 参数化 style 使用 `#1` 替换。
- `/.default` 让 `[outline]` 等价于 `[outline=black]`。

## TikZKit Implementation Notes

本节已经对应一次小修复：

- `every picture`：在解释每张 picture 时自动插入到 picture options 前面。
- `every scope`：在解释 scope 时自动插入到 scope options 前面，且只影响该 scope 内部。

对应测试：

```text
test/hierarchical-structures.test.js
```

后续还应补：

- `baseline=(coordinate)` 的 inline metadata。
- `execute at begin picture` / `execute at end picture` 的最小 hook 模型。
- `\scoped[...]` parser 支持。
- `scopes` library 的 `{ [options] ... }` 语法。
