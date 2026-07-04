# Data Visualization Style Sheets and Legends

Source studied:

- User-provided manual excerpt: `84 Style Sheets and Legends`.
- TeX Live source: `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/datavisualization/tikzlibrarydatavisualization.code.tex`.
- TeX Live documentation: `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-dv-stylesheets.tex`.

## Core Model

Datavisualization style sheets are signal-driven style selectors. They are not ordinary plot options attached directly to one path. Native PGF creates style-sheet objects that monitor a data-point attribute, usually `/data point/set`, and apply a style when a visualizer emits a styling signal.

For TikZKit, the practical current lowering is:

1. Parse style-sheet declarations and named datavis option styles before reading a `\datavisualization`.
2. Expand focused style bundles such as `legend example/.style={...}` into the datavis option list.
3. Resolve visualizer/set names to plot styles during the existing function-data lowering.
4. Lower legend entries into explicit line/mark samples plus text nodes.

This is still a focused lowering, not the native PGF object/signal system.

## `\tikzdatavisualizationset`

Section 84 uses:

```tex
\tikzdatavisualizationset{
  legend example/.style={...}
}
```

Then later:

```tex
\tikz \datavisualization [
  visualize as smooth line/.list={...},
  legend example,
  style sheet=vary hue]
...
```

Native TikZ treats `legend example` as a datavisualization named style. TikZKit now supports the focused form:

- `name/.style={...}`
- `name/.append style={...}`
- recursive expansion inside the main `\datavisualization[...]` option list

The current implementation deliberately does not yet support style arguments, arbitrary handlers, or full key-path scoping under `/tikz/data visualization`.

## Legend Matrix Rules

TeX Live defaults for a new legend:

```tex
@strategy = down then right
anchor    = west
at        = (data visualization bounding box.east)
matrix node styling = {row sep=0pt,column sep=.8em}
```

Important legend layout keys:

| Key | Native effect |
| --- | --- |
| `columns=<n>` / `ideal number of columns=<n>` | Fill toward the configured strategy with an ideal column count. |
| `rows=<n>` / `ideal number of rows=<n>` | Same for rows. |
| `max rows=<n>` | Start a new column when the current column would exceed `n` rows. |
| `max columns=<n>` | Start a new row when the current row would exceed `n` columns. |
| `down then right` | Fill down first, then start columns to the right. |
| `right then down` | Fill right first, then start rows downward. |
| `up/left` variants | Same matrix strategy but reversed row and/or column direction. |

TikZKit currently implements the common rows/columns/max-rows/max-columns cases and has partial support for reversed directions. Exact TeX matrix cell sizing and arbitrary named legend anchors remain partial.

## Implementation Map

| Concept | TikZKit file |
| --- | --- |
| `\tikzdatavisualizationset` focused parser | `src/preprocess.js:collectDatavisualizationNamedStyles` |
| named style expansion | `src/preprocess.js:expandDatavisualizationNamedStyles` |
| custom style sheets | `src/preprocess.js:collectDatavisualizationStyleSheetDefinitions` |
| legend matrix placement | `src/preprocess.js:datavisualizationLegendMatrixCell` |
| line/scatter legend samples | `src/preprocess.js:renderDatavisualizationLineLegend`, `renderDatavisualizationLegend` |

## Case Notes

- `datavisualization-099`: covers `\tikzdatavisualizationset{legend example/.style={...}}` and verifies that the named style installs `scientific axes`, `all axes={length=1cm,ticks=none}`, and per-visualizer `label in legend` entries.

