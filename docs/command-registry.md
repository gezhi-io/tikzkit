# TikZ Command Registry

This file records the core command/environment split for the JavaScript TikZ
interpreter. The runtime is still deliberately centralized in a few mature
files, but every common command now has a small registry module under
`src/commands/` so future work can move behavior out command by command without
losing track of options.

Machine-readable command metadata lives in `src/commands/index.js`.

## Current Pipeline

```text
source
  -> parser.js
  -> preprocess.js for package-level rewrites such as pgfplots axis/addplot
  -> interpreter.js for TikZ semantic execution
  -> options.js for key/value, style expansion, colors, widths, arrows
  -> renderer-svg.js
```

## Command Modules

| command/environment | kind | status | main implementation | option families |
| --- | --- | --- | --- | --- |
| `tikzpicture` | environment | core | `parser.js`, `interpreter.js`, `options.js` | picture defaults, `>=`, `font`, `node distance`, basis/scale, `name/.style` |
| `\draw` | command | core | `parser.js:parsePathStatement`, `interpreter.js:interpretPathStatement`, `renderer-svg.js` | stroke/fill, colors, line widths, dashes, arrows, decorations, inline nodes |
| `\path` | command | core | `parser.js:parsePathStatement`, `interpreter.js:buildPath` | `--`, curves, `to`, `edge`, circle/ellipse/rectangle/arc, plot, fill/clip |
| `\node` | command | core | `parser.js:parseNodeStatement`, `interpreter.js:createNode`, `math-metrics.js` | shapes, anchors, box model, text/font, positioning, transforms |
| `\coordinate` | command | core | `parser.js:parseCoordinateStatement`, `interpreter.js:resolveCoordinate`, `libraries/calc.js` | named coordinates, calc interpolation, polar coordinates, node anchors, shifts |
| `axis` | environment | partial | `preprocess.js:expandPgfplotsAxes`, `renderAxisAsTikz` | ranges, ticks, axis lines, width/height, labels, legends, 3D/surf slice |
| `\addplot` | command | partial | `preprocess.js:parseAddplots`, `evaluateAxisExpressionAtSample` | function expressions, coordinates, table, samples/domain, style, marks, filled plots |

## Example Option Flow

For:

```tex
\begin{tikzpicture}[
  >=Stealth,
  font=\tt,
  vtx/.style={circle, draw, very thick, minimum size=7mm, inner sep=1pt},
  lbl/.style={fill=white, inner sep=1.5pt},
  tour/.style={thick, red, dashed},
]
```

- `>=Stealth` is a picture-level arrow default. It is read by
  `options.js:arrowTipsFromOptions` and eventually becomes SVG arrow geometry in
  `renderer-svg.js`.
- `font=\tt` is stored in picture options and inherited by node and inline path
  label normalization. The current implementation approximates TeX font metrics.
- `vtx/.style={...}` is stored as a local style definition. Later
  `\node[vtx]` expands to `circle`, `draw`, `very thick`, `minimum size=7mm`,
  and `inner sep=1pt`.
- `lbl/.style={fill=white, inner sep=1.5pt}` is a label style; it usually
  affects node background and text padding.
- `tour/.style={thick, red, dashed}` is a path style; later `\draw[tour]`
  expands to a red dashed thick stroke.

## Why This Exists

The codebase already separates `\usetikzlibrary{...}` in `src/libraries/` and
`\usepackage{...}` in `src/packages/`. Core TikZ commands were harder to audit
because their behavior spans parser, interpreter, option normalization, text
metrics, and SVG rendering. The command registry gives every high-frequency
command a single ownership file and a documented option map before we do deeper
execution refactors.

## Next Refactor Targets

1. Move path option normalization wrappers from `interpreter.js` into
   `src/commands/draw.js` / `src/commands/path.js`.
2. Move node box-model and anchor helpers behind a `node` command API while
   keeping shared geometry utilities reusable.
3. Split PGFPlots `axis` and `addplot` preprocessing into command/environment
   adapters that can be tested independently from the rest of `preprocess.js`.
