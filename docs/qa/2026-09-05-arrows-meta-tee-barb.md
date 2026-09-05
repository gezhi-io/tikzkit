# arrows.meta Tee Barb QA

## Scope

This slice implements `Tee Barb` and its source-defined `Bar` and `Bracket` aliases. It covers dependent `length`, `width`/`width'`, `inset`/`inset'`, and `line width`, plus the three source path branches, `harpoon`, `left`, `right`, `swap`, `reversed`, `round`, `sharp`, `slant`, independent length/width scaling, double-line dimensions, exact shaft shortening, visual ends, and hull bounds.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex`: Tee Barb defaults, setup extents, hull points, drawing branches, and the `Bar` and `Bracket` aliases.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`: deferred dimensions, outer double-line width, reversal, harpoons, swaps, assembly, and shaft shortening.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-arrows.tex`: public Tee Barb controls and paint semantics.

The default dimensions are `length=+1.5pt 2`, `width=+3pt 4`, `inset'=+0pt .5`, and `line width=+0pt 1 1`. At a `0.4pt` path width this yields a `2.3pt` length, `4.6pt` width, `1.15pt` inset, and `0.4pt` arrow stroke. The source clamps the front and back to half the arrow stroke, then chooses a single vertical line for `Bar`, one connected bracket path for `Bracket`, or three independent subpaths for ordinary Tee Barb. It always strokes with a cleared dash pattern; `open` and `fill` have no effect.

## Real visual driver

Fixture: `test/fixtures/examples/arrows/meta-tee-barb-controls.tex`

The picture combines a three-stage flowchart, a mathematical interval, and two physical vectors. Its review audits 14 commands, 33 option entries, two declarations, and 60 numeric items against local TeX Live sources with no TODO or blocker.

Before the fix, TikZKit used three empirical diagonal segments and no shaft shortening. Flow tips and physical vectors looked like forked open arrows, the interval ends resembled `K`, line widths and slant were incorrect, and stems entered the tips. After the fix, every instance uses the source Tee path: full bars, one-sided harpoons, reversed starts, sharp or round cap/join, slant, and tip-local stroke all agree visually with MacTeX.

## Reference artifacts

- Before: `outputs/qa-arrows-meta-tee-barb-2026-09-05-before`
- After: `outputs/qa-arrows-meta-tee-barb-2026-09-05-after`
- TikZKit SVG/PNG: `tikzkit-svg/` and `tikzkit-png/`
- tikztosvg SVG/PNG: `tikztosvg-svg/` and `tikztosvg-png/`
- MacTeX PNG: `mactex-png/`
- Four-panel visual sheet: `diff/arrows-meta-tee-barb-controls-native-sheet.png`

Local `tikztosvg` is `/Library/TeX/texbin/tikztosvg`. It emits independent SVG paths rather than markers: three `M/L` subpaths for ordinary Tee Barb, two for a harpoon, `fill="none"`, the declared arrow stroke width, butt/miter or round/round cap/join, and an affine terminal transform. TikZKit now uses the same structural model. MacTeX remains authoritative; tikztosvg and MacTeX agree on the relevant silhouettes and line ends.

## Verification

- `node --test test/arrows-meta-tee-barb.test.js`
- `node scripts/case-semantic-audit.js test/fixtures/examples/arrows/meta-tee-barb-controls.tex --review test/fixtures/examples/arrows/meta-tee-barb-controls.review.json --strict`
- `node scripts/render-example-fixtures.js --output outputs/qa-arrows-meta-tee-barb-2026-09-05-after --only arrows-meta-tee-barb-controls --strict-tikztosvg --native-reference`
- `node scripts/diff-example-pngs.js --output outputs/qa-arrows-meta-tee-barb-2026-09-05-after`

The full suite finished with 2,390 tests: 2,245 passed, 131 known failures, and 14 skipped. The known-failure count is unchanged from the preceding Arc Barb baseline, while this slice adds eight passing tests.

## Remaining limitations

Arbitrary setup-code keys and bending declarations, polar bending, repeated `reversed` cancellation, arbitrary pgfmath expressions in arrow options, and arbitrary user-declared names inside composite sequences remain partial.
