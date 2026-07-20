import { TIKZ_FONT_FAMILY } from "../../tikz/metrics.js";
import { escapeAttribute, escapeText } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { textFontSizeForUnit } from "./layout.js";
import { estimateRichTextWidthEm } from "./richText.js";
import { svgPaint } from "./style.js";
import { fontVariantAttribute, textFontScale, textWidthScale, wrapTypewriterWidth } from "./textLayout.js";

export function renderSegmentedTextNode(item, normalized, unit, deps = {}) {
  const formatTextLine = deps.formatTextLine || ((line) => String(line ?? ""));
  const fitFontSizeToBox = deps.fitFontSizeToBox || ((baseFontSize) => baseFontSize);
  const lines = splitTextLines(normalized.raw || normalized.text);
  const normalizedLines = Array.isArray(normalized.lines) ? normalized.lines : [];
  const fallbackLines = (normalizedLines.length ? normalizedLines : lines).map(formatTextLine);
  const color = escapeAttribute(item.style?.fill || "black");
  const rawFontFamily = item.style?.fontFamily || normalized.fontFamily || TIKZ_FONT_FAMILY;
  const fontFamily = escapeAttribute(rawFontFamily);
  const rawFontVariant = normalized.fontVariant || item.style?.fontVariant;
  const textFontVariant = fontVariantAttribute({ fontVariant: rawFontVariant });
  const baseFontSize = textFontSizeForUnit(unit) * (normalized.scale || 1) * textFontScale(item, normalized);
  const fontSize = fitFontSizeToBox(baseFontSize, item.fitBox, unit, fallbackLines);
  const centerX = item.x * unit;
  const x = format(centerX);
  const y = format(-item.y * unit);
  const widthScale = textWidthScale(item, rawFontFamily);
  const lineHeight = fontSize * 1.15;
  const startDy = -((lines.length - 1) * lineHeight) / 2;
  const rects = [];
  let baseline = 0;
  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? startDy : lineHeight;
      baseline += dy;
      const parsedSegments = parseTextColorSegments(line);
      rects.push(...inlineBoxRects(parsedSegments, item.x * unit, -item.y * unit + baseline, fontSize));
      return renderFlatSegmentedTextLine(parsedSegments, centerX, dy, fontSize, formatTextLine);
    })
    .join("");
  const text = `<text x="${x}" y="${y}" fill="${color}" text-anchor="start" dominant-baseline="middle" xml:space="preserve" font-size="${format(
    fontSize
  )}"${textFontVariant} font-family="${fontFamily}">${tspans}</text>`;
  return wrapTypewriterWidth(rects.length ? `<g>${rects.join("")}${text}</g>` : text, item, unit, widthScale);
}

export function renderFlatSegmentedTextLine(parsedSegments, centerX, dy, fontSize, formatTextLine = String) {
  let output = "";
  let wrotePositionedSegment = false;
  const formattedLine = parsedSegments.map((segment) => formatTextLine(segment.text)).join("");
  const lineWidth = estimateRichTextWidthEm(formattedLine) * fontSize;
  const x = format(centerX - lineWidth / 2);
  for (const segment of parsedSegments) {
    const text = escapeText(formatTextLine(segment.text));
    if (!text) continue;
    const fill = segment.background ? "white" : segment.color;
    if (!wrotePositionedSegment || fill) {
      const positionAttrs = wrotePositionedSegment ? "" : ` x="${x}" dy="${format(dy)}"`;
      const fillAttr = fill ? ` fill="${escapeAttribute(svgPaint(fill))}"` : "";
      output += `<tspan${positionAttrs}${fillAttr}>${text}</tspan>`;
    } else {
      output += text;
    }
    wrotePositionedSegment = true;
  }
  return wrotePositionedSegment ? output : `<tspan x="${x}" dy="${format(dy)}"></tspan>`;
}

export function hasTextColorSegments(source) {
  return /\\(?:textcolor|tikzinlinebox)\s*\{[^{}]+\}\s*\{[^{}]*\}/.test(String(source || ""));
}

export function splitTextLines(source) {
  return String(source || "")
    .trim()
    .replace(/\\(?:Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b/g, "")
    .replace(/\\(?:tt|rm|sf|bf|bfseries|itshape|slshape|scshape)\b/g, "")
    .split(/\\\\|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length);
}

export function parseTextColorSegments(line) {
  const segments = [];
  const pattern = /\\(textcolor|tikzinlinebox)\s*\{([^{}]+)\}\s*\{([^{}]*)\}/g;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(line))) {
    if (match.index > cursor) segments.push({ text: line.slice(cursor, match.index) });
    const kind = match[1];
    const color = match[2].trim();
    const text = match[3];
    if (kind === "tikzinlinebox") segments.push({ background: color, text });
    else segments.push({ color, text });
    cursor = match.index + match[0].length;
  }
  if (cursor < line.length) segments.push({ text: line.slice(cursor) });
  return segments.length ? segments : [{ text: line }];
}

export function inlineBoxRects(segments, centerX, baselineY, fontSize) {
  const charWidth = fontSize * 0.55;
  const widths = segments.map((segment) => Math.max(segment.text.length * charWidth, segment.background ? fontSize * 0.9 : 0));
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  const rects = [];
  let cursor = centerX - totalWidth / 2;
  segments.forEach((segment, index) => {
    const width = widths[index];
    if (segment.background) {
      const padX = fontSize * 0.12;
      const height = fontSize * 0.92;
      rects.push(
        `<rect x="${format(cursor - padX)}" y="${format(baselineY - height * 0.55)}" width="${format(
          width + padX * 2
        )}" height="${format(height)}" fill="${escapeAttribute(segment.background)}" />`
      );
    }
    cursor += width;
  });
  return rects;
}
