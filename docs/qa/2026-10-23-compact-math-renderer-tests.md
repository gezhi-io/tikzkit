# Compact Math Renderer Assertion Integration

## Latest Integration Status

Final integration repaired CMTT base anchors and native text eligibility.
An actual browser sheet then exposed a remaining defect despite passing color
assertions: the UAG background did not cover the white glyphs, and STOP lost its
typewriter font. The runtime now preserves supported inline-node text, font,
padding and base/center anchors, and lays them out with one native hbox for both
measurement and painting. Other rich commands retain their fallback; mixed bold
typewriter text is not silently flattened.

The Gene comparison now checks all 14 colored glyph origins against tikztosvg
in real Chrome: maximum error 0.003928px in both default and SVG-text modes.
The 24-character literal base-anchor check passes at 0.006289px; the earlier
1.44px baseline error is gone. The red UAG/STOP rectangles visibly enclose all
white glyphs at native padding. Direct MacTeX PNGs were also inspected.

The compact-anchor, scalebox and inline-box tests total **21 passed**. The
integrated full suite reports **2933 tests, 2873 passed, 46 failed, 14 skipped**,
with no new failing names versus either the 50- or 76-failure baseline. This is
not whole-project or whole-raster acceptance: the seven broad controls retain
visible differences, and strict direct-PDF raster gates remain blocked.
See [the final integration report](2026-10-23-compact-math-anchors.md) for all
artifact paths, commands, supported boundaries and remaining failures.
Earlier sections below are retained as chronological pre-repair evidence.

## Initial Test-Only Scope

This first section records the initial bounded assertion integration. The
subsequent authorized scalebox runtime work and CMTT follow-up are recorded below.

Only the following existing tests were edited:

- `test/renderer.test.js`
- `test/svg-renderer.test.js`
- `test/petarv-compat.test.js`
- `test/pgfplotstable-typeset.test.js`

Added the independent local TeX probe
`test/fixtures/compact-math-renderer-metrics.tex` and this note. No runtime,
shared helper, unrelated test, tolerance for an existing visual gate, or existing
QA report was changed. Prior uncommitted edits in the owned files were preserved.
No commit or push was made.

## Failure Comparison

Compared failures by file and test name, not line number:

- Baseline: `outputs/qa/2026-10-23-pgfplots-quiver-after/test-summary-final.json`
- Initial current: `outputs/qa/2026-10-23-compact-math-after/test-summary-initial.json`

| Owned file | Baseline failures | Initial current failures | After integration |
| --- | ---: | ---: | ---: |
| `renderer.test.js` | 7 | 17 | 7 |
| `svg-renderer.test.js` | 1 | 4 | 0 |
| `petarv-compat.test.js` | 7 | 8 | 7 |
| `pgfplotstable-typeset.test.js` | 0 | 1 | 0 |
| Total | 15 | 30 | 14 |

All 16 newly failing tests are resolved. The baseline SVG-renderer failure,
`matches tikztosvg bounds for the basic arrow math label`, already passed before
these test edits because of the concurrent runtime changes; its test was not
edited. The 14 still-failing baseline tests were left unchanged.

## Independent Native Evidence

Read the local TeX Live 2025 `fontmath.ltx` and the local CMMI10/CMSY10 TFM data
with `tftopl` before editing assertions. Relevant declarations:

- Letters use OML/CMMI; operators and digits use OT1/CMR.
- `\cdot`, `\times`, and `\neg`/`\lnot` use OMS/CMSY slots 01, 02, and 3A.
- The decimal point is a math-ordinary CMMI glyph at slot 3A, not a CMR digit.
- Normal 10pt math uses 10/7/5pt text/script/scriptscript optical sizes; a
  `\large` 12pt ordinary letter uses CMMI12.

Probe command, run from the repository root:

```sh
pdflatex -halt-on-error -interaction=nonstopmode -output-directory=/private/tmp test/fixtures/compact-math-renderer-metrics.tex
```

