# Native Scatter Legend Cells

## Scope and Status

This pass targets one datavisualization feature family: default/east-outside,
one-column legends with circular scatter samples. The existing failure and the
source-ordered random scatter example showed visibly excessive legend spacing.
Varying axis widths, tall fractions and local label fonts expose the shared cause.
This is not full datavisualization or function-format compatibility.

The implementation improves all three selected browser comparisons. The full
explicit test suite changes from 27 failures to 26, with no newly failing names.
No npm login, release, version change or remote push was attempted.

## Local Source Review

All paths below are under `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/`.

- `frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.code.tex`:
  every-ticks settings supply `inner sep=1pt`, `outer sep=.1666em`; dataset labels
  select `\small`. Legend text-right adds `.333em` and anchors at `mid west`.
  Cell text inserts struts of `.75em` height and `.25em` depth. The outer matrix
  uses the completed visualization bounds, an 8pt outside offset and native padding.
- `modules/pgfmodulematrix.code.tex`: cells contribute independent height/depth
  and column extents. Tall formulas expand adjacent row distances; a fixed stride
  cannot reproduce this layout.
- `modules/pgfmoduleshapes.code.tex`: `local bounding box` records only local
  contributions and leaves a globally addressable rectangle. It must not include
  unrelated earlier graphics.
- `frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.formats.functions.code.tex`:
  the TikZ loader delegates to datavisualization and the PGF function-format library.
  No function sampler or random-number algorithm is changed in this pass.

CMR9's fontdimen6 is 9.25pt, not 9pt. Native font metrics therefore drive the
struts, while the surrounding normal-size CMR10 x-height drives the mid anchor.
The independent `test/fixtures/datavis-scatter-legend/metrics.ltx` probe records
cell boxes and named anchors. The default case also uses the preceding
`test/fixtures/native-node-text/legend-metrics.tex` probe.

## Commands and Parameters

Covered fixtures use `\datavisualization`, `scientific axes=clean`, explicit axis
limits/ticks/grid/length, `visualize as scatter`, named sets, `data [format=function]`,
`var`, `func`, `rand`, `\pgfmathsetseed`, `label in legend`, `mark=*`, `mark=o`,
`mark size`, default placement and `legend={east outside}`. Existing sampling and
axis logic are regression controls, not newly completed capabilities.

New layout handles plain CM text, inline math, a display fraction, descenders,
and label-local `\small`/`\scriptsize` fonts. Shared support fixes `anchor=base west`,
`local bounding box`, nested/background scopes and invisible local paths.

Custom sample coordinates, multiple samples, noncircular marks, text-left/text-only
entries, named/shaped label nodes, multicolumn matrices and other placements keep
the existing fallback. Arbitrary surrounding fonts, matrix styling, transformed
outer pictures and complete custom-visualizer semantics remain outside acceptance.
The default normal 10pt surrounding font is an explicit limitation of this slice.

## Implementation

- `src/tikz/libraries/datavisualizationLegend.js` contains the bounded native cell
  layout, independently measured CM boxes, per-row packing and hollow-circle paint.
- `src/frontend/latex-shell.js` routes eligible entries through that helper and
  propagates the source math-extension setting. The complete axis is enclosed in
  a local bounding box before its legend is emitted.
- `src/engine/evaluate.js` records local contributions incrementally, supports
  mid-scope anchors, and uses the same native hbox for base anchors and glyph paint.
- `src/renderers/svg/document.js` retains six-decimal physical dimensions, matching
  viewBox precision. Rounding root dimensions to two decimal points distorted
  aspect ratio and introduced zoom-dependent browser glyph displacement.

## Reference Environment

`command -v tikztosvg` returned `/Library/TeX/texbin/tikztosvg` (0.3.0).
The reference uses local TeX Live 2025 `pdflatex`, with `rsvg-convert` 2.63.0 for
SVG-to-PNG conversion and separate MacTeX PDF-to-PNG rendering. Nothing was installed.

The multirow fixture explicitly loads `amsmath` and `plotmarks`. The local
tikztosvg wrapper preloads these, so an unqualified native input otherwise uses a
different fraction depth and lacks the hollow-mark definition. Both JS and native
now receive these explicit dependencies. The early before capture did not yet
declare them; do not interpret its fraction-depth difference as pure code progress.

