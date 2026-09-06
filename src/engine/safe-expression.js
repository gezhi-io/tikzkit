import { createToken, EmbeddedActionsParser, Lexer } from "chevrotain";

export const MATH_EXPRESSION_LIMITS = Object.freeze({ characters: 65536, tokens: 4096, depth: 64, operations: 16384 });

const Space = createToken({ name: "MathSpace", pattern: /\s+/, group: Lexer.SKIPPED });
const NumberToken = createToken({ name: "MathNumber", pattern: /(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/ });
const Identifier = createToken({ name: "MathIdentifier", pattern: /\\?[A-Za-z_@][A-Za-z0-9_@]*(?:\{\})?/ });
const Or = createToken({ name: "MathOr", pattern: /\|\|/ });
const And = createToken({ name: "MathAnd", pattern: /&&/ });
const Equality = createToken({ name: "MathEquality", pattern: /===|!==|==|!=/ });
const Relation = createToken({ name: "MathRelation", pattern: /<=|>=|<|>/ });
const Power = createToken({ name: "MathPower", pattern: /\*\*|\^/ });
const Add = createToken({ name: "MathAdd", pattern: /[+-]/ });
const Multiply = createToken({ name: "MathMultiply", pattern: /[*/%]/ });
const Not = createToken({ name: "MathNot", pattern: /!/ });
const BitOr = createToken({ name: "MathBitOr", pattern: /\|/ });
const BitAnd = createToken({ name: "MathBitAnd", pattern: /&/ });
const Question = createToken({ name: "MathQuestion", pattern: /\?/ });
const Colon = createToken({ name: "MathColon", pattern: /:/ });
const Comma = createToken({ name: "MathComma", pattern: /,/ });
const LParen = createToken({ name: "MathLParen", pattern: /\(/ });
const RParen = createToken({ name: "MathRParen", pattern: /\)/ });
const LBrace = createToken({ name: "MathLBrace", pattern: /\{/ });
const RBrace = createToken({ name: "MathRBrace", pattern: /\}/ });
const tokens = [Space, NumberToken, Identifier, Or, And, Equality, Relation, Power, Add, Multiply, Not, BitOr, BitAnd, Question, Colon, Comma, LParen, RParen, LBrace, RBrace];
const lexer = new Lexer(tokens, { positionTracking: "onlyOffset" });

class MathParser extends EmbeddedActionsParser {
  constructor() {
    super(tokens, { recoveryEnabled: false, maxLookahead: 2 });
    const $ = this;
    $.RULE("expression", () => {
      let node = $.SUBRULE($.logicalOr);
      $.OPTION(() => {
        $.CONSUME(Question);
        const yes = $.SUBRULE($.expression);
        $.CONSUME(Colon);
        const no = $.SUBRULE2($.expression);
        node = $.ACTION(() => ({ type: "conditional", condition: node, yes, no }));
      });
      return node;
    });
    // Each precedence level builds nodes; no source text is ever executed.
    for (const [name, lower, operator] of [
      ["logicalOr", "logicalAnd", Or], ["logicalAnd", "bitOr", And],
      ["bitOr", "bitAnd", BitOr], ["bitAnd", "equality", BitAnd],
      ["equality", "relation", Equality], ["relation", "sum", Relation],
      ["sum", "product", Add], ["product", "unary", Multiply]
    ]) {
      $.RULE(name, () => {
        let node = $.SUBRULE($[lower]);
        $.MANY(() => {
          const op = $.CONSUME(operator);
          const right = $.SUBRULE2($[lower]);
          node = $.ACTION(() => ({ type: "binary", operator: op.image, left: node, right }));
        });
        return node;
      });
    }
    $.RULE("unary", () => $.OR([
      { ALT: () => {
        const op = $.OR2([{ ALT: () => $.CONSUME(Add) }, { ALT: () => $.CONSUME(Not) }]);
        const value = $.SUBRULE($.unary);
        return $.ACTION(() => ({ type: "unary", operator: op.image, value }));
      } },
      { ALT: () => $.SUBRULE($.power) }
    ]));
    $.RULE("power", () => {
      let node = $.SUBRULE($.primary);
      $.OPTION(() => {
        $.CONSUME(Power);
        const right = $.SUBRULE($.unary);
        node = $.ACTION(() => ({ type: "binary", operator: "^", left: node, right }));
      });
      return node;
    });
    $.RULE("primary", () => $.OR([
      { ALT: () => {
        const token = $.CONSUME(NumberToken);
        return $.ACTION(() => ({ type: "number", value: Number(token.image) }));
      } },
      { ALT: () => {
        const token = $.CONSUME(Identifier);
        let args;
        $.OPTION(() => {
          $.CONSUME(LParen);
          args = [];
          $.MANY_SEP({ SEP: Comma, DEF: () => {
            let value = $.SUBRULE($.expression);
            $.OPTION2(() => {
              const suffix = $.CONSUME2(Identifier);
              value = $.ACTION(() => ({ type: "suffix", suffix: suffix.image, value }));
            });
            $.ACTION(() => args.push(value));
          } });
          $.CONSUME(RParen);
        });
        return $.ACTION(() => ({ type: args ? "call" : "variable", name: token.image.replace(/^\\/, "").replace(/\{\}$/, ""), args }));
      } },
      { ALT: () => {
        $.CONSUME2(LParen);
        const node = $.SUBRULE2($.expression);
        $.CONSUME2(RParen);
        return node;
      } },
      { ALT: () => {
        $.CONSUME(LBrace);
        const node = $.SUBRULE3($.expression);
        $.CONSUME(RBrace);
        return node;
      } }
    ]));
    this.performSelfAnalysis();
  }
}

const parser = new MathParser();
const astCache = new Map();
let diagnosticContext;

export class MathExpressionError extends Error {
  constructor(diagnostic) {
    super(diagnostic.message);
    this.name = "MathExpressionError";
    this.code = diagnostic.code;
    this.diagnostic = diagnostic;
  }
}

export function mathFailure(expression, code, message, offset) {
  return { ok: false, value: NaN, diagnostic: {
    severity: "error", code, message, expression: String(expression),
    ...(Number.isFinite(offset) ? { offset } : {})
  } };
}

// Scope this around synchronous parse/interpret phases, not an awaited callback.
export function withMathDiagnostics(diagnostics, callback) {
  const previous = diagnosticContext;
  diagnosticContext = diagnostics;
  try { return callback(); } finally { diagnosticContext = previous; }
}

export function mathResultValue(result, options = {}) {
  if (result.ok) return result.value;
  const sink = options.diagnostics ?? diagnosticContext;
  if (typeof sink === "function") sink(result.diagnostic);
  else if (Array.isArray(sink)) sink.push(result.diagnostic);
  options.onDiagnostic?.(result.diagnostic);
  if (options.throwOnError) throw new MathExpressionError(result.diagnostic);
  return NaN;
}

function fail(code, message, offset) {
  throw new MathExpressionError(mathFailure("", code, message, offset).diagnostic);
}

function parseExpression(source) {
  if (source.length > MATH_EXPRESSION_LIMITS.characters) fail("math-expression-limit", "Math expression exceeds the source length limit.");
  if (astCache.has(source)) return astCache.get(source);
  const lexed = lexer.tokenize(source);
  if (lexed.errors.length) fail("math-syntax", "Unsupported token in math expression.", lexed.errors[0].offset);
  if (lexed.tokens.length > MATH_EXPRESSION_LIMITS.tokens) fail("math-expression-limit", "Math expression exceeds the token limit.");
  // Bound recursive grammar paths before entering the parser, including unary
  // chains and right-associative powers/conditionals, not only parentheses.
  let recursion = 0;
  for (const token of lexed.tokens) {
    if ([LParen, LBrace, Power, Question, Add, Not].includes(token.tokenType)) recursion += 1;
    if (recursion > MATH_EXPRESSION_LIMITS.depth) fail("math-expression-limit", "Math expression exceeds the nesting limit.", token.startOffset);
  }
  parser.input = lexed.tokens;
  const ast = parser.expression();
  if (parser.errors.length) fail("math-syntax", "Invalid math expression.", parser.errors[0].token.startOffset);
  if (astCache.size >= 256) astCache.delete(astCache.keys().next().value);
  astCache.set(source, ast);
  return ast;
}

export function evaluateRestrictedExpression(expression, variables = {}, options = {}) {
  const source = String(expression ?? "");
  try {
    const declarations = new Map();
    if ((options.declarations?.length || 0) > 256) fail("math-expression-limit", "Too many declared math functions.");
    for (const declaration of options.declarations || []) {
      if (!/^[A-Za-z@][A-Za-z0-9_@]*$/.test(declaration.name) || !(declaration.params || []).every((name) => /^[A-Za-z@][A-Za-z0-9_@]*$/.test(name))) {
        fail("math-syntax", "Invalid declared math function name or parameter.");
      }
      declarations.set(declaration.name, declaration);
    }
    const state = { variables: variables || {}, runtime: createMathRuntime(options), budget: { operations: 0 }, resolving: new Set(), declarations, options };
    const ast = parseExpression(source);
    let value = interpret(ast, state, 0);
    // Retain only the existing PGFPlots isolated top-level 0/0 policy. Other
    // nonfinite expressions remain failures, including all coordinate maths.
    if (!Number.isFinite(value) && options.recoverZeroDivision && ast.type === "binary" && ast.operator === "/") {
      const numerator = interpret(ast.left, state, 0);
      const denominator = interpret(ast.right, state, 0);
      if (Number.isFinite(numerator) && Number.isFinite(denominator) && Math.abs(numerator) < 1e-12 && Math.abs(denominator) < 1e-12) value = 0;
    }
    return Number.isFinite(value)
      ? { ok: true, value }
      : mathFailure(source, "math-nonfinite", "Math expression did not produce a finite number.");
  } catch (error) {
    if (!(error instanceof MathExpressionError)) throw error;
    return { ok: false, value: NaN, diagnostic: { ...error.diagnostic, expression: source } };
  }
}

function interpret(node, state, depth) {
  if (++state.budget.operations > MATH_EXPRESSION_LIMITS.operations || depth > MATH_EXPRESSION_LIMITS.depth) {
    fail("math-expression-limit", "Math expression exceeds the evaluation limit.");
  }
  const visit = (child) => interpret(child, state, depth + 1);
  if (node.type === "number") return node.value;
  const declaration = state.declarations.get(node.name);
  if (declaration && ((node.type === "variable" && declaration.type === "constant") || (node.type === "call" && declaration.type === "function"))) {
    const params = declaration.params || [];
    const args = node.args || [];
    if (args.length !== params.length) fail("math-arity", `Invalid argument count for math function ${node.name}.`);
    const values = args.map(visit);
    const key = `declaration:${node.name}`;
    if (state.resolving.has(key)) fail("math-expression-limit", `Recursive math declaration: ${node.name}.`);
    state.resolving.add(key);
    const variables = Object.create(null, {
      ...Object.getOwnPropertyDescriptors(state.variables),
      ...Object.fromEntries(params.map((param, index) => [param, { value: values[index], enumerable: true, configurable: true }]))
    });
    const declarations = new Map(state.declarations);
    params.forEach((param) => declarations.delete(param));
    try { return interpret(parseExpression(String(declaration.body)), { ...state, variables, declarations }, depth + 1); }
    finally { state.resolving.delete(key); }
  }
  if (node.type === "variable") {
    const descriptor = Object.getOwnPropertyDescriptor(state.variables, node.name);
    if (!descriptor) {
      if (Object.hasOwn(CONSTANTS, node.name)) return CONSTANTS[node.name];
      fail("math-unknown-variable", `Unknown math variable: ${node.name}.`);
    }
    if (!Object.hasOwn(descriptor, "value") || !["number", "string"].includes(typeof descriptor.value)) {
      fail("math-invalid-variable", `Math variable ${node.name} must be a number or a math expression.`);
    }
    if (typeof descriptor.value === "number") return descriptor.value;
    if (state.resolving.has(node.name)) fail("math-expression-limit", `Cyclic math variable: ${node.name}.`);
    state.resolving.add(node.name);
    try { return visit(parseExpression(descriptor.value)); } finally { state.resolving.delete(node.name); }
  }
  if (node.type === "conditional") return visit(node.condition) ? visit(node.yes) : visit(node.no);
  if (node.type === "unary") {
    const value = visit(node.value);
    if (node.operator === "!") return value ? 0 : 1;
    return node.operator === "-" ? -value : value;
  }
  if (node.type === "binary") {
    const left = visit(node.left);
    if (node.operator === "&&") return left ? visit(node.right) : left;
    if (node.operator === "||") return left || visit(node.right);
    const right = visit(node.right);
    switch (node.operator) {
      case "+": return left + right;
      case "-": return left - right;
      case "*": return left * right;
      case "/": return left / right;
      case "%": return left % right;
      case "^": return left ** right;
      case "<": return Number(left < right);
      case ">": return Number(left > right);
      case "<=": return Number(left <= right);
      case ">=": return Number(left >= right);
      case "==": case "===": return Number(left === right);
      case "!=": case "!==": return Number(left !== right);
      case "&": return left & right;
      case "|": return left | right;
      default: fail("math-syntax", "Unsupported math operator.");
    }
  }
  if (node.type === "suffix") {
    if (node.suffix !== "r") fail("math-syntax", "Only the local radian suffix r is supported.");
    return visit(node.value) * 180 / Math.PI;
  }
  if (node.type === "call") {
    if (!Object.hasOwn(state.runtime, node.name)) fail("math-unknown-function", `Unknown math function: ${node.name}.`);
    const { fn, min, max } = state.runtime[node.name];
    if (node.args.length < min || node.args.length > max) fail("math-arity", `Invalid argument count for math function ${node.name}.`);
    if (["sin", "cos", "tan"].includes(node.name) && node.args[0].type === "suffix" && node.args[0].suffix === "r") {
      return Math[node.name](visit(node.args[0].value));
    }
    if (node.name === "gauss") {
      const [mean, sigma] = node.args.map(visit);
      const x = visit({ type: "variable", name: "x" });
      return 1 / (sigma * Math.sqrt(2 * Math.PI)) * Math.exp(-((x - mean) ** 2) / (2 * sigma ** 2));
    }
    return fn(...node.args.map(visit));
  }
  fail("math-syntax", "Invalid math expression node.");
}

const CONSTANTS = Object.freeze({ pi: Math.PI, e: Math.E, true: 1, false: 0 });
const rad = (value) => value * Math.PI / 180;
const deg = (value) => value * 180 / Math.PI;
const div = (left, right) => Math.trunc(left / right);
const mod = (left, right) => left - right * div(left, right);
const positiveMod = (left, right) => { const value = mod(left, right); return value < 0 ? value + right : value; };
const coordinateMod = (left, right) => ((left % right) + right) % right;
const spec = (fn, min = fn.length, max = min) => Object.freeze({ fn, min, max });
const commonFunctions = Object.freeze({
  pow: spec(Math.pow), sqrt: spec(Math.sqrt), abs: spec(Math.abs), exp: spec(Math.exp),
  ln: spec(Math.log), log: spec(Math.log), log10: spec(Math.log10),
  sinh: spec(Math.sinh), cosh: spec(Math.cosh), tanh: spec(Math.tanh),
  floor: spec(Math.floor), ceil: spec(Math.ceil), round: spec(Math.round),
  sign: spec((value) => value > 0 ? 1 : value < 0 ? -1 : 0), int: spec(Math.trunc),
  rad: spec(rad), deg: spec(deg), asin: spec((value) => deg(Math.asin(value))),
  acos: spec((value) => deg(Math.acos(value))), atan: spec((value) => deg(Math.atan(value))),
  atan2: spec((y, x) => deg(Math.atan2(y, x))), veclen: spec(Math.hypot, 2),
  min: spec(Math.min, 1, 256), max: spec(Math.max, 1, 256), gamma: spec(gammaLanczos), gauss: spec(() => NaN, 2),
  ifthenelse: spec((condition, yes, no) => condition ? yes : no),
  greater: spec((left, right) => Number(left > right)), less: spec((left, right) => Number(left < right)),
  equal: spec((left, right) => Number(Math.abs(left - right) < 1e-12)),
  not: spec((value) => value ? 0 : 1), and: spec((left, right) => left && right ? 1 : 0),
  or: spec((left, right) => left || right ? 1 : 0), div: spec(div)
});

export function createMathRuntime({ pgfTrig = false, radianTrig = false, coordinateModulo = false } = {}) {
  return Object.freeze({
    ...commonFunctions,
    mod: spec(coordinateModulo ? coordinateMod : mod), Mod: spec(coordinateModulo ? coordinateMod : positiveMod),
    sin: spec(radianTrig ? Math.sin : pgfTrig ? pgfSin : (value) => Math.sin(rad(value))),
    cos: spec(radianTrig ? Math.cos : pgfTrig ? pgfCos : (value) => Math.cos(rad(value))),
    tan: spec(radianTrig ? Math.tan : pgfTrig ? pgfTan : (value) => Math.tan(rad(value)))
  });
}

const TRIG_SP = 65536;
const texDimSp = (value) => Number.isFinite(value) ? Math.round(value * TRIG_SP) : NaN;
const texDim = (value) => texDimSp(value) / TRIG_SP;
const texScale = (value, factor) => Math.trunc(texDimSp(value) * texDimSp(factor) / TRIG_SP) / TRIG_SP;
const texOutput = (value) => Number(texDim(value).toFixed(5));
const cosTable = Array.from({ length: 181 }, (_entry, index) => Number(Math.cos(rad(index)).toFixed(5)));

function pgfCos(value) {
  let x = texDim(value);
  const count = Math.trunc(Math.trunc(x) / 360) * -360;
  x = texDim(x + count);
  if (x < 0) x = texDim(-x);
  if (!(x < 180)) x = texDim(-x + 360);
  const index = Math.max(0, Math.min(180, Math.trunc(x)));
  const fraction = texDim(x - index);
  if (Math.abs(fraction) < 1e-12) return texOutput(cosTable[index]);
  const nextIndex = index + 1 === 181 ? 179 : Math.min(180, index + 1);
  return texOutput(texScale(texDim(1 - fraction), cosTable[index]) + texScale(fraction, cosTable[nextIndex]));
}

function pgfSin(value) { return pgfCos(texDim(value) - 90); }
function pgfTan(value) {
  const denominator = pgfCos(value);
  return Math.abs(denominator) < 1e-12 ? NaN : Number((pgfSin(value) / denominator).toPrecision(8));
}

function gammaLanczos(z) {
  const coefficients = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gammaLanczos(1 - z));
  let x = 0.99999999999980993;
  const shifted = z - 1;
  for (let index = 0; index < coefficients.length; index += 1) x += coefficients[index] / (shifted + index + 1);
  const t = shifted + coefficients.length - 0.5;
  return Math.sqrt(2 * Math.PI) * t ** (shifted + 0.5) * Math.exp(-t) * x;
}
