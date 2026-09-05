# arrows.meta Arc Barb and Parenthesis QA

## Scope

This slice implements `Arc Barb` and the source-defined `Parenthesis` alias. It covers dependent `length`, `width`/`width'`, and `line width`, plus `arc`, `harpoon`, `left`, `right`, `swap`, `reversed`, `round`, `sharp`, `slant`, independent length/width scaling, exact shaft shortening, and source hull bounds. `Tee Barb` is intentionally outside this slice.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex`: Arc Barb defaults, setup extents, hull points, drawing program, and `Parenthesis` alias.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`: deferred line-width dimensions, reversal, harpoons, swaps, assembly, and shaft shortening.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepathconstruct.code.tex`: PGF arc splitting and cubic Bezier constants.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-arrows.tex`: public Arc Barb and Parenthesis options and examples.

The source first resolves dimensions against the active outer line width. It subtracts half the arrow stroke from the x radius and one arrow stroke from the full y diameter, then draws an elliptical arc. Arcs larger than 90 degrees are split exactly as PGF does: a 90-degree chunk when more than 115 degrees remain, otherwise a 60-degree chunk. Parenthesis expands to `Arc Barb[arc=+120,length=+1.725pt +2.3]`.

## Real visual driver

Fixture: `test/fixtures/examples/arrows/meta-arc-barb-parenthesis-state-estimator.tex`

The picture combines a curved state-estimator flow, a mathematical interval with Parenthesis tips, and two one-sided physical vectors. Its review file audits 12 commands, 28 option entries, and 63 numeric items against local TeX Live sources with no TODO or blocker.

Before the fix, Arc Barb used an empirical two-curve fallback with no source extents or shaft shortening. The flow tips and physical vectors looked like straight open arrowheads, the left interval delimiter looked like a `K`, and stems reached into the tips. After the fix, all six tips are connected elliptical cubics: the flow tips follow terminal tangents, Parenthesis has the native bowed silhouette, one-sided harpoons retain the requested side, and stems stop at the PGF line end.

## Reference artifacts

- Before: `outputs/qa-arrows-meta-arc-barb-2026-09-05-before`
- After: `outputs/qa-arrows-meta-arc-barb-2026-09-05-after`
- TikZKit SVG/PNG: `tikzkit-svg/` and `tikzkit-png/`
- tikztosvg SVG/PNG: `tikztosvg-svg/` and `tikztosvg-png/`
- MacTeX PNG: `mactex-png/`
- Four-panel visual sheet: `diff/arrows-meta-arc-barb-parenthesis-state-estimator-native-sheet.png`

Local `tikztosvg` emits standalone stroked cubic paths rather than SVG markers. Its Arc Barb paths use `fill="none"`, source stroke widths, butt/miter or round/round cap/join pairs, and affine transforms for terminal tangent placement. TikZKit now follows the same structure. MacTeX remains authoritative; tikztosvg and MacTeX agree on the relevant arrow silhouettes.

## Verification

- `node --test test/arrows-meta-arc-barb.test.js`
- `node --test test/arrows-meta-arc-barb.test.js test/arrows-meta-straight-barb.test.js test/arrows-meta-bending.test.js`
- `node scripts/case-semantic-audit.js test/fixtures/examples/arrows/meta-arc-barb-parenthesis-state-estimator.tex --review test/fixtures/examples/arrows/meta-arc-barb-parenthesis-state-estimator.review.json --strict`
- `node scripts/render-example-fixtures.js --output outputs/qa-arrows-meta-arc-barb-2026-09-05-after --only arrows-meta-arc-barb-parenthesis-state-estimator --strict-tikztosvg --native-reference`
- `node scripts/diff-example-pngs.js --output outputs/qa-arrows-meta-arc-barb-2026-09-05-after`

## Remaining limitations

`Tee Barb`, arbitrary setup-code keys, polar bending declarations, repeated `reversed` cancellation, arbitrary pgfmath expressions in `arc`, and arbitrary user-declared names inside composite sequences remain partial.
