import { estimateFormulaBox, formulaTotalHeight } from "../../tikz/textMetrics.js";
import { mathFallbackText } from "../../tikz/text.js";
import { createFontSpec } from "../../tex/fontSpec.js";
import {
  TIKZ_DISPLAY_MATH_FONT_SIZE,
  TIKZ_FONT_FAMILY,
  TIKZ_MATH_CALLIGRAPHIC_FONT_FAMILY,
  TIKZ_MATH_ITALIC_FONT_FAMILY,
  TIKZ_SANS_SERIF_FONT_FAMILY,
  TIKZ_TEXT_FONT_SIZE
} from "../../tikz/metrics.js";
import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { renderUnitScale } from "./layout.js";
import {
  mathFallbackFontStyle,
  mathFallbackFontWeight,
  normalizeKatexTex
} from "./mathFallbackSyntax.js";
import {
  inlineFractionFallback,
  renderFractionMathFallback,
  renderInlineFractionMathFallback,
  simpleFractionFallback
} from "./mathFractionFallback.js";
import { coloredMathTextFallback, renderColoredMathTextFallback } from "./mathColorFallback.js";
import { extensibleMathArrowFallback, renderExtensibleMathArrowFallback } from "./mathArrowFallback.js";
import {
  renderSimpleMathGlyphFallback,
  renderSimpleMathGlyphFormulaFallback,
  simpleMathGlyphFallback,
  simpleMathGlyphFormulaFallback,
  simpleMathGlyphRenderBox
} from "./mathGlyphFallback.js";
import { renderScopedMathHtml } from "./mathHtml.js";
import { inlineMatrixMathFallback, renderInlineMatrixMathFallback } from "./mathMatrixFallback.js";
import { niceFractionMathFallback, renderNiceFractionMathFallback } from "./mathNiceFractionFallback.js";
import {
  hatAccentSubscriptFallback,
  mixedAlphabeticSubscriptFallback,
  renderHatSubscriptMathFallback,
  renderMathOperatorSpacedText,
  renderMathTextWithUprightOperators,
  renderMixedSubscriptMathFallback,
  renderScriptedSegmentsContent,
  renderScriptedMathFallback,
  renderSimpleSubscriptMathFallback,
  scriptedMathFallback,
  simpleNumericSubscriptFallback,
  styledScriptedMathFallback,
  texNeedsOperatorSpacing
} from "./mathScriptFallback.js";
import { renderSumLimitsInlineFallback, sumLimitsInlineFallback } from "./mathSumFallback.js";
import { svgTextAnchorPoint, textFontScale } from "./textLayout.js";
import { renderTensorMatrixFallback, tensorMatrixFallbackParts } from "./tensorMatrixFallback.js";

const KATEX_ROOT_FONT_SCALE = 1.21;
const KATEX_INLINE_LINE_BOX_SCALE = 1.1;
const KATEX_INLINE_COMPLEX_LINE_BOX_SCALE = 1.28;
const KATEX_DISPLAY_LINE_BOX_SCALE = 1.62;
const KATEX_INLINE_WIDTH_PAD_EM = 1.7;
const KATEX_INLINE_MATRIX_WIDTH_PAD_EM = 0.38;
const KATEX_INLINE_COMPACT_WIDTH_PAD_EM = 0.85;
const KATEX_DISPLAY_WIDTH_PAD_EM = 0.9;
const KATEX_COMPLEX_INLINE_WIDTH_RATIO = 2;
const TEX_PT_PER_CM = 28.4527559;
// amsmath's \spread@equation performs \openup\jot. At the default 10pt
// size that is the 12pt baseline skip plus a 3pt \jot, i.e. 1.5em.
const AMSMATH_ALIGN_ROW_BASELINE_FACTOR = 1.5;

