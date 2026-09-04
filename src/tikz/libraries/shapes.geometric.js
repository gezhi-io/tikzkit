const TRAPEZIUM_EPSILON = 1e-9;
const CYLINDER_EPSILON = 1e-9;
const SEMICIRCLE_EPSILON = 1e-9;
const STAR_DEFAULT_POINT_RATIO = 1.5;
const STAR_DEFAULT_POINT_HEIGHT = 0.5;
const CYLINDER_DEFAULT_ASPECT = 1;

export function semicircleLayoutSize(contentWidth, contentHeight, options = {}) {
  const usesIncircle = options.shapeBorderUsesIncircle === true;
  const rotate = semicircleRotation(options.shapeBorderRotate, usesIncircle);
  const swapsAxes = !usesIncircle && (rotate === 90 || rotate === 270);
  const halfWidth = Math.max(0, Number(swapsAxes ? contentHeight : contentWidth) || 0) / 2;
  const halfHeight = Math.max(0, Number(swapsAxes ? contentWidth : contentHeight) || 0) / 2;
  const incircleHalfHeight = Math.SQRT2 * Math.max(halfWidth, halfHeight);
  const localHalfHeight = usesIncircle ? incircleHalfHeight : halfHeight;
  const defaultRadius = usesIncircle
    ? 2 * incircleHalfHeight
    : Math.hypot(halfWidth, 2 * halfHeight);
  const minimumWidth = Math.max(0, Number(options.minimumWidth) || 0, Number(options.minimumSize) || 0);
  const minimumHeight = Math.max(0, Number(options.minimumHeight) || 0, Number(options.minimumSize) || 0);
  const radius = Math.max(SEMICIRCLE_EPSILON, defaultRadius, minimumWidth / 2, minimumHeight);
  const centerOffset = -localHalfHeight - 0.4 * (radius - defaultRadius);
  const center = rotatePoint({ x: 0, y: centerOffset }, rotate);
  const visibleBoundaryPoints = semicircleBoundaryPoints(radius, centerOffset, rotate, 0);
  const bounds = pointBounds(visibleBoundaryPoints);

  return {
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    minX: bounds.minX,
    minY: bounds.minY,
    maxX: bounds.maxX,
    maxY: bounds.maxY,
    semicircleRadius: radius,
    semicircleDefaultRadius: defaultRadius,
    semicircleCenterOffset: centerOffset,
    semicircleCenterX: center.x,
    semicircleCenterY: center.y,
    semicircleShapeBorderRotate: rotate,
    semicircleShapeBorderUsesIncircle: usesIncircle
  };
}

export function semicircleGeometry(size = {}, data = {}) {
  const usesIncircle = data.semicircleShapeBorderUsesIncircle === true || data.shapeBorderUsesIncircle === true;
  const rotate = semicircleRotation(
    data.semicircleShapeBorderRotate ?? data.shapeBorderRotate,
    usesIncircle
  );
  const swapsAxes = !usesIncircle && (rotate === 90 || rotate === 270);
  const inferredRadius = Math.max(
    SEMICIRCLE_EPSILON,
    Math.abs(Number(swapsAxes ? size.height : size.width) || 0) / 2
  );
  const radius = finitePositive(data.semicircleRadius, inferredRadius);
  const defaultRadius = finitePositive(data.semicircleDefaultRadius, radius);
  const centerOffset = Number.isFinite(Number(data.semicircleCenterOffset))
    ? Number(data.semicircleCenterOffset)
    : -radius / 2 - 0.4 * (radius - defaultRadius);
  const outerSep = Math.max(0, Number(data.semicircleOuterSep) || 0);
  const anchorRadius = radius + outerSep;
  const center = rotatePoint({ x: 0, y: centerOffset }, rotate);
  const visibleBoundaryPoints = semicircleBoundaryPoints(radius, centerOffset, rotate, 0);
  const boundaryPoints = semicircleBoundaryPoints(anchorRadius, centerOffset, rotate, outerSep);
  const outlineCommands = rotateCommands([
    { type: "moveTo", x: radius, y: centerOffset },
    ...ellipseArcCommands(0, centerOffset, radius, radius, 0, 180),
    { type: "closePath" }
  ], rotate);
  const arcStart = rotatePoint({ x: anchorRadius, y: centerOffset - outerSep }, rotate);
  const arcEnd = rotatePoint({ x: -anchorRadius, y: centerOffset - outerSep }, rotate);
  const borderGeometry = { boundaryPoints };
  const baseOffset = Number(data.semicircleBaseOffset) || 0;
  const midOffset = Number(data.semicircleMidOffset) || 0;
  const anchors = {
    center: { x: 0, y: 0 },
    base: { x: 0, y: baseOffset },
    mid: { x: 0, y: midOffset },
    apex: addPoints(center, rotatePoint({ x: 0, y: anchorRadius }, rotate)),
    "arc start": arcStart,
    "arc end": arcEnd,
    "chord center": {
      x: (arcStart.x + arcEnd.x) / 2,
      y: (arcStart.y + arcEnd.y) / 2
    }
  };
  anchors["base east"] = semicircleBorderPointFrom(borderGeometry, anchors.base, { x: 1, y: 0 });
  anchors["base west"] = semicircleBorderPointFrom(borderGeometry, anchors.base, { x: -1, y: 0 });
  anchors["mid east"] = semicircleBorderPointFrom(borderGeometry, anchors.mid, { x: 1, y: 0 });
  anchors["mid west"] = semicircleBorderPointFrom(borderGeometry, anchors.mid, { x: -1, y: 0 });
  for (const [name, direction] of Object.entries({
    north: { x: 0, y: 1 },
    south: { x: 0, y: -1 },
    east: { x: 1, y: 0 },
    west: { x: -1, y: 0 },
    "north east": { x: 1, y: 1 },
    "north west": { x: -1, y: 1 },
    "south east": { x: 1, y: -1 },
    "south west": { x: -1, y: -1 }
  })) {
    anchors[name] = semicircleBorderPoint(borderGeometry, direction);
  }

  return {
    outlineCommands,
    boundaryPoints,
    visibleBoundaryPoints,
    anchors,
    bounds: pointBounds(visibleBoundaryPoints),
    anchorBounds: pointBounds(boundaryPoints),
    center,
    radius,
    anchorRadius,
    outerSep,
    rotate
  };
}

