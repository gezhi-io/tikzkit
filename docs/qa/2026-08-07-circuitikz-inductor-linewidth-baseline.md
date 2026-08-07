# Circuitikz Coil Line-Width Baseline: Visual QA

## Scope

This narrow Circuitikz slice corrects the geometry shared by cute and American
coil bodies, and by cute-choke core lines. It does not attempt the general
Circuitikz bipole catalogue, inductive sensors, or arbitrary custom coils.

The real visual drivers are
[`test/fixtures/examples/circuitikz/inductors.tex`](../../test/fixtures/examples/circuitikz/inductors.tex)
and
[`test/fixtures/examples/circuitikz/chokes-and-core-anchors.tex`](../../test/fixtures/examples/circuitikz/chokes-and-core-anchors.tex).

## Local MacTeX Reading

I read the installed TeX Live 2025 Circuitikz source rather than estimating
the coil path from screenshots:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcirc.defines.tex`,
  lines 694-798: `\pgfcircdeclarebipolescaled` derives the node anchors from
  the scaled `Rlen`, saves the incoming line width, and runs the component
  drawing macro with the component style.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex`,
  lines 1286-1325 and 1393-1638: cute and American inductors use `Rlen=1.4cm`,
  body-specific width/coils, a butt cap and bevel join. Their coil path extends
  by half of the component line width at both ends; its baseline is shifted by
  `-0.4 *` the original incoming line width. Cute-choke core lines begin at
  the same shifted baseline and then add `cdist * res@up` and `cstep * res@up`.
- Lines 1327-1336 define `core west/east` from the node's `north east` anchor
  plus the independent `bipoles/inductors/core distance`; the anchor itself is
  intentionally separate from the painted choke core.

## Implementation

`src/engine/evaluate.js` now converts SVG stroke units back into TikZ canvas
units before applying the source rule. Coil paths receive one complete
component-stroke-width of additional span, centred over the original body;
the source's `-0.4` incoming-width baseline equals `-0.2` of the doubled
Circuitikz component stroke. Choke core paths use that same baseline before
their documented `cdist`/`cstep` offsets.

The focused regression in
[`test/circuitikz-variable-inductors.test.js`](../../test/circuitikz-variable-inductors.test.js)
checks the expanded coil span, baseline, and both default choke-core offsets.

## Three-Way Reference

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. Artifacts are intentionally ignored by Git:

`outputs/qa-circuitikz-inductors-after-2026-08-07/`

- TikZKit: `tikzkit-svg/`, `tikzkit-png/`, and `tikzkit-grid-png/`
- tikztosvg: `tikztosvg-svg/`, `tikztosvg-png/`, and `tikztosvg-grid-png/`
- MacTeX: `mactex-png/`
- comparison sheets and registered diff: `diff/` and `diff-png/`

I inspected both native sheets. In the generated tikztosvg SVG, a cute choke
has a `0.797pt` component stroke, its coil begins `0.3985pt` before the lead
endpoint, and its first core is positioned from the same `0.4`-incoming-width
baseline. TikZKit now emits the equivalent half-component-width endpoint
extension and baseline in its SVG path data, while retaining the source's
`stroke-linecap="butt"` and `stroke-linejoin="bevel"`.

On the real `circuitikz-inductors` fixture, the registered TikZKit-to-MacTeX
changed-pixel ratio moved from **11.5795%** to **11.5681%**. The first coil
joins and the long/American coil terminals now line up with the local reference
at the 1cm-grid scale. The choke fixture's aggregate changed-pixel ratio rose
slightly because its remaining label and crop differences dominate this
sub-pixel body correction. It is therefore still explicitly **partial**, not
claimed as complete visual parity.

Remaining differences are Circuitikz label text/bounds and overall crop
calibration; no elements are missing and diagnostics remain empty.

## Validation

```bash
node --test test/circuitikz-variable-inductors.test.js \
  test/circuitikz-real-cases.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-circuitikz-inductors-after-2026-08-07 \
  --only circuitikz-inductors,circuitikz-chokes-and-core-anchors \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- \
  --output outputs/qa-circuitikz-inductors-after-2026-08-07 \
  --register --alignment-radius 3
```

The focused tests pass; the optional external Circuitikz manual corpus test is
skipped because `work/circuitikz` is absent locally. `circuitikz` remains
`partial`.
