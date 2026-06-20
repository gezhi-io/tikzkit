import { evaluateMath, parseDimension } from "./math.js";
import { parseOptions, splitTopLevel } from "./options.js";
import {
  TIKZ_AXIS_CONTAINER_MARGIN,
  TIKZ_HIDDEN_AXIS_CONTAINER_MARGIN,
  TIKZ_PGFPLOTS_MIDDLE_AXIS_STACK_GAP,
  TIKZ_PGFPLOTS_MIDDLE_AXIS_STACK_SHIFT
} from "./tikz-metrics.js";

const BUILTIN_MACROS = new Set(["draw", "path", "fill", "filldraw", "node", "coordinate", "foreach"]);

export function preprocessTikzSource(source, options = {}) {
  const diagnostics = [];
  let expanded = stripTexComments(String(source));
  const colorResult = collectColorDefinitions(expanded);
  expanded = replaceDefinedColorUses(colorResult.source, colorResult.colors);
  const macroResult = expandTexLiteMacros(expanded, diagnostics, options);
  expanded = macroResult.source;
  expanded = terminatePgfTransformStatements(expanded);
  expanded = expandTkzGraphMacros(expanded);
  expanded = expandTikzScopeEnvironments(expanded, diagnostics);
  expanded = expandTransparentEnvironment(expanded, "pgfonlayer", diagnostics);
  expanded = expandPgfplotsAxes(expanded, diagnostics, options);
  return { source: expanded, diagnostics };
}

function stripTexComments(source) {
  let output = "";
  let inComment = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inComment) {
      if (char === "\n" || char === "\r") {
        inComment = false;
        output += char;
      }
      continue;
    }
    if (char === "%" && source[index - 1] !== "\\") {
      inComment = true;
      continue;
    }
    output += char;
  }
  return output;
}

function collectColorDefinitions(source) {
  const colors = new Map();
  let output = "";
  let index = 0;
  while (index < source.length) {
    if (source.startsWith("\\definecolor", index)) {
      const parsed = parseDefineColor(source, index);
      if (parsed) {
        colors.set(parsed.name, parsed.css);
        index = parsed.end;
        continue;
      }
    }
    output += source[index];
    index += 1;
  }
  return { source: output, colors };
}

function parseDefineColor(source, start) {
  let index = start + "\\definecolor".length;
  index = skipWhitespace(source, index);
  const name = extractBalanced(source, index, "{", "}");
  if (!name) return null;
  index = skipWhitespace(source, name.end);
  const model = extractBalanced(source, index, "{", "}");
  if (!model) return null;
  index = skipWhitespace(source, model.end);
  const spec = extractBalanced(source, index, "{", "}");
  if (!spec) return null;
  const css = definedColorToCss(model.content, spec.content);
  if (!css) return null;
  return {
    name: name.content.trim(),
    css,
    end: spec.end
  };
}