export function measureMathBoxPt(tex, options = {}) {
  const source = normalizeKatexTex(tex);
  const font = createFontSpec(options.font || {});
  const mathVersion = options.mathVersion === "bold" || font.mathVersion === "bold" ? "bold" : "normal";
  const displayMode = Boolean(options.displayMode);
  const extraScale = finitePositiveScale(options.scale);
  const baseMathSizePt = font.sizePt * extraScale;
  const scale = (font.sizePt / 10) * extraScale * mathStyleScale(source, baseMathSizePt);
  const rawBox = estimateMathBox(source, displayMode, TEX_PT_PER_CM, scale, { mathVersion });
  const glyphBox = simpleMathGlyphRenderBox(simpleMathGlyphFallback(source), rawBox);
  const paintBox = glyphBox || rawBox;
  const formula = estimateFormulaBox(source, {
    displayMode,
    scale,
    minWidth: displayMode ? undefined : 0.08,
    widthPadding: displayMode ? undefined : 0.08,
    texTextMetrics: !displayMode,
    mathVersion
  });
  const formulaHeightPt = Math.max(0, Number(formula.height) || 0) * TEX_PT_PER_CM;
  const formulaDepthPt = Math.max(0, Number(formula.depth) || 0) * TEX_PT_PER_CM;
  const formulaTotalPt = formulaHeightPt + formulaDepthPt;
  const extraHeightPt = Math.max(0, rawBox.height - formulaTotalPt);
  const heightPt = formulaHeightPt + extraHeightPt / 2;
  const depthPt = formulaDepthPt + extraHeightPt / 2;
  return {
    widthPt: rawBox.width,
    heightPt,
    depthPt,
    baselinePt: heightPt,
    paintWidthPt: paintBox.width,
    paintHeightPt: paintBox.height,
    fontSizePt: font.sizePt,
    svgFontSize: rawBox.fontSize,
    rawWidthPt: rawBox.width,
    rawHeightPt: rawBox.height,
    mathVersion,
    displayMode,
    renderer: options.renderer || "katex"
  };
}

