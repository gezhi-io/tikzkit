# DominikPeters/tikz-editor Research

Repository: <https://github.com/DominikPeters/tikz-editor>

Local source reviewed:

```txt
/private/tmp/tikz-editor-research
commit f9617fe
checked 2026-07-09
```

Official README rechecked from GitHub on 2026-07-09:
<https://github.com/DominikPeters/tikz-editor>

The README describes the project as a WYSIWYG TikZ editor with support for
common TikZ constructs such as shapes, paths, trees, matrices, `\foreach`,
styling, patterns, shading, and transforms. It also explicitly lists
decorations, graphs, and plots as partial support, and says advanced constructs
such as `let` operations are not implemented.

## Executive Conclusion

`tikz-editor` is useful, but not for the reason implied by the online editor.
It is not a full browser TeX engine and it does not appear to implement full
PGFPlots, datavisualization, or CircuiTikZ. Its value for TikZKit is the
architecture:

```txt
TikZ source
  -> recoverable parser
  -> semantic evaluator
  -> measured scene model
  -> SVG renderer
  -> editor/source synchronization
```

The web app works well because base TikZ semantics are centralized before SVG
emission. TikZKit should reuse that architecture and its implementation ideas
for core TikZ, while continuing to use local MacTeX and local `tikztosvg` as the
fidelity oracle for package-heavy systems.

Follow-up check on 2026-07-09: `@tikz-editor/core` is not published on npm
(`npm view @tikz-editor/core` returns 404). Direct dependency integration would
therefore need a git dependency or vendoring, and would pull in a TypeScript
core plus MathJax 4 runtime. The lower-risk path is to port specific algorithms
and contracts into TikZKit rather than replacing TikZKit with `tikz-editor`.

## Source Structure

The repository splits responsibilities clearly:

```txt
apps/web
  Vite/React browser shell

apps/desktop
  Tauri shell and optional native LaTeX/dvisvgm bridge

packages/lezer-tikz
  Lezer TikZ grammar and generated parser

packages/core
  parser, AST, semantic evaluator, scene model, SVG renderer, MathJax text
  engine, coordinates, nodes, paths, arrows, capabilities, editing metadata

packages/app
  editor UI, canvas interaction, inspector, source synchronization
```

The relevant core files reviewed:

```txt
README.md
DEVELOPMENT.md
packages/core/src/index.ts
packages/core/src/render/index.ts
packages/core/src/parser/index.ts
packages/lezer-tikz/src/grammar/tikz.grammar
packages/core/src/ast/*
packages/core/src/semantic/evaluate.ts
packages/core/src/semantic/coords/*
packages/core/src/semantic/nodes/*
packages/core/src/semantic/path/*
packages/core/src/semantic/required-tikz-libraries.ts
packages/core/src/semantic/style/arrows.ts
packages/core/src/svg/emit.ts
packages/core/src/svg/arrows/*
packages/core/src/text/types.ts
packages/core/src/text/mathjax-engine.ts
packages/core/src/capabilities/*
test/semantic/node-shape-anchor-pgf-parity.spec.ts
test/svg-arrow-metrics.spec.ts
test/mathjax-engine.spec.ts
scripts/compare-tikz-renderers.mjs
design/addon-architecture.md
```

## Current Inspection Notes

The repository is a real client-side TikZ editor, not just a wrapper around a
remote TeX service. Its public core entry exports a compact API:

```txt
parseTikz
evaluateTikzFigure
emitSvg / emitSvgModel
renderTikzToSvg / renderTikzToSvgAsync
createMathJaxNodeTextEngine
capabilityMatrix
```

The important implementation detail is the async text pass in
`packages/core/src/render/index.ts`: it creates or accepts a text engine,
evaluates the semantic scene, emits SVG, flushes pending MathJax measurements,
then re-evaluates so node sizes and anchors can depend on measured text. This
matches the problem TikZKit has seen with clipped formulas, wrong node boxes,
and arrows attaching to stale node bounds.

The Lezer grammar is intentionally broad rather than package-complete. It
recognizes TikZ statements, path items, nodes, pics, foreach, style definitions,
color definitions, macros, and unknown statements. Package-scale systems are
not forced into the core grammar; `design/addon-architecture.md` proposes
claiming foreign environments and commands via add-ons. That is the right
direction for TikZKit's `src/packages/*`, `src/libraries/*`, and
`src/pgfplots/*` split.

