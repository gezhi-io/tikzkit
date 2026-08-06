# pgfplotstable Basic Typeset QA (2026-08-06)

## Scope

This slice implements visible output for `\pgfplotstabletypeset` rather than
leaving the command as a no-op. It is deliberately limited to inline data or a
table registered by `\pgfplotstableread`, normal headers, `columns={...}`,
`columns/<name>/.style={column name=...}`, and the `space`, `comma`, `tab`, and
`&` column separators. The real gallery fixture is
`test/fixtures/examples/pgfplots/pgfplotstable-inline-typeset.tex`.

## Local MacTeX Study

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgfplots/pgfplotstable.sty`
  lines 29-37: the package loads PGFPlots, its table implementation, and
  `array`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/numtable/pgfplotstable.code.tex`
  lines 361-362, 1086-1105, and 1307-1348: the default output starts/ends a
  LaTeX `tabular`; `col sep` has named separator choices; typeset uses the
  complete table unless a column list is selected.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplotstable.pdf`
  pages 6-15: headers, column selection, and cell number formatting are
  independent layers.

The JavaScript implementation therefore lowers only the stable table-layout
semantics into the existing generic `tabular` Scene Graph layout. Its
non-painted table bounding box retains TeX's calculated `tabcolsep` and row
struts during SVG cropping. It does not pretend to reproduce PGF number
printing or decimal-alignment macros.

## Command And Option Audit

| Source surface | Status in this slice |
| --- | --- |
| `\pgfplotstableread[col sep=comma]{...}\macro` | implemented for data registered in the existing table map |
| `\pgfplotstabletypeset{...}` | implemented for inline data |
| `\pgfplotstabletypeset[...]\macro` | implemented for a registered table |
| `col sep=space|comma|tab|&` | implemented |
| `columns={year,vehicles}` | implemented by header-name selection |
| `columns/year/.style={column name=Year}` | implemented |
| default plain-integer thousands grouping (`2021` to `2,021`) | implemented |
| `dec sep align`, column types, number formats | not implemented |
| external file input, postprocessing, row-dependent styles | not implemented |

## Visual Procedure

Artifacts are generated under
`/private/tmp/tikzkit-qa-pgfplotstable-typeset-2026-08-06`:

```bash
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-pgfplotstable-typeset-2026-08-06 \
  --only pgfplotstable-inline-typeset \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --continue-on-external-failure --external-timeout-ms 30000
npm run examples:diff -- --output /private/tmp/tikzkit-qa-pgfplotstable-typeset-2026-08-06 \
  --register --alignment-radius 3
```

`tikztosvg` was available at `/Library/TeX/texbin/tikztosvg`; PNG conversion
used `/opt/homebrew/bin/rsvg-convert`. All three renderers completed without a
diagnostic or external failure. The inspected artifacts are:

- JS SVG/PNG: `tikzkit-svg/pgfplotstable-inline-typeset.svg` and
  `tikzkit-png/pgfplotstable-inline-typeset.png`.
- tikztosvg SVG/PNG: `tikztosvg-svg/pgfplotstable-inline-typeset.svg` and
  `tikztosvg-png/pgfplotstable-inline-typeset.png`.
- Native reference and four-way sheet:
  `mactex-png/pgfplotstable-inline-typeset.png` and
  `diff/pgfplotstable-inline-typeset-native-sheet.png`.

Before this slice, `\pgfplotstabletypeset` emitted no JS table and the
tikztosvg normalizer did not load `pgfplotstable`. After it, each panel shows
the complete `Year`/`Vehicles` header, three selected rows, and `2,021` /
`1,402` number grouping. The old JS table also used extra arbitrary row
padding and cropped to painted glyph bounds. The fixed JS layout preserves the
tabular box at `82.36pt x 47.82pt`; tikztosvg is `81.52pt x 47.82pt`.

The remaining visible difference is a sub-point JS column-width excess plus
font rasterization/crop treatment: registered JS-vs-tikztosvg difference is
about 19.66% changed pixels with mean absolute RGBA 0.0335. This number is
only supporting evidence; the visual panels show that no headers, rows, or
digits are missing or shifted. Native MacTeX retains its standalone document
border, so it is intentionally larger at `115px x 70px` than the tight SVG
references. This accepts the basic table slice, not complete `pgfplotstable`
parity.

## Regression

```bash
npm test -- test/pgfplotstable-typeset.test.js \
  test/example-render-script.test.js test/tabular-picture-layout.test.js \
  test/walmes-compat.test.js
```

The focused tests assert the lowered table layout, selected-column text,
diagnostic-free conversion, the TeX-sized table crop, and the absence of a
residual `pgfplotstabletypeset` command in SVG.
