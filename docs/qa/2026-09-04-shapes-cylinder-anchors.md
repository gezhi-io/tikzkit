# shapes.geometric cylinder anchor family QA (2026-09-04)

## Scope

- Selected slice: the `shapes.geometric` cylinder named-anchor family.
- Implemented in this slice: `before top`, `top`, `after top`, `before bottom`, `bottom`, `after bottom`, `mid east`, `mid west`, `base east`, and `base west`.
- Shared behavior: outer-separation anchor geometry, quarter-turn border rotation, explicit node-anchor placement, and automatic border clipping use one cylinder geometry record.
- Out of scope: arbitrary non-quarter `shape border rotate` and `shape border uses incircle`.

## Local MacTeX review

Reviewed `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex`:

- Lines 4120-4132 enlarge both anchor ellipse radii by the larger outer separation while retaining the visible radii for painting.
- Lines 4156-4164 add `outer ysep` to the before/after tangent points before rotating the border.
- Lines 4182-4217 define the TeX midpoint and baseline reference points; `mid east/west` and `base east/west` cast horizontal rays from those references through `anchorborder`.
- Lines 4250-4283 derive the six end anchors from the two ellipse centers, tangent points, and expanded end radius.
- Lines 4284-4331 subtract the anchor expansion before painting the cylinder, confirming that paint and anchor contours are intentionally distinct.
- Lines 4332 onward select the side segment or ellipse arc and intersect it with the reference ray.

Also reviewed `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex` for `shape aspect`, quarter-turn `shape border rotate`, custom body/end fills, minimum dimensions, and the documented anchor names.

## tikztosvg reference

- Executable: `/Library/TeX/texbin/tikztosvg`.
- Engine: local `pdflatex`.
- Artifacts: `outputs/qa/2026-09-04-shapes-cylinder-anchors/tikztosvg-svg/` and `tikztosvg-png/`.
- MacTeX PNGs: `outputs/qa/2026-09-04-shapes-cylinder-anchors/mactex-png/`.
- TikZKit SVG/PNGs: `outputs/qa/2026-09-04-shapes-cylinder-anchors/tikzkit-svg/` and `tikzkit-png/`.
- Grid and diff sheets: `outputs/qa/2026-09-04-shapes-cylinder-anchors/*-grid-*` and `diff/`.
- Old TikZKit artifacts: `outputs/qa/2026-09-04-shapes-cylinder-anchors/before/`.

The tikztosvg SVG uses point-sized `width`/`height` with a `0 0 w h` viewBox, separate nonzero-fill body/end paths, `stroke-linecap="butt"`, `stroke-linejoin="miter"`, and a matrix that flips the TeX y axis. Arrow tips are independent filled paths rather than SVG markers. TeX text is converted to reusable glyph paths. TikZKit keeps live SVG text and an internal-unit viewBox, but now follows the same separate paint/anchor geometry and independent arrow-tip placement.

## Visual review

### `shapes-cylinder-anchors-flowchart`

- Before: the missing mid/base anchors fell back to a symmetric text rectangle. The ingest arrow stopped outside the left ellipse, and the right connections ignored the cylinder's asymmetric content center.
- After: ingest and query meet the actual `mid west/east` boundary; checkpoint starts at the baseline ray's right-ellipse intersection. The end chord, custom fills, stroke widths, and connection slopes match MacTeX and tikztosvg.

### `shapes-cylinder-anchors-math`

- The height dimension spans the expanded `bottom` and `top` anchors.
- The radius dimension starts at the midpoint of `before top`/`after top` and ends at `top`.
- Both tangent chords and endpoint dots align with the local references. Remaining red pixels in the diff are primarily live-text versus glyph-outline rasterization.

### `shapes-cylinder-anchors-physics`

- The 90-degree vessel end anchors rotate with the border.
- The pressure gauge is placed with `anchor=mid east`; its connector meets both the gauge and vessel borders.
- The base-east pressure tap and top/bottom height dimension align with both local references.
- A small global text/bounding-box difference remains; the flowchart SVG crop is about 9pt shorter than tikztosvg and belongs to a later text/bbox slice.

## Semantic coverage

Implemented and audited in the three fixtures:

- Dependencies: `tikz`; `arrows.meta`, `calc`, `positioning`, `shapes.geometric`.
- Commands/environments: `\documentclass`, `\usepackage`, `\usetikzlibrary`, `document`, `tikzpicture`, `\node`, `\coordinate`, `\draw`, `\fill`.
- Cylinder options: `cylinder`, `shape aspect`, `shape border rotate=90`, `minimum width`, `minimum height`, `inner sep`, `outer sep`, `cylinder uses custom fill`, `cylinder body fill`, `cylinder end fill`.
- Placement/path options: `anchor=mid east`, `right=of`, `align=center`, `-Latex`, `<->`, `thick`, `densely dashed`, relative `++`, and calc interpolation/offsets.
- Anchors: all six named end anchors, `shape center`, four mid/base side anchors, and automatic compass border clipping.

Not implemented in this slice:

- Arbitrary non-quarter cylinder border rotation.
- Cylinder incircle border mode.
- Exact reproduction of tikztosvg's glyph-outline text representation and global crop box.

## Verification

- `node --test test/shapes-geometric-cylinder.test.js`
- Strict semantic audit for all three new fixtures.
- Three-way fixture render with zero diagnostics and zero external-render failures.
- `node scripts/diff-example-pngs.js --output outputs/qa/2026-09-04-shapes-cylinder-anchors`

Acceptance: passed. The old rectangular-anchor error is visibly removed in the flowchart, all new fixtures have zero diagnostics, and native/tikztosvg/TikZKit geometry agrees at the named cylinder anchors.
