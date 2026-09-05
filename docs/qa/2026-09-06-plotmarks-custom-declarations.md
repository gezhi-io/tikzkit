# Plotmarks Custom Declarations

## Scope

This round deliberately skipped cases whose remaining differences were only
font rasterization, antialiasing, or one-pixel registration. The selected
structural gap was custom `\\pgfdeclareplotmark` support in the `plotmarks`
library. Before the change, an unknown custom mark silently became an `x`.

The accepted boundary is named declarations whose bodies build one or more PGF
paths with move, line, cubic curve, circle, ellipse, rectangle, and close
operations. It includes Cartesian and polar points, point add/diff/scale,
`\\pgfplotmarksize` scalar products, stroke/fill/fillstroke actions, direct
TikZ plots, PGFPlots plots, and PGFPlots legend samples. Arbitrary TeX programs,
conditionals, register assignments, clipping, low-level transform/color/line
state, and document-order declaration scoping remain partial.

## Local TeX Reading

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryplothandlers.code.tex`
around lines 934-956. `\\pgfdeclareplotmark` stores executable code by mnemonic,
and `\\pgfsetplotmarksize` sets the use-time `\\pgfplotmarksize` dimension.
The mark body executes at a local origin for every data point.

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryplotmarks.code.tex`
around lines 13-59 and 436-449. Built-in marks demonstrate ellipse, polar,
move/line, cubic, close, stroke, fill, and fillstroke operations. The heart also
confirms scalar products such as `1.5\\pgfplotmarksize`.

Reviewed
`/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-plot-handlers.tex`
around lines 630-655 and
`/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-plots.tex`
around lines 427-442. The first contains the exact shifted open-circle driver;
the second specifies that `mark=<mnemonic>` places a declared mark after the
plot path is painted.

## Visual References

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. MacTeX used
`/Library/TeX/texbin/pdflatex`, and SVG rasterization used
`/opt/homebrew/bin/rsvg-convert`.

The pre-fix proof is in
`outputs/qa/2026-09-06-custom-plotmark-candidate/`: TikZKit paints three blue
`x` marks at the data points, while MacTeX and tikztosvg paint open circles
whose centers are shifted upward by `1ex` and whose radii are `1ex`.

The complete post-fix artifacts are in
`outputs/qa/2026-09-06-custom-plotmarks-after/`, including `tikzkit-svg/`,
`tikzkit-png/`, `tikztosvg-svg/`, `tikztosvg-png/`, `mactex-png/`, and `diff/`.
The four native and tikztosvg comparison sheets were inspected directly:

- `plotmarks-custom-declaration-manual`: the open-circle shape, radius, and
  upward offset now match both references.
- `plotmarks-custom-declaration-flowchart`: a filled/stroked circle and a
  separately stroked crosshair are preserved at both connector points.
- `plotmarks-custom-declaration-math`: filled triangular marks appear at all
  three PGFPlots points and in the legend sample.
- `plotmarks-custom-declaration-physics`: anisotropic ellipses preserve their
  horizontal orientation, dimensions, and centers.

The tikztosvg SVG represents the manual circles as stroked paths with local
translation. TikZKit now emits equivalent path geometry rather than its old
fallback shape. Remaining visible pixels are font rasterization, antialiasing,
and at most a one-pixel crop/registration difference, not missing geometry.

## Implementation And Verification

- `src/tikz/libraries/plotmarks.js` parses declarations and lowers the bounded
  PGF point/path language into renderer-neutral path commands.
- `src/frontend/parser.js` and `src/frontend/latex-shell.js` retain declarations
  from picture bodies and document preambles.
- `src/engine/evaluate.js` uses declarations for direct TikZ plots.
- `src/pgfplots/axisTikzLowering.js` and `src/pgfplots/marks.js` reuse them for
  PGFPlots points and legend samples.
- `test/plotmarks-custom-declarations.test.js` covers the manual shifted ring,
  mark-size line geometry, and PGFPlots fill/legend reuse.
- Four permanent fixtures cover manual, flowchart, math, and physics contexts.

Focused plotmark and PGFPlots regression tests pass 43/43. All four visual
fixtures render through TikZKit, tikztosvg, and MacTeX with zero TikZKit
diagnostics and zero external-reference failures. The full suite reports 2493
tests, 2343 passes, 136 pre-existing failures, and 14 skips. Compared with the
previous recorded 2487-test run, the total increased by six while failure and
skip counts remain unchanged; the three targeted tests added by this slice all
pass.

The next large-gap round should keep this structural filter: choose a case with
missing geometry or wrong semantics, not a high pixel score caused only by text
or antialiasing.
