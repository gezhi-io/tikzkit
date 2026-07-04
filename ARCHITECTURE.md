# TikZKit Architecture

TikZKit is organized as a compiler-style pipeline:

```txt
TikZ source
  -> frontend parse
  -> TikZ AST
  -> engine evaluation
  -> Scene Graph
  -> SVG renderer
```

The public interface is intentionally small:

```js
import { tikzToSvg, parseTikz, interpretTikz, renderSvg } from "./src/index.js";
```

`tikzToSvg(source, options)` still composes the same three stages:

```txt
frontend.parseTikz(source, options)
engine.interpretTikz(ast, options)
renderers.svg.renderSvg(ir, options)
```

## Current Structure

The repository already has one-file-per-command and one-file-per-library catalogs:

```txt
src/
  commands/                 # command metadata: draw, node, coordinate, axis, addplot
  libraries/                # TikZ library metadata and helpers
  packages/                 # TeX package metadata
  extensions/               # third-party package preprocessors/compat layers

  parser.js                 # current frontend implementation
  interpreter.js            # current engine implementation
  renderer-svg.js           # current SVG renderer implementation
  preprocess.js             # TeX-lite and package preprocessing
```

The main debt is not the existence of these files. The debt is that a few root
files are too broad:

- `src/preprocess.js`: TeX-lite expansion, package compatibility, macro handling.
- `src/interpreter.js`: TikZ semantic evaluation, scene graph creation, node metrics,
  path construction, libraries, transforms, and extension behavior.
- `src/renderer-svg.js`: SVG output, text rendering, marker defs, gradients, patterns,
  node shape rendering, and fallback math rendering.

Those files should be split gradually. They should not be moved all at once.

## New Layer Entrypoints

The current migration starts by adding stable seams without breaking old imports:

```txt
src/frontend/
  index.js
  ast.js                    # AST shape factories for tests and future parser split
  diagnostics.js            # diagnostic helpers
  lexer.js                  # small TikZ-ish tokenizer seam
  parser.js                 # re-exports the current parser implementation

src/engine/
  index.js
  context.js                # scope/context factory
  evaluate.js               # interpretTikz / evaluateTikzAst
  math.js                   # math and unit-facing exports
  options.js                # TikZ option-facing exports
  pathBuilder.js            # renderer-neutral path command builder
  registry.js               # command/library registry seam
  transforms.js             # affine transform helpers
  units.js                  # TikZ unit and line-width exports

src/scene/
  index.js
  bbox.js                   # renderer-neutral bounding-box helpers
  sceneGraph.js             # renderer-neutral drawing container helpers
  shapes.js                 # path/text/group item factories
  style.js                  # renderer-neutral style defaults

src/renderers/svg/
  defs.js
  escape.js
  index.js
  pathData.js
  renderSvg.js              # SVG renderer seam
  text.js

src/pgfplots/
  axis.js                   # PGFPlots Axis Model seam
  axisOptions.js
  ranges.js
  geometry.js
  ticks.js
  grid.js
  addplot.js
  coordinates.js
  labels.js
  marks.js
  transformDataToCanvas.js  # data coordinate -> TikZ canvas coordinate

src/tikz/
  registerCoreTikz.js       # command/library registration
  commands/                 # TikZ-facing command adapters
  libraries/                # TikZ-facing library adapters

src/cli/
  main.js                   # CLI adapter implementation with injectable IO

src/adapters/
  filesystem.js             # read/write text files
  externalLatex.js          # optional external command adapter

src/shared/
  errors.js
  result.js
  sourceMap.js
```

Old paths remain valid for now. New code should prefer the layered paths.

## Ownership Rules

These rules are the important part of the structure:

- `frontend/` owns source parsing and syntax diagnostics.
- `engine/` owns TikZ semantics: variables, styles, coordinates, transforms, paths,
  nodes, scopes, and library behavior.
- `tikz/commands/` owns command metadata and command-level registration.
- `tikz/libraries/` owns TikZ library metadata and library-level registration.
- `pgfplots/` owns PGFPlots semantics before they become ordinary Scene Graph
  items: axis ranges, ticks, grid intent, labels, plot data, marks, and
  data-coordinate-to-canvas-coordinate transforms.
- `scene/` owns renderer-neutral drawing data.
- `renderers/svg/` owns SVG-specific serialization, defs, text, markers, escaping,
  and SVG coordinate conversion.
- `extensions/` owns third-party package compatibility and TeX-lite expansion that
  turns package commands into ordinary TikZ semantics.
- `cli/` owns command-line argument handling and process IO coordination.
- `adapters/` owns external effects such as filesystem and optional local TeX tools.
- `shared/` owns cross-layer result and error primitives.

Parser code must not build SVG. Renderer code must not understand TeX source.
TikZ semantics should be represented in the Scene Graph before rendering.

## Migration Order

1. Keep `src/index.js` routed through `frontend -> engine -> renderers/svg`.
2. Move pure Scene Graph helpers out of `interpreter.js` into `scene/`.
3. Move path construction and coordinate resolution out of `interpreter.js` into
   `engine/pathBuilder.js`, `engine/coordinates.js`, and `engine/transforms.js`.
4. Move SVG marker, path data, text, defs, and shape rendering out of
   `renderer-svg.js` into `renderers/svg/`.
5. Move PGFPlots axis internals out of `preprocess.js` into `pgfplots/` around
   the Axis Model seam. `\begin{axis}` should produce an axis model first; only
   then should it lower to ordinary TikZ/Scene Graph primitives.
6. Move TeX-lite macro expansion families out of `preprocess.js` into smaller
   package/extension modules only when a test or real case proves the seam.

Each migration step must keep old public exports working until callers and tests
are updated.

## Test Strategy

Architecture tests should verify seams, not implementation details:

- frontend can parse a simple TikZ source.
- engine can evaluate the AST into drawing items.
- SVG renderer can serialize the drawing.
- core TikZ registry exposes known commands and libraries.

Behavioral visual tests should continue to live next to the feature they protect:

- parser behavior in `test/parser.test.js`
- TikZ semantics in `test/interpreter.test.js`
- SVG output in `test/renderer.test.js`
- package/library compatibility in extension-specific tests
