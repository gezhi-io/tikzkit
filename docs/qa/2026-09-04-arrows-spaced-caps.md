# Spaced Legacy Cap Arrow Tips QA

## Scope

- Library: `arrows.spaced` (`partial`).
- Accepted slice: `spaced round cap`, `spaced butt cap`, `spaced triangle 90 cap`, `spaced triangle 90 cap reversed`, `spaced fast cap`, and `spaced fast cap reversed`.
- Shared capability: the invisible `space` component, active-line-width spacing, shaft shortening, start/end parsing, bounds, and tangent-aligned placement on straight, orthogonal, diagonal, and curved paths.
- Out of scope: the other `arrows.spaced` aliases, including `spaced to`, `spaced latex`, `spaced stealth`, non-cap triangle/angle/hook/shape aliases, brackets, and `spaced implies`.

This slice was selected because the ordinary legacy cap paths were already source-derived, but loading `arrows.spaced` did not create the additional PGF separation. TikZKit now composes the shared cap metrics with a source-derived invisible space instead of adding fixture-specific endpoint offsets.

## Local PGF review

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.spaced.code.tex`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.code.tex`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`, especially the combined-arrow machinery and `space` declaration at lines 1244-1251.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-arrows.tex`, especially the legacy and spaced cap lists.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex` and `tikzlibrarypositioning.code.tex`, for path, node, label, bend, and terminal-tangent behavior.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty` and `/usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx`, for library and document-shell behavior.

Implementation findings:

- `arrows.spaced` is a separate library that first loads `arrows`; it is not an option of the base cap declaration.
- Each accepted name is declared with `\pgfarrowsdeclarecombine*{spaced ...}{...}{original}{original}{space}{space}`.
- The starred combine expands to the visible arrow followed by `.space`; the dot fixes the line end after the visible component while the invisible component contributes terminal separation and shaft shortening.
- `space` draws no path. Its backend is `0pt` and its tip end is `0.88pt + 0.3\pgflinewidth`.
- At the fixture line width of `3pt`, the added space is `1.78pt`. At the focused-test width of `2pt`, it is `1.48pt`.
- The visible round, butt, triangle, and fast cap paths, paint rules, and line caps remain identical to their ordinary counterparts. Only placement, terminal placement, and total assembly length gain the invisible space.
- Terminal transforms must use the final tangent. This is observable on the flowchart override route, the mathematical `g` and `k` maps, and the physical `Gamma` trajectory.

