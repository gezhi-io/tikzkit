import { parseOptions } from "../engine/options.js";
import { pgfplotsOptionEnabled } from "./axisOptions.js";
import { createHistogramBins } from "./histogramBins.js";
import { withPgfplotsIntervalAxisStyle } from "./intervalPlots.js";
import { mergePgfplotsOptionMaps } from "./namedOptions.js";
import { scalarSurveyNumber, scalarSurveyRows } from "./scalarSurvey.js";

export { createHistogramBins } from "./histogramBins.js";
export { isPgfplotsIntervalPlot, normalizePgfplotsHandlerOptions, pgfplotsIntervalDataPoints,
  pgfplotsPlotRangePoints } from "./intervalPlots.js";

const handlers = new Set(["ybar interval", "xbar interval", "ybar", "xbar", "sharp plot", "const plot",
  "const plot mark left", "const plot mark right", "const plot mark mid", "jump mark left", "jump mark right",
  "jump mark mid", "only marks", "smooth"]);

function optionMap(value) {
  if (value && typeof value === "object") return value;
  return typeof value === "string" ? parseOptions(value) : {};
}

function histogramSettings(axis, plot, styles) {
  const settings = { "data min": axis.xmin, "data max": axis.xmax };
  let paint = { "/tikz/ybar interval": true };
  function assign(raw, value) {
    const key = raw.replace(/^(?:\/pgfplots\/)?hist\//, "");
    if (key === "data") delete settings["data value"];
    if (key === "data value") delete settings.data;
    if (key === "handler/.style") paint = optionMap(value);
    else if (key === "handler/.append style") paint = mergePgfplotsOptionMaps(paint, optionMap(value));
    else if (key === "handler/.prefix style") paint = mergePgfplotsOptionMaps(optionMap(value), paint);
    else settings[key] = value;
  }
  const inheritedHandler = styles?.["hist/handler"] ?? styles?.["/pgfplots/hist/handler"];
  if (inheritedHandler !== undefined) paint = optionMap(inheritedHandler);
  for (const layer of [axis, plot]) {
    for (const [rawKey, value] of Object.entries(layer ?? {})) {
      const key = rawKey.replace(/^\/pgfplots\//, "");
      if (key === "hist") {
        for (const [k, v] of Object.entries(optionMap(value))) assign(k, v);
      } else if (key.startsWith("hist/")) assign(key, value);
    }
  }
  let handler;
  const paintOptions = {};
  for (const [key, value] of Object.entries(paint)) {
    const name = key.replace(/^\/(?:tikz|pgfplots)\//, "");
    if (handlers.has(name)) handler = name;
    else paintOptions[name] = value;
  }
  return { settings, handler, paintOptions };
}

export function preparePgfplotsHistogram(axisOptions = {}, addplots = [], options = {}, diagnostics = []) {
  const axis = withPgfplotsIntervalAxisStyle(axisOptions);
  return { axisOptions: axis,
    addplots: addplots.map((plot, i) => lowerHistogramPlot(plot, axis, options, diagnostics, i)) };
}

export function lowerHistogramPlot(plot = {}, axis = {}, options = {}, diagnostics = [], plotIndex = 0) {
  if (![axis, plot.options].some(map => map && (Object.hasOwn(map, "hist") || Object.hasOwn(map, "/pgfplots/hist")))) return plot;
  const { settings, handler, paintOptions } = histogramSettings(axis, plot.options, options.pgfplotsStyleDefinitions);
  const empty = { ...plot, type: "coordinates", is3d: false, points: [], coordinateRows: [] };
  function unsupported(reason) {
    diagnostics.push({ severity: "warning", message: `PGFPlots histogram: ${reason}` });
    return empty;
  }
  if (plot.is3d) return unsupported("3D histogram input is not supported");
  if (!handler) return unsupported("unsupported histogram paint handler");
  const hook = Object.keys(settings).find(key => key === "symbolic coords" || key.includes("coord trafo") ||
    key.includes("coord inv trafo") || (key.startsWith("data filter") && key !== "data filter/.expression") ||
    key.startsWith("handler/"));
  if (hook) return unsupported(`unsupported key '${hook}'`);
  const rows = scalarSurveyRows(plot, axis, options);
  if (!rows) return unsupported("unsupported sample source");
  const context = { axis, plotIndex };
  const literal = settings["data value"] !== undefined;
  const data = literal ? settings["data value"] : (settings.data ?? "y");
  const filter = settings["data filter/.expression"];
  const samples = rows.map((row, index) => {
    const value = scalarSurveyNumber(data, row, context, index, literal);
    if (filter === undefined) return value;
    context.filterInput = value;
    return scalarSurveyNumber(filter, row, context, index);
  });
  const bins = createHistogramBins(samples, settings);
  if (!bins) return empty;
  const intervals = settings.intervals === undefined || pgfplotsOptionEnabled(settings.intervals);
  const points = (intervals ? bins.edges : bins.edges.slice(0, -1)).map((x, i) => {
    const boundary = i === bins.counts.length;
    const y = bins.counts[boundary ? i - 1 : i];
    return { x, y, raw: `(${x},${y})`, ...(boundary ? { histogramBoundary: true } : {}) };
  });
  return { ...empty, points, coordinateRows: [points], histogram: { ...bins, handler, intervals },
    options: { ...plot.options, ...paintOptions, [handler]: true, "pgfplots histogram": true,
      "pgfplots histogram handler": handler } };
}
