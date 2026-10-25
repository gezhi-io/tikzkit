# PGFPlots Compatibility Worklog

PGFPlots compatibility is partial. A passing unit test or zero diagnostics
does not certify visual equivalence to local MacTeX. Each worklog records its
scope, native implementation references, browser comparisons and open gaps.

## Current Work

Latest explicit-test checkpoint: 3047 passed, 24 failed, 14 unchanged skips
out of 3085 tests. The native colormap follow-up fixes numeric color stops and
PGF fixed-point interpolation. Six color controls and seven 3D regression
controls pass the existing browser geometry gates. The previously failing
explicit-meta color gate passes unchanged. All 89 control facets now match
native computed colors within one byte; two nonuniform-map channels retain a
one-byte difference. The 24 existing unit-test failures are unchanged, so this
is visual compatibility progress, not a claim that those failures were removed.
Bare Node discovery also runs three manual browser probes without arguments;
that separate issue remains open. Complete figure compatibility remains partial.

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
