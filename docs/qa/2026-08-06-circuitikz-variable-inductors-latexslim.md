# Circuitikz `vL` Latexslim Controls: Visual QA

## Scope

This accepted slice is the tunable control arrow on Circuitikz `vL` variable
inductors. It covers the source-defined `latexslim` tip,
`inductors/modifier thickness`, and `bipoles/fix tunable direction` for the
European/ American control paths. `vcuteinductor` deliberately retains its
source-defined fixed diagonal. This is not a claim of full Circuitikz inductor
compatibility or arbitrary custom tunable tips.

The real driver is
[`test/fixtures/examples/circuitikz/inductors.tex`](../../test/fixtures/examples/circuitikz/inductors.tex).
It contains standard cute/long/American `L` examples and two European `vL`
examples: the ordinary ascending control arrow, then the historical descending
arrow at half modifier thickness.

## Local MacTeX Reading

The implementation follows the installed TeX Live 2025 source:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcirc.defines.tex`,
  lines 554-562, first finds `<active class>/modifier thickness` and multiplies
  the current drawing line width. Lines 1033-1036 initialize
  `inductors/modifier thickness=1`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex`,
  lines 1810-1842, lower European `vL` through `tfullgeneric`, use
  `latexslim`, and select the diagonal from `bipoles/fix tunable direction`.
  Lines 1583-1588 use the same tip for the cute body but retain one direction;
  lines 1718-1732 do the equivalent fixed-direction branch for the American
  body.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcirc.defines.tex`,
  lines 322-352, define `latexslim` as a three-cubic, qfill-only tip with
  `d=.28pt+.3*linewidth` and 6d stem shortening.

The shared renderer already implements that tip; this change routes `vL` to it,
uses the effective modifier thickness for its line and tip dimensions, and
shares the direction-key decoder with `vC`.

## Local References And Visual Result

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. The complete local artifact bundle is
`/private/tmp/tikzkit-qa-circuitikz-variable-inductors-latexslim-2026-08-06`:

- MacTeX PNG: `mactex-png/circuitikz-inductors.png`
- TikZKit SVG/PNG: `tikzkit-svg/circuitikz-inductors.svg` and
  `tikzkit-png/circuitikz-inductors.png`
- tikztosvg SVG/PNG: `tikztosvg-svg/circuitikz-inductors.svg` and
  `tikztosvg-png/circuitikz-inductors.png`
- 1cm-grid panels: `tikzkit-grid-png/circuitikz-inductors.png` and
  `tikztosvg-grid-png/circuitikz-inductors.png`
- aligned difference and four-way panels:
  `diff-png/circuitikz-inductors-registered.png` and
  `diff/circuitikz-inductors-native-sheet.png`

I inspected the native-sheet and both grid panels. Before this change, TikZKit
used the broader, outlined classic `latex` head and its 9d shortening for the
variable-inductor control. Now both `vL` controls use the native-style thin,
pinched, fill-only `latexslim` head with 6d shortening; the legacy example is
visibly reversed and its `.5` modifier is thinner. The grid shows that the two
control lines remain registered to the same European body centers as MacTeX and
tikztosvg. Remaining visible differences are the existing coil approximations,
formula rasterization, and small text bounds; no control arrow, label, or
reference wire is missing and diagnostics stay empty.

The tikztosvg SVG uses an equivalent converted fill path for the arrow. TikZKit
keeps the renderer-native three-cubic `latexslim` shape (`stroke="none"`) rather
than emulating it with an outlined generic SVG marker.

## Validation

```bash
node --test test/circuitikz-variable-inductors.test.js \
  test/circuitikz-variable-capacitors.test.js
node --test --test-name-pattern='circuitikz inductor styles and the variable-inductor arrow' \
  test/interpreter.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-circuitikz-variable-inductors-latexslim-2026-08-06 \
  --only circuitikz-inductors --native-reference --comparison-grid-mode svg \
  --strict-tikztosvg --external-timeout-ms 120000
node scripts/diff-example-pngs.js \
  --output /private/tmp/tikzkit-qa-circuitikz-variable-inductors-latexslim-2026-08-06 \
  --register --alignment-radius 3
```

All focused tests and the three rendering paths pass. Circuitikz remains
`partial`; exact non-European inductor-body geometry, custom arrow styles, and
the wider bipole catalogue remain outside this slice.
