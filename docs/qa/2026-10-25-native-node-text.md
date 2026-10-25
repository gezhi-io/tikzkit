# Native Literal Node Text

## Scope and Status

This slice makes ordinary Computer Modern labels use the same TeX hbox for
measurement and browser/export painting. It follows the displaced prose labels
left open by [the preceding math/3D work](2026-10-25-math-alphabets.md). It does
not change data-visualization legend placement or claim complete font support.

The full explicit suite has 3,048 tests: 3,007 pass, 27 fail, 14 skip and zero
cancellations. The preceding checkpoint had 28 failures; there are no newly
failing test names. The one resolved old failure had an obsolete width range:
an independent MacTeX probe supplies the replacement expectation, and the
renderer now paints that measured box. Serialization migrations are not counted
as additional old failures fixed. Five new regressions pass.

The user cancelled npm login and publishing. No login, publication, version
change or remote push was attempted. Version remains 0.1.6.

## MacTeX Evidence

Local sources reviewed under `/usr/local/texlive/2025/texmf-dist/`:

- `tex/generic/pgf/modules/pgfmoduleshapes.code.tex:934-1045`: rectangle
  dimensions come from text width, height and depth; its text center is
  `(width/2, (height-depth)/2)`. The base anchor is at the TeX baseline.
  SVG `dominant-baseline=middle`, based on x-height, is not equivalent.
- `tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryfit.code.tex`:
  fit takes the four cardinal anchors of each target, computes the bounding
  rectangle and installs its center and text dimensions after resetting the
  node transform. A text-only paint shift must not distort the fitted shape.
- `tex/generic/pgf/frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.code.tex:629-652,1645-1778,1910-2025,2050-2187`:
  ticks use footnotesize; dataset labels use small. A legend is a matrix with
  physical padding and struts, positioned relative to the complete visualization
  bounding box. Scatter examples contain a single mark, not a line sample.

`test/fixtures/native-node-text-metrics.tex` measures hboxes and saved PGF
anchors independently. Selected results, in TeX pt:

| Text | Font size | Width | Height | Depth |
| --- | ---: | ---: | ---: | ---: |
| Koordinatenfrei | 10 | 68.94463 | 6.94444 | 0 |
| gyjp | 10 | 18.88896 | 6.67859 | 1.94444 |
| measurements | 10 | 61.52788 | 6.15079 | 0 |
| measurements | 7 | 48.99606 | 4.30556 | 0 |
| Mixed ABC, bold | 12 | 71.38196 | 8.33331 | 0 |
| tiny capitals | 5 | 37.32687 | 3.47221 | 0.97221 |
| = | 10 | 7.7778 | 3.66875 | 0 |

The last row distinguishes a negative individual glyph depth from a TeX hbox:
packing the hbox clamps its depth to zero. Its old test incorrectly expected
the glyph's negative depth to reduce the total box height.

## Implementation

- `plainTextNode.js`: resolve physical font size/family/weight before native
  layout; admit supported literal one-line text to the native box path; do not
  add the old optical center offset to already measured native cache payloads.
  Explicit stretching, fit boxes and unmeasured minipages retain their fallbacks.
- `textEngine.js`: use that same native selection for cached measurements and
  paint. Preserve the raw wrapper text and select the appropriate native
  text/math box painter. Built-in engine identity is internal, not a public flag.
- `renderSvg.js`: an explicitly supplied custom text engine retains ownership
  of its paint. Native selection must not silently bypass that API contract.
- `textBox.js`: recognize resolved CMBX optical family names, including the
  12pt bold face, rather than accidentally falling back after font resolution.

Native glyph helpers replace assertions tied to a single `<text>` string.
They check glyph content and, where relevant, baseline, physical size, font,
decimal anchor, end alignment and viewBox bounds. Existing custom-engine,
inline-box and compact-math tests were retained and pass.

## Browser and Reference Results

`command -v tikztosvg` found `/Library/TeX/texbin/tikztosvg`. The harness used
local pdflatex/dvisvgm and rsvg-convert; no tools, fonts or packages were
downloaded. Main artifacts are in
`outputs/qa/2026-10-25-native-node-text-after/`, with the corresponding
`2026-10-25-native-node-text-before/` baseline. These include JS SVG/PNG,
tikztosvg SVG/PNG, separate MacTeX PNGs, actual Chrome captures and diff sheets.
All three current sheets and MacTeX PNGs were inspected, not just diff numbers.

