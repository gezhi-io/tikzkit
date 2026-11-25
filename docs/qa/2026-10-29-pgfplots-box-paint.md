# PGFPlots Box Paint and Physical Coordinates

Follow-up (2026-11-07): [text decoration path replacement](2026-11-07-text-path-replacement.md)
removes the epochs example's extra stroke. Its remaining legend/text and
whole-image differences are still open; the observations below are historical.

## Scope and Status

This follows the remaining FPU-control issue in
[native division and reciprocal](2026-10-29-native-division-reciprocal.md).
The scope is **2D closed-box paint order, directed dashed outlines, and
physical-coordinate serialization**, not a new arithmetic implementation.

Three target cases pass actual Chrome geometry/paint checks in both default
JS and exported SVG-text modes against local tikztosvg. Their JS/tikztosvg
PNG pairs pass the existing thresholds. The full test suite reports **3425
passed, 0 failed, 14 unchanged skips**, out of 3439 tests. No new diagnostics
or browser errors occur in the ten rendered cases.

**Whole-image certification remains incomplete.** Independent native-PDF PNG
comparisons still fail, including native PDF versus tikztosvg. Seven broader
controls were also inspected: three SVG PNG pairs pass, four still differ.
Those controls and PDF gates are not waived or counted as completed cases.
No commit, push, version bump or npm publication was performed in this step.

## Local Source Review

Paths are relative to `/usr/local/texlive/2025/texmf-dist/`.

| Source | Rule used |
| --- | --- |
| `tex/latex/pgfplots/pgfplots.sty` | Registry entry point loads the generic PGFPlots implementation. |
| `tex/generic/pgfplots/pgfplots.code.tex:750` | Native implicit order is background, grid, ticks, axes, tick labels, plots, descriptions and markers; `axis on top` changes the plot/axis ordering. |
| Same file, `pgfplots@drawaxis@outerlines@cycledpath`, lines 5225-5284 | A closed 2D frame starts southwest, travels northwest, northeast, southeast, then closes. Reversing this sequence changes dashes even when the solid outline is identical. |
| Same file, lines 9179-9184 and 9646-9651 | The axis is drawn before clipping/plots by default, or in the final pass for `axis on top`. |
| `tex/generic/pgfplots/pgfplots.scaling.code.tex:145` | Default sizing subtracts 45 TeX pt from both width and height unless `scale only axis` is active. |
| `tex/generic/pgfplots/util/pgfplotsutil.code.tex:478` | Coordinate transforms multiply TeX dimension registers directly; physical points are not rounded as numeric tick-label strings. |

The implementation retains the existing 3D foreground/replay path. It does
not claim support for arbitrary custom layer sets or per-edge discontinuities.

## Changes

- `axisTikzLowering.js`: draw the default 2D box before clipped plots; retain
  the explicit foreground behavior. Fill-between output follows the same
  default main-plot ordering.
- `axisLines.js`: use the native directed frame sequence.
- `format.js`, `clipping.js`: preserve six decimal places for physical cm
  coordinates, independently of three-decimal numeric label formatting.
- `marks.js`, `axisOverlay.js`: use that same physical precision for circle,
  semicircle and ellipse radii, so radius and center serialization agree.
- `browser-axis-box-paint-metrics.js`: compare 129 directed path samples,
  computed stroke width, dash lengths/offset, caps, joins, color and paint
  order. The new 0.09 CSS px gate at 3x rejects the old output. Existing
  tick/grid and raster thresholds were not relaxed.

Four semantic tests were written before the implementation; three failed
against the old runtime. Two audit-comparator tests reject reversed paths,
wrong order, pen drift and nonfinite measurements. Other changed tests replace
three-decimal snapshots with TeX-unit/geometric expectations. These snapshot
migrations are not counted as additional runtime bugs fixed.

## Commands and Options Checked

| Family | Checked | Still outside this slice |
| --- | --- | --- |
| Setup | `pgfplots`, `compat=1.18`, `tikzpicture`, `axis` | General package/options completeness |
| Axis geometry | `width`, `height`, `xmin/xmax`, `ymin/ymax`, `enlargelimits=false`, `xtick`, `ytick` | All alternate coordinate/projection modes |
| Paint | `axis on top`, `axis line style`, `grid=major`, `grid style`, `dashed`, `thick`, physical `line width`, colors/mixes | Custom layer configurations, separate per-edge discontinuity decoration |
| Data | `addplot`, `domain`, `samples`, function expressions, explicit `coordinates` | Complete PGF FPU parity |
| Control expressions | `floor(7.49999/2.5)`, `1/0.3` | Ordinary PGF division is covered by the previous worklog; default PGFPlots floating semantics remain unchanged |

## References and SVG Inspection

Found and used `/Library/TeX/texbin/tikztosvg` (0.3.0), with local pdflatex.
PNG conversion uses `/opt/homebrew/bin/rsvg-convert`. Independent native PNGs
come from MacTeX PDF via pdftocairo; no tools or fonts were downloaded.

