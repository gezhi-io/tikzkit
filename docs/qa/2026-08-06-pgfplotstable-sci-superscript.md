# pgfplotstable Scientific Superscript QA (2026-08-06)

## Scope

This slice implements `sci superscript` for the visible
`\pgfplotstabletypeset` number-printer subset. It covers `sci`,
`sci zerofill`, and `sci precision` with negative, positive, and zero
exponents. The boundary also includes the native `sci sep align` interaction:
the superscript representation remains one complete math cell rather than
pretending it has the standard `\cdot 10^n` split.

The real fixture is
`test/fixtures/examples/pgfplots/pgfplotstable-sci-superscript.tex`, adapted
from the TeX Live number-format display styles. It places `0.001`, `0.098`,
`123.4`, `1`, and `0` in a direct superscript column and in a column which
also declares `sci sep align`.

## Local MacTeX Study

Reviewed locally:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/math/pgfmathfloat.code.tex`,
  lines 872-901: `\pgfmathfloatrounddisplaystyle@std` emits the configurable
  scientific marker followed by `10^{n}`, whereas
  `\pgfmathfloatrounddisplaystyle@superscript` calls the shared formatter
  with an empty marker, `1`, and `^{n}`. The exponent argument is passed even
  when it is zero.
- The same file, lines 1048-1059, registers `sci superscript` independently
  from `sci 10^e`, `sci subscript`, and `sci generic`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/numtable/pgfplotstable.code.tex`,
  lines 298-326: `sci sep align` modifies the standard scientific exponent
  marker to `$&$` and creates a two-column `r@{}l` layout. Direct superscript
  output never emits that marker, so native TeX leaves the formula whole and
  its second layout cell empty.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplotstable.pdf`,
  pages 13-15: confirms that scientific display and separator alignment are
  number-printer/table-layout concerns rather than plain source-text spacing.

TikZKit therefore chooses a presentation before it asks for an aligned
scientific layout. Only the standard `\cdot 10^n` presentation produces the
internal two-fragment alignment marker; direct subscripts and superscripts
stay renderer-neutral whole math cells.

## Implemented Parameters

| Command or key | Status | Boundary |
| --- | --- | --- |
| `\pgfplotstabletypeset` | implemented subset | inline or registered tables only |
| `columns/<name>/.style` | implemented subset | selected column styles |
| `sci`, `sci zerofill`, `sci precision` | implemented subset | shared number-printer subset |
| `sci superscript` | implemented | renders `$mantissa^{exponent}$` |
| zero and exponent zero | implemented | `1.00^{0}` and `0.00^{0}` keep the native exponent |
| `sci superscript,sci sep align` | implemented | valid source; intentionally one complete cell |
| `sci subscript` | implemented separately | direct `mantissa_{exponent}` form |
| `sci generic`, custom exponent marks | not implemented | separate PGF display strategies |
| `dcolumn`, non-finite values, arbitrary post-processing | partial | outside the focused table subset |

## Three-Way Visual QA

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. Artifacts are in
`/private/tmp/tikzkit-qa-pgfplotstable-sci-superscript-2026-08-06`:

- TikZKit SVG/PNG: `tikzkit-svg/pgfplotstable-sci-superscript.svg` and
  `tikzkit-png/pgfplotstable-sci-superscript.png`.
- tikztosvg SVG/PNG: `tikztosvg-svg/pgfplotstable-sci-superscript.svg` and
  `tikztosvg-png/pgfplotstable-sci-superscript.png`.
- MacTeX PNG and inspected four-panel sheet:
  `mactex-png/pgfplotstable-sci-superscript.png` and
  `diff/pgfplotstable-sci-superscript-native-sheet.png`.

I inspected the TikZKit, tikztosvg, MacTeX, grid, and registered-diff panels.
Before the change, these cells used the standard `\cdot 10^n` form and the
column carrying `sci sep align` acquired a false shared scientific tail. After
the change, both columns visibly contain `1.00^{-3}`, `9.80^{-2}`,
`1.23^{2}`, `1.00^{0}`, and `0.00^{0}` as complete formulas. No header, row,
or exponent disappeared, and the aligned column no longer invents a split
that native TeX does not make.

The TikZKit PNG is `260 x 101px` with root `194.52pt x 75.72pt`; the pdflatex
MacTeX PNG is `261 x 101px`. tikztosvg renders through XeLaTeX as glyph paths
and `<use>` references rather than SVG `<text>`; its `191.1pt x 71.73pt` root
rasterizes to `255 x 96px`. Those font and preview-box choices explain the
small canvas difference. The three panels agree visually on table geometry,
math script placement, and unsplit-cell behavior; registered pixel statistics
are retained only as supporting evidence.

## Regression

```bash
npm test -- test/pgfplotstable-typeset.test.js \
  test/example-render-script.test.js \
  test/tabular-picture-layout.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-pgfplotstable-sci-superscript-2026-08-06 \
  --only pgfplotstable-sci-superscript --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output \
  /private/tmp/tikzkit-qa-pgfplotstable-sci-superscript-2026-08-06 \
  --register --alignment-radius 3
```

The focused test asserts the exact direct superscript formulas, including both
zero cases, and asserts that no `tabular-scientific-*` split is introduced for
the `sci superscript,sci sep align` column.
