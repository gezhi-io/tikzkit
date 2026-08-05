# tkz-fct Polar Curves QA (2026-08-05)

## Scope

This is a separate `\tkzFctPolar[options]{r(t)}` slice. It implements finite
sampled polar curves with `domain`, `samples`, documented `t` expressions,
ordinary draw styling, native radius scaling, and same-sign local-origin
offsets. It intentionally does not add a clip rectangle: the local macro does
not clip its polar Gnuplot plot.

The driver follows the installed manual's second polar example, with the
existing `tkzGrid`/`tkzAxeXY` frame added for visual comparison:

```tex
\tkzInit[xmin=-1,xmax=1,ymin=-1,ymax=1,xstep=.2,ystep=.2]
\tkzGrid
\tkzAxeXY
\tkzFctPolar[domain=0:2*pi,samples=400]{cos(2*t)}
```

The negative-radius portions of `r(t)=cos(2t)` produce a four-petal rose, so
the case verifies polar angle conversion, radial sign handling, and the
command's non-clipping semantics.

## Local Source Review

Read:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-fct/tkz-fct.sty`,
  lines 373-402 (`\tkzFctPolar`);
- `/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-fct/TKZdoc-fct-polar.tex`,
  the option table and examples 1-2.

Unlike `\tkzFctPar`, the native macro uses Gnuplot `set polar`, defaults to
`domain=0:2*pi` and `samples=200`, divides the radius by `xstep` only, applies
the existing same-sign x/y origin shifts, and does not call `\clip`. TikZKit
uses the same `r(t) cos(t), r(t) sin(t)` mapping in radians, keeping the
intentionally asymmetric `xstep` behavior instead of inventing a separate
`ystep` scaling rule.

## Artifacts And Visual Review

Artifacts are in `outputs/qa-tkz-fct-polar/`:

- `native.png`: MacTeX rendering of the original macro with its precomputed
  Gnuplot parameter table;
- `after/tikzkit.svg` and `after/tikzkit.png`: TikZKit after implementation;
- `tikztosvg.svg` and `tikztosvg.png`: equivalent frozen polar samples rendered
  by `/Library/TeX/texbin/tikztosvg`;
- `before/tikzkit.svg` and `before/tikzkit.png`: the pre-change coordinate
  frame without a polar curve;
- `sheet-native-tikztosvg-before-after.png` and `diff-native-after.png`: visual
  review sheet and pixel-difference aid.

The original `\tkzFctPolar` cannot be run directly by tikztosvg in this local
environment: it compiles in a temporary directory, while the macro depends on
a Gnuplot `<jobname>.tkzpolarfct.table`, and `gnuplot` is not installed. The
third-party SVG instead renders exactly the same 400 frozen radial samples. It
is suitable for path structure and visible geometry comparison, but is not a
claim that tikztosvg executes the macro here.

The sheet was visually inspected:

- Before: axes/grid appeared but the four-petal rose was completely missing.
- After: top, bottom, left, and right petals reach the same labelled extrema
  as MacTeX; all four meet at the origin; negative-radius segments fold into
  the opposite petals instead of being discarded.
- Residual differences are canvas padding, tick-label metrics, rasterization,
  and the simpler equivalent-reference axis labels. The curve geometry itself
  is present and aligned.

The equivalent SVG has `viewBox="0 0 312.21 312.21"`, a sampled SVG path, and
the native `stroke-linecap="butt"`/`stroke-linejoin="miter"` defaults.

## Commands, Options, And Tests

Implemented:

- command: `\tkzFctPolar`;
- options: `domain`, `samples`, `color`, `style`, `line width`, and supported
  generic draw options;
- expressions: numeric `t`, `pi`, arithmetic, and the shared JS PGF-math
  trigonometric subset;
- geometry: native radius-to-`xstep` normalization, negative radius behavior,
  same-sign origin shifts, and no implicit clip.

Still unimplemented: cache `id` reuse; arbitrary Gnuplot syntax; adaptive
sampling; robust splits at all non-finite polar singularities; `ball color`,
`shading`, and other advanced paint keys; polar tangents/areas/asymptotes.

Verification:

```bash
node --test test/tkz-fct.test.js
node bin/tikz2svg.js outputs/qa-tkz-fct-polar/tkz-fct-polar.tex \
  -o outputs/qa-tkz-fct-polar/after/tikzkit.svg --math-renderer svg-text
```

The focused suite passes 14/14 after adding the polar regressions. The selected
manual driver visibly improves from no curve to a native-aligned four-petal
rose.

## Next Slice

`\tkzDrawX` and `\tkzDrawY` appear in the original manual examples and should
be implemented as a separate axis-command slice. They have different label and
tick contracts from `\tkzAxeXY`.
