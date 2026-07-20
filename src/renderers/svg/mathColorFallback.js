import { TIKZ_FONT_FAMILY } from "../../tikz/metrics.js";
import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { readBalancedGroup, skipInlineWhitespace } from "./mathFallbackSyntax.js";
import { renderFractionPartContent } from "./mathFractionFallback.js";
import { svgPaint } from "./style.js";

export function renderSvgMathColorSegmentsContent(segments, fontSize, renderSegmentContent) {
  return segments
    .map((segment) => {
      const content = renderSegmentContent(segment.tex, fontSize);
      if (!segment.color) return content;
      return `<tspan fill="${escapeAttribute(svgPaint(segment.color))}">${content}</tspan>`;
    })
    .join("");
}

export function coloredMathTextFallback(tex) {
  const raw = String(tex || "");
  if (!raw.includes("\\textcolor")) return null;
  const segments = [];
  let cursor = 0;
  while (cursor < raw.length) {
    const index = raw.indexOf("\\textcolor", cursor);
    if (index === -1) {
      const texPart = raw.slice(cursor);
      if (texPart) segments.push({ tex: texPart, color: null });
      break;
    }
    if (index > cursor) segments.push({ tex: raw.slice(cursor, index), color: null });
    const read = readTextColorCommand(raw, index);
    if (!read) {
      segments.push({ tex: raw.slice(index, index + "\\textcolor".length), color: null });
      cursor = index + "\\textcolor".length;
      continue;
    }
    segments.push({ tex: read.body, color: read.color });
    cursor = read.end;
  }
  return segments.some((segment) => segment.color) ? segments : null;
}

export function statefulColorMathTextFallback(tex) {
  const raw = String(tex || "");
  if (!raw.includes("\\color")) return null;
  const segments = [];
  let cursor = 0;
  let color = null;
  while (cursor < raw.length) {
    const index = raw.indexOf("\\color", cursor);
    if (index === -1) {
      const texPart = raw.slice(cursor);
      if (texPart) segments.push({ tex: texPart, color });
      break;
    }
    if (index > cursor) segments.push({ tex: raw.slice(cursor, index), color });
    const read = readStatefulColorCommand(raw, index);
    if (!read) {
      segments.push({ tex: raw.slice(index, index + "\\color".length), color });
      cursor = index + "\\color".length;
      continue;
    }
    color = read.color;
    cursor = read.end;
  }
  return segments.some((segment) => segment.color) ? segments : null;
}

export function readStatefulColorCommand(raw, start) {
  if (!raw.startsWith("\\color", start) || /[A-Za-z@]/.test(raw[start + "\\color".length] || "")) return null;
  let cursor = skipInlineWhitespace(raw, start + "\\color".length);
  const color = readBalancedGroup(raw, cursor);
  if (!color) return null;
  return { color: color.content.trim(), end: color.end };
}

export function readTextColorCommand(raw, start) {
  if (!raw.startsWith("\\textcolor", start)) return null;
  let cursor = start + "\\textcolor".length;
  cursor = skipInlineWhitespace(raw, cursor);
  const color = readBalancedGroup(raw, cursor);
  if (!color) return null;
  cursor = skipInlineWhitespace(raw, color.end);
  const body = readBalancedGroup(raw, cursor);
  if (!body) return null;
  return { color: color.content.trim(), body: body.content, end: body.end };
}

export function renderColoredMathTextFallback(item, segments, baseFontSize, unit, color, fontStyle, fontWeight) {
  const x = item.x * unit;
  const y = -item.y * unit;
  const textAttrs = `fill="${color}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    baseFontSize
  )}"${fontStyle ? ` font-style="${fontStyle}"` : ""}${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(
    TIKZ_FONT_FAMILY
  )}"`;
  const content = segments
    .map((segment) => {
      const rendered = renderFractionPartContent(segment.tex, baseFontSize);
      if (!segment.color) return rendered;
      return `<tspan fill="${escapeAttribute(svgPaint(segment.color))}">${rendered}</tspan>`;
    })
    .join("");
  return `<text x="${format(x)}" y="${format(y)}" ${textAttrs}>${content}</text>`;
}
