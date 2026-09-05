# Spy Magnified Scene QA (2026-09-06)

## Scope

This slice fixes the largest remaining visual omission in the `spy` library:
the spy-in lens used to replay only flattened stroked path segments. Filled
areas, curves, node shapes, labels, and formulas disappeared from the
magnified view.

The acceptance boundary is:

- circle and rectangle spy-in lenses;
- ordinary filled and stroked paths, including cubic Bezier commands and
  closed subpaths;
- ordinary node shapes and text/formula nodes;
- markers, shadows, and raster-image scene items;
- canvas magnification of geometry, line widths, dash metrics, arrow metrics,
  node dimensions, and physical font sizes;
- one shared SVG clip for all replayed items in a lens.

This slice does not claim nested spy scopes, arbitrary lens rotations or
affine transforms, custom `spy connection path` code, non-circle/non-rectangle
lenses, or references to nodes declared after the `\spy` statement.

The permanent visual drivers are:

- `spy-magnified-scene-algorithm`, a two-state dispatch flow enlarged in a
  rectangular lens;
- `spy-magnified-scene-math`, a filled parabola, cubic/plot path, circle node,
  and `$x_0$` enlarged in a circular lens;
- `spy-magnified-scene-physics`, a source charge, formula, label, arrow, and
  translucent overlay enlarged together.

## Local MacTeX Review

Reviewed these local TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryspy.code.tex`;
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-spy.tex`, especially the canvas-transformation, spy command, lens, magnification, and connection sections around lines 55-110 and 174-338.

The frontend source stores each `\spy` request and creates the spy-on and
spy-in nodes at the end of the spy scope. `magnification=N` is shorthand for a
`lens={scale=N}` canvas transformation. The manual explicitly states that the
picture of the current spy scope is canvas-transformed and clipped inside the
spy-in node. Consequently, magnification applies to text and stroke width as
well as coordinates; it is not equivalent to clipping individually flattened
line segments.

TikZKit now clones supported renderer-neutral scene items, applies the same
translation-plus-scale mapping around the spy-on point, scales physical paint
metrics, and assigns one lens clip to every replayed item. SVG construction
remains in the renderer.

## Implemented Syntax

| Syntax | Parameters verified |
| --- | --- |
| `spy using outlines={...}` | `circle`, `rectangle`, `magnification`, `size`, `width`, `height`, `connect spies`, stroke color |
| `spy using overlays={...}` | translucent source/target fill defaults, color, independent lens placement |
| `\spy[options] on (P) in node [options] at (Q);` | source and target shape overrides, placement, target dimensions |
| path replay | stroke, fill, opacity, closed subpaths, cubic curves, line cap/join, dashes, arrow metrics |
| node replay | shape geometry, fill/stroke, dimensions, text, inline math, font size, clipping |

Still unsupported in this slice:

- nested spy scopes and spying on an already-created spy;
- arbitrary `lens={scale=...,rotate=...}` or general affine lens transforms;
- arbitrary `spy connection path={CODE}` execution;
- custom lens shapes and their border paths;
- deferred references to material declared after `\spy`;
- low-level PGF objects that have no scene-graph representation.

## Reference Tools And SVG Structure

Local tools used:

- tikztosvg: `/Library/TeX/texbin/tikztosvg`;
- MacTeX: `/Library/TeX/texbin/pdflatex`;
- SVG-to-PNG: `/opt/homebrew/bin/rsvg-convert`.

In the inspected tikztosvg math SVG, the magnified grid and curve use
`transform="matrix(4,0,0,-4,...)"` inside repeated circular clip paths. Its
filled parabola remains a closed filled path, the curve keeps its path
geometry, and formula glyph paths are scaled and clipped with the rest of the
picture. Stroke widths inside the lens are four times their source widths.

TikZKit now emits a shared `<clipPath><circle .../></clipPath>` or rectangle
clip and wraps every magnified path, node, and text item with the corresponding
`clip-path`. It preserves `curveTo` and `closePath` commands. The math driver,
for example, scales the source blue curve stroke from about 4.22 SVG units to
16.87 and the `$x_0$` font from about 35.15 to 140.58 SVG units at 4x.

## Visual Result

Before the change:

- the algorithm lens showed only the blue dispatch arrow segment; the queued
  and running node boxes, fills, text, and dispatch label were absent;
- the math lens showed only a diagonal fragment of the blue parabola; the
  filled region, circular node, and enlarged `$x_0$` were absent;
- the physics lens showed only the horizontal axis; the source charge fill,
  circle outline, `$q$`, and `source` label were absent.

After the change:

- the algorithm lens contains the magnified colored node interiors, borders,
  state text, dispatch label, and arrow, all clipped at the rectangular edge;
- the math lens contains the filled parabola region, curve, node outline, and
  complete 4x formula with the same circular crop behavior as MacTeX;
- the physics overlay contains the green translucent lens, magnified charge
  node and formula, source label, arrow, and scaled strokes;
- all three TikZKit renders have zero diagnostics, and both tikztosvg and
  MacTeX complete without external failures.

The remaining visible differences in the accepted drivers are minor font
rasterization, anti-aliasing, and a few pixels of tight-crop whitespace. The
requested scene layers, lens geometry, magnification, clipping, colors, and
relative positions are present.

## Artifacts

Before:

`/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa/2026-09-06-spy-magnified-scene-before/`

After:

`/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa/2026-09-06-spy-magnified-scene-after/`

Both directories contain TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG,
registered diffs, and native four-way sheets. Generated artifacts remain
ignored by Git under the repository artifact policy.

## Verification

```bash
node --test test/spy-rectangular-lenses.test.js

node scripts/render-example-fixtures.js \
  --output outputs/qa/2026-09-06-spy-magnified-scene-after \
  --only spy-magnified-scene-algorithm \
  --only spy-magnified-scene-math \
  --only spy-magnified-scene-physics \
  --continue-on-external-failure --strict-tikztosvg \
  --native-reference --native-latex-engine pdflatex \
  --tikztosvg-engine pdflatex --math-renderer svg-text

node scripts/diff-example-pngs.js \
  --output outputs/qa/2026-09-06-spy-magnified-scene-after --register

npm run extension-registry
npm test
```

The nine focused spy tests pass. The full suite reports 2,507 tests with 2,357
passing, 136 failing, and 14 skipped. The committed pre-change baseline
reported 2,505 tests with 2,355 passing, 136 failing, and 14 skipped: both
added tests pass and the existing failure count does not increase. Existing
unrelated failures include the missing `semanticOwner` on
`circuitikz-varcap-diodes` and older architecture/timeline expectations; none
is caused by this slice.
