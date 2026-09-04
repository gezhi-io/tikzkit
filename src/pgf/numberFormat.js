const DEFAULT_PRECISION = 2;

export function pgfNumberFormatOptions(parsed = {}, inherited = {}) {
  const result = { ...inherited };
  for (const [rawKey, value] of Object.entries(parsed || {})) {
    const key = normalizedNumberFormatKey(rawKey);
    if (key === "fixed") result.fixed = pgfNumberFormatBoolean(value);
    else if (key === "fixed zerofill") result.fixedZeroFill = pgfNumberFormatBoolean(value);
    else if (key === "sci") result.scientific = pgfNumberFormatBoolean(value);
    else if (key === "sci zerofill") result.scientificZeroFill = pgfNumberFormatBoolean(value);
    else if (key === "zerofill") {
      const enabled = pgfNumberFormatBoolean(value);
      result.fixedZeroFill = enabled;
      result.scientificZeroFill = enabled;
    } else if (key === "precision") result.precision = finitePrecision(value, result.precision);
    else if (key === "sci precision") {
      const text = pgfNumberFormatText(value);
      result.scientificPrecision = text === "" ? undefined : finitePrecision(text, result.scientificPrecision);
    } else if (key === "use comma" && pgfNumberFormatBoolean(value)) {
      result.decimalSeparator = ",";
      result.thousandSeparator = ".";
    } else if (key === "use period" && pgfNumberFormatBoolean(value)) {
      result.decimalSeparator = ".";
      result.thousandSeparator = ",";
    } else if (key === "1000 sep" || key === "set thousands separator") {
      result.thousandSeparator = pgfNumberFormatText(value);
    } else if (key === "set decimal separator" || key === "dec sep") {
      result.decimalSeparator = pgfNumberFormatText(value);
    } else if (key === "sci 10^e" || key === "sci 10e") {
      result.scientificStyle = "10^e";
    } else if (key === "sci e") {
      result.scientificStyle = "e";
    } else if (key === "sci E") {
      result.scientificStyle = "E";
    }
  }
  return result;
}

export function formatPgfScientificNumber(value, options = {}) {
  const parts = pgfScientificParts(value, options);
  if (!parts) return String(value);
  const exponent = parts.exponent;
  const style = options.scientificStyle || "10^e";
  if (style === "e" || style === "E") {
    const signedExponent = exponent < 0 ? `{-}${Math.abs(exponent)}` : `{+}${exponent}`;
    return `${parts.mantissa}${style}${signedExponent}`;
  }
  return `${parts.mantissa}\\cdot 10^{${exponent}}`;
}

export function pgfScientificParts(value, options = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const precision = finitePrecision(options.scientificPrecision, finitePrecision(options.precision, DEFAULT_PRECISION));
  const zeroFill = Boolean(options.scientificZeroFill);
  let exponent = 0;
  let mantissa = 0;
  if (numeric !== 0) {
    exponent = Math.floor(Math.log10(Math.abs(numeric)));
    mantissa = numeric / (10 ** exponent);
    mantissa = Number(mantissa.toFixed(precision));
    if (Math.abs(mantissa) >= 10) {
      mantissa /= 10;
      exponent += 1;
    }
  }
  const mantissaText = zeroFill
    ? normalizedNegativeZero(mantissa.toFixed(precision))
    : normalizedNegativeZero(String(mantissa));
  return {
    mantissa: formatPgfGroupedNumber(mantissaText, options),
    exponent,
    mantissaValue: mantissa
  };
}

export function formatPgfGroupedNumber(raw, options = {}) {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(String(raw));
  if (!match) return String(raw);
  const [, sign, integerPart, fraction = ""] = match;
  const thousands = options.thousandSeparator === undefined ? "," : String(options.thousandSeparator);
  const decimal = options.decimalSeparator === undefined ? "." : String(options.decimalSeparator);
  const groupedInteger = thousands
    ? integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousands)
    : integerPart;
  return `${sign}${groupedInteger}${fraction ? `${decimal}${fraction}` : ""}`;
}

function normalizedNumberFormatKey(rawKey) {
  return String(rawKey)
    .replace(/^\/pgf\/number format\//, "")
    .replace(/^number format\//, "");
}

function pgfNumberFormatBoolean(value) {
  if (value === false || value === 0) return false;
  return !/^(?:false|0|off|no)$/i.test(String(value).trim());
}

function pgfNumberFormatText(value) {
  if (value === true || value === false || value === null || value === undefined) return "";
  const text = String(value).trim();
  return hasBalancedOuterBraces(text) ? text.slice(1, -1).trim() : text;
}

function finitePrecision(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(15, Math.floor(number))) : fallback;
}

function normalizedNegativeZero(value) {
  return String(value).replace(/^-0(?:\.0+)?$/, (match) => match.includes(".") ? match.slice(1) : "0");
}

function hasBalancedOuterBraces(text) {
  if (!text.startsWith("{") || !text.endsWith("}")) return false;
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    else if (text[index] === "}") depth -= 1;
    if (depth === 0 && index < text.length - 1) return false;
    if (depth < 0) return false;
  }
  return depth === 0;
}
