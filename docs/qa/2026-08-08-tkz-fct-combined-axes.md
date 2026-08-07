# `tkz-fct` / `tkz-base`: Combined Cartesian Axes QA

## Scope

This slice implements the option-forwarding semantics of `\tkzAxeXY[...]`:
one option list reaches `\tkzDrawX`, `\tkzDrawY`, `\tkzLabelX`, and
`\tkzLabelY`. The accepted family is `label`, `text`, `trig`, `frac`, `step`,
`orig`, `ticks=false`, tick dimensions, and terminal `xlabel style` /
`ylabel style`. It does not claim the remaining `tkz-fct` function engine.

The real driver is
`test/fixtures/examples/tkz-fct/combined-axes-trig.tex`, copied from the
combined trigonometric-axis example in the installed `tkz-base` manual.

## Local Source Study

Read in MacTeX / TeX Live 2025:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-base/tkz-obj-axes.tex`:
  `\tkzAxeXY` calls the four draw/label commands in draw-first order, or
  label-first when `swap` is enabled. Its unknown-key forwarding gives each
  command the same local option list. `\tkzLabelX/Y` own `trig`, `frac`,
  `step`, and `orig`; bare `orig` uses `.default=false` and hides zero.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-base/tkz-obj-grids.tex`:
  grid source values map through `(value - origin) / step`, independently of
  axis label formatting.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-fct/tkz-fct.sty`:
  `tkz-fct` depends on `tkz-base`, so its Cartesian function frames use those
  axis rules rather than a separate coordinate system.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-base/TKZdoc-base-axes.tex`:
  provides the direct `\tkzAxeXY[label={},text=blue,trig=2]` driver.

## Artifacts And Reference

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg` and successfully
rendered the driver. The after artifacts are local and ignored by Git:

- MacTeX PNG: `outputs/qa-tkz-fct-combined-axes-trig-after-2026-08-08/mactex-png/tkz-fct-combined-axes-trig.png`
- TikZKit SVG/PNG: `outputs/qa-tkz-fct-combined-axes-trig-after-2026-08-08/tikzkit-svg/tkz-fct-combined-axes-trig.svg` and `tikzkit-png/tkz-fct-combined-axes-trig.png`
- tikztosvg SVG/PNG: `outputs/qa-tkz-fct-combined-axes-trig-after-2026-08-08/tikztosvg-svg/tkz-fct-combined-axes-trig.svg` and `tikztosvg-png/tkz-fct-combined-axes-trig.png`
- Four-panel visual sheet/diff: `outputs/qa-tkz-fct-combined-axes-trig-after-2026-08-08/diff/tkz-fct-combined-axes-trig-native-sheet.png` and `diff/tkz-fct-combined-axes-trig-sheet.png`

The tikztosvg SVG has a `166.51pt × 106.72pt` viewBox, `0.3985pt` axis
strokes, `0.79701pt` graduation strokes, filled arrow-tip paths, and outlined
Computer Modern glyph paths. Those are the structural cues used for this
implementation; TikZKit keeps renderer-native SVG text and marker defs.

## Visible Change

Before the change, TikZKit ignored the combined `trig=2` option. It drew
integer ticks and labels `-1..4` / `-1..2`, so the requested trigonometric
axis was visibly a different coordinate system. The preserved pre-fix SVG/PNG
is under `outputs/qa-tkz-fct-combined-axes-trig-before-2026-08-08/`.

After the change, TikZKit, tikztosvg, and MacTeX all show blue `0`, `\pi/2`,
and `\pi` labels at the corresponding tick positions on both axes. The
terminal label styles now also pass through the combined command, so shared
`xlabel style` and `ylabel style` affect terminal placement and color.

The remaining differences are raster/font-outline and crop differences:
TikZKit rasterizes to `214×140px`, while tikztosvg rasterizes to `223×143px`.
No axes, ticks, or labels are missing or positioned on an integer grid after
the fix; the pixel diff is only a diagnostic, not acceptance evidence.

## Commands And Parameters

Implemented and verified here:

- `\tkzInit`: `xmin`, `xmax`, `ymin`, `ymax`, `xstep`, `ystep`.
- `\tkzAxeXY`: `label`, `text`, `trig`, `frac`, `step`, `orig`, `swap`,
  `ticks=false`, `tickwd`, `tickup`, `tickdn`, `ticklt`, `tickrt`, `right space`,
  `left space`, `up space`, `down space`.
- Global TikZ `xlabel style` and `ylabel style` on both terminal and
  graduation labels.

Still partial: external gnuplot table/cache IDs, asymptotes, adaptive sampling,
general parametric discontinuities, and arbitrary advanced paint callbacks.

## Verification

Passed:

```text
node --test test/tkz-fct.test.js
npm run examples:render -- --fixtures test/fixtures/examples --only tkz-fct-combined-axes-trig --output outputs/qa-tkz-fct-combined-axes-trig-after-2026-08-08 --native-reference --strict-tikztosvg --quiet-progress
npm run examples:diff -- --output outputs/qa-tkz-fct-combined-axes-trig-after-2026-08-08
```

The broad `node --test` suite remains outside this focused acceptance because
the repository has unrelated pre-existing failures; this slice adds no
diagnostics in its own regression or visual driver.
