# Legacy Delimiter Arrow Tips QA

## Scope

- Library: `arrows` (partial, 91 registered cases before this slice).
- Accepted slice: square and round bracket tips, `angle 90`, `angle 60`, and `angle 45`, including reversed forms.
- Shared capability: parse multiword/symbolic legacy names, derive geometry from the active path line width, preserve cap/join behavior, and apply the PGF backend/tip-end placement to shaft shortening.
- Out of scope: the remaining legacy triangle, diamond, open-shape, hook, cap, and implies families; arbitrary declaration-time TeX arithmetic and arrow hulls.

This slice was chosen because all delimiter and angle tips were previously parsed as unknown names and disappeared completely. It gives an immediately visible improvement across flow, mathematical, and physical diagrams without hard-coding any case coordinates.

## Local PGF review

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-arrows.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/utilities/pgffor.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx`
- `/usr/local/texlive/2025/texmf-dist/tex/latex/amsmath/amsmath.sty`

Implementation findings:

- Square bracket half-height is `2pt + 1.5*linewidth`; its arm is `(half-height + linewidth)/2`. It uses a butt cap and miter join.
- Round bracket uses the same half-height, one cubic Bezier, and a round cap. Its backend and tip end are asymmetric.
- The angle tips share `d=.3pt+.25*linewidth` but not one generic chevron. Their back/height factors are `5.5d/6d`, `7.29d/4.5d`, and `8.705d/(10 sin 23deg)d` for 90, 60, and 45 degrees respectively.
- `\pgfarrowsdeclarereversed` reuses the source shape with reversed placement. The reversed tip must use `-backend`, not the normal tip end, for terminal placement and shaft shortening.
- The old `\pgfarrowsdeclare` interface is lowered through PGF's current arrow machinery, so the renderer can keep one terminal-tip assembly path.

## Reference renderers

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- SVG rasterizer: `/opt/homebrew/bin/rsvg-convert`
- MacTeX engine: `pdflatex`
- Probe SVG: `/private/tmp/tikzkit-legacy-delimiter-probe.svg`
- Probe PNG: `/private/tmp/tikzkit-legacy-delimiter-probe.png`
- Full QA directory: `outputs/qa-arrows-legacy-delimiters-2026-09-04/`
- Four-way improvement sheet: `outputs/qa-arrows-legacy-delimiters-2026-09-04/legacy-delimiters-improvement-sheet.png`
- Per-case TikZKit SVG/PNG: `outputs/qa-arrows-legacy-delimiters-2026-09-04/tikzkit-svg/` and `tikzkit-png/`
- Per-case tikztosvg SVG/PNG: `outputs/qa-arrows-legacy-delimiters-2026-09-04/tikztosvg-svg/` and `tikztosvg-png/`
- Per-case MacTeX PNG: `outputs/qa-arrows-legacy-delimiters-2026-09-04/mactex-png/`
- Grid and diff sheets: `outputs/qa-arrows-legacy-delimiters-2026-09-04/diff/`

The tikztosvg SVG uses explicit local `<path>` data transformed to each terminal. At `.8pt`, the square bracket arm is about `-1.992bp` with `y=+-3.188bp`; the angle tips use round caps and miter joins, while the square bracket uses butt/miter. Reversed forms mirror the local path and change terminal placement. TikZKit now emits the same structural choices rather than routing these tips through a filled generic arrow marker.

## Visual cases

### `arrows-legacy-delimiters-flowchart`

Commands and parameters exercised:

- `\documentclass[border=4pt]{standalone}`, `\usepackage{tikz}`, `\usetikzlibrary{arrows,positioning}`.
- `tikzpicture`: `node distance=13mm`; named `stage` and `flow` styles.
- `\node`: draw/fill, `rounded corners=2pt`, minimum width/height, alignment, `right=of`, and `below=of`.
- `\draw`: `.8pt` active line width, inline labels, `--`, `-|`, `pos=.25`, and terminal `angle 60`, `angle 45`, `angle 90`, and `square bracket` tips.

Before: all four terminal tips were absent, so flow direction and the audit boundary terminator were visually lost.

After: all tips are present. Square-bracket height and arm length align with both references; the three angle apertures remain visibly distinct and touch the shortened shafts at the same endpoint.

### `arrows-legacy-delimiters-math`

Commands and parameters exercised:

- `\usepackage{amsmath}`, `\foreach`, loop variable substitution, nested scopes, and `yshift`.
- `tikzpicture`: `x=12mm`, `y=9mm`, `line width=.75pt`.
- Double-ended `{square bracket}-{square bracket}`, `{(}-{)}`, and `{angle 45 reversed}-{angle 45}` specifications.
- Tick paths, node anchors, `below=2pt`, `above=5pt`, mixed colors, formulas, decimal and signed coordinates.

Before: the blue closed interval, red open interval, and green two-ended relation were only colored shafts with no endpoint semantics.

After: square and round endpoint orientation agrees with local PGF; reversed left tips and normal right tips use separate backend/tip-end placement. Remaining raster diff is concentrated in formula glyph antialiasing and a one-pixel vertical crop.

### `arrows-legacy-delimiters-physics`

Commands and parameters exercised:

- `tikzpicture[line cap=round]`, `\draw`, `\fill`, rectangle path, circle marker, math-vector labels, and diagonal/vertical paths.
- `.8pt`/`1pt` active widths and square bracket, angle 45, angle 60, angle 90, and angle 60 reversed terminals.
- Named and mixed colors, `above`, `below`, `midway`, and coordinate values including negative decimals.

Before: the force/momentum vectors had no visible arrow terminals and the control-volume dimension lacked its bracket.

After: each vector has its PGF-specific aperture and length. The reversed gravity tip points with the expected mirrored geometry, and the bracket scales independently at `.8pt`. The remaining 2px width/5px height difference is dominated by text and overall bbox; terminal geometry aligns on the comparison grid.

## Validation

- TikZKit, tikztosvg, and MacTeX: 3/3 cases rendered.
- Diagnostics: empty for all three cases.
- Strict semantic audit: 3/3 accepted with zero review todos and zero blockers.
- Focused arrow tests: 12/12 passed.
- Wider selected suite: 293/309 passed. Its 16 failures predate this slice and include the missing `circuitikz-varcap-diodes` manifest owner, an unrelated Bellman-Ford edge-count expectation, and existing text-metric assertions; none involve the new arrow cases.

Diff values are retained only as secondary evidence. The rendered panels were inspected directly: the primary acceptance criterion is that formerly missing endpoint geometry is now visible and source-shaped in all three domains.

## Remaining work

- Implement the next coherent legacy family from the same local source, preferably triangle/open triangle and diamond/open diamond with their source extents and fill behavior.
- Revisit shared text/bbox calibration separately; it should not be folded into arrow geometry.
- Add a dedicated visual fixture for direct `[` and `]` spellings; their normalization and mirrored geometry are already covered by the focused unit test.
