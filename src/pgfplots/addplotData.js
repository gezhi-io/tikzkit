import { parseDomain, PGFPLOTS_DEFAULT_FUNCTION_DOMAIN, sampleFunctionDataPoints, sampleParametricDataPoints } from "./rangeResolver.js";

const samplesByGeometry = new WeakMap();

// Survey and paint consume the same unclipped observations. In particular a
// numeric soft clip must not evaluate an unnamed or stochastic function again.
export function sampledAddplotData(plot, axis, geometry, options = {}) {
  const cache = samplesByGeometry.get(geometry);
  const saved = cache?.get(plot);
  const { pgfplotsSamples: count, pgfplotsMaxSamples: max, domain, scalarSurvey } = options;
  if (saved && saved.axis === axis && saved.count === count && saved.max === max &&
      saved.domain === domain && saved.scalarSurvey === scalarSurvey) return saved.points;
  const points = plot.type === "parametric" ? sampleParametricDataPoints(plot, axis, options)
    : sampleFunctionDataPoints(plot, axis, {
      domain: parseDomain(plot.options.domain || axis.domain || PGFPLOTS_DEFAULT_FUNCTION_DOMAIN),
      pgfplotsSamples: options.pgfplotsSamples || 25, pgfplotsMaxSamples: 1200
    });
  if (!plot.is3d) {
    const entries = cache ?? new WeakMap();
    if (!cache) samplesByGeometry.set(geometry, entries);
    entries.set(plot, { axis, count, max, domain, scalarSurvey, points });
  }
  return points;
}
