import { evaluateMath, parseDimension, roundPoint } from "../math.js";
import { splitTopLevel, stripOuterBraces } from "../options.js";

export const tikzLibrary = {
  name: "calc",
  status: "builtin",
  implementedBy: "src/libraries/calc.js",
  features: ["coordinate interpolation", "coordinate addition", "polar/vector offsets"],
  implements: ["coordinate interpolation", "coordinate addition", "polar/vector offsets"]
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
  const interpolation = text.match(/^\((.+?)\)\s*!\s*(.+?)\s*!\s*\((.+?)\)$/);
  if (interpolation) {
    const a = helpers.resolveCoordinate(interpolation[1], env, diagnostics);
    const t = evaluateMath(interpolation[2], env.variables);
    const b = helpers.resolveCoordinate(interpolation[3], env, diagnostics);
    return roundPoint({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }

  const addition = splitCalcAddition(text);
  if (addition) {
    const left = addition.left.includes("!")
      ? resolveCalcExpression(addition.left, env, diagnostics, helpers)
      : helpers.resolveCoordinate(addition.left, env, diagnostics);
    const right = addition.right.includes("!")
      ? resolveCalcExpression(addition.right, env, diagnostics, helpers)
      : resolveCalcOffsetExpression(addition.right, env, diagnostics, helpers);
    return roundPoint({
      x: left.x + addition.sign * right.x,
      y: left.y + addition.sign * right.y
    });
  }

  return helpers.resolveCoordinate(text, env, diagnostics);
}

export function resolveCalcOffsetExpression(text, env, diagnostics, helpers) {
  const raw = String(text || "").trim();
  const coordinateText = raw.startsWith("(") && raw.endsWith(")") ? raw.slice(1, -1).trim() : raw;
  if (splitTopLevel(coordinateText, ",").length >= 2 || /^.+:.+$/.test(coordinateText)) {
    return resolveLocalVectorCoordinate(coordinateText, env, diagnostics, helpers);
  }
  return helpers.resolveCoordinate(coordinateText, env, diagnostics);
}

function resolveLocalVectorCoordinate(text, env, diagnostics, helpers) {
  const normalized = stripOuterBraces(String(text || "").trim());
  const polar = normalized.match(/^(.+):(.+)$/);
  if (polar) {
    const angle = (evaluateMath(polar[1], env.variables) * Math.PI) / 180;
    const radius = parseDimension(polar[2], env.variables);
    return helpers.applyTransformVector(
      roundPoint({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }),
      env.transform
    );
  }
  const comma = splitTopLevel(normalized, ",");
  if (comma.length >= 2) {
    const projected = helpers.projectBasisPoint(
      parseDimension(comma[0], env.variables),
      parseDimension(comma[1], env.variables),
      comma.length >= 3 ? parseDimension(comma[2], env.variables) : 0,
      env.basis
    );
    return helpers.applyTransformVector(projected, env.transform);
  }
  diagnostics.push({ severity: "warning", message: `Unknown calc offset ${text}` });
  return { x: 0, y: 0 };
}

function splitCalcAddition(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if ((char === "+" || char === "-") && depth === 0) {
      return {
        left: stripPointParens(text.slice(0, i).trim()),
        right: stripPointParens(text.slice(i + 1).trim()),
        sign: char === "+" ? 1 : -1
      };
    }
  }
  return null;
}

function stripPointParens(text) {
  const trimmed = String(text || "").trim();
  return trimmed.startsWith("(") && trimmed.endsWith(")") ? trimmed.slice(1, -1).trim() : trimmed;
}
