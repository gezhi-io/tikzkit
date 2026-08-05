# PGFPlots `dateplot` Library Contract

## Scope

This slice registers the already implemented ISO-date coordinate path as two
separate library declarations:

- `\usepgfplotslibrary{dateplot}` -> `src/pgfplots/libraries/dateplot.js`
- `\usetikzlibrary{pgfplots.dateplot}` -> `src/tikz/libraries/pgfplots.dateplot.js`

It also moves all observed PGFPlots library declarations into
`src/pgfplots/libraries/`, so `dateplot`, `fillbetween`, and `groupplots` each
have one file. This is metadata/audit work, not a per-case coordinate patch.

The driving source is
`test/fixtures/examples/latex-examples/landtagswahlen-in-bayern.tex`.

## Local MacTeX Reading

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.dateplot.code.tex`

The library loads `pgfcalendar`, converts a date to a Julian day, subtracts
`date ZERO`, and installs forward and inverse transforms for each selected
axis. The inverse transform exposes `\year`, `\month`, `\day`, `\hour`, and
`\minute` when the tick label is rendered. It also disables scaled ticks for
the transformed date axis. TikZKit follows that model in
`src/pgfplots/dateCoordinates.js`: ISO date/date-time parsing, day-relative
coordinates, `xtick=data`, and date-field tick labels all lower before the
ordinary axis renderer runs.

## Exact Case Inventory

The semantic audit writes the full inventory to
`outputs/qa-dateplot-library/audit.md`: 5 packages, 2 library declarations,
12 commands, 42 option paths, and 18 numeric literals. The dateplot-specific
surface is:

- declarations: `dateplot` and `pgfplots.dateplot`
- commands: `\usepgfplotslibrary`, `\usetikzlibrary`, `\addplot` (seven
  table series), `\legend`, `\pgfmathprintnumber`, `\tick`, and `\year`
- coordinates: `date coordinates in=x`, `date ZERO=1946-06-30`, ISO
  `xmin={1946-01-01}`, and `xmax={2010-01-01}`
- ticks and labels: `xtick=data`, `xticklabel={\year}`, 45-degree centered
  x labels, `ytick={0,10,...,100}`, and percentage tick formatting
- geometry and paint: `width=15cm`, `height=8cm`, `grid=major`, dashed
  `gray!30` grid lines, `legend style={at={(1.15,1)},anchor=north}`, and seven
  colored marked series.

The current partial boundary deliberately excludes arbitrary
`date coordinates default inverse` templates, localized calendar formatting,
exact PGF minute-rounding edge cases, and date arithmetic outside axis
coordinate transforms.

## Artifacts And Visual Review

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; MacTeX `pdflatex`
and `rsvg-convert` were also available. The following were generated and
visually inspected together:

- MacTeX PNG: `outputs/qa-dateplot-library/mactex-png/latex-examples-landtagswahlen-in-bayern.png`
- TikZKit SVG/PNG: `outputs/qa-dateplot-library/tikzkit-svg/latex-examples-landtagswahlen-in-bayern.svg` and `outputs/qa-dateplot-library/tikzkit-png/latex-examples-landtagswahlen-in-bayern.png`
- tikztosvg SVG/PNG: `outputs/qa-dateplot-library/tikztosvg-svg/latex-examples-landtagswahlen-in-bayern.svg` and `outputs/qa-dateplot-library/tikztosvg-png/latex-examples-landtagswahlen-in-bayern.png`
- four-panel sheet: `outputs/qa-dateplot-library/diff/latex-examples-landtagswahlen-in-bayern-native-sheet.png`

All three show the same 1946--2008 date range, rotated year ticks, 0--100%
y scale, seven series, legend order, clipping, and dashed grid. TikZKit and
tikztosvg differ by one raster pixel in canvas width (691 vs 692) and have a
7.92% changed-pixel ratio dominated by glyph and line antialiasing; no curve,
tick, label, or legend displacement was visible. No rendering geometry was
changed solely to improve that scalar diff.

## Audit Outcome

Before this change, the PGFPlots declaration lost its local source in the
semantic-audit pipeline and `\year` was an unmapped blocker. The audit now
keeps both dateplot declarations' local-source review metadata and attributes
`\year` to `formatPgfplotsDateLabel`; the actual case has zero blockers.

The case is intentionally still `incomplete`: every remaining command,
option, and numeric semantic needs explicit reviewed evidence. This report is
therefore not a claim of full PGFPlots/dateplot compatibility.

## Validation

Passed:

```text
node --test test/case-semantic-audit.test.js test/pgfplots-dateplot.test.js test/pgfplots-library-modules.test.js test/library-modules.test.js test/pgfplots-fillbetween.test.js
npm run extension-registry
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples --output outputs/qa-dateplot-library --only latex-examples-landtagswahlen-in-bayern --native-reference --strict-tikztosvg --comparison-grid-mode svg --preserve-output
node scripts/diff-example-pngs.js --output outputs/qa-dateplot-library
```

`npm test` was also run. At this checkout it reports 1,551 passing, 91 failing,
and 14 skipped tests. The focused dateplot/module/audit tests above all pass.
The full-suite failures include the pre-existing architecture assertion that
rejects its own `browser_workbench` JSON fixture and unrelated visual/text
expectations such as `tikzquads`; this dateplot metadata and audit slice does
not claim to repair them.
