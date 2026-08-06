# `arrows.meta` Latex Edge Tips And Circular Stroke Bounds

## Scope

This slice fixes the physical SVG bounds for a stroked circular or elliptical
TikZ node when it participates in a path using an `arrows.meta` tip. The
driver is the real gallery fixture
`test/fixtures/examples/latex-examples/feed-forward-perceptron.tex`, whose
edge style is:

```tex
\tikzstyle{arrow}=[arrows={{Latex[scale=0.5]}-}, thick]
```

The scope is deliberately limited to the shared node-bound calculation. It
does not add composite arrow tips, arbitrary arrows.meta setup-code keys,
padding/separation keys, or the complete legacy arrows API.

## Local MacTeX Study

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex`,
  especially the `Latex` declaration around lines 806-900;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`;
- the existing `src/tikz/metrics.js:latexArrowGeometryFromLineWidth` and
  `src/renderers/svg/paths.js:inlineArrowGeometry` implementations.

The local declaration defines capitalized `Latex` with a line-width-dependent
length, `width'`, and a capped outline width. The source direction in
`Latex[scale=0.5]-` places a scaled Latex tip at the path start, not at the
target end. The current engine already matched that geometry and endpoint
shortening. The remaining error was the picture bounding box: SVG ellipse
strokes paint half their width outside their radius, whereas rectangle renderers
already inset their geometry by that half-width.

## Implementation

- `src/engine/evaluate.js` marks circular and elliptical node boxes as needing
  normal stroke-bound expansion. Their anchors and edge endpoints stay on the
  original TikZ border; only their rendered picture bounds gain the visible
  half-stroke.
- `test/interpreter.test.js` verifies a circular-node `Latex[scale=0.5]-`
  edge has the enlarged SVG viewBox and an inline Latex arrow tip.
- `test/renderer.test.js` now expects a direct stroked circle to include its
  complete one-unit stroke in the viewBox.
- `src/tikz/libraries/arrows.meta.js` and the generated extension registry
  record the verified bound behavior and its remaining limits.

## Three-Renderer Evidence

`command -v tikztosvg` resolved to `/Library/TeX/texbin/tikztosvg`; PNG output
was made with `/opt/homebrew/bin/rsvg-convert`.

Artifacts are under `/private/tmp/tikzkit-qa-feed-forward-after-2026-08-06/`:

- MacTeX PNG: `mactex-png/latex-examples-feed-forward-perceptron.png`;
- TikZKit SVG/PNG: `tikzkit-svg/latex-examples-feed-forward-perceptron.svg`
  and `tikzkit-png/latex-examples-feed-forward-perceptron.png`;
- tikztosvg SVG/PNG: `tikztosvg-svg/latex-examples-feed-forward-perceptron.svg`
  and `tikztosvg-png/latex-examples-feed-forward-perceptron.png`;
- aligned comparison/diff sheet: `diff/latex-examples-feed-forward-perceptron-native-sheet.png`
  and `diff-png/latex-examples-feed-forward-perceptron-registered.png`.

The tikztosvg SVG uses native filled/stroked path tips with transform matrices;
TikZKit uses an inline cubic tip path and a `translate(...) rotate(...)`
transform. Both now declare `152.09pt` by `95.4pt` canvases. Before the fix,
TikZKit declared `151.69pt` by `95pt`, omitting 0.2pt on every outside edge.
That changed its raster scale and made every node perimeter and edge differ.

After the fix, the inspected JS and tikztosvg panels have matching node centers,
outer circles, arrow direction, line attachment, and canvas dimensions. The
registered JS/tikztosvg diff falls from 3,680 changed pixels (14.27%) to 330
(1.27%). The remaining red pixels are small anti-aliased Latex tip outlines;
there are no missing or displaced elements. The MacTeX panel has the same
network geometry; its separate DVI/PDF raster pipeline still differs in
antialiasing and page crop, so its numeric score is not used as the acceptance
criterion.

## Validation

```bash
node --test --test-name-pattern='stroked circular node outlines|arrows.meta value syntax' test/interpreter.test.js
node --test --test-name-pattern='includes circular node boxes' test/renderer.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-feed-forward-after-2026-08-06 \
  --only latex-examples-feed-forward-perceptron --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg --external-timeout-ms 15000
npm run examples:diff -- --output /private/tmp/tikzkit-qa-feed-forward-after-2026-08-06 \
  --register --alignment-radius 3
```

The focused tests pass and all three artifact families were generated without
TikZKit diagnostics. A broad renderer/interpreter run still contains unrelated
existing coordinate and rich-text failures, so it is not treated as a green
gate for this narrow change.

## Next Work

1. Extend the same renderer-aware stroke contract to specialized circular
   split/overlay shapes after separate native comparisons.
2. Compare arrows.meta scaled tips at non-cardinal angles with mixed custom
   width/length settings.
3. Continue the case-by-case corpus pass with an independently visualized
   feature slice rather than using aggregate diff numbers alone.
