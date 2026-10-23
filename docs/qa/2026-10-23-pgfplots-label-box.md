# PGFPlots Explicit Labels and Boxed Axes

## Scope and Status

This follow-up repairs explicit 2D axis-description placement and the text
bounds of ordinary boxed axes. It extends the
[previous tick/text work](2026-10-23-pgfplots-tick-planning.md), not the entire
PGFPlots implementation. PGFPlots remains **partial**.

Six small browser fixtures pass the unchanged 0.35px geometric tolerance at
3x physical scale. The real activation-functions and cos-fixpoint controls
also retain their tick, text and legend acceptance. The real bias-variance
and light-bulb plots have improved axis labels, but their ordinary-text
legends still differ. A scaled-picture fixture exposes a separate optical-font
problem and is explicitly **not accepted**.

## Local MacTeX Review

All source paths below are relative to
`/usr/local/texlive/2025/texmf-dist/`.

| File | Rule used in the implementation |
| --- | --- |
| `tex/generic/pgfplots/pgfplots.code.tex`, lines 888-908 | Legacy absolute labels use x-label `yshift=-15pt` and y-label `xshift=-35pt,rotate=90`. Replacing `at` does not erase those transforms. Near-tick labels use a different default style. |
| Same file, lines 2502-2518 and 4965-4966 | Common `label style`, direction-specific label styles and their aliases append to the same underlying style. Selecting just one alias loses common color, separation and font settings. |
| Same file, middle-axis styles and `axis description cs` | Middle axes reset their description styles; explicit description coordinates are normalized against the transformed plot rectangle, not its text-expanded canvas. |
| `tex/generic/pgfplots/pgfplotsticks.code.tex`, near-ticklabel implementation | Label anchors are constructed from node dimensions and axis normals. Native box height and depth matter, not just a visual center. |
| `tex/generic/pgf/basiclayer/pgfcoretransformations.code.tex`, lines 232-285, 367-369 and 412-421 | PGF postmultiplies transformations. A shift after rotation follows the rotated axes, and repeated rotations add. Default y-label rotation participates too. |
| `tex/generic/pgf/modules/pgfmoduleshapes.code.tex`, rectangle anchors | Inner separation, outer separation and TeX text height/depth jointly determine anchor positions and picture bounds. |

The native [anchor probe](../../test/fixtures/pgfplots-label-box-metrics.tex)
records named-node centers, text anchors, frame corners and picture bounds.
Representative values are in TeX pt:

| Probe | Native result |
| --- | --- |
| Default frame north east | `(194.99970,161.99493)` |
| Default x-tick 5 center / text anchor | `(194.99970,-6.75519)` / `(192.49970,-9.97740)` |
| Default y-tick 5 center / text anchor | `(-6.03297,161.99493)` / `(-8.53297,158.77272)` |
| Default picture south west / north east | `(-11.86595,-13.31038)` / `(200.83267,168.55013)` |
| Explicit shifted xlabel / ylabel centers | `(45.67883,-18.70660)` / `(-23.02255,56.90460)` |
| Legacy absolute xlabel / ylabel centers | `(42.67883,-22.00519)` / `(-58.73053,85.35690)` |
| Ordered transform xlabel / ylabel centers | `(45.67883,-14.92268)` / `(-25.73053,62.90460)` |

These values drive the new regression tests. They were not obtained by
fitting JS output to an image. The first three tests failed before the
runtime changes; the transform test additionally caught the incorrect
unrotated-shift implementation before its correction.

## Implementation

