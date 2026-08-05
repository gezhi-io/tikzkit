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
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircvoltage.tex`,
  lines 318-361 and 411-437: sinusoidal source geometry does not own the
  polarity symbols. A nonempty American voltage label requests the generic
  outside-of-symbol routine, which places `+` at the source input and `-` at
  its output by default.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcirc.defines.tex`,
  lines 1211 and 1260-1270: the default American plus/minus glyphs and their
  source-label distance are separate from the waveform path.

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
at the diamond center. tikztosvg, like the native PDF conversion, emits the
polarity glyphs as reusable outlined glyph paths; TikZKit keeps them as real
SVG text nodes with centered anchors so its own text/bbox engine can measure
them.

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
The native and tikztosvg panels show `+`, `-`, and `$g v_x$` above the first
diamond. Before this follow-up, TikZKit showed only `$g v_x$`; after it, the
external pair appears on the correct left/right sides beneath the label. The
same shared path corrects the independent `sV=$V$` fixture. `l=$\\mu v_x$`
does not generate polarity, matching the native distinction between a
component label and a voltage label.

The registered mean absolute RGBA residual moves from `0.02751` to `0.02793`
for the controlled driver and from `0.02294` to `0.02324` for the independent
driver. This small increase is expected: the newly present TeX glyphs now
contribute browser-versus-TeX rasterization differences. Acceptance is the
visible recovery of the native polarity elements, not a misleading aggregate
pixel reduction. Remaining differences are source-label vertical spacing,
endpoint-stroke rounding, glyph rasterization, and cubic antialiasing.

## Verification

```bash
node --test test/circuitikz-controlled-sinusoidal-sources.test.js \
  test/circuitikz-sinusoidal-sources.test.js \
  test/circuitikz-controlled-sources.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-circuit-after \
  --only circuitikz-sinusoidal-sources,circuitikz-controlled-sinusoidal-sources \
  --preserve-output --native-reference --comparison-grid-mode svg \
  --strict-tikztosvg --external-timeout-ms 120000
npm run examples:diff -- --output /private/tmp/tikzkit-qa-circuit-after \
  --register --alignment-radius 3
```

The focused tests pass with no diagnostics. Full Circuitikz support remains
partial; `no v symbols`, custom American plus/minus text or distances,
controlled square/triangular/DC sources, fills, and the excluded waveform and
source-style families should be handled as separate visual-reference-driven
slices.
