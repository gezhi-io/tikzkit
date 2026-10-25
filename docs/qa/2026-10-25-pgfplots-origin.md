# PGFPlots Final-Range Origins and Minor Ticks

## Status

Partial compatibility, not a complete visual certificate. The full suite has
2,956 tests: 2,899 pass, 43 fail, 14 skip, zero cancellations. The previous
GitHub checkpoint had 48 failures. Comparing failure names finds no new
failures. The five resolved failures include evidence-based migrations of
obsolete internal assertions, not five newly perfect figures.

This repair shares the final enlarged linear origin among middle axes, axis
descriptions, ticks and grids. It also restores minor ticks at the origin and
in endpoint intervals. Negative left axes remain on the lower frame rather
than inheriting the middle-axis origin. Logarithmic origins are not certified.

## Local Reference

`command -v tikztosvg` resolves to `/Library/TeX/texbin/tikztosvg`.
The reference was generated with its `--pdflatex` engine, without installing
anything. MacTeX sources under `/usr/local/texlive/2025/texmf-dist` reviewed:

- `tex/generic/pgfplots/pgfplotscoordprocessing.code.tex`, lines 8455-8525:
  logical ZERO clamps zero to the final axis minimum/maximum, after enlargement.
- `tex/generic/pgfplots/pgfplotsticks.code.tex`, lines 810-905 and 950-1090:
  obscured major-tick suppression is separate from minor-tick visibility;
  minor ticks reset the visibility flag and check their own range.
- `tex/generic/pgfplots/pgfplots.code.tex`, endpoint label and axis-style rules;
  the existing native-seams audit records the independent label probes.

`pgfplots-native-origin/metrics.tex` independently reports the positive origin
at (0,0) and the negative origin at (195.00012,162.00052) TeX pt. The older
`pgfplots-native-seams/metrics.tex` probe was also recompiled. Native dimensions
are converted between TeX pt (72.27/in) and SVG/PDF bp (72/in), not fitted to
screenshots.

Native SVGs use a reflected-y transform, batched M/L tick paths, butt caps,
miter joins, miter limit 10 and inline arrow outlines. Tick strokes measure
0.19925bp and grids 0.3985bp. Text uses outlined glyphs, not foreignObject.
Negative `minor tick num` iteration repeats some identical opaque segments;
the audit counts distinct visible segments, preserving direction and style.

## Actual Browser Evidence

Artifacts are in `outputs/qa/2026-10-25-pgfplots-origin-before/` and
`outputs/qa/2026-10-25-pgfplots-origin-after/`. The latter contains MacTeX native
PNG/PDF, tikztosvg SVG/PNG, JS SVG/PNG, actual Chrome screenshots, aligned sheets,
diffs, `browser-audit.html`, `browser-audit.json` and `origin-gate.json`.

All nine fixtures render with zero JS diagnostics, external compilation errors
or browser errors. All nine after sheets were visually inspected. Native PNGs
for the positive-origin and circle cases were also inspected. Browser comparison
uses a common physical scale and one origin translation, with no image resizing
to force agreement. Numbers below are CSS pixels at 3x physical scale.

| Case | Visible result | Acceptance |
| --- | --- | --- |
| positive | Axes move to the enlarged lower corner; x=1/y=3 return. 12 ticks, 30 glyphs; maximum errors 0.080/0.084px. | Core geometry passes |
| circle | Endpoint and zero-crossing minor ticks return: 35 distinct total ticks, including 25 minors. Tick/grid/glyph errors 0.198/0.156/0.231px. | Core geometry passes |
| negative | Axes move to the enlarged upper-right origin, matching native. 12 ticks, 40 glyphs; errors 0.104/0.100px. | Core geometry passes |
| zero-minors | Both explicitly requested origin minor marks appear. Six distinct ticks; maximum error 0.084px. | Core geometry passes |
| positive-grid | Grids use the same final frame as ticks and labels. 12 ticks and 12 grids; grid error 0.105px. | Core geometry passes |
| epochs | Two missing crossing minors return: 14 major + 31 minor = 45. Tick error 0.088px. Annotation stroke duplication and text offsets remain. | Whole-case gate fails; glyph error 2.334px |
| light-bulb | Two missing minors return: 17 major + 35 minor = 52. Tick error 0.057px. Legend layout and source whitespace differ. | Whole-case gate fails; glyph error 13.286px |
| hypersurface | 3D regression control: 33 ticks, 37 grids, 18 glyphs. No 3D repair claimed in this slice. | Gate fails: tick/grid/glyph errors 0.568/0.772/0.550px |
| negative-left | Lower-left base is preserved. Default tick extent and description placement still differ. | Gate fails: tick/glyph errors 8.504/17.833px |

The generic browser gate still fails. The dedicated origin checker requires
all five core cases, their native counts, both default-browser and SVG-text
geometry, and the unchanged 0.35px tolerance. It reports the other controls
as failures, not passes. Raster antialiasing differences are not waived as
pixel-identical output.

## Implementation and Tests

- `src/pgfplots/ranges.js`: shared final-range zero clamping.
- `axisLines.js`, `labels.js`, `ticks.js`, `grid.js`: consistent origin/range
  selection, with independent minor visibility and retained DV range behavior.
- `test/pgfplots-native-origin.test.js`: nine regressions, including the
  negative-left guard that caught an intermediate implementation regression.
- `test/pgfplots-seams.test.js`: five obsolete serialization, margin or
  geometry assertions now use native probes, parsed anchors and measured
  physical canvas dimensions. Other assertions are retained.
- `test/case-by-case-acceptance.test.js`: epochs/light-bulb minor counts now
  match independently measured native counts; major counts are also checked.
- `scripts/browser-axis-grid-metrics.js`: opt-in `middle-extended` frame
  identification for arrow shafts stopping short of their geometric crossing.
- `scripts/check-pgfplots-origin-audit.js`: dedicated visible-segment gate;
  generic results and thresholds remain intact.
- Package metadata and both extension registries retain `partial` status.

Exercised commands/options include axis x/y line=middle, axis lines=left,
explicit min/max, enlargelimits, xlabel/ylabel, grid=major, minor tick num,
explicit minor ticks at zero and hide obscured ticks=false. Existing surfaces,
annotations and legends are controls, not newly certified capabilities.

## Reproduction

```sh
node --test test/pgfplots-native-origin.test.js test/pgfplots-lda-shared-visual.test.js
node --test --test-reporter=./scripts/module-test-reporter.js --test-reporter-destination=outputs/qa/2026-10-25-pgfplots-origin-after/test-summary-final.json test/*.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/pgfplots-native-origin --output outputs/qa/2026-10-25-pgfplots-origin-after --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --strict-tikztosvg
node scripts/audit-module-regressions.js --fixtures test/fixtures/pgfplots-native-origin --output outputs/qa/2026-10-25-pgfplots-origin-after --before outputs/qa/2026-10-25-pgfplots-origin-before --tick-grid-metrics --browser-module /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
node scripts/check-pgfplots-origin-audit.js outputs/qa/2026-10-25-pgfplots-origin-after
npm run check:architecture
```

Focused origin/LDA tests: 12 pass. Full-suite summary is above. Architecture:
473 modules, zero errors; existing text-to-frontend debt remains recorded.
The browser audit exits nonzero for the residuals listed above; the dedicated
five-case origin gate passes. No assertion is treated as a visual inspection.

Next priorities are 3D projected boundaries/labels, left-axis tick alignment,
multiline small-font tick boxes, and remaining legend/annotation differences.
There are still 43 full-suite failures. npm publication remains canceled;
package version stays 0.1.6.
