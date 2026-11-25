import { evaluateMath, parseDimension, roundPoint, substituteVariables } from "./math.js";
import { stripOuterBraces } from "./options.js";

export function coordinateComponentHasDimension(value, variables = {}) {
  const raw = stripOuterBraces(String(value ?? "").trim());
  if (/\\(?:textwidth|textheight|linewidth|paperwidth|paperheight)\b/.test(raw)) return true;
  const text = substituteVariables(raw, variables).replace(/\{\}/g, "");
  return /(?:^|[^\p{L}])(?:cm|mm|pt|em|ex|in)\b/u.test(text);
}

export function parseCoordinateFactor(value, variables = {}) {
  return evaluateMath(value, variables, { throwOnError: true });
}

export function parseCoordinateCanvasDimension(value, variables = {}) {
  const text = stripOuterBraces(substituteVariables(value, variables).replace(/\{\}/g, "").trim());
  const additive = parseAdditiveCoordinateDimension(text);
  if (Number.isFinite(additive)) return additive;
  return parseDimension(text, variables, { throwOnError: true });
}

function parseAdditiveCoordinateDimension(text) {
  const compact = String(text || "").replace(/\s+/g, "");
  if (!compact) return NaN;
  const tokens = /([+-]?(?:\d+\.?\d*|\.\d+))(cm|mm|pt|em|ex|in)?/g;
  let index = 0;
  let total = 0;
  for (const match of compact.matchAll(tokens)) {
    if (match.index !== index) return NaN;
    total += parseDimension(`${match[1]}${match[2] || "pt"}`, {});
    index += match[0].length;
  }
  return index === compact.length ? total : NaN;
}

// Dimensions are canvas lengths; unitless terms multiply the picture's
// independent (possibly skew) basis vectors. TikZ coordinates and positioning
// shifts both use this sum *before* applying any coordinate transformation.
export function resolveImplicitTwoPartCoordinate(xRaw, yRaw, { variables, basis } = {}) {
  const contribution = (value, axis, cartesian) => {
    const physical = coordinateComponentHasDimension(value, variables);
    const length = physical ? parseCoordinateCanvasDimension(value, variables) : parseCoordinateFactor(value, variables);
    const unit = physical ? cartesian : (basis?.[axis] ?? cartesian);
    return roundPoint({ x: length * unit.x, y: length * unit.y });
  };
  const x = contribution(xRaw, "x", { x: 1, y: 0 });
  const y = contribution(yRaw, "y", { x: 0, y: 1 });
  return roundPoint({ x: x.x + y.x, y: x.y + y.y });
}
