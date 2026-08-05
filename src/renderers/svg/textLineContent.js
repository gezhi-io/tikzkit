import { parseMathText } from "../../tikz/textMetrics.js";
import { mathFallbackText, splitInlineMathSegments } from "../../tikz/text.js";
import { TIKZ_UNIT } from "../../tikz/metrics.js";
import { escapeAttribute, escapeText } from "./escape.js";
import { mathFallbackFontStyle, normalizeKatexTex } from "./mathFallbackSyntax.js";
import { renderSvgMathColorSegmentsContent, statefulColorMathTextFallback } from "./mathColorFallback.js";
import {
  leadingScriptFallback,
  mixedAlphabeticSubscriptFallback,
  renderLeadingScriptContent,
  renderMixedSubscriptContent,
  renderScriptedSegmentsContent,
  renderSimpleSubscriptContent,
  scriptedMathFallback,
  simpleNumericSubscriptFallback
} from "./mathScriptFallback.js";
import { renderSumLimitsContentFallback } from "./mathSumFallback.js";
import { niceFractionMathFallback, renderNiceFractionMathContent } from "./mathNiceFractionFallback.js";
import { formatPlainTexText, renderPlainSvgTextContent } from "./text.js";
import { hasInlineMathSource } from "./textLayout.js";

export function formatTextLine(line) {
  const math = parseMathText(line);
  if (math) return mathFallbackText(math.tex);
  const segments = splitInlineMathSegments(line);
  if (segments.some((segment) => segment.type === "math")) {
    return segments.map((segment) => (segment.type === "math" ? mathFallbackText(segment.tex) : formatPlainTexText(segment.text))).join("");
  }
  return formatPlainTexText(line);
}

export function renderSvgTextLineContent(sourceLine, formattedLine, fontSize, unit = TIKZ_UNIT) {
  const source = String(sourceLine ?? formattedLine ?? "").trim();
  const math = parseMathText(source);
  if (math) return renderSvgMathFallbackContent(normalizeKatexTex(math.tex), fontSize);
  if (hasInlineMathSource(source)) return renderInlineSvgMathContent(source, formattedLine, fontSize, unit);
  return renderPlainSvgTextContent(formattedLine ?? source, unit);
}

export function renderInlineSvgMathContent(source, formattedLine, fontSize, unit = TIKZ_UNIT) {
  const parts = [];
  for (const segment of splitInlineMathSegments(source)) {
    if (segment.type === "math") {
      const tex = normalizeKatexTex(segment.tex.trim());
      const content = renderSvgMathFallbackContent(tex, fontSize);
      const fontStyle = mathFallbackFontStyle(tex);
      parts.push(fontStyle ? `<tspan font-style="${escapeAttribute(fontStyle)}">${content}</tspan>` : content);
    } else if (segment.text) {
      parts.push(renderPlainSvgTextContent(formatPlainTexText(segment.text), unit));
    }
  }
  if (!parts.length) return renderPlainSvgTextContent(formattedLine ?? source, unit);
  return parts.join("");
}

export function renderSvgMathFallbackContent(tex, fontSize) {
  const statefulColor = statefulColorMathTextFallback(tex);
  if (statefulColor) return renderSvgMathColorSegmentsContent(statefulColor, fontSize, renderSvgMathFallbackContentWithoutColor);
  return renderSvgMathFallbackContentWithoutColor(tex, fontSize);
}

export function renderSvgMathFallbackContentWithoutColor(tex, fontSize) {
  const niceFraction = niceFractionMathFallback(tex);
  if (niceFraction) return renderNiceFractionMathContent(niceFraction, fontSize);
  const leadingScript = leadingScriptFallback(tex);
  if (leadingScript) return renderLeadingScriptContent(leadingScript, fontSize);
  const sumLimits = renderSumLimitsContentFallback(tex, fontSize);
  if (sumLimits) return sumLimits;
  const simple = simpleNumericSubscriptFallback(tex);
  if (simple) return renderSimpleSubscriptContent(simple, fontSize);
  const scripted = scriptedMathFallback(tex, { allowSimpleScripts: true });
  if (scripted) return renderScriptedSegmentsContent(scripted, fontSize);
  const mixed = mixedAlphabeticSubscriptFallback(tex);
  if (mixed) return renderMixedSubscriptContent(mixed, fontSize);
  return escapeText(mathFallbackText(tex));
}

export function hasInlineMath(normalized) {
  const source = String(normalized.raw || normalized.text || "");
  return hasInlineMathSource(source);
}
