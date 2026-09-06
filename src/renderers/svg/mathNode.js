import { estimateFormulaBox, formulaTotalHeight } from "../../tikz/textMetrics.js";
import {
  isMathFallbackSpacedOperatorSymbol,
  MATH_FALLBACK_NAMED_OPERATORS,
  mathFallbackText
} from "../../tikz/text.js";
import { createFontSpec } from "../../tex/fontSpec.js";
import {
  TIKZ_DISPLAY_MATH_FONT_SIZE,
  TIKZ_FONT_FAMILY,
  TIKZ_HELVETICA_FONT_FAMILY,
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
import { measureScopedMathExtents, renderScopedMathHtml } from "./mathHtml.js";
import { renderScopedUprightMathContent } from "./mathUprightFallback.js";
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
  estimateScriptedSegmentsWidth,
  scriptedMathFallback,
  simpleNumericSubscriptFallback,
  styledScriptedMathFallback,
  texNeedsOperatorSpacing
} from "./mathScriptFallback.js";
import { renderSumLimitsInlineFallback, sumLimitsInlineFallback } from "./mathSumFallback.js";
import { svgTextAnchorPoint, textFontScale } from "./textLayout.js";
import { renderTensorMatrixFallback, tensorMatrixFallbackParts } from "./tensorMatrixFallback.js";
import { svgPaint } from "./style.js";

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
  const mathVersion = resolveMathVersion(options.mathVersion || font.mathVersion);
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
  const measured = measureScopedMathExtents(source, displayMode);
  const exceedsNativeBox = (measured.height + measured.depth) * rawBox.fontSize > rawBox.height;
  const heightPt = exceedsNativeBox ? measured.height * rawBox.fontSize : formulaHeightPt + extraHeightPt / 2;
  const depthPt = exceedsNativeBox ? measured.depth * rawBox.fontSize : formulaDepthPt + extraHeightPt / 2;
  return {
    widthPt: rawBox.width,
    heightPt,
    depthPt,
    baselinePt: heightPt,
    paintWidthPt: paintBox.width,
    paintHeightPt: glyphBox ? paintBox.height : heightPt + depthPt,
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
  const mathVersion = resolveMathVersion(item?.font?.mathVersion);
  const sourceTex = mathVersion === "sans" ? originalMathTex(item, tex) : tex;
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
  const color = escapeAttribute(svgPaint(math.color || item.style?.fill || "black"));
  const fontStyle = mathFallbackFontStyle(tex);
  const fontWeight = math.fontWeight || (mathVersion === "bold" ? "700" : mathFallbackFontWeight(tex));
  const fallbackFontFamily = mathFallbackFontFamily(item, mathVersion);
  const fallbackFontSize = box.fontSize * mathGlyphFallbackFontScale(tex);
  const fallbackText = mathFallbackText(mathVersion === "sans" ? markSansMathWrappers(sourceTex) : tex);
  const switchFallbackFontSize =
    options.mathRenderer === "svg-text"
      ? fallbackFontSize
      : fitSwitchFallbackFontSize(fallbackText, fallbackFontSize, htmlBox.width, htmlBox.height);
  const relationTextLength = texNeedsOperatorSpacing(tex) && !math.displayMode
    ? estimateFormulaBox(tex, {
        scale: contentScale * fitScale * styleScale,
        minWidth: 0.08,
        widthPadding: 0,
        texTextMetrics: true,
        mathVersion
      }).width * unit
    : null;
  const relationTextLengthAttrs = Number.isFinite(relationTextLength)
    ? ` textLength="${format(relationTextLength)}" lengthAdjust="spacingAndGlyphs"`
    : "";
  const fallbackContent = mathVersion === "sans"
    ? renderSansMathText(fallbackText, switchFallbackFontSize, sansMathTextFontFamily(item))
    : renderCalligraphicMathFallback(tex, switchFallbackFontSize) || (
      texNeedsOperatorSpacing(tex)
        ? renderMathOperatorSpacedText(fallbackText, switchFallbackFontSize)
        : renderMathTextWithUprightOperators(fallbackText)
    );
  const fallbackAnchor = htmlAnchor;
  const plainFallback = `<text x="${format(fallbackAnchor.x)}" y="${format(fallbackAnchor.y)}" fill="${color}" text-anchor="${fallbackAnchor.anchor}" dominant-baseline="middle" font-size="${format(
    switchFallbackFontSize
  )}"${relationTextLengthAttrs}${fontStyle ? ` font-style="${fontStyle}"` : ""}${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(
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
  if (glyphFormulaFallback && options.mathRenderer === "svg-text" && !fontWeight && mathVersion !== "sans") {
    return renderSimpleMathGlyphFormulaFallback(item, glyphFormulaFallback, fallbackFontSize, unit, color);
  }
  if (glyphFallback && options.mathRenderer === "svg-text" && !fontWeight) {
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
  const scopedUprightFallback = renderScopedUprightMathContent(tex, fallbackFontSize);
  if (scopedUprightFallback && options.mathRenderer === "svg-text" && mathVersion !== "sans") {
    return `<text x="${format(fallbackAnchor.x)}" y="${format(fallbackAnchor.y)}" fill="${color}" text-anchor="${fallbackAnchor.anchor}" dominant-baseline="middle" font-size="${format(
      fallbackFontSize
    )}"${fontStyle ? ` font-style="${fontStyle}"` : ""}${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(
      fallbackFontFamily
    )}">${scopedUprightFallback}</text>`;
  }
  const styledScriptFallback = styledScriptedMathFallback(tex);
  if (styledScriptFallback && options.mathRenderer === "svg-text" && mathVersion !== "sans") {
    return renderScriptedMathFallback(item, styledScriptFallback, fallbackFontSize, unit, color, fontStyle, fontWeight);
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
  const mixedSubscriptFallback = mixedAlphabeticSubscriptFallback(tex);
  if (mixedSubscriptFallback && options.mathRenderer === "svg-text") {
    return renderMixedSubscriptMathFallback(item, mixedSubscriptFallback, fallbackFontSize, unit, color, fontStyle, fontWeight);
  }
  if (options.mathRenderer === "svg-text") return plainFallback;

  const html = renderScopedMathHtml(mathTexForVersion(sourceTex, mathVersion), {
    displayMode: math.displayMode,
    mathVersion,
    sansFontFamily: item.font?.family === "helvetica" ? "helvetica" : undefined
  });
  const switchFallback =
    inlineMatrixFallback
      ? renderInlineMatrixMathFallback(item, inlineMatrixFallback, fallbackFontSize, unit, color, fontStyle, fontWeight)
      : subscriptFallback
        ? renderSimpleSubscriptMathFallback(item, subscriptFallback, fallbackFontSize, unit, color, fontStyle, fontWeight)
        : mixedSubscriptFallback
          ? renderMixedSubscriptMathFallback(item, mixedSubscriptFallback, fallbackFontSize, unit, color, fontStyle, fontWeight)
          : plainFallback;
  const foreignObject = `<foreignObject overflow="visible" requiredExtensions="http://www.w3.org/1999/xhtml" x="${format(x)}" y="${format(
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
  const leftCellWidths = normalizedRows.map((row) => estimateAlignedCellWidth(row[0], fontSize, unit));
  const rightCellWidths = normalizedRows.map((row) => estimateAlignedCellWidth(row[1], fontSize, unit));
  const leftWidth = Math.max(...leftCellWidths, 0);
  const rightWidth = Math.max(...rightCellWidths, 0);
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
      const leftX = alignX - gap / 2;
      const rightX = alignX + gap / 2;
      return renderAlignedMathCellText(leftX, y, "end", left, common) + renderAlignedMathCellText(
        rightX,
        y,
        "start",
        right,
        common,
        alignedMathRenderScale(row[1], rightCellWidths[index], fontSize)
      );
    })
    .join("")}</g>`;
}

