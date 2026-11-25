import { axisNumber } from "./coordinates.js";
import { evaluateAxisExpression, evaluateAxisExpressionSamples } from "./expressions.js";
import { parseOptions, splitTopLevel } from "../engine/options.js";
import { roundAxisRange } from "./format.js";
import { pgfplotsPlotRangePoints } from "./intervalPlots.js";
import { isAxisQuiverPlot, parseQuiverOptions, quiverScale, quiverUpdatesLimits } from "./quiverOptions.js";
import { isLogAxis } from "./ranges.js";
import { axisLogBase, axisPointIsValidForScale, axisValueIsValidForScale } from "./logAxis.js";
import { samplePgfplotsSurfaceDomain } from "./sampling.js";
import { errorBarEndpoints, resolvePlotErrorBars } from "./errorBars.js";

export const PGFPLOTS_DEFAULT_ENLARGE_LIMITS = 0.1;
export const PGFPLOTS_DEFAULT_FUNCTION_DOMAIN = "-5:5";

export function computeAxisRanges(axisOptions, addplots, { enlargeZ = true, ...options } = {}) {
  const domain = parseDomain(axisOptions.domain || PGFPLOTS_DEFAULT_FUNCTION_DOMAIN);
  const hasSurfacePlot = addplots.some((plot) => isSurfacePlot(plot, axisOptions));
  const xLog = isLogAxis(axisOptions, "x");
  const yLog = isLogAxis(axisOptions, "y");
  const zLog = isLogAxis(axisOptions, "z");
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
  let errorX = false, errorY = false;
  // pgfplots.errorbars.code.tex surveys only the changed component. The
  // perpendicular cap is a physical mark, never an additional data limit.
  function surveyErrors(points, config) {
    if (!config) return;
    for (const point of points) {
      if (point.stackIgnored || !axisPointIsValidForScale(point, axisOptions)) continue;
      for (const tip of errorBarEndpoints(point, config)) {
        if (tip.axis === "x") {
          errorX = true;
          if (!hasExplicitXMin) xMin = Math.min(xMin, tip.x);
          if (!hasExplicitXMax) xMax = Math.max(xMax, tip.x);
        } else {
          errorY = true;
          if (!hasExplicitYMin) yMin = Math.min(yMin, tip.y);
          if (!hasExplicitYMax) yMax = Math.max(yMax, tip.y);
        }
      }
    }
  }
  for (const plot of addplots) {
    const errorBars = resolvePlotErrorBars(axisOptions, plot, options.diagnostics);
    if (plot.type === "coordinates") {
      surveyErrors(plot.points, errorBars);
      const surveyPoints = plot.matrixSurvey?.rangePoints ?? plot.boxplotSurveyPoints;
      for (const point of surveyPoints ?? pgfplotsPlotRangePoints(plot, axisOptions, "x")) {
        if (!axisValueIsValidForScale(point.x, axisOptions, "x")) continue;
        if (!hasExplicitXMin) xMin = Math.min(xMin, point.x);
        if (!hasExplicitXMax) xMax = Math.max(xMax, point.x);
        const stackedBaseX = Number(point.stackBaseX);
        if (axisValueIsValidForScale(stackedBaseX, axisOptions, "x")) {
          if (!hasExplicitXMin) xMin = Math.min(xMin, stackedBaseX);
          if (!hasExplicitXMax) xMax = Math.max(xMax, stackedBaseX);
        }
      }
      for (const point of surveyPoints ?? pgfplotsPlotRangePoints(plot, axisOptions, "y")) {
        if (!axisValueIsValidForScale(point.y, axisOptions, "y")) continue;
        if (!hasExplicitYMin) yMin = Math.min(yMin, point.y);
        if (!hasExplicitYMax) yMax = Math.max(yMax, point.y);
        const stackedBaseY = Number(point.stackBaseY);
        if (axisValueIsValidForScale(stackedBaseY, axisOptions, "y")) {
          if (!hasExplicitYMin) yMin = Math.min(yMin, stackedBaseY);
          if (!hasExplicitYMax) yMax = Math.max(yMax, stackedBaseY);
        }
        if (axisValueIsValidForScale(point.z, axisOptions, "z")) {
          if (!hasExplicitZMin) zMin = Math.min(zMin, point.z);
          if (!hasExplicitZMax) zMax = Math.max(zMax, point.z);
        }
      }
    }
    if (plot.type === "function") {
      const plotDomain = parseDomain(plot.options.domain || axisOptions.domain || PGFPLOTS_DEFAULT_FUNCTION_DOMAIN);
      if (plot.is3d && isAxisQuiverPlot(plot.options || {})) {
        const quiverPoints = sampleQuiverRangePoints(plot, axisOptions);
        for (const point of quiverPoints) {
          if (!axisPointIsValidForScale(point, axisOptions)) continue;
          if (!hasExplicitXMin) xMin = Math.min(xMin, point.x);
          if (!hasExplicitXMax) xMax = Math.max(xMax, point.x);
          if (!hasExplicitYMin) yMin = Math.min(yMin, point.y);
          if (!hasExplicitYMax) yMax = Math.max(yMax, point.y);
          if (!hasExplicitZMin) zMin = Math.min(zMin, point.z);
          if (!hasExplicitZMax) zMax = Math.max(zMax, point.z);
        }
        continue;
      }
      if (isSurfacePlot(plot, axisOptions)) {
        const yDomain = parseDomain(plot.options["y domain"] || axisOptions["y domain"] || axisOptions.domain || PGFPLOTS_DEFAULT_FUNCTION_DOMAIN);
        const { xSamples, ySamples } = surfaceSampleCounts(plot.options, axisOptions, options);
        const xValues = samplePgfplotsSurfaceDomain(plotDomain, xSamples, plot.options, axisOptions);
        const yValues = samplePgfplotsSurfaceDomain(yDomain, ySamples, plot.options, axisOptions);
        const zRestriction = parseZRestriction(plot.options, axisOptions);
        if (zRestriction) {
          if (!hasExplicitZMin && axisValueIsValidForScale(zRestriction.start, axisOptions, "z")) zMin = Math.min(zMin, zRestriction.start);
          if (!hasExplicitZMax && axisValueIsValidForScale(zRestriction.end, axisOptions, "z")) zMax = Math.max(zMax, zRestriction.end);
        }
        for (const x of xValues) {
          for (const y of yValues) {
            const z = restrictSurfaceZ(evaluateAxisExpression(plot.expression, x, axisOptions, { y }), zRestriction);
            // PGFPlots discards the whole point before updating any limits.
            // In particular y=0 on a log axis must not contribute a z=0.
            if (!axisPointIsValidForScale({ x, y, z }, axisOptions)) continue;
            if (!hasExplicitXMin) xMin = Math.min(xMin, x);
            if (!hasExplicitXMax) xMax = Math.max(xMax, x);
            if (!hasExplicitYMin) yMin = Math.min(yMin, y);
            if (!hasExplicitYMax) yMax = Math.max(yMax, y);
            if (!hasExplicitZMin) zMin = Math.min(zMin, z);
            if (!hasExplicitZMax) zMax = Math.max(zMax, z);
          }
        }
        continue;
      }
      const points = sampleFunctionDataPoints(plot, axisOptions, errorBars
        ? { pgfplotsSamples: options.pgfplotsSamples || 25, pgfplotsMaxSamples: 1200 }
        : { pgfplotsSamples: 80 })
        .filter((point) => axisPointIsValidForScale(point, axisOptions));
      surveyErrors(points, errorBars);
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
        ? sampleParametricSurfaceGrid(plot, axisOptions, options).grid.flat().filter(Boolean)
        : sampleParametricDataPoints(plot, axisOptions, errorBars ? options : { pgfplotsSamples: 80 });
      surveyErrors(parametricPoints, errorBars);
      for (const point of parametricPoints) {
        if (!axisPointIsValidForScale(point, axisOptions)) continue;
        if (!hasExplicitXMin) xMin = Math.min(xMin, point.x);
        if (!hasExplicitXMax) xMax = Math.max(xMax, point.x);
        if (!hasExplicitYMin) yMin = Math.min(yMin, point.y);
        if (!hasExplicitYMax) yMax = Math.max(yMax, point.y);
        if (axisValueIsValidForScale(point.z, axisOptions, "z")) {
          if (!hasExplicitZMin) zMin = Math.min(zMin, point.z);
          if (!hasExplicitZMax) zMax = Math.max(zMax, point.z);
        }
      }
      if (plot.fillAnchor) {
        if (axisPointIsValidForScale(plot.fillAnchor, axisOptions)) {
          if (!hasExplicitXMin) xMin = Math.min(xMin, plot.fillAnchor.x);
          if (!hasExplicitXMax) xMax = Math.max(xMax, plot.fillAnchor.x);
          if (!hasExplicitYMin) yMin = Math.min(yMin, plot.fillAnchor.y);
          if (!hasExplicitYMax) yMax = Math.max(yMax, plot.fillAnchor.y);
        }
      }
    }
  }
  // PGF enlarges the surveyed log limits before its empty-range fallback.
  const log2D = (xLog || yLog) && !axisOptions["pgfplots 3d surface"] && !addplots.some(plot => plot.is3d);
  const logXLimits = log2D && xLog && enlargeLogRange(axisOptions, "x", xMin, xMax, hasExplicitXMin, hasExplicitXMax);
  const logYLimits = log2D && yLog && enlargeLogRange(axisOptions, "y", yMin, yMax, hasExplicitYMin, hasExplicitYMax);
  if (logXLimits) [xMin, xMax] = logXLimits;
  if (logYLimits) [yMin, yMax] = logYLimits;
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
      const base = axisLogBase(axisOptions, "x");
      xMin = Math.max(1e-9, xMin / base);
      xMax *= base;
    } else {
      xMin -= 1;
      xMax += 1;
    }
  }
  if (yMin === yMax) {
    if (yLog) {
      const base = axisLogBase(axisOptions, "y");
      yMin = Math.max(1e-9, yMin / base);
      yMax *= base;
    } else {
      yMin -= 1;
      yMax += 1;
    }
  }
  const keepXZero = !xLog && middleAxisKeepsZeroRange(axisOptions, "x", hasExplicitYMin || hasExplicitYMax);
  const keepYZero = !yLog && middleAxisKeepsZeroRange(axisOptions, "y", hasExplicitXMin || hasExplicitXMax);
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
    if (!(xMin > 0)) xMin = 1;
    if (!(xMax > xMin)) xMax = xMin * axisLogBase(axisOptions, "x");
  }
  if (yLog) {
    if (!(yMin > 0)) yMin = 1;
    if (!(yMax > yMin)) yMax = yMin * axisLogBase(axisOptions, "y");
  }
  if (!Number.isFinite(zMin) || !Number.isFinite(zMax)) {
    zMin = zLog ? 1 : 0;
    zMax = zLog ? axisLogBase(axisOptions, "z") : 1;
  }
  if (zMin === zMax) {
    if (zLog) {
      const base = axisLogBase(axisOptions, "z");
      zMin /= base;
      zMax *= base;
    } else {
      zMin -= 1;
      zMax += 1;
    }
  }
  if (zLog) {
    if (!(zMin > 0)) zMin = 1;
    if (!(zMax > zMin)) zMax = zMin * axisLogBase(axisOptions, "z");
  }
  if (enlargeZ && !zLog && (axisOptions["pgfplots 3d surface"] || addplots.some(plot => plot.is3d))) {
    [zMin, zMax] = enlarge3DZRange(axisOptions, zMin, zMax, hasExplicitZMin, hasExplicitZMax);
  }
  // Small quartile ranges and probability densities can be below .001 in
  // data units. Keep those and the outer surface facets distinct on projection.
  const preciseFrame = hasSurfacePlot || addplots.some(plot => plot.boxplot || plot.histogram || plot.matrixSurvey);
  const ranges = {
    xMin: roundResolvedAxisValue(xMin, xLog || preciseFrame || errorX, "x"),
    xMax: roundResolvedAxisValue(xMax, xLog || preciseFrame || errorX, "x"),
    yMin: roundResolvedAxisValue(yMin, yLog || preciseFrame || errorY, "y"),
    yMax: roundResolvedAxisValue(yMax, yLog || preciseFrame || errorY, "y"),
    zMin: roundResolvedAxisValue(zMin, zLog, "z"),
    zMax: roundResolvedAxisValue(zMax, zLog, "z")
  };
  // Geometry also accepts raw, unsurveyed ranges. Mark only limits that
  // finished this phase, without altering the six public numeric fields.
  if (logXLimits || logYLimits) Object.defineProperty(ranges, "surveyedLogLimits", {
    value: { x: Boolean(logXLimits), y: Boolean(logYLimits) }
  });
  return ranges;
}

