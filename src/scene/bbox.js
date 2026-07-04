export function emptyBoundingBox() {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

export function includePoint(bounds, point) {
  bounds.minX = Math.min(bounds.minX, point.x);
  bounds.minY = Math.min(bounds.minY, point.y);
  bounds.maxX = Math.max(bounds.maxX, point.x);
  bounds.maxY = Math.max(bounds.maxY, point.y);
  return bounds;
}

export function finalizeBoundingBox(bounds, fallback = null) {
  return Number.isFinite(bounds.minX) ? bounds : fallback;
}
