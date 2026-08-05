import { MATH_FALLBACK_NAMED_OPERATORS, mathFallbackText } from "../../tikz/text.js";
import {
  TIKZ_MATH_ITALIC_FONT_FAMILY,
  TIKZ_MATH_MAIN_FONT_FAMILY
} from "../../tikz/metrics.js";
import { escapeAttribute, escapeText } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import {
  isAccentMathAtom,
  mathScriptFallbackText,
  readBalancedGroup,
  readMathScriptAtom,
  readMathScriptValue,
  skipInlineWhitespace
} from "./mathFallbackSyntax.js";
import { svgTextAnchorPoint } from "./textLayout.js";

const SVG_MATH_OPERATOR_WORDS = new Set(MATH_FALLBACK_NAMED_OPERATORS);

export function renderSimpleSubscriptMathFallback(item, parts, baseFontSize, unit, color, fontStyle, fontWeight) {
  const subFontSize = baseFontSize * 0.7;
  const anchor = svgTextAnchorPoint(item, unit);
  return `<text x="${format(anchor.x)}" y="${format(anchor.y)}" fill="${color}" text-anchor="${anchor.anchor}" dominant-baseline="middle" font-size="${format(
    baseFontSize
  )}" font-style="italic"${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(
    TIKZ_MATH_ITALIC_FONT_FAMILY
  )}">${renderMathBaseText(parts.base)}<tspan font-size="${format(
    subFontSize
  )}" font-style="normal" baseline-shift="sub">${renderMathTextWithUprightOperators(parts.subscript)}</tspan></text>`;
}

export function renderHatSubscriptMathFallback(item, parts, baseFontSize, unit, color, fontStyle, fontWeight) {
  const subFontSize = baseFontSize * 0.7;
  const anchor = svgTextAnchorPoint(item, unit);
  const x = anchor.x;
  const y = anchor.y;
  const baseWidth = Math.max(baseFontSize * 0.42, parts.base.length * baseFontSize * 0.44);
  const hatWidth = Math.max(baseFontSize * 0.28, baseWidth * 0.72);
  const textCenterX = anchor.anchor === "start" ? x + baseWidth / 2 : anchor.anchor === "end" ? x - baseWidth / 2 : x;
  const hatX = textCenterX - baseWidth * 0.08;
  const hatY = y - baseFontSize * 0.44;
  const text = `<text x="${format(x)}" y="${format(y)}" fill="${color}" dominant-baseline="middle" font-size="${format(
    baseFontSize
  )}" font-style="italic"${fontWeight ? ` font-weight="${fontWeight}"` : ""} text-anchor="${anchor.anchor}" font-family="${escapeAttribute(
    TIKZ_MATH_ITALIC_FONT_FAMILY
  )}">${renderMathBaseText(parts.base)}<tspan font-size="${format(
    subFontSize
  )}" font-style="normal" baseline-shift="sub">${renderMathTextWithUprightOperators(parts.subscript)}</tspan></text>`;
  const hat = `<path d="M ${format(hatX - hatWidth / 2)} ${format(hatY + baseFontSize * 0.07)} L ${format(hatX)} ${format(
    hatY - baseFontSize * 0.08
  )} L ${format(hatX + hatWidth / 2)} ${format(hatY + baseFontSize * 0.07)}" stroke="${color}" fill="none" stroke-width="${format(
    Math.max(0.45, baseFontSize * 0.06)
  )}" stroke-linecap="round" stroke-linejoin="round" />`;
  return `<g class="tikz-math-hat">${text}${hat}</g>`;
}

export function renderMixedSubscriptMathFallback(item, segments, baseFontSize, unit, color, fontStyle, fontWeight) {
  const anchor = svgTextAnchorPoint(item, unit);
  const content = renderMixedSubscriptContent(segments, baseFontSize);
  return `<text x="${format(anchor.x)}" y="${format(anchor.y)}" fill="${color}" text-anchor="${anchor.anchor}" dominant-baseline="middle" font-size="${format(
    baseFontSize
  )}" font-style="italic"${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(
    TIKZ_MATH_ITALIC_FONT_FAMILY
  )}">${content}</text>`;
}

