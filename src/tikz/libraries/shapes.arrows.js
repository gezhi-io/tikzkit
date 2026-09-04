import { splitTopLevel, stripOuterBraces } from "../../engine/options.js";

const ARROW_BOX_EPSILON = 1e-9;
const ARROW_BOX_DIRECTIONS = ["north", "south", "east", "west"];

export function parseArrowBoxArrowSpecs(raw) {
  const specs = { north: "0pt", south: "0pt", east: "0pt", west: "0pt" };
  let recent = "0pt";
  const source = stripOuterBraces(String(raw ?? "").trim());
  for (const item of splitTopLevel(source, ",")) {
    const entry = String(item || "").trim();
    if (!entry) continue;
    const colon = entry.indexOf(":");
    const direction = (colon >= 0 ? entry.slice(0, colon) : entry).trim().toLowerCase();
    if (!ARROW_BOX_DIRECTIONS.includes(direction)) continue;
    if (colon >= 0) recent = entry.slice(colon + 1).trim() || "0pt";
    specs[direction] = recent;
  }
  return specs;
}

export function arrowBoxArrowSpecsFromOptions(options = {}) {
  let specs = { north: ".5cm", south: ".5cm", east: ".5cm", west: ".5cm" };
  for (const [keyRaw, value] of Object.entries(options)) {
    const key = String(keyRaw || "").trim().toLowerCase();
    if (key === "arrow box arrows") {
      specs = parseArrowBoxArrowSpecs(value === true ? "" : value);
      continue;
    }
    const match = key.match(/^arrow box (north|south|east|west) arrow$/);
    if (match) specs[match[1]] = value === true ? ".5cm" : String(value);
  }
  return specs;
}

export function arrowBoxLayoutSize(contentWidth, contentHeight, options = {}) {
  const minimumSize = finiteNonnegative(options.minimumSize, 0);
  const minimumWidth = Math.max(minimumSize, finiteNonnegative(options.minimumWidth, 0));
  const minimumHeight = Math.max(minimumSize, finiteNonnegative(options.minimumHeight, 0));
  const bodyHalfWidth = Math.max(finiteNonnegative(contentWidth, 0) / 2, minimumWidth / 2);
  const bodyHalfHeight = Math.max(finiteNonnegative(contentHeight, 0) / 2, minimumHeight / 2);
  const outerXSep = finiteNonnegative(options.outerXSep, 0);
  const outerYSep = finiteNonnegative(options.outerYSep, 0);
  const arrows = options.arrows || {};
  const extension = (direction) => {
    const spec = normalizedArrowLength(arrows[direction]);
    if (!(spec.length > 0)) return 0;
    const halfBody = direction === "east" || direction === "west" ? bodyHalfWidth : bodyHalfHeight;
    const outerSep = direction === "east" || direction === "west" ? outerXSep : outerYSep;
    return spec.fromCenter ? spec.length : halfBody + outerSep + spec.length;
  };
  const data = {
    arrowBoxBodyHalfWidth: bodyHalfWidth,
    arrowBoxBodyHalfHeight: bodyHalfHeight,
    arrowBoxNorthExtend: extension("north"),
    arrowBoxSouthExtend: extension("south"),
    arrowBoxEastExtend: extension("east"),
    arrowBoxWestExtend: extension("west"),
    arrowBoxShaftWidth: finiteNonnegative(options.shaftWidth, 0.125),
    arrowBoxHeadExtend: finiteNonnegative(options.headExtend, 0.125),
    arrowBoxHeadIndent: finiteNumber(options.headIndent, 0),
    arrowBoxTipAngle: normalizedTipAngle(options.tipAngle),
    arrowBoxOuterXSep: outerXSep,
    arrowBoxOuterYSep: outerYSep
  };
  const geometry = arrowBoxGeometry({}, data);
  return {
    width: geometry.bounds.maxX - geometry.bounds.minX,
    height: geometry.bounds.maxY - geometry.bounds.minY,
    minX: geometry.bounds.minX,
    minY: geometry.bounds.minY,
    maxX: geometry.bounds.maxX,
    maxY: geometry.bounds.maxY,
    ...data
  };
}

