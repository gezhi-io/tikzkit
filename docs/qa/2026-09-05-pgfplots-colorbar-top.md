# PGFPlots upper horizontal colorbar QA

## Scope

This round implements one bounded PGFPlots family: a horizontal 3D colorbar
placed above its parent axis. The accepted slice covers `parent axis.above
north west`, `parent axis.above north`, and `parent axis.above north east`,
`anchor`, `xshift`/`yshift`, upper-facing ticks and labels, the
`upper`/`top`/`right` aliases, titles, and scientific scale multipliers.

Complete child-axis style grammar, arbitrary named parent anchors, vertical
top/bottom colorbar position semantics, and exact overall 3D projection and
text bounds remain outside this slice.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`
  - Lines 1110-1205 define colorbars as child axes. `colorbar horizontal`
    inherits the parent width, uses a 0.5cm height, and maps point meta along
    its x direction.
  - The low-level colorbar position path selects the top or bottom x-axis
    side. The tick-label position handler maps `left`/`bottom` to the lower
    side and `right`/`top` to the upper side.
  - The parent-axis shape anchors around lines 7540-7660 define `above north`,
    `above north west`, and `above north east` from the parent's outer top and
    inner horizontal coordinate.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplots.doc.src.tar.bz2`
  - `pgfplots.reference.axisdescription.tex` documents orientation before
    `colorbar style`, `every colorbar`, `colorbar shift`, and parent width
    inheritance.
  - `pgfplots.tutorial4.tex` confirms that horizontal colorbars map point meta
    through their x coordinate.

## Commands and parameters

Implemented and exercised here: `\begin{axis}`, `\addplot3[surf]`, `colorbar
horizontal`, `colorbar style`, `at`, `parent axis.above north west`, `parent
axis.above north`, `parent axis.above north east`, `anchor=south west`,
`anchor=south`, `xshift`, `yshift`, `xtick`, `xticklabel pos=upper`,
`xticklabel pos=top`, `xticklabel pos=right`, `title`, `scaled x ticks`,
`width`, `height`, `view`, `domain`, and `y domain`.

Not fully implemented: arbitrary child-axis callbacks and styles, arbitrary
named parent anchors, vertical colorbar top/bottom semantics, and exact
projection/text crop parity.

## Visual drivers

- `pgfplots-colorbar-top-algorithm`: before the fix, TikZKit put `Risk score`
  below the surface and overlapped it with the parent's `Pipeline risk`
  title. It now sits above the plot, with ticks and labels facing upward like
  MacTeX and tikztosvg.
- `pgfplots-colorbar-top-math`: the normalized `(0.5,1.08)` placement now uses
  the upper tick side. The `x^2-y^2` title has its own row instead of colliding
  with the central zero label.
- `pgfplots-colorbar-top-physics`: the bar moves above the energy surface,
  its `1`, `1.5`, and `2` labels face upward, and the `10^4` multiplier remains
  above the right edge without clipping.

All three TikZKit outputs contain the expected bar, frame, tick strokes,
labels, title, and surface with zero diagnostics. Remaining visible
differences are in the broader 3D projection and annotation calibration, not
in the accepted colorbar-side behavior.

## SVG structure

Local tikztosvg emits the colorbar as native PGF path geometry and converts
TeX text to reusable glyph paths under translated groups. The top tick marks
are separate stroked paths; the title, tick labels, and scientific multiplier
remain independent text groups outside the bar frame. TikZKit mirrors that
layering with a horizontal SVG `linearGradient`, a separate frame path,
individual upper tick paths, and semantic SVG text nodes. Neither renderer
uses SVG markers for colorbar ticks.

## Artifacts

The accepted outputs are under
`outputs/qa/2026-09-05-pgfplots-colorbar-top-after/`:

- TikZKit SVG/PNG: `tikzkit-svg/`, `tikzkit-png/`
- tikztosvg SVG/PNG/input: `tikztosvg-svg/`, `tikztosvg-png/`,
  `tikztosvg-input/`
- MacTeX PNG/log: `mactex-png/`, `mactex-log/`
- 1cm-grid panels: `tikzkit-grid-png/`, `tikztosvg-grid-png/`
- registered diffs and four-way sheets: `diff/`

The pre-fix comparison is retained under
`outputs/qa/2026-09-05-pgfplots-colorbar-top-before/`. Commands used:
`/Library/TeX/texbin/tikztosvg`, `/Library/TeX/texbin/pdflatex`, and
`/opt/homebrew/bin/rsvg-convert`.

## Verification

The focused upper-colorbar regression passes 4/4. The three fixture renders
each complete TikZKit, tikztosvg, and MacTeX output with zero diagnostics and
zero external-renderer failures.

The repository-wide suite reports 2432 tests: 2289 pass, 129 fail, and 14 are
skipped. This is the exact preceding failure baseline after adding four new
passing tests; the first failure remains the unrelated missing semantic owner
for `circuitikz-varcap-diodes`. Documentation-link validation passes, and the
rebuilt extension registry contains 77 entries from 636 core cases.

```sh
node --test test/pgfplots-colorbar-top.test.js
node scripts/render-example-fixtures.js --output outputs/qa/2026-09-05-pgfplots-colorbar-top-after --only pgfplots-colorbar-top-algorithm --only pgfplots-colorbar-top-math --only pgfplots-colorbar-top-physics --native-reference --strict-tikztosvg --continue-on-external-failure --tikztosvg-engine pdflatex --math-renderer svg-text
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-05-pgfplots-colorbar-top-after --register --alignment-radius 8
npm test
npm run docs:links
```
