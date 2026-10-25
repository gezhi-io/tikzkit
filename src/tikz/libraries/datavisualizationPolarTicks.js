import { pgfCos } from "../../engine/safe-expression.js";
import { dimensionDecimal, pgfFixedDivide, pgfFixedMultiply, pgfFixedPoint, pgfFixedReciprocal } from "../../engine/pgf-fixed-math.js";

// tikzpointandanchordirection rotates the normalized axis direction before
// tikz@auto@anchor selects a compass anchor with a 0.05pt dead zone.
export function polarTickTextAnchor(direction) {
  const length = Math.hypot(direction.x, direction.y) || 1;
  const x = direction.x / length;
  const y = direction.y / length;
  const vertical = y > .05 ? "south" : y < -.05 ? "north" : "";
  const horizontal = x > .05 ? "west" : x < -.05 ? "east" : "";
  return [vertical, horizontal].filter(Boolean).join(" ") || "west";
}
const PT_PER_CM = 72.27 / 2.54;
// The library's radians mapper is 0.03141592653589793 -> 1.8. FPU division
// normalizes both mantissas to [10,100), prints the dimension, then restores
// exponents. Using 180 / Math.PI instead omits this native rounding step.
const RADIAN_SCALE = Number(dimensionDecimal(pgfFixedDivide(18, 31.41592653589793))) * 100;
export const polarRadiansToDegrees = value => value * RADIAN_SCALE;

// The polar transformer uses PGF's degree lookup and dimension multiplication,
// not full-precision trigonometry. Unit vectors are applied after projection.
export function polarProjectedPoint(degrees, radiusCm, basis) {
  const radius = pgfFixedPoint(radiusCm * PT_PER_CM);
  const x = pgfFixedMultiply(pgfCos(degrees), radius);
  const y = pgfFixedMultiply(pgfCos(degrees - 90), radius);
  return {
    x: (pgfFixedMultiply(x, basis.zero.x) + pgfFixedMultiply(y, basis.ninety.x)) / PT_PER_CM,
    y: (pgfFixedMultiply(x, basis.zero.y) + pgfFixedMultiply(y, basis.ninety.y)) / PT_PER_CM
  };
}

// pgfpatharcaxes constructs a 1pt arc before transforming by the radius vectors.
// Keep that order: quantizing a full-radius ideal circle has different controls.
export function polarArcPath(startDegrees, endDegrees, radiusCm, basis) {
  const project = (x, y) => {
    const radius = pgfFixedPoint(radiusCm * PT_PER_CM);
    const px = pgfFixedMultiply(x, radius);
    const py = pgfFixedMultiply(y, radius);
    return {
      x: (pgfFixedMultiply(px, basis.zero.x) + pgfFixedMultiply(py, basis.ninety.x)) / PT_PER_CM,
      y: (pgfFixedMultiply(px, basis.zero.y) + pgfFixedMultiply(py, basis.ninety.y)) / PT_PER_CM
    };
  };
  const unitPoint = (angle, radius = 1) => ({ x: pgfFixedMultiply(pgfCos(angle), radius), y: pgfFixedMultiply(pgfCos(angle - 90), radius) });
  const coordinate = point => `(${point.x.toFixed(7)},${point.y.toFixed(7)})`;
  let angle = pgfFixedPoint(startDegrees);
  const end = pgfFixedPoint(endDegrees);
  const first = unitPoint(angle);
  const path = [coordinate(project(first.x, first.y))];
  while (Math.abs(end - angle) > 1e-9) {
    const remaining = Math.abs(end - angle);
    const step = remaining > 115 ? 90 : remaining > 90 ? 60 : remaining;
    const sign = Math.sign(end - angle);
    const next = pgfFixedPoint(angle + sign * step);
    const quarter = pgfFixedPoint(step / 4);
    const tangent = pgfFixedMultiply(pgfCos(quarter - 90), pgfFixedReciprocal(pgfCos(quarter)));
    const factor = step === 90 ? pgfFixedPoint(.55228475) : pgfFixedMultiply(1.333333333, tangent);
    const startPoint = unitPoint(angle);
    const endPoint = unitPoint(next);
    const tangent1 = unitPoint(angle + sign * 90, factor);
    const tangent2 = unitPoint(next - sign * 90, factor);
    path.push(`.. controls ${coordinate(project(startPoint.x + tangent1.x, startPoint.y + tangent1.y))} and ${coordinate(project(endPoint.x + tangent2.x, endPoint.y + tangent2.y))} .. ${coordinate(project(endPoint.x, endPoint.y))}`);
    angle = next;
  }
  return path.join(" ");
}
