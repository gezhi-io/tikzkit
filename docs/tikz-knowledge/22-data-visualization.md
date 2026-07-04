# Data Visualization

Source studied:

- User-provided manual excerpt: `79 Introduction to Data Visualization`.
- TeX Live frontend: `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.code.tex`.
- TeX Live function data format: `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/datavisualization/pgflibrarydatavisualization.formats.functions.code.tex`.
- TeX Live TikZ wrapper: `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.formats.functions.code.tex`.
- TeX Live datavisualization module: `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledatavisualization.code.tex`.
- TeX Live datavisualization style sheet documentation: `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-dv-stylesheets.tex`.
- TeX Live PGF math parser: `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/math/pgfmathparser.code.tex`.
- TeX Live PGF random functions: `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/math/pgfmathfunctions.random.code.tex`.
- TeX Live PGF math misc/comparison functions: `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/math/pgfmathfunctions.misc.code.tex` and `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/math/pgfmathfunctions.comparison.code.tex`.

## Core Model

PGF datavisualization is not just `plot` syntax. It is a pipeline:

1. Raw input is read into data points. A data point is the current set of `/data point/...` keys.
2. The pipeline runs survey phases to collect ranges, min/max values, and layout information.
3. The visualization phase renders data through visualizer objects such as line visualizers, scatter visualizers, axes, ticks, legends, and label visualizers.
4. Frontend styles like `school book axes` and `scientific axes` install preconfigured axis systems and visualization objects.

This matters for TikZKit because a simple lowering to `pgfplots` can show a picture, but it cannot be treated as a complete datavisualization implementation. Axis sizing, pin placement, legend examples, and labels come from the frontend pipeline.

## TeX Live Findings

### `datavisualization.formats.functions`

The frontend file only loads the base datavisualization library and the generic PGF function format library:

```tex
\usetikzlibrary{datavisualization}
\usepgflibrary{datavisualization.formats.functions}
```

The generic function format parser supports:

- `var <name> : interval [<start>:<end>] samples <n>;`
- `var <name> : interval [<start>:<end>] step <step>;`
- `var <name> : {a,b,c};`
- `func <name> = <expression>;`
- Multiple variables, producing a Cartesian product of data points.
- `\value <name>` in function expressions.
- `/pgf/data/samples`, `/pgf/data/vars`, `/pgf/data/funcs`, and `/pgf/data/evaluator`.

The function parser appends evaluator callbacks in source order. This matters:
`func y = rand; func x = rand;` consumes random values in that order, not in a
fixed x-then-y order. TikZKit preserves this function declaration order.

The datavisualization module runs at least two data passes for normal rendering:
the survey phase installs `\pgfdatapoint@surveyphase` to collect bounds and
layout, then the visualization phase installs `\pgfdatapoint@visualizationphase`
to draw. Random-valued function data is evaluated in both phases with the same
continuing PGF random generator state. In the manual Gaussian/scatter example,
the first 20 random sums are only survey data; the rendered scatter marks use
the second pass. TikZKit now samples function data once for survey/ranges and
again for rendering, matching local MacTeX/tikztosvg for seeded `rand` cases.

### Scientific Axes

`scientific axes` is a fixed-size axis system:

- default width: `5cm`
- default height: `0.618 * width`
- `outer ticks` are part of the default setup
- axes, ticks, and grid use black at reduced intensity
- data is scaled to fit the fixed rectangle

`school book axes` is different: it uses 1 TikZ unit per centimeter by default and arrowed axes through the origin.

### Visualizers

`visualize as smooth line` creates a line visualizer with:

- `every path/.style={draw}`
- `semithick`
- `color=visualizer color`
- `mark=none`
- smooth plot handler
- legend entry example support

`visualize as scatter` creates a mark-only visualizer with:

- default `mark=x`
- default `mark size=2pt`
- mark rendering through `\tikz@dv@plot@mark@maker`
- legend entry example support

Important lowering rule: when TikZKit translates datavisualization scatter
visualizers to the current PGFPlots-compatible subset, a bare visualizer style
color such as `style={red, mark=x}` must not be passed through as the PGFPlots
mark draw color. Doing so turns the marks red, while the current tikztosvg
reference for `datavisualization-006` keeps the scatter marks and legend mark
black. TikZKit now keeps native scatter marks black by default and only changes
the mark color for explicit mark-color-style options.

Tick labels in datavisualization are not the same as TikZKit's old generic
PGFPlots fallback. TeX Live defines `every ticks` with `font=\footnotesize`.
Outside legend labels are not forced to `scriptsize`; the default
`every label in legend` only clears the fill. Inside legends separately use
`footnotesize`.

Named tick density options are also step strategies, not literal tick counts.
In `tikzlibrarydatavisualization.code.tex`, `few`, `some`, and `many` map to
`about=3`, `about=5`, and `about=10`. The linear about mapper divides the data
range by the requested count and then snaps the step with the standard strategy
`1.5/1.0, 2.3/2.0, 4/2.5, 7/5, 11/10`. For a `[-1,1]` data range, `ticks=few`
therefore produces a `0.5` step and visible ticks at `-1,-0.5,0,0.5,1`. TikZKit
implements this about-step path and snaps near-boundary floating errors from
function sampling back onto the selected step boundary.

Major ticks and major grid lines also keep TikZ's normal `thin` stroke width.
The relevant TeX Live defaults are:

```tex
every major ticks/.style={style={line cap=round},tick length=2pt}
every major grid/.style={style={solid, help lines,thin,black!25}}
```

For TikZKit this means datavis grids and tick marks should not use the older
hairline `0.12pt` fallback. `school book axes` ticks are drawn on the crossing
axes in black, while grid lines stay `black!25`.

Line visualizers also have native legend examples. In TeX Live, the default
`label in legend` path for a line visualizer uses the `zig zag label in legend
line` style rather than a straight sample line. The sample path is defined in
`tikzlibrarydatavisualization.code.tex` as a short four-point path using `em`
and `ex` offsets. TikZKit approximates this as a four-point zig-zag path in
axis-description coordinates.

TeX Live declares visualizer style sheets in
`tikzlibrarydatavisualization.code.tex`. Important line-visualizer sheets:

```tex
\pgfdvdeclarestylesheet{strong colors}{...}
\pgfdvdeclarestylesheet{vary dashing}{...}
\pgfdvdeclarestylesheet{vary thickness}
{
  default style/.style={line width={0.3pt+(#1)*0.2pt}}
}
\pgfdvdeclarestylesheet{vary thickness and dashing}
{
  1/.style=thin,
  2/.style=thick,
  3/.style={dash pattern=on 5\pgflinewidth off 2\pgflinewidth,thin},
  4/.style={dash pattern=on 5\pgflinewidth off 2\pgflinewidth,thick}
  ...
}
\tikzdvdeclarestylesheetcolorseries{vary hue}{hsb}{.4,0.9,0.8}{.213,0,0}
\tikzdvdeclarestylesheetcolorseries{shades of blue}{hsb}{.65,1.4,1}{0,-.4,-.0}
\tikzdvdeclarestylesheetcolorseries{shades of red}{hsb}{0,1.4,1}{0,-.4,-.0}
\tikzdvdeclarestylesheetcolorseries{gray scale}{hsb}{0,0,-.34}{0,0,.34}
```

TikZKit now parses repeated `style sheet=...` options instead of keeping only
the last key. This is required for source such as `style sheet=strong colors,
style sheet=vary thickness`, where color and line width must both survive the
object-style option normalization. The current `vary thickness` lowering uses
the native formula with one-based visualizer indexing, producing `0.5pt`,
`0.7pt`, `0.9pt`, and so on. The downstream PGFPlots-compatible lowering also
treats explicit `line width=<dimension>` as higher priority than shorthand
tokens like `thick`, because source order is lost after options become a map.
The `vary hue` lowering follows the TeX Live color series declaration above:
the visualizer index is one-based, each HSB component is advanced by the
declared step, and overflowing components wrap to their fractional part. This
now supports more than four visualizers instead of repeating a fixed array. For
source/legend order, the first four visible line colors are blue, purple,
orange, and green; the raw SVG path order can look reversed because native
datavisualization writes the top visualizer path first.
The `gray scale` sheet is a color-series stylesheet for black-and-white output.
Local MacTeX output maps the first four source-order line visualizers to
approximately 0%, 34%, 68%, and 2% gray; TikZKit uses the same HSB step-series
for both plot paths and legend examples.
The `shades of blue` and `shades of red` sheets use the same one-based
color-series mechanism with a fixed hue and decreasing saturation. When
saturation becomes negative, xcolor's color series wraps it to the fractional
part, so the sequence alternates between saturated, pale, and wrapped shades
rather than simply fading monotonically.
`vary thickness and dashing` is a separate native style sheet, not the same as
applying both `vary thickness` and `vary dashing`. TeX Live intentionally pairs
thin/thick strokes with repeated dash patterns to avoid very thick late-series
lines. TikZKit implements the first 14 native pairs with `thin=0.4pt`,
`thick=0.8pt`, and dash lengths scaled by the current line width. The web case
`datavisualization-024` checks this against local tikztosvg.

