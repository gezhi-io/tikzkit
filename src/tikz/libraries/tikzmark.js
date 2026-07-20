export const tikzLibrary = {
  "name": "tikzmark",
  "status": "partial",
  "implementedBy": "src/tikz/libraries/tikzmark.js",
  "features": [
    "inline marks inside standalone math arrays",
    "fit overlays spanning marked array cells"
  ],
  "implements": [
    "inline marks inside standalone math arrays",
    "fit overlays spanning marked array cells"
  ]
};

const ARRAY_BEGIN = "\\begin{array}";
const ARRAY_END = "\\end{array}";

export function lowerTikzmarkMathOverlays(source) {
  const text = String(source || "");
  if (!text.includes("\\tikzmark{") || !text.includes(ARRAY_BEGIN)) return text;

  let serial = 0;
  let loweredAny = false;
  const loweredPreviews = text.replace(/\\begin\{preview\}([\s\S]*?)\\end\{preview\}/g, (match, body) => {
    const lowered = lowerMarkedArrayMathBlock(body, ++serial);
    if (!lowered) return match;
    loweredAny = true;
    return lowered;
  });
  if (loweredAny) return loweredPreviews;

  const lowered = lowerMarkedArrayMathBlock(text, ++serial);
  return lowered || text;
}

function lowerMarkedArrayMathBlock(rawBlock, serial) {
  const block = String(rawBlock || "").trim();
  if (!block.startsWith("$") || !block.endsWith("$")) return null;
  const math = block.slice(1, -1);
  const arrayStart = math.indexOf(ARRAY_BEGIN);
  if (arrayStart < 0) return null;

  let cursor = skipWhitespace(math, arrayStart + ARRAY_BEGIN.length);
  const columns = readBalanced(math, cursor, "{", "}");
  if (!columns) return null;
  const arrayEnd = math.indexOf(ARRAY_END, columns.end);
  if (arrayEnd < 0) return null;

  let prefix = math.slice(0, arrayStart).trim();
  let suffix = math.slice(arrayEnd + ARRAY_END.length).trim();
  const leftMatch = prefix.match(/\\left\s*([([{])\s*$/);
  const leftDelimiter = leftMatch?.[1] || "";
  if (leftMatch) prefix = prefix.slice(0, leftMatch.index).trim();
  const rightMatch = suffix.match(/^\\right\s*([)\]}])/);
  const rightDelimiter = rightMatch?.[1] || "";
  if (rightMatch) suffix = suffix.slice(rightMatch[0].length).trim();

  const aliases = new Map();
  const rows = splitAtTopLevel(math.slice(columns.end, arrayEnd), "row")
    .map((row) => splitAtTopLevel(row, "cell").map((cell) => lowerMarkedArrayCell(cell, aliases)))
    .filter((row) => row.some((cell) => cell.trim().length));
  if (!rows.length) return null;

  const matrixName = `tikzkit-marked-array-${serial}`;
  const prefixName = `${matrixName}-prefix`;
  const matrixOptions = [
    "matrix of math nodes",
    "nodes={inner sep=0pt,outer sep=0pt,minimum height=0.48cm}",
    "column sep=0.216cm",
    "row sep=-0.02cm",
    "inner sep=0pt",
    "delimiter sep=0.329cm",
    leftDelimiter ? `left delimiter=${delimiterOption(leftDelimiter, "left")}` : "",
    rightDelimiter ? `right delimiter=${delimiterOption(rightDelimiter, "right")}` : ""
  ].filter(Boolean).join(",");
  const matrixBody = rows.map((row) => row.join(" & ")).join(" \\\\\n");
  const overlayNodes = extractFitOverlayNodes(suffix)
    .map((node) => rewriteFitAliases(node, aliases))
    .map(calibrateStandaloneArrayFitOverlay);

  const statements = [
    `\\begin{tikzpicture}`,
    `\\matrix (${matrixName}) [${matrixOptions}] {${matrixBody}};`
  ];
  if (prefix) {
    statements.push(
      `\\node (${prefixName}) [inner sep=0pt,outer sep=0pt,left=1.544em of ${matrixName}] {$${prefix}$};`
    );
  }
  statements.push(...overlayNodes);
  if (rightDelimiter) {
    statements.push(
      `\\path[use as bounding box] ([xshift=-0.109cm]${prefixName}.west) -- ([xshift=0.481cm]${matrixName}.east);`
    );
  }
  statements.push("\\end{tikzpicture}");
  return statements.join("\n");
}