Compilation exited 0. The measurements are also available in
`/private/tmp/compact-math-renderer-metrics.log`. All values below are TeX points,
not SVG/PDF points.

| Formula | Width | Height | Depth |
| --- | ---: | ---: | ---: |
| textstyle `x` | 5.71527 | 4.30554 | 0 |
| displaystyle `x` | 5.71527 | 4.30554 | 0 |
| textstyle `\frac{1}{x}` | 6.93472 | 8.44843 | 3.44841 |
| displaystyle `\frac{1}{x}` | 8.11526 | 13.20952 | 6.85951 |
| `\alpha` | 6.43404 | 4.30554 | 0 |
| `\cdot` | 2.77779 | 4.44444 | 0 |
| `P=(x,y)` | 44.34134 | 7.5 | 2.5 |
| `P`, including italic correction | 7.80904 | 6.83331 | 0 |
| `=` | 7.77780 | 3.66875 | 0 |
| `\sin x` | 19.65970 | 6.67859 | 0 |
| `sin` operator alone | 12.27780 | 6.67859 | 0 |
| scriptsize `2x+3y\le10` | 45.36935 | 4.79828 | 1.36110 |
| large `t` | 4.24301 | 7.38097 | 0 |
| mantissa `1` | 5.00002 | 6.44444 | 0 |
| mantissa `9.8` | 12.77782 | 6.44444 | 0 |
| mantissa `1.23` | 17.77783 | 6.44444 | 0 |

The render-unit assertion now derives the alpha box top from the independently
measured height and its original 1.3cm center. The circle's original bounds are
unchanged. The isolated raw-text `x` document height is 4.29 SVG/PDF points after
conversion by `72/72.27` and the existing two-decimal document rounding, not the
legacy padded 7.7-7.9 point range.

New numerical comparisons use 0.001pt for native TFM/layout measurements and
0.0001 render units for the one-point-per-unit alpha fixture. They replace
incidental HTML/SVG-format expectations with independent measurements; no
existing visual tolerance was widened.

## Assertion Changes

- `renderer.test.js`: migrated standalone cdot, escaped-dollar order, macro
  normalization, alpha/times/x, relation spacing, upright sin, negation, and
  large-t assertions to `nativeMathGroups`/`assertNativeText` semantics. These
  check actual CM families, optical sizes, order, styles, colors, baselines,
  and positions where relevant. Relations retain explicit 5mu spacing on both
  sides, and sin retains 3mu spacing before an ordinary variable.
- The scriptsize foreignObject test now deliberately uses unsupported
  `\widehat{x}`, with an explicit native-layout-null assertion. Its existing
  HTML sizing checks are unchanged. A new test retains the original supported
  formula and checks its seven-point native glyph families and uncropped native
  box dimensions. This preserves both renderer branches.
- `svg-renderer.test.js`: replaced legacy `tikz-math-glyph` checks for x/y with
  CMMI10 glyph and finite-transform checks. The cache test requires identical
  textstyle/displaystyle x geometry, while retaining distinct cache keys. It
  also checks independently measured text/display fraction boxes, rule counts,
  and 7pt versus 10pt numerator/denominator fonts, so math style still has a
  meaningful layout contract.
- `petarv-compat.test.js`: the scaled annotation still checks upright blue
  multiplication and digit glyphs, their order and common baseline, and all
  pre-existing matrix placement/bold-I assertions. It deliberately does not
  assert the current incorrect scaled width described below.
- `pgfplotstable-typeset.test.js`: replaced document-wide `text-anchor` regexes
  with per-row native mantissa right edges and exponent-fragment left edges at
  the shared IR anchor. Mantissa advances are from the local probe, and native
  exponent sizes/positions are checked. This remains a horizontal-alignment
  contract, not an endorsement of the current vertical alignment.

## Verification

