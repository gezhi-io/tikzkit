import { parseDimension, roundPoint } from "../../engine/math.js";
import { stripOuterBraces } from "../../engine/options.js";

export const tikzLibrary = {
  name: "positioning",
  status: "builtin",
  implementedBy: "src/tikz/libraries/positioning.js; src/engine/evaluate.js:nodeTextAnchorOffsets/nodeAnchorCoordinate/shapeCompassLocalAnchor",
  localSourceReviewed: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarypositioning.code.tex",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-shapes.tex",
  features: ["right/left/above/below=... of", "shape compass anchors", "base/mid left/right=... of", "node distance", "on grid centre placement", "legacy right of syntax"],
  implements: ["right/left/above/below=... of", "shape compass anchors", "base/mid left/right=... of", "node distance", "on grid centre placement", "legacy right of syntax"],
  notes: "Reviewed again on 2026-09-04 against tikzlibrarypositioning.code.tex and pgflibraryshapes.geometric.code.tex. Modern placement now follows PGF's exact reference-anchor + distance-vector - self-anchor equation. Paired diagonal distances remain unscaled; a single diagonal distance uses the source's sqrt(1/2) factor. Diamond north/south-east/west anchors use half of the corresponding outer half-extent, while circle and ellipse diagonal anchors follow their radial border. Normal rectangular positioning, base/mid text anchors, and on-grid center placement retain their existing semantics. The permanent drivers are positioning/diagonal-decision-flow.tex, positioning/diagonal-state-network.tex, positioning/diagonal-signal-chain.tex, and paths/custom-to-path-flowchart.tex. Arbitrary rotated asymmetric custom-shape placement and positioning against an explicitly named non-center coordinate remain partial."
};

export function resolvePositioningPoint(options, env, selfSize = { width: 0, height: 0 }, helpers) {
  const legacy = resolveLegacyPositioning(options, env, helpers);
  if (legacy) return legacy;
  const placement = resolvePositioningPlacement(options, env, helpers);
  if (!placement) return null;
  const geometry = positioningGeometry(placement, selfSize);
  const delta = positioningPlacementDelta(
    placement.direction,
    placement.distance,
    geometry.reference,
    geometry.selfSize,
    helpers
  );
  const dx = delta.x;
  const dy = positioningAnchorDelta(placement.direction, geometry.reference, geometry.selfSize) ?? delta.y;
  return roundPoint({ x: placement.reference.point.x + dx, y: placement.reference.point.y + dy });
}

export function resolveExplicitAtPositioningOffsetPoint(options, env, selfSize = { width: 0, height: 0 }, helpers) {
  const legacy = resolveLegacyPositioningOffset(options, env, helpers);
  if (legacy) return legacy;
  const placement = resolvePositioningPlacement(options, env, helpers);
  if (!placement) return null;
  const origin = { point: { x: 0, y: 0 }, width: 0, height: 0 };
  const geometry = positioningGeometry({ ...placement, reference: origin }, selfSize);
  const delta = positioningPlacementDelta(
    placement.direction,
    placement.distance,
    geometry.reference,
    geometry.selfSize,
    helpers
  );
  return {
    x: delta.x,
    y: positioningAnchorDelta(placement.direction, geometry.reference, geometry.selfSize) ?? delta.y
  };
}

function resolvePositioningPlacement(options, env, helpers) {
  const entries = Object.entries(options || {});
  for (const [key, value] of entries) {
    const direction = key.trim().toLowerCase().replace(/\s+/g, " ");
    if (!["right", "left", "above", "below", "above right", "above left", "below right", "below left", "base left", "base right", "mid left", "mid right"].includes(direction)) {
      continue;
    }
    const text = String(value === true ? "" : value).trim();
    const placement = parsePositioningOfExpression(text, env);
    if (!placement) continue;
    const distance = scalePositioningDistance(placement.distance, env, helpers);
    const reference = resolvePositioningReference(placement.reference, env, helpers);
    if (!reference) continue;
    return { direction, distance, reference, onGrid: positioningUsesGrid(options, env) };
  }
  return null;
}

function positioningGeometry(placement, selfSize) {
  if (!placement.onGrid) return { reference: placement.reference, selfSize };
  const center = {
    width: 0,
    height: 0,
    minX: 0,
    minY: 0,
    maxX: 0,
    maxY: 0,
    baseOffset: 0,
    midOffset: 0,
    shape: "coordinate",
    shapeData: null,
    rotation: 0
  };
  return {
    // PGF's on-grid branch replaces both placement anchors with center.
    reference: { ...placement.reference, ...center },
    selfSize: center
  };
}

