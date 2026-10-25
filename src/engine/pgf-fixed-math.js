// PGF's dimension arithmetic, used where a more accurate float changes geometry.
// Sources: pgfmathfunctions.basic.code.tex and pgfmathfunctions.misc.code.tex.
const SP = 65536;
const scaled = value => Math.round(value * SP);
export const pgfFixedPoint = value => scaled(value) / SP;
export const pgfFixedMultiply = (value, factor) => Math.trunc(scaled(value) * scaled(factor) / SP) / SP;

// TeX's print_scaled emits the shortest decimal that round-trips to a dimension.
// PGF shifts those printed digits when dividing by ten, so integer sp / 10
// rounding alone differs at half-sp boundaries.
export function dimensionDecimal(value) {
  const dimension = Math.abs(scaled(value));
  let remainder = 10 * (dimension % SP) + 5;
  let delta = 10;
  let fraction = "";
  do {
    if (delta > SP) remainder += SP / 2 - 50000;
    fraction += Math.floor(remainder / SP);
    remainder = 10 * (remainder % SP);
    delta *= 10;
  } while (remainder > delta);
  return `${value < 0 ? "-" : ""}${Math.floor(dimension / SP)}.${fraction}`;
}

export function pgfFixedReciprocal(value) {
  const sign = Math.sign(value);
  const [whole, decimals] = dimensionDecimal(Math.abs(value)).split(".");
  const fraction = decimals.padEnd(5, "0");
  if (Number(fraction) === 0) return Number(whole) ? sign * Math.trunc(SP / Number(whole)) / SP : NaN;
  const large = Number(whole) > 100;
  const divisor = Number(whole + (large ? fraction.slice(0, 3) : fraction));
  const digits = Math.trunc(1e9 / divisor);
  const integer = Math.trunc(digits / 10000);
  let remainder = (digits - integer * 10000) * SP;
  if (large) remainder = Math.trunc(remainder / 1e6);
  else for (let i = 0; i < 4; i++) remainder = Math.trunc(remainder * scaled(.1) / SP);
  return sign * (integer + remainder / SP);
}

export function pgfFixedDivide(numerator, denominator) {
  let a = scaled(numerator), b = scaled(denominator);
  if (b === 0) return NaN;
  if (b % SP === 0) return Math.trunc(a / (b / SP)) / SP;
  const sign = Math.sign(a) * Math.sign(b);
  a = Math.abs(a); b = Math.abs(b);
  if (b < SP) return sign * pgfFixedMultiply(a / SP, pgfFixedReciprocal(b / SP));
  // Native long division stops when either remainder is at most one sp.
  // Dividing the denominator by ten rounds back to a TeX dimension each time.
  let result = 0, place = 1;
  while (a > 1 && b > 1) {
    if (b > a) {
      b = scaled(Number(dimensionDecimal(b / SP)) / 10);
      place /= 10;
    } else {
      const digit = Math.trunc(a / b);
      result += digit * place;
      a -= digit * b;
    }
  }
  return sign * pgfFixedPoint(result);
}

export function pgfFixedVectorLength(dx, dy) {
  let [x, y] = [Math.abs(pgfFixedPoint(dx)), Math.abs(pgfFixedPoint(dy))].sort((a, b) => a - b);
  if (x === 0) return y;
  const scale = y > 10000 ? 1500 : y > 1000 ? 150 : y > 100 ? 50 : 1;
  x = Math.trunc(scaled(x) / scale) / SP;
  y = Math.trunc(scaled(y) / scale) / SP;
  x = pgfFixedMultiply(x, pgfFixedReciprocal(y));
  const square = pgfFixedMultiply(x, x);
  let length = pgfFixedMultiply(square, -.01019210944) + pgfFixedPoint(.04453994279);
  length = pgfFixedMultiply(length, square) + pgfFixedPoint(-.1195159052);
  length = pgfFixedMultiply(length, square) + pgfFixedPoint(.4993615349);
  length = pgfFixedMultiply(length, square) + pgfFixedPoint(1.000012594);
  return pgfFixedMultiply(length, y) * scale;
}
