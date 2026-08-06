import {
  TIKZ_ENLARGED_MIDDLE_AXIS_CONTAINER_MARGIN,
  TIKZ_EXPLICIT_MIDDLE_AXIS_CONTAINER_MARGIN,
  TIKZ_EXPLICIT_MIDDLE_AXIS_NO_ENLARGE_CONTAINER_MARGIN,
  TIKZ_EXPLICIT_MIDDLE_AXIS_TOP_DESCRIPTION_LABEL_MARGIN,
  TIKZ_AXIS_CONTAINER_MARGIN,
  TIKZ_HIDDEN_AXIS_CONTAINER_MARGIN,
  TIKZ_MIDDLE_AXIS_CONTAINER_MARGIN,
  TIKZ_PGFPLOTS_DEFAULT_ENLARGED_MIDDLE_AXIS_RESERVED_X,
  TIKZ_PGFPLOTS_DEFAULT_ENLARGED_MIDDLE_AXIS_RESERVED_Y,
  TIKZ_PGFPLOTS_DEFAULT_MIDDLE_AXIS_RESERVED_X,
  TIKZ_PGFPLOTS_DEFAULT_MIDDLE_AXIS_RESERVED_Y
} from "../tikz/metrics.js";
import { parseDimension } from "../engine/math.js";
import { parseOptions, splitTopLevel } from "../engine/options.js";
import { measurePlainTextTeXBoxPt } from "../tikz/textMetrics.js";
import { createDataToCanvasTransform } from "./transformDataToCanvas.js";
import { axisNumberList } from "./coordinates.js";
import { formatAxisTickLabel, roundAxis, roundAxisRange } from "./format.js";
import { isLogAxis, scaleAxisValue } from "./ranges.js";

export const PGFPLOTS_DEFAULT_AXIS_WIDTH = parseDimension("240pt", {});
export const PGFPLOTS_DEFAULT_AXIS_HEIGHT = parseDimension("207pt", {});
export const PGFPLOTS_DEFAULT_TEXT_WIDTH = parseDimension("345pt", {});
export const PGFPLOTS_DEFAULT_AXIS_ASPECT = PGFPLOTS_DEFAULT_AXIS_WIDTH / PGFPLOTS_DEFAULT_AXIS_HEIGHT;
export const PGFPLOTS_AXIS_LABEL_CONST_X = parseDimension("45pt", {});
export const PGFPLOTS_AXIS_LABEL_CONST_Y = parseDimension("45pt", {});
export const PGFPLOTS_OPEN_AXIS_LABEL_CONST_Y = parseDimension("45pt", {});
export const PGFPLOTS_EXPLICIT_MIDDLE_AXIS_RESERVE = parseDimension("45.68pt", {});
export const PGFPLOTS_INTERIOR_MIDDLE_AXIS_RESERVE = parseDimension("45pt", {});
export const PGFPLOTS_SCALED_Y_MIDDLE_AXIS_RESERVE_X = parseDimension("46.4pt", {});
export const PGFPLOTS_COMPACT_3D_EXPLICIT_WIDTH_RESERVE_X = parseDimension("43.77pt", {});
export const PGFPLOTS_DEFAULT_PERSPECTIVE_3D_RESERVE_X = parseDimension("47.345pt", {});
export const PGFPLOTS_DEFAULT_PERSPECTIVE_3D_RESERVE_Y = parseDimension("46.398pt", {});
// For an explicit-width oblique 3D axis, PGFPlots retains an outer layout
// reserve for the colorbar tick labels. It changes the picture bbox only;
// the projected plot box remains unchanged.
const PGFPLOTS_COMPACT_3D_EXPLICIT_WIDTH_RIGHT_RESERVE = parseDimension("8.7pt", {});
const PGFPLOTS_COMPACT_3D_LEFT_RESERVE = 0.52;
const PGFPLOTS_COMPACT_3D_RIGHT_RESERVE = 0.43;
const PGFPLOTS_COMPACT_3D_SCALED_Z_TICK_RIGHT_RESERVE = parseDimension("2.7pt", {});
// A scaled z tick multiplier such as `\cdot 10^{-2}` extends the native
// picture bbox below the 3D box by this default Computer Modern reserve.
const PGFPLOTS_COMPACT_3D_SCALED_Z_TICK_BOTTOM_RESERVE = parseDimension("0.308cm", {});
const PGFPLOTS_DEFAULT_TICK_FONT_SIZE_PT = 10;
const PGFPLOTS_DEFAULT_NODE_INNER_SEP = parseDimension("3.33333pt", {});