- Before edits, the four owned files: 381 tests, 351 passed, 30 failed.
- After edits, the four owned files: 382 tests, 368 passed, 14 failed.
- Exact-name selection of all changed/added tests: 17 passed, 0 failed.
- `test/compact-math-anchors.test.js`: initially 4 passed; the final run includes
  a concurrent fifth test and reports 5 passed, 0 failed. This file was not edited.
- Final combined run of the four owned files plus the current anchor tests:
  387 tests, 373 passed, 14 pre-existing failures.
- `git diff --check` for owned files and the new probe: clean.
- All remaining failures also occur in the historical baseline, and their
  messages match the before-edit current-workspace run. The historical GameBoy
  failure reported a size of 17.57299 versus the current 5; it was already failing
  and was not changed here. Every pre-existing failing test block was verified
  byte-for-byte unchanged against the initial shared-workspace snapshot.

Owned-file verification command:

```sh
node --test --test-reporter=./scripts/module-test-reporter.js test/renderer.test.js test/svg-renderer.test.js test/petarv-compat.test.js test/pgfplotstable-typeset.test.js
```

The whole repository suite and gallery were not rerun in this bounded task;
runtime and visual integration are being handled concurrently.

## Visual Evidence

The actual report is
`outputs/qa/2026-10-23-compact-math-after/browser-audit.json`, not
`browser-report.json`. It reports no errors, with the two compact native glyph
gates accepted at 3x CSS zoom: 18 glyphs with maximum origin error
0.0236333575px, and 10 directional glyphs with 0.0019457416px, for both default
and SVG-text rendering.

Opened and inspected the existing compact-math-glyphs and
compact-math-directions comparison sheets, including native/JS/diff panels.
No obvious compact glyph or directional-anchor displacement was visible in
the current-versus-native panels; residual ink differences are visible in the
diff panels. These artifacts were not regenerated by this test-only task, and
the gates do not cover the two remaining issues below. This note does not
declare broader visual compatibility complete.

## Remaining Geometry Issues

### Original Scalebox Finding

The independent probe measures `\scalebox{.5}{$\times 1$}` at width 6.38890pt,
height 3.22221pt, depth 0.41666pt. The current native renderer instead paints
CMSY5/CMR5 at 5pt; its width is about 8.81958pt and height plus depth about
4.16675pt. A native five-point-font probe returns width 8.81956pt, confirming
that font selection and geometric scaling have been conflated. Runtime was not
edited, and no assertion was added that blesses this incorrect size.

The subsequent runtime follow-up below addresses this finding. These numbers
describe the pre-fix state, not the final implementation.

### Scientific Fragments Have Different Baselines

In `pgfplotstable-sci-sep-align.tex`, the first mantissa group's SVG baseline is
74.587581 render units; the `\cdot 10^{-3}` group's is 77.567236, with group
scale 3.514598. The second fragment is therefore about 0.847794 TeX pt lower.
The other rows show the same discrepancy. Their horizontal anchors do agree.

Compiled the original fixture with native output-box tracing, without editing
it:

```sh
pdflatex -halt-on-error -interaction=nonstopmode -output-directory=/private/tmp -jobname=compact-math-renderer-scientific-table '\tracingoutput=1\showboxbreadth=100\showboxdepth=100\input{test/fixtures/examples/pgfplots/pgfplotstable-sci-sep-align.tex}'
```

The command exited 0. In
`/private/tmp/compact-math-renderer-scientific-table.log`, lines 648-665, native
mantissa and exponent-fragment columns are unshifted sibling hboxes on the same
row baseline. Only the actual superscript box is shifted by -3.62892pt. This
confirms the SVG baseline discrepancy independently of the runtime's own
measurements. No runtime change or compensating vertical tolerance was made.

## Scalebox Runtime Follow-Up

### Implementation And Scope

