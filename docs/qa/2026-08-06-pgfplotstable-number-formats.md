# pgfplotstable Number Formats QA (2026-08-06)

## Scope

This slice extends the accepted basic `\pgfplotstabletypeset` table path with
the visible per-column number-printer subset: `int detect`, `fixed`, `fixed
zerofill`, `sci`, `sci zerofill`, `precision`, `sci precision`, and `use
comma`. It is intentionally not a claim of full PGF number formatting,
decimal-separator alignment, or arbitrary ordering interactions between
number-printer keys.

The real fixture is
`test/fixtures/examples/pgfplots/pgfplotstable-number-formats.tex`, adapted
from the TeX Live pgfplotstable manual. It includes integer grouping, fixed
rounding and zero filling, plus values requiring scientific notation.

## Local MacTeX Study

Reviewed locally:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/math/pgfmathfloat.code.tex`
  lines 56, 976-1037, and 1583-1630. The PGF printer defaults to precision 2;
  `fixed` and `sci` select separate printers; their zero-fill flags preserve
  trailing decimal digits; and `use comma` swaps decimal and thousands
  separators.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/numtable/pgfplotstable.code.tex`
  lines 381-388 and 600-605. Table cells delegate to `\pgfmathprintnumber`,
  and table column styles search the `/pgf/number format` family.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplotstable.pdf`
  pages 5-15, including the documented `sci`, `sci zerofill`, `precision`,
  `int detect`, and `dec sep align` examples.

The JS lowering merges a supported `columns/<name>/.style` into that selected
column only. Scientific output becomes a math cell such as
`$1.56\cdot 10^{-2}$`; its layout uses the existing formula-box measurement
instead of counting TeX control-word characters as visible width.

## Command And Option Audit

| Surface | Status |
| --- | --- |
| `columns/<name>/.style={fixed,precision=3}` | implemented |
| `fixed zerofill` | implemented |
| `sci`, `sci zerofill`, `sci precision` | implemented |
| `sci subscript` | implemented separately in `2026-08-06-pgfplotstable-sci-subscript.md` |
| `sci superscript` | implemented separately in `2026-08-06-pgfplotstable-sci-superscript.md` |
| `int detect` for integer table cells | implemented |
| `use comma` for supported fixed/default output | implemented |
| `std`, `relative`, `frac`, custom thousands strings | not implemented |
| `dec sep align` for supported fixed decimal cells | implemented separately in `2026-08-06-pgfplotstable-dec-sep-align.md` |
| `sci sep align` for supported standard scientific cells | implemented separately in `2026-08-06-pgfplotstable-sci-sep-align.md` |
| `dcolumn` | not implemented |
| arbitrary printer key ordering and post-processing | not implemented |

## Visual Acceptance

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. Artifacts are under
`/private/tmp/tikzkit-qa-pgfplotstable-number-formats-2026-08-06`:

- TikZKit SVG/PNG: `tikzkit-svg/pgfplotstable-number-formats.svg` and
  `tikzkit-png/pgfplotstable-number-formats.png`.
- tikztosvg SVG/PNG: `tikztosvg-svg/pgfplotstable-number-formats.svg` and
  `tikztosvg-png/pgfplotstable-number-formats.png`.
- MacTeX PNG and inspected four-way sheet:
  `mactex-png/pgfplotstable-number-formats.png` and
  `diff/pgfplotstable-number-formats-native-sheet.png`.

Before this change, the basic table lowering preserved raw `0.25`, `0.0625`,
and `9.53674316e-7` cells, so manual number-printer options had no visual
effect. After it, all three panels visibly show `0.250`, `0.063`, `0.001`,
`2.50\cdot 10^{-1}`, `1.56\cdot 10^{-2}`, and
`9.54\cdot 10^{-7}`. The scientific `\cdot` and superscript are present,
and the table's formula column retains its measured width rather than
over-expanding from raw TeX syntax.

TikZKit and tikztosvg both rasterize to `196px x 64px`; their tight SVG boxes
are `146.97pt x 47.82pt` and `146.33pt x 47.82pt`, respectively. Registered
pixel comparison reports 19.68% changed pixels and mean absolute RGBA 0.0386,
which is chiefly font rasterization and a one-pixel baseline offset. This is
supporting evidence only: the inspected panels are the acceptance source for
the fact that no table cells, scientific exponents, or column widths are
missing.

## Regression

```bash
npm test -- test/pgfplotstable-typeset.test.js \
  test/tabular-picture-layout.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-pgfplotstable-number-formats-2026-08-06 \
  --only pgfplotstable-number-formats --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output \
  /private/tmp/tikzkit-qa-pgfplotstable-number-formats-2026-08-06 \
  --register --alignment-radius 3
```
