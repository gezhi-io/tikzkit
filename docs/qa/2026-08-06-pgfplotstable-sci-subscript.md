# pgfplotstable Scientific Subscript QA (2026-08-06)

## Scope

This slice implements `sci subscript` for the existing visible
`\pgfplotstabletypeset` number-printer subset. It covers `sci`, `sci zerofill`,
and `sci precision`, including both a non-zero scientific exponent and the
zero-valued input branch. It also defines the native interaction with
`sci sep align`: the output remains a complete subscript formula in one cell;
it is not converted into the standard `\cdot 10^n` two-fragment alignment.

The real fixture is
`test/fixtures/examples/pgfplots/pgfplotstable-sci-subscript.tex`, adapted
from the TeX Live number-format examples. It places `0.001`, `0.098`, `123.4`,
`1`, and `0` in both a direct subscript column and a column that additionally
declares `sci sep align`.

## Local MacTeX Study

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/math/pgfmathfloat.code.tex`,
  lines 872-901: `pgfmathfloatrounddisplaystyle@std` emits the configurable
  scientific marker followed by `10^{n}`, while
  `pgfmathfloatrounddisplaystyle@subscript` passes an empty marker, `1`, and
  `_{n}` through the same shared formatter. The exponent token is therefore
  present for `1` and `0` alike.
- The same file, lines 1048-1059, registers `sci subscript` as an explicit
  display-style selector, separate from `sci 10^e`, `sci superscript`, and
  `sci generic`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/numtable/pgfplotstable.code.tex`,
  lines 298-326: `sci sep align` looks for the standard exponent-mark `&`.
  A subscript printer produces no such mark, so the native table leaves the
  formula unsplit and merely supplies the empty second `r@{}l` cell.

TikZKit mirrors that distinction in `pgfplotstableFormatScientific`: the
subscript form returns one math cell, while only the standard presentation can
produce the internal `\\tikzkitscialign{mantissa}{exponent}` marker consumed by
the renderer-neutral tabular layout.

## Implemented Parameters

| Command or key | Status | Boundary |
| --- | --- | --- |
| `\pgfplotstabletypeset` | implemented subset | inline or registered tables only |
| `columns/<name>/.style` | implemented subset | selected column styles |
| `sci`, `sci zerofill`, `sci precision` | implemented subset | shared number-printer subset |
| `sci subscript` | implemented | renders `$mantissa_{exponent}$` |
| zero and exponent zero | implemented | `0.00_{0}` and `1.00_{0}` retain the native subscript |
| `sci subscript,sci sep align` | implemented | valid source; intentionally one complete cell, no shared exponent anchor |
| `sci superscript` | implemented separately | direct `mantissa^{exponent}` form; it also remains whole under `sci sep align` |
| `sci generic`, custom exponent marks | not implemented | separate PGF display strategies |
| `dcolumn`, non-finite values, arbitrary post-processing | partial | outside the focused table subset |

## Three-Way Visual QA

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. Artifacts are in
`/private/tmp/tikzkit-qa-pgfplotstable-sci-subscript-2026-08-06`:

- TikZKit SVG/PNG: `tikzkit-svg/pgfplotstable-sci-subscript.svg` and
  `tikzkit-png/pgfplotstable-sci-subscript.png`.
- tikztosvg SVG/PNG: `tikztosvg-svg/pgfplotstable-sci-subscript.svg` and
  `tikztosvg-png/pgfplotstable-sci-subscript.png`.
- MacTeX PNG and inspected four-panel sheet:
  `mactex-png/pgfplotstable-sci-subscript.png` and
  `diff/pgfplotstable-sci-subscript-native-sheet.png`.

I inspected the JS, tikztosvg, MacTeX, grid, and registered-diff panels. Before
the change, both table columns ignored `sci subscript`: the first rendered a
standard `\cdot 10^n` formula, while the second also fabricated a shared
scientific-tail column. After the change, all rows visibly use subscript
exponents, `1.00_{0}` and `0.00_{0}` remain visible, and the third column keeps
the native whole-formula layout rather than falsely aligning the subscript.

TikZKit and the pdflatex MacTeX reference are both `238 x 101px` with root
sizes `177.85pt x 75.72pt`. `tikztosvg` uses XeLaTeX path outlines rather than
SVG `<text>` and has a `173.89pt x 71.73pt` canvas (`232 x 96px` PNG); its
subscript glyph paths visibly sit below the mantissa baseline, and its geometry
matches the same rows and columns. The tikztosvg-vs-JS pixel residual is only
supporting evidence because the two tools use different font/raster pipelines.

## Regression

```bash
npm test -- test/pgfplotstable-typeset.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-pgfplotstable-sci-subscript-2026-08-06 \
  --only pgfplotstable-sci-subscript --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output \
  /private/tmp/tikzkit-qa-pgfplotstable-sci-subscript-2026-08-06 \
  --register --alignment-radius 3
```

The focused regression checks the literal subscript formulas, both zero cases,
and the absence of a synthetic `tabular-scientific-*` split for the
`sci subscript,sci sep align` column.
