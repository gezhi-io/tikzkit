const MISC_SHAPE_EPSILON = 1e-9;

export function roundedRectangleLayoutSize(contentWidth, contentHeight, options = {}) {
  const halfTextWidth = Math.max(0, Number(contentWidth) || 0) / 2;
  const halfTextHeight = Math.max(0, Number(contentHeight) || 0) / 2;
  const innerXSep = Math.max(0, Number(options.innerXSep) || 0);
  const innerYSep = Math.max(0, Number(options.innerYSep) || 0);
  const minimumSize = Math.max(0, Number(options.minimumSize) || 0);
  const minimumWidth = Math.max(minimumSize, Number(options.minimumWidth) || 0);
  const minimumHeight = Math.max(minimumSize, Number(options.minimumHeight) || 0);
  const arcLength = normalizedRoundedRectangleArcLength(options.arcLength);
  const halfArcAngle = arcLength / 2;
  const halfArcRadians = halfArcAngle * Math.PI / 180;
  const westArc = normalizedRoundedRectangleArc(options.westArc);
  const eastArc = normalizedRoundedRectangleArc(options.eastArc);
  const halfHeight = Math.max(halfTextHeight + innerYSep, minimumHeight / 2);
  const radius = halfHeight / Math.max(MISC_SHAPE_EPSILON, Math.sin(halfArcRadians));
  const arcWidth = radius * (1 - Math.cos(halfArcRadians));
  const chordWidth = radius - Math.sqrt(Math.max(0, radius * radius - halfTextHeight * halfTextHeight));

  let naturalWidth = 2 * (halfTextWidth + innerXSep);
  naturalWidth += roundedRectangleSideWidth(westArc, arcWidth, chordWidth);
  naturalWidth += roundedRectangleSideWidth(eastArc, arcWidth, chordWidth);
  let xoffset = naturalWidth < minimumWidth ? (minimumWidth - naturalWidth) / 2 : innerXSep;
  if (radius - chordWidth > halfTextWidth + xoffset) {
    xoffset = radius - chordWidth - halfTextWidth;
  }
  const halfWidth = halfTextWidth + xoffset;
  const minX = roundedRectangleVisibleSideX("west", westArc, halfWidth, arcWidth, chordWidth);
  const maxX = roundedRectangleVisibleSideX("east", eastArc, halfWidth, arcWidth, chordWidth);

  return {
    width: maxX - minX,
    height: halfHeight * 2,
    minX,
    minY: -halfHeight,
    maxX,
    maxY: halfHeight,
    roundedRectangleHalfTextWidth: halfTextWidth,
    roundedRectangleHalfTextHeight: halfTextHeight,
    roundedRectangleHalfWidth: halfWidth,
    roundedRectangleHalfHeight: halfHeight,
    roundedRectangleRadius: radius,
    roundedRectangleArcWidth: arcWidth,
    roundedRectangleChordWidth: chordWidth,
    roundedRectangleArcLength: arcLength,
    roundedRectangleWestArc: westArc,
    roundedRectangleEastArc: eastArc
  };
}

