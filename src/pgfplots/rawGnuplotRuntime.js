// 面向浏览器的受限 raw gnuplot 求值器：只解释数值定义、单表达式函数、
// 范围、采样数和一个 plot 表达式，绝不把用户源码交给 JavaScript 执行。

export function parseRawGnuplotProgram(source) {
  const constants = new Map();
  const functions = new Map();
  let xRange = null;
  let yRange = null;
  let samples = null;
  let plot = null;

  for (const statement of splitRawGnuplotStatements(stripRawGnuplotComments(source))) {
    const text = statement.trim();
    if (!text) continue;
    const range = parseRawGnuplotRange(text);
    if (range) {
      if (range.axis === "x") xRange = range;
      if (range.axis === "y") yRange = range;
      continue;
    }
    const parsedSamples = parseRawGnuplotSamples(text);
    if (parsedSamples) {
      samples = parsedSamples;
      continue;
    }
    const parsedPlot = parseRawGnuplotPlot(text);
    if (parsedPlot) {
      plot = parsedPlot;
      continue;
    }
    const definition = parseRawGnuplotDefinition(text);
    if (!definition) return { ok: false, reason: `Unsupported raw gnuplot statement: ${text}` };
    if (definition.params) functions.set(definition.name, definition);
    else constants.set(definition.name, definition.expression);
  }

  if (!plot?.expression) return { ok: false, reason: "raw gnuplot block has no supported plot expression" };
  return { ok: true, constants, functions, xRange, yRange, samples, plot };
}

export function createRawGnuplotRuntime(program) {
  const constantCache = new Map();
  const resolvingConstants = new Set();

  function evaluate(expression, variables = {}) {
    return new RawGnuplotExpressionParser(
      expression,
      (name) => resolveIdentifier(name, variables),
      (name, args) => callFunction(name, args, variables)
    ).parse();
  }

  function resolveIdentifier(name, variables) {
    if (Object.hasOwn(variables, name)) return variables[name];
    if (name === "pi") return Math.PI;
    if (name === "e") return Math.E;
    if (!program.constants.has(name)) throw new Error(`Unknown raw gnuplot identifier: ${name}`);
    if (constantCache.has(name)) return constantCache.get(name);
    if (resolvingConstants.has(name)) throw new Error(`Recursive raw gnuplot constant: ${name}`);
    resolvingConstants.add(name);
    try {
      const value = evaluate(program.constants.get(name), variables);
      constantCache.set(name, value);
      return value;
    } finally {
      resolvingConstants.delete(name);
    }
  }

  function callFunction(name, args, variables) {
    const builtin = rawGnuplotBuiltin(name, args);
    if (builtin.handled) return builtin.value;
    const definition = program.functions.get(name);
    if (!definition) throw new Error(`Unsupported raw gnuplot function: ${name}`);
    if (definition.params.length !== args.length) throw new Error(`Wrong argument count for raw gnuplot function: ${name}`);
    const localVariables = { ...variables };
    definition.params.forEach((param, index) => {
      localVariables[param] = args[index];
    });
    return evaluate(definition.expression, localVariables);
  }

  return { evaluate };
}

function stripRawGnuplotComments(source) {
  return String(source || "")
    // addplot 扫描会保留 raw 块前的 TeX 注释。这里只去掉独立的 `%` 行，
    // 使 `%` 在表达式中仍可作为 gnuplot 的取模运算符。
    .replace(/(^|\n)\s*%\s*(?=\n|$)/g, "$1")
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, ""))
    .join("\n");
}

function splitRawGnuplotStatements(source) {
  const statements = [];
  let start = 0;
  let parentheses = 0;
  let brackets = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") parentheses += 1;
    else if (char === ")") parentheses = Math.max(0, parentheses - 1);
    else if (char === "[") brackets += 1;
    else if (char === "]") brackets = Math.max(0, brackets - 1);
    else if (char === ";" && parentheses === 0 && brackets === 0) {
      statements.push(source.slice(start, index));
      start = index + 1;
    }
  }
  statements.push(source.slice(start));
  return statements;
}

function parseRawGnuplotRange(statement) {
  const match = statement.match(/^set\s+([xy])range\s*\[\s*([\s\S]+?)\s*:\s*([\s\S]+?)\s*\]$/i);
  return match ? { axis: match[1].toLowerCase(), start: match[2], end: match[3] } : null;
}

function parseRawGnuplotSamples(statement) {
  const direct = statement.match(/^samples\s*=\s*([\s\S]+)$/i);
  const set = statement.match(/^set\s+samples\s+([\s\S]+)$/i);
  const match = direct || set;
  return match ? match[1].trim() : null;
}

