# PGFPlots 3D plot box ratio QA

## Scope

This round implements one bounded PGFPlots slice: explicit-width 3D axes using
`plot box ratio`. It covers braced or whitespace-separated triples, numeric
PGF math expressions in all three components, the native fixed 45pt
axis-description reserve, and mathematical-minus typography for default
negative 3D tick labels.

Arbitrary TeX macro side effects in ratio components, `view dir`, the complete
`scale mode` family, custom number-format callbacks, and exact browser glyph
rasterization remain outside this slice.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.scaling.code.tex`
  - Lines 145-168 subtract a fixed 45pt description reserve from an explicit
    width before fitting the plot transform when `scale only axis` is false.
  - Lines 250-353 parse the x/y/z `plot box ratio` components with
    `\pgfmathparse`, then scale the three projected basis vectors.
  - Lines 355-400 fit the resulting projected box to the requested target.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`
  - The default axis tick label calls `\pgfmathprintnumber`; the 3D oriented
    surface selects a near-ticklabel coordinate and anchor for each edge.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsmeshplothandler.code.tex`
  - `mesh` selects the flat matrix handler and strokes the sampled lattice;
    it does not lower this fixture to a filled surface.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplots.pdf`
  - The plot-box-ratio description confirms that the ratio acts on the three
    logical unit vectors before final size fitting.

## Commands and parameters

Implemented and exercised here: `\documentclass[tikz,border=2pt]{standalone}`,
`\usepackage{pgfplots}`, `\pgfplotsset{compat=newest}`, `\begin{tikzpicture}`,
`\begin{axis}`, `width`, `samples`, `mesh`, `no marks`, `view={azimuth}{elevation}`,
`plot box ratio={x}{y}{z}`, numeric PGF math ratio expressions, `\addplot3`, and
the expression `{y}`.

Not fully implemented: arbitrary executable TeX macros or registers inside
ratio components, `view dir`, every `scale mode` compatibility branch, custom
tick-number callbacks, mesh shaders, and exact TeX-to-browser glyph outlines.

## Reference structure

Local `tikztosvg` is `/Library/TeX/texbin/tikztosvg`; PNG conversion uses
`/opt/homebrew/bin/rsvg-convert`, and the native oracle uses
`/Library/TeX/texbin/pdflatex`.

The tikztosvg SVG is 137.269pt by 95.665pt. Its projected black frame spans
96.887pt horizontally, its box and blue mesh use 0.3985pt strokes, tick marks
use 0.19925pt strokes, and negative labels use a separate mathematical-minus
glyph. Mesh cells are closed unfilled quadrilateral paths under a nonzero fill
rule; there are no plot marks or SVG marker arrows. TikZKit keeps semantic SVG
text but now follows the same geometry and minus-glyph width.

## Visual result

Before the fix, TikZKit produced a 175x128px canvas and a projected frame about
98.13pt wide. It was visibly too wide and its negative tick labels used a short
text hyphen, pulling the left/right label bounds inward.

After the fix, TikZKit and both references are 184x128px. The TikZKit SVG is
137.28pt by 95.70pt and its projected frame is 96.89pt wide. The 10x10 blue
mesh, black box edges, tick positions, long negative signs, and outer crop now
line up without registration offset. Remaining visible differences are stroke
antialiasing and browser-versus-TeX glyph rasterization; native MacTeX is also
darker than tikztosvg in those pixels.

## Artifacts

Accepted artifacts are under
`outputs/qa/2026-09-06-pgfplots-plot-box-ratio-3d-after/`:

- TikZKit SVG/PNG and 1cm-grid versions: `tikzkit-svg/`, `tikzkit-png/`,
  `tikzkit-grid-svg/`, and `tikzkit-grid-png/`
- tikztosvg input/SVG/PNG and grid versions: `tikztosvg-input/`,
  `tikztosvg-svg/`, `tikztosvg-png/`, `tikztosvg-grid-svg/`, and
  `tikztosvg-grid-png/`
- MacTeX PNG/log: `mactex-png/` and `mactex-log/`
- Registered differences and comparison sheets: `diff-png/` and `diff/`

The pre-fix evidence is retained under
`outputs/qa/2026-09-06-pgfplots-plot-box-ratio-3d-before/`.

## Verification

The fixture renders with zero diagnostics and zero external-renderer failures.
The registered TikZKit-to-tikztosvg mean RGBA residual decreases from 0.04393
to 0.02843; TikZKit-to-MacTeX decreases from 0.05615 to 0.04141. These values
support the inspected visual result rather than replacing it.

The full focused test file retains its existing 37 unrelated failures: the
clean main baseline is 224 tests with 187 passes, while this change is 227
tests with 190 passes. The three added tests pass and no new failure appears.

```sh
node --test test/pgfplots-seams.test.js
node scripts/render-example-fixtures.js --output outputs/qa/2026-09-06-pgfplots-plot-box-ratio-3d-after --only pgfplots-plot-box-ratio-3d --native-reference --strict-tikztosvg --continue-on-external-failure --tikztosvg-engine pdflatex --math-renderer svg-text
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-06-pgfplots-plot-box-ratio-3d-after --register --alignment-radius 8
npm run extension-registry
npm run docs:links
```
