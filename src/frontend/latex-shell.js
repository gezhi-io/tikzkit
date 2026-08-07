import { evaluateMath, parseDimension } from "../engine/math.js";
import { applyPreprocessExtensions } from "../extensions/index.js";
import { preserveBchartFontStyleDeclarations } from "../extensions/bchart.js";
import { cmykToCss, normalizeColor, parseOptions, splitTopLevel, styleDefinitionsFromOptions } from "../engine/options.js";
import { collectTikzLibraries, stripTikzLibraryDeclarations } from "../tikz/libraries/declarations.js";
import { lowerTikzmarkMathOverlays } from "../tikz/libraries/tikzmark.js";
import { expandTikzGraphs } from "../tikz/libraries/graphs.js";
import { collectTexPackages } from "../packages/declarations.js";
import { fontScaleFromTikzFont, mathFallbackText } from "../tikz/text.js";
import { libraryRoleFontCommand } from "../tex/fontPolicies.js";
import { renderAddplot, renderCurrentPlotCoordinates } from "../pgfplots/addplotLowering.js";
import {
  collectPgfplotsLibraries,
  collectPgfplotsCycleLists,
  collectPgfplotsSetOptions,
  createAxisOptions,
  parsePgfplotsColormaps,
  stripPgfLibraryDeclarations
} from "../pgfplots/axisOptions.js";
import { expandPgfplotsAxes } from "../pgfplots/axisEnvironment.js";
import { renderAxisOverlayStatements } from "../pgfplots/axisOverlay.js";
import { renderPgfplotsAxisAsTikz } from "../pgfplots/axisTikzLowering.js";
import { renderAxis3DBox, renderAxis3DBoxForeground, renderAxis3DColorbar, renderAxis3DGrid, renderAxis3DTicks, renderAxisLabels3D } from "../pgfplots/axis3d.js";
import { parseAddplots } from "../pgfplots/addplotParser.js";
import {
  evaluateAxisExpression,
  normalizeAxisExpression,
  parsePgfplotsDeclaredFunctions,
  pgfMathRuntimePrelude
} from "../pgfplots/expressions.js";
import {
  axisScaleFactor,
  createAxisGeometry,
  isMiddleAxis,
  parseAxisAt,
  parseAxisDimension,
  PGFPLOTS_DEFAULT_AXIS_WIDTH
} from "../pgfplots/geometry.js";
import { estimateLegendEntryWidth, parseLegendEntries, splitLegendEntries, stripTexForLength } from "../pgfplots/legend.js";
import { datavisualizationIsMercedesMark } from "../pgfplots/marks.js";
import { expandPgfplotsNamedOptions } from "../pgfplots/namedOptions.js";
import { selectPlotColor } from "../pgfplots/plotStyle.js";
import {
  axisSamples,
  computeAxisRanges,
  isSurfacePlot,
  parseDomain
} from "../pgfplots/rangeResolver.js";
import { scaleAxisValue as axisScaleValue } from "../pgfplots/ranges.js";
import {
  axisTickValues,
  majorTickValues as axisMajorTickValues,
  tickDistanceValues as axisTickDistanceValues
} from "../pgfplots/ticks.js";

const BUILTIN_MACROS = new Set(["draw", "path", "fill", "filldraw", "node", "coordinate", "foreach"]);
const DATAVISUALIZATION_VARY_HUE_SERIES = {
  start: [0.4, 0.9, 0.8],
  step: [0.213, 0, 0]
};
const DATAVISUALIZATION_GRAY_SCALE_SERIES = {
  start: [0, 0, -0.34],
  step: [0, 0, 0.34]
};
const DATAVISUALIZATION_SHADES_OF_BLUE_SERIES = {
  start: [0.65, 1.4, 1],
  step: [0, -0.4, 0]
};
const DATAVISUALIZATION_SHADES_OF_RED_SERIES = {
  start: [0, 1.4, 1],
  step: [0, -0.4, 0]
};
const DATAVISUALIZATION_CLEAN_POLAR_TICK_LENGTH = parseDimension("2pt", {});

function datavisualizationRoleFont(role, explicit = "") {
  return libraryRoleFontCommand("datavisualization", role, { explicit });
}

// Claude: 这些宏改由 KaTeX 用原生 \overbrace/\underbrace 渲染（见 renderers/svg/renderSvg.js 的 KATEX_MACROS）。
// 文档里它们通常被 \newcommand 成 \makebox[0pt][l]{$...$} 这种「零宽叠加盒子」，KaTeX 不认这类
// LaTeX 盒子原语，硬展开会导致整块数学渲染失败、退化成把原始源码当文本逐行堆出来。
// 所以这里在收集宏定义时「吃掉」它们的 \newcommand 定义但**不做 JS 展开**，让 \overmat{..}{..}{..}
// 原样保留到数学块里，交给 KaTeX 的 macros 选项处理。
const KATEX_DELEGATED_MACROS = new Set(["overmat", "undermat"]);
const EXTENSION_DELEGATED_MACROS = new Set(["networkLayer", "karnaughmap", "kvmap", "DrawArrow", "tikzmark"]);

function isDelegatedMacro(name) {
  return KATEX_DELEGATED_MACROS.has(name) || EXTENSION_DELEGATED_MACROS.has(name);
}

export function preprocessTikzSource(source, options = {}) {
  const diagnostics = [];
  let expanded = stripTexComments(String(source));
  expanded = selectFirstBeamerFrame(expanded);
  const previewBorder = collectPreviewBorder(expanded);
  expanded = expandTheoreticalComputerScienceLogoMacros(expanded);
  expanded = expandTimelineEnvironments(expanded, diagnostics);
  expanded = expandChronologyEnvironments(expanded, diagnostics);
  expanded = expandEventPeriodTimelineMacros(expanded, diagnostics);
  const packages = collectTexPackages(expanded);
  expanded = applyDocumentFontPackageAliases(expanded, packages);
  const libraries = collectTikzLibraries(expanded);
  const pgfplotsLibraries = collectPgfplotsLibraries(expanded);
  const pgfplotsSet = collectPgfplotsSetOptions(expanded);
  expanded = pgfplotsSet.source;
  expanded = stripTikzLibraryDeclarations(expanded);
  expanded = stripPgfLibraryDeclarations(expanded);
  const colorResult = collectColorDefinitions(expanded);
  const pgfplotsCycleLists = collectPgfplotsCycleLists(colorResult.source, colorResult.colors);
  expanded = replaceDefinedColorUses(colorResult.source, colorResult.colors);
  expanded = normalizeWalmesInlineAnchors(expanded);
  expanded = expandPgfplotsInvokeForeachMacroWrappers(expanded);
  expanded = expandTexLiteEnvironments(expanded, diagnostics, options);
  expanded = preserveBchartFontStyleDeclarations(expanded);
  const macroResult = expandTexLiteMacros(expanded, diagnostics, options);
  expanded = macroResult.source;
  expanded = lowerStandalonePgfplotsCustomLegends(expanded);
  expanded = expandStaticPgfmathMacrosBeforePictures(expanded);
  expanded = lowerTikzmarkMathOverlays(expanded);
  expanded = lowerNestedInlineTikzNodes(expanded);
  expanded = expandTexNewifConditionals(expanded);
  expanded = expandBraidMacros(expanded, diagnostics);
  expanded = terminatePgfTransformStatements(expanded);
  expanded = applyPreprocessExtensions(expanded, {
    diagnostics,
    libraries,
    packages,
    pgfplotsLibraries,
    pgfplotsOptions: pgfplotsSet.options,
    macros: macroResult.macros,
    options
  });
  const filecontentsResult = collectFilecontentsTables(expanded);
  expanded = filecontentsResult.source;
  const tableResult = collectPgfplotstableReads(expanded);
  expanded = lowerPgfplotstableTypeset(tableResult.source, tableResult.tables);
  expanded = replacePgfplotstableReferences(expanded, tableResult.tables);
  const pgfplotsRuntimeOptions = {
    ...withFilecontentsTableResolver(options, filecontentsResult.tables),
    ...createPgfplotsStyleContext(expanded, pgfplotsSet.options),
    pgfplotsCycleLists
  };
  expanded = expandTkzGraphMacros(expanded);
  expanded = expandTikzGraphs(expanded, diagnostics);
  expanded = expandTikzScopeEnvironments(expanded, diagnostics);
  expanded = expandTransparentEnvironment(expanded, "pgfonlayer", diagnostics);
  expanded = expandPgfganttCharts(expanded, diagnostics);
  expanded = expandPgfplotsInvokeForeach(expanded, diagnostics);
  expanded = expandPgfplotsGroupplots(expanded, diagnostics, pgfplotsRuntimeOptions);
  expanded = expandDatavisualizationFunctions(expanded, diagnostics);
  expanded = expandPgfplotsAxes(expanded, diagnostics, pgfplotsRuntimeOptions, pgfplotsAxisLoweringDependencies());
  expanded = normalizeTikzPictureAliases(expanded);
  expanded = stripTexLayoutLengthCommands(expanded);
  expanded = stripTexDocumentShell(expanded);
  return {
    source: expanded,
    diagnostics,
    libraries,
    packages,
    pgfplotsLibraries,
    pgfplotsOptions: pgfplotsSet.options,
    previewBorder
  };
}

const PGFPLOTS_CUSTOM_LEGEND_INITIALIZER = "\\csname pgfplots@init@cleared@structures\\endcsname";
const PGFPLOTS_CUSTOM_LEGEND_IMAGE = "\\csname pgfplots@addlegendimage\\endcsname";
const PGFPLOTS_CUSTOM_LEGEND_RENDERER = "\\csname pgfplots@createlegend\\endcsname";

// A common PGFPlots recipe declares a lightweight environment which exposes
// \addlegendimage outside an axis. Once TeX-lite expands that environment, the
// recipe consists of the three internal commands below. Lower it to ordinary
// TikZ primitives so it uses the shared path/node renderer and remains useful
// in diagrams without an axis.
function lowerStandalonePgfplotsCustomLegends(source) {
  const text = String(source || "");
  let output = "";
  let cursor = 0;
  while (cursor < text.length) {
    const start = text.indexOf("\\begingroup", cursor);
    if (start === -1) {
      output += text.slice(cursor);
      break;
    }
    const end = findTexGroupEnd(text, start);
    if (end === -1) {
      output += text.slice(cursor);
      break;
    }
    const lowered = lowerStandalonePgfplotsCustomLegendBlock(text.slice(start, end));
    if (!lowered) {
      output += text.slice(cursor, start + "\\begingroup".length);
      cursor = start + "\\begingroup".length;
      continue;
    }
    output += text.slice(cursor, start);
    output += lowered;
    cursor = end;
  }
  return output;
}

function findTexGroupEnd(source, start) {
  let depth = 0;
  const commandPattern = /\\(?:begin|end)group\b/g;
  commandPattern.lastIndex = start;
  for (let match = commandPattern.exec(source); match; match = commandPattern.exec(source)) {
    if (match[0] === "\\begingroup") depth += 1;
    else depth -= 1;
    if (depth === 0) return commandPattern.lastIndex;
  }
  return -1;
}

function lowerStandalonePgfplotsCustomLegendBlock(block) {
  const initializer = block.indexOf(PGFPLOTS_CUSTOM_LEGEND_INITIALIZER);
  const renderer = block.lastIndexOf(PGFPLOTS_CUSTOM_LEGEND_RENDERER);
  if (initializer === -1 || renderer === -1 || renderer < initializer) return null;

  let cursor = skipWhitespace(block, initializer + PGFPLOTS_CUSTOM_LEGEND_INITIALIZER.length);
  const options = extractBalanced(block, cursor, "[", "]");
  if (!options) return null;
  const optionMap = parseOptions(options.content);
  const entries = splitLegendEntries(optionMap["legend entries"] || "");
  const legendStyle = parseOptions(stripSingleOuterBraces(optionMap["legend style"] || ""));
  const point = parseStandaloneLegendPoint(legendStyle.at);
  if (!entries.length || !point) return null;

  cursor = options.end;
  const samples = [];
  while (cursor < renderer) {
    const image = block.indexOf(PGFPLOTS_CUSTOM_LEGEND_IMAGE, cursor);
    if (image === -1 || image >= renderer) break;
    const argumentStart = skipWhitespace(block, image + PGFPLOTS_CUSTOM_LEGEND_IMAGE.length);
    const argument = extractBalanced(block, argumentStart, "{", "}");
    if (!argument) return null;
    samples.push(argument.content.trim());
    cursor = argument.end;
  }
  if (samples.length !== entries.length) return null;
  return renderStandalonePgfplotsLegend({ entries, samples, point, anchor: legendStyle.anchor || "center" });
}

function parseStandaloneLegendPoint(value) {
  const text = stripSingleOuterBraces(String(value || "")).trim();
  const match = /^\(\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\)$/.exec(text);
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function renderStandalonePgfplotsLegend({ entries, samples, point, anchor }) {
  const iconWidth = 0.72;
  const iconHeight = 0.16;
  const textGap = 0.26;
  const xPadding = 0.19;
  const yPadding = 0.12;
  const rowHeight = 0.42;
  // PGFPlots' default legend text uses \footnotesize rather than the picture's
  // normal 10pt font. Its narrower measured box is important when anchoring a
  // standalone legend at an absolute TikZ coordinate.
  const textWidth = Math.max(...entries.map((entry) => estimateLegendEntryWidth(entry, 0.8)));
  const width = xPadding * 2 + iconWidth + textGap + textWidth;
  const height = yPadding * 2 + rowHeight * entries.length;
  const box = standaloneLegendBox(point, anchor, width, height);
  const commands = [
    `\\draw[draw=black,fill=white,line width=0.4pt] (${formatStandaloneLegendNumber(box.left)},${formatStandaloneLegendNumber(box.top)}) rectangle (${formatStandaloneLegendNumber(box.right)},${formatStandaloneLegendNumber(box.bottom)});`
  ];
  entries.forEach((entry, index) => {
    const y = box.top - yPadding - rowHeight * (index + 0.5);
    const x0 = box.left + xPadding;
    const x1 = x0 + iconWidth;
    commands.push(...renderStandaloneLegendSample(samples[index], x0, x1, y, iconHeight));
    commands.push(`\\node[anchor=west,inner sep=0pt,font=\\footnotesize] at (${formatStandaloneLegendNumber(x1 + textGap)},${formatStandaloneLegendNumber(y)}) {${entry}};`);
  });
  return `\n${commands.join("\n")}\n`;
}

function standaloneLegendBox(point, anchor, width, height) {
  const normalized = String(anchor || "center").trim().toLowerCase();
  const horizontal = normalized.includes("east") ? "east" : normalized.includes("west") ? "west" : "center";
  const vertical = normalized.includes("south") ? "south" : normalized.includes("north") ? "north" : "center";
  const left = horizontal === "east" ? point.x - width : horizontal === "west" ? point.x : point.x - width / 2;
  const bottom = vertical === "north" ? point.y - height : vertical === "south" ? point.y : point.y - height / 2;
  return { left, right: left + width, bottom, top: bottom + height };
}

function renderStandaloneLegendSample(style, x0, x1, y, height) {
  const raw = String(style || "").trim();
  if (/(?:^|,)\s*area legend\b/.test(raw)) {
    return [`\\draw[${raw}] (${formatStandaloneLegendNumber(x0)},${formatStandaloneLegendNumber(y - height / 2)}) rectangle (${formatStandaloneLegendNumber(x1)},${formatStandaloneLegendNumber(y + height / 2)});`];
  }
  return [`\\draw[${raw}] (${formatStandaloneLegendNumber(x0)},${formatStandaloneLegendNumber(y)}) -- (${formatStandaloneLegendNumber(x1)},${formatStandaloneLegendNumber(y)});`];
}

function stripSingleOuterBraces(value) {
  const text = String(value || "").trim();
  const parsed = text.startsWith("{") ? extractBalanced(text, 0, "{", "}") : null;
  return parsed && parsed.end === text.length ? parsed.content.trim() : text;
}

function formatStandaloneLegendNumber(value) {
  return String(Number(Number(value).toFixed(4)));
}

function applyDocumentFontPackageAliases(source, packages = []) {
  if (!packages.some((pkg) => pkg?.name === "helvet")) return source;

  // helvet.sty changes only LaTeX's sans-serif default (\sfdefault -> phv).
  // Preserve that distinction through preprocessing so generic \sffamily
  // remains CMU Sans unless the package is explicitly present.
  return String(source)
    .replace(/\\sffamily\b/g, "\\tikzkithelvetfamily")
    .replace(/\\sf\b/g, "\\tikzkithelvetfamily");
}

function collectPreviewBorder(source) {
  const text = String(source || "");
  const explicitMatch = text.match(
    /\\setlength\s*(?:\{\s*\\PreviewBorder\s*\}|\\PreviewBorder)\s*\{([^{}]+)\}/
  );
  if (explicitMatch) return nonnegativeDimension(explicitMatch[1]);

  const documentClassMatch = text.match(/\\documentclass\s*(?:\[([^\]]*)\])?\s*\{\s*standalone\s*\}/i);
  if (!documentClassMatch?.[1]) return null;
  return nonnegativeDimension(parseOptions(documentClassMatch[1]).border);
}

function expandStaticPgfmathMacrosBeforePictures(source) {
  const pictureStart = source.indexOf("\\begin{tikzpicture}");
  if (pictureStart === -1) return source;
  const prefix = source.slice(0, pictureStart);
  const values = {};
  let output = "";
  let cursor = 0;
  const command = "\\pgfmathsetmacro";
  while (cursor < prefix.length) {
    const start = prefix.indexOf(command, cursor);
    if (start === -1) break;
    output += replaceStaticPgfmathMacroReferences(prefix.slice(cursor, start), values);
    const declaration = parseStaticPgfmathMacro(prefix, start, command);
    if (!declaration) {
      output += command;
      cursor = start + command.length;
      continue;
    }
    const expression = replaceStaticPgfmathMacroReferences(declaration.expression, values);
    // Coordinate-system declarations receive their `cs:` payload as TeX #1 at
    // resolution time. Treating that macro as a pre-picture constant collapses
    // every dynamic coordinate onto the same point.
    if (/#\d/.test(expression)) {
      output += prefix.slice(start, declaration.end);
      cursor = declaration.end;
      continue;
    }
    const value = /\\[A-Za-z@]+/.test(expression) ? NaN : evaluateMath(expression, values);
    if (Number.isFinite(value)) {
      values[declaration.name] = value;
      output += "\n";
    } else {
      output += prefix.slice(start, declaration.end);
    }
    cursor = declaration.end;
  }
  output += replaceStaticPgfmathMacroReferences(prefix.slice(cursor), values);
  return output + replaceStaticPgfmathMacroReferences(source.slice(pictureStart), values);
}

function parseStaticPgfmathMacro(source, start, command) {
  let cursor = skipWhitespace(source, start + command.length);
  let name = "";
  if (source[cursor] === "{") {
    const wrapped = extractBalanced(source, cursor, "{", "}");
    if (!wrapped) return null;
    name = wrapped.content.trim().replace(/^\\/, "");
    cursor = wrapped.end;
  } else if (source[cursor] === "\\") {
    const parsedName = readCommandName(source, cursor + 1);
    if (!parsedName) return null;
    name = parsedName.value;
    cursor = parsedName.end;
  }
  if (!name) return null;
  const body = extractBalanced(source, skipWhitespace(source, cursor), "{", "}");
  if (!body) return null;
  return { name, expression: body.content.trim(), end: body.end };
}

function replaceStaticPgfmathMacroReferences(source, values) {
  let replaced = String(source || "");
  const names = Object.keys(values).sort((left, right) => right.length - left.length);
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const value = Number(Number(values[name]).toPrecision(15)).toString();
    replaced = replaced.replace(new RegExp(`\\\\${escaped}(?![A-Za-z@])`, "g"), value);
  }
  return replaced;
}

function nonnegativeDimension(raw) {
  if (raw === undefined || raw === null || raw === true || raw === false) return null;
  const value = parseDimension(String(raw), {});
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function stripTexLayoutLengthCommands(source) {
  const text = String(source || "");
  let output = "";
  let cursor = 0;
  const commandPattern = /\\(?:setlength|addtolength)\b/g;
  while (cursor < text.length) {
    commandPattern.lastIndex = cursor;
    const match = commandPattern.exec(text);
    if (!match) {
      output += text.slice(cursor);
      break;
    }
    output += text.slice(cursor, match.index);
    let end = skipWhitespace(text, match.index + match[0].length);
    let register = extractBalanced(text, end, "{", "}");
    if (!register && text[end] === "\\") {
      const command = readCommandName(text, end + 1);
      if (command?.value) register = { content: `\\${command.value}`, end: command.end };
    }
    if (!register) {
      output += match[0];
      cursor = match.index + match[0].length;
      continue;
    }
    end = skipWhitespace(text, register.end);
    const value = extractBalanced(text, end, "{", "}");
    if (!value) {
      output += text.slice(match.index, register.end);
      cursor = register.end;
      continue;
    }
    cursor = value.end;
  }
  return output;
}

function lowerNestedInlineTikzNodes(source) {
  const text = String(source || "");
  let output = "";
  let cursor = 0;
  let generatedName = 0;
  while (cursor < text.length) {
    const start = text.indexOf("\\node", cursor);
    if (start === -1) {
      output += text.slice(cursor);
      break;
    }
    if (/[A-Za-z@]/.test(text[start + "\\node".length] || "")) {
      output += text.slice(cursor, start + "\\node".length);
      cursor = start + "\\node".length;
      continue;
    }
    const outer = parseInlineNodeStatement(text, start);
    const nested = outer ? parseNestedTikzNode(outer.body) : null;
    if (!outer || !nested) {
      output += text.slice(cursor, start + 1);
      cursor = start + 1;
      continue;
    }

    const name = nested.name || `tikzkit-inline-node-${++generatedName}`;
    const innerOptions = `[${[nested.options, nestedInlineNodeShift(nested.options)].filter(Boolean).join(",")}]`;
    const outerOptions = [outer.options, nestedOuterNodePadding(outer.options), `fit=(${name})`].filter(Boolean).join(",");
    const outerName = outer.name ? ` (${outer.name})` : "";
    const replacement = [
      // A bare outer \node is placed at the current point, which is the
      // picture origin for a standalone node. Keep the nested inline picture
      // at that same point so its split-part anchors remain addressable.
      `\\node${innerOptions} (${name}) at ${outer.at || "(0,0)"} {${nested.body}};`,
      `\\begin{scope}[on background layer]`,
      `\\node[${outerOptions}]${outerName} {};`,
      `\\end{scope}`
    ].join("\n");
    output += text.slice(cursor, start) + replacement;
    cursor = outer.end;
  }
  return output;
}

function nestedOuterNodePadding(rawOptions = "") {
  const options = parseOptions(rawOptions);
  if (options["inner sep"] !== undefined || options["inner xsep"] !== undefined || options["inner ysep"] !== undefined) return "";
  // An inline \tikz picture is a TeX box. In the common multiline form its
  // trailing source whitespace contributes one cmtt10 cell on the right. A
  // fit node already includes half of the inner node's stroke on each side,
  // so its explicit separation is reduced by that amount.
  return "inner xsep=0.5964em,inner ysep=0.3333em,xshift=0.2625em";
}

function nestedInlineNodeShift(rawOptions = "") {
  const options = parseOptions(rawOptions);
  if (options.xshift !== undefined) return "";
  // The semicolon and following TeX space make the inline picture box one
  // cmtt10 cell wider on the right. PGF therefore centers the visible node
  // half a cell (0.2625em) left of the surrounding node's requested point.
  return "xshift=-0.2625em";
}

function parseNestedTikzNode(body) {
  const source = String(body || "").trim();
  if (!source.startsWith("\\tikz") || /[A-Za-z@]/.test(source["\\tikz".length] || "")) return null;
  let cursor = skipWhitespace(source, "\\tikz".length);
  if (source[cursor] === "[") {
    const pictureOptions = extractBalanced(source, cursor, "[", "]");
    if (!pictureOptions) return null;
    cursor = skipWhitespace(source, pictureOptions.end);
  }
  if (!source.startsWith("\\node", cursor) || /[A-Za-z@]/.test(source[cursor + "\\node".length] || "")) return null;
  const node = parseInlineNodeStatement(source, cursor);
  if (!node) return null;
  const trailing = source.slice(node.end).trim();
  if (trailing) return null;
  return node;
}

function parseInlineNodeStatement(source, start) {
  let cursor = skipWhitespace(source, start + "\\node".length);
  let options = "";
  let name = "";
  let at = "";
  if (source[cursor] === "[") {
    const parsedOptions = extractBalanced(source, cursor, "[", "]");
    if (!parsedOptions) return null;
    options = parsedOptions.content.trim();
    cursor = skipWhitespace(source, parsedOptions.end);
  }
  if (source[cursor] === "(") {
    const parsedName = extractBalanced(source, cursor, "(", ")");
    if (!parsedName) return null;
    name = parsedName.content.trim();
    cursor = skipWhitespace(source, parsedName.end);
  }
  if (source.slice(cursor, cursor + 2) === "at" && !/[A-Za-z@]/.test(source[cursor + 2] || "")) {
    cursor = skipWhitespace(source, cursor + 2);
    if (source[cursor] !== "(") return null;
    const parsedAt = extractBalanced(source, cursor, "(", ")");
    if (!parsedAt) return null;
    at = `(${parsedAt.content})`;
    cursor = skipWhitespace(source, parsedAt.end);
  }
  if (!name && source[cursor] === "(") {
    const parsedName = extractBalanced(source, cursor, "(", ")");
    if (!parsedName) return null;
    name = parsedName.content.trim();
    cursor = skipWhitespace(source, parsedName.end);
  }
  if (source[cursor] !== "{") return null;
  const body = extractBalanced(source, cursor, "{", "}");
  if (!body) return null;
  cursor = skipWhitespace(source, body.end);
  if (source[cursor] === ";") cursor += 1;
  return { options, name, at, body: body.content, end: cursor };
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

function normalizeWalmesInlineAnchors(source) {
  const text = String(source || "");
  let output = "";
  let index = 0;
  while (index < text.length) {
    if (text[index] !== "\\") {
      output += text[index];
      index += 1;
      continue;
    }
    const command = readCommandName(text, index + 1);
    if (!command?.value || !["NANN", "tm", "tmc"].includes(command.value)) {
      output += text[index];
      index += 1;
      continue;
    }
    const parsed = parseWalmesInlineAnchorInvocation(text, index, command.value, command.end);
    if (!parsed) {
      output += text[index];
      index += 1;
      continue;
    }
    output += parsed.replacement;
    index = parsed.end;
  }
  return output;
}

function parseWalmesInlineAnchorInvocation(source, start, command, afterCommand) {
  let index = skipWhitespace(source, afterCommand);
  const name = extractBalanced(source, index, "{", "}");
  if (!name?.content?.trim()) return null;
  index = skipWhitespace(source, name.end);
  if (command === "tm") {
    return {
      replacement: `\\tikzmarknode{${name.content.trim()}}{}`,
      end: name.end
    };
  }
  const second = extractBalanced(source, index, "{", "}");
  if (!second) return null;
  if (command === "tmc") {
    return {
      replacement: `\\tikzmarknode[xshift=${second.content.trim()}ex]{${name.content.trim()}}{}`,
      end: second.end
    };
  }
  return {
    replacement: `\\tikzmarknode{${name.content.trim()}}{${second.content}}`,
    end: second.end
  };
}

function expandPgfplotsInvokeForeachMacroWrappers(source) {
  const text = String(source || "");
  const zeroArgMacros = new Map();
  let output = "";
  let index = 0;
  const wrapper = "\\pgfplotsinvokeforeachmacro";
  while (index < text.length) {
    if (text.startsWith("\\newcommand", index) || text.startsWith("\\renewcommand", index)) {
      const parsed = parseNewCommandMacro(text, index);
      if (parsed?.macro?.argCount === 0 && parsed.name) {
        zeroArgMacros.set(parsed.name, parsed.macro.body);
      }
    }
    if (!text.startsWith(wrapper, index) || !isTeXCommandBoundary(text, index + wrapper.length)) {
      output += text[index];
      index += 1;
      continue;
    }
    let cursor = skipWhitespace(text, index + wrapper.length);
    if (text[cursor] !== "\\") {
      output += text[index];
      index += 1;
      continue;
    }
    const listMacro = readCommandName(text, cursor + 1);
    if (!listMacro?.value || !zeroArgMacros.has(listMacro.value)) {
      output += text[index];
      index += 1;
      continue;
    }
    cursor = skipWhitespace(text, listMacro.end);
    const body = extractBalanced(text, cursor, "{", "}");
    if (!body) {
      output += text[index];
      index += 1;
      continue;
    }
    output += expandPgfplotsInvokeForeachList(zeroArgMacros.get(listMacro.value))
      .map((value) => body.content.replace(/#1/g, value))
      .join("\n");
    index = body.end;
  }
  return output;
}

function expandTheoreticalComputerScienceLogoMacros(source) {
  const text = String(source);
  if (
    !text.includes("\\logo") ||
    !text.includes("\\pgfarrowsdeclare{leaf}{leaf}") ||
    (!text.includes("\\textcolor{border}{T}heoretical") && !text.includes("Computer") && !text.includes("Science"))
  ) {
    return text;
  }

  const includeSourceGrid = hasInjectedTikzSourceGrid(text);
  let output = "";
  let cursor = 0;
  while (cursor < text.length) {
    const environment = findNextTcsLogoStackEnvironment(text, cursor);
    if (!environment) {
      output += replaceStandaloneTcsLogoCalls(text.slice(cursor), includeSourceGrid);
      break;
    }

    output += replaceStandaloneTcsLogoCalls(text.slice(cursor, environment.begin), includeSourceGrid);
    const afterBegin = environment.begin + environment.beginToken.length;
    const firstArg = extractBalanced(text, skipWhitespace(text, afterBegin), "{", "}");
    if (!firstArg) {
      output += text[environment.begin];
      cursor = environment.begin + 1;
      continue;
    }
    const end = text.indexOf(environment.endToken, firstArg.end);
    if (end === -1) {
      output += replaceStandaloneTcsLogoCalls(text.slice(environment.begin));
      break;
    }

    const body = text.slice(firstArg.end, end);
    const calls = collectTcsLogoCalls(body);
    output += calls.length ? renderTcsLogoStack(calls, includeSourceGrid) : text.slice(environment.begin, end + environment.endToken.length);
    cursor = end + environment.endToken.length;
  }

  return output;
}

function hasInjectedTikzSourceGrid(source) {
  const text = String(source || "");
  return (
    text.includes("\\draw[overlay, step=1cm") &&
    text.includes("dash pattern=on 0.7pt off 0.7pt") &&
    text.includes("(-50,-50) grid (50,50)")
  );
}

function findNextTcsLogoStackEnvironment(source, cursor) {
  const candidates = ["minipage", "tabular"]
    .map((name) => {
      const beginToken = `\\begin{${name}}`;
      const begin = source.indexOf(beginToken, cursor);
      return begin === -1
        ? null
        : {
            name,
            begin,
            beginToken,
            endToken: `\\end{${name}}`
          };
    })
    .filter(Boolean)
    .sort((left, right) => left.begin - right.begin);
  return candidates[0] || null;
}

function replaceStandaloneTcsLogoCalls(source, includeSourceGrid = false) {
  const calls = collectTcsLogoCalls(source);
  if (!calls.length) return source;
  let output = "";
  let cursor = 0;
  for (const call of calls) {
    output += source.slice(cursor, call.start);
    output += renderTcsLogoStack([call], includeSourceGrid);
    cursor = call.end;
  }
  output += source.slice(cursor);
  return output;
}

function collectTcsLogoCalls(source) {
  const calls = [];
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf("\\logo", cursor);
    if (start === -1) break;
    const parsed = parseTcsLogoCallAt(source, start);
    if (parsed) {
      calls.push(parsed);
      cursor = parsed.end;
    } else {
      cursor = start + "\\logo".length;
    }
  }
  return calls;
}

function parseTcsLogoCallAt(source, start) {
  let index = start + "\\logo".length;
  const args = [];
  for (let argIndex = 0; argIndex < 5; argIndex += 1) {
    index = skipWhitespace(source, index);
    const body = extractBalanced(source, index, "{", "}");
    if (!body) return null;
    args.push(body.content.trim());
    index = body.end;
  }
  return {
    start,
    end: index,
    border: args[0] || "black",
    trunk: args[1] || "black",
    leafA: args[2] || "green",
    leafB: args[3] || args[2] || "green",
    leafTip: args[4] || ""
  };
}

function renderTcsLogoStack(calls, includeSourceGrid = false) {
  const lines = ["\\begin{tikzpicture}[x=1cm,y=1cm]"];
  const logoCount = Math.max(1, calls.length);
  const bottom = -3.35 * (logoCount - 1) - 1.45;
  lines.push(`\\path[use as bounding box] (-2.75,${roundTikzNumber(bottom)}) rectangle (2.75,2);`);
  if (includeSourceGrid) {
    lines.push("\\draw[overlay, step=1cm, line width=0.12pt, dash pattern=on 0.7pt off 0.7pt, black!45] (-50,-50) grid (50,50);");
  }
  calls.forEach((call, index) => {
    lines.push(...renderTcsLogoAt(call, -3.35 * index));
  });
  lines.push("\\end{tikzpicture}");
  return lines.join("\n");
}

function renderTcsLogoAt(call, yOffset) {
  const lines = [];
  const y = (value) => roundTikzNumber(value + yOffset);
  const border = safeTcsColor(call.border);
  const trunk = safeTcsColor(call.trunk);
  const leafA = safeTcsColor(call.leafA);
  const leafB = safeTcsColor(call.leafB);
  lines.push(
    `\\draw[draw=${border},line width=1ex] ` +
      `(1.05,${y(0.3)}) to [out=90,in=0] (0,${y(1.75)}) to [out=180,in=90] (-1.05,${y(0.3)}) ` +
      `to [out=-90,in=-180] (0,${y(-1.15)}) to [out=0,in=-90] (1.05,${y(0.3)}) -- cycle;`
  );

  const branches = buildTcsLogoBranches(call, yOffset);
  for (const branch of branches.edges) {
    lines.push(
      `\\draw[draw=${branch.color},line width=${branch.width},line cap=${branch.cap}] ` +
        `(${roundTikzNumber(branch.from.x)},${roundTikzNumber(branch.from.y)}) -- ` +
        `(${roundTikzNumber(branch.to.x)},${roundTikzNumber(branch.to.y)});`
    );
  }
  if (call.leafTip.trim()) {
    for (const leaf of branches.leaves) {
      lines.push(`\\path[fill=${leaf.color},draw=none] ${tcsLeafPath(leaf)};`);
    }
  }

  // The SVG text renderer centers multi-line text around the IR y coordinate, while
  // TikZ's north anchor places the text box below the anchor. The lowered TCS logo
  // uses a calibrated anchor so its rendered baselines match the local tikztosvg
  // reference for the four-logo stack.
  lines.push(
    `\\node[align=center,anchor=north,font=\\scriptsize\\scshape,scale=2.25,tikzkit text width scale=0.85] at (0,${y(-1.2)}) ` +
      `{\\textcolor{${border}}{T}HEORETICAL \\\\ \\textcolor{${border}}{C}OMPUTER \\\\ \\textcolor{${border}}{S}CIENCE};`
  );
  return lines;
}

function buildTcsLogoBranches(call, yOffset) {
  const levels = [
    { distance: 0.45, width: "1ex", color: safeTcsColor(call.trunk), siblingAngle: 60, cap: "butt" },
    { distance: 0.35, width: ".8ex", color: safeTcsColor(tcsMixColor(call.trunk, 80, call.leafA)), siblingAngle: 56, cap: "round" },
    { distance: 0.275, width: ".6ex", color: safeTcsColor(tcsMixColor(call.trunk, 60, call.leafA)), siblingAngle: 52, cap: "round" },
    { distance: 0.2, width: ".4ex", color: safeTcsColor(tcsMixColor(call.trunk, 40, call.leafA)), siblingAngle: 48, cap: "round" },
    { distance: 0.1, width: ".3ex", color: safeTcsColor(tcsMixColor(call.trunk, 20, call.leafA)), siblingAngle: 44, cap: "round" },
    { distance: 0.175, width: ".2ex", color: safeTcsColor(call.leafA), siblingAngle: 40, cap: "round" }
  ];
  const root = { x: 0, y: yOffset };
  const edges = [];
  const leaves = [];

  const first = tcsPolar(root, 90, levels[0].distance);
  edges.push({ from: root, to: first, color: levels[0].color, width: levels[0].width, cap: levels[0].cap });
  growTcsLogoBranch(first, 90, 1);

  function growTcsLogoBranch(parent, parentAngle, levelIndex) {
    if (levelIndex >= levels.length) return;
    const level = levels[levelIndex];
    for (const direction of [-1, 1]) {
      const angle = parentAngle + direction * (level.siblingAngle / 2);
      const child = tcsPolar(parent, angle, level.distance);
      const terminal = levelIndex === levels.length - 1;
      const color = terminal
        ? safeTcsColor(direction < 0 ? call.leafA : call.leafB)
        : level.color;
      edges.push({ from: parent, to: child, color, width: level.width, cap: level.cap });
      if (terminal) {
        leaves.push({ ...child, color, angle });
      } else {
        growTcsLogoBranch(child, angle, levelIndex + 1);
      }
    }
  }

  return { edges, leaves };
}

function tcsLeafPath(leaf) {
  const tip = tcsOffsetPoint(leaf, leaf.angle, 0.015);
  const back = tcsOffsetPoint(leaf, leaf.angle, -0.095);
  const top1 = tcsOffsetPoint(back, leaf.angle, 0.03, 0.052);
  const top2 = tcsOffsetPoint(tip, leaf.angle, -0.04, 0.052);
  const bottom1 = tcsOffsetPoint(tip, leaf.angle, -0.04, -0.052);
  const bottom2 = tcsOffsetPoint(back, leaf.angle, 0.03, -0.052);
  return (
    `${tcsPoint(back)} .. controls ${tcsPoint(top1)} and ${tcsPoint(top2)} .. ${tcsPoint(tip)} ` +
    `.. controls ${tcsPoint(bottom1)} and ${tcsPoint(bottom2)} .. ${tcsPoint(back)} -- cycle`
  );
}

function tcsOffsetPoint(point, degrees, along, normal = 0) {
  const radians = (degrees * Math.PI) / 180;
  const ux = Math.cos(radians);
  const uy = Math.sin(radians);
  return {
    x: point.x + ux * along - uy * normal,
    y: point.y + uy * along + ux * normal
  };
}

function tcsPoint(point) {
  return `(${roundTikzNumber(point.x)},${roundTikzNumber(point.y)})`;
}

function tcsPolar(point, degrees, distance) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: point.x + Math.cos(radians) * distance,
    y: point.y + Math.sin(radians) * distance
  };
}

function tcsMixColor(left, amount, right) {
  return `${left}!${amount}!${right}`;
}

function safeTcsColor(color) {
  return String(color || "black").replace(/[,{}[\]]/g, "").trim() || "black";
}

function expandTimelineEnvironments(source, diagnostics) {
  const text = String(source);
  if (!text.includes("\\begin{timeline}")) return text;

  let output = "";
  let cursor = 0;
  const state = createTimelineState();
  const includeCompareGrid = text.includes("tikzkit compare grid");

  while (cursor < text.length) {
    const beginIndex = text.indexOf("\\begin{timeline}", cursor);
    if (beginIndex === -1) {
      const tail = text.slice(cursor);
      updateTimelineState(state, tail);
      output += tail;
      break;
    }

    const before = text.slice(cursor, beginIndex);
    updateTimelineState(state, before);
    output += before;

    let index = beginIndex + "\\begin{timeline}".length;
    const options = parseOptionalOptions(text, index);
    index = options.end;
    const endIndex = text.indexOf("\\end{timeline}", index);
    if (endIndex === -1) {
      diagnostics.push({ severity: "warning", message: "Could not find \\end{timeline} for timeline environment" });
      output += text.slice(beginIndex);
      break;
    }

    const body = text.slice(index, endIndex);
    const tasks = parseTimelineTasks(body);
    output += renderTimelineTikz(tasks, state, options.raw, includeCompareGrid);
    cursor = endIndex + "\\end{timeline}".length;
  }

  return stripTimelineSetupStatements(stripTimelineEnvironmentDefinition(output));
}

function createTimelineState() {
  return {
    taskwidth: "2.5cm",
    taskvsep: "17pt",
    colors: new Map([
      ["arrowcolor", "black"],
      ["circlecolor", "white"],
      ["textcolor", "black"],
      ["bordercolor", "black"],
      ["white", "white"],
      ["black", "black"],
      ["red", "red"],
      ["green", "green"],
      ["blue", "blue"],
      ["gray", "gray"],
      ["grey", "gray"]
    ])
  };
}

function updateTimelineState(state, chunk) {
  const entries = [];
  const source = String(chunk);
  for (const match of source.matchAll(/\\definecolor\s*\{([^{}]+)\}\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g)) {
    entries.push({ index: match.index, type: "definecolor", name: match[1].trim(), model: match[2].trim(), spec: match[3].trim() });
  }
  for (const match of source.matchAll(/\\colorlet(?:\[[^\]]*\])?\s*\{([^{}]+)\}(?:\[[^\]]*\])?\s*\{([^{}]+)\}/g)) {
    entries.push({ index: match.index, type: "colorlet", name: match[1].trim(), expr: match[2].trim() });
  }
  for (const match of source.matchAll(/\\setlength\s*\\(taskwidth|taskvsep)\s*\{([^{}]+)\}/g)) {
    entries.push({ index: match.index, type: "setlength", name: match[1].trim(), value: match[2].trim() });
  }
  entries.sort((left, right) => left.index - right.index);

  for (const entry of entries) {
    if (entry.type === "definecolor") {
      const color = definedColorToCss(entry.model, entry.spec);
      if (color) state.colors.set(entry.name, color);
      continue;
    }
    if (entry.type === "colorlet") {
      state.colors.set(entry.name, timelineColor(entry.expr, state));
      continue;
    }
    if (entry.type === "setlength") {
      state[entry.name] = entry.value;
    }
  }
}

function parseTimelineTasks(body) {
  const tasks = [];
  const text = String(body);
  let cursor = 0;
  while (cursor < text.length) {
    const taskIndex = text.indexOf("\\Task", cursor);
    if (taskIndex === -1) break;
    let index = taskIndex + "\\Task".length;
    const options = parseOptionalOptions(text, index);
    index = options.end;
    index = skipWhitespace(text, index);
    const content = extractBalanced(text, index, "{", "}");
    if (!content) {
      cursor = taskIndex + "\\Task".length;
      continue;
    }
    tasks.push({
      label: options.raw.trim(),
      text: normalizeTimelineText(content.content)
    });
    cursor = content.end;
  }
  return tasks;
}

function renderTimelineTikz(tasks, state, rawOptions, includeCompareGrid = false) {
  if (!tasks.length) return "\\begin{tikzpicture}\\end{tikzpicture}";
  const taskWidth = finitePositiveDimension(state.taskwidth, 2.5);
  const taskVsep = finitePositiveDimension(state.taskvsep, parseDimension("17pt", {}));
  const spacing = timelineNodeDistance(rawOptions, taskWidth);
  const circleSize = 0.8;
  const circleRadius = circleSize / 2;
  const arrowHalfHeight = Math.max(0.42, circleRadius * 0.95);
  const arrowHead = Math.max(0.85, spacing * 0.52);
  const arrowStart = -Math.max(0.5, spacing * 0.28);
  const lastX = (tasks.length - 1) * spacing;
  const arrowNeck = lastX + Math.max(0.62, spacing * 0.38);
  const arrowEnd = arrowNeck + arrowHead;
  const notch = Math.max(0.28, spacing * 0.18);
  const labelOffset = circleRadius + taskVsep;
  const arrow = timelineColor("arrowcolor", state);
  const circle = timelineColor("circlecolor", state);
  const text = timelineColor("textcolor", state);
  const border = timelineColor("bordercolor", state);
  const pictureOptions = ["x=1cm", "y=1cm"];
  const commands = [`\\begin{tikzpicture}[${pictureOptions.join(",")}]`];

  commands.push(
    `\\path[fill=${arrow},draw=none] ` +
      `(${roundTikzNumber(arrowStart)},${roundTikzNumber(-arrowHalfHeight)}) -- ` +
      `(${roundTikzNumber(arrowNeck)},${roundTikzNumber(-arrowHalfHeight)}) -- ` +
      `(${roundTikzNumber(arrowNeck)},${roundTikzNumber(-arrowHalfHeight * 1.72)}) -- ` +
      `(${roundTikzNumber(arrowEnd)},0) -- ` +
      `(${roundTikzNumber(arrowNeck)},${roundTikzNumber(arrowHalfHeight * 1.72)}) -- ` +
      `(${roundTikzNumber(arrowNeck)},${roundTikzNumber(arrowHalfHeight)}) -- ` +
      `(${roundTikzNumber(arrowStart)},${roundTikzNumber(arrowHalfHeight)}) -- ` +
      `(${roundTikzNumber(arrowStart + notch)},0) -- cycle;`
  );

  tasks.forEach((task, index) => {
    const x = index * spacing;
    const isAbove = index % 2 === 0;
    const anchor = isAbove ? "south" : "north";
    const labelY = isAbove ? labelOffset : -labelOffset;
    const label = task.label || "";
    commands.push(
      `\\node[circle,fill=${circle},draw=${border},line width=1.5pt,inner sep=4pt,text width=1.2em,minimum size=${roundTikzNumber(circleSize)}cm,align=center,text=${text},font=\\footnotesize\\sffamily] ` +
        `(timeline-${index + 1}) at (${roundTikzNumber(x)},0) {${label}};`
    );
    commands.push(
      `\\node[anchor=${anchor},text width=${roundTikzNumber(taskWidth)}cm,align=center,font=\\scriptsize] ` +
        `at (${roundTikzNumber(x)},${roundTikzNumber(labelY)}) {${task.text}};`
    );
  });

  if (includeCompareGrid) commands.push(timelineDebugGridScope());
  commands.push("\\end{tikzpicture}");
  return commands.join("\n");
}

function timelineDebugGridScope() {
  return String.raw`\begin{scope}[on background layer]
  \draw[black!45,line width=0.18pt,dash pattern=on 1pt off 1.2pt,step=1cm] ($(current bounding box.south west)+(-1,-1)$) grid ($(current bounding box.north east)+(1,1)$);
\end{scope}`;
}

function timelineNodeDistance(rawOptions, taskWidth) {
  const options = parseOptions(rawOptions || "");
  const raw = String(options["node distance"] || ".75\\taskwidth").trim();
  const taskWidthMatch = raw.match(/^([+-]?(?:\d+\.?\d*|\.\d+))\s*\\taskwidth$/);
  if (taskWidthMatch) return Math.max(0.2, Number(taskWidthMatch[1]) * taskWidth);
  const parsed = parseDimension(raw.replace(/\\taskwidth/g, `${taskWidth}cm`), {});
  return Number.isFinite(parsed) && parsed > 0 ? parsed : taskWidth * 0.75;
}

function finitePositiveDimension(raw, fallback) {
  const parsed = parseDimension(String(raw || ""), {});
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function timelineColor(name, state) {
  const text = String(name || "").trim();
  if (!text) return "black";
  if (state.colors.has(text)) return state.colors.get(text);
  const css = definedColorToCss("HTML", text);
  if (css) return css;
  return normalizeColor(replaceColorNames(text, state.colors));
}

function normalizeTimelineText(text) {
  return String(text)
    .replace(/\\Centering\b/g, "")
    .replace(/\\RaggedRight\b/g, "")
    .replace(/\\scriptsize\b/g, "")
    .replace(/\\par\b/g, "\\\\")
    .trim();
}

function stripTimelineEnvironmentDefinition(source) {
  const text = String(source);
  let output = "";
  let cursor = 0;
  while (cursor < text.length) {
    const start = text.indexOf("\\newenvironment{timeline}", cursor);
    if (start === -1) {
      output += text.slice(cursor);
      break;
    }
    output += text.slice(cursor, start);
    let index = start + "\\newenvironment{timeline}".length;
    index = skipWhitespace(text, index);
    if (text[index] === "[") {
      const count = extractBalanced(text, index, "[", "]");
      if (!count) {
        output += text[start];
        cursor = start + 1;
        continue;
      }
      index = skipWhitespace(text, count.end);
    }
    if (text[index] === "[") {
      const defaultArg = extractBalanced(text, index, "[", "]");
      if (!defaultArg) {
        output += text[start];
        cursor = start + 1;
        continue;
      }
      index = skipWhitespace(text, defaultArg.end);
    }
    const beginBody = extractBalanced(text, index, "{", "}");
    if (!beginBody) {
      output += text[start];
      cursor = start + 1;
      continue;
    }
    index = skipWhitespace(text, beginBody.end);
    const endBody = extractBalanced(text, index, "{", "}");
    if (!endBody) {
      output += text[start];
      cursor = start + 1;
      continue;
    }
    cursor = endBody.end;
  }
  return output;
}

function stripTimelineSetupStatements(source) {
  return String(source)
    .replace(/\\newcounter\s*\{task\}\s*/g, "")
    .replace(/\\newlength\s*\\task(?:width|vsep)\s*/g, "")
    .replace(/\\setlength\s*\\task(?:width|vsep)\s*\{[^{}]*\}\s*/g, "")
    .replace(/\\setcounter\s*\{task\}\s*\{[^{}]*\}\s*/g, "")
    .replace(/\\stepcounter\s*\{task\}\s*/g, "")
    .replace(/\\vspace\s*\{[^{}]*\}\s*/g, "");
}

const CHRONOLOGY_LINEWIDTH_CM = 10;

function expandChronologyEnvironments(source, diagnostics) {
  const text = String(source);
  if (!text.includes("\\begin{chronology")) return text;

  const blocks = [];
  let cursor = 0;
  while (cursor < text.length) {
    const begin = findNextChronologyBegin(text, cursor);
    if (!begin) break;
    const parsed = parseChronologyEnvironment(text, begin, diagnostics);
    if (!parsed) {
      cursor = begin.index + begin.token.length;
      continue;
    }
    blocks.push(parsed.block);
    cursor = parsed.end;
  }

  if (!blocks.length) return text;
  const packageLines = [...text.matchAll(/\\usepackage(?:\[[^\]]*\])?\{[^{}]*\}/g)].map((match) => match[0]);
  const title = parseFirstFrameTitle(text);
  const includeCompareGrid = text.includes("tikzkit compare grid");
  return `${packageLines.join("\n")}\n${renderChronologyTikz(blocks, { title, includeCompareGrid })}`;
}

function findNextChronologyBegin(text, start) {
  const plain = "\\begin{chronology}";
  const starred = "\\begin{chronology*}";
  const plainIndex = text.indexOf(plain, start);
  const starredIndex = text.indexOf(starred, start);
  if (plainIndex === -1 && starredIndex === -1) return null;
  if (starredIndex !== -1 && (plainIndex === -1 || starredIndex < plainIndex)) {
    return { index: starredIndex, token: starred, endToken: "\\end{chronology*}", flipped: true };
  }
  return { index: plainIndex, token: plain, endToken: "\\end{chronology}", flipped: false };
}

function parseChronologyEnvironment(text, begin, diagnostics) {
  let index = begin.index + begin.token.length;
  const stepOptions = parseOptionalOptions(text, index);
  index = stepOptions.end;
  const start = extractRequiredChronologyGroup(text, index);
  if (!start) return null;
  index = start.end;
  const stop = extractRequiredChronologyGroup(text, index);
  if (!stop) return null;
  index = stop.end;
  const width = extractRequiredChronologyGroup(text, index);
  if (!width) return null;
  index = width.end;
  const unitGroup = extractRequiredChronologyGroup(text, index);
  let unitRaw = "";
  if (unitGroup) {
    unitRaw = unitGroup.content;
    index = unitGroup.end;
  } else {
    const unitOptions = parseOptionalOptions(text, index);
    unitRaw = unitOptions.raw || width.content;
    index = unitOptions.end;
  }

  const endIndex = text.indexOf(begin.endToken, index);
  if (endIndex === -1) {
    diagnostics.push({ severity: "warning", message: `Could not find ${begin.endToken} for chronology environment` });
    return null;
  }

  const yearStart = chronologyNumber(start.content, 0);
  const yearStop = chronologyNumber(stop.content, yearStart + 1);
  const widthCm = chronologyDimension(width.content, CHRONOLOGY_LINEWIDTH_CM * 0.9);
  const unitCm = chronologyDimension(unitRaw, parseDimension("1ex", {}));
  const step = Math.max(1, Math.round(chronologyNumber(stepOptions.raw || "5", 5)));
  return {
    block: {
      flipped: begin.flipped,
      step,
      yearStart,
      yearStop,
      widthCm,
      unitCm,
      events: parseChronologyEvents(text.slice(index, endIndex))
    },
    end: endIndex + begin.endToken.length
  };
}

function extractRequiredChronologyGroup(text, index) {
  const cursor = skipWhitespace(text, index);
  return extractBalanced(text, cursor, "{", "}");
}

function parseChronologyEvents(body) {
  const events = [];
  let cursor = 0;
  while (cursor < body.length) {
    const start = body.indexOf("\\event", cursor);
    if (start === -1) break;
    const nextChar = body[start + "\\event".length] || "";
    if (/[A-Za-z@]/.test(nextChar)) {
      cursor = start + "\\event".length;
      continue;
    }
    let index = start + "\\event".length;
    const optional = parseOptionalOptions(body, index);
    index = optional.end;
    const endDate = extractRequiredChronologyGroup(body, index);
    if (!endDate) {
      cursor = start + "\\event".length;
      continue;
    }
    index = endDate.end;
    const label = extractRequiredChronologyGroup(body, index);
    if (!label) {
      cursor = endDate.end;
      continue;
    }
    events.push({
      startYear: optional.raw ? chronologyNumber(optional.raw, null) : null,
      endYear: chronologyNumber(endDate.content, 0),
      label: normalizeChronologyLabel(label.content)
    });
    cursor = label.end;
  }
  return events;
}

function parseFirstFrameTitle(text) {
  const start = text.indexOf("\\begin{frame}");
  if (start === -1) return "";
  let index = start + "\\begin{frame}".length;
  index = parseOptionalOptions(text, index).end;
  index = skipWhitespace(text, index);
  const title = extractBalanced(text, index, "{", "}");
  return title ? normalizeChronologyLabel(title.content) : "";
}

function renderChronologyTikz(blocks, options = {}) {
  const width = Math.max(...blocks.map((block) => block.widthCm), 7);
  const pageWidth = Math.max(12.8, width + 3.4);
  const pageTop = 4.65;
  const pageBottom = -4.65;
  const left = Math.max(1.1, (pageWidth - width) / 2);
  const right = left + width;
  const title = options.title || "";
  const lineSpacing = 2.55;
  const firstLineY = blocks.length > 1 ? 1.25 : 0.25;
  const titleTop = pageTop - 0.05;
  const titleBottom = titleTop - 0.7;
  const commands = ["\\begin{tikzpicture}[x=1cm,y=1cm]"];

  commands.push(`\\path[draw=none,fill=white,opacity=0] (0,${roundTikzNumber(pageBottom)}) rectangle (${roundTikzNumber(pageWidth)},${roundTikzNumber(pageTop)});`);
  if (title) {
    commands.push(`\\path[fill=#1f3333,draw=none] (0.2,${roundTikzNumber(titleBottom)}) rectangle (${roundTikzNumber(pageWidth - 0.2)},${roundTikzNumber(titleTop)});`);
    commands.push(
      `\\node[anchor=west,text=white,font=\\bfseries\\sffamily\\small] at (0.45,${roundTikzNumber((titleBottom + titleTop) / 2)}) {${title}};`
    );
  }

  blocks.forEach((block, blockIndex) => {
    const y = firstLineY - blockIndex * lineSpacing;
    commands.push(...renderChronologyBlock(block, { left, right, y }));
  });
  commands.push(`\\node[anchor=south east,font=\\tiny] at (${roundTikzNumber(pageWidth - 0.25)},${roundTikzNumber(pageBottom + 0.28)}) {1};`);
  if (options.includeCompareGrid) commands.push(timelineDebugGridScope());
  commands.push("\\end{tikzpicture}");
  return commands.join("\n");
}

function renderChronologyBlock(block, geometry) {
  const { left, right, y } = geometry;
  const unit = Math.max(0.06, block.unitCm || parseDimension("1ex", {}));
  const delta = Math.max(1, block.yearStop - block.yearStart + 1);
  const commands = [];
  commands.push(`\\draw[->] (${roundTikzNumber(left)},${roundTikzNumber(y)}) -- (${roundTikzNumber(right)},${roundTikzNumber(y)});`);
  commands.push(`\\draw (${roundTikzNumber(left)},${roundTikzNumber(y - unit * 0.65)}) -- (${roundTikzNumber(left)},${roundTikzNumber(y + unit * 0.65)});`);

  const firstTick = chronologyFirstTick(block.yearStart, block.step);
  const lastTick = block.yearStop - positiveModulo(block.yearStop, block.step);
  for (let year = firstTick; year <= lastTick; year += block.step) {
    const x = chronologyX(year, block, left, delta);
    commands.push(`\\draw (${roundTikzNumber(x)},${roundTikzNumber(y - unit)}) -- (${roundTikzNumber(x)},${roundTikzNumber(y + unit)});`);
    const labelAnchor = block.flipped ? "south" : "north";
    const labelY = block.flipped ? y + unit * 1.65 : y - unit * 1.65;
    commands.push(`\\node[anchor=${labelAnchor},font=\\tiny] at (${roundTikzNumber(x)},${roundTikzNumber(labelY)}) {${Math.round(year)}};`);
  }

  for (const event of block.events) {
    const endX = chronologyX(event.endYear, block, left, delta);
    if (Number.isFinite(event.startYear)) {
      const startX = chronologyX(event.startYear, block, left, delta);
      const radius = unit * 0.7;
      commands.push(
        `\\path[fill=black,draw=none,opacity=0.5,rounded corners=${roundTikzNumber(radius)}cm] ` +
          `(${roundTikzNumber(startX)},${roundTikzNumber(y - radius)}) rectangle (${roundTikzNumber(endX)},${roundTikzNumber(y + radius)});`
      );
      if (event.label) commands.push(renderChronologyEventLabel(event.label, startX, y, unit, block.flipped));
      continue;
    }
    commands.push(`\\path[fill=black,draw=none,opacity=0.5] (${roundTikzNumber(endX)},${roundTikzNumber(y)}) circle (${roundTikzNumber(unit * 0.7)}cm);`);
    if (event.label) commands.push(renderChronologyEventLabel(event.label, endX, y, unit, block.flipped));
  }
  return commands;
}

function renderChronologyEventLabel(label, x, y, unit, flipped) {
  const anchor = flipped ? "north west" : "south west";
  const rotate = flipped ? -45 : 45;
  const labelY = flipped ? y - unit * 0.75 : y + unit * 0.75;
  return `\\node[anchor=${anchor},rotate=${rotate},font=\\scriptsize] at (${roundTikzNumber(x)},${roundTikzNumber(labelY)}) {${label}};`;
}

function chronologyX(year, block, left, delta) {
  return left + ((year - block.yearStart) / delta) * block.widthCm;
}

function chronologyFirstTick(yearStart, step) {
  const remainder = positiveModulo(yearStart, step);
  return remainder === 0 ? yearStart : yearStart - remainder;
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function chronologyDimension(raw, fallback) {
  const text = String(raw || "").trim();
  if (!text) return fallback;
  const lineWidth = text.match(/^([+-]?(?:\d+\.?\d*|\.\d+))?\s*\\(?:line|text)width$/);
  if (lineWidth) {
    const factor = lineWidth[1] === undefined || lineWidth[1] === "" ? 1 : Number(lineWidth[1]);
    return Number.isFinite(factor) ? Math.max(0.1, factor * CHRONOLOGY_LINEWIDTH_CM) : fallback;
  }
  const parsed = parseDimension(text, {});
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function chronologyNumber(raw, fallback) {
  const expanded = expandChronologyDecimalDates(raw);
  const value = evaluateMath(expanded, {});
  return Number.isFinite(value) ? value : fallback;
}

function expandChronologyDecimalDates(raw) {
  const text = String(raw || "").trim();
  let output = "";
  let index = 0;
  while (index < text.length) {
    if (!text.startsWith("\\decimaldate", index)) {
      output += text[index];
      index += 1;
      continue;
    }
    let cursor = index + "\\decimaldate".length;
    const args = [];
    for (let argIndex = 0; argIndex < 3; argIndex += 1) {
      cursor = skipWhitespace(text, cursor);
      const group = extractBalanced(text, cursor, "{", "}");
      if (!group) break;
      args.push(group.content.trim() || "0");
      cursor = group.end;
    }
    if (args.length !== 3) {
      output += "\\decimaldate";
      index += "\\decimaldate".length;
      continue;
    }
    const [day, month, year] = args;
    output += `((${day})-1)/31/12+((${month})-1)/12+(${year})`;
    index = cursor;
  }
  return output || "0";
}

function normalizeChronologyLabel(text) {
  return String(text || "")
    .replace(/\\(?:small|scriptsize|footnotesize|tiny|normalsize|large|Large)\b/g, "")
    .replace(/\\emph\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\textbf\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\\\/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expandEventPeriodTimelineMacros(source, diagnostics) {
  const text = String(source);
  if (!text.includes("\\drawtimeline") || (!text.includes("\\period") && !text.includes("\\vevent"))) return text;

  let output = "";
  let cursor = 0;
  const begin = "\\begin{tikzpicture}";
  const end = "\\end{tikzpicture}";
  while (cursor < text.length) {
    const beginIndex = text.indexOf(begin, cursor);
    if (beginIndex === -1) {
      output += text.slice(cursor);
      break;
    }
    output += text.slice(cursor, beginIndex + begin.length);
    const bodyStart = beginIndex + begin.length;
    const endIndex = findMatchingEnvironmentEnd(text, bodyStart, begin, end);
    if (endIndex === -1) {
      output += text.slice(bodyStart);
      cursor = text.length;
      break;
    }
    output += expandEventPeriodTimelineBody(text.slice(bodyStart, endIndex), diagnostics);
    output += end;
    cursor = endIndex + end.length;
  }

  return stripEventPeriodTimelineDefinitions(output);
}

function expandEventPeriodTimelineBody(body, diagnostics) {
  let output = "";
  let cursor = 0;
  let state = null;
  let eventIndex = 0;
  while (cursor < body.length) {
    const next = nextEventPeriodTimelineCommand(body, cursor);
    if (!next) {
      output += body.slice(cursor);
      break;
    }
    output += body.slice(cursor, next.index);
    if (next.name === "drawtimeline") {
      const parsed = parseDrawTimelineInvocation(body, next.index);
      if (!parsed) {
        diagnostics.push({ severity: "warning", message: "Could not parse custom \\drawtimeline command" });
        output += body.slice(next.index, next.index + "\\drawtimeline".length);
        cursor = next.index + "\\drawtimeline".length;
        continue;
      }
      state = createEventPeriodTimelineState(parsed);
      output += renderEventPeriodTimelineBase(state);
      cursor = parsed.end;
      continue;
    }
    if (next.name === "period") {
      const parsed = parseFixedRequiredCommand(body, next.index, "\\period", 5);
      if (!parsed || !state) {
        output += body.slice(next.index, next.index + "\\period".length);
        cursor = next.index + "\\period".length;
        continue;
      }
      output += renderEventPeriodTimelinePeriod(parsed.args, state);
      cursor = parsed.end;
      continue;
    }
    if (next.name === "vevent") {
      const parsed = parseFixedRequiredCommand(body, next.index, "\\vevent", 7);
      if (!parsed || !state) {
        output += body.slice(next.index, next.index + "\\vevent".length);
        cursor = next.index + "\\vevent".length;
        continue;
      }
      eventIndex += 1;
      output += renderEventPeriodTimelineEvent(parsed.args, state, eventIndex);
      cursor = parsed.end;
      continue;
    }
  }
  return output;
}

function nextEventPeriodTimelineCommand(text, start) {
  const commands = ["drawtimeline", "period", "vevent"];
  let best = null;
  for (const name of commands) {
    let index = String(text).indexOf(`\\${name}`, start);
    while (index !== -1) {
      const before = text[index - 1] || "";
      const after = text[index + name.length + 1] || "";
      if (before !== "\\" && !/[A-Za-z@]/.test(after)) {
        if (!best || index < best.index) best = { name, index };
        break;
      }
      index = String(text).indexOf(`\\${name}`, index + name.length + 1);
    }
  }
  return best;
}

function parseDrawTimelineInvocation(source, start) {
  let cursor = start + "\\drawtimeline".length;
  const options = parseOptionalOptions(source, cursor);
  cursor = options.end;
  const args = [];
  for (let index = 0; index < 4; index += 1) {
    cursor = skipWhitespace(source, cursor);
    const arg = extractBalanced(source, cursor, "{", "}");
    if (!arg) return null;
    args.push(arg.content.trim());
    cursor = arg.end;
  }
  if (source[cursor] === ";") cursor += 1;
  return { options: options.raw, args, end: cursor };
}

function parseFixedRequiredCommand(source, start, command, count) {
  let cursor = start + command.length;
  const args = [];
  for (let index = 0; index < count; index += 1) {
    cursor = skipWhitespace(source, cursor);
    const arg = extractBalanced(source, cursor, "{", "}");
    if (!arg) return null;
    args.push(arg.content);
    cursor = arg.end;
  }
  return { args, end: cursor };
}

function createEventPeriodTimelineState(parsed) {
  const [fromYearRaw, toYearRaw, sizeRaw, widthRaw] = parsed.args;
  const fromYear = Math.round(eventPeriodTimelineNumber(fromYearRaw, 0));
  const toYear = Math.max(fromYear + 1, Math.round(eventPeriodTimelineNumber(toYearRaw, fromYear + 1)));
  const size = finitePositiveDimension(sizeRaw, 10);
  const width = finitePositiveDimension(widthRaw, 0.5);
  const options = parseOptions(parsed.options || "");
  const yearStep = Math.max(1, eventPeriodTimelineNumber(options["year tick step"], 1));
  const minorStep = Math.max(1 / 12, eventPeriodTimelineNumber(options["minor tick step"], 0.25));
  const yearLabelStep = Math.max(1, eventPeriodTimelineNumber(options["labeled years step"], 1));
  const enlarge = Math.max(0, parseDimension(String(options["enlarge timeline"] || "0cm"), {}));
  const yearSpan = Math.max(1, toYear - fromYear);
  return {
    fromYear,
    toYear,
    size,
    width,
    halfWidth: width / 2,
    yearStep,
    minorStep,
    yearLabelStep,
    enlarge,
    yearUnit: size / yearSpan,
    tickSize: Math.max(parseDimension("5pt", {}), width * 0.09),
    minorTickSize: Math.max(parseDimension("3pt", {}), width * 0.08)
  };
}

function eventPeriodTimelineNumber(raw, fallback) {
  const value = evaluateMath(String(raw ?? ""), {});
  return Number.isFinite(value) ? value : fallback;
}

function renderEventPeriodTimelineBase(state) {
  const commands = [];
  const lastMonth = (state.toYear - state.fromYear) * 12;
  for (let month = 0; month <= lastMonth; month += 1) {
    const year = state.fromYear + Math.floor(month / 12);
    const monthInYear = month % 12;
    const x = eventPeriodTimelineX(`${year}-${monthInYear}`, state);
    commands.push(`\\coordinate (Y-${year}-${monthInYear}) at (${roundTikzNumber(x)},0);`);
    if (monthInYear === 0) commands.push(`\\coordinate (Y-${year}) at (${roundTikzNumber(x)},0);`);
  }

  commands.push(
    `\\path[fill=gray,draw=none] (${roundTikzNumber(-state.enlarge)},${roundTikzNumber(-state.halfWidth)}) rectangle (${roundTikzNumber(
      state.size + state.enlarge
    )},${roundTikzNumber(state.halfWidth)});`
  );

  for (let year = state.fromYear; year <= state.toYear; year += state.yearStep) {
    const x = eventPeriodTimelineX(`${year}-0`, state);
    const half = state.tickSize / 2;
    commands.push(`\\draw[draw=gray,line width=0.03cm] (${roundTikzNumber(x)},${roundTikzNumber(-half)}) -- (${roundTikzNumber(x)},${roundTikzNumber(half)});`);
  }

  const minorStepMonths = Math.max(1, Math.round(state.minorStep * 12));
  for (let month = 0; month <= lastMonth; month += minorStepMonths) {
    const x = (month / 12) * state.yearUnit;
    const centerY = -state.halfWidth;
    const half = state.minorTickSize / 2;
    commands.push(
      `\\draw[draw=lightgray,line width=0.1054cm] (${roundTikzNumber(x)},${roundTikzNumber(centerY - half)}) -- (${roundTikzNumber(
        x
      )},${roundTikzNumber(centerY + half)});`
    );
  }
  return commands.join("\n");
}

function renderEventPeriodTimelinePeriod(args, state) {
  const [colorRaw, startRaw, endRaw, labelRaw, optionsRaw] = args;
  const startX = eventPeriodTimelineX(startRaw, state);
  const endX = eventPeriodTimelineX(endRaw, state);
  const left = Math.min(startX, endX);
  const right = Math.max(startX, endX);
  const color = String(colorRaw || "gray").trim() || "gray";
  const label = normalizeEventPeriodTimelineLabel(labelRaw);
  const options = parseOptions(optionsRaw || "");
  const nodeOptions = [
    "text=white",
    "align=center",
    "font=\\Huge\\sffamily\\bfseries",
    "inner sep=0"
  ];
  if (options.text) nodeOptions.push(`text=${options.text}`);
  if (options.font) nodeOptions.push(`font=${options.font}`);
  return [
    `\\path[fill=${color},draw=none] (${roundTikzNumber(left)},${roundTikzNumber(-state.halfWidth)}) rectangle (${roundTikzNumber(
      right
    )},${roundTikzNumber(state.halfWidth)});`,
    `\\node[${joinTikzOptions(nodeOptions)}] at (${roundTikzNumber((left + right) / 2)},0) {${label}};`
  ].join("\n");
}

function renderEventPeriodTimelineEvent(args, state, eventIndex) {
  const [formatRaw, startRaw, pinRaw, branchRaw, nodeOptionsRaw, nameRaw, labelRaw] = args;
  const base = { x: eventPeriodTimelineX(startRaw, state), y: 0 };
  const pin = eventPeriodTimelinePolar(pinRaw);
  const branch = eventPeriodTimelinePolar(branchRaw);
  const elbow = { x: base.x + pin.x, y: base.y + pin.y };
  const end = { x: elbow.x + branch.x, y: elbow.y + branch.y };
  const color = String(formatRaw || "red").trim() || "red";
  const label = normalizeEventPeriodTimelineLabel(labelRaw);
  const nodeOptions = parseOptions(nodeOptionsRaw || "");
  const width = eventPeriodTimelineEventBoxWidth(nodeOptionsRaw) || "3cm";
  const anchor = String(nodeOptions.anchor || "west").trim();
  const nodeName = sanitizeEventPeriodTimelineNodeName(nameRaw, eventIndex);
  const drawStyle = `draw=${color},thick,line cap=round,line join=round`;
  const boxStyle = joinTikzOptions([
    "rectangle",
    "rounded corners=3pt",
    "inner sep=3pt",
    "fill=none",
    `draw=${color}`,
    `text width=${width}`,
    `anchor=${anchor}`,
    "text=black",
    "align=left",
    "font=\\large"
  ]);
  return [
    `\\draw[${drawStyle}] (${roundTikzNumber(base.x)},${roundTikzNumber(base.y)}) -- (${roundTikzNumber(elbow.x)},${roundTikzNumber(
      elbow.y
    )}) -- (${roundTikzNumber(end.x)},${roundTikzNumber(end.y)});`,
    `\\node[${boxStyle}] (${nodeName}) at (${roundTikzNumber(end.x)},${roundTikzNumber(end.y)}) {${label}};`
  ].join("\n");
}

function eventPeriodTimelineX(raw, state) {
  const text = String(raw || "").trim().replace(/^Y-/, "");
  const match = text.match(/^([+-]?\d+)(?:-([+-]?\d+(?:\.\d+)?))?$/);
  if (!match) return 0;
  const year = Number(match[1]);
  const month = Number(match[2] || 0);
  return ((year - state.fromYear) + month / 12) * state.yearUnit;
}

function eventPeriodTimelinePolar(raw) {
  const text = String(raw || "").trim();
  const match = text.match(/^([+-]?(?:\d+\.?\d*|\.\d+))\s*:\s*([\s\S]+)$/);
  if (!match) return { x: 0, y: 0 };
  const angle = (Number(match[1]) * Math.PI) / 180;
  const radius = parseDimension(match[2], {});
  if (!Number.isFinite(radius)) return { x: 0, y: 0 };
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

function eventPeriodTimelineEventBoxWidth(rawOptions) {
  const match = String(rawOptions || "").match(/eventbox[ab]\s*=\s*([^,\]]+)/);
  return match ? match[1].trim() : "";
}

function sanitizeEventPeriodTimelineNodeName(rawName, index) {
  const text = String(rawName || "").trim().replace(/[^A-Za-z0-9_-]/g, "");
  return text ? `${text}-${index}` : `timeline-event-${index}`;
}

function normalizeEventPeriodTimelineLabel(raw) {
  return String(raw || "")
    .replace(/\\begin\s*\{tabular\}\s*\{[^{}]*\}/g, "")
    .replace(/\\end\s*\{tabular\}/g, "")
    .replace(/\\(?:Huge|huge|Large|large|small|scriptsize|footnotesize|tiny|sffamily|bfseries)\b/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*\\\\\s*/g, "\\\\")
    .trim();
}

function stripEventPeriodTimelineDefinitions(source) {
  const names = new Set(["drawtimeline", "period", "vevent"]);
  let output = "";
  let index = 0;
  while (index < source.length) {
    const parsed = parseNamedNewCommandDefinition(source, index, names);
    if (parsed) {
      index = parsed.end;
      continue;
    }
    output += source[index];
    index += 1;
  }
  return output;
}

function parseNamedNewCommandDefinition(source, start, names) {
  if (!source.startsWith("\\newcommand", start) && !source.startsWith("\\renewcommand", start)) return null;
  const command = source.startsWith("\\renewcommand", start) ? "\\renewcommand" : "\\newcommand";
  let cursor = start + command.length;
  if (source[cursor] === "*") cursor += 1;
  cursor = skipWhitespace(source, cursor);
  let name = "";
  if (source[cursor] === "{") {
    const wrapped = extractBalanced(source, cursor, "{", "}");
    if (!wrapped) return null;
    name = wrapped.content.trim().replace(/^\\/, "");
    cursor = wrapped.end;
  } else if (source[cursor] === "\\") {
    const parsedName = readCommandName(source, cursor + 1);
    if (!parsedName) return null;
    name = parsedName.value;
    cursor = parsedName.end;
  }
  if (!names.has(name)) return null;
  cursor = skipWhitespace(source, cursor);
  if (source[cursor] === "[") {
    const count = extractBalanced(source, cursor, "[", "]");
    if (!count) return null;
    cursor = skipWhitespace(source, count.end);
  }
  if (source[cursor] === "[") {
    const defaultArg = extractBalanced(source, cursor, "[", "]");
    if (!defaultArg) return null;
    cursor = skipWhitespace(source, defaultArg.end);
  }
  const body = extractBalanced(source, cursor, "{", "}");
  if (!body) return null;
  return { end: body.end };
}

function createPgfplotsStyleContext(source, pgfplotsSetOptions = {}) {
  const tikzsetOptions = collectTikzsetPgfplotsOptions(source);
  const legacyTikzstyleOptions = collectLegacyTikzstylePgfplotsOptions(source);
  const tikzpictureOptions = collectTikzpicturePgfplotsOptions(source);
  const styleOptions = mergeOptionMaps(
    mergeOptionMaps(mergeOptionMaps(pgfplotsSetOptions, tikzsetOptions), legacyTikzstyleOptions),
    tikzpictureOptions
  );
  return {
    pgfplotsStyleOptions: styleOptions,
    pgfplotsStyleDefinitions: styleDefinitionsFromOptions(styleOptions),
    pgfplotsDeclareFunctions: [
      ...optionValues(styleOptions["declare function"]),
      ...collectPgfmathDeclaredFunctions(source)
    ]
  };
}

function collectLegacyTikzstylePgfplotsOptions(source) {
  const options = {};
  let index = 0;
  const command = "\\tikzstyle";
  while (index < source.length) {
    const start = source.indexOf(command, index);
    if (start === -1) break;
    let cursor = skipWhitespace(source, start + command.length);
    const name = extractBalanced(source, cursor, "{", "}");
    if (!name) {
      index = start + command.length;
      continue;
    }
    cursor = skipWhitespace(source, name.end);
    if (source[cursor] !== "=") {
      index = name.end;
      continue;
    }
    cursor = skipWhitespace(source, cursor + 1);
    const body = extractBalanced(source, cursor, "[", "]");
    if (!body) {
      index = cursor;
      continue;
    }
    const styleName = name.content.trim();
    if (styleName) options[`${styleName}/.style`] = body.content;
    index = body.end;
  }
  return options;
}

function collectPgfmathDeclaredFunctions(source) {
  const declarations = [];
  let index = 0;
  const command = "\\pgfmathdeclarefunction";
  while (index < source.length) {
    const start = source.indexOf(command, index);
    if (start === -1) break;
    let cursor = skipWhitespace(source, start + command.length);
    const name = extractBalanced(source, cursor, "{", "}");
    if (!name) {
      index = start + command.length;
      continue;
    }
    cursor = skipWhitespace(source, name.end);
    const arity = extractBalanced(source, cursor, "{", "}");
    if (!arity) {
      index = name.end;
      continue;
    }
    cursor = skipWhitespace(source, arity.end);
    const implementation = extractBalanced(source, cursor, "{", "}");
    if (!implementation) {
      index = arity.end;
      continue;
    }
    const expression = pgfmathParseExpression(implementation.content);
    const count = Math.max(0, Math.trunc(Number(arity.content.trim())) || 0);
    const functionName = name.content.trim().replace(/^\\/, "");
    if (functionName && expression) {
      const params = Array.from({ length: count }, (_entry, offset) => `\\tikzkitarg${offset + 1}`);
      const body = expression.replace(/#(\d+)/g, (_match, argument) => `\\tikzkitarg${argument}`);
      declarations.push(`${functionName}(${params.join(",")})=${body}`);
    }
    index = implementation.end;
  }
  return declarations;
}

function pgfmathParseExpression(source) {
  const command = "\\pgfmathparse";
  const start = source.indexOf(command);
  if (start === -1) return "";
  const body = extractBalanced(source, skipWhitespace(source, start + command.length), "{", "}");
  return body?.content.trim() || "";
}

function collectTikzsetPgfplotsOptions(source) {
  let options = {};
  let index = 0;
  while (index < source.length) {
    const start = source.indexOf("\\tikzset", index);
    if (start === -1) break;
    let cursor = skipWhitespace(source, start + "\\tikzset".length);
    const body = extractBalanced(source, cursor, "{", "}");
    if (!body) {
      index = start + "\\tikzset".length;
      continue;
    }
    options = mergeOptionMaps(options, parseOptions(body.content));
    index = body.end;
  }
  return options;
}

function collectTikzpicturePgfplotsOptions(source) {
  let options = {};
  let index = 0;
  const begin = "\\begin{tikzpicture}";
  while (index < source.length) {
    const start = source.indexOf(begin, index);
    if (start === -1) break;
    let cursor = skipWhitespace(source, start + begin.length);
    if (source[cursor] !== "[") {
      index = start + begin.length;
      continue;
    }
    const body = extractBalanced(source, cursor, "[", "]");
    if (!body) {
      index = start + begin.length;
      continue;
    }
    options = mergeOptionMaps(options, pgfplotsPictureStyleOptions(parseOptions(body.content)));
    index = body.end;
  }
  return options;
}

function pgfplotsPictureStyleOptions(options = {}) {
  const result = { ...options };
  // A tikzpicture transform applies around the lowered axis. Passing it into
  // PGFPlots as an axis default also scales the generated geometry, so a
  // picture such as [scale=.5] is applied twice. Keep picture-level style
  // declarations, but leave all geometric transforms to the TikZ evaluator.
  for (const key of [
    "scale",
    "xscale",
    "yscale",
    "xslant",
    "yslant",
    "rotate",
    "rotate around",
    "scale around",
    "shift",
    "xshift",
    "yshift",
    "transform canvas",
    "transform shape",
    "x",
    "y"
  ]) {
    delete result[key];
  }
  return result;
}

function mergeOptionMaps(target = {}, source = {}) {
  const merged = { ...target };
  for (const [key, value] of Object.entries(source || {})) {
    if ((key === "declare function" || key === "label in data" || key === "pin in data") && Object.hasOwn(merged, key)) {
      merged[key] = [...optionValues(merged[key]), ...optionValues(value)];
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

function optionValues(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function stripTexDocumentShell(source) {
  return String(source)
    .replace(/\\documentclass(?:\[[^\]]*\])?\{[^{}]*\}\s*/g, "")
    .replace(/\\usepackage(?:\[[^\]]*\])?\{[^{}]*\}\s*/g, "")
    .replace(/\\begin\{document\}\s*/g, "")
    .replace(/\\end\{document\}\s*/g, "")
    .replace(/\\(?:begin|end)\s*\{\s*(?:figure|center)\s*\}(?:\[[^\]]*\])?\s*/g, "");
}

function selectFirstBeamerFrame(source) {
  const text = String(source || "");
  const begin = /\\begin\s*\{\s*frame\s*\}/g.exec(text);
  if (!begin) return text;

  let contentStart = skipWhitespace(text, begin.index + begin[0].length);
  while (text[contentStart] === "<") {
    const end = text.indexOf(">", contentStart + 1);
    if (end === -1) return text;
    contentStart = skipWhitespace(text, end + 1);
  }
  if (text[contentStart] === "[") {
    const options = extractBalanced(text, contentStart, "[", "]");
    if (!options) return text;
    contentStart = skipWhitespace(text, options.end);
  }
  if (text[contentStart] === "{") {
    const title = extractBalanced(text, contentStart, "{", "}");
    if (!title) return text;
    contentStart = skipWhitespace(text, title.end);
  }

  const endPattern = /\\end\s*\{\s*frame\s*\}/g;
  endPattern.lastIndex = contentStart;
  const end = endPattern.exec(text);
  if (!end) return text;

  // The browser renderer produces one SVG. Match the native PDF-to-PNG path,
  // which uses the first Beamer page instead of merging every frame together.
  return `${text.slice(0, begin.index)}\n${text.slice(contentStart, end.index)}`;
}

function normalizeTikzPictureAliases(source) {
  return String(source)
    .replace(/\\begin\{circuitikz\}/g, "\\begin{tikzpicture}")
    .replace(/\\end\{circuitikz\}/g, "\\end{tikzpicture}");
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
    if (source.startsWith("\\colorlet", index)) {
      const parsed = parseColorlet(source, index, colors);
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

function parseColorlet(source, start, colors) {
  let index = start + "\\colorlet".length;
  index = skipWhitespace(source, index);
  if (source[index] === "[") {
    const className = extractBalanced(source, index, "[", "]");
    if (!className) return null;
    index = skipWhitespace(source, className.end);
  }
  const name = extractBalanced(source, index, "{", "}");
  if (!name) return null;
  index = skipWhitespace(source, name.end);
  if (source[index] === "[") {
    const targetModel = extractBalanced(source, index, "[", "]");
    if (!targetModel) return null;
    index = skipWhitespace(source, targetModel.end);
  }
  const color = extractBalanced(source, index, "{", "}");
  if (!color) return null;
  const expression = replaceColorNames(color.content.trim(), colors);
  return {
    name: name.content.trim(),
    css: normalizeColor(expression),
    end: color.end
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
  if (colorModel === "cmyk") {
    const channels = splitTopLevel(value, ",").map((part) => Number(part.trim()));
    if (channels.length !== 4 || channels.some((channel) => !Number.isFinite(channel))) return null;
    const scale = rawModel === "CMYK" ? 255 : 1;
    return cmykToCss(channels.map((channel) => Math.max(0, Math.min(scale, channel)) / scale));
  }
  return null;
}

function replaceDefinedColorUses(source, colors) {
  if (!colors.size) return source;
  let output = "";
  let index = 0;
  while (index < source.length) {
    if (source.startsWith("\\tikzset", index) || source.startsWith("\\ctikzset", index)) {
      const command = source.startsWith("\\ctikzset", index) ? "\\ctikzset" : "\\tikzset";
      const bodyStart = skipWhitespace(source, index + command.length);
      const body = extractBalanced(source, bodyStart, "{", "}");
      if (body) {
        output += `${command}{${replaceColorNames(body.content, colors)}}`;
        index = body.end;
        continue;
      }
    }
    if (source.startsWith("\\textcolor", index)) {
      const replaced = replaceTextColorName(source, index, colors);
      if (replaced) {
        output += replaced.text;
        index = replaced.end;
        continue;
      }
    }
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
  // Claude: 上面的逻辑只覆盖 \textcolor{} 和 [..] 选项里的颜色名。但数学块里还会以
  // \color{name} 或作为宏参数的裸花括号 {name}（如 \overmat{..}{..}{echodrk}）出现，
  // 这些若不替换，KaTeX 虽不报错但会用错颜色。这里对每个 \definecolor 定义的色名做一次
  // 精确的 {name} -> {hex} 替换（这些自定义名唯一，不会误伤标准色或普通文本）。
  return replaceBracedDefinedColors(output, colors);
}

function replaceBracedDefinedColors(source, colors) {
  let output = source;
  for (const [name, css] of colors) {
    const pattern = new RegExp(`\\{\\s*${escapeRegExp(name)}\\s*\\}`, "g");
    output = output.replace(pattern, `{${css}}`);
  }
  return output;
}

function replaceTextColorName(source, start, colors) {
  let index = start + "\\textcolor".length;
  index = skipWhitespace(source, index);
  const color = extractBalanced(source, index, "{", "}");
  if (!color) return null;
  const name = color.content.trim();
  const replacement = colors.get(name);
  if (!replacement) return null;
  return {
    text: `${source.slice(start, color.start)}{${replacement}}`,
    end: color.end
  };
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

export function expandTexLiteEnvironments(source, diagnostics = [], options = {}) {
  const environments = new Map();
  let expanded = collectEnvironmentDefinitions(String(source || ""), environments, diagnostics);
  const maxPasses = options.environmentExpansionPasses || options.macroExpansionPasses || 12;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const next = expandEnvironmentPass(expanded, environments, diagnostics);
    if (next === expanded) break;
    expanded = next;
  }
  return expanded;
}

function collectEnvironmentDefinitions(source, environments, diagnostics) {
  let output = "";
  let index = 0;
  while (index < source.length) {
    const isDefinition =
      source.startsWith("\\newenvironment", index) || source.startsWith("\\renewenvironment", index);
    if (!isDefinition) {
      output += source[index];
      index += 1;
      continue;
    }
    const parsed = parseEnvironmentDefinition(source, index);
    if (!parsed) {
      diagnostics.push({ severity: "warning", message: `Could not parse TeX environment near offset ${index}` });
      output += source[index];
      index += 1;
      continue;
    }
    environments.set(parsed.name, parsed.environment);
    index = parsed.end;
  }
  return output;
}

function parseEnvironmentDefinition(source, start) {
  const command = source.startsWith("\\renewenvironment", start) ? "\\renewenvironment" : "\\newenvironment";
  let index = start + command.length;
  if (source[index] === "*") index += 1;
  index = skipWhitespace(source, index);
  const nameArg = extractBalanced(source, index, "{", "}");
  if (!nameArg) return null;
  const name = nameArg.content.trim();
  if (!name) return null;
  index = skipWhitespace(source, nameArg.end);

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
    if (!defaultArg) return null;
    defaults[0] = defaultArg.content;
    index = skipWhitespace(source, defaultArg.end);
  }

  const beginBody = extractBalanced(source, index, "{", "}");
  if (!beginBody) return null;
  index = skipWhitespace(source, beginBody.end);
  const endBody = extractBalanced(source, index, "{", "}");
  if (!endBody) return null;
  const usedArgCount = Math.max(
    countReferencedMacroArguments(beginBody.content),
    countReferencedMacroArguments(endBody.content)
  );
  if (usedArgCount === 0) argCount = 0;
  return {
    name,
    environment: {
      name,
      argCount: Math.max(argCount, usedArgCount),
      defaults,
      beginBody: beginBody.content,
      endBody: endBody.content
    },
    end: endBody.end
  };
}

function expandEnvironmentPass(source, environments, diagnostics) {
  if (!environments.size) return source;
  let output = "";
  let index = 0;
  while (index < source.length) {
    const beginIndex = source.indexOf("\\begin{", index);
    if (beginIndex === -1) {
      output += source.slice(index);
      break;
    }
    output += source.slice(index, beginIndex);
    const nameArg = extractBalanced(source, beginIndex + "\\begin".length, "{", "}");
    const environment = nameArg ? environments.get(nameArg.content.trim()) : null;
    if (!nameArg || !environment) {
      output += source.slice(beginIndex, nameArg?.end || beginIndex + "\\begin".length);
      index = nameArg?.end || beginIndex + "\\begin".length;
      continue;
    }

    const invocation = parseEnvironmentInvocationArguments(source, nameArg.end, environment);
    if (!invocation) {
      diagnostics.push({ severity: "warning", message: `Could not parse ${environment.name} environment arguments` });
      output += source.slice(beginIndex, nameArg.end);
      index = nameArg.end;
      continue;
    }
    const beginToken = `\\begin{${environment.name}}`;
    const endToken = `\\end{${environment.name}}`;
    const endIndex = findMatchingEnvironmentEnd(source, invocation.end, beginToken, endToken);
    if (endIndex === -1) {
      diagnostics.push({ severity: "warning", message: `Unclosed ${environment.name} environment` });
      output += source.slice(beginIndex);
      break;
    }
    const inner = source.slice(invocation.end, endIndex);
    output += applyMacroBody(environment.beginBody, invocation.args);
    output += inner;
    output += applyMacroBody(environment.endBody, invocation.args);
    index = endIndex + endToken.length;
  }
  return output;
}

function parseEnvironmentInvocationArguments(source, start, environment) {
  let cursor = start;
  const args = [];
  for (let argIndex = 0; argIndex < environment.argCount; argIndex += 1) {
    cursor = skipWhitespace(source, cursor);
    if (environment.defaults?.[argIndex] !== undefined) {
      if (source[cursor] === "[") {
        const optional = extractBalanced(source, cursor, "[", "]");
        if (!optional) return null;
        args.push(optional.content);
        cursor = optional.end;
      } else {
        args.push(environment.defaults[argIndex]);
      }
      continue;
    }
    const required = extractBalanced(source, cursor, "{", "}");
    if (!required) return null;
    args.push(required.content);
    cursor = required.end;
  }
  return { args, end: cursor };
}

function expandTexNewifConditionals(source) {
  return expandTexNewifConditionalsWithState(String(source || ""), new Map());
}

function expandTexNewifConditionalsWithState(source, states) {
  let output = "";
  let index = 0;
  while (index < source.length) {
    if (source.startsWith("\\newif", index)) {
      const parsed = parseNewifDeclaration(source, index);
      if (parsed) {
        states.set(parsed.name, false);
        index = parsed.end;
        continue;
      }
    }
    const assignment = parseNewifAssignment(source, index, states);
    if (assignment) {
      states.set(assignment.name, assignment.value);
      index = assignment.end;
      continue;
    }
    const conditional = parseNewifConditional(source, index, states);
    if (conditional) {
      const selected = conditional.value ? conditional.thenSource : conditional.elseSource;
      output += expandTexNewifConditionalsWithState(selected, states);
      index = conditional.end;
      continue;
    }
    output += source[index];
    index += 1;
  }
  return output;
}

function parseNewifDeclaration(source, start) {
  let index = skipWhitespace(source, start + "\\newif".length);
  if (!source.startsWith("\\if", index)) return null;
  const name = readCommandName(source, index + 3);
  if (!name?.value) return null;
  return {
    name: name.value,
    end: name.end
  };
}

function parseNewifAssignment(source, start, states) {
  if (source[start] !== "\\") return null;
  const command = readCommandName(source, start + 1);
  if (!command?.value) return null;
  const match = command.value.match(/^(.+?)(true|false)$/);
  if (!match || !states.has(match[1])) return null;
  return {
    name: match[1],
    value: match[2] === "true",
    end: command.end
  };
}

function parseNewifConditional(source, start, states) {
  const name = readNewifConditionalName(source, start, states);
  if (!name) return null;
  const branches = splitNewifConditionalBranches(source, name.end, states);
  if (!branches) return null;
  return {
    ...branches,
    value: Boolean(states.get(name.value))
  };
}

function readNewifConditionalName(source, start, states) {
  if (!source.startsWith("\\if", start)) return null;
  const command = readCommandName(source, start + 3);
  if (!command?.value || !states.has(command.value)) return null;
  return command;
}

function splitNewifConditionalBranches(source, start, states) {
  let depth = 0;
  let elseStart = -1;
  let elseEnd = -1;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] !== "\\") continue;
    if (readNewifConditionalName(source, index, states)) {
      depth += 1;
      continue;
    }
    if (source.startsWith("\\else", index) && isTeXCommandBoundary(source, index + "\\else".length) && depth === 0 && elseStart === -1) {
      elseStart = index;
      elseEnd = index + "\\else".length;
      index = elseEnd - 1;
      continue;
    }
    if (source.startsWith("\\fi", index) && isTeXCommandBoundary(source, index + "\\fi".length)) {
      if (depth > 0) {
        depth -= 1;
        index += "\\fi".length - 1;
        continue;
      }
      const fiEnd = index + "\\fi".length;
      return {
        thenSource: (elseStart === -1 ? source.slice(start, index) : source.slice(start, elseStart)).trim(),
        elseSource: elseStart === -1 ? "" : source.slice(elseEnd, index).trim(),
        end: fiEnd
      };
    }
  }
  return null;
}

function isTeXCommandBoundary(source, index) {
  return !/[A-Za-z@]/.test(source[index] || "");
}

function collectMacroDefinitions(source, macros, diagnostics) {
  let output = "";
  let index = 0;
  while (index < source.length) {
    const tikzsetCommand = source.startsWith("\\tikzset", index)
      ? "\\tikzset"
      : source.startsWith("\\ctikzset", index)
        ? "\\ctikzset"
        : null;
    if (tikzsetCommand) {
      let cursor = skipWhitespace(source, index + tikzsetCommand.length);
      const body = extractBalanced(source, cursor, "{", "}");
      if (body) {
        output += source.slice(index, body.end);
        index = body.end;
        continue;
      }
    }
    if (isDefMacroStart(source, index)) {
      const parsed = parseDefMacro(source, index);
      if (parsed) {
        // Delegated macros are consumed here but left for KaTeX or preprocess extensions to interpret.
        if (!isDelegatedMacro(parsed.name)) macros.set(parsed.name, parsed.macro);
        index = parsed.end;
        continue;
      }
    }
    if (source.startsWith("\\newcommand", index) || source.startsWith("\\renewcommand", index)) {
      const parsed = parseNewCommandMacro(source, index);
      if (parsed) {
        if (!isDelegatedMacro(parsed.name)) macros.set(parsed.name, parsed.macro);
        index = parsed.end;
        continue;
      }
    }
    if (source.startsWith("\\DeclareMathOperator", index)) {
      const parsed = parseDeclareMathOperator(source, index);
      if (parsed) {
        macros.set(parsed.name, parsed.macro);
        index = parsed.end;
        continue;
      }
    }
    if (isDefMacroStart(source, index) || source.startsWith("\\newcommand", index) || source.startsWith("\\renewcommand", index)) {
      diagnostics.push({ severity: "warning", message: `Could not parse TeX macro near offset ${index}` });
    }
    output += source[index];
    index += 1;
  }
  return output;
}

function parseDefMacro(source, start) {
  let index = skipWhitespace(source, start + "\\def".length);
  if (source[index] !== "\\") return null;
  index += 1;
  const name = readCommandName(source, index);
  if (!name || BUILTIN_MACROS.has(name.value)) return null;
  index = name.end;
  const delimited = parseParenSemicolonDefMacro(source, index, name.value);
  if (delimited) return delimited;
  const templated = parseTemplateDefMacro(source, index, name.value);
  if (templated) return templated;
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

function isDefMacroStart(source, start) {
  if (!source.startsWith("\\def", start) || !isTeXCommandBoundary(source, start + "\\def".length)) return false;
  const index = skipWhitespace(source, start + "\\def".length);
  return source[index] === "\\";
}

function parseTemplateDefMacro(source, start, name) {
  let index = start;
  const bodyStart = findTemplateDefBodyStart(source, index);
  if (bodyStart === -1) return null;
  const signature = source.slice(index, bodyStart).trim();
  if (!/#([1-9])/.test(signature)) return null;
  const body = extractBalanced(source, bodyStart, "{", "}");
  if (!body) return null;
  const argNumbers = [...signature.matchAll(/#([1-9])/g)].map((match) => Number(match[1]));
  return {
    name,
    macro: {
      name,
      argCount: argNumbers.length ? Math.max(...argNumbers) : 0,
      body: body.content,
      delimited: "template",
      template: parseMacroTemplate(signature)
    },
    end: body.end
  };
}

function findTemplateDefBodyStart(source, start) {
  let bracket = 0;
  let paren = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\") {
      index += 1;
      while (/[A-Za-z@]/.test(source[index + 1] || "")) index += 1;
      continue;
    }
    if (char === "[") bracket += 1;
    else if (char === "]") bracket = Math.max(0, bracket - 1);
    else if (char === "(") paren += 1;
    else if (char === ")") paren = Math.max(0, paren - 1);
    else if (char === "{" && bracket === 0 && paren === 0) return index;
  }
  return -1;
}

function parseMacroTemplate(signature) {
  const tokens = [];
  let cursor = 0;
  for (const match of signature.matchAll(/#([1-9])/g)) {
    if (match.index > cursor) tokens.push({ type: "literal", value: signature.slice(cursor, match.index) });
    tokens.push({ type: "arg", index: Number(match[1]) - 1 });
    cursor = match.index + match[0].length;
  }
  if (cursor < signature.length) tokens.push({ type: "literal", value: signature.slice(cursor) });
  return tokens.filter((token) => token.type !== "literal" || token.value.length);
}

function parseParenSemicolonDefMacro(source, start, name) {
  let index = start;
  if (source[index] !== "(") return null;
  const signature = extractBalanced(source, index, "(", ")");
  if (!signature) return null;
  index = skipWhitespace(source, signature.end);
  if (source[index] !== ";") return null;
  index = skipWhitespace(source, index + 1);
  const body = extractBalanced(source, index, "{", "}");
  if (!body) return null;
  const argNumbers = [...signature.content.matchAll(/#([1-9])/g)].map((match) => Number(match[1]));
  const argCount = argNumbers.length ? Math.max(...argNumbers) : 0;
  return {
    name,
    macro: { name, argCount, body: body.content, delimited: "parenSemicolon" },
    end: body.end
  };
}

function parseNewCommandMacro(source, start) {
  const command = source.startsWith("\\renewcommand", start) ? "\\renewcommand" : "\\newcommand";
  let index = start + command.length;
  if (source[index] === "*") index += 1;
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
  const usedArgCount = countReferencedMacroArguments(body.content);
  if (usedArgCount === 0) argCount = 0;
  return {
    name,
    macro: { name, argCount, defaults, body: body.content },
    end: body.end
  };
}

function parseDeclareMathOperator(source, start) {
  let index = start + "\\DeclareMathOperator".length;
  if (source[index] === "*") index += 1;
  index = skipWhitespace(source, index);
  const nameArg = extractBalanced(source, index, "{", "}");
  if (!nameArg) return null;
  const name = nameArg.content.trim().replace(/^\\/, "");
  if (!name || BUILTIN_MACROS.has(name)) return null;
  index = skipWhitespace(source, nameArg.end);
  const body = extractBalanced(source, index, "{", "}");
  if (!body) return null;
  return {
    name,
    macro: { name, argCount: 0, body: `\\operatorname{${body.content}}` },
    end: body.end
  };
}

function countReferencedMacroArguments(body) {
  let maxArg = 0;
  for (const match of String(body).matchAll(/#([1-9])/g)) {
    maxArg = Math.max(maxArg, Number(match[1]));
  }
  return maxArg;
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
    if (macro.delimited === "parenSemicolon") {
      cursor = skipWhitespace(source, cursor);
      const invocation = source[cursor] === "(" ? extractBalanced(source, cursor, "(", ")") : null;
      if (!invocation) {
        canExpand = false;
      } else {
        const semicolon = skipWhitespace(source, invocation.end);
        if (source[semicolon] !== ";") {
          canExpand = false;
        } else {
          args.push(...splitTopLevel(invocation.content, ",").map((part) => part.trim()));
          cursor = semicolon + 1;
        }
      }
    } else if (macro.delimited === "template") {
      const parsed = parseTemplateMacroInvocation(source, cursor, macro.template || []);
      if (!parsed) {
        canExpand = false;
      } else {
        args.push(...parsed.args);
        cursor = parsed.end;
      }
    } else {
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

function parseTemplateMacroInvocation(source, start, template) {
  const args = [];
  let cursor = start;
  for (let tokenIndex = 0; tokenIndex < template.length; tokenIndex += 1) {
    const token = template[tokenIndex];
    if (token.type === "literal") {
      cursor = skipWhitespace(source, cursor);
      if (!source.startsWith(token.value, cursor)) return null;
      cursor += token.value.length;
      continue;
    }
    const nextLiteral = template.slice(tokenIndex + 1).find((next) => next.type === "literal" && next.value.length)?.value || "";
    cursor = skipWhitespace(source, cursor);
    if (!nextLiteral) {
      const braced = source[cursor] === "{" ? extractBalanced(source, cursor, "{", "}") : null;
      if (braced) {
        args[token.index] = braced.content;
        cursor = braced.end;
        continue;
      }
      const atom = readTemplateAtom(source, cursor);
      if (!atom) return null;
      args[token.index] = atom.value;
      cursor = atom.end;
      continue;
    }
    const end = findTemplateDelimiter(source, cursor, nextLiteral);
    if (end === -1) return null;
    args[token.index] = source.slice(cursor, end).trim();
    cursor = end;
  }
  return { args, end: cursor };
}

function findTemplateDelimiter(source, start, delimiter) {
  let brace = 0;
  let bracket = 0;
  let paren = 0;
  for (let index = start; index < source.length; index += 1) {
    if (brace === 0 && bracket === 0 && paren === 0 && source.startsWith(delimiter, index)) return index;
    const char = source[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "{") brace += 1;
    else if (char === "}") brace = Math.max(0, brace - 1);
    else if (char === "[") bracket += 1;
    else if (char === "]") bracket = Math.max(0, bracket - 1);
    else if (char === "(") paren += 1;
    else if (char === ")") paren = Math.max(0, paren - 1);
  }
  return -1;
}

function readTemplateAtom(source, start) {
  let index = start;
  if (source[index] === "\\") {
    const command = readCommandName(source, index + 1);
    if (command) return { value: source.slice(start, command.end), end: command.end };
  }
  while (index < source.length && !/[\s{}[\]();]/.test(source[index])) index += 1;
  if (index === start) return null;
  return { value: source.slice(start, index), end: index };
}

function applyMacroBody(body, args) {
  let output = "";
  for (let index = 0; index < body.length; index += 1) {
    if (body[index] === "#" && /[1-9]/.test(body[index + 1] || "")) {
      const arg = args[Number(body[index + 1]) - 1] ?? "";
      output += macroArgumentText(arg, body[index + 2] || "");
      index += 1;
      continue;
    }
    output += body[index];
  }
  return output;
}

function macroArgumentText(arg, nextChar) {
  const text = String(arg);
  if (/^\\[A-Za-z]+$/.test(text) && /[A-Za-z]/.test(nextChar)) return `${text} `;
  return text;
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
    let layer = "";
    if (source[cursor] === "{") {
      const layerName = extractBalanced(source, cursor, "{", "}");
      if (layerName) {
        layer = layerName.content.trim();
        cursor = layerName.end;
      }
    }
    const endIndex = source.indexOf(end, cursor);
    if (endIndex === -1) {
      diagnostics.push({ severity: "warning", message: `Unclosed ${name} environment` });
      output += source.slice(beginIndex);
      break;
    }
    const body = source.slice(cursor, endIndex);
    output += layer === "background" ? `{[layer=background]${body}}` : body;
    index = endIndex + end.length;
  }
  return output;
}

function expandBraidMacros(source, diagnostics) {
  let output = "";
  let index = 0;
  while (index < source.length) {
    if (!source.startsWith("\\braid", index)) {
      output += source[index];
      index += 1;
      continue;
    }
    const parsed = parseBraidCommand(source, index, diagnostics);
    if (!parsed) {
      output += source[index];
      index += 1;
      continue;
    }
    output += parsed.text;
    index = parsed.end;
  }
  return output;
}

function parseBraidCommand(source, start, diagnostics) {
  let cursor = start + "\\braid".length;
  const options = parseOptionalOptions(source, cursor);
  cursor = options.end;
  cursor = skipWhitespace(source, cursor);
  if (source[cursor] === "(") {
    const name = extractBalanced(source, cursor, "(", ")");
    if (!name) return null;
    cursor = name.end;
  }
  cursor = skipWhitespace(source, cursor);
  let at = "0,0";
  if (source.startsWith("at", cursor)) {
    cursor = skipWhitespace(source, cursor + 2);
    const point = extractBalanced(source, cursor, "(", ")");
    if (!point) return null;
    at = point.content.trim();
    cursor = point.end;
  }
  const end = source.indexOf(";", cursor);
  if (end === -1) return null;
  const word = source.slice(cursor, end).trim();
  const expanded = expandSimpleTwoStrandBraid(options.raw, at, word);
  if (!expanded) {
    diagnostics.push({ severity: "warning", message: "Unsupported complex \\braid command; leaving as no-op compatibility statement" });
    return { text: source.slice(start, end + 1), end: end + 1 };
  }
  return { text: expanded, end: end + 1 };
}

function expandSimpleTwoStrandBraid(optionsRaw, at, word) {
  const crossings = [...String(word || "").matchAll(/s\s*_\s*\{?1\}?/g)].length;
  if (!crossings) return null;
  const strandStyles = braidStrandStyles(optionsRaw);
  const redStyle = strandStyles.get(1) || "red, very thick";
  const blueStyle = strandStyles.get(2) || "blue, very thick";
  const scopeOptions = `shift={(${at})}`;
  return `{[${scopeOptions}]
\\draw[${redStyle}] ${braidStrandPath(crossings, 0)};
\\draw[${blueStyle}] ${braidStrandPath(crossings, 1)};
}`;
}

function braidStrandStyles(optionsRaw) {
  const styles = new Map();
  const pattern = /style\s+strands\s*=\s*\{\s*(\d+)\s*\}\s*\{([^{}]*)\}/g;
  let match;
  while ((match = pattern.exec(String(optionsRaw || "")))) {
    styles.set(Number(match[1]), match[2].trim());
  }
  return styles;
}

function braidStrandPath(crossings, startY) {
  const border = 0.3;
  const crossingWidth = 0.9;
  const parts = [
    `(${formatBraidNumber(0)},${formatBraidNumber(startY)})`,
    `-- (${formatBraidNumber(border)},${formatBraidNumber(startY)})`
  ];
  let y = startY;
  for (let index = 0; index < crossings; index += 1) {
    const x = border + index;
    if (index > 0) parts.push(`-- (${formatBraidNumber(x)},${formatBraidNumber(y)})`);
    const nextY = y === 0 ? 1 : 0;
    if (index % 2 === startY) {
      parts.push(
        `.. controls (${formatBraidNumber(x + 0.5)},${formatBraidNumber(y)}) and (${formatBraidNumber(
          x + 0.4
        )},${formatBraidNumber(nextY)}) .. (${formatBraidNumber(x + crossingWidth)},${formatBraidNumber(nextY)})`
      );
    } else {
      parts.push(
        `.. controls (${formatBraidNumber(x + 0.2)},${formatBraidNumber(y)}) and (${formatBraidNumber(
          x + 0.304
        )},${formatBraidNumber(lerp(y, nextY, 0.16))}) .. (${formatBraidNumber(x + 0.388)},${formatBraidNumber(
          lerp(y, nextY, 0.352)
        )})`,
        `(${formatBraidNumber(x + 0.511)},${formatBraidNumber(lerp(y, nextY, 0.648))})`,
        `.. controls (${formatBraidNumber(x + 0.596)},${formatBraidNumber(lerp(y, nextY, 0.84))}) and (${formatBraidNumber(
          x + 0.7
        )},${formatBraidNumber(nextY)}) .. (${formatBraidNumber(x + crossingWidth)},${formatBraidNumber(nextY)})`
      );
    }
    y = nextY;
  }
  parts.push(`-- (${formatBraidNumber(border + crossings + 0.2)},${formatBraidNumber(y)})`);
  return parts.join(" ");
}

function lerp(from, to, ratio) {
  return from + (to - from) * ratio;
}

function formatBraidNumber(value) {
  return Number(value).toFixed(4).replace(/\.?0+$/, "");
}

function expandTikzNetworkMacros(source, diagnostics, options = {}) {
  if (!usesTikzNetwork(source)) return source;
  const state = createTikzNetworkState();
  let output = "";
  let index = 0;
  while (index < source.length) {
    if (source[index] !== "\\") {
      output += source[index];
      index += 1;
      continue;
    }
    const command = readCommandName(source, index + 1);
    if (!command) {
      output += source[index];
      index += 1;
      continue;
    }
    if (!TIKZ_NETWORK_COMMANDS.has(command.value)) {
      output += source.slice(index, command.end);
      index = command.end;
      continue;
    }
    const expanded = expandTikzNetworkCommand(source, index, command.value, command.end, state, diagnostics, options);
    if (!expanded) {
      output += source.slice(index, command.end);
      index = command.end;
      continue;
    }
    output += expanded.text;
    index = expanded.end;
  }
  return output;
}

const TIKZ_NETWORK_COMMANDS = new Set([
  "SetDefaultUnit",
  "SetDistanceScale",
  "SetVertexStyle",
  "SetEdgeStyle",
  "EdgesInBG",
  "EdgesNotInBG",
  "Vertex",
  "Edge",
  "Vertices",
  "Edges"
]);

function usesTikzNetwork(source) {
  return /\\usepackage(?:\[[^\]]*\])?\{tikz-network\}|\\(?:SetVertexStyle|SetEdgeStyle|SetDefaultUnit|SetDistanceScale|EdgesInBG|EdgesNotInBG|Vertices|Edges)\b/.test(
    source
  );
}

function createTikzNetworkState() {
  return {
    defaultUnit: "cm",
    distanceScale: 1,
    edgesInBackground: true,
    vertexStyle: {
      shape: "circle",
      minSize: "0.6cm",
      lineWidth: "1pt",
      lineColor: "black",
      fillColor: "#abd7e6",
      fillOpacity: "1",
      textColor: "black",
      innerSep: "2pt",
      outerSep: "0pt"
    },
    edgeStyle: {
      arrow: "-latex",
      lineWidth: "1.5pt",
      color: "black!75",
      opacity: "1",
      textColor: "black"
    }
  };
}

function expandTikzNetworkCommand(source, start, name, afterName, state, diagnostics, options) {
  if (name === "EdgesInBG") {
    state.edgesInBackground = true;
    return { text: "", end: afterName };
  }
  if (name === "EdgesNotInBG") {
    state.edgesInBackground = false;
    return { text: "", end: afterName };
  }
  if (name === "SetDefaultUnit") {
    const parsed = parseRequiredGroup(source, afterName);
    if (!parsed) return null;
    state.defaultUnit = normalizeTikzNetworkUnit(parsed.content, state.defaultUnit);
    return { text: "", end: parsed.end };
  }
  if (name === "SetDistanceScale") {
    const parsed = parseRequiredGroup(source, afterName);
    if (!parsed) return null;
    const scale = Number(parsed.content.trim());
    if (Number.isFinite(scale)) state.distanceScale = scale;
    return { text: "", end: parsed.end };
  }
  if (name === "SetVertexStyle") {
    const parsed = parseOptionalOptions(source, afterName);
    applyTikzNetworkVertexStyle(state, parseOptions(parsed.raw));
    return { text: "", end: parsed.end };
  }
  if (name === "SetEdgeStyle") {
    const parsed = parseOptionalOptions(source, afterName);
    applyTikzNetworkEdgeStyle(state, parseOptions(parsed.raw));
    return { text: "", end: parsed.end };
  }
  if (name === "Vertex") {
    const parsed = parseTikzNetworkVertex(source, afterName, state, diagnostics);
    return parsed ? { text: parsed.text, end: parsed.end } : null;
  }
  if (name === "Edge") {
    const parsed = parseTikzNetworkEdge(source, afterName, state, diagnostics);
    return parsed ? { text: parsed.text, end: parsed.end } : null;
  }
  if (name === "Vertices" || name === "Edges") {
    const parsed = parseTikzNetworkCsvCommand(source, afterName, name, state, diagnostics, options);
    return parsed;
  }
  return null;
}

function parseTikzNetworkVertex(source, afterName, state, diagnostics) {
  const parsedOptions = parseOptionalOptions(source, afterName);
  const name = parseRequiredGroup(source, parsedOptions.end);
  if (!name) {
    diagnostics.push({ severity: "warning", message: "Could not parse tikz-network Vertex command" });
    return null;
  }
  const vertexId = name.content.trim();
  const vertexOptions = parseOptions(parsedOptions.raw);
  return {
    text: renderTikzNetworkVertex(vertexId, vertexOptions, state),
    end: name.end
  };
}

function renderTikzNetworkVertex(vertexId, options, state) {
  const x = tikzNetworkCoordinate(options.x, 0, state);
  const y = tikzNetworkCoordinate(options.y, 0, state);
  const size = tikzNetworkMeasure(options.size || state.vertexStyle.minSize, state.defaultUnit);
  const shape = String(options.shape || state.vertexStyle.shape || "circle").trim();
  const fillColor = tikzNetworkColor(options.color || state.vertexStyle.fillColor, tikzNetworkFlag(options.RGB));
  const lineColor = tikzNetworkColor(options.linecolor || options.LineColor || state.vertexStyle.lineColor);
  const fillOpacity = tikzNetworkNumber(options.opacity, state.vertexStyle.fillOpacity);
  const styleParts = [
    "draw",
    shape,
    `minimum size=${size}`,
    `inner sep=${state.vertexStyle.innerSep}`,
    `outer sep=${state.vertexStyle.outerSep}`,
    `line width=${state.vertexStyle.lineWidth}`,
    `draw=${lineColor}`,
    `fill=${fillColor}`,
    `opacity=${fillOpacity}`,
    `text=${tikzNetworkColor(options.fontcolor || state.vertexStyle.textColor)}`
  ];
  if (options.style) styleParts.push(stripOuterBracesText(options.style));
  if (tikzNetworkFlag(options.Pseudo)) styleParts.push("opacity=0,text opacity=0,fill opacity=0,draw opacity=0");
  const label = tikzNetworkVertexLabel(vertexId, options);
  const text = shouldRenderTikzNetworkVertexLabel(options) ? label : "";
  if (shouldPlaceTikzNetworkLabelOutside(options)) {
    return [
      `\\node[${joinTikzOptions(styleParts)}] (${vertexId}) at (${x},${y}) {};`,
      renderTikzNetworkExternalLabel(vertexId, label, options, state)
    ].join("\n");
  }
  return `\\node[${joinTikzOptions(styleParts)}] (${vertexId}) at (${x},${y}) {${text}};`;
}

function tikzNetworkVertexLabel(vertexId, options) {
  let label = "";
  if (tikzNetworkFlag(options.IdAsLabel)) label = vertexId;
  if (options.label !== undefined) label = String(options.label);
  if (options.Math && label && !/^\$[\s\S]*\$$/.test(label)) label = `$${label}$`;
  return label;
}

function shouldRenderTikzNetworkVertexLabel(options) {
  return !tikzNetworkFlag(options.NoLabel) && (tikzNetworkFlag(options.IdAsLabel) || options.label !== undefined);
}

function shouldPlaceTikzNetworkLabelOutside(options) {
  const position = String(options.position || "center").trim();
  return shouldRenderTikzNetworkVertexLabel(options) && position && position !== "center";
}

function renderTikzNetworkExternalLabel(vertexId, label, options, state) {
  const position = String(options.position || "above").trim();
  const distance = tikzNetworkMeasure(options.distance || "2mm", state.defaultUnit);
  const shift = tikzNetworkLabelShift(position, distance);
  const labelOptions = [
    "draw=none",
    "fill=none",
    "inner sep=0",
    `text=${tikzNetworkColor(options.fontcolor || state.vertexStyle.textColor)}`
  ];
  if (options.fontsize) labelOptions.push(`font=${options.fontsize}`);
  return `\\node[${joinTikzOptions(labelOptions)}] at ([${shift}]${vertexId}.${tikzNetworkAnchorForPosition(position)}) {${label}};`;
}

function tikzNetworkLabelShift(position, distance) {
  const direction = String(position || "above").trim();
  if (direction.includes("below")) return `yshift=-${distance}`;
  if (direction.includes("left")) return `xshift=-${distance}`;
  if (direction.includes("right")) return `xshift=${distance}`;
  return `yshift=${distance}`;
}

function tikzNetworkAnchorForPosition(position) {
  const direction = String(position || "above").trim();
  if (direction.includes("below")) return "south";
  if (direction.includes("left")) return "west";
  if (direction.includes("right")) return "east";
  return "north";
}

function parseTikzNetworkEdge(source, afterName, state, diagnostics) {
  const parsedOptions = parseOptionalOptions(source, afterName);
  let cursor = parsedOptions.end;
  const from = parseRequiredParen(source, cursor);
  if (!from) {
    diagnostics.push({ severity: "warning", message: "Could not parse tikz-network Edge source vertex" });
    return null;
  }
  cursor = from.end;
  const to = parseRequiredParen(source, cursor);
  if (!to) {
    diagnostics.push({ severity: "warning", message: "Could not parse tikz-network Edge target vertex" });
    return null;
  }
  const edgeOptions = parseOptions(parsedOptions.raw);
  return {
    text: renderTikzNetworkEdge(from.content.trim(), to.content.trim(), edgeOptions, state),
    end: to.end
  };
}

function renderTikzNetworkEdge(from, to, options, state) {
  const styleParts = [
    `line width=${tikzNetworkMeasure(options.lw || state.edgeStyle.lineWidth, state.defaultUnit)}`,
    `color=${tikzNetworkColor(options.color || state.edgeStyle.color, tikzNetworkFlag(options.RGB))}`,
    `opacity=${tikzNetworkNumber(options.opacity, state.edgeStyle.opacity)}`
  ];
  if (options.style) styleParts.push(stripOuterBracesText(options.style));
  if (tikzNetworkFlag(options.Direct)) styleParts.push(state.edgeStyle.arrow || "-latex");
  const edgeStyle = joinTikzOptions(styleParts);
  const body = options.path
    ? renderTikzNetworkPathEdge(from, to, options.path, edgeStyle)
    : from === to
      ? renderTikzNetworkLoop(from, options, edgeStyle, state)
      : renderTikzNetworkRegularEdge(from, to, options, edgeStyle, state);
  if (tikzNetworkFlag(options.NotInBG) || !state.edgesInBackground) return body;
  return `{[layer=background]${body}}`;
}

function renderTikzNetworkRegularEdge(from, to, options, edgeStyle, state) {
  const edgeOptions = [];
  if (options.bend !== undefined) {
    const bend = Number(options.bend);
    if (Number.isFinite(bend) && bend < 0) edgeOptions.push(`bend right=${Math.abs(bend)}`);
    else edgeOptions.push(`bend left=${options.bend}`);
  }
  return `\\path[${edgeStyle}] (${from}) edge[${joinTikzOptions(edgeOptions)}] ${renderTikzNetworkEdgeLabel(options, state)} (${to});`;
}

function renderTikzNetworkLoop(vertex, options, edgeStyle, state) {
  const direction = tikzNetworkLoopDirection(options.loopposition);
  const loopOptions = [`loop ${direction}`];
  if (options.loopsize) loopOptions.push(`looseness=${tikzNetworkLoopLooseness(options.loopsize)}`);
  return `\\path[${edgeStyle}] (${vertex}) edge[${joinTikzOptions(loopOptions)}] ${renderTikzNetworkEdgeLabel(options, state)} (${vertex});`;
}

function renderTikzNetworkPathEdge(from, to, rawPath, edgeStyle) {
  const points = splitTopLevel(stripOuterBracesText(rawPath), ",").map(tikzNetworkPathPoint).filter(Boolean);
  const allPoints = [`(${from})`, ...points, `(${to})`];
  return `\\draw[${edgeStyle}] ${allPoints.join(" -- ")};`;
}

function tikzNetworkPathPoint(raw) {
  const text = stripOuterBracesText(raw).trim();
  if (!text) return null;
  if (text.startsWith("(") && text.endsWith(")")) return text;
  if (text.includes(",")) return `(${text})`;
  return `(${text})`;
}

function renderTikzNetworkEdgeLabel(options, state) {
  if (options.label === undefined) return "";
  let label = String(options.label);
  if (options.Math && label && !/^\$[\s\S]*\$$/.test(label)) label = `$${label}$`;
  const nodeOptions = [];
  if (options.distance !== undefined) nodeOptions.push(`pos=${options.distance}`);
  if (options.position) nodeOptions.push(options.position);
  nodeOptions.push("fill=white", "inner sep=1pt", `text=${tikzNetworkColor(options.fontcolor || state.edgeStyle.textColor)}`);
  return `node[${joinTikzOptions(nodeOptions)}] {${label}}`;
}

function tikzNetworkLoopDirection(rawAngle) {
  const angle = normalizeAngle(Number(rawAngle ?? 0));
  if (angle >= 45 && angle < 135) return "above";
  if (angle >= 135 && angle < 225) return "left";
  if (angle >= 225 && angle < 315) return "below";
  return "right";
}

function normalizeAngle(angle) {
  if (!Number.isFinite(angle)) return 0;
  return ((angle % 360) + 360) % 360;
}

function tikzNetworkLoopLooseness(value) {
  const text = String(value || "").trim();
  if (!text) return 1;
  const numeric = Number(text.replace(/[A-Za-z]+$/, ""));
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(0.7, Math.min(3, numeric * 2));
}

function parseTikzNetworkCsvCommand(source, afterName, name, state, diagnostics, options) {
  const parsedOptions = parseOptionalOptions(source, afterName);
  const file = parseRequiredGroup(source, parsedOptions.end);
  if (!file) return null;
  if (typeof options.tikzNetworkFileResolver === "function") {
    const commandOptions = parseOptions(parsedOptions.raw);
    const resolved = options.tikzNetworkFileResolver(file.content.trim(), name, commandOptions);
    if (typeof resolved === "string") {
      return {
        text: renderTikzNetworkCsv(resolved, name, state, commandOptions, diagnostics),
        end: file.end
      };
    }
  }
  diagnostics.push({
    severity: "warning",
    message: `tikz-network ${name} CSV import requires options.tikzNetworkFileResolver: ${file.content.trim()}`
  });
  return { text: "", end: file.end };
}

function renderTikzNetworkCsv(content, command, state, commandOptions, diagnostics) {
  const rows = parseTikzNetworkCsv(content);
  if (!rows.length) return "";
  if (command === "Vertices") {
    return rows
      .map((row) => {
        const id = firstDefined(row.id, row.Id, row.name, row.Name);
        if (!id) {
          diagnostics.push({ severity: "warning", message: "tikz-network Vertices CSV row is missing id" });
          return "";
        }
        return renderTikzNetworkVertex(String(id).trim(), { ...commandOptions, ...tikzNetworkVertexRowOptions(row) }, state);
      })
      .filter(Boolean)
      .join("\n");
  }
  if (command === "Edges") {
    return rows
      .map((row) => {
        const from = firstDefined(row.u, row.U, row.source, row.Source, row.from, row.From);
        const to = firstDefined(row.v, row.V, row.target, row.Target, row.to, row.To);
        if (!from || !to) {
          diagnostics.push({ severity: "warning", message: "tikz-network Edges CSV row is missing u/v endpoints" });
          return "";
        }
        return renderTikzNetworkEdge(String(from).trim(), String(to).trim(), { ...commandOptions, ...tikzNetworkEdgeRowOptions(row) }, state);
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function tikzNetworkVertexRowOptions(row) {
  return compactObject({
    x: row.x,
    y: row.y,
    label: row.label,
    size: row.size,
    opacity: row.opacity,
    layer: row.layer,
    style: row.style,
    shape: row.shape,
    position: row.position,
    distance: row.distance,
    fontcolor: firstDefined(row.fontcolor, row.fontColor, row.FontColor),
    fontsize: firstDefined(row.fontsize, row.fontSize, row.FontSize),
    RGB: row.RGB || hasCsvRgbChannels(row),
    IdAsLabel: csvBoolean(firstDefined(row.IdAsLabel, row.idAsLabel)),
    NoLabel: csvBoolean(firstDefined(row.NoLabel, row.noLabel)),
    Math: csvBoolean(row.Math),
    Pseudo: csvBoolean(row.Pseudo),
    color: hasCsvRgbChannels(row) ? `${row.R},${row.G},${row.B}` : row.color
  });
}

function tikzNetworkEdgeRowOptions(row) {
  return compactObject({
    label: row.label,
    lw: row.lw,
    path: row.path,
    color: hasCsvRgbChannels(row) ? `${row.R},${row.G},${row.B}` : row.color,
    opacity: row.opacity,
    bend: row.bend,
    position: row.position,
    distance: row.distance,
    loopsize: row.loopsize,
    loopposition: row.loopposition,
    loopshape: row.loopshape,
    style: row.style,
    fontcolor: firstDefined(row.fontcolor, row.fontColor, row.FontColor),
    fontsize: firstDefined(row.fontsize, row.fontSize, row.FontSize),
    RGB: row.RGB || hasCsvRgbChannels(row),
    Direct: csvBoolean(row.Direct),
    Math: csvBoolean(row.Math),
    NotInBG: csvBoolean(row.NotInBG)
  });
}

function parseTikzNetworkCsv(content) {
  const rows = parseCsvRows(content);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => {
      const entry = {};
      headers.forEach((header, index) => {
        if (!header) return;
        entry[header] = row[index]?.trim() ?? "";
      });
      return entry;
    });
}

function parseCsvRows(content) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const text = String(content || "");
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

function compactObject(object) {
  const compacted = {};
  for (const [key, value] of Object.entries(object)) {
    if (value === undefined || value === null || value === "") continue;
    compacted[key] = value;
  }
  return compacted;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function hasCsvRgbChannels(row) {
  return row.R !== undefined && row.G !== undefined && row.B !== undefined;
}

function csvBoolean(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === true) return true;
  const text = String(value).trim().toLowerCase();
  return !["0", "false", "no", "off"].includes(text);
}

function tikzNetworkFlag(value) {
  if (value === undefined || value === null || value === false) return false;
  if (value === true) return true;
  const text = String(value).trim().toLowerCase();
  return !["", "0", "false", "no", "off"].includes(text);
}

function applyTikzNetworkVertexStyle(state, options) {
  if (options.Shape) state.vertexStyle.shape = String(options.Shape).trim();
  if (options.MinSize) state.vertexStyle.minSize = tikzNetworkMeasure(options.MinSize, state.defaultUnit);
  if (options.LineWidth) state.vertexStyle.lineWidth = String(options.LineWidth).trim();
  if (options.LineColor) state.vertexStyle.lineColor = tikzNetworkColor(options.LineColor);
  if (options.FillColor) state.vertexStyle.fillColor = tikzNetworkColor(options.FillColor);
  if (options.FillOpacity) state.vertexStyle.fillOpacity = String(options.FillOpacity).trim();
  if (options.TextColor) state.vertexStyle.textColor = tikzNetworkColor(options.TextColor);
  if (options.InnerSep) state.vertexStyle.innerSep = tikzNetworkMeasure(options.InnerSep, state.defaultUnit);
  if (options.OuterSep) state.vertexStyle.outerSep = tikzNetworkMeasure(options.OuterSep, state.defaultUnit);
}

function applyTikzNetworkEdgeStyle(state, options) {
  if (options.Arrow) state.edgeStyle.arrow = String(options.Arrow).trim();
  if (options.LineWidth) state.edgeStyle.lineWidth = String(options.LineWidth).trim();
  if (options.Color) state.edgeStyle.color = tikzNetworkColor(options.Color);
  if (options.Opacity) state.edgeStyle.opacity = String(options.Opacity).trim();
  if (options.TextColor) state.edgeStyle.textColor = tikzNetworkColor(options.TextColor);
}

function tikzNetworkCoordinate(value, fallback, state) {
  if (value === undefined || value === null || value === "") return fallback;
  const text = stripOuterBracesText(value).trim();
  if (!text) return fallback;
  if (/[A-Za-z]/.test(text)) return text;
  const number = Number(text);
  if (Number.isFinite(number)) return roundAxis(number * state.distanceScale);
  return text;
}

function tikzNetworkMeasure(value, defaultUnit) {
  const text = stripOuterBracesText(value).trim();
  if (!text) return `0${defaultUnit}`;
  if (/[A-Za-z]/.test(text)) return text;
  return `${text}${defaultUnit}`;
}

function tikzNetworkNumber(value, fallback) {
  const text = value === undefined || value === null || value === "" ? fallback : value;
  return String(text).trim();
}

function tikzNetworkColor(value, isRgb = false) {
  const text = stripOuterBracesText(value ?? "").trim();
  if (!text) return "black";
  if (isRgb) {
    const channels = splitTopLevel(text, ",").map((part) => Number(part.trim()));
    if (channels.length === 3 && channels.every((channel) => Number.isFinite(channel))) {
      return `rgb(${channels.map((channel) => Math.round(Math.max(0, Math.min(255, channel)))).join(" ")})`;
    }
  }
  return text;
}

function normalizeTikzNetworkUnit(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function parseRequiredGroup(source, start) {
  const cursor = skipWhitespace(source, start);
  return extractBalanced(source, cursor, "{", "}");
}

function parseRequiredParen(source, start) {
  const cursor = skipWhitespace(source, start);
  return extractBalanced(source, cursor, "(", ")");
}

function stripOuterBracesText(value) {
  let text = String(value ?? "").trim();
  while (text.startsWith("{") && text.endsWith("}")) {
    const balanced = extractBalanced(text, 0, "{", "}");
    if (!balanced || balanced.end !== text.length) break;
    text = balanced.content.trim();
  }
  return text;
}

function joinTikzOptions(parts) {
  return parts.map((part) => String(part || "").trim()).filter(Boolean).join(", ");
}

function expandTkzGraphMacros(source) {
  let unit = 2.5;
  const positions = new Map();
  const setupEdgeMarkers = [];
  const preparedSource = String(source).replace(/\\SetUpEdge\s*\[([\s\S]*?)\]/g, (_match, raw) => {
    const markerIndex = setupEdgeMarkers.push(raw) - 1;
    return `\n\\tikzkitSetUpEdge{${markerIndex}}\n`;
  });
  const edgeSetup = {};
  const edgeLabelOptions = {};
  let edgeStyleOverride = "";
  let currentEdgeStyle = "->";
  const refreshEdgeStyle = () => {
    currentEdgeStyle = joinTkzOptions([tkzSetupEdgeStyle(edgeSetup), edgeStyleOverride]) || "->";
  };
  const applySetupEdge = (raw) => {
    const options = parseOptions(raw);
    if (options.lw !== undefined) edgeSetup.lw = options.lw;
    if (options.color !== undefined) edgeSetup.color = options.color;
    if (options.labelcolor !== undefined) edgeLabelOptions.fill = options.labelcolor;
    if (options.labeltext !== undefined) edgeLabelOptions.text = options.labeltext;
    refreshEdgeStyle();
  };
  // Claude: 跟踪 tkz-graph 的 VertexStyle。原代码把每个 \Vertex 都展成固定样式的 node，
  // 完全忽略了 \tikzset{VertexStyle/.append style={fill=red!50}} 这类顶点样式（导致 case 040
  // 的 s/t 顶点该红/蓝却渲染成白色）。这里用一个样式对象累积 .append style（同名键后者覆盖，
  // 对应 TikZ 的 last-fill-wins），.style 则整体替换，并应用到顶点 node 上。
  let vertexStyle = {};
  const vertexNode = (name, x, y) =>
    `\\node[${tkzVertexNodeOptions(vertexStyle)}] (${name}) at (${x},${y}) {${name}};`;
  return preparedSource
    .replace(/\\GraphInit\s*\[[^\]]*?\]/g, "")
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      const setupEdge = trimmed.match(/^\\tikzkitSetUpEdge\{(\d+)\}$/);
      if (setupEdge) {
        applySetupEdge(setupEdgeMarkers[Number(setupEdge[1])] || "");
        return "";
      }
      const edgeStyle = trimmed.match(/^\\tikzset\s*\{\s*EdgeStyle\/\.style\s*=\s*\{([\s\S]*)\}\s*\}\s*$/);
      if (edgeStyle) {
        edgeStyleOverride = edgeStyle[1].trim();
        refreshEdgeStyle();
        return line;
      }
      const vertexAppend = trimmed.match(/^\\tikzset\s*\{\s*VertexStyle\/\.append\s+style\s*=\s*\{([\s\S]*)\}\s*\}\s*$/);
      if (vertexAppend) {
        vertexStyle = { ...vertexStyle, ...parseTkzVertexStyleOptions(vertexAppend[1].trim(), { append: true }) };
        return "";
      }
      const vertexReplace = trimmed.match(/^\\tikzset\s*\{\s*VertexStyle\/\.style\s*=\s*\{([\s\S]*)\}\s*\}\s*$/);
      if (vertexReplace) {
        vertexStyle = parseTkzVertexStyleOptions(vertexReplace[1].trim());
        return "";
      }
      const graphUnit = trimmed.match(/^\\SetGraphUnit\s*\{([^}]*)\}/);
      if (graphUnit) {
        unit = Number(graphUnit[1]) || unit;
        return "";
      }
      const vertex = trimmed.match(/^\\Vertex\s*\{([^}]*)\}/);
      if (vertex) {
        const name = vertex[1].trim();
        positions.set(name, { x: 0, y: 0 });
        return vertexNode(name, 0, 0);
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
        return vertexNode(name, point.x, point.y);
      }
      const edge = trimmed.match(/^\\Edge(?:\[([^\]]*?)\])?\s*\(([^)]*)\)\s*\(([^)]*)\)/);
      if (edge) {
        const edgeOptions = edge[1] ? parseOptions(edge[1]) : {};
        const edgeLabel = renderTkzGraphEdgeLabel(edgeOptions, edgeLabelOptions);
        return `\\draw[${currentEdgeStyle}] (${edge[2].trim()}) edge[${currentEdgeStyle}]${edgeLabel} (${edge[3].trim()});`;
      }
      return line;
    })
    .join("\n");
}

function tkzSetupEdgeStyle(options = {}) {
  const parts = [];
  if (options.lw) parts.push(`line width=${options.lw}`);
  if (options.color) parts.push(String(options.color).trim());
  return joinTikzOptions(parts);
}

// Claude: 把基础顶点样式与当前 VertexStyle 合并成 \node 的选项串。
function tkzVertexNodeOptions(vertexStyle = {}) {
  const base = ["draw", "circle", "minimum size=18pt", "line width=0.5pt", "fill=white", "text=black"];
  const extra = Object.entries(vertexStyle).map(([key, value]) => (value === true ? key : `${key}=${value}`));
  return [...base, ...extra].join(",");
}

function parseTkzVertexStyleOptions(raw, { append = false } = {}) {
  const options = parseOptions(raw);
  if (append && options.fill === true) {
    delete options.fill;
  }
  return options;
}

function renderTkzGraphEdgeLabel(edgeOptions, baseOptions = {}) {
  if (edgeOptions.label === undefined) return "";
  const nodeOptions = ["midway"];
  if (baseOptions.fill) nodeOptions.push(`fill=${baseOptions.fill}`);
  nodeOptions.push(`text=${baseOptions.text || "black"}`);
  nodeOptions.push("inner sep=1pt", "outer sep=0pt");
  if (edgeOptions.style) nodeOptions.push(stripOuterBracesText(edgeOptions.style));
  return ` node[${joinTikzOptions(nodeOptions)}] {${stripOuterBracesText(edgeOptions.label)}}`;
}

function joinTkzOptions(parts) {
  return parts
    .flatMap((part) => String(part || "").split(","))
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

function collectPgfplotstableReads(source) {
  const tables = new Map();
  let output = "";
  let index = 0;
  while (index < source.length) {
    if (!source.startsWith("\\pgfplotstableread", index)) {
      output += source[index];
      index += 1;
      continue;
    }
    let cursor = index + "\\pgfplotstableread".length;
    const options = parseOptionalOptions(source, cursor);
    cursor = options.end;
    cursor = skipWhitespace(source, cursor);
    const table = extractBalanced(source, cursor, "{", "}");
    if (!table) {
      output += source[index];
      index += 1;
      continue;
    }
    cursor = skipWhitespace(source, table.end);
    const name = source.slice(cursor).match(/^\\([A-Za-z@][A-Za-z0-9@]*)/);
    if (!name) {
      output += source.slice(index, table.end);
      index = table.end;
      continue;
    }
    tables.set(name[1], table.content.trim());
    index = cursor + name[0].length;
    if (source[index] === ";") index += 1;
  }
  return { source: output, tables };
}

// PgfplotsTable eventually delegates its simple output form to LaTeX's
// tabular environment. Lower that stable semantic subset before the parser so
// the shared document-table scene layout can measure and paint it like any
// other table instead of treating the command as a harmless no-op.
function lowerPgfplotstableTypeset(source, tables) {
  const text = String(source || "");
  let output = "";
  let index = 0;

  while (index < text.length) {
    if (!text.startsWith("\\pgfplotstabletypeset", index)) {
      output += text[index];
      index += 1;
      continue;
    }
    let cursor = index + "\\pgfplotstabletypeset".length;
    const optionGroup = parseOptionalOptions(text, cursor);
    cursor = skipWhitespace(text, optionGroup.end);
    const inlineTable = extractBalanced(text, cursor, "{", "}");
    const macro = inlineTable ? null : text.slice(cursor).match(/^\\([A-Za-z@][A-Za-z0-9@]*)/);
    const table = inlineTable
      ? inlineTable.content
      : macro && tables?.has(macro[1])
        ? tables.get(macro[1])
        : null;
    if (table == null) {
      output += text[index];
      index += 1;
      continue;
    }

    const lowered = pgfplotstableTypesetTabular(table, optionGroup.raw);
    if (!lowered) {
      output += text.slice(index, inlineTable?.end || cursor + macro[0].length);
      index = inlineTable?.end || cursor + macro[0].length;
      continue;
    }
    output += lowered;
    index = inlineTable?.end || cursor + macro[0].length;
  }
  return output;
}

function pgfplotstableTypesetTabular(rawTable, rawOptions) {
  const options = parseOptions(rawOptions || "");
  let rows = parsePgfplotstableTypesetRows(rawTable, options);
  // `\pgfplotstableread[col sep=comma]{...}\macro` retains its parsed cells
  // in TeX. Our focused read registry intentionally stores raw data for
  // addplot too, so recover the common comma form when typeset is invoked on
  // that macro without repeating the read option.
  if (options["col sep"] === undefined && rows[0]?.length === 1 && String(rawTable).includes(",")) {
    rows = parsePgfplotstableTypesetRows(rawTable, { ...options, "col sep": "comma" });
  }
  if (!rows.length) return "";
  const headerMode = String(options.header ?? "true").trim().toLowerCase();
  const hasHeader = headerMode === "has colnames" || (headerMode !== "false" && rows[0].some((cell) => !pgfplotstableNumericCell(cell)));
  const sourceHeaders = hasHeader ? rows.shift() : rows[0].map((_cell, index) => String(index));
  const selected = pgfplotstableSelectedColumns(options.columns, sourceHeaders);
  if (!selected.length) return "";
  const columnSpec = selected.map(() => "c").join("");
  const selectedColumns = selected.map(({ index, name }) => ({
    index,
    name,
    options: pgfplotstableColumnOptions(options, name)
  }));
  const header = selectedColumns.map(({ index, name, options: columnOptions }) =>
    pgfplotstableDisplayColumnName(columnOptions, sourceHeaders[index])
  ).join(" & ");
  const body = rows
    .map((row) => selectedColumns.map(({ index, options: columnOptions }) =>
      pgfplotstableDisplayCell(row[index], columnOptions)
    ).join(" & "))
    .join("\\\\\n");
  return `\\begin{tabular}{${columnSpec}}\n${header}${body ? `\\\\\n${body}` : ""}\n\\end{tabular}`;
}

function parsePgfplotstableTypesetRows(rawTable, options) {
  const separator = pgfplotstableColumnSeparator(options["col sep"]);
  return String(rawTable || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("%") && !line.startsWith("#"))
    .map((line) => pgfplotstableSplitRow(line, separator));
}

function pgfplotstableColumnSeparator(value) {
  const normalized = String(value || "space").trim().toLowerCase();
  if (normalized === "comma") return ",";
  if (normalized === "ampersand" || normalized === "&") return "&";
  if (normalized === "tab") return "\t";
  return "space";
}

function pgfplotstableSplitRow(line, separator) {
  if (separator === "space") return line.trim().split(/\s+/).map((cell) => cell.trim());
  return splitTopLevel(line, separator).map((cell) => cell.trim());
}

function pgfplotstableSelectedColumns(rawColumns, headers) {
  const requested = stripOuterBracesText(String(rawColumns || "").trim());
  if (!requested) return headers.map((name, index) => ({ index, name }));
  return splitTopLevel(requested)
    .map((entry) => stripOuterBracesText(entry.trim()))
    .map((name) => {
      const indexed = name.match(/^\[index\](\d+)$/i);
      const index = indexed ? Number(indexed[1]) : headers.indexOf(name);
      return Number.isInteger(index) && index >= 0 && index < headers.length ? { index, name: headers[index] } : null;
    })
    .filter(Boolean);
}

function pgfplotstableColumnOptions(options, name) {
  const style = options[`columns/${name}/.style`];
  return style === undefined ? options : { ...options, ...parseOptions(String(style)) };
}

function pgfplotstableDisplayColumnName(options, fallback) {
  const columnName = options["column name"];
  if (columnName !== undefined) return stripOuterBracesText(String(columnName));
  return fallback;
}

function pgfplotstableDisplayCell(value, options) {
  const text = String(value ?? "").trim();
  if (!text || options["string type"] !== undefined) return text;
  // Pgfplotstable's default `assign cell content` delegates ordinary numbers
  // to pgfmathprintnumber. Preserve its most visible default: grouping plain
  // integer values such as 2021 as 2,021. The explicit fixed/sci modes below
  // mirror the locally reviewed pgfmathfloat number-printer subset.
  const numeric = Number(text);
  if (!Number.isFinite(numeric)) return text;
  const formatter = pgfplotstableNumberFormatter(options);
  const usesScientificFormatter = formatter === "sci"
    || (formatter === "int detect" && !Number.isInteger(numeric));
  if (usesScientificFormatter
    && pgfplotstableScientificPresentation(options) === "standard"
    && pgfplotstableOptionEnabled(options["sci sep align"])) {
    return pgfplotstableScientificAlignedCell(numeric, options);
  }
  const formatted = formatter === "fixed"
    ? pgfplotstableFormatFixed(numeric, options)
    : usesScientificFormatter
      ? pgfplotstableFormatScientific(numeric, options)
      : pgfplotstableFormatGroupedNumber(text, options);
  return pgfplotstableDecimalAlignedCell(formatted, options);
}

function pgfplotstableNumberFormatter(options) {
  if (pgfplotstableOptionEnabled(options.sci)) return "sci";
  if (pgfplotstableOptionEnabled(options.fixed)) return "fixed";
  if (pgfplotstableOptionEnabled(options["int detect"])) return "int detect";
  return "default";
}

function pgfplotstableFormatFixed(value, options) {
  const precision = pgfplotstableNumberPrecision(options.precision, 2);
  const rounded = Number(value.toFixed(precision));
  const zeroFill = pgfplotstableOptionEnabled(options["fixed zerofill"]);
  const fixed = zeroFill
    ? rounded.toFixed(precision)
    : String(rounded);
  return pgfplotstableFormatGroupedNumber(fixed, options);
}

function pgfplotstableFormatScientific(value, options) {
  const parts = pgfplotstableScientificParts(value, options);
  const { mantissa, exponent } = parts;
  const presentation = pgfplotstableScientificPresentation(options);
  if (presentation === "generic") {
    return pgfplotstableFormatScientificGeneric(parts, options);
  }
  if (presentation === "subscript" || presentation === "superscript") {
    // TeX Live's direct script formats always receive an exponent token,
    // including their zero branch. They bypass the regular scientific
    // exponent marker, so sci sep align cannot split either presentation.
    const operator = presentation === "subscript" ? "_" : "^";
    return `$${mantissa}${operator}{${exponent ?? 0}}$`;
  }
  if (exponent === null || exponent === 0) return mantissa;
  return `$${mantissa}\\cdot 10^{${exponent}}$`;
}

function pgfplotstableScientificPresentation(options) {
  return pgfplotstableOptionEnabled(options["sci generic"])
    ? "generic"
    : pgfplotstableOptionEnabled(options["sci subscript"])
    ? "subscript"
    : pgfplotstableOptionEnabled(options["sci superscript"])
      ? "superscript"
      : "standard";
}

function pgfplotstableFormatScientificGeneric(parts, options) {
  // TeX Live routes `sci generic={...}` through three number-format keys.
  // Keep this deliberately data-only: documented #1 exponent substitution is
  // preserved, while arbitrary TeX key callbacks and #2/#3 introspection are
  // not executed by the JavaScript interpreter.
  const generic = parseOptions(String(options["sci generic"] === true ? "" : options["sci generic"]));
  const exponent = parts.exponent ?? 0;
  const omitUnitMantissa = pgfplotstableOptionIsFalse(options["retain unit mantissa"])
    && Math.abs(Math.abs(parts.mantissaValue) - 1) < 1e-12;
  const separator = omitUnitMantissa
    ? pgfplotstableScientificGenericTemplate(generic["empty mantissa sep"], exponent)
    : pgfplotstableScientificGenericTemplate(generic["mantissa sep"], exponent);
  const exponentTemplate = pgfplotstableScientificGenericTemplate(generic.exponent, exponent);
  const mantissa = omitUnitMantissa
    ? (parts.mantissaValue < 0 ? "-" : "")
    : parts.mantissa;
  return `$${mantissa}${separator}${exponentTemplate}$`;
}

function pgfplotstableScientificGenericTemplate(value, exponent) {
  return String(value === undefined || value === true ? "" : value).replaceAll("#1", String(exponent));
}

function pgfplotstableScientificAlignedCell(value, options) {
  const { mantissa, exponent } = pgfplotstableScientificParts(value, options);
  // Native sci sep align replaces the exponent marker with the r@{}l column
  // separator. Retain that semantic division until the generic tabular scene
  // layout measures and positions both math fragments.
  return `\\tikzkitscialign{${mantissa}}{${exponent === null ? "" : exponent}}`;
}

function pgfplotstableScientificParts(value, options) {
  if (value === 0) {
    return {
      mantissa: pgfplotstableFormatFixed(0, {
        ...options,
        precision: options["sci precision"] ?? options.precision,
        "fixed zerofill": options["sci zerofill"]
      }),
      exponent: null,
      mantissaValue: 0
    };
  }
  const precision = pgfplotstableNumberPrecision(options["sci precision"] ?? options.precision, 2);
  let exponent = Math.floor(Math.log10(Math.abs(value)));
  let mantissa = value / (10 ** exponent);
  mantissa = Number(mantissa.toFixed(precision));
  if (Math.abs(mantissa) >= 10) {
    mantissa /= 10;
    exponent += 1;
  }
  const zeroFill = pgfplotstableOptionEnabled(options["sci zerofill"]);
  const mantissaText = zeroFill
    ? mantissa.toFixed(precision)
    : String(mantissa);
  return {
    mantissa: pgfplotstableFormatGroupedNumber(mantissaText, options),
    exponent,
    mantissaValue: mantissa
  };
}

function pgfplotstableFormatGroupedNumber(raw, options) {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(String(raw));
  if (!match) return String(raw);
  const [, sign, integerPart, fraction = ""] = match;
  const useComma = pgfplotstableOptionEnabled(options["use comma"]);
  const thousands = useComma ? "." : ",";
  const decimal = useComma ? "," : ".";
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  return `${sign}${groupedInteger}${fraction ? `${decimal}${fraction}` : ""}`;
}

function pgfplotstableNumberPrecision(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(15, Math.floor(number))) : fallback;
}

function pgfplotstableOptionEnabled(value) {
  return value !== undefined && value !== false && !/^(?:false|0|no)$/i.test(String(value));
}

function pgfplotstableOptionIsFalse(value) {
  return value === false || /^(?:false|0|no)$/i.test(String(value));
}

function pgfplotstableDecimalAlignedCell(value, options) {
  if (!pgfplotstableOptionEnabled(options["dec sep align"])) return value;
  const text = String(value || "");
  // The native style splits a number through an r@{}l pair. Keep that exact
  // semantic split as an internal cell marker, then let the generic tabular
  // scene layout put the two halves on a shared decimal anchor.
  if (!/^[+-]?[\d.,]+$/.test(text)) return text;
  const separator = pgfplotstableOptionEnabled(options["use comma"]) ? "," : ".";
  const index = text.lastIndexOf(separator);
  if (index <= 0 || index === text.length - 1) return text;
  return `\\tikzkitdecimal{${text.slice(0, index)}}{${text.slice(index)}}`;
}

function pgfplotstableNumericCell(value) {
  return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(String(value || "").trim());
}

function collectFilecontentsTables(source) {
  const tables = new Map();
  let output = "";
  let index = 0;
  const beginPattern = /\\begin\{(filecontents\*?)\}/g;
  while (index < source.length) {
    beginPattern.lastIndex = index;
    const match = beginPattern.exec(source);
    if (!match) {
      output += source.slice(index);
      break;
    }
    output += source.slice(index, match.index);
    let cursor = match.index + match[0].length;
    const options = parseOptionalOptions(source, cursor);
    cursor = options.end;
    cursor = skipWhitespace(source, cursor);
    const fileName = extractBalanced(source, cursor, "{", "}");
    if (!fileName) {
      output += source.slice(match.index, cursor);
      index = cursor;
      continue;
    }
    cursor = fileName.end;
    const end = `\\end{${match[1]}}`;
    const endIndex = source.indexOf(end, cursor);
    if (endIndex === -1) {
      output += source.slice(match.index, cursor);
      index = cursor;
      continue;
    }
    tables.set(stripOuterBracesText(fileName.content.trim()), trimFilecontentsBody(source.slice(cursor, endIndex)));
    index = endIndex + end.length;
  }
  return { source: output, tables };
}

function trimFilecontentsBody(body) {
  return String(body || "").replace(/^\s*\r?\n/, "").replace(/\s*$/, "");
}

function withFilecontentsTableResolver(options, tables) {
  if (!tables?.size) return options;
  return {
    ...options,
    pgfplotsTableResolver(file) {
      const key = stripOuterBracesText(String(file || "").trim());
      if (tables.has(key)) return tables.get(key);
      return options?.pgfplotsTableResolver?.(file);
    }
  };
}

function replacePgfplotstableReferences(source, tables) {
  let output = String(source);
  for (const [name, table] of tables.entries()) {
    const pattern = new RegExp(`\\{\\s*\\\\${escapeRegExp(name)}\\s*\\}`, "g");
    output = output.replace(pattern, `{${table}}`);
  }
  return output;
}

function expandPgfplotsGroupplots(source, diagnostics, options) {
  let output = "";
  let index = 0;
  const begin = "\\begin{groupplot}";
  const end = "\\end{groupplot}";
  while (index < source.length) {
    const beginIndex = source.indexOf(begin, index);
    if (beginIndex === -1) {
      output += source.slice(index);
      break;
    }
    output += source.slice(index, beginIndex);
    let cursor = beginIndex + begin.length;
    const rawOptions = parseOptionalOptions(source, cursor);
    cursor = rawOptions.end;
    const endIndex = source.indexOf(end, cursor);
    if (endIndex === -1) {
      diagnostics.push({ severity: "warning", message: "Unclosed pgfplots groupplot environment" });
      output += source.slice(beginIndex);
      break;
    }
    output += renderGroupplotAsAxes(rawOptions.raw, source.slice(cursor, endIndex), options, diagnostics);
    index = endIndex + end.length;
  }
  return output;
}

function expandPgfplotsInvokeForeach(source, diagnostics) {
  let output = "";
  let cursor = 0;
  const command = "\\pgfplotsinvokeforeach";
  while (cursor < source.length) {
    const start = source.indexOf(command, cursor);
    if (start === -1) {
      output += source.slice(cursor);
      break;
    }
    if (!isTeXCommandBoundary(source, start + command.length)) {
      output += source.slice(cursor, start + command.length);
      cursor = start + command.length;
      continue;
    }
    output += source.slice(cursor, start);
    let index = skipWhitespace(source, start + command.length);
    const list = extractBalanced(source, index, "{", "}");
    if (!list) {
      diagnostics.push({ severity: "warning", message: "Malformed \\pgfplotsinvokeforeach list" });
      output += command;
      cursor = start + command.length;
      continue;
    }
    index = skipWhitespace(source, list.end);
    const body = extractBalanced(source, index, "{", "}");
    if (!body) {
      diagnostics.push({ severity: "warning", message: "Malformed \\pgfplotsinvokeforeach body" });
      output += source.slice(start, list.end);
      cursor = list.end;
      continue;
    }
    output += expandPgfplotsInvokeForeachList(list.content)
      .map((value) => body.content.replace(/#1/g, value))
      .join("\n");
    cursor = body.end;
  }
  return output;
}

function expandPgfplotsInvokeForeachList(raw) {
  const parts = splitTopLevel(String(raw || ""), ",").map((part) => part.trim()).filter(Boolean);
  const expanded = [];
  for (let index = 0; index < parts.length; index += 1) {
    const inlineRange = parts[index].match(/^(-?\d+(?:\.\d+)?)\s*,?\s*\.\.\.\s*,?\s*(-?\d+(?:\.\d+)?)$/);
    if (inlineRange) {
      expanded.push(...numericRangeValues(Number(inlineRange[1]), Number(inlineRange[2])));
      continue;
    }
    if (parts[index] === "..." && expanded.length && index + 1 < parts.length) {
      const values = numericRangeValues(Number(expanded.at(-1)), Number(parts[index + 1]), { skipFirst: true });
      if (values.length) {
        expanded.push(...values);
        index += 1;
        continue;
      }
    }
    expanded.push(parts[index]);
  }
  return expanded;
}

function numericRangeValues(start, end, options = {}) {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
  const step = end >= start ? 1 : -1;
  const values = [];
  for (let value = options.skipFirst ? start + step : start; step > 0 ? value <= end : value >= end; value += step) {
    values.push(String(value));
  }
  return values;
}

function renderGroupplotAsAxes(rawOptions, body, _options, diagnostics = []) {
  const baseOptions = parseOptions(rawOptions);
  const groupOptions = parseOptions(baseOptions["group style"] || "");
  delete baseOptions["group style"];
  const size = parseGroupplotSize(groupOptions["group size"]);
  const horizontalSep = parseDimension(groupOptions["horizontal sep"] || "1cm", {});
  const verticalSep = parseDimension(groupOptions["vertical sep"] || "1cm", {});
  const plots = parseNextGroupplots(body);
  const capacity = size.columns * size.rows;
  if (plots.length > capacity) {
    diagnostics.push({
      severity: "warning",
      message: `PGFPlots groupplot contains ${plots.length} plots but group size allows ${capacity}; extra plots are ignored`
    });
  }
  const groupName = String(groupOptions["group name"] || "group").trim() || "group";
  const everyPlotOptions = groupplotStyleOptions(groupOptions["every plot/.style"] ?? groupOptions["every plot"]);
  const placed = [];
  for (const [index, plot] of plots.slice(0, capacity).entries()) {
    const column = index % size.columns;
    const row = Math.floor(index / size.columns);
    const axisOptions = applyGroupplotEdgeDescriptions({
      ...baseOptions,
      ...everyPlotOptions,
      ...groupplotCellStyleOptions(groupOptions, column, row),
      ...plot.options
    }, groupOptions, { column, row, size });
    // PGFPlots defaults `try min ticks` to four. Scope that native default to
    // groupplots while the broader axis tick planner retains its existing API.
    if (axisOptions["try min ticks"] === undefined) axisOptions["try min ticks"] = 4;
    if (groupplotOptionEnabled(axisOptions["group/empty plot"])) axisOptions["hide axis"] = true;
    delete axisOptions["group/empty plot"];
    const geometry = groupplotAxisGeometry(axisOptions);
    const left = column > 0 ? placed[index - 1] : null;
    const above = row > 0 ? placed[index - size.columns] : null;
    const x = left ? left.x + left.geometry.width + horizontalSep : 0;
    const y = above ? above.y - verticalSep - geometry.height : 0;
    axisOptions.name = `${groupName} c${column + 1}r${row + 1}`;
    axisOptions.at = `(${roundTikzNumber(x)}cm,${roundTikzNumber(y)}cm)`;
    delete axisOptions.anchor;
    placed.push({ x, y, geometry, axisOptions, body: plot.body });
  }
  return placed
    .map((plot) => `\\begin{axis}[${formatPgfplotsOptionList(plot.axisOptions)}]\n${plot.body}\n\\end{axis}`)
    .join("\n");
}

function groupplotStyleOptions(raw) {
  if (raw === undefined || raw === null || raw === true || raw === false) return {};
  return parseOptions(String(raw).trim().replace(/^\{([\s\S]*)\}$/, "$1"));
}

function groupplotCellStyleOptions(groupOptions = {}, column = 0, row = 0) {
  const key = `plot c${column + 1}r${row + 1}`;
  return {
    ...groupplotStyleOptions(groupOptions[`${key}/.style`] ?? groupOptions[key]),
    ...groupplotStyleOptions(groupOptions[`${key}/.append style`])
  };
}

function groupplotAxisGeometry(axisOptions = {}) {
  const ranges = {
    xMin: groupplotNumericOption(axisOptions.xmin, 0),
    xMax: groupplotNumericOption(axisOptions.xmax, 1),
    yMin: groupplotNumericOption(axisOptions.ymin, 0),
    yMax: groupplotNumericOption(axisOptions.ymax, 1)
  };
  if (ranges.xMin === ranges.xMax) ranges.xMax = ranges.xMin + 1;
  if (ranges.yMin === ranges.yMax) ranges.yMax = ranges.yMin + 1;
  const geometry = createAxisGeometry({ ...axisOptions, at: "(0,0)" }, ranges);
  return { width: geometry.width, height: geometry.height };
}

function groupplotNumericOption(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const numeric = evaluateMath(String(value));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function applyGroupplotEdgeDescriptions(axisOptions = {}, groupOptions = {}, position = {}) {
  const result = { ...axisOptions };
  const isTop = position.row === 0;
  const isBottom = position.row === position.size.rows - 1;
  const isLeft = position.column === 0;
  const isRight = position.column === position.size.columns - 1;
  const suppressXLabels = groupplotEdgeSuppresses(groupOptions, "xlabels at", isTop, isBottom, isLeft, isRight);
  const suppressYLabels = groupplotEdgeSuppresses(groupOptions, "ylabels at", isTop, isBottom, isLeft, isRight);
  const suppressXTickLabels = groupplotEdgeSuppresses(groupOptions, "xticklabels at", isTop, isBottom, isLeft, isRight);
  const suppressYTickLabels = groupplotEdgeSuppresses(groupOptions, "yticklabels at", isTop, isBottom, isLeft, isRight);
  const suppressXDescriptions = groupplotEdgeSuppresses(groupOptions, "x descriptions at", isTop, isBottom, isLeft, isRight);
  const suppressYDescriptions = groupplotEdgeSuppresses(groupOptions, "y descriptions at", isTop, isBottom, isLeft, isRight);
  if (suppressXLabels || suppressXDescriptions) {
    result.xlabel = "";
    result["x label"] = "";
  }
  if (suppressYLabels || suppressYDescriptions) {
    result.ylabel = "";
    result["y label"] = "";
  }
  if (suppressXTickLabels || suppressXDescriptions) result.xticklabels = "";
  if (suppressYTickLabels || suppressYDescriptions) result.yticklabels = "";
  // PGFPlots keeps the selected labels at their ordinary anchors, but moves
  // the retained outer-edge tick labels: top x descriptions use the upper
  // box edge and right y descriptions use the right box edge. Preserve that
  // axis option so the generic lowering reserves and renders those ticks.
  if (groupplotEdgeUsesOuterSide(groupOptions, "xlabels at", "top", isTop)
    || groupplotEdgeUsesOuterSide(groupOptions, "xticklabels at", "top", isTop)
    || groupplotEdgeUsesOuterSide(groupOptions, "x descriptions at", "top", isTop)) {
    result["xticklabel pos"] = "upper";
  }
  if (groupplotEdgeUsesOuterSide(groupOptions, "ylabels at", "right", isRight)
    || groupplotEdgeUsesOuterSide(groupOptions, "yticklabels at", "right", isRight)
    || groupplotEdgeUsesOuterSide(groupOptions, "y descriptions at", "right", isRight)) {
    result["yticklabel pos"] = "right";
  }
  return result;
}

function groupplotEdgeUsesOuterSide(groupOptions, key, edge, onEdge) {
  if (!onEdge) return false;
  const value = String(groupOptions[key] || "").trim().toLowerCase();
  if (edge === "top") return value === "edge top" || value === "top" || value === "upper";
  return value === "edge right" || value === "right";
}

function groupplotEdgeSuppresses(groupOptions, key, isTop, isBottom, isLeft, isRight) {
  const value = String(groupOptions[key] || "all").trim().toLowerCase();
  if (!value || value === "all") return false;
  if (key.startsWith("x")) {
    if (value === "edge bottom" || value === "bottom" || value === "lower") return !isBottom;
    if (value === "edge top" || value === "top" || value === "upper") return !isTop;
  } else {
    if (value === "edge left" || value === "left") return !isLeft;
    if (value === "edge right" || value === "right") return !isRight;
  }
  return false;
}

function groupplotOptionEnabled(value) {
  if (value === undefined || value === null || value === false) return false;
  return !["false", "0", "off", "none", "no"].includes(String(value).trim().toLowerCase());
}

function parseGroupplotSize(value) {
  const match = String(value || "").match(/(\d+)\s*by\s*(\d+)/i);
  return {
    columns: Math.max(1, Number(match?.[1] || 1)),
    rows: Math.max(1, Number(match?.[2] || 1))
  };
}

function parseNextGroupplots(body) {
  const plots = [];
  let index = 0;
  while (index < body.length) {
    const start = body.indexOf("\\nextgroupplot", index);
    if (start === -1) break;
    let cursor = start + "\\nextgroupplot".length;
    const parsedOptions = parseOptionalOptions(body, cursor);
    cursor = parsedOptions.end;
    const next = body.indexOf("\\nextgroupplot", cursor);
    const plotBody = body.slice(cursor, next === -1 ? body.length : next);
    plots.push({ options: parseOptions(parsedOptions.raw), body: plotBody.trim() });
    index = next === -1 ? body.length : next;
  }
  if (!plots.length && body.trim()) plots.push({ options: {}, body: body.trim() });
  return plots;
}

function formatPgfplotsOptionList(options) {
  return Object.entries(options)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([key, value]) => (value === true ? key : `${key}={${value}}`))
    .join(",");
}

function expandPgfganttCharts(source, diagnostics) {
  let output = "";
  let index = 0;
  const begin = "\\begin{ganttchart}";
  const end = "\\end{ganttchart}";
  while (index < source.length) {
    const beginIndex = source.indexOf(begin, index);
    if (beginIndex === -1) {
      output += source.slice(index);
      break;
    }
    output += source.slice(index, beginIndex);
    let cursor = beginIndex + begin.length;
    const rawOptions = parseOptionalOptions(source, cursor);
    cursor = rawOptions.end;
    cursor = skipWhitespace(source, cursor);
    const startArg = extractBalanced(source, cursor, "{", "}");
    if (!startArg) {
      output += source.slice(beginIndex, cursor);
      index = cursor;
      continue;
    }
    cursor = skipWhitespace(source, startArg.end);
    const endArg = extractBalanced(source, cursor, "{", "}");
    if (!endArg) {
      output += source.slice(beginIndex, cursor);
      index = cursor;
      continue;
    }
    cursor = endArg.end;
    const endIndex = source.indexOf(end, cursor);
    if (endIndex === -1) {
      diagnostics.push({ severity: "warning", message: "Unclosed pgfgantt ganttchart environment" });
      output += source.slice(beginIndex);
      break;
    }
    output += renderGanttChartAsTikz(rawOptions.raw, startArg.content, endArg.content, source.slice(cursor, endIndex));
    index = endIndex + end.length;
  }
  return output;
}

function renderGanttChartAsTikz(rawOptions, startRaw, endRaw, body) {
  const options = parseOptions(rawOptions);
  const start = Number(startRaw) || 1;
  const end = Number(endRaw) || start;
  const xUnit = parseDimension(options["x unit"] || "0.55cm", {});
  const yUnitTitle = parseDimension(options["y unit title"] || "0.5cm", {});
  const yUnitChart = parseDimension(options["y unit chart"] || "1cm", {});
  const inlineChart = options.inline === true || String(options.inline || "").trim() === "true";
  const vgridStyles = ganttGridStyles(options.vgrid);
  const hgridStyles = ganttGridStyles(options.hgrid);
  const commands = [];
  const ganttElements = new Map();
  const implicitLinks = [];
  let ganttElementIndex = 0;
  let lastGanttElementName = "";
  const registerGanttElement = (row, bounds) => {
    const currentElementName = ganttElementName(row, ganttElementIndex);
    if (row.linked && lastGanttElementName) {
      implicitLinks.push({ command: "ganttlink", options: row.options, args: [lastGanttElementName, currentElementName] });
    }
    ganttElements.set(currentElementName, bounds);
    lastGanttElementName = currentElementName;
    ganttElementIndex += 1;
  };
  const totalSlots = Math.max(1, end - start + 1);
  const entries = parseGanttCommands(body);
  const chartEntries = entries.filter((entry) => entry.command !== "ganttlink");
  const rowCount = Math.max(1, ...chartEntries.map((entry) => entry.rowIndex + 1));
  const titleRows = new Set(chartEntries.filter((entry) => entry.command === "gantttitle").map((entry) => entry.rowIndex));
  const rowHeights = Array.from({ length: rowCount }, (_unused, rowIndex) => (titleRows.has(rowIndex) ? yUnitTitle : yUnitChart));
  const rowTops = [];
  let chartHeight = 0;
  for (const rowHeight of rowHeights) {
    rowTops.push(-chartHeight);
    chartHeight += rowHeight;
  }
  const chartWidth = totalSlots * xUnit;
  commands.push(`\\draw[draw=black!45,fill=white,line width=0.25pt] (0,0) rectangle (${roundTikzNumber(chartWidth)},${roundTikzNumber(-chartHeight)});`);
  if (vgridStyles.length) {
    for (let slot = 1; slot < totalSlots; slot += 1) {
      const x = slot * xUnit;
      commands.push(`\\draw[${ganttGridStyleAt(vgridStyles, slot - 1)},line width=0.2pt] (${roundTikzNumber(x)},0) -- (${roundTikzNumber(x)},${roundTikzNumber(-chartHeight)});`);
    }
  }
  if (hgridStyles.length) {
    for (let rowIndex = 1; rowIndex < rowCount; rowIndex += 1) {
      const y = rowTops[rowIndex];
      commands.push(`\\draw[${ganttGridStyleAt(hgridStyles, rowIndex - 1)},line width=0.2pt] (0,${roundTikzNumber(y)}) -- (${roundTikzNumber(chartWidth)},${roundTikzNumber(y)});`);
    }
  }
  const titleSlots = new Map();
  chartEntries.forEach((row) => {
    const rowIndex = row.rowIndex;
    const rowTop = rowTops[rowIndex] ?? 0;
    const rowHeight = rowHeights[rowIndex] ?? yUnitChart;
    const top = rowTop;
    const bottom = top - rowHeight;
    const midY = (top + bottom) / 2;
    if (row.command === "gantttitle") {
      const span = Math.max(1, Number(row.args[1]) || totalSlots);
      const slot = titleSlots.get(rowIndex) || 0;
      const leftShift = ganttNumberOption(row, options, "title left shift", 0);
      const rightShift = ganttNumberOption(row, options, "title right shift", 0);
      const topShift = ganttNumberOption(row, options, "title top shift", 0);
      const titleHeight = ganttNumberOption(row, options, "title height", 0.6);
      const x0 = (slot + leftShift) * xUnit;
      const x1 = (slot + span + rightShift) * xUnit;
      titleSlots.set(rowIndex, slot + span);
      const titleTop = top - topShift * yUnitTitle;
      const titleBottom = titleTop - titleHeight * yUnitTitle;
      const titleFont = ganttFontOption(row, options, "title label font", "\\small");
      // pgfgantt defines its default title style as `draw, fill=white`.
      // Keep the title surface separate from the canvas/grid beneath it.
      commands.push(`\\draw[fill=white,draw=black,line width=0.3pt] (${roundTikzNumber(x0)},${roundTikzNumber(titleTop)}) rectangle (${roundTikzNumber(x1)},${roundTikzNumber(titleBottom)});`);
      commands.push(`\\node[font=${titleFont}] at (${roundTikzNumber((x0 + x1) / 2)},${roundTikzNumber((titleTop + titleBottom) / 2)}) {${row.args[0] || ""}};`);
      return;
    }
    if (row.command === "ganttbar" || row.command === "ganttgroup") {
      const from = Number(row.args[1]);
      const to = Number(row.args[2]);
      const elementName = row.command === "ganttgroup" ? "group" : "bar";
      const leftShift = ganttNumberOption(row, options, `${elementName} left shift`, row.command === "ganttgroup" ? -0.1 : 0);
      const rightShift = ganttNumberOption(row, options, `${elementName} right shift`, row.command === "ganttgroup" ? 0.1 : 0);
      const topShift = ganttNumberOption(row, options, `${elementName} top shift`, row.command === "ganttgroup" ? 0.4 : 0.3);
      const elementHeight = ganttNumberOption(row, options, `${elementName} height`, row.command === "ganttgroup" ? 0.2 : 0.4);
      const x0 = (Number.isFinite(from) ? from - start + leftShift : leftShift) * xUnit;
      const x1 = Math.max(x0 + xUnit * 0.25, ((Number.isFinite(to) ? to - start + 1 + rightShift : totalSlots + rightShift) * xUnit));
      const rowInline = inlineChart || row.options.inline === true || String(row.options.inline || "").trim() === "true";
      const fill = ganttElementFill(row, row.command === "ganttgroup" ? "black" : "white");
      if (row.command === "ganttgroup") {
        const y = top - topShift * yUnitChart;
        const h = elementHeight * yUnitChart;
        commands.push(`\\draw[fill=${fill},draw=black,line width=0.35pt] (${roundTikzNumber(x0)},${roundTikzNumber(y)}) rectangle (${roundTikzNumber(x1)},${roundTikzNumber(y - h)});`);
        const labelX = rowInline ? (x0 + x1) / 2 : 0;
        const anchor = rowInline ? "south" : "east";
        const labelFont = ganttFontOption(row, options, "group label font", "\\normalsize\\bfseries");
        commands.push(`\\node[anchor=${anchor},font=${labelFont}] at (${roundTikzNumber(labelX)},${roundTikzNumber(y - h / 2)}) {${row.args[0] || ""}};`);
        registerGanttElement(row, { x0, x1, top: y, bottom: y - h });
        return;
      }
      const yUpper = top - topShift * yUnitChart;
      const yLower = yUpper - elementHeight * yUnitChart;
      commands.push(`\\draw[fill=${fill},draw=black,line width=0.35pt] (${roundTikzNumber(x0)},${roundTikzNumber(yUpper)}) rectangle (${roundTikzNumber(x1)},${roundTikzNumber(yLower)});`);
      const labelX = rowInline ? (x0 + x1) / 2 : 0;
      const labelY = (yUpper + yLower) / 2;
      const anchor = rowInline ? "center" : "east";
      const labelFont = ganttFontOption(row, options, "bar label font", "\\normalsize");
      commands.push(`\\node[anchor=${anchor},font=${labelFont}] at (${roundTikzNumber(labelX)},${roundTikzNumber(labelY)}) {${row.args[0] || ""}};`);
      registerGanttElement(row, { x0, x1, top: yUpper, bottom: yLower });
      return;
    }
    if (row.command === "ganttmilestone") {
      const at = Number(row.args[1]);
      // The source derives a one-slot milestone from left/right shifts .6/.4
      // and top/height .3/.4. Its diamond therefore centers on the slot, not
      // between slots, and uses asymmetric horizontal/vertical half extents.
      const x = Math.max(0, (Number.isFinite(at) ? at - start + 1 : 1) * xUnit);
      const halfWidth = xUnit * 0.4;
      const halfHeight = yUnitChart * 0.2;
      const fill = ganttElementFill(row, "black");
      commands.push(`\\draw[fill=${fill},draw=black,line width=0.35pt] (${roundTikzNumber(x)},${roundTikzNumber(midY + halfHeight)}) -- (${roundTikzNumber(x + halfWidth)},${roundTikzNumber(midY)}) -- (${roundTikzNumber(x)},${roundTikzNumber(midY - halfHeight)}) -- (${roundTikzNumber(x - halfWidth)},${roundTikzNumber(midY)}) -- cycle;`);
      const rowInline = inlineChart || row.options.inline === true || String(row.options.inline || "").trim() === "true";
      const labelX = rowInline ? x : 0;
      const anchor = rowInline ? "south" : "east";
      const labelFont = ganttFontOption(row, options, "milestone label font", "\\itshape");
      commands.push(`\\node[anchor=${anchor},font=${labelFont}] at (${roundTikzNumber(labelX)},${roundTikzNumber(midY)}) {${row.args[0] || ""}};`);
      registerGanttElement(row, {
        x0: x - halfWidth,
        x1: x + halfWidth,
        top: midY + halfHeight,
        bottom: midY - halfHeight
      });
    }
  });
  for (const row of [...implicitLinks, ...entries]) {
    if (row.command !== "ganttlink") continue;
    const link = lowerGanttLink(row, ganttElements, options, xUnit);
    if (link) commands.push(link);
  }
  return `\\begin{tikzpicture}\n${commands.join("\n")}\n\\end{tikzpicture}`;
}

function ganttElementName(row, index) {
  const explicitName = String(row?.options?.name || "").trim();
  return explicitName || `elem${index}`;
}

function lowerGanttLink(row, elements, chartOptions, xUnit) {
  const source = elements.get(String(row.args?.[0] || "").trim());
  const target = elements.get(String(row.args?.[1] || "").trim());
  if (!source || !target) return null;

  const requestedType = String(row.options?.["link type"] ?? chartOptions?.["link type"] ?? "auto").trim() || "auto";
  const linkMid = ganttNumberOption(row, chartOptions, "link mid", 0.5);
  const linkBulge = ganttNumberOption(row, chartOptions, "link bulge", 0.4);
  const linkTolerance = ganttNumberOption(row, chartOptions, "link tolerance", 0.6);
  const style = ganttLinkStyle(row, chartOptions);
  const label = ganttLinkLabel(row, chartOptions, requestedType);
  const direct = (from, to, text = label) => ganttLinkPath([from, to], style, text);

  if (requestedType === "dr") {
    const from = ganttElementAnchor(source, "south");
    const to = ganttElementAnchor(target, "west");
    return ganttLinkPath([from, { x: from.x, y: to.y }, to], style, label);
  }
  if (requestedType === "s-s") return direct(ganttElementAnchor(source, "south west"), ganttElementAnchor(target, "north west"));
  if (requestedType === "s-f") return direct(ganttElementAnchor(source, "on bottom=0"), ganttElementAnchor(target, "on top=1"));
  if (requestedType === "f-s") return direct(ganttElementAnchor(source, "south east"), ganttElementAnchor(target, "north west"));
  if (requestedType === "f-f") return direct(ganttElementAnchor(source, "south east"), ganttElementAnchor(target, "north east"));

  const from = ganttElementAnchor(source, "east");
  const to = ganttElementAnchor(target, "west");
  const routeType = requestedType === "auto"
    // pgfgantt compares the anchor displacement to one TeX point. A link on
    // the same horizontal row is diagonal; links across chart rows choose a
    // RDR or RDLDR route based on the horizontal tolerance.
    ? (Math.abs(from.y - to.y) <= 1 / 28.45274
      ? "r"
      : (to.x - from.x >= linkTolerance * xUnit ? "rdr" : "rdldr"))
    : requestedType;
  if (routeType === "r") return direct(from, to);

  const middleX = from.x + (to.x - from.x) * Math.min(1, Math.max(0, linkMid));
  if (routeType === "rdr") {
    return ganttLinkPath([from, { x: middleX, y: from.y }, { x: middleX, y: to.y }, to], style, label);
  }
  if (routeType === "rdldr") {
    const bulge = Math.max(xUnit * 0.2, Math.abs(to.x - from.x) * Math.max(0, linkBulge));
    const middleY = from.y + (to.y - from.y) * Math.min(1, Math.max(0, linkMid));
    return ganttLinkPath([
      from,
      { x: from.x + bulge, y: from.y },
      { x: from.x + bulge, y: middleY },
      { x: to.x - bulge, y: middleY },
      { x: to.x - bulge, y: to.y },
      to
    ], style, label);
  }
  return direct(from, to);
}

function ganttLinkStyle(row, chartOptions) {
  return [
    "-latex",
    "rounded corners=1pt",
    chartOptions?.link,
    chartOptions?.["link/.append style"],
    row.options?.link,
    row.options?.["link/.append style"]
  ]
    .map((value) => stripOuterBracesText(String(value || "")).trim())
    .filter(Boolean)
    .join(",");
}

function ganttLinkLabel(row, chartOptions, linkType) {
  const explicit = row.options?.["link label"] ?? chartOptions?.["link label"];
  if (explicit !== undefined) return stripOuterBracesText(String(explicit));
  const labels = {
    "s-s": "SS",
    "s-f": "SF",
    "f-s": "FS",
    "f-f": "FF"
  };
  return labels[linkType] || "";
}

function ganttLinkPath(points, style, label) {
  if (!points.length) return null;
  const path = points
    .map((point, index) => `${index ? "-- " : ""}(${roundTikzNumber(point.x)},${roundTikzNumber(point.y)})`)
    .join(" ");
  const labelCommand = label
    ? ` node[pos=.5,anchor=west,font=\\scriptsize\\itshape] {${label}}`
    : "";
  return `\\draw[${style}] ${path}${labelCommand};`;
}

function ganttElementAnchor(element, anchor) {
  const text = String(anchor || "center").trim().toLowerCase();
  const onEdge = text.match(/^on\s+(top|bottom)\s*=\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/);
  if (onEdge) {
    const position = Math.min(1, Math.max(0, Number(onEdge[2])));
    return {
      x: element.x0 + (element.x1 - element.x0) * position,
      y: onEdge[1] === "top" ? element.top : element.bottom
    };
  }
  const x = text.includes("west") ? element.x0 : text.includes("east") ? element.x1 : (element.x0 + element.x1) / 2;
  const y = text.includes("north") ? element.top : text.includes("south") ? element.bottom : (element.top + element.bottom) / 2;
  return { x, y };
}

function ganttNumberOption(row, chartOptions, key, fallback) {
  const value = row?.options?.[key] ?? chartOptions?.[key];
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function ganttFontOption(row, chartOptions, key, fallback) {
  const value = row?.options?.[key] ?? chartOptions?.[key];
  const font = String(value || "").trim();
  return font || fallback;
}

function ganttGridStyles(value) {
  if (value === undefined || value === false || String(value || "").trim().toLowerCase() === "false") return [];
  if (value === true || String(value || "").trim().toLowerCase() === "true") {
    return [{ count: 1, style: "dotted" }];
  }

  const chunks = splitTopLevel(stripOuterBracesText(String(value)), ",");
  const styles = [];
  for (const chunk of chunks) {
    const text = chunk.trim();
    if (!text) continue;
    const repeated = text.match(/^\*\s*(?:\{\s*(\d+)\s*\}|(\d+))\s*\{([\s\S]*)\}$/);
    if (repeated) {
      const count = Math.max(1, Number(repeated[1] || repeated[2]) || 1);
      const style = stripOuterBracesText(repeated[3]);
      if (style) styles.push({ count, style });
      continue;
    }
    const style = stripOuterBracesText(text);
    if (style) styles.push({ count: 1, style });
  }
  return styles.length ? styles : [{ count: 1, style: "dotted" }];
}

function ganttGridStyleAt(styles, index) {
  const period = styles.reduce((sum, entry) => sum + entry.count, 0);
  if (!period) return "dotted";
  let remaining = ((index % period) + period) % period;
  for (const entry of styles) {
    if (remaining < entry.count) return entry.style;
    remaining -= entry.count;
  }
  return styles[styles.length - 1].style;
}

function parseGanttCommands(body) {
  const rows = [];
  let index = 0;
  const pattern = /\\(gantttitle|ganttlinkedbar|ganttlinkedgroup|ganttlinkedmilestone|ganttbar|ganttgroup|ganttmilestone|ganttlink)\b/g;
  let rowIndex = 0;
  let match;
  while ((match = pattern.exec(body))) {
    const between = body.slice(index, match.index);
    if (/\\\\/.test(between) && rows.length) rowIndex += 1;
    let cursor = match.index + match[0].length;
    const parsedOptions = parseOptionalOptions(body, cursor);
    cursor = parsedOptions.end;
    const args = [];
    const sourceCommand = match[1];
    const linked = sourceCommand.startsWith("ganttlinked");
    const command = linked ? sourceCommand.replace("ganttlinked", "gantt") : sourceCommand;
    const argumentCount = command === "ganttmilestone" || command === "ganttlink" ? 2 : 3;
    while (args.length < argumentCount) {
      cursor = skipWhitespace(body, cursor);
      const arg = extractBalanced(body, cursor, "{", "}");
      if (!arg) break;
      args.push(arg.content.trim());
      cursor = arg.end;
    }
    rows.push({ command, linked, options: parseOptions(parsedOptions.raw), args, rowIndex });
    index = cursor;
    pattern.lastIndex = Math.max(pattern.lastIndex, index);
  }
  return rows;
}

function ganttElementFill(row, fallback) {
  const elementName = row.command === "ganttgroup"
    ? "group"
    : row.command === "ganttmilestone"
      ? "milestone"
      : "bar";
  const styleKey = `${elementName}/.append style`;
  const directKey = elementName;
  const fromAppend = extractFillFromTikzOptionText(row.options?.[styleKey]);
  const fromDirect = extractFillFromTikzOptionText(row.options?.[directKey]);
  return fromAppend || fromDirect || fallback;
}

function extractFillFromTikzOptionText(value) {
  const text = stripOuterBracesText(String(value || ""));
  const match = text.match(/(?:^|,)\s*fill\s*=\s*([^,}]+)/);
  return match ? match[1].trim() : null;
}

function roundTikzNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return String(Math.round(number * 10000) / 10000);
}

function expandDatavisualizationFunctions(source, diagnostics) {
  const rawText = String(source);
  if (!rawText.includes("\\datavisualization")) return rawText;
  const seedInfo = collectDatavisualizationRandomSeed(rawText);
  const styleSheetInfo = collectDatavisualizationStyleSheetDefinitions(seedInfo.source);
  const namedStyleInfo = collectDatavisualizationNamedStyles(styleSheetInfo.source);
  const groupInfo = collectDatavisualizationDataGroups(namedStyleInfo.source, diagnostics);
  const text = groupInfo.source;

  let output = "";
  let cursor = 0;
  while (cursor < text.length) {
    const found = findNextDatavisualization(text, cursor);
    if (!found) {
      output += text.slice(cursor);
      break;
    }
    output += text.slice(cursor, found.start);
    const parsed = parseDatavisualizationInvocation(text, found, diagnostics, {
      dataGroups: groupInfo.groups,
      namedStyles: namedStyleInfo.styles
    });
    if (!parsed) {
      output += text.slice(found.start, found.commandEnd);
      cursor = found.commandEnd;
      continue;
    }
    output += renderDatavisualizationAsPgfplots(parsed, {
      randomSeed: seedInfo.seed,
      dataGroups: groupInfo.groups,
      customStyleSheets: styleSheetInfo.styleSheets,
      namedStyles: namedStyleInfo.styles
    });
    cursor = parsed.end;
  }
  return output;
}

function collectDatavisualizationNamedStyles(source) {
  const styles = new Map();
  const text = String(source || "");
  let output = "";
  let cursor = 0;
  const command = "\\tikzdatavisualizationset";
  while (cursor < text.length) {
    const start = text.indexOf(command, cursor);
    if (start === -1) {
      output += text.slice(cursor);
      break;
    }
    output += text.slice(cursor, start);
    let bodyStart = skipWhitespace(text, start + command.length);
    const body = extractBalanced(text, bodyStart, "{", "}");
    if (!body) {
      output += text.slice(start, start + command.length);
      cursor = start + command.length;
      continue;
    }
    const parsed = parseDatavisualizationNamedStyleDefinitions(body.content);
    if (!parsed.recognized) {
      output += text.slice(start, body.end);
      cursor = body.end;
      continue;
    }
    for (const [name, style] of parsed.styles) styles.set(name, style);
    let end = skipWhitespace(text, body.end);
    if (text[end] === ";") end += 1;
    cursor = end;
  }
  return { source: output, styles };
}

function parseDatavisualizationNamedStyleDefinitions(body) {
  const styles = new Map();
  let recognized = 0;
  let unrecognized = 0;
  for (const rawPart of splitTopLevel(String(body || ""), ",")) {
    const part = rawPart.trim();
    if (!part) continue;
    const styleMatch = part.match(/^([^/=][^/]*)\/\.(?:style|append\s+style)\s*=\s*([\s\S]+)$/i);
    if (!styleMatch) {
      unrecognized += 1;
      continue;
    }
    const name = normalizeDatavisualizationNamedStyleName(styleMatch[1]);
    const style = stripOuterBracesText(styleMatch[2].trim());
    if (!name || !style) {
      unrecognized += 1;
      continue;
    }
    const previous = styles.get(name);
    styles.set(name, previous ? `${previous}, ${style}` : style);
    recognized += 1;
  }
  return { recognized: recognized > 0 && unrecognized === 0, styles };
}

function normalizeDatavisualizationNamedStyleName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function expandDatavisualizationNamedStyles(rawOptions = "", namedStyles = new Map(), depth = 0) {
  if (!rawOptions || !namedStyles?.size || depth > 8) return String(rawOptions || "");
  const parts = splitTopLevel(String(rawOptions), ",");
  const expanded = [];
  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part) continue;
    const { key, value } = datavisualizationOptionPart(part);
    const style = namedStyles.get(normalizeDatavisualizationNamedStyleName(key));
    if (style && (value === "" || value === "true")) {
      const nested = expandDatavisualizationNamedStyles(style, namedStyles, depth + 1);
      if (nested) expanded.push(nested);
    } else {
      expanded.push(part);
    }
  }
  return expanded.join(", ");
}

function collectDatavisualizationStyleSheetDefinitions(source) {
  const styleSheets = new Map();
  const text = String(source || "");
  let output = "";
  let cursor = 0;
  while (cursor < text.length) {
    const next = findNextDatavisualizationStyleSheetDeclaration(text, cursor);
    if (!next) {
      output += text.slice(cursor);
      break;
    }
    output += text.slice(cursor, next.index);
    if (next.command === "\\pgfdvdeclarestylesheet") {
      const parsedDeclare = parsePgfDvDeclareStyleSheet(text, next.index);
      if (!parsedDeclare) {
        output += text.slice(next.index, next.index + next.command.length);
        cursor = next.index + next.command.length;
        continue;
      }
      const parsed = parseDatavisualizationStyleSheetDefinitions(parsedDeclare.keys, parsedDeclare.name);
      for (const [name, definition] of parsed.styleSheets) styleSheets.set(name, definition);
      let end = skipWhitespace(text, parsedDeclare.end);
      if (text[end] === ";") end += 1;
      cursor = end;
      continue;
    }
    if (next.command === "\\tikzdvdeclarestylesheetcolorseries") {
      const parsedColorSeries = parseTikzDvDeclareStyleSheetColorSeries(text, next.index);
      if (!parsedColorSeries) {
        output += text.slice(next.index, next.index + next.command.length);
        cursor = next.index + next.command.length;
        continue;
      }
      const sheetName = normalizeDatavisualizationStyleSheetName(parsedColorSeries.name);
      if (sheetName) {
        styleSheets.set(sheetName, {
          entries: new Map(),
          defaultStyle: "",
          colorSeries: {
            model: parsedColorSeries.model,
            start: parsedColorSeries.start,
            step: parsedColorSeries.step
          }
        });
      }
      let end = skipWhitespace(text, parsedColorSeries.end);
      if (text[end] === ";") end += 1;
      cursor = end;
      continue;
    }
    const bodyStart = skipWhitespace(text, next.index + next.command.length);
    const body = extractBalanced(text, bodyStart, "{", "}");
    if (!body) {
      output += text.slice(next.index, next.index + next.command.length);
      cursor = next.index + next.command.length;
      continue;
    }
    const parsed = parseDatavisualizationStyleSheetDefinitions(body.content);
    if (!parsed.recognized) {
      output += text.slice(next.index, body.end);
    } else {
      for (const [name, definition] of parsed.styleSheets) styleSheets.set(name, definition);
      let end = skipWhitespace(text, body.end);
      if (text[end] === ";") end += 1;
      cursor = end;
      continue;
    }
    cursor = body.end;
  }
  return { source: output, styleSheets };
}

function findNextDatavisualizationStyleSheetDeclaration(source, cursor) {
  const commands = ["\\pgfkeys", "\\pgfdvdeclarestylesheet", "\\tikzdvdeclarestylesheetcolorseries"];
  const candidates = commands
    .map((command) => ({ command, index: source.indexOf(command, cursor) }))
    .filter((candidate) => candidate.index !== -1)
    .sort((left, right) => left.index - right.index);
  return candidates[0] || null;
}

function parseTikzDvDeclareStyleSheetColorSeries(source, start) {
  let cursor = start + "\\tikzdvdeclarestylesheetcolorseries".length;
  const args = [];
  for (let index = 0; index < 4; index += 1) {
    cursor = skipWhitespace(source, cursor);
    const arg = extractBalanced(source, cursor, "{", "}");
    if (!arg) return null;
    args.push(arg.content.trim());
    cursor = arg.end;
  }
  const startValues = datavisualizationNumberList(args[2]);
  const stepValues = datavisualizationNumberList(args[3]);
  if (startValues.length < 3 || stepValues.length < 3) return null;
  return {
    name: args[0],
    model: String(args[1] || "").trim().toLowerCase(),
    start: startValues.slice(0, 3),
    step: stepValues.slice(0, 3),
    end: cursor
  };
}

function datavisualizationNumberList(value) {
  return splitTopLevel(String(value || ""), ",")
    .map((part) => Number(String(part).trim()))
    .filter((number) => Number.isFinite(number));
}

function parsePgfDvDeclareStyleSheet(source, start) {
  let cursor = start + "\\pgfdvdeclarestylesheet".length;
  cursor = skipWhitespace(source, cursor);
  const name = extractBalanced(source, cursor, "{", "}");
  if (!name) return null;
  cursor = skipWhitespace(source, name.end);
  const keys = extractBalanced(source, cursor, "{", "}");
  if (!keys) return null;
  return {
    name: name.content.trim(),
    keys: keys.content,
    end: keys.end
  };
}

function parseDatavisualizationStyleSheetDefinitions(body, baseSheetName = "") {
  const styleSheets = new Map();
  let currentSheet = normalizeDatavisualizationStyleSheetName(baseSheetName);
  if (currentSheet) ensureDatavisualizationCustomStyleSheet(styleSheets, currentSheet);
  let recognizedCount = 0;
  let unrecognizedCount = 0;
  for (const rawPart of splitTopLevel(String(body || ""), ",")) {
    const part = rawPart.trim();
    if (!part) continue;
    const cdMatch = part.match(/^\/pgf\/data\s+visualization\/style\s+sheets\/([^/]+)\/\.cd$/i);
    if (cdMatch) {
      currentSheet = normalizeDatavisualizationStyleSheetName(cdMatch[1]);
      ensureDatavisualizationCustomStyleSheet(styleSheets, currentSheet);
      recognizedCount += 1;
      continue;
    }
    const absoluteStyle = part.match(/^\/pgf\/data\s+visualization\/style\s+sheets\/([^/]+)\/([^/]+)\/\.style\s*=\s*([\s\S]+)$/i);
    if (absoluteStyle) {
      const sheetName = normalizeDatavisualizationStyleSheetName(absoluteStyle[1]);
      setDatavisualizationCustomStyleSheetEntry(styleSheets, sheetName, absoluteStyle[2], absoluteStyle[3]);
      recognizedCount += 1;
      continue;
    }
    const relativeStyle = part.match(/^([^/=][^/]*)\/\.style\s*=\s*([\s\S]+)$/i);
    if (relativeStyle && currentSheet) {
      setDatavisualizationCustomStyleSheetEntry(styleSheets, currentSheet, relativeStyle[1], relativeStyle[2]);
      recognizedCount += 1;
      continue;
    }
    unrecognizedCount += 1;
  }
  return { recognized: recognizedCount > 0 && unrecognizedCount === 0, styleSheets };
}

function normalizeDatavisualizationStyleSheetName(name) {
  return String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function ensureDatavisualizationCustomStyleSheet(styleSheets, name) {
  const key = normalizeDatavisualizationStyleSheetName(name);
  if (!key) return null;
  if (!styleSheets.has(key)) styleSheets.set(key, { entries: new Map(), defaultStyle: "" });
  return styleSheets.get(key);
}

function setDatavisualizationCustomStyleSheetEntry(styleSheets, sheetName, rawKey, rawStyle) {
  const definition = ensureDatavisualizationCustomStyleSheet(styleSheets, sheetName);
  if (!definition) return;
  const key = String(rawKey || "").trim();
  const style = stripOuterBracesText(String(rawStyle || "").trim());
  if (!key) return;
  if (key.toLowerCase() === "default style") definition.defaultStyle = style;
  else definition.entries.set(key, style);
}

function collectDatavisualizationDataGroups(source, diagnostics) {
  const groups = new Map();
  let output = "";
  let cursor = 0;
  while (cursor < source.length) {
    const found = findNextDatavisualization(source, cursor);
    if (!found) {
      output += source.slice(cursor);
      break;
    }
    let readCursor = skipWhitespace(source, found.commandEnd);
    if (!source.startsWith("data group", readCursor)) {
      output += source.slice(cursor, found.commandEnd);
      cursor = found.commandEnd;
      continue;
    }
    output += source.slice(cursor, found.start);
    readCursor += "data group".length;
    readCursor = skipWhitespace(source, readCursor);
    const name = extractBalanced(source, readCursor, "{", "}");
    if (!name) {
      diagnostics.push({ severity: "warning", message: "Malformed datavisualization data group name" });
      output += source.slice(found.start, found.commandEnd);
      cursor = found.commandEnd;
      continue;
    }
    readCursor = skipWhitespace(source, name.end);
    if (source[readCursor] !== "=") {
      diagnostics.push({ severity: "warning", message: "Malformed datavisualization data group assignment" });
      output += source.slice(found.start, name.end);
      cursor = name.end;
      continue;
    }
    readCursor = skipWhitespace(source, readCursor + 1);
    const body = extractBalanced(source, readCursor, "{", "}");
    if (!body) {
      diagnostics.push({ severity: "warning", message: "Malformed datavisualization data group body" });
      output += source.slice(found.start, readCursor);
      cursor = readCursor;
      continue;
    }
    groups.set(name.content.trim(), body.content);
    readCursor = skipWhitespace(source, body.end);
    if (source[readCursor] === ";") readCursor += 1;
    cursor = readCursor;
  }
  return { source: output, groups };
}

function collectDatavisualizationRandomSeed(source) {
  let seed = null;
  const stripped = String(source || "").replace(/\\pgfmathsetseed\s*\{([^{}]+)\}/g, (_match, rawSeed) => {
    const parsed = axisNumber(rawSeed, NaN);
    if (Number.isFinite(parsed)) seed = parsed;
    return "";
  });
  return {
    source: stripped,
    seed: Number.isFinite(seed) ? seed : texDefaultRandomSeed()
  };
}

function texDefaultRandomSeed(date = new Date()) {
  const minutesSinceMidnight = date.getHours() * 60 + date.getMinutes();
  return Math.max(1, minutesSinceMidnight * date.getFullYear());
}

function findNextDatavisualization(source, start) {
  const command = "\\datavisualization";
  const commandIndex = source.indexOf(command, start);
  if (commandIndex === -1) return null;
  const tikzStart = findDatavisualizationTikzPrefixStart(source, start, commandIndex);
  const hasTikzPrefix = tikzStart !== null;
  return {
    start: hasTikzPrefix ? tikzStart : commandIndex,
    commandIndex,
    commandEnd: commandIndex + command.length,
    wrapsTikzPicture: hasTikzPrefix
  };
}

function findDatavisualizationTikzPrefixStart(source, start, commandIndex) {
  let cursor = commandIndex;
  while (cursor > start && /\s/.test(source[cursor - 1] || "")) cursor -= 1;

  if (source[cursor - 1] === "]") {
    let depth = 0;
    let optionStart = -1;
    for (let index = cursor - 1; index >= start; index -= 1) {
      const char = source[index];
      if (char === "]") depth += 1;
      if (char === "[") {
        depth -= 1;
        if (depth === 0) {
          optionStart = index;
          break;
        }
      }
    }
    if (optionStart !== -1) {
      cursor = optionStart;
      while (cursor > start && /\s/.test(source[cursor - 1] || "")) cursor -= 1;
    }
  }

  const tikzStart = cursor - "\\tikz".length;
  if (
    tikzStart >= start &&
    source.slice(tikzStart, cursor) === "\\tikz" &&
    !/[A-Za-z@]/.test(source[tikzStart - 1] || "") &&
    !/[A-Za-z@]/.test(source[cursor] || "")
  ) {
    return tikzStart;
  }
  return null;
}

function parseDatavisualizationInvocation(source, found, diagnostics, context = {}) {
  let cursor = found.commandEnd;
  const globalOptions = parseOptionalOptions(source, cursor);
  cursor = globalOptions.end;
  const datasets = [];

  while (cursor < source.length) {
    cursor = skipWhitespace(source, cursor);
    const visualOptions = parseOptionalOptions(source, cursor);
    cursor = visualOptions.end;
    cursor = skipWhitespace(source, cursor);
    if (source.startsWith("data group", cursor)) {
      cursor += "data group".length;
      cursor = skipWhitespace(source, cursor);
      const groupName = extractBalanced(source, cursor, "{", "}");
      if (!groupName) {
        diagnostics.push({ severity: "warning", message: "Could not parse datavisualization data group name" });
        return null;
      }
      const groupBody = context.dataGroups?.get(groupName.content.trim());
      if (!groupBody) {
        diagnostics.push({ severity: "warning", message: `Unknown datavisualization data group ${groupName.content.trim()}` });
        return null;
      }
      datasets.push(...parseDatavisualizationDatasets(groupBody, diagnostics, visualOptions.raw));
      cursor = groupName.end;
      continue;
    }
    if (source.startsWith("data point", cursor)) {
      const pointBlock = parseDatavisualizationPointSequence(source, cursor);
      if (!pointBlock.points.length) {
        diagnostics.push({ severity: "warning", message: "Could not parse datavisualization data point sequence" });
        return null;
      }
      datasets.push({
        visualOptions: visualOptions.raw,
        dataOptions: "",
        body: pointBlock.body
      });
      cursor = pointBlock.end;
      continue;
    }
    if (!source.startsWith("data", cursor)) break;
    cursor += "data".length;
    cursor = skipWhitespace(source, cursor);
    const dataOptions = parseOptionalOptions(source, cursor);
    cursor = dataOptions.end;
    cursor = skipWhitespace(source, cursor);
    const body = extractBalanced(source, cursor, "{", "}");
    if (!body) {
      diagnostics.push({ severity: "warning", message: "Could not parse datavisualization data block" });
      return null;
    }
    datasets.push({
      visualOptions: visualOptions.raw,
      dataOptions: dataOptions.raw,
      body: body.content
    });
    cursor = body.end;
  }

  if (!datasets.length) {
    diagnostics.push({ severity: "warning", message: "Unsupported datavisualization without function data blocks" });
    return null;
  }

  cursor = skipWhitespace(source, cursor);
  if (source[cursor] === ";") cursor += 1;
  return {
    globalOptions: expandDatavisualizationNamedStyles(globalOptions.raw, context.namedStyles),
    datasets,
    wrapsTikzPicture: found.wrapsTikzPicture,
    end: cursor
  };
}

function parseDatavisualizationPointSequence(source, start) {
  const points = [];
  let cursor = start;
  while (cursor < source.length) {
    cursor = skipWhitespace(source, cursor);
    if (!source.startsWith("data point", cursor)) break;
    cursor += "data point".length;
    const options = parseOptionalOptions(source, cursor);
    if (options.end === cursor) break;
    points.push(`data point [${options.raw}]`);
    cursor = options.end;
  }
  return {
    points,
    body: points.join("\n"),
    end: cursor
  };
}

function parseDatavisualizationDatasets(source, diagnostics, visualOptions = "") {
  const datasets = [];
  let cursor = 0;
  while (cursor < source.length) {
    cursor = skipWhitespace(source, cursor);
    if (source.startsWith("data point", cursor)) {
      const pointBlock = parseDatavisualizationPointSequence(source, cursor);
      if (!pointBlock.points.length) {
        diagnostics.push({ severity: "warning", message: "Could not parse datavisualization data group data point sequence" });
        break;
      }
      datasets.push({
        visualOptions,
        dataOptions: "",
        body: pointBlock.body
      });
      cursor = pointBlock.end;
      continue;
    }
    if (!source.startsWith("data", cursor)) {
      const rest = source.slice(cursor).trim();
      if (rest) diagnostics.push({ severity: "warning", message: "Unsupported content in datavisualization data group" });
      break;
    }
    cursor += "data".length;
    const dataOptions = parseOptionalOptions(source, cursor);
    cursor = dataOptions.end;
    cursor = skipWhitespace(source, cursor);
    const body = extractBalanced(source, cursor, "{", "}");
    if (!body) {
      diagnostics.push({ severity: "warning", message: "Could not parse datavisualization data group data block" });
      break;
    }
    datasets.push({
      visualOptions,
      dataOptions: dataOptions.raw,
      body: body.content
    });
    cursor = body.end;
  }
  return datasets;
}

function renderDatavisualizationAsPgfplots(parsed, context = {}) {
  const globalOptions = parseOptions(parsed.globalOptions || "");
  const random = createDatavisualizationRandom(context.randomSeed ?? texDefaultRandomSeed());
  const datasetSpecs = parsed.datasets.map((dataset) => createDatavisualizationDatasetSpec(dataset, random));
  const plotContext = {
    ...context,
    datavisualizationVisualizerCount: datavisualizationDeclaredVisualizerCount(globalOptions)
  };
  const plotSpecs = datasetSpecs.flatMap((datasetSpec, index) => {
    const points = sampleDatavisualizationFunctionData(datasetSpec.data, random);
    return createDatavisualizationPlotsFromPoints(datasetSpec, index, globalOptions, parsed.globalOptions, points, plotContext);
  });
  if (datavisualizationUsesPolarAxes(globalOptions)) {
    return renderDatavisualizationAsPolarTikz(parsed, globalOptions, plotSpecs);
  }
  const cartesianPlotSpecs = datavisualizationApplyCartesianAxisAttributes(plotSpecs, globalOptions);
  const axisScaling = datavisualizationCartesianAxisScalings(globalOptions, cartesianPlotSpecs);
  const scaledCartesianPlotSpecs = datavisualizationApplyCartesianAxisScaling(cartesianPlotSpecs, axisScaling);
  const axisOptions = datavisualizationAxisOptions(parsed.globalOptions, scaledCartesianPlotSpecs, { axisScaling });
  const axisRanges = computeAxisRanges(axisOptions, []);
  const axisGeometry = createAxisGeometry(axisOptions, axisRanges);
  const commands = [`\\begin{axis}[${formatDatavisualizationOptions(axisOptions)}]`];
  const legendContext = {
    axisWidth: parseDimension(String(axisOptions.width || "5cm"), {}),
    axisHeight: parseDimension(String(axisOptions.height || "3.09cm"), {}),
    axisPlotWidth: axisGeometry.width,
    axisPlotHeight: axisGeometry.height,
    axisMarginTop: axisGeometry.margin?.top,
    axisMarginBottom: axisGeometry.margin?.bottom,
    xMin: axisOptions.xmin,
    xMax: axisOptions.xmax,
    yMin: axisOptions.ymin,
    yMax: axisOptions.ymax,
    schoolBookAxes: Boolean(axisOptions["axis school book padding"])
  };
  const legendEntries = [];

  scaledCartesianPlotSpecs.forEach((plot, index) => {
    if (!plot.points.length) return;
    const plotStyleIndex = plot.styleIndex ?? index;
    if (plot.kind === "candlestick") {
      commands.push(...renderDatavisualizationCandlesticks(plot, plotStyleIndex));
      return;
    }
    if (plot.kind === "rectangle") {
      commands.push(...renderDatavisualizationRectangles(plot, plotStyleIndex));
      if (plot.legendLabel) {
        legendEntries.push({ kind: "rectangle", plot });
      }
      return;
    }
    const coordinates = plot.points.map(datavisualizationCoordinate).join(" ");
    if (plot.kind === "scatter" || plot.noLines) {
      const scatterPlotStyle = datavisualizationScatterPlotStyle(plot);
      const style = formatDatavisualizationOptions(scatterPlotStyle);
      commands.push(`\\addplot[${style}] coordinates {${coordinates}};`);
      for (const label of datavisualizationPlotDataLabels(plot)) {
        commands.push(renderDatavisualizationDataLabel(label, axisOptions, scatterPlotStyle, plot));
      }
      if (plot.legendLabel) {
        legendEntries.push({ kind: "scatter", plot });
      }
      return;
    }

    const plotStyle = datavisualizationLinePlotStyle(plotStyleIndex, plot);
    const style = formatDatavisualizationOptions(plotStyle);
    commands.push(`\\addplot[${style}] coordinates {${coordinates}};`);
    for (const pin of datavisualizationPlotPins(plot)) {
      commands.push(...renderDatavisualizationPin(pin, axisOptions, plotStyle, plot));
    }
    for (const label of datavisualizationPlotDataLabels(plot)) {
      commands.push(renderDatavisualizationDataLabel(label, axisOptions, plotStyle, plot));
    }
    if (plot.legendLabel) {
      legendEntries.push({ kind: "line", plot, plotStyle });
    }
  });

  commands.push(...renderDatavisualizationLegendEntryGroups(datavisualizationOrderLegendEntries(legendEntries, parsed.globalOptions, globalOptions), legendContext));
  commands.push("\\end{axis}");
  const body = commands.join("\n");
  if (parsed.wrapsTikzPicture) return `\\begin{tikzpicture}\n${body}\n\\end{tikzpicture}`;
  return body;
}

function datavisualizationOrderLegendEntries(entries = [], globalOptionsRaw = "", globalOptions = {}) {
  const manualEntries = datavisualizationManualLegendEntries(globalOptionsRaw, globalOptions);
  if (!manualEntries.length) return entries;

  const byVisualizer = new Map();
  entries.forEach((entry, index) => {
    const key = String(entry.plot?.visualName || entry.plot?.set || "").trim();
    if (!key) return;
    if (!byVisualizer.has(key)) byVisualizer.set(key, []);
    byVisualizer.get(key).push({ entry, index });
  });

  const ordered = [];
  const used = new Set();
  const parts = splitTopLevel(globalOptionsRaw || "", ",");
  let manualIndex = 0;
  for (const part of parts) {
    const { key } = datavisualizationOptionPart(part);
    if (!key) continue;
    if (key === "new legend entry") {
      if (manualIndex < manualEntries.length) ordered.push(manualEntries[manualIndex]);
      manualIndex += 1;
      continue;
    }
    const visualizerEntries = byVisualizer.get(key);
    if (!visualizerEntries) continue;
    for (const { entry, index } of visualizerEntries) {
      if (used.has(index)) continue;
      ordered.push(entry);
      used.add(index);
    }
  }

  entries.forEach((entry, index) => {
    if (!used.has(index)) ordered.push(entry);
  });
  return ordered;
}

function datavisualizationManualLegendEntries(globalOptionsRaw = "", globalOptions = {}) {
  const entries = [];
  for (const part of splitTopLevel(globalOptionsRaw || "", ",")) {
    const { key, value } = datavisualizationOptionPart(part);
    if (key !== "new legend entry") continue;
    const options = parseOptions(value || "");
    const label = datavisualizationTextFromOption(value) || datavisualizationTextFromOption(options.text) || "";
    if (!label) continue;
    const legendName = datavisualizationLegendNameFromOptions(value);
    const legendPosition = datavisualizationLegendOption({}, globalOptions, legendName) || "south east outside";
    const plot = {
      kind: "manual",
      visualName: "",
      legendName,
      legendPosition,
      legendLabel: label,
      legendExplicit: datavisualizationLegendOptionIsExplicit({}, globalOptions, legendName),
      legendInside: datavisualizationLegendIsInside(legendPosition),
      legendTextOnly: datavisualizationLegendTextOnly(legendPosition),
      legendTextLeft: datavisualizationLegendTextLeft(legendPosition),
      legendTextColored: datavisualizationLegendTextColored(legendPosition),
      legendNodeStyle: datavisualizationLegendNodeStyle(legendPosition, globalOptionsRaw, value),
      styleIndex: entries.length
    };
    entries.push({
      kind: "manual",
      plot,
      visualizerInLegend: String(options["visualizer in legend"] || "").trim(),
      visualizerStyle: String(options["visualizer in legend styling"] || "").trim()
    });
  }
  return entries;
}

function datavisualizationOptionPart(part = "") {
  const pieces = splitTopLevel(String(part || ""), "=");
  if (!pieces.length) return { key: "", value: "" };
  const key = pieces.shift().trim();
  return {
    key,
    value: stripOuterBracesText(pieces.join("=").trim())
  };
}

function renderDatavisualizationLegendEntryGroups(entries = [], baseContext = {}) {
  if (!entries.length) return [];
  const groups = [];
  const byName = new Map();
  for (const entry of entries) {
    const key = String(entry.plot?.legendName || "main legend").trim() || "main legend";
    if (!byName.has(key)) {
      const group = { name: key, entries: [] };
      byName.set(key, group);
      groups.push(group);
    }
    byName.get(key).entries.push(entry);
  }

  const commands = [];
  for (const group of groups) {
    const plots = group.entries.map((entry) => entry.plot).filter(Boolean);
    const context = {
      ...baseContext,
      mixedLineAndScatter: plots.some((plot) => plot.kind === "scatter" || plot.noLines) && plots.some((plot) => plot.kind !== "scatter" && !plot.noLines),
      legendLabels: plots.map((plot) => plot.legendLabel)
    };
    commands.push(...datavisualizationLegendBackgroundCommands(plots, context));
    group.entries.forEach((entry, index) => {
      const count = group.entries.length;
      if (entry.kind === "rectangle") {
        commands.push(...renderDatavisualizationRectangleLegend(entry.plot, index, count, context));
      } else if (entry.kind === "scatter") {
        commands.push(...renderDatavisualizationLegend(entry.plot, index, count, context));
      } else if (entry.kind === "manual") {
        commands.push(...renderDatavisualizationManualLegend(entry, index, count, context));
      } else {
        commands.push(...renderDatavisualizationLineLegend(entry.plot, entry.plotStyle || datavisualizationLinePlotStyle(entry.plot?.styleIndex || 0, entry.plot), index, count, context));
      }
    });
  }
  return commands;
}

function datavisualizationUsesPolarAxes(globalOptions = {}) {
  return globalOptions["scientific polar axes"] !== undefined || globalOptions["new polar axes"] !== undefined;
}

function datavisualizationCartesianAxisAttributes(globalOptions = {}) {
  const xAxisOptions = parseOptions(globalOptions["x axis"] || "");
  const yAxisOptions = parseOptions(globalOptions["y axis"] || "");
  return {
    x: String(xAxisOptions.attribute || "x").trim() || "x",
    y: String(yAxisOptions.attribute || "y").trim() || "y"
  };
}

function datavisualizationApplyCartesianAxisAttributes(plotSpecs = [], globalOptions = {}) {
  const attributes = datavisualizationCartesianAxisAttributes(globalOptions);
  if (attributes.x === "x" && attributes.y === "y") return plotSpecs;
  return plotSpecs.map((plot) => ({
    ...plot,
    points: datavisualizationMapCartesianPoints(plot.points, attributes),
    surveyPoints: datavisualizationMapCartesianPoints(plot.surveyPoints, attributes)
  }));
}

function datavisualizationCartesianAxisScalings(globalOptions = {}, plotSpecs = []) {
  const xAxisOptions = parseOptions(globalOptions["x axis"] || "");
  const yAxisOptions = parseOptions(globalOptions["y axis"] || "");
  const allAxesOptions = parseOptions(globalOptions["all axes"] || "");
  const sourceRanges = datavisualizationApplyAxisBounds(datavisualizationPlotRanges(plotSpecs), {
    xAxisOptions,
    yAxisOptions,
    allAxesOptions,
    globalOptions
  });
  return {
    sourceRanges,
    x: datavisualizationAxisScaling(xAxisOptions, allAxesOptions, sourceRanges.xMin, sourceRanges.xMax),
    y: datavisualizationAxisScaling(yAxisOptions, allAxesOptions, sourceRanges.yMin, sourceRanges.yMax)
  };
}

function datavisualizationAxisScaling(axisOptions = {}, allAxesOptions = {}, sourceMin = 0, sourceMax = 1) {
  const raw = datavisualizationAxisOptionValue(axisOptions.scaling, allAxesOptions.scaling);
  if (raw === undefined || raw === null || raw === true || String(raw).trim() === "") return null;
  const text = String(raw).trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  const match = text.match(/^([\s\S]+?)\s+at\s+([\s\S]+?)\s+and\s+([\s\S]+?)\s+at\s+([\s\S]+)$/);
  if (!match) return null;
  const sourceStart = datavisualizationScalingSourceValue(match[1], sourceMin, sourceMax);
  const sourceEnd = datavisualizationScalingSourceValue(match[3], sourceMin, sourceMax);
  const targetStart = datavisualizationScalingTargetValue(match[2]);
  const targetEnd = datavisualizationScalingTargetValue(match[4]);
  if (![sourceStart, sourceEnd, targetStart, targetEnd].every(Number.isFinite)) return null;
  if (Math.abs(sourceEnd - sourceStart) < 1e-12) return null;
  const scale = (value) => targetStart + ((Number(value) - sourceStart) * (targetEnd - targetStart)) / (sourceEnd - sourceStart);
  return {
    sourceStart,
    sourceEnd,
    targetStart,
    targetEnd,
    targetIsDimension: true,
    sourceRange: {
      min: Math.min(sourceStart, sourceEnd),
      max: Math.max(sourceStart, sourceEnd)
    },
    targetRange: {
      min: Math.min(targetStart, targetEnd),
      max: Math.max(targetStart, targetEnd)
    },
    scale
  };
}

function datavisualizationScalingSourceValue(raw, min, max) {
  const text = String(raw || "").trim().replace(/^\{([\s\S]*)\}$/, "$1").trim().toLowerCase();
  if (text === "min") return min;
  if (text === "max") return max;
  return axisNumber(raw, NaN);
}

function datavisualizationScalingTargetValue(raw) {
  return parseDimension(String(raw || "").trim().replace(/^\{([\s\S]*)\}$/, "$1"), {});
}

function datavisualizationApplyCartesianAxisScaling(plotSpecs = [], axisScaling = {}) {
  if (!axisScaling?.x && !axisScaling?.y) return plotSpecs;
  return plotSpecs.map((plot) => ({
    ...plot,
    points: datavisualizationScaleCartesianPoints(plot.points, axisScaling),
    surveyPoints: datavisualizationScaleCartesianPoints(plot.surveyPoints, axisScaling),
    pin: datavisualizationScaleDatavisualizationOverlay(plot.pin, axisScaling),
    pins: datavisualizationScaleDatavisualizationOverlays(plot.pins, axisScaling),
    dataLabel: datavisualizationScaleDatavisualizationOverlay(plot.dataLabel, axisScaling),
    dataLabels: datavisualizationScaleDatavisualizationOverlays(plot.dataLabels, axisScaling)
  }));
}

function datavisualizationScaleCartesianPoints(points = [], axisScaling = {}) {
  return (points || []).map((point) => datavisualizationScaleCartesianPoint(point, axisScaling));
}

function datavisualizationScaleCartesianPoint(point, axisScaling = {}) {
  if (!point) return point;
  const x = datavisualizationScaleAxisValue(point.x, axisScaling.x);
  const y = datavisualizationScaleAxisValue(point.y, axisScaling.y);
  return {
    ...point,
    sourceX: point.sourceX ?? point.x,
    sourceY: point.sourceY ?? point.y,
    x,
    y,
    rectangle: datavisualizationScaleRectangle(point.rectangle, axisScaling),
    candle: datavisualizationScaleCandle(point.candle, axisScaling)
  };
}

function datavisualizationScaleAxisValue(value, scaling) {
  const numeric = Number(value);
  if (!scaling || !Number.isFinite(numeric)) return value;
  return roundAxis(scaling.scale(numeric));
}

function datavisualizationScaleRectangle(rectangle, axisScaling = {}) {
  if (!rectangle) return rectangle;
  return {
    ...rectangle,
    xMin: datavisualizationScaleAxisValue(rectangle.xMin, axisScaling.x),
    xMax: datavisualizationScaleAxisValue(rectangle.xMax, axisScaling.x),
    yMin: datavisualizationScaleAxisValue(rectangle.yMin, axisScaling.y),
    yMax: datavisualizationScaleAxisValue(rectangle.yMax, axisScaling.y)
  };
}

function datavisualizationScaleCandle(candle, axisScaling = {}) {
  if (!candle || !axisScaling.y) return candle;
  return {
    ...candle,
    low: datavisualizationScaleAxisValue(candle.low, axisScaling.y),
    high: datavisualizationScaleAxisValue(candle.high, axisScaling.y),
    entry: datavisualizationScaleAxisValue(candle.entry, axisScaling.y),
    exit: datavisualizationScaleAxisValue(candle.exit, axisScaling.y)
  };
}

function datavisualizationScaleDatavisualizationOverlay(overlay, axisScaling = {}) {
  if (!overlay) return overlay;
  const scaled = { ...overlay };
  for (const [xKey, yKey] of [
    ["x", "y"],
    ["labelX", "labelY"]
  ]) {
    if (Number.isFinite(Number(scaled[xKey]))) scaled[xKey] = datavisualizationScaleAxisValue(scaled[xKey], axisScaling.x);
    if (Number.isFinite(Number(scaled[yKey]))) scaled[yKey] = datavisualizationScaleAxisValue(scaled[yKey], axisScaling.y);
  }
  for (const key of ["edgeStart", "previous", "next"]) {
    if (scaled[key]) scaled[key] = datavisualizationScaleCartesianPoint(scaled[key], axisScaling);
  }
  return scaled;
}

function datavisualizationScaleDatavisualizationOverlays(overlays, axisScaling = {}) {
  if (!Array.isArray(overlays)) return overlays;
  return overlays.map((overlay) => datavisualizationScaleDatavisualizationOverlay(overlay, axisScaling));
}

function datavisualizationMapCartesianPoints(points = [], attributes = { x: "x", y: "y" }) {
  return (points || []).map((point) => {
    const x = datavisualizationPointNumericAttribute(point, attributes.x, point.x);
    const y = datavisualizationPointNumericAttribute(point, attributes.y, point.y);
    return {
      ...point,
      x,
      y,
      attributes: { ...(point.attributes || point) }
    };
  });
}

function datavisualizationPointNumericAttribute(point, attribute, fallback = NaN) {
  const key = String(attribute || "").trim();
  const direct = key ? point?.[key] : undefined;
  const nested = key ? point?.attributes?.[key] : undefined;
  const variable = key ? point?.variables?.[key] : undefined;
  const value = direct ?? nested ?? variable ?? fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function renderDatavisualizationAsPolarTikz(parsed, globalOptions = {}, plotSpecs = []) {
  const config = datavisualizationPolarConfig(globalOptions, plotSpecs);
  const commands = [];
  if (config.showAxes) {
    commands.push(...renderDatavisualizationPolarFrame(config));
    commands.push(...renderDatavisualizationPolarGrid(config));
  }

  let legendIndex = 0;
  const legendPlots = plotSpecs.filter((plot) => plot.points.length && plot.legendLabel);
  const legendCount = legendPlots.length;
  for (const plot of plotSpecs) {
    if (!plot.points.length) continue;
    const coordinates = plot.points
      .map((point) => datavisualizationPolarPoint(point, config))
      .filter(Boolean)
      .map((point) => `(${roundTikzNumber(point.x)},${roundTikzNumber(point.y)})`)
      .join(" ");
    if (!coordinates) continue;
    if (plot.kind === "scatter" || plot.noLines) {
      const scatterStyle = formatDatavisualizationOptions({ "axis plot": true, ...datavisualizationScatterPlotStyle(plot) });
      commands.push(`\\draw[${scatterStyle}] plot coordinates {${coordinates}};`);
      if (plot.legendLabel) {
        commands.push(...renderDatavisualizationPolarLegend(plot, datavisualizationScatterPlotStyle(plot), legendIndex, legendCount, config));
        legendIndex += 1;
      }
      continue;
    }
    const plotStyle = datavisualizationLinePlotStyle(plot.styleIndex || 0, plot);
    const style = formatDatavisualizationOptions({ "axis plot": true, ...plotStyle });
    commands.push(`\\draw[${style}] plot${plot.smooth !== false ? "[smooth]" : ""} coordinates {${coordinates}};`);
    if (plot.legendLabel) {
      commands.push(...renderDatavisualizationPolarLegend(plot, plotStyle, legendIndex, legendCount, config));
      legendIndex += 1;
    }
  }

  const body = commands.join("\n");
  if (parsed.wrapsTikzPicture) return `\\begin{tikzpicture}\n${body}\n\\end{tikzpicture}`;
  return body;
}

function datavisualizationPolarConfig(globalOptions = {}, plotSpecs = []) {
  const scientificRaw = globalOptions["scientific polar axes"];
  const hasScientificAxes = scientificRaw !== undefined;
  const scientificStyles = datavisualizationScientificAxisStyles(scientificRaw);
  const scientificOptions = parseOptions(scientificRaw === true ? "" : scientificRaw || "");
  const axisNames = datavisualizationPolarAxisNames(globalOptions);
  const angleAxisOptions = parseOptions(globalOptions[axisNames.angle] || globalOptions["angle axis"] || "");
  const radiusAxisOptions = parseOptions(globalOptions[axisNames.radius] || globalOptions["radius axis"] || "");
  const allAxesOptions = parseOptions(globalOptions["all axes"] || "");
  const angleAttribute = String(angleAxisOptions.attribute || "angle").trim();
  const radiusAttribute = String(radiusAxisOptions.attribute || "radius").trim();
  const angleLogarithmic = datavisualizationAxisIsLogarithmic(angleAxisOptions, allAxesOptions);
  const angleRange = datavisualizationPolarAngleRange(scientificStyles, plotSpecs, angleAttribute, angleAxisOptions, allAxesOptions, {
    logarithmic: angleLogarithmic
  });
  const radiusMaxOption = datavisualizationAxisNumericOption(radiusAxisOptions["max value"] ?? allAxesOptions["max value"]);
  const hasExplicitRadiusMax = Number.isFinite(radiusMaxOption) && radiusMaxOption > 0;
  const dataRadiusMax = Math.max(
    0,
    ...plotSpecs.flatMap((plot) => (plot.points || []).map((point) => datavisualizationPolarValue(point, radiusAttribute)).filter(Number.isFinite))
  );
  const radiusMax = hasExplicitRadiusMax ? radiusMaxOption : dataRadiusMax > 0 ? dataRadiusMax : 1;
  const radiusUnitLength = parseDimension(String(radiusAxisOptions["unit length"] || allAxesOptions["unit length"] || ""), {});
  const hasRadiusUnitLength = Number.isFinite(radiusUnitLength) && radiusUnitLength > 0;
  const radiusLength = parseDimension(String(radiusAxisOptions.length || scientificOptions.radius || "3.25cm"), {});
  const outerRadius = hasRadiusUnitLength
    ? radiusUnitLength * radiusMax
    : Number.isFinite(radiusLength) && radiusLength > 0
      ? radiusLength
      : 3.25;
  const clean = scientificStyles.has("clean");
  const paddedOuterRadius = outerRadius + (clean ? parseDimension("0.5em", {}) : 0);
  const basis = datavisualizationPolarBasis(angleAxisOptions);
  const showAxes = datavisualizationPolarShouldShowAxes(hasScientificAxes, angleAxisOptions, radiusAxisOptions, allAxesOptions);
  return {
    angleAxisName: axisNames.angle,
    radiusAxisName: axisNames.radius,
    angleAttribute,
    radiusAttribute,
    angleRange,
    angleLogarithmic,
    radiusMax,
    outerRadius,
    paddedOuterRadius,
    basis,
    showAxes,
    clean,
    tickDirection: scientificStyles.has("inner ticks") ? "inner" : "outer",
    grid: datavisualizationAxisWantsGrid(angleAxisOptions, allAxesOptions) || datavisualizationAxisWantsGrid(radiusAxisOptions, allAxesOptions),
    allAxesOptions,
    angleAxisOptions,
    radiusAxisOptions,
    radiusTickColor: datavisualizationAxisTickStyleColor(radiusAxisOptions, allAxesOptions),
    legendPosition: String(globalOptions.legend || "").trim().toLowerCase()
  };
}

function datavisualizationPolarShouldShowAxes(hasScientificAxes, angleAxisOptions = {}, radiusAxisOptions = {}, allAxesOptions = {}) {
  if (hasScientificAxes) return true;
  if (datavisualizationAxisWantsGrid(angleAxisOptions, allAxesOptions) || datavisualizationAxisWantsGrid(radiusAxisOptions, allAxesOptions)) return true;
  return [angleAxisOptions, radiusAxisOptions, allAxesOptions].some((options) => options?.ticks !== undefined);
}

function datavisualizationPolarAxisNames(globalOptions = {}) {
  const raw = globalOptions["new polar axes"];
  if (raw === undefined || raw === true) return { angle: "angle axis", radius: "radius axis" };
  const text = String(raw || "").trim();
  const braced = [...text.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1].trim()).filter(Boolean);
  if (braced.length >= 2) return { angle: braced[0], radius: braced[1] };
  const parts = splitTopLevel(text, ",").map((part) => part.replace(/[{}]/g, "").trim()).filter(Boolean);
  return {
    angle: parts[0] || "angle axis",
    radius: parts[1] || "radius axis"
  };
}

function datavisualizationPolarAngleRange(styles, plotSpecs = [], angleAttribute = "angle", angleAxisOptions = {}, allAxesOptions = {}, options = {}) {
  const mapped = datavisualizationMappedPolarAngleRange(styles, plotSpecs, angleAttribute, options);
  if (mapped) return mapped;

  const fixed = [
    ["0 to pi half", 0, Math.PI / 2, true],
    ["-pi half to 0", -Math.PI / 2, 0, true],
    ["0 to pi", 0, Math.PI, true],
    ["-pi half to pi half", -Math.PI / 2, Math.PI / 2, true],
    ["0 to 2pi", 0, Math.PI * 2, true],
    ["-pi to pi", -Math.PI, Math.PI, true],
    ["0 to 90", 0, 90, false],
    ["-90 to 0", -90, 0, false],
    ["0 to 180", 0, 180, false],
    ["-90 to 90", -90, 90, false],
    ["0 to 360", 0, 360, false],
    ["-180 to 180", -180, 180, false]
  ];
  for (const [key, min, max, radians] of fixed) {
    if (styles.has(key)) {
      return {
        min,
        max,
        radians,
        mapped: false,
        startDegrees: radians ? (min * 180) / Math.PI : min,
        endDegrees: radians ? (max * 180) / Math.PI : max
      };
    }
  }
  const explicitMin = datavisualizationAxisNumericOption(angleAxisOptions["min value"] ?? allAxesOptions["min value"]);
  const explicitMax = datavisualizationAxisNumericOption(angleAxisOptions["max value"] ?? allAxesOptions["max value"]);
  if (Number.isFinite(explicitMin) && Number.isFinite(explicitMax) && Math.abs(explicitMax - explicitMin) > 1e-12) {
    const radians = Boolean(angleAxisOptions.radians);
    return {
      min: explicitMin,
      max: explicitMax,
      radians,
      mapped: false,
      startDegrees: radians ? (explicitMin * 180) / Math.PI : explicitMin,
      endDegrees: radians ? (explicitMax * 180) / Math.PI : explicitMax
    };
  }
  const values = plotSpecs.flatMap((plot) => (plot.points || []).map((point) => datavisualizationPolarValue(point, angleAttribute)).filter(Number.isFinite));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 360;
  const radians = Boolean(angleAxisOptions.radians);
  return {
    min,
    max,
    radians,
    mapped: false,
    startDegrees: radians ? (min * 180) / Math.PI : min,
    endDegrees: radians ? (max * 180) / Math.PI : max
  };
}

function datavisualizationMappedPolarAngleRange(styles, plotSpecs = [], angleAttribute = "angle", options = {}) {
  const mappings = [
    ["quadrant", 0, 90],
    ["quadrant clockwise", 90, 0],
    ["fourth quadrant", -90, 0],
    ["fourth quadrant clockwise", 0, -90],
    ["upper half", 0, 180],
    ["upper half clockwise", 180, 0],
    ["lower half", -180, 0],
    ["lower half clockwise", 0, -180],
    ["right half", -90, 90],
    ["right half clockwise", 90, -90],
    ["left half", 90, 270],
    ["left half clockwise", 270, 90]
  ];
  const found = mappings.find(([key]) => styles.has(key));
  if (!found) return null;
  const values = plotSpecs.flatMap((plot) =>
    (plot.points || [])
      .map((point) => datavisualizationPolarValue(point, angleAttribute))
      .filter((value) => Number.isFinite(value) && (!options.logarithmic || value > 0))
  );
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  return {
    min,
    max: max === min ? min + 1 : max,
    radians: false,
    mapped: true,
    startDegrees: found[1],
    endDegrees: found[2]
  };
}

function renderDatavisualizationPolarFrame(config) {
  const padding = config.clean ? 0.65 : 0.35;
  const radius = config.outerRadius + padding;
  const bounds = datavisualizationPolarAngleBounds(config.angleRange.startDegrees, config.angleRange.endDegrees, radius);
  const minY = Math.min(bounds.minY, -0.75);
  return [
    `\\path[axis bounds, draw=none, fill=none] (${roundTikzNumber(Math.min(bounds.minX, -0.75))},${roundTikzNumber(minY)}) rectangle (${roundTikzNumber(Math.max(bounds.maxX, 0.75))},${roundTikzNumber(bounds.maxY + 0.25)});`
  ];
}

function datavisualizationPolarAngleBounds(startDegrees, endDegrees, radius) {
  const points = [startDegrees, endDegrees];
  for (const cardinal of [-360, -270, -180, -90, 0, 90, 180, 270, 360]) {
    if (datavisualizationAngleWithinSweep(cardinal, startDegrees, endDegrees)) points.push(cardinal);
  }
  const projected = points.map((degrees) => datavisualizationPolarProjectDegrees(degrees, radius));
  return {
    minX: Math.min(0, ...projected.map((point) => point.x)),
    minY: Math.min(0, ...projected.map((point) => point.y)),
    maxX: Math.max(0, ...projected.map((point) => point.x)),
    maxY: Math.max(0, ...projected.map((point) => point.y))
  };
}

function datavisualizationAngleWithinSweep(degrees, startDegrees, endDegrees) {
  const span = endDegrees - startDegrees;
  if (Math.abs(span) >= 359.999) return true;
  const epsilon = 1e-9;
  if (span >= 0) return degrees >= startDegrees - epsilon && degrees <= endDegrees + epsilon;
  return degrees <= startDegrees + epsilon && degrees >= endDegrees - epsilon;
}

function renderDatavisualizationPolarGrid(config) {
  const commands = [];
  const radiusTicks = datavisualizationPolarRadiusTicks(config);
  const angleTicks = datavisualizationPolarAngleTicks(config);
  const minorAngleTicks = datavisualizationPolarMinorAngleTicks(config, angleTicks);
  const gridStyle = "axis grid, black!25, line width=0.4pt";
  const minorGridStyle = "axis minor grid, black!12, line width=0.2pt";
  const boundaryStyle = "axis clean boundary, black!50, line width=0.4pt, line cap=rect";
  const drawGrid = Boolean(config.grid);
  let renderedMaxRadiusBoundary = false;
  for (const tick of radiusTicks) {
    if (tick <= 0) continue;
    const scaled = datavisualizationPolarRadiusCm(tick, config);
    const isMaxRadius = tick >= config.radiusMax - 1e-9;
    if (!drawGrid && !isMaxRadius) continue;
    if (datavisualizationPolarIsFullCircle(config)) {
      if (drawGrid) commands.push(`\\draw[${gridStyle}] (0,0) circle (${roundTikzNumber(scaled)}cm);`);
      if (!config.clean && isMaxRadius) {
        commands.push(`\\draw[${boundaryStyle}] (0,0) circle (${roundTikzNumber(scaled)}cm);`);
      }
      if (config.clean && tick >= config.radiusMax - 1e-9) {
        if (!drawGrid) commands.push(`\\draw[${gridStyle}] (0,0) circle (${roundTikzNumber(scaled)}cm);`);
        commands.push(`\\draw[${boundaryStyle}] (0,0) circle (${roundTikzNumber(config.paddedOuterRadius)}cm);`);
        renderedMaxRadiusBoundary = true;
      }
    } else {
      const start = datavisualizationPolarProjectDegrees(config.angleRange.startDegrees, scaled);
      if (drawGrid || (!config.clean && isMaxRadius)) {
        commands.push(
          `\\draw[${isMaxRadius && !config.clean ? boundaryStyle : gridStyle}] (${roundTikzNumber(start.x)},${roundTikzNumber(start.y)}) arc (${roundTikzNumber(config.angleRange.startDegrees)}:${roundTikzNumber(config.angleRange.endDegrees)}:${roundTikzNumber(scaled)});`
        );
        if (isMaxRadius && !config.clean) renderedMaxRadiusBoundary = true;
      }
      if (isMaxRadius && config.clean) {
        if (!drawGrid) {
          commands.push(
            `\\draw[${gridStyle}] (${roundTikzNumber(start.x)},${roundTikzNumber(start.y)}) arc (${roundTikzNumber(config.angleRange.startDegrees)}:${roundTikzNumber(config.angleRange.endDegrees)}:${roundTikzNumber(scaled)});`
          );
        }
        const paddedStart = datavisualizationPolarProjectDegrees(config.angleRange.startDegrees, config.paddedOuterRadius);
        commands.push(
          `\\draw[${boundaryStyle}] (${roundTikzNumber(paddedStart.x)},${roundTikzNumber(paddedStart.y)}) arc (${roundTikzNumber(config.angleRange.startDegrees)}:${roundTikzNumber(config.angleRange.endDegrees)}:${roundTikzNumber(config.paddedOuterRadius)});`
        );
        renderedMaxRadiusBoundary = true;
      }
    }
  }
  if (!renderedMaxRadiusBoundary) {
    const scaled = datavisualizationPolarRadiusCm(config.radiusMax, config);
    if (datavisualizationPolarIsFullCircle(config)) {
      if (config.clean) {
        if (!drawGrid) commands.push(`\\draw[${gridStyle}] (0,0) circle (${roundTikzNumber(scaled)}cm);`);
        commands.push(`\\draw[${boundaryStyle}] (0,0) circle (${roundTikzNumber(config.paddedOuterRadius)}cm);`);
      } else {
        commands.push(`\\draw[${boundaryStyle}] (0,0) circle (${roundTikzNumber(scaled)}cm);`);
      }
    } else {
      const start = datavisualizationPolarProjectDegrees(config.angleRange.startDegrees, scaled);
      if (config.clean) {
        if (!drawGrid) {
          commands.push(
            `\\draw[${gridStyle}] (${roundTikzNumber(start.x)},${roundTikzNumber(start.y)}) arc (${roundTikzNumber(config.angleRange.startDegrees)}:${roundTikzNumber(config.angleRange.endDegrees)}:${roundTikzNumber(scaled)});`
          );
        }
        const paddedStart = datavisualizationPolarProjectDegrees(config.angleRange.startDegrees, config.paddedOuterRadius);
        commands.push(
          `\\draw[${boundaryStyle}] (${roundTikzNumber(paddedStart.x)},${roundTikzNumber(paddedStart.y)}) arc (${roundTikzNumber(config.angleRange.startDegrees)}:${roundTikzNumber(config.angleRange.endDegrees)}:${roundTikzNumber(config.paddedOuterRadius)});`
        );
      } else {
        commands.push(
          `\\draw[${boundaryStyle}] (${roundTikzNumber(start.x)},${roundTikzNumber(start.y)}) arc (${roundTikzNumber(config.angleRange.startDegrees)}:${roundTikzNumber(config.angleRange.endDegrees)}:${roundTikzNumber(scaled)});`
        );
      }
    }
  }
  commands.push(...renderDatavisualizationPolarRadiusAxes(radiusTicks, config));
  commands.push(...renderDatavisualizationPolarMinorAngleTicks(minorAngleTicks, config));
  if (drawGrid) {
    for (const angle of minorAngleTicks) {
      const degrees = datavisualizationPolarAngleDegrees(angle, config);
      if (!Number.isFinite(degrees)) continue;
      const to = datavisualizationPolarProjectDegrees(degrees, config.outerRadius, config);
      commands.push(`\\draw[${minorGridStyle}] (0,0) -- (${roundTikzNumber(to.x)},${roundTikzNumber(to.y)});`);
    }
    for (const angle of angleTicks) {
      const degrees = datavisualizationPolarAngleDegrees(angle, config);
      const to = datavisualizationPolarProjectDegrees(degrees, config.outerRadius, config);
      commands.push(`\\draw[${gridStyle}] (0,0) -- (${roundTikzNumber(to.x)},${roundTikzNumber(to.y)});`);
    }
  }
  commands.push(...renderDatavisualizationPolarTickLabels(radiusTicks, angleTicks, config));
  return commands;
}

function renderDatavisualizationPolarMinorAngleTicks(minorAngleTicks, config) {
  const commands = [];
  const tickStyle = "axis minor tick, black!50, line width=0.25pt";
  for (const tick of minorAngleTicks) {
    const degrees = datavisualizationPolarAngleDegrees(tick, config);
    if (!Number.isFinite(degrees)) continue;
    const tickRadius = config.clean ? config.paddedOuterRadius : config.outerRadius;
    const inner = datavisualizationPolarProjectDegrees(degrees, tickRadius - 0.045);
    const outer = datavisualizationPolarProjectDegrees(degrees, tickRadius + 0.045);
    commands.push(
      `\\draw[${tickStyle}] (${roundTikzNumber(inner.x)},${roundTikzNumber(inner.y)}) -- (${roundTikzNumber(outer.x)},${roundTikzNumber(outer.y)});`
    );
  }
  return commands;
}

function renderDatavisualizationPolarRadiusAxes(radiusTicks, config) {
  if (config.clean && datavisualizationPolarIsFullCircle(config)) return [];
  const commands = [];
  const axisStyle = "axis clean boundary, black!50, line width=0.4pt, line cap=rect";
  const gridStyle = "axis grid, black!25, line width=0.4pt, line cap=rect";
  const tickStyle = "axis tick, black!50, line width=0.4pt";
  const labelStyle = joinOptions(["axis tick label", `font=${datavisualizationRoleFont("tick")}`, "inner sep=0pt", config.radiusTickColor ? `text=${config.radiusTickColor}` : ""]);
  const axes = config.clean ? datavisualizationPolarCleanBoundaryAxisAngles(config) : datavisualizationPolarRadiusAxisAngles(config);
  for (const axis of axes) {
    const degrees = typeof axis === "number" ? axis : axis.degrees;
    const end = datavisualizationPolarProjectDegrees(degrees, config.outerRadius);
    if (config.clean) {
      const offset = datavisualizationPolarCleanBoundaryAxisOffset(degrees, axis.role || "start", config);
      commands.push(`\\draw[${gridStyle}] (0,0) -- (${roundTikzNumber(end.x)},${roundTikzNumber(end.y)});`);
      commands.push(
        `\\draw[${axisStyle}] (${roundTikzNumber(offset.x)},${roundTikzNumber(offset.y)}) -- (${roundTikzNumber(end.x + offset.x)},${roundTikzNumber(end.y + offset.y)});`
      );
      continue;
    }
    commands.push(`\\draw[${axisStyle}] (0,0) -- (${roundTikzNumber(end.x)},${roundTikzNumber(end.y)});`);
    for (const tick of radiusTicks) {
      if (tick <= 0) continue;
      const radius = datavisualizationPolarRadiusCm(tick, config);
      const center = datavisualizationPolarProjectDegrees(degrees, radius);
      const placement = datavisualizationPolarRadiusAxisTickPlacement(degrees, center, config);
      commands.push(
        `\\draw[${tickStyle}] (${roundTikzNumber(placement.tickFrom.x)},${roundTikzNumber(placement.tickFrom.y)}) -- (${roundTikzNumber(placement.tickTo.x)},${roundTikzNumber(placement.tickTo.y)});`
      );
      commands.push(
        `\\node[${labelStyle}, anchor=${placement.anchor}] at (${roundTikzNumber(placement.label.x)},${roundTikzNumber(placement.label.y)}) {${datavisualizationPolarRadiusLabel(tick)}};`
      );
      if (datavisualizationPolarNeedsHighSideRadiusTickTextDuplicate(degrees, config)) {
        const compactOffset = datavisualizationPolarRadiusLabelPadding(config) + 0.07;
        commands.push(
          `\\node[${labelStyle}, anchor=north] at (${roundTikzNumber(center.x)},${roundTikzNumber(center.y - compactOffset)}) {${datavisualizationPolarRadiusLabel(tick)}};`
        );
      }
    }
  }
  if (!config.clean) commands.push(`\\node[${labelStyle}, anchor=north] at (0,${roundTikzNumber(-datavisualizationPolarRadiusLabelPadding(config))}) {0};`);
  return commands;
}

function datavisualizationPolarNeedsHighSideRadiusTickTextDuplicate(degrees, config) {
  if (config.clean || !datavisualizationPolarIsHalfPlane(config)) return false;
  const normalized = ((degrees % 360) + 360) % 360;
  const start = ((config.angleRange.startDegrees % 360) + 360) % 360;
  return Math.abs(normalized - start) < 1e-6 && Math.abs(normalized) < 8;
}

function datavisualizationPolarCleanBoundaryAxisAngles(config) {
  return [
    { degrees: config.angleRange.startDegrees, role: "start" },
    { degrees: config.angleRange.endDegrees, role: "end" }
  ];
}

function datavisualizationPolarCleanBoundaryAxisOffset(degrees, role, config) {
  const padding = Math.max(0, config.paddedOuterRadius - config.outerRadius);
  if (padding <= 1e-9) return { x: 0, y: 0 };
  const axis = datavisualizationPolarProjectDegrees(degrees, 1, config);
  const length = Math.hypot(axis.x, axis.y) || 1;
  const unit = { x: axis.x / length, y: axis.y / length };
  const span = config.angleRange.endDegrees - config.angleRange.startDegrees;
  const outwardSign = role === "start" ? (span >= 0 ? -1 : 1) : span >= 0 ? 1 : -1;
  const normal =
    outwardSign < 0
      ? { x: unit.y, y: -unit.x }
      : { x: -unit.y, y: unit.x };
  return {
    x: normal.x * padding,
    y: normal.y * padding
  };
}

function datavisualizationPolarRadiusAxisAngles(config) {
  if (datavisualizationPolarIsFullCircle(config)) return [0, 90, 180, 270];
  const start = config.angleRange.startDegrees;
  const end = config.angleRange.endDegrees;
  if (datavisualizationPolarIsHalfPlane(config)) return [start, (start + end) / 2, end];
  return [start, end];
}

function datavisualizationPolarRadiusAxisTickPlacement(degrees, center, config = {}) {
  const radial = datavisualizationPolarProjectDegrees(degrees, 1);
  const length = Math.hypot(radial.x, radial.y) || 1;
  const normal = { x: -radial.y / length, y: radial.x / length };
  const halfTick = 0.07;
  const labelPadding = datavisualizationPolarRadiusLabelPadding(config);
  const normalized = ((degrees % 360) + 360) % 360;
  if (Math.abs(normalized - 90) < 8 || Math.abs(normalized - 270) < 8) {
    const side = Math.abs(normalized - 90) < 8 ? -1 : 1;
    return {
      tickFrom: { x: center.x - normal.x * halfTick, y: center.y - normal.y * halfTick },
      tickTo: { x: center.x + normal.x * halfTick, y: center.y + normal.y * halfTick },
      label: { x: center.x + side * labelPadding, y: center.y },
      anchor: side < 0 ? "east" : "west"
    };
  }
  return {
    tickFrom: { x: center.x - normal.x * halfTick, y: center.y - normal.y * halfTick },
    tickTo: { x: center.x + normal.x * halfTick, y: center.y + normal.y * halfTick },
    label: { x: center.x, y: center.y - labelPadding },
    anchor: "north"
  };
}

function datavisualizationPolarRadiusTicks(config) {
  const explicit = datavisualizationExplicitTickOption(0, config.radiusMax, config.radiusAxisOptions, config.allAxesOptions);
  if (explicit) return axisTickValues(explicit, "radius", []);
  if (datavisualizationTickRawSources(config.radiusAxisOptions, config.allAxesOptions).length) {
    const option = datavisualizationTickOption(0, config.radiusMax, "y", config.radiusAxisOptions, config.allAxesOptions);
    const values = axisTickValues(option, "radius", []);
    if (values.length) return values.filter((value) => value >= -1e-9 && value <= config.radiusMax + 1e-9);
  }
  return datavisualizationStepTicks(0, config.radiusMax, config.radiusMax / 4);
}

function datavisualizationPolarAngleTicks(config) {
  if (config.angleRange.mapped) {
    const option = datavisualizationTickOption(config.angleRange.min, config.angleRange.max, "angle", config.angleAxisOptions, config.allAxesOptions);
    const ticks = axisTickValues(option, "angle", []);
    if (ticks.length) return ticks;
    const fallback = axisMajorTickValues(config.angleRange.min, config.angleRange.max, 6);
    if (fallback.length) return fallback;
  }
  if (config.angleLogarithmic) {
    const ticks = datavisualizationLogTicks(config.angleRange.min, config.angleRange.max);
    if (ticks.length) return ticks;
  }
  const explicitStep = datavisualizationAxisNumericOption(parseOptions(config.angleAxisOptions.ticks || "").step);
  const step = Number.isFinite(explicitStep) && explicitStep > 0 ? explicitStep : config.angleRange.radians ? Math.PI / 12 : 15;
  const ticks = datavisualizationStepTicks(config.angleRange.min, config.angleRange.max, step);
  if (datavisualizationPolarIsFullCircle(config) && ticks.length > 1) {
    const firstDegrees = datavisualizationPolarAngleDegrees(ticks[0], config);
    const lastDegrees = datavisualizationPolarAngleDegrees(ticks.at(-1), config);
    const wrappedDelta = Math.abs(((lastDegrees - firstDegrees) % 360 + 360) % 360);
    if (wrappedDelta < 1e-6 || Math.abs(wrappedDelta - 360) < 1e-6) ticks.pop();
  }
  return ticks;
}

function datavisualizationPolarMinorAngleTicks(config, majorTicks = []) {
  if (!datavisualizationHasMinorSteps(config.angleAxisOptions, config.allAxesOptions)) return [];
  if (config.angleLogarithmic) return datavisualizationLogMinorTicks(config.angleRange.min, config.angleRange.max, majorTicks);
  const option = `{${majorTicks.map(formatAxisNumber).join(",")}}`;
  return axisTickValues(datavisualizationMinorTickOption(config.angleRange.min, config.angleRange.max, config.angleAxisOptions, config.allAxesOptions, option), "angle", []);
}

function datavisualizationLogMinorTicks(min, max, majorTicks = []) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0 || min > max) return [];
  const majorKeys = new Set((majorTicks || []).map((value) => formatAxisNumber(value)));
  const values = [];
  const startExponent = Math.floor(Math.log10(min)) - 1;
  const endExponent = Math.ceil(Math.log10(max)) + 1;
  for (let exponent = startExponent; exponent <= endExponent; exponent += 1) {
    const scale = 10 ** exponent;
    for (let multiplier = 2; multiplier <= 9; multiplier += 1) {
      const value = roundAxis(multiplier * scale);
      if (value < min * (1 - 1e-10) || value > max * (1 + 1e-10)) continue;
      if (majorKeys.has(formatAxisNumber(value))) continue;
      values.push(value);
    }
  }
  return uniqueAxisValues(values).sort((left, right) => left - right);
}

function renderDatavisualizationPolarTickLabels(radiusTicks, angleTicks, config) {
  const commands = [];
  const tickStyle = "axis tick, black!50, line width=0.4pt";
  const radiusLabelStyle = joinOptions(["axis tick label", `font=${datavisualizationRoleFont("tick")}`, "inner sep=0pt", config.radiusTickColor ? `text=${config.radiusTickColor}` : ""]);
  const angleLabelStyle = `axis tick label, font=${datavisualizationRoleFont("tick")}, inner sep=0pt`;
  if (config.clean) {
    for (const tick of radiusTicks) {
      const scaled = datavisualizationPolarRadiusCm(tick, config);
      if (!Number.isFinite(scaled)) continue;
      const label = datavisualizationPolarRadiusLabel(tick);
      if (Math.abs(tick) < 1e-9) {
        commands.push(`\\node[${radiusLabelStyle}, anchor=north] at (0,${roundTikzNumber(-datavisualizationPolarRadiusLabelPadding(config))}) {${label}};`);
        continue;
      }
      const positions = datavisualizationPolarRadiusLabelPositions(scaled, config);
      for (const position of positions) {
        commands.push(
          `\\draw[${tickStyle}] (${roundTikzNumber(position.tickFrom.x)},${roundTikzNumber(position.tickFrom.y)}) -- (${roundTikzNumber(position.tickTo.x)},${roundTikzNumber(position.tickTo.y)});`
        );
        commands.push(
          `\\node[${radiusLabelStyle}, anchor=${position.anchor}] at (${roundTikzNumber(position.label.x)},${roundTikzNumber(position.label.y)}) {${label}};`
        );
      }
    }
  }

  for (const tick of angleTicks) {
    const label = datavisualizationPolarAngleLabel(tick, config);
    if (!label) continue;
    const degrees = datavisualizationPolarAngleDegrees(tick, config);
    const tickRadius = config.clean ? config.paddedOuterRadius : config.outerRadius;
    let tickFromRadius = tickRadius;
    let tickToRadius = tickRadius + DATAVISUALIZATION_CLEAN_POLAR_TICK_LENGTH;
    let labelRadius = tickRadius + datavisualizationPolarAngleLabelPadding(config, true, degrees);
    if (!config.clean) {
      tickFromRadius = tickRadius;
      tickToRadius = tickRadius + (config.tickDirection === "inner" ? -0.18 : 0.18);
      labelRadius = tickRadius + datavisualizationPolarAngleLabelPadding(config, false, degrees);
    }
    const inner = datavisualizationPolarProjectDegrees(degrees, tickFromRadius);
    const outer = datavisualizationPolarProjectDegrees(degrees, tickToRadius);
    const labelPoint = datavisualizationPolarProjectDegrees(degrees, labelRadius);
    commands.push(
      `\\draw[${tickStyle}] (${roundTikzNumber(inner.x)},${roundTikzNumber(inner.y)}) -- (${roundTikzNumber(outer.x)},${roundTikzNumber(outer.y)});`
    );
    commands.push(
      `\\node[${angleLabelStyle}, anchor=${datavisualizationPolarAngleLabelAnchor(degrees)}] at (${roundTikzNumber(labelPoint.x)},${roundTikzNumber(labelPoint.y)}) {${label}};`
    );
  }
  return commands;
}

function datavisualizationPolarIsHalfPlane(config) {
  return Math.abs(Math.abs(config.angleRange.endDegrees - config.angleRange.startDegrees) - 180) < 1e-9;
}

function datavisualizationPolarRadiusLabelPositions(radius, config) {
  const labelPadding = datavisualizationPolarRadiusLabelPadding(config);
  if (datavisualizationPolarIsFullCircle(config)) {
    return [
      {
        tickFrom: { x: radius, y: 0 },
        tickTo: { x: radius, y: -0.09 },
        label: { x: radius, y: -labelPadding },
        anchor: "north"
      }
    ];
  }
  if (!datavisualizationPolarIsHalfPlane(config)) {
    const start = datavisualizationPolarProjectDegrees(config.angleRange.startDegrees, radius);
    const end = datavisualizationPolarProjectDegrees(config.angleRange.endDegrees, radius);
    return [start, end].map((point) => datavisualizationPolarRadiusTickAtPoint(point, config));
  }
  const start = datavisualizationPolarProjectDegrees(config.angleRange.startDegrees, radius);
  const end = datavisualizationPolarProjectDegrees(config.angleRange.endDegrees, radius);
  const points = [start, end];
  const verticalDiameter = datavisualizationPolarHasVerticalDiameter(config);
  return points.map((point) => {
    if (verticalDiameter) {
      return {
        tickFrom: point,
        tickTo: { x: point.x - 0.09, y: point.y },
        label: { x: point.x - labelPadding, y: point.y },
        anchor: "east"
      };
    }
    return {
      tickFrom: point,
      tickTo: { x: point.x, y: point.y - 0.09 },
      label: { x: point.x, y: point.y - labelPadding },
      anchor: "north"
    };
  });
}

function datavisualizationPolarRadiusTickAtPoint(point, config = {}) {
  const labelPadding = datavisualizationPolarRadiusLabelPadding(config);
  if (Math.abs(point.x) < Math.abs(point.y)) {
    const side = point.y >= 0 ? -1 : 1;
    return {
      tickFrom: point,
      tickTo: { x: point.x + side * 0.09, y: point.y },
      label: { x: point.x + side * labelPadding, y: point.y },
      anchor: side < 0 ? "east" : "west"
    };
  }
  const side = point.y >= 0 ? -1 : 1;
  return {
    tickFrom: point,
    tickTo: { x: point.x, y: point.y + side * 0.09 },
    label: { x: point.x, y: point.y + side * labelPadding },
    anchor: side < 0 ? "north" : "south"
  };
}

function datavisualizationPolarAngleLabelPadding(config = {}, clean = false, degrees = null) {
  const radius = Number(config.outerRadius);
  if (clean) {
    if (Number.isFinite(radius) && radius > 2.5 && datavisualizationPolarIsHalfPlane(config)) return -0.07;
    if (Number.isFinite(radius) && radius <= 1.25) {
      const normalized = Number.isFinite(degrees) ? ((degrees % 90) + 90) % 90 : 45;
      const atEndpoint = normalized < 1e-6 || Math.abs(normalized - 90) < 1e-6;
      return atEndpoint ? 0 : 0.18;
    }
    const proportional = Number.isFinite(radius) && radius > 0 ? radius * 0.032 : 0.08;
    return Math.min(0.12, Math.max(0.02, proportional));
  }
  const proportional = Number.isFinite(radius) && radius > 0 ? radius * 0.05 : 0.12;
  return Math.min(0.12, Math.max(0.05, proportional));
}

function datavisualizationPolarRadiusLabelPadding(config = {}) {
  const radius = Number(config.outerRadius);
  const proportional = Number.isFinite(radius) && radius > 0 ? radius * 0.16 : 0.24;
  return Math.min(0.24, Math.max(0.16, proportional));
}

function datavisualizationPolarHasVerticalDiameter(config) {
  if (!datavisualizationPolarIsHalfPlane(config)) return false;
  const start = datavisualizationPolarProjectDegrees(config.angleRange.startDegrees, 1);
  const end = datavisualizationPolarProjectDegrees(config.angleRange.endDegrees, 1);
  return Math.abs(start.x - end.x) < Math.abs(start.y - end.y);
}

function datavisualizationPolarRadiusLabel(value) {
  return formatAxisTickLabel(value);
}

function datavisualizationPolarAngleLabel(value, config) {
  if (!Number.isFinite(value)) return "";
  if (config.angleRange.mapped) return formatAxisTickLabel(value);
  if (!config.angleRange.radians) return `$${formatAxisTickLabel(value)}^\\circ$`;
  const ratio = value / Math.PI;
  if (Math.abs(ratio) < 1e-3) return "0";
  if (Math.abs(ratio - 1) < 1e-3) return "$\\pi$";
  if (Math.abs(ratio + 1) < 1e-3) return "$-\\pi$";
  const fraction = rationalApproximation(ratio, 24);
  if (!fraction) return `$${formatAxisTickLabel(ratio)}\\pi$`;
  const sign = fraction.numerator < 0 ? "-" : "";
  const numerator = Math.abs(fraction.numerator);
  if (fraction.denominator === 1) return `$${sign}${numerator === 1 ? "" : numerator}\\pi$`;
  return `$${sign}\\frac{${numerator}}{${fraction.denominator}}\\pi$`;
}

function datavisualizationPolarAngleLabelAnchor(degrees) {
  const normalized = ((degrees % 360) + 360) % 360;
  if (normalized < 10 || normalized > 350) return "west";
  if (Math.abs(normalized - 180) < 10) return "east";
  if (normalized > 10 && normalized <= 45) return "west";
  if (normalized > 20 && normalized < 160) return "south";
  return "center";
}

function rationalApproximation(value, maxDenominator = 24) {
  let best = null;
  for (let denominator = 1; denominator <= maxDenominator; denominator += 1) {
    const numerator = Math.round(value * denominator);
    const error = Math.abs(value - numerator / denominator);
    if (!best || error < best.error) best = { numerator, denominator, error };
  }
  if (!best || best.error > 1e-3) return null;
  const divisor = greatestCommonDivisor(Math.abs(best.numerator), Math.abs(best.denominator));
  return {
    numerator: best.numerator / divisor,
    denominator: best.denominator / divisor
  };
}

function greatestCommonDivisor(left, right) {
  let a = Math.max(1, Math.trunc(left));
  let b = Math.max(1, Math.trunc(right));
  while (b) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a || 1;
}

function datavisualizationPolarPoint(point, config) {
  const angle = datavisualizationPolarValue(point, config.angleAttribute);
  const radiusValue = datavisualizationPolarValue(point, config.radiusAttribute);
  if (!Number.isFinite(angle) || !Number.isFinite(radiusValue)) return null;
  return datavisualizationPolarProjectDegrees(datavisualizationPolarAngleDegrees(angle, config), datavisualizationPolarRadiusCm(radiusValue, config), config);
}

function datavisualizationPolarValue(point, attribute) {
  const direct = point?.[attribute];
  if (Number.isFinite(direct)) return direct;
  const nested = point?.attributes?.[attribute];
  if (Number.isFinite(nested)) return nested;
  return NaN;
}

function datavisualizationPolarAngleDegrees(value, config) {
  if (!Number.isFinite(value)) return NaN;
  if (config.angleRange.radians) return (value * 180) / Math.PI;
  let mappedValue = value;
  let mappedMin = config.angleRange.min;
  let mappedMax = config.angleRange.max;
  if (config.angleLogarithmic) {
    if (value <= 0 || config.angleRange.min <= 0 || config.angleRange.max <= 0) return NaN;
    mappedValue = Math.log10(value);
    mappedMin = Math.log10(config.angleRange.min);
    mappedMax = Math.log10(config.angleRange.max);
  }
  const span = mappedMax - mappedMin;
  if (Math.abs(span) < 1e-12) return config.angleRange.startDegrees;
  if (!config.angleLogarithmic && config.angleRange.startDegrees === config.angleRange.min && config.angleRange.endDegrees === config.angleRange.max) return value;
  return config.angleRange.startDegrees + ((mappedValue - mappedMin) / span) * (config.angleRange.endDegrees - config.angleRange.startDegrees);
}

function datavisualizationPolarRadiusCm(value, config) {
  if (!Number.isFinite(value)) return NaN;
  return (Math.max(0, value) / config.radiusMax) * config.outerRadius;
}

function datavisualizationPolarProjectDegrees(degrees, radius, config = null) {
  const radians = (degrees * Math.PI) / 180;
  const basis = config?.basis || DEFAULT_DATAVISUALIZATION_POLAR_BASIS;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: radius * (cosine * basis.zero.x + sine * basis.ninety.x),
    y: radius * (cosine * basis.zero.y + sine * basis.ninety.y)
  };
}

const DEFAULT_DATAVISUALIZATION_POLAR_BASIS = Object.freeze({
  zero: Object.freeze({ x: 1, y: 0 }),
  ninety: Object.freeze({ x: 0, y: 1 })
});

function datavisualizationPolarBasis(angleAxisOptions = {}) {
  const raw = angleAxisOptions["unit vectors"];
  const parsed = parseDatavisualizationPolarUnitVectors(raw);
  return parsed || DEFAULT_DATAVISUALIZATION_POLAR_BASIS;
}

function parseDatavisualizationPolarUnitVectors(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  let cursor = 0;
  const vectors = [];
  for (let index = 0; index < 2; index += 1) {
    cursor = skipWhitespace(text, cursor);
    const group = extractBalanced(text, cursor, "{", "}");
    if (!group) return null;
    const vector = parseDatavisualizationPolarUnitVector(group.content);
    if (!vector) return null;
    vectors.push(vector);
    cursor = group.end;
  }
  return { zero: vectors[0], ninety: vectors[1] };
}

function parseDatavisualizationPolarUnitVector(raw) {
  const text = String(raw || "").trim().replace(/^\((.*)\)$/, "$1").trim();
  const pt = parseDimension("1pt", {});
  if (!text || !Number.isFinite(pt) || pt <= 0) return null;
  const polar = splitTopLevel(text, ":");
  if (polar.length === 2) {
    const degrees = evaluateMath(polar[0], {});
    const length = parseDimension(polar[1], {});
    if (!Number.isFinite(degrees) || !Number.isFinite(length)) return null;
    const radians = (degrees * Math.PI) / 180;
    const scale = length / pt;
    return { x: scale * Math.cos(radians), y: scale * Math.sin(radians) };
  }
  const cartesian = splitTopLevel(text, ",");
  if (cartesian.length >= 2) {
    const x = parseDimension(cartesian[0], {});
    const y = parseDimension(cartesian[1], {});
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x: x / pt, y: y / pt };
  }
  return null;
}

function datavisualizationPolarIsFullCircle(config) {
  const span = Math.abs(config.angleRange.endDegrees - config.angleRange.startDegrees);
  return span >= 359.999;
}

function renderDatavisualizationPolarLegend(plot, plotStyle, rowIndex, legendCount, config) {
  const row = datavisualizationPolarLegendRow(rowIndex, legendCount, config);
  const style = formatDatavisualizationOptions({
    "axis legend example": true,
    ...plotStyle
  });
  return [
    datavisualizationZigZagLegendLine(row, style, datavisualizationRawCoordinate),
    `\\node[axis legend, anchor=west, font=${datavisualizationRoleFont("outsideLegend")}] at (${roundTikzNumber(row.textX)},${roundTikzNumber(row.y)}) {${protectDatavisualizationOverlayText(plot.legendLabel)}};`
  ];
}

function datavisualizationPolarLegendRow(rowIndex, legendCount, config) {
  const below = config.legendPosition === "below";
  if (below && datavisualizationPolarHasVerticalDiameter(config)) {
    const x0 = config.paddedOuterRadius + 0.55;
    const y = 0 - rowIndex * 0.32;
    return { x0, x1: x0 + 0.65, textX: x0 + 0.83, y };
  }
  if (!below) {
    const fullCircle = datavisualizationPolarIsFullCircle(config);
    const y = (fullCircle ? 0 : config.outerRadius) - rowIndex * 0.32;
    const x0 = fullCircle ? config.paddedOuterRadius + 1.05 : config.outerRadius + 0.35;
    return { x0, x1: x0 + 0.65, textX: x0 + 0.83, y };
  }
  const count = Math.max(1, Number(legendCount) || 1);
  const columnGap = count > 1 ? 1.82 : 0;
  const totalWidth = 0.65 + 1.05 + (count - 1) * columnGap;
  const start = -totalWidth / 2;
  const x0 = start + rowIndex * columnGap;
  // Native `legend=below` uses `south outside`: it anchors a legend matrix
  // below the full data-visualization bounding box, including tick text.
  const y = -1.28;
  return {
    x0,
    x1: x0 + 0.65,
    textX: x0 + 0.83,
    y
  };
}

function datavisualizationLinePlotStyle(index, plot) {
  const style = {
    mark: "none",
    "line width": "0.6pt",
    ...datavisualizationPlotStyle(index, plot)
  };
  if (plot.sparkLine) {
    style["line width"] = style["line width"] === "0.6pt" ? "0.4pt" : style["line width"];
    style["line cap"] = style["line cap"] || "round";
    style["line join"] = style["line join"] || "round";
  }
  if (plot.smooth !== false) style.smooth = true;
  if (plot.cycle) style["axis plot cycle"] = true;
  if (plot.gapLine || plot.gapCycle) style["axis plot gap"] = "1.5pt";
  if (plot.mark && plot.mark !== "none") {
    style.mark = plot.mark;
    if (plot.markSize) style["mark size"] = plot.markSize;
    if (plot.markFill) style.fill = plot.markFill;
  }
  return style;
}

function datavisualizationScatterPlotStyle(plot) {
  return {
    "only marks": true,
    color: "black",
    mark: plot.mark || "x",
    "mark size": plot.markSize || "2pt",
    ...(plot.markFill ? { fill: plot.markFill } : {}),
    ...datavisualizationNativeMarkStyle(plot.styleOptions || {})
  };
}

function datavisualizationNativeMarkStyle(styleOptions = {}) {
  const style = { ...(styleOptions || {}) };
  const markColor = style["mark color"];
  delete style.color;
  delete style["mark color"];
  if (markColor && markColor !== true) style.color = markColor;
  return style;
}

function datavisualizationLegendStylePlot(plot = {}) {
  return {
    ...plot,
    styleIndex: plot.legendStyleIndex ?? plot.styleIndex ?? 0,
    styleOptions: plot.legendStyleOptions || plot.styleOptions || {},
    strongColors: plot.legendStrongColors ?? plot.strongColors,
    varyHue: plot.legendVaryHue ?? plot.varyHue,
    grayScale: plot.legendGrayScale ?? plot.grayScale,
    shadesOfBlue: plot.legendShadesOfBlue ?? plot.shadesOfBlue,
    shadesOfRed: plot.legendShadesOfRed ?? plot.shadesOfRed,
    crossMarks: plot.legendCrossMarks ?? plot.crossMarks,
    varyDashing: plot.legendVaryDashing ?? plot.varyDashing,
    varyThickness: plot.legendVaryThickness ?? plot.varyThickness,
    varyThicknessAndDashing: plot.legendVaryThicknessAndDashing ?? plot.varyThicknessAndDashing
  };
}

function createDatavisualizationDatasetSpec(dataset, random = createDatavisualizationRandom(texDefaultRandomSeed())) {
  const options = parseOptions(dataset.visualOptions || "");
  const dataOptions = parseOptions(dataset.dataOptions || "");
  const data = parseDatavisualizationData(dataset.body, dataOptions);
  const surveyPoints = sampleDatavisualizationFunctionData(data, random);
  return { options, dataOptions, data, surveyPoints };
}

function createDatavisualizationPlots(
  dataset,
  plotIndex,
  globalOptions = {},
  globalOptionsRaw = "",
  random = createDatavisualizationRandom(texDefaultRandomSeed()),
  context = {}
) {
  const datasetSpec = createDatavisualizationDatasetSpec(dataset, random);
  const points = sampleDatavisualizationFunctionData(datasetSpec.data, random);
  return createDatavisualizationPlotsFromPoints(datasetSpec, plotIndex, globalOptions, globalOptionsRaw, points, context);
}

function createDatavisualizationPlotsFromPoints(datasetSpec, plotIndex, globalOptions = {}, globalOptionsRaw = "", points = [], context = {}) {
  const { options, dataOptions, data, surveyPoints } = datasetSpec;
  const groups = datavisualizationPointGroups(points, dataOptions, globalOptions, options);
  const plots = [];
  let styledPlotIndex = Math.max(0, Number(plotIndex) || 0);
  for (const group of groups) {
    const ignoresStyleSheets = datavisualizationGroupIgnoresStyleSheets(group, options, dataOptions, globalOptions);
    plots.push(
      createDatavisualizationPlotFromGroup(
      group,
      data,
      styledPlotIndex,
      options,
      dataOptions,
      globalOptions,
      globalOptionsRaw,
      surveyPoints,
      context
    )
    );
    if (!ignoresStyleSheets) styledPlotIndex += 1;
  }
  return plots;
}

function datavisualizationGroupIgnoresStyleSheets(group, options = {}, dataOptions = {}, globalOptions = {}) {
  const visualizer = datavisualizationResolveVisualizer(group?.set, options, dataOptions, globalOptions);
  const visualName = visualizer.name;
  const nestedVisualOptions = {
    ...(visualName && globalOptions[visualName] ? parseOptions(globalOptions[visualName]) : {}),
    ...(visualName && options[visualName] ? parseOptions(options[visualName]) : {})
  };
  return Boolean(nestedVisualOptions["ignore style sheets"]);
}

function createDatavisualizationPlotFromGroup(
  group,
  data,
  plotIndex,
  options,
  dataOptions,
  globalOptions = {},
  globalOptionsRaw = "",
  surveyPoints = [],
  context = {}
) {
  const visualizer = datavisualizationResolveVisualizer(group.set, options, dataOptions, globalOptions);
  const kind = visualizer.kind;
  const visualName = visualizer.name;
  const nestedVisualOptions = {
    ...(visualName && globalOptions[visualName] ? parseOptions(globalOptions[visualName]) : {}),
    ...(visualName && options[visualName] ? parseOptions(options[visualName]) : {})
  };
  const plotPoints =
    kind === "rectangle" ? datavisualizationNormalizeRectanglePoints(group.points, nestedVisualOptions) : group.points;
  const scatterOptions = parseOptions(options.scatter || "");
  const visualStyle = datavisualizationNormalizeStyleOptions(parseOptions(nestedVisualOptions.style || ""));
  const scatterStyle = datavisualizationNormalizeStyleOptions(parseOptions(scatterOptions.style || ""));
  const legendVisualizerStyle = datavisualizationLegendVisualizerStyle(
    scatterOptions["label in legend"],
    nestedVisualOptions["label in legend"],
    options["label in legend"]
  );
  const styleSheets = datavisualizationStyleSheets(globalOptions, globalOptionsRaw);
  const ignoreStyleSheets = Boolean(nestedVisualOptions["ignore style sheets"]);
  const activeStyleSheets = ignoreStyleSheets ? new Set() : styleSheets;
  const customStyle = datavisualizationCustomStyleSheetOptions(activeStyleSheets, context.customStyleSheets, plotIndex, group.set || visualName, globalOptions);
  const legendCustomStyle = datavisualizationCustomStyleSheetOptions(styleSheets, context.customStyleSheets, plotIndex, group.set || visualName, globalOptions);
  const styleOptions = { ...customStyle, ...visualStyle, ...(kind === "scatter" ? scatterStyle : {}) };
  const legendStyleOptions = { ...legendCustomStyle, ...visualStyle, ...(kind === "scatter" ? scatterStyle : {}), ...legendVisualizerStyle };
  const crossMarkStyle = activeStyleSheets.has("cross marks") ? datavisualizationCrossMarkStyle(plotIndex) : null;
  const circleMarkStyle = datavisualizationCircleMarkStyle(activeStyleSheets);
  const legendLabel =
    datavisualizationTextFromOption(scatterOptions["label in legend"]) ||
    datavisualizationTextFromOption(nestedVisualOptions["label in legend"]) ||
    datavisualizationTextFromOption(options["label in legend"]) ||
    "";
  const legendOptionValues = [
    scatterOptions["label in legend"],
    nestedVisualOptions["label in legend"],
    options["label in legend"]
  ];
  const legendName = legendLabel ? datavisualizationLegendNameFromOptions(...legendOptionValues) : "";
  const legendLineMode = datavisualizationLegendLineMode(
    globalOptionsRaw,
    scatterOptions["label in legend"],
    nestedVisualOptions["label in legend"],
    options["label in legend"]
  );
  const legendMarkCount = datavisualizationLegendMarkCount(
    globalOptionsRaw,
    scatterOptions["label in legend"],
    nestedVisualOptions["label in legend"],
    options["label in legend"]
  );
  const legendMarkCoordinates = datavisualizationLegendMarkCoordinates(
    scatterOptions["label in legend"],
    nestedVisualOptions["label in legend"],
    options["label in legend"]
  );
  const legendLineCoordinates = datavisualizationLegendLineCoordinates(
    scatterOptions["label in legend"],
    nestedVisualOptions["label in legend"],
    options["label in legend"]
  );
  const legendRectangleCoordinates = datavisualizationLegendRectangleCoordinates(
    nestedVisualOptions["label in legend"],
    options["label in legend"]
  );
  const labelContext = {
    globalOptions,
    globalOptionsRaw,
    visualizerOrder: Math.max(1, Math.floor(Number(plotIndex) || 0) + 1),
    visualizerCount: context.datavisualizationVisualizerCount || context.visualizerCount || 1
  };
  const pins = datavisualizationPinsFromOptions(nestedVisualOptions, data, plotPoints, labelContext);
  const pin = pins[0] || null;
  const dataLabels = pins.length ? [] : datavisualizationDataLabelsFromOptions(nestedVisualOptions, data, plotPoints, labelContext);
  const dataLabel = dataLabels[0] || null;
  const mark = styleOptions.mark || crossMarkStyle?.mark || circleMarkStyle?.mark || (kind === "scatter" ? "x" : "");
  const noLines = kind === "scatter" || Boolean(nestedVisualOptions["no lines"]);
  const straightCycle = Boolean(nestedVisualOptions["straight cycle"] || nestedVisualOptions.polygon);
  const smoothCycle = Boolean(nestedVisualOptions["smooth cycle"]);
  const gapLine = Boolean(nestedVisualOptions["gap line"]);
  const gapCycle = Boolean(nestedVisualOptions["gap cycle"]);
  const cycle = Boolean(visualizer.cycle || straightCycle || smoothCycle || gapCycle);
  const explicitLegendPosition = datavisualizationLegendOption(options, globalOptions, legendName);
  const legendPosition = explicitLegendPosition || (legendLabel ? "south east outside" : "");
  return {
    kind,
    visualName,
    points: plotPoints,
    surveyPoints,
    legendName,
    legendPosition,
    legendLabel,
    legendLineMode,
    legendMarkCount,
    legendMarkCoordinates,
    legendLineCoordinates,
    legendRectangleCoordinates,
    legendInside: datavisualizationLegendIsInside(legendPosition),
    legendTextOnly: datavisualizationLegendTextOnly(legendPosition),
    legendTextLeft: datavisualizationLegendTextLeft(legendPosition),
    legendTextColored: datavisualizationLegendTextColored(legendPosition),
    legendNodeStyle: datavisualizationLegendNodeStyle(legendPosition, globalOptionsRaw, ...legendOptionValues),
    pin,
    pins,
    dataLabel,
    dataLabels,
    mark: mark || (noLines ? "x" : "none"),
    markSize: styleOptions["mark size"] || crossMarkStyle?.markSize || circleMarkStyle?.markSize || (kind === "scatter" ? "2pt" : ""),
    markFill: styleOptions.fill || circleMarkStyle?.fill || "",
    styleOptions,
    styleIndex: plotIndex,
    ignoreStyleSheets,
    legendStyleIndex: plotIndex,
    legendStyleOptions,
    legendStrongColors: styleSheets.has("strong colors"),
    legendVaryHue: styleSheets.has("vary hue"),
    legendGrayScale: styleSheets.has("gray scale"),
    legendShadesOfBlue: styleSheets.has("shades of blue"),
    legendShadesOfRed: styleSheets.has("shades of red"),
    legendCrossMarks: styleSheets.has("cross marks"),
    legendVaryDashing: styleSheets.has("vary dashing"),
    legendVaryThickness: styleSheets.has("vary thickness"),
    legendVaryThicknessAndDashing: styleSheets.has("vary thickness and dashing"),
    noLines,
    cycle,
    gapLine,
    gapCycle,
    smooth:
      !globalOptions["spark line"] &&
      (smoothCycle || visualizer.smooth) &&
      !nestedVisualOptions["straight line"] &&
      !straightCycle &&
      !gapLine &&
      !gapCycle,
    legendExplicit: datavisualizationLegendOptionIsExplicit(options, globalOptions, legendName),
    strongColors: activeStyleSheets.has("strong colors"),
    varyHue: activeStyleSheets.has("vary hue"),
    grayScale: activeStyleSheets.has("gray scale"),
    shadesOfBlue: activeStyleSheets.has("shades of blue"),
    shadesOfRed: activeStyleSheets.has("shades of red"),
    crossMarks: activeStyleSheets.has("cross marks"),
    varyDashing: activeStyleSheets.has("vary dashing"),
    varyThickness: activeStyleSheets.has("vary thickness"),
    varyThicknessAndDashing: activeStyleSheets.has("vary thickness and dashing"),
    sparkLine: Boolean(globalOptions["spark line"])
  };
}

function datavisualizationLegendOption(options = {}, globalOptions = {}, legendName = "") {
  const named = datavisualizationNamedLegendOption(legendName, options, globalOptions);
  if (named) return named;
  const values = [options.legend, options["main legend"], globalOptions.legend, globalOptions["main legend"]];
  for (const value of values) {
    if (value === undefined || value === null || value === false || value === "") continue;
    return value;
  }
  return "";
}

function datavisualizationLegendOptionIsExplicit(options = {}, globalOptions = {}, legendName = "") {
  if (datavisualizationNamedLegendOption(legendName, options, globalOptions)) return true;
  return [options.legend, options["main legend"], globalOptions.legend, globalOptions["main legend"]].some(
    (value) => value !== undefined && value !== null && value !== false && value !== ""
  );
}

function datavisualizationLegendNameFromOptions(...rawOptions) {
  for (const raw of rawOptions) {
    if (raw === undefined || raw === null || raw === false || raw === "") continue;
    const parsed = parseOptions(String(raw));
    const value = parsed.legend;
    if (value === undefined || value === null || value === false || value === true || value === "") continue;
    const name = stripOuterBracesText(String(value)).trim();
    if (name) return name;
  }
  return "main legend";
}

function datavisualizationNamedLegendOption(legendName = "", options = {}, globalOptions = {}) {
  const name = stripOuterBracesText(String(legendName || "")).trim();
  if (!name || name === "main legend") return "";
  const values = [options[name], globalOptions[name]];
  for (const value of values) {
    if (value === undefined || value === null || value === false || value === "") continue;
    return value;
  }
  return "";
}

function datavisualizationNormalizeStyleOptions(styleOptions = {}) {
  const normalized = { ...(styleOptions || {}) };
  for (const [key, value] of Object.entries(styleOptions || {})) {
    if (value !== true || !datavisualizationLooksLikeColorName(key)) continue;
    normalized.color = key;
    delete normalized[key];
  }
  return normalized;
}

function datavisualizationLooksLikeColorName(value) {
  const text = String(value || "").trim();
  if (!text || /\s/.test(text)) return false;
  return /^(?:black|white|red|green|blue|cyan|magenta|yellow|orange|purple|violet|pink|brown|gray|grey|lime|olive|teal)(?:![0-9]+(?:!(?:black|white|red|green|blue|cyan|magenta|yellow|orange|purple|violet|pink|brown|gray|grey|lime|olive|teal))?)*$/i.test(
    text
  );
}

function datavisualizationStyleSheets(globalOptions = {}, rawOptions = "") {
  const styleSheets = new Set();
  const append = (value) => {
    if (value === undefined || value === null || value === true) return;
    const normalized = String(value)
      .trim()
      .replace(/^\{([\s\S]*)\}$/, "$1")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (normalized) styleSheets.add(normalized);
  };
  const parsedValue = globalOptions["style sheet"];
  if (Array.isArray(parsedValue)) parsedValue.forEach(append);
  else append(parsedValue);
  const parsedSetAttributeValue = globalOptions["/data point/set/.style sheet"];
  if (Array.isArray(parsedSetAttributeValue)) parsedSetAttributeValue.forEach(append);
  else append(parsedSetAttributeValue);

  for (const part of splitTopLevel(String(rawOptions || ""), ",")) {
    const match = part.match(/^\s*style\s+sheet\s*=\s*([\s\S]+?)\s*$/i);
    if (match) append(match[1]);
    const setAttributeMatch = part.match(/^\s*\/data\s+point\/set\/\.style\s+sheet\s*=\s*([\s\S]+?)\s*$/i);
    if (setAttributeMatch) append(setAttributeMatch[1]);
  }
  return styleSheets;
}

function datavisualizationCustomStyleSheetOptions(styleSheets, customStyleSheets, plotIndex, setName = "", globalOptions = {}) {
  if (!customStyleSheets || typeof customStyleSheets.get !== "function") return {};
  const styleOptions = {};
  const explicitSet = String(setName || "").trim();
  const lookupValue = datavisualizationSetStyleSheetValue(globalOptions, explicitSet, plotIndex);
  for (const sheetName of styleSheets || []) {
    const definition = customStyleSheets.get(normalizeDatavisualizationStyleSheetName(sheetName));
    if (!definition) continue;
    if (definition.colorSeries) {
      const color = datavisualizationCustomColorSeriesColor(lookupValue, definition.colorSeries);
      if (color) styleOptions.color = color;
      continue;
    }
    const styleText =
      (lookupValue && definition.entries.get(lookupValue)) ||
      definition.defaultStyle ||
      "";
    if (!styleText) continue;
    Object.assign(styleOptions, datavisualizationNormalizeStyleOptions(parseOptions(datavisualizationResolveStyleSheetStyleText(styleText, lookupValue))));
  }
  return styleOptions;
}

function datavisualizationCustomColorSeriesColor(lookupValue, series) {
  const value = Number(String(lookupValue || "").trim());
  if (!Number.isFinite(value)) return "";
  const start = Array.isArray(series?.start) ? series.start : [];
  const step = Array.isArray(series?.step) ? series.step : [];
  if (start.length < 3 || step.length < 3) return "";
  const components = [0, 1, 2].map((index) => start[index] + value * step[index]);
  const model = String(series?.model || "").trim().toLowerCase();
  if (model === "hsb" || model === "hsb:rgb") {
    const h = datavisualizationColorSeriesComponent(components[0], true);
    const s = datavisualizationColorSeriesComponent(components[1]);
    const b = datavisualizationColorSeriesComponent(components[2]);
    const [r, g, blue] = datavisualizationHsbToRgb(h, s, b).map((component) => Math.round(component * 255));
    return `rgb(${r} ${g} ${blue})`;
  }
  if (model === "rgb") {
    const [r, g, blue] = components
      .map((component) => datavisualizationColorSeriesComponent(component))
      .map((component) => Math.round(component * 255));
    return `rgb(${r} ${g} ${blue})`;
  }
  return "";
}

function datavisualizationResolveStyleSheetStyleText(styleText, lookupValue) {
  const replacement = String(lookupValue || "").trim();
  if (!replacement) return String(styleText || "");
  return String(styleText || "").replace(/#1/g, replacement);
}

function datavisualizationSetStyleSheetValue(globalOptions = {}, setName = "", plotIndex = 0) {
  const set = String(setName || "").trim();
  if (set) {
    const initialKey = `/data point/set/${set}/.initial`;
    const remapped = globalOptions[initialKey];
    if (remapped !== undefined && remapped !== null && remapped !== true && String(remapped).trim() !== "") {
      return String(remapped).trim();
    }
    if (/^-?\d+(?:\.\d+)?$/.test(set)) return set;
  }
  return String(Math.max(1, Math.floor(Number(plotIndex) || 0) + 1));
}

function datavisualizationPointGroups(points, dataOptions = {}, globalOptions = {}, visualOptions = {}) {
  const explicitSet = String(dataOptions.set || "").trim();
  const fallbackSet =
    explicitSet ||
    datavisualizationVisualName(visualOptions, "scatter") ||
    datavisualizationVisualName(visualOptions, "rectangles") ||
    datavisualizationVisualName(visualOptions, "line") ||
    datavisualizationDefaultSetName(globalOptions) ||
    "";
  const grouped = new Map();
  for (const point of points || []) {
    const set = String(point.set || fallbackSet || "").trim();
    const key = set || "__default";
    if (!grouped.has(key)) grouped.set(key, { set, points: [] });
    grouped.get(key).points.push(point);
  }
  return [...grouped.values()];
}

function datavisualizationResolveVisualizer(setName, options = {}, dataOptions = {}, globalOptions = {}) {
  if (globalOptions["candle stick plot"] || options["candle stick plot"]) return { kind: "candlestick", name: "candle stick", smooth: false };
  const localRectangles = datavisualizationVisualName(options, "rectangles");
  if (options["visualize as rectangles"]) return { kind: "rectangle", name: localRectangles || "rectangles", smooth: false };
  const localScatter = datavisualizationVisualName(options, "scatter");
  if (options["visualize as scatter"]) return { kind: "scatter", name: localScatter || "scatter", smooth: false };
  const localSmoothCycle = datavisualizationVisualName(options, "smooth cycle");
  if (options["visualize as smooth cycle"]) return { kind: "line", name: localSmoothCycle || "line", smooth: true, cycle: true };
  const localSmooth = datavisualizationVisualName(options, "smooth");
  if (options["visualize as smooth line"]) return { kind: "line", name: localSmooth || "line", smooth: true };
  const localLine = datavisualizationVisualName(options, "line");
  if (options["visualize as line"]) return { kind: "line", name: localLine || "line", smooth: false };

  const set = String(setName || dataOptions.set || "").trim();
  const declarations = datavisualizationVisualizerDeclarations(globalOptions);
  if (set && declarations[set]) return declarations[set];
  if (set) return { kind: "line", name: set, smooth: true };
  return { kind: "line", name: datavisualizationDefaultSetName(globalOptions) || "line", smooth: true };
}

function datavisualizationVisualizerDeclarations(globalOptions = {}) {
  const declarations = {};
  const add = (name, kind, smooth, extra = {}) => {
    const key = String(name || "").trim();
    if (!key) return;
    declarations[key] = { kind, name: key, smooth, ...extra };
  };
  add(datavisualizationVisualName(globalOptions, "scatter") || (globalOptions["visualize as scatter"] ? "scatter" : ""), "scatter", false);
  add(datavisualizationVisualName(globalOptions, "rectangles") || (globalOptions["visualize as rectangles"] ? "rectangles" : ""), "rectangle", false);
  add(
    datavisualizationVisualName(globalOptions, "smooth cycle") || (globalOptions["visualize as smooth cycle"] ? "line" : ""),
    "line",
    true,
    { cycle: true }
  );
  add(datavisualizationVisualName(globalOptions, "smooth") || (globalOptions["visualize as smooth line"] ? "line" : ""), "line", true);
  add(datavisualizationVisualName(globalOptions, "line") || (globalOptions["visualize as line"] ? "line" : ""), "line", false);
  for (const name of datavisualizationListValues(globalOptions["visualize as scatter/.list"])) add(name, "scatter", false);
  for (const name of datavisualizationListValues(globalOptions["visualize as rectangles/.list"])) add(name, "rectangle", false);
  for (const name of datavisualizationListValues(globalOptions["visualize as smooth cycle/.list"])) add(name, "line", true, { cycle: true });
  for (const name of datavisualizationListValues(globalOptions["visualize as smooth line/.list"])) add(name, "line", true);
  for (const name of datavisualizationListValues(globalOptions["visualize as line/.list"])) add(name, "line", false);
  return declarations;
}

function datavisualizationDeclaredVisualizerCount(globalOptions = {}) {
  return Math.max(1, Object.keys(datavisualizationVisualizerDeclarations(globalOptions)).length);
}

function datavisualizationDefaultSetName(globalOptions = {}) {
  const declarations = datavisualizationVisualizerDeclarations(globalOptions);
  return Object.keys(declarations)[0] || "";
}

function datavisualizationNormalizeRectanglePoints(points = [], visualOptions = {}) {
  const attribute1 = datavisualizationAttributeName(visualOptions["attribute 1"], "x");
  const attribute2 = datavisualizationAttributeName(visualOptions["attribute 2"], "y");
  const useDefaultRectangle = attribute1 === "x" && attribute2 === "y";
  return (points || []).map((point) => {
    const rectangle = datavisualizationRectangleFromAttributes(point, attribute1, attribute2) || (useDefaultRectangle ? point.rectangle : null);
    if (!rectangle) return point;
    return {
      ...point,
      x: (rectangle.xMin + rectangle.xMax) / 2,
      y: (rectangle.yMin + rectangle.yMax) / 2,
      rectangle
    };
  });
}

function datavisualizationAttributeName(value, fallback) {
  const text = value === undefined || value === null || value === true ? "" : String(value).trim();
  return text.replace(/^\{([\s\S]*)\}$/, "$1").trim() || fallback;
}

function datavisualizationRectangleFromAttributes(point, attribute1 = "x", attribute2 = "y") {
  const xMin = datavisualizationPointNumericAttribute(point, `${attribute1}/min`, NaN);
  const xMax = datavisualizationPointNumericAttribute(point, `${attribute1}/max`, NaN);
  const yMin = datavisualizationPointNumericAttribute(point, `${attribute2}/min`, NaN);
  const yMax = datavisualizationPointNumericAttribute(point, `${attribute2}/max`, NaN);
  const rectangle = { xMin, xMax, yMin, yMax };
  return Object.values(rectangle).every(Number.isFinite) ? rectangle : null;
}

function datavisualizationListValues(raw) {
  return String(raw || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function datavisualizationAxisOptions(globalOptionsRaw, plotSpecs, context = {}) {
  const globalOptions = parseOptions(globalOptionsRaw || "");
  const xAxisOptions = parseOptions(globalOptions["x axis"] || "");
  const yAxisOptions = parseOptions(globalOptions["y axis"] || "");
  const allAxesOptions = parseOptions(globalOptions["all axes"] || "");
  const axisScaling = context.axisScaling || {};
  const scientificAxisStyles = datavisualizationScientificAxisStyles(globalOptions["scientific axes"]);
  const cleanAxes = scientificAxisStyles.has("clean");
  const endLabels = Boolean(globalOptions["end labels"] || scientificAxisStyles.has("end labels"));
  const uprightLabels = Boolean(globalOptions["upright labels"] || scientificAxisStyles.has("upright labels"));
  const ranges = datavisualizationApplyAxisBounds(datavisualizationPlotRanges(plotSpecs), {
    xAxisOptions,
    yAxisOptions,
    allAxesOptions,
    globalOptions
  });
  datavisualizationApplyScalingTargetRanges(ranges, axisScaling);
  const xyCartesianAxes = Boolean(globalOptions["xy Cartesian"]);
  const xGridRequested = datavisualizationAxisWantsGrid(xAxisOptions, allAxesOptions);
  const yGridRequested = datavisualizationAxisWantsGrid(yAxisOptions, allAxesOptions);
  const xGrid = xyCartesianAxes ? xGridRequested && datavisualizationAxisVisualizesGrid(xAxisOptions, allAxesOptions) : xGridRequested;
  const yGrid = xyCartesianAxes ? yGridRequested && datavisualizationAxisVisualizesGrid(yAxisOptions, allAxesOptions) : yGridRequested;
  const schoolBookAxes = Boolean(globalOptions["school book axes"]);
  const xLogarithmic = datavisualizationAxisIsLogarithmic(xAxisOptions, allAxesOptions);
  const yLogarithmic = datavisualizationAxisIsLogarithmic(yAxisOptions, allAxesOptions);
  const majorStrokeWidth = "0.4pt";
  const singlePointScatter = datavisualizationIsSinglePointScatter(plotSpecs);
  const candleStickPlot = Boolean(globalOptions["candle stick plot"]);
  const sparkLine = Boolean(globalOptions["spark line"]);
  const candleStickDefaultWidth = `${roundTikzNumber(Math.max(0.3, (ranges.xMax - ranges.xMin) * 0.3))}cm`;
  const sparkLineDefaultWidth = `${roundTikzNumber(Math.max(parseDimension("1pt", {}), (ranges.xMax - ranges.xMin) * parseDimension("1pt", {})))}cm`;
  const xyCartesianDefaultWidth = `${roundTikzNumber(Math.max(0.001, ranges.xMax - ranges.xMin))}cm`;
  const xyCartesianDefaultHeight = `${roundTikzNumber(Math.max(0.001, ranges.yMax - ranges.yMin))}cm`;
  const xTickSourceRange = datavisualizationAxisTickSourceRange("x", ranges, axisScaling);
  const yTickSourceRange = datavisualizationAxisTickSourceRange("y", ranges, axisScaling);
  const xSourceTicks = datavisualizationTickOption(xTickSourceRange.min, xTickSourceRange.max, "x", xAxisOptions, allAxesOptions, {
    schoolBookAxes,
    cleanAxes,
    singlePointScatter,
    candleStickPlot
  });
  const ySourceTicks = datavisualizationTickOption(yTickSourceRange.min, yTickSourceRange.max, "y", yAxisOptions, allAxesOptions, { schoolBookAxes, cleanAxes, singlePointScatter });
  const xTicks = datavisualizationScaleTickOption(xSourceTicks, axisScaling.x);
  const yTicks = datavisualizationScaleTickOption(ySourceTicks, axisScaling.y);
  const xTickLabels = datavisualizationSourceTickLabels(xSourceTicks, axisScaling.x, xAxisOptions, allAxesOptions);
  const yTickLabels = datavisualizationSourceTickLabels(ySourceTicks, axisScaling.y, yAxisOptions, allAxesOptions);
  const xMinorSourceTicks = datavisualizationMinorTickOption(xTickSourceRange.min, xTickSourceRange.max, xAxisOptions, allAxesOptions, xSourceTicks);
  const yMinorSourceTicks = datavisualizationMinorTickOption(yTickSourceRange.min, yTickSourceRange.max, yAxisOptions, allAxesOptions, ySourceTicks);
  const xMinorGridSourceTicks = datavisualizationMinorTickOption(xTickSourceRange.min, xTickSourceRange.max, xAxisOptions, allAxesOptions, xSourceTicks, "grid");
  const yMinorGridSourceTicks = datavisualizationMinorTickOption(yTickSourceRange.min, yTickSourceRange.max, yAxisOptions, allAxesOptions, ySourceTicks, "grid");
  const xMinorGridVisual = datavisualizationVisualizeGridConfig(xAxisOptions, "minor");
  const yMinorGridVisual = datavisualizationVisualizeGridConfig(yAxisOptions, "minor");
  const xMajorTickVisual = datavisualizationVisualizeTicksConfig(xAxisOptions, allAxesOptions, "major");
  const yMajorTickVisual = datavisualizationVisualizeTicksConfig(yAxisOptions, allAxesOptions, "major");
  const xMinorTickVisual = datavisualizationVisualizeTicksConfig(xAxisOptions, allAxesOptions, "minor");
  const yMinorTickVisual = datavisualizationVisualizeTicksConfig(yAxisOptions, allAxesOptions, "minor");
  const xTickColor = datavisualizationAxisTickStyleColor(xAxisOptions, allAxesOptions);
  const yTickColor = datavisualizationAxisTickStyleColor(yAxisOptions, allAxesOptions);
  return {
    width: datavisualizationAxisLength(xAxisOptions, globalOptions["scientific axes width"] || globalOptions.width || (sparkLine ? sparkLineDefaultWidth : candleStickPlot ? candleStickDefaultWidth : xyCartesianAxes ? xyCartesianDefaultWidth : "5cm"), {
      min: ranges.xMin,
      max: ranges.xMax,
      logarithmic: xLogarithmic,
      allAxesOptions,
      scaling: axisScaling.x,
      schoolBookAxes: schoolBookAxes && !globalOptions["scientific axes width"] && !globalOptions.width
    }),
    height: datavisualizationAxisLength(yAxisOptions, globalOptions["scientific axes height"] || globalOptions.height || (sparkLine ? "1em" : candleStickPlot ? "1cm" : xyCartesianAxes ? xyCartesianDefaultHeight : "3.09cm"), {
      min: ranges.yMin,
      max: ranges.yMax,
      logarithmic: yLogarithmic,
      allAxesOptions,
      scaling: axisScaling.y,
      schoolBookAxes: schoolBookAxes && !globalOptions["scientific axes height"] && !globalOptions.height
    }),
    "scale only axis": true,
    "datavis clean axes": cleanAxes,
    "datavis candle stick plot": candleStickPlot ? true : undefined,
    "datavis boxed axes": !cleanAxes && !schoolBookAxes && !sparkLine && !xyCartesianAxes,
    "datavis tick direction": scientificAxisStyles.has("inner ticks") ? "inner" : "outer",
    "datavis clean padding": candleStickPlot ? "0cm" : "0.175cm",
    "datavis clean x max extension": candleStickPlot ? "0.18cm" : undefined,
    "datavis clean y max extension": candleStickPlot ? "0.08cm" : undefined,
    "axis clean line color": "black!50",
    "axis boundary color": "black!25",
    "axis frame color": !cleanAxes && !schoolBookAxes ? "black!50" : undefined,
    "axis clean line width": majorStrokeWidth,
    "axis boundary line width": candleStickPlot ? "0.25pt" : majorStrokeWidth,
    "datavis hide out of range tick labels": true,
    "axis line width": schoolBookAxes || xyCartesianAxes ? majorStrokeWidth : undefined,
    "axis school book padding": schoolBookAxes ? "7.5pt" : undefined,
    // PGF's school-book axis system suppresses the x=0 tick label but keeps
    // the y=0 label at the intersection, anchored north east without a tick.
    // Keep that asymmetric rule explicit for the generic tick renderer.
    "datavis school book y origin label": schoolBookAxes ? true : undefined,
    "axis tick color": schoolBookAxes ? "black" : "black!50",
    "x axis tick color": xTickColor || undefined,
    "y axis tick color": yTickColor || undefined,
    "x axis tick label color": xTickColor || undefined,
    "y axis tick label color": yTickColor || undefined,
    "axis tick line width": candleStickPlot ? "0.25pt" : majorStrokeWidth,
    "axis tick label font": datavisualizationRoleFont("tick"),
    "axis tick label inner sep": candleStickPlot ? "0pt" : undefined,
    "x axis tick label distance": candleStickPlot ? "0.08cm" : undefined,
    "y axis tick label distance": candleStickPlot ? "0.045cm" : undefined,
    "axis grid color": "black!25",
    "axis grid line width": majorStrokeWidth,
    "axis minor grid line width": "0.2pt",
    grid: xGrid && yGrid ? "major" : undefined,
    "x grid": xGrid ? "major" : undefined,
    "y grid": yGrid ? "major" : undefined,
    xmin: ranges.xMin,
    xmax: ranges.xMax,
    ymin: ranges.yMin,
    ymax: ranges.yMax,
    xmode: xLogarithmic ? "log" : undefined,
    ymode: yLogarithmic ? "log" : undefined,
    "x grid values": xTicks,
    "y grid values": yTicks,
    xtick: sparkLine || (xyCartesianAxes && !datavisualizationAxisVisualizesTicks(xAxisOptions, allAxesOptions)) ? "\\empty" : xTicks,
    ytick: sparkLine || (xyCartesianAxes && !datavisualizationAxisVisualizesTicks(yAxisOptions, allAxesOptions)) ? "\\empty" : yTicks,
    xticklabels: sparkLine ? undefined : xTickLabels,
    yticklabels: sparkLine ? undefined : yTickLabels,
    "x minor tick values": datavisualizationScaleTickOption(xMinorSourceTicks, axisScaling.x),
    "y minor tick values": datavisualizationScaleTickOption(yMinorSourceTicks, axisScaling.y),
    "x minor grid values": datavisualizationScaleTickOption(xMinorGridSourceTicks || xMinorSourceTicks, axisScaling.x),
    "y minor grid values": datavisualizationScaleTickOption(yMinorGridSourceTicks || yMinorSourceTicks, axisScaling.y),
    "x minor grid low": xMinorGridVisual.low,
    "x minor grid high": xMinorGridVisual.high,
    "x minor grid style": xMinorGridVisual.style,
    "x minor grid direction axis": xMinorGridVisual.directionAxis,
    "y minor grid low": yMinorGridVisual.low,
    "y minor grid high": yMinorGridVisual.high,
    "y minor grid style": yMinorGridVisual.style,
    "y minor grid direction axis": yMinorGridVisual.directionAxis,
    "x major tick visualized": xMajorTickVisual.enabled,
    "x major tick low": xMajorTickVisual.low,
    "x major tick high": xMajorTickVisual.high,
    "x major tick style": xMajorTickVisual.style,
    "x major tick direction axis": xMajorTickVisual.directionAxis,
    "x major tick text at low": xMajorTickVisual.tickTextAtLow,
    "x major tick text at high": xMajorTickVisual.tickTextAtHigh,
    "x major tick x axis goto": xMajorTickVisual.xAxisGoto,
    "x major tick y axis goto": xMajorTickVisual.yAxisGoto,
    "y major tick visualized": yMajorTickVisual.enabled,
    "y major tick low": yMajorTickVisual.low,
    "y major tick high": yMajorTickVisual.high,
    "y major tick style": yMajorTickVisual.style,
    "y major tick direction axis": yMajorTickVisual.directionAxis,
    "y major tick text at low": yMajorTickVisual.tickTextAtLow,
    "y major tick text at high": yMajorTickVisual.tickTextAtHigh,
    "y major tick x axis goto": yMajorTickVisual.xAxisGoto,
    "y major tick y axis goto": yMajorTickVisual.yAxisGoto,
    "x minor tick visualized": xMinorTickVisual.enabled,
    "x minor tick low": xMinorTickVisual.low,
    "x minor tick high": xMinorTickVisual.high,
    "x minor tick style": xMinorTickVisual.style,
    "x minor tick direction axis": xMinorTickVisual.directionAxis,
    "x minor tick x axis goto": xMinorTickVisual.xAxisGoto,
    "x minor tick y axis goto": xMinorTickVisual.yAxisGoto,
    "y minor tick visualized": yMinorTickVisual.enabled,
    "y minor tick low": yMinorTickVisual.low,
    "y minor tick high": yMinorTickVisual.high,
    "y minor tick style": yMinorTickVisual.style,
    "y minor tick direction axis": yMinorTickVisual.directionAxis,
    "y minor tick x axis goto": yMinorTickVisual.xAxisGoto,
    "y minor tick y axis goto": yMinorTickVisual.yAxisGoto,
    xminorgrids: (datavisualizationHasMinorSteps(xAxisOptions, allAxesOptions) || datavisualizationHasMinorSteps(xAxisOptions, allAxesOptions, "grid")) && xGrid ? true : undefined,
    yminorgrids: (datavisualizationHasMinorSteps(yAxisOptions, allAxesOptions) || datavisualizationHasMinorSteps(yAxisOptions, allAxesOptions, "grid")) && yGrid ? true : undefined,
    xlabel: datavisualizationAxisLabel(xAxisOptions, "x"),
    ylabel: datavisualizationAxisLabel(yAxisOptions, "y"),
    "datavis axis label placement": endLabels ? "end" : uprightLabels ? "upright" : "standard",
    "axis label font": datavisualizationRoleFont("axisLabel"),
    "x axis label offset": cleanAxes ? "0.58cm" : undefined,
    "major tick length": candleStickPlot ? "0.025cm" : "2pt",
    "axis lines": sparkLine ? "none" : cleanAxes ? "none" : schoolBookAxes || xyCartesianAxes ? "center" : "box"
  };
}

function datavisualizationIsSinglePointScatter(plotSpecs = []) {
  const nonEmpty = plotSpecs.filter((plot) => ((plot.surveyPoints?.length ? plot.surveyPoints : plot.points) || []).length);
  if (!nonEmpty.length) return false;
  const pointCount = nonEmpty.reduce((sum, plot) => sum + (((plot.surveyPoints?.length ? plot.surveyPoints : plot.points) || []).length), 0);
  return pointCount === 1 && nonEmpty.every((plot) => plot.kind === "scatter" || plot.noLines);
}

function datavisualizationApplyScalingTargetRanges(ranges, axisScaling = {}) {
  if (axisScaling.x?.targetRange) {
    ranges.xMin = axisScaling.x.targetRange.min;
    ranges.xMax = axisScaling.x.targetRange.max;
  }
  if (axisScaling.y?.targetRange) {
    ranges.yMin = axisScaling.y.targetRange.min;
    ranges.yMax = axisScaling.y.targetRange.max;
  }
  return ranges;
}

function datavisualizationAxisTickSourceRange(axis, ranges, axisScaling = {}) {
  const scaling = axis === "x" ? axisScaling.x : axisScaling.y;
  if (scaling?.sourceRange) return { min: scaling.sourceRange.min, max: scaling.sourceRange.max };
  return axis === "x" ? { min: ranges.xMin, max: ranges.xMax } : { min: ranges.yMin, max: ranges.yMax };
}

function datavisualizationScaleTickOption(raw, scaling) {
  if (!scaling || raw === undefined || raw === null || raw === false || raw === "") return raw;
  const values = datavisualizationTickOptionValues(raw);
  if (!values.length) return raw;
  return `{${values.map((value) => formatAxisNumber(scaling.scale(value))).join(",")}}`;
}

function datavisualizationSourceTickLabels(raw, scaling, axisOptions = {}, allAxesOptions = {}) {
  const manual = datavisualizationManualTickData(axisOptions, allAxesOptions);
  const hasManualLabels = manual.labels.size > 0;
  if (!scaling && !hasManualLabels) return undefined;
  const values = datavisualizationTickOptionValues(raw);
  if (!values.length) return undefined;
  return `{${values.map((value) => `{${datavisualizationTickLabelForValue(value, manual.labels) ?? formatAxisTickLabel(value)}}`).join(",")}}`;
}

function datavisualizationAxisIsLogarithmic(axisOptions = {}, allAxesOptions = {}) {
  return Boolean(axisOptions.logarithmic || allAxesOptions.logarithmic);
}

function datavisualizationScientificAxisStyles(raw) {
  const styles = new Set();
  if (raw === undefined || raw === null || raw === false || raw === "") return styles;
  if (raw === true) {
    styles.add("standard labels");
    return styles;
  }
  for (const part of splitTopLevel(String(raw).trim().replace(/^\{([\s\S]*)\}$/, "$1"), ",")) {
    const value = part.trim().toLowerCase().replace(/\s+/g, " ");
    if (value) styles.add(value);
  }
  return styles;
}

function datavisualizationAxisLabel(axisOptions = {}, axisName = "") {
  const raw = axisOptions.label;
  if (raw === undefined || raw === null || raw === false || raw === "") return undefined;
  if (raw === true) return `$\\mathit{${axisName || "x"}}$`;
  return String(raw).trim();
}

function datavisualizationAxisWantsGrid(axisOptions = {}, allAxesOptions = {}) {
  const value =
    axisOptions.grid ??
    axisOptions["ticks and grid"] ??
    allAxesOptions.grid ??
    allAxesOptions["ticks and grid"];
  if (value === undefined || value === null || value === "") return false;
  const text = String(value).toLowerCase();
  return text !== "false" && text !== "none";
}

function datavisualizationAxisVisualizesGrid(axisOptions = {}, allAxesOptions = {}) {
  const value = axisOptions["visualize grid"] ?? allAxesOptions["visualize grid"];
  if (value === undefined || value === null || value === false || value === "") return false;
  const text = String(value).toLowerCase();
  return text !== "false" && text !== "none";
}

function datavisualizationAxisVisualizesTicks(axisOptions = {}, allAxesOptions = {}) {
  const value = axisOptions["visualize ticks"] ?? allAxesOptions["visualize ticks"];
  if (value === undefined || value === null || value === false || value === "") return false;
  const text = String(value).toLowerCase();
  return text !== "false" && text !== "none";
}

function datavisualizationAxisTickStyleColor(axisOptions = {}, allAxesOptions = {}) {
  const candidates = [
    parseOptions(axisOptions.ticks || axisOptions.tick || "").style,
    parseOptions(parseOptions(axisOptions.ticks || axisOptions.tick || "").major || "").style,
    parseOptions(allAxesOptions.ticks || allAxesOptions.tick || "").style,
    parseOptions(parseOptions(allAxesOptions.ticks || allAxesOptions.tick || "").major || "").style
  ];
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === true || candidate === "") continue;
    const normalized = datavisualizationNormalizeStyleOptions(parseOptions(candidate));
    const color = normalized.text || normalized.color || normalized.draw || "";
    if (color) return color;
  }
  return "";
}

function datavisualizationAxisLength(axisOptions = {}, fallback, context = {}) {
  const allAxesOptions = context.allAxesOptions || {};
  const powerUnitLength = datavisualizationAxisOptionValue(axisOptions["power unit length"], allAxesOptions["power unit length"]);
  if (context.logarithmic && powerUnitLength !== undefined && powerUnitLength !== null && powerUnitLength !== true && String(powerUnitLength).trim() !== "") {
    const unit = parseDimension(String(powerUnitLength), {});
    const span = datavisualizationLogSpan(context.min, context.max);
    if (Number.isFinite(unit) && unit > 0 && Number.isFinite(span) && span > 0) return `${roundTikzNumber(unit * span)}cm`;
  }
  if (context.scaling?.targetIsDimension) {
    const span = Math.abs(Number(context.scaling.targetEnd) - Number(context.scaling.targetStart));
    if (Number.isFinite(span) && span > 0) return `${roundTikzNumber(span)}cm`;
  }
  const explicitLength = datavisualizationAxisOptionValue(axisOptions.length, allAxesOptions.length);
  if (explicitLength !== undefined && explicitLength !== null && explicitLength !== true && String(explicitLength).trim() !== "") {
    return explicitLength;
  }
  const unitLength = datavisualizationAxisOptionValue(axisOptions["unit length"], allAxesOptions["unit length"]);
  if (unitLength !== undefined && unitLength !== null && unitLength !== true && String(unitLength).trim() !== "") {
    const unit = parseDimension(String(unitLength), {});
    const span = Number(context.max) - Number(context.min);
    if (Number.isFinite(unit) && unit > 0 && Number.isFinite(span) && span > 0) return `${roundTikzNumber(unit * span)}cm`;
  }
  if (context.schoolBookAxes) {
    const span = Number(context.max) - Number(context.min);
    if (Number.isFinite(span) && span > 0) return `${roundTikzNumber(span)}cm`;
  }
  return fallback;
}

function datavisualizationAxisOptionValue(primary, fallback) {
  if (primary !== undefined && primary !== null && primary !== true && String(primary).trim() !== "") return primary;
  return fallback;
}

function datavisualizationLogSpan(min, max) {
  const low = Number(min);
  const high = Number(max);
  if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high <= 0 || high <= low) return NaN;
  return Math.log10(high) - Math.log10(low);
}

function datavisualizationApplyAxisBounds(ranges, context) {
  const next = { ...ranges };
  applyDatavisualizationSingleAxisBounds(next, "x", context.xAxisOptions, context.allAxesOptions);
  applyDatavisualizationSingleAxisBounds(next, "y", context.yAxisOptions, context.allAxesOptions);
  if (context.globalOptions?.["candle stick plot"]) {
    next.xMin = Math.min(next.xMin, 0);
    next.yMin = Math.min(next.yMin, 0);
    next.yMax = Math.max(next.yMax, 100);
  }
  if (context.globalOptions?.["school book axes"]) {
    next.xMin = Math.min(next.xMin, 0);
    next.xMax = Math.max(next.xMax, 0);
    next.yMin = Math.min(next.yMin, 0);
    next.yMax = Math.max(next.yMax, 0);
  }
  return next;
}

function applyDatavisualizationSingleAxisBounds(ranges, axis, axisOptions = {}, allAxesOptions = {}) {
  const minKey = `${axis}Min`;
  const maxKey = `${axis}Max`;
  const minValue = datavisualizationAxisNumericOption(axisOptions["min value"] ?? allAxesOptions["min value"]);
  const maxValue = datavisualizationAxisNumericOption(axisOptions["max value"] ?? allAxesOptions["max value"]);
  if (Number.isFinite(minValue)) ranges[minKey] = minValue;
  if (Number.isFinite(maxValue)) ranges[maxKey] = maxValue;
  for (const value of datavisualizationAxisIncludeValues(axisOptions["include value"])) {
    ranges[minKey] = Math.min(ranges[minKey], value);
    ranges[maxKey] = Math.max(ranges[maxKey], value);
  }
  for (const value of datavisualizationAxisIncludeValues(allAxesOptions["include value"])) {
    ranges[minKey] = Math.min(ranges[minKey], value);
    ranges[maxKey] = Math.max(ranges[maxKey], value);
  }
}

function datavisualizationAxisNumericOption(value) {
  if (value === undefined || value === null || value === true || value === "") return NaN;
  return axisNumber(value, NaN);
}

function datavisualizationAxisIncludeValues(raw) {
  if (raw === undefined || raw === null || raw === false || raw === "") return [];
  return splitTopLevel(String(raw).trim().replace(/^\{([\s\S]*)\}$/, "$1"), ",").map((value) => axisNumber(value, NaN)).filter(Number.isFinite);
}

function datavisualizationPlotRanges(plotSpecs) {
  const points = plotSpecs.flatMap((plot) => (plot.surveyPoints?.length ? plot.surveyPoints : plot.points) || []);
  if (!points.length) return { xMin: -1, xMax: 1, yMin: 0, yMax: 1 };
  const xValues = [];
  const yValues = [];
  for (const point of points) {
    if (Number.isFinite(point.x)) xValues.push(point.x);
    if (Number.isFinite(point.y)) yValues.push(point.y);
    if (point.rectangle) {
      xValues.push(point.rectangle.xMin, point.rectangle.xMax);
      yValues.push(point.rectangle.yMin, point.rectangle.yMax);
    }
    if (point.candle) {
      yValues.push(point.candle.low, point.candle.high, point.candle.entry, point.candle.exit);
    }
  }
  if (!xValues.length || !yValues.length) return { xMin: -1, xMax: 1, yMin: 0, yMax: 1 };
  return {
    xMin: Math.min(...xValues),
    xMax: Math.max(...xValues),
    yMin: Math.min(...yValues),
    yMax: Math.max(...yValues)
  };
}

function datavisualizationTickOption(min, max, axis, axisOptions = {}, allAxesOptions = {}, options = {}) {
  const logarithmic = datavisualizationAxisIsLogarithmic(axisOptions, allAxesOptions);
  const manual = datavisualizationManualTickData(axisOptions, allAxesOptions);
  if (manual.at.length) return datavisualizationTickValuesOption([...manual.at.map((entry) => entry.value), ...manual.also.map((entry) => entry.value)]);
  const explicit = datavisualizationExplicitTickOption(min, max, axisOptions, allAxesOptions, { logarithmic });
  if (explicit) return datavisualizationAppendManualAlsoTicks(explicit, manual);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return datavisualizationAppendManualAlsoTicks(axis === "y" ? "{0,0.2,0.4,0.6,0.8,1}" : "{-5,-2.5,0,2.5,5}", manual);
  if (logarithmic) return datavisualizationAppendManualAlsoTicks(`{${datavisualizationLogTicks(min, max).map(formatAxisNumber).join(",")}}`, manual);
  if (axis === "x" && options.candleStickPlot) return datavisualizationAppendManualAlsoTicks(`{${datavisualizationIntegerTicks(min, max).map(formatAxisNumber).join(",")}}`, manual);
  if (options.schoolBookAxes) return datavisualizationAppendManualAlsoTicks(`{${datavisualizationIntegerTicks(min, max).map(formatAxisNumber).join(",")}}`, manual);
  if (options.singlePointScatter && options.cleanAxes && !datavisualizationAxisWantsGrid(axisOptions, allAxesOptions)) return datavisualizationAppendManualAlsoTicks("{0}", manual);
  if (axis === "x" && min >= -0.05 && max > 10 && max <= 25) {
    const upper = Math.max(5, Math.ceil(max / 5) * 5);
    return datavisualizationAppendManualAlsoTicks(`{${datavisualizationStepTicks(0, upper, 5).map(formatAxisNumber).join(",")}}`, manual);
  }
  if (axis === "x" && Math.abs(max - min) >= 10) return datavisualizationAppendManualAlsoTicks("{-5,-2.5,0,2.5,5}", manual);
  if (axis === "x" && !datavisualizationAxisWantsGrid(axisOptions, allAxesOptions) && min >= -0.05 && min <= 0.05 && max >= 1.8 && max <= 2.1) {
    return datavisualizationAppendManualAlsoTicks("{0,0.25,0.5,0.75,1,1.25,1.5,1.75,2}", manual);
  }
  if (axis === "y" && !datavisualizationAxisWantsGrid(axisOptions, allAxesOptions) && min <= -0.95 && max >= 0.95 && max - min <= 2.1) {
    return datavisualizationAppendManualAlsoTicks("{-1,-0.75,-0.5,-0.25,0,0.25,0.5,0.75,1}", manual);
  }
  if (axis === "y" && options.cleanAxes && !datavisualizationAxisWantsGrid(axisOptions, allAxesOptions) && min >= -0.05 && min <= 0.05 && max >= 1.8 && max <= 2.1) {
    return datavisualizationAppendManualAlsoTicks("{0,0.25,0.5,0.75,1,1.25,1.5,1.75,2}", manual);
  }
  if (axis === "y" && !datavisualizationAxisWantsGrid(axisOptions, allAxesOptions) && min >= -0.05 && min <= 0.05 && max > 2.1 && max <= 2.7) {
    return datavisualizationAppendManualAlsoTicks("{0,0.5,1,1.5,2,2.5}", manual);
  }
  if (axis === "y" && options.cleanAxes && !datavisualizationAxisWantsGrid(axisOptions, allAxesOptions) && min >= -0.05 && min <= 0.05 && max > 2.7 && max <= 3.2) {
    return datavisualizationAppendManualAlsoTicks("{0,0.5,1,1.5,2,2.5,3}", manual);
  }
  if (axis === "y" && !datavisualizationAxisWantsGrid(axisOptions, allAxesOptions) && min >= -0.05 && min <= 0.05 && max > 2.7 && max <= 6.2) {
    const upper = Math.max(3, Math.round(max));
    return datavisualizationAppendManualAlsoTicks(`{${datavisualizationStepTicks(0, upper, 1).map(formatAxisNumber).join(",")}}`, manual);
  }
  if (axis === "y" && options.cleanAxes && !datavisualizationAxisWantsGrid(axisOptions, allAxesOptions) && min >= -0.05 && min <= 0.05 && max > 0 && max <= 0.55) {
    const upper = Math.max(0.1, Math.ceil((max - 1e-9) * 10) / 10);
    return datavisualizationAppendManualAlsoTicks(`{${datavisualizationStepTicks(0, upper, 0.1).map(formatAxisNumber).join(",")}}`, manual);
  }
  if (axis === "y" && !datavisualizationAxisWantsGrid(axisOptions, allAxesOptions) && min < -1.5 && min >= -1.75 && max <= 1.5) {
    const start = Math.ceil((min - 1e-9) * 2) / 2;
    const end = Math.floor((max + 1e-9) * 2) / 2;
    return datavisualizationAppendManualAlsoTicks(`{${datavisualizationStepTicks(start, end, 0.5).map(formatAxisNumber).join(",")}}`, manual);
  }
  if (axis === "y" && min < -0.05 && max <= 1.5 && min >= -1.5) return datavisualizationAppendManualAlsoTicks("{-1,-0.5,0,0.5,1}", manual);
  if (axis === "y" && min >= -0.05 && max <= 1.2) return datavisualizationAppendManualAlsoTicks("{0,0.2,0.4,0.6,0.8,1}", manual);
  const ticks = axisMajorTickValues(min, max, axis === "x" ? 8 : 6);
  return datavisualizationAppendManualAlsoTicks(`{${ticks.map(formatAxisNumber).join(",")}}`, manual);
}

function datavisualizationAppendManualAlsoTicks(raw, manual) {
  if (!manual?.also?.length || raw === "\\empty") return raw;
  const values = [...datavisualizationTickOptionValues(raw), ...manual.also.map((entry) => entry.value)];
  return datavisualizationTickValuesOption(values);
}

function datavisualizationTickValuesOption(values) {
  const unique = uniqueAxisValues(values).sort((a, b) => a - b);
  return `{${unique.map(formatAxisNumber).join(",")}}`;
}

function datavisualizationManualTickData(axisOptions = {}, allAxesOptions = {}) {
  const data = { at: [], also: [], labels: new Map() };
  for (const raw of datavisualizationTickRawSources(axisOptions, allAxesOptions)) {
    const parsed = datavisualizationManualTickDataFromRaw(raw);
    if (parsed.at.length) data.at = parsed.at;
    data.also.push(...parsed.also);
    for (const [key, label] of parsed.labels) data.labels.set(key, label);
  }
  return data;
}

function datavisualizationTickRawSources(axisOptions = {}, allAxesOptions = {}) {
  return [
    allAxesOptions.ticks,
    allAxesOptions.tick,
    allAxesOptions["ticks and grid"],
    axisOptions.ticks,
    axisOptions.tick,
    axisOptions["ticks and grid"]
  ].filter((raw) => raw !== undefined && raw !== null && raw !== false && raw !== "");
}

function firstDefinedValue(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function datavisualizationManualTickDataFromRaw(raw) {
  const data = { at: [], also: [], labels: new Map() };
  const normalized = String(raw).trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  if (!normalized || normalized === "true" || /^(?:none|false|off|\\empty|empty)$/i.test(normalized)) return data;
  const nested = parseOptions(normalized);
  const major = parseOptions(nested.major || "");

  const atRaw = firstDefinedValue(nested.at, nested["at/.list"], nested["major at"], nested["major at/.list"], major.at, major["at/.list"]);
  const alsoRaw = firstDefinedValue(
    nested["also at"],
    nested["also at/.list"],
    nested["major also at"],
    nested["major also at/.list"],
    major["also at"],
    major["also at/.list"]
  );
  const optionsAtRaw = firstDefinedValue(nested["options at"], nested["options at/.list"], major["options at"], major["options at/.list"]);
  const noTickTextAtRaw = firstDefinedValue(
    nested["no tick text at"],
    nested["no tick text at/.list"],
    major["no tick text at"],
    major["no tick text at/.list"]
  );

  const at = datavisualizationParseManualTickList(atRaw);
  const also = datavisualizationParseManualTickList(alsoRaw);
  const optionsAt = datavisualizationParseManualTickList(optionsAtRaw);
  const noTickTextAt = datavisualizationParseNoTickTextAtList(noTickTextAtRaw);
  data.at.push(...at);
  data.also.push(...also);
  for (const entry of [...at, ...also, ...optionsAt, ...noTickTextAt]) {
    if (entry.label === undefined) continue;
    data.labels.set(datavisualizationTickLabelKey(entry.value), entry.label);
  }
  return data;
}

function datavisualizationParseNoTickTextAtList(raw) {
  if (raw === undefined || raw === null || raw === true || raw === false) return [];
  const text = stripBalancedOuterBracesForList(String(raw).trim());
  if (!text) return [];
  return splitTopLevel(text, ",")
    .map((part) => {
      const value = axisNumber(part, NaN);
      return Number.isFinite(value) ? { value, label: "" } : null;
    })
    .filter(Boolean);
}

function datavisualizationParseManualTickList(raw) {
  if (raw === undefined || raw === null || raw === true || raw === false) return [];
  const text = stripBalancedOuterBracesForList(String(raw).trim());
  if (!text) return [];
  return splitTopLevel(text, ",").map(datavisualizationParseManualTickEntry).filter(Boolean);
}

function datavisualizationParseManualTickEntry(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  const asIndex = findTopLevelKeyword(text, "as");
  const valueText = asIndex === -1 ? text : text.slice(0, asIndex).trim();
  const value = axisNumber(valueText, NaN);
  if (!Number.isFinite(value)) return null;
  if (asIndex === -1) return { value };

  let rest = text.slice(asIndex + 2).trim();
  let localOptions = "";
  if (rest.startsWith("[")) {
    const parsed = extractBalanced(rest, 0, "[", "]");
    if (parsed) {
      localOptions = stripBalancedOuterBracesForList(parsed.content.trim());
      rest = rest.slice(parsed.end).trim();
    }
  }
  const options = parseOptions(localOptions);
  const noTickText = Boolean(options["no tick text"]);
  if (noTickText) return { value, label: "" };
  return rest ? { value, label: rest } : { value };
}

function datavisualizationTickLabelForValue(value, labels) {
  if (!labels?.size) return undefined;
  const key = datavisualizationTickLabelKey(value);
  return labels.has(key) ? labels.get(key) : undefined;
}

function datavisualizationTickLabelKey(value) {
  return formatAxisNumber(value);
}

function findTopLevelKeyword(input, keyword) {
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  for (let index = 0; index <= input.length - keyword.length; index += 1) {
    const char = input[index];
    if (char === "(") paren += 1;
    else if (char === ")") paren = Math.max(0, paren - 1);
    else if (char === "[") bracket += 1;
    else if (char === "]") bracket = Math.max(0, bracket - 1);
    else if (char === "{") brace += 1;
    else if (char === "}") brace = Math.max(0, brace - 1);
    if (paren || bracket || brace) continue;
    if (input.slice(index, index + keyword.length) !== keyword) continue;
    const before = input[index - 1] || "";
    const after = input[index + keyword.length] || "";
    if ((before && /[A-Za-z@]/.test(before)) || (after && /[A-Za-z@]/.test(after))) continue;
    return index;
  }
  return -1;
}

function datavisualizationIntegerTicks(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return [];
  const epsilon = Math.max(1e-9, Math.abs(max - min) * 1e-10);
  const start = Math.ceil(min - epsilon);
  const end = Math.floor(max + epsilon);
  const values = [];
  for (let value = start; value <= end; value += 1) {
    values.push(value);
    if (values.length > 500) break;
  }
  if (!values.length && min <= 0 && max >= 0) values.push(0);
  return values;
}

function datavisualizationExplicitTickOption(min, max, axisOptions = {}, allAxesOptions = {}, options = {}) {
  const raw =
    axisOptions.ticks ??
    axisOptions.tick ??
    axisOptions["ticks and grid"] ??
    allAxesOptions.ticks ??
    allAxesOptions.tick ??
    allAxesOptions["ticks and grid"];
  if (raw === undefined || raw === null || raw === false || raw === "") return "";
  const normalized = String(raw).trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  if (!normalized || normalized === "true") return "";
  if (/^(?:none|false|off|\\empty|empty)$/i.test(normalized)) return "\\empty";

  const nested = parseOptions(normalized);
  const major = parseOptions(nested.major || "");
  const at = nested.at ?? nested["major at"] ?? major.at;
  if (at !== undefined && at !== null && at !== true && String(at).trim() !== "") {
    return `{${splitTopLevel(String(at).replace(/^\{([\s\S]*)\}$/, "$1"), ",")
      .map((item) => axisNumber(item, NaN))
      .filter(Number.isFinite)
      .map(formatAxisNumber)
      .join(",")}}`;
  }

  const step = datavisualizationAxisNumericOption(nested.step ?? nested["major step"]);
  if (Number.isFinite(step) && step > 0) {
    return `{${datavisualizationStepTicks(min, max, step).map(formatAxisNumber).join(",")}}`;
  }

  const about = datavisualizationTickCountFromOption(normalized, nested);
  if (about) {
    if (options.logarithmic) return `{${datavisualizationLogTicks(min, max).map(formatAxisNumber).join(",")}}`;
    return `{${datavisualizationAboutTicks(min, max, about).map(formatAxisNumber).join(",")}}`;
  }
  if (options.logarithmic) return `{${datavisualizationLogTicks(min, max).map(formatAxisNumber).join(",")}}`;
  return "";
}

function datavisualizationHasMinorSteps(axisOptions = {}, allAxesOptions = {}, sourceKind = "ticks") {
  return Number.isFinite(datavisualizationMinorStepCount(axisOptions, allAxesOptions, sourceKind));
}

function datavisualizationMinorStepCount(axisOptions = {}, allAxesOptions = {}, sourceKind = "ticks") {
  for (const source of datavisualizationMinorStepSources(axisOptions, allAxesOptions, sourceKind)) {
    if (source === true) continue;
    const options = parseOptions(source || "");
    const minor = parseOptions(options.minor || "");
    const raw = options["minor steps between steps"] ?? minor["minor steps between steps"];
    if (raw === undefined || raw === null || raw === false || raw === "") continue;
    if (raw === true) return 9;
    const parsed = axisNumber(raw, NaN);
    return Number.isFinite(parsed) && parsed > 0 ? Math.max(1, Math.round(parsed)) : 9;
  }
  return NaN;
}

function datavisualizationMinorStepSources(axisOptions = {}, allAxesOptions = {}, sourceKind = "ticks") {
  if (sourceKind === "grid") {
    return [
      axisOptions.grid,
      axisOptions["ticks and grid"],
      allAxesOptions.grid,
      allAxesOptions["ticks and grid"]
    ].filter((raw) => raw !== undefined && raw !== null && raw !== true && raw !== false && raw !== "");
  }
  return [
    axisOptions.ticks,
    axisOptions.tick,
    axisOptions["ticks and grid"],
    allAxesOptions.ticks,
    allAxesOptions.tick,
    allAxesOptions["ticks and grid"]
  ].filter((raw) => raw !== undefined && raw !== null && raw !== true && raw !== false && raw !== "");
}

function datavisualizationMinorTickOption(min, max, axisOptions = {}, allAxesOptions = {}, majorTickOption = "", sourceKind = "ticks") {
  const minorSteps = datavisualizationMinorStepCount(axisOptions, allAxesOptions, sourceKind);
  if (!Number.isFinite(minorSteps)) return undefined;
  const majorTicks = datavisualizationTickOptionValues(majorTickOption).filter((value) => Number.isFinite(value));
  if (majorTicks.length < 2) return undefined;
  const values = [];
  for (let index = 1; index < majorTicks.length; index += 1) {
    const from = majorTicks[index - 1];
    const to = majorTicks[index];
    const step = (to - from) / (minorSteps + 1);
    for (let sub = 1; sub <= minorSteps; sub += 1) {
      const value = from + step * sub;
      if (value >= min - 1e-9 && value <= max + 1e-9) values.push(roundAxis(value));
    }
  }
  return values.length ? `{${values.map(formatAxisNumber).join(",")}}` : undefined;
}

function datavisualizationVisualizeGridConfig(axisOptions = {}, kind = "major") {
  const raw = axisOptions["visualize grid"];
  if (raw === undefined || raw === null || raw === false || raw === "") return {};
  const options = parseOptions(raw);
  const common = parseOptions(options.common || "");
  const specific = parseOptions(options[kind] || "");
  const directionAxis = firstDefinedValue(specific["direction axis"], common["direction axis"], options["direction axis"]);
  const low = firstDefinedValue(specific.low, common.low, options.low);
  const high = firstDefinedValue(specific.high, common.high, options.high);
  const style = [options.style, common.style, specific.style]
    .filter((value) => value !== undefined && value !== null && value !== true && value !== false && String(value).trim() !== "")
    .map((value) => String(value).trim())
    .join(", ");
  return {
    directionAxis: directionAxis === undefined || directionAxis === null || directionAxis === true ? undefined : String(directionAxis).trim(),
    low: low === undefined || low === null || low === true ? undefined : String(low).trim(),
    high: high === undefined || high === null || high === true ? undefined : String(high).trim(),
    style: style || undefined
  };
}

function datavisualizationVisualizeTicksConfig(axisOptions = {}, allAxesOptions = {}, kind = "major") {
  const config = { enabled: false };
  for (const raw of [allAxesOptions["visualize ticks"], axisOptions["visualize ticks"]]) {
    if (raw === undefined || raw === null || raw === false || raw === "") continue;
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) {
      const partial = datavisualizationSingleVisualizeTicksConfig(value, kind);
      if (!partial.enabled) continue;
      config.enabled = true;
      for (const [key, entry] of Object.entries(partial)) {
        if (key === "enabled" || entry === undefined) continue;
        if (key === "style" && config.style) {
          config.style = [config.style, entry].filter(Boolean).join(", ");
        } else {
          config[key] = entry;
        }
      }
    }
  }
  return config;
}

function datavisualizationSingleVisualizeTicksConfig(raw, kind = "major") {
  if (raw === undefined || raw === null || raw === false || raw === "") return { enabled: false };
  const options = parseOptions(raw === true ? "" : String(raw));
  const common = parseOptions(options.common || "");
  const specific = parseOptions(options[kind] || "");
  const tickLength = firstDefinedValue(specific["tick length"], common["tick length"], options["tick length"]);
  const low = firstDefinedValue(specific.low, common.low, options.low, tickLength === undefined ? undefined : negativeDimensionString(tickLength));
  const high = firstDefinedValue(specific.high, common.high, options.high, tickLength);
  const style = [options.style, common.style, specific.style]
    .filter((value) => value !== undefined && value !== null && value !== true && value !== false && String(value).trim() !== "")
    .map((value) => String(value).trim())
    .join(", ");
  return {
    enabled: true,
    directionAxis: normalizeRawOption(firstDefinedValue(specific["direction axis"], common["direction axis"], options["direction axis"])),
    low: normalizeRawOption(low),
    high: normalizeRawOption(high),
    style: style || undefined,
    tickTextAtLow: rawBooleanOption(firstDefinedValue(specific["tick text at low"], common["tick text at low"], options["tick text at low"])),
    tickTextAtHigh: rawBooleanOption(firstDefinedValue(specific["tick text at high"], common["tick text at high"], options["tick text at high"])),
    xAxisGoto: datavisualizationTickAxisGoto(firstDefinedValue(specific["x axis"], common["x axis"], options["x axis"])),
    yAxisGoto: datavisualizationTickAxisGoto(firstDefinedValue(specific["y axis"], common["y axis"], options["y axis"]))
  };
}

function normalizeRawOption(value) {
  if (value === undefined || value === null || value === true || value === false) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
}

function negativeDimensionString(value) {
  const text = normalizeRawOption(value);
  if (!text) return undefined;
  return text.startsWith("-") ? text : `-${text}`;
}

function rawBooleanOption(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === true) return true;
  if (value === false) return false;
  const text = String(value).trim().toLowerCase();
  if (text === "true" || text === "yes" || text === "1") return true;
  if (text === "false" || text === "no" || text === "0") return false;
  return true;
}

function datavisualizationTickAxisGoto(raw) {
  const text = normalizeRawOption(raw);
  if (!text) return undefined;
  const options = parseOptions(text);
  const value = normalizeRawOption(options.goto);
  if (!value) return undefined;
  return value.toLowerCase();
}

function datavisualizationTickOptionValues(raw) {
  if (raw === undefined || raw === null || raw === false || raw === "") return [];
  const text = String(raw).trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  if (!text || text === "\\empty") return [];
  return splitTopLevel(text, ",").map((value) => axisNumber(value, NaN)).filter(Number.isFinite);
}

function datavisualizationLogTicks(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0 || min > max) return [];
  const start = Math.ceil(Math.log10(min));
  const end = Math.floor(Math.log10(max));
  const values = [];
  for (let exponent = start; exponent <= end; exponent += 1) {
    const value = 10 ** exponent;
    if (value >= min * (1 - 1e-10) && value <= max * (1 + 1e-10)) values.push(roundAxis(value));
    if (values.length > 100) break;
  }
  if (!values.length) values.push(min, max);
  return [...new Set(values)];
}

function datavisualizationStepTicks(min, max, step) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step) || step <= 0 || min > max) return [];
  const epsilon = Math.max(1e-9, Math.abs(max - min) * 1e-10);
  const start = Math.ceil((min - epsilon) / step) * step;
  const values = [];
  for (let value = start; value <= max + epsilon; value += step) {
    values.push(roundAxis(value));
    if (values.length > 500) break;
  }
  return values;
}

function datavisualizationAboutTicks(min, max, about) {
  const step = datavisualizationAboutStep(min, max, about);
  if (!Number.isFinite(step) || step <= 0) return axisMajorTickValues(min, max, about);
  return datavisualizationStepTicks(datavisualizationSnapTickBoundary(min, step), datavisualizationSnapTickBoundary(max, step), step);
}

function datavisualizationAboutStep(min, max, about) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(about) || about <= 0 || min > max) return NaN;
  const diff = max - min;
  if (Math.abs(diff) < 1e-12) return NaN;
  const around = Math.abs(diff) / about;
  const exponent = Math.floor(Math.log10(around));
  const scale = 10 ** exponent;
  const mantissa = around / scale;
  const standardAboutStrategy = [
    [1.5, 1],
    [2.3, 2],
    [4, 2.5],
    [7, 5],
    [11, 10]
  ];
  const selected = standardAboutStrategy.find(([threshold]) => mantissa < threshold)?.[1] ?? 10;
  return roundAxis(selected * scale);
}

function datavisualizationSnapTickBoundary(value, step) {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return value;
  const nearest = Math.round(value / step) * step;
  const tolerance = Math.max(1e-6, Math.abs(step) * 1e-6);
  return Math.abs(value - nearest) <= tolerance ? roundAxis(nearest) : value;
}

function datavisualizationTickCountFromOption(raw, nested = {}) {
  const text = String(raw || "").trim().toLowerCase();
  if (text === "few") return 3;
  if (text === "some") return 5;
  if (text === "many") return 10;
  const aboutValue = datavisualizationAxisNumericOption(nested.about);
  if (Number.isFinite(aboutValue)) return Math.max(2, Math.min(20, Math.round(aboutValue)));
  const match = text.match(/^about\s+(\d+)$/);
  return match ? Math.max(2, Math.min(20, Number(match[1]))) : 0;
}

function datavisualizationPinLabelPoint(pin, axisOptions = {}) {
  const scaled = datavisualizationScreenSpacePinLabelPoint(pin, axisOptions);
  if (scaled) return scaled;
  if (Number.isFinite(pin?.labelX) && Number.isFinite(pin?.labelY)) {
    return {
      x: pin.labelX,
      y: pin.labelY
    };
  }
  return {
    x: pin.x + 0.42,
    y: pin.y + 0.12
  };
}

function datavisualizationPinTextPoint(pin, edgePoint, axisOptions = {}) {
  if (!pin || !edgePoint || !Number.isFinite(edgePoint.x) || !Number.isFinite(edgePoint.y)) return edgePoint;
  const xMin = Number(axisOptions.xmin);
  const xMax = Number(axisOptions.xmax);
  const yMin = Number(axisOptions.ymin);
  const yMax = Number(axisOptions.ymax);
  const width = parseDimension(String(axisOptions.width || "5cm"), {});
  const height = parseDimension(String(axisOptions.height || "3.09cm"), {});
  if (![xMin, xMax, yMin, yMax, width, height].every(Number.isFinite) || xMax === xMin || yMax === yMin) return edgePoint;

  const xScale = width / (xMax - xMin);
  const yScale = height / (yMax - yMin);
  const edgeStart = datavisualizationPinEdgeStart(pin);
  const dxCm = (edgePoint.x - edgeStart.x) * xScale;
  const dyCm = (edgePoint.y - edgeStart.y) * yScale;
  const xSign = dxCm < 0 ? -1 : 1;
  const ySign = dyCm < 0 ? -1 : 1;
  const textWidthCm = datavisualizationPinTextWidthCm(pin.text);
  const xOffsetCm = xSign * Math.max(0.16, Math.min(0.34, textWidthCm * 0.21));
  const yOffsetCm = ySign < 0 ? -0.27 : 0.08;

  return {
    x: edgePoint.x + xOffsetCm / xScale,
    y: edgePoint.y + yOffsetCm / yScale
  };
}

function datavisualizationPinTextWidthCm(text) {
  const fallback = mathFallbackText(String(text || "")).replace(/\s+/g, " ").trim();
  const charCount = Math.max(1, [...fallback].length);
  return Math.max(0.32, Math.min(1.62, charCount * 0.12));
}

function datavisualizationPinEdgeStart(pin) {
  if (pin?.edgeStart && Number.isFinite(pin.edgeStart.x) && Number.isFinite(pin.edgeStart.y)) {
    return {
      x: pin.edgeStart.x,
      y: pin.edgeStart.y
    };
  }
  return {
    x: pin?.x || 0,
    y: pin?.y || 0
  };
}

function datavisualizationScreenSpacePinLabelPoint(pin, axisOptions = {}) {
  if (!pin || !Number.isFinite(pin.x) || !Number.isFinite(pin.y)) return null;
  const xMin = Number(axisOptions.xmin);
  const xMax = Number(axisOptions.xmax);
  const yMin = Number(axisOptions.ymin);
  const yMax = Number(axisOptions.ymax);
  const width = parseDimension(String(axisOptions.width || "5cm"), {});
  const height = parseDimension(String(axisOptions.height || "3.09cm"), {});
  if (![xMin, xMax, yMin, yMax, width, height].every(Number.isFinite) || xMax === xMin || yMax === yMin) return null;
  const xScale = width / (xMax - xMin);
  const yScale = height / (yMax - yMin);
  const schoolBookPin = axisOptions["axis lines"] === "center" && !pin.pinLength && !Number.isFinite(pin.pinAngle);
  const exactHitPin = Boolean(pin.edgeExact) && !pin.pinLength && !Number.isFinite(pin.pinAngle);
  let distance = parseDimension(String(pin.pinLength || (exactHitPin ? "3ex" : schoolBookPin ? "2.85ex" : "2.62ex")), {});
  const autoSideOffset = parseDimension("1.55em", {});
  if (
    !Number.isFinite(xScale) ||
    !Number.isFinite(yScale) ||
    !Number.isFinite(distance) ||
    !Number.isFinite(autoSideOffset) ||
    distance <= 0
  )
    return null;

  let normalX;
  let normalY;
  if (Number.isFinite(pin.pinAngle)) {
    const radians = (pin.pinAngle * Math.PI) / 180;
    normalX = Math.cos(radians);
    normalY = Math.sin(radians);
  } else {
    const prev = pin.previous || { x: pin.x - 1, y: pin.y };
    const next = pin.next || { x: pin.x + 1, y: pin.y };
    const tangentX = (next.x - prev.x) * xScale || 1;
    const tangentY = (next.y - prev.y) * yScale || 0;
    const length = Math.hypot(tangentX, tangentY) || 1;
    normalX = -tangentY / length;
    normalY = tangentX / length;
    if (normalY < 0) {
      normalX = -normalX;
      normalY = -normalY;
    }
  }
  if (!pin.pinLength && Math.abs(normalX) > 0.75) {
    const horizontalDistance = parseDimension("3ex", {});
    if (Number.isFinite(horizontalDistance)) distance = horizontalDistance;
  }
  const leaderSideOffset = exactHitPin
    ? 0
    : datavisualizationPinSideSign(normalX) * datavisualizationAutoSideOffset(normalX, autoSideOffset) * (schoolBookPin ? 0.45 : 1);
  const xOffset = (normalX * distance) / xScale + leaderSideOffset / xScale;
  const yOffset = (normalY * distance) / yScale;
  const normalPoint = {
    x: pin.x + xOffset,
    y: pin.y + yOffset
  };
  if (pin.swap) {
    const anchor = datavisualizationPinEdgeStart(pin);
    return {
      x: anchor.x - (normalPoint.x - anchor.x),
      y: anchor.y - (normalPoint.y - anchor.y)
    };
  }

  return normalPoint;
}

function datavisualizationAutoSideOffset(normalX, autoSideOffset) {
  if (!Number.isFinite(normalX) || !Number.isFinite(autoSideOffset)) return 0;
  return Math.abs(normalX) < 0.75 ? autoSideOffset : 0;
}

function datavisualizationPinSideSign(normalX) {
  if (!Number.isFinite(normalX) || Math.abs(normalX) < 1e-9) return 1;
  return normalX > 0 ? 1 : -1;
}

function datavisualizationVisualName(options, kind) {
  const key =
    kind === "scatter"
      ? "visualize as scatter"
      : kind === "rectangles"
        ? "visualize as rectangles"
        : kind === "smooth cycle"
          ? "visualize as smooth cycle"
          : kind === "smooth"
            ? "visualize as smooth line"
            : "visualize as line";
  const value = options[key];
  return value === true || value === undefined || value === null ? "" : String(value).trim();
}

function parseDatavisualizationData(body, dataOptions = {}) {
  const text = String(body || "");
  if (String(dataOptions.format || "").trim().toLowerCase() === "named") return parseDatavisualizationNamedData(text);
  if (/\bdata\s+point\s*\[/.test(text)) return parseDatavisualizationDataPointData(text);
  if (/\b(?:var|func)\s+[A-Za-z_]/.test(text)) return parseDatavisualizationFunctionData(text);
  const table = parseDatavisualizationTableData(text);
  if (table.points.length) return table;
  return parseDatavisualizationFunctionData(text);
}

function parseDatavisualizationNamedData(body) {
  const rows = String(body || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const points = [];

  for (const row of rows) {
    const assignments = splitTopLevel(row, ",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const match = part.match(/^([A-Za-z_][A-Za-z0-9_/-]*)\s*=\s*([\s\S]+)$/);
        if (!match) return null;
        return {
          key: match[1].trim(),
          values: datavisualizationNamedValues(match[2])
        };
      })
      .filter(Boolean);
    if (!assignments.length) continue;
    for (const combo of datavisualizationCartesianAssignments(assignments)) {
      const variables = Object.fromEntries(Object.entries(combo).map(([key, value]) => [key, String(value)]));
      const numericVariables = Object.fromEntries(
        Object.entries(combo)
          .map(([key, value]) => [key, axisNumber(value, NaN)])
          .filter(([, value]) => Number.isFinite(value))
      );
      points.push({
        ...numericVariables,
        x: Number.isFinite(numericVariables.x) ? numericVariables.x : 0,
        y: Number.isFinite(numericVariables.y) ? numericVariables.y : 0,
        rectangle: null,
        set: combo.set !== undefined ? String(combo.set).trim() : "",
        variables,
        attributes: { ...numericVariables }
      });
    }
  }

  return { kind: "table", variable: "x", variables: [], funcs: {}, points };
}

function datavisualizationNamedValues(rawValue) {
  let text = String(rawValue || "").trim();
  if (text.startsWith("{") && text.endsWith("}")) text = text.slice(1, -1).trim();
  const parts = splitTopLevel(text, ",").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return [text];
  const ellipsisIndex = parts.findIndex((part) => part === "..." || part.includes("..."));
  if (ellipsisIndex !== -1) {
    const start = axisNumber(parts[0], NaN);
    const previous = ellipsisIndex >= 2 ? axisNumber(parts[ellipsisIndex - 1], NaN) : NaN;
    const end = axisNumber(parts[parts.length - 1], NaN);
    if (Number.isFinite(start) && Number.isFinite(end)) {
      const direction = end >= start ? 1 : -1;
      const step = Math.abs(Number.isFinite(previous) ? previous - start : 1) * direction || direction;
      const values = [];
      const epsilon = Math.abs(step) * 1e-7 + 1e-9;
      for (let value = start, guard = 0; direction > 0 ? value <= end + epsilon : value >= end - epsilon; value += step, guard += 1) {
        values.push(roundAxis(value));
        if (guard >= 1200) break;
      }
      return values;
    }
  }
  return parts.map((part) => {
    const numeric = axisNumber(part, NaN);
    return Number.isFinite(numeric) ? numeric : part;
  });
}

function datavisualizationCartesianAssignments(assignments) {
  const rows = [];
  const walk = (index, current) => {
    if (index >= assignments.length) {
      rows.push(current);
      return;
    }
    const assignment = assignments[index];
    for (const value of assignment.values.length ? assignment.values : [""]) {
      walk(index + 1, { ...current, [assignment.key]: value });
    }
  };
  walk(0, {});
  return rows;
}

function parseDatavisualizationDataPointData(body) {
  const text = String(body || "");
  const points = [];
  let cursor = 0;
  while (cursor < text.length) {
    const index = text.indexOf("data point", cursor);
    if (index === -1) break;
    cursor = index + "data point".length;
    const options = parseOptionalOptions(text, cursor);
    if (options.end === cursor) {
      cursor += 1;
      continue;
    }
    const parsed = parseOptions(options.raw || "");
    const numericAttributes = Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [key, axisNumber(value, NaN)])
        .filter(([, value]) => Number.isFinite(value))
    );
    const x = numericAttributes.x;
    const y = numericAttributes.y;
    const hasCartesianPosition = Number.isFinite(x) && Number.isFinite(y);
    const hasPolarPosition = Number.isFinite(numericAttributes.angle) && Number.isFinite(numericAttributes.radius);
    if (hasCartesianPosition || hasPolarPosition) {
      const variables = Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)]));
      points.push({
        ...numericAttributes,
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : 0,
        rectangle: null,
        set: parsed.set !== undefined && parsed.set !== true ? String(parsed.set).trim() : "",
        variables,
        attributes: { ...numericAttributes }
      });
    }
    cursor = options.end;
  }
  return { kind: "table", variable: "x", variables: [], funcs: {}, points };
}

function parseDatavisualizationTableData(body) {
  const rows = String(body || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (rows.length < 2) return { kind: "table", points: [] };
  const headers = datavisualizationTableCells(rows[0]).map((cell) => cell.trim());
  const xIndex = headers.findIndex((header) => header === "x");
  const yIndex = headers.findIndex((header) => header === "y");
  const setIndex = headers.findIndex((header) => header === "set");
  const rectangleIndexes = datavisualizationRectangleHeaderIndexes(headers);
  const candleAttribute = datavisualizationCandlestickAttribute(headers);
  const candleIndexes = candleAttribute ? datavisualizationCandlestickHeaderIndexes(headers, candleAttribute) : null;
  const dayIndex = headers.findIndex((header) => header === "day");
  const canReadPoint = xIndex >= 0 && yIndex >= 0;
  const fallbackPointIndexes = datavisualizationFallbackTablePointIndexes(headers, { setIndex });
  const canReadFallbackPoint = !canReadPoint && fallbackPointIndexes.length >= 2;
  const canReadRectangle = Object.values(rectangleIndexes).every((index) => index >= 0);
  const potentialRectangleAttributes = datavisualizationSubattributeRectangleAttributes(headers);
  const canReadPotentialRectangle = potentialRectangleAttributes.length >= 2;
  const canReadCandlestick = Boolean(candleIndexes && Object.values(candleIndexes).every((index) => index >= 0) && dayIndex >= 0);
  if (!canReadPoint && !canReadFallbackPoint && !canReadRectangle && !canReadPotentialRectangle && !canReadCandlestick) return { kind: "table", points: [] };
  const points = [];
  for (const [rowOffset, row] of rows.slice(1).entries()) {
    const cells = datavisualizationTableCells(row);
    const variables = Object.fromEntries(headers.map((header, index) => [header, cells[index]]));
    const numericVariables = Object.fromEntries(headers.map((header, index) => [header, axisNumber(cells[index], NaN)]));
    let rectangle = null;
    if (canReadRectangle) {
      rectangle = {
        xMin: numericVariables[headers[rectangleIndexes.xMin]],
        xMax: numericVariables[headers[rectangleIndexes.xMax]],
        yMin: numericVariables[headers[rectangleIndexes.yMin]],
        yMax: numericVariables[headers[rectangleIndexes.yMax]]
      };
      if (!Object.values(rectangle).every(Number.isFinite)) rectangle = null;
    }
    const potentialRectangle = rectangle || datavisualizationPotentialRectangleFromAttributes(numericVariables, potentialRectangleAttributes);
    let candle = null;
    if (canReadCandlestick) {
      candle = {
        attribute: candleAttribute,
        low: numericVariables[headers[candleIndexes.low]],
        high: numericVariables[headers[candleIndexes.high]],
        entry: numericVariables[headers[candleIndexes.entry]],
        exit: numericVariables[headers[candleIndexes.exit]]
      };
      if (!Object.values(candle).filter((value) => typeof value === "number").every(Number.isFinite)) candle = null;
    }
    const x = canReadPoint
      ? axisNumber(cells[xIndex], NaN)
      : canReadFallbackPoint
        ? numericVariables[headers[fallbackPointIndexes[0]]]
      : candle
        ? (Number.isFinite(numericVariables.day) ? numericVariables.day : rowOffset + 1)
        : potentialRectangle
          ? (potentialRectangle.xMin + potentialRectangle.xMax) / 2
          : NaN;
    const y = canReadPoint
      ? axisNumber(cells[yIndex], NaN)
      : canReadFallbackPoint
        ? numericVariables[headers[fallbackPointIndexes[1]]]
      : candle
        ? candle.exit
        : potentialRectangle
          ? (potentialRectangle.yMin + potentialRectangle.yMax) / 2
          : NaN;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    points.push({
      x,
      y,
      ...numericVariables,
      rectangle,
      candle,
      set: setIndex >= 0 ? String(cells[setIndex] || "").trim() : "",
      variables,
      attributes: numericVariables
    });
  }
  return { kind: "table", variable: "x", variables: [], funcs: {}, points };
}

function datavisualizationFallbackTablePointIndexes(headers = [], context = {}) {
  return headers
    .map((header, index) => ({ header, index }))
    .filter(({ header, index }) => {
      if (index === context.setIndex) return false;
      const text = String(header || "").trim();
      if (!text || text.includes("/")) return false;
      return true;
    })
    .map(({ index }) => index);
}

function datavisualizationRectangleHeaderIndexes(headers = []) {
  const indexOf = (name) => headers.findIndex((header) => header === name);
  return {
    xMin: indexOf("x/min"),
    xMax: indexOf("x/max"),
    yMin: indexOf("y/min"),
    yMax: indexOf("y/max")
  };
}

function datavisualizationCandlestickAttribute(headers = []) {
  const hasHeader = new Set(headers);
  for (const header of headers) {
    const match = String(header || "").match(/^(.+)\/low$/);
    if (!match) continue;
    const name = match[1];
    if (hasHeader.has(`${name}/high`) && hasHeader.has(`${name}/entry`) && hasHeader.has(`${name}/exit`)) return name;
  }
  return "";
}

function datavisualizationCandlestickHeaderIndexes(headers = [], attribute = "") {
  const indexOf = (suffix) => headers.findIndex((header) => header === `${attribute}/${suffix}`);
  return {
    low: indexOf("low"),
    high: indexOf("high"),
    entry: indexOf("entry"),
    exit: indexOf("exit")
  };
}

function datavisualizationSubattributeRectangleAttributes(headers = []) {
  const names = [];
  const hasHeader = new Set(headers);
  for (const header of headers) {
    const match = String(header || "").match(/^(.+)\/min$/);
    if (!match) continue;
    const name = match[1];
    if (hasHeader.has(`${name}/max`)) names.push(name);
  }
  return names;
}

function datavisualizationPotentialRectangleFromAttributes(numericVariables = {}, attributes = []) {
  const [attribute1, attribute2] = attributes;
  if (!attribute1 || !attribute2) return null;
  const rectangle = {
    xMin: numericVariables[`${attribute1}/min`],
    xMax: numericVariables[`${attribute1}/max`],
    yMin: numericVariables[`${attribute2}/min`],
    yMax: numericVariables[`${attribute2}/max`]
  };
  return Object.values(rectangle).every(Number.isFinite) ? rectangle : null;
}

function datavisualizationTableCells(row) {
  const text = String(row || "").trim();
  const cells = text.includes(",") ? splitTopLevel(text, ",") : text.split(/\s+/);
  return cells.map((cell) => cell.trim()).filter((cell) => cell.length);
}

function parseDatavisualizationFunctionData(body) {
  const text = String(body || "");
  const variables = [];
  const funcs = {};
  const funcList = [];

  for (const rawStatement of splitTopLevel(text, ";")) {
    const statement = rawStatement.trim();
    if (!statement) continue;

    const funcMatch = statement.match(/^func\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]+)$/);
    if (funcMatch) {
      funcs[funcMatch[1]] = funcMatch[2].trim();
      funcList.push({ name: funcMatch[1], expression: funcMatch[2].trim() });
      continue;
    }

    const intervalMatch = statement.match(
      /^var\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*interval\s*\[\s*([^:\]]+)\s*:\s*([^\]]+)\]\s*(?:(samples|step)\s+([\s\S]+))?$/
    );
    if (intervalMatch) {
      variables.push({
        name: intervalMatch[1],
        kind: "interval",
        start: axisNumber(intervalMatch[2], 0),
        end: axisNumber(intervalMatch[3], 1),
        mode: intervalMatch[4] || "samples",
        amount: intervalMatch[5] || 25
      });
      continue;
    }

    const groupMatch = statement.match(/^var\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\{([\s\S]*)\}$/);
    if (groupMatch) {
      variables.push({
        name: groupMatch[1],
        kind: "group",
        values: datavisualizationGroupValues(groupMatch[2])
      });
    }
  }

  if (!variables.length) {
    variables.push({
      name: "x",
      kind: "interval",
      start: -1,
      end: 1,
      mode: "samples",
      amount: 25
    });
  }

  return {
    variable: variables[0]?.name || "x",
    variables: variables.map((variable) => ({
      ...variable,
      values: datavisualizationVariableValues(variable)
    })),
    funcs,
    funcList
  };
}

function datavisualizationGroupValues(rawValues) {
  return datavisualizationNamedValues(rawValues)
    .map((value) => axisNumber(value, NaN))
    .filter(Number.isFinite);
}

function datavisualizationVariableValues(variable) {
  if (variable.kind === "group") return variable.values?.length ? variable.values : [0];
  const start = Number.isFinite(variable.start) ? variable.start : 0;
  const end = Number.isFinite(variable.end) ? variable.end : 1;
  if (variable.mode === "step") {
    const rawStep = axisNumber(variable.amount, NaN);
    const direction = end >= start ? 1 : -1;
    const step = Math.abs(Number.isFinite(rawStep) && rawStep !== 0 ? rawStep : (end - start) / 24) * direction;
    const values = [];
    const epsilon = Math.abs(step) * 1e-7 + 1e-9;
    for (let value = start, guard = 0; direction > 0 ? value <= end + epsilon : value >= end - epsilon; value += step, guard += 1) {
      values.push(roundAxis(value));
      if (guard >= 1200) break;
    }
    if (!values.length || Math.abs(values[values.length - 1] - end) > epsilon) values.push(roundAxis(end));
    return values;
  }

  const samples = axisSamples(variable.amount || 25, 1200);
  return Array.from({ length: samples }, (_unused, index) => {
    const t = samples === 1 ? 0 : index / (samples - 1);
    return roundAxis(start + (end - start) * t);
  });
}

function sampleDatavisualizationFunctionData(data, random = createDatavisualizationRandom(texDefaultRandomSeed())) {
  if (data.kind === "table") return data.points || [];
  const points = [];
  const variables = data.variables?.length ? data.variables : [{ name: data.variable || "x", values: [0] }];
  const walk = (index, values) => {
    if (index >= variables.length) {
      const firstVariable = variables[0]?.name || data.variable || "x";
      const dataPoint = { ...values };
      for (const func of data.funcList || []) {
        dataPoint[func.name] = evaluateDatavisualizationExpression(func.expression, dataPoint, random);
      }
      const x = dataPoint.x ?? values[firstVariable] ?? 0;
      const y = dataPoint.y ?? 0;
      if (Number.isFinite(x) && Number.isFinite(y)) points.push({ ...dataPoint, x, y, attributes: { ...dataPoint }, variables: { ...values } });
      return;
    }
    const variable = variables[index];
    for (const value of variable.values || [0]) {
      walk(index + 1, { ...values, [variable.name]: value });
    }
  };
  walk(0, {});
  return points;
}

function datavisualizationPinFromOptions(options, data, points = [], context = {}) {
  const pin = parseOptions(options["pin in data"] || "");
  const textOption = pin.text !== undefined ? pin.text : pin["text'"];
  const text = datavisualizationTextFromOption(textOption !== undefined ? `text={${textOption}}` : "");
  if (!text) return null;
  const pinLength = pin["pin length"] || pin["pin distance"] || "";
  const pinAngle = datavisualizationAxisNumericOption(pin["pin angle"]);
  const swap = pin["text'"] !== undefined;
  const selection = datavisualizationLabelPointFromOptions(pin, data, points, context);
  if (selection) {
    const label = datavisualizationPinNormalLabel(points, selection.index);
    const edge = selection.edge || selection;
    return {
      text,
      x: selection.point.x,
      y: selection.point.y,
      labelX: label.x,
      labelY: label.y,
      edgeStart: edge.point,
      edgeExact: Boolean(selection.edgeExact),
      previous: points[Math.max(0, selection.index - 1)] || selection.point,
      next: points[Math.min(points.length - 1, selection.index + 1)] || selection.point,
      pinLength,
      pinAngle,
      swap,
      textColored: datavisualizationDataSetLabelTextColored(context.globalOptions, context.globalOptionsRaw, pin)
    };
  }
  const xFallback = datavisualizationLabelXFallback(pin);
  if (!xFallback) return null;
  const targetX = xFallback.target;
  const variables = { [data.variable || "x"]: targetX, x: targetX };
  const y = data.funcs.y ? evaluateDatavisualizationExpression(data.funcs.y, variables, createDatavisualizationRandom(3001)) : 0;
  if (!Number.isFinite(targetX) || !Number.isFinite(y)) return null;
  return {
    text,
    x: targetX,
    y,
    pinLength,
    pinAngle,
    swap,
    textColored: datavisualizationDataSetLabelTextColored(context.globalOptions, context.globalOptionsRaw, pin)
  };
}

function datavisualizationPinsFromOptions(options, data, points = [], context = {}) {
  const pins = optionValues(options["pin in data"]);
  return pins
    .map((raw) => datavisualizationPinFromOptions({ "pin in data": raw }, data, points, { ...context, repeatedPins: pins.length > 1 }))
    .filter(Boolean);
}

function datavisualizationDataLabelFromOptions(options, data, points = [], context = {}) {
  const raw = options["label in data"];
  if (!raw) return null;
  const label = parseOptions(raw || "");
  const textOption = label.text !== undefined ? label.text : label["text'"];
  const text = datavisualizationTextFromOption(textOption !== undefined ? `text={${textOption}}` : "");
  if (!text) return null;
  const selection = datavisualizationLabelPointFromOptions(label, data, points, context);
  if (selection) {
    return {
      text,
      x: selection.point.x,
      y: selection.point.y,
      previous: points[Math.max(0, selection.index - 1)] || selection.point,
      next: points[Math.min(points.length - 1, selection.index + 1)] || selection.point,
      sloped: datavisualizationLabelNodeStyleHas(label, "sloped"),
      swap: label["text'"] !== undefined,
      textColored: datavisualizationDataSetLabelTextColored(context.globalOptions, context.globalOptionsRaw, label)
    };
  }
  const xFallback = datavisualizationLabelXFallback(label);
  if (!xFallback) return null;
  const targetX = xFallback.target;
  const variables = { [data.variable || "x"]: targetX, x: targetX };
  const y = data.funcs.y ? evaluateDatavisualizationExpression(data.funcs.y, variables, createDatavisualizationRandom(3001)) : 0;
  if (!Number.isFinite(targetX) || !Number.isFinite(y)) return null;
  return {
    text,
    x: targetX,
    y,
    previous: { x: targetX - 1, y },
    next: { x: targetX + 1, y },
    sloped: datavisualizationLabelNodeStyleHas(label, "sloped"),
    swap: label["text'"] !== undefined,
    textColored: datavisualizationDataSetLabelTextColored(context.globalOptions, context.globalOptionsRaw, label)
  };
}

function datavisualizationDataLabelsFromOptions(options, data, points = [], context = {}) {
  return optionValues(options["label in data"])
    .map((raw) => datavisualizationDataLabelFromOptions({ "label in data": raw }, data, points, context))
    .filter(Boolean);
}

function datavisualizationPlotDataLabels(plot = {}) {
  if (Array.isArray(plot.dataLabels)) return plot.dataLabels.filter(Boolean);
  return plot.dataLabel ? [plot.dataLabel] : [];
}

function datavisualizationPlotPins(plot = {}) {
  if (Array.isArray(plot.pins)) return plot.pins.filter(Boolean);
  return plot.pin ? [plot.pin] : [];
}

function renderDatavisualizationPin(pin, axisOptions = {}, plotStyle = {}, plot = {}) {
  const pinLabel = datavisualizationPinLabelPoint(pin, axisOptions);
  const pinText = datavisualizationPinTextPoint(pin, pinLabel, axisOptions);
  const pinStart = datavisualizationPinEdgeStart(pin);
  const pinOptions = datavisualizationOverlayNodeOptions(["axis label"], pin, plotStyle, plot);
  return [
    `\\draw[axis pin edge, black, line width=0.25pt] (axis cs:${roundTikzNumber(pinStart.x)},${roundTikzNumber(pinStart.y)}) -- (axis cs:${roundTikzNumber(pinLabel.x)},${roundTikzNumber(pinLabel.y)});`,
    `\\node[${pinOptions.join(",")}] at (axis cs:${roundTikzNumber(pinText.x)},${roundTikzNumber(pinText.y)}) {${protectDatavisualizationOverlayText(pin.text)}};`
  ];
}

function renderDatavisualizationDataLabel(label, axisOptions = {}, plotStyle = {}, plot = {}) {
  const point = datavisualizationDataLabelTextPoint(label, axisOptions);
  const options = datavisualizationOverlayNodeOptions(["axis label", `font=${datavisualizationRoleFont("dataSetLabel")}`], label, plotStyle, plot);
  const rotation = datavisualizationDataLabelRotation(label, axisOptions);
  if (Number.isFinite(rotation)) options.push(`rotate=${roundTikzNumber(rotation)}`);
  return `\\node[${options.join(",")}] at (axis cs:${roundTikzNumber(point.x)},${roundTikzNumber(point.y)}) {${protectDatavisualizationOverlayText(label.text)}};`;
}

function datavisualizationDataSetLabelTextColored(globalOptions = {}, globalOptionsRaw = "", localOptions = {}) {
  const globalStyle = [
    globalOptions["every data set label"],
    globalOptions["every data set label/.style"],
    globalOptions["every data set label/.append style"],
    globalOptions["every label in data"],
    globalOptions["every label in data/.style"],
    globalOptions["every label in data/.append style"]
  ]
    .filter((value) => value !== undefined && value !== null && value !== false)
    .map((value) => String(value === true ? "" : value).toLowerCase())
    .join(",");
  const rawText = String(globalOptionsRaw || "").toLowerCase();
  const localStyle = [
    localOptions["text colored"] ? "text colored" : "",
    localOptions["node style"],
    localOptions["node style/.style"],
    localOptions.style
  ]
    .filter((value) => value !== undefined && value !== null && value !== false)
    .map((value) => String(value === true ? "" : value).toLowerCase())
    .join(",");
  return (
    globalStyle.includes("text colored") ||
    localStyle.includes("text colored") ||
    localStyle.includes("text=visualizer color") ||
    /every\s+(?:data\s+set\s+label|label\s+in\s+data)\s*\/\s*\.append\s+style\s*=\s*\{?[^,\]}]*text\s+colored/.test(rawText)
  );
}

function datavisualizationLabelPointFromOptions(labelOptions = {}, _data = {}, points = [], context = {}) {
  if (!points.length) return null;
  const whenSelection = datavisualizationLabelWhenSelection(labelOptions, points, context);
  if (whenSelection) return whenSelection;

  const indexValue = datavisualizationAxisNumericOption(labelOptions.index);
  if (Number.isFinite(indexValue)) return datavisualizationLabelCountSelection(points, indexValue);

  const posValue = datavisualizationAxisNumericOption(labelOptions.pos);
  if (Number.isFinite(posValue)) {
    const maxCount = points.length;
    return datavisualizationLabelCountSelection(points, posValue * maxCount);
  }

  const order = Number(context.visualizerOrder);
  const total = Number(context.visualizerCount);
  if (Number.isFinite(order) && Number.isFinite(total) && total > 0) {
    const maxCount = points.length;
    return datavisualizationLabelCountSelection(points, ((order - 0.5) / total) * maxCount);
  }

  return null;
}

function datavisualizationLabelWhenSelection(labelOptions = {}, points = [], context = {}) {
  const fallback = datavisualizationLabelXFallback(labelOptions);
  const when = String(labelOptions.when || "");
  const match = when.match(/^\s*([A-Za-z_][A-Za-z0-9_/-]*)\s+is\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/);
  if (!match) return null;
  const attribute = match[1].trim();
  const target = axisNumber(match[2], NaN);
  if (!Number.isFinite(target)) return null;
  const nearest = datavisualizationNearestPointByAttribute(points, attribute, target);
  if (!nearest) return null;
  const nearestValue = datavisualizationPointAttribute(nearest.point, attribute);
  if (context.repeatedPins && Number.isFinite(nearestValue) && Math.abs(nearestValue - target) < 1e-9) {
    return { ...nearest, edge: nearest, edgeExact: true, target, attribute, fallback };
  }
  const edge = datavisualizationPinEdgePoint(points, target, attribute) || nearest;
  return { ...nearest, edge, target, attribute, fallback };
}

function datavisualizationLabelXFallback(labelOptions = {}) {
  const when = String(labelOptions.when || "");
  const match = when.match(/^\s*x\s+is\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/);
  if (!match) return null;
  const target = axisNumber(match[1], NaN);
  return Number.isFinite(target) ? { target } : null;
}

function datavisualizationLabelCountSelection(points = [], threshold) {
  if (!points.length || !Number.isFinite(threshold)) return null;
  const rawIndex = Math.ceil(threshold) - 1;
  const index = Math.max(0, Math.min(points.length - 1, rawIndex));
  return { point: points[index], index };
}

function datavisualizationPointAttribute(point = {}, attribute = "") {
  const key = String(attribute || "").trim();
  if (!key) return NaN;
  const value =
    point?.attributes?.[key] ??
    point?.variables?.[key] ??
    (key.includes("/") ? undefined : point?.[key]);
  const numeric = typeof value === "number" ? value : axisNumber(value, NaN);
  return Number.isFinite(numeric) ? numeric : NaN;
}

function datavisualizationOverlayNodeOptions(baseOptions = [], overlay = {}, plotStyle = {}, plot = {}) {
  const options = [...baseOptions];
  if (overlay?.textColored) {
    const color = datavisualizationVisualizerTextColor(plotStyle, plot);
    if (color) options.push(`text=${color}`);
  }
  return options;
}

function datavisualizationVisualizerTextColor(style = {}, plot = {}) {
  const styleOptions = plot.styleOptions || {};
  return String(
    style.text ||
      styleOptions.text ||
      style.color ||
      styleOptions.color ||
      style.draw ||
      styleOptions.draw ||
      style.stroke ||
      styleOptions.stroke ||
      datavisualizationPlotColor(plot.styleIndex || 0, plot) ||
      "black"
  ).trim();
}

function datavisualizationDataLabelTextPoint(label, axisOptions = {}) {
  if (!label || !Number.isFinite(label.x) || !Number.isFinite(label.y)) return { x: 0, y: 0 };
  const xMin = Number(axisOptions.xmin);
  const xMax = Number(axisOptions.xmax);
  const yMin = Number(axisOptions.ymin);
  const yMax = Number(axisOptions.ymax);
  const width = parseDimension(String(axisOptions.width || "5cm"), {});
  const height = parseDimension(String(axisOptions.height || "3.09cm"), {});
  if (![xMin, xMax, yMin, yMax, width, height].every(Number.isFinite) || xMax === xMin || yMax === yMin) {
    return { x: label.x, y: label.y };
  }

  const xScale = width / (xMax - xMin);
  const yScale = height / (yMax - yMin);
  const previous = label.previous || { x: label.x - 1, y: label.y };
  const next = label.next || { x: label.x + 1, y: label.y };
  const tangentX = (next.x - previous.x) * xScale || 1;
  const tangentY = (next.y - previous.y) * yScale || 0;
  const tangentLength = Math.hypot(tangentX, tangentY) || 1;
  let normalX = -tangentY / tangentLength;
  let normalY = tangentX / tangentLength;
  if (normalY < 0) {
    normalX = -normalX;
    normalY = -normalY;
  }
  if (label.swap) {
    normalX = -normalX;
    normalY = -normalY;
  }

  const autoOffset = parseDimension("0.14cm", {});
  const distance = Number.isFinite(autoOffset) ? autoOffset : 0.32;
  const autoAnchorXShift = parseDimension("0.35em", {});
  const anchorXShift = Number.isFinite(autoAnchorXShift) ? autoAnchorXShift : 0;
  return {
    x: label.x + (normalX * distance - anchorXShift) / xScale,
    y: label.y + (normalY * distance) / yScale
  };
}

function datavisualizationLabelNodeStyleHas(labelOptions = {}, key = "") {
  const styles = [labelOptions["node style"], labelOptions["node style/.style"], labelOptions.style]
    .filter((value) => value !== undefined && value !== null && value !== false)
    .map((value) => String(value === true ? "" : value).toLowerCase());
  const needle = String(key || "").trim().toLowerCase();
  return Boolean(needle) && styles.some((style) => new RegExp(`(^|[,\\s])${escapeRegExp(needle)}($|[,\\s])`).test(style));
}

function datavisualizationDataLabelRotation(label, axisOptions = {}) {
  if (!label?.sloped) return NaN;
  const xMin = Number(axisOptions.xmin);
  const xMax = Number(axisOptions.xmax);
  const yMin = Number(axisOptions.ymin);
  const yMax = Number(axisOptions.ymax);
  const width = parseDimension(String(axisOptions.width || "5cm"), {});
  const height = parseDimension(String(axisOptions.height || "3.09cm"), {});
  if (![xMin, xMax, yMin, yMax, width, height].every(Number.isFinite) || xMax === xMin || yMax === yMin) return NaN;
  const previous = label.previous || { x: label.x - 1, y: label.y };
  const next = label.next || { x: label.x + 1, y: label.y };
  const tangentX = (next.x - previous.x) * (width / (xMax - xMin)) || 1;
  const tangentY = (next.y - previous.y) * (height / (yMax - yMin)) || 0;
  let angle = (Math.atan2(tangentY, tangentX) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return angle;
}

function datavisualizationPinEdgePoint(points, targetValue, attribute = "x") {
  if (!Number.isFinite(targetValue) || !points.length) return null;
  if (points.length === 1) return { point: points[0], index: 0 };
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const previousValue = datavisualizationPointAttribute(previous, attribute);
    const currentValue = datavisualizationPointAttribute(current, attribute);
    if (!Number.isFinite(previousValue) || !Number.isFinite(currentValue)) continue;
    if (previousValue <= targetValue && currentValue > targetValue) return { point: current, index };
    if (previousValue >= targetValue && currentValue < targetValue) return { point: current, index };
  }
  return null;
}

function datavisualizationNearestPoint(points, targetX) {
  return datavisualizationNearestPointByAttribute(points, "x", targetX);
}

function datavisualizationNearestPointByAttribute(points, attribute, targetValue) {
  if (!Number.isFinite(targetValue) || !points.length) return null;
  let bestIndex = -1;
  let bestDistance = Infinity;
  points.forEach((point, index) => {
    const value = datavisualizationPointAttribute(point, attribute);
    if (!Number.isFinite(value)) return;
    const distance = Math.abs(value - targetValue);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex >= 0 ? { point: points[bestIndex], index: bestIndex } : null;
}

function datavisualizationPinNormalLabel(points, index) {
  const point = points[index];
  const previous = points[Math.max(0, index - 1)] || point;
  const next = points[Math.min(points.length - 1, index + 1)] || point;
  const tangentX = next.x - previous.x || 1;
  const tangentY = next.y - previous.y || 0;
  const length = Math.hypot(tangentX, tangentY) || 1;
  const normalX = -tangentY / length;
  const normalY = Math.abs(tangentX / length);
  return {
    x: point.x + normalX * 0.42,
    y: point.y + Math.max(0.12, normalY * 0.18)
  };
}

function datavisualizationTextFromOption(raw) {
  if (!raw) return "";
  const parsed = parseOptions(raw);
  const text = parsed.text ?? raw;
  return String(text || "").replace(/\s+/g, " ").trim();
}

function datavisualizationLegendLineMode(globalOptionsRaw = "", ...rawOptions) {
  for (const raw of rawOptions) {
    if (!raw) continue;
    const parsed = parseOptions(raw);
    if (parsed["straight label in legend line"]) return "straight";
    if (parsed["zig zag label in legend line"]) return "zigzag";
  }
  const globalText = String(globalOptionsRaw || "").toLowerCase();
  if (
    /default\s+label\s+in\s+legend\s+path\/\.style\s*=\s*straight\s+label\s+in\s+legend\s+line/.test(globalText) ||
    /default\s+label\s+in\s+legend\s+path\s*=\s*straight\s+label\s+in\s+legend\s+line/.test(globalText)
  ) {
    return "straight";
  }
  if (
    /default\s+label\s+in\s+legend\s+path\/\.style\s*=\s*zig\s+zag\s+label\s+in\s+legend\s+line/.test(globalText) ||
    /default\s+label\s+in\s+legend\s+path\s*=\s*zig\s+zag\s+label\s+in\s+legend\s+line/.test(globalText)
  ) {
    return "zigzag";
  }
  return "";
}

function datavisualizationLegendMarkCount(globalOptionsRaw = "", ...rawOptions) {
  for (const raw of rawOptions) {
    const text = String(raw || "").toLowerCase();
    if (text.includes("label in legend three marks")) return 3;
    if (text.includes("label in legend one mark")) return 1;
  }
  const globalText = String(globalOptionsRaw || "").toLowerCase();
  if (/default\s+label\s+in\s+legend\s+mark\/\.style\s*=\s*label\s+in\s+legend\s+three\s+marks/.test(globalText)) return 3;
  return 1;
}

function datavisualizationLegendMarkCoordinates(...rawOptions) {
  for (const raw of rawOptions) {
    if (!raw) continue;
    const parsed = parseOptions(raw);
    const coordinates = parsed["label in legend mark coordinates"];
    if (coordinates === undefined || coordinates === null || coordinates === true) continue;
    const parsedCoordinates = datavisualizationLegendCoordinateList(coordinates);
    if (parsedCoordinates.length) return parsedCoordinates;
  }
  return [];
}

function datavisualizationLegendLineCoordinates(...rawOptions) {
  for (const raw of rawOptions) {
    if (!raw) continue;
    const parsed = parseOptions(raw);
    const coordinates = parsed["label in legend line coordinates"];
    if (coordinates === undefined || coordinates === null || coordinates === true) continue;
    const parsedCoordinates = datavisualizationLegendCoordinateList(coordinates);
    if (parsedCoordinates.length >= 2) return parsedCoordinates;
  }
  return [];
}

function datavisualizationLegendRectangleCoordinates(...rawOptions) {
  for (const raw of rawOptions) {
    if (!raw) continue;
    const parsed = parseOptions(raw);
    const coordinates = parsed["label in legend rectangle coordinates"];
    if (coordinates === undefined || coordinates === null || coordinates === true) continue;
    const parsedCoordinates = datavisualizationLegendCoordinateList(coordinates);
    if (parsedCoordinates.length >= 4) return parsedCoordinates;
  }
  return datavisualizationLegendCoordinateList("(-1ex,-.5ex),(-1ex,0.968ex),(0ex,0.968ex),(0ex,-.5ex)");
}

function datavisualizationLegendCoordinateList(rawCoordinates) {
  const text = String(rawCoordinates || "").trim().replace(/^\{([\s\S]*)\}$/, "$1");
  const coordinates = [];
  const pattern = /\(([^()]*)\)/g;
  let match = null;
  while ((match = pattern.exec(text))) {
    const parts = splitTopLevel(match[1], ",").map((part) => part.trim());
    if (parts.length < 2) continue;
    const x = datavisualizationLegendCoordinateDimension(parts[0]);
    const y = datavisualizationLegendCoordinateDimension(parts[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) coordinates.push({ x, y });
  }
  return coordinates;
}

function datavisualizationLegendCoordinateDimension(rawValue) {
  const text = String(rawValue || "").trim();
  if (!text) return NaN;
  const value = parseDimension(text, {});
  if (Number.isFinite(value)) return value;
  return axisNumber(text, NaN);
}

function datavisualizationLegendTextOnly(rawPosition) {
  const options = parseOptions(rawPosition || "");
  const labelStyle = String(options["label style"] || "").toLowerCase();
  return Boolean(options["text only"] || labelStyle.includes("text only"));
}

function datavisualizationLegendTextLeft(rawPosition) {
  const options = parseOptions(rawPosition || "");
  const labelStyle = String(options["label style"] || "").toLowerCase();
  return Boolean(options["text left"] || labelStyle.includes("text left") || datavisualizationWestOutsideLegendKey(options, String(rawPosition || "")));
}

function datavisualizationLegendTextColored(rawPosition) {
  const options = parseOptions(rawPosition || "");
  const labelStyle = String(options["label style"] || "").toLowerCase();
  return Boolean(options["text colored"] || labelStyle.includes("text colored") || datavisualizationLegendTextOnly(rawPosition));
}

function datavisualizationLegendIsInside(rawPosition) {
  const options = parseOptions(rawPosition || "");
  return Boolean(datavisualizationInsideLegendKey(options, rawPosition) || datavisualizationLegendDataPlacementOption(options));
}

function evaluateDatavisualizationExpression(expression, variables, random) {
  let text = String(expression || "")
    .replace(/\\value\s*\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}/g, "$1 ")
    .replace(/\\value\s+([A-Za-z_][A-Za-z0-9_]*)/g, "$1")
    .replace(/\brandom\s*\(\s*([^)]+)\s*\)/g, (_match, max) => `(${random.integer(axisNumber(max, 1))})`)
    .replace(/\brnd\b/g, () => `(${roundTikzNumber(random.rnd())})`)
    .replace(/\brand\b/g, () => `(${roundTikzNumber(random.rand())})`);
  const radianSuffix = /(?:\b[A-Za-z_][A-Za-z0-9_]*\s+r\b|\([^()]*\)\s*r\b|[0-9.]+\s*r\b)/;
  const radianTrig = radianSuffix.test(text);
  text = text
    .replace(/(\b[A-Za-z_][A-Za-z0-9_]*)\s+r\b/g, "$1")
    .replace(/(\([^()]*\)|[0-9.]+)\s*r\b/g, "$1");
  const normalized = normalizeAxisExpression(text, radianTrig);
  if (!normalized || !/^[0-9+\-*/%().,\sA-Za-z_<>=!?:&|]+$/.test(normalized)) return NaN;
  const names = Object.keys(variables || {});
  const values = names.map((name) => variables[name]);
  try {
    const value = Function(...names, `"use strict"; ${pgfMathRuntimePrelude()} return (${normalized});`)(...values);
    return Number.isFinite(value) ? value : NaN;
  } catch {
    return NaN;
  }
}

function createDatavisualizationRandom(seed) {
  const modulus = 2147483647;
  const multiplier = 69621;
  const quotient = 30845;
  const remainder = 23902;
  let state = Math.max(1, Math.abs(Math.trunc(seed)) % modulus);
  const nextInt = () => {
    const low = state % quotient;
    const high = Math.floor(state / quotient);
    let next = multiplier * low - remainder * high;
    if (next < 0) next += modulus;
    state = next;
    return state;
  };
  const api = () => api.rand();
  api.rnd = () => (nextInt() % 100001) / 100000;
  api.rand = () => ((nextInt() % 200001) - 100000) / 100000;
  api.integer = (max) => {
    const upper = Math.max(1, Math.floor(max));
    return 1 + (nextInt() % upper);
  };
  return api;
}

function datavisualizationCoordinate(point) {
  return `(${roundTikzNumber(point.x)},${roundTikzNumber(point.y)})`;
}

function renderDatavisualizationRectangles(plot, plotIndex = 0) {
  const style = formatDatavisualizationOptions({
    "axis rectangle": true,
    draw: true,
    semithick: true,
    ...datavisualizationPlotStyle(plotIndex, plot)
  });
  const commands = [];
  for (const point of plot.points || []) {
    if (!point.rectangle) continue;
    const { xMin, xMax, yMin, yMax } = point.rectangle;
    if (![xMin, xMax, yMin, yMax].every(Number.isFinite)) continue;
    commands.push(
      `\\path[${style}] (axis cs:${roundTikzNumber(xMin)},${roundTikzNumber(yMin)}) rectangle (axis cs:${roundTikzNumber(xMax)},${roundTikzNumber(yMax)});`
    );
  }
  return commands;
}

function renderDatavisualizationCandlesticks(plot, plotIndex = 0) {
  const commands = [];
  const halfWidth = datavisualizationCandlestickHalfWidth(plot);
  const wickStyle = formatDatavisualizationOptions({
    "axis candlestick wick": true,
    black: true,
    "line width": "0.4pt"
  });
  const baseBodyStyle = {
    "axis candlestick body": true,
    draw: "black",
    "line width": "0.4pt"
  };
  for (const point of plot.points || []) {
    const candle = point.candle;
    if (!candle) continue;
    const { low, high, entry, exit } = candle;
    const x = Number(point.x);
    if (![x, low, high, entry, exit].every(Number.isFinite)) continue;
    const lowerBody = Math.min(entry, exit);
    const upperBody = Math.max(entry, exit);
    const fill = entry < exit ? "white" : "black";
    const left = x - halfWidth;
    const right = x + halfWidth;
    commands.push(
      `\\draw[${wickStyle}] (axis cs:${roundTikzNumber(x)},${roundTikzNumber(low)}) -- (axis cs:${roundTikzNumber(
        x
      )},${roundTikzNumber(lowerBody)}) (axis cs:${roundTikzNumber(x)},${roundTikzNumber(high)}) -- (axis cs:${roundTikzNumber(
        x
      )},${roundTikzNumber(upperBody)});`
    );
    commands.push(
      `\\path[${formatDatavisualizationOptions({ ...baseBodyStyle, fill })}] (axis cs:${roundTikzNumber(left)},${roundTikzNumber(
        lowerBody
      )}) rectangle (axis cs:${roundTikzNumber(right)},${roundTikzNumber(upperBody)});`
    );
  }
  return commands;
}

function datavisualizationCandlestickHalfWidth(plot = {}) {
  return datavisualizationCandlestickPointHalfWidth(null, plot.points || []);
}

function datavisualizationCandlestickPointHalfWidth(_point, points = []) {
  const xs = (points || [])
    .map((point) => Number(point.x))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  let minDelta = Infinity;
  for (let index = 1; index < xs.length; index += 1) {
    const delta = xs[index] - xs[index - 1];
    if (delta > 1e-9) minDelta = Math.min(minDelta, delta);
  }
  if (!Number.isFinite(minDelta)) return 0.235;
  return Math.max(0.03, Math.min(0.235, minDelta * 0.235));
}

function datavisualizationPlotStyle(index, plot = {}) {
  const style = { color: datavisualizationPlotColor(index, plot) };
  if (plot.varyThicknessAndDashing) {
    Object.assign(style, datavisualizationVaryThicknessAndDashingStyle(index));
  }
  if (plot.varyThickness) style["line width"] = `${roundTikzNumber(0.3 + (index + 1) * 0.2)}pt`;
  if (plot.varyDashing) {
    const dashIndex = index % 7;
    if (dashIndex === 1) style["dash pattern"] = "on 4pt off 1.6pt";
    if (dashIndex === 2) style["dash pattern"] = "on 1.2pt off 1.2pt";
    if (dashIndex === 3) style["dash pattern"] = "on 4pt off 1.2pt on 1.2pt off 1.2pt";
    if (dashIndex === 4) style["dash pattern"] = "on 8pt off 2.4pt";
    if (dashIndex === 5) style["dash pattern"] = "on 8pt off 1.6pt on 1.6pt off 1.6pt";
    if (dashIndex === 6) style["dash pattern"] = "on 6.4pt off 1.6pt on 1.2pt off 1.2pt on 1.2pt off 1.2pt on 1.2pt off 1.2pt";
  }
  return { ...style, ...(plot.styleOptions || {}) };
}

function datavisualizationVaryThicknessAndDashingStyle(index) {
  const nativeIndex = Math.max(1, Number(index) + 1);
  const style = {};
  const oddThin = nativeIndex % 2 === 1;
  const lineWidthPt = nativeIndex <= 14 && oddThin ? 0.4 : nativeIndex <= 14 ? 0.8 : 0.4;
  style["line width"] = `${roundTikzNumber(lineWidthPt)}pt`;
  if (nativeIndex > 14) return style;

  const dashGroup = Math.floor((nativeIndex - 1) / 2);
  const patternMultipliers = [
    null,
    [5, 2],
    [1.5, 1.5],
    [5, 1.5, 1.5, 1.5],
    [10, 3],
    [10, 2, 2, 2],
    [8, 2, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5]
  ][dashGroup];
  if (!patternMultipliers) return style;
  style["dash pattern"] = datavisualizationDashPatternFromMultipliers(patternMultipliers, lineWidthPt);
  return style;
}

function datavisualizationCrossMarkStyle(index) {
  const nativeIndex = (Math.max(0, Number(index) || 0) % 6) + 1;
  const styles = {
    1: { mark: "x", markSize: "2pt" },
    2: { mark: "+", markSize: "2pt" },
    3: { mark: "Mercedes star", markSize: "2pt" },
    4: { mark: "Mercedes star flipped", markSize: "2pt" },
    5: { mark: "star", markSize: "2pt" },
    6: { mark: "10-pointed star", markSize: "1.8pt" }
  };
  return styles[nativeIndex] || styles[1];
}

function datavisualizationCircleMarkStyle(styleSheets) {
  if (!styleSheets || typeof styleSheets.has !== "function") return null;
  if (styleSheets.has("* mark")) return { mark: "*", markSize: "1.4pt" };
  if (styleSheets.has("dot mark")) return { mark: "*", markSize: "0.6pt" };
  if (styleSheets.has("o mark")) return { mark: "o", markSize: "1.4pt", fill: "none" };
  return null;
}

function datavisualizationDashPatternFromMultipliers(multipliers, lineWidthPt) {
  return multipliers
    .map((multiplier, index) => `${index % 2 === 0 ? "on" : "off"} ${roundTikzNumber(multiplier * lineWidthPt)}pt`)
    .join(" ");
}

function datavisualizationPlotColorSeries(plot = {}) {
  if (plot.strongColors) return ["black", "red!80!black", "blue!80!black", "green!60!black", "orange!80!black", "black!60"];
  return ["black"];
}

function datavisualizationPlotColor(index, plot = {}) {
  if (plot.varyHue) return datavisualizationHsbColorSeries(index, DATAVISUALIZATION_VARY_HUE_SERIES);
  if (plot.grayScale) return datavisualizationHsbColorSeries(index, DATAVISUALIZATION_GRAY_SCALE_SERIES);
  if (plot.shadesOfBlue) return datavisualizationHsbColorSeries(index, DATAVISUALIZATION_SHADES_OF_BLUE_SERIES);
  if (plot.shadesOfRed) return datavisualizationHsbColorSeries(index, DATAVISUALIZATION_SHADES_OF_RED_SERIES);
  const colors = datavisualizationPlotColorSeries(plot);
  return colors[index % colors.length] || "black";
}

function datavisualizationHsbColorSeries(index, series) {
  const nativeIndex = Math.max(1, Math.floor(Number(index) || 0) + 1);
  const h = datavisualizationColorSeriesComponent(series.start[0] + nativeIndex * series.step[0], true);
  const s = datavisualizationColorSeriesComponent(series.start[1] + nativeIndex * series.step[1]);
  const b = datavisualizationColorSeriesComponent(series.start[2] + nativeIndex * series.step[2]);
  const [r, g, blue] = datavisualizationHsbToRgb(h, s, b).map((component) => Math.round(component * 255));
  return `rgb(${r} ${g} ${blue})`;
}

function datavisualizationColorSeriesComponent(value, forceWrap = false) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  if (!forceWrap && number >= 0 && number <= 1) return number;
  const wrapped = ((number % 1) + 1) % 1;
  return Math.abs(wrapped - 1) < 1e-9 ? 0 : wrapped;
}

function datavisualizationHsbToRgb(hue, saturation, brightness) {
  const s = Math.max(0, Math.min(1, saturation));
  const v = Math.max(0, Math.min(1, brightness));
  if (s <= 1e-9) return [v, v, v];
  const sector = datavisualizationColorSeriesComponent(hue, true) * 6;
  const index = Math.floor(sector);
  const fraction = sector - index;
  const p = v * (1 - s);
  const q = v * (1 - s * fraction);
  const t = v * (1 - s * (1 - fraction));
  switch (index % 6) {
    case 0:
      return [v, t, p];
    case 1:
      return [q, v, p];
    case 2:
      return [p, v, t];
    case 3:
      return [p, q, v];
    case 4:
      return [t, p, v];
    default:
      return [v, p, q];
  }
}

function formatDatavisualizationOptions(options) {
  return Object.entries(options)
    .filter(([, value]) => value !== undefined && value !== null && value !== false && value !== "")
    .map(([key, value]) => (value === true ? key : `${key}=${value}`))
    .join(",");
}

function renderDatavisualizationLegend(plot, rowIndex = 0, legendCount = 1, context = {}) {
  const baseRow = datavisualizationLineLegendRow(rowIndex, plot, legendCount, context);
  const row = plot.legendTextLeft ? datavisualizationNativeTextLeftScatterLegendRow(baseRow, context) : baseRow;
  const legendPlot = datavisualizationLegendStylePlot(plot);
  const legendScatterStyle = datavisualizationScatterPlotStyle(legendPlot);
  const labelColor = datavisualizationLegendLabelColor(legendScatterStyle, legendPlot);
  if (plot.legendTextOnly) return [datavisualizationLegendLabelCommand(plot, row, labelColor)];
  const exampleStyle = formatDatavisualizationOptions({
    ...legendScatterStyle,
    "axis legend example": true,
    "only marks": false
  });
  const mark = String(legendPlot.mark || "*").trim();
  return [
    ...datavisualizationScatterLegendMarks(row, legendPlot, exampleStyle, mark, context),
    datavisualizationLegendLabelCommand(plot, row, labelColor)
  ];
}

function datavisualizationScatterLegendMarks(row, plot, exampleStyle, mark, context = {}) {
  const count = Math.max(1, Math.min(3, Number(plot.legendMarkCount) || 1));
  const points = plot.legendMarkCoordinates?.length
    ? datavisualizationLegendLocalPoints(row, plot.legendMarkCoordinates, { textLeft: plot.legendTextLeft, origin: "scatter", ...context })
    : count >= 3
      ? datavisualizationThreeLegendMarkPoints(row)
      : [{ x: row.x1, y: row.y }];
  return points.map((point) => {
    if (mark === "x" || mark === "+") return datavisualizationLegendCrossMark(point, exampleStyle, mark);
    if (datavisualizationIsMercedesMark(mark)) return datavisualizationLegendMercedesMark(point, exampleStyle, mark);
    return `\\draw[${exampleStyle}, fill] (axis description cs:${roundTikzNumber(point.x)},${roundTikzNumber(point.y)}) circle (${plot.markSize || "2pt"});`;
  });
}

function datavisualizationLegendLocalPoints(row, coordinates, options = {}) {
  const originX = options.origin === "text"
    ? row.textX
    : options.origin === "line" || options.origin === "scatter"
      ? Number.isFinite(row.localOriginX) ? row.localOriginX : row.x1
      : (row.x0 + row.x1) / 2;
  const xScale = options.textLeft ? -1 : 1;
  const axisWidth = Number(options.axisWidth);
  const axisHeight = Number(options.axisHeight);
  const xUnit = Number.isFinite(axisWidth) && axisWidth > 0 ? axisWidth : 1;
  const yUnit = Number.isFinite(axisHeight) && axisHeight > 0 ? axisHeight : 1;
  return coordinates.map((coordinate) => ({
    x: originX + (coordinate.x / xUnit) * xScale,
    y: row.y + coordinate.y / yUnit
  }));
}

function datavisualizationThreeLegendMarkPoints(row) {
  const span = Math.max(0.01, row.x1 - row.x0);
  const ex = Number.isFinite(row.ex) ? row.ex : 0.017;
  return [
    { x: row.x1 - span, y: row.y - ex * 0.6 },
    { x: row.x1 - span * 0.5, y: row.y + ex * 0.6 },
    { x: row.x1, y: row.y }
  ];
}

function renderDatavisualizationRectangleLegend(plot, rowIndex = 0, legendCount = 1, context = {}) {
  const row = datavisualizationLineLegendRow(rowIndex, plot, legendCount, context);
  const style = formatDatavisualizationOptions({
    "axis legend example": true,
    draw: true,
    semithick: true,
    ...datavisualizationPlotStyle(plot.styleIndex || 0, plot)
  });
  const labelColor = datavisualizationLegendLabelColor(datavisualizationPlotStyle(plot.styleIndex || 0, plot), plot);
  if (plot.legendTextOnly) return [datavisualizationLegendLabelCommand(plot, row, labelColor)];
  const points = datavisualizationLegendLocalPoints(row, plot.legendRectangleCoordinates || [], { origin: "text", ...context });
  if (points.length >= 4) {
    const [first, ...rest] = points;
    const path = [`(axis description cs:${roundTikzNumber(first.x)},${roundTikzNumber(first.y)})`]
      .concat(rest.map((point) => `-- (axis description cs:${roundTikzNumber(point.x)},${roundTikzNumber(point.y)})`))
      .join(" ");
    return [`\\path[${style}] ${path} -- cycle;`, datavisualizationLegendLabelCommand(plot, row, labelColor)];
  }
  const height = 0.055;
  return [
    `\\path[${style}] (axis description cs:${roundTikzNumber(row.x0)},${roundTikzNumber(row.y - height)}) rectangle (axis description cs:${roundTikzNumber(row.x1)},${roundTikzNumber(row.y + height)});`,
    datavisualizationLegendLabelCommand(plot, row, labelColor)
  ];
}

function datavisualizationLegendCrossMark(point, style, mark) {
  const size = 0.01;
  const x = point.x;
  const y = point.y;
  if (mark === "+") {
    return `\\draw[${style}] (axis description cs:${roundTikzNumber(x - size)},${roundTikzNumber(y)}) -- (axis description cs:${roundTikzNumber(x + size)},${roundTikzNumber(y)}) (axis description cs:${roundTikzNumber(x)},${roundTikzNumber(y - size)}) -- (axis description cs:${roundTikzNumber(x)},${roundTikzNumber(y + size)});`;
  }
  return `\\draw[${style}] (axis description cs:${roundTikzNumber(x - size)},${roundTikzNumber(y - size)}) -- (axis description cs:${roundTikzNumber(x + size)},${roundTikzNumber(y + size)}) (axis description cs:${roundTikzNumber(x - size)},${roundTikzNumber(y + size)}) -- (axis description cs:${roundTikzNumber(x + size)},${roundTikzNumber(y - size)});`;
}

function datavisualizationLegendMercedesMark(point, style, mark) {
  const size = 0.012;
  const flipped = String(mark || "").toLowerCase().includes("flipped");
  const angles = flipped ? [-90, 30, 150] : [90, 210, 330];
  const center = `(axis description cs:${roundTikzNumber(point.x)},${roundTikzNumber(point.y)})`;
  const spokes = angles
    .map((angle) => {
      const end = {
        x: point.x + Math.cos((angle * Math.PI) / 180) * size,
        y: point.y + Math.sin((angle * Math.PI) / 180) * size
      };
      return `${center} -- (axis description cs:${roundTikzNumber(end.x)},${roundTikzNumber(end.y)})`;
    })
    .join(" ");
  return `\\draw[${style}] ${spokes};`;
}

function renderDatavisualizationLineLegend(plot, plotStyle, rowIndex, legendCount = 1, context = {}) {
  const row = plot.legendTextLeft
    ? datavisualizationNativeTextLeftLineLegendRow(datavisualizationLineLegendRow(rowIndex, plot, legendCount, context), context)
    : datavisualizationNativeLineLegendRow(datavisualizationLineLegendRow(rowIndex, plot, legendCount, context), context);
  const legendPlot = datavisualizationLegendStylePlot(plot);
  const legendPlotStyle = datavisualizationLinePlotStyle(legendPlot.styleIndex || 0, legendPlot);
  const style = formatDatavisualizationOptions({
    "axis legend example": true,
    ...legendPlotStyle
  });
  const labelColor = datavisualizationLegendLabelColor(legendPlotStyle, legendPlot);
  if (plot.legendTextOnly) return [datavisualizationLegendLabelCommand(plot, row, labelColor)];
  if (plot.legendLineCoordinates?.length >= 2) {
    const points = datavisualizationLegendLocalPoints(row, plot.legendLineCoordinates, { textLeft: plot.legendTextLeft, origin: "line", ...context });
    return [
      datavisualizationCustomLegendLine(points, style, legendPlot),
      ...datavisualizationLegendLineMarks(row, legendPlot, style, points),
      datavisualizationLegendLabelCommand(plot, row, labelColor)
    ];
  }
  if (plot.legendLineMode === "straight") {
    return [
      datavisualizationStraightLegendLine(row, style),
      ...datavisualizationLegendLineMarks(row, legendPlot, style),
      datavisualizationLegendLabelCommand(plot, row, labelColor)
    ];
  }
  if (plot.gapCycle) {
    return [
      datavisualizationGapCircularLegendLine(row, style),
      ...datavisualizationLegendLineMarks(row, legendPlot, style, datavisualizationGapCircularLegendMarkPoints(row)),
      datavisualizationLegendLabelCommand(plot, row, labelColor)
    ];
  }
  if (plot.cycle) {
    return [
      datavisualizationClosedLegendLine(row, style, legendPlot.smooth !== false),
      ...datavisualizationLegendLineMarks(row, legendPlot, style, datavisualizationCircularLegendMarkPoints(row)),
      datavisualizationLegendLabelCommand(plot, row, labelColor)
    ];
  }
  return [
    datavisualizationZigZagLegendLine(row, style),
    ...datavisualizationLegendLineMarks(row, legendPlot, style, datavisualizationZigZagLegendMarkPoints(row)),
    datavisualizationLegendLabelCommand(plot, row, labelColor)
  ];
}

function renderDatavisualizationManualLegend(entry, rowIndex = 0, legendCount = 1, context = {}) {
  const plot = entry.plot || {};
  const row = datavisualizationNativeLineLegendRow(datavisualizationLineLegendRow(rowIndex, plot, legendCount, context), context);
  const commands = [];
  if (!plot.legendTextOnly) {
    const visualizer = String(entry.visualizerInLegend || "");
    const circleMatch = visualizer.match(/\\draw\s*\[([^\]]*)\]\s*\(\s*0\s*,\s*0\s*\)\s*circle\s*\[\s*radius\s*=\s*([^;\]]+?)\s*\]/);
    if (circleMatch) {
      const style = formatDatavisualizationOptions({
        "axis legend example": true,
        ...(circleMatch[1].trim() ? parseOptions(circleMatch[1]) : {}),
        ...(entry.visualizerStyle ? parseOptions(entry.visualizerStyle) : {})
      });
      commands.push(
        `\\draw[${style}] (axis description cs:${roundTikzNumber(row.x1)},${roundTikzNumber(row.y)}) circle[radius=${circleMatch[2].trim()}];`
      );
    }
  }
  commands.push(datavisualizationLegendLabelCommand(plot, row, datavisualizationLegendLabelColor({}, plot)));
  return commands;
}

function datavisualizationLegendBackgroundCommands(legendPlots = [], context = {}) {
  const insidePlots = legendPlots.filter((plot) => plot.legendInside && plot.legendLabel);
  const matrixNodeStyle = datavisualizationLegendMatrixNodeStyle(legendPlots);
  const backgroundPlots = matrixNodeStyle ? legendPlots.filter((plot) => plot.legendLabel) : insidePlots;
  if (!backgroundPlots.length) return [];
  const axisWidth = Number(context.axisWidth);
  const axisHeight = Number(context.axisHeight);
  if (!Number.isFinite(axisWidth) || axisWidth <= 0 || !Number.isFinite(axisHeight) || axisHeight <= 0) return [];

  const legendCount = legendPlots.length;
  const defaultRowHeightCm = parseDimension("1.85ex", {});
  const textOnlyRowHeightCm = parseDimension("1.5ex", {});
  const innerXSepCm = parseDimension(".333ex", {});
  const innerYSepCm = parseDimension(".333ex", {});
  const outerSepCm = parseDimension(".5ex", {});
  let left = Infinity;
  let right = -Infinity;
  let bottom = Infinity;
  let top = -Infinity;

  for (let index = 0; index < legendPlots.length; index += 1) {
    const plot = legendPlots[index];
    if (!backgroundPlots.includes(plot)) continue;
    const row = datavisualizationRenderedLegendRow(plot, index, legendCount, context);
    const rowHeightCm = plot.legendTextOnly ? textOnlyRowHeightCm : defaultRowHeightCm;
    const textWidthCm = Math.max(0.18, estimateLegendBackgroundEntryWidth(plot.legendLabel, 0.8));
    const sampleLeft = plot.legendTextOnly ? row.textX : Math.min(row.x0, row.x1, row.textX);
    const sampleRight = plot.legendTextOnly ? row.textX : Math.max(row.x0, row.x1, row.textX);
    const rowLeft = sampleLeft * axisWidth - innerXSepCm;
    const rowRight = row.textX * axisWidth + textWidthCm + innerXSepCm;
    const rowBottom = row.y * axisHeight - rowHeightCm / 2 - innerYSepCm;
    const rowTop = row.y * axisHeight + rowHeightCm / 2 + innerYSepCm;
    left = Math.min(left, rowLeft);
    right = Math.max(right, sampleRight * axisWidth + innerXSepCm, rowRight);
    bottom = Math.min(bottom, rowBottom);
    top = Math.max(top, rowTop);
  }
  if (![left, right, bottom, top].every(Number.isFinite)) return [];

  const textOnlyInside = !matrixNodeStyle && insidePlots.every((plot) => plot.legendTextOnly);
  left -= outerSepCm;
  right += outerSepCm;
  bottom -= outerSepCm;
  top += outerSepCm;
  if (textOnlyInside) {
    left += 0.08;
  }
  if (matrixNodeStyle) {
    right += parseDimension("6.4pt", {});
  }
  const width = Math.max(0.2, right - left);
  const height = Math.max(0.2, top - bottom);
  const centerX = ((left + right) / 2) / axisWidth;
  const textOnlyBackgroundYOffsetCm = textOnlyInside ? 0.08 : 0;
  const centerY = ((bottom + top) / 2 + textOnlyBackgroundYOffsetCm) / axisHeight;
  const styleOptions = matrixNodeStyle
    ? ["axis legend background", "draw=none", "fill=white", ...matrixNodeStyle, "inner sep=0pt"]
    : ["axis legend background", "draw=none", "fill=white", "rounded corners=3pt", "inner sep=0pt"];
  return [
    `\\node[${styleOptions.join(",")},minimum width=${roundTikzNumber(width)}cm,minimum height=${roundTikzNumber(height)}cm] at (axis description cs:${roundTikzNumber(centerX)},${roundTikzNumber(centerY)}) {};`
  ];
}

function datavisualizationLegendMatrixNodeStyle(legendPlots = []) {
  for (const plot of legendPlots || []) {
    const options = parseOptions(plot?.legendPosition || "");
    if (options.transparent !== undefined && options.transparent !== null && options.transparent !== false) {
      return ["fill=none"];
    }
    if (options.opaque !== undefined && options.opaque !== null && options.opaque !== false) {
      const fill = options.opaque === true || options.opaque === "" ? "white" : stripOuterBracesText(String(options.opaque).trim());
      return ["rounded corners=3pt", `fill=${fill || "white"}`];
    }
    const raw = options["matrix node style"];
    if (raw === undefined || raw === null || raw === false || raw === "") continue;
    const style = stripOuterBracesText(String(raw === true ? "" : raw).trim());
    if (!style) continue;
    return splitTopLevel(style, ",").map((part) => part.trim()).filter(Boolean);
  }
  return null;
}

function estimateLegendBackgroundEntryWidth(entry, fontScale = 0.8) {
  const visibleMathText = stripTexForLegendBackgroundLength(entry);
  const mathWidth = visibleMathText.length * 0.075 * (fontScale / 0.7);
  return Math.max(estimateLegendEntryWidth(entry, fontScale), mathWidth);
}

function stripTexForLegendBackgroundLength(value) {
  return String(value || "")
    .replace(/\\(log|ln|sin|cos|tan|cot|sec|csc|exp|max|min|det|dim|ker)\b/g, "$1")
    .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "$1/$2")
    .replace(/\\[a-zA-Z]+\s*/g, "")
    .replace(/[{}$]/g, "")
    .trim();
}

function datavisualizationRenderedLegendRow(plot, index = 0, legendCount = 1, context = {}) {
  const baseRow = datavisualizationLineLegendRow(index, plot, legendCount, context);
  if (plot.legendTextOnly) return baseRow;
  if (plot.kind === "scatter" || plot.noLines) {
    return plot.legendTextLeft ? datavisualizationNativeTextLeftScatterLegendRow(baseRow, context) : baseRow;
  }
  return plot.legendTextLeft
    ? datavisualizationNativeTextLeftLineLegendRow(baseRow, context)
    : datavisualizationNativeLineLegendRow(baseRow, context);
}

function datavisualizationLegendLabelCommand(plot, row, color = "") {
  const anchor = plot.legendTextLeft ? "east" : "west";
  const textX = plot.legendTextLeft && Number.isFinite(row.labelX) ? row.labelX : row.textX;
  const options = [
    "axis legend",
    `anchor=${anchor}`,
    `font=${datavisualizationRoleFont(plot.legendInside ? "insideLegend" : "outsideLegend")}`
  ];
  if (plot.legendInside && plot.legendTextOnly) options.push("inner xsep=0pt", "inner ysep=1pt");
  if (plot.legendTextColored && color) options.push(`text=${color}`);
  options.push(...datavisualizationLegendNodeStyleOptions(plot.legendNodeStyle));
  if (Array.isArray(plot.legendNodeStyle) && plot.legendNodeStyle.length) {
    options.push("tikzkit datavis legend math metrics");
  }
  return `\\node[${options.join(", ")}] at (axis description cs:${roundTikzNumber(textX)},${roundTikzNumber(row.y)}) {${protectDatavisualizationOverlayText(plot.legendLabel)}};`;
}

function datavisualizationLegendNodeStyle(legendPosition = "", globalOptionsRaw = "", ...rawLegendOptions) {
  const styles = [];
  const globalOptions = parseOptions(globalOptionsRaw || "");
  styles.push(...datavisualizationLegendNodeStyleFromStyle(globalOptions["every label in legend/.style"]));
  styles.push(...datavisualizationLegendNodeStyleFromStyle(globalOptions["every label in legend/.append style"]));

  const legendOptions = parseOptions(legendPosition || "");
  styles.push(...datavisualizationLegendNodeStyleFromStyle(legendOptions["label style"]));

  for (const raw of rawLegendOptions) {
    if (raw === undefined || raw === null || raw === false || raw === "") continue;
    const options = parseOptions(String(raw));
    styles.push(...datavisualizationLegendNodeStyleFromStyle(options["node style"]));
  }
  return styles;
}

function datavisualizationLegendNodeStyleFromStyle(rawStyle) {
  if (rawStyle === undefined || rawStyle === null || rawStyle === false || rawStyle === true || rawStyle === "") return [];
  const text = stripOuterBracesText(String(rawStyle || "").trim());
  if (!text) return [];
  const parsed = parseOptions(text);
  if (parsed["node style"] !== undefined && parsed["node style"] !== null && parsed["node style"] !== false) {
    const style = parsed["node style"] === true ? "" : stripOuterBracesText(String(parsed["node style"]).trim());
    return style ? [style] : [];
  }
  return [text];
}

function datavisualizationLegendNodeStyleOptions(styles = []) {
  const options = [];
  for (const style of Array.isArray(styles) ? styles : [styles]) {
    const text = stripOuterBracesText(String(style || "").trim());
    if (!text) continue;
    options.push(...splitTopLevel(text, ","));
  }
  return options;
}

function datavisualizationLegendVisualizerStyle(...rawLegendOptions) {
  const styles = [];
  for (const raw of rawLegendOptions) {
    if (raw === undefined || raw === null || raw === false || raw === "") continue;
    const options = parseOptions(String(raw));
    for (const key of ["visualizer in legend style", "visualizer in legend styling"]) {
      const value = options[key];
      if (value === undefined || value === null || value === false || value === true || value === "") continue;
      const text = stripOuterBracesText(String(value).trim());
      if (text) styles.push(text);
    }
  }
  return styles.length ? datavisualizationNormalizeStyleOptions(parseOptions(styles.join(","))) : {};
}

function datavisualizationLegendLabelColor(style = {}, plot = {}) {
  return String(style.text || style.color || style.draw || style.stroke || datavisualizationPlotColor(plot.styleIndex || 0, plot) || "black").trim();
}

function datavisualizationStraightLegendLine(row, style) {
  return `\\draw[${style}] (axis description cs:${roundTikzNumber(row.x0)},${roundTikzNumber(row.y)}) -- (axis description cs:${roundTikzNumber(row.x1)},${roundTikzNumber(row.y)});`;
}

function datavisualizationCustomLegendLine(points, style, plot = {}) {
  const coordinates = points.map((point) => `(axis description cs:${roundTikzNumber(point.x)},${roundTikzNumber(point.y)})`);
  const suffix = plot.cycle ? " -- cycle" : "";
  return `\\draw[${style}] ${coordinates.join(" -- ")}${suffix};`;
}

function datavisualizationLegendLineMarks(row, plot, style, points = null) {
  const mark = String(plot.mark || "").trim();
  if (!mark || mark === "none") return [];
  const span = row.x1 - row.x0;
  const markPoints = points || [
    { x: row.x0 + span * 0.25, y: row.y },
    { x: row.x0 + span * 0.75, y: row.y }
  ];
  return markPoints.map((point) => datavisualizationLegendMark(point, style, mark));
}

function datavisualizationLegendMark(point, style, mark) {
  if (mark === "*" || mark === "o") {
    const fill = mark === "*" ? style : `${style},fill=white`;
    return `\\path[axis legend example,${fill}] (axis description cs:${roundTikzNumber(point.x)},${roundTikzNumber(point.y)}) circle (0.012);`;
  }
  if (datavisualizationIsMercedesMark(mark)) return datavisualizationLegendMercedesMark(point, style, mark);
  return datavisualizationLegendCrossMark(point, style, mark === "+" ? "+" : "x");
}

function datavisualizationClosedLegendLine(row, style, smooth = true) {
  const cx = (row.x0 + row.x1) / 2;
  const rx = datavisualizationCircularLegendRadii(row).rx;
  const ry = datavisualizationCircularLegendRadii(row).ry;
  if (!smooth) {
    const points = [
      { x: cx - rx, y: row.y },
      { x: cx, y: row.y + ry },
      { x: cx + rx, y: row.y },
      { x: cx, y: row.y - ry }
    ];
    return `\\draw[${style}] ${points.map((point) => `(axis description cs:${roundTikzNumber(point.x)},${roundTikzNumber(point.y)})`).join(" -- ")} -- cycle;`;
  }
  const k = 0.5522847498;
  const left = { x: cx - rx, y: row.y };
  const top = { x: cx, y: row.y + ry };
  const right = { x: cx + rx, y: row.y };
  const bottom = { x: cx, y: row.y - ry };
  return `\\draw[${style}] (axis description cs:${roundTikzNumber(left.x)},${roundTikzNumber(left.y)}) .. controls (axis description cs:${roundTikzNumber(left.x)},${roundTikzNumber(left.y + ry * k)}) and (axis description cs:${roundTikzNumber(top.x - rx * k)},${roundTikzNumber(top.y)}) .. (axis description cs:${roundTikzNumber(top.x)},${roundTikzNumber(top.y)}) .. controls (axis description cs:${roundTikzNumber(top.x + rx * k)},${roundTikzNumber(top.y)}) and (axis description cs:${roundTikzNumber(right.x)},${roundTikzNumber(right.y + ry * k)}) .. (axis description cs:${roundTikzNumber(right.x)},${roundTikzNumber(right.y)}) .. controls (axis description cs:${roundTikzNumber(right.x)},${roundTikzNumber(right.y - ry * k)}) and (axis description cs:${roundTikzNumber(bottom.x + rx * k)},${roundTikzNumber(bottom.y)}) .. (axis description cs:${roundTikzNumber(bottom.x)},${roundTikzNumber(bottom.y)}) .. controls (axis description cs:${roundTikzNumber(bottom.x - rx * k)},${roundTikzNumber(bottom.y)}) and (axis description cs:${roundTikzNumber(left.x)},${roundTikzNumber(left.y - ry * k)}) .. (axis description cs:${roundTikzNumber(left.x)},${roundTikzNumber(left.y)}) -- cycle;`;
}

function datavisualizationCircularLegendRadii(row) {
  const span = Math.max(0.01, row.x1 - row.x0);
  const ex = Number.isFinite(row.ex) ? row.ex : 0.017;
  return {
    rx: Math.max(0.012, span * 0.45),
    ry: Math.max(0.006, ex * (0.35 / 0.3))
  };
}

function datavisualizationCircularLegendMarkPoints(row) {
  const cx = (row.x0 + row.x1) / 2;
  const { rx, ry } = datavisualizationCircularLegendRadii(row);
  return [120, -60].map((angle) => {
    const radians = (angle * Math.PI) / 180;
    return {
      x: cx + Math.cos(radians) * rx,
      y: row.y + Math.sin(radians) * ry
    };
  });
}

function datavisualizationGapCircularLegendRadii(row) {
  const span = Math.max(0.01, row.x1 - row.x0);
  const em = parseDimension("2em", {});
  const ex = Number.isFinite(row.ex) ? row.ex : 0.017;
  return {
    rx: span * (parseDimension("1.4ex", {}) / em),
    ry: Math.max(0.006, ex * 3),
    yShift: ex * (0.2 / 0.3)
  };
}

function datavisualizationGapCircularLegendMarkPoints(row) {
  const cx = (row.x0 + row.x1) / 2;
  const { rx, ry, yShift } = datavisualizationGapCircularLegendRadii(row);
  return [90, 162, 234, 306, 18].map((angle) => {
    const radians = (angle * Math.PI) / 180;
    return {
      x: cx + Math.cos(radians) * rx,
      y: row.y + yShift + Math.sin(radians) * ry
    };
  });
}

function datavisualizationGapCircularLegendLine(row, style) {
  const points = datavisualizationGapCircularLegendMarkPoints(row);
  return `\\draw[${style}] ${points.map((point) => `(axis description cs:${roundTikzNumber(point.x)},${roundTikzNumber(point.y)})`).join(" -- ")} -- cycle;`;
}

function datavisualizationZigZagLegendMarkPoints(row) {
  const span = row.x1 - row.x0;
  const ex = Number.isFinite(row.ex) ? row.ex : 0.017;
  return [
    { x: row.x0 + span * 0.25, y: row.y + ex },
    { x: row.x0 + span * 0.75, y: row.y - ex }
  ];
}

function datavisualizationZigZagLegendLine(row, style, coordinate = datavisualizationAxisDescriptionCoordinate) {
  const span = row.x1 - row.x0;
  const ex = Number.isFinite(row.ex) ? row.ex : 0.017;
  const points = [
    { x: row.x0, y: row.y },
    { x: row.x0 + span * 0.25, y: row.y + ex },
    { x: row.x0 + span * 0.75, y: row.y - ex },
    { x: row.x1, y: row.y }
  ];
  const segments = [coordinate(points[0])];
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const current = points[index];
    const next = points[index + 1];
    const after = points[Math.min(points.length - 1, index + 2)];
    const c1 = {
      x: current.x + (next.x - previous.x) / 6,
      y: current.y + (next.y - previous.y) / 6
    };
    const c2 = {
      x: next.x - (after.x - current.x) / 6,
      y: next.y - (after.y - current.y) / 6
    };
    segments.push(
      `.. controls ${coordinate(c1)} and ${coordinate(c2)} .. ${coordinate(next)}`
    );
  }
  return `\\draw[${style}] ${segments.join(" ")};`;
}

function datavisualizationAxisDescriptionCoordinate(point) {
  return `(axis description cs:${roundTikzNumber(point.x)},${roundTikzNumber(point.y)})`;
}

function datavisualizationRawCoordinate(point) {
  return `(${roundTikzNumber(point.x)},${roundTikzNumber(point.y)})`;
}

function datavisualizationNativeLineLegendRow(row, context = {}) {
  if (row.nativeLineCalibrated) return row;
  const axisWidth = Number(context.axisWidth);
  const axisHeight = Number(context.axisHeight);
  if (!Number.isFinite(axisWidth) || axisWidth <= 0) return row;
  const sampleWidth = parseDimension("2em", {});
  const textGap = parseDimension("0.5em", {});
  if (![sampleWidth, textGap].every(Number.isFinite)) return row;
  let next;
  if (row.physicalOutsideLegend) {
    const sampleOffset = parseDimension("1.5em", {});
    if (!Number.isFinite(sampleOffset)) return row;
    const columnOffset = Number(row.physicalColumnOffset) || 0;
    next = {
      ...row,
      x0: (axisWidth + sampleOffset) / axisWidth + columnOffset,
      x1: (axisWidth + sampleOffset + sampleWidth) / axisWidth + columnOffset,
      textX: (axisWidth + sampleOffset + sampleWidth + textGap) / axisWidth + columnOffset
    };
  } else {
    const x1 = row.textX - textGap / axisWidth;
    next = {
      ...row,
      x0: x1 - sampleWidth / axisWidth,
      x1
    };
  }
  if (Number.isFinite(axisHeight) && axisHeight > 0) next.ex = parseDimension(".3ex", {}) / axisHeight;
  next.nativeLineCalibrated = true;
  return next;
}

function datavisualizationNativeTextLeftLineLegendRow(row, context = {}) {
  if (row.textLeftCalibrated) return row;
  const axisWidth = Number(context.axisWidth);
  const axisHeight = Number(context.axisHeight);
  if (!Number.isFinite(axisWidth) || axisWidth <= 0) {
    return {
      ...row,
      labelX: row.x0 - 0.035
    };
  }
  const sampleWidth = parseDimension("2em", {}) / axisWidth;
  const textGap = parseDimension("0.5em", {}) / axisWidth;
  const next = {
    ...row,
    x1: row.x0 + sampleWidth,
    labelX: row.x0 - textGap
  };
  if (Number.isFinite(axisHeight) && axisHeight > 0) next.ex = parseDimension(".3ex", {}) / axisHeight;
  return next;
}

function datavisualizationNativeTextLeftScatterLegendRow(row, context = {}) {
  if (row.textLeftCalibrated) return row;
  const axisWidth = Number(context.axisWidth);
  const sampleWidth = Number.isFinite(axisWidth) && axisWidth > 0 ? parseDimension("3ex", {}) / axisWidth : 0.061;
  const textGap = Number.isFinite(axisWidth) && axisWidth > 0 ? parseDimension(".333em", {}) / axisWidth : 0.024;
  const origin = row.x1;
  return {
    ...row,
    x0: origin,
    x1: origin + sampleWidth,
    textX: origin - textGap
  };
}

function datavisualizationLineLegendRow(index, plot = {}, legendCount = 1, context = {}) {
  const row = Math.max(0, Number(index) || 0);
  const count = Math.max(1, Number(legendCount) || 1);
  const position = String(plot.legendPosition || "").trim().toLowerCase();
  if (plot.legendExplicit && position === "south east outside" && plot.kind !== "scatter" && !plot.noLines) {
    return {
      x0: 1.105,
      x1: 1.246,
      textX: 1.281,
      y: 0.102 + (count - 1 - row) * 0.125
    };
  }
  if (plot.legendExplicit && position === "south east outside" && (plot.kind === "scatter" || plot.noLines)) {
    return datavisualizationSouthEastOutsideScatterLegendRow(row, count, context);
  }
  const placement = plot.legendExplicit || position !== "south east outside"
    ? datavisualizationLegendPlacement(plot.legendPosition, row, count, plot, context)
    : null;
  if (placement) return placement;
  const rowStep = 0.125;
  const centerY = 0.39;
  if (plot.kind === "scatter" || plot.noLines) {
    if (context.mixedLineAndScatter) {
      return {
        x0: 1.246,
        x1: 1.246,
        textX: 1.281,
        y: centerY + ((count - 1) / 2 - row) * rowStep
      };
    }
    const axisWidth = Number(context.axisWidth);
    const sampleOrigin = 1.228;
    const sampleWidth = Number.isFinite(axisWidth) && axisWidth > 0 ? parseDimension("3ex", {}) / axisWidth : 0.091;
    const textGap = Number.isFinite(axisWidth) && axisWidth > 0 ? parseDimension("0.5em", {}) / axisWidth : 0.035;
    return {
      x0: sampleOrigin - sampleWidth,
      x1: sampleOrigin,
      textX: sampleOrigin + textGap,
      y: centerY + ((count - 1) / 2 - row) * rowStep
    };
  }
  if (context.schoolBookAxes && !plot.legendExplicit) {
    const schoolBookRow = datavisualizationSchoolBookOutsideLineLegendRow(row, count, context);
    if (schoolBookRow) return schoolBookRow;
  }
  return {
    x0: 1.105,
    x1: 1.246,
    textX: 1.281,
    y: centerY + ((count - 1) / 2 - row) * rowStep,
    physicalOutsideLegend: true
  };
}

function datavisualizationSouthEastOutsideScatterLegendRow(row = 0, legendCount = 1, context = {}) {
  const axisWidth = Number(context.axisWidth);
  const axisHeight = Number(context.axisHeight);
  if (!Number.isFinite(axisWidth) || axisWidth <= 0 || !Number.isFinite(axisHeight) || axisHeight <= 0) {
    return {
      x0: 1.075,
      x1: 1.115,
      localOriginX: 1.115,
      textX: 1.14,
      y: 0.09 - row * 0.13
    };
  }

  // TeX Live anchors this matrix at the data bounding-box south east, shifted
  // by .8em. A one-mark cell places its mark half an em inside the cell; the
  // label node then applies its native .333em text-right shift.
  const outsideShift = parseDimension(".8em", {});
  const markCellInset = parseDimension(".5em", {});
  const labelShift = parseDimension(".333em", {});
  const rowHeight = parseDimension("1em", {});
  const firstRowCenter = parseDimension(".8em", {});
  const count = Math.max(1, Number(legendCount) || 1);
  const x = (axisWidth + outsideShift + markCellInset) / axisWidth;
  const textX = (axisWidth + outsideShift + markCellInset + labelShift) / axisWidth;
  const y = (firstRowCenter + (count - 1 - row) * rowHeight) / axisHeight;
  return {
    x0: x,
    x1: x,
    localOriginX: x,
    textX,
    y,
    physicalOutsideLegend: true
  };
}

function datavisualizationSchoolBookOutsideLineLegendRow(row = 0, legendCount = 1, context = {}) {
  const axisWidth = Number(context.axisWidth);
  const axisHeight = Number(context.axisHeight);
  if (!Number.isFinite(axisWidth) || axisWidth <= 0 || !Number.isFinite(axisHeight) || axisHeight <= 0) return null;
  const sampleWidth = parseDimension("2em", {});
  const textGap = parseDimension("0.5em", {});
  const sampleEndOffset = 1.382;
  const rowStep = parseDimension("1.1em", {});
  if (![sampleWidth, textGap, rowStep].every(Number.isFinite)) return null;
  const x1 = (axisWidth + sampleEndOffset) / axisWidth;
  return {
    x0: x1 - sampleWidth / axisWidth,
    x1,
    textX: x1 + textGap / axisWidth,
    y: 0.5 + ((Math.max(1, legendCount) - 1) / 2 - row) * (rowStep / axisHeight),
    ex: parseDimension(".3ex", {}) / axisHeight
  };
}

function datavisualizationLegendPlacement(rawPosition, index, legendCount, plot = {}, context = {}) {
  const options = parseOptions(rawPosition || "");
  const text = String(rawPosition || "").trim().toLowerCase();
  const dataPlacement = datavisualizationLegendDataPlacement(options, index, legendCount, plot, context);
  if (dataPlacement) return dataPlacement;
  const anchorAtPlacement = datavisualizationLegendAnchorAtPlacement(options, index, legendCount, plot, context);
  if (anchorAtPlacement) return anchorAtPlacement;
  const insideKey = datavisualizationInsideLegendKey(options, text);
  if (insideKey) return datavisualizationInsideLegendPlacement(insideKey, options, index, legendCount);
  const westOutsideKey = datavisualizationWestOutsideLegendKey(options, text);
  if (westOutsideKey) return datavisualizationWestOutsideLegendPlacement(westOutsideKey, index, legendCount);
  const explicitEastOutsideKey = datavisualizationEastOutsideLegendKey(options, text, false);
  if (explicitEastOutsideKey) return datavisualizationEastOutsideLegendPlacement(explicitEastOutsideKey, options, index, legendCount, plot, context);
  const northOutside = Boolean(options.above || options["north outside"] || /^north outside\b/.test(text));
  if (northOutside) return datavisualizationVerticalOutsideLegendPlacement("north", options, index, legendCount, context);
  const below = Boolean(options.below || options["south outside"] || /^south outside\b/.test(text));
  if (!below) {
    const eastOutsideKey = datavisualizationEastOutsideLegendKey(options, text, true);
    if (eastOutsideKey) return datavisualizationEastOutsideLegendPlacement(eastOutsideKey, options, index, legendCount, plot, context);
    return null;
  }
  return datavisualizationVerticalOutsideLegendPlacement("south", options, index, legendCount, context);
}

function datavisualizationLegendAnchorAtPlacement(options = {}, index = 0, legendCount = 1, plot = {}, context = {}) {
  if (options.at === undefined || options.at === null || options.at === false) return null;
  const point = datavisualizationLegendAtPoint(options.at, context);
  if (!point) return null;

  const axisWidth = Number(context.axisWidth);
  const axisHeight = Number(context.axisHeight);
  if (!Number.isFinite(axisWidth) || axisWidth <= 0 || !Number.isFinite(axisHeight) || axisHeight <= 0) return null;

  const count = Math.max(1, Number(legendCount) || 1);
  const cell = datavisualizationLegendMatrixCell(options, index, count);
  const sampleWidth = parseDimension("2em", {}) / axisWidth;
  const textGap = parseDimension("0.5em", {}) / axisWidth;
  const rowStep = parseDimension("1.1em", {}) / axisHeight;
  const labels = Array.isArray(context.legendLabels) && context.legendLabels.length ? context.legendLabels : [plot.legendLabel || ""];
  const labelWidth = Math.max(...labels.map((label) => datavisualizationLegendMatrixLabelWidth(label))) / axisWidth;
  const columnStep = Math.max(sampleWidth + textGap + labelWidth, datavisualizationLegendMatrixColumnStep(context, plot));
  if (![sampleWidth, textGap, rowStep, labelWidth, columnStep].every(Number.isFinite)) return null;

  const anchor = String(options.anchor || "center").toLowerCase().trim();
  const matrixWidth = sampleWidth + textGap + labelWidth + Math.max(0, cell.columns - 1) * columnStep;
  let left = point.x - matrixWidth / 2;
  if (anchor.includes("west")) left = point.x;
  else if (anchor.includes("east")) left = point.x - matrixWidth;

  let firstRowY = point.y + ((cell.rows - 1) / 2) * rowStep;
  if (anchor.includes("north")) firstRowY = point.y - rowStep * 0.5;
  else if (anchor.includes("south")) firstRowY = point.y + (cell.rows - 0.5) * rowStep;

  const x0 = left + cell.column * columnStep;
  return {
    x0,
    x1: x0 + sampleWidth,
    textX: x0 + sampleWidth + textGap,
    y: firstRowY - cell.row * rowStep,
    ex: parseDimension(".3ex", {}) / axisHeight,
    nativeLineCalibrated: true
  };
}

function datavisualizationLegendAtPoint(rawAt, context = {}) {
  let text = stripOuterBracesText(String(rawAt || "").trim());
  text = stripOuterParentheses(text);
  let xShift = 0;
  let yShift = 0;
  const shifted = text.match(/^\s*\[([^\]]+)\]\s*([\s\S]+)$/);
  if (shifted) {
    const shiftOptions = parseOptions(shifted[1]);
    const axisWidth = Number(context.axisWidth);
    const axisHeight = Number(context.axisHeight);
    const parsedXShift = parseDimension(shiftOptions.xshift || shiftOptions["x shift"] || "0", {});
    const parsedYShift = parseDimension(shiftOptions.yshift || shiftOptions["y shift"] || "0", {});
    if (Number.isFinite(parsedXShift) && Number.isFinite(axisWidth) && axisWidth > 0) xShift = parsedXShift / axisWidth;
    if (Number.isFinite(parsedYShift) && Number.isFinite(axisHeight) && axisHeight > 0) yShift = parsedYShift / axisHeight;
    text = shifted[2].trim();
  }

  let point = datavisualizationLegendProjectionPoint(text, context);
  if (!point) point = datavisualizationLegendNamedBoundingBoxPoint(text);
  if (!point) point = datavisualizationLegendCoordinateSystemPoint(text, context);
  if (!point) return null;
  return { x: point.x + xShift, y: point.y + yShift };
}

function datavisualizationLegendProjectionPoint(text, context = {}) {
  const projection = datavisualizationProjectionOperatorIndex(text);
  if (!projection) return null;
  const left = String(text || "").slice(0, projection.index).trim();
  const right = String(text || "").slice(projection.index + 2).trim();
  const leftPoint = datavisualizationLegendAtPoint(left, context);
  const rightPoint = datavisualizationLegendAtPoint(right, context);
  if (!leftPoint || !rightPoint) return null;
  return projection.operator === "|-"
    ? { x: leftPoint.x, y: rightPoint.y }
    : { x: rightPoint.x, y: leftPoint.y };
}

function datavisualizationProjectionOperatorIndex(text) {
  const source = String(text || "");
  let braces = 0;
  let brackets = 0;
  let parentheses = 0;
  for (let index = 0; index < source.length - 1; index += 1) {
    const ch = source[index];
    if (ch === "{") braces += 1;
    else if (ch === "}") braces = Math.max(0, braces - 1);
    else if (ch === "[") brackets += 1;
    else if (ch === "]") brackets = Math.max(0, brackets - 1);
    else if (ch === "(") parentheses += 1;
    else if (ch === ")") parentheses = Math.max(0, parentheses - 1);
    if (braces || brackets || parentheses) continue;
    const two = source.slice(index, index + 2);
    if (two === "|-" || two === "-|") return { index, operator: two };
  }
  return null;
}

function stripOuterParentheses(text) {
  const source = String(text || "").trim();
  if (!source.startsWith("(") || !source.endsWith(")")) return source;
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const ch = source[index];
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (depth === 0 && index < source.length - 1) return source;
  }
  return source.slice(1, -1).trim();
}

function datavisualizationLegendNamedBoundingBoxPoint(text) {
  const match = String(text || "")
    .trim()
    .toLowerCase()
    .match(/^(data visualization bounding box|data bounding box)\.([a-z ]+)$/);
  if (!match) return null;
  return datavisualizationLegendAnchorPoint(match[2]);
}

function datavisualizationLegendAnchorPoint(anchor) {
  const text = String(anchor || "center").toLowerCase();
  let x = 0.5;
  let y = 0.5;
  if (text.includes("west")) x = 0;
  else if (text.includes("east")) x = 1;
  if (text.includes("south")) y = 0;
  else if (text.includes("north")) y = 1;
  return { x, y };
}

function datavisualizationLegendCoordinateSystemPoint(text, context = {}) {
  const match = String(text || "").trim().match(/^(axis description cs|visualization cs|data cs)\s*:\s*([\s\S]+)$/i);
  if (!match) return null;
  const system = match[1].toLowerCase();
  const body = match[2].trim();
  if (system === "axis description cs") {
    const parts = splitTopLevel(body, ",").map((part) => part.trim());
    const x = axisNumber(parts[0], NaN);
    const y = axisNumber(parts[1], NaN);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }
  const point = datavisualizationLegendDataPoint(body);
  return point ? datavisualizationAxisDescriptionPoint(point, context) : null;
}

function datavisualizationLegendDataPlacement(options = {}, index = 0, legendCount = 1, plot = {}, context = {}) {
  const placement = datavisualizationLegendDataPlacementOption(options);
  if (!placement) return null;
  const point = datavisualizationLegendDataPoint(placement.value);
  if (!point) return null;
  const center = datavisualizationAxisDescriptionPoint(point, context);
  if (!center) return null;

  const count = Math.max(1, Number(legendCount) || 1);
  const row = Math.max(0, Number(index) || 0);
  const axisWidth = Number(context.axisWidth);
  const axisHeight = Number(context.axisHeight);
  const sampleWidth = Number.isFinite(axisWidth) && axisWidth > 0 ? parseDimension("2em", {}) / axisWidth : 0.141;
  const textGap = Number.isFinite(axisWidth) && axisWidth > 0 ? parseDimension("0.5em", {}) / axisWidth : 0.035;
  const columnPadding = Number.isFinite(axisWidth) && axisWidth > 0 ? parseDimension(".333ex", {}) / axisWidth : 0.01;
  const rowStep = Number.isFinite(axisHeight) && axisHeight > 0 ? parseDimension("1.1em", {}) / axisHeight : 0.125;
  const labelWidth =
    Number.isFinite(axisWidth) && axisWidth > 0
      ? datavisualizationLegendMatrixLabelWidth(plot.legendLabel || "") / axisWidth
      : 0.17;
  const totalWidth = sampleWidth + textGap + labelWidth + columnPadding * 2;
  const totalHeight = Math.max(0, (count - 1) * rowStep);

  let x0 = center.x - totalWidth / 2;
  let y = center.y + totalHeight / 2 - row * rowStep;

  if (placement.anchor.includes("west")) x0 = center.x;
  if (placement.anchor.includes("east")) x0 = center.x - totalWidth;
  if (placement.anchor === "north" || placement.anchor.includes("north")) y = center.y - row * rowStep;
  if (placement.anchor === "south" || placement.anchor.includes("south")) y = center.y + totalHeight - row * rowStep;

  return {
    x0,
    x1: x0 + sampleWidth,
    textX: x0 + sampleWidth + textGap,
    y,
    inside: true
  };
}

function datavisualizationLegendDataPlacementOption(options = {}) {
  const entries = [
    ["at values", "center"],
    ["right of", "west"],
    ["left of", "east"],
    ["above of", "south"],
    ["below of", "north"],
    ["above right of", "south west"],
    ["above left of", "south east"],
    ["below right of", "north west"],
    ["below left of", "north east"]
  ];
  for (const [key, anchor] of entries) {
    if (options[key] === undefined || options[key] === null || options[key] === false) continue;
    return { key, anchor, value: options[key] };
  }
  return null;
}

function datavisualizationLegendDataPoint(rawValue) {
  const text = String(rawValue || "").trim().replace(/^\{([\s\S]*)\}$/, "$1");
  if (!text) return null;
  const parsed = parseOptions(text);
  const x = axisNumber(parsed.x, NaN);
  const y = axisNumber(parsed.y, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function datavisualizationAxisDescriptionPoint(point, context = {}) {
  const xMin = Number(context.xMin);
  const xMax = Number(context.xMax);
  const yMin = Number(context.yMin);
  const yMax = Number(context.yMax);
  if (![xMin, xMax, yMin, yMax].every(Number.isFinite)) return null;
  const xSpan = xMax - xMin;
  const ySpan = yMax - yMin;
  if (Math.abs(xSpan) < 1e-12 || Math.abs(ySpan) < 1e-12) return null;
  return {
    x: (point.x - xMin) / xSpan,
    y: (point.y - yMin) / ySpan
  };
}

function datavisualizationVerticalOutsideLegendPlacement(side, options = {}, index = 0, legendCount = 1, context = {}) {
  const requestedRows = Math.round(axisNumber(options.rows, 1));
  const rows = Math.max(1, Math.min(Math.max(1, legendCount), Number.isFinite(requestedRows) ? requestedRows : 1));
  const column = Math.floor(index / rows);
  const row = index % rows;
  const columns = Math.max(1, Math.ceil(legendCount / rows));
  const sampleWidth = 0.141;
  const rowStep = columns > 1 ? 0.125 : 0.13;
  const schoolBookAxes = Boolean(context.schoolBookAxes);
  const axisHeight = Number(context.axisHeight);
  const axisPlotHeight = Number(context.axisPlotHeight);
  const axisMarginTop = Number(context.axisMarginTop);
  const axisMarginBottom = Number(context.axisMarginBottom);
  const physicalAxisHeight = Number.isFinite(axisPlotHeight) && axisPlotHeight > 0 ? axisPlotHeight : axisHeight;
  const northOuterMargin = Number.isFinite(axisMarginTop) ? axisMarginTop : 0;
  const southOuterMargin = Number.isFinite(axisMarginBottom) ? axisMarginBottom : 0;
  const schoolBookNorthOffset = Number.isFinite(physicalAxisHeight) && physicalAxisHeight > 0 ? (northOuterMargin + 0.43) / physicalAxisHeight : 0.13;
  const schoolBookSouthOffset = Number.isFinite(physicalAxisHeight) && physicalAxisHeight > 0 ? (southOuterMargin + 0.6) / physicalAxisHeight : 0.18;
  const southTopY = schoolBookAxes ? -schoolBookSouthOffset : columns > 1 ? -0.35 : -0.31;
  const northTopY = schoolBookAxes ? 1 + schoolBookNorthOffset : columns > 1 ? 1.22 : 1.18;
  const centerX =
    columns > 1
      ? 0.113 + column * 0.369
      : 0.5;
  const y = side === "north" ? northTopY + row * rowStep : southTopY - row * rowStep;

  return {
    x0: centerX - sampleWidth * 0.5,
    x1: centerX + sampleWidth * 0.5,
    textX: centerX + sampleWidth * 0.75,
    y
  };
}

function datavisualizationEastOutsideLegendKey(options = {}, rawText = "", includeMatrixLayout = true) {
  const text = String(rawText || "").toLowerCase();
  const keys = ["north east outside", "south east outside", "east outside"];
  const matchedKey = keys.find((key) => options[key] || new RegExp(`(^|[,\\s])${key.replace(/\s+/g, "\\s+")}($|[,\\s])`).test(text));
  if (matchedKey) return matchedKey;
  return options.right || /^right\b/.test(text) || (includeMatrixLayout && datavisualizationLegendHasMatrixLayoutOptions(options)) ? "east outside" : "";
}

function datavisualizationLegendHasMatrixLayoutOptions(options = {}) {
  return Boolean(
    options.columns ||
      options.rows ||
      options["ideal number of columns"] ||
      options["ideal number of rows"] ||
      options["max columns"] ||
      options["max rows"] ||
      options["right then down"] ||
      options["right then up"] ||
      options["left then down"] ||
      options["left then up"] ||
      options["down then right"] ||
      options["down then left"] ||
      options["up then right"] ||
      options["up then left"]
  );
}

function datavisualizationEastOutsideLegendPlacement(key, options = {}, index = 0, legendCount = 1, plot = {}, context = {}) {
  const count = Math.max(1, Number(legendCount) || 1);
  const layout = datavisualizationLegendMatrixCell(options, index, count);
  const sampleWidth = 0.141;
  const columnStep = datavisualizationLegendMatrixColumnStep(context, plot);
  const axisHeight = Number(context.axisHeight);
  const nativeRowStep = Number.isFinite(axisHeight) && axisHeight > 0 ? parseDimension("1.1em", {}) / axisHeight : NaN;
  const rowStep = Number.isFinite(nativeRowStep) && nativeRowStep > 0 ? nativeRowStep : 0.125;
  let topY = 0.39 + ((layout.rows - 1) / 2) * rowStep;
  if (key.includes("north")) topY = 0.97;
  if (key.includes("south")) topY = -0.07 + (layout.rows - 1) * rowStep;
  const x0 = 1.105 + layout.column * columnStep;
  return {
    x0,
    x1: x0 + sampleWidth,
    textX: x0 + sampleWidth + 0.035,
    y: topY - layout.row * rowStep,
    physicalOutsideLegend: true,
    physicalColumnOffset: layout.column * columnStep
  };
}

function datavisualizationLegendMatrixColumnStep(context = {}, plot = {}) {
  const axisWidth = Number(context.axisWidth);
  if (!Number.isFinite(axisWidth) || axisWidth <= 0) return 0.665;
  const sampleWidth = parseDimension("2em", {});
  const textGap = parseDimension("0.5em", {});
  const columnSep = parseDimension(".8em", {});
  if (![sampleWidth, textGap, columnSep].every(Number.isFinite)) return 0.665;
  const labels = Array.isArray(context.legendLabels) && context.legendLabels.length ? context.legendLabels : [plot.legendLabel || ""];
  const labelWidth = Math.max(...labels.map((label) => datavisualizationLegendMatrixLabelWidth(label)));
  return (sampleWidth + textGap + labelWidth + columnSep) / axisWidth;
}

function datavisualizationLegendMatrixLabelWidth(label) {
  const text = stripTexForLength(label);
  return Math.max(0.17, text.length * 0.07);
}

function datavisualizationLegendMatrixCell(options = {}, index = 0, legendCount = 1) {
  const count = Math.max(1, Number(legendCount) || 1);
  const requestedColumns = datavisualizationLegendRequestedCount(options.columns || options["ideal number of columns"]);
  const requestedRows = datavisualizationLegendRequestedCount(options.rows || options["ideal number of rows"]);
  const maxColumns = datavisualizationLegendRequestedCount(options["max columns"]);
  const maxRows = datavisualizationLegendRequestedCount(options["max rows"]);
  const rightFirst = Boolean(options["right then down"] || options["right then up"] || options["left then down"] || options["left then up"]);
  const up = Boolean(options["right then up"] || options["left then up"] || options["up then right"] || options["up then left"]);
  const left = Boolean(options["left then down"] || options["left then up"] || options["down then left"] || options["up then left"]);
  const idealRows = requestedRows || maxRows;
  const idealColumns = requestedColumns || (idealRows ? Math.ceil(count / idealRows) : maxColumns || 1);
  let columns = Math.max(1, Math.min(count, idealColumns));
  if (maxColumns) columns = Math.min(columns, maxColumns);
  if (maxRows && Math.ceil(count / columns) > maxRows) {
    columns = Math.min(count, Math.ceil(count / maxRows));
    if (maxColumns) columns = Math.min(columns, maxColumns);
  }
  const rows = Math.max(1, Math.ceil(count / columns));
  let row;
  let column;
  if (rightFirst) {
    row = Math.floor(index / columns);
    column = index % columns;
  } else {
    const effectiveRows = requestedRows || rows;
    row = index % effectiveRows;
    column = Math.floor(index / effectiveRows);
  }
  if (up) row = rows - 1 - row;
  if (left) column = columns - 1 - column;
  return { row, column, rows, columns };
}

function datavisualizationLegendRequestedCount(value) {
  const count = Math.round(axisNumber(value, NaN));
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function datavisualizationWestOutsideLegendKey(options = {}, rawText = "") {
  const text = String(rawText || "").toLowerCase();
  const keys = ["north west outside", "south west outside", "west outside"];
  return keys.find((key) => options[key] || new RegExp(`(^|[,\\s])${key.replace(/\s+/g, "\\s+")}($|[,\\s])`).test(text)) || (options.left || /^left\b/.test(text) ? "west outside" : "");
}

function datavisualizationWestOutsideLegendPlacement(key, index = 0, legendCount = 1) {
  const count = Math.max(1, Number(legendCount) || 1);
  const rowStep = 0.125;
  const y = key.includes("north")
    ? 0.9 - index * rowStep
    : key.includes("south")
      ? 0.1 + (count - 1 - index) * rowStep
      : 0.39 + ((count - 1) / 2 - index) * rowStep;
  return {
    x0: -0.197,
    x1: -0.337,
    textX: -0.364,
    y,
    textLeftCalibrated: true
  };
}

function datavisualizationInsideLegendKey(options = {}, rawText = "") {
  const text = String(rawText || "").toLowerCase();
  const keys = [
    "north east inside",
    "south east inside",
    "north west inside",
    "south west inside",
    "east inside",
    "west inside",
    "north inside",
    "south inside"
  ];
  return keys.find((key) => options[key] || new RegExp(`(^|[,\\s])${key.replace(/\s+/g, "\\s+")}($|[,\\s])`).test(text)) || "";
}

function datavisualizationInsideLegendPlacement(key, options = {}, index = 0, legendCount = 1) {
  const count = Math.max(1, Number(legendCount) || 1);
  const horizontal = key === "north inside" || key === "south inside";
  const requestedRows = axisNumber(options.rows, horizontal ? 1 : count);
  const rows = Math.max(1, Math.min(count, Number.isFinite(requestedRows) ? Math.round(requestedRows) : horizontal ? 1 : count));
  const column = Math.floor(index / rows);
  const row = index % rows;
  const columns = Math.max(1, Math.ceil(count / rows));
  const textOnly = datavisualizationLegendTextOnlyFromOptions(options);
  const rowStep = textOnly ? 0.1135 : 0.125;
  const columnStep = textOnly ? 0.17 : 0.245;
  const sampleWidth = textOnly ? 0 : 0.12;
  const textGap = 0.035;
  const rightTextX = textOnly ? 0.88 : 0.83;
  const leftTextX = 0.09;
  const centeredStartX = 0.5 - ((columns - 1) * columnStep) / 2;

  const hasEast = key.includes("east");
  const hasWest = key.includes("west");
  const hasNorth = key.includes("north");
  const hasSouth = key.includes("south");
  const textX = hasEast
    ? rightTextX - (columns - 1 - column) * columnStep
    : hasWest
      ? leftTextX + column * columnStep
      : centeredStartX + column * columnStep;
  const southBaseY = textOnly ? 0.075 : 0.12;
  const y = hasNorth
    ? 0.9 - row * rowStep
    : hasSouth
      ? southBaseY + (rows - 1 - row) * rowStep
      : 0.5 + ((rows - 1) / 2 - row) * rowStep;

  return {
    x0: textX - textGap - sampleWidth,
    x1: textX - textGap,
    textX,
    y,
    inside: true
  };
}

function datavisualizationLegendTextOnlyFromOptions(options = {}) {
  const labelStyle = String(options["label style"] || "").toLowerCase();
  return Boolean(options["text only"] || labelStyle.includes("text only"));
}

function protectDatavisualizationOverlayText(text) {
  return String(text || "").replace(
    /\(\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*,\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*\)/g,
    "{(}$1,$2{)}"
  );
}

function pgfplotsAxisLoweringDependencies() {
  return {
    preparePgfplotsAxisOptions,
    parseAddplots,
    parseLegendEntries,
    isSurfacePlot,
    parsePgfplotsDeclaredFunctions,
    parsePgfplotsColormaps,
    optionValues,
    renderTernaryAxisAsTikz,
    computeAxisRanges,
    renderAddplot,
    renderCurrentPlotCoordinates,
    renderAxisOverlayStatements,
    renderAxis3DBox,
    renderAxis3DBoxForeground,
    renderAxis3DColorbar,
    renderAxis3DGrid,
    renderAxis3DTicks,
    renderAxisLabels3D
  };
}

function preparePgfplotsAxisOptions(axisOptions, options = {}) {
  // Axis-local `every axis/.append style` declarations are themselves style
  // definitions. Materialize them before expanding the axis so their font and
  // role defaults flow to ticks, labels, legends, and plots just like a
  // preceding \pgfplotsset declaration.
  const baseStyles = options.pgfplotsStyleDefinitions || {};
  const styles = {
    ...baseStyles,
    ...styleDefinitionsFromOptions(axisOptions, baseStyles)
  };
  const globalDefaults = pgfplotsGlobalAxisDefaults(options.pgfplotsStyleOptions);
  const inherited = { ...globalDefaults, ...axisOptions };
  const raw = styles["every axis"] ? { "every axis": true, ...inherited } : inherited;
  const expanded = expandPgfplotsNamedOptions(raw, styles);
  return normalizePgfplotsAxisLineOptions(
    createAxisOptions(applyPgfplotsAxisRoleStyles(expanded, styles))
  );
}

function pgfplotsGlobalAxisDefaults(options = {}) {
  const defaults = {};
  for (const [key, value] of Object.entries(options || {})) {
    if (/\/\.(?:style|append\s+style|prefix\s+style|style\s+args|default|code|code\s+args)$/.test(key)) continue;
    if (key === "compat" || key === "declare function" || key === "colormap") continue;
    defaults[key] = value;
  }
  return defaults;
}

function applyPgfplotsAxisRoleStyles(axisOptions = {}, styles = {}) {
  const merged = { ...axisOptions };
  const mappings = [
    ["every tick label", ["tick label style"]],
    ["every axis label", ["x label style", "y label style", "z label style"]],
    ["every axis title", ["title style"]]
  ];
  for (const [styleName, targets] of mappings) {
    const style = styles[styleName];
    if (!style || !Object.keys(style).length) continue;
    for (const target of targets) {
      const local = merged[target];
      const localStyle = local === undefined || local === true ? {} : parseOptions(String(local));
      const combined = { ...style, ...localStyle };
      merged[target] = serializePgfplotsStyleOptions(combined);
    }
  }
  return merged;
}

function serializePgfplotsStyleOptions(options = {}) {
  return Object.entries(options)
    .filter(([key]) => !String(key).startsWith("__"))
    .map(([key, value]) => {
      if (value === true || value === undefined || value === null || value === "") return key;
      return `${key}={${String(value)}}`;
    })
    .join(",");
}

function normalizePgfplotsAxisLineOptions(options = {}) {
  if (options["axis lines"] !== undefined || options.axis !== undefined) return options;
  const xLine = normalizePgfplotsSingleAxisLine(options["axis x line"] ?? options["axis x line*"]);
  const yLine = normalizePgfplotsSingleAxisLine(options["axis y line"] ?? options["axis y line*"]);
  if (xLine === "middle" && yLine === "middle") {
    return { ...options, "axis lines": "middle" };
  }
  if (xLine === "center" && yLine === "center") {
    return { ...options, "axis lines": "center" };
  }
  return options;
}

function normalizePgfplotsSingleAxisLine(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "center" || text === "middle") return text;
  return text;
}

function findStatementEnd(source, start) {
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\" && index + 1 < source.length) {
      index += 1;
      continue;
    }
    if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
    else if (char === "[") bracketDepth += 1;
    else if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === "(") parenDepth += 1;
    else if (char === ")") parenDepth = Math.max(0, parenDepth - 1);
    else if (char === ";" && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) return index;
  }
  return -1;
}

function splitBracedList(raw) {
  const text = stripBalancedOuterBracesForList(String(raw || "").trim());
  if (!text) return [];
  if (text === "\\empty" || text.toLowerCase() === "empty") return [];
  return splitTopLevel(text, ",").map((part) => stripBalancedOuterBracesForList(part.trim()));
}

function stripBalancedOuterBracesForList(raw) {
  const text = String(raw || "").trim();
  if (!text.startsWith("{") || !text.endsWith("}")) return text;
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0 && index < text.length - 1) return text;
    }
    if (depth < 0) return text;
  }
  return depth === 0 ? text.slice(1, -1).trim() : text;
}

function uniqueAxisValues(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    const key = formatAxisNumber(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function renderTernaryAxisAsTikz(axisOptions, addplots) {
  const geometry = createTernaryAxisGeometry(axisOptions);
  const metaRange = ternaryMetaRange(addplots);
  const commands = [
    renderTernaryBounds(geometry),
    ...renderTernaryPatches(addplots, geometry, metaRange),
    ...renderTernaryGrid(geometry),
    renderTernaryFrame(geometry),
    ...renderTernaryTicks(geometry),
    ...renderTernaryLabels(axisOptions, geometry),
    ...renderTernaryColorbar(axisOptions, geometry, metaRange)
  ];
  return `\n${commands.filter(Boolean).join("\n")}\n`;
}

function createTernaryAxisGeometry(axisOptions = {}) {
  const scale = axisScaleFactor(axisOptions.scale);
  const fallbackWidth = parseAxisDimension(axisOptions.width, PGFPLOTS_DEFAULT_AXIS_WIDTH) * scale;
  const width = Math.max(3.5, fallbackWidth * (axisOptions.colorbar ? 0.72 : 0.82));
  const height = width * Math.sqrt(3) / 2;
  const origin = parseAxisAt(axisOptions.at);
  const vertices = {
    x: { x: origin.x + width / 2, y: origin.y + height },
    y: { x: origin.x, y: origin.y },
    z: { x: origin.x + width, y: origin.y }
  };
  const margin = {
    left: 0.92,
    right: axisOptions.colorbar ? 1.85 : 0.92,
    bottom: 0.74,
    top: 0.58
  };
  const map = (point) => {
    const x = Number(point.x);
    const y = Number(point.y);
    const z = Number(point.z);
    const sum = Number.isFinite(x + y + z) && Math.abs(x + y + z) > 1e-12 ? x + y + z : 1;
    return {
      x: (x * vertices.x.x + y * vertices.y.x + z * vertices.z.x) / sum,
      y: (x * vertices.x.y + y * vertices.y.y + z * vertices.z.y) / sum
    };
  };
  return { origin, width, height, vertices, margin, map };
}

function renderTernaryBounds(geometry) {
  const colorbarRight = geometry.vertices.z.x + 1.45;
  const bounds = {
    minX: geometry.vertices.y.x - geometry.margin.left,
    maxX: Math.max(geometry.vertices.z.x + geometry.margin.right, colorbarRight),
    minY: geometry.vertices.y.y - geometry.margin.bottom,
    maxY: geometry.vertices.x.y + geometry.margin.top
  };
  return `\\draw[axis bounds, draw=none, fill=none] ${formatAxisPoint({ x: bounds.minX, y: bounds.minY })} -- ${formatAxisPoint({
    x: bounds.maxX,
    y: bounds.minY
  })} -- ${formatAxisPoint({ x: bounds.maxX, y: bounds.maxY })} -- ${formatAxisPoint({ x: bounds.minX, y: bounds.maxY })} -- cycle;`;
}

function renderTernaryPatches(addplots, geometry, metaRange) {
  const commands = [];
  addplots.forEach((plot, plotIndex) => {
    if (plot.type !== "coordinates") return;
    const points = plot.points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z));
    const triangles = ternaryPatchTriangles(points);
    const opacity = axisOpacity(plot.options.opacity ?? 1);
    const shader = String(plot.options.shader || "").trim().toLowerCase();
    const subdivisions = shader === "interp" ? 12 : 1;
    for (const triangle of triangles) {
      const projected = triangle.map((point) => ({
        ...point,
        meta: ternaryPointMeta(point),
        color: pgfplotsTernaryRgb(ternaryPointMeta(point), metaRange),
        projected: geometry.map(point)
      }));
      const smallTriangles = subdivideTernaryTriangle(projected, subdivisions);
      for (const small of smallTriangles) {
        const fill = small.some((point) => Array.isArray(point.color))
          ? rgbArrayToCss(averageRgb(small.map((point) => point.color)))
          : pgfplotsTernaryColor(small.reduce((sum, point) => sum + point.meta, 0) / small.length, metaRange, plotIndex);
        const chain = small.map((point) => formatAxisPoint(point.projected)).join(" -- ");
        commands.push(`\\draw[ternary patch, draw=none, fill=${fill}, opacity=${opacity}, line width=0pt] ${chain} -- cycle;`);
      }
    }
  });
  return commands;
}

function ternaryPatchTriangles(points) {
  if (points.length < 3) return [];
  if (points.length % 3 === 0) {
    const triangles = [];
    for (let index = 0; index + 2 < points.length; index += 3) {
      triangles.push([points[index], points[index + 1], points[index + 2]]);
    }
    return triangles;
  }
  const triangles = [];
  for (let index = 1; index + 1 < points.length; index += 1) {
    triangles.push([points[0], points[index], points[index + 1]]);
  }
  return triangles;
}

function subdivideTernaryTriangle(vertices, subdivisions) {
  const n = Math.max(1, Math.round(subdivisions));
  if (n === 1) return [vertices];
  const result = [];
  const sample = (i, j) => {
    const a = i / n;
    const b = j / n;
    const c = 1 - a - b;
    return interpolateTernaryVertex(vertices, a, b, c);
  };
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n - i; j += 1) {
      const p0 = sample(i, j);
      const p1 = sample(i + 1, j);
      const p2 = sample(i, j + 1);
      result.push([p0, p1, p2]);
      if (j < n - i - 1) {
        const p3 = sample(i + 1, j + 1);
        result.push([p1, p3, p2]);
      }
    }
  }
  return result;
}

function interpolateTernaryVertex(vertices, a, b, c) {
  const [v0, v1, v2] = vertices;
  return {
    x: v0.x * a + v1.x * b + v2.x * c,
    y: v0.y * a + v1.y * b + v2.y * c,
    z: v0.z * a + v1.z * b + v2.z * c,
    meta: v0.meta * a + v1.meta * b + v2.meta * c,
    color: Array.isArray(v0.color) && Array.isArray(v1.color) && Array.isArray(v2.color)
      ? v0.color.map((channel, index) => channel * a + v1.color[index] * b + v2.color[index] * c)
      : undefined,
    projected: {
      x: v0.projected.x * a + v1.projected.x * b + v2.projected.x * c,
      y: v0.projected.y * a + v1.projected.y * b + v2.projected.y * c
    }
  };
}

function ternaryMetaRange(addplots) {
  const values = addplots
    .flatMap((plot) => plot.points || [])
    .map(ternaryPointMeta)
    .filter(Number.isFinite);
  if (!values.length) return { min: 0, max: 1 };
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  return { min, max };
}

function ternaryPointMeta(point) {
  if (Number.isFinite(point?.meta)) return point.meta;
  if (Number.isFinite(point?.z)) return point.z;
  return 0;
}

function pgfplotsTernaryColor(value, range, plotIndex = 0) {
  const rgb = pgfplotsTernaryRgb(value, range);
  return rgb ? rgbArrayToCss(rgb) : selectPlotColor({}, plotIndex);
}

function pgfplotsTernaryRgb(value, range) {
  const span = range.max - range.min || 1;
  const t = Math.max(0, Math.min(1, (value - range.min) / span));
  const stops = [
    { t: 0, color: [0, 0, 255] },
    { t: 0.25, color: [191, 191, 64] },
    { t: 0.5, color: [255, 255, 0] },
    { t: 0.75, color: [255, 128, 0] },
    { t: 1, color: [255, 0, 0] }
  ];
  for (let index = 1; index < stops.length; index += 1) {
    if (t <= stops[index].t) {
      const previous = stops[index - 1];
      const next = stops[index];
      const local = (t - previous.t) / (next.t - previous.t || 1);
      return previous.color.map((channel, channelIndex) => channel + (next.color[channelIndex] - channel) * local);
    }
  }
  return stops.at(-1).color;
}

function averageRgb(colors) {
  const valid = colors.filter(Array.isArray);
  if (!valid.length) return [0, 0, 0];
  return [0, 1, 2].map((index) => valid.reduce((sum, color) => sum + color[index], 0) / valid.length);
}

function rgbArrayToCss(rgb) {
  return `rgb(${rgb.map((channel) => Math.max(0, Math.min(255, Math.round(channel)))).join(",")})`;
}

function renderTernaryGrid(geometry) {
  const commands = [];
  const gridValues = [0.2, 0.4, 0.6, 0.8];
  for (const value of gridValues) {
    commands.push(renderTernaryGridLine(geometry, { x: value, y: 0, z: 1 - value }, { x: value, y: 1 - value, z: 0 }));
    commands.push(renderTernaryGridLine(geometry, { x: 0, y: value, z: 1 - value }, { x: 1 - value, y: value, z: 0 }));
    commands.push(renderTernaryGridLine(geometry, { x: 0, y: 1 - value, z: value }, { x: 1 - value, y: 0, z: value }));
  }
  return commands;
}

function renderTernaryGridLine(geometry, from, to) {
  return `\\draw[ternary grid, gray!42, line width=0.22pt] ${formatAxisPoint(geometry.map(from))} -- ${formatAxisPoint(geometry.map(to))};`;
}

function renderTernaryFrame(geometry) {
  return `\\draw[ternary frame, black, line width=0.38pt] ${formatAxisPoint(geometry.vertices.y)} -- ${formatAxisPoint(geometry.vertices.z)} -- ${formatAxisPoint(geometry.vertices.x)} -- cycle;`;
}

function renderTernaryTicks(geometry) {
  const commands = [];
  const tickLength = 0.08;
  const values = [0, 0.2, 0.4, 0.6, 0.8, 1];
  for (const value of values) {
    const label = String(Math.round(value * 100));
    const bottom = geometry.map({ x: 0, y: 1 - value, z: value });
    commands.push(`\\draw[axis tick, black, line width=0.2pt] ${formatAxisPoint(bottom)} -- ${formatAxisPoint(offsetPoint(bottom, 0, -tickLength))};`);
    commands.push(`\\node[axis tick label, anchor=north, font=\\scriptsize] at ${formatAxisPoint(offsetPoint(bottom, 0, -0.14))} {${label}};`);

    const left = geometry.map({ x: 1 - value, y: value, z: 0 });
    commands.push(`\\draw[axis tick, black, line width=0.2pt] ${formatAxisPoint(left)} -- ${formatAxisPoint(offsetPoint(left, -tickLength * 0.8, 0.04))};`);
    commands.push(`\\node[axis tick label, anchor=east, font=\\scriptsize] at ${formatAxisPoint(offsetPoint(left, -0.13, 0.06))} {${label}};`);

    const right = geometry.map({ x: value, y: 0, z: 1 - value });
    commands.push(`\\draw[axis tick, black, line width=0.2pt] ${formatAxisPoint(right)} -- ${formatAxisPoint(offsetPoint(right, tickLength * 0.8, 0.04))};`);
    commands.push(`\\node[axis tick label, anchor=west, font=\\scriptsize] at ${formatAxisPoint(offsetPoint(right, 0.13, 0.06))} {${label}};`);
  }
  return commands;
}

function renderTernaryLabels(axisOptions, geometry) {
  const commands = [];
  const xlabel = ternaryAxisLabel(axisOptions.xlabel, "x");
  const ylabel = ternaryAxisLabel(axisOptions.ylabel, "y");
  const zlabel = ternaryAxisLabel(axisOptions.zlabel, "z");
  if (xlabel) {
    const point = geometry.map({ x: 0.55, y: 0, z: 0.45 });
    commands.push(`\\node[axis label, anchor=west] at ${formatAxisPoint(offsetPoint(point, 0.48, 0.05))} {${xlabel}};`);
  }
  if (ylabel) {
    const point = geometry.map({ x: 0.55, y: 0.45, z: 0 });
    commands.push(`\\node[axis label, anchor=east] at ${formatAxisPoint(offsetPoint(point, -0.48, 0.05))} {${ylabel}};`);
  }
  if (zlabel) {
    const point = geometry.map({ x: 0, y: 0.5, z: 0.5 });
    commands.push(`\\node[axis label, anchor=north] at ${formatAxisPoint(offsetPoint(point, 0, -0.43))} {${zlabel}};`);
  }
  if (axisOptions.title) {
    commands.push(`\\node[axis label, anchor=south] at ${formatAxisPoint(offsetPoint(geometry.vertices.x, 0, 0.36))} {${axisOptions.title}};`);
  }
  return commands;
}

function ternaryAxisLabel(value, fallback) {
  if (value === undefined || value === null || value === false) return "";
  if (value === true || String(value).trim() === "") return fallback;
  return stripOuterBracesText(value);
}

function renderTernaryColorbar(axisOptions, geometry, metaRange) {
  if (!axisOptions.colorbar) return [];
  const commands = [];
  const x0 = geometry.vertices.z.x + 0.62;
  const x1 = x0 + 0.28;
  const steps = 24;
  for (let index = 0; index < steps; index += 1) {
    const t0 = index / steps;
    const t1 = (index + 1) / steps;
    const y0 = geometry.origin.y + geometry.height * t0;
    const y1 = geometry.origin.y + geometry.height * t1;
    const meta = metaRange.min + (metaRange.max - metaRange.min) * ((t0 + t1) / 2);
    const fill = pgfplotsTernaryColor(meta, metaRange);
    commands.push(`\\draw[ternary colorbar, draw=none, fill=${fill}] (${roundTikzNumber(x0)},${roundTikzNumber(y0)}) -- (${roundTikzNumber(x1)},${roundTikzNumber(y0)}) -- (${roundTikzNumber(x1)},${roundTikzNumber(y1)}) -- (${roundTikzNumber(x0)},${roundTikzNumber(y1)}) -- cycle;`);
  }
  commands.push(`\\draw[ternary colorbar frame, black, line width=0.28pt] (${roundTikzNumber(x0)},${roundTikzNumber(geometry.origin.y)}) rectangle (${roundTikzNumber(x1)},${roundTikzNumber(geometry.origin.y + geometry.height)});`);
  for (const value of axisMajorTickValues(metaRange.min, metaRange.max, 6)) {
    const t = (value - metaRange.min) / (metaRange.max - metaRange.min || 1);
    const y = geometry.origin.y + geometry.height * t;
    commands.push(`\\draw[axis tick, black, line width=0.2pt] (${roundTikzNumber(x1)},${roundTikzNumber(y)}) -- (${roundTikzNumber(x1 + 0.08)},${roundTikzNumber(y)});`);
    commands.push(`\\node[axis tick label, anchor=west, font=\\scriptsize] at (${roundTikzNumber(x1 + 0.13)},${roundTikzNumber(y)}) {${formatAxisNumber(value)}};`);
  }
  return commands;
}

function axisOpacity(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
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

function joinOptions(parts) {
  return parts.filter(Boolean).join(", ");
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

function formatAxisTickLabel(value) {
  const label = formatAxisNumber(value);
  const unsigned = label.startsWith("-") ? label.slice(1) : label;
  const grouped = /^\d{4,}$/.test(unsigned) ? unsigned.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : unsigned;
  return label.startsWith("-") ? `−${grouped}` : grouped;
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
