# PGFPlots Quiver, Color Models and Failure Triage

## Scope and Status

This batch repairs function-quiver sampling and arrow paint, and the color
pipeline used by the real `3d-gradient-colored` and `3d-gradient-cos` examples.
It also verifies four function/color regressions and the related histogram
tick/bounds repair. PGFPlots remains **partial**. The complete figures are not
certified merely because a renderer exits successfully or emits no diagnostics.

The source is unchanged in the two real gradient cases. Smaller controls
isolate inherited arrows, point metadata, option overrides, clipping, single-row
sampling, RGB-first/CMYK-first colormaps, and flat-corner patch selection.
They complement the real figures rather than replacing them.

## Local Implementation Evidence

All paths below are under `/usr/local/texlive/2025/texmf-dist/tex/`.

| Source read | Implementation rule |
| --- | --- |
| `generic/pgfplots/pgfplotsplothandlers.code.tex`, quiver handler | Quiver has no implicit tip. Each arrow is a TikZ path with inherited draw options and the per-point `every arrow` style. |
| `generic/pgfplots/pgfplotscoordprocessing.code.tex`, metadata transformation | Explicit metadata limits participate in normalization; a constant metadata stream maps to zero, while absent metadata retains the native default. |
| Same file, lines 5418-5446, 5600-5630, 5700-5738 | Sample the original domain, then clip the picture. `samples y<2` switches to line sampling at y=0, even when a nonzero y domain was supplied. |
| `generic/pgf/libraries/pgflibraryarrows.meta.code.tex`, Latex definition | Tip size depends on line width; the back curve uses the source cubic coefficients, not a fitted triangle or shortened constant. |
| `generic/pgf/basiclayer/pgfcoregraphicstate.code.tex` | PGF starts with miter limit 10, unlike SVG's default 4. |
| `generic/pgfplots/util/pgfplotscolor.code.tex` | Automatic color space is CMYK for a CMYK first stop, RGB for an RGB/gray first stop; remaining stops are converted into that model. |
| `generic/pgfplots/util/pgfplotscolormap.code.tex` | Interpolate stored model channels before final device-color painting. |
| `latex/graphics/dvipsnam.def` | SkyBlue is CMYK (.62,0,.12,0); SpringGreen is (.26,0,.76,0), not their CSS namesakes. |
| `generic/pgfplots/pgfplotsmeshplothandler.code.tex`, lines 2940-3068 | Flat surface handlers fill and stroke with mapped paint; corrected flat-corner uses the first source vertex before z-buffer sorting. |
| `generic/pgfplots/pgfplots.code.tex` | Default 3D descriptions request three minimum ticks, and clipping uses the convex hull of the projected axis box. |

The histogram investigation separately read literal-tick expansion,
near-ticklabel projection, outer anchors, and the after-axis marker pass.
See [its source/measurement record](2026-10-23-histogram-bounds.md).

Native independent probes are source-controlled as
`test/fixtures/pgfplots-quiver-metrics.tex` and
`test/fixtures/pgfplots-colormap-models.tex`. The first logs raw/transformed
metadata. The second logs model selection and interpolation, and paints
independent CMYK/dvips patches. Explicit CMYK (.5,0,0,.5) exports as
RGB percentages (28.431702,46.469116,55.099487); that is not RGB interpolation
between an already converted cyan and black.

## Changes

- `quiver.js` / `quiverOptions.js`: preserve native path options, namespaced
  keys, per-point metadata and source-ordered style/prefix/append operations;
  remove invented stealth/default fixed-size Latex tips. Scale-arrow and
  arrow-size expressions use the existing restricted PGF math evaluator.
- `quiver.js`: retain the original sampling lattice and metadata range even
  when the viewport is smaller. Single-y-sample plots use one row at zero.
- `clipping.js` / `axisOverlay.js`: share the existing projected convex-hull
  clip construction. Quiver shafts and tips use the same final viewport;
  `clip=false` disables both.
- `options.js`, `style.js`, `paths.js`: preserve miter limits and arrow paint
  opacity, and use the native Latex cubic control coefficients.
- `colors.js` / `surface.js`: keep natural model channels until interpolation
  is finished, preserve fractional RGB stops, use flat-corner's first vertex,
  and retain native same-color surface strokes even with `draw=none`.
- `ticks.js` / `axisTikzLowering.js`: native 3D tick minimum, literal CM tick
  painting, measured histogram descriptions and after-axis marker layering.

