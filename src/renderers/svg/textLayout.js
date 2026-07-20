import { effectiveMathFontScale, parseMathText, texTextWidthCm, wrapTeXTextLineByWidth } from "../../tikz/textMetrics.js";
import { mathFallbackText, splitInlineMathSegments } from "../../tikz/text.js";
import { TIKZ_TYPEWRITER_WIDTH_SCALE } from "../../tikz/metrics.js";
import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { mathFallbackFontStyle } from "./mathFallbackSyntax.js";
import { collapseTeXParagraphWhitespace } from "./richText.js";
import { formatPlainTexText } from "./text.js";

export const SVG_TEXT_WRAP_CHAR_WIDTH_EM = 0.54;
// The bundled CMU Serif font uses the same advances as CMR10 (for example,
// "Exponent (8 bit)" is 73.66pt versus TeX's 73.75pt at 10pt).  The former
// generic-serif fallback needed horizontal compression; the embedded font does not.
export const SVG_SERIF_TEXT_WIDTH_SCALE = 1;
export const SVG_SANS_SERIF_TEXT_WIDTH_SCALE = 1;
const TEX_PT_PER_CM = 28.4527559;
const MIXED_TEX_WRAP_WIDTH_CORRECTION = 1.1;

export function normalizedTextAlign(value) {
  const align = String(value || "").trim().toLowerCase();
  if (align === "left" || align === "right") return align;
  return "center";
}

export function textAnchorForAlign(align) {
  if (align === "left") return "start";
  if (align === "right") return "end";
  return "middle";
}

export function svgTextAnchorForItem(item = {}) {
  const anchor = String(item.svgTextAnchor || "").trim();
  return anchor === "start" || anchor === "middle" || anchor === "end" ? anchor : "";
}

export function svgTextAnchorX(item, unit) {
  const x = Number(item.svgTextX);
  return (Number.isFinite(x) ? x : item.x) * unit;
}

export function svgTextAnchorPoint(item, unit) {
  const explicitAnchor = svgTextAnchorForItem(item);
  return {
    x: explicitAnchor ? svgTextAnchorX(item, unit) : item.x * unit,
    y: -item.y * unit,
    anchor: explicitAnchor || "middle"
  };
}

export function alignedTextX(item, unit, align) {
  const center = item.x * unit;
  const wrapWidth = Number(item.wrapWidth);
  if (!Number.isFinite(wrapWidth) || wrapWidth <= 0) return center;
  if (align === "left") return center - (wrapWidth * unit) / 2;
  if (align === "right") return center + (wrapWidth * unit) / 2;
  return center;
}

export function textLineStyles(normalized, count, fallbackStyle = {}) {
  const styles = Array.isArray(normalized.lineStyles) ? normalized.lineStyles : [];
  return Array.from({ length: count }, (_unused, index) => ({
    scale: Number(styles[index]?.scale) || 1,
    fontFamily: styles[index]?.fontFamily || fallbackStyle.fontFamily || null,
    fontWeight: styles[index]?.fontWeight || normalized.fontWeight || fallbackStyle.fontWeight || null,
    fontStyle: styles[index]?.fontStyle || normalized.fontStyle || fallbackStyle.fontStyle || null,
    fontVariant: styles[index]?.fontVariant || normalized.fontVariant || fallbackStyle.fontVariant || null,
    fontSegments: Array.isArray(styles[index]?.fontSegments) ? styles[index].fontSegments : []
  }));
}

export function wrapStyledSvgTextLines(
  sourceLines,
  formattedLines,
  sourceLineStyles,
  wrapWidth,
  unit,
  baseFontSize,
  options = {}
) {
  const lines = [];
  const contentLines = [];
  const lineStyles = [];
  for (let index = 0; index < formattedLines.length; index += 1) {
    const style = sourceLineStyles[index] || {};
    const lineFontSize = baseFontSize * (Number(style.scale) || 1);
    const wrapped = wrapSvgTextLineWithSource(
      sourceLines[index],
      formattedLines[index],
      wrapWidth,
      unit,
      lineFontSize,
      options
    );
    for (const entry of wrapped) {
      lines.push(entry.line);
      contentLines.push(entry.contentLine);
      lineStyles.push(style);
    }
  }
  return { lines, contentLines, lineStyles };
}

