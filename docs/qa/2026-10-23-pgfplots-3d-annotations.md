# PGFPlots 3D Annotations, Scaling and Surface Topology

## Scope and Status

This batch targets the shared 3D projection, axis-description and mesh
semantics behind failing PGFPlots tests. It does not certify the entire
library. PGFPlots remains **partial**. Browser geometry gates and full-image
acceptance are recorded separately; passing geometry does not waive visible
shading, mesh or text differences.

The starting full-suite inventory is the 71 failures recorded in
`outputs/qa/2026-10-23-multiline-math-after/test-summary.json`, following the
earlier 76-failure path-node batch. The final inventory is saved as
`outputs/qa/2026-10-23-pgfplots-3d-labels-after/test-summary.json`.

Final full-suite result: **2,879 tests, 2,810 passed, 55 failed, 14 skipped**.
There are no new failing test names compared with that 71-failure baseline;
the skip count is unchanged. This is a reduction of 16 failing tests, not a
claim of 16 independent visual defects fixed. The 38 focused native-metric
and browser-gate tests pass. The gallery remains 660/660 rendered with zero
diagnostics; architecture and documentation-link checks pass.
The local package-consumer check also passes with 82 font faces and zero
diagnostics. It creates a temporary package installation only; nothing was
published to npm.

## Local MacTeX Review

All paths below are relative to `/usr/local/texlive/2025/texmf-dist/`.

| Source | Native rule used |
| --- | --- |
| `tex/generic/pgfplots/pgfplots.scaling.code.tex`, 130-180, 226-615, 814-875, 1049-1095 | Reserve 45 TeX pt for descriptions, construct the projected basis from the view, and switch reciprocal/final-scale arithmetic at compat 1.4/1.6. Rounding each vector component is not equivalent to fitting a constant canvas gutter. |
| Same file, 2180-2298 and 2990-3225 | Default width/height aspect and normalized data spans determine the final unit vectors. |
| `tex/generic/pgf/math/pgfmathfunctions.basic.code.tex`, 50-270 | Fixed-point division and reciprocals use repeated decimal operations and TeX scaled-point truncation. |
| `tex/generic/pgfplots/pgfplotscoordprocessing.code.tex`, 1585-1815 | Near-tick-label anchors transform the edge direction into node space, snap small components and intersect the real text box. |
| `tex/generic/pgfplots/pgfplots.code.tex`, 406-450, 888-925, 1115-1200 | Axis description aliases/styles and colorbar child-axis defaults determine anchors, rotations, separation, ticks and titles. |
| Same file, 2660-2700, 6252-6287, 6339 | Boxed 3D axes enlarge automatically inferred z limits by 10%; nonboxed axes suppress that default. Color metadata must retain the surveyed range. |
| Same file, 7980-8098, 8570-8705; `pgfplotsticks.code.tex` | Ticks belong to oriented coordinate planes; their face and painting order determine which marks remain visible. |
| `pgfplotscoordprocessing.code.tex`, 3004-3055; `pgfplotsmeshplothandler.code.tex`, 443-550, 2551-2580, 3362 | Complete the final scanline and prefer its length over geometric guesses. A one-row/one-column surface becomes line patches, not invented 2D faces. |
| `pgfplotsmeshplothandler.code.tex`, 2890-3005; `pgfplots.code.tex`, 3820-3837 | `shader=flat` fills and strokes with the same mapped color, preventing translucent cracks. `flat,draw=black` overrides the stroke; faceted shaders install a darkened mesh color. |
| `tex/latex/base/fontmath.ltx`, 220-221, 296 and 399 | `\Re`/`\Im` use CMSY slots 3C/3D; `\cdot` uses slot 01. Correct font/glyph selection preserves native labels, scientific-notation boxes and superscripts. |

Native metric probes are stored under `test/fixtures/`:
`pgfplots-3d-label-metrics.tex`, `pgfplots-3d-regression-metrics.tex`,
`pgfplots-3d-scaling-metrics.tex`, `pgfplots-3d-bounds-metrics.tex` and
`pgfplots-colorbar-metrics.tex`. Expected values come from local pdflatex,
not screenshot fitting. Assertions allow 0.055 **TeX pt**; SVG/PDF pt use
72/in while TeX pt uses 72.27/in.
Their generated pdflatex logs are preserved in the after directory's
`native-metrics/` folder.

Examples of measured plot extents in TeX pt:

| Probe | Width | Height |
| --- | ---: | ---: |
| Default legacy projection | 196.34694 | 162.56757 |
| Same range, compat 1.3 | 193.37152 | 161.20345 |
| Same range, compat 1.18 | 194.97368 | 161.97858 |
| Oblique ridge | 383.60730 | 324.48056 |
| `3d-function-4` | 384.44315 | 324.00195 |

## Implementation

