import { parseMathText } from "../../tikz/textMetrics.js";
import { mathFallbackText, splitInlineMathSegments } from "../../tikz/text.js";
import { escapeHtml } from "./escape.js";
import { normalizeKatexTex } from "./mathFallbackSyntax.js";
import { renderScopedMathHtml } from "./mathHtml.js";
import { formatPlainTexText } from "./text.js";
import { collapseTeXParagraphWhitespace, hasInlineMathSource, wrapSvgTextLineWithSource } from "./textLayout.js";

export const KATEX_RICH_TEXT_LINE_BOX_SCALE = 1.6;
export const KATEX_RICH_TEXT_WRAP_WIDTH_SCALE = 0.98;
export const KATEX_RICH_TEXT_FONT_SCALE = 0.96;
export const TEX_SPACE_WIDTH_EM = 0.333;

const TEX_CHAR_WIDTHS_EM = new Map(
  Object.entries({
    " ": TEX_SPACE_WIDTH_EM,
    ".": 0.278,
    ",": 0.278,
    ";": 0.278,
    ":": 0.278,
    "!": 0.278,
    "?": 0.472,
    "-": 0.333,
    "(": 0.389,
    ")": 0.389,
    "[": 0.278,
    "]": 0.278,
    "{": 0.389,
    "}": 0.389,
    "|": 0.278,
    "=": 0.778,
    "+": 0.778,
    "/": 0.5,
    A: 0.75,
    B: 0.708,
    C: 0.722,
    D: 0.764,
    E: 0.681,
    F: 0.653,
    G: 0.785,
    H: 0.75,
    I: 0.361,
    J: 0.514,
    K: 0.778,
    L: 0.625,
    M: 0.917,
    N: 0.75,
    O: 0.778,
    P: 0.681,
    Q: 0.778,
    R: 0.736,
    S: 0.556,
    T: 0.722,
    U: 0.75,
    V: 0.75,
    W: 1.028,
    X: 0.75,
    Y: 0.75,
    Z: 0.611,
    a: 0.5,
    b: 0.556,
    c: 0.444,
    d: 0.556,
    e: 0.444,
    f: 0.306,
    g: 0.5,
    h: 0.556,
    i: 0.278,
    j: 0.306,
    k: 0.528,
    l: 0.278,
    m: 0.833,
    n: 0.556,
    o: 0.5,
    p: 0.556,
    q: 0.528,
    r: 0.392,
    s: 0.394,
    t: 0.389,
    u: 0.556,
    v: 0.528,
    w: 0.722,
    x: 0.528,
    y: 0.528,
    z: 0.444,
    "α": 0.625,
    "β": 0.625,
    "γ": 0.625,
    "δ": 0.625,
    "∥": 0.5
  })
);

export function richTextFallbackItem(item, align, hasWrapWidth) {
  if (!hasWrapWidth) return item;
  return {
    ...item,
    textAlign: item.textAlign || align,
    style: {
      ...(item.style || {}),
      fontScale: (Number(item.style?.fontScale) || 1) * KATEX_RICH_TEXT_FONT_SCALE,
      fontSizeBaseScale: (Number(item.style?.fontSizeBaseScale) || 1) * KATEX_RICH_TEXT_FONT_SCALE
    }
  };
}