The first two tests in `test/compact-scalebox.test.js` were written and run
before runtime edits. Raw rendering failed at 8.81958013pt versus native
6.38890pt; an interpreted node failed at 12.77782440pt (scale lost entirely).
The main third full-suite report independently captured both failures.

Read local TeX Live 2025 `graphics.sty` lines 514-535 and `pdftex.def`'s
`Gscale@start`: graphicx builds the original hbox before transforming its
glyphs, rules, width, height, and depth. A geometric half-scale must retain
CMSY10/CMR10 outlines at a final size of 5pt, not select CMSY5/CMR5.

Runtime changes, preserving pre-existing dirty content:

- `src/tikz/text.js`: preserve positive whole inline-math scaleboxes as numeric
  math-box wrappers, including nesting and inner/outer font-size declarations.
- `src/tex/relativeMath.js`: per-parse inert numeric wrapper and validated
  fallback extraction; no global KaTeX macro registration.
- `src/tex/mathBox.js`: scale completed boxes, including glyph origins, glyph
  sizes, rule dimensions, depth, and italic correction, without mutating caches.
- `src/renderers/svg/mathNode.js`: reuse the shared box scale operation and
  preserve fallback measurement/rendering for unsupported native formulas.
  This exact renderer file was reported before editing.

No edits to `evaluate.js`, `latex-shell.js`, `plainTextNode.js`, `textEngine.js`,
or `pgfplots/*`. The scientific-table baseline issue remains out of scope.

### Independent Measurements

`test/fixtures/compact-scalebox-metrics.tex` compiles with local pdfLaTeX.
Its saved log is in the after-QA directory. All entries below are TeX points:

| Case | Width | Height | Depth |
| --- | ---: | ---: | ---: |
| half times-one | 6.38890 | 3.22221 | 0.41666 |
| 0.37 times-one | 4.72772 | 2.38440 | 0.30832 |
| 1.5 script x1 | 15.30210 | 6.45831 | 2.24997 |
| half fraction 1/(x+y) | 8.69019 | 4.22421 | 2.40475 |
| half times-one at inherited 8pt | 5.43063 | 2.57777 | 0.41669 |
| half script x1 at inherited 12pt | 5.71355 | 2.58333 | 0.90000 |
| half times-one with inner large | 7.60414 | 3.86665 | 0.50000 |
| nested half then 1.5 sin x | 14.74477 | 5.00894 | 0 |
| double times-one | 25.55563 | 12.88889 | 1.66666 |
| half twice-mathlarger x | 3.33852 | 2.58333 | 0 |

The seven new tests cover these independent measurements, both renderer modes,
node dimensions and baseline anchors, optical font retention, rule thickness,
color, nested scaling, cache isolation, unsupported-formula fallback, and
rejection of unsafe/non-finite wrapper attributes. Numerical tolerance is
0.001 TeX pt; no existing visual threshold was changed.

### Browser And Native Evidence

New fixture directory: `test/fixtures/compact-scalebox/` (`glyphs.tex` and
`manifest.json`). Separate generated QA roots:

- `outputs/qa/2026-10-23-compact-scalebox-before`
- `outputs/qa/2026-10-23-compact-scalebox-after`

The after root contains native MacTeX PNG, local tikztosvg SVG/PNG, JS SVG/PNG,
browser screenshots, before/after/native/diff sheets, metrics logs, and reports.
Opened and inspected both the browser sheet and the native-raster sheet.

`browser-audit.json`: Chrome 155, no browser errors; all 24 glyph origins pass
in both default and SVG-text modes. Maximum error at 3x CSS zoom is
0.0141253861px, down from 30.9802652580px in the before export. Alignment is a
single frame translation at fixed physical scale; the unchanged gate is 0.09px.
The old scale and script/fraction placement mismatches are no longer visible.

