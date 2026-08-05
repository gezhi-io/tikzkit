import { axisNumber } from "./coordinates.js";
import { evaluateAxisExpression, evaluateAxisExpressionAtSample } from "./expressions.js";
import { splitTopLevel } from "../engine/options.js";
import { roundAxis, roundAxisRange } from "./format.js";
import { pgfplotsPlotRangePoints } from "./histogram.js";
import { isLogAxis } from "./ranges.js";

export const PGFPLOTS_DEFAULT_ENLARGE_LIMITS = 0.1;
export const PGFPLOTS_DEFAULT_FUNCTION_DOMAIN = "-5:5";

export function computeAxisRanges(axisOptions, addplots) {
  const domain = parseDomain(axisOptions.domain || PGFPLOTS_DEFAULT_FUNCTION_DOMAIN);
  const hasSurfacePlot = addplots.some((plot) => isSurfacePlot(plot, axisOptions));
  const xLog = isLogAxis(axisOptions, "x");
  const yLog = isLogAxis(axisOptions, "y");
  const hasExplicitXMin = hasAxisBound(axisOptions.xmin);
  const hasExplicitXMax = hasAxisBound(axisOptions.xmax);
  const hasExplicitYMin = hasAxisBound(axisOptions.ymin);
  const hasExplicitYMax = hasAxisBound(axisOptions.ymax);
  const hasExplicitZMin = hasAxisBound(axisOptions.zmin);
  const hasExplicitZMax = hasAxisBound(axisOptions.zmax);
  let xMin = hasExplicitXMin ? axisNumber(axisOptions.xmin) : Infinity;
  let xMax = hasExplicitXMax ? axisNumber(axisOptions.xmax) : -Infinity;
  let yMin = hasExplicitYMin ? axisNumber(axisOptions.ymin) : Infinity;
  let yMax = hasExplicitYMax ? axisNumber(axisOptions.ymax) : -Infinity;
  let zMin = hasExplicitZMin ? axisNumber(axisOptions.zmin) : Infinity;
  let zMax = hasExplicitZMax ? axisNumber(axisOptions.zmax) : -Infinity;
  for (const plot of addplots) {
    if (plot.type === "coordinates") {
      for (const point of pgfplotsPlotRangePoints(plot, axisOptions, "x")) {
        if (!hasExplicitXMin) xMin = Math.min(xMin, point.x);
        if (!hasExplicitXMax) xMax = Math.max(xMax, point.x);
      }
      for (const point of pgfplotsPlotRangePoints(plot, axisOptions, "y")) {
        if (!hasExplicitYMin) yMin = Math.min(yMin, point.y);
        if (!hasExplicitYMax) yMax = Math.max(yMax, point.y);
        if (Number.isFinite(point.z)) {
          if (!hasExplicitZMin) zMin = Math.min(zMin, point.z);
          if (!hasExplicitZMax) zMax = Math.max(zMax, point.z);
        }
      }
    }
    if (plot.type === "function") {
      const plotDomain = parseDomain(plot.options.domain || axisOptions.domain || PGFPLOTS_DEFAULT_FUNCTION_DOMAIN);
      if (isSurfacePlot(plot, axisOptions)) {
        const yDomain = parseDomain(plot.options["y domain"] || axisOptions["y domain"] || axisOptions.domain || PGFPLOTS_DEFAULT_FUNCTION_DOMAIN);
        const xSamples = axisSamples(plot.options.samples || axisOptions.samples || 15, 60);
        const ySamples = axisSamples(plot.options["samples y"] || axisOptions["samples y"] || plot.options.samples || axisOptions.samples || 15, 60);
        const sampledXMin = xLog ? firstPositiveDomainSample(plotDomain, xSamples) : plotDomain.start;
        const sampledYMin = yLog ? firstPositiveDomainSample(yDomain, ySamples) : yDomain.start;
        if (!hasExplicitXMin && Number.isFinite(sampledXMin)) xMin = Math.min(xMin, sampledXMin);
        if (!hasExplicitXMax) xMax = Math.max(xMax, plotDomain.end);
        if (!hasExplicitYMin && Number.isFinite(sampledYMin)) yMin = Math.min(yMin, sampledYMin);
        if (!hasExplicitYMax) yMax = Math.max(yMax, yDomain.end);
        const zRestriction = parseZRestriction(plot.options, axisOptions);
        if (zRestriction) {
          if (!hasExplicitZMin) zMin = Math.min(zMin, zRestriction.start);
          if (!hasExplicitZMax) zMax = Math.max(zMax, zRestriction.end);
        }
        for (let xIndex = 0; xIndex < xSamples; xIndex += 1) {
          const xT = xSamples === 1 ? 0 : xIndex / (xSamples - 1);
          const x = plotDomain.start + (plotDomain.end - plotDomain.start) * xT;
          for (let yIndex = 0; yIndex < ySamples; yIndex += 1) {
            const yT = ySamples === 1 ? 0 : yIndex / (ySamples - 1);
            const y = yDomain.start + (yDomain.end - yDomain.start) * yT;
            const z = restrictSurfaceZ(evaluateAxisExpression(plot.expression, x, axisOptions, { y }), zRestriction);
            if (Number.isFinite(z)) {
              if (!hasExplicitZMin) zMin = Math.min(zMin, z);
              if (!hasExplicitZMax) zMax = Math.max(zMax, z);
            }
          }
        }
        continue;
      }
      const points = sampleFunctionDataPoints(plot, axisOptions, { pgfplotsSamples: 80 });
      if (!hasExplicitXMin) xMin = Math.min(xMin, ...points.map((point) => point.x));
      if (!hasExplicitXMax) xMax = Math.max(xMax, ...points.map((point) => point.x));
      if (!hasExplicitYMin) yMin = Math.min(yMin, ...points.map((point) => point.y));
      if (!hasExplicitYMax) yMax = Math.max(yMax, ...points.map((point) => point.y));
      if (!points.length && !hasExplicitXMin) xMin = Math.min(xMin, plotDomain.start);
      if (!points.length && !hasExplicitXMax) xMax = Math.max(xMax, plotDomain.end);
      if (points.length) {
        continue;
      }
    }
    if (plot.type === "parametric") {
      const parametricPoints = isSurfacePlot(plot, axisOptions)
        ? sampleParametricSurfaceGrid(plot, axisOptions, { pgfplotsSurfaceSamples: 40 }).grid.flat().filter(Boolean)
        : sampleParametricDataPoints(plot, axisOptions, { pgfplotsSamples: 80 });
      for (const point of parametricPoints) {
        if (!hasExplicitXMin) xMin = Math.min(xMin, point.x);
        if (!hasExplicitXMax) xMax = Math.max(xMax, point.x);
        if (!hasExplicitYMin) yMin = Math.min(yMin, point.y);
        if (!hasExplicitYMax) yMax = Math.max(yMax, point.y);
        if (Number.isFinite(point.z)) {
          if (!hasExplicitZMin) zMin = Math.min(zMin, point.z);
          if (!hasExplicitZMax) zMax = Math.max(zMax, point.z);
        }
      }
      if (plot.fillAnchor) {
        if (!hasExplicitXMin) xMin = Math.min(xMin, plot.fillAnchor.x);
        if (!hasExplicitXMax) xMax = Math.max(xMax, plot.fillAnchor.x);
        if (!hasExplicitYMin) yMin = Math.min(yMin, plot.fillAnchor.y);
        if (!hasExplicitYMax) yMax = Math.max(yMax, plot.fillAnchor.y);
      }
    }
  }
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
    yMin = yLog ? 1 : -1;
    yMax = yLog ? 10 : 1;
  }
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax)) {
    xMin = xLog ? 1 : domain.start;
    xMax = xLog ? 10 : domain.end;
  }
  if (xMin === xMax) {
    if (xLog) {
      xMin = Math.max(1e-9, xMin / 10);
      xMax *= 10;
    } else {
      xMin -= 1;
      xMax += 1;
    }
  }
  if (yMin === yMax) {
    if (yLog) {
      yMin = Math.max(1e-9, yMin / 10);
      yMax *= 10;
    } else {
      yMin -= 1;
      yMax += 1;
    }
  }
  const keepXZero = middleAxisKeepsZeroRange(axisOptions, "x", hasExplicitYMin || hasExplicitYMax);
  const keepYZero = middleAxisKeepsZeroRange(axisOptions, "y", hasExplicitXMin || hasExplicitXMax);
  if (!hasExplicitXMin && keepXZero && xMin >= 0) xMin = 0;
  if (!hasExplicitXMax && keepXZero && xMax <= 0) xMax = 0;
  if (!hasExplicitYMin && keepYZero && yMin >= 0) yMin = 0;
  if (!hasExplicitYMax && keepYZero && yMax <= 0) yMax = 0;
  const xEnlarge = axisEnlargeLimitConfig(axisOptions, "x", { hasSurfacePlot });
  const enlargeXMin = shouldApplyAxisEnlarge(xEnlarge.lower, hasExplicitXMin) ||
    shouldApplyMiddleAxisSurveyEnlarge(axisOptions, "x", "lower", keepXZero, hasExplicitXMin);
  const enlargeXMax = shouldApplyAxisEnlarge(xEnlarge.upper, hasExplicitXMax) ||
    shouldApplyMiddleAxisSurveyEnlarge(axisOptions, "x", "upper", keepXZero, hasExplicitXMax);
  if (!xLog && (enlargeXMin || enlargeXMax)) {
    const xSpan = Math.abs(xMax - xMin) || 1;
    const xPad = xSpan * PGFPLOTS_DEFAULT_ENLARGE_LIMITS;
    if (enlargeXMin) xMin = keepXZero && shouldKeepMiddleAxisZeroLower(xMin) ? 0 : xMin - xPad;
    if (enlargeXMax) xMax = keepXZero && shouldKeepMiddleAxisZeroUpper(xMax) ? 0 : xMax + xPad;
  }
  const yEnlarge = axisEnlargeLimitConfig(axisOptions, "y", { hasSurfacePlot });
  const enlargeYMin = shouldApplyAxisEnlarge(yEnlarge.lower, hasExplicitYMin) ||
    shouldApplyMiddleAxisSurveyEnlarge(axisOptions, "y", "lower", keepYZero, hasExplicitYMin);
  const enlargeYMax = shouldApplyAxisEnlarge(yEnlarge.upper, hasExplicitYMax) ||
    shouldApplyMiddleAxisSurveyEnlarge(axisOptions, "y", "upper", keepYZero, hasExplicitYMax);
  if (!yLog && (enlargeYMin || enlargeYMax)) {
    const ySpan = Math.abs(yMax - yMin) || 1;
    const yPad = ySpan * PGFPLOTS_DEFAULT_ENLARGE_LIMITS;
    if (enlargeYMin) yMin = keepYZero && shouldKeepMiddleAxisZeroLower(yMin) ? 0 : yMin - yPad;
    if (enlargeYMax) yMax = keepYZero && shouldKeepMiddleAxisZeroUpper(yMax) ? 0 : yMax + yPad;
  }
  if (xLog) {
    xMin = Math.max(1e-9, xMin);
    xMax = Math.max(xMin * 10, xMax);
  }
  if (yLog) {
    yMin = Math.max(1e-9, yMin);
    yMax = Math.max(yMin * 10, yMax);
  }
  if (!Number.isFinite(zMin) || !Number.isFinite(zMax)) {
    zMin = 0;
    zMax = 1;
  }
  if (zMin === zMax) {
    zMin -= 1;
    zMax += 1;
  }
  return {
    xMin: roundAxis(xMin),
    xMax: roundAxis(xMax),
    yMin: roundAxis(yMin),
    yMax: roundAxis(yMax),
    zMin: roundAxisRange(zMin, "z"),
    zMax: roundAxisRange(zMax, "z")
  };
}