export function renderMathNode(item, math, unit, options = {}, deps = {}) {
  const fitFontSizeToBox = deps.fitFontSizeToBox || ((fontSize) => fontSize);
  const tex = normalizeKatexTex(math.tex);
  const mathVersion = item?.font?.mathVersion === "bold" ? "bold" : "normal";
  const contentScale = (math.scale || 1) * textFontScale(item, math);
  const styleScale = mathStyleScale(tex, 10 * contentScale);
  const box = estimateMathBox(tex, math.displayMode, unit, contentScale * styleScale, { mathVersion });
  const originalFontSize = box.fontSize;
  box.fontSize = fitFontSizeToBox(box.fontSize, item.fitBox, unit, [mathFitText(tex)]);
  const fitScale = originalFontSize > 0 ? box.fontSize / originalFontSize : 1;
  const fittedBox = estimateMathBox(tex, math.displayMode, unit, contentScale * fitScale * styleScale, {
    mathVersion
  });
  const htmlBox = scopedMathForeignObjectBox(fittedBox, math.displayMode, tex);
  const wrapWidth = Number(item.wrapWidth) * unit;
  if (math.displayMode && Number.isFinite(wrapWidth) && wrapWidth > 0) {
    htmlBox.width = Math.max(htmlBox.width, wrapWidth);
  }
  const htmlAnchor = svgTextAnchorPoint(item, unit);
  const htmlJustifyContent = mathHtmlJustifyContent(htmlAnchor.anchor);
  const x = htmlAnchor.anchor === "start"
    ? htmlAnchor.x
    : htmlAnchor.anchor === "end"
      ? htmlAnchor.x - htmlBox.width
      : htmlAnchor.x - htmlBox.width / 2;
  const y = htmlAnchor.y - htmlBox.height / 2;
  const color = escapeAttribute(math.color || item.style?.fill || "black");
  const fontStyle = mathFallbackFontStyle(tex);
  const fontWeight = math.fontWeight || (mathVersion === "bold" ? "700" : mathFallbackFontWeight(tex));
  const fallbackFontFamily = mathFallbackFontFamily(item);
  const useSansMathFallback = fallbackFontFamily === TIKZ_SANS_SERIF_FONT_FAMILY;
  const fallbackFontSize = box.fontSize * mathGlyphFallbackFontScale(tex);
  const fallbackText = mathFallbackText(tex);
  const switchFallbackFontSize =
    options.mathRenderer === "svg-text"
      ? fallbackFontSize
      : fitSwitchFallbackFontSize(fallbackText, fallbackFontSize, htmlBox.width, htmlBox.height);
  const relationTextLength = texNeedsOperatorSpacing(tex) && !math.displayMode
    ? estimateFormulaBox(tex, {
        scale: contentScale * fitScale * mathStyleScale(tex),
        minWidth: 0.08,
        widthPadding: 0,
        texTextMetrics: true,
        mathVersion
      }).width * unit
    : null;
  const relationTextLengthAttrs = Number.isFinite(relationTextLength)
    ? ` textLength="${format(relationTextLength)}" lengthAdjust="spacingAndGlyphs"`
    : "";
  const fallbackContent = renderCalligraphicMathFallback(tex, switchFallbackFontSize) || (
    texNeedsOperatorSpacing(tex)
      ? renderMathOperatorSpacedText(fallbackText, switchFallbackFontSize)
      : renderMathTextWithUprightOperators(fallbackText)
  );
  const fallbackAnchor = htmlAnchor;
  const plainFallback = `<text x="${format(fallbackAnchor.x)}" y="${format(fallbackAnchor.y)}" fill="${color}" text-anchor="${fallbackAnchor.anchor}" dominant-baseline="middle" font-size="${format(
    switchFallbackFontSize
  )}"${relationTextLengthAttrs} font-style="italic"${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(
    fallbackFontFamily
  )}">${fallbackContent}</text>`;
  const alignedRows = parseAlignedMathRows(tex);
  if (alignedRows && options.mathRenderer === "svg-text") {
    return renderAlignedMathFallback(item, alignedRows, fallbackFontSize, unit, color, fontWeight);
  }
  const extensibleArrow = extensibleMathArrowFallback(tex);
  if (extensibleArrow && options.mathRenderer === "svg-text") {
    return renderExtensibleMathArrowFallback(item, tex, extensibleArrow, fallbackFontSize, unit, color, fontWeight);
  }
  const niceFractionFallback = niceFractionMathFallback(tex);
  if (niceFractionFallback && options.mathRenderer === "svg-text") {
    return renderNiceFractionMathFallback(item, niceFractionFallback, fallbackFontSize, unit, color, fontWeight);
  }
  const glyphFallback = simpleMathGlyphFallback(tex);
  const glyphFormulaFallback = simpleMathGlyphFormulaFallback(tex);
  if (glyphFormulaFallback && options.mathRenderer === "svg-text" && !useSansMathFallback && !fontWeight) {
    return renderSimpleMathGlyphFormulaFallback(item, glyphFormulaFallback, fallbackFontSize, unit, color);
  }
  if (glyphFallback && options.mathRenderer === "svg-text" && !useSansMathFallback && !fontWeight) {
    return renderSimpleMathGlyphFallback(item, glyphFallback, fallbackFontSize, unit, color);
  }
  const fractionFallback = simpleFractionFallback(tex);
  if (fractionFallback && options.mathRenderer === "svg-text") {
    return renderFractionMathFallback(item, fractionFallback, fallbackFontSize, unit, color, fontStyle, fontWeight);
  }
  const compoundFractionFallback = inlineFractionFallback(tex);
  if (compoundFractionFallback && options.mathRenderer === "svg-text") {
    return renderInlineFractionMathFallback(item, compoundFractionFallback, fallbackFontSize, unit, color, fontStyle, fontWeight);
  }
  if (options.mathRenderer === "svg-text" && /\\(?:frac|dfrac|tfrac)\s*\{/.test(tex)) {
    return plainFallback;
  }
  const sumLimitsFallback = sumLimitsInlineFallback(tex);
  if (sumLimitsFallback && options.mathRenderer === "svg-text") {
    return renderSumLimitsInlineFallback(item, sumLimitsFallback, fallbackFontSize, unit, color, fontStyle, fontWeight);
  }
  const tensorMatrixFallback = tensorMatrixFallbackParts(tex);
  if (tensorMatrixFallback && options.mathRenderer === "svg-text") {
    return renderTensorMatrixFallback(item, tensorMatrixFallback, box.fontSize, unit, color);
  }
  const inlineMatrixFallback = inlineMatrixMathFallback(tex);
  if (inlineMatrixFallback && options.mathRenderer === "svg-text") {
    return renderInlineMatrixMathFallback(item, inlineMatrixFallback, fallbackFontSize, unit, color, fontStyle, fontWeight);
  }
  const coloredMathFallback = coloredMathTextFallback(tex);
  if (coloredMathFallback && options.mathRenderer === "svg-text") {
    return renderColoredMathTextFallback(item, coloredMathFallback, fallbackFontSize, unit, color, fontStyle, fontWeight);
  }
  const hatSubscriptFallback = hatAccentSubscriptFallback(tex);
  if (hatSubscriptFallback && options.mathRenderer === "svg-text") {
    return renderHatSubscriptMathFallback(item, hatSubscriptFallback, fallbackFontSize, unit, color, fontStyle, fontWeight);
  }
  const subscriptFallback = simpleNumericSubscriptFallback(tex);
  if (subscriptFallback && options.mathRenderer === "svg-text") {
    return renderSimpleSubscriptMathFallback(item, subscriptFallback, fallbackFontSize, unit, color, fontStyle, fontWeight);
  }
  const scriptedFallback = scriptedMathFallback(tex, { allowSimpleScripts: texNeedsOperatorSpacing(tex) });
  if (scriptedFallback && options.mathRenderer === "svg-text") {
    return renderScriptedMathFallback(item, scriptedFallback, fallbackFontSize, unit, color, fontStyle, fontWeight);
  }
  const styledScriptFallback = styledScriptedMathFallback(tex);
  if (styledScriptFallback && options.mathRenderer === "svg-text") {
    return renderScriptedMathFallback(item, styledScriptFallback, fallbackFontSize, unit, color, fontStyle, fontWeight);
  }
  const mixedSubscriptFallback = mixedAlphabeticSubscriptFallback(tex);
  if (mixedSubscriptFallback && options.mathRenderer === "svg-text") {
    return renderMixedSubscriptMathFallback(item, mixedSubscriptFallback, fallbackFontSize, unit, color, fontStyle, fontWeight);
  }
  if (options.mathRenderer === "svg-text") return plainFallback;

  const html = renderScopedMathHtml(mathTexForVersion(tex, mathVersion), {
    displayMode: math.displayMode
  });
  const switchFallback =
    inlineMatrixFallback
      ? renderInlineMatrixMathFallback(item, inlineMatrixFallback, fallbackFontSize, unit, color, fontStyle, fontWeight)
      : subscriptFallback
        ? renderSimpleSubscriptMathFallback(item, subscriptFallback, fallbackFontSize, unit, color, fontStyle, fontWeight)
        : mixedSubscriptFallback
          ? renderMixedSubscriptMathFallback(item, mixedSubscriptFallback, fallbackFontSize, unit, color, fontStyle, fontWeight)
          : plainFallback;
  const foreignObject = `<foreignObject requiredExtensions="http://www.w3.org/1999/xhtml" x="${format(x)}" y="${format(
    y
  )}" width="${format(htmlBox.width)}" height="${format(
    htmlBox.height
  )}"><div xmlns="http://www.w3.org/1999/xhtml" class="tikz-math${
    math.displayMode ? " display" : ""
  }" style="width:${format(htmlBox.width)}px;height:${format(
    htmlBox.height
  )}px;color:${color};font-size:${format(
    scopedMathHostFontSize(box.fontSize)
  )}px;line-height:1;display:flex;align-items:center;justify-content:${htmlJustifyContent};overflow:visible;white-space:nowrap;font-family:${escapeAttribute(
    TIKZ_FONT_FAMILY
  )};">${html}</div></foreignObject>`;
  return `<switch>${foreignObject}${switchFallback}</switch>`;
}

function parseAlignedMathRows(tex) {
  const match = String(tex || "").trim().match(/^\\begin\s*\{(?:aligned|alignedat\*?)\}([\s\S]*)\\end\s*\{(?:aligned|alignedat\*?)\}$/);
  if (!match) return null;
  return splitAlignedMath(match[1], "row")
    .map((row) => splitAlignedMath(row, "column"))
    .filter((row) => row.some((cell) => cell.trim()));
}

function splitAlignedMath(source, mode) {
  const text = String(source || "");
  const parts = [];
  let current = "";
  let braceDepth = 0;
  let environmentDepth = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text.startsWith("\\begin{", index)) environmentDepth += 1;
    if (text.startsWith("\\end{", index)) environmentDepth = Math.max(0, environmentDepth - 1);
    const char = text[index];
    if (char === "{" && (index === 0 || text[index - 1] !== "\\")) braceDepth += 1;
    if (char === "}" && (index === 0 || text[index - 1] !== "\\")) braceDepth = Math.max(0, braceDepth - 1);
    const topLevel = braceDepth === 0 && environmentDepth === 0;
    if (mode === "row" && topLevel && char === "\\" && text[index + 1] === "\\") {
      parts.push(current);
      current = "";
      index += 1;
      continue;
    }
    if (mode === "column" && topLevel && char === "&") {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
}

function renderAlignedMathFallback(item, rows, fontSize, unit, color, fontWeight) {
  const anchor = svgTextAnchorPoint(item, unit);
  const normalizedRows = rows.map((row) => [row[0] || "", row.slice(1).join("&")]);
  const leftWidth = Math.max(...normalizedRows.map((row) => estimateAlignedCellWidth(row[0], fontSize)), 0);
  const rightWidth = Math.max(...normalizedRows.map((row) => estimateAlignedCellWidth(row[1], fontSize)), 0);
  const gap = fontSize * 0.22;
  const totalWidth = leftWidth + gap + rightWidth;
  const startX =
    anchor.anchor === "start"
      ? anchor.x
      : anchor.anchor === "end"
        ? anchor.x - totalWidth
        : anchor.x - totalWidth / 2;
  const alignX = startX + leftWidth;
  const lineHeight = fontSize * AMSMATH_ALIGN_ROW_BASELINE_FACTOR;
  const firstY = anchor.y - ((normalizedRows.length - 1) * lineHeight) / 2;
  const common = `fill="${color}" dominant-baseline="middle" font-size="${format(fontSize)}" font-style="italic"${
    fontWeight ? ` font-weight="${fontWeight}"` : ""
  } font-family="${escapeAttribute(TIKZ_MATH_ITALIC_FONT_FAMILY)}"`;
  return `<g class="tikz-math-aligned-fallback">${normalizedRows
    .map((row, index) => {
      const y = firstY + index * lineHeight;
      const left = renderAlignedMathCell(row[0], fontSize);
      const right = renderAlignedMathCell(row[1], fontSize);
      return `<text x="${format(alignX - gap / 2)}" y="${format(y)}" text-anchor="end" ${common}>${left}</text><text x="${format(
        alignX + gap / 2
      )}" y="${format(y)}" text-anchor="start" ${common}>${right}</text>`;
    })
    .join("")}</g>`;
}

function renderAlignedMathCell(tex, fontSize) {
  const scoped = renderScopedAlignedColors(String(tex || ""), fontSize);
  if (scoped !== null) return scoped;
  const scripted = scriptedMathFallback(tex, { allowSimpleScripts: true });
  if (scripted) return renderScriptedSegmentsContent(scripted, fontSize);
  return renderMathTextWithUprightOperators(mathFallbackText(tex));
}

function renderCalligraphicMathFallback(tex, fontSize) {
  const calligraphicSegments = [];
  const marked = String(tex || "").replace(
    /\\mathcal\s*(?:\{([^{}]*)\}|([A-Za-z]))/g,
    (_match, grouped, ungrouped) => {
      const index = calligraphicSegments.push(grouped ?? ungrouped ?? "") - 1;
      return `\uE000${index}\uE001`;
    }
  );
  if (!calligraphicSegments.length) return "";

  const fallback = mathFallbackText(marked);
  const markerPattern = /\uE000(\d+)\uE001/g;
  let output = "";
  let cursor = 0;
  let match;
  while ((match = markerPattern.exec(fallback))) {
    output += renderOrdinaryMathFallbackSegment(fallback.slice(cursor, match.index), fontSize);
    const calligraphic = mathFallbackText(calligraphicSegments[Number(match[1])] || "");
    output += `<tspan class="tikz-math-calligraphic" font-family="${escapeAttribute(
      TIKZ_MATH_CALLIGRAPHIC_FONT_FAMILY
    )}" font-style="normal">${renderMathTextWithUprightOperators(calligraphic)}</tspan>`;
    cursor = markerPattern.lastIndex;
  }
  output += renderOrdinaryMathFallbackSegment(fallback.slice(cursor), fontSize);
  return output;
}

