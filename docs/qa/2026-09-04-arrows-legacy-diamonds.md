# Legacy Diamond Arrow Tips QA

## Scope

- Library: `arrows` (`partial`; 97 registered cases before this slice).
- Accepted slice: the public legacy `diamond` and `open diamond` declarations at marker starts, marker ends, and both ends of horizontal, vertical, orthogonal, and diagonal paths.
- Shared capability: case-sensitive separation from arrows.meta `Diamond`, active-line-width geometry, backend/tip-end shaft shortening, fillstroke versus stroke-only paint, and tangent-aligned SVG transforms.
- Out of scope: spaced diamond aliases, square/open square, circle/o, hook, cap, implies, and arbitrary declaration-time TeX arithmetic.

This slice was selected because lower-case `diamond` was incorrectly normalized to arrows.meta Kite, while `open diamond` fell through to the generic arrow path.

## Local PGF review

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.code.tex`, especially lines 186-229.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`, especially lines 785-925 and 1096-1102.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-arrows.tex`, especially lines 159-180.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex` and `tikzlibrarypositioning.code.tex`.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty` and `/usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx`.

Implementation findings:

- Both declarations start from `d=.4pt+.275*linewidth`, so geometry must be recomputed from the active path width.
- Filled `diamond` uses local points `(d,0)`, `(-6d,4d)`, `(-13d,0)`, and `(-6d,-4d)`. Its backend is `-13d-.5*linewidth` and its tip end is `d+.5*linewidth`.
- `open diamond` uses local points `(14d,0)`, `(7d,4d)`, `(0,0)`, and `(7d,-4d)`. Its backend is `-.5*linewidth` and its tip end is `14d+.5*linewidth`.
- Both reset dashing and use a round join. The inherited cap is butt. Filled diamond uses fill plus stroke; open diamond uses stroke only.
- The core computes total assembly length as `tip end - backend` and uses the tip end to shorten the terminal shaft. A start marker rotates the same declaration by 180 degrees; there are no public `diamond reversed` names.

## Reference renderers

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`.
- SVG rasterizer: `/opt/homebrew/bin/rsvg-convert`.
- MacTeX engine: `/Library/TeX/texbin/pdflatex`.
- Isolated source probe: `/private/tmp/tikzkit-legacy-diamond-probe.tex` and `/private/tmp/tikzkit-legacy-diamond-snippet.tex`.
- Probe SVG/PNG: `/private/tmp/tikzkit-legacy-diamond-probe.svg` and `/private/tmp/tikzkit-legacy-diamond-probe.png`.
- Native probe PNG: `/private/tmp/tikzkit-legacy-diamond-native/native.png`.
- Before artifacts: `outputs/qa-arrows-legacy-diamonds-2026-09-04-before/`.
- Final artifacts: `outputs/qa-arrows-legacy-diamonds-2026-09-04-after/`.
- Each artifact directory contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG, 1cm-grid SVG/PNG, raster diffs, and four-panel native sheets.

At `.8pt`, tikztosvg emits `stroke-width="0.79701"`, a butt cap, and a round join for both outlines. The filled terminal is approximately `M .617,0 L -3.707,2.472 L -8.032,0 L -3.707,-2.469 Z`; the open terminal spans approximately `0..8.647bp`. Tikztosvg converts TeX text into glyph paths, while TikZKit preserves renderer-neutral text and emits one translated/rotated SVG path per terminal.

## Visual cases

### `arrows-legacy-diamonds-flowchart`

Commands and parameters checked:

- Commands/environments: `\documentclass`, `\usepackage`, `\usetikzlibrary`, `document`, `tikzpicture`, four `\node`, and four `\draw` commands.
- Picture options: `node distance=1.55cm`; `stage/.style` with `draw`, `rounded corners=2pt`, `minimum width=2.4cm`, `minimum height=8mm`, and `align=center`.
- Node options: `stage`, four mixed fills (`blue!8`, `green!10`, `orange!12`, `red!8`), `right=of`, and `below=of`.
- Draw options: `.8pt`, four colors including `green!50!black`, `-diamond`, `-{open diamond}`, `{diamond}-`, `{open diamond}-{diamond}`, `--`, `|-`, and inline `above`/`left`/`below` labels.
- Numeric literals reviewed: `4pt`, `.8pt`, `1.55cm`, `2.4cm`, `2pt`, `8mm`, and color percentages `8`, `10`, `12`, `50`.

