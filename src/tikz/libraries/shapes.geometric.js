const TRAPEZIUM_EPSILON = 1e-9;
const DIAMOND_EPSILON = 1e-9;
const CYLINDER_EPSILON = 1e-9;
const SEMICIRCLE_EPSILON = 1e-9;
const KITE_EPSILON = 1e-9;
const DART_EPSILON = 1e-9;
const CIRCULAR_SECTOR_EPSILON = 1e-9;
const ISOSCELES_TRIANGLE_EPSILON = 1e-9;
const STAR_DEFAULT_POINT_RATIO = 1.5;
const STAR_DEFAULT_POINT_HEIGHT = 0.5;
const CYLINDER_DEFAULT_ASPECT = 1;
const COMPASS_DIRECTIONS = {
  north: { x: 0, y: 1 },
  south: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
  "north east": { x: 1, y: 1 },
  "north west": { x: -1, y: 1 },
  "south east": { x: 1, y: -1 },
  "south west": { x: -1, y: -1 }
};

export function diamondLayoutSize(contentWidth, contentHeight, options = {}) {
  const aspect = finitePositive(options.aspect, 1);
  const halfContentWidth = Math.max(0, Number(contentWidth) || 0) / 2;
  const halfContentHeight = Math.max(0, Number(contentHeight) || 0) / 2;
  const minimumSize = Math.max(0, Number(options.minimumSize) || 0);
  const minimumWidth = Math.max(minimumSize, Number(options.minimumWidth) || 0);
  const minimumHeight = Math.max(minimumSize, Number(options.minimumHeight) || 0);
  const halfWidth = Math.max(halfContentWidth + aspect * halfContentHeight, minimumWidth / 2);
  const halfHeight = Math.max(halfContentWidth / aspect + halfContentHeight, minimumHeight / 2);
  return {
    width: halfWidth * 2,
    height: halfHeight * 2,
    diamondHalfWidth: halfWidth,
    diamondHalfHeight: halfHeight,
    diamondAspect: aspect
  };
}

export function diamondGeometry(size = {}, data = {}) {
  const halfWidth = finitePositive(data.diamondHalfWidth, Math.max(0, Number(size.width) || 0) / 2);
  const halfHeight = finitePositive(data.diamondHalfHeight, Math.max(0, Number(size.height) || 0) / 2);
  const outerXSep = Math.max(0, Number(data.diamondOuterXSep) || 0);
  const outerYSep = Math.max(0, Number(data.diamondOuterYSep) || 0);
  const anchorHalfWidth = halfWidth + outerXSep;
  const anchorHalfHeight = halfHeight + outerYSep;
  const paintHalfWidth = Math.max(0, anchorHalfWidth - Math.SQRT2 * outerXSep);
  const paintHalfHeight = Math.max(0, anchorHalfHeight - Math.SQRT2 * outerYSep);
  const paintPoints = diamondPoints(paintHalfWidth, paintHalfHeight);
  const anchorPoints = diamondPoints(anchorHalfWidth, anchorHalfHeight);
  const anchors = {
    center: { x: 0, y: 0 },
    text: { x: Number(data.diamondTextX) || 0, y: Number(data.diamondTextY) || 0 },
    base: { x: 0, y: Number(data.diamondBaseOffset) || 0 },
    mid: { x: 0, y: Number(data.diamondMidOffset) || 0 },
    north: { x: 0, y: anchorHalfHeight },
    south: { x: 0, y: -anchorHalfHeight },
    east: { x: anchorHalfWidth, y: 0 },
    west: { x: -anchorHalfWidth, y: 0 },
    "north east": { x: anchorHalfWidth / 2, y: anchorHalfHeight / 2 },
    "north west": { x: -anchorHalfWidth / 2, y: anchorHalfHeight / 2 },
    "south east": { x: anchorHalfWidth / 2, y: -anchorHalfHeight / 2 },
    "south west": { x: -anchorHalfWidth / 2, y: -anchorHalfHeight / 2 }
  };
  return {
    halfWidth,
    halfHeight,
    outerXSep,
    outerYSep,
    anchorHalfWidth,
    anchorHalfHeight,
    paintHalfWidth,
    paintHalfHeight,
    paintPoints,
    anchorPoints,
    outlineCommands: polygonCommands(paintPoints),
    bounds: pointBounds(paintPoints),
    anchorBounds: pointBounds(anchorPoints),
    anchors
  };
}

export function diamondBorderPoint(geometry = {}, toward = {}, padding = 0) {
  const dx = Number(toward.x) || 0;
  const dy = Number(toward.y) || 0;
  if (Math.hypot(dx, dy) < DIAMOND_EPSILON) return { x: 0, y: 0 };
  const halfWidth = Math.max(DIAMOND_EPSILON, Number(geometry.anchorHalfWidth) || 0);
  const halfHeight = Math.max(DIAMOND_EPSILON, Number(geometry.anchorHalfHeight) || 0);
  const extension = Math.max(0, Number(padding) || 0);
  const offsetScale = 1 + extension * Math.hypot(1 / halfWidth, 1 / halfHeight);
  const paddedHalfWidth = halfWidth * offsetScale;
  const paddedHalfHeight = halfHeight * offsetScale;
  const factor = 1 / (Math.abs(dx) / paddedHalfWidth + Math.abs(dy) / paddedHalfHeight);
  return { x: dx * factor, y: dy * factor };
}

function diamondPoints(halfWidth, halfHeight) {
  return [
    { x: halfWidth, y: 0 },
    { x: 0, y: halfHeight },
    { x: -halfWidth, y: 0 },
    { x: 0, y: -halfHeight }
  ];
}

export function circularSectorLayoutSize(contentWidth, contentHeight, options = {}) {
  const usesIncircle = options.shapeBorderUsesIncircle === true;
  const rotate = circularSectorRotation(options.shapeBorderRotate, usesIncircle);
  const swapsAxes = !usesIncircle && (rotate === 90 || rotate === 270);
  const halfWidth = Math.max(0, Number(swapsAxes ? contentHeight : contentWidth) || 0) / 2;
  const halfHeight = Math.max(0, Number(swapsAxes ? contentWidth : contentHeight) || 0) / 2;
  const sectorAngle = normalizedCircularSectorAngle(options.sectorAngle);
  const halfAngle = degreesToRadians(sectorAngle / 2);
  const sineHalfAngle = safeSine(halfAngle);
  const cosineHalfAngle = Math.cos(halfAngle);
  let centerOffset;
  let radius;

  if (usesIncircle) {
    const incircleRadius = Math.SQRT2 * Math.max(halfWidth, halfHeight);
    centerOffset = incircleRadius / sineHalfAngle;
    radius = centerOffset + incircleRadius;
  } else {
    centerOffset = halfHeight * cosineHalfAngle / sineHalfAngle + halfWidth;
    radius = Math.hypot(centerOffset + halfWidth, halfHeight);
  }

  const minimumSize = Math.max(0, Number(options.minimumSize) || 0);
  const minimumWidth = Math.max(minimumSize, Number(options.minimumWidth) || 0);
  const minimumHeight = Math.max(minimumSize, Number(options.minimumHeight) || 0);
  const projectedHalfWidth = Math.abs(centerOffset / safeCosine(halfAngle));
  if (projectedHalfWidth < minimumWidth / 2) {
    const scale = (minimumWidth / 2) / Math.max(CIRCULAR_SECTOR_EPSILON, projectedHalfWidth);
    centerOffset *= scale;
    radius *= scale;
  }
  if (radius < minimumHeight) {
    const scale = minimumHeight / Math.max(CIRCULAR_SECTOR_EPSILON, radius);
    centerOffset *= scale;
    radius = minimumHeight;
  }

  const visibleBoundaryPoints = circularSectorExtremaPoints(centerOffset, radius, sectorAngle, rotate);
  const bounds = pointBounds(visibleBoundaryPoints);
  const center = rotatePoint({ x: centerOffset, y: 0 }, rotate);
  return {
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    minX: bounds.minX,
    minY: bounds.minY,
    maxX: bounds.maxX,
    maxY: bounds.maxY,
    circularSectorRadius: radius,
    circularSectorCenterOffset: centerOffset,
    circularSectorCenterX: center.x,
    circularSectorCenterY: center.y,
    circularSectorAngle: sectorAngle,
    circularSectorShapeBorderRotate: rotate,
    circularSectorShapeBorderUsesIncircle: usesIncircle
  };
}

