# Circuitikz Transformer Cute-Coil Geometry: Visual QA

## Scope

This slice corrects the default cute-inductor body of a `transformer core`
node only. It covers the shared geometry behind `\draw ... node[transformer
core](...) {}`, the `transformer core/.cd` style directory, and the default
`quadpoles/transformer core/{inner,width,height,core height,core width}`
dimensions. Generic transformer nodes, non-cute coil styles, custom quadpole
geometry, dot anchors, and the wider circuitikz catalogue remain outside scope.

Driver: [`test/fixtures/examples/circuitikz/transformer-core-customization.tex`](../../test/fixtures/examples/circuitikz/transformer-core-customization.tex).

## Local MacTeX Reading

Reviewed the installed TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircquadpoles.tex`,
  lines 20-32 and 230-329. `transformer core` delegates each winding to the
  cute-inductor shape; outer lead anchors remain at the unexpanded winding
  extent, while core line width, color, and dash are independently applied.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex`,
  lines 1393-1433. The cute-inductor path starts half a component stroke past
  the lead anchor, adds the full component stroke to every outer step, leaves
  return-arc width unchanged, and applies a rotated `0.4 *` incoming-line
  baseline correction. It uses butt caps and bevel joins.

## Implementation

[`src/renderers/svg/circuitikzNodes.js`](../../src/renderers/svg/circuitikzNodes.js)
now keeps lead and coil extents distinct. It converts the renderer's stroke
value back to TikZ canvas units, expands only the painted coil path by half a
coil stroke at either end, includes that stroke in the wide-step equation, and
applies the outward rotated-baseline correction. Leads and named winding
anchors retain their native, unexpanded positions.

[`test/circuitikz-transformer-core.test.js`](../../test/circuitikz-transformer-core.test.js)
adds a source-derived regression for the first coil endpoint, the first
outer-step cubic, and the outward baseline.

## Three-Way Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`; MacTeX used local `pdflatex`.

- TikZKit SVG: `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-transformer-geometry-final-2026-08-08/tikzkit-svg/circuitikz-transformer-core-customization.svg`
- tikztosvg SVG: `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-transformer-geometry-final-2026-08-08/tikztosvg-svg/circuitikz-transformer-core-customization.svg`
- MacTeX PNG: `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-transformer-geometry-final-2026-08-08/mactex-png/circuitikz-transformer-core-customization.png`
- inspected four-panel sheet: `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-transformer-geometry-final-2026-08-08/diff/circuitikz-transformer-core-customization-native-sheet.png`
- registered diff: `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-transformer-geometry-final-2026-08-08/diff-png/circuitikz-transformer-core-customization-registered.png`

The tikztosvg SVG uses separate paths for windings, outer leads, and the two
core lines: lead stroke `0.3985pt`, coil/core stroke `0.797pt`, bevel coil
joins, and the requested red core `stroke-dasharray="3.9851 1.99255"`.

## Visual Review

I inspected the MacTeX/TikZKit/tikztosvg four-panel sheet and its registered
diff. Before this change all four windings were visibly too short and their
large loop cadence was compressed; the diff highlighted every coil contour.
After it, the outer lead joins, five large loops, four return loops, black
core, and red dashed double core align visibly. The remaining red pixels are
thin antialiasing/stroke-rasterization halos around the loops; no winding,
lead, or core element is missing.

TikZKit versus tikztosvg changed-pixel ratio improves from **9.54%** to
**6.85%**. TikZKit versus MacTeX improves from **13.08%** to **10.50%**. These
values support the inspected geometry correction; they are not the acceptance
criterion on their own.

## Validation

```bash
node --test test/circuitikz-transformer-core.test.js \
  test/circuitikz-variable-inductors.test.js \
  test/circuitikz-controlled-sinusoidal-sources.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-circuitikz-transformer-geometry-final-2026-08-08 \
  --only circuitikz-transformer-core-customization --preserve-output \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-circuitikz-transformer-geometry-final-2026-08-08 \
  --register --alignment-radius 3
```

The focused tests pass, all three renderers complete, and diagnostics stay at
zero. `circuitikz` remains `partial`.
