# Datavisualization School-Book Axis Origin Tick QA

## Scope

This slice implements one native `school book axes` rule shared by all focused
datavisualization lowerings. The x-axis suppresses the duplicated `0` label at
the crossing. The y-axis keeps its `0` label, pins it to the crossing with a
`north east` anchor, and does not draw a short tick line there.

The driver is the cubic function example from the local PGF manual, stored in
`test/fixtures/examples/datavisualization/school-book-axes.tex`. It uses:

```tex
\usetikzlibrary{datavisualization.formats.functions}
\datavisualization [school book axes, visualize as smooth line]
  data [format=function] {
    var x : interval [-1.3:1.3];
    func y = \value x*\value x*\value x;
  };
```

This is a shared tick-rendering change, not a coordinate override for the
fixture.

## Local TeX Reading

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.code.tex`,
  school-book axis declaration: both axis ranges `include value=0`, map one
  source unit to one centimeter, and use a one-unit tick step. Its x major
  tick rule applies `no tick text` at zero. Its y major tick rule applies
  `high=0, low=0, style={draw=none}` plus `node style={anchor=north east}` at
  zero.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.formats.functions.code.tex`:
  the functions library loads the core data-visualization library and the PGF
  function-format backend; it does not redefine the axis system.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-dv-axes.tex`:
  school-book axes are intentionally unscaled by default so equal source units
  retain equal physical lengths, and their default tick spacing is one unit.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-dv-formats.tex`:
  `var ... : interval` creates the sampled input sequence, then `func` assigns
  derived values for each sample.

## Change

- `src/frontend/latex-shell.js` passes the explicit
  `datavis school book y origin label` semantic flag while lowering the axis.
- `src/pgfplots/ticks.js` uses that flag only for the y=0 major tick. It keeps
  the node, omits the short tick segment, and emits the label at the geometric
  axis crossing with `anchor=north east`.
- `test/pgfplots-seams.test.js` asserts the exact lowered behavior: one origin
  label, no x-origin duplicate, native anchor, and no origin tick segment.

## Three-Way Artifacts

- MacTeX native PNG: `outputs/font-visual-gates/datavisualization-school-book-axes/native.png`
- tikztosvg SVG/PNG: `outputs/font-visual-gates/datavisualization-school-book-axes/tikztosvg.svg`
  and `outputs/font-visual-gates/datavisualization-school-book-axes/tikztosvg.png`
- TikZKit SVG/PNG: `outputs/font-visual-gates/datavisualization-school-book-axes/tikzkit.svg`
  and `outputs/font-visual-gates/datavisualization-school-book-axes/tikzkit.png`
- Diff and reviewed four-panel sheets: `outputs/font-visual-gates/datavisualization-school-book-axes/diff.png`,
  `outputs/font-visual-gates/datavisualization-school-book-axes/sheet.png`, and
  `outputs/font-visual-gates/datavisualization-school-book-axes/sheet-grid.png`

`tikztosvg` is available at `/Library/TeX/texbin/tikztosvg`; it was rendered
with the local XeLaTeX engine and rasterized by
`/opt/homebrew/bin/rsvg-convert`. The reference SVG uses a `0 0 89.04 139.86`
viewBox, 0.3985pt round tick paths, mitered function paths, and explicit path
arrowhead geometry. Those structural details were inspected alongside the
TikZKit SVG before accepting the change.

## Visual Review

Before this change, the generic middle-axis obscured-tick rule removed both
origin labels. The school-book source therefore lost the y-axis `0`, even
though the local PGF declaration calls for it.

After the change, the MacTeX, tikztosvg, and TikZKit panels all visibly show a
single `0` tucked at the lower-left of the axis intersection; none shows a
second x-axis zero or an origin tick stub. The cubic curve, equal 1cm source
grid spacing, axis directions, and labels line up across the first three
panels. The diff panel still highlights the full curve/axes because SVG and
PDF rasterization differ, and TikZKit retains a 1.5pt anchor/canvas-crop
offset against the MacTeX PNG. That residual is crop/antialiasing work, not a
missing feature in this slice.

## Implemented And Remaining Syntax

Implemented here:

- `\usetikzlibrary{datavisualization.formats.functions}`;
- `school book axes` source-origin inclusion and one-centimeter unit scaling;
- `visualize as smooth line` for this documented function source;
- `data [format=function]`, `var x : interval [...]`, and `func y = ...`;
- asymmetric zero tick-label semantics for school-book axes.

Still partial: the full native survey/object pipeline, arbitrary custom
visualizers, all `visualize ticks` `options at=<value>` forms, nontrivial
axis transforms, and exact MacTeX/tikztosvg crop and glyph-raster parity.

## Verification

```bash
node --test --test-name-pattern='applies custom datavisualization style sheets to data point sets|datavisualization school-book axes preserve only the native y-origin label' test/extensions.test.js test/pgfplots-seams.test.js
npm run extension-registry
npm run font:gates
```

The two focused regression tests pass. The five-case font gate completed and
the new native/tikztosvg/TikZKit/diff sheets were inspected manually.