export function circularSectorGeometry(size = {}, data = {}) {
  const usesIncircle = data.circularSectorShapeBorderUsesIncircle === true || data.shapeBorderUsesIncircle === true;
  const rotate = circularSectorRotation(
    data.circularSectorShapeBorderRotate ?? data.shapeBorderRotate,
    usesIncircle
  );
  const sectorAngle = normalizedCircularSectorAngle(data.circularSectorAngle ?? data.sectorAngle);
  const halfAngle = degreesToRadians(sectorAngle / 2);
  const radius = finitePositive(
    data.circularSectorRadius,
    Math.max(CIRCULAR_SECTOR_EPSILON, Number(size.width) || 0, Number(size.height) || 0)
  );
  const centerOffset = Number.isFinite(Number(data.circularSectorCenterOffset))
    ? Number(data.circularSectorCenterOffset)
    : radius * 0.6;
  const outerSep = Math.max(0, Number(data.circularSectorOuterSep) || 0);
  const anchorRadius = radius + outerSep;
  const centerMiter = outerSep / safeSine(halfAngle);
  const cornerRadius = anchorRadius + outerSep * Math.cos(halfAngle) / safeSine(halfAngle);
  const startAngle = 180 - sectorAngle / 2;
  const endAngle = 180 + sectorAngle / 2;
  const sectorCenterLocal = { x: centerOffset, y: 0 };
  const sectorCenterBorderLocal = { x: centerOffset + centerMiter, y: 0 };
  const arcStartLocal = pointOnCircle(sectorCenterLocal, radius, startAngle);
  const arcEndLocal = pointOnCircle(sectorCenterLocal, radius, endAngle);
  const arcStartBorderLocal = pointOnCircle(sectorCenterLocal, anchorRadius, startAngle);
  const arcEndBorderLocal = pointOnCircle(sectorCenterLocal, anchorRadius, endAngle);
  const arcStartCornerLocal = addPoints(
    sectorCenterBorderLocal,
    pointOnCircle({ x: 0, y: 0 }, cornerRadius, startAngle)
  );
  const arcEndCornerLocal = addPoints(
    sectorCenterBorderLocal,
    pointOnCircle({ x: 0, y: 0 }, cornerRadius, endAngle)
  );
  const transformPoint = (point) => rotatePoint(point, rotate);
  const sectorCenter = transformPoint(sectorCenterLocal);
  const visibleAnchors = {
    "sector center": sectorCenter,
    "arc start": transformPoint(arcStartLocal),
    "arc end": transformPoint(arcEndLocal),
    "arc center": transformPoint({ x: centerOffset - radius, y: 0 })
  };
  const anchors = {
    center: { x: 0, y: 0 },
    base: { x: 0, y: Number(data.circularSectorBaseOffset) || 0 },
    mid: { x: 0, y: Number(data.circularSectorMidOffset) || 0 },
    "sector center": transformPoint(sectorCenterBorderLocal),
    "arc start": transformPoint(arcStartCornerLocal),
    "arc end": transformPoint(arcEndCornerLocal),
    "arc center": transformPoint({ x: centerOffset - anchorRadius, y: 0 })
  };
  const geometry = {
    outlineCommands: rotateCommands([
      { type: "moveTo", ...sectorCenterLocal },
      { type: "lineTo", ...arcStartLocal },
      ...ellipseArcCommands(centerOffset, 0, radius, radius, startAngle, endAngle),
      { type: "closePath" }
    ], rotate),
    sectorCenter,
    sectorCenterLocal,
    sectorCenterBorderLocal,
    arcStartBorderLocal,
    arcEndBorderLocal,
    arcStartCornerLocal,
    arcEndCornerLocal,
    visibleBoundaryPoints: circularSectorExtremaPoints(centerOffset, radius, sectorAngle, rotate),
    boundaryPoints: circularSectorAnchorBoundaryPoints({
      centerOffset,
      anchorRadius,
      sectorAngle,
      rotate,
      sectorCenterBorderLocal,
      arcStartCornerLocal,
      arcEndCornerLocal
    }),
    anchors,
    visibleAnchors,
    radius,
    anchorRadius,
    centerOffset,
    cornerRadius,
    outerSep,
    rotate,
    sectorAngle,
    startAngle,
    endAngle
  };
  for (const [name, direction] of Object.entries(COMPASS_DIRECTIONS)) {
    anchors[name] = circularSectorBorderPoint(geometry, direction);
  }
  geometry.bounds = pointBounds(geometry.visibleBoundaryPoints);
  geometry.anchorBounds = pointBounds(geometry.boundaryPoints);
  return geometry;
}

export function circularSectorBorderPoint(geometry = {}, toward = {}, padding = 0) {
  return circularSectorBorderPointFrom(geometry, { x: 0, y: 0 }, toward, padding);
}

export function circularSectorBorderPointFrom(geometry = {}, reference = {}, toward = {}, padding = 0) {
  const dx = Number(toward.x) || 0;
  const dy = Number(toward.y) || 0;
  const distance = Math.hypot(dx, dy);
  if (distance < CIRCULAR_SECTOR_EPSILON) {
    return { x: Number(reference.x) || 0, y: Number(reference.y) || 0 };
  }
  const rotate = Number(geometry.rotate) || 0;
  const localReference = rotatePoint(reference, -rotate);
  const localDirection = rotatePoint({ x: dx, y: dy }, -rotate);
  const candidates = [];
  const segments = [
    [geometry.sectorCenterBorderLocal, geometry.arcStartCornerLocal],
    [geometry.arcStartCornerLocal, geometry.arcStartBorderLocal],
    [geometry.arcEndBorderLocal, geometry.arcEndCornerLocal],
    [geometry.arcEndCornerLocal, geometry.sectorCenterBorderLocal]
  ];
  for (const [firstPoint, secondPoint] of segments) {
    if (!firstPoint || !secondPoint) continue;
    const first = { x: firstPoint.x - localReference.x, y: firstPoint.y - localReference.y };
    const second = { x: secondPoint.x - localReference.x, y: secondPoint.y - localReference.y };
    const hit = raySegmentIntersection(localDirection.x, localDirection.y, first, second);
    if (hit && hit.t >= -CIRCULAR_SECTOR_EPSILON) candidates.push(hit);
  }
  const circleHit = rayCircularSectorIntersection(
    localReference,
    localDirection,
    { x: Number(geometry.centerOffset) || 0, y: 0 },
    Math.max(CIRCULAR_SECTOR_EPSILON, Number(geometry.anchorRadius) || 0),
    Number(geometry.startAngle) || 0,
    Number(geometry.sectorAngle) || 0
  );
  if (circleHit) candidates.push(circleHit);
  candidates.sort((left, right) => left.t - right.t);
  const hit = candidates.find((candidate) => candidate.t >= -CIRCULAR_SECTOR_EPSILON);
  const localPoint = hit
    ? { x: localReference.x + hit.x, y: localReference.y + hit.y }
    : localReference;
  const point = rotatePoint(localPoint, rotate);
  const extension = Math.max(0, Number(padding) || 0);
  return {
    x: point.x + dx / distance * extension,
    y: point.y + dy / distance * extension
  };
}

export function dartLayoutSize(contentWidth, contentHeight, options = {}) {
  const usesIncircle = options.shapeBorderUsesIncircle === true;
  const rotate = dartRotation(options.shapeBorderRotate, usesIncircle);
  const swapsAxes = !usesIncircle && (rotate === 90 || rotate === 270);
  const halfContentWidth = Math.max(0, Number(swapsAxes ? contentHeight : contentWidth) || 0) / 2;
  const halfContentHeight = Math.max(0, Number(swapsAxes ? contentWidth : contentHeight) || 0) / 2;
  const tipAngle = normalizedDartAngle(options.tipAngle, 45);
  const tailAngle = normalizedDartAngle(options.tailAngle, 135);
  const tipHalfAngle = degreesToRadians(tipAngle / 2);
  const tailHalfAngle = degreesToRadians(tailAngle / 2);
  let deltaX = halfContentWidth;
  let dartLength;

  if (usesIncircle) {
    deltaX = Math.SQRT2 * Math.max(halfContentWidth, halfContentHeight);
    dartLength = deltaX / safeTangent(tipHalfAngle) + deltaX;
  } else {
    dartLength = halfContentHeight / safeTangent(tipHalfAngle) + 2 * halfContentWidth;
  }

  let halfTailSeparation = dartLength * Math.sin(tipHalfAngle) * Math.cos(tipHalfAngle) /
    safeSine(tailHalfAngle - tipHalfAngle);
  let totalLength = halfTailSeparation / safeTangent(tipHalfAngle);
  let tailLength = totalLength - dartLength;

  const minimumSize = Math.max(0, Number(options.minimumSize) || 0);
  const minimumHeight = Math.max(minimumSize, Number(options.minimumHeight) || 0);
  const minimumWidth = Math.max(minimumSize, Number(options.minimumWidth) || 0);
  if (totalLength < minimumHeight) {
    const scale = minimumHeight / Math.max(DART_EPSILON, totalLength);
    dartLength *= scale;
    tailLength *= scale;
    halfTailSeparation *= scale;
    deltaX *= scale;
    totalLength = minimumHeight;
  }
  if (halfTailSeparation < minimumWidth / 2) {
    const scale = (minimumWidth / 2) / Math.max(DART_EPSILON, halfTailSeparation);
    dartLength *= scale;
    tailLength *= scale;
    deltaX *= scale;
    halfTailSeparation = minimumWidth / 2;
    totalLength *= scale;
  }

  const visibleBoundaryPoints = dartBoundaryPoints(dartLength, tailLength, halfTailSeparation, deltaX, rotate);
  const bounds = pointBounds(visibleBoundaryPoints);
  return {
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    minX: bounds.minX,
    minY: bounds.minY,
    maxX: bounds.maxX,
    maxY: bounds.maxY,
    dartLength,
    dartTailLength: tailLength,
    dartHalfTailSeparation: halfTailSeparation,
    dartDeltaX: deltaX,
    dartTipAngle: tipAngle,
    dartTailAngle: tailAngle,
    dartShapeBorderRotate: rotate,
    dartShapeBorderUsesIncircle: usesIncircle
  };
}

