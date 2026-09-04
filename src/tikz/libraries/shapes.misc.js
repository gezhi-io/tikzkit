const CHAMFER_EPSILON = 1e-9;
const CHAMFER_ALL = Object.freeze({
  northEast: true,
  northWest: true,
  southEast: true,
  southWest: true
});

export function chamferedRectangleLayoutSize(contentWidth, contentHeight, options = {}) {
  let halfContentWidth = Math.max(0, Number(contentWidth) || 0) / 2;
  let halfContentHeight = Math.max(0, Number(contentHeight) || 0) / 2;
  const angle = clamp(Number(options.angle) || 45, 1, 89);
  const angleRadians = angle * Math.PI / 180;
  const tangent = Math.max(CHAMFER_EPSILON, Math.tan(angleRadians));
  const cotangent = 1 / tangent;

  let xsep = Math.max(0, Number(options.xsep) || 0);
  let yCut = cotangent * xsep;
  if (yCut > halfContentHeight) {
    yCut = halfContentHeight;
    xsep = tangent * yCut;
  }

  let ysep = Math.max(0, Number(options.ysep) || 0);
  let xCut = tangent * ysep;
  if (xCut > halfContentWidth) {
    xCut = halfContentWidth;
    ysep = cotangent * xCut;
  }

  const minimumSize = Math.max(0, Number(options.minimumSize) || 0);
  const minimumWidth = Math.max(minimumSize, Number(options.minimumWidth) || 0);
  const minimumHeight = Math.max(minimumSize, Number(options.minimumHeight) || 0);
  if (halfContentWidth + xsep < minimumWidth / 2) {
    halfContentWidth = minimumWidth / 2 - xsep;
  }
  if (halfContentHeight + ysep < minimumHeight / 2) {
    halfContentHeight = minimumHeight / 2 - ysep;
  }

  return {
    width: (halfContentWidth + xsep) * 2,
    height: (halfContentHeight + ysep) * 2,
    chamferedRectangleHalfContentWidth: halfContentWidth,
    chamferedRectangleHalfContentHeight: halfContentHeight,
    chamferedRectangleXSep: xsep,
    chamferedRectangleYSep: ysep,
    chamferedRectangleXCut: xCut,
    chamferedRectangleYCut: yCut,
    chamferedRectangleAngle: angle,
    chamferedRectangleCorners: chamferedRectangleCornerNames(options.corners)
  };
}

