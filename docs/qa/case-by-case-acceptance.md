# Case-by-Case Visual Acceptance

This ledger follows the exact order shown by the browser workbench. A case is
accepted only after its complete source inventory, focused regression test,
TikZKit SVG/PNG, local `tikztosvg` SVG/PNG, MacTeX PNG, and visual comparison
have all been reviewed.

Generated QA artifacts live under `outputs/qa/` and are intentionally not
tracked by Git.

| # | Case | Status | Visual review | Focused test | QA artifacts |
| ---: | --- | --- | --- | --- | --- |
| 1 | `latex-examples-2048` | Accepted 2026-09-05 | Canvas, 4x4 geometry, 1 mm gaps, 0.3 mm corners, colors, text centers, font sizes, and background paint order match. Remaining pixel differences are text rasterization only. | `test/case-by-case-acceptance.test.js` | `outputs/qa/2026-09-05-case-by-case-001-2048/` |
| 2 | `latex-examples-2d-chi-squared-cdf` | Accepted 2026-09-05 | Six clipped CDF curves, cycle colors/dashes, middle axes, ticks/grid, title, labels, and legend match. TikZKit PNG rounds to one extra pixel in each dimension. | `test/case-by-case-acceptance.test.js` | `outputs/qa/2026-09-05-case-by-case-002-chi-cdf-before/` |
| 3 | `latex-examples-2d-chi-squared-pdf` | Accepted 2026-09-05 | Six PDF curves, clipped singular branch, cycle colors/dashes, middle axes, ticks/grid, title, labels, and legend match. TikZKit PNG rounds to one extra pixel in each dimension. | `test/case-by-case-acceptance.test.js` | `outputs/qa/2026-09-05-case-by-case-003-chi-pdf-before/` |
| 4 | `latex-examples-2d-epochs-overfitting` | Accepted 2026-09-05 | Four curve segments and their join at epoch 50, line styles, split marker, path text, large arrow, middle axes, labels, legend, and major/minor ticks match. The 1-3 px canvas difference is outer text/baseline rounding. | `test/case-by-case-acceptance.test.js` | `outputs/qa/2026-09-05-case-by-case-004-epochs-before/` |
| 5 | `latex-examples-2d-light-bulb` | Accepted 2026-09-05 | Three reciprocal curves, clipping, colors/dashes, 200 samples each, middle axes, labels, major/minor ticks, and three-row legend match. The 3 px height difference is outer label/baseline rounding. | `test/case-by-case-acceptance.test.js` | `outputs/qa/2026-09-05-case-by-case-005-light-bulb-before/` |
| 6 | `latex-examples-2d-parted-function` | Accepted 2026-09-05 | Six independently sampled domains, all five visible joins, colors, widths, orange zero segments, enlarged limits, grid, ticks, and middle axes match. Canvas width rounds by 1 px. | `test/case-by-case-acceptance.test.js` | `outputs/qa/2026-09-05-case-by-case-006-parted-before/` |
| 7 | `latex-examples-2d-x-square-with-circle` | Accepted 2026-09-05 | The 50-sample parabola, low-level PGF ellipse center and unequal canvas radii, clipping, grid, enlarged limits, ticks, and middle axes match. Canvas width rounds by 1 px. | `test/case-by-case-acceptance.test.js` | `outputs/qa/2026-09-05-case-by-case-007-x-square-before/` |
| 8 | `latex-examples-3d-cmos-loss-diagram` | Accepted 2026-09-05 | The 46x46 sampled surface, 45x45 facets, opacity, white-to-orange map, log-frequency axis, 3D projection, grids, ticks, and labels match MacTeX. Local `tikztosvg` has the smaller outer canvas in this case. | `test/case-by-case-acceptance.test.js` | `outputs/qa/2026-09-05-case-by-case-008-cmos-before/` |
| 9 | `latex-examples-3d-function-2` | Accepted 2026-09-05 | The 56x56 quadratic sample lattice, 55x55 faceted cells, white-to-orange map, 340/25 view, background 3D box/grid/ticks, labels, and quarter-height colorbar match MacTeX and local `tikztosvg`. TikZKit is 5 px narrower after rasterization because of outer text/crop bounds; the plotted geometry is aligned. | `test/case-by-case-acceptance.test.js` | `outputs/qa/2026-09-05-case-by-case-009-function-2-before/` |
| 10 | `latex-examples-3d-function-3` | Accepted 2026-09-05 | The rational saddle's four signed branches and central singularity, 56x56 lattice, faceted cells, 10/65 view, 3D box/grid/ticks/labels, and -1..1 colorbar match both local references. TikZKit raster width differs by 1 px. | `test/case-by-case-acceptance.test.js` | `outputs/qa/2026-09-05-case-by-case-010-function-3-before/` |
| 11 | `latex-examples-3d-function-4` | Accepted 2026-09-05 | The normalized saddle, center cusp, 56x56 sampling, 10/65 projection, faceted shading, background 3D box/grid/ticks, labels, and -5..5 colorbar match both local references. Raster bounds differ by 1 px per axis. | `test/case-by-case-acceptance.test.js` | `outputs/qa/2026-09-05-case-by-case-011-function-4-before/` |
| 12 | `latex-examples-3d-function-5` | Accepted 2026-09-05 | The radial cone, 56x56 sampling, 65/35 projection, 55x55 facets, background 3D box/grid/ticks, labels, and 0..7 colorbar match MacTeX/tikztosvg. The 5x9 px raster-size residual is confined to outer text/crop bounds. | `test/case-by-case-acceptance.test.js` | `outputs/qa/2026-09-05-case-by-case-012-function-5-before/` |
| 13 | `latex-examples-3d-function-6` | Accepted 2026-09-05 | The three-lobed rational surface, signed zero crossings, 56x56 sampling, 65/35 projection, background 3D box/grid/ticks, labels, and -5..5 colorbar match MacTeX/tikztosvg. The height residual is outer text/crop only. | `test/case-by-case-acceptance.test.js` | `outputs/qa/2026-09-05-case-by-case-013-function-6-before/` |
| 14 | `latex-examples-3d-function-7` | Accepted 2026-09-05 | The quartic rational surface, asymmetric y-domain, 56x56 mesh, 65/65 projection, background box/grid/ticks, labels, and -1..1 colorbar match both references, including exact 599x457 raster bounds. | `test/case-by-case-acceptance.test.js` | `outputs/qa/2026-09-05-case-by-case-014-function-7-before/` |
| 15 | `latex-examples-3d-function-8` | Accepted 2026-09-05 | The legacy 50x50 PGFPlots sampler, fixed-point trigonometry, radial ripple, 65/65 projection, nine-edge background box/ticks, and scientific colorbar match MacTeX and local `tikztosvg`. All PNGs are exactly 603x469. | `test/case-by-case-acceptance.test.js` | `outputs/qa/2026-09-05-case-by-case-015-function-8-final/` |

