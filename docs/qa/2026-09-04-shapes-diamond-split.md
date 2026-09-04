# Diamond split shape QA

## Scope

This slice implements the `shapes.multipart` `diamond split` node family used
by flowchart, mathematics, and physics diagrams. The acceptance boundary is:

- independent `text` and `lower` TeX boxes;
- the PGF aspect-dependent diamond size and minimum dimensions;
- the center separator and node fill/stroke;
- `text`, `lower`, `base`, `mid`, and compass anchors;
- explicit anchor placement and automatic edge clipping at the diamond border.

`circle solidus` and repeated empty-part key accumulation are outside this
slice and remain unsupported or partial.

## Local source review

The implementation was checked against:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.multipart.code.tex`, especially the `diamond split` declaration around lines 311-438;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex`, especially the inherited `diamond` anchors, border intersection, background path, and `/pgf/aspect` key;
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`, especially the `diamond split` examples around lines 1617-1635;
- the TikZ front-end multipart, positioning, calc, and arrow library files named
  in the three case review JSON files.

PGF measures the upper box without inner separation and the lower box with one
inner x/y separation. It takes the maximum resulting width and height, then
computes the horizontal half-size as `width + aspect * height` and the vertical
half-size as `width / aspect + height`. Minimum dimensions clamp those values.
Outer separation enlarges anchor radii, while the painted diamond subtracts
`sqrt(2)` times each outer separation. The center rule spans the horizontal
radius before outer separation. The upper and lower text origins use the
source's quarter-height and negative five-quarter-height offsets.

The local source also exposed an important dependency detail: `/pgf/aspect` is
declared by `shapes.geometric`, not by `shapes.multipart`. The three accepted
cases therefore load both libraries, matching MacTeX behavior.

## Reference pipeline

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg` and run with the local
`pdflatex` engine. Artifacts are in
`outputs/qa/2026-09-04-shapes-diamond-split/`:

- `tikzkit-svg/` and `tikzkit-png/` contain browser-rendered output;
- `tikztosvg-svg/` and `tikztosvg-png/` contain the third-party reference;
- `mactex-png/` contains MacTeX raster references;
- `tikzkit-grid-*`, `tikztosvg-grid-*`, and `diff/` contain 1cm overlays and
  native comparison sheets.

The third-party SVG uses a point-sized viewBox, a y-flip matrix, nonzero fill,
butt caps, miter joins, text converted to glyph paths, and independent filled
arrow-tip paths. Its diamond outline and separator are combined in one path.
TikZKit emits a separate polygon and separator path with matching cap/join
behavior, live bundled Computer Modern-compatible text, and independent arrow
tips. In the flowchart case the TikZKit SVG is 287.29pt by 151.78pt, versus
286.934pt by 151.803pt for the reference.

## Visual review

- `shapes-diamond-split-flowchart`: the diamond dimensions, aspect, center
  rule, text positions, east/south automatic clipping, and action-node
  placement visibly align. The lower-anchor line starts at the lower text-box
  origin in all references.
- `shapes-diamond-split-math`: the outline, separator, formulas, text/lower
  anchor dots, compass diagonal, and width annotation align. The close
  base-to-mid annotation also appears in native output.
- `shapes-diamond-split-physics`: the upper/lower formulas, west/east energy
  arrows, lower-anchor arrow, and diagonal align with MacTeX. `tikztosvg`
  degrades `\frac12` in this case, while MacTeX and TikZKit render the fraction;
  MacTeX is authoritative for that residual third-party discrepancy.

Before this slice, `diamond split` fell back to a rectangle with one text box,
so the diamond outline, separator, lower-part origin, compass anchors, and
diamond border clipping were all missing. After the slice, no required visual
element is missing. Remaining pixel differences are primarily glyph outlines
and antialiasing.

## Semantic coverage

The three `.review.json` files accept every observed dependency, command,
environment, option, declaration, number, and expression with evidence from
`test/shapes-multipart-diamond-split.test.js` and the native comparison sheets.
Covered syntax includes `diamond split`, `shape=diamond split`,
`\nodepart{lower}`, `aspect`, minimum width/height, inner/outer separation,
fills, line styles, positioning, calc coordinates, arrow tips, explicit
multipart anchors, and automatic border endpoints.

## Verification

```sh
node --test --test-reporter=dot test/shapes-multipart-diamond-split.test.js test/shapes-multipart-ellipse-split.test.js test/architecture-seams.test.js
node scripts/render-example-fixtures.js --output outputs/qa/2026-09-04-shapes-diamond-split --only shapes-diamond-split-flowchart --only shapes-diamond-split-math --only shapes-diamond-split-physics --tikztosvg-engine pdflatex --math-renderer svg-text --native-reference --continue-on-external-failure
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-04-shapes-diamond-split
```

All three renderers completed all three cases with zero TikZKit diagnostics and
zero external-reference failures. The slice is visually accepted.
