# TikZ Parabola Path Operations

## Scope And Priority

This slice implements the core TikZ `parabola` path family: the default half
parabola, `parabola bend <coordinate> <coordinate>`, the braced `bend` option,
`bend pos`, `parabola height`, style expansion, ordinary path paint, arrows,
and affine coordinate transforms. It does not claim PGFPlots sampling,
arbitrary custom soft-path timers, or degenerate affine matrices.

The slice was selected because `bbox-asymmetric-border-math` was already a
real accepted fixture but its blue curve was completely absent. The prior SVG
contained three isolated move commands instead of cubic geometry.

## Local MacTeX Review

The implementation was derived from these installed TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`, lines 1213-1222 and 3488-3529. `bend pos`
  stores the interpolation factor; `parabola height` resets it to `.5` and
  adds `(0,height)` in the local coordinate frame; explicit `bend` replaces
  the computed point. TikZ passes start-to-bend and bend-to-end vectors to PGF.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepathconstruct.code.tex`, lines 1229-1308. `\pgfpathparabola` emits
  zero, one, or two cubic halves. The first uses `(0.1125 dx,0.225 dy)` and
  `(0.5 dx,1.0 dy)` controls; the second uses `(0.5 dx,0 dy)` and
  `(0.8875 dx,0.775 dy)`. A zero-length half is omitted.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex`. A Stealth tip is a separate filled path
  oriented by the final segment tangent.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty`
  and `/usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx` provide the
  package and document shells recorded by the semantic audit.

An initial rotated test exposed an important transform rule: applying the
coefficients directly to already transformed x/y deltas is wrong. TikZKit now
maps the three points back to the local frame, constructs the PGF cubics there,
and maps every control point through the affine transform.

## Reference Artifacts And SVG Structure

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; references used
`pdflatex`, local `rsvg-convert`, and MacTeX. All artifacts are in
`outputs/qa/2026-09-05-parabola-paths-after`, including TikZKit SVG/PNG,
MacTeX PNG, tikztosvg input/SVG/PNG, 1cm-grid SVG/PNG, diffs, and sheets.

The tikztosvg roots use physical `pt` dimensions and zero-origin `viewBox`
values. Curves are `<path fill="none">` elements with two `C` segments,
`stroke-linecap="butt"`, `stroke-linejoin="miter"`, and a y-flip transform.
The physics reference, for example, uses controls at 7.974pt/12.756pt and
35.435pt/56.693pt before meeting at the 2cm apex. TikZKit stores the same
geometry in its 100-unit-per-cm scene scale. Arrow tips are separate filled
paths with tangent-aligned transform matrices. tikztosvg emits TeX text as
glyph paths; TikZKit retains its selectable or packaged-glyph text pipeline.

## Visual Inspection

- `bbox-asymmetric-border-math`: before this slice the entire blue parabola
  was missing. Afterward it is continuous through its bend and visually
  matches both references under the 8-degree picture rotation. TikZKit is
  184x155px versus 184x156px for tikztosvg because of existing raster rounding.
- `paths-parabola-flowchart`: both upper style-driven and lower explicit-bend
  transitions meet the same node borders and have the same bend locations in
  all three renderers. Colors, line widths, layers, and terminal tip directions
  agree. TikZKit and tikztosvg are both 301x64px.
- `paths-parabola-math`: the blue curve meets the marked bend `B`; the red
  dashed curve passes through its braced option bend. The 1cm grids align in
  position and scale. No curve, point, label, or axis is missing. A one-pixel
  width and height difference remains from crop/raster rounding.
- `paths-parabola-physics`: the orange path reaches `(2.5,2)`, the red gravity
  vector starts at the apex, and the landing arrow follows the final tangent.
  Geometry and the 244x103px canvas match tikztosvg; residual pixels are text,
  arrow-outline, and anti-aliasing differences.

Diff values were used only to locate residual paint. The visible acceptance
criterion was the restoration and alignment of complete curve geometry.

## Command, Option, And Number Audit

Flowchart fixture:

- Commands/environments: `\documentclass`, `\usepackage`,
  `\usetikzlibrary`, `document`, `tikzpicture`, `\node`, and `\draw`.
- Picture styles: `>=Stealth`; `stage/.style` with `draw`,
  `rounded corners=2pt`, `minimum width=18mm`, `minimum height=8mm`; and
  `arched/.style` with `parabola height=7mm`, `bend pos=.4`.
- Nodes: `(0,0)`, `(3,0)`, `(6,0)`; `blue!10`, `yellow!18`, `green!12`.
  Paths use `->`, `thick`, `blue`, `green!50!black`, named east/west anchors,
  explicit bend `(4.5,-.8)`, and document border `2pt`.

Mathematics fixture:

- Commands/environments are the same shell plus `\draw`, `\fill`, and
  `\node`. Picture options are `x=1cm`, `y=1cm`, and `>=Stealth`.
- Axes span `(-2.5,0)` to `(3.4,0)` and `(0,-1.4)` to `(0,3.3)` with `->`.
  The blue `very thick` curve is `(-2,2.4) parabola bend (0,-1) (3,2.1)`.
- The bend mark is blue with radius `1.5pt`; label `B` is `below right`.
  The red `thick,dashed` curve starts at `(-2,-.5)`, uses the native braced
  option `bend={(.5,.2)}`, and ends at `(3,2.7)` beside an `above left` label.

Physics fixture:

- Commands/environments are the same shell plus `\draw`, `\fill`, and
  `\node`; picture option is `>=Stealth`; document border is `2pt`.
- The gray ground spans `(-.4,0)` to `(5.6,0)`. The orange `->,very thick`
  path is `(0,0) parabola[parabola height=2cm] (5,0)`.
- The launch mark radius is `1.5pt`. The blue `->,thick` vector ends at
  `(1.2,1.05)` with `$v_0$`; the red vector runs from `(2.5,2)` to
  `(2.5,1.2)` with `$g$`; launch and landing labels use `below`.

Every item above is implemented and the three strict semantic audits pass.
Not claimed here: nonlinear coordinate mappings, singular transforms, general
TeX path macros that synthesize custom soft paths, and PGFPlots `\addplot`.

## Implementation And Verification

- `src/frontend/parser.js` produces a dedicated parabola AST segment.
- `src/engine/evaluate.js` resolves style-expanded bend state and coordinates.
- `src/tikz/pathOperations/parabola.js` owns renderer-neutral PGF cubic geometry.
- `src/tikz/commands/path.js` exposes the capability in the command catalog.
- `test/parabola-path.test.js` checks parsing, all bend modes, exact PGF
  coefficients, braced coordinates, style expansion, and rotated local height.

Focused parser, package, audit, and parabola tests pass 45/45. All four visual
cases have zero diagnostics; MacTeX and tikztosvg render 4/4 references; all
three new strict semantic audits pass. The full suite reports 2186 passes,
132 pre-existing known failures, and 14 skips; the failure count is unchanged
from the 2180/132/14 baseline before these six tests were added.