export function parseDomain(raw) {
  const [start = "-1", end = "1"] = String(raw).split(":");
  return { start: axisNumber(start, -1), end: axisNumber(end, 1) };
}

export function axisSamples(raw, maxSamples) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 25;
  return Math.max(2, Math.min(maxSamples, Math.round(parsed)));
}

export function sampleFunctionDataPoints(plot, axisOptions = {}, options = {}) {
  const plotDomain = options.domain || parseDomain(plot.options.domain || axisOptions.domain || PGFPLOTS_DEFAULT_FUNCTION_DOMAIN);
  const explicitSamples = parseSamplesAt(plot.options["samples at"] ?? axisOptions["samples at"]);
  const sampleValues = explicitSamples.length
    ? explicitSamples
    : sampleDomain(
        plotDomain,
        axisSamples(
          plot.options.samples || axisOptions.samples || options.pgfplotsSamples || 25,
          options.pgfplotsMaxSamples || options.pgfplotsSamples || 1200
        )
      );
  const contextDomain = explicitSamples.length
    ? { start: sampleValues[0], end: sampleValues[sampleValues.length - 1] }
    : plotDomain;
  return sampleValues.flatMap((x, index) => {
    const y = evaluateAxisExpressionAtSample(plot.expression, x, axisOptions, {
      domain: contextDomain,
      index,
      samples: sampleValues.length
    });
    return Number.isFinite(x) && Number.isFinite(y) ? [{ x, y }] : [];
  });
}