function renderAlignedMathCellText(x, y, anchor, content, common, scale = 1) {
  const text = `<text x="${format(x)}" y="${format(y)}" text-anchor="${anchor}" ${common}>${content}</text>`;
  if (!Number.isFinite(scale) || Math.abs(scale - 1) < 0.02) return text;
  return `<g transform="translate(${format(x)} 0) scale(${format(scale)} 1)"><text x="0" y="${format(y)}" text-anchor="${anchor}" ${common}>${content}</text></g>`;
}

function alignedMathRenderScale(tex, targetWidth, fontSize) {
  const source = String(tex || "");
  if (!/[_^]|\\(?:left|right|mathbf|boldsymbol|color)\b/.test(source)) return 1;
  const segments = styledScriptedMathFallback(source) || scriptedMathFallback(source, { allowSimpleScripts: true });
  const fallbackWidth = segments
    ? estimateScriptedSegmentsWidth(segments, fontSize)
    : estimateAlignedFallbackWidth(source, fontSize);
  if (!Number.isFinite(targetWidth) || !Number.isFinite(fallbackWidth) || fallbackWidth <= 0) return 1;
  return Math.min(1.5, Math.max(0.85, targetWidth / fallbackWidth));
}

function estimateAlignedFallbackWidth(tex, fontSize) {
  const plain = mathFallbackText(tex);
  const relationCount = [...plain].filter((char) => isMathFallbackSpacedOperatorSymbol(char)).length;
  return [...plain].length * fontSize * 0.42 + relationCount * fontSize * (10 / 18);
}

