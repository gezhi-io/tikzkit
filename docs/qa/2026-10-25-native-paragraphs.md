# Native Paragraph Boxes

## Status

This repairs mixed text/math minipages and the supported flush-aligned paragraph
path. It is not a complete TeX paragraph engine. Four actual Chrome comparisons
pass for both default JS and SVG-text, with 513 independently checked glyph
origins. The tolerance remains 0.09 CSS px at 3x physical scale, using one frame
translation, not a per-line fit.

The full explicit test suite has 3,032 tests: 2,988 pass, 30 fail, 14 skip,
zero cancellations. The same 30 names failed at the previous committed
checkpoint. Nine new regressions pass. Two old assertions were corrected from
native evidence, not counted as two previously failing runtime bugs fixed.
No npm login, publication, version change or remote push was attempted.

## Local Evidence

`command -v tikztosvg` resolves to `/Library/TeX/texbin/tikztosvg`.
The reference engine is the installed pdflatex. No network installation is used.
Paths below are within `/usr/local/texlive/2025/texmf-dist/`:

- `tex/generic/pgf/frontendlayer/tikz/tikz.code.tex:1130-1180`: text width,
  justified/ragged/centered actions and infinite flush glue. Flush glue can
  stretch but cannot shrink; overwide centered rows still shrink word glue.
- `tex/latex/base/latex.ltx:16272-16340`: minipage vbox construction, zero
  paragraph indentation, restored baseline settings and final-line fill glue.
- The same file, lines 491-507 and 18332-18341: pretolerance, line/hyphen
  penalties, sloppy tolerance 9999 and emergency stretch 3em.
- `doc/plain/texbytopic/TeXbyTopic.tex:11765-12042`: paragraph-wide demerits,
  fitness classes and retry passes, rather than independent greedy lines.
- `tex/generic/hyphen/hyphen.tex`: the original 4,447 Liang patterns and 14
  exceptions. The installed `texmf-var/tex/generic/config/language.dat` maps
  language zero to this file, not the larger `usenglishmax` pattern set.
- `fonts/tfm/public/cm/cmr10.tfm`, inspected with local `tftopl`: the first
  matching `k/v` then `a` kern is -0.055555em. A later shared `w` program has
  a different match. FontTools' flattened map had overwritten the first match.

`test/fixtures/paragraph-native-metrics.tex` independently shows the TeX boxes.
Its deliberate `showbox` commands return status 1 with `! OK`; these diagnostic
probes are not reported as successful document compilation. The actual visual
fixtures all compile successfully.

| 4.25cm paragraph | Native height + depth | Baseline |
| --- | --- | --- |
| 10pt prose/relation | 24.94444 + 19.94444pt | 12pt |
| 9pt prose/relation | 17.25 + 12.75pt | 11pt |
| 12pt prose/relation | 36.33331 + 30.33331pt | 14pt |
| Scripts and inline fraction | 18.57002 + 13.57pt | 12pt |
| Nested display fraction | 26.42873 + 21.42873pt | 12pt, then 1pt line clearance |

The 45pt centered `a intersect` probe has glue set -0.32504. This explains
the old 0.738px horizontal discrepancy without any coordinate adjustment.

## Implementation

- `src/tex/paragraphBreaking.js`: bounded minimum-demerit breaking with natural
  TFM widths, stretch/shrink capacity, fitness penalties and retry passes.
  Measurement stays separate from final line packing.
- `src/tex/hyphenation.js`, `englishPatterns.js`: default English pattern trie
  and exceptions; source notice and SHA-256 retained. Rebuild with
  `node scripts/build-english-hyphenation.js` against installed MacTeX.
- `src/tex/paragraphBox.js`: native text/math hboxes, interword and top-level
  math glue, final-line behavior, optical sizes, baseline and tall-line spacing.
- `src/tex/mathBox.js`: retain top-level math-glue metadata without stretching
  glue inside already packed fractions or scripts.
- `src/renderers/svg/paragraphText.js`, `plainTextNode.js`, `textEngine.js`:
  browser and exported SVG consume the same box. Supported paragraphs no longer
  use unrelated HTML line height or flatten formulas to literal slash text.
- `src/engine/evaluate.js`: node dimensions use that same logical vbox and
  native inner separation. Rectangle path centerlines no longer double-count
  stroke padding for this path.
- `richText.js`, `richTextNode.js`: fallback paragraph wrapping receives the
  same line-break and hyphenation options.
- `scripts/build-cm-math.py`, `src/tex/cmMathMetrics.js`: preserve first-match
  TFM lig/kern order. Regeneration changes 56 kern pairs in 28 optical faces;
  glyph outlines, dimensions, ligatures and font files are unchanged.

## Visual Results

