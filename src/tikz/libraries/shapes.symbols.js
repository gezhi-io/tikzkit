const NOWHERE = "nowhere";

export const tikzLibrary = {
  name: "shapes.symbols",
  status: "partial",
  implementedBy: "src/tikz/libraries/shapes.symbols.js:parseSignalDirections/signalLayoutSize/signalGeometry/signalBorderPoint",
  localSourceReviewed: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.symbols.code.tex",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex",
  features: [
    "signal shape",
    "signal to/from compass directions",
    "signal pointer angle",
    "opposite horizontal or vertical pointers",
    "signal compass anchors and border clipping"
  ],
  implements: ["signal", "signal to", "signal from", "signal pointer angle"],
  notes: "Implements the PGF signal node family, including direction precedence, pointer-angle-preserving minimum dimensions, asymmetric bounds, compass anchors, and polygon border clipping. Other shapes.symbols nodes remain unsupported."
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
