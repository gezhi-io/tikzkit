import { parseDimension } from "../engine/math.js";
import { axisNumber } from "./coordinates.js";
import { formatAxisPoint, joinOptions } from "./format.js";
import { isMiddleAxis } from "./geometry.js";
import { autoTickOutsideRange, axisAutoMajorTickCountForOptions, axisMajorTickValues, axisMinorTickValues, axisTickValues } from "./ticks.js";

export function createAxisGridModel(axisOptions = {}) {
  return {
    x: shouldRenderAxisGrid(axisOptions, "x"),
    y: shouldRenderAxisGrid(axisOptions, "y"),
    minorX: shouldRenderMinorAxisGrid(axisOptions, "x"),
    minorY: shouldRenderMinorAxisGrid(axisOptions, "y"),
    mode: String(axisOptions.grid || "").trim() || "none",
    style: axisOptions["grid style"] || axisOptions["major grid style"] || ""
  };
}

export function renderAxisGrid(axisOptions = {}, addplots = [], ranges = {}, geometry = {}) {
  const commands = [];
  const spanRanges = geometry.lineRanges || geometry.transformRanges || ranges;
  const hasExplicitXMajorTicks =
    hasExplicitAxisTickOption(axisOptions["x grid values"]) || hasExplicitAxisTickOption(axisOptions.xtick);
  const hasExplicitYMajorTicks =
    hasExplicitAxisTickOption(axisOptions["y grid values"]) || hasExplicitAxisTickOption(axisOptions.ytick);
  const xTicks = hasExplicitAxisTickOption(axisOptions["x grid values"])
    ? axisTickValues(axisOptions["x grid values"], "x", addplots)
    : hasExplicitAxisTickOption(axisOptions.xtick)
      ? axisTickValues(axisOptions.xtick, "x", addplots)
      : gridTickValues(axisOptions, "x", ranges.xMin, ranges.xMax, axisAutoMajorTickCountForOptions(axisOptions, "x", ranges.xMin, ranges.xMax, geometry, 7));
  const yTicks = hasExplicitAxisTickOption(axisOptions["y grid values"])
    ? axisTickValues(axisOptions["y grid values"], "y", addplots)
    : hasExplicitAxisTickOption(axisOptions.ytick)
      ? axisTickValues(axisOptions.ytick, "y", addplots)
      : gridTickValues(axisOptions, "y", ranges.yMin, ranges.yMax, axisAutoMajorTickCountForOptions(axisOptions, "y", ranges.yMin, ranges.yMax, geometry, 6));
  const xMajorGridTicks = omitAutoOriginGridTick(axisOptions, "x", xTicks, ranges, hasExplicitXMajorTicks);
  const yMajorGridTicks = omitAutoOriginGridTick(axisOptions, "y", yTicks, ranges, hasExplicitYMajorTicks);
  const xMinorTicks = hasExplicitAxisTickOption(axisOptions["x minor grid values"])
    ? axisTickValues(axisOptions["x minor grid values"], "x", addplots)
    : axisMinorTickValues(axisOptions, "x", xTicks, ranges.xMin, ranges.xMax, addplots);
  const yMinorTicks = hasExplicitAxisTickOption(axisOptions["y minor grid values"])
    ? axisTickValues(axisOptions["y minor grid values"], "y", addplots)
    : axisMinorTickValues(axisOptions, "y", yTicks, ranges.yMin, ranges.yMax, addplots);
  const padding = parseAxisSchoolBookPadding(axisOptions);
  const style = joinOptions([
    "axis grid",
    axisOptions["axis grid color"] || "black!25",
    `line width=${axisOptions["axis grid line width"] || "0.4pt"}`,
    axisOptions["grid style"] || axisOptions["major grid style"] || ""
  ]);
  const minorStyle = joinOptions([
    "axis minor grid",
    axisOptions["axis minor grid color"] || "black!12",
    `line width=${axisOptions["axis minor grid line width"] || axisOptions["axis grid line width"] || "0.2pt"}`,
    axisOptions["axis minor grid style"] || ""
  ]);
  const xMinorStyle = joinOptions([minorStyle, axisOptions["x minor grid style"] || ""]);
  const yMinorStyle = joinOptions([minorStyle, axisOptions["y minor grid style"] || ""]);
  if (shouldRenderAxisGrid(axisOptions, "x")) {
    if (shouldRenderMinorAxisGrid(axisOptions, "x")) {
      const span = axisGridLineSpan(axisOptions, "x", "minor", spanRanges);
      for (const x of xMinorTicks) {
        const from = geometry.mapPoint({ x, y: span.low });
        const to = geometry.mapPoint({ x, y: span.high });
        from.y -= padding;
        to.y += padding;
        commands.push(`\\draw[${xMinorStyle}] ${formatAxisPoint(from)} -- ${formatAxisPoint(to)};`);
      }
    }
    for (const x of xMajorGridTicks) {
      const from = geometry.mapPoint({ x, y: spanRanges.yMin });
      const to = geometry.mapPoint({ x, y: spanRanges.yMax });
      from.y -= padding;
      to.y += padding;
      commands.push(`\\draw[${style}] ${formatAxisPoint(from)} -- ${formatAxisPoint(to)};`);
    }
  }
  if (shouldRenderAxisGrid(axisOptions, "y")) {
    if (shouldRenderMinorAxisGrid(axisOptions, "y")) {
      const span = axisGridLineSpan(axisOptions, "y", "minor", spanRanges);
      for (const y of yMinorTicks) {
        const from = geometry.mapPoint({ x: span.low, y });
        const to = geometry.mapPoint({ x: span.high, y });
        from.x -= padding;
        to.x += padding;
        commands.push(`\\draw[${yMinorStyle}] ${formatAxisPoint(from)} -- ${formatAxisPoint(to)};`);
      }
    }
    for (const y of yMajorGridTicks) {
      const from = geometry.mapPoint({ x: spanRanges.xMin, y });
      const to = geometry.mapPoint({ x: spanRanges.xMax, y });
      from.x -= padding;
      to.x += padding;
      commands.push(`\\draw[${style}] ${formatAxisPoint(from)} -- ${formatAxisPoint(to)};`);
    }
  }
  return commands;
}

