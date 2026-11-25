# Native Operators and Edge-Local Paint

## Scope and Status

This follows the two concrete TODOs in
[native signed math and angle painting](2026-10-28-native-math-angles.md):
operator-name typography and inline-edge paint leaking into the parent path.
It is not a full amsmath or TikZ-state implementation. No release, version
change or remote push was performed.

The two bounded repairs have visible browser improvements. All five
JS/tikztosvg PNG pairs pass the existing gate, with zero diagnostics.
The full explicit collection is **3187 passed, 0 failed, 14 existing skips**.
Twenty-nine regressions were added. **Independent native-PDF whole-image
acceptance remains open**, separately from the passing SVG/browser checks.

## Local Sources

Source paths below are relative to `/usr/local/texlive/2025/texmf-dist/`.

| File | Implementation rule |
| --- | --- |
| `tex/latex/amsmath/amsopn.sty`, lines 28-110 | `qopname` constructs a math operator with a zero kern and the operators font. The nucleus is a box, even for one letter; ordinary operators use side scripts. `newmcodes@` makes hyphen/star/slash literal OT1 characters, colon OT1 punctuation, and period CMMI punctuation. |
| `tex/latex/base/fontmath.ltx` | The operators family is OT1 Computer Modern Roman, with CMBX for bold math. Math size selects the original optical font rather than scaling a browser fallback indiscriminately. |
| `fonts/tfm/public/cm/` and the existing imported metrics | CMR pair kerns and ligatures drive `Var`, `diff` and `fi`. The math lig/kern pass replaces the preceding italic correction with the pair kern; a lone `f` still retains its italic correction. Independent native boxes distinguish these cases. |
| `tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`, lines 2960-3085 | `edge` starts a group, interrupts the current path and paints its own path inside a graphics scope. Its local pen/decoration settings do not change the enclosing path. `to` deliberately differs. |

The independent pdfTeX probe is
[`native-operator-metrics.tex`](../../test/fixtures/native-operator-metrics.tex).
Eighteen measured width/height/depth triples are asserted at 0.001 TeX pt.
For example, `\operatorname{Var}(X)` is 32.43059pt wide, and
`\operatorname{a-b*c:d/e.f}x` is 58.43748pt wide. These expected values come
from the native hboxes, not from the JS implementation.

## Commands and Parameters

| Area | Implemented or checked | Remaining boundary |
| --- | --- | --- |
| Names | `\operatorname`, ordinary `\DeclareMathOperator`, built-in `\sin`, roman operator atoms and their thin math glue | Starred `\DeclareMathOperator` still loses its star in the frontend and needs a separate fix. |
| Scripts and sizes | `_`, `^`, paired side scripts, `\scriptstyle`, 7/10/14.4pt controls, bold math, operators inside `\frac` | Stacked limits keep whole-formula fallback; native operator-body scripts and apostrophes are not certified. |
| Punctuation | Math minus outside an operator, literal hyphen/star/slash inside, comma spacing, colon/period math classes, `\,`, adjacent OT1 ligatures | Arbitrary TeX macro/category-code changes and font changes inside operator names remain partial. |
| Edges | Ordinary `edge[...]` color, width, opacity, dash, arrows, `draw=none`, bend and decoration isolation; subsequent edges recover parent style | Specialized extension branches, edge-label style inheritance and general arbitrary local state are not certified by this slice. |
| Parent paths | `\draw`, invisible `\path`, subsequent `--`, and retained `to[...]` behavior | This is not a redesign of all path painting or custom `to path` execution. |

## Visual Evidence

The cases are selected for these two failures and their controls, not as a
fixed-size random gallery sample. Before artifacts were retained unchanged.
The punctuation control was added during investigation, so it has no claimed
before screenshot.

| Case | Before | After |
| --- | --- | --- |
| `native-numeric-semantics` | The previously corrected points were in place, but labels used heavier fallback text, hyphens and compressed punctuation. | Native CMR/CMSY/CMMI glyphs restore the function names, true minus and comma glue. Points, axes and grid are unchanged. The JS/reference PNG discrepancy drops from the prior report's 877 pixels to 25. |
| `operator-names` | Operator scripts exposed flattened `operatorname` text; `a rank A` and `arg min x` lost glue, and fraction/operator fonts differed. | Roman nuclei, optical sizes, bold faces, side scripts and the fraction share native layout in default browser and SVG-text export. All 95 glyph origins pass; maximum error is 0.020691px at 3x. |
| `operator-punctuation` | New focused control, no historical image claimed. | `diff`/`fi` use native ligatures; literal punctuation, `Re` and its subscript match native hboxes. All 27 glyph origins pass; maximum error is 0.041132px at 3x. |
| `edge-style-scope` | Red/dashed edges changed black horizontal paths; a later green edge inherited dots; invisible paths gained strokes; arrow settings escaped onto horizontal lines. | Parent paths remain black and retain their pen. Hidden strokes stay hidden, and only the requested blue edge has an arrow. Native stroke count is restored from 13 to 12; all 12 pass geometry and paint checks, maximum sampled error 0.012895px at 3x. |
| `angles-parallel-paragraph` | Existing real-diagram control from the preceding fix. | Seven open strokes, four angle fills/labels and the three-line paragraph stay intact. Its stroke gate remains at 0.028132px maximum error. |