export function parseSamplesAt(raw) {
  if (raw === undefined || raw === null || raw === true || raw === false) return [];
  const text = String(raw).trim().replace(/^\{([\s\S]*)\}$/, "$1");
  return splitTopLevel(text, ",")
    .map((value) => axisNumber(value, NaN))
    .filter(Number.isFinite);
}

function firstPositiveDomainSample(domain, samples) {
  let minimum = Infinity;
  for (let index = 0; index < samples; index += 1) {
    const t = samples === 1 ? 0 : index / (samples - 1);
    const value = domain.start + (domain.end - domain.start) * t;
    if (value > 0) minimum = Math.min(minimum, value);
  }
  return minimum;
}

export function sampleParametricDataPoints(plot, axisOptions = {}, options = {}) {
  const plotDomain = parseDomain(plot.options.domain || axisOptions.domain || PGFPLOTS_DEFAULT_FUNCTION_DOMAIN);
  const samples = axisSamples(plot.options.samples || axisOptions.samples || options.pgfplotsSamples || 25, options.pgfplotsSamples || 1200);
  const dataPoints = [];
  for (let index = 0; index < samples; index += 1) {
    const t = samples === 1 ? 0 : index / (samples - 1);
    const x = plotDomain.start + (plotDomain.end - plotDomain.start) * t;
    const px = evaluateAxisExpression(plot.xExpression, x, axisOptions);
    const py = evaluateAxisExpression(plot.yExpression, x, axisOptions);
    const pz = plot.is3d && plot.zExpression !== undefined
      ? evaluateAxisExpression(plot.zExpression, x, axisOptions)
      : undefined;
    if (Number.isFinite(px) && Number.isFinite(py) && (!plot.is3d || Number.isFinite(pz))) {
      dataPoints.push(plot.is3d ? { x: px, y: py, z: pz } : { x: px, y: py });
    }
  }
  return dataPoints;
}

