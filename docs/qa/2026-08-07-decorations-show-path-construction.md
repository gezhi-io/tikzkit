# `decorations.pathreplacing`: show path construction

## Scope

This pass implements the documented `show path construction` callback family:
`moveto code`, `lineto code`, `curveto code`, and `closepath code`. The driver is
the official PGF manual example, added as
`decorations/pathreplacing-show-path-construction.tex`.

It deliberately covers one library feature rather than expanding all path
decorations. Callback bodies are parsed by the regular TikZ interpreter, so
ordinary `\\draw`, `\\fill`, inline nodes, colors, and arrow options remain shared
behavior rather than case-specific SVG construction.

## Local source reading

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathreplacing.code.tex`
  - Lines 192--217 declare the `show path construction` state machine. It runs
    one callback per input-segment type and installs the current input segment's
    points before evaluating it.
  - Lines 221--240 bind the four callback keys and expose first/last/support
    points.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`
  - Lines 513--589 provide the exact fixture and specify that the decoration
    automaton transformation is disabled while callback code runs.

TikZKit preserves that separation by storing the already-resolved source path
and parsing callback code with an identity coordinate frame. This avoids
applying picture/scope coordinates to injected first/last/support points twice.

## Visual evidence

Artifacts are stored outside the repository:

- Before: `/private/tmp/tikzkit-qa-show-path-before-2026-08-07`
- After: `/private/tmp/tikzkit-qa-show-path-after-2026-08-07`

Each directory contains the TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG,
and a four-panel native comparison sheet with the 1cm grid.

Before the change, TikZKit rendered only the helper grid because the source
`\\path[decorate]` has no paint action. MacTeX and tikztosvg both rendered a red
move marker, blue input line, two green cubic arc pieces, and an orange close
edge. After the change, TikZKit renders the same five callback outputs, with
the arrow tips, per-segment labels, and cubic control geometry present. The
remaining raster difference is mostly independent SVG text metrics and output
bounds around rotated labels; it is not a missing or displaced path segment.

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. Its SVG uses separate
paths for the two cubic pieces, with `stroke-linecap=butt`, `stroke-linejoin=miter`,
and end-arrow geometry. TikZKit now follows that segment decomposition and
emits matching separate arrowed paths. The reference's text is produced through
TeX glyph paths, whereas TikZKit uses its SVG text engine, so font-outline
pixel identity is still outside this slice.

## Implemented inputs

- `decoration={show path construction,...}`, plus `decorate`
- `moveto code`, `lineto code`, `curveto code`, `closepath code`
- `\\tikzinputsegmentfirst`, `\\tikzinputsegmentlast`,
  `\\tikzinputsegmentsupporta`, `\\tikzinputsegmentsupportb`
- callback bodies using the existing normal TikZ command subset, including
  draw/fill paths, inline nodes, colors, and arrow options

Not yet complete: arbitrary TeX-only callback execution, low-level
`\\pgfpointdecoratedinputsegment...` macros, callbacks carrying complex macro
definitions, and exact non-linear brace behavior.

## Verification

```sh
node --test --test-name-pattern='show path construction callbacks' test/interpreter.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-show-path-after-2026-08-07 \
  --only decorations-pathreplacing-show-path-construction \
  --native-reference --strict-tikztosvg
node scripts/diff-example-pngs.js --output /private/tmp/tikzkit-qa-show-path-after-2026-08-07
```
