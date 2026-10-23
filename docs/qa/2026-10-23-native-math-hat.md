# Ordinary Native Math Hat: Source and Browser Audit

## Status

The ordinary CMR/CMBX hat now uses renderer-neutral TeX boxes and the
existing CM accent glyph. The intrinsic pin-label construction is verified
against both original-source MacTeX and tikztosvg in actual Chrome.
**The complete function-pin-colors case remains visually unaccepted.**
Its absolute pin positions still differ; the focused artifacts explicitly
retain `wholeCaseAccepted: false`.

Accent runtime is frozen. The three after cases have now been regenerated
against the parent's current runtime, including native, tikztosvg, JS,
actual Chrome and diff artifacts. Final verification at
`2026-10-23T12:01:38.267Z` found no currentness blockers: **3/3 generated,
0 stale, 0 diagnostics, browser errors []**. The refreshed sheets were
inspected. `after/final-gates.json` records the current environment and
per-case fingerprints, evidence hashes and exact gate results.

**Whole-case acceptance is still 0/3.** Both strict tikztosvg control gates
fail at 0.09px tolerance: 1.08867px for ordinary controls and 1.48360px for
family controls. AMS versus non-AMS differences are failures, not accepted
noise. The original-source 45-glyph control is within 0.03644px and real
pin construction within 0.00239px, but full family controls retain the
0.41550px raw-mathversion failure and absolute pin placement remains off
by up to 10.50957px. The raw diff's two sparse-sheet `same` statuses do not
override these failures; all three cases retain `accepted: false`.

Before artifacts and pre-change probes below are historical evidence.
All 665 files across the hat and two histogram before roots were verified
unchanged. `probes/runtime-fingerprint.json` records only this task's three
frozen runtime/generator files; their hashes also remain unchanged.
No metadata, registry, parser, PGFPlots, renderer, font binary, or mathNode
dispatch was changed by the accent work. No commit.

## Files Changed

- `src/tex/mathBox.js`: ordinary hat opt-in, native accent construction,
  single-character skew and script attachment, plain TeX brace collapse.
- `scripts/build-cm-math.py`: TFM skew-kern export and metrics-only entry point.
- `src/tex/cmMathMetrics.js`: generated `skewKern` fields only; all preexisting
  metric fields compare exactly equal to the preserved pre-change JSON.
- `test/native-math-hat.test.js`: native dimensions, glyph positions/families,
  real pin dispatch, family-context distinctions, unsupported-accent controls.
- `test/fixtures/native-math-hat/{manifest.json,hat.tex,families.tex}`:
  isolated controls and the unchanged real pins source, no global manifest.
- `test/fixtures/native-math-hat-metrics.tex` and
  `test/fixtures/native-math-hat-families.tex`: independent pdfTeX probes,
  with optional amsmath variants.
- `test/fixtures/native-math-hat-browser-probe.mjs`: original-source versus
  tikztosvg Chrome measurements, full-frame sheets, intrinsic pin crops.
- This report.

All 106 existing OTF/WOFF font binaries retain their pre-change hashes.
The existing CMR/CMBX U+02C6 glyph is reused, not redrawn or regenerated.

## Native Rules

Local source root: `/usr/local/texlive/2025/texmf-dist/`.

| Source | Rule used |
| --- | --- |
| `tex/latex/base/fontmath.ltx:417` | Ordinary hat is `mathalpha`, operators family, slot 0x5E. |
| `fontmath.ltx:59-69` | Operators use CMR normally and CMBX in bold math; mathnormal selects letters. |
| `tex/latex/base/omlcmm.fd:50` | The letters skewchar is 127. |
| `tex/latex/base/omscmsy.fd:50` | The symbols skewchar is 48. |
| `doc/generic/knuth-pdf/tex/tex.pdf`, sections 738-742 | `make_math_accent`: cramped nucleus, TFM skew, x-height overlap, zero accent advance, scripts moved onto a character nucleus. |
| Same source, section 1165 | A mathalpha accent uses the current family when set. |
| Same source, section 1186 | Lone ordinary/accent noads can lose their enclosing braces before script attachment. |

The accent offset is `skew + (nucleusWidth - accentWidth) / 2`.
The vertical overlap is the minimum of nucleus height and the accent font's
x-height. If scripts move into the nucleus, the overlap is increased by the
new body's height minus the original nucleus height. The original nucleus
width still determines centering; the final body determines box width.
There are no fitted offsets, hand-drawn strokes, or source-specific cases.