export function renderScriptedMathFallback(item, segments, baseFontSize, unit, color, fontStyle, fontWeight) {
  const anchor = svgTextAnchorPoint(item, unit);
  const content = renderScriptedSegmentsContent(segments, baseFontSize);
  const textLength = scriptedMathFallbackTextLength(segments, baseFontSize);
  const textLengthAttrs = Number.isFinite(textLength) ? ` textLength="${format(textLength)}" lengthAdjust="spacing"` : "";
  return `<text x="${format(anchor.x)}" y="${format(anchor.y)}" fill="${color}" text-anchor="${anchor.anchor}" dominant-baseline="middle" font-size="${format(
    baseFontSize
  )}"${textLengthAttrs} font-style="italic"${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(
    TIKZ_MATH_ITALIC_FONT_FAMILY
  )}">${content}</text>`;
}

export function scriptedMathFallbackTextLength(segments, baseFontSize) {
  if (!segments?.some((segment, index) => segment.kind === "script" && startsWithNamedMathOperator(segments[index + 1]?.text))) return NaN;
  const plain = segments
    .map((segment) => {
      if (segment.kind === "text" || segment.kind === "bold") return segment.text || "";
      return `${segment.base || ""}${segment.superscript || ""}${segment.subscript || ""}`;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  const charCount = Math.max(1, [...plain].length);
  return charCount * baseFontSize * 0.39;
}

export function renderSimpleSubscriptContent(parts, baseFontSize) {
  const subFontSize = baseFontSize * 0.7;
  return `${renderMathBaseText(parts.base)}<tspan font-size="${format(
    subFontSize
  )}" font-style="normal" baseline-shift="sub">${escapeText(parts.subscript)}</tspan>`;
}

export function renderMixedSubscriptContent(segments, baseFontSize) {
  const subFontSize = baseFontSize * 0.7;
  return segments
    .map((segment) => {
      if (segment.kind === "text") return renderMathTextWithUprightOperators(segment.text);
      return `${renderMathBaseText(segment.base)}<tspan font-size="${format(
        subFontSize
      )}" font-style="normal" baseline-shift="sub">${renderMathTextWithUprightOperators(segment.subscript)}</tspan>`;
    })
    .join("");
}

export function renderLeadingScriptContent(parts, baseFontSize) {
  const scriptFontSize = baseFontSize * 0.66;
  const shift = parts.kind === "super" ? "super" : "sub";
  return `<tspan font-size="${format(scriptFontSize)}" font-style="normal" baseline-shift="${shift}">${renderNestedScriptText(
    parts.text,
    scriptFontSize
  )}</tspan>`;
}

export function renderScriptedSegmentsContent(segments, baseFontSize) {
  const scriptFontSize = baseFontSize * 0.66;
  const superscriptExtraDy = Math.max(2, baseFontSize * 0.22);
  const operatorSpacing =
    segments.some((segment) => segment.operatorSpacing) ||
    segments.some((segment) => segment.kind === "text" && /[=+≤≥≠≈∼]/.test(segment.text));
  return segments
    .map((segment, index) => {
      if (segment.kind === "text") {
        if (operatorSpacing) return renderMathOperatorSpacedText(segment.text, baseFontSize);
        const leadingOperatorDx =
          index > 0 && segments[index - 1]?.kind === "script" && startsWithNamedMathOperator(segment.text) ? Math.max(1.4, baseFontSize * 0.16) : 0;
        return renderMathTextWithUprightOperators(segment.text, { leadingOperatorDx });
      }
      if (segment.kind === "bold") return `<tspan font-weight="700" font-style="normal">${escapeText(segment.text)}</tspan>`;
      const base = renderMathScriptBase(segment, baseFontSize);
      if (segment.superscript && segment.subscript) {
        const backtrack = Math.max(0, estimateScriptTextWidth(segment.superscript, scriptFontSize));
        return `${base}<tspan font-size="${format(scriptFontSize)}" font-style="normal" baseline-shift="super">${renderNestedScriptText(
          segment.superscript,
          scriptFontSize
        )}</tspan><tspan dx="${format(-backtrack)}" font-size="${format(
          scriptFontSize
        )}" font-style="normal" baseline-shift="sub">${renderNestedScriptText(segment.subscript, scriptFontSize)}</tspan>`;
      }
      if (segment.superscript) {
        const explicitShift = shouldUseExplicitSuperscriptDy(segment.superscript);
        const dy = explicitShift ? ` dy="${format(-superscriptExtraDy)}"` : "";
        const resetDy = explicitShift ? `<tspan dy="${format(superscriptExtraDy)}"></tspan>` : "";
        return `${base}<tspan font-size="${format(scriptFontSize)}" font-style="normal" baseline-shift="super"${dy}>${renderNestedScriptText(
          segment.superscript,
          scriptFontSize
        )}</tspan>${resetDy}`;
      }
      return `${base}<tspan font-size="${format(scriptFontSize)}" font-style="normal" baseline-shift="sub">${renderNestedScriptText(
        segment.subscript,
        scriptFontSize
      )}</tspan>`;
    })
    .join("");
}

function renderMathScriptBase(segment, baseFontSize) {
  let content;
  if (segment.groupContent !== null && segment.groupContent !== undefined) {
    const nested = scriptedMathFallback(segment.groupContent, { allowSimpleScripts: true });
    content = nested
      ? renderScriptedSegmentsContent(nested, baseFontSize)
      : renderMathTextWithUprightOperators(mathFallbackText(segment.groupContent));
    content = `<tspan class="tikz-math-script-group">${content}</tspan>`;
  } else {
    content = renderMathBaseText(segment.base);
  }
  return segment.bold ? `<tspan font-weight="700" font-style="normal">${content}</tspan>` : content;
}

function shouldUseExplicitSuperscriptDy(value) {
  const text = String(value || "").trim();
  if (!text || text === "°" || text === "\\circ") return false;
  return text.length > 1 || /[+\-=()/\\_^]/.test(text);
}

export function renderMathBaseText(text) {
  const raw = String(text || "");
  if (!raw.includes("\u0304")) return `<tspan>${renderMathTextWithUprightOperators(raw)}</tspan>`;
  const parts = [];
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (raw[index + 1] === "\u0304") {
      parts.push(`<tspan text-decoration="overline">${renderMathTextWithUprightOperators(char)}</tspan>`);
      index += 1;
    } else {
      parts.push(`<tspan>${renderMathTextWithUprightOperators(char)}</tspan>`);
    }
  }
  return parts.join("");
}

export function texNeedsOperatorSpacing(tex) {
  return /\\(?:leq|le|geq|ge|neq|approx|sim)(?![A-Za-z])|[=<>∼]/.test(String(tex || ""));
}

export function renderMathOperatorSpacedText(text, baseFontSize) {
  const source = String(text || "");
  if (!/[=+≤≥≠≈∼]/.test(source)) return renderMathTextWithUprightOperators(source);
  // TeX's relation spacing is \thickmuskip=5mu. One mu is 1/18em, so
  // relation atoms receive 5/18em on each side at the current math size.
  const spacing = Math.max(1.5, baseFontSize * (5 / 18));
  let output = "";
  let buffer = "";
  for (const char of source) {
    if (/[=+≤≥≠≈∼]/.test(char)) {
      if (buffer) {
        output += renderMathTextWithUprightOperators(buffer);
        buffer = "";
      }
      output += `<tspan dx="${format(spacing)}" font-family="${escapeAttribute(
        TIKZ_MATH_MAIN_FONT_FAMILY
      )}" font-style="normal">${escapeText(char)}</tspan><tspan dx="${format(spacing)}"></tspan>`;
    } else {
      buffer += char;
    }
  }
  if (buffer) output += renderMathTextWithUprightOperators(buffer);
  return output;
}

export function renderMathTextWithUprightOperators(text, options = {}) {
  const source = String(text || "");
  let output = "";
  let cursor = 0;
  const wordPattern = /[A-Za-z]+|⋅/g;
  let match;
  while ((match = wordPattern.exec(source))) {
    const word = match[0];
    output += escapeText(source.slice(cursor, match.index));
    if (word === "⋅" || SVG_MATH_OPERATOR_WORDS.has(word)) {
      const leadingOperatorDx = options.leadingOperatorDx ? ` dx="${format(options.leadingOperatorDx)}"` : "";
      output += `<tspan${leadingOperatorDx} font-family="${escapeAttribute(
        TIKZ_MATH_MAIN_FONT_FAMILY
      )}" font-style="normal">${escapeText(word)}</tspan>`;
    } else {
      output += escapeText(word);
    }
    cursor = match.index + word.length;
  }
  output += escapeText(source.slice(cursor));
  return output;
}

export function startsWithNamedMathOperator(text) {
  const match = String(text || "").trim().match(/^[A-Za-z]+/);
  return Boolean(match && SVG_MATH_OPERATOR_WORDS.has(match[0]));
}

export function estimateScriptTextWidth(text, fontSize) {
  return [...String(text || "")].length * fontSize * 0.42;
}

export function estimateScriptedSegmentsWidth(segments, baseFontSize) {
  const scriptFontSize = baseFontSize * 0.66;
  return (segments || []).reduce((total, segment) => {
    if (segment.kind === "text" || segment.kind === "bold") {
      return total + estimateFallbackMathTextWidth(segment.text, baseFontSize);
    }
    const baseWidth = segment.groupContent !== null && segment.groupContent !== undefined
      ? estimateGroupedScriptBaseWidth(segment.groupContent, baseFontSize)
      : estimateFallbackMathTextWidth(segment.base, baseFontSize);
    const superscriptWidth = segment.superscript ? estimateScriptTextWidth(segment.superscript, scriptFontSize) : 0;
    const subscriptWidth = segment.subscript ? estimateScriptTextWidth(segment.subscript, scriptFontSize) : 0;
    // TeX advances past the wider script, rather than summing both scripts.
    return total + baseWidth + Math.max(superscriptWidth, subscriptWidth);
  }, 0);
}

function estimateGroupedScriptBaseWidth(source, baseFontSize) {
  const nested = scriptedMathFallback(source, { allowSimpleScripts: true });
  return nested
    ? estimateScriptedSegmentsWidth(nested, baseFontSize)
    : estimateFallbackMathTextWidth(mathFallbackText(source), baseFontSize);
}

function estimateFallbackMathTextWidth(text, fontSize) {
  const source = String(text || "");
  const relationCount = [...source].filter((char) => "=+≤≥≠≈∼".includes(char)).length;
  return [...source].length * fontSize * 0.42 + relationCount * fontSize * (10 / 18);
}

export function renderNestedScriptText(text, fontSize) {
  const raw = String(text || "");
  const nestedFontSize = fontSize * 0.74;
  let output = "";
  let cursor = 0;
  const pattern = /([_^])([A-Za-z0-9+\-=()]+)/g;
  let match;
  while ((match = pattern.exec(raw))) {
    output += renderMathTextWithUprightOperators(raw.slice(cursor, match.index));
    output += `<tspan font-size="${format(nestedFontSize)}" baseline-shift="${
      match[1] === "^" ? "super" : "sub"
    }">${renderMathTextWithUprightOperators(match[2])}</tspan>`;
    cursor = pattern.lastIndex;
  }
  output += renderMathTextWithUprightOperators(raw.slice(cursor));
  return output;
}

export function simpleNumericSubscriptFallback(tex) {
  const raw = String(tex || "")
    .trim()
    .replace(/^\\(?:bf|bfseries)\b\s*/, "");
  const match = raw.match(/^((?:\\[A-Za-z]+(?:\s*\{[^{}]*\})?)|[A-Za-z])\s*_\s*(?:\{([A-Za-z0-9]+)\}|([A-Za-z0-9]+))$/);
  if (!match) return null;
  const base = mathFallbackText(match[1]);
  const subscript = match[2] || match[3];
  if (!base || !subscript) return null;
  return { base, subscript };
}

export function hatAccentSubscriptFallback(tex) {
  const raw = String(tex || "")
    .trim()
    .replace(/^\\(?:bf|bfseries)\b\s*/, "");
  const match = raw.match(/^\\hat\s*(?:\{([^{}]+)\}|([A-Za-z]))\s*_\s*(?:\{([^{}]+)\}|([A-Za-z0-9]+))$/);
  if (!match) return null;
  const base = mathFallbackText(match[1] || match[2]);
  const subscript = mathScriptFallbackText(match[3] || match[4]);
  if (!base || !subscript) return null;
  return { base, subscript };
}

export function mixedAlphabeticSubscriptFallback(tex) {
  const raw = String(tex || "")
    .trim()
    .replace(/^\\(?:bf|bfseries)\b\s*/, "");
  const pattern = /((?:\\[A-Za-z]+(?:\s*\{[^{}]*\})?)|[A-Za-z])\s*_\s*(?:\{([A-Za-z0-9+\-=,]+)\}|([A-Za-z0-9+\-=,]))/g;
  const segments = [];
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(raw))) {
    const before = raw.slice(lastIndex, match.index);
    const beforeText = mathFallbackSegmentText(before);
    if (beforeText) segments.push({ kind: "text", text: beforeText });
    const base = mathFallbackText(match[1]);
    const subscript = mathScriptFallbackText(match[2] || match[3]);
    if (!base || !subscript) return null;
    segments.push({ kind: "subscript", base, subscript });
    lastIndex = pattern.lastIndex;
  }
  if (!segments.some((segment) => segment.kind === "subscript")) return null;
  const afterText = mathFallbackSegmentText(raw.slice(lastIndex));
  if (afterText) segments.push({ kind: "text", text: afterText });
  return segments;
}

