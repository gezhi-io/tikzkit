# Shapes.Geometric Trapezium Miters

## Scope

This pass is deliberately limited to the default `shapes.geometric`
trapezium construction and the shared curved terminal-arrow border crop. It
does not claim full `shapes.geometric` or full arrow compatibility. The driver
is `test/fixtures/arrows/shape-curved-terminal-miters.tex`.

The registry had `arrows` as the highest-case-count partial library (91 cases).
The previous crop code offset one selected polygon side. That is wrong around a
trapezium corner: PGF expands every side and uses the intersection of the
expanded side lines, so a ray can land on the mitered contour rather than the
first adjacent side.

## Local PGF Reading

Reviewed local MacTeX sources on 2026-08-07:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`, where TikZ asks the target shape for `\\pgfpointshapeborder` before placing a path terminal;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex`, especially `\\installtrapeziumparameters` and trapezium `anchorborder`;
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`.

The source derives the left and right horizontal side extensions from
`2 * half-height * cot(angle)`. For the normal trapezium, minimum-size growth
scales the body, height, and those extensions together, retaining both side
angles. The source builds mitered corners by intersecting the outer-separation
offset lines; its border ray tests that expanded contour.

## Third-Party and Native References

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; `rsvg-convert` was
found at `/opt/homebrew/bin/rsvg-convert`. The validation run used local
`pdflatex`, `tikztosvg`, and `rsvg-convert` successfully:

- MacTeX PNG: `/private/tmp/tikzkit-qa-arrow-shape-miters-validated-2026-08-07/mactex-png/arrows-shape-curved-terminal-miters.png`
- TikZKit SVG/PNG: `/private/tmp/tikzkit-qa-arrow-shape-miters-validated-2026-08-07/tikzkit-svg/arrows-shape-curved-terminal-miters.svg` and `/private/tmp/tikzkit-qa-arrow-shape-miters-validated-2026-08-07/tikzkit-png/arrows-shape-curved-terminal-miters.png`
- tikztosvg SVG/PNG: `/private/tmp/tikzkit-qa-arrow-shape-miters-validated-2026-08-07/tikztosvg-svg/arrows-shape-curved-terminal-miters.svg` and `/private/tmp/tikzkit-qa-arrow-shape-miters-validated-2026-08-07/tikztosvg-png/arrows-shape-curved-terminal-miters.png`
- Four-panel sheet: `/private/tmp/tikzkit-qa-arrow-shape-miters-validated-2026-08-07/diff/arrows-shape-curved-terminal-miters-native-sheet.png`

I inspected the four-panel sheet and both grid outputs. MacTeX and tikztosvg
agree on the sloping trapezium sides and the orange terminal arrow. The
tikztosvg SVG uses ordinary `path` elements, `stroke-linecap="butt"`,
`stroke-linejoin="miter"`, a flipped outer transform, and explicit filled
arrowhead paths (`fill-rule="nonzero"`), not SVG marker references. Its root
viewBox is `336.79pt x 265.32pt`.

## Visible Change

Before this pass, the JS trapezium used a heuristic width increment and an
arbitrary side-normal crop. It was not the PGF four-side cotangent geometry,
and a thick curve aimed between the top and right expanded rays picked the
wrong side. The pre-change orange tip transform was
`translate(652.004051 226.72409)`.

After the change, one source-level layout function is shared by evaluation and
SVG rendering. The trapezium now has four source-derived sides and the crop
uses the intersection of all offset side lines for convex polygons. The same orange tip is now at
`translate(615.94006 236.050872)`, on the shared miter contour. This is a
visible terminal-placement correction, not a per-case coordinate patch.

The sheet still exposes residual differences: TikZKit is `456 x 378px` while
tikztosvg is `450 x 354px`; the TikZKit star and overall picture bbox are not
yet native-identical. The direct raster comparison therefore remains a
dimension mismatch (8,435 changed of 159,300 compared pixels). Those figures
are only supporting evidence; the accepted improvement is the corrected
trapezium construction and corner-terminal placement seen in the inspected
panels.

## Implemented Slice

Implemented and covered in the driver:

- `\\node`, `\\draw`, curved `to`, `out`, `in`, `line width`, color mixes, and
  `-{Latex[length=4mm,width=3mm]}`;
- `rectangle`, `diamond`, `star`, and the default `trapezium` shape;
- `trapezium left angle`, `trapezium right angle`, `minimum width`,
  `minimum height`, `minimum size`, `x`, and `y`;
- source-derived default trapezium scaling and mitered convex-polygon border rays.

Known incomplete or intentionally out of scope:

- `trapezium stretches` and `trapezium stretches body`;
- degenerate or arbitrary full-angle trapezium modes;
- exact star sizing/rotation and every custom or concave shape's native border
  behavior;
- picture bbox and text-metric parity visible in this sheet;
- tip-specific separation options and complete declared-arrow hull semantics.

## Code and Verification

Changed files:

- `src/tikz/libraries/shapes.geometric.js`
- `src/engine/evaluate.js`
- `src/renderers/svg/nodeShapes.js`
- `src/tikz/libraries/arrows.js`
- `test/interpreter.test.js`
- `test/fixtures/arrows/shape-curved-terminal-miters.tex`

Verification passed:

```sh
node --check src/engine/evaluate.js
node --check src/tikz/libraries/shapes.geometric.js
node --check src/renderers/svg/nodeShapes.js
node --test --test-name-pattern='trapezium cotangent|curved terminal arrows beyond|geometric and symbol nodes|regular polygon sizing' test/interpreter.test.js
npm run case:audit -- test/fixtures/arrows/shape-curved-terminal-miters.tex --output docs/qa/2026-08-07-shapes-geometric-trapezium-miters-audit.md --strict
npm run gallery:audit
```

The focused regression suite is 4/4 passing. The stored one-case external
render used byte-identical fixture content before the fixture was moved out of
the numbered core corpus; that move preserves existing Case identifiers and
does not alter the visual reference. It completed with zero TikZKit diagnostics,
zero tikztosvg failures, and zero MacTeX failures. The generated semantic audit
remains `incomplete` because it
correctly requires explicit reviews for every parsed command, option, and
number; it is retained as inventory rather than misreported as full-case
acceptance.

## Next

Extend the same miter helper to source-derived star radii and concave corners,
then address the remaining JS picture bbox and font metrics in the visual
sheet. Keep `trapezium stretches` unadvertised until the interpreter and SVG
shape data carry the same mode-specific dimensions.