CM `cmmi10.tfm` theta (slot 18) has kern-to-127
`0.08333587646484375em`, or `0.8333587646484375pt` at 10pt. The old Unicode
kerning map omitted this because slot 127 has no exported Unicode glyph.
The new field retains this TFM datum without requiring a painted skewchar.

For `hat(theta)_1`, pdfTeX reports width/height/depth
`9.18057 / 9.58334 / 1.49998` TeX pt. The hat origin is
`(0.81947,-2.63890)`, theta `(0,0)`, and subscript
`(4.69444,1.49998)`. The subscript starts before the theta italic correction.
For `hat(theta_1)`, the composite nucleus instead centers the hat at
`x=2.09029`. Both spellings are tested independently.

## Font Context Probe

The independent family probe loads amsbsy, not amsmath, unless explicitly
requested. These are shipped-font traces, not deductions from box sizes.

| Formula/context | Accent / nucleus | Width / height, TeX pt |
| --- | --- | --- |
| `\mathbf{\hat{x}}` | CMBX / CMBX | 6.06941 / 6.94444 |
| `\hat{\mathbf{x}}` | CMR / CMBX | 6.06941 / 7.08334 |
| `\boldsymbol{\hat{x}}` | CMBX / CMMIB | 6.59027 / 6.94444 |
| `\hat{\boldsymbol{x}}` | CMR / CMMIB | 6.59027 / 7.08334 |
| `\mathversion{bold}` with `\hat{x}` | CMBX / CMMIB | 6.59027 / 6.94444 |
| `\hat{\mathnormal{x}}` | CMR / CMMI | 5.71527 / 6.94444 |
| `\mathnormal{\hat{x}}`, without amsmath | CMMI slot 0x5E / CMMI | 5.71527 / 4.30554 |

Thus `ctx.roman === "bold"` selects CMBX for an outer mathbf accent for a
source-based reason: the accent is mathalpha. It does not mean every hat
over a bold nucleus uses CMBX. The current `ctx.roman === false` rejection
is intentional for an outer mathnormal: CMMI slot 0x5E is not the CMR hat.
An inner mathnormal is supported; nested mathrm/mathbf can restore a
supported accent family. Tests cover all these distinctions.

There is an important package boundary. Local
`tex/latex/amsmath/amsmath.sty:740-893` changes accent-class behavior for
OML/OMS and supplies `macc@nested`. With amsmath, outer mathnormal uses a
normal hat, and `\mathnormal{\mathbf{\hat{x}}}` retains a CMR hat instead
of the basic LaTeX CMBX choice. Plain TeX nested hats have outer/inner
x shifts `0.35764 / 0.63542pt`; amsmath aligns the two hats differently.
Both native variants are preserved in the probe logs. These AMS-specific
rules are not implemented by this ordinary TeX-accent slice.

## TDD and Tests

The pre-change run failed three semantic tests: no native ordinary-hat box,
missing theta skew kern, and no shared native groups for the two real pins.
The unsupported-accent control already passed. Evidence:
`outputs/qa/2026-10-23-math-hat/probes/before-tests.tap`.

Current focused tests: **5/5 pass**, covering 18 dimension probes plus
8 supported family probes and explicit negative controls. The two native
probe documents contain 29 measurements in total, including the unsupported
outer-mathnormal cases. Related math suites: **61/61 pass**, recorded in
`probes/related-tests.tap`, after the parent updated obsolete hat-fallback
tests. This is not a full-suite or registry claim.

## Actual Browser Evidence

Isolated artifact root: `outputs/qa/2026-10-23-math-hat/`.
The preserved before contains two cases. After contains three cases, each
with JS SVG/PNG, tikztosvg SVG/PNG, original-source MacTeX PNG/log/PDF and
comparison grids. Chrome is **155.0.8059.86**, at fixed 3x physical scale;
there were no browser errors or failed font loads.

The existing `scripts/audit-module-regressions.js` ran on all three cases
and wrote 11 browser panels including preserved before exports. Its two
strict control gates remain failed, rather than being loosened: the
unmodified tikztosvg executable preloads `amsmath` and `amssymb` at line 46,
even when absent from the supplied document. There is also a deliberately
retained raw-mathversion node control outside this task's parser ownership.

