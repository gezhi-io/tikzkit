import { formatAxisPoint, joinOptions } from "./format.js";
import { isAxisBarPlot, renderAxisBars } from "./bars.js";
import { isAxisCombPlot, renderAxisComb } from "./comb.js";
import { renderPlotMark, scatterClassOptionsForPoint, shouldRenderPlotMarks } from "./marks.js";
import { renderAxisPlotInlineNodes, renderNodesNearCoords } from "./plotNodes.js";
import {
  axisPlotPointChain,
  clampAxisBaseline,
  parametricBaselineClosedPoints,
  shouldRenderAxisPlotPath
} from "./plotPath.js";
import {
  plotFillOpacityOption,
  selectPlotColor,
  selectPlotFillStyle,
  selectPlotStyle
} from "./plotStyle.js";
import {
  isSurfacePlot,
  parseSamplesAt,
  parseDomain,
  PGFPLOTS_DEFAULT_FUNCTION_DOMAIN,
  sampleFunctionDataPoints,
  sampleParametricDataPoints
} from "./rangeResolver.js";
import { isAxisQuiverPlot, renderAxisQuiverPlot } from "./quiver.js";
import {
  isAxisRectanglePatchPlot,
  isAxisTrianglePatchPlot,
  renderAxisParametricSurfacePlot,
  renderAxisRectanglePatchCoordinatePlot,
  renderAxisSurfaceCoordinatePlot,
  renderAxisSurfacePlot,
  renderAxisTrianglePatchCoordinatePlot
} from "./surface.js";

