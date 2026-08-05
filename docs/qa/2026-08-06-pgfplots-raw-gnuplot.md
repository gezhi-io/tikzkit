# PGFPlots Raw Gnuplot Numeric Function Blocks

## Scope

This slice replaces the former `chisq(...)`-name special case with a bounded,
browser-safe evaluator for the numeric part of PGF/TikZ `raw gnuplot`. It does
not try to embed gnuplot or execute user JavaScript.

The driver is `test/fixtures/examples/pgfplots/raw-gnuplot-functions.tex`,
adapted from the local PGF manual. It exercises two real raw blocks:

- `set samples`, `set xrange`, `set yrange`, and `plot sin(x)`;
- a numeric constant, a one-expression user function, `exp`, `abs`, and one
  plot expression.

The existing `latex-examples-2d-chi-squared-pdf` fixture remains the
regression case for nested function definitions, conditions, `lgamma`, and
the renamed function form `density(x,2)`.

## Local MacTeX Study

Read these TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduleplot.code.tex`
  at `\\pgfplotgnuplot` (roughly lines 446-515). PGF writes a `.gnuplot` file,
  runs the configured `gnuplot` command through shell escape, then reads the
  generated `.table` file.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`
  at the `raw gnuplot` option and `\\tikz@plot@function` implementation
  (roughly lines 1255 and 3367). With `raw gnuplot`, TikZ passes the complete
  function block through rather than injecting its normal sampling command.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-plots.tex`
  at the `raw gnuplot` key (roughly lines 394-406). Its documented example is
  `set samples 25; plot sin(x)`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`
  at the `/pgfplots/raw gnuplot` mapping. PGFPlots delegates this option to
  TikZ's raw gnuplot behavior.

The browser implementation follows the important semantic boundary: parse a
numeric gnuplot subset and lower it to coordinates. It never launches a
process and never evaluates source as JavaScript.

## Implemented Syntax

`src/pgfplots/rawGnuplotRuntime.js` supports this bounded subset:

- numeric assignments such as `gain = 2`;
- one-expression function definitions such as `envelope(t)=exp(-abs(t))`;
- `set xrange`, `set yrange`, `samples=...`, and `set samples ...`;
- a single `plot` expression, including `plot [x=a:b] expression`;
- arithmetic, comparisons, logical operations, and conditional `?:`;
- `pi`, `e`, trigonometric and hyperbolic functions, `sqrt`, `exp`, logarithms,
  rounding, `min`, `max`, `gamma`, `lgamma`, and `igamma`.

It remains deliberately partial: multi-plot commands, parametric and 3D
programs, strings, gnuplot files, shell calls, arbitrary plot modifiers, and
unsupported gnuplot functions are rejected with a diagnostic. Y-range
filtering currently omits out-of-range points; it does not yet segment paths at
every discontinuity exactly as gnuplot does.

## Artifacts And Visual Review

`tikztosvg` is available at `/Library/TeX/texbin/tikztosvg`; PNG conversion
uses `/opt/homebrew/bin/rsvg-convert`. No `gnuplot` executable exists in the
checked local command paths, including `/usr/local/bin`, `/opt/homebrew/bin`,
and `/Library/TeX/texbin`.

Artifact roots:

- existing chi-square regression: `/private/tmp/tikzkit-qa-chi2-before/` and
  `/private/tmp/tikzkit-qa-chi2-after/`;
- new manual-derived driver: `/private/tmp/tikzkit-qa-raw-gnuplot-after/`.

Inspected sheets:

- `/private/tmp/tikzkit-qa-chi2-after/diff/latex-examples-2d-chi-squared-pdf-sheet.png`;
- `/private/tmp/tikzkit-qa-raw-gnuplot-after/diff/pgfplots-raw-gnuplot-functions-sheet.png`.

Visual observations:

- The chi-square JS SVG is byte-for-byte unchanged before and after this
  generalization. Its six curves, dashed styles, legend, axes, and grid remain
  visible; this guards the previously supported real case against a numerical
  or layout regression.
- The new driver now visibly produces the blue sine curve and red dashed
  `2e^{-|x|}` curve, along with the expected grid, axes, labels, and legend.
  Under the previous function-name matcher it emitted no points because neither
  plot was named `chisq`.
- The TikZKit and tikztosvg panels agree on the visible coordinates and plot
  content. Remaining differences are font glyph outlines, anti-aliasing, and
  small layout margins rather than a missing curve or legend.

MacTeX native PNG is **not available for this raw-gnuplot slice**: it fails
when PGF attempts to read the `.table` file because local gnuplot is absent.
The render script lowers supported raw blocks to coordinates before invoking
tikztosvg, so its SVG is useful for renderer/layout inspection but is not an
independent oracle for raw-gnuplot evaluation. Native gnuplot must be installed
locally before this feature can receive a true three-way numeric comparison.

## Verification

```bash
node --test --test-name-pattern='raw gnuplot' test/pgfplots-seams.test.js
npm run gallery:audit
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-raw-gnuplot-after \
  --only pgfplots-raw-gnuplot-functions \
  --native-reference --comparison-grid-mode svg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-raw-gnuplot-after
npm run extension-registry
```

The focused raw-gnuplot tests pass, and the complete fixture audit reports
`266/266 rendered, 0 diagnostics`. The full PGFPlots seam file still has
unrelated existing snapshot failures, so it is not reported as a green gate for
this slice.

## Next Slice

Install a local gnuplot executable for a native reference, then add one
discontinuous function and one multi-expression raw block as separate bounded
slices. Do not expand into arbitrary process execution or unrestricted
gnuplot-script support.
