# PGFPlots Surface Survey and Projected Clipping

## Status and Boundary

Partial compatibility. This slice repairs shared surface sampling, projected
clipping, default z metadata bounds and quick-paint canvas bounds. It does not
certify every 3D plot. Six linear-coordinate browser controls pass geometry
checks; the additional CMOS logarithmic control still fails. The full suite
has 2,965 tests: 2,908 pass, 43 fail, 14 skip, zero cancellations. There are no
new failing names compared with the preceding 43-failure origin checkpoint.

The origin and surface slices together reduce failures from the previous
GitHub checkpoint's 48 to 43. This surface slice improves real graphics while
retaining that count, rather than claiming nine new tests as nine fixed cases.
No npm release or login was attempted; the package version remains 0.1.6.

## Local Source Evidence

`command -v tikztosvg` returned `/Library/TeX/texbin/tikztosvg`. References use
its pdflatex engine and the installed MacTeX, without downloading a tool.
Source paths below are relative to `/usr/local/texlive/2025/texmf-dist/tex/`:

- `generic/pgf/frontendlayer/tikz/tikz.code.tex:1292`: default samples is 25.
- `generic/pgfplots/pgfplotscoordprocessing.code.tex:5705-5840`: survey consumes
  the declared function domain; viewport clipping must not resample the grid.
- The same file, 3463-3490 and 3538-3554: explicit metadata bounds suppress
  automatic extrema updates; local plot bounds and axis-wide normalization
  are distinct. Default axis-wide normalization retains explicit axis bounds.
- `generic/pgfplots/pgfplots.code.tex:9212-9272`: the 3D clip is the projected
  convex hull of the axis box, not a cut in the data-space surface lattice.
- `generic/pgfplots/pgfplotsmeshplothandler.code.tex:2885-2928` and
  `generic/pgf/basiclayer/pgfcorequick.code.tex:100-123`: mesh quick fill/stroke
  bypass ordinary stroke hooks and their half-pen-width bbox expansion.
- `generic/pgfplots/pgfplots.scaling.code.tex:810-895`, 3040-3224, and
  `generic/pgf/math/pgfmathfunctions.basic.code.tex:200-267`: final reciprocal,
  basis and fixed-point rules. Existing projection arithmetic was retained;
  the wrong sampled minimum was the source of this frame error.

The independent probe `test/fixtures/pgfplots-3d-hypersurface-metrics.tex`
reports zmin=-30.66678, zmax=121, projected height=161.3747 TeX pt, and label
centers x=(53.28691,-14.7028), y=(184.93095,-2.58488), z=(-30.5253,60.33383).
The old 15-sample survey found -30.735 while painting a 25-sample mesh; the
parametric survey incorrectly used 40 samples. Both now share replay sampling.

Native SVG inspection confirms nonzero six-vertex clip paths, reflected-y
transforms, separate fill/stroke faces, butt caps and miter joins. Text uses
outlined glyphs, without foreignObject or SVG font-size approximations.
The coarse clipped hull has vertices (215.308594,115.519531),
(215.308594,30.382812), (108.296875,2.191406), (33.367188,42.453125),
(33.367188,127.589844), (140.378906,155.78125) in PDF/SVG bp.
The unclipped native canvas is 325.053 by 237.074 bp, including standalone's
2 TeX pt border on each side. Unit conversion uses 72 versus 72.27 per inch.

## Visual Evidence

Artifacts are in `outputs/qa/2026-10-25-surface-survey-before/` and
`outputs/qa/2026-10-25-surface-survey-after/`. The latter contains seven
MacTeX PNGs, tikztosvg SVG/PNGs, JS SVG/PNGs, actual Chrome screenshots,
aligned before/after/reference sheets, differences and `browser-audit.html`.
All seven compile with zero JS diagnostics and zero external/browser errors.
Browser tests exercise both default JS output and exported SVG-text output.
Comparison applies one frame translation at common physical scale, never a
per-label fit or a resize to force agreement. All panels were visually checked.