function renderOrdinaryMathFallbackSegment(text, fontSize) {
  return /[=+≤≥≠≈∼]/.test(text)
    ? renderMathOperatorSpacedText(text, fontSize)
    : renderMathTextWithUprightOperators(text);
}

function renderScopedAlignedColors(tex, fontSize) {
  const source = String(tex || "");
  let output = "";
  let cursor = 0;
  let found = false;
  while (cursor < source.length) {
    const start = source.indexOf("{\\color", cursor);
    if (start === -1) break;
    const colorStart = source.indexOf("{", start + "{\\color".length);
    const colorEnd = colorStart === -1 ? -1 : findClosingBrace(source, colorStart);
    const groupEnd = findClosingBrace(source, start);
    if (colorStart === -1 || colorEnd === -1 || groupEnd === -1 || colorEnd >= groupEnd) break;
    output += renderAlignedMathCellWithoutColors(source.slice(cursor, start), fontSize);
    const colorName = source.slice(colorStart + 1, colorEnd).trim();
    const body = source.slice(colorEnd + 1, groupEnd);
    output += `<tspan fill="${escapeAttribute(colorName)}">${renderAlignedMathCellWithoutColors(body, fontSize)}</tspan>`;
    cursor = groupEnd + 1;
    found = true;
  }
  if (!found) return null;
  output += renderAlignedMathCellWithoutColors(source.slice(cursor), fontSize);
  return output;
}