export function dartGeometry(size = {}, data = {}) {
  const usesIncircle = data.dartShapeBorderUsesIncircle === true || data.shapeBorderUsesIncircle === true;
  const rotate = dartRotation(data.dartShapeBorderRotate ?? data.shapeBorderRotate, usesIncircle);
  const tipAngle = normalizedDartAngle(data.dartTipAngle, 45);
  const tailAngle = normalizedDartAngle(data.dartTailAngle, 135);
  const tipHalfAngle = degreesToRadians(tipAngle / 2);
  const tailHalfAngle = degreesToRadians(tailAngle / 2);
  const swapsAxes = !usesIncircle && (rotate === 90 || rotate === 270);
  const inferredTotalLength = Math.max(DART_EPSILON, Number(swapsAxes ? size.height : size.width) || 0);
  const inferredHalfTailSeparation = Math.max(DART_EPSILON, (Number(swapsAxes ? size.width : size.height) || 0) / 2);
  const inferredDartLength = Math.max(DART_EPSILON, inferredTotalLength * 0.8);
  const dartLength = finitePositive(data.dartLength, inferredDartLength);
  const tailLength = finitePositive(data.dartTailLength, Math.max(DART_EPSILON, inferredTotalLength - dartLength));
  const halfTailSeparation = finitePositive(data.dartHalfTailSeparation, inferredHalfTailSeparation);
  const deltaX = finitePositive(data.dartDeltaX, dartLength / 3);
  const outerSep = Math.max(0, Number(data.dartOuterSep) || 0);
  const visibleBoundaryPoints = dartBoundaryPoints(dartLength, tailLength, halfTailSeparation, deltaX, rotate);
  const visibleAnchors = dartVertexAnchors(visibleBoundaryPoints);

  const miterHalfAngle = (tailHalfAngle - tipHalfAngle) / 2;
  const miterLength = outerSep / safeSine(miterHalfAngle);
  const miterAngle = miterHalfAngle + Math.PI / 2 - tailHalfAngle;
  const unrotatedBoundaryPoints = [
    { x: dartLength - deltaX + outerSep / safeSine(tipHalfAngle), y: 0 },
    {
      x: -deltaX - tailLength - Math.sin(miterAngle) * miterLength,
      y: halfTailSeparation + Math.cos(miterAngle) * miterLength
    },
    { x: -deltaX - outerSep / safeSine(tailHalfAngle), y: 0 },
    {
      x: -deltaX - tailLength - Math.sin(miterAngle) * miterLength,
      y: -halfTailSeparation - Math.cos(miterAngle) * miterLength
    }
  ];
  const boundaryPoints = unrotatedBoundaryPoints.map((point) => rotatePoint(point, rotate));
  const anchors = dartVertexAnchors(boundaryPoints);
  anchors["left side"] = midpoint(anchors.tip, anchors["left tail"]);
  anchors["right side"] = midpoint(anchors.tip, anchors["right tail"]);
  anchors.center = { x: 0, y: 0 };
  anchors.base = { x: 0, y: Number(data.dartBaseOffset) || 0 };
  anchors.mid = { x: 0, y: Number(data.dartMidOffset) || 0 };
  const borderGeometry = { boundaryPoints };
  anchors["base east"] = dartBorderPointFrom(borderGeometry, anchors.base, { x: 1, y: 0 });
  anchors["base west"] = dartBorderPointFrom(borderGeometry, anchors.base, { x: -1, y: 0 });
  anchors["mid east"] = dartBorderPointFrom(borderGeometry, anchors.mid, { x: 1, y: 0 });
  anchors["mid west"] = dartBorderPointFrom(borderGeometry, anchors.mid, { x: -1, y: 0 });
  for (const [name, direction] of Object.entries(COMPASS_DIRECTIONS)) {
    anchors[name] = dartBorderPoint(borderGeometry, direction);
  }

  return {
    outlineCommands: polygonCommands(visibleBoundaryPoints),
    boundaryPoints,
    visibleBoundaryPoints,
    anchors,
    visibleAnchors,
    bounds: pointBounds(visibleBoundaryPoints),
    anchorBounds: pointBounds(boundaryPoints),
    dartLength,
    tailLength,
    halfTailSeparation,
    deltaX,
    outerSep,
    rotate,
    tipAngle,
    tailAngle
  };
}

export function dartBorderPoint(geometry = {}, toward = {}, padding = 0) {
  return dartBorderPointFrom(geometry, { x: 0, y: 0 }, toward, padding);
}

export function dartBorderPointFrom(geometry = {}, reference = {}, toward = {}, padding = 0) {
  return polygonBorderPointFrom(geometry.boundaryPoints || [], reference, toward, padding);
}

export function isoscelesTriangleLayoutSize(contentWidth, contentHeight, options = {}) {
  const usesIncircle = options.shapeBorderUsesIncircle === true;
  const rotate = isoscelesTriangleRotation(options.shapeBorderRotate, usesIncircle);
  const swapsAxes = !usesIncircle && (rotate === 90 || rotate === 270);
  let halfContentWidth = Math.max(0, Number(swapsAxes ? contentHeight : contentWidth) || 0) / 2;
  let halfContentHeight = Math.max(0, Number(swapsAxes ? contentWidth : contentHeight) || 0) / 2;
  const apexAngle = normalizedIsoscelesTriangleAngle(options.apexAngle);
  const originalHalfApexAngle = apexAngle / 2;
  const originalHalfApex = degreesToRadians(originalHalfApexAngle);
  let effectiveHalfApexAngle = originalHalfApexAngle;
  let axisLength;
  let halfBase;

  if (usesIncircle) {
    halfContentWidth = Math.SQRT2 * Math.max(halfContentWidth, halfContentHeight);
    halfContentHeight = halfContentWidth;
    axisLength = halfContentWidth + halfContentWidth / safeSine(originalHalfApex);
    halfBase = Math.tan(originalHalfApex) * axisLength;
  } else {
    axisLength = 2 * halfContentWidth + halfContentHeight / safeTangent(originalHalfApex);
    halfBase = Math.tan(originalHalfApex) * (2 * halfContentWidth) + halfContentHeight;
  }

  const minimumSize = Math.max(0, Number(options.minimumSize) || 0);
  const minimumWidth = Math.max(minimumSize, Number(options.minimumWidth) || 0);
  const minimumHeight = Math.max(minimumSize, Number(options.minimumHeight) || 0);
  const stretches = options.stretches === true;
  if (axisLength <= ISOSCELES_TRIANGLE_EPSILON) {
    axisLength = minimumHeight;
  }
  if (halfBase < minimumWidth / 2) {
    halfBase = minimumWidth / 2;
    if (stretches) {
      effectiveHalfApexAngle = Math.atan2(halfBase, Math.max(ISOSCELES_TRIANGLE_EPSILON, axisLength)) * 180 / Math.PI;
    } else {
      axisLength = halfBase / safeTangent(originalHalfApex);
    }
  }
  if (axisLength < minimumHeight) {
    axisLength = minimumHeight;
    if (stretches) {
      effectiveHalfApexAngle = Math.atan2(halfBase, Math.max(ISOSCELES_TRIANGLE_EPSILON, axisLength)) * 180 / Math.PI;
    } else {
      halfBase = Math.tan(originalHalfApex) * axisLength;
    }
  }

  axisLength = Math.max(ISOSCELES_TRIANGLE_EPSILON, axisLength);
  halfBase = Math.max(ISOSCELES_TRIANGLE_EPSILON, halfBase);
  const effectiveHalfApex = degreesToRadians(effectiveHalfApexAngle);
  const baseOffset = usesIncircle
    ? axisLength * Math.sin(effectiveHalfApex) / (1 + Math.sin(effectiveHalfApex))
    : halfContentWidth + (
        (halfBase - halfContentHeight) * Math.cos(effectiveHalfApex) -
        2 * halfContentWidth * Math.sin(effectiveHalfApex)
      ) / (1 + Math.sin(effectiveHalfApex));
  const visibleBoundaryPoints = isoscelesTriangleBoundaryPoints(axisLength, halfBase, baseOffset, rotate);
  const bounds = pointBounds(visibleBoundaryPoints);

  return {
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    minX: bounds.minX,
    minY: bounds.minY,
    maxX: bounds.maxX,
    maxY: bounds.maxY,
    isoscelesTriangleAxisLength: axisLength,
    isoscelesTriangleHalfBase: halfBase,
    isoscelesTriangleBaseOffset: baseOffset,
    isoscelesTriangleApexAngle: apexAngle,
    isoscelesTriangleEffectiveHalfApexAngle: effectiveHalfApexAngle,
    isoscelesTriangleShapeBorderRotate: rotate,
    isoscelesTriangleShapeBorderUsesIncircle: usesIncircle,
    isoscelesTriangleStretches: stretches
  };
}

