# Circuitikz MOS Node Anchors Visual QA (2026-08-07)

## Scope

This accepted `circuitikz` slice implements the enhanced-mode node forms
`nmos` and `pmos`. The real driver is
[`test/fixtures/examples/circuitikz/mosfet-nodes.tex`](../../test/fixtures/examples/circuitikz/mosfet-nodes.tex).
It exercises:

- `\usepackage{circuitikz}` and `\begin{tikzpicture}`;
- `\ctikzset{tripoles/mos style=arrows}`;
- `\node[nmos]` and `\node[pmos,emptycircle]`;
- the documented `G`/`gate`, `D`/`drain`, and `S`/`source` anchors; and
- ordinary relative `++(...)` connector paths and math labels.

The boundary is deliberately narrow. Depletion MOS forms, bulk/body-diode
symbols, configurable body styles, and the larger circuitikz transistor
catalog remain partial.

## Local MacTeX Reading

I read the installed TeX Live 2025 implementation before adding any geometry:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcirctripoles.tex`,
  especially the NMOS/PMOS defaults and declarations around lines 4999-5180.
  They define a `.7 Rlen` by `1.1 Rlen` body, the gate/base fractions, and
  the `G`, `D`, and `S` anchors. PMOS reverses source/drain orientation.
- The same source's PMOS circle branch specifies the default/empty/no-circle
  gate treatment.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex`,
  around lines 4798-4845, documents `tripoles/mos style=arrows`, `arrowmos`,
  `emptycircle`, and `nocircle`.

TikZKit now uses one source-derived local coordinate model for both rendering
and anchor lookup, rather than embedding positions for this one example.

## Local References And Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg` and rasterized with
`/opt/homebrew/bin/rsvg-convert`. MacTeX native PNGs came from the same local
TeX Live installation. The inspected before/after artifact bundles are outside
Git:

- before: `/private/tmp/tikzkit-qa-circuitikz-mosfet-nodes-before-2026-08-07`;
- final: `/private/tmp/tikzkit-qa-circuitikz-mosfet-nodes-final-2026-08-07`.

Each bundle contains `tikzkit-svg`, `tikzkit-png`, `tikztosvg-svg`,
`tikztosvg-png`, `mactex-png`, grid overlays, a native comparison sheet, and a
pixel diff. The final inspected sheet is
`diff/circuitikz-mosfet-nodes-native-sheet.png` in the final bundle.

The `tikztosvg` SVG also shows the expected separate path segments and PMOS
circle, with ordinary butt-capped, miter-joined strokes. MacTeX remains the
authority for the geometry because it executes the installed circuitikz
package directly.

## Visual Result

Before this change, the TikZKit panel showed only the six anchor connector
lines and labels. Both MOS bodies, their channel/base geometry, their arrows,
and the PMOS gate circle were absent. MacTeX and tikztosvg both displayed the
complete pair.

After the change, the TikZKit panel visibly contains the NMOS and PMOS bodies,
their current arrows, and PMOS's empty gate circle. The `G_n`, `D_n`, `S_n`,
`G_p`, `D_p`, and `S_p` connector lines now end at the same source/drain/gate
locations as the local references. The remaining difference is mostly glyph
rasterization and small stroke-weight/arrow-size variation. As supporting
evidence, the TikZKit-to-MacTeX changed-pixel ratio moved from `10.00%` to
`8.75%`; the acceptance criterion is the previously missing transistor
geometry becoming visibly present and correctly connected.

## Validation

```bash
node --test --test-name-pattern='renders circuitikz NMOS and PMOS nodes with G D S anchors' test/interpreter.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-circuitikz-mosfet-nodes-final-2026-08-07 \
  --only circuitikz-mosfet-nodes --native-reference --comparison-grid-mode svg
npm run examples:diff -- \
  --output /private/tmp/tikzkit-qa-circuitikz-mosfet-nodes-final-2026-08-07
```

The focused regression passes. All three SVG/PNG render paths complete with no
fixture diagnostics or external-render failures. `circuitikz` remains
`partial`, because the accepted result is only the MOS node-and-anchor family.
