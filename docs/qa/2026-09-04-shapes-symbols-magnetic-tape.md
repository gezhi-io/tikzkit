# PGF shapes.symbols magnetic tape QA

## Scope

- Library slice: the `magnetic tape` node family from `shapes.symbols`.
- Accepted controls: `magnetic tape tail`, `magnetic tape tail extend`,
  `minimum size`, `minimum width`, and `minimum height`.
- Accepted anchors: compass anchors plus `tail east`, `tail north east`, and
  `tail south east`.
- Accepted routing: asymmetric visual bounds, automatic border clipping, and
  `positioning` against the circular compass anchors.
- Accepted content sizing: plain text, compact math, and comma-separated
  subscript sequences ending in `\ldots` or `\dots`.
- Out of scope: the ordinary `tape` shape, exact text/base/mid anchors,
  arbitrary shape rotation/incircle mode, and other `shapes.symbols` nodes.

## Local source review

Reviewed the installed TeX Live 2025 implementation and manual:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.symbols.code.tex:2617-2820`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex:1164-1220`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryshapes.symbols.code.tex`

The implementation follows these source details:

1. PGF sets the radius to half the maximum of `sqrt(2)` times the larger
   padded text-box dimension, `minimum width`, and `minimum height`.
2. `magnetic tape tail extend` is clamped at zero. The tail proportion is
   clamped to `[0,1]`, and tail height is that proportion times the radius.
3. The outline follows the circle from the tail angle through 360 degrees,
   continues from 0 to 270 degrees, then closes through the extended bottom
   and top tail corners.
4. Compass anchors use the outer radius. In particular, `south east` is the
   square corner `(R,-R)`, while the three tail anchors include extension and
   outer separation.
5. Border clipping is piecewise: circular above the tail, horizontal on the
   bottom, and vertical at the extended right edge.

Local pdfTeX box probes established that `$a_1,a_2,\ldots$` is `40.09947pt`
wide and `$\ldots$` alone is `11.66661pt`. TikZKit now preserves that sequence
spacing instead of treating the dots as a generic 5pt Unicode glyph.

## Reference artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`.
- Rasterizer: `/opt/homebrew/bin/rsvg-convert`.
- Native engine: `/Library/TeX/texbin/pdflatex`.
- Before: `outputs/qa-shapes-symbols-magnetic-tape-2026-09-04-before/`.
- Final: `outputs/qa-shapes-symbols-magnetic-tape-2026-09-04-final/`.
- Four-way native sheets:
  - `diff/shapes-magnetic-tape-manual-catalog-native-sheet.png`
  - `diff/shapes-magnetic-tape-sequential-store-native-sheet.png`
  - `diff/shapes-magnetic-tape-sensor-recording-native-sheet.png`
- Saved tikztosvg SVGs: `tikztosvg-svg/`.
- Saved TikZKit SVGs: `tikzkit-svg/`.

The tikztosvg SVG uses a closed nonzero-fill path, cubic circle arcs,
`stroke-linecap="butt"`, `stroke-linejoin="miter"`, and a y-flipping matrix.
Its text is converted to glyph paths. TikZKit emits the same outline directly
in canvas coordinates and keeps formulas as scoped SVG text.

## Visual result

Before this change, all magnetic-tape nodes were rectangles. The circular
body, tail, tail anchors, asymmetric bounds, and contour clipping were absent.
The sequential-store canvas was 496 by 75 px against tikztosvg's 521 by 100
px, and its arrows stopped at rectangular borders.

After this change:

- The manual catalog shows the native circular body and the default, extended,
  and half-height tail variants.
- `shape=magnetic tape` and direct `magnetic tape` syntax produce the same
  geometry.
- The three named tail anchors land at the upper corner, vertical midpoint,
  and lower corner of the extended tail.
- The sequential store's formula-driven diameter is 2.324cm against the
  approximately 2.316cm reference, restoring node spacing and arrow clipping.
