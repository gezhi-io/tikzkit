# shapes.geometric ordinary diamond geometry

## Scope

This slice implements the ordinary `diamond` node from `shapes.geometric`:
`aspect`, independent minimum dimensions, independent outer x/y separation,
compass and numeric anchors, automatic edge clipping, SVG paint, and bounds.
`diamond split` is a separate `shapes.multipart` shape and is not changed.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex`, lines 234-376.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`, diamond section.

The source first computes the natural half-width as `xa + aspect*ya` and the
natural half-height as `xa/aspect + ya`, then applies minimum width and height
independently. It adds outer x/y separation to form `outernortheast`, which is
used for named and border anchors. The background path is smaller: each outer
separation is subtracted by a factor of `sqrt(2)` from that outer contour.
Ordinary diamond has no shape-border rotation implementation; normal node
rotation still rotates paint and anchors together.

## Three-way references

- Local `tikztosvg`: `/Library/TeX/texbin/tikztosvg`.
- Before: `outputs/qa-shapes-diamond-geometry-2026-09-04-before/`.
- After: `outputs/qa-shapes-diamond-geometry-2026-09-04-after/`.
- MacTeX PNG: `outputs/qa-shapes-diamond-geometry-2026-09-04-after/mactex-png/`.
- TikZKit SVG/PNG: `outputs/qa-shapes-diamond-geometry-2026-09-04-after/tikzkit-svg/` and `tikzkit-png/`.
- tikztosvg SVG/PNG: `outputs/qa-shapes-diamond-geometry-2026-09-04-after/tikztosvg-svg/` and `tikztosvg-png/`.
- Four-panel sheets: `outputs/qa-shapes-diamond-geometry-2026-09-04-after/diff/`.

The reference SVGs use closed nonzero paths, butt caps, miter joins, explicit
stroke widths, and an inverted-y transform. In the 34mm by 22mm math case,
tikztosvg paints half-extents near 45.30pt by 30.36pt while the outer anchor
lines reach about 55.16pt horizontally and 33.17pt vertically. This confirms
that paint and anchor contours cannot share one polygon.

## Visual result

- Flowchart: the orange decision outline no longer reaches the red/blue outer
  anchor markers; incoming and outgoing arrows remain clipped to the outer
  anchor contour, matching both references.
- Mathematics: the visible horizontal half-extent changes from 1.70cm to about
  1.598cm, close to the 1.592cm tikztosvg reference, while compass, 30-degree,
  base, and mid anchors remain fixed.
- Physics: the rotated thick diamond contracts independently in x and y and its
  four vertices align closely with MacTeX/tikztosvg; force vectors still start
  at the named and numeric outer anchors.

Remaining raster differences are concentrated in math glyphs, arrow tips, and
standalone canvas padding rather than the diamond contour. All three cases
render with zero TikZKit diagnostics and zero external-render failures.

## Verification

```sh
node --test test/shapes-geometric-diamond.test.js
node --test test/shapes-geometric-isosceles-triangle.test.js test/shapes-geometric-dart.test.js test/shapes-multipart-diamond-split.test.js
node scripts/render-example-fixtures.js --output outputs/qa-shapes-diamond-geometry-2026-09-04-after --only shapes-diamond-geometry-flowchart --only shapes-diamond-geometry-math --only shapes-diamond-geometry-physics --native-reference --strict-tikztosvg --continue-on-external-failure --math-renderer svg-text
node scripts/diff-example-pngs.js --output outputs/qa-shapes-diamond-geometry-2026-09-04-after
```
