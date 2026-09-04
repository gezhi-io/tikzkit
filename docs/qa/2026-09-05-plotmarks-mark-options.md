# PGF Plotmarks Local Options QA (2026-09-05)

## Scope

This slice implements local paint and affine options for built-in, non-text
plot marks. It covers direct TikZ `plot` marks, PGFPlots marks, and PGFPlots
legend samples. The accepted option family is:

- `mark options={...}` replacement and `every mark/.append style={...}` merge;
- `draw`, `fill`, `line width`, and `mark size`;
- ordered `scale`, `xscale`, `yscale`, `rotate`, `xshift`, `yshift`,
  `xslant`, and `yslant` transforms.

The library remains partial. Arbitrary `\pgfdeclareplotmark` programs and the
conversion of a PGFPlots `halfcircle` arc under a non-uniform affine transform
are outside this slice.

The permanent visual drivers are:

- `plotmarks-mark-options-flowchart`: shifted, rotated, anisotropic review gates;
- `plotmarks-mark-options-math`: two styled scatter series and legend samples;
- `plotmarks-mark-options-physics`: rotated uncertainty ellipses along a trace.

## Local MacTeX Review

Reviewed these local TeX Live 2025 sources and documentation:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryplothandlers.code.tex`;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcoretransformations.code.tex`;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.markers.code.tex`;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`;
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-plot-marks.tex`;
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-plots.tex`;
- `/usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx` and `size10.clo`;
- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty`;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryplotmarks.code.tex`;
- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgfplots/pgfplots.sty`.

The implementation follows four source-level rules:

1. A plot handler shifts the canvas to the sample coordinate before invoking
   the mark, so the local mark transform must not move the sample itself.
2. TikZ records transforms in option order with `\tikz@addtransform`; shifts
   are therefore affected by the matrix accumulated before them.
3. PGFPlots resets the marker matrix, applies plot-local `every mark` and
   explicit options, and then executes the TikZ transform.
4. `every mark/.append style` inside `\addplot[...]` is a plot-local TikZ key.
   The same-looking key at axis level is not an equivalent inherited base.

The fourth point was confirmed by rendering MacTeX during this slice; an
initial axis-level test assumption was removed before acceptance.

## Case Inventory

| Driver | Commands/environments | Parameters and numbers verified |
| --- | --- | --- |
| Flowchart | `\documentclass`, `\usepackage`, `\usetikzlibrary`, `document`, `tikzpicture`, `\node`, `\draw`, `plot`, `coordinates` | named node/flow styles, positioning, `Stealth[length=2.4mm]`, `mark=square*`, `mark size=4pt`, `only marks`, `mark options`, `xscale=1.65`, `yscale=.65`, `rotate=45`, `xshift=2pt`, `yshift=1pt`, local draw/fill/line width, and two sample coordinates |
| Mathematics | `\documentclass`, `\usepackage{pgfplots}`, `\usetikzlibrary`, `\pgfplotsset`, `document`, `tikzpicture`, `axis`, two `\addplot` commands, `\legend` | 9cm by 6cm axis, explicit ranges, middle axes, grid, labels, legend, `diamond*`, `triangle*`, `mark size=4pt`, `every mark/.append style`, `scale=1.35`, `mark options`, `xscale=1.7`, `yscale=.6`, `rotate=25`, local paint/line widths, and ten coordinates |
| Physics | `\documentclass`, `\usepackage`, `\usetikzlibrary`, `document`, `tikzpicture`, `\draw`, `\tikzset`, `plot`, `coordinates`, `\node`, `\small` | two `Stealth[length=2.2mm]` axes, seven-point smooth trace, `mark=o`, `mark size=4pt`, `every mark/.append style`, `xscale=1.8`, `yscale=.65`, `rotate=25`, purple local stroke, `line width=1pt`, anchors, and 9pt `\small` text |

The strict semantic audits accepted all three drivers with no todos or
blockers. The math driver covers 8 commands, 28 options, and 27 numeric
semantics. The physics driver covers 9 commands, 12 options, and 41 numeric
semantics. All three TikZKit renders report zero diagnostics.

## tikztosvg Structure

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. Native MacTeX used
`/Library/TeX/texbin/pdflatex`, and SVG-to-PNG conversion used
`/opt/homebrew/bin/rsvg-convert`.

The inspected tikztosvg SVG represents the marks as ordinary `<path>`
elements. Local rotation, scale, slant, and shifts are flattened into path
coordinates; only the page-level matrix remains as an SVG `transform`. The
paths use `fill-rule="nonzero"`, butt line caps, and miter line joins. The math
outlines are approximately 0.69739pt and 0.79701pt, while the physics ellipse
uses approximately 0.99628pt. Colors and geometry agree with MacTeX.

TikZKit now resolves the local option map once, constructs the mark around its
sample coordinate, applies the ordered affine matrix to every path command,
and leaves the plot coordinate fixed. Legend samples use the same helper as
the plotted data, preventing the legend from reverting to a default marker.

## Visual Result

Before this change, the flowchart gates were default black diamonds, the math
series lost their local blue/orange paint and anisotropic geometry, and the
physics trace used small black circles. These were visible semantic failures,
not merely pixel-level differences.

After the change, the inspected four-way sheets show:

- two cyan, blue-outlined, narrow rotated diamonds at the intended shifted
  flowchart locations;
- five enlarged blue diamonds and five red-outlined orange elongated
  triangles, with matching PGFPlots legend samples;
- seven similarly rotated purple-red open ellipses centered on the physical
  measurement samples;
- the same butt/miter stroke behavior, local line widths, fills, and transform
  order as MacTeX and tikztosvg.

Residual red pixels in the diff sheets are mainly axis/text rasterization and
small crop differences. As supplementary measurements, the MacTeX-registered
mean absolute RGBA difference improved from 0.0350 to 0.0304 for the
flowchart, and from 0.0190 to 0.0146 for physics. The math fixture semantics
were corrected during review, so its acceptance is based on the final visual
comparison rather than a misleading cross-version number.

## Artifacts

Before:

`/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa/2026-09-05-plotmarks-mark-options-before/`

After:

`/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa/2026-09-05-plotmarks-mark-options-after/`

Each directory contains MacTeX PNG, TikZKit SVG/PNG, tikztosvg SVG/PNG,
registered diffs, and native four-way sheets. The inspected final sheets are
under the after directory's `diff/` folder.

## Verification

```bash
node --test test/plotmarks-mark-options.test.js test/plotmarks-basic-catalog.test.js test/plotmarks-split-fill.test.js test/pgfplots-csv-overlay.test.js

