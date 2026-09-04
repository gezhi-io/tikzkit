# Legacy `implies` arrow QA

## Scope

This slice implements the ordinary legacy `implies` arrow from the `arrows`
library. It covers single and double paths, custom inner colors and distances,
start/end/bidirectional tips, and straight, orthogonal, and curved terminal
tangents. It does not claim general support for arbitrary declared-arrow hulls.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.code.tex`, lines 899-932: `implies` computes
  `dima=.25*(pgflinewidth+pgfinnerlinewidth)` and
  `dimb=.5*(pgflinewidth-pgfinnerlinewidth)`. Its backend is
  `-1.36*dima-.5*dimb`, its tip end is `2.06*dima+.5*dimb`, and its visible
  path is a symmetric pair of cubic segments shifted by `.06*dima`. The path
  is stroke-only with width `dimb`, round caps, and round joins.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.spaced.code.tex`, line 26: `spaced implies` combines the same visible arrow with the core invisible `space` arrow. The ordinary and spaced implementations therefore share metrics and geometry; only the spaced wrapper adds the space extent.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-arrows.tex`, lines 14-30: the manual identifies `implies` as the legacy mathematical double-line terminal and keeps `arrows` for compatibility.

## Reference pipeline

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- MacTeX engine: `/Library/TeX/texbin/pdflatex`
- PNG conversion: `/opt/homebrew/bin/rsvg-convert`
- Artifacts: `outputs/qa/2026-09-04-arrows-implies/`
- Four-way sheets:
  - `diff/arrows-implies-flowchart-native-sheet.png`
  - `diff/arrows-implies-math-native-sheet.png`
  - `diff/arrows-implies-physics-native-sheet.png`

The generated tikztosvg SVG uses open paths with `fill=none`, round caps and
joins, and a local transform at each terminal. For the `.8pt` flow arrow its
visible arrow stroke is `0.79701pt`; TikZKit resolves the same requested
`.8pt` after its renderer-unit conversion. The two cubic segments, reflected
y coordinates, endpoint shortening, and tangent transforms agree. TikZKit
keeps text as SVG text while tikztosvg converts TeX glyphs to paths, so small
font rasterization and crop differences remain outside this arrow slice.

## Visual result

Before this change, ordinary `implies` was unknown to the legacy registry and
fell back to generic arrow geometry. The implication head was therefore the
wrong filled shape and did not use double-line inner/outer widths.

After the change, all three cases visibly show the source open implication
head. Straight arrows meet node borders at the same endpoint, start arrows
face outward, orthogonal tips use the final vertical tangent, and curved tips
follow the local Bezier tangent. Colored inner shafts remain visible through
the open arrow. No elements, labels, path layers, or arrowheads are missing.

The remaining visible differences are small TeX-glyph rasterization and
one-pixel crop variations. The flow and math comparisons differ by one output
pixel in height; the physics case has a larger crop difference around the
sloped word `measure`, but the path and arrow geometry aligns with both local
references.

## Verification

```sh
node --test test/arrows-implies.test.js test/arrows-spaced-implies.test.js test/arrows-spaced-serif-cm.test.js
npm run case:audit -- test/fixtures/examples/arrows/implies-flowchart.tex --review test/fixtures/examples/arrows/implies-flowchart.review.json --strict
npm run case:audit -- test/fixtures/examples/arrows/implies-math.tex --review test/fixtures/examples/arrows/implies-math.review.json --strict
npm run case:audit -- test/fixtures/examples/arrows/implies-physics.tex --review test/fixtures/examples/arrows/implies-physics.review.json --strict
node scripts/render-example-fixtures.js --output outputs/qa/2026-09-04-arrows-implies --only arrows-implies-flowchart --only arrows-implies-math --only arrows-implies-physics --native-reference --native-latex-engine pdflatex --tikztosvg-engine pdflatex --strict-tikztosvg --comparison-grid-mode svg
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-04-arrows-implies
```

Focused tests pass, all three strict semantic audits pass, both reference
engines render 3/3 cases, and TikZKit reports zero diagnostics for every case.
The full `npm test` run reports 2,138 tests: 1,998 pass, the unchanged 126
baseline failures remain, and 14 tests are skipped; this slice adds no failure.
