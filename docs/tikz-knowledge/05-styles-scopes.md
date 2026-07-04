# Styles And Scopes

TikZ 通过 key-value options 管理大多数图形参数。理解 option 合并顺序，是避免 case-by-case 修补的关键。

## Key-value options

```tex
\draw[line width=2pt,color=red] (1,0) -- (0,0);
\node[rectangle,draw,fill=blue!20,text width=5em] {Text};
```

常见类型：

- boolean style: `draw`, `fill`, `circle`, `rounded corners`
- value style: `line width=2pt`, `fill=red!20`, `text width=5em`
- shorthand style: `red`, `thick`, `dashed`, `->`
- style reference: `block`, `line`, `every node`
- style definition: `name/.style={...}`

## `\tikzset`

```tex
\tikzset{
  block/.style={rectangle, draw, fill=blue!20, text width=5em},
  line/.style={draw, -latex'}
}
```

解释器需要把 style definition 注册到 style table。后续 option 遇到 `block` 时展开。

## `\tikzstyle`

```tex
\tikzstyle{block} = [rectangle, draw, fill=blue!20]
```

这是旧语法，但真实案例很多。语义上接近：

```tex
\tikzset{block/.style={rectangle, draw, fill=blue!20}}
```

## Scope

```tex
\begin{scope}[color=red]
  \draw (0,0) -- (1,0);
\end{scope}
```

scope options 应只影响内部 statement。嵌套 scope 可以覆盖外层参数。

`tikzpicture[...]` 本身也类似 scope：

```tex
\begin{tikzpicture}[>=Stealth, font=\tt, vtx/.style={circle, draw}]
...
\end{tikzpicture}
```

## 合并顺序建议

一个 practical 顺序：

```text
built-in defaults
-> library defaults
-> picture options
-> outer scope options
-> command options
-> inline operation options
```

style expansion 要注意递归和循环保护。

## 实现检查清单

- `draw=red` 与 `red` 都应变成 stroke red。
- `fill=blue!20` 需要走 xcolor mix。
- `font=\huge\bf` 要影响 text metrics 和 renderer。
- `text centered`、`align=center` 要进入文本布局。
- `nodes={...}` 这种 matrix/node collection style 不能当普通字符串吞掉。