`diff/summary.json`: JS versus local tikztosvg passes unchanged raster thresholds
with 9 changed pixels, ratio 0.000206441, mean absolute RGBA 0.000006207,
and zero registration offset. **Aggregate raster acceptance remains blocked**
by the direct MacTeX PDF-raster comparison: 4.14946% changed pixels, mean
0.00686436. Local tikztosvg versus the same native PNG also differs by 4.12423%,
mean 0.00685703. The inspected native-raster sheet has visibly different frame
ink and small-glyph rasterization; this common pipeline difference was not
hidden by changing thresholds. Browser/box compatibility is demonstrated,
but complete PDF-raster equivalence is not claimed.

Supported scope is positive uniform scaling of a whole dollar-delimited inline
formula. Negative/zero factors, optional independent vertical factors, mixed
text/math content, and other delimiter forms are not newly implemented. For
unsupported native formulas, the existing fallback is scaled consistently;
its underlying layout is not thereby certified as native-equivalent.

## CMTT Assertion Follow-Up

Changed exactly these three existing test blocks, verified against snapshots
taken immediately before this follow-up:

- `petarv-compat`: picture-wide monospace propagation now checks the actual
  native literal glyphs, CMTT10 face, 10pt size, and TFM advances.
- `petarv-compat`: Gene-expression content accepts per-glyph serialization,
  checks native UAG metrics, and preserves/strengthens the original blue,
  green, and white paint assertions. At this stage it failed on actual lost
  colors: the native GUG/CAU/UAG/V glyphs were black. Main's later shared
  eligibility repair resolves the focused regression; see the latest status.
- `svg-renderer`: 10pt monospace now checks native logical metrics and cached
  literal glyphs; 9pt monospace remains in the unsupported-font fallback list.

Read `cmtt10.tfm` through local `tftopl`, then extended
`test/fixtures/compact-math-renderer-metrics.tex`. Native measurements are
ACAACG width 31.49973pt / height 6.11111pt, UAG width 15.74986pt / height
6.11111pt, and concatenate width 57.74950pt / height 5.53575pt, all zero depth.
The two non-color migrations passed at this stage. The old Gene-expression
0.88-width-scaling test was already failing in the historical baseline and
was initially left untouched; its later authorized migration is recorded below.

## Follow-Up Verification

- Focused scalebox, relative-math, math-box, hat, fallback-dispatch, and current
  compact-anchor tests: **37 passed, 0 failed** (`test-summary-focused.json`).
- Three exact CMTT migrations: **2 passed, 1 real color failure**.
- Full test-file suite: **2926 tests, 2861 passed, 51 failed, 14 skipped**
  (`test-summary-final.json` in the after root). This is a shared-workspace
  snapshot while the main task is editing other modules.
- Relative to `compact-math-after/test-summary-third.json`, the three newly
  listed failures are default PGFPlots axis extent, zero-bound middle-axis
  extent, and horizontal split alignment; these tests were not edited here.
  Both originally failing scalebox tests and the two non-color CMTT tests pass.
- Architecture check: 473 modules, no errors, one pre-existing text-to-frontend
  dependency recorded as known debt. Scoped `git diff --check`: clean.
- An initial sandboxed discovery run also executed standalone `.mjs` browser
  probes and could not bind local servers. Its separate
  `test-summary-sandbox-discovery.json` is not the final suite result.

Final suite command (with permission for localhost server tests):

```sh
node --test --test-reporter=./scripts/module-test-reporter.js --test-reporter-destination=outputs/qa/2026-10-23-compact-scalebox-after/test-summary-final.json test/*.test.js
```

No commit or push. No unrelated old assertion or visual tolerance was changed.

## Closing Gene Assertion Audit

The main task subsequently authorized migrating the pre-existing
`renders Gene expression typewriter labels with TeX-like horizontal advance`
test. It now checks all 24 actual glyphs in default and SVG-text modes:
CMTT10 face (`TikZKitMath_Typewriter`), size 10pt, common baseline, and horizontal
advances of 5.24996pt. It no longer requires the obsolete
`tikz-typewriter-text` wrapper or 0.88 horizontal scale.