Reference SVG inspection found circular paths, 0.3985bp strokes, butt/miter defaults,
nonzero filling, a y-reversing transform and outline glyphs referenced with `use`.
A 1.5pt sample has a 1.495562bp reference radius. JS retains native MacTeX font
assets and glyph-positioned SVG text instead of substituting HTML/foreignObject.
Reference glyph outlines and browser text still differ in raster antialiasing.

## Visual Evidence

Artifacts are local, generated and ignored by Git:

- Before: `outputs/qa/2026-10-25-datavis-scatter-legend-before/`
- After: `outputs/qa/2026-10-25-datavis-scatter-legend-after/`
- After page: `outputs/qa/2026-10-25-datavis-scatter-legend-after/browser-audit.html`
- 3D controls: `outputs/qa/2026-10-25-datavis-scatter-legend-3d-controls/`

Each selected case has `tikzkit-svg/`, `tikzkit-png/`, `tikztosvg-svg/`,
`tikztosvg-png/`, `mactex-png/` and browser sheets/diffs. All three final
MacTeX images and JS/reference/before/diff browser sheets were inspected.

| Case | Visible change | Browser glyph gate at 3x |
| --- | --- | --- |
| `scatter-default-legend` | Excessive right-side gap removed; marker and text share native baseline placement | 39 origins, maximum error 0.0174px |
| `scatter-mixed-row-heights` | Tall fraction no longer collides with adjacent text; row gaps follow individual boxes; final circle is hollow | 51 origins, maximum error 0.0278px |
| `scatter-wide-axis` | Legend offset no longer grows with axis width; mixed text/math shares the native baseline | 35 origins, maximum error 0.0179px |

Both default-browser and SVG-text modes pass the unchanged 0.09px threshold.
Comparison uses a fixed physical scale and translation from the first gray grid
path, not a fitted scale or a text-dependent alignment. There are no browser errors
or new diagnostics. Small raster edge differences remain; this is not pixel identity.

All seven 3D control sheets were also inspected. Axis labels, grid projection and
clipped/unclipped surface extents retain their prior geometry acceptance at 0.35px.
The combined 3D audit still exits nonzero because `surface-survey-explicit-meta`
has an existing color difference: JS `[128,128,255]`, reference `[127,127,255]`.
It is unchanged before/after, and the strict color gate was not relaxed.

## Reproduction and Tests

```sh
node --test test/datavis-scatter-legend-layout.test.js
node --test --test-reporter=./scripts/module-test-reporter.js \
  --test-reporter-destination=outputs/qa/2026-10-25-datavis-scatter-legend-after/test-final.json \
  test/*.test.js
npm run check:architecture
npm run docs:links
node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/datavis-scatter-legend \
  --output outputs/qa/2026-10-25-datavis-scatter-legend-after \
  --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --strict-tikztosvg
node scripts/audit-module-regressions.js \
  --fixtures test/fixtures/datavis-scatter-legend \
  --output outputs/qa/2026-10-25-datavis-scatter-legend-after \
  --before outputs/qa/2026-10-25-datavis-scatter-legend-before \
  --browser-module /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
/Library/TeX/texbin/pdflatex -interaction=batchmode -halt-on-error \
  -output-directory=/tmp -jobname=tikzkit-scatter-legend-metrics \
  test/fixtures/datavis-scatter-legend/metrics.ltx
```

Focused tests: 8/8 pass. Final full suite: 3056 tests, 3016 pass, 26 fail,
14 skip, no cancellation. Baseline: 3048 tests, 3007 pass, 27 fail, 14 skip.
The one previously failing test now uses independent native probe coordinates
instead of the old fitted 6.14cm/6.315cm offsets; actual placement changed as well.
Five formerly passing serialization tests retain their native numeric expectations
while accepting the increased SVG dimension precision. These are contract updates,
not five additional rendering fixes. No browser tolerance was loosened.

## Remaining Work

The 26 full-suite failures remain tracked in `test-final.json`. Next investigate
the inside/text-only legend's background box against native matrix measurement;
do not simply replace its expected width. General matrix placement, outer font
contexts, noncircular legend samples and the existing 3D color quantization issue
still require their own native/browser evidence. Both datavisualization registry
entries remain `partial`.
