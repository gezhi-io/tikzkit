import { parseExtensibleMathArrow } from "../../tikz/mathArrows.js";
import { mathFallbackText } from "../../tikz/text.js";
import { estimateFormulaBox, texTextWidthCm } from "../../tikz/textMetrics.js";
import {
  TIKZ_MATH_ITALIC_FONT_FAMILY,
  TIKZ_MATH_MAIN_FONT_FAMILY,
  TIKZ_TEXT_FONT_SIZE
} from "../../tikz/metrics.js";
import { escapeAttribute, escapeText } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { mathFallbackFontStyle } from "./mathFallbackSyntax.js";
import {
  renderMathTextWithUprightOperators,
  renderScriptedSegmentsContent,
  scriptedMathFallback
} from "./mathScriptFallback.js";
import { svgTextAnchorPoint } from "./textLayout.js";

const TEX_PT_PER_CM = 28.4527559;
const EXTENSIBLE_ARROW_MIN_WIDTH_PT = 10.90817;
const EXTENSIBLE_ARROW_END_ALLOWANCE_PT = 0.99;
const EXTENSIBLE_ARROW_DOUBLE_STRUCK_CORRECTION_PT = 2.93;

export function extensibleMathArrowFallback(tex) {
  return parseExtensibleMathArrow(tex);
}

export function renderExtensibleMathArrowFallback(item, tex, parts, baseFontSize, unit, color, fontWeight = "") {
  const anchor = svgTextAnchorPoint(item, unit);
  const scale = baseFontSize / TIKZ_TEXT_FONT_SIZE;
  const prefixWidth = mathFragmentWidth(parts.prefix, unit, scale);
  const suffixWidth = mathFragmentWidth(parts.suffix, unit, scale);
  const labelFontSize = baseFontSize * 0.7;
  const above = mathFallbackText(parts.above);
  const below = mathFallbackText(parts.below);
  const aboveWidth = scriptLabelWidth(above, unit, scale);
  const belowWidth = scriptLabelWidth(below, unit, scale);
  const scriptPadding = baseFontSize * (14 * 0.7 / 18);
  const arrowEndAllowance = baseFontSize * (EXTENSIBLE_ARROW_END_ALLOWANCE_PT / 10);
  const arrowWidth = Math.max(
    baseFontSize * (EXTENSIBLE_ARROW_MIN_WIDTH_PT / 10),
    aboveWidth + scriptPadding + arrowEndAllowance,
    belowWidth + scriptPadding + arrowEndAllowance
  );
  const relationGap = baseFontSize * (5 / 18);
  const totalWidth =
    prefixWidth +
    (prefixWidth ? relationGap : 0) +
    arrowWidth +
    (suffixWidth ? relationGap : 0) +
    suffixWidth;
  const startX =
    anchor.anchor === "start"
      ? anchor.x
      : anchor.anchor === "end"
        ? anchor.x - totalWidth
        : anchor.x - totalWidth / 2;
  const arrowStart = startX + prefixWidth + (prefixWidth ? relationGap : 0);
  const arrowEnd = arrowStart + arrowWidth;
  const suffixX = arrowEnd + (suffixWidth ? relationGap : 0);
  const formulaBox = estimateFormulaBox(tex, { scale, minWidth: 0, widthPadding: 0 });
  const baselineY = anchor.y + ((formulaBox.height - formulaBox.depth) * unit) / 2;
  const arrowY = baselineY - baseFontSize * 0.25;
  const textAttrs = `fill="${color}" dominant-baseline="alphabetic" font-size="${format(baseFontSize)}" font-style="italic"${
    fontWeight ? ` font-weight="${fontWeight}"` : ""
  } font-family="${escapeAttribute(TIKZ_MATH_ITALIC_FONT_FAMILY)}"`;

  const prefix = renderMathFragment(parts.prefix, startX, baselineY, baseFontSize, color, fontWeight, prefixWidth);
  const suffix = renderMathFragment(parts.suffix, suffixX, baselineY, baseFontSize, color, fontWeight, suffixWidth);
  const arrow = renderArrowPath(parts.direction, arrowStart, arrowEnd, arrowY, baseFontSize, color);
  const upperLabel = renderArrowLabel(
    above,
    parts.above,
    (arrowStart + arrowEnd) / 2,
    baselineY - baseFontSize * 0.565,
    labelFontSize,
    color,
    aboveWidth
  );
  const lowerLabel = renderArrowLabel(
    below,
    parts.below,
    (arrowStart + arrowEnd) / 2,
    baselineY + baseFontSize * 0.58,
    labelFontSize,
    color,
    belowWidth
  );

  return `<g class="tikz-math-extensible-arrow" data-direction="${parts.direction}" data-width="${format(totalWidth)}"><g ${textAttrs}>${prefix}${suffix}</g>${arrow}${upperLabel}${lowerLabel}</g>`;
}

