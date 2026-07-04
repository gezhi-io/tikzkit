# Section 18 - Pics

这份记录对应 TikZ manual section 18。`pic` 是 small picture on path：它可以出现在 node 可以出现的位置，但语义上不是 node。它更接近“在当前路径位置临时展开一段 TikZ 代码的内部 scope”。

## Web Renderer Thesis

TikZKit 不能把 `pic` 当成一个单独 SVG group 就结束。真正要实现的是：

```text
encounter pic
-> suspend current path
-> compute pic origin from current path point / at / pos
-> start internal scope
-> install every pic and pic-local options
-> resolve pic type into /tikz/pics/code
-> execute that TikZ code with translated coordinate system
-> merge generated paths/nodes into current picture
-> resume outer path without changing it
```

核心差异：

- Node 是可引用对象；pic 自身通常不可引用。
- Pic 内部可以定义 nodes/coordinates，这些内部名字可以通过 pic name prefix 暴露给外部。
- Pic 不修改当前 path；它像 node 一样是 path operation 的外部副产物。
- Pic code 可以包含任意 TikZ code，因此本质是解释器的“可复用宏展开 + 局部 scope”问题。

## Pic Syntax

基础语法：

```tex
\pic at (1,0) {seagull};
\path (2,1) pic {seagull};
\pic[rotate=30] {seagull};
\pic (Name) at (0,0) {seagull};
\pic[pic type=seagull];
```

规则：

- `\pic` 是 `\path pic` 的快捷方式。
- path 内 `pic` 可以出现在 node 可以出现的位置。
- `pic` 与 node 类似，`foreach`、options、name、`at`、animation attribute 和 pic type 的顺序大多可交换。
- `pic type=<type>` 可替代 `{<type>}`，行为类似 `node contents`。
- `pic` 不改变当前 path；其内部绘制独立于外层 path。

当前代码：

- `src/parser.js:parsePic`
- `src/parser.js:parsePathPicSegment`
- `src/interpreter.js:createPic`

当前状态：

- 独立 `\pic[options] (name) at (...) {body}` 有基础解析。
- path 内 `pic [options] {body}` 有基础解析。
- order 仍偏固定，未覆盖 TikZ 允许的任意顺序。
- 未完整支持 `foreach` pic spec、`pic type=...` 直接结束解析、animation attribute。
- path 内 generic pic 目前主要服务 `angle` 特例；完整 custom pic on path 仍需补齐。

## Pic Placement And Transform

Pic 的“位置”不是 node anchor，而是内部坐标系原点：

```tex
\path (2,1) pic {seagull};
\pic at (1,0) {seagull};
\pic [at={(3,2)}] {seagull};
```

规则：

- 没有 `at` 时，pic 放在当前 path 最后位置。
- 有 `at` 时，内部 scope 原点平移到该坐标。
- 和 node 类似，默认会重置外部 coordinate transformation；`transform shape` 时外部 transform 也作用到 pic。
- pic 自身 options 中的 `scale`、`rotate` 等 transform 总是作用于 pic。
- path 上的 `pic [near start]`、`pic [sloped, near end]` 应复用 path label 的 `pos` / `sloped` 逻辑。

当前代码：

- `src/interpreter.js:picOrigin`
- `src/interpreter.js:createCustomPic`
- `src/interpreter.js:buildAnglePic`

当前状态：

- 独立 pic 的 `at` 与 positioning 近似可用。
- custom pic 展开时会用 origin 平移 child env。
- `rotate` / `scale` / `transform shape` 对 generic custom pic 的完整 TikZ 语义仍是 partial。
- path pic 的 `pos` / `sloped` 通用实现还缺，angle pic 是专门路径。

## Pic Type And Code Resolution

Pic type 不是直接函数名，而是一组 `/tikz/pics/...` keys：

```tex
\tikzset{
  pics/seagull/.style={
    code={\draw (-3mm,0) to[bend left] (0,0) to[bend left] (3mm,0);}
  }
}

\tikzset{
  seagull/.pic={
    \draw (-3mm,0) to[bend left] (0,0) to[bend left] (3mm,0);
  }
}
```

