import { mathFallbackText, readDollarMathSpan, stripTikzHspaceMarkers } from "./tex-text.js";

const TEX_PT_PER_CM = 28.45274;

const CMR10_WIDTH_PT = {
  " ": 3.333,
  "!": 2.778,
  "\"": 5,
  "#": 8.333,
  "$": 5,
  "%": 8.333,
  "&": 7.778,
  "'": 2.778,
  "(": 3.889,
  ")": 3.889,
  "*": 5,
  "+": 7.778,
  ",": 2.778,
  "-": 3.333,
  ".": 2.778,
  "/": 5,
  "0": 5,
  "1": 5,
  "2": 5,
  "3": 5,
  "4": 5,
  "5": 5,
  "6": 5,
  "7": 5,
  "8": 5,
  "9": 5,
  ":": 2.778,
  ";": 2.778,
  "<": 7.778,
  "=": 7.778,
  ">": 7.778,
  "?": 4.722,
  "@": 7.778,
  A: 7.5,
  B: 7.083,
  C: 7.222,
  D: 7.639,
  E: 6.806,
  F: 6.528,
  G: 7.847,
  H: 7.5,
  I: 3.611,
  J: 5.139,
  K: 7.778,
  L: 6.25,
  M: 9.167,
  N: 7.5,
  O: 7.778,
  P: 6.806,
  Q: 7.778,
  R: 7.361,
  S: 5.556,
  T: 7.222,
  U: 7.5,
  V: 7.5,
  W: 10.278,
  X: 7.5,
  Y: 7.5,
  Z: 6.111,
  "[": 2.778,
  "\\": 5,
  "]": 2.778,
  "^": 5,
  "_": 5,
  "`": 2.778,
  a: 5,
  b: 5.556,
  c: 4.444,
  d: 5.556,
  e: 4.444,
  f: 3.056,
  g: 5,
  h: 5.556,
  i: 2.778,
  j: 3.056,
  k: 5.278,
  l: 2.778,
  m: 8.333,
  n: 5.556,
  o: 5,
  p: 5.556,
  q: 5.278,
  r: 3.922,
  s: 3.944,
  t: 3.889,
  u: 5.556,
  v: 5.278,
  w: 7.222,
  x: 5.278,
  y: 5.278,
  z: 4.444,
  "{": 5,
  "|": 2.778,
  "}": 5,
  "~": 5
};

const SCRIPT_CHAR_PATTERN =
  /[₀₁₂₃₄₅₆₇₈₉ₐᵦₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ₊₋₌₍₎⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻ]/u;
const WIDE_MATH_ALPHA_CHARS = new Set([...("𝒜ℬ𝒞𝒟ℰℱ𝒢ℋℐ𝒥𝒦ℒℳ𝒩𝒪𝒫𝒬ℛ𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵")]);
const ZERO_WIDTH_MATH_ACCENTS = new Set(["\u20d7", "\u0302", "\u0303", "\u0304"]);
const TALL_MATH_ACCENT_BASES = new Set(["b", "d", "f", "h", "k", "l", "t"]);
const MATH_FONT_SIZE_SCALES = new Map([
  ["tiny", 0.5],
  ["scriptsize", 0.7],
  ["footnotesize", 0.8],
  ["small", 0.9],
  ["normalsize", 1],
  ["large", 1.2],
  ["Large", 1.44],
  ["LARGE", 1.728],
  ["huge", 2.074],
  ["Huge", 2.488]
]);

export function parseMathText(value) {
  const text = String(value).trim();
  const dollar = readDollarMathSpan(text, 0);
  if (dollar && dollar.end === text.length) return parsedMathText(dollar.tex, dollar.displayMode);
  const displayBracket = text.match(/^\\\[([\s\S]+)\\\]$/);
  if (displayBracket) return parsedMathText(displayBracket[1], true);
  const inlineParen = text.match(/^\\\(([\s\S]+)\\\)$/);
  if (inlineParen) return parsedMathText(inlineParen[1], false);
  return null;
}

