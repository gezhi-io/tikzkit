import { isStepPlotHandler } from "../pgf/stepPlot.js";

const handlers = new Set([
  "sharp plot", "sharp cycle", "smooth", "smooth cycle", "only marks",
  "xbar", "ybar", "xbar interval", "ybar interval", "xcomb", "ycomb"
]);

export function axisPlotHandler(plotOptions = {}, axisOptions = {}) {
  if (plotOptions["pgfplots histogram handler"]) return plotOptions["pgfplots histogram handler"];
  // TikZ's handler keys assign one register, even for e.g. smooth=false.
  for (const layer of [plotOptions, axisOptions]) {
    let handler;
    for (const raw of Object.keys(layer)) {
      const key = raw.replace(/^\/(?:tikz|pgfplots)\//, "");
      if (handlers.has(key) || isStepPlotHandler(key)) handler = key;
    }
    if (handler) return handler;
  }
  return "sharp plot";
}
