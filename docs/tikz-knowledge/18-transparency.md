# Section 23 - Transparency

本节记录 TikZ transparency 语义，以及它在 TikZKit Web/SVG 渲染中的落地方式。透明度不是单个 CSS 属性的问题，它涉及 path action、text/node、mask/fading、blend mode、scope graphic state 和 transparency group。

## Renderer Thesis

```text
TikZ opacity / fading / blend keys
-> option normalization
-> graphic state or item style
-> IR: path/text/group/mask metadata
-> SVG: opacity attributes, masks, isolated groups, blend modes
-> visual QA: native PNG / tikztosvg SVG / TikZKit SVG comparison
```

透明度必须按 TikZ 的绘制顺序理解：同一个半透明对象如果被画两次，重叠区域会更深；如果对象先在 transparency group 内合成，再整体半透明输出，重叠区域不会发生同样的自叠加。这是许多阴影、半透明填充、fading 和叠色图形视觉不一致的根因。

## Uniform Opacity

TikZ 支持不同通道的透明度：

- `opacity=<value>`: 通常同时影响 draw 和 fill。
- `draw opacity=<value>`: 只影响 stroke。
- `fill opacity=<value>`: 影响 fill，并且在 TikZ 中也会影响普通 text/image，除非另设 `text opacity`。
- `text opacity=<value>`: 覆盖 text 的透明度。
- 预设样式包括 `transparent`、`ultra nearly transparent`、`very nearly transparent`、`nearly transparent`、`semitransparent`、`nearly opaque`、`very nearly opaque`、`ultra nearly opaque`、`opaque`。

TikZKit 当前状态：

- `src/options.js` 已解析 `opacity`、`fill opacity`、`draw opacity` / `stroke opacity`、`text opacity`。
- `src/renderer-svg.js` 已把 path style 的 `opacity`、`fill-opacity`、`stroke-opacity` 输出到 SVG。
- `text opacity` 当前只进入 style，尚未稳定传递到 `textNode`、KaTeX/foreignObject 和 SVG text fallback 输出。
- `fill opacity` 对 text/image 的 TikZ 默认影响尚未完整建模。
- 预设 opacity styles 没有形成集中 catalog，后续应放到 style/default registry 中，而不是散落在 renderer。

实现要点：

- style 层要把所有 opacity 值 clamp 到 `0..1`。
- path/text/node box 的 opacity 应独立记录，避免 `fill-opacity` 误加到 stroke 或 node border。
- KaTeX scoped output、SVG text fallback 和 plain text 都必须支持同一套 text opacity 规则。
- 当 `fill opacity` 和 `text opacity` 同时存在时，text 应以 `text opacity` 为准。

## Blend Modes

TikZ 支持 `blend mode=<mode>` 和 `blend group=<mode>`。常见 mode 包括 normal、multiply、screen、overlay、darken、lighten、color dodge、color burn、hard light、soft light、difference、exclusion、hue、saturation、color、luminosity。

Web/SVG 对应思路：

- 简单场景可尝试 CSS `mix-blend-mode`。
- 更严格的 SVG/PDF parity 需要 isolated group 或 filter pipeline。
- `blend group` 本质上要求先把 group 内容合成，再与背景 blend。

TikZKit 当前缺口：

- 尚未看到稳定的 `blend mode` / `blend group` IR 字段和 renderer 输出。
- 浏览器 CSS 与 PDF blend semantics 不完全一致，后续必须用 native PNG 和 tikztosvg 交叉验证。

建议先实现的最小切片：

- parser/options 识别 `blend mode` 和 `blend group`。
- IR group 支持 `blendMode`、`isolated`。
- renderer 对 `<g>` 输出 `style="mix-blend-mode:..."` 和 `isolation:isolate`。
- 给 multiply/screen/normal 建最小视觉回归，再扩展其他模式。

## Fadings

TikZ 的 fading 是一种 soft mask：fading 图像的亮度决定最终透明度。白色接近不透明，黑色接近透明；在 fading picture 中显式透明颜色通常按黑色参与 mask 计算。

相关语法：

- `\usetikzlibrary{fadings}`
- `\tikzfadingfrompicture[name=...]{...}`
- `\tikzfading[name=..., left color=transparent!..., right color=transparent!... ]`
- `path fading=<name>`
- `fit fading=<boolean>`
- `fading transform={...}`
- `fading angle=<degree>`

TikZKit 当前状态：

- `src/libraries/fadings.js` 仍标记 `unsupported`。
- `src/options.js` 已把 `path fading` 解析为 `style.pathFading`。
- `src/renderer-svg.js` 对 `path fading=west/east/north/south` 有简单 SVG mask 输出。
- 自定义 fading、`tikzfadingfrompicture`、`\tikzfading`、`fit fading`、`fading transform`、`fading angle` 未完整实现。

实现要点：

