const MATH_MATRIX_ENV_NAMES = new Set(["matrix", "pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix", "cases", "array"]);

export function parseInlineMathMatrix(tex) {
  const source = String(tex || "");
  for (let index = 0; index < source.length; index += 1) {
    const begin = matchMathMatrixEnvironmentToken(source, index, "begin");
    if (!begin) continue;
    const end = findMathMatrixEnvironmentEnd(source, index);
    if (!end) return null;
    const environmentBody = source.slice(begin.end, end.start);
    const array = begin.env === "array" ? readMathArrayBody(environmentBody) : { body: environmentBody, columnSpec: "" };
    const rows = splitMathMatrixTopLevel(array.body, "row")
      .map((row) => splitMathMatrixTopLevel(row, "col"))
      .filter((row) => row.some((cell) => String(cell || "").trim()));
    if (!rows.length) return null;
    const colCount = Math.max(...rows.map((row) => row.length));
    const columnLayout = begin.env === "array"
      ? parseMathArrayColumnSpec(array.columnSpec, colCount)
      : defaultMathMatrixColumnLayout(colCount);
    const delimiters = readMathMatrixDelimiters(begin.env, source.slice(0, index), source.slice(end.end));
    return {
      env: begin.env,
      prefix: delimiters.prefix,
      rows,
      suffix: delimiters.suffix,
      columnAlignments: columnLayout.alignments,
      interColumnGaps: columnLayout.interColumnGaps,
      delimiters: delimiters.sides
    };
  }
  return null;
}

export function matrixDelimiterSides(env) {
  switch (env) {
    case "pmatrix":
      return { left: "paren", right: "paren" };
    case "bmatrix":
      return { left: "bracket", right: "bracket" };
    case "Bmatrix":
      return { left: "curly", right: "curly" };
    case "vmatrix":
      return { left: "bar", right: "bar" };
    case "Vmatrix":
      return { left: "doublebar", right: "doublebar" };
    case "cases":
      return { left: "curly", right: null };
    default:
      return { left: null, right: null };
  }
}

export function matchMathMatrixEnvironmentToken(text, index, kind) {
  if (!text.startsWith(`\\${kind}`, index)) return null;
  const match = text.slice(index).match(new RegExp(`^\\\\${kind}\\s*\\{([A-Za-z*]+)\\}`));
  if (!match) return null;
  const env = match[1].replace(/\*$/, "");
  if (!MATH_MATRIX_ENV_NAMES.has(env)) return null;
  return { env, end: index + match[0].length };
}

export function findMathMatrixEnvironmentEnd(text, start) {
  let depth = 0;
  let cursor = start;
  while (cursor < text.length) {
    const begin = matchMathMatrixEnvironmentToken(text, cursor, "begin");
    if (begin) {
      depth += 1;
      cursor = begin.end;
      continue;
    }
    const end = matchMathMatrixEnvironmentToken(text, cursor, "end");
    if (end) {
      depth -= 1;
      if (depth === 0) return { start: cursor, end: end.end };
      cursor = end.end;
      continue;
    }
    cursor += 1;
  }
  return null;
}

export function splitMathMatrixTopLevel(body, mode) {
  const parts = [];
  let current = "";
  let environmentDepth = 0;
  let braceDepth = 0;
  let index = 0;
  while (index < body.length) {
    const begin = matchMathMatrixEnvironmentToken(body, index, "begin");
    if (begin) {
      environmentDepth += 1;
      current += body.slice(index, begin.end);
      index = begin.end;
      continue;
    }
    const end = matchMathMatrixEnvironmentToken(body, index, "end");
    if (end) {
      environmentDepth = Math.max(0, environmentDepth - 1);
      current += body.slice(index, end.end);
      index = end.end;
      continue;
    }
    const char = body[index];
    if (char === "{") braceDepth += 1;
    if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
    if (environmentDepth === 0 && braceDepth === 0) {
      if (mode === "row" && body.startsWith(String.raw`\\`, index)) {
        parts.push(current);
        current = "";
        index += 2;
        continue;
      }
      if (mode === "col" && char === "&") {
        parts.push(current);
        current = "";
        index += 1;
        continue;
      }
    }
    current += char;
    index += 1;
  }
  parts.push(current);
  return parts;
}

function readMathArrayBody(body) {
  const source = String(body || "").trimStart();
  const columnSpec = readBalancedMathGroup(source, 0);
  return columnSpec
    ? { body: source.slice(columnSpec.end), columnSpec: columnSpec.content }
    : { body: source, columnSpec: "" };
}

function defaultMathMatrixColumnLayout(colCount) {
  return {
    alignments: Array.from({ length: colCount }, () => "center"),
    interColumnGaps: Array.from({ length: Math.max(0, colCount - 1) }, () => null)
  };
}

