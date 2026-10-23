# Histogram Canvas Bounds: Native and Browser Audit

## Final Artifact Status

Runtime, tests and registry are frozen. The existing after root has now
been regenerated against the parent's current runtime, including native,
tikztosvg, JS, actual Chrome and diff artifacts. Final verification at
`2026-10-23T12:01:38.267Z` found no currentness blockers: **1/1 generated,
0 stale, 0 diagnostics, browser errors []**. The refreshed sheets were
inspected. `outputs/qa/2026-10-23-histogram-bounds-after/final-gates.json`
records the current environment, render fingerprint and exact gates;
`case-currentness.json` also confirms byte-identical current/default SVG.

The focused y-tick, xlabel and ylabel glyph gates pass (12/12, 26/26 and
15/15 glyphs, each below 0.09px), as do all six ink checks (top error <=1px,
centroid error <0.6px). **Whole-case acceptance remains false:** 1 compared,
1 different; near-coordinate annotation error reaches 1.25529px and the
top canvas error is -1.24660px at 3x. The generic browser audit's exit 0 is
not a whole-case visual gate. All 665 files across the hat and two histogram
before roots were verified unchanged; before and first-pass sections below
are historical evidence, not the current after state.

## Tick-Policy Test Follow-Up

The parent identified three old test assumptions after the native literal
tick-text change. All three were reproduced, independently checked against
MacTeX, and updated semantically without further runtime changes:

- `test/pgfplots-csv-overlay.test.js`: KIT's rotated 1988 now checks four
  native CMR7 numeric glyphs, the 60-degree rotation, 15.94452pt measured
  width, 4.51111pt baseline height and unscaled digit advances, instead of
  requiring the old 1.135 width compensation.
- `test/pgfplots-dateplot.test.js`: checks both 1946 election ticks, from
  the CSV's June 30 and December 1 dates. Each must be one complete native
  text group with digits 1/9/4/6 in order, a shared alphabetic baseline,
  10pt optical font and the existing 45-degree rotation. It no longer
  assumes all four digits serialize inside one SVG text element. Existing
  percent, range and scientific-notation assertions remain unchanged.
- `test/pgfplots-seams.test.js`: the compact A tick still checks its north
  anchor, normalsize and absence of injected inner separation. Its actual
  painted payload must be upright native CMR10 with a 7.50002pt width and
  6.83331pt baseline height, not a legacy 1.0001 width flag.

New independent probe:
`test/fixtures/pgfplots-native-tick-policy-metrics.tex`. The pdfTeX shipped
box trace confirms that scriptsize pgfmathprintnumber uses OT1 CMR7 even
when the document has T1 fontenc. The date library's inverse transformation
defines the literal year (`tikzlibrarypgfplots.dateplot.code.tex:211-220`);
the two-date probe prints `date year=1946` twice. The explicit-list source
still passes labels verbatim (`pgfplotsticks.code.tex:601-608`).

The Bavaria document's actual T1 date box is 19.99512pt wide and 6.41510pt
high. The currently supported OT1 CMR10 box is 20.00006pt by 6.44444pt.
This 0.00494pt width / 0.02934pt height encoding difference remains a font
coverage limitation, not proof of exact T1 visual parity. No font/render
or tick runtime was changed in this follow-up.

Artifacts: `outputs/qa/2026-10-23-histogram-bounds-tick-policy/` contains
the native TeX log/PDF and `focused-tests.tap`: **3/3 pass**. A full run of
the three touched test files recorded **258/265 pass**, with seven other
failures in axis-line/default-geometry, middle labels, the x-square fixture
and multiline tick extents. Those are retained in `targeted-suites.tap` and
left to the parent's existing broader validation, not silently relaxed.

The three-file 258/265 run above is a historical targeted-suite snapshot.
The parent reports the final full suite as 2910 tests, 2846 passed,
50 failed and 14 skipped, with no new failures and five old failures
resolved. No further test or runtime changes were made for the artifact
refresh. Current browser status is recorded at the top of this report;
the remaining whole-case visual differences are not certified away.

