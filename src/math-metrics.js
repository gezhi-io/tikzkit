import { mathFallbackText } from "./tex-text.js";

const SCRIPT_CHAR_PATTERN =
  /[₀₁₂₃₄₅₆₇₈₉ₐᵦₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ₊₋₌₍₎⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻ]/u;

export function parseMathText(value) {
  const text = String(value).trim();
  const displayDollar = text.match(/^\$\$([\s\S]+)\$\$$/);
  if (displayDollar) return { tex: displayDollar[1].trim(), displayMode: true };
  const inlineDollar = text.match(/^\$([^$]+)\$$/);
  if (inlineDollar) return { tex: inlineDollar[1].trim(), displayMode: false };
  const displayBracket = text.match(/^\\\[([\s\S]+)\\\]$/);
  if (displayBracket) return { tex: displayBracket[1].trim(), displayMode: true };
  const inlineParen = text.match(/^\\\(([\s\S]+)\\\)$/);
  if (inlineParen) return { tex: inlineParen[1].trim(), displayMode: false };
  return null;
}

export function estimateFormulaBox(tex, options = {}) {
  const displayMode = Boolean(options.displayMode);
  const scale = Number(options.scale) > 0 ? Number(options.scale) : 1;
  const minWidth = Number.isFinite(options.minWidth) ? options.minWidth : displayMode ? 0.72 : 0.42;
  const metric = {
    widthFactor: Number.isFinite(options.widthFactor) ? options.widthFactor : 0.16,
    widthPadding: Number.isFinite(options.widthPadding) ? options.widthPadding : 0.35 * scale
  };
  const compact = estimateFormulaParts(String(tex || "").trim(), scale, metric);
  const displayScale = displayMode ? 1.12 : 1;
  return {
    width: round(Math.max(minWidth, compact.width * displayScale)),
    height: round(compact.height * displayScale),
    depth: round(compact.depth * displayScale)
  };
}

export function formulaTotalHeight(box) {
  return (box?.height || 0) + (box?.depth || 0);
}

export function mathTextMetricUnits(line) {
  const chars = [...String(line || "").trim()];
  let units = 0;
  let superscript = false;
  for (const char of chars) {
    if (char === "\u20d7" || char === "\u0302" || char === "\u0304") continue;
    if (char === "^") {
      superscript = true;
      units += 0.1;
      continue;
    }
    if (SCRIPT_CHAR_PATTERN.test(char)) {
      units += 0.45;
      continue;
    }
    if (superscript) {
      if (/\s/.test(char)) {
        superscript = false;
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

function estimateFormulaParts(tex, scale, metric) {
  // Claude: 原版完全没有 \begin{matrix} 的尺寸感知 —— 矩阵的宽度按「所有单元格摊平成一行」
  // 来算（巨宽），高度只按一行算（巨扁），结果 display 矩阵的 SVG 盒子被估成又宽又扁，
  // 矩阵被压成一条细线。这里先做矩阵感知估算（按行列、支持嵌套），估到了就用它。
  const matrixBox = estimateMatrixParts(tex, scale, metric);
  if (matrixBox) return matrixBox;

  let width = fallbackWidth(tex, scale, metric);
  let height = 0.26 * scale;
  let depth = 0.09 * scale;

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
    if (hasSubscript(tex)) depth = Math.max(depth, 0.14 * scale);
  }

  if (/\\(?:int|oint)(?![A-Za-z])/.test(tex)) {
    height = Math.max(height, 0.43 * scale);
    depth = Math.max(depth, hasSubscript(tex) ? 0.24 * scale : 0.16 * scale);
  }

  return { width, height, depth };
}

function fallbackWidth(tex, scale, metric) {
  return mathTextMetricUnits(mathFallbackText(tex)) * metric.widthFactor * scale + metric.widthPadding;
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

function round(value) {
  return Math.round(value * 10000) / 10000;
}
