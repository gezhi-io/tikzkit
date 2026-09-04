# PGF Plotmarks Text Mark QA (2026-09-05)

## Scope

This slice implements `mark=text` in direct TikZ plots and PGFPlots. The
accepted boundary is arbitrary `text mark` content, `text mark style`, the
default pgftext placement keys `left`, `right`, `top`, `bottom`, `base`, and
`rotate`, plus `text mark as node=true` with ordinary node paint, shape,
spacing, font, scale, rotation, and anchor options.

Arbitrary user-defined `\pgfdeclareplotmark` bodies and general affine
`mark options` for non-text marks remain partial.

## Local MacTeX Review

Reviewed local TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryplotmarks.code.tex`, lines 253-273;
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-plot-marks.tex`, lines 80-109;
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-base-scopes.tex`, lines 600-720;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryplotmarks.code.tex`;
- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgfplots/pgfplots.sty` and
  `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`.

The source declares `text mark=p`, an empty style, and node mode false. It
reads the style and text at every point, then executes either
`\pgftext[style]{text}` or `\node[style]{text}`. In pgftext mode, left/right
and top/bottom put that text-box border on the mark origin, base puts the TeX
baseline there, and rotate transforms the box around the origin. Node mode is
deliberately different: its style is the normal TikZ node option list.

An initially invalid local probe put `font=...` into default pgftext style.
Both MacTeX and tikztosvg rejected `/pgf/text/font`, confirming the manual's
mode boundary. The accepted fixtures put font declarations in the text
content for pgftext mode and use `font=...` only in node mode.

## Command And Parameter Inventory

| Driver | Commands and environments | Implemented options and values |
| --- | --- | --- |
| Flowchart | `\documentclass`, `\usepackage`, `\usetikzlibrary`, `document`, `tikzpicture`, `\node`, `\draw`, `plot coordinates` | `arrows.meta`, `plotmarks`, `positioning`, named node/edge styles, `right=of`, `-Stealth`, path colors, `mark=text`, arbitrary `text mark`, default centered text, `base,left`, node mode, draw/fill, rounded corners, 1pt/2pt spacing, small bold font, 10-degree rotation, and three plot coordinates |
| Mathematics | the document commands plus `axis` and `\addplot` | 10cm by 6cm axis, explicit 0..5 ranges, middle axes, major grid, x/y labels, explicit ticks, `only marks`, `top`, 25-degree rotation, alpha/beta subscript/gamma formula content, node-mode circle, purple fill/draw, 2pt inner separation, and three data coordinates |
| Physics | the document commands plus inline formula nodes and vector paths | `Stealth`, thick blue/orange vectors, dashed gray projections, vector formula content, `bottom,right,rotate=-20`, node-mode west anchor, rounded orange fill/draw, 2pt inner separation, small font, and force endpoint coordinates |

The three accepted semantic reviews cover every dependency, command,
environment, option occurrence, expression, and numeric literal in these
fixtures. TikZKit reports zero diagnostics for all three.

## tikztosvg Structure

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. Native MacTeX used
`/Library/TeX/texbin/pdflatex`, and PNG conversion used
`/opt/homebrew/bin/rsvg-convert`.

The reference SVG converts text to glyph paths. Default text marks have no
extra marker geometry; color and rotation are carried by glyph paths and
transforms. Node mode adds a separate nonzero-fill box/circle path before the
glyphs, with butt caps and miter joins. The SVG page has a y-flipping matrix,
while each rotated text or node contributes its own local transform. TikZKit
keeps text as SVG text/math nodes but matches the same layer order, anchors,
paint, and rotation.

## Visual Result

Before this slice, direct TikZ text marks were rendered as colored x marks and
PGFPlots text marks as ordinary circles. All content, formulas, font commands,
anchors, node borders, fills, and rotations were missing.

After the change, the inspected four-way panels show visible `R`, boxed `A`,
and baseline-aligned `D` in the workflow; alpha, rotated beta with subscript,
and circular gamma in the axis; and both force-vector formula labels with the
second inside its orange rounded node. Their placement sides, colors, sizes,
node layers, and rotations agree closely with MacTeX and tikztosvg. Remaining
visible differences are existing axis line/text rasterization and one-pixel
crop differences, not missing text-mark semantics.

Supplementary TikZKit-versus-tikztosvg changed-pixel ratios improved from
12.81% to 12.35% for the flowchart, 6.06% to 5.93% for mathematics, and 5.54%
to 5.19% for physics. Acceptance is based on the visible semantic correction,
not those aggregate numbers.

## Artifacts

Before:

`/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa/2026-09-05-plotmarks-text-mark-before-valid/`

After:

`/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa/2026-09-05-plotmarks-text-mark-after/`

Each directory contains MacTeX PNG, TikZKit SVG/PNG, tikztosvg SVG/PNG, 1cm
grid variants, registered diffs, and native four-way sheets for all drivers.

## Verification

```bash
node --test --test-name-pattern='text plot marks|text mark content' \
  test/interpreter.test.js test/pgfplots-csv-overlay.test.js \
  test/plotmarks-basic-catalog.test.js

npm run case:audit -- test/fixtures/examples/plotmarks/text-mark-flowchart.tex \
  --review test/fixtures/examples/plotmarks/text-mark-flowchart.review.json --strict
npm run case:audit -- test/fixtures/examples/plotmarks/text-mark-math.tex \
  --review test/fixtures/examples/plotmarks/text-mark-math.review.json --strict
npm run case:audit -- test/fixtures/examples/plotmarks/text-mark-physics.tex \
  --review test/fixtures/examples/plotmarks/text-mark-physics.review.json --strict

node scripts/render-example-fixtures.js \
  --output outputs/qa/2026-09-05-plotmarks-text-mark-after \
  --only plotmarks-text-mark-flowchart --only plotmarks-text-mark-math \
  --only plotmarks-text-mark-physics --native-reference \
  --tikztosvg-engine pdflatex --math-renderer svg-text --strict-tikztosvg

node scripts/diff-example-pngs.js \
  --output outputs/qa/2026-09-05-plotmarks-text-mark-after --register
```

The focused text-mark tests pass (3/3). The three strict semantic audits are
accepted with zero todos and zero blockers, and the visual render reports zero
TikZKit diagnostics and zero external-render failures for all three drivers.

The full repository test run remains at its existing baseline: 2,219 tests,
2,078 passing, 127 failing, and 14 skipped. None of the 127 pre-existing
failures is in the new text-mark tests, and this slice adds no full-suite
regression.
