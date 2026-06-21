import { evaluateMath, roundNumber } from "../math.js";

const EM = 0.35;
const LINE_WIDTH = 0.0816 * EM;
const BROKEN_GAP_START = EM / 3;
const BROKEN_GAP_END = (2 * EM) / 3;
const LINE_SPACING = 0.408 * EM;
const HEXAGRAM_LINE_SPACING = 0.1632 * EM;
const TAIJI_RADIUS = 0.17646;

export const tikzBaguaExtension = {
  name: "tikz-bagua",
  phase: "preprocess",
  description: "Expands tikz-bagua taiji, liangyi, sixiang, bagua, and Bagua symbols into ordinary TikZ paths.",
  commands: ["taiji", "xtaiji", "liangyi", "sixiang", "bagua", "Bagua"],
  preprocess(source, context = {}) {
    return expandTikzBagua(source, context.diagnostics || []);
  }
};

function expandTikzBagua(source, diagnostics = []) {
  let current = expandNodeWrappedSymbols(String(source), diagnostics);
  current = expandStandaloneSymbols(current, diagnostics);
  return current;
}

function expandNodeWrappedSymbols(source, diagnostics) {
  let output = "";
  let index = 0;
  while (index < source.length) {
    if (!source.startsWith("\\node", index)) {
      output += source[index];
      index += 1;
      continue;
    }
    const end = findStatementEnd(source, index);
    if (end === -1) {
      output += source[index];
      index += 1;
      continue;
    }
    const statement = source.slice(index, end + 1);
    const replacement = expandBaguaNodeStatement(statement, diagnostics);
    output += replacement || statement;
    index = end + 1;
  }
  return output;
}

function expandBaguaNodeStatement(statement, diagnostics) {
  const body = statement.trim().replace(/;$/, "");
  let cursor = "\\node".length;
  cursor = skipWhitespace(body, cursor);
  if (body[cursor] === "[") {
    const options = extractBalanced(body, cursor, "[", "]");
    if (!options) return null;
    cursor = skipWhitespace(body, options.end);
  }
  if (body[cursor] === "(") {
    const name = extractBalanced(body, cursor, "(", ")");
    if (!name) return null;
    cursor = skipWhitespace(body, name.end);
  }
  if (!body.startsWith("at", cursor)) return null;
  cursor = skipWhitespace(body, cursor + 2);
  const coordinate = extractBalanced(body, cursor, "(", ")");
  if (!coordinate) return null;
  cursor = skipWhitespace(body, coordinate.end);
  if (body[cursor] === "[") {
    const nodeOptions = extractBalanced(body, cursor, "[", "]");
    if (!nodeOptions) return null;
    cursor = skipWhitespace(body, nodeOptions.end);
  }
  const label = extractBalanced(body, cursor, "{", "}");
  if (!label) return null;
  if (body.slice(label.end).trim()) return null;
  const symbol = expandSingleSymbol(label.content.trim(), diagnostics);
  if (!symbol) return null;
  return `\\begin{scope}[shift={({${coordinate.content}})}]\n${symbol.body}\n\\end{scope}`;
}

function expandStandaloneSymbols(source, diagnostics) {
  let output = "";
  let index = 0;
  while (index < source.length) {
    const symbol = expandSingleSymbolAt(source, index, diagnostics);
    if (!symbol) {
      output += source[index];
      index += 1;
      continue;
    }
    output += symbol.body;
    index = symbol.end;
  }
  return output;
}

function expandSingleSymbol(source, diagnostics) {
  const symbol = expandSingleSymbolAt(source, 0, diagnostics);
  if (!symbol || source.slice(symbol.end).trim()) return null;
  return symbol;
}

function expandSingleSymbolAt(source, index, diagnostics) {
  for (const name of ["xtaiji", "taiji", "liangyi", "sixiang", "bagua", "Bagua"]) {
    const token = `\\${name}`;
    if (!source.startsWith(token, index)) continue;
    const next = source[index + token.length];
    if (/[A-Za-z@]/.test(next || "")) continue;
    return parseBaguaCommand(source, index, name, diagnostics);
  }
  return null;
}

function parseBaguaCommand(source, index, name, diagnostics) {
  let cursor = index + name.length + 1;
  cursor = skipWhitespace(source, cursor);
  const starred = source[cursor] === "*";
  if (starred) {
    cursor = skipWhitespace(source, cursor + 1);
  }

  if (name === "taiji" || name === "xtaiji") {
    const scale = parseOptionalScale(source, cursor);
    return {
      body: expandTaiji({ variant: name, starred, scale: scale.value }),
      end: scale.end
    };
  }

  let base = "2";
  if (name === "Bagua" && !starred && source[cursor] === "[") {
    const optional = extractBalanced(source, cursor, "[", "]");
    if (!optional) return unsupported(source, index, diagnostics, `Malformed \\${name} base option`);
    base = optional.content.trim() || "2";
    cursor = skipWhitespace(source, optional.end);
  }

  const value = extractBalanced(source, cursor, "{", "}");
  if (!value) return unsupported(source, index, diagnostics, `Malformed \\${name} value`);
  cursor = skipWhitespace(source, value.end);
  const scale = parseOptionalScale(source, cursor);
  const bits = commandBits(name, value.content.trim(), { starred, base }, diagnostics);
  if (!bits) return { body: "", end: scale.end };
  return {
    body: expandLineSymbol(bits, { scale: scale.value }),
    end: scale.end
  };
}

