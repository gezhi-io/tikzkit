# Native PGF Division and Reciprocal

## Scope and Status

This continues the fractional-division TODO in
[rounding boundaries](2026-10-29-native-rounding-boundaries.md). The scope is
ordinary `/`, `divide`, `div` and `reciprocal`, including their use in macros,
coordinates and rounding arguments. It is not complete PGF math or FPU support.

**Visible improvement:** `floor(0.9/0.3)` moves from the wrong x=2 column to
native x=3. Four missing reciprocal-dependent points and labels now render.
The three coordinate/layout SVG PNG comparisons pass existing thresholds;
189 browser glyph origins pass without changing the 0.09px-at-3x tolerance.
All 288 independent numeric probes agree with local MacTeX. There are no new
diagnostics. The formal suite is **3419 passed, 0 failed, 14 unchanged skips**,
including 86 new tests; 480 focused tests pass.

**Whole-image acceptance is still open.** The unchanged PGFPlots control has
existing frame/grid/dash raster differences. Independent native-PDF raster
comparisons also fail, including tikztosvg versus the same PDF. These failed
gates remain recorded, not waived or presented as fully accepted cases.

No version change, commit, GitHub push or npm publication was performed.
Earlier worktree changes were preserved.

## MacTeX Source Review

Paths are relative to `/usr/local/texlive/2025/texmf-dist/`.

| File | Implementation rule |
| --- | --- |
| `tex/generic/pgf/math/pgfmathfunctions.basic.code.tex`, lines 60-109 | `divide` scans both arguments into scaled dimensions. Integer divisors use truncating TeX division. Fractional divisors below 1 multiply by a native reciprocal; others use long division after separating the sign. |
| Same file, lines 113-207 | Long division stops at a one-sp remainder/divisor. Dividing the divisor by ten shifts its **printed decimal digits**. A digit exceeding 9 carries through a dimension addition and special trailing-zero removal. |
| Same file, lines 210-274 | `reciprocal` has an integer branch, five-decimal conversion with four successive `.1` multiplications, and a three-decimal branch when the positive integer part exceeds 100. The negative branch is not symmetric for large arguments. |
| Same file, lines 277-293 | `div` first invokes native division, then truncates using floor/ceil, rather than truncating an IEEE quotient. |
| `doc/generic/knuth-pdf/tex/tex.pdf`, TeX82 sections 102/103/452 | Decimal scanning and shortest round-tripping `print_scaled` tokens. The existing shared `dimensionDecimal` printer is reused with finite/range guards. |
| `doc/generic/pgf/pgfmanual-en-math-parsing.tex`, division examples | The installed manual demonstrates `divide(75,6)`. This and signed/integer controls are retained in the numeric probe. |
| `doc/generic/pgf/pgfmanual-en-tikz-plots.tex`, function/gnuplot section | `plot function` is gnuplot syntax. Its division must not inherit ordinary PGF dimension limits, especially for large gamma intermediates. |

MacTeX returns `1/1.5 = 0.6667` but `reciprocal(1.5) = 0.66675`.
It also returns `4.99999/2.5 = 2.001` after native carry handling. These are
compatibility targets, not attempts to improve mathematical accuracy.
Replacing both operations with `1/x` or one rounded double is incorrect.

## Implementation and Tests

- `src/engine/pgf-fixed-point.js`: bounded dimension-based division and
  reciprocal, exact decimal carry, native signed branches and guarded shared
  TeX printing. No case-specific positions or coordinate adjustments.
- `src/engine/safe-expression.js`: numeric functions and the `/` AST operator
  consume fixed arguments, including nested arithmetic and variables, and
  return native printed values. Rounding, safety and resource limits remain.
- `src/engine/math.js`: forwards arithmetic options to the restricted evaluator.
- `src/engine/evaluate.js`: gnuplot-compatible `plot function` division stays
  floating. The existing exact-radian JS-trig route likewise retains floating
  infix division. This is not a claim of native fixed transcendental parity.