export function renderAddplot(plot, axisOptions, ranges, geometry, options, plotIndex = 0) {
  if (plot.type === "coordinates") {
    if (isAxisTrianglePatchPlot(plot, axisOptions)) {
      return renderAxisTrianglePatchCoordinatePlot(plot, axisOptions, ranges, geometry, plotIndex);
    }
    if (isAxisRectanglePatchPlot(plot, axisOptions)) {
      return renderAxisRectanglePatchCoordinatePlot(plot, axisOptions, ranges, geometry, plotIndex);
    }
    if (isSurfacePlot(plot, axisOptions)) {
      return renderAxisSurfaceCoordinatePlot(plot, axisOptions, ranges, geometry, plotIndex);
    }
    const mappedPoints = plot.points.map((point) => plot.is3d ? geometry.mapPoint3d(point) : geometry.mapPoint(point));
    const mark = String(plot.options.mark || "").trim().toLowerCase();
    const commands = [];
    if (isAxisBarPlot(axisOptions, plot.options, "y")) {
      commands.push(...renderAxisBars(plot.points, axisOptions, geometry, plot.options, plotIndex, "y", ranges));
      commands.push(...renderNodesNearCoords(plot, axisOptions, geometry, plotIndex));
      return commands;
    }
    if (isAxisBarPlot(axisOptions, plot.options, "x")) {
      commands.push(...renderAxisBars(plot.points, axisOptions, geometry, plot.options, plotIndex, "x", ranges));
      commands.push(...renderNodesNearCoords(plot, axisOptions, geometry, plotIndex));
      return commands;
    }
    if (plot.closedCycle && mappedPoints.length) {
      const style = joinOptions(["axis closed cycle", selectPlotFillStyle(plot.options, plotIndex), plotFillOpacityOption(plot.options), "draw=none"]);
      commands.push(`\\draw[${style}] ${mappedPoints.map(formatAxisPoint).join(" -- ")} -- cycle;`);
    }
    if (isAxisCombPlot(axisOptions, plot.options, "y")) {
      commands.push(...renderAxisComb(plot.points, axisOptions, ranges, geometry, plot.options, plotIndex, "y"));
      if (shouldRenderPlotMarks(plot.options)) commands.push(...mappedPoints.map((point) => renderPlotMark(point, plot.options, plotIndex)));
      commands.push(...renderNodesNearCoords(plot, axisOptions, geometry, plotIndex));
      return commands;
    }
    if (shouldRenderAxisPlotPath(plot.options) && mappedPoints.length) {
      const style = joinOptions([
        "axis plot",
        selectPlotStyle(plot.options, plotIndex),
        pgfplotsNamePathOption(plot.options),
        pgfplotsPlotClipOption(axisOptions, geometry)
      ]);
      commands.push(`\\draw[${style}] ${axisPlotPointChain(mappedPoints, axisOptions, plot.options)};`);
    }
    if (plot.options["only marks"] || plot.options.scatter || (mark && mark !== "none")) {
      commands.push(...mappedPoints.map((point, index) => renderPlotMark(
        point,
        plot.options.scatter ? scatterClassOptionsForPoint(plot.options, plot.points[index]) : plot.options,
        plotIndex
      )));
    }
    commands.push(...renderAxisPlotInlineNodes(plot.nodes, mappedPoints, selectPlotColor(plot.options, plotIndex)));
    commands.push(...renderNodesNearCoords(plot, axisOptions, geometry, plotIndex));
    return commands;
  }
  if (plot.type === "function") {
    if (plot.is3d && isAxisQuiverPlot(plot.options)) {
      return renderAxisQuiverPlot(plot, axisOptions, ranges, geometry, options, plotIndex);
    }
    if (isSurfacePlot(plot, axisOptions)) {
      return renderAxisSurfacePlot(plot, axisOptions, ranges, geometry, options, plotIndex);
    }
    const sampled = functionPlotPoints(plot, axisOptions, ranges, geometry, options);
    if (!sampled) return [];
    const { clipRanges, dataPoints, visibleDataPoints, points } = sampled;
    if (isAxisCombPlot(axisOptions, plot.options, "y")) {
      const combDataPoints = clipAxisCombDataPoints(dataPoints, clipRanges);
      const points = combDataPoints.map((point) => geometry.mapPoint(point));
      const commands = renderAxisComb(combDataPoints, axisOptions, ranges, geometry, plot.options, plotIndex, "y");
      if (shouldRenderPlotMarks(plot.options)) commands.push(...points.map((point) => renderPlotMark(point, plot.options, plotIndex)));
      return commands;
    }
    const commands = [];
    if (plot.closedCycle && visibleDataPoints.length) {
      const baselineY = clampAxisBaseline(0, clipRanges.yMin, clipRanges.yMax);
      const first = visibleDataPoints[0];
      const last = visibleDataPoints[visibleDataPoints.length - 1];
      const closedPoints = [
        geometry.mapPoint({ x: first.x, y: baselineY }),
        ...points,
        geometry.mapPoint({ x: last.x, y: baselineY })
      ];
      const fillStyle = joinOptions(["axis closed cycle", selectPlotFillStyle(plot.options, plotIndex), plotFillOpacityOption(plot.options), "draw=none"]);
      commands.push(`\\draw[${fillStyle}] ${closedPoints.map(formatAxisPoint).join(" -- ")} -- cycle;`);
    }
    const style = joinOptions([
      "axis plot",
      selectPlotStyle(plot.options, plotIndex),
      pgfplotsNamePathOption(plot.options),
      pgfplotsPlotClipOption(axisOptions, geometry)
    ]);
    if (shouldRenderAxisPlotPath(plot.options) && points.length) commands.push(`\\draw[${style}] ${axisPlotPointChain(points, axisOptions, plot.options)};`);
    if (shouldRenderPlotMarks(plot.options)) commands.push(...points.map((point) => renderPlotMark(point, plot.options, plotIndex)));
    commands.push(...renderAxisPlotInlineNodes(plot.nodes, points, selectPlotColor(plot.options, plotIndex)));
    return commands;
  }
  if (plot.type === "parametric") {
    if (isSurfacePlot(plot, axisOptions)) {
      return renderAxisParametricSurfacePlot(plot, axisOptions, ranges, geometry, options, plotIndex);
    }
    const clipRanges = axisPlotClipRanges(ranges, geometry);
    const dataPoints = sampleParametricDataPoints(plot, axisOptions, options);
    const visibleDataPoints = plot.is3d
      ? dataPoints.filter((point) => axisPoint3dInRange(point, ranges))
      : clipAxisDataPointsToRanges(dataPoints, clipRanges);
    const points = visibleDataPoints.map((point) => plot.is3d ? geometry.mapPoint3d(point) : geometry.mapPoint(point));
    const commands = [];
    if (!plot.is3d && (plot.fillAnchor || plot.closedCycle || plot.options.fill) && points.length) {
      const closedPoints = plot.fillAnchor
        ? [...points, geometry.mapPoint(plot.fillAnchor)]
        : parametricBaselineClosedPoints(visibleDataPoints, points, clipRanges, geometry);
      const fillStyle = joinOptions(["axis closed cycle", selectPlotFillStyle(plot.options, plotIndex), plotFillOpacityOption(plot.options), "draw=none"]);
      commands.push(`\\draw[${fillStyle}] ${closedPoints.map(formatAxisPoint).join(" -- ")} -- cycle;`);
    }
    const style = joinOptions([
      "axis plot",
      selectPlotStyle(plot.options, plotIndex),
      pgfplotsNamePathOption(plot.options),
      pgfplotsPlotClipOption(axisOptions, geometry)
    ]);
    if (shouldRenderAxisPlotPath(plot.options) && points.length) commands.push(`\\draw[${style}] ${axisPlotPointChain(points, axisOptions, plot.options)};`);
    if (shouldRenderPlotMarks(plot.options)) commands.push(...points.map((point) => renderPlotMark(point, plot.options, plotIndex)));
    commands.push(...renderAxisPlotInlineNodes(plot.nodes, points, selectPlotColor(plot.options, plotIndex)));
    return commands;
  }
  return [];
}

