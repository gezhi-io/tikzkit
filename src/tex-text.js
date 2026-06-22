import { TIKZ_FONT_FAMILY, TIKZ_MONOSPACE_FONT_FAMILY, TIKZ_SANS_SERIF_FONT_FAMILY } from "./tikz-metrics.js";
import { preprocessTikzSource } from "./preprocess.js";

const TEX_PT_PER_CM = 28.45274;
const TEX_EX_PT = 4.30554;
const TEX_EM_PT = 10;
const MATHCAL_GLYPHS = {
  A: "𝒜",
  B: "ℬ",
  C: "𝒞",
  D: "𝒟",
  E: "ℰ",
  F: "ℱ",
  G: "𝒢",
  H: "ℋ",
  I: "ℐ",
  J: "𝒥",
  K: "𝒦",
  L: "ℒ",
  M: "ℳ",
  N: "𝒩",
  O: "𝒪",
  P: "𝒫",
  Q: "𝒬",
  R: "ℛ",
  S: "𝒮",
  T: "𝒯",
  U: "𝒰",
  V: "𝒱",
  W: "𝒲",
  X: "𝒳",
  Y: "𝒴",
  Z: "𝒵"
};

export function normalizeTikzText(value) {
  const rawInput = normalizeTextColorTokenArguments(replaceInlineTikzNodes(stripMinipageWrapper(String(value ?? ""))));
  let text = rawInput.trim();
  const fontFamily = detectTextFontFamily(rawInput);
  const fontStyle = /\\(?:emph|itshape|slshape)\b/.test(rawInput) ? "italic" : null;
  const nestedGraphic = parseNestedTikzGraphic(text);
  if (nestedGraphic) return nestedGraphic;
  const image = parseIncludeGraphics(text);
  if (image) return image;

  let scale = 1;
  let color = null;
  let invisible = false;
  let explicitFontSize = false;
  const wholeScale = readWholeCommand(text, "scalebox", 2);
  if (wholeScale) {
    const parsed = Number(wholeScale.args[0]);
    if (Number.isFinite(parsed) && parsed > 0) scale = parsed;
    text = wholeScale.args[1].trim();
  }
  const wholeTextColor = readWholeCommand(text, "textcolor", 2);
  if (wholeTextColor) {
    color = wholeTextColor.args[0].trim();
    text = wholeTextColor.args[1].trim();
  }
  const wholePhantom = readWholeCommand(text, "phantom", 1);
  if (wholePhantom) {
    invisible = true;
    text = wholePhantom.args[0].trim();
  }

  text = replaceCommand(text, "scalebox", 2, (args) => args[1]);
  text = replaceCommand(text, "textcolor", 2, (args) => args[1]);
  text = replaceCommand(text, "phantom", 1, () => "");
  text = replaceCommand(text, "tikzinlinebox", 2, (args) => args[1]);
  text = replaceCommand(text, "contour", 2, (args) => args[1]);
  text = replaceCommand(text, "texttt", 1, (args) => args[0]);
  text = replaceCommand(text, "textsf", 1, (args) => args[0]);
  text = replaceCommand(text, "textrm", 1, (args) => args[0]);
  text = replaceCommand(text, "textbf", 1, (args) => args[0]);
  text = replaceCommand(text, "emph", 1, (args) => args[0]);
  text = replaceCommand(text, "bm", 1, (args) => args[0]);
  text = replaceCommand(text, "mathbf", 1, (args) => args[0]);
  text = replaceCommand(text, "boldsymbol", 1, (args) => args[0]);
  text = replaceCommand(text, "bf", 1, (args) => args[0]);
  text = text.replace(/\\boldsymbol\s*(\\[A-Za-z]+)/g, "$1");
  const largerCount = (text.match(/\\mathlarger\b/g) || []).length;
  if (largerCount) {
    scale *= Math.min(2.1, 1 + largerCount * 0.18);
    let previous;
    do {
      previous = text;
      text = replaceCommand(text, "mathlarger", 1, (args) => args[0]);
    } while (text !== previous && text.includes(String.raw`\mathlarger`));
  }
  const fontSize = readLeadingFontSize(text);
  if (fontSize) {
    scale *= fontSize.scale;
    explicitFontSize = true;
    text = fontSize.text;
  }

  if (isMathText(text)) {
    return {
      kind: "text",
      raw: rawInput,
      text: text.trim(),
      scale,
      color,
      fontFamily,
      fontStyle,
      invisible,
      explicitFontSize,
      lines: [text.trim()]
    };
  }

  const styledLines = parseStyledTextLines(text);
  text = styledLines.map((line) => line.text).join("\\\\").trim();
  explicitFontSize = explicitFontSize || styledLines.some((line) => line.explicitFontSize);

  return {
    kind: "text",
    raw: rawInput,
    text,
    scale,
    color,
    fontFamily,
    fontStyle,
    invisible,
    explicitFontSize,
    lineStyles: styledLines.map((line) => ({
      scale: line.scale,
      fontWeight: line.fontWeight,
      explicitFontSize: line.explicitFontSize
    })),
    lines: styledLines.map((line) => line.text)
  };
}

