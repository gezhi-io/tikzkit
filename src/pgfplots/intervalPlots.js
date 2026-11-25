const barHandlers = new Set(["xbar", "xbar interval", "ybar", "ybar interval"]);

export function normalizePgfplotsHandlerOptions(options = {}) {
  const normalized = { ...options };
  for (const [key, value] of Object.entries(options)) {
    const tikzKey = key.match(/^\/tikz\/(.+)$/)?.[1];
    if (!barHandlers.has(tikzKey)) continue;
    if (tikzKey.endsWith(" interval")) continue;
    if (normalized[tikzKey] === undefined) normalized[tikzKey] = value;
    delete normalized[key];
  }
  return normalized;
}

// Only PGFPlots' bar style changes the ticks, grid and cycle list. A raw
// /tikz/ybar interval selects the drawing handler and leaves the axis alone.
export function withPgfplotsIntervalAxisStyle(axisOptions = {}) {
  const normalized = normalizePgfplotsHandlerOptions(axisOptions);
  const result = {};
  const assign = (key, value) => { delete result[key]; result[key] = value; };
  for (const [raw, value] of Object.entries(normalized)) {
    const key = raw.replace(/^\/pgfplots\/(?=[xy]bar interval$)/, "");
    assign(key, value);
    if (key !== "ybar interval" && key !== "xbar interval") continue;
    const axis = key === "ybar interval" ? "x" : "y";
    assign(axis + " tick label as interval", true);
    assign(axis + "majorgrids", true);
    assign(axis + "tick align", "outside");
    assign(axis + "tick", "data");
  }
  return result;
}

export function isPgfplotsIntervalPlot(axisOptions = {}, plotOptions = {}, orientation = "y") {
  const key = orientation === "x" ? "xbar interval" : "ybar interval";
  if (plotOptions["pgfplots histogram handler"]) return plotOptions["pgfplots histogram handler"] === key;
  return Boolean(axisOptions[key] || plotOptions[key] || axisOptions[`/tikz/${key}`] || plotOptions[`/tikz/${key}`]);
}

export function pgfplotsIntervalDataPoints(plot = {}, axisOptions = {}, orientation = "y") {
  const points = plot.points || [];
  return isPgfplotsIntervalPlot(axisOptions, plot.options, orientation) ? points.slice(0, -1) : points;
}

export function pgfplotsPlotRangePoints(plot = {}, axisOptions = {}, axis = "x") {
  const points = plot.points || [];
  // Histogram survey replays real coordinates. Without the extra closing
  // point even the last (unpainted) height still contributes to the limits.
  if (plot.histogram || plot.pgfplotsStacked) return points;
  return isPgfplotsIntervalPlot(axisOptions, plot.options, axis) ? points.slice(0, -1) : points;
}
