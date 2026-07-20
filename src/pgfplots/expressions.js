import { splitTopLevel } from "../engine/options.js";

export function evaluateAxisExpression(expression, x, axisOptions = {}, variables = {}) {
  const trigFormat = String(axisOptions["trig format"] || "").trim().toLowerCase();
  const radianTrig = trigFormat === "rad" || trigFormat === "radians";
  const withDeclaredFunctions = expandDeclaredPgfFunctions(expression, axisOptions["pgfplots declared functions"] || []);
  const withHelpers = expandPgfMathHelpers(withDeclaredFunctions);
  let substituted = String(withHelpers).replace(/\\x\b/g, `(${x})`).replace(/\bx\b/g, `(${x})`);
  for (const [name, value] of Object.entries(variables || {})) {
    substituted = replacePgfVariable(substituted, name, value);
  }
  const normalized = normalizeAxisExpression(substituted, radianTrig);
  if (!normalized) return NaN;
  if (!/^[0-9+\-*/%().,\sA-Za-z_<>=!?:&|]+$/.test(normalized)) {
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : NaN;
  }
  try {
    const value = executeNormalizedAxisExpression(normalized);
    if (Number.isFinite(value)) return value;
    return recoverPgfZeroDivision(normalized);
  } catch {
    return NaN;
  }
}

function executeNormalizedAxisExpression(normalized) {
  return Function(`"use strict"; ${pgfMathRuntimePrelude()} return (${normalized});`)();
}

function recoverPgfZeroDivision(normalized) {
  const division = splitTopLevel(normalized, "/");
  if (division.length !== 2) return NaN;
  try {
    const numerator = executeNormalizedAxisExpression(division[0]);
    const denominator = executeNormalizedAxisExpression(division[1]);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && Math.abs(numerator) < 1e-12 && Math.abs(denominator) < 1e-12) {
      return 0;
    }
  } catch {
    // Preserve the original non-finite result for unsupported subexpressions.
  }
  return NaN;
}

export function evaluateAxisExpressionAtSample(expression, x, axisOptions = {}, context = {}) {
  const value = evaluateAxisExpression(expression, x, axisOptions, context.variables);
  if (Number.isFinite(value)) return value;

  const { domain, index, samples } = context;
  if (!domain || samples < 2 || (index !== 0 && index !== samples - 1)) return value;
  const span = domain.end - domain.start;
  if (!Number.isFinite(span) || span === 0) return value;

  const direction = index === 0 ? Math.sign(span) || 1 : -(Math.sign(span) || 1);
  const step = Math.abs(span) / Math.max(1, samples - 1);
  const epsilon = Math.min(Math.max(Math.abs(span), 1) * 1e-7, step * 1e-4);
  const probe = evaluateAxisExpression(expression, x + direction * epsilon, axisOptions, context.variables);
  if (!Number.isFinite(probe) || Math.abs(probe) > 1e4) return value;
  return Math.abs(probe) < 1e-4 ? 0 : probe;
}

export function parsePgfplotsDeclaredFunctions(raw) {
  if (raw === undefined || raw === null || raw === true) return [];
  return optionValues(raw)
    .flatMap((value) => splitTopLevel(String(value), ";"))
    .map((part) => parsePgfplotsDeclaredFunction(part))
    .filter(Boolean);
}

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

