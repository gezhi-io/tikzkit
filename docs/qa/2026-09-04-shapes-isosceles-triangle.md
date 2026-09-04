# shapes.geometric isosceles triangle QA (2026-09-04)

## Scope

- Selected slice: the `isosceles triangle` node family from `shapes.geometric`.
- Priority: the library is high-use and still partial. The previous implementation treated the triangle as a symmetric three-point polygon, so content sizing, stretch mode, the shifted text center, outer separation, compass anchors, and automatic clipping did not follow PGF.
- Boundary: content and incircle sizing, default and independently stretched minimum dimensions, text-center offset, quarter-rounded and exact border rotation, visible and outer contours, named/compass/numeric/base/mid anchors, positioning bounds, and automatic edge clipping.
- Excluded: unrelated geometric shapes and singular apex-angle inputs at or near 0 or 180 degrees.

## Local PGF source review

Reviewed these installed TeX Live 2025 files before implementation:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex`, especially the declaration at lines 1985-2343. The natural shape points along positive x. Half content width and height derive the apex axis and half-base through cotangent and tangent terms. The content center is deliberately not the geometric center.
- The same declaration applies minimum width before minimum height. Default mode changes the paired dimension to preserve the requested apex angle; `isosceles triangle stretches` changes each dimension independently and recomputes the effective half-apex angle. An empty node first receives the requested minimum height without prematurely deriving a base width.
- Its outer anchor contour uses the larger outer x/y separation. The apex is extended by the original half-angle cosecant, while each base corner uses the cotangent of half the exterior corner angle. Paint remains on the unexpanded triangle.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`, isosceles triangle section around lines 445-515. It confirms stretch behavior, shape-border rotation, incircle mode, and the apex/corner/side anchor catalog.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduleshapes.code.tex`, lines 884-896. It establishes the PGF defaults `minimum width=1pt` and `minimum height=1pt`, which prevent an unspecified dimension from degenerating.

## Reference artifacts

- Local `tikztosvg`: `/Library/TeX/texbin/tikztosvg`.
- QA root: `outputs/qa-shapes-isosceles-triangle-2026-09-04/`.
- TikZKit SVG/PNG: `tikzkit-svg/` and `tikzkit-png/`.
- tikztosvg SVG/PNG: `tikztosvg-svg/` and `tikztosvg-png/`.
- MacTeX native PNG: `mactex-png/`.
- One-centimeter grids, raw diffs, and four-way sheets: `tikzkit-grid-*`, `tikztosvg-grid-*`, `diff-png/`, and `diff/`.

All three cases rendered through TikZKit, tikztosvg, and MacTeX with zero diagnostics and zero external-render failures.

tikztosvg emits one closed triangle path per node with `fill-rule="nonzero"`, `stroke-linecap="butt"`, and `stroke-linejoin="miter"`. Its ordinary diagrams use an inverted-y matrix; the rotated physics case also uses quarter-turn matrices for arrow tips and glyph outlines. TikZKit keeps text as embedded-font SVG text but now emits the same visible vertices and miter joins.

## Visual review

Reviewed every `*-native-sheet.png` at original resolution. Sheet order is MacTeX, tikztosvg, TikZKit, then the TikZKit/tikztosvg diff.

- `shapes-isosceles-triangle-flowchart`: the route node now has the same independently stretched 18mm by 28mm triangle as both references. Incoming and outgoing arrows terminate at the west border and apex, the two corner markers land on the named anchors, and node spacing, colors, text, line widths, and Stealth tips agree visibly. TikZKit is three pixels narrower overall because of browser text-bound rounding.
- `shapes-isosceles-triangle-math`: the fixed-angle triangle expands to the apex-angle-derived base width, while the stretched triangle stays 3cm high and exactly 2cm wide. Both share the lower-side baseline, the red corner dimension and blue apex-axis dimension land on the same coordinates, and all three raster canvases are 314 by 200 pixels. Before the final correction, TikZKit incorrectly derived a natural base immediately after setting the empty node's minimum height and made the stretched triangle as wide as the fixed-angle triangle.
- `shapes-isosceles-triangle-physics`: the 90-degree shape-border rotation, 42-degree apex, two support points, three force vectors, dashed support line, labels, fills, and named-anchor starts agree visibly. The two-pixel width and one-pixel height difference come from text/raster crop rounding, not shape displacement.

## Semantic coverage

Implemented and audited in the three fixtures:

- Dependencies: `tikz`; `arrows.meta`, `positioning`, and `shapes.geometric`.
- Commands/environments: `\documentclass`, `\usepackage`, `\usetikzlibrary`, `document`, `tikzpicture`, `\node`, `\draw`, `\fill`, and `\small`.
- Shape options: `isosceles triangle`, `isosceles triangle apex angle`, `isosceles triangle stretches`, `minimum width`, `minimum height`, `minimum size`, `inner sep`, `inner xsep`, `inner ysep`, `outer sep`, `outer xsep`, `outer ysep`, `shape border rotate`, and `shape border uses incircle`.
- Anchors: `apex`, `left corner`, `right corner`, `left side`, `right side`, `lower side`, center/text/base/mid, base east/west, mid east/west, compass, numeric border, positioning bounds, and automatic edge clipping.
- Shared options: named styles, `right=of`, `node distance`, `anchor`, `rotate`, relative coordinates, fills, line widths, arrow tips, and dash styles.

Not implemented or not claimed by this slice:

- Singular or nearly singular apex angles where tangent/cosecant geometry is undefined.
- Exact browser reproduction of TeX glyph-outline paths, antialiasing, and final subpixel crop rounding.
- Other still-partial `shapes.geometric` families.

## Verification

- `node --test --test-name-pattern='isosceles triangle' test/interpreter.test.js`
- Strict semantic audits for all three fixtures.
- Three-way fixture rendering with zero diagnostics and zero external-render failures.
- `node scripts/diff-example-pngs.js --output outputs/qa-shapes-isosceles-triangle-2026-09-04`
- Full `npm test` was run. The repository still has its existing unrelated baseline failures (including circuitikz semantic ownership, datavisualization, chronology, and pgfplots cases); no isosceles-triangle test failed.
- Registry regeneration completed with 77 entries and 519 core cases.
- Package dry-run passed for `@gezhi-io/tikzkit@0.1.3` using a clean temporary npm cache.

Acceptance: passed. The three real diagrams visibly reproduce PGF's isosceles-triangle dimensions, center offset, rotation, named anchors, outer-separation contour, and path clipping.
