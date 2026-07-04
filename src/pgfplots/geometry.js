import {
  TIKZ_AXIS_CONTAINER_MARGIN,
  TIKZ_HIDDEN_AXIS_CONTAINER_MARGIN,
  TIKZ_MIDDLE_AXIS_CONTAINER_MARGIN,
  TIKZ_PGFPLOTS_MIDDLE_AXIS_RESERVED_X,
  TIKZ_PGFPLOTS_MIDDLE_AXIS_RESERVED_Y
} from "../tikz-metrics.js";
import { parseDimension } from "../engine/math.js";
import { splitTopLevel } from "../engine/options.js";
import { createDataToCanvasTransform } from "./transformDataToCanvas.js";
import { isLogAxis, scaleAxisValue } from "./ranges.js";

export const PGFPLOTS_DEFAULT_AXIS_WIDTH = parseDimension("240pt", {});
export const PGFPLOTS_DEFAULT_AXIS_HEIGHT = parseDimension("207pt", {});
export const PGFPLOTS_DEFAULT_AXIS_ASPECT = PGFPLOTS_DEFAULT_AXIS_WIDTH / PGFPLOTS_DEFAULT_AXIS_HEIGHT;
export const PGFPLOTS_AXIS_LABEL_CONST = parseDimension("45pt", {});

export function createAxisGeometry(axisOptions = {}, ranges = {}) {
  const scale = axisScaleFactor(axisOptions.scale);
  const is3dSurface = Boolean(axisOptions["pgfplots 3d surface"]);
  const fallbackWidth = is3dSurface ? 8.4 : PGFPLOTS_DEFAULT_AXIS_WIDTH;
  const fallbackHeight = is3dSurface ? 6.6 : PGFPLOTS_DEFAULT_AXIS_HEIGHT;
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
  const unitRatio = parsePgfplotsUnitVectorRatio(axisOptions["unit vector ratio*"]);
  let plotBoxAlreadyLabelAdjusted = false;
  if (unitRatio) {
    const mappedXMinForRatio = scaleAxisValue(ranges.xMin, isLogAxis(axisOptions, "x"));
    const mappedXMaxForRatio = scaleAxisValue(ranges.xMax, isLogAxis(axisOptions, "x"));
    const mappedYMinForRatio = scaleAxisValue(ranges.yMin, isLogAxis(axisOptions, "y"));
    const mappedYMaxForRatio = scaleAxisValue(ranges.yMax, isLogAxis(axisOptions, "y"));
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
  const plotArea = axisPlotAreaSize(axisOptions, requestedWidth, requestedHeight, { plotBoxAlreadyLabelAdjusted });
  const width = plotArea.width * scale;
  const height = plotArea.height * scale;
  const origin = parseAxisAt(axisOptions.at);
  const margin = scaleAxisMargin(axisContainerMargin(axisOptions), scale);
  const transform = createDataToCanvasTransform({ ranges, geometry: { origin, width, height }, axisOptions });
  const mappedXMin = scaleAxisValue(ranges.xMin, transform.xLog);
  const mappedXMax = scaleAxisValue(ranges.xMax, transform.xLog);
  const mappedYMin = scaleAxisValue(ranges.yMin, transform.yLog);
  const mappedYMax = scaleAxisValue(ranges.yMax, transform.yLog);
  const xSpan = mappedXMax - mappedXMin || 1;
  const ySpan = mappedYMax - mappedYMin || 1;
  const zMin = Number.isFinite(ranges.zMin) ? ranges.zMin : 0;
  const zMax = Number.isFinite(ranges.zMax) && ranges.zMax !== zMin ? ranges.zMax : zMin + 1;
  const zSpan = zMax - zMin || 1;
  const mapPoint3d = (point) => {
    const nx = (scaleAxisValue(point.x, transform.xLog) - mappedXMin) / xSpan;
    const ny = (scaleAxisValue(point.y, transform.yLog) - mappedYMin) / ySpan;
    const nz = (point.z - zMin) / zSpan;
    return {
      x: origin.x + width * 0.08 + nx * width * 0.62 + ny * width * 0.27,
      y: origin.y + height * 0.12 - nx * height * 0.1 + ny * height * 0.22 + nz * height * 0.62
    };
  };
  return { width, height, origin, margin, mapPoint: transform.mapPoint, mapPoint3d, xLog: transform.xLog, yLog: transform.yLog };
}

export function axisScaleFactor(raw) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function parseAxisDimension(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = parseDimension(String(value), {});
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
  return axisLines === "middle" || axisLines === "center";
}

function parsePgfplotsUnitVectorRatio(raw) {
  if (raw === undefined || raw === null || raw === true) return null;
  const values = String(raw).trim().split(/\s+/).map(Number).filter((value) => Number.isFinite(value) && value > 0);
  if (!values.length) return null;
  return { x: values[0] || 1, y: values[1] || 1, z: values[2] || 1 };
}

function pgfplotsAxisTargetBox(axisOptions, width, height) {
  if (pgfplotsScaleOnlyAxis(axisOptions)) return { width, height };
  return {
    width: Math.max(0, width - PGFPLOTS_AXIS_LABEL_CONST),
    height: Math.max(0, height - PGFPLOTS_AXIS_LABEL_CONST)
  };
}

function scaleAxisMargin(margin, scale) {
  return Object.fromEntries(Object.entries(margin).map(([key, value]) => [key, value * scale]));
}

function axisPlotAreaSize(axisOptions, requestedWidth, requestedHeight, options = {}) {
  if (pgfplotsScaleOnlyAxis(axisOptions)) {
    return { width: requestedWidth, height: requestedHeight };
  }
  if (isMiddleAxis(axisOptions)) {
    const target = { width: requestedWidth, height: requestedHeight };
    return {
      width: Math.max(target.width * 0.5, target.width - TIKZ_PGFPLOTS_MIDDLE_AXIS_RESERVED_X),
      height: Math.max(target.height * 0.5, target.height - TIKZ_PGFPLOTS_MIDDLE_AXIS_RESERVED_Y)
    };
  }
  return options.plotBoxAlreadyLabelAdjusted
    ? { width: requestedWidth, height: requestedHeight }
    : pgfplotsAxisTargetBox(axisOptions, requestedWidth, requestedHeight);
}

function axisUnitDimension(value, span) {
  const unit = parseDimension(String(value || ""), {});
  const axisSpan = Math.abs(Number(span));
  if (!Number.isFinite(unit) || unit <= 0 || !Number.isFinite(axisSpan) || axisSpan <= 0) return null;
  return unit * axisSpan;
}

function axisContainerMargin(axisOptions = {}) {
  if (axisOptions["hide axis"] || axisOptions.hide) return TIKZ_HIDDEN_AXIS_CONTAINER_MARGIN;
  if (isMiddleAxis(axisOptions)) return TIKZ_MIDDLE_AXIS_CONTAINER_MARGIN;
  if (axisOptions["datavis clean axes"] && axisOptions["datavis candle stick plot"]) return { ...TIKZ_AXIS_CONTAINER_MARGIN, right: 0.3, top: 0, bottom: 0 };
  if (axisOptions["datavis clean axes"]) return { ...TIKZ_AXIS_CONTAINER_MARGIN, top: 0, bottom: 0 };
  if (axisOptions["datavis boxed axes"]) return { ...TIKZ_AXIS_CONTAINER_MARGIN, top: 0.07, bottom: 0.07 };
  return TIKZ_AXIS_CONTAINER_MARGIN;
}

function hasAxisBound(value) {
  return value !== undefined && value !== null && value !== true && String(value).trim() !== "";
}
