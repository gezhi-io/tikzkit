import { createAxisRanges, isLogAxis, scaleAxisValue } from "./ranges.js";

export function createDataToCanvasTransform({ ranges: rawRanges, geometry = {}, axisOptions = {} } = {}) {
  const ranges = createAxisRanges(rawRanges);
  const origin = geometry.origin || { x: 0, y: 0 };
  const width = Number.isFinite(geometry.width) ? geometry.width : 1;
  const height = Number.isFinite(geometry.height) ? geometry.height : 1;
  const xLog = geometry.xLog ?? isLogAxis(axisOptions, "x");
  const yLog = geometry.yLog ?? isLogAxis(axisOptions, "y");
  const mappedXMin = scaleAxisValue(ranges.xMin, xLog);
  const mappedXMax = scaleAxisValue(ranges.xMax, xLog);
  const mappedYMin = scaleAxisValue(ranges.yMin, yLog);
  const mappedYMax = scaleAxisValue(ranges.yMax, yLog);
  const xSpan = mappedXMax - mappedXMin || 1;
  const ySpan = mappedYMax - mappedYMin || 1;

  return {
    origin,
    width,
    height,
    xLog,
    yLog,
    mapPoint(point = {}) {
      return {
        x: origin.x + ((scaleAxisValue(point.x, xLog) - mappedXMin) / xSpan) * width,
        y: origin.y + ((scaleAxisValue(point.y, yLog) - mappedYMin) / ySpan) * height
      };
    }
  };
}

export function transformDataToCanvas(point, transform) {
  return transform.mapPoint(point);
}