function renderAlignedMathCell(tex, fontSize) {
  const scoped = renderScopedAlignedColors(String(tex || ""), fontSize);
  if (scoped !== null) return scoped;
  const styled = styledScriptedMathFallback(tex);
  if (styled) return renderScriptedSegmentsContent(styled, fontSize);
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
  const styled = styledScriptedMathFallback(tex);
  if (styled) return renderScriptedSegmentsContent(styled, fontSize);
  const scripted = scriptedMathFallback(tex, { allowSimpleScripts: true });
  if (scripted) return renderScriptedSegmentsContent(scripted, fontSize);
  return renderMathTextWithUprightOperators(mathFallbackText(tex));
}

function estimateAlignedCellWidth(tex, fontSize, unit) {
  const source = String(tex || "").trim();
  if (!source) return 0;

  // amsmath aligns the completed math lists, including grouped nuclei and
  // scripts. Reuse the TeX-aware formula box used by ordinary math nodes so
  // the alignment pass does not flatten `P_k^{(P)}` into unrelated characters.
  const baseFontSize = TIKZ_TEXT_FONT_SIZE * renderUnitScale(unit);
  const scale = baseFontSize > 0 ? fontSize / baseFontSize : 1;
  const box = estimateMathBox(source, false, unit, scale);
  if (Number.isFinite(box.width) && box.width > 0) return box.width;

  const scripted = scriptedMathFallback(source, { allowSimpleScripts: true });
  if (scripted) return Math.max(fontSize * 0.22, estimateScriptedSegmentsWidth(scripted, fontSize));
  const plain = mathFallbackText(source);
  const relationCount = [...plain].filter((char) => isMathFallbackSpacedOperatorSymbol(char)).length;
  return Math.max(fontSize * 0.22, [...plain].length * fontSize * 0.42 + relationCount * fontSize * (10 / 18));
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

function mathFallbackFontFamily(item = {}, mathVersion = "normal") {
  if (mathVersion === "sans") return TIKZ_MATH_ITALIC_FONT_FAMILY;
  const family = String(item.font?.family || item.style?.fontFamily || "").trim();
  if (family === "sans-serif" || /(?:CMUSans|Sans Serif|sans-serif|Helvetica|Arial)/i.test(family)) {
    return TIKZ_SANS_SERIF_FONT_FAMILY;
  }
  return TIKZ_MATH_ITALIC_FONT_FAMILY;
}

function sansMathTextFontFamily(item = {}) {
  return item.font?.family === "helvetica" || item.style?.fontFamily === TIKZ_HELVETICA_FONT_FAMILY
    ? TIKZ_HELVETICA_FONT_FAMILY
    : TIKZ_SANS_SERIF_FONT_FAMILY;
}

export function scopedMathHostFontSize(fontSize) {
  return fontSize / KATEX_ROOT_FONT_SCALE;
}

export function scopedMathForeignObjectBox(box, displayMode = false, tex = "") {
  const fontSize = Number(box.fontSize) || TIKZ_TEXT_FONT_SIZE;
  const measured = measureScopedMathExtents(tex, displayMode);
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
    height: Math.max(box.height, fontSize * lineBoxScale, fontSize * (measured.height + measured.depth))
  };
}

function hasInlineMatrixTex(tex) {
  return /\\begin\s*\{(?:p|b|B|v|V)?matrix\}/.test(String(tex || ""));
}

export function mathStyleScale(tex, baseSizePt = 10) {
  const styles = [...String(tex || "").matchAll(/\\(display|text|script|scriptscript)style(?![A-Za-z])/g)];
  const style = styles.at(-1)?.[1] || "text";
  if (style === "display") return 1;
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
  if (mathVersion === "bold") return `\\boldsymbol{${tex}}`;
  if (mathVersion === "sans") return String(tex || "").replace(/\\mathbf\b/g, "\\mathsfbf");
  return tex;
}