export function arrowBoxGeometry(size = {}, data = {}) {
  const bodyHalfWidth = finiteNonnegative(
    data.arrowBoxBodyHalfWidth,
    Math.max(0, Number(size.width) || 0) / 2
  );
  const bodyHalfHeight = finiteNonnegative(
    data.arrowBoxBodyHalfHeight,
    Math.max(0, Number(size.height) || 0) / 2
  );
  const northExtend = finiteNonnegative(data.arrowBoxNorthExtend, 0);
  const southExtend = finiteNonnegative(data.arrowBoxSouthExtend, 0);
  const eastExtend = finiteNonnegative(data.arrowBoxEastExtend, 0);
  const westExtend = finiteNonnegative(data.arrowBoxWestExtend, 0);
  const shaftWidth = finiteNonnegative(data.arrowBoxShaftWidth, 0.125);
  const headExtend = finiteNonnegative(data.arrowBoxHeadExtend, 0.125);
  const headIndent = finiteNumber(data.arrowBoxHeadIndent, 0);
  const tipAngle = normalizedTipAngle(data.arrowBoxTipAngle);
  const outerXSep = finiteNonnegative(data.arrowBoxOuterXSep, 0);
  const outerYSep = finiteNonnegative(data.arrowBoxOuterYSep, 0);
  const halfShaft = shaftWidth / 2;
  const halfHead = halfShaft + headExtend;
  const tipInset = halfHead / Math.tan((tipAngle * Math.PI) / 360);
  const vertices = arrowBoxVertices({
    bodyHalfWidth,
    bodyHalfHeight,
    northExtend,
    southExtend,
    eastExtend,
    westExtend,
    halfShaft,
    halfHead,
    tipInset,
    headIndent
  });
  const visibleBoundaryPoints = vertices.map(({ x, y }) => roundPoint({ x, y }));
  const outerBoundaryPoints = anisotropicMiterOffsetPolygon(
    visibleBoundaryPoints,
    outerXSep,
    outerYSep
  );
  const anchors = arrowBoxAnchors(vertices, outerBoundaryPoints, {
    bodyHalfWidth,
    bodyHalfHeight,
    northExtend,
    southExtend,
    eastExtend,
    westExtend,
    baseOffset: finiteNumber(data.arrowBoxBaseOffset, 0),
    midOffset: finiteNumber(data.arrowBoxMidOffset, 0),
    outerXSep,
    outerYSep
  });

  return {
    outlineCommands: closedPolygonCommands(visibleBoundaryPoints),
    visibleBoundaryPoints,
    outerBoundaryPoints,
    anchors,
    bounds: pointBounds(visibleBoundaryPoints),
    anchorBounds: pointBounds(outerBoundaryPoints),
    bodyHalfWidth,
    bodyHalfHeight,
    northExtend,
    southExtend,
    eastExtend,
    westExtend,
    shaftWidth,
    headExtend,
    headIndent,
    tipAngle,
    outerXSep,
    outerYSep
  };
}

export function arrowBoxBorderPoint(geometry = {}, toward = {}, padding = 0) {
  const direction = { x: Number(toward.x) || 0, y: Number(toward.y) || 0 };
  if (Math.hypot(direction.x, direction.y) < ARROW_BOX_EPSILON) return { x: 0, y: 0 };
  const distance = Math.max(0, Number(padding) || 0);
  const points = distance > ARROW_BOX_EPSILON
    ? anisotropicMiterOffsetPolygon(
        geometry.visibleBoundaryPoints || [],
        finiteNonnegative(geometry.outerXSep, 0) + distance,
        finiteNonnegative(geometry.outerYSep, 0) + distance
      )
    : geometry.outerBoundaryPoints || geometry.visibleBoundaryPoints || [];
  return rayPolygonPoint({ x: 0, y: 0 }, direction, points) || { x: 0, y: 0 };
}

