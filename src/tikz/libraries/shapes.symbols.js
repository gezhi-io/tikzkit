const NOWHERE = "nowhere";

export const tikzLibrary = {
  name: "shapes.symbols",
  status: "partial",
  implementedBy: "src/tikz/libraries/shapes.symbols.js:parseSignalDirections/signalLayoutSize/signalGeometry/signalBorderPoint/magneticTapeLayoutSize/magneticTapeGeometry/magneticTapeBorderPoint + src/engine/evaluate.js:nodeShape/estimateNodeSize/nodeAnchorOffset/nodeBorderPoint + src/tikz/textMetrics.js:estimateFormulaParts + src/renderers/svg/nodeShapes.js + src/renderers/svg/bounds.js",
  localSourceReviewed: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.symbols.code.tex",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex",
  features: [
    "signal shape",
    "signal to/from compass directions",
    "signal pointer angle",
    "opposite horizontal or vertical pointers",
    "signal compass anchors and border clipping",
    "magnetic tape shape and tail controls",
    "magnetic tape compass/tail anchors and border clipping"
  ],
  implements: [
    "signal",
    "signal to",
    "signal from",
    "signal pointer angle",
    "magnetic tape",
    "magnetic tape tail",
    "magnetic tape tail extend"
  ],
  notes: "Implements the PGF signal and magnetic-tape node families. Magnetic tape follows the source's sqrt(2) circular sizing, clamped tail controls, asymmetric bounds, compass/tail anchors, and piecewise circular/tail border clipping. Its content-driven radius also uses local TeX metrics for comma-separated subscript sequences ending in dots. Other shapes.symbols nodes remain unsupported."
};

export function parseSignalDirections(signalFrom = "nowhere", signalTo = "east") {
  const directions = {
    north: NOWHERE,
    east: NOWHERE,
    south: NOWHERE,
    west: NOWHERE
  };
  assignSignalDirections(directions, signalFrom, "from");
  assignSignalDirections(directions, signalTo, "to");
  return directions;
}

export function signalLayoutSize(contentWidth, contentHeight, options = {}) {
  const directions = normalizedDirections(options);
  const pointerAngle = normalizedPointerAngle(options.pointerAngle ?? options.signalPointerAngle);
  const tangent = pointerTangent(pointerAngle);
  const horizontalPointers = Number(directions.east !== NOWHERE) + Number(directions.west !== NOWHERE);
  const verticalPointers = Number(directions.north !== NOWHERE) + Number(directions.south !== NOWHERE);
  const minimumSize = positive(options.minimumSize);
  const minimumWidth = Math.max(minimumSize, positive(options.minimumWidth));
  const minimumHeight = Math.max(minimumSize, positive(options.minimumHeight));

  let halfWidth = positive(contentWidth) / 2;
  let halfHeight = positive(contentHeight) / 2;
  let pointerX = tangent * halfHeight;
  let pointerY = tangent * halfWidth;

  const naturalHeight = halfHeight * 2 + pointerY * verticalPointers;
  if (naturalHeight < minimumHeight) {
    halfHeight = Math.max(0, (minimumHeight - pointerY * verticalPointers) / 2);
    pointerX = tangent * halfHeight;
  }

  const naturalWidth = halfWidth * 2 + pointerX * horizontalPointers;
  if (naturalWidth < minimumWidth) {
    halfWidth = Math.max(0, (minimumWidth - pointerX * horizontalPointers) / 2);
    pointerY = tangent * halfWidth;
  }

  return {
    width: round(halfWidth * 2 + pointerX * horizontalPointers),
    height: round(halfHeight * 2 + pointerY * verticalPointers)
  };
}

