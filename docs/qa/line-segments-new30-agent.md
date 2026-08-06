# Line-segments new-30 visual QA

## Scope

This pass is intentionally limited to these 16 cases:

- `latex-examples-line-segments-bounding-box`
- `latex-examples-line-segments-f1` through `latex-examples-line-segments-f8`
- `latex-examples-line-segments-t2` through `latex-examples-line-segments-t6`
- `latex-examples-lines-intersections`
- `latex-examples-knot-trefoil`

Artifacts are saved under:

- `outputs/qa-line-segments-new30-before/tikzkit-svg/`
- `outputs/qa-line-segments-new30-before/tikzkit-png/`
- `outputs/qa-line-segments-new30-before/tikztosvg-svg/`
- `outputs/qa-line-segments-new30-before/tikztosvg-png/`
- `outputs/qa-line-segments-new30-before/diff/`

Every `*-sheet.png` was inspected. Panel order is TikZKit, tikztosvg, diff.

## Shared findings

- All 16 TikZKit PNGs have exactly the same pixel dimensions as their tikztosvg references.
- The line-segment cases preserve the 0.5cm grid, black `very thick` segments, four endpoint crosses, red bidirectional `stealth'` axis, clipping, and draw order.
- Physical line widths agree with native TikZ: grid `0.3985pt`, red axis and gray crosses `0.79701pt`, black segments `1.19553pt`, trefoil `2pt`.
- Segment endpoints and crossing coordinates agree. `lines-intersections` contains all 15 requested segments and 30 `to path` endpoint crosses. `knot-trefoil` contains the shared cubic path with six cubic segments.
- No case emits an error diagnostic.

At the time of this pass, the remaining shared mismatch was `cross out` endpoint extent: native foreground diagonals used inherited rectangle corners including `outer sep`, while the JS path used only the visible node box. That follow-up is now implemented and recorded in [the shapes.misc outer-separation QA](2026-08-06-shapes-misc-cross-out-outer-sep.md); this document keeps the earlier observation so the source of the old diff specks remains traceable.

`lines-intersections` also retains small glyph-raster differences in the `tkz-fct` tick labels. Its segment coordinates, widths, endpoints, grid, axes, and bbox agree. The remaining text behavior is owned by the `tkz-fct` preprocessing/text renderer path, also outside the permitted edit surface.

## Per-case visual acceptance

| Case | TikZKit / reference | Changed ratio | Visual result |
| --- | ---: | ---: | --- |
| `line-segments-bounding-box` | `181x219 / 181x219` px, `135.24x163.59pt` | 0.000959 | Two orange bboxes, both black diagonals, grid, arrows, and four endpoints align. Only cross-tip antialias specks remain. |
| `line-segments-f1` | `294x294 / 294x294` px, `220.28x220.28pt` | 0.000521 | Both collinear segments, endpoints, square grid, and red axes align. |
| `line-segments-f2` | `238x228 / 238x228` px, `177.76x170.68pt` | 0.004736 | Negative-x placement, descending segments, origin endpoint, grid, and bbox align. Residual is concentrated at crosses. |
| `line-segments-f3` | `105x143 / 105x143` px, `78.55x106.90pt` | 0.008791 | Both vertical segments and all coordinates align. The higher ratio comes from two crosses overlapping the red y-axis, not missing geometry. |
| `line-segments-f4` | `143x105 / 143x105` px, `106.90x78.55pt` | 0.002997 | Vertical and horizontal segments, grid, axes, and endpoint centers align. |
| `line-segments-f5` | `256x256 / 256x256` px, `191.94x191.94pt` | 0.004150 | Both separated diagonal segments, negative corner, axes, and bbox align. |
| `line-segments-f6` | `105x105 / 105x105` px, `78.55x78.55pt` | 0.003900 | Intersecting diagonals and all four endpoints align; no layer or stroke-width loss. |
| `line-segments-f7` | `181x105 / 181x105` px, `135.24x78.55pt` | 0.002263 | Both horizontal segments retain lengths, y coordinates, and endpoint centers. |
| `line-segments-f8` | `219x181 / 219x181` px, `163.59x135.24pt` | 0.001413 | Long descending diagonal, short vertical segment, boundary endpoints, and grid align. |
| `line-segments-t2` | `332x219 / 332x219` px, `248.63x163.59pt` | 0.000977 | Shared start relationship, both slopes, line widths, endpoints, and axes align. |
| `line-segments-t3` | `105x105 / 105x105` px, `78.55x78.55pt` | 0.003991 | T-junction geometry, negative-x vertical, horizontal segment, and endpoint centers align. |
| `line-segments-t4` | `105x181 / 105x181` px, `78.55x135.24pt` | 0.002526 | Perpendicular T-junction, boundary endpoints, and grid align. |
| `line-segments-t5` | `219x219 / 219x219` px, `163.59x163.59pt` | 0.000876 | Red outer segment and blue inner segment preserve color, order, overlap, width, and endpoints. |
| `line-segments-t6` | `294x219 / 294x219` px, `220.28x163.59pt` | 0.000528 | Coincident red/blue segments retain source order, so blue correctly covers red; duplicated endpoint crosses remain at the same coordinates. |
| `lines-intersections` | `870x341 / 870x341` px, `652.37x255.52pt` | 0.006647 | All 15 segments, 30 endpoint crosses, 1cm `tkz-fct` grid, axes, ticks, labels, and outer white bbox are present and positioned correctly. Residual is cross/glyph rasterization. |
| `knot-trefoil` | `197x171 / 197x171` px, JS `147.21x127.75pt`, reference `147.209x127.753pt` | 0.000000 | Pixel-exact reference match. Cubic curves, 2pt red stroke, crossing gaps, joins, and bbox agree. |

## Tests

Focused command:

```sh
node --test test/line-segments-new30.test.js
```

Result: 18 tests passed. The test fixes the native document sizes and checks endpoint multiplicity, grid presence, bidirectional arrow kinds, line width/color/order, all 15 intersection segments, all 30 endpoint crosses, and the trefoil cubic path.

## Modified files

- `test/line-segments-new30.test.js`
- `docs/qa/line-segments-new30-agent.md`

No source implementation file was changed in this pass. No commit or push was performed.
