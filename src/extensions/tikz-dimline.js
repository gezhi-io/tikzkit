import { parseDimension, roundNumber } from "../math.js";
import { parseOptions, splitTopLevel } from "../options.js";

export const tikzDimlineExtension = {
  name: "tikz-dimline",
  phase: "preprocess",
  description: "Expands tikz-dimline dimension arrows into ordinary TikZ paths and labels.",
  commands: ["dimline"],
  preprocess(source, context = {}) {
    return expandTikzDimline(source, context.diagnostics || []);
  }
};

export function expandTikzDimline(source, diagnostics = []) {
  let output = "";
  let index = 0;
  const text = String(source);
  while (index < text.length) {
    if (!text.startsWith("\\dimline", index) || /[A-Za-z@]/.test(text[index + "\\dimline".length] || "")) {
      output += text[index];
      index += 1;
      continue;
    }
    const parsed = parseDimlineCommand(text, index, diagnostics);
    output += parsed?.body ?? text[index];
    index = parsed?.end ?? index + 1;
  }
  return output;
}

function parseDimlineCommand(source, start, diagnostics) {
  let cursor = start + "\\dimline".length;
  cursor = skipWhitespace(source, cursor);
  const optional = readOptional(source, cursor, "[", "]");
  cursor = optional ? skipWhitespace(source, optional.end) : cursor;
  const args = [];
  for (let argIndex = 0; argIndex < 3; argIndex += 1) {
    const arg = extractBalanced(source, cursor, "{", "}");
    if (!arg) {
      diagnostics.push({ severity: "warning", message: "Malformed \\dimline command" });
      return { body: "", end: cursor };
    }
    args.push(arg.content.trim());
    cursor = skipWhitespace(source, arg.end);
  }
  return {
    body: renderDimline(optional?.content || "", args),
    end: cursor
  };
}

function renderDimline(optionsRaw, [start, end, label]) {
  const options = parseOptions(optionsRaw);
  const color = textOption(options.color, "black");
  const lineStyle = normalizeStyle(options["line style"], { fallbackArrow: "arrows=dimline-dimline" });
  const labelStyle = normalizeStyle(options["label style"], { defaultStyle: "fill=white,align=center,sloped=true,pos=0.5" });
  const extensionStyle = normalizeStyle(options["extension style"], { defaultStyle: `draw=${color}!40,line width=0.01pt` });
  const extensionStartStyle = mergeStyles(extensionStyle, normalizeStyle(options["extension start style"]));
  const extensionEndStyle = mergeStyles(extensionStyle, normalizeStyle(options["extension end style"]));
  const id = `dimline-${nextDimlineId()}`;
  const startPath = coordinatePath(options["extension start path"]);
  const endPath = coordinatePath(options["extension end path"]);
  const startLength = lengthOption(options["extension start length"], 1);
  const endLength = lengthOption(options["extension end length"], 1);
  const startAngle = numberOption(options["extension start angle"], -90);
  const endAngle = numberOption(options["extension end angle"], 90);

  const lineOptions = mergeStyles(`draw=${color},dimline line`, lineStyle);

  return [
    `\\coordinate (${id}-a) at ${wrapCoordinate(start)};`,
    `\\coordinate (${id}-b) at ${wrapCoordinate(end)};`,
    startPath
      ? `\\draw[${extensionStartStyle},dimline extension] plot coordinates {${startPath}};`
      : `\\draw[${extensionStartStyle},dimline extension] (${id}-a) -- ${offsetCoordinate(`${id}-a`, `${id}-b`, startLength, startAngle)};`,
    endPath
      ? `\\draw[${extensionEndStyle},dimline extension] plot coordinates {${endPath}};`
      : `\\draw[${extensionEndStyle},dimline extension] (${id}-b) -- ${offsetCoordinate(`${id}-b`, `${id}-a`, endLength, endAngle)};`,
    `\\draw[${lineOptions}] (${id}-a) -- (${id}-b) node[${labelStyle}] {${label}};`
  ].join("\n");
}

