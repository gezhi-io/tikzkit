# `tkz-fct`: `tkzDrawArea` / `tkzArea` QA

## Scope

This slice implements the documented `tkz-fct` scalar-function area command:
`\tkzDrawArea` and its native alias `\tkzArea`. It fills from the most
recent `\tkzFct` curve to source-coordinate `y=0`, limited by `domain`,
`samples`, and the initialized frame. It does not implement
`\tkzDrawAreafg` / `\tkzAreafg` between-function fills.

The regression fixture is
`test/fixtures/examples/tkz-fct/area-under-function.tex`. It intentionally
uses an orange fill from `x=-1` to `x=2` over a quadratic, so a missing fill,
an incorrect closing axis, or an uncropped domain is immediately visible.

## Local MacTeX Study

Reviewed on 2026-08-07:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-fct/tkz-fct.sty`
  (`tkzArea` definition, lines 236-286)
- `/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-fct/TKZdoc-fct-area.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-base/tkz-tools-colors.tex`
  (`\tkz@otherlinecolor` default)

The native macro aliases `\tkzDrawArea` to `\tkzArea`. It maps the requested
source domain through `tkzInit`'s `xstep`, shifts same-sign local origins, and
emits a closed `fill` path: `(domain start,0) -- plot latest function --
(domain end,0)`. Its defaults are `domain=-5:5`, `samples=200`,
`opacity=.5`, and `color=\tkz@otherlinecolor`.

TikZKit shares its scalar sampling and clipping with `\tkzFct`, but maps the
closing `y=0` edge through the active source origin and `ystep`. This matters
when the visible y-range does not contain zero.

## Three-Way Visual QA

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNGs were generated
with `/opt/homebrew/bin/rsvg-convert`. Artifacts are retained in:

`/private/tmp/tikzkit-qa-tkz-fct-area-2026-08-07/`

- TikZKit SVG/PNG: `tikzkit-svg/area-under-function.svg` and
  `tikzkit-png/area-under-function.png`
- tikztosvg SVG/PNG: `tikztosvg-svg/area-under-function.svg` and
  `tikztosvg-png/area-under-function.png`
- MacTeX native PNG: `mactex-png/area-under-function.png`
- before image: `before/tikzkit.png`
- registered comparison sheet/diff: `diff/tkz-fct-area-under-function-native-sheet.png`
  and `diff/`

I inspected the before image, repaired TikZKit PNG, MacTeX PNG, tikztosvg
PNG, and comparison sheet. Before the change, the blue curve is present but
the orange region is wholly absent. After the change, all three renderers
show the translucent orange closed area only between `x=-1` and `x=2`:
above the axis on the left of the quadratic root and below it until the root
at `x=2`. The curve and fill are clipped at the plot boundary, so no orange
polygon extends into the label margin.

The raw `tkz-fct` reference cannot compile directly in this local
environment because the package requires an external Gnuplot-generated
`source.tkzfonct.table`, while no `gnuplot` executable is installed. For the
native and tikztosvg comparisons I rendered TikZKit's ordinary-TikZ lowering
of the same fixture. That isolates and validates the area geometry after
`tkz-fct` has performed its documented source-unit setup. The local
`tikztosvg` executable also needs a temporary BSD `rm` compatibility wrapper
for its cleanup command; no project file relies on that wrapper.

The tikztosvg SVG confirms the intended structure: a rectangular `clipPath`
around the initialized frame and a closed `fill-rule=nonzero` area path with
orange fill and `fill-opacity=.45`. Its sampled curve uses its normal SVG
path and standard butt-capped stroke. TikZKit produces the same closed,
clipped fill topology.

Residual raster differences are limited to output extent, text metrics, and
anti-aliasing. No visible fill-domain, axis-baseline, color, or opacity
regression remains in the fixture.

## Verification

```sh
node --test test/tkz-fct.test.js
node bin/tikz2svg.js test/fixtures/examples/tkz-fct/area-under-function.tex \
  -o /private/tmp/tikzkit-qa-tkz-fct-area-2026-08-07/tikzkit-svg/area-under-function.svg \
  --math-renderer svg-text
node scripts/diff-example-pngs.js \
  --output /private/tmp/tikzkit-qa-tkz-fct-area-2026-08-07 \
  --register --alignment-radius 3
```

The focused regression suite passes with no TikZKit diagnostics for the new
fixture.

## Remaining Work

`\tkzDrawAreafg` / `\tkzAreafg` needs named-function lookup and sampled
curve-to-curve clipping. Native Gnuplot cache/file IDs, asymptotes, adaptive
sampling, richer paint options, and full parametric discontinuity analysis
remain separate `tkz-fct` slices.