export function isoscelesTriangleGeometry(size = {}, data = {}) {
  const usesIncircle = data.isoscelesTriangleShapeBorderUsesIncircle === true || data.shapeBorderUsesIncircle === true;
  const rotate = isoscelesTriangleRotation(
    data.isoscelesTriangleShapeBorderRotate ?? data.shapeBorderRotate,
    usesIncircle
  );
  const apexAngle = normalizedIsoscelesTriangleAngle(data.isoscelesTriangleApexAngle ?? data.apexAngle);
  const originalHalfApexAngle = apexAngle / 2;
  const effectiveHalfApexAngle = Number.isFinite(Number(data.isoscelesTriangleEffectiveHalfApexAngle))
    ? Number(data.isoscelesTriangleEffectiveHalfApexAngle)
    : originalHalfApexAngle;
  const swapsAxes = rotate === 90 || rotate === 270;
  const axisLength = finitePositive(
    data.isoscelesTriangleAxisLength,
    Math.max(ISOSCELES_TRIANGLE_EPSILON, Math.abs(Number(swapsAxes ? size.height : size.width) || 0))
  );
  const halfBase = finitePositive(
    data.isoscelesTriangleHalfBase,
    Math.max(ISOSCELES_TRIANGLE_EPSILON, Math.abs(Number(swapsAxes ? size.width : size.height) || 0) / 2)
  );
  const baseOffset = Number.isFinite(Number(data.isoscelesTriangleBaseOffset))
    ? Number(data.isoscelesTriangleBaseOffset)
    : axisLength / 2;
  const outerSep = Math.max(0, Number(data.isoscelesTriangleOuterSep) || 0);
  const visibleBoundaryPoints = isoscelesTriangleBoundaryPoints(axisLength, halfBase, baseOffset, rotate);
  const visibleAnchors = isoscelesTriangleVertexAnchors(visibleBoundaryPoints);
  const originalHalfApex = degreesToRadians(originalHalfApexAngle);
  const cornerAngle = degreesToRadians((90 - effectiveHalfApexAngle) / 2);
  const cornerExtension = outerSep / safeTangent(cornerAngle);
  const boundaryPoints = [
    { x: axisLength - baseOffset + outerSep / safeSine(originalHalfApex), y: 0 },
    { x: -baseOffset - outerSep, y: halfBase + cornerExtension },
    { x: -baseOffset - outerSep, y: -halfBase - cornerExtension }
  ].map((point) => rotatePoint(point, rotate));
  const anchors = isoscelesTriangleVertexAnchors(boundaryPoints);
  anchors["left side"] = midpoint(anchors["left corner"], anchors.apex);
  anchors["right side"] = midpoint(anchors["right corner"], anchors.apex);
  anchors["lower side"] = midpoint(anchors["left corner"], anchors["right corner"]);
  anchors.center = { x: 0, y: 0 };
  anchors.text = anchors.center;
  anchors.base = { x: 0, y: Number(data.isoscelesTriangleBaseTextOffset) || 0 };
  anchors.mid = { x: 0, y: Number(data.isoscelesTriangleMidOffset) || 0 };
  const borderGeometry = { boundaryPoints };
  anchors["base east"] = isoscelesTriangleBorderPointFrom(borderGeometry, anchors.base, { x: 1, y: 0 });
  anchors["base west"] = isoscelesTriangleBorderPointFrom(borderGeometry, anchors.base, { x: -1, y: 0 });
  anchors["mid east"] = isoscelesTriangleBorderPointFrom(borderGeometry, anchors.mid, { x: 1, y: 0 });
  anchors["mid west"] = isoscelesTriangleBorderPointFrom(borderGeometry, anchors.mid, { x: -1, y: 0 });
  for (const [name, direction] of Object.entries(COMPASS_DIRECTIONS)) {
    anchors[name] = isoscelesTriangleBorderPoint(borderGeometry, direction);
  }

  return {
    outlineCommands: polygonCommands(visibleBoundaryPoints),
    boundaryPoints,
    visibleBoundaryPoints,
    anchors,
    visibleAnchors,
    bounds: pointBounds(visibleBoundaryPoints),
    anchorBounds: pointBounds(boundaryPoints),
    axisLength,
    halfBase,
    baseOffset,
    outerSep,
    rotate,
    apexAngle,
    effectiveHalfApexAngle
  };
}

export function isoscelesTriangleBorderPoint(geometry = {}, toward = {}, padding = 0) {
  return isoscelesTriangleBorderPointFrom(geometry, { x: 0, y: 0 }, toward, padding);
}

export function isoscelesTriangleBorderPointFrom(geometry = {}, reference = {}, toward = {}, padding = 0) {
  return polygonBorderPointFrom(geometry.boundaryPoints || [], reference, toward, padding);
}

export function kiteLayoutSize(contentWidth, contentHeight, options = {}) {
  const usesIncircle = options.shapeBorderUsesIncircle === true;
  const rotate = kiteRotation(options.shapeBorderRotate, usesIncircle);
  const swapsAxes = !usesIncircle && (rotate === 90 || rotate === 270);
  const halfContentWidth = Math.max(0, Number(swapsAxes ? contentHeight : contentWidth) || 0) / 2;
  const halfContentHeight = Math.max(0, Number(swapsAxes ? contentWidth : contentHeight) || 0) / 2;
  const upperVertexAngle = normalizedKiteAngle(options.upperVertexAngle, 120);
  const lowerVertexAngle = normalizedKiteAngle(options.lowerVertexAngle, 60);
  const upperHalfAngle = degreesToRadians(upperVertexAngle / 2);
  const lowerHalfAngle = degreesToRadians(lowerVertexAngle / 2);
  let halfWidth;
  let height;
  let depth;
  let deltaY;

  if (usesIncircle) {
    const incircleRadius = Math.SQRT2 * Math.max(halfContentWidth, halfContentHeight);
    const upperDistance = incircleRadius / safeSine(upperHalfAngle);
    const lowerDistance = incircleRadius / safeSine(lowerHalfAngle);
    deltaY = upperDistance - (
      incircleRadius * Math.cos(upperHalfAngle) *
      (Math.sin(upperHalfAngle) + Math.sin(lowerHalfAngle)) /
      (safeSine(upperHalfAngle) * safeSine(upperHalfAngle + lowerHalfAngle))
    );
    height = upperDistance - deltaY;
    depth = lowerDistance + deltaY;
    halfWidth = Math.tan(upperHalfAngle) * height;
  } else {
    const contentWidthValue = halfContentWidth * 2;
    const contentHeightValue = halfContentHeight * 2;
    const upperContentHeight = contentHeightValue * Math.cos(upperHalfAngle) *
      Math.sin(lowerHalfAngle) / safeSine(upperHalfAngle + lowerHalfAngle);
    const lowerContentHeight = contentHeightValue - upperContentHeight;
    deltaY = contentHeightValue / 2 - upperContentHeight;
    halfWidth = halfContentWidth + Math.tan(upperHalfAngle) * upperContentHeight;
    height = upperContentHeight + halfContentWidth / safeTangent(upperHalfAngle);
    depth = lowerContentHeight + halfContentWidth / safeTangent(lowerHalfAngle);
  }

  const minimumSize = Math.max(0, Number(options.minimumSize) || 0);
  const minimumHeight = Math.max(minimumSize, Number(options.minimumHeight) || 0);
  const minimumWidth = Math.max(minimumSize, Number(options.minimumWidth) || 0);
  const naturalHeight = Math.max(KITE_EPSILON, height + depth);
  if (naturalHeight < minimumHeight) {
    const scale = minimumHeight / naturalHeight;
    halfWidth *= scale;
    height *= scale;
    depth *= scale;
  }
  const naturalWidth = Math.max(KITE_EPSILON, halfWidth * 2);
  if (naturalWidth < minimumWidth) {
    const scale = minimumWidth / naturalWidth;
    halfWidth *= scale;
    height *= scale;
    depth *= scale;
  }

  const visibleBoundaryPoints = kiteBoundaryPoints(halfWidth, height, depth, deltaY, rotate);
  const bounds = pointBounds(visibleBoundaryPoints);
  return {
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    minX: bounds.minX,
    minY: bounds.minY,
    maxX: bounds.maxX,
    maxY: bounds.maxY,
    kiteHalfWidth: halfWidth,
    kiteHeight: height,
    kiteDepth: depth,
    kiteDeltaY: deltaY,
    kiteUpperVertexAngle: upperVertexAngle,
    kiteLowerVertexAngle: lowerVertexAngle,
    kiteShapeBorderRotate: rotate,
    kiteShapeBorderUsesIncircle: usesIncircle
  };
}

