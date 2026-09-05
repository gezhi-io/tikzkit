import {
  TIKZ_DASH_PATTERN_STYLES,
  TIKZ_LINE_WIDTHS,
  createArrowTip,
  lineWidthFromTikzDimension
} from "../tikz/metrics.js";
import { parseDimension } from "./math.js";

const TIKZ_UNIT = 100;

const TEX_CSS_CONFLICT_COLOR_NAMES = new Set([
  "green",
  "brown",
  "cyan",
  "magenta",
  "yellow",
  "olive",
  "lime",
  "orange",
  "pink",
  "purple",
  "violet"
]);

const NAMED_COLORS = new Set([
  "black",
  "white",
  "red",
  "green",
  "blue",
  "cyan",
  "magenta",
  "yellow",
  "gray",
  "grey",
  "orange",
  "purple",
  "brown",
  "pink"
]);

for (const color of [
  "aqua",
  "aquamarine",
  "blueviolet",
  "chartreuse",
  "coral",
  "cornflowerblue",
  "crimson",
  "darkblue",
  "darkcyan",
  "darkgray",
  "darkgreen",
  "darkgrey",
  "darkmagenta",
  "darkorange",
  "darkred",
  "darkviolet",
  "deeppink",
  "deepskyblue",
  "dimgray",
  "dimgrey",
  "fuchsia",
  "gold",
  "goldenrod",
  "greenyellow",
  "indigo",
  "lightblue",
  "lightcyan",
  "lightgray",
  "lightgreen",
  "lightgrey",
  "lightpink",
  "lightsteelblue",
  "lime",
  "limegreen",
  "maroon",
  "navy",
  "none",
  "olive",
  "orchid",
  "plum",
  "rebeccapurple",
  "salmon",
  "silver",
  "skyblue",
  "springgreen",
  "teal",
  "transparent",
  "turquoise",
  "violet",
  "yellowgreen"
]) {
  NAMED_COLORS.add(color);
}

export function splitTopLevel(input, delimiter = ",") {
  const parts = [];
  let current = "";
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === "(") paren += 1;
    if (char === ")") paren = Math.max(0, paren - 1);
    if (char === "[" && paren === 0 && brace === 0 && isBareDelimiterOptionBracket(current)) {
      current += char;
      continue;
    }
    if (char === "[") bracket += 1;
    if (char === "]") bracket = Math.max(0, bracket - 1);
    if (char === "{") brace += 1;
    if (char === "}") brace = Math.max(0, brace - 1);

    if (char === delimiter && !isEscapedCharacter(input, i) && paren === 0 && bracket === 0 && brace === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim() || input.trim() === "") {
    parts.push(current.trim());
  }
  return parts.filter((part) => part.length > 0);
}

function isEscapedCharacter(input, index) {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && input[cursor] === "\\"; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

export function isBareDelimiterOptionBracket(prefix = "") {
  const match = String(prefix).match(/(?:^|,)\s*([^=,{}[\]]+?)\s*=\s*$/);
  if (!match) return false;
  return /(?:^|\s)(?:left|right)\s+delimiter$/i.test(match[1].trim());
}

export function findTopLevel(input, needle) {
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === "(") paren += 1;
    if (char === ")") paren = Math.max(0, paren - 1);
    if (char === "[") bracket += 1;
    if (char === "]") bracket = Math.max(0, bracket - 1);
    if (char === "{") brace += 1;
    if (char === "}") brace = Math.max(0, brace - 1);
    if (char === needle && paren === 0 && bracket === 0 && brace === 0) {
      return i;
    }
  }
  return -1;
}

export function parseOptions(input = "") {
  const options = {};
  const withoutComments = stripTexComments(String(input ?? ""));
  for (const part of splitTopLevel(withoutComments, ",")) {
    const equals = findTopLevel(part, "=");
    if (equals === -1) {
      setParsedOption(options, part.trim(), true);
      continue;
    }
    const key = part.slice(0, equals).trim();
    const value = stripOuterBraces(part.slice(equals + 1).trim());
    setParsedOption(options, key, value);
  }
  return options;
}

export function stripTexComments(input = "") {
  let output = "";
  const text = String(input ?? "");
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\\") {
      output += char;
      if (index + 1 < text.length) {
        output += text[index + 1];
        index += 1;
      }
      continue;
    }
    if (char === "%") {
      while (index < text.length && text[index] !== "\n" && text[index] !== "\r") index += 1;
      if (index < text.length) output += text[index];
      continue;
    }
    output += char;
  }
  return output;
}

function setParsedOption(options, key, value) {
  if (isRepeatableOption(key) && Object.hasOwn(options, key)) {
    options[key] = [...optionValues(options[key]), value];
    return;
  }
  options[key] = value;
}

export function parseTikzset(input = "") {
  const styles = {};
  for (const part of splitTopLevel(input, ",")) {
    const match = part.match(/^(.+?)\/\.(style|append\s+style|prefix\s+style)\s*=\s*\{([\s\S]*)\}$/);
    if (match) {
      styles[match[1].trim()] = parseOptions(match[3]);
    }
  }
  return styles;
}

export function styleDefinitionsFromOptions(rawOptions = {}, baseStyles = {}) {
  const styles = {};
  for (const [key, value] of Object.entries(rawOptions || {})) {
    const defaultMatch = String(key).match(/^(.+?)\/\.default$/);
    if (defaultMatch) {
      const name = defaultMatch[1].trim();
      const existing = styles[name] || baseStyles[name] || {};
      styles[name] = {
        ...existing,
        __tikzStyleDefault: value === true ? "" : String(value)
      };
      continue;
    }
    const styleArgsMatch = String(key).match(/^(.+?)\/\.style\s+args$/);
    if (styleArgsMatch) {
      const name = styleArgsMatch[1].trim();
      const parsed = parseStyleArgsDefinition(value === true ? "" : String(value));
      if (!parsed) continue;
      const existing = styles[name] || baseStyles[name] || {};
      styles[name] = {
        ...existing,
        __tikzStyleArgsPattern: parsed.pattern,
        __tikzStyleOptions: parsed.options
      };
      continue;
    }
    const match = String(key).match(/^(.+?)\/\.(style|append\s+style|prefix\s+style)$/);
    if (!match) continue;
    const name = match[1].trim();
    const mode = match[2].replace(/\s+/g, " ");
    const parsed = parseOptions(value === true ? "" : String(value));
    if (mode === "style") {
      styles[name] = parsed;
      continue;
    }
    const existing = styles[name] || baseStyles[name] || {};
    styles[name] = mode === "append style"
      ? { ...existing, ...parsed }
      : { ...parsed, ...existing };
  }
  return styles;
}

