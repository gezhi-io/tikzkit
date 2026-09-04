# Legacy Triangle Arrow Tips QA

## Scope

- Library: `arrows` (`partial`; 94 registered cases before this slice).
- Accepted slice: `triangle 90`, `triangle 60`, `triangle 45`, `open triangle 90`, `open triangle 60`, and `open triangle 45`, including every `reversed` spelling (12 public names).
- Shared capability: numbered multiword tip parsing, active-line-width geometry, PGF backend/tip-end shaft shortening, source paint semantics, and rotation onto horizontal, vertical, orthogonal, and diagonal paths.
- Out of scope: legacy diamond/open diamond, hook, cap, implies, spaced-arrow families, and arbitrary declaration-time TeX arithmetic.

This slice was selected because the three filled tips disappeared and the six open forms fell back to one generic triangle. That removed direction semantics from real flow, mathematical, and physical diagrams.

## Local PGF review

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.code.tex`, especially lines 280-484.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-arrows.tex`, especially lines 33-56.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarypositioning.code.tex`.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx` and `/usr/local/texlive/2025/texmf-dist/tex/latex/amsmath/amsmath.sty`.

Implementation findings:

- Every triangle family starts from `d=.5pt+.25*linewidth`; geometry must therefore be recomputed from the active path width.
- Filled 90/60/45 tips have backend factors `5.5d`, `7.29d`, and `8.705d`; their tip-line corrections are `.707`, `1`, and `1.28` line widths.
- The 60-degree rear points come from radius `9d` at `+-150deg`; the 45-degree rear points come from radius `10d` at `+-157deg`. One generic triangle cannot reproduce these apertures.
- Filled tips close the path and use fill plus stroke. Open tips close the same type of outline but use stroke only. Both use a butt cap and miter join.
- Filled reversed tips are declared with `\pgfarrowsdeclarereversed`. Open reversed tips are independent declarations: their backend factors are `.707`, `1`, and `1.28` line widths and cannot be obtained by only mirroring the forward visible path.
- PGF backend and tip-end values control shaft shortening independently of the path's painted bounds.

## Reference renderers

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`.
- SVG rasterizer: `/opt/homebrew/bin/rsvg-convert`.
- MacTeX engine: `/Library/TeX/texbin/pdflatex`.
- Isolated probe input: `/private/tmp/tikzkit-legacy-triangle-probe.tex`.
- Probe SVG/PNG: `/private/tmp/tikzkit-legacy-triangle-probe.svg` and `/private/tmp/tikzkit-legacy-triangle-probe.png`.
- Before artifacts: `outputs/qa-arrows-legacy-triangles-2026-09-04-before/`.
- Final artifacts: `outputs/qa-arrows-legacy-triangles-2026-09-04/`.
- TikZKit SVG/PNG: `tikzkit-svg/` and `tikzkit-png/` under the final artifact directory.
- tikztosvg SVG/PNG: `tikztosvg-svg/` and `tikztosvg-png/`.
- MacTeX native PNG: `mactex-png/`.
- Grids, raster diffs, and four-panel sheets: `tikzkit-grid-*`, `tikztosvg-grid-*`, `diff-png/`, and `diff/*-native-sheet.png`.

At `.8pt`, tikztosvg emits a `stroke-width` near `0.79701bp` with `stroke-linecap="butt"` and `stroke-linejoin="miter"`. Its open 90-degree tip is approximately `M 0,-4.186 L 4.183,0 L 0,4.185 Z`; open 60 and 45 tips become longer and narrower. Filled tips contain explicit `fill` and `stroke`; text is converted to glyph paths/uses. TikZKit now emits equivalent local paths with a rotation/translation per terminal and preserves text separately.

## Visual cases

### `arrows-legacy-triangles-flowchart`

Commands and parameters checked:

- `\documentclass[border=4pt]{standalone}`, `\usepackage{tikz}`, `\usetikzlibrary{arrows,positioning}`, `document`, and `tikzpicture`.
- Picture options: `node distance=13mm and 16mm`; `task/.style` with `draw`, `rounded corners=2pt`, `minimum width=25mm`, `minimum height=8mm`, and `align=center`; `route/.style={line width=.8pt}`.
- `\node`: named nodes, `fill`, `right=of`, and `below=of`.
- `\draw`: `--`, `-|`, inline `node`, `above`, `right`, `pos=.25`, `dashed`, color mixing, and terminal `triangle 90`, `triangle 60`, `triangle 45`, and `open triangle 60`.

Before: all three filled terminals were missing; the orange retry path used a generic open triangle with the wrong aperture and shortening.

After: the three filled tips are present and distinctly 90/60/45 degrees. The orange open 60-degree tip is narrow, stroke-only, and meets the shortened orthogonal shaft at the same terminal as both references.

### `arrows-legacy-triangles-math`

Commands and parameters checked:

- `\usepackage{amsmath}`, `\node`, `\draw`, and math labels with superscript and composition.
- Picture options: `x=15mm`, `y=10mm`, and `line width=.8pt`.
- Five two-ended paths using filled 90/60/45 and open 90/45 tips, all with reversed start forms.
- Horizontal, vertical, and diagonal paths; `above`, `left`, `below`, `right`, `above right`; named colors, color mixing, and `dashed`.
- Integer and signed coordinates from 0 through 3.

Before: several start/end tips disappeared and the surviving open endpoints used fallback geometry, so inverse and bidirectional map semantics were incomplete.

After: all ten endpoints are visible. Filled tips carry the path color in both fill and stroke; open tips are unfilled; reversed starts use their source placement; and 90/60/45 apertures remain distinct after rotation.

### `arrows-legacy-triangles-physics`

Commands and parameters checked:

- `\draw`, `\fill`, rectangle and circle path operations, inline vector labels, and `tikzpicture[line width=.8pt]`.
- Six diagonal/horizontal vectors using all normal and reversed open triangle 90/60/45 names.
- `fill=gray!12`, mixed blue/red/green colors, `above`/`below`, negative decimal coordinates, and a `1.3pt` origin marker.

Before: all vectors were approximated by the same generic open triangle, so angle family and reverse placement were visibly wrong.

After: each vector has its source aperture and length. The normal and reversed local paths are independently shaped and rotated; the shaft stops at the source-defined tip end instead of running through the head.

## Validation

- TikZKit, tikztosvg, and MacTeX rendered 3/3 cases.
- TikZKit diagnostics are empty for all three cases.
- Strict semantic audit accepted 3/3 cases with zero review todos and zero blockers.
- The native sheets were inspected directly. The visual acceptance is the recovery and correction of terminal geometry, not the aggregate diff score.
- The flowchart changed-pixel ratio improved from `0.08152` to `0.08020`; the math case improved from `0.08957` to `0.08779`. The physics aggregate ratio is essentially flat (`0.09721` to `0.09737`) because text and crop differences dominate, while the six arrowheads visibly changed to the reference-specific geometry.
- Focused arrow suite: 12/12 passed.
- Wider parser/options/renderer/library suite: 296/312 passed. The 16 failures are pre-existing parser-status, package-status, text-metric, and bbox expectations; no legacy-triangle or library-module test failed.

## Remaining work

- Implement legacy diamond/open diamond as the next isolated declaration family.
- Then cover hooks, caps, implies, and spaced-arrow aliases from the same local source.
- Keep text glyph and one-pixel bbox calibration separate from arrow geometry so those shared issues can be measured independently.
