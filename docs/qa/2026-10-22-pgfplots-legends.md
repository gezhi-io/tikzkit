# PGFPlots Mathematical Legends

## Scope and Result

This batch repairs mathematical line-legend cell dimensions, row spacing,
glyph baselines and placement. It was selected because the compact-function
and math-heavy legend tests failed, and their implementation used empirical
formula-specific clearances. This is not acceptance of all PGFPlots rendering.

Two existing failures are resolved. Six new regressions pass. All 23 targeted
legend tests pass. The selected PGFPlots suites now have 245 passes and 42
failures, down from 44 failures. The full suite has 2,780 tests: 2,652 pass,
114 fail (including one aggregate failure), and 14 skip. There are no newly
failing tests compared with the preceding module-repair baseline.

## Local Source Review

Sources are from `/usr/local/texlive/2025/texmf-dist/`:

- `tex/latex/pgfplots/pgfplots.sty`: the package loads the generic implementation.
- `tex/generic/pgfplots/pgfplots.code.tex`: `every axis legend` uses 3pt/2pt matrix padding, 2pt text-node padding and `text depth=0.15em`; line samples are 0.6cm. The default position is `(0.98,0.98)`, while named corner presets use 0.03/0.97.
- `tex/generic/pgf/modules/pgfmodulematrix.code.tex`: matrix cells use picture bounds, row maxima and column maxima. A stroked sample includes half its line width at each end.
- `tex/generic/pgf/modules/pgfmoduleshapes.code.tex`: rectangle anchors include outer separation, while the border path excludes it.
- `tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`: `font` runs inside the text hbox; forced height/depth are evaluated outside it. Thus `font=\tiny` does not also shrink the default node depth to a tiny-font em. `node font` has different scope.

The reproducible native probe is
[`pgfplots-legend-metrics.tex`](../../test/fixtures/pgfplots-legend-metrics.tex).
The compact legend measures 49.04256 by 23.61096 TeX pt; its sample row pitch
is 9.80548pt. The tiny matrix legend measures 62.23669 by 54.99987 TeX pt,
with 12.74997pt sample row pitch. These are measurements of native matrices,
not constants fitted to TikZKit images.

Two old test assumptions were corrected alongside the implementation:
SVG `pt` is a big point (72 per inch), not TeX pt (72.27 per inch); and the
activation-functions source uses ultra-thick samples, not default thin ones.
The row-pitch assertion now measures sample centers, separately from glyph
centers. A style assertion parses node options instead of matching a serialized
closing bracket. No unrelated failing assertions were relaxed or skipped.

## Browser and Native Evidence

`command -v tikztosvg` returned `/Library/TeX/texbin/tikztosvg`.
Both native references use local pdflatex. SVG references were rasterized with
local `rsvg-convert`. No font download or substitution was introduced.

- Before: `outputs/qa/2026-10-22-pgfplots-legends-before/`
- After: `outputs/qa/2026-10-22-pgfplots-legends-after/`
- Live comparison: `browser-audit.html` in the after directory.
- Measurements: `browser-audit.json`, `pgfplots-tests.json`, `test-summary.json`.
- Each case has `tikzkit-svg/`, `tikzkit-png/`, `tikztosvg-svg/`, `tikztosvg-png/`, `mactex-png/` and browser screenshot/diff artifacts.

Chrome renders both the default JS output and SVG-text output. Glyph origins
and frame dimensions are compared at the same physical scale and 3x CSS zoom.
Only the frame's translation is removed; neither image is fitted or stretched.
Whole-chart screenshots, before/after panels, supplemental diffs and native
PNGs were also inspected. All three cases have zero diagnostics and no browser
font errors.

