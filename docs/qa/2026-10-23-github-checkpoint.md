# GitHub Repair Checkpoint - 2026-10-23

## Status

This is a work-in-progress source checkpoint, not an npm release or a claim of
whole-project visual parity. Package version remains 0.1.6.

The latest full test-file run reports **2947 tests: 2885 passed, 48 failed,
14 skipped, 0 cancelled**. Relative to the earlier 76-failure checkpoint,
the net failure count is down by **28**. The intermediate 46-failure report is
historical, not the count for this commit.

Since that intermediate run, 14 new focused tests pass and one existing
high-endpoint tick-label test passes. Three existing datavisualization
assertions now fail: two expect quarter-unit ticks over 0..2, and one expects
a tick beyond the surveyed maximum. Independent local PGF output instead
uses half-unit ticks and excludes that out-of-range tick. Those assertions
have not been silently changed or excluded from this run.

Failure-count reductions include both runtime repairs and documented migration
of old SVG serialization/measurement assertions to independently measured
native semantics. They are not a count of fully corrected visual examples.

## Included Work

- Native CM text/math boxes, optical faces, baseline/directional anchors,
  positive uniform math scaling and colored inline boxes.
- PGFPlots legend matrices, enlarged curve clipping, label/tick positioning,
  3D projection and annotations, quiver styles and colormap interpolation.
- Path-local endpoint nodes, local transforms and stroke bounds.
- Datavisualization logarithmic labels, pin geometry and linear tick planning.
- Independent TeX metric probes, regression fixtures and browser audit tools.

Detailed source reading, before/after observations and limitations are in:
[compact text and anchors](2026-10-23-compact-math-anchors.md),
[quiver and colors](2026-10-23-pgfplots-quiver-colors.md),
[3D annotations](2026-10-23-pgfplots-3d-annotations.md),
[path-local nodes](2026-10-23-path-node-scopes.md),
[native axis bounds](2026-10-23-pgfplots-native-seams.md), and
[earlier module repairs](2026-10-23-failure-repairs.md).

## Latest Linear Tick Slice

