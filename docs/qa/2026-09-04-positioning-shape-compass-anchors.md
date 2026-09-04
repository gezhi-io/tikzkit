# Positioning Shape Compass Anchors QA

## Scope

This slice implements shape-aware compass anchors for modern diagonal
`positioning` placements. The accepted family is `above left`, `above right`,
`below left`, and `below right` with both paired and single `node distance`
values. It does not claim complete custom-shape positioning.

## Local Source Review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarypositioning.code.tex`
  declares each placement as a self anchor, direction vector, reference anchor,
  and single-distance factor. For example, `above right` uses self `south west`,
  vector `(1,1)`, reference `north east`, and factor `0.707106781`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex`
  defines diamond `north east` as `(outer half width / 2, outer half height / 2)`
  and the other diagonal anchors by reflection. They are not corners of the
  diamond's rectangular bounding box.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduleshapes.code.tex`
  supplies the core circle/ellipse border-anchor model used by the same
  placement equation.

## Implementation

`src/tikz/libraries/positioning.js` now computes:

```text
reference compass anchor + scaled distance vector - self compass anchor
```

The interpreter passes each node's shape, shape data, rotation, and anchor-box
size into the positioning library. The library reuses
`nodeAnchorCoordinate`/`shapeCompassLocalAnchor`, so explicit `(node.anchor)`
coordinates and relative node placement share one geometry definition. The old
empirical `0.024cm` diagonal correction was removed.

## Reference Pipeline

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- SVG-to-PNG: `/opt/homebrew/bin/rsvg-convert`
- Artifacts: `outputs/qa-positioning-shape-anchors-2026-09-04/`
- Four-panel sheets: `outputs/qa-positioning-shape-anchors-2026-09-04/diff/*-native-sheet.png`
- Workbench artifacts: `test/fixtures/examples/output/positioning-diagonal-*`

The local tikztosvg state-network SVG uses one y-flipping group transform,
circle paths with butt caps and miter joins, separate filled arrow-tip paths,
and glyph outlines. TikZKit emits direct ellipses, line paths, transformed arrow
paths, and SVG text. Despite the structural difference, the node centers,
circle radii, clipped line endpoints, and arrow directions align.

## Visual Results

- `custom-to-path-flowchart`: TikZKit changed from `426x219` to `392x202`;
  MacTeX, tikztosvg, and TikZKit are now all `392x202`. The decision diamond,
  branch boxes, orthogonal routes, and labels align visibly.
- `positioning-diagonal-state-network`: all three outputs are `347x125`.
  Circle centers, diagonal arrows, clipping, and sloped formula labels align.
- `positioning-diagonal-decision-flow`: TikZKit is `369x194`, tikztosvg is
  `370x195`. Placement geometry aligns; the residual one-pixel crop is text and
  stroke rasterization.
- `positioning-diagonal-signal-chain`: both are `433px` wide; TikZKit is
  `126px` high and tikztosvg is `129px`. Shape placement aligns; the remaining
  height is the multiline/formula glyph crop.

All four TikZKit renders, tikztosvg renders, and native MacTeX renders completed
with zero diagnostics.

## Tests

```text
node --test --test-name-pattern='shape compass anchors for diagonal positioning|uses diagonal TikZ positioning distance for GAT layer neighbors|uses TikZ positioning node distance pairs|uses positioning on grid|base and mid positioning' test/interpreter.test.js test/petarv-compat.test.js
node --test test/library-modules.test.js test/to-path-controls.test.js
node scripts/render-example-fixtures.js --output outputs/qa-positioning-shape-anchors-2026-09-04 --only custom-to-path-flowchart --only positioning-diagonal-decision-flow --only positioning-diagonal-state-network --only positioning-diagonal-signal-chain --native-reference --strict-tikztosvg
node scripts/diff-example-pngs.js --output outputs/qa-positioning-shape-anchors-2026-09-04 --register
npm test
```

The full suite reports 1,960 tests: 1,823 pass, 123 pre-existing failures, and
14 skips. The failure count is unchanged from the 1,959-test baseline; this
slice contributes one passing regression and no new failures.

## Remaining Work

Rotated asymmetric custom shapes need a separate source-reviewed slice because
their placement anchor and painted bbox can diverge after shape-border rotation.
The signal-chain crop also leaves a small independent multiline/math text-bbox
calibration task.
