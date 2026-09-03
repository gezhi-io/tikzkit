# PGF shapes.symbols forbidden-sign QA

## Scope

- Library slice: `forbidden sign` and `correct forbidden sign` from
  `shapes.symbols`.
- Accepted behavior: circle-derived sizing, minimum dimensions, compass and
  border anchors, maximum outer-separation radius, diagonal direction,
  foreground paint order, and arrow-marker suppression on the diagonal.
- Driven by three new figures: the PGF manual catalog, a safety-interlock
  flowchart, and a magnetic-field exclusion diagram.
- Out of scope: the remaining `shapes.symbols` families such as `cloud`,
  `starburst`, and `magnifying glass`, plus a generic PGF custom-shape
  foreground-path API.

## Local source review

Reviewed the installed TeX Live 2025 implementation and manual:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.symbols.code.tex:12-89`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex:788-822`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduleshapes.code.tex:1187`

The implementation follows these source details:

1. Both shapes inherit the saved anchors, border calculation, compass
   anchors, and background path from `circle`.
2. The saved circle radius includes `max(outer xsep, outer ysep)`. The
   diagonal subtracts that same maximum before multiplying the painted radius
   by `0.707107`, so it reaches the visible circle rather than its anchor
   envelope.
3. `forbidden sign` draws from lower left to upper right. `correct forbidden
   sign` draws from lower right to upper left, which appears upper left to
   lower right after the normal SVG y-axis transform.
4. The diagonal is a foreground path and therefore crosses over node text.
5. PGF clears both arrow ends inside the foreground path. A surrounding `->`
   option must not place a marker on the diagonal.
6. The diagonal is only stroked when the node is drawn; a fill-only sign has
   no visible diagonal.

## Reference artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`.
- Rasterizer: `/opt/homebrew/bin/rsvg-convert`.
- Native engine: `/Library/TeX/texbin/pdflatex`.
- Final QA root: `outputs/qa-shapes-symbols-forbidden-sign-2026-09-04-final/`.
- Four-way native sheets:
  - `diff/shapes-forbidden-sign-manual-catalog-native-sheet.png`
  - `diff/shapes-forbidden-sign-interlock-flow-native-sheet.png`
  - `diff/shapes-forbidden-sign-field-safety-native-sheet.png`
- Saved tikztosvg SVGs: `tikztosvg-svg/`.
- Saved TikZKit SVGs: `tikzkit-svg/`.
- Workbench references: `test/fixtures/examples/output/tikztosvg-svg/` and
  `test/fixtures/examples/output/tikztosvg-grid-svg/`.

The tikztosvg SVG uses a y-flipped group transform, nonzero-filled cubic
circle paths, butt line caps, and miter joins. Each diagonal is a separate
marker-free path after the text glyph `<use>` elements. The manual case has
`viewBox="0 0 165.64 170.16"`; TikZKit emits the equivalent circle and line
geometry while retaining browser text and math as scoped SVG text.

## Visual result

Before this change, all four focused nodes fell back to rectangles. The
diagonal and its foreground ordering were missing, circle anchors resolved on
rectangular borders, and flow arrows clipped to those hidden rectangles.

After this change:

- The manual catalog shows four circles with the two historical diagonal
  directions, including direct shape keys and `shape=...` syntax.
- Both red smoking signs place their heavy diagonal above the word, matching
  native PGF and tikztosvg.
- The asymmetric `outer xsep=2pt, outer ysep=5pt` probe uses the larger value
  for anchor radius while the diagonal still terminates on the visible circle.
- A node-level `->` affects neither end of the foreground diagonal.
- The interlock flowchart's arrow stops on the circular STOP sign instead of a
  rectangular fallback border.
- The physics diagram crosses `$B=0$` with the correct diagonal and attaches
  its north/south arrows to the circle.
- All three TikZKit outputs, all three tikztosvg outputs, and all three MacTeX
  outputs rendered with zero diagnostics. The three native sheets and the
  browser's two grid panels were inspected.