export function codeDefinitionsFromOptions(rawOptions = {}, baseCodeHandlers = {}) {
  const handlers = { ...(baseCodeHandlers || {}) };
  for (const [key, value] of Object.entries(rawOptions || {})) {
    const codeArgsMatch = String(key).match(/^(.+?)\/\.code\s+args$/);
    if (codeArgsMatch) {
      const parsed = parseCodeArgsDefinition(value === true ? "" : String(value));
      if (!parsed) continue;
      handlers[codeArgsMatch[1].trim()] = parsed;
      continue;
    }
    const codeMatch = String(key).match(/^(.+?)\/\.code$/);
    if (codeMatch) {
      handlers[codeMatch[1].trim()] = {
        pattern: "#1",
        body: value === true ? "" : String(value)
      };
    }
  }
  return handlers;
}

function parseCodeArgsDefinition(raw) {
  let cursor = 0;
  const pattern = readBalancedGroup(raw, cursor);
  if (!pattern) return null;
  cursor = pattern.end;
  const body = readBalancedGroup(raw, cursor);
  if (!body) return null;
  return {
    pattern: pattern.content.trim(),
    body: body.content
  };
}

function parseStyleArgsDefinition(raw) {
  let cursor = 0;
  const pattern = readBalancedGroup(raw, cursor);
  if (!pattern) return null;
  cursor = pattern.end;
  const body = readBalancedGroup(raw, cursor);
  if (!body) return null;
  return {
    pattern: pattern.content.trim(),
    options: parseOptions(body.content)
  };
}

function readBalancedGroup(text, start = 0) {
  let cursor = start;
  while (/\s/.test(text[cursor] || "")) cursor += 1;
  if (text[cursor] !== "{") return null;
  let depth = 0;
  for (let index = cursor; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return {
        content: text.slice(cursor + 1, index),
        end: index + 1
      };
    }
  }
  return null;
}

export function normalizeOptions(command, rawOptions, env) {
  const expanded = expandStyleOptions(rawOptions, env);
  const style = defaultStyleForCommand(command);
  const semantic = {};
  const defaultArrowTip = parseDefaultArrowTip(expanded);
  let currentColor = "black";
  let usesCurrentColorForFill = false;
  let pendingDashPattern;
  let pendingDashKey;

  for (const [key, value] of Object.entries(expanded)) {
    if (key === "arrows" && value !== true) {
      const arrowHints = parseArrowOption(String(value), true, defaultArrowTip);
      if (arrowHints) Object.assign(style, arrowHints);
      continue;
    }
    const arrowHints = parseArrowOption(key, value, defaultArrowTip);
    if (arrowHints) {
      Object.assign(style, arrowHints);
      continue;
    }
    if (key === ">") {
      continue;
    }
    if (value === true && isColorToken(key)) {
      const color = normalizeColor(key);
      applyCurrentColor(style, color, command);
      currentColor = color;
      if (usesCurrentColorForFill) style.fill = color;
      continue;
    }
    if (key.includes("!")) {
      const color = normalizeColor(key);
      applyCurrentColor(style, color, command);
      currentColor = color;
      if (usesCurrentColorForFill) style.fill = color;
      continue;
    }
    if (key === "draw") {
      style.stroke = value === true ? (style.stroke !== "none" ? style.stroke : style.textFill || "black") : normalizeColor(String(value));
      continue;
    }
    if (key === "fill") {
      if (value === true) {
        semantic["tikzkit bare fill"] = true;
        usesCurrentColorForFill = true;
        style.fill = currentColor;
      } else {
        usesCurrentColorForFill = false;
        style.fill = normalizeColor(String(value));
      }
      continue;
    }
    if (key === "even odd rule") {
      style.fillRule = "evenodd";
      continue;
    }
    if (key === "nonzero rule") {
      style.fillRule = "nonzero";
      continue;
    }
    if (key === "shading") {
      semantic.shading = String(value || "").trim();
      continue;
    }
    if (key === "path fading") {
      style.pathFading = String(value || "").trim();
      continue;
    }
    if (key === "ball color") {
      semantic["ball color"] = normalizeColor(String(value));
      if (!semantic.shading) semantic.shading = "ball";
      continue;
    }
    if (
      key === "top color" ||
      key === "bottom color" ||
      key === "middle color" ||
      key === "left color" ||
      key === "right color"
    ) {
      semantic[key] = normalizeColor(String(value));
      if (key === "middle color") {
        semantic["tikzkit axis middle color"] = semantic[key];
      } else {
        // TikZ recalculates the axis midpoint whenever a terminal color is
        // assigned. This deliberately overwrites an earlier middle color.
        const top = semantic["top color"] ?? semantic["left color"] ?? "gray";
        const bottom = semantic["bottom color"] ?? semantic["right color"] ?? "white";
        semantic["tikzkit axis middle color"] = normalizeColor(`${top}!50!${bottom}`);
      }
      continue;
    }
    if (key === "shading angle") {
      semantic[key] = String(value);
      continue;
    }
    if (key === "tikzkit axis stops") {
      semantic[key] = String(value);
      continue;
    }
    if (key === "color") {
      const color = normalizeColor(String(value));
      applyCurrentColor(style, color, command);
      currentColor = color;
      if (usesCurrentColorForFill) style.fill = color;
      continue;
    }
    if (key === "text") {
      style.textFill = normalizeColor(String(value));
      continue;
    }
    if (key === "pattern") {
      style.pattern = String(value || "").trim();
      continue;
    }
    if (key === "pattern color") {
      style.patternColor = normalizeColor(String(value));
      continue;
    }
    if (key === "line width") {
      style.lineWidth = lineWidthFromTikzDimension(value, style.lineWidth);
      continue;
    }
    if (key === "line cap") {
      style.lineCap = normalizeLineCap(value);
      continue;
    }
    if (key === "line join") {
      style.lineJoin = normalizeLineJoin(value);
      continue;
    }
    if (key === "shorten <=" || key === "shorten <") {
      style.shortenStart = parseStyleLength(value, style.lineWidth, env.variables || {});
      continue;
    }
    if (key === "shorten >=" || key === "shorten >") {
      style.shortenEnd = parseStyleLength(value, style.lineWidth, env.variables || {});
      continue;
    }
    if (key === "ultra thin") {
      style.lineWidth = TIKZ_LINE_WIDTHS.ultraThin;
      continue;
    }
    if (key === "very thin") {
      style.lineWidth = TIKZ_LINE_WIDTHS.veryThin;
      continue;
    }
    if (key === "thin") {
      style.lineWidth = TIKZ_LINE_WIDTHS.thin;
      continue;
    }
    if (key === "semithick") {
      style.lineWidth = TIKZ_LINE_WIDTHS.semithick;
      continue;
    }
    if (key === "thick") {
      style.lineWidth = TIKZ_LINE_WIDTHS.thick;
      continue;
    }
    if (key === "very thick") {
      style.lineWidth = TIKZ_LINE_WIDTHS.veryThick;
      continue;
    }
    if (key === "ultra thick") {
      style.lineWidth = TIKZ_LINE_WIDTHS.ultraThick;
      continue;
    }
    if (key === "dash pattern") {
      pendingDashPattern = value;
      pendingDashKey = key;
      continue;
    }
    if (Object.hasOwn(TIKZ_DASH_PATTERN_STYLES, key)) {
      pendingDashPattern = TIKZ_DASH_PATTERN_STYLES[key];
      pendingDashKey = key;
      continue;
    }
    if (key === "opacity") {
      style.opacity = Number(value);
      continue;
    }
    if (key === "fill opacity") {
      style.fillOpacity = Number(value);
      continue;
    }
    if (key === "draw opacity" || key === "stroke opacity") {
      style.strokeOpacity = Number(value);
      continue;
    }
    if (key === "text opacity") {
      style.textOpacity = Number(value);
      continue;
    }
    semantic[key] = value;
  }

  if (pendingDashPattern !== undefined) {
    style.dashArray = parseDashPattern(pendingDashPattern, style.lineWidth);
    if (style.dashArray) style.dashLineCap = "butt";
  }

  return { style, semantic, options: expanded };
}

