# tkz-fct Continuous Functions QA

## Scope

This pass implements one bounded `tkz-fct` family: continuous scalar
`\tkzFct[options]{expression}` plots. It accepts `domain`, `samples`,
`color`, `line width`, `style`, and the enclosing `\tkzInit`
`xstep`/`ystep` mapping. Each sampled line segment is clipped geometrically to
the initialized Cartesian frame before it reaches the renderer. A follow-up
pole slice also splits a sampled branch when consecutive finite samples cross
opposite vertical frame bounds and the midpoint remains out of frame.

The driver is the three-line example from the local `tkz-fct` manual:
`test/fixtures/examples/tkz-fct/linear-functions.tex`. It deliberately uses
`ystep=5` and a red line that exits the top of the frame, so coordinate mapping
and clipping are both visible.

Deferred: `\tkzFctPar`, `\tkzFctPolar`, gnuplot files and `id` caches,
tangents, areas, asymptotes, adaptive sampling, and general discontinuity
analysis.

## Local MacTeX Reading

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-fct/tkz-fct.sty`
  (the `\tkzFct` implementation around lines 80--155)
- `/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-fct/TKZdoc-fct-fonctions.tex`

The package takes the source `domain`, defines gnuplot `x` as the picture
coordinate multiplied by `xstep`, subtracts the y origin, divides the result
by `ystep`, and clips the resulting plot to the `\tkzInit` canvas. The
JavaScript lowerer follows those same units before emitting ordinary TikZ
paths. Its Liang--Barsky segment clip makes the visible result independent of
the browser renderer's still-partial `\clip` handling.

## Command Audit

| Source command or option | Status | Notes |
| --- | --- | --- |
| `\tkzInit[xmin,xmax,ymin,ymax,xstep,ystep]` | implemented | Existing base-frame state supplies function scaling. |
| `\tkzFct{2*x+5}` | implemented | Uses the shared expression evaluator with radian trig semantics. |
| `domain=0:10`, `samples=2` | implemented | Scalar bounds are evaluated, then uniformly sampled. |
| `color`, `line width`, `style=dashed` | implemented | Lowered into ordinary TikZ draw options. |
| clip to `\tkzInit` bounds | implemented | Every segment is clipped, including a boundary crossing between samples. |
| `\tkzFctPar`, `\tkzFctPolar` | deferred | Different parameter spaces and point construction. |
| gnuplot cache `id`, files, tangents, areas, asymptotes | deferred | Need the native gnuplot workflow or dedicated equivalents. |
| finite-sample pole branch splitting | implemented | Splits when opposite frame bounds are crossed and a midpoint check identifies a pole/out-of-frame discontinuity. |
| general discontinuity analysis | deferred | Removable discontinuities, arbitrary jumps, and undersampled poles need adaptive sampling or symbolic information. |

## Reference Artifacts

`tikztosvg` is available at `/Library/TeX/texbin/tikztosvg`; PNG conversion
uses `/opt/homebrew/bin/rsvg-convert`.

The original `tkz-fct` input cannot be rendered directly by either local
MacTeX or tikztosvg on this machine because `tkz-fct.sty` delegates to the
external `gnuplot` binary and it is not installed. This is an environment
limitation, not treated as JavaScript success. For the comparison, the saved
`lowered.tex`/`lowered-snippet.tikz` is the same semantic ordinary TikZ
produced by the new lowerer; MacTeX and tikztosvg both render that input.

- TikZKit SVG/PNG:
  `outputs/qa-tkz-fct-functions-final/tikzkit-svg/` and
  `outputs/qa-tkz-fct-functions-final/tikzkit-png/`
- MacTeX native PNG:
  `outputs/qa-tkz-fct-functions-final/mactex-lowered/tkz-fct-linear-functions.png`
- tikztosvg SVG/PNG:
  `outputs/qa-tkz-fct-functions-final/tikztosvg-lowered/`
- Four-panel sheet and TikZKit/tikztosvg diff:
  `outputs/qa-tkz-fct-functions-final/diff/tkz-fct-linear-functions-sheet.png`
- Raw-package render summary and missing-table diagnostic:
  `outputs/qa-tkz-fct-functions-final/raw-render/summary.json` and
  `outputs/qa-tkz-fct-functions-final/raw-render/tikztosvg-log/tkz-fct-linear-functions.log`

The tikztosvg SVG uses a `318.417pt x 145.063pt` viewBox, TeX glyph-outline
paths, and physical `stroke-width` values. TikZKit emits browser `<text>`
nodes and a `322.4pt x 153.65pt` viewBox; its graphic paths map to the same
grid coordinates, while its larger margins come from the shared browser text
metrics.

## Visual Review

Before this feature slice, `\tkzFct` was not lowered and function geometry was
absent. During the first render after adding sampling, the red `2*x+5` line
continued above `y=20` in TikZKit because the renderer did not honor the
generated clip path. After segment-level clipping it ends at exactly
`(7.5,20)`, matching MacTeX and tikztosvg; the blue dashed line runs from
`(0,15)` to `(10,5)`, and the green line stays at `y=7` in all three viewed
panels. The grid intersections and crossings align visibly.

The remaining difference is canvas presentation, not plot placement:
TikZKit is `430x205px`, tikztosvg is `425x194px`, and the native PNG is
`645x299px` at 144dpi. The diff is retained as evidence of the shared
text/bounds issue; it is not used as the acceptance criterion.

## Validation

Passed:

```bash
node --test test/tkz-fct.test.js
node --test test/library-modules.test.js
```

Visual artifacts were regenerated from the real manual fixture and inspected
as TikZKit, MacTeX, tikztosvg, and a four-panel diff/sheet output.

`node --test test/example-fixtures.test.js` reaches the public conversion test
successfully, but its corpus-audit assertion currently fails for an unrelated
existing manifest entry, `latex-examples/rectangle-split-ignore-empty.tex`.
That entry claims the TeX Live manual while the audit expects the
LaTeX-examples corpus; this pass does not modify it.

## Next Boundary

Keep the next change separate: refine the shared SVG text/bounds model used by
axis labels or add parametric/polar plotting. Do not fold either into the
finite-sample pole slice.