| Case | Visible result | Acceptance |
| --- | --- | --- |
| native-literal-node-labels | Centered prose, base-anchored descenders, 7pt text, 12pt bold and 5pt text now occupy their native boxes; former baseline drift and overflow are removed. | 75 glyph origins pass in default browser and export at unchanged 0.09px tolerance; maximum 0.0643px. |
| native-prose-commutative | Green and orange prose labels no longer sit above their intended centers; fitted ellipses, edge math and arrows retain their layout. | Visually improved; no new whole-diagram numerical gate claimed. |
| native-prose-scatter-legend | Literal label baseline and optical font improve, but the legend still sits approximately 0.57cm too far right and 0.10cm too low. | Not accepted as a completed case. |

The native literal reference has a 259.502pt by 160.289pt viewport and 75 glyph
uses, no `text`, `foreignObject` or markers. JS has 75 semantic text glyphs from
the packaged MacTeX outlines and a 259.50pt by 160.29pt viewport. Explicit
alphabetic baselines and group transforms replace browser middle-baseline
heuristics. Shape stroke/fill and layer order are unchanged.

The scatter reference has 39 glyph uses and a 278.157pt-wide viewport. JS now
has the same glyph count but remains 297.88pt wide because the legend position
is wrong. Equal glyph counts and zero diagnostics do not imply acceptance.

Seven fresh 3D controls are in
`outputs/qa/2026-10-25-native-node-text-3d-controls/`. All seven actual-browser
sheets were inspected. Clipped facets still meet the projected boundary;
unclipped facets remain outside it; linear/logarithmic ticks and descriptions
retain native size and location. Default/export geometry gates pass with the
unchanged 0.35px tolerance. These are regression controls, not seven new fixes.
The older `surface-survey-after` before panel predates the logarithmic repair
and must not be attributed to this text change.

The 3D command still exits nonzero on the existing explicit-meta paint gate:
native `[127,127,255]` versus JS `[128,128,255]`. The same discrepancy exists
in its before panel. Its strict less-than-one-byte gate was not weakened.
Whole-image raster parity is therefore not certified.

## Remaining Work

Supported here: ordinary serif regular/bold literal node text, standard
optical sizes, `font`, `inner sep`, center/compass/base anchors, native multiline
boxes and custom text-engine delegation. The visual controls also exercise
`fit`, `ellipse`, `node distance`, `draw`, `to`, arrows and math labels.

Still partial: arbitrary NFSS substitutions, italic/sans literal hboxes,
general rich text and minipages, and the data-visualization legend matrix.
No source coordinates were nudged to hide the remaining legend error.

`test/fixtures/native-node-text/legend-metrics.tex` preserves the next-step
native probe: legend west is 153.38907pt; label base-west is
(161.75197pt,35.10815pt). Matrix padding, the outer 10pt font's mid anchor,
the 9pt font's actual quad and strut all matter. Next implement shared legend
matrix/bounding-box placement rather than axis-width fractions. The 27 formal
failures remain listed in `test-final.json`; bare Node discovery's manual
browser-runner issue remains separate and is not reported as passing.

## Verification

```sh
/Library/TeX/texbin/pdflatex -interaction=nonstopmode -halt-on-error -output-directory=/tmp test/fixtures/native-node-text-metrics.tex
node --test test/convert.test.js test/native-node-text.test.js test/compact-math-anchors.test.js test/inline-text-box.test.js test/font-assets.test.js
node --test --test-reporter=./scripts/module-test-reporter.js --test-reporter-destination=outputs/qa/2026-10-25-native-node-text-after/test-final.json test/*.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/native-node-text --output outputs/qa/2026-10-25-native-node-text-after --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --strict-tikztosvg
node scripts/audit-module-regressions.js --fixtures test/fixtures/native-node-text --output outputs/qa/2026-10-25-native-node-text-after --before outputs/qa/2026-10-25-native-node-text-before --browser-module /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
node scripts/render-example-fixtures.js --fixtures test/fixtures/pgfplots-surface-survey --output outputs/qa/2026-10-25-native-node-text-3d-controls --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --strict-tikztosvg
node scripts/audit-module-regressions.js --fixtures test/fixtures/pgfplots-surface-survey --output outputs/qa/2026-10-25-native-node-text-3d-controls --before outputs/qa/2026-10-25-surface-survey-after --tick-grid-metrics --browser-module /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
npm run check:architecture
git diff --check
```

Focused check: 42/42 pass. Architecture: 482 modules pass, with the existing
text-to-frontend dependency debt unchanged. All ten reference cases render
with zero JS diagnostics, zero browser errors and no native-tool failures.
Full tests and the explicit-meta color gate remain non-green as described above.