function definedColorToCss(model, spec) {
  const rawModel = String(model).trim();
  const colorModel = rawModel.toLowerCase();
  const value = String(spec).trim();
  if (colorModel === "html") {
    const hex = value.replace(/^#/, "");
    return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex}` : null;
  }
  if (rawModel === "RGB") {
    const channels = splitTopLevel(value, ",").map((part) => Number(part.trim()));
    if (channels.length !== 3 || channels.some((channel) => !Number.isFinite(channel))) return null;
    return `rgb(${channels.map((channel) => Math.round(Math.max(0, Math.min(255, channel)))).join(" ")})`;
  }
  if (colorModel === "rgb") {
    const channels = splitTopLevel(value, ",").map((part) => Number(part.trim()));
    if (channels.length !== 3 || channels.some((channel) => !Number.isFinite(channel))) return null;
    return `rgb(${channels.map((channel) => Math.round(Math.max(0, Math.min(1, channel)) * 255)).join(" ")})`;
  }
  if (colorModel === "gray" || colorModel === "grey") {
    const channel = Number(value);
    if (!Number.isFinite(channel)) return null;
    const byte = Math.round(Math.max(0, Math.min(1, channel)) * 255);
    return `rgb(${byte} ${byte} ${byte})`;
  }
  return null;
}

function replaceDefinedColorUses(source, colors) {
  if (!colors.size) return source;
  let output = "";
  let index = 0;
  while (index < source.length) {
    if (source[index] === "[") {
      const options = extractBalanced(source, index, "[", "]");
      if (options) {
        output += `[${replaceColorNames(options.content, colors)}]`;
        index = options.end;
        continue;
      }
    }
    output += source[index];
    index += 1;
  }
  return output;
}

function replaceColorNames(input, colors) {
  let output = String(input);
  for (const [name, css] of colors.entries()) {
    const escaped = escapeRegExp(name);
    output = output.replace(new RegExp(`(^|[^A-Za-z0-9_-])${escaped}(?=$|[^A-Za-z0-9_-])`, "g"), `$1${css}`);
  }
  return output;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function terminatePgfTransformStatements(source) {
  return source
    .replace(/\\pgftransformreset(?!\s*;)/g, "\\pgftransformreset;")
    .replace(
      /(\\pgftransformcm\s*\{[^}]*\}\s*\{[^}]*\}\s*\{[^}]*\}\s*\{[^}]*\}\s*\{\\pgfpoint\s*\{[^}]*\}\s*\{[^}]*\}\})(?!\s*;)/g,
      "$1;"
    );
}

function expandTexLiteMacros(source, diagnostics, options) {
  const macros = new Map();
  let withoutDefinitions = collectMacroDefinitions(source, macros, diagnostics);
  const maxPasses = options.macroExpansionPasses || 12;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const next = expandMacroPass(withoutDefinitions, macros);
    if (next === withoutDefinitions) break;
    withoutDefinitions = next;
  }
  return { source: withoutDefinitions, macros };
}

function collectMacroDefinitions(source, macros, diagnostics) {
  let output = "";
  let index = 0;
  while (index < source.length) {
    if (source.startsWith("\\def\\", index)) {
      const parsed = parseDefMacro(source, index);
      if (parsed) {
        macros.set(parsed.name, parsed.macro);
        index = parsed.end;
        continue;
      }
    }
    if (source.startsWith("\\newcommand", index) || source.startsWith("\\renewcommand", index)) {
      const parsed = parseNewCommandMacro(source, index);
      if (parsed) {
        macros.set(parsed.name, parsed.macro);
        index = parsed.end;
        continue;
      }
    }
    if (source.startsWith("\\def\\", index) || source.startsWith("\\newcommand", index) || source.startsWith("\\renewcommand", index)) {
      diagnostics.push({ severity: "warning", message: `Could not parse TeX macro near offset ${index}` });
    }
    output += source[index];
    index += 1;
  }
  return output;
}

function parseDefMacro(source, start) {
  let index = start + "\\def\\".length;
  const name = readCommandName(source, index);
  if (!name || BUILTIN_MACROS.has(name.value)) return null;
  index = name.end;
  let argCount = 0;
  while (source[index] === "#") {
    const digit = Number(source[index + 1]);
    if (!Number.isInteger(digit) || digit <= 0) break;
    argCount = Math.max(argCount, digit);
    index += 2;
  }
  index = skipWhitespace(source, index);
  const body = extractBalanced(source, index, "{", "}");
  if (!body) return null;
  return {
    name: name.value,
    macro: { name: name.value, argCount, body: body.content },
    end: body.end
  };
}

function parseNewCommandMacro(source, start) {
  const command = source.startsWith("\\renewcommand", start) ? "\\renewcommand" : "\\newcommand";
  let index = start + command.length;
  index = skipWhitespace(source, index);
  let name = null;
  if (source[index] === "{") {
    const wrapped = extractBalanced(source, index, "{", "}");
    if (!wrapped) return null;
    name = wrapped.content.trim().replace(/^\\/, "");
    index = wrapped.end;
  } else if (source[index] === "\\") {
    const parsedName = readCommandName(source, index + 1);
    if (!parsedName) return null;
    name = parsedName.value;
    index = parsedName.end;
  }
  if (!name || BUILTIN_MACROS.has(name)) return null;
  index = skipWhitespace(source, index);
  let argCount = 0;
  const defaults = [];
  if (source[index] === "[") {
    const count = extractBalanced(source, index, "[", "]");
    if (!count) return null;
    argCount = Math.max(0, Number(count.content.trim()) || 0);
    index = skipWhitespace(source, count.end);
  }
  if (source[index] === "[") {
    const defaultArg = extractBalanced(source, index, "[", "]");
    if (defaultArg) {
      defaults[0] = defaultArg.content;
      index = skipWhitespace(source, defaultArg.end);
    }
  }
  const body = extractBalanced(source, index, "{", "}");
  if (!body) return null;
  return {
    name,
    macro: { name, argCount, defaults, body: body.content },
    end: body.end
  };
}

function expandMacroPass(source, macros) {
  let output = "";
  let index = 0;
  while (index < source.length) {
    if (source[index] !== "\\") {
      output += source[index];
      index += 1;
      continue;
    }
    const name = readCommandName(source, index + 1);
    if (!name || !macros.has(name.value)) {
      output += source[index];
      index += 1;
      continue;
    }
    const macro = macros.get(name.value);
    let cursor = name.end;
    const args = [];
    let canExpand = true;
    for (let argIndex = 0; argIndex < macro.argCount; argIndex += 1) {
      cursor = skipWhitespace(source, cursor);
      if (macro.defaults?.[argIndex] !== undefined) {
        if (source[cursor] === "[") {
          const optionalArg = extractBalanced(source, cursor, "[", "]");
          if (!optionalArg) {
            canExpand = false;
            break;
          }
          args.push(optionalArg.content);
          cursor = optionalArg.end;
        } else {
          args.push(macro.defaults[argIndex]);
        }
        continue;
      }
      const arg = extractBalanced(source, cursor, "{", "}");
      if (!arg) {
        canExpand = false;
        break;
      }
      args.push(arg.content);
      cursor = arg.end;
    }
    if (!canExpand) {
      output += source.slice(index, name.end);
      index = name.end;
      continue;
    }
    output += applyMacroBody(macro.body, args);
    index = cursor;
  }
  return output;
}

function applyMacroBody(body, args) {
  let output = body;
  args.forEach((arg, index) => {
    output = output.replaceAll(`#${index + 1}`, arg);
  });
  return output;
}

