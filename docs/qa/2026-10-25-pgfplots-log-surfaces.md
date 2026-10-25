# PGFPlots Logarithmic Surface Survey, Ticks and Text

## Status and Boundary

PGFPlots remains partial. This slice targets the failing CMOS logarithmic
surface from the preceding survey audit, plus small x/y/z log controls that
expose invalid-point filtering, narrow ranges and mesh serialization. It
does not certify all logarithmic plots or full PGF floating-point arithmetic.

Four core cases now pass actual Chrome geometry checks in both default JS
and SVG-text modes. Six linear-coordinate controls retain those checks.
The explicit-metadata control still fails its existing strict paint gate by
one RGB byte. This is not pixel-identical raster acceptance.

The same full-test command as the previous checkpoint reports **2,974 tests:
2,917 passed, 43 failed, 14 skipped**, zero cancellations. There are nine new
passing tests and no newly failing or resolved names among the old tests.
Real visual improvements do not imply that the old failure count decreased.

An additional bare `node --test` run reported 46 failures: it also discovered
three command-line browser probes under `test/fixtures/` and ran them without
their required arguments. Its result is retained as `test-summary-discovery.json`.
The probe discovery problem is not counted as a rendering regression or hidden
by changing the package test script. Existing failures, including multiline
footnotesize ticks, remain open.

No npm login, release, version bump or remote push was performed.

## Local Evidence

`command -v tikztosvg` locates `/Library/TeX/texbin/tikztosvg`. References use
the installed pdflatex engine. MacTeX source paths below are relative to
`/usr/local/texlive/2025/texmf-dist/tex/`:

- `generic/pgfplots/pgfplotscoordprocessing.code.tex:3240-3365`: invalid log
  coordinates discard the entire point before bounds and serialization.
  Line 2721 assigns default z metadata after coordinate transformation.
- The same file, 2222-2337 and 5480-5650: natural-log coordinates, optional
  custom bases, function domains and compatibility-dependent sampling.
- `generic/pgfplots/pgfplotsticks.code.tex:1800-2475`: automatic exponent
  seeds and short-range fractional fallback. Lines 950-1080 include factor
  one in decade minor runs; line 1121 defines physical placement tolerance.
- `generic/pgfplots/pgfplots.code.tex:2982`: the z multiplier uses
  `zticklabel* cs:1.2,-0.3em` and a near-ticklabel anchor, not a fixed x offset.
- `generic/pgfplots/pgfplotsmeshplothandler.code.tex:2290,3029-3060,3095`:
  scanline columns survive discard filtering; jump retains holes; flat-mean
  shading averages transformed vertex metadata.
- `generic/pgfplots/util/pgfplotsutil.code.tex:520,817,849` and
  `generic/pgfplots/oldpgfcompatib/pgfplotsoldpgfsupp_pgflibraryfpu.code.tex:1317`:
  domain-to-foreach obtains the second sample using normalized FPU division,
  followed by the selected precise or legacy iteration.
- `generic/pgfplots/util/pgfplotscolormap.code.tex:2145`: uniform lookup uses
  a fixed-point inverse interval. JS double interpolation still has small
  color residuals; these are explicitly outside exact acceptance.

The independent `test/fixtures/pgfplots-log-surface-metrics.tex` probe records
native survey bounds, basis vectors, label centers and hbox dimensions.
For CMOS, native ymin=22,221,000 approximately, ymax=999,944,763.889,
zmin=49,997,234, zmax=35,998,011,500. The x samples reach exactly 6; using
a raw fixed-point step incorrectly stopped at 5.99955. Native z-scale center
is (-8.06972,303.40273) TeX pt relative to the lower description corner.

Native hboxes for `$V_{dd}$ in V`, `$f$ in Hz`, `$P_v$ in mW` have widths
37.1591, 32.91673 and 44.7825 TeX pt. JS width/height/depth differ by less
than .001pt in the new tests, using existing MacTeX-derived CM glyphs only.

Native SVG inspection confirms outlined glyphs, reflected-y transforms,
separate surface fill/stroke paths, butt caps and miter joins. It contains
the folded faces produced by the filtered stream, not the smooth plane that
the former JS hole-preserving replay invented. MacTeX PNG and tikztosvg agree
on topology, frame, tick text and descriptions; raster antialiasing differs.

## Visual Results

Main artifacts: `outputs/qa/2026-10-25-log-surface-after/`, with before images
in the corresponding `-before/` directory. They contain MacTeX PNGs,
tikztosvg SVG/PNGs, JS SVG/PNGs, Chrome screenshots, aligned sheets,
differences, metric JSON and `browser-audit.html`. Both JS browser modes
were actually rendered; exported-image success alone is not the criterion.
All four inputs have zero JS diagnostics and zero native/browser errors.

