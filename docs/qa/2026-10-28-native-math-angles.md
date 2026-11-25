# Native Signed Math and Angle Painting

## Scope and Status

This repair covers signed `round`/`mod`/`Mod` and the `angles` library's
default label placement and fill/stroke layers. It does not claim complete
PGF arithmetic or all pic options. Both registry entries remain `partial`.
No version bump, npm publication or remote push was performed.

The full explicit test collection passes: **3158 passed, 0 failed, 14 existing
skips**. Thirty-nine focused regressions were added. They were exercised
before the implementation; native-evidence corrections to two old numeric
expectations are distinguished from the new regression coverage below.

## Local Sources

Paths are relative to `/usr/local/texlive/2025/texmf-dist/`.

| File read | Implementation rule |
| --- | --- |
| `tex/generic/pgf/math/pgfmathfunctions.round.code.tex` | Round the magnitude at a half, then restore the sign. JavaScript `Math.round(-2.5)` is not PGF `round(-2.5)`. |
| `tex/generic/pgf/math/pgfmathfunctions.basic.code.tex` | `div` truncates toward zero. `mod` subtracts that quotient times the divisor; `Mod` adds the divisor once if the remainder is negative. This also explains negative-divisor behavior. |
| `tex/generic/pgf/libraries/pgflibraryfpu.code.tex` | FPU rounding uses the number printer with precision zero; remainder uses quotient, multiplication and subtraction. Native integer controls agree with ordinary PGF. |
| `tex/latex/pgf/math/pgfmath.sty` | The package loads the shared PGF math layer. The probe loads `pgf` as well, providing the backend conversion needed by FPU remainder. |
| `tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryangles.code.tex` | Radius defaults to 5mm, eccentricity to 0.6; a nonpositive radius falls back to 12pt. Background fills close through the vertex, foreground strokes include only the arc or outer right-angle sides. Right-angle text multiplies its radius by sqrt(2). |
| `tex/generic/pgf/frontendlayer/tikz/tikz.code.tex` | Pic backgrounds and foregrounds use separate boxes around the parent path's paint operation. A sector fill must not erase crossing edges. |
| `doc/generic/pgf/pgfmanual-en-library-angles.tex` | Confirms the default parameters, counterclockwise sweep, independent actions and remaining named-pic/text features. |

The reproducible native probe is
[`native-math-probe.tex`](../../test/fixtures/native-math-probe.tex).
Its log is retained in the after directory. In both ordinary and FPU modes,
`round(-2.5)=-3` and `mod(-5,3)=-2`. Ordinary `Mod(-5,3)=1`,
`mod(5,-3)=2` and `Mod(-5,-3)=-5` are also explicitly checked.

## Commands and Parameters

| Area | Implemented or checked here | Still not certified |
| --- | --- | --- |
| Math | `round`, `div`-based `mod`, distinct `Mod`, positive/negative/zero inputs, `\pgfmathsetmacro`, named coordinates, PGFPlots expression reuse, invalid input propagation | Complete scaled-point boundary quantization, fractional FPU arithmetic, every PGF math function |
| Angle pics | `\pic`, inline `pic`, `angle=A--O--B`, `right angle=A--O--B`, quoted math labels, CCW/reflex sweeps, `angle radius`, `angle eccentricity`, named styles, path/picture inheritance | Bare default `angle` body, named-pic anchors, arbitrary pic transforms and text options |
| Paint | `draw`, `draw=none`, `fill`, color mixes, separate closed fill/open stroke, foreground arrows not applied to fills, parent path and edge ordering | Shade-only actions, general custom pic rendering |
| Real diagram controls | `calc` interpolation, intersection coordinates, three crossing edges, four labels, colored mixed paragraph, rounded filled node and existing wrapping | No new general paragraph/font compatibility is claimed |

## Visible Changes

| Case | Before | After and actual browser evidence |
| --- | --- | --- |
| `native-numeric-semantics` | Blue point was at -2 instead of -3; red point at +1 instead of -2. | Both points move to native coordinates in the browser, not just the export. The grid/axis scale is unchanged. Function-name text still differs in font/spacing; this whole case is **not accepted**. |
| `angle-paint-actions` | Filled angles also stroked radial edges; fill-only and `draw=none` pics gained black outlines. Default quotes sat too far out. | Only requested arcs/square sides are outlined, four Greek labels use native positions, and fill-only shapes remain unoutlined. All four browser glyph origins pass the existing 0.09px-at-3x gate; maximum error is about 0.00172px versus 6.8033px before. |
| `angles-parallel-paragraph` | Labels used eccentricity 0.65; closed sectors added radial ink. | Default labels move to 0.6, radial borders disappear, and the black crossing line remains visible through colored sectors. The three-line paragraph is retained. All seven native open strokes pass the existing 0.12px-at-3x gate; maximum sampled error is about 0.0282px. |

Both normal browser conversion and exported SVG-text were checked. Packaged
MacTeX fonts were loaded before screenshotting. Browser checks ran in an
authorized isolated Chromium runner using `setContent`, not by bypassing the
denied in-app `file://` navigation. The before images remain untouched.

