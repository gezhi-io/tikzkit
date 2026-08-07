# PGFPlots Middle Y-Scale Label QA

## Scope

This slice implements one shared 2D PGFPlots rule only: the automatic
scientific multiplier for `axis y line=middle`. It does not change function
sampling, CSV parsing, right-axis overlays, number formatting, or arbitrary
user styles.

The driver is the real fixture
`latex-examples-csv-line-plot-two-axes` from
`test/fixtures/examples/latex-examples/csv-line-plot-two-axes.tex`. Its first
axis combines `axis x line=middle`, `axis y line=middle`, `enlarge y limits`,
`width=15cm`, `height=8cm`, `grid=major`, `ylabel`, `xlabel`, two table plots,
and a legend. A second matching-size `hide x axis, axis y line*=right` axis
adds the orange/black table series and right-side 0--300 scale.

## Local PGFPlots Reading

Reviewed `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`.
The active compatibility implementation defines:

- `axis y line=middle` as the center-line mode and installs the non-boxed y
  axis behavior (lines 2929--2950).
- The 2D `every y tick scale label` position as
  `at={(yticklabel* cs:1.03,-0.3em)}`, with outside alignment, the anchor
  opposite the left y tick labels, and `inner sep=0pt` (lines 2941--2946).
- The generic `ylabel near ticks` default uses the same left-side scale-label
  relationship (lines 899--902). The right-axis variant intentionally uses
  `yticklabel cs:1` instead (lines 2951--2970).

TikZKit therefore treats the vertical `1.03` as an axis-height percentage and
places the label outside the centered major tick plus `0.3em`, with the
opposite `south east` anchor. Non-middle y axes keep the pre-existing legacy
paint-box calibration.

## Implementation

`src/pgfplots/ticks.js:renderTickScaleLabel` now distinguishes the middle 2D
y-axis form. It lowers a scale node such as `\cdot 10^{7}` at the top-left
tick-label side instead of anchoring it at the y-axis origin with
`south west`. The behavior is shared by all middle numeric y axes that select
automatic scaled ticks.

The regression in `test/pgfplots-csv-overlay.test.js` asserts the PGF-derived
`south east` anchor and `(-0.18,3.09)` position for a 4cm by 3cm middle axis;
the legacy non-middle expected position remains covered separately.

## Visual Evidence

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNGs were generated
with local `/opt/homebrew/bin/rsvg-convert`.

Artifacts are retained under
`/private/tmp/tikzkit-qa-pgfplots-two-axes-after-2026-08-07/`:

- `mactex-png/latex-examples-csv-line-plot-two-axes.png`
- `tikzkit-svg/` and `tikzkit-grid-png/`
- `tikztosvg-svg/` and `tikztosvg-grid-png/`
- `diff/latex-examples-csv-line-plot-two-axes-native-sheet.png`

Before the fix, TikZKit placed `\cdot 10^{7}` and `Stored game situations`
on effectively the same top baseline, so the multiplier read as part of the
axis description. The post-fix TikZKit panel puts the multiplier at the
top-left outside the y tick labels and keeps `Stored game situations` below it.
This matches the visible MacTeX and tikztosvg hierarchy. The blue/red primary
series, orange/black overlaid series, right 0--300 labels, shared plot box,
grid, and legend remain present and aligned.

The four-panel sheet was inspected directly. Remaining differences are the
known SVG text rasterization and tight-crop variation; this slice does not
claim full PGF number-format, legend, or multi-axis compatibility.

## Acceptance

Passed:

```bash
node --test test/pgfplots-csv-overlay.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-pgfplots-two-axes-after-2026-08-07 \
  --only latex-examples-csv-line-plot-two-axes \
  --native-reference --strict-tikztosvg
node scripts/diff-example-pngs.js \
  --output /private/tmp/tikzkit-qa-pgfplots-two-axes-after-2026-08-07
```

Implemented in this case: `axis`, `axis x line=middle`, `axis y line=middle`,
`axis y line*=right`, `hide x axis`, automatic numeric y scaling, `grid=major`,
`width`, `height`, `xmin/xmax/ymin/ymax`, `enlarge y limits`, `xlabel`,
`ylabel`, `legend style`, `\addplot table`, and `\legend`/table overlay
lowering.

Not accepted by this slice: arbitrary `every y tick scale label` styling,
custom `ticklabel* cs` coordinates, logarithmic scale labels, arbitrary PGF
number-format keys, general multi-axis placement, and final TeX text/bbox
parity.
