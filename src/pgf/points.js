import { pgfCos } from "../engine/safe-expression.js";

// pgfmoduleshapes.code.tex computes circle radii from pgfpointnormalised,
// then divides scaled points by a quantized component. Math.hypot is not
// equivalent: the integer division is visible at small node sizes.
export function pgfNormalisedVectorLength(xCm, yCm) {
  const sp = 65536;
  const spPerCm = sp * 72.27 / 2.54;
  const x = Math.abs(Math.round(xCm * spPerCm));
  const y = Math.abs(Math.round(yCm * spPerCm));
  if (x === 0 && y === 0) return 0;
  const angle = Math.atan2(y, x) * 180 / Math.PI;
  const nx = Math.round(pgfCos(angle) * sp);
  const ny = Math.round(pgfCos(angle - 90) * sp);
  const divisor = Math.trunc(Math.max(nx, ny) / 255);
  return 16 * Math.trunc(16 * (nx > ny ? x : y) / divisor) / spPerCm;
}
