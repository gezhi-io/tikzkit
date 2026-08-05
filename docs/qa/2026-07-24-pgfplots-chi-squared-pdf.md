# PGFPlots Chi-Squared PDF QA

## Scope

Implemented and visually checked the PGFPlots slice exercised by
`latex-examples-2d-chi-squared-pdf`: recognized raw gnuplot chi-squared PDF
expressions inside `\foreach`, cycle-list line styles, empty plot marks,
restricted zero-bound middle axes, and automatic major-tick planning.

## Local Source Review

Reviewed the local TeX Live sources:

- `tex/generic/pgfplots/pgfplotscoordprocessing.code.tex`: raw gnuplot is
  collected as an external survey operation, rather than being normal TikZ
  arithmetic.
- `tex/generic/pgfplots/pgfplots.scaling.code.tex`: explicit `width` and
  `height` reserve the standard 45pt non-plot allocation when `scale only
  axis` is false.
- `tex/generic/pgfplots/pgfplotsticks.code.tex`: automatic step candidates are
  selected from the final transformed range and normalized to 1/2/5 times a
  power of ten.

## Artifacts

- TikZKit SVG/PNG:
  `outputs/qa-chi-squared-final/tikzkit-svg/latex-examples-2d-chi-squared-pdf.svg`
  and `outputs/qa-chi-squared-final/tikzkit-png/latex-examples-2d-chi-squared-pdf.png`.
- tikztosvg executable: `/Library/TeX/texbin/tikztosvg`.
- tikztosvg SVG/PNG:
  `outputs/qa-chi-squared-final/tikztosvg-svg/latex-examples-2d-chi-squared-pdf.svg`
  and `outputs/qa-chi-squared-final/tikztosvg-png/latex-examples-2d-chi-squared-pdf.png`.
- Four-panel visual sheet:
  `outputs/qa-chi-squared-final/diff/latex-examples-2d-chi-squared-pdf-sheet.png`.

The third-party SVG uses outlined text paths, native line-cap/join defaults,
dash arrays for the cycle-list styles, and a `409.11pt x 234.24pt` viewBox.
TikZKit now produces `409.30pt x 234.23pt`; it deliberately emits no marker
for `mark={}`.

## Visual Result

Before this slice, the JS plot used accidental legend/curve marks, half-unit
x ticks, and a shorter canvas. After the change it has the same six unmarked
chi-squared curves, unit x ticks from 1 to 8, restricted y ticks from 0.1 to
0.5, and the native-height middle y-axis extent. The remaining visible
differences are font outline/rasterization and a small legend/title placement
delta; the PNG pixel comparison is different but has matching dimensions, so
the decision was made from the viewed sheet rather than its diff score.

## MacTeX Native Attempt

`/Library/TeX/texbin/pdflatex` was found and invoked. This original example
requires an external `gnuplot` binary; plain pdflatex requested shell escape,
and shell-escape compilation then failed because `gnuplot` is not installed
locally. No package was installed. Therefore this round has no MacTeX native
PNG for this case; tikztosvg normalized the supported raw-gnuplot pattern and
provided the usable rendered reference.

## Commands and Coverage

Implemented for this driver: `\pgfplotscreateplotcyclelist`, `cycle list
name`, `\foreach`, `\addplot+`, `mark={}`, raw `gnuplot[raw gnuplot]` for the
recognized chi-squared PDF pattern, `domain`, `restrict y to domain`,
`enlargelimits`, `axis x/y line=middle`, major grid, title, labels, legend,
and cycle colors/dashes.

Not implemented generally: arbitrary gnuplot programs, arbitrary
`lgamma`/conditional gnuplot expressions, generic external gnuplot process
execution, and all PGFPlots legend-matrix layout variants.

## Verification

Focused PGFPlots seam tests pass, including raw-gnuplot parsing, cycle styles,
empty marks, final-range tick planning, lower middle-axis extent, and the
chi-squared bbox gate. Diagnostics for the fixture remain empty.