export function enlarge3DZLimits(options, ranges) {
  if (isLogAxis(options, "z")) return ranges;
  const [min, max] = enlarge3DZRange(options, ranges.zMin, ranges.zMax,
    hasAxisBound(options.zmin), hasAxisBound(options.zmax));
  return { ...ranges, zMin: roundAxisRange(min, "z"), zMax: roundAxisRange(max, "z") };
}

function enlarge3DZRange(options, min, max, explicitMin, explicitMax) {
  // @enlargelimits/auto (pgfplots.code.tex) keeps x/y tight in 3D but
  // enlarges inferred z limits. Non-boxed axes install enlarge=false.
  const raw = options["enlarge z limits"] ?? options.enlargelimits ??
    (axisUsesNonBoxedLine(options, "z") ? false : "auto");
  const value = String(raw).trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  if (["false", "off", "none", "0"].includes(value)) return [min, max];
  const config = parseOptions(value);
  const automatic = value === "auto";
  const lower = !config.upper && (!automatic || !explicitMin);
  const upper = !config.lower && (!automatic || !explicitMax);
  const relative = axisNumber(config.rel ?? config.value ?? (Number.isFinite(Number(value)) ? value : 0.1));
  const absolute = config.abs ?? config["abs value"];
  const pad = absolute === undefined ? (max - min) * relative : axisNumber(absolute);
  if (!Number.isFinite(pad) || pad < 0) return [min, max];
  return [lower ? min - pad : min, upper ? max + pad : max];
}

