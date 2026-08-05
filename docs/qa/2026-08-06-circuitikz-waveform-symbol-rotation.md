# circuitikz waveform symbols and rotation visual QA (2026-08-06)

## Scope

This slice implements independent square and triangle voltage-source symbols:
`sqV`, `vsourcesquare`, `square voltage source`, `tV`, `vsourcetri`, and
`triangle voltage source`. It also implements the shared
`sources/symbol/rotate=<angle>|auto`, shared `sources/symbol/thickness`, and
controlled-sine `csources/symbol/rotate=<angle>|auto` behavior. Source fills,
DC symbols, square/triangle current sources, and controlled square/triangle
sources are deliberately out of scope.

Driver: `test/fixtures/examples/circuitikz/waveform-symbol-rotation.tex`.

## Local MacTeX Review

Reviewed local TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex`,
  lines 3156-3172. Waveform thickness is relative to the source outline; the
  default rotation is `90`; `auto` counter-rotates the component transform so
  a waveform retains one global orientation.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex`,
  lines 1971-1975 and 2270-2278. Independent and controlled sources have
  distinct `sources/...` and `csources/...` key classes. The native `auto`
  implementation reads PGF's transform matrix and applies the inverse angle.
- The same source, lines 2409-2454 and 3849-3872. The square waveform is the
  exact five-line polyline `(-r,0)->(-r,r)->(0,r)->(0,-r)->(r,-r)->(r,0)`;
  the triangle is the exact three-line polyline and the aliases map to `sqV`
  and `tV`.

## Reference Artifacts

`tikztosvg` was available at `/Library/TeX/texbin/tikztosvg`; PNG conversion
used `/opt/homebrew/bin/rsvg-convert`; MacTeX reference rendering used local
`pdflatex`.

Ignored generated artifacts:

- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-waveform-symbol-rotation-2026-08-06/tikzkit-svg/circuitikz-waveform-symbol-rotation.svg`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-waveform-symbol-rotation-2026-08-06/tikztosvg-svg/circuitikz-waveform-symbol-rotation.svg`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-waveform-symbol-rotation-2026-08-06/mactex-png/circuitikz-waveform-symbol-rotation.png`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-waveform-symbol-rotation-2026-08-06/diff/circuitikz-waveform-symbol-rotation-sheet.png`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-waveform-symbol-rotation-2026-08-06/diff/circuitikz-waveform-symbol-rotation-native-sheet.png`

The tikztosvg SVG uses `viewBox="0 0 128.47 511.03"`. It renders source
outlines at `1.59404pt`; `sources/symbol/thickness=1.5` emits the internal
wave at `2.39107pt`. Its square and triangle `path` elements use the native
five- and three-segment point sequences. The `auto` path of a vertical source
has the same global start-to-end direction as the horizontal case, matching
the manual's inverse-transform rule.

## Visual Review

Viewed the TikZKit/tikztosvg grid sheet, the MacTeX/JS/tikztosvg sheet, and
the diff sheet. Before the change, the four square and two triangular voltage
sources were bare interrupted wires and both rotation keys were ignored. The
reference panels contained circular source outlines with the black/red square
steps, triangle zigzags, a numeric 45-degree sine, and a rotated controlled
sine in its blue diamond.

After the change, all six independent waveform symbols are visible in TikZKit.
Default symbols rotate with their component; `auto` keeps the red horizontal
and vertical symbols in the reference global orientation; the `1.5` thickness
is applied only to internal waveforms. The blue independent sine respects
`45`, while the blue controlled sine respects `csources/...=auto`. The
inspected JS, tikztosvg, and MacTeX panels share element count, orientation,
line width, color, and source-body placement. The final raster comparison is
`172x682px`, with 73 changed pixels (`0.0006223` ratio) from antialiasing;
this number supports rather than replaces the panel review.

## Verification

```bash
node --test test/circuitikz-waveform-symbol-rotation.test.js \
  test/circuitikz-sinusoidal-sources.test.js \
  test/circuitikz-controlled-sinusoidal-sources.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-circuitikz-waveform-symbol-rotation-2026-08-06 \
  --only circuitikz-waveform-symbol-rotation --native-reference \
  --comparison-grid-mode svg --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-circuitikz-waveform-symbol-rotation-2026-08-06
```

All focused tests pass with no diagnostics. The unsupported waveform families
remain explicit next candidates rather than being treated as supported.
