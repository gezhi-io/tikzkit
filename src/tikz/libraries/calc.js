import { evaluateMath, parseDimension, roundPoint } from "../../engine/math.js";
import { splitTopLevel, stripOuterBraces } from "../../engine/options.js";

export const tikzLibrary = {
  name: "calc",
  status: "builtin",
  implementedBy: "src/tikz/libraries/calc.js",
  features: ["coordinate interpolation", "distance and angle modifiers", "orthogonal projection", "coordinate addition", "polar/vector offsets", "scalar coordinate multiplication"],
  implements: ["coordinate interpolation", "distance and angle modifiers", "orthogonal projection", "coordinate addition", "polar/vector offsets", "scalar coordinate multiplication"]
};

export function resolveCalcExpression(text, env, diagnostics, helpers) {
  const interpolationPlusOffset = text.match(/^\((.+?)\)\s*!\s*(.+?)\s*!\s*\((.+?)\)\s*([+-])\s*\((.+)\)$/);
  if (interpolationPlusOffset) {
    const a = helpers.resolveCoordinate(interpolationPlusOffset[1], env, diagnostics);
    const t = evaluateMath(interpolationPlusOffset[2], env.variables);
    const b = helpers.resolveCoordinate(interpolationPlusOffset[3], env, diagnostics);
    const offset = resolveCalcOffsetExpression(interpolationPlusOffset[5], env, diagnostics, helpers);
    const sign = interpolationPlusOffset[4] === "+" ? 1 : -1;
    return roundPoint({
      x: a.x + (b.x - a.x) * t + sign * offset.x,
      y: a.y + (b.y - a.y) * t + sign * offset.y
    });
  }
  const modifierChain = resolveCalcModifierChain(text, env, diagnostics, helpers);
  if (modifierChain) return modifierChain;

  const interpolation = text.match(/^\((.+?)\)\s*!\s*(.+?)\s*!\s*\((.+?)\)$/);
  if (interpolation) {
    const a = helpers.resolveCoordinate(interpolation[1], env, diagnostics);
    const t = evaluateMath(interpolation[2], env.variables);
    const b = helpers.resolveCoordinate(interpolation[3], env, diagnostics);
    return roundPoint({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }

  const addition = splitCalcAddition(text);
  if (addition) {
    const left = resolveCalcAdditionLeft(addition.left, env, diagnostics, helpers);
    const right = addition.right.includes("!")
      ? resolveCalcExpression(addition.right, env, diagnostics, helpers)
      : resolveCalcOffsetExpression(addition.right, env, diagnostics, helpers);
    return roundPoint({
      x: left.x + addition.sign * right.x,
      y: left.y + addition.sign * right.y
    });
  }

  if (splitCalcScalarMultiplication(text)) {
    return resolveCalcOffsetExpression(text, env, diagnostics, helpers);
  }

  return helpers.resolveCoordinate(text, env, diagnostics);
}

function resolveCalcModifierChain(text, env, diagnostics, helpers) {
  const parts = splitTopLevel(String(text || "").trim(), "!");
  if (parts.length < 3 || parts.length % 2 === 0) return null;

  let point = helpers.resolveCoordinate(stripPointParens(parts[0]), env, diagnostics);
  for (let index = 1; index < parts.length; index += 2) {
    const modifier = parts[index].trim();
    const targetSpec = splitModifierTarget(parts[index + 1]);
    const target = helpers.resolveCoordinate(stripPointParens(targetSpec.coordinate), env, diagnostics);
    const rotatedTarget = rotatePointAround(target, point, evaluateMath(targetSpec.angle, env.variables));
    const dx = rotatedTarget.x - point.x;
    const dy = rotatedTarget.y - point.y;

    if (isProjectionCoordinate(modifier)) {
      const projection = helpers.resolveCoordinate(stripPointParens(stripOuterBraces(modifier)), env, diagnostics);
      const lengthSquared = dx * dx + dy * dy;
      if (lengthSquared <= 1e-18) continue;
      const factor = ((projection.x - point.x) * dx + (projection.y - point.y) * dy) / lengthSquared;
      point = roundPoint({ x: point.x + dx * factor, y: point.y + dy * factor });
      continue;
    }

    const dimension = calcModifierDimension(modifier, env.variables);
    if (Number.isFinite(dimension)) {
      const length = Math.hypot(dx, dy);
      if (length <= 1e-12) continue;
      point = roundPoint({ x: point.x + dx * dimension / length, y: point.y + dy * dimension / length });
      continue;
    }

    const factor = evaluateMath(stripOuterBraces(modifier), env.variables);
    point = roundPoint({ x: point.x + dx * factor, y: point.y + dy * factor });
  }
  return point;
}

function splitModifierTarget(value) {
  const text = String(value || "").trim();
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "(" && paren === 0 && brace === 0 && bracket === 0 && index > 0 && text[index - 1] === ":") {
      return {
        angle: text.slice(0, index - 1).trim(),
        coordinate: text.slice(index).trim()
      };
    }
    if (char === "(") paren += 1;
    else if (char === ")") paren = Math.max(0, paren - 1);
    else if (char === "{") brace += 1;
    else if (char === "}") brace = Math.max(0, brace - 1);
    else if (char === "[") bracket += 1;
    else if (char === "]") bracket = Math.max(0, bracket - 1);
  }
  return { angle: "0", coordinate: text };
}