- `src/pgfplots/axisOptions.js`: one predicate chooses the audited native 2D text path consistently for ticks, descriptions and bounds. New coverage is limited to CM roman/math on boxed or middle axes. Hidden/mixed axes, 3D, datavisualization and picture-scale changes retain existing paths.
- `src/pgfplots/labels.js`: combine common and axis-specific styles, respect `xlabel style`/`ylabel style` fonts, retain legacy absolute offsets, accumulate rotations, and compose physical shifts in source order. Normalize unaligned line breaks before native text measurement. Supported native labels no longer receive 1.06 width fitting or guessed descent padding.
- `src/pgfplots/ticks.js`: boxed numeric ticks use native TeX box anchors rather than the old additional 0.8pt baseline shift.
- `src/pgfplots/axisTikzLowering.js`: supported boxes and explicit descriptions start from the actual plot rectangle. The real text-node boxes determine the surrounding canvas instead of adding estimated gutters again.
- `scripts/browser-axis-grid-metrics.js`: boxed-axis comparisons locate the actual closed frame, use its south-west origin, and independently check frame dimensions and all four canvas edges. A new regression ensures changed or missing frames cannot pass.
- `scripts/audit-module-regressions.js`: preserve access to pre-repair browser SVGs when a selective external render has replaced managed exports.

No per-case label coordinates were added to runtime code. The literal and
mathematical glyph painters continue using the packaged local MacTeX fonts.
The pre-existing font, color and legend work in this dirty worktree is not
claimed as new work in this batch.

## Commands and Parameters Checked

Sources are in the [fixture manifest](../../test/fixtures/pgfplots-label-box/manifest.json).

| Commands/options | Coverage in this batch |
| --- | --- |
| `\usepackage{pgfplots}`, `\pgfplotsset{compat=1.18}`, omitted compat | Native modern versus legacy description defaults are compared. Other compatibility transitions are not newly certified. |
| `\begin{tikzpicture}`, `\begin{axis}`, `\addplot` | Real browser output for box and middle axes, linear/parabolic/cubic sampled curves. No new function parser is introduced. |
| `width`, `height`, `scale only axis`, `xmin/xmax/ymin/ymax`, `enlargelimits=false` | Default 195pt by 162pt frame and explicit physical frames retain their sizes while text changes the canvas. |
| `axis lines=box/middle`, `grid=major`, `xtick/ytick` | Frame, ticks, grids, numeric glyphs and default line colors/widths are checked together. |
| `xticklabel pos=upper`, `yticklabel pos=right`, `tick align=outside`, `font=\footnotesize` | Top/right tick labels use 8pt optical math boxes and native anchors. |
| `xlabel`, `ylabel`, common `label style`, both spelling aliases | Plain `office AV` and `gyp`, color, font overrides, inner separation and explicit anchors survive style combination. |
| `at={(axis description cs:x,y)}` and normalized `at={(x,y)}` | Position is relative to the frame, with default absolute shifts preserved where applicable. Tests include positions outside the frame. |
| `anchor=north/south`, `xshift`, `yshift`, repeated `rotate` | Physical shifts follow preceding rotation. The transform fixture includes `rotate=30,...,rotate=-30`; the boxed ylabel inherits 90 degrees. |
| `rotate={90}` on a boxed ylabel | Adds to its native default 90 degrees, yielding 180 degrees rather than replacing the default. Native output confirms the upside-down label is intentional. |
| `font=\small`, `\large`, `\boldmath\Large`, `text=red/blue`, `inner sep=2pt` | Native glyph counts, positions, color and node centers are checked. The plain label includes the `ffi` ligature and `AV` kern. |
| `\\` without alignment / with `align` or `text width` | Unaligned descriptions normalize to spaces before measurement. Paragraph/multiline layout remains on its existing path, not newly certified. |
| Picture `scale=0.5` | Tested and still visibly different. The new native-text migration deliberately does not include it. |

This does not provide a complete pgfkeys execution engine. Repeated,
interleaved top-level aliases can still lose full execution order when stored
in the existing option object. Later axis-style resets, arbitrary affine
transforms, executable callbacks and general TeX expressions in transforms
remain outside this accepted slice.

## Visual Evidence

`command -v tikztosvg` finds `/Library/TeX/texbin/tikztosvg`. The existing
render harness uses local pdflatex for native references and
`tikztosvg --pdflatex`, then `rsvg-convert` for SVG-to-PNG conversion.
No network font, online compiler or package installation was used.