function renderAlignedMathCellWithoutColors(tex, fontSize) {
  const scripted = scriptedMathFallback(tex, { allowSimpleScripts: true });
  if (scripted) return renderScriptedSegmentsContent(scripted, fontSize);
  return renderMathTextWithUprightOperators(mathFallbackText(tex));
}

function estimateAlignedCellWidth(tex, fontSize) {
  const plain = mathFallbackText(String(tex || "").replace(/\{\\color\s*\{[^{}]+\}/g, "").replace(/\}/g, ""));
  return Math.max(fontSize * 0.22, [...plain].length * fontSize * 0.46);
}

function findClosingBrace(source, start) {
  if (source[start] !== "{") return -1;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "{" && (index === 0 || source[index - 1] !== "\\")) depth += 1;
    if (source[index] === "}" && (index === 0 || source[index - 1] !== "\\")) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function mathHtmlJustifyContent(anchor) {
  if (anchor === "start") return "flex-start";
  if (anchor === "end") return "flex-end";
  return "center";
}

function fitSwitchFallbackFontSize(text, fontSize, maxWidth, maxHeight) {
  const size = Number(fontSize) || TIKZ_TEXT_FONT_SIZE;
  const width = Number(maxWidth);
  const height = Number(maxHeight);
  const glyphs = Math.max(1, Array.from(String(text || "")).length);
  const estimatedWidth = glyphs * size * 0.54;
  const widthScale = Number.isFinite(width) && width > 0 && estimatedWidth > width * 0.92 ? (width * 0.92) / estimatedWidth : 1;
  const heightScale = Number.isFinite(height) && height > 0 && size * 1.18 > height * 0.9 ? (height * 0.9) / (size * 1.18) : 1;
  return Math.max(6, size * Math.min(1, widthScale, heightScale));
}