规则：

- `pic {seagull}` 会执行 `/tikz/pics/seagull`。
- 常见 `.pic` handler 会把 `/tikz/seagull/.pic={...}` 转成 `/tikz/pics/seagull/.style={code={...}}`。
- `/tikz/pics/code` 存储真正要执行的 TikZ code。
- `pics/code={...}` 可以直接出现在 pic options 中，pic type 为空也能执行。
- `pics/<name>/.style={code={...}}` 支持参数和更复杂的 foreground/background code。

当前代码：

- `src/parser.js:collectPicDefinitions`
- `src/parser.js:parseTikzPics`
- `src/interpreter.js:picDefinitionsFromOptions`
- `src/interpreter.js:createCustomPic`

当前状态：

- 支持 `name/.pic={...}` 形式的简单 pic definition。
- `createCustomPic` 会把 pic body 解析为 statements 并在 translated child env 中解释。
- `pics/<name>/.style={code={...}}`、`pics/code={...}`、带参数的 style code、foreground/background code 尚未完整实现。

## Pic Actions

`pic actions` 是 pic code 与调用方 draw/fill/shade/clip 的桥：

```tex
\tikzset{
  my pic/.pic={
    \path[pic actions] (0,0) circle[radius=3mm];
    \draw (-3mm,-3mm) rectangle (3mm,3mm);
  }
}

\pic[fill=red!50] {my pic};
```

规则：

- Pic 外层 options 中的 action keys 不会自动影响 pic 内所有 path。
- 只有 pic code 中显式使用 `[pic actions]` 的 path 才使用调用方的 draw/fill/shade/clip action。
- 普通 `\draw` / `\fill` 在 pic code 中仍按自身 action 执行。

当前代码：

- `src/interpreter.js:createCustomPic` 把 `"pic actions"` style 设置为 `statement.options`。
- `test/interpreter.test.js` 已覆盖 `marker/.pic` 中 `pic actions` 的基础案例。

当前状态：

- 基础 `pic actions` style 已有近似。
- 仍需确认 draw/fill/shade/clip 的 action 传递只影响 `[pic actions]`，不能泄漏到 pic 内普通 path。

## Ordering And Layers

Pic 与 node 一样可被放在 path 前后：

```tex
\fill
  (1,1)
  -- (2,2) pic[behind path] {seagull}
  -- (3,2) pic {seagull};
```

规则：

- 同一条 path 上，先绘制所有 `behind path` node/pic。
- 然后绘制 path 本身。
- 最后绘制 front node/pic。
- Pic type 还可以提供 `/tikz/pics/background code` 与 `/tikz/pics/foreground code`，即使调用方设置 behind/front，也要按 TikZ 规则拆层。

当前状态：

- Node/pic 的 behind/front ordering 还没有完整统一。
- `/tikz/pics/background code` 和 `/tikz/pics/foreground code` 未实现。
- 这会影响 angle marker、decorative marks、复杂 component pic 与外层 path 的图层一致性。

## Foreach And Every Pic

Pic spec 可直接带 foreach：

```tex
\pic foreach \x in {1,2,3} at (\x,0) {seagull};
\begin{tikzpicture}[every pic/.style={scale=2,transform shape}]
  \pic foreach \x in {1,2,3} at (\x,0) {seagull};
\end{tikzpicture}
```

规则：

- `pic foreach` 的语义与 `node foreach` 类似。
- `every pic` 在每个 pic 开始时安装。
- `every pic` 应早于 pic-local options，允许局部 options 覆盖默认。

当前状态：

- 全局 foreach expansion 已有，但 pic spec 内 foreach 未系统实现。
- `every pic` 未记录为完整支持；需要在 `createPic` 前统一合并。

## Name Scopes

Pic 的名字不是给 pic 自身建一个可连接 node，而是设置内部 `name prefix`：

```tex
\tikzset{
  seagull/.pic={
    \coordinate (-left wing) at (-3mm,0);
    \coordinate (-right wing) at (3mm,0);
  }
}

\pic (Emma) {seagull};
\draw (Emma-left wing) -- (Emma-right wing);
```