export function semicircleBorderPoint(geometry = {}, toward = {}, padding = 0) {
  return semicircleBorderPointFrom(geometry, { x: 0, y: 0 }, toward, padding);
}

export function semicircleBorderPointFrom(geometry = {}, reference = {}, toward = {}, padding = 0) {
  const originX = Number(reference.x) || 0;
  const originY = Number(reference.y) || 0;
  const dx = Number(toward.x) || 0;
  const dy = Number(toward.y) || 0;
  const distance = Math.hypot(dx, dy);
  if (distance < SEMICIRCLE_EPSILON) return { x: originX, y: originY };
  let best = null;
  const points = geometry.boundaryPoints || [];
  for (let index = 0; index < points.length; index += 1) {
    const first = {
      x: points[index].x - originX,
      y: points[index].y - originY
    };
    const next = points[(index + 1) % points.length];
    const second = { x: next.x - originX, y: next.y - originY };
    const hit = raySegmentIntersection(dx, dy, first, second);
    if (hit && (!best || hit.t < best.t)) best = hit;
  }
  const base = best
    ? { x: originX + best.x, y: originY + best.y }
    : { x: originX, y: originY };
  const extension = Math.max(0, Number(padding) || 0);
  return {
    x: base.x + (dx / distance) * extension,
    y: base.y + (dy / distance) * extension
  };
}

export function cylinderLayoutSize(contentWidth, contentHeight, options = {}) {
  const rotate = cylinderQuarterRotation(options.shapeBorderRotate);
  const swapsAxes = rotate === 90 || rotate === 270;
  let bodyHalf = Math.max(0, Number(swapsAxes ? contentHeight : contentWidth) || 0) / 2;
  let endRadiusY = Math.max(CYLINDER_EPSILON, Math.max(0, Number(swapsAxes ? contentWidth : contentHeight) || 0) / 2);
  const minimumWidth = Math.max(0, Number(options.minimumWidth) || 0, Number(options.minimumSize) || 0);
  const minimumHeight = Math.max(0, Number(options.minimumHeight) || 0, Number(options.minimumSize) || 0);
  const aspect = cylinderAspect(options.aspect);
  const endRadiusX = aspect * endRadiusY;
  endRadiusY = Math.max(endRadiusY, minimumWidth / 2);
  const innerCrossSep = Math.max(0, Number(swapsAxes ? options.innerXSep : options.innerYSep) || 0);
  const chord = cylinderContentChord(endRadiusX, endRadiusY, innerCrossSep);
  const halfLineWidth = Math.max(0, Number(options.lineWidth) || 0) / 2;
  const naturalHeight = halfLineWidth + 2 * bodyHalf + 3 * endRadiusX - chord;
  if (naturalHeight < minimumHeight) bodyHalf += (minimumHeight - naturalHeight) / 2;
  const localWidth = halfLineWidth + 2 * bodyHalf + 3 * endRadiusX - chord;
  const localHeight = 2 * endRadiusY;
  return {
    width: swapsAxes ? localHeight : localWidth,
    height: swapsAxes ? localWidth : localHeight
  };
}

