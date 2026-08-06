# Circuitikz American Source Sign Rotation: Visual QA

## Scope

This accepted slice is intentionally narrow: the internal `+/-` signs on
independent American `V`/`V<` sources. It implements Circuitikz's
`sources/symbol/sign rotation=default|auto|straight|<angle>` semantics in the
shared source-symbol evaluator. It does not claim full Circuitikz source
compatibility, custom sign glyphs, `bipoles/vsourceam/margin`, or exact TeX
box metrics for the signs.

The real driver is
[`test/fixtures/examples/circuitikz/basic-bipoles.tex`](../../test/fixtures/examples/circuitikz/basic-bipoles.tex):
`\usepackage[siunitx,RPvoltages]{circuitikz}`, `\begin{circuitikz}[american]`,
and `to[V<=$\SI{5}{\volt}$]`. The regression test additionally exercises
`default`, `auto`, `straight`, and a numeric `30` degree sign rotation.

## Local MacTeX Reading

I read the installed TeX Live 2025 implementation and manual instead of
deriving the rule from screenshots:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex`,
  lines 2299-2381, defines `bipoles/vsourceam/inner plus` and `inner minus`.
  The default `sources/symbol/sign rotation` emits `rotate=90`; `auto` uses
  zero degrees near horizontal directions and 90 degrees otherwise; `straight`
  follows the current path transformation; a number is passed to `rotate`.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex`,
  lines 3176-3204, documents those same modes and the default vertical signs.

TikZKit now resolves that option once for the source geometry and applies it to
both internal text nodes. This is shared behavior, not a fixture-specific
coordinate override.

## Local References And Visual Result

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. The complete four-way artifact bundle is
`/private/tmp/tikzkit-qa-circuitikz-source-signs-2026-08-07`:

- MacTeX PNG: `mactex-png/circuitikz-basic-bipoles.png`
- TikZKit SVG/PNG: `tikzkit-svg/circuitikz-basic-bipoles.svg` and
  `tikzkit-png/circuitikz-basic-bipoles.png`
- tikztosvg SVG/PNG: `tikztosvg-svg/circuitikz-basic-bipoles.svg` and
  `tikztosvg-png/circuitikz-basic-bipoles.png`
- Grid panels: `tikzkit-grid-png/circuitikz-basic-bipoles.png` and
  `tikztosvg-grid-png/circuitikz-basic-bipoles.png`
- Difference sheet: `diff/circuitikz-basic-bipoles-native-sheet.png`

I inspected the MacTeX, TikZKit, tikztosvg, grid, and native-sheet panels.
Before the change, TikZKit placed the American source `-` as a horizontal dash;
MacTeX and tikztosvg display it as a vertical glyph. After the change, TikZKit
emits `rotate(-90 ...)` in SVG for both signs and the visible minus orientation
matches both local references. The `+` remains centered and unchanged.

The registered pixel scalar is not the acceptance criterion here: the average
changed from `0.0420107` before to `0.0420826` after because browser glyph
antialiasing and the existing non-TeX sign metrics differ. The semantic visual
defect is nevertheless removed. The remaining difference is the vertical
dash's exact TeX `\vphantom{+}` box and font weight; lightweight math does not
yet implement `\vphantom`, so that exact metric is explicitly left open.

## Validation

```bash
node --test test/circuitikz-voltage-polarity.test.js
npm run gallery:audit
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-circuitikz-source-signs-2026-08-07 \
  --only circuitikz-basic-bipoles --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg \
  --external-timeout-ms 120000
node scripts/diff-example-pngs.js \
  --output /private/tmp/tikzkit-qa-circuitikz-source-signs-2026-08-07 \
  --register --alignment-radius 3
```

The focused test and gallery audit pass, all three render paths complete, and
the rendered fixture reports no diagnostics. `circuitikz` remains `partial`;
the next focused slice should either implement custom sign glyph/margin keys or
move on to a different high-severity source geometry mismatch.