function expandTikzScopeEnvironments(source, diagnostics) {
  let output = "";
  let index = 0;
  const begin = "\\begin{scope}";
  const end = "\\end{scope}";
  while (index < source.length) {
    const beginIndex = source.indexOf(begin, index);
    if (beginIndex === -1) {
      output += source.slice(index);
      break;
    }
    output += source.slice(index, beginIndex);
    let cursor = beginIndex + begin.length;
    const scopeOptions = parseOptionalOptions(source, cursor);
    cursor = scopeOptions.end;
    const endIndex = findMatchingEnvironmentEnd(source, cursor, begin, end);
    if (endIndex === -1) {
      diagnostics.push({ severity: "warning", message: "Unclosed TikZ scope environment" });
      output += source.slice(beginIndex);
      break;
    }
    output += `{[${scopeOptions.raw}]${expandTikzScopeEnvironments(source.slice(cursor, endIndex), diagnostics)}}`;
    index = endIndex + end.length;
  }
  return output;
}

function findMatchingEnvironmentEnd(source, start, begin, end) {
  let depth = 1;
  let cursor = start;
  while (cursor < source.length) {
    const nextBegin = source.indexOf(begin, cursor);
    const nextEnd = source.indexOf(end, cursor);
    if (nextEnd === -1) return -1;
    if (nextBegin !== -1 && nextBegin < nextEnd) {
      depth += 1;
      cursor = nextBegin + begin.length;
      continue;
    }
    depth -= 1;
    if (depth === 0) return nextEnd;
    cursor = nextEnd + end.length;
  }
  return -1;
}

function expandTransparentEnvironment(source, name, diagnostics) {
  let output = "";
  let index = 0;
  const begin = `\\begin{${name}}`;
  const end = `\\end{${name}}`;
  while (index < source.length) {
    const beginIndex = source.indexOf(begin, index);
    if (beginIndex === -1) {
      output += source.slice(index);
      break;
    }
    output += source.slice(index, beginIndex);
    let cursor = beginIndex + begin.length;
    if (source[cursor] === "{") {
      const layerName = extractBalanced(source, cursor, "{", "}");
      if (layerName) cursor = layerName.end;
    }
    const endIndex = source.indexOf(end, cursor);
    if (endIndex === -1) {
      diagnostics.push({ severity: "warning", message: `Unclosed ${name} environment` });
      output += source.slice(beginIndex);
      break;
    }
    output += source.slice(cursor, endIndex);
    index = endIndex + end.length;
  }
  return output;
}