function arrowBoxVertices(parameters) {
  const {
    bodyHalfWidth: w,
    bodyHalfHeight: h,
    northExtend: n,
    southExtend: s,
    eastExtend: e,
    westExtend: west,
    halfShaft: sw,
    halfHead: hw,
    tipInset: inset,
    headIndent: indent
  } = parameters;
  const vertices = [{ x: w, y: h, name: "north east" }];
  if (e > 0) {
    vertices.push(
      { x: w, y: sw, name: "before east arrow" },
      { x: e - inset + indent, y: sw, name: "before east arrow head" },
      { x: e - inset, y: hw, name: "before east arrow tip" },
      { x: e, y: 0, name: "east arrow tip" },
      { x: e - inset, y: -hw, name: "after east arrow tip" },
      { x: e - inset + indent, y: -sw, name: "after east arrow head" },
      { x: w, y: -sw, name: "after east arrow" }
    );
  }
  vertices.push({ x: w, y: -h, name: "south east" });
  if (s > 0) {
    vertices.push(
      { x: sw, y: -h, name: "before south arrow" },
      { x: sw, y: -s + inset - indent, name: "before south arrow head" },
      { x: hw, y: -s + inset, name: "before south arrow tip" },
      { x: 0, y: -s, name: "south arrow tip" },
      { x: -hw, y: -s + inset, name: "after south arrow tip" },
      { x: -sw, y: -s + inset - indent, name: "after south arrow head" },
      { x: -sw, y: -h, name: "after south arrow" }
    );
  }
  vertices.push({ x: -w, y: -h, name: "south west" });
  if (west > 0) {
    vertices.push(
      { x: -w, y: -sw, name: "before west arrow" },
      { x: -west + inset - indent, y: -sw, name: "before west arrow head" },
      { x: -west + inset, y: -hw, name: "before west arrow tip" },
      { x: -west, y: 0, name: "west arrow tip" },
      { x: -west + inset, y: hw, name: "after west arrow tip" },
      { x: -west + inset - indent, y: sw, name: "after west arrow head" },
      { x: -w, y: sw, name: "after west arrow" }
    );
  }
  vertices.push({ x: -w, y: h, name: "north west" });
  if (n > 0) {
    vertices.push(
      { x: -sw, y: h, name: "before north arrow" },
      { x: -sw, y: n - inset + indent, name: "before north arrow head" },
      { x: -hw, y: n - inset, name: "before north arrow tip" },
      { x: 0, y: n, name: "north arrow tip" },
      { x: hw, y: n - inset, name: "after north arrow tip" },
      { x: sw, y: n - inset + indent, name: "after north arrow head" },
      { x: sw, y: h, name: "after north arrow" }
    );
  }
  return vertices;
}