## Case 001: 2048

### Source Inventory

- Packages and libraries: `tikz`, `fit`, `backgrounds`.
- Document declarations: `\renewcommand\familydefault{\sfdefault}` and HTML
  `\definecolor` declarations.
- Style features: parameterized `.style`, nested style application,
  `minimum size`, `rounded corners`, `text`, `inner sep`, `font`, `fill`, and
  `node contents`.
- Commands and environments: `tikzpicture`, `\def`, nested `\foreach` with
  `count`, `\path`, named nodes, background-layer `scope`, and `fit` over two
  corner nodes.
- Numeric and dimension semantics: integer loop counters, unary negative
  coordinates, `9mm`, `.3mm`, and `1mm`.

### Oracle Review

- MacTeX uses the `CMSSBX10` Type 1 face for all bold sans-serif digits and
  scales it according to `\Large`, `\large`, and `\normalsize`.
- The local `tikztosvg` output paints the fitted grid background first, then
  sixteen rounded tile paths and centered glyph outlines.
- TikZKit emits the same `116.62pt` square canvas as MacTeX and `tikztosvg`.
  Tile geometry, colors, and text centers match. The remaining diff pixels are
  confined to browser text rasterization versus TeX glyph outlines.

### Unsupported Source Features

None for this fixture.

## Case 007: X-Square With Circle