- The sensor diagram's south anchor and orthogonal history loop meet the tape
  body at the same locations as MacTeX and tikztosvg.
- Final raster dimensions are 320x219 vs 323x220, 300x142 vs 300x143, and
  520x99 vs 521x100 for the manual, sensor, and sequential fixtures.
- All three engines rendered all three fixtures with zero diagnostics, and all
  three native four-way sheets were inspected.

Remaining visible differences are limited to font rasterization, subpixel
stroke placement, and a 1-3px crop margin. No focused shape, anchor, path, or
label is missing.

## Command and parameter audit

| Source item | Status | Implementation |
| --- | --- | --- |
| `\documentclass[border=4pt]{standalone}` | accepted wrapper | fixture crop and reference harness |
| `\usepackage{tikz}` | implemented | package registry |
| `\usetikzlibrary{shapes.symbols,positioning,arrows.meta}` | implemented for used slices | per-library registries |
| `\begin{tikzpicture}[>=Stealth]` | implemented | scoped default arrow tip |
| `every node/.style`, `stage/.style`, `block/.style`, `store/.style`, `tape/.style`, `flow/.style` | implemented | style expansion |
| `\node[magnetic tape]`, `shape=magnetic tape` | implemented | source-derived magnetic-tape layout and renderer |
| `magnetic tape tail=.22/.25/.3/.5` | implemented | clamped proportional tail height |
| `magnetic tape tail extend=2.5/3/4/5mm` | implemented | clamped physical tail extension |
| `minimum size`, `minimum width`, `minimum height` | implemented | PGF maximum and sqrt(2) radius rule |
| `draw`, `draw=none`, `fill`, `thin`, `thick`, `rounded corners`, `align`, `font=\scriptsize` | implemented for fixture usage | shared style and node rendering |
| `right=of`, `below=of`, `below=2mm of node.anchor`, `node distance=a and b` | implemented | positioning library and named anchors |
| `(node.tail east)`, `(node.tail north east)`, `(node.tail south east)`, `(node.south)` | implemented | magnetic-tape named anchors |
| `\draw[->]`, `\fill`, `--`, `|-`, `++(x,y)`, `circle` | implemented | path builder, renderer, and arrow tips |
| inline `node[above]`, `node[below]`, `node[right]`, `node[pos=.75]` | implemented | path-node placement |
| `$a_1,a_2,\ldots$`, `$s(t)$`, `$s[n]$`, `$\hat s[n+1]$`, `$T_s$`, `$x_t$` | implemented | SVG math plus TeX-compatible sizing |

No command or option used by the three focused fixtures is silently ignored.
The library remains `partial` because the out-of-scope symbol families and
anchor modes above are not yet implemented.

## Verification

```sh
node --test test/math-script-metrics.test.js test/shapes-symbols-magnetic-tape.test.js test/shapes-symbols-signal.test.js test/library-modules.test.js
node scripts/render-example-fixtures.js --output outputs/qa-shapes-symbols-magnetic-tape-2026-09-04-final --only shapes-magnetic-tape-manual-catalog --only shapes-magnetic-tape-sequential-store --only shapes-magnetic-tape-sensor-recording --native-reference --strict-tikztosvg --math-renderer svg-text
node scripts/diff-example-pngs.js --output outputs/qa-shapes-symbols-magnetic-tape-2026-09-04-final
npm run extension-registry
```

The focused module, geometry, renderer, border, anchor, and math-metric suite
passes 16/16. A broader interpreter/renderer run still has pre-existing color
normalization and rich-text snapshot failures outside this slice; no existing
test containing `\ldots` is affected because this is the first such focused
fixture.

## Next slice

Continue `shapes.symbols` with one independently verifiable family. The next
candidate should be ordinary `tape` if corpus usage warrants it; otherwise
select `forbidden sign` or `cloud` by visual severity and case count.