PGF math helpers used by function-format data are partly implemented in the
same expression runtime used by PGFPlots lowering. TeX Live's
`pgfmathfunctions.misc.code.tex` defines `veclen` as a numerically stable
Euclidean 2D vector length and `sinh`/`cosh`/`tanh` from exponentials.
`pgfmathfunctions.comparison.code.tex` defines comparison predicates and
`ifthenelse`. TikZKit maps the browser-side evaluator to `Math.hypot`,
`Math.sinh`, `Math.cosh`, boolean predicates returning `1` or `0`, and
JavaScript conditional selection. The web case `datavisualization-025` checks
`veclen(\value x,2)+ifthenelse(\value x>1,1,0)+sinh(0)+cosh(0)-1`.

Line legend examples are not straight polylines in native output. The frontend
generates a small smooth sample path next to the legend label. TikZKit now
keeps the native sample span at roughly `0.526cm..1.229cm` past the axis right
edge and lowers the sample through cubic Bezier segments. Scatter visualizers
still use mark-only legend examples.

The `cross marks` style sheet is declared in TeX Live as a scatter/mark style
sheet. The first entries are `mark=x`, `mark=+`, `mark=Mercedes star`,
`mark=Mercedes star flipped`, `mark=star`, and `mark=10-pointed star`, with
native mark sizes around `2pt`. TikZKit maps visualizer indices to these native
mark names. The renderer must distinguish `mark=+` from `mark=x`: plus marks
are horizontal and vertical strokes, while x marks are diagonal strokes. The
current web case is `datavisualization-027`.

TeX Live also declares three constant circle mark style sheets in the same
source file: `* mark`, `dot mark`, and `o mark`. Their defaults are,
respectively, filled `mark=*` at `1.4pt`, filled `mark=*` at `0.6pt`, and
unfilled `mark=o` at `1.4pt`. TikZKit maps these style sheets before the
scatter fallback mark is chosen, so they override the native scatter default
`mark=x` while still allowing an explicit visualizer `style={mark=...}` to win.
The web case `datavisualization-054` compares the three marker sizes/fills
against local `tikztosvg`.

### Polar Axes

Section 85 loads the TikZ frontend library `datavisualization.polar`, which in
turn loads the generic PGF polar datavisualization library. The local sources
reviewed for the focused web slice are:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.polar.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/datavisualization/pgflibrarydatavisualization.polar.code.tex`

The important design point is that this is not the PGFPlots `polaraxis`
environment. Native datavisualization polar axes create an `angle axis` and a
`radius axis`, then the visualizers consume data point attributes named
`angle` and `radius`. `scientific polar axes` installs a default radius length
of `3.25cm`; `scientific polar axes={0 to pi, clean}` configures a half-plane
angle axis from `0` to `pi`, a radius axis from zero, clean boundary drawing,
and polar grid/tick setup.

TikZKit implements this as a focused lowering step before the normal PGFPlots
fallback: function-format points keep arbitrary attributes, `angle` and
`radius` are projected into ordinary TikZ coordinates, and the renderer emits
grid arcs, radial grid rays, plot paths, and a below legend. The current web
case is `datavisualization-026`.

For `legend=below`, TeX Live maps the placement to `south outside`, which sets
`rows=1`; polar legend entries therefore share one visual row instead of being
stacked vertically. Smooth-line polar legend samples also use the same
`default label in legend path` concept as Cartesian datavisualization: a short
curved/zig-zag sample path, not a straight horizontal segment. TikZKit now
reuses the datavis line legend sample geometry for polar legends and places the
row below the radius tick labels. The `south outside` key anchors the legend
matrix below `data visualization bounding box.south` with `yshift=-.5em`, so
the focused `datavisualization-026` lowering places the legend around
`-1.28cm` instead of the earlier `-1.02cm` row that was visibly too high.

The same local source declares `scientific polar axes` with
`every axis/.append style={style={draw=black!50}}` and
`every ticks/.append style={style={draw=black!50}}`. The outer angle-axis arc is
therefore an axis boundary, not a grid line. TikZKit renders that outer polar
boundary with `black!50` while keeping interior polar grid arcs/rays at
`black!25`. Angle tick labels are placed close to that outer arc; a large
manual radial offset makes the labels float too far outside compared with the
native `tick text at high` placement. The current focused lowering keeps the
labels only slightly outside the `3.25cm` outer radius so the `0`, `pi/2`, and
`pi` labels visually track the native outer axis.

For `scientific polar axes={..., clean}`, TeX Live adds `padding=.5em` to the
angle axis and then draws two visually different outer curves: a pale
`black!25` axis/grid curve at `radius=max`, and a darker `black!50` clean
boundary at `radius=padded max`. TikZKit mirrors this split instead of
recoloring the max-radius grid arc as the outer boundary.

The Section 85 scatter examples show that `radius axis={length=1cm}` is the
total physical radius-axis span, not a source-unit length. If the surveyed data
has maximum `radius=1.5`, that maximum maps to the one-centimeter outer radius
and `radius=1` lands at two thirds of that span. TikZKit preserves numeric
`angle`/`radius` attributes from explicit `data point` streams and maps them
through the surveyed radius maximum unless an explicit `max value` overrides
it. The web cases `datavisualization-073` and `datavisualization-074` compare
this against local tikztosvg output.

For clean partial polar ranges like `scientific polar axes={clean, 0 to 90}`,
the reference still draws visible radius-axis lines at the range endpoints,
plus radius tick labels on the vertical endpoint axis. There are two endpoint
axis layers: a pale `black!25` radius axis on the real radial line and a darker
`black!50` clean boundary shifted outward by the `.5em` clean padding. TikZKit
now mirrors that two-layer model for the manual scatter examples. The remaining
visible gap is exact TeX label placement and glyph metrics, not the endpoint
axis topology.

The manual's advanced low-level form is
`new polar axes={angle axis}{radius axis}`. Unlike the named scientific ranges,
this does not imply a `0..360` remapping. The generic polar transformer consumes
the already-scaled axis attributes; in the common manual scatter example the
angle data is effectively interpreted as degrees and the radius axis maps
`radius={0,...,5}` to `radius axis={length=2cm}`. TikZKit now treats this
low-level path as direct-degree mapping unless the active angle axis asks for
`radians` or an explicit fixed range, and it supports the native
`data [format=named] { angle={...}, radius={...} }` cartesian list expansion.
`visualize as scatter` must stay mark-only; rendering a connected path through
the polar scatter points is visually wrong.

Section 85's non-clean tick placement keys are separate from `grid`. In TeX
Live, `outer ticks` and `inner ticks` both create the polar angle-axis boundary,
radius axes, radius tick labels, and angle tick labels even when
`all axes=grid` is absent. For `0 to 180`, the source sets
`@inner radius axes at={{0}{low},{90}{high},{180}{high}}`, so the picture gets
three radius axes. The tick-placement difference is the angle tick direction:
`outer ticks` extends away from the outer ring, while `inner ticks` turns the
same tick inward. TikZKit therefore renders the non-clean `black!50` outer
angle-axis arc independently of grid lines, emits the focused half-plane radius
axes, draws radius ticks symmetrically across those axes, and uses
`config.tickDirection` to reverse the angle tick segment for `inner ticks`. The
current web cases are `datavisualization-048` and `datavisualization-074`.
The 0-degree radius axis also visibly overlaps two tick-text sources in the
tikztosvg reference: the normal low-side radius-axis labels and a second
high-side layer. TikZKit mirrors that for non-clean half-plane polar axes by
emitting a second label for positive 0-degree radius ticks without duplicating
the tick mark itself.
For non-clean `outer ticks` and `inner ticks`, TeX Live places the angle labels
on the high side close to the tick tip, not at a large extra radial offset.
TikZKit therefore keeps the tick segment direction separate from text
placement and uses a smaller label radius (`outerRadius + 0.12cm`) so the
`30^\circ`/`90^\circ`/`150^\circ` labels align with the tikztosvg reference
instead of floating beyond the half-plane arc.

For small scientific polar examples such as `radius axis={length=1cm}`, the same
fixed centimeter padding is still too large. The native front-end routes tick
text through `visualize ticks={..., major={tick text at high}}`; the generic
`tick text ... padding` keys default to `0pt`, so the placement follows the
axis high/low geometry rather than an extra absolute offset. TikZKit now scales
its remaining tick-label approximation by the physical polar radius, keeping the
manual `3.25cm` examples stable while moving `datavisualization-073` and
`datavisualization-074` labels closer to tikztosvg.

Follow-up for the Section 85 one-centimeter clean quadrant (`0 to 90`) example:
the TeX Live source sets both `angle axis={padding=.5em}` and
`visualize ticks={..., major={tick text at high}}`. The tick coordinate is
therefore on the padded high side of the angle axis object, not directly on the
visible max-radius grid arc. TikZKit now gives small clean polar axes a focused
`0.18cm` high-side angle-label offset; this moves the `30^\circ`, `60^\circ`,
and `90^\circ` labels outside the padded quadrant boundary while leaving the
larger clean half-plane calibration untouched.
The same source also shows that clean polar angle ticks start at the padded
boundary and extend outward by the native `2pt` tick length. They do not
straddle the padded boundary. TikZKit mirrors that for clean polar axes, which
keeps `datavisualization-073`'s 0/30/60/90 degree tick marks aligned with the
tikztosvg reference.

The clean-quadrant `90^\circ` case exposed a second, renderer-independent
metric problem. Its generated polar coordinate was already near native output,
but the interpreter estimated the math-only tick label as an ordinary node with
default `.3333em` inner sep, so the `anchor=south` center jumped too far above
the arc. Axis tick labels that are pure math now use compact inner-sep metrics
unless the source explicitly sets `inner sep`; this keeps ordinary nodes and
plain numeric tick labels unchanged while moving degree labels closer to
tikztosvg.

For the larger clean half-plane example `scientific polar axes={0 to pi,
clean}`, the important native detail is `tick text at high`. The angle tick
coordinate is on `radius axis={goto=padded max}`, but the tick text is still
placed on the high side of that axis object. TikZKit therefore adds a small
scaled clean angle-label offset beyond the padded boundary. This is intentionally
much smaller than the old fixed centimeter padding: it moves the `\frac12\pi`
label in `datavisualization-026` to the outer-arc neighborhood while keeping the
one-centimeter Section 85 scatter examples from drifting outward.

Implemented in this slice:

- `\usetikzlibrary{datavisualization.polar}`
- `scientific polar axes={0 to pi, clean}`
- `new polar axes={angle axis}{radius axis}`
- `all axes=grid`
- `angle` / `radius` function-format data attributes
- `data [format=named]` attribute lists and `a,b,...,z` range expansion
- explicit `data point [angle=..., radius=...]` streams for scientific polar scatter
- braced `\value{angle}` and no-space radian suffix `r`
- `visualize as smooth line=<name>` with legend labels
- `visualize as scatter` as mark-only output for low-level and focused scientific polar examples
- fixed common angle ranges such as `0 to pi`, `0 to 2pi`, `-pi to pi`, and degree variants
- degree tick suffixes as math labels such as `$30^\circ$`
- non-clean `scientific polar axes={outer ticks|inner ticks, ...}` angle-axis arc, focused half-plane radius axes, tick labels, and tick direction
- non-clean half-plane 0-degree radius-axis high-side duplicate tick text for the tikztosvg-visible overlapping label layer

Still missing:

- exact TeX glyph metrics and some radius tick label placement details
- exact clean-axis radius-axis line placement for quadrant examples
- arbitrary custom angle-axis mappings beyond direct degrees, radians, and the current fixed named ranges
- logarithmic/custom radius axes
- the complete native datavisualization object/signal pipeline

### Pin In Data

`pin in data` is implemented as a label visualizer plus an appended edge:

```tex
(\tikzlastnode) edge [solid, every pin edge] (label visualizer coordinate)
```

The label is shifted from the data point. If no direction is specified, PGF computes a normal direction from nearby label visualizer coordinates. TikZKit currently uses an approximate offset and a simple leader line.

The shift distance is TikZ's `pin distance`, whose core default is `3ex`; this
is a screen-space distance, not a data-coordinate distance. TikZKit therefore
converts the normal offset through the current axis width/height and data range
before writing the lowered `axis cs` coordinate. Because the visible native edge
starts from the label node border rather than a raw shifted coordinate, TikZKit
uses a tuned visible edge distance for automatic normals and keeps the full
`3ex` distance for near-horizontal normals. Pin labels use the native label
visualizer font size; they are not forced to `\scriptsize`.

The native `pin in data` label is not just placed at the end of that `3ex`
vector. TeX Live creates a path from `label visualizer coordinate'` to
`label visualizer coordinate` and then places `node[auto, at end]`, so the
visible label/edge endpoint also includes node side placement and text padding.
TikZKit now approximates that extra side placement with an `em`-scaled
screen-space x offset plus a small screen-space y offset in addition to the
normal `3ex` shift. Upward pins use a compact `0.08cm` offset, while `text'`
downward pins use a larger downward offset so formula labels sit below the
leader endpoint like the TeX output. The leader endpoint stays on
`label visualizer coordinate`, while the text node center is placed separately
to mimic `node[auto, at end]`. This visibly improves cases such as
`datavisualization-007`, where the old output placed the pin label too high
above the leader endpoint.

