import { parseDimension } from "../engine/math.js";
import { formatAxisPoint, joinOptions } from "./format.js";
import { pgfplotsAxisHidden } from "./axisOptions.js";

const PGFPLOTS_ARROW_END_PAINT_RESERVE = parseDimension("0.2pt", {});

export function axisOuterBounds(geometry) {
  const layout = geometry.layoutBounds || geometry;
  return {
    minX: layout.origin.x - geometry.margin.left,
    maxX: layout.origin.x + layout.width + geometry.margin.right,
    minY: layout.origin.y - geometry.margin.bottom,
    maxY: layout.origin.y + layout.height + geometry.margin.top
  };
}

export function renderAxisBounds(geometry) {
  const bounds = axisOuterBounds(geometry);
  return `\\draw[axis bounds, draw=none, fill=none] ${formatAxisPoint({
    x: bounds.minX,
    y: bounds.minY
  })} -- ${formatAxisPoint({
    x: bounds.maxX,
    y: bounds.minY
  })} -- ${formatAxisPoint({
    x: bounds.maxX,
    y: bounds.maxY
  })} -- ${formatAxisPoint({
    x: bounds.minX,
    y: bounds.maxY
  })} -- cycle;`;
}

export function renderAxisBox(axisOptions = {}, geometry = {}) {
  if (!shouldRenderAxisBox(axisOptions)) return "";
  const min = geometry.origin;
  const max = { x: geometry.origin.x + geometry.width, y: geometry.origin.y + geometry.height };
  const color = axisOptions["axis frame color"] || "black";
  // PGFPlots installs `axis line style` on both outer axis styles. A default
  // boxed axis is one closed outer path, so it must inherit that same style.
  const frameStyle = joinOptions([
    "axis frame",
    color,
    "line width=0.35pt",
    ...axisLineStyleFragments(axisOptions["axis line style"])
  ]);
  const xMode = pgfplotsAxisHidden(axisOptions, "x") ? "none" : specificAxisLineMode(axisOptions, "x");
  const yMode = pgfplotsAxisHidden(axisOptions, "y") ? "none" : specificAxisLineMode(axisOptions, "y");
  if (!xMode && !yMode) {
    return `\\draw[${frameStyle}] ${formatAxisPoint({
      x: min.x,
      y: min.y
    })} -- ${formatAxisPoint({
      x: max.x,
      y: min.y
    })} -- ${formatAxisPoint({
      x: max.x,
      y: max.y
    })} -- ${formatAxisPoint({
      x: min.x,
      y: max.y
    })} -- cycle;`;
  }
  const segments = [];
  if (xMode !== "none") {
    if (!xMode || xMode === "bottom") segments.push(axisFrameSegment({ x: min.x, y: min.y }, { x: max.x, y: min.y }));
    if (!xMode || xMode === "top") segments.push(axisFrameSegment({ x: min.x, y: max.y }, { x: max.x, y: max.y }));
  }
  if (yMode !== "none") {
    if (!yMode || yMode === "left") segments.push(axisFrameSegment({ x: min.x, y: min.y }, { x: min.x, y: max.y }));
    if (!yMode || yMode === "right") segments.push(axisFrameSegment({ x: max.x, y: min.y }, { x: max.x, y: max.y }));
  }
  return segments.length ? `\\draw[${frameStyle}] ${segments.join(" ")};` : "";
}

export function shouldRenderAxisBox(axisOptions = {}) {
  if (pgfplotsAxisHidden(axisOptions, "x") && pgfplotsAxisHidden(axisOptions, "y")) return false;
  const raw = axisOptions["axis lines"] ?? axisOptions.axis;
  if (raw === undefined || raw === null || raw === "") return true;
  if (raw === true) return true;
  const value = String(raw).trim().toLowerCase();
  return value === "box";
}

