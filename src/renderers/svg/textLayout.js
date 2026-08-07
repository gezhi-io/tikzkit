import {
  englishHyphenationCandidates,
  estimateFormulaBox,
  effectiveMathFontScale,
  parseMathText,
  texTextWidthCm,
  wrapTeXTextLineByWidth
} from "../../tikz/textMetrics.js";
import { mathFallbackText, splitInlineMathSegments } from "../../tikz/text.js";
import { TIKZ_TYPEWRITER_WIDTH_SCALE } from "../../tikz/metrics.js";
import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { mathFallbackFontStyle } from "./mathFallbackSyntax.js";
import { formatPlainTexText } from "./text.js";

export const SVG_TEXT_WRAP_CHAR_WIDTH_EM = 0.54;
// The bundled CMU Serif font uses the same advances as CMR10 (for example,
// "Exponent (8 bit)" is 73.66pt versus TeX's 73.75pt at 10pt).  The former
// generic-serif fallback needed horizontal compression; the embedded font does not.
export const SVG_SERIF_TEXT_WIDTH_SCALE = 1;
export const SVG_SANS_SERIF_TEXT_WIDTH_SCALE = 1;
const TEX_PT_PER_CM = 28.4527559;
// Ordinary TikZ `text width` nodes are centered and use a small safety margin
// for mixed SVG/HTML math metrics. Outer minipages use TeX's sequential
// paragraph breaking instead, where normal interword shrink is the better
// approximation.
const MIXED_INLINE_MATH_FONT_METRIC_SAFETY_SCALE = 1.03;