export function baselineOffsets(baseFontSize, lineStyles, options = {}) {
  if (lineStyles.length <= 1) return [0];
  const gaps = [];
  for (let index = 0; index < lineStyles.length - 1; index += 1) {
    gaps.push(lineBaselineGap(baseFontSize, lineStyles[index], lineStyles[index + 1], options));
  }
  const total = gaps.reduce((sum, gap) => sum + gap, 0);
  const offsets = [-total / 2];
  for (const gap of gaps) offsets.push(offsets.at(-1) + gap);
  return offsets;
}

export function lineBaselineGap(baseFontSize, first = {}, second = {}, options = {}) {
  const firstScale = Number(first.scale) || 1;
  const secondScale = Number(second.scale) || 1;
  if (Math.abs(firstScale - secondScale) < 0.05) {
    const requestedRatio = Number(options.baselineSkipRatio);
    const baselineSkipRatio = Number.isFinite(requestedRatio) && requestedRatio > 0 ? requestedRatio : 1.15;
    return baseFontSize * Math.max(firstScale, secondScale) * baselineSkipRatio;
  }
  return baseFontSize * (firstScale + secondScale) * (options.compactMixedSize ? 0.43 : 0.5);
}

export function lineFontAttributes(lineStyle, baseFontSize, sourceLine = "") {
  const fontStyle = fontStyleAttribute(lineStyle) || mathLineFontStyleAttribute(sourceLine);
  return `${lineStyle.scale && lineStyle.scale !== 1 ? ` font-size="${format(baseFontSize * lineStyle.scale)}"` : ""}${fontWeightAttribute(
    lineStyle
  )}${fontStyle}${fontVariantAttribute(lineStyle)}`;
}

export function fontWeightAttribute(lineStyle) {
  return lineStyle.fontWeight ? ` font-weight="${escapeAttribute(String(lineStyle.fontWeight))}"` : "";
}

export function fontStyleAttribute(lineStyle) {
  return lineStyle.fontStyle ? ` font-style="${escapeAttribute(String(lineStyle.fontStyle))}"` : "";
}

export function fontVariantAttribute(lineStyle) {
  return lineStyle.fontVariant ? ` font-variant="${escapeAttribute(String(lineStyle.fontVariant))}"` : "";
}

export function mathLineFontStyleAttribute(sourceLine) {
  const tex = mathOnlySourceLineTex(sourceLine);
  const style = tex ? mathFallbackFontStyle(tex) : "";
  return style ? ` font-style="${escapeAttribute(style)}"` : "";
}

