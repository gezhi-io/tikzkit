# PGFPlots `ybar` Nodes-Near-Coords Templates

## Scope

This is one PGFPlots label-template slice, not a rewrite of the histogram
handler: lower a `nodes near coords` template containing `\rotatebox`, a local
TeX size switch, and `\pgfmathprintnumber\pgfplotspointmeta` into a real TikZ
node with rotation, font, and formatted numeric content.

The driver is `test/fixtures/examples/latex-examples/histogram.tex`. It is a
categorical `ybar` plot with 43 symbolic x coordinates and four plot series.
Before this change TikZKit rendered the literal macro names over every bar.

## Local MacTeX Study

Read the TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`
  at the `nodes near coords defaults` definitions (lines 3167-3221). The
  default content is `\pgfmathprintnumber\pgfplotspointmeta`; PGFPlots creates
  a post-marker `\node` and applies `every node near coord` styles.
- The same file at the `ybar` style (lines 3390-3453). `ybar` selects the
  y-direction bar handler, sets the point meta when absent, installs the bar
  shift, and keeps node-near-coordinate placement in node semantics.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsplothandlers.code.tex`
  at lines 422-498. A physical `bar width` is resolved through the active x
  coordinate direction; it is not a literal data-unit width.

The key implementation point is that `\rotatebox{90}{...}` and `\scriptsize`
are local TeX box operations, whereas the existing JS lowering already owns the
equivalent node `rotate` and `font` options. `\pgfmathprintnumber` is an output
formatter, so its default result is the numeric point meta, not text that
contains the control sequence.

## Implemented Source Syntax

The reviewed source's commands and parameters are handled as follows:

- `\begin{axis}` / `\end{axis}`, `/tikz/ybar`, `ybar legend`, `ymin`,
  `bar width=0.2cm`, `axis x line*=left`, `enlarge x limits=false`, `grid`,
  `height`, `width=\textwidth`, `title`, `xlabel`, `ylabel`, symbolic x
  coordinates, `xtick`, minor x ticks, extra ticks, and the extra tick's
  `yshift` are existing PGFPlots lowering paths.
- `\addplot[<color>,fill=<color>] coordinates {...}` and `\legend{...}` are
  existing categorical-bar and legend paths.
- `nodes near coords=\rotatebox{90}{\scriptsize\pgfmathprintnumber\pgfplotspointmeta}`
  now creates a node with `rotate=90`, `font=\scriptsize`, and the per-bar
  numeric label. The label still inherits the associated plot color, like the
  native output.

Still partial: arbitrary nested TeX templates, arbitrary number-format
configuration, nonnumeric point-meta transformations, and exact TeX text-box
metrics/crop bounds. This change intentionally does not change histogram bin
surveying, stacked-bar node alignment, or general axis layout.

## Independent SVG And Visual Review

`tikztosvg` was available at `/Library/TeX/texbin/tikztosvg`; `rsvg-convert`
was available at `/opt/homebrew/bin/rsvg-convert`; MacTeX native rendering used
`/Library/TeX/texbin/pdflatex`.

The artifact roots are ignored output directories:

- before: `outputs/qa-pgfplots-ybar-nodes-before/`
- after: `outputs/qa-pgfplots-ybar-nodes-after/`

Each contains MacTeX PNG, TikZKit JS SVG/PNG, tikztosvg SVG/PNG, grid variants,
and a diff/sheet. The four-panel review is
`outputs/qa-pgfplots-ybar-nodes-after/diff/latex-examples-histogram-native-sheet.png`.

The tikztosvg SVG uses outline glyphs, while TikZKit uses `<text>` grouped in a
`rotate(-90 ...)` transform. After the fix the transform is present and the
literal `rotatebox`, `pgfmathprintnumber`, and `pgfplotspointmeta` tokens are
absent from TikZKit's SVG.

Visual observations:

- Before: the JS panel printed the whole template string in green/red/yellow/
  blue across the plot, obscuring the bars and expanding its canvas to
  `588 x 274` pixels. Native MacTeX and tikztosvg instead showed narrow,
  vertical numeric labels near the bar tops.
- After: JS shows the same colored, vertical numbers and preserves bar/grid/
  legend geometry. Its canvas is `454 x 274` pixels, compared with tikztosvg
  at `473 x 277`; the remaining width and glyph-outline difference is visible
  but no longer a missing-element failure.
- The two control cases, `histogram-simple` and `histogram-large-1d-dataset`,
  retain their existing bar geometry and show no label-template regression.

The image diff is supporting evidence rather than the acceptance criterion:
for the target case its changed-pixel ratio fell from `29.44%` to `19.21%` and
mean absolute RGBA from `0.06311` to `0.03303` because the visible missing
elements are now present.

## Verification

```bash
node --test test/pgfplots-histogram.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-pgfplots-ybar-nodes-after \
  --only latex-examples-histogram,latex-examples-histogram-simple,latex-examples-histogram-large-1d-dataset \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --external-timeout-ms 120000
node scripts/diff-example-pngs.js --output outputs/qa-pgfplots-ybar-nodes-after
npm run extension-registry
```

The focused test passes. A broad PGFPlots seam test file has unrelated existing
numeric snapshot failures in the current worktree; this slice adds no
diagnostics to the three rendered drivers.

## Next Slice

Continue PGFPlots from a visually measured driver: exact automatic number
formatting for node templates, then stacked-bar alignment and remaining
axis-text/crop calibration. Do not fold those into this template-lowering
change without separate visual evidence.
