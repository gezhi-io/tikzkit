# Runtime Failure Repairs

## Scope and Result

This batch prioritizes visible defects behind the remaining 76 failures:
path-node transforms and pen inheritance, datavisualization logarithmic
ticks and pin geometry, relative math sizes with baseline side anchors,
and native multiline math packing.
It does not claim to finish all failures or fully implement these libraries.

| Gate | Before | After |
| --- | ---: | ---: |
| Full tests | 2,827 | 2,847 |
| Passed | 2,737 | 2,762 |
| Failed | 76 | 71 |
| Skipped | 14 | 14 |
| Newly failing existing tests | - | 0 |
| Core gallery diagnostics | 0 / 660 cases | 0 / 660 cases |

Twenty new tests cover the runtime rules. No test was skipped or deleted.
The architecture check passes for 472 modules with one pre-existing
text-to-frontend dependency debt. The whole-image difference gates remain
blocked: **visible improvement is verified, whole-case visual parity is not**.

Five previously failing tests now pass:

- Coordinate-system projection, path rotation, midway labels and node labels.
- Datavisualization logarithmic mapping and exponential ticks.
- School-book pin leaders on the label visualizer's selected coordinate.
- Nested larger bold math labels used as graph markers.
- Multiline math circle nodes using TikZ text metrics.

The complete remaining failure names and messages are retained in
`outputs/qa/2026-10-23-multiline-math-after/test-summary.json`.

## MacTeX Source Review

Paths below are relative to `/usr/local/texlive/2025/texmf-dist/`.

| Source | Native rule applied |
| --- | --- |
| `tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`, 3789-3837 and 4156-4171 | Nodes begin a fresh local transform; the path point is already in canvas coordinates. Reset nontranslations before applying node-local transforms. The active pen survives, then every-node and explicit options override it. |
| Same file, 1578-1581 | Line-width presets are physical pen sizes, not node transforms. |
| `tex/generic/pgf/modules/pgfmoduleshapes.code.tex`, 945-1064 | Rectangle southwest/northeast anchors include outer separation. Base/mid side anchors reuse those horizontal coordinates even when the box is unpainted. |
| `tex/generic/pgf/modules/pgfmoduledatavisualization.code.tex`, 2386-2495 | The label visualizer saves the first threshold-crossing sample and its preceding canvas point. |
| `tex/generic/pgf/frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.code.tex`, 632-654, 1160-1225, 1317-1380, 1550-1585 and 2004-2027 | Labels use small text and native padding; logarithmic ticks print source numbers; minor steps default to empty. Pins use a normal offset of 3ex, auto anchoring and a help-line edge to the node border. |
| `tex/generic/pgf/frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.formats.functions.code.tex`, 167-195 | Interval sampling determines surveyed extrema. A 20-sample sine need not reach exactly 1. |
| `tex/latex/relsize/relsize.sty`, 40-130 and 268-315 | Relative math first changes script/text/display style. Further display enlargement chooses an NFSS size near 1.2 times the previous size, within 5% tolerance. The wrapper is local. |
| `tex/generic/pgf/frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.code.tex`, 1537-1542 and 2060-2155 | Legend example points pass through the visualizer's selected plot handler. Ordinary lines use straight zig-zag samples; smooth lines use curves. |
| `tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`, 4247-4263; `tex/generic/pgf/modules/pgfmoduleshapes.code.tex`, 1187-1235 | Aligned node text packs row hboxes in a halign, retaining the outer baseline grid. Circles circumscribe the resulting text box plus inner separation. |

`command -v tikztosvg` resolves to `/Library/TeX/texbin/tikztosvg` (0.3.0).
References use local pdflatex, PDF-to-SVG conversion and `rsvg-convert` 2.63.0.
No compiler, package or font was downloaded. The reference wrapper now passes
`relsize` and `bm` to tikztosvg rather than stripping their declarations.

## Commands and Options

