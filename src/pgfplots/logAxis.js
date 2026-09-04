const DEFAULT_DISPLAY_LOG_BASE = 10;

export function axisLogBase(axisOptions = {}, axis) {
  const raw = axisOptions[`log basis ${axis}`] ?? axisOptions[`log base ${axis}`];
  if (raw === undefined || raw === null || raw === true || String(raw).trim() === "") {
    return DEFAULT_DISPLAY_LOG_BASE;
  }
  const text = String(raw).trim().toLowerCase();
  if (text === "e") return DEFAULT_DISPLAY_LOG_BASE;
  const base = Number(text);
  return Number.isFinite(base) && base > 0 && Math.abs(base - 1) > 1e-12
    ? base
    : DEFAULT_DISPLAY_LOG_BASE;
}

export function axisLogMajorTickValues(axisOptions = {}, axis, min, max, desiredTicks = 5) {
  const low = Number(min);
  const high = Number(max);
  if (!(low > 0 && high > low)) return [];
  const base = axisLogBase(axisOptions, axis);
  const minExponent = logarithm(low, base);
  const maxExponent = logarithm(high, base);
  const target = Math.max(3, Math.floor(Number(desiredTicks) || 5));
  const rawStep = (maxExponent - minExponent) / Math.max(1, target - 2);
  const exponentStep = niceLogExponentStep(rawStep);
  const alignedExponent = Math.ceil((minExponent - 1e-10) / exponentStep) * exponentStep;
  const firstExponent = exponentStep > 1
    ? alignedExponent + Math.floor(exponentStep / 2)
    : alignedExponent;
  const ticks = [];
  for (let exponent = firstExponent; exponent <= maxExponent + 1e-10; exponent += exponentStep) {
    const value = roundLogValue(base ** exponent);
    if (value >= low * (1 - 1e-10) && value <= high * (1 + 1e-10)) ticks.push(value);
    if (ticks.length >= 200) break;
  }
  return ticks;
}

export function axisLogMinorTickValues(axisOptions = {}, axis, majorTicks = [], min, max) {
  const base = axisLogBase(axisOptions, axis);
  if (Math.abs(base - DEFAULT_DISPLAY_LOG_BASE) > 1e-12) return [];
  const exponents = majorTicks
    .map((tick) => logarithm(Number(tick), base))
    .filter(Number.isFinite);
  if (exponents.length >= 2 && exponents.some((value, index) => index > 0 && Math.abs(value - exponents[index - 1] - 1) > 1e-8)) {
    return [];
  }
  const low = Number(min);
  const high = Number(max);
  if (!(low > 0 && high > low)) return [];
  const firstDecade = Math.floor(logarithm(low, base));
  const lastDecade = Math.ceil(logarithm(high, base));
  const ticks = [];
  for (let exponent = firstDecade; exponent < lastDecade; exponent += 1) {
    const decade = base ** exponent;
    for (let multiplier = 2; multiplier <= 9; multiplier += 1) {
      const value = roundLogValue(multiplier * decade);
      if (value >= low * (1 - 1e-10) && value <= high * (1 + 1e-10)) ticks.push(value);
    }
  }
  return ticks;
}

export function axisLogTickLabel(axisOptions = {}, axis, value) {
  const base = axisLogBase(axisOptions, axis);
  const exponent = logarithm(Number(value), base);
  if (!Number.isFinite(exponent)) return "";
  const rounded = Math.round(exponent);
  const displayExponent = Math.abs(exponent - rounded) < 1e-8
    ? String(rounded)
    : String(Number(exponent.toFixed(2)));
  return `$${formatLogBase(base)}^{${displayExponent}}$`;
}

export function axisValueIsValidForScale(value, axisOptions = {}, axis) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return false;
  return !isLogAxisOption(axisOptions, axis) || numeric > 0;
}

export function axisPointIsValidForScale(point = {}, axisOptions = {}) {
  return axisValueIsValidForScale(point.x, axisOptions, "x") &&
    axisValueIsValidForScale(point.y, axisOptions, "y") &&
    (point.z === undefined || point.z === null || axisValueIsValidForScale(point.z, axisOptions, "z"));
}

function isLogAxisOption(axisOptions, axis) {
  return String(axisOptions[`${axis}mode`] || axisOptions[`${axis} scale`] || "")
    .trim()
    .toLowerCase() === "log";
}

function logarithm(value, base) {
  return value > 0 ? Math.log(value) / Math.log(base) : NaN;
}

function roundLogValue(value) {
  if (!Number.isFinite(value)) return NaN;
  return Number(value.toPrecision(12));
}

function niceLogExponentStep(rawStep) {
  if (!Number.isFinite(rawStep) || rawStep < 2) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const fraction = rawStep / magnitude;
  const niceFraction = fraction < 2 ? 1 : fraction < 5 ? 2 : 5;
  return Math.max(1, Math.floor(niceFraction * magnitude));
}

function formatLogBase(base) {
  const integer = Math.round(base);
  return Math.abs(base - integer) < 1e-10 ? String(integer) : String(Number(base.toPrecision(8)));
}