export function chamferedRectangleGeometry(size = {}, data = {}) {
  const angle = clamp(Number(data.chamferedRectangleAngle) || 45, 1, 89);
  const xsep = finiteNonnegative(data.chamferedRectangleXSep, 0);
  const ysep = finiteNonnegative(data.chamferedRectangleYSep, 0);
  const halfContentWidth = finiteNonnegative(
    data.chamferedRectangleHalfContentWidth,
    Math.max(0, (Number(size.width) || 0) / 2 - xsep)
  );
  const halfContentHeight = finiteNonnegative(
    data.chamferedRectangleHalfContentHeight,
    Math.max(0, (Number(size.height) || 0) / 2 - ysep)
  );
  const tangent = Math.max(CHAMFER_EPSILON, Math.tan(angle * Math.PI / 180));
  const xCut = finiteNonnegative(
    data.chamferedRectangleXCut,
    Math.min(halfContentWidth, tangent * ysep)
  );
  const yCut = finiteNonnegative(
    data.chamferedRectangleYCut,
    Math.min(halfContentHeight, xsep / tangent)
  );
  const outerXSep = finiteNonnegative(data.chamferedRectangleOuterXSep, 0);
  const outerYSep = finiteNonnegative(data.chamferedRectangleOuterYSep, 0);
  const corners = chamferedRectangleCorners(data.chamferedRectangleCorners);
  const visible = chamferedRectanglePoints({
    halfContentWidth,
    halfContentHeight,
    xsep,
    ysep,
    xCut,
    yCut,
    corners
  });

  const beforeNorthEast = offsetVertex(
    reflectX(visible.beforeNorthEast),
    visible.beforeNorthEast,
    visible.afterNorthEast,
    outerXSep
  );
  const afterNorthEast = offsetVertex(
    visible.beforeNorthEast,
    visible.afterNorthEast,
    reflectY(visible.afterNorthEast),
    outerYSep
  );
  const beforeSouthWest = reflectBoth(beforeNorthEast);
  const afterSouthWest = reflectBoth(afterNorthEast);
  const beforeNorthWest = reflectY(afterNorthEast);
  const afterNorthWest = reflectY(beforeNorthEast);
  const beforeSouthEast = reflectX(afterNorthEast);
  const afterSouthEast = reflectX(beforeNorthEast);

  const northEast = corners.northEast
    ? midpoint(beforeNorthEast, afterNorthEast)
    : { x: halfContentWidth + xsep + outerXSep, y: halfContentHeight + ysep + outerYSep };
  const northWest = corners.northWest
    ? midpoint(beforeNorthWest, afterNorthWest)
    : { x: -halfContentWidth - xsep - outerXSep, y: halfContentHeight + ysep + outerYSep };
  const southWest = corners.southWest
    ? midpoint(beforeSouthWest, afterSouthWest)
    : { x: -halfContentWidth - xsep - outerXSep, y: -halfContentHeight - ysep - outerYSep };
  const southEast = corners.southEast
    ? midpoint(beforeSouthEast, afterSouthEast)
    : { x: halfContentWidth + xsep + outerXSep, y: -halfContentHeight - ysep - outerYSep };

  const anchors = {
    center: { x: 0, y: 0 },
    base: { x: 0, y: Number(data.chamferedRectangleBaseOffset) || 0 },
    mid: { x: 0, y: Number(data.chamferedRectangleMidOffset) || 0 },
    east: { x: beforeNorthEast.x, y: 0 },
    west: { x: -beforeNorthEast.x, y: 0 },
    north: { x: 0, y: afterNorthEast.y },
    south: { x: 0, y: -afterNorthEast.y },
    "before north east": beforeNorthEast,
    "north east": northEast,
    "after north east": afterNorthEast,
    "before north west": beforeNorthWest,
    "north west": northWest,
    "after north west": afterNorthWest,
    "before south west": beforeSouthWest,
    "south west": southWest,
    "after south west": afterSouthWest,
    "before south east": beforeSouthEast,
    "south east": southEast,
    "after south east": afterSouthEast
  };
  const boundaryPoints = [
    anchors.east,
    beforeNorthEast,
    northEast,
    afterNorthEast,
    anchors.north,
    beforeNorthWest,
    northWest,
    afterNorthWest,
    anchors.west,
    beforeSouthWest,
    southWest,
    afterSouthWest,
    anchors.south,
    beforeSouthEast,
    southEast,
    afterSouthEast
  ];
  const geometry = {
    outlineCommands: polygonCommands(visible.points),
    visibleBoundaryPoints: visible.points,
    boundaryPoints,
    anchors,
    visibleAnchors: visible.anchors,
    corners,
    angle,
    halfContentWidth,
    halfContentHeight,
    xsep,
    ysep,
    xCut,
    yCut,
    outerXSep,
    outerYSep,
    bounds: pointBounds(visible.points),
    anchorBounds: pointBounds(boundaryPoints)
  };
  anchors["base east"] = chamferedRectangleBorderPointFrom(geometry, anchors.base, { x: 1, y: 0 });
  anchors["base west"] = chamferedRectangleBorderPointFrom(geometry, anchors.base, { x: -1, y: 0 });
  anchors["mid east"] = chamferedRectangleBorderPointFrom(geometry, anchors.mid, { x: 1, y: 0 });
  anchors["mid west"] = chamferedRectangleBorderPointFrom(geometry, anchors.mid, { x: -1, y: 0 });
  return geometry;
}

export function chamferedRectangleBorderPoint(geometry = {}, toward = {}, padding = 0) {
  return chamferedRectangleBorderPointFrom(geometry, { x: 0, y: 0 }, toward, padding);
}

export function chamferedRectangleBorderPointFrom(geometry = {}, reference = {}, toward = {}, padding = 0) {
  const dx = Number(toward.x) || 0;
  const dy = Number(toward.y) || 0;
  const distance = Math.hypot(dx, dy);
  if (distance < CHAMFER_EPSILON) return { x: Number(reference.x) || 0, y: Number(reference.y) || 0 };
  const points = Array.isArray(geometry.boundaryPoints) ? geometry.boundaryPoints : [];
  const candidates = [];
  for (let index = 0; index < points.length; index += 1) {
    const first = points[index];
    const second = points[(index + 1) % points.length];
    const hit = raySegmentIntersection(reference, { x: dx, y: dy }, first, second);
    if (hit && hit.t >= -CHAMFER_EPSILON) candidates.push(hit);
  }
  candidates.sort((left, right) => left.t - right.t);
  const hit = candidates[0];
  const extension = Math.max(0, Number(padding) || 0);
  const point = hit || { x: Number(reference.x) || 0, y: Number(reference.y) || 0 };
  return {
    x: point.x + dx / distance * extension,
    y: point.y + dy / distance * extension
  };
}

