import { pgfplotsCompatAtLeast, pgfplotsCompatLevel } from "./compat.js";

const TEX_SCALED_POINT = 65536;

export function samplePgfplotsSurfaceDomain(domain, samples, plotOptions = {}, axisOptions = {}) {
  const count = Math.max(2, Math.round(Number(samples) || 2));
  const start = pgfFixedNumber(domain.start);
  const end = pgfFixedNumber(domain.end);
  const second = pgfFloat(start + sampleStep(end - start, count - 1));
  const step = pgfFloat(second - start);
  if (pgfplotsUsesCorrectSampling(plotOptions, axisOptions)) {
    return Array.from({ length: count }, (_, index) => pgfFloat(pgfFloat(index * step) + start));
  }

  const values = [start];
  for (let index = 1; index < count; index += 1) {
    values.push(pgfFloat(values[index - 1] + step));
  }
  return values;
}

function sampleStep(span, intervals) {
  if (!span) return 0;
  // domain@to@foreach runs with the FPU: divide mantissas in [10,100),
  // then restore their exponents. Fixed-point division of the raw domain
  // loses .1 steps and is invalid for domains such as 0:1e9.
  const aExponent = Math.floor(Math.log10(Math.abs(span))) - 1;
  const bExponent = Math.floor(Math.log10(intervals)) - 1;
  let numerator = toScaledPoints(Math.abs(span) / 10 ** aExponent);
  let denominator = toScaledPoints(intervals / 10 ** bExponent);
  let quotient;
  if (denominator % TEX_SCALED_POINT === 0) {
    quotient = fromScaledPoints(Math.trunc(numerator / (denominator / TEX_SCALED_POINT)));
  } else {
    // pgfmathdivide@@ shifts its divisor by decimal places, rounding each
    // TeX dimension. This branch also covers raised sample-count limits.
    let value = 0, place = 1;
    for (let i = 0; numerator > 1 && denominator > 1 && i < 64; i += 1) {
      if (denominator > numerator) {
        denominator = toScaledPoints(fromScaledPoints(denominator) / 10);
        place *= 10;
      } else {
        const digit = Math.trunc(numerator / denominator);
        numerator -= digit * denominator;
        value += digit / place;
      }
    }
    quotient = pgfFixedNumber(value);
  }
  return Math.sign(span) * quotient * 10 ** (aExponent - bExponent);
}

export function pgfplotsUsesCorrectSampling(plotOptions = {}, axisOptions = {}) {
  const explicit = plotOptions["correct sampling"] ?? axisOptions["correct sampling"];
  if (explicit !== undefined && explicit !== null && explicit !== "") {
    return !/^(?:false|0|off|no)$/i.test(String(explicit).trim());
  }
  // compat levels are dotted versions: 1.2 predates 1.13 even though 1.2 > 1.13 as a decimal.
  return pgfplotsCompatAtLeast(pgfplotsCompatLevel(axisOptions, plotOptions), "1.13");
}

function pgfFixedNumber(value) {
  return fromScaledPoints(toScaledPoints(value));
}

function toScaledPoints(value) {
  return Math.round(Number(value) * TEX_SCALED_POINT);
}

function fromScaledPoints(value) {
  return Number((value / TEX_SCALED_POINT).toFixed(5));
}

function pgfFloat(value) {
  return Number(Number(value).toPrecision(8));
}
