# Section 24 - Decorated Paths

本节记录 TikZ decorations 的语义和 TikZKit 的实现边界。Decoration 的核心不是“给线条加一个样式”，而是用已经构造好的 path 作为输入，生成新的 path、替换 path，或沿 path 产生副作用。

## Mental Model

```text
original path geometry
-> flatten / parameterize by arc length
-> choose decoration engine
-> morph / replace / remove
-> feed resulting geometry or side effects into path actions
```

Decoration 必须发生在 path 被 draw/fill/shade/clip 使用之前。它与 arrow shortening、dash、preaction/postaction、node background path 和 path length 参数化紧密相关。

## Three Decoration Kinds

TikZ 手册把 decorations 分为三类：

1. Path morphing decorations
   - 原 path 被变形成拓扑相近的新 path。
   - 典型例子：`snake`、`zigzag`、`bumps`、`random steps`。
   - 常见库：`decorations.pathmorphing`、旧 `snakes`。

2. Path replacing decorations
   - 原 path 被完全替换成另一组 path。
   - 典型例子：`brace`、`crosses`、`ticks`、shape decorations。
   - 常见库：`decorations.pathreplacing`、`decorations.shapes`。

3. Path removing decorations
   - 原 path 被移除，不再作为 draw/fill 的几何对象。
   - decoration 通过副作用输出 text、nodes、marks 等。
   - 典型例子：`text along path`、部分 markings。
   - 常见库：`decorations.text`、`decorations.markings`。

TikZKit 后续实现时必须把这三类分开建模。用同一个 `path.commands = decoratedCommands` 不足以表达 text along path、markings 和 scope side effects。

## Library Loading

基础入口：

```tex
\usetikzlibrary{decorations}
```

`decorations` 只提供公共 key 和机制，不定义具体 decoration。具体 decoration 来自：

- `decorations.pathmorphing`
- `decorations.pathreplacing`
- `decorations.shapes`
- `decorations.text`
- `decorations.markings`
- `decorations.fractals`

TikZKit 当前状态：

- `src/libraries/decorations.js` 标记 builtin，指向 markings subset。
- `src/libraries/decorations.markings.js` 标记 builtin。
- `src/libraries/decorations.pathmorphing.js` 标记 builtin，支持 snake/zigzag 近似。
- `src/libraries/decorations.pathreplacing.js` 标记 partial，支持 brace 子集。
- `src/libraries/decorations.text.js` 标记 partial，支持 text along path 子集。
- `src/libraries/snakes.js` 标记 builtin，用于旧 snakes 兼容。
- `decorations.shapes`、`decorations.fractals` 尚未作为 observed library 文件出现。

## Selecting a Decoration

相关 key：

- `/pgf/decoration=<decoration options>`
- `/tikz/decoration=<decoration options>` alias
- `/pgf/decoration/name=<name>`

重要规则：

- `decoration={...}` 只选择 decoration 和参数，不会自动执行。
- 真正执行 decoration 需要 `decorate` option 或 `decorate {...}` path operation。
- `decoration=zigzag` 等价于 `decoration={name=zigzag}`。
- 未知 key 会被尝试解释成 decoration name。
- picture/scope 级 `decoration=...` 是默认值，path-local decoration 应覆盖它。

TikZKit 当前状态：

- `src/options.js` / `parseOptions` 能把 `decoration={...}` 保留下来。
- `src/interpreter.js:applyPathMorphing` 会解析 path options 的 `decoration`。
- 目前更偏向完整 path 的 `[decorate, decoration=...]`，不是完整 path operation stream。

## Decorating a Subpath

TikZ 通用语法：

```tex
\path ... decorate[options] { subpath } ...;
```

语义：

- 只装饰 `{subpath}`。
- 子路径可以包含 line、curve、rectangle、arc、circle、ellipse、node，甚至嵌套 decorate。
- decoration 结束后，外层 path construction 继续。
- removing decoration 不一定把几何加入主 path，但可能产生 text/nodes/marks。

TikZKit 当前缺口：

- `decorate {subpath}` 没有独立 parser/IR operation。
- nested decorate 未作为通用语义实现。
- 子路径内 nodes 的创建、命名和 bbox 还没有 decoration-aware path operation 模型。
- text along path 目前主要从完整 path options 触发。

建议实现：

- parser 增加 `decorate` segment：`{ type: "decorate", options, subpathSegments }`。
- interpreter 对 subpath 先构建临时 geometry，再运行 decoration engine。
- morphing/replacing 输出 geometry 回到主 path。
- removing 输出 side-effect IR items，但不更新主 path geometry，除非 decoration 明确定义 continuation。

## Decorating a Complete Path

TikZ option：

```tex
/tikz/decorate=<boolean>
```

语义：

- `\path decorate[options]{path}` 与 `\path[decorate, options] path` 在完整 path 场景下等价。
- 这个 option 可以用于 node background path，例如 decorated ellipse/circle/rectangle。
- node background path 用 `decorate` 只能装饰一次。
- 对 removing decorations，常用 `preaction` / `postaction` 让主 path 仍然被 draw/fill，再额外加 decoration side effect。

TikZKit 当前状态：

- `src/interpreter.js:decoratedShape` 会对 node shape background path 做 decoration 包装。
- `src/interpreter.js:applyPathMorphing` 支持完整 path 的 snake/zigzag/brace。
- `src/interpreter.js:addDecorationTextItems` 支持完整 path 的 text along path side effect。
- `src/interpreter.js:addDecorationMarkers` 支持 markings 的 arrow marks subset。