The manual catalog now has identical 221x227 raster dimensions in TikZKit and
tikztosvg. Its TikZKit/native changed-pixel ratio fell from 24.67% before the
fix to 3.12%. The physics figure fell from 6.83% to 4.56%, and the registered
flowchart comparison fell from 7.69% to 6.86%. These values only support the
visual review; the accepted result is the visible recovery of the shapes,
directions, ordering, and anchor clipping.

Remaining visible differences are ordinary text/glyph rasterization,
subpixel stroke antialiasing, and small shared positioning/crop offsets in the
flowchart. No focused forbidden-sign element is missing.

## Command and parameter audit

| Source item | Status | Implementation |
| --- | --- | --- |
| `\documentclass[border=4pt]{standalone}` | accepted wrapper | fixture crop and reference harness |
| `\usepackage{tikz}` | implemented | package registry |
| `\usetikzlibrary{shapes.symbols,positioning,arrows.meta}` | implemented for used slices | per-library registries |
| `\begin{tikzpicture}[>=Stealth,node distance=...]` | implemented | scoped arrow default and positioning distance |
| `sign/.style`, `state/.style`, `flow/.style`, `coil/.style` | implemented | style definition and expansion |
| `\node[forbidden sign]`, `\node[correct forbidden sign]` | implemented | source-derived circle and diagonal geometry |
| `shape=forbidden sign`, `shape=correct forbidden sign` | implemented | explicit shape-value normalization |
| `minimum size`, `minimum width`, `minimum height` | implemented | circle-derived text and minimum sizing |
| `outer xsep`, `outer ysep` | implemented | maximum separation for circle anchors |
| `.north`, `.north west`, `.north east`, `.east`, `.south east`, `.south`, `.south west`, `.west` | implemented | inherited circle compass anchors |
| automatic node border anchors | implemented | circular path clipping for connecting lines and arrows |
| `draw`, `fill`, `line width`, `thick`, `rounded corners`, `diamond`, `align`, `text width` | implemented for fixture usage | shared node and path styling |
| `right=of`, `below=of`, `node distance=a and b` | implemented | positioning library |
| `->`, `--`, `-|`, `++(x,y)`, inline `node[...]` | implemented | path builder, arrow tips, orthogonal routing, and path-node placement |
| `circle (r)`, `\fill`, color mixes, dashed leaders | implemented | shared path and xcolor handling |
| `$x>0$`, `$B=0$`, `$|B|$`, `$d$`, multiline text | implemented | SVG math/text layout |
| arbitrary custom `\pgfdeclareshape` foreground paths | not part of this slice | requires a general PGF shape declaration interpreter |
| other `shapes.symbols` node families | not implemented by this change | tracked by the library's `partial` status |

No command or option used by the three focused fixtures produced a diagnostic.
The semantic inventory remains `incomplete` because the library as a whole is
still partial, not because these two accepted node shapes fell back.

## Verification

```sh
node --test test/shapes-symbols-forbidden-sign.test.js test/shapes-symbols-signal.test.js test/shapes-symbols-tape.test.js test/shapes-symbols-magnetic-tape.test.js
npm run examples:render -- --output outputs/qa-shapes-symbols-forbidden-sign-2026-09-04-final --only shapes-forbidden-sign-manual-catalog,shapes-forbidden-sign-interlock-flow,shapes-forbidden-sign-field-safety --tikztosvg --native-reference --grid
npm run examples:diff -- --output outputs/qa-shapes-symbols-forbidden-sign-2026-09-04-final --register --alignment-radius 3
npm run examples:render -- --output test/fixtures/examples/output --only shapes-forbidden-sign-manual-catalog,shapes-forbidden-sign-interlock-flow,shapes-forbidden-sign-field-safety --tikztosvg --grid --preserve-output
npm run extension-registry
npm test
```

The focused family and neighboring `shapes.symbols` suite passes 15/15. The
workbench loads the manual catalog with both 1cm-grid panels, zero render
diagnostics, and no missing reference message. The full suite reports 1766
passing, 122 known baseline failures, and 14 skipped tests; the four new tests
account for the increase from the prior 1762-pass baseline, with no new
failure introduced by this slice.

## Next slice

Continue `shapes.symbols` with `cloud` as a separate geometry family. Its
border construction and cloud-specific anchors need a dedicated source review
and should not be folded into this forbidden-sign implementation.