export function estimateFormulaBox(tex, options = {}) {
  const displayMode = Boolean(options.displayMode);
  const normalized = leadingMathFontSize(tex);
  const optionScale = Number(options.scale) > 0 ? Number(options.scale) : 1;
  const scale = optionScale * normalized.scale;
  const baseMinWidth = Number.isFinite(options.minWidth) ? options.minWidth : displayMode ? 0.72 : 0.42;
  const minWidth = baseMinWidth * scale;
  const metric = {
    widthFactor: Number.isFinite(options.widthFactor) ? options.widthFactor : 0.16,
    widthPadding: Number.isFinite(options.widthPadding) ? options.widthPadding : 0.35 * scale,
    texTextMetrics: Boolean(options.texTextMetrics)
  };
  const compact = estimateFormulaParts(normalized.tex, scale, metric);
  const displayScale = displayMode ? 1.12 : 1;
  return {
    width: round(Math.max(minWidth, compact.width * displayScale)),
    height: round(compact.height * displayScale),
    depth: round(compact.depth * displayScale)
  };
}

function parsedMathText(tex, displayMode) {
  const normalized = leadingMathFontSize(tex);
  return {
    tex: normalized.tex,
    displayMode,
    scale: normalized.scale,
    explicitFontSize: normalized.explicitFontSize
  };
}

function leadingMathFontSize(tex) {
  let text = String(tex || "").trim();
  let scale = 1;
  let explicitFontSize = null;

  const group = text.startsWith("{") ? readBalanced(text, 0, "{", "}") : null;
  if (group && group.end === text.length) {
    const inner = leadingMathFontSize(group.content);
    if (inner.scale !== 1 || inner.explicitFontSize) return inner;
  }

  let changed = true;
  while (changed) {
    changed = false;
    const match = text.match(/^\\(Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)(?![A-Za-z])\s*/);
    if (match) {
      const nextScale = MATH_FONT_SIZE_SCALES.get(match[1]) || 1;
      scale *= nextScale;
      explicitFontSize = match[1];
      text = text.slice(match[0].length).trim();
      changed = true;
    }
  }

  return { tex: text, scale, explicitFontSize };
}

export function formulaTotalHeight(box) {
  return (box?.height || 0) + (box?.depth || 0);
}

export function mathTextMetricUnits(line) {
  const chars = [...String(line || "").trim()];
  let units = 0;
  let scriptMode = null;
  for (const char of chars) {
    if (ZERO_WIDTH_MATH_ACCENTS.has(char)) continue;
    if (char === "^") {
      scriptMode = "super";
      units += 0.1;
      continue;
    }
    if (char === "_") {
      scriptMode = "sub";
      units += 0.1;
      continue;
    }
    if (SCRIPT_CHAR_PATTERN.test(char)) {
      units += 0.45;
      continue;
    }
    if (WIDE_MATH_ALPHA_CHARS.has(char)) {
      units += 2.05;
      continue;
    }
    if (scriptMode) {
      if (/\s/.test(char)) {
        scriptMode = null;
        units += 0.25;
      } else {
        units += 0.45;
      }
      continue;
    }
    if (char === "→" || char === "←" || char === "⇒" || char === "⇐") {
      units += 0.9;
      continue;
    }
    units += /\s/.test(char) ? 0.35 : 1;
  }
  return units;
}

export function texTextWidthCm(line, scale = 1) {
  const factor = Number.isFinite(scale) && scale > 0 ? scale : 1;
  let widthPt = 0;
  const chars = [...stripTikzHspaceMarkers(line)];
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    if (ZERO_WIDTH_MATH_ACCENTS.has(char)) continue;
    if (char === "_") {
      let consumed = 0;
      for (let cursor = index + 1; cursor < chars.length && /[A-Za-z0-9+\-=()]/.test(chars[cursor]); cursor += 1) {
        widthPt += 3.2;
        consumed += 1;
      }
      if (consumed > 0) {
        index += consumed;
        continue;
      }
    }
    widthPt += CMR10_WIDTH_PT[char] ?? (SCRIPT_CHAR_PATTERN.test(char) ? 3.2 : WIDE_MATH_ALPHA_CHARS.has(char) ? 8.2 : 5);
  }
  return (widthPt / TEX_PT_PER_CM) * factor;
}

