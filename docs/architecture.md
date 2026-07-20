# TikZKit Architecture

TikZKit is organized as a compiler/interpreter pipeline:

```txt
TikZ / LaTeX-ish source
  -> frontend parse
  -> TikZ AST
  -> engine evaluate
  -> SceneGraph
  -> renderer adapter
  -> SVG
```

The important seam is:

```txt
TikZ AST -> SceneGraph -> SVG
```

Parser and TeX-lite code should not emit SVG directly. TikZ semantics belong in the engine and `src/tikz/`; SVG details belong in `src/renderers/svg/`.

## Current Directory Map

```txt
src/
  index.js                 public library interface: tikzToSvg(), convertTikzToSvg()
  internal.js              non-public testing/debugging barrel for implementation seams
  cli/                     CLI adapter
  frontend/                document adapter and parse-facing seam: latex-shell/lexer/parser/AST/diagnostics
  engine/                  evaluation seam: context, registry, units, math, options, geometry, path builder
  tikz/
    commands/              canonical command catalog: draw, fill, node, path, coordinate, foreach, axis, addplot
    libraries/             canonical TikZ library catalog, declarations, and library-specific semantic helpers
    metrics.js             TikZ unit, font, line-width, dash, and arrow metric constants
    text.js                TeX/TikZ text normalization and math fallback semantics
    textMetrics.js         TeX/TikZ text and formula box metrics used by node sizing and SVG text layout
    registerCoreTikz.js    command/library registry setup
  pgfplots/                Axis Model and plot helpers before SceneGraph rendering
  scene/                   renderer-neutral SceneGraph helpers and path-command bbox logic
  renderers/svg/           SVG renderer adapter
    bounds.js              SVG viewBox bounds computation for rendered SceneGraph items and text render boxes
    document.js            SVG document shell, viewBox, and background serialization
    defs.js                SVG defs collection for markers, patterns, gradients, fadings, and filters
    format.js              SVG numeric formatting shared by path, text, marker, style, defs, and renderer modules
    imagePlaceholders.js   SVG serialization and bbox scale helpers for parsed image placeholders and mini graphics
    layout.js              SVG render-unit scaling helpers for item/style normalization before serialization
    richText.js            SVG rich text source cleanup, TeX-like wrapping, inline math HTML, and rich text box estimation
    richTextNode.js        SVG rich text-node foreignObject serialization, fallback shell, and render-bound estimation
    textLayout.js          SVG plain text alignment, anchors, line styles, baselines, wrapping, and inline math source detection
    plainTextNode.js       SVG plain text-node serialization and plain text render-bound estimation
    segmentedText.js       SVG segmented \textcolor and \tikzinlinebox parsing and serialization for text nodes
    paths.js               SVG path, double-stroke, terminal shortening, and inline arrow-tip serialization
    text.js                SVG text serialization helpers, escaping, lightweight TeX text cleanup
    textLineContent.js     SVG text-line content formatting, inline SVG math fallback dispatch, and source-line math detection
    textFit.js             SVG text/math fit-to-box font-size reduction shared by bounds and text node renderers
    markers.js             SVG marker and arrow marker serialization
    style.js               SVG style attribute, paint, pattern, gradient, and fading id serialization
    nodeShapes.js          SVG serialization and geometry for generic TikZ node shapes
    nodeOverlays.js        SVG serialization for nodeBox shadows, double outlines, path-picture overlays, and overlay composition
    rectangleSplitNodes.js SVG serialization for shapes.multipart rectangle split node boxes
    circuitikzNodes.js     SVG serialization for circuitikz node-box shapes such as op amps, tubes, transistors, and quadpoles
    bpmnNodes.js           SVG serialization for BPMN node icons and task/event markers
    tikzquadsNodes.js      SVG serialization for tikzquads quadripole and load-line node-box shapes
    transforms.js          SVG transform helpers such as node rotation wrappers
    textContour.js         SVG text contour stroke handling for TeX \contour content
    mathFallbackSyntax.js  SVG math fallback syntax scanning for TeX groups, scripts, KaTeX normalization, and fallback font decisions
    mathNode.js            SVG serialization, fallback selection, and box sizing for standalone math text nodes
    mathColorFallback.js   SVG parsing and rendering for math color fallbacks such as \textcolor and stateful \color
    mathFractionFallback.js SVG parsing and rendering for simple and inline fraction math fallbacks
    mathScriptFallback.js  SVG parsing and rendering for math script/subscript fallbacks such as x_i, \hat{x}_1, and mixed scripted text
    mathSumFallback.js     SVG parsing and rendering for \sum upper/lower limit fallbacks in text and standalone math nodes
    mathMatrixFallback.js  SVG parsing and rendering for inline math matrix fallbacks such as matrix, pmatrix, bmatrix, vmatrix, cases
    tensorMatrixFallback.js SVG parsing and rendering for tensor matrix math fallbacks such as \overmat and \undermat
    mathScopedCss.js       renderer-owned scoped KaTeX CSS and class scoping for SVG foreignObject math
    mathHtml.js            KaTeX-to-scoped-HTML rendering for SVG foreignObject math
  adapters/                filesystem and external LaTeX/tikztosvg adapters
  shared/                  result, errors, source-map helpers
  packages/                LaTeX package registry and compatibility metadata
  extensions/              third-party package compatibility slices
  capabilities/            parser/semantic/svg support matrix, feature ids, and ownership registries
```

