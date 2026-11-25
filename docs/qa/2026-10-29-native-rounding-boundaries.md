# Native PGF Rounding Boundaries

## Scope and Status

This follows the recorded fixed-point TODO in
[native signed math and angle painting](2026-10-28-native-math-angles.md).
The scope is **ordinary `round`, `floor`, `ceil` arguments**, not a replacement
for all PGF math, all coordinates, or the PGFPlots floating-point engine.

Seven visibly misplaced points now agree with the local reference. All **108
independent native numeric results** and **145 browser glyph origins** pass.
The two changed JS/tikztosvg PNG pairs pass the existing thresholds. The
PGFPlots control is byte-identical before/after, but retains small existing
frame/grid/dash differences. **Strict whole-image acceptance remains open**,
including the independent PDF comparisons. No threshold was loosened and no
reference output was substituted for JavaScript rendering.

The full collection has **3333 passed, 0 failed, 14 unchanged skips**, including
115 new tests. Architecture checks cover 489 modules with zero errors and one
existing text/frontend dependency debt. No commit, push, version change or npm
publish was performed in this turn; preceding worktree changes are preserved.

## Local Implementation References

Paths are relative to `/usr/local/texlive/2025/texmf-dist/`.

| File | Rule used |
| --- | --- |
| `tex/generic/pgf/math/pgfmathfunctions.round.code.tex` | `round`, `floor`, `ceil` first assign their argument to a TeX dimension. Ties round away from zero; negative fractional remainders affect floor/ceil differently. `int` is token-based and must not receive the same blanket conversion. |
| `tex/generic/pgf/math/pgfmathfunctions.basic.code.tex`, lines 17-109 | Addition/subtraction convert both operands separately; multiplication truncates scaled products; integer division uses TeX's truncating division. Quantizing only the final double result is incorrect. |
| `tex/generic/pgf/math/pgfmathparser.code.tex`, number/exponent scanners | Decimal token spelling survives until a function consumes it. Scientific literals enter a separate conversion routine. |
| `tex/generic/pgf/math/pgfmathfunctions.misc.code.tex`, lines 126-209 | Scientific literals use five-decimal truncation, separate positive/negative exponent handling, and explicit underflow below exponent -4. `round(2.499999e0)` is 2, not the ordinary-decimal result 3. |
| `tex/generic/pgf/libraries/pgflibraryfpu.code.tex`, float floor/ceil/round | FPU rounding does not use ordinary dimension-register conversion. `round(2.499999)` is 2 under FPU and 3 under ordinary PGF. |
| `tex/generic/pgfplots/util/pgfplotsutil.code.tex`, lines 30-34 | `/pgfplots/use fpu` defaults to true. The option selects rounding semantics in the plot evaluator. |
| `doc/generic/pgf/pgfmanual-en-math-parsing.tex`, rounding section | Manual controls include `round(32.5/17)`, `floor(398/12)` and `ceil(-398/12)`. |
| `doc/generic/knuth-pdf/tex/tex.pdf`, TeX82 sections 102 and 452 | The dimension scanner retains 17 fractional digits. Its decimal-to-scaled conversion must precede loss of precision to a JS Number. |

The independent [native probe](../../test/fixtures/native-rounding-boundaries.tex)
runs 54 expressions twice, with ordinary PGF and local FPU. Its log is saved
with the QA artifacts. Expected values are transcribed from MacTeX, never
generated from the implementation being tested.

## Shared Implementation

- `src/engine/pgf-fixed-point.js`: decimal-to-scaled conversion, multiplication,
  integer division and bounded scientific-literal conversion.
- `src/engine/safe-expression.js`: AST numbers retain their token spelling;
  rounding arguments request fixed arithmetic without leaking it to siblings.
  Existing recursion, operation, unknown-variable and accessor protections remain.
- `src/pgfplots/expressions.js`: preserves default floating rounding, with
  `use fpu=false` selecting the ordinary rounding route. This does not claim
  that every PGFPlots operation now implements fixed arithmetic.
- `src/packages/pgfmath.js`, registry MD/CSV: retain `partial` and document the
  narrower implementation and its remaining limits.

The two decimal strings `2.49999237060546874` and `2.49999237060546875` collapse
to the same JavaScript Number, yet native round returns 2 and 3 respectively.
The parser now retains that distinction. Separately,
`round(0.49999+0.000004)` stays 0, while `round(0.249996+0.249996)` becomes 1:
each operand must be converted before addition. No case-specific offsets exist.

## Commands and Parameters

| Area | Implemented or verified | Still outside this slice |
| --- | --- | --- |
| Numeric functions | `round`, `floor`, `ceil`, signed/zero inputs, near-half/near-integer boundaries; existing `int` distinction retained | Complete fixed precision for every nested math function and fractional division |
| Arguments | Exact decimal literals, string variables/constants, unary signs, `+`, `-`, `*`, integer `/`; bounded scientific tokens, invalid-input and dimension-overflow propagation | Full PGF long division/reciprocal algorithms, all scientific overflow recovery, arbitrary TeX expansion, lexical precision across all declared-function parameters |
| TikZ | `pgfmathsetmacro`, named `coordinate`, expression coordinates in `fill`/`node`; `draw`, `grid`, `foreach`, `circle (2pt)`, `below=2pt`, `anchor=west`, color mixing | Unrelated coordinates retain their existing arithmetic, intentionally |
| Plot control | `axis`, `addplot`, `use fpu`, `domain`, `samples`, explicit limits/ticks, `enlargelimits=false`, `grid=major`, `width`, `height`, `thick`, `dashed` | Full FPU mantissa/exponent semantics and the control's existing frame/grid/dash raster differences |
| Typography | Packaged MacTeX fonts; default browser and SVG-text export | Independent PDF/SVG rasterization equivalence |