For `school book axes`, label visualizer overlays must be allowed to overflow
the data range. TikZKit now lets `axis pin edge` and `axis label` coordinates
escape the normal axis-coordinate clamp, and uses a focused school-book pin
calibration so `datavisualization-078` matches the local `tikztosvg` leader
coordinate for `pin in data={text=$f$,when=x is 2}`. This is intentionally
scoped to datavisualization overlays; data plots themselves still clip to the
axis range unless a specific visualizer such as candlesticks requires overflow.

The edge's data-side endpoint follows the native label visualizer threshold
behavior: for `when=x is <target>`, it attaches to the first sampled point after
the source-ordered data stream crosses the target value. If the target lands
exactly on a sample, the next sample is used. This matters for sparse function
samples such as `datavisualization-001`, where attaching to the nearest point's
next sample moves the pin too far along a steep curve.

Repeated `pin in data` keys on a single visualizer accumulate just like
repeated `label in data` keys. TeX Live implements both through `new label
visualizer`, so each key creates a separate label overlay. TikZKit mirrors that
for focused Cartesian function data by storing `pins[]` and rendering one
leader edge plus one label node per entry; `datavisualization-098` covers this.

### Plain Label In Data

The native `label in data={text={...},when=x is <target>}` path uses the same
label visualizer object without the extra pin edge. It places a node with
`auto, at end` on the short path from `label visualizer coordinate'` to
`label visualizer coordinate`.

TikZKit supports the focused function-data form with `text` or `text'` and
numeric `when=<attribute> is <number>`, `index=<n>`, `pos=<fraction>`, and
the default Section 84 `auto` selector. The `index` selector follows the TeX
Live count object semantics: the first visible data point has count `1`, and
`pos` selects by `fraction * max(count)`. Native `auto` is applied implicitly
by `label in data`; TikZKit mirrors the documented placement fraction
`(visualizer order - 0.5) / total visualizers`, using the declared visualizer
count from the current `visualize as ...` options. It finds the selected
sampled data point, estimates the local tangent from neighboring samples, and
converts a small screen-space `auto` offset through the current axis scale
before emitting an overlay node in `axis cs` coordinates. For plain in-data
labels, the current focused normal offset is `0.14cm`, followed by a
`0.35em` physical leftward center compensation that approximates TikZ's
`node[auto, at end]` anchor choice for left-to-right data paths; this was
calibrated against
local `tikztosvg` for `datavisualization-092`, where the old larger offset put
the default `2x`, `x^2`, and `x^3` labels visibly too high/right. TeX Live
also routes these labels through `every data set label`, whose default node
style uses `\small`; TikZKit now emits `font=\small` for plain
`label in data` nodes so the formula labels in `datavisualization-092` no
longer render at ordinary node size. This covers simple data labels such as
`datavisualization-022`,
`datavisualization-090`, `datavisualization-091`, and `datavisualization-092`;
it is not yet the full native label visualizer object pipeline or exact TeX
baseline model.

### Rectangle Visualizers

The core datavisualization library defines `visualize as rectangles`. The PGF
object class reads two attribute names from `/data point/<visualizer>/attribute 1`
and `/data point/<visualizer>/attribute 2`; by default these are `x` and `y`.
During survey it requests subattributes `/min` and `/max` for both attributes.
During visualization it draws a closed path from `(x/min,y/min)` to
`(x/min,y/max)` to `(x/max,y/max)` to `(x/max,y/min)`.

TikZKit supports the focused table-data form whose header row contains
`x/min x/max y/min y/max`. Each row becomes an `axis rectangle` path in the
lowered axis. It also supports focused rectangle visualizer lists plus
`attribute 1=<name>` / `attribute 2=<name>` remapping when the cartesian axes
declare matching `attribute=<name>` options; `datavisualization-061` covers
`temp/min temp/max load/min load/max`. Rectangle legend samples now use the
native default `label in legend rectangle coordinates`
`(-1ex,-.5ex),(-1ex,0.968ex),(0ex,0.968ex),(0ex,-.5ex)`. The remaining gap is
the full native object/signal pipeline and arbitrary custom rectangle legend
strategies.

### Legend Placement

`legend={south east outside}` maps to:

- one legend column
- `at={([xshift=.8em]data visualization bounding box.south east |- data bounding box.south)}`
- `anchor=south west`

Legend entries are not just text. They use a rendered visualizer example plus the label text.
When TikZKit lowers legend labels to west/east anchored SVG text, the anchor
must also be reflected in `computeBounds`. A west-anchored label's `x` is its
left edge, not its center; otherwise long entries such as
`datavisualization-016`'s `1 cm per decade` are clipped from the generated SVG
viewBox.