export function renderCurrentPlotCoordinates(plot, axisOptions, ranges, geometry, options = {}) {
  const points = currentPlotMappedPoints(plot, axisOptions, ranges, geometry, options);
  if (!points.length) return [];
  return [
    `\\coordinate (current plot begin) at ${formatAxisPoint(points[0])};`,
    `\\coordinate (current plot end) at ${formatAxisPoint(points[points.length - 1])};`
  ];
}

export function currentPlotMappedPoints(plot, axisOptions, ranges, geometry, options = {}) {
  if (plot.type === "coordinates" && !isSurfacePlot(plot, axisOptions)) {
    return plot.points
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && (!plot.is3d || Number.isFinite(point.z)))
      .map((point) => plot.is3d ? geometry.mapPoint3d(point) : geometry.mapPoint(point));
  }
  if (plot.type === "function" && !isSurfacePlot(plot, axisOptions)) {
    return functionPlotPoints(plot, axisOptions, ranges, geometry, options)?.points || [];
  }
  if (plot.type === "parametric" && !isSurfacePlot(plot, axisOptions)) {
    const clipRanges = axisPlotClipRanges(ranges, geometry);
    const dataPoints = sampleParametricDataPoints(plot, axisOptions, options);
    const visible = plot.is3d
      ? dataPoints.filter((point) => axisPoint3dInRange(point, ranges))
      : clipAxisDataPointsToRanges(dataPoints, clipRanges);
    return visible.map((point) => plot.is3d ? geometry.mapPoint3d(point) : geometry.mapPoint(point));
  }
  return [];
}

function functionPlotPoints(plot, axisOptions, ranges, geometry, options) {
  const clipRanges = axisPlotClipRanges(ranges, geometry);
  const plotDomain = parseDomain(plot.options.domain || axisOptions.domain || PGFPLOTS_DEFAULT_FUNCTION_DOMAIN);
  const hasSamplesAt = parseSamplesAt(plot.options["samples at"] ?? axisOptions["samples at"]).length > 0;
  const visibleDomain = hasSamplesAt ? plotDomain : clipDomainToAxisRange(plotDomain, clipRanges);
  if (!visibleDomain) return null;
  const dataPoints = sampleFunctionDataPoints(plot, axisOptions, {
    domain: visibleDomain,
    pgfplotsSamples: options.pgfplotsSamples || 25,
    pgfplotsMaxSamples: 1200
  });
  const visibleDataPoints = clipAxisDataPointsToRanges(dataPoints, clipRanges);
  return {
    clipRanges,
    dataPoints,
    visibleDataPoints,
    points: visibleDataPoints.map((point) => geometry.mapPoint(point))
  };
}

