import { isStepPlotHandler } from "../pgf/stepPlot.js";
import { lineToCommand } from "../engine/pathBuilder.js";
import { formatAxisPoint, joinOptions } from "./format.js";
import { createBarLayout, isAxisBarPlot, renderAxisBars } from "./bars.js";
import { renderBoxplot } from "./boxplotPaint.js";
import { renderMatrixPlot } from "./matrixPaint.js";
import { filledPlotPaint } from "./filledPlotPaint.js";
import { isAxisCombPlot, renderAxisComb } from "./comb.js";
import { renderPlotMark, scatterClassOptionsForPoint, shouldRenderPlotMarks } from "./marks.js";
import { selectedPlotMarkIndices } from "./markSelection.js";
import { createNodeNearCoordRenderer, renderAxisPlotInlineNodes } from "./plotNodes.js";
import { renderAxisErrorBars } from "./errorBarPaint.js";
import {
  axisPlotPointChain,
  axisPlotPathCommands,
  axisPlotPathName,
  clampAxisBaseline,
  splitAxisPlotPointRuns,
  shouldRenderAxisPlotPath
} from "./plotPath.js";
import { axisPlotHandler } from "./plotHandler.js";
import { selectPlotColor, selectPlotStyle } from "./plotStyle.js";
import { isSurfacePlot } from "./rangeResolver.js";
import { sampledAddplotData } from "./addplotData.js";
import { isAxisQuiverPlot, renderAxisQuiverPlot } from "./quiver.js";
import {
  isAxisLinePatchPlot,
  isAxisRectanglePatchPlot,
  isAxisTrianglePatchPlot,
  renderAxisParametricSurfacePlot,
  renderAxisLinePatchCoordinatePlot,
  renderAxisRectanglePatchCoordinatePlot,
  renderAxisSurfaceCoordinatePlot,
  renderAxisSurfacePlot,
  renderAxisTrianglePatchCoordinatePlot
} from "./surface.js";
import { axisPointIsValidForScale } from "./logAxis.js";
import { stackedClosedCyclePointChain } from "./areaPlots.js";
import { applyAxisClipOption, axisClipRectangle, axisViewportClipOption } from "./clipping.js";
import { transformAxisStatementCoordinates } from "./axisOverlay.js";
import { pgfplotsCompatLevel, pgfplotsEmptyLineBreaks } from "./compat.js";

const plotTransformKey = /^(?:scale|[xy]scale|[xy]slant|rotate|(?:scale|rotate) around|[xy]?shift|cm)$/;

export function renderAddplot(plot, axisOptions, ranges, geometry, options = {}, plotIndex = 0, afterAxisMarks = null) {
  if (plot.matrixSurvey) return renderMatrixPlot(plot, axisOptions, ranges, geometry, afterAxisMarks, options.variables);
  if (plot.boxplot) return renderBoxplot(plot, axisOptions, ranges, geometry, plotIndex, afterAxisMarks, options.variables);
  const scope = linePlotTransformScope(plot, axisOptions, ranges, geometry);
  const later = scope.length && afterAxisMarks ? [] : afterAxisMarks;
  const commands = renderAddplotContent(plot, axisOptions, ranges, geometry, options, plotIndex, later);
  if (later !== afterAxisMarks) afterAxisMarks.push(...inPlotScope(later, scope));
  if (!isSurfacePlot(plot, axisOptions) && !axisOptions.patch && !plot.options?.patch) return inPlotScope(commands, scope);
  // Native PGFPlots clips both surface fill and mesh strokes to the projected
  // axis hull. Axis descriptions are lowered separately and remain unclipped.
  const clip = axisViewportClipOption(axisOptions, ranges, geometry);
  // Mesh handlers use PGF's quick paint primitives, bypassing the ordinary
  // path hook that adds half the pen width to the picture bounding box.
  const paintOptions = ["tikzkit quick path", clip].filter(Boolean).join(", ");
  return commands.map(command => applyAxisClipOption(command, paintOptions));
}