function parseRawGnuplotPlot(statement) {
  const match = statement.match(/^plot\s*(?:\[\s*x\s*=\s*([\s\S]+?)\s*:\s*([\s\S]+?)\s*\])?\s*([\s\S]+)$/i);
  if (!match) return null;
  return { expression: match[3].trim(), xRange: match[1] ? { axis: "x", start: match[1], end: match[2] } : null };
}

function parseRawGnuplotDefinition(statement) {
  const assignment = topLevelAssignmentIndex(statement);
  if (assignment === -1) return null;
  const left = statement.slice(0, assignment).trim();
  const expression = statement.slice(assignment + 1).trim();
  if (!expression) return null;
  const functionMatch = left.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(([^()]*)\)$/);
  if (functionMatch) {
    const params = functionMatch[2].split(",").map((part) => part.trim()).filter(Boolean);
    if (!params.every((part) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(part))) return null;
    return { name: functionMatch[1], params, expression };
  }
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(left) ? { name: left, params: null, expression } : null;
}

function topLevelAssignmentIndex(source) {
  let parentheses = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") parentheses += 1;
    else if (char === ")") parentheses = Math.max(0, parentheses - 1);
    else if (char === "=" && parentheses === 0) {
      const previous = source[index - 1] || "";
      const next = source[index + 1] || "";
      if (previous !== "=" && previous !== "!" && previous !== "<" && previous !== ">" && next !== "=") return index;
    }
  }
  return -1;
}

class RawGnuplotExpressionParser {
  constructor(source, resolveIdentifier, callFunction) {
    this.tokens = tokenizeRawGnuplotExpression(source);
    this.index = 0;
    this.resolveIdentifier = resolveIdentifier;
    this.callFunction = callFunction;
  }

  parse() {
    const value = this.parseTernary();
    if (this.peek().type !== "eof") throw new Error(`Unexpected raw gnuplot token: ${this.peek().value}`);
    return value;
  }

  parseTernary() {
    const condition = this.parseBinary(0);
    if (!this.consume("?")) return condition;
    const whenTrue = this.parseTernary();
    this.expect(":");
    const whenFalse = this.parseTernary();
    return rawGnuplotTruthy(condition) ? whenTrue : whenFalse;
  }

  parseBinary(minPrecedence) {
    let left = this.parseUnary();
    while (true) {
      const operator = this.peek().value;
      const precedence = RAW_GNUPLOT_PRECEDENCE[operator];
      if (precedence === undefined || precedence < minPrecedence) break;
      this.index += 1;
      const right = this.parseBinary(operator === "^" || operator === "**" ? precedence : precedence + 1);
      left = rawGnuplotBinary(operator, left, right);
    }
    return left;
  }

  parseUnary() {
    const operator = this.peek().value;
    if (operator === "+" || operator === "-" || operator === "!") {
      this.index += 1;
      const value = this.parseUnary();
      if (operator === "+") return value;
      if (operator === "-") return -value;
      return rawGnuplotTruthy(value) ? 0 : 1;
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    const token = this.peek();
    if (token.type === "number") {
      this.index += 1;
      return token.value;
    }
    if (token.type === "identifier") {
      this.index += 1;
      if (!this.consume("(")) return this.resolveIdentifier(token.value);
      const args = [];
      if (!this.consume(")")) {
        do {
          args.push(this.parseTernary());
        } while (this.consume(","));
        this.expect(")");
      }
      return this.callFunction(token.value, args);
    }
    if (this.consume("(")) {
      const value = this.parseTernary();
      this.expect(")");
      return value;
    }
    throw new Error(`Unexpected raw gnuplot expression token: ${token.value}`);
  }

  peek() {
    return this.tokens[this.index] || { type: "eof", value: "" };
  }

  consume(value) {
    if (this.peek().value !== value) return false;
    this.index += 1;
    return true;
  }

  expect(value) {
    if (!this.consume(value)) throw new Error(`Expected raw gnuplot token: ${value}`);
  }
}

const RAW_GNUPLOT_PRECEDENCE = {
  "||": 1,
  "&&": 2,
  "==": 3,
  "!=": 3,
  "<": 4,
  "<=": 4,
  ">": 4,
  ">=": 4,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6,
  "%": 6,
  "^": 7,
  "**": 7
};

function tokenizeRawGnuplotExpression(source) {
  const tokens = [];
  const text = String(source || "").trim();
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    const number = text.slice(index).match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
    if (number) {
      tokens.push({ type: "number", value: Number(number[0]) });
      index += number[0].length;
      continue;
    }
    const identifier = text.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (identifier) {
      tokens.push({ type: "identifier", value: identifier[0] });
      index += identifier[0].length;
      continue;
    }
    const operator = ["**", "<=", ">=", "==", "!=", "&&", "||"].find((value) => text.startsWith(value, index));
    if (operator || "+-*/%^()?,:<>!".includes(char)) {
      tokens.push({ type: "operator", value: operator || char });
      index += (operator || char).length;
      continue;
    }
    throw new Error(`Unsupported raw gnuplot character: ${char}`);
  }
  tokens.push({ type: "eof", value: "" });
  return tokens;
}