export function createAxisGeometry(axisOptions = {}, ranges = {}) {
  const scale = axisScaleFactor(axisOptions.scale);
  const is3dSurface = Boolean(axisOptions["pgfplots 3d surface"]);
  const isTopViewSurface = is3dSurface && isPgfplotsTopView(axisOptions);
  const fallbackWidth = PGFPLOTS_DEFAULT_AXIS_WIDTH;
  const fallbackHeight = PGFPLOTS_DEFAULT_AXIS_HEIGHT;
  const xUnitWidth = axisOptions["pgfplots explicit x unit"] ? axisUnitDimension(axisOptions.x, ranges.xMax - ranges.xMin) : null;
  const yUnitHeight = axisOptions["pgfplots explicit y unit"] ? axisUnitDimension(axisOptions.y, ranges.yMax - ranges.yMin) : null;
  const hasExplicitWidth = hasAxisBound(axisOptions.width);
  const hasExplicitHeight = hasAxisBound(axisOptions.height);
  let requestedWidth = parseAxisDimension(axisOptions.width, xUnitWidth ?? fallbackWidth);
  let requestedHeight = parseAxisDimension(axisOptions.height, yUnitHeight ?? fallbackHeight);
  if (hasExplicitWidth && !hasExplicitHeight && !yUnitHeight) {
    requestedHeight = requestedWidth / PGFPLOTS_DEFAULT_AXIS_ASPECT;
  } else if (!hasExplicitWidth && hasExplicitHeight && !xUnitWidth) {
    requestedWidth = requestedHeight * PGFPLOTS_DEFAULT_AXIS_ASPECT;
  }
  const explicitUnitRatio = parsePgfplotsUnitVectorRatio(axisOptions["unit vector ratio*"]);
  const unitRatio = explicitUnitRatio || (axisEqualImageEnabled(axisOptions) ? { x: 1, y: 1, z: 1 } : null);
  let plotBoxAlreadyLabelAdjusted = false;
  if (unitRatio) {
    // PGFPlots applies `enlarge ... limits` to the coordinate transform before
    // it enforces `unit vector ratio*`. Keep `axis equal image` on its
    // existing range rule: its 3D projection semantics are different.
    const ratioRanges = explicitUnitRatio ? axisTransformRanges(axisOptions, ranges) : ranges;
    const mappedXMinForRatio = scaleAxisValue(ratioRanges.xMin, isLogAxis(axisOptions, "x"));
    const mappedXMaxForRatio = scaleAxisValue(ratioRanges.xMax, isLogAxis(axisOptions, "x"));
    const mappedYMinForRatio = scaleAxisValue(ratioRanges.yMin, isLogAxis(axisOptions, "y"));
    const mappedYMaxForRatio = scaleAxisValue(ratioRanges.yMax, isLogAxis(axisOptions, "y"));
    const xSpanForRatio = Math.abs(mappedXMaxForRatio - mappedXMinForRatio) || 1;
    const ySpanForRatio = Math.abs(mappedYMaxForRatio - mappedYMinForRatio) || 1;
    const targetAspect = (xSpanForRatio * unitRatio.x) / (ySpanForRatio * unitRatio.y);
    const targetBox = pgfplotsAxisTargetBox(axisOptions, requestedWidth, requestedHeight);
    if (Number.isFinite(targetAspect) && targetAspect > 0) {
      if (targetBox.width / targetBox.height > targetAspect) {
        requestedHeight = targetBox.height;
        requestedWidth = requestedHeight * targetAspect;
      } else {
        requestedWidth = targetBox.width;
        requestedHeight = requestedWidth / targetAspect;
      }
      plotBoxAlreadyLabelAdjusted = true;
    }
  }
  const plotArea = axisPlotAreaSize(axisOptions, requestedWidth, requestedHeight, {
    hasExplicitHeight,
    hasExplicitWidth,
    isDefaultPerspective3D: is3dSurface && !isTopViewSurface && !hasExplicitWidth && !hasExplicitHeight,
    isCompact3DExplicitWidth: is3dSurface && !isTopViewSurface && hasExplicitWidth,
    plotBoxAlreadyLabelAdjusted,
    ranges
  });
  const localWidth = plotArea.width * scale;
  const localHeight = plotArea.height * scale;
  const localOrigin = parseAxisAt(axisOptions.at);
  const inheritedPlotBox = pgfplotsInheritedPlotBox(axisOptions);
  const width = inheritedPlotBox?.width ?? localWidth;
  const height = inheritedPlotBox?.height ?? localHeight;
  const origin = inheritedPlotBox?.origin ?? localOrigin;
  const margin = scaleAxisMargin(axisContainerMargin(axisOptions, { hasExplicitHeight, hasExplicitWidth, ranges, plotArea }), scale);
  const transformRanges = axisTransformRanges(axisOptions, ranges);
  const lineRanges = axisLineRanges(axisOptions, ranges);
  const transform = createDataToCanvasTransform({ ranges: transformRanges, geometry: { origin, width, height }, axisOptions });
  const descriptionBounds = createAxisDescriptionBounds(lineRanges, transform.mapPoint);
  const mapAxisDescriptionPoint = (point) => ({
    x: descriptionBounds.left + descriptionBounds.width * Number(point.x || 0),
    y: descriptionBounds.bottom + descriptionBounds.height * Number(point.y || 0)
  });
  const mappedXMin = scaleAxisValue(transformRanges.xMin, transform.xLog);
  const mappedXMax = scaleAxisValue(transformRanges.xMax, transform.xLog);
  const mappedYMin = scaleAxisValue(transformRanges.yMin, transform.yLog);
  const mappedYMax = scaleAxisValue(transformRanges.yMax, transform.yLog);
  const xSpan = mappedXMax - mappedXMin || 1;
  const ySpan = mappedYMax - mappedYMin || 1;
  const zMin = Number.isFinite(ranges.zMin) ? ranges.zMin : 0;
  const zMax = Number.isFinite(ranges.zMax) && ranges.zMax !== zMin ? ranges.zMax : zMin + 1;
  const zSpan = zMax - zMin || 1;
  const axisDirections = {
    x: transform.xDirection,
    y: transform.yDirection,
    z: axisDirectionSign(axisOptions["z dir"])
  };
  const allowRelativeAxisReversal = axisBooleanOption(axisOptions["allow reversal of rel axis cs"], true);
  const viewProjection = createPgfplots3DViewProjection(axisOptions, width, height);
  const mapNormalizedPoint3d = (point) => {
    const projected = viewProjection(point.x, point.y, point.z ?? 0);
    return {
      x: origin.x + projected.x,
      y: origin.y + projected.y
    };
  };
  const projectedOrigin3d = mapNormalizedPoint3d({ x: 0, y: 0, z: 0 });
  const mapAxisDirection3d = (vector) => {
    const projected = mapNormalizedPoint3d({
      x: vector.x * axisDirections.x,
      y: vector.y * axisDirections.y,
      z: (vector.z ?? 0) * axisDirections.z
    });
    return {
      x: projected.x - projectedOrigin3d.x,
      y: projected.y - projectedOrigin3d.y
    };
  };
  const mapPoint3d = (point) => {
    const rawX = (scaleAxisValue(point.x, transform.xLog) - mappedXMin) / xSpan;
    const rawY = (scaleAxisValue(point.y, transform.yLog) - mappedYMin) / ySpan;
    const rawZ = ((point.z ?? 0) - zMin) / zSpan;
    const nx = axisDirections.x < 0 ? 1 - rawX : rawX;
    const ny = axisDirections.y < 0 ? 1 - rawY : rawY;
    const nz = axisDirections.z < 0 ? 1 - rawZ : rawZ;
    return mapNormalizedPoint3d({ x: nx, y: ny, z: nz });
  };
  const mapRelativePoint = (point, allowReversal = allowRelativeAxisReversal) => transform.mapNormalizedPoint(point, !allowReversal);
  const mapNormalizedAxisPoint = (point) => transform.mapNormalizedPoint(point, true);
  const mapRelativePoint3d = (point, allowReversal = allowRelativeAxisReversal) => mapNormalizedPoint3d({
    x: !allowReversal && axisDirections.x < 0 ? 1 - point.x : point.x,
    y: !allowReversal && axisDirections.y < 0 ? 1 - point.y : point.y,
    z: !allowReversal && axisDirections.z < 0 ? 1 - (point.z ?? 0) : (point.z ?? 0)
  });
  const mapNormalizedAxisPoint3d = (point) => mapRelativePoint3d(point, false);
  return {
    width,
    height,
    origin,
    // A secondary axis can share the primary data box while its own PGFPlots
    // layout allocation still participates in the TikZ picture bounding box.
    layoutBounds: inheritedPlotBox ? { width: localWidth, height: localHeight, origin: localOrigin } : null,
    margin,
    ranges,
    transformRanges,
    lineRanges,
    mapPoint: transform.mapPoint,
    mapPoint3d,
    mapNormalizedPoint3d,
    mapRelativePoint,
    mapAxisDescriptionPoint,
    mapRelativePoint3d,
    mapNormalizedAxisPoint,
    mapNormalizedAxisPoint3d,
    mapAxisDirection3d,
    axisDirections,
    allowRelativeAxisReversal,
    is3d: is3dSurface,
    xLog: transform.xLog,
    yLog: transform.yLog
  };
}

function createAxisDescriptionBounds(lineRanges = {}, mapPoint) {
  const corners = [
    mapPoint({ x: lineRanges.xMin, y: lineRanges.yMin }),
    mapPoint({ x: lineRanges.xMax, y: lineRanges.yMin }),
    mapPoint({ x: lineRanges.xMax, y: lineRanges.yMax }),
    mapPoint({ x: lineRanges.xMin, y: lineRanges.yMax })
  ];
  const xs = corners.map((point) => Number(point.x)).filter(Number.isFinite);
  const ys = corners.map((point) => Number(point.y)).filter(Number.isFinite);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const bottom = Math.min(...ys);
  const top = Math.max(...ys);
  return { left, right, bottom, top, width: right - left, height: top - bottom };
}

function pgfplotsInheritedPlotBox(axisOptions = {}) {
  const box = axisOptions["tikzkit pgfplots inherited plot box"];
  if (!box || typeof box !== "object") return null;
  const width = Number(box.width);
  const height = Number(box.height);
  const x = Number(box.origin?.x);
  const y = Number(box.origin?.y);
  if (![width, height, x, y].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return { width, height, origin: { x, y } };
}

function axisDirectionSign(raw) {
  return String(raw || "").trim().toLowerCase() === "reverse" ? -1 : 1;
}

function axisBooleanOption(raw, fallback) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  if (raw === true || raw === false) return raw;
  return !["false", "0", "off", "no"].includes(String(raw).trim().toLowerCase());
}

