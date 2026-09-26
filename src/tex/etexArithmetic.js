// e-TeX integer arithmetic: `\numexpr ... \relax` and `\the\numexpr ... \relax`.
//
// `\numexpr` is ordinary preamble-free TeX, not PGF, so TikZ documents use it
// for loop counters and computed colours:
//   \fill[blue!\the\numexpr10+10*\x\relax] ...
// The evaluated integer is substituted into the source before parsing.
import { createToken, EmbeddedActionsParser, Lexer } from "chevrotain";
import { MATH_EXPRESSION_LIMITS } from "../engine/safe-expression.js";

const THE_COMMAND = "\\the";
const NUMEXPR_COMMAND = "\\numexpr";

// Expand every `\the\numexpr ... \relax` occurrence in `source`.
// An expression that cannot be evaluated is left untouched so a later stage can
// still report it, rather than silently deleting document content.
export function expandTheNumexpr(source, diagnostics = []) {
  const text = String(source ?? "");
  if (!text.includes(NUMEXPR_COMMAND)) return text;
  let index = 0;
  let output = "";
  while (index < text.length) {
    const start = text.indexOf(THE_COMMAND, index);
    if (start === -1) {
      output += text.slice(index);
      break;
    }
    // `\theta` and friends share the `\the` prefix but are different commands.
    const afterThe = text[start + THE_COMMAND.length];
    if (afterThe !== undefined && /[A-Za-z@]/.test(afterThe)) {
      output += text.slice(index, start + THE_COMMAND.length);
      index = start + THE_COMMAND.length;
      continue;
    }
    let cursor = skipSpaces(text, start + THE_COMMAND.length);
    if (!text.startsWith(NUMEXPR_COMMAND, cursor) || /[A-Za-z@]/.test(text[cursor + NUMEXPR_COMMAND.length] || "")) {
      output += text.slice(index, start + THE_COMMAND.length);
      index = start + THE_COMMAND.length;
      continue;
    }
    cursor = skipSpaces(text, cursor + NUMEXPR_COMMAND.length);
    const body = readIntegerExpression(text, cursor);
    if (!body) {
      output += text.slice(index, start + THE_COMMAND.length);
      index = start + THE_COMMAND.length;
      continue;
    }
    const value = evaluateIntegerExpression(body.expression);
    if (!Number.isFinite(value)) {
      // The reader stops before a control sequence, so an expression ending at
      // `\x` reads as `20+10*`. That is usually a foreach/macro variable which
      // is not bound yet, and the loop body retries after substitution, so stay
      // quiet and leave the source untouched rather than deleting content.
      const stoppedAtControlSequence = text[body.end] === "\\" &&
        /[A-Za-z@]/.test(text[body.end + 1] || "");
      if (!stoppedAtControlSequence && !/\\[A-Za-z@]/.test(body.expression)) {
        diagnostics.push({
          severity: "warning",
          code: "numexpr-unsupported",
          message: `Could not evaluate \\numexpr expression \`${body.expression.trim()}\`.`
        });
      }
      output += text.slice(index, body.end);
      index = body.end;
      continue;
    }
    output += text.slice(index, start);
    output += String(value);
    index = body.end;
  }
  return output;
}

function skipSpaces(text, index) {
  let cursor = index;
  while (cursor < text.length && /\s/.test(text[cursor])) cursor += 1;
  return cursor;
}

// Read the expression, stopping at a terminator control sequence, at a
// delimiter that cannot belong to an integer expression, or at end of input.
function readIntegerExpression(text, start) {
  let depth = 0;
  let cursor = start;
  while (cursor < text.length) {
    const char = text[cursor];
    if (char === "\\") {
      if (depth === 0) {
        // Only \relax is absorbed. A conditional or following macro belongs
        // to the surrounding source and must remain available to its parser.
        if (/^\\relax(?![A-Za-z@])/.test(text.slice(cursor))) {
          return { expression: text.slice(start, cursor), end: cursor + "\\relax".length };
        }
        return { expression: text.slice(start, cursor), end: cursor };
      }
      cursor += 1;
      continue;
    }
    if (char === "(") depth += 1;
    else if (char === ")") {
      if (depth === 0) break;
      depth -= 1;
    } else if (depth === 0 && (char === "}" || char === "]" || char === "," || char === "&" || char === ";")) {
      break;
    }
    cursor += 1;
  }
  return { expression: text.slice(start, cursor), end: cursor };
}

