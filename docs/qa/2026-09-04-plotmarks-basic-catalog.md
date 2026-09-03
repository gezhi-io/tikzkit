# PGF plotmarks basic catalog QA

## Scope

- Library slice: source-defined basic marks from `asterisk` through `pentagon*` in `pgflibraryplotmarks.code.tex`.
- Accepted parameters: `mark`, `mark size`, starred fill variants, path color, and `mark options={rotate=...}`.
- Both direct TikZ `plot[mark=...]` and PGFPlots `\addplot[mark=...]` use the same geometry.
- Out of scope: text marks, halfdiamond/halfsquare marks, heart, custom plot-mark declarations, and general mark-option transforms.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryplotmarks.code.tex` confirms that the TikZ library is a thin loader for the PGF plotmarks library.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryplotmarks.code.tex:49` defines `asterisk` as three full diameter strokes at 90, 30, and -30 degrees.
- The same file at `:65` defines `star` as five center-to-radius strokes; `:78` defines the 10-pointed form as five full diameter strokes.
- Lines `:91-134` define `oplus(*)` and `otimes(*)` as one circle plus two diameter strokes, with the starred variants using `fillstroke`.
- Lines `:137-194` define the vertical/horizontal bars and the exact square/triangle paths.
- Lines `:200-221` give the diamond a horizontal radius of `0.75 * mark size` and a vertical radius of `mark size`.
- Lines `:227-249` define the five polar pentagon vertices at 90, 18, -54, 234, and 162 degrees.

The important PGF rule is that these marks are not font glyphs and do not use SVG markers. They are ordinary local paths centered at each plot coordinate; a starred name changes the paint action from stroke to fill-and-stroke without changing its geometry.

## Reference artifacts

- Tool: `/Library/TeX/texbin/tikztosvg`; rasterizer: `/opt/homebrew/bin/rsvg-convert`; native engine: `/Library/TeX/texbin/pdflatex`.
- Before: `outputs/qa-plotmarks-basic-catalog-2026-09-04-before/`.
- After: `outputs/qa-plotmarks-basic-catalog-2026-09-04-after/`.
- Four-way panel: `outputs/qa-plotmarks-basic-catalog-2026-09-04-after/diff/plotmarks-basic-catalog-native-sheet.png`.
- Saved SVGs: `tikzkit-svg/plotmarks-basic-catalog.svg` and `tikztosvg-svg/plotmarks-basic-catalog.svg` inside each QA directory.

The tikztosvg SVG agrees with MacTeX. Marks are separate paths with `stroke-linecap="butt"`, `stroke-linejoin="miter"`, a 0.3985bp stroke, and a y-flipping transform. Filled variants use `fill-rule="nonzero"`. At `mark size=7pt`, the emitted diamond has about 6.974bp vertical radius and 5.230bp horizontal radius, confirming the native 0.75 ratio; its star and pentagon paths use the source angles directly.

## Visual result

Before this change, TikZKit silently rendered `asterisk`, both stars, `oplus(*)`, `otimes(*)`, `diamond(*)`, and `pentagon(*)` as the same fallback `x`. The vertical and horizontal bars were the only correct new-catalog entries, and starred marks lost their fill semantics.

After the change, all 13 marks have the same topology, orientation, dimensions, stroke/fill behavior, and source colors as MacTeX and tikztosvg. The rotated filled pentagon also follows the same 18-degree placement. Diagnostics remain at zero. As an auxiliary measure, TikZKit-vs-tikztosvg mean absolute RGBA difference fell from 0.02211 to 0.01744; the remaining 5px canvas-width difference and most changed pixels come from text metrics and raster antialiasing rather than mark geometry.

## Command and parameter audit

| Source item | Status | Implementation |
| --- | --- | --- |
| `\documentclass[border=2pt]{standalone}` | accepted wrapper | document extraction |
| `\usepackage{tikz}` | implemented | core package registry |
| `\usetikzlibrary{plotmarks}` | implemented for this slice | plotmarks library registry |
| `\begin{tikzpicture}[font=\scriptsize]` | implemented | scoped text font |
| `\draw[color,mark size=7pt] plot[...] coordinates {...}` | implemented | path plot evaluator |
| `asterisk`, `star`, `10-pointed star` | implemented | source-angle segment geometry |
| `oplus`, `oplus*`, `otimes`, `otimes*` | implemented | circle plus diameter geometry and fillstroke variants |
| `|`, `-` | implemented | vertical/horizontal segment geometry |
| `diamond`, `diamond*` | implemented | native 0.75 horizontal-radius polygon |
| `pentagon`, `pentagon*` | implemented | native five-angle polygon |
| `mark options={rotate=20|18}` | implemented | local mark rotation |
| `\node[below=9pt]` | implemented | labels used by the comparison catalog |

No command or parameter used by this focused fixture is silently ignored. The remaining plotmarks catalog is listed as partial in the extension registry.

## Verification

```sh
node --test test/plotmarks-basic-catalog.test.js test/pgfplots-csv-overlay.test.js
node scripts/render-example-fixtures.js --only plotmarks-basic-catalog --output outputs/qa-plotmarks-basic-catalog-2026-09-04-after --native-reference --strict-tikztosvg --math-renderer svg-text
node scripts/diff-example-pngs.js --output outputs/qa-plotmarks-basic-catalog-2026-09-04-after
```
