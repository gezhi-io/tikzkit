# tkz-fct Independent Axes QA (2026-08-05)

## Scope

This slice implements the installed `tkz-base` axis commands `\tkzDrawX` and
`\tkzDrawY`. It is intentionally narrower than `\tkzAxeXY`: the native package
splits axis line/ticks (`DrawX`/`DrawY`) from numeric graduation text
(`\tkzLabelX`/`\tkzLabelY`). No numeric tick labels are introduced here.

The driver is a direct manual-style polar example:

```tex
\tkzInit[xmin=-1,xmax=1,ymin=-1,ymax=1,xstep=.2,ystep=.2]
\tkzGrid
\tkzDrawX
\tkzDrawY
\tkzFctPolar[domain=0:2*pi,samples=400]{cos(2*t)}
```

## Local Source Review

Read:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-base/tkz-obj-axes.tex`,
  lines 141-204 (`\tkzDrawX`) and 213-270 (`\tkzDrawY`);
- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-base/tkz-base.cfg`,
  lines 101-149 (default dimensions and axis/label styles);
- `/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-base/TKZdoc-base-axes.tex`.

The native commands use `xaxe style` / `yaxe style` (`->`, `>=latex`) and
place the axis-name node at the arrow endpoint using `below=3pt` or `left=3pt`.
Their defaults are a `0.4pt` axis, `0.8pt` tick, 2pt tick half-lengths, and
0.5 units of room at the positive endpoint. `DrawX` follows the native source's
unit-position tick loop; `DrawY` honors its `step` spacing. Both use the native
`trig` pi-position branch. This is why the implementation does not reuse the
combined-axis label generation.

## Artifacts And Visual Review

Artifacts live in `outputs/qa-tkz-draw-axes/`:

- `native.png`: MacTeX rendering of the unmodified `tkz-fct` driver with the
  cached native Gnuplot table;
- `after/tikzkit.svg` and `after/tikzkit.png`: TikZKit after implementation;
- `before/tikzkit.svg` and `before/tikzkit.png`: the pre-change renderer;
- `tikztosvg.svg` and `tikztosvg.png`: local
  `/Library/TeX/texbin/tikztosvg` rendering of an equivalent frozen 400-point
  path;
- `sheet-native-tikztosvg-before-after.png` and `diff-native-after.png`:
  review sheet and pixel-difference aid.

`tikztosvg` is installed at `/Library/TeX/texbin/tikztosvg`. Direct execution
of the original `\tkzFctPolar` macro is not possible there because the tool
compiles in a temporary job directory and the macro expects a job-specific
Gnuplot table; local `gnuplot` is absent. The reference therefore freezes the
same sampled polar points in ordinary TikZ. Its SVG uses a single sampled
`<path>`, `stroke-linecap="butt"`, `stroke-linejoin="miter"`, and an explicit
transform. TikZKit emits the same cap/join and an explicit latex-arrow tip path
with a renderer-sized `viewBox`.

The four-panel sheet was visually inspected:

- Before: grid only. The unsupported `\tkzDrawX` halted command processing, so
  neither axes nor the polar curve appeared.
- After: independent horizontal and vertical arrows, 2pt two-sided ticks,
  `$x$`/`$y$` endpoint labels, and all four rose petals appear.
- MacTeX and TikZKit share the origin, integer-grid locations, petal endpoints,
  and axis directions. Remaining differences are renderer canvas padding,
  grid stroke darkness, and TeX-versus-browser glyph metrics.
- The tikztosvg equivalent has the same curve/path geometry but omits the
  `DrawX`/`DrawY` endpoint text because it is a frozen ordinary-TikZ reference,
  not a claim that tikztosvg executed the cache-dependent macro.

## Commands, Options, And Tests

Implemented:

- `\tkzDrawX[ color, label, right space, left space, noticks, tickwd, tickup,
  tickdn, trig ]`;
- `\tkzDrawY[ color, label, up space, down space, noticks, tickwd, ticklt,
  tickrt, step, trig ]`;
- shared supported path/text keys: `line width` and `text`.

Not implemented: `\tkzLabelX`, `\tkzLabelY`, `frac`, `orig`, `np off`,
custom `xlabel style` / `ylabel style`, or arbitrary user-defined TikZ style
keys passed through the native `/tikz` key search.

Verification:

```bash
node --test test/tkz-fct.test.js
node bin/tikz2svg.js outputs/qa-tkz-draw-axes/tkz-draw-axes.tex \
  -o outputs/qa-tkz-draw-axes/after/tikzkit.svg --math-renderer svg-text
```

The focused suite passes 16/16. The real manual-style case visibly improves
from a grid-only image to the native-aligned coordinate system and polar curve.

## Next Slice

`\tkzLabelX` / `\tkzLabelY` are the next matching `tkz-base` boundary: add
numeric labels, `orig`, fractional, and trig formatting without regressing
independent-axis geometry.
