# PGFPlots Middle-Axis Terminal Labels

## Scope

This focused slice covers the default `xlabel` and `ylabel` positions for
legacy `axis x line=middle`, `axis y line=middle` plots with
`tick align=outside`. The visual driver is
`latex-examples-activation-functions`.

It does not implement modern `ticklabel* cs` positioning, arbitrary label
styles, or the broader axis-description layout system.

## Local MacTeX Reading

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`
  - the legacy `compat/axis line style pre 1.8` branch attaches middle-axis
    labels to `current axis.right/above of origin` with terminal anchors;
  - newer compatibility branches use `ticklabel* cs` / near-ticklabel
    placement, which remains outside this slice.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`
  - `stealth` declares a right extension of
    `5 * (0.28pt + 0.3 * linewidth)`; this is `2pt` for the driver's `0.4pt`
    axis line.

The final JS label shift is `2.5pt`, rather than a direct copy of the arrow
extension: it calibrates the finished SVG node anchor after the arrow and text
box are combined in TikZKit's lowered coordinate layer.

## Reference Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; its SVG was rasterized
locally with `/opt/homebrew/bin/rsvg-convert`.

- Native MacTeX PNG:
  `outputs/qa-pgfplots-activation-labels/mactex-png/latex-examples-activation-functions.png`
- TikZKit SVG and PNG:
  `outputs/qa-pgfplots-activation-labels/tikzkit-svg/latex-examples-activation-functions.svg`
  and `outputs/qa-pgfplots-activation-labels/tikzkit-png/latex-examples-activation-functions.png`
- tikztosvg SVG and PNG:
  `outputs/qa-pgfplots-activation-labels/tikztosvg-svg/latex-examples-activation-functions.svg`
  and `outputs/qa-pgfplots-activation-labels/tikztosvg-png/latex-examples-activation-functions.png`
- Visual comparison sheet:
  `outputs/qa-pgfplots-activation-labels/diff/latex-examples-activation-functions-sheet.png`

## Visual Result

Before this change, the TikZKit `x` and `y` labels stopped visibly inside their
middle-axis arrow tips. After applying the outside-tick terminal calibration,
both labels land at the same terminal position as the tikztosvg and native
references. The JS and tikztosvg panels retain the same `576 x 261` canvas and
grid alignment.

Residual differences remain visible in formula glyph metrics, legend text
rasterization, dashing, and dense function sampling. Those are separate
partial PGFPlots/text-rendering issues; this change is not a full visual-parity
claim.

## Regression and Acceptance

Focused regression:

```sh
node --test --test-name-pattern='activation-functions' test/pgfplots-seams.test.js
```

All four activation-functions tests pass, including zero diagnostics, label
attachment, legend alignment, and public font size. The broad PGFPlots seam
suite remains partial: 163 of 205 tests pass, with 42 existing or unrelated
failures covering broader middle-axis, tick-label, and plot-layout behavior.