export function scriptedMathFallback(tex, options = {}) {
  const raw = String(tex || "")
    .trim()
    .replace(/^\\(?:bf|bfseries)\b\s*/, "");
  const segments = [];
  let cursor = 0;
  let lastIndex = 0;
  let hasScript = false;
  let hasSuperscript = false;
  let hasCommandScriptValue = false;
  let hasAccentBaseScript = false;
  let hasParenthesizedSuperscript = false;
  let hasNonDegreeScript = false;
  while (cursor < raw.length) {
    const atom = readMathScriptAtom(raw, cursor);
    if (!atom) {
      cursor += 1;
      continue;
    }
    let next = atom.end;
    let subscript = null;
    let superscript = null;
    for (let i = 0; i < 2; i += 1) {
      next = skipInlineWhitespace(raw, next);
      const marker = raw[next];
      if (marker !== "_" && marker !== "^") break;
      const script = readMathScriptValue(raw, next + 1);
      if (!script) break;
      if (marker === "_") subscript = script.value;
      else {
        superscript = script.value;
        hasSuperscript = true;
      }
      if (/^\\[A-Za-z]+/.test(script.value)) hasCommandScriptValue = true;
      next = script.end;
    }
    if (!subscript && !superscript) {
      cursor = atom.end;
      continue;
    }
    const before = mathFallbackSegmentText(raw.slice(lastIndex, cursor));
    if (before) segments.push({ kind: "text", text: before });
    const base = mathFallbackText(atom.source);
    if (!base) return null;
    if (subscript && isAccentMathAtom(atom.source)) hasAccentBaseScript = true;
    if (superscript && atom.parenthesized) hasParenthesizedSuperscript = true;
    const normalizedSubscript = subscript ? mathScriptFallbackText(subscript) : null;
    const normalizedSuperscript = superscript ? mathScriptFallbackText(superscript) : null;
    if (normalizedSubscript || (normalizedSuperscript && normalizedSuperscript !== "°")) hasNonDegreeScript = true;
    segments.push({
      kind: "script",
      base,
      groupContent: atom.groupContent || null,
      subscript: normalizedSubscript,
      superscript: normalizedSuperscript,
      operatorSpacing: Boolean(superscript && atom.parenthesized)
    });
    hasScript = true;
    lastIndex = next;
    cursor = next;
  }
  if (
    !hasScript ||
    (!options.allowSimpleScripts && !hasSuperscript && !hasCommandScriptValue && !hasAccentBaseScript && !hasParenthesizedSuperscript)
  ) {
    return null;
  }
  const after = mathFallbackSegmentText(raw.slice(lastIndex));
  if (after) segments.push({ kind: "text", text: after });
  return segments;
}

