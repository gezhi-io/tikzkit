# Polar Tick Precision and Chronology Browser Checks

## Scope

This run addresses the remaining half-plane polar tick displacement first,
then checks the standalone and full-page chronology examples in an actual
browser. It does not certify all polar axes, general Beamer, or complete PGF
floating-point arithmetic.

Browser permission was granted for the independent Chromium test runner.
There was no workaround for the previously denied in-app file URL. Both the
normal JS conversion and exported SVG-text were rendered in Chromium, after
loading the packaged MacTeX fonts. No new fonts or packages were downloaded.

## Local Sources and Root Causes

All source paths below are relative to
`/usr/local/texlive/2025/texmf-dist/`.

| Source read | Finding and implementation |
| --- | --- |
| `tex/generic/pgf/frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.polar.code.tex` | The radians mapper maps `0.03141592653589793` to `1.8`. Native mantissa division yields a scale of `57.295`, not the ideal JavaScript `180 / Math.PI`. Clean axes add `0.5em` outside the radius and independently paint a pale axis at the maximum radius, even when a grid arc already occupies it. Omitting this second stroke changed visible ink coverage. |
| `tex/generic/pgf/frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.code.tex` | Numeric tick iteration is separate from label formatting. The JS iterator previously rounded tick values to three decimals before projection, moving pi-fraction ticks. Values now retain precision until geometry is evaluated. |
| `tex/generic/pgf/modules/pgfmoduledatavisualization.code.tex`, `tex/generic/pgf/libraries/pgflibraryfpu.code.tex` | Interval scaling uses normalized mantissas, dimension arithmetic and decimal output. The focused radians calculation preserves that order. This is not a replacement for the entire FPU. |
| `tex/generic/pgf/libraries/datavisualization/pgflibrarydatavisualization.polar.code.tex` | Projection uses PGF degree lookup, dimension multiplication and then the two axis vectors. Constant-radius paths use `pgfpatharcaxes`. |
| `tex/generic/pgf/basiclayer/pgfcorepathconstruct.code.tex:289-428` | Arc axes build a 1pt cubic arc before transforming its controls by the radius vectors. Partial-range grids and boundaries now retain that ordering and the mapped endpoint instead of using ideal semicircles. Arc semantics remain present in the scene graph. |
| `tex/generic/pgf/math/pgfmathfunctions.trigonometric.code.tex`, `pgfmathfunctions.basic.code.tex`, `tex/generic/pgf/basiclayer/pgfcorepoints.code.tex` | Trigonometric lookup, fixed-point multiply/divide and direction selection explain the residual coordinate shifts. The existing fixed-point helpers are reused. |
| `tex/latex/chronology/chronology.sty` | `chronevent` is `fill=black,draw=none,opacity=.5`. Missing `draw=none` let an inherited stroke thicken point and interval events. Both generated paths now disable strokes explicitly; labels remain separately opaque. |

The independent `test/fixtures/polar-half-plane-metrics.tex` probe records
all 13 angle-label centers, directions, radians scaling and native arc soft
paths. The regression checks these native numbers, not numbers copied from
TikZKit. The arc-control and chronology-paint tests were observed failing
before their implementation changes. No existing visual tolerance was raised.

## Commands and Options Checked

| Slice | Covered in this run | Not certified |
| --- | --- | --- |
| Polar ticks | `datavisualization.polar`, `datavisualization.formats.functions`, `scientific polar axes={0 to pi,clean}`, degree quadrant control, `all axes=grid`, numeric steps, pi-fraction labels, clean boundary padding and directional anchors | Arbitrary native axis objects, custom legend matrices and font contexts, complete logarithmic/FPU parity |
| Polar paths | Function-format `var angle`, `func radius`, smooth line visualizers, `style sheet=vary hue`, `legend=below`, fixed-point partial-range grid/boundary arcs | Full-circle boundary changes and all custom projection variants were not independently certified here |
| Chronology | `[step]`, year range, requested and unscaled widths, point/span `event`, annual/major ticks, rotated labels, `draw=none`, half-opacity black fill, start bar and arrow | Arbitrary style overrides, `eventspan`/`eventpoint`, general document layout |
| Full-page control | The existing single centered 10pt 4:3 Metropolis layout, title, footer, both chronology boxes and CMSS font selection | Other Beamer themes, sizes, aspect ratios and multiple-frame behavior |

## Browser Evidence

Artifacts are under `outputs/qa/2026-10-25-polar-timeline-final/`:

- `browser-audit.html`, `browser-audit.json`, `browser/`: fresh Chromium
  default-JS, reference, SVG-text, before and diff panels.
- `tikzkit-svg/`, `tikzkit-png/`: actual JS output.
- `tikztosvg-svg/`, `tikztosvg-png/`: seven genuine local tikztosvg references
  and one explicitly identified `native-latex` full-page reference.
- `mactex-png/`, `mactex-log/`: eight independent native PDF renders.
- `diff/`, `diff-png/`: image differences and native/reference/JS sheets.
- `tikztosvg-input/`, `tikztosvg-log/`: reference input and provenance.

`command -v tikztosvg` returned `/Library/TeX/texbin/tikztosvg` (0.3.0).
SVG references are rasterized with local `rsvg-convert`. MacTeX PNGs use
`pdflatex` and `pdftocairo` independently.