export function kiteGeometry(size = {}, data = {}) {
  const usesIncircle = data.kiteShapeBorderUsesIncircle === true || data.shapeBorderUsesIncircle === true;
  const rotate = kiteRotation(data.kiteShapeBorderRotate ?? data.shapeBorderRotate, usesIncircle);
  const upperVertexAngle = normalizedKiteAngle(data.kiteUpperVertexAngle, 120);
  const lowerVertexAngle = normalizedKiteAngle(data.kiteLowerVertexAngle, 60);
  const upperHalfAngle = degreesToRadians(upperVertexAngle / 2);
  const lowerHalfAngle = degreesToRadians(lowerVertexAngle / 2);
  const swapsAxes = !usesIncircle && (rotate === 90 || rotate === 270);
  const inferredHalfWidth = Math.max(KITE_EPSILON, Math.abs(Number(swapsAxes ? size.height : size.width) || 0) / 2);
  const inferredHalfHeight = Math.max(KITE_EPSILON, Math.abs(Number(swapsAxes ? size.width : size.height) || 0) / 2);
  const halfWidth = finitePositive(data.kiteHalfWidth, inferredHalfWidth);
  const height = finitePositive(data.kiteHeight, inferredHalfHeight);
  const depth = finitePositive(data.kiteDepth, inferredHalfHeight);
  const deltaY = Number.isFinite(Number(data.kiteDeltaY)) ? Number(data.kiteDeltaY) : 0;
  const outerSep = Math.max(0, Number(data.kiteOuterSep) || 0);
  const visibleBoundaryPoints = kiteBoundaryPoints(halfWidth, height, depth, deltaY, rotate);
  const visibleAnchors = kiteVertexAnchors(visibleBoundaryPoints);

  const sideMiterLength = outerSep / safeSine(
    degreesToRadians((180 - upperVertexAngle / 2 - lowerVertexAngle / 2) / 2)
  );
  const sideMiterAngle = degreesToRadians((upperVertexAngle / 2 - lowerVertexAngle / 2) / 2);
  const unrotatedAnchorPoints = [
    { x: 0, y: deltaY + height + outerSep / safeSine(upperHalfAngle) },
    {
      x: -halfWidth - Math.cos(sideMiterAngle) * sideMiterLength,
      y: deltaY + Math.sin(sideMiterAngle) * sideMiterLength
    },
    { x: 0, y: deltaY - depth - outerSep / safeSine(lowerHalfAngle) },
    {
      x: halfWidth + Math.cos(sideMiterAngle) * sideMiterLength,
      y: deltaY + Math.sin(sideMiterAngle) * sideMiterLength
    }
  ];
  const boundaryPoints = unrotatedAnchorPoints.map((point) => rotatePoint(point, rotate));
  const anchors = kiteVertexAnchors(boundaryPoints);
  anchors["upper left side"] = midpoint(anchors["upper vertex"], anchors["left vertex"]);
  anchors["lower left side"] = midpoint(anchors["lower vertex"], anchors["left vertex"]);
  anchors["upper right side"] = midpoint(anchors["upper vertex"], anchors["right vertex"]);
  anchors["lower right side"] = midpoint(anchors["lower vertex"], anchors["right vertex"]);
  anchors.center = { x: 0, y: 0 };
  anchors.base = { x: 0, y: Number(data.kiteBaseOffset) || 0 };
  anchors.mid = { x: 0, y: Number(data.kiteMidOffset) || 0 };
  const borderGeometry = { boundaryPoints };
  anchors["base east"] = kiteBorderPointFrom(borderGeometry, anchors.base, { x: 1, y: 0 });
  anchors["base west"] = kiteBorderPointFrom(borderGeometry, anchors.base, { x: -1, y: 0 });
  anchors["mid east"] = kiteBorderPointFrom(borderGeometry, anchors.mid, { x: 1, y: 0 });
  anchors["mid west"] = kiteBorderPointFrom(borderGeometry, anchors.mid, { x: -1, y: 0 });
  for (const [name, direction] of Object.entries(COMPASS_DIRECTIONS)) {
    anchors[name] = kiteBorderPoint(borderGeometry, direction);
  }

  return {
    outlineCommands: polygonCommands(visibleBoundaryPoints),
    boundaryPoints,
    visibleBoundaryPoints,
    anchors,
    visibleAnchors,
    bounds: pointBounds(visibleBoundaryPoints),
    anchorBounds: pointBounds(boundaryPoints),
    halfWidth,
    height,
    depth,
    deltaY,
    outerSep,
    rotate,
    upperVertexAngle,
    lowerVertexAngle
  };
}

export function kiteBorderPoint(geometry = {}, toward = {}, padding = 0) {
  return kiteBorderPointFrom(geometry, { x: 0, y: 0 }, toward, padding);
}

export function kiteBorderPointFrom(geometry = {}, reference = {}, toward = {}, padding = 0) {
  return polygonBorderPointFrom(geometry.boundaryPoints || [], reference, toward, padding);
}

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
  const usesIncircle = options.shapeBorderUsesIncircle === true;
  const rotate = trapeziumRotation(options.shapeBorderRotate, usesIncircle);
  const swapsAxes = !usesIncircle && (rotate === 90 || rotate === 270);
  let bodyHalfWidth = Math.max(0, Number(swapsAxes ? contentHeight : contentWidth) || 0) / 2;
  let halfHeight = Math.max(
    TRAPEZIUM_EPSILON,
    Math.max(0, Number(swapsAxes ? contentWidth : contentHeight) || 0) / 2
  );
  if (usesIncircle) {
    bodyHalfWidth = Math.SQRT2 * Math.max(bodyHalfWidth, halfHeight);
    halfHeight = bodyHalfWidth;
  }
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

  const visibleBoundaryPoints = trapeziumBoundaryPoints(
    bodyHalfWidth,
    halfHeight,
    leftExtension,
    rightExtension,
    rotate
  );
  const bounds = pointBounds(visibleBoundaryPoints);
  return {
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    minX: bounds.minX,
    minY: bounds.minY,
    maxX: bounds.maxX,
    maxY: bounds.maxY,
    trapeziumBodyHalfWidth: bodyHalfWidth,
    trapeziumHalfHeight: halfHeight,
    trapeziumLeftExtension: leftExtension,
    trapeziumRightExtension: rightExtension,
    trapeziumShapeBorderRotate: rotate,
    trapeziumShapeBorderUsesIncircle: usesIncircle
  };
}

export function trapeziumNodePoints(center, halfWidth, halfHeight, data = {}) {
  const geometry = trapeziumGeometry(
    { width: Math.max(0, Number(halfWidth) || 0) * 2, height: Math.max(0, Number(halfHeight) || 0) * 2 },
    data
  );
  const x = Number(center?.x) || 0;
  const y = Number(center?.y) || 0;
  return geometry.visibleBoundaryPoints.map((point) => ({ x: x + point.x, y: y + point.y }));
}