Artifact roots under `outputs/qa/`:

- `2026-10-23-pgfplots-label-box-before/`: pre-repair browser SVGs and screenshots. Some managed exports were replaced by a selective render; the preserved `browser/*-2.svg` files supply those before panels.
- `2026-10-23-pgfplots-label-box-after/`: native PNGs, tikztosvg SVG/PNGs, JS SVG/PNGs, native probe logs/PDF, test summaries and the six-case browser audit.
- `2026-10-23-pgfplots-label-box-controls/`: fresh activation-functions and cos-fixpoint native/browser comparisons.
- `2026-10-23-pgfplots-label-box-residuals/`: fresh bias-variance, light-bulb and scaled-picture comparisons, explicitly not whole-case acceptance.

Each root contains `mactex-png/`, `tikztosvg-svg/`, `tikztosvg-png/`,
`tikzkit-svg/` and `tikzkit-png/`. Browser runs add `browser-audit.html`,
`browser-audit.json` and `browser/` screenshots, diffs and sheets. These are
local generated artifacts, not promised GitHub-hosted files.

Chrome paints both the default JS API result and the separately exported
SVG-text result alongside the local tikztosvg SVG. This checks actual browser
font loading, glyph placement and painted paths, not only exported PNGs.
The compiler is invoked by the Node audit harness; this run does not exercise
the editor's event handlers or compilation inside the interactive editor.

All comparisons use the same physical scale. Aligned sheets translate once
to the frame corner or middle-axis crossing; they never independently resize
labels or fit the reference. Raw canvas sheets remain available too.

| Fixture | Visible change | Final maximum glyph error at 3x |
| --- | --- | --- |
| Default box | Lower labels regain their native baseline and narrower CM numeral shape; canvas no longer includes duplicate estimated padding. | 0.073px, down from 4.301px |
| Upper box | Top/right 8pt numerals now sit at the native distance from the frame. | 0.054px, down from 5.844px |
| Explicit shifts | X label regains the common red color and 9pt font; y alias regains its 12pt font. Ligature, kerning and both node anchors match. | 0.070px; glyph count 15/15 rather than 18/15 |
| Absolute placement | Labels recover the native legacy 15pt/35pt separation; the left canvas expands to contain the correctly positioned y label. | 0.025px; glyph count 17/17 rather than 20/17 |
| Ordered transforms | The y label moves up/right according to the default rotation; x translation composes correctly around its two rotations. | 0.053px, down from 31.888px |
| Rotated math | Bold large x and 180-degree y math label match native placement and size. | 0.012px |

For the five boxed fixtures, maximum frame error is below 0.066px and
maximum canvas-edge error below 0.080px. Tick/grid errors are below 0.066px
for all six. Default JS and exported SVG-text both pass. New-case diagnostics,
browser errors and failed font loads are zero.

MacTeX native PNGs and browser JS/tikztosvg/diff panels were actually viewed.
The accepted small cases no longer show the former baseline, label-spacing
or crop displacements. Pixel diffs still contain outline/rasterization and
subpixel line-edge differences; these are not a claim of pixel identity.

The native SVG represents the frame with closed straight M/L paths, 0.3985bp
black frame strokes, 0.3985bp gray grid strokes and 0.19925bp tick strokes.
It uses butt caps, miter joins and transformed outline glyphs in `defs/use`.
JS uses separate paths and native CM SVG text. Native glyph origins and frame
edges are compared after their actual transforms, not by SVG serialization.

Activation-functions retains 121/121 glyph origins (maximum 0.298px), its
71-glyph legend, 14 ticks and 14 grids. Cos-fixpoint retains 32/32 glyph origins
(maximum 0.125px), its five-glyph legend, six ticks and six grids. Their sheets
were inspected again. This batch does not enlarge either case's acceptance
scope beyond the previously checked geometry/text/legend behavior.

## Tests and Reproduction