let dimlineCounter = 0;

function nextDimlineId() {
  dimlineCounter += 1;
  return dimlineCounter;
}

function normalizeStyle(value, { defaultStyle = "", fallbackArrow = null } = {}) {
  const raw = stripOuterBraces(textOption(value, ""));
  const parts = [];
  if (defaultStyle) parts.push(defaultStyle);
  if (raw) parts.push(...splitTopLevel(raw));
  if (fallbackArrow && !parts.some((part) => /(?:^|,|\s)(?:arrows\s*=|<->|->|<-|-\{|\{)/.test(part))) {
    parts.push(fallbackArrow);
  }
  return parts
    .map((part) => {
      const trimmed = part.trim();
      if (/^arrows\s*=/.test(trimmed)) return arrowOption(trimmed.replace(/^arrows\s*=\s*/, ""));
      return trimmed;
    })
    .filter(Boolean)
    .join(",");
}

function arrowOption(value) {
  const text = stripOuterBraces(value).trim();
  if (/^dimline\s+reverse\s*-\s*dimline\s+reverse$/i.test(text)) return "dimline reverse-dimline reverse";
  if (/^dimline\s*-\s*dimline$/i.test(text)) return "dimline-dimline";
  if (/reverse/i.test(text)) return "dimline reverse-dimline reverse";
  if (/dimline/i.test(text)) return "dimline-dimline";
  return text || "<->";
}

function mergeStyles(...styles) {
  return styles.map((style) => String(style || "").trim()).filter(Boolean).join(",");
}

function coordinatePath(value) {
  const raw = stripOuterBraces(textOption(value, "")).trim();
  if (!raw) return "";
  const coords = [];
  let index = 0;
  while (index < raw.length) {
    index = skipWhitespace(raw, index);
    if (raw[index] !== "(") {
      index += 1;
      continue;
    }
    const coord = extractBalanced(raw, index, "(", ")");
    if (!coord) break;
    coords.push(`(${coord.content.trim()})`);
    index = coord.end;
  }
  return coords.join(" ");
}

function offsetCoordinate(from, to, length, angle) {
  const distance = `${fmt(length)}cm`;
  const degrees = fmt(angle);
  return `++(${degrees}:${distance})`;
}

function wrapCoordinate(value) {
  const text = String(value || "").trim();
  if (text.startsWith("(") || text.startsWith("$")) return text;
  return `(${text})`;
}

function textOption(value, fallback) {
  if (value === undefined || value === null || value === true || value === "") return fallback;
  return String(value).trim();
}

function lengthOption(value, fallback) {
  const raw = textOption(value, `${fallback}cm`);
  const parsed = parseDimension(stripOuterBraces(raw), {});
  return Number.isFinite(parsed) ? parsed : fallback;
}

function numberOption(value, fallback) {
  const parsed = Number(stripOuterBraces(textOption(value, fallback)));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stripOuterBraces(value) {
  let text = String(value ?? "").trim();
  while (text.startsWith("{") && text.endsWith("}")) {
    const parsed = extractBalanced(text, 0, "{", "}");
    if (!parsed || parsed.end !== text.length) break;
    text = parsed.content.trim();
  }
  return text;
}

function readOptional(source, cursor, open, close) {
  cursor = skipWhitespace(source, cursor);
  if (source[cursor] !== open) return null;
  return extractBalanced(source, cursor, open, close);
}

function extractBalanced(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === open && source[index - 1] !== "\\") depth += 1;
    if (char === close && source[index - 1] !== "\\") depth -= 1;
    if (depth === 0) return { content: source.slice(start + 1, index), end: index + 1 };
  }
  return null;
}

function skipWhitespace(source, index) {
  let cursor = index;
  while (cursor < source.length && /\s/.test(source[cursor] || "")) cursor += 1;
  return cursor;
}

function fmt(value) {
  return String(roundNumber(value, 6));
}