| Case | Actual visual result | Geometry result |
| --- | --- | --- |
| hypersurface-2 | Frame, tick baselines and x/y/z labels realign; the original green-purple mesh is retained. | Pass; max glyph error 0.066px, grid 0.096px (previously 0.550/0.772px) |
| hypersurface-order-2 | Saddle and labels remain stable as a control. | Pass; glyph 0.074px |
| parametric hypersurface | Same native default grid and frame as the function form, eliminating the independent 40-sample drift. | Pass; glyph 0.069px |
| coarse clipped saddle | Previously a small inset saddle; now the declared facets reach the projected frame and are clipped there. Orange/olive colors no longer saturate from viewport z bounds. | Pass; glyph 0.048px, canvas 0.036px |
| coarse unclipped saddle | Previously incorrectly shrunk to visible x/y limits; now the full off-frame surface and native canvas are preserved. | Pass; canvas error falls from 283.901px to 0.048px |
| explicit metadata | A constant z=6 face uses the axis-wide 0:12 white/blue map, hence lavender, not the local 0:6 blue endpoint. | Geometry pass; strict paint gate fails by one byte (native 127/127/255, JS 128/128/255) |
| CMOS log surface | Invalid y=0 sample no longer creates an extra face row. Log ticks, label selection and frame/text offsets still differ. | Fail; 202 vs 207 ticks, frame error 1.700px, canvas 9.864px |

Errors above are CSS pixels at 3x physical scale; the unchanged geometry
tolerance is 0.35px. The generic browser command intentionally exits nonzero
for the CMOS control; the separate strict paint gate also remains failed at
its unchanged less-than-one-byte threshold. Six passing geometry controls do not establish
pixel-identical raster output: thin mesh strokes, color quantization and
antialiasing differences remain visible in difference panels. Native PNG and
tikztosvg agree on the coarse mesh shape, clipping and palette.

## Implementation and Coverage

- `rangeResolver.js`: one surface sample-count resolver for function and
  parametric survey/replay, including explicit samples and samples y.
- `surface.js`: declared-domain lattice; independent metadata normalization
  with explicit axis-wide/per-plot bounds. No case-specific coordinates.
- `axisTikzLowering.js`: runtime survey options and unpadded metadata ranges
  independent of explicit viewport z limits.
- `addplotLowering.js`, `clipping.js`, `axisOverlay.js`: reuse projected
  clipping for surface fill and mesh without clipping descriptions.
- `engine/evaluate.js`: internal quick-paint flag omits ordinary stroke bbox
  padding; normal TikZ paths retain their existing stroke bounds.
- Nine new unit regressions and seven native/browser controls cover default
  and explicit sampling, parametric surfaces, global/individual clips,
  clip=false, metadata, physical canvas bounds and real label positions.
- The browser metric collector excludes closed gray mesh polygons from the
  open tick/grid grammar. Counts, positional tolerances and failures remain.

Old test changes are evidence-based: native CMOS SVG contains exactly 1,980
fill-opacity=.9 paths and 1,980 stroke-opacity=.9 paths, not 2,025 of each.
Two ordering checks now locate semantic surface roles after internal clipping
options; their layer-order requirements are unchanged. An existing explicit
colormap assertion caught an intermediate regression and was not weakened.

Exercised syntax: `axis`, `addplot3` function/parametric/coordinates, `surf`,
domain/y domain, samples/samples y, xmin/xmax/ymin/ymax/zmin/zmax, view,
compat, enlargelimits=false, grid, xlabel/ylabel/zlabel, clip/clip mode,
shader=flat, draw, colormap, point meta min/max and point meta rel.
Complete shared metadata aggregation for multiple custom streams, unrestricted
sample counts, FPU parity, log projection/ticks, arbitrary interpolated shading
and full colorbar metadata behavior remain partial. Next priority is CMOS's
logarithmic tick selection and mixed text/math descriptions, with the failing
browser evidence retained as the baseline.

## Reproduction

```sh
node --test test/pgfplots-surface-survey.test.js test/case-by-case-acceptance.test.js
node --test --test-reporter=./scripts/module-test-reporter.js --test-reporter-destination=outputs/qa/2026-10-25-surface-survey-after/test-summary-final.json test/*.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/pgfplots-surface-survey --output outputs/qa/2026-10-25-surface-survey-after --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --strict-tikztosvg
node scripts/audit-module-regressions.js --fixtures test/fixtures/pgfplots-surface-survey --output outputs/qa/2026-10-25-surface-survey-after --before outputs/qa/2026-10-25-surface-survey-before --tick-grid-metrics --browser-module /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
npm run check:architecture
npm run docs:links
git diff --check
```