function mathFitText(tex) {
  return mathFallbackText(tex)
    .replace(/[_^{}]/g, "")
    .replace(/\\[A-Za-z]+/g, "x");
}

function mathGlyphFallbackFontScale(tex) {
  return /^\\(?:downarrow|uparrow|leftarrow|rightarrow|Downarrow|Uparrow|Leftarrow|Rightarrow)(?![A-Za-z])$/.test(String(tex || "").trim()) ? 0.9 : 1;
}

function mathFallbackFontFamily(item = {}) {
  const family = String(item.font?.family || item.style?.fontFamily || "").trim();
  if (family === "sans-serif" || /(?:CMUSans|Sans Serif|sans-serif|Helvetica|Arial)/i.test(family)) {
    return TIKZ_SANS_SERIF_FONT_FAMILY;
  }
  return TIKZ_MATH_ITALIC_FONT_FAMILY;
}

export function scopedMathHostFontSize(fontSize) {
  return fontSize / KATEX_ROOT_FONT_SCALE;
}

export function scopedMathForeignObjectBox(box, displayMode = false, tex = "") {
  const fontSize = Number(box.fontSize) || TIKZ_TEXT_FONT_SIZE;
  const complexInline = !displayMode && Number(box.width) > fontSize * KATEX_COMPLEX_INLINE_WIDTH_RATIO;
  const lineBoxScale = displayMode
    ? KATEX_DISPLAY_LINE_BOX_SCALE
    : complexInline
      ? KATEX_INLINE_COMPLEX_LINE_BOX_SCALE
      : KATEX_INLINE_LINE_BOX_SCALE;
  const widthPad = fontSize * (
    displayMode
      ? KATEX_DISPLAY_WIDTH_PAD_EM
      : hasInlineMatrixTex(tex)
        ? KATEX_INLINE_MATRIX_WIDTH_PAD_EM
        : complexInline
          ? KATEX_INLINE_WIDTH_PAD_EM
          : KATEX_INLINE_COMPACT_WIDTH_PAD_EM
  );
  return {
    width: box.width + widthPad,
    height: Math.max(box.height, fontSize * lineBoxScale)
  };
}