function rawGnuplotBinary(operator, left, right) {
  if (operator === "+") return left + right;
  if (operator === "-") return left - right;
  if (operator === "*") return left * right;
  if (operator === "/") return left / right;
  if (operator === "%") return left % right;
  if (operator === "^" || operator === "**") return left ** right;
  if (operator === "<") return left < right ? 1 : 0;
  if (operator === "<=") return left <= right ? 1 : 0;
  if (operator === ">") return left > right ? 1 : 0;
  if (operator === ">=") return left >= right ? 1 : 0;
  if (operator === "==") return left === right ? 1 : 0;
  if (operator === "!=") return left !== right ? 1 : 0;
  if (operator === "&&") return rawGnuplotTruthy(left) && rawGnuplotTruthy(right) ? 1 : 0;
  if (operator === "||") return rawGnuplotTruthy(left) || rawGnuplotTruthy(right) ? 1 : 0;
  throw new Error(`Unsupported raw gnuplot operator: ${operator}`);
}

function rawGnuplotTruthy(value) {
  return Number(value) !== 0 && !Number.isNaN(Number(value));
}

function rawGnuplotBuiltin(name, args) {
  const single = (fn) => args.length === 1 ? { handled: true, value: fn(args[0]) } : { handled: false };
  if (name === "sin") return single(Math.sin);
  if (name === "cos") return single(Math.cos);
  if (name === "tan") return single(Math.tan);
  if (name === "asin") return single(Math.asin);
  if (name === "acos") return single(Math.acos);
  if (name === "atan") return single(Math.atan);
  if (name === "sinh") return single(Math.sinh);
  if (name === "cosh") return single(Math.cosh);
  if (name === "tanh") return single(Math.tanh);
  if (name === "sqrt") return single(Math.sqrt);
  if (name === "exp") return single(Math.exp);
  if (name === "log") return single(Math.log);
  if (name === "log10") return single(Math.log10);
  if (name === "abs") return single(Math.abs);
  if (name === "floor") return single(Math.floor);
  if (name === "ceil") return single(Math.ceil);
  if (name === "int") return single(Math.trunc);
  if (name === "gamma") return single(gamma);
  if (name === "lgamma") return single(logGamma);
  if (name === "igamma" && args.length === 2) {
    return { handled: true, value: regularizedLowerGamma(args[0], args[1]) * gamma(args[0]) };
  }
  if (name === "atan2" && args.length === 2) return { handled: true, value: Math.atan2(args[0], args[1]) };
  if (name === "min" && args.length) return { handled: true, value: Math.min(...args) };
  if (name === "max" && args.length) return { handled: true, value: Math.max(...args) };
  return { handled: false };
}

function gamma(z) {
  return Math.exp(logGamma(z));
}

function logGamma(z) {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7
  ];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  let x = 0.9999999999998099;
  const shifted = z - 1;
  for (let index = 0; index < coefficients.length; index += 1) x += coefficients[index] / (shifted + index + 1);
  const t = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(x);
}

function regularizedLowerGamma(a, x) {
  if (x <= 0) return 0;
  if (x < a + 1) return lowerGammaSeries(a, x);
  return 1 - upperGammaContinuedFraction(a, x);
}

function lowerGammaSeries(a, x) {
  const logTerm = -x + a * Math.log(x) - logGamma(a);
  let ap = a;
  let sum = 1 / a;
  let delta = sum;
  for (let n = 1; n <= 200; n += 1) {
    ap += 1;
    delta *= x / ap;
    sum += delta;
    if (Math.abs(delta) < Math.abs(sum) * 1e-14) break;
  }
  return clamp01(sum * Math.exp(logTerm));
}

function upperGammaContinuedFraction(a, x) {
  const logTerm = -x + a * Math.log(x) - logGamma(a);
  let b = x + 1 - a;
  let c = 1 / 1e-30;
  let d = 1 / Math.max(b, 1e-30);
  let h = d;
  for (let i = 1; i <= 200; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return clamp01(Math.exp(logTerm) * h);
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}
