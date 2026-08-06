# pgfplotstable Decimal Separator Alignment QA (2026-08-06)

## Scope

This slice adds `dec sep align` only for the existing `\pgfplotstabletypeset`
path: a per-column fixed numeric style whose rendered value contains the active
decimal separator. It does not claim full `pgfplotstable` table formatting.

The real regression fixture is
`test/fixtures/examples/pgfplots/pgfplotstable-dec-sep-align.tex`, adapted
from the TeX Live `pgfplotstable` manual. It renders `1.20`, `12.34`, and
`123.40` in one column so a false natural-text layout is immediately visible.

## Local MacTeX Study

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/numtable/pgfplotstable.code.tex`,
  lines 219-254: `dec sep align` requires `array`, changes the table to an
  `r@{}l` pair, inserts the decimal separator as `&`, and writes the header as
  one spanning `\multicolumn` cell.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplotstable.pdf`,
  pages 9-15: documents the decimal-alignment family and distinguishes it from
  `sci sep align` and `dcolumn`.

TikZKit keeps a renderer-neutral equivalent rather than emitting the TeX
`r@{}l` syntax: `pgfplotstableDecimalAlignedCell` creates an internal decimal
cell marker, while `tabularCellTextLayout` measures the leading and trailing
parts and draws them against one shared column anchor. Headers stay ordinary
centered cells.

## Implemented Parameters

| Command or key | Status | Boundary |
| --- | --- | --- |
| `\pgfplotstabletypeset` | implemented subset | inline or registered tables only |
| `columns/<name>/.style` | implemented subset | selected column styles |
| `fixed`, `fixed zerofill`, `precision` | implemented subset | existing number-printer subset |
| `use comma` | implemented subset | selects the decimal marker used by this slice |
| `dec sep align` | implemented | fixed numeric cells containing the selected decimal separator |
| `sci sep align` | not implemented | scientific mantissa/exponent split is different from this slice |
| `dcolumn` | not implemented | external TeX table package behavior |
| separator-free values, arbitrary style interactions | partial | native `\multicolumn` handling has not been generalized |

## Three-Way Visual QA

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. The artifacts are in
`/private/tmp/tikzkit-qa-pgfplotstable-dec-sep-align-2026-08-06`:

- TikZKit SVG/PNG: `tikzkit-svg/pgfplotstable-dec-sep-align.svg` and
  `tikzkit-png/pgfplotstable-dec-sep-align.png`.
- tikztosvg SVG/PNG: `tikztosvg-svg/pgfplotstable-dec-sep-align.svg` and
  `tikztosvg-png/pgfplotstable-dec-sep-align.png`.
- MacTeX PNG and four-panel sheet:
  `mactex-png/pgfplotstable-dec-sep-align.png` and
  `diff/pgfplotstable-dec-sep-align-native-sheet.png`.

All three rendered without diagnostics. I inspected the JS, tikztosvg, MacTeX,
and registered-diff panels: the JS values `1.20`, `12.34`, and `123.40` share
one visible decimal column, matching the two reference renderers; `Sample` and
`Measured` remain single headers rather than split header fragments. Before
this change, each number was laid out as an independently centered text cell,
so their decimal separators shifted with the width of the integer part.

The registered JS/tikztosvg diff remains `16.09%` changed pixels with mean
RGBA difference `0.0376`; inspection attributes that residual to glyph
rasterization and small font spacing, not to decimal-anchor geometry.

## Regression

```bash
npm test -- test/pgfplotstable-typeset.test.js \
  test/tabular-picture-layout.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-pgfplotstable-dec-sep-align-2026-08-06 \
  --only pgfplotstable-dec-sep-align --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output \
  /private/tmp/tikzkit-qa-pgfplotstable-dec-sep-align-2026-08-06 \
  --register --alignment-radius 3
```

The focused regression verifies one identical SVG decimal anchor for all
leading and trailing cell fragments, plus right/left SVG text anchoring.