export function axisGridLineSpan(axisOptions = {}, axis, kind, ranges) {
  const directionAxis = axis === "x" ? "y" : "x";
  const defaultLow = directionAxis === "y" ? ranges.yMin : ranges.xMin;
  const defaultHigh = directionAxis === "y" ? ranges.yMax : ranges.xMax;
  const prefix = `${axis} ${kind} grid`;
  return {
    low: axisGridBoundaryValue(axisOptions[`${prefix} low`], defaultLow, defaultHigh, defaultLow),
    high: axisGridBoundaryValue(axisOptions[`${prefix} high`], defaultLow, defaultHigh, defaultHigh)
  };
}

function axisGridBoundaryValue(raw, min, max, fallback) {
  if (raw === undefined || raw === null || raw === false || raw === "") return fallback;
  const text = String(raw).trim().toLowerCase();
  if (text === "min" || text === "padded min") return min;
  if (text === "max" || text === "padded max") return max;
  const value = axisNumber(raw, NaN);
  return Number.isFinite(value) ? value : fallback;
}

export function shouldRenderAnyAxisGrid(axisOptions = {}) {
  return shouldRenderAxisGrid(axisOptions, "x") ||
    shouldRenderAxisGrid(axisOptions, "y") ||
    shouldRenderMinorAxisGrid(axisOptions, "x") ||
    shouldRenderMinorAxisGrid(axisOptions, "y");
}

export function shouldRenderAxisGrid(axisOptions = {}, axis) {
  const axisSpecific =
    axis === "x"
      ? axisOptions["x grid"] ?? axisOptions.xgrid ?? axisOptions.xmajorgrids
      : axisOptions["y grid"] ?? axisOptions.ygrid ?? axisOptions.ymajorgrids;
  if (axisSpecific !== undefined && axisSpecific !== null && axisSpecific !== "") {
    const text = String(axisSpecific).toLowerCase();
    return !["false", "none", "minor"].includes(text);
  }
  const grid = String(axisOptions.grid || "").toLowerCase();
  return Boolean(grid && !["false", "none", "minor"].includes(grid));
}

export function shouldRenderMinorAxisGrid(axisOptions = {}, axis) {
  const axisSpecific =
    axis === "x"
      ? axisOptions.xminorgrids ?? axisOptions["x minor grids"]
      : axisOptions.yminorgrids ?? axisOptions["y minor grids"];
  if (axisSpecific !== undefined && axisSpecific !== null && axisSpecific !== "") {
    const text = String(axisSpecific).toLowerCase();
    return text !== "false" && text !== "none";
  }
  const grid = String(axisOptions.grid || "").trim().toLowerCase();
  return grid === "both" || grid === "minor";
}

function parseAxisSchoolBookPadding(axisOptions = {}) {
  const raw = axisOptions["axis school book padding"];
  if (raw === undefined || raw === null || raw === "") return 0;
  const parsed = parseDimension(String(raw), {});
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function gridTickValues(axisOptions, axis, min, max, maxTicks) {
  return axisMajorTickValues(axisOptions, axis, min, max, maxTicks).filter((tick) => !autoTickOutsideRange(tick, min, max));
}

function omitAutoOriginGridTick(axisOptions, axis, ticks, ranges, hasExplicitTicks) {
  if (hasExplicitTicks || !isMiddleAxis(axisOptions)) return ticks;
  const min = axis === "x" ? Number(ranges.xMin) : Number(ranges.yMin);
  const max = axis === "x" ? Number(ranges.xMax) : Number(ranges.yMax);
  if (!(Number.isFinite(min) && Number.isFinite(max) && min <= 0 && max >= 0)) return ticks;
  return ticks.filter((tick) => Math.abs(Number(tick)) > 1e-9);
}

function hasExplicitAxisTickOption(raw) {
  if (raw === undefined || raw === null) return false;
  if (raw === true || raw === false) return true;
  return String(raw).trim() !== "";
}