export function axisScaleFactor(raw) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function parseAxisDimension(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = parseDimension(String(value), {
    textwidth: PGFPLOTS_DEFAULT_TEXT_WIDTH,
    linewidth: PGFPLOTS_DEFAULT_TEXT_WIDTH,
    columnwidth: PGFPLOTS_DEFAULT_TEXT_WIDTH
  });
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseAxisAt(value) {
  if (!value) return { x: 0, y: 0 };
  const text = String(value).trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  const match = text.match(/^\(([\s\S]*)\)$/);
  if (!match) return { x: 0, y: 0 };
  const parts = splitTopLevel(match[1], ",");
  return {
    x: parseDimension(parts[0] || "0", {}),
    y: parseDimension(parts[1] || "0", {})
  };
}

export function pgfplotsScaleOnlyAxis(axisOptions = {}) {
  const raw = axisOptions["scale only axis"];
  if (raw === undefined || raw === null || raw === false) return false;
  if (raw === true) return true;
  const normalized = String(raw).trim().toLowerCase();
  return normalized === "" || normalized === "true";
}

export function isMiddleAxis(axisOptions = {}) {
  const axisLines = String(axisOptions["axis lines"] || axisOptions.axis || "").trim();
  if (isMiddleAxisLineValue(axisLines)) return true;
  const xAxisLine = String(axisOptions["axis x line"] || "").trim();
  const yAxisLine = String(axisOptions["axis y line"] || "").trim();
  return isMiddleAxisLineValue(xAxisLine) && isMiddleAxisLineValue(yAxisLine);
}

function isMiddleAxisLineValue(value) {
  return value === "middle" || value === "center";
}

function parsePgfplotsUnitVectorRatio(raw) {
  if (raw === undefined || raw === null || raw === true) return null;
  const values = String(raw).trim().split(/\s+/).map(Number).filter((value) => Number.isFinite(value) && value > 0);
  if (!values.length) return null;
  return { x: values[0] || 1, y: values[1] || 1, z: values[2] || 1 };
}

function axisEqualImageEnabled(axisOptions = {}) {
  const raw = axisOptions["axis equal image"] ?? axisOptions["axis equal"];
  if (raw === undefined || raw === null || raw === false) return false;
  if (raw === true) return true;
  const text = String(raw).trim().toLowerCase();
  return text === "" || text === "true";
}

function pgfplotsAxisTargetBox(axisOptions, width, height, options = {}) {
  if (pgfplotsScaleOnlyAxis(axisOptions)) return { width, height };
  const reserveX = compact3DLabelReserveX(width, options);
  return {
    width: Math.max(0, width - reserveX),
    height: Math.max(0, height - axisLabelReserveY(axisOptions))
  };
}

function compact3DLabelReserveX(requestedWidth, options = {}) {
  if (!options.compact3DExplicitWidth) return PGFPLOTS_AXIS_LABEL_CONST_X;
  return Math.min(PGFPLOTS_COMPACT_3D_EXPLICIT_WIDTH_RESERVE_X, requestedWidth * 0.45);
}

function axisLabelReserveY(axisOptions = {}) {
  if (axisUsesOpenLine(axisOptions["axis lines"] ?? axisOptions.axis)) return PGFPLOTS_OPEN_AXIS_LABEL_CONST_Y;
  if (axisUsesOpenLine(axisOptions["axis x line"] ?? axisOptions["axis x line*"])) return PGFPLOTS_OPEN_AXIS_LABEL_CONST_Y;
  if (axisUsesOpenLine(axisOptions["axis y line"] ?? axisOptions["axis y line*"])) return PGFPLOTS_OPEN_AXIS_LABEL_CONST_Y;
  return PGFPLOTS_AXIS_LABEL_CONST_Y;
}

function axisUsesOpenLine(raw) {
  if (raw === undefined || raw === null || raw === true || raw === false) return false;
  const value = String(raw).trim().toLowerCase();
  return value !== "" && value !== "box" && value !== "none" && value !== "false" && value !== "off";
}

function scaleAxisMargin(margin, scale) {
  return Object.fromEntries(Object.entries(margin).map(([key, value]) => [key, value * scale]));
}

function axisPlotAreaSize(axisOptions, requestedWidth, requestedHeight, options = {}) {
  if (pgfplotsScaleOnlyAxis(axisOptions)) {
    return { width: requestedWidth, height: requestedHeight };
  }
  if (axisOptions["hide axis"] || axisOptions.hide) {
    return { width: requestedWidth, height: requestedHeight };
  }
  if (options.isDefaultPerspective3D) {
    // PGFPlots' default 240pt x 207pt dimensions include the descriptions.
    // Its default perspective plot box is 192.655pt x 160.602pt after those
    // reserves are removed; using the 2D 45pt reserve enlarges every 3D basis.
    return {
      width: Math.max(requestedWidth * 0.5, requestedWidth - PGFPLOTS_DEFAULT_PERSPECTIVE_3D_RESERVE_X),
      height: Math.max(requestedHeight * 0.5, requestedHeight - PGFPLOTS_DEFAULT_PERSPECTIVE_3D_RESERVE_Y)
    };
  }
  if (isMiddleAxis(axisOptions)) {
    const target = { width: requestedWidth, height: requestedHeight };
    const tightBounds = middleAxisUsesTightBounds(axisOptions);
    const usesDefaultEnlargedReserve =
      axisHasEnabledEnlargeLimits(axisOptions) && !options.hasExplicitWidth && !options.hasExplicitHeight;
    const reservedX = options.hasExplicitWidth
      ? middleAxisExplicitReserve(axisOptions, "x", tightBounds, options.ranges)
      : usesDefaultEnlargedReserve
        ? TIKZ_PGFPLOTS_DEFAULT_ENLARGED_MIDDLE_AXIS_RESERVED_X
        : TIKZ_PGFPLOTS_DEFAULT_MIDDLE_AXIS_RESERVED_X;
    const reservedY = options.hasExplicitHeight
      ? middleAxisExplicitReserve(axisOptions, "y", tightBounds, options.ranges)
      : usesDefaultEnlargedReserve
        ? TIKZ_PGFPLOTS_DEFAULT_ENLARGED_MIDDLE_AXIS_RESERVED_Y
        : TIKZ_PGFPLOTS_DEFAULT_MIDDLE_AXIS_RESERVED_Y;
    const outerWidth = Math.max(target.width * 0.5, target.width - reservedX);
    const outerHeight = Math.max(target.height * 0.5, target.height - reservedY);
    return {
      width: outerWidth / middleAxisSpecificEnlargeFactor(axisOptions, "x"),
      height: outerHeight / middleAxisSpecificEnlargeFactor(axisOptions, "y")
    };
  }
  return options.plotBoxAlreadyLabelAdjusted
    ? { width: requestedWidth, height: requestedHeight }
    : pgfplotsAxisTargetBox(axisOptions, requestedWidth, requestedHeight, {
        compact3DExplicitWidth: options.isCompact3DExplicitWidth
      });
}

function middleAxisExplicitReserve(axisOptions = {}, axis = "x", _tightBounds = false, ranges = {}) {
  // The documented reserve is nominally 45pt. With every tick disabled,
  // PGFPlots' final middle-axis transform also absorbs the axis-line allowance:
  // When both middle lines pass through the plot interior, native PGFPlots uses
  // the documented 45pt description reserve and clips data paint at the plot
  // rectangle. Boundary-middle axes keep the extra line allowance below.
  if (perpendicularMiddleAxisIsInterior(axis, ranges)) {
    return PGFPLOTS_INTERIOR_MIDDLE_AXIS_RESERVE;
  }
  // An explicit boundary-middle axis keeps the additional line allowance.
  if (String(axisOptions.ticks || "").trim().toLowerCase() === "none") {
    return PGFPLOTS_EXPLICIT_MIDDLE_AXIS_RESERVE;
  }
  if (
    axisHasExplicitDisabledEnlargeLimits(axisOptions) &&
    !middleAxisTicksTouchBounds(axisOptions, ranges, {}, axis)
  ) {
    return PGFPLOTS_EXPLICIT_MIDDLE_AXIS_RESERVE;
  }
  if (middleAxisUsesScaledYTicks(axisOptions, ranges)) {
    return axis === "x" ? PGFPLOTS_SCALED_Y_MIDDLE_AXIS_RESERVE_X : PGFPLOTS_EXPLICIT_MIDDLE_AXIS_RESERVE;
  }
  return PGFPLOTS_AXIS_LABEL_CONST_X;
}

function perpendicularMiddleAxisIsInterior(axis, ranges = {}) {
  const min = Number(axis === "x" ? ranges.yMin : ranges.xMin);
  const max = Number(axis === "x" ? ranges.yMax : ranges.xMax);
  return Number.isFinite(min) && Number.isFinite(max) && min < 0 && max > 0;
}

function middleAxisUsesScaledYTicks(axisOptions = {}, ranges = {}) {
  const yTickStyle = parseOptions(String(axisOptions["y tick label style"] ?? axisOptions.yticklabelStyle ?? ""));
  const raw = axisOptions["scaled y ticks"] ?? axisOptions["scaled ticks"] ?? yTickStyle["scaled y ticks"] ?? yTickStyle["scaled ticks"];
  if (raw === false || /^(?:false|none|off|0)$/i.test(String(raw || "").trim())) return false;
  const maxAbs = Math.max(Math.abs(Number(ranges.yMin) || 0), Math.abs(Number(ranges.yMax) || 0));
  if (!(maxAbs > 0)) return false;
  const exponent = Math.floor(Math.log10(maxAbs));
  const above = Number(axisOptions["scale ticks above exponent"] ?? 3);
  const below = Number(axisOptions["scale ticks below exponent"] ?? -1);
  return exponent > (Number.isFinite(above) ? above : 3) || exponent < (Number.isFinite(below) ? below : -1);
}

function middleAxisSpecificEnlargeFactor(axisOptions = {}, axis = "x") {
  const raw = axisOptions[`enlarge ${axis} limits`] ?? axisOptions[`enlarge ${axis} limits*`];
  if (raw === undefined || raw === null || raw === "" || raw === false) return 1;
  const normalized = String(raw).trim().toLowerCase();
  if (["false", "0", "off", "none"].includes(normalized)) return 1;
  if (normalized === "upper" || normalized === "lower") return 1.1;
  return 1.2;
}

function axisUnitDimension(value, span) {
  const unit = parseDimension(String(value || ""), {});
  const axisSpan = Math.abs(Number(span));
  if (!Number.isFinite(unit) || unit <= 0 || !Number.isFinite(axisSpan) || axisSpan <= 0) return null;
  return unit * axisSpan;
}

function axisContainerMargin(axisOptions = {}, options = {}) {
  if (axisOptions["hide axis"] || axisOptions.hide) return TIKZ_HIDDEN_AXIS_CONTAINER_MARGIN;
  if (isMiddleAxis(axisOptions)) {
    // PGFPlots implements axis-description labels as ordinary TikZ nodes. Their
    // complete node boxes (including inner sep) participate in the picture
    // bbox, while the axis itself contributes only its painted paths. Keeping
    // the generic fixed middle-axis margin here double-counts that space and
    // shifts explicitly positioned labels relative to the native SVG.
    if (axisHasExplicitDescriptionPlacement(axisOptions)) {
      return { left: 0, right: 0, top: 0, bottom: 0 };
    }
    // With both tick lists disabled, the native picture bbox is determined by
    // the painted axis arrows and plot marks alone. This small asymmetric
    // reserve is the arrow/stroke paint extent; the generic middle-axis gutter
    // makes an otherwise empty SVG materially wider and taller than PGFPlots.
    if (middleAxisUsesTightBounds(axisOptions)) return { left: 0.04, right: 0.08, top: 0.04, bottom: 0.04 };
    if (options.hasExplicitWidth || options.hasExplicitHeight) {
      if (hasTopDescriptionYLabel(axisOptions)) return TIKZ_EXPLICIT_MIDDLE_AXIS_TOP_DESCRIPTION_LABEL_MARGIN;
      if (
        axisHasExplicitDisabledEnlargeLimits(axisOptions) ||
        (middleYAxisAtLeftBoundary(axisOptions, options.ranges) && axisHasExplicitRanges(axisOptions))
      ) {
        return explicitMiddleAxisNoEnlargeContainerMargin(axisOptions, options.ranges, options.plotArea);
      }
      if (axisHasEnabledEnlargeLimits(axisOptions)) return enlargedMiddleAxisContainerMargin(axisOptions);
      return TIKZ_EXPLICIT_MIDDLE_AXIS_CONTAINER_MARGIN;
    }
    if (axisHasEnabledEnlargeLimits(axisOptions)) return enlargedMiddleAxisContainerMargin(axisOptions);
    return TIKZ_MIDDLE_AXIS_CONTAINER_MARGIN;
  }
  if (axisOptions["pgfplots 3d surface"] && isPgfplotsTopView(axisOptions) && axisEqualImageEnabled(axisOptions)) {
    return { ...TIKZ_AXIS_CONTAINER_MARGIN, left: 0.71, bottom: 0.525 };
  }
  if (axisOptions["pgfplots 3d surface"] && !isPgfplotsTopView(axisOptions)) {
    const hasScaledZTickScaleLabel = scaledZTickScaleLabelActive(axisOptions, options.ranges);
    // Explicit-width axes use a narrower, measured bbox reserve than the
    // generic 3D gutter. A scaled z multiplier is the exception: its native
    // superscript extends the picture bbox below the projected 3D box.
    let right = options.hasExplicitWidth
      ? PGFPLOTS_COMPACT_3D_EXPLICIT_WIDTH_RIGHT_RESERVE
      : PGFPLOTS_COMPACT_3D_RIGHT_RESERVE;
    if (hasScaledZTickScaleLabel) right += PGFPLOTS_COMPACT_3D_SCALED_Z_TICK_RIGHT_RESERVE;
    const bottom = TIKZ_AXIS_CONTAINER_MARGIN.bottom + (hasScaledZTickScaleLabel ? PGFPLOTS_COMPACT_3D_SCALED_Z_TICK_BOTTOM_RESERVE : 0);
    return { ...TIKZ_AXIS_CONTAINER_MARGIN, left: PGFPLOTS_COMPACT_3D_LEFT_RESERVE, right, top: 0, bottom };
  }
  if (axisOptions["datavis clean axes"] && axisOptions["datavis candle stick plot"]) return { ...TIKZ_AXIS_CONTAINER_MARGIN, right: 0.3, top: 0, bottom: 0 };
  if (axisOptions["datavis clean axes"]) return { ...TIKZ_AXIS_CONTAINER_MARGIN, top: 0, bottom: 0 };
  if (axisOptions["datavis boxed axes"]) return { ...TIKZ_AXIS_CONTAINER_MARGIN, top: 0.07, bottom: 0.07 };
  if (isStandardBoxAxis(axisOptions)) {
    return standardBoxAxisContainerMargin(axisOptions, options.ranges, options.plotArea);
  }
  return TIKZ_AXIS_CONTAINER_MARGIN;
}

function axisHasExplicitRanges(axisOptions = {}) {
  return ["xmin", "xmax", "ymin", "ymax"].every((key) => hasAxisBound(axisOptions[key]));
}

export function axisHasExplicitDescriptionPlacement(axisOptions = {}) {
  return [
    axisOptions["x label style"],
    axisOptions["xlabel style"],
    axisOptions["y label style"],
    axisOptions["ylabel style"]
  ].some((rawStyle) => {
    if (rawStyle === undefined || rawStyle === null || rawStyle === true || rawStyle === false) return false;
    const at = parseOptions(String(rawStyle)).at;
    return /axis\s+description\s+cs\s*:/i.test(String(at || ""));
  });
}

function isStandardBoxAxis(axisOptions = {}) {
  if (axisOptions["hide axis"] || axisOptions.hide || isMiddleAxis(axisOptions)) return false;
  const raw = axisOptions["axis lines"] ?? axisOptions.axis;
  if (raw === undefined || raw === null || raw === "" || raw === true) return true;
  return String(raw).trim().toLowerCase() === "box";
}

function standardBoxAxisContainerMargin(axisOptions = {}, ranges = {}, plotArea = {}) {
  const frameHalfWidth = parseDimension("0.2pt", {});
  const xLabels = geometryAxisTickLabels(axisOptions, "x", ranges, plotArea);
  const yLabels = geometryAxisTickLabels(axisOptions, "y", ranges, plotArea);
  const xInnerSep = geometryTickInnerSep(axisOptions, "x");
  const yInnerSep = geometryTickInnerSep(axisOptions, "y");
  const xLabelHeight = Math.max(0, ...xLabels.map(geometryTickLabelHeight));
  const yLabelWidth = Math.max(0, ...yLabels.map(geometryTickLabelWidth));
  const xOnTop = boxTickLabelsUseUpperSide(axisOptions, "x");
  const yOnRight = boxTickLabelsUseUpperSide(axisOptions, "y");
  const xReserve = Math.max(frameHalfWidth, xLabelHeight + 2 * xInnerSep);
  const yReserve = Math.max(frameHalfWidth, yLabelWidth + 2 * yInnerSep);

  return {
    left: yOnRight ? frameHalfWidth : yReserve,
    right: yOnRight ? yReserve : frameHalfWidth,
    top: xOnTop ? xReserve : frameHalfWidth,
    bottom: xOnTop ? frameHalfWidth : xReserve
  };
}

function boxTickLabelsUseUpperSide(axisOptions = {}, axis = "x") {
  const raw = axisOptions[`${axis}ticklabel pos`] ?? axisOptions[`${axis} tick label pos`] ?? axisOptions["ticklabel pos"] ?? axisOptions["tick label pos"];
  const value = String(raw || "").trim().toLowerCase();
  return value === "upper" || (axis === "x" ? value === "top" : value === "right");
}

function enlargedMiddleAxisContainerMargin(axisOptions = {}) {
  const margin = { ...TIKZ_ENLARGED_MIDDLE_AXIS_CONTAINER_MARGIN };
  const hasExplicitXRange = hasAxisBound(axisOptions.xmin) && hasAxisBound(axisOptions.xmax);
  const hasExplicitYRange = hasAxisBound(axisOptions.ymin) || hasAxisBound(axisOptions.ymax);
  if (hasExplicitXRange && !hasExplicitYRange) {
    margin.bottom = 0.173;
  }
  return margin;
}

function explicitMiddleAxisNoEnlargeContainerMargin(axisOptions = {}, ranges = {}, plotArea = {}) {
  const margin = { ...TIKZ_EXPLICIT_MIDDLE_AXIS_NO_ENLARGE_CONTAINER_MARGIN };
  if (middleYAxisAtLeftBoundary(axisOptions, ranges)) {
    const boundaryMargins = explicitMiddleBoundaryTickMargins(axisOptions, ranges, plotArea);
    margin.left = boundaryMargins.left;
    margin.right = boundaryMargins.right;
  } else if (!middleAxisTicksTouchBounds(axisOptions, ranges, plotArea, "x")) {
    margin.left = 0;
    margin.right = 0;
  }
  if (!middleAxisTicksTouchBounds(axisOptions, ranges, plotArea, "y")) {
    margin.top = 0;
    margin.bottom = 0;
  }
  if (middleXAxisAtBottomBoundary(axisOptions, ranges)) {
    margin.top = parseDimension("0.2pt", {});
    margin.bottom = explicitMiddleBottomTickReserve(axisOptions, ranges, plotArea);
  }
  return margin;
}

function explicitMiddleBottomTickReserve(axisOptions = {}, ranges = {}, plotArea = {}) {
  const frameHalfWidth = parseDimension("0.2pt", {});
  const tickLength = parseDimension(String(axisOptions["major tick length"] || axisOptions.tickwidth || "0.15cm"), {});
  const tickProjection = tickLength * middleTickOutwardFactor(axisOptions["tick align"]);
  const labels = geometryAxisTickLabels(axisOptions, "x", ranges, plotArea);
  const labelHeight = Math.max(0, ...labels.map(geometryTickLabelHeight));
  const innerSep = geometryTickInnerSep(axisOptions, "x");
  return Math.max(frameHalfWidth, tickProjection + labelHeight + 2 * innerSep + frameHalfWidth);
}

function explicitMiddleBoundaryTickMargins(axisOptions = {}, ranges = {}, plotArea = {}) {
  const tickLength = parseDimension(String(axisOptions["major tick length"] || axisOptions.tickwidth || "0.15cm"), {});
  const alignmentFactor = middleTickOutwardFactor(axisOptions["tick align"]);
  const yLabels = geometryAxisTickLabels(axisOptions, "y", ranges, plotArea);
  const xLabels = geometryAxisTickLabels(axisOptions, "x", ranges, plotArea);
  if (![...xLabels, ...yLabels].every((label) => geometryTickLabelIsPlainNumber(label.text))) {
    return { left: 1.1, right: 0.02 };
  }
  const widestYLabel = Math.max(0, ...yLabels.map(geometryTickLabelWidth));
  const endXLabel = geometryEndTickLabelWidth(xLabels, Number(ranges.xMax));
  const yInnerSep = geometryTickInnerSep(axisOptions, "y");
  const xInnerSep = geometryTickInnerSep(axisOptions, "x");

  return {
    left: Math.max(
      TIKZ_EXPLICIT_MIDDLE_AXIS_NO_ENLARGE_CONTAINER_MARGIN.left,
      tickLength * alignmentFactor + widestYLabel + 2 * yInnerSep
    ),
    right: endXLabel > 0 ? Math.max(0.02, endXLabel / 2 + xInnerSep) : 0.02
  };
}

function geometryAxisTickLabels(axisOptions = {}, axis, ranges = {}, plotArea = {}) {
  const min = Number(ranges[`${axis}Min`]);
  const max = Number(ranges[`${axis}Max`]);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [];
  const rawTick = axisOptions[`${axis}tick`] ?? axisOptions[`${axis} tick`];
  if (ticksDisabled(rawTick) || ticksDisabled(axisOptions.ticks) || ticksDisabled(axisOptions.tick)) return [];
  const values = hasAxisBound(rawTick)
    ? axisTickValuesForGeometry(rawTick)
    : geometryAutoMajorTickValues(axisOptions, axis, min, max, plotArea[axis === "x" ? "width" : "height"], axis === "x" ? 7 : 6);
  const rawLabels = axisOptions[`${axis}ticklabels`] ?? axisOptions[`${axis} tick labels`];
  const explicitLabels = geometryExplicitTickLabels(rawLabels);
  const scaledValues = explicitLabels.length ? values : geometryScaledAxisTickValues(axisOptions, axis, values);
  return values.map((value, index) => ({
    value,
    text: explicitLabels[index] ?? formatAxisTickLabel(scaledValues[index])
  }));
}

function geometryScaledAxisTickValues(axisOptions = {}, axis, values = []) {
  const scale = geometryAxisTickScale(axisOptions, axis, values);
  return scale ? values.map((value) => roundAxis(value * scale.factor)) : values;
}

function geometryAxisTickScale(axisOptions = {}, axis, values = []) {
  const labelStyle = parseOptions(String(axisOptions[`${axis} tick label style`] ?? axisOptions[`${axis}ticklabel style`] ?? axisOptions["tick label style"] ?? ""));
  const raw = axisOptions[`scaled ${axis} ticks`] ?? axisOptions["scaled ticks"] ?? labelStyle[`scaled ${axis} ticks`] ?? labelStyle["scaled ticks"];
  const text = String(raw ?? "true").trim().toLowerCase();
  if (raw === false || ["false", "none", "off", "0"].includes(text)) return null;
  const baseMatch = text.match(/^base\s+10\s*:\s*([-+]?\d+)$/);
  if (baseMatch) {
    const exponent = Number(baseMatch[1]);
    return Number.isFinite(exponent) ? { factor: 10 ** exponent } : null;
  }
  if (text !== "true" && text !== "") return null;
  const maximum = Math.max(0, ...values.map((value) => Math.abs(Number(value))).filter(Number.isFinite));
  if (!(maximum > 0)) return null;
  const exponent = Math.floor(Math.log10(maximum));
  const above = Number(axisOptions["scale ticks above exponent"] ?? 3);
  const below = Number(axisOptions["scale ticks below exponent"] ?? -1);
  if (!(exponent > (Number.isFinite(above) ? above : 3) || exponent < (Number.isFinite(below) ? below : -1))) return null;
  return { factor: 10 ** -exponent };
}

function geometryExplicitTickLabels(raw) {
  if (!hasAxisBound(raw)) return [];
  const text = String(raw).trim().replace(/^\{([\s\S]*)\}$/, "$1");
  return splitTopLevel(text, ",").map((label) => String(label).trim());
}

function geometryTickLabelWidth(label) {
  const text = String(label?.text ?? "").replace(/^\$([\s\S]*)\$$/, "$1");
  const measured = measurePlainTextTeXBoxPt(text, { fontSizePt: PGFPLOTS_DEFAULT_TICK_FONT_SIZE_PT });
  if (measured) return measured.width / 28.45274;
  return [...text].length * parseDimension("5pt", {});
}

function geometryTickLabelHeight(label) {
  const text = String(label?.text ?? "").replace(/^\$([\s\S]*)\$$/, "$1");
  const measured = measurePlainTextTeXBoxPt(text, { fontSizePt: PGFPLOTS_DEFAULT_TICK_FONT_SIZE_PT });
  if (measured) return (measured.height + measured.depth) / 28.45274;
  return parseDimension("10pt", {});
}

function geometryTickLabelIsPlainNumber(text) {
  return /^[−-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(String(text || "").trim());
}

function geometryEndTickLabelWidth(labels, axisMax) {
  const span = Math.max(1, Math.abs(axisMax));
  const end = labels.findLast((label) => Math.abs(Number(label.value) - axisMax) <= span * 1e-9);
  return end ? geometryTickLabelWidth(end) : 0;
}

function geometryTickInnerSep(axisOptions = {}, axis) {
  const rawStyle = axisOptions[`${axis} tick label style`] ?? axisOptions[`${axis}ticklabel style`] ?? axisOptions["tick label style"];
  const style = hasAxisBound(rawStyle) ? parseOptions(String(rawStyle)) : {};
  const rawInnerSep = style["inner sep"] ?? style.innersep;
  if (!hasAxisBound(rawInnerSep)) return PGFPLOTS_DEFAULT_NODE_INNER_SEP;
  const parsed = parseDimension(String(rawInnerSep), {});
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : PGFPLOTS_DEFAULT_NODE_INNER_SEP;
}

function middleTickOutwardFactor(raw) {
  const alignment = String(raw || "center").trim().toLowerCase();
  if (alignment === "outside") return 1;
  if (alignment === "inside") return 0;
  return 0.5;
}

function middleYAxisAtLeftBoundary(axisOptions = {}, ranges = {}) {
  if (!isMiddleAxis(axisOptions)) return false;
  const xMin = Number(ranges.xMin);
  const xMax = Number(ranges.xMax);
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMin === xMax) return false;
  if (!(xMin <= 0 && xMax >= 0)) return false;
  const span = Math.abs(xMax - xMin) || 1;
  return Math.abs(xMin) <= Math.max(span * 1e-9, 1e-9);
}

function middleXAxisAtBottomBoundary(axisOptions = {}, ranges = {}) {
  if (!isMiddleAxis(axisOptions)) return false;
  const yMin = Number(ranges.yMin);
  const yMax = Number(ranges.yMax);
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax) || yMin === yMax) return false;
  if (!(yMin <= 0 && yMax >= 0)) return false;
  const span = Math.abs(yMax - yMin) || 1;
  return Math.abs(yMin) <= Math.max(span * 1e-9, 1e-9);
}