export function trapeziumGeometry(size = {}, data = {}) {
  const usesIncircle = data.trapeziumShapeBorderUsesIncircle === true || data.shapeBorderUsesIncircle === true;
  const rotate = trapeziumRotation(
    data.trapeziumShapeBorderRotate ?? data.shapeBorderRotate,
    usesIncircle
  );
  const storedHeight = Number(data.trapeziumHalfHeight);
  const height = Number.isFinite(storedHeight)
    ? Math.max(TRAPEZIUM_EPSILON, Math.abs(storedHeight))
    : Math.max(TRAPEZIUM_EPSILON, Math.abs(Number(size.height) || 0) / 2);
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
    : Math.max(0, Math.abs(Number(size.width) || 0) / 2 - (Math.abs(leftExtension) + Math.abs(rightExtension)) / 2);
  const visibleBoundaryPoints = trapeziumBoundaryPoints(
    bodyHalfWidth,
    height,
    leftExtension,
    rightExtension,
    rotate
  );
  const outerSep = Math.max(0, Number(data.trapeziumOuterSep) || 0);
  const boundaryPoints = outerSep > TRAPEZIUM_EPSILON
    ? polygonMiterOffsetPoints(visibleBoundaryPoints, outerSep)
    : visibleBoundaryPoints.map((point) => ({ ...point }));
  const anchors = {
    "bottom left corner": boundaryPoints[0],
    "top left corner": boundaryPoints[1],
    "top right corner": boundaryPoints[2],
    "bottom right corner": boundaryPoints[3],
    "left side": midpoint(boundaryPoints[0], boundaryPoints[1]),
    "top side": midpoint(boundaryPoints[1], boundaryPoints[2]),
    "right side": midpoint(boundaryPoints[2], boundaryPoints[3]),
    "bottom side": midpoint(boundaryPoints[3], boundaryPoints[0]),
    center: { x: 0, y: 0 },
    text: { x: 0, y: 0 },
    base: { x: 0, y: Number(data.trapeziumBaseOffset) || 0 },
    mid: { x: 0, y: Number(data.trapeziumMidOffset) || 0 }
  };
  const borderGeometry = { boundaryPoints };
  anchors["base east"] = trapeziumBorderPointFrom(borderGeometry, anchors.base, { x: 1, y: 0 });
  anchors["base west"] = trapeziumBorderPointFrom(borderGeometry, anchors.base, { x: -1, y: 0 });
  anchors["mid east"] = trapeziumBorderPointFrom(borderGeometry, anchors.mid, { x: 1, y: 0 });
  anchors["mid west"] = trapeziumBorderPointFrom(borderGeometry, anchors.mid, { x: -1, y: 0 });
  for (const [name, direction] of Object.entries(COMPASS_DIRECTIONS)) {
    anchors[name] = trapeziumBorderPoint(borderGeometry, direction);
  }

  return {
    outlineCommands: polygonCommands(visibleBoundaryPoints),
    visibleBoundaryPoints,
    boundaryPoints,
    anchors,
    visibleAnchors: {
      "bottom left corner": visibleBoundaryPoints[0],
      "top left corner": visibleBoundaryPoints[1],
      "top right corner": visibleBoundaryPoints[2],
      "bottom right corner": visibleBoundaryPoints[3]
    },
    bounds: pointBounds(visibleBoundaryPoints),
    anchorBounds: pointBounds(boundaryPoints),
    bodyHalfWidth,
    halfHeight: height,
    leftExtension,
    rightExtension,
    outerSep,
    rotate,
    usesIncircle
  };
}

export function trapeziumBorderPoint(geometry = {}, toward = {}, padding = 0) {
  return trapeziumBorderPointFrom(geometry, { x: 0, y: 0 }, toward, padding);
}

export function trapeziumBorderPointFrom(geometry = {}, reference = {}, toward = {}, padding = 0) {
  return polygonBorderPointFrom(geometry.boundaryPoints || [], reference, toward, padding);
}

function trapeziumBoundaryPoints(bodyHalfWidth, halfHeight, leftExtension, rightExtension, rotate) {
  return [
    { x: -bodyHalfWidth - Math.max(0, leftExtension), y: -halfHeight },
    { x: -bodyHalfWidth + Math.min(0, leftExtension), y: halfHeight },
    { x: bodyHalfWidth - Math.min(0, rightExtension), y: halfHeight },
    { x: bodyHalfWidth + Math.max(0, rightExtension), y: -halfHeight }
  ].map((point) => rotatePoint(point, rotate));
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

function trapeziumRotation(rawRotation, usesIncircle = false) {
  const value = Number(rawRotation);
  const normalized = Number.isFinite(value) ? ((value % 360) + 360) % 360 : 0;
  return usesIncircle ? normalized : (Math.round(normalized / 90) * 90) % 360;
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

function kiteRotation(rawRotation, usesIncircle = false) {
  const value = Number(rawRotation);
  const normalized = Number.isFinite(value) ? ((value % 360) + 360) % 360 : 0;
  return usesIncircle ? normalized : (Math.round(normalized / 90) * 90) % 360;
}

function dartRotation(rawRotation, usesIncircle = false) {
  const value = Number(rawRotation);
  const normalized = Number.isFinite(value) ? ((value % 360) + 360) % 360 : 0;
  return usesIncircle ? normalized : (Math.round(normalized / 90) * 90) % 360;
}

function circularSectorRotation(rawRotation, usesIncircle = false) {
  const value = Number(rawRotation);
  const normalized = Number.isFinite(value) ? ((value % 360) + 360) % 360 : 0;
  return usesIncircle ? normalized : (Math.round(normalized / 90) * 90) % 360;
}

function normalizedCircularSectorAngle(rawAngle) {
  const value = Number(rawAngle);
  if (!Number.isFinite(value)) return 60;
  const normalized = ((value % 360) + 360) % 360;
  return Math.max(0.01, Math.min(359.99, normalized || 0.01));
}

function normalizedDartAngle(rawAngle, fallback) {
  const value = Number(rawAngle);
  return Number.isFinite(value)
    ? Math.max(0.01, Math.min(179.99, value))
    : fallback;
}

function normalizedKiteAngle(rawAngle, fallback) {
  const value = Number(rawAngle);
  return Number.isFinite(value)
    ? Math.max(0.01, Math.min(179.99, value))
    : fallback;
}

function normalizedIsoscelesTriangleAngle(rawAngle) {
  const value = Number(rawAngle);
  return Number.isFinite(value)
    ? Math.max(0.01, Math.min(179.99, value))
    : 45;
}

function degreesToRadians(degrees) {
  return degrees * Math.PI / 180;
}

function safeSine(angle) {
  const sine = Math.sin(angle);
  if (Math.abs(sine) >= KITE_EPSILON) return sine;
  return sine < 0 ? -KITE_EPSILON : KITE_EPSILON;
}

function safeTangent(angle) {
  const tangent = Math.tan(angle);
  if (Math.abs(tangent) >= KITE_EPSILON) return tangent;
  return tangent < 0 ? -KITE_EPSILON : KITE_EPSILON;
}

function safeCosine(angle) {
  const cosine = Math.cos(angle);
  if (Math.abs(cosine) >= CIRCULAR_SECTOR_EPSILON) return cosine;
  return cosine < 0 ? -CIRCULAR_SECTOR_EPSILON : CIRCULAR_SECTOR_EPSILON;
}

function pointOnCircle(center, radius, degrees) {
  const angle = degreesToRadians(degrees);
  return {
    x: (Number(center?.x) || 0) + radius * Math.cos(angle),
    y: (Number(center?.y) || 0) + radius * Math.sin(angle)
  };
}

function circularSectorExtremaPoints(centerOffset, radius, sectorAngle, rotate) {
  const startAngle = 180 - sectorAngle / 2;
  const center = { x: centerOffset, y: 0 };
  const angles = [startAngle, startAngle + sectorAngle];
  for (const globalCardinal of [0, 90, 180, 270]) {
    const localAngle = normalizeDegrees(globalCardinal - rotate);
    if (angleInSweep(localAngle, startAngle, sectorAngle)) angles.push(localAngle);
  }
  return [
    rotatePoint(center, rotate),
    ...angles.map((angle) => rotatePoint(pointOnCircle(center, radius, angle), rotate))
  ];
}

function circularSectorAnchorBoundaryPoints(data) {
  const startAngle = 180 - data.sectorAngle / 2;
  const center = { x: data.centerOffset, y: 0 };
  const points = [
    data.sectorCenterBorderLocal,
    data.arcStartCornerLocal,
    ...circularArcExtremaPoints(center, data.anchorRadius, startAngle, data.sectorAngle, data.rotate),
    data.arcEndCornerLocal
  ];
  return points.map((point) => rotatePoint(point, data.rotate));
}

function circularArcExtremaPoints(center, radius, startAngle, sweep, rotate) {
  const angles = [startAngle, startAngle + sweep];
  for (const globalCardinal of [0, 90, 180, 270]) {
    const localAngle = normalizeDegrees(globalCardinal - rotate);
    if (angleInSweep(localAngle, startAngle, sweep)) angles.push(localAngle);
  }
  return angles.map((angle) => pointOnCircle(center, radius, angle));
}

function rayCircularSectorIntersection(origin, direction, center, radius, startAngle, sweep) {
  const ox = origin.x - center.x;
  const oy = origin.y - center.y;
  const a = direction.x * direction.x + direction.y * direction.y;
  if (a < CIRCULAR_SECTOR_EPSILON) return null;
  const b = 2 * (ox * direction.x + oy * direction.y);
  const c = ox * ox + oy * oy - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < -CIRCULAR_SECTOR_EPSILON) return null;
  const root = Math.sqrt(Math.max(0, discriminant));
  const candidates = [(-b - root) / (2 * a), (-b + root) / (2 * a)]
    .filter((t) => t >= -CIRCULAR_SECTOR_EPSILON)
    .sort((left, right) => left - right);
  for (const t of candidates) {
    const x = direction.x * t;
    const y = direction.y * t;
    const angle = normalizeDegrees(Math.atan2(origin.y + y - center.y, origin.x + x - center.x) * 180 / Math.PI);
    if (angleInSweep(angle, startAngle, sweep)) return { t, x, y };
  }
  return null;
}

function angleInSweep(angle, start, sweep) {
  const distance = normalizeDegrees(angle - start);
  return distance <= sweep + 1e-7;
}

function normalizeDegrees(degrees) {
  return ((degrees % 360) + 360) % 360;
}

function kiteBoundaryPoints(halfWidth, height, depth, deltaY, rotate) {
  return [
    { x: 0, y: deltaY + height },
    { x: -halfWidth, y: deltaY },
    { x: 0, y: deltaY - depth },
    { x: halfWidth, y: deltaY }
  ].map((point) => rotatePoint(point, rotate));
}

function kiteVertexAnchors(points) {
  return {
    "upper vertex": points[0],
    "left vertex": points[1],
    "lower vertex": points[2],
    "right vertex": points[3]
  };
}

function dartBoundaryPoints(dartLength, tailLength, halfTailSeparation, deltaX, rotate) {
  return [
    { x: dartLength - deltaX, y: 0 },
    { x: -deltaX - tailLength, y: halfTailSeparation },
    { x: -deltaX, y: 0 },
    { x: -deltaX - tailLength, y: -halfTailSeparation }
  ].map((point) => rotatePoint(point, rotate));
}

function isoscelesTriangleBoundaryPoints(axisLength, halfBase, baseOffset, rotate) {
  return [
    { x: axisLength - baseOffset, y: 0 },
    { x: -baseOffset, y: halfBase },
    { x: -baseOffset, y: -halfBase }
  ].map((point) => rotatePoint(point, rotate));
}

function isoscelesTriangleVertexAnchors(points) {
  return {
    apex: points[0],
    "left corner": points[1],
    "right corner": points[2]
  };
}

function dartVertexAnchors(points) {
  return {
    tip: points[0],
    "left tail": points[1],
    "tail center": points[2],
    "right tail": points[3]
  };
}

function midpoint(first, second) {
  return {
    x: ((Number(first?.x) || 0) + (Number(second?.x) || 0)) / 2,
    y: ((Number(first?.y) || 0) + (Number(second?.y) || 0)) / 2
  };
}

function polygonCommands(points) {
  if (!points.length) return [];
  return [
    { type: "moveTo", ...points[0] },
    ...points.slice(1).map((point) => ({ type: "lineTo", ...point })),
    { type: "closePath" }
  ];
}

function polygonBorderPointFrom(points, reference = {}, toward = {}, padding = 0) {
  const originX = Number(reference.x) || 0;
  const originY = Number(reference.y) || 0;
  const dx = Number(toward.x) || 0;
  const dy = Number(toward.y) || 0;
  const distance = Math.hypot(dx, dy);
  if (distance < KITE_EPSILON) return { x: originX, y: originY };
  let best = null;
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
    x: base.x + dx / distance * extension,
    y: base.y + dy / distance * extension
  };
}