function roundResolvedAxisValue(value, preservePrecision, axis) {
  return preservePrecision ? Number(Number(value).toPrecision(12)) : roundAxisRange(value, axis);
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

function sampleVariable(plot, axis) {
  const raw = plot.options?.variable ?? axis.variable;
  const name = typeof raw === "string" && /^\\([A-Za-z@]+)$/.exec(raw.trim())?.[1];
  return name && name !== "x" ? name : undefined;
}

function linePlotSamples(plot, axisOptions, options) {
  const plotDomain = options.domain || parseDomain(plot.options.domain || axisOptions.domain || PGFPLOTS_DEFAULT_FUNCTION_DOMAIN);
  const explicitSamples = parseSamplesAt(plot.options["samples at"] ?? axisOptions["samples at"]);
  if (explicitSamples.length) return { values: explicitSamples, domain: { start: explicitSamples[0], end: explicitSamples.at(-1) } };
  const count = axisSamples(plot.options.samples || axisOptions.samples || options.pgfplotsSamples || 25,
    options.pgfplotsMaxSamples || options.pgfplotsSamples || 1200);
  return { values: sampleDomain(plotDomain, count), domain: plotDomain };
}

export function sampleFunctionDataPoints(plot, axisOptions = {}, options = {}) {
  const { values: sampleValues, domain: contextDomain } = linePlotSamples(plot, axisOptions, options);
  const values = evaluateAxisExpressionSamples(plot.expression, sampleValues, axisOptions, {
    domain: options.scalarSurvey ? undefined : contextDomain, sampleVariable: sampleVariable(plot, axisOptions)
  });
  if (options.scalarSurvey) return sampleValues.map((x, i) => ({ x, y: values[i] }));
  const jump = String(plot.options["unbounded coords"] ?? axisOptions["unbounded coords"] ?? "discard").trim() === "jump";
  const points = [];
  let interrupted = false;
  for (const [index, x] of sampleValues.entries()) {
    const y = values[index];
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      interrupted = true;
      continue;
    }
    points.push({ x, y, ...(jump && interrupted && points.length ? { breakBefore: true } : {}) });
    interrupted = false;
  }
  return points;
}