function middleAxisTicksTouchBounds(axisOptions = {}, ranges = {}, plotArea = {}, axis = "y") {
  if (ticksDisabled(axisOptions.ticks) || ticksDisabled(axisOptions.tick)) return false;
  const rawTick = axisOptions[`${axis}tick`] ?? axisOptions[`${axis} tick`];
  if (ticksDisabled(rawTick)) return false;
  const min = Number(ranges[`${axis}Min`]);
  const max = Number(ranges[`${axis}Max`]);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return false;
  const ticks = hasAxisBound(rawTick)
    ? axisTickValuesForGeometry(rawTick)
    : geometryAutoMajorTickValues(axisOptions, axis, min, max, plotArea[axis === "x" ? "width" : "height"], axis === "x" ? 7 : 6);
  return ticks.some((tick) => axisValueTouchesRangeBound(tick, min, max));
}

function geometryAutoMajorTickValues(axisOptions = {}, axis, min, max, axisLength, fallback = 6) {
  return geometryMajorTickValues(min, max, geometryAutoMajorTickCount(axisOptions, axis, min, max, axisLength, fallback));
}

function geometryAutoMajorTickCount(axisOptions = {}, axis, min, max, axisLength, fallback = 6) {
  const length = Number(axisLength);
  const baseCount = Number.isFinite(length) && length > 0
    ? Math.max(2, Math.ceil(length / (axis === "x" ? 1.8 : 1.25)) + 1)
    : fallback;
  const span = Number(max) - Number(min);
  if (
    axis === "y" &&
    isMiddleAxis(axisOptions) &&
    middleAxisAllowsSparseYTicksForGeometry(axisOptions) &&
    (hasAxisBound(axisOptions.ymin) || hasAxisBound(axisOptions.ymax)) &&
    Number.isFinite(span) &&
    span >= 1 &&
    span <= 3
  ) {
    return Math.min(baseCount, 4);
  }
  return baseCount;
}

