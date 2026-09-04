# PGFPlots 2D logarithmic axes

## Scope and priority

This slice covers the high-frequency partial `pgfplots` package's 2D logarithmic axis family: `semilogxaxis`, `semilogyaxis`, `loglogaxis`, equivalent `xmode=log` and `ymode=log` options, numeric `log basis x` and `log basis y`, logarithmic coordinate transforms, power-form major labels, base-ten minor ticks and grids, and rejection of non-positive logarithmic coordinates.

Three focused examples exercise algorithmic runtime, a mathematical power law, and a base-two physical energy sequence. Out of scope are 3D logarithmic-axis parity, arbitrary TeX tick-label templates, symbolic or nonnumeric custom bases, and complete PGF number-format hooks.

## Local reference reading

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`: the four axis environments install linear/log mode pairs; an empty log basis displays powers of ten, while a numeric basis changes both coordinate conversion and the displayed power base. The default logarithmic label is a base raised to an exponent.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsticks.code.tex`: automatic logarithmic major ticks are planned in exponent space, with `try min ticks log=3`; sparse power ticks are centered within the exponent interval. Base-ten minor ticks use factors 2 through 9 inside each decade.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotscoordprocessing.code.tex`: the default internal transform uses the natural logarithm; a custom basis divides by `ln(base)`, and the inverse transform raises the basis to the transformed coordinate. Non-positive logarithmic coordinates are invalid.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplots.doc.src.tar.bz2`, `pgfplots.reference.tickoptions.tex`: ordinary log ticks appear at powers and a wider exponent step is selected when too many powers would be visible. Tick scaling is not applied to logarithmic labels.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplotsexample.tex`: real `loglogaxis` examples confirm the environment-level defaults and power-label presentation.

## Third-party SVG reference

Local `tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. PNG conversion used `/opt/homebrew/bin/rsvg-convert`; native references used `/Library/TeX/texbin/pdflatex`.

The inspected `tikztosvg` SVGs use clipped path geometry, glyph paths referenced through `<use>` rather than SVG `<text>`, matrix transforms with a y-axis inversion, butt line caps, miter joins, and nonzero fill rules for filled plot marks. MacTeX and tikztosvg are visually nearly identical, so both were used as the target. TikZKit retains browser text nodes but follows their transformed path positions, tick phases, stroke geometry, and plot-mark placement.

Artifacts are under `outputs/qa/2026-09-05-pgfplots-log-axes-final/`:

- `tikzkit-svg/` and `tikzkit-png/`
- `tikztosvg-svg/` and `tikztosvg-png/`
- `mactex-png/`
- `diff-png/`
- `diff/*-native-sheet.png`
- `index.html` and `diff/summary.json`

## Visual result

Before this slice, the algorithm case drew linear `200, 400, ...` x ticks through a logarithmic transform, compressed them into the right side, generated an excessively dense minor grid, and retained a non-positive point artifact. It now has equal-width decades `10^0` through `10^3`, factors 2 through 9 as minor grid lines, and no paint or range contribution from `x=-10`.

The mathematical case previously used linear x/y ticks and grids. It now places every decade at equal distance, draws the `x^2` samples as a straight diagonal in log-log space, uses `10^-2` through `10^2` on x, and follows the native sparse y-label phase `10^-3`, `10^-1`, `10^1`, `10^3`.

The physics case previously emitted linear decimal y labels. It now maps every doubling to equal vertical distance and labels the selected powers as `2^1`, `2^3`, and `2^5`, matching MacTeX and tikztosvg. The line and triangle marks align with the native base-two scale.

All three four-way native/tikztosvg/TikZKit/diff sheets were inspected. Remaining differences are outer whitespace and browser-versus-TeX text rasterization. They do not change the accepted coordinate, tick, grid, line, or mark semantics.

## Accepted syntax

Commands exercised: `\\documentclass`, `\\usepackage`, `\\pgfplotsset`, `\\begin`, `\\end`, `\\addplot`, and `\\addlegendentry`.

Environments exercised: `document`, `tikzpicture`, `semilogxaxis`, `semilogyaxis`, and `loglogaxis`.

Axis options exercised: `width`, `height`, `xmin`, `xmax`, `ymin`, `ymax`, `grid=major`, `grid=both`, `xlabel`, `ylabel`, `legend pos=north west`, and `log basis y=2`.

Plot options exercised: `blue`, `red`, `orange`, `very thick`, `mark=*`, `mark=square*`, and `mark=triangle*`; coordinate data includes decimal values, powers of ten, powers of two, and one deliberately invalid negative log coordinate.

Every command, environment, option, expression, resource, dependency, and numeric literal is recorded in the accepted semantic audits:

- `docs/qa/2026-09-05-pgfplots-log-axis-algorithm-audit.md`
- `docs/qa/2026-09-05-pgfplots-log-axis-math-audit.md`
- `docs/qa/2026-09-05-pgfplots-log-axis-physics-audit.md`

Not covered: 3D logarithmic axes, arbitrary `xticklabel`/`yticklabel` TeX templates, symbolic bases, non-decimal minor-log subdivisions for custom bases, and complete PGF number formatting.

## Verification

- Focused logarithmic-axis, semantic-audit, and clipping tests: 23 passed.
- Existing semilog/loglog documentation and log-metadata regressions: 5 passed.
- Strict semantic audits: all three fixtures accepted.
- Fixture rendering: all three produced TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG, diff PNG, and four-way sheets with zero TikZKit diagnostics and zero external-reference failures.
- Full gallery audit: 546 of 546 fixtures rendered with zero diagnostics.
- The wider selected PGFPlots test batch still contains 38 expectation failures outside this slice, so it is not claimed as a fully green package-wide suite.

Acceptance: passed for the stated 2D logarithmic-axis family.