The repository does not currently contain a meaningful PGFPlots or
datavisualization implementation. Searches for `pgfplots`, `axis`, `addplot`,
and `datavisualization` show documentation/tests around ordinary TikZ words,
not an Axis/Data model. For those areas TikZKit should continue using local
MacTeX, local `tikztosvg`, and the PGF/TikZ manual sources as the fidelity
oracle.

Source search on 2026-07-09 also confirmed that `circuitikz` and related
package-scale commands do not have dedicated semantic engines in
`packages/core`; they belong to the same add-on category as PGFPlots.

## What It Implements Well

Use `tikz-editor` as a reference for base TikZ:

- recoverable parsing and multi-figure scanning;
- contextual preamble/style/macro definitions before the active figure;
- `\foreach` expansion and simple macro context;
- coordinate evaluation, calc-like coordinates, named coordinates, and node
  anchors;
- node text measurement before node geometry is finalized;
- shape geometry and anchor tables;
- path construction, path-attached nodes, trees, matrices, and pics;
- arrow parsing, metrics, path shortening, tip placement, and SVG tip paths;
- capability matrix with parser/semantic/svg/edit status;
- renderer comparison scripts.

This directly maps to TikZKit's recurring problem areas: formula/node sizing,
anchor attachment, arrow shortening, dashed/dotted arrows, active figure
selection, and visual comparison workflow.

## What It Does Not Replace

Source search and the add-on design document indicate it is not a complete
implementation for these systems:

- PGFPlots `axis`, `semilogxaxis`, `groupplot`;
- `\addplot`, `\addplot3`, table-based plots, 3D surfaces;
- PGF datavisualization survey/visualizer pipeline;
- CircuiTikZ components and package options;
- full package-level TeX macro system.

`design/addon-architecture.md` specifically treats PGFPlots as a future add-on
because faithful support requires a separate package engine. For TikZKit, these
areas must stay grounded in:

```txt
local MacTeX source/docs
local tikztosvg SVG/PNG
TikZKit JS SVG/PNG
visual comparison sheets
```

This matters for the current TikZKit work: `tikz-editor` is not a shortcut for
the PGFPlots/datavisualization examples. Searches in the reviewed commit show no
dedicated `AxisModel`, `DataSurvey`, `\addplot`, `\addplot3`, or PGF
datavisualization pipeline comparable to TikZKit's current `src/pgfplots/*` and
`src/libraries/datavisualization*.js`.

## Borrowable Architecture For TikZKit

The key lesson is not Lezer or TypeScript. The key lesson is module ownership:

```txt
frontend parser
  owns document shape, active figure scanning, diagnostics

engine / tikz semantic layer
  owns styles, macros, libraries, coordinates, nodes, paths, arrows, transforms

scene graph
  owns renderer-neutral shapes and measured geometry

SVG renderer
  owns serialization, defs, markers, text payloads, escaping, viewBox
```

TikZKit's target structure already follows this direction:

```txt
src/frontend
src/engine
src/tikz/commands
src/tikz/libraries
src/pgfplots
src/scene
src/renderers/svg
src/capabilities
```

The remaining requirement is stricter contracts between these folders.

## Text Engine Contract

`tikz-editor` creates a text engine before semantic evaluation. The semantic
evaluator uses text metrics before node geometry and anchors are finalized. SVG
emission then renders from the same measured payload.

TikZKit should keep moving toward this contract:

```txt
measureNodeText(text, style, textWidth, mode)
  -> width
  -> height
  -> baseline
  -> midline
  -> renderPayload/cacheKey
```

Consumers:

```txt
node layout
shape geometry
anchor resolver
path endpoint attachment
SVG text/math renderer
```

This is the correct fix direction for formula clipping, wrong `text width`,
wrong node border size, and arrow endpoints attached to stale text boxes.

## Node Geometry Contract

`tikz-editor` treats node geometry as semantic data, not renderer-local
guesswork. TikZKit should store this in the scene/semantic layer:

```txt
center
visual width / height
inner sep / outer sep
minimum width / height / size
text width / alignment / baseline
shape
anchor resolver
border intersection resolver
```

Path endpoint attachment should ask this resolver for border points. The SVG
renderer should not recompute node sizes independently.

## Arrow Pipeline Contract

The arrow system in `tikz-editor` is split into a small geometry pipeline:

```txt
parse arrow option
  -> normalized tip model
  -> tip metrics
  -> shaft shortening
  -> path tangent/normal sampling
  -> local tip path placement
  -> SVG tip path rendering
```