function expandTkzGraphMacros(source) {
  let unit = 2.5;
  const positions = new Map();
  return source
    .replace(/\\SetUpEdge\s*\[[\s\S]*?\]/g, "")
    .replace(/\\GraphInit\s*\[[^\]]*?\]/g, "")
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      const graphUnit = trimmed.match(/^\\SetGraphUnit\s*\{([^}]*)\}/);
      if (graphUnit) {
        unit = Number(graphUnit[1]) || unit;
        return "";
      }
      const vertex = trimmed.match(/^\\Vertex\s*\{([^}]*)\}/);
      if (vertex) {
        const name = vertex[1].trim();
        positions.set(name, { x: 0, y: 0 });
        return `\\node[draw,circle] (${name}) at (0,0) {${name}};`;
      }
      const relative = trimmed.match(/^\\(NOEA|SOEA|NOWE|SOWE|EA|WE|NO|SO)\s*\(([^)]*)\)\s*\{([^}]*)\}/);
      if (relative) {
        const direction = relative[1];
        const from = relative[2].trim();
        const name = relative[3].trim();
        const base = positions.get(from) || { x: 0, y: 0 };
        const offset = {
          EA: { x: unit, y: 0 },
          WE: { x: -unit, y: 0 },
          NO: { x: 0, y: unit },
          SO: { x: 0, y: -unit },
          NOEA: { x: unit, y: unit },
          SOEA: { x: unit, y: -unit },
          NOWE: { x: -unit, y: unit },
          SOWE: { x: -unit, y: -unit }
        }[direction];
        const point = { x: base.x + offset.x, y: base.y + offset.y };
        positions.set(name, point);
        return `\\node[draw,circle] (${name}) at (${point.x},${point.y}) {${name}};`;
      }
      const edge = trimmed.match(/^\\Edge(?:\[[^\]]*?\])?\s*\(([^)]*)\)\s*\(([^)]*)\)/);
      if (edge) {
        return `\\draw[->] (${edge[1].trim()}) -- (${edge[2].trim()});`;
      }
      return line;
    })
    .join("\n");
}

function expandPgfplotsAxes(source, diagnostics, options) {
  let output = "";
  let index = 0;
  let currentPictureStart = -1;
  let axisContext = createAxisContext();
  const begin = "\\begin{axis}";
  const end = "\\end{axis}";
  while (index < source.length) {
    const beginIndex = source.indexOf(begin, index);
    if (beginIndex === -1) {
      output += source.slice(index);
      break;
    }
    output += source.slice(index, beginIndex);
    const pictureStart = source.lastIndexOf("\\begin{tikzpicture}", beginIndex);
    if (pictureStart !== currentPictureStart) {
      currentPictureStart = pictureStart;
      axisContext = createAxisContext();
    }
    let cursor = beginIndex + begin.length;
    const axisOptions = parseOptionalOptions(source, cursor);
    cursor = axisOptions.end;
    const endIndex = source.indexOf(end, cursor);
    if (endIndex === -1) {
      diagnostics.push({ severity: "warning", message: "Unclosed pgfplots axis environment" });
      output += source.slice(beginIndex);
      break;
    }
    const body = source.slice(cursor, endIndex);
    output += renderAxisAsTikz({ ...findContainingTikzPictureOptions(source, beginIndex), ...parseOptions(axisOptions.raw) }, body, options, axisContext);
    index = endIndex + end.length;
  }
  return output;
}

function createAxisContext() {
  return { previousMiddleAxisBottom: null };
}

function findContainingTikzPictureOptions(source, offset) {
  const begin = "\\begin{tikzpicture}";
  const beginIndex = source.lastIndexOf(begin, offset);
  if (beginIndex === -1) return {};
  const endIndex = source.lastIndexOf("\\end{tikzpicture}", offset);
  if (endIndex > beginIndex) return {};
  const options = parseOptionalOptions(source, beginIndex + begin.length);
  return parseOptions(options.raw);
}

function renderAxisAsTikz(axisOptions, body, options, axisContext) {
  const addplots = parseAddplots(body);
  const legendEntries = parseLegendEntries(body);
  const ranges = computeAxisRanges(axisOptions, addplots);
  const geometry = createAxisGeometry(axisOptions, ranges);
  separateStackedMiddleAxis(axisOptions, geometry, axisContext);
  const commands = [renderAxisFrame(geometry)];
  if (axisOptions.grid || String(axisOptions.grid || "").includes("major")) {
    commands.push(...renderAxisGrid(ranges, geometry));
  }
  if (axisOptions["axis lines"] || axisOptions.axis) {
    commands.push(...renderAxisLines(axisOptions, ranges, geometry));
  }
  addplots.forEach((plot) => {
    commands.push(...renderAddplot(plot, axisOptions, ranges, geometry, options));
  });
  commands.push(...renderAxisLabels(axisOptions, ranges, geometry));
  commands.push(...renderLegendEntries(axisOptions, ranges, geometry, legendEntries));
  return `\n${commands.join("\n")}\n`;
}

