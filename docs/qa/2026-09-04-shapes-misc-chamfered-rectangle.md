# shapes.misc chamfered rectangle QA

## Scope

This slice implements the `chamfered rectangle` node family: angle and x/y/shared separation, selective corners, minimum sizing, node rotation, named and numeric anchors, outer separation, bounding boxes, and automatic edge clipping. Other `shapes.misc` families are outside this slice.

## Local PGF review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.misc.code.tex`, lines 486-1148: the angle is measured from vertical and clamped to 1-89 degrees. Horizontal and vertical chamfer extents are independently limited by the text-box half-height and half-width. Minimum dimensions enlarge the inner rectangle only after those extents are known. The visible node is a twelve-point path, while anchors use a separate mitered outer-separation contour.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`, lines 2215-2305: confirms `chamfer all`, `chamfer none`, corner lists, `xsep`, `ysep`, shared `sep`, and the before/at/after anchor names for all four corners.
- `tikz.code.tex`, `tikzlibrarypositioning.code.tex`, `tikzlibrarycalc.code.tex`, and `pgflibraryarrows.meta.code.tex`: confirm transform order, relative placement, named-anchor lookup, route clipping, and post-clipping arrow-tip placement used by the three fixtures.

## Command and option coverage

Implemented and exercised: `\documentclass`, `\usepackage`, `\usetikzlibrary`, `\begin{tikzpicture}`, `\node`, `\draw`, `\fill`, `--`, `|-`, `++`, `grid`, `shape=chamfered rectangle`, `chamfered rectangle angle`, `xsep`, `ysep`, `sep`, `corners`, `chamfer all`, `chamfer none`, `minimum width`, `minimum height`, `outer sep`, `rotate`, `right=of`, `below=of`, named before/at/after corner anchors, compass anchors, base/mid anchors, and numeric border anchors.

Still outside this slice: rounded-rectangle concave/straight/custom arc modes and the remaining unimplemented `shapes.misc` declarations. TeX glyph outlines remain renderer-dependent, so tiny anti-aliasing differences are expected.

## Three-way visual evidence

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used `/opt/homebrew/bin/rsvg-convert`. Artifacts are under `outputs/qa/2026-09-04-shapes-chamfered-rectangle/`:

- `mactex-png/`: native MacTeX references.
- `tikztosvg-svg/` and `tikztosvg-png/`: third-party SVG references.
- `tikzkit-svg/` and `tikzkit-png/`: browser renderer output.
- `tikzkit-grid-*` and `tikztosvg-grid-*`: aligned 1 cm grid comparisons.
- `diff/`: three-way sheets and visual diffs; `index.html` is the browsable comparison.

The `tikztosvg` SVGs use closed path data with `stroke-linecap="butt"`, `stroke-linejoin="miter"`, and transformed glyph paths. TikZKit now follows the same closed twelve-point outline and miter joins instead of falling back to an SVG rectangle. Rotation is represented at the node group level so paint and anchors move together.

Before the change, every chamfered node painted as a plain rectangle and edge endpoints clipped to rectangular corners. After the change, all three cases visibly match the reference corner slopes, selective square corners, anchor markers, rotated shape, and arrow endpoints. The first visual pass also exposed an empty corner-list bug: `chamfer none` was interpreted as `chamfer all`; the final flowchart correctly keeps Publish rectangular. Remaining visible differences are limited to small font rasterization and subpixel stroke differences. TikZKit and `tikztosvg` PNG dimensions differ by only one pixel in each case.

## Verification

- `node --test test/shapes-misc-chamfered-rectangle.test.js`
- strict semantic audits for all three fixtures
- three TikZKit SVG/PNG renders with zero diagnostics
- three `tikztosvg` SVG/PNG renders
- three native MacTeX PNG renders
- flowchart, mathematics, and physics three-way sheets inspected manually

Fixtures:

- `shapes/chamfered-rectangle-flowchart.tex`
- `shapes/chamfered-rectangle-math.tex`
- `shapes/chamfered-rectangle-physics.tex`
