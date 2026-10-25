# Datavisualization Tick Geometry and Option Replay

## Scope and Status

This batch addresses Cartesian/scientific major tick geometry, source-ordered
manual options and tick-label boxes. It follows the remaining datavisualization
failures, not a claim to implement the complete library. Both library registry
entries remain **partial**.

Full explicit regression result: **2,998 tests, 2,951 passed, 33 failed,
14 unchanged skips**, no cancellations or new failing names. The previous
checkpoint had 39 failures. Eleven new regression tests pass. The six fewer
old failures include native-evidence corrections to stale expectations;
they are not six independently repaired rendering defects.

Actual browser checks pass for **10 of 12** fixtures in both default JS and
SVG-text modes. Two legend-related cases remain unaccepted. The overall
browser audit correctly exits nonzero. No tolerance was relaxed, no tests
were disabled, and no npm login, release, version bump or remote push occurred.

## Local Reference

`command -v tikztosvg` resolves to `/Library/TeX/texbin/tikztosvg`.
The runner uses local pdflatex and `rsvg-convert`. All twelve fixtures have
JS SVG/PNG, tikztosvg SVG/PNG and independent original-document MacTeX PNG.

Files reviewed under `/usr/local/texlive/2025/texmf-dist/`:

- `tex/generic/pgf/frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.code.tex:530-655`:
  major marks use 2pt, minor marks 1.4pt, round caps; tick nodes use
  footnotesize, 1pt inner separation and .1666em outer separation.
- The same file, lines 875-1040: replay axis settings, common settings,
  major settings, each occurrence's options, then value-based `options at`.
  Odd/even padding changes the painted tick endpoints before label placement.
  `options at` consumes bracketed styles, not following label text.
- The same file, school-book and scientific declarations: school-book axes
  use ordinary TikZ `->`; bare Cartesian axes do not install that arrow.
- `tex/generic/pgf/frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.formats.functions.code.tex`:
  this loader imports the common datavisualization library, so function plots
  use the same tick visualizer rather than separate tick-size rules.
- `doc/generic/pgf/pgfmanual-en-dv-axes.tex:2160-2199,2411-2505`:
  per-value styling, source-list ordinal stacking, and signed low/high padding.
- `tex/generic/pgf/frontendlayer/tikz/tikz.code.tex:1710-1790`:
  shorthand `\tikz` is a picture and executes the end-picture hook.

The independent probe `test/fixtures/datavis-tick-geometry-metrics.tex`
records endpoints and node centers in native TeX points. Its log is in
`outputs/qa/2026-10-25-datavis-tick-before/`.

| Probe | Native result in TeX pt |
| --- | --- |
| School-book major tick | -2 to +2 |
| Clean lower axis / ordinary tick | -5 / -7 to -5 |
| Clean tick with low=-5pt | -10 to -5 |
| Clean tick with 1ex padding | -11.30554 to -5 |
| Ordinary positive x label center | -12.24373 |
| Low=-5pt label center | -15.24373 |
| Stack=3pt | even ticks extend 3pt farther; odd ticks unchanged |

The manual-low reference SVG has a 0.3985 SVG-pt pen (0.4 TeX-pt), round
tick caps, miter joins, and a flipped-y matrix. Its red padded tick runs from
-11.263156 to -4.981906 in SVG points, matching the TeX measurement after
72/72.27 conversion. Text is glyph-outline `<use>` paint, with no browser
font fallback or foreignObject. JS uses native CM boxes and the same anchors;
the comparison measures actual browser glyph positions, not an export alone.

## Changes and Visual Inspection

- `src/frontend/latex-shell.js` retains manual tick order and duplicates.
  Inline `as` text and style belong to each occurrence; global `options at`
  applies afterward without replacing that text. Settings are replayed in
  the native common/major/local/value order.
- `src/pgfplots/datavisTicks.js` contains the separate major-tick option
  replay. Low/high endpoints, text-side flags, padding and stack ordinals
  now drive both marks and labels. `ticks.js` emits native node boxes and
  inherits per-tick paint; DV coordinates retain sufficient precision.
- `axisLines.js` removes invented Cartesian arrowheads and selects the
  school-book default arrow kind. `geometry.js` removes the extra synthetic
  PGFPlots gutter when native DV nodes already define the crop.
- `scripts/render-example-fixtures.js` restores declared document borders
  for top-level shorthand pictures, just as for explicit tikzpictures.
  Existing end-picture hooks and nested inline pictures are preserved.
  This corrects the reference wrapper; it is not counted as a JS improvement.
- `scripts/browser-axis-grid-metrics.js` recognizes native DV shafts and
  boxed frames, checks tick colors as well as gray values, and checks every
  canvas edge. A red-to-blue mutation with equal first RGB channel must fail.

