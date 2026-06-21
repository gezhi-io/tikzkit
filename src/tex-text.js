import { TIKZ_MONOSPACE_FONT_FAMILY } from "./tikz-metrics.js";

export function normalizeTikzText(value) {
  const rawInput = normalizeTextColorTokenArguments(replaceInlineTikzNodes(String(value ?? "")));
  let text = rawInput.trim();
  const fontFamily = detectTextFontFamily(rawInput);
  const nestedGraphic = parseNestedTikzGraphic(text);
  if (nestedGraphic) return nestedGraphic;
  const image = parseIncludeGraphics(text);
  if (image) return image;

  let scale = 1;
  let color = null;
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

  text = replaceCommand(text, "scalebox", 2, (args) => args[1]);
  text = replaceCommand(text, "textcolor", 2, (args) => args[1]);
  text = replaceCommand(text, "tikzinlinebox", 2, (args) => args[1]);
  text = replaceCommand(text, "texttt", 1, (args) => args[0]);
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
      lines: [text.trim()]
    };
  }

  const styledLines = parseStyledTextLines(text);
  text = styledLines.map((line) => line.text).join("\\\\").trim();

  return {
    kind: "text",
    raw: rawInput,
    text,
    scale,
    color,
    fontFamily,
    lineStyles: styledLines.map((line) => ({
      scale: line.scale,
      fontWeight: line.fontWeight
    })),
    lines: styledLines.map((line) => line.text)
  };
}

function normalizeTextColorTokenArguments(source) {
  return String(source).replace(/\\textcolor\s*\{([^{}]+)\}(?!\s*\{)\s*([^\s\\{}])/g, String.raw`\textcolor{$1}{$2}`);
}

function detectTextFontFamily(source) {
  return /\\(?:tt|ttfamily)\b|\\texttt\s*\{/i.test(String(source || "")) ? TIKZ_MONOSPACE_FONT_FAMILY : undefined;
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
    .replace(/\\(?:tt|rm|sf|bf|bfseries|itshape|slshape|scshape)\b/g, "")
    .replace(/[{}]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

const FONT_SIZE_SCALES = {
  tiny: 0.42,
  scriptsize: 0.65,
  footnotesize: 0.78,
  small: 0.88,
  normalsize: 1,
  large: 1.2,
  Large: 1.35,
  LARGE: 1.55,
  huge: 1.8,
  Huge: 2.1
};

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

  text = text.replace(/\\(Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b/g, (_match, size) => {
    scale = FONT_SIZE_SCALES[size] || scale;
    return "";
  });
  if (/\\(?:bf|bfseries)\b|\\(?:mathbf|textbf)\s*\{/.test(text)) {
    fontWeight = 700;
  }

  text = text
    .replace(/\\(?:mathbf|textbf)\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\(?:tt|rm|sf|bf|bfseries|itshape|slshape|scshape)\b/g, "")
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
    .replace(/\\circ/g, "deg")
    .replace(/\\&/g, "&")
    .replace(/\\_/g, "_")
    .replace(/[{}]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

  return { text, scale, fontWeight };
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
  return String(tex)
    .trim()
    .replace(/^\$\$([\s\S]*)\$\$$/, "$1")
    .replace(/^\$([\s\S]*)\$$/, "$1")
    .replace(/^\\\(([\s\S]*)\\\)$/, "$1")
    .replace(/^\\\[([\s\S]*)\\\]$/, "$1")
    .replace(/\\textcolor\s*\{[^{}]*\}\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\mathcal\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\mathcal\s*([A-Za-z])/g, "$1")
    .replace(/\\(?:vec|overrightarrow)\s*\{([^{}]*)\}/g, (_match, value) => `${value}⃗`)
    .replace(/\\vec\s*([A-Za-z])/g, (_match, value) => `${value}⃗`)
    .replace(/\\(?:bm|mathbf|boldsymbol|textbf|mathrm|textrm|texttt|emph|vec|overline|underline|mathlarger)\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\boldsymbol\s*(\\[A-Za-z]+)/g, "$1")
    .replace(/\\(?:bf|bfseries|tt|rm|large|Large|LARGE|Huge|huge|scriptsize|footnotesize|tiny)\b/g, "")
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
    .replace(/\\circ/g, "deg")
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
  return {
    kind: "image",
    raw: source,
    fileName: "pgfplots-axis",
    width: 1.8,
    height: 1.05,
    scale: 1,
    plot: "gaussian",
    lines: []
  };
}

function parseGraphicOptions(input) {
  const options = {};
  for (const part of String(input).split(",")) {
    const [key, value] = part.split("=").map((item) => item?.trim());
    if (key && value) options[key] = value;
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