function normalizeLineCap(value) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "round") return "round";
  if (text === "rect" || text === "square") return "square";
  return "butt";
}

function normalizeLineJoin(value) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "round") return "round";
  if (text === "bevel") return "bevel";
  return "miter";
}

function applyNodeColor(style, color) {
  style.textFill = color;
  if (style.stroke !== "none") style.stroke = color;
}

function applyCurrentColor(style, color, command) {
  if (command === "node") {
    applyNodeColor(style, color);
    return;
  }
  if (command === "fill") {
    style.fill = color;
    return;
  }
  if (command === "filldraw") {
    style.stroke = color;
    style.fill = color;
    return;
  }
  style.stroke = color;
}

export function arrowTipsFromOptions(rawOptions = {}) {
  const defaultArrowTip = parseDefaultArrowTip(rawOptions);
  const hints = {};
  for (const [key, value] of Object.entries(rawOptions || {})) {
    const arrowHints = parseArrowOption(key, value, defaultArrowTip);
    if (arrowHints) Object.assign(hints, arrowHints);
  }
  return hints;
}

export function edgeStyleHintsFromOptions(rawOptions = {}, env) {
  const { style, options } = normalizeOptions("draw", rawOptions, env);
  const hints = arrowTipsFromOptions(options);
  for (const [key, value] of Object.entries(options || {})) {
    if (optionSetsStroke(key, value)) hints.stroke = style.stroke;
    if (optionSetsFill(key)) hints.fill = style.fill;
    if (optionSetsLineWidth(key)) hints.lineWidth = style.lineWidth;
    if (optionSetsDashPattern(key)) hints.dashArray = style.dashArray;
    if (key === "opacity") hints.opacity = style.opacity;
    if (key === "fill opacity") hints.fillOpacity = style.fillOpacity;
    if (key === "draw opacity" || key === "stroke opacity") hints.strokeOpacity = style.strokeOpacity;
    if (key === "shorten <=" || key === "shorten <") hints.shortenStart = style.shortenStart;
    if (key === "shorten >=" || key === "shorten >") hints.shortenEnd = style.shortenEnd;
  }
  return hints;
}

function optionSetsStroke(key, value) {
  return key === "draw" || key === "color" || (value === true && isColorToken(key)) || key.includes("!");
}

function optionSetsFill(key) {
  return key === "fill";
}

function optionSetsLineWidth(key) {
  return (
    key === "line width" ||
    key === "ultra thin" ||
    key === "very thin" ||
    key === "thin" ||
    key === "semithick" ||
    key === "thick" ||
    key === "very thick" ||
    key === "ultra thick"
  );
}

function optionSetsDashPattern(key) {
  return key === "dash pattern" || Object.hasOwn(TIKZ_DASH_PATTERN_STYLES, key);
}

function parseDashPattern(value, currentLineWidth) {
  const text = stripOuterBraces(String(value ?? "")).trim();
  if (!text) return undefined;
  const dashArray = [];
  const tokenPattern = /\b(?:on|off)\s+((?:\\the\s*)?\\pgflinewidth|[-+]?(?:\d+\.?\d*|\.\d+)(?:\s*(?:cm|mm|pt|em|ex|in))?)/g;
  let match;
  while ((match = tokenPattern.exec(text))) {
    dashArray.push(parseDashLength(match[1], currentLineWidth));
  }
  return dashArray.length ? dashArray : undefined;
}

function parseDashLength(value, currentLineWidth) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (text === String.raw`\pgflinewidth` || text === String.raw`\the\pgflinewidth` || text === String.raw`\the \pgflinewidth`) {
    return currentLineWidth;
  }
  return lineWidthFromTikzDimension(text, currentLineWidth);
}

function parseDefaultArrowTip(options = {}) {
  return options[">"] ? parseArrowTipSpec(String(options[">"])) : createArrowTip("to");
}

function parseArrowOption(key, value, defaultArrowTip) {
  if (value !== true) return null;
  const text = String(key).trim();
  if (text === "->") return { markerStart: undefined, markerEnd: { ...defaultArrowTip } };
  if (text === "<-") return { markerStart: { ...defaultArrowTip }, markerEnd: undefined };
  if (text === "<->") return { markerStart: { ...defaultArrowTip }, markerEnd: { ...defaultArrowTip } };
  if (text === "*-") return { markerStart: parseArrowTipSpec("*"), markerEnd: undefined };
  if (text === "-*") return { markerStart: undefined, markerEnd: parseArrowTipSpec("*") };
  if (text === "*-*") return { markerStart: parseArrowTipSpec("*"), markerEnd: parseArrowTipSpec("*") };
  if (text === "*->") return { markerStart: parseArrowTipSpec("*"), markerEnd: { ...defaultArrowTip } };

  const spacedDelimiterBoth = text.match(/^(spaced\s+[\[\]()|])\s*-\s*(spaced\s+[\[\]()|])$/u);
  if (spacedDelimiterBoth) {
    return {
      markerStart: parseArrowTipSpec(spacedDelimiterBoth[1]),
      markerEnd: parseArrowTipSpec(spacedDelimiterBoth[2])
    };
  }

  const customBoth = text.match(/^\{([\s\S]+)\}-\{([\s\S]+)\}$/);
  if (customBoth) {
    return { markerStart: parseArrowTipSpec(customBoth[1]), markerEnd: parseArrowTipSpec(customBoth[2]) };
  }
  const customEnd = text.match(/^-\{([\s\S]+)\}$/);
  if (customEnd) return { markerStart: undefined, markerEnd: parseArrowTipSpec(customEnd[1]) };
  const customStart = text.match(/^\{([\s\S]+)\}-$/);
  if (customStart) return { markerStart: parseArrowTipSpec(customStart[1]), markerEnd: undefined };

  const namedBoth = text.match(/^([A-Za-z'][A-Za-z0-9'\s-]*?)-([A-Za-z'][A-Za-z0-9'\s-]*?)$/);
  if (namedBoth) return { markerStart: parseArrowTipSpec(namedBoth[1]), markerEnd: parseArrowTipSpec(namedBoth[2]) };
  const namedEnd = text.match(/^-([A-Za-z'][A-Za-z0-9'\s-]*?)$/);
  if (namedEnd) return { markerStart: undefined, markerEnd: parseArrowTipSpec(namedEnd[1]) };
  const namedStart = text.match(/^([A-Za-z'][A-Za-z0-9'\s-]*?)-$/);
  if (namedStart) return { markerStart: parseArrowTipSpec(namedStart[1]), markerEnd: undefined };

  return null;
}

