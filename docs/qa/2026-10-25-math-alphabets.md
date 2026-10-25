# Native Math Alphabets and 3D Labels

## Status

This slice fixes native primes, calligraphic capitals and mixed multiline node
boxes, plus label-style resets on explicit boxed 3D axes. It does not complete
all math typography or PGFPlots compatibility.

The explicit test suite now has 3,043 tests: 3,001 pass, 28 fail, 14 skip and
zero cancellations. Both previously failing A3C rounded-node sizing tests pass
without changing their assertions. No previously passing test remains newly
failing. Seven serialization assertions were updated to inspect native glyphs;
they are not counted as seven old failures fixed.

The user cancelled npm login/publication. No login, release, version change or
remote push was attempted in this slice. The package version remains 0.1.6.

## Local Implementation Evidence

`command -v tikztosvg` resolves to `/Library/TeX/texbin/tikztosvg`. References
use the installed pdflatex, dvisvgm and rsvg-convert, with separate MacTeX PNGs.
No font or TeX package was downloaded. Reviewed files below are relative to
`/usr/local/texlive/2025/texmf-dist/`:

- `tex/latex/base/fontmath.ltx`: `mathcal` selects the OMS symbols alphabet;
  `prime` occupies CMSY slot hexadecimal 30. It is not a roman apostrophe.
  Native math-size declarations select smaller optical faces for scripts.
- `tex/generic/pgf/frontendlayer/tikz/tikz.code.tex:4210-4265`: multiline node
  alignment uses a TeX box with the last row's baseline, not an HTML line box.
- `tex/generic/pgf/libraries/shapes/pgflibraryshapes.misc.code.tex:75-230`:
  rounded rectangle extents follow the measured text box and arc geometry.
  The existing shape implementation was correct; its input dimensions were not.
- `source/latex/base/ltplain.dtx:960-980,1490-1515`: uppercase abbreviations
  suppress sentence spacing; closing punctuation preserves the space factor.
  TFM EXTRASPACE contributes to the natural width of an ordinary sentence space.
- `tex/generic/pgfplots/pgfplots.code.tex:888-921,2765-3015`: 3D descriptions
  normally reset x/y label rotation. In compat >= 1.8, an explicit nonstarred
  `axis lines=box` reinstalls the near-tick label style, including 90-degree y
  rotation. An implicit box, starred box and pre-1.8 box do not do this.
  Later style rotations compose; an earlier axis-specific style is replaced.

Independent probes are `test/fixtures/native-math-alphabet-metrics.tex` and
`test/fixtures/pgfplots-3d-label-metrics.tex`. Their native dimensions are copied
into regressions, not derived from TikZKit output. Selected results in TeX pt:

| Formula / text | Width | Height | Depth |
| --- | ---: | ---: | ---: |
| `(\theta_1',\psi_1')` | 32.40283 | 7.51782 | 2.5 |
| `(\mathcal{T},\mathcal{R})` | 28.68536 | 7.5 | 2.5 |
| `\mathcal{T}_i` | 8.77573 | 6.83331 | 1.49998 |
| `\mathcal{R}'` | 11.2806 | 7.51782 | 0 |
| `f'+f''+f'''` | 57.6944 | 7.51782 | 1.94444 |
| `Env. 1` followed by the math row | 29.5834 | 18.83331 | 2.5 |

The 3D probe also records base-east/base-west anchors, so a correct label center
cannot hide a wrong rotation. Expected rotations are 90 degrees for explicit
modern box, 0 for starred/legacy box, 120 for a subsequent `rotate=30`, and 90
when that style precedes the box reset. Legacy compat is set before the axis.

## Implementation

- `scripts/build-cm-math.py` maps the missing Type 1 prime glyph explicitly.
  `cmMathMetrics.js`, packaged font data/manifests and 12 CMSY/CMBSY optical
  WOFFs were regenerated from MacTeX. The full 83-face build also restores the
  already configured CMTI10 face to the assets/manifest; no substitute font is
  introduced.
- `src/tex/mathBox.js` maps calligraphic capitals to CMSY or bold CMBSY and
  preserves scoped roman/normal/bold overrides. Primes use the existing script
  layout with the newly available native glyph, including nested scripts.
- `src/tex/textSpacing.js` shares space-factor rules between literal hboxes
  and paragraphs. `textBox.js` applies natural sentence extra-space; nonbreaking
  space does not receive that expansion.
- `src/tikz/textMetrics.js` measures mixed text/math rows through the existing
  native text-run layout. Browser default and SVG-text painting consume the
  same box, baseline grid and node dimensions.
- `src/pgfplots/axis3d.js` replays the supported box/style ordering, composes
  rotations, and avoids reintroducing a discarded axis-specific font style.
  It does not change surface projection, data sampling or clipping.

## Visual Acceptance

Main artifacts: `outputs/qa/2026-10-25-math-alphabets-after/`, with the matching
`2026-10-25-math-alphabets-before/` baseline. Each includes JS SVG/PNG,
tikztosvg SVG/PNG, native MacTeX PNG, and browser/difference panels.
`browser-audit.html` shows actual Chrome rendering of the default browser path,
SVG-text export and tikztosvg. All five current native PNGs and browser sheets
were inspected. There are zero JS diagnostics and no external/browser errors.

