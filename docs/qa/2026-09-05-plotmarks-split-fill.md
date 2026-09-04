# PGF Plotmarks Split-Fill QA (2026-09-05)

## Scope

This slice implements the four source-defined split-fill marks
`halfdiamond*`, `halfsquare*`, `halfsquare right*`, and
`halfsquare left*`. The acceptance boundary includes exact mark-size geometry,
the current fill, the supplemental `mark color`, `mark color=none`, one final
outline, and whole-mark rotation in both direct TikZ plots and PGFPlots.

It does not claim the complete `plotmarks` library. Text marks, heart marks,
user-defined `\pgfdeclareplotmark` bodies, `every mark/.append style`, and
general affine mark options remain partial.

The permanent drivers cover three common domains:

- `plotmarks-split-fill-flowchart`: four marks as workflow checkpoints;
- `plotmarks-split-fill-math`: the four marks in a PGFPlots scatter axis;
- `plotmarks-split-fill-physics`: marks on force-vector endpoints and guides.

## Local MacTeX Review

Reviewed these local TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryplotmarks.code.tex`, lines 275-432;
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-plot-marks.tex`, lines 46-72;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`, lines 1277-1279 and 3417-3422;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryplotmarks.code.tex`;
- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty`;
- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgfplots/pgfplots.sty` and
  `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`
  for the axis driver.

The source fixes the following geometry and paint order:

1. `halfdiamond*` uses horizontal radius `0.75 * mark size`; all halfsquare
   variants use horizontal and vertical radius `mark size`.
2. The down, right, or left triangle is filled with the active plot fill.
3. The opposite triangle is white by default, uses explicit `mark color`, or
   is skipped for `mark color=none`.
4. A closed tilted-square or diamond outline is stroked last.
5. TikZ installs `mark options` before `\pgfuseplotmark`, so rotation applies
   to both fills and the outline around the plotted coordinate.

## Case Inventory

| Driver | Commands and environments verified | Options and numeric semantics verified |
| --- | --- | --- |
| Flowchart | `\documentclass`, `\usepackage`, `\usetikzlibrary`, `document`, `tikzpicture`, `\node`, `\draw`, `plot coordinates` | `border=2pt`, `node distance=2.5cm`, named styles, `right=of`, rounded/minimum node dimensions, `-Stealth`, `thick`, all four mark names, `mark size=6pt`, current colors/fills, explicit mark colors, `none`, and four coordinates |
| Mathematics | `\documentclass`, `\usepackage{pgfplots}`, `\usetikzlibrary`, `\pgfplotsset`, `document`, `tikzpicture`, `axis`, four `\addplot` commands | `compat=newest`, 10cm by 6cm axis, explicit 0..5 ranges, middle axes, major grid, labels, explicit ticks, `only marks`, all four mark names, 7pt size, fill colors, mark colors, and `rotate=30` |
| Physics | `\documentclass`, `\usepackage`, `\usetikzlibrary`, `document`, `tikzpicture`, `\draw`, inline nodes, `plot coordinates`, `\vec` math | x/y axes, `Stealth`, thick force vectors, dense guides, all four mark names, 6pt/7pt sizes, current fills, explicit mark colors, `none`, `rotate=20`, and all vector/guide coordinates |

All constructs exercised by these three drivers render with zero diagnostics.
The surrounding TikZ and PGFPlots packages remain partial outside the explicit
boundary above. The automated semantic audit reports no blockers; its accepted
review files are passed explicitly in the verification commands below.

## tikztosvg Structure

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. MacTeX used
`/Library/TeX/texbin/pdflatex`, and SVG-to-PNG conversion used
`/opt/homebrew/bin/rsvg-convert`.

The inspected tikztosvg SVG does not use SVG markers for these plot marks. It
emits two separate `fill-rule="nonzero"` paths followed by a
`fill="none"` outline path. The outline carries PGF's
`stroke-linecap="butt"`, `stroke-linejoin="miter"`, and 0.3985pt stroke.
The page-level y inversion is expressed by `matrix(1,0,0,-1,...)`; rotated
marks have their coordinates flattened into the path data. For example, the
flowchart halfdiamond uses two three-vertex fill paths at horizontal radius
4.48pt and vertical radius 5.98pt, then a four-vertex closed outline. The
`mark color=none` marker contains only the active-fill triangle and outline.