function originalMathTex(item, fallback) {
  const raw = String(item?.text || "").trim();
  const dollar = raw.match(/^\$([\s\S]*)\$$/);
  if (dollar) return normalizeKatexTex(dollar[1]);
  const paren = raw.match(/^\\\(([\s\S]*)\\\)$/);
  if (paren) return normalizeKatexTex(paren[1]);
  const bracket = raw.match(/^\\\[([\s\S]*)\\\]$/);
  if (bracket) return normalizeKatexTex(bracket[1]);
  return fallback;
}

function resolveMathVersion(value) {
  const version = String(value || "").trim();
  return version === "bold" || version === "sans" ? version : "normal";
}

// sansmath deliberately remains a hybrid math version: variables stay in
// math italic, while digits, punctuation, named operators, \mathrm and
// \mathbf use \sfdefault. Preserve the explicit group intent through the
// plain SVG-text fallback, where KaTeX's scoped CSS is not available.
const SANS_MATH_ROMAN_START = "\uE000";
const SANS_MATH_ROMAN_END = "\uE001";
const SANS_MATH_BOLD_START = "\uE002";
const SANS_MATH_BOLD_END = "\uE003";
const SANS_MATH_OPERATOR_WORDS = new Set(MATH_FALLBACK_NAMED_OPERATORS);

function markSansMathWrappers(tex) {
  let source = String(tex || "");
  let changed = true;
  while (changed) {
    changed = false;
    source = source.replace(/\\(?:mathrm|mathsf)\s*\{([^{}]*)\}/g, (_match, value) => {
      changed = true;
      return `${SANS_MATH_ROMAN_START}${value}${SANS_MATH_ROMAN_END}`;
    });
    source = source.replace(/\\(?:mathbf|mathsfbf|boldsymbol)\s*\{([^{}]*)\}/g, (_match, value) => {
      changed = true;
      return `${SANS_MATH_BOLD_START}${value}${SANS_MATH_BOLD_END}`;
    });
  }
  return source;
}

function renderSansMathText(text, baseFontSize, sansFamily = TIKZ_SANS_SERIF_FONT_FAMILY) {
  const source = String(text || "");
  const relationSpace = Math.max(1.5, baseFontSize * (5 / 18));
  let output = "";
  let mode = "italic";
  let index = 0;

  const sansSpan = (value, weight = "") => `<tspan font-family="${escapeAttribute(
    sansFamily
  )}" font-style="normal"${weight ? ` font-weight="${weight}"` : ""}>${escapeMathText(value)}</tspan>`;
  const italicSpan = (value) => escapeMathText(value);

  while (index < source.length) {
    const char = source[index];
    if (char === SANS_MATH_ROMAN_START) {
      mode = "roman";
      index += 1;
      continue;
    }
    if (char === SANS_MATH_ROMAN_END) {
      mode = "italic";
      index += 1;
      continue;
    }
    if (char === SANS_MATH_BOLD_START) {
      mode = "bold";
      index += 1;
      continue;
    }
    if (char === SANS_MATH_BOLD_END) {
      mode = "italic";
      index += 1;
      continue;
    }

    const word = source.slice(index).match(/^[A-Za-z]+/)?.[0];
    if (word) {
      output += mode === "italic" && !SANS_MATH_OPERATOR_WORDS.has(word)
        ? italicSpan(word)
        : sansSpan(word, mode === "bold" ? "700" : "");
      index += word.length;
      continue;
    }

    if (/\s/.test(char)) {
      output += escapeMathText(char);
      index += 1;
      continue;
    }
    if (/[\-*/]/.test(char) || isMathFallbackSpacedOperatorSymbol(char)) {
      output += `<tspan dx="${format(relationSpace)}">${sansSpan(char, mode === "bold" ? "700" : "")}</tspan><tspan dx="${format(relationSpace)}"></tspan>`;
      index += 1;
      continue;
    }

    output += mode === "italic" && !/[0-9()[\]{},.;:!?]/.test(char)
      ? italicSpan(char)
      : sansSpan(char, mode === "bold" ? "700" : "");
    index += 1;
  }
  return output;
}

function escapeMathText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function finitePositiveScale(value) {
  const scale = Number(value);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}
