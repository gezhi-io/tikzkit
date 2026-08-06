# tkz-fct Tangent Line QA

## Scope

This pass implements one bounded `tkz-fct` command family:
`\tkzDrawTangentLine[options](x)`. The new real driver is
`test/fixtures/examples/tkz-fct/tangent-line.tex`, derived from the local
`TKZdoc-fct-tangent.tex` documentation. It plots `x*x` and adds a blue tangent
at `x=1` with unequal left/right half lengths and a contact-point mark.

## Local MacTeX Reading

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-fct/tkz-fct.sty`, lines
  176--245 (`\tkzDrawTangentLine`)
- `/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-fct/TKZdoc-fct-tangent.tex`,
  especially the documented `with`, `kl`, `kr`, and `draw` behavior

The package retains every `\tkzFct` expression under letter names (`a`, `b`,
and so on). A tangent selects the last function or `with=a`, evaluates one
one-sided finite difference per half-line at `10^-6` source units, and maps
the horizontal and vertical components independently through `xstep` and
`ystep`. Its default `tan style` is a LaTeX arrow at the end of each half-line.

TikZKit now follows those semantics in the shared tkz-fct preprocessor:

- remembers each scalar `\tkzFct` expression;
- accepts `with=a`, `kl`, `kr`, `draw`, color, line-width, and ordinary dashed
  style options;
- emits each half-tangent separately, preserving directional arrowheads; and
- draws the native 2pt black contact marker when `draw` is set.

The global user override `tan style/.style=...`, `\tkzDefPointByFct`, areas,
asymptotes, gnuplot cache files, and adaptive derivatives remain outside this
slice.

## Reference Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion uses
`/opt/homebrew/bin/rsvg-convert`.

The raw package driver cannot render directly on this machine: the installed
`tkz-fct.sty` delegates `\tkzFct` to a missing external `gnuplot` binary, so
both raw tikztosvg and raw MacTeX report a missing `tkzfonct.table`. The saved
logs are retained rather than treated as success. The browser's lowered
ordinary TikZ output is therefore rendered by both local MacTeX and tikztosvg
to isolate the tangent geometry and SVG rendering.

- TikZKit JS SVG/PNG:
  `outputs/qa-tkz-fct-tangent-line-after-2026-08-06/tikzkit-svg/` and
  `outputs/qa-tkz-fct-tangent-line-after-2026-08-06/tikzkit-png/`
- MacTeX PNG from lowered TikZ:
  `outputs/qa-tkz-fct-tangent-line-after-2026-08-06/mactex-lowered/`
- tikztosvg SVG/PNG from lowered TikZ:
  `outputs/qa-tkz-fct-tangent-line-after-2026-08-06/tikztosvg-lowered/`
- Four-panel visual sheet (JS, MacTeX, tikztosvg, difference):
  `outputs/qa-tkz-fct-tangent-line-after-2026-08-06/diff/tkz-fct-tangent-line-sheet.png`

The tikztosvg SVG uses a `110.42pt x 164.64pt` viewBox, a `0.3985pt` blue
stroke with butt caps/miter joins, and separate filled arrow-tip paths. The
TikZKit SVG uses a `112.63pt x 166.94pt` viewBox and explicit LaTeX arrow-tip
paths. The small canvas difference comes from browser text metrics; the source
grid, contact point, tangent slope, half-line directions, and arrow locations
visibly agree.

## Visual Review

Before the change, the red parabola and axes rendered but
`\tkzDrawTangentLine` was left unexpanded, so no blue tangent or contact mark
appeared. After the change, all three visible references contain a blue
rightward/upward half-tangent, a blue leftward/downward half-tangent, and the
black point at `(1,1)`. The unequal lengths (`kr=1.25`, `kl=.75`) remain
unequal after the coordinate conversion; this confirms the command is not a
fixed overlay for the fixture.

## Validation

Passed:

```bash
node --test test/tkz-fct.test.js
git diff --check
```

The focused suite now covers both the remembered-last-function path and the
documented `with=a` selection path. Neither case adds diagnostics.
