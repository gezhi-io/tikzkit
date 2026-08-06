# Circuitikz `latexslim` Arrow: Visual QA

## Scope

This is a narrow shared-renderer slice for the Circuitikz `latexslim` arrow
tip used by tunable bipoles. The real driver is
[`test/fixtures/examples/circuitikz/variable-capacitors.tex`](../../test/fixtures/examples/circuitikz/variable-capacitors.tex):
the four `vC` instances exercise the default and reversed directions, ordinary
and reduced modifier thicknesses, and several component dimensions. It does
not claim arbitrary user-declared arrow shapes or every Circuitikz use of this
tip.

## Local Source Reading

Reviewed local MacTeX rather than approximating from pixels:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcirc.defines.tex`,
  lines 322-352, declares `latexslim` with `d=.28pt+.3*\pgflinewidth`, left
  and right extents of `-4d` and `+6d`, and a three-cubic `\pgfusepathqfill`
  outline. The narrow central waist distinguishes it from PGF classic `latex`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex`,
  lines 1110-1151, assigns that exact tip to `vC`'s tunable control arrow.
  The same source uses it for other tunable components, which is why the
  implementation is in the shared arrow renderer rather than a case patch.

TikZKit now normalizes `latexslim`, derives `d` from the active SVG stroke
width, emits the source-equivalent three-cubic filled path without a stroke,
uses `6d` for stem shortening, and includes its real bounds in the canvas.
The marker-definition fallback uses the same geometry.

## References And Visual Result

`tikztosvg` was available at `/Library/TeX/texbin/tikztosvg`; PNG conversion
used `/opt/homebrew/bin/rsvg-convert`. The fresh artifact bundle is
`/private/tmp/tikzkit-qa-circuitikz-latexslim-2026-08-06`:

- MacTeX PNG: `mactex-png/circuitikz-variable-capacitors.png`
- TikZKit SVG/PNG: `tikzkit-svg/circuitikz-variable-capacitors.svg` and
  `tikzkit-png/circuitikz-variable-capacitors.png`
- tikztosvg SVG/PNG: `tikztosvg-svg/circuitikz-variable-capacitors.svg` and
  `tikztosvg-png/circuitikz-variable-capacitors.png`
- aligned diff plus four-way sheet:
  `diff-png/circuitikz-variable-capacitors-registered.png` and
  `diff/circuitikz-variable-capacitors-native-sheet.png`
- matching 1cm grid panels:
  `tikzkit-grid-png/circuitikz-variable-capacitors.png` and
  `tikztosvg-grid-png/circuitikz-variable-capacitors.png`

I inspected the MacTeX, TikZKit, tikztosvg, and native-sheet panels. Before
this change, TikZKit used the broader, outlined classic `latex` head and
shortened the control stem by `9d`. After it, the head is visibly slimmer,
pinched through its centre, fills without an outline, and leaves the longer
native-style shaft. Plate positions, label positions, component scale, and the
reversed-arrow case are unchanged. Remaining diff pixels are predominantly
formula glyph rasterization and tiny text-bounding-box differences; no element
is missing and the focused fixture has no diagnostics.

## Validation

```bash
node --test test/circuitikz-variable-capacitors.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-circuitikz-latexslim-2026-08-06 \
  --only circuitikz-variable-capacitors --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-circuitikz-latexslim-2026-08-06 \
  --register --alignment-radius 3
```

The focused tests and all three local render paths pass. Circuitikz remains
`partial`: arbitrary custom tunable tips and the unimplemented bipole catalogue
are deliberately outside this accepted feature boundary.