export function styledScriptedMathFallback(tex) {
  const raw = String(tex || "")
    .trim()
    .replace(/^\\(?:bf|bfseries)\b\s*/, "");
  const segments = [];
  let cursor = 0;
  let lastIndex = 0;
  let matched = false;
  let hasNonDegreeScript = false;
  while (cursor < raw.length) {
    const bold = readScopedBoldSegment(raw, cursor);
    if (bold) {
      const before = mathFallbackSegmentText(raw.slice(lastIndex, cursor));
      if (before) segments.push({ kind: "text", text: before });
      let next = bold.end;
      let subscript = null;
      let superscript = null;
      for (let i = 0; i < 2; i += 1) {
        next = skipInlineWhitespace(raw, next);
        const marker = raw[next];
        if (marker !== "_" && marker !== "^") break;
        const script = readMathScriptValue(raw, next + 1);
        if (!script) break;
        if (marker === "_") subscript = script.value;
        else superscript = script.value;
        next = script.end;
      }
      if (subscript || superscript) {
        const normalizedSubscript = subscript ? mathScriptFallbackText(subscript) : null;
        const normalizedSuperscript = superscript ? mathScriptFallbackText(superscript) : null;
        if (normalizedSubscript || (normalizedSuperscript && normalizedSuperscript !== "°")) hasNonDegreeScript = true;
        segments.push({
          kind: "script",
          base: bold.text,
          groupContent: null,
          subscript: normalizedSubscript,
          superscript: normalizedSuperscript,
          bold: true
        });
      } else if (bold.text) {
        segments.push({ kind: "bold", text: bold.text });
      }
      lastIndex = next;
      cursor = next;
      matched = true;
      continue;
    }
    const atom = readMathScriptAtom(raw, cursor);
    if (!atom) {
      cursor += 1;
      continue;
    }
    let next = atom.end;
    let subscript = null;
    let superscript = null;
    for (let i = 0; i < 2; i += 1) {
      next = skipInlineWhitespace(raw, next);
      const marker = raw[next];
      if (marker !== "_" && marker !== "^") break;
      const script = readMathScriptValue(raw, next + 1);
      if (!script) break;
      if (marker === "_") subscript = script.value;
      else superscript = script.value;
      next = script.end;
    }
    if (!subscript && !superscript) {
      cursor = atom.end;
      continue;
    }
    const before = mathFallbackSegmentText(raw.slice(lastIndex, cursor));
    if (before) segments.push({ kind: "text", text: before });
    const base = mathFallbackText(atom.source);
    if (!base) return null;
    const normalizedSubscript = subscript ? mathScriptFallbackText(subscript) : null;
    const normalizedSuperscript = superscript ? mathScriptFallbackText(superscript) : null;
    if (normalizedSubscript || (normalizedSuperscript && normalizedSuperscript !== "°")) hasNonDegreeScript = true;
    segments.push({
      kind: "script",
      base,
      groupContent: atom.groupContent || null,
      subscript: normalizedSubscript,
      superscript: normalizedSuperscript
    });
    lastIndex = next;
    cursor = next;
    matched = true;
  }
  if (!matched) return null;
  const after = mathFallbackSegmentText(raw.slice(lastIndex));
  if (after) segments.push({ kind: "text", text: after });
  return segments;
}