## Reference renderers

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`.
- SVG rasterizer: `/opt/homebrew/bin/rsvg-convert`.
- MacTeX engine: `/Library/TeX/texbin/pdflatex`.
- Focused probes: `/private/tmp/tikzkit-spaced-caps-probe.tex` and `/private/tmp/tikzkit-spaced-caps-snippet.tex`.
- Probe artifacts: `/private/tmp/tikzkit-spaced-caps-probe.pdf`, `/private/tmp/tikzkit-spaced-caps-probe.svg`, `/private/tmp/tikzkit-spaced-caps-probe-native.png`, `/private/tmp/tikzkit-spaced-caps-probe-tikztosvg.png`, and `/private/tmp/tikzkit-spaced-caps-probe-tikztosvg-8x.png`.
- Final case artifacts: `outputs/qa-arrows-spaced-caps-2026-09-04-after/`.

The tikztosvg SVGs retain PGF's structure: round and butt tips are separate stroke-only paths with `stroke-linecap="round"` or `"butt"`; triangle and fast tips are nonzero-filled paths; all inherit the active color and terminal transform. At `3pt`, the physical probe uses `stroke-width="2.98883"`. Comparing ordinary and spaced probes shows the same cap geometry shifted inward by about `1.78pt`, matching the installed PGF formula. MacTeX and tikztosvg agree, so TikZKit follows both references.

The standalone tikztosvg probe produced a valid SVG before its known local cleanup warning attempted to remove a temporary directory without recursion. The fixture renderer preserved all three valid SVGs and rasterized them successfully.

## Visual cases

### `arrows-spaced-caps-flowchart`

- Commands/environments: `\documentclass`, `\usepackage`, `\usetikzlibrary`, `document`, `tikzpicture`, five `\node`, and six `\draw` commands.
- Picture/node options: `node distance=1.4cm and 1.9cm`; `stage/.style` with `draw`, `rounded corners=2pt`, `minimum width=2.15cm`, `minimum height=8mm`, and `align=center`; `right=of`, `below=of`, and percentage fills.
- Path options: all six accepted spaced cap names at `line width=3pt`; six colors; `--`, `-|`, and `to[bend right=14]`; labels using `above`, `right`, `below`, and `sloped`.
- Numeric semantics: border `4pt`, distances `1.4cm` and `1.9cm`, node size `2.15cm` by `8mm`, corner radius `2pt`, line width `3pt`, bend `14`, and all color percentages.
- Before: the aliases had no distinct spaced metrics, so the visible caps ended at the unspaced placement.
- After: every cap is separated from its destination by the source-defined `1.78pt`; retry remains orthogonal and override follows the cubic terminal tangent without moving any node.

### `arrows-spaced-caps-math`

- Commands/environments: document shell, `tikzpicture`, four circular `\node` commands, and six `\draw` map commands.
- Picture/node options: `node distance=1.65cm and 2.5cm`; `obj/.style={draw,circle,minimum size=9mm,inner sep=1pt}`; `right=of`, `below=of`, and percentage fills.
- Path options: all six accepted spaced cap names at `line width=3pt`; horizontal, vertical, and curved maps; `bend left=25`, `bend right=23`; labels with `above`, `below`, `left`, `right`, and `sloped`.
- Numeric semantics: border `4pt`, distances `1.65cm` and `2.5cm`, diameter `9mm`, inner separation `1pt`, line width `3pt`, bends `23` and `25`, and all color percentages.
- Before: ordinary cap geometry was reused without the invisible spacing component.
- After: the six maps preserve their cap paint and shape while gaining the same PGF-derived gap along horizontal, vertical, and curved terminal tangents.

### `arrows-spaced-caps-physics`

- Commands/environments: document shell, `tikzpicture`, eight `\draw` commands, one `\fill`, a circular origin marker, and vector/math labels.
- Path options: gray axes; all six accepted spaced cap names at `line width=3pt`; six colors; one `to[bend left=19]`; terminal labels using `above right`, `above left`, `below left`, `below right`, and `right`.
- Numeric semantics: border `4pt`, origin radius `2pt`, bend `19`, all axis/vector coordinates, line width `3pt`, and color percentages.
- Before: cap shapes could be drawn, but their positions matched ordinary caps and therefore lost the defining space.
- After: diagonal force/vector caps, the horizontal fast cap, and the curved reversed-fast trajectory all use source-derived inward placement while preserving the axes and origin.

## Visual result

- All three four-panel native sheets were inspected directly: TikZKit, tikztosvg, MacTeX, and raster difference.
- The visible improvement is the consistent cap-to-target separation and corresponding shaft shortening. Straight, vertical, orthogonal, diagonal, start/end, and curved cases retain correct shape and tangent orientation.
- Flowchart route topology, mathematical node placement, physical axes, colors, layers, and labels remain intact.
- Remaining differences are browser text glyph metrics, antialiasing, and overall raster dimensions of 1-4 pixels rather than missing or misplaced cap geometry.
- Auxiliary TikZKit-to-tikztosvg mean absolute RGBA values are `0.032594` for flowchart, `0.046912` for math, and `0.028639` for physics. They are supporting evidence only; direct geometry inspection is the acceptance criterion.

## Validation

- TikZKit, tikztosvg, and MacTeX rendered 3/3 cases; TikZKit diagnostics are empty for all three.
- Focused tests verify all six canonical names, start/end parsing, the exact `0.88pt + 0.3*linewidth` formula, `2pt` placement/assembly values, and equality of base/spaced cap paths and paint.
- Strict semantic review covers every dependency, command, environment, option, and numeric literal in all three fixtures.
- All arrow test files pass 30/30; shared options/library tests pass 12/12; semantic-audit tests pass 14/14.
- Browser acceptance reports `accepted` and zero diagnostics for all three cases after the server reloads the new library module.
- The complete renderer file remains at its pre-existing 179/191 baseline. Its 12 failures are unchanged text, shading, general endpoint-placement, and arrows.meta assertions; this slice adds no renderer regression.
- `npm pack --dry-run --json` succeeds with 446 package entries, including both the canonical and compatibility `arrows.spaced` modules. `git diff --check` is clean.

## Remaining work

- Apply the same sequence-composition abstraction to the non-cap aliases in `arrows.spaced`.
- Implement base legacy tips such as `implies` before accepting their spaced forms.
- Keep browser font/bbox calibration separate from arrow sequence geometry.
