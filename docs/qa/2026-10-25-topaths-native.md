# Native To-Path Geometry

## Scope and Status

This follow-up covers automatic `to` control distances, bare-node cubic
endpoints, curved-arrow shortening and independent self-loop edges. It does
not claim complete shape sizing, text layout or relative-curve compatibility.
The `topaths`, `arrows` and `bending` registry entries remain partial.

Full regression: **3,017 tests, 2,972 passed, 31 failed, 14 skipped, zero
cancelled**. The previous full result had 32 failures. The previously failing
`clips curved to-path arrows against node borders` now passes, with no newly
failing names. Six new regressions are additional coverage, not six resolved
old failures. The 479-test focused run has 474 passes and five existing
interpreter failures unrelated to this slice.

No npm login, release, version bump or remote push was performed.

## Local Source Review

Paths below are relative to `/usr/local/texlive/2025/texmf-dist/`.

| Source | Implementation detail |
| --- | --- |
| `tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytopaths.code.tex:130-375` | Control distance uses a quantized normal, integer division by its dominant component divided by 255, two factors of 16, then the 0.3915 dimension factor. It is not an exact Euclidean chord. Each side applies its own looseness and clamps. |
| `tex/generic/pgf/modules/pgfmoduleshapes.code.tex:487-500` | Numeric shape anchor angles pass through `pgfmathsetcounter`; their fractional part is truncated. Control offsets still use the original angle. |
| `tex/generic/pgf/frontendlayer/tikz/tikz.code.tex:3214-3255` | After constructing controls, curveC intersects bare endpoints toward those controls. Saved outer separation is not inflated again by half the connecting arrow's pen width. |
| `tex/generic/pgf/basiclayer/pgfcorepoints.code.tex:528-565,944` | Fixed-point De Casteljau interpolation and normalized point directions. |
| `tex/generic/pgf/math/pgfmathfunctions.trigonometric.code.tex:88-174` | Native cosine interpolation used by control-distance normalization. JS still uses atan2 for the angle; this is not a complete port of PGF atan. |
| `tex/generic/pgf/math/pgfmathfunctions.basic.code.tex:66-250` | Reciprocal and long division use TeX dimensions. Dividing by ten shifts the printed decimal digits, which matters at half-scaled-point boundaries. |
| `tex/generic/pgf/math/pgfmathfunctions.misc.code.tex:19-92` | Polynomial vector length and range scaling. |
| `tex/generic/pgf/libraries/pgflibrarycurvilinear.code.tex:67-263` and `tex/generic/pgf/modules/pgfmodulebending.code.tex` | Four-point physical-pt lookup, fixed-point quotient interpolation and cubic shortening. The fresh-table branch differs from repeated initialization because of TeX assignment scanning. Only fresh-table state is modeled here. |
| `tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex:947-1523` | Trapezium cotangent sides, minimum-size scaling and miter contour. Its remaining sizing drift is not hidden by the arrow tests. |
| `doc/generic/pgf/pgfmanual-en-library-edges.tex` | Relative versus absolute curve directions and control options. |

Reproducible numeric probes are [topaths-native-metrics.tex](../../test/fixtures/topaths-native-metrics.tex),
[topaths-shape-metrics.tex](../../test/fixtures/topaths-shape-metrics.tex) and
[arrow-curvilinear-metrics.tex](../../test/fixtures/arrow-curvilinear-metrics.tex).
Native examples include a 4cm chord control distance of 44.38303pt, a 3cm/4cm
chord distance of 55.64108pt, and the curvilinear quotient
`0.00839 / 1.07906 = 0.0077`. Short and far-distance time expectations were
retained rather than adjusted to the JS output.

## References and Visual Inspection

`command -v tikztosvg` resolves to `/Library/TeX/texbin/tikztosvg`.
All six [fixtures](../../test/fixtures/topaths-native/manifest.json) produce
TikZKit SVG/PNG, local tikztosvg SVG/PNG and independent MacTeX native PNG, with
zero diagnostics. SVG rasterization uses local `rsvg-convert`.

Artifacts are under `outputs/qa/2026-10-25-topaths-after/`: `tikzkit-svg/`,
`tikzkit-png/`, `tikztosvg-svg/`, `tikztosvg-png/`, `mactex-png/` and `browser/`.
`browser-audit.html` displays actual Chrome-rendered default JS, tikztosvg,
SVG-text, before and diff panels. All six final sheets and native PNGs were
inspected. The original-document MacTeX images agree with tikztosvg on the
geometry used for this comparison.

