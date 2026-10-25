# Core To Arrow Compatibility

## Scope and Status

This batch covers the shared classical `to` / `to reversed` family, the
library-dependent `To` alias, modern `Computer Modern Rightarrow`, and their
terminal placement. It was selected because default axis arrows visibly differed
in the school-book datavisualization case and a full regression still failed on
inline arrow geometry. Registry counts are 161 for `arrows`, 158 for
`arrows.meta`, 30 for `arrows.spaced`, and 3 for `bending`.

There is real visual improvement, but this batch is **not completely accepted**.
Seven of eight focused browser geometry controls pass. The extended modern
control retains a small automatic `to`-curve shaft discrepancy. The two real
diagrams retain text/legend differences outside the arrow family.

Full explicit regression: **3,011 tests, 2,965 passed, 32 failed, 14 skipped,
0 cancelled**. The preceding full baseline was 2,998 tests with 33 failures.
Exactly one previously failing name is resolved, with no newly failing names:
`renders TikZ arrow tips as inline paths and shortens stroked path endpoints`.
The 13 new tests are not counted as resolved old failures.

No npm login, publication, version bump, or remote push was performed.

## Local Source Review

All paths below are relative to `/usr/local/texlive/2025/texmf-dist/`.

| File | Implementation evidence |
| --- | --- |
| `tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`, especially 620-860 and 1048-1200 | Cached paint, logical tip/back/line endpoints, symbolic aliases, and distinct classical forward/reversed curves. Legacy quick paint does not supply an invented picture hull. |
| `tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex:664-766` | Computer Modern Rightarrow dependent dimensions, exact cubic controls, joins, harpoon, visual endpoints and hulls. |
| `tex/generic/pgf/libraries/pgflibraryarrows.spaced.code.tex:24-25` | Spaced variants compose the same classical arrow with an invisible space. |
| `tex/generic/pgf/libraries/pgflibraryarrows.code.tex:622-668` | Related half-arrow reversed paint; checked to avoid treating named reversal as a generic reflection. |
| `tex/generic/pgf/modules/pgfmodulebending.code.tex:38-80,138-176` | Cubic subdivision updates both controls, and flex aligns visual endpoints rather than always using the logical arrow length. |
| `tex/generic/pgf/libraries/pgflibrarycurvilinear.code.tex:35-280` | Distance lookup samples near one physical pt at t, 2t, 4t and 8t. Its far-distance secant and negative extension are not a true arc-length integral. |
| `tex/generic/pgf/basiclayer/pgfcorepoints.code.tex:528-562` and `pgfcorepathusage.code.tex` | De Casteljau controls and precise versus tangent-based shortening. |
| `tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarybending.code.tex` | Bending alone does not import arrows.meta. |
| `tex/generic/tikz-cd/tikzlibrarycd.code.tex:19` | tikz-cd imports arrows.meta and changes the default To alias. |
| `tex/latex/circuitikz/circuitikz.sty`, `tex/latex/tkz-euclide/tkz-euclide.sty`, `tex/latex/tkz-base/tkz-base.sty`, `tex/latex/tkz-fct/tkz-fct.sty` | Known transitive modern-arrow imports; tkz-fct uses tkz-base. |
| `doc/generic/pgf/pgfmanual-en-tikz-arrows.tex:2175` and `pgfmanual-en-library-arrows.tex` | To is classical without arrows.meta and modern with it; legacy arrows/spaced remain compatibility libraries. |
| `tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytopaths.code.tex:176-204` | Remaining shaft difference: native normalization uses fixed-point divisions before the 0.3915 control-distance factor; TikZKit still uses a Euclidean chord directly. |

Classical forward paint uses `d=.28pt+.3*w`, a `.8*w` round pen, tip end
`.21pt+.625*w`, back end `-.84pt-1.3*w`, and line end zero. The named reversed
declaration has different controls and endpoints. Modern To has independent
length/width/pen dimensions. Its round visual span is zero, so ordinary flex
uses the terminal tangent. SVG shear must transform the pen, not just points.

