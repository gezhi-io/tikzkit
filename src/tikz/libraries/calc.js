import { evaluateMath, parseDimension, roundPoint } from "../../engine/math.js";
import { splitTopLevel, stripOuterBraces } from "../../engine/options.js";

export const tikzLibrary = {
  name: "calc",
  status: "builtin",
  implementedBy: "src/tikz/libraries/calc.js",
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarycalc.code.tex",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-coordinates.tex",
  localSourceReviewed: "yes",
  notes: "Reviewed locally on 2026-08-07: TikZ calc accumulates an unbounded signed series of optional-factor coordinates, and each coordinate may own an interpolation, distance, angle, or projection modifier before the next sign. TikZKit supports that shared series grammar, local vector offsets, scalar pgfmath factors, and repeated modifiers. Arbitrary TeX expansion inside calc factors and every PGF coordinate system remain partial.",
  features: ["coordinate interpolation", "distance and angle modifiers", "orthogonal projection", "multi-term coordinate addition and subtraction", "polar/vector offsets", "scalar coordinate multiplication"],
  implements: ["coordinate interpolation", "distance and angle modifiers", "orthogonal projection", "multi-term coordinate addition and subtraction", "polar/vector offsets", "scalar coordinate multiplication"]
};

export function resolveCalcExpression(text, env, diagnostics, helpers) {
  const terms = splitCalcTerms(text);
  if (terms?.length) {
    const total = { x: 0, y: 0 };
    for (let index = 0; index < terms.length; index += 1) {
      const term = terms[index];
      const point = resolveCalcTerm(term.text, index === 0, env, diagnostics, helpers);
      total.x += term.sign * point.x;
      total.y += term.sign * point.y;
    }
    return roundPoint(total);
  }

  return helpers.resolveCoordinate(text, env, diagnostics);
}

function resolveCalcTerm(text, isFirst, env, diagnostics, helpers) {
  const multiplication = splitCalcTermFactor(text);
  const coordinateText = multiplication ? multiplication.coordinate : text;
  const modifierChain = resolveCalcModifierChain(coordinateText, env, diagnostics, helpers);
  const point = modifierChain || (isFirst
    ? resolveCalcAdditionLeft(coordinateText, env, diagnostics, helpers)
    : resolveCalcOffsetExpression(coordinateText, env, diagnostics, helpers));

  if (!multiplication) return point;
  const factor = evaluateMath(multiplication.factor, env.variables);
  return roundPoint({
    x: point.x * factor,
    y: point.y * factor
  });
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
  return helpers.resolveCoordinate(text, env, diagnostics);
}

function resolveLocalVectorCoordinate(text, env, diagnostics, helpers) {
  const normalized = stripOuterBraces(String(text || "").trim());
  const identity = helpers.identityTransform?.() || { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0, scale: 1 };
  const local = helpers.resolveCoordinate(normalized, { ...env, transform: identity }, diagnostics);
  return helpers.applyTransformVector(local, env.transform);
}

function splitCalcScalarMultiplication(text) {
  const multiplication = splitCalcTermFactor(text);
  if (!multiplication || multiplication.coordinate.includes("!")) return null;
  return multiplication;
}

// PGF's calc parser consumes a signed series of optional-factor coordinates.
// A modifier belongs to the coordinate before it, so top-level +/- is a term
// separator only after that coordinate (and its !...! target) is complete.
function splitCalcTerms(text) {
  const source = String(text || "").trim();
  if (!source) return null;

  const terms = [];
  let index = 0;
  while (index < source.length) {
    index = skipWhitespace(source, index);
    let sign = 1;
    if (source[index] === "+" || source[index] === "-") {
      sign = source[index] === "+" ? 1 : -1;
      index = skipWhitespace(source, index + 1);
    }
    const term = consumeCalcTerm(source, index);
    if (!term) return null;
    terms.push({ sign, text: source.slice(index, term.end).trim() });
    index = skipWhitespace(source, term.end);
    if (index >= source.length) return terms;
    if (source[index] !== "+" && source[index] !== "-") return null;
  }
  return terms;
}

function consumeCalcTerm(source, start) {
  let coordinateStart = start;
  if (source[coordinateStart] !== "(") {
    const factorCoordinateStart = findCalcFactorCoordinateStart(source, start);
    if (factorCoordinateStart === -1) return null;
    coordinateStart = factorCoordinateStart;
  }

  let end = consumeBalancedParens(source, coordinateStart);
  if (end === -1) return null;
  while (true) {
    const afterCoordinate = skipWhitespace(source, end);
    if (source[afterCoordinate] !== "!") return { end: afterCoordinate };

    const modifierEnd = findTopLevelBang(source, afterCoordinate + 1);
    if (modifierEnd === -1) return null;
    const targetStart = findCalcModifierTargetStart(source, modifierEnd + 1);
    if (targetStart === -1) return null;
    end = consumeBalancedParens(source, targetStart);
    if (end === -1) return null;
  }
}

function findCalcFactorCoordinateStart(source, start) {
  let depth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  for (let i = start; i < source.length - 1; i += 1) {
    const char = source[i];
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "{") braceDepth += 1;
    if (char === "}") braceDepth -= 1;
    if (char === "[") bracketDepth += 1;
    if (char === "]") bracketDepth -= 1;
    if (char === "*" && source[i + 1] === "(" && depth === 0 && braceDepth === 0 && bracketDepth === 0) return i + 1;
  }
  return -1;
}

function splitCalcTermFactor(text) {
  const raw = String(text || "").trim();
  const coordinateStart = findCalcFactorCoordinateStart(raw, 0);
  if (coordinateStart <= 0) return null;
  return {
    factor: stripOuterBraces(raw.slice(0, coordinateStart - 1).trim()),
    coordinate: raw.slice(coordinateStart).trim()
  };
}

function consumeBalancedParens(source, start) {
  if (source[start] !== "(") return -1;
  let depth = 0;
  let braceDepth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
    else if (braceDepth === 0 && char === "(") depth += 1;
    else if (braceDepth === 0 && char === ")") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return -1;
}

function findTopLevelBang(source, start) {
  let parenDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") parenDepth += 1;
    else if (char === ")") parenDepth = Math.max(0, parenDepth - 1);
    else if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
    else if (char === "[") bracketDepth += 1;
    else if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === "!" && parenDepth === 0 && braceDepth === 0 && bracketDepth === 0) return index;
  }
  return -1;
}

function findCalcModifierTargetStart(source, start) {
  let braceDepth = 0;
  let bracketDepth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
    else if (char === "[") bracketDepth += 1;
    else if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === "(" && braceDepth === 0 && bracketDepth === 0) return index;
  }
  return -1;
}

function skipWhitespace(source, start) {
  let index = start;
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return index;
}

function stripPointParens(text) {
  const trimmed = String(text || "").trim();
  return trimmed.startsWith("(") && trimmed.endsWith(")") ? trimmed.slice(1, -1).trim() : trimmed;
}
