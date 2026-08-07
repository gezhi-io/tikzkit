# tkz-fct Axis Tick Labels

## Scope

This focused visual slice covers the `tkz-fct` Cartesian-frame graduations
created by `\tkzAxeXY`, `\tkzLabelX`, and `\tkzLabelY`. It does not claim to
complete `tkz-fct` generally. The real drivers are
`latex-examples/discontinuity-jump.tex` and
`latex-examples/intersecting-lines-5.tex`.

## Local MacTeX Reading

Reviewed TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-fct/tkz-fct.sty`
- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-base/tkz-base.cfg`
- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-base/tkz-obj-grids.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-base/tkz-obj-axes.tex`
- `/usr/local/texlive/2025/texmf-dist/fonts/tfm/public/cm/cmr7.tfm`

`tkz-base.cfg` gives `xlabel style` and `ylabel style` a 3pt offset with 1pt
inner separation. `tkz-obj-axes.tex` makes the numerical graduations in
`tkzLabelX/Y` use `fill=\tkz@fillcolor` (white by default), while the terminal
`x` and `y` labels emitted by `tkzDrawX/Y` are not filled. The grid source uses
a 0.4pt main-grid line and source-coordinate mapping through `\tkzInit`.

## Third-Party SVG Reference

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. Final artifacts are under
`outputs/qa-tkz-fct-axes-final-2026-08-08/` and include TikZKit SVG/PNG,
tikztosvg SVG/PNG, MacTeX PNG, grids, and diff sheets.

The tikztosvg SVG uses a shared `matrix(1, 0, 0, -1, 12.938, 189.419)` drawing
transform. Its tick labels are glyph uses covered by white filled paths, rather
than HTML text. For the `0` label that white path is 5.960938pt by 6.488281pt.
That establishes both the native paint order and the CMR7 label-box target.

## Visual Result

Before this change, TikZKit treated filled tick labels as ordinary filled nodes:
their `discontinuity-jump` white boxes were about 6.26pt by 9.92pt. The extra
height covered too much of the grid and enlarged the image crop. TikZKit now
keeps the native white fill, but tags only these internal tkz-fct graduations
for CMR optical-size digit measurement. Their boxes are now 5.96pt by 6.49pt.

In the final four-panel inspection:

- `discontinuity-jump`: grid intersections remain visible up to the numerical
  labels; x/y terminal labels no longer gain a white patch; open and closed
  jump points retain their native locations. TikZKit-vs-tikztosvg changed ratio
  fell from 7.01% registered to 4.80%.
- `intersecting-lines-5`: the axes, one-unit grid, crossed endpoints, and red/
  blue segments remain aligned; changed ratio fell from 0.825% to 0.729%.
- The remaining visible difference is mostly glyph rasterization and the
  renderer's one-pixel crop choice, not missing graphics or shifted geometry.

## Implementation And Verification

- `src/extensions/tkz-fct.js`: preserve the native distinction between terminal
  labels and filled graduations, and mark generated graduations internally.
- `src/engine/evaluate.js`: use CMR design-size digit advances for simple
  integer `tkz-fct` graduations while retaining explicit TikZ padding.
- `test/tkz-fct.test.js`: locks the terminal-label behavior and compact white
  graduation boxes for the real discontinuity fixture.

Commands run:

```sh
node --test test/tkz-fct.test.js
npm run examples:render -- --output outputs/qa-tkz-fct-axes-final-2026-08-08 --only latex-examples-discontinuity-jump,latex-examples-intersecting-lines-5 --tikztosvg --native-reference --grid
npm run examples:diff -- --output outputs/qa-tkz-fct-axes-final-2026-08-08 --register --alignment-radius 3
```

All 26 focused tests passed. Both real cases rendered in TikZKit, tikztosvg,
and MacTeX with no diagnostics or external-render failures.

## Remaining Work

The CMR optical-size calibration intentionally covers simple integer labels.
Negative, fractional, trigonometric, and arbitrary custom `tkz-fct` label
content still uses the existing compact formula measurement and remains a
partial visual-match area.
