import { evaluateRestrictedExpression, mathFailure, MathExpressionError, mathResultValue, MATH_EXPRESSION_LIMITS } from "./safe-expression.js";

export { MathExpressionError, withMathDiagnostics } from "./safe-expression.js";

let dimensionFont;
const TEX_PT_PER_CM = 28.4527559;
const TEX_SP_PER_PT = 65536;
// Raw TFM fix_words for fontdimen6 (quad/em) and fontdimen5 (x-height/ex).
// Source: TeX Live 2025 fonts/tfm/public/cm and adobe/helvetic; selection follows ot1cmr.fd,
// ot1cmss.fd and ot1cmtt.fd for standard LaTeX sizes. Do not infer em from sizePt.
const CM_FONT_DIMENSIONS = Object.freeze({
  cmr5: [1427251, 451469], cmr6: [1281579, 451469], cmr7: [1194217, 451470],
  cmr8: [1114128, 451470], cmr9: [1077696, 451470], cmr10: [1048579, 451470],
  cmr12: [1026720, 451471], cmr17: [961793, 451403],
  cmbx5: [1590310, 466035], cmbx6: [1454405, 466035], cmbx7: [1357321, 466034],
  cmbx8: [1284516, 466034], cmbx9: [1240800, 466034], cmbx10: [1205856, 466034], cmbx12: [1179648, 466033],
  cmti7: [1264965, 451470], cmti8: [1150524, 451470], cmti9: [1100373, 451470],
  cmti10: [1071872, 451470], cmti12: [1048587, 451471], cmbxti10: [1239638, 466034], cmcsc10: [1159248, 451470],
  cmss8: [1114128, 466034], cmss9: [1077696, 466034], cmss10: [1048579, 466034],
  cmss12: [1026720, 466033], cmss17: [986067, 451403], cmssbx10: [1153440, 480597],
  cmtt8: [1114128, 451470], cmtt9: [1100992, 451470], cmtt10: [1100995, 451470],
  cmtt12: [1079160, 451471], cmitt10: [1100995, 451470],
  phvr7t: [1048576, 548403], phvb7t: [1048576, 557837]
});
const LATEX_FONT_SIZES = [5, 6, 7, 8, 9, 10, 10.95, 12, 14.4, 17.28, 20.74, 24.88];

// Like the diagnostics hook, this scopes only synchronous evaluation. A provider
// lets a parent-owned environment update its active TeX font in source order.
export function withDimensionFont(font, callback) {
  const previous = dimensionFont;
  dimensionFont = font;
  try { return callback(); } finally { dimensionFont = previous; }
}

export function fontDimensionMetrics(font = {}) {
  if (font.emPt !== undefined || font.exPt !== undefined) {
    if ([font.emPt, font.exPt].every((value) => Number.isFinite(value) && value > 0)) return { emPt: font.emPt, exPt: font.exPt };
    throw new MathExpressionError(mathFailure("", "math-font-metrics", "Explicit em/ex metrics must both be finite positive TeX points.").diagnostic);
  }
  const sizePt = font.sizePt ?? 10;
  const fontName = font.tfm || computerModernDimensionFace(font, sizePt);
  if (!Number.isFinite(sizePt) || sizePt <= 0 || sizePt >= 16384 || !Object.hasOwn(CM_FONT_DIMENSIONS, fontName)) {
    throw new MathExpressionError(mathFailure("", "math-font-metrics", "No verified em/ex metrics for the active TeX font; provide emPt and exPt.").diagnostic);
  }
  const [quad, xHeight] = CM_FONT_DIMENSIONS[fontName];
  const scaledSize = Math.round(sizePt * TEX_SP_PER_PT);
  // TFM fix_words have twenty fractional bits; TeX truncates to scaled points.
  const toPoints = (fixWord) => Math.floor(fixWord * scaledSize / 1048576) / TEX_SP_PER_PT;
  return { emPt: toPoints(quad), exPt: toPoints(xHeight) };
}

