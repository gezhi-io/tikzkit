import { mathFallbackText } from "../../tikz/text.js";
import {
  findMathMatrixEnvironmentEnd,
  matchMathMatrixEnvironmentToken,
  matrixDelimiterSides,
  parseInlineMathMatrix,
  splitMathMatrixTopLevel
} from "../../tikz/mathMatrixSyntax.js";
import { texTextWidthCm } from "../../tikz/textMetrics.js";
import { TIKZ_FONT_FAMILY } from "../../tikz/metrics.js";
import { escapeAttribute, escapeText } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";

export {
  findMathMatrixEnvironmentEnd as findSvgMatrixEnvironmentEnd,
  matchMathMatrixEnvironmentToken as matchSvgMatrixEnvToken,
  splitMathMatrixTopLevel as splitSvgMatrixTopLevel
};

export function inlineMatrixMathFallback(tex) {
  const parts = parseInlineMathMatrix(tex);
  if (!parts) return null;
  return {
    ...parts,
    rows: parts.rows.map((row) => row.map((cell) => mathFallbackText(cell).trim()))
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
  const rowGap = cellFontSize * 0.1;
  const rowHeight = cellFontSize * 1.16;
  const colWidths = Array.from({ length: colCount }, (_value, colIndex) =>
    Math.max(
      cellFontSize * 0.44,
      ...parts.rows.map((row) => inlineMatrixCellWidth(row[colIndex] || "", fontScale, unit))
    )
  );
  const interColumnGaps = Array.from({ length: Math.max(0, colCount - 1) }, (_value, index) =>
    parts.interColumnGaps?.[index] === 0 ? 0 : cellFontSize
  );
  const contentWidth = colWidths.reduce((sum, value) => sum + value, 0) + interColumnGaps.reduce((sum, value) => sum + value, 0);
  const matrixHeight = rowHeight * parts.rows.length + rowGap * Math.max(0, parts.rows.length - 1);
  const delimiters = parts.delimiters || matrixDelimiterSides(parts.env);
  const delimiterWidth = cellFontSize * 0.72;
  const delimiterPad = cellFontSize * 0.1;
  const leftDelimiterWidth = delimiters.left ? delimiterWidth : 0;
  const rightDelimiterWidth = delimiters.right ? delimiterWidth : 0;
  const leftDelimiterPad = delimiters.left ? delimiterPad : 0;
  const rightDelimiterPad = delimiters.right ? delimiterPad : 0;
  // Keep the fallback glyph layout aligned with the shared amsmath matrix
  // metric: a textstyle matrix retains a 3pt edge bearing.
  const arrayColumnAllowance = parts.env === "array" ? 0 : (3 / 28.45274) * unit;
  const matrixWidth = contentWidth + leftDelimiterWidth + rightDelimiterWidth + leftDelimiterPad + rightDelimiterPad + arrayColumnAllowance;
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
  const contentX = matrixX + leftDelimiterWidth + leftDelimiterPad + arrayColumnAllowance / 2;
  output.push(renderSvgMatrixDelimiters(delimiters, matrixX, y, matrixWidth, matrixHeight, leftDelimiterWidth, rightDelimiterWidth, cellFontSize, color));
  let cellY = y - matrixHeight / 2 + rowHeight / 2;
  for (const row of parts.rows) {
    let cellX = contentX;
    for (let colIndex = 0; colIndex < colCount; colIndex += 1) {
      const value = row[colIndex] || "";
      const colWidth = colWidths[colIndex];
      if (value) {
        const alignment = parts.columnAlignments?.[colIndex] || "center";
        const textAnchor = alignment === "left" ? "start" : alignment === "right" ? "end" : "middle";
        const textX = alignment === "left" ? cellX : alignment === "right" ? cellX + colWidth : cellX + colWidth / 2;
        output.push(`<text x="${format(textX)}" y="${format(cellY)}" ${textAttrs} text-anchor="${textAnchor}" font-size="${format(
          cellFontSize
        )}">${escapeText(value)}</text>`);
      }
      cellX += colWidth + (interColumnGaps[colIndex] || 0);
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
  const sides = matrixDelimiterSides(env);
  return renderSvgMatrixDelimiters(sides, x, y, width, height, sides.left ? delimiterWidth : 0, sides.right ? delimiterWidth : 0, fontSize, color);
}

function renderSvgMatrixDelimiters(sides, x, y, width, height, leftWidth, rightWidth, fontSize, color) {
  const output = [];
  if (sides.left) output.push(renderSvgMatrixDelimiterSide(sides.left, "left", x, y, height, leftWidth, fontSize, color));
  if (sides.right) output.push(renderSvgMatrixDelimiterSide(sides.right, "right", x + width, y, height, rightWidth, fontSize, color));
  return output.join("");
}

function renderSvgMatrixDelimiterSide(kind, side, edge, y, height, width, fontSize, color) {
  if (!kind || width <= 0) return "";
  const className = `tikz-matrix-delimiter tikz-matrix-delimiter-${side}`;
  const strokeWidth = Math.max(0.45, fontSize * 0.055);
  const top = y - height / 2 - fontSize * 0.03;
  const bottom = y + height / 2 + fontSize * 0.03;
  const inward = side === "left" ? 1 : -1;
  const x = edge + inward * width * 0.9;
  let path;
  if (kind === "paren") {
    path = parenthesisDelimiterPath(x - inward * width * 0.32, top + fontSize * 0.06, bottom - fontSize * 0.06, width * 0.34, side);
  } else if (kind === "curly") {
    path = curlyDelimiterPath(x, y, height + fontSize * 0.08, side, fontSize * 0.22);
  } else if (kind === "bar" || kind === "doublebar") {
    const offset = kind === "doublebar" ? width * 0.18 : 0;
    const segments = [`M ${format(x - offset)} ${format(top)} L ${format(x - offset)} ${format(bottom)}`];
    if (kind === "doublebar") segments.push(`M ${format(x + offset)} ${format(top)} L ${format(x + offset)} ${format(bottom)}`);
    path = segments.join(" ");
  } else {
    const tick = width * 0.52;
    path = `M ${format(x + inward * tick)} ${format(top)} L ${format(x)} ${format(top)} L ${format(x)} ${format(bottom)} L ${format(x + inward * tick)} ${format(bottom)}`;
  }
  return `<path class="${className}" d="${path}" stroke="${color}" fill="none" stroke-width="${format(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round" />`;
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
