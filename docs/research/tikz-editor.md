# DominikPeters/tikz-editor Research Notes

Source reviewed: `https://github.com/DominikPeters/tikz-editor`, cloned locally to `/private/tmp/tikz-editor-study` on 2026-07-07.

## Summary

`tikz-editor` is not just a wrapper around LaTeX. Its web editor has an in-process TypeScript renderer:

```txt
TikZ source
  -> parser / lossless AST
  -> semantic evaluator
  -> scene graph
  -> SVG emitter
```

The desktop app also has an optional native `latex` + `dvisvgm` compile bridge, but that is not the browser live renderer. The browser shell is thin; it mounts the React app and a platform adapter. TikZ semantics live in `packages/core`.

This makes it a useful reference for TikZKit's base TikZ renderer: path parsing, coordinates, node geometry, anchors, arrows, foreach, matrices, trees, text measurement, SVG emission, and capability tracking. It is not a replacement for our PGFPlots/datavisualization/circuitikz work.

## Files Reviewed

- `README.md`: web/desktop WYSIWYG editor, supported feature groups, stated partial features.
- `DEVELOPMENT.md`: parser -> semantic evaluator -> SVG backend -> render API.
- `AGENTS.md`: project map, capability matrix workflow, TeX renderer comparison workflow.
- `packages/core/src/index.ts`: public exports and core API surface.
- `packages/core/src/parser/index.ts`: Lezer parser entrypoint, active figure scan, contextual preamble definitions, diagnostics.
- `packages/core/src/render/index.ts`: end-to-end render API and MathJax text engine wiring.
- `packages/core/src/semantic/evaluate.ts`: semantic evaluator orchestration, foreach/macro expansion, context setup, feature usage.
- `packages/core/src/semantic/types.ts`: scene graph and semantic metadata types.
- `packages/core/src/semantic/coords/evaluate.ts`: coordinate evaluation, calc, polar, intersection coordinates, named anchors.
- `packages/core/src/semantic/nodes/layout.ts`: node layout, `text width`, inner/outer sep, baseline/midline, shape sizing.
- `packages/core/src/semantic/nodes/anchors.ts`: shape-specific anchor offsets and named node anchor registration.
- `packages/core/src/semantic/nodes/shape-geometry.ts`: shape geometry algorithms.
- `packages/core/src/semantic/style/arrows.ts`: arrow parsing and PGF-inspired defaults.
- `packages/core/src/svg/arrows/*`: arrow metrics, shortening, placement, shapes, rendering.
- `packages/core/src/svg/emit.ts`: SVG emission, gradients, patterns, clipping, text payload insertion.
- `packages/core/src/capabilities/*`: capability matrix.
- `scripts/compare-tikz-renderers.mjs`: focused renderer-vs-TeX comparison harness.
- `scripts/compare-pgf-docs-renderings.mjs`: PGF/manual corpus comparison harness.
- `apps/desktop/src-tauri/src/lib.rs`: native `latex` + `dvisvgm` bridge.

## Borrowable Architecture

### Capability Matrix

The project tracks feature status in:

```txt
packages/core/src/capabilities/feature-ids.ts
packages/core/src/capabilities/matrix.ts
packages/core/src/capabilities/registries.ts
test/capabilities.spec.ts
```

Each feature records `parser`, `semantic`, `svg`, and `edit` status plus fixtures. Tests fail when matrix rows, registries, and fixtures drift.

TikZKit mapping:

```txt
src/capabilities/feature-ids.js
src/capabilities/matrix.js
src/capabilities/registries.js
test/capability-matrix.test.js
```

The guard should fail when a stable feature still emits unsupported diagnostics, or a feature row has no fixture.

### Text Engine Boundary

`renderTikzToSvgAsync` creates a `NodeTextEngine` and passes it into semantic evaluation and SVG emission. The text engine measures first, then node layout uses:

```txt
width
height
baselineY
midLineY
paragraph/layout metadata
render cache key
```

This is the model TikZKit should use for KaTeX. Current formula clipping and bad `text width`/node sizing problems come from discovering math dimensions too late.

Recommended TikZKit boundary:

```txt
src/renderers/svg/mathNode.js
  -> measure(text, font, textWidth, mode)
  -> renderFromCache(cacheKey)

src/renderers/svg/textLayout.js
  -> consumes measured metrics before node shape/anchor computation
```

### Node Geometry And Anchors

`tikz-editor` records node anchor targets as semantic artifacts, not renderer-local calculations. That lets rendering, snapping, path endpoint attachment, and editing all use the same node geometry.

Important model pieces:

```txt
Node layout metrics
  -> shape-specific border geometry
  -> anchor offsets
  -> named anchor targets
  -> path endpoint resolution
```

TikZKit should avoid per-case coordinate patches and keep this logic centralized in node geometry modules.

### Arrow Model

The implementation separates:

```txt
arrow option parsing
  -> normalized arrow marker/tip model
  -> shortening computation
  -> path sampling/frame extraction
  -> tip local geometry
  -> placed SVG paths
```

This is directly relevant to TikZKit's recurring bugs where dashed/dotted/double paths extend into arrow tips. The shaft must be shortened before the tip path is drawn.

TikZKit mapping:

```txt
src/tikz/libraries/arrows.meta.js
src/tikz/metrics.js
src/renderers/svg/paths.js
src/renderers/svg/markers.js
```

### Renderer Comparison Harness

`scripts/compare-tikz-renderers.mjs` creates:

- renderer input;
- our SVG/PNG;
- standalone TeX;
- PDF/PNG or DVI/SVG/PNG reference;
- side-by-side comparison artifacts;
- JSON report with diagnostics.

This is close to our current `examples:render`/`examples:diff`, but their script treats comparison as a first-class developer workflow. TikZKit should keep `tikztosvg` output in the same artifact directory as JS output and avoid relying only on numeric diff.

## Confirmed Boundaries

Source search did not show a first-class implementation for:

- `\begin{axis}`;
- `\addplot`;
- full PGFPlots range/axis/tick/colorbar engine;
- PGFPlots 3D surface plots;
- datavisualization survey/visualizer pipeline;
- circuitikz components.

It has ordinary TikZ plot operation support, plot coordinates, expression plot operations, plot markers, and some smoothing/ybar behavior. It should be used as a reference for base TikZ, not as a substitute for MacTeX PGFPlots source or local `tikztosvg`.

## Actionable TikZKit Follow-Ups

1. Strengthen TikZKit's capability matrix so every feature has parser/semantic/SVG status and fixtures.
2. Refactor arrow rendering toward parse -> metrics -> shorten -> place -> render.
3. Wrap KaTeX in a text engine boundary that measures before node layout and anchor resolution.
4. Store node anchor targets and node geometry as semantic/scene metadata.
5. Keep PGFPlots/datavisualization/circuitikz driven by MacTeX source and `tikztosvg`, not by `tikz-editor`.
6. Keep the web app thin: editor UI should consume `convertTikzToSvg`/SceneGraph outputs, not implement TikZ semantics.

## First Migration Slice

Do not import the whole project. The practical first slice is:

```txt
capability matrix guard
  -> arrow metrics/shortening parity
  -> KaTeX text measurement boundary
  -> node geometry metadata
  -> comparison harness cleanup
```

This order targets the problems that repeatedly affect visual parity: unsupported feature drift, arrow shape/shortening, formula clipping, bad node sizes, and weak visual comparison artifacts.
