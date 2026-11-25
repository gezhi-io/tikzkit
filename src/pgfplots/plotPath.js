import { evaluateMath, parseDimension } from "../engine/math.js";
import { smoothPlotCommands } from "../pgf/smoothPlot.js";
import { isStepPlotHandler, stepPlotCommands } from "../pgf/stepPlot.js";
import { formatAxisPathCommands, formatAxisPoint } from "./format.js";
import { axisPlotHandler } from "./plotHandler.js";

export function axisPlotPointChain(points, axisOptions = {}, plotOptions = {}, options = {}) {
  if (points.some((point) => point.breakBefore)) {
    return splitAxisPlotPointRuns(points)
      .map((run) => axisPlotPointChain(run, axisOptions, plotOptions, options)).filter(Boolean).join(" ");
  }
  if (!points.length) return "";
  const handler = axisPlotHandler(plotOptions, axisOptions);
  // Datavisualization lowers its cyclic visualizer to an internal cycle key.
  // Neither that key nor a closed-curve handler is a trailing TikZ "-- cycle".
  const cycle = Boolean(plotOptions["axis plot cycle"] ?? axisOptions["axis plot cycle"]);
  if (plotOptions["axis plot gap"]) {
    return gappedAxisPlotPointChain(points, plotOptions, { cycle });
  }
  if (handler === "smooth" || handler === "smooth cycle") {
    return smoothPointChain(points, handler === "smooth cycle" || cycle, plotOptions, axisOptions);
  }
  if (handler === "only marks") return "";
  // PGFPlots mirrors only connected const handlers on a reversed stacked baseline.
  const mirror = Boolean(options.mirrorConstPlot) && handler.startsWith("const plot");
  const chain = isStepPlotHandler(handler)
    ? formatAxisPathCommands(stepPlotCommands(points, handler, { mirror }))
    : points.map(formatAxisPoint).join(" -- ");
  return cycle || handler === "sharp cycle" ? `${chain} -- cycle` : chain;
}

export function splitAxisPlotPointRuns(points) {
  const runs = [];
  for (const { breakBefore, ...point } of points) {
    if (!runs.length || breakBefore) runs.push([]);
    runs[runs.length - 1].push(point);
  }
  return runs;
}

export function shouldRenderAxisPlotPath(options = {}, axisOptions = {}) {
  if (axisPlotHandler(options, axisOptions) === "only marks") return false;
  const draw = String(options.draw || "").trim().toLowerCase();
  if (draw !== "none" && draw !== "false" && draw !== "off") return true;
  return Boolean(options["name path"] || options["name path global"]);
}

export function parametricBaselineClosedPoints(dataPoints, mappedPoints, ranges, geometry) {
  if (!dataPoints.length || !mappedPoints.length) return mappedPoints;
  const baselineY = clampAxisBaseline(0, ranges.yMin, ranges.yMax);
  const first = dataPoints[0];
  const last = dataPoints[dataPoints.length - 1];
  return [
    geometry.mapPoint({ x: first.x, y: baselineY }),
    ...mappedPoints,
    geometry.mapPoint({ x: last.x, y: baselineY })
  ];
}

export function clampAxisBaseline(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function isSmoothAxisPlot(plotOptions = {}, axisOptions = {}) {
  const handler = axisPlotHandler(plotOptions, axisOptions);
  return handler === "smooth" || handler === "smooth cycle";
}

export function isConstPlot(axisOptions = {}, plotOptions = {}) {
  return axisPlotHandler(plotOptions, axisOptions).startsWith("const plot");
}

export function gappedAxisPlotPointChain(points, plotOptions = {}, options = {}) {
  const gap = axisPlotGapDistance(plotOptions);
  const segments = [];
  for (let index = 1; index < points.length; index += 1) {
    const segment = shortenedAxisSegment(points[index - 1], points[index], gap);
    if (segment) segments.push(segment);
  }
  if (options.cycle && points.length > 2) {
    const closing = shortenedAxisSegment(points[points.length - 1], points[0], gap);
    if (closing) segments.push(closing);
  }
  return segments
    .map(([from, to]) => `${formatAxisPoint(from)} -- ${formatAxisPoint(to)}`)
    .join(" ");
}

export function axisPlotGapDistance(plotOptions = {}) {
  const value = parseDimension(plotOptions["axis plot gap"] || "1.5pt", {});
  return Number.isFinite(value) && value > 0 ? value : parseDimension("1.5pt", {});
}

export function shortenedAxisSegment(from, to, gap) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= 1e-9) return null;
  const usableGap = Math.max(0, Math.min(gap, length / 2 - 1e-6));
  if (usableGap <= 0) return null;
  const ratio = usableGap / length;
  return [
    { x: from.x + dx * ratio, y: from.y + dy * ratio },
    { x: to.x - dx * ratio, y: to.y - dy * ratio }
  ];
}

export function smoothAxisPlotPointChain(points, plotOptions = {}) {
  return smoothPointChain(points, false, plotOptions);
}

export function smoothAxisCyclePointChain(points, plotOptions = {}) {
  return smoothPointChain(points, true, plotOptions);
}

function smoothPointChain(points, closed, plotOptions, axisOptions = {}) {
  let tension;
  for (const layer of [axisOptions, plotOptions]) {
    for (const [key, raw] of Object.entries(layer)) {
      if (key === "tension" || key === "/tikz/tension") tension = evaluateMath(raw, {});
    }
  }
  return formatAxisPathCommands(smoothPlotCommands(points, { closed, tension }));
}