The same west/east anchor rule applies even when the legend label is pure math
such as `$\\sin x$`. TeX Live's `text right` legend style uses
`anchor=mid west`, `inner xsep=0pt`, and `xshift=.333em`; the visualizer example
is drawn in the node's local coordinate system. If the SVG-text math renderer
falls back to a centered `<text>` element, the label position depends on
TikZKit's estimated formula width instead of the native TikZ anchor. TikZKit's
math fallback therefore preserves `svgTextAnchor` and `svgTextX` for plain
math text nodes used by datavisualization legends.

Datavisualization labels also expose SVG-text math spacing errors because they
are placed next to plotted geometry. For formulas such as
`$e^{-x/2}\sin x$`, TeX treats `\sin` as a named operator and inserts a visible
math-space after the preceding scripted atom. TikZKit approximates this with a
`0.16em` SVG `dx` before named operators that follow a scripted atom; the old
`0.08em` spacing made `datavisualization-007` visibly too tight compared with
local tikztosvg output.

## TikZKit Current Implementation

Current module:

- `src/libraries/datavisualization.formats.functions.js`
- `src/preprocess.js:expandDatavisualizationFunctions`
- `web/image-diff.py`

Current strategy:

- Focused partial implementation.
- Parse supported datavisualization syntax.
- Lower supported function data and visualizers into the existing PGFPlots-compatible axis/addplot subset.
- Render JS SVG and tikztosvg SVG side by side in the web test page.
- Generate `js-normalized.png` and `tikztosvg-normalized.png` for each web
  case after `web:output`. Both are rasterized from single-SVG physical-scale
  wrappers, so they use the same `px/cm` before any pixel comparison.
- Generate `image-diff.png` and `imageDiffMetrics` for each web case after
  `web:output`. This is a raw PNG left/top alignment diff between the
  normalized PNGs, not between the renderer-native PNG sizes.
- Generate `image-diff-aligned.png` and `alignedImageDiffMetrics` for each web
  case after `web:output`. This uses a bounded integer translation search before
  computing the PNG diff, so viewBox/bbox origin drift does not dominate the
  visual signal.

Diff artifact limitation: raw PNG diff is useful for detecting bbox/cropping,
large position drift, missing elements, and font-size changes, but it still
counts origin differences as pixel changes. Visual acceptance still requires
looking at the physical-scale sheet. Aligned diff reduces translation noise, but
it is still only a translation alignment; rotation, data-coordinate mapping, and
TeX text layout differences still need visual review against the side-by-side
sheet.

## Current Case Coverage

Focused web cases:

- `datavisualization-001`: function-format Gaussian plus scatter legend with
  random values.
- `datavisualization-002`: `visualize as smooth line/.list` with strong colors
  and varied dashing.
- `datavisualization-003`: table data routed through named line/scatter
  visualizers.
- `datavisualization-004`: line visualizer with `no lines` mark-only mode.
- `datavisualization-005`: school-book axes with explicit tick/grid controls.
- `datavisualization-006`: mixed table line/scatter visualizers.
- `datavisualization-007`: function visualizer with `pin in data`.
- `datavisualization-008`: source-ordered `rand` survey/visualization probe.
- `datavisualization-009`: two line visualizers driven by table data.
- `datavisualization-010`: two scatter visualizers driven by table data.
- `datavisualization-011`: explicit axis lengths with a function visualizer.
- `datavisualization-012`: `x axis={label=...}` / `y axis={label=...}`
  with scientific clean axes.
- `datavisualization-013`: `scientific axes={clean,end labels}` with
  x/y axis labels placed at the positive axis ends.
- `datavisualization-014`: `scientific axes={clean,upright labels}` with an
  unrotated y-axis label aligned near the west side of the data bounding box.
- `datavisualization-015`: `x axis={logarithmic,...}` with decade-spaced x
  coordinates and power-of-ten major ticks.
- `datavisualization-016`: `x axis={logarithmic,power unit length=1cm,...}`
  where each decade consumes one physical centimeter.
- `datavisualization-017`: four named smooth-line visualizers with
  `legend={below, rows=2}` and a two-row legend matrix approximation below the
  plot.
- `datavisualization-018`: repeated `style sheet=strong colors` plus
  `style sheet=vary thickness`, checking that color cycling and increasing
  line widths both survive lowering.
- `datavisualization-019`: `style sheet=vary hue`, checking native-like HSB
  color-series assignment in source/legend order.
- `datavisualization-020`: common PGF math functions in function-format data.
- `datavisualization-021`: angle conversion and inverse trigonometric PGF math.
- `datavisualization-022`: plain `label in data` without a pin edge.
- `datavisualization-023`: closed visualizer handlers: `straight cycle`,
  `smooth cycle`, and `polygon`.
- `datavisualization-024`: `style sheet=vary thickness and dashing`, checking
  the independent native thin/thick plus dash-pattern sequence.
- `datavisualization-025`: PGF math `veclen`, `ifthenelse`, `sinh`, and `cosh`
  inside function-format data.
- `datavisualization-026`: `scientific polar axes={0 to pi, clean}` with
  function-format `angle`/`radius` data projected onto a half-plane polar grid.
- `datavisualization-027`: `style sheet=cross marks` with plotmark-like scatter
  marks and matching legend examples.
- `datavisualization-028`: `style sheet=gray scale`, checking native-like
  gray-series assignment for line paths and legend examples.
- `datavisualization-029`: `style sheet=vary hue` with eight line visualizers,
  checking that color-series styles continue instead of repeating after four
  data sets.
- `datavisualization-030`: `style sheet=shades of blue`, checking fixed-hue
  saturation-series colors for plot paths and legend examples.
- `datavisualization-031`: `style sheet=shades of red`, checking the same
  fixed-hue saturation-series behavior for red paths and legend examples.
- `datavisualization-036`: custom
  `/pgf/data visualization/style sheets/traffic light` entries with explicit
  `data point [x=..., y=..., set=...]` streams. This checks the manual Section
  84 mechanism where a style sheet is attached to the set attribute and the
  set value chooses a style entry such as `1/.style={green!50!black}`.
- `datavisualization-037`: the equivalent lower-level key handler
  `/data point/set/.style sheet=traffic light`, which Section 84 documents as
  the general form behind the shorthand `style sheet=traffic light`.
- `datavisualization-038`: `\pgfdvdeclarestylesheet{traffic light}{...}`,
  the manual's convenience wrapper for declaring keys under
  `/pgf/data visualization/style sheets/<name>`.
- `datavisualization-039`: named set remapping with
  `/data point/set/critical/.initial=1` inside a later visualization fed by a
  `data group {lines}` that contains bare `data point [...]` rows. This follows
  the Section 84 example where the `critical` set deliberately reuses the first
  style-sheet entry.
- `datavisualization-058`: Section 84
  `\tikzdvdeclarestylesheetcolorseries{greens}{hsb}{...}{...}`. This follows
  TeX Live's implementation in `tikzlibrarydatavisualization.code.tex`, where
  the command declares a color series and then wraps it as a default style sheet
  using the one-based style-sheet lookup value.
- `datavisualization-052`: `legend=west outside` with scatter legend samples
  mirrored by the native `label style=text left` behavior. The marker origin
  and explicit `(-2em,0)` coordinate are calibrated against local tikztosvg
  output.
- `datavisualization-053`: global
  `legend entry options/default label in legend path/.style=straight label in legend line`,
  checking that line visualizer legend examples use straight samples without
  requiring each `label in legend` to repeat the style.
- `datavisualization-054`: built-in scatter marker style sheets `* mark`,
  `dot mark`, and `o mark`, checking native circle marker size and fill/open
  behavior.
- `datavisualization-055`: Section 84 closed-path legend samples for
  `polygon` and `smooth cycle`, including the native two legend-local mark
  coordinates used by circular closed visualizers.
- `datavisualization-056`: Section 84 `gap circular label in legend line`
  sample for `gap cycle`, including the five-point line/mark legend glyph.
- `datavisualization-057`: Section 82/85-style Cartesian axis attribute
  remapping: `x axis={attribute=angle}` and `y axis={attribute=radius}`
  route numeric function attributes into the plotted x/y coordinates, while
  `minor steps between steps` emits focused minor tick/grid lines and
  `ticks={..., style=...}` colors tick labels.
- `datavisualization-079`: Section 85 scientific polar axes with
  `angle axis={logarithmic,...}`. This checks that angle source values are
  mapped through `log10` before projection, that `major also at/.list` values
  join the angle tick set, that `radius axis={ticks={some,
  style=red!80!black}}` uses native about ticks (`0,2,4,6,8`) and red tick
  labels without recoloring angle labels, and that `minor steps between
  steps=8` produces logarithmic minor angle grid rays plus outer minor tick
  marks.
- `datavisualization-063`: Section 84 legend matrix placement with
  `legend={right then down, columns=2}`. This checks the east-outside legend
  matrix strategy where entries fill horizontally before moving to the next
  row.
- `datavisualization-064`: Section 84 legend matrix placement with
  `legend={right then down, max columns=2}`. This checks that an explicit
  maximum column constraint limits an east-outside legend matrix and wraps the
  next entry back to the first column.
- `datavisualization-067`: Section 84 `legend=north outside` placement. This
  checks that north/above outside legends use a single visual row above the data
  frame instead of falling back to the default east-outside column.
