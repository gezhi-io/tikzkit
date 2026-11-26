// PGF walks a rectangle from its authored first corner. Unsorted intersection
// ties on a straight boundary can make the traversal observable in the fill.
export function fillBetweenRectangleBox(first, second) {
  if (![first?.x, first?.y, second?.x, second?.y].every(Number.isFinite)) return null;
  return {
    minX: Math.min(first.x, second.x), maxX: Math.max(first.x, second.x),
    minY: Math.min(first.y, second.y), maxY: Math.max(first.y, second.y),
    ...(first.x > second.x && { flipX: true }), ...(first.y > second.y && { flipY: true })
  };
}
