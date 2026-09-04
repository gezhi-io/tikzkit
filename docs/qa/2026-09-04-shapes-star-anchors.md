# shapes.geometric star anchor QA

## Scope

This slice implements PGF star named `outer point n` and `inner point n` anchors, compass anchors, positioning bounds, `outer sep` miter geometry, and automatic edge clipping. It does not claim the remaining cylinder anchor family or arbitrary non-quarter cylinder rotations.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex`, star declaration lines 349-667: natural radii, ratio/height selection, minimum-size adjustment, start angle, numbered anchors, and alternating-polygon border intersection.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`: public `star points`, `star point ratio`, `star point height`, `star rotate`, and named-anchor behavior.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`: node path construction, anchor lookup, and automatic border clipping.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarypositioning.code.tex`: placement relative to final shape anchor bounds.

The important source distinction is that the visible background path uses the unexpanded inner and outer radii. Anchor geometry uses two separately expanded radii. For each vertex class, PGF adds `outer sep * csc(half vertex angle)`, then intersects a ray with the alternating inner/outer anchor contour.

## Three-way artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg` and used with the local `pdflatex` engine. All three cases produced TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG, grid SVG/PNG, and diff sheets under:

`outputs/qa/2026-09-04-shapes-star-anchors/`

Cases:

- `shapes-star-anchors-flowchart`
- `shapes-star-anchors-math`
- `shapes-star-anchors-physics`

The tikztosvg SVG uses a tight point-based `viewBox`, glyph paths inside `<defs>`, `fill-rule="nonzero"`, butt line caps, miter joins, and a matrix that flips the TeX y axis. Its star is one closed path. Arrow tips are transformed filled paths rather than browser marker elements. TikZKit preserves the same closed alternating contour, paint order, miter joins, and terminal orientation while retaining browser text backed by bundled Computer Modern fonts.

## Visual acceptance

- Flowchart: the six-point event star, automatic left/right arrows, numbered outer point, numbered inner valley, colors, stroke widths, and layers match the MacTeX and tikztosvg references. The explicit anchor markers sit beyond the visible paint by the source miter distance.
- Mathematics: five-point rotation, `p_1`/`p_3` outer points, `q_1`/`q_3` inner valleys, guide rays, and labels agree across all three renders. The formula was moved below the lowest point label in the fixture itself so the reference remains readable.
- Physics: the eight-point source, detector ray, shield ray, shadow ray, and both named point markers agree in direction and placement. The automatic detector ray starts at the actual concave border rather than a circular or rectangular approximation.
- Diagnostics are empty for all three cases. The remaining PNG dimension differences are 5-13 pixels and follow text/crop bounds; the star geometry and anchor locations visibly align.

Before this slice, named star points stayed on the paint radii and automatic edges used generic shape geometry. After the slice, paint and anchor contours are deliberately separate, all numbered and compass anchors use the expanded contour, and positioning and edge clipping consume the same geometry record.

## Tests

- `node --test test/shapes-geometric-star-anchors.test.js`
- `node --test --test-name-pattern=PGF.star.radius test/interpreter.test.js`
- strict semantic audit for each of the three cases
- fixture rendering with MacTeX and tikztosvg

## Remaining work

`shapes.geometric` remains partial for arbitrary non-quarter cylinder rotation/incircle behavior, the complete cylinder radial/mid/base anchor family, and degenerate angular ranges.
