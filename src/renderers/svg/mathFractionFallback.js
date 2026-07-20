import { mathFallbackText } from "../../tikz/text.js";
import { estimateFormulaBox } from "../../tikz/textMetrics.js";
import { TIKZ_MATH_ITALIC_FONT_FAMILY } from "../../tikz/metrics.js";
import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { readBalancedGroup, skipInlineWhitespace } from "./mathFallbackSyntax.js";
import {
  mixedAlphabeticSubscriptFallback,
  renderMathBaseText,
  renderMathOperatorSpacedText,
  renderScriptedSegmentsContent,
  renderMathTextWithUprightOperators,
  scriptedMathFallback
} from "./mathScriptFallback.js";
import { svgTextAnchorPoint } from "./textLayout.js";

export function renderFractionMathFallback(item, parts, baseFontSize, unit, color, fontStyle, fontWeight) {
  const fractionFontSize = baseFontSize * 0.78;
  const anchor = svgTextAnchorPoint(item, unit);
  const y = anchor.y;
  const numerator = renderFractionPartContent(parts.numerator, fractionFontSize);
  const denominator = renderFractionPartContent(parts.denominator, fractionFontSize);
  const width = Math.max(
    fractionTextWidth(parts.numerator, fractionFontSize),
    fractionTextWidth(parts.denominator, fractionFontSize),
    fractionFontSize * 0.9
  );
  const x = anchor.anchor === "start" ? anchor.x + width / 2 : anchor.anchor === "end" ? anchor.x - width / 2 : anchor.x;
  const commonTextAttrs = `fill="${color}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    fractionFontSize
  )}" font-style="italic"${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(
    TIKZ_MATH_ITALIC_FONT_FAMILY
  )}"`;
  return `<g class="tikz-fraction"><text x="${format(x)}" y="${format(y - fractionFontSize * 0.42)}" ${commonTextAttrs}>${numerator}</text><line x1="${format(
    x - width / 2
  )}" y1="${format(y + fractionFontSize * 0.08)}" x2="${format(x + width / 2)}" y2="${format(
    y + fractionFontSize * 0.08
  )}" stroke="${color}" stroke-width="${format(Math.max(0.45, fractionFontSize * 0.055))}" /><text x="${format(
    x
  )}" y="${format(y + fractionFontSize * 0.58)}" ${commonTextAttrs}>${denominator}</text></g>`;
}

export function renderInlineFractionMathFallback(item, parts, baseFontSize, unit, color, fontStyle, fontWeight) {
  const fractionFontSize = baseFontSize * 0.78;
  const inlineFontSize = baseFontSize;
  const anchor = svgTextAnchorPoint(item, unit);
  const y = anchor.y;
  const gap = inlineFontSize * 0.28;
  const prefixWidth = parts.prefix ? inlineFractionSegmentWidth(parts.prefix, inlineFontSize, unit) : 0;
  const suffixWidth = parts.suffix ? inlineFractionSegmentWidth(parts.suffix, inlineFontSize, unit) : 0;
  const fractionWidth = Math.max(
    fractionTextWidth(parts.numerator, fractionFontSize),
    fractionTextWidth(parts.denominator, fractionFontSize),
    fractionFontSize * 0.9
  );
  const totalWidth = prefixWidth + fractionWidth + suffixWidth + (prefixWidth ? gap : 0) + (suffixWidth ? gap : 0);
  let cursor = anchor.anchor === "start" ? anchor.x : anchor.anchor === "end" ? anchor.x - totalWidth : anchor.x - totalWidth / 2;
  const segmentTextAttrs = `fill="${color}" text-anchor="start" dominant-baseline="middle" font-size="${format(
    inlineFontSize
  )}" font-style="italic"${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(
    TIKZ_MATH_ITALIC_FONT_FAMILY
  )}"`;
  const fractionTextAttrs = `fill="${color}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    fractionFontSize
  )}" font-style="italic"${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(
    TIKZ_MATH_ITALIC_FONT_FAMILY
  )}"`;
  const output = [`<g class="tikz-inline-fraction">`];
  if (prefixWidth) {
    output.push(
      `<text x="${format(cursor)}" y="${format(y)}" ${segmentTextAttrs}>${renderFractionPartContent(parts.prefix, inlineFontSize)}</text>`
    );
    cursor += prefixWidth + gap;
  }
  const fractionX = cursor + fractionWidth / 2;
  output.push(`<text x="${format(fractionX)}" y="${format(y - fractionFontSize * 0.46)}" ${fractionTextAttrs}>${renderFractionPartContent(
    parts.numerator,
    fractionFontSize
  )}</text>`);
  output.push(`<line x1="${format(fractionX - fractionWidth / 2)}" y1="${format(y + fractionFontSize * 0.08)}" x2="${format(
    fractionX + fractionWidth / 2
  )}" y2="${format(y + fractionFontSize * 0.08)}" stroke="${color}" stroke-width="${format(Math.max(0.45, fractionFontSize * 0.055))}" />`);
  output.push(`<text x="${format(fractionX)}" y="${format(y + fractionFontSize * 0.6)}" ${fractionTextAttrs}>${renderFractionPartContent(
    parts.denominator,
    fractionFontSize
  )}</text>`);
  cursor += fractionWidth + (suffixWidth ? gap : 0);
  if (suffixWidth) {
    output.push(
      `<text x="${format(cursor)}" y="${format(y)}" ${segmentTextAttrs}>${renderFractionPartContent(parts.suffix, inlineFontSize)}</text>`
    );
  }
  output.push("</g>");
  return output.join("");
}

