# circuitikz independent sinusoidal sources visual QA (2026-08-06)

## Scope

Implement the independent sinusoidal source slice only: `sV`, `sI`, their
`vsourcesin`/`isourcesin` and named-style aliases, `sources/scale`,
`sources/symbol/thickness`, the external `sI=$...$` marker, and the
`bipoles/isourcesin/angle` open current-source outline. Controlled sinusoidal
sources, `sources/symbol/rotate` including `auto`, source fills, and other
waveforms are deliberately outside this change.

Driver source: `test/fixtures/examples/circuitikz/sinusoidal-sources.tex`.

## Local MacTeX Review

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex`,
  lines 2928-2947: `sV` and `sI` share the sinusoidal symbol; the current
  source becomes an open shape when `bipoles/isourcesin/angle=80`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcirc.defines.tex`,
  lines 1058-1061: `sources/scale` is the independent-source scale class.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex`,
  lines 1937-1975 and 2270-2278: default dimensions, source-symbol line
  thickness, and rotation defaults.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex`,
  lines 2384-2407 and 3353-3383: the closed `sV` circle, the two open `sI`
  arcs, and the four PGF sine/cosine cubic segments.

## Three-way Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. MacTeX used local `pdflatex`.

Artifacts are intentionally ignored by Git:

- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-sinusoidal-sources-2026-08-06/tikzkit-svg/circuitikz-sinusoidal-sources.svg`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-sinusoidal-sources-2026-08-06/tikztosvg-svg/circuitikz-sinusoidal-sources.svg`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-sinusoidal-sources-2026-08-06/mactex-png/circuitikz-sinusoidal-sources.png`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-sinusoidal-sources-2026-08-06/diff/circuitikz-sinusoidal-sources-sheet.png`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-sinusoidal-sources-2026-08-06/diff/circuitikz-sinusoidal-sources-native-sheet.png`

The tikztosvg SVG has `viewBox="0 0 85.84 104.47"`. Its source paths show a
`0.79701pt` lead, `1.59404pt` outline, and `2.39107pt` internal wave; the
expected `1:2:3` ratio confirms that `sources/symbol/thickness=1.5` affects
only the wave. Its `sI` outline consists of two arc subpaths from `80` to
`-80` and `100` to `260` degrees, which is the geometry used by TikZKit.

## Visual Review

Viewed the TikZKit/tikztosvg grid sheet, the MacTeX/TikZKit/tikztosvg native
sheet, all individual panels, and the pixel diff.

Before this change TikZKit rendered one undersized `sV` with a two-curve wave;
both `sI` paths fell back to uninterrupted wires. Its canvas was `115x106px`
against tikztosvg's `115x140px`. After the change, all three source bodies,
the four-cubic S wave, the scaled outer diameter, the `I` marker and arrow,
and the third source's top/bottom opening visibly match the local references.
The source-label node now keeps the real math glyph bounds, so the JS canvas
is also `115x140px` and no longer clips `$V$`.

The diff is now primarily glyph rasterization, cubic rounding, and the small
anti-aliasing halo around otherwise coincident source strokes: changed ratio
`0.11478`, mean absolute RGBA difference `0.02883`. Those figures are only
supporting evidence; the accepted visual change is the recovery and placement
of the missing two current sources and their native source geometry.

## Verification

```bash
node --test test/circuitikz-sinusoidal-sources.test.js \
  test/circuitikz-batteries.test.js \
  test/circuitikz-controlled-sources.test.js \
  test/circuitikz-voltage-polarity.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-circuitikz-sinusoidal-sources-2026-08-06 \
  --only circuitikz-sinusoidal-sources --native-reference \
  --comparison-grid-mode svg --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-circuitikz-sinusoidal-sources-2026-08-06
```

The focused tests pass with no diagnostics. Full Circuitikz support remains
partial; the omitted source families above should be handled as separate,
visual-reference-driven slices.
