import { parseDimension, substituteVariables } from "./math.js";
import { stripOuterBraces } from "./options.js";

export { parseDimension } from "./math.js";
export { TIKZ_UNIT, lineWidthFromPt, lineWidthFromTikzDimension } from "../tikz/metrics.js";

export function parseFinitePgfLength(value, env, fallback) {
  if (value === undefined || value === null || value === true || value === "") return fallback;
  const substituted = substituteVariables(value, env.variables).replace(/\{\}/g, "").trim();
  const text = stripOuterBraces(substituted);
  const hasExplicitUnit = /(?:cm|mm|pt|em|ex|in)\s*$/.test(text);
  const length = !hasExplicitUnit && /^[+\-*/().\d\s]+$/.test(text) ? `${text}pt` : value;
  const parsed = parseDimension(length, env.variables);
  return Number.isFinite(parsed) ? parsed : fallback;
}