### Source Inventory

- Packages: `pgfplots` and `tikz`.
- Axis options: middle axes, major dashed grid, explicit x limits, surveyed y
  limits, white background, math labels, outside ticks, negative minor-tick
  count, enlarged limits, and tension.
- Drawing commands: one 50-sample quadratic `\addplot`; a `\draw` containing
  `\pgfextra`; the low-level `\pgfpathellipse` primitive; one translated
  `\pgfplotspointaxisxy` center; and two unshifted
  `\pgfplotspointaxisdirectionxy` radius vectors.

### Oracle Review

- `pgfplots.code.tex` lines 9696-9711 map `\pgfplotspointaxisxy` through the
  complete axis coordinate transform.
- The same file at lines 9741-9742 maps axis-direction points with `noshift`,
  so radii are vectors and do not inherit the plot origin.
- `pgfcorepathconstruct.code.tex` supplies the Bezier ellipse primitive.
  MacTeX and local `tikztosvg` confirm a center at data `(0,1)` and radii of
  `0.87` data units. TikZKit lowers these semantics into the shared axis
  overlay path, yielding the same visibly non-circular canvas ellipse and
  clipping it to the axis rectangle.

### Unsupported Source Features

None for this fixture. The supported `\pgfextra` grammar is intentionally
limited to the low-level path primitive family understood by the axis overlay
lowerer; arbitrary TeX callbacks are not implied.

## Case 008: 3D CMOS Loss Diagram

### Source Inventory

- Packages and libraries: `preview`, `pgfplots`, and the PGFPlots `patchplots`
  library. The preview environment and border affect only native extraction.
- Declaration: a two-stop `whitered` colormap from white to
  `orange!75!red`.
- Axis options: named colormap, 15 cm width, `view={10}{15}`, fixed limits,
  major 3D grid, x domain `1.5:6`, y domain `0:10^9`, logarithmic y axis,
  46 samples in each dimension, and mixed math/plain x/y/z labels.
- Drawing command: one `\addplot3[surf,opacity=0.9]` expression `x*x*y`.
  Patch and colorbar commands are comments and remain inert.

### Oracle Review

- `pgfplotsmeshplothandler.code.tex` lines 139-161 initializes a mesh from
  its surveyed row/column counts and defaults a 3D mesh patch to a rectangle;
  lines 227-345 initialize the shader and color data stream.
- MacTeX produces 45 by 45 faceted cells from the 46 by 46 sample lattice.
  TikZKit emits one fill and one facet stroke per cell, preserving the 0.9
  opacity, projected grid, logarithmic frequency ticks, and labels.
- The local `tikztosvg` reference is about 2 px narrower and 8 px shorter
  than native MacTeX. TikZKit matches the native MacTeX canvas instead, so the
  reference dimension mismatch is not treated as a TikZKit defect.

### Unsupported Source Features

None exercised by this fixture. The loaded `patchplots` library and commented
bilinear patch syntax do not participate in the rendered picture.

## Case 009: 3D Quadratic Function

### Source Inventory

- Packages: `preview` and `pgfplots`. The preview environment and 2 mm border
  affect only the native extraction.
- Declaration: a two-stop `whitered` colormap from white to
  `orange!75!red`.
- Axis options: named colormap, 15 cm width, `view={340}{25}`, no enlarged
  limits, major 3D grid, x/y domains `-5:5`, 56 samples per dimension,
  math x/y/z labels, and a colorbar positioned at `(-0.1,0)` with
  `south west` anchor and one quarter of the parent-axis height.
- Drawing command: one `\addplot3[surf]` expression, `x^2 + y^2`.

### Oracle Review

- `pgfplotscoordprocessing.code.tex` lines 5363-5626 resolves independent x
  and y domains and sample lists for expression plots.
- `pgfplotsmeshplothandler.code.tex` lines 139-173 reads the mesh row and
  column counts, while lines 227-345 initialize the default faceted surface
  shader. A 56 by 56 point lattice therefore produces 55 by 55 rectangular
  facets.
