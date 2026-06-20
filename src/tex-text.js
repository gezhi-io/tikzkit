export function normalizeTikzText(value) {
  let text = String(value ?? "").trim();
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
  text = replaceCommand(text, "texttt", 1, (args) => args[0]);
  text = replaceCommand(text, "textrm", 1, (args) => args[0]);
  text = replaceCommand(text, "textbf", 1, (args) => args[0]);
  text = replaceCommand(text, "emph", 1, (args) => args[0]);
  text = replaceCommand(text, "mathbf", 1, (args) => args[0]);
  text = replaceCommand(text, "bf", 1, (args) => args[0]);
  const fontSize = readLeadingFontSize(text);
  if (fontSize) {
    scale *= fontSize.scale;
    text = fontSize.text;
  }

  if (isMathText(text)) {
    return {
      kind: "text",
      raw: String(value ?? ""),
      text: text.trim(),
      scale,
      color,
      lines: [text.trim()]
    };
  }

  text = text
    .replace(/\\(?:Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b/g, "")
    .replace(/\\(?:tt|rm|sf|bfseries|itshape|slshape|scshape)\b/g, "")
    .replace(/\\hspace\s*\{[^}]*\}/g, " ")
    .replace(/\\smash\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\dots/g, "...")
    .replace(/\\times/g, "x")
    .replace(/\\otimes/g, "(x)")
    .replace(/\\oplus/g, "(+)")
    .replace(/\\rightarrow/g, "→")
    .replace(/\\leftarrow/g, "←")
    .replace(/\\Rightarrow/g, "⇒")
    .replace(/\\Leftarrow/g, "⇐")
    .replace(/\\to/g, "→")
    .replace(/\\gets/g, "←")
    .replace(/\\circ/g, "deg")
    .replace(/\\&/g, "&")
    .replace(/\\_/g, "_")
    .replace(/[{}]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

  return {
    kind: "text",
    raw: String(value ?? ""),
    text,
    scale,
    color,
    lines: text.split(/\\\\|\n/).map((line) => line.trim())
  };
}

const FONT_SIZE_SCALES = {
  tiny: 0.5,
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
    .replace(/\\(?:mathbf|textbf|mathrm|textrm|texttt|emph|vec|overline|underline)\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\(?:bf|tt|rm|large|Large|LARGE|Huge|scriptsize|footnotesize|tiny)\b/g, "")
    .replace(/\\times/g, "x")
    .replace(/\\cdot/g, ".")
    .replace(/\\otimes/g, "(x)")
    .replace(/\\oplus/g, "(+)")
    .replace(/\\rightarrow/g, "→")
    .replace(/\\leftarrow/g, "←")
    .replace(/\\Rightarrow/g, "⇒")
    .replace(/\\Leftarrow/g, "⇐")
    .replace(/\\to/g, "→")
    .replace(/\\gets/g, "←")
    .replace(/\\theta/g, "θ")
    .replace(/\\psi/g, "ψ")
    .replace(/\\Delta/g, "Δ")
    .replace(/\\phi/g, "φ")
    .replace(/\\alpha/g, "alpha")
    .replace(/\\sigma/g, "sigma")
    .replace(/\\mu/g, "mu")
    .replace(/\\omega/g, "omega")
    .replace(/\\dots/g, "...")
    .replace(/\\circ/g, "deg")
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
  return text
    .split("")
    .map((char) => SUBSCRIPT_CHARS[char] || char)
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