- `src/packages/pgfmath.js`, registry MD/CSV: updated while retaining `partial`.
- `test/pgf-division-reciprocal.test.js`: native values, actual scene coordinates,
  declarations, macros, FPU isolation, invalid/overflow cases, accessor protection
  and round-trip checks across every fractional sp in [-1,1].

The initial 76-test fail-first run had 67 failures. Expected values come from
[80 native probes](../../test/fixtures/native-division-reciprocal.tex), not JS.
An independent [208-expression signed cross-product](../../test/fixtures/native-division-grid.tex)
is checked against its saved [MacTeX results](../../test/fixtures/native-division-grid.json).

Three existing interpreter expectations assumed ideal IEEE arithmetic. The
native probe independently establishes `1/(1+exp(5*0.4)) = 0.1192`,
`(1980-1975)/3 = 1.66666`, and the pre-picture spacing `2/(4-1) = 0.66666`.
Those exact expected values replace the float assumptions. No tolerances were
loosened. A fresh calc/timeline/basis browser control validates these changes.
The gamma-plot failure was an implementation regression, fixed in the evaluator;
its original test assertions remain unchanged.

## Command and Parameter Coverage

| Area | Implemented or verified | Remaining boundary |
| --- | --- | --- |
| Arithmetic | `/`, `divide(a,b)`, `div(a,b)`, `reciprocal(a)`, signs, integer/fractional divisors, carry, small remainders, nested reciprocals, dimension overflow and zero errors | Complete fixed precision for other functions and all intermediate expressions; standalone low-level `\pgfmathdivide`/`\pgfmathreciprocal` commands are not added by this slice |
| Operands | Literal decimal tokens, bounded scientific literals, string/numeric variables, macro substitution, declared functions, `+ - * /` inside the fixed arguments | Arbitrary TeX expansion, full dimension-unit parsing in math expressions, token precision through every declared-function parameter |
| Placement | `\pgfmathsetmacro`, named coordinates, expression coordinates, `calc` scalar multiplication, `\tikzdeclarecoordinatesystem`, `\pgfpointxy`, pre-picture macros, `x=<macro> cm`, `yshift`, `++` | Existing geometry-specific arithmetic in bending, polar ticks and 3D scaling was not replaced or newly accepted |
| Drawing | `\draw`, `\fill`, `\node`, `\foreach`, `grid`, `rectangle`, `circle (2pt)`, `above=2pt`, `below`, `anchor=west`, named colors and color mixing | Unrelated libraries are not expanded |
| Plot mode | `axis`, `addplot`, `use fpu`, `domain`, `samples`, explicit min/max/ticks, `width`, `height`, `enlargelimits=false`, `grid=major`, `thick`, `dashed`; default FPU remains floating | Full FPU mantissa/exponent parity and pre-existing frame/grid/dash differences |
| Text | Packaged MacTeX fonts, inline math, `\exp`, `\cdot`, `\mathrm`; actual default browser and SVG-text render paths | Pixel-identical PDF and SVG rasterization is not established |

## Actual Browser and Native Comparison

Four actual Chromium cases were inspected, with local fonts loaded before
capture. Default JS, local tikztosvg and SVG-text are shown separately. The
two changed fixtures also show the saved pre-repair output. No native artwork
is substituted into JS SVGs. One blue frame sets a common origin at fixed
physical scale; individual labels are never moved to improve the score.

| Case | Visible result | Browser glyph check |
| --- | --- | --- |
| `division-coordinate-boundaries` | Black point d and its label move from column 2 to 3, matching native. The red/green/orange carry controls stay at native columns 3/2/1. | 74 origins; maximum error 0.014423px at 3x |
| `reciprocal-coordinate-boundaries` | Four previously absent points/labels appear at native coordinates: about 3.33337, 1.4286, 3 and 0.29999. Diagnostics drop from 5 to 0. | 87 origins; maximum error 0.020508px at 3x |
| `division-layout-controls` | Timeline ticks/year labels, green macro-scaled basis lines and red calc-expression point agree. This guards the three native expectation corrections. | 28 origins; maximum error 0.016292px at 3x |
| `division-pgfplots-fpu-control` | Red line stays at y=2 and blue line at y=3.333333...; default FPU is not quantized by the ordinary PGF repair. Existing frame/grid/dash raster differences remain. | Control, not newly accepted |

