# PGFPlots Legend SVG Text Anchor

## Scope

This slice fixes one shared renderer behavior: cached browser SVG text must
use an explicit `start` or `end` anchor coordinate when an IR text node has
one. It is exercised by PGFPlots legends, but is renderer-wide rather than a
case-specific legend adjustment.

The real driver is
`test/fixtures/examples/latex-examples/2d-epochs-overfitting.tex`. Its axis
uses `legend cell align=left` and emits the entries `Training set` and
`Validation set`.

Implemented: cached plain-text SVG with `svgTextAnchor=start|end` and
`svgTextX`. Not included: PGFPlots legend matrix spacing, complete formula
measurement, legend placement calibration, or final browser/TeX bounding-box
parity.

## Audited Input Surface

`npm run case:audit` recorded three packages (`pgfplots`, `tikz`, `xcolor`),
three libraries (`positioning`, `decorations.text`,
`decorations.pathmorphing`), and the commands `\\addplot`,
`\\addlegendentry`, `\\draw`, `\\definecolor`, and `\\tikzstyle` inside an
`axis`/`tikzpicture` document. The relevant axis parameters are
`legend pos=north east` and `legend cell align=left`; the same axis also uses
`width=14cm`, `height=8cm`, middle x/y axes, `grid=major`, `xmin=0`,
`xmax=104`, `ymin=0`, `ymax=.98`, labels, outside ticks, and a custom y-label
position. The four plots use the `training`/`testing` styles, 200 samples, and
their documented domains. The remaining draws exercise dashed separators,
text-along-path decoration, and a `latex[scale=3.0]` arrow.

Only the legend-cell anchor is accepted in this slice. The audit still marks
the wider case incomplete because its other commands, numeric values, styles,
and expressions have not all been individually re-reviewed for this change.

## Local MacTeX Study

Read `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`:

- Lines 1095-1103 define `every axis legend`: a rectangular white, stroked
  matrix with default `cells={anchor=center}`.
- Lines 1983-1991 map `legend cell align=left` to
  `legend style={cells={anchor=west}}`; `right` maps to `east`.
- Lines 5925 onward assemble legend samples and entries as a TikZ matrix.

The text rows therefore share a semantic west anchor. Their placement is not
the center of an independently measured text box.

## Reference Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. The real fixture was regenerated with local
MacTeX (`pdflatex`), TikZKit, and tikztosvg:

- Artifact root:
  `/private/tmp/tikzkit-qa-pgfplots-legend-anchor-after-2026-08-06/`
- TikZKit SVG/PNG:
  `tikzkit-svg/latex-examples-2d-epochs-overfitting.svg` and
  `tikzkit-png/latex-examples-2d-epochs-overfitting.png`
- tikztosvg SVG/PNG:
  `tikztosvg-svg/latex-examples-2d-epochs-overfitting.svg` and
  `tikztosvg-png/latex-examples-2d-epochs-overfitting.png`
- MacTeX native PNG:
  `mactex-png/latex-examples-2d-epochs-overfitting.png`
- Inspected four-panel sheet:
  `diff/latex-examples-2d-epochs-overfitting-native-sheet.png`

The tikztosvg SVG uses reusable glyph paths and `<use>` placements rather than
browser `<text>` or `foreignObject`; text placement is therefore represented by
the individual glyph coordinates. TikZKit emits browser text, so it must carry
the corresponding resolved west/east anchor explicitly through its cache
wrapper.

## Visual Result

Before the change, the cached `Training set` and `Validation set` groups were
translated from separate centered-node positions. The second row shifted right
relative to the first and the right end of the legend could be cut by the SVG
viewBox.

After the change, both emitted groups use `translate(974, ...)` with
`text-anchor="start"`. In the inspected TikZKit panel both full labels are
inside the legend frame and share one visible left edge, matching the intended
PGFPlots alignment. Curves, grid, axis labels, and the previously corrected
legacy arrow remain unchanged.

The remaining visual gap is explicit: TikZKit is still 534x275px while the
tikztosvg reference is 517x267px, and its legend box is not yet perfectly
calibrated horizontally. The current fix solves the incorrect anchor/cropping,
not complete legend layout parity. The registered TikZKit-versus-tikztosvg
diff is 11.55% changed pixels with mean absolute RGBA 0.02589; it is supporting
evidence only.

## Implementation And Verification

- `src/renderers/svg/plainTextNode.js`: cached text now translates from
  `svgTextX` whenever an explicit SVG anchor exists; unanchored nodes retain
  their existing center/left/right placement logic.
- `test/svg-renderer.test.js`: regression checks that a cached `start` anchor
  at `svgTextX=3` renders at x=300 for a 100-unit SVG scale, not at the node's
  centered x=5.
- `src/packages/pgfplots.js` and the generated extension registry record the
  reviewed local rule and retained partial boundary.
- `README.md` and `docs/usage.md` document a repeatable real-chart legend QA
  workflow.

```bash
node --test --test-name-pattern='svg text engine honors explicit SVG text anchors' \
  test/svg-renderer.test.js
node scripts/render-example-fixtures.js \
  --output /private/tmp/tikzkit-qa-pgfplots-legend-anchor-after-2026-08-06 \
  --only latex-examples-2d-epochs-overfitting \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --external-timeout-ms 120000
node scripts/diff-example-pngs.js \
  --output /private/tmp/tikzkit-qa-pgfplots-legend-anchor-after-2026-08-06 \
  --register --alignment-radius 3
npm run extension-registry
```

The new targeted renderer test passes; the fixture reports no diagnostics and
all three reference families were generated and inspected. Broader PGFPlots
legend tests retain two pre-existing formula-width calibration failures, so this
does not claim the complete PGFPlots legend suite is green.

## Next Work

1. Calibrate legend matrix cell width, padding, and box position against TeX
   for long and formula-heavy entries.
2. Continue final text and bbox measurement work without changing explicit
   anchor semantics.
