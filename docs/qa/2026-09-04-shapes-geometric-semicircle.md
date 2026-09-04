# shapes.geometric semicircle QA (2026-09-04)

## Scope

- Selected slice: the `semicircle` node family from `shapes.geometric`.
- Implemented here: PGF content/minimum sizing, shifted circle center, curved arc/chord paint, quarter-turn `shape border rotate`, outer-separation anchor contour, documented named anchors, and automatic edge clipping.
- Real drivers: one flowchart, one mathematical diagram, and one physics diagram.
- Out of scope: `kite`, `dart`, `circular sector`, and exact arbitrary-angle incircle metrics.

## Local MacTeX review

Reviewed `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex`, especially the semicircle declaration at lines 1523-1980:

- The half content width is the text half-width plus inner x separation; the half content height includes text height, depth, and inner y separation.
- Without incircle mode, the natural radius is `hypot(half width, 2*half height)`. `minimum width` constrains twice the radius, while `minimum height` constrains the radius directly.
- Increasing the radius shifts the circle center by `-halfheight - .4*(radius-default radius)` instead of leaving the text at the geometric center.
- Default border rotation is rounded to 90-degree increments, and 90/270 degrees swap the content dimensions before sizing.
- The visible path is a 0-to-180-degree circular arc closed by its chord. The anchor border is separately expanded by the larger outer separation.
- `arc start` and `arc end` include the chord-side outer separation; `apex`, `chord center`, compass, base, mid, and their east/west variants all resolve against this geometry.

Also reviewed `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`, which confirms the tight content fit, rotation behavior, and documented semicircle anchor names.

## tikztosvg reference

- Executable: `/Library/TeX/texbin/tikztosvg`.
- Engine: local `pdflatex`.
- tikztosvg SVG/PNG: `outputs/qa/2026-09-04-shapes-geometric-semicircle/tikztosvg-svg/` and `tikztosvg-png/`.
- MacTeX PNG: `outputs/qa/2026-09-04-shapes-geometric-semicircle/mactex-png/`.
- TikZKit SVG/PNG: `outputs/qa/2026-09-04-shapes-geometric-semicircle/tikzkit-svg/` and `tikzkit-png/`.
- Grid, diff, and native comparison sheets: `outputs/qa/2026-09-04-shapes-geometric-semicircle/*-grid-*`, `diff-png/`, and `diff/`.

The tikztosvg SVG uses point-sized dimensions and a `0 0 w h` viewBox, a matrix y-axis flip, two cubic `C` segments for the semicircular arc, a closing chord, nonzero fill, butt line caps, and miter joins. TeX text is emitted as reusable glyph paths and arrow tips as independent filled paths. TikZKit keeps live SVG text and an internal-unit viewBox, but now matches the same two-cubic arc/chord structure, cap/join choices, and independent border-clipped arrows.

## Visual review

### `shapes-semicircle-flowchart`

- Before: unsupported `semicircle` fell back to a rectangle, so the validation gate silhouette and all incoming/outgoing edge endpoints were wrong.
- After: the rotated semicircle has the same curved left edge and vertical chord as MacTeX. The retry loop meets the named chord/arc side correctly, and the left and right process arrows stop on the actual semicircle boundary.

### `shapes-semicircle-math`

- The diameter endpoints use `arc end` and `arc start`; the vertical dashed radius terminates at `apex`.
- The half-disc fill, circular arc, chord, endpoint dots, radius label, and domain caption align with MacTeX and tikztosvg.
- The final image dimensions match the reference exactly. Remaining red pixels are mainly browser text versus TeX glyph-outline rasterization.

### `shapes-semicircle-physics`

- The pressure boundary follows the half-disc rather than a symmetric node box.
- The sensor span uses the two arc/chord endpoints, and the red pointer begins at `chord center` with matching angle and length.
- Geometry aligns visually with both local references. A one-pixel image-height rounding difference and text rasterization remain outside this shape slice.

## Semantic coverage

Implemented and audited in the three fixtures:

- Dependencies: `tikz`; `arrows.meta`, `calc`, `positioning`, `shapes.geometric`.
- Commands/environments: `\documentclass`, `\usepackage`, `\usetikzlibrary`, `document`, `tikzpicture`, `\node`, `\coordinate`, `\draw`, and `\fill`.
- Shape options: `semicircle`, `minimum width`, `minimum height`, `inner sep`, `outer sep`, `shape border rotate`, `draw`, `fill`, and line-width styles.
- Anchors: `apex`, `arc start`, `arc end`, `chord center`, compass anchors, `base`, `mid`, `base east/west`, `mid east/west`, and automatic node-border clipping.
- Placement/path options: `right=of`, explicit anchors, `|-`, `--`, `<->`, `-Latex`, `thick`, `densely dashed`, relative offsets, and calc interpolation.

Not implemented or not claimed by this slice:

- `kite`, `dart`, and `circular sector` node families.
- Exact TeX metric parity for arbitrary-angle `shape border uses incircle` cases.
- Exact browser reproduction of tikztosvg glyph-outline text and final pixel rounding.

## Verification

- `node --test test/shapes-geometric-semicircle.test.js test/shapes-geometric-cylinder.test.js test/shapes-geometric-star-anchors.test.js test/shapes-geometric-trapezium-stretches.test.js`
- Strict semantic audit for all three new fixtures.
- Three-way fixture rendering with zero diagnostics and zero external-render failures.
- `node scripts/diff-example-pngs.js --output outputs/qa/2026-09-04-shapes-geometric-semicircle`
- Full `npm test` and package dry-run before commit.

Acceptance: passed. The rectangular fallback is gone, the three real diagrams visibly match the native geometry, all documented semicircle anchors under test resolve on the correct contour, and diagnostics remain zero.
