import { mathFallbackText } from "../../tikz/text.js";
import { TIKZ_FONT_FAMILY } from "../../tikz/metrics.js";
import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { readBalancedGroup, skipInlineWhitespace } from "./mathFallbackSyntax.js";
import { renderFractionPartContent } from "./mathFractionFallback.js";
import { estimateRichTextWidthEm } from "./richText.js";

export function sumLimitsInlineFallback(tex) {
  const raw = String(tex || "");
  const sumIndex = raw.indexOf("\\sum");
  if (sumIndex === -1) return null;
  let cursor = sumIndex + "\\sum".length;
  cursor = skipInlineWhitespace(raw, cursor);
  let hasLimits = false;
  if (raw.startsWith("\\limits", cursor)) {
    hasLimits = true;
    cursor += "\\limits".length;
    cursor = skipInlineWhitespace(raw, cursor);
  }
  if (raw[cursor] !== "_") return null;
  const lower = readMathScriptArgument(raw, cursor + 1);
  if (!lower) return null;
  cursor = skipInlineWhitespace(raw, lower.end);
  if (raw[cursor] !== "^") return null;
  const upper = readMathScriptArgument(raw, cursor + 1);
  if (!upper) return null;
  cursor = skipInlineWhitespace(raw, upper.end);
  let term = "";
  const termGroup = readBalancedGroup(raw, cursor);
  if (termGroup) {
    term = termGroup.content;
    cursor = termGroup.end;
  }
  return {
    prefix: raw.slice(0, sumIndex),
    hasLimits,
    lower: lower.content,
    upper: upper.content,
    term,
    suffix: raw.slice(cursor)
  };
}

export function readMathScriptArgument(raw, cursor) {
  cursor = skipInlineWhitespace(raw, cursor);
  const group = readBalancedGroup(raw, cursor);
  if (group) return group;
  const match = String(raw || "").slice(cursor).match(/^\\?[A-Za-z0-9+\-=()]+/);
  if (!match) return null;
  return { content: match[0], end: cursor + match[0].length };
}

export function renderSumLimitsInlineFallback(item, parts, baseFontSize, unit, color, fontStyle, fontWeight) {
  const fontSize = baseFontSize;
  const limitFontSize = fontSize * 0.52;
  const sumFontSize = fontSize * 1.08;
  const gap = fontSize * 0.04;
  const prefixWidth = parts.prefix ? sumLimitsPartWidth(parts.prefix, fontSize) : 0;
  const termWidth = parts.term ? sumLimitsPartWidth(parts.term, fontSize) : 0;
  const suffixWidth = parts.suffix ? sumLimitsPartWidth(parts.suffix, fontSize) : 0;
  const limitWidth = Math.max(
    sumLimitsPartWidth(parts.upper, limitFontSize),
    sumLimitsPartWidth(parts.lower, limitFontSize),
    sumFontSize * 0.46
  );
  const totalWidth = prefixWidth + limitWidth + termWidth + suffixWidth + gap * 3;
  const x = item.x * unit;
  const y = -item.y * unit;
  let cursor = x - totalWidth / 2;
  const textAttrs = `fill="${color}" text-anchor="middle" dominant-baseline="middle"${fontStyle ? ` font-style="${fontStyle}"` : ""}${
    fontWeight ? ` font-weight="${fontWeight}"` : ""
  } font-family="${escapeAttribute(TIKZ_FONT_FAMILY)}"`;
  const partsOut = [`<g class="tikz-sum-limits-inline">`];
  if (prefixWidth) {
    partsOut.push(`<text x="${format(cursor + prefixWidth / 2)}" y="${format(y)}" ${textAttrs} font-size="${format(fontSize)}">${renderFractionPartContent(
      parts.prefix,
      fontSize
    )}</text>`);
    cursor += prefixWidth + gap;
  }
  const sumX = cursor + limitWidth / 2;
  partsOut.push(`<text x="${format(sumX)}" y="${format(y + fontSize * 0.08)}" ${textAttrs} font-size="${format(sumFontSize)}">∑</text>`);
  partsOut.push(`<text x="${format(sumX)}" y="${format(y - fontSize * 0.66)}" ${textAttrs} font-size="${format(limitFontSize)}">${renderSumLimitPartContent(
    parts.upper,
    limitFontSize
  )}</text>`);
  partsOut.push(`<text x="${format(sumX)}" y="${format(y + fontSize * 0.72)}" ${textAttrs} font-size="${format(limitFontSize)}">${renderSumLimitPartContent(
    parts.lower,
    limitFontSize
  )}</text>`);
  cursor += limitWidth + gap;
  if (termWidth) {
    partsOut.push(`<text x="${format(cursor + termWidth / 2)}" y="${format(y)}" ${textAttrs} font-size="${format(fontSize)}">${renderFractionPartContent(
      parts.term,
      fontSize
    )}</text>`);
    cursor += termWidth + gap;
  }
  if (suffixWidth) {
    partsOut.push(`<text x="${format(cursor + suffixWidth / 2)}" y="${format(y)}" ${textAttrs} font-size="${format(fontSize)}">${renderFractionPartContent(
      parts.suffix,
      fontSize
    )}</text>`);
  }
  partsOut.push("</g>");
  return partsOut.join("");
}