| Real case | Visible correction | Before / after maximum glyph-origin error |
| --- | --- | --- |
| activation-functions | Fraction and ordinary rows now share native baselines relative to their line samples; the text no longer drifts right/down inside the frame. | 5.480px / 0.024px |
| cos-fixpoint | The compact legend is no longer too narrow; upright `cos`, italic `x`, and row spacing use CM glyph boxes in the browser too. | Old fallback was not glyph-addressable; frame error 9.491px / 0.007px |
| faktorraum | Tiny matrix glyphs retain their real depth while the node's forced depth remains in the surrounding font; row pitch and sample alignment now match. | 7.587px / 0.015px |

All 104 reference glyph origins match in both current rendering modes, with
maximum error 0.036px. Frame errors are below 0.007px. These checks accept
the legend slice, not the entire plot or every mathematical expression.

## Commands and Options

| Source construct | Status in this batch |
| --- | --- |
| `\usepackage{pgfplots,amsmath}`, `axis`, `\addplot`, `\addlegendentry`, `\legend` | Existing parsing retained; legend lowering now uses the shared cell-layout module. |
| `legend pos`, default position, `legend style={at,anchor}`, `legend cell align` | Native default/preset distinction, outer separation and left/center/right text placement. |
| `font=\tiny`, `\scriptsize`, normal math; `\frac`, `\varphi`, `\tanh`, `\max`, `\log`, `\cos`, `pmatrix`, subscripts/superscripts | Shared CM text-box layout and glyph painting; unsupported formulas retain fallback. |
| Line width, `thick`, `very thick`, `ultra thick`, colors and dashes | Sample width includes stroke bounds. Existing paint semantics are unchanged. |
| `legend columns`, row/column separation, node padding and forced text dimensions | Handled by the matrix-layout module; advanced origin-based separation grammar is not accepted by this audit. |
| Axis limits, domains/samples, tick labels, grid, titles and axis labels | Unchanged and not certified by this legend acceptance. |
| `\coordinate`, `\fill ... circle`, `\node[label=...]`, `axis cs` in cos-fixpoint | Existing overlay behavior retained; the surrounding plot still differs. |
| `\documentclass`, preview/standalone border, `\setlength`, `\definecolor`, `\pgfplotsset`, `\usetikzlibrary` | Existing document/package handling retained, not newly completed. |

## Verification

```sh
node --test --test-name-pattern=legend test/pgfplots-seams.test.js test/pgfplots-legend-metrics.test.js
npm run test:summary
npm run check:architecture
node scripts/render-example-fixtures.js --only latex-examples-activation-functions --only latex-examples-cos-fixpoint --only latex-examples-faktorraum --output outputs/qa/2026-10-22-pgfplots-legends-after --native-reference --strict-tikztosvg --tikztosvg-engine pdflatex --math-renderer svg-text
node scripts/audit-module-regressions.js --fixtures test/fixtures/examples --only latex-examples-activation-functions --only latex-examples-cos-fixpoint --only latex-examples-faktorraum --output outputs/qa/2026-10-22-pgfplots-legends-after --before outputs/qa/2026-10-22-pgfplots-legends-before --legend-metrics --browser-module <local-playwright-index.mjs>
```

Implementation files: `src/pgfplots/legendMatrix.js`, `legend.js`,
`src/tex/mathBox.js`, `src/tikz/textMetrics.js`, `src/engine/evaluate.js`, and
the SVG math/text-engine modules. The native-math opt-in is restricted to this
PGFPlots lowering, preserving datavisualization's separate layout. Tests,
native probes, browser audit tooling and registry documentation accompany it.

## Remaining Work

PGFPlots remains partial. There are still 42 failures in the selected suites,
including 3D labels/bounds, grid/tick behavior and obsolete string assertions.
They need individual investigation rather than bulk expected-value replacement.

The cos-fixpoint curve is still clipped to explicit data limits rather than the
enlarged axis frame; this is the next recommended shared fix. Numeric tick and
overall crop offsets remain visible in the full plots. Plain/mixed-text,
bar/area legends retain their older layout; arbitrary legend ordering, entry
callbacks, custom marker bounds and full font/document-size inheritance are
not claimed complete. This batch was neither published to npm nor pushed.