// Claude: 一个节点里的 \begin{minipage}[pos]{width}...\end{minipage} 只是「文本盒子」语义，
// 对纯 JS 渲染没有额外排版意义，却会挡住内部的 \[ ... \] 被识别成数学块（导致整块退化成
// 逐行文本、把矩阵按 \\ 拆碎）。这里去掉 minipage 的 begin/end 包装，保留其内容。
function stripMinipageWrapper(source) {
  return String(source)
    .replace(/\\begin\s*\{minipage\}\s*(?:\[[^\]]*\])?\s*(?:\{[^{}]*\})?/g, "")
    .replace(/\\end\s*\{minipage\}/g, "");
}

function normalizeTextColorTokenArguments(source) {
  return String(source).replace(/\\textcolor\s*\{([^{}]+)\}(?!\s*\{)\s*([^\s\\{}])/g, String.raw`\textcolor{$1}{$2}`);
}

function detectTextFontFamily(source) {
  const text = String(source || "");
  if (/\\(?:tt|ttfamily)\b|\\texttt\s*\{/i.test(text)) return TIKZ_MONOSPACE_FONT_FAMILY;
  if (/\\(?:sf|sffamily)\b|\\textsf\s*\{/i.test(text)) return TIKZ_SANS_SERIF_FONT_FAMILY;
  if (/\\(?:rm|rmfamily)\b|\\textrm\s*\{/i.test(text)) return TIKZ_FONT_FAMILY;
  return undefined;
}

function replaceInlineTikzNodes(source) {
  const text = String(source || "");
  let output = "";
  let cursor = 0;
  while (cursor < text.length) {
    const index = text.indexOf(String.raw`\tikz`, cursor);
    if (index === -1) {
      output += text.slice(cursor);
      break;
    }
    output += text.slice(cursor, index);
    let readCursor = index + String.raw`\tikz`.length;
    while (/\s/.test(text[readCursor] || "")) readCursor += 1;
    if (text[readCursor] === "[") {
      const options = readBalancedDelimited(text, readCursor, "[", "]");
      if (!options) {
        output += text.slice(index, readCursor);
        cursor = readCursor;
        continue;
      }
      readCursor = options.end;
    }
    while (/\s/.test(text[readCursor] || "")) readCursor += 1;
    const body = readBalanced(text, readCursor);
    if (!body) {
      output += text.slice(index, readCursor);
      cursor = readCursor;
      continue;
    }
    output += inlineTikzNodeReplacement(body.content);
    cursor = body.end;
  }
  return output;
}

function inlineTikzNodeReplacement(body) {
  const parsed = extractInlineTikzNode(body);
  if (!parsed) return "";
  const cleaned = normalizeInlineTikzNodeText(parsed.text);
  if (!cleaned) return "";
  return parsed.fill && parsed.fill !== "none" ? String.raw`\tikzinlinebox{${parsed.fill}}{${cleaned}}` : cleaned;
}

function extractInlineTikzNode(body) {
  const text = String(body || "");
  const index = text.indexOf(String.raw`\node`);
  if (index === -1) return null;
  let cursor = index + String.raw`\node`.length;
  let fill = null;
  while (/\s/.test(text[cursor] || "")) cursor += 1;
  if (text[cursor] === "[") {
    const options = readBalancedDelimited(text, cursor, "[", "]");
    if (!options) return null;
    fill = options.content.match(/(?:^|,)\s*fill\s*=\s*([^,\]]+)/)?.[1]?.trim() || null;
    cursor = options.end;
  }
  while (/\s/.test(text[cursor] || "")) cursor += 1;
  if (text[cursor] === "(") {
    const name = readBalancedDelimited(text, cursor, "(", ")");
    if (!name) return null;
    cursor = name.end;
  }
  while (/\s/.test(text[cursor] || "")) cursor += 1;
  const content = readBalanced(text, cursor);
  if (!content) return null;
  return { fill, text: content.content };
}

function normalizeInlineTikzNodeText(text) {
  return String(text || "")
    .replace(/\\textcolor\s*\{[^{}]+\}\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\(?:tt|ttfamily|rm|rmfamily|sf|sffamily|normalfont|bf|bfseries|itshape|slshape|scshape)\b/g, "")
    .replace(/[{}]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

const FONT_SIZE_SCALES = {
  tiny: 0.42,
  scriptsize: 0.7,
  footnotesize: 0.8,
  small: 0.9,
  normalsize: 1,
  large: 1.2,
  Large: 1.44,
  LARGE: 1.728,
  huge: 2.07,
  Huge: 2.49
};

export function fontScaleFromTikzFont(font) {
  const matches = [...String(font ?? "").matchAll(/\\(Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b/g)];
  if (!matches.length) return 1;
  const size = matches[matches.length - 1][1];
  return FONT_SIZE_SCALES[size] || 1;
}

function readLeadingFontSize(text) {
  const match = String(text).trim().match(/^\\(Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b\s*/);
  if (!match) return null;
  return {
    scale: FONT_SIZE_SCALES[match[1]] || 1,
    text: String(text).trim().slice(match[0].length).trim()
  };
}

function parseStyledTextLines(text) {
  const rawLines = String(text || "")
    .trim()
    .split(/\\\\|\n/)
    .map((line) => cleanStyledTextLine(line))
    .filter((line) => line.text.length);
  return rawLines.length ? rawLines : [{ text: "", scale: 1, fontWeight: null }];
}

function cleanStyledTextLine(line) {
  let text = stripOuterTextBraces(String(line || "").trim());
  let scale = 1;
  let fontWeight = null;
  let explicitFontSize = false;

  text = text.replace(/\\(Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b/g, (_match, size) => {
    scale = FONT_SIZE_SCALES[size] || scale;
    explicitFontSize = true;
    return "";
  });
  const protectedMath = protectInlineMathSpans(text);
  text = protectedMath.text;
  if (/\\(?:bf|bfseries)\b|\\(?:mathbf|textbf)\s*\{/.test(text)) {
    fontWeight = 700;
  }

  text = text
    .replace(/\\(?:mathbf|textbf)\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\(?:tt|ttfamily|rm|rmfamily|sf|sffamily|normalfont|bf|bfseries|itshape|slshape|scshape)\b/g, "")
    .replace(/\\hspace\s*\{([^}]*)\}/g, (_match, dimension) => hspaceText(dimension))
    .replace(/\\smash\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\dots/g, "...")
    .replace(/\\vdots/g, "⋮")
    .replace(/\\ddots/g, "⋱")
    .replace(/\\times/g, "×")
    .replace(/\\otimes/g, "(x)")
    .replace(/\\oplus/g, "(+)")
    .replace(/\\rightarrow/g, "→")
    .replace(/\\leftarrow/g, "←")
    .replace(/\\Rightarrow/g, "⇒")
    .replace(/\\Leftarrow/g, "⇐")
    .replace(/\\uparrow/g, "↑")
    .replace(/\\downarrow/g, "↓")
    .replace(/\\to/g, "→")
    .replace(/\\gets/g, "←")
    .replace(/\\star/g, "⋆")
    .replace(/\\pounds/g, "£")
    .replace(/\\clubsuit/g, "♣")
    .replace(/\\diamondsuit/g, "♦")
    .replace(/\\heartsuit/g, "♥")
    .replace(/\\spadesuit/g, "♠")
    .replace(/\^\s*\{?\\circ\}?/g, "°")
    .replace(/\\circ/g, "°")
    .replace(/\\&/g, "&")
    .replace(/\\_/g, "_")
    .replace(/[{}]/g, "")
    .replace(/@@TIKZ_MATH_(\d+)@@/g, (_match, index) => protectedMath.spans[Number(index)] || "")
    .replace(/[ \t]+/g, " ")
    .trim();

  return { text, scale, fontWeight, explicitFontSize };
}

function protectInlineMathSpans(text) {
  const spans = [];
  return {
    spans,
    text: String(text || "").replace(/\$[^$]+\$/g, (match) => {
      const index = spans.length;
      spans.push(match);
      return `@@TIKZ_MATH_${index}@@`;
    })
  };
}

function hspaceText(dimension) {
  const match = String(dimension || "").trim().match(/^([0-9.]+)\s*(cm|mm|em|ex|pt)?$/);
  if (!match) return " ";
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return " ";
  const unit = match[2] || "cm";
  const spaces =
    unit === "cm"
      ? Math.round(value * 5)
      : unit === "mm"
        ? Math.round(value * 0.5)
        : unit === "em"
          ? Math.round(value * 1.4)
          : unit === "ex"
            ? Math.round(value * 0.7)
            : Math.round(value / 3);
  return "\u00a0".repeat(Math.max(1, Math.min(24, spaces)));
}

function stripOuterTextBraces(text) {
  let output = text;
  while (output.startsWith("{") && output.endsWith("}")) {
    const inner = output.slice(1, -1);
    if (!hasBalancedBraces(inner)) break;
    output = inner.trim();
  }
  return output;
}

function hasBalancedBraces(text) {
  let depth = 0;
  for (const char of text) {
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

export function mathFallbackText(tex) {
  const text = normalizeMathFallbackAccents(
    String(tex)
    .trim()
    .replace(/^\$\$([\s\S]*)\$\$$/, "$1")
    .replace(/^\$([\s\S]*)\$$/, "$1")
    .replace(/^\\\(([\s\S]*)\\\)$/, "$1")
      .replace(/^\\\[([\s\S]*)\\\]$/, "$1")
  );
  return text
    .replace(/\\textcolor\s*\{[^{}]*\}\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\mathcal\s*\{([^{}]*)\}/g, (_match, value) => mathcalFallbackText(value))
    .replace(/\\mathcal\s*([A-Za-z])/g, (_match, value) => mathcalFallbackText(value))
    .replace(/\\(?:vec|overrightarrow)\s*\{([^{}]*)\}/g, (_match, value) => `${value}⃗`)
    .replace(/\\vec\s*([A-Za-z])/g, (_match, value) => `${value}⃗`)
    .replace(/\\widetilde\s*\{([^{}]*)\}/g, (_match, value) => `${value}̃`)
    .replace(/\\widetilde\s*([A-Za-z])/g, (_match, value) => `${value}̃`)
    .replace(/\\tilde\s*\{([^{}]*)\}/g, (_match, value) => `${value}̃`)
    .replace(/\\tilde\s*([A-Za-z])/g, (_match, value) => `${value}̃`)
    .replace(/\{\s*\\(?:bf|bfseries)\b\s*([^{}]*)\}/g, "$1")
    .replace(/\\(?:bm|mathbf|boldsymbol|textbf|mathrm|textrm|texttt|emph|vec|overline|underline|mathlarger)\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\boldsymbol\s*(\\[A-Za-z]+)/g, "$1")
    .replace(/\\(?:bf|bfseries|tt|ttfamily|rm|rmfamily|sf|sffamily|normalfont|large|Large|LARGE|Huge|huge|scriptsize|footnotesize|tiny)\b/g, "")
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, ".")
    .replace(/\\otimes/g, "(x)")
    .replace(/\\oplus/g, "(+)")
    .replace(/\\rightarrow/g, "→")
    .replace(/\\leftarrow/g, "←")
    .replace(/\\Rightarrow/g, "⇒")
    .replace(/\\Leftarrow/g, "⇐")
    .replace(/\\uparrow/g, "↑")
    .replace(/\\downarrow/g, "↓")
    .replace(/\\to/g, "→")
    .replace(/\\gets/g, "←")
    .replace(/\\star/g, "⋆")
    .replace(/\\pounds/g, "£")
    .replace(/\\clubsuit/g, "♣")
    .replace(/\\diamondsuit/g, "♦")
    .replace(/\\heartsuit/g, "♥")
    .replace(/\\spadesuit/g, "♠")
    .replace(/\\sum\s*(?:\\limits\s*)?_\s*\{([^{}]*)\}\s*\^\s*\{([^{}]*)\}/g, (_match, subscript, superscript) =>
      compactLimitOperator("∑", subscript, superscript)
    )
    .replace(/\\sum\s*(?:\\limits\s*)?\^\s*\{([^{}]*)\}\s*_\s*\{([^{}]*)\}/g, (_match, superscript, subscript) =>
      compactLimitOperator("∑", subscript, superscript)
    )
    .replace(/\\(?:left|right)(?![A-Za-z])\s*/g, "")
    .replace(/\\(?:limits|nolimits)(?![A-Za-z])\s*/g, "")
    .replace(/\\sum(?![A-Za-z])/g, "∑")
    .replace(/\\prod(?![A-Za-z])/g, "∏")
    .replace(/\\int(?![A-Za-z])/g, "∫")
    .replace(/\\alpha/g, "α")
    .replace(/\\beta/g, "β")
    .replace(/\\gamma/g, "γ")
    .replace(/\\delta/g, "δ")
    .replace(/\\epsilon/g, "ε")
    .replace(/\\theta/g, "θ")
    .replace(/\\lambda/g, "λ")
    .replace(/\\ell/g, "ℓ")
    .replace(/\\eta/g, "η")
    .replace(/\\kappa/g, "κ")
    .replace(/\\tau/g, "τ")
    .replace(/\\chi/g, "χ")
    .replace(/\\zeta/g, "ζ")
    .replace(/\\mu/g, "μ")
    .replace(/\\pi/g, "π")
    .replace(/\\rho/g, "ρ")
    .replace(/\\sigma/g, "σ")
    .replace(/\\phi/g, "φ")
    .replace(/\\psi/g, "ψ")
    .replace(/\\omega/g, "ω")
    .replace(/\\Gamma/g, "Γ")
    .replace(/\\Delta/g, "Δ")
    .replace(/\\Lambda/g, "Λ")
    .replace(/\\Pi/g, "Π")
    .replace(/\\Sigma/g, "Σ")
    .replace(/\\Phi/g, "Φ")
    .replace(/\\Psi/g, "Ψ")
    .replace(/\\Omega/g, "Ω")
    .replace(/\\dots/g, "...")
    .replace(/\\vdots/g, "⋮")
    .replace(/\\ddots/g, "⋱")
    .replace(/\^\s*\{?\\circ\}?/g, "°")
    .replace(/\\circ/g, "°")
    .replace(/\\\|/g, "||")
    .replace(/_\{([^{}]*)\}/g, (_match, value) => toSubscript(value))
    .replace(/_([A-Za-z0-9+\-=()])/g, (_match, value) => toSubscript(value))
    .replace(/\^\{([^{}]*)\}/g, (_match, value) => `^${value}`)
    .replace(/[_^]([←→⇐⇒])/g, "$1")
    .replace(/\\/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function mathcalFallbackText(value) {
  return [...String(value || "")].map((char) => MATHCAL_GLYPHS[char] || char).join("");
}

function normalizeMathFallbackAccents(tex) {
  let text = String(tex);
  let previous;
  do {
    previous = text;
    text = replaceCommand(text, "widetilde", 1, (args) => `${mathFallbackText(args[0])}̃`);
    text = replaceCommand(text, "tilde", 1, (args) => `${mathFallbackText(args[0])}̃`);
    text = replaceCommand(text, "vec", 1, (args) => `${mathFallbackText(args[0])}⃗`);
    text = replaceCommand(text, "overrightarrow", 1, (args) => `${mathFallbackText(args[0])}⃗`);
  } while (text !== previous && /\\(?:widetilde|tilde|vec|overrightarrow)\s*\{/.test(text));
  return text;
}

const SUBSCRIPT_CHARS = {
  0: "₀",
  1: "₁",
  2: "₂",
  3: "₃",
  4: "₄",
  5: "₅",
  6: "₆",
  7: "₇",
  8: "₈",
  9: "₉",
  a: "ₐ",
  b: "ᵦ",
  e: "ₑ",
  h: "ₕ",
  i: "ᵢ",
  j: "ⱼ",
  k: "ₖ",
  l: "ₗ",
  m: "ₘ",
  n: "ₙ",
  o: "ₒ",
  p: "ₚ",
  r: "ᵣ",
  s: "ₛ",
  t: "ₜ",
  u: "ᵤ",
  v: "ᵥ",
  x: "ₓ",
  "+": "₊",
  "-": "₋",
  "=": "₌",
  "(": "₍",
  ")": "₎",
};

function toSubscript(value) {
  const text = String(value)
    .replace(/\\/g, "")
    .replace(/[{}]/g, "");
  if (/[A-Za-z]/.test(text)) return `_${text}`;
  const chars = text.split("");
  if (chars.every((char) => SUBSCRIPT_CHARS[char])) {
    return chars.map((char) => SUBSCRIPT_CHARS[char]).join("");
  }
  return chars.map((char) => SUBSCRIPT_CHARS[char] || char).join("");
}

const SUPERSCRIPT_CHARS = {
  0: "⁰",
  1: "¹",
  2: "²",
  3: "³",
  4: "⁴",
  5: "⁵",
  6: "⁶",
  7: "⁷",
  8: "⁸",
  9: "⁹",
  i: "ⁱ",
  n: "ⁿ",
  "+": "⁺",
  "-": "⁻",
  "=": "⁼",
  "(": "⁽",
  ")": "⁾",
};

function compactLimitOperator(operator, subscript, superscript) {
  const compactSuperscript = toCompactScript(superscript, SUPERSCRIPT_CHARS, "^");
  const compactSubscript = toCompactScript(subscript, SUBSCRIPT_CHARS, "_");
  return `${operator}${compactSuperscript}${compactSubscript}`;
}

function toCompactScript(value, charMap, fallbackPrefix) {
  const text = String(value)
    .replace(/\\/g, "")
    .replace(/[{}]/g, "")
    .trim();
  if (!text) return "";
  return text
    .split("")
    .map((char) => charMap[char] || `${fallbackPrefix}${char}`)
    .join("");
}

function isMathText(text) {
  const trimmed = String(text).trim();
  return (
    /^\$[^$]+\$$/.test(trimmed) ||
    /^\$\$[\s\S]+\$\$$/.test(trimmed) ||
    /^\\\([\s\S]+\\\)$/.test(trimmed) ||
    /^\\\[[\s\S]+\\\]$/.test(trimmed)
  );
}

function parseIncludeGraphics(text) {
  const match = text.match(/^\\includegraphics(?:\[([\s\S]*?)\])?\{([^}]+)\}$/);
  if (!match) return null;
  const options = parseGraphicOptions(match[1] || "");
  const width = parseCmDimension(options.width) ?? 2;
  return {
    kind: "image",
    raw: text,
    fileName: match[2].trim(),
    width,
    height: width * 0.55,
    scale: 1,
    lines: []
  };
}

function parseNestedTikzGraphic(text) {
  const source = String(text || "").trim();
  if (/^\\tikz\b[\s\S]*\\draw[\s\S]*(?:\bsin\b|\bcos\b|--)/.test(source)) {
    const inlineGraphic = extractInlineTikzDrawGraphic(source);
    if (inlineGraphic) return inlineGraphic;
    const parts = source.split(/\\\\|\n/).map((part) => part.trim()).filter(Boolean);
    const tikzLineCount = Math.max(1, parts.filter((line) => /^\\tikz\b/.test(line)).length);
    const label = parts
      .filter((line) => !/^\\tikz\b/.test(line))
      .map((line) => mathFallbackText(line))
      .join(" ");
    return {
      kind: "image",
      raw: source,
      fileName: "inline-tikz",
      width: 1.8,
      height: label ? 0.72 : Math.max(0.36, tikzLineCount * 0.28),
      scale: 1,
      plot: "wave",
      waveCount: tikzLineCount,
      label,
      lines: []
    };
  }
  if (!/\\begin\{tikzpicture\}|\\begin\{axis\}|axis plot|\\addplot/.test(source)) return null;
  if (/\\begin\{axis\}[\s\S]*\\addplot[\s\S]*sin\s*\(/.test(source)) {
    const label = source.match(/\\\\\s*(\$[\s\S]*?\$)\s*$/)?.[1];
    return {
      kind: "image",
      raw: source,
      fileName: "pgfplots-fm",
      width: 2.2,
      height: label ? 1.15 : 0.82,
      scale: 1,
      plot: "fm-wave",
      label: label ? mathFallbackText(label) : "",
      lines: []
    };
  }
  const axisLabel = source.match(/\\\\\s*(\$[\s\S]*?\$)\s*$/)?.[1];
  if (/axis plot/.test(source) && /\$FM\(t\)\$/.test(axisLabel || "")) {
    return {
      kind: "image",
      raw: source,
      fileName: "pgfplots-fm",
      width: 2.2,
      height: 1.15,
      scale: 1,
      plot: "fm-wave",
      label: mathFallbackText(axisLabel),
      lines: []
    };
  }
  const expandedAxis = extractExpandedAxisPlotGraphic(source);
  if (expandedAxis) return expandedAxis;
  // Claude: 嵌套 tikzpicture 若只是若干 \draw 直线段（如 case 038 的 ReLU 折线
  // "(0,0)--(0.5,0); (0.49,..)--(0.99,0.496)"），原来的 catch-all 会一律画成钟形(gaussian)占位符。
  // 这里改成提取真实线段、按比例画出来。复杂的嵌套(含 \node / pgfplots)仍走下面的占位逻辑。
  const preprocessedAxis = extractPreprocessedAxisPlotGraphic(source);
  if (preprocessedAxis) return preprocessedAxis;
  const inlineDraw = extractInlineDrawPolylines(source);
  if (inlineDraw) return inlineDraw;
  const nestedNodeGraphic = extractNestedSingleNodeGraphic(source);
  if (nestedNodeGraphic) return nestedNodeGraphic;
  // Claude: 嵌套 tikzpicture 若只是若干 \node{文字}（如 case 019 的 Memory{ROM,RAM}、
  // case 038 的 {softmax}），把它们的文字抽成多行文本来渲染，而不是一律画成钟形占位符。
  const nestedNodes = extractNestedNodeText(source);
  if (nestedNodes) return nestedNodes;
  return {
    kind: "image",
    raw: source,
    fileName: "pgfplots-axis",
    width: 1.8,
    height: 1.05,
    scale: 1,
    plot: "gaussian",
    grid: /(?:tikzkit compare grid|\\draw[\s\S]*\bgrid\b)/.test(source),
    lines: []
  };
}

function extractInlineTikzDrawGraphic(source) {
  const parts = String(source || "")
    .split(/\\\\|\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.some((part) => /^\\tikz\b/.test(part))) return null;

  const drawingLines = [];
  const labels = [];
  for (const part of parts) {
    if (/^\\tikz\b/.test(part)) {
      const parsed = parseInlineTikzDrawPart(part);
      if (!parsed) return null;
      drawingLines.push(parsed);
    } else {
      const label = mathFallbackText(part);
      if (label) labels.push(label);
    }
  }
  if (!drawingLines.length) return null;

  const label = labels.join(" ");
  const lineGap = drawingLines.length > 1 ? 0.08 : 0;
  const labelHeight = label ? 0.35 : 0;
  const labelGap = label ? 0.08 : 0;
  const pathHeight = drawingLines.reduce((sum, line) => sum + line.height, 0) + Math.max(0, drawingLines.length - 1) * lineGap;
  const height = Math.max(0.12, pathHeight + labelGap + labelHeight);
  const labelWidth = label ? estimateInlineLabelWidth(label) : 0;
  const width = Math.max(0.12, labelWidth, ...drawingLines.map((line) => line.width));

  const polylines = [];
  let top = height;
  for (const line of drawingLines) {
    const bottom = top - line.height;
    const offsetX = (width - line.width) / 2;
    for (const path of line.polylines) {
      polylines.push(
        path.map((point) => ({
          x: (offsetX + (point.x - line.minX)) / width,
          y: (bottom + (point.y - line.minY)) / height
        }))
      );
    }
    top = bottom - lineGap;
  }

  return {
    kind: "image",
    raw: source,
    fileName: "inline-tikz-draw",
    width,
    height,
    scale: 1,
    plot: "polyline",
    polylines,
    label,
    labelHeight,
    lines: []
  };
}

function parseInlineTikzDrawPart(part) {
  const text = String(part || "");
  const drawIndex = text.indexOf(String.raw`\draw`);
  if (drawIndex === -1) return null;
  let cursor = drawIndex + String.raw`\draw`.length;
  while (/\s/.test(text[cursor] || "")) cursor += 1;
  let options = {};
  if (text[cursor] === "[") {
    const read = readBalancedDelimited(text, cursor, "[", "]");
    if (!read) return null;
    options = parseGraphicOptions(read.content);
    cursor = read.end;
  }
  const semicolon = text.indexOf(";", cursor);
  const body = text.slice(cursor, semicolon === -1 ? undefined : semicolon);
  const xScale = parseTikzGraphicDimension(options.x) ?? 1;
  const yScale = parseTikzGraphicDimension(options.y) ?? 1;
  const polylines = sampleInlineTikzPath(body, xScale, yScale);
  if (!polylines.length) return null;
  const points = polylines.flat();
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    polylines,
    minX,
    minY,
    width: Math.max(0.12, maxX - minX),
    height: Math.max(0.18, maxY - minY)
  };
}

function sampleInlineTikzPath(body, xScale, yScale) {
  const tokens = [...String(body || "").matchAll(/(--|\bsin\b|\bcos\b)?\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g)];
  const polylines = [];
  let current = null;
  let currentLine = null;
  for (const token of tokens) {
    const op = token[1] || "";
    const target = { x: Number(token[2]) * xScale, y: Number(token[3]) * yScale };
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) continue;
    if (!current || !op) {
      currentLine = [target];
      polylines.push(currentLine);
      current = target;
      continue;
    }
    const samples = op === "sin" || op === "cos" ? sampleSineCosineSegment(current, target, op) : [target];
    currentLine.push(...samples);
    current = target;
  }
  return polylines.filter((line) => line.length >= 2);
}

function sampleSineCosineSegment(from, to, op) {
  const samples = [];
  const count = 8;
  for (let index = 1; index <= count; index += 1) {
    const t = index / count;
    const x = from.x + (to.x - from.x) * t;
    const y =
      op === "sin"
        ? from.y + (to.y - from.y) * Math.sin((Math.PI / 2) * t)
        : to.y + (from.y - to.y) * Math.cos((Math.PI / 2) * t);
    samples.push({ x, y });
  }
  return samples;
}

function parseTikzGraphicDimension(value) {
  const input = String(value || "").trim();
  const match = input.match(/^(-?\d+(?:\.\d+)?)\s*(cm|mm|pt|ex|em)?$/);
  if (!match) return null;
  const number = Number(match[1]);
  if (!Number.isFinite(number)) return null;
  const unit = match[2] || "cm";
  if (unit === "cm") return number;
  if (unit === "mm") return number / 10;
  if (unit === "pt") return number / TEX_PT_PER_CM;
  if (unit === "ex") return (number * TEX_EX_PT) / TEX_PT_PER_CM;
  if (unit === "em") return (number * TEX_EM_PT) / TEX_PT_PER_CM;
  return null;
}

function estimateInlineLabelWidth(label) {
  return Math.max(0, String(label || "").length * 0.105);
}

function extractNestedSingleNodeGraphic(source) {
  const text = String(source);
  if (/\\addplot|\\begin\{axis\}|\bplot\b|\\draw/.test(text) || !/\\node\b/.test(text)) return null;
  const bodyMatch = text.match(/\\begin\{tikzpicture\}([\s\S]*)\\end\{tikzpicture\}/);
  const body = bodyMatch ? bodyMatch[1] : text;
  const nodeIndex = body.indexOf(String.raw`\node`);
  if (nodeIndex === -1) return null;
  let cursor = nodeIndex + String.raw`\node`.length;
  while (/\s/.test(body[cursor] || "")) cursor += 1;

  let options = {};
  if (body[cursor] === "[") {
    const read = readBalancedDelimited(body, cursor, "[", "]");
    if (!read) return null;
    options = parseGraphicOptions(read.content);
    cursor = read.end;
  }

  while (/\s/.test(body[cursor] || "")) cursor += 1;
  if (body[cursor] === "(") {
    const name = readBalancedDelimited(body, cursor, "(", ")");
    if (!name) return null;
    cursor = name.end;
  }

  while (/\s/.test(body[cursor] || "")) cursor += 1;
  if (/^at\b/.test(body.slice(cursor))) {
    cursor += 2;
    while (/\s/.test(body[cursor] || "")) cursor += 1;
    if (body[cursor] === "(") {
      const at = readBalancedDelimited(body, cursor, "(", ")");
      if (!at) return null;
      cursor = at.end;
    }
  }

  while (/\s/.test(body[cursor] || "")) cursor += 1;
  const content = readBalanced(body, cursor);
  if (!content) return null;
  cursor = content.end;
  const trailing = body.slice(cursor).replace(/;/g, "").trim();
  if (trailing) return null;

  const rotate = Number(options.rotate || 0);
  const shouldRenderAsBox = options.draw || options.rectangle || Number.isFinite(rotate) && rotate !== 0;
  if (!shouldRenderAsBox) return null;

  const label = mathFallbackText(content.content);
  const innerSep = parseTikzGraphicDimension(options["inner sep"]) ?? (TEX_EM_PT / TEX_PT_PER_CM) * 0.3333;
  const labelWidth = estimateInlineLabelWidth(label) + innerSep * 2;
  const labelHeight = 0.24 + innerSep * 2;
  const baseWidth = Math.max(parseTikzGraphicDimension(options["minimum width"]) ?? 0, labelWidth, 0.1);
  const baseHeight = Math.max(parseTikzGraphicDimension(options["minimum height"]) ?? 0, labelHeight, 0.1);
  const normalizedRotation = ((rotate % 360) + 360) % 360;
  const swapsAxes = Math.abs(normalizedRotation - 90) < 1e-6 || Math.abs(normalizedRotation - 270) < 1e-6;

  return {
    kind: "image",
    raw: source,
    fileName: "nested-tikz-node",
    width: swapsAxes ? baseHeight : baseWidth,
    height: swapsAxes ? baseWidth : baseHeight,
    scale: 1,
    plot: "boxed-text",
    label,
    rotate,
    boxWidth: baseWidth,
    boxHeight: baseHeight,
    lines: []
  };
}

function extractNestedNodeText(source) {
  const text = String(source);
  if (/\\addplot|\\begin\{axis\}|\bplot\b|\\draw/.test(text) || !/\\node\b/.test(text)) return null;
  const start = text.indexOf("\\begin{tikzpicture}");
  const prefix = start > 0 ? text.slice(0, start).trim() : "";
  const nodeTexts = [];
  const pattern = /\\node\b[^{}]*\{([^{}]*)\}/g;
  let match;
  while ((match = pattern.exec(text))) {
    const value = match[1].trim();
    if (value) nodeTexts.push(value);
  }
  const lines = [prefix, ...nodeTexts].map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return null;
  return {
    kind: "text",
    raw: source,
    text: lines.join("\\\\"),
    scale: 1,
    color: null,
    fontFamily: undefined,
    lineStyles: lines.map(() => ({})),
    lines
  };
}

function extractPreprocessedAxisPlotGraphic(source) {
  const text = String(source || "");
  if (!/\\draw\s*\[[^\]]*\baxis plot\b/.test(text)) return null;
  const draws = text.match(/\\draw(?:\[[^\]]*\])?[^;]*;/g) || [];
  const frameDraw = draws.find((draw) => /\baxis frame\b/.test(draw));
  const plotDraws = draws.filter((draw) => /\baxis plot\b/.test(draw));
  if (!plotDraws.length) return null;

  const plotLines = plotDraws
    .map((draw) => extractDrawCoordinates(draw))
    .filter((line) => line.length >= 2);
  if (!plotLines.length) return null;

  const frameCoordinates = frameDraw ? extractDrawCoordinates(frameDraw) : [];
  const boundsPoints = frameCoordinates.length >= 2 ? frameCoordinates : plotLines.flat();
  const xs = boundsPoints.map((point) => point.x).filter(Number.isFinite);
  const ys = boundsPoints.map((point) => point.y).filter(Number.isFinite);
  if (!xs.length || !ys.length) return null;

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(0.12, maxX - minX);
  const height = Math.max(0.18, maxY - minY);
  const polylines = plotLines.map((line) =>
    line.map((point) => ({
      x: (point.x - minX) / width,
      y: (point.y - minY) / height
    }))
  );

  return {
    kind: "image",
    raw: source,
    fileName: "pgfplots-axis-plot",
    width,
    height,
    scale: 1,
    plot: "polyline",
    polylines,
    label: "",
    labelHeight: 0,
    lines: []
  };
}

function extractExpandedAxisPlotGraphic(source) {
  if (!/\\begin\{axis\}|\\addplot/.test(String(source || ""))) return null;
  if (!hasRawAxisUnitDimensions(source)) return null;
  const preprocessed = preprocessTikzSource(source).source;
  if (preprocessed === source || !/\\draw\s*\[[^\]]*\baxis plot\b/.test(preprocessed)) return null;
  return extractPreprocessedAxisPlotGraphic(preprocessed);
}

function hasRawAxisUnitDimensions(source) {
  const match = String(source || "").match(/\\begin\{axis\}\s*\[([\s\S]*?)\]/);
  if (!match) return false;
  const options = parseGraphicOptions(match[1]);
  return Boolean(options.x && options.y);
}

function extractDrawCoordinates(draw) {
  return [...String(draw || "").matchAll(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g)]
    .map((match) => ({ x: Number(match[1]), y: Number(match[2]) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

// Claude: 从「只含直线段 \draw」的嵌套图里提取折线，归一化到 [0,1]，供渲染器按框比例还原。
// 含 \node / \addplot / axis / plot 等复杂元素的不在此处理（返回 null，走占位逻辑）。
function extractInlineDrawPolylines(source) {
  if (/\\addplot|\\begin\{axis\}|\\node\b|\bplot\b/.test(source)) return null;
  const draws = String(source).match(/\\draw[^;]*;/g);
  if (!draws) return null;
  const polylines = [];
  for (const draw of draws) {
    if (!draw.includes("--")) continue;
    const coords = [...draw.matchAll(/\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/g)].map((match) => ({
      x: Number(match[1]),
      y: Number(match[2])
    }));
    if (coords.length >= 2) polylines.push(coords);
  }
  if (!polylines.length) return null;
  const all = polylines.flat();
  const xs = all.map((point) => point.x);
  const ys = all.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(0.1, maxX - minX);
  const height = Math.max(0.1, maxY - minY);
  const normalized = polylines.map((line) => line.map((point) => ({ x: (point.x - minX) / width, y: (point.y - minY) / height })));
  return {
    kind: "image",
    raw: source,
    fileName: "inline-tikz-draw",
    width,
    height,
    scale: 1,
    plot: "polyline",
    polylines: normalized,
    lines: []
  };
}

function parseGraphicOptions(input) {
  const options = {};
  for (const part of String(input).split(",")) {
    const [key, value] = part.split("=").map((item) => item?.trim());
    if (key && value) options[key] = value;
    else if (key) options[key] = true;
  }
  return options;
}

function parseCmDimension(value) {
  const match = String(value || "").match(/^(-?\d+(?:\.\d+)?)\s*cm$/);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isFinite(number) ? number : null;
}

function readWholeCommand(text, name, argCount) {
  const start = text.indexOf(`\\${name}`);
  if (start !== 0) return null;
  const read = readCommandAt(text, start, name, argCount);
  if (!read || text.slice(read.end).trim()) return null;
  return read;
}

function replaceCommand(text, name, argCount, mapper) {
  let output = "";
  let cursor = 0;
  while (cursor < text.length) {
    const index = text.indexOf(`\\${name}`, cursor);
    if (index === -1) {
      output += text.slice(cursor);
      break;
    }
    const read = readCommandAt(text, index, name, argCount);
    if (!read) {
      output += text.slice(cursor, index + name.length + 1);
      cursor = index + name.length + 1;
      continue;
    }
    output += text.slice(cursor, index);
    output += mapper(read.args);
    cursor = read.end;
  }
  return output;
}

function readCommandAt(text, index, name, argCount) {
  if (!text.startsWith(`\\${name}`, index)) return null;
  let cursor = index + name.length + 1;
  const args = [];
  for (let count = 0; count < argCount; count += 1) {
    while (/\s/.test(text[cursor] || "")) cursor += 1;
    const arg = readBalanced(text, cursor);
    if (!arg) return null;
    args.push(arg.content);
    cursor = arg.end;
  }
  return { args, end: cursor };
}

function readBalanced(text, start) {
  if (text[start] !== "{") return null;
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          content: text.slice(start + 1, index),
          end: index + 1
        };
      }
    }
  }
  return null;
}

function readBalancedDelimited(text, start, open, close) {
  if (text[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return {
          content: text.slice(start + 1, index),
          end: index + 1
        };
      }
    }
  }
  return null;
}
