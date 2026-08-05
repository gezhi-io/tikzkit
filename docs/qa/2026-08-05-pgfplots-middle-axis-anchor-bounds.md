# PGFPlots Middle-Axis Anchor Bounds

## Scope

This corrective slice covers only default `xlabel` and `ylabel` placement for
legacy `axis x line=middle` / `axis y line=middle`, including the combination
with `tick align=outside`. It does not claim support for modern
`ticklabel* cs`, arbitrary axis-description styles, or general PGFPlots bbox
layout.

The real drivers are `latex-examples-learn-curve-ml` and
`latex-examples-linear-functions`, both from the frozen 30-case acceptance
batch.

## Local MacTeX Reading

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`
  - legacy `axis y line=middle` handling attaches `every axis y label` at
    `current axis.above origin` with `anchor=north west`;
  - the matching x-axis branch attaches at `current axis.right of origin` with
    `anchor=south east`;
  - default near-tick label styles are distinct from these legacy terminal
    anchors.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`
  - arrow tips have their own geometry extension; that extension belongs to
    the path renderer, not to the label anchor calculation.

Implementation consequence: `renderAxisLabels` maps each terminal label to
the exact completed-axis endpoint. It does not add an outside-tick `2.5pt`
translation. The arrow renderer continues to draw the visible tip beyond the
line endpoint where appropriate.

## tikztosvg And Artifacts

`tikztosvg` was found locally at `/Library/TeX/texbin/tikztosvg`; PNG output
was produced with `/opt/homebrew/bin/rsvg-convert`.

The following directory contains all four artifact families for both cases:

- MacTeX native PNG: `outputs/qa-pgfplots-middle-label-bounds/mactex-png/`
- TikZKit SVG/PNG: `outputs/qa-pgfplots-middle-label-bounds/tikzkit-svg/` and
  `outputs/qa-pgfplots-middle-label-bounds/tikzkit-png/`
- tikztosvg SVG/PNG: `outputs/qa-pgfplots-middle-label-bounds/tikztosvg-svg/`
  and `outputs/qa-pgfplots-middle-label-bounds/tikztosvg-png/`
- Four-panel sheets and diffs:
  `outputs/qa-pgfplots-middle-label-bounds/diff/`

Example sheets:

- `outputs/qa-pgfplots-middle-label-bounds/diff/latex-examples-learn-curve-ml-native-sheet.png`
- `outputs/qa-pgfplots-middle-label-bounds/diff/latex-examples-linear-functions-native-sheet.png`

The local tikztosvg SVG uses transformed outline paths for TeX text and
marker-like arrow paths. TikZKit emits native SVG paths plus text/foreignObject
math where required. Their structure differs, but the viewBox/canvas bounds and
the axis terminal geometry agree after this correction.

## Visual Review

Before the correction, a shared `2.5pt` additive label extent made the actual
completed picture too large:

| Case | Before JS canvas | Native canvas | After JS canvas |
| --- | ---: | ---: | ---: |
| `learn-curve-ml` | 201.94pt high | 199.64pt high | 199.84pt high |
| `linear-functions` | 184.62pt x 184.62pt | 182.33pt x 182.34pt | 182.52pt x 182.52pt |

The reviewed four-panel sheets show the repaired `Training samples` / `Error`
labels, grid, curves, legend, and axis tips sharing the native/tikztosvg
coordinate frame. `linear-functions` likewise keeps its three lines, terminal
labels, lower-right legend, and arrowed axes in the native frame. Residual
pixels are TeX outline versus browser glyph rasterization and subpixel stroke
antialiasing; no required plot element or terminal label is missing or shifted.

The diff metrics are supporting evidence only: `learn-curve-ml` changed-ratio
is `0.07055` and `linear-functions` is `0.07427`, both on equal-sized raster
canvases.

## Command And Option Inventory

Implemented in this slice:

- `\begin{axis}` / `\end{axis}`
- `axis x line=middle`, `axis y line=middle`, and `tick align=outside`
- default `xlabel` / `ylabel` terminal anchors
- common `grid=major`, `legend pos`, function `\addplot`, sampled domains,
  colors, dash styles, and arrowed axis lines exercised by the two drivers

Still partial and deliberately outside the slice:

- modern `ticklabel* cs` and arbitrary `axis description cs` label grammar
- all general `xlabel style` / `ylabel style` geometry interactions
- full PGFPlots bounding-box and compatibility-version behavior
- final browser-vs-TeX font outline matching

## Regression And Acceptance

```bash
node --test test/pgfplots-middle-axis-labels.test.js
node --test test/latex-examples-new30-acceptance.test.js
```

Both commands pass: the focused suite has four passing tests, and the frozen
acceptance gate has 30 passing cases with no diagnostics. This is a visible
shared-behavior repair, not a per-fixture coordinate override.
