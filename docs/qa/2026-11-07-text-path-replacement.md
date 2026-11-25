# Text Decoration Path Replacement

## Scope and Status

This follows the visible extra line in the epochs/overfitting control from
[the box-paint audit](2026-10-29-pgfplots-box-paint.md). The registry lists 18
active `decorations.text` examples. This slice addresses **direct text-path
replacement, independent edge options, postaction paint order, and native
text color reset**. It does not claim complete text-decoration compatibility.

The full explicit suite reports **3441 passed, 0 failed, 14 unchanged skips**
out of 3455 tests. Seven cases have freshly generated MacTeX PNG, tikztosvg
SVG/PNG, JS SVG/PNG, and actual Chrome comparisons, with zero diagnostics or
browser errors. Four focused stroke-geometry gates and four JS/tikztosvg PNG
pairs pass unchanged tolerances. **Whole-image acceptance remains incomplete**:
three SVG PNG pairs still differ, and all seven independent PDF raster gates
remain blocked. No threshold was relaxed. No commit, push or npm release was
performed in this step.

## Local Source Review

Paths below are relative to `/usr/local/texlive/2025/texmf-dist/`.

| Source | Implementation rule |
| --- | --- |
| `tex/generic/pgf/libraries/decorations/pgflibrarydecorations.text.code.tex` | The ordinary text automaton emits character boxes as side effects; its final state leaves no stroke/fill path. `pgf@lib@dec@text@dobox` resets each box to decoration text color, black by default, before applying inline formatting. |
| `tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.text.code.tex` | Text-effects pre/token/post states place ordinary TikZ nodes; their current/text-color inheritance differs from ordinary character boxes. |
| `tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.code.tex` | Decoration saves and clears the input path. Pre/post meta-segments default to zero length; nonzero segments require separate handling. |
| `tex/generic/pgf/frontendlayer/tikz/tikz.code.tex` | Finish applies decoration before paint; postactions replay the saved main path afterwards. `tikz@rectB` travels up/down the vertical side first, which affects decorated text direction. |
| `tex/generic/pgf/modules/pgfmoduledecorations.code.tex` and `tex/generic/pgf/basiclayer/pgfcorepathconstruct.code.tex` | Rectangle decoding and low-level path construction must be distinguished from the frontend rectangle traversal. |
| `doc/generic/pgf/pgfmanual-en-library-decorations.tex` | Ordinary text replaces its path; the manual documents character boxes, baseline placement, raise and postaction usage. |

The registry's local source and manual entry points were read, not just the
rendered reference. No library, font or tool was downloaded.

## Implementation and Regression Tests

- `src/tikz/decorations/path.js` consumes direct text-decoration geometry
  instead of returning the original stroke/fill. `decorate=false` remains
  inactive, including a string-valued false.
- `src/engine/evaluate.js` retains the original geometry for text placement,
  keeps edge-local options with each independent edge, emits postaction text
  after main-path paint, and uses the native vertical-first rectangle order.
  Empty direct text still consumes the path. Ordinary inline nodes survive.
- The evaluator resets ordinary decoration text to black or `text color`,
  then applies inline colors. Text-effects nodes retain inheritance.
- `src/tikz/libraries/decorations.text.js` owns the shared kind predicate and
  records the supported/partial boundary with the source references.

`test/decorations-text-path-replacement.test.js` adds 16 regressions. The first
14-test run failed 13 tests before implementation; subsequent rectangle and
color probes also exposed the old behavior. Coverage includes lines, cubic
curves, circles, rectangles, both text variants, empty text, postactions,
independent edges, inline nodes and the real overfitting annotation.

Six existing rectangle-order expectations were migrated to native `rectB`
traversal in `example-fixtures`, `interpreter`, `petarv-compat` and
`walmes-compat` tests. The corners and dimensions did not change; the ordered
path did. The old ordinary-color expectation was corrected using the local
character-box implementation and a native color fixture. These expectation
changes are not counted as extra runtime defects fixed. No assertions were
deleted and no numeric tolerances were widened.