- `pgfplots.scaling.code.tex` lines 1920-2157 derives the projected 2D basis
  from the azimuth and elevation. `pgfplots.code.tex` lines 1117-1237 builds
  the colorbar as a child axis using the surveyed point-meta range, and
  `pgfplotscolormap.code.tex` applies the selected map to each facet.
- MacTeX, local `tikztosvg`, and TikZKit show the same paraboloid, occlusion
  order, facet density, projected box/grid, tick runs, labels, and colorbar.
  TikZKit emits 3,025 fills and 3,025 facet strokes with zero diagnostics.
  The 599x466 TikZKit PNG is 5 px narrower than the 604x466 MacTeX and
  `tikztosvg` PNGs; inspection shows this difference only in outer text/crop
  bounds, not in the plotted geometry.

### Unsupported Source Features

None for this fixture.

## Case 010: 3D Rational Saddle

### Source Inventory

- Packages: `preview` and `pgfplots`; preview contributes only the native crop.
- Declaration: the same two-stop white-to-`orange!75!red` colormap as Case
  009.
- Axis options: 15 cm width, `view={10}{65}`, fixed limits, major grid,
  x/y domains `-5:5`, 56 samples per dimension, x/y/z labels, and the same
  anchored quarter-height colorbar configuration.
- Drawing command: one `\addplot3[surf]` expression,
  `2*x*y/(x*x+y*y)`, whose denominator is singular at the origin.

### Oracle Review

The expression sampler, mesh/shader, 3D projection, colormap, and colorbar
paths reviewed from the local PGFPlots sources for Case 009 apply here. The
56-point grid avoids sampling the origin exactly, so all 3,025 rectangular
facets remain finite while approaching the four signed branches around the
central singularity. MacTeX, local `tikztosvg`, and TikZKit agree on the
branch orientation, occlusion order, mesh density, grid/tick placement,
labels, and `-1` through `1` colorbar. TikZKit emits 3,025 fills and 3,025
facet strokes with zero diagnostics; its 599x465 PNG differs from both local
references only by one pixel in width.

### Unsupported Source Features

None for this fixture.

## Case 011: 3D Normalized Saddle

### Source Inventory

- Packages: `preview` and `pgfplots`; preview affects only native cropping.
- Declaration: the same two-stop `whitered` colormap as Cases 009 and 010.
- Axis options: 15 cm width, `view={10}{65}`, fixed limits, major grid,
  x/y domains `-5:5`, 56 samples per dimension, x/y/z labels, and an anchored
  quarter-height colorbar.
- Drawing command: one `\addplot3[surf]` expression,
  `2*x*y/sqrt(x*x+y*y)`.

### Oracle Review

The same local PGFPlots expression-sampling, mesh/shader, projection,
colormap, and colorbar source paths reviewed for Cases 009 and 010 apply.
Because an even 56-point grid does not include zero, the expression remains
finite at every sampled point while preserving the sharp central transition.
MacTeX, local `tikztosvg`, and TikZKit agree on that transition, all 3,025
facets, occlusion order, projected box/grid, labels, and the `-5,0,5`
colorbar. TikZKit emits 3,025 fills and 3,025 facet strokes with no
diagnostics. Its raster is 599x465 versus 600x464 for both local references,
an outer crop/rounding difference with no displaced plot geometry.

### Unsupported Source Features

None for this fixture.

## Case 012: 3D Radial Cone

### Source Inventory

- Packages: `preview` and `pgfplots`; preview affects only native cropping.
- Declaration: the same two-stop `whitered` colormap as Cases 009-011.
- Axis options: 15 cm width, `view={65}{35}`, fixed limits, major grid,
  x/y domains `-5:5`, 56 samples per dimension, x/y/z labels, and the same
  anchored quarter-height colorbar.
- Drawing command: one `\addplot3[surf]` expression,
  `sqrt(x*x+y*y)`.

### Oracle Review

The local PGFPlots expression-sampling, mesh/shader, projection, colormap,
and colorbar implementations reviewed for Cases 009-011 apply. MacTeX,
local `tikztosvg`, and TikZKit agree on the cone vertex, radial slope,
occlusion order, all 3,025 facets, projected box/grid, labels, and colorbar.
TikZKit emits 3,025 fill paths and 3,025 facet strokes with zero diagnostics.
The TikZKit PNG is 599x457 versus 604x466 for both local references; visual
inspection localizes the residual to outer label/crop bounds rather than a
shift or scale error in the plotted geometry.