function commandBits(name, value, options, diagnostics) {
  if (name === "liangyi") return parseBits(value, 1, options.starred, 2, diagnostics, name);
  if (name === "sixiang") return parseBits(value, 2, options.starred, 2, diagnostics, name);
  if (name === "bagua") return parseBits(value, 3, options.starred, 2, diagnostics, name);
  if (name === "Bagua") return parseBits(value, 6, options.starred, Number(options.base || 2), diagnostics, name);
  return null;
}

function parseBits(value, width, decimalMode, base, diagnostics, name) {
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) {
    diagnostics.push({ severity: "warning", message: `tikz-bagua ${name} expects an integer value` });
    return null;
  }
  const number = decimalMode ? Number(text) : Number.parseInt(text, base);
  if (!Number.isFinite(number) || number < 0 || number >= 2 ** width) {
    diagnostics.push({ severity: "warning", message: `tikz-bagua ${name} value is outside the supported range` });
    return null;
  }
  return number.toString(2).padStart(width, "0").slice(-width);
}

function expandLineSymbol(bits, { scale }) {
  const factor = num(scale);
  const spacing = bits.length === 6 ? HEXAGRAM_LINE_SPACING : LINE_SPACING;
  const top = ((bits.length - 1) * spacing) / 2;
  return bits
    .split("")
    .map((bit, index) => {
      const y = (top - index * spacing) * factor;
      const width = EM * factor;
      const lineWidth = LINE_WIDTH * factor;
      if (bit === "1") {
        return `\\draw[bagua line,line width=${fmt(lineWidth)}] (0,${fmt(y)}) -- (${fmt(width)},${fmt(y)});`;
      }
      return `\\draw[bagua line,line width=${fmt(lineWidth)}] (0,${fmt(y)}) -- (${fmt(
        BROKEN_GAP_START * factor
      )},${fmt(y)}) (${fmt(BROKEN_GAP_END * factor)},${fmt(y)}) -- (${fmt(width)},${fmt(y)});`;
    })
    .join("\n");
}

function expandTaiji({ variant, starred, scale }) {
  const radius = TAIJI_RADIUS * num(scale);
  const half = radius / 2;
  const eye = radius / Math.E / 4;
  const curve = variant === "xtaiji"
    ? `(0,${fmt(-radius)}) arc (270:90:${fmt(half)}) arc (-90:90:${fmt(half)}) arc (90:-90:${fmt(radius)})`
    : `(0,${fmt(-radius)}) .. controls (${fmt(radius * 0.88)},${fmt(-radius * 0.45)}) and (${fmt(
        radius * 0.88
      )},${fmt(radius * 0.45)}) .. (0,${fmt(radius)}) arc (90:-90:${fmt(radius)})`;
  const eyes = starred
    ? [
        `\\fill[white,bagua taiji eye] (0,${fmt(-half)}) circle (${fmt(eye)});`,
        `\\fill[black,bagua taiji eye] (0,${fmt(half)}) circle (${fmt(eye)});`
      ].join("\n")
    : "";
  return [
    `\\fill[black,bagua taiji fill] ${curve} -- cycle;`,
    `\\draw[bagua taiji outline] (0,0) circle (${fmt(radius)});`,
    eyes
  ]
    .filter(Boolean)
    .join("\n");
}

function parseOptionalScale(source, cursor) {
  cursor = skipWhitespace(source, cursor);
  if (source[cursor] !== "[") return { value: "1", end: cursor };
  const parsed = extractBalanced(source, cursor, "[", "]");
  if (!parsed) return { value: "1", end: cursor };
  return { value: parsed.content.trim() || "1", end: parsed.end };
}

function unsupported(source, index, diagnostics, message) {
  diagnostics.push({ severity: "warning", message });
  return { body: source[index], end: index + 1 };
}

function findStatementEnd(source, start) {
  let brace = 0;
  let bracket = 0;
  let paren = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{" && source[index - 1] !== "\\") brace += 1;
    if (char === "}" && source[index - 1] !== "\\") brace = Math.max(0, brace - 1);
    if (char === "[") bracket += 1;
    if (char === "]") bracket = Math.max(0, bracket - 1);
    if (char === "(") paren += 1;
    if (char === ")") paren = Math.max(0, paren - 1);
    if (char === ";" && brace === 0 && bracket === 0 && paren === 0) return index;
  }
  return -1;
}

function extractBalanced(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === open && source[index - 1] !== "\\") depth += 1;
    if (source[index] === close && source[index - 1] !== "\\") depth -= 1;
    if (depth === 0) {
      return { content: source.slice(start + 1, index), end: index + 1 };
    }
  }
  return null;
}

function skipWhitespace(source, index) {
  let cursor = index;
  while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
  return cursor;
}

function num(value) {
  return evaluateMath(String(value || "1"));
}

function fmt(value) {
  return String(roundNumber(value, 6));
}
