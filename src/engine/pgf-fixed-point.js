import { dimensionDecimal } from "./pgf-fixed-math.js";

export const PGF_SP = 65536;
const MAX_DIMENSION_SP = 1073741823;

// TeX's dimension scanner retains 17 decimal places, then converts by
// round_decimals (TeX82 sections 102/452). Keep the token spelling: adjacent
// decimal strings at a half-sp boundary can become the same JS Number.
export function pgfDimension(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || Math.abs(number) >= 16384) return NaN;
  if (number === 0) return 0;
  const match = String(value).trim().match(/^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if (!match) return NaN;
  const digits = match[2] + (match[3] || "");
  const point = match[2].length + Number(match[4] || 0);
  const integer = point <= 0 ? 0 : Number(digits.slice(0, point).padEnd(point, "0"));
  const fraction = (point < 0 ? "0".repeat(-point) + digits : digits.slice(point)).slice(0, 17);
  let accumulator = 0;
  for (let i = fraction.length - 1; i >= 0; i -= 1) {
    accumulator = Math.floor((accumulator + Number(fraction[i]) * 2 * PGF_SP) / 10);
  }
  const scaled = integer * PGF_SP + Math.floor((accumulator + 1) / 2);
  if (scaled > MAX_DIMENSION_SP) return NaN;
  return scaled === 0 ? 0 : (match[1] === "-" ? -scaled : scaled) / PGF_SP;
}

export function pgfFixedMultiply(left, right) {
  return Math.trunc(left * right * PGF_SP) / PGF_SP;
}

export function pgfFixedDivide(left, right) {
  let x = pgfDimension(left) * PGF_SP;
  let y = pgfDimension(right) * PGF_SP;
  if (!Number.isFinite(x) || !Number.isFinite(y) || y === 0) return NaN;
  if (y % PGF_SP === 0) return Math.trunc(x / (y / PGF_SP)) / PGF_SP;
  const sign = Math.sign(x) * Math.sign(y);
  x = Math.abs(x);
  y = Math.abs(y);
  if (y < PGF_SP) {
    return pgfDimension(sign * pgfFixedMultiply(x / PGF_SP, pgfFixedReciprocal(y / PGF_SP)));
  }

  // pgfmathdivide@@ performs decimal long division on dimensions, not doubles.
  // Its stop threshold is 1sp. Even the /10 step scans TeX's printed decimal.
  let result = "0";
  let fractional = false;
  for (let step = 0; step < 64; step += 1) {
    if (x <= 1 || y <= 1) return pgfDimension(`${sign < 0 ? "-" : ""}${result}`);
    if (y > x) {
      if (!fractional) { result += "."; fractional = true; }
      const [integer, fraction] = pgfPrintDimension(y / PGF_SP).split(".");
      y = pgfDimension(`${Math.trunc(Number(integer) / 10)}.${Number(integer) % 10}${fraction}`) * PGF_SP;
      if (y > x) result += "0";
    } else {
      let digit = Math.trunc(x / y);
      x -= digit * y;
      if (fractional && digit > 9) {
        // Rounded divisors can produce 10 here. PGF carries into the previous
        // decimal using a dimension addition, then removes a lone trailing 0.
        const places = Math.min(result.split(".")[1].length, 5);
        const carried = pgfDimension(result) + pgfDimension(10 ** -places);
        if (!Number.isFinite(pgfDimension(carried))) return NaN;
        result = pgfPrintDimension(carried).replace(/\.0$/, ".");
        digit -= 10;
        if (digit === 0) continue;
      }
      result += String(digit);
    }
  }
  return NaN;
}

export function pgfFixedReciprocal(value) {
  const dimension = pgfDimension(value);
  if (!Number.isFinite(dimension) || dimension === 0) return NaN;
  const [integer, fraction] = pgfPrintDimension(dimension).split(".");
  const digits = fraction.padEnd(5, "0");
  if (Number(digits) === 0) return Math.trunc(PGF_SP / Number(integer)) / PGF_SP;

  // pgfmathreciprocal@@ uses three digits only for a POSITIVE integer part
  // greater than 100. Preserve the native asymmetric negative-number branch.
  const large = Number(integer) > 100;
  const divisor = Number(integer + digits.slice(0, large ? 3 : 5));
  const quotient = Math.trunc(1000000000 / divisor);
  const whole = Math.trunc(quotient / 10000);
  let remainder = quotient % 10000;
  if (large) remainder = Math.trunc(remainder * PGF_SP / 1000000) / PGF_SP;
  else {
    // Four .1 dimension multiplications are observably different from /10000.
    for (let i = 0; i < 4; i += 1) remainder = pgfFixedMultiply(remainder, pgfDimension(.1));
  }
  return pgfDimension(whole + remainder);
}

// TeX82 section 103, print_scaled. PGF returns these decimal tokens after
// each operation; they round-trip to the original sp, unlike toFixed(5).
export function pgfPrintDimension(value) {
  if (!Number.isFinite(value) || Math.abs(value * PGF_SP) > MAX_DIMENSION_SP) return "NaN";
  return dimensionDecimal(value);
}

export function pgfScientificLiteral(raw) {
  const [mantissa, exponentText] = raw.toLowerCase().split("e");
  const exponent = Number(exponentText);
  if (!Number.isFinite(pgfDimension(mantissa)) || exponent > 4) return NaN;
  // pgfmathscientific has an explicit underflow branch, even for a large
  // mantissa. Negative exponents divide a five-decimal mantissa in sp;
  // nonnegative exponents shift ten digits, then truncate to five decimals.
  if (exponent < -4) return 0;
  const [integer, fraction = ""] = mantissa.split(".");
  if (exponent < 0) return pgfFixedDivide(pgfDimension(`${integer}.${fraction.slice(0, 5)}`), 10 ** -exponent);
  const digits = integer + fraction.padEnd(10, "0").slice(0, 10);
  const point = integer.length + exponent;
  return pgfDimension(`${digits.slice(0, point)}.${digits.slice(point, point + 5)}`);
}