npm run case:audit -- test/fixtures/examples/plotmarks/mark-options-flowchart.tex --review test/fixtures/examples/plotmarks/mark-options-flowchart.review.json --strict
npm run case:audit -- test/fixtures/examples/plotmarks/mark-options-math.tex --review test/fixtures/examples/plotmarks/mark-options-math.review.json --strict
npm run case:audit -- test/fixtures/examples/plotmarks/mark-options-physics.tex --review test/fixtures/examples/plotmarks/mark-options-physics.review.json --strict

node scripts/render-example-fixtures.js \
  --output outputs/qa/2026-09-05-plotmarks-mark-options-after \
  --only plotmarks-mark-options-flowchart \
  --only plotmarks-mark-options-math \
  --only plotmarks-mark-options-physics \
  --continue-on-external-failure --strict-tikztosvg \
  --native-reference --native-latex-engine pdflatex \
  --tikztosvg-engine pdflatex --math-renderer svg-text

node scripts/diff-example-pngs.js \
  --output outputs/qa/2026-09-05-plotmarks-mark-options-after \
  --register --alignment-radius 12
```

The focused test command passes all 40 tests. A broader interpreter run passed
322 of 341 tests; its 19 failures are existing baseline expectations outside
this slice. The new regression tests and the related plotmark tests all pass.