function geometryMajorTickValues(min, max, maxTicks = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [];
  const span = max - min;
  const rawStep = Math.abs(span) / Math.max(1, maxTicks - 1);
  const exponent = Math.floor(Math.log10(rawStep));
  const base = 10 ** exponent;
  const fraction = rawStep / base;
  const tolerance = 1e-9;
  const niceFraction =
    fraction < 1.5 - tolerance ? 1 : fraction < 3.5 - tolerance ? 2 : fraction < 7.5 - tolerance ? 5 : 10;
  const step = niceFraction * base;
  const start = Math.ceil(min / step) * step;
  const values = [];
  for (let value = start; value <= max + step * 0.2; value += step) {
    values.push(roundAxis(value));
    if (values.length >= 200) break;
  }
  return values;
}

function axisTickValuesForGeometry(raw) {
  if (!hasAxisBound(raw)) return [];
  const text = String(raw).trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  if (!text || ticksDisabled(text)) return [];
  return axisNumberList(text).map(roundAxis);
}

function axisValueTouchesRangeBound(value, min, max) {
  const span = Math.abs(max - min) || 1;
  const epsilon = Math.max(span * 1e-3, 1e-9);
  return Math.abs(Number(value) - min) <= epsilon || Math.abs(Number(value) - max) <= epsilon;
}