const POSITIONING_ANCHORS = {
  above: { self: "south", reference: "north", x: 0, y: 1, factor: 1 },
  "above left": { self: "south east", reference: "north west", x: -1, y: 1, factor: Math.SQRT1_2 },
  "above right": { self: "south west", reference: "north east", x: 1, y: 1, factor: Math.SQRT1_2 },
  below: { self: "north", reference: "south", x: 0, y: -1, factor: 1 },
  "below left": { self: "north east", reference: "south west", x: -1, y: -1, factor: Math.SQRT1_2 },
  "below right": { self: "north west", reference: "south east", x: 1, y: -1, factor: Math.SQRT1_2 },
  left: { self: "east", reference: "west", x: -1, y: 0, factor: 1 },
  right: { self: "west", reference: "east", x: 1, y: 0, factor: 1 }
};

function positioningPlacementDelta(direction, distance, reference, selfSize, helpers = {}) {
  const anchors = POSITIONING_ANCHORS[direction];
  if (!anchors) {
    return {
      x: positioningDelta(direction, "x", distance, reference, selfSize),
      y: positioningDelta(direction, "y", distance, reference, selfSize)
    };
  }
  const referenceAnchor = positioningNamedAnchorOffset(reference, anchors.reference, helpers);
  const selfAnchor = positioningNamedAnchorOffset(selfSize, anchors.self, helpers);
  const factor = distance.isPair ? 1 : anchors.factor;
  return {
    x: referenceAnchor.x - selfAnchor.x + anchors.x * distance.x * factor,
    y: referenceAnchor.y - selfAnchor.y + anchors.y * distance.y * factor
  };
}

function positioningNamedAnchorOffset(size, anchor, helpers = {}) {
  const shapeAnchor = helpers.resolveNodeAnchorOffset?.(size, anchor);
  if (shapeAnchor && Number.isFinite(shapeAnchor.x) && Number.isFinite(shapeAnchor.y)) return shapeAnchor;
  const xBounds = positioningAxisBounds(size, "x");
  const yBounds = positioningAxisBounds(size, "y");
  return {
    x: anchor.includes("east") ? xBounds.max : anchor.includes("west") ? xBounds.min : 0,
    y: anchor.includes("north") ? yBounds.max : anchor.includes("south") ? yBounds.min : 0
  };
}

function positioningAnchorDelta(direction, reference = {}, selfSize = {}) {
  const kind = direction.startsWith("base ") ? "baseOffset" : direction.startsWith("mid ") ? "midOffset" : null;
  if (!kind) return null;
  return (Number(reference[kind]) || 0) - (Number(selfSize[kind]) || 0);
}

function positioningUsesGrid(options = {}, env = {}) {
  const value = Object.hasOwn(options, "on grid")
    ? options["on grid"]
    : env.pictureOptions?.["on grid"];
  if (value === undefined || value === null || value === false || value === 0) return false;
  const text = stripOuterBraces(String(value).trim()).toLowerCase();
  return !["false", "no", "off", "0"].includes(text);
}

function parsePositioningOfExpression(text, env) {
  const match = String(text || "").trim().match(/^(.*?)\s*of\s+(.+)$/);
  if (!match) return null;
  const distanceText = match[1].trim();
  const distance = distanceText ? parsePositioningDistance(distanceText, env) : defaultPositioningDistance(env);
  if (!Number.isFinite(distance.x) || !Number.isFinite(distance.y)) return null;
  return { distance, reference: match[2].trim() };
}

export function defaultPositioningDistance(env) {
  return parsePositioningDistance(env.pictureOptions?.["node distance"] || "1cm", env);
}

export function parsePositioningDistance(value, env) {
  const text = String(value || "").trim();
  const pair = text.match(/^([\s\S]+?)\s+and\s+([\s\S]+)$/);
  if (pair) {
    return {
      y: parseDimension(pair[1], env.variables),
      x: parseDimension(pair[2], env.variables),
      isPair: true
    };
  }
  const distance = parseDimension(text, env.variables);
  return { x: distance, y: distance, isPair: false };
}

