# PGFPlots 2D Ticks, Grids and Text Boxes

## Scope and Status

This batch repairs the shared linear 2D tick/grid planner, physical default
dimensions, source-ordered tick alignment, and native middle-axis text boxes. The failure inventory and the
recent cos-fixpoint work selected this slice. It does not finish all PGFPlots
failures. The package remains **partial**.

The existing real activation-functions, cos-fixpoint, learn-curve-ml and
2d-light-bulb sources are regression controls. Four small, reproducible
[fixtures](../../test/fixtures/pgfplots-ticks/manifest.json) isolate the same
shared mechanisms. They are not replacements for the original sources.
Two [optical-size fixtures](../../test/fixtures/pgfplots-plain-labels/manifest.json)
also guard literal CM labels and negative numeric ticks at 8pt and 12pt.

## Local MacTeX Review

The registry points to `tex/latex/pgfplots/pgfplots.sty`, under
`/usr/local/texlive/2025/texmf-dist/`. Its generic implementation was read:

| File under that root | Implementation rule |
| --- | --- |
| `tex/generic/pgfplots/pgfplotsticks.code.tex` | Physical spacing chooses a candidate count; linear automatic planning retries a rounded interval that cannot reach the next tick. Its seed truncates toward zero, so negative and positive intervals need not select identical spacing. Grids consume the prepared tick list. |
| `tex/generic/pgfplots/pgfplots.code.tex` | Defaults are `max space between ticks=35` and `try min ticks=4`. Bare spacing is in TeX points. Common grid style precedes minor-grid style; both default to thin black!25. `ticks=none` disables tick paint, not grid preparation. Nonboxed axis keys reset tick alignment when those keys execute. |
| `tex/generic/pgfplots/pgfplots.scaling.code.tex` | The default 240pt by 207pt allocation subtracts 45pt in both directions, just like explicit 2D dimensions. The plot box is 195pt by 162pt before other transformations. |
| `tex/generic/pgf/modules/pgfmoduleshapes.code.tex` | A node's center is based on half its TeX width and half height minus depth; inner separation and outer separation are distinct. Ordinary text descenders cannot use a generic visual-middle baseline. |
| `tex/latex/base/ot1cmr.fd` | NFSS selects optical CMR and CMBX designs for the requested point size, not a scaled 10pt font for every size. |
| `tex/generic/pgf/math/pgfmathfloat.code.tex` | `pgfmathprintnumber` uses `pgfutilensuremath`; negative numbers and decimal punctuation must be measured as math as well as painted as math. |
| `tex/generic/pgf/basiclayer/pgfcorepoints.code.tex` | Fixed-point line intersection computes the `right/above origin` anchors. Its rounding accounts for the remaining sub-0.1pt difference from exact rectangular endpoints. |

The [tick probe](../../test/fixtures/pgfplots-tick-planning-metrics.tex) records
native tick lists and plot dimensions. The
[plain-label probe](../../test/fixtures/pgfplots-plain-label-metrics.tex)
records text widths, heights, depths and axis-label anchors. At 10pt,
plain `x` and `y` both have width 5.27780pt and height 4.30554pt, but `y` has
1.94444pt depth. Their baselines must therefore differ relative to the center.
For `office AV`, the native regular widths are 33.51160pt at 8pt, 39.44449pt
at 10pt and 46.33841pt at 12pt. At 10pt bold the width is 45.65948pt.

## Implementation Changes

