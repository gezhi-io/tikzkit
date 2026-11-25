# Native Named-Operator Limits

## Scope and Status

This follows the next TODO in
[native operators and edge-local paint](2026-10-28-native-operators-edge-scope.md):
preserve starred operator declarations and typeset their limits with local
MacTeX metrics. The scope is named operators, not all large symbols or TeX.

The browser and SVG-text outputs now visibly improve. All **247 glyph origins**
across two new controls and one existing control pass the unchanged browser
gate. All three JS/tikztosvg PNG comparisons pass. **Whole-image native-PDF
acceptance is still open**; this is not a claim of pixel-identical MacTeX output.

Thirty-one tests were added. The final full collection has **3218 passed,
0 failed, 14 existing skips**. No publish, version change or remote push was
performed. The unrelated edits from preceding turns remain in the worktree.

## Local Sources

Paths below are relative to `/usr/local/texlive/2025/texmf-dist/`.

| File | Implementation rule |
| --- | --- |
| `tex/latex/amsmath/amsopn.sty`, lines 28-110 | Starred declarations use `qopname` with the display-limit policy; ordinary declarations use `nolimits@`. The zero-kern operator nucleus is a box, not a single character that needs axis centering. An immediate `limits` after an ordinary operator is consumed by `nolimits@`. |
| `doc/latex/amsmath/amsldoc.tex`, lines 1654-1660 and 1854-1877 | The manual's `DeclareMathOperator*{Lim}{Lim}` example demonstrates a named limit. Inline and display placement differ; explicit modifiers can override starred/default limits. |
| `doc/plain/texbytopic/TeXbyTopic.tex`, lines 13778-13794 | Consecutive `limits`/`nolimits` use the last modifier. Explicit `displaylimits` is a separate control, not implemented by this slice. |
| `fonts/source/public/cm/cmex10.mf`, final fontdimen block | The five big-operator parameters define minimum clearance, baseline separation and invisible padding beyond the limits. |
| `fonts/tfm/public/cm/cmex*.tfm`, existing imported metrics | AMS optical-size extension fonts supply the actual spacing values at the active math size; base LaTeX without AMS retains its fixed extension-font selection. |

The independent probe
[`native-operator-limits-metrics.tex`](../../test/fixtures/native-operator-limits-metrics.tex)
logs 27 native boxes, including the declared/explicit-name equivalence.
Twenty-six distinct width/height/depth expectations are checked to 0.001 TeX pt.
For example, display `rank^2_k A` measures 28.91670 x 14.45554 + 7.52776pt;
at 7pt it measures 23.10890 x 10.48329 + 5.63887pt. Expected values were not
generated from JS or changed to accommodate its output.

## Implementation

The frontend previously discarded the declaration's star. It now expands the
two declaration forms to different operator-name forms.

KaTeX's operator-name AST conflates default starred limits with explicit
`nolimits`. A per-parse macro wraps only the starred nucleus in `mathop`,
retaining the parser's explicit-modifier flag without changing global KaTeX
behavior. General `mathop` bodies still use the complete fallback.

The shared native box centers nucleus and limits to their maximum width.
Upper clearance is `max(spacing1, spacing3 - upper.depth)`; lower clearance
is `max(spacing2, spacing4 - lower.height)`. Each supplied limit, even an
empty one, adds the native outer `spacing5` kern. Stacked limits do not get
the 0.5pt side-script space. Painting follows TeX's vertical-list order:
upper limit, nucleus, lower limit. No source-specific coordinate adjustment
or reference-image substitution was added.

## Commands and Parameters

| Area | Implemented or verified | Remaining boundary |
| --- | --- | --- |
| Declarations | `DeclareMathOperator`, `DeclareMathOperator*`, direct `operatorname`/`operatorname*`, argument expansion | Arbitrary TeX macro/category-code behavior remains partial. |
| Limits | Inline side scripts, display upper/lower limits, `_`, `^`, either/both/empty limits, `limits`, `nolimits`, last-modifier precedence | Explicit `displaylimits`, `nonamelimits` package options and general grouped/mathop nuclei remain partial. |
| Built-ins | Native `lim`, `min`, `max`; the existing contiguous-name route also handles `det`, `gcd`, `inf`, `sup` | Compound built-ins such as `liminf`/`projlim`, forced limits on ordinary built-ins and large symbols such as `sum`/`int` retain fallback. |
| Typography | Roman nuclei, CMR/CMBX, `scriptsize`, `Large`, `boldmath`, `displaystyle`, `scriptstyle`, `scriptscriptstyle`, `frac`, `in`, `to`, `infty`, thin math glue | Operator-body scripts/apostrophes and arbitrary font changes are not certified. |
| Figure controls | `documentclass` with standalone border, `usepackage{amsmath,tikz}`, `tikzpicture`, blue `draw` frame, `node`, `anchor=base west`, `inner sep=0pt`, explicit coordinates | The frame supplies one registration origin, never per-label adjustments or scale fitting. |

## Visual Evidence

The new fixtures are focused reproductions derived from the installed AMS
manual and its semantics, not claimed as recovered corpus diagrams. The
existing ordinary-operator fixture is reused unchanged as a regression control.

