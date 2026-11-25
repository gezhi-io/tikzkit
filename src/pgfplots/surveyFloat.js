import { PGF_SP, pgfDimension, pgfFixedDivide, pgfFixedMultiply, pgfPrintDimension } from "../engine/pgf-fixed-point.js";

// pgflibraryfpu.code.tex: addition aligns mantissas in [100,1000);
// multiplication and division use [10,100). Each fixed-point result is
// printed back to decimal before the exponent is restored.
function parts(value, shift) {
  const [mantissa, exponent] = value.toExponential().split("e");
  return [pgfDimension(`${mantissa}e${shift}`), Number(exponent) - shift];
}

function restore(mantissa, exponent) {
  return Number(`${pgfPrintDimension(mantissa)}e${exponent}`);
}

export function texAdd(a, b) {
  if (a === 0 || b === 0 || !Number.isFinite(a) || !Number.isFinite(b)) return a + b;
  const [ma, ea] = parts(a, 2), [mb, eb] = parts(b, 2);
  const e = Math.max(ea, eb);
  const align = (m, exp) => Math.trunc(m * PGF_SP / 10 ** (e - exp));
  return restore((align(ma, ea) + align(mb, eb)) / PGF_SP, e);
}

export function texMultiply(a, b) {
  if (a === 0 || b === 0) return 0; // PGF also returns zero for 0 * inf.
  if (!Number.isFinite(a) || !Number.isFinite(b)) return a * b;
  const [ma, ea] = parts(a, 1), [mb, eb] = parts(b, 1);
  return restore(pgfFixedMultiply(ma, mb), ea + eb);
}

export function texDivide(a, b) {
  if (a === 0) return 0;
  if (b === 0 || !Number.isFinite(a) || !Number.isFinite(b)) return a / b;
  const [ma, ea] = parts(a, 1), [mb, eb] = parts(b, 1);
  return restore(pgfFixedDivide(ma, mb), ea - eb);
}

// floatlessthan compares sign, exponent, then the *unshifted* mantissas
// as TeX dimensions. Only nearby, same-sign values can tie at that precision.
export function texLess(a, b) {
  if (!(a < b)) return false;
  if (Math.sign(a) !== Math.sign(b) || !Number.isFinite(b - a) ||
      (b - a) * PGF_SP > Math.max(Math.abs(a), Math.abs(b))) return true;
  const [ma, ea] = parts(a, 0), [mb, eb] = parts(b, 0);
  return ea !== eb || ma !== mb;
}