const ARROW_TIP_SEQUENCE_NAMES = [
  "Computer Modern Rightarrow",
  "Classical TikZ Rightarrow",
  "open triangle 90 reversed",
  "open triangle 60 reversed",
  "open triangle 45 reversed",
  "spaced open triangle 90 reversed",
  "spaced open triangle 60 reversed",
  "spaced open triangle 45 reversed",
  "spaced triangle 90 reversed",
  "spaced triangle 60 reversed",
  "spaced triangle 45 reversed",
  "spaced angle 90 reversed",
  "spaced angle 60 reversed",
  "spaced angle 45 reversed",
  "spaced open triangle 90",
  "spaced open triangle 60",
  "spaced open triangle 45",
  "spaced triangle 90",
  "spaced triangle 60",
  "spaced triangle 45",
  "spaced angle 90",
  "spaced angle 60",
  "spaced angle 45",
  "spaced left hook reversed",
  "spaced right hook reversed",
  "spaced hooks reversed",
  "spaced left to reversed",
  "spaced right to reversed",
  "spaced serif cm",
  "spaced left hook",
  "spaced right hook",
  "spaced hooks",
  "spaced left to",
  "spaced right to",
  "spaced [",
  "spaced ]",
  "spaced (",
  "spaced )",
  "spaced |",
  "spaced open diamond",
  "spaced open square",
  "spaced diamond",
  "spaced square",
  "spaced o",
  "spaced *",
  "triangle 90 reversed",
  "triangle 60 reversed",
  "triangle 45 reversed",
  "open triangle 90",
  "open triangle 60",
  "open triangle 45",
  "triangle 90",
  "triangle 60",
  "triangle 45",
  "left hook reversed",
  "right hook reversed",
  "hooks reversed",
  "left to reversed",
  "right to reversed",
  "serif cm",
  "left hook",
  "right hook",
  "hooks",
  "left to",
  "right to",
  "implies",
  "spaced implies",
  "stealth' reversed",
  "latex' reversed",
  "latex'",
  "spaced stealth' reversed",
  "spaced stealth reversed",
  "spaced latex' reversed",
  "spaced latex reversed",
  "spaced to reversed",
  "spaced stealth'",
  "spaced stealth",
  "spaced latex'",
  "spaced latex",
  "spaced to",
  "spaced triangle 90 cap reversed",
  "spaced fast cap reversed",
  "spaced triangle 90 cap",
  "spaced round cap",
  "spaced butt cap",
  "spaced fast cap",
  "triangle 90 cap reversed",
  "fast cap reversed",
  "triangle 90 cap",
  "round cap",
  "butt cap",
  "fast cap",
  "open diamond",
  "diamond",
  "open square",
  "square",
  "square bracket reversed",
  "round bracket reversed",
  "angle 90 reversed",
  "angle 60 reversed",
  "angle 45 reversed",
  "square bracket",
  "round bracket",
  "angle 90",
  "angle 60",
  "angle 45",
  "Straight Barb",
  "Open Triangle",
  "Open Circle",
  "Arc Barb",
  "Tee Barb",
  "Turned Square",
  "Triangle Cap",
  "Round Cap",
  "Butt Cap",
  "Fast Triangle",
  "Fast Round",
  "two heads",
  "dimline reverse",
  "Stealth'",
  "stealth'",
  "Latex",
  "LaTeX",
  "latex",
  "Stealth",
  "stealth",
  "Triangle",
  "Rectangle",
  "Parenthesis",
  "Bracket",
  "Diamond",
  "Ellipse",
  "Circle",
  "Square",
  "Kite",
  "Hooks",
  "Hook",
  "Implies",
  "Rays",
  "Bar",
  "To",
  "to"
].sort((left, right) => right.length - left.length);

export function parseArrowTipSpec(input) {
  const text = stripOuterBraces(String(input || "").trim());
  const sequence = parseArrowTipSequence(text);
  if (sequence) return sequence;
  return parseArrowTipAtom(text);
}

