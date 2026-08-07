# Form-Only Pattern Page-Origin QA - 2026-08-07

## Scope

This pass changes one shared `patterns` capability only: the repeat phase of
explicitly rendered `\pgfdeclarepatternformonly` tiles. It does not extend the
set of supported PGF primitives or pattern transforms.

## Local MacTeX Review

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepatterns.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibrarypatterns.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarypatterns.code.tex`

`pgfcorepatterns.code.tex` records the paint bounds independently from the
repeat step and resets the transformation before it executes the pattern
procedure. The built-in checkerboard declares 4mm steps and paints two 2mm
rectangles. The SVG backend applies that tile in page coordinates: a standalone
border or text-driven crop changes the visible phase even though the TikZ path
coordinates do not change.

## Implementation

`src/renderers/svg/renderSvg.js` now passes the cropped SVG page's left and
bottom origin to `renderFormOnlyPatternFill`. The explicit tile expansion uses
that origin for every line, circle, and rectangle primitive. It no longer
restarts tiles at TikZ `(0,0)`, which had inverted the checkerboard phase when
the source had a standalone border.

## Three-Way Visual QA

Driver: `test/fixtures/examples/patterns/form-only-primitives.tex`

- MacTeX native PNG: `outputs/qa-pattern-primitives-after-2026-08-07/mactex-png/pgf-pattern-form-only-primitives.png`
- TikZKit SVG/PNG: `outputs/qa-pattern-primitives-after-2026-08-07/tikzkit-svg/` and `outputs/qa-pattern-primitives-after-2026-08-07/tikzkit-png/`
- tikztosvg SVG/PNG: `outputs/qa-pattern-primitives-after-2026-08-07/tikztosvg-svg/` and `outputs/qa-pattern-primitives-after-2026-08-07/tikztosvg-png/`
- Native/tikztosvg/TikZKit/diff sheet: `outputs/qa-pattern-primitives-after-2026-08-07/diff/pgf-pattern-form-only-primitives-native-sheet.png`

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg` and rasterized with
`/opt/homebrew/bin/rsvg-convert`. Its SVG emits a 4mm checkerboard tile with a
negative-y `patternTransform`, confirming that the SVG page basis, rather than
the local path basis, controls vertical phase.

Before the change, TikZKit painted the checkerboard with the opposite visible
phase: native and tikztosvg began with an orange square in the upper-left of
the checkerboard fill, while TikZKit began with white. After the change, the
4mm grid, top-left orange square, and alternating cells agree in all three
renderings. The real comparison changed from `43.25%` changed pixels and
`0.08720` mean absolute RGBA difference to `23.07%` and `0.02126`.

The remaining visible difference is dot edge anti-aliasing and tiny raster
subpixel differences; no missing primitive or tile-position discrepancy was
observed.

## Verification

```sh
node --test test/pattern-declarations.test.js
npm run case:audit -- test/fixtures/examples/patterns/form-only-primitives.tex \
  --review test/fixtures/examples/patterns/form-only-primitives.review.json --strict
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-pattern-primitives-after-2026-08-07 \
  --only pgf-pattern-form-only-primitives --native-reference --comparison-grid-mode svg
npm run examples:diff -- --output outputs/qa-pattern-primitives-after-2026-08-07 \
  --only pgf-pattern-form-only-primitives
```

The `patterns` library remains **partial**: transforms, pattern arguments,
mutable or inherently-colored declarations, curves/arcs, polar paths, and
in-pattern color changes are still outside this verified slice.