function chamferedRectanglePoints({
  halfContentWidth: xa,
  halfContentHeight: ya,
  xsep: xb,
  ysep: yb,
  xCut: xc,
  yCut: yc,
  corners
}) {
  const beforeNorthEast = { x: xa + xb, y: ya - yc };
  const northEast = corners.northEast ? { x: xa, y: ya } : { x: xa + xb, y: ya + yb };
  const afterNorthEast = { x: xa - xc, y: ya + yb };
  const beforeNorthWest = reflectY(afterNorthEast);
  const northWest = corners.northWest ? { x: -xa, y: ya } : { x: -xa - xb, y: ya + yb };
  const afterNorthWest = reflectY(beforeNorthEast);
  const beforeSouthWest = reflectBoth(beforeNorthEast);
  const southWest = corners.southWest ? { x: -xa, y: -ya } : { x: -xa - xb, y: -ya - yb };
  const afterSouthWest = reflectBoth(afterNorthEast);
  const beforeSouthEast = reflectX(afterNorthEast);
  const southEast = corners.southEast ? { x: xa, y: -ya } : { x: xa + xb, y: -ya - yb };
  const afterSouthEast = reflectX(beforeNorthEast);
  const anchors = {
    "before north east": beforeNorthEast,
    "north east": northEast,
    "after north east": afterNorthEast,
    "before north west": beforeNorthWest,
    "north west": northWest,
    "after north west": afterNorthWest,
    "before south west": beforeSouthWest,
    "south west": southWest,
    "after south west": afterSouthWest,
    "before south east": beforeSouthEast,
    "south east": southEast,
    "after south east": afterSouthEast
  };
  return {
    beforeNorthEast,
    afterNorthEast,
    points: Object.values(anchors),
    anchors
  };
}

function chamferedRectangleCornerNames(value) {
  const corners = chamferedRectangleCorners(value);
  return Object.entries(corners)
    .filter(([, enabled]) => enabled)
    .map(([name]) => ({
      northEast: "north east",
      northWest: "north west",
      southEast: "south east",
      southWest: "south west"
    })[name]);
}

function chamferedRectangleCorners(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      northEast: Boolean(value.northEast),
      northWest: Boolean(value.northWest),
      southEast: Boolean(value.southEast),
      southWest: Boolean(value.southWest)
    };
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { northEast: false, northWest: false, southEast: false, southWest: false };
    }
    return chamferedRectangleCorners(value.join(","));
  }
  if (value === undefined || value === null || value === true || String(value).trim() === "") {
    return { ...CHAMFER_ALL };
  }
  const list = String(value).trim().replace(/^\{([\s\S]*)\}$/, "$1").split(",");
  const normalized = list.map((part) => String(part).trim().toLowerCase().replace(/[-_]+/g, " "));
  if (normalized.includes("chamfer all")) return { ...CHAMFER_ALL };
  if (normalized.includes("chamfer none")) {
    return { northEast: false, northWest: false, southEast: false, southWest: false };
  }
  return {
    northEast: normalized.some((name) => ["north east", "northeast", "ne", "top left"].includes(name)),
    northWest: normalized.some((name) => ["north west", "northwest", "nw", "top right"].includes(name)),
    southEast: normalized.some((name) => ["south east", "southeast", "se", "bottom right"].includes(name)),
    southWest: normalized.some((name) => ["south west", "southwest", "sw", "bottom left"].includes(name))
  };
}

function offsetVertex(previous, point, next, amount) {
  if (!(amount > CHAMFER_EPSILON)) return { ...point };
  const before = offsetLine(previous, point, amount);
  const after = offsetLine(point, next, amount);
  const hit = lineIntersection(before.first, before.second, after.first, after.second);
  if (hit) return hit;
  return {
    x: point.x + (before.normal.x + after.normal.x) * amount,
    y: point.y + (before.normal.y + after.normal.y) * amount
  };
}

function offsetLine(first, second, amount) {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const length = Math.max(CHAMFER_EPSILON, Math.hypot(dx, dy));
  const normal = { x: dy / length, y: -dx / length };
  return {
    first: { x: first.x + normal.x * amount, y: first.y + normal.y * amount },
    second: { x: second.x + normal.x * amount, y: second.y + normal.y * amount },
    normal
  };
}

