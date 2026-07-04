# Data Visualization Axes

Source studied:

- User-provided manual excerpt: `82 Axes`.
- Related TikZKit implementation: `src/preprocess.js`.
- Related previous note: `docs/tikz-knowledge/22-data-visualization.md`.

## Core Principle

In PGF/TikZ data visualization, an axis is not the line drawn on the page. An axis is a named mapping from a data-point attribute to a page position.

The visual line, ticks, grid lines, and labels are separate visualizers installed by an axis system.

This distinction is the key implementation point:

1. The axis scaling mapper watches one data attribute during the survey phase. It decides the raw data interval and maps it to a reasonable numeric interval.
2. A transformer maps that reasonable interval to actual page displacement. In Cartesian axes this is usually a linear mapping along a unit vector.
3. Axis-system visualizers draw optional axis lines, ticks, tick labels, grid lines, and axis labels based on the axis model.

So the native model is:

```txt
data attribute -> scaling mapper -> transformed coordinate -> visualizers
```

It is not:

```txt
draw a rectangle, then guess ticks
```

## Axis Creation

The low-level key `new axis base=<axis name>` creates a named axis and installs the scaling mapper, but it does not create an actual page mapping by itself.

Higher-level keys such as `new Cartesian axis=<axis name>` use `new axis base` and also install a transformer. For Cartesian axes, `unit vector=<coordinate>` controls the direction in which the attribute grows.

Important axis-level options:

| Option | Meaning | TikZKit implication |
| --- | --- | --- |
| `attribute=<name>` | Which `/data point/<name>` value drives the axis. | Datavis lowering must not assume every plot only has `x` and `y`. |
| `include value=<values>` | Force values into the surveyed range. | Needed for axes that must include zero or a semantic boundary. |
| `min value`, `max value` | Explicit raw range bounds. | Should feed range calculation before ticks/grid. |
| `scaling=<source> at <target> and <source> at <target>` | Explicit source-to-page interval mapping. | More general than `xmin/xmax/width`; supports named `min` and `max`. |
| `function=<code>` | Nonlinear preprocessing before mapping. | Basis for log axes and custom transformed axes. |
| `logarithmic` | Installs logarithmic mapping and exponential tick strategy. | Current `xmode=log`-style support is not enough for native datavis. |
| `length=<dimension>` | Fit surveyed data range into a target length. | Used by `scientific axes` width/height. |
| `unit length=<dimension> per <number> units` | Fixed physical size per data unit. | Used by school-book style axes and equal-scale plots. |
| `power unit length=<dimension>` | Log axis length per power of ten. | Required for stable log plots. |
| `label=...` | Declares an axis label. | Label drawing is still done by `visualize label`, not the axis itself. |

## Axis Systems

An axis system is a bundled setup that creates axes, assigns attributes, configures default scaling, and installs visualizers for axis lines, ticks, grids, and labels.

### Scientific Axes

`scientific axes` creates an `x axis` and a `y axis` and scales arbitrary numeric data into a fixed rectangular plotting region. The default size is around `5cm` wide and about `0.618 * width` high.

Important variants:

- `scientific axes`: framed scientific plot with ticks.
- `scientific axes=clean`: axis/tick visuals are moved away from the data region or removed from the actual data marks, useful for scatter and dense data.
- `outer ticks`, `inner ticks`: decide whether ticks point away from or into the data rectangle.
- `standard labels`, `upright labels`, `end labels`: label-placement styles. TikZKit currently approximates `standard labels`, `scientific axes={clean,end labels}`, and `scientific axes={clean,upright labels}`.

### School Book Axes

`school book axes` draws axes through the origin and is closer to classroom coordinate diagrams. It should usually be paired with `unit length`, because unlike `scientific axes` it should not casually distort the relative size of x and y units.

### Lower-Level Axis Systems

Lower-level systems such as `xy Cartesian`, `xy axes`, `xyz Cartesian cabinet`, `xyz axes`, `uv Cartesian`, and `uvw Cartesian cabinet` mainly create coordinate-system mappings. Higher-level systems then add drawing policy.

## Ticks and Grid Lines

Ticks and grid lines are also split into two layers:

1. `ticks=...` and `grid=...` specify which values should exist in principle.
2. `visualize ticks=...` and `visualize grid=...` decide where and how to draw them.

This is important because the same tick values can be visualized on different sides of a plot, and one grid value can draw in different directions.

Main configuration keys:

| Key | Meaning |
| --- | --- |
| `ticks=<options>` | Adds or configures tick positions for an axis. Multiple uses accumulate. |
| `grid=<options>` | Adds or configures grid positions. Default is `at default ticks`. |
| `ticks and grid=<options>` | Applies the same position options to both ticks and grid lines. |
| `few`, `some`, `many`, `none` | Auto tick-density presets. |
| `about=<n>` | Ask the placement strategy for roughly `n` ticks. |
| `step=<value>` | Semi-automatic tick spacing. |
| `phase=<value>` | Offset the tick sequence. |
| `minor steps between steps=<n>` | Insert minor ticks between major steps. |
| `major at`, `minor at`, `subminor at`, `major also at` | Manual tick/grid positions. |
| `as <text>` | Override tick-label text for a manual position. |
| `tick prefix`, `tick suffix`, `tick unit` | Format tick labels. |
| `tick text at low`, `tick text at high`, `no tick text` | Control which side gets labels. |
| `node style`, `style` | Style labels and tick/grid paths. |

The default linear strategy places ticks at evenly spaced values. Logarithmic axes switch to an exponential strategy.

## Visualizing Grid Lines

`visualize grid={direction axis=<axis>}` draws grid lines for a fixed value of one axis while moving along another axis.

A grid line is not always literally a straight Cartesian line. For polar or 3D systems, the manual describes grid generation through special datavis coordinate operations so the coordinate system can replace a straight line with a curve or projected path.

TikZKit implication:

- For simple Cartesian datavis, straight SVG grid lines are acceptable.
- For polar, 3D, or custom coordinate systems, the grid renderer must ask the coordinate system for the correct path, not draw a naive perpendicular line.

## Visualizing Ticks

`visualize ticks={direction axis=<axis>, low=<dim>, high=<dim>}` draws tick marks as short straight line segments.

Unlike grid lines, ticks remain short straight marks even in curved coordinate systems. PGF computes a unit tangent vector in the direction axis and multiplies it by `low` and `high`.

`tick length=<dimension>` is a shorthand for configuring tick extent.

TikZKit implication:

- Tick mark geometry should use the same transformer as the data point.
- Tick text placement must be independent from tick-value selection.
- Multiple `visualize ticks` calls can draw the same tick values on multiple plot sides.

## Custom Axis Systems

The manual's construction sequence for a new axis system is:

1. Create axes.
2. Configure attributes, length, and default scaling.
3. Create visual axis representations.
4. Create visual ticks and grid lines.
5. Create visual axis labels.

The axis system provides defaults and drawing policy. It does not own the actual data range or exact requested tick values.

This is the conceptual boundary TikZKit should follow.

## TikZKit Current Implementation

Current code is concentrated in `src/preprocess.js`:

| Current function | Role | Relation to PGF datavis |
| --- | --- | --- |
| `expandDatavisualizationFunctions` | Lowers a supported subset of `\datavisualization` to an `axis`/`\addplot` form. | Useful bridge, but bypasses native datavis object phases. |
| `computeAxisRanges` | Computes plot min/max and explicit bounds. | Similar to survey-phase range collection, but not a reusable axis mapper. |
| `createAxisGeometry` | Builds `mapPoint` / `mapPoint3d` and page geometry. | Similar to a transformer, but tied to axis environment rendering. |
| `renderAxisGrid` | Draws grid lines. | Currently mostly Cartesian and direct. |
| `renderAxisTicks` | Chooses and draws ticks and tick labels. | Combines tick selection and visualization more tightly than PGF. |
| `renderAxisLines` | Draws axis/frame lines. | Axis visualization layer. |
| `renderAxisLabels` | Draws labels. | Axis label visualization layer. |
| `renderLegendEntries` | Draws legend entries. | Parallel to datavis legend visualizers, but approximate. |

The current strategy is good for producing early visual output, but it explains why datavis cases diverge:

- `scientific axes` and `scientific axes=clean` are flattened too early.
- `ticks` and `visualize ticks` are not separated.
- `grid` and `visualize grid` are not separated.
- axis `attribute`, `include value`, `scaling`, `unit length`, and `logarithmic` are only partially represented.
- visualizer labels, pins, and legends do not participate in the native survey/object pipeline.

## Implementation Direction

The next durable design should introduce explicit datavis objects before lowering to SVG:

```js
AxisModel = {
  name,
  attribute,
  range,
  scaling,
  transformer,
  tickSpec,
  gridSpec,
  labelSpec,
  visualizers
}
```

```js
AxisSystem = {
  name,
  axes,
  defaults,
  visualizeAxes,
  visualizeTicks,
  visualizeGrid,
  visualizeLabels
}
```

Short-term improvements can still reuse the current PGFPlots-like renderer:

1. Parse `x axis={...}`, `y axis={...}`, and `all axes={...}` from `\datavisualization`.
2. Translate `length`, `unit length`, `min value`, `max value`, `include value`, `logarithmic`, `ticks`, and `grid` into the existing `axis` options.
3. Keep tick-value selection separate from tick drawing so `scientific axes=clean`, outer/inner ticks, and multi-side ticks can be approximated.
4. Preserve `attribute=<name>` so data functions are not forced into only `x` and `y`.

Medium-term implementation should stop treating datavis as only a PGFPlots subset and introduce an actual datavis survey/render pipeline.

## Support Matrix

