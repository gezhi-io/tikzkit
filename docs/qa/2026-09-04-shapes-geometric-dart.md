# shapes.geometric dart QA (2026-09-04)

## Scope

- Selected slice: the `dart` node family from `shapes.geometric`.
- Priority: the family was still unsupported inside a high-use partial library; it previously fell back to a rectangle, so the error was immediately visible in flowcharts and geometry diagrams.
- Boundary: `dart tip angle`, `dart tail angle`, content and minimum sizing, quarter-rounded border rotation, exact incircle rotation, concave paint, outer-separation miter geometry, named/compass/base/mid/numeric anchors, positioning bounds, and automatic edge clipping.
- Excluded: `circular sector`, undefined or degenerate dart angle combinations, and unrelated geometric node families.

## Local PGF source review

Reviewed these installed TeX Live 2025 files before implementation:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex`, especially the dart declaration at lines 2995-3540. PGF halves both angles, computes the tip with `cot(tip/2)`, derives the tail separation from `sin(tip/2) cos(tip/2) / sin((tail-tip)/2)`, and obtains total length and concave tail depth from that separation. Minimum height constrains total axial length; minimum width constrains the tail separation; both operations uniformly scale every derived dimension.
- The same source separates visible vertices from four outer-separation miter vertices. Tip and tail-center extensions use the cosecant of their half angles. Each tail uses the cosecant of half the difference between tail and tip half angles. Named anchors and `anchorborder` use this mitered contour, while `backgroundpath` uses the visible contour.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`, dart section at lines 580-630. The manual confirms the tip/tail keys, border-rotation semantics, six dart-specific anchors, base/mid families, compass anchors, and numeric border anchors.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/math/pgfmathfunctions.trigonometric.code.tex`, `\pgfmathsincos@`. It establishes that `resultx` is cosine and `resulty` is sine, which fixes the signs and components of the left/right tail miter vectors.

## Reference artifacts

- Local `tikztosvg`: `/Library/TeX/texbin/tikztosvg`.
- QA root: `outputs/qa/2026-09-04-shapes-geometric-dart/`.
- TikZKit SVG/PNG: `tikzkit-svg/` and `tikzkit-png/`.
- tikztosvg SVG/PNG: `tikztosvg-svg/` and `tikztosvg-png/`.
- MacTeX native PNG: `mactex-png/`.
- One-centimeter grids, raw diffs, and four-way sheets: `tikzkit-grid-*`, `tikztosvg-grid-*`, `diff-png/`, and `diff/`.

All three cases rendered through TikZKit, tikztosvg, and MacTeX with zero diagnostics and zero external-render failures.

## Visual review

Reviewed every `*-native-sheet.png` at original resolution:

- `shapes-dart-flowchart`: before this slice the dispatch node was a rectangle. It is now a right-pointing concave dart. Receive-to-route automatic clipping ends on the recessed tail-center border; the route-to-send path begins at the tip; the return path begins at the named right tail. Shape size, node spacing, fills, arrow tips, labels, and orthogonal path agree visibly with MacTeX. The raster canvas differs by one pixel in height due to text-bound rounding.
- `shapes-dart-math`: the 55-degree tip, 125-degree tail, 50mm axial minimum, 34mm tail separation, visible concavity, symmetry lines, and all four marked vertex anchors agree with MacTeX. The red marks sit on the mitered outer-separation anchors rather than the fill vertices in all three renderers. The browser formula has a small glyph-baseline/outline difference, but no geometry or anchor displacement.
- `shapes-dart-physics`: incircle mode preserves the exact 28-degree rotation. The four visible vertices, three named-anchor vectors, local Stealth tips, colors, line widths, and labels agree with MacTeX. The blue side paths connect the outer miter anchors in every reference, so their slight offset from the green fill is intentional. The final raster differs by one pixel in height.

The TikZKit SVG uses a single closed concave path with `stroke-linecap="butt"` and `stroke-linejoin="miter"`. tikztosvg emits the same four-segment closed path and the same cap/join semantics, but converts text to glyph-outline paths and applies an inverted-y matrix. For the rotated physics case, corresponding dart vertices differ by only about 0.2-0.3pt; MacTeX remains the acceptance reference.

## Semantic coverage

Implemented and audited in the three fixtures:

- Dependencies: `tikz`; `arrows.meta`, `calc`, `positioning`, and `shapes.geometric`.
- Commands/environments: `\documentclass`, `\usepackage`, `\usetikzlibrary`, `document`, `tikzpicture`, `\node`, `\draw`, and `\fill`.
- Dart options: `dart`, `dart tip angle`, `dart tail angle`, `minimum width`, `minimum height`, `outer sep`, `shape border rotate`, and `shape border uses incircle`.
- Anchors: tip, left/right tail, tail center, left/right side, compass, center, base/mid and their east/west variants, numeric border anchors, positioning bounds, and automatic edge clipping.
- Shared styles and paths: `.style`, `right=of`, `node distance`, `--`, `|-`, `pos`, relative polar coordinates, local arrow dimensions, fills, line widths, and dash styles.

Not implemented or not claimed by this slice:

- `circular sector` node family.
- Undefined/degenerate dart angle combinations at or near singular trigonometric ranges.
- Exact browser reproduction of tikztosvg glyph-outline text and final raster rounding.

## Verification

- `node --test test/shapes-geometric-dart.test.js`
- Strict semantic audits for all three fixtures.
- Three-way fixture rendering with zero diagnostics and zero external-render failures.
- `node scripts/diff-example-pngs.js --output outputs/qa/2026-09-04-shapes-geometric-dart`
- Focused neighboring geometric-shape tests, full `npm test`, and package dry-run before commit.

Acceptance: passed. The rectangular fallback is gone; all three real diagrams visibly reproduce PGF's dart geometry, rotation, anchor contour, and path clipping.