The FPU-control JS SVG is byte-identical before/after: SHA-256
`884dc1b3c592dd1a4772526447f12f256e1d348f3114188d9c8fdafcf12c6672`.

`command -v tikztosvg` found `/Library/TeX/texbin/tikztosvg` (0.3.0).
References use local pdfTeX; `rsvg-convert` generates their PNGs. Separate
MacTeX PDFs use `pdftocairo`. No online installation was needed. The existing
wrapper's classical-arrow-default restoration is recorded in provenance.

The reference SVGs use outlined glyph `use` elements and cubic circle paths
with nonzero fill, not browser foreignObject text. In the division fixture,
native point d is centered at x=101.40625 SVG units, the same x as point a;
the old JS output put d one grid interval to the left. In the reciprocal
fixture, native point a is at x=110.855469 and b at x=56.863281. This geometry
corroborates the actual screenshots independently of average pixel errors.

Native PDF, JS, tikztosvg and difference sheets were inspected. Their main
remaining PDF differences are stroke/glyph raster edges rather than the
repaired point placements. The strict independent-PDF gate remains failed;
the PNG acceptance threshold was not changed.

## Artifacts and Reproduction

Before: `outputs/qa/2026-10-29-division-before/`.
After: `outputs/qa/2026-10-29-division-after/`.

- `browser-audit.html`, `browser-audit.json`, `browser/`: actual browser renders,
  before panels, glyph measurements and diff sheets.
- `tikzkit-svg/`, `tikzkit-png/`, `tikztosvg-svg/`, `tikztosvg-png/`:
  independent JS and reference exports.
- `mactex-png/`, `mactex-log/`, `diff/summary.json`, `diff/*-native-sheet.png`:
  native PDF evidence and unchanged acceptance gates.
- `native-division-reciprocal.log`, `native-division-grid.log`: 288 independent
  numeric results.
- `pgf-division-before.json`, `pgf-division-focused-final.json`,
  `pgf-division-full-final.json`: fail-first and verification reports.

```sh
pdflatex -interaction=batchmode -halt-on-error -output-directory=/tmp test/fixtures/native-division-reciprocal.tex
pdflatex -interaction=batchmode -halt-on-error -output-directory=/tmp test/fixtures/native-division-grid.tex
node --test test/pgf-division-reciprocal.test.js test/pgf-rounding-boundaries.test.js test/runtime-math-safety.test.js test/pgf-native-math-angles.test.js test/pgfplots-seams.test.js
node --test --test-reporter=./scripts/module-test-reporter.js --test-reporter-destination=/tmp/pgf-division-full-final.json test/*.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/division-reciprocal --output outputs/qa/2026-10-29-division-after --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --no-comparison-grid
node scripts/audit-module-regressions.js --fixtures test/fixtures/division-reciprocal --output outputs/qa/2026-10-29-division-after --before outputs/qa/2026-10-29-division-before --browser-module "${PLAYWRIGHT_MODULE:?set this to the local Playwright index.mjs}"
node scripts/diff-example-pngs.js --output outputs/qa/2026-10-29-division-after --register
node --experimental-vm-modules scripts/check-architecture.js
node scripts/check-doc-links.js
git diff --check
```

## Next Work

Follow-up: [PGFPlots box paint and physical coordinates](2026-10-29-pgfplots-box-paint.md)
addresses item 3's browser frame/grid/dash issue. The independent PDF raster
gate remains open; the observations above describe this earlier checkpoint.

1. Audit nested fixed transcendental/function precision and dimension-bearing
   expressions with independent probes before expanding the arithmetic scope.
2. Evaluate migration of geometry-specific legacy division helpers separately,
   with bending, polar and 3D browser controls, not an unverified global rewrite.
3. Investigate the pre-existing FPU control's border/grid/dash mismatch and keep
   independent-PDF raster acceptance separate from browser geometry evidence.