| Syntax / concept | Current status | Notes |
| --- | --- | --- |
| `\datavisualization` function data | partial | Implemented through lowering, not native datavis pipeline. |
| `scientific axes` | partial | Width/height defaults exist in current notes; exact axis-system behavior incomplete. |
| `scientific axes=clean` / `scientific axes={clean,end labels}` / `scientific axes={clean,upright labels}` | partial | Approximate boxed/clean behavior; nested style list parsing, positive-end labels, and unrotated west-side y labels are implemented. Native separation of data and axis visuals is still incomplete. |
| `school book axes` | partial | Lowered to origin-crossing axes with arrows. Native unit-length school-book scaling is still approximate. |
| `x axis={attribute=...}` / `y axis={attribute=...}` | partial | Focused Cartesian mapping is implemented for numeric function/table point attributes, including `angle`/`radius` style attributes in `datavisualization-057`. Full arbitrary attribute-object routing and nonnumeric attributes remain missing. |
| `all axes={...}` | partial | Basic `grid`, `ticks`, and `ticks and grid` propagation is supported. Full native axis-model propagation is still missing. |
| `include value`, `min value`, `max value` | partial | Now feeds the lowered range before geometry for x/y/all axes. Native survey phases and repeated-key accumulation remain incomplete. |
| `scaling=... at ... and ... at ...` | partial | Cartesian x/y axis scaling now supports linear `<source> at <target> and <source> at <target>` mappings, including `min`/`max` source keywords, physical target dimensions, scaled tick positions, and source tick labels. `datavisualization-068` covers `year -> 0..5cm`. Nonlinear `function=<code>`, full native scaling mapper objects, and repeated-key order semantics remain missing. |
| `function=<code>` | missing | Needed for nonlinear transformations. |
| `logarithmic` | partial | `x axis={logarithmic,...}` / `y axis={logarithmic,...}` now use log coordinate mapping and power-of-ten major ticks in the PGFPlots-like lowering. Full native exponential tick strategy and minor/subminor ticks remain missing. |
| `length`, `unit length`, `power unit length` | partial | `length` and simple `unit length` are lowered to axis width/height. For positive logarithmic ranges, `power unit length=<dimension>` computes physical length per decade. Native equal-unit school-book scaling and arbitrary scaling declarations are still missing. |
| `ticks=few/some/many/about/step` | partial | `few`, `some`, `many`, `about=<n>`, and `step=<value>` are lowered to explicit tick lists. `minor steps between steps=<n>` now emits focused minor ticks/grids between generated major ticks. Native datavis placement strategies and subminor variants are still missing. |
| manual ticks `major at`, `also at`, `major also at`, `as <text>`, `no tick text at` | partial | Major tick/grid positions now parse `at` as an override and `also at`/`major also at` as an additive list, including custom labels such as `(pi/2) as $\frac{\pi}{2}$`; `datavisualization-069` covers the PGF manual example, and `datavisualization-070` covers `no tick text at` plus a custom `\pi` label. Minor/subminor variants, ordered repeated-key semantics, and local per-tick geometry such as exact `tick text padding` remain incomplete. |
| `grid`, `ticks and grid` | partial | Direct x/y/all-axes grid lowering exists, but not the two-layer datavis model. |
| `visualize grid`, `visualize ticks` | partial | `datavisualization-080` covers the Section 82 `xy Cartesian` example with `all axes={grid={some, minor steps between steps}}` and `x axis={visualize grid={direction axis=y axis, minor={low=0.25, high=1.75, style=red!50}}}`. TikZKit now separates grid-position requests from grid drawing for this focused Cartesian slice: `xy Cartesian` uses data units as centimeters, suppresses default tick labels unless `visualize ticks` is requested, draws only the axis that has `visualize grid`, clips minor grid lines through `low`/`high`, and uses a native-like `0.2pt` minor grid stroke. Full repeated `visualize grid` accumulation, non-Cartesian direction-axis paths, custom `visualize ticks`, subminor grid/ticks, and exact arrow-tip/bbox geometry remain incomplete. |
| tick label styling and stacking | missing/partial | Focused `ticks={..., style=<color>}` color propagation to tick labels is implemented. Dense tick-label collision handling, rotated labels, and stacked labels remain missing. |
| datavis legend examples | partial | Current legend is still an approximation rather than the native object/matrix pipeline, but focused Section 84 placements now cover outside rows/columns, inside text-only matrices, and data-coordinate anchors such as `at values={x=...,y=...}` and `right of={x=...,y=...}` with an opaque inside legend background. Exact matrix metrics and custom legend styling remain partial. |

## Case Notes

- Datavis Gaussian/scatter cases expose missing `scientific axes=clean`, native pin placement, legend examples, and survey-phase range logic.
- Datavis sine/cosine/tangent cases expose missing style sheets, `y axis=grid`, multi-visualizer option propagation, and exact tick/grid policies.
- Any future datavis case should be reported with a command/parameter checklist, not just a diff number.
