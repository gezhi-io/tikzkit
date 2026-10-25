# Scoped-Font Paragraph Wrapping

## Scope and Status

This slice fixes source-run ownership after wrapping and the loss of a scoped
font size when a line contains one run. It also introduces a bounded,
native-metric, non-hyphenating first pass. It does not implement all TeX
paragraph breaking, font substitution or browser baseline behavior.

Full regression: **3,023 tests, 2,979 passed, 30 failed, 14 skipped, zero
cancelled**. The previous checkpoint had 31 failures. The existing test
`wraps plain node text to TikZ text width before shrinking` now passes.
Six new regressions are additional coverage, not six old failures resolved.
No existing assertion was changed and no newly failing test name appeared.
No npm login, release, version bump or remote push was performed.

## Local Source Review

Paths below are relative to `/usr/local/texlive/2025/texmf-dist/`.

| Source | Relevant behavior |
| --- | --- |
| `tex/generic/pgf/frontendlayer/tikz/tikz.code.tex:1130-1175,3872-3915` | Text-width nodes create a minipage. Centered text uses two finite 2em side stretches and fixed .3333em spaces; font scopes belong to their source characters. |
| `tex/latex/base/latex.ltx:491-507,15414-15423,16272-16287` | The first pass uses pretolerance 100, line penalty 10 and adjacency demerits 10000. Minipages use sloppy paragraph settings for later passes. Ragged-right changes final-line glue and hyphen demerits. |
| `tex/latex/base/ot1cmtt.fd:50-82` | Typewriter disables automatic hyphenation and uses NFSS optical sizes; bold typewriter substitutes the normal face. |
| `tex/latex/pgf/utilities/pgfutil-latex.def` | PGF's minipage and ragged-right operations delegate to LaTeX. |
| `fonts/tfm/public/cm/cmti10.tfm` | Italic width/kern/ligature metrics used by the first-pass measurement. Existing metric families were verified unchanged by regeneration. |

The diagnostic [native probe](../../test/fixtures/text-wrap-native-metrics.tex)
uses paragraph tracing and showbox. Its log is
`outputs/qa/2026-10-25-text-wrap-before/probe.log`; it ran before the source was
moved out of the visual-fixture directory. The expected showbox `! OK` exit is
diagnostic, not a successful image compile. Native mixed-font text has three
lines (`First code code`, `code code then`, `italic words last.`). The inherited
ragged paragraph requires a second hyphenating pass, not yet implemented here.

The first-pass implementation uses TFM advances, kerns and ligatures, finite
side glue and line/fitness costs. Its badness calculation is an approximation
to TeX's integer arithmetic. Unsupported fonts and unsuccessful first passes
retain the existing fallback. Exact second-pass hyphenation, sentence spacing,
arbitrary NFSS substitution and nested paragraph constructs remain open.

## References and Visual Inspection

`command -v tikztosvg` resolves to `/Library/TeX/texbin/tikztosvg`.
All five [fixtures](../../test/fixtures/text-wrap-native/manifest.json) generated
JS SVG/PNG, tikztosvg SVG/PNG and independent MacTeX PNG, with zero diagnostics
and zero external compilation failures. SVG rasterization uses local
`rsvg-convert`.

Artifacts: `outputs/qa/2026-10-25-text-wrap-after/`, including `tikzkit-svg/`,
`tikzkit-png/`, `tikztosvg-svg/`, `tikztosvg-png/`, `mactex-png/`, `browser/` and
`browser-audit.html`. Actual Chrome 155 default-JS and SVG-text panels were
compared with tikztosvg and diff panels. All five browser sheets and native
PNGs were inspected. This batch has no numerical browser acceptance gates;
zero browser errors are not a claim of pixel parity.

Native SVG uses outlined glyphs referenced by `use`, explicit positions,
physical-point viewBoxes and y-flip transforms. The controls use .3985-wide
butt/miter rectangle paths, no text/foreignObject or SVG markers. Native
typewriter, mixed and inherited controls have 41, 142 and 41 glyph uses.

| Case | Visible result and remaining differences |
| --- | --- |
| text-wrap-typewriter | Previously the full sentence appeared on both lines and overflowed. Now each character appears once, with the native two line breaks. Browser typewriter glyph/space widths and baselines still differ. |
| text-wrap-mixed | Bold, typewriter, italic and small runs no longer replay on each line or overlap neighboring boxes. The three controls now have native line breaks and retain small text. Some font, baseline and box-height drift remains. |
| text-wrap-inherited | Still five lines versus native four; native breaks `verifi-cable` while the old fallback chooses different fragments. Not accepted. |
| latex-examples-haskell-type-classes | Real matrix diagram retains all text and small Enum content without duplication. Node heights, row positions, baselines and some edge endpoints still differ. No before image was captured for this added control. |
| minipage-text-width | SVG-text uses the native word groups, but default browser rich text still wraps too early and crowds the border. This exposed a separate option/line-height mismatch, not a completed case. No before image was captured for this added control. |

## Commands and Parameters

| Surface | Status |
| --- | --- |
| `\node`, `text width`, inherited `nodes`, `align=center/left` | Wrapped source-run partition is shared by measurement and paint. First-pass finite-glue behavior is bounded, not complete TeX line breaking. |
| `\texttt`, `\textbf`, `\textit`, grouped `\small` | Source scopes survive line splits and repeated words. CMTI10 metrics are measurement-only in this slice; no new browser font asset is added. |
| `\-` | An inserted line-end hyphen inherits the split word's run without consuming or replaying another character. Full language-pattern hyphenation remains open. |
| `\matrix`, `row sep`, `column sep`, ellipse nodes, edge styles | Existing Haskell corpus behavior is exercised, not declared fully matched. |
| `minipage`, `0.35\textwidth`, inline math, rounded fill, `inner sep=1ex` | Exercised as a real-world residual control. Default rich-text layout remains partial. |

## Changes and Verification

Runtime: `src/tikz/textWrapping.js`, `src/tikz/textMetrics.js`,
`src/engine/evaluate.js`, `src/renderers/svg/textLayout.js`,
`src/renderers/svg/plainTextNode.js`. Font measurement:
`scripts/build-cm-math.py` and `src/tex/cmMathMetrics.js`. Tests:
`test/text-wrapping.test.js`, the native probe and five-fixture manifest.

```sh
python3 scripts/build-cm-math.py --metrics-only
node scripts/render-example-fixtures.js --fixtures test/fixtures/text-wrap-native --output outputs/qa/2026-10-25-text-wrap-after --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --strict-tikztosvg
node scripts/audit-module-regressions.js --fixtures test/fixtures/text-wrap-native --output outputs/qa/2026-10-25-text-wrap-after --before outputs/qa/2026-10-25-text-wrap-before --browser-module /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
node --test --test-reporter=./scripts/module-test-reporter.js --test-reporter-destination=outputs/qa/2026-10-25-text-wrap-after/test-final.json test/*.test.js
node --experimental-vm-modules scripts/check-architecture.js
node scripts/check-doc-links.js
```

The full remaining failures are in `test-final.json`. Next: unify default rich
paragraph wrapping options and baseline geometry with SVG-text, then address
native hyphenating passes and typewriter painting. The overall goal is open.
