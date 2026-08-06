# shapes.misc cross-out outer-separation QA

## Scope

This pass is limited to the `shapes.misc` foreground-path slice: `cross out`
and `strike out`. It makes their diagonal endpoints follow the inherited
rectangle anchors, including automatic or explicit `outer sep`, and includes
those endpoints in the SVG picture bounds. It does not claim complete
`shapes.misc` support.

The primary real driver is `latex-examples-intersecting-lines-5`, with the
same path emitted by the line-segment and bounding-box fixtures that use
`point/.style={...,cross out,...}`.

Implemented syntax and parameters in this slice:

- `\usetikzlibrary{shapes.misc}`, `cross out`, and `strike out` node shapes;
- `draw`, `minimum size`, `minimum width`, `minimum height`, `inner sep`,
  `outer sep`, `outer xsep`, `outer ysep`, line width, canvas scale, and node
  rotation as they affect foreground endpoint geometry;
- inherited rectangle corner anchors and their contribution to both visible
  SVG bounds and interpreter-side `current bounding box` computation.

## Local MacTeX reading

Read:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.misc.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`

`cross out` inherits rectangle saved anchors and uses two foreground paths:
`south west -> north east` and `north west -> south east`. `strike out` uses
only the first. Rectangle anchors include TikZ's computed `outer sep`; the
foreground paths do not use only the visible text/minimum-size box. This is
why a `minimum size=4pt`, `ultra thick` endpoint needs about `2pt + 0.797pt`
from its center rather than only `2pt`.

## Implementation

`src/engine/evaluate.js` now stores the canvas-scaled outer separation on the
`crossOut`/`strikeOut` scene item. `src/renderers/svg/nodeOverlays.js` extends
each SVG diagonal by it. `src/renderers/svg/bounds.js` and interpreter-side
current-bounding-box accumulation use the same extent so visual geometry and
reported picture bounds cannot diverge.

## Three-way visual check

Local tools used:

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- PNG rasterizer: `/opt/homebrew/bin/rsvg-convert`
- MacTeX native reference: local `pdflatex`

Baseline artifacts:

- `/private/tmp/tikzkit-qa-shapes-misc-cross-out-before-2026-08-06/`

Post-fix artifacts:

- `/private/tmp/tikzkit-qa-shapes-misc-cross-out-after-2026-08-06/`
- `/private/tmp/tikzkit-qa-shapes-misc-cross-out-batch-2026-08-06/`

Each artifact directory contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX
PNG, grid overlays, and comparison sheets. The `intersecting-lines-5` native
sheet was inspected. Before the fix, each gray endpoint cross stopped at the
visible `+/-1.99pt` box. Afterwards, its SVG path reaches `+/-2.797pt`, the
same `2pt + 0.797pt` inherited-anchor extent used by the native reference.
The crossed endpoints now visibly meet the outer node corners instead of
leaving short diagonal tips near the line ends. Its TikZKit/tikztosvg changed
pixels fell from `504` (`1.0802%`) to `385` (`0.8252%`); mean absolute
difference fell from `0.002132` to `0.001773`. These values support, but do
not replace, the visual inspection.

The remaining red diff marks are mostly tick-label glyph rasterization and
antialiasing. Lines, grid, endpoint centers, colors, widths, layer order, and
the cross foreground geometry agree; there is no missing path or bbox shift.

The seven-case batch rendered TikZKit, tikztosvg, and MacTeX successfully with
zero TikZKit diagnostics. All four-panel native sheets were inspected for
`bounding-box-lines-1`, `bounding-box-lines-2`, `center`, `center-line`,
`center-two-cluster`, `intersecting-lines-5`, and `line-segments-f3`. In both
bounding-box figures and `line-segments-f3`, endpoint crosses now reach the
same outer corners as the reference. `center` and `center-two-cluster` retain
larger non-slice differences around curved paths and text rasterization; this
pass did not treat that as a `shapes.misc` completion claim. `center-line`
also retains dense brace/text antialiasing differences, while its cross marks
are no longer visibly shortened.

## Commands and tests

```sh
node --test --test-name-pattern='shapes\.misc cross out' test/interpreter.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-shapes-misc-cross-out-after-2026-08-06 \
  --only latex-examples-intersecting-lines-5 --native-reference \
  --comparison-grid-mode svg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-shapes-misc-cross-out-after-2026-08-06 --register
```

The focused regression test passes. The broader real-case batch and semantic
catalog check are run with the implementation commit.

## Boundaries

Still out of scope: arbitrary additional `shapes.misc` shapes, native TeX box
metrics in every font combination, and pixel-identical text antialiasing.
