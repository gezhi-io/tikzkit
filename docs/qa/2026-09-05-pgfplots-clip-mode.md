# PGFPlots 2D clip mode for axis overlays QA (2026-09-05)

## Slice and boundary

This pass implements one bounded PGFPlots family: rectangular clipping of ordinary 2D `\\draw`, `\\path`, `\\fill`, and `\\filldraw` statements inside an `axis`. Default and explicit `clip mode=global` apply the axis rectangle to the complete overlay path. `clip mode=individual` leaves ordinary overlays outside the per-plot phase unclipped, and `clip=false` disables the global clip.

The slice excludes nodes, 3D and nonrectangular clip paths, arbitrary custom layers, and exact source-order interleaving of overlays with stored plot visualization phases. PGFPlots remains `partial`.

The real corpus driver is `test/fixtures/examples/latex-examples/csv-2d-gaussian-multivarate-distributions.tex`, whose `clip mode=individual` overlays three `\\filldraw` circles after two plots. Three focused controls under `test/fixtures/examples/pgfplots/clip-mode/` make the boundary behavior visible.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`, lines 2093-2101: `clip` defaults to true and `clip mode` defaults to `global`; the source itself notes that individual mode applies only to plots, not all graphical elements.
- The same file, lines 9175-9188: global mode installs one axis clip after background and axis preparation, before the remaining axis content is painted.
- The same file, lines 12355-12370: individual mode installs the clip inside each stored plot's visualization scope.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.markers.code.tex`, lines 38-68: marker phases are separately selected as clipped-after-path, individual-after-path-unclipped, or global-end-axis-unclipped. This confirms that path clipping and marker geometry are distinct concerns.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`, lines 1947-1956: `\\draw`, `\\fill`, and `\\filldraw` are aliases for one TikZ path carrying draw/fill actions. A `filldraw` circle must therefore use one shared clip for both paints.

TikZKit now computes the rectangular axis clip once in `src/pgfplots/axisOverlay.js` and injects its internal `tikzkit clip rect` option only into ordinary path commands in default/global mode. The Scene Graph and SVG renderer then own the actual clip definition and reference.

## References and artifacts

Local third-party renderer: `/Library/TeX/texbin/tikztosvg`, found with `command -v tikztosvg`. PNG conversion used `/opt/homebrew/bin/rsvg-convert`.

- Before: `outputs/qa/2026-09-05-pgfplots-clip-mode-before/`
- After: `outputs/qa/2026-09-05-pgfplots-clip-mode-after/`
- MacTeX native PNG: `mactex-png/`
- TikZKit JS SVG/PNG: `tikzkit-svg/`, `tikzkit-png/`
- tikztosvg SVG/PNG: `tikztosvg-svg/`, `tikztosvg-png/`
- 1cm-grid previews: `tikzkit-grid-svg/`, `tikzkit-grid-png/`, `tikztosvg-grid-svg/`, and `tikztosvg-grid-png/`
- MacTeX/tikztosvg/TikZKit/diff sheets: `diff/*-native-sheet.png`

For the global control, TikZKit emits two `userSpaceOnUse` rectangular clip definitions: one for the plot path and one for the ordinary overlay path. Both are referenced by SVG groups. tikztosvg emits a main rectangular plot clip plus small rectangular clip regions produced by the native boundary-circle paint. For the individual control, TikZKit has only the plot clip; neither purple overlay circle carries a clip reference. The references agree on clip topology even though their path decomposition differs.

## Visual result

- Global/default: before, TikZKit painted the complete red circle across the right axis border. MacTeX and tikztosvg show only its in-axis half. After, TikZKit clips both the red fill and stroke at the border, matching the native visible topology. Its outer PNG width also drops from 278px to 274px because the invalid outside half no longer expands paint bounds.
- Individual: the two purple circles centered on the left and right borders remain whole in TikZKit, MacTeX, and tikztosvg. This verifies that the fix is not unconditional clipping.
- `clip=false`: the orange function continues outside the plot frame and the green boundary circle remains whole in all three renderers.
- Real Gaussian corpus case: its red, cyan, and green `filldraw` circles remain unclipped under `clip mode=individual`; the implementation does not regress the existing overlay geometry.
- Remaining visible differences are mainly axis-frame dimensions, font rasterization, and outer bounding boxes, not the clipping behavior accepted in this slice. Pixel-diff values are retained in `diff/summary.json` only as supporting evidence.

## Command and option audit

Implemented and checked in the focused drivers:

- Shell and environments: `\\documentclass`, `\\usepackage{pgfplots}`, `\\pgfplotsset`, `document`, `tikzpicture`, and `axis`.
- Plot and overlay commands: `\\addplot` with coordinates or a sampled function; `\\filldraw` with an `axis cs` center and circle operation.
- Axis options: `width`, `height`, explicit x/y limits, `enlargelimits=false`, `grid=major`, titles, x/y labels, `axis lines=middle`, default/global/individual clip mode, and `clip=false`.
- Plot/path options: domain, samples, named and mixed colors, thickness, stroke/fill colors, and point dimensions.
- Every command, option, expression, coordinate, and numeric literal in the three focused fixtures is covered by its accepted strict review JSON file.

Still incomplete in the surrounding family:

- clipping of `\\node` and node text/shape paint;
- projected 3D and nonrectangular/polar axis clip paths;
- custom layer selection and exact native ordering across multiple stored plots, markers, and interleaved overlay statements;
- arbitrary plot handlers and full `clip bounding box` modes.

## Verification

- `node --test test/pgfplots-clip-mode.test.js test/pgfplots-marker-clipping.test.js`
- strict `npm run case:audit` for `flowchart.tex`, `math.tex`, and `physics.tex` with their matching review files
- `node scripts/render-example-fixtures.js --fixtures test/fixtures/examples --output outputs/qa/2026-09-05-pgfplots-clip-mode-after ... --native-reference --comparison-grid=svg --tikztosvg-engine pdflatex --math-renderer svg-text`
- `node scripts/diff-example-pngs.js --output outputs/qa/2026-09-05-pgfplots-clip-mode-after`

The focused regressions pass, all four visual drivers render with zero TikZKit diagnostics and zero MacTeX/tikztosvg failures, and all three strict semantic audits pass. The final full run reports 2360 tests: 2209 passing, 137 historical failures, and 14 skipped. A same-machine run of the archived pre-change tree reports 2354 tests: 2201 passing, 139 failures, and 14 skipped; the current failure-name set adds no name and removes two documentation-link failures. The suite's pre-existing font/concurrency-sensitive counts can vary between runs, so the named baseline comparison is the regression gate.