No fixture-specific arrow coordinates or label offsets were introduced.

## Browser and Native Comparison

`command -v tikztosvg` resolves to `/Library/TeX/texbin/tikztosvg`.
It runs with local pdflatex; SVG PNGs use `rsvg-convert`. The QA directories
contain separate `mactex-png`, `tikztosvg-svg`, `tikztosvg-png`, `tikzkit-svg`,
`tikzkit-png`, `browser`, and `diff` artifacts. Chrome paints both the default
JS result and exported SVG-text with the local bundled MacTeX-derived fonts.
Reference glyphs are outlined SVG paths; JS uses the native-font text boxes.

| Case / observed problem | Visible change and remaining boundary |
| --- | --- |
| `3d-gradient-colored` | Metadata-dependent Latex tips regain native width/length behavior; they are no longer uniformly tiny. RGB-first conversion removes the inappropriate painted-CMYK tint from color stops. Surface sampling/quantization differences remain. |
| `3d-gradient-cos` | Classic inherited stealth tips are retained instead of being replaced by fixed Latex tips. Projected clipping includes arrow outlines. Oblique surface/painter differences remain. |
| Inherited/override controls | No-arrow, start/end/open tips are distinct; open joins no longer bevel at SVG's default limit. Tip opacity now follows the stem. |
| Flat-corner strips | Each cell starts at the source vertex's color instead of the average; cyan/black interpolates in CMYK, not converted RGB. Same-color strokes remove white shared-edge seams. Fixed-point palette lookup still differs slightly. |
| Sampling-window control | Overlapping arrows at half-step spacing become the correct separated arrows at integer starts. Clipping no longer changes the metadata normalization. |
| Single-row control | Two incorrect rows at .4/.8 become one row at y=0. |
| Function colors | Native green and CMYK cyan match the current paint model. The ordinary hat and subscript now share native glyph construction in both JS modes, but the pin positions and leaders still differ. `red!90!black` still differs by one RGB byte. |
| Histogram | Literal tick ink no longer sits about 4px too high at 3x zoom. Xlabel/bottom-edge error falls from about .822px to .028px. Rotated near-coordinate labels/top extent remain visibly different. |

The new sampling controls have nonempty **actual browser paint gates**:
translate each output once to its independently painted black frame, keep
the physical scale unchanged, and compare both directions within 1 screenshot
pixel at 3x zoom. Required coverage is 98%, with frame extent error <1px.
This checks arrow paint only, not all tick text or arbitrary 3D views.

| Control | Before JS paint coverage | After JS / native coverage | Frame extent error |
| --- | ---: | ---: | ---: |
| Original-domain sampling | 70.09% | 99.93% / 99.57% | .0061px |
| Single-y-sample line | 0% | 100% / 99.89% | .0093px |

Default browser JS and exported SVG-text agree on these measurements. The
before controls fail; the after controls pass. Actual native/browser/diff
panels were inspected, not just the coverage numbers.

Artifact roots:

- `outputs/qa/2026-10-23-pgfplots-quiver-before`: retained earlier gradient,
  style and incremental flat-corner baseline. Old non-grid controls in this
  directory used a degenerate native y domain and are **not** valid evidence;
  only current `*-grid` controls and the real cases are used.
- `outputs/qa/2026-10-23-pgfplots-quiver-after`: combined current nine-case audit.
- `outputs/qa/2026-10-23-quiver-sampling-before` and `-after`: the two sampling
  controls, with before/after/native browser paint measurements.
- `outputs/qa/2026-10-23-pgfplots-function-colors-before` and
  `outputs/qa/2026-10-23-pgfplots-function-colors`: four function/color controls.
- `outputs/qa/2026-10-23-histogram-bounds-after`: measured literal ticks,
  description anchors, actual ink and canvas bounds.

## Commands and Parameters Audited

Supported in this bounded slice: `axis`, function `addplot3`, `quiver`, `u/v/w`,
`scale arrows`, `every arrow/.style`, `/.append style`, `/.prefix style`,
`domain`, `y domain`, integer `samples`, `samples y=1`, point metadata expressions,
explicit metadata min/max and per-plot normalization, inherited arrows and `>`,
Latex/Stealth/open/start/end tips, PGF-math `scale`/`scale length`/`scale width`,
draw/fill opacity, shortening, final global/individual viewport clips,
`clip=false`, top-view minimum tick count, natural-model custom colormap stops,
`shader=flat`, `flat mean`, and corrected `flat corner`.

