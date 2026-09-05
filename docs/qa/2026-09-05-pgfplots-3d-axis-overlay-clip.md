# PGFPlots 3D axis overlay clipping QA

## Scope

This slice implements the coordinate-then-clip behavior for ordinary PGFPlots axis overlays. It covers unclamped `axis cs`, `rel axis cs`, `normalized axis cs`, `axis description cs`, and `axis direction cs` projection; default/global 2D rectangle and 3D projected-box clipping; and clip propagation through paths, node boxes, node text, pin text, and pin edges. `clip mode=individual` and `clip=false` keep ordinary overlay commands unclipped.

It does not claim arbitrary non-box axis outlines, custom clip paths or layers, 3D marker geometry clipping, or exact plot/overlay phase interleaving.

## MacTeX source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.revision.tex`: the installed reference is PGFPlots 1.18.2.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`: `clip=true` and `clip mode=global` are defaults; global mode installs one clip before axis content; individual mode clips each plot; the 3D outline is selected from the projected outer box; axis coordinate systems transform data without clamping.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.scaling.code.tex` and `util/pgfplotsutil.code.tex`: projected 3D coordinates are linear combinations of the x, y, and z basis vectors.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`: a pin lowers to node text plus a pin edge path, so both must remain inside the active global clip scope.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplots.doc.src.tar.bz2`, `pgfplots.reference.bb-clip.tex`: clipping changes visible output and bounds; 3D uses the outer axis lines; ordinary custom `node` and `draw` commands are globally clipped but need manual clipping in individual mode.

## Reference artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- `rsvg-convert`: `/opt/homebrew/bin/rsvg-convert`
- Before: `outputs/qa/2026-09-05-pgfplots-3d-axis-overlay-clip-before/`
- After: `outputs/qa/2026-09-05-pgfplots-3d-axis-overlay-clip-after/`
- Four-way sheets: each directory's `diff/*-native-sheet.png`

The TikZKit SVG now contains a `clipPathUnits="userSpaceOnUse"` polygon with the six-point convex hull of the projected 3D box. Node boxes, text, and pin paths reference the same clip ID. The local tikztosvg output likewise uses SVG clip paths around the axis content. MacTeX remains the visual authority.

## Visual review

- `latex-examples-3d-gaussian-distribution`: before the fix, TikZKit clamped two out-of-range `axis cs` nodes to the lower-left box boundary, visibly showing `P(x_1)`, `P(x_2)`, and helper lines that MacTeX and tikztosvg hide. After the fix, their real projected positions are retained and the six-edge 3D hull clips the complete node/pin output. The labels and helper lines disappear while the two surfaces, mesh, frame, ticks, labels, colors, and layer order remain unchanged.
- `latex-examples-csv-2d-gaussian-multivarate-distributions`: `clip mode=individual` remains an effective control. Both scatter clouds, three highlighted points, the `(65, 35)` annotation, axes, and labels remain visible.
- `latex-examples-line-chart-electric-vehicles-sold`: the existing 2D global clip remains a control. Both Tesla annotations, pin-like arrows, two-row year/count ticks, curve, markers, and right-side percentages remain visible.

Residual differences are outside this slice: TikZKit still differs in exact Computer Modern text metrics, some 3D frame/tick placement, mesh density/paint details, scatter point density, and crop calibration.

## Tests

```sh
node --test test/pgfplots-3d-overlay-clip.test.js test/pgfplots-clip-mode.test.js
node --test --test-name-pattern='axis overlay lowering|data, relative, and direction coordinates honor reversed axes' test/pgfplots-seams.test.js
node scripts/render-example-fixtures.js --output outputs/qa/2026-09-05-pgfplots-3d-axis-overlay-clip-after --only latex-examples-3d-gaussian-distribution --only latex-examples-csv-2d-gaussian-multivarate-distributions --only latex-examples-line-chart-electric-vehicles-sold --native-reference --strict-tikztosvg --continue-on-external-failure --quiet-progress
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-05-pgfplots-3d-axis-overlay-clip-after
```

All seven new tests and the three existing clip-mode tests pass with zero diagnostics in the real fixtures. The final full suite reports 2,460 tests: 2,317 pass, 129 established failures, and 14 skips. Compared with the pre-change baseline of 2,453 tests, 2,310 passes, 129 failures, and 14 skips, this adds exactly seven passing tests and no new failures.
