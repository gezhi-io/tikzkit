# PGFPlots colorbar orientations

## Scope and priority

This slice covers 3D `colorbar right`, `colorbar left`, and `colorbar horizontal`. It includes parent-axis sizing, the default shift and anchor, outward ticks and labels, explicit tick lists and titles, and continuous colormap shading. PGFPlots is a high-frequency partial package with 371 observed cases; the registry explicitly listed left and horizontal colorbars as incomplete.

Out of scope are top colorbars, the complete child-axis style grammar, arbitrary tick-label templates and number formatting, non-3D colorbar commands, and general 3D projection or text-bounding-box recalibration.

## Local reference reading

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`, lines 1117-1192: `every colorbar global` creates a child axis with no grid and no enlargement. Right and left colorbars inherit the parent axis height and use a `0.5cm` width; their defaults are a `0.3cm` outward shift with north-west/north-east anchors and labels on the outer side. A horizontal colorbar inherits the parent width, uses the same `0.5cm` thickness, shifts down by `0.3cm`, and uses x ticks.
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

The flowchart fixture has a bottom horizontal load scale, the math fixture has a left bilinear-surface scale, and the physics fixture has a right temperature scale. All three were inspected in four-way native/tikztosvg/TikZKit/diff sheets. Remaining whole-image differences are primarily the existing 3D projected plot box and text crop: the horizontal image is about 11 px wider and 20 px shorter than tikztosvg, the left image is about 46 px narrower, and the right image is within 4 px width and 3 px height. The colorbar placement itself is visibly aligned; these remaining bounds are not claimed by this slice.

## Accepted syntax

Commands and environments exercised: `\\documentclass`, `\\usepackage`, `\\pgfplotsset`, `\\begin`, `\\end`, `\\addplot3`, `document`, `tikzpicture`, and `axis`.

Options exercised: `width`, `height`, `view`, `domain`, `y domain`, `samples`, `xlabel`, `ylabel`, `zlabel`, `title`, `grid`, `surf`, `colorbar right`, `colorbar left`, `colorbar horizontal`, and `colorbar style` with `xtick`, `ytick`, and `title`.

Expressions exercised: `x+2*y`, `x*y`, and `x*x+y*y`.

Not covered: arbitrary named parent-axis coordinates beyond the focused normalized numeric `at` subset, top colorbars, complete colorbar child-axis styling, advanced tick-label formatting, general non-3D colorbars, and exact overall 3D projection/text bounds.

## Verification

- Focused colorbar and renderer tests: 13 passed.
- Strict semantic audits: all three fixtures accepted.
- Fixture rendering: all three produced TikZKit SVG/PNG, tikztosvg SVG/PNG, and MacTeX PNG with zero TikZKit diagnostics.
- The batch renderer still reports 37 unrelated historical fixtures without a local tikztosvg reference; none belongs to this slice.

Acceptance: passed for the stated colorbar orientation family.
