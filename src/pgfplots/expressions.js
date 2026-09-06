import { splitTopLevel } from "../engine/options.js";
import { createMathRuntime, evaluateRestrictedExpression, mathResultValue } from "../engine/safe-expression.js";

let axisDiagnostics;

// Restrict frontend collection to consumed plot expressions, not axis-option
// number/dimension probes. Endpoint-recovery probes remain unreported below.
export function withAxisMathDiagnostics(diagnostics, callback) {
  const previous = axisDiagnostics;
  axisDiagnostics = diagnostics;
  try { return callback(); } finally { axisDiagnostics = previous; }
}

export function evaluateAxisExpressionResult(expression, x, axisOptions = {}, variables = {}) {
  const trigFormat = String(axisOptions["trig format"] || "").trim().toLowerCase();
  const radianTrig = trigFormat === "rad" || trigFormat === "radians";
  const scope = Object.create(null, {
    ...Object.getOwnPropertyDescriptors(variables || {}),
    x: { value: x, configurable: true, enumerable: true }
  });
  return evaluateRestrictedExpression(expression, scope, {
    pgfTrig: true, radianTrig, recoverZeroDivision: true,
    declarations: axisOptions["pgfplots declared functions"] || []
  });
}

export function evaluateAxisExpression(expression, x, axisOptions = {}, variables = {}, options = {}) {
  return mathResultValue(evaluateAxisExpressionResult(expression, x, axisOptions, variables), { diagnostics: axisDiagnostics, ...options });
}

export function evaluateAxisExpressionAtSample(expression, x, axisOptions = {}, context = {}) {
  context = { diagnostics: axisDiagnostics, ...context };
  const result = evaluateAxisExpressionResult(expression, x, axisOptions, context.variables);
  const value = result.value;
  if (Number.isFinite(value)) return value;

  const { domain, index, samples } = context;
  if (!domain || samples < 2 || (index !== 0 && index !== samples - 1)) return mathResultValue(result, context);
  const span = domain.end - domain.start;
  if (!Number.isFinite(span) || span === 0) return mathResultValue(result, context);

  const direction = index === 0 ? Math.sign(span) || 1 : -(Math.sign(span) || 1);
  const step = Math.abs(span) / Math.max(1, samples - 1);
  const epsilon = Math.min(Math.max(Math.abs(span), 1) * 1e-7, step * 1e-4);
  const probe = evaluateAxisExpressionResult(expression, x + direction * epsilon, axisOptions, context.variables).value;
  if (!Number.isFinite(probe) || Math.abs(probe) > 1e4) return mathResultValue(result, context);
  return Math.abs(probe) < 1e-4 ? 0 : probe;
}

export function evaluateAxisExpressionSamples(expression, sampleValues, axisOptions = {}, context = {}) {
  const failures = new Map();
  const values = sampleValues.map((x, index) => evaluateAxisExpressionAtSample(expression, x, axisOptions, {
    ...context,
    index,
    samples: sampleValues.length,
    diagnostics: (diagnostic) => failures.set(diagnostic.code, diagnostic)
  }));
  const hasFiniteSamples = values.some(Number.isFinite);
  for (const diagnostic of failures.values()) {
    // PGFPlots discards unbounded samples (or inserts jumps) in an otherwise
    // valid plot. Syntax, binding, and resource failures are never domain holes.
    if (hasFiniteSamples && diagnostic.code === "math-nonfinite") continue;
    mathResultValue({ ok: false, value: NaN, diagnostic }, { diagnostics: axisDiagnostics, ...context });
  }
  return values;
}

export function parsePgfplotsDeclaredFunctions(raw) {
  if (raw === undefined || raw === null || raw === true) return [];
  return optionValues(raw)
    .flatMap((value) => splitTopLevel(String(value), ";"))
    .map((part) => parsePgfplotsDeclaredFunction(part))
    .filter(Boolean);
}