export function roundedRectangleGeometry(size = {}, data = {}) {
  const arcLength = normalizedRoundedRectangleArcLength(data.roundedRectangleArcLength ?? data.arcLength);
  const halfArcAngle = arcLength / 2;
  const halfArcRadians = halfArcAngle * Math.PI / 180;
  const westArc = normalizedRoundedRectangleArc(data.roundedRectangleWestArc ?? data.westArc);
  const eastArc = normalizedRoundedRectangleArc(data.roundedRectangleEastArc ?? data.eastArc);
  const halfHeight = finiteNonnegative(data.roundedRectangleHalfHeight, Math.max(0, Number(size.height) || 0) / 2);
  const radius = finiteNonnegative(
    data.roundedRectangleRadius,
    halfHeight / Math.max(MISC_SHAPE_EPSILON, Math.sin(halfArcRadians))
  );
  const arcWidth = finiteNonnegative(
    data.roundedRectangleArcWidth,
    radius * (1 - Math.cos(halfArcRadians))
  );
  const chordWidth = finiteNonnegative(data.roundedRectangleChordWidth, 0);
  const halfWidth = finiteNonnegative(
    data.roundedRectangleHalfWidth,
    Math.max(0, (Number(size.width) || 0) / 2 - Math.max(arcWidth, chordWidth))
  );
  const outerXSep = finiteNonnegative(data.roundedRectangleOuterXSep, 0);
  const outerYSep = finiteNonnegative(data.roundedRectangleOuterYSep, 0);
  const outlineCommands = roundedRectangleOutlineCommands({
    westArc,
    eastArc,
    halfArcAngle,
    halfWidth,
    halfHeight,
    radius,
    arcWidth,
    chordWidth
  });
  const visibleBoundaryPoints = roundedRectangleVisibleBoundaryPoints({
    westArc,
    eastArc,
    halfArcAngle,
    halfWidth,
    halfHeight,
    radius,
    arcWidth,
    chordWidth
  });
  const anchorGeometry = roundedRectangleAnchorGeometry({
    westArc,
    eastArc,
    halfArcAngle,
    halfWidth,
    halfHeight,
    radius,
    arcWidth,
    chordWidth,
    outerXSep,
    outerYSep
  });
  const anchors = {
    center: { x: 0, y: 0 },
    text: { x: 0, y: 0 },
    base: { x: 0, y: Number(data.roundedRectangleBaseOffset) || 0 },
    mid: { x: 0, y: Number(data.roundedRectangleMidOffset) || 0 },
    ...anchorGeometry.anchors
  };
  anchors["base east"] = { x: anchors.east.x, y: anchors.base.y };
  anchors["base west"] = { x: anchors.west.x, y: anchors.base.y };
  anchors["mid east"] = { x: anchors.east.x, y: anchors.mid.y };
  anchors["mid west"] = { x: anchors.west.x, y: anchors.mid.y };
  const anchorPoints = Object.values(anchors);

  return {
    outlineCommands,
    visibleBoundaryPoints,
    anchors,
    bounds: pointBounds(visibleBoundaryPoints),
    anchorBounds: pointBounds(anchorPoints),
    westArc,
    eastArc,
    arcLength,
    halfArcAngle,
    halfWidth,
    halfHeight,
    radius,
    arcWidth,
    chordWidth,
    outerXSep,
    outerYSep
  };
}

export function roundedRectangleBorderPoint(geometry = {}, toward = {}, padding = 0) {
  const dx = Number(toward.x) || 0;
  const dy = Number(toward.y) || 0;
  if (Math.hypot(dx, dy) < MISC_SHAPE_EPSILON) return { x: 0, y: 0 };
  const outerXSep = finiteNonnegative(geometry.outerXSep, 0) + Math.max(0, Number(padding) || 0);
  const outerYSep = finiteNonnegative(geometry.outerYSep, 0) + Math.max(0, Number(padding) || 0);
  const anchorGeometry = roundedRectangleAnchorGeometry({ ...geometry, outerXSep, outerYSep });
  const anchors = anchorGeometry.anchors;
  const candidates = [];

  addRaySegmentCandidate(candidates, { x: dx, y: dy }, anchors["north west"], anchors["north east"]);
  addRaySegmentCandidate(candidates, { x: dx, y: dy }, anchors["south east"], anchors["south west"]);
  addRoundedRectangleSideCandidate(candidates, "east", geometry.eastArc, geometry, anchorGeometry, { x: dx, y: dy });
  addRoundedRectangleSideCandidate(candidates, "west", geometry.westArc, geometry, anchorGeometry, { x: dx, y: dy });
  candidates.sort((left, right) => left.t - right.t);
  return candidates[0] ? { x: candidates[0].x, y: candidates[0].y } : { x: 0, y: 0 };
}

function roundedRectangleSideWidth(mode, arcWidth, chordWidth) {
  if (mode === "concave") return arcWidth;
  if (mode === "convex") return chordWidth;
  return 0;
}

function roundedRectangleVisibleSideX(side, mode, halfWidth, arcWidth, chordWidth) {
  const sign = side === "east" ? 1 : -1;
  const extension = mode === "concave" ? arcWidth : mode === "convex" ? chordWidth : 0;
  return sign * (halfWidth + extension);
}

