# PGF shapes.symbols tape QA

## Scope

- Library slice: the ordinary `tape` node family from `shapes.symbols`.
- Accepted controls: `tape bend`, `tape bend top`, `tape bend bottom`,
  `tape bend height`, `minimum size`, `minimum width`, and `minimum height`.
- Accepted bend values: `in and out`, `out and in`, and `none`.
- Accepted anchors: compass anchors and automatic border clipping for incoming
  and outgoing paths.
- Out of scope: text/base/mid anchors, shape-border rotation, incircle mode,
  and other unimplemented `shapes.symbols` node families.

## Local source review

Reviewed the installed TeX Live 2025 implementation and manual:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.symbols.code.tex:2099-2558`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex:1077-1163`

The implementation follows these source details:

1. The default top and bottom style is `in and out`; `tape bend` assigns the
   same value to both sides.
2. Each bent edge consists of two 90-degree elliptical arcs. The x radius is
   `cos(45 degrees)` times the half width, while the y radius is
   `(2 + sqrt(2))` times half the configured bend height.
3. PGF adds the active bends to the text-box height before enforcing the
   minimum height, then removes those additions from the rectangular core.
   This means a minimum-height tape does not grow twice by the bend amount.
4. `in and out` and `out and in` swap the phase of the two half waves;
   `none` replaces the complete side with a straight segment.
5. The installed PGF 3.1.11a source intentionally selects all four south
   compass-anchor branches from the top bend style, even if the visible bottom
   style differs. TikZKit preserves that observable behavior.

## Reference artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`.
- Rasterizer: `/opt/homebrew/bin/rsvg-convert`.
- Native engine: `/Library/TeX/texbin/pdflatex`.
- Final QA root: `outputs/qa-shapes-symbols-tape-2026-09-04-final/`.
- Four-way native sheets:
  - `diff/shapes-tape-manual-catalog-native-sheet.png`
  - `diff/shapes-tape-process-log-native-sheet.png`
  - `diff/shapes-tape-sensor-strip-native-sheet.png`
- Saved tikztosvg SVGs: `tikztosvg-svg/`.
- Saved TikZKit SVGs: `tikzkit-svg/`.

The tikztosvg/dvisvgm output uses a transformed, closed path with nonzero fill,
butt line caps, miter joins, and glyph paths for text. Its tape outline has the
same two elliptical half waves per bent edge. TikZKit emits equivalent cubic
segments directly in canvas coordinates and keeps text as scoped SVG text.

## Visual result

Before this change, every ordinary tape node fell back to a rectangle. Bend
phase, bend height, the straight-edge variants, curved compass anchors, and
curved border clipping were all absent.

After this change:

- The manual catalog renders all six focused variants: default, flat top,
  reversed bottom, both bends reversed, top-only bend, and fully straight.
- Direct `tape` and `shape=tape` syntax share the same geometry.
- Blue and red anchor probes land on the same compass positions as native PGF,
  including the asymmetric south-anchor source behavior.
- Process-flow arrows stop at the curved tape outline instead of a hidden
  rectangle, and the corner probe lines begin at the true tape corners.
- The sensor strip's mixed top/bottom phase, north anchor, formula, dashed
  leader, colors, line widths, and layer order match the references.
- Final raster dimensions are 385x118 vs 386x123 vs 386x122, 379x76 vs
  379x79 vs 379x79, and 322x110 vs 323x111 vs 323x111 for TikZKit,
  tikztosvg, and MacTeX respectively.
- All three engines rendered all fixtures with zero diagnostics, and every
  native four-way sheet was inspected.

Remaining visible differences are limited to Computer Modern glyph
rasterization, subpixel strokes, and a 1-5px outer crop margin. No focused
shape, anchor, arrow, label, or bend variant is missing.

## Command and parameter audit

| Source item | Status | Implementation |
| --- | --- | --- |
| `\documentclass[border=4pt]{standalone}` | accepted wrapper | fixture crop and reference harness |
| `\usepackage{tikz}` | implemented | package registry |
| `\usetikzlibrary{shapes.symbols,positioning,arrows.meta}` | implemented for used slices | per-library registries |
| `\begin{tikzpicture}[>=Stealth]`, `>=Latex` | implemented | scoped arrow-tip defaults |
| `every node/.style`, `block/.style`, `log/.style`, `flow/.style`, `sensor/.style`, `strip/.style` | implemented | style definition and expansion |
| `\node[tape]`, `shape=tape` | implemented | source-derived tape layout and renderer |
| `tape bend=out and in` | implemented | shorthand for both bend styles |
| `tape bend top`, `tape bend bottom` | implemented | independent phase or straight edge |
| `tape bend height=7pt/8pt/9pt/10pt` | implemented | physical bend geometry and sizing |
| `minimum size`, `minimum width`, `minimum height` | implemented | bend-before-minimum PGF sizing rule |
| `draw`, `fill`, `thin`, `thick`, `dashed`, `align`, `circle` | implemented for fixture usage | shared style, path, and node rendering |
| `right=of`, `below=of`, `node distance=a and b` | implemented | positioning library |
| `.north`, `.north east`, `.east`, `.south east`, `.south`, `.south west`, `.west`, `.north west` | implemented | source-compatible tape compass anchors |
| `\draw[->]`, `\fill`, `--`, `++(x,y)`, inline `node[above]` | implemented | path builder, arrows, and path-node placement |
| `$x_k$`, `$s(t)$`, `$s_0,\ldots,s_n$`, multiline `\\` | implemented | SVG math/text measurement and layout |

No command or option used by these three focused fixtures is silently ignored.
The library remains `partial` because unrelated symbol nodes and the
out-of-scope anchor modes above are not yet implemented.

## Verification

```sh
node --test test/shapes-symbols-tape.test.js test/shapes-symbols-magnetic-tape.test.js test/shapes-symbols-signal.test.js test/library-modules.test.js
npm run examples:render -- --output outputs/qa-shapes-symbols-tape-2026-09-04-final --only shapes-tape-manual-catalog,shapes-tape-process-log,shapes-tape-sensor-strip --tikztosvg --native-reference --grid
npm run examples:diff -- --output outputs/qa-shapes-symbols-tape-2026-09-04-final --register --alignment-radius 3
npm run extension-registry
```

The focused module, sizing, phase, renderer, border, and anchor suite passes
18/18. The browser workbench also loads the three fixtures with both 1cm-grid
panels and zero diagnostics or console errors.

## Next slice

Continue `shapes.symbols` with one independently verifiable family selected by
corpus frequency and visual severity. `forbidden sign` is a compact next
candidate; `cloud` should be handled separately because its border geometry
and anchors require a larger algorithmic slice.
