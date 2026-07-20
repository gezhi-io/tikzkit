import { parseOptions } from "../engine/options.js";
import { fontScaleFromTikzFont } from "../tikz/text.js";
import {
  estimateFormulaBox,
  formulaTotalHeight,
  hasMatrixEnvironmentTex,
  measurePlainTextTeXBoxPt,
  parseMathText
} from "../tikz/textMetrics.js";
import { formatAxisPoint, joinOptions } from "./format.js";
import { pgfplotsRoleFontCommand } from "./fonts.js";
import { renderPlotMark, shouldRenderPlotMarks } from "./marks.js";
import { selectPlotStyle } from "./plotStyle.js";

const TEX_PT_PER_CM = 28.45274;
const PGFPLOTS_LEGEND_OUTER_XSEP = 3 / TEX_PT_PER_CM;
const PGFPLOTS_LEGEND_OUTER_YSEP = 2 / TEX_PT_PER_CM;
const PGFPLOTS_LEGEND_CELL_INNER_SEP = 2 / TEX_PT_PER_CM;
const PGFPLOTS_LEGEND_IMAGE_WIDTH = 0.6;
const PGFPLOTS_LEGEND_TEXT_GAP = 4 / TEX_PT_PER_CM;
const PGFPLOTS_PLAIN_LEGEND_IMAGE_LEFT = 3.2 / TEX_PT_PER_CM;
const PGFPLOTS_PLAIN_LEGEND_TEXT_GAP = 2.2 / TEX_PT_PER_CM;
const PGFPLOTS_PLAIN_LEGEND_TEXT_RIGHT = 5 / TEX_PT_PER_CM;
const PGFPLOTS_PLAIN_LEGEND_OUTER_YSEP = 2 / TEX_PT_PER_CM;
const PGFPLOTS_PLAIN_LEGEND_ROW_HEIGHT = 12.4 / TEX_PT_PER_CM;

export function parseLegendEntries(body) {
  body = expandLegendForeach(body);
  const entries = [];
  let index = 0;
  while (index < body.length) {
    const start = body.indexOf("\\addlegendentry", index);
    if (start === -1) break;
    const command = readCommandName(body, start + 1);
    if (!command || !["addlegendentry", "addlegendentryexpanded"].includes(command.value)) {
      index = start + "\\addlegendentry".length;
      continue;
    }
    let cursor = skipWhitespace(body, command.end);
    const optional = cursor < body.length && body[cursor] === "[" ? extractBalanced(body, cursor, "[", "]") : null;
    if (optional) cursor = skipWhitespace(body, optional.end);
    const entry = extractBalanced(body, cursor, "{", "}");
    if (!entry) {
      index = command.end;
      continue;
    }
    entries.push(entry.content.trim());
    index = entry.end;
  }
  index = 0;
  while (index < body.length) {
    const start = body.indexOf("\\legend", index);
    if (start === -1) break;
    let cursor = skipWhitespace(body, start + "\\legend".length);
    const list = extractBalanced(body, cursor, "{", "}");
    if (!list) break;
    for (const entry of splitLegendEntries(list.content)) {
      const trimmed = stripBalancedOuterBraces(entry).trim();
      if (trimmed) entries.push(trimmed);
    }
    index = list.end;
  }
  return entries;
}

function expandLegendForeach(source) {
  const text = String(source || "");
  let output = "";
  let index = 0;
  while (index < text.length) {
    if (!text.startsWith("\\foreach", index) || !isCommandBoundary(text, index + "\\foreach".length)) {
      output += text[index] || "";
      index += 1;
      continue;
    }
    const parsed = parseSimpleForeach(text, index);
    if (!parsed || !/\\addlegendentry(?:expanded)?\b/.test(parsed.body)) {
      output += text[index] || "";
      index += 1;
      continue;
    }
    output += parsed.values.map((value) => replaceForeachVariable(parsed.body, parsed.variable, value)).join("\n");
    index = parsed.end;
  }
  return output;
}