function sampleQuiverRangePoints(plot, axisOptions = {}) {
  const quiver = parseQuiverOptions(plot.options || {});
  const xDomain = parseDomain(plot.options.domain || axisOptions.domain || PGFPLOTS_DEFAULT_FUNCTION_DOMAIN);
  const yDomain = parseDomain(plot.options["y domain"] || axisOptions["y domain"] || axisOptions.domain || PGFPLOTS_DEFAULT_FUNCTION_DOMAIN);
  const xSamples = axisSamples(plot.options.samples || axisOptions.samples || 15, 60);
  const ySamples = axisSamples(plot.options["samples y"] || axisOptions["samples y"] || plot.options.samples || axisOptions.samples || 15, 60);
  const scale = quiverScale(quiver["scale arrows"]);
  const includeEndpoints = quiverUpdatesLimits(quiver);
  const points = [];

  for (let xIndex = 0; xIndex < xSamples; xIndex += 1) {
    const xT = xSamples === 1 ? 0 : xIndex / (xSamples - 1);
    const x = xDomain.start + (xDomain.end - xDomain.start) * xT;
    for (let yIndex = 0; yIndex < ySamples; yIndex += 1) {
      const yT = ySamples === 1 ? 0 : yIndex / (ySamples - 1);
      const y = yDomain.start + (yDomain.end - yDomain.start) * yT;
      const z = evaluateAxisExpression(plot.expression || "0", x, axisOptions, { y });
      if (![x, y, z].every(Number.isFinite)) continue;
      points.push({ x, y, z });
      if (!includeEndpoints) continue;
      const u = evaluateAxisExpression(quiver.u ?? quiver["quiver/u"] ?? "0", x, axisOptions, { y, z });
      const v = evaluateAxisExpression(quiver.v ?? quiver["quiver/v"] ?? "0", x, axisOptions, { y, z });
      const w = evaluateAxisExpression(quiver.w ?? quiver["quiver/w"] ?? "0", x, axisOptions, { y, z });
      if (![u, v, w].every(Number.isFinite)) continue;
      points.push({ x: x + u * scale, y: y + v * scale, z: z + w * scale });
    }
  }
  return points;
}

