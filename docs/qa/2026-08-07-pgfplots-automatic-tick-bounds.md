# PGFPlots Automatic Tick Bounds QA - 2026-08-07

## Scope

This slice implements one PGFPlots behavior: automatic numeric major ticks and
their automatic major-grid counterparts must be suppressed when they lie
outside an explicit final `xmin`/`xmax`/`ymin`/`ymax` range. It does not change
explicit tick lists, minor-tick policy, log axes, or custom coordinate
transforms.

The real driver is
`test/fixtures/examples/latex-examples/bar-chart-military-budget.tex`. Its
axis declares `xmin=1987` and `xmax=2011.9`; before this change TikZKit painted
an extra automatic `2012` x tick, label, grid line, and trailing right-hand
canvas margin.

## Local MacTeX Review

Reviewed locally:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsticks.code.tex`, around lines 1110-1150: `\pgfplots@prepare@tick@coordlists@for@checktickmin` and `...checktickmax` remove candidates below or above the final axis tick limits.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`, around line 7985: axis drawing prepares the tick lists before it emits the visible axis elements.

The implementation point is important: PGFPlots may plan a pleasant numeric
step first, but it does not use a visible fraction of that step as a drawing
tolerance. Only floating-point reconstruction error is acceptable outside the
final bound.

## Implementation

- `src/pgfplots/ticks.js` exports `autoTickOutsideRange` and applies it while
  generating and rendering automatic major ticks and labels.
- `src/pgfplots/grid.js` reuses that exact predicate for automatic grid lines.
- `test/pgfplots-histogram.test.js` verifies that a convenient `2012` planner
  candidate is not emitted by either tick lowering or grid lowering for the
  real fractional-bound shape.

## Visual Evidence

`tikztosvg` was available at `/Library/TeX/texbin/tikztosvg` and rendered with
`/opt/homebrew/bin/rsvg-convert`.

Artifacts:

- Before: `/private/tmp/tikzkit-qa-pgfplots-auto-tick-bound-before-2026-08-07/`
- After: `/private/tmp/tikzkit-qa-pgfplots-auto-tick-bound-after-2026-08-07/`
- After native four-panel sheet: `/private/tmp/tikzkit-qa-pgfplots-auto-tick-bound-after-2026-08-07/diff/latex-examples-bar-chart-military-budget-native-sheet.png`
- Six-case regression panels: `/private/tmp/tikzkit-qa-pgfplots-auto-tick-bound-regression-2026-08-07/diff/`

All panels were inspected. Before the change, TikZKit alone showed a rotated
`2012` label and its terminal vertical grid line after the `2010` bar group.
MacTeX and tikztosvg ended at `2010`. After the change, all three renderers end
their automatic x ticks at `2010`; TikZKit also loses the artificial right-side
margin. The bar geometry, vertical value labels, title, and y-axis ticks stay
unchanged.

The six real regression fixtures cover grouped bars, interval histogram,
dual-y-axis table plots, point labels, a fill-between diagram, and equal-unit
open axes. Their legitimate terminal ticks remain visible. Remaining visual
differences in those sheets are text rasterization, line weight, and unrelated
label-placement calibration, not an out-of-range tick.

## Verification

```sh
node --test --test-name-pattern='fractional maximum' test/pgfplots-histogram.test.js
node scripts/gallery-audit.js --only latex-examples-bar-chart-military-budget --strict
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-pgfplots-auto-tick-bound-after-2026-08-07 \
  --only latex-examples-bar-chart-military-budget --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg --external-timeout-ms 120000
node scripts/diff-example-pngs.js \
  --output /private/tmp/tikzkit-qa-pgfplots-auto-tick-bound-after-2026-08-07
```

## Remaining Boundary

This is not a full PGFPlots tick engine. Explicit tick lists, minor and
logarithmic ticks, date ticks, transformed coordinate systems, custom number
formatting, and general `ticklabel* cs` behavior stay partial. The next
high-value visual slice is curve-edge terminal geometry: curved arrows should
derive their node-boundary crop, path endpoint, and arrow-tip extent from one
shared PGF-style model.