export function cylinderGeometry(size = {}, data = {}) {
  const rotate = cylinderQuarterRotation(data.cylinderShapeBorderRotate ?? data.shapeBorderRotate);
  const swapsAxes = rotate === 90 || rotate === 270;
  const localWidth = Math.max(CYLINDER_EPSILON, Number(swapsAxes ? size.height : size.width) || 0);
  const localHeight = Math.max(CYLINDER_EPSILON, Number(swapsAxes ? size.width : size.height) || 0);
  const endRadiusY = localHeight / 2;
  const storedEndRadiusX = Number(data.cylinderEndRadiusX);
  const endRadiusX = Number.isFinite(storedEndRadiusX) && storedEndRadiusX > 0
    ? storedEndRadiusX
    : cylinderAspect(data.cylinderAspect) * endRadiusY;
  const innerCrossSep = Math.max(0, Number(swapsAxes ? data.cylinderInnerXSep : data.cylinderInnerYSep) || 0);
  const chord = cylinderContentChord(endRadiusX, endRadiusY, innerCrossSep);
  const halfLineWidth = Math.max(0, Number(data.cylinderLineWidth) || 0) / 2;
  const outerXSep = Math.max(0, Number(data.cylinderOuterXSep) || 0);
  const outerYSep = Math.max(0, Number(data.cylinderOuterYSep) || 0);
  const outerSep = Math.max(outerXSep, outerYSep);
  const anchorRadiusX = endRadiusX + outerSep;
  const anchorRadiusY = endRadiusY + outerSep;
  const bodyHalf = Math.max(0, (localWidth - halfLineWidth - 3 * endRadiusX + chord) / 2);
  const afterBottomX = -bodyHalf + chord;
  const beforeTopX = bodyHalf + endRadiusX + halfLineWidth;

  const outline = [
    { type: "moveTo", x: afterBottomX, y: endRadiusY },
    ...ellipseArcCommands(afterBottomX, 0, endRadiusX, endRadiusY, 90, 270),
    { type: "lineTo", x: beforeTopX, y: -endRadiusY },
    ...ellipseArcCommands(beforeTopX, 0, endRadiusX, endRadiusY, -90, 90),
    { type: "closePath" },
    { type: "moveTo", x: beforeTopX, y: endRadiusY },
    ...ellipseArcCommands(beforeTopX, 0, endRadiusX, endRadiusY, 90, 270)
  ];
  const body = [
    { type: "moveTo", x: afterBottomX, y: endRadiusY },
    ...ellipseArcCommands(afterBottomX, 0, endRadiusX, endRadiusY, 90, 270),
    { type: "lineTo", x: beforeTopX, y: -endRadiusY },
    ...ellipseArcCommands(beforeTopX, 0, endRadiusX, endRadiusY, 270, 450),
    { type: "closePath" }
  ];
  const end = [
    { type: "moveTo", x: beforeTopX, y: endRadiusY },
    ...ellipseArcCommands(beforeTopX, 0, endRadiusX, endRadiusY, 90, -270),
    { type: "closePath" }
  ];
  const visibleBoundary = [
    ...sampleEllipseArc(afterBottomX, 0, endRadiusX, endRadiusY, 90, 270, 24),
    ...sampleEllipseArc(beforeTopX, 0, endRadiusX, endRadiusY, 270, 450, 24)
  ];
  const anchorBoundary = [
    ...sampleEllipseArc(afterBottomX, 0, anchorRadiusX, anchorRadiusY, 90, 270, 24),
    ...sampleEllipseArc(beforeTopX, 0, anchorRadiusX, anchorRadiusY, 270, 450, 24)
  ];
  const transformPoint = (point) => rotatePointQuarter(point, rotate);
  const transformCommand = (command) => rotateCylinderCommand(command, rotate);
  const transformedVisibleBoundary = visibleBoundary.map(transformPoint);
  const transformedAnchorBoundary = anchorBoundary.map(transformPoint);
  const bounds = pointBounds(transformedVisibleBoundary);
  const anchors = Object.fromEntries(Object.entries({
    "shape center": { x: (endRadiusX + halfLineWidth + chord) / 2, y: 0 },
    "before top": { x: beforeTopX, y: endRadiusY + outerYSep },
    top: { x: beforeTopX + anchorRadiusX, y: 0 },
    "after top": { x: beforeTopX, y: -(endRadiusY + outerYSep) },
    "before bottom": { x: afterBottomX, y: -(endRadiusY + outerYSep) },
    bottom: { x: afterBottomX - anchorRadiusX, y: 0 },
    "after bottom": { x: afterBottomX, y: endRadiusY + outerYSep }
  }).map(([name, point]) => [name, transformPoint(point)]));
  const borderGeometry = { boundaryPoints: transformedAnchorBoundary };
  const midOffset = Number(data.cylinderMidOffset) || 0;
  const baseOffset = Number(data.cylinderBaseOffset) || 0;
  anchors["mid east"] = cylinderBorderPointFrom(borderGeometry, { x: 0, y: midOffset }, { x: 1, y: 0 });
  anchors["mid west"] = cylinderBorderPointFrom(borderGeometry, { x: 0, y: midOffset }, { x: -1, y: 0 });
  anchors["base east"] = cylinderBorderPointFrom(borderGeometry, { x: 0, y: baseOffset }, { x: 1, y: 0 });
  anchors["base west"] = cylinderBorderPointFrom(borderGeometry, { x: 0, y: baseOffset }, { x: -1, y: 0 });

  return {
    outlineCommands: outline.map(transformCommand),
    bodyCommands: body.map(transformCommand),
    endCommands: end.map(transformCommand),
    boundaryPoints: transformedAnchorBoundary,
    visibleBoundaryPoints: transformedVisibleBoundary,
    anchors,
    bounds,
    shapeCenter: anchors["shape center"]
  };
}