function computerModernDimensionFace(font, sizePt) {
  const family = font.family || "serif";
  const bold = font.weight === "bold" || Number(font.weight) >= 600;
  // Heros is the bundled outline substitute for helvet's phv TeX metrics.
  // Upright and oblique phv faces have identical quad and x-height parameters.
  if (family === "helvetica" && (!font.variant || font.variant === "normal")) return bold ? "phvb7t" : "phvr7t";
  if (!LATEX_FONT_SIZES.some((size) => Math.abs(size - sizePt) < 1e-6)) return null;
  const italic = font.style === "italic";
  const smallCaps = font.variant === "small-caps";
  if (font.style && !["normal", "italic"].includes(font.style)) return null;
  if (font.variant && !["normal", "small-caps"].includes(font.variant)) return null;
  const design = sizePt < 10 ? sizePt : sizePt < 12 ? 10 : sizePt < 17 ? 12 : 17;
  if (family === "serif") {
    if (smallCaps) return bold ? null : "cmcsc10";
    if (bold && italic) return "cmbxti10";
    if (bold) return `cmbx${Math.min(12, design)}`;
    if (italic) return `cmti${Math.max(7, Math.min(12, design))}`;
    return `cmr${design}`;
  }
  if (family === "sans-serif") {
    if (smallCaps) return bold ? null : "cmcsc10";
    // cmssi has the same quad and x-height as its upright cmss counterpart.
    return bold ? "cmssbx10" : `cmss${Math.max(8, design)}`;
  }
  if (family === "monospace") {
    if (smallCaps) return null;
    return italic ? "cmitt10" : `cmtt${Math.max(8, Math.min(12, design))}`;
  }
  return null;
}

const CTIKZ_DEFAULT_VALUES = {
  "tubes/width": 1,
  "tubes/height": 1.4,
  "tubes/tube radius": 0.4,
  "tubes/anode distance": 0.4,
  "tubes/anode width": 0.4,
  "tubes/grid protrusion": 0.25,
  "tubes/grid dashes": 5,
  "tubes/grid separation": 0.2,
  "tubes/grid shift": 0,
  "tubes/cathode distance": 0.4,
  "tubes/cathode width": 0.4,
  "tubes/cathode corners": 0.06,
  "tubes/cathode right extend": 0.075,
  "bipoles/capacitor/height": 0.6,
  "bipoles/capacitor/width": 0.2,
  "bipoles/vsource/height": 0.6,
  "bipoles/vsource/width": 0.6,
  "bipoles/vsourcesin/height": 0.6,
  "bipoles/vsourcesin/width": 0.6
};

export function substituteVariables(input, variables = {}, options = {}) {
  const source = String(input);
  let length = source.length;
  const checkLength = () => {
    if (length > (options.maxLength ?? Infinity)) {
      throw new MathExpressionError(mathFailure(source, "math-expression-limit", "Math variable expansion exceeds the source length limit.").diagnostic);
    }
  };
  const replace = (callback) => (...args) => {
    const replacement = callback(...args);
    length += replacement.length - args[0].length;
    checkLength();
    return replacement;
  };
  checkLength();
  const valueOf = (name, fallback) => {
    const descriptor = Object.getOwnPropertyDescriptor(variables, name);
    return descriptor && Object.hasOwn(descriptor, "value") && ["number", "string"].includes(typeof descriptor.value)
      ? String(descriptor.value) : fallback;
  };
  return source
    .replace(/\\ctikzvalof\s*\{([^{}]+)\}/g, replace((match, key) => {
      const normalized = key.trim();
      if (Object.hasOwn(variables, normalized)) return valueOf(normalized, match);
      if (Object.hasOwn(CTIKZ_DEFAULT_VALUES, normalized)) return String(CTIKZ_DEFAULT_VALUES[normalized]);
      return match;
    }))
    .replace(/\\([A-Za-z@]+)(\{\})?/g, replace((match, name) => {
      if (Object.hasOwn(variables, name)) return valueOf(name, match);
      return match;
    }));
}

export function substituteTextVariables(input, variables = {}) {
  return String(input).replace(/\\([A-Za-z@]+)(\{\})?/g, (match, name) => {
    if (Object.hasOwn(variables, name)) return String(variables[name]);
    return match;
  });
}