export function pgfMathRuntimePrelude() {
  return `
const pow = Math.pow;
const sqrt = Math.sqrt;
const abs = Math.abs;
const exp = Math.exp;
const ln = Math.log;
const log = Math.log;
const log10 = Math.log10;
const sinh = Math.sinh;
const cosh = Math.cosh;
const tanh = Math.tanh;
const floor = Math.floor;
const ceil = Math.ceil;
const round = Math.round;
const sign = (value) => (value > 0 ? 1 : value < 0 ? -1 : 0);
const int = (value) => (value < 0 ? Math.ceil(value) : Math.floor(value));
const rad = (value) => value * Math.PI / 180;
const deg = (value) => value * 180 / Math.PI;
const asin = (value) => deg(Math.asin(value));
const acos = (value) => deg(Math.acos(value));
const atan = (value) => deg(Math.atan(value));
const atan2 = (y, x) => deg(Math.atan2(y, x));
const veclen = (x, y) => Math.hypot(x, y);
const ifthenelse = (condition, trueValue, falseValue) => (condition ? trueValue : falseValue);
const greater = (left, right) => (left > right ? 1 : 0);
const less = (left, right) => (left < right ? 1 : 0);
const equal = (left, right) => (Math.abs(left - right) < 1e-12 ? 1 : 0);
const not = (value) => (value ? 0 : 1);
const and = (left, right) => (left && right ? 1 : 0);
const or = (left, right) => (left || right ? 1 : 0);
const div = (left, right) => {
  const quotient = left / right;
  return quotient < 0 ? Math.ceil(quotient) : Math.floor(quotient);
};
const mod = (left, right) => left - right * div(left, right);
const Mod = (left, right) => {
  const value = mod(left, right);
  return value < 0 ? value + right : value;
};
const __pgfplots_trig_sp = 65536;
const __pgfplots_tex_dim = (value) => {
  if (!Number.isFinite(value)) return NaN;
  const scaled = value * __pgfplots_trig_sp;
  return (value < 0 ? Math.ceil(scaled) : Math.floor(scaled)) / __pgfplots_trig_sp;
};
const __pgfplots_cos_table = Array.from({ length: 181 }, (_entry, index) =>
  Number(Math.cos((index * Math.PI) / 180).toFixed(5))
);
const __pgfplots_interp_cos_table = (value) => {
  let x = __pgfplots_tex_dim(value);
  let count = Math.trunc(x);
  count = Math.trunc(count / 360) * -360;
  x = __pgfplots_tex_dim(x + count);
  if (x < 0) x = __pgfplots_tex_dim(-x);
  if (!(x < 180)) x = __pgfplots_tex_dim(-x + 360);
  const index = Math.max(0, Math.min(180, Math.trunc(x)));
  const fraction = __pgfplots_tex_dim(x - index);
  if (Math.abs(fraction) < 1e-12) return __pgfplots_tex_dim(__pgfplots_cos_table[index]);
  const nextIndex = index + 1 === 181 ? 179 : Math.min(180, index + 1);
  const leftWeight = __pgfplots_tex_dim(1 - fraction);
  return __pgfplots_tex_dim(
    __pgfplots_tex_dim(__pgfplots_cos_table[index] * leftWeight) +
    __pgfplots_tex_dim(__pgfplots_cos_table[nextIndex] * fraction)
  );
};
const __pgfplots_pgf_cos_deg = (value) => __pgfplots_interp_cos_table(value);
const __pgfplots_pgf_sin_deg = (value) => __pgfplots_interp_cos_table(__pgfplots_tex_dim(value) - 90);
const __pgfplots_pgf_tan_deg = (value) => {
  const denominator = __pgfplots_pgf_cos_deg(value);
  if (Math.abs(denominator) < 1e-12) return NaN;
  return __pgfplots_tex_dim(__pgfplots_pgf_sin_deg(value) / denominator);
};
`;
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

function expandDeclaredPgfFunctions(expression, declarations = []) {
  if (!declarations.length) return expression;
  let expanded = String(expression || "");
  for (let iteration = 0; iteration < 12; iteration += 1) {
    let next = expanded;
    for (const declaration of declarations) {
      next = declaration.params?.length ? replaceDeclaredFunctionCalls(next, declaration) : replaceDeclaredConstant(next, declaration);
    }
    if (next === expanded) break;
    expanded = next;
  }
  return expanded;
}

function replaceDeclaredConstant(input, declaration) {
  return replacePgfVariable(input, declaration.name, declaration.body);
}

function replaceDeclaredFunctionCalls(input, declaration) {
  let output = "";
  let cursor = 0;
  while (cursor < input.length) {
    const call = findDeclaredFunctionCall(input, declaration, cursor);
    if (!call) {
      output += input.slice(cursor);
      break;
    }
    output += input.slice(cursor, call.start);
    output += `(${instantiateDeclaredFunction(declaration, splitTopLevel(call.args))})`;
    cursor = call.end;
  }
  return output;
}

function findDeclaredFunctionCall(input, declaration, start) {
  let cursor = start;
  while (cursor < input.length) {
    const index = input.indexOf(declaration.name, cursor);
    if (index === -1) return null;
    const before = input[index - 1] || "";
    if (/[A-Za-z0-9_\\]/.test(before)) {
      cursor = index + declaration.name.length;
      continue;
    }
    const paren = skipWhitespace(input, index + declaration.name.length);
    if (input[paren] !== "(") {
      cursor = index + declaration.name.length;
      continue;
    }
    const balanced = extractBalanced(input, paren, "(", ")");
    if (!balanced) return null;
    return { start: index, args: balanced.content, end: balanced.end };
  }
  return null;
}

function instantiateDeclaredFunction(declaration, args) {
  let body = declaration.body;
  declaration.params.forEach((param, index) => {
    const value = args[index] ?? "0";
    body = replacePgfVariable(body, param, value);
  });
  return body;
}

function replacePgfVariable(input, name, value) {
  const escaped = escapeRegExp(String(name || "").replace(/^\\/, ""));
  return String(input)
    .replace(new RegExp(String.raw`\\${escaped}\b`, "g"), `(${value})`)
    .replace(new RegExp(String.raw`\b${escaped}\b`, "g"), `(${value})`);
}

function expandPgfMathHelpers(expression) {
  return String(expression || "").replace(/\bgauss\s*\(\s*([^,()]+)\s*,\s*([^()]+)\)/g, (_match, mean, sigma) => {
    const mu = mean.trim();
    const sd = sigma.trim();
    return `(1/((${sd})*sqrt(2*pi))*exp(-((x-(${mu}))^2)/(2*(${sd})^2)))`;
  });
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function optionValues(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}