export function parseSamplesAt(raw) {
  if (raw === undefined || raw === null || raw === true || raw === false) return [];
  const text = String(raw).trim().replace(/^\{([\s\S]*)\}$/, "$1");
  return splitTopLevel(text, ",")
    .map((value) => axisNumber(value, NaN))
    .filter(Number.isFinite);
}

export function sampleParametricDataPoints(plot, axisOptions = {}, options = {}) {
  const { values } = linePlotSamples(plot, axisOptions, options);
  const context = { sampleVariable: sampleVariable(plot, axisOptions) };
  const series = expr => evaluateAxisExpressionSamples(expr, values, axisOptions, context);
  const xs = series(plot.xExpression), ys = series(plot.yExpression);
  const zs = plot.is3d && plot.zExpression !== undefined ? series(plot.zExpression) : [];
  const dataPoints = [];
  const jump = (plot.options["unbounded coords"] ?? axisOptions["unbounded coords"]) === "jump";
  let interrupted = false;
  for (let index = 0; index < values.length; index += 1) {
    const px = xs[index], py = ys[index], pz = zs[index];
    if (options.scalarSurvey || (Number.isFinite(px) && Number.isFinite(py) && (!plot.is3d || Number.isFinite(pz)))) {
      const point = plot.is3d ? { x: px, y: py, z: pz } : { x: px, y: py };
      if (interrupted && dataPoints.length) point.breakBefore = true;
      dataPoints.push(point);
      interrupted = false;
    } else interrupted = jump;
  }
  return dataPoints;
}

export function sampleParametricSurfaceGrid(plot, axisOptions = {}, options = {}) {
  const uDomain = parseDomain(plot.options.domain || axisOptions.domain || PGFPLOTS_DEFAULT_FUNCTION_DOMAIN);
  const vDomain = parseDomain(plot.options["y domain"] || axisOptions["y domain"] || axisOptions.domain || PGFPLOTS_DEFAULT_FUNCTION_DOMAIN);
  const { xSamples: uSamples, ySamples: vSamples } = surfaceSampleCounts(plot.options, axisOptions, options);
  const uValues = samplePgfplotsSurfaceDomain(uDomain, uSamples, plot.options, axisOptions);
  const vValues = samplePgfplotsSurfaceDomain(vDomain, vSamples, plot.options, axisOptions);
  const zRestriction = parseZRestriction(plot.options, axisOptions);
  const grid = vValues.map((v) => uValues.map((u) => {
    const variables = { y: v };
    const x = evaluateAxisExpression(plot.xExpression, u, axisOptions, variables);
    const y = evaluateAxisExpression(plot.yExpression, u, axisOptions, variables);
    const z = restrictSurfaceZ(evaluateAxisExpression(plot.zExpression, u, axisOptions, variables), zRestriction);
    const point = { x, y, z };
    return axisPointIsValidForScale(point, axisOptions) ? point : null;
  }));
  return { grid, uValues, vValues, uDomain, vDomain, uSamples, vSamples };
}