export function renderFractionPartContent(tex, fontSize) {
  if (/\\(?:frac|dfrac|tfrac)\s*\{/.test(String(tex || ""))) {
    return `<tspan>${renderMathTextWithUprightOperators(mathFallbackText(tex))}</tspan>`;
  }
  const scripted = scriptedMathFallback(tex);
  if (scripted) {
    return renderScriptedSegmentsContent(scripted, fontSize);
  }
  const mixed = mixedAlphabeticSubscriptFallback(tex);
  if (mixed) {
    const subFontSize = fontSize * 0.66;
    return mixed
      .map((segment) => {
        if (segment.kind === "text") return `<tspan>${renderMathOperatorSpacedText(segment.text, fontSize)}</tspan>`;
        return `${renderMathBaseText(segment.base)}<tspan font-size="${format(
          subFontSize
        )}" font-style="normal" baseline-shift="sub">${renderMathTextWithUprightOperators(segment.subscript)}</tspan>`;
      })
      .join("");
  }
  return `<tspan>${renderMathTextWithUprightOperators(mathFallbackText(tex))}</tspan>`;
}

export function fractionTextWidth(tex, fontSize) {
  return Math.max(1, mathFallbackText(tex).length) * fontSize * 0.56;
}

function inlineFractionSegmentWidth(tex, fontSize, unit) {
  const baseTenPointFontSize = (unit * 10) / 28.45274;
  const scale = baseTenPointFontSize > 0 ? fontSize / baseTenPointFontSize : 1;
  const box = estimateFormulaBox(tex, {
    scale,
    minWidth: 0,
    widthPadding: 0.25 * scale,
    texTextMetrics: true
  });
  return box.width * unit;
}

export function simpleFractionFallback(tex) {
  const raw = String(tex || "")
    .trim()
    .replace(/^\\(?:bf|bfseries)\b\s*/, "");
  const command = raw.match(/^\\(?:frac|dfrac|tfrac)\b/);
  if (!command) return null;
  let cursor = skipInlineWhitespace(raw, command[0].length);
  const numerator = readBalancedGroup(raw, cursor);
  if (!numerator) return null;
  cursor = skipInlineWhitespace(raw, numerator.end);
  const denominator = readBalancedGroup(raw, cursor);
  if (!denominator) return null;
  cursor = skipInlineWhitespace(raw, denominator.end);
  if (cursor !== raw.length) return null;
  return { numerator: numerator.content, denominator: denominator.content };
}

export function inlineFractionFallback(tex) {
  const raw = String(tex || "")
    .trim()
    .replace(/^\\(?:bf|bfseries)\b\s*/, "")
    .replace(/\\(?:displaystyle|textstyle|scriptstyle|scriptscriptstyle)(?![A-Za-z])\s*/g, "");
  const pattern = /\\(?:frac|dfrac|tfrac)\b/g;
  let match;
  while ((match = pattern.exec(raw))) {
    let cursor = skipInlineWhitespace(raw, match.index + match[0].length);
    const numerator = readBalancedGroup(raw, cursor);
    if (!numerator) continue;
    cursor = skipInlineWhitespace(raw, numerator.end);
    const denominator = readBalancedGroup(raw, cursor);
    if (!denominator) continue;
    cursor = skipInlineWhitespace(raw, denominator.end);
    const prefix = raw.slice(0, match.index).trim();
    const suffix = raw.slice(cursor).trim();
    if (!prefix && !suffix) return null;
    return { prefix, numerator: numerator.content, denominator: denominator.content, suffix };
  }
  return null;
}
