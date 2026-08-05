import { parseDimension, roundPoint } from "../../engine/math.js";
import { stripOuterBraces } from "../../engine/options.js";

export const tikzLibrary = {
  name: "positioning",
  status: "builtin",
  implementedBy: "src/tikz/libraries/positioning.js",
  localSourceReviewed: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarypositioning.code.tex",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-shapes.tex",
  features: ["right/left/above/below=... of", "node distance", "on grid centre placement", "legacy right of syntax"],
  implements: ["right/left/above/below=... of", "node distance", "on grid centre placement", "legacy right of syntax"],
  notes: "Normal positioning preserves PGF border-to-border spacing. on grid makes modern above/below/left/right of placements ignore both node sizes, matching the native center-to-center rule at picture or node scope. base/mid anchors and the legacy right of family remain separate semantics."
};

export function resolvePositioningPoint(options, env, selfSize = { width: 0, height: 0 }, helpers) {
  const legacy = resolveLegacyPositioning(options, env, helpers);
  if (legacy) return legacy;
  const placement = resolvePositioningPlacement(options, env, helpers);
  if (!placement) return null;
  const geometry = positioningGeometry(placement, selfSize);
  const dx = positioningDelta(placement.direction, "x", placement.distance, geometry.reference, geometry.selfSize);
  const dy = positioningDelta(placement.direction, "y", placement.distance, geometry.reference, geometry.selfSize);
  return roundPoint({ x: placement.reference.point.x + dx, y: placement.reference.point.y + dy });
}

export function resolveExplicitAtPositioningOffsetPoint(options, env, selfSize = { width: 0, height: 0 }, helpers) {
  const legacy = resolveLegacyPositioningOffset(options, env, helpers);
  if (legacy) return legacy;
  const placement = resolvePositioningPlacement(options, env, helpers);
  if (!placement) return null;
  const origin = { point: { x: 0, y: 0 }, width: 0, height: 0 };
  const geometry = positioningGeometry({ ...placement, reference: origin }, selfSize);
  return {
    x: positioningDelta(placement.direction, "x", placement.distance, geometry.reference, geometry.selfSize),
    y: positioningDelta(placement.direction, "y", placement.distance, geometry.reference, geometry.selfSize)
  };
}

function resolvePositioningPlacement(options, env, helpers) {
  const entries = Object.entries(options || {});
  for (const [key, value] of entries) {
    const direction = key.trim().toLowerCase().replace(/\s+/g, " ");
    if (!["right", "left", "above", "below", "above right", "above left", "below right", "below left"].includes(direction)) {
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
  return {
    reference: { ...placement.reference, width: 0, height: 0 },
    selfSize: { width: 0, height: 0 }
  };
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
  const diagonalBorderCorrection = hasHorizontal && hasVertical && !distance.isPair ? 0.024 : 0;
  const axisDistance = rawDistance * diagonalSingleDistanceScale + diagonalBorderCorrection;
  if (axis === "x") {
    if (direction.includes("right")) return reference.width / 2 + selfSize.width / 2 + axisDistance;
    if (direction.includes("left")) return -(reference.width / 2 + selfSize.width / 2 + axisDistance);
    return 0;
  }
  if (direction.includes("above")) return reference.height / 2 + selfSize.height / 2 + axisDistance;
  if (direction.includes("below")) return -(reference.height / 2 + selfSize.height / 2 + axisDistance);
  return 0;
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
    return { point: node.point, width: node.layoutWidth || node.width || 0, height: node.layoutHeight || node.height || 0 };
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
