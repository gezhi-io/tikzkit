import { evaluateMath, parseDimension, parseDimensionResult, substituteVariables } from "./math.js";
import { MATH_EXPRESSION_LIMITS } from "./safe-expression.js";
import { stripOuterBraces } from "./options.js";
import { PGF_SP, pgfDimension } from "./pgf-fixed-point.js";

export { parseDimension } from "./math.js";
export { TIKZ_UNIT, lineWidthFromPt, lineWidthFromTikzDimension } from "../tikz/metrics.js";

const ptRatios = { cm: [7227, 254], mm: [7227, 2540], in: [7227, 100], pt: [1, 1], bp: [7227, 7200], pc: [12, 1] };

// TeX scans the decimal coefficient before converting physical units and
// truncating to scaled points. Rounding an ideal cm value only at the end
// changes a circle's saved radius even for a literal such as 0.2cm.
export function literalRegisterLengthCm(value) {
  const literal = String(value ?? "").trim().match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(cm|mm|in|pt|bp|pc)$/);
  if (!literal) return NaN;
  const [num, den] = ptRatios[literal[2]];
  return Math.trunc(pgfDimension(literal[1]) * PGF_SP * num / den) * (2.54 / 72.27 / PGF_SP);
}

// pgfmathparse converts each dimension to a number of TeX points before
// evaluating the expression: in "1mm+2", the 2 is two points, not two cm.
export function pgfPointExpressionSource(value, env) {
  const text = stripOuterBraces(substituteVariables(value, env.variables,
    { maxLength: MATH_EXPRESSION_LIMITS.characters }).trim());
  return text.replace(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?(?:\s*(pt|cm|mm|in|bp|pc|sp|em|ex|px)\b)?/g,
    (literal, unit) => {
      if (!unit) return literal;
      if (unit === "sp") return String(Math.trunc(parseFloat(literal)) / PGF_SP);
      const cm = unit === "em" || unit === "ex" || unit === "px"
        ? parseDimensionResult(literal, {}, { font: env.currentFont }).value : literalRegisterLengthCm(literal);
      return String(pgfDimension(cm * (72.27 / 2.54)));
    });
}

export function pgfPointExpressionCm(value, env) {
  return pgfDimension(evaluateMath(pgfPointExpressionSource(value, env), env.variables)) * (2.54 / 72.27);
}

export function parseFinitePgfLength(value, env, fallback) {
  if (value === undefined || value === null || value === true || value === "") return fallback;
  const substituted = substituteVariables(value, env.variables).replace(/\{\}/g, "").trim();
  const text = stripOuterBraces(substituted);
  const hasExplicitUnit = /(?:cm|mm|pt|em|ex|in)\s*$/.test(text);
  const length = !hasExplicitUnit && /^[+\-*/().\d\s]+$/.test(text) ? `${text}pt` : value;
  const parsed = parseDimension(length, env.variables);
  return Number.isFinite(parsed) ? parsed : fallback;
}
