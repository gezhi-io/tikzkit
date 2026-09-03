# Circuitikz independent current-source currarrow QA

## Scope

- Library slice: independent `isource`/`I` style selection plus American and DC internal `currarrow` geometry.
- Accepted parameters: `american currents`, `european currents`, explicit `american current source`/`isourceAM`, explicit `european current source`/`isourceEU`, and `current arrow scale`.
- Out of scope: sinusoidal/cute source interiors, arbitrary source-shape customization, and the remaining Circuitikz catalog.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex:2537` shows `dcisource` using shaft extents `-.7` to `.6` of its radius and translating `currarrow` by `.5` radius.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex:2586` shows the European source as a circle crossed by its full local-y diameter.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex:3332` shows the American source using a `-.7` to `.7` shaft and the same `.5`-radius currarrow placement.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex:3920` maps `current source` and `I` through the active current convention and exposes `isourceAM`/`isourceEU` aliases.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircshapes.tex:413` defines the four-point concave-tail polygon as `(-.7,0)`, `(-.7,-.8)`, `(1,0)`, `(-.7,.8)`, scaled by `Rlen/current arrow scale`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcirc.defines.tex:1140` and `:1258` define the European/American style dispatch; `:1147` sets the arrow-scale default to 16.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex:2922`, `:3111`, and `:3938` document current-source aliases, DC source customization, and the inverse arrow-size rule.

## Reference artifacts

- Tool: `/Library/TeX/texbin/tikztosvg`; rasterizer: `/opt/homebrew/bin/rsvg-convert`; native engine: `/Library/TeX/texbin/pdflatex`.
- Before: `outputs/qa-circuitikz-independent-current-arrows-2026-09-03-before/`.
- After: `outputs/qa-circuitikz-independent-current-arrows-2026-09-03-after/`.
- Four-way panel: `outputs/qa-circuitikz-independent-current-arrows-2026-09-03-after/diff/circuitikz-independent-current-arrows-native-sheet.png`.
- Saved SVGs: `tikzkit-svg/circuitikz-independent-current-arrows.svg` and `tikztosvg-svg/circuitikz-independent-current-arrows.svg` inside each QA directory.

`tikztosvg` agrees with MacTeX: its European source is a circle plus diameter; its American/DC arrows are separate filled paths with miter joins, no SVG marker, and longitudinal spans of about 4.22pt, 8.43pt, and 2.81pt for scales 16, 8, and 24. The SVG uses a transformed path and glyph outlines; TikZKit uses renderer-neutral path commands plus SVG text, but now emits the same source geometry.

## Visual result

Before the change, TikZKit put a large generic LaTeX marker inside every plain current source. The default European source therefore had the wrong symbol, both American arrows ignored `current arrow scale`, and the DC source used a radius-derived triangular head without the native concave tail.

After the change, the default European source has the full vertical diameter seen in both references. The American source has the compact concave-tail arrow, scale 8 visibly doubles its polygon span relative to scale 16, and the DC scale-24 arrow is visibly reduced and remains at the native half-radius offset. All four source labels and leads remain present. Diagnostics stay at zero. As auxiliary measurements, TikZKit-vs-MacTeX changed pixels fell from 17.41% to 17.11%; remaining differences are dominated by the existing global text baseline/crop and circle rasterization rather than this symbol family.

## Command and parameter audit

| Source item | Status | Implementation |
| --- | --- | --- |
| `\documentclass[varwidth=true,border=2pt]{standalone}` | accepted wrapper | document extraction |
| `\usepackage{circuitikz}` | implemented for this slice | package registry |
| `\begin{circuitikz}[thick]` | implemented | TikZ environment plus inherited line width |
| `\draw ... to[...] ++(...)` | implemented | path evaluator and relative coordinates |
| `isource`, `I`, `current source` | implemented | active European/American current convention |
| `american current source`, `isourceAM` | implemented | American shaft plus shared currarrow |
| `european current source`, `isourceEU` | implemented | European circle diameter |
| `dcisource` | implemented for angle/fill/currarrow subset | open-circle body plus shared currarrow |
| `l=$...$` | implemented | component label placement and math text |
| `\ctikzset{current arrow scale=8|24}` | implemented | inverse `Rlen / scale` dimensions |

No command or parameter used by the focused fixture is silently ignored. The broader Circuitikz package remains `partial` for source families and component types listed in the extension registry.

## Verification

```sh
node --test test/circuitikz-independent-current-sources.test.js test/circuitikz-dc-sources.test.js test/circuitikz-controlled-sources.test.js
npm run examples:render -- --fixtures test/fixtures/examples --only circuitikz-independent-current-arrows --output outputs/qa-circuitikz-independent-current-arrows-2026-09-03-after --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-circuitikz-independent-current-arrows-2026-09-03-after --register --alignment-radius 3
```
