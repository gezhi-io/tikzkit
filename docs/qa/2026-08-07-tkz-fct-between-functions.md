# `tkz-fct`: `tkzDrawAreafg` / `tkzAreafg` QA

## Scope

This slice implements the documented two-function area commands
`\tkzDrawAreafg` and `\tkzAreafg`. It supports the native sequential names
`a`, `b`, `c`, ..., the `between=a and b` selector, `domain`, `samples`,
`color`, `opacity`, and normal TikZ fill keys. It fills only where the first
named function is above the second one and splits at sampled intersections.

The visual driver is
`test/fixtures/examples/tkz-fct/area-between-functions.tex`, derived from
the installed `TKZdoc-fct-area.tex` examples. It draws `y=x` and `y=x^2/5`
and fills their bounded region from `x=0` to `x=5`.

## Local MacTeX Study

Reviewed on 2026-08-07:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-fct/tkz-fct.sty`
  (`tkzFct`, `tkzAreafg`, and `tkzDrawAreafg` alias)
- `/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-fct/TKZdoc-fct-area.tex`

Each `\tkzFct` increments a native alphabetic function binding (`a`, then
`b`, and so on); the plot `id` is not that binding. `\tkzAreafg` sets two
clips: the region below its first `between` function and the region above the
second. Filling the full domain rectangle after those clips leaves only the
area for which the first curve is above the second. Its defaults are
`between=a and b`, `domain=-5:5`, `samples=200`, `color=lightgray`, and
`opacity=.5`; `\tkzDrawAreafg` is an alias.

TikZKit uses paired source-unit samples, interpolates an explicit crossing
when the functions swap vertical order, and closes each valid upper/lower
band before clipping it to the `tkzInit` frame. This avoids a self-crossing
filled polygon when the two functions intersect.

## Three-Way Visual QA

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion uses
`/opt/homebrew/bin/rsvg-convert`. Artifacts are retained in:

`/private/tmp/tikzkit-qa-tkz-fct-band-2026-08-07/`

- before image: `before/tikzkit.png`
- TikZKit SVG/PNG: `tikzkit-svg/area-between-functions.svg` and
  `tikzkit-png/area-between-functions.png`
- tikztosvg SVG/PNG: `tikztosvg-svg/area-between-functions.svg` and
  `tikztosvg-png/area-between-functions.png`
- MacTeX native PNG: `mactex-png/area-between-functions.png`
- registered comparison sheet/diff:
  `diff/tkz-fct-area-between-functions-native-sheet.png` and `diff/`

I inspected the before panel, TikZKit, MacTeX, tikztosvg, and the comparison
sheet. Before this change, the blue line and red parabola are visible but the
entire region between them is white. After it, all three renderers show the
same orange translucent band: it starts at the common origin, is widest in
the middle, follows the blue line above and red parabola below, and contracts
to the shared endpoint at `(5,5)`. No fill leaks above the line, below the
parabola, or outside the initialized grid.

The tikztosvg SVG contains the expected rectangular `clipPath` and one
closed `fill-rule=nonzero` orange path with `fill-opacity=.45`, followed by
the blue/red function strokes. TikZKit has the same closed-band topology.

The registered TikZKit/MacTeX residual is `0.00713` mean absolute RGBA after
a 0px/-1px registration. The remaining visible difference is output crop,
font/raster antialiasing, and not a region, coordinate, or opacity error.

The raw `tkz-fct` source cannot compile directly here because the local
package expects a Gnuplot-generated function table and no `gnuplot`
executable is installed. As in the preceding area slice, MacTeX and
tikztosvg rendered the ordinary-TikZ lowering of this same source-unit
example, isolating the implemented band geometry. The local `tikztosvg`
binary additionally needs a temporary BSD `rm` compatibility wrapper; this
is not a project dependency.

## Verification

```sh
node --test test/tkz-fct.test.js
node bin/tikz2svg.js test/fixtures/examples/tkz-fct/area-between-functions.tex \
  -o /private/tmp/tikzkit-qa-tkz-fct-band-2026-08-07/tikzkit-svg/area-between-functions.svg \
  --math-renderer svg-text
node scripts/diff-example-pngs.js \
  --output /private/tmp/tikzkit-qa-tkz-fct-band-2026-08-07 \
  --register --alignment-radius 3
```

The focused suite passes with no diagnostics for the new fixture.

## Remaining Work

The current pair sampler covers scalar functions and finite sampled crossing
points. It does not yet replicate Gnuplot file/cache IDs, arbitrary function
aliases outside `a`/`b`/`c` order, adaptive intersection refinement,
asymptotes, or general parametric/function-object band filling.
