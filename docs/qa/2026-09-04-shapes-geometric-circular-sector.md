# shapes.geometric circular sector QA (2026-09-04)

## Scope

- Selected slice: the `circular sector` node family from `shapes.geometric`.
- Priority: the library has 40 registered cases and remained partial; circular sectors previously fell back to a rectangle.
- Boundary: `circular sector angle`, content/incircle and minimum sizing, quarter-rounded or exact border rotation, visible and outer-separation contours, named/compass/numeric anchors, positioning bounds, and automatic edge clipping.
- Excluded: singular sector angles, unrelated geometric shapes, and exact glyph-outline reproduction by the browser text renderer.

## Local PGF source review

Reviewed these installed TeX Live 2025 files before implementation:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex`, circular-sector declaration at lines 3542-4019. PGF normalizes the angle modulo 360 and works with its half-angle. Natural sizing uses the half text dimensions, `cot(angle/2)` for the text-to-sector-center offset, and a vector length for the radius. Incircle mode uses `sqrt(2)` times the larger half dimension and `csc(angle/2)`.
- The same source scales radius and center offset together for minimum width and height. Normal border rotation rounds to the nearest quarter turn and swaps the content dimensions at 90/270 degrees; incircle mode keeps the requested angle.
- The same source keeps visible paint points separate from the outer-separation contour. Sector-center and arc-corner miters use half-angle cosecant/cotangent terms. `anchorborder` intersects a ray with a side segment, a corner segment, or the expanded circular arc.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`, circular-sector section at lines 634-671. It confirms the angle key, sector/arc named anchors, compass anchors, and border-rotation behavior.

## Reference artifacts

- Local `tikztosvg`: `/Library/TeX/texbin/tikztosvg`.
- QA root: `outputs/qa/2026-09-04-shapes-geometric-circular-sector/`.
- TikZKit SVG/PNG: `tikzkit-svg/` and `tikzkit-png/`.
- tikztosvg SVG/PNG: `tikztosvg-svg/` and `tikztosvg-png/`.
- MacTeX native PNG: `mactex-png/`.
- One-centimeter grids, raw diffs, and four-way sheets: `tikzkit-grid-*`, `tikztosvg-grid-*`, `diff-png/`, and `diff/`.

All three cases rendered through TikZKit, tikztosvg, and MacTeX with zero diagnostics and zero external-render failures.

## Visual review

Reviewed every `*-native-sheet.png` at original resolution:

- `shapes-circular-sector-flowchart`: the rectangular fallback is replaced by a 72-degree circular sector. Incoming and outgoing arrows meet the curved arc and sector tip; the return path uses the named sector-center and arc-end anchors. The contour, spacing, line widths, colors, labels, and orthogonal route agree visibly with MacTeX. The final raster differs by one pixel in height.
- `shapes-circular-sector-math`: the 80-degree sector, 36mm/30mm minimum constraints, mitered sector/arc anchors, dashed radii, and red anchor marks agree with MacTeX. Corresponding outline coordinates differ by about 0.1-0.3pt. The browser's `svg-text` fraction is wider than TeX's glyph outlines, so the red `M` and the formula have less visual separation; the anchor itself is not displaced.
- `shapes-circular-sector-physics`: incircle mode preserves the exact 28-degree rotation. The sensor field, visible arc, two named-anchor vectors, arrow tips, fills, labels, and line widths agree visibly with MacTeX. The final raster differs by one pixel in height/width.

TikZKit emits one closed cubic-arc path with `stroke-linecap="butt"` and `stroke-linejoin="miter"`. tikztosvg emits the equivalent sector path, TeX glyph-outline paths, and an inverted-y transform. MacTeX is the acceptance reference.

## Semantic coverage

Implemented and audited in the three fixtures:

- Dependencies: `tikz`; `arrows.meta`, `calc`, `positioning`, and `shapes.geometric`.
- Commands/environments: `\documentclass`, `\usepackage`, `\usetikzlibrary`, `document`, `tikzpicture`, `\node`, `\draw`, and `\fill`.
- Circular-sector options: `circular sector`, `circular sector angle`, `minimum width`, `minimum height`, `outer sep`, `shape border rotate`, and `shape border uses incircle`.
- Anchors: `sector center`, `arc start`, `arc end`, `arc center`, center/base/mid, compass and numeric border anchors, positioning bounds, and automatic edge clipping.
- Shared styles and paths: `.style`, `right=of`, `node distance`, `--`, `|-`, relative polar coordinates, local arrow dimensions, fills, line widths, and dash styles.

Not implemented or not claimed by this slice:

- Singular or degenerate circular-sector angles near 0 or 360 degrees.
- Exact browser reproduction of TeX glyph-outline widths and final raster rounding.
- Unrelated remaining `shapes.geometric` families.

## Verification

- `node --test test/shapes-geometric-circular-sector.test.js`
- Strict semantic audits for all three fixtures.
- Three-way fixture rendering with zero diagnostics and zero external-render failures.
- `node scripts/diff-example-pngs.js --output outputs/qa/2026-09-04-shapes-geometric-circular-sector`
- Focused neighboring geometric-shape tests, full `npm test`, and package dry-run before commit.

Acceptance: passed. Circular-sector nodes now use PGF-derived sizing, paint, rotation, anchor, positioning, and clipping geometry instead of a rectangular fallback.