function roundedRectangleOutlineCommands(parameters) {
  const {
    westArc,
    eastArc,
    halfArcAngle: a,
    halfWidth: w,
    halfHeight: h,
    radius: r,
    arcWidth: aw,
    chordWidth: cw
  } = parameters;
  const commands = [{ type: "moveTo", x: 0, y: h }];

  if (eastArc === "concave") {
    commands.push({ type: "lineTo", x: w + aw, y: h });
    commands.push(...circleArcCommands(w + r, 0, r, 180 - a, 180 + a));
  } else if (eastArc === "convex") {
    commands.push({ type: "lineTo", x: w + cw - aw, y: h });
    commands.push(...circleArcCommands(w + cw - r, 0, r, a, -a));
  } else {
    commands.push({ type: "lineTo", x: w, y: h });
    commands.push({ type: "lineTo", x: w, y: -h });
  }

  if (westArc === "concave") {
    commands.push({ type: "lineTo", x: -w - aw, y: -h });
    commands.push(...circleArcCommands(-w - r, 0, r, -a, a));
  } else if (westArc === "convex") {
    commands.push({ type: "lineTo", x: -w - cw + aw, y: -h });
    commands.push(...circleArcCommands(-w - cw + r, 0, r, 180 + a, 180 - a));
  } else {
    commands.push({ type: "lineTo", x: -w, y: -h });
    commands.push({ type: "lineTo", x: -w, y: h });
  }
  commands.push({ type: "closePath" });
  return commands.map(roundCommand);
}

function roundedRectangleVisibleBoundaryPoints(parameters) {
  const {
    westArc,
    eastArc,
    halfArcAngle: a,
    halfWidth: w,
    halfHeight: h,
    radius: r,
    arcWidth: aw,
    chordWidth: cw
  } = parameters;
  const points = [{ x: 0, y: h }];
  if (eastArc === "concave") {
    points.push(...sampleCircleArc(w + r, 0, r, 180 - a, 180 + a));
  } else if (eastArc === "convex") {
    points.push(...sampleCircleArc(w + cw - r, 0, r, a, -a));
  } else {
    points.push({ x: w, y: h }, { x: w, y: -h });
  }
  if (westArc === "concave") {
    points.push(...sampleCircleArc(-w - r, 0, r, -a, a));
  } else if (westArc === "convex") {
    points.push(...sampleCircleArc(-w - cw + r, 0, r, 180 + a, 180 - a));
  } else {
    points.push({ x: -w, y: -h }, { x: -w, y: h });
  }
  return points.map(roundPoint);
}

function roundedRectangleAnchorGeometry(parameters) {
  const {
    westArc,
    eastArc,
    halfArcAngle: a,
    halfWidth: w,
    halfHeight: h,
    radius: r,
    arcWidth: aw,
    chordWidth: cw,
    outerXSep,
    outerYSep
  } = parameters;
  const concaveAngle = (90 - a) / 2;
  const convexAngle = (90 + a) / 2;
  const concaveXShift = Math.abs(90 - a) < MISC_SHAPE_EPSILON
    ? 0
    : outerXSep / Math.max(MISC_SHAPE_EPSILON, Math.tan(concaveAngle * Math.PI / 180));
  const convexXShift = Math.abs(90 - a) < MISC_SHAPE_EPSILON
    ? 0
    : outerXSep / Math.max(MISC_SHAPE_EPSILON, Math.tan(convexAngle * Math.PI / 180));
  const sideX = (side, mode) => {
    const sign = side === "east" ? 1 : -1;
    if (mode === "concave") return sign * (w + aw + concaveXShift);
    if (mode === "convex") return sign * (w + cw + outerXSep);
    return sign * (w + outerXSep);
  };
  const cornerX = (side, mode) => {
    const sign = side === "east" ? 1 : -1;
    if (mode === "convex") return sign * (w + cw - aw + convexXShift);
    return sideX(side, mode);
  };
  const westX = sideX("west", westArc);
  const eastX = sideX("east", eastArc);
  const northY = h + outerYSep;
  const southY = -northY;
  return {
    anchors: {
      north: { x: 0, y: northY },
      south: { x: 0, y: southY },
      west: { x: westX, y: 0 },
      east: { x: eastX, y: 0 },
      "north west": { x: cornerX("west", westArc), y: northY },
      "south west": { x: cornerX("west", westArc), y: southY },
      "north east": { x: cornerX("east", eastArc), y: northY },
      "south east": { x: cornerX("east", eastArc), y: southY }
    },
    eastCenterX: w + cw - r,
    westCenterX: -w - cw + r,
    radiusX: r + outerXSep,
    radiusY: r + outerYSep
  };
}