Not completed: coordinate/table quiver, per-axis shared quiver metadata,
colored-quiver handlers, logarithmic/samples-at/FPU-complete sampling,
arbitrary repeated key callbacks, full color-series/target-model selection,
exact fixed-point colormap lookup, old `correct shader flat=false` ordering,
interpolated 3D shading, arbitrary 3D foreground layers, and general pin/rotated
node placement. No all-library or whole-corpus acceptance is implied.

## Test Evidence and Reproduction

New semantic failures were observed before their runtime fixes for arrow
inheritance/scale/opacity, original-domain sampling, single-y-sample behavior,
flat-corner selection, native flat outlines, and histogram text/anchors.
The focused quiver/colormap/histogram-bound suites have 24 passing tests.

Four old function test selectors were corrected only after same-source
MacTeX and browser inspection: TeX green is RGB(0,255,0), `cyan!50` paints
RGB(128,214,247), `cyan!50!black` paints RGB(73,118,141), and orange is
serialized as RGB(255,128,0) rather than a CSS named color. Their original
curve/range/anchor assertions remain. These are evidence-based stale assertion
corrections, **not four new rendering fixes**. The color audit separately
keeps the one-byte red mismatch failed rather than relaxing its threshold.

### Full-Suite Checkpoint

The final complete test run has **2910 tests: 2846 passed, 50 failed,
14 skipped, zero cancelled**. This batch started at 2879 tests with
55 failures and the same 14 skips. Comparing failure names and files finds
five resolved failures and no newly failing tests. The exact inventory is
`outputs/qa/2026-10-23-pgfplots-quiver-after/test-summary-final.json`.

Of the five old failures, four are the color-selector corrections above;
the other is the histogram foreground/description/bbox regression. The
31 additional tests guard the new quiver/color, histogram, path-stroke and
native-hat behavior. This count is not a claim that five complete figures
are now visually identical. The original labelled-arrow height test still
fails, as do the strict one-byte color and whole-figure visual gates.

Native literal ticks and ordinary hats also invalidated seven tests which
still expected the old fallback output. Their coverage was preserved:
tick tests now verify native glyphs, advances, baselines and both duplicate
1946 date labels; unsupported-math tests use the genuinely unsupported
`widehat` while ordinary-hat tests verify CMR/CMMI construction. They were
not removed, skipped or made tolerant of incorrect geometry.

The full 660-case gallery renders without diagnostics. Architecture and
documentation-link checks pass; the existing text-to-frontend dependency
debt remains. Successful rendering is not a 660-case visual acceptance.

Related source/browser evidence:

- [Ordinary math hat and script construction](2026-10-23-native-math-hat.md).
  Original-source MacTeX and tikztosvg are kept separate because the local
  converter preloads AMS packages, changing some accent semantics.
- [Stroked paths with inline nodes](2026-10-23-path-stroke-bounds.md).
  Empty nodes no longer suppress pen-width bounds or crop rounded line ends;
  the bare-math label height remains unaccepted.

Next visual priorities are compact math-node metrics/anchors, absolute pin
placement, multiline/rotated axis labels and remaining 3D surface ordering.
The 50 failures are retained in the inventory rather than reclassified as
passes on the basis of zero diagnostics or a small image-difference mean.

```sh
node --test test/pgfplots-quiver-styles.test.js \
  test/pgfplots-colormap-models.test.js test/pgfplots-histogram-bounds.test.js

node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/pgfplots-quiver \
  --output outputs/qa/2026-10-23-pgfplots-quiver-after \
  --native-reference --tikztosvg-engine pdflatex \
  --math-renderer svg-text --strict-tikztosvg

node scripts/audit-module-regressions.js \
  --fixtures test/fixtures/pgfplots-quiver \
  --output outputs/qa/2026-10-23-pgfplots-quiver-after \
  --before outputs/qa/2026-10-23-pgfplots-quiver-before \
  --browser-module /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs

node scripts/diff-example-pngs.js \
  --output outputs/qa/2026-10-23-pgfplots-quiver-after
```

The function-color audit uses `test/fixtures/pgfplots-function-colors` and
its matching output directory; its strict color gate is expected to report
the unresolved red rounding difference. A successful render without an
applicable gate is not counted as a visual pass.
