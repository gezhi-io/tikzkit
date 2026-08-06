# Circuitikz Varcap Diodes QA - 2026-08-06

## Scope

This pass implements the diode-like `circuitikz` varcap family only: `VC`,
`VCo`, `VC-`, `VC*`, and the `full`/`empty`/`stroke varcap` long forms. It
also verifies their shared `diodes/scale`, `diodes/fill`, `l=`, local path
orientation, and automatic `diode=...` selection. It does not implement `vC`
variable capacitors, tunnel diodes, Shockley diodes, or other diode families.

## Local MacTeX Reading

Reviewed TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex`
  - lines 4017-4018 set the varcap's `height=.50` and `width=.45` Rlen
    dimensions;
  - lines 4095-4105 initialize the automatic diode selector to `empty` and
    define its full/empty/stroke branches;
  - lines 4362-4378 draw the full triangular plate and the two parallel
    cathode plates, with the first plate exactly two temporary bipole line
    widths before the second;
  - lines 4589-4605 define the empty body, while the stroke variant adds its
    center line through the empty geometry;
  - lines 5249-5268 bind the automatic and abbreviated forms.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex`
  - lines 2697, 2711, and 2728 document `VCo`, `VC*`, and `VC-`.

## Third-Party Reference

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; `rsvg-convert` is
at `/opt/homebrew/bin/rsvg-convert`.

- Before: `/private/tmp/tikzkit-qa-circuitikz-varcap-before-2026-08-06/`
- After: `/private/tmp/tikzkit-qa-circuitikz-varcap-after-2026-08-06/`

Each directory contains MacTeX PNG, TikZKit JS SVG/PNG, tikztosvg SVG/PNG,
grid variants, diff PNG, and comparison sheets. The tikztosvg SVG uses one
closed triangular path plus a separate two-subpath plate path. `VC-` adds a
third center-line path. Its viewBox is `0 0 198.82 142.15`.

## Visual Inspection

The before native sheet showed the complete six-symbol MacTeX and tikztosvg
panels, while TikZKit showed only the six connecting wire segments. The after
sheet visibly restores every missing triangular plate and both cathode plates,
the orange and green empty fills, the black `VC*` body, both stroke center
lines, and the `.7`/`.8` scale changes. The components sit on the same local
wire positions as MacTeX/tikztosvg; residual differences are text
rasterization, antialiasing, and the renderer's existing line-width calibration.

## Tests and Acceptance

Commands run:

```bash
node --test test/circuitikz-varcap-diodes.test.js \
  test/circuitikz-diodes.test.js \
  test/circuitikz-zener-tvs-diodes.test.js \
  test/circuitikz-opto-diodes.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-circuitikz-varcap-after-2026-08-06 \
  --only circuitikz-varcap-diodes --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-circuitikz-varcap-after-2026-08-06 \
  --only circuitikz-varcap-diodes
```

The five focused tests pass. All three renderer artifacts generated for the
fixture; no reference is missing. The diff remains nonzero because SVG/native
text and antialiasing are intentionally different, but the actual missing
geometry is resolved.

## Remaining Work

Deferred: `vC` variable-capacitor geometry, tunnel/Schottky extensions beyond
the current subset, Shockley/bidirectional/tripole diode families, and full
custom diode-shape keys. The next focused circuitikz slice should be `vC`,
because it shares the capacitor body but introduces a distinct diagonal control
arrow and its own source geometry.