The numeric-only [MacTeX probe](../../test/fixtures/arrow-curvilinear-metrics.tex)
reports times -0.0039, 0.00392, 0.01186, 0.04028 and 0.34384 for distances
-1pt, 1pt, 3pt, 10pt and 3cm on the declared cubic. The last value is deliberately
not the mathematically exact half-arc time. Regression expectations follow this
native evidence, while browser thresholds remain unchanged.

## Reference Integrity

`command -v tikztosvg` found `/Library/TeX/texbin/tikztosvg` (0.3.0).
It unconditionally imports `tikz-cd`, even when the original document does not.
That silently changes To to the modern arrow and makes an uncorrected SVG an
invalid classical-arrow reference.

The QA wrapper restores `To/.tip=to` **before replaying source declarations**
only for sources without known modern-arrow imports. It never overwrites a
source-defined alias afterward. The transformation is recorded as
`restore-source-classical-To-default-after-tikztosvg-extra-tikz-cd` in provenance.
Original-document MacTeX PNGs remain independent and authoritative. Before
artifacts retain the original wrapper behavior for inspection.

All 10 fixtures produced JS SVG/PNG, tikztosvg SVG/PNG and MacTeX PNG with zero
diagnostics. SVGs were rasterized locally with rsvg-convert. Browser comparison
uses actual Chrome paths and screenshots, not only exported PNGs. Native SVG
arrows are stroked cubic paths, not markers or text/foreignObject content; caps,
joins, dashed shafts versus solid tips, affine transforms and viewBox bounds
were checked. Fill rules and font sizes do not control these open stroked tips.

## Commands and Options

| Surface | Checked behavior and limit |
| --- | --- |
| `\usepackage`, `\usetikzlibrary` | Known modern-arrow imports select To; `bending` alone preserves classical To. Arbitrary custom dependency/load order remains partial. |
| `\draw`, `\path`, `--`, `to`, `edge` | Inline tips at either end, on straight/rotated/node-to-node paths. Automatic to-curve distance is still approximate. |
| `->`, `<-`, `<->`, `>=To`, `-to`, `-{to reversed}` | Exact supported forward/reversed family geometry and shortening. |
| Explicit `{> >}-` and ending sequences | Written symbolic direction, start sequence order and `sep` assembly. A start-side `>` points inward. |
| `line width`, `thick`, `dashed`, `shorten <=`, `shorten >=` | Native pen dependency, solid arrow paint, explicit and tip-induced shortening. |
| `To[length=...,width=...,width'=...,line width=...,line width'=...]` | Modern dependent dimensions remain distinct from classical to, which ignores modern-only sizing. |
| `scale`, `scale length`, `scale width`, `round`, `sharp` | Independent dimensions and source cap/join rules. |
| `harpoon`, `reversed`, `swap`, `slant` | Exact source branches; affine slant also transforms the pen. |
| `flex`, `flex'`, `bend` | Shared physical-point distance table, visual versus logical endpoints, cubic shaft subdivision. Arbitrary nonlinear/polar bending is not complete. |
| Legacy cached paint | Native crop behavior, without a fabricated arrow hull. |

## Actual Visual Comparison

The [fixture manifest](../../test/fixtures/core-to-arrows/manifest.json) defines
eight focused controls plus two real diagrams. Every generated sheet was
inspected. The 0.12 CSS-pixel browser gate is at 3x display scale and performs
no post-hoc translation or resizing; it checks sampled paths, count, pen widths
in four directions, cap/join/dash and canvas size. It only certifies the selected
black stroked controls, not all content in arbitrary diagrams.

