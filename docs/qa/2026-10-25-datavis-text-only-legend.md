# Native Text-Only Inside Legends

## Scope and Status

This pass addresses one datavisualization feature family: text-only inside
legends with source-ordered row/column settings and native CM cell metrics.
The existing inside-legend failure and the manual's function-class example
exposed incorrect matrix dimensions, baseline placement and data-bound anchors.
It does not complete datavisualization or its function format.

The full explicit test suite changes from 26 failures to 25, with no newly
failing names. Five actual browser comparisons pass their glyph and background
geometry gates in both default and SVG-text modes. No npm login, publication,
version change or remote push was attempted.

## Local Source Review

Paths below are relative to `/usr/local/texlive/2025/texmf-dist/`.

- `tex/generic/pgf/frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.code.tex`:
  lines 149-174 freeze the data bounding box after visualizers but before grids,
  ticks, axis descriptions and legends. Data labels therefore contribute to this
  box. Lines 1650-1997 define inside placement, matrix padding, cell pictures,
  text-only transform reset, mid-west anchors and height/depth struts.
- `tex/generic/pgf/modules/pgfmoduledatavisualization.code.tex`:
  lines 2690-2940 arrange cells using ideal/max row/column counts and eight
  traversal strategies. Key order matters: a placement resets the preferred
  count, and a later maximum can change the orientation.
- `tex/generic/pgf/modules/pgfmodulematrix.code.tex`:
  lines 400-482 accumulate independent cell extrema, column widths and row
  height/depth. Empty cells contribute zero; unequal text must not use a fixed
  column width or fixed row stride.
- `tex/generic/pgf/basiclayer/pgfcorepathusage.code.tex`:
  stroke inflation of the overall picture is distinct from local geometry bounds.
- `doc/generic/pgf/pgfmanual-en-dv-stylesheets.tex`:
  the function-class example supplies a real inside, text-only legend driver.
- `tex/generic/pgf/frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.formats.functions.code.tex`:
  the loader delegates to the datavisualization and PGF function-format libraries.
  No sampler or random-number algorithm is changed here.

The installed PGF implementation's `down then left` updater compares its row
index against the column count. For a nonsquare matrix it can omit an entry
outside the matrix. A source-derived regression preserves that actual behavior;
this is not a claim that the upstream algorithm is symmetric or bug-free.

## Commands and Parameters

Fixtures exercise `\usetikzlibrary{datavisualization.formats.functions}`,
`\datavisualization`, named `data group`, `data [set=...,format=function]`,
`var`, `interval`, `func`, `ln`, `exp`, multiplication, `\value`, CSV-like inline
data, `scientific axes`, `scientific axes=clean`, `visualize as line`,
`visualize as smooth line/.list`, axis limits/lengths/ticks/grid,
`style sheet=strong colors`, `label in legend`, and `pin in data` with
`when=x is 10`. These existing sampling/axis/pin capabilities are controls,
not newly completed features.

The new bounded layout handles:

- Eight compass inside placements, `rows`, `columns`, their `ideal number of`
  aliases, `max rows`, `max columns`, and all eight traversal strategies.
- `label style=text only`, `opaque`, `opaque=<color>`, `transparent`, label-local
  `font` and `text`, and visualizer-derived text colors.
- Native CM text/math boxes, descenders, scripts, fractions, local `\scriptsize`,
  and the default `\footnotesize` cells. Optical-size font dimensions supply
  the struts, not an assumed one-em equals point-size rule.
- A frozen local data box that includes measured undrawn label nodes and their
  inner separation, without including axis ticks or unrelated picture content.

The verified surrounding context is normal 10pt CM. Arbitrary outer fonts,
transformed pictures, custom matrix styles/cell pictures, text-left entries,
multiple named legends and non-text-only inside legends retain existing paths
and remain outside this acceptance slice. Eight strategies have semantic tests;
the browser fixtures cover the default, right-then-down and left-then-up orders.

## Implementation

- `src/tikz/libraries/datavisualizationLegend.js` shares native text measurement
  with the scatter helper, replays ordered options, arranges cells, packs native
  row/column boxes and positions the background and labels.
- `src/frontend/latex-shell.js` chooses the bounded helper and emits its legend
  after the lowered axis. Unsupported combinations retain the existing fallback.
- `src/pgfplots/axisTikzLowering.js` encloses only the data and overlay visualizers
  in the requested local bounding box. This option is internal to datavisualization.
- `src/engine/evaluate.js` uses an undrawn node's already measured layout box
  instead of re-estimating only its text ink for local bounds.
- `scripts/audit-module-regressions.js` also checks the actual painted background
  relative to the same frame used by the glyph gate.

The native-only `test/fixtures/datavis-text-only-legend/metrics.ltx` probe records
named anchors independently of JS. Coordinates below are TeX points:

| Fixture | Matrix south west | Matrix north east | Last label baseline |
| --- | --- | --- | --- |
| Function classes | (97.9548, 0) | (139.25995, 28.48807) | (125.05614, 6.7115) |
| Wide ranges | (97.95784, 0) | (139.26299, 28.48807) | (125.05917, 6.7115) |
| Pin boundary | (118.86856, 67.39006) | (139.26392, 85.06313) | (120.78908, 74.10156) |