规则：

- `\pic (Emma) {seagull}` 会在 pic 内设置 `name prefix=Emma`。
- Pic 内部以 `-` 开头的 node/coordinate 名称会变成 `Emma-...`。
- Pic 内如需访问外部 node，可用 `name prefix ..` 临时恢复外层 prefix。

当前代码：

- `src/interpreter.js:createCustomPic` 设置 `picNamePrefix`。
- `src/interpreter.js:resolvePicScopedName` 处理以 `-` 开头的 name。

当前状态：

- 基础 `-anchor` 前缀化已实现，用于 PetarV cube 等。
- `name prefix ..`、任意 name prefix/suffix 与 nested pic prefix stack 仍需补齐。

## Pic Text And Quotes

Pic 可以通过 `pic text` 与 `pic text options` 接收一段文本：

```tex
\pic ["$\alpha$"] {angle};
```

Quotes library 会把 pic options 中的 quoted key 转成：

```tex
every pic quotes/.try,
pic text=<text>,
pic text options={<options>}
```

规则：

- 对 node，quotes 常用于 label。
- 对 pic，quotes 设置 `pic text`，是否使用该文本取决于 pic type。
- `angle` pic 是典型使用者。
- `every pic quotes` 是 quotes syntax 的 hook。

当前代码：

- `src/interpreter.js:anglePicQuote`
- `src/interpreter.js:anglePicLabelNode`
- `src/libraries/quotes.js`

当前状态：

- Angle pic 支持 `"$\alpha$"` 这种直接 quoted option 的特例。
- 尚未通用实现 `pic text` / `pic text options` / `every pic quotes`。
- `src/libraries/quotes.js` 当前只声明 edge labels，应该扩展为 node/edge/pic quotes 的统一入口。

## Angle Pic Implication

用户当前示例：

```tex
\usetikzlibrary {angles,calc,quotes}
...
pic ["$\alpha$", draw, fill=yellow] {angle = F--X--A}
```

真正依赖的能力：

- `calc`: `$(D)!.5!(B)$` 插值坐标。
- `intersections`: `intersection cs:first line=..., second line=...`。
- `angles`: `pic {angle=A--B--C}` 解析与绘制。
- `quotes`: `"$\alpha$"` -> `pic text`。
- Pic placement/layering: angle pic 是 path operation，不应破坏外层 path。
- Pic actions/style: `draw`、`fill=yellow` 作用在 angle arc/sector 上。

当前代码已经有 `buildAnglePic` 特例，能生成 `subtype: "angle-pic"` path 和 label，但 `src/libraries/angles.js` 仍标记为 unsupported。这个状态需要校准：要么把 angles library 模块升级为 partial，要么把 angle pic 实现迁移到该 library 文件。

## Implementation Slices

建议后续按功能族实现：

1. Pic parser parity：任意顺序、`pic type=...`、pic foreach、path pic name/at/options。
2. Pic definition registry：支持 `.pic`、`pics/name/.style={code=...}`、`pics/code`、参数化 pic style。
3. Pic scope execution：`every pic`、pic-local transforms、`transform shape`、action isolation。
4. Pic actions：严格实现 `[pic actions]` 对 draw/fill/shade/clip 的传递。
5. Pic layering：`behind path` / `in front of path`、foreground/background code。
6. Pic name scope：prefix stack、`name prefix ..`、nested pic。
7. Pic quotes：`pic text`、`pic text options`、`every pic quotes`，并让 angle pic 使用通用机制。
8. Library split：把 `angle` pic、TQFT pic、cube pic 从 `interpreter.js` 逐步迁移到 `src/libraries/angles.js`、`src/libraries/tqft.js` 或专门 pic modules。

## Case Notes

- `angles,calc,quotes` sample: 需要 `angle` pic 走通用 pic text，而不是只扫 quoted option。
- PetarV cube pic: 当前验证了 `picNamePrefix` 和内部 anchors 的必要性。
- Marker pic with `pic actions`: 说明 pic code 中 `[pic actions]` 才应继承调用方 fill/draw。
