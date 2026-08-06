# Transform Canvas Path Matrix QA

## Scope

This pass implements one shared core-TikZ slice: `transform canvas={...}`
for normal path and node rendering. The boundary is deliberately narrow:
uniform scale, rotation, and shifts are separated from normal TikZ coordinate
transforms, including their stroke/text scale and automatic bounding-box
behavior. It does not claim correct non-uniform node-anchor geometry, arbitrary
PGF backend matrices, or reliable post-transform anchor reuse.

The real driver is the official PGF manual example in
`test/fixtures/examples/paths/transform-canvas-manual.tex`:

```tex
\draw[help lines] (0,0) grid (3,2);
\draw[transform canvas={scale=2},blue]   (0,0) -- (1,1) -- (1,0);
\draw[transform canvas={rotate=180},red] (0,0) -- (1,1) -- (1,0);
```

## Local Source Reading

- Read `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-transformations.tex`, lines 474-499. It states that `transform canvas` immediately changes the canvas matrix while leaving the coordinate matrix unchanged; it also locally disables picture-size tracking and warns that node coordinates are no longer reliable.
- Read `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`, the `/tikz/transform canvas` key around lines 358-370. Its rendering hook resets/synchronizes the PGF low-level canvas matrix independently of TikZ's normal coordinate transform.

Implementation consequence: TikZKit now first resolves the normal coordinate
matrix, then applies `canvasTransform` to emitted geometry. It no longer feeds
`transform canvas` back into `env.transform`. Drawn items with that option are
marked out of automatic bounds tracking, matching the PGF manual behavior.

## Reference and Artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`; PNG conversion uses
  `/opt/homebrew/bin/rsvg-convert`.
- Artifact bundle:
  `/private/tmp/tikzkit-qa-transform-canvas-2026-08-07/`
  - MacTeX PNG: `mactex-png/transform-canvas-manual.png`
  - TikZKit SVG/PNG: `tikzkit-svg/transform-canvas-manual.svg`,
    `tikzkit-png/transform-canvas-manual.png`
  - tikztosvg SVG/PNG: `tikztosvg-svg/transform-canvas-manual.svg`,
    `tikztosvg-png/transform-canvas-manual.png`
  - four-panel native sheet:
    `diff/transform-canvas-manual-native-sheet.png`

The tikztosvg SVG keeps the blue path's original coordinates and applies
`matrix(2,0,0,-2,...)`; TikZKit materializes the equivalent points and doubles
the SVG stroke width. Both produce the same visible blue polyline. The red
rotated path is outside the normal grid bbox and is clipped by the final SVG
viewport, as in the native panel.

## Visual Result

Before this pass, a scope with `shift={(1,1)},transform canvas={scale=.5}`
scaled a node's local coordinate first and then shifted it, placing the center
at `(2,1)` instead of the rendered `(1.5,.5)`. Its transformed paths also
expanded the SVG viewBox, so a red rotated manual path remained visible outside
the native picture region.

After the change, node geometry, text scale, stroke width, path coordinates,
and the canvas crop agree with the local references. The current tikztosvg
comparison is dimension-equal at `114x76`; the visual diff has 17 changed
anti-alias pixels out of 8,664. That number is supplementary: the inspected
three renderer panels show the same grid and blue path placement, with only the
expected clipped trace of the red path.

## Implementation and Tests

- `src/engine/evaluate.js`: introduces an explicit post-coordinate
  `canvasTransform`, applies it to path/node geometry and vectors, scales
  canvas metrics, and excludes transformed items from automatic bounds.
- `test/petarv-compat.test.js`: covers both a shifted/scaled node and the
  official path scale/rotate example.
- `test/fixtures/examples/paths/transform-canvas-manual.tex` and
  `manifest.json`: add the official manual fixture to the maintained corpus.
- `src/tikz/commands/path.js`, `src/tikz/commands/tikzpicture.js`, and the
  generated extension registry record the capability and its boundary.

Verified:

```sh
node --test --test-name-pattern='transform canvas' test/petarv-compat.test.js
npm run examples:render -- --only transform-canvas-manual --output /private/tmp/tikzkit-qa-transform-canvas-2026-08-07 --native-reference --strict-tikztosvg --comparison-grid-mode svg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-transform-canvas-2026-08-07
node --test test/architecture-seams.test.js
npm run gallery:audit
```

The focused regressions pass, the architecture suite passes 45/45, and
`gallery:audit` renders 302/302 fixtures with zero diagnostics. The broad
`test/example-fixtures.test.js` remains red for three pre-existing, unrelated
assertions: missing owner metadata for `tkz-fct-tangent-line`, incorrect
source-corpus metadata for `rectangle-split-ignore-empty`, and the stale
Bellman-Ford expectation of 30 rather than the currently emitted 10 graph
edges. Its public conversion subtest passes; none of those failures involve
`transform canvas`.

## Remaining Work

- Non-uniform backend transforms need shape-aware node anchors and rotated
  text geometry rather than the current uniform canvas-scale metric.
- Native PGF intentionally makes anchors/bounding boxes unreliable after
  `transform canvas`; TikZKit keeps visual placement correct but does not yet
  emulate every downstream-anchor corner case.
- Preactions, postactions, clipping stacks, and backend-only transforms still
  need their own visual slices.