function renderAddplotContent(plot, axisOptions, ranges, geometry, options, plotIndex, afterAxisMarks) {
  const addMarks = (commands, dataPoints, inks, layout) => (afterAxisMarks ?? commands).push(
    ...renderAxisPlotMarks(plot, dataPoints, axisOptions, ranges, geometry, plotIndex, options.variables, inks, layout));
  if (plot.type === "coordinates") {
    if (isAxisLinePatchPlot(plot, axisOptions)) {
      return renderAxisLinePatchCoordinatePlot(plot, axisOptions, ranges, geometry, plotIndex);
    }
    if (isAxisTrianglePatchPlot(plot, axisOptions)) {
      return renderAxisTrianglePatchCoordinatePlot(plot, axisOptions, ranges, geometry, plotIndex);
    }
    if (isAxisRectanglePatchPlot(plot, axisOptions)) {
      return renderAxisRectanglePatchCoordinatePlot(plot, axisOptions, ranges, geometry, plotIndex);
    }
    if (isSurfacePlot(plot, axisOptions)) {
      return renderAxisSurfaceCoordinatePlot(plot, axisOptions, ranges, geometry, plotIndex);
    }
    const dataPoints = coordinatePlotSamples(plot, axisOptions);
    const mappedPoints = mapPlotPoints(dataPoints, plot, geometry);
    const commands = [];
    const histPaint = plot.options["pgfplots histogram"] ? filledPlotPaint(plot.options, axisOptions) : null;
    const barAxis = ["y", "x"].find(axis => isAxisBarPlot(axisOptions, plot.options, axis));
    if (barAxis) {
      const layout = createBarLayout(axisOptions, plot.options, geometry, barAxis, ranges, plot.barGroup);
      const clip = axisViewportClipOption(axisOptions["clip mode"] === "individual"
        ? { clip: plot.options.clip ?? axisOptions.clip } : axisOptions, ranges, geometry);
      commands.push(...renderAxisBars(dataPoints, axisOptions, geometry, plot.options, plotIndex, barAxis, ranges, layout, clip,
        plot.source === "expression"));
      commands.push(...renderAxisErrorBars(plot, dataPoints, axisOptions, ranges, geometry, plotIndex, barAxis, layout));
      addMarks(commands, dataPoints, (histPaint ?? filledPlotPaint(plot.options, axisOptions)).mark, layout);
      return commands;
    }
    const combAxis = ["y", "x"].find(axis => isAxisCombPlot(axisOptions, plot.options, axis));
    if (combAxis) {
      commands.push(...renderAxisComb(dataPoints, axisOptions, ranges, geometry, plot.options, plotIndex, combAxis));
      commands.push(...renderAxisErrorBars(plot, dataPoints, axisOptions, ranges, geometry, plotIndex));
      addMarks(commands, dataPoints);
      return commands;
    }
    commands.push(...renderLinePlotPath(plot, dataPoints, mappedPoints, axisOptions, ranges, geometry, plotIndex, histPaint));
    commands.push(...renderAxisErrorBars(plot, dataPoints, axisOptions, ranges, geometry, plotIndex));
    commands.push(...renderAxisPlotInlineNodes(plot.nodes, mappedPoints, selectPlotColor(plot.options, plotIndex)));
    addMarks(commands, dataPoints, histPaint?.mark);
    return commands;
  }
  if (plot.type === "function") {
    if (plot.is3d && isAxisQuiverPlot(plot.options)) {
      return renderAxisQuiverPlot(plot, axisOptions, ranges, geometry, options, plotIndex);
    }
    if (isSurfacePlot(plot, axisOptions)) {
      return renderAxisSurfacePlot(plot, axisOptions, ranges, geometry, options, plotIndex);
    }
    const { clipRanges, dataPoints, visibleDataPoints, points } = sampledLinePlotPoints(plot, axisOptions, ranges, geometry, options);
    const combAxis = ["y", "x"].find(axis => isAxisCombPlot(axisOptions, plot.options, axis));
    if (combAxis) {
      const combDataPoints = combAxis === "y" ? clipAxisCombDataPoints(dataPoints, clipRanges) : dataPoints;
      const commands = renderAxisComb(combDataPoints, axisOptions, ranges, geometry, plot.options, plotIndex, combAxis);
      commands.push(...renderAxisErrorBars(plot, dataPoints, axisOptions, ranges, geometry, plotIndex));
      addMarks(commands, dataPoints);
      return commands;
    }
    const commands = renderLinePlotPath(plot, visibleDataPoints, points, axisOptions, ranges, geometry, plotIndex);
    commands.push(...renderAxisErrorBars(plot, dataPoints, axisOptions, ranges, geometry, plotIndex));
    commands.push(...renderAxisPlotInlineNodes(plot.nodes, points, selectPlotColor(plot.options, plotIndex)));
    addMarks(commands, dataPoints);
    return commands;
  }
  if (plot.type === "parametric") {
    if (isSurfacePlot(plot, axisOptions)) {
      return renderAxisParametricSurfacePlot(plot, axisOptions, ranges, geometry, options, plotIndex);
    }
    const { raw, dataPoints, visibleDataPoints, points } = sampledLinePlotPoints(plot, axisOptions, ranges, geometry, options);
    const commands = renderLinePlotPath(plot, visibleDataPoints, points, axisOptions, ranges, geometry, plotIndex);
    commands.push(...renderAxisErrorBars(plot, raw, axisOptions, ranges, geometry, plotIndex));
    commands.push(...renderAxisPlotInlineNodes(plot.nodes, points, selectPlotColor(plot.options, plotIndex)));
    addMarks(commands, dataPoints);
    return commands;
  }
  return [];
}

