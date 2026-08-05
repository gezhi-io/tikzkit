# circuitikz controlled sinusoidal sources visual QA (2026-08-06)

## Scope

Implement controlled sinusoidal voltage/current sources only: `csV`, `csI`,
`cvsourcesin`, `cisourcesin`, `controlled vsourcesin`, `controlled
isourcesin`, the complete controlled-sinusoidal style names, direction
suffixes, `csources/scale`, `csources/symbol/thickness`, and external `v/i`
or `l=` labels. Source rotation, fills, and DC/square/triangular source
families are outside this change.

Driver source: `test/fixtures/examples/circuitikz/controlled-sinusoidal-sources.tex`.

## Local MacTeX Review

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex`,
  lines 2970-2971: documented aliases are `controlled vsourcesin`,
  `cvsourcesin`, `csV` and their current-source counterparts.
- The same manual, lines 3157-3159: dependent source symbols use the separate
  `csources/symbol/thickness` class, not `sources/symbol/thickness`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex`,
  lines 1956-1958 and 3454-3520: a `csources`-scaled diamond is drawn first,
  then a four-segment PGF sine/cosine wave at half its vertical extent.
- The same source, lines 3855-3860 and 3949-3953: exact voltage/current alias
  mappings, including directional `csV...` / `csI...` label forms.

## Three-way Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. MacTeX used local `pdflatex`.

Artifacts are intentionally ignored by Git:

- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-controlled-sinusoidal-sources-2026-08-06/tikzkit-svg/circuitikz-controlled-sinusoidal-sources.svg`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-controlled-sinusoidal-sources-2026-08-06/tikztosvg-svg/circuitikz-controlled-sinusoidal-sources.svg`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-controlled-sinusoidal-sources-2026-08-06/mactex-png/circuitikz-controlled-sinusoidal-sources.png`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-controlled-sinusoidal-sources-2026-08-06/diff/circuitikz-controlled-sinusoidal-sources-sheet.png`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-controlled-sinusoidal-sources-2026-08-06/diff/circuitikz-controlled-sinusoidal-sources-native-sheet.png`

The tikztosvg SVG has `viewBox="0 0 85.84 110.1"`. Its controlled-source
outline is a closed diamond with `1.59404pt` stroke. With
`csources/symbol/thickness=1.5`, its internal waveform is `2.39107pt`,
confirming the `1:1.5` outer/wave ratio. Each wave has four cubic segments;
the `csI` current label is attached once to an external arrow, not duplicated
at the diamond center.

## Visual Review

Viewed the TikZKit/tikztosvg grid panels, MacTeX panel, JS/tikztosvg diff
panel, and MacTeX/JS/tikztosvg sheet.

Before implementation TikZKit emitted only three uninterrupted horizontal
wires on a `115x77px` canvas. MacTeX and tikztosvg both showed three scaled
diamonds with four-cubic waves, the upper `g v_x` voltage label, one `g i_x`
current annotation, and a bottom `l=$\mu v_x$` label. After the shared
controlled-source implementation, all three diamonds and waves are present;
the plain controlled current-arrow and European voltage line are absent as
they should be. A follow-up semantic correction removes the duplicate central
`g i_x`, leaving only the native external annotation.

The final TikZKit canvas is `114x145px` versus tikztosvg's `115x147px`.
The residual is the renderer's endpoint-stroke and text-bbox rounding, plus
glyph rasterization and cubic antialiasing; the inspected panels no longer
show missing or misplaced circuit elements. The supporting JS/tikztosvg diff
is `0.21815` changed pixels and `0.09683` mean absolute RGBA, measured after
the element recovery rather than used as the acceptance criterion.

## Verification

```bash
node --test test/circuitikz-controlled-sinusoidal-sources.test.js \
  test/circuitikz-sinusoidal-sources.test.js \
  test/circuitikz-controlled-sources.test.js \
  test/circuitikz-voltage-polarity.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-circuitikz-controlled-sinusoidal-sources-2026-08-06 \
  --only circuitikz-controlled-sinusoidal-sources --native-reference \
  --comparison-grid-mode svg --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-circuitikz-controlled-sinusoidal-sources-2026-08-06
```

The focused tests pass with no diagnostics. Full Circuitikz support remains
partial; the excluded waveform and source-style families should be handled as
separate visual-reference-driven slices.
