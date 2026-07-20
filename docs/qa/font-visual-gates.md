# Font and coordinate visual gates

These gates compare the same TikZ source through three renderers:

1. MacTeX native output.
2. `tikztosvg` output.
3. TikZKit output.

Every case is rendered twice: once clean, and once with the same source-level
1cm grid injected into the TikZ picture. The grid belongs to the TikZ coordinate
system; it is not a CSS or PNG overlay. This makes unit conversion, origin,
translation, and scale errors visible directly.

## Acceptance rule

A gate passes only when both conditions hold:

- The clean render has no visible difference in geometry, text size, math layout,
  line width, color, or bounding box.
- The 1cm-grid render places corresponding geometry on the same grid lines and
  in the same grid cells.

Pixel and bounding-box metrics are supporting evidence only. They cannot replace
inspection of `sheet.png` and `sheet-grid.png`.

## Current cases

| Case | Coordinate finding | Remaining failure | Status |
| --- | --- | --- | --- |
| activation-functions | Axes, ticks, curves, and grid origin align. | Legend is lower/narrower; math advances are narrower. | Not accepted |
| 3d-function-9 | Unit scale is close. | Projection is about 6pt smaller; painted center is displaced about 4.125pt; color bar and labels are too far inward. | Not accepted |
| datavisualization-functions | Plot origin and curve positions align to the same cells. | Painted width is about 5.25pt narrow; legend and text spacing differ. | Not accepted |
| circuitikz-labels | Circuit segments and component positions align. | Formula annotation is about 9pt narrow due to simplified SVG math shaping. | Not accepted |

## Artifacts

Run:

```sh
npm run font:gates
```

Results are written to `outputs/font-visual-gates/`. Each case contains native,
`tikztosvg`, and TikZKit SVG/PNG artifacts plus clean and grid comparison sheets.

## Next shared fixes

1. Use TeX-compatible math glyph metrics and script placement for SVG fallback.
2. Match PGFPlots and data-visualization legend row metrics and padding.
3. Make 3D projection bounds include the same projected extrema, labels, and
   color-bar extents as PGFPlots.
