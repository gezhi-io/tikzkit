import { parseDimension, substituteVariables } from "./math.js";
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

export function parseFinitePgfLength(value, env, fallback) {
  if (value === undefined || value === null || value === true || value === "") return fallback;
  const substituted = substituteVariables(value, env.variables).replace(/\{\}/g, "").trim();
  const text = stripOuterBraces(substituted);
  const hasExplicitUnit = /(?:cm|mm|pt|em|ex|in)\s*$/.test(text);
  const length = !hasExplicitUnit && /^[+\-*/().\d\s]+$/.test(text) ? `${text}pt` : value;
  const parsed = parseDimension(length, env.variables);
  return Number.isFinite(parsed) ? parsed : fallback;
}
