# PGFPlots Direct Plot-Reference Sample QA

## Scope

This pass implements one PGFPlots compatibility slice only: a direct
`\label{name}` immediately following a supported `\addplot`, `\addplot+`,
`\addplot3`, or `\addplot3+` can supply its matching inline `\ref{name}`
inside an SVG-text formula array. TikZKit renders the result as a legend-line
sample rather than an unresolved `??` string.

The driver is
`test/fixtures/examples/latex-examples/dirichlet-function.tex`. Its
piecewise-definition node uses `\tikz[baseline=-0.5ex]\node{\ref{...}};`
for blue and red plot samples, with `\phantom{1cm}` reserving the first-column
width.

## Local Source Reading

Reviewed local TeX Live 2025 source:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`,
  around lines 11342-11446: after `\addplot`, PGFPlots replaces `\label`
  with `\pgfplots@plot@label`, records the plot's current legend image, and
  exports it via the auxiliary file for a later `\ref`.
- The same file around lines 1990-2025 and 5828-5865: the default
  `/pgfplots/line legend` draws a 0.6cm line sample, while the legend style
  provides the active draw options.

The lowering mirrors that semantic relation without pretending to implement
the TeX auxiliary-file protocol. It binds labels while lowering the same axis,
uses the final resolved plot style, and keeps the original `\phantom` width
when matrix cells are measured.

## References And Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; its SVG was
rasterized by `/opt/homebrew/bin/rsvg-convert`. MacTeX provided the native PNG.
The generated artifact bundle is:

`/private/tmp/tikzkit-qa-pgfplots-plotref-after-2026-08-07/`

- `tikzkit-svg/`, `tikzkit-png/`, and `tikzkit-grid-png/`
- `tikztosvg-svg/`, `tikztosvg-png/`, and `tikztosvg-grid-png/`
- `mactex-png/`
- `diff/latex-examples-dirichlet-function-native-sheet.png`
- `diff-png/latex-examples-dirichlet-function-registered.png`

The `tikztosvg` output retains `??` for both inline references, so it is not
the oracle for this feature. Its SVG uses TeX glyph paths under a flipped
outer transform. MacTeX is the reference: it shows a blue and a red legend
line in the formula node. TikZKit's portable SVG uses two explicit
`<path class="tikz-pgfplots-plot-reference-sample">` elements, with the
resolved `stroke`, `stroke-width`, and `stroke-dasharray` attributes.

## Visual Result

Before this change, both inline references were flattened to `??` in the
TikZKit formula node; the visual relation between the two plots and their
piecewise cases was absent. `tikztosvg` has the same visible limitation.

After the change, TikZKit visibly paints a blue upper-row sample and a red
lower-row sample. Both are ultra-thick, matching the source plots, and the
first cell retains the 1cm `\phantom` reservation so the case values do not
slide left. The 1cm-grid native sheet confirms that the sample rows occupy the
same legend region as MacTeX rather than falling back to ordinary text.

The enclosing SVG-text formula frame remains slightly narrower and a few
pixels left of the MacTeX frame because browser SVG text metrics differ from
TeX glyph boxes. That broader formula-metric calibration is explicitly not
accepted by this slice.

## Implemented Boundary

Implemented:

- Direct plot labels after `\addplot`, `\addplot+`, `\addplot3`, and
  `\addplot3+` in the same lowered axis.
- Matching inline `\ref{name}` within SVG-text matrix/array fallback.
- Default 0.6cm line-legend length.
- Resolved color, line width, dash pattern, line cap, and line join.
- `\phantom{...}` first-cell width preservation for the formula layout.

Still partial or unsupported:

- `\label[scatter-class]{...}`, custom `legend image code`,
  `every legend image post`, and marker-only samples.
- Beamer label prefixes, TeX `.aux` files across independent runs, and
  arbitrary non-PGFPlots `\ref` expansion.
- Exact TeX font/glue/bounding-box decisions for the enclosing formula node.

## Verification

```sh
node --test --test-name-pattern 'PGFPlots direct plot labels|real Dirichlet' \
  test/pgfplots-seams.test.js test/renderer.test.js

npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-pgfplots-plotref-after-2026-08-07 \
  --only latex-examples-dirichlet-function \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --continue-on-external-failure --external-timeout-ms 120000
npm run examples:diff -- --output /private/tmp/tikzkit-qa-pgfplots-plotref-after-2026-08-07 \
  --register --alignment-radius 3
```

The focused test command passes two tests. The visual command completed with
one each of TikZKit SVG/PNG, tikztosvg SVG/PNG, and MacTeX PNG, with zero
external failures and no TikZKit diagnostics in the driver.
