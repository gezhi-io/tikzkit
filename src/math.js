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

export function substituteVariables(input, variables = {}) {
  return String(input)
    .replace(/\\ctikzvalof\s*\{([^{}]+)\}/g, (_match, key) => {
      const normalized = key.trim();
      if (Object.hasOwn(variables, normalized)) return String(variables[normalized]);
      if (Object.hasOwn(CTIKZ_DEFAULT_VALUES, normalized)) return String(CTIKZ_DEFAULT_VALUES[normalized]);
      return "0";
    })
    .replace(/\\([A-Za-z@]+)(\{\})?/g, (_match, name) => {
      if (Object.hasOwn(variables, name)) return String(variables[name]);
      return "0";
    });
}

export function substituteTextVariables(input, variables = {}) {
  return String(input).replace(/\\([A-Za-z@]+)(\{\})?/g, (match, name) => {
    if (Object.hasOwn(variables, name)) return String(variables[name]);
    return match;
  });
}

export function evaluateMath(input, variables = {}) {
  const substituted = normalizeMathExpression(substituteVariables(input, variables));
  if (!substituted) return 0;
  if (!/^[0-9+\-*/%().,\sA-Za-z<>=!?:&|]+$/.test(substituted)) {
    const numeric = Number(substituted);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  try {
    const value = Function(
      `"use strict"; const mod = (a, b) => ((a % b) + b) % b; const gamma = ${gammaLanczos.toString()}; return (${substituted});`
    )();
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function parseDimension(input, variables = {}) {
  const text = substituteVariables(input, variables).replace(/\{\}/g, "").trim();
  const match = text.match(/^\{?([^a-zA-Z}]*)\}?\s*(cm|mm|pt|em|ex|in)?$/);
  if (!match) return evaluateMath(text, variables);
  const value = evaluateMath(match[1], variables);
  const unit = match[2] || "cm";
  if (unit === "mm") return value / 10;
  if (unit === "pt") return value / 28.4527559;
  if (unit === "em") return value * (10 / 28.4527559);
  if (unit === "ex") return value * (4.30554 / 28.4527559);
  if (unit === "in") return value * 2.54;
  return value;
}

export function roundPoint(point, places = 12) {
  return {
    x: roundNumber(point.x, places),
    y: roundNumber(point.y, places)
  };
}

export function roundNumber(value, places = 12) {
  const factor = 10 ** places;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function normalizeMathExpression(input) {
  return String(input)
    .trim()
    .replace(/^\{([\s\S]*)\}$/, "$1")
    .replace(/--/g, "+")
    .replace(/\+\+/g, "+")
    .replace(/\+-/g, "-")
    .replace(/-\+/g, "-")
    .replace(/\bpi\b/g, "Math.PI")
    .replace(/\be\b/g, "Math.E")
    .replace(/\^/g, "**")
    .replace(/-\s*(\([^()]+\)|[A-Za-z0-9.]+)\s*\*\*\s*(\([^()]+\)|[A-Za-z0-9.]+)/g, "-($1**$2)")
    .replace(/\bint\s*\(/g, "Math.trunc(")
    .replace(/\bsqrt\s*\(/g, "Math.sqrt(")
    .replace(/\babs\s*\(/g, "Math.abs(")
    .replace(/\bexp\s*\(/g, "Math.exp(")
    .replace(/\bmax\s*\(/g, "Math.max(")
    .replace(/\bmin\s*\(/g, "Math.min(")
    .replace(/\btanh\s*\(/g, "Math.tanh(")
    .replace(/\blog10\s*\(/g, "Math.log10(")
    .replace(/\bln\s*\(/g, "Math.log(")
    .replace(/(^|[^.A-Za-z0-9_])log\s*\(/g, "$1Math.log(")
    .replace(/\b(sin|cos|tan)\s*\(([^()]*)\s+r\s*\)/g, "Math.$1($2)")
    .replace(/(?<!\.)\bsin\s*\(/g, "Math.sin((Math.PI/180)*")
    .replace(/(?<!\.)\bcos\s*\(/g, "Math.cos((Math.PI/180)*")
    .replace(/(?<!\.)\btan\s*\(/g, "Math.tan((Math.PI/180)*");
}

function gammaLanczos(z) {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ];
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gammaLanczos(1 - z));
  let x = 0.99999999999980993;
  const shifted = z - 1;
  for (let index = 0; index < coefficients.length; index += 1) {
    x += coefficients[index] / (shifted + index + 1);
  }
  const t = shifted + coefficients.length - 0.5;
  return Math.sqrt(2 * Math.PI) * t ** (shifted + 0.5) * Math.exp(-t) * x;
}