The public entry point deliberately crosses only the three main seams:

```txt
src/index.js
  -> frontend/index.js
  -> engine/index.js
  -> renderers/svg/index.js
```

Do not import parser, evaluator, PGFPlots internals, package registries, extension registries, command catalogs, or SVG implementation files directly from new public-facing code unless the module itself owns that seam.

Tests and local diagnostics that need broad implementation access should import from `src/internal.js`. That barrel is intentionally not the public library interface; it keeps `src/index.js` small while making internal seams explicit.

## Compatibility Adapters

These paths are kept for older imports while the implementation migrates to the compiler-style layout:

```txt
src/commands/              compatibility adapters to src/tikz/commands/
src/libraries/             compatibility adapters to src/tikz/libraries/
src/preprocess.js          compatibility adapter to src/frontend/latex-shell.js
src/parser.js              compatibility adapter to src/frontend/parser.js
src/interpreter.js         compatibility adapter to src/engine/evaluate.js
src/renderer-svg.js        compatibility adapter to src/renderers/svg/renderSvg.js
src/math.js                compatibility adapter to src/engine/math.js
src/options.js             compatibility adapter to src/engine/options.js
src/tikz-libraries.js      compatibility adapter to src/tikz/libraries/declarations.js
src/tex-packages.js        compatibility adapter to src/packages/declarations.js
src/code-blocks.js         compatibility adapter to src/frontend/code-blocks.js
src/tikz-metrics.js        compatibility adapter to src/tikz/metrics.js
src/tex-text.js            compatibility adapter to src/tikz/text.js
src/math-metrics.js        compatibility adapter to src/tikz/textMetrics.js
src/geometry.js            compatibility adapter to src/engine/geometry.js
src/math-scoped-css.js     compatibility adapter to src/renderers/svg/mathScopedCss.js
```

New code should prefer the canonical seams:

```js
import { parseTikz } from "./frontend/index.js";
import { preprocessTikzSource } from "./frontend/index.js";
import { extractTikzCodeBlocks } from "./frontend/index.js";
import { evaluateTikzAst } from "./engine/index.js";
import { flattenPath } from "./engine/index.js";
import { renderSvg } from "./renderers/svg/index.js";
import { collectTikzLibraries } from "./tikz/libraries/declarations.js";
import { collectTexPackages } from "./packages/declarations.js";
import { normalizeTikzText } from "./tikz/text.js";
import { estimateFormulaBox } from "./tikz/textMetrics.js";
import { registerCoreTikz } from "./tikz/registerCoreTikz.js";
```