function polygonMiterOffsetPoints(points, distance) {
  if (!Array.isArray(points) || points.length < 3 || distance <= TRAPEZIUM_EPSILON) return points;
  const clockwise = polygonSignedArea(points) < 0;
  return points.map((vertex, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const previousEdge = { x: vertex.x - previous.x, y: vertex.y - previous.y };
    const nextEdge = { x: next.x - vertex.x, y: next.y - vertex.y };
    const previousNormal = polygonOutwardNormal(previousEdge, clockwise);
    const nextNormal = polygonOutwardNormal(nextEdge, clockwise);
    if (!previousNormal || !nextNormal) return { ...vertex };
    const previousOffset = {
      x: vertex.x + previousNormal.x * distance,
      y: vertex.y + previousNormal.y * distance
    };
    const nextOffset = {
      x: vertex.x + nextNormal.x * distance,
      y: vertex.y + nextNormal.y * distance
    };
    return lineIntersection(previousOffset, previousEdge, nextOffset, nextEdge) || { ...vertex };
  });
}

function polygonSignedArea(points) {
  let twiceArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    twiceArea += current.x * next.y - next.x * current.y;
  }
  return twiceArea / 2;
}

function polygonOutwardNormal(edge, clockwise) {
  const length = Math.hypot(edge.x, edge.y);
  if (length <= TRAPEZIUM_EPSILON) return null;
  return clockwise
    ? { x: -edge.y / length, y: edge.x / length }
    : { x: edge.y / length, y: -edge.x / length };
}

function lineIntersection(firstPoint, firstDirection, secondPoint, secondDirection) {
  const denominator = firstDirection.x * secondDirection.y - firstDirection.y * secondDirection.x;
  if (Math.abs(denominator) <= TRAPEZIUM_EPSILON) return null;
  const delta = { x: secondPoint.x - firstPoint.x, y: secondPoint.y - firstPoint.y };
  const t = (delta.x * secondDirection.y - delta.y * secondDirection.x) / denominator;
  return {
    x: firstPoint.x + firstDirection.x * t,
    y: firstPoint.y + firstDirection.y * t
  };
}

function semicircleRotation(rawRotation, usesIncircle = false) {
  const value = Number(rawRotation);
  const normalized = Number.isFinite(value) ? ((value % 360) + 360) % 360 : 0;
  return usesIncircle ? normalized : (Math.round(normalized / 90) * 90) % 360;
}