export function renderAxisLines(axisOptions = {}, ranges = {}, geometry = {}) {
  const spanRanges = geometry.lineRanges || geometry.transformRanges || ranges;
  const yAxis = axisContainsZero(ranges.yMin, ranges.yMax) || axisContainsZero(spanRanges.yMin, spanRanges.yMax) ? 0 : ranges.yMin;
  const xAxis = axisContainsZero(ranges.xMin, ranges.xMax) || axisContainsZero(spanRanges.xMin, spanRanges.xMax) ? 0 : ranges.xMin;
  const yLineRange = axisLineRange(axisOptions, "y", spanRanges, ranges);
  const padding = parseAxisSchoolBookPadding(axisOptions);
  const globalStyle = axisLineStyleFragments(axisOptions["axis line style"]);
  const xArrowed = shouldArrowAxis(axisOptions, "x");
  const yArrowed = shouldArrowAxis(axisOptions, "y");
  const xStyle = createAxisLineStyle(axisOptions, globalStyle, "x", xArrowed);
  const yStyle = createAxisLineStyle(axisOptions, globalStyle, "y", yArrowed);
  const xFrom = geometry.mapPoint({ x: spanRanges.xMin, y: yAxis });
  const xTo = geometry.mapPoint({ x: spanRanges.xMax, y: yAxis });
  const yFrom = geometry.mapPoint({ x: xAxis, y: yLineRange.min });
  const yTo = geometry.mapPoint({ x: xAxis, y: yLineRange.max });
  // Native PGF arrow tips extend the painted axis slightly beyond the path
  // endpoint. Keep that extent in the generated geometry so the SVG bbox and
  // raster scaling agree with dvisvgm/tikztosvg.
  if (xArrowed) xTo.x += PGFPLOTS_ARROW_END_PAINT_RESERVE;
  if (yArrowed) yTo.y += PGFPLOTS_ARROW_END_PAINT_RESERVE;
  xFrom.x -= padding;
  xTo.x += padding;
  yFrom.y -= padding;
  yTo.y += padding;
  const commands = [];
  if (!pgfplotsAxisHidden(axisOptions, "x")) {
    commands.push(`\\draw[${xStyle}] ${formatAxisPoint(xFrom)} -- ${formatAxisPoint(xTo)};`);
  }
  if (!pgfplotsAxisHidden(axisOptions, "y")) {
    commands.push(`\\draw[${yStyle}] ${formatAxisPoint(yFrom)} -- ${formatAxisPoint(yTo)};`);
  }
  return commands;
}

function axisLineRange(axisOptions = {}, axis, ranges = {}, surveyedRanges = ranges) {
  const min = Number(ranges[`${axis}Min`]);
  const max = Number(ranges[`${axis}Max`]);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return { min, max };

  // With `axis ... line=middle`, PGFPlots lets an axis that lands on a
  // restricted zero boundary protrude into the otherwise clipped side. The
  // extension is measured from the surveyed interval, not the transform
  // interval. This keeps the y-axis arrow and the picture bbox aligned with
  // native output for `restrict y to domain=0:<max>` plots.
  if (
    isMiddleAxisLine(axisOptions, axis) &&
    axisHasRestrictedDomain(axisOptions, axis) &&
    Math.abs(min) < 1e-9
  ) {
    const rawMax = Number(surveyedRanges[`${axis}Max`]);
    const rawMin = Number(surveyedRanges[`${axis}Min`]);
    const span = Math.abs(rawMax - rawMin);
    return { min: rawMin - span * (2 / 15), max };
  }
  return { min, max };
}

function axisHasRestrictedDomain(axisOptions = {}, axis = "x") {
  return [axisOptions[`restrict ${axis} to domain`], axisOptions[`restrict ${axis} to domain*`]]
    .some((value) => value !== undefined && value !== null && value !== false && String(value).trim() !== "");
}

function isMiddleAxisLine(axisOptions = {}, axis = "x") {
  const raw = axisOptions[`axis ${axis} line`] ?? axisOptions[`axis ${axis} line*`] ?? axisOptions["axis lines"] ?? axisOptions.axis;
  return ["middle", "center"].includes(String(raw || "").trim().toLowerCase());
}

function createAxisLineStyle(axisOptions, globalStyle, axis, arrowed) {
  const specificStyle = axisLineStyleFragments(axisOptions[`${axis} axis line style`]);
  return joinOptions([
    "axis line",
    "black",
    axisOptions["axis line width"]
      ? `line width=${axisOptions["axis line width"]}`
      : axisOptions["very thick"]
        ? "very thick"
        : `line width=${arrowed ? "0.4pt" : "0.35pt"}`,
    ...globalStyle,
    ...specificStyle,
    arrowed ? "-stealth" : ""
  ]);
}

