import { evaluateAxisExpression } from "./expressions.js";
import { formatAxisPoint, joinOptions } from "./format.js";
import { selectPlotStyle } from "./plotStyle.js";
import { axisSamples, parseDomain } from "./rangeResolver.js";
import { isAxisQuiverPlot, parseQuiverOptions, quiverScale } from "./quiverOptions.js";

export { isAxisQuiverPlot } from "./quiverOptions.js";

export function renderAxisQuiverPlot(plot, axisOptions, ranges, geometry, options = {}, plotIndex = 0) {
  const sampled = sampleAxisQuiverPlot(plot, axisOptions, ranges, geometry, options);
  return sampled.samples.map((sample) => {
    const style = joinOptions(["axis quiver", selectPlotStyle(plot.options || {}, plotIndex), quiverArrowTip(sampled.quiver, quiverPointMetaScale(sample.meta, sampled.metaRange))]);
    return `\\draw[${style}] ${formatAxisPoint(sample.start)} -- ${formatAxisPoint(sample.end)};`;
  });
}

export function sampleAxisQuiverPlot(plot, axisOptions, ranges, geometry, options = {}) {
  const quiver = parseQuiverOptions(plot.options || {});
  const xDomain = clipDomainToRange(parseDomain(plot.options.domain || axisOptions.domain || `${ranges.xMin}:${ranges.xMax}`), ranges.xMin, ranges.xMax);
  const yDomain = clipDomainToRange(
    parseDomain(plot.options["y domain"] || axisOptions["y domain"] || axisOptions.domain || `${ranges.yMin}:${ranges.yMax}`),
    ranges.yMin,
    ranges.yMax
  );
  if (!xDomain || !yDomain) return { quiver, samples: [], metaRange: null };

  const xSamples = quiverSamples(plot.options.samples || axisOptions.samples || options.pgfplotsSamples || 15, xDomain, 80);
  const ySamples = quiverSamples(
    plot.options["samples y"] || axisOptions["samples y"] || plot.options.samples || axisOptions.samples || options.pgfplotsSamples || 15,
    yDomain,
    80
  );
  const scale = quiverScale(quiver["scale arrows"]);
  const samples = [];

  for (let yIndex = 0; yIndex < ySamples; yIndex += 1) {
    const y = interpolateDomain(yDomain, yIndex, ySamples);
    for (let xIndex = 0; xIndex < xSamples; xIndex += 1) {
      const x = interpolateDomain(xDomain, xIndex, xSamples);
      const z = evaluateAxisExpression(plot.expression || "0", x, axisOptions, { y });
      const u = evaluateAxisExpression(quiver.u ?? quiver["quiver/u"] ?? "0", x, axisOptions, { y, z });
      const v = evaluateAxisExpression(quiver.v ?? quiver["quiver/v"] ?? "0", x, axisOptions, { y, z });
      const w = evaluateAxisExpression(quiver.w ?? quiver["quiver/w"] ?? "0", x, axisOptions, { y, z });
      if (![x, y, z, u, v, w].every(Number.isFinite)) continue;
      const meta = evaluateQuiverPointMeta(plot.options["point meta"], x, axisOptions, { y, z, u, v, w });
      const start = geometry.mapPoint3d({ x, y, z });
      const end = geometry.mapPoint3d({ x: x + u * scale, y: y + v * scale, z: z + w * scale });
      samples.push({ start, end, meta });
    }
  }

  const metaRange = quiverPointMetaRange(samples);
  return { quiver, samples, metaRange };
}

function quiverSamples(raw, domain, maxSamples) {
  if (Math.abs(domain.end - domain.start) < 1e-12) return 1;
  return axisSamples(raw, maxSamples);
}

function quiverArrowTip(quiver = {}, pointMetaScale = null) {
  const style = String(quiver["every arrow/.append style"] || quiver["every arrow"] || "");
  if (/Latex/i.test(style)) return latexArrowTip(pointMetaScale);
  if (/stealth/i.test(style)) return "-stealth";
  return "-stealth";
}

function latexArrowTip(pointMetaScale) {
  const scale = Number.isFinite(pointMetaScale) ? Math.max(0.01, pointMetaScale) : 1;
  return `-{Latex[length=${formatTipDimension(2.8 * scale)}pt,width=2.1pt]}`;
}

function formatTipDimension(value) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, "").replace(/\.$/, "");
}

function evaluateQuiverPointMeta(raw, x, axisOptions, variables) {
  if (raw === undefined || raw === null || raw === true || raw === "") return NaN;
  return evaluateAxisExpression(raw, x, axisOptions, variables);
}

function quiverPointMetaRange(samples) {
  const values = samples.map((sample) => sample.meta).filter(Number.isFinite);
  if (!values.length) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

export function quiverPointMetaScale(value, range) {
  if (!range || !Number.isFinite(value)) return null;
  const span = range.max - range.min;
  if (Math.abs(span) < 1e-12) return 1;
  return Math.max(0, Math.min(1, (value - range.min) / span));
}

function interpolateDomain(domain, index, samples) {
  const t = samples === 1 ? 0 : index / (samples - 1);
  return domain.start + (domain.end - domain.start) * t;
}

function clipDomainToRange(domain, min, max) {
  const start = Math.max(domain.start, min);
  const end = Math.min(domain.end, max);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return null;
  return { start, end };
}