The standalone chronology wrapper captures the native completed savebox
before standalone cropping; it does not recompute the events. Full Beamer
cannot load its theme through tikztosvg's standalone wrapper, so its reference
is a two-pass native PDF converted to SVG with original physical page size.
It is not represented as a successful tikztosvg conversion.

The browser uses a fixed physical scale, enlarged three times. Alignment is
one translation, never fitted scaling. Polar uses its explicit blue frame.
Chronology uses the timeline shaft, with the theme shaft color distinguished
from the title progress rule. Every event's bounds, fill, stroke and opacity
are checked in addition to every glyph origin. A regression verifies that
extra strokes, opacity changes, displacement or missing events fail this gate.

| Case | Before and after observation | Browser result |
| --- | --- | --- |
| `remaining-polar-half-plane` | Pi-fraction labels and tick rays no longer tilt from prematurely rounded angles. Native unit-arc controls replace the ideal semicircle; the missing pale axis stroke now has the native ink weight. Legend labels remain black and the two samples remain aligned. | All 69 glyphs pass the original 0.09px gate; maximum coordinate error falls from 0.1781px to about 0.0214px at 3x. The JS/tikztosvg PNG pair also passes the unchanged gate, with differing pixels reduced from 622 to 156 after restoring the pale axis. |
| `remaining-polar-degrees` | Degree labels, both origin labels and the quadrant frame are retained as a non-radian control. | All 15 glyphs pass, maximum 0.0142px. |
| `chronology-core` | The interval and event points lose their unwanted inherited outline. Annual ticks, 1920-2020 labels and the three slanted event labels keep native placement. | Three events and 43 glyphs pass; maximum event-bound error 0.0149px and glyph error 0.0108px. |
| `remaining-chronology-title` | Both timelines keep their positions, labels and page typography; event spans no longer have the dark extra stroke. Title, event labels, dates and page number are included, not just the axis. | Four events and 100 glyphs pass; maximum event-bound error 0.0188px and shaft-aligned glyph error 0.0307px. |

The native SVG structure was inspected: cubic arc controls, physical transforms,
filled event paths, alpha groups, stroke caps, `<use>` glyph positions and
viewBox dimensions. JS retains native-font SVG text rather than substituting
reference images. Before panels deliberately remain failing for chronology
paint, demonstrating that the new gate detects the repaired defect.

## Remaining Visual Limits

The browser geometry/paint gates above pass, and all four targeted JS/reference
PNG pairs pass the unchanged threshold. Across the eight controls, only the
pre-existing full angles diagram still fails that pairwise PNG gate. Its
angle-label geometry is outside this request; its paragraph control passes
separately. This is not a claim of exact pixel identity.

**The independent native-PDF pixel gate remains open.** PDF rasterization
differs from both JS SVG rasterization and the
independent tikztosvg SVG rasterization. The native sheets visibly show heavier
small strokes and text edges at 96dpi. These differences remain in the report;
they were not waived, rescaled away or labelled pixel-identical. A follow-up
should isolate backend ink coverage at the same physical scale, without
loosening the existing gate. The few remaining half-plane SVG differences
also include curve-intersection paint order, which is not certified here.
Neither library's registry status is promoted beyond `partial`.

## Verification

The final full test run contains 3,133 tests: 3,119 passed, zero failed,
zero cancelled and 14 existing skips. Its unmodified machine-readable report
is saved as `outputs/qa/2026-10-25-polar-timeline-final/full-tests.json`.
This run includes the local web-server tests that were blocked previously.
The eight browser cases report no browser errors; all configured glyph and
chronology paint checks pass. Seven of eight JS/reference PNG pairs pass,
including all four targeted polar and chronology cases. The independent
native-PDF pixel gate remains open as described above.

The same 3,133-test collection was rerun before the GitHub update, with the
same counts. Documentation links and the 488-module architecture check pass;
the pre-existing nested-axis frontend dependency remains recorded as known
debt. An extracted local npm tarball resolves all 93 font faces and renders
embedded/shared-font SVGs with zero diagnostics. No npm publication is needed
for this GitHub-only checkpoint.

```sh
pdflatex -interaction=batchmode -halt-on-error -output-directory=/tmp test/fixtures/polar-half-plane-metrics.tex
node --test test/datavis-polar-tick-layout.test.js test/chronology-layout.test.js test/browser-chronology-metrics.test.js
node --test --test-reporter=./scripts/module-test-reporter.js --test-reporter-destination=/tmp/tikzkit-polar-timeline-final-tests.json test/*.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/visual-followups --output outputs/qa/2026-10-25-polar-timeline-final --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --no-comparison-grid
node scripts/audit-module-regressions.js --fixtures test/fixtures/visual-followups --output outputs/qa/2026-10-25-polar-timeline-final --before outputs/qa/2026-10-25-visual-followups-final --browser-module /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
node scripts/diff-example-pngs.js --output outputs/qa/2026-10-25-polar-timeline-final --register
node scripts/check-font-package.js
node --experimental-vm-modules scripts/check-architecture.js
git diff --check
```

Changed implementation: `src/frontend/latex-shell.js`,
`src/tikz/libraries/datavisualizationPolarTicks.js`,
`src/extensions/chronologyLayout.js`, and the arc provenance in
`src/engine/evaluate.js`. Tests, native probe, fixture manifest, browser metrics,
QA documentation and the two registry entries accompany these changes.
Unrelated existing workspace edits were preserved. No GitHub push, npm login,
version bump or publication was performed in this run.
