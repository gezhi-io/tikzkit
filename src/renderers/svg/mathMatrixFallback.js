import { mathFallbackText } from "../../tikz/text.js";
import { texTextWidthCm } from "../../tikz/textMetrics.js";
import { TIKZ_FONT_FAMILY } from "../../tikz/metrics.js";
import { escapeAttribute, escapeText } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";

const SVG_MATRIX_ENV_NAMES = ["matrix", "pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix", "cases"];

export function inlineMatrixMathFallback(tex) {
  const raw = String(tex || "");
  const beginIndex = raw.indexOf(String.raw`\begin`);
  if (beginIndex === -1) return null;
  const begin = matchSvgMatrixEnvToken(raw, beginIndex, "begin");
  if (!begin) return null;
  const end = findSvgMatrixEnvironmentEnd(raw, beginIndex);
  if (!end) return null;
  const rows = splitSvgMatrixTopLevel(raw.slice(begin.end, end.start), "row")
    .map((row) =>
      splitSvgMatrixTopLevel(row, "col")
        .map((cell) => mathFallbackText(cell).trim())
        .filter(Boolean)
    )
    .filter((row) => row.length);
  if (!rows.length) return null;
  return {
    env: begin.env,
    prefix: raw.slice(0, beginIndex),
    rows,
    suffix: raw.slice(end.end)
  };
}

export function renderInlineMatrixMathFallback(item, parts, baseFontSize, unit, color, fontStyle, fontWeight) {
  const y = -item.y * unit;
  const fontSize = baseFontSize;
  const inlineFontSize = fontSize;
  const cellFontSize = fontSize;
  const prefix = mathFallbackText(parts.prefix).trim();
  const suffix = mathFallbackText(parts.suffix).trim();
  const fontScale = (inlineFontSize * 28.45274) / (unit * 10);
  const prefixWidth = prefix ? texTextWidthCm(prefix, fontScale) * unit : 0;
  const suffixWidth = suffix ? texTextWidthCm(suffix, fontScale) * unit : 0;
  const colCount = Math.max(...parts.rows.map((row) => row.length));
  const colGap = cellFontSize;
  const rowGap = cellFontSize * 0.1;
  const rowHeight = cellFontSize * 1.16;
  const colWidths = Array.from({ length: colCount }, (_value, colIndex) =>
    Math.max(
      cellFontSize * 0.44,
      ...parts.rows.map((row) => inlineMatrixCellWidth(row[colIndex] || "", fontScale, unit))
    )
  );
  const contentWidth = colWidths.reduce((sum, value) => sum + value, 0) + colGap * Math.max(0, colCount - 1);
  const matrixHeight = rowHeight * parts.rows.length + rowGap * Math.max(0, parts.rows.length - 1);
  const delimiterWidth = parts.env === "matrix" ? 0 : cellFontSize * 0.72;
  const delimiterPad = parts.env === "matrix" ? 0 : cellFontSize * 0.1;
  const arrayColumnAllowance = (1 / 28.45274) * unit;
  const matrixWidth = contentWidth + delimiterWidth * 2 + delimiterPad * 2 + arrayColumnAllowance;
  const gap = (2 / 28.45274) * unit;
  const totalWidth = prefixWidth + (prefix ? gap : 0) + matrixWidth + (suffix ? gap + suffixWidth : 0);
  const anchor = item.svgTextAnchor || "middle";
  const anchorX = (Number.isFinite(Number(item.svgTextX)) ? Number(item.svgTextX) : Number(item.x) || 0) * unit;
  let cursor = anchor === "start" ? anchorX : anchor === "end" ? anchorX - totalWidth : anchorX - totalWidth / 2;
  const textAttrs = `fill="${color}" dominant-baseline="middle"${fontStyle ? ` font-style="${fontStyle}"` : ""}${
    fontWeight ? ` font-weight="${fontWeight}"` : ""
  } font-family="${escapeAttribute(TIKZ_FONT_FAMILY)}"`;
  const output = [`<g class="tikz-math-matrix-inline">`];
  if (prefix) {
    output.push(`<text x="${format(cursor)}" y="${format(y)}" ${textAttrs} text-anchor="start" font-size="${format(inlineFontSize)}">${escapeText(prefix)}</text>`);
    cursor += prefixWidth + gap;
  }
  const matrixX = cursor;
  const contentX = matrixX + delimiterWidth + delimiterPad + arrayColumnAllowance / 2;
  if (parts.env !== "matrix") {
    output.push(renderInlineMatrixDelimiters(parts.env, matrixX, y, matrixWidth, matrixHeight, delimiterWidth, cellFontSize, color));
  }
  let cellY = y - matrixHeight / 2 + rowHeight / 2;
  for (const row of parts.rows) {
    let cellX = contentX;
    for (let colIndex = 0; colIndex < colCount; colIndex += 1) {
      const value = row[colIndex] || "";
      const colWidth = colWidths[colIndex];
      if (value) {
        output.push(`<text x="${format(cellX + colWidth / 2)}" y="${format(cellY)}" ${textAttrs} text-anchor="middle" font-size="${format(
          cellFontSize
        )}">${escapeText(value)}</text>`);
      }
      cellX += colWidth + colGap;
    }
    cellY += rowHeight + rowGap;
  }
  cursor += matrixWidth;
  if (suffix) {
    cursor += gap;
    output.push(`<text x="${format(cursor)}" y="${format(y)}" ${textAttrs} text-anchor="start" font-size="${format(inlineFontSize)}">${escapeText(suffix)}</text>`);
  }
  output.push("</g>");
  return output.join("");
}

