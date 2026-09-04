# Circle solidus shape QA

## Scope

This slice implements the `shapes.multipart` `circle solidus` node family for
flowchart, mathematics, and physics diagrams. The acceptance boundary is:

- independent `text` and `lower` TeX boxes arranged north-west/south-east;
- the PGF radius formula, minimum dimensions, and outer-separation anchors;
- the 45-degree solidus with PGF's golden-section length;
- `text`, `lower`, `base`, `mid`, compass, and numeric border anchors;
- explicit anchor placement and automatic edge clipping at the circular border.

Repeated empty-part key accumulation remains outside this slice.

## Local source review

The implementation was checked against:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.multipart.code.tex`, lines 175-300, containing the complete `circle solidus` declaration;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduleshapes.code.tex`, lines 1187-1327, containing the inherited circle anchors, border, and background path;
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`, lines 1561-1592, documenting the two parts and anchor catalogue;
- the TikZ front-end multipart, positioning, calc, and arrow files listed in the three case review JSON files.

PGF adds each box's width, height, and depth, selects the larger extent, and
multiplies it by `0.7071`. It then adds half the line width and
`veclen(2 inner xsep, 2 inner ysep)`. Minimum width and height clamp the
painted radius. Only the larger outer separation enlarges the anchor radius.
The upper text origin and lower text origin use separate 45-degree projections,
which place their visual centers on opposite sides of the solidus. The solidus
endpoint component is `0.437 * (painted radius - 0.5 line width)`.

## Reference pipeline

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; SVG rasterization used
`/opt/homebrew/bin/rsvg-convert`, and native references used local `pdflatex`.
Artifacts are stored in
`outputs/qa/2026-09-04-shapes-circle-solidus/`:

- `tikzkit-svg/` and `tikzkit-png/` contain browser-rendered output;
- `tikztosvg-svg/` and `tikztosvg-png/` contain the third-party reference;
- `mactex-png/` contains MacTeX raster references;
- `tikzkit-grid-*`, `tikztosvg-grid-*`, `diff-png/`, and `diff/` contain 1cm overlays and comparison sheets.

The third-party SVG uses point-sized viewBoxes, a y-flip transform, nonzero
fills, butt caps, miter joins, glyph paths, and separate paths for the circular
outline and solidus. TikZKit uses a circle plus a solidus path with the same
cap/join behavior, live bundled Computer Modern-compatible text, and separate
arrow-tip paths. Flowchart output is 276.85pt by 158.84pt in TikZKit versus
276.802pt by 158.626pt in `tikztosvg`. The math case is 120.07pt wide in both.

## Visual review

- `shapes-circle-solidus-flowchart`: circle diameter, diagonal separator,
  north-west/south-east text, east/south edge clipping, action placement, and
  the lower-anchor guide visibly align in all three renderers.
- `shapes-circle-solidus-math`: the circle, solidus, `q_1` and `00`, base/mid
  horizontal lines, 130/-50 numeric-anchor diagonal, text/lower anchor dots,
  and diameter annotation align with MacTeX.
- `shapes-circle-solidus-physics`: both energy labels, circular boundary,
  compass diagonal, lower-origin state arrow, and west/east energy arrows align.
  The TikZKit crop is about 0.8pt narrower and 1.5pt shorter, caused by live
  text bounds around the exterior labels; no required graphic is clipped.

Before this slice, `circle solidus` fell back to a rectangle with one text box,
so the circle, solidus, lower formula, source-defined anchors, and circular edge
clipping were missing. After the slice, all required visual elements are
present. Remaining differences are font-outline rasterization and the small
physics-label crop delta described above.

## Semantic coverage

Implemented commands and environments used by these cases are `\usepackage`,
`\usetikzlibrary`, `\begin{document}`, `\begin{tikzpicture}`, `\node`,
`\nodepart{lower}`, `\draw`, `\fill`, and relative `++` coordinates.
Implemented options include `circle solidus`, `shape=circle solidus`, `draw`,
`thick`, colors and mixes, `fill`, `minimum size`, inner/outer separation,
`node distance`, `right=of`, `below=of`, `rounded corners`, arrow tips, line
styles, label placement, calc offsets, and every explicit multipart anchor used
by the fixtures. All numeric lengths, colors, anchor angles, and coordinates in
the three fixtures are exercised by strict case audits.

No command or option used by these three accepted cases remains unimplemented.
The library-wide remaining gap is repeated accumulation of multiple empty-part
width/height/depth keys for rectangle split nodes.

## Verification

```sh
node --test --test-reporter=dot test/shapes-multipart-circle-solidus.test.js test/shapes-multipart-diamond-split.test.js test/shapes-multipart-ellipse-split.test.js test/architecture-seams.test.js
node scripts/render-example-fixtures.js --output outputs/qa/2026-09-04-shapes-circle-solidus --only shapes-circle-solidus-flowchart --only shapes-circle-solidus-math --only shapes-circle-solidus-physics --tikztosvg-engine pdflatex --math-renderer svg-text --native-reference --continue-on-external-failure
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-04-shapes-circle-solidus
```

All three renderers completed all three cases with zero TikZKit diagnostics and
zero external-reference failures. The slice is visually accepted.
