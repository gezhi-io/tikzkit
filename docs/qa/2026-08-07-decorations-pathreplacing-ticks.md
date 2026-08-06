# `decorations.pathreplacing`: `ticks` QA

## Scope

This slice implements only the PGF `ticks` path-replacing decoration for
ordinary decorated paths. It accepts `decoration={ticks,...}`, `segment
length`, and `amplitude` over straight, curved, and multi-segment subpaths.
It does not claim `border`, `waves`, `expanding waves`, or `show path
construction`.

The real driver is Case 311, `decorations-pathreplacing-ticks`, based on the
local PGF manual example:

```tex
\begin{tikzpicture}[decoration={ticks,segment length=5mm,amplitude=1.5mm}]
  \draw[help lines] grid (3,2);
  \draw[very thick,red,decorate]
    (0,0) -- (3,1) arc (0:180:1.5 and 1);
\end{tikzpicture}
```

The explicit `5mm` and `1.5mm` values matter: a bare number in a PGF
decoration length is a TeX point, not a centimetre.

## Local PGF Study

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathreplacing.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.pathreplacing.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`, `ticks` section

The source declares a `ticks` state of width `+segment length` which emits
`moveTo(0,+amplitude) -> lineTo(0,-amplitude)` in the current local tangent
frame. The final state runs at the last completed state origin; it does not
move the last tick to the raw path endpoint after a partial final interval.
The shared module defaults are `segment length=10pt` and `amplitude=2.5pt`.

TikZKit therefore flattens each complete input subpath for length sampling,
uses the local normal at each full state origin, emits independent SVG
subpaths, and omits the original path. This preserves continuity across a
line-to-arc boundary rather than restarting at the corner.

## Three-Way Visual QA

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; `rsvg-convert` was
used by the fixture renderer for PNGs. Artifacts are in:

`/private/tmp/tikzkit-qa-pathreplacing-ticks-after-2026-08-07/`

- TikZKit SVG/PNG: `tikzkit-svg/` and `tikzkit-png/`
- tikztosvg SVG/PNG: `tikztosvg-svg/` and `tikztosvg-png/`
- MacTeX native PNG: `mactex-png/`
- grid overlays and four-panel sheet: `tikzkit-grid-png/`,
  `tikztosvg-grid-png/`, and `diff/decorations-pathreplacing-ticks-native-sheet.png`

I inspected the TikZKit, tikztosvg, MacTeX, and native comparison panels.
Before this change, `ticks` fell through to the original continuous red
line/arc. After it, all three renderers show fifteen separate red normal
strokes: seven along the diagonal source line and the remaining strokes
continue at 5mm intervals around the half-ellipse. No original red base path
is painted. The tikztosvg SVG confirms one no-fill, butt-capped red path with
15 `M ... L` subpaths under its standard y-flip transform; TikZKit now emits
the same independent-stroke topology.

The registered TikZKit/tikztosvg comparison has mean absolute RGBA residual
`0.00802`; TikZKit/MacTeX is `0.01525`. The remaining visible residual is
mostly a 5px browser crop reserve and grid/line antialiasing, not a missing
tick or a spacing/orientation error.

## Verification

```sh
node --test --test-name-pattern='normal ticks|brace decoration|snake path morphing' test/interpreter.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-pathreplacing-ticks-after-2026-08-07 \
  --only decorations-pathreplacing-ticks --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-pathreplacing-ticks-after-2026-08-07 \
  --register --alignment-radius 3
```

The focused regression test passes; all three artifact generators succeed
without diagnostics.

## Remaining Work

`ticks` currently samples the interpreter's polyline approximation for cubic
curves, so very high-curvature input retains a small numerical tangent error.
The rest of `decorations.pathreplacing` remains outside this slice.
