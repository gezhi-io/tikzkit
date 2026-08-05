# Case 005 Snake Endpoint Phase QA (2026-08-06)

## Scope

This correction is limited to `decorations.pathmorphing` `snake` paths using
`pre length`, `segment length`, `amplitude`, `post length`, and a terminal
arrow. It does not claim complete support for zigzag or arbitrary curved-corner
decoration behavior.

Driver: `test/fixtures/examples/decorations/snake-arrow-lengths.tex`.

```tex
\draw[-stealth, decoration={snake, pre length=0.01mm,
  segment length=2mm, amplitude=0.3mm, post length=1.5mm},
  decorate, thick, red] (hs1) -- (s1);
```

## Local MacTeX Review

Reviewed local TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.code.tex`:
  `tikz@internal` constructs consecutive `pre`, `main`, and `final` meta-decoration
  states. `pre length` and `post length` bound the decoration itself.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathmorphing.code.tex`:
  `snake` uses the native `.3125 * segment length` start/end states and alternating
  cosine/sine half waves.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex`:
  the decoration automaton advances across the composed input path and exposes the
  final decorated point independently of later paint operations.

The key implementation rule is therefore: arrow-tip shortening happens after
the `snake` meta-decoration. It must not be added to `pre length` or `post length`.

## Reference Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`; MacTeX native rendering used `pdflatex`.

Ignored reproducible artifacts:

- `outputs/qa-snake-arrow-lengths-before-2026-08-06/`
- `outputs/qa-snake-arrow-lengths-after-2026-08-06/`

Each directory contains the TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG,
1cm-grid variants, and comparison sheets. The tikztosvg SVG has a single red
stroke path with cubic `C` wave segments and a separate filled stealth-tip path;
the tip is not an SVG marker attached during decoration.

## Visual Review

Viewed the MacTeX/TikZKit/tikztosvg native sheet, the TikZKit/tikztosvg grid
sheet, the diff panel, and magnified SVG rasters. Before the correction, the
TikZKit wave ended about `1mm` early because arrow shortening was included in
the snake's effective length. This left a visibly overlong straight red lead
between the final trough and the arrow.

After the correction, the wave crest/trough phase reaches the same final cycle
as MacTeX and tikztosvg. The requested `0.01mm` initial lead, `2mm` wave pitch,
`0.3mm` amplitude, and arrow-to-wave spacing visibly align. The final
TikZKit/tikztosvg raster is `153x4px`; the supporting diff has three changed
antialiasing pixels (`0.00490%`) and no missing/displaced geometry.

## Change And Verification

- `src/engine/evaluate.js`: retains explicit decoration lengths and leaves
  terminal arrow shortening to the SVG arrow renderer.
- `test/snake-arrow-lengths.test.js`: verifies the explicit post length and
  guards that adding `-stealth` does not alter any snake curve endpoint.
- `test/interpreter.test.js`: keeps the same interpreter-level boundary.
- `src/tikz/libraries/decorations.pathmorphing.js`: records the verified scope
  for the generated extension registry.

```bash
node --test test/snake-arrow-lengths.test.js test/snake-polyline-continuity.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-snake-arrow-lengths-after-2026-08-06 \
  --only decorations-snake-arrow-lengths --native-reference \
  --comparison-grid-mode svg --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-snake-arrow-lengths-after-2026-08-06
```

The focused tests pass and the real driver shows a visible endpoint correction.
Remaining work: zigzag calibration and exact native normal changes at sharp
polyline corners or flattened curves.
