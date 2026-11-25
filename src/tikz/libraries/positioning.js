import { parseDimension, roundPoint } from "../../engine/math.js";
import { resolveImplicitTwoPartCoordinate } from "../../engine/coordinateComponents.js";
import { parseOptions, stripOuterBraces, tikzBoolean } from "../../engine/options.js";
import { POSITIONING_ANCHORS, positioningRegisterName } from "../positioningKeys.js";

export const tikzLibrary = {
  name: "positioning",
  status: "builtin",
  implementedBy: "src/tikz/libraries/positioning.js; src/tikz/positioningKeys.js; src/engine/coordinateComponents.js; src/frontend/parser.js; src/engine/options.js; src/engine/evaluate.js",
  localSourceReviewed: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarypositioning.code.tex",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-shapes.tex",
  features: ["right/left/above/below=... of", "shape compass anchors", "base/mid left/right=... of", "node distance", "on grid centre placement", "legacy right of syntax"],
  implements: ["right/left/above/below=... of", "shape compass anchors", "base/mid left/right=... of", "node distance", "on grid centre placement", "legacy right of syntax"],
  notes: "Reviewed again on 2026-09-04 against tikzlibrarypositioning.code.tex and pgflibraryshapes.geometric.code.tex. Modern placement now follows PGF's exact reference-anchor + distance-vector - self-anchor equation. Paired diagonal distances remain unscaled; a single diagonal distance uses the source's sqrt(1/2) factor. Diamond north/south-east/west anchors use half of the corresponding outer half-extent, while circle and ellipse diagonal anchors follow their radial border. Normal rectangular positioning, base/mid text anchors, and on-grid center placement retain their existing semantics. The permanent drivers are positioning/diagonal-decision-flow.tex, positioning/diagonal-state-network.tex, positioning/diagonal-signal-chain.tex, and paths/custom-to-path-flowchart.tex. Arbitrary rotated asymmetric custom-shape placement and positioning against an explicitly named non-center coordinate remain partial."
};

tikzLibrary.notes += " Reviewed 2026-10-25: custom signal anchors use visible shape dimensions, preventing a second outer-separation expansion when applying the self anchor. Native signal anchor and 0.8cm gap probes are recorded in docs/qa/2026-10-25-scoped-fonts-failures.md.";
tikzLibrary.notes += " Reviewed 2026-11-25 against tikzlibrarypositioning.code.tex and tikz.code.tex: explicit anchors and calculated coordinates are fixed targets even on grid. Placement follows source order, library defaults, mixed-unit basis vectors and sloped path frames. This supersedes the earlier explicit-anchor limitation; arbitrary asymmetric custom-shape borders are not certified. Browser, tikztosvg and native evidence: docs/qa/2026-11-25-native-positioning.md.";

export function resolvePositioningPoint(options, env, selfSize = { width: 0, height: 0 }, helpers) {
  return resolveLegacyPositioning(options, env, helpers) || placeRelativeNode(options, env, selfSize, helpers, false);
}

export function resolveExplicitAtPositioningOffsetPoint(options, env, selfSize = { width: 0, height: 0 }, helpers) {
  return resolveLegacyPositioningOffset(options, env, helpers) || placeRelativeNode(options, env, selfSize, helpers, true);
}

const ORIGIN = { x: 0, y: 0 };
const OF = /^(.*?)\s*of\s+(.+)$/;

function nodeDistanceSetting(env) {
  // Core TikZ starts with a single 1cm; the positioning library overwrites
  // that register with a pair. Keep the core default for permissive snippets.
  return env.pictureOptions?.["node distance"] ?? (env.positioningLoaded ? "1cm and 1cm" : "1cm");
}

export function positioningSelfAnchor(direction) {
  return POSITIONING_ANCHORS[direction]?.self;
}

export function positioningOfAnchor(options) {
  let active = null;
  for (const [key, value] of Object.entries(options)) {
    if (Object.hasOwn(POSITIONING_ANCHORS, key)) active = OF.test(value) ? "placement" : null;
    else if (key === "anchor" && active) active = "explicit";
  }
  return active;
}

export function positioningOverridesAt(options) {
  let overrides = false;
  for (const [key, value] of Object.entries(options)) {
    if (key === "at") overrides = false;
    if (Object.hasOwn(POSITIONING_ANCHORS, key) && OF.test(value)) overrides = true;
  }
  return overrides;
}

export function positioningShift(direction, value, env) {
  const { x, y, isPair } = parsePositioningDistance(value, env);
  const spec = POSITIONING_ANCHORS[direction], factor = isPair ? 1 : spec.factor;
  return { x: spec.x * x * factor, y: spec.y * y * factor };
}

