# PGFPlots Native Seam Failure Audit

## Scope

This bounded pass reproduced the six failures named in
`outputs/qa/2026-10-23-compact-math-after/test-summary-final.json`, reviewed
local MacTeX sources, and repaired one real rendering defect: duplicate
canvas gutters on explicit-size, tickless middle axes with an interior
crossing. It does **not** make the seam module green or certify whole-case
PGFPlots compatibility.

The existing dirty worktree was preserved. No changes were made to
`ticks.js` (reserved to the parent), the existing seam tests, frontend,
evaluator, extension tests, registry, or shared compatibility metadata.
No full suite, global gallery audit, metadata regeneration, commit or push
was performed.

## Six Failures

All six reproduced before changes with this focused command:

```sh
node --test --test-reporter=spec \
  --test-name-pattern='calibrated semantic canvas|axis line lowering emits bounds|middle y axis label sits|enlarged middle-axis labels|multiline footnotesize ticks preserve|geometry treats split axis' \
  test/pgfplots-seams.test.js
```

| Existing test line | Native evidence and classification |
| --- | --- |
| 1318: x-square calibrated canvas | **Obsolete fitted canvas assertion, separate tick defect remains.** The reference SVG is 198.653bp by 170.529bp including the source's 2pt border on each side. Removing that border gives 194.668bp by 166.544bp, versus JS `margin:0` 194.66bp by 166.52bp. The old 196.95/168.8 expectation is not the native crop. Native still has minor ticks at x=-1.75 and x=1.75 that JS omits. |
| 3046: bounds command string | **Obsolete synthetic-gutter snapshot.** Actual 2cm boxed axes have native bbox corners (-27.42155,-14.14372) and (62.73605,63.45827) TeX pt. Browser JS is 89.82bp by 77.31bp versus native 89.821bp by 77.312bp. `renderAxisBounds(createAxisGeometry(...))` alone is not the final public render's node-driven bounds. Neither restoring the old constants nor copying the new primitive string is an appropriate native regression. |
| 3892: middle ylabel command | **Obsolete command/options and fitted endpoint assertion.** Native legacy middle descriptions use `current axis.above origin`, anchor north west. Native ylabel center is (34.02554,155.36385) TeX pt; JS is (34.01906,155.35199). The old y=5.764cm node location includes a nonnative offset. The new layout-bbox option is also intentionally absent from the old string. |
| 3910: enlarged middle labels | **Mixed.** The first failing string is obsolete: crossing-axis native centers match current endpoint placement within 0.06 TeX pt. However the later positive-only subcase has a real origin-clamping defect, previously hidden by the first failed assertion. Native enlarged limits 0.9..2.1 and 2.9..4.1 place the axis origin at the lower-left frame, not at the original data minimum (1,3). Lines, descriptions and ticks must change together; left unchanged here because ticks.js is parent-owned. |
| 4404: multiline footnotesize tick | **Obsolete two-line premise, real padding/text-paint remainder.** Without `align` or `text width`, native renders `2012\\2956` as one hbox containing `20122956`. Its center is (0,-6.11075) TeX pt, matching JS. The old test's >22pt-tall box is not native. But JS still adds 2.36pt horizontal and 3pt bottom crop padding, and raw-label width fitting prevents native text painting. Explicit `align=center` is genuinely two lines and still has different spacing/padding. |
| 5203: split middle geometry margin | **Obsolete margin constants plus confirmed public-render defect.** Both the expected .06/.12cm gutters and current .04/.08cm gutters exceed native paint bounds. Native tickless bbox is frame plus .2pt per side. This pass removes the extra public-render gutter for native interior tickless axes while leaving fallback geometry constants alone. |

All six existing tests remain untouched and still fail at the same
assertions. New semantic/native-measurement tests carry the evidence;
the parent can decide how to retire the obsolete assertions without losing
the genuine positive-range and text/tick regressions.

## Source Review

Paths are under `/usr/local/texlive/2025/texmf-dist/`:

- `tex/generic/pgfplots/pgfplots.scaling.code.tex:147-174`: width and height each subtract 45pt unless `scale only axis`; this is the plot-box allocation, not an extra picture gutter.
- `tex/generic/pgfplots/pgfplots.code.tex:2776-2821`: legacy middle x/y descriptions use `current axis.right of origin` / `above origin` and south-east / north-west anchors.
- Same file, `2885-2947`: modern middle descriptions use ticklabel coordinates and native near-ticklabel anchors.
- Same file, `888-908`, `1497-1510`, `7031-7044`: description styles, tick storage, and default/empty tick initialization. `xtick={}` requests automatic ticks; `xtick=\empty` suppresses them. They are not interchangeable.
- `tex/generic/pgfplots/pgfplotscoordprocessing.code.tex:8458-8540`: `prepare@ZERO@coordinates` clamps zero between the final min/max before mapping the axis origin. This is the positive-only subcase's shared root cause.
- `tex/generic/pgfplots/pgfplotsticks.code.tex:460-496`: ticklabel extent comes from the actual node's far bounding-box corner projected along the outward normal.
- Same file, `840-886`: obscured tick suppression compares against the prepared logical zero coordinate, not an independently clamped unexpanded data range.
- `tex/generic/pgf/basiclayer/pgfcorepathusage.code.tex:113-129`: a stroked path adds half its line width to the picture bounds.
- `tex/generic/pgf/frontendlayer/tikz/tikz.code.tex:1173-1184`, `3871-3891`, `4211-4265`: default node text is an hbox; explicit alignment enables the multiline halign path.