function parseAddplots(body) {
  const plots = [];
  let index = 0;
  while (index < body.length) {
    const start = body.indexOf("\\addplot", index);
    if (start === -1) break;
    let cursor = start + "\\addplot".length;
    let is3d = false;
    if (body[cursor] === "3") {
      is3d = true;
      cursor += 1;
    }
    if (body[cursor] === "+") cursor += 1;
    const parsedOptions = parseOptionalOptions(body, cursor);
    cursor = parsedOptions.end;
    cursor = skipWhitespace(body, cursor);
    if (body.startsWith("coordinates", cursor)) {
      cursor += "coordinates".length;
      cursor = skipWhitespace(body, cursor);
      const coords = extractBalanced(body, cursor, "{", "}");
      if (coords) {
        plots.push({
          type: "coordinates",
          is3d,
          options: parseOptions(parsedOptions.raw),
          points: parseCoordinateList(coords.content)
        });
        cursor = coords.end;
      }
    } else if (body[cursor] === "{") {
      const expression = extractBalanced(body, cursor, "{", "}");
      if (expression) {
        plots.push({
          type: "function",
          is3d,
          options: parseOptions(parsedOptions.raw),
          expression: expression.content.trim()
        });
        cursor = expression.end;
      }
    }
    const semicolon = body.indexOf(";", cursor);
    index = semicolon === -1 ? cursor : semicolon + 1;
  }
  return plots;
}

function parseLegendEntries(body) {
  const entries = [];
  let index = 0;
  while (index < body.length) {
    const start = body.indexOf("\\addlegendentry", index);
    if (start === -1) break;
    let cursor = skipWhitespace(body, start + "\\addlegendentry".length);
    const entry = extractBalanced(body, cursor, "{", "}");
    if (!entry) break;
    entries.push(entry.content.trim());
    index = entry.end;
  }
  return entries;
}

function parseCoordinateList(input) {
  const points = [];
  const pattern = /\(([^)]*)\)/g;
  let match = pattern.exec(input);
  while (match) {
    const parts = splitTopLevel(match[1], ",");
    if (parts.length >= 2) {
      points.push({ x: axisNumber(parts[0]), y: axisNumber(parts[1]), raw: `(${parts[0].trim()},${parts[1].trim()})` });
    }
    match = pattern.exec(input);
  }
  return points;
}

function computeAxisRanges(axisOptions, addplots) {
  const domain = parseDomain(axisOptions.domain || "-1:1");
  let xMin = axisNumber(axisOptions.xmin, domain.start);
  let xMax = axisNumber(axisOptions.xmax, domain.end);
  let yMin = Number.isFinite(Number(axisOptions.ymin)) ? axisNumber(axisOptions.ymin) : Infinity;
  let yMax = Number.isFinite(Number(axisOptions.ymax)) ? axisNumber(axisOptions.ymax) : -Infinity;
  for (const plot of addplots) {
    if (plot.type === "coordinates") {
      for (const point of plot.points) {
        xMin = Math.min(xMin, point.x);
        xMax = Math.max(xMax, point.x);
        yMin = Math.min(yMin, point.y);
        yMax = Math.max(yMax, point.y);
      }
    }
    if (plot.type === "function") {
      const plotDomain = parseDomain(plot.options.domain || axisOptions.domain || "-1:1");
      xMin = Math.min(xMin, plotDomain.start);
      xMax = Math.max(xMax, plotDomain.end);
      const samples = axisSamples(plot.options.samples || axisOptions.samples || 25, 80);
      for (let index = 0; index < samples; index += 1) {
        const t = samples === 1 ? 0 : index / (samples - 1);
        const x = plotDomain.start + (plotDomain.end - plotDomain.start) * t;
        const y = evaluateAxisExpression(plot.expression, x, axisOptions);
        if (Number.isFinite(y)) {
          yMin = Math.min(yMin, y);
          yMax = Math.max(yMax, y);
        }
      }
    }
  }
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
    yMin = -1;
    yMax = 1;
  }
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  return {
    xMin: roundAxis(xMin),
    xMax: roundAxis(xMax),
    yMin: roundAxis(yMin),
    yMax: roundAxis(yMax)
  };
}

function createAxisGeometry(axisOptions, ranges) {
  const width = parseAxisDimension(axisOptions.width, Math.max(4, Math.min(12, Math.abs(ranges.xMax - ranges.xMin) || 6)));
  const height = parseAxisDimension(axisOptions.height, Math.max(3, Math.min(8, Math.abs(ranges.yMax - ranges.yMin) || 4)));
  const origin = parseAxisAt(axisOptions.at);
  if (axisOptions.at && isMiddleAxis(axisOptions)) {
    origin.y -= height * TIKZ_PGFPLOTS_MIDDLE_AXIS_STACK_SHIFT;
  }
  const margin = axisContainerMargin(axisOptions);
  const xSpan = ranges.xMax - ranges.xMin || 1;
  const ySpan = ranges.yMax - ranges.yMin || 1;
  const mapPoint = (point) => ({
    x: origin.x + ((point.x - ranges.xMin) / xSpan) * width,
    y: origin.y + ((point.y - ranges.yMin) / ySpan) * height
  });
  return { width, height, origin, margin, mapPoint };
}

