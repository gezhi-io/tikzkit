import { parseMathText, texTextWidthCm } from "../../tikz/textMetrics.js";
import {
  TIKZ_FONT_FAMILY,
  TIKZ_MONOSPACE_FONT_FAMILY,
  TIKZ_SANS_SERIF_FONT_FAMILY
} from "../../tikz/metrics.js";
import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { textFontSizeForUnit } from "./layout.js";
import { hasTextColorSegments, renderSegmentedTextNode } from "./segmentedText.js";
import {
  alignedTextX,
  baselineOffsets,
  fontStyleAttribute,
  fontVariantAttribute,
  fontWeightAttribute,
  lineFontAttributes,
  mathLineFontStyleAttribute,
  normalizedTextAlign,
  svgTextAnchorForItem,
  svgTextAnchorX,
  textAnchorForAlign,
  textBaselineSkipRatio,
  textFontScale,
  textLineStyles,
  textWidthScale,
  wrapStyledSvgTextLines,
  wrapTypewriterWidth
} from "./textLayout.js";

const TEX_PT_PER_CM = 28.4527559;

export function renderPlainTextNode(item, normalized, unit, deps = {}) {
  const formatTextLine = deps.formatTextLine || ((line) => String(line ?? ""));
  const renderSvgTextLineContent = deps.renderSvgTextLineContent || ((_sourceLine, formattedLine) => String(formattedLine ?? ""));
  const fitFontSizeToBox = deps.fitFontSizeToBox || ((baseFontSize) => baseFontSize);
  if (!normalized.color && hasTextColorSegments(normalized.raw)) {
    return renderSegmentedTextNode(item, normalized, unit, { fitFontSizeToBox, formatTextLine });
  }
  const color = escapeAttribute(normalized.color || item.style?.fill || "black");
  const rawFontFamily = resolvedFontFamily(item, normalized);
  const fontFamily = escapeAttribute(rawFontFamily);
  const fontFallback = resolvedFontStyle(item);
  const rawFontVariant = normalized.fontVariant || item.style?.fontVariant || fontFallback.fontVariant;
  const baseFontSize = textFontSizeForUnit(unit) * (normalized.scale || 1) * textFontScale(item, normalized);
  const sourceLines = normalized.lines.length ? normalized.lines : [normalized.text];
  const formattedLines = sourceLines.map(formatTextLine);
  const sourceLineStyles = textLineStyles(normalized, sourceLines.length, fontFallback);
  const wrappedText = wrapStyledSvgTextLines(sourceLines, formattedLines, sourceLineStyles, item.wrapWidth, unit, baseFontSize);
  const lines = wrappedText.lines;
  const contentLines = wrappedText.contentLines;
  const fontSize = fitFontSizeToBox(baseFontSize, item.fitBox, unit, lines);
  const lineStyles = wrappedText.lineStyles;
  const wrapWidth = Number(item.wrapWidth);
  const hasWrapWidth = Number.isFinite(wrapWidth) && wrapWidth > 0;
  const explicitTextAnchor = svgTextAnchorForItem(item);
  const align = item.textAlign ? normalizedTextAlign(item.textAlign) : hasWrapWidth ? "left" : "center";
  const x = format(explicitTextAnchor ? svgTextAnchorX(item, unit) : alignedTextX(item, unit, align));
  const textAnchor = explicitTextAnchor || textAnchorForAlign(align);
  const y = format(-item.y * unit);
  const widthScale = textWidthScale(item, rawFontFamily);
  const textFontVariant = fontVariantAttribute({ fontVariant: rawFontVariant });
  if (lines.length <= 1) {
    const lineStyle = lineStyles[0] || {};
    const lineFontSize = fontSize * (lineStyle.scale || 1) * mathOnlyGlyphFontScale(contentLines[0]);
    const content = renderLineFontSegments(
      contentLines[0],
      lines[0] || "",
      lineStyle,
      lineFontSize,
      unit,
      renderSvgTextLineContent
    );
    const lineFontStyle = fontStyleAttribute(lineStyle) || mathLineFontStyleAttribute(contentLines[0]);
    const text = `<text x="${x}" y="${y}" fill="${color}" text-anchor="${textAnchor}" dominant-baseline="middle" xml:space="preserve" font-size="${format(
      lineFontSize
    )}"${fontWeightAttribute(lineStyle)}${lineFontStyle}${textFontVariant} font-family="${fontFamily}">${content}</text>`;
    return wrapTypewriterWidth(text, item, unit, widthScale);
  }
  const lineOffsets = baselineOffsets(fontSize, lineStyles, {
    compactMixedSize: hasWrapWidth,
    baselineSkipRatio: textBaselineSkipRatio(item)
  });
  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? lineOffsets[0] : lineOffsets[index] - lineOffsets[index - 1];
      const lineStyle = lineStyles[index] || {};
      const lineFontSize = fontSize * (lineStyle.scale || 1);
      return `<tspan x="${x}" dy="${format(dy)}"${lineFontAttributes(lineStyle, fontSize, contentLines[index])}>${renderLineFontSegments(
        contentLines[index],
        line,
        lineStyle,
        lineFontSize,
        unit,
        renderSvgTextLineContent
      )}</tspan>`;
    })
    .join("");
  const text = `<text x="${x}" y="${y}" fill="${color}" text-anchor="${textAnchor}" dominant-baseline="middle" xml:space="preserve" font-size="${format(
    fontSize
  )}"${textFontVariant} font-family="${fontFamily}">${tspans}</text>`;
  return wrapTypewriterWidth(text, item, unit, widthScale);
}

