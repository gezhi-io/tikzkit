# PGFPlots 3D logarithmic z axes

## Scope and priority

This slice extends the high-frequency partial `pgfplots` package with 3D logarithmic z-axis semantics. It covers `zmode=log`, numeric `log basis z`, positive-only z range survey, logarithmic z projection, power-form major ticks, major/minor z grids, filtering of non-positive plot samples, transformed surface depth, and transformed default surface color data.

Three real fixtures exercise an algorithmic power-of-two sequence, the mathematical surface `10^(x+y)`, and a physical exponential-decay intensity surface. Out of scope are arbitrary TeX tick-label templates, symbolic or nonnumeric log bases, complete x/y/z logarithmic shader combinations, and the full PGFPlots point-meta pipeline.

## Local reference reading

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`: `xmode`, `ymode`, and `zmode` are independent coordinate-math choices. `log basis z` is also exposed as `log base z`; the default z mode is linear and the default log tick target is controlled by `try min ticks log=3`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotscoordprocessing.code.tex`: coordinate math is selected per axis. Positive logarithmic values are transformed before range normalization, while non-positive values become unbounded and must not contribute to survey or paint.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsticks.code.tex`: logarithmic ticks are planned in exponent space. Base-ten minor ticks use factors 2 through 9 inside a decade. A local native check for base two over `1:64` produced `2^0`, `2^2`, `2^4`, and `2^6`.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplots.doc.src.tar.bz2`, `pgfplots.reference.tickoptions.tex`: a custom log basis changes both coordinate transformation and power-label presentation; scaled tick multipliers are disabled on logarithmic axes.

## Third-party SVG reference

Local `tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. PNG conversion used `/opt/homebrew/bin/rsvg-convert`; native references used `/Library/TeX/texbin/pdflatex`.

The inspected `tikztosvg` SVGs use clipped path geometry, glyph paths referenced with `<use>`, matrix transforms with y inversion, butt caps, miter joins, and TeX-computed view boxes. TikZKit uses browser `<text>` and `<tspan>` elements with bundled Computer Modern fonts and an engine-unit `viewBox`, but its path vertices, logarithmic z heights, grid levels, and color progression now follow the native structure.

Before and after artifacts are under:

- `outputs/qa/2026-09-05-pgfplots-zlog-axes-before/`
- `outputs/qa/2026-09-05-pgfplots-zlog-axes-after/`

The final directory contains `tikzkit-svg/`, `tikzkit-png/`, `tikztosvg-svg/`, `tikztosvg-png/`, `mactex-png/`, `diff-png/`, four-way sheets in `diff/`, grid overlays, `index.html`, and JSON summaries.

## Visual result

The algorithm fixture previously compressed the power sequence near the floor and bent it like an exponential curve. It also allowed z=0 to influence the logarithmic plot. It now rejects the invalid point, projects `1,2,4,8,16` at equal z intervals, draws a straight power sequence, and labels the native base-two phase as `2^0`, `2^2`, and `2^4`.

The mathematical fixture previously rendered `10^(x+y)` as a steep exponential wall. It is now a plane in log-z space, with equal-height decades, matching z-grid levels, and a blue-to-red surface progression distributed over the transformed range rather than compressed at the low end.

The physics fixture previously appeared as a narrow spike because raw linear z values controlled both height and default color. It now forms the broad logarithmic dome shown by MacTeX and tikztosvg; mesh depth and default colors both follow transformed z.

All three native/tikztosvg/TikZKit/diff sheets were inspected. Remaining differences are the existing 3D camera footprint, browser text versus TeX glyph outlines, outer whitespace, and mesh antialiasing. They do not change the accepted z-log range, projection, tick, grid, filtering, depth, or default-color semantics.

## Accepted syntax

Commands exercised: `\\documentclass`, `\\usepackage`, `\\pgfplotsset`, `\\begin`, `\\end`, and `\\addplot3`.

Environments exercised: `document`, `tikzpicture`, and `axis`.

Axis options exercised: `width`, `height`, `view`, `xmin`, `xmax`, `ymin`, `ymax`, `domain`, `y domain`, `samples`, `zmin`, `zmax`, `zmode=log`, `log basis z=2`, `grid=major`, `grid=both`, `xlabel`, `ylabel`, and `zlabel`.

Plot options and data exercised: `surf`, `blue`, `very thick`, `mark=*`, explicit 3D coordinates, `10^(x+y)`, `1000*exp(-(x*x+y*y))`, values below one, powers of two, powers of ten, and one deliberately invalid z=0 coordinate.

Every command, environment, option, expression, dependency, and numeric literal is recorded in the accepted semantic audits:

- `docs/qa/2026-09-05-pgfplots-zlog-algorithm-audit.md`
- `docs/qa/2026-09-05-pgfplots-zlog-math-audit.md`
- `docs/qa/2026-09-05-pgfplots-zlog-physics-audit.md`

Not covered: arbitrary `zticklabel` TeX templates, symbolic bases, complete custom minor-log subdivisions, explicit point-meta transformations, and mixed logarithmic x/y/z surface shader parity.

## Verification

- Focused 2D/3D logarithmic-axis tests: 11 passed.
- Existing PGFPlots 3D log seam test: passed.
- Strict semantic audits: all three fixtures accepted.
- Fixture rendering: all three produced TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG, diff PNG, grid overlays, and four-way sheets with zero TikZKit diagnostics and zero external-reference failures.
- Full gallery audit: 549 of 549 fixtures rendered with zero diagnostics.
- The wider selected PGFPlots batch has 307 of 350 passing assertions; its 43 existing failures are unrelated stale or unsupported visual expectations, so package-wide test parity is not claimed.

Acceptance: passed for the stated PGFPlots 3D z-log family.