export function cleanRichTextSource(source) {
  return String(source)
    .trim()
    .replace(/\\(?:Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b/g, "")
    .replace(/\\(?:tt|rm|sf|bfseries|itshape|slshape|scshape)\b/g, "")
    .replace(/\\dots/g, "…")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function richTextSourceLines(source, normalized) {
  if (normalized.displayMathSequence && Array.isArray(normalized.lines) && normalized.lines.length) {
    return normalized.lines.map(collapseTeXParagraphWhitespace).filter((line) => line.length);
  }
  const explicitLines = String(source || "")
    .split(/\\\\/)
    .map(collapseTeXParagraphWhitespace)
    .filter((line) => line.length);
  if (explicitLines.length) return explicitLines;
  const fallbackLines = Array.isArray(normalized.lines) && normalized.lines.length ? normalized.lines : [normalized.text || ""];
  return fallbackLines.map(collapseTeXParagraphWhitespace).filter((line) => line.length);
}

export function wrapRichTextLines(sourceLines, wrapWidth, unit, fontSize, sourceLineStyles) {
  const width = Number(wrapWidth) * unit;
  if (!Number.isFinite(width) || width <= 0) {
    return sourceLines.map((line, index) => ({ text: line, style: sourceLineStyles[index] || {} }));
  }
  const maxEm = (width / Math.max(1, fontSize)) * KATEX_RICH_TEXT_WRAP_WIDTH_SCALE;
  const output = [];
  sourceLines.forEach((line, index) => {
    const style = sourceLineStyles[index] || {};
    // The browser path uses foreignObject while SVG/PDF fall back to text.
    // Give mixed prose/math paragraphs the same TeX-box token breaker as that
    // fallback, otherwise the two render paths choose different words for a
    // fixed-width line.
    if (hasInlineMathSource(line)) {
      const lineFontSize = fontSize * (Number(style.scale) || 1);
      const wrapped = wrapSvgTextLineWithSource(
        line,
        mathFallbackText(line),
        wrapWidth,
        unit,
        lineFontSize
      );
      for (const entry of wrapped) output.push({ text: entry.contentLine, style });
      return;
    }
    for (const wrapped of wrapRichTextLine(line, maxEm)) {
      output.push({ text: wrapped, style });
    }
  });
  return output;
}

export function wrapRichTextLine(line, maxEm) {
  const text = collapseTeXParagraphWhitespace(line);
  if (!text || estimateRichTextWidthEm(text) <= maxEm || !/\s/.test(text)) return [text];
  const tokens = richTextWrapTokens(text);
  if (!tokens.length) return [text];
  return wrapRichTextTokensBalanced(tokens, maxEm);
}

export function richTextWrapTokens(line) {
  const tokens = [];
  for (const segment of splitInlineMathSegments(line)) {
    if (segment.type === "math") {
      const source = `$${segment.tex}$`;
      tokens.push({ source, widthEm: Math.max(0.2, estimateRichMathWidthEm(segment.tex)) });
      continue;
    }
    for (const match of String(segment.text || "").matchAll(/\S+/g)) {
      const source = match[0];
      const widthEm = Math.max(0.2, estimateRichTextWidthEm(formatPlainTexText(source)));
      if (/^[,.;:!?]+$/.test(source) && tokens.length) {
        tokens[tokens.length - 1].source += source;
        tokens[tokens.length - 1].widthEm += widthEm;
      } else {
        tokens.push({ source, widthEm });
      }
    }
  }
  return tokens;
}

export function estimateRichMathWidthEm(tex) {
  const fallback = mathFallbackText(tex);
  const width = estimateRichTextWidthEm(fallback);
  return /[=<>≤≥]/.test(fallback) ? width * 0.68 : width;
}

export function wrapRichTextTokensBalanced(tokens, maxEm) {
  const count = tokens.length;
  const best = Array.from({ length: count + 1 }, () => ({ cost: Infinity, next: count }));
  best[count] = { cost: 0, next: count };
  for (let start = count - 1; start >= 0; start -= 1) {
    let width = 0;
    for (let end = start; end < count; end += 1) {
      width += tokens[end].widthEm + (end > start ? TEX_SPACE_WIDTH_EM : 0);
      if (width > maxEm * 1.08 && end > start) break;
      const isLast = end === count - 1;
      const overfull = Math.max(0, width - maxEm);
      const remaining = Math.max(0, maxEm - width);
      const lineCost = overfull > 0
        ? overfull * overfull * 80
        : isLast
          ? remaining * remaining * 0.05
          : remaining * remaining;
      const cost = lineCost + best[end + 1].cost;
      if (cost < best[start].cost) best[start] = { cost, next: end + 1 };
    }
  }
  const lines = [];
  let cursor = 0;
  while (cursor < count) {
    const next = best[cursor].next > cursor ? best[cursor].next : cursor + 1;
    lines.push(normalizeRichWrappedLineSpacing(tokens.slice(cursor, next).map((token) => token.source).join(" ")));
    cursor = next;
  }
  return lines.length ? lines : [tokens.map((token) => token.source).join(" ")];
}

export function estimateRichTextWidthEm(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split("")
    .reduce((sum, char) => sum + (TEX_CHAR_WIDTHS_EM.get(char) ?? defaultTexCharWidthEm(char)), 0);
}

export function defaultTexCharWidthEm(char) {
  if (/\d/.test(char)) return 0.5;
  if (/[A-Z]/.test(char)) return 0.72;
  if (/[a-z]/.test(char)) return 0.5;
  return 0.5;
}

export function normalizeRichWrappedLineSpacing(line) {
  return String(line || "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s+([)\]}])/g, "$1")
    .replace(/([([{])\s+/g, "$1")
    .trim();
}

export function renderInlineMathHtml(line) {
  const parts = [];
  for (const segment of splitInlineMathSegments(line)) {
    if (segment.type === "math") {
      parts.push(
        renderScopedMathHtml(normalizeKatexTex(segment.tex.trim()), {
          displayMode: false,
          inlineText: true
        })
      );
    } else if (segment.text) {
      parts.push(escapeHtml(formatPlainTexText(segment.text)));
    }
  }
  return parts.join("");
}

export function estimateRichTextBox(lines, fontSize, lineStyles = []) {
  const width = Math.max(
    42,
    Math.max(
      ...lines.map((line, index) => {
        const scale = Number(lineStyles[index]?.scale) || 1;
        return estimateRichTextLineWidthEm(line) * fontSize * scale;
      }),
      0
    )
  );
  const height = Math.max(
    fontSize * 1.15,
    lineStyles.reduce((sum, style) => sum + fontSize * (Number(style?.scale) || 1) * KATEX_RICH_TEXT_LINE_BOX_SCALE, 0) ||
      lines.length * fontSize * KATEX_RICH_TEXT_LINE_BOX_SCALE
  );
  return { width, height };
}

function estimateRichTextLineWidthEm(line) {
  const math = parseMathText(line);
  if (math) return estimateRichMathWidthEm(math.tex);
  const segments = splitInlineMathSegments(line);
  if (segments.some((segment) => segment.type === "math")) {
    return segments.reduce(
      (width, segment) => width + (segment.type === "math"
        ? estimateRichMathWidthEm(segment.tex)
        : estimateRichTextWidthEm(formatPlainTexText(segment.text))),
      0
    );
  }
  return estimateRichTextWidthEm(formatPlainTexText(line));
}
