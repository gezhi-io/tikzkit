import { parseDimension } from "../engine/math.js";
import { formatAxisPoint, joinOptions } from "./format.js";
import { pgfplotsAxisHidden } from "./axisOptions.js";
import { axisZeroValue } from "./ranges.js";
import { plotLineWidthOption } from "./plotStyle.js";

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

export function hasReversed2DFrame(axisOptions, geometry) {
  return !geometry.is3d && !axisOptions["datavis axis label placement"] &&
    (geometry.axisDirections?.x === -1 || geometry.axisDirections?.y === -1);
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
    axisOptions["axis line width"] ? `line width=${axisOptions["axis line width"]}`
      : plotLineWidthOption(axisOptions) || "line width=0.4pt",
    ...axisLineStyleFragments(axisOptions["axis line style"])
  ]);
  const reversed = hasReversed2DFrame(axisOptions, geometry);
  const [x0, x1] = reversed && geometry.axisDirections.x === -1 ? [max.x, min.x] : [min.x, max.x];
  const [y0, y1] = reversed && geometry.axisDirections.y === -1 ? [max.y, min.y] : [min.y, max.y];
  const xMode = specificAxisLineMode(axisOptions, "x"), yMode = specificAxisLineMode(axisOptions, "y");
  const hideX = pgfplotsAxisHidden(axisOptions, "x"), hideY = pgfplotsAxisHidden(axisOptions, "y");
  const full = mode => !mode || (reversed && mode === "box");
  if (full(xMode) && full(yMode) && (reversed || (!hideX && !hideY))) {
    // PGF starts its closed path at projected (xmin,ymin), even for dashed or reversed axes.
    const [a, b, c, d] = [{ x:x0, y:y0 }, { x:x0, y:y1 }, { x:x1, y:y1 }, { x:x1, y:y0 }];
    if (hideX) return `\\draw[${frameStyle}] ${axisFrameSegment(a, b)} ${axisFrameSegment(c, d)};`;
    if (hideY) return `\\draw[${frameStyle}] ${axisFrameSegment(b, c)} ${axisFrameSegment(d, a)};`;
    return `\\draw[${frameStyle}] ${[a, b, c, d].map(formatAxisPoint).join(" -- ")} -- cycle;`;
  }
  // Each separate edge starts at the lower data value along its own axis.
  const ys = hideX ? [] : full(xMode) ? [y0, y1] : xMode === "bottom" ? [min.y] : xMode === "top" ? [max.y] : [];
  const xs = hideY ? [] : full(yMode) ? [x0, x1] : yMode === "left" ? [min.x] : yMode === "right" ? [max.x] : [];
  const segments = [...ys.map(y => axisFrameSegment({ x:x0, y }, { x:x1, y })),
    ...xs.map(x => axisFrameSegment({ x, y:y0 }, { x, y:y1 }))];
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
  const finalRanges = geometry.transformRanges || ranges;
  const dirs = hasReversed2DFrame(axisOptions, geometry) ? geometry.axisDirections : {};
  const yAxis = axisLineBase(axisOptions, "x", "y", finalRanges, dirs.y === -1);
  const xAxis = axisLineBase(axisOptions, "y", "x", finalRanges, dirs.x === -1);
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
  // Keep the axis endpoint at its transformed data limit. The renderer owns
  // arrow hull/stroke extents; extending the path too counts them twice.
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

function axisLineBase(axisOptions, direction, normal, ranges, reversed) {
  const mode = specificAxisLineMode(axisOptions, direction) || String(axisOptions["axis lines"] ?? axisOptions.axis ?? "middle");
  // Named sides are physical; only the coordinate perpendicular to the line changes.
  if (["left", "bottom"].includes(mode)) return ranges[normal + (reversed ? "Max" : "Min")];
  if (["right", "top"].includes(mode)) return ranges[normal + (reversed ? "Min" : "Max")];
  return axisZeroValue(ranges, normal);
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
  // Datavisualization owns its visualizer styles: bare Cartesian axes have
  // no arrows, while school-book axes install TikZ's ordinary `->` style.
  const arrowStyle = axisOptions["datavis axis label placement"]
    ? axisOptions["axis school book padding"] ? "->" : ""
    : arrowed ? "-stealth" : "";
  return joinOptions([
    "axis line",
    "black",
    axisOptions["axis line width"]
      ? `line width=${axisOptions["axis line width"]}`
      : plotLineWidthOption(axisOptions) || "line width=0.4pt",
    ...globalStyle,
    ...specificStyle,
    arrowStyle
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
