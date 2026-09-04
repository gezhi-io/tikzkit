# QA: `shapes.arrows` arrow box

## Scope

This slice implements the `arrow box` node family because the extension
registry still marked this documented `shapes.arrows` shape as missing. The
acceptance boundary is four independent directional arrows, dimensional head
controls, shorthand parsing, rotation, named and numeric anchors, automatic
edge clipping, SVG path generation, and bounds. It does not claim complete
parity for every degenerate arrow-shape dimension or TeX text metric.

## Local PGF Reading

Reviewed locally:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.arrows.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepoints.code.tex`

The PGF source defines a rectangular body and conditionally splices a seven
vertex arrow into each side. `minimum width` and `minimum height` constrain
only that body. A normal arrow length starts at the body border; `from center`
measures directly from the node center. The shorthand resets all four arrows,
then reuses the most recently specified length for a following bare direction.
Its initial reusable length is zero. Non-positive lengths suppress an arrow.

The head's axial inset is
`cot(tip angle / 2) * (shaft width / 2 + head extend)`, while `head indent`
moves the shaft/head join toward the tip. The source exposes before/head/tip/
after anchors for every direction and sends numeric anchors through the outer
border contour. TikZKit now builds that polygon once and shares it between the
interpreter, anchor and clipping code, SVG renderer, and bounds calculation.

The local TeX Live 2025 source also has a compatibility-sensitive detail: the
four `before/after south arrow head/tip` anchors test and reuse the north-arrow
extension, while a suppressed `south arrow tip` falls back to `east`. A direct
MacTeX coordinate probe confirmed this behavior. TikZKit reproduces it rather
than substituting a geometrically intuitive south-only calculation.

## Commands And Parameters

The three permanent drivers exercise these implemented constructs:

| Construct | Implemented behavior |
| --- | --- |
| `\usetikzlibrary{shapes.arrows}` | Registers `arrow box` separately from the core parser. |
| `\node[arrow box]` and `shape=arrow box` | Creates the source-derived four-sided polygon and lays out text in its rectangular body. |
| `arrow box arrows={...}` | Resets directions, parses `north/south/east/west`, reuses omitted lengths, and accepts `from center`. |
| `arrow box <direction> arrow=<length>` | Overrides one directional length in option order. |
| `arrow box shaft width`, `head extend`, `head indent`, `tip angle` | Controls the shaft and head using PGF's dimensional formulas. |
| `minimum width`, `minimum height`, `outer sep`, `rotate` | Constrains the body, expands the anchor contour, and rotates path plus anchors. |
| named anchors and `<node>.<angle>` | Resolves compass, body-corner, before/head/tip/after, base/mid, and numeric ray-border anchors. |
| `\draw`, `\fill`, `to[out=...,in=...]`, `++(...)` | Uses arrow-box anchors and automatic border clipping in ordinary paths. |

The literal numbers in the cases are meaningful tests: `6mm` through `18mm`
cover unequal and center-relative lengths; `3.5mm`/`4mm` shaft widths,
`2.5mm`/`3mm` head extensions, `1mm` indentation, and `65`/`70` degree tips
exercise non-default geometry; `145` exercises a numeric border anchor; and
`rotate=18` verifies local anchors after rotation.

## Third-Party And Native References

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; `rsvg-convert` was
found at `/opt/homebrew/bin/rsvg-convert`. The complete after directory is:

`outputs/qa/2026-09-04-shapes-arrows-arrow-box-after/`

It contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG, registered diffs,
and native four-panel sheets for `arrow-box-flowchart`, `arrow-box-math`, and
`arrow-box-physics`. The corresponding pre-fix directory is
`outputs/qa/2026-09-04-shapes-arrows-arrow-box-before/`.

The tikztosvg SVG uses one nonzero-filled path with butt caps, miter joins, a
global y-flipping transform, and glyph-outline paths. TikZKit preserves its
semantic coordinate system and emits one `tikz-node-arrowBox` path with the
same butt/miter policy plus SVG text. Thus path topology and joins match while
font rasterization and coordinate serialization deliberately differ.

## Visual Result

Before the change, all three TikZKit panels displayed plain rectangles: the
directional tips, shafts, colored anchor dots, rotated body silhouette, and
correct edge endpoints were absent. The browser bounds also ignored every
arrow extension.

After the change, the mathematics and physics sheets align the four tips,
shaft shoulders, head angles, special and numeric anchor dots, rotation, and
one-centimeter grid with both references. In particular, the unequal north and
south lengths expose PGF's north-derived south-anchor behavior and now agree.
Their remaining visible differences are predominantly browser-versus-Computer-
Modern glyph rasterization and subpixel stroke antialiasing. The flowchart has
the same asymmetric west/east silhouettes and placement sequence; its browser
panel is wider because the existing text and `positioning` metrics still differ
from TeX. The remaining automatic-border intersection discrepancy was resolved
in the 2026-09-05 follow-up by porting PGF's named-anchor angular-sector
decision tree; see `docs/qa/2026-09-05-shapes-arrows-arrow-box-border.md`.

All three after cases have zero TikZKit diagnostics and zero external-render
failures. Pixel metrics remain supporting evidence only; the sheets were
visually inspected for missing elements, geometry, line style, color, text,
anchors, rotation, and bounds.

## Verification

```bash
node --test test/shapes-arrows-arrow-box.test.js
node --test test/shapes-arrows-arrow-box.test.js test/shapes-geometric-semicircle.test.js test/shapes-misc-rounded-rectangle-arcs.test.js
node scripts/render-example-fixtures.js --output outputs/qa/2026-09-04-shapes-arrows-arrow-box-after --only arrow-box-flowchart --only arrow-box-math --only arrow-box-physics --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --strict-tikztosvg --continue-on-external-failure
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-04-shapes-arrows-arrow-box-after --register
npm run extension-registry
```

The focused suite passes 15/15. The complete repository suite reports 2198
tests: 2058 passed, 126 pre-existing failures, and 14 skipped. This slice adds
six passing tests without increasing the known failure or skip counts.

## Remaining Limits

The library stays `partial`: exact TeX text boxes, every pathological negative
or self-intersecting dimension combination, and exhaustive parity for all
`single arrow`/`double arrow` radial border cases remain. A useful next slice
is shared TeX node metrics for asymmetric shapes because it should reduce the
remaining flowchart width difference without special-casing this fixture.