export function renderLegendEntries(axisOptions, _ranges, geometry, bodyEntries = [], addplots = []) {
  const raw = axisOptions["legend entries"];
  const entries = raw ? splitLegendEntries(raw) : bodyEntries;
  if (!entries.length) return [];
  const font = legendFontOption(axisOptions);
  const fontScale = fontScaleFromTikzFont(font);
  const placement = legendPlacement(axisOptions["legend pos"], geometry, axisOptions["legend style"]);
  const mathLegend = entries.every((entry) => Boolean(parseMathText(entry)));
  const compactMathLegend = mathLegend && entries.every(isCompactMathLegendEntry);
  const rowHeights = mathLegend
    ? entries.map((entry) => nativeMathLegendRowHeight(entry, fontScale, { compact: compactMathLegend }))
    : entries.map(() => Math.max(0.19, PGFPLOTS_PLAIN_LEGEND_ROW_HEIGHT * fontScale));
  const imageWidth = mathLegend ? PGFPLOTS_LEGEND_IMAGE_WIDTH : Math.max(0.28, 0.42 * fontScale / 0.7);
  const columnCount = legendColumnCount(axisOptions, entries.length);
  const rowCount = Math.ceil(entries.length / columnCount);
  const columnWidths = Array.from({ length: columnCount }, (_unused, column) => Math.max(
    ...entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ index }) => index % columnCount === column)
      .map(({ entry }) => mathLegend
        ? mathLegendBoxWidth([entry], fontScale, imageWidth, { compact: compactMathLegend })
        : plainLegendBoxWidth([entry], fontScale, imageWidth))
  ));
  const legendRowHeights = Array.from({ length: rowCount }, (_unused, row) => Math.max(
    ...rowHeights.slice(row * columnCount, Math.min(entries.length, (row + 1) * columnCount))
  ));
  const boxWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const boxHeight = mathLegend
    ? PGFPLOTS_LEGEND_OUTER_YSEP * 2 + legendRowHeights.reduce((sum, height) => sum + height, 0)
    : Math.max(0.28, PGFPLOTS_PLAIN_LEGEND_OUTER_YSEP * 2 + legendRowHeights.reduce((sum, height) => sum + height, 0));
  const box = legendBoxFromAnchor(placement.point, placement.anchor, boxWidth, boxHeight);
  const cellAnchor = legendCellAnchor(axisOptions);
  const boxStyle = legendBoxStyleOption(axisOptions);
  const commands = [
    `\\draw[${boxStyle}] ${formatAxisPoint({ x: box.left, y: box.top })} -- ${formatAxisPoint({
      x: box.right,
      y: box.top
    })} -- ${formatAxisPoint({ x: box.right, y: box.bottom })} -- ${formatAxisPoint({ x: box.left, y: box.bottom })} -- cycle;`
  ];
  entries.forEach((entry, index) => {
    const row = Math.floor(index / columnCount);
    const column = index % columnCount;
    const rowTop = box.top - (mathLegend ? PGFPLOTS_LEGEND_OUTER_YSEP : PGFPLOTS_PLAIN_LEGEND_OUTER_YSEP)
      - legendRowHeights.slice(0, row).reduce((sum, height) => sum + height, 0);
    const y = rowTop - legendRowHeights[row] / 2;
    const cellLeft = box.left + columnWidths.slice(0, column).reduce((sum, width) => sum + width, 0);
    const cellRight = cellLeft + columnWidths[column];
    const x0 = cellLeft + (mathLegend ? PGFPLOTS_LEGEND_OUTER_XSEP : PGFPLOTS_PLAIN_LEGEND_IMAGE_LEFT);
    const x1 = x0 + imageWidth;
    const textX = x1 + (mathLegend ? PGFPLOTS_LEGEND_TEXT_GAP : PGFPLOTS_PLAIN_LEGEND_TEXT_GAP);
    const textRight = cellRight - (mathLegend ? PGFPLOTS_LEGEND_OUTER_XSEP + PGFPLOTS_LEGEND_CELL_INNER_SEP : PGFPLOTS_PLAIN_LEGEND_TEXT_RIGHT);
    const labelX = legendCellAnchorX(textX, textRight, cellAnchor);
    const plot = addplots[index];
    const imageStyle = joinOptions(["axis legend image", selectPlotStyle(plot?.options || {}, index), axisOptions.thick ? "thick" : ""]);
    commands.push(`\\draw[${imageStyle}] ${formatAxisPoint({ x: x0, y })} -- ${formatAxisPoint({ x: x1, y })};`);
    if (shouldRenderPlotMarks(plot?.options || {})) {
      commands.push(renderPlotMark({ x: (x0 + x1) / 2, y }, plot.options, index));
    }
    commands.push(`\\node[axis legend, anchor=${cellAnchor}, ${font}] at ${formatAxisPoint({ x: labelX, y })} {${entry.trim()}};`);
  });
  return commands;
}