function separateStackedMiddleAxis(axisOptions, geometry, axisContext) {
  if (!axisContext || !isMiddleAxis(axisOptions)) return;
  let outer = axisOuterBounds(geometry);
  if (axisOptions.at && Number.isFinite(axisContext.previousMiddleAxisBottom)) {
    const targetTop = axisContext.previousMiddleAxisBottom - TIKZ_PGFPLOTS_MIDDLE_AXIS_STACK_GAP;
    if (outer.maxY > targetTop) {
      geometry.origin.y -= outer.maxY - targetTop;
      outer = axisOuterBounds(geometry);
    }
  }
  axisContext.previousMiddleAxisBottom = outer.minY;
}

function axisContainerMargin(axisOptions) {
  if (axisOptions["hide axis"] || axisOptions.hide) return TIKZ_HIDDEN_AXIS_CONTAINER_MARGIN;
  return TIKZ_AXIS_CONTAINER_MARGIN;
}

function axisOuterBounds(geometry) {
  return {
    minX: geometry.origin.x - geometry.margin.left,
    maxX: geometry.origin.x + geometry.width + geometry.margin.right,
    minY: geometry.origin.y - geometry.margin.bottom,
    maxY: geometry.origin.y + geometry.height + geometry.margin.top
  };
}

function renderAxisFrame(geometry) {
  const bounds = axisOuterBounds(geometry);
  return `\\draw[axis frame, draw=none, fill=none] ${formatAxisPoint({
    x: bounds.minX,
    y: bounds.minY
  })} -- ${formatAxisPoint({
    x: bounds.maxX,
    y: bounds.minY
  })} -- ${formatAxisPoint({
    x: bounds.maxX,
    y: bounds.maxY
  })} -- ${formatAxisPoint({
    x: bounds.minX,
    y: bounds.maxY
  })} -- cycle;`;
}

