# Trapezium Border Rotation

## Scope

This round implements one `shapes.geometric` feature family: trapezium
`shape border rotate` and `shape border uses incircle`. The resolved geometry
is shared by layout, SVG paint, named and numeric anchors, automatic connector
clipping, and SVG bounds. It does not attempt every geometric shape.

Permanent flowchart, mathematics, and physics drivers:

- `test/fixtures/examples/shapes/trapezium-rotation-flowchart.tex`
- `test/fixtures/examples/shapes/trapezium-rotation-math.tex`
- `test/fixtures/examples/shapes/trapezium-rotation-physics.tex`

## Local MacTeX Study

Read these installed TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex`, trapezium declaration and `\installtrapeziumparameters` at lines 947-1523. Ordinary border rotation is normalized and rounded to the nearest quarter turn; 90 and 270 degrees swap content width and height. Incircle mode preserves the exact angle and replaces both local content half-extents with `sqrt(2)` times their maximum. Side extensions remain `2 * halfHeight * cot(angle)`. Visible corners and the independently mitered outer-separation corners are rotated only after local geometry is complete.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`, trapezium section at lines 161-270. The manual's `shape border uses incircle, shape border rotate=60` example confirms that text stays upright while the border and its side/corner anchors rotate.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex` and `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex`. These establish node-border clipping and separate terminal-arrow painting.

## Third-Party Reference

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. PNG conversion used
`/opt/homebrew/bin/rsvg-convert`; native references used local MacTeX
`pdflatex`.

Before artifacts:
`outputs/qa/2026-09-05-shapes-trapezium-rotation-before/`

After artifacts:
`outputs/qa/2026-09-05-shapes-trapezium-rotation-after/`

Each directory contains TikZKit SVG/PNG, tikztosvg input/SVG/PNG, MacTeX PNG
and logs, diff PNGs, and native four-panel sheets. The reference SVGs use an
explicit four-line closed path with `fill-rule="nonzero"`, butt caps, miter
joins, and a page-level Y-axis flip. Arrow tips are separate filled paths with
their own transforms. Representative tikztosvg viewBoxes are `252.342 x
120.332pt` for the flowchart, `56.365 x 58.678pt` for mathematics, and
`187.906 x 122.99pt` for physics.

## Visual Acceptance

Before the fix, TikZKit painted all three trapezia horizontally. The flowchart
review wedge became a flat input/output box, the mathematics guide lines used
the wrong topology, and the physics detector's incoming and outgoing arrows
clipped against an unrotated contour.

After the fix, the native sheets show the same visible 32, 60, and -28 degree
border rotations as MacTeX and tikztosvg. The flowchart connector leaves the
rotated right flank and both guide lines start at their named anchors. The
mathematics width, height, and numeric-angle guides reach the same sides. The
physics arrows terminate on the detector contour, and the left-side and
top-right guide points follow the rotated shape. Text remains upright in all
three cases. No shape, arrow, guide, label, color, or layer is missing.

The flowchart raster differs from tikztosvg by 1 pixel in width, physics by 1
pixel in both dimensions, and mathematics by 7 by 1 pixels. The remaining
visible differences are TeX glyph outlines and raster antialiasing; the former
missing rotation and anchor errors are gone. Diagnostics remain zero for all
three cases.

## Implemented Commands And Parameters

Implemented and exercised in this slice:

- Commands and environments: `\node`, `\draw`, `\fill`, `tikzpicture`, and named-node coordinate references.
- Shape keys: `trapezium`, `trapezium left angle`, `trapezium right angle`, `trapezium angle`, `shape border rotate`, `shape border uses incircle`, `minimum width`, `minimum height`, and `inner sep`.
- Anchors: all four corners, all four sides, compass anchors, numeric angle anchors, `base east/west`, and `mid east/west`.
- Shared behavior: quarter-rounded ordinary rotation, exact incircle rotation, content-axis swapping, cotangent side extensions, mitered outer separation, connector clipping, arrow-tip terminal padding, and rotated bounds.
- Supporting options: fill/draw colors, line widths, dashes, relative positioning, upright text, and Latex arrow tips.

Not completed by this slice:

- Degenerate trapezium angles at 0 or 180 degrees retain TikZKit's guarded finite-angle behavior.
- Arbitrary-angle rotation without `shape border uses incircle` intentionally follows PGF's quarter-turn rounding.
- Remaining partial geometric shapes and their degenerate angular ranges are outside this boundary.

All three fixture reviews pass the strict semantic gate. The flowchart covers
7 commands, 23 options, and 19 numeric semantics; mathematics covers 8, 17,
and 9; physics covers 9, 20, and 18. Every detected item is reviewed and backed
by test evidence.

## Verification

```bash
node --test test/shapes-geometric-trapezium-stretches.test.js
node --test --test-name-pattern=trapezium test/interpreter.test.js
node scripts/case-semantic-audit.js test/fixtures/examples/shapes/trapezium-rotation-flowchart.tex --review test/fixtures/examples/shapes/trapezium-rotation-flowchart.review.json --strict
node scripts/case-semantic-audit.js test/fixtures/examples/shapes/trapezium-rotation-math.tex --review test/fixtures/examples/shapes/trapezium-rotation-math.review.json --strict
node scripts/case-semantic-audit.js test/fixtures/examples/shapes/trapezium-rotation-physics.tex --review test/fixtures/examples/shapes/trapezium-rotation-physics.review.json --strict
node scripts/render-example-fixtures.js \
  --output outputs/qa/2026-09-05-shapes-trapezium-rotation-after \
  --only shapes-trapezium-rotation-flowchart \
  --only shapes-trapezium-rotation-math \
  --only shapes-trapezium-rotation-physics \
  --native-reference --native-latex-engine pdflatex \
  --tikztosvg-engine pdflatex --strict-tikztosvg \
  --comparison-grid-mode svg
node scripts/diff-example-pngs.js \
  --output outputs/qa/2026-09-05-shapes-trapezium-rotation-after
```

The focused geometry suite passes 5/5. Rendering produces 3/3 TikZKit,
tikztosvg, and MacTeX artifacts with zero diagnostics and zero external
failures. The complete suite reports 2208 passing tests, the same 132 existing
historical failures, and 14 skips; the two additional passes are the new
rotation regressions, so this slice adds no failing test.