TikZKit now emits the same three-layer structure into its scene graph and SVG:
primary non-stroked fill, optional supplemental non-stroked fill, then the
closed no-fill outline. Direct TikZ and PGFPlots call the same geometry helper,
so the two pipelines no longer disagree about the fallback shape.

## Visual Result

Before the change, the direct flowchart and force-vector marks fell through to
generic x marks. The PGFPlots scatter marks fell through to filled circles.
Consequently the split direction, secondary color, 0.75 diamond ratio,
rotation, and transparent-half semantics were all absent.

After the change, all three inspected four-way sheets show the same visible
marker family as MacTeX and tikztosvg:

- the blue/orange `halfdiamond*` has the narrower 0.75 horizontal radius;
- `halfsquare*` has equal radii and a lower/current plus upper/mark-color split;
- right and left variants select the correct current-fill side;
- the 30-degree mathematical mark and 20-degree force marker rotate as a unit;
- the `none` half remains transparent, so the underlying guide remains visible;
- each mark has one final colored mitered outline rather than two stroked halves.

The remaining visible residuals are principally text rasterization, axis paint,
and a one-pixel crop difference. As supplementary measurements, TikZKit versus
tikztosvg mean absolute RGBA improved from 0.02766 to 0.02307 for the flowchart,
0.00894 to 0.00637 for mathematics, and 0.00916 to 0.00658 for physics. The
acceptance decision was based on the inspected shapes and layers, not these
numbers alone.

## Artifacts

Before:

`/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa/2026-09-05-plotmarks-split-fill-before/`

After:

`/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa/2026-09-05-plotmarks-split-fill-after/`

Each directory contains MacTeX PNG, TikZKit SVG/PNG, tikztosvg SVG/PNG, 1cm
grid variants, registered diffs, and native four-way sheets for all three
drivers.

## Verification

```bash
node --test --test-name-pattern='split diamond and square marks|halfcircle plot marks|starred halfcircle marks|triangle plot marks' test/pgfplots-csv-overlay.test.js
node --test --test-name-pattern='split-fill geometry|halfcircle fill and rotation|plot marks' test/interpreter.test.js

npm run case:audit -- test/fixtures/examples/plotmarks/split-fill-flowchart.tex --review test/fixtures/examples/plotmarks/split-fill-flowchart.review.json --strict
npm run case:audit -- test/fixtures/examples/plotmarks/split-fill-math.tex --review test/fixtures/examples/plotmarks/split-fill-math.review.json --strict
npm run case:audit -- test/fixtures/examples/plotmarks/split-fill-physics.tex --review test/fixtures/examples/plotmarks/split-fill-physics.review.json --strict

node scripts/render-example-fixtures.js \
  --output outputs/qa/2026-09-05-plotmarks-split-fill-after \
  --only plotmarks-split-fill-flowchart \
  --only plotmarks-split-fill-math \
  --only plotmarks-split-fill-physics \
  --continue-on-external-failure --strict-tikztosvg \
  --native-reference --native-latex-engine pdflatex \
  --tikztosvg-engine pdflatex --math-renderer svg-text

node scripts/diff-example-pngs.js \
  --output outputs/qa/2026-09-05-plotmarks-split-fill-after --register

npm test
```

The focused marker tests pass. All three visual drivers render in all three
engines with zero TikZKit diagnostics and zero external-render failures. The
full suite reports 2,214 tests: 2,068 pass, 132 fail, and 14 are skipped. The
132 failures match the pre-slice baseline, so this change adds no full-suite
regressions. Representative existing failures include the missing semantic
owner for `circuitikz-varcap-diodes`, the Bellman-Ford edge-count expectation,
and web-server tests that cannot bind a local port in the test sandbox.