function axisPlotClipRanges(ranges = {}, geometry = {}) {
  const visible = geometry.lineRanges || geometry.transformRanges;
  if (!visible) return ranges;
  return {
    ...ranges,
    xMin: Number.isFinite(Number(visible.xMin)) ? Number(visible.xMin) : ranges.xMin,
    xMax: Number.isFinite(Number(visible.xMax)) ? Number(visible.xMax) : ranges.xMax,
    yMin: Number.isFinite(Number(visible.yMin)) ? Number(visible.yMin) : ranges.yMin,
    yMax: Number.isFinite(Number(visible.yMax)) ? Number(visible.yMax) : ranges.yMax
  };
}

function axisPoint3dInRange(point, ranges) {
  return axisPointInRange(point, ranges)
    && (!Number.isFinite(ranges.zMin) || point.z >= ranges.zMin)
    && (!Number.isFinite(ranges.zMax) || point.z <= ranges.zMax);
}

function pgfplotsNamePathOption(options = {}) {
  const global = options["name path global"];
  const name = global ?? options["name path"];
  if (name === undefined || name === null || name === true) return "";
  const text = String(name).trim();
  return text ? `${global !== undefined ? "name path global" : "name path"}=${text}` : "";
}

function pgfplotsPlotClipOption(axisOptions = {}, geometry = {}) {
  const raw = axisOptions.clip;
  if (raw === false || String(raw ?? "").trim().toLowerCase() === "false") return "";
  const minX = Number(geometry.origin?.x);
  const minY = Number(geometry.origin?.y);
  const maxX = minX + Number(geometry.width);
  const maxY = minY + Number(geometry.height);
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return "";
  return `tikzkit clip rect={${minX},${minY},${maxX},${maxY}}`;
}

function clipAxisDataPointsToRanges(points, ranges) {
  if (points.length < 2) return points.filter((point) => axisPointInRange(point, ranges));
  const clipped = [];
  for (let index = 1; index < points.length; index += 1) {
    const segment = clipAxisSegment(points[index - 1], points[index], ranges);
    if (!segment) continue;
    appendAxisPoint(clipped, segment[0]);
    appendAxisPoint(clipped, segment[1]);
  }
  return clipped;
}

function axisPointInRange(point, ranges) {
  if (Number.isFinite(ranges.xMin) && point.x < ranges.xMin) return false;
  if (Number.isFinite(ranges.xMax) && point.x > ranges.xMax) return false;
  if (Number.isFinite(ranges.yMin) && point.y < ranges.yMin) return false;
  if (Number.isFinite(ranges.yMax) && point.y > ranges.yMax) return false;
  return true;
}

function clipAxisCombDataPoints(points, ranges) {
  return points
    .filter((point) => {
      if (Number.isFinite(ranges.xMin) && point.x < ranges.xMin) return false;
      if (Number.isFinite(ranges.xMax) && point.x > ranges.xMax) return false;
      return true;
    })
    .map((point) => ({ ...point, y: clipAxisValue(point.y, ranges.yMin, ranges.yMax) }));
}

function clipAxisValue(value, min, max) {
  let clipped = value;
  if (Number.isFinite(min)) clipped = Math.max(clipped, min);
  if (Number.isFinite(max)) clipped = Math.min(clipped, max);
  return clipped;
}

function clipAxisSegment(start, end, ranges) {
  let t0 = 0;
  let t1 = 1;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const constraints = [];
  if (Number.isFinite(ranges.xMin)) constraints.push([-dx, start.x - ranges.xMin]);
  if (Number.isFinite(ranges.xMax)) constraints.push([dx, ranges.xMax - start.x]);
  if (Number.isFinite(ranges.yMin)) constraints.push([-dy, start.y - ranges.yMin]);
  if (Number.isFinite(ranges.yMax)) constraints.push([dy, ranges.yMax - start.y]);

  for (const [p, q] of constraints) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }

  return [
    { x: start.x + dx * t0, y: start.y + dy * t0 },
    { x: start.x + dx * t1, y: start.y + dy * t1 }
  ];
}

function appendAxisPoint(points, point) {
  const previous = points[points.length - 1];
  if (previous && Math.abs(previous.x - point.x) < 1e-9 && Math.abs(previous.y - point.y) < 1e-9) return;
  points.push(point);
}

function clipDomainToAxisRange(domain, ranges) {
  const start = Math.max(domain.start, ranges.xMin);
  const end = Math.min(domain.end, ranges.xMax);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return null;
  return { start, end };
}