TikZKit should keep all arrow behavior behind one equivalent pipeline. This is
the right place to fix dashed/dotted/double arrow overrun and inconsistent
`stealth`, `latex`, `Latex`, and bidirectional tips.

TikZKit owner modules:

```txt
src/tikz/metrics.js
src/engine/options.js
src/renderers/svg/paths.js
src/renderers/svg/markers.js
```

Concrete `tikz-editor` reference files:

```txt
packages/core/src/semantic/style/arrows.ts
packages/core/src/svg/arrows/types.ts
packages/core/src/svg/arrows/metrics.ts
packages/core/src/svg/arrows/shapes.ts
packages/core/src/svg/arrows/shorten.ts
packages/core/src/svg/arrows/place.ts
packages/core/src/svg/arrows/render.ts
test/svg-arrow-metrics.spec.ts
test/svg-arrows.spec.ts
test/svg-arrow-preview.spec.ts
```

The transferable algorithm is:

```txt
resolved path + resolved style
  -> normalize arrow tip family and dimensions
  -> compute PGF-like line-end shortening
  -> sample tangent at path start/end
  -> trim shaft path
  -> place local arrow-tip SVG path in world coordinates
```

This should replace ad hoc marker placement in TikZKit. Dashes, dotted lines,
double strokes, and arrow overrun should be checked at this single boundary.

## Node Anchor Contract

Concrete `tikz-editor` reference files:

```txt
packages/core/src/semantic/nodes/layout.ts
packages/core/src/semantic/nodes/anchors.ts
packages/core/src/semantic/nodes/named-coordinates.ts
packages/core/src/semantic/nodes/shape-geometry.ts
test/semantic/node-shape-pgf-parity.spec.ts
test/semantic/node-shape-anchor-pgf-parity.spec.ts
```

The transferable algorithm is:

```txt
measured text + node style
  -> node layout metrics
  -> shape geometry
  -> anchor offsets
  -> named coordinates such as node.north and node.30
  -> border intersection for bare (node) path endpoints
```

The important separation is that `draw (A) -- (B)` does not guess in the SVG
renderer. Named node geometry is registered during semantic evaluation, and
coordinate resolution asks the node geometry store for border points.

## Text And Formula Contract

Concrete `tikz-editor` reference files:

```txt
packages/core/src/text/mathjax-engine.ts
packages/core/src/text/types.ts
packages/core/src/text/knuth-plass/*
test/mathjax-engine.spec.ts
test/knuth-plass-paragraph.spec.ts
test/render-mathjax-fallback.spec.ts
```

The useful idea is not specifically MathJax over KaTeX; it is the interface:

```txt
validate(text)
measure({ text, textWidthPt, font, fontSizePt, alignment })
renderFromCache(cacheKey)
flushPending()
```

TikZKit can keep KaTeX, but it should wrap KaTeX behind this same contract.
The renderer should not measure formulas independently from semantic node
layout. A formula/node mismatch is a text-engine contract bug, not a renderer
CSS patch.

## Capability And QA Contract

Concrete `tikz-editor` reference files:

```txt
packages/core/src/capabilities/feature-ids.ts
packages/core/src/capabilities/matrix.ts
packages/core/src/capabilities/registries.ts
test/capabilities.spec.ts
scripts/compare-tikz-renderers.mjs
scripts/compare-pgf-docs-renderings.mjs
```

TikZKit should copy the discipline:

```txt
feature id
  -> parser/semantic/svg/edit status
  -> fixture ids
  -> owner module
  -> comparison artifacts
```

This directly addresses the recurring problem of "implemented" meaning only
"no diagnostics". A feature is implemented only when it has a fixture and a
visual comparison against `tikztosvg` or native TeX.

## Add-On / Plugin Lesson

The add-on design in `tikz-editor` is directly relevant. Package-scale systems
should be triggered by environments, commands, packages, and libraries:

```js
export default {
  id: "pgfplots",
  triggers: {
    packages: ["pgfplots"],
    environments: ["axis", "semilogxaxis", "loglogaxis", "groupplot"],
    commands: ["\\addplot", "\\addplot3", "\\pgfplotsset"],
    libraries: ["groupplots"]
  },
  parseEnvironment(env, context) {},
  parseCommand(command, context) {},
  evaluate(statement, context) {},
  capabilities: []
};
```

Important rule: PGFPlots cannot be a black box. It registers coordinate systems
such as `axis cs:`, exports anchors such as `current axis.north east`, affects
bbox/clipping, contains nested TikZ statements, and needs text measurement for
ticks, labels, legends, and titles.

