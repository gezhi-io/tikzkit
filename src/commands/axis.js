export const tikzCommand = {
  name: "axis",
  kind: "environment",
  status: "partial",
  implementedBy: [
    "src/preprocess.js:expandPgfplotsAxes",
    "src/preprocess.js:renderAxisAsTikz",
    "src/preprocess.js:computeAxisRanges",
    "src/preprocess.js:renderAxisTicks"
  ],
  package: "pgfplots",
  optionScope: "axis",
  options: [
    {
      name: "width / height / scale only axis",
      category: "layout",
      status: "partial",
      implementedBy: "src/preprocess.js:axisGeometry",
      notes: "Axis box sizing is approximated from PGFPlots defaults and explicit dimensions."
    },
    {
      name: "xmin / xmax / ymin / ymax / domain",
      category: "ranges",
      status: "implemented",
      implementedBy: "src/preprocess.js:computeAxisRanges",
      notes: "Explicit ranges override sampled/data-derived ranges."
    },
    {
      name: "axis lines / axis x line / axis y line",
      category: "frame",
      status: "partial",
      implementedBy: "src/preprocess.js:renderAxisFrame",
      notes: "Common boxed/center/left/bottom axis layouts are rendered as TikZ paths."
    },
    {
      name: "xlabel / ylabel / title",
      category: "labels",
      status: "partial",
      implementedBy: "src/preprocess.js:renderAxisLabels",
      notes: "Labels are emitted as TikZ nodes; exact PGFPlots offsets are still being tuned."
    },
    {
      name: "xtick / ytick / tick distance",
      category: "ticks",
      status: "partial",
      implementedBy: "src/preprocess.js:renderAxisTicks",
      notes: "Explicit ticks, data ticks, and numeric tick distances are supported."
    },
    {
      name: "legend style / legend pos / legend entries",
      category: "legend",
      status: "partial",
      implementedBy: "src/preprocess.js:renderLegendEntries",
      notes: "Common legend placement and entries are converted to nodes and line samples."
    },
    {
      name: "view / zmin / zmax / surf",
      category: "3D",
      status: "partial",
      implementedBy: "src/preprocess.js:renderTernaryAxisAsTikz + surface helpers",
      notes: "Focused 3D and ternary slices exist; full PGFPlots 3D camera parity is pending."
    }
  ],
  examples: [
    String.raw`\begin{axis}[domain=0:1, samples=50, axis lines=middle]`
  ]
};
