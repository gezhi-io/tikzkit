# PGFPlots Small Axes, Multiline Ticks and Paint Bounds

## Status and Boundary

PGFPlots remains partial. This batch repairs shared axis sizing, literal
tick-text boxes, pen-width inheritance, default cycle marks and tickless
picture bounds. It does not certify every remaining figure or close the
thread's full compatibility goal.

The unchanged full regression command reports **2,987 tests: 2,934 passed,
39 failed, 14 skipped**, with no cancellations. The preceding checkpoint
had 43 failures. No previously passing test name now fails. Thirteen new
tests pass. The four resolved old failures include evidence-based stale
expectations; they must not be described as four independent rendering bugs.

Bare `node --test` still discovers three argument-taking browser probes in
`test/fixtures/` as test programs. This separate discovery problem remains
open; the counts above use all `test/*.test.js`, as did the previous baseline.
No test was disabled, and no visual tolerance was increased.

No npm login, publication, version bump or remote push was performed.

## Native Implementation

`command -v tikztosvg` finds `/Library/TeX/texbin/tikztosvg`. The reference
runner uses local pdflatex, then `rsvg-convert` for SVG-to-PNG. MacTeX PDF
renders provide a separate native PNG for all eleven primary cases.

Sources below are relative to `/usr/local/texlive/2025/texmf-dist/tex/`:

- `generic/pgfplots/pgfplots.scaling.code.tex:145-176`: subtract the full
  45pt description reserve from the requested width and height. There is
  no half-size floor. `scale only axis` bypasses this reserve.
- `generic/pgf/frontendlayer/tikz/tikz.code.tex:1174-1190,4211-4273`:
  `align=none` does not start a halign; explicit alignment assembles hboxes
  on the selected baseline grid and uses the last row's baseline.
- `generic/pgfplots/pgfplotscoordprocessing.code.tex:5215-5237`: optionless
  addplot uses the cycle list, as does addplot+; explicit `[]` is different.
- `generic/pgfplots/pgfplots.code.tex:2678-2840`: unstarred non-boxed axes
  install centered ticks and tight limits. Starred choices retain the
  ordinary automatic range enlargement and compatibility-dependent labels.
- `generic/pgf/basiclayer/pgfcorescopes.code.tex:234`: the initial pen is
  0.4pt. `generic/pgf/modules/pgfmoduleshapes.code.tex:891-892`: node outer
  separation is half the current pen width, even for undrawn text nodes.
- `latex/base/latex.ltx:15669-15681`: text-mode thin space uses a kern
  based on the selected font's em. The CMR8 quad is not nominally 8pt.
- `generic/pgf/libraries/pgflibraryplothandlers.code.tex:972-1000`: circle,
  plus and cross marks use quick fill/stroke. `pgfcorequick.code.tex:100-123`
  bypasses the ordinary stroke hook in `pgfcorepathusage.code.tex:116-128`,
  which would otherwise expand picture bounds by half the pen width.

The independent probe is
`test/fixtures/pgfplots-small-axis-metrics.tex`. It measures native anchors
and hboxes without using the JS implementation. Selected measurements:

| Native measurement | TeX points |
| --- | --- |
| 4cm by 2cm axis plot area | 68.80951 by 11.9049 |
| 8pt `2012\\2956`, no alignment, anchor box | 41.06644 by 12.2215 |
| Same text, center/left alignment, anchor box | 24.0662 by 21.7215 |
| Aligned 8pt row baseline separation | 9.5 |
| `20\,\%` at 8pt: width/height/depth | 17.00027 / 6 / 0.44444 |
| Thin-space contribution at 8pt | 1.41671 |
| Default-compat starred-left ylabel x | -35 |

Anchor boxes include outer separation; paint boxes do not. SVG `pt` uses
72 points per inch, while these TeX measurements use 72.27. Tests explicitly
account for that unit distinction.

## Changes and Visual Results

- Small middle axes previously stretched short plots to half the requested
  height and omitted optionless coordinate marks. The plot now retains the
  full 45pt reserve and restores both endpoint circles. Native tick crowding
  on the intentionally tiny example is preserved, not silently redesigned.
- Center/left 8pt ticks now use CMR8 row hboxes, true widths and a 9.5pt
  baseline interval. Removed fitted text scaling and extra bbox padding.
  With no alignment, native TikZ ignores `\\`; it does not make two rows.
- The real electric-vehicles chart now has matching year/count baselines,
  percent spacing, thick frame, tick-label clearance and annotation centers.
  Ordinary literal text and mixed math continue to use the same measured
  boxes in default browser JS and SVG-text output.
- The green left-axis example no longer acquires an unwanted automatic
  10% range margin. Its curve starts at the visible origin; centered tick
  marks and the ylabel no longer drift toward the numbered ticks.
