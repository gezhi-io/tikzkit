# PGF Plotmarks Halfcircle QA (2026-08-08)

## Scope

This slice implements the documented `plotmarks` variants `mark=halfcircle`
and `mark=halfcircle*`. The explicit boundary is their fill, outline,
`mark color`, `mark size`, and `mark options={rotate=...}` behavior. It does
not claim the full PGF plot-mark catalog or arbitrary mark-option transforms.

The real gallery driver is
`test/fixtures/examples/latex-examples/csv-line-plot-two-axes.tex`: its
overlaid right axis uses `mark=halfcircle` for the orange table plot. The
dedicated visual regression fixture is
`test/fixtures/examples/plotmarks/halfcircle-variants.tex`.

## Local PGF Review

Reviewed MacTeX sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryplotmarks.code.tex`, lines 291-325;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryplotmarks.code.tex`.

The source gives `/pgf/mark color` a white default. `halfcircle` fills the
lower semicircle from 180 to 360 degrees unless `mark color=none`, then
strokes both the horizontal diameter and outer circle. `halfcircle*` fills
the upper semicircle with the active plot fill and its lower semicircle with
the mark color, then strokes only the outer circle. This is deliberately
different from `halfcircle`: the starred mark has no divider. The source note
also documents rotation through `mark options={rotate=90}`.

## Source Inventory

| Source construct | Result |
| --- | --- |
| `\\usetikzlibrary{plotmarks}` | Registered as a separate TikZ library module. |
| `mark=halfcircle` | Implemented in PGFPlots and direct `plot[...]` lowering. |
| `mark=halfcircle*` | Implemented in both paths; no divider is emitted. |
| `mark size=10pt` | Shared physical mark-radius conversion is used. |
| `mark color=orange` | Fills only the lower semicircle. |
| default `mark color` | Uses white, matching `\\pgf@set@mark@color`. |
| `mark color=none` | Suppresses only the lower fill while retaining the outline. |
| `mark options={rotate=90}` | Rotates fill geometry and the unstarred divider. |
| `mark=x`, `+`, `*`, `o`, square, triangle subset | Pre-existing shared support remains covered. |

Still partial: the remaining standard PGF mark declarations (for example
halfdiamond variants, asterisk variants, custom declared marks), arbitrary
affine `mark options`, and TeX callback-based mark declarations.

`npm run case:audit -- test/fixtures/examples/plotmarks/halfcircle-variants.tex`
also inventories this driver as one package, one library, six commands,
28 option occurrences, 19 numeric values, and no unmapped blockers. Its
whole-case status remains `incomplete` because this focused marker change does
not pretend to accept every general PGFPlots axis option; the table above is
the explicit acceptance boundary for this slice.

## Three-way Visual QA

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. The inspected artifacts are ignored by Git:

`/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-plotmarks-halfcircle-after-2026-08-08/`

It contains native MacTeX PNG, TikZKit SVG/PNG, tikztosvg SVG/PNG, 1cm grid
panels, registered diff images, and four-panel sheets for both fixtures.

The tikztosvg SVG expresses the marks as separate filled semicircle paths,
followed by a no-fill outer stroke path. Its default lower half is
`fill="rgb(100%,100%,100%)"`; the explicit orange half is
`fill="rgb(100%,50%,0%)"`. The rotated starred mark is two purple/green
semicircle paths plus a circle-only outline, confirming both the rotation and
the absence of a divider. TikZKit now emits the same layering: individual
non-stroked fill paths followed by the source-required stroke path.

## Visual Result

Before this slice, the real PGFPlots `halfcircle` path had only an outline and
diameter, so its lower half was transparent instead of white. A direct TikZ
`plot[mark=halfcircle]` fell through to the generic marker path. `halfcircle*`
also used the wrong fill/divider behavior.

After the change, the inspected native sheet shows the three distinguishing
states in TikZKit, tikztosvg, and MacTeX:

- the blue default mark has a white lower half and a horizontal divider;
- the red mark has an orange lower half and a horizontal divider;
- the purple/green starred mark is rotated 90 degrees, has two filled halves,
  and has no divider.
- the cyan `mark color=none` mark retains its outline and divider with no
  lower-fill SVG layer; that branch is asserted separately because the native
  white page background intentionally makes a transparent lower half invisible.

The real CSV driver preserves all four table plots and the overlaid right
axis, with the orange series now using the source-defined filled halfcircle.
The focused fixture is 401x117px for TikZKit versus 402x117px for tikztosvg;
the residual diff is axes/text rasterization rather than missing marker paint.
Numbers are supplementary: the sheet and grid panels were visually reviewed.

## Verification

```bash
node --test test/pgfplots-csv-overlay.test.js

node --test --test-name-pattern='halfcircle|PGF halfcircle' \
  test/pgfplots-csv-overlay.test.js test/interpreter.test.js

npm run examples:render -- --fixtures test/fixtures/examples \
  --only plotmarks-halfcircle-variants,latex-examples-csv-line-plot-two-axes \
  --output outputs/qa-plotmarks-halfcircle-after-2026-08-08 \
  --tikztosvg --native-reference --grid --strict-tikztosvg \
  --external-timeout-ms 120000

npm run examples:diff -- --output outputs/qa-plotmarks-halfcircle-after-2026-08-08 \
  --register --alignment-radius 3
```

All 31 PGFPlots CSV/overlay tests pass. The focused visual render completed
for both fixtures with zero TikZKit diagnostics and with all MacTeX,
TikZKit, tikztosvg, grid, sheet, and diff artifacts present.

## Files Changed

- `src/pgfplots/marks.js`
- `src/engine/evaluate.js`
- `src/tikz/libraries/plotmarks.js`
- `test/pgfplots-csv-overlay.test.js`
- `test/interpreter.test.js`
- `test/fixtures/examples/plotmarks/halfcircle-variants.tex`
- `test/fixtures/examples/manifest.json`
- `docs/extension-registry.csv`
- `docs/extension-registry.md`