export function renderPlainTextNodeWithTextEngine(item, normalized, unit, options = {}) {
  const textEngine = options.textEngine;
  if (!textEngine || typeof textEngine.measure !== "function" || typeof textEngine.renderFromCache !== "function") return "";
  const wrapWidth = Number(item.wrapWidth);
  const textWidthPt = Number.isFinite(wrapWidth) && wrapWidth > 0 ? wrapWidth * TEX_PT_PER_CM : null;
  const align = item.textAlign
    ? normalizedTextAlign(item.textAlign)
    : Number.isFinite(wrapWidth) && wrapWidth > 0
      ? "left"
      : "center";
  const fontScale = textEnginePlainTextScale(normalized) * textFontScale(item, normalized);
  let metrics = null;
  try {
    metrics = textEngine.measure({
      mode: "text",
      text: normalized.raw || item.text || normalized.text,
      displayMode: false,
      font: item.font,
      fontSizePt: 10 * fontScale,
      fontFamily: item.style?.fontFamily || normalized.fontFamily || TIKZ_FONT_FAMILY,
      fontStyle: item.style?.fontStyle || normalized.fontStyle || "normal",
      fontWeight: item.style?.fontWeight || normalized.fontWeight || "normal",
      textWidthPt,
      alignment: align,
      color: normalized.color || item.style?.fill || "black"
    });
  } catch {
    return "";
  }
  const cacheKey = metrics?.cacheKey;
  if (!cacheKey) return "";
  let payload = null;
  try {
    payload = textEngine.renderFromCache(cacheKey);
  } catch {
    return "";
  }
  if (!payload?.body) return "";
  return `<g class="tikz-text-engine-cache" transform="translate(${format(item.x * unit)} ${format(-item.y * unit)})">${payload.body}</g>`;
}

function textEnginePlainTextScale(normalized = {}) {
  const base = Number(normalized.scale) || 1;
  const styles = Array.isArray(normalized.lineStyles) ? normalized.lineStyles : [];
  if (styles.length !== 1) return base;
  const lineScale = Number(styles[0]?.scale);
  return base * (Number.isFinite(lineScale) && lineScale > 0 ? lineScale : 1);
}

function mathOnlyGlyphFontScale(sourceLine) {
  const math = parseMathText(String(sourceLine || "").trim());
  if (!math) return 1;
  const tex = String(math.tex || "").trim();
  return /^\\(?:downarrow|uparrow|leftarrow|rightarrow|Downarrow|Uparrow|Leftarrow|Rightarrow)(?![A-Za-z])$/.test(tex) ? 0.9 : 1;
}

