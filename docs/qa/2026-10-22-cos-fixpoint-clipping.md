# Cos-Fixpoint Enlarged Clipping

## Scope

Repair the mismatch between the enlarged 2D axis and the final paint clip in
`latex-examples-cos-fixpoint`. This is a shared clipping fix, not a redesign of
range survey, sampling, tick placement, fonts or 3D axes. PGFPlots remains partial.

The existing test checked sampled endpoints but not the SVG clip hiding those
endpoints. Four new regressions were added first; three failed before the fix.
All four now pass without relaxing an existing assertion.

## Native Implementation

Reviewed under `/usr/local/texlive/2025/texmf-dist/`:

- `tex/latex/pgfplots/pgfplots.sty`: delegates to the generic implementation.
- `tex/generic/pgfplots/pgfplots.code.tex:6330`: enlargement runs before final scaling; the default relative amount is 0.1.
- `tex/generic/pgfplots/pgfplots.code.tex:6603`: `enlarge@limit@for` updates the selected minimum/maximum using the range span.
- `tex/generic/pgfplots/pgfplots.code.tex:9418`: the 2D clip projects the four final axis-limit corners. It does not reuse the original unexpanded data box.

The reproducible native probe is
[`pgfplots-enlarged-clip-metrics.tex`](../../test/fixtures/pgfplots-enlarged-clip-metrics.tex).
MacTeX reports final limits approximately `[-0.3141783,3.455771]` and
`[-1.2000122,1.2000122]`, and a clip width/height of
`296.43137pt` / `182.62025pt`. This agrees with the 12cm/8cm requested dimensions
minus the standard 45pt description reserve, within TeX fixed-point rounding.

TikZKit already extended the axis lines and sampled curves, but its SVG clip
was constructed from `geometry.origin/width/height`, which represent the
unexpanded allocation for this middle-axis case. `src/pgfplots/clipping.js`
now projects `lineRanges` through `mapPoint` and orders the resulting corners.
Plots, marker-path clips and global overlays share that calculation. Reversed
axes work without a separate coordinate-specific branch. The 3D path is unchanged.

## Visual Acceptance

`command -v tikztosvg` returned `/Library/TeX/texbin/tikztosvg`.
The reference uses local pdflatex and local rsvg-convert; no font replacements
or downloads were introduced.

Artifacts: `outputs/qa/2026-10-22-cos-fixpoint-clipping-after/`.

- `tikzkit-svg/`, `tikzkit-png/`: fresh JS export.
- `tikztosvg-svg/`, `tikztosvg-png/`: fresh third-party reference.
- `mactex-png/`: native PDF rasterization.
- `browser-audit.html`: live SVG comparison, including the previous output.
- `browser/`: Chrome screenshots, full sheet/diff, legend crops and isolated curve-paint screenshots.
- `browser-audit.json`: actual browser viewport and paint measurements.
- `native-probe/`: native log/PDF with final-limit measurements.

All full panels, the diff and native PNG were visually inspected. Before the
fix, the blue curve stopped at x=0 and x=pi, and the red line stopped at (0,0)
and y=1. Afterwards, both blue tails remain visible in the enlarged margins;
the red line extends into the negative-x margin and reaches the enlarged top.
The annotation, ticks and legend are not moved by this change.

Chrome checks both default SVG and SVG-text at the same physical 3x scale.
Only clip-frame translation is removed; there is no fitting or rescaling.
The two curves are additionally painted in isolation to check actual pixels,
not just intended path coordinates. At a 2px tolerance in this 3x view:

| Check | Before | After, both modes |
| --- | --- | --- |
| Maximum clip-dimension error | 196.921px | 0.174px |
| Blue curve bidirectional pixel coverage | Below 8% after frame alignment | 100% |
| Red curve bidirectional pixel coverage | 0% after frame alignment | At least 99.965% |
| Legend frame/glyph checks | Pass | Still pass |
| Diagnostics / browser errors | 0 / 0 | 0 / 0 |

The before-paint percentages include the displaced old clip origin; they are
not a percentage of the old whole chart that was wrong. They prove that the
new gate rejects the old viewport. Full unregistered diffs still expose small
crop/tick/text residuals, which are outside this clipping acceptance.

## Commands and Options

- `enlarge x limits=true`, `enlarge y limits=true`, `xmin=0`, `xmax=pi`, `ymin=-1`, `ymax=1`: final mapped limits determine clipping.
- `axis x/y line=middle`, `width=12cm`, `height=8cm`: existing projection and physical dimensions retained.
- `\addplot`, `domain=-8:8`, `samples=200`, `cos(deg(x))`, `x`, colors and `very thick`: sampling/paint unchanged; expanded curve portions are no longer hidden.
- `\coordinate`, `axis cs`, `\fill ... circle`, `\node[label=...]`: global overlay clipping uses the same final box.
- `clip=false`, `clip mode=individual`, `clip marker paths`, reverse x/y directions: opt-out and reversed-axis behavior covered by regressions.
- Grid, custom tick labels, xlabel/ylabel, legend placement and font layout: unchanged, not newly certified.
- Dimension-based/asymmetric enlargement, logarithmic range survey, smooth/discontinuous path clipping, bars/fills and arbitrary custom clip paths: not completed by this batch.

## Verification

20 targeted clipping tests pass. The selected PGFPlots suites have 249 passes
and the same 42 existing failures. Full suite: 2,784 tests, 2,656 pass, 114 fail
(including one aggregate failure), 14 skip; no newly failing tests versus the
previous legend batch. Successful clipping acceptance is not an all-tests-pass
claim. No GitHub push or npm publication was performed.

```sh
node --test test/pgfplots-enlarged-clipping.test.js test/pgfplots-plot-clipping.test.js test/pgfplots-clip-mode.test.js test/pgfplots-marker-clipping.test.js test/pgfplots-3d-overlay-clip.test.js
npm run test:summary
node scripts/render-example-fixtures.js --only latex-examples-cos-fixpoint --output outputs/qa/2026-10-22-cos-fixpoint-clipping-after --native-reference --strict-tikztosvg --tikztosvg-engine pdflatex --math-renderer svg-text
node scripts/audit-module-regressions.js --fixtures test/fixtures/examples --only latex-examples-cos-fixpoint --output outputs/qa/2026-10-22-cos-fixpoint-clipping-after --before outputs/qa/2026-10-22-pgfplots-legends-after --legend-metrics --plot-clip-metrics --browser-module <local-playwright-index.mjs>
```

Next: investigate the existing PGFPlots range/tick failures against native
probes. Keep the new paint gate so a lowering-only success cannot hide a
browser clipping regression again.
