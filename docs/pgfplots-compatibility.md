# PGFPlots Compatibility Worklog

PGFPlots compatibility is partial. A passing unit test or zero diagnostics
does not certify visual equivalence to local MacTeX. Each worklog records its
scope, native implementation references, browser comparisons and open gaps.

## Current Work

Latest explicit-test checkpoint: 2934 passed, 39 failed, 14 unchanged skips
out of 2987 tests. This batch reduced the previous 43 failures to 39,
with no new failing test names. Bare Node discovery also runs three manual
browser probes without their arguments; that separate issue remains open.
Complete figure compatibility remains partial;
see the first report for the distinction between rendering fixes and
evidence-based stale test corrections.

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