## Command and Parameter Audit

| Family | Checked behavior | Remaining boundary |
| --- | --- | --- |
| Setup | `tikz`, `xcolor`, `decorations.text`, `tikzpicture`, `standalone[border=2pt]`; existing real case also loads `pgfplots`, `positioning`, `decorations.pathmorphing` | Loading a library does not imply every option is implemented. |
| Paths | `draw`, `filldraw`, `path`, `--`, `.. controls ..`, `rectangle`, `circle`, independent `edge`, inline `node` | General preaction semantics and specialized empty-path arrows are not completed. |
| Activation | `decorate`, `decorate=false`, `decoration`, empty `text`, `text along path`, `text effects along path` | Nonzero `pre length`/`post length` and custom meta-decorations are outside this slice. |
| Layout | `text align={center}`, `raise=2pt`, postaction inheritance and explicit postaction decoration, `characters={text along path}` | Exact curve-length arithmetic and painted text bounding boxes remain partial. |
| Paint | Named/mixed colors, `text=blue`, `text color`, inline `\color`, `||` reset, `very thick`, fills | Browser text weight/rasterization still differs from outlined reference glyphs. |
| Existing controls | `foreach`, `arc`, `repeat text`, `character count`, `character total`, per-character `scale`; help-line grid and format switching | Spiral outer glyphs are still clipped; format-control curve placement retains a strict raster difference. |
| Real plot | Four `addplot` functions with domains `2:50`, `4:50`, `50:100`; `samples=200`; named styles; HTML colors; `axis cs`; middle axes; `14cm`/`8cm`; limits `0:104` and `0:.98`; major dashed grid; white background; labels; explicit y-label position; outside ticks; `minor tick num=-3`; `tension=.08`; two legend entries | Existing plot behavior is exercised, not newly certified. Legend spacing/frame, tick/grid and text differences remain. |
| Real annotation | Text from `(axis cs:51,.16)` to `(axis cs:90,.16)`; separate `latex[scale=3.0]` arrow at `.15`; dashed marker at `x=50` | The annotation path is consumed without changing its coordinates or the separate arrow. No case-specific coordinate patch. |

## Local References and SVG Structure

`command -v tikztosvg` found **`/Library/TeX/texbin/tikztosvg`**, version 0.3.0.
References use local pdflatex; `/opt/homebrew/bin/rsvg-convert` converts SVG
to PNG. Independent MacTeX PDFs are rasterized separately with pdftocairo.
The existing wrapper restores the source's classical `to` defaults after
tikztosvg's extra tikz-cd loading; provenance records that transformation.

The replacement reference has viewBox `0 0 174.462 126.273`, matching its
point-sized canvas. Only its blue frame is stroked: width `.3985`, butt caps,
miter joins, and `matrix(1,0,0,-1,16.365,101.404)`. There are no original red
lines or filled rectangle. Glyphs are outlined definitions referenced by
`use`, not SVG text or foreignObject. Ordinary glyph groups are black;
text-effects `ABC` is red. The color probe additionally verifies explicit
green, inline orange overriding the decoration color, and inherited blue.
TikZKit uses the bundled MacTeX-derived fonts; Chrome waits for font loading.

An exploratory `->` probe showed native degenerate arrow paint at the start
of an empty decorated path. It was excluded from the no-stroke fixture and
is explicitly unsupported here, rather than asserting native removes it.

## Visual Inspection

All seven final Chrome sheets and all seven independent native/JS/tikztosvg
sheets were opened. Chrome compares default JS, local tikztosvg, exported
SVG-text, before (where available), and a diff at the same physical scale.
The color fixture was added after baseline capture and has no before panel.