export function signalGeometry(size = {}, data = {}) {
  const directions = normalizedDirections(data);
  const pointerAngle = normalizedPointerAngle(data.pointerAngle ?? data.signalPointerAngle);
  const tangent = pointerTangent(pointerAngle);
  const horizontalPointers = Number(directions.east !== NOWHERE) + Number(directions.west !== NOWHERE);
  const verticalPointers = Number(directions.north !== NOWHERE) + Number(directions.south !== NOWHERE);
  const width = positive(size.width);
  const height = positive(size.height);

  let halfWidth;
  let halfHeight;
  let pointerX;
  let pointerY;
  if (horizontalPointers) {
    halfHeight = height / 2;
    pointerX = tangent * halfHeight;
    halfWidth = Math.max(0, (width - pointerX * horizontalPointers) / 2);
    pointerY = tangent * halfWidth;
  } else if (verticalPointers) {
    halfWidth = width / 2;
    pointerY = tangent * halfWidth;
    halfHeight = Math.max(0, (height - pointerY * verticalPointers) / 2);
    pointerX = tangent * halfHeight;
  } else {
    halfWidth = width / 2;
    halfHeight = height / 2;
    pointerX = tangent * halfHeight;
    pointerY = tangent * halfWidth;
  }

  const anchors = {
    center: { x: 0, y: 0 },
    north: { x: 0, y: halfHeight + (directions.north === "to" ? pointerY : 0) },
    "north east": {
      x: halfWidth + (directions.east === "from" ? pointerX : 0),
      y: halfHeight + (directions.north === "from" ? pointerY : 0)
    },
    east: { x: halfWidth + (directions.east === "to" ? pointerX : 0), y: 0 },
    "south east": {
      x: halfWidth + (directions.east === "from" ? pointerX : 0),
      y: -halfHeight - (directions.south === "from" ? pointerY : 0)
    },
    south: { x: 0, y: -halfHeight - (directions.south === "to" ? pointerY : 0) },
    "south west": {
      x: -halfWidth - (directions.west === "from" ? pointerX : 0),
      y: -halfHeight - (directions.south === "from" ? pointerY : 0)
    },
    west: { x: -halfWidth - (directions.west === "to" ? pointerX : 0), y: 0 },
    "north west": {
      x: -halfWidth - (directions.west === "from" ? pointerX : 0),
      y: halfHeight + (directions.north === "from" ? pointerY : 0)
    }
  };
  const points = [
    anchors.north,
    anchors["north east"],
    anchors.east,
    anchors["south east"],
    anchors.south,
    anchors["south west"],
    anchors.west,
    anchors["north west"]
  ].map(roundPoint);
  const commands = [
    { type: "moveTo", ...points[0] },
    ...points.slice(1).map((point) => ({ type: "lineTo", ...point })),
    { type: "closePath" }
  ];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return {
    pointerAngle,
    directions,
    halfWidth: round(halfWidth),
    halfHeight: round(halfHeight),
    pointerX: round(pointerX),
    pointerY: round(pointerY),
    points,
    commands,
    anchors: Object.fromEntries(Object.entries(anchors).map(([name, point]) => [name, roundPoint(point)])),
    bounds: {
      minX: round(Math.min(...xs)),
      minY: round(Math.min(...ys)),
      maxX: round(Math.max(...xs)),
      maxY: round(Math.max(...ys))
    }
  };
}

export function signalBorderPoint(geometry, toward, padding = 0) {
  const direction = { x: Number(toward?.x) || 0, y: Number(toward?.y) || 0 };
  const length = Math.hypot(direction.x, direction.y);
  if (length <= 1e-12) return { x: 0, y: 0 };
  const hit = polygonRayHit(geometry?.points || [], direction);
  if (!hit) return { x: 0, y: 0 };
  const distance = positive(padding);
  if (distance <= 1e-12) return roundPoint(hit.point);

  const edge = { x: hit.b.x - hit.a.x, y: hit.b.y - hit.a.y };
  const edgeLength = Math.hypot(edge.x, edge.y);
  if (edgeLength <= 1e-12) return roundPoint(hit.point);
  const area = polygonSignedArea(geometry.points);
  const outward = area < 0
    ? { x: -edge.y / edgeLength, y: edge.x / edgeLength }
    : { x: edge.y / edgeLength, y: -edge.x / edgeLength };
  const unit = { x: direction.x / length, y: direction.y / length };
  const projection = unit.x * outward.x + unit.y * outward.y;
  if (projection <= 1e-12) return roundPoint(hit.point);
  const radialDistance = distance / projection;
  return roundPoint({
    x: hit.point.x + unit.x * radialDistance,
    y: hit.point.y + unit.y * radialDistance
  });
}

export function magneticTapeLayoutSize(contentWidth, contentHeight, options = {}) {
  const minimumDiameter = Math.max(
    positive(options.minimumSize),
    positive(options.minimumWidth),
    positive(options.minimumHeight)
  );
  const contentDiameter = Math.SQRT2 * Math.max(positive(contentWidth), positive(contentHeight));
  const diameter = Math.max(contentDiameter, minimumDiameter);
  return { width: round(diameter), height: round(diameter) };
}