- Tickless middle axes no longer receive a synthetic outside gutter.
  Circle/rectangle path primitives preserve quick-paint bbox semantics, and
  built-in PGFPlots marks do not add an extra half-stroke padding. The old
  native tickless-crop regression passes without changing its tolerance.
- Default axis pens and scoped `thick` now reach both frame painting and
  node outer separation, rather than compensating by moving individual labels.

The primary eleven-case manifest is `test/fixtures/pgfplots-small-axis/manifest.json`.
Actual Chrome comparisons at 3x CSS size pass for both default JS and
SVG-text. No per-label fitting or image resizing is used: panels share one
axis-origin translation. Maximum glyph-origin deviation is below 0.083 CSS
pixels in these controls, against the unchanged 0.35px gate. The tickless
case additionally checks every painted primitive's extent, color, pen width
and every canvas edge; its maximum crop deviation is below 0.11px.

Browser sheets were inspected for the small middle axis, centered ticks,
green left axis, tickless marks and the real vehicle chart. They include
JS, local tikztosvg, SVG-text, available before output and a diff. The vehicle
MacTeX PNG was also inspected. The screenshots show the actual improvements,
not just a lower aggregate image difference. Residual raster differences
remain at outline-antialiased glyphs and subpixel stroke edges; this is not
a pixel-identity claim.

The seven surface-survey controls and four logarithmic controls were also
rerendered after these shared text/bounds changes (CMOS appears in both sets).
All eleven browser geometry checks pass for default JS and SVG-text, including
projected tick/label origins, frame edges and canvas crops. The clipped surface
and CMOS aligned sheets were inspected; their geometry is unchanged from the
previous accepted geometry checkpoint.

This is not eleven whole-image passes. The explicit-metadata surface still
fails its unchanged strict color gate: native `(127,127,255)` versus JS
`(128,128,255)`. Its before output has the same discrepancy. The surface
browser command exits nonzero for that color failure; it is not waived or
reclassified as a pass.

## Test Expectations

Four old failing tests now distinguish native behavior from prior estimates:

1. Three scatter data marks plus one legend sample, with explicit data-mark
   positions and radii, instead of counting three marks in the entire picture.
2. Xcolor green is full-intensity RGB green, not CSS's darker `green` keyword.
3. An invisible axis frame follows the native plot rectangle; text nodes
   independently contribute the description bounds.
4. A default no-align tick ignores the line break. Its measured native
   one-row hbox replaces the old invented two-row size.

Other previously passing command snapshots were strengthened or updated for
the runtime changes: exact native 0.4pt pens, 45pt sizing, per-glyph multiline
paint, native whitespace, and repeated groupplot endpoint marks. Regression
checks reject missing paint, blank references, shifted crops and wrong pens.

## Reproduce and Inspect

```sh
node --test test/pgfplots-small-axis.test.js test/multiline-math-box.test.js test/browser-axis-grid-metrics.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/pgfplots-small-axis --output outputs/qa/2026-10-25-small-axis-after --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --strict-tikztosvg
node scripts/audit-module-regressions.js --fixtures test/fixtures/pgfplots-small-axis --output outputs/qa/2026-10-25-small-axis-after --before outputs/qa/2026-10-25-small-axis-before --tick-grid-metrics --browser-module /path/to/playwright/index.mjs
node --test --test-reporter=./scripts/module-test-reporter.js --test-reporter-destination=outputs/qa/2026-10-25-small-axis-after/test-summary-final.json test/*.test.js
npm run check:architecture
npm run docs:links
```

Local artifacts, not published package contents:

- `outputs/qa/2026-10-25-small-axis-after/browser-audit.html`
- `outputs/qa/2026-10-25-small-axis-after/browser-gates.json`
- `outputs/qa/2026-10-25-small-axis-after/pgfplots-small-axis-metrics.log`
- `outputs/qa/2026-10-25-small-axis-3d-controls/browser-audit.html` and
  `browser-gates.json` (geometry passes; the strict paint check above fails).
- `outputs/qa/2026-10-25-small-axis-log-controls/browser-audit.html` and
  `browser-gates.json` (all four geometry checks pass).
- Under the same root: `tikzkit-svg/`, `tikzkit-png/`, `tikztosvg-svg/`,
  `tikztosvg-png/`, `mactex-png/`, and `browser/*-aligned-sheet.png`.

## Remaining Work

The 39 regression failures remain active work. In particular, datavisualization
tick/legend behavior and several node-border/anchor tests still need independent
native review. The test-discovery problem above also remains open.

This batch does not implement arbitrary rich multiline controls, TeX line
breaking, arbitrary font families, all option-order interactions for axis
enlargement, or native errors for dimensions smaller than the 45pt reserve.
Custom plot-mark declarations still need exact ordinary/quick paint distinction.
Previous 3D exact-FPU, discard-topology and strict one-byte colormap differences
remain outside this completed geometry/text subset.
