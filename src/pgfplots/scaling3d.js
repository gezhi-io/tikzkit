import { createMathRuntime } from "../engine/safe-expression.js";
import { pgfplotsCompatAtLeast, pgfplotsCompatLevel } from "./compat.js";
import { isLogAxis } from "./ranges.js";
import { axisLogBase } from "./logAxis.js";

const SP = 65536;
const PT_PER_CM = 72.27 / 2.54;
const dimension = value => Math.round(value * SP) / SP;
const multiply = (value, scale) => Math.trunc(dimension(value) * dimension(scale) * SP) / SP;
const printed = value => Number(dimension(value).toFixed(5));

export function usesNative3DScaling(options = {}) {
  const mode = String(options["scale mode"] || "auto").trim();
  return Boolean(options["pgfplots 3d surface"]) &&
    ["auto", "stretch to fill"].includes(mode) &&
    !options["unit vector ratio*"] && !options["axis equal"] && !options["axis equal image"] &&
    !["x", "y", "z"].some(axis => options[`pgfplots explicit ${axis} unit`]);
}

export function resolveNative3DRequestedSize(width, height, { inferWidth = false, inferHeight = false } = {}) {
  // PGF computes the default aspect ratio with dimension arithmetic, then
  // uses that rounded value again to infer a missing width or height.
  const aspect = basicDivide(240, 207);
  let widthPt = dimension(width * PT_PER_CM);
  let heightPt = dimension(height * PT_PER_CM);
  if (inferWidth) widthPt = multiply(heightPt, aspect);
  if (inferHeight) heightPt = dimension(basicDivide(widthPt, aspect));
  return { width: widthPt / PT_PER_CM, height: heightPt / PT_PER_CM };
}

// Initial sizing uses PGF's fixed-point division. The final reciprocal and
// multiplication switch at compat=1.4 and 1.6 respectively. Per-component
// rounding cannot be replaced with a constant label reserve.
export function createNative3DProjection({ options = {}, view, ratio, ranges, width, height, requestedWidth, requestedHeight }) {
  const compat = pgfplotsCompatLevel(options);
  const floatReciprocal = pgfplotsCompatAtLeast(compat, "1.4", { unset: true });
  const floatFinalScale = pgfplotsCompatAtLeast(compat, "1.6");
  const trig = createMathRuntime({ pgfTrig: true });
  const sinAz = trig.sin.fn(view.azimuth);
  const cosAz = trig.cos.fn(view.azimuth);
  const sinEl = trig.sin.fn(-view.elevation);
  const cosEl = trig.cos.fn(-view.elevation);
  const raw = [
    { x: multiply(cosAz, ratio.x), y: multiply(printed(multiply(sinAz, sinEl)), ratio.x) },
    { x: multiply(sinAz, ratio.y), y: multiply(printed(multiply(-sinEl, cosAz)), ratio.y) },
    { x: 0, y: multiply(cosEl, ratio.z) }
  ];
  const rawWidth = raw.reduce((sum, v) => sum + Math.abs(v.x), 0);
  const rawHeight = raw.reduce((sum, v) => sum + Math.abs(v.y), 0);
  const scales = {
    x: basicDivide(width * PT_PER_CM, rawWidth),
    y: basicDivide(height * PT_PER_CM, rawHeight)
  };
  const vectors = raw.map((vector, index) => {
    const axis = "xyz"[index];
    const sizePt = axis === "z" && !floatReciprocal ? 42 :
      (axis === "x" ? requestedWidth : requestedHeight) * PT_PER_CM;
    // Log coordinates enter scaling already transformed, without the linear
    // power-of-ten data rescaling. The default internal basis is e, not 10.
    const logBasis = options[`log basis ${axis}`] ?? options[`log base ${axis}`];
    const span = isLogAxis(options, axis)
      ? dimension(Math.log(ranges[`${axis}Max`] / ranges[`${axis}Min`]) /
        (logBasis && logBasis !== "e" ? Math.log(axisLogBase(options, axis)) : 1))
      : transformedSpan(ranges[`${axis}Min`], ranges[`${axis}Max`], sizePt);
    const reciprocal = floatReciprocal ? 1 / span : basicReciprocal(span);
    const component = coordinate => {
      const finalScale = floatFinalScale ? scales[coordinate] * reciprocal :
        printed(multiply(scales[coordinate], reciprocal));
      return multiply(vector[coordinate], finalScale) * span / PT_PER_CM;
    };
    return { x: component("x"), y: component("y") };
  });
  const minX = vectors.reduce((sum, v) => sum + Math.min(0, v.x), 0);
  const minY = vectors.reduce((sum, v) => sum + Math.min(0, v.y), 0);
  const project = (x, y, z) => ({
    x: x * vectors[0].x + y * vectors[1].x + z * vectors[2].x - minX,
    y: x * vectors[0].y + y * vectors[1].y + z * vectors[2].y - minY
  });
  return {
    project,
    width: vectors.reduce((sum, v) => sum + Math.abs(v.x), 0),
    height: vectors.reduce((sum, v) => sum + Math.abs(v.y), 0)
  };
}

function basicDivide(numerator, denominator) {
  // pgfmathdivide@@ repeatedly divides the denominator by ten, rounding
  // that dimension each time. IEEE division followed by one final rounding
  // differs enough to select another scaled-point unit vector.
  let x = Math.round(numerator * SP);
  let y = Math.round(denominator * SP);
  if (y % SP === 0) return printed(Math.trunc(x / (y / SP)) / SP);
  if (y < SP) return printed(multiply(x / SP, basicReciprocal(y / SP)));
  let result = 0, place = 1;
  for (let i = 0; x > 1 && y > 1 && i < 64; i += 1) {
    if (y > x) {
      y = Math.round(printed(y / SP) * SP / 10);
      place *= 10;
    } else {
      const digit = Math.trunc(x / y);
      x -= digit * y;
      result += digit / place;
    }
  }
  return printed(result);
}

function basicReciprocal(value) {
  // pgfmathfunctions.basic.code.tex: decimal integer division followed by
  // TeX truncation, not a rounded IEEE reciprocal (compat <= 1.3).
  const number = printed(value);
  if (Number.isInteger(number)) return Math.trunc(SP / number) / SP;
  if (number > 100) {
    const quotient = Math.trunc(1e9 / Math.trunc(number * 1000));
    return Math.trunc(quotient / 10000) + Math.trunc((quotient % 10000) * SP / 1e6) / SP;
  }
  const quotient = Math.trunc(1e9 / Math.round(number * 100000));
  let fraction = quotient % 10000;
  for (let i = 0; i < 4; i += 1) fraction = multiply(fraction, .1);
  return Math.trunc(quotient / 10000) + fraction;
}

function transformedSpan(min, max, sizePt) {
  // set@optimal@datatrafo@for@: T(x)=10^(q-m)*x-shift, with a
  // cancellation guard when the data occupy less than 100 transformed units.
  const span = Math.abs(max - min) || 1;
  const magnitude = Math.max(Math.abs(min), Math.abs(max)) || 1;
  let exponent = Math.floor(Math.log10(sizePt)) - Math.floor(Math.log10(magnitude));
  while (span * 10 ** exponent < 100 && Math.abs(max) * 10 ** exponent < 1500 &&
    span * 10 ** exponent >= 0.0001) exponent += 1;
  return dimension(span * 10 ** exponent);
}