## TikZKit Changes Already Informed By This Study

This research has already influenced TikZKit in two concrete places:

1. `src/frontend/parser.js`
   - exposes a `figures` inventory;
   - supports `activeFigureId`;
   - parses one selected `tikzpicture` while preserving preceding preamble
     context.

2. `scripts/render-example-fixtures.js`
   - can pass `activeFigureId` through TikZKit rendering;
   - can generate `tikztosvg` input for the same selected figure;
   - shows active figure metadata in the comparison HTML.

3. `src/renderers/svg/textEngine.js`
   - keeps plain-text alignment as part of the text-engine measurement/cache
     contract;
   - renders cached wrapped text with the same left/center/right alignment
     requested by the semantic text layout path;
   - keys cached plain-text and math payloads by render-affecting style
     inputs such as color and font family, so repeated formulas or labels do
     not reuse stale styled SVG/HTML payloads.

These are directly modeled after `tikz-editor`'s source-aware editor boundary.

## Practical Use Policy

Use `tikz-editor` for:

- base TikZ parser/evaluator architecture;
- text measurement loop;
- node and anchor geometry;
- arrow geometry and shortening;
- capability matrix discipline;
- comparison workflow design.
- broad, recoverable grammar shape;
- source-preserving edit/roundtrip architecture;
- browser/desktop split and lazy renderer services.

Do not use it as the source of truth for:

- PGFPlots;
- datavisualization;
- CircuiTikZ;
- package-specific TeX macro behavior;
- visual fidelity against native TikZ output.

For those, TikZKit must compare against local MacTeX and local `tikztosvg`.

## TikZKit Mapping

Current TikZKit already has many of the target folders:

```txt
src/frontend
src/engine
src/tikz/commands
src/libraries
src/packages
src/pgfplots
src/scene
src/renderers/svg
src/capabilities
```

The next architectural cleanup should not be a directory rename. It should be
contract hardening:

1. Parser outputs AST plus diagnostics only.
2. Engine owns all TikZ semantics, package hooks, text measurement, node
   geometry, coordinate systems, path lowering, and capabilities.
3. SceneGraph contains renderer-neutral elements plus bbox/source metadata.
4. SVG renderer only serializes SceneGraph and owns SVG defs/escaping/text
   payload emission.
5. PGFPlots/datavisualization lower through package-specific models such as
   AxisModel/DataSurvey/VisualizerModel before they become SceneGraph.

## Next Implementation Slices

Highest-value follow-ups:

1. Finish a real `TextEngine` boundary for KaTeX/scoped math measurement.
2. Move node geometry and anchor border intersection into one semantic module.
3. Consolidate arrow shortening/tip placement into one renderer path pipeline.
4. Strengthen `src/capabilities/*` so every non-unsupported feature has a
   fixture and owner module.
5. Keep PGFPlots/datavisualization as package add-ons with Axis/Data models
   lowered to SceneGraph.

Concrete migration candidates from the 2026-07-09 review:

1. Text rendering: port the `NodeTextEngine` contract shape from
   `packages/core/src/text/types.ts` and the async two-pass render loop from
   `packages/core/src/render/index.ts`. TikZKit can still use KaTeX first, but
   the measurement/render payload must be the same data used by node geometry.
2. Arrows: use the split from `packages/core/src/svg/arrows/*` as the target
   module boundary: normalize tip, compute metrics, shorten shaft, sample
   tangent, place local tip path, render SVG path. This is the right fix for
   dashed/dotted/double arrow overrun.
3. Anchors: use `semantic/nodes/named-coordinates.ts`, `anchors.ts`, and
   `shape-geometry.ts` as reference for storing named node geometry during
   semantic evaluation and resolving bare `(node)` endpoints via border
   intersection.
4. Capability matrix: expand TikZKit's existing `src/capabilities/*` so each
   row records owner module, fixture ids, comparison artifact, and parser /
   semantic / SVG status. "No diagnostics" is not enough.
5. Renderer comparison: compare `scripts/compare-tikz-renderers.mjs` and
   `scripts/compare-pgf-docs-renderings.mjs` with TikZKit's
   `scripts/render-example-fixtures.js`. The useful behavior is preserved
   TeX context plus side-by-side SVG/PNG outputs, not just numeric diff.

Acceptance rule: a borrowed idea counts only when a focused fixture shows
TikZKit SVG beside `tikztosvg` SVG and the visual behavior improves.