export function renderInlineMatrixDelimiters(env, x, y, width, height, delimiterWidth, fontSize, color) {
  if (env === "pmatrix") {
    const top = y - height / 2 + fontSize * 0.03;
    const bottom = y + height / 2 - fontSize * 0.03;
    const amplitude = delimiterWidth * 0.34;
    const left = parenthesisDelimiterPath(x + delimiterWidth * 0.58, top, bottom, amplitude, "left");
    const right = parenthesisDelimiterPath(x + width - delimiterWidth * 0.58, top, bottom, amplitude, "right");
    const strokeWidth = Math.max(0.5, fontSize * 0.055);
    return [
      `<path class="tikz-matrix-delimiter tikz-matrix-delimiter-left" d="${left}" stroke="${color}" fill="none" stroke-width="${format(
        strokeWidth
      )}" stroke-linecap="round" stroke-linejoin="round" />`,
      `<path class="tikz-matrix-delimiter tikz-matrix-delimiter-right" d="${right}" stroke="${color}" fill="none" stroke-width="${format(
        strokeWidth
      )}" stroke-linecap="round" stroke-linejoin="round" />`
    ].join("");
  }
  if (env === "vmatrix" || env === "Vmatrix") {
    const offset = env === "Vmatrix" ? delimiterWidth * 0.18 : 0;
    const left = x + delimiterWidth * 0.55;
    const right = x + width - delimiterWidth * 0.55;
    const top = y - height / 2 - fontSize * 0.04;
    const bottom = y + height / 2 + fontSize * 0.04;
    const lines = [`M ${format(left - offset)} ${format(top)} L ${format(left - offset)} ${format(bottom)}`];
    if (env === "Vmatrix") lines.push(`M ${format(left + offset)} ${format(top)} L ${format(left + offset)} ${format(bottom)}`);
    lines.push(`M ${format(right + offset)} ${format(top)} L ${format(right + offset)} ${format(bottom)}`);
    if (env === "Vmatrix") lines.push(`M ${format(right - offset)} ${format(top)} L ${format(right - offset)} ${format(bottom)}`);
    return `<path d="${lines.join(" ")}" stroke="${color}" fill="none" stroke-width="${format(Math.max(0.45, fontSize * 0.055))}" />`;
  }
  const left = x + delimiterWidth * 0.9;
  const right = x + width - delimiterWidth * 0.9;
  const top = y - height / 2 - fontSize * 0.03;
  const bottom = y + height / 2 + fontSize * 0.03;
  const tick = delimiterWidth * 0.52;
  const leftPath = env === "Bmatrix" || env === "cases"
    ? curlyDelimiterPath(left, y, height + fontSize * 0.08, "left", fontSize * 0.22)
    : `M ${format(left + tick)} ${format(top)} L ${format(left)} ${format(top)} L ${format(left)} ${format(bottom)} L ${format(left + tick)} ${format(bottom)}`;
  const rightPath = env === "Bmatrix"
    ? curlyDelimiterPath(right, y, height + fontSize * 0.08, "right", fontSize * 0.22)
    : `M ${format(right - tick)} ${format(top)} L ${format(right)} ${format(top)} L ${format(right)} ${format(bottom)} L ${format(right - tick)} ${format(bottom)}`;
  const path = env === "cases" ? leftPath : `${leftPath} ${rightPath}`;
  return `<path d="${path}" stroke="${color}" fill="none" stroke-width="${format(Math.max(0.45, fontSize * 0.055))}" stroke-linecap="round" stroke-linejoin="round" />`;
}