function estimateFormulaParts(tex, scale, metric) {
  const tensorMatrixBox = estimateTensorMatrixParts(tex, scale);
  if (tensorMatrixBox) return tensorMatrixBox;

  // Claude: 原版完全没有 \begin{matrix} 的尺寸感知 —— 矩阵的宽度按「所有单元格摊平成一行」
  // 来算（巨宽），高度只按一行算（巨扁），结果 display 矩阵的 SVG 盒子被估成又宽又扁，
  // 矩阵被压成一条细线。这里先做矩阵感知估算（按行列、支持嵌套），估到了就用它。
  const matrixBox = estimateMatrixParts(tex, scale, metric);
  if (matrixBox) return matrixBox;

  let width = fallbackWidth(tex, scale, metric);
  let height = 0.25 * scale;
  let depth = 0.04 * scale;

  for (const fraction of readCommandPairs(tex, ["frac", "dfrac", "tfrac"])) {
    const numerator = estimateFormulaParts(fraction.first, scale * 0.9, metric);
    const denominator = estimateFormulaParts(fraction.second, scale * 0.9, metric);
    width = Math.max(width, Math.max(numerator.width, denominator.width) + 0.28 * scale);
    height = Math.max(height, numerator.height + numerator.depth + 0.18 * scale);
    depth = Math.max(depth, denominator.height + denominator.depth + 0.14 * scale);
  }

  for (const radical of readCommandGroups(tex, ["sqrt"])) {
    const body = estimateFormulaParts(radical, scale, metric);
    width = Math.max(width, body.width + 0.28 * scale);
    height = Math.max(height, body.height + 0.16 * scale);
    depth = Math.max(depth, body.depth);
  }

  if (/\\(?:sum|prod|bigcup|bigcap)(?![A-Za-z])/.test(tex)) {
    width = Math.max(width, fallbackWidth(tex, scale, metric) + 0.08 * scale);
    if (hasSubscript(tex)) depth = Math.max(depth, 0.26 * scale);
    if (hasSuperscript(tex)) height = Math.max(height, 0.43 * scale);
    if (hasSubscript(tex) && hasSuperscript(tex)) {
      height = Math.max(height, 0.46 * scale);
      depth = Math.max(depth, 0.28 * scale);
    }
  } else if (/[^^]\\?[_^]|^\\?[_^]/.test(tex)) {
    if (hasSuperscript(tex)) height = Math.max(height, 0.34 * scale);
    if (hasSubscript(tex)) depth = Math.max(depth, 0.085 * scale);
  }

  const vectorSubscript = tex.match(/\\vec\s*\{\s*([A-Za-z])[\s\S]*?\}\s*_/);
  const wideTildeVectorSubscript = tex.match(/\\vec\s*\{\s*\\(?:wide)?tilde\s*\{\s*([A-Za-z])[\s\S]*?\}\s*\}\s*_/);
  const tallVectorBase = vectorSubscript?.[1] || wideTildeVectorSubscript?.[1];
  if (tallVectorBase && TALL_MATH_ACCENT_BASES.has(tallVectorBase)) {
    width = Math.max(width, fallbackWidth(tex, scale, metric) + 0.05 * scale);
    height = Math.max(height, 0.32 * scale);
    depth = Math.max(depth, 0.08 * scale);
  }

  if (/\\(?:wide)?tilde(?![A-Za-z])/.test(tex)) {
    width = Math.max(width, fallbackWidth(tex, scale, metric) + 0.2 * scale);
  }

  if (/\\(?:int|oint)(?![A-Za-z])/.test(tex)) {
    height = Math.max(height, 0.43 * scale);
    depth = Math.max(depth, hasSubscript(tex) ? 0.24 * scale : 0.16 * scale);
  }

  return { width, height, depth };
}

