# PGFPlots CSV Axis-Label Reserve

## Scope

This slice covers the default 2D PGFPlots `xlabel near ticks` placement for a
CSV scatter plot with `nodes near coords`. It does not add CSV syntax or a new
plot type. The driver is
`test/fixtures/examples/latex-examples/csv-2d-point-plot.tex` and uses
`visualization depends on={value \thisrow{label} \as \label}` to place the
CSV labels `a` through `d`.

## Local Implementation Study

Read these local MacTeX sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`
  defines `xlabel near ticks` as `at={(ticklabel cs:0.5)}` with
  `anchor=near ticklabel`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotscoordprocessing.code.tex`
  adds `\pgfplotsvalueoflargesttickdimen` to the `ticklabel cs` outward
  shift.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsticks.code.tex`
  constructs every tick as a TikZ node and measures its complete bounding box
  in the outward normal direction.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`
  provides the ordinary node/hbox construction that gives an unstyled node its
  `.3333em` inner separation.

The relevant geometry is therefore the tick node's glyph hbox plus its two
default inner separations, not a cap-height approximation. A 10pt Computer
Modern digit is 6.4444pt high; together with two 3.333pt separations the
outward node extent is about 13.11pt.

## Change

`src/pgfplots/labels.js` now uses that complete default node extent when
resolving an unstyled `xlabel`. Explicit tick-label `inner sep` still wins.
This is shared PGFPlots label logic, rather than a position adjustment for the
CSV fixture.

The fixture renderer now also materializes manifest resources beside the native
MacTeX `reference.tex`. MacTeX, tikztosvg, and TikZKit all read the same
`resources/csv-2d-point-plot/data.csv` file during this comparison.

## Visual Review

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- MacTeX: `/Library/TeX/texbin/pdflatex`
- artifact root: `outputs/qa-pgfplots-csv-2d-point-plot/`

Reviewed the MacTeX PNG, tikztosvg SVG/PNG, TikZKit SVG/PNG, and
`diff/latex-examples-csv-2d-point-plot-native-sheet.png`.

Before the correction the TikZKit canvas was 203.97pt high and the `mean`
label sat visibly too near the lower tick labels. After the correction it is
206.12pt; tikztosvg is 208.5pt. The remaining roughly 2.4pt comes from the
fixture's `standalone` 2pt border and browser glyph-tight cropping. The plot
box, four scatter marks, `a`--`d` labels, tick positions, `mean`, and
`variance` now agree visually across all three panels. The diff remains mostly
glyph rasterization and the small crop difference, not a misplaced axis label.

## Tests

```bash
node --test --test-name-pattern='label lowering reserves complete default tick-label nodes' test/pgfplots-seams.test.js
node --test test/example-render-script.test.js
node scripts/render-example-fixtures.js \
  --only latex-examples-csv-2d-point-plot \
  --output outputs/qa-pgfplots-csv-2d-point-plot \
  --native-reference \
  --comparison-grid svg \
  --native-latex-engine pdflatex
node scripts/diff-example-pngs.js --output outputs/qa-pgfplots-csv-2d-point-plot
```

## Remaining Work

This does not model the exact per-string `ticklabel cs` bounding-box survey,
rotated/multiline tick labels, `ticklabel* cs`, or all explicit axis-label
styles. Those remain partial PGFPlots work.
