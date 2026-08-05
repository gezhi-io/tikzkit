# Patterns Form-Only Visual QA - 2026-08-05

## Scope

This review covers one `patterns` library slice only: form-only declarations made
with `\pgfdeclarepatternformonly`, using the constant point and path primitives
needed for dot, grid, checkerboard, brick, and line-hatch tiles. It does not claim
general PGF pattern compatibility.

## Local PGF Review

Reviewed local MacTeX sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepatterns.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibrarypatterns.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarypatterns.code.tex`

PGF separates the paint bounding box from the x/y tile step, resets the
transformation before executing a form-only pattern procedure, and uses
`pattern color` as the drawing ink. The bundled `dots` and `checkerboard`
definitions demonstrate the primitive protocol: `\pgfpathcircle`,
`\pgfpathrectangle`, and `\pgfusepath{fill}` inside independently repeated
tiles.

## Implementation

- The parser now preserves `\pgfdeclarepatternformonly` declarations as AST
  statements.
- The evaluator resolves constant `\pgfpoint`/`\pgfqpoint` values, captures
  supported PGF path operations, and associates the declaration with a later
  `pattern=<name>` fill.
- SVG uses the original path as a clip and expands the tile primitives explicitly.
  This avoids browser pattern-coordinate inversions and keeps repeated tiles
  inside the same filled region as PGF.

Supported procedure primitives: move-to, line-to, circle, rectangle, close,
and `fill`/`stroke`. Unsupported: declared pattern arguments, transforms,
arcs and curves, arbitrary TeX/macro execution in a procedure, mutable and
inherently-colored patterns, and in-pattern color changes.

## Artifacts

- Driver: `test/fixtures/examples/patterns/form-only-primitives.tex`
- Four-way sheet: `outputs/qa-patterns-form-only-final/diff/pgf-pattern-form-only-primitives-four-way.png`
- MacTeX native PNG: `outputs/qa-patterns-form-only-final/mactex-png/pgf-pattern-form-only-primitives.png`
- TikZKit SVG/PNG: `outputs/qa-patterns-form-only-final/tikzkit-svg/` and `outputs/qa-patterns-form-only-final/tikzkit-png/`
- tikztosvg SVG/PNG: `outputs/qa-patterns-form-only-final/tikztosvg-svg/` and `outputs/qa-patterns-form-only-final/tikztosvg-png/`

`tikztosvg` was available at `/Library/TeX/texbin/tikztosvg`; its SVG was
rasterized with `/opt/homebrew/bin/rsvg-convert`.

## Visual Result

Before this work, declared dot and checkerboard fills fell back to a generic
diagonal hatch. On the real `172x95` comparison canvas, that baseline differed
from tikztosvg on `71.22%` of pixels (mean absolute difference `0.1003`). The
implemented tiles visibly restore the circular dot lattice and alternating square
cells; the same comparison falls to `40.72%` and `0.0832`.

The sheet was inspected as MacTeX, TikZKit, tikztosvg, and diff panels. Tile
direction, pattern bounds, and checkerboard repetition now agree. Remaining
difference is mainly anti-aliasing and sub-pixel phase of the tiny dots, so this
library remains **partial**, not pixel-identical.

## Verification

```sh
node --test test/pattern-declarations.test.js
node --test test/library-modules.test.js
node scripts/render-example-fixtures.js --only pgf-pattern-form-only-primitives --out outputs/qa-patterns-form-only-final
```