- `src/pgfplots/ticks.js`: one geometry-dependent model feeds tick and grid painting; positive explicit distances do not fall back to automatic ticks when empty. Linear minimum/retry behavior follows the local algorithm, and the artificial sparse-y cap is removed. Hidden tick paint and empty tick lists remain different states.
- `src/pgfplots/grid.js`: use the same automatic/distance/origin decisions as ticks. Minor grids inherit common grid styling before their own overrides and use native default thickness/color.
- `src/pgfplots/axis.js`: pass geometry into the shared tick model.
- `src/tikz/metrics.js`: replace fitted default middle-axis dimensions with the native 45pt allowance.
- `src/frontend/latex-shell.js`: prepend an inferred middle-axis alias instead of appending it after user keys. A later `tick align=outside` now remains outside.
- `src/pgfplots/axisTikzLowering.js`: measured text supplies default, enlarged and tick-labelled boundary-origin bounds. The learning-curve control caught double-counted estimated gutters; the implementation was corrected without relaxing its existing test. Tickless axes retain their separate arrow allowance.
- `src/tex/textBox.js`, `src/renderers/svg/nativeMath.js`, `plainTextNode.js`, `textEngine.js`: measure and paint literal CM text with the same MacTeX TFM box, ligatures, kerns and alphabetic baseline. Paragraphs, control sequences, unsupported fonts and explicitly fitted text retain the existing paths.
- `src/pgfplots/labels.js`, `src/engine/evaluate.js`: remove the 1.06 width compensation only in the native middle-axis scope. A native text box bypasses generic minimum-height guesses. Numeric tick measurement now uses the same math-number normalization as rendering, including at 8pt/12pt.
- `scripts/browser-axis-grid-metrics.js`: compare actual Chrome glyph origins, tick/grid centers, lengths, widths and grayscale at equal physical scale. All lines are matched one-to-one, not fitted individually. The origin is the unique middle-axis crossing, not a fraction rule or a Cairo-optimized clip rectangle.

The browser measurement also accounts for `dominant-baseline=middle` using
the same loaded font's bounding-box change under alphabetic alignment.
Chromium character positions alone do not include this shift. The initial
8.53px plain-label residual was a measurement error; the corrected pre-repair
maximum was 4.02px at 3x. With the runtime text-box fix it is 0.2973px,
passing the unchanged 0.35px gate. Raw crop sheets remain available beside
new sheets translated once to the shared axis origin, with no resizing.

## Visual Evidence

`command -v tikztosvg` resolves to `/Library/TeX/texbin/tikztosvg`.
The harness uses local pdflatex, then rsvg-convert for SVG-to-PNG conversion.
No online compiler, font replacement or package installation was used.

Artifacts under `outputs/qa/`:

- `2026-10-23-pgfplots-ticks-before/`: preserved pre-repair SVG/PNG controls.
- `2026-10-23-pgfplots-ticks-after/`: four fresh MacTeX PNGs, tikztosvg SVG/PNGs, JS SVG/PNGs, browser panels, diffs, sheets, measurements and native probe logs.
- `2026-10-23-pgfplots-ticks-cos-guard/`: fresh cos-fixpoint clipping, text and legend checks.
- `2026-10-23-pgfplots-ticks-activation-guard/`: outside-tick improvement and deliberately failing ordinary-text gate.
- `2026-10-23-pgfplots-ticks-label-guard/`: long-label canvas control; not full text parity.
- `2026-10-23-pgfplots-ticks-learn-guard/`: learning-curve boundary/crop control.
- `2026-10-23-pgfplots-plain-labels-after/`: fresh activation-functions native/browser panels, before/after glyph measurements, aligned sheets and final test summaries.
- `2026-10-23-pgfplots-plain-label-sizes/`: fresh 8pt and 12pt native/browser panels, grid/glyph gates and aligned sheets.
- `2026-10-23-pgfplots-plain-labels-learn-guard/`: learning-curve ordinary text follow-up; the decoration underline remains an open issue.

Each output has `mactex-png/`, `tikztosvg-svg/`, `tikztosvg-png/`,
`tikzkit-svg/`, `tikzkit-png/`; browser runs add `browser-audit.html`,
`browser-audit.json`, and `browser/` screenshots/sheets/diffs. These are local
generated artifacts, not promised GitHub-hosted files.

