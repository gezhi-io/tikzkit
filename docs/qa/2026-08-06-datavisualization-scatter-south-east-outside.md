# Datavisualization South-East Outside Scatter Legend

## Scope

This acceptance slice covers a supported function-data scatter visualizer with
`legend={south east outside}`. It establishes the native placement of the
one-mark example and its text label from the data-visualization bounding box.
It does not claim arbitrary legend-matrix parity.

## Local references reviewed

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.code.tex`
  - `south east outside` sets `columns=1`, anchors the matrix at the data
    visualization bounding box's south-east corner, and applies `xshift=.8em`.
  - legend entries reserve a `.75em` height and `.25em` depth; a one-mark
    example has mark coordinates `(0,0)`.
  - `text right` uses a mid-west label anchor with `xshift=.333em`.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-dv-visualizers.tex`
  - documents `label in legend` and scatter visualizers.
- `/Library/TeX/texbin/tikztosvg`
  - generated the independent SVG reference. Its marker center is about
    `0.434cm` right and `0.281cm` above the data-area south-east corner.

## Driver and artifacts

- Fixture: `test/fixtures/examples/workbench/datavisualization-scatter-south-east-outside.tex`
- Before artifacts:
  `/private/tmp/tikzkit-qa-datavis-scatter-southeast-before-2026-08-06`
- After artifacts:
  `/private/tmp/tikzkit-qa-datavis-scatter-southeast-after-2026-08-06`
- Reviewed four-panel sheet:
  `/private/tmp/tikzkit-qa-datavis-scatter-southeast-after-2026-08-06/diff/datavisualization-scatter-south-east-outside-native-sheet.png`

## Visual result

Before the correction, the supported scatter legend used a fixed normalized
position. It put the marker and label too far right and lifted the marker away
from the native matrix baseline whenever the axis size changed.

After the correction, TikZKit derives the marker and label from the actual
axis dimensions. In the reviewed driver, its marker center is `0.457cm` right
and `0.281cm` above the data-area corner, versus tikztosvg at approximately
`0.434cm` and `0.281cm`. The text starts about `0.034cm` left of the
tikztosvg glyph origin, a small renderer-font side-bearing difference. The
Gaussian curve, deterministic random scatter marks, clean axes, and pin are
unchanged and remain present in all three outputs.

## Implementation and checks

- `src/frontend/latex-shell.js`
  - replaces fixed scatter legend fractions with physical `.8em`, `.5em`,
    `.333em`, and `1em` matrix terms derived from `axisWidth` and
    `axisHeight`.
- `test/extensions.test.js`
  - keeps a tight assertion for the real scatter legend's corrected label
    center.
- `test/fixtures/examples/manifest.json`
  - adds the visual driver to the maintained catalog.

Commands run:

```bash
node --test --test-name-pattern='datavisualization function data' test/extensions.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-datavis-scatter-southeast-after-2026-08-06 \
  --only datavisualization-scatter-south-east-outside \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-datavis-scatter-southeast-after-2026-08-06 \
  --only datavisualization-scatter-south-east-outside
```

## Remaining boundary

This work does not implement arbitrary multi-column legend matrices, custom
legend visualizer graphics, or the full PGF data-visualization object/survey
pipeline. Those remain partial.