function renderMathFragment(tex, x, y, fontSize, color, fontWeight, width) {
  if (!String(tex || "").trim()) return "";
  const compact = compactMathWhitespace(tex);
  const scripted = scriptedMathFallback(compact, { allowSimpleScripts: true });
  const content = scripted
    ? renderScriptedSegmentsContent(scripted, fontSize)
    : renderMathTextWithUprightOperators(mathFallbackText(compact));
  const widthAttrs = width > 0 ? ` textLength="${format(width)}" lengthAdjust="spacingAndGlyphs"` : "";
  return `<text class="tikz-math-arrow-fragment" x="${format(x)}" y="${format(y)}" fill="${color}" text-anchor="start" dominant-baseline="alphabetic" font-size="${format(
    fontSize
  )}"${widthAttrs} font-style="italic"${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(
    TIKZ_MATH_ITALIC_FONT_FAMILY
  )}">${content}</text>`;
}

function renderArrowLabel(text, tex, x, y, fontSize, color, width) {
  if (!String(text || "").trim()) return "";
  const italic = mathFallbackFontStyle(tex) === "italic";
  const family = italic ? TIKZ_MATH_ITALIC_FONT_FAMILY : TIKZ_MATH_MAIN_FONT_FAMILY;
  const widthAttrs = width > 0 ? ` textLength="${format(width)}" lengthAdjust="spacingAndGlyphs"` : "";
  return `<text class="tikz-math-arrow-label" x="${format(x)}" y="${format(y)}" fill="${color}" text-anchor="middle" dominant-baseline="alphabetic" font-size="${format(
    fontSize
  )}"${widthAttrs} font-style="${italic ? "italic" : "normal"}" font-family="${escapeAttribute(family)}">${escapeText(text)}</text>`;
}

function renderArrowPath(direction, startX, endX, y, fontSize, color) {
  const lineWidth = Math.max(0.6, fontSize * 0.04);
  const headLength = fontSize * 0.42;
  const headHalfHeight = fontSize * 0.18;
  const tipX = direction === "left" ? startX : endX;
  const insetX = direction === "left" ? tipX + headLength : tipX - headLength;
  const shaftStart = direction === "left" ? startX + headLength * 0.64 : startX;
  const shaftEnd = direction === "left" ? endX : endX - headLength * 0.64;
  const shaft = `<path class="tikz-math-arrow-shaft" d="M ${format(shaftStart)} ${format(y)} L ${format(shaftEnd)} ${format(
    y
  )}" fill="none" stroke="${color}" stroke-width="${format(lineWidth)}" stroke-linecap="butt" />`;
  const head = `<path class="tikz-math-arrow-head" d="M ${format(tipX)} ${format(y)} L ${format(insetX)} ${format(
    y - headHalfHeight
  )} L ${format(insetX + (direction === "left" ? -headLength * 0.24 : headLength * 0.24))} ${format(y)} L ${format(insetX)} ${format(
    y + headHalfHeight
  )} Z" fill="${color}" />`;
  return shaft + head;
}

function mathFragmentWidth(tex, unit, scale) {
  const fallback = mathFallbackText(compactMathWhitespace(tex)).replace(/\s+/g, "");
  if (!fallback) return 0;
  const baseWidth = texTextWidthCm(fallback, scale) * unit;
  const doubleStruckCount = [...fallback].filter((char) => "ℂℍℕℙℚℝℤ".includes(char)).length;
  const scriptCount = (fallback.match(/[_^](?:[A-Za-z0-9]|[₀-₉⁰-⁹])/g) || []).length;
  return baseWidth + ((doubleStruckCount * EXTENSIBLE_ARROW_DOUBLE_STRUCK_CORRECTION_PT + scriptCount * 0.3) / TEX_PT_PER_CM) * unit * scale;
}

function scriptLabelWidth(text, unit, scale) {
  return texTextWidthCm(String(text || "").replace(/\s+/g, ""), scale * 0.7) * unit * 1.14;
}

function compactMathWhitespace(tex) {
  return String(tex || "").replace(/\s+/g, "");
}