The native SVG uses cubic path data with explicit butt/round caps, joins and
tip paint, rather than SVG markers. Native nonzero fill/clip rules and y-flip
matrices were checked. Its viewBox retains physical point dimensions. Native
text is outlined; JS text remains a distinct source of glyph/baseline drift.
There are no foreignObjects involved in the arrow controls.

| Case | Visible result and remaining differences |
| --- | --- |
| topaths-control-distance | All six differently oriented colored curves now follow the native controls. The browser gate includes every colored stroke, not just the black arc. |
| core-to-modern-options | The two curved shafts now meet the native modern To tips with the native curvature. Straight variants remain unchanged. |
| topaths-node-borders | The thick blue arrow no longer floats away from the ellipse. Red explicit-anchor geometry remains separate. A/B glyphs, baselines and node text dimensions still differ. |
| topaths-fractional-loops | Both self-loop edges now have their own arrow; previously the left tip disappeared. Positive/negative fractional-angle curves retain their controls and recrop against the rectangles. Small node/crop differences remain. |
| graph-content-and-structure | Both bent connections retain their shape and meet nodes. Text, frame crop and horizontal placement differences remain visible, so the full graph is not accepted. |
| shape-curved-terminal-padding | Thick terminals meet diamond/star/trapezium borders instead of leaving added pen-width gaps. Trapezium width, text baselines and crop still differ visibly. |

The unchanged 0.12 CSS-pixel geometry gate at 3x display scale reports:

| Control | Before maximum | After maximum | Paths |
| --- | --- | --- | --- |
| topaths-control-distance | 0.366928px | 0.026627px | 6/6 |
| core-to-modern-options | 0.227916px | 0.080383px | 24/24 |

Default JS and SVG-text both pass these controls. Gates check path count,
sampled geometry, pen width, color, cap/join/dash and canvas dimensions without
post-hoc registration. They do not certify the text-bearing diagrams.
The before image for the newly added fractional-loops case is specifically
before the independent-loop-path fix; it already includes the control-distance
and fractional-angle changes. The other five before images predate this batch.

## Commands and Parameters Checked

| Surface | Status |
| --- | --- |
| `\node`, `\draw`, `\path`, `to`, `edge` | Shared path construction and bare/explicit node endpoints covered. Loop edges own separate style, shortening and arrow paint. |
| `out`, `in`, `bend left`, `bend right`, `looseness` | Automatic fixed-point distance and fractional absolute directions covered. Relative corner cases remain partial. |
| `loop above`, `looseness=5`, default loop looseness | Both loops render independent tips, using shared control distances. Other loop directions retain existing coverage. |
| `minimum size`, `minimum width/height`, `inner sep`, `outer sep` | Saved shape contour reused independently of connecting pen width. Trapezium minimum-size arithmetic remains incomplete. |
| `line width=4pt`, `thick`, `->`, `<->`, `-stealth`, modern To options | Border lookup precedes arrow shortening; native fresh-table distance lookup covered. Repeated-table state and nonlinear/polar bending remain partial. |
| Explicit anchors and controls, min/max distance | Existing focused regressions retained. No per-case coordinates added. Arbitrary custom templates/hooks are not claimed. |

## Tests and Changes

Runtime: `src/engine/pgf-fixed-math.js`, `src/engine/safe-expression.js`,
`src/engine/evaluate.js`, `src/tikz/libraries/topaths.js`,
`src/renderers/svg/arrowBending.js`. QA extends colored-stroke capture and adds
native probe/fixture/regression coverage.

Five old interpreter expectations encoded the removed extra pen padding or
exact Euclidean control distance. They were corrected using the native probes,
not counted as previously failing tests repaired. The empty zero-padding
trapezium probe was made nondegenerate because local PGF divides by zero there.
A registry-owner expectation was synchronized with the preceding arrow change;
that metadata correction is not a visual improvement.

```sh
node scripts/render-example-fixtures.js --fixtures test/fixtures/topaths-native --output outputs/qa/2026-10-25-topaths-after --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --strict-tikztosvg
node scripts/audit-module-regressions.js --fixtures test/fixtures/topaths-native --output outputs/qa/2026-10-25-topaths-after --before outputs/qa/2026-10-25-topaths-before --browser-module /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
node --test --test-reporter=./scripts/module-test-reporter.js --test-reporter-destination=outputs/qa/2026-10-25-topaths-after/test-final.json test/*.test.js
node --experimental-vm-modules scripts/check-architecture.js
node scripts/check-doc-links.js
```

The full 31-failure list remains in `test-final.json`. Continue with remaining
actual text/layout or component failures, and the known trapezium sizing issue;
the overall compatibility goal is not complete.