function addRoundedRectangleSideCandidate(candidates, side, mode, geometry, anchorGeometry, direction) {
  const anchors = anchorGeometry.anchors;
  if (mode !== "convex") {
    const north = anchors[`north ${side}`];
    const south = anchors[`south ${side}`];
    addRaySegmentCandidate(candidates, direction, north, south);
    return;
  }
  const centerX = side === "east" ? anchorGeometry.eastCenterX : anchorGeometry.westCenterX;
  const hits = rayEllipseIntersections(direction, centerX, 0, anchorGeometry.radiusX, anchorGeometry.radiusY);
  const halfArcAngle = Number(geometry.halfArcAngle) || 90;
  for (const hit of hits) {
    const normalizedAngle = Math.atan2(hit.y / anchorGeometry.radiusY, (hit.x - centerX) / anchorGeometry.radiusX) * 180 / Math.PI;
    const angle = ((normalizedAngle % 360) + 360) % 360;
    const onArc = side === "east"
      ? angle <= halfArcAngle + 1e-6 || angle >= 360 - halfArcAngle - 1e-6
      : Math.abs(angle - 180) <= halfArcAngle + 1e-6;
    if (onArc) candidates.push(hit);
  }
}

function addRaySegmentCandidate(candidates, direction, first, second) {
  const hit = raySegmentIntersection({ x: 0, y: 0 }, direction, first, second);
  if (hit && hit.t >= -MISC_SHAPE_EPSILON) candidates.push(hit);
}

function rayEllipseIntersections(direction, cx, cy, radiusX, radiusY) {
  if (!(radiusX > MISC_SHAPE_EPSILON) || !(radiusY > MISC_SHAPE_EPSILON)) return [];
  const dx = Number(direction.x) || 0;
  const dy = Number(direction.y) || 0;
  const a = dx * dx / (radiusX * radiusX) + dy * dy / (radiusY * radiusY);
  const b = -2 * (dx * cx / (radiusX * radiusX) + dy * cy / (radiusY * radiusY));
  const c = cx * cx / (radiusX * radiusX) + cy * cy / (radiusY * radiusY) - 1;
  const discriminant = b * b - 4 * a * c;
  if (!(a > MISC_SHAPE_EPSILON) || discriminant < -MISC_SHAPE_EPSILON) return [];
  const root = Math.sqrt(Math.max(0, discriminant));
  return [(-b - root) / (2 * a), (-b + root) / (2 * a)]
    .filter((value) => value >= -MISC_SHAPE_EPSILON)
    .sort((left, right) => left - right)
    .filter((value, index, values) => index === 0 || Math.abs(value - values[index - 1]) > MISC_SHAPE_EPSILON)
    .map((t) => ({ t, x: dx * t, y: dy * t }));
}

function circleArcCommands(cx, cy, radius, startDegrees, endDegrees) {
  const commands = [];
  const delta = endDegrees - startDegrees;
  const count = Math.max(1, Math.ceil(Math.abs(delta) / 90));
  for (let index = 0; index < count; index += 1) {
    const first = startDegrees + delta * index / count;
    const second = startDegrees + delta * (index + 1) / count;
    const a0 = first * Math.PI / 180;
    const a1 = second * Math.PI / 180;
    const tangent = 4 / 3 * Math.tan((a1 - a0) / 4);
    commands.push({
      type: "curveTo",
      x1: cx + radius * (Math.cos(a0) - tangent * Math.sin(a0)),
      y1: cy + radius * (Math.sin(a0) + tangent * Math.cos(a0)),
      x2: cx + radius * (Math.cos(a1) + tangent * Math.sin(a1)),
      y2: cy + radius * (Math.sin(a1) - tangent * Math.cos(a1)),
      x: cx + radius * Math.cos(a1),
      y: cy + radius * Math.sin(a1)
    });
  }
  return commands;
}