The [new tests](../../test/pgfplots-label-box.test.js) cover sync/async native
label centers, optical font sizes, shared styles, native box bounds, legacy
offsets and ordered transformations. Existing expectations were changed only
where local source/probe evidence supports the new runtime behavior. Semantic
IR assertions replace brittle single-text-element or option-order assertions;
failures lacking sufficient evidence remain failures.

```sh
node --test test/pgfplots-label-box.test.js test/browser-axis-grid-metrics.test.js

node --test --test-reporter=./scripts/module-test-reporter.js \
  test/pgfplots-seams.test.js test/pgfplots-docsrc.test.js \
  test/pgfplots-histogram.test.js test/pgfplots-legend-metrics.test.js \
  test/pgfplots-enlarged-clipping.test.js test/pgfplots-axis-text.test.js \
  test/pgfplots-tick-planning.test.js test/pgfplots-plain-labels.test.js \
  test/pgfplots-label-box.test.js

npm run test:summary
npm run check:architecture
npm run docs:links
git diff --check
```

| Check | Result |
| --- | --- |
| Focused PGFPlots suites | 320 tests: 299 pass, 21 fail; previous 316: 289 pass, 27 fail |
| Affected frontend/CSV/extra-tick/LDA/birthday/render-script suites | 124 pass, zero fail |
| Full suite | 2819 tests: 2712 pass, 93 fail, 14 skip; previous 2814: 2701 pass, 99 fail, 14 skip |
| Failure-name comparison | Six previous failures resolved, no added failing names. Full count includes one aggregate failure. |
| Architecture | Pass; existing `tikz/text.js` to frontend dependency debt remains documented |
| Documentation links / whitespace | Pass |

The full suite is **not green**. The 21 focused failures remain listed with
names, files and messages in `pgfplots-tests.json`. They include explicit
histogram cropping, a calibrated x-square canvas, multiline tick boxes,
3D surface topology/order, projected labels and colorbar bounds, plus older
color/serialization and axis assertions that still require native evidence.
None was skipped or relaxed just to make this batch pass.

To regenerate the external references:

```sh
node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/pgfplots-label-box \
  --output outputs/qa/2026-10-23-pgfplots-label-box-after \
  --preserve-output --native-reference \
  --tikztosvg-engine pdflatex --math-renderer svg-text

/Library/TeX/texbin/pdflatex -halt-on-error -interaction=nonstopmode \
  -output-directory=outputs/qa/2026-10-23-pgfplots-label-box-after \
  test/fixtures/pgfplots-label-box-metrics.tex
```

To repeat the accepted browser checks, set `PLAYWRIGHT_MODULE` to the
installed local Playwright module, without downloading one:

```sh
node scripts/audit-module-regressions.js \
  --fixtures test/fixtures/pgfplots-label-box \
  --output outputs/qa/2026-10-23-pgfplots-label-box-after \
  --before outputs/qa/2026-10-23-pgfplots-label-box-before \
  --only pgfplots-box-default --only pgfplots-box-upper \
  --only pgfplots-description-shifts --only pgfplots-description-absolute \
  --only pgfplots-description-transform --only pgfplots-box-rotated \
  --tick-grid-metrics --browser-module "$PLAYWRIGHT_MODULE"
```

## Remaining Work

1. Repair ordinary-text legend row height and frame sizing. Bias-variance and light-bulb remain improved, not complete. Their residual sheets show the displaced rows even though axis labels are better.
2. Separate picture scaling from NFSS optical-size selection. The 0.5-scale case must scale the original text design, not select a different smaller design. Its tick widths/baselines and canvas still differ.
3. Resolve the remaining explicit histogram/current-axis bounding-box test and multiline footnotesize tick-box test using native probes, without changing the expected crop to the current JS value.
4. Audit 3D projection, surface topology, near-ticklabel normals and colorbar extents as separate source-backed slices. This 2D change does not certify them.
5. Preserve full pgfkeys order/reset semantics before claiming arbitrary interleaved label styles or affine label transforms.