## Tick-Text Follow-Up: Current Status

**The explicit numeric y-tick baseline/ink and directly related xlabel/bottom
bound are improved and pass the focused native/Chrome checks. The histogram
as a whole remains visually unaccepted.** Rotated near-coordinate placement
and the resulting top extent still differ. No renderer or core text/font
changes were needed.

The original before root is unchanged. The previous after root was copied
to `outputs/qa/2026-10-23-histogram-bounds-tick-text-before` before this
follow-up, preserving its native/browser evidence. Current outputs replace
the managed exports in `outputs/qa/2026-10-23-histogram-bounds-after`.

### Changes and Failing Evidence

- `src/pgfplots/ticks.js`: supported native literal tick text now uses width
  scale 1. The old explicit 1.0001 scale disabled the existing native CM
  painter and selected SVG `dominant-baseline=middle`, although node anchors
  were measured using TeX boxes. Supported literals now paint using the same
  native box and alphabetic baseline; unsupported faces/text keep the old
  fallback. Explicit numeric strings remain literal, including leading zeros.
- `src/pgfplots/axisTikzLowering.js`: the already-scoped interval description
  measurement now handles both axes. X extent uses the maximum measured
  height plus depth of the actual plain/math tick labels, inner separation,
  the near anchor's 0.2pt outer sep, and tick projection. This also handles
  zero inner sep without the generic fallback's truthiness substitution.
  Explicit description placement and offsets remain untouched.
- `test/pgfplots-histogram-bounds.test.js`: native tick painting, 8/9/10pt
  optical sizes, xlabel/bottom bounds with 0/1/2pt inner sep, x/y explicit
  placement, literal leading zeros and unsupported-font fallback checks.
- `test/fixtures/pgfplots-histogram-bounds-metrics.tex`: additionally logs
  the explicit y-tick text anchor, not only its center.
- `test/fixtures/pgfplots-histogram-browser-probe.mjs`: new single-case Chrome
  probe with translated screenshots, glyph-origin and actual ink checks.
- This QA report.

Two semantic regressions were added and observed failing before runtime
edits: the explicit tick payload used the legacy middle baseline instead of
the native text box; xlabel center was -20.93030 instead of -21.13400 TeX pt.
The failing run is preserved in the incremental before root as
`semantic-failures.tap`. No existing assertion was relaxed.

The parent's `minimumLinearTickCount` top-view rule is unchanged: 3D uses
three ticks. Quiver, colors, renderers, axis3d, registry and unrelated dirty
edits were not touched. No commit was made.

### Independent Native Measurements

Local `pgfplotsticks.code.tex:601-608` selects the supplied tick-list entry
and emits it verbatim. Thus explicit `100` is literal CMR text, not a number
to reformat or silently turn into a math expression. The native 9pt probe
gives tick-100 center `(-12.40512,72.47620)` and text anchor
`(-19.34258,69.57620)` TeX pt. Their 2.9pt vertical difference is half the
5.8pt glyph box. JS now uses the same optical CMR9 box; its center is
`(-12.40537,72.46917)` TeX pt. Repeated 8pt/10pt native probes and semantic
tests independently cover their optical glyph heights.

For xlabel, `pgfplotsticks.code.tex:460-496` measures the actual outward
tick path extent. The old estimated height omitted the near anchor's 0.2pt
outer separation. The native xlabel center is -21.13400 TeX pt; JS is now
-21.12947 instead of -20.93030. The measured 8pt/2pt and 10pt/0pt variants
also pass the unchanged 0.035pt tolerance.

### Current Chrome Evidence

Chrome 155.0.8059.86; zero browser errors and failed font loads. The existing
`scripts/audit-module-regressions.js` was run again with the incremental
before root. A separate, reproducible histogram probe checks actual paint
at 3x physical scale, translating once to the bar lower-left at `(190,430)`.
It does not fit or resize labels. The native PNG, JS grid, raw browser sheet
and new translated native/before/after/diff sheet were inspected.