- `src/pgfplots/scaling3d.js`: native fixed-point stretch projection and compatibility-dependent normalization. Uniform/logarithmic/explicit-unit modes deliberately retain the existing route.
- `geometry.js`, `axis3d.js`, `axisOptions.js`, `labels.js`, `ticks.js`: native CM text boxes, near-label anchors, explicit positions/styles, per-face ticks and measured description bounds. Colorbars act as independently sized 2D child axes.
- `rangeResolver.js`, `axisTikzLowering.js`: inferred z-limit enlargement is separate from surveyed color bounds; remove synthetic 3D gutters and paint top-view ticks above surface fills.
- `surface.js`: preserve one-dimensional scanlines, explicit flat grids and zero-height stepped facets; do not infer extruded walls for an ordinary flat quad. Flat shading inherits from the axis and keeps the same-color native stroke instead of a darkened faceted outline.
- `src/tex/mathBox.js`: resolve the native CMSY multiplication dot used in scaled ticks and scientific tables.
- `scripts/build-cm-math.py`, generated CM metrics and 12 CMSY/CMBSY font faces: map `\Re` and `\Im` from local Type 1 slots 3C/3D, including small optical sizes and bold math. No replacement font is used.
- `scripts/browser-axis-grid-metrics.js`: measure real 3D frame/tick/grid/glyph/canvas geometry, including missing or extra elements, rather than relying only on raster difference.

The new regression tests are in
[pgfplots-3d-label-metrics.test.js](../../test/pgfplots-3d-label-metrics.test.js).
There are no per-fixture coordinate offsets or relaxed screenshot thresholds.

## Commands and Options Checked

| Syntax | Covered behavior and boundary |
| --- | --- |
| `\begin{axis}`, `\addplot3`, `surf`, function expressions, `coordinates` | Shared projection, sampled surfaces and coordinate meshes. Arbitrary plot handlers are not certified. |
| `width`, `height`, `view`, `plot box ratio`, `scale only axis`, `compat` | Linear auto/stretch sizing and native arithmetic. Uniform scaling, logarithmic axes and explicit unit vectors remain outside this acceptance slice. |
| `xmin/xmax`, `ymin/ymax`, `zmin/zmax`, `enlargelimits`, `enlarge z limits` | Native inferred-z behavior with explicit bounds preserved. This is not a complete native survey/point-meta implementation. |
| `xlabel`, `ylabel`, `zlabel`, common/directional label styles, `at`, `anchor`, `rotate`, shifts, `text` | CM math/plain label dimensions and explicit placement; no guarantee for every non-CM font or arbitrary TeX side effects. |
| Tick lists/distances, `grid=major`, `axis lines=left/box`, small tick fonts | Oriented ticks, grid edges, near-label placement and canvas bounds; complete foreground-face variants remain partial. |
| `colorbar`, `colorbar horizontal`, `colorbar style`, title, `at`, height, anchor | Child-axis size, native labels, two-sided ticks and frame. Gradient interpolation still has visible differences. |
| `mesh/cols`, coordinate scanlines, `shader=flat`, `draw`, `faceted color`, `opacity` | Line-patch fallback, explicit grid topology, same-color flat strokes and explicit stroke overrides. All patch/shader modes are not newly certified. |
| Colormap declarations, `point meta min/max` | Explicit inline colormap control and separation from z-axis enlargement. General point-meta survey semantics remain partial. |
| `\cdot`, scientific numbers, superscripts | Native glyph and script sizes are retained. The table control still exposes existing plain-text/row-baseline differences. |
| `\Re`, `\Im` | Native ordinary CMSY symbols in default/browser and export math, including bold and small optical sizes. |

## Reference and Browser Evidence

`command -v tikztosvg` resolves to `/Library/TeX/texbin/tikztosvg`, version
0.3.0. References use local pdflatex, followed by `rsvg-convert` 2.63.0.
No remote compiler, package installation or non-MacTeX font was introduced.

Local artifact roots:

- `outputs/qa/2026-10-23-pgfplots-3d-labels-before/`: preserved baseline.
- `outputs/qa/2026-10-23-pgfplots-3d-labels-after/`: refreshed JS SVG/PNG, tikztosvg SVG/PNG, MacTeX native PNG, browser screenshots, diff sheets and test results.

The after directory contains `browser-audit.html`, `browser-audit.json`,
`browser-axis-gates.json`, `browser/`, `tikzkit-svg/`, `tikzkit-png/`,
`tikztosvg-svg/`, `tikztosvg-png/`, `mactex-png/` and `diff/`.
These are generated local artifacts, not promised GitHub download links.

The browser harness calls the actual JS API and paints both its default SVG
and SVG-text export beside tikztosvg in Chrome at the same physical 3x scale.
It does not exercise the editor UI or in-page compilation. No per-case fitting
or translation is used for the browser geometry checks.

All 17 fixtures generated JS SVG/PNG, tikztosvg SVG/PNG and direct MacTeX PNG
successfully. Their freshly generated browser panels and native/diff sheets
were inspected after rebuilding the CM symbols; the browser run reported
zero errors. A separate sandboxed test attempt had six local-HTTP
`listen EPERM` failures. The authoritative full-suite result above was rerun
with local listening allowed; these environment failures are not counted as
code fixes.