function parseArrowTipAtom(input, inheritedOptions = {}) {
  const text = String(input || "").trim();
  const match = text.match(/^([A-Za-z0-9>'()\s-]+)(?:\[([\s\S]*)\])?$/);
  if (!match) return createArrowTip(text);
  const sourceName = match[1].trim();
  const aliasDefaults = sourceName === "Parenthesis"
    ? { arc: "+120", length: "+1.725pt +2.3" }
    : sourceName === "Bar"
      ? { length: "+0pt" }
      : sourceName === "Bracket"
        ? { "inset'": "+0pt +1", length: "+0.75pt +1" }
        : {};
  const options = { ...aliasDefaults, ...inheritedOptions, ...(match[2] ? parseOptions(match[2]) : {}) };
  const overrides = {};
  if (options.width) {
    overrides.width = lineWidthFromTikzDimension(options.width);
    overrides.customWidth = true;
    overrides.widthSpec = parseArrowTipDimensionSpec(options.width);
  }
  if (options["width'"]) {
    overrides.widthPrimeSpec = parseArrowTipDimensionSpec(options["width'"]);
  }
  if (options.length) {
    overrides.length = lineWidthFromTikzDimension(options.length);
    overrides.customLength = true;
    overrides.lengthSpec = parseArrowTipDimensionSpec(options.length);
  }
  if (options.inset) {
    overrides.inset = lineWidthFromTikzDimension(options.inset);
    overrides.customInset = true;
    overrides.insetSpec = parseArrowTipDimensionSpec(options.inset);
  }
  if (options["inset'"]) {
    overrides.insetPrimeSpec = parseArrowTipDimensionSpec(options["inset'"]);
  }
  if (options["line width"]) {
    overrides.lineWidth = lineWidthFromTikzDimension(options["line width"]);
    overrides.lineWidthSpec = parseArrowTipDimensionSpec(options["line width"]);
  }
  if (options["line width'"]) {
    overrides.lineWidthPrimeSpec = parseArrowTipDimensionSpec(options["line width'"]);
  }
  // These are the arrows.meta option keys that affect Stealth's geometry or
  // paint. Keep them on the tip object so the renderer can share the PGF
  // setup calculation with ordinary forward Stealth tips.
  const harpoon = options.harpoon === true || options.left === true || options.right === true;
  const swap = options.swap === true || options.right === true;
  if (harpoon) overrides.harpoon = true;
  if (swap) overrides.swap = true;
  if (options.reversed === true) overrides.reversed = true;
  if (options.round === true) {
    overrides.roundCap = true;
    overrides.roundJoin = true;
  }
  if (options.sharp === true) {
    overrides.roundCap = false;
    overrides.roundJoin = false;
  }
  if (options["line cap"] === "round") overrides.roundCap = true;
  if (options["line cap"] === "butt") overrides.roundCap = false;
  if (options["line join"] === "round") overrides.roundJoin = true;
  if (options["line join"] === "miter") overrides.roundJoin = false;
  if (Number.isFinite(Number(options.slant))) overrides.slant = Number(options.slant);
  if (Number.isFinite(Number(options.arc))) overrides.arc = Number(options.arc);
  if (options.open === true) {
    overrides.open = true;
    overrides.fill = "none";
  }
  if (options.color || options.draw) overrides.stroke = normalizeColor(String(options.color || options.draw));
  if (options.fill) overrides.fill = normalizeColor(String(options.fill));
  const separation = parseArrowTipSeparation(options.sep);
  if (separation) overrides.separation = separation;
  const bending = parseArrowTipBending(options);
  if (bending) overrides.bending = bending;
  const declaredArrow = parseDeclaredArrowPayload(options["tikzkit declared arrow"]);
  if (declaredArrow) {
    overrides.declaredArrow = declaredArrow;
    if (declaredArrow.paint === "fill" || declaredArrow.paint === "fillstroke") overrides.fill = "context-stroke";
    if (declaredArrow.paint === "stroke" || declaredArrow.paint === "fillstroke") overrides.stroke = "context-stroke";
  }
  const tip = createArrowTip(sourceName, overrides);
  const scale = arrowTipScaleFactor(options.scale);
  const lengthScale = arrowTipScaleFactor(options["scale length"]);
  const widthScale = arrowTipScaleFactor(options["scale width"]);
  const hasScale = Math.abs(scale - 1) >= 1e-12;
  const hasIndependentScale = Math.abs(lengthScale - 1) >= 1e-12 || Math.abs(widthScale - 1) >= 1e-12;
  if (!hasScale && !hasIndependentScale) return tip;

  // `Latex` and `Stealth` are arrows.meta geometric tips only in their
  // capitalized spelling. Their length and width scales must remain separate:
  // the first also controls the tip inset/shortening while the latter does not.
  if (tip.meta) {
    const resolvedLengthScale = scale * lengthScale;
    const resolvedWidthScale = scale * widthScale;
    return {
      ...tip,
      scale,
      lengthScale,
      widthScale,
      // Preserve the historic IR preview dimensions for default tips. They
      // are not treated as explicit lengths downstream: the SVG renderer
      // re-derives them from the active path line width, as PGF does.
      ...(!overrides.customLength ? { length: tip.length * resolvedLengthScale } : {}),
      ...(!overrides.customWidth ? { width: tip.width * resolvedWidthScale } : {})
    };
  }

  // Keep the established compatibility behavior for classic and third-party
  // tips: only their generic `scale` key changes the fixed dimensions.
  if (!hasScale) return tip;
  return {
    ...tip,
    length: tip.length * scale,
    width: tip.width * scale,
    ...(tip.lineWidth ? { lineWidth: tip.lineWidth * scale } : {})
  };
}

function parseArrowTipDimensionSpec(value) {
  const text = String(value ?? "").trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  if (!text) return undefined;
  const match = text.match(/^(.*?)(?:\s+([-+]?(?:\d+\.?\d*|\.\d+)))?(?:\s+([-+]?(?:\d+\.?\d*|\.\d+)))?$/);
  if (!match) return undefined;
  const dimension = lineWidthFromTikzDimension(match[1], NaN);
  if (!Number.isFinite(dimension)) return undefined;
  return {
    dimension,
    lineWidthFactor: Number.isFinite(Number(match[2])) ? Number(match[2]) : 0,
    outerFactor: Number.isFinite(Number(match[3])) ? Number(match[3]) : 0
  };
}

function parseArrowTipSequence(text) {
  let cursor = 0;
  let inheritedOptions = {};
  const leadingOptions = readArrowTipOptionGroup(text, cursor);
  if (leadingOptions) {
    inheritedOptions = parseOptions(leadingOptions.content);
    cursor = leadingOptions.end;
  }

  const tips = [];
  while (cursor < text.length) {
    while (/\s/.test(text[cursor] || "")) cursor += 1;
    if (cursor >= text.length) break;

    let name = "";
    if (/[><*_|]/.test(text[cursor])) {
      name = text[cursor];
      cursor += 1;
    } else {
      const known = ARROW_TIP_SEQUENCE_NAMES.find((candidate) => {
        if (!text.startsWith(candidate, cursor)) return false;
        const next = text[cursor + candidate.length] || "";
        return !next || /[\s[><*_|]/.test(next);
      });
      if (!known) return null;
      name = known;
      cursor += known.length;
    }

    while (/\s/.test(text[cursor] || "")) cursor += 1;
    const localOptions = readArrowTipOptionGroup(text, cursor);
    const options = localOptions ? parseOptions(localOptions.content) : {};
    if (localOptions) cursor = localOptions.end;
    tips.push(parseArrowTipAtom(`${name === "<" ? ">" : name}`, { ...inheritedOptions, ...options }));
  }

  return tips.length > 1 ? { kind: "sequence", tips } : null;
}

function readArrowTipOptionGroup(text, start) {
  if (text[start] !== "[") return null;
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === "[") depth += 1;
    if (text[index] === "]") depth -= 1;
    if (depth === 0) {
      return { content: text.slice(start + 1, index), end: index + 1 };
    }
  }
  return null;
}

function parseArrowTipSeparation(value) {
  if (value === undefined || value === false) return undefined;
  const text = value === true ? "0.88pt .3 1" : String(value).trim();
  if (!text) return undefined;
  const match = text.match(/^(\S+)(?:\s+([-+]?(?:\d+\.?\d*|\.\d+)))?(?:\s+([-+]?(?:\d+\.?\d*|\.\d+)))?$/);
  if (!match) return undefined;
  const dimension = lineWidthFromTikzDimension(match[1], NaN);
  if (!Number.isFinite(dimension)) return undefined;
  return {
    dimension,
    lineWidthFactor: Number.isFinite(Number(match[2])) ? Number(match[2]) : 0,
    outerFactor: Number.isFinite(Number(match[3])) ? Number(match[3]) : 0
  };
}

function parseArrowTipBending(options = {}) {
  let bending;
  for (const key of Object.keys(options)) {
    if (key === "bend" && options[key] !== false) {
      bending = { mode: "bend" };
    } else if ((key === "flex" || key === "flex'") && options[key] !== false) {
      const raw = options[key] === true ? 1 : Number(options[key]);
      bending = {
        mode: key === "flex'" ? "flexPrime" : "flex",
        factor: Number.isFinite(raw) ? raw : 1
      };
    }
  }
  return bending;
}

function arrowTipScaleFactor(value) {
  const scale = Number(String(value ?? "").trim().replace(/^\{([\s\S]*)\}$/, "$1"));
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function parseDeclaredArrowPayload(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    if (!/^(?:[0-9a-f]{2})+$/i.test(value)) return null;
    let encoded = "";
    for (let index = 0; index < value.length; index += 2) {
      encoded += String.fromCharCode(Number.parseInt(value.slice(index, index + 2), 16));
    }
    const decoded = JSON.parse(decodeURIComponent(encoded));
    if (!decoded || typeof decoded.path !== "string" || !decoded.path || !decoded.bounds) return null;
    const bounds = decoded.bounds;
    if (![bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(Number.isFinite)) return null;
    if (!["fill", "stroke", "fillstroke"].includes(decoded.paint)) return null;
    const usesLegacyExtents = decoded.usesLegacyExtents === true;
    const extents = usesLegacyExtents
      ? {
          usesLegacyExtents,
          backEnd: Number(decoded.backEnd),
          tipEnd: Number(decoded.tipEnd),
          lineEnd: Number(decoded.lineEnd)
        }
      : {};
    if (usesLegacyExtents && ![extents.backEnd, extents.tipEnd, extents.lineEnd].every(Number.isFinite)) return null;
    const program = decoded.program
      && typeof decoded.program.setup === "string"
      && typeof decoded.program.drawing === "string"
      ? { setup: decoded.program.setup, drawing: decoded.program.drawing }
      : null;
    const lineCap = ["butt", "round"].includes(decoded.lineCap) ? decoded.lineCap : null;
    const lineJoin = ["miter", "round"].includes(decoded.lineJoin) ? decoded.lineJoin : null;
    return {
      name: String(decoded.name || "declared"),
      path: decoded.path,
      paint: decoded.paint,
      bounds,
      ...extents,
      ...(decoded.reversed === true ? { reversed: true } : {}),
      ...(program ? { program } : {}),
      ...(lineCap ? { lineCap } : {}),
      ...(lineJoin ? { lineJoin } : {})
    };
  } catch {
    return null;
  }
}

function isColorToken(value) {
  const text = String(value).trim();
  return isPlainColor(text) || text.includes("!");
}

export function normalizeColor(value) {
  const text = String(value).trim();
  const rgb = text.match(/^rgb\s*:\s*red\s*,\s*(\d+)\s*;\s*green\s*,\s*(\d+)\s*;\s*blue\s*,\s*(\d+)$/);
  if (rgb) return `rgb(${rgb[1]} ${rgb[2]} ${rgb[3]})`;
  if (!text.includes("!")) {
    const texNamed = TEX_NAMED_COLOR_RGB[text];
    if (texNamed) return rgbToCss(texNamed);
    const lower = text.toLowerCase();
    const natural = xcolorNaturalColorSpec(lower);
    if (natural && TEX_CSS_CONFLICT_COLOR_NAMES.has(lower)) {
      return colorSpecToCss(natural);
    }
    return isPlainColor(text) ? text : "black";
  }
  const parts = text.split("!").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return text;
  let current = colorToSpec(parts[0]);
  if (!current) return isPlainColor(parts[0]) ? parts[0] : "black";
  for (let index = 1; index < parts.length; index += 2) {
    const amount = Number(parts[index]);
    if (!Number.isFinite(amount)) return colorSpecToCss(current);
    const target = colorToSpec(parts[index + 1] || "white");
    if (!target) return colorSpecToCss(current);
    const convertedTarget = convertColorSpec(target, current.model);
    current = {
      model: current.model,
      channels: mixChannels(current.channels, convertedTarget.channels, amount / 100)
    };
  }
  return colorSpecToCss(current);
}

function isPlainColor(value) {
  const text = String(value).trim();
  return (
    NAMED_COLORS.has(text.toLowerCase()) ||
    /^#[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?$/i.test(text) ||
    /^rgba?\s*\(/i.test(text) ||
    /^hsla?\s*\(/i.test(text)
  );
}

const BASIC_COLOR_RGB = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  red: [255, 0, 0],
  green: [0, 255, 0],
  blue: [0, 0, 255],
  cyan: [0, 255, 255],
  magenta: [255, 0, 255],
  yellow: [255, 255, 0],
  aqua: [0, 255, 255],
  aquamarine: [127, 255, 212],
  blueviolet: [138, 43, 226],
  orange: [255, 128, 0],
  purple: [191, 0, 64],
  violet: [238, 130, 238],
  teal: [0, 128, 128],
  brown: [191, 128, 64],
  chartreuse: [127, 255, 0],
  coral: [255, 127, 80],
  cornflowerblue: [100, 149, 237],
  crimson: [220, 20, 60],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  lightgray: [211, 211, 211],
  darkgray: [169, 169, 169],
  darkgrey: [169, 169, 169],
  darkblue: [0, 0, 139],
  darkcyan: [0, 139, 139],
  darkgreen: [0, 100, 0],
  darkmagenta: [139, 0, 139],
  darkorange: [255, 140, 0],
  darkred: [139, 0, 0],
  darkviolet: [148, 0, 211],
  deeppink: [255, 20, 147],
  deepskyblue: [0, 191, 255],
  dimgray: [105, 105, 105],
  dimgrey: [105, 105, 105],
  fuchsia: [255, 0, 255],
  gold: [255, 215, 0],
  goldenrod: [218, 165, 32],
  greenyellow: [173, 255, 47],
  indigo: [75, 0, 130],
  lightblue: [173, 216, 230],
  lightcyan: [224, 255, 255],
  lightgreen: [144, 238, 144],
  lightpink: [255, 182, 193],
  lightsteelblue: [176, 196, 222],
  lime: [191, 255, 0],
  limegreen: [50, 205, 50],
  maroon: [128, 0, 0],
  navy: [0, 0, 128],
  olive: [128, 128, 0],
  orchid: [218, 112, 214],
  pink: [255, 192, 203],
  plum: [221, 160, 221],
  rebeccapurple: [102, 51, 153],
  salmon: [250, 128, 114],
  silver: [192, 192, 192],
  skyblue: [97, 255, 224],
  springgreen: [189, 255, 61],
  turquoise: [64, 224, 208],
  yellowgreen: [154, 205, 50]
};

const XCOLOR_NATURAL_COLOR_SPECS = {
  red: { model: "rgb", channels: [1, 0, 0] },
  green: { model: "rgb", channels: [0, 1, 0] },
  blue: { model: "rgb", channels: [0, 0, 1] },
  brown: { model: "rgb", channels: [0.75, 0.5, 0.25] },
  lime: { model: "rgb", channels: [0.75, 1, 0] },
  orange: { model: "rgb", channels: [1, 0.5, 0] },
  pink: { model: "rgb", channels: [1, 0.75, 0.75] },
  purple: { model: "rgb", channels: [0.75, 0, 0.25] },
  teal: { model: "rgb", channels: [0, 0.5, 0.5] },
  violet: { model: "rgb", channels: [0.5, 0, 0.5] },
  // color.sty defines these four defaults in CMYK. xcolor preserves that
  // natural model until a document explicitly selects another target model,
  // so `cyan!50!black` mixes the CMYK channels before the SVG conversion.
  cyan: { model: "cmyk", channels: [1, 0, 0, 0] },
  magenta: { model: "cmyk", channels: [0, 1, 0, 0] },
  yellow: { model: "cmyk", channels: [0, 0, 1, 0] },
  olive: { model: "cmyk", channels: [0, 0, 1, 0.5] },
  black: { model: "gray", channels: [0] },
  darkgray: { model: "gray", channels: [0.25] },
  gray: { model: "gray", channels: [0.5] },
  grey: { model: "gray", channels: [0.5] },
  lightgray: { model: "gray", channels: [0.75] },
  white: { model: "gray", channels: [1] }
};

const TEX_NAMED_COLOR_RGB = {
  Blue: [46, 49, 146],
  WildStrawberry: [237, 20, 102],
  Green: [0, 166, 80],
  Sepia: [95, 22, 9],
  Red: [237, 28, 36],
  LimeGreen: [128, 204, 40]
};

export function colorToRgb(value) {
  const spec = colorToSpec(value);
  if (!spec) return null;
  return colorSpecToRgb(spec).map((channel) => Math.round(channel * 255));
}

function colorToSpec(value) {
  const text = String(value).trim().toLowerCase();
  const natural = xcolorNaturalColorSpec(text);
  if (natural) return natural;
  if (BASIC_COLOR_RGB[text]) {
    return { model: "rgb", channels: BASIC_COLOR_RGB[text].map((channel) => channel / 255) };
  }
  const rgbSpace = text.match(/^rgb\((\d+)\s+(\d+)\s+(\d+)\)$/);
  if (rgbSpace) return { model: "rgb", channels: rgbSpace.slice(1).map(Number).map((channel) => channel / 255) };
  const rgbComma = text.match(/^rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)$/);
  if (rgbComma) return { model: "rgb", channels: rgbComma.slice(1).map(Number).map((channel) => channel / 255) };
  const hex = text.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    return {
      model: "rgb",
      channels: [hex[1].slice(0, 2), hex[1].slice(2, 4), hex[1].slice(4, 6)]
        .map((part) => Number.parseInt(part, 16) / 255)
    };
  }
  return null;
}

function xcolorNaturalColorSpec(name) {
  const spec = XCOLOR_NATURAL_COLOR_SPECS[name];
  return spec ? { model: spec.model, channels: [...spec.channels] } : null;
}

function mixChannels(base, target, amount) {
  const clamped = Math.max(0, Math.min(1, amount));
  return base.map((channel, index) => channel * clamped + target[index] * (1 - clamped));
}

function convertColorSpec(spec, targetModel) {
  if (spec.model === targetModel) return { model: targetModel, channels: [...spec.channels] };
  const rgb = xcolorSpecToRgb(spec);
  if (targetModel === "rgb") return { model: "rgb", channels: rgb };
  if (targetModel === "gray") {
    return { model: "gray", channels: [0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2]] };
  }
  const cmy = rgb.map((channel) => 1 - channel);
  const k = Math.min(...cmy);
  return { model: "cmyk", channels: [...cmy.map((channel) => channel - k), k] };
}

function xcolorSpecToRgb(spec) {
  if (spec.model === "rgb") return [...spec.channels];
  if (spec.model === "gray") return [spec.channels[0], spec.channels[0], spec.channels[0]];
  const [c, m, y, k] = spec.channels;
  return [c, m, y].map((channel) => 1 - Math.min(1, channel + k));
}

function colorSpecToRgb(spec) {
  if (spec.model === "cmyk") return cmykToRgb(spec.channels);
  return xcolorSpecToRgb(spec);
}

function colorSpecToCss(spec) {
  return rgbToCss(colorSpecToRgb(spec).map((channel) => channel * 255));
}

// pdf2svg uses Poppler's DeviceCMYK matrix. Matching it keeps browser SVG
// colors aligned with the local tikztosvg reference rather than a naive mix.
export function cmykToRgb(channels) {
  const [c, m, y, k] = channels.map((channel) => Math.max(0, Math.min(1, Number(channel) || 0)));
  const c1 = 1 - c;
  const m1 = 1 - m;
  const y1 = 1 - y;
  const k1 = 1 - k;
  let r = c1 * m1 * y1 * k1;
  let g = r;
  let b = r;
  let x = c1 * m1 * y1 * k;
  r += 0.1373 * x; g += 0.1216 * x; b += 0.1255 * x;
  x = c1 * m1 * y * k1;
  r += x; g += 0.949 * x;
  x = c1 * m1 * y * k;
  r += 0.1098 * x; g += 0.102 * x;
  x = c1 * m * y1 * k1;
  r += 0.9255 * x; b += 0.549 * x;
  x = c1 * m * y1 * k;
  r += 0.1412 * x;
  x = c1 * m * y * k1;
  r += 0.9294 * x; g += 0.1098 * x; b += 0.1412 * x;
  x = c1 * m * y * k;
  r += 0.1333 * x;
  x = c * m1 * y1 * k1;
  g += 0.6784 * x; b += 0.9373 * x;
  x = c * m1 * y1 * k;
  g += 0.0588 * x; b += 0.1412 * x;
  x = c * m1 * y * k1;
  g += 0.651 * x; b += 0.3137 * x;
  x = c * m1 * y * k;
  g += 0.0745 * x;
  x = c * m * y1 * k1;
  r += 0.1804 * x; g += 0.1922 * x; b += 0.5725 * x;
  x = c * m * y1 * k;
  b += 0.0078 * x;
  x = c * m * y * k1;
  r += 0.2118 * x; g += 0.2119 * x; b += 0.2235 * x;
  return [r, g, b].map((channel) => Math.max(0, Math.min(1, channel)));
}

export function cmykToCss(channels) {
  return rgbToCss(cmykToRgb(channels).map((channel) => channel * 255));
}

function rgbToCss(rgb) {
  return `rgb(${rgb.map((channel) => Math.max(0, Math.min(255, Math.round(channel)))).join(" ")})`;
}

export function stripOuterBraces(value) {
  const text = String(value).trim();
  if (text.startsWith("{") && text.endsWith("}") && outerBracesWrapWholeText(text)) {
    return text.slice(1, -1).trim();
  }
  return text;
}

function outerBracesWrapWholeText(text) {
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0 && index < text.length - 1) return false;
    }
    if (depth < 0) return false;
  }
  return depth === 0;
}