export function cylinderBorderPoint(geometry = {}, toward = {}, padding = 0) {
  return cylinderBorderPointFrom(geometry, { x: 0, y: 0 }, toward, padding);
}

export function cylinderBorderPointFrom(geometry = {}, reference = {}, toward = {}, padding = 0) {
  const originX = Number(reference.x) || 0;
  const originY = Number(reference.y) || 0;
  const dx = Number(toward.x) || 0;
  const dy = Number(toward.y) || 0;
  const distance = Math.hypot(dx, dy);
  if (distance < CYLINDER_EPSILON) return { x: originX, y: originY };
  const points = geometry.boundaryPoints || [];
  let best = null;
  for (let index = 0; index < points.length; index += 1) {
    const sourceFirst = points[index];
    const sourceSecond = points[(index + 1) % points.length];
    const first = { x: sourceFirst.x - originX, y: sourceFirst.y - originY };
    const second = { x: sourceSecond.x - originX, y: sourceSecond.y - originY };
    const hit = raySegmentIntersection(dx, dy, first, second);
    if (hit && (!best || hit.t < best.t)) best = hit;
  }
  const base = best
    ? { x: originX + best.x, y: originY + best.y }
    : { x: originX, y: originY };
  const extension = Math.max(0, Number(padding) || 0);
  return {
    x: base.x + (dx / distance) * extension,
    y: base.y + (dy / distance) * extension
  };
}

export function starLayoutSize(contentWidth, contentHeight, options = {}) {
  const contentRadius = Math.max(0, Number(contentWidth) || 0, Number(contentHeight) || 0) / 2;
  const usesPointRatio = options.starUsesPointRatio !== false;
  const pointRatio = normalizedStarPointRatio(options.starPointRatio);
  const pointHeight = normalizedStarPointHeight(options.starPointHeight);
  const innerRadius = Math.SQRT2 * contentRadius;
  const sourceOuterRadius = usesPointRatio
    ? innerRadius * pointRatio
    : innerRadius + pointHeight;
  const minimumDiameter = Math.max(
    0,
    Number(options.minimumWidth) || 0,
    Number(options.minimumHeight) || 0,
    Number(options.minimumSize) || 0
  );
  const outerRadius = Math.max(sourceOuterRadius, minimumDiameter / 2);

  return {
    width: outerRadius * 2,
    height: outerRadius * 2
  };
}

export function starNodePoints(center, outerRadius, data = {}) {
  const count = Math.max(3, Math.round(Number(data.starPoints) || 5));
  const radius = Math.max(0, Math.abs(Number(outerRadius) || 0));
  const innerRadius = starInnerRadius(radius, data);
  return starPointsFromRadii(center, radius, innerRadius, data, count);
}

export function starGeometry(size = {}, data = {}) {
  const count = Math.max(3, Math.round(Number(data.starPoints) || 5));
  const outerRadius = Math.max(0, Math.abs(Number(size.width) || 0), Math.abs(Number(size.height) || 0)) / 2;
  const innerRadius = starInnerRadius(outerRadius, data);
  const outerSep = Math.max(0, Number(data.starOuterSep) || 0);
  const points = starPointsFromRadii({ x: 0, y: 0 }, outerRadius, innerRadius, data, count);
  const anchorRadii = starAnchorRadii(outerRadius, innerRadius, count, outerSep);
  const anchorPoints = starPointsFromRadii(
    { x: 0, y: 0 },
    anchorRadii.outerRadius,
    anchorRadii.innerRadius,
    data,
    count
  );
  const anchors = { center: { x: 0, y: 0 } };
  for (let index = 0; index < count; index += 1) {
    anchors[`outer point ${index + 1}`] = anchorPoints[index * 2];
    anchors[`inner point ${index + 1}`] = anchorPoints[index * 2 + 1];
  }
  const directions = {
    north: { x: 0, y: 1 },
    south: { x: 0, y: -1 },
    east: { x: 1, y: 0 },
    west: { x: -1, y: 0 },
    "north east": { x: 1, y: 1 },
    "north west": { x: -1, y: 1 },
    "south east": { x: 1, y: -1 },
    "south west": { x: -1, y: -1 }
  };
  for (const [name, direction] of Object.entries(directions)) {
    anchors[name] = starPolygonBorderPoint(anchorPoints, direction);
  }
  return {
    data,
    count,
    outerRadius,
    innerRadius,
    anchorOuterRadius: anchorRadii.outerRadius,
    anchorInnerRadius: anchorRadii.innerRadius,
    outerSep,
    points,
    anchorPoints,
    anchors,
    bounds: pointBounds(points),
    anchorBounds: pointBounds(anchorPoints)
  };
}