Artifacts: `outputs/qa/2026-10-25-paragraph-after/`, with corresponding
`2026-10-25-paragraph-before/` baseline. The after directory includes native
MacTeX PNGs, tikztosvg SVG/PNGs, JS SVG/PNGs, browser default/export screenshots,
before/reference/difference sheets and `browser-audit.html`.
All four fixtures have zero JS diagnostics and no external/browser errors.
All native PNGs and current browser comparison sheets were actually inspected.

| Case | Visible change | Max glyph error, default and export |
| --- | --- | --- |
| Real minipage-text-width | CM weights, relation spacing, justified rows and padded node frame match; the blue incoming edge remains intact. | 0.029px, 75 glyphs |
| minipage-native-sizes | 9/10/12pt use native optical metrics and exact word breaks; large text no longer crosses its own node border. | 0.023px, 225 glyphs |
| minipage-native-formulas | Real fraction bars and scripts replace flattened slash formulas; tall fractions reserve native vertical clearance and no longer overflow the box. | 0.021px, 126 glyphs |
| paragraph-diamonds | The overwide centered line shrinks its word space; all three shapes retain native line groups and dimensions. | 0.020px, 87 glyphs |

Native SVG uses glyph outlines and explicit positions without foreignObject.
JS retains semantic glyph origins with the same packaged MacTeX outlines.
Difference panels still expose subpixel rasterization/rounding at glyph and
thin-stroke boundaries. Passing geometry is not a claim of identical PNG bytes.

Existing minipage height expectation was an estimate of 53.6pt; the native
probe measures 44.88888 + 2*4.30554pt including padding. Its original tolerance
is retained. Diamond tests now check row glyph content, geometry and native
paint rather than requiring a particular `tspan` serialization. The stronger
87-glyph browser check is additional, not a replacement for shape assertions.

### 3D Regression Controls

Fresh artifacts in `outputs/qa/2026-10-25-paragraph-3d-controls/` recheck the
priority 3D scope after the shared font-data change. Hypersurface-2, a coarse
clipped saddle, its unclipped variant and CMOS all compile with zero diagnostics
and external errors. Actual Chrome default/export comparisons pass the unchanged
0.35px tick/grid/glyph/frame/canvas gate for all four. Maximum glyph error is
0.066px; maximum grid error is 0.122px. The sheets were visually inspected:
clipped facets meet the projected boundary, unclipped facets remain outside it,
and log-axis descriptions retain the native location and optical fonts.
These are regression checks, not four newly fixed cases. Mesh rasterization
and color precision still differ; complete 3D pixel parity is not certified.

## Coverage and Remaining Work

Exercised: `node`, `draw`, `minipage`, text width including `0.35\textwidth`,
`text badly centered`, `inner sep=1ex/0pt`, anchors, rounded rectangles,
diamonds, `small`/normal/`large`, inline math, Greek relations, subscripts,
superscripts, `frac`, nested display fractions, CM kerns and English hyphenation.

Still partial: arbitrary scoped fonts/colors inside paragraphs, other languages,
custom paragraph registers, breakpoints inside math, manual discretionary
hyphens, nested minipage/page layout and general TeX expansion. Unsupported
text controls fall back as a complete unit. The native breaker limits source
length and candidate count; it is not a full TeX implementation.
The 30 pre-existing failures, including node/anchor sizing and remaining
datavisualization legend behavior, are still open.

## Verification

```sh
node --test test/paragraph-layout.test.js test/math-box.test.js test/math-structures.test.js test/math-alignments.test.js test/text-wrapping.test.js
node --test --test-reporter=./scripts/module-test-reporter.js --test-reporter-destination=outputs/qa/2026-10-25-paragraph-after/test-final.json test/*.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/paragraph-native --output outputs/qa/2026-10-25-paragraph-after --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --strict-tikztosvg
node scripts/audit-module-regressions.js --fixtures test/fixtures/paragraph-native --output outputs/qa/2026-10-25-paragraph-after --before outputs/qa/2026-10-25-paragraph-before --browser-module /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
node scripts/render-example-fixtures.js --fixtures test/fixtures/pgfplots-surface-survey --output outputs/qa/2026-10-25-paragraph-3d-controls --only surface-survey-hypersurface --only surface-survey-clipped --only surface-survey-unclipped --only surface-survey-cmos --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --strict-tikztosvg
node scripts/audit-module-regressions.js --fixtures test/fixtures/pgfplots-surface-survey --output outputs/qa/2026-10-25-paragraph-3d-controls --only surface-survey-hypersurface --only surface-survey-clipped --only surface-survey-unclipped --only surface-survey-cmos --tick-grid-metrics --browser-module /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
npm run check:architecture
npm run docs:links
git diff --check
```

The focused math/text command passes all 36 tests. Architecture passes with
481 modules and the existing text-to-frontend dependency debt unchanged.