## Visual Evidence

The two new coordinate controls are focused reproductions of the recorded
bug and installed manual semantics, not claimed as imported corpus drawings.
The PGFPlots control guards against accidentally quantizing floating plots.

| Case | Before | After |
| --- | --- | --- |
| `rounding-coordinate-boundaries` | Red round points were at -2/2 instead of -3/3; floor and ceil points each selected a neighboring grid column. | All six points and their labels return to native positions. All 77 glyph origins pass, maximum error 0.017870px at 3x. |
| `rounding-arithmetic-boundaries` | The green sum point was at 0 instead of 1. | It moves one grid column to 1; the red non-rounding-up control stays at 0 and the manual division example stays at 2. All 68 origins pass, maximum error 0.009482px at 3x. |
| `rounding-pgfplots-fpu-control` | Native FPU places the red round line at 2 and blue ceil line at 3. | Both remain there. Default-browser PNG SHA-256 is unchanged: `6ffd6e54f6ec694addb1ce478d13eaa99afb26f3bbba0211a3eb049a2fb19368`. Minor frame/grid/dash differences remain; this control is not newly accepted. |

Actual Chromium screenshots, both native SVG and independent native PDF PNGs,
and the difference sheets were inspected. Browser fonts were awaited before
capture. Registration uses one blue rectangle and fixed physical scale,
never individual label translations or rescaling. The original 0.09px glyph
tolerance is unchanged; the before errors were approximately 113.386px.

`command -v tikztosvg` found `/Library/TeX/texbin/tikztosvg`, version 0.3.0.
It used local pdfTeX; SVGs were rasterized with `rsvg-convert`. Separate PDFs
were rasterized with `pdftocairo`. No online installation was used. The existing
wrapper's classical-arrow-default restoration remains recorded in provenance.

The coordinate reference SVG has a `202.809pt` by `126.273pt` viewBox, explicit
glyph-outline `use` positions and nonzero-filled cubic circle paths, not HTML
or foreignObject text. For example, its red point centers are x=16.363281 and
186.445312 native SVG units. These source-derived positions confirm the actual
one-centimeter correction, independently of the pixel-diff score. The PDF
comparison still differs in text/raster edges even for tikztosvg itself;
those failures remain visible and have not been waived.

## Artifacts and Verification

Before: `outputs/qa/2026-10-29-rounding-before/`.
After: `outputs/qa/2026-10-29-rounding-after/`.

- `browser-audit.html`, `browser-audit.json`, `browser/`: default JS, local
  tikztosvg, SVG-text, before images and browser diffs.
- `tikzkit-svg/`, `tikzkit-png/`, `tikztosvg-svg/`, `tikztosvg-png/`:
  independently generated references and outputs.
- `mactex-png/`, `mactex-log/`, `native-rounding-boundaries.log`: independent
  native PDF rasterization and numeric probes.
- `diff/summary.json`, `diff/*-native-sheet.png`, `diff-png/`: unchanged raster gates.
- `rounding-before-tests.json`: 19 failures in the first 67 fail-first tests.
- `rounding-scientific-before.json`: subsequent scientific-boundary failures
  discovered before implementing the native scientific conversion (7 failures).
- `rounding-focused-final.json`: 394 related tests pass.
- `rounding-full-final.json`: 3333 pass, zero failures, 14 existing skips.

```sh
pdflatex -interaction=batchmode -halt-on-error -output-directory=/tmp test/fixtures/native-rounding-boundaries.tex
node --test test/pgf-rounding-boundaries.test.js test/pgf-native-math-angles.test.js test/runtime-math-safety.test.js test/pgfplots-seams.test.js
node --test --test-reporter=./scripts/module-test-reporter.js --test-reporter-destination=/tmp/rounding-full-final.json test/*.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/rounding-boundaries --output outputs/qa/2026-10-29-rounding-after --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --no-comparison-grid
node scripts/audit-module-regressions.js --fixtures test/fixtures/rounding-boundaries --output outputs/qa/2026-10-29-rounding-after --before outputs/qa/2026-10-29-rounding-before --browser-module "${PLAYWRIGHT_MODULE:?set this to the local Playwright index.mjs}"
node scripts/diff-example-pngs.js --output outputs/qa/2026-10-29-rounding-after --register
node --experimental-vm-modules scripts/check-architecture.js
node scripts/check-doc-links.js
git diff --check
```

## Next Work

The fractional-division/reciprocal item below is addressed in the subsequent
[native division follow-up](2026-10-29-native-division-reciprocal.md). General
nested-function precision and the separate raster gates remain open.

1. Extend source-backed fixed arithmetic to fractional division/reciprocal and
   nested functions, with fresh native probes before enabling it elsewhere.
2. Audit the PGFPlots control's border/grid/dash discrepancy independently of
   arithmetic; do not relax its failed raster gate.
3. Keep the PDF rasterization gate separate from browser glyph/geometry evidence.
   Passing one is not proof that the other is complete.