The angle control uses its blue frame for native glyph alignment. The existing
arrow checker was tried but is not applicable to that closed rectangle: its
ordered arc-length samples depend on the starting corner and winding, which
differ between equivalent JS/native rectangles. It is therefore not configured
for this control. The independent PNG check remains active, and the real
parallel diagram retains all seven open-stroke comparisons. No existing
threshold or assertion was weakened to hide a visible discrepancy.

## References and Artifacts

`command -v tikztosvg` found `/Library/TeX/texbin/tikztosvg`, version 0.3.0.
Each of the three fixtures was compiled with local `tikztosvg` using
`pdflatex`, then rasterized with `rsvg-convert`. An independent native PDF
was also compiled with MacTeX and rasterized using `pdftocairo`.

Before: `outputs/qa/2026-10-28-native-math-angles-before/`.
After: `outputs/qa/2026-10-28-native-math-angles-after/`.

- `browser-audit.html`, `browser-audit.json`, `browser/`: actual browser
  default-JS/reference/SVG-text, before and diff panels.
- `tikzkit-svg/`, `tikzkit-png/`: genuine JS output.
- `tikztosvg-svg/`, `tikztosvg-png/`: independent SVG references and PNGs.
- `mactex-png/`, `mactex-log/`: native PDF raster and compile evidence.
- `diff/summary.json`, `diff-png/`: registered comparisons and four-way sheets.
- `full-tests.json`: unmodified full test result.

Native SVG structure was inspected: closed nonzero-fill sectors and separate
open arc paths, 0.3985pt default strokes, butt caps/miter joins, y-flipping
transforms, physical viewBoxes and path-glyph `<use>` elements. JS does not
substitute those SVGs or reference images for its own rendering.

## Remaining Gaps

Follow-up: [native operators and edge-local paint](2026-10-28-native-operators-edge-scope.md)
repairs the operator typography and ordinary inline-edge style leak described
below. The numeric JS/tikztosvg pair now passes (25 differing pixels), and the
new browser glyph/edge controls pass. The following figures describe the
original checkpoint; the independent native-PDF and numeric precision gaps
are still open.

The two angle JS/tikztosvg PNG pairs pass unchanged thresholds: five pixels
differ in the isolated control and 186 in the real diagram. The numeric
fixture retains 877 differing pixels, including the visible `\operatorname`
font/spacing mismatch. It is intentionally left visible in the fixture.

**Independent native-PDF pixel acceptance remains open for all three cases.**
The native raster differs even from tikztosvg rasterization at the same scale;
for the angle control, JS/native and tikztosvg/native changed-pixel ratios are
about 6.20% and 6.23%. These differences were not waived or labeled identical.
Geometry and browser evidence above establish the bounded repairs, not
universal whole-image acceptance.

Native fixed-point rounding near half boundaries is also outside this slice:
MacTeX quantizes `round(-2.499999)` to -3, while the JS double evaluator gives
-2. A follow-up should implement that numeric precision boundary separately.
The [2026-10-29 rounding follow-up](2026-10-29-native-rounding-boundaries.md)
now resolves this boundary for ordinary round/floor/ceil arguments and bounded
intermediate arithmetic, while retaining the distinct PGFPlots FPU behavior.
General fixed-point expression evaluation remains partial.
An existing inline-edge color leak into the enclosing path was noticed while
testing layer order; it is not repaired by this change. Next useful slices
are native operator-name text boxes, then edge-local style restoration.

## Verification and Changed Files

```sh
pdflatex -interaction=nonstopmode -halt-on-error -output-directory=outputs/qa/2026-10-28-native-math-angles-after/mactex-log test/fixtures/native-math-probe.tex
node --test test/pgf-native-math-angles.test.js test/runtime-math-safety.test.js test/interpreter.test.js
node --test --test-reporter=./scripts/module-test-reporter.js --test-reporter-destination=/tmp/tikzkit-20261028-full-final.json test/*.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/native-math-angles --output outputs/qa/2026-10-28-native-math-angles-after --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --no-comparison-grid
node scripts/audit-module-regressions.js --fixtures test/fixtures/native-math-angles --output outputs/qa/2026-10-28-native-math-angles-after --before outputs/qa/2026-10-28-native-math-angles-before --browser-module "${PLAYWRIGHT_MODULE:?set this to the local Playwright index.mjs}"
node scripts/diff-example-pngs.js --output outputs/qa/2026-10-28-native-math-angles-after --register
node --experimental-vm-modules scripts/check-architecture.js
node scripts/check-doc-links.js
git diff --check
```

Implementation: `src/engine/safe-expression.js`, `src/engine/math.js`,
`src/engine/evaluate.js`. Metadata: `src/packages/pgfmath.js`,
`src/tikz/libraries/angles.js`, extension registry Markdown/CSV.
Tests: the new focused test and fixture directory, plus source-backed changes
in `test/runtime-math-safety.test.js` and `test/interpreter.test.js`.
The latter now checks both paint layers instead of assuming one closed path.