function lineIntersection(firstA, secondA, firstB, secondB) {
  const adx = secondA.x - firstA.x;
  const ady = secondA.y - firstA.y;
  const bdx = secondB.x - firstB.x;
  const bdy = secondB.y - firstB.y;
  const denominator = cross(adx, ady, bdx, bdy);
  if (Math.abs(denominator) < CHAMFER_EPSILON) return null;
  const rx = firstB.x - firstA.x;
  const ry = firstB.y - firstA.y;
  const t = cross(rx, ry, bdx, bdy) / denominator;
  return { x: firstA.x + adx * t, y: firstA.y + ady * t };
}

function raySegmentIntersection(reference, direction, first, second) {
  const sx = second.x - first.x;
  const sy = second.y - first.y;
  const denominator = cross(direction.x, direction.y, sx, sy);
  if (Math.abs(denominator) < CHAMFER_EPSILON) return null;
  const rx = first.x - reference.x;
  const ry = first.y - reference.y;
  const t = cross(rx, ry, sx, sy) / denominator;
  const u = cross(rx, ry, direction.x, direction.y) / denominator;
  if (t < -CHAMFER_EPSILON || u < -CHAMFER_EPSILON || u > 1 + CHAMFER_EPSILON) return null;
  return { t, x: reference.x + direction.x * t, y: reference.y + direction.y * t };
}

function polygonCommands(points) {
  if (!points.length) return [];
  return [
    { type: "moveTo", ...points[0] },
    ...points.slice(1).map((point) => ({ type: "lineTo", ...point })),
    { type: "closePath" }
  ];
}

function pointBounds(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys)
  };
}

function reflectX(point) {
  return { x: point.x, y: -point.y };
}

function reflectY(point) {
  return { x: -point.x, y: point.y };
}

function reflectBoth(point) {
  return { x: -point.x, y: -point.y };
}

function midpoint(first, second) {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function cross(ax, ay, bx, by) {
  return ax * by - ay * bx;
}

function finiteNonnegative(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export const tikzLibrary = {
  "name": "shapes.misc",
  "status": "partial",
  "implementedBy": "src/tikz/libraries/shapes.misc.js:chamferedRectangleLayoutSize/chamferedRectangleGeometry/chamferedRectangleBorderPoint + src/engine/evaluate.js:nodeShape/estimateNodeSize/customNodeLocalAnchor/nodeBorderPoint + src/renderers/svg/nodeShapes.js:nodeShapeCommands + src/renderers/svg/nodeOverlays.js:renderMiscOutNodeBox + src/renderers/svg/bounds.js",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.misc.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex",
  "localSourceReviewed": true,
  "features": ["rounded rectangle", "chamfered rectangle", "cross out", "strike out"],
  "implements": [
    "rounded rectangle default convex end caps and border clipping",
    "chamfered rectangle angle xsep ysep sep and selective corners",
    "chamfered rectangle named numeric base mid compass anchors outer separation and automatic clipping",
    "rectangle-compatible anchors and foreground paths for cross out and strike out"
  ],
  "notes": "Reviewed locally on 2026-08-07 against pgflibraryshapes.misc.code.tex: the default rounded rectangle has convex 180-degree end caps. TikZKit sizes their content chord and clips straight/curved node edges, including terminal arrow padding, to the matching circular cap rather than the outer rectangular corner; latex-examples-class-tree is the visual driver. PGF inherits rectangle anchors for cross out/strike out; their foreground geometry and bounding-box contribution retain scaled outer separation. Empty cross-out/strike-out nodes now use their configured inner/minimum dimensions rather than a normal text line-height floor, matching the local 4pt inner box plus paint-width outer separation used by the path-replacing manual control-marker example. Reviewed again on 2026-09-04 for the chamfered rectangle declaration at lines 486-1148 and the manual shape section: angle is measured from vertical and clamped to 1..89 degrees; xsep/ysep are independently limited by the content half-height/half-width; minimum dimensions expand the content rectangle after chamfer extents are known. TikZKit now shares the twelve-point paint outline and the separately mitered outer-separation contour across SVG paint, bbox, named/numeric anchors, positioning, rotation, and automatic clipping. Permanent flowchart, mathematics, and physics evidence is recorded in docs/qa/2026-09-04-shapes-misc-chamfered-rectangle.md. Rounded-rectangle concave/straight/custom arc modes, other shapes.misc shapes, and full native text-box metrics remain partial."
};