| At 3x Chrome scale | Incremental before | Current after |
| --- | ---: | ---: |
| Y-tick glyphs with comparable native alphabetic origins | No: six legacy text runs | 12/12 glyphs |
| Y-tick maximum x / y origin error | Not comparable baseline conventions | 0.00570 / 0.04675px |
| Y-tick dark-pixel top displacement | -4px on all six ticks | 0px on five, +1px on one |
| Y-tick ink centroid displacement | -4.508 to -3.502px | -0.162 to +0.547px |
| Xlabel maximum x / y origin error, 26 glyphs | 0.02555 / 0.82199px | 0.02960 / 0.02776px |
| Bottom canvas edge error | -0.82221px | -0.02785px |
| Ylabel maximum origin error, 15 glyphs | 0.04759px | 0.04592px |
| X-tick maximum origin error, 20 glyphs | 0.05498px | 0.05690px |

The visible four-pixel y-tick displacement and heavier legacy paint are no
longer present. Native outlines and browser font rasterization are not
pixel-identical; the remaining tick ink-edge variation is 0-1 screenshot
pixel, not the former baseline shift. The focused glyph gate is <0.09px;
the ink gate is <=1px at the top and <0.6px centroid displacement. These
checks pass without changing thresholds after measurement.

Current paths under the after root:

- `browser/histogram-tick-text-sheet.png`: native, incremental before,
  current after, and difference panels, in reading order.
- `histogram-tick-text-browser-metrics.json`: all glyph and ink measurements.
- `browser-audit.html` and `browser-audit.json`: existing audit outputs.
- `case-currentness.json`: current SVG exactly matches the audited default
  SVG, SHA-256 `d432eebe19ecde2681aa8423ecef5cb2fd625a22ff7b0f97e627b25b49c7a86c`.
- `focused-tests.tap`: **56/56 pass**, covering histogram bounds/histogram,
  label boxes, plain labels, tick planning, axis text and extra ticks.
- `diff/summary.json`: 1 compared, 1 different, 0 stale, `accepted:false`;
  exported-SVG raw mean absolute RGBA difference is 0.00909113 and changed
  ratio 0.0747489. These raw crop metrics are not a visual acceptance claim.

### Current Residuals

Rotated near-coordinate numbers still have up to 1.246px horizontal and
1.255px vertical error at 3x. Top canvas error remains -1.247px. The width
stays 338.76 SVG pt versus native 338.748523pt. Height is now 133.31pt versus
native 133.002959pt: correcting the bottom no longer partially cancels the
unrelated top error. It would be incorrect to move xlabel back just to make
total height look closer. The previous uncropped outer-east/terminal-label
limitation also remains. These prevent whole-case certification.

No global suite or gallery-wide run was performed by this follow-up; the
parent is validating its other changes. The small origin and ink checks
certify only the explicitly measured tick/axis-description slice, not the
remaining annotation geometry or arbitrary custom tick layouts.

```sh
node --test test/pgfplots-histogram-bounds.test.js \
  test/pgfplots-histogram.test.js test/pgfplots-label-box.test.js \
  test/pgfplots-plain-labels.test.js test/pgfplots-tick-planning.test.js \
  test/pgfplots-axis-text.test.js test/pgfplots-extra-ticks.test.js

node test/fixtures/pgfplots-histogram-browser-probe.mjs \
  outputs/qa/2026-10-23-histogram-bounds-after \
  outputs/qa/2026-10-23-histogram-bounds-tick-text-before \
  /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
```

Native/render/audit commands are retained below. For the current audit use
the incremental `histogram-bounds-tick-text-before` root as `--before`.
The older `histogram-aligned-*` files and `histogram-browser-metrics.json`
describe the first pass, not the new tick-text result.

## First-Pass Record (Historical)

The record below describes the original canvas/layer pass. Its after state
is preserved in `histogram-bounds-tick-text-before`; current after state and
remaining risks are described above.

### Scope and Status

Case: `latex-examples-histogram-large-1d-dataset`, using the unchanged
`test/fixtures/examples/latex-examples/histogram-large-1d-dataset.tex`.

