import { mathFallbackText } from "../../tikz/text.js";
import {
  TIKZ_MATH_ITALIC_FONT_FAMILY,
  TIKZ_MATH_MAIN_FONT_FAMILY
} from "../../tikz/metrics.js";
import { escapeAttribute, escapeText } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { readBalancedGroup, skipInlineWhitespace } from "./mathFallbackSyntax.js";
import { renderMathTextWithUprightOperators } from "./mathScriptFallback.js";
import { svgTextAnchorPoint } from "./textLayout.js";

const CMR7_FONT_FAMILY = "TikZKitCMR7, TikZKitCMUSerif, serif";

export function niceFractionMathFallback(tex) {
  const source = String(tex || "");
  const command = String.raw`\mathord`;
  let searchFrom = 0;

  while (searchFrom < source.length) {
    const index = source.indexOf(command, searchFrom);
    if (index === -1) return null;
    const afterCommand = index + command.length;
    if (/[A-Za-z]/.test(source[afterCommand] || "")) {
      searchFrom = afterCommand;
      continue;
    }
    const groupStart = skipInlineWhitespace(source, afterCommand);
    const group = readBalancedGroup(source, groupStart);
    const fraction = group ? parseNiceFractionBody(group.content) : null;
    if (fraction) {
      return {
        prefix: source.slice(0, index),
        suffix: source.slice(group.end),
        ...fraction
      };
    }
    searchFrom = afterCommand;
  }
  return null;
}

export function renderNiceFractionMathFallback(item, parts, baseFontSize, unit, color, fontWeight) {
  const anchor = svgTextAnchorPoint(item, unit);
  return `<text class="tikz-nicefrac" x="${format(anchor.x)}" y="${format(anchor.y)}" fill="${color}" text-anchor="${anchor.anchor}" dominant-baseline="middle" font-size="${format(
    baseFontSize
  )}" font-style="italic"${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(
    TIKZ_MATH_ITALIC_FONT_FAMILY
  )}">${renderNiceFractionMathContent(parts, baseFontSize)}</text>`;
}

export function renderNiceFractionMathContent(parts, baseFontSize) {
  const scriptFontSize = baseFontSize * 0.7;
  const numeratorRaise = baseFontSize * 0.2;
  const beforeSolidusKern = -2 * (baseFontSize / 18);
  const afterSolidusKern = -(baseFontSize / 18);
  const binaryOperatorSpace = 4 * (baseFontSize / 18);
  const prefix = renderSurroundingMath(parts.prefix, baseFontSize, binaryOperatorSpace);
  const suffix = renderSurroundingMath(parts.suffix, baseFontSize, binaryOperatorSpace, true);
  const numerator = renderNiceFractionPart(parts.numerator);
  const denominator = renderNiceFractionPart(parts.denominator);
  return `${prefix}<tspan class="tikz-nicefrac-numerator" dy="${format(-numeratorRaise)}" font-size="${format(
    scriptFontSize
  )}" font-family="${escapeAttribute(niceFractionPartFont(parts.numerator))}" font-style="${niceFractionPartStyle(
    parts.numerator
  )}">${numerator}</tspan><tspan class="tikz-nicefrac-solidus" dy="${format(numeratorRaise)}" dx="${format(
    beforeSolidusKern
  )}" font-size="${format(baseFontSize)}" font-family="${escapeAttribute(
    TIKZ_MATH_MAIN_FONT_FAMILY
  )}" font-style="normal">/</tspan><tspan class="tikz-nicefrac-denominator" dx="${format(
    afterSolidusKern
  )}" font-size="${format(scriptFontSize)}" font-family="${escapeAttribute(
    niceFractionPartFont(parts.denominator)
  )}" font-style="${niceFractionPartStyle(parts.denominator)}">${denominator}</tspan>${suffix}`;
}

function parseNiceFractionBody(value) {
  const source = String(value || "");
  let cursor = skipInlineWhitespace(source, 0);
  const raisebox = String.raw`\raisebox`;
  if (!source.startsWith(raisebox, cursor)) return null;
  cursor = skipInlineWhitespace(source, cursor + raisebox.length);
  const raise = readBalancedGroup(source, cursor);
  if (!raise || raise.content.trim() !== "0.2em") return null;
  cursor = skipInlineWhitespace(source, raise.end);
  const numerator = readBalancedGroup(source, cursor);
  if (!numerator) return null;
  cursor = skipInlineWhitespace(source, numerator.end);
  const separator = source.slice(cursor).match(/^\\mkern\s*-2mu\s*\/\s*\\mkern\s*-1mu\s*/);
  if (!separator) return null;
  cursor = skipInlineWhitespace(source, cursor + separator[0].length);
  const denominator = readBalancedGroup(source, cursor);
  if (!denominator || source.slice(denominator.end).trim()) return null;
  return {
    numerator: stripScriptSize(numerator.content),
    denominator: stripScriptSize(denominator.content)
  };
}

function stripScriptSize(value) {
  return String(value || "").replace(/^\s*\\scriptsize(?![A-Za-z])\s*(?:\{\})?/, "");
}

function renderNiceFractionPart(value) {
  return renderMathTextWithUprightOperators(mathFallbackText(value).replace(/\s+/g, " ").trim());
}

function niceFractionPartFont(value) {
  const source = String(value || "");
  if (/\\(?:mathrm|textrm|textnormal)\b/.test(source) || !/[A-Za-z]/.test(mathFallbackText(source))) {
    return CMR7_FONT_FAMILY;
  }
  return TIKZ_MATH_ITALIC_FONT_FAMILY;
}

function niceFractionPartStyle(value) {
  return niceFractionPartFont(value) === CMR7_FONT_FAMILY ? "normal" : "italic";
}

function renderSurroundingMath(value, baseFontSize, binaryOperatorSpace, isSuffix = false) {
  const source = String(value || "");
  const preserveLeadingSpace = /^\s*~/.test(source);
  const preserveTrailingSpace = /~\s*$/.test(source);
  const plain = mathFallbackText(source).replace(/\s+/g, " ").trim();
  if (!plain) return "";
  const spaced = `${preserveLeadingSpace ? "\u00a0" : ""}${plain}${preserveTrailingSpace ? "\u00a0" : ""}`;
  if (isSuffix && spaced.startsWith("⋅")) {
    const remainder = spaced.slice(1).trimStart();
    return `<tspan class="tikz-nicefrac-suffix" dx="${format(binaryOperatorSpace)}"><tspan font-family="${escapeAttribute(
      TIKZ_MATH_MAIN_FONT_FAMILY
    )}" font-style="normal">⋅</tspan><tspan dx="${format(binaryOperatorSpace)}"></tspan>${renderMathTextWithUprightOperators(
      remainder
    )}</tspan>`;
  }
  const className = isSuffix ? "tikz-nicefrac-suffix" : "tikz-nicefrac-prefix";
  return `<tspan class="${className}">${renderMathTextWithUprightOperators(spaced)}</tspan>`;
}