function estimateTensorMatrixParts(tex, scale) {
  const text = String(tex || "");
  if (!/\\(?:overmat|undermat)\b/.test(text) || !/\\begin\{matrix\}/.test(text)) return null;
  const blocks = readTensorMatrixMetricBlocks(text);
  if (blocks.length < 2) return null;

  // Keep this in sync with renderer-svg.js renderTensorMatrixFallback: the
  // anchor box must describe the same compact 2x2 tensor fallback we draw.
  const font = 0.34 * scale;
  const cell = font * 0.82;
  const rowCell = font * 0.94;
  const labelHeight = font * 0.8;
  const matrixWidth = cell * 3.25;
  const matrixHeight = rowCell * 3.05;
  const bracketPad = font * 0.32;
  const blockWidth = matrixWidth + bracketPad * 2 + font * 0.2;
  const blockHeight = matrixHeight + labelHeight + font * 0.42;
  const gapX = font;
  const gapY = font * 0.1;
  const prefixWidth = font * 2.1;
  const gridWidth = blockWidth * 2 + gapX;
  const gridHeight = blockHeight * 2 + gapY;
  return {
    width: prefixWidth + gridWidth + font * 0.8,
    height: gridHeight / 2,
    depth: gridHeight / 2
  };
}

function readTensorMatrixMetricBlocks(text) {
  const blocks = [];
  const pattern = /\\(overmat|undermat)\b/g;
  let match;
  while ((match = pattern.exec(text))) {
    let cursor = match.index + match[1].length + 1;
    const label = readBalanced(text, skipWhitespace(text, cursor), "{", "}");
    if (!label) continue;
    cursor = label.end;
    const matrix = readBalanced(text, skipWhitespace(text, cursor), "{", "}");
    if (!matrix) continue;
    cursor = matrix.end;
    const color = readBalanced(text, skipWhitespace(text, cursor), "{", "}");
    if (!color) continue;
    blocks.push({ label, matrix, color });
    pattern.lastIndex = color.end;
  }
  return blocks;
}

function fallbackWidth(tex, scale, metric) {
  const fallback = mathFallbackText(tex);
  const bodyWidth = metric.texTextMetrics
    ? texTextWidthCm(fallback, scale)
    : mathTextMetricUnits(fallback) * metric.widthFactor * scale;
  return bodyWidth + metric.widthPadding;
}

const MATRIX_ENV_NAMES = ["matrix", "pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix", "array", "cases"];

// Claude: 估算最外层 matrix/array 环境的盒子。按「矩阵嵌套深度」感知地把内容切成行(\\)和列(&)，
// 对每个单元格递归调用 estimateFormulaParts（从而正确处理单元格里再嵌套的矩阵/上下花括号标签），
// 然后行高累加、列宽取各行最大，得到接近真实渲染的尺寸。没有矩阵就返回 null，走原有逻辑。
function estimateMatrixParts(tex, scale, metric) {
  const outer = extractOutermostMatrix(tex);
  if (!outer) return null;
  const rows = splitMatrixTopLevel(outer.body, "row").map((row) => row.trim()).filter((row) => row.length);
  if (!rows.length) return null;

  const rowGap = 0.35 * scale;
  const colGap = 0.6 * scale;
  let totalHeight = 0;
  let maxRowWidth = 0;
  for (const row of rows) {
    const cells = splitMatrixTopLevel(row, "col");
    let rowHeight = 0.5 * scale;
    let rowWidth = 0;
    for (const cell of cells) {
      const part = estimateFormulaParts(cell, scale, metric);
      rowHeight = Math.max(rowHeight, part.height + part.depth);
      rowWidth += part.width;
    }
    rowWidth += colGap * Math.max(0, cells.length - 1);
    totalHeight += rowHeight + rowGap;
    maxRowWidth = Math.max(maxRowWidth, rowWidth);
  }
  totalHeight = Math.max(totalHeight, 0.6 * scale);
  // 外层定界符(\left[ \right] 等)的左右留白
  const width = maxRowWidth + 0.6 * scale;
  return { width, height: totalHeight / 2 + 0.05 * scale, depth: totalHeight / 2 };
}