All five axis gates pass in both JS modes: boxed, left, explicit description,
small-font and default legacy-left. Maximum tick error is 0.112px, glyph
error 0.095px, frame error 0.045px and canvas error 0.054px, against 0.35px.
The boxed control now contains the same 39 ticks as native, instead of 27;
the left-axis control contains 13 instead of 9. Diff pixels are supplementary,
not substitutes for these geometry and visible-output checks.

Full-image acceptance remains **blocked**. The unchanged raster thresholds
classify six JS/tikztosvg pairs as matching and eleven as different, including
two canvas-dimension mismatches. All 17 still fail the combined native-PNG
gate. Native PDF rasterization also differs from the native SVG rasterization,
but that does not waive the real arrow, shading, mesh and table differences.
The five precise browser geometry passes above are a narrower result, not
17 visually accepted cases. Both `diff/summary.json` and the preserved
`browser-axis-gates.json` retain those separate outcomes.

| Cases | Visible change / remaining difference |
| --- | --- |
| Boxed, left, explicit, small, legacy-left | Wrong-side descriptions, ignored size/style and missing back-face ticks are corrected in the inspected browser panels. Frame and canvas bounds agree. |
| `3d-function-9`, `3d-function-4`, `hypersurface-2` | Projection extents, tick/axis descriptions and colorbar placement follow native dimensions rather than fitted margins. Mesh/raster detail remains subject to the full-image gate. |
| `3d-manhattan-bar-plot` | Restore zero-height floor facets and native headroom/canvas size without desaturating maximum blue values. Some mesh strokes still differ. |
| `axis-3d-flat-planes` | Previously invented filled/extruded slabs become the same two sets of zigzag line patches as native. |
| `axis-3d-explicit-flat-planes`, `axis-3d-inline-colormap` | Explicit 2D grids produce flat quads without invented side walls or darkened faceted outlines. |
| `axis-3d-flat-shader-strokes` | Paired control checks mapped-color versus explicit black mesh strokes at opacity 0.5. It also exposed and guards native `\Re`/`\Im` labels instead of browser/export font fallbacks. |
| Vertical and horizontal colorbars | Tick/title position and text bounds improve. Remaining gradient/raster differences are not waived. |
| `3d-gradient-colored` | Top-view bounds and labels improve; ticks no longer disappear under the surface. Quiver arrow size and shading still differ visibly. |
| `pgfplotstable-number-formats` | Scientific values, CMSY dots and small raised exponents survive. Plain-text column widths and row baselines still differ. |

The tikztosvg references use filled path facets, separately painted mesh
strokes and transformed glyph paths. Flat patches have matching fill/stroke
colors, with separate 0.5 fill/stroke opacity in the transparent control;
degenerate scanlines are open stroked paths. JS retains text with embedded
MacTeX-derived CM fonts and matches the native transformed box geometry.

## Test Contract Corrections

Implementation changes precede these corrections; failures were not hidden
with skips, deleted assertions or looser tolerances.

- Earlier 3D tests encoded fitted dimensions. Independent pdflatex probes now supply their expected unit vectors and extents.
- The inline-colormap test asked for a filled 2D patch but supplied one scanline. It retains its blue-fill assertion with explicit `mesh/cols=2` and point-meta bounds, verified by a matching native fixture.
- The axis-level surf test now guards native one-dimensional output; a separate explicit-grid test guards filled faces and absence of invented walls.
- The flat-shader test retains its mesh-stroke, rotated z-label and separated-layer assertions, and additionally checks native mapped-color versus explicit black strokes. An initial fill-only interpretation was rejected after inspecting the transparent native SVG and browser panel; the implementation now preserves those colored edges.
- Scientific-number tests inspect semantic glyph order, CMSY font selection and exponent geometry instead of expecting contiguous fallback SVG text. The numerical table-cell assertions remain unchanged.

## Reproduction and Remaining Work

```sh
node --test test/pgfplots-3d-label-metrics.test.js test/browser-axis-grid-metrics.test.js test/native-cm-symbols.test.js
node --test --test-reporter=./scripts/module-test-reporter.js
npm run gallery:audit
npm run check:architecture
npm run docs:links
node scripts/render-example-fixtures.js --fixtures test/fixtures/pgfplots-3d-labels \
  --output outputs/qa/2026-10-23-pgfplots-3d-labels-after \
  --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --strict-tikztosvg
node scripts/audit-module-regressions.js --fixtures test/fixtures/pgfplots-3d-labels \
  --output outputs/qa/2026-10-23-pgfplots-3d-labels-after \
  --before outputs/qa/2026-10-23-pgfplots-3d-labels-before \
  --browser-module /absolute/path/to/playwright/index.mjs
node scripts/diff-example-pngs.js --output outputs/qa/2026-10-23-pgfplots-3d-labels-after --register
```

Next priorities are the remaining large visible mismatches: quiver arrow
geometry, interpolated surface coloring, mesh stroke ownership and table
baseline/font layout. The remaining full-suite failures must continue to be
triaged individually. This batch is not a release or a claim of complete
PGFPlots compatibility.