function parseAxisDimension(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = parseDimension(String(value), {});
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseAxisAt(value) {
  if (!value) return { x: 0, y: 0 };
  const text = String(value).trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  const match = text.match(/^\(([\s\S]*)\)$/);
  if (!match) return { x: 0, y: 0 };
  const parts = splitTopLevel(match[1], ",");
  return {
    x: parseDimension(parts[0] || "0", {}),
    y: parseDimension(parts[1] || "0", {})
  };
}

function renderAxisGrid(ranges, geometry) {
  const commands = [];
  for (const x of tickValues(ranges.xMin, ranges.xMax)) {
    const from = geometry.mapPoint({ x, y: ranges.yMin });
    const to = geometry.mapPoint({ x, y: ranges.yMax });
    commands.push(`\\draw[axis grid, gray!25, line width=0.2pt] ${formatAxisPoint(from)} -- ${formatAxisPoint(to)};`);
  }
  for (const y of tickValues(ranges.yMin, ranges.yMax)) {
    const from = geometry.mapPoint({ x: ranges.xMin, y });
    const to = geometry.mapPoint({ x: ranges.xMax, y });
    commands.push(`\\draw[axis grid, gray!25, line width=0.2pt] ${formatAxisPoint(from)} -- ${formatAxisPoint(to)};`);
  }
  return commands;
}

function renderAxisLines(axisOptions, ranges, geometry) {
  const yAxis = ranges.yMin <= 0 && ranges.yMax >= 0 ? 0 : ranges.yMin;
  const xAxis = ranges.xMin <= 0 && ranges.xMax >= 0 ? 0 : ranges.xMin;
  const middleAxis = isMiddleAxis(axisOptions);
  const style = joinOptions(["axis line", "black", axisOptions["very thick"] ? "very thick" : "line width=0.35pt", middleAxis ? "->" : ""]);
  const xFrom = geometry.mapPoint({ x: ranges.xMin, y: yAxis });
  const xTo = geometry.mapPoint({ x: ranges.xMax, y: yAxis });
  const yFrom = geometry.mapPoint({ x: xAxis, y: ranges.yMin });
  const yTo = geometry.mapPoint({ x: xAxis, y: ranges.yMax });
  return [
    `\\draw[${style}] ${formatAxisPoint(xFrom)} -- ${formatAxisPoint(xTo)};`,
    `\\draw[${style}] ${formatAxisPoint(yFrom)} -- ${formatAxisPoint(yTo)};`
  ];
}

function renderAddplot(plot, axisOptions, ranges, geometry, options) {
  if (plot.type === "coordinates") {
    const mappedPoints = plot.points.map((point) => geometry.mapPoint(point));
    const mark = String(plot.options.mark || "").trim().toLowerCase();
    if (plot.options["only marks"]) {
      return plot.points.map((point) => {
        const style = joinOptions(["axis mark", selectPlotColor(plot.options), "fill opacity=1"]);
        return `\\fill[${style}] ${formatAxisPoint(geometry.mapPoint(point))} circle(0.035);`;
      });
    }
    const style = joinOptions(["axis plot", selectPlotStyle(plot.options)]);
    const commands = [`\\draw[${style}] ${mappedPoints.map(formatAxisPoint).join(" -- ")};`];
    if (mark && mark !== "none") {
      commands.push(
        ...mappedPoints.map((point) => {
          const markStyle = joinOptions(["axis mark", selectPlotColor(plot.options), "fill opacity=1"]);
          return `\\fill[${markStyle}] ${formatAxisPoint(point)} circle(0.035);`;
        })
      );
    }
    return commands;
  }
  if (plot.type === "function") {
    const plotDomain = parseDomain(plot.options.domain || axisOptions.domain || `${ranges.xMin}:${ranges.xMax}`);
    const samples = axisSamples(plot.options.samples || axisOptions.samples || options.pgfplotsSamples || 25, 1200);
    const points = [];
    for (let index = 0; index < samples; index += 1) {
      const t = samples === 1 ? 0 : index / (samples - 1);
      const x = plotDomain.start + (plotDomain.end - plotDomain.start) * t;
      const y = evaluateAxisExpression(plot.expression, x, axisOptions);
      if (Number.isFinite(y)) points.push(geometry.mapPoint({ x, y }));
    }
    const style = joinOptions(["axis plot", selectPlotStyle(plot.options)]);
    return points.length ? [`\\draw[${style}] ${points.map(formatAxisPoint).join(" -- ")};`] : [];
  }
  return [];
}

function renderAxisLabels(axisOptions, ranges, geometry) {
  const commands = [];
  const yAxis = ranges.yMin <= 0 && ranges.yMax >= 0 ? 0 : ranges.yMin;
  const xAxis = ranges.xMin <= 0 && ranges.xMax >= 0 ? 0 : ranges.xMin;
  const xOffset = Math.max(0.28, geometry.width * 0.035);
  const yOffset = Math.max(0.22, geometry.height * 0.06);
  const middleAxis = isMiddleAxis(axisOptions);
  if (axisOptions.xlabel) {
    const point = middleAxis
      ? offsetPoint(geometry.mapPoint({ x: ranges.xMax, y: yAxis }), xOffset, 0)
      : offsetPoint(geometry.mapPoint({ x: (ranges.xMin + ranges.xMax) / 2, y: ranges.yMin }), 0, -yOffset);
    commands.push(`\\node[axis label, anchor=${middleAxis ? "west" : "north"}] at ${formatAxisPoint(point)} {${axisOptions.xlabel}};`);
  }
  if (axisOptions.ylabel) {
    const point = middleAxis
      ? offsetPoint(geometry.mapPoint({ x: xAxis, y: ranges.yMax }), xOffset * 0.2, -yOffset * 0.2)
      : offsetPoint(geometry.mapPoint({ x: ranges.xMin, y: (ranges.yMin + ranges.yMax) / 2 }), -xOffset, 0);
    commands.push(`\\node[axis label, anchor=${middleAxis ? "west" : "east"}] at ${formatAxisPoint(point)} {${axisOptions.ylabel}};`);
  }
  if (axisOptions.title) {
    const point = offsetPoint(geometry.mapPoint({ x: (ranges.xMin + ranges.xMax) / 2, y: ranges.yMax }), 0, yOffset);
    commands.push(`\\node[axis label, anchor=south] at ${formatAxisPoint(point)} {${axisOptions.title}};`);
  }
  return commands;
}

function renderLegendEntries(axisOptions, ranges, geometry, bodyEntries = []) {
  const raw = axisOptions["legend entries"];
  const entries = raw ? splitTopLevel(raw, ",") : bodyEntries;
  if (!entries.length) return [];
  const step = Math.max(0.25, geometry.height * 0.08);
  const anchor = geometry.mapPoint({ x: ranges.xMax, y: ranges.yMax });
  return entries.map((entry, index) => {
    const point = offsetPoint(anchor, 0, -step * (index + 0.65));
    return `\\node[axis legend, anchor=west] at ${formatAxisPoint(point)} {${entry.trim()}};`;
  });
}

function parseDomain(raw) {
  const [start = "-1", end = "1"] = String(raw).split(":");
  return { start: axisNumber(start, -1), end: axisNumber(end, 1) };
}

function tickValues(min, max) {
  const start = Math.ceil(min);
  const end = Math.floor(max);
  const values = [];
  const maxTicks = 41;
  const step = Math.max(1, Math.ceil((end - start + 1) / maxTicks));
  for (let value = start; value <= end; value += step) values.push(value);
  return values;
}

function axisSamples(raw, maxSamples) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 25;
  return Math.max(2, Math.min(maxSamples, Math.round(parsed)));
}