| Slice | Exercised commands and parameters | Status |
| --- | --- | --- |
| Path nodes | `draw`, `coordinate`, inline `node`, `--`, `arc`, polar coordinates, calc projection; `shift`, `xshift`, `yshift`, `rotate`, `midway`, `above`, `below`, `left`, `right`, `label`, `circle`, `fill`, `inner sep`, `minimum size`, `thick`, `ultra thick`, `line width`, `every node` | Shared transform and pen rules repaired. Text-only label offsets and legacy math paint still differ. |
| Datavis axes | `datavisualization`, function data, `var`, `interval`, `samples`, `func`, `value`, `exp`, `sin`, scientific/school-book axes, logarithmic mapping, `min value`, `max value`, tick `step`, `minor steps between steps`, custom tick text | Log labels and opt-in minors repaired. Complete tick styling and endpoint sampling parity are not certified. |
| Datavis pins | Named line visualizer, `pin in data`, `when=x is ...`, `text`, `text'`, short and fraction labels | First-crossing sample, preceding-segment normal, small CM math, native node padding and gray 0.2pt leader. Four damped-sine variants pass browser geometry gates. Logarithmic pin normals remain unverified. |
| Datavis legend samples | `visualize as line`, `visualize as smooth line`, `label in legend` | Legend sample coordinates use the visualizer's own straight or cubic plot handler. Polar legend handlers and complete legend layout remain outside this repair. |
| Relative math | `mathlarger`, `mathsmaller`, `bm`, `boldsymbol`, `scriptstyle`, `scriptscriptstyle`, wrapped powers; `anchor=base west/base east/mid west/mid east`, `inner sep`, `outer sep`, `line width` | Ordinary wrapped symbols use native CM boxes. Larger depths 1-5 select 10, 12, 14.4, 17.28, 20.74pt. Large-operator limits, external decorators, text relsize commands and arbitrary math-size declarations remain partial. |
| Multiline math nodes | `node`, `circle`, `align=center/left/right`, row breaks, `scriptsize`, `font=footnotesize`, subscripts, `dfrac`, `thick`, node-to-node arrows | Pure-math rows share a native box for node dimensions and browser/export paint. Scoped row sizes preserve the outer baseline grid; tall rows use TeX's 1pt lineskip. Mixed prose, explicit row spacing and unsupported math retain the previous path. |

## Visual Evidence

All paths are relative to the repository. Each `after` directory contains
`mactex-png`, `tikztosvg-svg`, `tikztosvg-png`, `tikzkit-svg`, `tikzkit-png`,
pixel differences, contact sheets and actual Chrome captures.

| Fixtures | Before directory | After directory |
| --- | --- | --- |
| Path shifts and projection (2) | `outputs/qa/2026-10-23-path-transform-before/` | `outputs/qa/2026-10-23-path-transform-after/` |
| Datavis log ticks, school-book/boundary ticks, pins and legend control (9) | `outputs/qa/2026-10-23-datavis-failures-before/` | `outputs/qa/2026-10-23-datavis-failures-after/` |
| Relative math size sheet (1) | `outputs/qa/2026-10-23-relative-math-before/` | `outputs/qa/2026-10-23-relative-math-after/` |
| Multiline math circles (1) | `outputs/qa/2026-10-23-multiline-math-before/` | `outputs/qa/2026-10-23-multiline-math-after/` |

Open `browser-audit.html` in each after directory. Default JS SVG and exported
SVG-text are both painted by Chrome after awaiting the packaged MacTeX fonts.
The browser report is not an inference from rsvg-convert output.

Observed changes:

- The projection marker P moves from a detached point to the triangle vertex.
  Shifted path circles return to their true path positions. Their pen now
  matches the path's thick stroke. Native and JS still differ in simple
  formula placement and text paint; those images are not fully accepted.
- Log ticks now show 1, 10, 100 and 1,000 instead of PGFPlots-style powers.
  Unrequested logarithmic minor ticks disappear. Native tick fonts, some
  arrow/crop details and full-raster differences remain visible.
- The straight-line legend no longer has a false smooth wave. Its four
  sample points use line segments, while a new smooth-line control retains
  cubic segments. Legend text offsets and general layout still need work.
- The school-book leader moves from the wrong selected point to the actual
  threshold-crossing sample. Damped-sine long/short and normal/swapped pins
  now use the same native point, normal and label boundary. Chrome endpoint
  error is below 0.04px and glyph-origin error below 0.06px at 3x physical
  size, without fitting labels independently.
- Nested larger bold multiplication signs now visibly grow. Smaller x no
  longer leaks a literal `mathsmaller` word. Script styles, powers and bold
  Sigma align with the native reference. All 31 corresponding native glyph
  origins differ by less than 0.02px at 3x, relative to one gray rectangle.
  The first unwrapped formula is an explicitly excluded control: it still
  uses the old text path and differs between browser and SVG-text output.