export function evaluateMathResult(input, variables = {}) {
  try {
    const substituted = substituteVariables(normalizeImplicitLengthProducts(input), variables, { maxLength: MATH_EXPRESSION_LIMITS.characters });
    const result = evaluateRestrictedExpression(substituted, variables, { coordinateModulo: true });
    return result.ok ? result : { ...result, diagnostic: { ...result.diagnostic, expression: String(input) } };
  } catch (error) {
    if (!(error instanceof MathExpressionError)) throw error;
    return { ok: false, value: NaN, diagnostic: { ...error.diagnostic, expression: String(input) } };
  }
}

export function evaluateMath(input, variables = {}, options = {}) {
  return mathResultValue(evaluateMathResult(input, variables), options);
}

export function parseDimensionResult(input, variables = {}, options = {}) {
  try {
    const font = options.font ?? (typeof dimensionFont === "function" ? dimensionFont() : dimensionFont);
    return evaluateDimensionResult(input, variables, font);
  } catch (error) {
    if (!(error instanceof MathExpressionError)) throw error;
    return { ok: false, value: NaN, diagnostic: { ...error.diagnostic, expression: String(input) } };
  }
}

function evaluateDimensionResult(input, variables, font) {
  const text = stripBalancedOuterBraces(substituteVariables(normalizeImplicitLengthProducts(input), variables, { maxLength: MATH_EXPRESSION_LIMITS.characters }).replace(/\{\}/g, "").trim());
  const normalizedExpression = normalizeDimensionExpression(text, font);
  if (normalizedExpression !== text) {
    const result = evaluateMathResult(normalizedExpression, variables);
    return result.ok ? result : { ...result, diagnostic: { ...result.diagnostic, expression: String(input) } };
  }
  const match = text.match(/^\{?([^a-zA-Z}]*)\}?\s*(cm|mm|pt|em|ex|in|px)?$/);
  const result = evaluateMathResult(match ? match[1] : text, variables);
  if (!result.ok) return { ...result, diagnostic: { ...result.diagnostic, expression: String(input) } };
  const value = convertDimensionUnit(result.value, match?.[2] || "cm", font);
  return Number.isFinite(value) ? { ok: true, value } : mathFailure(input, "math-nonfinite", "Dimension did not produce a finite number.");
}

export function parseDimension(input, variables = {}, options = {}) {
  return mathResultValue(parseDimensionResult(input, variables, options), options);
}

export function normalizeImplicitLengthProducts(input) {
  // TeX permits a scalar immediately before a dimension register, for example
  // `0.35\textwidth`; the expression grammar needs explicit multiplication.
  return String(input ?? "").replace(
    /(\d|\))\s*(\\(?:textwidth|textheight|linewidth|paperwidth|paperheight|pgflinewidth)\b)/g,
    "$1*$2"
  );
}

export function roundPoint(point, places = 12) {
  return {
    x: roundNumber(point.x, places),
    y: roundNumber(point.y, places)
  };
}

export function roundNumber(value, places = 12) {
  const factor = 10 ** places;
  if (!Number.isFinite(value * factor)) return value;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function normalizeDimensionExpression(input, font) {
  return String(input || "").replace(/([-+]?(?:\d+\.?\d*|\.\d+))\s*(cm|mm|pt|em|ex|in|px)\b/g, (_match, value, unit, offset) => {
    const converted = String(convertDimensionUnit(Number(value), unit, font));
    return value.startsWith("+") && offset > 0 ? `+${converted}` : converted;
  });
}

function convertDimensionUnit(value, unit, font) {
  if (!Number.isFinite(value)) return NaN;
  if (unit === "mm") return value / 10;
  if (unit === "pt") return value / TEX_PT_PER_CM;
  if (unit === "em" || unit === "ex") {
    const metrics = fontDimensionMetrics(font || {});
    return value * (metrics[unit === "em" ? "emPt" : "exPt"] / TEX_PT_PER_CM);
  }
  if (unit === "in") return value * 2.54;
  // LaTeX's pdfTeX/xetex `px` unit is one PostScript point (1/72in).
  if (unit === "px") return value * (2.54 / 72);
  return value;
}

function stripBalancedOuterBraces(input) {
  let text = String(input || "").trim();
  while (text.startsWith("{") && text.endsWith("}") && outerBracesWrapWholeInput(text)) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

function outerBracesWrapWholeInput(text) {
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0 && index < text.length - 1) return false;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}
