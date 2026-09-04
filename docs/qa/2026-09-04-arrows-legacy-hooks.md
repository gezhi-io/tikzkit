# Legacy Hook Arrow Tips QA

## Scope

- Library: `arrows` (`partial`; 106 registered cases after this slice).
- Accepted slice: the six public legacy names `left hook`, `left hook reversed`, `right hook`, `right hook reversed`, `hooks`, and `hooks reversed`.
- Shared capability: active-line-width cubic geometry, side selection, x-only reversal, double hooks, backend/tip-end shortening, start/end parsing, and tangent-aligned placement on straight, orthogonal, and curved paths.
- Out of scope: `spaced ...` aliases, caps, implies, arbitrary `\pgfarrowsdeclare` bodies, and arrows.meta `Hook` parameters.

This slice was selected because all six names previously collapsed to the generic one-sided arrows.meta hook. That removed right-side and double-hook semantics and made every reversed declaration point the wrong way.

## Local PGF review

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.code.tex`, especially lines 682-756.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`, especially lines 1080-1102.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-arrows.tex`, especially the barbed and partial arrow listings around lines 98-99 and 200-202.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex` and `tikzlibrarypositioning.code.tex` for path, style, label, and node placement order.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty` and `/usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx` for package and document-shell behavior.

Implementation findings:

- Every legacy hook recomputes `d=.4pt+.2*linewidth` from the active path width.
- Backend is `-.5*linewidth`; tip end is `3.75d+.5*linewidth`; assembly length is their difference.
- One branch starts `M 0,0 L .75d,0`, then uses two cubics: `(.75d,0) -> (3.75d,3d)` with controls `(2.415d,0)` and `(3.75d,1.665d)`, followed by `(3.75d,3d) -> (.75d,6d)` with controls `(3.75d,4.665d)` and `(2.415d,6d)`.
- `right hook` negates the branch y coordinates. `hooks` strokes both branches.
- `\pgfarrowsdeclarereversed` reflects x only. It does not exchange left and right.
- The declaration uses `\pgfusepathqstroke`, a round cap, and the inherited miter join. Hook interiors remain unfilled.
- At `.8pt`, `d=.56pt`, backend is `-.4pt`, tip end is `2.5pt`, assembly length is `2.9pt`, maximum path x is `2.10pt`, and one lobe is `3.36pt` high.

## Reference renderers

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`.
- SVG rasterizer: `/opt/homebrew/bin/rsvg-convert`.
- MacTeX engine: `/Library/TeX/texbin/pdflatex`.
- Isolated probe source: `/private/tmp/tikzkit-legacy-hooks-probe.tex` and `/private/tmp/tikzkit-legacy-hooks-snippet.tex`.
- Probe artifacts: `/private/tmp/tikzkit-legacy-hooks-probe.pdf`, `/private/tmp/tikzkit-legacy-hooks-probe.svg`, and `/private/tmp/tikzkit-legacy-hooks-probe-native.png`.
- Before artifacts: `outputs/qa-arrows-legacy-hooks-2026-09-04-before/`.
- Final artifacts: `outputs/qa-arrows-legacy-hooks-2026-09-04-after/`.
- Each QA directory contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG, 1cm-grid variants, raster diffs, summaries, and four-panel native sheets.

The tikztosvg probe emits unfilled paths with `stroke-width="0.79701"`, `stroke-linecap="round"`, and `stroke-linejoin="miter"`. Its path data agrees with the source-derived cubic constants and uses transform matrices for path tangent placement. Reversed declarations have negative local x coordinates while retaining the selected y side. MacTeX and tikztosvg agree on all six geometries; TikZKit now emits equivalent SVG paths while retaining renderer-neutral text rather than converting glyphs to paths.

The standalone `tikztosvg` probe produced its SVG before exiting with its local cleanup error (`rm` attempted to remove a temporary directory without `-r`). The fixture renderer preserved all three valid tikztosvg SVG/PNG references, so this tool-side cleanup issue did not block comparison.

## Visual cases

### `arrows-legacy-hooks-flowchart`

Commands and parameters checked:

- Commands/environments: `\documentclass`, `\usepackage`, `\usetikzlibrary`, `document`, `tikzpicture`, five `\node`, and six `\draw` commands.
- Picture options: two-axis `node distance=1.35cm and 1.75cm`; `stage/.style` with `draw`, `rounded corners=2pt`, `minimum width=2.1cm`, `minimum height=8mm`, and `align=center`.
- Node options: `stage`, mixed percentage fills, `right=of`, and `below=of`.
- Draw options: `.8pt`, all six hook names, six colors, `--`, `-|`, `to[bend right=13]`, and inline `above`, `right`, `below`, and `sloped` labels.
- Numeric semantics: `4pt`, `.8pt`, `1.35cm`, `1.75cm`, `2.1cm`, `2pt`, `8mm`, bend `13`, and all color mix percentages.

Before: read, accept, and commit all had the same single upper hook; reversed retry routes were not reversed; commit and manual routes lost their second lobe.

After: read and accept use opposite sides, commit has both lobes, reject/repeat reflect x only, and the curved manual route carries the double reversed geometry along its endpoint tangent. The surrounding node and routing layout is unchanged.

### `arrows-legacy-hooks-math`

Commands and parameters checked:

- Commands/environments: document shell, `tikzpicture`, four circular `\node` commands, and six map `\draw` commands.
- Picture/node options: two-axis `node distance=1.6cm and 2.35cm`; `obj/.style={draw,circle,minimum size=9mm,inner sep=1pt}`; `right=of` and `below=of`.
- Draw options: `.8pt`, all six hook names, straight/vertical/curved maps, `bend left=24`, `bend right=22`, and math labels using `above`, `below`, `left`, `right`, and `sloped`.
- Numeric semantics: `4pt`, `.8pt`, `1.6cm`, `2.35cm`, `9mm`, `1pt`, bends `22` and `24`, and color percentages.

Before: `f`, `g`, `p`, `q`, `h`, and `k` differed only in color and path direction; the requested side, reversal, and double-lobe distinctions were absent.

After: all six maps remain visually distinct after horizontal, vertical, and curved tangent transforms. The curved `k` tip matches MacTeX orientation and the arrows.meta capitalized `Hook` remains a separate generic family.

### `arrows-legacy-hooks-physics`

Commands and parameters checked:

- Commands/environments: document shell, `tikzpicture`, eight `\draw` commands, one `\fill`, one circular origin marker, and vector/math text.
- Picture/path options: shared `line width=.8pt`, all six hook names, gray axes, six colors, `to[bend left=18]`, and terminal labels using `above right`, `above left`, `below left`, `below right`, and `right`.
- Numeric semantics: border `4pt`, width `.8pt`, origin radius `2pt`, bend `18`, all vector endpoints, and color mix percentages.

Before: every force, momentum, energy, displacement, and curved trajectory endpoint used one generic upper hook. Right hooks, reversals, and paired hooks were missing.

After: vector directions preserve the requested side and reversal on every diagonal. The momentum and curved trajectory tips contain both lobes, and all six shafts stop at the source-defined terminal extent.

## Visual result

- All three native sheets were inspected directly in four-panel form: MacTeX, tikztosvg, TikZKit, and diff.
- The accepted improvement is visible geometry, not merely a score change: six previously collapsed terminals are now six distinct source-defined shapes with correct paint, orientation, tangent, and shaft shortening.
- Remaining visible differences are concentrated in browser text glyph metrics, antialiasing, and small node-border raster differences rather than missing or misplaced hook geometry.
- Auxiliary mean absolute diff improved from `0.016827` to `0.016597` for the flowchart, `0.019627` to `0.018389` for math, and `0.010675` to `0.010542` for physics.

## Validation

- TikZKit, tikztosvg, and MacTeX rendered 3/3 cases; TikZKit diagnostics are empty for all three.
- Focused hook implementation tests pass 3/3; all arrow test files pass 24/24; the filtered tikz-cd hook regression passes 1/1.
- The complete renderer file remains at 179/191. Its 12 existing failures are unrelated text, rich wrapping, shading, older endpoint-placement, and arrows.meta open-Stealth assertions; this slice adds no renderer regression.
- Strict semantic review accepts the commands, environments, options, dependencies, and numeric literals in all three fixtures with no todos or blockers.
- SVG structure assertions verify eight legacy-hook marker paths, exact cubic commands, stroke-only paint, round caps, miter joins, side signs, reversal signs, and start/end parsing.

## Remaining work

- Implement the `spaced left hook`, `spaced right hook`, and spaced double-hook aliases as a separate spacing slice.
- Continue with legacy caps and implies declarations from the same local source.
- Keep global browser font/bbox calibration separate from arrow geometry so arrow regressions stay diagnosable.