function middleAxisAllowsSparseYTicksForGeometry(axisOptions = {}) {
  const raw = axisOptions.enlargelimits ?? axisOptions["enlarge x limits"] ?? axisOptions["enlarge y limits"];
  if (raw === undefined || raw === null || raw === "" || raw === true) return true;
  if (raw === false) return false;
  const normalized = String(raw).trim().toLowerCase();
  return normalized !== "false" && normalized !== "0" && normalized !== "off";
}

function middleAxisUsesTightBounds(axisOptions = {}) {
  if (ticksDisabled(axisOptions.ticks)) return true;
  const xTick = axisOptions.xtick ?? axisOptions["x tick"];
  const yTick = axisOptions.ytick ?? axisOptions["y tick"];
  return ticksDisabled(xTick) && ticksDisabled(yTick);
}

function axisHasEnabledEnlargeLimits(axisOptions = {}) {
  const raw = axisOptions.enlargelimits ?? axisOptions["enlarge x limits"] ?? axisOptions["enlarge y limits"];
  if (raw === undefined || raw === null || raw === "" || raw === false) return false;
  const normalized = String(raw).trim().toLowerCase();
  return normalized !== "" && normalized !== "false" && normalized !== "0" && normalized !== "off";
}

function scaledZTickScaleLabelActive(axisOptions = {}, ranges = {}) {
  const raw = axisOptions["scaled z ticks"] ?? axisOptions["scaled ticks"];
  if (scaledTicksDisabled(raw)) return false;
  const zMin = Number(ranges.zMin);
  const zMax = Number(ranges.zMax);
  const maxMagnitude = Math.max(Math.abs(zMin), Math.abs(zMax));
  if (!Number.isFinite(maxMagnitude) || maxMagnitude <= 0) return false;
  const exponent = Math.floor(Math.log10(maxMagnitude));
  const below = scaledTickExponentThreshold(axisOptions["scale ticks below exponent"], -1);
  const above = scaledTickExponentThreshold(axisOptions["scale ticks above exponent"], 3);
  return exponent < below || exponent > above;
}