export function starBorderPoint(geometry = {}, toward = {}, padding = 0) {
  const direction = { x: Number(toward.x) || 0, y: Number(toward.y) || 0 };
  if (Math.hypot(direction.x, direction.y) <= 1e-12) return { x: 0, y: 0 };
  const extra = Math.max(0, Number(padding) || 0);
  if (extra <= 1e-12) return starPolygonBorderPoint(geometry.anchorPoints || geometry.points || [], direction);
  const data = geometry.data || {};
  const radii = starAnchorRadii(
    Math.max(0, Number(geometry.outerRadius) || 0),
    Math.max(0, Number(geometry.innerRadius) || 0),
    Math.max(3, Math.round(Number(geometry.count) || 5)),
    Math.max(0, Number(geometry.outerSep) || 0) + extra
  );
  return starPolygonBorderPoint(
    starPointsFromRadii(
      { x: 0, y: 0 },
      radii.outerRadius,
      radii.innerRadius,
      data,
      Math.max(3, Math.round(Number(geometry.count) || 5))
    ),
    direction
  );
}

function starInnerRadius(outerRadius, data = {}) {
  const usesPointRatio = data.starUsesPointRatio !== false;
  return usesPointRatio
    ? outerRadius / normalizedStarPointRatio(data.starPointRatio)
    : Math.max(0, outerRadius - normalizedStarPointHeight(data.starPointHeight));
}

function starPointsFromRadii(center, outerRadius, innerRadius, data = {}, count = 5) {
  const startAngle = 90 + (Number(data.shapeBorderRotate) || 0);
  const x = Number(center?.x) || 0;
  const y = Number(center?.y) || 0;

  return Array.from({ length: count * 2 }, (_unused, index) => {
    const angle = ((startAngle + (180 * index) / count) * Math.PI) / 180;
    const pointRadius = index % 2 === 0 ? outerRadius : innerRadius;
    return {
      x: x + Math.cos(angle) * pointRadius,
      y: y + Math.sin(angle) * pointRadius
    };
  });
}

function starAnchorRadii(outerRadius, innerRadius, count, outerSep) {
  if (outerSep <= 1e-12) return { outerRadius, innerRadius };
  const angle = Math.PI / count;
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  const outerSide = Math.hypot(outerRadius - innerRadius * cosine, innerRadius * sine);
  const innerSide = Math.hypot(outerRadius * cosine - innerRadius, outerRadius * sine);
  const outerHalfAngleSine = Math.abs(innerRadius * sine) / Math.max(1e-12, outerSide);
  const innerHalfAngleSine = Math.abs(outerRadius * sine) / Math.max(1e-12, innerSide);
  return {
    outerRadius: outerRadius + outerSep / Math.max(1e-12, outerHalfAngleSine),
    innerRadius: innerRadius + outerSep / Math.max(1e-12, innerHalfAngleSine)
  };
}

function starPolygonBorderPoint(points, direction) {
  let best = null;
  for (let index = 0; index < points.length; index += 1) {
    const hit = raySegmentIntersection(direction.x, direction.y, points[index], points[(index + 1) % points.length]);
    if (hit && (!best || hit.t < best.t)) best = hit;
  }
  return best ? { x: best.x, y: best.y } : { x: 0, y: 0 };
}

export function trapeziumLayoutSize(contentWidth, contentHeight, options = {}) {
  let bodyHalfWidth = Math.max(0, Number(contentWidth) || 0) / 2;
  let halfHeight = Math.max(TRAPEZIUM_EPSILON, Math.max(0, Number(contentHeight) || 0) / 2);
  const minimumWidth = Math.max(0, Number(options.minimumWidth) || 0);
  const minimumHeight = Math.max(0, Number(options.minimumHeight) || 0);
  const stretchesBody = options.stretchesBody === true;
  const stretches = options.stretches === true || stretchesBody;
  let leftExtension = trapeziumSideExtension(halfHeight, options.leftAngle);
  let rightExtension = trapeziumSideExtension(halfHeight, options.rightAngle);
  const minimumHalfHeight = minimumHeight / 2;

  // PGF computes both side extensions before applying minimum dimensions.
  // The default scales the complete shape; either stretch key changes only
  // the body height and deliberately leaves those extensions untouched.
  if (halfHeight < minimumHalfHeight) {
    if (stretches) {
      halfHeight = minimumHalfHeight;
    } else {
      const scale = minimumHalfHeight / halfHeight;
      bodyHalfWidth *= scale;
      halfHeight *= scale;
      leftExtension *= scale;
      rightExtension *= scale;
    }
  }

  const span = () => bodyHalfWidth * 2 + Math.abs(leftExtension) + Math.abs(rightExtension);
  if (span() < minimumWidth) {
    if (stretchesBody) {
      bodyHalfWidth += (minimumWidth - span()) / 2;
    } else {
      const scale = minimumWidth / Math.max(TRAPEZIUM_EPSILON, span());
      bodyHalfWidth *= scale;
      leftExtension *= scale;
      rightExtension *= scale;
      if (!stretches) halfHeight *= scale;
    }
  }

  return {
    width: bodyHalfWidth * 2 + Math.abs(leftExtension) + Math.abs(rightExtension),
    height: halfHeight * 2,
    trapeziumBodyHalfWidth: bodyHalfWidth,
    trapeziumHalfHeight: halfHeight,
    trapeziumLeftExtension: leftExtension,
    trapeziumRightExtension: rightExtension
  };
}

