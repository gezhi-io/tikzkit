# Inline `pmatrix` Design-Metric QA

## Scope

This pass has one bounded shared goal: make inline `amsmath` `matrix` and
`pmatrix` formula boxes use the same Computer Modern design sizes that local
LaTeX selects at `\\tiny`, `\\scriptsize`, `\\footnotesize`, `\\small`, and
normal text. The downstream acceptance driver is the real PGFPlots legend in
`test/fixtures/examples/latex-examples/faktorraum.tex`.

This does **not** claim complete TeX math layout. It covers the matrix box,
its delimiters, standard `\\arraycolsep`, focused math advances needed by the
driver (`U`, `+`, `-`, digits, and relations), and PGFPlots' resulting legend
frame width.

## Local Source Reading

Reviewed from local TeX Live 2025:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/amsmath/amsmath.sty`, around
  lines 1068-1104: `\\env@matrix` is an `array` with compensating outer
  `-\\arraycolsep`; `pmatrix` provides its parentheses through surrounding
  `\\left`/`\\right` delimiters.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/tools/array.sty`, around
  lines 207-234: the array preamble and row struts determine column and row
  construction.
- Local Computer Modern TFM files in
  `/usr/local/texlive/2025/texmf-dist/fonts/tfm/public/cm/` (`cmr`, `cmmi`,
  `cmsy` at 5/7/8/9/10pt, plus the matching `cmex` delimiter files): these
  demonstrate that small standard LaTeX sizes select optical design fonts,
  rather than geometrically shrinking a 10pt matrix.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`,
  around lines 1095-1103 and 5924 onward: `every axis legend` constructs a
  TikZ matrix, with `inner xsep=3pt`, `inner ysep=2pt`, and per-cell nodes;
  `legend cell align=left` resolves to a west anchor.

The implementation shares `inlineMathMatrixLayoutCm()` between formula
measurement and the SVG-text fallback renderer. It retains a fixed 10pt
`\\arraycolsep` inter-column gap, selects design-size digit/relation/delimiter
metrics, and applies the small set of native math spacing rules needed by the
real legend labels. The PGFPlots legend calculates its matrix-label gap from
the formula box instead of adding a second matrix allowance.

## References And Artifacts

Local `tikztosvg` was found at `/Library/TeX/texbin/tikztosvg` and rasterized
with `/opt/homebrew/bin/rsvg-convert`. MacTeX native PNGs were rendered with
`pdflatex` and `pdftocairo`. The complete artifact directory is:

`/private/tmp/tikzkit-qa-inline-pmatrix-2026-08-07/`

- Minimal matrix calibration: `mactex.png`, `tikztosvg.svg/png`,
  `tikzkit.svg/png`, `diff.png`, and `sheet.png`.
- Real driver: `faktorraum/mactex-png/`, `faktorraum/tikztosvg-svg/`,
  `faktorraum/tikzkit-svg/`, `faktorraum/tikzkit-png/`,
  `faktorraum/diff-png/`, and
  `faktorraum/diff/latex-examples-faktorraum-native-sheet.png`.

The `tikztosvg` SVG uses TeX outline `<path>` glyphs and a flipped outer
transform with a `55.746pt x 24.309pt` matrix node viewBox. TikZKit keeps
selectable SVG `<text>` inside a semantic
`<g class="tikz-math-matrix-inline">`; it uses paths only for the scalable
parentheses. This explains the remaining glyph-outline raster difference, but
the matrix box, rows, and legend-frame geometry are now shared measurements.

`tikztosvg --pdflatex` generated the reference SVG successfully. Its installed
wrapper then returned exit code 1 while trying to remove its own temporary
directory (`rm` argument ordering); the generated SVG/PNG were present and
were used for the comparison.

## Visual Result

Before this pass, a small inline matrix was estimated using a blended 10pt
scale. The real `faktorraum` legend therefore measured `2.326cm` wide instead
of the local native `62.008pt` (`2.179cm`) frame: visibly too much white space
followed the four matrix labels.

After the shared metric change, the real three-way sheet shows the four red,
blue, purple, and lime legend samples with matching small parentheses, two-row
matrices, label starts, and frame width. The focused regression now constrains
the legend width to `2.176cm..2.183cm`, and it passes at the native row pitch
of `12.70pt`. The minimal node comparison likewise aligns the matrix border
and outer dimensions with MacTeX/tikztosvg; visual residuals are limited to
browser text outlines, subpixel baseline rendering, and global canvas crop.

The raw PNG difference still reports a difference for the full chart. It is a
diagnostic signal only: the viewed four-panel sheet contains no missing legend
row or displaced matrix geometry in this scope.

## Implemented And Remaining

Implemented in this pass:

- `\\tiny`, `\\scriptsize`, `\\footnotesize`, `\\small`, and 10pt inline
  `matrix`/`pmatrix` formula metrics;
- fixed `\\arraycolsep` and two-column matrix layout;
- selected Computer Modern optical-size digit, relation, delimiter, `U`,
  binary plus, and unary/binary minus measurements;
- identical geometry in `estimateFormulaBox()` and SVG-text matrix painting;
- PGFPlots `legend cell align=left` frames containing those formula boxes.

Still partial or unsupported:

- arbitrary TeX math atom classes, italic corrections, ligatures, math kerns,
  macros, fractions, accents, and general style switches;
- `\\arraystretch`, arbitrary array preambles, custom delimiters, and full
  `amsmath` display environments;
- exact TeX glyph outline rendering in browser SVG text and full PGFPlots
  matrix/legend internals beyond this label family.

## Verification

```sh
node --test --test-name-pattern='pmatrix|Computer Modern design sizes' \
  test/convert.test.js test/svg-renderer.test.js test/pgfplots-seams.test.js

node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-inline-pmatrix-2026-08-07/faktorraum \
  --only latex-examples-faktorraum \
  --native-reference --tikztosvg-engine pdflatex \
  --math-renderer svg-text --no-comparison-grid

node scripts/diff-example-pngs.js \
  --output /private/tmp/tikzkit-qa-inline-pmatrix-2026-08-07/faktorraum \
  --register
```

All three focused regression tests pass. The real driver generated all three
SVG/PNG references with no TikZKit diagnostics, and its native/tikztosvg/
TikZKit/diff sheet was viewed before acceptance.
