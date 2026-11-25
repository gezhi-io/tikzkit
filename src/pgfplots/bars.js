import { parseDimension } from "../engine/math.js";
import { splitTopLevel } from "../engine/options.js";
import { axisNumber, filterUnboundedCoordinates } from "./coordinates.js";
import { pgfplotsCompatAtLeast, pgfplotsCompatLevel } from "./compat.js";
import { formatAxisPoint, joinOptions } from "./format.js";
import { isPgfplotsIntervalPlot, pgfplotsIntervalDataPoints } from "./intervalPlots.js";
import { filledPlotPaint } from "./filledPlotPaint.js";
import { mergePgfplotsOptionMaps } from "./namedOptions.js";
import { axisPlotHandler } from "./plotHandler.js";
import { plotStrokeWidthCm } from "./plotStyle.js";
import { sampleFunctionDataPoints, sampleParametricDataPoints } from "./rangeResolver.js";
import { pgfplotsStackAxis } from "./stackedPlots.js";

export function sampleFunctionBars(plots, axisOptions, options = {}) {
  if (pgfplotsStackAxis(axisOptions)) return plots;
  return plots.map(plot => {
    if (plot.is3d || (plot.type !== "function" && plot.type !== "parametric")) return plot;
    if (!["x", "y"].some(dir => isAxisBarPlot(axisOptions, plot.options, dir))) return plot;
    // Replay the same observed stream for limits, tick=data, bars and marks.
    const sample = plot.type === "function" ? sampleFunctionDataPoints : sampleParametricDataPoints;
    const points = sample(plot, axisOptions,
      { pgfplotsSamples: options.pgfplotsSamples || 25, pgfplotsMaxSamples: 1200 });
    return filterUnboundedCoordinates([{ ...plot, type: "coordinates", source: "expression",
      points, coordinateRows: [points] }], axisOptions)[0];
  });
}

// TikZ and PGFPlots forward the unqualified bar parameters to /pgf.
function barParameters(...layers) {
  const result = {};
  for (const layer of layers) {
    for (const [raw, value] of Object.entries(layer)) {
      const match = /^(?:\/(?:pgf|pgfplots|tikz)\/)?(bar (?:interval )?(?:width|shift))$/.exec(raw);
      if (match) result[match[1]] = value;
    }
  }
  return result;
}

export function isAxisBarPlot(axisOptions = {}, plotOptions = {}, axis = "y") {
  const key = axis === "x" ? "xbar" : "ybar";
  const handler = axisPlotHandler(plotOptions, axisOptions);
  return handler === key || handler === key + " interval";
}

// Count a handler's plots once, in source order, before the paint order can
// change. A bare /tikz/ybar installs a handler but not PGFPlots' bar shift auto.
export function withBarGroups(plots, axis) {
  if (optionIsEnabled(axis["stack plots"]) ||
      axis["xbar stacked"] || axis["ybar stacked"]) return plots;
  // Only the PGFPlots axis style divides each interval among plots of its
  // actual handler type. Plain /tikz/ybar interval overlays full-width bars.
  for (const dir of ["x", "y"]) {
    const style = axis[dir + "bar interval"] ?? axis["/pgfplots/" + dir + "bar interval"];
    if (!style) continue;
    const intervalPlots = plots.filter(plot => !plot.is3d && isAxisBarPlot(axis, plot.options, dir) &&
      isPgfplotsIntervalPlot(axis, plot.options, dir));
    const count = intervalPlots.length;
    const indices = new Map(intervalPlots.map((plot, index) => [plot, index]));
    const params = barParameters(axis);
    plots = plots.map(plot => !indices.has(plot) ? plot : {
      ...plot, options: mergePgfplotsOptionMaps({
        "bar interval width": params["bar interval width"] ?? ((style === true ? 1 : axisNumber(style, 1)) / count),
        "bar interval shift": params["bar interval shift"] ?? ((indices.get(plot) + .5) / count)
      }, plot.options)
    });
  }
  if (!axis.xbar && !axis.ybar && !axis["bar shift auto"]) return plots;
  const directions = plots.map(plot => {
    if (plot.is3d || plot.pgfplotsStacked) return null;
    return ["y", "x"].find(dir => isAxisBarPlot(axis, plot.options, dir) &&
      !isPgfplotsIntervalPlot(axis, plot.options, dir));
  });
  const counts = { x: 0, y: 0 }, next = { x: 0, y: 0 };
  for (const dir of directions) if (dir) counts[dir]++;
  return plots.map((plot, i) => {
    const dir = directions[i];
    return dir ? { ...plot, barGroup: { direction: dir, index: next[dir]++, count: counts[dir] } } : plot;
  });
}

