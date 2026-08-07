# Regular polygon geometry and curved terminal arrows QA

## Scope

This pass accepts one bounded `shapes.geometric` and `arrows.meta` slice:

- regular-polygon content sizing and `minimum size` as a circumcircle diameter;
- odd/even default border orientation plus `shape border rotate` and
  `regular polygon rotate`;
- the PGF outer-separation mitre extension when a curved path ends in a
  terminal arrow on a regular polygon.

It does not claim the complete PGF border-anchor algorithm. Rectangle, diamond,
star, trapezium, custom shapes, and tip-specific padding/separation keys remain
outside this slice.

The permanent driver is
`test/fixtures/examples/arrows/regular-polygon-curved-terminal.tex`.

## Local MacTeX Study

Reviewed TeX Live 2025:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`:
  unanchored node references resolve through `\\pgfpointshapeborder`, so a
  curved `to` path must query the target border along its terminal tangent;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex`,
  regular-polygon definition (around lines 685-879): the content radius is
  `sqrt(2) * apothem * sec(180/sides)`, minimum sizes are circumcircle
  diameters, even-side polygons start at `90 - 180/sides`, odd-side polygons
  start at `90`, and outer separation grows the radius by `sec(180/sides)`;
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`,
  regular-polygon section: it confirms the incircle content fit and the default
  side, rather than corner, on the bottom of an even-sided polygon.

TikZKit now stores the computed start angle in the Scene Graph and uses the
same polygon for SVG paint and tangent-directed border intersection. The
terminal stroke padding is converted into PGF's polygon mitre radius before the
ray intersects the specific target side.

## Reference Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. It was invoked with
`--pdflatex`, then rendered through the installed `rsvg-convert`. The complete
after bundle is:

`/private/tmp/tikzkit-qa-regular-polygon-after-2026-08-07/`

- TikZKit SVG/PNG/grid: `tikzkit-svg/`, `tikzkit-png/`,
  `tikzkit-grid-png/`;
- tikztosvg SVG/PNG/grid: `tikztosvg-svg/`, `tikztosvg-png/`,
  `tikztosvg-grid-png/`;
- native MacTeX PNG: `mactex-png/arrows-regular-polygon-curved-terminal.png`;
- inspected three-way sheet and registered diff:
  `diff/arrows-regular-polygon-curved-terminal-native-sheet.png` and
  `diff-png/arrows-regular-polygon-curved-terminal-registered.png`.

The tikztosvg SVG uses a point-based `viewBox`, miter joins and butt caps. Its
flat-top hexagon is an explicit six-point path, while the rotated hexagon is a
second six-point path with the expected 15-degree orientation. Arrow bodies are
cubic `<path>` elements and their Latex tips are separately transformed filled
paths. TikZKit now emits the same renderer-neutral structure: polygon paths,
cubic bodies, and independently translated/rotated inline tips. It retains SVG
text rather than tikztosvg's glyph `<use>` groups, so text rasterization is not
expected to be pixel-identical.

## Visual Result

Before this change TikZKit used a `1.12` polygon-size heuristic and a fixed
90-degree start angle. The six-sided node was visibly point-up and undersized;
curved terminal arrows therefore met the wrong silhouette.

After the change the inspected TikZKit, tikztosvg, and MacTeX panels all show a
flat-top upper hexagon, a 15-degree rotated lower hexagon, and all three arrow
tips contacting their intended polygon side. The registered JS-to-tikztosvg
comparison records a three-pixel horizontal/one-pixel vertical best alignment;
the remaining changed pixels are concentrated on text glyphs, antialiasing,
and small canvas/bounding-box differences rather than the former polygon
orientation error. The diff metric is supporting evidence only; the accepted
result is the visible correction of shape direction, physical size, and arrow
contact.

## Regression and Commands

```sh
node --test --test-name-pattern='regular polygon|clips curved to-path arrows|extends curved arrow tips' \
  test/interpreter.test.js test/svg-renderer.test.js

npm run examples:render -- --fixtures test/fixtures/examples \
  --only arrows-regular-polygon-curved-terminal \
  --output /private/tmp/tikzkit-qa-regular-polygon-after-2026-08-07 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --tikztosvg-engine pdflatex
npm run examples:diff -- --output /private/tmp/tikzkit-qa-regular-polygon-after-2026-08-07 \
  --register --alignment-radius 3
```

The focused geometry regression passed: 4 tests, 0 failures. The strict
semantic audit records 1 package, 2 libraries, 7 commands, 16 option paths,
and 22 numeric literals as reviewed with 0 todos or blockers in
`docs/qa/2026-08-07-regular-polygon-curved-terminal-audit.md`. Render completed
all TikZKit, tikztosvg, and MacTeX SVG/PNG artifacts with 0 external failures
and 0 interpreter diagnostics.

## Remaining Work

The next useful slice is general polygonal border anchors: rectangle/diamond
terminal outer separation, then star and trapezium side selection. It should
reuse the same `nodeBorderPoint` contract and be accepted only with a native
three-way driver for each shape family.
