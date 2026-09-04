import { parseOptions } from "../engine/options.js";
import { axisNumber } from "./coordinates.js";

const INTERVAL_KEYS = new Set(["xbar", "xbar interval", "ybar", "ybar interval"]);

export function preparePgfplotsHistogram(axisOptions = {}, addplots = []) {
  const normalizedAxisOptions = normalizePgfplotsHandlerOptions(axisOptions);
  const preparedPlots = addplots.map((plot) => lowerHistogramPlot(plot));
  const hasYInterval = preparedPlots.some((plot) => isPgfplotsIntervalPlot(normalizedAxisOptions, plot.options, "y"));
  const intervalTickLabels = hasYInterval && usesNextTickLabel(normalizedAxisOptions.xticklabel);

  return {
    axisOptions: {
      ...normalizedAxisOptions,
      ...(hasYInterval && normalizedAxisOptions.xtick === undefined ? { xtick: "data" } : {}),
      ...(hasYInterval && normalizedAxisOptions.xmajorgrids === undefined ? { xmajorgrids: true } : {}),
      ...(intervalTickLabels ? { "pgfplots x interval tick labels": true } : {})
    },
    addplots: preparedPlots
  };
}

export function lowerHistogramPlot(plot = {}) {
  if (plot.type !== "coordinates" || plot.options?.hist === undefined) return plot;
  const samples = (plot.points || []).map((point) => axisNumber(point.y, NaN)).filter(Number.isFinite);
  if (!samples.length) return plot;

  const config = parseHistogramOptions(plot.options.hist);
  const histogram = createHistogramBins(samples, config);
  if (!histogram) return plot;

  const points = histogram.edges.map((x, index) => {
    const countIndex = Math.min(index, histogram.counts.length - 1);
    const y = histogram.counts[countIndex];
    return {
      x,
      y,
      raw: `(${x},${y})`,
      ...(index === histogram.edges.length - 1 ? { histogramBoundary: true } : {})
    };
  });

  return {
    ...plot,
    points,
    coordinateRows: [points],
    histogram,
    options: {
      ...(plot.options || {}),
      "ybar interval": true,
      "pgfplots histogram": true
    }
  };
}

export function createHistogramBins(samples = [], config = {}) {
  const values = samples.map((value) => axisNumber(value, NaN)).filter(Number.isFinite);
  if (!values.length) return null;

  let dataMin = axisNumber(config["data min"], Math.min(...values));
  let dataMax = axisNumber(config["data max"], Math.max(...values));
  if (dataMin > dataMax) [dataMin, dataMax] = [dataMax, dataMin];

  const configuredWidth = axisNumber(config["bin width"], NaN);
  let bins = normalizedBinCount(config.bins, 10);
  if (dataMin === dataMax) {
    const width = Number.isFinite(configuredWidth) && configuredWidth > 0 ? configuredWidth : 1;
    dataMin -= width / 2;
    dataMax += width / 2;
    bins = 1;
  }

  let binWidth = (dataMax - dataMin) / bins;
  if (Number.isFinite(configuredWidth) && configuredWidth > 0) {
    binWidth = configuredWidth;
    bins = Math.max(1, Math.ceil((dataMax - dataMin) / binWidth));
    dataMax = dataMin + bins * binWidth;
  }
  if (!Number.isFinite(binWidth) || binWidth <= 0) return null;

  const counts = Array.from({ length: bins }, () => 0);
  for (const value of values) {
    if (value < dataMin || value > dataMax) continue;
    const index = Math.min(bins - 1, Math.max(0, Math.floor((value - dataMin) / binWidth)));
    counts[index] += 1;
  }

  const edges = Array.from({ length: bins + 1 }, (_, index) => roundedHistogramValue(dataMin + index * binWidth));
  edges[edges.length - 1] = roundedHistogramValue(dataMax);
  return { bins, binWidth, dataMin, dataMax, edges, counts };
}

export function normalizePgfplotsHandlerOptions(options = {}) {
  const normalized = { ...options };
  for (const [key, value] of Object.entries(options || {})) {
    const tikzKey = key.match(/^\/tikz\/(.+)$/)?.[1];
    if (!tikzKey || !INTERVAL_KEYS.has(tikzKey)) continue;
    if (normalized[tikzKey] === undefined) normalized[tikzKey] = value;
    delete normalized[key];
  }
  return normalized;
}

export function isPgfplotsIntervalPlot(axisOptions = {}, plotOptions = {}, orientation = "y") {
  const key = orientation === "x" ? "xbar interval" : "ybar interval";
  return Boolean(
    axisOptions[key] ||
    plotOptions[key] ||
    axisOptions[`/tikz/${key}`] ||
    plotOptions[`/tikz/${key}`]
  );
}

export function pgfplotsIntervalDataPoints(plot = {}, axisOptions = {}, orientation = "y") {
  const points = plot.points || [];
  return isPgfplotsIntervalPlot(axisOptions, plot.options || {}, orientation) ? points.slice(0, -1) : points;
}

export function pgfplotsPlotRangePoints(plot = {}, axisOptions = {}, axis = "x") {
  if (isPgfplotsIntervalPlot(axisOptions, plot.options || {}, "y") && axis === "y") {
    return plot.pgfplotsStacked ? (plot.points || []) : (plot.points || []).slice(0, -1);
  }
  if (isPgfplotsIntervalPlot(axisOptions, plot.options || {}, "x") && axis === "x") {
    return plot.pgfplotsStacked ? (plot.points || []) : (plot.points || []).slice(0, -1);
  }
  return plot.points || [];
}

function parseHistogramOptions(raw) {
  if (raw === true || raw === undefined || raw === null) return {};
  return parseOptions(String(raw));
}

function normalizedBinCount(raw, fallback) {
  const value = Math.round(axisNumber(raw, fallback));
  return Number.isFinite(value) && value > 0 ? Math.min(value, 10000) : fallback;
}

function roundedHistogramValue(value) {
  return Math.round(value * 1e12) / 1e12;
}

function usesNextTickLabel(raw) {
  const value = String(raw || "");
  return value.includes("\\tick") && value.includes("\\nexttick");
}