Code that is not part of the public package interface but needs a broad barrel for tests or diagnostics may import from `src/internal.js`. Application/library users should import from `src/index.js`.

## Frontend Document Adapter

LaTeX shell handling belongs in `src/frontend/latex-shell.js`. This layer collects package and library declarations, expands supported TeX-lite macros and environments, strips document wrappers, and lowers PGFPlots/data-visualization snippets into TikZ-compatible source before parsing.

TikZ semantics still belong in `src/engine/` and `src/tikz/`. SVG output still belongs in `src/renderers/svg/`.

`src/frontend/parser.js` owns tikzpicture scanning. A parsed document exposes a
`figures` inventory with `figure:<index>` ids, and callers may pass
`activeFigureId` to parse one selected picture while preserving style, macro,
color, package, and library context from the preceding preamble. This mirrors
the editor-oriented lesson from `DominikPeters/tikz-editor`: multi-figure
documents need a source-aware frontend seam before engine evaluation, not
renderer-side filtering.

Frontend may call domain modules to understand declarations, but the domain rules should live with their owner. For example, `\usepgfplotslibrary{...}` and `\pgfplotsset{...}` are collected by `src/pgfplots/axisOptions.js`, while `src/frontend/latex-shell.js` only orchestrates when that collection happens in the document pipeline.

Likewise, `\usetikzlibrary{...}` declaration parsing belongs in `src/tikz/libraries/declarations.js`, not in a root utility file or the frontend parser.

Package declaration parsing for `\usepackage[...] {...}` belongs in `src/packages/declarations.js`; the package registry itself stays in `src/packages/index.js` and one package file per observed package.

Markdown/code-fence extraction for ```tikz and '''tikz belongs in `src/frontend/code-blocks.js`, because it adapts source documents before parsing TikZ.

## SceneGraph Seam

The engine should emit renderer-neutral items through `src/scene/` helpers where practical:

```js
import { createPathShape, createTextShape } from "./scene/index.js";
```

The SceneGraph owns item shapes such as `path`, `textNode`, `bbox`, `marker`, and `group`. SVG-only details, escaping, markers, defs, and DOM serialization stay in `src/renderers/svg/`.

Path command bounding boxes belong in `src/scene/bbox.js`. Both engine features like `current bounding box` and SVG features like `viewBox` should call `includePathCommandBounds()` rather than carrying separate Bezier extrema implementations.

## Path Builder Seam

Primitive path commands belong in `src/engine/pathBuilder.js`:

```js
import { moveToCommand, lineToCommand, curveToCommand } from "./engine/pathBuilder.js";
```

TikZ path semantics still live in the engine evaluator and TikZ command modules, but low-level SceneGraph path command shapes should be constructed through the path builder helpers. This keeps path command structure consistent across straight lines, curves, rectangles, arrows, decorations, and future Canvas/PDF renderers.

## PGFPlots Seam

PGFPlots should not render directly to SVG. It should first build an Axis Model:

```txt
axis options + addplot data
  -> Axis Model
  -> SceneGraph plan
  -> SceneGraph items
  -> SVG
