import { PGF_SP, pgfDimension } from "../engine/pgf-fixed-point.js";
import { pgfNormalisedDirectionSp } from "../pgf/normalisedDirection.js";

const spPerCm = PGF_SP * 72.27 / 2.54;
const toSp = cm => Math.sign(cm) * Math.round(Math.abs(cm) * spPerCm);
const halfSp = cm => Math.trunc(toSp(cm) / 2);
const ellipseFactor = pgfDimension("1.4142136");
const maxDimenSp = 2 ** 30 - 1;
const times16 = n => Math.max(-maxDimenSp, Math.min(maxDimenSp, 16 * n));

export function isRoundNode(shape) {
  return shape === "circle" || shape === "ellipse";
}

function circleRadiusSp(x, y) {
  const normal = pgfNormalisedDirectionSp(x, y);
  const useX = normal.x > normal.y;
  const count = useX ? normal.x : normal.y;
  if (count === 0) return x; // PGF leaves its width register untouched.
  const divisor = Math.trunc(count / 255);
  const dividend = times16(useX ? x : y);
  // In nonstop TeX, an oversized dimension assignment saturates at maxdimen;
  // a divide by zero reports "Arithmetic overflow" and leaves the dividend alone.
  return times16(divisor === 0 ? dividend : Math.trunc(dividend / divisor));
}

// Scene cm in and out; neither outer separation nor pen is included.
// Height always includes depth. PGF halves the signed ht and dp registers
// separately, truncating each toward zero before adding the inner separation.
export function roundNodeSize(shape, { width = 0, height = 0, depth, innerX = 0, innerY = 0, minWidth = 0, minHeight = 0 } = {}) {
  const halfHeight = Number.isFinite(depth) ? halfSp(height - depth) + halfSp(depth) : halfSp(height);
  const x = halfSp(width) + toSp(innerX), y = halfHeight + toSp(innerY);
  const minX = halfSp(minWidth), minY = halfSp(minHeight);
  if (shape === "circle") {
    const diameter = 2 * Math.max(circleRadiusSp(x, y), minX, minY) / spPerCm;
    return { width: diameter, height: diameter };
  }
  if (shape === "ellipse") {
    return { width: 2 * Math.max(Math.trunc(ellipseFactor * x), minX) / spPerCm,
      height: 2 * Math.max(Math.trunc(ellipseFactor * y), minY) / spPerCm };
  }
  throw new RangeError("Expected a circle or ellipse node, got " + shape);
}
