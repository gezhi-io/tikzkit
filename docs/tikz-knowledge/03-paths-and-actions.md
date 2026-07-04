# Paths And Actions

TikZ 的主任务是描述 path，但 path 本身不等于“画出来”。必须区分 path specification 和 action。

## Path specification

```tex
(5pt,0pt) -- (0pt,0pt) -- (0pt,5pt) -- cycle
```

这只是几何骨架，包括：

- move
- line
- curve
- rectangle
- circle / ellipse
- arc
- grid
- close/cycle

第 14 节强调：path specification 是一条 path operation 流，不只是“坐标 + 连线”。任何 TikZ 期待 path operation 的位置，都可能出现：

```tex
[options]
node[...]{...}
pic {...}
edge[...](...)
```

因此 parser 不能只按 `--`、坐标、`circle` 拆；还必须保留 path-stream options。

## Path actions

```tex
\path[draw] (0,0) rectangle (2ex,1ex);
\draw (0,0) rectangle (2ex,1ex);
\fill (0,0) circle (1cm);
\filldraw (0,0) circle (1cm);
\shade (0,0) rectangle (1,1);
\clip (0,0) rectangle (1,1);
```

语义关系：

```text
\draw     = \path[draw]
\fill     = \path[fill]
\filldraw = \path[fill,draw]
\shade    = \path[shade]
\clip     = \path[clip]
```

## 为什么 `\path` 也可能可见

`path` 命令本身没有 `draw/fill`，但内部可能有可见操作：

```tex
\path
  (A) edge [red, thick] (B)
  pic ["$\alpha$", draw, fill=yellow] {angle = F--X--A};
```

这里：

- `edge [red, thick]` 应产生可见 path。
- `pic[..., draw, fill=...]` 应产生可见 angle pic。
- 外层 `\path` 只是容器，不能因为外层无 `draw` 就丢掉内部可见图元。

第 14 节还说明：只要 `draw` 或 `fill` 这类 action option 出现在 path 的任意位置，path 就应该可见：

```tex
\path (0,0) [draw, red] -- (1,0);
```

这等价于“path 流中出现了绘制 action”，不能因为命令是 `\path` 就丢掉。

## Path-stream options

```tex
\draw (0,0) -- (1,1)
      [color=red] -- (2,0)
      [color=blue] -- (3,0);
```

TikZ 把 path 中间的 `[options]` 分成两类：

- whole-path options: 例如 `color`、`draw`、`fill`，通常对整条 path 的最终 action/style 生效，外层最后一次 wins。
- immediate options: 例如 `rounded corners`、transform options，影响后续 path operation，可通过 `{ ... }` 做局部 scope。

当前 TikZKit 已实现的最小规则：

- parser 保留 path-stream `[options]` segment。
- `draw` / `fill` 出现在 path-stream 里会让 `\path` 可见。
- path-stream 中的颜色、线宽、dash、arrow 等会合并进最终 path style。

尚未完整实现：

- `rounded corners` / `sharp corners` 对后续 corner 的几何改写。
- path 内 `{[options] ...}` 的 current point 局部化。
- transform options 只影响后续坐标，而不是整条 path。

## `every path`

```tex
\begin{tikzpicture}[every path/.style={draw}]
  \path (0,0) -- (1,0);
\end{tikzpicture}
```

`every path` 会在每条 path 开始时安装。它常用于在一个 scope 内临时给所有 path 加 draw/fill/default style。

TikZKit 对应规则：

```text
picture/scope options
-> every path
-> command options
-> path-stream options
```

其中 command options 和 path-stream options 仍可覆盖 `every path`。

## `edge`

```tex
(A) edge [red, thick] (B)
```

`edge` 常见于 tree、graph、path 内部。解释器应当：

1. 从当前点出发。
2. 解析目标点。
3. 合并 edge options。
4. 若两端是 node，进行 border clipping。
5. 根据 arrow tip 做 shorten。
6. 独立生成可见 path。

## Inline node on path

```tex
\draw (0,0) -- node[above] {label} (1,0);
```

inline node 的位置依赖 path segment：

- 默认通常在 segment 中点附近。
- `above/below/left/right` 是相对 path 或画布方向的偏移。
- `pos=...`、`near start`、`near end` 会改变 segment parameter。

## 实现检查清单

- parser 不应在 `pic {angle = A--B--C}` 的 body 内误拆 `--`。
- parser 不应丢弃 path-stream `[options]`。
- `every path` 应在每条 path 开始时自动安装。
- `\path (0,0) [draw] -- (1,0);` 应可见。
- path 内 `edge` 应使用 draw 风格规范化，不应继承外层 `\path` 的 invisible style。
- `name path` 可以记录 invisible geometry，但不应渲染。
- decoration、arrow、dash 都应基于同一条最终 path geometry。

## Case Notes

- Section 14: 新增 `test/paths-section14.test.js`，覆盖 `every path` 和 path-stream `[draw, red, thick]`。当前先解决漏画/样式丢失，rounded corners 等后续做几何级实现。
