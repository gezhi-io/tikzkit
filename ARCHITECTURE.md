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
  parser.js                 # re-exports the current parser implementation

src/engine/
  index.js
  evaluate.js               # interpretTikz / evaluateTikzAst
  math.js                   # math and unit-facing exports
  options.js                # TikZ option-facing exports
  registry.js               # command/library registry seam

src/scene/
  index.js
  sceneGraph.js             # renderer-neutral drawing container helpers

src/renderers/svg/
  index.js
  renderSvg.js              # SVG renderer seam

src/tikz/
  registerCoreTikz.js       # command/library registration
  commands/                 # TikZ-facing command adapters
  libraries/                # TikZ-facing library adapters
```

Old paths remain valid for now. New code should prefer the layered paths.

## Ownership Rules

These rules are the important part of the structure:

- `frontend/` owns source parsing and syntax diagnostics.
- `engine/` owns TikZ semantics: variables, styles, coordinates, transforms, paths,
  nodes, scopes, and library behavior.
- `tikz/commands/` owns command metadata and command-level registration.
- `tikz/libraries/` owns TikZ library metadata and library-level registration.
- `scene/` owns renderer-neutral drawing data.
- `renderers/svg/` owns SVG-specific serialization, defs, text, markers, escaping,
  and SVG coordinate conversion.
- `extensions/` owns third-party package compatibility and TeX-lite expansion that
  turns package commands into ordinary TikZ semantics.

Parser code must not build SVG. Renderer code must not understand TeX source.
TikZ semantics should be represented in the Scene Graph before rendering.

## Migration Order

1. Keep `src/index.js` routed through `frontend -> engine -> renderers/svg`.
2. Move pure Scene Graph helpers out of `interpreter.js` into `scene/`.
3. Move path construction and coordinate resolution out of `interpreter.js` into
   `engine/pathBuilder.js`, `engine/coordinates.js`, and `engine/transforms.js`.
4. Move SVG marker, path data, text, defs, and shape rendering out of
   `renderer-svg.js` into `renderers/svg/`.
5. Move TeX-lite macro expansion families out of `preprocess.js` into smaller
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
