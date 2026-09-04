# Legacy Square and Circle Arrow Tips QA

## Scope

- Library: `arrows` (`partial`; 100 registered cases before this slice).
- Accepted slice: the public legacy `square`, `open square`, filled dot `*`, and open dot `o` declarations at marker starts, marker ends, and both ends of horizontal, vertical, orthogonal, and diagonal paths.
- Shared capability: case-sensitive separation from arrows.meta `Square` and `Circle`, active-line-width geometry, declaration-specific reference origins, backend/tip-end shaft shortening, fillstroke versus stroke-only paint, and tangent-aligned SVG transforms.
- Out of scope: spaced aliases, hook, cap, implies, and the remaining legacy arrow families.

This slice was selected because `open square` was not parsed as a named tip, lower-case `square` shared the arrows.meta geometry, `o` fell through to a tiny generic circle, and start markers in mixed sequences were missing or shortened incorrectly.

## Local PGF review

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.code.tex`, especially lines 145-276.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`, especially lines 785-925 and 1096-1102.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-arrows.tex`, especially lines 159-180.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex` and `tikzlibrarypositioning.code.tex` for path-option and fixture positioning behavior.

Implementation findings:

- Filled `square` and `open square` both start from `d=.4pt+.275*linewidth`; the half-height is `4d`.
- Filled `square` spans local x coordinates `d..-7d`, has backend `-7d-.5*linewidth`, and tip end `d+.5*linewidth`.
- `open square` spans local x coordinates `8d..0`, has backend `-.5*linewidth`, and tip end `8d+.5*linewidth`.
- Filled dot `*` and open dot `o` start from `d=.4pt+.2*linewidth`; both use radius `4.5d`.
- Filled `*` centers its circle at `-3d`, has backend `-7.5d-.5*linewidth`, and tip end `1.5d+.5*linewidth`.
- Open `o` centers its circle at `4.5d`, has backend `-.5*linewidth`, and tip end `9d+.5*linewidth`.
- All four declarations reset dashing and use butt caps. Squares explicitly use round joins; circles retain the miter join. Filled forms use fill plus stroke, while open forms use stroke only.
- PGF assembles each tip with logical length `tip end - backend` and shortens the shaft by the terminal tip end. A start marker rotates the same local declaration by 180 degrees.