function lowerMarkedArrayCell(rawCell, aliases) {
  const source = String(rawCell || "").trim();
  let output = "";
  let cursor = 0;
  const marks = [];
  while (cursor < source.length) {
    const start = source.indexOf("\\tikzmark", cursor);
    if (start < 0) {
      output += source.slice(cursor);
      break;
    }
    output += source.slice(cursor, start);
    let readIndex = skipWhitespace(source, start + "\\tikzmark".length);
    const name = readBalanced(source, readIndex, "{", "}");
    if (!name) {
      output += source.slice(start);
      break;
    }
    readIndex = skipWhitespace(source, name.end);
    const body = readBalanced(source, readIndex, "{", "}");
    if (!body) {
      output += source.slice(start);
      break;
    }
    const content = stripOuterMath(body.content.trim());
    marks.push({ name: name.content.trim(), content });
    output += content;
    cursor = body.end;
  }

  const text = stripOuterMath(output.trim());
  const primary = marks.find((mark) => mark.content)?.name || marks[0]?.name || "";
  if (!primary) return text;
  for (const mark of marks) {
    if (mark.name && mark.name !== primary) aliases.set(mark.name, primary);
  }
  return `\\node (${primary}) {${text}};`;
}

function extractFitOverlayNodes(source) {
  const text = String(source || "");
  const nodes = [];
  let cursor = 0;
  while (cursor < text.length) {
    const start = text.indexOf("\\node", cursor);
    if (start < 0) break;
    let readIndex = skipWhitespace(text, start + "\\node".length);
    if (text[readIndex] !== "[") {
      cursor = start + "\\node".length;
      continue;
    }
    const options = readBalanced(text, readIndex, "[", "]");
    if (!options || !/\bfit\s*=/.test(options.content)) {
      cursor = options?.end || start + "\\node".length;
      continue;
    }
    readIndex = skipWhitespace(text, options.end);
    const body = readBalanced(text, readIndex, "{", "}");
    if (!body) {
      cursor = options.end;
      continue;
    }
    nodes.push(`\\node[${options.content}] {${body.content}};`);
    cursor = body.end;
  }
  return nodes;
}

function rewriteFitAliases(statement, aliases) {
  let output = statement;
  for (const [name, target] of aliases) {
    output = output.replaceAll(`(${name}.`, `(${target}.`);
    output = output.replaceAll(`(${name})`, `(${target})`);
  }
  return output;
}

function calibrateStandaloneArrayFitOverlay(statement) {
  const fit = String(statement || "").match(/\bfit\s*=\s*((?:\([^)]*\)\s*)+)/);
  if (!fit) return statement;
  const refs = [...fit[1].matchAll(/\(([^.()\s]+)(?:\.[^)]+)?\)/g)].map((match) => match[1]);
  if (refs.length < 2) return statement;
  const option = refs[0] === refs.at(-1)
    ? "minimum height=0.56cm"
    : "inner xsep=3pt,inner ysep=0.22pt";
  return statement.replace(/\](\s*\{)/, `,${option}]$1`);
}

function splitAtTopLevel(source, mode) {
  const parts = [];
  let current = "";
  let braces = 0;
  let brackets = 0;
  let parentheses = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") braces += 1;
    else if (char === "}") braces = Math.max(0, braces - 1);
    else if (char === "[") brackets += 1;
    else if (char === "]") brackets = Math.max(0, brackets - 1);
    else if (char === "(") parentheses += 1;
    else if (char === ")") parentheses = Math.max(0, parentheses - 1);

    const topLevel = braces === 0 && brackets === 0 && parentheses === 0;
    if (mode === "row" && topLevel && char === "\\" && source[index + 1] === "\\") {
      parts.push(current.trim());
      current = "";
      index += 1;
      continue;
    }
    if (mode === "cell" && topLevel && char === "&") {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current.trim());
  return parts;
}

function stripOuterMath(value) {
  const text = String(value || "").trim();
  if (text.length >= 2 && text.startsWith("$") && text.endsWith("$")) return text.slice(1, -1).trim();
  return text;
}

function delimiterOption(delimiter, side) {
  if (delimiter === "(") return "left parenthesis";
  if (delimiter === ")") return "right parenthesis";
  return delimiter;
}

function readBalanced(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === open) depth += 1;
    if (source[index] === close) depth -= 1;
    if (depth === 0) return { content: source.slice(start + 1, index), end: index + 1 };
  }
  return null;
}

function skipWhitespace(source, start) {
  let cursor = start;
  while (/\s/.test(source[cursor] || "")) cursor += 1;
  return cursor;
}