export function trapeziumNodePoints(center, halfWidth, halfHeight, data = {}) {
  const storedHeight = Number(data.trapeziumHalfHeight);
  const height = Number.isFinite(storedHeight)
    ? Math.max(TRAPEZIUM_EPSILON, Math.abs(storedHeight))
    : Math.max(TRAPEZIUM_EPSILON, Math.abs(Number(halfHeight) || 0));
  const storedLeftExtension = Number(data.trapeziumLeftExtension);
  const storedRightExtension = Number(data.trapeziumRightExtension);
  const leftExtension = Number.isFinite(storedLeftExtension)
    ? storedLeftExtension
    : trapeziumSideExtension(height, data.trapeziumLeftAngle);
  const rightExtension = Number.isFinite(storedRightExtension)
    ? storedRightExtension
    : trapeziumSideExtension(height, data.trapeziumRightAngle);
  const storedBodyHalfWidth = Number(data.trapeziumBodyHalfWidth);
  const bodyHalfWidth = Number.isFinite(storedBodyHalfWidth)
    ? Math.max(0, storedBodyHalfWidth)
    : Math.max(0, Math.abs(Number(halfWidth) || 0) - (Math.abs(leftExtension) + Math.abs(rightExtension)) / 2);
  const x = Number(center?.x) || 0;
  const y = Number(center?.y) || 0;

  return [
    { x: x - bodyHalfWidth - Math.max(0, leftExtension), y: y - height },
    { x: x - bodyHalfWidth + Math.min(0, leftExtension), y: y + height },
    { x: x + bodyHalfWidth - Math.min(0, rightExtension), y: y + height },
    { x: x + bodyHalfWidth + Math.max(0, rightExtension), y: y - height }
  ];
}

function trapeziumSideExtension(halfHeight, rawAngle) {
  const angle = normalizeTrapeziumAngle(rawAngle);
  const radians = (angle * Math.PI) / 180;
  const sine = Math.sin(radians);
  if (Math.abs(sine) < TRAPEZIUM_EPSILON) return 0;
  return 2 * halfHeight * (Math.cos(radians) / sine);
}

function normalizedStarPointRatio(rawRatio) {
  const value = Number(rawRatio);
  return Number.isFinite(value) && value > TRAPEZIUM_EPSILON ? value : STAR_DEFAULT_POINT_RATIO;
}

function normalizedStarPointHeight(rawHeight) {
  const value = Number(rawHeight);
  return Number.isFinite(value) && value >= 0 ? value : STAR_DEFAULT_POINT_HEIGHT;
}

function normalizeTrapeziumAngle(rawAngle) {
  const numeric = Number(rawAngle);
  const fallback = 60;
  const normalized = Number.isFinite(numeric) ? ((numeric % 360) + 360) % 360 : fallback;
  // PGF accepts a broad angular range. This focused SVG shape needs finite,
  // non-degenerate sides, so retain the safe range already used by TikZKit.
  return Math.max(10, Math.min(170, normalized || fallback));
}

function cylinderAspect(rawAspect) {
  const value = Number(rawAspect);
  return Number.isFinite(value) && value > CYLINDER_EPSILON ? value : CYLINDER_DEFAULT_ASPECT;
}

function cylinderQuarterRotation(rawRotation) {
  const value = Number(rawRotation);
  const normalized = Number.isFinite(value) ? ((value % 360) + 360) % 360 : 0;
  return (Math.round(normalized / 90) * 90) % 360;
}

function semicircleRotation(rawRotation, usesIncircle = false) {
  const value = Number(rawRotation);
  const normalized = Number.isFinite(value) ? ((value % 360) + 360) % 360 : 0;
  return usesIncircle ? normalized : (Math.round(normalized / 90) * 90) % 360;
}

function semicircleBoundaryPoints(radius, centerOffset, rotate, chordOuterSep) {
  const arc = sampleEllipseArc(0, centerOffset, radius, radius, 0, 180, 48);
  const chordY = centerOffset - Math.max(0, Number(chordOuterSep) || 0);
  return [
    ...arc,
    { x: -radius, y: chordY },
    { x: radius, y: chordY }
  ].map((point) => rotatePoint(point, rotate));
}

function rotatePoint(point, degrees) {
  const angle = ((Number(degrees) || 0) * Math.PI) / 180;
  if (Math.abs(angle) < SEMICIRCLE_EPSILON) return { x: point.x, y: point.y };
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: point.x * cosine - point.y * sine,
    y: point.x * sine + point.y * cosine
  };
}

