# PGFPlots interval stacked QA (2026-09-05)

## Slice

This round implements one bounded PGFPlots family: two-dimensional `xbar interval stacked` and `ybar interval stacked` for coordinate/table plots that share the same ordered boundary grid. It covers `plus|minus`, modern separate or legacy on-previous negative streams, the interval-specific false default for `stacked ignores zero`, reverse paint order, stacked bar cycle colors, per-boundary zero levels, terminal-boundary survey/nodes, and native single-bar legend images.

It does not claim mixed interval modes, mismatched-grid interpolation, logarithmic or 3D interval stacking, function stacking, or stacked closed-area fills.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`, the `xbar interval stacked` and `ybar interval stacked` styles: each selects its bar direction, raw point meta, stack axis/direction, compatibility-dependent negative policy, reverse bar cycle, single-bar legend, and the low-level `/tikz/xbar interval` or `/tikz/ybar interval` handler. They deliberately do not invoke the complete ordinary PGFPlots interval style, so automatic `tick=data`, interval labels, and major-grid defaults are not inherited.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsstackedplots.code.tex`: stack direction is applied before positive/negative stream selection, every boundary updates its per-index zero level, modern negative values use a separate stream, and stored plots are painted in reverse source order.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryplothandlers.code.tex`: an interval stream with N+1 points paints N rectangles. Rectangle i is delayed until point i+1 arrives, so its top/value comes from point i while the currently exposed stacked zero level comes from boundary i+1. The terminal point supplies the final boundary and final zero level, but its value is not painted as a bar.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplots.pdf` and source archive member `pgfplots.reference.2dplots.tex`: interval stacking keeps the ordinary stack survey contract, while generic `nodes near coords` may still visit the terminal coordinate.

## References and artifacts

Local tools were found at `/Library/TeX/texbin/tikztosvg`, `/Library/TeX/texbin/pdflatex`, and `/opt/homebrew/bin/rsvg-convert`.

- Before: `outputs/qa/2026-09-05-pgfplots-interval-stacked-before`
- After: `outputs/qa/2026-09-05-pgfplots-interval-stacked-after`
- Each directory contains MacTeX PNG, TikZKit SVG/PNG, tikztosvg SVG/PNG, pixel diffs, grid overlays, and comparison sheets.

The tikztosvg SVGs use fixed point-based `viewBox` geometry, glyph outlines through `<path>` and `<use>`, `fill-rule=nonzero`, `stroke-linecap=butt`, `stroke-linejoin=miter`, and a y-flipping matrix. Their stacked rectangles are emitted in reverse source order. TikZKit emits separate SVG rectangle paths with the same cap/join and reverse layer order; its live text representation and coordinate-system orientation differ, but the physical interval geometry agrees with MacTeX and tikztosvg.

## Visual result

- `pgfplots-ybar-interval-stacked-algorithm`: before, the three phase series were independent polylines with no bars; after, adjacent x boundaries produce cumulative vertical rectangles, cycle colors and compact bar legend samples matching the references.
- `pgfplots-xbar-interval-stacked-math`: before, the terms appeared as raw lines; after, irregular y intervals retain their true heights and each horizontal rectangle pairs point i's cumulative top with boundary i+1's zero level, including the degenerate and reset segments visible in native output.
- `pgfplots-ybar-interval-stacked-physics`: before, subtractive samples were disconnected lines; after, `stack dir=minus` builds downward cumulative energy-loss bars from each preceding level.

The terminal coordinate expands stack survey/range, supplies the final interval rectangle's zero level, and can receive a generic near-coordinate node, but its own value does not create an extra rectangle. Residual differences are font rasterization and small legend/axis text bounds, not interval topology. The changed-pixel ratios fall from roughly 37-43% before to 7.7-13.9% after; these numbers are supporting evidence only. All three accepted TikZKit renders have zero diagnostics.

## Implementation and validation

Shared changes are in `src/pgfplots/stackedPlots.js`, `bars.js`, `histogram.js`, `plotNodes.js`, `axisTikzLowering.js`, and `legend.js`. Three accepted algorithm, mathematics, and physics fixtures and focused regression tests were added.

The reference batch used:

```sh
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples --native-reference --strict-tikztosvg --tikztosvg-engine pdflatex --math-renderer svg-text --only pgfplots-ybar-interval-stacked-algorithm --only pgfplots-xbar-interval-stacked-math --only pgfplots-ybar-interval-stacked-physics --output outputs/qa/2026-09-05-pgfplots-interval-stacked-after
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-05-pgfplots-interval-stacked-after
```

- Focused stacked tests: 23 passed, 0 failed.
- Strict semantic audits: 3 accepted, 0 todos, 0 blockers.
- Native and tikztosvg generation: 3/3 each, no external failures.
- `test/pgfplots-csv-overlay.test.js`: 34 passed, 0 failed.
- `test/pgfplots-seams.test.js`: 187 passed, 36 pre-existing failures, unchanged.
- `test/extensions.test.js`: 164 passed, 20 pre-existing failures, unchanged.
- `test/pgfplots-histogram.test.js`: 9 passed and one pre-existing 0.84pt native-height threshold failure; the same failure and measured height reproduce at the parent commit.
- The port 5174 workbench loaded all three final browser SVGs with their local tikztosvg references and zero diagnostics.

## Next slice

The next related boundary should be stacked closed-area fills. It needs a polygon-level baseline contract and clipping behavior, so it should remain separate from this interval-rectangle implementation.
