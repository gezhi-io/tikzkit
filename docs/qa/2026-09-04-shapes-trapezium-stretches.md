# Trapezium Stretch Geometry

## Scope

This round implements one `shapes.geometric` feature family: PGF-compatible
minimum-size geometry for `trapezium stretches` and `trapezium stretches body`.
It also carries the final geometry into named side/corner anchors and arrow
border clipping. It does not attempt every geometric shape.

Three permanent examples exercise different domains:

- `test/fixtures/examples/shapes/trapezium-stretches-flowchart.tex`
- `test/fixtures/examples/shapes/trapezium-stretches-math.tex`
- `test/fixtures/examples/shapes/trapezium-stretches-physics.tex`

## Local MacTeX Study

Read these installed TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex`, especially the trapezium declaration and `\installtrapeziumparameters`. PGF first computes each side extension as twice the natural half-height times the cotangent of its side angle. Ordinary minimum sizing scales the body, extensions, and height proportionally. `trapezium stretches` permits width and height to change independently, while `trapezium stretches body` adds a width deficit only to the body half-width.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`, trapezium section. The manual confirms the three sizing modes and documents the four corner and four side anchors.

The implementation therefore keeps a resolved trapezium geometry record rather
than recomputing side extensions from the final stretched height.

## Third-Party Reference

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. PNG conversion used
`/opt/homebrew/bin/rsvg-convert`; native references used local MacTeX.

All artifacts are in
`outputs/qa/2026-09-04-shapes-trapezium-stretches/`:

- `tikzkit-svg/` and `tikzkit-png/`
- `tikztosvg-input/`, `tikztosvg-svg/`, and `tikztosvg-png/`
- `mactex-png/` and `mactex-log/`
- `diff/`, including three native four-panel sheets

The reference SVG uses explicit closed polygon path data, nonzero fill, butt
caps, miter joins, and a page-level Y-axis flip transform. Arrow tips are
separate filled paths. TikZKit emits the same corner order, fill rule behavior,
cap/join semantics, and separate arrow-tip geometry in its own coordinate
system.

## Visual Acceptance

I inspected the native sheets for all three cases. The flowchart's body-only
sensor and independently stretched actuator match the reference flank angles
and widths; both arrows terminate on the slanted contours. The mathematics
case shows visibly distinct proportional, independent, and body-only shapes,
and its width guide starts at the actual bottom corners. The physics case keeps
the wide sensor body and tall ADC geometry while its top-side and corner guides
start at the documented named anchors.

No shape, path, arrow, label, color, or layer is missing. The flowchart raster
has the same 432 by 122 dimensions as tikztosvg. The mathematics and physics
rasters differ by 2 by 4 pixels and 13 by 1 pixels respectively, primarily from
text and outer-canvas metrics. Pixel differences remain supporting evidence,
not the acceptance criterion.

## Implemented Commands And Parameters

Implemented and exercised in this slice:

- Commands: `\node`, `\draw`, `\path`, and named-node coordinate references.
- Shape keys: `shape=trapezium`, `trapezium left angle`, `trapezium right angle`, `minimum width`, `minimum height`, `trapezium stretches`, and `trapezium stretches body`.
- Anchors: `top side`, `bottom side`, `left side`, `right side`, and all four named corners.
- Shared behavior: inner/outer separation, mitered offset contour, compass-border intersection, and terminal-arrow padding.
- Supporting options: fill/draw colors, line widths, dashed paths, relative positioning, and Latex arrow tips.

Not completed by this slice:

- Arbitrary non-quarter cylinder border rotation and incircle mode.
- The complete cylinder radial, mid, and base anchor family.
- Star outer-separation anchor radii and named inner/outer star anchors.
- Degenerate geometric-shape angular ranges.

Each fixture has a strict semantic review. The flowchart covers 7 commands, 28
options, and 14 numeric values; mathematics covers 10, 21, and 14; physics
covers 8, 20, and 14. All reviews contain zero blockers and zero unreviewed
items.

## Verification

```bash
node --test test/shapes-geometric-trapezium-stretches.test.js
node --test --test-name-pattern=trapezium test/interpreter.test.js
node scripts/render-example-fixtures.js \
  --output outputs/qa/2026-09-04-shapes-trapezium-stretches \
  --only shapes-trapezium-stretches-flowchart \
  --only shapes-trapezium-stretches-math \
  --only shapes-trapezium-stretches-physics \
  --native-reference --native-latex-engine pdflatex \
  --tikztosvg-engine pdflatex --strict-tikztosvg \
  --comparison-grid-mode svg
node scripts/diff-example-pngs.js \
  --output outputs/qa/2026-09-04-shapes-trapezium-stretches
```

The focused implementation tests pass 3/3, the related legacy trapezium tests
pass 2/2, and the render batch produces all TikZKit, tikztosvg, MacTeX, and
comparison artifacts with zero diagnostics and zero external failures.

The complete suite contains 2141 tests: 2001 pass, 126 retain the existing
historical failures, and 14 are skipped. This matches the pre-change failure
baseline, so the slice adds no regression. The fixture-manifest check remains
one of those historical failures because `circuitikz-varcap-diodes` has no
semantic owner; all three new trapezium fixtures have accepted strict reviews.
