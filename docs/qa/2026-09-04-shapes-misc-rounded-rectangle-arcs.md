# shapes.misc rounded rectangle arc QA

## Scope

This slice implements the `rounded rectangle` end-cap family: west/east `convex`, `concave`, and `none`; left/right aliases; custom arc length; PGF-compatible content and minimum sizing; named, numeric, base, mid, and compass anchors; outer separation; rotation; bounding boxes; positioning; and automatic edge clipping. Other `shapes.misc` declarations are outside this slice.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.misc.code.tex`, lines 74-475: the half arc angle is `arc length / 2`; half height is the maximum of the text box plus inner y separation and half the minimum height; radius is `csc(a) * halfHeight`; arc width is `r - r*cos(a)`; and the content chord is `r - sqrt(r^2-halfTextHeight^2)`. Concave, convex, and straight sides contribute arc width, chord width, and zero respectively to minimum-width sizing. Convex overlap can widen the body. Paint and anchor contours are deliberately separate because outer separation changes the miter and ellipse used for clipping.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`, lines 2140-2225: confirms recommended 90-180 degree arc lengths, the three side modes, west/east and left/right aliases, and the full anchor catalog.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/base/fontmath.ltx`, line 400, and `/usr/local/texlive/2025/texmf-dist/tex/latex/amsmath/amsmath.sty`, lines 409-410: `\colon` is a mathematical punctuation atom; AMS adds 2mu before and 6mu after. The SVG-text fallback now renders the colon instead of leaking the command name.
- `tikz.code.tex`, `tikzlibrarypositioning.code.tex`, `tikzlibrarycalc.code.tex`, and `pgflibraryarrows.meta.code.tex`: confirm style resolution, relative positioning, calc offsets, transform order, node-border clipping, and arrow-tip placement used by the fixtures.

## Command and option coverage

Implemented and exercised: `\documentclass`, `\usepackage`, `\usetikzlibrary`, `\begin{tikzpicture}`, `\node`, `\draw`, `\fill`, `--`, `to`, `++`, `grid`, `shape=rounded rectangle`, `rounded rectangle`, `rounded rectangle arc length`, `rounded rectangle west arc`, `rounded rectangle east arc`, `rounded rectangle left arc`, `rounded rectangle right arc`, `convex`, `concave`, `none`, `minimum width`, `minimum height`, `inner sep`, `outer sep`, `rotate`, `right=of`, `node distance`, compass anchors, base/mid anchors, numeric border anchors, calc offsets, and `\colon` in SVG-text math.

Still outside this slice: the remaining unimplemented `shapes.misc` declarations and exact native TeX glyph outlines/text-box metrics. The SVG-text renderer approximates the exact AMS 2mu/6mu colon spacing through its shared operator-spacing model.

## Three-way visual evidence

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used `/opt/homebrew/bin/rsvg-convert`. Artifacts are under `outputs/qa/2026-09-04-shapes-misc-rounded-rectangle-arcs/`:

- `mactex-png/`: native MacTeX references.
- `tikztosvg-svg/` and `tikztosvg-png/`: third-party SVG references.
- `tikzkit-svg/` and `tikzkit-png/`: browser renderer output.
- `tikzkit-grid-*` and `tikztosvg-grid-*`: aligned 1 cm grid comparisons.
- `diff/`: three-way sheets and visual diffs; `index.html` is the browsable comparison.

The `tikztosvg` SVGs paint closed paths with `stroke-linecap="butt"`, `stroke-linejoin="miter"`, transformed Computer Modern glyph paths, and a viewBox cropped around the painted content. TikZKit now emits the same closed convex, concave, and straight contours with butt caps and miter joins. Node rotation remains on the shared group so paint, labels, named anchors, and clipped paths rotate together.

Before this change, non-default end modes and arc lengths fell back to the default convex rounded rectangle; asymmetric bounds, named anchors, and edge clipping therefore used the wrong contour. After the change, the flowchart visibly matches all three end modes, asymmetric positioning, straight arrows, and the retry curve; the mathematics case matches named anchor markers and custom 90/120/180 degree caps; and the physics case matches the rotated asymmetric body and three force-vector origins. The first visual pass also exposed a literal `colon` leak in the mathematics label, which is fixed in the final artifacts. Remaining visible differences are small font rasterization, subpixel stroke differences, one pixel of flowchart width, and a few pixels of physics-page whitespace.

## Verification

- `node --test test/shapes-misc-rounded-rectangle-arcs.test.js`
- `node --test --test-name-pattern="rounded.rectangle|rounded-rectangle" test/interpreter.test.js test/petarv-compat.test.js test/svg-renderer.test.js test/shapes-multipart-rounded-custom-fill.test.js`
- `node --test --test-name-pattern="math colon" test/renderer.test.js`
- strict semantic audits for all three fixtures
- three TikZKit SVG/PNG renders with zero diagnostics
- three `tikztosvg` SVG/PNG renders
- three native MacTeX PNG renders
- flowchart, mathematics, and physics three-way sheets inspected manually

Fixtures:

- `shapes/rounded-rectangle-arcs-flowchart.tex`
- `shapes/rounded-rectangle-arcs-math.tex`
- `shapes/rounded-rectangle-arcs-physics.tex`
