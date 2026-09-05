import { mathFallbackText, normalizeBrowserMathMacros } from "../../tikz/text.js";
import { TIKZ_MATH_MAIN_FONT_FAMILY } from "../../tikz/metrics.js";
import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { readBalancedGroup, skipInlineWhitespace } from "./mathFallbackSyntax.js";
import { renderMathTextWithUprightOperators, renderScriptedSegmentsContent, scriptedMathFallback } from "./mathScriptFallback.js";

const UPRIGHT_COMMAND = /\\(?:mathrm|textrm|textnormal|mathsf|mathtt|operatorname)\b/g;

// TeX math alphabets are scoped: in `d=\mathrm{m}`, only `m` changes
// alphabet. Serialize those scopes as SVG tspans instead of flattening the
// whole formula to a single font style.
export function renderScopedUprightMathContent(tex, fontSize) {
  const source = normalizeBrowserMathMacros(String(tex || ""));
  const scripted = scriptedMathFallback(source, { allowSimpleScripts: true });
  if (scripted) return renderScriptedSegmentsContent(scripted, fontSize);
  let output = "";
  let cursor = 0;
  let found = false;
  let match;

  while ((match = UPRIGHT_COMMAND.exec(source))) {
    const argumentStart = skipInlineWhitespace(source, match.index + match[0].length);
    const group = readBalancedGroup(source, argumentStart);
    if (!group) continue;
    output += renderMathFragment(source.slice(cursor, match.index), fontSize);
    output += `<tspan class="tikz-math-upright" font-family="${escapeAttribute(
      TIKZ_MATH_MAIN_FONT_FAMILY
    )}" font-style="normal">${renderMathFragment(group.content, fontSize)}</tspan>`;
    cursor = group.end;
    UPRIGHT_COMMAND.lastIndex = cursor;
    found = true;
  }

  if (!found) return "";
  return output + renderMathFragment(source.slice(cursor), fontSize);
}

function renderMathFragment(tex, fontSize) {
  const source = String(tex || "");
  if (!source) return "";
  const preserveTrailingThinSpace = /\\,\s*$/.test(source);
  const content = source.replace(/\\,\s*$/, "");
  const scripted = scriptedMathFallback(content, { allowSimpleScripts: true });
  const rendered = scripted
    ? renderScriptedSegmentsContent(scripted, fontSize)
    : renderMathTextWithUprightOperators(mathFallbackText(content), { fontSize });
  return preserveTrailingThinSpace
    ? `${rendered}<tspan class="tikz-math-thin-space" dx="${format(fontSize / 6)}"></tspan>`
    : rendered;
}