function axisLineStyleFragments(value) {
  const values = Array.isArray(value) ? value : [value];
  return values
    .filter((entry) => entry !== undefined && entry !== null && entry !== true && String(entry).trim())
    .map((entry) => String(entry).trim());
}

function shouldArrowAxis(axisOptions = {}, axis) {
  const specific = specificAxisLineMode(axisOptions, axis);
  if (specific) return specific === "left" || specific === "middle" || specific === "center";
  return shouldArrowAxisLines(axisOptions);
}

function axisContainsZero(min, max) {
  return Number(min) <= 0 && Number(max) >= 0;
}

export function renderDatavisualizationCleanAxes(axisOptions = {}, ranges = {}, geometry = {}) {
  const min = geometry.origin;
  const max = { x: geometry.origin.x + geometry.width, y: geometry.origin.y + geometry.height };
  const padding = parseAxisCleanPadding(axisOptions);
  const xMaxExtension = parseDimension(String(axisOptions["datavis clean x max extension"] || "0cm"), {});
  const yMaxExtension = parseDimension(String(axisOptions["datavis clean y max extension"] || "0cm"), {});
  const cleanStyle = joinOptions([
    "axis clean line",
    axisOptions["axis clean line color"] || "black!50",
    `line width=${axisOptions["axis clean line width"] || "0.12pt"}`
  ]);
  const boundaryStyle = joinOptions([
    "axis clean boundary",
    axisOptions["axis boundary color"] || "black!25",
    `line width=${axisOptions["axis boundary line width"] || "0.12pt"}`,
    "line cap=rect"
  ]);
  const left = min.x - padding;
  const bottom = min.y - padding;
  return [
    `\\draw[${cleanStyle}] ${formatAxisPoint({ x: min.x, y: bottom })} -- ${formatAxisPoint({ x: max.x + xMaxExtension, y: bottom })};`,
    `\\draw[${cleanStyle}] ${formatAxisPoint({ x: left, y: min.y })} -- ${formatAxisPoint({ x: left, y: max.y + yMaxExtension })};`,
    `\\draw[${boundaryStyle}] ${formatAxisPoint({ x: min.x, y: min.y })} -- ${formatAxisPoint({ x: max.x, y: min.y })};`,
    `\\draw[${boundaryStyle}] ${formatAxisPoint({ x: min.x, y: max.y })} -- ${formatAxisPoint({ x: max.x, y: max.y })};`,
    `\\draw[${boundaryStyle}] ${formatAxisPoint({ x: min.x, y: min.y })} -- ${formatAxisPoint({ x: min.x, y: max.y })};`,
    `\\draw[${boundaryStyle}] ${formatAxisPoint({ x: max.x, y: min.y })} -- ${formatAxisPoint({ x: max.x, y: max.y })};`
  ];
}

export function shouldRenderAxisLines(axisOptions = {}) {
  const raw = axisOptions["axis lines"] ?? axisOptions.axis;
  if (raw === undefined || raw === null || raw === false || raw === "") return false;
  if (raw === true) return true;
  const value = String(raw).trim().toLowerCase();
  if (value === "box") return false;
  return value !== "none" && value !== "false" && value !== "off";
}

export function shouldArrowAxisLines(axisOptions = {}) {
  const raw = axisOptions["axis lines"] ?? axisOptions.axis;
  const value = String(raw || "").trim().toLowerCase();
  return value === "left" || value === "middle" || value === "center";
}

function parseAxisCleanPadding(axisOptions = {}) {
  const raw = axisOptions["datavis clean padding"] || "0.175cm";
  const parsed = parseDimension(String(raw), {});
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0.175;
}

function parseAxisSchoolBookPadding(axisOptions = {}) {
  const raw = axisOptions["axis school book padding"];
  if (raw === undefined || raw === null || raw === "") return 0;
  const parsed = parseDimension(String(raw), {});
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function axisFrameSegment(from, to) {
  return `${formatAxisPoint(from)} -- ${formatAxisPoint(to)}`;
}

function specificAxisLineMode(axisOptions = {}, axis) {
  const raw = axisOptions[`axis ${axis} line`] ?? axisOptions[`axis ${axis} line*`];
  if (raw === undefined || raw === null || raw === "") return "";
  if (raw === false) return "none";
  const value = String(raw).trim().toLowerCase();
  if (value === "false" || value === "off" || value === "0") return "none";
  return value;
}
