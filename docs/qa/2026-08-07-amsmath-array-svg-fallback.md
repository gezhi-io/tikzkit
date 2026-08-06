# `amsmath` Array SVG Fallback QA

## Scope

This pass implements one portable-math slice only: a real
`\begin{array}{...}` inside a TikZ node must become structured SVG rows and
columns when `mathRenderer: "svg-text"` is selected. The accepted subset is
`l`/`c`/`r` columns, empty `@{}` joins, basic `*{n}{...}` repetitions, and
outer `\left...\right` delimiters. It also maps the basic cell operator
`\setminus` to `∖`.

The acceptance driver is
`test/fixtures/examples/latex-examples/dirichlet-function.tex`. The same
output run includes `jordan-normal-form-block` and `kalman-filter` as matrix
and display-math regressions; neither is used to claim full `amsmath` parity.

## Local Source Reading

Reviewed locally from TeX Live 2025:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/amsmath/amsmath.sty`, around
  lines 1068-1104: `\env@matrix` creates an `array` with the repeated `c`
  preamble and compensates the outer `\arraycolsep`; matrix delimiters are
  supplied by their surrounding `\left`/`\right` environments.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/tools/array.sty`, around lines
  207-234 and 385-430: `\@array` builds the column preamble and applies row
  struts using `\arraystretch`.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx`: the default
  array spacing uses `\arraycolsep` and `\arraystretch=1`.

The implementation therefore parses the preamble before splitting cells,
records zero-width `@{}` joins rather than treating them as text, and shares
the exact same parsed layout between SVG painting and SVG-text measurement.

## References And Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; its SVG was
rasterized by `/opt/homebrew/bin/rsvg-convert`. MacTeX provided native PNGs.
All three outputs plus grids and comparison sheets are in:

`/private/tmp/tikzkit-qa-amsmath-array-final-2026-08-07/`

- `tikzkit-svg/`, `tikzkit-png/`, and `tikzkit-grid-png/`
- `tikztosvg-svg/`, `tikztosvg-png/`, and `tikztosvg-grid-png/`
- `mactex-png/`
- `diff/latex-examples-dirichlet-function-native-sheet.png`

The tikztosvg SVG uses TeX glyph `<path>` elements under a flipped outer
transform rather than browser `<text>` or `foreignObject`; its Dirichlet
array has one scalable left brace and two independent row baselines. TikZKit
uses a semantic `<g class="tikz-math-matrix-inline">`, a scalable SVG brace
path, and explicit per-cell `<text>` anchors. This is intentional: the
portable renderer needs selectable pure SVG text while preserving the same
array geometry.

## Visual Result

Before the change, TikZKit flattened the Dirichlet definition into one text
run. Its node measured that flattened string, so the legend frame was overly
wide and the two logical cases had no independent baselines or columns.

After the change, the TikZKit panel visibly has a spanning left brace, two
rows, and three left-aligned columns. The `@{}` preamble no longer inserts
artificial gaps, and the legend frame now follows the structured formula
metric. Its center and vertical placement agree with the MacTeX and
tikztosvg panels on the 1 cm grid. The diff panel now isolates the formula
content instead of an entire flattened legend.

Remaining visible difference in this real driver is explicit and outside the
accepted array slice: native MacTeX resolves `\ref{plot one}` and
`\ref{plot two}` into blue/red legend samples, while the fixture wrappers seen
by TikZKit and tikztosvg retain `??`. TikZKit does not yet implement
cross-reference expansion into PGFPlots legend samples. Font outline and
micro-spacing differences also remain; the pixel ratio is only a triage
signal, not acceptance evidence.

## Commands And Boundary

Implemented in this slice:

- `\begin{array}{...}` / `\end{array}`
- cells separated by `&` and rows separated by `\\`
- `l`, `c`, `r`, empty `@{}`, and basic `*{n}{...}` preamble forms
- `\left\lbrace ... \right.` and the existing matrix delimiter family
- `\setminus` in SVG-text math cells

Still partial or unsupported:

- nonempty `@{...}`, `>{...}` / `<{...}` cell transforms, vertical rules,
  arbitrary `p`/`m`/`b` paragraph widths, `\arraystretch`, and arbitrary
  TeX preamble tokens;
- `\ref` expansion, particularly PGFPlots legend-sample references;
- full `amsmath` environments and TeX glue/box decisions (`tags`, `intertext`,
  `split`, `gathered`, `multline`, and general macro expansion).

## Verification

```sh
node --test --test-name-pattern 'array|pmatrix' test/renderer.test.js
node --test --test-name-pattern 'matrix fallback' test/architecture-seams.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-amsmath-array-final-2026-08-07 \
  --only latex-examples-dirichlet-function \
  --only latex-examples-jordan-normal-form-block \
  --only latex-examples-kalman-filter \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --continue-on-external-failure --external-timeout-ms 120000
npm run examples:diff -- --output /private/tmp/tikzkit-qa-amsmath-array-final-2026-08-07 \
  --register --alignment-radius 3
node scripts/gallery-audit.js --only latex-examples-dirichlet-function --strict
```

The focused tests pass. The artifact command completed with 3/3 TikZKit SVG,
TikZKit PNG, tikztosvg SVG/PNG, and MacTeX PNG outputs and zero external
failures. The real driver has no TikZKit diagnostics.
