export const tikzLibrary = {
  name: "datavisualization.sparklines",
  status: "partial",
  category: "datavisualization",
  implementedBy: "src/preprocess.js:expandDatavisualizationFunctions",
  features: [
    "spark line style lowering",
    "1pt-per-x-unit compact axis width",
    "native 1em vertical sparkline band approximation",
    "tickless compact line visualizer",
    "0.4pt straight round-cap sparkline paths"
  ],
  notes:
    "Focused implementation of the tiny TeX Live spark line style. It lowers spark line data to the existing datavisualization-to-axis path with compact physical dimensions, no tick labels, and native-like 0.4pt straight round-cap paths; it does not implement a full sparkline object pipeline."
};
