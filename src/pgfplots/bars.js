import { parseDimension } from "../engine/math.js";
import { splitTopLevel } from "../engine/options.js";
import { axisNumber } from "./coordinates.js";
import { pgfplotsCompatAtLeast, pgfplotsCompatLevel } from "./compat.js";
import { formatAxisPoint, joinOptions } from "./format.js";
import { isPgfplotsIntervalPlot, pgfplotsIntervalDataPoints } from "./histogram.js";
import { plotColorValue, selectPlotColor, selectPlotFillStyle } from "./plotStyle.js";

export function isAxisBarPlot(axisOptions = {}, plotOptions = {}, axis = "y") {
  const key = axis === "x" ? "xbar" : "ybar";
  if (plotOptions[key] || isPgfplotsIntervalPlot({}, plotOptions, axis)) return true;
  const other = axis === "x" ? "y" : "x";
  if (hasExplicitLinePlotHandler(plotOptions) || plotOptions["only marks"] || plotOptions[other + "bar"] ||
    isPgfplotsIntervalPlot({}, plotOptions, other) || plotOptions.ycomb || plotOptions.xcomb) return false;
  return Boolean(axisOptions[key] || isPgfplotsIntervalPlot(axisOptions, {}, axis));
}

// Count a handler's plots once, in source order, before the paint order can
// change. A bare /tikz/ybar installs a handler but not PGFPlots' bar shift auto.
export function withBarGroups(plots, axis) {
  if ((!axis.xbar && !axis.ybar && !axis["bar shift auto"]) || optionIsEnabled(axis["stack plots"]) ||
      axis["xbar stacked"] || axis["ybar stacked"]) return plots;
  const directions = plots.map(plot => {
    if (plot.is3d || plot.pgfplotsStacked || plot.options?.hist) return null;
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

export function renderAxisBars(points, axisOptions = {}, geometry, plotOptions = {}, plotIndex = 0, orientation = "y", ranges = {}, layout, clip = "") {
  const commands = [];
  const interval = isPgfplotsIntervalPlot(axisOptions, plotOptions, orientation);
  const renderedPoints = interval
    ? pgfplotsIntervalDataPoints({ points, options: plotOptions }, axisOptions, orientation)
    : points;
  const style = joinOptions([axisBarStyle(plotOptions, plotIndex), clip]);
  layout ??= createBarLayout(axisOptions, plotOptions, geometry, orientation, ranges);
  const limits = geometry.lineRanges || geometry.transformRanges || ranges;
  for (const [index, point] of renderedPoints.entries()) {
    if (point.stackIgnored) continue;
    if (orientation === "y") {
      const baseline = interval
        ? Number.isFinite(Number(points[index + 1]?.stackBaseY))
          ? Number(points[index + 1].stackBaseY)
          : axisNumber(axisOptions.ymin, axisNumber(ranges.yMin, 0))
        : Number.isFinite(Number(point.stackBaseY))
          ? Number(point.stackBaseY)
          : visibleAxisBaseline(limits.yMin, limits.yMax);
      const corners = interval
        ? [
            geometry.mapPoint({ x: point.x, y: baseline }),
            geometry.mapPoint({ x: points[index + 1].x, y: baseline }),
            geometry.mapPoint({ x: points[index + 1].x, y: point.y }),
            geometry.mapPoint({ x: point.x, y: point.y })
          ]
        : canvasBarCorners(geometry, point, baseline, "y", layout(point));
      commands.push(`\\draw[${style}] ${corners.map(formatAxisPoint).join(" -- ")} -- cycle;`);
    } else {
      const baseline = interval
        ? Number.isFinite(Number(points[index + 1]?.stackBaseX))
          ? Number(points[index + 1].stackBaseX)
          : axisNumber(axisOptions.xmin, axisNumber(ranges.xMin, 0))
        : Number.isFinite(Number(point.stackBaseX))
          ? Number(point.stackBaseX)
          : visibleAxisBaseline(limits.xMin, limits.xMax);
      const corners = interval
        ? [
            geometry.mapPoint({ x: baseline, y: point.y }),
            geometry.mapPoint({ x: point.x, y: point.y }),
            geometry.mapPoint({ x: point.x, y: points[index + 1].y }),
            geometry.mapPoint({ x: baseline, y: points[index + 1].y })
          ]
        : canvasBarCorners(geometry, point, baseline, "x", layout(point));
      commands.push(`\\draw[${style}] ${corners.map(formatAxisPoint).join(" -- ")} -- cycle;`);
    }
  }
  return commands;
}

function axisBarStyle(plotOptions, plotIndex) {
  const color = plotColorValue(selectPlotColor(plotOptions, plotIndex));
  const fill = plotOptions.fill && plotOptions.fill !== true
    ? selectPlotFillStyle(plotOptions, plotIndex)
    : `fill=${color}!30`;
  const draw = String(plotOptions.draw || "").trim().toLowerCase();
  const drawStyle = draw === "none" || draw === "false" || draw === "off"
    ? "draw=none"
    : plotOptions.draw && plotOptions.draw !== true
      ? `draw=${plotOptions.draw}`
      : `draw=${color}`;
  return joinOptions(["axis bar", fill, drawStyle]);
}

export function createBarLayout(axis, options, geometry, direction, ranges, group) {
  const units = pgfplotsCompatAtLeast(pgfplotsCompatLevel(axis, options), "1.7");
  const length = (raw, dataUnits) => {
    const text = String(raw).trim();
    if (/(?:cm|mm|pt|em|ex|in)\b/i.test(text)) return { cm: parseDimension(text, {}) };
    const value = axisNumber(raw, 0);
    return dataUnits ? { units: value } : { cm: parseDimension(`${value}pt`, {}) };
  };
  const width = length(options["bar width"] ?? axis["bar width"] ?? "10pt", units);
  const explicit = options["bar shift"] ?? axis["bar shift"];
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

function hasExplicitLinePlotHandler(plotOptions = {}) {
  return [
    "smooth",
    "smooth cycle",
    "sharp plot",
    "const plot",
    "const plot mark left",
    "const plot mark mid",
    "const plot mark right",
    "jump mark left",
    "jump mark mid",
    "jump mark right"
  ].some((key) => optionIsEnabled(plotOptions[key]));
}

function optionIsEnabled(value) {
  if (value === undefined || value === null || value === false) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== "false" && normalized !== "0" && normalized !== "off";
}
