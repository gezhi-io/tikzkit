# PGFPlots 2D marker clipping QA (2026-09-05)

## Slice and boundary

This pass implements marker clipping for ordinary 2D PGFPlots coordinate, function, and parametric plots. It covers three native behaviors: `clip=true` rejects marker centers outside the axis while leaving accepted boundary markers whole; `clip marker paths=true` additionally clips accepted marker geometry; and `clip=false` preserves outside markers.

The slice deliberately excludes exact `clip mode=global/individual` multi-plot phase and layer ordering, 3D markers, `mark=text`, comb/bar marker handlers, and nonrectangular axes.

PGFPlots remains `partial`; this is one accepted visual family, not a claim of full package support.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`, lines 2093-2101: `/pgfplots/clip` defaults to true and `clip mode` defaults to global; individual mode is itself documented as partial for graphical elements.
- The same file, lines 3839-3841: `clip marker paths` is an independent boolean whose default value is false.
- The same file, lines 12355-12370: individual clipping installs the axis clip around the selected plot phases.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.markers.code.tex`, lines 38-68: clipped marker paths use the clipped after-path phase; otherwise individual-mode marks paint after the path without clipping and global-mode marks paint at end-axis without clipping.
- The marker file, lines 240-246: `\pgfplots@markers@mark@handler` calls `\pgfplotsaxisifcontainspoint` whenever axis clipping is enabled. Thus center containment and geometry clipping are separate decisions.

The implementation follows that separation: `renderAxisPlotMarks` performs the data-space center test before projection, while `plotMarkClipOption` attaches a renderer-level rectangular clip only when `clip marker paths=true`.

## References and artifacts

Local third-party renderer: `/Library/TeX/texbin/tikztosvg` (found with `command -v tikztosvg`).

Final artifact root: `outputs/qa/2026-09-05-pgfplots-marker-clipping-after/`.

- MacTeX native PNG: `mactex-png/`
- TikZKit JS SVG/PNG: `tikzkit-svg/`, `tikzkit-png/`
- tikztosvg SVG/PNG: `tikztosvg-svg/`, `tikztosvg-png/`
- 1cm-grid previews: `comparison-grid/`
- Four-way MacTeX/tikztosvg/TikZKit/diff sheets: `diff/*-native-sheet.png`

The physics tikztosvg SVG emits three local rectangular clip paths and direct filled/stroked square paths. TikZKit emits one shared `userSpaceOnUse` rectangular clip definition referenced by the three accepted marks. Neither renderer uses SVG marker elements for these plot marks. Default-marker SVG does not apply the axis rectangle to the accepted mark geometry; line caps/joins and mark fill/stroke remain owned by the direct paths.

## Visual result

- Mathematics/default: before, TikZKit painted five blue circles, including centers at x=-0.2 and x=2.2. MacTeX and tikztosvg paint only the three centers at x=0, 1, and 2. After, TikZKit also paints three; circles centered on x=0 and x=2 remain whole.
- Physics/`clip marker paths=true`: before, TikZKit again painted five complete red squares. After, outside-center squares are absent and the two boundary squares are cut exactly at the left and right plot borders, matching the native topology.
- Algorithm/`clip=false`: before, TikZKit generated seven marks but incorrectly re-sampled the declared domain over 0..2, so no mark appeared outside the frame. After, sampling uses the complete -0.5..2.5 domain and the two outside green triangles remain visible, matching MacTeX and tikztosvg. This control proves the fix does not turn clipping into unconditional filtering or silently rewrite the sampling domain.
- The mathematics canvas narrows from 295px to 274px and the physics canvas from 299px to 276px because the two invalid outside marks no longer expand the paint bounds. Remaining differences are principally font rasterization, label measurement, and several pixels of outer bbox, not marker count or clipping topology.

As auxiliary values only, changed-pixel ratio against tikztosvg moves from 0.1096 to 0.1056 for mathematics, from 0.1153 to 0.1045 for physics, and from 0.1177 to 0.0699 for algorithm. The algorithm canvas width also moves from 273px to the reference width of 330px.

## Command and option audit

Implemented and visually checked in these drivers:

- Document/package shell: `\documentclass`, `\usepackage{pgfplots}`, `\pgfplotsset{compat=1.18}`, `document`, `tikzpicture`, and `axis`.
- Plot commands/data: `\addplot coordinates` and sampled function `\addplot {0.5*x+0.5}` with `domain` and `samples`.
- Axis options: `width`, `height`, `xmin`, `xmax`, `ymin`, `ymax`, `enlargelimits=false`, `grid=major`, `title`, `xlabel`, and `ylabel`.
- Mark options: `only marks`, `mark=*`, `mark=square*`, `mark=triangle*`, `mark size`, named/mixed colors, default `clip=true`, `clip marker paths=true`, and `clip=false`.
- All literal coordinates, dimensions, ranges, and the linear expression are covered by the strict semantic review files beside the fixtures.

Still unimplemented or incomplete in the surrounding native feature family:

- exact `clip mode=global` versus `clip mode=individual` paint ordering across multiple plots and custom layers;
- 3D center containment and projected marker-path clipping;
- `mark=text` geometry clipping and text baseline behavior;
- comb/bar-specialized markers and nonrectangular axis clip paths.

## Verification

- `node --test test/pgfplots-marker-clipping.test.js`
- `npm run case:audit -- test/fixtures/examples/pgfplots/marker-clipping/math.tex --review test/fixtures/examples/pgfplots/marker-clipping/math.review.json --strict`
- the same strict audit for `physics.tex` and `algorithm.tex`
- `node scripts/render-example-fixtures.js --fixtures test/fixtures/examples --output outputs/qa/2026-09-05-pgfplots-marker-clipping-after --only pgfplots-marker-clipping-algorithm --only pgfplots-marker-clipping-math --only pgfplots-marker-clipping-physics --native-reference --comparison-grid=svg --tikztosvg-engine pdflatex --math-renderer svg-text`
- `node scripts/diff-example-pngs.js --output outputs/qa/2026-09-05-pgfplots-marker-clipping-after`

All three fixtures render with zero TikZKit diagnostics and zero MacTeX/tikztosvg failures. The three focused regressions pass. The full suite reports 2211 passing, 132 pre-existing failures, and 14 skipped tests; compared with the clean pre-change baseline, this adds three passing tests without adding a failure.