The thick-frame reference has a `203.557pt x 120.679pt` viewBox. Its outline
uses `stroke-width=1.99255`, dash lengths `2.98883 2.98883`, butt caps, miter
joins and an explicit y-inverting matrix. The frame precedes the clipped
colored plot paths. PDF-derived clip paths use nonzero winding; text is
outlined glyph definitions plus `use`, not foreignObject. Browser TikZKit
uses the local native-font text engine; comparison waits for font loading.
No marker is present in these three target cases.

## Visual Evidence

The browser sheets contain default JS, local tikztosvg, SVG-text, before
(where available), and diff panels. Geometry comparisons align only the box
southwest corner at one physical scale: no stretching or per-element fitting.
All three browser sheets and all three native/JS/tikztosvg raster sheets were
opened after regeneration.

| Target | Before | After |
| --- | --- | --- |
| `division-pgfplots-fpu-control` | Border painted over horizontal plot endpoints; physical coordinates were truncated to .001cm. | Red remains at 2, blue at 10/3; correct plot/frame stacking and finer grid, tick and curve alignment. |
| `pgfplots-box-behind-plots` | Black dashes intruded into the red/blue boundary curves; side/corner dash phase disagreed with native. | Curve paint covers the inner half of the frame, with native dash direction on all four edges. |
| `pgfplots-box-on-top` | Foreground order was correct but the reversed frame misplaced the dashes. | Foreground frame/grid still overlay the curves, with native dash direction. |

Maximum new browser geometry/pen error is 0.00840 CSS px at 3x. Tick error
decreases from 0.05246 to 0.00840 px; glyph-origin error from 0.04711 to
0.00716 px. These measurements supplement the visible paint-order correction.
The old reversed-path comparison deliberately fails; its large directed-path
distance must not be misreported as a displaced axis bounding box.

The independent PDF panels retain raster edge differences (also visible when
comparing tikztosvg to PDF). Strict PDF acceptance remains blocked rather than
changing thresholds to absorb that difference.

## Broader Controls and Remaining Work

Seven existing examples were rendered in MacTeX, tikztosvg and JS, and all
actual Chrome sheets were inspected:

- Halfcircle and heart controls retain the correct rotations, split fills,
  radii and outlines; their SVG PNG gates pass.
- The 3D quadratic surface retains its mesh, colormap, foreground frame,
  ticks and colorbar; its SVG PNG gate passes. Pixel-identical shading is
  not certified.
- The ellipse control retains center/radius geometry, but small stroke,
  tick and glyph differences still fail its strict SVG raster gate.
- The reciprocal light-bulb case retains all three curves; legend row spacing
  and frame height still differ visibly.
- The epochs case retains all four curves and the annotation point; its
  decorated text path still leaves an extra horizontal stroke above the arrow.
- The histogram retains bars, white foreground grid and rotated labels, but
  description/canvas placement still fails the strict whole-image gate.

Next priorities are the decorated-text residual stroke and measured legend
row spacing, followed by histogram crop/anchor registration. They require
their own native probes, not further blanket coordinate offsets.

## Reproduction and Artifacts

Fixtures: `test/fixtures/pgfplots-box-paint/` and
`test/fixtures/pgfplots-coordinate-controls/`. Existing corpus sources are
reused through relative references. Two new thick-frame controls differ only
by `axis on top`; no existing diagram-specific coordinates were patched.

Local artifact roots:

- `outputs/qa/2026-10-29-box-paint-before/`
- `outputs/qa/2026-10-29-box-paint-after/`
- `outputs/qa/2026-10-29-coordinate-controls/`

Each after directory contains `mactex-png/`, `tikztosvg-svg/`,
`tikztosvg-png/`, `tikzkit-svg/`, `tikzkit-png/`, `diff/`, `browser/`,
`browser-audit.html` and `browser-audit.json`. Generated artifacts are local,
not required npm contents. The checked-in fixtures/scripts reproduce them.

```sh
node --test test/*.test.js
node --experimental-vm-modules scripts/check-architecture.js
node scripts/check-doc-links.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/pgfplots-box-paint --output outputs/qa/2026-10-29-box-paint-after --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --no-comparison-grid
node scripts/audit-module-regressions.js --fixtures test/fixtures/pgfplots-box-paint --output outputs/qa/2026-10-29-box-paint-after --before outputs/qa/2026-10-29-box-paint-before --workbench --tick-grid-metrics --browser-module "${PLAYWRIGHT_MODULE:?set this to the local Playwright index.mjs}"
node scripts/diff-example-pngs.js --output outputs/qa/2026-10-29-box-paint-after --register
node scripts/render-example-fixtures.js --fixtures test/fixtures/pgfplots-coordinate-controls --output outputs/qa/2026-10-29-coordinate-controls --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --no-comparison-grid
node scripts/audit-module-regressions.js --fixtures test/fixtures/pgfplots-coordinate-controls --output outputs/qa/2026-10-29-coordinate-controls --browser-module /absolute/path/to/playwright/index.mjs
node scripts/diff-example-pngs.js --output outputs/qa/2026-10-29-coordinate-controls --register
```

Architecture check: 489 modules, no errors, one unchanged documented
`tikz/text.js -> frontend/latex-shell.js` dependency debt.