export function positioningDelta(direction, axis, distance, reference, selfSize) {
  const hasHorizontal = direction.includes("right") || direction.includes("left");
  const hasVertical = direction.includes("above") || direction.includes("below");
  const rawDistance = axis === "x" ? distance.x : distance.y;
  const diagonalSingleDistanceScale = hasHorizontal && hasVertical && !distance.isPair ? Math.SQRT1_2 : 1;
  const axisDistance = rawDistance * diagonalSingleDistanceScale;
  const referenceBounds = positioningAxisBounds(reference, axis);
  const selfBounds = positioningAxisBounds(selfSize, axis);
  if (axis === "x") {
    if (direction.includes("right")) return referenceBounds.max - selfBounds.min + axisDistance;
    if (direction.includes("left")) return referenceBounds.min - selfBounds.max - axisDistance;
    return 0;
  }
  if (direction.includes("above")) return referenceBounds.max - selfBounds.min + axisDistance;
  if (direction.includes("below")) return referenceBounds.min - selfBounds.max - axisDistance;
  return 0;
}

function positioningAxisBounds(size = {}, axis) {
  const minimumKey = axis === "x" ? "minX" : "minY";
  const maximumKey = axis === "x" ? "maxX" : "maxY";
  const extent = (Number(axis === "x" ? size.width : size.height) || 0) / 2;
  const minimum = Number(size[minimumKey]);
  const maximum = Number(size[maximumKey]);
  return {
    min: Number.isFinite(minimum) ? minimum : -extent,
    max: Number.isFinite(maximum) ? maximum : extent
  };
}

export function scalePositioningDistance(distance, env, helpers) {
  const scale = helpers.canvasLengthScale(env);
  if (Math.abs(scale - 1) < 1e-9) return distance;
  return {
    ...distance,
    x: distance.x * scale,
    y: distance.y * scale
  };
}

function resolveLegacyPositioning(options, env, helpers) {
  for (const [key, direction] of Object.entries(LEGACY_DIRECTIONS)) {
    if (!Object.hasOwn(options, key)) continue;
    const target = resolveReferencePoint(options[key], env, helpers);
    if (!target) continue;
    const distance = parseDimension(options["node distance"] || env.pictureOptions?.["node distance"] || 1, env.variables) * helpers.canvasLengthScale(env);
    return roundPoint({
      x: target.x + direction.x * distance * direction.factor,
      y: target.y + direction.y * distance * direction.factor
    });
  }
  return null;
}

function resolveLegacyPositioningOffset(options, env, helpers) {
  for (const [key, direction] of Object.entries(LEGACY_DIRECTIONS)) {
    if (!Object.hasOwn(options, key)) continue;
    const distance =
      parseDimension(options["node distance"] || env.pictureOptions?.["node distance"] || 1, env.variables) *
      helpers.canvasLengthScale(env);
    return roundPoint({
      x: direction.x * distance * direction.factor,
      y: direction.y * distance * direction.factor
    });
  }
  return null;
}

const LEGACY_DIRECTIONS = {
  "right of": { x: 1, y: 0, factor: 1 },
  "left of": { x: -1, y: 0, factor: 1 },
  "above of": { x: 0, y: 1, factor: 1 },
  "below of": { x: 0, y: -1, factor: 1 },
  "above right of": { x: 1, y: 1, factor: Math.SQRT1_2 },
  "above left of": { x: -1, y: 1, factor: Math.SQRT1_2 },
  "below right of": { x: 1, y: -1, factor: Math.SQRT1_2 },
  "below left of": { x: -1, y: -1, factor: Math.SQRT1_2 }
};

function resolveReferencePoint(raw, env, helpers) {
  const reference = resolvePositioningReference(raw, env, helpers);
  if (reference) return reference.point;
  return null;
}

function resolvePositioningReference(raw, env, helpers) {
  const text = helpers.resolveDynamicName(raw, env);
  if (Object.hasOwn(env.nodes, text)) {
    const node = env.nodes[text];
    return {
      point: node.point,
      width: node.layoutWidth || node.width || 0,
      height: node.layoutHeight || node.height || 0,
      minX: node.layoutMinX,
      minY: node.layoutMinY,
      maxX: node.layoutMaxX,
      maxY: node.layoutMaxY,
      baseOffset: Number(node.baseOffset) || 0,
      midOffset: Number(node.midOffset) || 0,
      shape: node.shape,
      shapeData: node.shapeData,
      rotation: Number(node.rotation) || 0
    };
  }
  if (Object.hasOwn(env.coordinates, text)) return { point: env.coordinates[text], width: 0, height: 0 };
  const anchored = helpers.resolveAnchoredNodeCoordinate(text, env);
  if (anchored) return { point: anchored, width: 0, height: 0 };
  if (text.startsWith("$") || text.includes(",") || /^-?\d/.test(text)) {
    return { point: helpers.resolveCoordinate(text, env, []), width: 0, height: 0 };
  }
  return null;
}

export function parseShiftedPositioning(raw) {
  const text = stripOuterBraces(String(raw || "").trim());
  return text;
}
