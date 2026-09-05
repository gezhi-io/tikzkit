# Document Crop Borders Under Picture Transforms

## Scope

This slice makes `preview`'s `\PreviewBorder` and standalone's `border`
remain physical page-space margins when the top-level TikZ picture uses
`scale`, `xscale`, `yscale`, or `rotate`. The production renderer already
stored the source border separately from the drawing transform; the defect was
in the disposable tikztosvg reference source, where the synthetic crop path
was incorrectly evaluated inside the picture transform.

The boundary is deliberately narrow. This does not claim full `preview`
package semantics, arbitrary asymmetric standalone borders in the browser,
general TeX page construction, or pixel-identical browser text rasterization.

The original real-world driver is
`test/fixtures/examples/latex-examples/control-flow-graph.tex`, whose
`\PreviewBorder{2mm}` was multiplied by the picture's `scale=5`. Permanent
flowchart, mathematics, and physics regressions are:

- `test/fixtures/examples/bbox/document-border-flowchart.tex`
- `test/fixtures/examples/bbox/document-border-math.tex`
- `test/fixtures/examples/bbox/document-border-physics.tex`

## Local TeX Reading

Reviewed `/usr/local/texlive/2025/texmf-dist/tex/latex/preview/preview.sty`
and `prtightpage.def`. `\PreviewBorder` is a TeX dimension, and
`\PreviewBbAdjust` expands the completed preview box on all four sides. The
page width, height, and origin are adjusted after picture measurement, so the
margin is not part of the TikZ coordinate transformation.

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/latex/standalone/standalone.cls`.
`\sa@readborder` accepts one, two, or four physical dimensions and forwards
the four sides to `\PreviewBbAdjust`; the class adds these dimensions outside
the packed content box.

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`,
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcoretransformations.code.tex`,
and `pgfmanual-en-tikz-transformations.tex`. The `/tikz/reset cm` key installs
`\pgftransformreset`, which clears the translation and restores the identity
2x2 affine matrix. This is the correct PGF mechanism for evaluating a
page-space crop path without changing the transformed source drawing.

## Visual References

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. Native references
used `/Library/TeX/texbin/pdflatex`, tikztosvg PNG conversion used
`/opt/homebrew/bin/rsvg-convert`, and native PDF rasterization used local
`pdftocairo`.

The original control-flow case is stored in:

- `outputs/qa/2026-09-05-preview-border-transform-before`
- `outputs/qa/2026-09-05-preview-border-transform-after`

Before the fix, MacTeX was 268x74px and TikZKit was 266x73px, while
tikztosvg was 328x135px. The synthetic 2mm crop path had inherited
`scale=5`, creating roughly 10mm of whitespace on every side. After wrapping
only that path in `\begin{scope}[reset cm]`, tikztosvg is 268x74px, exactly
the native canvas size; node geometry, arrow endpoints, line widths, colors,
and content placement are unchanged.

The three permanent cases, including native PNG, TikZKit SVG/PNG, tikztosvg
input/SVG/PNG, registered diff, grid images, and four-way sheets, are stored
in `outputs/qa/2026-09-05-document-border-transforms`. MacTeX and tikztosvg
match exactly at 364x42px, 233x126px, and 181x209px. TikZKit renders at
363x41px, 233x125px, and 178x208px. Inspection of all three four-way sheets
shows no missing node, formula, line, arrow, fill, or label. The physical
border stays even after uniform scale, non-uniform scale plus rotation, and
scale plus rotation. The residual one-to-three-pixel differences come from
glyph/arrow paint bounds, antialiasing, and rotated pixel rounding rather than
from transformed margins.

The tikztosvg SVG roots have viewBoxes of `272.525x30.966pt`,
`174.486x93.933pt`, and `135.08x156.745pt`. Geometry uses butt caps, miter
joins, and nonzero fill rules. Text is converted to glyph paths under y-flip
and rotation matrices. TikZKit keeps selectable SVG text and its own logical
viewBox, but its physical width/height applies the same page-space margin.

## Command And Option Audit

Implemented and exercised in this slice:

- document commands: `\documentclass`, `\usepackage`, `\setlength`,
  `\PreviewBorder`, `\usetikzlibrary`
- environments: `document`, `preview`, `tikzpicture`, `scope`
- drawing commands: `\node`, `\draw`, `\fill`, `\path`
- picture options: `scale`, `xscale`, `yscale`, `rotate`
- crop options: standalone `border`, `reset cm`, `use as bounding box`,
  `xshift`, `yshift`
- visual options: `draw`, `fill`, `rounded corners`, `minimum width`, `thin`,
  `thick`, `very thick`, named colors and color mixes
- arrows and text: `Stealth`, `Latex`, inline math, anchors, named-node paths

Not implemented or not claimed here:

- full preview selection hooks such as arbitrary `\PreviewEnvironment`,
  delayed material, floats, and page-level font/section handling
- general asymmetric browser-side standalone borders and complete TeX page
  origin semantics
- pixel-identical conversion between MacTeX glyph outlines and editable SVG
  text under every affine transform

## Implementation And Verification

`scripts/render-example-fixtures.js` now places its synthetic document crop
path inside a local `reset cm` scope. `src/frontend/latex-shell.js` continues
to parse the source margin, and `src/renderers/svg/renderSvg.js` applies it
after semantic drawing bounds are complete. `src/packages/preview.js` records
the partial package support and reviewed local sources.

The targeted crop-normalization tests pass, all three strict semantic audits
have no blockers, all three TikZKit cases render with zero diagnostics, and
MacTeX plus tikztosvg generated every requested artifact.