export function renderSumLimitsContentFallback(tex, baseFontSize) {
  const parts = sumLimitsInlineFallback(tex);
  if (!parts) return null;
  if (!parts.hasLimits) return renderSumSideScriptsContentFallback(parts, baseFontSize);
  const limitFontSize = baseFontSize * 0.58;
  const sumFontSize = baseFontSize * 1.08;
  const upperWidth = sumLimitsPartWidth(parts.upper, limitFontSize);
  const lowerWidth = sumLimitsPartWidth(parts.lower, limitFontSize);
  const sumAdvance = sumFontSize * 0.54;
  const stackWidth = Math.max(upperWidth, lowerWidth, sumFontSize * 0.46);
  const upperDx = -(sumAdvance / 2 + upperWidth / 2);
  const lowerDx = -((upperWidth + lowerWidth) / 2);
  const tailDx = Math.max(baseFontSize * 0.18, sumAdvance / 2 - lowerWidth / 2 + baseFontSize * 0.18);
  const output = [];
  const tail = `${parts.term || ""}${parts.suffix || ""}`;
  if (parts.prefix) output.push(renderFractionPartContent(parts.prefix, baseFontSize));
  output.push(
    `<tspan class="tikz-sum-limits-content" font-size="${format(sumFontSize)}" font-style="normal">∑</tspan>`
  );
  output.push(
    `<tspan font-size="${format(limitFontSize)}" font-style="normal" dx="${format(
      upperDx
    )}" dy="${format(-baseFontSize * 0.62)}">${renderSumLimitPartContent(parts.upper, limitFontSize)}</tspan>`
  );
  output.push(
    `<tspan font-size="${format(limitFontSize)}" font-style="normal" dx="${format(
      lowerDx
    )}" dy="${format(baseFontSize * 1.1)}">${renderSumLimitPartContent(parts.lower, limitFontSize)}</tspan>`
  );
  if (tail.trim()) {
    output.push(
      `<tspan font-size="${format(baseFontSize)}" dx="${format(
        Math.max(tailDx, stackWidth - lowerWidth + baseFontSize * 0.18)
      )}" dy="${format(-baseFontSize * 0.48)}">${renderFractionPartContent(tail, baseFontSize)}</tspan>`
    );
  }
  return output.join("");
}

export function renderSumSideScriptsContentFallback(parts, baseFontSize) {
  const limitFontSize = baseFontSize * 0.58;
  const sumFontSize = baseFontSize * 1.08;
  const upperWidth = sumLimitsPartWidth(parts.upper, limitFontSize);
  const lowerWidth = sumLimitsPartWidth(parts.lower, limitFontSize);
  const output = [];
  const tail = `${parts.term || ""}${parts.suffix || ""}`;
  if (parts.prefix) output.push(renderFractionPartContent(parts.prefix, baseFontSize));
  output.push(
    `<tspan class="tikz-sum-sidescripts-content" font-size="${format(sumFontSize)}" font-style="normal">∑</tspan>`
  );
  output.push(
    `<tspan font-size="${format(limitFontSize)}" font-style="normal" dx="${format(
      baseFontSize * 0.05
    )}" dy="${format(-baseFontSize * 0.46)}">${renderSumLimitPartContent(parts.upper, limitFontSize)}</tspan>`
  );
  output.push(
    `<tspan font-size="${format(limitFontSize)}" font-style="normal" dx="${format(
      -upperWidth
    )}" dy="${format(baseFontSize * 0.72)}">${renderSumLimitPartContent(parts.lower, limitFontSize)}</tspan>`
  );
  if (tail.trim()) {
    output.push(
      `<tspan font-size="${format(baseFontSize)}" dx="${format(
        Math.max(baseFontSize * 0.12, upperWidth - lowerWidth + baseFontSize * 0.12)
      )}" dy="${format(-baseFontSize * 0.26)}">${renderFractionPartContent(tail, baseFontSize)}</tspan>`
    );
  }
  return output.join("");
}

export function sumLimitsPartWidth(tex, fontSize) {
  const fallback = compactSumLimitScriptOperators(mathFallbackText(tex).replace(/\s+/g, " ").trim());
  return Math.max(fontSize * 0.18, estimateRichTextWidthEm(fallback) * fontSize * 0.92);
}

export function renderSumLimitPartContent(tex, fontSize) {
  return renderFractionPartContent(tex, fontSize).replace(/(>[^<>]*)\s+([=<>≤≥])\s+([^<>]*<)/g, "$1$2$3");
}

export function compactSumLimitScriptOperators(text) {
  return String(text || "").replace(/\s+([=<>≤≥])\s+/g, "$1");
}