```

Owned modules:

```txt
src/pgfplots/axis.js
src/pgfplots/axis3d.js
src/pgfplots/axisEnvironment.js
src/pgfplots/axisOverlay.js
src/pgfplots/axisTikzLowering.js
src/pgfplots/axisOptions.js
src/pgfplots/ranges.js
src/pgfplots/ticks.js
src/pgfplots/grid.js
src/pgfplots/addplot.js
src/pgfplots/addplotParser.js
src/pgfplots/addplotLowering.js
src/pgfplots/coordinates.js
src/pgfplots/expressions.js
src/pgfplots/namedOptions.js
src/pgfplots/rangeResolver.js
src/pgfplots/surface.js
src/pgfplots/labels.js
src/pgfplots/legend.js
src/pgfplots/marks.js
src/pgfplots/transformDataToCanvas.js
```

`src/pgfplots/axisOptions.js` owns PGFPlots library declarations and global option collection. The frontend document adapter should import `collectPgfplotsLibraries`, `collectPgfplotsSetOptions`, and `stripPgfLibraryDeclarations` from this seam instead of keeping PGFPlots-specific parsing rules inline.

## Capability Matrix Seam

Feature support is tracked in `src/capabilities/`:

```txt
src/capabilities/feature-ids.js
src/capabilities/matrix.js
src/capabilities/registries.js
```

Each feature records its parser, semantic, and SVG support level as `none`, `partial`, or `stable`, plus the owning modules, representative fixtures, verification oracle, verification tests, and current caveats. This follows the same discipline observed in `DominikPeters/tikz-editor`: capability support should be explicit and test-backed, not inferred from scattered diagnostics or case-specific fixes.

The `verification.oracle` field is deliberately explicit:

```txt
unit-test             structural behavior is covered by focused tests
unit-test+tikztosvg   renderer behavior is also checked against tikztosvg artifacts
mactex+tikztosvg      package-level behavior needs native TeX plus tikztosvg comparison
```

Visual features should not be promoted to `stable` solely because diagnostics are empty. They need a fixture plus an oracle path that can produce comparable artifacts.

When adding a TikZ command, TikZ library, PGFPlots feature, data-visualization feature, package compatibility slice, or renderer-owned behavior, update the matrix in the same change as the implementation and regression test.

## Migration Rules

1. New TikZ command metadata goes in `src/tikz/commands/<name>.js`.
2. New TikZ library metadata/helpers go in `src/tikz/libraries/<name>.js`.
3. TikZ unit, font, line-width, dash, and arrow metric constants go in `src/tikz/metrics.js`.
4. TeX/TikZ text normalization and math fallback semantics belong in `src/tikz/text.js`.
5. Text and formula metrics that affect TikZ node sizing belong in `src/tikz/textMetrics.js`.
6. LaTeX shell/package preprocessing belongs in `src/frontend/latex-shell.js`, not in parser or engine code.
7. Feature support status and owner modules belong in `src/capabilities/`.
7. Shared command execution logic belongs behind `engine/` or `tikz/` seams, not in renderer code.
8. Path flattening, path length, analytic intersections, and primitive shape path conversion belong in `src/engine/geometry.js`.
9. Engine code should create common IR items through `src/scene/` helpers instead of hand-writing renderer-facing object literals.
10. Engine code should create primitive path commands through `src/engine/pathBuilder.js` helpers.
11. Renderer-specific document shell, marker, path, inline arrow-tip, generic node shape, text, style attribute, path-data, defs, and escaping logic belongs under `src/renderers/svg/`.
12. PGFPlots declaration, option, axis, plot, tick, grid, legend, mark, and coordinate semantics belong under `src/pgfplots/`.
13. KaTeX scoped-math CSS and KaTeX HTML class rewriting used by SVG `foreignObject` rendering belong in `src/renderers/svg/mathScopedCss.js`, not at the root or inside `renderSvg.js`.
14. KaTeX HTML rendering and SVG math style-def emission belong in `src/renderers/svg/mathHtml.js`; `renderSvg.js` should call these helpers rather than importing `katex` directly.
15. SVG marker and arrow marker serialization belongs in `src/renderers/svg/markers.js`; `renderSvg.js` should call marker helpers instead of carrying marker path definitions inline.
16. SVG style attribute, paint, pattern id, gradient id, and path fading id serialization belongs in `src/renderers/svg/style.js`; `renderSvg.js` should call these helpers instead of carrying SVG attribute rules inline.
17. SVG defs collection and serialization for patterns, gradients, fadings, and filters belongs in `src/renderers/svg/defs.js`; `renderSvg.js` should call `collectSvgDefs` and `createSvgDefs`.
18. SVG numeric formatting belongs in `src/renderers/svg/format.js`; SVG renderer modules should share it instead of carrying local `format()` helpers.
19. Public library adapters should import through seam indexes: `frontend/index.js`, `engine/index.js`, and `renderers/svg/index.js`.
20. When migrating legacy files, keep a compatibility adapter until tests and imports have moved.
21. SVG path item serialization, double strokes, dashed double fallback, terminal shortening, and inline arrow-tip geometry belong in `src/renderers/svg/paths.js`; `renderSvg.js` should only dispatch path items to `renderPathElement`.
22. Renderer-neutral path command bounding boxes, including tight cubic Bezier extrema for the PGF bbox library, belong in `src/scene/bbox.js`; engine and renderer code should share `includePathCommandBounds()`.
23. SVG serialization and geometry for generic TikZ node shapes such as diamond, regular polygon, star, trapezium, triangle, cloud, superellipse, and single/double arrows belong in `src/renderers/svg/nodeShapes.js`; extension-specific node renderers can stay separate until they get their own module.
24. SVG render-unit scaling for item styles and text sizing belongs in `src/renderers/svg/layout.js`; `renderSvg.js` should call `scaleItemsForRenderUnit()`, `renderUnitScale()`, and `textFontSizeForUnit()` instead of carrying local scaling helpers.
25. SVG document shell, viewBox serialization, and background rect serialization belong in `src/renderers/svg/document.js`; `renderSvg.js` should call these helpers and keep only SceneGraph traversal orchestration.
26. SVG serialization for circuitikz node-box shapes belongs in `src/renderers/svg/circuitikzNodes.js`; `renderSvg.js` should call `renderCircuitikzNodeBox()` and keep extension-specific op amp, transistor, tube, and quadpole geometry out of the main renderer dispatcher.
27. SVG serialization for BPMN node icons and task/event markers belongs in `src/renderers/svg/bpmnNodes.js`; `renderSvg.js` should call `renderBpmnIcon()` and `renderBpmnMarker()` from the node overlay path rather than carrying BPMN glyph geometry inline.
28. SVG nodeBox overlay composition, shadows, double outlines, and path-picture overlays belong in `src/renderers/svg/nodeOverlays.js`; `renderSvg.js` should call `renderNodeBoxWithOverlay()` rather than carrying overlay/shadow geometry inline.
29. SVG transform helpers such as node rotation wrappers belong in `src/renderers/svg/transforms.js`; text and node renderers should share `wrapNodeRotation()` instead of keeping separate transform serialization.
30. SVG text contour handling for TeX `\contour{color}{...}` belongs in `src/renderers/svg/textContour.js`; `renderSvg.js` should call `applyTextContour()` rather than carrying contour parsing and stroke injection inline.
31. SVG serialization for tikzquads extension node-box shapes belongs in `src/renderers/svg/tikzquadsNodes.js`; `renderSvg.js` should inject shared text/math renderers and keep quadripole/load-line geometry out of the main dispatcher.
32. SVG serialization for `rectangle split` node boxes from TikZ `shapes.multipart` belongs in `src/renderers/svg/rectangleSplitNodes.js`; `renderSvg.js` should only dispatch to `renderRectangleSplitNodeBox()`.
33. SVG serialization and bbox scaling for image placeholders, nested mini graphics, gaussian placeholders, and network-device placeholders belongs in `src/renderers/svg/imagePlaceholders.js`; `renderSvg.js` should call `renderImagePlaceholder()` and share `imagePlaceholderScale()` with bbox calculation.
34. SVG math fallback syntax scanning for TeX groups, subscript/superscript atoms, accent atoms, KaTeX normalization, and fallback font style/weight decisions belongs in `src/renderers/svg/mathFallbackSyntax.js`; `renderSvg.js` should import these helpers instead of carrying parser-like TeX scanners inline.
35. SVG parsing and rendering for tensor matrix math fallbacks such as `\overmat` and `\undermat` belongs in `src/renderers/svg/tensorMatrixFallback.js`; `renderSvg.js` should only dispatch to `tensorMatrixFallbackParts()` and `renderTensorMatrixFallback()`.
36. SVG rich text source cleanup, TeX-like wrapping, inline math HTML, and rich text box estimation belong in `src/renderers/svg/richText.js`; `renderSvg.js` should keep only the rich text node shell and delegate line preparation and measurement.
37. SVG plain text alignment, anchors, line styles, baseline offsets, wrapping, and inline math source detection belong in `src/renderers/svg/textLayout.js`; `renderSvg.js` should use these helpers rather than carrying text layout algorithms inline.
38. SVG plain text-node serialization and plain text render-bound estimation belong in `src/renderers/svg/plainTextNode.js`; `renderSvg.js` should inject math/text fallback helpers and keep only text-node dispatch.
39. SVG segmented text parsing and serialization for `\textcolor{...}{...}` and `\tikzinlinebox{...}{...}` belongs in `src/renderers/svg/segmentedText.js`; `renderSvg.js` should inject shared text measurement helpers and keep only text-node dispatch.
40. SVG math script/subscript fallback parsing and rendering for patterns such as `x_i`, `\hat{x}_1`, leading scripts, styled scripts, and mixed operator text belongs in `src/renderers/svg/mathScriptFallback.js`; `renderSvg.js` should dispatch to these helpers rather than carrying script-specific TeX parsing and `<tspan>` serialization inline.
41. SVG inline matrix math fallback parsing and rendering for `matrix`, `pmatrix`, `bmatrix`, `vmatrix`, `Vmatrix`, `Bmatrix`, and `cases` belongs in `src/renderers/svg/mathMatrixFallback.js`; `renderSvg.js` should only detect the fallback result and delegate matrix cell layout and delimiter path serialization.
42. SVG fraction math fallback parsing and rendering for `\frac`, `\dfrac`, `\tfrac`, inline fraction prefixes/suffixes, and fraction part `<tspan>` content belongs in `src/renderers/svg/mathFractionFallback.js`; `renderSvg.js` should dispatch to the module and reuse `renderFractionPartContent()` from sum/color fallbacks instead of duplicating fraction-specific layout.
43. SVG `\sum` upper/lower limit fallback parsing and rendering belongs in `src/renderers/svg/mathSumFallback.js`; `renderSvg.js` should only dispatch to the module for text-content or standalone math-node fallback output.
44. SVG math color fallback parsing and rendering for `\textcolor{...}{...}` and stateful `\color{...}` belongs in `src/renderers/svg/mathColorFallback.js`; `renderSvg.js` should only dispatch to the module and provide the non-color math content renderer when needed.
45. SVG standalone math node serialization, KaTeX `foreignObject` shell sizing, SVG-text fallback selection, and math node box sizing belong in `src/renderers/svg/mathNode.js`; `renderSvg.js` should only call `renderMathNode()` and reuse `estimateMathBox()` / `scopedMathForeignObjectBox()` for bounds.
46. SVG rich text-node `foreignObject` serialization, plain-text fallback shell, fit-to-box sizing, and rich text render-bound estimation belong in `src/renderers/svg/richTextNode.js`; `renderSvg.js` should only dispatch rich text nodes to that module and inject shared plain-text/math fallback helpers.
47. SVG text-line content formatting, inline SVG math fallback dispatch, and normalized inline-math detection belong in `src/renderers/svg/textLineContent.js`; `renderSvg.js` should inject these helpers into plain/rich text node renderers rather than carrying line-content serialization itself.
48. SVG viewBox bounds computation for rendered SceneGraph items belongs in `src/renderers/svg/bounds.js`; `renderSvg.js` should call `computeSvgBounds()` and should not carry per-item bounds traversal or text render-bound inclusion.
49. SVG text/math fit-to-box font-size reduction belongs in `src/renderers/svg/textFit.js`; renderers and bounds estimators should share `fitFontSizeToBox()` instead of carrying local copies.
50. `src/index.js` must stay a small public interface. Broad exports for PGFPlots internals, package/library registries, command catalogs, extensions, and low-level renderer helpers belong in `src/internal.js` or their owning module, not in the public entry point.
51. PGFPlots Axis Model orchestration and axis-to-TikZ lowering belong in `src/pgfplots/axisTikzLowering.js`; `src/frontend/latex-shell.js` should call `renderPgfplotsAxisAsTikz()` and inject only not-yet-migrated helper dependencies until those helpers also move behind PGFPlots seams.
52. PGFPlots expression evaluation, declared function expansion, trig-mode normalization, and endpoint sampling compensation belong in `src/pgfplots/expressions.js`; frontend/datavisualization code may call that seam but should not carry independent PGF math evaluators.
53. PGFPlots range resolution, default function domains, enlarge-limits padding, domain parsing, sample count clamping, parametric sampling, and surface z restrictions belong in `src/pgfplots/rangeResolver.js`; frontend/datavisualization code may call that seam but should not duplicate those range policies.
54. PGFPlots surface lowering for sampled function surfaces and coordinate mesh patches belongs in `src/pgfplots/surface.js`; frontend code may dispatch a surface addplot to that seam but should not own mesh inference, patch depth sorting, surface color maps, or surface opacity policy.
55. PGFPlots 3D axis frame, tick, and label lowering belongs in `src/pgfplots/axis3d.js`; frontend code may provide it to axis lowering dependencies but should not own 3D box corner mapping, 3D tick placement, or 3D label offsets.
56. PGFPlots `\addplot` lowering for coordinate, function, parametric, bar, comb, mark, inline-node, and surface plot primitives belongs in `src/pgfplots/addplotLowering.js`; frontend code may pass the renderer dependency through axis lowering but should not own plot clipping, name-path option emission, sampled function rendering, or closed-cycle construction.
57. PGFPlots environment discovery and document-shell expansion for `axis`, `semilogxaxis`, `semilogyaxis`, `loglogaxis`, and `ternaryaxis` belongs in `src/pgfplots/axisEnvironment.js`; frontend code may orchestrate when expansion runs but should not own PGFPlots environment defaults, containing `tikzpicture` option merging, or explicit x/y unit flags.
58. PGFPlots `\addplot` statement parsing, plot-local style expansion, inline plot nodes, coordinate/table/function/parametric plot model construction, and pgfplotstable row-to-point conversion belongs in `src/pgfplots/addplotParser.js`; frontend code may pass it into axis lowering but should not own addplot syntax or table point extraction.
59. PGFPlots named style expansion and PGFPlots option-map merging belongs in `src/pgfplots/namedOptions.js`; frontend code may use this seam when preparing axis options but should not keep a second style-expansion implementation.
60. PGFPlots legend body parsing for `\addlegendentry` and `\legend{...}` belongs in `src/pgfplots/legend.js` with legend layout/rendering helpers; frontend code may pass parsed body entries into axis lowering but should not own legend-list syntax.
61. PGFPlots axis overlay statement lowering for `\coordinate`, `\node`, `\draw`, and `\path` inside an axis belongs in `src/pgfplots/axisOverlay.js`; frontend code should not own `axis cs`, `rel axis cs`, `axis description cs`, `/pgfplots/<axis><bound>` replacement, or overlay coordinate clamping rules.
62. TikZ `\foreach` loop value expansion, tuple variable binding, `count`, and `evaluate=... using ...` option semantics belong in `src/tikz/commands/foreach.js`; engine code should call `foreachIterationVariables()` and only interpret the loop body statements.
