# Asymmetric Standalone Document Borders

## Scope

This slice implements standalone document borders as four independent
physical page margins. It accepts one dimension, two dimensions interpreted
as horizontal then vertical, and four dimensions interpreted as left,
bottom, right, then top. The margins travel from preprocessing through the
TikZ AST and renderer-neutral scene graph to the SVG document view. An
explicit renderer `margin` still overrides the source document margins.

The boundary is document crop layout only. It does not add a general TeX page
builder or arbitrary `preview` selection hooks. The mathematical fixture also
contains TikZ's `parabola bend` path operation, which remains unsupported and
is visibly absent from TikZKit; that existing path gap is not counted as part
of this border acceptance.

Permanent flowchart, mathematics, and physics regressions are:

- `test/fixtures/examples/bbox/asymmetric-border-flowchart.tex`
- `test/fixtures/examples/bbox/asymmetric-border-math.tex`
- `test/fixtures/examples/bbox/asymmetric-border-physics.tex`

## Local TeX Reading

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/latex/standalone/standalone.cls` and
`/usr/local/texlive/2025/texmf-dist/source/latex/standalone/standalone.dtx`.
The class macro `\sa@readborder` first reads up to four space-separated
dimensions. A single dimension is copied to all sides; two assign the first
to left/right and the second to bottom/top; four assign left, bottom, right,
and top. The class passes `-left -bottom right top` to `\PreviewBbAdjust`.

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/latex/preview/prtightpage.def`.
It measures the preview content first, then applies the four adjustments to
the page size and origin. Thus these margins are page-space dimensions rather
than TikZ picture coordinates.

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`
and
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcoretransformations.code.tex`.
The `reset cm` key delegates to `\pgftransformreset`, restoring the identity
affine transform. The disposable tikztosvg crop path therefore applies the
four document margins after picture `scale` and `rotate` have finished.

The flowchart and vector cases also checked the local `arrows.meta` and
`shapes.geometric` sources. Arrow tips and the diamond are picture paint that
contributes to natural bounds before the document margins are added.

## Visual References

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. Native rendering
used `/Library/TeX/texbin/pdflatex`, tikztosvg conversion used
`/opt/homebrew/bin/rsvg-convert`, and native PDFs were rasterized with local
`pdftocairo`.

Before artifacts are in
`outputs/qa/2026-09-05-asymmetric-document-borders-before`; after artifacts
are in `outputs/qa/2026-09-05-asymmetric-document-borders-after`. Each after
directory includes TikZKit SVG/PNG, native MacTeX PNG, tikztosvg input/SVG/PNG,
grid images, diffs, and four-way sheets.

Before the change, TikZKit discarded the multi-value border: the flowchart
was 288x41px and touched the canvas vertically, the mathematics case was
167x130px, and the physics case was 162x186px. All three tikztosvg references
failed because strings such as `-{2mm 5mm}` were emitted as one illegal shift.

After the change, every tikztosvg reference renders with zero external
failures and all TikZKit cases have zero diagnostics. The flowchart is
303x79px in TikZKit, MacTeX, and tikztosvg; its 2mm left/right and 5mm
bottom/top whitespace is visibly symmetric by axis. The mathematics case
grows to 184x155px versus 184x156px for both references, with small left,
larger bottom, still larger right, and largest top whitespace. The physics
case grows to 180x216px versus 183x218px for both references; inspection shows
the 1mm/2mm/4mm/6mm left/bottom/right/top order around the rotated force
diagram. Residual mathematics and physics size differences come from existing
path, glyph, arrow-paint, and raster-rounding differences, not from margin
direction or scale.

The generated tikztosvg input now contains, for example,
`xshift=-1mm,yshift=-2mm` at the south-west corner and
`xshift=4mm,yshift=6mm` at the north-east corner inside `scope[reset cm]`.
Its SVG uses a zero-origin page viewBox, nonzero filled paths, butt line caps,
miter joins, transform matrices with a y-axis flip, and glyph paths for TeX
text. TikZKit keeps selectable `<text>` where possible and uses its own logical
viewBox, while its physical width and height now encode the same four page
margins.

## Command, Option, And Number Audit

Implemented and exercised across the three cases:

- shell and dependencies: `\documentclass`, `\usepackage`,
  `\usetikzlibrary`, `document`, `tikzpicture`, `tikz`, `arrows.meta`, and
  `shapes.geometric`
- drawing: `\node`, `\draw`, `\fill`, line segments, `rectangle`, `circle`,
  inline path nodes, named-node endpoints, and `--`
- crop: `border={2mm 5mm}`, `border={2pt 5pt 11pt 14pt}`, and
  `border={1mm 2mm 4mm 6mm}` with exact standalone side ordering
- transforms: `scale=1.5`, `scale=1.25`, `rotate=8`, and `rotate=-6`, applied
  only to picture geometry
- shapes and layout: `draw`, `rounded corners=2pt`, `diamond`, `aspect=2`,
  `minimum width=16mm`, coordinate pairs from `-1` through `4`, and anchors
  `right`, `above`, `below`, and `above right`
- paint: `fill`, `blue!10`, `yellow!18`, `green!12`, `gray!12`, `red`,
  `blue`, `green!50!black`, `thin`, `thick`, `very thick`, and `1.5pt`
- arrows and formulas: `Stealth`, `Latex`, `$x$`, `$y$`, `$f(x)=x^2/4$`,
  `$F$`, `$N$`, and `$mg$`

Not implemented or not claimed:

- `parabola bend` was outside this border slice at the time of its first
  acceptance. It is now implemented and visually re-accepted in
  `docs/qa/2026-09-05-parabola-paths.md`; the blue curve is no longer missing
- arbitrary document-class option expansion, TeX dimension registers inside
  border lists, and full `preview` package page-selection behavior
- pixel-identical text outlines, arrow paint bounds, and anti-aliasing across
  native PDF, tikztosvg, and browser SVG

## Implementation And Verification

`src/frontend/latex-shell.js` parses source dimensions into
`previewMargins`; `src/frontend/parser.js` and `src/engine/evaluate.js` carry
them through AST and scene graph; `src/renderers/svg/document.js` expands each
side independently; and `scripts/render-example-fixtures.js` emits the same
four shifts for tikztosvg references. Numeric `previewBorder` remains present
for uniform margins as a compatibility field.

Focused frontend, renderer-chain, and reference-normalization tests pass
77/77. All three permanent fixtures render with zero diagnostics, tikztosvg
and native MacTeX both render 3/3, and strict semantic audits report no
blockers.