### Unsupported Source Features

None for this fixture.

## Case 013: 3D Three-Lobed Rational Surface

### Source Inventory

- Packages: `preview` and `pgfplots`; preview affects only native cropping.
- Declaration: the same two-stop `whitered` colormap as Cases 009-012.
- Axis options: 15 cm width, `view={65}{35}`, fixed limits, major grid,
  x/y domains `-5:5`, 56 samples per dimension, x/y/z labels, and an anchored
  quarter-height colorbar.
- Drawing command: one `\addplot3[surf]` expression,
  `(3*x*x*y-y*y*y)/(x*x+y*y)`.

### Oracle Review

The local PGFPlots expression-sampling, mesh/shader, projection, colormap,
and colorbar implementations reviewed for Cases 009-012 apply. The even
sample count avoids the denominator's zero at the origin while retaining the
three-lobed signed topology. MacTeX, local `tikztosvg`, and TikZKit agree on
the lobe orientation, zero crossings, occlusion order, all 3,025 facets,
projected box/grid, labels, and `-5,0,5` colorbar. TikZKit emits 3,025 fill
paths and 3,025 facet strokes with zero diagnostics. Its 599x457 PNG versus
the references' 604x469 crop differs at outer label bounds; the plotted
surface and axis intersections remain aligned.

### Unsupported Source Features

None for this fixture.

## Case 014: 3D Quartic Rational Surface

### Source Inventory

- Packages: `preview` and `pgfplots`, with compatibility level `1.13`.
- Declaration: the same two-stop `whitered` colormap as Cases 009-013.
- Axis options: 15 cm width, `view={65}{65}`, fixed limits, major grid,
  x domain `-5:5`, deliberately asymmetric y domain `-4.99:5`, 56 samples
  per dimension, x/y/z labels, and an anchored quarter-height colorbar.
- Drawing command: one `\addplot3[surf]` expression,
  `x*y*y*y/(x*x+y*y*y*y)`.

### Oracle Review

The local PGFPlots expression-sampling, mesh/shader, projection, colormap,
and colorbar implementations reviewed for Cases 009-013 apply. The source's
`-4.99` lower y bound avoids a singular sample alignment and is preserved
rather than rounded to `-5`. MacTeX, local `tikztosvg`, and TikZKit agree on
the wave orientation, central transition, occlusion order, all 3,025 facets,
projected box/grid, labels, and `-1,0,1` colorbar. All three PNGs are exactly
599x457, and TikZKit emits no diagnostics.

### Unsupported Source Features

None for this fixture.

## Case 015: Legacy-Sampled Radial Ripple

### Source Inventory

- Packages: `preview` and `pgfplots`; no optional TikZ library is required.
- Declaration: a named two-stop `whitered` colormap using `white` and
  `orange!75!red`.
- Axis options: `colormap name=whitered`, `width=15cm`, `view={65}{65}`,
  `enlargelimits=false`, `grid=major`, x/y domains `-5:5`, `samples=50`,
  x/y/z labels, `colorbar`, and a vertical quarter-height colorbar anchored at
  `(-0.1,0)` with title `$f(x,y)$`.
- Drawing command: one `\addplot3[surf]` expression,
  `(x^2+y^2)*sin(1/(x^2+y^2))`.
- Numeric semantics: the source has no `\pgfplotsset{compat=...}`, so local
  PGFPlots uses the legacy `correct sampling=false` path. The even sample
  count avoids the singular origin.

### Oracle Review

- `pgfplotscoordprocessing.code.tex` and
  `pgfplotsmeshplothandler.code.tex` show that the surface handler constructs
  the first two fixed-point coordinates, derives one step, then repeatedly
  advances through the FPU in legacy mode. The resulting x/y sequence begins
  `-5`, `-4.79593`, `-4.59186` and ends `4.9994292`; direct interpolation is
  reserved for `correct sampling=true`.