The separate browser probe compares the actual original-source PDFs,
converted with the same `pdf2svg` used by tikztosvg, against both JS modes.
It writes 16 full-frame panels and eight pin construction crops. One frame
translation is allowed; formulas are never resized or fitted.

| Probe at 3x | Result |
| --- | --- |
| Original-source 16 hat formulas | 45/45 glyphs; maximum origin error 0.03644px in default and export |
| Same controls versus tikztosvg | 1.08867px maximum, at the AMS nested outer hat |
| Original-source family controls | 14 ordinary supported glyphs within 0.03024px; raw mathversion node remains wrong weight and has 0.41550px maximum origin error |
| Family controls versus tikztosvg | 1.48360px maximum; includes AMS mathnormal/family behavior difference |
| Real pins, intrinsic construction | 6/6 glyphs; maximum relative error 0.00239px in both JS modes |
| Pin 1 absolute origin versus plot frame | x -5.56513px, y -10.50935px |
| Pin 2 absolute origin versus plot frame | x -6.32153px, y -0.95697px |

The before export visibly drew a hat across theta. The default before used
a broader/different hat and mismatched label boxes. Both current modes now
paint the native CM hat above theta, preserve optical script sizes and
share the same glyph construction. The intrinsic crop sheet was inspected
alongside all original-source/native/JS/diff sheets. Rasterized font text
and native SVG outlines are not pixel-identical. The full frame-aligned
pin sheets still visibly show displaced labels and leader lines.

Important files under `after/`:

- `browser-audit.html`, `browser-audit.json`: actual tikztosvg audit, retaining failed control gates.
- `native-source-browser-metrics.json`: original-source and converter comparisons, counts, per-glyph errors and absolute pin residuals.
- `browser/native-math-hat-source-sheet.png`: native source, tikztosvg, default, export, before default, before export, difference.
- `browser/native-math-hat-families-source-sheet.png`: the same first four panels and difference, including retained failures.
- `browser/function-pin-colors-source-sheet.png`: full absolute pin-placement comparison with both before modes.
- `browser/pin-glyph-construction-sheet.png`: construction-only crops; rows are native source, tikztosvg, default and export, columns pins 1 and 2. These crops do not certify placement.

## Exact Limits

- Only ordinary `\hat` is newly implemented. `\widehat`, `\widetilde`,
  `\bar`, `\vec` and other accents retain whole-formula fallback.
- Outer `\mathnormal` selecting the letters-family accent slot deliberately
  falls back. AMS-specific mathnormal and nested-accent adjustments are not
  modeled; a nested ordinary hat currently follows basic TeX even in an AMS
  package context. Those cases must not be advertised as native-equivalent.
- `mathVersion: "bold"` in native layout and existing `\boldmath` node
  handling work. Raw TikZ `font=\mathversion{bold}` is not recognized by
  the existing font parser; the retained browser control remains visibly
  normal-weight. No shared parser/font changes were made to hide it.
- Unsupported nucleus syntax or fonts still cause complete fallback. This
  work does not certify arbitrary accent packages or arbitrary font sizes.
- Correct label construction does not fix PGFPlots pin positions, leaders,
  curve sampling or unrelated canvas geometry. Whole-case acceptance stays
  false until the parent's fresh comparison resolves or explicitly accepts
  those residuals.

## Reproduction

Run the native probe files with pdflatex into the isolated `probes/` folder.
For the AMS variant, define `\hatprobewithamsmath{1}` before input and use
a distinct jobname. Generate metrics without touching font binaries with
`python3 scripts/build-cm-math.py --metrics-only`.

```sh
node --test test/native-math-hat.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/native-math-hat \
  --output outputs/qa/2026-10-23-math-hat/after --native-reference \
  --tikztosvg-engine pdflatex --comparison-grid svg
node scripts/audit-module-regressions.js --fixtures test/fixtures/native-math-hat \
  --output outputs/qa/2026-10-23-math-hat/after \
  --before outputs/qa/2026-10-23-math-hat/before \
  --browser-module /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
```

The last command intentionally reports the control mismatches listed above.
For each case, convert `after/.mactex-work/<id>/reference.pdf` with
`pdf2svg <pdf> after/native-source-svg/<id>.svg 1`, then run:

```sh
node test/fixtures/native-math-hat-browser-probe.mjs \
  outputs/qa/2026-10-23-math-hat \
  /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
```

That command gates only the original-source 45-glyph control and intrinsic
pin construction, and leaves the other residuals present in the report.
