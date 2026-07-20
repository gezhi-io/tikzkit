export const tikzCommand = {
  name: "axis",
  kind: "environment",
  status: "partial",
  implementedBy: [
    "src/pgfplots/axis.js:createAxisModel",
    "src/pgfplots/ranges.js:createAxisRanges",
    "src/pgfplots/transformDataToCanvas.js:createDataToCanvasTransform",
    "src/pgfplots/axisTikzLowering.js:renderPgfplotsAxisAsTikz",
    "src/pgfplots/axisEnvironment.js:expandPgfplotsAxes",
    "src/pgfplots/rangeResolver.js:computeAxisRanges",
    "src/pgfplots/ticks.js:renderAxisTicks"
  ],
  package: "pgfplots",
  optionScope: "axis",
  options: [
    {
      name: "width / height / scale only axis",
      category: "layout",
      status: "partial",
      implementedBy: "src/pgfplots/geometry.js:createAxisGeometry",
      notes: "Axis box sizing is approximated from PGFPlots defaults and explicit dimensions."
    },
    {
      name: "xmin / xmax / ymin / ymax / domain",
      category: "ranges",
      status: "implemented",
      implementedBy: "src/pgfplots/rangeResolver.js:computeAxisRanges + src/pgfplots/ranges.js",
      notes: "Explicit ranges override sampled/data-derived ranges."
    },
    {
      name: "axis lines / axis x line / axis y line",
      category: "frame",
      status: "partial",
      implementedBy: "src/pgfplots/axisTikzLowering.js:renderPgfplotsAxisAsTikz + src/pgfplots/axisLines.js",
      notes: "Common boxed/center/left/bottom axis layouts are rendered as TikZ paths."
    },
    {
      name: "xlabel / ylabel / title",
      category: "labels",
      status: "partial",
      implementedBy: "src/pgfplots/axisTikzLowering.js:renderPgfplotsAxisAsTikz + src/pgfplots/labels.js",
      notes: "Labels are emitted as TikZ nodes; exact PGFPlots offsets are still being tuned."
    },
    {
      name: "xtick / ytick / tick distance",
      category: "ticks",
      status: "partial",
      implementedBy: "src/pgfplots/axisTikzLowering.js:renderPgfplotsAxisAsTikz + src/pgfplots/ticks.js",
      notes: "Explicit ticks, data ticks, and numeric tick distances are supported."
    },
    {
      name: "legend style / legend pos / legend entries",
      category: "legend",
      status: "partial",
      implementedBy: "src/pgfplots/axisTikzLowering.js:renderPgfplotsAxisAsTikz + src/pgfplots/legend.js",
      notes: "Common legend placement and entries are converted to nodes and line samples."
    },
    {
      name: "view / zmin / zmax / surf",
      category: "3D",
      status: "partial",
      implementedBy: "src/frontend/latex-shell.js:renderTernaryAxisAsTikz + src/pgfplots/surface.js",
      notes: "Focused 3D and ternary slices exist; full PGFPlots 3D camera parity is pending."
    }
  ],
  examples: [
    String.raw`\begin{axis}[domain=0:1, samples=50, axis lines=middle]`
  ]
};
