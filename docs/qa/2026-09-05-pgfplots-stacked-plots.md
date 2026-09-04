# PGFPlots Vertical Stacked Plots

## Scope

This slice implements one bounded PGFPlots feature family: two-dimensional
vertical stacking for equal-length coordinate or table streams whose x grids
match exactly. It covers cumulative lines and vertical stacked bars, including
positive/negative stack selection and per-segment labels. It deliberately does
not claim all PGFPlots stacking modes.

The permanent algorithm, mathematics, and physics drivers are:

- `test/fixtures/examples/pgfplots/stacked-plots/algorithm.tex`
- `test/fixtures/examples/pgfplots/stacked-plots/math.tex`
- `test/fixtures/examples/pgfplots/stacked-plots/physics.tex`

## Local TeX Reading

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsstackedplots.code.tex`.
PGFPlots stores one previous zero level for every coordinate. Each next point
adds or subtracts its raw value from that level. The implementation requires
matching coordinate counts and grids, can maintain independent positive and
negative streams, and reverses the stored-plot paint order without changing
the source plot's style or legend index.

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`.
The `ybar stacked` style enables `ybar` plus `stack plots=y`, installs the
stacked bar cycle, enables zero suppression in modern compatibility modes, and
uses `nodes near coords bar offset=0.5`. Compatibility 1.13 and newer selects
`stack negative=separate` by default.

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotscoordprocessing.code.tex`
and
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsplothandlers.code.tex`.
Stacking is a survey-stage coordinate transform, before limits and painting.
The bar handler consumes a per-coordinate zero-level stream rather than one
axis-wide baseline.

Also reviewed the `Stacked Plots` section of
`/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplots.pdf` and its
source member `pgfplots.reference.2dplots.tex` in the local documentation
archive.

## Command And Parameter Coverage

Implemented and verified in the three drivers:

- shell: `\documentclass`, `\usepackage{pgfplots}`, `\pgfplotsset`,
  `\begin`, `\end`;
- environments: `document`, `tikzpicture`, `axis`;
- plots: `\addplot`, `\addplot+`, `coordinates`, and `\legend`;
- stack keys: `stack plots=y`, `ybar stacked`, `ybar stacked=minus`,
  `stack dir=plus|minus`, `stack negative=separate|on previous`,
  `stacked ignores zero`, and `reverse stacked plots`;
- bar behavior: `bar width`, native stacked cycle draw/fill colors, and
  per-point zero levels;
- labels: `nodes near coords`, raw layer values, segment midpoint placement,
  and `legend style` with `at`, `anchor`, and `legend columns`;
- axis layout: `width`, `height`, `xmin`, `xmax`, `ymin`, `ymax`, `xtick`,
  `xticklabels`, `xlabel`, `ylabel`, `title`, `grid`, and `legend pos`;
- plot style: named/mixed colors, `very thick`, `mark=*`, `mark=square*`, and
  `mark=triangle*`;
- numeric semantics: all coordinate x/y values, positive and negative raw
  increments, axis bounds, dimensions, bar widths, and normalized legend
  positions are parsed and covered by strict semantic reviews.

The implementation transforms each point into `{stackBaseY, stackDeltaY, y}`.
Range survey uses both the base and final y values; bars paint from the base to
the final value; line plots use the final value; near-coordinate bar labels use
the raw increment at the midpoint. Reverse drawing retains the original plot
index so cycle styles and legends are not reassigned.

Not implemented by this slice: function-expression stacking, x or z stacking,
logarithmic stacking, interval stacked bars, mismatched x-grid interpolation,
three-dimensional stacks, stacked closed-cycle area filling, and arbitrary
phase-specific `stacked ignores zero/<phase>` keys. The package remains
`partial`.

## Visual References

Local tools:

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- MacTeX `pdflatex`: `/Library/TeX/texbin/pdflatex`
- SVG-to-PNG: `/opt/homebrew/bin/rsvg-convert`

MacTeX PNG, TikZKit SVG/PNG, tikztosvg SVG/PNG, one-centimeter grids,
differences, and four-panel sheets are stored in:

- `outputs/qa/2026-09-05-pgfplots-stacked-plots-before`
- `outputs/qa/2026-09-05-pgfplots-stacked-plots-after`

Before the fix, the algorithm bars all started at zero, so later layers hid or
overpainted earlier ones. The mathematics panel showed the three raw sequences
instead of successive partial sums. The negative physics bars were not painted
and their values floated above an empty axis, producing a 237.88pt-high SVG.

After the fix, the algorithm panel has contiguous blue, red, and tan segments,
with positive and negative values on separate sides of zero. The mathematics
panel follows `a_n`, `a_n+b_n`, and `a_n+b_n+c_n`. The physics bars accumulate
downward from zero in three labeled segments; its SVG height is 193.77pt versus
194.22pt for tikztosvg. All segment labels are centered and display the raw
increment rather than the cumulative endpoint. Axes, grids, titles, legends,
markers, and layer order were inspected in all before/after sheets.

The final TikZKit-to-tikztosvg mean absolute RGBA residuals are 0.0373,
0.0415, and 0.0263. These numbers are supporting evidence only. The remaining
visible differences are mainly font rasterization, small title/tick shifts,
legend swatch fills, and 3 to 10 pixels of outer canvas width.

The three tikztosvg SVGs contain 58/72/55 path definitions, 106/73/78 glyph
`use` elements, and 90/86/75 groups. Text is emitted as reusable glyph paths,
not SVG `text`; clipping is represented by `clipPath` on the line case; and
geometry uses nested transforms with the dvisvgm y-axis flip. Their sizes are
277.363 by 194.768pt, 254.626 by 179.281pt, and 259.811 by 194.215pt. This
confirmed that stacking belongs before SVG serialization and that text-engine
differences should remain outside the stack transform.

## Verification

- `node --test test/pgfplots-stacked-plots.test.js`: 10 passed, including an
  inline table stream parsed through the normal addplot frontend.
- `node --test test/pgfplots-fillbetween.test.js`: 8 passed.
- Three strict semantic audits: accepted, no todos, no blockers.
- Three MacTeX, three tikztosvg, and three TikZKit renders: successful, with
  zero TikZKit diagnostics and zero external-reference failures.
- The broad PGFPlots seams baseline and current combined run both retain the
  same 36 pre-existing failures; this slice adds no regression.