| Fixture | Visible outcome | Browser evidence |
| --- | --- | --- |
| rounded-agent-math | Primes and subscripts have native size and baseline; mixed `Agent n` and `Env. 1` rows produce the correct padded rounded boxes. | 56 glyphs, maximum error 0.021px |
| caligraphic-prime-sizes | All 26 calligraphic capitals, repeated primes and scoped bold formulas use the native optical faces at 5/7/10pt; the former misplaced/overflowing rows are corrected. | 126 glyphs, maximum error 0.062px |
| observation-prime-labels | Bold nuclei, primed superscripts and nested observation subscripts remain independently sized and positioned. | 56 glyphs, maximum error 0.018px |
| surface-prime-labels | The explicit box restores the vertical y description; primed/calligraphic labels match the reference while surface clipping is retained. | Separate 3D gate passes |
| commutative-prime-labels | Primed edge math uses the native glyph path, but the green/orange prose labels still have a visible vertical offset. | Visual control only; the complete case is not accepted |

The first three checks cover 238 glyph origins, using one frame translation at
a fixed 3x physical scale, not per-row alignment. Both default and export pass
the unchanged 0.09 CSS px tolerance. This is not a claim of identical raster
pixels or complete TeX support.

Dedicated 3D output: `outputs/qa/2026-10-25-math-alphabets-3d/`. Both browser
paths pass the unchanged 0.35px gate: 26 glyphs (max 0.058px), 51 tick segments
(0.100px), 19 grid segments (0.061px), frame (0.054px), canvas (0.070px).

Fresh regression controls are in
`outputs/qa/2026-10-25-math-alphabets-3d-controls/`. Hypersurface-2, a coarse
clipped saddle, its unclipped variant and CMOS all pass browser default/export
geometry checks with zero diagnostics. All four current sheets were inspected:
clipped facets meet the projected boundary, unclipped facets remain outside it,
and logarithmic labels retain their positions and optical sizes. Maximum glyph
error is 0.066px and grid error is 0.122px. These are regression checks, not four
newly fixed cases. Mesh color precision and stroke rasterization still differ.

### SVG Structure

The rounded-agent tikztosvg reference has a 273.675pt by 148.951pt viewport,
56 glyph uses and no text, foreignObject or markers. Shape paths retain native
butt/miter strokes and the inverted y-axis transform. JS paints 56 semantic
glyphs from those same packaged MacTeX outlines; it does not rely on browser
fallback font selection or HTML line height for this slice.

The surface reference has 26 glyph uses and per-face clipping; JS uses 26 text
glyphs and a projected-hull clip. The physical viewport is about
287.027pt by 210.594pt in the reference and 287.03pt by 210.57pt in JS.
Matching geometry does not require identical internal path/clip counts.

## Commands, Options and Boundaries

Exercised commands/options: `node`, `draw`, `align=center`, multiline `\\`,
rounded rectangles, inner separation, anchors, `mathcal` capitals, Greek math,
prime/repeated primes, subscripts/superscripts, `mathbf`, `boldsymbol`, optical
5/7/10pt math, `axis`, `addplot3[surf]`, view/bounds/clipping, x/y/z labels,
explicit/implicit/starred box, compat 1.7/1.18, label styles and rotation order.

Still partial: non-capital variable slots inside `mathcal` (including
`\mathcal{T_i}`), arbitrary mixed text spacing commands, general math alphabets,
ordinary prose-label placement, arbitrary PGF key handler/repeated-key replay,
and complete 3D pixel parity. Unsupported math remains a whole-expression
fallback rather than a partially wrong native box. One initial observation
probe used unsupported mixed-row spacing; the accepted fixture instead follows
the existing observation regression's separate-node structure.

The remaining 28 formal failures are still open. Bare Node discovery also picks
up three manual browser probe scripts without their required arguments:
`native-math-hat-browser-probe.mjs`, `pgfplots-histogram-browser-probe.mjs`, and
`pgfplots-native-seams/browser-bounds.mjs`. That run has 3,047 tests, 3,002 pass,
31 fail and 14 skips; it must not be reported as a green default test command.
Next work should separate those manual runners from automatic discovery and
fix the visibly displaced ordinary labels before declaring the diagram done.

## Verification

```sh
python3 scripts/build-mactex-fonts.py
node --test test/pgfplots-3d-label-metrics.test.js test/native-math-alphabets.test.js
node --test test/pgfplots-3d-label-metrics.test.js test/native-math-alphabets.test.js test/font-identity.test.js test/font-assets.test.js test/cm-optical-fonts.test.js
node --test --test-reporter=./scripts/module-test-reporter.js --test-reporter-destination=outputs/qa/2026-10-25-math-alphabets-after/test-final.json test/*.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/native-math-alphabets --output outputs/qa/2026-10-25-math-alphabets-after --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --strict-tikztosvg
node scripts/audit-module-regressions.js --fixtures test/fixtures/native-math-alphabets --output outputs/qa/2026-10-25-math-alphabets-after --before outputs/qa/2026-10-25-math-alphabets-before --browser-module /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
node scripts/audit-module-regressions.js --fixtures test/fixtures/native-math-alphabets --output outputs/qa/2026-10-25-math-alphabets-3d --only surface-prime-labels --tick-grid-metrics --browser-module /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
node scripts/audit-module-regressions.js --fixtures test/fixtures/pgfplots-surface-survey --output outputs/qa/2026-10-25-math-alphabets-3d-controls --only surface-survey-hypersurface --only surface-survey-clipped --only surface-survey-unclipped --only surface-survey-cmos --tick-grid-metrics --browser-module /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
npm run check:architecture
npm run docs:links
git diff --check
```

The focused command passes 39/39 tests; the expanded font/geometry check passes
137/137. Architecture checks pass for 482 modules, with the existing
text-to-frontend dependency debt unchanged. Registry entries
for TikZ, PGFPlots and shapes.misc record this scope and retain their existing
partial/builtin status; they are not promoted to complete library support.