Reviewed local MacTeX source:
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.code.tex`,
especially tick styles near lines 577/634, linear tick generation near 1160,
about-count selection near 1255 and scientific defaults near 2567.

Implemented the surveyed range, phase-before-step calculation, span/1000
boundary tolerance and native about-five mantissa selection. Single-point
ticks retain the actual data value. Minor ticks cover partial outer intervals.
Numeric labels use native CMR8 boxes with 1pt inner and 1.666pt outer separation;
minor marks use 1.4pt length and round caps.

Independent probe: `test/fixtures/datavis-linear-tick-metrics.tex`.
For the positive-range fixture, native x-label centers are -12.24373pt from
the baseline and y-label centers are -13.91602pt from the axis. Tests compare
native units rather than screen-fit constants.

Local reference tool: `/Library/TeX/texbin/tikztosvg`, using its pdflatex mode.
SVGs were rasterized with `rsvg-convert`. Twelve fixtures generated native
MacTeX PNG, tikztosvg SVG/PNG and JS SVG/PNG successfully with no JS diagnostics.
The Chrome audit reports no browser errors for all twelve fixtures. Browser
comparisons were actually inspected for positive-range, single-offset, phase,
boundary and school-book cases; the minor-interval native comparison was also
inspected. This is not a claim that all twelve were visually accepted.

Visible improvements: translated positive ranges no longer create spurious
out-of-range grids and large blank margins; a single point at (7,3) keeps ticks
7 and 3 instead of zero; phased labels move to the requested values; native
optical tick fonts replace fitted text; missing partial-interval minor grid
positions are restored.

Remaining visible differences include school-book symmetric tick lengths and
manual tick-text padding, plus crop/raster differences. All twelve strict
raster comparisons remain non-identical. No visual tolerance was relaxed.

Generated evidence is local and ignored by Git:
- `outputs/qa/2026-10-23-datavis-linear-before/`
- `outputs/qa/2026-10-23-datavis-linear-after/browser-audit.html`
- `outputs/qa/2026-10-23-datavis-linear-after/browser-audit.json`
- `outputs/qa/2026-10-23-datavis-linear-after/tikztosvg-svg/`
- `outputs/qa/2026-10-23-datavis-linear-after/diff/`

The reproducible fixtures are committed in
`test/fixtures/datavis-linear-ticks/`. Library status remains **partial**.

## Verification

```sh
node --test --test-reporter=./scripts/module-test-reporter.js --test-reporter-destination=outputs/qa/2026-10-23-github-checkpoint/test-summary.json test/*.test.js
npm run check:architecture
npm run docs:links
git diff --check
```

Full test exit status is 1 because the 48 failures below remain. Architecture
and documentation-link checks pass. The existing text-to-frontend dependency
is still recorded as architecture debt.

No unfinished positive-origin/minor-tick implementation is included. Its
new failing exploratory probes are preserved outside test discovery in
`outputs/qa/2026-10-23-pgfplots-native-origin-after/wip/` for the next repair.

## Remaining Failure Inventory

This is a literal file/name inventory from the full run, not a classification
of every failure as a runtime bug. Fix native-visible discrepancies first;
migrate obsolete assertions only with independent native evidence.

| File | Failing test |
| --- | --- |
| `test/automata.test.js` | lets automata initial by diamond override the state circle |
| `test/capabilities.test.js` | capability matrix records PGFPlots faceted painter visual gates |
| `test/example-fixtures.test.js` | example fixture manifest points at existing sources with semantic owners |
| `test/extensions.test.js` | expands chronology package timelines from beamer frames |
| `test/extensions.test.js` | renders common PGFPlots axis addplot coordinates, functions, and legends |
| `test/extensions.test.js` | places datavisualization inside legends within the data frame |
| `test/extensions.test.js` | colors datavisualization legend text when label style is text colored |
| `test/extensions.test.js` | uses native-like quarter y ticks for datavisualization clean axes over a 0 to 2 range |
| `test/extensions.test.js` | keeps datavisualization top boundary tick mark but hides its label |
| `test/extensions.test.js` | supports datavisualization no tick text at shorthand with custom also-at label |
| `test/extensions.test.js` | supports datavisualization school book axes, explicit axis bounds, and step ticks |
| `test/extensions.test.js` | keeps scatter legend marker close to its label |
| `test/extensions.test.js` | uses sparse native-like ticks for single-point datavisualization scatter |
| `test/extensions.test.js` | supports common PGFPlots addplot+ labels and addlegendentry |
| `test/extensions.test.js` | adds invisible PGFPlots axis container bounds around plotted content |
| `test/interpreter.test.js` | uses monospace text metrics when clipping TikZ child tree edges |
| `test/interpreter.test.js` | supports common node anchor and shift positioning controls |
| `test/interpreter.test.js` | adds chain join edges with join=by arrow styles |
| `test/interpreter.test.js` | clips curved to-path arrows against node borders |
| `test/interpreter.test.js` | renders circuitikz triode amplifier components used by case 1041 |
| `test/interpreter.test.js` | applies picture scale to earth geometry while preserving default text and stroke sizes |
| `test/parser.test.js` | recovers a top-level TikZ command after unsupported bare text |
| `test/parser.test.js` | records common PGF package and PGFPlots library declarations |
| `test/petarv-compat.test.js` | applies global tikzstyle definitions to PetarV fetch-decode-execute nodes and paths |
| `test/petarv-compat.test.js` | falls back to default black when custom colors are not defined |
| `test/petarv-compat.test.js` | renders grouped TeX font declarations as line-level SVG text styling |
| `test/petarv-compat.test.js` | keeps A3C-style rounded math nodes compact and rounded |
| `test/petarv-compat.test.js` | matches native A3C environment and queue node sizing |
| `test/petarv-compat.test.js` | normalizes GameBoy matrix and edge label TeX macros |
| `test/pgfplots-seams.test.js` | pgfplots x-square with circle fixture keeps its calibrated semantic canvas |
| `test/pgfplots-seams.test.js` | pgfplots axis line lowering emits bounds, box, middle lines, and clean axes |
| `test/pgfplots-seams.test.js` | pgfplots middle y axis label sits close to the axis tip without expanding bbox |
| `test/pgfplots-seams.test.js` | pgfplots enlarged middle-axis labels use final transformed axis endpoints |
| `test/pgfplots-seams.test.js` | pgfplots multiline footnotesize ticks preserve native optical layout extents |
| `test/pgfplots-seams.test.js` | pgfplots geometry treats split axis x/y middle options as middle axes |
| `test/real-cases.test.js` | supports grid, option-radius shapes, arcs, inline nodes, to curves, plot functions, and repeated markings |
| `test/renderer.test.js` | renders path ball shading as SVG radial gradients |
| `test/renderer.test.js` | renders TikZ arrow tips as inline paths and shortens stroked path endpoints |
| `test/renderer.test.js` | renders common TikZ math symbol macros in SVG text fallback |
| `test/renderer.test.js` | wraps plain node text to TikZ text width before shrinking |
| `test/renderer.test.js` | uses rendered TeX text metrics for plain SVG text viewBox bounds |
| `test/renderer.test.js` | inherits tikzpicture nodes text width and alignment |
| `test/renderer.test.js` | collapses ordinary TeX source newlines in rich paragraph text |
| `test/shadings-axis.test.js` | maps TikZ axis shading shortcuts to PGF-compatible color stops and angles |
| `test/shapes-symbols-signal.test.js` | TikZ signal nodes render pointed paths and clip edges to signal borders |
| `test/text-package-macros.test.js` | normalizes gensymb default math symbols to their TeX Live fallbacks |
| `test/tikzquads.test.js` | renders quadripole nodes with electrical ports and anchors |
| `test/tikzquads.test.js` | expands QuadParConnect and PG load line into drawable TikZ |
