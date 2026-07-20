import { parseMathText } from "../../tikz/textMetrics.js";
import { mathFallbackText, splitInlineMathSegments } from "../../tikz/text.js";
import { TIKZ_FONT_FAMILY } from "../../tikz/metrics.js";
import { escapeAttribute, escapeText } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { readBalancedGroup, skipInlineWhitespace } from "./mathFallbackSyntax.js";
import { formatPlainTexText } from "./text.js";

export function tensorMatrixFallbackParts(tex) {
  const source = String(tex || "");
  if (!/\\(?:overmat|undermat)\b/.test(source) || !/\\begin\{matrix\}/.test(source)) return null;
  const blocks = [];
  const pattern = /\\(overmat|undermat)\b/g;
  let match;
  while ((match = pattern.exec(source))) {
    const parsed = readTensorMatrixMacro(source, match.index, match[1]);
    if (!parsed) continue;
    pattern.lastIndex = parsed.end;
    const matrix = parseSmallMatrixBody(parsed.matrix);
    if (!matrix.length) continue;
    blocks.push({
      labelPosition: parsed.kind === "overmat" ? "top" : "bottom",
      label: tensorMatrixLabelText(parsed.label),
      color: tensorMatrixColor(parsed.color),
      matrix
    });
  }
  return blocks.length >= 2 ? blocks.slice(0, 4) : null;
}

export function readTensorMatrixMacro(source, start, kind) {
  let cursor = start + kind.length + 1;
  const label = readBalancedGroup(source, skipInlineWhitespace(source, cursor));
  if (!label) return null;
  cursor = label.end;
  const matrix = readBalancedGroup(source, skipInlineWhitespace(source, cursor));
  if (!matrix) return null;
  cursor = matrix.end;
  const color = readBalancedGroup(source, skipInlineWhitespace(source, cursor));
  if (!color) return null;
  return {
    kind,
    label: label.content,
    matrix: matrix.content,
    color: color.content,
    end: color.end
  };
}

export function tensorMatrixLabelText(value) {
  return formatTensorMatrixTextLine(value)
    .replace(/\\textcolor\s*\{[^{}]+\}\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\(?:text|mathrm|mathbf|bf)\s*\{([^{}]*)\}/g, "$1")
    .replace(/\$/g, "")
    .trim();
}

function formatTensorMatrixTextLine(line) {
  const math = parseMathText(line);
  if (math) return mathFallbackText(math.tex);
  const segments = splitInlineMathSegments(line);
  if (segments.some((segment) => segment.type === "math")) {
    return segments.map((segment) => (segment.type === "math" ? mathFallbackText(segment.tex) : formatPlainTexText(segment.text))).join("");
  }
  return formatPlainTexText(line);
}

export function parseSmallMatrixBody(source) {
  const match = String(source || "").match(/\\begin\{matrix\}([\s\S]*?)\\end\{matrix\}/);
  if (!match) return [];
  return match[1]
    .split(/\\\\/)
    .map((row) =>
      row
        .split("&")
        .map((cell) => mathFallbackText(cell).trim())
        .filter(Boolean)
    )
    .filter((row) => row.length);
}

