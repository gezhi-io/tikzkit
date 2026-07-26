# PGFPlots QA: CSV Two-Axis Overlay

## Scope

This pass covers one PGFPlots feature slice only: a same-size, consecutive
`hide x axis, axis y line*=right` secondary axis over a primary middle-axis
CSV plot. The driver is
`test/fixtures/examples/latex-examples/csv-line-plot-two-axes.tex`.

The acceptance target is not a diff percentage. The primary left/middle axes,
the secondary right axis, the four series, the legend, and the labels must
occupy the same coordinate system as native MacTeX.

## Local MacTeX Reading

Read `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`:

- `hide x axis` is an independent axis visibility flag.
- `axis y line*=right` moves the y axis and its ticks to the right side.
- `legend style` is appended to the axis legend options.
- `enlarge y limits` participates in the transform range rather than simply
  expanding painted data.

Also read the document-level dependencies used by this fixture:

- `inputenc.sty`: source encoding selection only here.
- `babel.sty`: the `ngerman` option does not alter this ASCII plot geometry.
- `fontenc.sty`: text encoding selection, delegated to SVG text shaping.
- `geometry.sty`: page margin settings, outside a standalone SVG scene.
- `latex.ltx`: document shell commands are intentionally removed before TikZ
  evaluation.

The detailed per-command, option, and numeric review is in
`outputs/semantic-audits/csv-line-plot-two-axes.md`; strict audit status is
`accepted` with 5 packages, 6 commands, 2 axis environments, 29 option
features, and 10 numeric groups reviewed.

## Fix

`src/pgfplots/geometry.js` now applies the same power-of-ten tick scaling used
by rendering before it estimates tick-label width. It also recognizes grouped
numeric text such as `1,000` as numeric. Previously the geometry pass measured
raw values such as `20,000,000`, selected a generic text reserve, and shifted
the primary plot box about `0.34cm` to the right. The right overlay was then
correct relative to the wrong primary box.

The regression test in `test/pgfplots-csv-overlay.test.js` asserts the native
layout reserve (`0.758cm`) for this large-scale middle-axis case.

## Visual Evidence

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion uses
local `rsvg-convert`.

- Native MacTeX PNG:
  `outputs/qa-pgfplots-overlay-right-axis-current/native-mactex/csv-line-plot-two-axes.png`
- TikZKit SVG/PNG plus 1cm grid:
  `outputs/qa-pgfplots-overlay-right-axis-current/tikzkit-grid-png/latex-examples-csv-line-plot-two-axes.png`
- tikztosvg SVG/PNG plus 1cm grid:
  `outputs/qa-pgfplots-overlay-right-axis-current/tikztosvg-grid-png/latex-examples-csv-line-plot-two-axes.png`
- Four-panel native/TikZKit/tikztosvg/diff sheet:
  `outputs/qa-pgfplots-overlay-right-axis-current/diff/latex-examples-csv-line-plot-two-axes-sheet.png`

Visual inspection after the fix shows the main left/middle frame, right-side
tick labels, data mapping, legend, and `seconds` label share the same layout
origin. The remaining visible differences are font-outline/rasterization and
antialiasing; TikZKit's canvas is about `3.7pt` taller than tikztosvg for this
fixture. They are not a remaining coordinate-system offset.

## Verification

```sh
npm run case:audit -- test/fixtures/examples/latex-examples/csv-line-plot-two-axes.tex \
  --review outputs/semantic-audits/csv-line-plot-two-axes.review.json \
  --output outputs/semantic-audits/csv-line-plot-two-axes.md --strict

node --test --test-name-pattern "middle-axis layout measures grouped" \
  test/pgfplots-csv-overlay.test.js

node scripts/render-example-fixtures.js \
  --only latex-examples-csv-line-plot-two-axes \
  --output outputs/qa-pgfplots-overlay-right-axis-current \
  --comparison-grid svg --tikztosvg-engine xelatex
```

The strict audit and targeted regression pass. A broader pre-existing failure
in the same test file (`numeric boxed-axis enlargement expands both transform
bounds`) is outside this hunk and remains to be repaired separately.

## Remaining Work

PGFPlots remains `partial`: arbitrary multi-axis placement, all secondary
axis combinations, exact TeX font metrics, and final SVG bounding-box
calibration still require case-driven work.
