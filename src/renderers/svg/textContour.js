import { escapeAttribute } from "./escape.js";
import { svgPaint } from "./style.js";

export function applyTextContour(svg, rawText) {
  const color = readContourColor(rawText);
  if (!color || !svg.includes("<text")) return svg;
  const stroke = escapeAttribute(svgPaint(color));
  return svg.replace(/<text\b(?![^>]*\bstroke=)([^>]*)>/g, `<text stroke="${stroke}" stroke-width="1.4" paint-order="stroke fill" stroke-linejoin="round"$1>`);
}

export function readContourColor(value) {
  const raw = String(value || "");
  const match = /\\contour\b/.exec(raw);
  if (!match) return null;
  const cursor = skipInlineWhitespace(raw, match.index + match[0].length);
  const color = readBalancedGroup(raw, cursor);
  if (!color) return null;
  return color.content.trim() || null;
}

function readBalancedGroup(raw, start) {
  if (raw[start] !== "{") return null;
  let depth = 0;
  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return { content: raw.slice(start + 1, index), end: index + 1 };
    }
  }
  return null;
}

function skipInlineWhitespace(raw, start) {
  let cursor = start;
  while (/\s/.test(raw[cursor] || "")) cursor += 1;
  return cursor;
}