| Case | Before/after observation | Gate |
| --- | --- | --- |
| core-to-widths | Thin arrows no longer use a short fitted shape; scaled modern and unscaled legacy tips remain distinct. | Pass, max 0.015px |
| core-to-sequences | The start sequence now points inward as written; spacing uses native tip/back extents. | Pass, max 0.012px |
| core-to-directions | Rotated and named reversed tips retain their source curves and attachment offsets. | Pass, max 0.051px |
| core-to-crop | Removed invented picture padding; original classical arrow clipping matches MacTeX. | Pass, max 0.029px |
| core-to-bending-default | Bending no longer accidentally selects modern To. | Pass, max 0.027px |
| core-to-package-circuitikz | Package import selects the native modern arrow. | Pass, max 0.024px |
| core-to-package-tkz-euclide | Same transitive-import correction. | Pass, max 0.024px |
| core-to-modern-options | Slanted tips now shear the pen correctly; curved shafts retain both controls during shortening. Arrow paths are within 0.079px, but two shaft paths differ by up to 0.228px. | **Fail**, unchanged 0.12px threshold |
| datavis-school-book-ticks | Axis arrow shape and crop improved. Legend sample/text alignment and width still differ. | Whole case not accepted |
| commutative-diagram | Arrow endpoints/curves improved. Plain-text baselines and some Theta labels remain displaced. | Whole case not accepted |

The extended options control improved from a 4.54px slanted-pen discrepancy,
then a 1.90px curved-shaft discrepancy, to the current 0.228px residual. Its
failed gate is preserved, not changed to a passing assertion. Raster edge
antialiasing is separately visible in diff sheets and is not the explanation
for the remaining control-distance mismatch.

## Files and Verification

Runtime changes are in `src/engine/options.js`, `src/engine/evaluate.js`,
`src/tikz/metrics.js`, the arrows library modules, and SVG
`paths.js`, `arrowBending.js`, `bounds.js`. QA adds browser arrow metrics and
reference provenance; regressions cover semantic geometry, aliases, source
options, native numerical probes and deliberate gate failures.

Existing renderer expectations were updated only where the local declarations
contradicted them: exact cubic coefficients, tip offsets, sequence direction
and legacy quick-paint bounds. The diagonal interpreter expectation now uses
the same source-defined classical tip extent. No assertion was simply removed.

```sh
node --test test/arrows-*.test.js test/browser-arrow-metrics.test.js test/example-render-script.test.js
node --test --test-reporter=./scripts/module-test-reporter.js --test-reporter-destination=outputs/qa/2026-10-25-core-to-after/test-final.json test/*.test.js
node --experimental-vm-modules scripts/check-architecture.js
node scripts/check-doc-links.js
```

Focused result: **201/201 pass**. Architecture check passes (474 modules) with
one existing text-to-frontend dependency debt. Full tests remain red as listed
above. Bare `npm test` also discovers argument-dependent fixture probes; the
explicit `test/*.test.js` run is the consistent full-suite baseline here.

Reproduce native images and browser audit:

```sh
node scripts/render-example-fixtures.js --fixtures test/fixtures/core-to-arrows --output outputs/qa/2026-10-25-core-to-after --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --strict-tikztosvg
node scripts/audit-module-regressions.js --fixtures test/fixtures/core-to-arrows --output outputs/qa/2026-10-25-core-to-after --before outputs/qa/2026-10-25-core-to-before --browser-module /absolute/path/to/playwright/index.mjs
pdflatex -interaction=nonstopmode -halt-on-error -output-directory=outputs/qa/2026-10-25-core-to-after test/fixtures/arrow-curvilinear-metrics.tex
```

The browser audit currently exits nonzero for the documented modern-options
shaft residual. This is intentional reporting, not an accepted discrepancy.

Local artifacts are under `outputs/qa/2026-10-25-core-to-after/`:
`browser-audit.html`, `browser-audit.json`, `browser-gates.json`, `browser/`,
`tikzkit-svg/`, `tikzkit-png/`, `tikztosvg-svg/`, `tikztosvg-png/`, `mactex-png/`,
`arrow-curvilinear-metrics.log`, `arrow-tests.json`, and `test-final.json`.
These generated outputs are local, not promised as GitHub-hosted files.

## Next Work

1. Port native `tikz@to@compute@distance@main` fixed-point normalization and
   verify a range of curved/node-border paths, not just the current horizontal
   chord. Do not substitute an empirical constant to make this control pass.
2. Resolve real school-book legend and commutative-diagram text placement.
3. Continue the remaining 32 full-test failures with independent native evidence.