export function sampleParametricSurfaceGrid(plot, axisOptions = {}, options = {}) {
  const uDomain = parseDomain(plot.options.domain || axisOptions.domain || PGFPLOTS_DEFAULT_FUNCTION_DOMAIN);
  const vDomain = parseDomain(plot.options["y domain"] || axisOptions["y domain"] || axisOptions.domain || PGFPLOTS_DEFAULT_FUNCTION_DOMAIN);
  const uSamples = axisSamples(
    plot.options.samples || axisOptions.samples || options.pgfplotsSurfaceSamples || 25,
    options.pgfplotsSurfaceMaxSamples || 80
  );
  const vSamples = axisSamples(
    plot.options["samples y"] || axisOptions["samples y"] || plot.options.samples || axisOptions.samples || options.pgfplotsSurfaceSamples || 25,
    options.pgfplotsSurfaceMaxSamples || 80
  );
  const uValues = sampleDomain(uDomain, uSamples);
  const vValues = sampleDomain(vDomain, vSamples);
  const zRestriction = parseZRestriction(plot.options, axisOptions);
  const grid = vValues.map((v) => uValues.map((u) => {
    const variables = { y: v };
    const x = evaluateAxisExpression(plot.xExpression, u, axisOptions, variables);
    const y = evaluateAxisExpression(plot.yExpression, u, axisOptions, variables);
    const z = restrictSurfaceZ(evaluateAxisExpression(plot.zExpression, u, axisOptions, variables), zRestriction);
    return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) ? { x, y, z } : null;
  }));
  return { grid, uValues, vValues, uDomain, vDomain, uSamples, vSamples };
}

