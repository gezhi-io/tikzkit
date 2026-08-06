# PGFPlots Raw Gnuplot Native-Reference Availability

## Scope

This verification slice improves the local visual-QA pipeline for the existing
browser-safe `gnuplot[raw gnuplot]` numeric subset. It does not expand browser
syntax or execute gnuplot. Its only promise is that a supported raw-gnuplot
fixture can still receive a local MacTeX PNG reference when the workstation has
no `gnuplot` executable.

The real drivers are:

- `latex-examples-2d-chi-squared-cdf`;
- `latex-examples-2d-chi-squared-pdf`.

Both use `\foreach`, `\addplot+`, `gnuplot[raw gnuplot]`, 800 samples,
conditional function definitions, gamma-family functions, cycle-list styles,
middle axes, a legend, and math labels.

## Local Source Study

Reviewed from local TeX Live 2025:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`
  maps `/pgfplots/raw gnuplot` to TikZ's raw-gnuplot handling.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotscoordprocessing.code.tex`
  records the raw-gnuplot flag and at lines 6330-6336 opens the generated
  `.table`; it reports the missing-table error if the external result does not
  exist.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduleplot.code.tex`
  writes the external gnuplot program and consumes the resulting table.

This explains the prior native failure exactly: `command -v gnuplot` returned
no path, and MacTeX reported that `reference.pgf-plot.table` could not be
found. Enabling unrestricted TeX shell escape would not create the missing
program and would be the wrong browser-QA boundary.

## Implementation

`scripts/render-example-fixtures.js` now applies
`lowerRawGnuplotAddplotsToCoordinates()` to the disposable native-reference
source before `pdflatex` runs. The original fixture is unchanged. The same
bounded parser/runtime already used by TikZKit and the disposable tikztosvg
input creates explicit `\addplot coordinates { ... }` data, allowing MacTeX to
typeset the visual result with normal restricted execution.

The new `--continue-on-external-failure` option is paired with
`--strict-tikztosvg`: a multi-case run writes all SVG/PNG artifacts,
`summary.json`, per-case logs, and the comparison page, then exits nonzero when
a strict tikztosvg reference failed. The comparison page exposes each
tikztosvg and MacTeX status rather than presenting an unexplained blank panel.

## Artifacts And Visual Review

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`.

Before the native-reference lowering, the Milestone-30 audit at
`/private/tmp/tikzkit-milestone-30-batch-2026-08-06` completed all 30
TikZKit SVGs and 29 tikztosvg SVGs, but only 27 MacTeX PNGs. Both chi-squared
cases had MacTeX logs with the missing gnuplot table failure.

After the change, the focused artifacts are in
`/private/tmp/tikzkit-qa-raw-gnuplot-native-2026-08-06`:

- TikZKit SVG/PNG: 2/2;
- tikztosvg SVG/PNG: 2/2;
- MacTeX native PNG: 2/2;
- external failures: 0.

Inspected panels:

- `diff/latex-examples-2d-chi-squared-cdf-native-sheet.png`;
- `diff/latex-examples-2d-chi-squared-pdf-native-sheet.png`;
- `diff/latex-examples-2d-chi-squared-pdf-sheet.png`.

The six CDF/PDF curves, their yellow/green/cyan/blue/magenta/red styles, axis
ranges, grid, legend entries, and math labels are visibly present in all three
renderers. The raster diff remains mostly anti-aliasing, glyph rasterization,
and small crop variation: registered JS-to-tikztosvg changed pixels are 7.92%
(CDF) and 9.36% (PDF). The essential visual improvement is that the native
panels were absent before and are now available for direct inspection.

## Verification

```bash
npm test -- test/example-render-script.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-raw-gnuplot-native-2026-08-06 \
  --only latex-examples-2d-chi-squared-cdf latex-examples-2d-chi-squared-pdf \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --external-timeout-ms 30000
npm run examples:diff -- --output /private/tmp/tikzkit-qa-raw-gnuplot-native-2026-08-06 \
  --register --alignment-radius 3
npm run extension-registry
```

The focused renderer-script suite passes 54/54 tests. This change does not
claim the full repository test suite is green.

## Remaining Boundary

Raw gnuplot remains intentionally partial: 3D/parametric programs, arbitrary
files, shell commands, strings, and unsupported functions still do not lower.
The Milestone-30 `latex-examples-3d-gaussian-distribution` tikztosvg reference
still times out at 30 seconds and is recorded as an oracle availability issue,
not a passing visual comparison.
