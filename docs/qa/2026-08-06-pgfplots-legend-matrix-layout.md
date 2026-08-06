# PGFPlots Formula Legend Matrix Layout QA

## Scope

This slice calibrates only the shared PGFPlots legend matrix width for
formula-heavy labels and tiny inline `pmatrix` labels. It does not change
legend anchors, plot sampling, axis geometry, font selection, or individual
fixture coordinates.

The real drivers are:

- `latex-examples-activation-functions`: five normal-size formula legend rows.
- `latex-examples-faktorraum`: four tiny `pmatrix` legend rows.

## Local TeX Reading

Reviewed `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`:

- Lines 1095-1103 define `every axis legend` as a drawn white TikZ matrix with
  `inner xsep=3pt`, `inner ysep=2pt`, and nodes with `inner sep=2pt`.
- Lines 1983-1991 map `legend pos=north west` to the axis-relative anchor and
  `legend cell align=left` to `cells={anchor=west}`.
- Lines 2007-2027 define the line-legend image as the 0cm, 0.3cm, 0.6cm plot
  sample.
- Lines 5915 onward construct the final legend as a TikZ matrix of a small
  plot and its label, rather than a hand-drawn text list.

The layout therefore needs formula metrics plus a small matrix-cell residual;
adding the old generic 0.28cm text buffer duplicated space already covered by
the formula box estimator.

## References And Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. MacTeX native references used local
`pdflatex`.

Before:

`/private/tmp/tikzkit-qa-pgfplots-legend-layout-before-2026-08-06/`

After:

`/private/tmp/tikzkit-qa-pgfplots-legend-layout-after-2026-08-06/`

Each directory contains TikZKit SVG/PNG, `tikztosvg` SVG/PNG, MacTeX PNG,
1cm-grid variants, diff images, and an `index.html` sheet.

The third-party SVG uses glyph paths and `<use>` placements rather than SVG
`<text>` or `foreignObject`. Its legend frames measure:

- `activation-functions`: `129.503906pt` wide.
- `faktorraum`: `62.007812pt` wide.

## Visual Result

Before the change, TikZKit made the `activation-functions` formula frame
`135.378pt` wide, leaving a visibly oversized blank strip to the right of the
longest formula. The `faktorraum` tiny matrix legend measured `63.649pt`, also
leaving extra right-side space. MacTeX and `tikztosvg` agreed visually on both
frame widths.

After the shared change, TikZKit renders `129.517pt` and `61.999pt`
respectively. The sample lines, common west text edge, row pitch, curves, and
axis geometry are unchanged. Visual inspection of both four-way sheets shows
the right legend border now lands with the TeX references instead of beyond it.

Residuals remain: whole-image dimensions differ by up to a few pixels and
formula glyph rasterization/antialiasing is not identical to native TeX. This
is a real visual improvement, not full PGFPlots parity.

## Change And Verification

- `src/pgfplots/legend.js`: replaces the duplicated generic formula padding
  and oversized matrix residual with named TeX-calibrated legend constants.
- `test/pgfplots-seams.test.js`: pins both real frame widths to the measured
  `tikztosvg` values.

Passed:

```bash
node --test --test-name-pattern='tiny pmatrix legends use native matrix rows and box dimensions|legend lowering reserves native-like width for math-heavy entries|compact function legends use native short-math matrix dimensions|legend cell alignment maps left, center, and right to native cell anchors' test/pgfplots-seams.test.js
```

The full `node --test test/pgfplots-seams.test.js` run still has 30 unrelated
pre-existing failures, mainly legacy 3D surface geometry/order and tick-text
expectations. The targeted legend tests pass and both real fixtures reported
zero diagnostics.

## Remaining Work

Validate custom multi-column legend matrices, per-entry font overrides,
arbitrary display math, and browser/TeX formula glyph bounds separately. Do
not reuse this two-driver calibration as a claim of general legend parity.