- `datavisualization-069`: Section 82 manual tick/grid placement with
  `major also at={(pi/2) as $\frac{\pi}{2}$}`. This checks additive tick
  positions, custom math tick labels, and the corresponding grid line.
- `datavisualization-070`: Section 82 local tick options with
  `no tick text at=3` and `also at=(pi) as [...] $\pi$`. This checks that the
  tick mark remains while its generated label is hidden, the custom `\pi`
  label appears, and near-boundary sampled function maxima keep the native
  `1` y-axis label.
- `datavisualization-071`: Section 84 legend placement with
  `legend={at values={x=1,y=1}}`. This checks that the legend matrix is centered
  on a data coordinate and uses the native inside-legend opaque background to
  mask plot lines behind the legend.
- `datavisualization-072`: Section 84 legend placement with
  `legend={right of={x=1,y=1}}`. This checks that the legend matrix uses the
  same data-coordinate anchor but attaches its west side to the point.
- `datavisualization-076`: Section 84 label visualizer styling with
  `label in data={..., node style=sloped}`. This checks that a plain data label
  follows the screen-space tangent of the curve instead of staying horizontal.
- `datavisualization-078`: Section 84 data-label color inheritance with
  `every data set label/.append style={text colored}`. This checks that both
  `label in data` and `pin in data` label text inherit the active visualizer
  color while pin leader edges keep their own stroke style.
- `datavisualization-090`: Section 84 `label in data={..., index=3}`. This
  checks TeX Live's visualizer count-object semantics: the first visible data
  point has count `1`, so `index=3` selects the third point before the node
  auto offset is applied.
- `datavisualization-091`: Section 84 `label in data={..., pos=.8}`. This
  checks relative visualizer position selection using `pos * max(count)`, then
  the same label auto-offset path as ordinary in-data labels.
- `datavisualization-092`: Section 84 default `auto` data label placement.
  This checks the native `(visualizer order - 0.5) / total visualizers`
  selector by placing three labels at early, middle, and late positions on
  three declared line visualizers, plus the calibrated plain-label normal
  offset against local `tikztosvg`.
- `datavisualization-097`: Section 84 repeated `label in data` on one
  visualizer. TeX Live's `label in data/.code` creates a new label visualizer
  each time; TikZKit now keeps repeated keys instead of letting the later label
  overwrite the earlier one.
- `datavisualization-098`: Section 84 repeated `pin in data` on one
  visualizer. TeX Live's `pin in data/.code` follows the same new-label
  visualizer pattern as `label in data`; TikZKit now emits multiple pin label
  overlays and separate leader edges instead of keeping only the first one.
- `datavisualization-093`: Section 84 legend matrix node styling. This covers
  `legend={matrix node style={fill=black!25}}`, which TeX Live applies to the
  whole legend matrix node rather than to each label cell. TikZKit lowers this
  to one `axis-legend-background` node behind the legend rows; the focused
  implementation sizes the background from sample width plus estimated TeX
  label width, including named operators such as `\log`.
- `datavisualization-096`: Section 84 legend visualizer styling with
  `visualizer in legend style={...}`. This checks that the legend cell sample
  can be styled independently from the plotted data path.

Primary case: `datavisualization-001 - Function format Gaussian and scatter`.

Implemented commands and parameters:

| Syntax | Status | Notes |
| --- | --- | --- |
| `\usetikzlibrary {datavisualization.formats.functions}` | partial | Whitespace before `{...}` is accepted. Registered as a built-in partial library. |
| `\tikz \datavisualization ... ;` shorthand | partial | Wrapped into a TikZ picture for JS rendering and source-grid injection. For source-grid comparison, datavisualization shorthand drops wrapper-level geometry transforms such as `scale=.55` before injecting the 1cm grid, because native datavisualization scientific axes keep their fixed physical axis size while the grid is only a comparison aid. `datavisualization-043` and `datavisualization-044` cover this. Non-geometry options such as `baseline` remain preserved. |
| `\datavisualization [scientific axes]`, `[scientific axes=clean]`, and `scientific axes={inner ticks}` | partial | Uses `scientific axes` default size `5cm x 3.09cm`; non-clean scientific axes now lower to a visible boxed frame with TeX Live's `draw=black!50` axis/tick styling and unlabeled top/right ticks instead of crossing arrow axes. Default `outer ticks` and explicit `inner ticks` tick directions are both supported. `clean` maps to clean left/bottom axes plus light min/max boundaries. Nested scientific-axis style lists are parsed for `clean`, `inner ticks`, `end labels`, and `upright labels`. |
| `visualize as smooth line=Gaussian` | partial | Generates one smooth line plot. Does not yet implement PGF visualizer objects or visualizer color cycles exactly. |
| `visualize as smooth cycle=<name>` | partial | TeX Live maps this to `visualize as smooth line` plus the `smooth cycle` visualizer option. TikZKit now marks the lowered axis plot as a closed smooth outline and uses cyclic cubic control points. |
| `Gaussian={...}` visualizer options | partial | Supports `pin in data` and focused plain `label in data`; ignores most other visualizer-local options. |
| `pin in data={text={...},when=x is 1}` | partial | Supports `text`, numeric `when=<attribute> is <number>`, `index=<n>`, and `pos=<fraction>` selectors, source-ordered threshold crossing for the edge endpoint when using `when`, approximate automatic normal direction, native-size label text, a separate `node[auto, at end]`-style text-center side offset, and repeated `pin in data` keys as multiple leader-edge overlays. Full label visualizer object routing and all `every pin edge` style interactions are still missing. |
| `label in data={text={...},when=x is 1}` / `pin in data={...}` / `node style=sloped` / `text colored` | partial | Supports plain in-data text labels and pin labels with `text`/`text'`, numeric `when=<attribute> is <number>`, `index=<n>`, `pos=<fraction>`, and default `auto` placement using the native visualizer-order fraction, with an approximate `node[auto, at end]` screen-space offset. Plain labels currently use a focused `0.14cm` normal offset plus a `0.35em` physical center compensation calibrated on `datavisualization-092`, and plain `label in data` nodes inherit the native default `every data set label` `\small` font size. Repeated `label in data` and `pin in data` keys on the same visualizer are preserved as multiple label visualizers, matching TeX Live's `label in data/.code` / `pin in data/.code` behavior; `datavisualization-097` and `datavisualization-098` cover this. `node style=sloped` computes the local curve tangent in screen-space axis units and rotates the label upright along that tangent; `datavisualization-076` covers this focused Section 84 behavior. `text colored` is supported both locally and through `every data set label/.append style={text colored}` for `label in data` and `pin in data`, coloring the label text with the active visualizer color while leaving the pin edge style unchanged. Arbitrary label style routing, exact TeX glyph baselines, and the native label visualizer object graph remain missing. |
| `visualize as rectangles` | partial | Supports table rows with `x/min x/max y/min y/max`, focused `.list` visualizers, `attribute 1` / `attribute 2` remapping against matching axis attributes, visualizer-local stroke styles, labels in legend, and native-sized default rectangle legend samples. Full native object/signal routing, arbitrary custom legend strategies, and all style interactions remain partial. |
| `data [format=function]` | partial | Supports interval variables, grouped numeric variables, source-ordered `func` declarations, two-pass survey/visualization sampling, and multi-variable Cartesian products. It still does not implement the full native object/signal pipeline. |
| `var x : interval [-7:7] samples 51` | implemented | Generates evenly spaced samples, capped for browser safety. |
| `var x : interval [0:1] step .1` | implemented | Generates inclusive step samples and preserves the final endpoint when needed. |
| `var y : {1,2,3}` | implemented for numeric groups | Grouped numeric variables participate in Cartesian product sampling. Textual categories are not implemented. |
| `func y = exp(-\value x*\value x)` | partial | Supports common PGF math-style expressions and `\value <var>`, including `sqrt`, `abs`, `exp`, `ln`, `log`, `log10`, `pow`, `min`, `max`, `floor`, `ceil`, `round`, `int`, `sign`, `mod`, `Mod`, `sinh`, `cosh`, `tanh`, `veclen`, `ifthenelse`, `greater`, `less`, `equal`, `not`, `and`, `or`, `rad`, `deg`, `asin`, `acos`, `atan`, and `atan2`. This is still a focused evaluator, not the full PGF math parser. |
| `visualize as scatter` | partial | Generates mark-only points. |
| visualizer options `straight cycle`, `smooth cycle`, `polygon` | partial | TeX Live defines `straight cycle` as `\pgfplothandlerpolygon`, `smooth cycle` as `\pgfplothandlerclosedcurve`, and `polygon` as an alias for `straight cycle`. TikZKit now closes the plot outline and uses closed legend examples for these visualizers; exact PGF handler tension and closed legend sizing remain approximate. |
| `legend={south east outside}` | partial | Places a manual legend outside the data area. Position is approximate. |
| `legend={below, rows=2}` | partial | Places legend entries below the plot and lays them out with TeX Live's default `down then right` strategy, so `rows=2` produces two visual rows and additional columns. This is still an SVG-coordinate approximation rather than the full native legend matrix object. |
| `legend=north outside` / `legend=above` | partial | Places legend entries above the data frame using TeX Live's `north outside` intent: default `rows=1`, so entries form one horizontal row. `datavisualization-067` covers this focused placement. Exact native matrix width, row baseline, and arbitrary custom anchors remain approximate. |
| `new legend={name}` and `label in legend={..., legend=name}` | partial | TeX Live creates a named legend object and routes each `label in legend` entry to that object through `legend entry options/legend`. TikZKit records the target legend name on each lowered plot and renders independent legend groups, so `upper legend=above` and `lower legend=below` can coexist without sharing one row counter. For school-book axes, named `above`/`below` legends now use a physical outside offset calibrated from TeX Live's `north outside`/`south outside` rules: `.5em` from the data visualization bounding box plus the legend matrix half-height. This moves `datavisualization-077` upper/lower legend baselines close to local tikztosvg while leaving ordinary scientific `legend={below, rows=2}` cases on the existing matrix layout. Exact native matrix dimensions, arbitrary named legend anchors, and the complete PGF legend object pipeline remain partial. |
| `new legend entry={text=..., visualizer in legend={...}}` / `visualizer in legend style={...}` | partial | Section 84's manual legend-entry path is now supported for the documented focused form `new legend entry={text=spacer, visualizer in legend={\draw[solid] (0,0) circle[radius=2pt];}}`. TikZKit preserves option order, inserts the manual entry between neighboring automatic visualizer legend entries, shares the current legend text column, and renders the legend-local circle glyph. `datavisualization-081` covers this. Per-entry `label in legend={..., visualizer in legend style={...}}` now applies the style only to the legend sample, not the data plot; `datavisualization-096` covers a blue curve whose legend sample is red and thicker. Arbitrary `visualizer in legend` TeX code, `setup`, accumulated multi-stage legend styling beyond simple TikZ style options, arbitrary legend-local coordinate transforms, and the full native legend object/survey pipeline remain partial. |
| `legend={right then down, columns=2}` / `legend={right then down, max columns=2}` / `legend={max rows=2}` / `main legend={max rows=2}` | partial | Applies the Section 84 legend matrix strategy for explicit east-outside legends: entries fill one row left-to-right until the requested or maximum column count, then continue on the next row. `main legend={...}` is now treated as a focused main-legend configuration entrypoint in TikZKit, while the web comparison case uses TeX Live's directly compilable `legend={max rows=2}` form. In both forms, `max rows=<n>` fills down each column and starts a new column when the row limit would be exceeded, matching the documented TeX Live behavior. The east-outside matrix layout follows the native matrix model more closely by combining TeX-sized legend sample width, text gap, estimated label width, `column sep=.8em`, and an effective `1.1em` row pitch; this fixes the cramped second column and vertically compressed rows in `datavisualization-063`, `datavisualization-064`, and `datavisualization-075`. `up/left` variants and exact native matrix cell sizing remain approximate. |
| `legend={label style=text left}` | partial | Places legend label text to the left of the visualizer sample using an east-anchored text node and keeps the calibrated native line sample width. `datavisualization-047` covers this manual Section 84 placement mode. `text right` remains the default; arbitrary legend entry options are still partial. |
| `legend={label style=text colored}` | partial | Applies TeX Live's legend entry option `text colored` by setting the legend label text color to the active `visualizer color` while keeping the visualizer sample. `datavisualization-049` covers this Section 84 behavior. This is separate from `text only`, which suppresses samples. |
| `legend={label style={node style=...}}` / `label in legend={..., node style=...}` | partial | Section 84 routes legend label styling through `/tikz/data visualization/every label in legend` and `/tikz/data visualization/legend entry options/node style`. TikZKit now lowers focused global and per-entry node styles such as `draw`, `circle`, and `draw=red` onto the legend text node, and uses compact datavis legend math metrics for framed labels so `$\\log x$` rectangles and `$x/2$` circles match local `tikztosvg` sizing more closely. `datavisualization-086` covers this. Arbitrary node-style hooks, exact TeX glyph outlines, and full native legend matrix baseline sizing remain partial. |
| `legend={matrix node style={fill=...}}` / `opaque=<color>` / `transparent` | partial | TeX Live appends `matrix node style` to the legend matrix node itself; `opaque` expands to rounded-corner matrix styling with `fill=<color>` and `transparent` expands to `fill=none`. TikZKit now supports focused fill styling by drawing one background node behind the legend matrix rows and using the parsed fill color. `datavisualization-093` calibrates the matrix background's right padding against local `tikztosvg` (`50.5pt`, about `1.78cm` wide for the two-row `\log x` / `x/2` legend). `datavisualization-094` covers `legend={south east inside, opaque=yellow!30}` and `datavisualization-095` covers `legend={south east inside, transparent}`. Exact native matrix dimensions, rounded/outer/inner sep interactions, and arbitrary matrix node styling remain partial. |
| `legend={anchor=..., at=(data visualization bounding box.<anchor>)}` and projected `at=([xshift=.8em]A|-B)` | partial | Section 84 exposes low-level legend matrix placement through `anchor` and `at`; the built-in outside placements are themselves defined as `at=...` plus a matrix anchor. TikZKit now parses focused `at` targets for `data visualization bounding box.*`, `data bounding box.*`, `axis description cs:...`, `visualization cs:...`, and `data cs:...`, plus focused `|-` / `-|` projections with simple `xshift`/`yshift`. It then places legend rows using native-sized `2em` samples, `0.5em` text gap, and `1.1em` row spacing. `datavisualization-087` covers `anchor=north west` at `data visualization bounding box.north east`; `datavisualization-088` covers the TeX Live outer-legend style `([xshift=.8em]data visualization bounding box.north east|- data bounding box.north)`. Arbitrary TikZ calc expressions, exact matrix dimensions, and full legend object routing remain partial. |
| `legend={... inside, label style=text only}` / `legend={at values={...}}` / `legend={right of={...}}` | partial | Supports focused inside placements (`north/south/east/west` plus corner variants) by placing legend entries inside the data frame. `label style=text only` suppresses visualizer samples, colors labels with the visualizer color, uses `\footnotesize`, and follows TeX Live's `every legend inside` model: one rounded legend matrix background is drawn behind all labels instead of separate white boxes on each text node. `south east inside` text-only rows are calibrated against local tikztosvg's `data bounding box.south east` anchor/xshift behavior, so `datavisualization-045` sits in the lower-right data corner instead of floating too high; focused `opaque=<color>` and `transparent` now alter that matrix fill. Data-coordinate placements now map `at values={x=...,y=...}` and `right/left/above/below of={x=...,y=...}` through the axis range into `axis description cs`, then draw the same inside legend matrix background; `datavisualization-071` and `datavisualization-072` cover the focused Section 84 examples. Exact native matrix dimensions, all diagonal variants, arbitrary `text right/left` combinations, and custom matrix styling remain partial. |
| `scatter={style={mark=*,mark size=1.4pt}, label in legend={text={...}}}` | partial | Supports `mark`, `mark size`, text label, and rendered legend examples. Default scatter now follows native `mark=x, mark size=2pt`; for `mark=x`, the rendered diagonal endpoints use `mark size / sqrt(2)` in x/y so the visual half diagonal matches TeX Live's plot mark path. Explicit marker styles still override shape/size. Bare visualizer colors are not treated as mark draw colors in the PGFPlots lowering, so `style={red, mark=x}` keeps black scatter marks like the current tikztosvg reference. |
| scatter legend `label in legend three marks` and `label in legend mark coordinates={...}` | partial | Section 84 defines scatter legend marks through legend-local coordinates: default `one mark` uses `(0,0)` and `three marks` uses `(-3ex,-.3ex),(-1.5ex,.3ex),(0,0)`. TikZKit recognizes direct `label in legend three marks`, focused global `legend entry options/default label in legend mark/.style=label in legend three marks`, and simple explicit coordinate lists such as `label in legend mark coordinates={(-2em,0),(0,0)}` for scatter legend samples. `datavisualization-050` covers three marks, `datavisualization-051` covers explicit coordinates, and `datavisualization-052` covers west-outside text-left mirroring. Exact TeX `em`/`ex` metrics, arbitrary `text left` transforms across every visualizer type, and native matrix legend object routing remain partial. |
| built-in scatter mark style sheets `* mark`, `dot mark`, `o mark` | partial | TeX Live declares these as constant marker sheets: filled `mark=*` at `1.4pt`, filled `mark=*` at `0.6pt`, and open `mark=o` at `1.4pt`. TikZKit applies them through the same style-sheet set lookup used by other datavis sheets and renders `o mark` with `fill=none`. `datavisualization-054` covers the focused comparison. Full mark style routing through arbitrary attributes and all plotmark shapes remains partial. |
| line `label in legend` visualizer examples | partial | Uses a four-point zig-zag legend sample path to approximate TeX Live `zig zag label in legend line`, including the native two zig-zag mark coordinates at `(-1.5em,.3ex)` and `(-.5em,-.3ex)` when the visualizer has marks. Also supports local `straight label in legend line` and global `legend entry options/default label in legend path/.style=straight label in legend line`: the sample is a straight horizontal line and plot marks are placed at the native 25% and 75% positions along the sample. Closed visualizers now use TeX Live's `default label in legend closed path` idea: `polygon`/`smooth cycle` render a circular sample plus two mark coordinates at approximately 120 and -60 degrees. Default outside scientific legend geometry is calibrated from local tikztosvg output with physical TeX offsets rather than proportional axis-description constants: samples start about `1.5em` (`0.526cm`) after the data area, span `2em` (`0.703cm`), and place label text after a further `0.5em`; this keeps short `all axes={length=3cm}` legends from touching the data frame. This physical offset is intentionally scoped to the default outside legend; explicit below, inside, west-outside, and school-book placements keep their own calibrated geometry. School-book axes use a physical right-outside placement so small `[-1,1]` data ranges do not overlap the axis labels. `datavisualization-042` checks local straight-line legend samples, `datavisualization-053` checks the global default path style plus school-book placement, and `datavisualization-055` checks circular closed-path legend examples. Exact `em`/`ex` metrics and native matrix layout are still approximate. |
| visualizer gap handlers | partial | TeX Live maps `gap line` to `\pgfplothandlergaplineto` and `gap cycle` to `\pgfplothandlergapcycle`, with default `gap around stream point=1.5pt`. TikZKit now shortens each mapped axis segment by `1.5pt` at both ends and emits independent subpaths; `gap cycle` also adds a shortened final edge from the last point back to the first. Gap-cycle legends now use a five-point `gap circular label in legend line` approximation with matching mark coordinates. `datavisualization-043`, `datavisualization-044`, and `datavisualization-056` cover the focused manual examples. Exact native gap clipping, arbitrary custom gap distances, and matrix legend sizing are still partial. |
| mixed line/scatter legend rows | partial | Line and scatter visualizers now share one legend row counter, matching the native legend matrix behavior for cases like `datavisualization-006`. Scatter examples use the same row y-position and text x-position as line examples, with the mark centered in the sample column. |
| datavis tick/legend font sizing | partial | Axis tick labels use `\footnotesize`; outside legend labels first inherit `every data set label` and therefore use `\small`, while inside legends may still override labels to `\footnotesize`. Generated negative tick labels use a TeX-like minus glyph. Exact TeX font glyph metrics are still approximated by SVG/KaTeX fallback text. |
| datavis axis labels | partial | `x axis={label=...}` and `y axis={label=...}` are lowered to ordinary axis labels using TeX Live's `every axis label` small-font default. For `scientific axes=clean`, the x-axis label is offset below tick labels so it does not overlap numeric ticks. `scientific axes={clean,end labels}` places x/y labels at the positive axis ends. `scientific axes={clean,upright labels}` keeps the y label unrotated and near the west data bounding box. Custom `visualize label` and arbitrary axis attributes remain missing. |
| datavis major grid/tick stroke width | partial | Major grid, tick, clean-axis, and boundary strokes now use TikZ `thin`/default `0.4pt` semantics instead of the previous `0.12pt` hairline fallback. `school book axes` major tick marks use black strokes, matching TeX Live's crossing-axis tick visualizer more closely. |
| `school book axes` default scale | partial | When no explicit `length`, `unit length`, `width`, or `height` is supplied, the lowered axis now uses a native-like `1cm` per data unit instead of the scientific-axis `5cm x 3.09cm` default. Default school-book ticks use integer major ticks, while explicit `ticks={step=...}` and `all axes={unit length=...}` still override the default. |
| datavis default tick density | partial | Default clean scientific y axes with an approximately `-1:1` range or `0:2` range and no explicit grid use quarter-step ticks, matching local tikztosvg output for multi-visualizer sine/cosine and style-sheet examples. Compact positive clean y ranges up to about `0.4` use `0.1` ticks, matching the Section 84 small-axis legend examples. Scientific x axes over `0:2` now use quarter-step ticks as seen in Section 84 legend examples. Clean single-point scatter plots without explicit grid use only the origin tick label, matching the compact native/tikztosvg single-point legend examples. Non-clean boxed scientific y axes over `0:2` keep half-step major ticks, and the small negative-to-positive logarithmic range in `datavisualization-093` now uses the visible native sequence `−1.5, −1, −0.5, 0, 0.5, 1`. Cases with `y axis=grid` keep the previously calibrated half-step ticks. |
| datavis boxed-axis hidden bounds | partial | Non-clean scientific axes use an invisible `axis bounds` path for source-grid and SVG bbox calculations. TikZKit now uses a focused `0.07cm` top/bottom hidden-bounds margin for boxed datavis axes instead of the generic PGFPlots `0.32cm` container padding. This keeps `datavisualization-093`'s ordinary JS SVG height close to the local `tikztosvg` SVG (`312px` normalized height versus `308px`) and removes the previous vertical alignment shift in the diff sheet. Exact horizontal bbox placement and legend/text glyph metrics remain approximate. |
| datavis non-integer y maxima | partial | Default clean y axes over `0..about 2.6` now use half-step ticks including the native `2.5` label. This fixes style-sheet examples where the top visualizer reaches above 2 but should still show the upper half-step tick like tikztosvg. |
| datavis clean y ticks over `0..6` | partial | Default clean y axes with six-unit positive ranges now use unit ticks (`0,1,2,3,4,5,6`) instead of the generic sparse `0,2,4,6` fallback, matching tikztosvg for multi-dataset color-series examples. Wider ranges such as `0..8` still use coarser major ticks. |
| `ticks=few`, `ticks=some`, `ticks=many`, `ticks={about=<n>}` | partial | Uses TeX Live's standard about-step strategy for linear datavis axes. `datavisualization-023` checks that `all axes={ticks=few}` over a unit range emits half-step ticks, including the snapped `-1` boundary label. Minor/subminor tick variants are still missing. |
| manual ticks `major at`, `also at`, `major also at`, `as <text>`, `no tick text at` | partial | Major tick/grid positions now lower `at` as an override and `also at`/`major also at` as additive ticks, with custom labels preserved in `xticklabels`/`yticklabels`; `datavisualization-069` covers the PGF manual `pi/2` label example, and `datavisualization-070` covers hidden generated tick text plus a custom `\pi` label. Minor/subminor variants, precise repeated-key ordering, and most local per-tick styling options such as exact `tick text padding` geometry remain missing. |
| `x axis={attribute=...}` / `y axis={attribute=...}` / `scaling=... at ... and ... at ...` | partial | Focused Cartesian datavis axes can map numeric point attributes such as `angle`, `radius`, `people`, and `year` to x/y before range survey and plotting. Linear axis scaling maps source intervals to physical target coordinates, uses the target span as axis length, and keeps source tick labels while plotting scaled positions. `datavisualization-057` covers attribute mapping/minor ticks, and `datavisualization-068` covers explicit source-year scaling. Full datavis axis objects, arbitrary attribute routing, nonlinear `function=<code>` scaling, and repeated-key ordering remain missing. |
| `style sheet=vary thickness and dashing` | partial | Implements TeX Live's independent first-14 visualizer sequence: thin/thick solid, thin/thick dashed, thin/thick dotted, and the remaining declared dash pairs, with dash lengths scaled by the active line width. Exact TeX stroke joins and device antialiasing still differ slightly. |
| visualizer option `ignore style sheets` | partial | Section 83 documents this as a per-visualizer option that prevents active style sheets from applying and decrements the native visualizer counter. TikZKit now skips built-in/custom style sheets for the focused visualizer while preserving explicit `style={...}`, and it does not consume the style sequence slot for following visualizers. `datavisualization-089` covers a three-line `strong colors` + `vary dashing` sequence whose middle line is ignored. Full PGF signal/object routing remains partial. |
| color-series style sheets: `vary hue`, `gray scale`, `shades of blue`, `shades of red` | partial | Implements TeX Live's one-based HSB step color-series logic for these four datavisualization sheets, including wrapped overflow channels and more than four visualizers. `datavisualization-028` through `datavisualization-031` compare plot and legend colors against local MacTeX/tikztosvg behavior. Full arbitrary xcolor color models are still missing. |
| custom style sheets via `/pgf/data visualization/style sheets/<name>/<value>/.style={...}` | partial | Recognizes focused `\pgfkeys{ /pgf/data visualization/style sheets/<name>/.cd, <value>/.style={...}, default style/.style={...} }` declarations and applies them when `style sheet=<name>` is attached to the default set attribute. Explicit set names are matched first; otherwise visualizer creation order maps to native one-based `1`, `2`, `3`, ... entries. Full arbitrary `.style sheet` key handlers, attribute remapping, and PGF object styling signals remain missing. |
| `/data point/set/.style sheet=<name>` | partial | Treated as the explicit set-attribute form of `style sheet=<name>`, so custom and built-in style sheets apply to the set attribute through either syntax. Other attributes such as `/data point/code/.style sheet=...` and full attribute-object routing remain missing. |
| `\pgfdvdeclarestylesheet{<name>}{<keys>}` | partial | Expands the focused declaration form into the same custom style sheet registry used by `\pgfkeys{.../.cd,...}`. Supports concrete `<value>/.style={...}` and `default style/.style={...}` entries, including focused parameterized default styles such as `dash pattern={on #1pt off 1pt}` by replacing `#1` with the native one-based style-sheet lookup value. |
| `\tikzdvdeclarestylesheetcolorseries{<name>}{<model>}{<start>}{<step>}` | partial | Supports focused `hsb` and `rgb` color series declarations by applying TeX Live's one-based lookup value to `start + value * step`, then using the generated color as `visualizer color`. `datavisualization-058` covers the Section 84 `greens` example. The full xcolor `\definecolorseries` machinery and non-numeric attribute values are still partial. |
| `/data point/set/<name>/.initial=<value>` | partial | Applies focused set-value remapping before style-sheet lookup. This models TeX Live's visualizer-created `/data point/set/<visualizer>/.initial=<counter>` keys and user overrides such as `critical -> 1`. Only set-attribute remapping is implemented; arbitrary data-point attribute subkeys are still missing. |
| `data point [x=..., y=..., set=...]` streams | partial | Reads explicit datavisualization data point streams into grouped point data so line/scatter visualizers can be driven without `data { ... }` tables or function-format blocks. Data groups can now contain bare `data point [...]` streams. Other data point attributes are preserved as variables only when numeric; arbitrary attributes and object signal hooks are still missing. |
| datavis `logarithmic` axis option | partial | `x axis={logarithmic,...}` / `y axis={logarithmic,...}` lower to the existing log coordinate transform and generate power-of-ten major ticks. `power unit length=<dimension>` now sets the physical length per decade for positive log ranges. This matches the common scientific-axis use case, but not the full native axis mapper, minor/subminor exponential ticks, or arbitrary log scaling functions. |
| `\usetikzlibrary {datavisualization.barcharts}` / `candle stick plot` | partial | TeX Live defines this style as a focused datavis object stack: a `day` counter, y-axis source `dax` with source max `100`, a line transformer that maps `day` to `3mm`, and a `candle stick visualizer` reading `<attribute>/low`, `<attribute>/high`, `<attribute>/entry`, and `<attribute>/exit`. TikZKit now supports the common table form used by `datavisualization-065`: `day` plus `dax/low high entry exit`, `index/source=dax`, compact 3mm-like day spacing, native x-axis baseline tick `0` plus integer candle days, `0..100` y range, separate wick/body paths, white rise bodies, and black fall bodies. The clean x-axis boundary follows the `day * 3mm` transformer; candle body half-width is treated as physical drawing width, not as data-range padding. The focused tikztosvg reference lowering uses clean axes on the data origin with right/top extensions (`maxDay*3mm + 0.18cm`, `sourceMax/100cm + 0.08cm`), short `0.025cm` ticks, and `0.25pt` tick/boundary strokes; TikZKit now mirrors those values for `datavisualization-065`. A later calibration also tightens the invisible clean-axis bbox right edge to the tikztosvg physical bbox and switches generated candle axis tick label nodes to TeX digit metrics with explicit zero inner sep, so east-anchored y tick labels sit at the native glyph positions without changing ordinary scientific-axis tick spacing. The full PGF object/signal pipeline, arbitrary `use path rise/fall/wick` hooks, exact TeX glyph outlines, and non-default line transformers are still missing. |
| `\usetikzlibrary {datavisualization.polar}` | partial | Registers a focused polar datavisualization slice. It lowers `scientific polar axes={0 to pi, clean}`, degree ranges such as `0 to 90` and `0 to 180`, non-clean `inner ticks`/`outer ticks`, `new polar axes={angle axis}{radius axis}`, `all axes=grid`, function-format `angle`/`radius` data, explicit `data point [angle=..., radius=...]` scientific scatter, and `data [format=named]` low-level polar scatter data into ordinary TikZ coordinates. The outer angle-axis boundary follows native `black!50`, while interior grid arcs/rays stay at `black!25`; degree tick suffixes are emitted as math labels. Non-clean polar axes draw the angle-axis arc, radius axes, symmetric radius ticks, angle tick labels, and inward/outward angle tick direction without requiring `all axes=grid`; `datavisualization-048` and `datavisualization-074` cover this Section 85 behavior. Clean partial ranges draw pale endpoint radius axes, `.5em` outward-offset clean boundary axes, and endpoint radius labels for the manual scatter examples. Pure low-level `new polar axes` avoids automatic ticks/axes unless grid or ticks are requested, matching the manual scatter example; `angle axis={unit vectors={(10:1pt)}{(60:1pt)}}` affects low-level scatter coordinates in `datavisualization-059`, while `angle axis={degrees}` and `angle axis={radians}` map 360 and `2*pi` respectively to a full turn in `datavisualization-082` and `datavisualization-083`. Scientific `radius axis={length=...}` is treated as the total physical radius-axis span and explicit scatter data is scaled by the surveyed source max unless `max value` is set; `datavisualization-073` and `datavisualization-074` cover this. `radius axis={ticks=none}` suppresses the default quarter-radius tick/grid fallback; `datavisualization-062` covers that behavior. Scientific `angle axis={logarithmic}` now maps source values through `log10` before projection, supports focused `major also at/.list`, draws logarithmic minor angle grid rays plus outer minor tick marks, and lets polar radius `ticks={some, style=...}` use native about ticks plus styled tick labels without recoloring angle labels; `datavisualization-079` covers this Section 85 example. `legend=below` follows native `rows=1` behavior and uses curved smooth-line legend samples. Exact native label geometry, skewed-basis grid/arc geometry, logarithmic radius axes, arbitrary angle-axis mappers, and the full polar axis object system remain missing. |
| mixed text/math legend labels | partial | Browser live preview uses scoped KaTeX for inline formulas and now includes rich-text `foreignObject` bounds in the SVG viewBox. Offline `web:output` PNG artifacts still use `svg-text` fallback because `rsvg-convert` does not reliably paint `foreignObject`. |
| `func x = rand + ...` | partial | Uses PGF's integer-generator constants for deterministic `rand`, `rnd`, and simple `random(n)` support. Random expressions are evaluated once in survey and again in visualization, matching the native rendered scatter point order. Exact TeX token formatting is still not fully replicated. |

