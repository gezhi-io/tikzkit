# PGFPlots Nodes-Near-Coords Cycle-Color Inheritance

## Scope

This is one PGFPlots post-marker-node slice: `nodes near coords` must inherit
the active plot color even when `\addplot` has no explicit color option. The
boundary is label foreground color and style order only. It does not change
bar geometry, point-meta templates, axis layout, legend placement, or text
metrics.

The visual driver is the real corpus case
`test/fixtures/examples/latex-examples/bar-chart-military-budget.tex`. It uses
`nodes near coords` and `every node near coord/.append style`, but its
`\addplot` relies on PGFPlots' default blue cycle color.

## Local MacTeX Study

Read TeX Live 2025 source
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex` at
lines 3166-3221:

- `nodes near coords defaults` declares `every node near coord` and the
  default `\pgfmathprintnumber\pgfplotspointmeta` content.
- `nodes near coords*` appends code after the marker.
- The generated node options concatenate the calculated alignment, then
  `\pgfplots@current@point@coordinatestyle`, then `every node near coord`
  (lines 3191-3200).

The essential consequence is ordering: the active coordinate style contains
the default cycle color, while a later user node style can deliberately replace
the text color. The JS lowering therefore adds the resolved plot color before
the existing per-axis/per-plot node styles.

## Syntax Audit

For the target case, the relevant source is now handled as follows:

- `\begin{axis}`, `ybar`, `nodes near coords`, `point meta=y`, `bar width`,
  `xmin`/`xmax`, tick/grid keys, and `\addplot coordinates` are existing
  PGFPlots paths.
- An unoptioned `\addplot` resolves through the normal PGFPlots cycle list;
  its near-coordinate nodes now receive `text=blue`.
- An explicit plot color still lowers to its resolved `text=<color>` value.
- `every node near coord/.style` and `.append style` remain later options, so
  a user `text=black` (or another explicit color) overrides inherited blue.

Still partial: arbitrary color expressions with opacity/mix semantics,
symbolic/derived point meta, general TeX label templates, and exact TeX
font-box geometry.

## Three-Way Visual QA

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; its PNG conversion
used `/opt/homebrew/bin/rsvg-convert`. MacTeX rendering used local `pdflatex`.
All artifacts live in the ignored directory
`outputs/qa-pgfplots-near-coord-color-2026-08-08/`:

- TikZKit SVG/PNG: `tikzkit-svg/` and `tikzkit-png/`
- tikztosvg SVG/PNG: `tikztosvg-svg/` and `tikztosvg-png/`
- MacTeX PNG: `mactex-png/`
- side-by-side sheets and diffs: `diff/`

Reviewed panels:

- `diff/latex-examples-bar-chart-military-budget-native-sheet.png`
- `diff/latex-examples-histogram-large-1d-dataset-native-sheet.png`

For the military-budget chart, MacTeX and tikztosvg both put blue, vertical
numbers above the default-cycle blue bars. Before the change TikZKit rendered
those numbers black. After the change its SVG contains `fill="blue"` for the
same labels; the bars, grid, rotation, and label positions are unchanged. The
TikZKit-vs-MacTeX mean absolute RGBA residual improves from `0.06542` to
`0.06151` and changed-pixel ratio from `27.29%` to `27.26%`; these values only
support the visible color correction. The second driver confirms its explicit
blue node-label style and interval-bar geometry are not regressed.

The tikztosvg output expresses text as outline path groups, while TikZKit uses
SVG text with `fill="blue"`; their differing text internals are expected, but
both match the native foreground color.

## Verification

```bash
node --test --test-name-pattern='plot node lowering owns nodes near coords|bar labels lower rotatebox|interval near-coordinate nodes' \
  test/pgfplots-seams.test.js test/pgfplots-histogram.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --only latex-examples-bar-chart-military-budget \
  --only latex-examples-histogram-large-1d-dataset \
  --output outputs/qa-pgfplots-near-coord-color-2026-08-08 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-pgfplots-near-coord-color-2026-08-08 \
  --register --alignment-radius 3
npm run extension-registry
```

The focused regressions pass. Both real drivers render all three references
with zero TikZKit diagnostics and no external-render failure.

## Next Slice

Use the completed 82-case PGFPlots sweep at
`outputs/qa-pgfplots-full-current-2026-08-08/` to choose the next visual
issue. Prioritize a missing or materially misplaced element over residual
glyph antialiasing, then keep its source review and visual acceptance isolated
from this color-inheritance slice.
