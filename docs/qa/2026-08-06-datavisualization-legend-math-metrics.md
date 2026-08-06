# Datavisualization Styled Math Legend Metrics

## Scope

This acceptance slice covers `datavisualization` legends whose labels are
TikZ nodes with an explicit node style, such as a drawn rectangle supplied by
`legend={label style={node style=draw}}` or a per-entry
`node style={circle,draw=red}`. It does not claim complete data
visualization or arbitrary legend-matrix parity.

## Local references reviewed

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.code.tex`
  - `every label in legend` supplies the label-node style.
  - line visualizer samples use physical `em`/`ex` legend coordinates.
  - the legend renderer typesets the label node and example in the same
    legend-entry scope.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-dv-visualizers.tex`
  - documents `label in legend`, line visualizers, and legend placement.
- `/Library/TeX/texbin/tikztosvg`
  - generated the independent SVG reference. Its rectangle around `\\log x`
    is about 18.66pt wide and its `x/2` circle is about 18.12pt across.

## Driver and artifacts

- Fixture: `test/fixtures/examples/workbench/datavisualization-legend-math-metrics.tex`
- MacTeX native PNG, TikZKit SVG/PNG, tikztosvg SVG/PNG, grids, and diff sheet:
  `/private/tmp/tikzkit-qa-datavis-legend-math-after-2026-08-06`
- Visual sheet inspected:
  `/private/tmp/tikzkit-qa-datavis-legend-math-after-2026-08-06/diff/datavisualization-legend-math-metrics-native-sheet.png`

## Visual result

Before the correction, the TikZKit `\\log x` rectangle was `0.9909cm` wide,
which visibly pushed the outside legend and enlarged the canvas. The native
and tikztosvg references are compact at roughly `0.65cm`.

After the correction, the TikZKit rectangle is `0.5655cm` wide and the
`x/2` circle is `0.64cm` across. The reviewed sheet shows the two label frames
aligned with the reference scale and no longer forcing extra right-side legend
space. Curves, axes, and legend sample paths are unchanged. Remaining pixels
are formula glyph outlines and antialiasing, not missing content or layout
translation.

## Implementation and checks

- `src/engine/evaluate.js`
  - Styled datavis legend math labels now bypass renderer line-box metrics only
    while node size is calculated. The SVG math renderer still draws the
    formula, so the layout correction does not replace the rendering path.
- `src/frontend/latex-shell.js`
  - Existing `tikzkit datavis legend math metrics` marker keeps this behavior
    scoped to label-style legend nodes.
- `test/extensions.test.js`
  - Existing focused regression checks rectangle and circle dimensions.

Commands run:

```bash
node --test --test-name-pattern="compact datavisualization legend math metrics" test/extensions.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-datavis-legend-math-after-2026-08-06 \
  --only datavisualization-legend-math-metrics \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-datavis-legend-math-after-2026-08-06 \
  --only datavisualization-legend-math-metrics
```

## Remaining boundary

Native legend matrix layout, custom legend visualizers, arbitrary text/font
combinations, and the complete PGF data-visualization survey/object pipeline
remain partial. This slice only establishes compact metrics for styled inline
math labels in the supported function-data legend lowering.