The matrix anchor includes `.5ex` outer separation (2.15277pt per side).
The function-class painted background is 36.99961pt by 24.18253pt. Baselines,
not unequal ink-box centers, align within each row.

## References and Visual Evidence

`command -v tikztosvg` found `/Library/TeX/texbin/tikztosvg` (0.3.0).
References use local TeX Live 2025 `pdflatex`, `rsvg-convert` for SVG PNGs,
and a separate MacTeX PDF-to-PNG render. Nothing was installed.

The reference SVG has outline glyphs with `use`, y-reversing transforms,
nonzero fills and cubic rounded backgrounds with a 3pt radius. JS uses the
bundled MacTeX-derived CM fonts and positioned SVG glyph text, not an HTML
foreignObject replacement. Font rasterization and edge antialiasing still differ;
passing the geometry gate is not pixel identity.

Artifacts are generated locally and ignored by Git:

- Before: `outputs/qa/2026-10-25-datavis-text-only-legend-before/`
- After: `outputs/qa/2026-10-25-datavis-text-only-legend-after/`
- Live comparison: `outputs/qa/2026-10-25-datavis-text-only-legend-after/browser-audit.html`
- 3D controls: `outputs/qa/2026-10-25-datavis-text-only-legend-3d-controls/`

Each final fixture has `tikzkit-svg/`, `tikzkit-png/`, `tikztosvg-svg/`,
`tikztosvg-png/`, `mactex-png/` and browser sheets/diffs. All five final MacTeX
images and browser comparison sheets were inspected, as were all seven 3D
control sheets. The before capture contains the initial three legend fixtures;
the wide-range and pin controls were added while investigating the shared cause.

| Case | Visible change | Glyphs | Maximum glyph error at 3x | Background error |
| --- | --- | --- | --- | --- |
| Function classes | Compact 2-by-2 colored legend, native background and row baselines | 23 | 0.0568px | 0.0147px |
| Mixed cells | Three unequal columns; tall fraction expands its own row; north anchor follows data max 7 rather than axis max 10 | 48 | 0.0112px | 0.0203px |
| Reversed rows | Correct left-then-up order and empty cell; yellow background follows data bounds | 35 | 0.0125px | 0.0120px |
| Wide ranges | Enlarged axis no longer shifts the inside legend or changes its physical row spacing | 32 | 0.0818px | 0.0047px |
| Pin boundary | Pin node raises the frozen data boundary; legend no longer anchors at the curve endpoint or axis top | 22 | 0.0527px | 0.0529px |

All 160 glyph origins and five backgrounds pass the unchanged 0.09px limit in
both browser modes. A single translation from the first matching gray path
aligns the images at fixed physical scale; there is no scale fit or per-label
offset. Native emits the four pin glyphs before axis text, whereas JS emits
them after it. That fixture declares a checked permutation of all 22 native
indices; none are excluded, moved or fitted. The source itself makes the
legend cover part of the word `peak` in native output. JS now reproduces that
overlap; no collision-avoidance behavior is claimed.

There are no browser errors or new diagnostics. All seven 3D controls retain
the existing 0.35px geometry acceptance for labels, ticks and projected bounds.
The combined 3D audit still fails its strict color gate for explicit metadata:
JS `[128,128,255]`, native `[127,127,255]`. This pre-existing discrepancy remains
open and its threshold was not relaxed.

## Reproduction and Tests

```sh
node --test test/datavis-text-only-legend.test.js test/datavis-scatter-legend-layout.test.js
node --test --test-reporter=./scripts/module-test-reporter.js \
  --test-reporter-destination=outputs/qa/2026-10-25-datavis-text-only-legend-after/test-final.json \
  test/*.test.js
npm run check:architecture
npm run docs:links
node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/datavis-text-only-legend \
  --output outputs/qa/2026-10-25-datavis-text-only-legend-after \
  --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --strict-tikztosvg
node scripts/audit-module-regressions.js \
  --fixtures test/fixtures/datavis-text-only-legend \
  --output outputs/qa/2026-10-25-datavis-text-only-legend-after \
  --before outputs/qa/2026-10-25-datavis-text-only-legend-before \
  --browser-module /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
/Library/TeX/texbin/pdflatex -interaction=batchmode -halt-on-error \
  -output-directory=/tmp -jobname=tikzkit-text-only-metrics \
  test/fixtures/datavis-text-only-legend/metrics.ltx
```

Focused tests: 20/20 pass. Final full suite: 3068 tests, 3029 pass, 25 fail,
14 skip, no cancellations. Baseline: 3056 tests, 3016 pass, 26 fail, 14 skip.
The resolved failure is `places datavisualization inside legends within the data frame`.
Its fixture now declares the required function format explicitly and uses one
picture to avoid an empty first reference page. Existing numeric ranges were
retained; the row checks now compare native baselines instead of ink centers.
Independent matrix-anchor probes and browser gates guard the production change.

Architecture checks retain the one previously recorded text/frontend dependency;
this pass introduces no new dependency violation. The broad suite is not green.
Both datavisualization registry entries remain `partial`. Remaining work includes
the 25 recorded failures, custom legend contexts, and the 3D color discrepancy.
Prioritize a remaining visible package/geometry failure before changing any
serialization-only assertion.
