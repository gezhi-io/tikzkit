# Ellipse split shape QA

## Scope

This slice implements the `shapes.multipart` `ellipse split` node family used
by flowchart, mathematics, and physics diagrams. The acceptance boundary is:

- independent `text` and `lower` TeX boxes;
- PGF-sized horizontal and vertical ellipse radii;
- the center separator and node fill/stroke;
- `text`, `lower`, `base`, `mid`, compass, base-east/west, and mid-east/west
  anchors;
- explicit anchor placement and automatic edge clipping at the ellipse border.

`circle solidus`, `diamond split`, and repeated empty-part key accumulation are
outside this slice and remain unsupported or partial.

## Local source review

The implementation was checked against:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.multipart.code.tex`, especially the `ellipse split` declaration around lines 1373-1490;
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`;
- the TikZ front-end multipart, positioning, calc, and arrow library files named
  in the three case review JSON files.

PGF first measures the two node-part boxes. The visible x radius is sqrt(2)
times the larger half-width plus inner x separation. The visible y radius is
sqrt(2) times the larger complete box height plus two inner y separations and
half the rule width. Minimum size clamps the visible radii. Outer separation is
then added only to anchor radii. The `lower` anchor is the lower box origin;
base/mid east and west use the full horizontal anchor radius, while diagonal
compass anchors use 0.707106 of each radius. Border clipping is the exact ray
intersection with the ellipse.

## Reference pipeline

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg` and run with the local
`pdflatex` engine. Artifacts are in
`outputs/qa/2026-09-04-shapes-ellipse-split/`:

- `tikzkit-svg/` and `tikzkit-png/` contain browser-rendered output;
- `tikztosvg-svg/` and `tikztosvg-png/` contain the third-party reference;
- `native-png/` contains MacTeX raster references;
- `grid/` and `diff/` contain 1cm overlays and native comparison sheets.

The third-party SVG uses a point-sized viewBox, a combined nonzero-fill path
for the ellipse and center rule, butt caps, miter joins, a y-flip matrix, path
glyphs, and standalone arrow-tip paths. TikZKit emits an SVG ellipse plus a
separator path, the same cap/join behavior, standalone arrow tips, and live
text using bundled Computer Modern-compatible fonts.

## Visual review

- `shapes-ellipse-split-flowchart`: all three nodes have matching ellipse
  proportions, separators, centered text, and east/west edge clipping. The
  deliberately asymmetric `(active.lower)` endpoint agrees with PGF's lower
  text-box-origin anchor.
- `shapes-ellipse-split-math`: formula boxes, base/mid lines, compass points,
  and the vertical radius annotation align with both references. The close
  base/mid labels are also present in native output.
- `shapes-ellipse-split-physics`: upper/lower formulas, force and energy edge
  clipping, lower-anchor arrow, and diagonal compass line visibly align.

Residual pixel differences are primarily TeX glyph outlines versus live SVG
text antialiasing; no shape, anchor, separator, or clipping element is missing.

## Semantic coverage

The three `.review.json` files accept every observed dependency, command,
environment, option, declaration, number, and expression with evidence from
`test/shapes-multipart-ellipse-split.test.js` and the visual sheets. Covered
syntax includes `ellipse split`, `\nodepart{lower}`, minimum width/height,
inner/outer separation, fills, line styles, positioning, calc coordinates,
arrow tips, explicit multipart anchors, and automatic border endpoints.

## Verification

```sh
node --test --test-reporter=dot test/shapes-multipart*.test.js
node scripts/render-example-fixtures.js --output outputs/qa/2026-09-04-shapes-ellipse-split --only shapes-ellipse-split-flowchart --only shapes-ellipse-split-math --only shapes-ellipse-split-physics --tikztosvg-engine pdflatex --math-renderer svg-text --native-reference --continue-on-external-failure
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-04-shapes-ellipse-split
```

All three renderers completed all three cases with zero TikZKit diagnostics and
zero external-reference failures. The slice is visually accepted.