export function withBarCategoryTicks(axis) {
  if (!axis.xbar && !axis.ybar) return axis;
  const expanded = {};
  const assign = (key, value) => { delete expanded[key]; expanded[key] = value; };
  for (const [key, value] of Object.entries(axis)) {
    assign(key, value);
    // The PGFPlots style changes only the category ticks, at the point the
    // style is applied. A later explicit tick alignment still wins.
    if (key === "ybar" || key === "xbar") {
      const category = key === "ybar" ? "x" : "y";
      assign(category + "tick align", "outside");
      expanded["pgfplots bar category axis"] = category;
    }
  }
  return expanded;
}

export function renderAxisBars(points, axisOptions = {}, geometry, plotOptions = {}, plotIndex = 0, orientation = "y", ranges = {}, layout, clip = "", sampled = false) {
  const paths = [];
  const spans = sampled ? [] : null;
  const interval = isPgfplotsIntervalPlot(axisOptions, plotOptions, orientation);
  const renderedPoints = interval
    ? pgfplotsIntervalDataPoints({ points, options: plotOptions }, axisOptions, orientation)
    : points;
  const ink = filledPlotPaint(plotOptions, axisOptions).style;
  const style = joinOptions(["axis bar", ink, clip]);
  layout ??= createBarLayout(axisOptions, plotOptions, geometry, orientation, ranges);
  const limits = geometry.lineRanges || geometry.transformRanges || ranges;
  const category = orientation === "y" ? "x" : "y";
  const stackBase = orientation === "y" ? "stackBaseY" : "stackBaseX";
  const params = barParameters(axisOptions, plotOptions);
  const width = axisNumber(params["bar interval width"], 1);
  const shift = axisNumber(params["bar interval shift"], .5);
  const zero = visibleAxisBaseline(limits[orientation + "Min"], limits[orientation + "Max"]);
  for (const [index, point] of renderedPoints.entries()) {
    if (point.stackIgnored) continue;
    const next = points[index + 1];
    if (interval && next.breakBefore) continue;
    const base = (interval ? next : point)[stackBase];
    let position;
    if (interval) {
      // PGF operates on the two projected edges, including their sign on a
      // reversed axis. It never substitutes the nominal data-space bin width.
      const span = geometry.mapPoint(next)[category] - geometry.mapPoint(point)[category];
      position = { halfWidth: span * width / 2, shift: span * shift };
    } else {
      position = layout(point);
    }
    const corners = canvasBarCorners(geometry, point, Number.isFinite(base) ? base : zero, orientation, position);
    if (spans) {
      const a = corners[0][category], b = corners[2][category];
      spans.push([Math.min(a, b), Math.max(a, b)]);
    }
    paths.push(corners.map(formatAxisPoint).join(" -- ") + " -- cycle");
  }
  // Keep disjoint bars addressable, but paint intersecting sampled bars only
  // once: their signed contours share a winding rule, fill alpha and stroke.
  const compound = plotOptions["pgfplots histogram"] || (spans && barSpansTouch(spans, ink));
  return (compound && paths.length ? [paths.join(" ")] : paths).map(path => `\\draw[${style}] ${path};`);
}

function barSpansTouch(spans, ink) {
  if (spans.length < 2) return false;
  const pen = plotStrokeWidthCm(ink);
  spans.sort((a, b) => a[0] - b[0]);
  return spans.some(([lo], i) => i > 0 && lo - spans[i - 1][1] <= pen + 1e-6);
}