function sampleDomain(domain, samples) {
  return Array.from({ length: samples }, (_, index) => {
    const t = samples === 1 ? 0 : index / (samples - 1);
    return domain.start + (domain.end - domain.start) * t;
  });
}

export function isSurfacePlot(plot, axisOptions = {}) {
  if (!plot?.is3d) return false;
  return isSurfaceOptions(plot.options || {}) || isSurfaceOptions(axisOptions || {});
}

export function parseZRestriction(plotOptions = {}, axisOptions = {}) {
  const raw =
    plotOptions["restrict z to domain*"] ??
    plotOptions["restrict z to domain"] ??
    axisOptions["restrict z to domain*"] ??
    axisOptions["restrict z to domain"];
  if (!raw) return null;
  const domain = parseDomain(raw);
  return {
    ...domain,
    clamp: plotOptions["restrict z to domain*"] !== undefined || axisOptions["restrict z to domain*"] !== undefined
  };
}

export function restrictSurfaceZ(value, restriction) {
  if (!Number.isFinite(value)) return NaN;
  if (!restriction) return value;
  if (value < restriction.start) return restriction.clamp ? restriction.start : NaN;
  if (value > restriction.end) return restriction.clamp ? restriction.end : NaN;
  return value;
}

function isSurfaceOptions(options = {}) {
  return Boolean(options.surf || options.mesh || options.patch);
}

function hasAxisBound(value) {
  return value !== undefined && value !== null && value !== true && String(value).trim() !== "";
}

function axisEnlargeLimitConfig(axisOptions = {}, axis, { hasSurfacePlot = false } = {}) {
  const raw =
    axisOptions[`enlarge ${axis} limits`] ??
    axisOptions[`enlarge ${axis} limits*`] ??
    axisOptions.enlargelimits;
  // PGFPlots keeps automatically inferred surface domains tight. Its 3D
  // scaling code fits the projected plot box itself, so applying the 2D 10%
  // data-range padding here shrinks every data unit and distorts the mesh.
  if ((raw === undefined || raw === null || raw === "") && hasSurfacePlot) {
    return { lower: false, upper: false };
  }
  if ((raw === undefined || raw === null || raw === "") && axisUsesNonBoxedLine(axisOptions, axis)) {
    // Middle/center axes in the legacy compatibility modes stay tight unless
    // enlargement is requested explicitly. An edge axis (notably an overlaid
    // right y-axis) still uses PGFPlots' automatic 10% data-range padding.
    // The distinction is visible in the native axis line: its frame spans the
    // enlarged range while the 0..300 ticks occupy only the inner portion.
    return axisUsesEdgeLine(axisOptions, axis)
      ? { lower: "auto", upper: "auto" }
      : { lower: false, upper: false };
  }
  if (raw === undefined || raw === null || raw === "") return { lower: "auto", upper: "auto" };
  // Explicit enlargement belongs to the geometry transform. Applying it here
  // as well would pad the data range twice and would also lose absolute
  // forms such as {upper,abs=0.02}.
  return { lower: false, upper: false };
}

