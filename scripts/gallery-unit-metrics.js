import { TIKZ_UNIT, lineWidthFromPt } from "../src/tikz-metrics.js";

export const JS_STANDARD_PX_PER_TIKZ_UNIT = TIKZ_UNIT;
export const NATIVE_RASTER_DPI = 144;
export const NATIVE_RASTER_PX_PER_TIKZ_UNIT = NATIVE_RASTER_DPI / 2.54;

const EPSILON = 1e-6;
const DEBUG_GRID_LINE_WIDTH = lineWidthFromPt(0.18);
const DEBUG_GRID_DASH = [lineWidthFromPt(1), lineWidthFromPt(1.2)];

export function measureIrGridUnits(ir) {
  const gridLines = comparisonGridLines(ir);
  const vertical = [];
  const horizontal = [];

  for (const item of gridLines) {
    const orientation = straightLineOrientation(item);
    if (!orientation) continue;
    if (orientation.axis === "x") vertical.push(orientation.value);
    if (orientation.axis === "y") horizontal.push(orientation.value);
  }

  const xTikzUnits = medianGap(vertical);
  const yTikzUnits = medianGap(horizontal);
  return {
    step: "1cm",
    jsStandardPxPerTikzUnit: JS_STANDARD_PX_PER_TIKZ_UNIT,
    nativeRasterDpi: NATIVE_RASTER_DPI,
    nativeRasterPxPerTikzUnit: NATIVE_RASTER_PX_PER_TIKZ_UNIT,
    xTikzUnits,
    yTikzUnits,
    jsSvgPxPerXUnit: Number.isFinite(xTikzUnits) ? roundMetric(xTikzUnits * JS_STANDARD_PX_PER_TIKZ_UNIT) : null,
    jsSvgPxPerYUnit: Number.isFinite(yTikzUnits) ? roundMetric(yTikzUnits * JS_STANDARD_PX_PER_TIKZ_UNIT) : null,
    gridLineCount: gridLines.length
  };
}

function comparisonGridLines(ir) {
  const gridLines = (ir?.items || []).filter((item) => item?.type === "path" && item.subtype === "grid-line");
  const styled = gridLines.filter(isComparisonGridLine);
  return styled.length ? styled : gridLines;
}

function isComparisonGridLine(item) {
  const style = item.style || {};
  const dashArray = style.dashArray || [];
  return (
    nearlyEqual(style.lineWidth, DEBUG_GRID_LINE_WIDTH, 1e-4) &&
    dashArray.length === 2 &&
    nearlyEqual(dashArray[0], DEBUG_GRID_DASH[0], 1e-4) &&
    nearlyEqual(dashArray[1], DEBUG_GRID_DASH[1], 1e-4)
  );
}

function straightLineOrientation(item) {
  const commands = item.commands || [];
  const first = commands[0];
  const last = commands.at(-1);
  if (!first || !last) return null;
  if (nearlyEqual(first.x, last.x) && Math.abs(first.y - last.y) > EPSILON) {
    return { axis: "x", value: roundMetric(first.x) };
  }
  if (nearlyEqual(first.y, last.y) && Math.abs(first.x - last.x) > EPSILON) {
    return { axis: "y", value: roundMetric(first.y) };
  }
  return null;
}

function medianGap(values) {
  const unique = [...new Set(values.map(roundMetric))].sort((a, b) => a - b);
  const gaps = [];
  for (let index = 1; index < unique.length; index += 1) {
    const gap = roundMetric(unique[index] - unique[index - 1]);
    if (gap > EPSILON) gaps.push(gap);
  }
  if (gaps.length === 0) return null;
  gaps.sort((a, b) => a - b);
  const middle = Math.floor(gaps.length / 2);
  if (gaps.length % 2 === 1) return gaps[middle];
  return roundMetric((gaps[middle - 1] + gaps[middle]) / 2);
}

function nearlyEqual(a, b, tolerance = EPSILON) {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
}

function roundMetric(value) {
  return Number.isFinite(value) ? Number(value.toFixed(6)) : null;
}