function scaledTicksDisabled(raw) {
  if (raw === false) return true;
  if (raw === undefined || raw === null || raw === true) return false;
  const value = String(raw).trim().toLowerCase();
  return value === "false" || value === "off" || value === "none" || value === "0";
}

function scaledTickExponentThreshold(raw, fallback) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function axisTransformRanges(axisOptions = {}, ranges = {}) {
  return projectedMiddleAxisRanges(axisOptions, ranges, { axisLines: false });
}

export function axisLineRanges(axisOptions = {}, ranges = {}) {
  return projectedMiddleAxisRanges(axisOptions, ranges, { axisLines: true });
}

function projectedMiddleAxisRanges(axisOptions = {}, ranges = {}, options = {}) {
  const result = {
    xMin: Number(ranges.xMin),
    xMax: Number(ranges.xMax),
    yMin: Number(ranges.yMin),
    yMax: Number(ranges.yMax),
    zMin: Number.isFinite(Number(ranges.zMin)) ? Number(ranges.zMin) : 0,
    zMax: Number.isFinite(Number(ranges.zMax)) ? Number(ranges.zMax) : 1
  };
  if (!isMiddleAxis(axisOptions)) {
    for (const axis of ["x", "y"]) {
      if (!axisEnlargeEnabledFor(axisOptions, axis)) continue;
      const adjusted = relativeAxisEnlargeRange(axisOptions, axis, result[`${axis}Min`], result[`${axis}Max`]);
      result[`${axis}Min`] = adjusted.min;
      result[`${axis}Max`] = adjusted.max;
    }
    return roundTransformRanges(result);
  }
  if (!axisHasEnabledEnlargeLimits(axisOptions)) {
    return roundTransformRanges(result);
  }
  if (!isLogAxis(axisOptions, "x") && axisEnlargeEnabledFor(axisOptions, "x") && (options.axisLines || !hasAxisSpecificEnlargeOption(axisOptions, "x"))) {
    const adjusted = middleAxisTransformAxisRange(axisOptions, "x", result.xMin, result.xMax);
    result.xMin = adjusted.min;
    result.xMax = adjusted.max;
  }
  if (!isLogAxis(axisOptions, "y") && axisEnlargeEnabledFor(axisOptions, "y") && (options.axisLines || !hasAxisSpecificEnlargeOption(axisOptions, "y"))) {
    const adjusted = middleAxisTransformAxisRange(axisOptions, "y", result.yMin, result.yMax);
    result.yMin = adjusted.min;
    result.yMax = adjusted.max;
  }
  return roundTransformRanges(result);
}

function hasAxisSpecificEnlargeOption(axisOptions = {}, axis = "x") {
  const raw = axisOptions[`enlarge ${axis} limits`] ?? axisOptions[`enlarge ${axis} limits*`];
  if (raw === undefined || raw === null || raw === "" || raw === false) return false;
  return !["false", "0", "off", "none"].includes(String(raw).trim().toLowerCase());
}

function middleAxisTransformAxisRange(axisOptions, axis, min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return { min, max };
  const lowerExplicit = hasAxisBound(axisOptions[`${axis}min`]);
  const upperExplicit = hasAxisBound(axisOptions[`${axis}max`]);
  const span = Math.abs(max - min);
  if (lowerExplicit && upperExplicit) {
    const pad = span * 0.1;
    return { min: min - pad, max: max + pad };
  }
  const declaredDomain = axis === "x" ? axisDeclaredDomain(axisOptions.domain) : null;
  if (
    !lowerExplicit &&
    !upperExplicit &&
    Math.abs(min) < 1e-9 &&
    declaredDomain &&
    declaredDomain.min > 0 &&
    declaredDomain.max >= max
  ) {
    const declaredSpan = declaredDomain.max - declaredDomain.min;
    return {
      min: declaredDomain.min - declaredSpan * 0.1,
      max: declaredDomain.max + declaredSpan * 0.1
    };
  }
  if (!lowerExplicit && Math.abs(min) < 1e-9 && max > min) {
    // A restricted positive data domain (for example
    // `restrict y to domain=0:0.5`) still receives PGFPlots' ordinary
    // symmetric enlargement. The zero line then sits just inside the plot
    // box, leaving the matching lower grid reserve for a middle axis.
    if (axisHasRestrictedDomain(axisOptions, axis)) {
      const pad = span * 0.1;
      return { min: min - pad, max: max + pad };
    }
    return { min: min - span / 11, max };
  }
  if (!upperExplicit && Math.abs(max) < 1e-9 && min < max) {
    if (axisHasRestrictedDomain(axisOptions, axis)) {
      return { min: min - span * 0.2, max };
    }
    return { min, max: max + span / 11 };
  }
  if (!lowerExplicit && !upperExplicit) {
    // Inferred function/table limits have no user-specified boundary to
    // preserve. `enlargelimits=true` expands both sides by the default 10%,
    // including domains that start slightly above zero (such as 0.01:8).
    return { min: min - span * 0.1, max: max + span * 0.1 };
  }
  return { min, max };
}

function axisDeclaredDomain(rawDomain) {
  if (rawDomain === undefined || rawDomain === null || rawDomain === true || rawDomain === false) return null;
  const match = String(rawDomain)
    .trim()
    .replace(/^\{([\s\S]*)\}$/, "$1")
    .match(/^([+-]?(?:\d+\.?\d*|\.\d+))\s*:\s*([+-]?(?:\d+\.?\d*|\.\d+))$/);
  if (!match) return null;
  const min = Number(match[1]);
  const max = Number(match[2]);
  return Number.isFinite(min) && Number.isFinite(max) && max > min ? { min, max } : null;
}

function axisHasRestrictedDomain(axisOptions = {}, axis = "x") {
  return [
    axisOptions[`restrict ${axis} to domain`],
    axisOptions[`restrict ${axis} to domain*`]
  ].some((value) => value !== undefined && value !== null && value !== false && String(value).trim() !== "");
}

function axisEnlargeEnabledFor(axisOptions = {}, axis) {
  const raw = axisOptions[`enlarge ${axis} limits`] ?? axisOptions[`enlarge ${axis} limits*`] ?? axisOptions.enlargelimits;
  if (raw === undefined || raw === null || raw === "" || raw === false) return false;
  const normalized = String(raw).trim().toLowerCase();
  return normalized !== "false" && normalized !== "0" && normalized !== "off";
}

