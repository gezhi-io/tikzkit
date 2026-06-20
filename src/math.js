export function substituteVariables(input, variables = {}) {
  return String(input).replace(/\\([A-Za-z@]\w*)/g, (_match, name) => {
    if (Object.hasOwn(variables, name)) return String(variables[name]);
    return "0";
  });
}

export function substituteTextVariables(input, variables = {}) {
  return String(input).replace(/\\([A-Za-z@]\w*)/g, (match, name) => {
    if (Object.hasOwn(variables, name)) return String(variables[name]);
    return match;
  });
}

export function evaluateMath(input, variables = {}) {
  const substituted = normalizeMathExpression(substituteVariables(input, variables));
  if (!substituted) return 0;
  if (!/^[0-9+\-*/().,\sMathsqrtincostapPI]+$/.test(substituted)) {
    const numeric = Number(substituted);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  try {
    const value = Function(`"use strict"; return (${substituted});`)();
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function parseDimension(input, variables = {}) {
  const text = substituteVariables(input, variables).trim();
  const match = text.match(/^\{?([^a-zA-Z}]*)\}?\s*(cm|mm|pt|em|ex|in)?$/);
  if (!match) return evaluateMath(text, variables);
  const value = evaluateMath(match[1], variables);
  const unit = match[2] || "cm";
  if (unit === "mm") return value / 10;
  if (unit === "pt") return value / 28.4527559;
  if (unit === "em") return value * 0.35;
  if (unit === "ex") return value * 0.15;
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
    .replace(/\bpi\b/g, "Math.PI")
    .replace(/\^/g, "**")
    .replace(/\bsqrt\s*\(/g, "Math.sqrt(")
    .replace(/\bsin\s*\(/g, "Math.sin((Math.PI/180)*")
    .replace(/\bcos\s*\(/g, "Math.cos((Math.PI/180)*")
    .replace(/\btan\s*\(/g, "Math.tan((Math.PI/180)*");
}
