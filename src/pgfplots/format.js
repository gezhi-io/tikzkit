export function roundAxis(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

export function roundAxisRange(value, axis = "") {
  const number = Number(value);
  if (!Number.isFinite(number)) return number;
  const decimals = axis === "z" && Math.abs(number) < 0.1 ? 12 : 3;
  const factor = 10 ** decimals;
  return Math.round((number + Number.EPSILON) * factor) / factor;
}

export function formatAxisNumber(value) {
  return String(roundAxis(value)).replace(/^-0$/, "0");
}

export function formatAxisPoint(point) {
  return `(${formatAxisNumber(point.x)},${formatAxisNumber(point.y)})`;
}

export function formatAxisTickLabel(value, options = {}) {
  const label = formatAxisNumberForTick(value, options);
  const negative = label.startsWith("-");
  const unsigned = negative ? label.slice(1) : label;
  const separator = options.thousandSeparator === undefined ? "," : String(options.thousandSeparator);
  const decimalSeparator = options.decimalSeparator === undefined ? "." : String(options.decimalSeparator);
  const match = /^(\d+)(?:\.(\d+))?$/.exec(unsigned);
  if (!match) return negative ? `−${unsigned}` : unsigned;
  const integer = separator && match[1].length >= 4
    ? match[1].replace(/\B(?=(\d{3})+(?!\d))/g, separator)
    : match[1];
  const grouped = match[2] === undefined ? integer : `${integer}${decimalSeparator}${match[2]}`;
  return negative ? `−${grouped}` : grouped;
}

export function createScaledTickFormat(values, options = {}) {
  if (scaledTicksDisabled(options)) {
    return unscaledTickFormat();
  }
  const finiteValues = (values || []).map(Number).filter((value) => Number.isFinite(value) && Math.abs(value) > 0);
  if (!finiteValues.length) {
    return unscaledTickFormat();
  }
  const maxAbs = Math.max(...finiteValues.map((value) => Math.abs(value)));
  const exponent = Math.floor(Math.log10(maxAbs));
  const below = Number.isFinite(Number(options.scaleTicksBelowExponent))
    ? Number(options.scaleTicksBelowExponent)
    : -1;
  const above = Number.isFinite(Number(options.scaleTicksAboveExponent))
    ? Number(options.scaleTicksAboveExponent)
    : 3;
  if (exponent >= below && exponent <= above) {
    return unscaledTickFormat();
  }
  const factor = 10 ** exponent;
  return {
    exponent,
    factor,
    scaled: true,
    scaleLabel: `\\cdot 10^{${exponent}}`
  };
}

export function formatScaledAxisTickLabel(value, tickFormat, options = {}) {
  const format = tickFormat?.scaled ? tickFormat : unscaledTickFormat();
  const scaledValue = format.scaled ? Number(value) / format.factor : Number(value);
  return formatAxisNumberForTick(scaledValue, options);
}

function formatAxisNumberForTick(value, options = {}) {
  const requestedPrecision = Number(options.precision);
  const precision = Number.isInteger(requestedPrecision) && requestedPrecision >= 0 && requestedPrecision <= 12
    ? requestedPrecision
    : options.fixed || options.fixedZeroFill
      ? 2
      : NaN;
  if (Number.isInteger(precision) && precision >= 0 && precision <= 12) {
    const rounded = Number(value).toFixed(precision);
    if (options.fixedZeroFill) return rounded.replace(/^-0(?:\.0+)?$/, precision ? `${(0).toFixed(precision)}` : "0");
    return String(Number(rounded)).replace(/^-0$/, "0");
  }
  return formatAxisNumber(value);
}

function scaledTicksDisabled(options = {}) {
  const candidates = [
    options.scaledTicks,
    options["scaled ticks"],
    options.scaledticks
  ];
  return candidates.some((candidate) => {
    if (candidate === false) return true;
    if (candidate === undefined || candidate === null) return false;
    const normalized = String(candidate).trim().toLowerCase();
    return normalized === "false" || normalized === "none" || normalized === "manual:{}{}";
  });
}

function unscaledTickFormat() {
  return {
    exponent: 0,
    factor: 1,
    scaled: false,
    scaleLabel: ""
  };
}

export function joinOptions(parts) {
  return parts.filter(Boolean).join(", ");
}
