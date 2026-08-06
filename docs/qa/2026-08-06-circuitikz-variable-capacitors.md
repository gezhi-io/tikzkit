# Circuitikz Variable Capacitors: Visual QA

## Scope

This slice implements the Circuitikz `vC` / `variable capacitor` bipole. It
is intentionally separate from the uppercase `VC` varcap-diode family. The
accepted feature boundary is the two-plate body, tunable control arrow,
`capacitors/scale`, `capacitors/width`, `capacitors/height`,
`capacitors/modifier thickness`, `bipoles/fix tunable direction`, `l=` labels,
and named `wiper`, `W`, and `tip` anchors.

The driver is
[`test/fixtures/examples/circuitikz/variable-capacitors.tex`](../../test/fixtures/examples/circuitikz/variable-capacitors.tex).
It exercises a default `vC`, long-form alias, compact dimensions and modifier
thickness, the legacy arrow direction, a narrow capacitor, and an anchor-based
dashed line.

## Local Circuitikz Reading

Reviewed local MacTeX sources rather than inferring the symbol from screenshots:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex`,
  lines 915-920 and 1110-1151. These define the default capacitor scale-class
  values, two vertical plates, the tunable-arrow reach, the fixed-direction
  switch, and `wiper`/`W`/`tip` anchors.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex`,
  lines 2360-2386, 2470-2522, and 10838-10857. These document aliases,
  scale/width/height/modifier-thickness keys, anchors, and why the historical
  tunable-arrow direction can be inverted.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcirc.defines.tex`,
  lines 322-352. This defines Circuitikz's `latexslim` control-arrow tip and
  establishes that the control arrow is not simply a generic marker.

Implementation follows the source geometry in component-local coordinates:
plate separation is `capacitors/width * 1.4 * scale`, plate span is
`capacitors/height * 1.4 * scale`, and the arrow runs from the relevant plate
corner through the documented tunable-width extension. The lower-case alias is
resolved before case-insensitive diode aliases so `vC` cannot be mistaken for
uppercase `VC`.

## References And Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`.

After-fix artifacts are stored under
`/private/tmp/tikzkit-qa-circuitikz-vcap-after-2026-08-06`:

- MacTeX native PNG:
  `mactex-png/circuitikz-variable-capacitors.png`
- TikZKit SVG/PNG:
  `tikzkit-svg/circuitikz-variable-capacitors.svg` and
  `tikzkit-png/circuitikz-variable-capacitors.png`
- tikztosvg SVG/PNG:
  `tikztosvg-svg/circuitikz-variable-capacitors.svg` and
  `tikztosvg-png/circuitikz-variable-capacitors.png`
- Four-way and source-grid sheets:
  `diff/circuitikz-variable-capacitors-native-sheet.png`,
  `tikzkit-grid-png/circuitikz-variable-capacitors.png`, and
  `tikztosvg-grid-png/circuitikz-variable-capacitors.png`

Before the fix, lower-case `vC` entered the case-insensitive `VC` varcap-diode
path. The result contained triangular diode geometry, not capacitor plates;
labels and named anchors were absent or diagnosed. MacTeX and tikztosvg both
showed two plates with a diagonal control arrow. After the fix, TikZKit has the
same plate locations and arrow orientation for all four examples, changes the
arrow when `bipoles/fix tunable direction=false`, honors compact/narrow
dimensions, exposes anchors for the dashed line, and positions labels clear of
the arrow. The final comparison is visually close; the residual two-pixel SVG
height difference is from text bounding-box metrics, not from component
placement.

## Validation

```bash
node --test test/circuitikz-variable-capacitors.test.js test/circuitikz-varcap-diodes.test.js
node scripts/render-example-fixtures.js --only circuitikz-variable-capacitors \
  --output /private/tmp/tikzkit-qa-circuitikz-vcap-after-2026-08-06 \
  --native-reference --comparison-grid-mode svg
node scripts/diff-example-pngs.js \
  --output /private/tmp/tikzkit-qa-circuitikz-vcap-after-2026-08-06
```

The focused regression tests pass. All MacTeX, TikZKit, and tikztosvg SVG/PNG
artifacts rendered, and the final sheets were visually inspected.

## Remaining Work

The full capacitor catalogue remains partial. In particular, custom control
arrow tip variants, every capacitor style directory, and unrelated capacitor
families are outside this slice. `latexslim` is recorded from the source; the
current browser renderer uses its existing compatible arrow marker rather than
adding a broadly exposed custom marker type.