function legendColumnCount(axisOptions = {}, entryCount = 0) {
  const style = parseOptions(String(axisOptions["legend style"] || ""));
  const raw = style["legend columns"] ?? axisOptions["legend columns"];
  const requested = Number(raw);
  if (requested === -1) return Math.max(1, entryCount);
  if (Number.isInteger(requested) && requested > 0) return Math.min(requested, Math.max(1, entryCount));
  return 1;
}

function legendCellAnchor(axisOptions = {}) {
  const explicit = stripBalancedOuterBraces(String(axisOptions["legend cell align"] || "")).trim().toLowerCase();
  if (explicit === "left") return "west";
  if (explicit === "right") return "east";
  if (explicit === "center") return "center";

  const legendStyle = parseOptions(axisOptions["legend style"] || "");
  const cells = parseOptions(stripBalancedOuterBraces(String(legendStyle.cells || "")));
  const anchor = stripBalancedOuterBraces(String(cells.anchor || "")).trim().toLowerCase();
  return ["west", "east", "center"].includes(anchor) ? anchor : "center";
}

function legendCellAnchorX(left, right, anchor) {
  if (anchor === "west") return left;
  if (anchor === "east") return right;
  return (left + right) / 2;
}

function nativeMathLegendRowHeight(entry, fontScale, options = {}) {
  if (options.compact) return (9.769 * fontScale) / TEX_PT_PER_CM;
  const parsed = parseMathText(entry);
  if (parsed && hasMatrixEnvironmentTex(parsed.tex)) {
    const formula = estimateFormulaBox(parsed.tex, {
      displayMode: parsed.displayMode,
      scale: fontScale,
      texTextMetrics: true,
      minWidth: 0,
      widthPadding: 0
    });
    // A PGFPlots legend is a TikZ matrix. Its row is therefore expanded by
    // the actual formula box instead of the surrounding font's baseline skip.
    // The small clearance matches TeX's matrix strut for two-row inline arrays.
    return formulaTotalHeight(formula) + 0.6 / TEX_PT_PER_CM;
  }
  const textHeightPt = /\\(?:d?frac|tfrac)\b/.test(parsed?.tex || "") ? 9.9484 : 9;
  return (4 + textHeightPt * fontScale) / TEX_PT_PER_CM;
}

function mathLegendBoxWidth(entries, fontScale, imageWidth, options = {}) {
  const matrixCellAllowance = entries.some((entry) => {
    const parsed = parseMathText(entry);
    return parsed && hasMatrixEnvironmentTex(parsed.tex);
  }) ? 9.5 / TEX_PT_PER_CM : 0;
  const textWidth = Math.max(
    ...entries.map((entry) => {
      const parsed = parseMathText(entry);
      if (!parsed) return estimateLegendEntryWidth(entry, fontScale);
      return estimateFormulaBox(parsed.tex, {
        displayMode: parsed.displayMode,
        scale: fontScale,
        texTextMetrics: true,
        minWidth: 0,
        widthPadding: (options.compact ? 0 : 0.28) * fontScale
      }).width;
    })
  );
  return (
    PGFPLOTS_LEGEND_OUTER_XSEP * 2 +
    imageWidth +
    PGFPLOTS_LEGEND_TEXT_GAP +
    textWidth +
    (options.compact ? 0 : PGFPLOTS_LEGEND_CELL_INNER_SEP) +
    matrixCellAllowance
  );
}

function isCompactMathLegendEntry(entry) {
  const parsed = parseMathText(entry);
  if (!parsed || parsed.displayMode) return false;
  const tex = String(parsed.tex || "").replace(/\s+/g, " ").trim();
  return /^(?:\\(?:sin|cos|tan|cot|sec|csc|log|ln|exp)\s*)?[A-Za-z]+$/.test(tex);
}

function plainLegendBoxWidth(entries, fontScale, imageWidth) {
  const textWidth = Math.max(...entries.map((entry) => estimateLegendEntryWidth(entry, fontScale)));
  return (
    PGFPLOTS_PLAIN_LEGEND_IMAGE_LEFT +
    imageWidth +
    PGFPLOTS_PLAIN_LEGEND_TEXT_GAP +
    textWidth +
    PGFPLOTS_PLAIN_LEGEND_TEXT_RIGHT
  );
}

