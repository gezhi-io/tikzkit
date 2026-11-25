import { stripOuterBraces } from "../engine/options.js";
import { evaluateAxisExpression } from "./expressions.js";
import { sampleFunctionDataPoints, sampleParametricDataPoints } from "./rangeResolver.js";

// Both statistics handlers survey one scalar per input row before ordinary
// x/y coordinate filtering. An unused coordinate need not be finite.
export function scalarSurveyRows(plot, axis, options) {
  if (plot.type === "coordinates") return plot.points ?? [];
  if (plot.type === "function") return sampleFunctionDataPoints(plot, axis, { ...options, scalarSurvey: true });
  if (plot.type === "parametric") return sampleParametricDataPoints(plot, axis, { ...options, scalarSurvey: true });
}

function numberToken(value) {
  return value !== undefined && value !== null && String(value).trim() && Number.isFinite(Number(value))
    ? String(Number(value)) : "nan";
}

/** Expand row-local TeX values before evaluating a PGF math expression.
 * For `data value` TeX reads the expanded number without executing pgfmath. */
export function scalarSurveyNumber(raw, row, context, index, literalOnly = false) {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string" || !raw.trim()) return NaN;
  let source = stripOuterBraces(raw.trim());
  if (!source) return NaN;
  if (!literalOnly && /^[xyz]$/.test(source)) return row?.[source] ?? NaN;
  if (source.includes("\\")) {
    const operand = value => literalOnly ? numberToken(value) : `(${numberToken(value)})`;
    source = source.replace(/\\(plotnumofactualtype|plotnum|coordindex|pgfmathresult)\b/g, (_, key) =>
      operand(key === "plotnumofactualtype" ? context.ordinal : key === "plotnum" ? context.plotIndex :
        key === "coordindex" ? index : context.filterInput))
      .replace(/\\thisrow\s*\{([^{}]+)\}/g, (_, key) => operand(row?.columns?.[key.trim()]))
      .replace(/\\pgfkeysvalueof\s*\{\/data point\/([xyz])\}/g, (_, key) => operand(row?.[key]));
  }
  const literal = Number(source);
  if (Number.isFinite(literal) || literalOnly) return literal;
  return evaluateAxisExpression(source, row?.x, context.axis, { y: row?.y, z: row?.z });
}
