# tkz-euclide circle-circle intersections with nodes QA

## Scope

This pass implements exactly one documented `tkz-euclide` input family:
`\tkzInterCC[with nodes](O,A,B)(O',C,D)`. Each triple describes a circle by
its center and a radius equal to the distance between its final two points.
The resulting contacts retain the existing `tkzInterCC` directed ordering,
`common=...` behavior, and `tkzGetPoints`/`tkzGetFirstPoint`/
`tkzGetSecondPoint` handoff.

The driver is
`test/fixtures/examples/tkz-euclide/circle-circle-intersections-with-nodes.tex`,
adapted from the local `TKZdoc-euclide-intersection.tex` manual example.
It deliberately stays within this geometry slice: two circles, their two
contacts, the four center-to-contact segments, and labels.

## Local MacTeX Reading

Read TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-euclide/tkz-tools-eu-intersections.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-euclide/TKZdoc-euclide-intersection.tex`

`\tkzInterCC` switches to `\tkzInterCCWithNodes` for `with nodes`; that
macro measures `AB` and `CD`, then delegates to `\tkzInterCCR`. The latter
uses the radical-axis base point plus a perpendicular offset for the two
contacts. The outer wrapper then preserves directed-angle order or puts a
declared `common` point second. TikZKit now follows the same reduction before
using its existing shared circle-circle geometry and ordering code.

## Command Audit

| Source command or option | Status | Notes |
| --- | --- | --- |
| `\tkzDefPoints` | implemented | Declares the two centers and four radius-defining points. |
| `\tkzInterCC[with nodes](A,A,P)(B,B,Q)` | implemented | Measures `A--P` and `B--Q` as the two radii. |
| `\tkzGetPoints{C}{D}` | implemented | Publishes the ordered upper/lower contacts. |
| `\tkzDrawCircle`, `\tkzDrawSegments`, `\tkzDrawPoints` | implemented | Existing shared drawing lowering. |
| `\tkzLabelPoints` | implemented | Existing point-label lowering. |
| Polar `\tkzDefPoint`, plural `\tkzDrawCircles`, and macro-heavy manual loops | not in this slice | They remain independent tkz-euclide command families. |

## Visual Evidence

Artifacts were generated locally in:
`/private/tmp/tikzkit-qa-tkz-intercc-with-nodes-2026-08-06`.

- TikZKit SVG/PNG: `tikzkit-svg/` and `tikzkit-png/`
- tikztosvg SVG/PNG: `tikztosvg-svg/` and `tikztosvg-png/`
- MacTeX PNG: `mactex-png/`
- Four-panel sheet: `diff/tkz-euclide-circle-circle-intersections-with-nodes-native-sheet.png`

Before the change, the documented `with nodes` form emitted an unsupported
diagnostic, so C/D were absent and no circles-to-contact construction could
appear. After the change, all three viewed panels show the same large left
circle, smaller right circle, C above and D below their intersection lens, and
four gray center-to-contact segments. The 1cm grids put C and D at the same
construction coordinates in the JS and tikztosvg panels.

The tikztosvg SVG uses `272.35pt x 181.64pt`, cubic paths for circles,
`stroke-linecap=round` for the segments, a Y-flip transform, and glyph-outline
`use` elements for labels. TikZKit emits equivalent cubic circles and line
segments in a browser-text SVG. Geometry aligns; remaining panel differences
are outline-font rasterization and reference crop edges, not missing elements
or coordinate drift.

The registered JS-to-tikztosvg comparison is `same`: 317 changed pixels out
of 88,452 after zero-pixel registration. This number only supports the visual
review above.

## Validation

Passed:

```bash
node --test test/tkz-euclide.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-tkz-intercc-with-nodes-2026-08-06 \
  --only tkz-euclide-circle-circle-intersections-with-nodes \
  --native-reference --comparison-grid-mode svg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-tkz-intercc-with-nodes-2026-08-06 \
  --register --alignment-radius 3
```

## Remaining Boundary

The package remains partial. The next independent slices are polar
`\tkzDefPoint`, plural drawing commands such as `\tkzDrawCircles`, clipping,
and broader circle/triangle constructions.