function arrowBoxAnchors(vertices, outerPoints, dimensions) {
  const anchors = {
    center: { x: 0, y: 0 },
    text: { x: 0, y: 0 },
    base: { x: 0, y: dimensions.baseOffset },
    mid: { x: 0, y: dimensions.midOffset },
    "north east": { x: dimensions.bodyHalfWidth + dimensions.outerXSep, y: dimensions.bodyHalfHeight + dimensions.outerYSep },
    "south east": { x: dimensions.bodyHalfWidth + dimensions.outerXSep, y: -dimensions.bodyHalfHeight - dimensions.outerYSep },
    "south west": { x: -dimensions.bodyHalfWidth - dimensions.outerXSep, y: -dimensions.bodyHalfHeight - dimensions.outerYSep },
    "north west": { x: -dimensions.bodyHalfWidth - dimensions.outerXSep, y: dimensions.bodyHalfHeight + dimensions.outerYSep }
  };
  vertices.forEach((vertex, index) => {
    if (vertex.name) anchors[vertex.name] = outerPoints[index] || { x: vertex.x, y: vertex.y };
  });
  const side = {
    east: dimensions.eastExtend > 0
      ? anchors["east arrow tip"]
      : { x: dimensions.bodyHalfWidth + dimensions.outerXSep, y: 0 },
    west: dimensions.westExtend > 0
      ? anchors["west arrow tip"]
      : { x: -dimensions.bodyHalfWidth - dimensions.outerXSep, y: 0 },
    north: dimensions.northExtend > 0
      ? anchors["north arrow tip"]
      : { x: 0, y: dimensions.bodyHalfHeight + dimensions.outerYSep },
    south: dimensions.southExtend > 0
      ? anchors["south arrow tip"]
      : { x: 0, y: -dimensions.bodyHalfHeight - dimensions.outerYSep }
  };
  Object.assign(anchors, side);
  for (const direction of ARROW_BOX_DIRECTIONS) {
    const available = dimensions[`${direction}Extend`] > 0;
    for (const prefix of ["before", "after"]) {
      for (const suffix of ["arrow", "arrow head", "arrow tip"]) {
        const name = `${prefix} ${direction} ${suffix}`;
        if (!available || !anchors[name]) anchors[name] = side[direction];
      }
    }
    const tipName = `${direction} arrow tip`;
    if (!available || !anchors[tipName]) anchors[tipName] = side[direction];
  }
  // PGF 2025 derives these four south anchors from the north-arrow geometry.
  if (dimensions.northExtend > 0) {
    anchors["before south arrow head"] = reflectPointY(anchors["after north arrow head"]);
    anchors["before south arrow tip"] = reflectPointY(anchors["after north arrow tip"]);
    anchors["after south arrow tip"] = reflectPointY(anchors["before north arrow tip"]);
    anchors["after south arrow head"] = reflectPointY(anchors["before north arrow head"]);
  } else {
    for (const name of [
      "before south arrow head",
      "before south arrow tip",
      "after south arrow tip",
      "after south arrow head"
    ]) anchors[name] = side.south;
  }
  if (!(dimensions.southExtend > 0)) anchors["south arrow tip"] = side.east;
  anchors["base east"] = rayPolygonPoint(anchors.base, { x: 1, y: 0 }, outerPoints) || side.east;
  anchors["base west"] = rayPolygonPoint(anchors.base, { x: -1, y: 0 }, outerPoints) || side.west;
  anchors["mid east"] = rayPolygonPoint(anchors.mid, { x: 1, y: 0 }, outerPoints) || side.east;
  anchors["mid west"] = rayPolygonPoint(anchors.mid, { x: -1, y: 0 }, outerPoints) || side.west;
  return Object.fromEntries(Object.entries(anchors).map(([name, point]) => [name, roundPoint(point)]));
}

function reflectPointY(point) {
  return { x: point.x, y: -point.y };
}

function anisotropicMiterOffsetPolygon(points, outerXSep, outerYSep) {
  const xSep = finiteNonnegative(outerXSep, 0);
  const ySep = finiteNonnegative(outerYSep, 0);
  if (!Array.isArray(points) || points.length < 3) return [];
  if (xSep < ARROW_BOX_EPSILON && ySep < ARROW_BOX_EPSILON) return points.map(roundPoint);
  const edges = points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    const dx = next.x - point.x;
    const dy = next.y - point.y;
    const length = Math.hypot(dx, dy) || 1;
    const normal = { x: -dy / length, y: dx / length };
    const offset = Math.abs(normal.x) * xSep + Math.abs(normal.y) * ySep;
    return {
      point: { x: point.x + normal.x * offset, y: point.y + normal.y * offset },
      direction: { x: dx, y: dy },
      normal,
      offset
    };
  });
  return points.map((point, index) => {
    const previous = edges[(index - 1 + edges.length) % edges.length];
    const current = edges[index];
    const hit = infiniteLineIntersection(previous.point, previous.direction, current.point, current.direction);
    if (hit) return roundPoint(hit);
    const nx = previous.normal.x + current.normal.x;
    const ny = previous.normal.y + current.normal.y;
    const normalLength = Math.hypot(nx, ny) || 1;
    const distance = Math.max(previous.offset, current.offset);
    return roundPoint({ x: point.x + nx / normalLength * distance, y: point.y + ny / normalLength * distance });
  });
}