export function estimatePlainTextRenderBounds(item, normalized, unit, deps = {}) {
  const formatTextLine = deps.formatTextLine || ((line) => String(line ?? ""));
  const fitFontSizeToBox = deps.fitFontSizeToBox || ((baseFontSize) => baseFontSize);
  const rawFontFamily = resolvedFontFamily(item, normalized);
  const baseFontSize = textFontSizeForUnit(unit) * (normalized.scale || 1) * textFontScale(item, normalized);
  const sourceLines = normalized.lines.length ? normalized.lines : [normalized.text];
  const formattedLines = sourceLines.map(formatTextLine);
  const sourceLineStyles = textLineStyles(normalized, sourceLines.length, resolvedFontStyle(item));
  const wrapped = wrapStyledSvgTextLines(sourceLines, formattedLines, sourceLineStyles, item.wrapWidth, unit, baseFontSize);
  const fontSize = fitFontSizeToBox(baseFontSize, item.fitBox, unit, wrapped.lines);
  const wrapWidth = Number(item.wrapWidth);
  const widthScale = plainTextBoundsWidthScale(item, rawFontFamily);
  const width = Number.isFinite(wrapWidth) && wrapWidth > 0
    ? wrapWidth
    : Math.max(
        ...wrapped.lines.map((line, index) => {
          const lineScale = (fontSize / textFontSizeForUnit(unit)) * (Number(wrapped.lineStyles[index]?.scale) || 1);
          const segments = wrapped.lineStyles[index]?.fontSegments || [];
          const measured = segments.length > 1
            ? segments.reduce(
                (sum, segment) => sum + texTextWidthCm(segment.text, lineScale * (Number(segment.scale) || 1)),
                0
              )
            : texTextWidthCm(line, lineScale);
          return measured * widthScale;
        }),
        0
      );
  const hasWrapWidth = Number.isFinite(wrapWidth) && wrapWidth > 0;
  const offsets = baselineOffsets(fontSize, wrapped.lineStyles, {
    compactMixedSize: hasWrapWidth,
    baselineSkipRatio: textBaselineSkipRatio(item)
  });
  const lineSizes = wrapped.lineStyles.map((style) => fontSize * (Number(style?.scale) || 1));
  const maxLineSize = Math.max(fontSize, ...lineSizes);
  const baselineRatio = textBaselineSkipRatio(item) || 1.15;
  const heightPx = offsets.length
    ? Math.max(...offsets) - Math.min(...offsets) + maxLineSize * (offsets.length > 1 ? baselineRatio : 1.15)
    : maxLineSize * baselineRatio;
  return {
    width: Math.max(0.08, width),
    height: Math.max(0.08, heightPx / unit)
  };
}

function renderLineFontSegments(sourceLine, formattedLine, lineStyle, lineFontSize, unit, renderSvgTextLineContent) {
  const segments = Array.isArray(lineStyle?.fontSegments) ? lineStyle.fontSegments : [];
  if (segments.length <= 1) return renderSvgTextLineContent(sourceLine, formattedLine, lineFontSize, unit);
  return segments
    .map((segment) => {
      const scale = Number(segment.scale) || 1;
      const size = lineFontSize * scale;
      const content = renderSvgTextLineContent(segment.text, segment.text, size, unit);
      return Math.abs(scale - 1) < 1e-9 ? content : `<tspan font-size="${format(size)}">${content}</tspan>`;
    })
    .join("");
}

function resolvedFontStyle(item = {}) {
  const font = item.font || {};
  return {
    ...(item.style || {}),
    fontWeight: item.style?.fontWeight || (font.weight && Number(font.weight) !== 400 ? font.weight : null),
    fontStyle: item.style?.fontStyle || (font.style && font.style !== "normal" ? font.style : null),
    fontVariant: item.style?.fontVariant || (font.variant && font.variant !== "normal" ? font.variant : null)
  };
}

function resolvedFontFamily(item = {}, normalized = {}) {
  const family = item.font?.family || item.style?.fontFamily || normalized.fontFamily;
  if (family === "sans-serif") return TIKZ_SANS_SERIF_FONT_FAMILY;
  if (family === "monospace") return TIKZ_MONOSPACE_FONT_FAMILY;
  if (!family || family === "serif") return TIKZ_FONT_FAMILY;
  return family;
}

function plainTextBoundsWidthScale(item, fontFamily) {
  return textWidthScale(item, fontFamily);
}