function placeRelativeNode(options, env, selfSize, helpers, explicitAt) {
  let nodeDistance = nodeDistanceSetting(env);
  let onGrid = tikzBoolean(env.pictureOptions?.["on grid"]);
  let at, gap, selfAnchor;
  for (const [key, value] of Object.entries(options || {})) {
    const register = positioningRegisterName(key);
    if (register === "on grid") onGrid = tikzBoolean(value);
    if (register === "node distance") nodeDistance = value;
    if (key === "anchor") selfAnchor = null; // The regular anchor pass applies this override.
    if (!Object.hasOwn(POSITIONING_ANCHORS, key)) continue;
    const of = OF.exec(String(value).trim());
    if (!of) {
      // A later direction without "of" keeps the assigned target but replaces
      // the shift and self anchor. The regular direction pass supplies both.
      gap = ORIGIN;
      selfAnchor = null;
      continue;
    }
    const reference = resolvePositioningReference(of[2], env, helpers);
    if (!reference) continue;
    const spec = POSITIONING_ANCHORS[key];
    // tikz@shapeborder is false for an explicit anchor or coordinate, even
    // "A.center". Only an implicit shape border switches both anchors on grid.
    const centered = reference.shapeBorder && onGrid;
    const refOffset = !explicitAt && reference.shapeBorder && !centered
      ? positioningNamedAnchorOffset(reference, spec.reference, helpers) : ORIGIN;
    at = explicitAt ? ORIGIN : { x: reference.point.x + refOffset.x, y: reference.point.y + refOffset.y };
    selfAnchor = centered ? null : spec.self;
    gap = helpers.positioningTransform(positioningShift(key, of[1].trim() || nodeDistance, env), env, options);
  }
  if (!at) return null;
  const offset = selfAnchor && !options.coordinate && options.shape !== "coordinate"
    ? positioningNamedAnchorOffset(selfSize, selfAnchor, helpers) : ORIGIN;
  return roundPoint({ x: at.x + gap.x - offset.x, y: at.y + gap.y - offset.y });
}

function positioningNamedAnchorOffset(size, anchor, helpers = {}) {
  const shapeAnchor = helpers.resolveNodeAnchorOffset?.(size, anchor);
  if (shapeAnchor && Number.isFinite(shapeAnchor.x) && Number.isFinite(shapeAnchor.y)) return shapeAnchor;
  const xBounds = positioningAxisBounds(size, "x");
  const yBounds = positioningAxisBounds(size, "y");
  const x = anchor.includes("east") ? xBounds.max : anchor.includes("west") ? xBounds.min : 0;
  const y = anchor.includes("north") ? yBounds.max : anchor.includes("south") ? yBounds.min
    : anchor.startsWith("base ") ? size.baseOffset || 0 : anchor.startsWith("mid ") ? size.midOffset || 0 : 0;
  const angle = (size.rotation || 0) * Math.PI / 180;
  return { x: x * Math.cos(angle) - y * Math.sin(angle), y: x * Math.sin(angle) + y * Math.cos(angle) };
}

export function defaultPositioningDistance(env) {
  return parsePositioningDistance(nodeDistanceSetting(env), env);
}

export function parsePositioningDistance(value, env) {
  const text = value === true || value == null || value === "" ? "0pt" : String(value).trim();
  const pair = text.match(/^([\s\S]+?)and([\s\S]+)$/);
  return { ...resolveImplicitTwoPartCoordinate(pair?.[2] ?? text, pair?.[1] ?? text, env), isPair: Boolean(pair) };
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
  const text = stripOuterBraces(helpers.resolveDynamicName(raw, env));
  // node cs without an anchor/angle has the same implicit border as (name).
  const nodeSystem = /^node\s+cs\s*:\s*(.+)$/.exec(text);
  if (nodeSystem) {
    const cs = parseOptions(nodeSystem[1]);
    if (cs.name && !cs.anchor && !cs.angle) return resolvePositioningReference(cs.name, env, helpers);
  }
  if (Object.hasOwn(env.nodes, text)) {
    const node = env.nodes[text];
    if (node.shape === "coordinate" || node.options?.coordinate || node.options?.shape === "coordinate") {
      return { point: node.point, width: 0, height: 0 };
    }
    return {
      point: node.point,
      shapeBorder: true,
      width: node.layoutWidth || node.width || 0,
      height: node.layoutHeight || node.height || 0,
      visibleWidth: node.width || 0,
      visibleHeight: node.height || 0,
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
  return { point: helpers.resolveCoordinate(text, env, helpers.diagnostics), width: 0, height: 0 };
}

export function parseShiftedPositioning(raw) {
  const text = stripOuterBraces(String(raw || "").trim());
  return text;
}
