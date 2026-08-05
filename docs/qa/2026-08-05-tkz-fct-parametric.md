# tkz-fct Parametric Curves QA (2026-08-05)

## Scope

This slice implements `\tkzFctPar[options]{x(t)}{y(t)}` only. It covers
finite sampled parametric curves with `domain`, `samples`, documented `t`
expressions, ordinary draw styling, independent `xstep`/`ystep` scaling, and
the `\tkzInit` clip rectangle. It deliberately excludes `\tkzFctPolar`,
areas, tangents, asymptotes, Gnuplot cache IDs, adaptive sampling, and general
parametric discontinuity analysis.

The driver is the first real example in the installed `tkz-fct` manual:

```tex
\tkzInit[ymax=2.25,ystep=.5]
\tkzGrid
\tkzAxeXY
\tkzFctPar[samples=400,domain=0:2*pi]{(t-sin(t))}{(1-cos(t))}
```

It is a cycloid arch. Its non-unit `ystep=.5` verifies that `x(t)` and `y(t)`
are first evaluated in source units and then mapped independently into the
local `tkzInit` frame.

## Local Source Review

Read:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-fct/tkz-fct.sty`,
  lines 341-370 (`\tkzFctPar`);
- `/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-fct/TKZdoc-fct-param.tex`,
  especially the parameter-curve options and examples.

The native macro sets `domain=-5:5`, `samples=200`, `fp=true`, and
`id=tkzfct`; clips to the initialized frame; evaluates Gnuplot `x(t)` and
`y(t)`; divides each by `xstep`/`ystep`; and offsets same-sign local origins.
TikZKit mirrors the geometric portions of that flow in JavaScript and keeps
the ordinary draw options on the generated path.

## Artifacts And Visual Review

Artifacts are kept together in
`outputs/qa-tkz-fct-parametric/`:

- `native.png`: MacTeX output of the original macro using its generated
  parameter-table cache;
- `after/tikzkit.svg` and `after/tikzkit.png`: TikZKit after the change;
- `tikztosvg.svg` and `tikztosvg.png`: an equivalent frozen sampled-coordinate
  TikZ source rendered by `/Library/TeX/texbin/tikztosvg`;
- `before/tikzkit.svg` and `before/tikzkit.png`: the pre-change render;
- `sheet-native-tikztosvg-before-after.png` and `diff-native-after.png`:
  the four-panel review sheet and pixel-difference aid.

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. It cannot render the
original `\tkzFctPar` source directly in this environment because it compiles
inside a temporary directory and the macro expects Gnuplot's
`<jobname>.tkzparfct.table`; the local machine also has no `gnuplot` executable.
The saved equivalent source uses the same 400 samples and normalized
coordinates from the macro's emitted Gnuplot program. It is therefore a useful
SVG path/line-cap/viewBox reference, but not a claim that tikztosvg natively
executes `\tkzFctPar` here.

Visual inspection of native, equivalent tikztosvg, pre-change, post-change,
and the sheet found:

- Before: the axes and grid rendered, but the entire cycloid was missing.
- After: the black curve starts at the origin, peaks at the source label
  `y=2` near `x=pi`, and returns to the x-axis near `x=2*pi`, matching the
  native and equivalent SVG geometry.
- The remaining visible differences are raster/font antialiasing, reference
  canvas padding, and grid/label drawing details; the curve is no longer
  missing or misplaced.

The equivalent tikztosvg SVG uses `viewBox="0 0 298.04 142.13"`, a single
sampled path, `stroke-linecap="butt"`, and `stroke-linejoin="miter"`. TikZKit
keeps the curve as an ordinary polyline path so the renderer owns SVG output
and clipping rather than baking SVG strings into parsing.

## Commands, Options, And Tests

Implemented in this slice:

- command: `\tkzFctPar`;
- options: `domain`, `samples`, `color`, `style`, `line width`, plus supported
  generic draw options;
- expressions: numeric `t`, `pi`, arithmetic, `sin`, `cos`, and the existing
  JS PGF-math expression subset;
- frame behavior: `xstep`, `ystep`, same-sign local origins, and clipping.

Still unimplemented: `\tkzFctPolar`; parameter-curve `id`/cache reuse;
Gnuplot-specific language beyond the shared JS expression evaluator; adaptive
sampling; robust splits around every parametric pole; and advanced paint keys
such as `ball color`/`shading` when they need renderer support.

Verification:

```bash
node --test test/tkz-fct.test.js
node bin/tikz2svg.js outputs/qa-tkz-fct-parametric/tkz-fct-parametric.tex \
  -o outputs/qa-tkz-fct-parametric/after/tikzkit.svg --math-renderer svg-text
```

The focused regression suite passes 12/12. The visual acceptance for the
selected `\tkzFctPar` driver passes: the previously absent curve is visible
and aligned with the native/third-party geometry.

## Next Slice

Implement `\tkzFctPolar` separately. It has a different native default domain
(`0:2*pi`) and radial mapping, so combining it with this change would make the
regression boundary unclear.
