# `fit` Matrix `tikzmark` Overlay QA

## Scope

This pass accepts one bounded shared capability: a standalone display-math
`array` with internal `tikzmark` anchors can lower to a matrix of ordinary
math nodes, and a same-picture `fit` overlay can span the marked cells without
shrinking their math or dropping an explicit minimum dimension.

The real acceptance case is
`test/fixtures/examples/latex-examples/jordan-normal-form-block.tex`. It uses
two `\Highlight` calls: blue spans `1.north west` to `2.south east`; red spans
the zero-size marker at the final `\lambda_i` cell. This is not a claim of
general cross-picture or page-level `remember picture` support.

## Local MacTeX Reading

Reviewed TeX Live 2025 locally:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryfit.code.tex`:
  the `fit` key visits all referenced node anchors, records their west/east and
  north/south extents, then fixes the resulting node's center and text box.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-fit.tex`:
  the public contract confirms that `fit` preserves normal node sizing keys
  after it has collected the fitted bounds.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarymatrix.code.tex`:
  `matrix of math nodes` is based on normal math nodes; it does not shrink each
  math glyph to an inferred matrix cell.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/tools/array.sty`:
  the standard centered array columns contain `\arraycolsep` glue on both
  sides. The focused lowering needs an equivalent practical column gap because
  its SVG node bounds contain glyphs, not TeX alignment boxes.

## References And Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. All artifacts are local and deliberately
untracked:

`/private/tmp/tikzkit-qa-jordan-fit-final2-2026-08-07/`

- MacTeX PNG: `mactex-png/latex-examples-jordan-normal-form-block.png`
- TikZKit SVG/PNG: `tikzkit-svg/` and `tikzkit-png/`
- tikztosvg SVG/PNG: `tikztosvg-svg/` and `tikztosvg-png/`
- 1 cm grids: `tikzkit-grid-png/` and `tikztosvg-grid-png/`
- four-way panel: `diff/latex-examples-jordan-normal-form-block-native-sheet.png`
- registered diff: `diff-png/latex-examples-jordan-normal-form-block-registered.png`

The tikztosvg root is `149.224pt x 77.745pt` with an ordinary `viewBox`; its
glyphs and highlight shapes are SVG paths under a flipped transform, not
`foreignObject` or browser text. Its blue rounded rectangle is approximately
`1.907cm` wide and its red rectangle approximately `0.478cm` wide. TikZKit
uses selectable SVG text plus semantic rounded-rectangle paths; its final
canvas is `149.27pt x 78.46pt`.

## Visual Result

Before this change, TikZKit shrank math text to inferred matrix-cell boxes.
The blue overlay was only `1.747cm` wide, the red overlay only `0.438cm` wide,
and `\lambda_i` rendered at about `29.69` SVG units. The upper-left highlight
visibly missed part of the third column and the red fit box was narrow.

After the change, the blue fit region is `1.915cm x 1.415cm`, the red fit
region is `0.480cm x 0.560cm`, and lambda returns to `35.15` SVG units. In the
MacTeX/TikZKit/tikztosvg panel the blue box covers the intended three-column,
three-row block, the red box encloses the final lambda cell, and parenthesis,
matrix rows, and the left formula keep their relative positions. The one-grid
panels also show the same content scale and anchor positions.

The registered diff still contains text-outline and antialiasing residuals,
plus a one-pixel outer canvas-height difference. It no longer indicates a
missing cell, shifted highlight, or compressed mathematical label.

## Implementation

- `src/engine/evaluate.js`: only matrix cells marked by the focused lowering
  skip the renderer-only shrink-to-cell pass; ordinary matrix and `pmatrix`
  measurement remains unchanged. `resolveFitNodeLayout` now honors `minimum
  width`, `minimum height`, and `minimum size` after collecting the fit bounds.
- `src/tikz/libraries/tikzmark.js`: the focused marked-array lowering restores
  a practical centered-column gap, calibrates the terminal zero-size marker
  with a width as well as height, and tightens only its right bounding-box
  crop.
- `src/tikz/libraries/fit.js`, `docs/extension-registry.{md,csv}`: record the
  reviewed local source, implementation owner, support boundary, and remaining
  limitations.
- `test/tikzmark-math-overlay.test.js`: protects the lowered options,
  diagnostic-free output, fitted rectangle dimensions, unshrunk lambda font,
  and document bounds.

## Verification

```sh
node --test test/tikzmark-math-overlay.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --only latex-examples-jordan-normal-form-block \
  --output /private/tmp/tikzkit-qa-jordan-fit-final2-2026-08-07 \
  --native-reference --strict-tikztosvg --comparison-grid-mode svg \
  --continue-on-external-failure
npm run examples:diff -- --output /private/tmp/tikzkit-qa-jordan-fit-final2-2026-08-07 \
  --register --alignment-radius 3
npm run gallery:audit
```

The focused test and the real three-way artifact generation pass with zero
TikZKit diagnostics. `gallery:audit` is used as the broader no-regression
check before this slice is committed.

`npm test` was also run. It remains non-green on the separate existing
`test/convert.test.js` inline `pmatrix` metric assertion: its current result
is `2.1443cm` while that test expects `1.945cm`. This slice does not alter the
ordinary node or inline-`pmatrix` measurement path, so the discrepancy is
recorded for a dedicated formula-metrics pass rather than hidden by weakening
that unrelated expectation.

## Remaining Boundary

Arbitrary TeX array preambles and glue, `multicolumn`, page-level
remembered-picture coordinates, fit rotation, and arbitrary affine transforms
remain outside this slice. The next useful target is a non-matrix fit case
that exercises explicit coordinates together with ellipse or circle fit
shapes.
