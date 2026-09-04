import { parseDimension } from "../engine/math.js";
import { splitTopLevel } from "../engine/options.js";
import { axisNumber } from "./coordinates.js";
import { formatAxisPoint, joinOptions } from "./format.js";
import { isPgfplotsIntervalPlot, pgfplotsIntervalDataPoints } from "./histogram.js";
import { plotColorValue, selectPlotColor, selectPlotFillStyle } from "./plotStyle.js";

export function isAxisBarPlot(axisOptions = {}, plotOptions = {}, axis = "y") {
  const key = axis === "x" ? "xbar" : "ybar";
  if (plotOptions[key] || isPgfplotsIntervalPlot({}, plotOptions, axis)) return true;
  if (hasExplicitLinePlotHandler(plotOptions)) return false;
  return Boolean(axisOptions[key] || isPgfplotsIntervalPlot(axisOptions, {}, axis));
}

export function renderAxisBars(points, axisOptions = {}, geometry, plotOptions = {}, plotIndex = 0, orientation = "y", ranges = {}) {
  const commands = [];
  const rawWidth = plotOptions["bar width"] || axisOptions["bar width"] || 0.2;
  const width = axisBarWidth(rawWidth);
  const interval = isPgfplotsIntervalPlot(axisOptions, plotOptions, orientation);
  const renderedPoints = interval
    ? pgfplotsIntervalDataPoints({ points, options: plotOptions }, axisOptions, orientation)
    : points;
  const style = axisBarStyle(plotOptions, plotIndex, interval);
  const shift = axisBarCanvasShift(plotOptions.shift, orientation, geometry, ranges);
  for (const [index, point] of renderedPoints.entries()) {
    if (point.stackIgnored) continue;
    if (orientation === "y") {
      const baseline = interval
        ? Number.isFinite(Number(points[index + 1]?.stackBaseY))
          ? Number(points[index + 1].stackBaseY)
          : axisNumber(axisOptions.ymin, axisNumber(ranges.yMin, 0))
        : Number.isFinite(Number(point.stackBaseY))
          ? Number(point.stackBaseY)
          : visibleAxisBaseline(ranges.yMin, ranges.yMax);
      const corners = interval
        ? [
            geometry.mapPoint({ x: point.x, y: baseline }),
            geometry.mapPoint({ x: points[index + 1].x, y: baseline }),
            geometry.mapPoint({ x: points[index + 1].x, y: point.y }),
            geometry.mapPoint({ x: point.x, y: point.y })
          ]
        : canvasBarCorners(geometry, point, baseline, width, "y", shift);
      commands.push(`\\draw[${style}] ${corners.map(formatAxisPoint).join(" -- ")} -- cycle;`);
    } else {
      const baseline = interval
        ? Number.isFinite(Number(points[index + 1]?.stackBaseX))
          ? Number(points[index + 1].stackBaseX)
          : axisNumber(axisOptions.xmin, axisNumber(ranges.xMin, 0))
        : Number.isFinite(Number(point.stackBaseX))
          ? Number(point.stackBaseX)
          : visibleAxisBaseline(ranges.xMin, ranges.xMax);
      const corners = interval
        ? [
            geometry.mapPoint({ x: baseline, y: point.y }),
            geometry.mapPoint({ x: point.x, y: point.y }),
            geometry.mapPoint({ x: point.x, y: points[index + 1].y }),
            geometry.mapPoint({ x: baseline, y: points[index + 1].y })
          ]
        : canvasBarCorners(geometry, point, baseline, width, "x", shift);
      commands.push(`\\draw[${style}] ${corners.map(formatAxisPoint).join(" -- ")} -- cycle;`);
    }
  }
  return commands;
}

function axisBarStyle(plotOptions, plotIndex, interval) {
  const color = plotColorValue(selectPlotColor(plotOptions, plotIndex));
  const fill = plotOptions.fill && plotOptions.fill !== true
    ? selectPlotFillStyle(plotOptions, plotIndex)
    : interval
      ? `fill=${color}!30`
      : `fill=${color}!30`;
  const draw = String(plotOptions.draw || "").trim().toLowerCase();
  const drawStyle = draw === "none" || draw === "false" || draw === "off"
    ? "draw=none"
    : plotOptions.draw && plotOptions.draw !== true
      ? `draw=${plotOptions.draw}`
      : `draw=${color}`;
  return joinOptions(["axis bar", fill, drawStyle]);
}

function axisBarWidth(raw) {
  const text = String(raw ?? "").trim();
  if (/[-+]?(?:\d+\.?\d*|\.\d+)\s*(?:cm|mm|pt|em|ex|in)\b/i.test(text)) {
    const physical = parseDimension(text, {});
    if (Number.isFinite(physical) && physical > 0) return { kind: "canvas", value: physical };
  }
  const data = axisNumber(raw, 0.2);
  return { kind: "data", value: Number.isFinite(data) && data > 0 ? data : 0.2 };
}

function canvasBarCorners(geometry, point, baseline, width, orientation, shift) {
  const base = geometry.mapPoint(
    orientation === "y" ? { x: point.x, y: baseline } : { x: baseline, y: point.y }
  );
  const tip = geometry.mapPoint(point);
  const halfWidth = width.kind === "canvas"
    ? width.value / 2
    : dataBarHalfWidth(geometry, point, width.value, orientation);
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