function extractOutermostMatrix(tex) {
  const text = String(tex);
  for (let index = 0; index < text.length; index += 1) {
    const begin = matchEnvToken(text, index, "begin");
    if (!begin || !MATRIX_ENV_NAMES.includes(begin.env)) continue;
    let depth = 0;
    let cursor = index;
    while (cursor < text.length) {
      const open = matchEnvToken(text, cursor, "begin");
      const close = matchEnvToken(text, cursor, "end");
      if (open && MATRIX_ENV_NAMES.includes(open.env)) {
        depth += 1;
        cursor = open.end;
        continue;
      }
      if (close && MATRIX_ENV_NAMES.includes(close.env)) {
        depth -= 1;
        if (depth === 0) return { body: text.slice(begin.end, cursor), env: begin.env };
        cursor = close.end;
        continue;
      }
      cursor += 1;
    }
    return null;
  }
  return null;
}

function matchEnvToken(text, index, kind) {
  if (text[index] !== "\\") return null;
  const match = text.slice(index).match(new RegExp(`^\\\\${kind}\\{([a-zA-Z*]+)\\}`));
  if (!match) return null;
  return { env: match[1].replace(/\*$/, ""), end: index + match[0].length };
}

// 按矩阵嵌套深度(matrix begin/end)与花括号深度都为 0 时, 才在 \\(行)或 &(列)处切分。
function splitMatrixTopLevel(body, mode) {
  const parts = [];
  let current = "";
  let envDepth = 0;
  let brace = 0;
  let index = 0;
  while (index < body.length) {
    const begin = matchEnvToken(body, index, "begin");
    const end = matchEnvToken(body, index, "end");
    if (begin && MATRIX_ENV_NAMES.includes(begin.env)) {
      envDepth += 1;
      current += body.slice(index, begin.end);
      index = begin.end;
      continue;
    }
    if (end && MATRIX_ENV_NAMES.includes(end.env)) {
      envDepth -= 1;
      current += body.slice(index, end.end);
      index = end.end;
      continue;
    }
    const char = body[index];
    if (char === "{") brace += 1;
    else if (char === "}") brace -= 1;
    if (envDepth === 0 && brace === 0) {
      if (mode === "row" && char === "\\" && body[index + 1] === "\\") {
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

function hasSubscript(tex) {
  return /_\s*(?:\{|[A-Za-z0-9\\])/.test(tex);
}

function hasSuperscript(tex) {
  return /\^\s*(?:\{|[A-Za-z0-9\\])/.test(tex);
}

function readCommandGroups(tex, names) {
  const groups = [];
  for (const name of names) {
    let cursor = 0;
    const needle = `\\${name}`;
    while ((cursor = tex.indexOf(needle, cursor)) !== -1) {
      let groupStart = cursor + needle.length;
      while (/\s/.test(tex[groupStart] || "")) groupStart += 1;
      if (tex[groupStart] === "[") {
        const optional = readBalanced(tex, groupStart, "[", "]");
        if (optional) groupStart = optional.end;
        while (/\s/.test(tex[groupStart] || "")) groupStart += 1;
      }
      const group = readBalanced(tex, groupStart, "{", "}");
      if (group) {
        groups.push(group.content);
        cursor = group.end;
      } else {
        cursor += needle.length;
      }
    }
  }
  return groups;
}

function readCommandPairs(tex, names) {
  const pairs = [];
  for (const name of names) {
    let cursor = 0;
    const needle = `\\${name}`;
    while ((cursor = tex.indexOf(needle, cursor)) !== -1) {
      let firstStart = cursor + needle.length;
      while (/\s/.test(tex[firstStart] || "")) firstStart += 1;
      const first = readBalanced(tex, firstStart, "{", "}");
      if (!first) {
        cursor += needle.length;
        continue;
      }
      let secondStart = first.end;
      while (/\s/.test(tex[secondStart] || "")) secondStart += 1;
      const second = readBalanced(tex, secondStart, "{", "}");
      if (second) {
        pairs.push({ first: first.content, second: second.content });
        cursor = second.end;
      } else {
        cursor = first.end;
      }
    }
  }
  return pairs;
}

function readBalanced(text, start, open, close) {
  if (text[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return { content: text.slice(start + 1, index), end: index + 1 };
      }
    }
  }
  return null;
}

function skipWhitespace(text, start) {
  let cursor = start;
  while (/\s/.test(text[cursor] || "")) cursor += 1;
  return cursor;
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}