function evaluateAxisExpression(expression, x, axisOptions = {}) {
  const trigFormat = String(axisOptions["trig format"] || "").trim().toLowerCase();
  const radianTrig = trigFormat === "rad" || trigFormat === "radians";
  const substituted = String(expression).replace(/\bx\b/g, `(${x})`);
  const normalized = normalizeAxisExpression(substituted, radianTrig);
  if (!normalized) return 0;
  if (!/^[0-9+\-*/().,\sA-Za-z]+$/.test(normalized)) {
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  try {
    const value = Function(`"use strict"; return (${normalized});`)();
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function normalizeAxisExpression(input, radianTrig) {
  const trigPrefix = radianTrig ? "Math.$1(" : "Math.$1((Math.PI/180)*";
  return String(input)
    .trim()
    .replace(/^\{([\s\S]*)\}$/, "$1")
    .replace(/\bpi\b/g, "Math.PI")
    .replace(/\^/g, "**")
    .replace(/\bsqrt\s*\(/g, "Math.sqrt(")
    .replace(/\babs\s*\(/g, "Math.abs(")
    .replace(/\bexp\s*\(/g, "Math.exp(")
    .replace(/\b(sin|cos|tan)\s*\(/g, trigPrefix);
}

function selectPlotColor(options) {
  for (const [key, value] of Object.entries(options || {})) {
    if (value === true && /^(black|white|red|green|blue|cyan|magenta|yellow|gray|grey|orange|purple|brown|pink)$/.test(key)) {
      return key;
    }
    if (key === "color" || key === "draw") return `${key}=${value}`;
  }
  return "";
}

function selectPlotStyle(options) {
  const parts = [selectPlotColor(options)];
  if (options["very thick"]) parts.push("very thick");
  else if (options.thick) parts.push("thick");
  else if (options["line width"]) parts.push(`line width=${options["line width"]}`);
  if (options.dashed) parts.push("dashed");
  if (options.dotted) parts.push("dotted");
  return joinOptions(parts);
}

function joinOptions(parts) {
  return parts.filter(Boolean).join(", ");
}

function isMiddleAxis(axisOptions) {
  const axisLines = String(axisOptions["axis lines"] || axisOptions.axis || "").trim();
  return axisLines === "middle" || axisLines === "center";
}

function axisNumber(raw, fallback = 0) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const value = evaluateMath(String(raw), {});
  return Number.isFinite(value) ? value : fallback;
}

function roundAxis(value) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function formatAxisNumber(value) {
  return String(roundAxis(value)).replace(/^-0$/, "0");
}

function formatAxisPoint(point) {
  return `(${formatAxisNumber(point.x)},${formatAxisNumber(point.y)})`;
}

function offsetPoint(point, x, y) {
  return { x: point.x + x, y: point.y + y };
}

function parseOptionalOptions(text, start) {
  let index = skipWhitespace(text, start);
  if (text[index] !== "[") return { raw: "", end: index };
  const parsed = extractBalanced(text, index, "[", "]");
  if (!parsed) return { raw: "", end: index };
  return { raw: parsed.content, end: parsed.end };
}

function readCommandName(source, start) {
  const match = source.slice(start).match(/^[A-Za-z@]+/);
  if (!match) return null;
  return { value: match[0], end: start + match[0].length };
}

function skipWhitespace(text, index) {
  let cursor = index;
  while (/\s/.test(text[cursor] || "")) cursor += 1;
  return cursor;
}

function extractBalanced(text, start, open, close) {
  if (text[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === open) depth += 1;
    if (char === close) depth -= 1;
    if (depth === 0) {
      return { content: text.slice(start + 1, index), start, end: index + 1 };
    }
  }
  return null;
}