export function magneticTapeGeometry(size = {}, data = {}) {
  const radius = Math.max(1e-9, positive(Math.max(Number(size.width) || 0, Number(size.height) || 0)) / 2);
  const tailProportion = clamp(Number(data.magneticTapeTail ?? data.tailProportion ?? 0.15), 0, 1);
  const tailExtend = positive(data.magneticTapeTailExtend ?? data.tailExtend);
  const outerSep = positive(data.magneticTapeOuterSep ?? data.outerSep);
  const outerRadius = radius + outerSep;
  const tailHeight = tailProportion * radius;
  const tailAngle = 360 - radiansToDegrees(Math.asin(clamp((radius - tailHeight) / radius, -1, 1)));
  const start = circlePoint(radius, tailAngle);
  const tailBottom = { x: radius + tailExtend, y: -radius };
  const tailTop = { x: radius + tailExtend, y: -radius + tailHeight };
  const outlineCommands = [
    { type: "moveTo", ...start },
    ...circleArcCommands(radius, tailAngle, 360),
    ...circleArcCommands(radius, 0, 270),
    { type: "lineTo", ...tailBottom },
    { type: "lineTo", ...tailTop },
    { type: "closePath" }
  ].map(roundCommand);
  const boundaryPoints = [
    ...sampleCircleArc(radius, tailAngle, 360, 12),
    ...sampleCircleArc(radius, 0, 270, 36).slice(1),
    tailBottom,
    tailTop
  ].map(roundPoint);
  const bounds = pointBounds(boundaryPoints);
  const diagonal = outerRadius * Math.SQRT1_2;
  const anchors = {
    center: { x: 0, y: 0 },
    north: { x: 0, y: outerRadius },
    "north east": { x: diagonal, y: diagonal },
    east: { x: outerRadius, y: 0 },
    "south east": { x: outerRadius, y: -outerRadius },
    south: { x: 0, y: -outerRadius },
    "south west": { x: -diagonal, y: -diagonal },
    west: { x: -outerRadius, y: 0 },
    "north west": { x: -diagonal, y: diagonal },
    "tail east": {
      x: radius + tailExtend + outerSep,
      y: -radius + tailHeight / 2
    },
    "tail south east": {
      x: radius + tailExtend + outerSep,
      y: -outerRadius
    },
    "tail north east": {
      x: radius + tailExtend + outerSep,
      y: -radius + tailHeight + outerSep
    }
  };

  return {
    radius: round(radius),
    outerRadius: round(outerRadius),
    outerSep: round(outerSep),
    tailProportion: round(tailProportion),
    tailExtend: round(tailExtend),
    tailHeight: round(tailHeight),
    tailAngle: round(tailAngle),
    outlineCommands,
    boundaryPoints,
    bounds,
    anchors: Object.fromEntries(Object.entries(anchors).map(([name, point]) => [name, roundPoint(point)]))
  };
}

export function magneticTapeBorderPoint(geometry = {}, toward = {}, padding = 0) {
  const dx = Number(toward.x) || 0;
  const dy = Number(toward.y) || 0;
  const length = Math.hypot(dx, dy);
  if (length <= 1e-12) return { x: 0, y: 0 };

  const radius = positive(geometry.radius);
  const tailHeight = clamp(Number(geometry.tailHeight) || 0, 0, radius);
  const tailExtend = positive(geometry.tailExtend);
  const outerSep = positive(geometry.outerSep) + positive(padding);
  const outerRadius = radius + outerSep;
  const angle = normalizedDegrees(radiansToDegrees(Math.atan2(dy, dx)));
  const tailBottomAngle = 360 - radiansToDegrees(Math.atan2(outerRadius, outerRadius + tailExtend));
  const tailTopRise = outerRadius - outerSep * 2 - tailHeight;
  const tailTopAngle = 360 - radiansToDegrees(Math.atan2(tailTopRise, outerRadius + tailExtend));

  if (angle < 270 || angle >= tailTopAngle) {
    return roundPoint({ x: dx / length * outerRadius, y: dy / length * outerRadius });
  }
  if (angle < tailBottomAngle) {
    const factor = -outerRadius / dy;
    return roundPoint({ x: dx * factor, y: -outerRadius });
  }
  const factor = outerRadius / dx;
  return roundPoint({ x: outerRadius, y: dy * factor });
}

function assignSignalDirections(directions, raw, kind) {
  const text = String(raw === true || raw === undefined || raw === null ? "" : raw)
    .trim()
    .toLowerCase();
  if (!text || text.includes("nowhere")) return;
  const values = text.includes("and")
    ? text.split(/\s+and\s+/).slice(0, 2)
    : [text, text];
  for (const value of values) assignSignalDirection(directions, value.trim(), kind);
}

