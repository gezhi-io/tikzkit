# tkz-fct Pole Branch QA

## Scope

This follow-up is deliberately limited to one `tkz-fct` behavior: scalar
`\tkzFct` output must not join two finite samples through a vertical
asymptote. The driver is
`test/fixtures/examples/tkz-fct/tangent-poles.tex`, a direct use of the
manual's documented gnuplot expression grammar with `tan(x)`, a `-2:2`
domain, and 81 samples.

The implementation is shared in
`src/extensions/tkz-fct.js:hasDiscontinuityBetween`, not tailored to this
fixture. It splits only when consecutive samples are outside opposite vertical
frame bounds and evaluating the source midpoint is non-finite or remains
outside the frame. This retains a continuous steep segment that crosses the
canvas while removing the false top-to-bottom bridge at a sampled pole.

## Local MacTeX Reading

Reviewed again:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-fct/tkz-fct.sty`
  (the `\tkzFct` path and gnuplot-table setup around lines 80--155)
- `/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-fct/TKZdoc-fct-fonctions.tex`
  (scalar function/domain examples and documented expression workflow)

The package gives gnuplot the source-domain expression, scales through
`xstep`/`ystep`, and relies on the TikZ clip frame. It does not ask gnuplot to
join paths across a pole. The browser implementation now gives each surviving
sampled branch its own ordinary TikZ path before rendering.

## Command Audit

| Command or option | Status | Notes |
| --- | --- | --- |
| `\tkzInit[xmin,xmax,ymin,ymax]` | implemented | Supplies the clipping frame used for the branch test. |
| `\tkzFct[domain=-2:2,samples=81]{tan(x)}` | implemented | Radian `tan` evaluation creates three visible branches. |
| source-unit `xstep`/`ystep` | implemented | Applied before frame comparison and clipping. |
| `color=red`, `line width`, `style` | implemented | Preserved on every emitted branch. |
| non-finite sample | implemented | Flushes the current path directly. |
| finite samples across a pole | implemented, bounded | Uses the opposite-bound/midpoint rule described above. |
| adaptive sampling, arbitrary jump/removable discontinuity analysis | deferred | Requires richer numerical or symbolic continuity analysis. |
| `\tkzFctPar`, `\tkzFctPolar`, gnuplot table/cache ids | deferred | Different geometry and external-process contracts. |

## Reference Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. The original `tkz-fct` document is retained
in `raw-render/`, where tikztosvg correctly reports
`Plot data file tmp.tkzfonct.table not found`; MacTeX records the equivalent
`tangent-poles.tkzfonct.table not found` in
`outputs/qa-tkz-fct-poles-final/raw-mactex/tangent-poles.log`. This machine has
no `gnuplot` binary to create either required table.

For a real geometric reference, the saved lowered ordinary TikZ is exactly the
browser lowerer's output with only `\usepackage{tkz-fct}` replaced by TikZ:

- TikZKit JS SVG/PNG: `outputs/qa-tkz-fct-poles-final/raw-render/tikzkit-svg/`
  and `outputs/qa-tkz-fct-poles-final/raw-render/tikzkit-png/`
- MacTeX PNG: `outputs/qa-tkz-fct-poles-final/mactex-lowered/tkz-fct-tangent-poles.png`
- tikztosvg SVG/PNG: `outputs/qa-tkz-fct-poles-final/tikztosvg-lowered/`
- sheet and diff: `outputs/qa-tkz-fct-poles-final/diff/`

The tikztosvg SVG has `viewBox="0 0 138.76 306.37"`, outline-text paths,
`stroke-linecap="butt"`, `stroke-linejoin="miter"`, and physical line widths
such as `0.3985`. TikZKit's SVG uses browser SVG paths/text and a slightly
different canvas size, so the raw pixel diff is red across most of the panel;
it is retained for inspection, not used as the geometric acceptance test.

## Visual Review

Before the change, consecutive finite samples on either side of `x = -pi/2`
and `x = pi/2` were clipped to opposite frame edges and connected, producing
two full-height red vertical lines. After the change, Native MacTeX,
tikztosvg, and TikZKit each visibly contain three red branches: the left branch
ends at the upper frame edge, the central branch runs through `(0,0)` from
bottom to top, and the right branch begins at the lower edge. No red segment
crosses an asymptote.

Canvas margins, glyph metrics, and the optional browser comparison grid still
differ; they do not move the function branch endpoints relative to the source
grid. The diff report records a dimension mismatch (`188x412` TikZKit versus
`186x409` tikztosvg) and is not presented as a similarity score.

## Validation

Passed:

```bash
node --test test/tkz-fct.test.js
node --test test/library-modules.test.js
```

The focused test asserts three red paths and rejects a near-vertical full-frame
bridge. Both the original raw render diagnostic and the lowered MacTeX/
tikztosvg/JS artifact set are saved above.