**Improved, not whole-case visually accepted.** The existing canvas-width
failure is resolved without changing its assertion. Native measurement gives
338.748523 CSS/SVG pt, independently of the old test message's approximate
338.98pt. JS changes from 342.63pt to 338.76pt. Visible tick and annotation
placement differences remain, and the fresh image comparison is not accepted.

Only the following source-controlled files belong to this subtask:

- `src/pgfplots/axisTikzLowering.js`: interval description measurement, native outer southwest anchor, interval marker pass.
- `test/pgfplots-histogram-bounds.test.js`: new focused native-derived regressions.
- `test/fixtures/pgfplots-histogram-bounds-metrics.tex`: new non-invasive MacTeX anchor probe.
- `docs/qa/2026-10-23-histogram-bounds.md`: this report.

The lowering file already had substantial unrelated edits. Its quiver,
metadata, 3D and pre-existing native-text logic were preserved. No core font,
text, renderer, registry or global-suite files were edited. The original
histogram test and real fixture remain unchanged. No commit was made.

### Source and Native Evidence

The source uses `amsmath`, `pgfplots`, `compat=1.3`, `ybar interval`,
`axis on top`, outside invisible ticks, explicit tick labels,
`ticklabel style={font=\small,inner sep=1pt}`, large axis descriptions,
45-degree footnotesize `nodes near coords`, white foreground grids, and a
`clipright` macro. That macro resets the picture box from
`current axis.outer south west` to the axis east plus `.5ex`.

Local source root: `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/`.
No web compiler, downloaded fonts, or reference fitted to JS was used.

| Native source | Relevant rule |
| --- | --- |
| `pgfplots.code.tex:7530-7561` | Outer anchors describe the complete measured axis box. Outer southwest has no fixed 1.7pt inset. |
| `pgfplotsticks.code.tex:460-496` | `ticklabel cs` selects the outward corner of the actual tick-node path box and projects its distance from the tick position. |
| `pgfplots.code.tex:9643-9651` | An `axis on top` axis is drawn before the after-axis marker pass. |
| `pgfplots.markers.code.tex:49-67` | Global unclipped markers use the end-axis pass; explicitly clipped markers and individual clipping retain inline passes. |

The probe names axis descriptions and ticks, measures anchors before and
after the existing crop, and inputs the original source. Values below are
TeX pt, with 72.27pt/in, not CSS/SVG pt at 72pt/in.

| Quantity | Native | JS before | JS after |
| --- | ---: | ---: | ---: |
| Y description center x | -29.20892 | -34.78679 | -29.21005 |
| Y description center y | 48.63179 | 48.62576 | 48.62576 |
| Outer southwest x | -37.87521 | -41.75312 | -37.87638 |
| Cropped east x | 302.14362 | 302.15863 | 302.15863 |
| X description center y | -21.13400 | -20.93030 | -20.93030 |
| Outer north y | 103.70142 | 104.01606 | 104.01606 |
| Cropped southwest y | -29.80030 | -29.59663 | -29.59663 |

Native cropped width is `302.14362 - (-37.87521) = 340.01883` TeX pt,
or `338.748523` CSS/SVG pt. The independently exported tikztosvg SVG says
`338.749pt`. Native height is `133.50172` TeX pt / `133.002959` CSS/SVG pt;
JS remains `133.11pt` high.

Two same-source variants independently check that spacing follows the
font and separation, rather than a fitted constant:

| Tick style | Native ylabel x / outer west | JS ylabel x / outer west |
| --- | --- | --- |
| 8pt, inner sep 2pt | -30.08420 / -38.75049 | -30.09209 / -38.75841 |
| 10pt, inner sep 0pt | -28.33405 / -37.00034 | -28.32801 / -36.99434 |

Logs are in the after artifact root: `pgfplots-histogram-bounds-metrics.log`,
`histogram-ticks-8pt.log` and `histogram-ticks-10pt.log`.

### Causes and Changes