- library metadata 应从 unsupported 调整为 partial，或者把 renderer 中的内置 fading 能力迁回 fadings library。
- 建立 fading registry：`name -> mask definition`。
- 先覆盖轴向 fading：west/east/north/south + angle transform。
- 再覆盖 radial/inner/outer color fading。
- 对 arbitrary fading picture，可以先记录 diagnostics；后续再考虑把 picture 渲染成 mask group。

## Scope Fading

`scope fading=<name>` 与 `path fading` 不同：它会持续影响当前 scope 内的后续绘制。它更接近 scope-level soft clip，通常需要配合 transparency group 才能得到 native-like 结果。

TikZKit 当前缺口：

- 需要 graphic state stack 记录当前 scope mask。
- 需要 renderer 能把 scope 内 items 包成 `<g mask="url(#...)">`。
- 如果 scope 内多条半透明 path 需要先合成再 mask，则还需要 transparency group。

建议切片：

1. parser/options 识别 `scope fading`。
2. interpreter scope env 继承并局部覆盖 `scopeFading`。
3. IR 增加 group item 或 scope metadata。
4. renderer 输出 mask group。

## Transparency Groups

Transparency group 的语义是：先把 scope 内所有内容画到一个独立 buffer，再把这个合成结果按 group opacity/blend/fading 输出到外层。它解决半透明对象自叠加的问题，也是复杂 shadow/fading/blend 的基础。

相关语法：

- `transparency group`
- `transparency group=<options>`
- `transparency group=knockout`
- `isolated=false`

实现要点：

- interpreter 必须保留 scope/group 边界，不能只把 items 平铺到一个数组。
- group 内 opacity 与 group 外 opacity 要区分：在 TikZ 中，scope options 的安装时机可能早于 group 建立，改变 group 内部 opacity 时常需要嵌套 scope。
- renderer 需要能输出 isolated group；简单 SVG 可用 `<g opacity="..." style="isolation:isolate">`，但 knockout 可能需要更复杂的 mask/filter。

TikZKit 当前缺口：

- 没有完整 transparency group IR。
- 没有 knockout group。
- 没有 isolated=false 的语义差异。
- `scope` 当前更多是解释器局部环境，不是可渲染 group 边界。

## Current TikZKit Gap Summary

已支持或部分支持：

- `opacity`
- `fill opacity`
- `draw opacity` / `stroke opacity`
- radial shading stop opacity 中的 `pgftransparent!...`
- `path fading=west/east/north/south` 的简单 SVG mask

需要补齐：

- predefined opacity styles。
- `text opacity` 实际渲染。
- `fill opacity` 对 text/image 的默认影响。
- `blend mode` / `blend group`。
- `fadings` library metadata 与 registry。
- `\tikzfadingfrompicture`。
- `\tikzfading`。
- `fit fading`。
- `fading transform`。
- `fading angle`。
- `scope fading`。
- `transparency group`。
- `knockout` group。
- isolated group 行为。

## Implementation Plan

1. Normalize opacity channels in `src/options.js`
   - 支持预设 opacity style。
   - clamp 数值。
   - 明确 path、node box、text 的通道映射。

2. Fix text opacity pipeline
   - `createNode` / text item 创建时保留 `textOpacity`。
   - SVG text fallback 输出 `opacity` 或 `fill-opacity`。
   - KaTeX foreignObject 包装层输出 scoped opacity。
   - 加最小测试：`fill opacity=.2,text opacity=1` 的文字应保持不透明。

3. Formalize `fadings` library
   - 把当前 west/east/north/south mask 能力登记到 `src/libraries/fadings.js`。
   - 新增 fading registry。
   - 支持 `fading angle` 和 simple axial/radial definitions。

4. Add group IR
   - Scope-level mask、blend、opacity 必须有 group boundary。
   - 后续 backgrounds、layers、transparency group 都应复用同一结构。

5. Implement blend and transparency group slices
   - 先做 normal/multiply/screen。
   - 再做 group opacity accumulation tests。
   - knockout 最后处理。

## Visual QA Notes

透明度功能不能只看 diff 数字。每个 case 至少检查：

- 半透明区域是否自叠加变深。
- text 是否被 fill opacity 意外淡化或未按 text opacity 覆盖。
- fading 边缘方向、范围、角度是否正确。
- mask 是否按 object bbox 还是 canvas bbox 缩放。
- blend mode 是否与 native PNG/tikztosvg 接近。
- scope 内外透明度是否泄漏。

## Case Notes

- PGFPlots surface / mesh 常用 `opacity=.5`，基础属性能出图，但 group/blend 语义还要校准。
- shadow + fading 类 case 依赖 mask、preaction/postaction 和 transparency group 的绘制顺序。
- node 文本如果同时设置 `fill opacity` 和 `text opacity`，当前 TikZKit 容易与 native 不一致，应作为优先回归。