const Space = createToken({ name: "EtexSpace", pattern: /\s+/, group: Lexer.SKIPPED });
const Integer = createToken({ name: "EtexInteger", pattern: /\d+/ });
const Add = createToken({ name: "EtexAdd", pattern: /[+-]/ });
const Multiply = createToken({ name: "EtexMultiply", pattern: /[*/]/ });
const Open = createToken({ name: "EtexOpen", pattern: /\(/ });
const Close = createToken({ name: "EtexClose", pattern: /\)/ });
const tokens = [Space, Integer, Add, Multiply, Open, Close];
const lexer = new Lexer(tokens, { positionTracking: "onlyOffset" });
const MAX_INTEGER = 2147483647n;

function checkedInteger(value) {
  if (value > MAX_INTEGER || value < -MAX_INTEGER) throw new RangeError("e-TeX integer overflow");
  return value;
}

function roundedDivision(numerator, denominator) {
  if (denominator === 0n) throw new RangeError("e-TeX division by zero");
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const quotient = (2n * n + d) / (2n * d);
  return checkedInteger((numerator < 0n) !== (denominator < 0n) ? -quotient : quotient);
}

// e-TeX checks each operation but fuses a consecutive multiply/divide pair
// with a wide intermediate product. Parenthesized factors finish separately.
function evaluateTerm(value, operations) {
  for (let index = 0; index < operations.length; index += 1) {
    const { operator, right } = operations[index];
    if (operator === "*" && operations[index + 1]?.operator === "/") {
      value = roundedDivision(value * right, operations[++index].right);
    } else {
      value = operator === "*" ? checkedInteger(value * right) : roundedDivision(value, right);
    }
  }
  return value;
}

class IntegerExpressionParser extends EmbeddedActionsParser {
  constructor() {
    super(tokens, { recoveryEnabled: false });
    const $ = this;
    $.RULE("expression", () => {
      let value = $.SUBRULE($.term);
      $.MANY(() => {
        const operator = $.CONSUME(Add);
        const right = $.SUBRULE2($.term);
        $.ACTION(() => { value = checkedInteger(operator.image === "+" ? value + right : value - right); });
      });
      return value;
    });
    $.RULE("term", () => {
      const value = $.SUBRULE($.factor);
      const operations = [];
      $.MANY(() => {
        const operator = $.CONSUME(Multiply);
        const right = $.SUBRULE2($.factor);
        $.ACTION(() => operations.push({ operator: operator.image, right }));
      });
      return $.ACTION(() => evaluateTerm(value, operations));
    });
    $.RULE("factor", () => {
      let sign = 1n;
      $.MANY(() => {
        const operator = $.CONSUME(Add);
        $.ACTION(() => { if (operator.image === "-") sign = -sign; });
      });
      const value = $.OR([
        { ALT: () => {
          const token = $.CONSUME(Integer);
          return $.ACTION(() => checkedInteger(BigInt(token.image)));
        } },
        { ALT: () => {
          $.CONSUME(Open);
          const nested = $.SUBRULE($.expression);
          $.CONSUME(Close);
          return nested;
        } }
      ]);
      return $.ACTION(() => sign * value);
    });
    this.performSelfAnalysis();
  }
}

const parser = new IntegerExpressionParser();

function evaluateIntegerExpression(rawExpression) {
  const expression = String(rawExpression || "").trim();
  if (!expression || expression.length > MATH_EXPRESSION_LIMITS.characters) return NaN;
  const lexed = lexer.tokenize(expression);
  if (lexed.errors.length || lexed.tokens.length > MATH_EXPRESSION_LIMITS.tokens) return NaN;
  let depth = 0;
  for (const token of lexed.tokens) {
    if (token.tokenType === Open) depth += 1;
    if (token.tokenType === Close) depth -= 1;
    if (depth < 0 || depth > MATH_EXPRESSION_LIMITS.depth) return NaN;
  }
  try {
    parser.input = lexed.tokens;
    const value = parser.expression();
    return parser.errors.length ? NaN : Number(value);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return NaN;
  }
}
