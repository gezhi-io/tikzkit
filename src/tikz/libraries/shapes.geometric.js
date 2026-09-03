const TRAPEZIUM_EPSILON = 1e-9;
const CYLINDER_EPSILON = 1e-9;
const STAR_DEFAULT_POINT_RATIO = 1.5;
const STAR_DEFAULT_POINT_HEIGHT = 0.5;
const CYLINDER_DEFAULT_ASPECT = 1;

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
  const boundary = [
    ...sampleEllipseArc(afterBottomX, 0, endRadiusX, endRadiusY, 90, 270, 24),
    ...sampleEllipseArc(beforeTopX, 0, endRadiusX, endRadiusY, 270, 450, 24)
  ];
  const transformPoint = (point) => rotatePointQuarter(point, rotate);
  const transformCommand = (command) => rotateCylinderCommand(command, rotate);
  const transformedBoundary = boundary.map(transformPoint);
  const bounds = pointBounds(transformedBoundary);
  const anchors = Object.fromEntries(Object.entries({
    "shape center": { x: (endRadiusX + halfLineWidth + chord) / 2, y: 0 },
    "before top": { x: beforeTopX, y: endRadiusY },
    top: { x: beforeTopX + endRadiusX, y: 0 },
    "after top": { x: beforeTopX, y: -endRadiusY },
    "before bottom": { x: afterBottomX, y: -endRadiusY },
    bottom: { x: afterBottomX - endRadiusX, y: 0 },
    "after bottom": { x: afterBottomX, y: endRadiusY }
  }).map(([name, point]) => [name, transformPoint(point)]));

  return {
    outlineCommands: outline.map(transformCommand),
    bodyCommands: body.map(transformCommand),
    endCommands: end.map(transformCommand),
    boundaryPoints: transformedBoundary,
    anchors,
    bounds,
    shapeCenter: anchors["shape center"]
  };
}

export function cylinderBorderPoint(geometry = {}, toward = {}, padding = 0) {
  const dx = Number(toward.x) || 0;
  const dy = Number(toward.y) || 0;
  const distance = Math.hypot(dx, dy);
  if (distance < CYLINDER_EPSILON) return { x: 0, y: 0 };
  const points = geometry.boundaryPoints || [];
  let best = null;
  for (let index = 0; index < points.length; index += 1) {
    const first = points[index];
    const second = points[(index + 1) % points.length];
    const hit = raySegmentIntersection(dx, dy, first, second);
    if (hit && (!best || hit.t < best.t)) best = hit;
  }
  const base = best ? { x: best.x, y: best.y } : { x: 0, y: 0 };
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
  const usesPointRatio = data.starUsesPointRatio !== false;
  const innerRadius = usesPointRatio
    ? radius / normalizedStarPointRatio(data.starPointRatio)
    : Math.max(0, radius - normalizedStarPointHeight(data.starPointHeight));
  const startAngle = 90 + (Number(data.shapeBorderRotate) || 0);
  const x = Number(center?.x) || 0;
  const y = Number(center?.y) || 0;

  return Array.from({ length: count * 2 }, (_unused, index) => {
    const angle = ((startAngle + (180 * index) / count) * Math.PI) / 180;
    const pointRadius = index % 2 === 0 ? radius : innerRadius;
    return {
      x: x + Math.cos(angle) * pointRadius,
      y: y + Math.sin(angle) * pointRadius
    };
  });
}

export function trapeziumLayoutSize(contentWidth, contentHeight, options = {}) {
  let bodyHalfWidth = Math.max(0, Number(contentWidth) || 0) / 2;
  let halfHeight = Math.max(TRAPEZIUM_EPSILON, Math.max(0, Number(contentHeight) || 0) / 2);
  const minimumWidth = Math.max(0, Number(options.minimumWidth) || 0);
  const minimumHeight = Math.max(0, Number(options.minimumHeight) || 0);
  let leftExtension = trapeziumSideExtension(halfHeight, options.leftAngle);
  let rightExtension = trapeziumSideExtension(halfHeight, options.rightAngle);
  const minimumHalfHeight = minimumHeight / 2;

  // `\installtrapeziumparameters` preserves the side-angle construction when
  // a default trapezium is raised to its minimum height.
  if (halfHeight < minimumHalfHeight) {
    const scale = minimumHalfHeight / halfHeight;
    bodyHalfWidth *= scale;
    halfHeight *= scale;
    leftExtension *= scale;
    rightExtension *= scale;
  }

  const span = () => bodyHalfWidth * 2 + Math.abs(leftExtension) + Math.abs(rightExtension);
  if (span() < minimumWidth) {
    const scale = minimumWidth / Math.max(TRAPEZIUM_EPSILON, span());
    bodyHalfWidth *= scale;
    leftExtension *= scale;
    rightExtension *= scale;
    halfHeight *= scale;
  }

  return {
    width: bodyHalfWidth * 2 + Math.abs(leftExtension) + Math.abs(rightExtension),
    height: halfHeight * 2
  };
}

