# PGFPlots stacked closed-area QA (2026-09-05)

## Slice and boundary

This pass implements equal-grid 2D `stack plots=y` coordinate/table plots ending in `\closedcycle`. The accepted handler family is sharp line, `smooth`, and `const plot`, together with the `area style` expansion to the area color cycle, area legend image, and foreground axes.

It does not claim function stacking, x-stacked closed areas, mismatched-grid interpolation, logarithmic or 3D area stacking, or unbounded/jump-handler closure.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsstackedplots.code.tex`: the first closed plot returns to the ordinary zero level; every later plot appends the previous zero-level point stream in reverse order, with the active plot handler mirrored before `--cycle`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`: `area style` selects the area/bar cycle, the 0.6cm by 0.2cm rectangular `area legend`, and `axis on top`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsplothandlers.code.tex`: const and smooth handlers determine the forward and mirrored return geometry.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotscoordprocessing.code.tex`: the logical zero level is clamped to the visible axis interval before it becomes the first stacked baseline.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplots.doc.src.tar.bz2`, member `pgfplots.reference.2dplots.tex`: the documented area examples require the same coordinate grid and cover sharp, const, and smooth boundaries.

## References and artifacts

Local third-party renderer: `/Library/TeX/texbin/tikztosvg`.

Final artifact root: `outputs/qa/2026-09-05-pgfplots-stacked-area-after/`.

- MacTeX PNG: `mactex-png/`
- TikZKit SVG/PNG: `tikzkit-svg/`, `tikzkit-png/`
- tikztosvg SVG/PNG: `tikztosvg-svg/`, `tikztosvg-png/`
- Four-way native/TikZKit/tikztosvg/diff sheets: `diff/*-native-sheet.png`

The tikztosvg SVGs use filled nonzero-rule paths, butt caps, miter joins, a global y-flip transform, and four-corner filled legend paths. The const example exposes the critical geometry: the upper stair runs forward, then the previous stair returns in reverse with the corner orientation mirrored.

## Visual result

- Before: all three colored series independently returned to the zero axis. The panels showed overlapping triangles or low step polygons instead of cumulative bands, and their legend samples were lines.
- After: algorithm data forms three cumulative sharp-edged bands with matching breakpoints and layer order.
- After: the mathematics case has smooth upper and lower boundaries; the lower edge is the prior smooth cumulative curve rather than the x-axis.
- After: the physics case has cumulative const bands whose reverse boundary keeps the native stair orientation rather than crossing diagonally.
- After: all three legends use filled area rectangles, and grids/axes paint over the fills. The closed path itself now owns its fill, complete boundary stroke, and axis clip.
- A plot-local `stack plots=false` remains unstacked and does not update the zero-level stream used by later layers.
- Remaining visible differences are text and overall bbox width, not area topology. The TikZKit canvases are 8-14 px wider than tikztosvg because of current text measurement/cropping.

As an auxiliary measure, changed-pixel ratio against tikztosvg improved from 0.3785 to 0.1572 (algorithm), 0.4084 to 0.1693 (mathematics), and 0.4024 to 0.1433 (physics).

## Verification

- `node --test test/pgfplots-stacked-plots.test.js test/pgfplots-fillbetween.test.js`
- `node scripts/render-example-fixtures.js --only pgfplots-stacked-area-algorithm --only pgfplots-stacked-area-math --only pgfplots-stacked-area-physics --output outputs/qa/2026-09-05-pgfplots-stacked-area-after --native-reference --strict-tikztosvg --continue-on-external-failure --tikztosvg-engine pdflatex --math-renderer svg-text`
- `node scripts/diff-example-pngs.js --output outputs/qa/2026-09-05-pgfplots-stacked-area-after`

All three fixtures render with zero TikZKit diagnostics and zero native/tikztosvg failures.