| Fixture | Visible before/after change | Browser result |
| --- | --- | --- |
| Compact middle axes | Empty axes regain eight tick strokes, eight grid lines and all numeric labels. | 22/22 glyphs; eight ticks/eight grids. |
| Explicit distance | Eighteen inconsistent grid lines become twelve correctly spaced lines; minor-grid color and thickness match the common style. | 8/8 glyphs; twelve ticks/twelve grids. |
| Rounded-step retry | The coarse first attempt no longer leaves only the suppressed origin: eight ticks and grids appear. | 14/14 glyphs; eight ticks/eight grids. |
| Default dimensions | The missing 0.5 and 1.5 y labels return; the frame expands to the native physical plot size instead of shrinking every coordinate. | 18/18 glyphs; eleven ticks/eleven grids. |
| Activation functions | Tick strokes move from centered to outside. Plain x/y labels regain native widths and height/depth anchoring; y no longer drifts against its axis tip. Curves and legend remain visible. | 121/121 glyphs, maximum 0.2973px; tick/grid 0.085px. Legend frame and 71 glyphs also pass. |
| Literal labels at 8pt/12pt | Ligatures and kerning use the correct CM design. Negative ticks no longer use a text-hyphen box; the 8pt y tick shift drops from 2.04px to under 0.064px. | 29/29 glyphs per case; maximum 0.064px / 0.076px. |
| Cos fixpoint | Enlarged cosine tails, diagonal ends, pi/fraction ticks, annotation and legend stay aligned. | All prior text, legend and clip checks pass. |
| Learning curve | Outside ticks no longer combine with the old estimated description gutter to enlarge the canvas. Literal axis text now uses CM boxes. | Existing strict canvas regression passes unchanged; not whole-case visual acceptance. |

The four planner fixtures pass both default JS and SVG-text browser checks,
with a 0.35px tolerance at 3x physical scale and maximum error below 0.12px.
There is one translation by the axes' crossing, no rescaling or independent
label correction. Before panels fail these same checks. Diagnostics, browser
errors and failed font loads are zero. Native PNGs, all browser panels and
diffs were actually inspected, not accepted from a mean pixel-difference score.

The tikztosvg SVGs use grouped straight M/L subpaths, approximately 0.3985bp
grid and 0.19925bp tick strokes, butt caps/miter joins, nonzero clipping, and
inverted coordinate transforms. Text uses font outlines in `defs` and
positioned `use` elements. JS uses separate paths and packaged native CM SVG
text. Browser comparisons apply both representations' actual transforms.
Raster antialiasing, arrow paint and some crop differences remain.
The learning-curve source still incorrectly retains a solid baseline under
`decoration={text along path,...}`. Its improved canvas and labels must not
be reported as complete visual parity.

## Commands and Parameters Checked

- `\usepackage{pgfplots}`, `\pgfplotsset{compat=1.18}`, `tikzpicture`, `axis`, `\addplot`: complete inputs run through the normal frontend/evaluator/renderer; general document typesetting is not added.
- `width`, `height`, `scale only axis`, and default dimensions: physical dimensions enter the planner, with 45pt reserved unless scale-only semantics apply.
- `xmin/xmax/ymin/ymax`, `enlargelimits=false`: compact and asymmetric ranges have native tick sequences. Existing enlarged-limit behavior is guarded by cos-fixpoint, not reimplemented here.
- `try min ticks`, `max space between ticks`: minimum count, unitless TeX-point input, and signed-truncation retry are covered by native probes and regression tests.
- `xtick/ytick`, tick aliases, `xtick distance/ytick distance`: explicit lists, a single zero, empty lists, and distances with no in-range candidate bypass automatic retry.
- `ticks=none` versus `xtick=\empty,ytick=\empty`: disable only paint versus remove candidates, respectively.
- `grid=major/both`, `minor tick num=1`, `grid style`, `minor grid style`: shared positions, common style inheritance and specific overrides are checked.
- `axis lines=middle`, separate `axis x/y line=middle`, `tick align=outside`, `hide obscured x/y ticks`: source order and origin suppression affect ticks and grids consistently.
- Math numeric tick labels, `$x$`, `$y$`, pi/fraction labels and the cosine annotation: the native-font path is preserved. Literal default-position CM labels and 8pt/10pt/12pt numeric tick boxes now pass browser checks. Arbitrary multiline, custom-font and explicitly positioned descriptions are not covered by this acceptance.
- 3D/log tick algorithms, complete number-format callbacks, custom major/minor tick programs, all style-order combinations, surface projection/paint and boxed-axis typography are not certified by this slice.