export function createBarLayout(axis, options, geometry, direction, ranges, group) {
  const units = pgfplotsCompatAtLeast(pgfplotsCompatLevel(axis, options), "1.7");
  const length = (raw, dataUnits) => {
    const text = String(raw).trim();
    if (/(?:cm|mm|pt|em|ex|in)\b/i.test(text)) return { cm: parseDimension(text, {}) };
    const value = axisNumber(raw, 0);
    return dataUnits ? { units: value } : { cm: parseDimension(`${value}pt`, {}) };
  };
  const params = barParameters(axis, options);
  const width = length(params["bar width"] ?? "10pt", units);
  const explicit = params["bar shift"];
  const shift = explicit === undefined ? null : length(explicit, units);
  const rawGap = options["bar shift auto"] ?? axis["bar shift auto"] ?? axis[direction + "bar"];
  const gap = length(rawGap === true || rawGap === undefined ? "2pt" : rawGap, false).cm;
  const translate = axisBarCanvasShift(options.shift, direction, geometry, ranges);
  return point => {
    const project = spec => spec.cm ?? (Math.sign(spec.units) *
      2 * dataBarHalfWidth(geometry, point, Math.abs(spec.units), direction));
    const breadth = project(width);
    // pgfplots.code.tex: (i - (n-1)/2) * (width + separation).
    const displacement = shift ? project(shift) : group ? (group.index - (group.count - 1) / 2) * (breadth + gap) : 0;
    return { halfWidth: breadth / 2, shift: displacement + translate };
  };
}

function canvasBarCorners(geometry, point, baseline, orientation, { halfWidth, shift }) {
  const base = geometry.mapPoint(
    orientation === "y" ? { x: point.x, y: baseline } : { x: baseline, y: point.y }
  );
  const tip = geometry.mapPoint(point);
  if (orientation === "y") {
    const center = base.x + shift;
    return [
      { x: center - halfWidth, y: base.y },
      { x: center + halfWidth, y: base.y },
      { x: center + halfWidth, y: tip.y },
      { x: center - halfWidth, y: tip.y }
    ];
  }
  const center = base.y + shift;
  return [
    { x: base.x, y: center - halfWidth },
    { x: tip.x, y: center - halfWidth },
    { x: tip.x, y: center + halfWidth },
    { x: base.x, y: center + halfWidth }
  ];
}

function dataBarHalfWidth(geometry, point, width, orientation) {
  if (orientation === "y") {
    const left = geometry.mapPoint({ x: point.x - width / 2, y: point.y });
    const right = geometry.mapPoint({ x: point.x + width / 2, y: point.y });
    return Math.abs(right.x - left.x) / 2;
  }
  const bottom = geometry.mapPoint({ x: point.x, y: point.y - width / 2 });
  const top = geometry.mapPoint({ x: point.x, y: point.y + width / 2 });
  return Math.abs(top.y - bottom.y) / 2;
}

function visibleAxisBaseline(min, max) {
  const low = Number(min);
  const high = Number(max);
  if (Number.isFinite(low) && Number.isFinite(high)) {
    if (low <= 0 && high >= 0) return 0;
    if (low > 0) return low;
    if (high < 0) return high;
  }
  return 0;
}

function axisBarCanvasShift(raw, orientation, geometry, ranges) {
  if (raw === undefined || raw === null || raw === true || raw === false) return 0;
  const text = String(raw).trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  const match = text.match(/^\(([\s\S]*)\)$/);
  if (!match) return 0;
  const parts = splitTopLevel(match[1], ",");
  const component = String(parts[orientation === "y" ? 0 : 1] || "0").trim();
  if (/[A-Za-z]/.test(component)) {
    const dimension = parseDimension(component, {});
    return Number.isFinite(dimension) ? dimension : 0;
  }
  const amount = Number(component);
  if (!Number.isFinite(amount) || amount === 0) return 0;
  const unit = orientation === "y"
    ? Math.abs(geometry.mapPoint({ x: 1, y: ranges.yMin }).x - geometry.mapPoint({ x: 0, y: ranges.yMin }).x)
    : Math.abs(geometry.mapPoint({ x: ranges.xMin, y: 1 }).y - geometry.mapPoint({ x: ranges.xMin, y: 0 }).y);
  // PGFPlots applies a dimensionless TikZ plot shift in one tenth of the
  // current category vector; explicit dimensions remain literal canvas units.
  return amount * unit / 10;
}

function optionIsEnabled(value) {
  if (value === undefined || value === null || value === false) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== "false" && normalized !== "0" && normalized !== "off";
}
