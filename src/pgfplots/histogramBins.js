import { tikzBoolean } from "../engine/options.js";
import { axisNumber } from "./coordinates.js";
import { texAdd, texDivide, texMultiply } from "./surveyFloat.js";

const MAX_BINS = 10000;
const BIN_TOLERANCE = 1e-4;

function finiteOption(value, fallback) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  return typeof value === "string" ? axisNumber(value, fallback) : fallback;
}

/**
 * Numerical survey of /pgfplots/hist. counts are the output heights;
 * rawCounts retain the original tallies. edges always includes the right
 * endpoint; intervals=false only changes the caller's emitted point stream.
 * Return null for an empty survey or a range the requested bins cannot represent.
 */
export function createHistogramBins(samples = [], config = {}) {
  const values = [];
  let min = Infinity, max = -Infinity;
  for (const sample of samples) {
    const value = finiteOption(sample, NaN);
    if (!Number.isFinite(value)) continue;
    values.push(value);
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (!values.length) return null;

  let dataMin = finiteOption(config["data min"], min);
  let dataMax = finiteOption(config["data max"], max);
  const span = dataMax - dataMin;
  if (!Number.isFinite(span)) return null;
  const requested = Math.round(finiteOption(config.bins, 10));
  let bins = requested > 0 ? Math.min(requested, MAX_BINS) : 10;
  let binWidth;
  const width = finiteOption(config["bin width"], NaN);
  if (width > 0) {
    // Local extension, not a native hist key: cover the range with whole bins.
    if (span === 0) {
      bins = 1;
      binWidth = width;
      dataMin -= width / 2;
      dataMax += width / 2;
    } else {
      bins = Math.max(1, Math.ceil(Math.abs(span) / width));
      if (bins > 1 && (bins - 1) * width >= Math.abs(span)) bins--;
      if (bins > MAX_BINS) return null;
      binWidth = Math.sign(span) * width;
      dataMax = dataMin + bins * binWidth;
    }
    if (!Number.isFinite(dataMin) || !Number.isFinite(dataMax) || dataMin === dataMax) return null;
  } else {
    if (span !== 0 && span / bins === 0) return null;
    binWidth = texDivide(texAdd(dataMax, -dataMin), bins);
    if (span !== 0 && binWidth === 0) return null;
  }
  if (!Number.isFinite(binWidth)) return null;

  const rawCounts = Array(bins).fill(0);
  // Match histgetbinfor@: width 7 has inverse .14285. Direct division
  // changes bucket assignments even with PGFPlots' 1e-4 tolerance.
  const inverseWidth = texDivide(1, binWidth);
  if (binWidth === 0) {
    // Equal observations give 0 * inf -> 0. Other observations would pass
    // +/-inf to a TeX count register and the native survey fails.
    if (min !== dataMin || max !== dataMax) return null;
    rawCounts[0] = values.length;
  } else {
    for (const value of values) {
      let index;
      if (binWidth > 0 ? value <= dataMin : value >= dataMin) index = 0;
      else if (binWidth > 0 ? value > dataMax : value < dataMax) index = bins - 1;
      else {
        const offset = texAdd(value, -dataMin);
        const position = Number.isFinite(inverseWidth) ? texMultiply(offset, inverseWidth) : offset / binWidth;
        index = Math.max(0, Math.min(bins - 1, Math.trunc(texAdd(position, BIN_TOLERANCE))));
      }
      rawCounts[index]++;
    }
  }

  const cumulative = tikzBoolean(config.cumulative);
  const density = tikzBoolean(config.density);
  const inverseCount = texDivide(1, values.length);
  const factor = density && !cumulative ? texMultiply(inverseCount, inverseWidth) : inverseCount;
  let prefix = 0;
  const counts = rawCounts.map(count => {
    prefix += count;
    const height = cumulative ? prefix : count;
    return density ? texMultiply(height, factor) : height;
  });
  if (binWidth !== 0 && counts.some(height => !Number.isFinite(height))) return null;

  const edges = Array.from({ length: bins }, (_, i) => texAdd(dataMin, texMultiply(i, binWidth)));
  edges.push(dataMax); // Native uses the exact upper bound, not another increment.
  if (!edges.every(Number.isFinite)) return null;
  return { bins, binWidth, dataMin, dataMax, edges, counts, rawCounts };
}
