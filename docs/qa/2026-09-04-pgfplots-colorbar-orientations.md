# PGFPlots colorbar orientations

## Scope and priority

This slice covers 3D `colorbar right`, `colorbar left`, and `colorbar horizontal`. It includes parent-axis sizing, parent-description bounds, the default shift and anchor, outward ticks and labels, explicit tick lists and titles, and continuous colormap shading. PGFPlots is a high-frequency partial package; the registry explicitly listed left and horizontal colorbars as incomplete.

Out of scope are top colorbars, the complete child-axis style grammar, arbitrary tick-label templates and number formatting, non-3D colorbar commands, and general 3D projection or text-bounding-box recalibration.

## Local reference reading

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`, colorbar defaults and axis-shape anchors: `every colorbar global` creates a child axis with no grid and no enlargement. Right and left colorbars inherit the parent axis height and use a `0.5cm` width; their defaults are a `0.3cm` outward shift with north-west/north-east anchors and labels on the outer side. A horizontal colorbar inherits the parent width, uses the same `0.5cm` thickness, shifts down by `0.3cm`, and uses x ticks. The `parent axis.right of north east`, `left of north west`, and `below south west` anchors take the outward coordinate from the parent axis outer bounding box, while the parallel coordinate and inherited width/height come from the inner axis-description rectangle.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.scaling.code.tex`, explicit axis sizing: PGFPlots subtracts the axis-description reserve before the final plot transform unless `scale only axis` is active, so projected plot bounds and the parent axis outer bounds are deliberately distinct.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplots.pdf`, colorbar section: a horizontal colorbar uses the active colormap and is configured as an axis description below its parent.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgfplots/pgfplots.sty`: confirms the package bootstrap and generic source loading used by the local MacTeX installation.

## Third-party SVG reference

Local `tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. PNG conversion used `/opt/homebrew/bin/rsvg-convert`; native references used `/Library/TeX/texbin/pdflatex` and `/opt/homebrew/bin/pdftocairo`.

The local `tikztosvg` output uses one `linearGradient` with `gradientUnits=userSpaceOnUse`, many color stops, and a single filled colorbar path. Frame and tick paths use butt caps and miter joins. Horizontal output points the gradient along x; vertical output applies the corresponding y-oriented transform. TikZKit now follows the same structure with one 17-stop SVG gradient, one rectangular fill path, butt caps, and miter joins instead of 64 adjacent fill rectangles.

Artifacts:

- `test/fixtures/examples/output/tikztosvg-svg/pgfplots-colorbar-flowchart.svg`
- `test/fixtures/examples/output/tikztosvg-svg/pgfplots-colorbar-math.svg`
- `test/fixtures/examples/output/tikztosvg-svg/pgfplots-colorbar-physics.svg`
- `test/fixtures/examples/output/mactex-png/pgfplots-colorbar-*.png`
- `test/fixtures/examples/output/tikzkit-svg/pgfplots-colorbar-*.svg`
- `test/fixtures/examples/output/tikzkit-png/pgfplots-colorbar-*.png`
- `test/fixtures/examples/output/diff/pgfplots-colorbar-*-native-sheet.png`

## Visual result

Before this slice, left and horizontal requests produced no colorbar. The first implementation used adjacent solid rectangles and showed visible white seams. The final rendering has a continuous blue-yellow-orange-red ramp with the correct numeric direction. All three bars are outside the parent axis, inherit the intended parent dimension, show a border, put ticks and labels on the outer edge, and retain their title.

The flowchart fixture has a bottom horizontal load scale, the math fixture has a left bilinear-surface scale, and the physics fixture has a right temperature scale. All three were inspected in four-way native/tikztosvg/TikZKit/diff sheets. Before the parent-bound correction, every bar used only a fixed `0.3cm` gap from the projected plot rectangle, producing an 8.50pt gap in all three cases. The corrected browser gaps are 31.21pt below, 43.45pt left, and 17.22pt right, compared with native/tikztosvg gaps of 28.04pt, 42.18pt, and 18.76pt. The horizontal bar now clears the Stage/Queue/Low-to-high descriptions, the left bar clears z ticks and labels, and the right bar sits beyond its parent description instead of crowding it.

Residual placement error is about 3.17pt below, 1.27pt left, and 1.54pt right. The remaining differences come from existing 3D tick-label metrics and description bounds; those are visible but do not undo the corrected parent-axis relationship and are not claimed by this slice.

## Accepted syntax

Commands and environments exercised: `\\documentclass`, `\\usepackage`, `\\pgfplotsset`, `\\begin`, `\\end`, `\\addplot3`, `document`, `tikzpicture`, and `axis`.

Options exercised: `width`, `height`, `view`, `domain`, `y domain`, `samples`, `xlabel`, `ylabel`, `zlabel`, `title`, `grid`, `surf`, `colorbar right`, `colorbar left`, `colorbar horizontal`, and `colorbar style` with `xtick`, `ytick`, and `title`.

Expressions exercised: `x+2*y`, `x*y`, and `x*x+y*y`.

Not covered: arbitrary named parent-axis coordinates beyond the default special anchors and focused normalized numeric `at` subset, top colorbars, complete colorbar child-axis styling, advanced tick-label formatting, general non-3D colorbars, and exact overall 3D projection/text bounds.

## Verification

- Focused colorbar and renderer tests: 13 passed.
- Strict semantic audits: all three fixtures accepted.
- Fixture rendering: all three produced TikZKit SVG/PNG, tikztosvg SVG/PNG, and MacTeX PNG with zero TikZKit diagnostics.
- The batch renderer still reports 37 unrelated historical fixtures without a local tikztosvg reference; none belongs to this slice.
- Full suite: 2,211 tests. The sandbox run reported 2,065 passed, 132 failed, and 14 skipped; five failures were only `listen EPERM` from the sandbox. The isolated workbench server suite passed 5/5 with localhost binding enabled, leaving the existing effective baseline of 2,070 passed, 127 failed, and 14 skipped. No new failure belongs to this slice.

Acceptance: passed for the stated colorbar orientation family.