The native probe is
[`metrics.tex`](../../test/fixtures/pgfplots-native-seams/metrics.tex).
Its complete TeX-point output is in the after-run `metrics.log`.

## Repair

`src/pgfplots/axisTikzLowering.js` now uses the true plot rectangle as the
base bounds for a native-text axis with no tick descriptions and ranges
straddling zero in both dimensions. The painted strokes/arrows and any
real description nodes contribute their own extents. This avoids counting
the arrow/stroke allowance twice.

The native-text predicate excludes datavisualization and unsupported
text paths. Boundary-middle, scaled-picture and tick-bearing interior
fallback allowances are not expanded by this change. Plot sizing and
the 45pt reserve are unchanged.

Regression first: the added tickless test failed with a 413.645375 TeX-pt
canvas width against native 410.64170. After the repair, both sync and async
renders match within the fixed 0.06 TeX-pt tolerance. Both `ticks=none` and
`xtick=\empty,ytick=\empty` are checked against independently compiled
native probes.

## Browser Evidence

Artifact roots:

- `outputs/qa/2026-10-23-pgfplots-native-seams-before/`
- `outputs/qa/2026-10-23-pgfplots-native-seams-after/`

Before contains eight controls; after adds the equivalent empty-macro
tickless control. Both roots contain native MacTeX PNGs, tikztosvg SVG/PNGs,
JS SVG/PNGs, and actual Chrome default/export/reference screenshots and
diff sheets. The browser audit includes a before-export panel after the
repair. Comparisons use fixed physical scale; aligned sheets translate
once to the axis origin without fitting or rescaling individual objects.

The installed `/Library/TeX/texbin/tikztosvg` exposes `--pdflatex`, not the
`-e pdflatex` syntax. The render harness uses that documented equivalent.
Native MacTeX was also compiled independently with pdflatex. All 9 after
references rendered; all 9 JS sources had zero diagnostics, and Chrome
reported zero page errors and no failed fonts. Chrome required the approved
unsandboxed local launch because the sandboxed launch aborted.

| Control | Browser result at 3x physical scale |
| --- | --- |
| Tickless / empty-macro tickless | Dedicated canvas and painted-bounds gate passes for default and export, maximum error 0.07313px against unchanged 0.35px tolerance. Canvas shrinks from 412.10 x 184.20bp to 409.10 x 182.33bp; native is 409.108 x 182.336bp. |
| 2cm box | 20/20 tick segments; 22/22 glyph origins, maximum glyph error 0.0082px; frame error 0.0028px; canvas-edge error 0.0051px. |
| Legacy middle | 11/11 ticks and 18/18 glyph origins; maximum glyph error 0.1845px. |
| Enlarged crossing middle | 5/5 ticks and 7/7 glyph origins; maximum glyph error 0.2348px. |
| Original circle | 27/27 glyphs, maximum error 0.2306px; 10/10 major grids, maximum error 0.1556px. Raw native tick count 70 includes exact duplicate paints; 35 unique segments remain versus JS 31. Missing segments are x minor ticks at -1.75, 0, 1.75 and y minor tick at 0; the zero segments are overlapped by the axes. |
| Positive-only enlarged | Still visibly wrong: JS axis origin is inset and initial x=1/y=3 labels are missing. Native xlabel center y=5.68575pt vs JS 19.17239pt; ylabel center x=6.16377pt vs JS 22.41033pt. 10 vs 12 ticks and 28 vs 30 glyphs. |
| Unaligned footnotesize | Single-line semantics match, but 3.4039px glyph-origin error and 11.9466px canvas-edge error remain. |
| Aligned footnotesize | Correct two-line content, but 2.6067px glyph-origin error and 6.0637px canvas-edge error remain. |

The general `--tick-grid-metrics` audit exits 1, intentionally retained in
the evidence. It requires nonempty tick/grid/glyph sets, so no-grid and
tickless controls cannot pass that generic combined gate. It also catches
the genuine circle/positive/text residuals. No thresholds or generic audit
code were relaxed. A separate purpose-specific browser check validates the
tickless viewport and painted axis bounds, including nonblank paint.

Viewed: the before circle, positive-only and unaligned sheets; the after
tickless, box, middle, enlarged and aligned default/native/export/diff
sheets; and the separate MacTeX tickless and circle PNGs. The small tickless
crop improvement is visible; residual diffs include subpixel stroke and
arrow-outline rasterization. There is no whole-case visual-pass claim.

## Parent Handoff

`ticks.js` was not edited. Suggested narrow follow-up for the unaligned
padding, **not applied or claimed verified here**:

```diff
-function multilineTickLabelLayoutOptions(label, fontCommand = "", labelStyle = {}, innerSep = undefined) {
+function multilineTickLabelLayoutOptions(label, fontCommand = "", labelStyle = {}, innerSep = undefined, nativeText = false) {
+  if (nativeText && !labelStyle.align && !labelStyle["text width"]) {
+    return { options: [], nativeNodeBox: false };
+  }
```

Pass `pgfplotsUsesNative2DText(axisOptions)` as the fifth argument at its
three x-tick call sites. This removes the obsolete 2.36pt/3pt unaligned
padding while preserving the nonnative and explicitly aligned paths.
It is only the crop part of the repair: `pgfplotsTickLabelTextWidthScale`
currently sees the raw backslashes, fails `layoutNativeText`, and emits
the 1.0001 fit. It needs the same normalized single-line text as the node
layout, without flattening aligned/paragraph or mathematical content.
The supplied unaligned/aligned fixtures distinguish those behaviors.

For positive-only ranges, coordinate a shared origin computation across
`axisLines.js`, `labels.js` and `ticks.js`: clamp zero to each **final**
transformed linear range, then map that coordinate. Use the same crossing
for `shouldHideObscuredAxisTick`. Native suppression must not hide x=1 or
y=3 when the expanded crossing is x=0.9/y=2.9. Keep datavis handling
separate. Changing only lines/labels would leave visibly detached ticks,
so none of that incomplete three-file repair was applied here.

For the circle, inspect minor-tick planning against enlarged transform
limits. The visible endpoint minors must extend to x=+/-1.75, rather than
being filtered to the surveyed +/-1.5. Duplicate native paint explains part
of the raw segment-count mismatch, but not those missing visible ticks.

## Verification

```sh
node --test --test-reporter=./scripts/module-test-reporter.js \
  --test-reporter-destination=outputs/qa/2026-10-23-pgfplots-native-seams-after/focused-tests.json \
  test/pgfplots-native-seams.test.js test/pgfplots-label-box.test.js \
  test/pgfplots-middle-axis-labels.test.js test/pgfplots-tick-planning.test.js \
  test/pgfplots-axis-text.test.js test/pgfplots-enlarged-clipping.test.js

node --test --test-reporter=./scripts/module-test-reporter.js \
  --test-reporter-destination=outputs/qa/2026-10-23-pgfplots-native-seams-after/seams-tests.json \
  test/pgfplots-seams.test.js
```

Results: **35/35 focused tests pass** (five new native tests), and the
existing seam module is **221 pass / 6 fail / 227 total**, with exactly the
original six failure names. No existing assertions were edited.

External/browser reproduction (select the nine `native-seams-*` manifest
IDs when rendering so the standalone metrics probe is not auto-discovered
as an ordinary visual fixture):

```sh
node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/pgfplots-native-seams \
  --output outputs/qa/2026-10-23-pgfplots-native-seams-after \
  --only native-seams-circle --only native-seams-box --only native-seams-middle \
  --only native-seams-enlarged --only native-seams-positive \
  --only native-seams-tickless --only native-seams-tickless-empty \
  --only native-seams-unaligned --only native-seams-aligned \
  --preserve-output --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text

/Library/TeX/texbin/pdflatex -halt-on-error -interaction=nonstopmode \
  -output-directory=outputs/qa/2026-10-23-pgfplots-native-seams-after \
  test/fixtures/pgfplots-native-seams/metrics.tex

node scripts/audit-module-regressions.js \
  --fixtures test/fixtures/pgfplots-native-seams \
  --output outputs/qa/2026-10-23-pgfplots-native-seams-after \
  --before outputs/qa/2026-10-23-pgfplots-native-seams-before \
  --tick-grid-metrics --browser-module "$PLAYWRIGHT_MODULE"

node test/fixtures/pgfplots-native-seams/browser-bounds.mjs \
  outputs/qa/2026-10-23-pgfplots-native-seams-after "$PLAYWRIGHT_MODULE"
```

`PLAYWRIGHT_MODULE` used here is
`/Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`.

## Changed Paths

- `src/pgfplots/axisTikzLowering.js`: only the interior tickless bounds condition and its comment were changed in this pass; all other dirty edits predate it.
- `test/pgfplots-native-seams.test.js`
- `test/fixtures/pgfplots-native-seams/manifest.json`
- `test/fixtures/pgfplots-native-seams/metrics.tex`
- `test/fixtures/pgfplots-native-seams/box.tex`
- `test/fixtures/pgfplots-native-seams/middle.tex`
- `test/fixtures/pgfplots-native-seams/enlarged.tex`
- `test/fixtures/pgfplots-native-seams/positive.tex`
- `test/fixtures/pgfplots-native-seams/tickless.tex`
- `test/fixtures/pgfplots-native-seams/tickless-empty.tex`
- `test/fixtures/pgfplots-native-seams/unaligned.tex`
- `test/fixtures/pgfplots-native-seams/aligned.tex`
- `test/fixtures/pgfplots-native-seams/browser-bounds.mjs`
- `docs/qa/2026-10-23-pgfplots-native-seams.md`

Generated evidence is confined to the two dedicated output roots above.