function parenthesisDelimiterPath(x, top, bottom, amplitude, side) {
  const mid = (top + bottom) / 2;
  const sign = side === "left" ? -1 : 1;
  return [
    `M ${format(x - sign * amplitude * 0.58)} ${format(top)}`,
    `C ${format(x + sign * amplitude)} ${format(top + (bottom - top) * 0.18)} ${format(x + sign * amplitude)} ${format(
      bottom - (bottom - top) * 0.18
    )} ${format(x - sign * amplitude * 0.58)} ${format(bottom)}`
  ].join(" ");
}

export function curlyDelimiterPath(x, y, height, side, amplitude) {
  const sign = side === "left" ? -1 : 1;
  const top = y - height / 2;
  const bottom = y + height / 2;
  const mid = y;
  return [
    `M ${format(x)} ${format(top)}`,
    `C ${format(x + sign * amplitude)} ${format(top + height * 0.12)} ${format(x + sign * amplitude)} ${format(mid - height * 0.16)} ${format(x)} ${format(mid)}`,
    `C ${format(x + sign * amplitude)} ${format(mid + height * 0.16)} ${format(x + sign * amplitude)} ${format(bottom - height * 0.12)} ${format(x)} ${format(bottom)}`
  ].join(" ");
}

export function inlineMathTextWidth(text, fontSize) {
  const normalized = String(text || "");
  if (!normalized) return 0;
  return Math.max(fontSize * 0.28, [...normalized].length * fontSize * 0.48);
}

function inlineMatrixCellWidth(value, fontScale, unit) {
  const text = mathFallbackText(value).trim();
  const glyphCount = [...text].filter((char) => !/\s/.test(char)).length;
  return texTextWidthCm(text, fontScale) * unit + (Math.max(0, glyphCount - 1) / 28.45274) * unit;
}

export function findSvgMatrixEnvironmentEnd(text, start) {
  let depth = 0;
  let cursor = start;
  while (cursor < text.length) {
    const begin = matchSvgMatrixEnvToken(text, cursor, "begin");
    if (begin) {
      depth += 1;
      cursor = begin.end;
      continue;
    }
    const end = matchSvgMatrixEnvToken(text, cursor, "end");
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

export function matchSvgMatrixEnvToken(text, index, kind) {
  if (!text.startsWith(`\\${kind}`, index)) return null;
  const match = text.slice(index).match(new RegExp(`^\\\\${kind}\\s*\\{([A-Za-z*]+)\\}`));
  if (!match) return null;
  const env = match[1].replace(/\*$/, "");
  if (!SVG_MATRIX_ENV_NAMES.includes(env)) return null;
  return { env, end: index + match[0].length };
}

export function splitSvgMatrixTopLevel(body, mode) {
  const parts = [];
  let current = "";
  let envDepth = 0;
  let braceDepth = 0;
  let index = 0;
  while (index < body.length) {
    const begin = matchSvgMatrixEnvToken(body, index, "begin");
    if (begin) {
      envDepth += 1;
      current += body.slice(index, begin.end);
      index = begin.end;
      continue;
    }
    const end = matchSvgMatrixEnvToken(body, index, "end");
    if (end) {
      envDepth = Math.max(0, envDepth - 1);
      current += body.slice(index, end.end);
      index = end.end;
      continue;
    }
    const char = body[index];
    if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
    if (envDepth === 0 && braceDepth === 0) {
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
