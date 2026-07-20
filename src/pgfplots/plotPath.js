import { evaluateMath, parseDimension } from "../engine/math.js";
import { formatAxisPoint } from "./format.js";

export function axisPlotPointChain(points, axisOptions = {}, plotOptions = {}) {
  if (points.length < 2) return points.map(formatAxisPoint).join(" -- ");
  const cycle = Boolean(plotOptions["axis plot cycle"]);
  if (plotOptions["axis plot gap"]) {
    return gappedAxisPlotPointChain(points, plotOptions, { cycle });
  }
  if (cycle && !isConstPlot(axisOptions, plotOptions) && isSmoothAxisPlot(plotOptions, axisOptions) && points.length >= 3) {
    return smoothAxisCyclePointChain(points, plotOptions);
  }
  if (!isConstPlot(axisOptions, plotOptions) && isSmoothAxisPlot(plotOptions, axisOptions) && points.length >= 3) {
    return smoothAxisPlotPointChain(points, plotOptions);
  }
  if (!isConstPlot(axisOptions, plotOptions)) {
    const chain = points.map(formatAxisPoint).join(" -- ");
    return cycle ? `${chain} -- cycle` : chain;
  }
  const stepped = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    stepped.push({ x: current.x, y: previous.y }, current);
  }
  const chain = stepped.map(formatAxisPoint).join(" -- ");
  return cycle ? `${chain} -- cycle` : chain;
}

export function shouldRenderAxisPlotPath(options = {}) {
  if (options["only marks"]) return false;
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
  const value = plotOptions.smooth ?? axisOptions.smooth;
  if (value === undefined || value === null || value === false) return false;
  const text = String(value).trim().toLowerCase();
  return text !== "false" && text !== "0";
}

export function isConstPlot(axisOptions = {}, plotOptions = {}) {
  return Boolean(axisOptions["const plot"] || plotOptions["const plot"]);
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
  const rawTension = evaluateMath(plotOptions.tension ?? 0.5, {});
  const tension = Number.isFinite(rawTension) && rawTension > 0 ? Math.min(rawTension, 3) : 1;
  const factor = tension * 0.2775;
  const parts = [formatAxisPoint(points[0])];
  let first = points[0];
  let second = points[1];
  let firstSupport = { ...first };
  for (let index = 2; index < points.length; index += 1) {
    const current = points[index];
    const support = {
      x: (current.x - first.x) * factor,
      y: (current.y - first.y) * factor
    };
    const secondSupport = {
      x: second.x - support.x,
      y: second.y - support.y
    };
    parts.push(`.. controls ${formatAxisPoint(firstSupport)} and ${formatAxisPoint(secondSupport)} .. ${formatAxisPoint(second)}`);
    firstSupport = {
      x: second.x + support.x,
      y: second.y + support.y
    };
    first = second;
    second = current;
  }
  parts.push(`.. controls ${formatAxisPoint(firstSupport)} and ${formatAxisPoint(second)} .. ${formatAxisPoint(second)}`);
  return parts.join(" ");
}

export function smoothAxisCyclePointChain(points, plotOptions = {}) {
  if (points.length < 3) return `${points.map(formatAxisPoint).join(" -- ")} -- cycle`;
  const rawTension = evaluateMath(plotOptions.tension ?? 0.5, {});
  const tension = Number.isFinite(rawTension) && rawTension > 0 ? Math.min(rawTension, 3) : 1;
  const factor = tension * 0.2775;
  const parts = [formatAxisPoint(points[0])];
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const after = points[(index + 2) % points.length];
    const firstSupport = {
      x: current.x + (next.x - previous.x) * factor,
      y: current.y + (next.y - previous.y) * factor
    };
    const secondSupport = {
      x: next.x - (after.x - current.x) * factor,
      y: next.y - (after.y - current.y) * factor
    };
    parts.push(`.. controls ${formatAxisPoint(firstSupport)} and ${formatAxisPoint(secondSupport)} .. ${formatAxisPoint(next)}`);
  }
  parts.push("-- cycle");
  return parts.join(" ");
}
