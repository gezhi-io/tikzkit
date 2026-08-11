# Circuitikz American Resistor Zigzag: Visual QA

## Scope

This review accepts one narrow `circuitikz` slice: the normal `to[R]` bipole
in its default/American zigzag form, its body-size settings, its zig count,
and basic `resistor=american|european` selection. It does not claim coverage
for tunable, variable, custom, or all label/voltage/current resistor variants.

The real fixture is
`test/fixtures/examples/circuitikz/basic-bipoles.tex`. Its `to[R=2<\\ohm>,
i=?, v=84<\\volt>]` resistor is attached to the capacitor and voltage-source
loop, so it verifies component geometry together with the shared leads and
labels rather than a hand-positioned one-off drawing.

## Local Circuitikz Reading

Read these local MacTeX sources:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/circuitikz/circuitikz.sty`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex`,
  lines 37-114 and 635-688.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcirc.defines.tex`,
  lines 694-798.

`pgfcircbipoles.tex` sets the normal resistor defaults to `zigs=3`,
`width=.8`, and `height=.3`, maps `resistors/width` onto
`bipoles/resistor/width`, and declares an American/european resistor choice.
The American drawing divides the body into `4 * zigs` equal longitudinal
steps: one initial ramp, alternating two-step peaks, then a final return to
the baseline. It uses a bevel join. The common bipole declaration turns a
configured height into a symmetric half-height bound, which is why a `.3`
height produces `.15 * Rlen` peaks on either side of the centerline.

## Third-Party and Native References

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; `rsvg-convert` was
found at `/opt/homebrew/bin/rsvg-convert`. The complete local artifact bundle
is `outputs/qa-circuitikz-american-resistor-2026-08-11/`:

- `mactex-png/circuitikz-basic-bipoles.png`
- `tikzkit-svg/` and `tikzkit-png/`
- `tikztosvg-svg/` and `tikztosvg-png/`
- `tikzkit-grid-*`, `tikztosvg-grid-*`, `diff/`, and `diff-png/`

The tikztosvg resistor SVG is a single bevel-joined path with the endpoint,
six alternating corners, and endpoint. TikZKit now emits the same command
count and order: its supported source path is `M 94 0` followed by six
alternating `L` corners and `L 206 0`, with `stroke-linejoin="bevel"`.

## Visible Change

Before this change, TikZKit used a fixed, denser zigzag regardless of the
Circuitikz `zigs`, body width, or height keys. The body looked visibly cramped
relative to the native three-peak American resistor. After the change, the
three broad peaks, end-ramp proportions, bevel corners, and short leads match
the MacTeX/tikztosvg structure in the real fixture. The comparison sheet was
opened and checked at:

`outputs/qa-circuitikz-american-resistor-2026-08-11/diff/circuitikz-basic-bipoles-native-sheet.png`.

The full image is not yet identical: TikZKit's text metrics and total crop
remain slightly different from native output. The registered TikZKit vs
tikztosvg changed-pixel ratio is therefore recorded only as a diagnostic
(13.27%), not as this acceptance criterion.

## Implemented Syntax

- `to[R]` with the default/American zigzag body.
- `resistors/zigs=<number>`.
- `resistors/width=<number>` and `bipoles/resistor/width=<number>`.
- `bipoles/resistor/height=<number>`.
- `resistor=american` and `resistor=european`, including a later
  `\\ctikzset{resistor=european}` overriding an inherited `[american]` key.

Still partial: detailed resistor aliases and custom shapes, tunable/variable
resistors, full label and current/voltage annotation placement, and the
complete Circuitikz component catalogue.

## Verification

```bash
node --test --test-name-pattern='matches Circuitikz American resistor zigzag defaults' test/interpreter.test.js
node --test test/circuitikz-real-cases.test.js test/circuitikz-batteries.test.js
npm run examples:render -- --fixtures test/fixtures/examples --only circuitikz-basic-bipoles \
  --output outputs/qa-circuitikz-american-resistor-2026-08-11 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-circuitikz-american-resistor-2026-08-11 --register
```

All executed renderer paths completed with zero diagnostics. The two
corpus-wide Circuitikz tests were skipped because the optional `work/circuitikz`
checkout is not present; they were not counted as a pass.