Before: filled tips were Kite approximations and open tips were generic arrowheads; the review route had wrong endpoint shapes and shaft lengths.

After: all four routes show source-shaped filled/open diamonds. Marker-start rotation, orthogonal routing, full-line-width outlines, and endpoint shortening match MacTeX and tikztosvg.

### `arrows-legacy-diamonds-math`

Commands and parameters checked:

- Nine commands including four named circular nodes, five draws, `\eta`, and `\overline`; `document` and `tikzpicture` environments.
- Picture/node options: `node distance=2.6cm`; `object/.style={draw,circle,minimum size=10mm,inner sep=1pt}`; `right=of` and `below=of`.
- Draw options: `.8pt`, five colors, all four legacy diamond start/end combinations, `above`, `below`, `left`, `right`, and `above,sloped`.
- Numeric literals reviewed: `4pt`, `.8pt`, `2.6cm`, `10mm`, `1pt`, and color percentage `50`.

Before: the horizontal, vertical, and diagonal map terminals used two unrelated fallback geometries; start markers did not encode the requested open/filled semantics.

After: open and filled maps remain distinct after 90- and 45-degree rotations. All terminal shafts stop at source-defined extents and the arrows.meta `Diamond` spelling still maps to Kite independently.

### `arrows-legacy-diamonds-physics`

Commands and parameters checked:

- Nine commands including six draws, one fill, `\Delta`, and four `\vec` uses.
- Picture/path options: `line cap=round`, axes with `gray!55` and `->`, a `1.2pt` origin, four `.8pt` vector paths, mixed colors, inline labels, `midway`, `above`, `below`, and `sloped`.
- Arrow combinations: `-diamond`, `-{open diamond}`, `{diamond}-{open diamond}`, and `{open diamond}-` on horizontal and diagonal vectors.
- Numeric coordinates reviewed: `-.4`, `.25`, `0`, `1.25`, `1.35`, `2.7`, `3.05`, `3.7`, `3.8`, and `4.6`, plus `4pt`, `.8pt`, `1.2pt`, `50`, and `55`.

Before: fallback heads had the wrong aspect ratio and shortening, most visibly on the force and momentum-difference vectors.

After: all diagonal tips follow the local tangent and preserve the PGF open/filled outlines. The visible front stroke reaches the requested coordinate without letting the shaft protrude through the marker.

## Validation

- TikZKit, tikztosvg, and MacTeX rendered 3/3 cases; TikZKit diagnostics are empty for all three.
- Strict semantic audit accepted 3/3 cases with zero todos and zero blockers. It reviewed 25 command occurrences, 54 option paths, and 32 numeric semantics across the three fixtures.
- Focused implementation test: 3/3 passed. The related legacy-arrow, options, and library-module suite passed 22/22; the filtered arrows.meta/line-cap renderer checks passed 3/3.
- The complete renderer file passed 179/191. Its 12 existing failures concern text assertions, rich wrapping, ball shading, older endpoint-placement expectations, and arrows.meta open-Stealth options; none exercises legacy diamond geometry.
- The native sheets were inspected directly. The accepted visual change is correct terminal shape, paint, orientation, and shaft shortening; diff scores are secondary.
- As supporting evidence, the math changed-pixel ratio improved from `0.02927` to `0.01823`; the flowchart and physics ratios also improved despite unchanged one-pixel crop and text-raster differences.

## Remaining work

- Implement legacy `square`, `open square`, `*`, and `o` as the next isolated declaration family.
- Then cover hooks, caps, implies, and spaced aliases from the same local source.
- Keep global font rasterization and one-pixel bbox calibration separate from terminal geometry.