function renderLinePlotPath(plot, dataPoints, points, axisOptions, ranges, geometry, plotIndex, histPaint) {
  if (!points.length) return [];
  const opts = plot.options;
  const painted = histPaint || (plot.closedCycle || opts.fill !== undefined || opts.pattern || opts["/tikz/pattern"]
    ? filledPlotPaint(opts, axisOptions) : null);
  const drawPath = shouldRenderAxisPlotPath(opts, axisOptions);
  if (!drawPath && (!painted || painted.fillStyle === "fill=none")) return [];
  const limits = axisPlotClipRanges(ranges, geometry);
  let path = plot.closedCycle && stackedClosedCyclePointChain(plot, dataPoints, points, axisOptions, geometry, limits);
  if (!path) {
    path = axisPlotPointChain(points, axisOptions, opts);
    if (!path) return [];
    if (plot.fillAnchor) path += " -- " + formatAxisPoint(geometry.mapPoint(plot.fillAnchor));
    if (plot.closedCycle) {
      // PGFPlots appends |- (first data x, zero y) -- cycle *after* the
      // entire plot stream. Even a cyclic handler uses the last data x here.
      const zero = clampAxisBaseline(0, limits.yMin, limits.yMax);
      const y = geometry.mapPoint({ x: dataPoints[0].x, y: zero }).y;
      path += ` -- ${formatAxisPoint({ x: points.at(-1).x, y })} -- ${formatAxisPoint({ x: points[0].x, y })} -- cycle`;
    }
  }
  if (plot.pathCycle) path += " -- cycle";
  const areaRole = plot.fillAnchor || (plot.closedCycle && (plot.type === "coordinates" || !drawPath));
  const style = joinOptions(["axis plot", areaRole && "axis closed cycle",
    painted?.style ?? selectPlotStyle(opts, plotIndex), pgfplotsNamePathOption(opts), pgfplotsPlotClipOption(axisOptions, geometry)]);
  return [`\\draw[${style}] ${path};`];
}

function mapPlotPoints(points, plot, geometry) {
  return points.map(point => {
    const mapped = plot.is3d ? geometry.mapPoint3d(point) : geometry.mapPoint(point);
    return point.breakBefore ? { ...mapped, breakBefore: true } : mapped;
  });
}

function coordinatePlotSamples(plot, axisOptions) {
  const rows = plot.coordinateRows ?? plot.points.rows;
  const breakAtRows = rows?.length > 1 && pgfplotsEmptyLineBreaks(plot.options["empty line"] ?? axisOptions["empty line"],
    plot.options["compat/empty line"] ?? axisOptions["compat/empty line"] ?? pgfplotsCompatLevel(axisOptions, plot.options));
  const stream = breakAtRows ? rows.flatMap((row, i) =>
    i && row.length ? [{ ...row[0], breakBefore: true }, ...row.slice(1)] : row) : plot.points;
  return validPlotSamples(stream.filter(point => !point.stackIgnored), plot, axisOptions);
}