export function surfaceSampleCounts(plotOptions = {}, axisOptions = {}, options = {}) {
  // Native survey and replay consume the same stream. TikZ defaults to 25
  // samples; a coarser survey changes z limits, projection and label positions.
  const samples = plotOptions.samples || axisOptions.samples || options.pgfplotsSurfaceSamples || 25;
  const limit = options.pgfplotsSurfaceMaxSamples || 80;
  return {
    xSamples: axisSamples(samples, limit),
    ySamples: axisSamples(plotOptions["samples y"] || axisOptions["samples y"] || samples, limit)
  };
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

function enlargeLogRange(options, axis, min, max, explicitMin, explicitMax) {
  if (!(min > 0 && max > min && Number.isFinite(max))) return null;
  let setting = "auto";
  for (const [key, value] of Object.entries(options)) {
    if (key === "enlargelimits" || key === `enlarge ${axis} limits` || key === `enlarge ${axis} limits*`) setting = value;
    else if ((key === "axis lines" || key === `axis ${axis} line` || key === "axis") &&
      isNonBoxedAxisLineValue(normalizeAxisLineValue(value))) setting = false;
  }
  let lower = false, upper = false, relative = PGFPLOTS_DEFAULT_ENLARGE_LIMITS, absolute = null;
  const list = String(setting).trim().replace(/^\{([\s\S]*)\}$/, "$1");
  // @enlargelimits/rel and /abs enable both sides; /value and /abs value
  // change the magnitude only. Replay the keys in source order.
  for (const token of splitTopLevel(list, ",")) {
    for (const [key, value] of Object.entries(parseOptions(token))) {
      switch (key) {
        case "auto": lower = !explicitMin; upper = !explicitMax; break;
        case "true": lower = upper = true; break;
        case "false": case "off": case "none": lower = upper = false; break;
        case "lower": lower = true; upper = false; break;
        case "upper": lower = false; upper = true; break;
        case "rel": case "value":
          if (key === "rel") lower = upper = true;
          relative = axisNumber(value, NaN); absolute = null;
          break;
        case "abs": case "abs value":
          if (key === "abs") lower = upper = true;
          // Physical TeX dimensions belong to the later figure-sizing phase.
          absolute = axisNumber(value, NaN);
          break;
        default:
          lower = upper = true; relative = axisNumber(key, NaN); absolute = null;
      }
    }
  }
  if (!lower && !upper) return [min, max];
  // pgfplots@enlarge@limit@for subtracts the transformed limits in pt,
  // multiplies that original span as a TeX dimension, and ignores <= .001pt.
  // The unconfigured internal log is natural, irrespective of decimal labels.
  const basis = String(options[`log basis ${axis}`] ?? options[`log base ${axis}`] ?? "").trim().toLowerCase();
  const unit = basis && basis !== "e" ? Math.log(axisLogBase(options, axis)) : 1;
  const sp = 65536;
  const low = Math.round(Math.log(min) / unit * sp), high = Math.round(Math.log(max) / unit * sp);
  const pad = absolute === null ? Math.trunc((high - low) * Math.round(relative * sp) / sp)
    : Math.round(Math.log(absolute) / unit * sp);
  if (!Number.isFinite(pad)) return null;
  if (!(pad > Math.round(.001 * sp))) return [min, max];
  const a = lower ? Math.exp((low - pad) / sp * unit) : min;
  const b = upper ? Math.exp((high + pad) / sp * unit) : max;
  return [a > 0 ? a : min, Number.isFinite(b) ? b : max];
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
    // every non boxed <axis> axis disables enlargement for unstarred line
    // choices, including left/right. Starred choices only change geometry:
    // a right-axis overlay therefore retains automatic range padding.
    const unstarred = normalizeAxisLineValue(axisOptions[`axis ${axis} line`] ?? axisOptions["axis lines"] ?? axisOptions.axis);
    return isNonBoxedAxisLineValue(unstarred)
      ? { lower: false, upper: false }
      : { lower: "auto", upper: "auto" };
  }
  if (raw === undefined || raw === null || raw === "") return { lower: "auto", upper: "auto" };
  // Explicit enlargement belongs to the geometry transform. Applying it here
  // as well would pad the data range twice and would also lose absolute
  // forms such as {upper,abs=0.02}.
  return { lower: false, upper: false };
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
  if (!keepsZero || hasExplicitBound || !axisUsesMiddleLine(axisOptions, axis)) return false;
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
  return axisUsesMiddleLine(axisOptions, perpendicularAxis);
}

function axisUsesMiddleLine(axisOptions = {}, axis) {
  const global = normalizeAxisLineValue(axisOptions["axis lines"] ?? axisOptions.axis);
  const local = normalizeAxisLineValue(axisOptions[`axis ${axis} line`] ?? axisOptions[`axis ${axis} line*`]);
  return [global, local].some((value) => value === "middle" || value === "center");
}

function shouldKeepMiddleAxisZeroLower(value) {
  if (value !== 0) return false;
  return true;
}

function shouldKeepMiddleAxisZeroUpper(value) {
  if (value !== 0) return false;
  return true;
}
