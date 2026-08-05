# tkz-fct Cartesian Frame QA - 2026-08-05

## Scope

This focused slice implements the `tkz-base` coordinate-frame behavior used by
`tkz-fct`: `\tkzInit` local origins for same-sign ranges, explicit
`\tkzGrid` bounds, `sub` grids, and independent `xstep` / `ystep` values.
It deliberately does not claim the broader `tkzFctPar`, `tkzFctPolar`, gnuplot
cache, tangent, area, or asymptote families.

## Local Reference Study

Reviewed in MacTeX / TeX Live 2025:

- `tex/latex/tkz-fct/tkz-fct.sty` and
  `doc/latex/tkz-fct/TKZdoc-fct-fonctions.tex`: scalar functions are evaluated
  in source units before the `xstep` / `ystep` mapping.
- `tex/latex/tkz-base/tkz-tools-base.tex`: a same-sign initialized range makes
  the displayed local origin equal to `xmin` / `ymin`, rather than numeric zero.
- `tex/latex/tkz-base/tkz-obj-grids.tex`: explicit grid coordinates are mapped
  through `(value - origin) / step`; subgrids paint first with `color!50`.
- `tex/latex/tkz-base/tkz-obj-axes.tex`: tick labels are local-position times
  step plus the source origin.

## Driver And Artifacts

Driver: `outputs/qa-tkz-fct-grid/tkz-fct-grid-origin.tikz`

```tex
\tkzInit[xmin=20,xmax=100,xstep=20,ymin=1000,ymax=3000,ystep=1000]
\tkzGrid[sub,subxstep=10,subystep=500,color=orange](-20,-1000)(115,4000)
\tkzAxeXY
```

Artifacts, including the 1 cm comparison-grid versions:

- MacTeX PNG: `outputs/qa-tkz-fct-grid/after/mactex-png/tkz-fct-grid-origin.png`
- TikZKit SVG/PNG: `outputs/qa-tkz-fct-grid/after/tikzkit-grid-svg/tkz-fct-grid-origin.svg`
  and `outputs/qa-tkz-fct-grid/after/tikzkit-grid-png/tkz-fct-grid-origin.png`
- tikztosvg SVG/PNG: `outputs/qa-tkz-fct-grid/after/tikztosvg-grid-svg/tkz-fct-grid-origin.svg`
  and `outputs/qa-tkz-fct-grid/after/tikztosvg-grid-png/tkz-fct-grid-origin.png`
- Four-panel native/tikztosvg/before/after sheet:
  `outputs/qa-tkz-fct-grid/after/sheet-native-tikztosvg-before-after.png`
- Pixel diff: `outputs/qa-tkz-fct-grid/after/diff-tikzkit-vs-tikztosvg.png`

`tikztosvg` was available at `/Library/TeX/texbin/tikztosvg`; the required
command was `tikztosvg --xelatex -p tkz-fct ...`. Without `-p tkz-fct`, it
correctly reported `\tkzInit` as undefined because tikztosvg includes TikZ but
not this third-party package by default.

## Visual Result

Before this change, TikZKit discarded the explicit range and subgrid. Its axes
origin was outside the orange grid, so the source frame `(20,1000)` was rendered
as if it were `(0,0)`. The lower-left before panel in the sheet visibly has only
the inner grid and a detached origin.

After this change, TikZKit, MacTeX, and tikztosvg place the axes intersection at
source `(20,1000)`, render the outer `(-20,-1000)` to `(115,4000)` range, and
show 10/500-unit subcells under the 20/1000-unit main grid. Remaining image
diff is expected from raster dimensions (TikZKit 256x190; tikztosvg 257x190),
font outlines, and antialiasing; the diff is not used as the acceptance signal.

## Command And Parameter Audit

Implemented in this slice:

- `\tkzInit`: `xmin`, `xmax`, `xstep`, `ymin`, `ymax`, `ystep`, including
  numeric pgfmath expressions.
- `\tkzGrid`: `color`, `line width`, `xstep`, `ystep`, `sub`, `subxstep`,
  `subystep`, `ratio`, and two explicit coordinate pairs.
- `\tkzAxeXY`: local axis geometry plus source-value tick labels.
- Existing `\tkzFct`: `domain`, `samples`, `color`, `line width`, and `style`.

Still outside this slice: `\tkzFctPar`, `\tkzFctPolar`, gnuplot data/cache
identifiers, tangents, areas, asymptotes, adaptive sampling, and general
discontinuity analysis.

## Verification

Passed:

```text
node --test test/tkz-fct.test.js
npm run extension-registry
```

The focused combined run also passed every `tkz-fct` and QA-grid test. Its 12
other interpreter failures are pre-existing dirty-worktree failures in unrelated
coordinate-system, color-normalization, arrow, and transform tests; none is a
grid or `tkz-fct` regression.