function relativeAxisEnlargeRange(axisOptions = {}, axis, min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return { min, max };
  const raw = axisOptions[`enlarge ${axis} limits`] ?? axisOptions[`enlarge ${axis} limits*`] ?? axisOptions.enlargelimits;
  const normalized = String(raw ?? "").trim().replace(/^\{([\s\S]*)\}$/, "$1").trim().toLowerCase();
  const relMatch = normalized.match(/(?:^|,)\s*rel\s*=\s*([+-]?(?:\d+\.?\d*|\.\d+))/);
  const absMatch = normalized.match(/(?:^|,)\s*abs\s*=\s*([+-]?(?:\d+\.?\d*|\.\d+))/);
  const numeric = Number(normalized);
  const fraction = relMatch
    ? Number(relMatch[1])
    : Number.isFinite(numeric) && normalized !== ""
      ? numeric
      : 0.1;
  const absolute = absMatch ? Number(absMatch[1]) : NaN;
  const pad = Number.isFinite(absolute) ? absolute : (max - min) * fraction;
  if (!(pad > 0)) return { min, max };
  const lower = !/(?:^|,)\s*upper\s*(?:,|$)/.test(normalized);
  const upper = !/(?:^|,)\s*lower\s*(?:,|$)/.test(normalized);
  return {
    min: lower ? min - pad : min,
    max: upper ? max + pad : max
  };
}

function roundTransformRanges(ranges) {
  return {
    xMin: roundAxis(ranges.xMin),
    xMax: roundAxis(ranges.xMax),
    yMin: roundAxis(ranges.yMin),
    yMax: roundAxis(ranges.yMax),
    zMin: roundAxisRange(ranges.zMin, "z"),
    zMax: roundAxisRange(ranges.zMax, "z")
  };
}

function axisHasExplicitDisabledEnlargeLimits(axisOptions = {}) {
  return ["enlargelimits", "enlarge x limits", "enlarge y limits"].some((key) => {
    const raw = axisOptions[key];
    if (raw === undefined || raw === null || raw === "") return false;
    if (raw === false) return true;
    const normalized = String(raw).trim().toLowerCase();
    return normalized === "false" || normalized === "0" || normalized === "off";
  });
}

function ticksDisabled(raw) {
  if (raw === undefined || raw === null || raw === false) return false;
  if (raw === true) return false;
  const text = String(raw).trim().toLowerCase();
  return text === "none" || text === "false" || text === "off" || text === "\\empty" || text === "empty";
}

function hasTopDescriptionYLabel(axisOptions = {}) {
  if (!axisOptions.ylabel && !axisOptions["y label"]) return false;
  const rawStyle = axisOptions["ylabel style"] ?? axisOptions["y label style"];
  if (rawStyle === undefined || rawStyle === null || rawStyle === true || rawStyle === false) return false;
  const styleOptions = parseOptions(String(rawStyle));
  const at = styleOptions.at;
  if (at === undefined || at === null || at === true || at === false) return false;
  const text = String(at).trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  const match = text.match(/^\(([\s\S]*)\)$/);
  if (!match) return false;
  const parts = splitTopLevel(match[1], ",");
  const y = Number(String(parts[1] || "").trim());
  return Number.isFinite(y) && y >= 0.95;
}

function hasAxisBound(value) {
  return value !== undefined && value !== null && value !== true && String(value).trim() !== "";
}

function createPgfplots3DViewProjection(axisOptions = {}, width = 1, height = 1) {
  const view = parsePgfplotsView(axisOptions.view);
  const plotBoxRatio = parsePgfplotsPlotBoxRatio(axisOptions["plot box ratio"]);
  const az = degreesToRadians(view.azimuth);
  const el = degreesToRadians(-view.elevation);
  const sinAz = Math.sin(az);
  const cosAz = Math.cos(az);
  const sinEl = Math.sin(el);
  const cosEl = Math.cos(el);
  // PGFPlots applies this ratio to its three basis vectors before scaling the
  // resulting projected box to the requested axis dimensions.
  const xVector = { x: cosAz * plotBoxRatio.x, y: sinAz * sinEl * plotBoxRatio.x };
  const yVector = { x: sinAz * plotBoxRatio.y, y: -sinEl * cosAz * plotBoxRatio.y };
  const zVector = { x: 0, y: cosEl * plotBoxRatio.z };
  const projectRaw = (x, y, z) => ({
    x: x * xVector.x + y * yVector.x + z * zVector.x,
    y: x * xVector.y + y * yVector.y + z * zVector.y
  });
  const corners = [
    projectRaw(0, 0, 0),
    projectRaw(1, 0, 0),
    projectRaw(0, 1, 0),
    projectRaw(1, 1, 0),
    projectRaw(0, 0, 1),
    projectRaw(1, 0, 1),
    projectRaw(0, 1, 1),
    projectRaw(1, 1, 1)
  ];
  const minX = Math.min(...corners.map((point) => point.x));
  const maxX = Math.max(...corners.map((point) => point.x));
  const minY = Math.min(...corners.map((point) => point.y));
  const maxY = Math.max(...corners.map((point) => point.y));
  const rawWidth = maxX - minX || 1;
  const rawHeight = maxY - minY || 1;
  const scaleMode = String(axisOptions["scale mode"] || "").trim().toLowerCase();
  const uniform = scaleMode === "scale uniformly";
  const uniformScale = Math.min(width / rawWidth, height / rawHeight);
  const scaleX = uniform ? uniformScale : width / rawWidth;
  const scaleY = uniform ? uniformScale : height / rawHeight;
  const offsetX = uniform ? (width - rawWidth * scaleX) / 2 : 0;
  const offsetY = uniform ? (height - rawHeight * scaleY) / 2 : 0;
  return (x, y, z) => {
    const raw = projectRaw(x, y, z);
    return {
      x: offsetX + (raw.x - minX) * scaleX,
      y: offsetY + (raw.y - minY) * scaleY
    };
  };
}

export function isPgfplotsTopView(axisOptions = {}) {
  const view = parsePgfplotsView(axisOptions.view);
  return Math.abs(view.azimuth) < 1e-9 && Math.abs(view.elevation - 90) < 1e-9;
}

function parsePgfplotsView(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return { azimuth: 25, elevation: 30 };
  const braced = [...text.matchAll(/\{([^{}]+)\}/g)].map((match) => Number(match[1]));
  if (braced.length >= 2 && braced.every(Number.isFinite)) {
    return { azimuth: braced[0], elevation: braced[1] };
  }
  const parts = text.split(/[\s,]+/).map((part) => Number(part)).filter(Number.isFinite);
  if (parts.length >= 2) return { azimuth: parts[0], elevation: parts[1] };
  return { azimuth: 25, elevation: 30 };
}

function parsePgfplotsPlotBoxRatio(raw) {
  const values = String(raw ?? "1 1 1")
    .replace(/[{}]/g, " ")
    .trim()
    .split(/\s+/)
    .map(Number);
  if (values.length < 3 || values.slice(0, 3).some((value) => !Number.isFinite(value) || value <= 0)) {
    return { x: 1, y: 1, z: 1 };
  }
  return { x: values[0], y: values[1], z: values[2] };
}

function degreesToRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

export function pgfplotsViewDirection(axisOptions = {}) {
  const view = parsePgfplotsView(axisOptions.view);
  const plotBoxRatio = parsePgfplotsPlotBoxRatio(axisOptions["plot box ratio"]);
  const az = degreesToRadians(view.azimuth);
  const el = degreesToRadians(-view.elevation);
  const sinAz = Math.sin(az);
  const cosAz = Math.cos(az);
  const sinEl = Math.sin(el);
  const cosEl = Math.cos(el);
  return {
    x: -sinAz * cosEl * plotBoxRatio.x,
    y: cosAz * cosEl * plotBoxRatio.y,
    z: sinEl * plotBoxRatio.z
  };
}