function rotateCommands(commands, degrees) {
  return commands.map((command) => {
    if (command.type === "closePath") return command;
    const point = rotatePoint(command, degrees);
    if (command.type !== "curveTo") return { ...command, ...point };
    const first = rotatePoint({ x: command.x1, y: command.y1 }, degrees);
    const second = rotatePoint({ x: command.x2, y: command.y2 }, degrees);
    return { ...command, ...point, x1: first.x, y1: first.y, x2: second.x, y2: second.y };
  });
}

function addPoints(first, second) {
  return {
    x: (Number(first?.x) || 0) + (Number(second?.x) || 0),
    y: (Number(first?.y) || 0) + (Number(second?.y) || 0)
  };
}

function finitePositive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function cylinderContentChord(radiusX, radiusY, innerCrossSep) {
  if (radiusY <= CYLINDER_EPSILON) return 0;
  const sine = Math.max(-1, Math.min(1, (radiusY - innerCrossSep) / radiusY));
  return Math.sqrt(Math.max(0, 1 - sine * sine)) * radiusX;
}

function ellipseArcCommands(cx, cy, rx, ry, startDegrees, endDegrees) {
  const commands = [];
  const sweep = endDegrees - startDegrees;
  const count = Math.max(1, Math.ceil(Math.abs(sweep) / 90));
  const delta = sweep / count;
  for (let index = 0; index < count; index += 1) {
    const start = ((startDegrees + index * delta) * Math.PI) / 180;
    const end = ((startDegrees + (index + 1) * delta) * Math.PI) / 180;
    const factor = (4 / 3) * Math.tan((end - start) / 4);
    const startPoint = { x: cx + rx * Math.cos(start), y: cy + ry * Math.sin(start) };
    const endPoint = { x: cx + rx * Math.cos(end), y: cy + ry * Math.sin(end) };
    commands.push({
      type: "curveTo",
      x1: startPoint.x - factor * rx * Math.sin(start),
      y1: startPoint.y + factor * ry * Math.cos(start),
      x2: endPoint.x + factor * rx * Math.sin(end),
      y2: endPoint.y - factor * ry * Math.cos(end),
      x: endPoint.x,
      y: endPoint.y
    });
  }
  return commands;
}

function sampleEllipseArc(cx, cy, rx, ry, startDegrees, endDegrees, count) {
  return Array.from({ length: count + 1 }, (_unused, index) => {
    const angle = ((startDegrees + ((endDegrees - startDegrees) * index) / count) * Math.PI) / 180;
    return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
  });
}

function rotatePointQuarter(point, degrees) {
  if (degrees === 90) return { x: -point.y, y: point.x };
  if (degrees === 180) return { x: -point.x, y: -point.y };
  if (degrees === 270) return { x: point.y, y: -point.x };
  return { x: point.x, y: point.y };
}

function rotateCylinderCommand(command, degrees) {
  if (command.type === "closePath") return command;
  const point = rotatePointQuarter(command, degrees);
  if (command.type !== "curveTo") return { ...command, ...point };
  const first = rotatePointQuarter({ x: command.x1, y: command.y1 }, degrees);
  const second = rotatePointQuarter({ x: command.x2, y: command.y2 }, degrees);
  return { ...command, ...point, x1: first.x, y1: first.y, x2: second.x, y2: second.y };
}