function hasInlineMatrixTex(tex) {
  return /\\begin\s*\{(?:p|b|B|v|V)?matrix\}/.test(String(tex || ""));
}

export function mathStyleScale(tex, baseSizePt = 10) {
  const styles = [...String(tex || "").matchAll(/\\(display|text|script|scriptscript)style(?![A-Za-z])/g)];
  const style = styles.at(-1)?.[1] || "text";
  if (style === "display") return 1.18;
  if (style === "text") return 1;
  const base = Number(baseSizePt);
  if (!Number.isFinite(base) || base <= 0) return 1;
  const sizes = texMathSizesForBase(base);
  return style === "script" ? sizes.script / base : sizes.scriptscript / base;
}

function texMathSizesForBase(baseSizePt) {
  // LaTeX's fontmath.ltx declares the text/script/scriptscript triplets.
  // At normal 10pt this is 10/7/5, so scriptscriptstyle must not reuse the
  // scriptstyle scale. Values at or below 5pt remain at the 5pt floor.
  if (baseSizePt <= 5) return { script: baseSizePt, scriptscript: baseSizePt };
  const table = [
    { text: 6, script: 5, scriptscript: 5 },
    { text: 7, script: 5, scriptscript: 5 },
    { text: 8, script: 6, scriptscript: 5 },
    { text: 9, script: 6, scriptscript: 5 },
    { text: 10, script: 7, scriptscript: 5 },
    { text: 11, script: 8, scriptscript: 6 },
    { text: 12, script: 8, scriptscript: 6 },
    { text: 14, script: 10, scriptscript: 7 },
    { text: 17, script: 12, scriptscript: 10 },
    { text: 20, script: 14, scriptscript: 12 },
    { text: 25, script: 20, scriptscript: 17 }
  ];
  return table.reduce((nearest, entry) => (
    Math.abs(entry.text - baseSizePt) < Math.abs(nearest.text - baseSizePt) ? entry : nearest
  ));
}

export function estimateMathBox(tex, displayMode, unit, scale = 1, options = {}) {
  const mathVersion = options.mathVersion === "bold" ? "bold" : "normal";
  const renderScale = renderUnitScale(unit);
  const fontSize = (displayMode ? TIKZ_DISPLAY_MATH_FONT_SIZE : TIKZ_TEXT_FONT_SIZE) * renderScale * scale;
  const box = estimateFormulaBox(tex, {
    displayMode,
    scale,
    minWidth: displayMode ? undefined : 0.08,
    widthPadding: displayMode ? undefined : 0.08,
    texTextMetrics: !displayMode,
    mathVersion
  });
  const width = displayMode
    ? Math.max(72 * renderScale * scale, box.width * unit + 12 * renderScale * scale)
    : box.width * unit;
  const height = displayMode
    ? Math.max(46 * renderScale * scale, formulaTotalHeight(box) * unit + 8 * renderScale * scale)
    : Math.max(18 * renderScale * scale, formulaTotalHeight(box) * unit);
  return {
    fontSize,
    width: Math.min(unit * 8, width),
    height
  };
}

function mathTexForVersion(tex, mathVersion) {
  return mathVersion === "bold" ? `\\boldsymbol{${tex}}` : tex;
}

function finitePositiveScale(value) {
  const scale = Number(value);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}