1. The existing generic description extent missed the `ticklabel style`
   alias and estimated default 10pt ticks/default inner separation, although
   the actual ticks used 9pt text and 1pt separation. The new interval-only
   path uses the existing resolved tick style/font helpers and native CM
   boxes. Its outward extent includes measured text width, twice inner sep,
   the near anchor's default 0.2pt outer sep, and outside/center tick projection.
   The 0.2pt is half the native default 0.4pt node line width, not an image fit.
2. The fixed `PGFPLOTS_OUTER_BBOX_X_COMPENSATION` partly concealed the wrong
   description distance and inset the measured box. Native 2D text now uses
   the actual outer southwest box anchor with no compensation. The legacy
   non-native fallback retains its existing allowance.
3. Interval `nodes near coords` were painted before the white foreground
   grids. The audited global/unclipped configuration now emits those nodes
   after the axis, so grid strokes no longer erase parts of the numbers.

The description helper deliberately leaves explicit `at`, middle axes,
upper/right ticks, extra ticks, and complex rotated/anchored/shifted or
paragraph tick styles on the existing path. This is not certification of
arbitrary PGFPlots tick layouts. The marker change excludes explicit layer
sets, clipped markers and individual clip mode, with regression checks for
the latter two. Custom layer semantics remain unaudited.

### Browser and Visible Comparison

Artifact roots:

- `outputs/qa/2026-10-23-histogram-bounds-before`
- `outputs/qa/2026-10-23-histogram-bounds-after`

Both contain MacTeX PNGs/logs, tikztosvg SVG/PNGs, JS SVG/PNGs, comparison
grids and browser artifacts. The after root adds native probe logs/PDFs,
`focused-tests.tap`, `histogram-browser-metrics.json`, `case-currentness.json`,
`browser-audit.html`, `browser-audit.json`, and `diff/summary.json`.

Chrome 155.0.8059.86 painted default JS, exported JS and the native
tikztosvg SVG through the existing `scripts/audit-module-regressions.js`.
There were zero browser errors and zero failed font loads. The script's
specialized glyph/axis acceptance gates are empty for this case, so a
successful audit run means rendering succeeded, not visual acceptance.
This does not exercise the interactive editor's event handlers.

The native PNG, native/JS comparison grids, raw Chrome sheet and translated
Chrome sheet were actually viewed. `browser/histogram-aligned-sheet.png`
has native, before, after and difference panels, in that order. Every panel
uses 3x CSS physical scale and one translation placing the lower-left bar
corner at `(190,430)` in a 1450x575 viewport; no label or plot fitting occurs.
The raw crop sheets remain available separately.

| Measurement at 3x scale | Before | After |
| --- | ---: | ---: |
| Left canvas edge error | -15.472px | -0.014px |
| Maximum horizontal ylabel glyph-origin error, 15 glyphs | 22.2207px | 0.00093px |
| Maximum vertical ylabel glyph-origin error | 0.048px | 0.048px |
| Bar span width error | -0.005px | -0.005px |
| Raw Chrome mean absolute RGBA difference | 0.0311012 | 0.0113352 |

The obvious left gutter/title displacement is gone. White grid strokes no
longer cut through near-coordinate numbers, notably 66, 30, 9 and 10. The
bar geometry stays unchanged. Pixel-difference averages alone are not used
as an acceptance criterion.

The final render and Chrome audit were repeated after the parent renderer
changes. `case-currentness.json` records that current JS equals the audited
default SVG (SHA-256
`23fe911cf5b352a3a398fa19bf66658de12a89755353f85e4b590f178fc2665f`).
The final `histogram-aligned-after-current.png` is exactly pixel-identical
to the measured `histogram-aligned-after.png`, so those measurements remain
applicable. The after diff is fresh: 1 compared, 1 different, 0 stale,
`accepted:false`. Its raw exported-SVG changed-pixel ratio is 0.0732574 and
mean absolute RGBA difference is 0.00889831. Native-PNG comparisons also
report a dimension mismatch; even native-PNG versus native-SVG PNG differs
in crop/raster dimensions, so those raw PNG numbers are not attributed
entirely to JS geometry. The same-scale browser evidence exposes the real
remaining text differences independently. No real-gallery diff report was
present for this case.

