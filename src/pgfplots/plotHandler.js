const handlers = new Set([
  "sharp plot", "sharp cycle", "smooth", "smooth cycle", "only marks",
  "const plot", "const plot mark left", "const plot mark mid", "const plot mark right",
  "jump mark left", "jump mark mid", "jump mark right",
  "xbar", "ybar", "xbar interval", "ybar interval", "xcomb", "ycomb"
]);

export function axisPlotHandler(plotOptions = {}, axisOptions = {}) {
  if (plotOptions["pgfplots histogram handler"]) return plotOptions["pgfplots histogram handler"];
  // TikZ's handler keys assign one register, even for e.g. smooth=false.
  for (const layer of [plotOptions, axisOptions]) {
    let handler;
    for (const raw of Object.keys(layer)) {
      const key = raw.replace(/^\/(?:tikz|pgfplots)\//, "");
      if (handlers.has(key)) handler = key;
    }
    if (handler) return handler;
  }
  return "sharp plot";
}