Default browser conversion and SVG-text export were both actually rendered,
with packaged MacTeX fonts loaded before screenshots. The authorized isolated
Chromium runner uses a blank page and `setContent`; it does not navigate the
denied in-app `file://` URL. Browser sheets, native/JS/tikztosvg sheets and
diff panels were visually inspected, not just their scores.

No visual threshold was increased: glyph origins retain 0.09px at 3x;
sampled open strokes retain 0.12px at 3x, with color, dash, cap/join, width,
count and canvas checks. PNG limits remain pixel tolerance 6, changed ratio
0.005 and mean absolute RGBA difference 0.001.

## Reference Structure

`command -v tikztosvg` found `/Library/TeX/texbin/tikztosvg` (0.3.0).
All five sources were compiled through this command using local `pdflatex`,
then rasterized with `rsvg-convert`. MacTeX also compiled independent PDFs,
rasterized with `pdftocairo`. No online install or reference substitution was
used. The existing wrapper restores the source's classical default arrow
after tikztosvg injects `tikz-cd`; that transformation remains recorded.

The native SVGs use path-glyph definitions and positioned `<use>` elements,
not `foreignObject` or browser font-size guesses. They provide physical pt
viewBoxes and independent glyph origins. The edge SVG has separate paths,
native dash arrays, butt caps/miter joins and explicit arrowhead paths.
JS preserves its own scene/renderer and uses actual MacTeX font outlines and
metrics; it does not display the reference SVG as its output.

## Artifacts and Verification

Before: `outputs/qa/2026-10-28-operator-edge-before/`.
After: `outputs/qa/2026-10-28-operator-edge-after/`.

- `browser-audit.html`, `browser-audit.json`, `browser/`: default JS,
  tikztosvg, SVG-text, historical before and diff panels.
- `tikzkit-svg/`, `tikzkit-png/`, `tikztosvg-svg/`, `tikztosvg-png/`:
  both independently produced SVG/PNG outputs.
- `mactex-png/`, `mactex-log/`, `native-operator-metrics.log`: native evidence.
- `diff/summary.json`, `diff/*-native-sheet.png`, `diff-png/`: raster results.
- `operator-edge-before-tests.json`, `operator-ligatures-before.json`:
  fail-first evidence; the first 26 tests had 24 failures, and the later
  ligature additions also failed before their implementation.
- `operator-edge-focused-final.json`: 251 related tests pass.
- `operator-edge-full-final.json`: 3187 pass, 0 fail, 14 unchanged skips.

```sh
pdflatex -interaction=nonstopmode -halt-on-error -output-directory=/tmp test/fixtures/native-operator-metrics.tex
node --test test/native-operators.test.js test/edge-style-scope.test.js test/renderer.test.js test/math-box.test.js test/math-structures.test.js test/math-alignments.test.js test/native-math-hat.test.js
node --test --test-reporter=./scripts/module-test-reporter.js --test-reporter-destination=/tmp/operator-edge-full-final.json test/*.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/operator-edge --output outputs/qa/2026-10-28-operator-edge-after --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --no-comparison-grid
node scripts/audit-module-regressions.js --fixtures test/fixtures/operator-edge --output outputs/qa/2026-10-28-operator-edge-after --before outputs/qa/2026-10-28-operator-edge-before --browser-module "${PLAYWRIGHT_MODULE:?set this to the local Playwright index.mjs}"
node scripts/diff-example-pngs.js --output outputs/qa/2026-10-28-operator-edge-after --register
node --experimental-vm-modules scripts/check-architecture.js
node scripts/check-doc-links.js
git diff --check
```

Implementation files: `src/tex/mathBox.js`, `src/engine/evaluate.js`.
Metadata: `src/packages/amsmath.js`, `src/packages/tikz.js`, registry CSV/MD.
Tests: `test/native-operators.test.js`, `test/edge-style-scope.test.js`,
the native probe and `test/fixtures/operator-edge/`.
One existing renderer assertion now checks actual native CMR glyphs and the
7pt subscript's 1.49998pt baseline instead of requiring obsolete serialized
`baseline-shift` text. It was replaced with stronger native semantics, not
deleted to hide a failure. The previous turn's numeric/angle edits remain
separately documented.

## Open Work

All five JS/tikztosvg PNG comparisons pass without translation or scaling
adjustments. Their changed-pixel counts are 25 (numeric), 29 (operator names),
14 (punctuation), 16 (edges) and 186 (angle/paragraph control).

The independent PDF pixel gate still blocks whole-image acceptance. For
example, the operator-name JS/native ratio is 6.6964%, while
tikztosvg/native is 6.7020%; the edge ratios are 2.6088% and 2.5703%.
Thin strokes and font-outline rasterization differ even between the two
native output paths. The similarities suggest a backend-raster contribution,
but do not prove every residual is harmless. These gates remain failed;
this report does not claim pixel-identical MacTeX output.

The starred-declaration and named-display-limit TODO is addressed by the
[2026-10-29 follow-up](2026-10-29-native-operator-limits.md). Large-symbol limits
and the independent native-PDF pixel gate remain open. Next bounded items are
PGF scaled-point math near half boundaries and specialized edge extensions'
state-scope controls.