export function trapeziumNodePoints(center, halfWidth, halfHeight, data = {}) {
  const height = Math.max(TRAPEZIUM_EPSILON, Math.abs(Number(halfHeight) || 0));
  const leftExtension = trapeziumSideExtension(height, data.trapeziumLeftAngle);
  const rightExtension = trapeziumSideExtension(height, data.trapeziumRightAngle);
  const bodyHalfWidth = Math.max(0, Math.abs(Number(halfWidth) || 0) - (Math.abs(leftExtension) + Math.abs(rightExtension)) / 2);
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
    "src/engine/evaluate.js:regularPolygonLayoutSize/regularPolygonStartAngle/regularPolygonOuterRadiusExtension/nodeBorderPoint/polygonBorderPointWithPadding",
    "src/tikz/libraries/shapes.geometric.js:starLayoutSize/starNodePoints/trapeziumLayoutSize/trapeziumNodePoints",
    "src/tikz/libraries/shapes.geometric.js:cylinderLayoutSize/cylinderGeometry/cylinderBorderPoint",
    "src/renderers/svg/nodeShapes.js:regularPolygonNodePoints/starNodePoints/renderCylinderNodeBox"
  ],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex",
  "localSourceReviewed": true,
  "features": [
    "regular polygon with PGF circumcircle sizing, odd/even orientation, rotation, and border crop",
    "star with PGF radius modes, minimum sizing, and border rotation",
    "trapezium with default PGF cotangent side geometry, minimum-size scaling, and mitered curve terminal crop",
    "cloud",
    "isosceles triangle with apex angle, minimum height, rotation, and named anchors",
    "cylinder with PGF quarter-turn border rotation, aspect/minimum sizing, named anchors, curved border clipping, and separate body/end fills"
  ],
  "implements": [
    "regular polygon",
    "star",
    "trapezium",
    "cloud",
    "isosceles triangle",
    "cylinder"
  ],
  "notes": "Reviewed locally on 2026-08-07 against pgflibraryshapes.geometric.code.tex and the PGF shapes manual. Regular polygons use the source's sqrt(2)*apothem*sec(180/sides) content radius, circumcircle minimum size, odd/even orientation, `shape border rotate`/`regular polygon rotate`, and the outer-separation mitre extension used by curved terminal arrows. The permanent visual driver is arrows/regular-polygon-curved-terminal.tex. Stars now share PGF's max-content-radius, sqrt(2) inner-radius, ratio/point-height outer-radius, largest-minimum-diameter, and `star rotate` construction across layout, clipping, and SVG paint; arrows-shape-curved-terminal-padding is the visual driver. The default trapezium follows `\\installtrapeziumparameters`: side extensions are 2*half-height*cot(angle), minimum width/height preserve that construction by uniform scaling, and curve terminal rays intersect the mitered offset contour rather than an arbitrary adjacent side. `test/fixtures/arrows/shape-curved-terminal-miters.tex` is the visual regression. Reviewed again on 2026-09-04 for the cylinder declaration at lines 4019-4475 and the manual cylinder section: the end ellipse uses `shape aspect`, quarter-turn border rotation swaps the content axes, minimum width expands only the cross radius after the natural end radius has been fixed, and minimum height extends the body. TikZKit now shares this geometry across layout, paint, bounding boxes, named anchors, and border clipping, with independent body/end fill paths. The permanent drivers are `shapes/cylinder-manual-catalog.tex`, `shapes/cylinder-data-flow.tex`, and `shapes/cylinder-volume-physics.tex`. Arbitrary non-quarter cylinder rotation/incircle mode, the complete radial/mid/base anchor family, `trapezium stretches`, `trapezium stretches body`, star outer-separation anchor radii, named inner/outer star anchors, and degenerate angular ranges remain partial."
};
