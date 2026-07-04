export const tikzLibrary = {
  name: "datavisualization.barcharts",
  status: "partial",
  category: "datavisualization",
  implementedBy: "src/preprocess.js:renderDatavisualizationCandlesticks",
  features: [
    "focused candle stick plot visualizer",
    "table columns day plus <attribute>/low, <attribute>/high, <attribute>/entry, and <attribute>/exit",
    "index/source=<attribute> compatible data shape",
    "native-like 3mm day spacing through compact default axis width",
    "native-like y axis/source max=100 default range",
    "focused candle clean-axis origin placement, right/top extension, short ticks, and 0.25pt tick/boundary strokes",
    "focused candle clean-axis invisible bounds calibrated to tikztosvg physical bbox",
    "candle axis tick label TeX digit metrics and explicit zero inner sep for native-like y tick anchoring",
    "4pt candle body canvas offset that may extend beyond the data boundary",
    "white rise bodies and black fall bodies",
    "separate wick and body path subtypes for QA"
  ],
  notes:
    "Focused implementation of the TeX Live datavisualization.barcharts candle stick visualizer. It lowers supported candle data into ordinary axis overlay paths, calibrates the focused clean-axis geometry and invisible bbox against the local tikztosvg reference, and preserves the native canvas-position candle body offset instead of clipping body/wick paths to data bounds. Generated candle axis tick labels use TeX digit metrics with explicit zero inner sep so east-anchored y ticks align with the glyph reference; it does not implement the full PGF data visualization object/signal class system or arbitrary custom candle visualizer use-path hooks."
};
