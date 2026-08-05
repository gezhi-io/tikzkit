# circuitikz batteries visual QA (2026-08-06)

## Scope

Implement the standard `circuitikz` battery family only: `battery`,
`battery1`, and `battery2`, their default plate geometry, `batteries/scale`,
the verified vertical bipole placement, and generic `l=` labels. This does not
claim support for solar cells, `baertty`, `invert`, voltage-direction
conventions, arbitrary rotations, or the remainder of the circuitikz battery
class.

Driver source: `test/fixtures/examples/circuitikz/batteries.tex`.

## Local MacTeX Review

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex`,
  lines 2902-2914: batteries are their own scale class and expose `battery`,
  `battery1`, `battery2`, solar, and baertty variants.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcirc.defines.tex`,
  lines 694-800 and 1054-1056: the `batteries/scale` key multiplies the
  scale-class geometry.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex`,
  lines 1959-1964 and 2095-2201: the default battery has four alternating
  full/half plates; `battery1` has an equal-thickness pair and short internal
  leads; `battery2` uses the same geometry but makes its short plate three
  times the normal line width.

The implementation preserves this local coordinate model rather than using
case-specific screen coordinates.

## Three-way Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. MacTeX used local `pdflatex` and tikztosvg
used local XeLaTeX.

Artifacts are intentionally ignored by Git:

- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-batteries-2026-08-06/tikzkit-svg/circuitikz-batteries.svg`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-batteries-2026-08-06/tikztosvg-svg/circuitikz-batteries.svg`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-batteries-2026-08-06/mactex-png/circuitikz-batteries.png`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-batteries-2026-08-06/diff/circuitikz-batteries-sheet.png`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-batteries-2026-08-06/diff/circuitikz-batteries-native-sheet.png`

The tikztosvg SVG uses a `183.81pt x 85.84pt` viewBox. Its body paths expose
the expected `0.79701pt` lead stroke, `1.59404pt` normal battery plate stroke,
and `4.78214pt` `battery2` short plate stroke. TikZKit emits the same 1:2:6
lead/plate/battery2-short ratio after its coordinate-to-SVG scaling.

## Visual Review

Viewed the TikZKit/tikztosvg grid sheet, the MacTeX/TikZKit/tikztosvg native
sheet, the individual reference panels, and the pixel diff.

Before this change all three `to[battery...]` paths were absent from the
TikZKit scene. After the change:

- `battery` has the four alternating full/half plate sequence at the native
  offsets;
- `battery1` retains its two central lead segments and equal-width plate pair;
- `battery2` retains the same geometry while visibly thickening only the short
  plate;
- all three labels sit to the outside of their source, rather than over a
  plate.

The remaining diff is rasterization and canvas rounding: TikZKit is
`185.47pt x 85.04pt` while tikztosvg is `183.81pt x 85.84pt`; the reference
comparison reports changed ratio `0.08087` and mean absolute RGBA difference
`0.02739`. No geometry, plate-order, line-weight-ratio, or label-placement
discrepancy was visible in the reviewed panels.

## Verification

```bash
node --test test/circuitikz-batteries.test.js \
  test/circuitikz-controlled-sources.test.js \
  test/circuitikz-voltage-polarity.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-circuitikz-batteries-2026-08-06 \
  --only circuitikz-batteries --native-reference \
  --comparison-grid-mode svg --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-circuitikz-batteries-2026-08-06
```

All focused tests pass with no diagnostics. The extension registry is updated
with this accepted slice; full circuitikz support remains partial.