All twelve aligned sheets were inspected. The manual-low and option-order
original MacTeX PNGs were also inspected. Visible results:

| Case suffix | Result |
| --- | --- |
| manual-low | Red padded tick and blue numeric label restored; label clearance follows the longer mark. |
| manual-high | Black high-side marks and correct label offsets; the two invented arrowheads are gone. |
| stacked-ticks | Alternate ticks and labels extend together, including the asymmetric y=1 mark. |
| duplicate-ticks | Red `a` and blue `b` survive independently at the same value, with 4pt and 8pt marks. |
| tick-style-order | Native source order retained; the unwanted word `ignored` is gone, and both original labels remain. Their intentional overlap matches MacTeX. |
| boundary-ticks | Sampled sine retains its surveyed range; manual pi tick gains 1ex clearance; suppressed text does not erase its mark. |
| half-step, noninteger-maximum | Existing native half-step selection remains; extra crop gutters removed. |
| single-zero, single-offset | One tick on each axis retained; labels and centered point now share the native crop. |
| school-book-ticks | Symmetric marks and origin behavior improved, but canvas differs by 14.07 CSS px and generic arrow curves are still approximate. Not accepted. |
| colored-legend | Ticks match, but the legend is about 26.81 CSS px too low and crop differs by 12.29px. Not accepted. |

Measurements above use 3x CSS display size with one axis-origin translation,
not independent panel resizing. Accepted controls stay below the unchanged
0.35px geometry threshold. Raster outline antialiasing and, in the noninteger
control, thin dashed-line styling still differ. Ten geometry passes are not
ten whole-image or complete-library parity claims.

## Test Evidence

The focused four-file run passes **91/91**. The duplicate-value and
option-order tests were observed failing before their fixes; their saved
before SVGs visibly lose labels or print the wrong text. Additional controls
guard behavior that was already correct, rather than count it as a new repair.

Before changing old expectations, a full runtime run still reported 39
failures, with no new failures. Six old tests were then corrected using
native evidence: half-step selection in two controls; exclusion of an
out-of-range top tick; sampled rather than analytic sine extrema; suppression
of both school-book origin marks; and structural sparse-label assertions
instead of an option-order-dependent source regex. Exact counts, coordinates,
colors and lengths replace weaker checks; the colored legend itself is still
explicitly rejected by the browser gate.

```sh
node --test test/datavis-tick-geometry.test.js test/datavis-linear-ticks.test.js test/browser-axis-grid-metrics.test.js test/example-render-script.test.js
pdflatex -interaction=nonstopmode -halt-on-error -output-directory=outputs/qa/2026-10-25-datavis-tick-before test/fixtures/datavis-tick-geometry-metrics.tex
node scripts/render-example-fixtures.js --fixtures test/fixtures/datavis-tick-geometry --output outputs/qa/2026-10-25-datavis-tick-final --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --strict-tikztosvg
node scripts/audit-module-regressions.js --fixtures test/fixtures/datavis-tick-geometry --output outputs/qa/2026-10-25-datavis-tick-final --before outputs/qa/2026-10-25-datavis-tick-before --tick-grid-metrics --browser-module /path/to/playwright/index.mjs
node --test --test-reporter=./scripts/module-test-reporter.js test/*.test.js
node --experimental-vm-modules scripts/check-architecture.js
node scripts/check-doc-links.js
```

Artifacts under `outputs/qa/2026-10-25-datavis-tick-final/`:
`browser-audit.html`, `browser-audit.json`, `browser-gates.json`,
`test-runtime-before-expectations.json`, `test-summary-final.json`,
`tikzkit-svg/`, `tikzkit-png/`, `tikztosvg-svg/`, `tikztosvg-png/`,
`mactex-png/` and `browser/*-aligned-sheet.png`.
The before directory contains the original ten controls; duplicate/order
controls were added from `2026-10-25-datavis-duplicate-before/` and
`2026-10-25-datavis-style-order-before/` before each corresponding fix.

## Remaining Work

The 33 explicit regression failures remain active. Next visual work should
replace fixed outside-legend offsets with native bbox/matrix construction,
and audit ordinary TikZ `to` arrow geometry. Minor/subminor per-value options,
opposite boxed-side per-value styles, arbitrary `every odd/even tick` styles,
all repeated-key interactions and nondefault outer-font em/ex units remain
partial. This batch carries the default 10pt outer font, not every TeX font
context. Arbitrary custom visualizers and legend matrices remain unsupported
or partial. Bare `node --test` also still discovers three manual fixture
probes as tests; explicit `test/*.test.js` keeps this checkpoint comparable
with the previous baseline, without treating that discovery issue as fixed.