function defaultStyleForCommand(command) {
  if (command === "node") {
    return { stroke: "none", fill: "none", lineWidth: TIKZ_LINE_WIDTHS.default };
  }
  if (command === "fill") {
    return { stroke: "none", fill: "black", lineWidth: TIKZ_LINE_WIDTHS.default };
  }
  if (command === "filldraw") {
    return { stroke: "black", fill: "black", lineWidth: TIKZ_LINE_WIDTHS.default };
  }
  if (command === "shade") {
    return { stroke: "none", fill: "black", lineWidth: TIKZ_LINE_WIDTHS.default };
  }
  if (command === "path") {
    return { stroke: "none", fill: "none", lineWidth: TIKZ_LINE_WIDTHS.default };
  }
  return { stroke: "black", fill: "none", lineWidth: TIKZ_LINE_WIDTHS.default };
}

function expandStyleOptions(rawOptions, env) {
  let expanded = {};
  for (const [key, value] of Object.entries(rawOptions || {})) {
    if (env.styles[key]) {
      const styleOptions = instantiateStyleOptions(env.styles[key], value);
      expanded = mergeOptionOrder(expanded, expandStyleOptions(styleOptions, env));
    } else {
      setOrderedOption(expanded, key, value);
    }
  }
  return expanded;
}

