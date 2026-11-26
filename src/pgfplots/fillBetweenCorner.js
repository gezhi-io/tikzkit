import { literalRegisterLengthCm } from "../engine/units.js";
import { stripOuterBraces } from "../engine/options.js";
import { pgfplotsCompatAtLeast, pgfplotsCompatLevel } from "./compat.js";
import { axisNumber } from "./coordinates.js";
import { fillBetweenSurveyForGeometry } from "./fillBetweenSurvey.js";
import { nativeLogRegisterBase } from "./logAxis.js";
import { isLogAxis } from "./ranges.js";

const ptPerCm = 72.27 / 2.54;

// Invert the raw linear register T(d) = 10^e (d - min). PGF chooses e
// from the decimal orders of the requested size and the surveyed limits,
// then increases it when subtraction would discard significant digits.
function rawToData(value, dim, ranges, geometry, axis) {
  if (isLogAxis(axis, dim)) return nativeLogRegisterBase(axis, dim) ** value;
  if (axis.disabledatascaling === true || axis.disabledatascaling === "true") return value;
  const survey = fillBetweenSurveyForGeometry(geometry);
  const lo = Math.min(ranges[dim + "Min"], survey?.[dim + "Min"] ?? Infinity);
  const hi = Math.max(ranges[dim + "Max"], survey?.[dim + "Max"] ?? -Infinity);
  if (!Number.isFinite(lo) || !(hi > lo)) return NaN;
  if (value === 0) return lo;
  const extent = dim === "x" ? "width" : "height";
  const literal = literalRegisterLengthCm(axis[extent]);
  const size = (Number.isFinite(literal) ? literal : geometry[extent]) * ptPerCm;
  if (!(size > 0) || !Number.isFinite(size)) return NaN;
  let factor = 10 ** (Math.floor(Math.log10(size)) - Math.floor(Math.log10(Math.max(Math.abs(lo), Math.abs(hi)))));
  while (Number.isFinite(factor) && Math.abs(hi * factor) < 1500 &&
      (hi - lo) * factor >= .0001 && (hi - lo) * factor < 100) factor *= 10;
  return factor > 0 && Number.isFinite(factor) ? lo + value / factor : NaN;
}

// tikz@parse@regular handles a physical pair as a single canvas offset.
// With only one length it adds that offset to a pgfpointxy with a zero in
// the same slot. Compat >= 1.11 replaces pgfpointxy with axis cs.
export function bareFillBetweenCorner(fields, ranges, geometry, axis) {
  const dims = ["x", "y"], lengths = fields.map(v => literalRegisterLengthCm(stripOuterBraces(v)));
  const physical = lengths.map(Number.isFinite);
  const compat = axis["compat/pgfpoint substitution"] ?? axis["/pgfplots/compat/pgfpoint substitution"] ?? pgfplotsCompatLevel(axis);
  const asData = pgfplotsCompatAtLeast(compat, "1.11") && !physical.every(Boolean);
  const data = {};
  for (const [i, dim] of dims.entries()) {
    const v = physical[i] ? 0 : axisNumber(fields[i], NaN);
    if (!Number.isFinite(v)) return null;
    if (asData && isLogAxis(axis, dim) && !(v > 0)) return null;
    data[dim] = asData ? v : rawToData(v, dim, ranges, geometry, axis);
    if (!Number.isFinite(data[dim])) return null;
  }
  const p = geometry.mapPoint(data);
  return p && { x: p.x + (physical[0] ? lengths[0] : 0), y: p.y + (physical[1] ? lengths[1] : 0) };
}