function parseMathArrayColumnSpec(spec, colCount) {
  const tokens = readMathArrayColumnTokens(spec);
  const alignments = [];
  const interColumnGaps = [];
  let pendingGap = null;
  for (const token of tokens) {
    if (token.type === "gap") {
      pendingGap = token.zero ? 0 : null;
      continue;
    }
    if (alignments.length) interColumnGaps.push(pendingGap);
    alignments.push(token.alignment);
    pendingGap = null;
  }
  if (!alignments.length) return defaultMathMatrixColumnLayout(colCount);
  while (alignments.length < colCount) {
    interColumnGaps.push(null);
    alignments.push("left");
  }
  return {
    alignments: alignments.slice(0, colCount),
    interColumnGaps: interColumnGaps.slice(0, Math.max(0, colCount - 1))
  };
}

function readMathArrayColumnTokens(spec, depth = 0) {
  if (depth > 4) return [];
  const source = String(spec || "");
  const tokens = [];
  let cursor = 0;
  while (cursor < source.length) {
    const char = source[cursor];
    if (/\s/.test(char) || char === "|") {
      cursor += 1;
      continue;
    }
    if (char === "@") {
      const group = readBalancedMathGroup(source, cursor + 1);
      if (group) {
        tokens.push({ type: "gap", zero: group.content.trim() === "" });
        cursor = group.end;
        continue;
      }
    }
    if (char === "*") {
      const countMatch = source.slice(cursor + 1).match(/^\s*(\d+)/);
      const groupStart = countMatch ? cursor + 1 + countMatch[0].length : cursor + 1;
      const group = readBalancedMathGroup(source, groupStart);
      if (countMatch && group) {
        const count = Math.min(32, Number(countMatch[1]) || 0);
        const repeated = readMathArrayColumnTokens(group.content, depth + 1);
        for (let index = 0; index < count; index += 1) tokens.push(...repeated);
        cursor = group.end;
        continue;
      }
    }
    if (char === "l" || char === "c" || char === "r") {
      tokens.push({ type: "column", alignment: char === "l" ? "left" : char === "r" ? "right" : "center" });
      cursor += 1;
      continue;
    }
    if (char === "p" || char === "m" || char === "b") {
      const group = readBalancedMathGroup(source, cursor + 1);
      tokens.push({ type: "column", alignment: "left" });
      cursor = group ? group.end : cursor + 1;
      continue;
    }
    if (char === ">" || char === "<") {
      const group = readBalancedMathGroup(source, cursor + 1);
      cursor = group ? group.end : cursor + 1;
      continue;
    }
    cursor += 1;
  }
  return tokens;
}

function readMathMatrixDelimiters(env, prefix, suffix) {
  if (env !== "array") return { prefix, suffix, sides: matrixDelimiterSides(env) };
  const left = readMathArrayDelimiter(prefix, "left");
  const right = readMathArrayDelimiter(suffix, "right");
  return {
    prefix: left?.remaining ?? prefix,
    suffix: right?.remaining ?? suffix,
    sides: { left: left?.kind || null, right: right?.kind || null }
  };
}

function readMathArrayDelimiter(source, side) {
  const delimiterToken = String.raw`\\(?:lbrace|rbrace|lvert|rvert|lVert|rVert)|\\[{}\[\]|]|[()\[\]{}|.]`;
  const expression = side === "left"
    ? new RegExp(String.raw`\\left\s*(${delimiterToken})\s*$`)
    : new RegExp(String.raw`^\s*\\right\s*(${delimiterToken})`);
  const match = String(source || "").match(expression);
  if (!match) return null;
  const kind = mathDelimiterKind(match[1]);
  if (!kind && match[1] !== ".") return null;
  return side === "left"
    ? { kind, remaining: source.slice(0, match.index).trimEnd() }
    : { kind, remaining: source.slice(match[0].length).trimStart() };
}

function mathDelimiterKind(token) {
  if (/^(?:\\lbrace|\\rbrace|\\\{|\\\})$/.test(token)) return "curly";
  if (token === "(") return "paren";
  if (token === "[") return "bracket";
  if (/^(?:\\lvert|\\rvert|\\\||\|)$/.test(token)) return "bar";
  if (/^(?:\\lVert|\\rVert)$/.test(token)) return "doublebar";
  return null;
}

function readBalancedMathGroup(text, start) {
  if (text[start] !== "{") return null;
  let depth = 0;
  for (let cursor = start; cursor < text.length; cursor += 1) {
    if (text[cursor] === "\\") {
      cursor += 1;
      continue;
    }
    if (text[cursor] === "{") depth += 1;
    if (text[cursor] === "}") {
      depth -= 1;
      if (depth === 0) return { content: text.slice(start + 1, cursor), end: cursor + 1 };
    }
  }
  return null;
}
