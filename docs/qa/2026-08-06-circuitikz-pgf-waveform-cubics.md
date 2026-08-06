# Circuitikz PGF Waveform Cubics

## Scope

This slice corrects one shared `circuitikz` feature: the four cubic segments
inside sinusoidal voltage/current sources. It covers independent `sV`/`sI`
and controlled `csV`/`csI` waveforms, including configured symbol rotation
and thickness. It does not add the wider circuitikz bipole catalogue.

The primary real driver is
`test/fixtures/examples/circuitikz/controlled-sinusoidal-sources.tex`. Control
drivers are `circuitikz-sinusoidal-sources.tex` and
`circuitikz-waveform-symbol-rotation.tex`.

## Local MacTeX Study

Read these local sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex`
  lines 3454-3515: controlled sinusoidal sources create a diamond, halve its
  source radius, then call `\pgfpathsine` and `\pgfpathcosine` four times.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepathconstruct.code.tex`
  lines 1321-1368: the exact cubic coefficients are sine
  `(.326,.512),(.638,1)` and cosine `(.362,0),(.674,.488)` relative to
  their supplied vector.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/circuitikz/circuitikz.sty`
  and `circuitikzmanual.tex`: package options and the documented controlled
  source family confirm this remains a `circuitikz`-owned symbol.

TikZKit previously approximated some of the second control points with
`.4`/`.512`. That visibly changes the shoulder of a scaled or rotated wave.
`circuitikzWaveformSymbolItem` now emits the exact PGF sequence for all
sinusoidal source owners.

## References And Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion uses
`/opt/homebrew/bin/rsvg-convert`.

Inspected artifacts:

- before: `/private/tmp/tikzkit-qa-circuitikz-2026-08-06/`;
- after: `/private/tmp/tikzkit-qa-circuitikz-waveform-fix-2026-08-06/`.

Both contain `mactex-png/`, `tikzkit-svg/`, `tikzkit-png/`,
`tikztosvg-svg/`, `tikztosvg-png/`, and `diff/`. The inspected panels are the
three `diff/*-sheet.png` files for controlled sinusoidal sources, independent
sinusoidal sources, and waveform rotation.

Tikztosvg's source SVG uses path data under a global Y-flip. Its first
controlled-wave path has the same source-relative controls as TikZKit after
this change: the `.326/.638` sine controls and `.362/.674` cosine controls.

## Visual Result

Before, the internal sine in `controlled-sinusoidal-sources` had subtly
asymmetric shoulders after scaling with `csources/scale=1.2`; its geometry was
not the shape created by the local PGF primitives. After the correction, the
diamond outline, waveform, external `+/-`, current arrow, and labels preserve
their existing placement while the wave itself uses the native curve.

The rotation control is a clean visual acceptance case. Registered TikZKit vs
tikztosvg mean absolute RGBA difference for
`circuitikz-waveform-symbol-rotation` falls from `0.0000336` to `0.00000145`
(six raster pixels remain). The controlled-sinusoidal reference also improves
under aligned comparison from `0.02793` to `0.02757`. These values support,
but do not replace, inspection of the waveform shoulders and symbols.

Residual differences are browser-versus-TeX glyph rasterization and a small
canvas-height/bbox difference in the controlled-source sheet; no symbol,
polarity marker, wire, or label is missing.

## Implementation And Verification

- `src/engine/evaluate.js`: use the exact PGF sine/cosine cubic control points.
- `test/circuitikz-controlled-sinusoidal-sources.test.js`: assert every
  source-relative control point, so later waveform work cannot reintroduce an
  approximation.

```bash
node --test test/circuitikz-*.test.js
npm run examples:render -- --only circuitikz-controlled-sinusoidal-sources \
  --only circuitikz-sinusoidal-sources --only circuitikz-waveform-symbol-rotation \
  --output /private/tmp/tikzkit-qa-circuitikz-waveform-fix-2026-08-06 \
  --native-reference --tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-circuitikz-waveform-fix-2026-08-06 \
  --register --alignment-radius 3
```

The focused circuitikz suite passes 14 tests with two local-corpus tests
skipped because `work/circuitikz` is not present. All three real drivers
generated TikZKit, tikztosvg, MacTeX, and diff artifacts successfully.

## Remaining Work

- Controlled square and triangular source families remain unimplemented.
- The full custom bipole catalogue, source-specific fill defaults outside the
  DC slice, transformer variants, and dot anchors are still partial.
- Browser text/bbox calibration remains a shared renderer task, not a
  circuitikz-only constant tweak.
