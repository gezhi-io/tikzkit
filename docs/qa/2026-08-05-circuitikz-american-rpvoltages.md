# Circuitikz American RPvoltages Visual QA - 2026-08-05

## Scope

This review covers one circuitikz semantic slice: voltage annotations on
ordinary passive bipoles and independent American voltage sources when the
document loads `\usepackage[siunitx,RPvoltages]{circuitikz}` and the picture
uses `[american]`. It does not claim general circuitikz compatibility.

## Local MacTeX Review

Reviewed these local TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/circuitikz/circuitikz.sty`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircvoltage.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex`

`circuitikz.sty` configures `RPvoltages` as old voltage direction plus the
battery/current-source fixes. `pgfcircvoltage.tex` assigns `v<` the backward
direction, defaults a passive `v` under that mode to below/backward, and draws
American voltage annotations as polarity signs. `pgfcircbipoles.tex` marks an
American independent voltage source as `is voltageoutsideofsymbol=false`, so
its signs belong inside the source circle. The manual calls RPvoltage direction
“rising potential”; it does not make American annotations into arrow graphics.

## Driver Inventory

Driver: `test/fixtures/examples/circuitikz/basic-bipoles.tex`

Implemented and visually checked:

- `\usepackage[siunitx,RPvoltages]{circuitikz}`
- `\begin{circuitikz}[american]`
- `to[R=2<\ohm>, i=?, v=84<\volt>]`
- `to[C=$C_1$]`
- `to[V<=$\SI{5}{\volt}$]`
- `\SI`, `<\volt>`, and `<\ohm>` label normalization

The interpreter now uses `RPvoltages` to determine `+/-` ordering for American
components and continues to render external arrows for European voltage
notation. It does not yet implement the full source/battery matrix, controlled
source variants, voltage transforms, or all circuitikz label styles.

## Artifacts

- MacTeX native PNG: `outputs/qa-circuitikz-voltage-polarity/mactex-basic/basic-bipoles.png`
- TikZKit SVG/PNG: `outputs/qa-circuitikz-voltage-polarity/tikzkit-svg/` and
  `outputs/qa-circuitikz-voltage-polarity/tikzkit-png/`
- tikztosvg SVG/PNG: `outputs/qa-circuitikz-voltage-polarity/tikztosvg-svg/`
  and `outputs/qa-circuitikz-voltage-polarity/tikztosvg-png/`
- Four-way comparison sheet:
  `outputs/qa-circuitikz-voltage-polarity/diff/circuitikz-basic-bipoles-sheet.png`

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; its SVG was
rasterized with `/opt/homebrew/bin/rsvg-convert`.

## Visual Result

Before the change, the browser renderer added one curved voltage arrow below
the resistor and one straight arrow below the American voltage source. Both
were absent from native MacTeX and tikztosvg, and the extra source arrow grew
the browser image to `114x128px` against the reference `114x120px`.

After the change, the passive resistor carries a left `+` and right `-` for
the explicit backward `v<` direction, while the independent source keeps its
polarity inside the circle. The source value remains below the circle without
an arrow. The rendered browser canvas is now `114x122px`; the pixel comparison
improves from `10.69%` changed pixels / `0.0354` mean absolute RGBA difference
to `10.32%` / `0.0334`. The sheet was visually inspected against both MacTeX
and tikztosvg.

The remaining visible difference is not hidden: resistor zig-zag geometry,
text rasterization, and a two-pixel bounding-box difference remain, so this
package is still **partial**.

## Verification

```sh
node --test --test-name-pattern='circuitikz' test/interpreter.test.js
node --test --test-name-pattern='uses RP polarity signs' test/interpreter.test.js
node scripts/render-example-fixtures.js --output outputs/qa-circuitikz-voltage-polarity --only circuitikz-basic-bipoles --preserve-output
node scripts/diff-example-pngs.js --output outputs/qa-circuitikz-voltage-polarity
```