function instantiateStyleOptions(styleDefinition, value) {
  if (!styleDefinition?.__tikzStyleArgsPattern) {
    return value === true ? styleDefinition : substituteStyleArguments(styleDefinition, [value]);
  }
  const rawArgument = value === true || value === "" ? styleDefinition.__tikzStyleDefault || "" : String(value);
  const args = matchStyleArguments(styleDefinition.__tikzStyleArgsPattern, rawArgument);
  return substituteStyleArguments(styleDefinition.__tikzStyleOptions || {}, args);
}

function matchStyleArguments(pattern, rawArgument) {
  const tokens = [];
  const regexText = String(pattern || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/#(\d+)/g, (_match, index) => {
    tokens.push(Number(index));
    return "([\\s\\S]*?)";
  });
  const match = String(rawArgument || "").match(new RegExp(`^${regexText}$`));
  if (!match) return [rawArgument];
  const args = [];
  tokens.forEach((index, offset) => {
    args[index - 1] = match[offset + 1];
  });
  return args;
}

function substituteStyleArguments(styleOptions, args = []) {
  const substituted = {};
  for (const [key, value] of Object.entries(styleOptions || {})) {
    if (key.startsWith("__tikzStyle")) continue;
    const nextKey = substituteStyleArgumentText(key, args);
    const nextValue = Array.isArray(value)
      ? value.map((entry) => (typeof entry === "string" ? substituteStyleArgumentText(entry, args) : entry))
      : typeof value === "string"
        ? substituteStyleArgumentText(value, args)
        : value;
    substituted[nextKey] = nextValue;
  }
  return substituted;
}