function isoscelesTriangleRotation(rawRotation, usesIncircle = false) {
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
    "src/engine/evaluate.js:diamondLayoutSize/nodeShapeData/estimateNodeAnchorSize/nodeBorderPoint/diamondAnchorCoordinate",
    "src/engine/evaluate.js:regularPolygonLayoutSize/regularPolygonStartAngle/regularPolygonOuterRadiusExtension/nodeBorderPoint/polygonBorderPointWithPadding/trapeziumLayoutShapeData/isoscelesTriangleLayoutSize/isoscelesTriangleLayoutShapeData/customNodeLocalAnchor",
    "src/tikz/libraries/shapes.geometric.js:diamondLayoutSize/diamondGeometry/diamondBorderPoint",
    "src/tikz/libraries/shapes.geometric.js:starLayoutSize/starNodePoints/starGeometry/starBorderPoint/trapeziumLayoutSize/trapeziumNodePoints/trapeziumGeometry/trapeziumBorderPoint/trapeziumBorderPointFrom",
    "src/tikz/libraries/shapes.geometric.js:cylinderLayoutSize/cylinderGeometry/cylinderBorderPoint/cylinderBorderPointFrom",
    "src/tikz/libraries/shapes.geometric.js:semicircleLayoutSize/semicircleGeometry/semicircleBorderPoint/semicircleBorderPointFrom",
    "src/tikz/libraries/shapes.geometric.js:circularSectorLayoutSize/circularSectorGeometry/circularSectorBorderPoint/circularSectorBorderPointFrom",
    "src/tikz/libraries/shapes.geometric.js:kiteLayoutSize/kiteGeometry/kiteBorderPoint/kiteBorderPointFrom",
    "src/tikz/libraries/shapes.geometric.js:dartLayoutSize/dartGeometry/dartBorderPoint/dartBorderPointFrom",
    "src/tikz/libraries/shapes.geometric.js:isoscelesTriangleLayoutSize/isoscelesTriangleGeometry/isoscelesTriangleBorderPoint/isoscelesTriangleBorderPointFrom",
    "src/renderers/svg/nodeShapes.js:renderDiamondNodeBox/regularPolygonNodePoints/starNodePoints/renderCylinderNodeBox/renderLibraryNodeBox",
    "src/renderers/svg/bounds.js:nodeBounds"
  ],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex",
  "localSourceReviewed": true,
  "features": [
    "diamond with PGF aspect/minimum sizing, separate visible and outer-separation contours, complete compass/numeric anchors, and exact border clipping",
    "regular polygon with PGF circumcircle sizing, odd/even orientation, rotation, and border crop",
    "star with PGF radius modes, minimum sizing, border rotation, mitered outer separation, and named inner/outer point anchors",
    "trapezium with PGF cotangent side geometry, proportional/independent/body-only minimum-size stretching, rounded quarter-turn or exact incircle border rotation, complete named/compass/numeric anchors, and mitered border crop",
    "isosceles triangle with PGF content/incircle sizing, linked or independently stretched minimum dimensions, shifted text center, rounded or exact border rotation, complete named/compass/numeric anchors, and mitered outer-separation clipping",
    "cylinder with PGF quarter-turn border rotation, aspect/minimum sizing, complete end/mid/base named anchors, curved outer-separation border clipping, and separate body/end fills",
    "semicircle with PGF content/minimum sizing, shifted circle center, quarter-turn border rotation, named arc/chord/base/mid anchors, curved outer-separation clipping, and cubic arc paint",
    "circular sector with PGF content/incircle and minimum sizing, rounded or exact border rotation, separate visible and outer-separation contours, named/compass/numeric anchors, and exact curved border clipping",
    "kite with independent upper/lower vertex angles, PGF content/minimum sizing, quarter-turn and incircle rotation, mitered outer-separation anchors, and exact polygon clipping",
    "dart with independent tip/tail angles, PGF content/minimum sizing, concave paint geometry, quarter-turn and incircle rotation, complete mitered anchors, and exact border clipping"
  ],
  "implements": [
    "diamond",
    "regular polygon",
    "star",
    "trapezium",
    "isosceles triangle",
    "cylinder",
    "semicircle",
    "circular sector",
    "kite",
    "dart"
  ],
  "notes": "Reviewed locally on 2026-08-07 against pgflibraryshapes.geometric.code.tex and the PGF shapes manual. Regular polygons use the source's sqrt(2)*apothem*sec(180/sides) content radius, circumcircle minimum size, odd/even orientation, `shape border rotate`/`regular polygon rotate`, and the outer-separation mitre extension used by curved terminal arrows. The permanent visual driver is arrows/regular-polygon-curved-terminal.tex. Stars now share PGF's max-content-radius, sqrt(2) inner-radius, ratio/point-height outer-radius, largest-minimum-diameter, and `star rotate` construction across layout, clipping, and SVG paint; arrows-shape-curved-terminal-padding is the visual driver. The default trapezium follows `\\installtrapeziumparameters`: side extensions are 2*half-height*cot(angle), minimum width/height preserve that construction by uniform scaling, and curve terminal rays intersect the mitered offset contour rather than an arbitrary adjacent side. `test/fixtures/arrows/shape-curved-terminal-miters.tex` is the visual regression. Reviewed again on 2026-09-04 for the cylinder declaration at lines 4019-4475 and the manual cylinder section: the end ellipse uses `shape aspect`, quarter-turn border rotation swaps the content axes, minimum width expands only the cross radius after the natural end radius has been fixed, and minimum height extends the body. TikZKit now shares this geometry across layout, paint, bounding boxes, named anchors, and border clipping, with independent body/end fill paths. The permanent drivers are `shapes/cylinder-manual-catalog.tex`, `shapes/cylinder-data-flow.tex`, and `shapes/cylinder-volume-physics.tex`. Reviewed again on 2026-09-04 for the trapezium declaration and manual examples: `trapezium stretches` keeps the final width and height independent while `trapezium stretches body` adds a minimum-width deficit only to the body half-width, preserving the previously computed side extensions. The final geometry record is shared by SVG paint, mitered outer-separation anchors, named side/corner anchors, and arrow border clipping. Permanent flowchart, mathematics, and physics drivers and three-way evidence are recorded in `docs/qa/2026-09-04-shapes-trapezium-stretches.md`. Reviewed again on 2026-09-04 for the star declaration at lines 349-667: visible star paint retains the content radii, while named points, compass anchors, positioning bounds, and automatic edge clipping share the source's independently mitered inner and outer anchor radii. The miter extension is outer separation multiplied by the cosecant of each vertex half angle. Permanent three-way flowchart, mathematics, and physics evidence is recorded in `docs/qa/2026-09-04-shapes-star-anchors.md`. Reviewed again on 2026-09-04 for cylinder anchors at lines 4120-4412: before/after anchors apply outer y separation before quarter rotation, top/bottom use the expanded end radius, and mid/base east/west cast rays from the TeX midline or baseline to the rotated cylinder boundary. TikZKit now keeps a visible paint boundary separate from the outer-separation anchor boundary and uses the latter for named anchors, node placement, and automatic clipping. Permanent flowchart, mathematics, and physics evidence is recorded in `docs/qa/2026-09-04-shapes-cylinder-anchors.md`. Reviewed again on 2026-09-04 for the semicircle declaration at lines 1523-1980 and its manual section: natural radius is hypot(half content width, twice the half content height), minimum width constrains the diameter, minimum height constrains the radius, and the circular center shifts away from the text center as the minimum radius grows. Quarter-turn rotation swaps content axes; paint uses the visible arc and chord while named anchors and automatic clipping use the outer-separation contour. Permanent flowchart, mathematics, and physics evidence is recorded in `docs/qa/2026-09-04-shapes-geometric-semicircle.md`. Reviewed again on 2026-09-04 for the kite declaration at lines 2343-2995 and the corresponding manual section: upper and lower vertex angles independently split the text height, minimum dimensions uniformly scale the four radii, ordinary border rotation is quarter-rounded, and incircle mode permits exact arbitrary rotation. Painted vertices remain separate from the cosecant-expanded miter anchors used by named anchors, positioning, and automatic clipping. Permanent flowchart, mathematics, and physics evidence is recorded in `docs/qa/2026-09-04-shapes-geometric-kite.md`. Reviewed again on 2026-09-04 for the dart declaration at lines 2995-3540 and its manual section: the tip and tail half angles derive the axial tip length, tail separation, total length, and concave tail depth; minimum height and width scale every derived dimension uniformly. Ordinary rotation is quarter-rounded, while incircle mode preserves an exact arbitrary angle. Paint uses the visible four-point concave polygon, while named, compass, base/mid, numeric, positioning, and automatic clipping anchors use the independently cosecant-expanded miter contour. Permanent flowchart, mathematics, and physics evidence is recorded in `docs/qa/2026-09-04-shapes-geometric-dart.md`. Reviewed again on 2026-09-04 for the circular sector declaration at lines 3542-4019 and its manual section: half-angle cosecant/cotangent formulas place the sector circle center away from the text center, minimum dimensions scale the center offset and radius together, ordinary rotation is quarter-rounded, and incircle mode preserves arbitrary rotation. Paint uses the visible sector, while named, compass, numeric, positioning, and automatic clipping anchors use the separately mitered outer contour and exact arc intersection. Permanent flowchart, mathematics, and physics evidence is recorded in `docs/qa/2026-09-04-shapes-geometric-circular-sector.md`. Reviewed again on 2026-09-04 for the isosceles triangle declaration at lines 1985-2343 and its manual section: content half-extents derive the apex axis and half-base, the text center remains offset from the geometric center, non-stretch minimum dimensions preserve the apex angle, and `isosceles triangle stretches` recomputes the effective half-angle after independent minimum changes. Ordinary border rotation is quarter-rounded; incircle mode permits exact rotation. Paint uses the visible triangle, while complete named, compass, base/mid, numeric, positioning, and automatic clipping anchors use the separately mitered outer contour. Permanent flowchart, mathematics, and physics evidence is recorded in `docs/qa/2026-09-04-shapes-isosceles-triangle.md`. Reviewed again on 2026-09-04 for the ordinary diamond declaration at lines 234-376 and its manual section: `aspect` combines content half-width and half-height before independent minimum constraints; outer x/y separation enlarges the anchor contour while the painted vertices subtract sqrt(2) times each separation. Compass and numeric anchors, positioning, and automatic clipping now use that outer contour; SVG paint and bounds use the contracted contour. Permanent flowchart, mathematics, and physics evidence is recorded in `docs/qa/2026-09-04-shapes-geometric-diamond.md`. Reviewed again on 2026-09-05 for trapezium rotation at lines 947-1523 and the manual's `shape border rotate=60` example: ordinary rotation is rounded to a quarter turn and swaps content axes at 90/270 degrees, while incircle mode uses sqrt(2) times the larger content half-extent and preserves the exact angle. The rotated visible polygon now drives SVG paint and bounds; a separately mitered outer contour drives named, compass, numeric, base/mid, positioning, and automatic clipping anchors. Permanent flowchart, mathematics, and physics evidence is recorded in `docs/qa/2026-09-05-shapes-trapezium-rotation.md`. Degenerate circular-sector/dart/kite/isosceles-triangle angular ranges and arbitrary-angle incircle metrics for other geometric shapes remain partial."
};
