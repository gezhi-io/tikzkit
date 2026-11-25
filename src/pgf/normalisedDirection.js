import { PGF_SP, pgfDimension, pgfFixedDivide, pgfFixedMultiply, pgfFixedReciprocal,
  pgfPrintDimension } from "../engine/pgf-fixed-point.js";
import { pgfCos } from "../engine/safe-expression.js";

// pgfmathatan@ interpolates a table of degrees at thousandths of slope.
// Its five decimal places are truncated from six-place rounded values.
function atanEntry(index) {
  const degrees = Math.atan(index / 1000) * 180 / Math.PI;
  const tableValue = Math.trunc(Math.round(degrees * 1e6) / 10) / 1e5;
  return Math.round(tableValue * PGF_SP) / PGF_SP;
}

function atanDegrees(ratio) {
  const slope = ratio > 1 ? pgfFixedReciprocal(ratio) : ratio;
  const position = pgfDimension(Number(pgfPrintDimension(slope)) * 1000);
  const index = Math.floor(position);
  let angle = atanEntry(index);
  if (index < 1000) angle += pgfFixedMultiply(position - index, atanEntry(index + 1) - angle);
  return ratio > 1 ? 90 - angle : angle;
}

function directionDegrees(dx, dy) {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (dx === 0) return dy < 0 ? -90 : 90;
  if (ay < Math.round(.001 * PGF_SP)) return dx < 0 ? 180 : 0;
  const slope = pgfFixedDivide(Math.min(ax, ay) / PGF_SP, Math.max(ax, ay) / PGF_SP);
  const acute = atanDegrees(slope);
  const angle = ay > ax ? 90 - acute : acute;
  return (dy < 0 ? -1 : 1) * (dx < 0 ? 180 - angle : angle);
}

// pgfmathatan2: signed TeX sp in, signed degrees out.
export { directionDegrees as pgfDirectionDegreesSp };

// pgfpointnormalised: signed TeX sp in, components of a 1pt vector in sp out.
export function pgfNormalisedDirectionSp(dx, dy) {
  const angle = directionDegrees(dx, dy);
  return { x: Math.round(pgfCos(angle) * PGF_SP), y: Math.round(pgfCos(angle - 90) * PGF_SP) };
}
