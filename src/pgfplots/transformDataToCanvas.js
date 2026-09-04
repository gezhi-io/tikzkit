import { createAxisRanges, isLogAxis, scaleAxisValue } from "./ranges.js";
import { axisLogBase } from "./logAxis.js";

export function createDataToCanvasTransform({ ranges: rawRanges, geometry = {}, axisOptions = {} } = {}) {
  const ranges = createAxisRanges(rawRanges);
  const origin = geometry.origin || { x: 0, y: 0 };
  const width = Number.isFinite(geometry.width) ? geometry.width : 1;
  const height = Number.isFinite(geometry.height) ? geometry.height : 1;
  const xLog = geometry.xLog ?? isLogAxis(axisOptions, "x");
  const yLog = geometry.yLog ?? isLogAxis(axisOptions, "y");
  const xLogBase = geometry.xLogBase ?? axisLogBase(axisOptions, "x");
  const yLogBase = geometry.yLogBase ?? axisLogBase(axisOptions, "y");
  const mappedXMin = scaleAxisValue(ranges.xMin, xLog, xLogBase);
  const mappedXMax = scaleAxisValue(ranges.xMax, xLog, xLogBase);
  const mappedYMin = scaleAxisValue(ranges.yMin, yLog, yLogBase);
  const mappedYMax = scaleAxisValue(ranges.yMax, yLog, yLogBase);
  const xSpan = mappedXMax - mappedXMin || 1;
  const ySpan = mappedYMax - mappedYMin || 1;
  const xDirection = axisDirectionSign(axisOptions["x dir"]);
  const yDirection = axisDirectionSign(axisOptions["y dir"]);

  const mapNormalizedPoint = (point = {}, reverse = true) => {
    const x = reverse && xDirection < 0 ? 1 - point.x : point.x;
    const y = reverse && yDirection < 0 ? 1 - point.y : point.y;
    return {
      x: origin.x + x * width,
      y: origin.y + y * height
    };
  };

  return {
    origin,
    width,
    height,
    xLog,
    yLog,
    xLogBase,
    yLogBase,
    xDirection,
    yDirection,
    mapNormalizedPoint,
    mapPoint(point = {}) {
      return mapNormalizedPoint({
        x: (scaleAxisValue(point.x, xLog, xLogBase) - mappedXMin) / xSpan,
        y: (scaleAxisValue(point.y, yLog, yLogBase) - mappedYMin) / ySpan
      });
    }
  };
}

function axisDirectionSign(raw) {
  return String(raw || "").trim().toLowerCase() === "reverse" ? -1 : 1;
}

export function transformDataToCanvas(point, transform) {
  return transform.mapPoint(point);
}
