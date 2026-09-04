# PGFPlots xbar stacked QA (2026-09-05)

## Slice

This round implements one bounded PGFPlots family: two-dimensional horizontal stacking for equally sampled coordinate/table plots. It covers `stack plots=x`, `xbar stacked=plus|minus`, `stack negative=separate|on previous`, `stacked ignores zero`, `reverse stacked plots`, stacked bar cycle styles, per-point x zero levels, and centered raw-x `nodes near coords` labels.

It does not claim function or z stacking, logarithmic stacking, interval stacked bars, mismatched-grid interpolation, closed-area stacking, or 3D stacking.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`, lines 3224-3263 and 3530-3542: `xbar stacked` installs `bar direction=x`, `stack plots=x`, `stack dir`, the bar cycle, modern compatibility switches, raw-x point meta, center anchors, and `base + 0.5 * delta` x placement for near-coordinate nodes.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsstackedplots.code.tex`, especially zero-level parsing and stored-plot finalization: x/y stacking share one coordinate-stream algorithm; separate negatives retain positive and negative levels independently, while on-previous uses one level; drawing order is reversed after values are prepared.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsplothandlers.code.tex`: xbar consumes the x component of each zero-level coordinate rather than a single global baseline.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplots.pdf` and source member `pgfplots.reference.2dplots.tex`: xbar stacked is xbar plus x stacking, requires equal y grids, and centers raw increments inside each segment.

## References and artifacts

Local tools were found at `/Library/TeX/texbin/tikztosvg`, `/Library/TeX/texbin/pdflatex`, and `/opt/homebrew/bin/rsvg-convert`.

- Before: `outputs/qa/2026-09-05-pgfplots-xbar-stacked-before`
- After: `outputs/qa/2026-09-05-pgfplots-xbar-stacked-after`
- Each directory contains MacTeX PNG, TikZKit SVG/PNG, tikztosvg SVG/PNG, registered diffs, and three/four-way sheets.

The tikztosvg files use a fixed `viewBox`, glyph outlines as `<path>` plus `<use>`, clipped plot paths where needed, and stroked/fill paths for bars. There are no live SVG text nodes. MacTeX and tikztosvg agree on segment topology, reverse paint order, midpoint labels, and per-point zero levels, so they were used together as the reference.

## Visual result

- `pgfplots-xbar-stacked-algorithm`: before, all three series started at x=0 and overlapped as independent bars; after, CPU and I/O form rightward segments while recovered capacity forms a separate leftward segment, with all raw values centered as in the references.
- `pgfplots-xbar-stacked-math`: before, three raw curves occupied x=1, x=1..3, and x=0.5..1.5; after, the second and third curves are cumulative x tops on the shared y grid, matching the reference geometry.
- `pgfplots-xbar-stacked-physics`: before, subtractive bars fell outside the visible range and only labels remained; after, all three material segments accumulate leftward from their prior x zero levels and their labels sit at segment midpoints.

Residual differences are existing font rasterization and small axis/legend box metrics. They do not change the stacked data geometry. All three TikZKit renders have zero diagnostics.

## Implementation and validation

Changed shared logic in `src/pgfplots/stackedPlots.js`, `bars.js`, `rangeResolver.js`, `plotNodes.js`, and `axisTikzLowering.js`. Added three accepted fixtures and direction-focused tests in `test/pgfplots-stacked-plots.test.js`.

- Focused stack tests: 17 passed, 0 failed.
- Strict semantic audits: 3 accepted, 0 todos, 0 blockers.
- `test/pgfplots-seams.test.js`: 187 passed, 36 pre-existing failures, unchanged.
- `test/extensions.test.js`: 164 passed, 20 pre-existing failures, unchanged.
- Native/tikztosvg generation: 3/3 each, no external failures.

## Next slice

The next related boundary should be `xbar interval stacked` and `ybar interval stacked`, because interval widths and terminal coordinates require a distinct zero-level contract and should not be implied by this coordinate-bar implementation.