function axisUsesEdgeLine(axisOptions = {}, axis) {
  const global = normalizeAxisLineValue(axisOptions["axis lines"] ?? axisOptions.axis);
  const local = normalizeAxisLineValue(axisOptions[`axis ${axis} line`] ?? axisOptions[`axis ${axis} line*`]);
  return [global, local].some((value) => ["left", "right", "top", "bottom"].includes(value));
}

function axisUsesNonBoxedLine(axisOptions = {}, axis) {
  const global = normalizeAxisLineValue(axisOptions["axis lines"] ?? axisOptions.axis);
  if (isNonBoxedAxisLineValue(global)) return true;
  const local = normalizeAxisLineValue(axisOptions[`axis ${axis} line`] ?? axisOptions[`axis ${axis} line*`]);
  return isNonBoxedAxisLineValue(local);
}

function normalizeAxisLineValue(value) {
  if (value === undefined || value === null || value === true || value === false) return "";
  return String(value).trim().toLowerCase();
}

function isNonBoxedAxisLineValue(value) {
  return value !== "" && value !== "box" && value !== "none" && value !== "false" && value !== "off";
}

function shouldApplyAxisEnlarge(flag, hasExplicitBound) {
  if (hasExplicitBound) return false;
  return flag === true || flag === "auto";
}

function shouldApplyMiddleAxisSurveyEnlarge(axisOptions, axis, side, keepsZero, hasExplicitBound) {
  // `enlargelimits=true` is applied to the surveyed range before PGFPlots
  // maps it onto the plot box. For a middle axis whose orthogonal explicit
  // range anchors a positive/negative inferred range at zero, keep that zero
  // boundary in the public range and add the requested 10% to its inferred
  // far end. The geometry layer then supplies the opposite visual reserve.
  // Applying this to arbitrary fully inferred middle ranges would duplicate
  // the transform-layer enlargement, so it is intentionally limited to the
  // zero-preserving family.
  if (!keepsZero || hasExplicitBound || !axisUsesNonBoxedLine(axisOptions, axis)) return false;
  const raw = axisOptions[`enlarge ${axis} limits`] ?? axisOptions[`enlarge ${axis} limits*`] ?? axisOptions.enlargelimits;
  if (raw === undefined || raw === null || raw === "" || raw === false) return false;
  const value = String(raw).trim().replace(/^\{([\s\S]*)\}$/, "$1").trim().toLowerCase();
  if (!value || ["false", "0", "off", "none", "auto"].includes(value)) return false;
  if (side === "lower") return !/(?:^|,)\s*upper\s*(?:,|$)/.test(value);
  return !/(?:^|,)\s*lower\s*(?:,|$)/.test(value);
}

function middleAxisKeepsZeroRange(axisOptions = {}, axis, perpendicularAxisHasExplicitBound = false) {
  if (!perpendicularAxisHasExplicitBound) return false;
  const perpendicularAxis = axis === "x" ? "y" : "x";
  return axisUsesNonBoxedLine(axisOptions, perpendicularAxis);
}

function shouldKeepMiddleAxisZeroLower(value) {
  if (value !== 0) return false;
  return true;
}

function shouldKeepMiddleAxisZeroUpper(value) {
  if (value !== 0) return false;
  return true;
}