| Case | Visible change | Browser geometry result |
| --- | --- | --- |
| CMOS loss surface | Removed the spurious zero z tick, restored correct log minors, aligned mixed math/unit text and the multiplier; frame and mesh endpoints now agree. | 207/207 ticks, 37/37 grids, 63/63 glyphs; glyph error .063px, frame .050px, canvas .034px |
| log x | Removed the invented full decade and excess ticks; recovered folded faces following discard-stream order. | 42/42 ticks, 18/18 glyphs; frame .042px |
| log y | Tight 1:2 range, correct fractional exponent, native face shape and full z range. | 55/55 ticks, 21/21 glyphs; frame .091px |
| log z | Recovered previously absent faces and intermediate fractional labels; geometric rather than arithmetic z mean restores the olive/yellow/orange palette. | 52/52 ticks, 28/28 glyphs; frame .019px |

Errors are CSS pixels at three-times physical display scale; the unchanged
geometry threshold is .35px. The CMOS pre-fix comparison has 202 ticks versus
207 native, 70 versus 63 glyphs, and a 9.864px canvas discrepancy. Difference
panels still show thin-line and color/raster residuals; passing geometry is
not a claim of empty pixel differences.

The seven-case repeat in `outputs/qa/2026-10-25-log-surface-controls/` covers
CMOS plus hypersurface-2, hypersurface-order-2, parametric sampling, clipped
and unclipped coarse surfaces and explicit metadata. All seven geometry
checks pass. The last case's strict paint check remains failed at its original
threshold: JS (128,128,255) versus native (127,127,255). Its browser audit
therefore correctly exits nonzero. No acceptance threshold was relaxed.

## Implementation and Tests

- `rangeResolver.js`, `sampling.js`: whole-point bounds, tight log intervals,
  normalized FPU step division and preserved sampled endpoint precision.
- `scaling3d.js`, `axis3d.js`: log-domain stretch basis, physical endpoint
  tolerance, fractional log ticks, minor runs and native z-multiplier anchor.
- `surface.js`: original-column discard stream for function/parametric
  meshes; jump holes stay intact. Default log-z means use transformed data.
- `textBox.js`, `engine/evaluate.js`, `renderers/svg/bounds.js`: one measured
  CM mixed-text hbox and one browser paint/bounds path. Unsupported mixed
  content falls back as a unit instead of being partly consumed.
- Nine new regressions cover native survey values, samples, mesh topology,
  transformed color means, native hbox dimensions and sync/async browser modes.
  The new color test allows at most one RGB byte from the recorded native
  colors; it does not replace or loosen the existing stricter paint gate.

Four existing geometry expectations were replaced with independent native
probe values, not snapshots of the new JS output: the legacy sampled maximum,
the scale-only log frame, the real scaled-z center and default surface bounds.
The plain-text fallback test now positively checks supported mixed formulas
while retaining its other unsupported-content guards. None of these changes
removes an old failure from the 43-failure baseline.

Exercised commands/options: `axis`, function/parametric `addplot3`, `surf`,
`domain`, `y domain`, `samples`, `samples y`, `view`, `compat`, `enlargelimits`,
`xmode/ymode/zmode=log`, `grid`, `xlabel/ylabel/zlabel`, scaled z ticks,
`unbounded coords=discard/jump`, colormap and explicit point-meta bounds,
`clip` and `clip=false`. Font metrics use TeX pt, not browser font fitting.

Still partial: full FPU equivalence, top-view image discard topology,
uniform/custom-base log modes, arbitrary mixed text/fonts, explicit metadata
edge cases, exact colormap quantization and the remaining test failures.
Next priority is a native probe of multiline tick-label semantics and the
remaining PGFPlots label/container failures, without preserving bad fitted
measurements merely to make tests green.

## Reproduction

```sh
node --test test/pgfplots-log-surface-survey.test.js test/pgfplots-mixed-labels.test.js test/pgfplots-plain-labels.test.js
node --test --test-reporter=./scripts/module-test-reporter.js --test-reporter-destination=outputs/qa/2026-10-25-log-surface-after/test-summary-final.json test/*.test.js
/Library/TeX/texbin/pdflatex -halt-on-error -interaction=batchmode -output-directory=outputs/qa/2026-10-25-log-surface-after test/fixtures/pgfplots-log-surface-metrics.tex
node scripts/render-example-fixtures.js --fixtures test/fixtures/pgfplots-log-surface --output outputs/qa/2026-10-25-log-surface-after --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --strict-tikztosvg
node scripts/audit-module-regressions.js --fixtures test/fixtures/pgfplots-log-surface --output outputs/qa/2026-10-25-log-surface-after --before outputs/qa/2026-10-25-log-surface-before --tick-grid-metrics --browser-module /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
node scripts/render-example-fixtures.js --fixtures test/fixtures/pgfplots-surface-survey --output outputs/qa/2026-10-25-log-surface-controls --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --strict-tikztosvg
node scripts/audit-module-regressions.js --fixtures test/fixtures/pgfplots-surface-survey --output outputs/qa/2026-10-25-log-surface-controls --before outputs/qa/2026-10-25-surface-survey-after --tick-grid-metrics --browser-module /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
npm run check:architecture
npm run docs:links
git diff --check
```