## Reference renderers

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`.
- SVG rasterizer: `/opt/homebrew/bin/rsvg-convert`.
- MacTeX engine: `/Library/TeX/texbin/pdflatex`.
- Isolated source probes: `/private/tmp/tikzkit-legacy-square-circle-probe.tex` and `/private/tmp/tikzkit-legacy-square-circle-snippet.tex`.
- Probe SVG/PNG: `/private/tmp/tikzkit-legacy-square-circle-probe.svg` and `/private/tmp/tikzkit-legacy-square-circle-probe.png`.
- Native probe PNG: `/private/tmp/tikzkit-legacy-square-circle-native/native.png`.
- TikZKit probe before/after: `/private/tmp/tikzkit-legacy-square-circle-before.svg`, `/private/tmp/tikzkit-legacy-square-circle-before.png`, `/private/tmp/tikzkit-legacy-square-circle-after.svg`, and `/private/tmp/tikzkit-legacy-square-circle-after.png`.
- Before artifacts: `outputs/qa-arrows-legacy-squares-circles-2026-09-04-before/`.
- Final artifacts: `outputs/qa-arrows-legacy-squares-circles-2026-09-04-after/`.
- Each fixture artifact directory contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG, 1cm-grid SVG/PNG, raster diff, and a four-panel native sheet.

At `.8pt`, tikztosvg emits approximately `stroke-width="0.79701"` with butt caps. The filled square is approximately `M .619 2.471 L -4.322 2.471 L -4.322 -2.471 L .619 -2.471 Z`; the open square spans approximately `0..4.943bp`. The filled circle has center near `-1.673bp` and radius `2.512bp`; the open circle has center and radius near `2.511bp`. Tikztosvg converts TeX text into glyph paths, while TikZKit keeps renderer-neutral text and emits transformed SVG paths for the arrow terminals.

The isolated tikztosvg probe produced a valid SVG but returned status 1 because its cleanup step attempted to remove its temporary directory without `-r`. The fixture harness consumed the same local executable successfully for all three cases with zero external-reference failures.

## Visual cases

### `arrows-legacy-squares-circles-flowchart`

Commands and parameters checked:

- Commands/environments: `\documentclass`, `\usepackage`, `\usetikzlibrary`, `document`, `tikzpicture`, four `\node`, and six `\draw` commands.
- Picture options: `node distance=1.5cm`; `stage/.style` with `draw`, `rounded corners=2pt`, `minimum width=2.25cm`, `minimum height=8mm`, and `align=center`.
- Node options: `stage`, mixed fills, `right=of`, and `below=of`.
- Draw options: `.8pt`, colors, `-square`, `-{open square}`, `-*`, `-o`, `{open square}-*`, `o-square`, `--`, `|-`, and inline labels.
- Numeric literals reviewed: the line width, node distances and dimensions, coordinates, corner radius, and all color percentages.

Before: the open square and open circle terminals were absent, the filled square used the smaller arrows.meta shape, the filled dot used fallback placement, and mixed start/end routes had the wrong shaft lengths.

After: all four source-defined terminal shapes are visible. Open and filled paint remain distinct, start markers rotate correctly, orthogonal routes stop before the terminal outlines, and the marker dimensions agree with MacTeX and tikztosvg.

### `arrows-legacy-squares-circles-math`

Commands and parameters checked:

- Twelve command occurrences including named nodes, six draws, scalar labels, and the `document`/`tikzpicture` environments.
- Picture/node options: `node distance`, circular object styling, minimum size, inner separation, and relative positioning.
- Draw options: `.8pt`, six colors, all four legacy square/dot start/end forms, vertical and diagonal paths, and positioned/sloped labels.
- Numeric literals reviewed: 14 values covering dimensions, positions, line width, and color mixes.

Before: open map terminals were missing, the vertical open-square map ended as a bare shaft, filled squares were undersized, and start-dot placement did not match the source declaration.

After: all six maps show the requested terminals at the correct path ends. Vertical and diagonal rotations preserve square/circle shape, and shaft shortening matches the source-derived backend/tip-end extents.

### `arrows-legacy-squares-circles-physics`

Commands and parameters checked:

- Nine command occurrences including axes, six vectors/field paths, an origin marker, and inline vector labels.
- Picture/path options: round line caps for ordinary paths, `.8pt` legacy terminals with declaration-specific cap overrides, colors, `midway`, `above`, `below`, and `sloped`.
- Arrow combinations: filled/open squares and dots at starts, ends, and both ends on horizontal, vertical, and diagonal vectors.
- Numeric literals reviewed: 26 coordinate, dimension, width, and color-mix values.

Before: the green open square and orange open circle were missing or tiny, the filled square was undersized, and double-ended vector shafts reached the wrong local attachment points.

After: each vector exposes the correct square or dot endpoint, open terminals keep white interiors, filled forms use the active path color, and diagonal markers follow their path tangents without shaft bleed-through.

## Validation

- TikZKit, tikztosvg, and MacTeX rendered 3/3 cases; TikZKit diagnostics are empty for all three.
- Strict semantic audit accepted 3/3 cases with zero todos and zero blockers. It reviewed 28 command occurrences, 66 option paths, and 53 numeric semantics across the three fixtures.
- The dedicated implementation test passed 4/4 and covers name separation, exact `.8pt` formulas, paint/cap/join semantics, marker bounds, and final SVG identity for arrows.meta `Square`.
- The related legacy-arrow, options, library-module, and bayesnet suite passed 30/30. Filtered renderer checks passed 3/3, filtered interpreter checks passed 2/2, and the legacy SVG renderer check passed 1/1.
- The complete renderer file passed 179/191. Its 12 existing failures concern text assertions, rich wrapping, ball shading, older endpoint-placement expectations, and arrows.meta open-Stealth options; none exercises this legacy square/dot geometry.
- The native sheets were inspected directly. The accepted visual change is the presence, source dimensions, paint, orientation, and shaft shortening of all four terminal families; diff scores are supporting evidence only.
- Flowchart mean absolute diff improved from `0.0165946` to `0.0158293`; physics improved from `0.0107687` to `0.00923169`.
- Math changed from `0.0214616` to `0.0214927`. The tiny metric increase is antialiasing from the newly present marker pixels; direct inspection shows the missing endpoints are repaired and aligned with both references.

## Remaining work

- Implement legacy hook, cap, implies, and spaced-arrow declarations as separate source-bounded slices.
- Keep text macro coverage such as `\subseteq`, general font rasterization, and one-pixel bbox calibration separate from arrow-terminal geometry.
- Continue using flowchart, mathematics, and physics fixtures for every declaration family rather than relying on isolated synthetic paths alone.