export function tensorMatrixColor(value) {
  const raw = String(value || "").trim();
  if (/^#?[0-9a-f]{6}$/i.test(raw)) return raw.startsWith("#") ? raw : `#${raw}`;
  if (/echodrk/i.test(raw)) return "#0099cc";
  if (/red/i.test(raw)) return "red";
  if (/gray|grey/i.test(raw)) return "gray";
  return "black";
}

export function renderTensorMatrixFallback(item, blocks, baseFontSize, unit, color) {
  const cx = item.x * unit;
  const cy = -item.y * unit;
  const fontSize = Math.max(6, Math.min(36, baseFontSize));
  const cell = fontSize * 0.82;
  const rowCell = fontSize * 0.94;
  const labelHeight = fontSize * 0.8;
  const matrixWidth = cell * 3.25;
  const matrixHeight = rowCell * 3.05;
  const bracketPad = fontSize * 0.32;
  const blockWidth = matrixWidth + bracketPad * 2 + fontSize * 0.2;
  const blockHeight = matrixHeight + labelHeight + fontSize * 0.42;
  const gapX = fontSize;
  const gapY = fontSize * 0.1;
  const prefixWidth = fontSize * 2.1;
  const gridWidth = blockWidth * 2 + gapX;
  const gridHeight = blockHeight * 2 + gapY;
  const totalWidth = prefixWidth + gridWidth + fontSize * 0.8;
  const startX = cx - totalWidth / 2;
  const startY = cy - gridHeight / 2;
  const parts = [
    `<g class="tikz-tensor-matrix" font-family="${escapeAttribute(TIKZ_FONT_FAMILY)}" fill="${color}">`,
    `<text x="${format(startX)}" y="${format(cy)}" text-anchor="start" dominant-baseline="middle" font-size="${format(
      fontSize * 1.2
    )}">M =</text>`,
    `<path d="M ${format(startX + prefixWidth - fontSize * 0.2)} ${format(startY - fontSize * 0.1)} L ${format(
      startX + prefixWidth - fontSize * 0.55
    )} ${format(startY - fontSize * 0.1)} L ${format(startX + prefixWidth - fontSize * 0.55)} ${format(startY + gridHeight + fontSize * 0.1)} L ${format(
      startX + prefixWidth - fontSize * 0.2
    )} ${format(startY + gridHeight + fontSize * 0.1)} M ${format(startX + totalWidth - fontSize * 0.45)} ${format(startY - fontSize * 0.1)} L ${format(
      startX + totalWidth - fontSize * 0.1
    )} ${format(startY - fontSize * 0.1)} L ${format(startX + totalWidth - fontSize * 0.1)} ${format(
      startY + gridHeight + fontSize * 0.1
    )} L ${format(startX + totalWidth - fontSize * 0.45)} ${format(startY + gridHeight + fontSize * 0.1)}" stroke="${color}" fill="none" stroke-width="${format(
      Math.max(0.55, fontSize * 0.08)
    )}" />`
  ];
  blocks.forEach((block, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = startX + prefixWidth + col * (blockWidth + gapX);
    const y = startY + row * (blockHeight + gapY);
    parts.push(renderTensorMatrixBlock(block, x, y, { fontSize, cell, rowCell, matrixWidth, matrixHeight, blockWidth, labelHeight, bracketPad }));
  });
  parts.push("</g>");
  return parts.join("");
}

export function renderTensorMatrixBlock(block, x, y, metrics) {
  const { fontSize, cell, rowCell = cell, matrixWidth, matrixHeight, blockWidth, labelHeight, bracketPad } = metrics;
  const matrixX = x + (blockWidth - matrixWidth) / 2;
  const matrixY = y + (block.labelPosition === "top" ? labelHeight + fontSize * 0.08 : 0);
  const braceY = block.labelPosition === "top" ? matrixY - fontSize * 0.22 : matrixY + matrixHeight + fontSize * 0.22;
  const labelY = block.labelPosition === "top" ? braceY - fontSize * 0.42 : braceY + fontSize * 0.5;
  const stroke = escapeAttribute(block.color || "black");
  const bracketLeft = matrixX - bracketPad * 0.72;
  const bracketRight = matrixX + matrixWidth + bracketPad * 0.72;
  const bracketTop = matrixY - fontSize * 0.05;
  const bracketBottom = matrixY + matrixHeight + fontSize * 0.05;
  const parts = [
    `<text x="${format(x + blockWidth / 2)}" y="${format(labelY)}" fill="${stroke}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
      fontSize * 0.72
    )}">${escapeText(block.label)}</text>`,
    `<path class="tikz-tensor-brace" d="${tensorBracePath(matrixX, matrixX + matrixWidth, braceY, fontSize * 0.18, block.labelPosition)}" stroke="${stroke}" fill="none" stroke-width="${format(
      Math.max(0.45, fontSize * 0.045)
    )}" stroke-linecap="round" stroke-linejoin="round" />`,
    `<path class="tikz-tensor-inner-bracket" d="${squareBracketPath(
      bracketLeft,
      bracketRight,
      bracketTop,
      bracketBottom,
      fontSize * 0.18
    )}" stroke="black" fill="none" stroke-width="${format(Math.max(0.45, fontSize * 0.045))}" stroke-linecap="square" />`
  ];
  const rows = block.matrix;
  rows.forEach((row, rowIndex) => {
    row.forEach((cellText, colIndex) => {
      parts.push(
        `<text x="${format(matrixX + cell * (0.58 + colIndex))}" y="${format(matrixY + rowCell * (0.62 + rowIndex))}" fill="black" text-anchor="middle" dominant-baseline="middle" font-size="${format(
          fontSize * 0.78
        )}">${escapeText(cellText)}</text>`
      );
    });
  });
  return `<g class="tikz-tensor-matrix-block">${parts.join("")}</g>`;
}

export function squareBracketPath(left, right, top, bottom, tick) {
  return [
    `M ${format(left + tick)} ${format(top)}`,
    `L ${format(left)} ${format(top)}`,
    `L ${format(left)} ${format(bottom)}`,
    `L ${format(left + tick)} ${format(bottom)}`,
    `M ${format(right - tick)} ${format(top)}`,
    `L ${format(right)} ${format(top)}`,
    `L ${format(right)} ${format(bottom)}`,
    `L ${format(right - tick)} ${format(bottom)}`
  ].join(" ");
}

export function tensorBracePath(left, right, y, amplitude, labelPosition) {
  const width = right - left;
  const mid = (left + right) / 2;
  const sign = labelPosition === "top" ? -1 : 1;
  const outerY = y;
  const innerY = y + amplitude * sign;
  const cuspY = y + amplitude * 1.25 * sign;
  return [
    `M ${format(left)} ${format(outerY)}`,
    `C ${format(left + width * 0.08)} ${format(innerY)} ${format(mid - width * 0.18)} ${format(innerY)} ${format(mid - width * 0.06)} ${format(cuspY)}`,
    `C ${format(mid - width * 0.02)} ${format(y + amplitude * 0.55 * sign)} ${format(mid + width * 0.02)} ${format(y + amplitude * 0.55 * sign)} ${format(mid + width * 0.06)} ${format(cuspY)}`,
    `C ${format(mid + width * 0.18)} ${format(innerY)} ${format(right - width * 0.08)} ${format(innerY)} ${format(right)} ${format(outerY)}`
  ].join(" ");
}
