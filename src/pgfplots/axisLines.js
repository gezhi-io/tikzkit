import { parseDimension } from "../engine/math.js";
import { formatAxisPoint, joinOptions } from "./format.js";

export function axisOuterBounds(geometry) {
  return {
    minX: geometry.origin.x - geometry.margin.left,
    maxX: geometry.origin.x + geometry.width + geometry.margin.right,
    minY: geometry.origin.y - geometry.margin.bottom,
    maxY: geometry.origin.y + geometry.height + geometry.margin.top
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
  return `\\draw[axis frame, ${color}, line width=0.35pt] ${formatAxisPoint({
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

export function shouldRenderAxisBox(axisOptions = {}) {
  if (axisOptions["hide axis"] || axisOptions.hide) return false;
  const raw = axisOptions["axis lines"] ?? axisOptions.axis;
  if (raw === undefined || raw === null || raw === "") return true;
  if (raw === true) return true;
  const value = String(raw).trim().toLowerCase();
  return value === "box";
}

export function renderAxisLines(axisOptions = {}, ranges = {}, geometry = {}) {
  const yAxis = ranges.yMin <= 0 && ranges.yMax >= 0 ? 0 : ranges.yMin;
  const xAxis = ranges.xMin <= 0 && ranges.xMax >= 0 ? 0 : ranges.xMin;
  const padding = parseAxisSchoolBookPadding(axisOptions);
  const style = joinOptions([
    "axis line",
    "black",
    axisOptions["axis line width"] ? `line width=${axisOptions["axis line width"]}` : axisOptions["very thick"] ? "very thick" : "line width=0.35pt",
    shouldArrowAxisLines(axisOptions) ? "->" : ""
  ]);
  const xFrom = geometry.mapPoint({ x: ranges.xMin, y: yAxis });
  const xTo = geometry.mapPoint({ x: ranges.xMax, y: yAxis });
  const yFrom = geometry.mapPoint({ x: xAxis, y: ranges.yMin });
  const yTo = geometry.mapPoint({ x: xAxis, y: ranges.yMax });
  xFrom.x -= padding;
  xTo.x += padding;
  yFrom.y -= padding;
  yTo.y += padding;
  return [
    `\\draw[${style}] ${formatAxisPoint(xFrom)} -- ${formatAxisPoint(xTo)};`,
    `\\draw[${style}] ${formatAxisPoint(yFrom)} -- ${formatAxisPoint(yTo)};`
  ];
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