// Legacy formatting helper only. Evaluators consume raw PGF source through the
// restricted parser, never this JavaScript-shaped representation.
export function normalizeAxisExpression(input, radianTrig) {
  const trigPrefix = radianTrig ? "Math.$1(" : "__pgfplots_pgf_$1_deg(";
  const withLocalRadians = normalizeLocalRadianTrigCalls(String(input));
  const normalized = withLocalRadians
    .trim()
    .replace(/^\{([\s\S]*)\}$/, "$1")
    .replace(/\bpi\b/g, "Math.PI")
    .replace(/\be\b/g, "Math.E")
    .replace(/\^/g, "**")
    .replace(/-\s*(\([^()]+\)|[A-Za-z0-9.]+)\s*\*\*\s*(\([^()]+\)|[A-Za-z0-9.]+)/g, "-($1**$2)")
    .replace(/\brad\s*\(([^()]*)\)/g, "(($1)*Math.PI/180)")
    .replace(/\bdeg\s*\(([^()]*)\)/g, "(($1)*180/Math.PI)")
    .replace(/\bsqrt\s*\(/g, "Math.sqrt(")
    .replace(/\babs\s*\(/g, "Math.abs(")
    .replace(/\bexp\s*\(/g, "Math.exp(")
    .replace(/\bmax\s*\(/g, "Math.max(")
    .replace(/\bmin\s*\(/g, "Math.min(")
    .replace(/\btanh\s*\(/g, "Math.tanh(")
    .replace(/\blog10\s*\(/g, "Math.log10(")
    .replace(/\bln\s*\(/g, "Math.log(")
    .replace(/(^|[^.A-Za-z0-9_])log\s*\(/g, "$1Math.log(")
    .replace(/\b(sin|cos|tan)\s*\(/g, trigPrefix)
    .replace(/\b__pgfplots_(sin|cos|tan)_rad\s*\(/g, "Math.$1(");
  return disambiguateUnaryExponentiation(normalized);
}

// Compatibility export: a closed function table, never executable source text.
export function pgfMathRuntimePrelude() {
  return createMathRuntime({ pgfTrig: true });
}

function parsePgfplotsDeclaredFunction(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  const match = text.match(/^\\?([A-Za-z@][A-Za-z0-9@]*)\s*\(([\s\S]*?)\)\s*=\s*([\s\S]+)$/);
  if (match) {
    return {
      type: "function",
      name: match[1],
      params: splitTopLevel(match[2]).map((param) => param.trim().replace(/^\\/, "")).filter(Boolean),
      body: match[3].trim()
    };
  }
  const constant = text.match(/^\\?([A-Za-z@][A-Za-z0-9@]*)\s*=\s*([\s\S]+)$/);
  if (!constant) return null;
  return {
    type: "constant",
    name: constant[1],
    params: [],
    body: constant[2].trim()
  };
}

function normalizeLocalRadianTrigCalls(input) {
  const text = String(input || "");
  let output = "";
  let cursor = 0;
  while (cursor < text.length) {
    const match = /\b(sin|cos|tan)\s*\(/g;
    match.lastIndex = cursor;
    const found = match.exec(text);
    if (!found) {
      output += text.slice(cursor);
      break;
    }
    const name = found[1];
    const parenIndex = text.indexOf("(", found.index);
    const balanced = extractBalanced(text, parenIndex, "(", ")");
    if (!balanced) {
      output += text.slice(cursor);
      break;
    }
    output += text.slice(cursor, found.index);
    const localRadians = stripLocalRadianSuffix(balanced.content);
    if (localRadians) {
      output += `__pgfplots_${name}_rad(${normalizeLocalRadianTrigCalls(localRadians)})`;
    } else {
      output += `${name}(${normalizeLocalRadianTrigCalls(balanced.content)})`;
    }
    cursor = balanced.end;
  }
  return output;
}

function stripLocalRadianSuffix(content) {
  const text = String(content || "");
  let index = text.length - 1;
  while (index >= 0 && /\s/.test(text[index])) index -= 1;
  if (text[index] !== "r") return null;
  const before = text[index - 1] || "";
  if (/[A-Za-z0-9_]/.test(before)) return null;
  return text.slice(0, index).trim();
}

function disambiguateUnaryExponentiation(input) {
  let output = "";
  let cursor = 0;
  while (cursor < input.length) {
    const char = input[cursor];
    if (char !== "-" || !isUnaryMinusContext(input, cursor)) {
      output += char;
      cursor += 1;
      continue;
    }
    const operandStart = skipWhitespace(input, cursor + 1);
    if (input[operandStart] !== "(") {
      output += char;
      cursor += 1;
      continue;
    }
    const operand = extractBalanced(input, operandStart, "(", ")");
    if (!operand) {
      output += char;
      cursor += 1;
      continue;
    }
    const afterOperand = skipWhitespace(input, operand.end);
    if (!input.startsWith("**", afterOperand)) {
      output += char;
      cursor += 1;
      continue;
    }
    const exponentStart = afterOperand + 2;
    const exponent = readExponentOperand(input, exponentStart);
    if (!exponent) {
      output += char;
      cursor += 1;
      continue;
    }
    output += `(-1*${input.slice(operandStart, operand.end)}**${input.slice(exponent.start, exponent.end)})`;
    cursor = exponent.end;
  }
  return output;
}

function isUnaryMinusContext(input, index) {
  let cursor = index - 1;
  while (cursor >= 0 && /\s/.test(input[cursor])) cursor -= 1;
  if (cursor < 0) return true;
  return "([{:,+-*/".includes(input[cursor]);
}

function readExponentOperand(input, start) {
  const cursor = skipWhitespace(input, start);
  if (input[cursor] === "(") return extractBalanced(input, cursor, "(", ")");
  const match = input.slice(cursor).match(/^[A-Za-z0-9_.]+/);
  if (!match) return null;
  return { start: cursor, end: cursor + match[0].length };
}

function skipWhitespace(text, index) {
  let cursor = index;
  while (/\s/.test(text[cursor] || "")) cursor += 1;
  return cursor;
}

function extractBalanced(text, start, open, close) {
  if (text[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === open) depth += 1;
    if (char === close) depth -= 1;
    if (depth === 0) {
      return { content: text.slice(start + 1, index), start, end: index + 1 };
    }
  }
  return null;
}

function optionValues(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}