function infiniteLineIntersection(first, firstDirection, second, secondDirection) {
  const denominator = firstDirection.x * secondDirection.y - firstDirection.y * secondDirection.x;
  if (Math.abs(denominator) < ARROW_BOX_EPSILON) return null;
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const t = (dx * secondDirection.y - dy * secondDirection.x) / denominator;
  return { x: first.x + t * firstDirection.x, y: first.y + t * firstDirection.y };
}

function rayPolygonPoint(origin, direction, points) {
  let best = null;
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    const edge = { x: end.x - start.x, y: end.y - start.y };
    const denominator = direction.x * edge.y - direction.y * edge.x;
    if (Math.abs(denominator) < ARROW_BOX_EPSILON) continue;
    const offset = { x: start.x - origin.x, y: start.y - origin.y };
    const t = (offset.x * edge.y - offset.y * edge.x) / denominator;
    const u = (offset.x * direction.y - offset.y * direction.x) / denominator;
    if (t < -ARROW_BOX_EPSILON || u < -ARROW_BOX_EPSILON || u > 1 + ARROW_BOX_EPSILON) continue;
    if (!best || t < best.t) best = { t, x: origin.x + t * direction.x, y: origin.y + t * direction.y };
  }
  return best ? roundPoint(best) : null;
}

function closedPolygonCommands(points) {
  if (!points.length) return [];
  return [
    { type: "moveTo", x: points[0].x, y: points[0].y },
    ...points.slice(1).map((point) => ({ type: "lineTo", x: point.x, y: point.y })),
    { type: "closePath" }
  ];
}

function pointBounds(points) {
  if (!points.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxX: Math.max(bounds.maxX, point.x),
    maxY: Math.max(bounds.maxY, point.y)
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

function normalizedArrowLength(value) {
  if (value && typeof value === "object") {
    return {
      length: finiteNumber(value.length, 0),
      fromCenter: Boolean(value.fromCenter)
    };
  }
  return { length: finiteNumber(value, 0), fromCenter: false };
}

function normalizedTipAngle(value) {
  return Math.max(1, Math.min(179, finiteNumber(value, 90)));
}

function finiteNonnegative(value, fallback = 0) {
  return Math.max(0, finiteNumber(value, fallback));
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundPoint(point) {
  return { x: roundNumber(point.x), y: roundNumber(point.y) };
}

function roundNumber(value) {
  return Math.round((Number(value) || 0) * 1e9) / 1e9;
}

export const tikzLibrary = {
  "name": "shapes.arrows",
  "status": "partial",
  "implementedBy": "src/tikz/libraries/shapes.arrows.js:arrowBoxLayoutSize/arrowBoxGeometry/arrowBoxBorderPoint + src/engine/evaluate.js:arrowBoxLayoutSize/arrowBoxLayoutShapeData/customNodeLocalAnchor + src/renderers/svg/nodeShapes.js:nodeShapeCommands",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.arrows.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex",
  "localSourceReviewed": true,
  "features": [
    "single arrow",
    "double arrow",
    "minimum width and minimum height",
    "tip angle",
    "head extend",
    "head indent",
    "single/double-arrow named anchors",
    "arrow box four-direction geometry",
    "arrow box border-relative and center-relative lengths",
    "arrow box named and numeric anchors"
  ],
  "implements": [
    "single arrow",
    "double arrow",
    "arrow box"
  ],
  "notes": "Reviewed locally on 2026-09-04 against pgflibraryshapes.arrows.code.tex and the PGF shapes manual. `single arrow`, `double arrow`, and `arrow box` use source-derived geometry records shared by SVG rendering, border clipping, named/numeric anchors, and bounds. Arrow box supports four independent arrows, the reset-and-reuse `arrow box arrows` shorthand, border-relative and `from center` lengths, shaft width, head extend/indent, tip angle, outer separation, rotation, and the documented before/head/tip/after anchors, including TeX Live 2025's north-derived special south anchors and hidden-tip fallback. Permanent flowchart, mathematics, and physics drivers are under test/fixtures/examples/shapes; evidence is in docs/qa/2026-09-04-shapes-arrows-arrow-box.md. Remaining partial work is exact TeX text metrics and exhaustive degenerate/negative-dimension parity across all arrow shapes."
};