export function mathFallbackSegmentText(source) {
  const raw = String(source || "");
  const fallback = mathFallbackText(raw);
  if (!fallback) return "";
  const leading = /^\s/.test(raw) ? " " : "";
  const trailing = /\s$/.test(raw) && !/\\cdot\s+$/.test(raw) ? " " : "";
  return `${leading}${fallback}${trailing}`;
}

export function readScopedBoldSegment(raw, start) {
  if (raw[start] === "{") {
    const group = readBalancedGroup(raw, start);
    const content = group?.content.trim() || "";
    if (!/^\\(?:bf|bfseries)\b/.test(content)) return null;
    const text = mathFallbackText(group.content);
    return text ? { text, end: group.end } : null;
  }
  const command = raw.slice(start).match(/^\\(?:mathbf|boldsymbol|textbf)\b\s*/);
  if (!command) return null;
  const group = readBalancedGroup(raw, start + command[0].length);
  if (!group) return null;
  const text = mathFallbackText(group.content);
  return text ? { text, end: group.end } : null;
}

export function leadingScriptFallback(tex) {
  const raw = String(tex || "").trim();
  const marker = raw[0];
  if (marker !== "_" && marker !== "^") return null;
  const script = readMathScriptValue(raw, 1);
  if (!script) return null;
  if (skipInlineWhitespace(raw, script.end) < raw.length) return null;
  const text = mathScriptFallbackText(script.value);
  if (!text) return null;
  return { kind: marker === "^" ? "super" : "sub", text };
}