export function legendFontOption(axisOptions = {}) {
  const style = parseOptions(axisOptions["legend style"] || "");
  const explicit = style.font || axisOptions["legend font"] || "";
  const font = pgfplotsRoleFontCommand("legend", axisOptions, explicit);
  return `font=${font}`;
}

function legendBoxStyleOption(axisOptions = {}) {
  const style = parseOptions(axisOptions["legend style"] || "");
  return joinOptions([
    "axis legend box",
    `draw=${style.draw ?? "black"}`,
    `fill=${style.fill ?? "white"}`,
    `line width=${style["line width"] ?? "0.4pt"}`,
    style["rounded corners"] !== undefined ? `rounded corners=${style["rounded corners"]}` : "",
    style.opacity !== undefined ? `opacity=${style.opacity}` : "",
    style["draw opacity"] !== undefined ? `draw opacity=${style["draw opacity"]}` : "",
    style["fill opacity"] !== undefined ? `fill opacity=${style["fill opacity"]}` : ""
  ]);
}

export function legendPlacement(rawPosition, geometry, rawStyle = "") {
  const value = String(rawPosition || "north east").trim().toLowerCase();
  const presets = {
    "south west": { x: 0.03, y: 0.03, anchor: "south west" },
    "south east": { x: 0.97, y: 0.03, anchor: "south east" },
    "north west": { x: 0.03, y: 0.97, anchor: "north west" },
    "north east": { x: 0.97, y: 0.97, anchor: "north east" },
    "outer north east": { x: 1.03, y: 1, anchor: "north west" },
    "south east outside": { x: 1.03, y: 0.03, anchor: "south west" }
  };
  const preset = presets[value] || presets["north east"];
  const style = parseOptions(String(rawStyle || ""));
  const customAt = parseLegendAt(style.at);
  if (customAt) {
    const point = typeof geometry.mapAxisDescriptionPoint === "function"
      ? geometry.mapAxisDescriptionPoint(customAt)
      : {
          x: geometry.origin.x + geometry.width * customAt.x,
          y: geometry.origin.y + geometry.height * customAt.y
        };
    return {
      anchor: String(style.anchor || preset.anchor).trim().toLowerCase(),
      point
    };
  }
  const point = typeof geometry.mapAxisDescriptionPoint === "function"
    ? geometry.mapAxisDescriptionPoint({ x: preset.x, y: preset.y })
    : {
        x: geometry.origin.x + geometry.width * preset.x,
        y: geometry.origin.y + geometry.height * preset.y
      };
  return {
    anchor: String(style.anchor || preset.anchor).trim().toLowerCase(),
    point
  };
}

export function legendBoxFromAnchor(point, anchor, width, height) {
  const normalized = String(anchor || "center").toLowerCase();
  const horizontal = normalized.includes("east") ? "east" : normalized.includes("west") ? "west" : "center";
  const vertical = normalized.includes("south") ? "south" : normalized.includes("north") ? "north" : "center";
  const left = horizontal === "east" ? point.x - width : horizontal === "west" ? point.x : point.x - width / 2;
  const right = left + width;
  const bottom = vertical === "north" ? point.y - height : vertical === "south" ? point.y : point.y - height / 2;
  const top = bottom + height;
  return { left, right, top, bottom };
}