function pointBounds(points) {
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxX: Math.max(bounds.maxX, point.x),
    maxY: Math.max(bounds.maxY, point.y)
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

function raySegmentIntersection(dx, dy, first, second) {
  const sx = second.x - first.x;
  const sy = second.y - first.y;
  const denominator = dx * sy - dy * sx;
  if (Math.abs(denominator) < CYLINDER_EPSILON) return null;
  const t = (first.x * sy - first.y * sx) / denominator;
  const u = (first.x * dy - first.y * dx) / denominator;
  if (t < -CYLINDER_EPSILON || u < -CYLINDER_EPSILON || u > 1 + CYLINDER_EPSILON) return null;
  return { t, x: dx * t, y: dy * t };
}

export const tikzLibrary = {
  "name": "shapes.geometric",
  "status": "partial",
  "implementedBy": [
    "src/engine/evaluate.js:regularPolygonLayoutSize/regularPolygonStartAngle/regularPolygonOuterRadiusExtension/nodeBorderPoint/polygonBorderPointWithPadding/trapeziumLayoutShapeData/customNodeLocalAnchor",
    "src/tikz/libraries/shapes.geometric.js:starLayoutSize/starNodePoints/starGeometry/starBorderPoint/trapeziumLayoutSize/trapeziumNodePoints",
    "src/tikz/libraries/shapes.geometric.js:cylinderLayoutSize/cylinderGeometry/cylinderBorderPoint/cylinderBorderPointFrom",
    "src/tikz/libraries/shapes.geometric.js:semicircleLayoutSize/semicircleGeometry/semicircleBorderPoint/semicircleBorderPointFrom",
    "src/renderers/svg/nodeShapes.js:regularPolygonNodePoints/starNodePoints/renderCylinderNodeBox/renderLibraryNodeBox",
    "src/renderers/svg/bounds.js:nodeBounds"
  ],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex",
  "localSourceReviewed": true,
  "features": [
    "regular polygon with PGF circumcircle sizing, odd/even orientation, rotation, and border crop",
    "star with PGF radius modes, minimum sizing, border rotation, mitered outer separation, and named inner/outer point anchors",
    "trapezium with PGF cotangent side geometry, proportional/independent/body-only minimum-size stretching, named side/corner anchors, and mitered border crop",
    "isosceles triangle with apex angle, minimum height, rotation, and named anchors",
    "cylinder with PGF quarter-turn border rotation, aspect/minimum sizing, complete end/mid/base named anchors, curved outer-separation border clipping, and separate body/end fills",
    "semicircle with PGF content/minimum sizing, shifted circle center, quarter-turn border rotation, named arc/chord/base/mid anchors, curved outer-separation clipping, and cubic arc paint"
  ],
  "implements": [
    "regular polygon",
    "star",
    "trapezium",
    "isosceles triangle",
    "cylinder",
    "semicircle"
  ],
  "notes": "Reviewed locally on 2026-08-07 against pgflibraryshapes.geometric.code.tex and the PGF shapes manual. Regular polygons use the source's sqrt(2)*apothem*sec(180/sides) content radius, circumcircle minimum size, odd/even orientation, `shape border rotate`/`regular polygon rotate`, and the outer-separation mitre extension used by curved terminal arrows. The permanent visual driver is arrows/regular-polygon-curved-terminal.tex. Stars now share PGF's max-content-radius, sqrt(2) inner-radius, ratio/point-height outer-radius, largest-minimum-diameter, and `star rotate` construction across layout, clipping, and SVG paint; arrows-shape-curved-terminal-padding is the visual driver. The default trapezium follows `\\installtrapeziumparameters`: side extensions are 2*half-height*cot(angle), minimum width/height preserve that construction by uniform scaling, and curve terminal rays intersect the mitered offset contour rather than an arbitrary adjacent side. `test/fixtures/arrows/shape-curved-terminal-miters.tex` is the visual regression. Reviewed again on 2026-09-04 for the cylinder declaration at lines 4019-4475 and the manual cylinder section: the end ellipse uses `shape aspect`, quarter-turn border rotation swaps the content axes, minimum width expands only the cross radius after the natural end radius has been fixed, and minimum height extends the body. TikZKit now shares this geometry across layout, paint, bounding boxes, named anchors, and border clipping, with independent body/end fill paths. The permanent drivers are `shapes/cylinder-manual-catalog.tex`, `shapes/cylinder-data-flow.tex`, and `shapes/cylinder-volume-physics.tex`. Reviewed again on 2026-09-04 for the trapezium declaration and manual examples: `trapezium stretches` keeps the final width and height independent while `trapezium stretches body` adds a minimum-width deficit only to the body half-width, preserving the previously computed side extensions. The final geometry record is shared by SVG paint, mitered outer-separation anchors, named side/corner anchors, and arrow border clipping. Permanent flowchart, mathematics, and physics drivers and three-way evidence are recorded in `docs/qa/2026-09-04-shapes-trapezium-stretches.md`. Reviewed again on 2026-09-04 for the star declaration at lines 349-667: visible star paint retains the content radii, while named points, compass anchors, positioning bounds, and automatic edge clipping share the source's independently mitered inner and outer anchor radii. The miter extension is outer separation multiplied by the cosecant of each vertex half angle. Permanent three-way flowchart, mathematics, and physics evidence is recorded in `docs/qa/2026-09-04-shapes-star-anchors.md`. Reviewed again on 2026-09-04 for cylinder anchors at lines 4120-4412: before/after anchors apply outer y separation before quarter rotation, top/bottom use the expanded end radius, and mid/base east/west cast rays from the TeX midline or baseline to the rotated cylinder boundary. TikZKit now keeps a visible paint boundary separate from the outer-separation anchor boundary and uses the latter for named anchors, node placement, and automatic clipping. Permanent flowchart, mathematics, and physics evidence is recorded in `docs/qa/2026-09-04-shapes-cylinder-anchors.md`. Reviewed again on 2026-09-04 for the semicircle declaration at lines 1523-1980 and its manual section: natural radius is hypot(half content width, twice the half content height), minimum width constrains the diameter, minimum height constrains the radius, and the circular center shifts away from the text center as the minimum radius grows. Quarter-turn rotation swaps content axes; paint uses the visible arc and chord while named anchors and automatic clipping use the outer-separation contour. Permanent flowchart, mathematics, and physics evidence is recorded in `docs/qa/2026-09-04-shapes-geometric-semicircle.md`. Kite, dart, circular sector, exact arbitrary-angle incircle metrics, and degenerate angular ranges remain partial."
};