export function collapseTeXParagraphWhitespace(value) {
  return String(value || "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

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
    fontSizePt: Number(styles[index]?.fontSizePt) || null,
    baselineSkipPt: Number(styles[index]?.baselineSkipPt) || null,
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
  if (options.useLineFontBaselines || options.forceBaseBaseline) {
    const baseFontSizePt = Number(options.baseFontSizePt);
    const firstBaselineSkipPt = Number(first.baselineSkipPt);
    const fallbackBaselineSkipPt = Number(options.baseBaselineSkipPt);
    const baselineSkipPt = options.forceBaseBaseline
      ? fallbackBaselineSkipPt
      : Number.isFinite(firstBaselineSkipPt) && firstBaselineSkipPt > 0
        ? firstBaselineSkipPt
        : fallbackBaselineSkipPt;
    if (Number.isFinite(baseFontSizePt) && baseFontSizePt > 0 && Number.isFinite(baselineSkipPt) && baselineSkipPt > 0) {
      return baseFontSize * (baselineSkipPt / baseFontSizePt);
    }
  }
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
      tokens.push({
        source,
        formatted: mathFallbackText(segment.tex),
        // TeX math has its own glyph widths and relation spacing. Measuring the
        // fallback Unicode string here overstates compact expressions such as
        // $\alpha = \gamma$, which moves a legal word group onto the next line.
        widthCm: inlineMathTokenWidthCm(segment.tex)
      });
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
  if (options.lineBreakMode === "flush") {
    const lines = wrapSvgTextTokensFlush(tokens, maxWidthCm, fontScale);
    return applyConservativeSvgTextTokenHyphenation(lines, maxWidthCm, fontScale, options);
  }
  const count = tokens.length;
  const best = Array.from({ length: count + 1 }, () => ({ cost: Infinity, next: count }));
  best[count] = { cost: 0, next: count };
  for (let start = count - 1; start >= 0; start -= 1) {
    for (let end = start; end < count; end += 1) {
      const line = tokens.slice(start, end + 1);
      const width = svgTextWrappedLineWidthCm(line, fontScale) * MIXED_INLINE_MATH_FONT_METRIC_SAFETY_SCALE;
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

function inlineMathTokenWidthCm(tex) {
  const box = estimateFormulaBox(tex, { scale: 1, minWidth: 0, widthPadding: 0, texTextMetrics: true });
  const width = Number(box?.width);
  return Number.isFinite(width) && width > 0 ? width : null;
}

function svgTextWrappedLineWidthCm(tokens, fontScale) {
  let width = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] || {};
    if (index > 0) width += texTextWidthCm(" ", fontScale);
    const measured = Number(token.widthCm);
    width += Number.isFinite(measured) && measured > 0
      ? measured * fontScale
      : texTextWidthCm(token.formatted, fontScale);
  }
  return width;
}

function svgTextTokensFitWithTeXGlue(tokens, maxWidthCm, fontScale) {
  const width = svgTextWrappedLineWidthCm(tokens, fontScale);
  // Plain TeX's normal interword space is 3.333pt plus 1.667pt minus
  // 1.111pt at 10pt. A ragged-right minipage may use the available shrink
  // while breaking a line, so a strict SVG-width comparison spuriously
  // rejects an otherwise native TeX line.
  const shrinkCm = Math.max(0, tokens.length - 1) * (10 / 9 / TEX_PT_PER_CM) * fontScale;
  return width <= maxWidthCm + shrinkCm;
}

function wrapSvgTextTokensFlush(tokens, maxWidthCm, fontScale) {
  const lines = [];
  let line = [];
  for (const token of tokens) {
    const candidate = [...line, token];
    if (line.length && !svgTextTokensFitWithTeXGlue(candidate, maxWidthCm, fontScale)) {
      lines.push(line);
      line = [token];
    } else {
      line = candidate;
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

// Keep mixed prose/math paragraphs on the same compatibility path as ordinary
// TeX text. Inline math remains indivisible, while a following plain-English
// word can contribute a conservative hyphenated prefix to the preceding line.
// This is important for minipages: TeX can retain `re-` after a compact math
// relation, whereas the SVG fallback otherwise leaves a visibly sparse line.
function applyConservativeSvgTextTokenHyphenation(lines, maxWidthCm, fontScale, options = {}) {
  if (options.hyphenate === false || lines.length < 2) return lines;
  const wrapped = lines.map((line) => line.map((token) => ({ ...token })));
  let introducedHyphenation = false;

  for (let lineIndex = 0; lineIndex < wrapped.length - 1; lineIndex += 1) {
    const current = wrapped[lineIndex];
    const following = wrapped[lineIndex + 1];
    const next = following[0];
    const split = svgTextTokenHyphenationThatFits(current, next, maxWidthCm, fontScale);
    if (!split) continue;
    current.push(split.prefix);
    following[0] = split.suffix;
    introducedHyphenation = true;
  }
  if (!introducedHyphenation) return wrapped;

  // TeX repacks later lines after a discretionary break. Move whole tokens
  // only, so an inline formula never becomes a split or independently spaced
  // fallback glyph sequence.
  for (let lineIndex = 1; lineIndex < wrapped.length - 1; lineIndex += 1) {
    const current = wrapped[lineIndex];
    const following = wrapped[lineIndex + 1];
    while (following.length && svgTextTokensFitWithTeXGlue([...current, following[0]], maxWidthCm, fontScale)) {
      current.push(following.shift());
    }
  }
  return wrapped.filter((line) => line.length);
}

function svgTextTokenHyphenationThatFits(previous, token, maxWidthCm, fontScale) {
  if (!token || token.source !== token.formatted) return null;
  const word = String(token.formatted || "");
  if (!word || svgTextTokensFitWithTeXGlue([...previous, token], maxWidthCm, fontScale)) return null;
  for (const candidate of englishHyphenationCandidates(word)) {
    const prefix = { ...token, source: candidate.prefix, formatted: candidate.prefix };
    if (svgTextTokensFitWithTeXGlue([...previous, prefix], maxWidthCm, fontScale)) {
      return {
        prefix,
        suffix: { ...token, source: candidate.suffix, formatted: candidate.suffix }
      };
    }
  }
  return null;
}

export function hasInlineMathSource(source) {
  return splitInlineMathSegments(source).some((segment) => segment.type === "math");
}