| Case | Before / after and remaining observation | JS/tikztosvg PNG |
| --- | --- | --- |
| `text-path-overfitting` | The extra horizontal stroke above the arrow disappears; the text and separate arrow remain. Legend rows/frame and tick/grid/text raster differences remain. | Different |
| `text-path-replacement` | Red line/curve strokes and a red rectangle that obscured text disappear. Rectangle text now turns along the vertical side. Ordinary text becomes black; effects text remains red. | Pass |
| `text-path-postaction` | Gray lines remain, with text painted afterwards. Ordinary text is black instead of gray; effects text remains gray. | Pass |
| `text-path-edges` | Removes the unwanted vertical copy of parent text, restores missing edge text, removes its underlying edge, and preserves the red/green edges plus black parent line. | Pass |
| `text-path-colors` | Native black/green/orange/blue sequence is visible in both browser modes. | Pass |
| `text-path-format-control` | Inline green/reset formatting survives. Existing glyph/curve-position residuals remain; the source starts with text overhanging the left crop. | Different |
| `text-path-repeat-control` | Repeated/scaled spiral text remains, but its canvas is too small and clips outer glyphs. This already exists in the before capture and is not accepted. | Dimension mismatch |

The four stroke gates pass in both browser modes. Their maximum directed
path error is **0.01475 CSS px at 3x**, against the unchanged 0.12px gate.
The direct replacement control goes from five painted strokes to the one
native frame; the edge control goes from six to four. The old postaction
directed-path distance includes reversed rectangle traversal and must not be
described as a 639px displaced frame.

Chrome still paints text more heavily than the reference's outlined glyphs;
passing stroke gates do not certify glyph outlines. The independent PDF PNGs
also show edge/raster differences against tikztosvg itself. All strict PDF
failures remain recorded rather than being waived as harmless noise.

## Reproduction and Artifacts

New fixtures: `test/fixtures/text-path-replacement/`. Three existing real/manual
sources are reused by relative manifest reference, without duplication.

Local artifact roots:

- `outputs/qa/2026-11-07-text-path-before/` (six cases).
- `outputs/qa/2026-11-07-text-path-after/` (intermediate path fix, before color correction).
- `outputs/qa/2026-11-07-text-path-final/` (seven final cases).

The final root contains `mactex-png/`, `tikztosvg-svg/`, `tikztosvg-png/`,
`tikzkit-svg/`, `tikzkit-png/`, `diff/`, `browser/`, `browser-audit.html` and
`browser-audit.json`. The page can be opened directly; no dev server is needed.
Generated files stay local and are not npm package contents.

```sh
node --test test/decorations-text-path-replacement.test.js test/edge-style-scope.test.js test/interpreter.test.js test/svg-renderer.test.js test/example-fixtures.test.js test/petarv-compat.test.js test/walmes-compat.test.js
node --test --test-reporter=./scripts/module-test-reporter.js --test-reporter-destination=/tmp/text-path-final-full.json test/*.test.js
node --experimental-vm-modules scripts/check-architecture.js
node scripts/check-doc-links.js
npm run gallery:audit
node scripts/render-example-fixtures.js --fixtures test/fixtures/text-path-replacement --output outputs/qa/2026-11-07-text-path-final --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --no-comparison-grid
node scripts/audit-module-regressions.js --fixtures test/fixtures/text-path-replacement --output outputs/qa/2026-11-07-text-path-final --before outputs/qa/2026-11-07-text-path-before --browser-module /absolute/path/to/playwright/index.mjs
node scripts/diff-example-pngs.js --output outputs/qa/2026-11-07-text-path-final --register
```

Focused tests: 566 passed, no failures/skips; the final 16-test regression
rerun also passes. The core gallery audit renders 660/660 with zero diagnostics
(this is not a 660-case visual certification). Documentation links and
`git diff --check` pass. Architecture: 489 modules, zero errors, one unchanged
`tikz/text.js -> frontend/latex-shell.js` debt.
The next priorities are text-decoration painted bounding boxes (spiral
clipping), curve glyph placement, and measured PGFPlots legend row spacing.
These need separate native measurements, not looser acceptance thresholds.