| Case | Before | After |
| --- | --- | --- |
| `operator-limits-modes` | Starred declarations lost their display behavior; explicit `nolimits` could still stack in the browser. SVG-text leaked literal operator syntax and mispositioned scripts. | Declared `Lim`/`arg min` now center their lower limits; forced/side scripts switch correctly. Wide and empty limits retain native box dimensions. All 109 glyph origins pass, maximum error 0.020345px at 3x. |
| `operator-limits-sizes` | Exported operators degraded into literal text; bold and small-size boxes had wrong script positioning. | Small, large, bold and nested-fraction limits use optical CM fonts and native spacing. All 43 origins pass, maximum error 0.007281px at 3x. |
| `operator-names-control` | Already accepted ordinary-operator control. | All 95 origins still pass, maximum error 0.020691px at 3x; no ordinary-name regression. |

Default browser conversion and SVG-text were actually rendered with embedded
MacTeX fonts loaded before capture. Their sheets, the independent native PNGs,
and diff panels were visually inspected. The isolated Chromium audit uses a
blank page plus `setContent`, not the previously denied in-app file navigation.

The native SVG contains font outline paths and positioned `use` elements in a
physical-pt viewBox. Its stacked upper-limit glyphs precede the nucleus. JS
now preserves that paint order as well as positions; no reference-order map,
threshold increase, glyph omission or per-glyph translation was used.

`command -v tikztosvg` found **`/Library/TeX/texbin/tikztosvg`**, version 0.3.0.
All three references used local pdfTeX, then `rsvg-convert`. Independent MacTeX
PDFs were rasterized with `pdftocairo`. No online install was used. The existing
wrapper's classical-arrow-default restoration remains recorded in provenance.

## Artifacts and Tests

Before: `outputs/qa/2026-10-29-operator-limits-before/`.
After: `outputs/qa/2026-10-29-operator-limits-after/`.

- `browser-audit.html`, `browser-audit.json`, `browser/`: default JS,
  tikztosvg, SVG-text, historical before and browser diff.
- `tikzkit-svg/`, `tikzkit-png/`, `tikztosvg-svg/`, `tikztosvg-png/`:
  independently produced SVGs and rasterizations.
- `mactex-png/`, `mactex-log/`, `native-operator-limits-metrics.log`:
  independent PDF/image and hbox evidence.
- `diff/summary.json`, `diff/*-native-sheet.png`, `diff-png/`: raster gates.
- `operator-limits-before-tests.json`: 27 of the first 30 new tests failed
  before implementation. `operator-limits-order-before.json` records the
  subsequently discovered vertical-list paint-order failure.
- `operator-limits-focused-final.json`: 274 related tests pass.
- `operator-limits-full-final.json`: 3218 pass, 0 fail, 14 unchanged skips.

```sh
pdflatex -interaction=nonstopmode -halt-on-error -output-directory=/tmp test/fixtures/native-operator-limits-metrics.tex
node --test test/native-operator-limits.test.js test/native-operators.test.js
node --test --test-reporter=./scripts/module-test-reporter.js --test-reporter-destination=/tmp/operator-limits-full-final.json test/*.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/operator-limits --output outputs/qa/2026-10-29-operator-limits-after --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --no-comparison-grid
node scripts/audit-module-regressions.js --fixtures test/fixtures/operator-limits --output outputs/qa/2026-10-29-operator-limits-after --before outputs/qa/2026-10-29-operator-limits-before --browser-module "${PLAYWRIGHT_MODULE:?set this to the local Playwright index.mjs}"
node scripts/diff-example-pngs.js --output outputs/qa/2026-10-29-operator-limits-after --register
node --experimental-vm-modules scripts/check-architecture.js
node scripts/check-doc-links.js
git diff --check
```

Implementation: `src/frontend/latex-shell.js`, `src/tex/mathBox.js`.
Metadata: `src/packages/amsmath.js`, registry CSV/MD and this worklog.
Tests: `test/native-operator-limits.test.js`, `test/native-operators.test.js`,
the native probe and `test/fixtures/operator-limits/`.
The former fallback assertion now verifies native named-limit placement;
large-symbol and general-mathop fallback assertions remain in place.

## Remaining Acceptance

All three SVG PNG pairs pass without registration shifts: 68 changed pixels
for modes, 20 for sizes and 29 for the ordinary control. Existing limits remain
pixel tolerance 6, changed ratio 0.005 and mean absolute RGBA difference 0.001.
The browser gate remains 0.09px at 3x; diagnostics and browser errors are zero.

Independent PDF raster acceptance still fails: modes JS/native differs by
4.2511%, compared with tikztosvg/native at 4.2584%; sizes differ by 3.9720%
and 3.9834% respectively. Thin strokes and glyph-edge rasterization differ
between the two native backends as well. This is evidence of a raster/backend
contribution, not permission to mark the residual harmless or waive the gate.

Next separate TODOs remain PGF scaled-point arithmetic near half boundaries
and edge-extension scope controls. Within math, compound operator definitions,
explicit `displaylimits` and package policies should precede a general
large-symbol implementation. The package status stays **partial**.
