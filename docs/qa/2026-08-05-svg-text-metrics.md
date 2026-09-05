# SVG Text Metrics And Path Labels

## Scope

This verification slice covers the shared SVG text and bounding-box behavior
used by a path label such as:

```tex
\draw[thick, -stealth] (0,0) -- node[above] {$x$} (2,0);
```

It also verifies inline `pmatrix` layout, scoped font declarations, and
`\sansmath` fallback rendering because those features share the same resolved
FontSpec and text-node bounds pipeline. It does not claim complete TeX font or
arrow compatibility.

## Local References Reviewed

- `command -v tikztosvg` resolved to `/Library/TeX/texbin/tikztosvg`.
- `pdflatex` resolved to `/Library/TeX/texbin/pdflatex`.
- MacTeX source:
  `/usr/local/texlive/2025/texmf-dist/tex/latex/amsmath/amsmath.sty`.
  `pmatrix` wraps `\env@matrix` in `\left(` and `\right)`; `\env@matrix`
  compensates the outer `\arraycolsep`. The renderer therefore reserves the
  same outer matrix-column allowance in measurement and the SVG fallback.

For the arrow-label source, MacTeX reported the named node anchors as:

```text
TIKZKIT-NORTH=11.77148pt
TIKZKIT-SOUTH=0.0pt
TIKZKIT-CENTER=5.88574pt
```

This confirms that the node box, rather than a browser font heuristic, defines
the top of this drawing.

## Visual Evidence

Artifacts are intentionally ignored by Git and are stored locally at
`outputs/qa-svg-text-metrics-arrow/`.

- `arrow-math-label.pdf` and `mactex.png`: native MacTeX.
- `tikzkit.svg` and `tikzkit-natural.png`: JavaScript renderer.
- `tikztosvg.svg` and `tikztosvg-natural.png`: independent SVG reference.
- `comparison-sheet.png`: reviewed three-way panel.

The JavaScript output has canvas dimensions `57.49pt x 11.74pt`; tikztosvg
reports `57.49pt x 11.728pt`. The small height difference is SVG rounding.
Before the correction, TikZKit emitted `13.81pt` because it added the full
normal-direction arrow-tip footprint to a path already bounded by an inline
label. The corrected renderer keeps the terminal arrow extension but uses the
path label's TikZ bounding-box semantics for the normal direction. The
MacTeX, TikZKit, and tikztosvg panels now align in label baseline, line extent,
and arrow endpoint.

## Implemented Semantics

- Scoped font declarations affect only their intended text group; later text
  retains the enclosing FontSpec.
- Explicit physical font families take precedence over inherited generic
  families, while default Computer Modern keeps the embedded design face.
- `\begin{pmatrix}` reserves the `amsmath` array-column edge allowance in both
  node measurement and the SVG fallback.
- TikZ-generated paths declare whether painted stroke and arrow-tip normal
  extents belong to the document bbox. Generic Scene Graph paths retain full
  painted bounds.

## Regression Commands

```bash
node --test test/convert.test.js
node --test test/svg-renderer.test.js
node --test --test-name-pattern='includes inline arrow tip geometry' test/renderer.test.js
```

All of the commands above pass. The repository-wide `npm test` run still has
unrelated existing failures in PGFPlots/datavisualization compatibility,
fixture-manifest metadata, and workbench socket tests under the restricted
test environment; those are outside this text-and-bbox slice and remain
separate work.
