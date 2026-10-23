import { formatAxisNumber } from "./format.js";

// pgfplots.code.tex: clippath@prepare@for@axistype projects the final axis
// limits, after enlargement. geometry.origin/width/height can describe the
// unexpanded middle-axis transform allocation, not the final paint viewport.
export function axisClipRectangle(geometry = {}) {
  const limits = geometry.lineRanges || geometry.transformRanges;
  let from = geometry.origin;
  let to = { x: Number(from?.x) + Number(geometry.width), y: Number(from?.y) + Number(geometry.height) };
  if (!geometry.is3d && limits && geometry.mapPoint) {
    from = geometry.mapPoint({ x: limits.xMin, y: limits.yMin });
    to = geometry.mapPoint({ x: limits.xMax, y: limits.yMax });
  }
  if (![from?.x, from?.y, to.x, to.y].every(Number.isFinite)) return null;
  // Reversed axes swap the projected corners, but SVG rectangles need ordered bounds.
  return { minX: Math.min(from.x, to.x), minY: Math.min(from.y, to.y),
    maxX: Math.max(from.x, to.x), maxY: Math.max(from.y, to.y) };
}

export function axisViewportClipOption(axisOptions = {}, ranges = {}, geometry = {}) {
  if (axisOptions.clip === false || /^(false|0|off|no)$/i.test(String(axisOptions.clip))) return "";
  if (geometry.is3d) {
    const hull = projectedAxisBoxHull(ranges, geometry);
    if (hull.length < 3) return "";
    return `tikzkit clip polygon={${hull.map(point =>
      `${formatAxisNumber(point.x)},${formatAxisNumber(point.y)}`).join(";")}}`;
  }
  const rect = axisClipRectangle(geometry);
  if (!rect) return "";
  return `tikzkit clip rect={${[rect.minX, rect.minY, rect.maxX, rect.maxY].map(formatAxisNumber).join(",")}}`;
}

// PGF clips 3D drawings to the convex hull of the projected axis box, not to
// data-space segments. This also clips arrow outlines that cross the frame.
function projectedAxisBoxHull(ranges = {}, geometry = {}) {
  if (typeof geometry.mapPoint3d !== "function") return [];
  const boxRanges = geometry.transformRanges || ranges;
  const xValues = [Number(boxRanges.xMin), Number(boxRanges.xMax)];
  const yValues = [Number(boxRanges.yMin), Number(boxRanges.yMax)];
  const zValues = [Number(boxRanges.zMin), Number(boxRanges.zMax)];
  if (![...xValues, ...yValues, ...zValues].every(Number.isFinite)) return [];
  const points = [];
  for (const x of xValues) {
    for (const y of yValues) {
      for (const z of zValues) {
        const point = geometry.mapPoint3d({ x, y, z });
        if (Number.isFinite(point?.x) && Number.isFinite(point?.y)) points.push(point);
      }
    }
  }
  return convexHull(points);
}

function convexHull(points = []) {
  const unique = new Map();
  for (const point of points) {
    const x = Number(point.x);
    const y = Number(point.y);
    const key = `${Math.round(x * 1e9)}:${Math.round(y * 1e9)}`;
    unique.set(key, { x, y });
  }
  const sorted = [...unique.values()].sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length <= 2) return sorted;
  const cross = (origin, a, b) =>
    (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= 1e-12) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index];
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= 1e-12) upper.pop();
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