function rotatePointAround(point, center, angleDegrees) {
  if (!Number.isFinite(angleDegrees) || Math.abs(angleDegrees) < 1e-12) return point;
  const angle = angleDegrees * Math.PI / 180;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return roundPoint({
    x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle)
  });
}

function isProjectionCoordinate(value) {
  const text = stripOuterBraces(String(value || "").trim());
  return text.startsWith("(") && text.endsWith(")");
}

function calcModifierDimension(value, variables) {
  const text = stripOuterBraces(String(value || "").trim());
  if (!/(?:cm|mm|pt|em|ex|in)\b/.test(text)) return NaN;
  const parsed = parseDimension(text, variables);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function resolveCalcOffsetExpression(text, env, diagnostics, helpers) {
  const raw = String(text || "").trim();
  const multiplication = splitCalcScalarMultiplication(raw);
  if (multiplication) {
    const factor = evaluateMath(multiplication.factor, env.variables);
    const vector = resolveCalcOffsetExpression(multiplication.coordinate, env, diagnostics, helpers);
    return roundPoint({
      x: vector.x * factor,
      y: vector.y * factor
    });
  }
  const coordinateText = raw.startsWith("(") && raw.endsWith(")") ? raw.slice(1, -1).trim() : raw;
  if (splitTopLevel(coordinateText, ",").length >= 2 || /^.+:.+$/.test(coordinateText)) {
    return resolveLocalVectorCoordinate(coordinateText, env, diagnostics, helpers);
  }
  return helpers.resolveCoordinate(coordinateText, env, diagnostics);
}

function resolveCalcAdditionLeft(text, env, diagnostics, helpers) {
  if (text.includes("!")) {
    return resolveCalcExpression(text, env, diagnostics, helpers);
  }
  if (splitCalcScalarMultiplication(text)) {
    return resolveCalcOffsetExpression(text, env, diagnostics, helpers);
  }
  return helpers.resolveCoordinate(text, env, diagnostics);
}

function resolveLocalVectorCoordinate(text, env, diagnostics, helpers) {
  const normalized = stripOuterBraces(String(text || "").trim());
  const identity = helpers.identityTransform?.() || { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0, scale: 1 };
  const local = helpers.resolveCoordinate(normalized, { ...env, transform: identity }, diagnostics);
  return helpers.applyTransformVector(local, env.transform);
}

function splitCalcAddition(text) {
  let depth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "{") braceDepth += 1;
    if (char === "}") braceDepth -= 1;
    if (char === "[") bracketDepth += 1;
    if (char === "]") bracketDepth -= 1;
    if ((char === "+" || char === "-") && depth === 0 && braceDepth === 0 && bracketDepth === 0 && i > 0) {
      const previous = text.slice(0, i).trim().at(-1);
      if (!previous || "+-*/^(".includes(previous)) continue;
      return {
        left: stripPointParens(text.slice(0, i).trim()),
        right: stripPointParens(text.slice(i + 1).trim()),
        sign: char === "+" ? 1 : -1
      };
    }
  }
  return null;
}

function splitCalcScalarMultiplication(text) {
  let depth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "{") braceDepth += 1;
    if (char === "}") braceDepth -= 1;
    if (char === "[") bracketDepth += 1;
    if (char === "]") bracketDepth -= 1;
    if (char !== "*" || depth !== 0 || braceDepth !== 0 || bracketDepth !== 0) continue;
    const factor = text.slice(0, i).trim();
    const coordinate = text.slice(i + 1).trim();
    if (!factor || !coordinate.startsWith("(") || !coordinate.endsWith(")")) continue;
    return {
      factor: stripOuterBraces(factor),
      coordinate
    };
  }
  return null;
}

function stripPointParens(text) {
  const trimmed = String(text || "").trim();
  return trimmed.startsWith("(") && trimmed.endsWith(")") ? trimmed.slice(1, -1).trim() : trimmed;
}