function parseLegendAt(raw) {
  const text = String(raw || "").trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  const match = text.match(/^(?:axis description cs\s*:\s*)?\(\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\)$/i);
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

export function estimateLegendEntryWidth(entry, fontScale = 0.7) {
  const text = stripTexForLength(entry);
  const containsMath = /[$\\_^]/.test(String(entry || ""));
  if (!containsMath) {
    const measured = measurePlainTextTeXBoxPt(text, { fontSizePt: 10 * fontScale });
    return Math.max(0.28, measured ? measured.width / TEX_PT_PER_CM : estimatePlainLegendTextWidth(text, fontScale));
  }
  const glyphWidth = 0.1;
  return Math.max(0.28, text.length * glyphWidth * (fontScale / 0.7));
}

function estimatePlainLegendTextWidth(text, fontScale = 1) {
  const normalSizeEmCm = 10 / 28.45274;
  let emUnits = 0;
  for (const char of String(text || "")) {
    emUnits += plainLegendGlyphWidthEm(char);
  }
  return emUnits * normalSizeEmCm * fontScale;
}

function plainLegendGlyphWidthEm(char) {
  if (char === " ") return 0.333;
  if (/[0-9]/.test(char)) return 0.5;
  if (/[A-Z]/.test(char)) return 0.58;
  if (/[a-z]/.test(char)) return 0.5;
  if (char === "." || char === "," || char === "/" || char === ":") return 0.278;
  if (char === "-" || char === "+") return 0.333;
  return 0.5;
}

export function splitLegendEntries(raw) {
  const entries = [];
  let start = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;
  const text = String(raw || "").trim().replace(/^\{([\s\S]*)\}$/, "$1");
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
    else if (char === "[") bracketDepth += 1;
    else if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === "(") parenDepth += 1;
    else if (char === ")") parenDepth = Math.max(0, parenDepth - 1);
    else if (char === "," && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
      entries.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  entries.push(text.slice(start).trim());
  return entries.filter(Boolean);
}

export function stripTexForLength(value) {
  return normalizeTexCommandsForLength(value)
    .replace(/[{}$]/g, "")
    .trim();
}

function normalizeTexCommandsForLength(value) {
  const aliases = {
    alpha: "a",
    beta: "b",
    gamma: "g",
    delta: "d",
    epsilon: "e",
    varepsilon: "e",
    theta: "t",
    vartheta: "t",
    lambda: "l",
    mu: "m",
    pi: "p",
    rho: "r",
    sigma: "s",
    tau: "t",
    varphi: "f",
    phi: "f",
    omega: "w",
    sin: "sin",
    cos: "cos",
    tan: "tan",
    tanh: "tanh",
    sinh: "sinh",
    cosh: "cosh",
    exp: "exp",
    log: "log",
    ln: "ln",
    max: "max",
    min: "min",
    lim: "lim",
    sup: "sup",
    inf: "inf",
    det: "det",
    frac: "/",
    sqrt: "sqrt",
    left: "",
    right: "",
    color: "",
    textcolor: "",
    mathcolor: "",
    text: "",
    textrm: "",
    textsf: "",
    texttt: "",
    mathrm: "",
    mathsf: "",
    mathtt: "",
    mathbf: "",
    mathit: "",
    bf: "",
    it: "",
    em: ""
  };
  return String(value || "")
    .replace(/\\[,;:! ]/g, "")
    .replace(/\\([a-zA-Z]+)\s*/g, (_match, name) => (Object.hasOwn(aliases, name) ? aliases[name] : ""));
}

function skipWhitespace(text, index) {
  let cursor = index;
  while (cursor < text.length && /\s/.test(text[cursor])) cursor += 1;
  return cursor;
}

function parseSimpleForeach(source, start) {
  let cursor = skipWhitespace(source, start + "\\foreach".length);
  if (source[cursor] !== "\\") return null;
  const variable = readCommandName(source, cursor + 1);
  if (!variable?.value) return null;
  cursor = skipWhitespace(source, variable.end);
  if (!source.startsWith("in", cursor) || !isCommandBoundary(source, cursor + "in".length)) return null;
  cursor = skipWhitespace(source, cursor + "in".length);
  const values = extractBalanced(source, cursor, "{", "}");
  if (!values) return null;
  cursor = skipWhitespace(source, values.end);
  const body = extractBalanced(source, cursor, "{", "}");
  if (!body) return null;
  return {
    variable: variable.value,
    values: expandForeachValues(values.content),
    body: body.content,
    end: body.end
  };
}

function expandForeachValues(raw) {
  return String(raw || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function replaceForeachVariable(body, variable, value) {
  return String(body || "").replace(new RegExp(`\\\\${escapeRegExp(variable)}(?![A-Za-z@])`, "g"), String(value));
}

function readCommandName(source, start) {
  const match = String(source || "").slice(start).match(/^[A-Za-z@]+/);
  if (!match) return null;
  return { value: match[0], end: start + match[0].length };
}

function isCommandBoundary(source, index) {
  return !/[A-Za-z@]/.test(source[index] || "");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractBalanced(text, start, open, close) {
  if (text[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\\" && index + 1 < text.length) {
      index += 1;
      continue;
    }
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

function stripBalancedOuterBraces(raw) {
  const text = String(raw || "").trim();
  if (!text.startsWith("{") || !text.endsWith("}")) return text;
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0 && index < text.length - 1) return text;
    }
    if (depth < 0) return text;
  }
  return depth === 0 ? text.slice(1, -1).trim() : text;
}
