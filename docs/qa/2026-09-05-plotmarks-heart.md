# PGF Plotmarks Heart QA (2026-09-05)

## Scope

This slice implements the source-defined `mark=heart` plot mark. The acceptance
boundary includes the exact eight-cubic geometry, the asymmetric source extent,
one fillstroke operation with independent fill and draw colors, `mark size`, and
whole-mark rotation in direct TikZ plots and PGFPlots.

It does not claim the complete `plotmarks` library. TeX Live 2025 declares
`heart` but no `heart*`, so this slice deliberately does not invent a starred
variant. Text marks, custom `\pgfdeclareplotmark` bodies, and general affine
mark-option transforms remain partial.

The permanent drivers cover three common domains:

- `plotmarks-heart-flowchart`: rotated heart checkpoints in a workflow;
- `plotmarks-heart-math`: heart samples in a PGFPlots scatter axis;
- `plotmarks-heart-physics`: rotated hearts on force-vector endpoints.

## Local MacTeX Review

Reviewed these local TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryplotmarks.code.tex`, lines 436-459;
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-plot-marks.tex`;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryplotmarks.code.tex`;
- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty`;
- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgfplots/pgfplots.sty` and
  `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`.

The generic PGF source starts the heart at `(0,-1.75s)`, where `s` is the mark
size. It uses exactly eight cubic segments. The side extrema are `x=+-s`, the
upper lobes use `y=0.5825s`, the lower shoulder controls use `y=-1.165s`, and
the lower tip controls use `y=-1.66s`. The path closes and is painted once with
`\pgfusepathqfillstroke`. TikZ applies `mark options` before invoking the PGF
declaration, so rotation transforms every control point around the plotted
coordinate. PGFPlots delegates to the same plot-mark declaration after mapping
the data coordinate into canvas space.

## Case Inventory

| Driver | Commands and environments verified | Options and numeric semantics verified |
| --- | --- | --- |
| Flowchart | `\documentclass`, `\usepackage`, `\usetikzlibrary`, `document`, `tikzpicture`, `\node`, `\draw`, `plot coordinates` | 3 libraries, named node styles, `right=of`, arrows, `mark=heart`, explicit fill/draw colors, 7pt size, 12-degree rotation, and workflow coordinates |
| Mathematics | `\documentclass`, `\usepackage{pgfplots}`, `\usetikzlibrary`, `\pgfplotsset`, `document`, `tikzpicture`, `axis`, `\addplot` | 10cm by 6cm axis, explicit ranges/ticks, middle axes, grid, labels, `only marks`, `mark=heart`, 8pt size, independent fill/draw colors, and 25-degree rotation |
| Physics | `\documentclass`, `\usepackage`, `\usetikzlibrary`, `document`, `tikzpicture`, `\draw`, inline nodes, `plot coordinates` | axes and force vectors, `Stealth`, dense guides, `mark=heart`, 8pt size, independent fill/draw colors, -20/70-degree rotation, and vector coordinates |

The strict semantic audits report, respectively, 1 package / 3 libraries / 7
commands / 18 options / 16 numbers, 1 / 1 / 7 / 30 / 18, and 1 / 2 / 7 / 12 /
21. All three accepted reviews have zero blockers, and all three TikZKit renders
have zero diagnostics.

## tikztosvg Structure

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. MacTeX used
`/Library/TeX/texbin/pdflatex`, and SVG-to-PNG conversion used
`/opt/homebrew/bin/rsvg-convert`.

The inspected tikztosvg SVG uses normal paths rather than SVG markers. Each
heart contains eight `C` commands, closes with nonzero fill, and carries PGF's
butt line caps and miter joins. Direct TikZ can serialize fill and stroke as
neighboring paths, while PGFPlots can retain a single fillstroke path. The
default outline is 0.3985pt. A page-level matrix inverts the SVG y axis, and
mark rotations are flattened into the emitted path coordinates rather than
kept as per-mark SVG transforms. The flowchart reference is 481.8pt by
27.727pt; TikZKit is 481.4pt by 27.73pt.

TikZKit now carries cubic control points through the shared plot-mark geometry,
transforms every start/control/end point for size and rotation, lowers the same
geometry through direct TikZ and PGFPlots, and preserves explicit fill separately
from the stroke color.

## Visual Result

Before the change, direct TikZ flowchart and physics hearts fell through to x
marks, while PGFPlots mathematical hearts fell through to circles. The lower
tip, paired upper lobes, asymmetric 1.75 vertical extent, rotation, and
independent fill/stroke colors were all absent.

After the change, all three inspected four-way sheets show the source-defined
heart silhouette: a sharp lower tip, smooth double lobes, exact asymmetric
height, and a single dark outline around the lighter fill. The 12, 25, -20, and
70-degree marks rotate as complete shapes and align closely with MacTeX and
tikztosvg. Remaining differences are principally text/axis rasterization and a
one-pixel crop edge.

As supplementary measurements, TikZKit versus tikztosvg mean absolute RGBA
improved from 0.030736 to 0.023181 for the flowchart, 0.008295 to 0.006540 for
mathematics, and 0.008457 to 0.005950 for physics. TikZKit versus MacTeX also
improved from 0.05246 to 0.04370, 0.01489 to 0.01297, and 0.01189 to 0.00917.
Acceptance was based on inspecting the shape, color layers, rotation, and
placement, not the numeric diff alone.

## Artifacts

Before:

`/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa/2026-09-05-plotmarks-heart-before/`

After:

`/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa/2026-09-05-plotmarks-heart-after/`

Each directory contains MacTeX PNG, TikZKit SVG/PNG, tikztosvg SVG/PNG, 1cm
grid variants, registered diffs, and native four-way sheets for all three
drivers.

## Verification

```bash
node --test --test-name-pattern='heart plot marks' test/interpreter.test.js test/pgfplots-csv-overlay.test.js

npm run case:audit -- test/fixtures/examples/plotmarks/heart-flowchart.tex --review test/fixtures/examples/plotmarks/heart-flowchart.review.json --strict
npm run case:audit -- test/fixtures/examples/plotmarks/heart-math.tex --review test/fixtures/examples/plotmarks/heart-math.review.json --strict
npm run case:audit -- test/fixtures/examples/plotmarks/heart-physics.tex --review test/fixtures/examples/plotmarks/heart-physics.review.json --strict

node scripts/render-example-fixtures.js \
  --output outputs/qa/2026-09-05-plotmarks-heart-after \
  --only plotmarks-heart-flowchart \
  --only plotmarks-heart-math \
  --only plotmarks-heart-physics \
  --continue-on-external-failure --strict-tikztosvg \
  --native-reference --native-latex-engine pdflatex \
  --tikztosvg-engine pdflatex --math-renderer svg-text

node scripts/diff-example-pngs.js \
  --output outputs/qa/2026-09-05-plotmarks-heart-after --register

npm test
```

The focused heart tests pass. All three visual drivers render in all three
engines with zero TikZKit diagnostics and zero external-render failures. The
full suite reports 2,216 tests: 2,075 pass, 127 fail, and 14 are skipped. This
is five fewer failures than the prior recorded 132-failure baseline, with two
new heart tests added. Representative remaining failures are existing broader
coverage gaps such as `circuitikz-varcap-diodes`, the Bellman-Ford edge-count
expectation, chronology, and a PGFPlots count expectation.
