# PGFPlots Compatibility Worklog

PGFPlots compatibility is partial. A passing unit test or zero diagnostics
does not certify visual equivalence to local MacTeX. Each worklog records its
scope, native implementation references, browser comparisons and open gaps.

## Current Work

At the 2026-11-07 checkpoint, 3441 tests passed with zero failures and
14 unchanged skips out of 3455 tests. The current shared TikZ slice removes
the extra decorated-text stroke in the epochs/overfitting plot, preserves
postaction paths, isolates edge decorations and corrects ordinary text color.
Seven actual Chrome comparisons were inspected; four focused stroke gates
and four JS/tikztosvg PNG pairs pass. The real plot's legend/text differences,
two manual controls, browser text rasterization and independent PDF acceptance
remain open. These results supersede older test counts, not the documented
limitations of each library. Complete figure compatibility remains partial.

- [Text decoration replacement and the overfitting annotation](qa/2026-11-07-text-path-replacement.md)
- [Scoped clips, PGF operator binding and browser editing](qa/2026-11-18-project-review-fixes.md)
- [Native box paint, dashes and physical coordinates](qa/2026-10-29-pgfplots-box-paint.md)
- [Native PGF division and reciprocal, with a floating plot control](qa/2026-10-29-native-division-reciprocal.md)
- [Native numeric colormaps and fixed-point interpolation](qa/2026-10-25-native-colormap.md)
- [Native primes, calligraphic math and explicit boxed 3D labels](qa/2026-10-25-math-alphabets.md)
- [Datavisualization tick geometry and option replay](qa/2026-10-25-datavis-tick-geometry.md)
- [Small axes, multiline ticks and paint bounds](qa/2026-10-25-pgfplots-small-axes.md)
- [Logarithmic surfaces, ticks and mixed descriptions](qa/2026-10-25-pgfplots-log-surfaces.md)
- [Surface survey and projected clipping](qa/2026-10-25-pgfplots-surface-survey.md)
- [Final-range origins and minor ticks](qa/2026-10-25-pgfplots-origin.md)
- [Quiver styles, sampling and surface colors](qa/2026-10-23-pgfplots-quiver-colors.md)
- [Histogram bounds and literal tick baselines](qa/2026-10-23-histogram-bounds.md)
- [Native hats and pin formula construction](qa/2026-10-23-native-math-hat.md)
- [Path stroke bounds and remaining compact math-label differences](qa/2026-10-23-path-stroke-bounds.md)
- [3D annotations, scaling and surface topology](qa/2026-10-23-pgfplots-3d-annotations.md)
- [Explicit label placement and boxed axes](qa/2026-10-23-pgfplots-label-box.md)
- [Tick planning and number formatting](qa/2026-10-23-pgfplots-tick-planning.md)
- [Cosine fixed-point axis text](qa/2026-10-22-cos-fixpoint-axis-text.md)
- [Cosine fixed-point clipping](qa/2026-10-22-cos-fixpoint-clipping.md)
- [Legend layout](qa/2026-10-22-pgfplots-legends.md)

See the [extension registry](extension-registry.md) for the broader package
inventory. Generated browser and raster QA artifacts live locally under
`outputs/qa/`; the worklogs identify the exact directories.