- The multiline circle grows from 1.548cm to 1.593cm, using the measured
  31.26382pt-wide native text box and 12pt row baseline separation. Stacked
  fractions no longer flatten into slash text; left/right row alignment and
  scripts use the native glyph faces. All 26 browser glyph origins are within
  0.35px of tikztosvg at 3x physical scale, even when compared directly from
  the full SVG viewport without translation fitting. The mathematical circle
  norm differs slightly from PGF's fixed-point normalization (about 0.08pt in
  radius on the first circle); full-raster acceptance is still blocked.

The tikztosvg reference uses local outline paths/uses, point-sized viewBoxes
and explicit transforms. TikZKit retains native-font SVG text for supported
math. Comparing their screen-space glyph origins avoids confusing glyph-local
font sizes with rendered sizes. No reference image was substituted for JS.

## Test Changes

Runtime files: `src/engine/evaluate.js`, `src/engine/options.js`,
`src/frontend/latex-shell.js`, `src/tikz/text.js`, `src/tikz/textMetrics.js`,
`src/tex/mathBox.js`, the new `src/tex/relativeMath.js`, and
`src/renderers/svg/plainTextNode.js` / `src/renderers/svg/renderSvg.js`.

New tests: `test/path-node-transform.test.js`,
`test/datavis-log-numbering.test.js`, `test/datavis-pin-geometry.test.js`,
`test/relative-math-sizes.test.js` and `test/multiline-math-box.test.js`. Native driver sources live under
`test/fixtures/path-node-transforms`, `test/fixtures/datavis-failure-audit`
`test/fixtures/relative-math` and `test/fixtures/multiline-math`.

Four existing pin tests were corrected against native output, not loosened:
the source specifies 9pt small math, a gray 0.2pt leader, per-label box
clipping, and CMSY9's quad for operator spacing. Heuristic centers were
replaced by measured native glyph/edge coordinates. The old bold-marker
test still requires a rendered size above 72 SVG units, now multiplying
the native 20.74pt glyph size by its enclosing group scale; it additionally
checks the CMBSY face and exact native size.

The existing cross-mark legend test now identifies marks by their two
subpaths, not by assuming every straight path is a mark. Its requirement of
exactly two marks is unchanged; the new line-handler test checks all four
legend path operations for both ordinary and smooth series.

Two formerly passing multiline renderer tests required the retired HTML/tspan
structure. They now check native glyph face, italic versus upright roles,
10/7/5pt optical sizes, physical SVG scale and exact 12pt row separation,
and require the browser not to use an HTML foreignObject for this math.
The original failing circle-diameter assertion is unchanged. The native box
probe is saved as `test/fixtures/multiline-math-metrics.tex`.

Browser checks live in `scripts/audit-module-regressions.js` and
`scripts/browser-datavis-pin-metrics.js`. The fixture harness preserves native
package loading, guarded by `test/tikztosvg-preamble-order.test.js`.

Verification commands:

```sh
node --test test/path-node-transform.test.js test/datavis-log-numbering.test.js test/datavis-pin-geometry.test.js test/relative-math-sizes.test.js test/multiline-math-box.test.js test/tikztosvg-preamble-order.test.js
npm run --silent test:summary
npm run gallery:audit
npm run check:architecture
npm run docs:links
```

Render each fixture directory with `scripts/render-example-fixtures.js
--native-reference --tikztosvg-engine pdflatex --math-renderer svg-text`,
then run `scripts/audit-module-regressions.js` with the matching output and
fixture paths and the installed Playwright module. Run
`scripts/diff-example-pngs.js` afterward. Whole-image thresholds were not
changed or waived.

## Remaining Work

The 71 failures have not been declared harmless. Highest-priority visual
investigations are 3D z-label/corner anchors, projected colorbar/crop bounds,
mixed prose/math node sizing and arrow terminal clipping. Separately,
native-evidence-backed test maintenance is needed for obsolete color strings,
Unicode minus signs and SVG/IR structure assertions.

Two native checks explicitly prevent incorrect runtime changes: the sampled
20-point sine does not reach y=1, and the school-book example has fewer native
ticks than its old minimum-count assertion. Those failures remain visible
until their tests are replaced with verified geometry checks.

This batch is progress, not completion of the 76-failure request. It neither
publishes npm nor pushes a release.
