# Circuitikz Transformer Geometry Visual QA (2026-08-06)

## Scope

This pass implements one narrow `circuitikz` slice: the default cute-transformer
body used by `transformer` and `transformer core` nodes. It covers the two
coils, four external lead paths, line-width roles, core placement, and the
shared L1/L2 anchor span. It does not claim European/American transformer
variants, dot anchors, arbitrary transformer body configuration, or the wider
quadpole catalog.

Driver source:
`test/fixtures/examples/circuitikz/transformer-core-customization.tex`.

## Local MacTeX Review

Reviewed local TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircquadpoles.tex`,
  lines 205-288: a transformer places L1 and L2 with opposed line transforms,
  then routes the outer terminal leads through each coil's `a`/`b` anchor.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex`,
  lines 1286-1306 and 1406-1432: `cuteinductor` defaults to five coils with
  `width=.6`, `coil aspect=.5`, `height=.3`, and `lower coil height=.15`.
  Its path alternates a wide 180-degree arc with an opposite short return arc.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex`,
  lines 5949-5968 and 6100-6124: the existing core colour, thickness, and dash
  behavior remains the documented manual contract.

The renderer now derives the coil span from the same `Rlen` equations as the
source: `smallStep = .5 * aspect * width * Rlen / (coils - 1)` and
`wideStep = (width * Rlen + (coils - 1) * 2 * smallStep) / coils / 2`.
It serializes each half ellipse as two SVG cubic curves rather than approximating
the winding with a quadratic zigzag.

## Three-Way Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`; the native reference used local `pdflatex`.

Artifacts are ignored by Git:

- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-transformer-geometry-2026-08-06/tikzkit-svg/circuitikz-transformer-core-customization.svg`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-transformer-geometry-2026-08-06/tikztosvg-svg/circuitikz-transformer-core-customization.svg`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-transformer-geometry-2026-08-06/mactex-png/circuitikz-transformer-core-customization.png`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-transformer-geometry-2026-08-06/diff/circuitikz-transformer-core-customization-sheet.png`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-transformer-geometry-2026-08-06/diff/circuitikz-transformer-core-customization-native-sheet.png`

The tikztosvg SVG represents each coil with cubic `C` commands, outer leads as
independent thin paths, and the core with the cute-choke line-width multiplier.
TikZKit now emits the same SVG structure: separate `leads`, `coils`, and
`core` paths, `stroke-linejoin=bevel` for the coils, and source-derived cubic
arc control points.

## Visual Result

Viewed the TikZKit/tikztosvg grid sheet, the native three-way sheet, and the
registered diff panel. Before this pass, TikZKit showed short zigzag windings
and an inward boxy lead route. After it:

- both windings have five rounded inward lobes and four smaller return lobes;
- the outer lead endpoints reach the full transformer height and connect at
  the same inner x positions as the reference;
- leads are thin while coils and core have the visibly heavier native role;
- the red dashed custom core retains its previous color, dash sequence, and
  doubled relative-thickness behavior.

Against tikztosvg, changed pixels fell from `20.288%` to `10.144%`; mean
absolute RGBA difference fell from `0.06260` to `0.01693`, with no registration
offset needed. The residual diff is concentrated around antialiasing and the
small remaining curve/bounding-box difference rather than missing geometry.

## Verification

```bash
node --test test/circuitikz-transformer-core.test.js \
  test/circuitikz-batteries.test.js \
  test/circuitikz-controlled-sources.test.js \
  test/circuitikz-controlled-sinusoidal-sources.test.js \
  test/circuitikz-sinusoidal-sources.test.js \
  test/circuitikz-voltage-polarity.test.js \
  test/circuitikz-waveform-symbol-rotation.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-circuitikz-transformer-geometry-2026-08-06 \
  --only circuitikz-transformer-core-customization --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-circuitikz-transformer-geometry-2026-08-06 \
  --register --alignment-radius 3
```

All focused tests pass. The package remains `partial`: the improvement is
limited to the default cute-transformer body and its documented core styling.