function substituteStyleArgumentText(value, args = []) {
  return String(value).replace(/#(\d+)/g, (_match, index) => {
    const arg = args[Number(index) - 1];
    return arg === undefined || arg === true ? "" : String(arg);
  });
}

function mergeOptionOrder(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    setOrderedOption(target, key, value);
  }
  return target;
}

function setOrderedOption(options, key, value) {
  if (isRepeatableOption(key) && Object.hasOwn(options, key)) {
    options[key] = [...optionValues(options[key]), ...optionValues(value)];
    return;
  }
  if (key === "nodes" && Object.hasOwn(options, key) && options[key] !== true && value !== true) {
    const previous = options[key];
    delete options[key];
    options[key] = `${previous},${value}`;
    return;
  }
  if (Object.hasOwn(options, key)) delete options[key];
  options[key] = value;
}

function isRepeatableOption(key) {
  return (
    key === "label" ||
    key === "pin" ||
    key === "general shadow" ||
    key === "evaluate" ||
    key === "declare function" ||
    key === "label in data" ||
    key === "pin in data" ||
    key === "legend style" ||
    key === "axis line style" ||
    key === "x axis line style" ||
    key === "y axis line style" ||
    key === "z axis line style" ||
    key === "inner axis line style" ||
    key === "outer axis line style" ||
    key === "start chain" ||
    key === "continue chain" ||
    key === "start branch" ||
    key === "continue branch" ||
    key === "join" ||
    key === "postaction" ||
    key === "if" ||
    key === "name intersections" ||
    key === "mark" ||
    key === "rectangle split empty part width" ||
    key === "rectangle split empty part height" ||
    key === "rectangle split empty part depth"
  );
}

function parseStyleLength(value, lineWidth, variables = {}) {
  const text = String(value ?? "").trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  const pgfLineWidth = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)?)\s*(?:\\the\s*)?\\pgflinewidth$/);
  if (pgfLineWidth) {
    const coefficientText = pgfLineWidth[1];
    const coefficient = coefficientText === "" || coefficientText === "+"
      ? 1
      : coefficientText === "-"
        ? -1
        : Number(coefficientText);
    return (Number.isFinite(coefficient) ? coefficient : 1) * lineWidth;
  }
  return parseDimension(text, variables) * TIKZ_UNIT;
}

function optionValues(value) {
  return Array.isArray(value) ? value : [value];
}
