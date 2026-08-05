# xcolor Stateful Declarations: Artificial Neuron QA

## Scope

Implement one shared xcolor slice only: a leading `\color{name}` inside a
TikZ node and a standalone `\color{name}` declaration that changes the
following drawing/text state within its current scope. This is driven by the
real fixture `latex-examples-artificial-neuron`; it is not a per-case
coordinate patch.

## Local TeX Reading

- `/usr/local/texlive/2025/texmf-dist/tex/latex/xcolor/xcolor.sty`, lines
  762 onward: `\color` is declared as a robust command and dispatches to the
  declared/undeclared color handlers. It changes color state; its control
  sequence and argument do not create glyphs.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-paths.tex`,
  lines 929 onward: path `node[sloped,above]` labels are ordinary nodes
  positioned on and rotated with their path. Therefore their colors and TeX
  text boxes must be resolved before path-label placement/bounds calculation.

## Artifacts

- TikZKit SVG/PNG:
  `outputs/qa-artificial-neuron-2026-08-05/tikzkit-svg/latex-examples-artificial-neuron.svg`
  and `outputs/qa-artificial-neuron-2026-08-05/tikzkit-png/latex-examples-artificial-neuron.png`
- tikztosvg (`/Library/TeX/texbin/tikztosvg`, XeLaTeX engine) SVG/PNG:
  `outputs/qa-artificial-neuron-2026-08-05/tikztosvg-svg/latex-examples-artificial-neuron.svg`
  and `outputs/qa-artificial-neuron-2026-08-05/tikztosvg-png/latex-examples-artificial-neuron.png`
- MacTeX native PNG:
  `outputs/qa-artificial-neuron-2026-08-05/reference-native-png/latex-examples-artificial-neuron.png`
- Four-way sheets:
  `outputs/qa-artificial-neuron-2026-08-05/diff/latex-examples-artificial-neuron-sheet.png`
  and `outputs/qa-artificial-neuron-2026-08-05/diff/latex-examples-artificial-neuron-native-sheet.png`

## Visual Result

Before the change, the TikZKit panel printed `\colorgreen!40!black` as visible
glyphs in every sloped weight label. Those oversized labels pushed the canvas
to 186x229px while tikztosvg was 161x140px; each green label was black, and
the later standalone `\color{blue}` did not color the output arrow, dashed
divider, or vertical-ellipsis node.

After the change, the current three/four-way panels show red tiny input labels,
green tiny sloped `w_i` labels, and the blue output arrow/divider/ellipsis.
The TikZKit canvas is now 161x139px against tikztosvg's 161x140px. The
pixel-change ratio fell from 27.25% to 12.55%; this number is supplementary to
the visible removal of leaked TeX text and the restored colors. Remaining
differences are small cubic-control/arrow-endpoint offsets and text outline
rasterization, not missing objects.

## Implemented Syntax

- Node content: `\color{green!40!black}$\tiny w_0$`.
- Standalone declaration: `\color{blue}` affecting subsequent `\draw` and
  `\node` commands.
- Scope restoration: a nested `\begin{scope}\color{red}...\end{scope}`
  restores the parent color after the scope.
- Existing xcolor mixes now pass through `svgPaint` for math SVG output, so
  `green!40!black` becomes SVG `rgb(0 102 0)` instead of an invalid CSS token.

Not implemented in this slice: optional xcolor models (`\color[rgb]{...}`),
arbitrary in-line state changes partway through one text box, and the wider
xcolor color-series/masking APIs.

## Verification

```sh
node --test --test-name-pattern='inherits standalone xcolor declarations|leading xcolor' test/interpreter.test.js test/font-spec.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples --output outputs/qa-artificial-neuron-2026-08-05 --only latex-examples-artificial-neuron --native-reference --tikztosvg-engine xelatex
node scripts/diff-example-pngs.js --output outputs/qa-artificial-neuron-2026-08-05
```

All focused tests pass and diagnostics remain empty for the real fixture.
