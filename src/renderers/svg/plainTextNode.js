import { measurePlainTextTeXBoxPt, parseMathText, texTextWidthCm } from "../../tikz/textMetrics.js";
import { TIKZ_FONT_FAMILY } from "../../tikz/metrics.js";
import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { textFontSizeForUnit } from "./layout.js";
import { hasTextColorSegments, renderSegmentedTextNode } from "./segmentedText.js";
import {
  renderFontFamilyForStyle,
  resolvedFontFamily,
  resolvedFontStyle,
  usesDedicatedSmallCapsFace
} from "./fontFamilies.js";
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
  const fontFallback = resolvedFontStyle(item);
  const rawFontVariant = normalized.fontVariant || item.style?.fontVariant || fontFallback.fontVariant;
  const rootFontStyle = { ...fontFallback, fontVariant: rawFontVariant };
  const fontFamily = escapeAttribute(renderFontFamilyForStyle(rawFontFamily, rootFontStyle));
  const baseFontSize = textFontSizeForUnit(unit) * (normalized.scale || 1) * textFontScale(item, normalized);
  const sourceLines = normalized.lines.length ? normalized.lines : [normalized.text];
  const formattedLines = sourceLines.map(formatTextLine);
  const sourceLineStyles = textLineStyles(normalized, sourceLines.length, fontFallback);
  const wrappedText = wrapStyledSvgTextLines(
    sourceLines,
    formattedLines,
    sourceLineStyles,
    item.wrapWidth,
    unit,
    baseFontSize,
    { lineBreakMode: item.textWrapMode, hyphenate: item.textWrapHyphenation }
  );
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
  const y = format(-item.y * unit + plainTextVisualCenterOffset(item, unit));
  const widthScale = textWidthScale(item, rawFontFamily);
  const textFontVariant = usesDedicatedSmallCapsFace(rawFontFamily, rootFontStyle)
    ? ""
    : fontVariantAttribute({ fontVariant: rawFontVariant });
  if (lines.length <= 1) {
    const lineStyle = lineStyles[0] || {};
    const lineFontSize = fontSize * (lineStyle.scale || 1) * mathOnlyGlyphFontScale(contentLines[0]);
    const lineVariant = lineStyle.fontVariant || rawFontVariant;
    const lineRenderStyle = { ...lineStyle, fontVariant: lineVariant };
    const lineFontFamily = escapeAttribute(renderFontFamilyForStyle(lineStyle.fontFamily || rawFontFamily, lineRenderStyle));
    const content = renderLineFontSegments(
      contentLines[0],
      lines[0] || "",
      lineStyle,
      lineFontSize,
      unit,
      renderSvgTextLineContent,
      rawFontFamily,
      rawFontVariant
    );
    const lineFontStyle = fontStyleAttribute(lineStyle) || mathLineFontStyleAttribute(contentLines[0]);
    const lineFontVariant = usesDedicatedSmallCapsFace(lineStyle.fontFamily || rawFontFamily, lineRenderStyle)
      ? ""
      : fontVariantAttribute(lineStyle) || textFontVariant;
    const text = `<text x="${x}" y="${y}" fill="${color}" text-anchor="${textAnchor}" dominant-baseline="middle" xml:space="preserve" font-size="${format(
      lineFontSize
    )}"${fontWeightAttribute(lineStyle)}${lineFontStyle}${lineFontVariant} font-family="${lineFontFamily}">${content}</text>`;
    return wrapTypewriterWidth(text, item, unit, widthScale);
  }
  const lineOffsets = baselineOffsets(fontSize, lineStyles, {
    compactMixedSize: hasWrapWidth,
    baselineSkipRatio: textBaselineSkipRatio(item),
    baseFontSizePt: item.font?.sizePt,
    baseBaselineSkipPt: item.font?.baselineSkipPt,
    useLineFontBaselines: lineStyles.some((style) => Number(style?.baselineSkipPt) > 0),
    // TikZ packs `text width` nodes in a minipage. A scoped declaration such
    // as `{\small ...}` changes glyph size but keeps the paragraph baseline grid.
    forceBaseBaseline: hasWrapWidth
  });
  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? lineOffsets[0] : lineOffsets[index] - lineOffsets[index - 1];
      const lineStyle = lineStyles[index] || {};
      const lineFontSize = fontSize * (lineStyle.scale || 1);
      const lineVariant = lineStyle.fontVariant || rawFontVariant;
      const lineRenderStyle = { ...lineStyle, fontVariant: lineVariant };
      return `<tspan x="${x}" dy="${format(dy)}"${lineFontAttributes(lineStyle, fontSize, contentLines[index], {
        omitFontVariant: usesDedicatedSmallCapsFace(lineStyle.fontFamily || rawFontFamily, lineRenderStyle)
      })}${lineFontFamilyAttribute(
        lineStyle,
        rawFontFamily,
        rawFontVariant
      )}>${renderLineFontSegments(
        contentLines[index],
        line,
        lineStyle,
        lineFontSize,
        unit,
        renderSvgTextLineContent,
        rawFontFamily,
        rawFontVariant
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
  const explicitTextAnchor = svgTextAnchorForItem(item);
  const align = explicitTextAnchor === "start"
    ? "left"
    : explicitTextAnchor === "end"
      ? "right"
      : item.textAlign
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
      lineBreakMode: item.textWrapMode,
      hyphenate: item.textWrapHyphenation,
      color: normalized.color || item.style?.fill || "black",
      textWidthScale: item.style?.textWidthScale,
      textWidthScaleExplicit: item.style?.textWidthScaleExplicit
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
  const verticalOffset = plainTextVisualCenterOffset(item, unit);
  const horizontalOffset = cachedPlainTextHorizontalOffset(item, align, payload);
  const x = svgTextAnchorForItem(item) ? svgTextAnchorX(item, unit) : item.x * unit;
  return `<g class="tikz-text-engine-cache" transform="translate(${format(x + horizontalOffset)} ${format(-item.y * unit + verticalOffset)})">${payload.body}</g>`;
}

function cachedPlainTextHorizontalOffset(item, align, payload) {
  if (svgTextAnchorForItem(item)) return 0;
  const wrapWidth = Number(item.wrapWidth);
  if (Number.isFinite(wrapWidth) && wrapWidth > 0) return 0;
  const width = Number(payload?.viewBox?.width);
  if (!Number.isFinite(width) || width <= 0) return 0;
  if (align === "left") return -width / 2;
  if (align === "right") return width / 2;
  return 0;
}

function plainTextVisualCenterOffset(item, unit) {
  if (!item.texBoxVerticalAlign) return 0;
  // SVG's `middle` baseline already performs most of TeX's baseline shift.
  // KaTeX_Typewriter needs only this residual optical correction; applying
  // the full TeX height/depth offset moves glyphs against the bottom border.
  const fontSizePt = Number(item.font?.sizePt) || 10;
  return (fontSizePt * 0.08 / TEX_PT_PER_CM) * unit;
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
  const wrapped = wrapStyledSvgTextLines(
    sourceLines,
    formattedLines,
    sourceLineStyles,
    item.wrapWidth,
    unit,
    baseFontSize,
    { lineBreakMode: item.textWrapMode, hyphenate: item.textWrapHyphenation }
  );
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
                (sum, segment) => sum + styledTextWidthCm(
                  segment.text,
                  lineScale * (Number(segment.scale) || 1),
                  segment.variant || wrapped.lineStyles[index]?.fontVariant
                ),
                0
              )
            : styledTextWidthCm(line, lineScale, wrapped.lineStyles[index]?.fontVariant);
          return measured * widthScale;
        }),
        0
      );
  const hasWrapWidth = Number.isFinite(wrapWidth) && wrapWidth > 0;
  const offsets = baselineOffsets(fontSize, wrapped.lineStyles, {
    compactMixedSize: hasWrapWidth,
    baselineSkipRatio: textBaselineSkipRatio(item),
    baseFontSizePt: item.font?.sizePt,
    baseBaselineSkipPt: item.font?.baselineSkipPt,
    useLineFontBaselines: wrapped.lineStyles.some((style) => Number(style?.baselineSkipPt) > 0),
    forceBaseBaseline: hasWrapWidth
  });
  const lineSizes = wrapped.lineStyles.map((style) => fontSize * (Number(style?.scale) || 1));
  const maxLineSize = Math.max(fontSize, ...lineSizes);
  const baselineRatio = textBaselineSkipRatio(item) || 1.15;
  const measuredHeightPx = measuredWrappedTextHeightPx(wrapped.lines, lineSizes, offsets, unit);
  const heightPx = Number.isFinite(measuredHeightPx)
    ? measuredHeightPx
    : offsets.length
    ? Math.max(...offsets) - Math.min(...offsets) + maxLineSize * (offsets.length > 1 ? baselineRatio : 1.15)
    : maxLineSize * baselineRatio;
  return {
    width: Math.max(0.08, width),
    height: Math.max(0.08, heightPx / unit)
  };
}

function measuredWrappedTextHeightPx(lines, lineSizes, offsets, unit) {
  if (!Array.isArray(lines) || !lines.length || !Array.isArray(offsets) || offsets.length !== lines.length) return NaN;
  let top = Infinity;
  let bottom = -Infinity;
  for (let index = 0; index < lines.length; index += 1) {
    const sizePx = Number(lineSizes[index]);
    const fontSizePt = (sizePx / unit) * TEX_PT_PER_CM;
    const box = measurePlainTextTeXBoxPt(lines[index], { fontSizePt });
    if (!box) return NaN;
    const heightPx = (box.height / TEX_PT_PER_CM) * unit;
    const depthPx = (box.depth / TEX_PT_PER_CM) * unit;
    top = Math.min(top, offsets[index] - heightPx);
    bottom = Math.max(bottom, offsets[index] + depthPx);
  }
  return Number.isFinite(top) && Number.isFinite(bottom) ? Math.max(0, bottom - top) : NaN;
}

function styledTextWidthCm(text, scale, fontVariant) {
  if (fontVariant !== "small-caps") return texTextWidthCm(text, scale);
  const box = measurePlainTextTeXBoxPt(text, { fontSizePt: 10 * scale, fontVariant });
  return box ? box.width / TEX_PT_PER_CM : texTextWidthCm(text, scale);
}

function renderLineFontSegments(
  sourceLine,
  formattedLine,
  lineStyle,
  lineFontSize,
  unit,
  renderSvgTextLineContent,
  parentFamily,
  parentVariant = null
) {
  const segments = Array.isArray(lineStyle?.fontSegments) ? lineStyle.fontSegments : [];
  if (!segments.length) return renderSvgTextLineContent(sourceLine, formattedLine, lineFontSize, unit);
  if (segments.length === 1 && !segmentFontAttributes(segments[0], lineStyle, lineFontSize, 1, parentFamily, parentVariant)) {
    return renderSvgTextLineContent(sourceLine, formattedLine, lineFontSize, unit);
  }
  return segments
    .map((segment) => {
      const scale = Number(segment.scale) || 1;
      const size = lineFontSize * scale;
      const content = renderSvgTextLineContent(segment.text, segment.text, size, unit);
      const attributes = segmentFontAttributes(segment, lineStyle, size, scale, parentFamily, parentVariant);
      return attributes ? `<tspan${attributes}>${content}</tspan>` : content;
    })
    .join("");
}

function segmentFontAttributes(segment, lineStyle, size, scale, parentFamily, parentVariant = null) {
  let attributes = Math.abs(scale - 1) < 1e-9 ? "" : ` font-size="${format(size)}"`;
  const inheritedVariant = lineStyle.fontVariant || parentVariant;
  const segmentVariant = segment.variant || inheritedVariant;
  const segmentStyle = {
    fontWeight: segment.weight ?? lineStyle.fontWeight,
    fontStyle: segment.style || lineStyle.fontStyle,
    fontVariant: segmentVariant
  };
  const inheritedStyle = { ...lineStyle, fontVariant: inheritedVariant };
  const segmentFamily = renderFontFamilyForStyle(segment.family || parentFamily, segmentStyle);
  const inheritedFamily = renderFontFamilyForStyle(parentFamily, inheritedStyle);
  if (!sameFontProperty(segmentFamily, inheritedFamily)) {
    attributes += ` font-family="${escapeAttribute(segmentFamily)}"`;
  }
  if (segment.weight !== null && segment.weight !== undefined && !sameFontProperty(segment.weight, lineStyle.fontWeight)) {
    attributes += ` font-weight="${escapeAttribute(String(segment.weight))}"`;
  }
  if (segment.style && !sameFontProperty(segment.style, lineStyle.fontStyle)) {
    attributes += ` font-style="${escapeAttribute(segment.style)}"`;
  }
  if (
    segment.variant &&
    !sameFontProperty(segment.variant, inheritedVariant) &&
    !usesDedicatedSmallCapsFace(segment.family || parentFamily, segmentStyle)
  ) {
    attributes += ` font-variant="${escapeAttribute(segment.variant)}"`;
  }
  return attributes;
}

function sameFontProperty(first, second) {
  return String(first ?? "") === String(second ?? "");
}

function lineFontFamilyAttribute(lineStyle, parentFamily, parentVariant = null) {
  const variant = lineStyle.fontVariant || parentVariant;
  const family = renderFontFamilyForStyle(lineStyle.fontFamily || parentFamily, { ...lineStyle, fontVariant: variant });
  const parent = renderFontFamilyForStyle(parentFamily, { fontVariant: parentVariant });
  return family === parent ? "" : ` font-family="${escapeAttribute(family)}"`;
}

function plainTextBoundsWidthScale(item, fontFamily) {
  return textWidthScale(item, fontFamily);
}