function sampleCircleArc(cx, cy, radius, startDegrees, endDegrees) {
  const count = Math.max(8, Math.ceil(Math.abs(endDegrees - startDegrees) / 5));
  return Array.from({ length: count + 1 }, (_, index) => {
    const angle = (startDegrees + (endDegrees - startDegrees) * index / count) * Math.PI / 180;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });
}

function normalizedRoundedRectangleArc(value) {
  const mode = String(value ?? "convex").trim().toLowerCase();
  return mode === "convex" || mode === "concave" ? mode : "none";
}

function normalizedRoundedRectangleArcLength(value) {
  const number = Number(value);
  return Math.max(0.01, Math.min(359.98, Number.isFinite(number) ? number : 180));
}

function round(value) {
  return Number(Number(value).toFixed(9));
}

function roundPoint(point) {
  return { x: round(point.x), y: round(point.y) };
}

function roundCommand(command) {
  const result = { type: command.type };
  for (const key of ["x", "y", "x1", "y1", "x2", "y2"]) {
    if (Number.isFinite(Number(command[key]))) result[key] = round(command[key]);
  }
  return result;
}

const CHAMFER_EPSILON = MISC_SHAPE_EPSILON;
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
  "implementedBy": "src/tikz/libraries/shapes.misc.js:roundedRectangleLayoutSize/roundedRectangleGeometry/roundedRectangleBorderPoint/chamferedRectangleLayoutSize/chamferedRectangleGeometry/chamferedRectangleBorderPoint + src/engine/evaluate.js:nodeShape/estimateNodeSize/customNodeLocalAnchor/nodeBorderPoint + src/renderers/svg/nodeShapes.js:nodeShapeCommands + src/renderers/svg/nodeOverlays.js:renderMiscOutNodeBox + src/renderers/svg/bounds.js",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.misc.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex",
  "localSourceReviewed": true,
  "features": ["rounded rectangle", "chamfered rectangle", "cross out", "strike out"],
  "implements": [
    "rounded rectangle convex concave and straight end caps with custom arc length and left right aliases",
    "rounded rectangle source-derived sizing named numeric base mid compass anchors outer separation rotation bbox and automatic clipping",
    "chamfered rectangle angle xsep ysep sep and selective corners",
    "chamfered rectangle named numeric base mid compass anchors outer separation and automatic clipping",
    "rectangle-compatible anchors and foreground paths for cross out and strike out"
  ],
  "notes": "Reviewed locally on 2026-08-07 against pgflibraryshapes.misc.code.tex: the default rounded rectangle has convex 180-degree end caps. TikZKit sizes their content chord and clips straight/curved node edges, including terminal arrow padding, to the matching circular cap rather than the outer rectangular corner; latex-examples-class-tree is the visual driver. PGF inherits rectangle anchors for cross out/strike out; their foreground geometry and bounding-box contribution retain scaled outer separation. Empty cross-out/strike-out nodes now use their configured inner/minimum dimensions rather than a normal text line-height floor, matching the local 4pt inner box plus paint-width outer separation used by the path-replacing manual control-marker example. Reviewed again on 2026-09-04 for the chamfered rectangle declaration at lines 486-1148 and the manual shape section: angle is measured from vertical and clamped to 1..89 degrees; xsep/ysep are independently limited by the content half-height/half-width; minimum dimensions expand the content rectangle after chamfer extents are known. TikZKit now shares the twelve-point paint outline and the separately mitered outer-separation contour across SVG paint, bbox, named/numeric anchors, positioning, rotation, and automatic clipping. Permanent flowchart, mathematics, and physics evidence is recorded in docs/qa/2026-09-04-shapes-misc-chamfered-rectangle.md. Reviewed again on 2026-09-04 for the rounded rectangle declaration at lines 74-475 and the manual section at lines 2140-2225. The implementation now follows PGF's half-arc, cosecant radius, arc-width, content-chord, minimum-width, and convex-overlap formulas; supports convex, concave, and none on either side plus left/right aliases; and shares the resulting paint path and outer-separation anchor contour across rendering, bbox, positioning, rotation, named/numeric anchors, and automatic clipping. Permanent three-way evidence is recorded in docs/qa/2026-09-04-shapes-misc-rounded-rectangle-arcs.md. Other shapes.misc declarations and exact native text-box metrics remain partial."
};