Extended the independent local probe with the exact label
`GTGCATCTGACTCCTGAGGAGTAG`: width 125.99890pt, height 6.11111pt, zero depth.
The new width check allows 0.001pt for accumulated TFM rounding over 24 glyphs;
each emitted origin retains the existing follow-up 0.0001pt check. The width
test passes. This is not a change to a visual-gate tolerance.

The Gene color test now covers both direct and injected SVG text-engine paths
in both rendering modes. It requires blue GUG/V, green CAU, white UAG/STOP,
preserved glyph content, and both red inline backgrounds. It failed on the
real rich-color dispatch bug before main's `layoutNativeTextRun` repair and
now passes in main's reported five-test focused run. Main explicitly owns
that repair in `textBox.js`, `plainTextNode.js`, and `textEngine.js`; none of
those files was edited by this assertion task. An in-memory-only
candidate check confirmed that declining rich-color source in the native
literal fast paths restores the existing segmented renderer. That candidate
was never written to the shared runtime files.

### Before Artifacts For Main's After Comparison

Fixtures: `test/fixtures/compact-math-renderer-gene/`:
`manifest.json`, `colors.tex`, and `literal.tex`.

Output root: `outputs/qa/2026-10-23-compact-math-renderer-gene-before`.
Both cases have actual MacTeX PNG, local tikztosvg SVG/PNG, JS SVG/PNG, browser
screenshots and sheets, registered/raw diff images, and native-raster sheets.
The refreshed metrics log is also saved there. Existing before artifacts were
not overwritten with the in-memory candidate output.

- `browser-audit.json` has zero browser errors. The colored-case sheet visibly
  shows black GUG/CAU/UAG/V and a missing UAG red background in JS, versus the
  correctly colored local native reference. STOP still uses a legacy path and
  has visible font/box differences; no full native-equivalence claim is made.
- The literal case's unchanged 24-glyph gate fails on a **1.4402996431px upward
  baseline offset at 3x**, with a maximum horizontal error of only
  0.0062880926px. First-to-last advance differs by 0.0067325919px. This
  `base west` anchor residual was reported to the main task, not compensated
  in assertions or runtime.
- `diff/summary.json`: both before cases are `different`, accepted false,
  with complete, non-stale evidence. JS/local-tikztosvg changed-pixel ratios
  are 0.0485398186 for colors and 0.0803378864 for the literal label. The
  native, JS, and diff sheets were opened and inspected.

Main is rendering the same two fixtures into the distinct
`compact-math-renderer-gene-after` output root. The preserved before root is
available for the browser audit's `--before` option. After-render visual
acceptance is pending; no concurrent render was started by this task.

### Final Owned-File Review

- Scalebox runtime files are byte-for-byte unchanged since their previous
  reviewed state. Its focused suite remains **37 passed, 0 failed**.
- Exact CMTT/Gene selection: **3 passed, 1 color-dispatch failure** before
  the main runtime repair. The unsupported 9pt monospace control still passes.
- Pre-repair full test-file snapshot: **2927 tests, 2866 passed, 47 failed,
  14 skipped**, with no new failure names relative to
  `compact-math-after/test-summary-fourth.json`. Saved as
  `compact-math-renderer-gene-before/test-summary-current.json`.
- This closing follow-up edits only the two Gene test blocks in
  `test/petarv-compat.test.js` plus the engine import, extends the owned metric
  probe, adds the two uniquely prefixed QA fixtures/manifest, and updates this
  note. Other old assertions and main-task runtime files are untouched.
- Scoped whitespace/diff checks are clean. Main owns the post-color-fix full
  suite and after-browser evidence; the before snapshot is not a final claim
  that its concurrently changing runtime is green.
- At the latest handoff, main reports **five focused tests passing** after the
  shared eligibility repair. The fifth full suite and Gene after-browser
  validation are in progress; their totals and visual gates are not inferred.