export function mathOnlySourceLineTex(sourceLine) {
  const source = String(sourceLine || "").trim();
  const direct = parseMathText(source);
  if (direct?.tex) return direct.tex;
  const segments = splitInlineMathSegments(source);
  const mathSpans = segments.filter((segment) => segment.type === "math").map((segment) => segment.tex);
  if (!mathSpans.length) return "";
  const nonMath = segments
    .filter((segment) => segment.type !== "math")
    .map((segment) => segment.text)
    .join("")
    .replace(/\\(?:Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b/g, "")
    .replace(/[{}\s]/g, "");
  return nonMath ? "" : mathSpans.join(" ");
}

export function textFontScale(item, normalized = null) {
  const physicalSizePt = Number(item?.font?.sizePt);
  if (Number.isFinite(physicalSizePt) && physicalSizePt > 0) {
    const normalizedScale = Number(normalized?.scale);
    const contentScale = Number.isFinite(normalizedScale) && normalizedScale > 0 ? normalizedScale : 1;
    const factor = physicalSizePt / 10 / contentScale;
    if (item?.style?.exactMathFontScale) return factor;
    return normalized?.tex ? effectiveMathFontScale(normalized.tex, factor) : factor;
  }
  const key = normalized?.explicitFontSize ? item.style?.fontSizeBaseScale : item.style?.fontScale;
  const scale = Number(key);
  const factor = Number.isFinite(scale) && scale > 0 ? scale : 1;
  if (item?.style?.exactMathFontScale) return factor;
  return normalized?.tex ? effectiveMathFontScale(normalized.tex, factor) : factor;
}

export function textBaselineSkipRatio(item = {}) {
  const sizePt = Number(item.font?.sizePt);
  const baselineSkipPt = Number(item.font?.baselineSkipPt);
  if (!Number.isFinite(sizePt) || sizePt <= 0 || !Number.isFinite(baselineSkipPt) || baselineSkipPt <= 0) return null;
  return baselineSkipPt / sizePt;
}

export function typewriterWidthScale(fontFamily) {
  const text = String(fontFamily || "");
  return /(?:Typewriter|mono|Menlo|Monaco|Consolas|Courier)/i.test(text) ? TIKZ_TYPEWRITER_WIDTH_SCALE : 1;
}

export function textWidthScale(item, fontFamily) {
  const explicit = Number(item?.style?.textWidthScale);
  if (
    Number.isFinite(explicit) &&
    explicit > 0 &&
    (item?.style?.textWidthScaleExplicit || Math.abs(explicit - 1) > 1e-9)
  ) {
    return explicit;
  }
  const familyScale = typewriterWidthScale(fontFamily);
  if (familyScale < 1) return familyScale;
  if (/(?:CMUSans|SansSerif|sans-serif|Helvetica|Arial)/i.test(String(fontFamily || ""))) {
    return SVG_SANS_SERIF_TEXT_WIDTH_SCALE;
  }
  return SVG_SERIF_TEXT_WIDTH_SCALE;
}

export function wrapTypewriterWidth(svg, item, unit, scale) {
  if (!Number.isFinite(scale) || Math.abs(scale - 1) < 1e-6) return svg;
  const cx = format(svgTextAnchorForItem(item) ? svgTextAnchorX(item, unit) : item.x * unit);
  return `<g class="tikz-typewriter-text" transform="translate(${cx} 0) scale(${format(scale)} 1) translate(${format(
    -Number(cx)
  )} 0)">${svg}</g>`;
}

export function wrapSvgTextLines(lines, wrapWidth, unit, fontSize) {
  const width = Number(wrapWidth) * unit;
  if (!Number.isFinite(width) || width <= 0) return lines;
  const maxChars = Math.max(1, Math.floor(width / Math.max(1, fontSize * SVG_TEXT_WRAP_CHAR_WIDTH_EM)));
  return lines.flatMap((line) => wrapSvgTextLine(line, maxChars));
}

export function wrapSvgTextLineWithSource(sourceLine, formattedLine, wrapWidth, unit, fontSize, options = {}) {
  const width = Number(wrapWidth) * unit;
  const source = collapseTeXParagraphWhitespace(sourceLine ?? formattedLine ?? "");
  const formatted = collapseTeXParagraphWhitespace(formattedLine ?? source);
  if (!Number.isFinite(width) || width <= 0) return [{ line: formatted, contentLine: source }];
  if (!hasInlineMathSource(source)) {
    const fontScale = (fontSize * TEX_PT_PER_CM) / (unit * 10);
    return wrapTeXTextLineByWidth(formatted, Number(wrapWidth), fontScale, options).map((line) => ({
      line,
      contentLine: line
    }));
  }
  const tokens = svgTextWrapTokens(source);
  if (!tokens.length) return [{ line: formatted, contentLine: source }];
  const fontScale = (fontSize * TEX_PT_PER_CM) / (unit * 10);
  return wrapSvgTextTokensByWidth(tokens, Number(wrapWidth), fontScale, options).map((line) => ({
    line: joinWrappedTextTokens(line, "formatted"),
    contentLine: joinWrappedTextTokens(line, "source")
  }));
}

function joinWrappedTextTokens(tokens, key) {
  return tokens
    .map((token) => token[key])
    .join(" ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([([{])\s+/g, "$1");
}

export function wrapSvgTextLine(line, maxChars) {
  const text = String(line || "").trim();
  if (!text || text.length <= maxChars || !/\s/.test(text)) return [text];
  const tokens = text.split(/\s+/).map((word) => ({ source: word, formatted: word }));
  return wrapSvgTextTokensBalanced(tokens, maxChars).map((line) => line.map((token) => token.formatted).join(" "));
}

export function svgTextWrapTokens(sourceLine) {
  const tokens = [];
  for (const segment of splitInlineMathSegments(sourceLine)) {
    if (segment.type === "math") {
      const source = `$${segment.tex}$`;
      tokens.push({ source, formatted: mathFallbackText(segment.tex) });
      continue;
    }
    for (const match of String(segment.text || "").matchAll(/\S+/g)) {
      const source = match[0];
      const formatted = formatPlainTexText(source);
      if (/^[,.;:!?]+$/.test(formatted) && tokens.length) {
        tokens.at(-1).source += source;
        tokens.at(-1).formatted += formatted;
      } else {
        tokens.push({ source, formatted });
      }
    }
  }
  return tokens;
}

export function wrapSvgTextTokensBalanced(tokens, maxChars) {
  if (!tokens.length) return [];
  const count = tokens.length;
  const best = Array.from({ length: count + 1 }, () => ({ cost: Infinity, next: count }));
  best[count] = { cost: 0, next: count };
  for (let start = count - 1; start >= 0; start -= 1) {
    let width = 0;
    for (let end = start; end < count; end += 1) {
      width += String(tokens[end].formatted || "").length + (end > start ? 1 : 0);
      if (width > maxChars * 1.08 && end > start) break;
      const isLast = end === count - 1;
      const overfull = Math.max(0, width - maxChars);
      const remaining = Math.max(0, maxChars - width);
      const lineCost = overfull > 0 ? overfull * overfull * 70 : isLast ? remaining * remaining * 0.05 : remaining * remaining;
      const cost = lineCost + best[end + 1].cost;
      if (cost < best[start].cost) best[start] = { cost, next: end + 1 };
    }
  }
  const lines = [];
  let cursor = 0;
  while (cursor < count) {
    const next = Math.max(cursor + 1, Math.min(count, best[cursor].next));
    lines.push(tokens.slice(cursor, next));
    cursor = next;
  }
  return lines;
}

export function wrapSvgTextTokensByWidth(tokens, maxWidthCm, fontScale = 1, options = {}) {
  if (!tokens.length) return [];
  if (!Number.isFinite(maxWidthCm) || maxWidthCm <= 0) return [tokens];
  if (options.lineBreakMode === "flush") return wrapSvgTextTokensFlush(tokens, maxWidthCm, fontScale);
  const count = tokens.length;
  const best = Array.from({ length: count + 1 }, () => ({ cost: Infinity, next: count }));
  best[count] = { cost: 0, next: count };
  for (let start = count - 1; start >= 0; start -= 1) {
    for (let end = start; end < count; end += 1) {
      const line = tokens.slice(start, end + 1);
      const width = texTextWidthCm(joinWrappedTextTokens(line, "formatted"), fontScale) * MIXED_TEX_WRAP_WIDTH_CORRECTION;
      if (width > maxWidthCm * 1.08 && end > start) break;
      const isLast = end === count - 1;
      const overfull = Math.max(0, width - maxWidthCm);
      const remaining = Math.max(0, maxWidthCm - width);
      const lineCost = overfull > 0 ? overfull * overfull * 70 : isLast ? remaining * remaining * 0.05 : remaining * remaining;
      const cost = lineCost + best[end + 1].cost;
      if (cost < best[start].cost) best[start] = { cost, next: end + 1 };
    }
  }
  const lines = [];
  let cursor = 0;
  while (cursor < count) {
    const next = Math.max(cursor + 1, Math.min(count, best[cursor].next));
    lines.push(tokens.slice(cursor, next));
    cursor = next;
  }
  return lines;
}

function wrapSvgTextTokensFlush(tokens, maxWidthCm, fontScale) {
  const lines = [];
  let line = [];
  for (const token of tokens) {
    const candidate = [...line, token];
    const width = texTextWidthCm(joinWrappedTextTokens(candidate, "formatted"), fontScale);
    if (line.length && width > maxWidthCm) {
      lines.push(line);
      line = [token];
    } else {
      line = candidate;
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

export function hasInlineMathSource(source) {
  return splitInlineMathSegments(source).some((segment) => segment.type === "math");
}
