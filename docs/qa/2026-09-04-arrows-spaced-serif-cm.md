# Arrows and Arrows.Spaced: Serif CM

## Scope

This slice implements the ordinary `serif cm` arrow and its
`spaced serif cm` combination. It does not broaden the generic
`\pgfarrowsdeclare` interpreter or change unrelated arrow families.

`arrows.spaced` was selected because its registry entry had 27 cases and
listed serif-cm as its only remaining unsupported declaration. Three new
fixtures exercise the feature in a review flow, a quotient-map diagram, and
a force-vector diagram.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.code.tex`
  declares `serif cm`. Its active unit is
  `d = 0.4pt + 0.45*lineWidth`; the backend is `-0.75d`, the tip end and
  path shift are `0.04*lineWidth`, and the visible tip is a closed fill-only
  cubic silhouette.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.spaced.code.tex`
  declares `spaced serif cm` with the starred combine form and zero
  separation.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`
  defines the invisible `space` arrow as `0.88pt + 0.3*lineWidth`.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-arrows.tex`
  lists both names under serif-like arrow tips.

At a 1.2pt line width, the implementation therefore uses `d=0.94pt`,
`backEnd=-0.705pt`, `tipEnd=0.048pt`, and a 1.24pt invisible space. The
spaced alias keeps the same visible path and increases only placement and
shaft shortening.

## Third-party SVG reference

Local tools used:

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- `rsvg-convert`: `/opt/homebrew/bin/rsvg-convert`
- `pdflatex`: `/Library/TeX/texbin/pdflatex`

Artifacts are stored in
`outputs/qa/2026-09-04-arrows-spaced-serif-cm/`:

- `tikzkit-svg/` and `tikzkit-png/`
- `tikztosvg-svg/` and `tikztosvg-png/`
- `mactex-png/`
- `diff/` and `diff-png/`

The `tikztosvg` SVG paints the serif as a closed nonzero-fill path without a
stroke, placed beside a butt-capped shaft. TikZKit now emits the same
structure as a `tikz-arrow-legacy-serif-cm` or
`tikz-arrow-legacy-spaced-serif-cm` path and rotates it from the terminal
tangent. Start and end tips on the curved quotient map confirm that the
shape is not represented by a fixed horizontal marker.

## Visual result

Before this slice, the two serif-cm names were not normalized into visible
arrow geometry. The real TCS logo source and direct `serif cm-` paths
therefore lost the terminal serif. After the change:

- The flowchart has all five expected serif terminals, including the
  orthogonal retry route and both ends of the curved expedite route.
- The quotient map preserves vertical, horizontal, and curved endpoint
  directions. Formula labels and node borders remain aligned with both
  references.
- The physics diagram keeps the upward, downward, and diagonal force vectors
  attached to the body, with the curved impulse tips following both local
  tangents.
- No elements, colors, layers, arrows, or labels are missing. The remaining
  visible differences are text rasterization and one- to four-pixel crop
  differences, not serif geometry.

The auxiliary TikZKit-to-tikztosvg mean absolute RGBA differences are
0.02089 for the flowchart, 0.02109 for the mathematics diagram, and 0.01000
for the physics diagram. The three four-way sheets were inspected directly;
these values were not used as the sole acceptance criterion.

## Verification

```sh
node --test test/arrows-spaced-serif-cm.test.js test/arrows-spaced-side-to.test.js test/arrows-spaced-common.test.js
npm run case:audit -- test/fixtures/examples/arrows/spaced-serif-cm-flowchart.tex --review test/fixtures/examples/arrows/spaced-serif-cm-flowchart.review.json --strict
npm run case:audit -- test/fixtures/examples/arrows/spaced-serif-cm-math.tex --review test/fixtures/examples/arrows/spaced-serif-cm-math.review.json --strict
npm run case:audit -- test/fixtures/examples/arrows/spaced-serif-cm-physics.tex --review test/fixtures/examples/arrows/spaced-serif-cm-physics.review.json --strict
node scripts/render-example-fixtures.js --output outputs/qa/2026-09-04-arrows-spaced-serif-cm --only arrows-spaced-serif-cm-flowchart --only arrows-spaced-serif-cm-math --only arrows-spaced-serif-cm-physics --native-reference --native-latex-engine pdflatex --tikztosvg-engine pdflatex --strict-tikztosvg --comparison-grid-mode svg
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-04-arrows-spaced-serif-cm
```

All three fixtures render with zero diagnostics. All 55 installed
`arrows.spaced` declarations are now represented, so that registry entry is
promoted from `partial` to `builtin`. The base `arrows` library remains
partial because generic declaration setup code, complete arrow hulls, and
some unrelated legacy declarations are still outside its supported subset.