Formula fallback note: datavisualization legends often contain inline math.
For offline PNG comparison, TikZKit uses SVG text instead of KaTeX
`foreignObject`. Inline sums such as `\sum_{i=1}^{10}` use side scripts in TeX,
while explicit `\sum\limits_{i=1}^{n}` uses stacked limits. The fallback now
keeps those two modes separate, renders lower labels as `i=1` without relation
spacing, and keeps the side scripts readable in `datavisualization-001`. Named
operators such as `\sin`/`\cos` are upright, scripted labels use a math minus
glyph, and a small TeX-like space is inserted when a scripted atom is followed
by a named operator, improving pin labels such as `$e^{-x/2}\sin x$`.

Known missing or inaccurate parts:

- Complete native object/signal pipeline and padded data bounding boxes. The
  current focused lowering does implement a two-pass survey/render sample model
  for function data ranges and random expressions, but not arbitrary PGF
  datavisualization objects.
- Full `scientific axes` tick density, minor/subminor grid variants, all `clean` axis variants, exact exponential minor/subminor tick policies, and nonstandard log scaling functions.
- Exact label visualizer placement for `pin in data` and plain `label in data`, native normal-vector selection in edge cases, arbitrary label style routing beyond the focused selector set, and full `every pin edge` styling.
- Native visualizer color selection and style-sheet handling.
- Full visualizer handler coverage. `straight cycle`, `smooth cycle`, `polygon`,
  `gap line`, and `gap cycle` are implemented for focused line data, but custom
  handler composition, native legend glyphs, and arbitrary gap distances remain
  partial.