- `pgfmathfunctions.trigonometric.code.tex`, `pgflibraryfpu.code.tex`, and
  `pgfplotsutil.code.tex` show that this expression combines FPU arithmetic
  with PGF's fixed-point sine lookup/interpolation. A local TeX probe measured
  the native surface range as `0.0154574141..0.0175601749`.
- `pgfplots.scaling.code.tex`, `pgfplots.code.tex`, and
  `pgfplotscolormap.code.tex` confirm that the surveyed range drives both the
  3D transform and scientific colorbar. TikZKit now shares the same sample
  generator between range survey and mesh construction, so the surface no
  longer crosses the upper frame and the complete `1.55..1.75 x 10^-2`
  colorbar is retained.
- `pgfplots.code.tex` lines 8100-8198 confirm that the default
  `3d box=background` omits the three edges shared by both foreground faces.
  TikZKit now selects nine background edges and their tick runs before the
  surface; only explicit `3d box=complete` or `complete*` requests the three
  complementary foreground edges after the surface.
- Local `tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. The accepted
  artifact directory contains TikZKit SVG/PNG, `tikztosvg` SVG/PNG, MacTeX
  PNG, diffs, and comparison sheets. All three PNGs are 603x469. The reference
  SVG outlines TeX glyphs as paths; TikZKit keeps browser text and emits 4,802
  surface fill paths plus matching facet strokes. Both use a single linear
  gradient, butt line caps, and miter joins. Residual pixels are restricted to
  text rasterization and subpixel stroke antialiasing.

### Unsupported Source Features

None for this fixture. Outside this case, arbitrary FPU programs, complete
PGF math parser parity, every legacy/modern compatibility transition, and the
foreground ticks/grids of `3d box=complete*` remain partial.

## Case 002: Chi-Squared CDF

### Source Inventory

- Packages: `pgfplots`, `tikz`, and `xcolor`; PGFPlots compatibility level
  `1.16`.
- Declarations: four HTML colors and `\pgfplotscreateplotcyclelist` with
  seven color/dash entries.
- Axis options: title, explicit legend position and anchor, middle x/y axes,
  major grid, physical width/height, grid style, numeric domain, restricted y
  domain, white axis background, x/y labels, outside ticks, enlarged limits,
  inherited plot width, and named cycle list selection.
- Plot commands: `\foreach`, `\addplot+`, explicit empty marker, raw gnuplot,
  constant/function assignments, `set xrange`, `set yrange`, `samples=800`,
  incomplete gamma/gamma evaluation, and expanded legend entries.

### Oracle Review

- `pgfplots.code.tex` defines the middle-axis choices, legend style anchors,
  named cycle lists, and domain restriction keys used here.
- `pgfplotscoordprocessing.code.tex` delegates `raw gnuplot` to a sampled
  coordinate table. TikZKit implements the numeric subset in the browser and
  never invokes gnuplot at runtime.
- MacTeX and local `tikztosvg` confirm six unmarked curves, including the
  native y-domain truncation of the first, fifth, and sixth curves. TikZKit
  reproduces their visible endpoints, line widths, cycle colors, dashes,
  labels, and legend samples with zero diagnostics.

### Unsupported Source Features

None for this fixture. Arbitrary raw gnuplot programs remain outside the
library-wide contract, but every statement used by this case is supported.

## Case 003: Chi-Squared PDF

### Source Inventory

Case 003 shares Case 002's package, color, cycle-list, axis, loop, plot, and
legend features. Its raw gnuplot program additionally uses function
definitions, equality and relational operators, logical OR and NOT, a ternary
expression, `int`, `exp`, `log`, and `lgamma`.

### Oracle Review

The same local PGFPlots sources reviewed for Case 002 apply. MacTeX and local
`tikztosvg` confirm that the `k=1` singular branch is clipped to the declared
`0:0.5` y domain while the remaining five branches retain 800 samples.
TikZKit reproduces the six curve shapes, the named cycle list, the empty-mark
override, the labels, and the legend with zero diagnostics.

### Unsupported Source Features

None for this fixture. The browser evaluator supports the raw gnuplot numeric
grammar exercised here; it does not claim to execute arbitrary gnuplot code.

## Case 004: Epochs Overfitting

### Source Inventory

- Packages and libraries: `pgfplots`, `tikz`, `xcolor`, `positioning`,
  `decorations.text`, and `decorations.pathmorphing`.
- Declarations: two HTML colors and two `\tikzstyle` definitions combining
  color, thickness, sample count, and dashing.
- Axis options: north-east legend, left-aligned legend cells, middle x/y axes,
  major grid, explicit physical size and numeric ranges, white background,
  `xlabel`, `ylabel`, a direct y-label position, outside ticks,
  `minor tick num=-3`, and `tension=0.08`.
- Drawing commands: four sampled `\addplot` expressions, two axis-coordinate
  `\draw` paths, centered `text along path`, a scaled legacy `latex` arrow,
  and two legend entries.

### Oracle Review

- `pgfplots.code.tex` lines 1986-1991 define the north-east legend placement
  and per-cell west anchor used here; its middle-axis handlers define the
  crossing axis arrows and label styles.
- `pgfplotsticks.code.tex` supplies the minor-tick planner. The unusual
  negative value still yields the native between-major-tick pattern rather
  than suppressing ticks.
- `tikzlibrarydecorations.text.code.tex` lines 111-115 make text-along-path
  nodes baseline anchored and transformed; lines 577-583 center the measured
  text by half of the unused decorated path length.
- MacTeX, local `tikztosvg`, and TikZKit all show the same four curve segments,
  continuous joins at epoch 50, split marker, centered annotation, rightward
  arrow, ticks, labels, and two-row legend. Remaining pixels are font
  rasterization and outer-canvas rounding, with no missing geometry.

### Unsupported Source Features

None for this fixture. `decorations.pathmorphing` and `positioning` are loaded
but do not contribute commands or options to this particular picture.

## Case 005: Light-Bulb Amortization

### Source Inventory

- Packages and libraries: `pgfplots`, `tikz`, `xcolor`, `positioning`,
  `decorations.text`, and `decorations.pathmorphing`.
- Declarations: two unused HTML colors and two unused plot styles inherited
  from the source template.
- Axis options: north-east legend, left-aligned cells, middle axes, major grid,
  explicit width/height and ranges, white background, plain and braced labels,
  direct y-label placement, outside ticks, negative minor-tick count, and plot
  tension.
- Drawing commands: three 200-sample reciprocal `\addplot` expressions with
  solid, dashed, and dotted styles, plus three legend entries. All decoration
  drawing commands in the source are comments and therefore have no runtime
  effect.

### Oracle Review

The same local `pgfplots.code.tex` legend and middle-axis handlers and
`pgfplotsticks.code.tex` tick planner reviewed for Case 004 apply. MacTeX and
local `tikztosvg` confirm that the three curves start at the visible y-domain
boundary and decay to the same endpoints. TikZKit matches those shapes,
colors, dash patterns, ticks, labels, and legend with zero diagnostics.

### Unsupported Source Features

None for this fixture. Loaded positioning and decoration libraries, declared
colors, and template styles that are never referenced are correctly inert.

## Case 006: Parted Function

### Source Inventory

- Packages: `pgfplots` and `tikz`.
- Axis options: south-west legend placement, middle axes, major grid and style,
  explicit ranges, white background, math x/y labels, outside ticks, negative
  minor-tick count, enlarged limits, and tension.
- Drawing commands: six expression-based `\addplot` calls with domains
  `0:1`, `1:2`, `2:3`, `3:5`, `5:7`, and `-3:0`; sample counts 20, 20, 500,
  20, 3, and 3; five colors and a common thick stroke.
- Three legend entries exist only as comments and must stay inert.

### Oracle Review

`pgfplotscoordprocessing.code.tex` performs the domain survey and emits each
sample stream independently, while `pgfplots.code.tex` applies enlarged axis
limits after the surveyed ranges are known. MacTeX and local `tikztosvg`
confirm exact joins at the five piece boundaries, the same parabolic/linear
shape, and orange zero extensions. TikZKit reproduces the complete geometry
and axis presentation with zero diagnostics.

### Unsupported Source Features

None for this fixture.