## Positioning Options

Decoration 相对原 path 的位置由这些 key 控制：

- `raise=<dimension>`
- `mirror=<boolean>`
- `transform=<transformations>`

语义：

- `raise` 是沿 path 前进方向左侧的法线偏移；负值在右侧。
- `mirror` 沿 path 镜像 decoration。
- `transform` 先于 raise/mirror 作用在 decoration segment 上，例如 `transform={shift only}`。

TikZKit 当前状态：

- brace 支持 `raise`、`mirror`、`amplitude`、`aspect`。
- text along path 支持 `raise`。
- snake/zigzag 当前未完整支持 `raise`、`mirror`、`transform`。
- shape decorations 的 `transform={shift only}` 尚未支持。

## Pre/Post Length

Decoration 可以在路径开头或结尾留出一段不装饰区域：

- `pre=<decoration>`
- `pre length=<dimension>`
- `post=<decoration>`
- `post length=<dimension>`

语义：

- 默认 `pre` / `post` 是 `lineto`。
- `pre length=0pt` 或 `post length=0pt` 表示没有对应预留段。
- 对曲线路径，默认 `lineto` 不沿曲线；需要 `pre=curveto` 才会贴曲线。
- 箭头 tip shortening 与 decoration 的 post length 必须协同，否则箭头附近会多出或少出一截波浪。

TikZKit 当前状态：

- snake/zigzag 支持 `pre length`、`post length` 的基础路径长度切分。
- `applyPathMorphing` 会把 arrow endpoint shortening 也计入 pre/post 区间。
- `pre=lineto`、`pre=moveto`、`pre=curveto`、`post=...` 的 decoration type 还没有完整实现。
- 对曲线的 morphing 通过 flatten path 近似。

## Current TikZKit Gap Summary

已支持或 partial：

- `[decorate, decoration={snake,...}]`。
- `[decorate, decoration={zigzag,...}]`。
- `[decorate, decoration={brace, mirror, raise, amplitude, aspect}]`。
- `decoration={text along path, text=..., raise=...}` 的 midpoint tangent 近似。
- `decorations.markings` 的 `mark=at position ... with {\arrow{...}}`。
- `decorations.markings` 的 `mark=between positions ... step ... with {\arrow{...}}`。
- node background path decoration 的部分包装。
- arrow shortening 与 snake post length 的部分协调。

缺失或不足：

- `decorate[options]{subpath}` path operation。
- nested decorate。
- decorations.shapes：`crosses`、`ticks`、`triangles`、shape backgrounds。
- decorations.fractals：`Koch snowflake` 等。
- pathmorphing catalog：`coil`、`bumps`、`random steps`、`saw`、`expanding waves` 等。
- path replacing catalog：brace 以外的 replacements。
- removing decorations 的通用 side-effect 模型。
- `raise` / `mirror` / `transform` 在所有 decoration 类型上的统一实现。
- `pre` / `post` decoration type，不只是 length。
- decoration scope defaults 和 path-local override 的完整顺序。
- decoration 后的 bbox 计算和 native/tikztosvg 对齐。
- decorations.shapes / fractals library 文件和 registry。

## Implementation Plan

1. Build a decoration engine interface
   - 输入：normalized path geometry、decoration options、path style、env。
   - 输出：`{ geometry, sideEffects, removesPath, bbox }`。
   - morphing/replacing/removing 必须用同一接口。

2. Add parser support for decorate path operation
   - 支持 `decorate[options]{...}` segment。
   - 允许嵌套。
   - 子路径内 nodes 仍要按 TikZ path semantics 创建。

3. Move existing code out of `interpreter.js`
   - `src/libraries/decorations.pathmorphing.js`: snake/zigzag/coil/bumps/random steps。
   - `src/libraries/decorations.pathreplacing.js`: brace/ticks/crosses。
   - `src/libraries/decorations.text.js`: text along path。
   - `src/libraries/decorations.markings.js`: path marks and arrows。

4. Standardize path length parameterization
   - decorations、markings、arrow shortening、sloped labels、text along path 共用同一 path sampler。
   - 曲线统一 flatten tolerance。
   - 保留 distance、tangent、normal、segment boundary 信息。

5. Implement library catalog incrementally
   - pathmorphing: snake、zigzag、coil、bumps、random steps、saw。
   - pathreplacing/shapes: brace、ticks、crosses、triangles。
   - text: real text glyph repetition along path，而不是只放 midpoint label。
   - fractals: Koch snowflake as path replacement recursion.

## Visual QA Notes

Decorations 的验收必须看视觉：

- wave/zigzag 是否从正确的 active start 到 active end。
- pre/post length 是否留白正确，尤其靠近 arrow tip。
- brace 的 cusp、mirror、raise、amplitude 是否对齐 native。
- text along path 是否沿曲线分布，而不是只在中点。
- removing decoration 是否保留或移除原 path 的 draw/fill。
- node background decoration 是否作用在 shape boundary 而不是 text box。
- nested decorate 后的 bbox 是否包含二次 decoration。

## Case Notes

- Case 005: `snake` + `-stealth` + `post length` 说明 decoration active length 与 arrow shortening 必须共享 path sampler。
- feynman/feynhand photon/boson lines: snake/wavy path 和 markings/momentum arrow 必须可叠加，不能互相覆盖。
- `text along path` 类 case：当前 midpoint tangent 近似可以出图，但与 native 的逐字沿路径仍有明显差距。
