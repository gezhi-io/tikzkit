import { evaluateAxisExpression } from "./expressions.js";
import { arrowTipsFromOptions } from "../engine/options.js";
import { substituteTextVariables } from "../engine/math.js";
import { formatAxisPoint, joinOptions } from "./format.js";
import { selectPlotStyle } from "./plotStyle.js";
import { axisSamples, parseDomain } from "./rangeResolver.js";
import { axisViewportClipOption } from "./clipping.js";
import { isAxisQuiverPlot, parseQuiverOptions, quiverScale } from "./quiverOptions.js";

export { isAxisQuiverPlot } from "./quiverOptions.js";

export function renderAxisQuiverPlot(plot, axisOptions, ranges, geometry, options = {}, plotIndex = 0) {
  const sampled = sampleAxisQuiverPlot(plot, axisOptions, ranges, geometry, options);
  const inherited = quiverPathOptions(plot.options || {});
  const everyArrow = quiverEveryArrowStyle(sampled.quiver);
  const clip = axisViewportClipOption(axisOptions, ranges, geometry);
  return sampled.samples.map((sample) => {
    // PGFPlots replays every arrow as a TikZ path after transforming metadata.
    // Keep the full style so arrows.meta, not the plot handler, owns tip size.
    const local = substituteTextVariables(everyArrow, {
      pgfplotspointmeta: Number.isFinite(sample.meta) ? sample.meta : 1,
      pgfplotspointmetatransformed: 1000 * (quiverPointMetaScale(sample.meta, sampled.metaRange) ?? 1)
    });
    const style = joinOptions(["axis quiver", selectPlotStyle(plot.options || {}, plotIndex), inherited, local, clip]);
    return `\\draw[${style}] ${formatAxisPoint(sample.start)} -- ${formatAxisPoint(sample.end)};`;
  });
}

export function sampleAxisQuiverPlot(plot, axisOptions, ranges, geometry, options = {}) {
  const quiver = parseQuiverOptions(plot.options || {});
  // PGFPlots samples the declared domain before its viewport clip is applied.
  // Resampling only the visible interval changes spacing and metadata limits.
  const xDomain = parseDomain(plot.options.domain || axisOptions.domain || `${ranges.xMin}:${ranges.xMax}`);
  const yDomain = parseDomain(plot.options["y domain"] || axisOptions["y domain"] || axisOptions.domain || `${ranges.yMin}:${ranges.yMax}`);
  if (![xDomain.start, xDomain.end, yDomain.start, yDomain.end].every(Number.isFinite)) {
    return { quiver, samples: [], metaRange: null };
  }

  const xSamples = quiverSamples(plot.options.samples || axisOptions.samples || options.pgfplotsSamples || 15, xDomain, 80);
  const ySamplesRaw = plot.options["samples y"] ?? axisOptions["samples y"];
  // coordprocessing switches samples y<2 to a line and replaces y by zero;
  // it does not take the first endpoint of a nonzero y domain.
  const lineSampling = (ySamplesRaw !== undefined && evaluateAxisExpression(ySamplesRaw, 0, axisOptions) < 2)
    || (yDomain.start === 0 && yDomain.end === 0);
  const ySamples = lineSampling ? 1 : quiverSamples(
    ySamplesRaw ?? plot.options.samples ?? axisOptions.samples ?? options.pgfplotsSamples ?? 15, yDomain, 80);
  const scale = quiverScale(quiver["scale arrows"]);
  const samples = [];

  for (let yIndex = 0; yIndex < ySamples; yIndex += 1) {
    const y = lineSampling ? 0 : interpolateDomain(yDomain, yIndex, ySamples);
    for (let xIndex = 0; xIndex < xSamples; xIndex += 1) {
      const x = interpolateDomain(xDomain, xIndex, xSamples);
      const z = evaluateAxisExpression(plot.expression || "0", x, axisOptions, { y });
      const u = evaluateAxisExpression(quiver.u ?? quiver["quiver/u"] ?? "0", x, axisOptions, { y, z });
      const v = evaluateAxisExpression(quiver.v ?? quiver["quiver/v"] ?? "0", x, axisOptions, { y, z });
      const w = evaluateAxisExpression(quiver.w ?? quiver["quiver/w"] ?? "0", x, axisOptions, { y, z });
      if (![x, y, z, u, v, w].every(Number.isFinite)) continue;
      const meta = evaluateQuiverPointMeta(plot.options["point meta"] ?? axisOptions["point meta"], x, axisOptions, { y, z, u, v, w });
      const start = geometry.mapPoint3d({ x, y, z });
      const end = geometry.mapPoint3d({ x: x + u * scale, y: y + v * scale, z: z + w * scale });
      samples.push({ start, end, meta });
    }
  }

  const metaRange = quiverPointMetaRange(samples, plot.options, axisOptions);
  return { quiver, samples, metaRange };
}

function quiverSamples(raw, domain, maxSamples) {
  if (Math.abs(domain.end - domain.start) < 1e-12) return 1;
  return axisSamples(raw, maxSamples);
}

function quiverPathOptions(options) {
  const paintKeys = new Set(["arrows", ">", "opacity", "draw opacity", "fill opacity", "shorten <=", "shorten >="]);
  return joinOptions(Object.entries(options).flatMap(([key, value]) => {
    if (!paintKeys.has(key) && !Object.keys(arrowTipsFromOptions({ [key]: value })).length) return [];
    return value === true ? key : `${key}={${value}}`;
  }));
}

function quiverEveryArrowStyle(quiver) {
  let style = "";
  for (const [key, value] of Object.entries(quiver)) {
    const values = Array.isArray(value) ? value : [value];
    for (const raw of values) {
      const next = raw === true ? "" : String(raw);
      if (key === "every arrow/.style" || key === "every arrow") style = next;
      if (key === "every arrow/.append style") style = joinOptions([style, next]);
      if (key === "every arrow/.prefix style") style = joinOptions([next, style]);
    }
  }
  return style;
}

function evaluateQuiverPointMeta(raw, x, axisOptions, variables) {
  if (raw === undefined || raw === null || raw === true || raw === "") return NaN;
  return evaluateAxisExpression(raw, x, axisOptions, variables);
}

function quiverPointMetaRange(samples, plotOptions, axisOptions) {
  const values = samples.map((sample) => sample.meta).filter(Number.isFinite);
  if (!values.length) return null;
  const min = plotOptions["point meta min"] ?? axisOptions["point meta min"];
  const max = plotOptions["point meta max"] ?? axisOptions["point meta max"];
  return {
    min: min === undefined ? Math.min(...values) : evaluateAxisExpression(min, 0, axisOptions),
    max: max === undefined ? Math.max(...values) : evaluateAxisExpression(max, 0, axisOptions)
  };
}

export function quiverPointMetaScale(value, range) {
  if (!range || !Number.isFinite(value)) return null;
  const span = range.max - range.min;
  if (Math.abs(span) < 1e-12) return 0;
  return Math.max(0, Math.min(1, (value - range.min) / span));
}

function interpolateDomain(domain, index, samples) {
  const t = samples === 1 ? 0 : index / (samples - 1);
  return domain.start + (domain.end - domain.start) * t;
}