function circleArcCommands(radius, startDegrees, endDegrees) {
  const commands = [];
  let start = startDegrees;
  const direction = endDegrees >= startDegrees ? 1 : -1;
  while ((direction > 0 && start < endDegrees - 1e-9) || (direction < 0 && start > endDegrees + 1e-9)) {
    const end = direction > 0 ? Math.min(start + 90, endDegrees) : Math.max(start - 90, endDegrees);
    const startRadians = degreesToRadians(start);
    const endRadians = degreesToRadians(end);
    const delta = endRadians - startRadians;
    const factor = (4 / 3) * Math.tan(delta / 4);
    const first = circlePoint(radius, start);
    const last = circlePoint(radius, end);
    commands.push({
      type: "curveTo",
      x1: first.x - factor * first.y,
      y1: first.y + factor * first.x,
      x2: last.x + factor * last.y,
      y2: last.y - factor * last.x,
      x: last.x,
      y: last.y
    });
    start = end;
  }
  return commands;
}

function sampleCircleArc(radius, startDegrees, endDegrees, count) {
  const points = [];
  for (let index = 0; index <= count; index += 1) {
    const angle = startDegrees + (endDegrees - startDegrees) * index / count;
    points.push(circlePoint(radius, angle));
  }
  return points;
}

function circlePoint(radius, degrees) {
  const radians = degreesToRadians(degrees);
  return { x: radius * Math.cos(radians), y: radius * Math.sin(radians) };
}

function pointBounds(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: round(Math.min(...xs)),
    minY: round(Math.min(...ys)),
    maxX: round(Math.max(...xs)),
    maxY: round(Math.max(...ys))
  };
}

function roundCommand(command) {
  if (command.type === "closePath") return command;
  const rounded = { ...command, x: round(command.x), y: round(command.y) };
  if (command.type === "curveTo") {
    rounded.x1 = round(command.x1);
    rounded.y1 = round(command.y1);
    rounded.x2 = round(command.x2);
    rounded.y2 = round(command.y2);
  }
  return rounded;
}

function degreesToRadians(value) {
  return value * Math.PI / 180;
}

function radiansToDegrees(value) {
  return value * 180 / Math.PI;
}

function normalizedDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function clamp(value, minimum, maximum) {
  const number = Number(value);
  const finite = Number.isFinite(number) ? number : minimum;
  return Math.min(maximum, Math.max(minimum, finite));
}

function assignSignalDirection(directions, raw, kind) {
  const direction = canonicalDirection(raw);
  if (!direction) return;
  directions[direction] = kind;
  if (direction === "east" || direction === "west") {
    directions.north = NOWHERE;
    directions.south = NOWHERE;
  } else {
    directions.east = NOWHERE;
    directions.west = NOWHERE;
  }
}

function canonicalDirection(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (["east", "right"].includes(value)) return "east";
  if (["west", "left"].includes(value)) return "west";
  if (["north", "above", "up"].includes(value)) return "north";
  if (["south", "below", "down"].includes(value)) return "south";
  return null;
}

function normalizedDirections(options = {}) {
  const explicit = options.directions ?? options.signalDirections;
  if (explicit && typeof explicit === "object") {
    return {
      north: explicit.north || NOWHERE,
      east: explicit.east || NOWHERE,
      south: explicit.south || NOWHERE,
      west: explicit.west || NOWHERE
    };
  }
  return parseSignalDirections(options.signalFrom ?? "nowhere", options.signalTo ?? "east");
}

function normalizedPointerAngle(value) {
  const number = Number(value);
  return Math.max(1, Math.min(179, Number.isFinite(number) ? number : 90));
}

function pointerTangent(pointerAngle) {
  return Math.tan(((90 - pointerAngle / 2) * Math.PI) / 180);
}

function polygonRayHit(points, direction) {
  const hits = [];
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const edge = { x: b.x - a.x, y: b.y - a.y };
    const denominator = cross(direction, edge);
    if (Math.abs(denominator) <= 1e-12) continue;
    const t = cross(a, edge) / denominator;
    const u = cross(a, direction) / denominator;
    if (t >= -1e-9 && u >= -1e-9 && u <= 1 + 1e-9) {
      hits.push({ t, a, b, point: { x: direction.x * t, y: direction.y * t } });
    }
  }
  hits.sort((left, right) => left.t - right.t);
  return hits[0] || null;
}

function polygonSignedArea(points) {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length];
    return area + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

function cross(a, b) {
  return a.x * b.y - a.y * b.x;
}

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function round(value) {
  return Math.round(value * 1e9) / 1e9;
}

function roundPoint(point) {
  return { x: round(point.x), y: round(point.y) };
}