- Full rectangle visualizer object/signal routing and arbitrary custom legend
  strategies. Focused attribute remapping, `.list`, and native default rectangle
  legend coordinates are implemented for table-data cases such as
  `datavisualization-061`.
- Full axis label visualizer variants such as custom `visualize label` and arbitrary label visualizer routing. `end labels` and `upright labels` are approximated for scientific clean axes.
- TeX matrix-based legend layout, exact row spacing, and exact `em`/`ex` sizing for legend examples. `legend={below, rows=<n>}` and the focused inside text-only matrix background have approximations, but arbitrary legend placements, strategies, styling, and custom inside placements are still partial.
- SVG-vs-tikztosvg bbox convergence: current JS output is closer after TeX Live `every data set label`-sized outside legend labels, clean-axis frame padding removal, rich-text math bounds, plain text bounds based on TeX metrics, and calibrated outside legend sample spacing. Remaining differences come from native survey/layout/cropping rules, exact legend matrix sizing, and exact TeX font metrics that are not fully modeled.
- `/pgf/data/...` key configuration, survey pipeline hooks, and frontend object routing.
- Exact TeX math parser behavior for all `pgfmath` expressions.

## Delivery Rule

For every TikZKit case delivery, include:

1. The TikZ libraries/packages used.
2. The commands and parameters found in the case source.
3. Which commands/parameters are implemented.
4. Which commands/parameters are partial.
5. Which commands/parameters are not implemented.
6. The local TeX Live source files or docs checked.
7. The visual differences still visible against tikztosvg or MacTeX.

If a case still has visible mismatch, do not call it complete.
