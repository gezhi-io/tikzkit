# Scoped clips, PGF operators, path text and workbench state

The original review covered six findings and an adjacent crash in path
text. The [source fixtures](../../test/fixtures/scoped-render-parity/manifest.json)
include those seven cases and three follow-up controls. Each source runs
unchanged in the workbench, local tikztosvg and native MacTeX.

| Finding | Before | Observed after |
| --- | --- | --- |
| Ordinary clipping | A red fill covered the frame outside a 1 cm square. | Both `\clip` and `\path[clip]` constrain later paint. The native manual's overlapping circles leave only the lens; a translated even-odd ring keeps its hole, two colors, and unclipped sibling. |
| PGF power and logic | The three colored strokes measured 4, 5 and 3 cm. | `(2^3^2)/128`, `0\|\|5` and `2&&3` measure 0.5, 1 and 1 cm, as in MacTeX. PGF caret chains associate to the left. The basic parser and PGFPlots FPU produce numeric booleans; external-style plot functions keep separate binding rules. |
| Text exceeding a short path | Ten extra letters overprinted the last glyph. | Only `ABCD` of `ABCDEFGHIJKLMN` are emitted on a 1 cm path. The last box may overhang: PGF tests the advance to the next **center**, not the ink's right edge. |
| Typewriter path text | The typewriter row was almost as short as the roman control. | Successive origins of `i` are 5.230 SVG pt (bp) apart in the typewriter run and 2.767 bp in roman. Both match tikztosvg. PGF's trailing format reset outputs the previous character box once more: 13 glyphs versus 12 in the control. |
| Editing during rendering | A result for a previous source could be marked current and exported. | A late response cannot replace the current draft or enable stale SVG exports; a fresh render can be downloaded and contains the edited path. |
| Case URLs and navigation | Changing the fragment could leave the old example displayed. | Direct links, the selector, immediate fragment changes, and browser Back/Forward select the correct fixture and restore its independent draft. |
| Grouped math at the start of path text | `text={{$x$}B}` threw before returning an SVG: the scanner popped a glyph for a brace that had already been discarded. | A leading formula or two consecutive formulas each produce one math box, without losing their neighboring text. |

## Release controls (2026-11-25)

- [Floating plot samples](../../test/fixtures/scoped-render-parity/plot-rounding.tex):
  a blue line stays at 2, and a red line with an intermediate value above
  20,000 remains visible. TikZ's `plot function` delegates to gnuplot;
  ordinary PGF arithmetic still uses scaled points. The fixture supplies
  PGF's two-point tables using independent LaTeX floating-point calculations
  so the native reference does not require an installed gnuplot.
- [Background clipping](../../test/fixtures/scoped-render-parity/background-clip.tex):
  switching output layers starts a separate clip. The orange disk is clipped
  on the background layer; the red and blue foreground bars keep their
  original rectangular clip. See `pgfcorelayers.code.tex` and
  `tikzlibrarybackgrounds.code.tex`.
- [Foreground order](../../test/fixtures/scoped-render-parity/foreground-order.tex):
  swapping a thick edge and an angle pic changes which color covers their
  crossing. In `tikz.code.tex` the parent postaction precedes the foreground
  box, which keeps its contents in source order.

The release checkout passed 3,643 tests with the optional native operator
probe enabled (14 skipped). Six separate Chrome editing/navigation tests
also passed. The ten fixtures above and the
[three boxed-axis controls](../../test/fixtures/pgfplots-box-paint/manifest.json)
rendered in the workbench, export, tikztosvg and MacTeX.
At fixed physical scale, 20 of 26 browser/export comparisons met the 0.95
ink threshold. All three new controls passed in both modes. The original
`initial-math-box` and `short-text` controls still differ in text
rasterization; `manual-circle-lens` has a different standalone margin.
Their scores were unchanged by the follow-up fixes.

## Native references

- PGF/TikZ: `tikz.code.tex` (path action order), `pgfcorepathusage.code.tex`
  (clipping and picture-size tracking), `pgfsys-common-svg.def` (nested clipping),
  and the circle example in `pgfmanual-en-tikz-actions.tex`. Subsequent clips
  intersect; adding subpaths to one SVG clipping region is not a substitute.
- Operators: `pgfmathparser.code.tex`, `pgfmathfunctions.basic.code.tex` and
  `pgfmathfunctions.comparison.code.tex` in TeX Live 2025, PGF 3.1.11a.
  These establish power/sign binding and dimension-based boolean comparisons.
  The restricted evaluator intentionally retains short-circuit evaluation.
- Text: `pgflibrarydecorations.text.code.tex` (prewidth, typeset, afterwidth),
  `pgfmoduledecorations.code.tex` (distance remaining), the TikZ text-effects
  library and `ot1cmtt.fd` (typewriter design sizes). No font downloads.

## Visual verification

The workbench was opened in Google Chrome, each fixture selected and rendered
by its real browser JS module, with the comparison grid off. Its resulting SVG
was captured at the same physical scale as the output of
`/Library/TeX/texbin/tikztosvg`. We also inspected independent PDF-to-PNG
renders from native `pdflatex`. No fixture diagnostics or browser errors.

At 3x Chrome screenshot scale the live and tikztosvg paint extents matched:
the red square interior was 111 by 111 px, the lens 114 by 196 px, and each
colored half of the nested ring 113 by 227 px. The three arithmetic strokes
were 57, 114 and 113 px wide in both. These measurements do not certify
identical pixels. In particular, the workbench omits the standalone document
margin; raw crop differences also show the browser font versus native outline
rasterization. Exact distances on arbitrary curved text paths are not covered.

## Reproduce

From the project root, export `PLAYWRIGHT_MODULE` pointing to a local Playwright
`index.mjs`. The browser checks use installed Google Chrome.

```sh
fixtures=test/fixtures/scoped-render-parity
out=outputs/qa/2026-11-18-project-review-fixed/comparison
node scripts/render-example-fixtures.js --fixtures "$fixtures" --output "$out" \
  --tikztosvg-engine pdflatex --math-renderer svg-text --native-reference --no-comparison-grid
node scripts/audit-module-regressions.js --fixtures "$fixtures" --output "$out" \
  --workbench --browser-module "$PLAYWRIGHT_MODULE"
PGF_MATH_PDFLATEX="$(command -v pdflatex)" node --test test/pgf-operator-precedence.test.js
node --test test/scoped-clipping.test.js test/decoration-text-advances.test.js
WORKBENCH_QA_DIR=outputs/qa/workbench-check node --test test/web-workbench-races.browser.js
npm run test:summary
```

`browser-audit.html` in the output directory shows live JS, tikztosvg, an
independent export and a link to each native PNG. Add `--before <saved output>`
to the browser audit to include an earlier rendering. The separate workbench
test records six interactive scenarios, including deliberately reordered
network responses, and checks the contents of the actual downloaded SVG.
