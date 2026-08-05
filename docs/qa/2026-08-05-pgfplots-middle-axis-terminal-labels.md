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

### Superseded calibration

This record originally applied a `2.5pt` label shift. Follow-up visual QA on
`learn-curve-ml` and `linear-functions` showed that the shift was too broad:
it inflated the canvas while the labels already had the correct semantic anchor.
The active implementation now follows the source literally: labels attach at
`current axis.right/above origin`; the arrow renderer alone contributes the
visible arrow-tip extension. The corrective evidence is recorded in
[`2026-08-05-pgfplots-middle-axis-anchor-bounds.md`](./2026-08-05-pgfplots-middle-axis-anchor-bounds.md).

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

## Historical Visual Result

The initial calibration corrected an under-extended label position in
`activation-functions`, but it was not a general rule. The later review found
that applying it to every `tick align=outside` middle axis incorrectly enlarged
other completed pictures. Do not use this document as evidence for an additive
label offset.

Residual differences remain visible in formula glyph metrics, legend text
rasterization, dashing, and dense function sampling. Those are separate
partial PGFPlots/text-rendering issues; this change is not a full visual-parity
claim.

## Regression and Acceptance

Focused regression for the corrected rule:

```sh
node --test test/pgfplots-middle-axis-labels.test.js
node --test test/latex-examples-new30-acceptance.test.js
```

The focused label suite passes, and the 30-case compatibility gate passes for
all 30 fixtures. PGFPlots remains partial outside the explicitly tested
middle-axis, range, tick-label, and plot-layout slices.
