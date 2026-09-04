# shapes.geometric kite QA (2026-09-04)

## Scope

- Selected slice: the `kite` node family from `shapes.geometric`.
- Implemented here: independent upper/lower vertex angles, paired-angle shorthand, PGF content and minimum sizing, quarter-turn border rotation, arbitrary incircle rotation, separate painted and mitered anchor contours, documented anchors, and automatic edge clipping.
- Real drivers: one flowchart, one mathematical diagram, and one physics diagram.
- Out of scope: `dart`, `circular sector`, degenerate angle ranges, and arbitrary-angle incircle metrics for other geometric shapes.

## Local MacTeX review

Reviewed `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex`, especially the kite declaration at lines 2343-2995:

- The default upper vertex angle is 120 degrees and the lower angle is 60 degrees. `kite vertex angles=a and b` assigns both values, while one value assigns both angles.
- Ordinary border rotation is rounded to quarter turns; 90 and 270 degrees exchange the content width and height before construction. `shape border uses incircle` instead preserves an exact arbitrary angle.
- The normal construction divides content height using the cosine and sine of the two half angles. It derives the horizontal radius plus separate upper and lower vertical radii from this split.
- Incircle mode starts from `sqrt(2) * max(content half width, content half height)` and uses cosecant half-angle distances so rotated content remains inside the shape.
- `minimum height` and then `minimum width` uniformly scale the horizontal, upper, and lower radii, preserving the requested vertex angles.
- The painted polygon uses upper, left, lower, and right vertices. The anchor polygon is different: top and bottom receive a cosecant half-angle extension, while both side vertices use the adjacent-edge miter bisector.
- Side midpoint anchors, compass anchors, numeric border anchors, and base/mid east/west anchors all derive from that outer contour.

Also reviewed `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`, especially the kite section around lines 526-580. It confirms the angle keys, rotation behavior, named vertices and side anchors, compass anchors, and numeric border anchors.

## tikztosvg reference

- Executable: `/Library/TeX/texbin/tikztosvg`.
- Rasterizer: `/opt/homebrew/bin/rsvg-convert`.
- Engine: local `pdflatex`.
- tikztosvg SVG/PNG: `outputs/qa/2026-09-04-shapes-geometric-kite/tikztosvg-svg/` and `tikztosvg-png/`.
- MacTeX PNG: `outputs/qa/2026-09-04-shapes-geometric-kite/mactex-png/`.
- TikZKit SVG/PNG: `outputs/qa/2026-09-04-shapes-geometric-kite/tikzkit-svg/` and `tikzkit-png/`.
- Grid, diff, and native comparison sheets: `outputs/qa/2026-09-04-shapes-geometric-kite/*-grid-*`, `diff-png/`, and `diff/`.

The tikztosvg SVG uses a point-sized `0 0 w h` viewBox, a y-axis transform, a four-segment closed path for each kite, nonzero fill, butt line caps, and miter joins. Text is converted into reusable glyph paths and arrow tips are independent filled paths. TikZKit uses live SVG text and a larger internal-unit viewBox, while matching the same four vertices, fill rule, cap/join choices, and independent border-clipped arrow-tip paths.

## Visual review

### `shapes-kite-flowchart`

- Before: `kite` was not a recognized library shape and fell back to an ordinary rectangular node, so the gate silhouette, placement width, named vertex anchors, and three connecting paths were incorrect.
- After: the 90-degree rotated 100/50-degree kite matches MacTeX. The left process arrow stops on the sloping boundary, the lower-vertex output reaches `Accept`, and the right-vertex retry path starts at the outer-separated miter anchor.
- TikZKit, tikztosvg, and native MacTeX agree on the gate position, asymmetric silhouette, and retry route. The browser image is one pixel smaller in each dimension because of final raster rounding.

### `shapes-kite-math`

- The 110/55-degree shape and its 36-by-46 mm minimum dimensions match both local references.
- Named upper/right/lower/left vertices place the two diagonals, four red points, and `A` through `D` labels at the correct locations.
- The formula remains centered below the horizontal diagonal. Remaining diff pixels come primarily from live browser math text versus TeX glyph outlines; the reference and browser widths differ by one pixel.

### `shapes-kite-physics`

- Incircle mode keeps the content-safe kite dimensions while applying the exact 18-degree border rotation.
- Both diagonals terminate at the visible vertices. Lift and gravity originate at the center, while tension begins at the rotated lower vertex.
- The rotated polygon, all three force arrows, arrow-tip angles, and labels visually align with MacTeX and tikztosvg. The browser canvas differs by two pixels in final height rounding.

## Semantic coverage

Implemented and audited in the three fixtures:

- Dependencies: `tikz`; `arrows.meta`, `calc`, `positioning`, and `shapes.geometric`.
- Commands/environments: `\documentclass`, `\usepackage`, `\usetikzlibrary`, `document`, `tikzpicture`, `\node`, `\draw`, and `\fill`.
- Kite options: `kite`, `kite upper vertex angle`, `kite lower vertex angle`, `kite vertex angles`, `minimum width`, `minimum height`, `outer sep`, `shape border rotate`, and `shape border uses incircle`.
- Anchors: upper/lower/left/right vertex, four side midpoints, compass, center, base/mid and their east/west variants, numeric border anchors, and automatic edge clipping.
- Shared styles and paths: `.style`, `right=of`, `node distance`, `--`, `|-`, `pos`, `above`, relative polar coordinates, local arrow dimensions, fills, line widths, and dash styles.

Not implemented or not claimed by this slice:

- `dart` and `circular sector` node families.
- Undefined/degenerate kite angle combinations close to 0 or 360 degrees.
- Arbitrary-angle incircle parity for other geometric node families.
- Exact browser reproduction of tikztosvg glyph-outline text and final pixel rounding.

## Verification

- `node --test test/shapes-geometric-kite.test.js`
- Strict semantic audits for all three new fixtures.
- Three-way fixture rendering with zero diagnostics and zero external-render failures.
- `node scripts/diff-example-pngs.js --output outputs/qa/2026-09-04-shapes-geometric-kite`
- Focused neighboring geometric-shape tests, full `npm test`, and package dry-run before commit.

Acceptance: passed. The rectangular fallback is gone, all three diagrams visibly match the native geometry, named and numeric anchors use PGF's outer contour, and diagnostics remain zero.
