import { TIKZ_FONT_FAMILY } from "../../tikz/metrics.js";
import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { textFontSizeForUnit } from "./layout.js";
import { renderPlainTextNode } from "./plainTextNode.js";
import {
  cleanRichTextSource,
  estimateRichTextBox,
  KATEX_RICH_TEXT_FONT_SCALE,
  KATEX_RICH_TEXT_LINE_BOX_SCALE,
  renderInlineMathHtml,
  richTextFallbackItem,
  richTextSourceLines,
  wrapRichTextLines
} from "./richText.js";
import {
  fontWeightAttribute,
  normalizedTextAlign,
  textFontScale,
  textLineStyles
} from "./textLayout.js";

export function renderRichTextNode(item, normalized, unit, deps = {}) {
  const fitFontSizeToBox = deps.fitFontSizeToBox || ((fontSize) => fontSize);
  const formatTextLine = deps.formatTextLine || String;
  const renderSvgTextLineContent = deps.renderSvgTextLineContent || ((_sourceLine, formattedLine) => formattedLine);
  const source = cleanRichTextSource(normalized.raw || normalized.text || "");
  const wrapWidth = Number(item.wrapWidth);
  const hasWrapWidth = Number.isFinite(wrapWidth) && wrapWidth > 0;
  const color = escapeAttribute(normalized.color || item.style?.fill || "black");
  const fontFamily = escapeAttribute(item.style?.fontFamily || normalized.fontFamily || TIKZ_FONT_FAMILY);
  const baseFontSize = textFontSizeForUnit(unit) * (normalized.scale || 1) * textFontScale(item, normalized);
  const sourceLines = richTextSourceLines(source, normalized);
  const sourceLineStyles = textLineStyles(normalized, sourceLines.length);
  const wrapped = hasWrapWidth
    ? wrapRichTextLines(sourceLines, wrapWidth, unit, baseFontSize, sourceLineStyles)
    : sourceLines.map((line, index) => ({ text: line, style: sourceLineStyles[index] || {} }));
  const lines = wrapped.length ? wrapped.map((line) => line.text) : [normalized.text || ""];
  const lineStyles = wrapped.length ? wrapped.map((line) => line.style || {}) : textLineStyles(normalized, lines.length);
  const fontSize = fitRichFontSizeToBox(baseFontSize, item.fitBox, unit, lines, lineStyles, { formatTextLine });
  const displayFontSize = hasWrapWidth ? fontSize * KATEX_RICH_TEXT_FONT_SCALE : fontSize;
  const box = estimateRichTextBox(lines, displayFontSize, lineStyles);
  const width = hasWrapWidth ? wrapWidth * unit : box.width;
  const align = item.textAlign ? normalizedTextAlign(item.textAlign) : hasWrapWidth ? "left" : "center";
  const alignItems = align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start";
  const fallback = renderPlainTextNode(richTextFallbackItem(item, align, hasWrapWidth), normalized, unit, {
    fitFontSizeToBox,
    formatTextLine,
    renderSvgTextLineContent
  });
  const x = item.x * unit - width / 2;
  const y = -item.y * unit - box.height / 2;
  const htmlLines = lines
    .map((line, index) => {
      const lineStyle = lineStyles[index] || {};
      const lineFontSize = displayFontSize * (lineStyle.scale || 1);
      return `<div class="tikz-rich-line"${fontWeightAttribute(lineStyle)} style="font-size:${format(
        lineFontSize
      )}px;width:100%;">${renderInlineMathHtml(line)}</div>`;
    })
    .join("");
  const foreignObject = `<foreignObject requiredExtensions="http://www.w3.org/1999/xhtml" x="${format(x)}" y="${format(
    y
  )}" width="${format(width)}" height="${format(
    box.height
  )}"><div xmlns="http://www.w3.org/1999/xhtml" class="tikz-rich-text" style="width:${format(
    width
  )}px;height:${format(
    box.height
  )}px;color:${color};font-size:${format(
    displayFontSize
  )}px;line-height:${format(
    KATEX_RICH_TEXT_LINE_BOX_SCALE
  )};display:flex;flex-direction:column;align-items:${alignItems};justify-content:center;text-align:${align};white-space:nowrap;overflow:visible;font-family:${fontFamily};">${htmlLines}</div></foreignObject>`;
  return `<switch>${foreignObject}${fallback}</switch>`;
}

export function estimateRichTextRenderBounds(item, normalized, unit, deps = {}) {
  const formatTextLine = deps.formatTextLine || String;
  const source = cleanRichTextSource(normalized.raw || normalized.text || "");
  const wrapWidth = Number(item.wrapWidth);
  const hasWrapWidth = Number.isFinite(wrapWidth) && wrapWidth > 0;
  const baseFontSize = textFontSizeForUnit(unit) * (normalized.scale || 1) * textFontScale(item, normalized);
  const sourceLines = richTextSourceLines(source, normalized);
  const sourceLineStyles = textLineStyles(normalized, sourceLines.length);
  const wrapped = hasWrapWidth
    ? wrapRichTextLines(sourceLines, wrapWidth, unit, baseFontSize, sourceLineStyles)
    : sourceLines.map((line, index) => ({ text: line, style: sourceLineStyles[index] || {} }));
  const lines = wrapped.length ? wrapped.map((line) => line.text) : [normalized.text || ""];
  const lineStyles = wrapped.length ? wrapped.map((line) => line.style || {}) : textLineStyles(normalized, lines.length);
  const fontSize = fitRichFontSizeToBox(baseFontSize, item.fitBox, unit, lines, lineStyles, { formatTextLine });
  const displayFontSize = hasWrapWidth ? fontSize * KATEX_RICH_TEXT_FONT_SCALE : fontSize;
  const box = estimateRichTextBox(lines, displayFontSize, lineStyles);
  const widthPx = hasWrapWidth ? wrapWidth * unit : box.width;
  return {
    width: Math.max(0.08, widthPx / unit),
    height: Math.max(0.08, box.height / unit)
  };
}

export function fitRichFontSizeToBox(baseFontSize, fitBox, unit, lines = [""], lineStyles = [], deps = {}) {
  if (!fitBox) return baseFontSize;
  const boxWidth = Number(fitBox.width) * unit;
  const boxHeight = Number(fitBox.height) * unit;
  if (!Number.isFinite(boxWidth) || !Number.isFinite(boxHeight) || boxWidth <= 0 || boxHeight <= 0) return baseFontSize;

  const formatTextLine = deps.formatTextLine || String;
  const weightedHeight = Math.max(
    1,
    lineStyles.reduce((sum, style) => sum + (Number(style?.scale) || 1), 0) || lines.length
  );
  const widthDemand = Math.max(
    1,
    ...lines.map((line, index) => {
      const scale = Number(lineStyles[index]?.scale) || 1;
      return String(formatTextLine(line) || "").trim().length * scale;
    })
  );
  const heightLimit = (boxHeight * 0.82) / weightedHeight;
  const widthLimit = boxWidth / (widthDemand * 0.58);
  return Math.max(6, Math.min(baseFontSize, heightLimit, widthLimit));
}
