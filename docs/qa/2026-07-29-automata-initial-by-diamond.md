# Automata Initial By Diamond QA

## Scope

Implemented the `automata` library's `initial by diamond` feature only. The
slice covers `shape=diamond` overriding the circular `state` style, PGF-style
diamond dimensions, `minimum size`, connection clipping at the diamond border,
and compact math-label measurement. It does not cover the custom
`every accepting by arrow` or `every initial by arrow` style hooks.

## Local MacTeX Reading

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryautomata.code.tex`
  - line 51 defines `initial by diamond` as `shape=diamond`.
  - automata loads `shapes.multipart`, not `shapes.geometric`; a source must
    explicitly load `shapes.geometric` before it can use the diamond shape.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex`
  - the diamond tips derive from text-box half-width/half-height plus inner
    separation, transformed by the shape aspect, then clamped to the minimum
    dimensions.

## Fixture And Artifacts

- Fixture: `test/fixtures/examples/automata/initial-by-diamond.tex`.
- MacTeX native PNG: `outputs/qa-automata-initial-diamond/native-mactex.png`.
- TikZKit JS SVG/PNG: `outputs/qa-automata-initial-diamond/tikzkit-svg/automata-initial-by-diamond.svg` and `tikzkit-png/automata-initial-by-diamond.png`.
- tikztosvg was found at `/Library/TeX/texbin/tikztosvg`; its SVG/PNG are in
  `outputs/qa-automata-initial-diamond/tikztosvg-svg/automata-initial-by-diamond.svg`
  and `tikztosvg-png/automata-initial-by-diamond.png`.
- The 1cm comparison grids are under `tikzkit-grid-*` and `tikztosvg-grid-*`.
- Four-panel diff sheet: `outputs/qa-automata-initial-diamond/diff/automata-initial-by-diamond-sheet.png`.

The tikztosvg SVG uses a closed four-segment path with square tips and a
separate arrow-tip path. Its natural `$q_0$` diamond is about `0.993cm` wide;
TikZKit now renders `1.004cm`. The explicit `minimum size=12mm` node renders
at `1.20cm` in TikZKit versus about `1.19cm` in the reference.

## Visual Result

Before the correction, TikZKit retained the `state` circle semantics during
diamond sizing and measured `$q_0$` using a text-family width. The natural
diamond was about `1.76cm` wide at first, then `1.15cm` after the circle fix,
while the reference was about `0.99cm`. The outgoing arrow consequently began
too far to the right.

Afterwards, the explicit `shape=diamond` wins over the prior `circle` style;
the diamond uses PGF's half-extent geometry; and a one-letter math subscript
uses a math-italic base plus a script-size text digit. Native, TikZKit, and
tikztosvg now show matching diamond centers on the 1cm grid, the natural and
minimum-size diamonds have the same visual scale, and the horizontal arrow
clips to the correct side boundary. There remains normal raster-font antialias
difference, so this is not a pixel-identical result.

## Verification

```sh
node --test test/automata.test.js test/text-package-macros.test.js test/library-modules.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples --output outputs/qa-automata-initial-diamond --only automata-initial-by-diamond --preserve-output
node scripts/diff-example-pngs.js --output outputs/qa-automata-initial-diamond
```

All focused tests pass and the fixture reports no diagnostics. The rendered
images and diff sheet were inspected manually.

## Remaining Work

- Implement the two automata arrow-style hooks.
- Broaden geometric-shape coverage beyond the diamond slice, including the
  rest of `shapes.geometric` and exact path-border intersections for every
  shape.
