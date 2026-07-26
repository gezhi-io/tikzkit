# Automata Accepting Arrows QA

## Scope

Implement the `automata` library's accepting-arrow family only:
`accepting by arrow`, `accepting above`, `accepting below`, `accepting left`,
`accepting right`, `accepting distance`, and `accepting text`.

## Local source study

Read `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryautomata.code.tex`.
Lines 21-34 define accepting arrows as an after-node path. The path starts at
the selected node border and ends `accepting distance` away in the selected
direction, with an outward arrowhead. Lines 55, 58, 61, and 77-94 establish
the default empty label, default `3ex` distance, and the four direction/anchor
pairs. This is deliberately different from an initial arrow, whose arrowhead
points toward the node.

## Fixture and reference artifacts

Fixture: `test/fixtures/examples/automata/accepting-arrows.tex`.

Artifacts are kept together in `outputs/qa-automata-accepting/`:

- `native-mactex.png`: local pdfLaTeX rendering.
- `tikzkit-svg/automata-accepting-arrows.svg` and `tikzkit-grid-png/automata-accepting-arrows.png`.
- `tikztosvg-svg/automata-accepting-arrows.svg` and `tikztosvg-grid-png/automata-accepting-arrows.png`.
- `diff/automata-accepting-arrows-sheet.png`: TikZKit, tikztosvg, and pixel-diff panel.

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg` and invoked through
the fixture renderer with pdfTeX compatibility. Its SVG has a `140.98pt` by
`149.77pt` viewBox, emits ordinary stroked paths followed by transformed filled
arrow-tip paths, and uses path glyphs rather than SVG text. It places the
outward arrow from the border to the exterior endpoint; this matched MacTeX.

## Visual result

Before this change, TikZKit rendered four green state circles only. It omitted
all accepting-arrow strokes, arrowheads, distances, and labels. After the
change, the four arrows leave the correct north/east/south/west borders, point
outward, honor the `5ex` right-hand distance, and place `finish`, `halt`, and
`done` at their exterior endpoints. The 1cm grid confirms the state centers
remain at `(0,0)`, `(3,0)`, `(0,-2.5)`, and `(3,-2.5)` in both renderers.

The remaining panel difference is expected raster/font representation:
tikztosvg converts TeX glyphs to paths while TikZKit preserves selectable text.
It is not a missing arrow, reversed direction, or coordinate displacement.

## Commands and parameters exercised

- Commands: `\node`, `\usetikzlibrary`, and `\begin{tikzpicture}`.
- Library options: `state`, `accepting above/right/below/left`, `accepting text`,
  `accepting distance`, `every state`, and `>=Stealth`.
- Implemented parameters: direction, the `3ex` default and explicit `5ex`
  distance, empty/default versus custom text, node-border intersection,
  arrowhead direction, state stroke width/color, and label anchors.
- Intentionally outside this slice: `initial by diamond` and the
  `every accepting by arrow` / `every initial by arrow` style hooks.

## Verification

```sh
node --test test/automata.test.js test/library-modules.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples --output outputs/qa-automata-accepting --only automata-accepting-arrows --preserve-output
node scripts/diff-example-pngs.js --output outputs/qa-automata-accepting
```

All focused tests pass. The generated panel was inspected visually.
