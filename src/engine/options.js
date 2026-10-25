import {
  TIKZ_DASH_PATTERN_STYLES,
  TIKZ_LINE_WIDTHS,
  createArrowTip,
  lineWidthFromTikzDimension
} from "../tikz/metrics.js";
import { parseDimension, substituteTextVariables } from "./math.js";
import { evaluateRestrictedExpression } from "./safe-expression.js";
import { isColorToken, normalizeColor } from "./colors.js";
export { normalizeColor, colorToRgb, cmykToRgb, cmykToCss } from "./colors.js";

const TIKZ_UNIT = 100;


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
  const expanded = substituteDynamicOptionValues(expandStyleOptions(rawOptions, env), env.variables || {});
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
      semantic["tikzkit current color"] = color;
      if (usesCurrentColorForFill) style.fill = color;
      continue;
    }
    if (key.includes("!")) {
      const color = normalizeColor(key);
      applyCurrentColor(style, color, command);
      currentColor = color;
      semantic["tikzkit current color"] = color;
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
      semantic["tikzkit current color"] = color;
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
    if (key === "miter limit") {
      const limit = evaluateRestrictedExpression(String(value), {}, { pgfTrig: true }).value;
      if (Number.isFinite(limit) && limit >= 1) style.miterLimit = limit;
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

  resolveToAliases(style, env);
  return { style, semantic, options: expanded };
}

function resolveToAliases(style, env = {}) {
  const resolve = tip => {
    if (tip?.kind === "sequence") return { ...tip, tips: tip.tips.map(resolve) };
    if (!tip?.toAlias) return tip;
    return { ...tip, legacy: !env.arrowMetaLoaded, meta: Boolean(env.arrowMetaLoaded) };
  };
  for (const key of ["markerStart", "markerEnd"]) if (style[key]) style[key] = resolve(style[key]);
  return style;
}

function substituteDynamicOptionValues(options, variables) {
  const substituted = {};
  for (const [key, value] of Object.entries(options || {})) {
    const nextKey = substituteTextVariables(key, variables);
    const nextValue = Array.isArray(value)
      ? value.map((entry) => typeof entry === "string" ? substituteTextVariables(entry, variables) : entry)
      : typeof value === "string"
        ? substituteTextVariables(value, variables)
        : value;
    setOrderedOption(substituted, nextKey, nextValue);
  }
  return substituted;
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

export function arrowTipsFromOptions(rawOptions = {}, env = {}) {
  const defaultArrowTip = parseDefaultArrowTip(rawOptions);
  const hints = {};
  for (const [key, value] of Object.entries(rawOptions || {})) {
    const arrowHints = parseArrowOption(key, value, defaultArrowTip);
    if (arrowHints) Object.assign(hints, arrowHints);
  }
  return resolveToAliases(hints, env);
}

export function edgeStyleHintsFromOptions(rawOptions = {}, env) {
  const { style, options } = normalizeOptions("draw", rawOptions, env);
  const hints = arrowTipsFromOptions(options, env);
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

export function optionSetsLineWidth(key) {
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
  return options[">"] ? parseArrowTipSpec(String(options[">"])) : createArrowTip("To");
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
  "to reversed",
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
  const match = text.match(/^([A-Za-z0-9><'()\s-]+)(?:\[([\s\S]*)\])?$/);
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
    tips.push(parseArrowTipAtom(name, { ...inheritedOptions, ...options }));
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
  // arrows.meta uses pgfmath for its scale keys, including per-point quiver
  // expressions. Use the same closed parser as other PGF expressions.
  const scale = evaluateRestrictedExpression(String(value ?? "1"), {}, { pgfTrig: true }).value;
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
    return normalizeDeclaredArrowPayload(decoded);
  } catch {
    return null;
  }
}

function normalizeDeclaredArrowPayload(decoded, depth = 0) {
  if (!decoded || typeof decoded !== "object" || depth > 12) return null;
  if (decoded.kind === "sequence") {
    if (!Array.isArray(decoded.tokens) || !decoded.tokens.length || decoded.tokens.length > 64) return null;
    const tokens = [];
    for (const token of decoded.tokens) {
      if (token?.lineEnd === true) {
        tokens.push({ lineEnd: true });
        continue;
      }
      const name = String(token?.name || "").trim();
      if (!name) return null;
      const separation = normalizeDeclaredArrowSeparation(token.separation);
      const declaration = token.declaration
        ? normalizeDeclaredArrowPayload(token.declaration, depth + 1)
        : null;
      if (token.declaration && !declaration) return null;
      tokens.push({ name, separation, ...(declaration ? { declaration } : {}) });
    }
    return { kind: "sequence", name: String(decoded.name || "declared sequence"), tokens };
  }

  if (typeof decoded.path !== "string" || !decoded.path || !decoded.bounds) return null;
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
    ...(decoded.hasExplicitHull === true ? { hasExplicitHull: true } : {}),
    ...(decoded.strokeBoundsIncluded === true ? { strokeBoundsIncluded: true } : {}),
    ...(decoded.reversed === true ? { reversed: true } : {}),
    ...(program ? { program } : {}),
    ...(lineCap ? { lineCap } : {}),
    ...(lineJoin ? { lineJoin } : {})
  };
}

function normalizeDeclaredArrowSeparation(value) {
  const dimension = Number(value?.dimension);
  const lineWidthFactor = Number(value?.lineWidthFactor);
  const outerFactor = Number(value?.outerFactor);
  return {
    dimension: Number.isFinite(dimension) ? dimension : 0,
    lineWidthFactor: Number.isFinite(lineWidthFactor) ? lineWidthFactor : 0,
    outerFactor: Number.isFinite(outerFactor) ? outerFactor : 0
  };
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

export function tikzBoolean(value) {
  if (value === undefined || value === null || value === false) return false;
  if (value === true || value === "") return true;
  return !/^(?:false|0|no|off)$/i.test(String(value).trim());
}