export function namedAxisLinePlotCommands(plot, axis, ranges, geometry, options = {}) {
  if (plot.is3d || plot.boxplot || plot.matrixSurvey || axis.patch || plot.options.patch ||
      plot.closedCycle || plot.pathCycle || !["coordinates", "function", "parametric"].includes(plot.type)) return [];
  const handler = axisPlotHandler(plot.options, axis);
  if (!(handler === "sharp plot" || handler === "smooth" || isStepPlotHandler(handler)) ||
      Object.keys(plot.options).some(raw => {
        const key = raw.replace(/^\/tikz\//, "");
        return plotTransformKey.test(key) || key === "rounded corners" || key === "decorate";
      })) return [];
  let points;
  if (plot.type === "coordinates") {
    points = mapPlotPoints(coordinatePlotSamples(plot, axis), plot, geometry);
  } else {
    const sampled = sampledLinePlotPoints(plot, axis, ranges, geometry, options);
    // Fill-between captures the natural contour. The ordinary painted sharp
    // line (also used for named intersections) keeps its clipped endpoints.
    points = sampled.dataPoints === sampled.visibleDataPoints ? sampled.points : mapPlotPoints(sampled.dataPoints, plot, geometry);
  }
  const commands = axisPlotPathCommands(points, axis, plot.options);
  if (commands.length && plot.fillAnchor) commands.push(lineToCommand(geometry.mapPoint(plot.fillAnchor)));
  return commands.some(c => c.type === "closePath") ? [] : commands;
}

function linePlotTransformScope(plot, axis, ranges, geometry) {
  const keys = Object.entries(plot.options || {}).map(([key, value]) => [key.replace(/^\/tikz\//, ""), value])
    .filter(([key]) => plotTransformKey.test(key));
  if (!keys.length || plot.boxplot || plot.matrixSurvey || isSurfacePlot(plot, axis) || axis.patch || plot.options.patch ||
      ["x", "y"].some(dir => isAxisBarPlot(axis, plot.options, dir) || isAxisCombPlot(axis, plot.options, dir))) return [];
  // PGF transforms the plot in the axis' local frame. The lowered points
  // already include axis placement and reversal; keep that origin fixed.
  const r = geometry.transformRanges || ranges;
  const min = { x: r.xMin, y: r.yMin, z: r.zMin };
  const origin = plot.is3d ? geometry.mapPoint3d(min) : geometry.mapPoint(min);
  const transform = keys.map(([key, value]) =>
    `${key}={${transformAxisStatementCoordinates(value, r, geometry, origin)}}`).join(",");
  if (!origin.x && !origin.y) return [transform];
  return ["shift={" + formatAxisPoint(origin) + "}", transform,
    "shift={" + formatAxisPoint({ x: -origin.x, y: -origin.y }) + "}"];
}

function inPlotScope(commands, scope) {
  return scope.length && commands.length ? [...scope.map(options => "{[" + options + "]"), ...commands,
    ...scope.map(() => "}")] : commands;
}

export function renderCurrentPlotCoordinates(plot, axisOptions, ranges, geometry, options = {}) {
  const points = currentPlotMappedPoints(plot, axisOptions, ranges, geometry, options);
  if (!points.length) return [];
  return inPlotScope([
    `\\coordinate (current plot begin) at ${formatAxisPoint(points[0])};`,
    `\\coordinate (current plot end) at ${formatAxisPoint(points[points.length - 1])};`
  ], linePlotTransformScope(plot, axisOptions, ranges, geometry));
}

export function currentPlotMappedPoints(plot, axisOptions, ranges, geometry, options = {}) {
  if (plot.is3d && isAxisQuiverPlot(plot.options || {})) return [];
  if (plot.type === "coordinates" && !isSurfacePlot(plot, axisOptions)) {
    return plot.points
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && (!plot.is3d || Number.isFinite(point.z)))
      .filter((point) => axisPointIsValidForScale(point, axisOptions))
      .map((point) => plot.is3d ? geometry.mapPoint3d(point) : geometry.mapPoint(point));
  }
  if ((plot.type === "function" || plot.type === "parametric") && !isSurfacePlot(plot, axisOptions)) {
    return sampledLinePlotPoints(plot, axisOptions, ranges, geometry, options).points;
  }
  return [];
}

// A named expression is visited for fill-between, the outline and its current
// plot coordinates. Reuse one survey within the same axis rendering.
const namedSampleStreams = new WeakMap();

function sampledLinePlotPoints(plot, axisOptions, ranges, geometry, options) {
  const saved = namedSampleStreams.get(plot);
  if (saved && saved.geometry === geometry && saved.ranges === ranges && saved.axisOptions === axisOptions &&
      saved.options === options) return saved.stream;
  const clipRanges = axisPlotClipRanges(ranges, geometry);
  const raw = sampledAddplotData(plot, axisOptions, geometry, options);
  const dataPoints = validPlotSamples(raw, plot, axisOptions);
  const visibleDataPoints = clipPlotSamples(dataPoints, plot, axisOptions, clipRanges);
  const stream = { raw, clipRanges, dataPoints, visibleDataPoints, points: mapPlotPoints(visibleDataPoints, plot, geometry) };
  if (!plot.is3d && axisPlotPathName(plot.options)) namedSampleStreams.set(plot, { geometry, ranges, axisOptions, options, stream });
  return stream;
}

function validPlotSamples(dataPoints, plot, axisOptions) {
  const jump = (plot.options["unbounded coords"] ?? axisOptions["unbounded coords"]) === "jump";
  const valid = [];
  let interrupted = false;
  for (const point of dataPoints) {
    if (!axisPointIsValidForScale(point, axisOptions)) {
      interrupted = jump || interrupted || point.breakBefore;
      continue;
    }
    valid.push(interrupted && valid.length ? { ...point, breakBefore: true } : point);
    interrupted = false;
  }
  return valid;
}

function clipPlotSamples(valid, plot, axisOptions, clipRanges) {
  // PGF clips the painted path. Clipping the sample chords instead can
  // erase visible step corners, change spline tangents or truncate fills.
  const opts = plot.options;
  const handler = axisPlotHandler(opts, axisOptions);
  if (isStepPlotHandler(handler) || handler === "smooth" || handler === "smooth cycle" ||
      plot.closedCycle || plot.pathCycle || plot.fillAnchor ||
      opts.fill || opts.pattern || opts["/tikz/pattern"] ||
      Object.keys(opts).some(key => plotTransformKey.test(key.replace(/^\/tikz\//, "")))) return valid;
  if (plot.is3d) return valid.filter(point => axisPoint3dInRange(point, clipRanges));
  return pgfplotsClipEnabled(axisOptions) ? clipAxisDataPointsToRanges(valid, clipRanges) : valid;
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
  const global = options["name path global"] ?? options["/tikz/name path global"];
  const name = axisPlotPathName(options);
  return name ? `${global !== undefined ? "name path global" : "name path"}=${name}` : "";
}

function pgfplotsPlotClipOption(axisOptions = {}, geometry = {}) {
  const raw = axisOptions.clip;
  if (raw === false || String(raw ?? "").trim().toLowerCase() === "false") return "";
  const rect = axisClipRectangle(geometry);
  if (!rect) return "";
  const { minX, minY, maxX, maxY } = rect;
  return `tikzkit clip rect={${minX},${minY},${maxX},${maxY}}`;
}

function renderAxisPlotMarks(plot, dataPoints, axis, ranges, geometry, plotIndex, variables, inks, layout) {
  const options = plot.options;
  const scatter = axisBooleanOption(options.scatter ?? axis.scatter, false);
  const draw = shouldRenderPlotMarks(options, axis);
  if (!draw && !scatter && !options["nodes near coords"] && !axis["nodes near coords"]) return [];
  const clip = pgfplotsMarkerClipOption(axis, options, ranges, geometry);
  const node = createNodeNearCoordRenderer(plot, axis, geometry, plotIndex, layout, clip);
  const scatterOptions = scatter ? { "scatter/classes": axis["scatter/classes"], ...options, scatter: true } : null;
  const commands = [];
  for (const index of selectedPlotMarkIndices(plot, dataPoints, axis, axisPlotClipRanges(ranges, geometry), variables)) {
    const point = dataPoints[index];
    const glyph = scatter && scatterClassOptionsForPoint(scatterOptions, point);
    if (glyph ? shouldRenderPlotMarks(glyph, axis) : draw) {
      const at = plot.is3d ? geometry.mapPoint3d(point) : geometry.mapPoint(point);
      commands.push(renderPlotMark(at, glyph || options, plotIndex, inks, clip));
    }
    if (node) commands.push(node(point, index));
  }
  return commands;
}

function pgfplotsMarkerClipOption(axis, options, ranges, geometry) {
  if (!axisBooleanOption(options["clip marker paths"] ?? axis["clip marker paths"], false)) return "";
  // In global mode the surrounding axis installed the clip; in individual
  // mode each series installs its own. Center rejection is separate.
  const clip = (options["clip mode"] ?? axis["clip mode"]) === "individual" ? options.clip ?? axis.clip : axis.clip;
  return axisViewportClipOption({ clip }, ranges, geometry);
}

function pgfplotsClipEnabled(axisOptions = {}) {
  return axisBooleanOption(axisOptions.clip, true);
}

function axisBooleanOption(raw, fallback) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  if (raw === true || raw === false) return raw;
  const normalized = String(raw).trim().toLowerCase();
  if (["false", "0", "off", "no"].includes(normalized)) return false;
  if (["true", "1", "on", "yes"].includes(normalized)) return true;
  return fallback;
}

function clipAxisDataPointsToRanges(points, ranges) {
  if (points.some((point) => point.breakBefore)) {
    const clipped = [];
    for (const run of splitAxisPlotPointRuns(points)) {
      const visible = clipAxisDataPointsToRanges(run, ranges);
      if (visible.length && clipped.length) visible[0] = { ...visible[0], breakBefore: true };
      clipped.push(...visible);
    }
    return clipped;
  }
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