### Remaining Risks

- Explicit y-tick ink remains approximately 4px too high at 3x scale,
  with darker/different raster outlines. Fixed per-tick dark-pixel regions
  give centroid offsets from -3.50px to -4.48px. Raw SVG text origins use
  different baseline conventions, so their 11.58px delta is NOT a valid
  painted-baseline error. The existing plain-text tick path was not edited.
- The xlabel is about 0.822px too high at 3x scale. Rotated near-coordinate
  glyphs remain up/left by up to 1.255px/1.251px. The layer correction does
  not correct their anchor/placement behavior.
- Canvas top and bottom edges remain displaced by -1.244px and -0.822px
  at 3x scale, consistent with the residual text extents. Native height is
  133.003 SVG pt, versus 133.11pt JS.
- Before the explicit crop, native outer east is 310.665 TeX pt versus JS
  305.63083pt. The existing interval-label path omits the terminal 70
  annotation, which lies outside this case's retained crop. Therefore this
  work does not certify uncropped outer-east bounds or all interval labels.
- The removal of the legacy southwest compensation applies to the existing
  native-2D-text predicate, not just this histogram. Related label/tick
  suites pass, but all arbitrary callers of that anchor were not visually
  audited. The non-native fallback remains unchanged and unverified here.

These are genuine residuals, not accepted raster noise. They are outside
this subtask's final requested scope; no whole-case compatibility claim is
made.

### Tests and Reproduction

The original histogram suite initially had 9 passes and the width failure.
New description/box tests failed before their runtime changes, and the
marker-order test failed before the after-axis pass. The final focused run
has **39 passes, zero failures**. Existing assertions were not relaxed.
Full-suite and gallery-wide runs were left to the parent task; this subtask
does not claim their results.

Run from the repository root:

```sh
node --test test/pgfplots-histogram-bounds.test.js \
  test/pgfplots-histogram.test.js test/pgfplots-label-box.test.js \
  test/pgfplots-plain-labels.test.js test/pgfplots-tick-planning.test.js

pdflatex -interaction=batchmode -halt-on-error \
  -output-directory outputs/qa/2026-10-23-histogram-bounds-after \
  test/fixtures/pgfplots-histogram-bounds-metrics.tex

pdflatex -interaction=batchmode -halt-on-error -jobname=histogram-ticks-8pt \
  -output-directory outputs/qa/2026-10-23-histogram-bounds-after \
  '\def\histogramtickoverride{\pgfplotsset{ticklabel style={font=\footnotesize,inner sep=2pt}}}\input{test/fixtures/pgfplots-histogram-bounds-metrics.tex}'

pdflatex -interaction=batchmode -halt-on-error -jobname=histogram-ticks-10pt \
  -output-directory outputs/qa/2026-10-23-histogram-bounds-after \
  '\def\histogramtickoverride{\pgfplotsset{ticklabel style={font=\normalsize,inner sep=0pt}}}\input{test/fixtures/pgfplots-histogram-bounds-metrics.tex}'

node scripts/render-example-fixtures.js --fixtures test/fixtures/examples \
  --only latex-examples-histogram-large-1d-dataset \
  --output outputs/qa/2026-10-23-histogram-bounds-after \
  --native-reference --tikztosvg-engine pdflatex --comparison-grid svg

node scripts/audit-module-regressions.js --fixtures test/fixtures/examples \
  --only latex-examples-histogram-large-1d-dataset \
  --output outputs/qa/2026-10-23-histogram-bounds-after \
  --before outputs/qa/2026-10-23-histogram-bounds-before \
  --browser-module /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs

node scripts/diff-example-pngs.js \
  --output outputs/qa/2026-10-23-histogram-bounds-after
```

Do not regenerate the before root from the changed runtime: it is the
preserved pre-repair evidence. Browser execution required approval to launch
Chrome outside the restricted sandbox. No global script or manifest was
changed to obtain these results.