## Tests and Remaining Work

The 13 new planner regressions, seven text-box regressions and five browser-comparator regressions pass.
The planner tests failed on the old implementation before the fixes. Existing
tests now parse node options instead of requiring an arbitrary emitted-option
order. Native probes replace obsolete expected tick lists/default dimensions;
coordinates and paint counts remain checked. The activation IR count now
separately checks 42 paths, 21 text nodes and 16 bounds items: added invisible
text boxes are not misreported as extra visible objects.
Its former hand-fitted label-center assertions were replaced only after the
native point probe and the real-browser test demonstrated the runtime repair.

The selected PGFPlots suites now have **316 tests: 289 pass, 27 fail**,
down from 42 failures, with no new failure names in those suites. This is a
partial repair, not a green PGFPlots suite. The full-suite result is recorded
in `2026-10-23-pgfplots-plain-labels-after/test-summary.json`: **2,814 tests, 2,701 pass, 99 fail (including one
aggregate failure), 14 skip**. No failure name is new relative to the previous
full-suite baseline. Do not infer whole-project success from the new tests.

Remaining groups, retained as failures rather than silently rebaselined:

- Four docsrc color/serialization assertions require separate native color checks.
- 3D tick-distance labels, coordinate-surface topology, patch order and projected label normals.
- 3D colorbar and top-view bounds, plus histogram and x-square canvas differences.
- Boxed-axis tick placement/bounds and older axis-line/geometry expectations.
- Explicit description coordinates, boxed/plain-text width behavior and multiline footnotesize labels outside this native middle-axis slice.

Next priority: source-order axis-label styles and explicit description coordinates.
Then isolate 3D
labels/surface failures into their own native/browser-driven slices. There is
no claim that all 27 failures are stale assertions or that all diagrams match.

## Reproduction

```sh
node --test test/pgfplots-tick-planning.test.js test/browser-axis-grid-metrics.test.js
node --test test/pgfplots-plain-labels.test.js
node --test test/pgfplots-axis-text.test.js test/pgfplots-enlarged-clipping.test.js test/pgfplots-learn-curve.test.js
npm run test:summary
/Library/TeX/texbin/pdflatex -interaction=batchmode -halt-on-error -output-directory=outputs/qa/2026-10-23-pgfplots-ticks-after test/fixtures/pgfplots-tick-planning-metrics.tex
/Library/TeX/texbin/pdflatex -interaction=batchmode -halt-on-error -output-directory=outputs/qa/2026-10-23-pgfplots-ticks-after test/fixtures/pgfplots-plain-label-metrics.tex
node scripts/render-example-fixtures.js --fixtures test/fixtures/pgfplots-ticks --output outputs/qa/2026-10-23-pgfplots-ticks-after --native-reference --strict-tikztosvg --tikztosvg-engine pdflatex --math-renderer svg-text
node scripts/audit-module-regressions.js --fixtures test/fixtures/pgfplots-ticks --output outputs/qa/2026-10-23-pgfplots-ticks-after --before outputs/qa/2026-10-23-pgfplots-ticks-before --tick-grid-metrics --browser-module /path/to/playwright/index.mjs
node scripts/render-example-fixtures.js --fixtures test/fixtures/pgfplots-plain-labels --output outputs/qa/2026-10-23-pgfplots-plain-label-sizes --native-reference --strict-tikztosvg --tikztosvg-engine pdflatex --math-renderer svg-text
node scripts/audit-module-regressions.js --fixtures test/fixtures/pgfplots-plain-labels --output outputs/qa/2026-10-23-pgfplots-plain-label-sizes --tick-grid-metrics --browser-module /path/to/playwright/index.mjs
```

The browser harness converts source with the JS API and then mounts the
resulting SVG in real Chrome. It checks actual browser font/paint behavior;
it is not a new test of running the compiler inside the interactive editor.
