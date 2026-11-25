import { substituteVariables } from "../engine/math.js";
import { splitTopLevel, stripOuterBraces } from "../engine/options.js";
import { MathExpressionError, mathFailure } from "../engine/safe-expression.js";
import { expandForeachValues, reserveForeachListScan } from "../tikz/commands/foreach.js";

function countRegister(value, variables, key) {
  const text = substituteVariables(stripOuterBraces(value), variables, { maxLength: 1024 }).trim();
  const n = Number(text);
  if (/^[+-]?\d+$/.test(text) && Math.abs(n) <= 0x7fffffff) return n;
  throw new MathExpressionError(mathFailure(text, "plot-mark-count", key + " requires a signed TeX integer.").diagnostic);
}

// Each replay owns its counter. Advance it only when a point reaches the
// native marker handler, not when surveying a curve or constructing its path.
export function createPlotMarkSelector(options = {}, variables = {}, foreachBudget) {
  let repeat, phase, list = "";
  for (const layer of Array.isArray(options) ? options : [options]) {
    for (const [key, value] of Object.entries(layer || {})) {
      switch (key.replace(/^\/tikz\//, "")) {
        case "mark repeat": repeat = value; break;
        case "mark phase": phase = value; break;
        case "mark indices": list = stripOuterBraces(value); break;
      }
    }
  }
  if (repeat === undefined && phase === undefined && !list) return () => true;
  repeat = countRegister(repeat ?? 1, variables, "mark repeat");
  let count = repeat - countRegister(phase ?? 1, variables, "mark phase");
  if (list) {
    const env = { variables, foreachBudget };
    const budget = reserveForeachListScan(list, env);
    const expanded = substituteVariables(list, variables, { maxLength: budget.remainingCharacters });
    // PGF compares printed counter tokens. "01" and "1.0" are not "(1)".
    const indices = new Set(expandForeachValues(splitTopLevel(expanded).map(stripOuterBraces), env, { dimensionRanges: true }));
    return () => indices.has(String(++count));
  }
  return () => {
    if (++count < repeat) return false;
    count = 0;
    return true;
  };
}
