import { evaluateMath, parseDimension } from "./math.js";
import { applyPreprocessExtensions } from "./extensions/index.js";
import { normalizeColor, parseOptions, splitTopLevel, styleDefinitionsFromOptions } from "./options.js";
import { collectTikzLibraries, stripTikzLibraryDeclarations } from "./tikz-libraries.js";
import { collectTexPackages } from "./tex-packages.js";
import {
  TIKZ_AXIS_CONTAINER_MARGIN,
  TIKZ_HIDDEN_AXIS_CONTAINER_MARGIN,
  TIKZ_MIDDLE_AXIS_CONTAINER_MARGIN,
  TIKZ_PGFPLOTS_MIDDLE_AXIS_RESERVED_X,
  TIKZ_PGFPLOTS_MIDDLE_AXIS_RESERVED_Y
} from "./tikz-metrics.js";
import { fontScaleFromTikzFont } from "./tex-text.js";

const BUILTIN_MACROS = new Set(["draw", "path", "fill", "filldraw", "node", "coordinate", "foreach"]);
const PGFPLOTS_DEFAULT_AXIS_WIDTH = parseDimension("240pt", {});
const PGFPLOTS_DEFAULT_AXIS_HEIGHT = parseDimension("207pt", {});
const PGFPLOTS_DEFAULT_AXIS_ASPECT = PGFPLOTS_DEFAULT_AXIS_WIDTH / PGFPLOTS_DEFAULT_AXIS_HEIGHT;
const PGFPLOTS_AXIS_LABEL_CONST = parseDimension("45pt", {});
const PGFPLOTS_DEFAULT_ENLARGE_LIMITS = 0.1;
const PGFPLOTS_DEFAULT_FUNCTION_DOMAIN = "-5:5";

// Claude: 这些宏改由 KaTeX 用原生 \overbrace/\underbrace 渲染（见 renderer-svg.js 的 KATEX_MACROS）。
// 文档里它们通常被 \newcommand 成 \makebox[0pt][l]{$...$} 这种「零宽叠加盒子」，KaTeX 不认这类
// LaTeX 盒子原语，硬展开会导致整块数学渲染失败、退化成把原始源码当文本逐行堆出来。
// 所以这里在收集宏定义时「吃掉」它们的 \newcommand 定义但**不做 JS 展开**，让 \overmat{..}{..}{..}
// 原样保留到数学块里，交给 KaTeX 的 macros 选项处理。
const KATEX_DELEGATED_MACROS = new Set(["overmat", "undermat"]);
const EXTENSION_DELEGATED_MACROS = new Set(["networkLayer"]);

function isDelegatedMacro(name) {
  return KATEX_DELEGATED_MACROS.has(name) || EXTENSION_DELEGATED_MACROS.has(name);
}

export function preprocessTikzSource(source, options = {}) {
  const diagnostics = [];
  let expanded = stripTexComments(String(source));
  expanded = expandTimelineEnvironments(expanded, diagnostics);
  expanded = expandChronologyEnvironments(expanded, diagnostics);
  expanded = expandEventPeriodTimelineMacros(expanded, diagnostics);
  const packages = collectTexPackages(expanded);
  const libraries = collectTikzLibraries(expanded);
  const pgfplotsLibraries = collectPgfplotsLibraries(expanded);
  const pgfplotsSet = collectPgfplotsSetOptions(expanded);
  expanded = pgfplotsSet.source;
  expanded = stripTikzLibraryDeclarations(expanded);
  expanded = stripPgfLibraryDeclarations(expanded);
  const colorResult = collectColorDefinitions(expanded);
  expanded = replaceDefinedColorUses(colorResult.source, colorResult.colors);
  const macroResult = expandTexLiteMacros(expanded, diagnostics, options);
  expanded = macroResult.source;
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
  expanded = replacePgfplotstableReferences(tableResult.source, tableResult.tables);
  const pgfplotsRuntimeOptions = {
    ...withFilecontentsTableResolver(options, filecontentsResult.tables),
    ...createPgfplotsStyleContext(expanded, pgfplotsSet.options)
  };
  expanded = expandTkzGraphMacros(expanded);
  expanded = expandTikzScopeEnvironments(expanded, diagnostics);
  expanded = expandTransparentEnvironment(expanded, "pgfonlayer", diagnostics);
  expanded = expandPgfganttCharts(expanded, diagnostics);
  expanded = expandPgfplotsInvokeForeach(expanded, diagnostics);
  expanded = expandPgfplotsGroupplots(expanded, diagnostics, pgfplotsRuntimeOptions);
  expanded = expandPgfplotsAxes(expanded, diagnostics, pgfplotsRuntimeOptions);
  expanded = normalizeTikzPictureAliases(expanded);
  expanded = stripTexDocumentShell(expanded);
  return {
    source: expanded,
    diagnostics,
    libraries,
    packages,
    pgfplotsLibraries,
    pgfplotsOptions: pgfplotsSet.options
  };
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

function stripPgfLibraryDeclarations(source) {
  return String(source)
    .replace(/\\usepgflibrary(?:\[[^\]]*\])?\{[^{}]*\}\s*;?/g, "")
    .replace(/\\usepgfplotslibrary(?:\[[^\]]*\])?\{[^{}]*\}\s*;?/g, "");
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

const PGFPLOTS_LIBRARY_SUPPORT = {
  groupplots: {
    status: "builtin",
    implementedBy: "src/preprocess.js:expandPgfplotsGroupplots",
    features: ["groupplot environment", "\\nextgroupplot", "group size", "horizontal/vertical sep"]
  }
};

function collectPgfplotsLibraries(source) {
  const libraries = [];
  const pattern = /\\usepgfplotslibrary(?:\[[^\]]*\])?\{([^{}]*)\}/g;
  let match;
  while ((match = pattern.exec(String(source)))) {
    for (const rawName of splitTopLevel(match[1], ",")) {
      const name = rawName.trim();
      if (!name || libraries.some((library) => library.name === name)) continue;
      const support = PGFPLOTS_LIBRARY_SUPPORT[name];
      libraries.push({
        name,
        status: support?.status || "unsupported",
        implementedBy: support?.implementedBy || null,
        features: support ? [...support.features] : []
      });
    }
  }
  return libraries;
}

function collectPgfplotsSetOptions(source) {
  const options = {};
  let output = "";
  let index = 0;
  while (index < source.length) {
    if (!source.startsWith("\\pgfplotsset", index)) {
      output += source[index];
      index += 1;
      continue;
    }
    let cursor = skipWhitespace(source, index + "\\pgfplotsset".length);
    const body = extractBalanced(source, cursor, "{", "}");
    if (!body) {
      output += source[index];
      index += 1;
      continue;
    }
    Object.assign(options, parseOptions(body.content));
    index = body.end;
    if (source[index] === ";") index += 1;
  }
  return { source: output, options };
}

function createPgfplotsStyleContext(source, pgfplotsSetOptions = {}) {
  const tikzsetOptions = collectTikzsetPgfplotsOptions(source);
  const tikzpictureOptions = collectTikzpicturePgfplotsOptions(source);
  const styleOptions = mergeOptionMaps(mergeOptionMaps(pgfplotsSetOptions, tikzsetOptions), tikzpictureOptions);
  return {
    pgfplotsStyleOptions: styleOptions,
    pgfplotsStyleDefinitions: styleDefinitionsFromOptions(styleOptions),
    pgfplotsDeclareFunctions: optionValues(styleOptions["declare function"])
  };
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
    options = mergeOptionMaps(options, parseOptions(body.content));
    index = body.end;
  }
  return options;
}

function mergeOptionMaps(target = {}, source = {}) {
  const merged = { ...target };
  for (const [key, value] of Object.entries(source || {})) {
    if (key === "declare function" && Object.hasOwn(merged, key)) {
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
    .replace(/\\end\{document\}\s*/g, "");
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
  return null;
}

function replaceDefinedColorUses(source, colors) {
  if (!colors.size) return source;
  let output = "";
  let index = 0;
  while (index < source.length) {
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
    if (source.startsWith("\\def\\", index)) {
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
    output += renderGroupplotAsAxes(rawOptions.raw, source.slice(cursor, endIndex), options);
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

function renderGroupplotAsAxes(rawOptions, body, options) {
  const baseOptions = parseOptions(rawOptions);
  const groupOptions = parseOptions(baseOptions["group style"] || "");
  delete baseOptions["group style"];
  const size = parseGroupplotSize(groupOptions["group size"]);
  const axisWidth = parseAxisDimension(baseOptions.width, 5);
  const axisHeight = parseAxisDimension(baseOptions.height, 4);
  const horizontalSep = parseDimension(groupOptions["horizontal sep"] || "1cm", {});
  const verticalSep = parseDimension(groupOptions["vertical sep"] || "1cm", {});
  const plots = parseNextGroupplots(body);
  return plots
    .map((plot, index) => {
      const column = index % size.columns;
      const row = Math.floor(index / size.columns);
      const axisOptions = {
        ...baseOptions,
        ...plot.options,
        at: `(${roundTikzNumber(column * (axisWidth + horizontalSep))}cm,${roundTikzNumber(-row * (axisHeight + verticalSep))}cm)`
      };
      return `\\begin{axis}[${formatPgfplotsOptionList(axisOptions)}]\n${plot.body}\n\\end{axis}`;
    })
    .join("\n");
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
  const titleHeight = Number(options["title height"] ?? 0.6) || 0.6;
  const barHeight = Number(options["bar height"] ?? 0.4) || 0.4;
  const groupHeight = Number(options["group height"] ?? 0.4) || 0.4;
  const groupTopShift = Number(options["group top shift"] ?? 0.3) || 0.3;
  const inlineChart = options.inline === true || String(options.inline || "").trim() === "true";
  const drawVgrid = options.vgrid === true || (options.vgrid !== undefined && options.vgrid !== false);
  const drawHgrid = options.hgrid === true || (options.hgrid !== undefined && options.hgrid !== false);
  const commands = [];
  const totalSlots = Math.max(1, end - start + 1);
  const entries = parseGanttCommands(body);
  const rowCount = Math.max(1, ...entries.map((entry) => entry.rowIndex + 1));
  const titleRows = new Set(entries.filter((entry) => entry.command === "gantttitle").map((entry) => entry.rowIndex));
  const rowHeights = Array.from({ length: rowCount }, (_unused, rowIndex) => (titleRows.has(rowIndex) ? yUnitTitle : yUnitChart));
  const rowTops = [];
  let chartHeight = 0;
  for (const rowHeight of rowHeights) {
    rowTops.push(-chartHeight);
    chartHeight += rowHeight;
  }
  const chartWidth = totalSlots * xUnit;
  commands.push(`\\draw[draw=black!45,fill=white,line width=0.25pt] (0,0) rectangle (${roundTikzNumber(chartWidth)},${roundTikzNumber(-chartHeight)});`);
  if (drawVgrid) {
    for (let slot = 1; slot < totalSlots; slot += 1) {
      const x = slot * xUnit;
      commands.push(`\\draw[gray!35,line width=0.2pt] (${roundTikzNumber(x)},0) -- (${roundTikzNumber(x)},${roundTikzNumber(-chartHeight)});`);
    }
  }
  if (drawHgrid) {
    for (let rowIndex = 1; rowIndex < rowCount; rowIndex += 1) {
      const y = rowTops[rowIndex];
      commands.push(`\\draw[gray!35,line width=0.2pt] (0,${roundTikzNumber(y)}) -- (${roundTikzNumber(chartWidth)},${roundTikzNumber(y)});`);
    }
  }
  const titleSlots = new Map();
  entries.forEach((row) => {
    const rowIndex = row.rowIndex;
    const rowTop = rowTops[rowIndex] ?? 0;
    const rowHeight = rowHeights[rowIndex] ?? yUnitChart;
    const top = rowTop;
    const bottom = top - rowHeight;
    const midY = (top + bottom) / 2;
    if (row.command === "gantttitle") {
      const span = Math.max(1, Number(row.args[1]) || totalSlots);
      const slot = titleSlots.get(rowIndex) || 0;
      const x0 = Math.min(totalSlots, slot) * xUnit;
      const x1 = Math.min(totalSlots, slot + span) * xUnit;
      titleSlots.set(rowIndex, slot + span);
      const titleBottom = top - titleHeight * yUnitTitle;
      commands.push(`\\draw[fill=black!8,draw=black,line width=0.3pt] (${roundTikzNumber(x0)},${roundTikzNumber(top)}) rectangle (${roundTikzNumber(x1)},${roundTikzNumber(bottom)});`);
      commands.push(`\\node[font=\\scriptsize] at (${roundTikzNumber((x0 + x1) / 2)},${roundTikzNumber((top + titleBottom) / 2)}) {${row.args[0] || ""}};`);
      return;
    }
    if (row.command === "ganttbar" || row.command === "ganttgroup") {
      const from = Number(row.args[1]);
      const to = Number(row.args[2]);
      const x0 = Math.max(0, (Number.isFinite(from) ? from - start : 0) * xUnit);
      const x1 = Math.max(x0 + xUnit * 0.25, ((Number.isFinite(to) ? to - start + 1 : totalSlots) * xUnit));
      const rowInline = inlineChart || row.options.inline === true || String(row.options.inline || "").trim() === "true";
      const fill = ganttElementFill(row, row.command === "ganttgroup" ? "black" : "white");
      if (row.command === "ganttgroup") {
        const y = top - groupTopShift * yUnitChart;
        const h = groupHeight * yUnitChart;
        commands.push(`\\draw[fill=${fill},draw=black,line width=0.35pt] (${roundTikzNumber(x0)},${roundTikzNumber(y)}) rectangle (${roundTikzNumber(x1)},${roundTikzNumber(y - h)});`);
        const labelX = rowInline ? (x0 + x1) / 2 : -0.15;
        const anchor = rowInline ? "center" : "east";
        commands.push(`\\node[anchor=${anchor},font=\\scriptsize\\bfseries] at (${roundTikzNumber(labelX)},${roundTikzNumber(y - h / 2)}) {${row.args[0] || ""}};`);
        return;
      }
      const yUpper = top - 0.3 * yUnitChart;
      const yLower = yUpper - barHeight * yUnitChart;
      commands.push(`\\draw[fill=${fill},draw=black,line width=0.35pt] (${roundTikzNumber(x0)},${roundTikzNumber(yUpper)}) rectangle (${roundTikzNumber(x1)},${roundTikzNumber(yLower)});`);
      const labelX = rowInline ? (x0 + x1) / 2 : -0.15;
      const labelY = (yUpper + yLower) / 2;
      const anchor = rowInline ? "center" : "east";
      commands.push(`\\node[anchor=${anchor},font=\\scriptsize] at (${roundTikzNumber(labelX)},${roundTikzNumber(labelY)}) {${row.args[0] || ""}};`);
      return;
    }
    if (row.command === "ganttmilestone") {
      const at = Number(row.args[1]);
      const x = Math.max(0, (Number.isFinite(at) ? at - start + 0.5 : 0.5) * xUnit);
      const size = Math.min(xUnit, yUnitChart) * 0.28;
      commands.push(`\\draw[fill=orange!45,draw=black,line width=0.35pt] (${roundTikzNumber(x)},${roundTikzNumber(midY + size)}) -- (${roundTikzNumber(x + size)},${roundTikzNumber(midY)}) -- (${roundTikzNumber(x)},${roundTikzNumber(midY - size)}) -- (${roundTikzNumber(x - size)},${roundTikzNumber(midY)}) -- cycle;`);
      const rowInline = inlineChart || row.options.inline === true || String(row.options.inline || "").trim() === "true";
      const labelX = rowInline ? x + size * 1.4 : -0.15;
      const anchor = rowInline ? "west" : "east";
      commands.push(`\\node[anchor=${anchor},font=\\scriptsize] at (${roundTikzNumber(labelX)},${roundTikzNumber(midY - size * 1.15)}) {${row.args[0] || ""}};`);
    }
  });
  return `\\begin{tikzpicture}\n${commands.join("\n")}\n\\end{tikzpicture}`;
}

function parseGanttCommands(body) {
  const rows = [];
  let index = 0;
  const pattern = /\\(gantttitle|ganttbar|ganttgroup|ganttmilestone)\b/g;
  let rowIndex = 0;
  let match;
  while ((match = pattern.exec(body))) {
    const between = body.slice(index, match.index);
    if (/\\\\/.test(between) && rows.length) rowIndex += 1;
    let cursor = match.index + match[0].length;
    const parsedOptions = parseOptionalOptions(body, cursor);
    cursor = parsedOptions.end;
    const args = [];
    while (args.length < 3) {
      cursor = skipWhitespace(body, cursor);
      const arg = extractBalanced(body, cursor, "{", "}");
      if (!arg) break;
      args.push(arg.content.trim());
      cursor = arg.end;
    }
    rows.push({ command: match[1], options: parseOptions(parsedOptions.raw), args, rowIndex });
    index = cursor;
    pattern.lastIndex = Math.max(pattern.lastIndex, index);
  }
  return rows;
}

function ganttElementFill(row, fallback) {
  const styleKey = row.command === "ganttgroup" ? "group/.append style" : "bar/.append style";
  const directKey = row.command === "ganttgroup" ? "group" : "bar";
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

function expandPgfplotsAxes(source, diagnostics, options) {
  let output = "";
  let index = 0;
  while (index < source.length) {
    const axisEnvironment = findNextPgfplotsEnvironment(source, index);
    if (!axisEnvironment) {
      output += source.slice(index);
      break;
    }
    output += source.slice(index, axisEnvironment.beginIndex);
    let cursor = axisEnvironment.beginIndex + axisEnvironment.begin.length;
    const axisOptions = parseOptionalOptions(source, cursor);
    cursor = axisOptions.end;
    const endIndex = source.indexOf(axisEnvironment.end, cursor);
    if (endIndex === -1) {
      diagnostics.push({ severity: "warning", message: `Unclosed pgfplots ${axisEnvironment.name} environment` });
      output += source.slice(axisEnvironment.beginIndex);
      break;
    }
    const body = source.slice(cursor, endIndex);
    const parsedAxisOptions = parseOptions(axisOptions.raw);
    output += renderAxisAsTikz(
      {
        ...axisEnvironment.defaultOptions,
        ...findContainingTikzPictureOptions(source, axisEnvironment.beginIndex),
        ...parsedAxisOptions,
        "pgfplots explicit x unit": Object.hasOwn(parsedAxisOptions, "x"),
        "pgfplots explicit y unit": Object.hasOwn(parsedAxisOptions, "y")
      },
      body,
      options,
      diagnostics
    );
    index = endIndex + axisEnvironment.end.length;
  }
  return output;
}

const PGFPLOTS_ENVIRONMENTS = [
  { name: "semilogxaxis", defaultOptions: { xmode: "log" } },
  { name: "semilogyaxis", defaultOptions: { ymode: "log" } },
  { name: "loglogaxis", defaultOptions: { xmode: "log", ymode: "log" } },
  { name: "ternaryaxis", defaultOptions: { "pgfplots ternary axis": true, grid: "major", xmin: 0, xmax: 1, ymin: 0, ymax: 1, zmin: 0, zmax: 1 } },
  { name: "axis", defaultOptions: {} }
];

function findNextPgfplotsEnvironment(source, start) {
  let best = null;
  for (const environment of PGFPLOTS_ENVIRONMENTS) {
    const begin = `\\begin{${environment.name}}`;
    const beginIndex = source.indexOf(begin, start);
    if (beginIndex === -1) continue;
    if (!best || beginIndex < best.beginIndex) {
      best = {
        ...environment,
        begin,
        end: `\\end{${environment.name}}`,
        beginIndex
      };
    }
  }
  return best;
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

function preparePgfplotsAxisOptions(axisOptions, options = {}) {
  const styles = options.pgfplotsStyleDefinitions || {};
  const raw = styles["every axis"] ? { "every axis": true, ...axisOptions } : { ...axisOptions };
  return expandPgfplotsNamedOptions(raw, styles);
}

function expandPgfplotsNamedOptions(rawOptions = {}, styles = {}, depth = 0) {
  if (!styles || depth > 8) return { ...rawOptions };
  let expanded = {};
  for (const [key, value] of Object.entries(rawOptions || {})) {
    const style = styles[key];
    if (style && !String(key).startsWith("__")) {
      expanded = mergeOptionMaps(expanded, expandPgfplotsNamedOptions(style, styles, depth + 1));
      if (value !== true && value !== undefined && value !== null && value !== "") {
        expanded[key] = value;
      }
      continue;
    }
    expanded = mergeOptionMaps(expanded, { [key]: value });
  }
  return expanded;
}

function renderAxisAsTikz(axisOptions, body, options, diagnostics = []) {
  const preparedAxisOptions = preparePgfplotsAxisOptions(axisOptions, options);
  const addplots = parseAddplots(body, options, diagnostics);
  const legendEntries = parseLegendEntries(body);
  const has3dSurface = addplots.some((plot) => isSurfacePlot(plot, preparedAxisOptions));
  const declaredFunctions = parsePgfplotsDeclaredFunctions([
    ...(options.pgfplotsDeclareFunctions || []),
    ...optionValues(preparedAxisOptions["declare function"])
  ]);
  const resolvedAxisOptions = {
    ...preparedAxisOptions,
    "pgfplots declared functions": declaredFunctions,
    "pgfplots 3d surface": has3dSurface
  };
  if (resolvedAxisOptions["pgfplots ternary axis"]) {
    return renderTernaryAxisAsTikz(resolvedAxisOptions, addplots);
  }
  const ranges = computeAxisRanges(resolvedAxisOptions, addplots);
  const geometry = createAxisGeometry(resolvedAxisOptions, ranges);
  const commands = [renderAxisBounds(geometry)];
  const axisBox = renderAxisBox(resolvedAxisOptions, geometry);
  if (has3dSurface) {
    addplots.forEach((plot, plotIndex) => {
      commands.push(...renderAddplot(plot, resolvedAxisOptions, ranges, geometry, options, plotIndex));
    });
    commands.push(...renderAxis3DBox(resolvedAxisOptions, ranges, geometry));
    commands.push(...renderAxis3DTicks(resolvedAxisOptions, ranges, geometry));
    commands.push(...renderAxisLabels3D(resolvedAxisOptions, ranges, geometry));
    commands.push(...renderLegendEntries(resolvedAxisOptions, ranges, geometry, legendEntries, addplots));
    return `\n${commands.join("\n")}\n`;
  }
  if (resolvedAxisOptions.grid || String(resolvedAxisOptions.grid || "").includes("major")) {
    commands.push(...renderAxisGrid(ranges, geometry));
  }
  if (shouldRenderAxisLines(resolvedAxisOptions)) {
    commands.push(...renderAxisLines(resolvedAxisOptions, ranges, geometry));
  }
  commands.push(...renderAxisTicks(resolvedAxisOptions, addplots, ranges, geometry));
  addplots.forEach((plot, plotIndex) => {
    commands.push(...renderAddplot(plot, resolvedAxisOptions, ranges, geometry, options, plotIndex));
  });
  commands.push(...renderAxisOverlayStatements(body, ranges, geometry));
  if (axisBox) commands.push(axisBox);
  commands.push(...renderAxisLabels(resolvedAxisOptions, ranges, geometry));
  commands.push(...renderLegendEntries(resolvedAxisOptions, ranges, geometry, legendEntries, addplots));
  return `\n${commands.join("\n")}\n`;
}

function parseAddplots(body, options = {}, diagnostics = []) {
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
    cursor = skipWhitespace(body, cursor);
    if (body[cursor] === "+") cursor += 1;
    const appendCycle = body[cursor - 1] === "+";
    cursor = skipWhitespace(body, cursor);
    if (body.startsWith("expression", cursor)) {
      cursor += "expression".length;
      cursor = skipWhitespace(body, cursor);
    }
    const parsedOptions = parseOptionalOptions(body, cursor);
    const plotOptions = expandPgfplotsNamedOptions(parseOptions(parsedOptions.raw), options.pgfplotsStyleDefinitions || {});
    if (appendCycle) plotOptions["pgfplots plus"] = true;
    if (String(parsedOptions.raw || "").trim()) plotOptions["pgfplots explicit options"] = true;
    cursor = parsedOptions.end;
    cursor = skipWhitespace(body, cursor);
    const statementEnd = findStatementEnd(body, cursor);
    const statement = body.slice(start, statementEnd === -1 ? body.length : statementEnd);
    const closedCycle = /\\closedcycle\b/.test(statement);
    if (body.startsWith("coordinates", cursor)) {
      cursor += "coordinates".length;
      cursor = skipWhitespace(body, cursor);
      const coords = extractBalanced(body, cursor, "{", "}");
      if (coords) {
        plots.push({
          type: "coordinates",
          is3d,
          options: plotOptions,
          points: parseCoordinateList(coords.content),
          nodes: parseAddplotInlineNodes(body.slice(coords.end, statementEnd === -1 ? body.length : statementEnd), options),
          closedCycle
        });
        cursor = coords.end;
      }
    } else if (body.startsWith("table", cursor)) {
      cursor += "table".length;
      cursor = skipWhitespace(body, cursor);
      const tableOptions = parseOptionalOptions(body, cursor);
      cursor = tableOptions.end;
      cursor = skipWhitespace(body, cursor);
      const table = extractBalanced(body, cursor, "{", "}");
      if (table) {
        const tableText = resolvePgfplotsTableContent(table.content, options, diagnostics);
        plots.push({
          type: "coordinates",
          source: "table",
          is3d,
          options: plotOptions,
          tableOptions: parseOptions(tableOptions.raw),
          points: parsePgfplotsTablePoints(tableText, parseOptions(tableOptions.raw), diagnostics, plotOptions),
          nodes: parseAddplotInlineNodes(body.slice(table.end, statementEnd === -1 ? body.length : statementEnd), options),
          closedCycle
        });
        cursor = table.end;
      }
    } else if (body[cursor] === "(") {
      const parametric = parseParametricAddplot(body, cursor, statement, statementEnd, options);
      if (parametric) {
        plots.push({
          type: "parametric",
          is3d,
          options: plotOptions,
          xExpression: parametric.xExpression,
          yExpression: parametric.yExpression,
          fillAnchor: parametric.fillAnchor,
          nodes: parametric.nodes,
          closedCycle
        });
        cursor = parametric.end;
      }
    } else if (body[cursor] === "{") {
      const expression = extractBalanced(body, cursor, "{", "}");
      if (expression) {
        plots.push({
          type: "function",
          is3d,
          options: plotOptions,
          expression: expression.content.trim(),
          nodes: parseAddplotInlineNodes(body.slice(expression.end, statementEnd === -1 ? body.length : statementEnd), options),
          closedCycle
        });
        cursor = expression.end;
      }
    }
    const semicolon = findStatementEnd(body, cursor);
    index = semicolon === -1 ? cursor : semicolon + 1;
  }
  return plots;
}

function parseParametricAddplot(body, cursor, statement, statementEnd, options = {}) {
  const tuple = extractBalanced(body, cursor, "(", ")");
  if (!tuple) return null;
  const parts = splitTopLevel(tuple.content, ",");
  if (parts.length < 2) return null;
  const tail = body.slice(tuple.end, statementEnd === -1 ? body.length : statementEnd);
  return {
    xExpression: stripOuterBracesText(parts[0].trim()),
    yExpression: stripOuterBracesText(parts.slice(1).join(",").trim()),
    fillAnchor: parseAddplotAxisCsTailAnchor(tail),
    nodes: parseAddplotInlineNodes(tail, options),
    end: tuple.end
  };
}

function parseAddplotAxisCsTailAnchor(tail) {
  const match = String(tail || "").match(/--\s*\(\s*(?:axis\s+cs\s*:\s*)?([^,(){}]+)\s*,\s*([^(){}]+?)\s*\)/i);
  if (!match) return null;
  const x = axisNumber(match[1], NaN);
  const y = axisNumber(match[2], NaN);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function parseAddplotInlineNodes(tail, options = {}) {
  const nodes = [];
  const source = String(tail || "");
  let index = 0;
  while (index < source.length) {
    const start = source.indexOf("node", index);
    if (start === -1) break;
    const before = source[start - 1] || "";
    const after = source[start + "node".length] || "";
    if (/[A-Za-z@\\]/.test(before) || /[A-Za-z@]/.test(after)) {
      index = start + "node".length;
      continue;
    }
    let cursor = skipWhitespace(source, start + "node".length);
    const parsedOptions = parseOptionalOptions(source, cursor);
    cursor = parsedOptions.end;
    cursor = skipWhitespace(source, cursor);
    const content = extractBalanced(source, cursor, "{", "}");
    if (!content) {
      index = start + "node".length;
      continue;
    }
    nodes.push({
      options: expandPgfplotsNamedOptions(parseOptions(parsedOptions.raw), options.pgfplotsStyleDefinitions || {}),
      text: content.content.trim()
    });
    index = content.end;
  }
  return nodes;
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

function renderAxisOverlayStatements(body, ranges, geometry) {
  const commands = [];
  let cursor = 0;
  while (cursor < body.length) {
    const start = findNextAxisOverlayStatementStart(body, cursor);
    if (start === -1) break;
    const end = findStatementEnd(body, start);
    if (end === -1) break;
    const statement = body.slice(start, end + 1);
    commands.push(transformAxisStatementCoordinates(statement, ranges, geometry));
    cursor = end + 1;
  }
  return commands;
}

function findNextAxisOverlayStatementStart(body, cursor) {
  let best = -1;
  for (const command of ["\\coordinate", "\\node", "\\draw", "\\path"]) {
    const index = body.indexOf(command, cursor);
    if (index !== -1 && (best === -1 || index < best)) {
      best = index;
    }
  }
  return best;
}

function transformAxisStatementCoordinates(statement, ranges, geometry) {
  const resolvedStatement = String(statement).replace(/\\pgfkeysvalueof\s*\{\s*\/pgfplots\/([xyz])\s*(min|max)\s*\}/gi, (_match, axis, bound) => {
    const key = `${axis.toLowerCase()}${bound.toLowerCase() === "min" ? "Min" : "Max"}`;
    return Number.isFinite(ranges[key]) ? String(ranges[key]) : "0";
  });
  return resolvedStatement.replace(/\(\s*(?:(rel\s+axis\s+cs|axis\s+description\s+cs|axis\s+cs)\s*:\s*)?([^,()[\]{}]+?)\s*,\s*([^()[\]{}]+?)\s*\)/gi, (match, coordinateSystem, rawX, rawY) => {
    const x = axisNumber(rawX, NaN);
    const y = axisNumber(rawY, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return match;
    const normalizedCoordinateSystem = String(coordinateSystem || "").toLowerCase().replace(/\s+/g, " ").trim();
    const point = normalizedCoordinateSystem === "rel axis cs" || normalizedCoordinateSystem === "axis description cs"
      ? {
          x: geometry.origin.x + x * geometry.width,
          y: geometry.origin.y + y * geometry.height
        }
      : geometry.mapPoint({
      x: clampAxisCoordinate(x, ranges.xMin, ranges.xMax),
      y: clampAxisCoordinate(y, ranges.yMin, ranges.yMax)
    });
    return formatAxisPoint(point);
  });
}

function clampAxisCoordinate(value, min, max) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return value;
  return Math.max(Math.min(value, max), min);
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
  index = 0;
  while (index < body.length) {
    const start = body.indexOf("\\legend", index);
    if (start === -1) break;
    let cursor = skipWhitespace(body, start + "\\legend".length);
    const list = extractBalanced(body, cursor, "{", "}");
    if (!list) break;
    for (const entry of splitLegendEntries(list.content)) {
      const trimmed = entry.trim();
      if (trimmed) entries.push(trimmed);
    }
    index = list.end;
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
      const point = { x: axisNumber(parts[0]), y: axisNumber(parts[1]), raw: `(${parts[0].trim()},${parts[1].trim()})` };
      if (parts.length >= 3) {
        point.z = axisNumber(parts[2]);
        point.raw = `(${parts[0].trim()},${parts[1].trim()},${parts[2].trim()})`;
      }
      points.push(point);
    }
    match = pattern.exec(input);
  }
  return points;
}

function resolvePgfplotsTableContent(content, options = {}, diagnostics = []) {
  const text = String(content || "").trim();
  const looksLikeFile = text && !/[\r\n]/.test(text) && !/\s/.test(text) && /\.[A-Za-z0-9]+$/.test(text);
  if (!looksLikeFile) return content;
  if (typeof options.pgfplotsTableResolver === "function") {
    const resolved = options.pgfplotsTableResolver(text);
    if (resolved !== undefined && resolved !== null) return String(resolved);
  }
  diagnostics.push({ severity: "warning", message: `Could not resolve pgfplots table file '${text}'` });
  return "";
}

function parsePgfplotsTablePoints(content, tableOptions = {}, diagnostics = [], plotOptions = {}) {
  const rows = normalizePgfplotsTableRows(content, tableOptions);
  if (rows.length < 2) return [];
  const headers = rows[0].map((cell) => cell.trim());
  const xColumn = String(tableOptions.x || "x").trim();
  const yColumn = String(tableOptions.y || "y").trim();
  const zColumn = String(tableOptions.z || "z").trim();
  const xIndex = pgfplotsHeaderIndex(headers, xColumn, 0);
  const yIndex = pgfplotsHeaderIndex(headers, yColumn, Math.min(1, Math.max(0, headers.length - 1)));
  const zIndex = pgfplotsHeaderIndex(headers, zColumn, headers.length > 2 ? 2 : -1);
  const metaColumn = pgfplotsPointMetaColumn(plotOptions, tableOptions);
  const metaIndex = metaColumn ? pgfplotsHeaderIndex(headers, metaColumn, -1) : -1;
  const points = [];
  for (const row of rows.slice(1)) {
    if (!row.length || row.every((cell) => !String(cell).trim())) continue;
    const x = axisNumber(row[xIndex]);
    const y = axisNumber(row[yIndex]);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      const columns = {};
      headers.forEach((header, index) => {
        if (header) columns[header] = row[index];
      });
      const point = { x, y, raw: `(${row[xIndex]},${row[yIndex]})`, columns };
      if (zIndex >= 0) {
        const z = axisNumber(row[zIndex], NaN);
        if (Number.isFinite(z)) {
          point.z = z;
          point.raw = `(${row[xIndex]},${row[yIndex]},${row[zIndex]})`;
        }
      }
      if (metaIndex >= 0) {
        const meta = axisNumber(row[metaIndex], NaN);
        if (Number.isFinite(meta)) point.meta = meta;
      }
      points.push(point);
    } else {
      diagnostics.push({ severity: "warning", message: "Skipped non-numeric pgfplots table row" });
    }
  }
  return points;
}

function pgfplotsHeaderIndex(headers, column, fallback) {
  const normalizedColumn = String(column || "").trim();
  if (!normalizedColumn) return fallback;
  const exact = headers.indexOf(normalizedColumn);
  if (exact !== -1) return exact;
  const lower = normalizedColumn.toLowerCase();
  const insensitive = headers.findIndex((header) => header.toLowerCase() === lower);
  return insensitive !== -1 ? insensitive : fallback;
}

function pgfplotsPointMetaColumn(plotOptions = {}, tableOptions = {}) {
  const raw = plotOptions["point meta"] ?? tableOptions["point meta"];
  if (raw === undefined || raw === null || raw === true) return "";
  const text = String(raw).trim();
  const thisRow = text.match(/\\thisrow\s*\{([^{}]+)\}/);
  if (thisRow) return thisRow[1].trim();
  const directColumn = text.match(/^\s*([A-Za-z_][A-Za-z0-9_. -]*)\s*$/);
  return directColumn ? directColumn[1].trim() : "";
}

function normalizePgfplotsTableRows(content, tableOptions = {}) {
  let text = String(content || "").trim();
  if (String(tableOptions["row sep"] || "").trim() === "\\\\") {
    text = text.replace(/\\\\/g, "\n");
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/));
}

function computeAxisRanges(axisOptions, addplots) {
  const domain = parseDomain(axisOptions.domain || PGFPLOTS_DEFAULT_FUNCTION_DOMAIN);
  const xLog = isLogAxis(axisOptions, "x");
  const yLog = isLogAxis(axisOptions, "y");
  const hasExplicitXMin = hasAxisBound(axisOptions.xmin);
  const hasExplicitXMax = hasAxisBound(axisOptions.xmax);
  const hasExplicitYMin = hasAxisBound(axisOptions.ymin);
  const hasExplicitYMax = hasAxisBound(axisOptions.ymax);
  const hasExplicitZMin = hasAxisBound(axisOptions.zmin);
  const hasExplicitZMax = hasAxisBound(axisOptions.zmax);
  let xMin = axisNumber(axisOptions.xmin, xLog ? 1 : domain.start);
  let xMax = axisNumber(axisOptions.xmax, xLog ? 10 : domain.end);
  let yMin = hasExplicitYMin ? axisNumber(axisOptions.ymin) : Infinity;
  let yMax = hasExplicitYMax ? axisNumber(axisOptions.ymax) : -Infinity;
  let zMin = hasExplicitZMin ? axisNumber(axisOptions.zmin) : Infinity;
  let zMax = hasExplicitZMax ? axisNumber(axisOptions.zmax) : -Infinity;
  for (const plot of addplots) {
    if (plot.type === "coordinates") {
      for (const point of plot.points) {
        if (!hasExplicitXMin) xMin = Math.min(xMin, point.x);
        if (!hasExplicitXMax) xMax = Math.max(xMax, point.x);
        if (!hasExplicitYMin) yMin = Math.min(yMin, point.y);
        if (!hasExplicitYMax) yMax = Math.max(yMax, point.y);
        if (Number.isFinite(point.z)) {
          if (!hasExplicitZMin) zMin = Math.min(zMin, point.z);
          if (!hasExplicitZMax) zMax = Math.max(zMax, point.z);
        }
      }
    }
	    if (plot.type === "function") {
	      const plotDomain = parseDomain(plot.options.domain || axisOptions.domain || PGFPLOTS_DEFAULT_FUNCTION_DOMAIN);
      if (isSurfacePlot(plot, axisOptions)) {
        const yDomain = parseDomain(plot.options["y domain"] || axisOptions["y domain"] || axisOptions.domain || PGFPLOTS_DEFAULT_FUNCTION_DOMAIN);
        if (!hasExplicitXMin) xMin = Math.min(xMin, plotDomain.start);
        if (!hasExplicitXMax) xMax = Math.max(xMax, plotDomain.end);
        if (!hasExplicitYMin) yMin = Math.min(yMin, yDomain.start);
        if (!hasExplicitYMax) yMax = Math.max(yMax, yDomain.end);
        const zRestriction = parseZRestriction(plot.options, axisOptions);
        if (zRestriction) {
          if (!hasExplicitZMin) zMin = Math.min(zMin, zRestriction.start);
          if (!hasExplicitZMax) zMax = Math.max(zMax, zRestriction.end);
        }
        const xSamples = axisSamples(plot.options.samples || axisOptions.samples || 15, 60);
        const ySamples = axisSamples(plot.options["samples y"] || axisOptions["samples y"] || plot.options.samples || axisOptions.samples || 15, 60);
        for (let xIndex = 0; xIndex < xSamples; xIndex += 1) {
          const xT = xSamples === 1 ? 0 : xIndex / (xSamples - 1);
          const x = plotDomain.start + (plotDomain.end - plotDomain.start) * xT;
          for (let yIndex = 0; yIndex < ySamples; yIndex += 1) {
            const yT = ySamples === 1 ? 0 : yIndex / (ySamples - 1);
            const y = yDomain.start + (yDomain.end - yDomain.start) * yT;
            const z = restrictSurfaceZ(evaluateAxisExpression(plot.expression, x, axisOptions, { y }), zRestriction);
            if (Number.isFinite(z)) {
              if (!hasExplicitZMin) zMin = Math.min(zMin, z);
              if (!hasExplicitZMax) zMax = Math.max(zMax, z);
            }
          }
        }
        continue;
      }
      if (!hasExplicitXMin) xMin = Math.min(xMin, plotDomain.start);
      if (!hasExplicitXMax) xMax = Math.max(xMax, plotDomain.end);
      const samples = axisSamples(plot.options.samples || axisOptions.samples || 25, 80);
      for (let index = 0; index < samples; index += 1) {
        const t = samples === 1 ? 0 : index / (samples - 1);
        const x = plotDomain.start + (plotDomain.end - plotDomain.start) * t;
        const y = evaluateAxisExpressionAtSample(plot.expression, x, axisOptions, { domain: plotDomain, index, samples });
        if (Number.isFinite(y)) {
          if (!hasExplicitYMin) yMin = Math.min(yMin, y);
          if (!hasExplicitYMax) yMax = Math.max(yMax, y);
	        }
	      }
	    }
	    if (plot.type === "parametric") {
	      for (const point of sampleParametricDataPoints(plot, axisOptions, { pgfplotsSamples: 80 })) {
	        if (!hasExplicitXMin) xMin = Math.min(xMin, point.x);
	        if (!hasExplicitXMax) xMax = Math.max(xMax, point.x);
	        if (!hasExplicitYMin) yMin = Math.min(yMin, point.y);
	        if (!hasExplicitYMax) yMax = Math.max(yMax, point.y);
	      }
	      if (plot.fillAnchor) {
	        if (!hasExplicitXMin) xMin = Math.min(xMin, plot.fillAnchor.x);
	        if (!hasExplicitXMax) xMax = Math.max(xMax, plot.fillAnchor.x);
	        if (!hasExplicitYMin) yMin = Math.min(yMin, plot.fillAnchor.y);
	        if (!hasExplicitYMax) yMax = Math.max(yMax, plot.fillAnchor.y);
	      }
	    }
	  }
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
    yMin = yLog ? 1 : -1;
    yMax = yLog ? 10 : 1;
  }
  if (yMin === yMax) {
    if (yLog) {
      yMin = Math.max(1e-9, yMin / 10);
      yMax *= 10;
    } else {
      yMin -= 1;
      yMax += 1;
    }
  }
  if (!xLog) {
    const xSpan = Math.abs(xMax - xMin) || 1;
    const xPad = xSpan * PGFPLOTS_DEFAULT_ENLARGE_LIMITS;
    if (!hasExplicitXMin) xMin -= xPad;
    if (!hasExplicitXMax) xMax += xPad;
  }
  if (!yLog) {
    const ySpan = Math.abs(yMax - yMin) || 1;
    const yPad = ySpan * PGFPLOTS_DEFAULT_ENLARGE_LIMITS;
    if (!hasExplicitYMin) yMin -= yPad;
    if (!hasExplicitYMax) yMax += yPad;
  }
  if (xLog) {
    xMin = Math.max(1e-9, xMin);
    xMax = Math.max(xMin * 10, xMax);
  }
  if (yLog) {
    yMin = Math.max(1e-9, yMin);
    yMax = Math.max(yMin * 10, yMax);
  }
  if (!Number.isFinite(zMin) || !Number.isFinite(zMax)) {
    zMin = 0;
    zMax = 1;
  }
  if (zMin === zMax) {
    zMin -= 1;
    zMax += 1;
  }
  return {
    xMin: roundAxis(xMin),
    xMax: roundAxis(xMax),
    yMin: roundAxis(yMin),
    yMax: roundAxis(yMax),
    zMin: roundAxis(zMin),
    zMax: roundAxis(zMax)
  };
}

function hasAxisBound(value) {
  return value !== undefined && value !== null && value !== true && String(value).trim() !== "";
}

function createAxisGeometry(axisOptions, ranges) {
  const scale = axisScaleFactor(axisOptions.scale);
  const is3dSurface = Boolean(axisOptions["pgfplots 3d surface"]);
  const fallbackWidth = is3dSurface ? 8.4 : PGFPLOTS_DEFAULT_AXIS_WIDTH;
  const fallbackHeight = is3dSurface ? 6.6 : PGFPLOTS_DEFAULT_AXIS_HEIGHT;
  const xUnitWidth = axisOptions["pgfplots explicit x unit"] ? axisUnitDimension(axisOptions.x, ranges.xMax - ranges.xMin) : null;
  const yUnitHeight = axisOptions["pgfplots explicit y unit"] ? axisUnitDimension(axisOptions.y, ranges.yMax - ranges.yMin) : null;
  const hasExplicitWidth = hasAxisBound(axisOptions.width);
  const hasExplicitHeight = hasAxisBound(axisOptions.height);
  let requestedWidth = parseAxisDimension(axisOptions.width, xUnitWidth ?? fallbackWidth);
  let requestedHeight = parseAxisDimension(axisOptions.height, yUnitHeight ?? fallbackHeight);
  if (hasExplicitWidth && !hasExplicitHeight && !yUnitHeight) {
    requestedHeight = requestedWidth / PGFPLOTS_DEFAULT_AXIS_ASPECT;
  } else if (!hasExplicitWidth && hasExplicitHeight && !xUnitWidth) {
    requestedWidth = requestedHeight * PGFPLOTS_DEFAULT_AXIS_ASPECT;
  }
  const unitRatio = parsePgfplotsUnitVectorRatio(axisOptions["unit vector ratio*"]);
  let plotBoxAlreadyLabelAdjusted = false;
  if (unitRatio) {
    const mappedXMinForRatio = axisScaleValue(ranges.xMin, isLogAxis(axisOptions, "x"));
    const mappedXMaxForRatio = axisScaleValue(ranges.xMax, isLogAxis(axisOptions, "x"));
    const mappedYMinForRatio = axisScaleValue(ranges.yMin, isLogAxis(axisOptions, "y"));
    const mappedYMaxForRatio = axisScaleValue(ranges.yMax, isLogAxis(axisOptions, "y"));
    const xSpanForRatio = Math.abs(mappedXMaxForRatio - mappedXMinForRatio) || 1;
    const ySpanForRatio = Math.abs(mappedYMaxForRatio - mappedYMinForRatio) || 1;
    const targetAspect = (xSpanForRatio * unitRatio.x) / (ySpanForRatio * unitRatio.y);
    const targetBox = pgfplotsAxisTargetBox(axisOptions, requestedWidth, requestedHeight);
    if (Number.isFinite(targetAspect) && targetAspect > 0) {
      if (targetBox.width / targetBox.height > targetAspect) {
        requestedHeight = targetBox.height;
        requestedWidth = requestedHeight * targetAspect;
      } else {
        requestedWidth = targetBox.width;
        requestedHeight = requestedWidth / targetAspect;
      }
      plotBoxAlreadyLabelAdjusted = true;
    }
  }
  const plotArea = axisPlotAreaSize(axisOptions, requestedWidth, requestedHeight, { plotBoxAlreadyLabelAdjusted });
  const width = plotArea.width * scale;
  const height = plotArea.height * scale;
  const origin = parseAxisAt(axisOptions.at);
  const margin = scaleAxisMargin(axisContainerMargin(axisOptions), scale);
  const xLog = isLogAxis(axisOptions, "x");
  const yLog = isLogAxis(axisOptions, "y");
  const mappedXMin = axisScaleValue(ranges.xMin, xLog);
  const mappedXMax = axisScaleValue(ranges.xMax, xLog);
  const mappedYMin = axisScaleValue(ranges.yMin, yLog);
  const mappedYMax = axisScaleValue(ranges.yMax, yLog);
  const xSpan = mappedXMax - mappedXMin || 1;
  const ySpan = mappedYMax - mappedYMin || 1;
  const mapPoint = (point) => ({
    x: origin.x + ((axisScaleValue(point.x, xLog) - mappedXMin) / xSpan) * width,
    y: origin.y + ((axisScaleValue(point.y, yLog) - mappedYMin) / ySpan) * height
  });
  const zMin = Number.isFinite(ranges.zMin) ? ranges.zMin : 0;
  const zMax = Number.isFinite(ranges.zMax) && ranges.zMax !== zMin ? ranges.zMax : zMin + 1;
  const zSpan = zMax - zMin || 1;
  const mapPoint3d = (point) => {
    const nx = (axisScaleValue(point.x, xLog) - mappedXMin) / xSpan;
    const ny = (axisScaleValue(point.y, yLog) - mappedYMin) / ySpan;
    const nz = (point.z - zMin) / zSpan;
    return {
      x: origin.x + width * 0.08 + nx * width * 0.62 + ny * width * 0.27,
      y: origin.y + height * 0.12 - nx * height * 0.1 + ny * height * 0.22 + nz * height * 0.62
    };
  };
  return { width, height, origin, margin, mapPoint, mapPoint3d, xLog, yLog };
}

function axisScaleFactor(raw) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parsePgfplotsUnitVectorRatio(raw) {
  if (raw === undefined || raw === null || raw === true) return null;
  const values = String(raw).trim().split(/\s+/).map(Number).filter((value) => Number.isFinite(value) && value > 0);
  if (!values.length) return null;
  return { x: values[0] || 1, y: values[1] || 1, z: values[2] || 1 };
}

function pgfplotsAxisTargetBox(axisOptions, width, height) {
  if (pgfplotsScaleOnlyAxis(axisOptions)) return { width, height };
  return {
    width: Math.max(0, width - PGFPLOTS_AXIS_LABEL_CONST),
    height: Math.max(0, height - PGFPLOTS_AXIS_LABEL_CONST)
  };
}

function pgfplotsScaleOnlyAxis(axisOptions) {
  const raw = axisOptions["scale only axis"];
  if (raw === undefined || raw === null || raw === false) return false;
  if (raw === true) return true;
  const normalized = String(raw).trim().toLowerCase();
  return normalized === "" || normalized === "true";
}

function scaleAxisMargin(margin, scale) {
  return Object.fromEntries(Object.entries(margin).map(([key, value]) => [key, value * scale]));
}

function axisPlotAreaSize(axisOptions, requestedWidth, requestedHeight, options = {}) {
  if (isMiddleAxis(axisOptions)) {
    const target = { width: requestedWidth, height: requestedHeight };
    return {
      width: Math.max(target.width * 0.5, target.width - TIKZ_PGFPLOTS_MIDDLE_AXIS_RESERVED_X),
      height: Math.max(target.height * 0.5, target.height - TIKZ_PGFPLOTS_MIDDLE_AXIS_RESERVED_Y)
    };
  }
  const target = options.plotBoxAlreadyLabelAdjusted
    ? { width: requestedWidth, height: requestedHeight }
    : pgfplotsAxisTargetBox(axisOptions, requestedWidth, requestedHeight);
  return target;
}

function axisUnitDimension(value, span) {
  const unit = parseDimension(String(value || ""), {});
  const axisSpan = Math.abs(Number(span));
  if (!Number.isFinite(unit) || unit <= 0 || !Number.isFinite(axisSpan) || axisSpan <= 0) return null;
  return unit * axisSpan;
}

function isLogAxis(axisOptions, axis) {
  return String(axisOptions[`${axis}mode`] || axisOptions[`${axis} scale`] || "").trim().toLowerCase() === "log";
}

function axisScaleValue(value, logMode) {
  if (!logMode) return value;
  return Math.log10(Math.max(1e-12, value));
}

function axisContainerMargin(axisOptions) {
  if (axisOptions["hide axis"] || axisOptions.hide) return TIKZ_HIDDEN_AXIS_CONTAINER_MARGIN;
  if (isMiddleAxis(axisOptions)) return TIKZ_MIDDLE_AXIS_CONTAINER_MARGIN;
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

function renderAxisBounds(geometry) {
  const bounds = axisOuterBounds(geometry);
  return `\\draw[axis bounds, draw=none, fill=none] ${formatAxisPoint({
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

function renderAxisBox(axisOptions, geometry) {
  if (!shouldRenderAxisBox(axisOptions)) return "";
  const min = geometry.origin;
  const max = { x: geometry.origin.x + geometry.width, y: geometry.origin.y + geometry.height };
  return `\\draw[axis frame, black, line width=0.35pt] ${formatAxisPoint({
    x: min.x,
    y: min.y
  })} -- ${formatAxisPoint({
    x: max.x,
    y: min.y
  })} -- ${formatAxisPoint({
    x: max.x,
    y: max.y
  })} -- ${formatAxisPoint({
    x: min.x,
    y: max.y
  })} -- cycle;`;
}

function shouldRenderAxisBox(axisOptions = {}) {
  if (axisOptions["hide axis"] || axisOptions.hide) return false;
  const raw = axisOptions["axis lines"] ?? axisOptions.axis;
  if (raw === undefined || raw === null || raw === "") return true;
  if (raw === true) return true;
  const value = String(raw).trim().toLowerCase();
  return value === "box";
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
  const style = joinOptions([
    "axis line",
    "black",
    axisOptions["very thick"] ? "very thick" : "line width=0.35pt",
    shouldArrowAxisLines(axisOptions) ? "->" : ""
  ]);
  const xFrom = geometry.mapPoint({ x: ranges.xMin, y: yAxis });
  const xTo = geometry.mapPoint({ x: ranges.xMax, y: yAxis });
  const yFrom = geometry.mapPoint({ x: xAxis, y: ranges.yMin });
  const yTo = geometry.mapPoint({ x: xAxis, y: ranges.yMax });
  return [
    `\\draw[${style}] ${formatAxisPoint(xFrom)} -- ${formatAxisPoint(xTo)};`,
    `\\draw[${style}] ${formatAxisPoint(yFrom)} -- ${formatAxisPoint(yTo)};`
  ];
}

function shouldRenderAxisLines(axisOptions = {}) {
  const raw = axisOptions["axis lines"] ?? axisOptions.axis;
  if (raw === undefined || raw === null || raw === false || raw === "") return false;
  if (raw === true) return true;
  const value = String(raw).trim().toLowerCase();
  return value !== "none" && value !== "false" && value !== "off";
}

function shouldArrowAxisLines(axisOptions = {}) {
  const raw = axisOptions["axis lines"] ?? axisOptions.axis;
  const value = String(raw || "").trim().toLowerCase();
  return value === "left" || value === "middle" || value === "center";
}

function renderAxisTicks(axisOptions, addplots, ranges, geometry) {
  const commands = [];
  const allTicksDisabled = axisTicksDisabled(axisOptions.ticks) || axisTicksDisabled(axisOptions.tick);
  const xTicksDisabled = allTicksDisabled || axisTicksDisabled(axisOptions.xtick) || axisTicksDisabled(axisOptions["x tick"]);
  const yTicksDisabled = allTicksDisabled || axisTicksDisabled(axisOptions.ytick) || axisTicksDisabled(axisOptions["y tick"]);
  const xDistanceTicks = axisTickDistanceValues(axisOptions, "x", ranges.xMin, ranges.xMax);
  const yDistanceTicks = axisTickDistanceValues(axisOptions, "y", ranges.yMin, ranges.yMax);
  const explicitXTicks = xTicksDisabled || hasExplicitAxisTickOption(axisOptions.xtick) || xDistanceTicks.length > 0;
  const explicitYTicks = yTicksDisabled || hasExplicitAxisTickOption(axisOptions.ytick) || yDistanceTicks.length > 0;
  const xTicks = xTicksDisabled
    ? []
    : hasExplicitAxisTickOption(axisOptions.xtick)
    ? axisTickValues(axisOptions.xtick, "x", addplots)
    : xDistanceTicks.length
    ? xDistanceTicks
    : trimAutoTerminalTicks(axisMajorTickValues(ranges.xMin, ranges.xMax, 7), ranges.xMin, ranges.xMax);
  const yTicks = yTicksDisabled
    ? []
    : hasExplicitAxisTickOption(axisOptions.ytick)
    ? axisTickValues(axisOptions.ytick, "y", addplots)
    : yDistanceTicks.length
    ? yDistanceTicks
    : trimAutoTerminalTicks(axisMajorTickValues(ranges.yMin, ranges.yMax, 6), ranges.yMin, ranges.yMax);
  const xLabels = axisTickLabels(axisOptions.xticklabels, xTicks);
  const yLabels = axisTickLabels(axisOptions.yticklabels, yTicks);
  const tickLength = parseDimension(String(axisOptions["major tick length"] || axisOptions.tickwidth || "0.15cm"), {});
  const middleAxis = isMiddleAxis(axisOptions);
  const yAxis = middleAxis && ranges.yMin <= 0 && ranges.yMax >= 0 ? 0 : ranges.yMin;
  const xAxis = middleAxis && ranges.xMin <= 0 && ranges.xMax >= 0 ? 0 : ranges.xMin;
  xTicks.forEach((x, index) => {
    const base = geometry.mapPoint({ x, y: yAxis });
    commands.push(`\\draw[axis tick, black, line width=0.25pt] ${formatAxisPoint(base)} -- ${formatAxisPoint(offsetPoint(base, 0, -tickLength))};`);
    if (!shouldHideAutoOriginTickLabel(x, explicitXTicks, middleAxis, ranges.yMin, ranges.yMax)) {
      commands.push(`\\node[axis tick label, anchor=north, font=\\scriptsize] at ${formatAxisPoint(offsetPoint(base, 0, -tickLength * 1.55))} {${xLabels[index]}};`);
    }
  });
  yTicks.forEach((y, index) => {
    const base = geometry.mapPoint({ x: xAxis, y });
    commands.push(`\\draw[axis tick, black, line width=0.25pt] ${formatAxisPoint(base)} -- ${formatAxisPoint(offsetPoint(base, -tickLength, 0))};`);
    if (!shouldHideAutoOriginTickLabel(y, explicitYTicks, middleAxis, ranges.xMin, ranges.xMax)) {
      commands.push(`\\node[axis tick label, anchor=east, font=\\scriptsize] at ${formatAxisPoint(offsetPoint(base, -tickLength * 1.55, 0))} {${yLabels[index]}};`);
    }
  });
  return commands;
}

function axisTicksDisabled(raw) {
  if (raw === undefined || raw === null || raw === false) return false;
  const text = String(raw).trim().toLowerCase();
  return text === "none" || text === "false" || text === "off" || text === "\\empty" || text === "empty";
}

function hasExplicitAxisTickOption(raw) {
  if (raw === undefined || raw === null) return false;
  if (raw === true || raw === false) return true;
  return String(raw).trim() !== "";
}

function shouldHideAutoOriginTickLabel(value, explicitTicks, middleAxis, otherMin, otherMax) {
  return !explicitTicks && middleAxis && otherMin < 0 && otherMax > 0 && Math.abs(value) < 1e-9;
}

function trimAutoTerminalTicks(values, min, max) {
  const span = Math.abs(max - min) || 1;
  const rangeEpsilon = span * 1e-10;
  const ticks = values.filter((value) => value >= min - rangeEpsilon && value <= max + rangeEpsilon);
  if (ticks.length < 2) return ticks;
  const steps = [];
  for (let index = 1; index < ticks.length; index += 1) {
    const step = Math.abs(ticks[index] - ticks[index - 1]);
    if (step > 1e-9) steps.push(step);
  }
  const step = Math.min(...steps);
  if (!Number.isFinite(step) || step <= 0) return ticks;
  if (ticks.length > 1 && max - ticks.at(-1) >= 0 && max - ticks.at(-1) < step * 0.12) ticks.pop();
  return ticks;
}

function axisTickValues(raw, axis, addplots) {
  const text = String(raw || "").trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  if (!text) return [];
  if (text === "\\empty" || text === "empty") return [];
  if (text === "data") return uniqueAxisValues(addplots.flatMap((plot) => plot.points || []).map((point) => point[axis]));
  return splitBracedList(text).map((part) => axisNumber(part, NaN)).filter(Number.isFinite);
}

function axisTickDistanceValues(axisOptions, axis, min, max) {
  const raw = axisOptions?.[`${axis}tick distance`] ?? axisOptions?.[`${axis} tick distance`];
  const step = axisNumber(raw, NaN);
  if (!Number.isFinite(step) || step <= 0 || !Number.isFinite(min) || !Number.isFinite(max) || min > max) return [];
  const epsilon = Math.max(1e-9, Math.abs(max - min) * 1e-10);
  const start = Math.ceil((min - epsilon) / step) * step;
  const values = [];
  for (let value = start; value <= max + epsilon; value += step) {
    const rounded = roundAxis(value);
    if (rounded >= min - epsilon && rounded <= max + epsilon && !values.includes(rounded)) values.push(rounded);
    if (values.length > 200) break;
  }
  return values;
}

function axisTickLabels(raw, ticks) {
  if (isEmptyTickLabelList(raw)) return ticks.map(() => "");
  const labels = splitBracedList(raw);
  if (labels.length) return ticks.map((_, index) => labels[index] ?? "");
  return ticks.map((tick) => formatAxisNumber(tick));
}

function isEmptyTickLabelList(raw) {
  if (raw === undefined || raw === null || raw === false) return false;
  const text = String(raw || "").trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  return text === "" || text === "\\empty" || text.toLowerCase() === "empty";
}

function splitBracedList(raw) {
  const text = String(raw || "").trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  if (!text) return [];
  if (text === "\\empty" || text.toLowerCase() === "empty") return [];
  return splitTopLevel(text, ",").map((part) => part.trim());
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

function renderAddplot(plot, axisOptions, ranges, geometry, options, plotIndex = 0) {
  if (plot.type === "coordinates") {
    if (isSurfacePlot(plot, axisOptions)) {
      return renderAxisSurfaceCoordinatePlot(plot, axisOptions, ranges, geometry, plotIndex);
    }
    const mappedPoints = plot.points.map((point) => geometry.mapPoint(point));
    const mark = String(plot.options.mark || "").trim().toLowerCase();
    const commands = [];
    if (isAxisBarPlot(axisOptions, plot.options, "y")) {
      commands.push(...renderAxisBars(plot.points, axisOptions, geometry, plot.options, plotIndex, "y"));
      commands.push(...renderNodesNearCoords(plot, axisOptions, geometry));
      return commands;
    }
    if (isAxisBarPlot(axisOptions, plot.options, "x")) {
      commands.push(...renderAxisBars(plot.points, axisOptions, geometry, plot.options, plotIndex, "x"));
      commands.push(...renderNodesNearCoords(plot, axisOptions, geometry));
      return commands;
    }
    if (plot.closedCycle && mappedPoints.length) {
      const style = joinOptions(["axis closed cycle", selectPlotFillStyle(plot.options, plotIndex), plotFillOpacityOption(plot.options), "draw=none"]);
      commands.push(`\\draw[${style}] ${mappedPoints.map(formatAxisPoint).join(" -- ")} -- cycle;`);
    }
    if (isAxisCombPlot(axisOptions, plot.options, "y")) {
      commands.push(...renderAxisComb(plot.points, axisOptions, ranges, geometry, plot.options, plotIndex, "y"));
      if (shouldRenderPlotMarks(plot.options)) commands.push(...mappedPoints.map((point) => renderPlotMark(point, plot.options, plotIndex)));
      commands.push(...renderNodesNearCoords(plot, axisOptions, geometry));
      return commands;
    }
    if (shouldRenderAxisPlotPath(plot.options) && mappedPoints.length) {
      const style = joinOptions(["axis plot", selectPlotStyle(plot.options, plotIndex), pgfplotsNamePathOption(plot.options)]);
      commands.push(`\\draw[${style}] ${axisPlotPointChain(mappedPoints, axisOptions, plot.options)};`);
    }
    if (plot.options["only marks"] || plot.options.scatter || (mark && mark !== "none")) {
      commands.push(...mappedPoints.map((point) => renderPlotMark(point, plot.options, plotIndex)));
    }
    commands.push(...renderAxisPlotInlineNodes(plot.nodes, mappedPoints, selectPlotColor(plot.options, plotIndex)));
    commands.push(...renderNodesNearCoords(plot, axisOptions, geometry));
    return commands;
  }
  if (plot.type === "function") {
    if (isSurfacePlot(plot, axisOptions)) {
      return renderAxisSurfacePlot(plot, axisOptions, ranges, geometry, options, plotIndex);
    }
    const plotDomain = parseDomain(plot.options.domain || axisOptions.domain || PGFPLOTS_DEFAULT_FUNCTION_DOMAIN);
    const visibleDomain = clipDomainToAxisRange(plotDomain, ranges);
    if (!visibleDomain) return [];
    const samples = axisSamples(plot.options.samples || axisOptions.samples || options.pgfplotsSamples || 25, 1200);
    const dataPoints = [];
    for (let index = 0; index < samples; index += 1) {
      const t = samples === 1 ? 0 : index / (samples - 1);
      const x = visibleDomain.start + (visibleDomain.end - visibleDomain.start) * t;
      const y = evaluateAxisExpressionAtSample(plot.expression, x, axisOptions, { domain: visibleDomain, index, samples });
      if (Number.isFinite(y)) dataPoints.push({ x, y });
    }
    if (isAxisCombPlot(axisOptions, plot.options, "y")) {
      const combDataPoints = clipAxisCombDataPoints(dataPoints, ranges);
      const points = combDataPoints.map((point) => geometry.mapPoint(point));
      const commands = renderAxisComb(combDataPoints, axisOptions, ranges, geometry, plot.options, plotIndex, "y");
      if (shouldRenderPlotMarks(plot.options)) commands.push(...points.map((point) => renderPlotMark(point, plot.options, plotIndex)));
      return commands;
    }
    const visibleDataPoints = clipAxisDataPointsToRanges(dataPoints, ranges);
    const points = visibleDataPoints.map((point) => geometry.mapPoint(point));
    const commands = [];
    if (plot.closedCycle && visibleDataPoints.length) {
      const baselineY = clampAxisBaseline(0, ranges.yMin, ranges.yMax);
      const first = visibleDataPoints[0];
      const last = visibleDataPoints[visibleDataPoints.length - 1];
      const closedPoints = [
        geometry.mapPoint({ x: first.x, y: baselineY }),
        ...points,
        geometry.mapPoint({ x: last.x, y: baselineY })
      ];
      const fillStyle = joinOptions(["axis closed cycle", selectPlotFillStyle(plot.options, plotIndex), plotFillOpacityOption(plot.options), "draw=none"]);
      commands.push(`\\draw[${fillStyle}] ${closedPoints.map(formatAxisPoint).join(" -- ")} -- cycle;`);
    }
    const style = joinOptions(["axis plot", selectPlotStyle(plot.options, plotIndex), pgfplotsNamePathOption(plot.options)]);
    if (shouldRenderAxisPlotPath(plot.options) && points.length) commands.push(`\\draw[${style}] ${axisPlotPointChain(points, axisOptions, plot.options)};`);
    commands.push(...renderAxisPlotInlineNodes(plot.nodes, points, selectPlotColor(plot.options, plotIndex)));
    return commands;
  }
  if (plot.type === "parametric") {
    const dataPoints = sampleParametricDataPoints(plot, axisOptions, options);
    const visibleDataPoints = clipAxisDataPointsToRanges(dataPoints, ranges);
    const points = visibleDataPoints.map((point) => geometry.mapPoint(point));
    const commands = [];
    if ((plot.fillAnchor || plot.closedCycle || plot.options.fill) && points.length) {
      const closedPoints = plot.fillAnchor
        ? [...points, geometry.mapPoint(plot.fillAnchor)]
        : parametricBaselineClosedPoints(visibleDataPoints, points, ranges, geometry);
      const fillStyle = joinOptions(["axis closed cycle", selectPlotFillStyle(plot.options, plotIndex), plotFillOpacityOption(plot.options), "draw=none"]);
      commands.push(`\\draw[${fillStyle}] ${closedPoints.map(formatAxisPoint).join(" -- ")} -- cycle;`);
    }
    const style = joinOptions(["axis plot", selectPlotStyle(plot.options, plotIndex), pgfplotsNamePathOption(plot.options)]);
    if (shouldRenderAxisPlotPath(plot.options) && points.length) commands.push(`\\draw[${style}] ${axisPlotPointChain(points, axisOptions, plot.options)};`);
    commands.push(...renderAxisPlotInlineNodes(plot.nodes, points, selectPlotColor(plot.options, plotIndex)));
    return commands;
  }
  return [];
}

function sampleParametricDataPoints(plot, axisOptions = {}, options = {}) {
  const plotDomain = parseDomain(plot.options.domain || axisOptions.domain || PGFPLOTS_DEFAULT_FUNCTION_DOMAIN);
  const samples = axisSamples(plot.options.samples || axisOptions.samples || options.pgfplotsSamples || 25, options.pgfplotsSamples || 1200);
  const dataPoints = [];
  for (let index = 0; index < samples; index += 1) {
    const t = samples === 1 ? 0 : index / (samples - 1);
    const x = plotDomain.start + (plotDomain.end - plotDomain.start) * t;
    const px = evaluateAxisExpression(plot.xExpression, x, axisOptions);
    const py = evaluateAxisExpression(plot.yExpression, x, axisOptions);
    if (Number.isFinite(px) && Number.isFinite(py)) dataPoints.push({ x: px, y: py });
  }
  return dataPoints;
}

function parametricBaselineClosedPoints(dataPoints, mappedPoints, ranges, geometry) {
  if (!dataPoints.length || !mappedPoints.length) return mappedPoints;
  const baselineY = clampAxisBaseline(0, ranges.yMin, ranges.yMax);
  const first = dataPoints[0];
  const last = dataPoints[dataPoints.length - 1];
  return [
    geometry.mapPoint({ x: first.x, y: baselineY }),
    ...mappedPoints,
    geometry.mapPoint({ x: last.x, y: baselineY })
  ];
}

function shouldRenderAxisPlotPath(options = {}) {
  if (options["only marks"]) return false;
  const draw = String(options.draw || "").trim().toLowerCase();
  if (draw !== "none" && draw !== "false" && draw !== "off") return true;
  return Boolean(options["name path"] || options["name path global"]);
}

function clampAxisBaseline(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function pgfplotsNamePathOption(options = {}) {
  const name = options["name path"];
  if (name === undefined || name === null || name === true) return "";
  const text = String(name).trim();
  return text ? `name path=${text}` : "";
}

function isSurfaceOptions(options = {}) {
  return Boolean(options.surf || options.mesh || options.patch);
}

function isSurfacePlot(plot, axisOptions = {}) {
  if (!plot?.is3d) return false;
  return isSurfaceOptions(plot.options || {}) || isSurfaceOptions(axisOptions || {});
}

function renderAxisSurfaceCoordinatePlot(plot, axisOptions, ranges, geometry, plotIndex = 0) {
  const points = plot.points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z));
  const grid = inferSurfaceCoordinateGrid(points, plot.options, axisOptions);
  if (!grid) return [];
  const patches = [];
  for (let rowIndex = 0; rowIndex < grid.rows - 1; rowIndex += 1) {
    for (let colIndex = 0; colIndex < grid.cols - 1; colIndex += 1) {
      const corners = [
        grid.points[rowIndex][colIndex],
        grid.points[rowIndex][colIndex + 1],
        grid.points[rowIndex + 1][colIndex + 1],
        grid.points[rowIndex + 1][colIndex]
      ];
      if (corners.some((corner) => !corner)) continue;
      const zMean = corners.reduce((sum, corner) => sum + corner.z, 0) / corners.length;
      const xMean = corners.reduce((sum, corner) => sum + corner.x, 0) / corners.length;
      const yMean = corners.reduce((sum, corner) => sum + corner.y, 0) / corners.length;
      patches.push({
        corners,
        zMean,
        depth: surfaceDepth(xMean, yMean, zMean, ranges)
      });
    }
  }
  patches.sort((a, b) => a.depth - b.depth);
  const opacity = axisOpacity(plot.options.opacity ?? axisOptions.opacity ?? 1);
  return patches.map((patch) => {
    const fill = pgfplotsSurfacePatchColor(plot.options, patch.zMean, ranges, plotIndex);
    const pointsText = patch.corners.map((corner) => formatAxisPoint(geometry.mapPoint3d(corner))).join(" -- ");
    return `\\draw[axis surface, draw=${fill}, fill=${fill}, opacity=${opacity}, line width=0.08pt] ${pointsText} -- cycle;`;
  });
}

function inferSurfaceCoordinateGrid(points, plotOptions = {}, axisOptions = {}) {
  if (points.length < 4) return null;
  const optionRows = surfaceMeshDimension(plotOptions["mesh/rows"] ?? axisOptions["mesh/rows"] ?? plotOptions.rows ?? axisOptions.rows);
  const optionCols = surfaceMeshDimension(plotOptions["mesh/cols"] ?? axisOptions["mesh/cols"] ?? plotOptions.cols ?? axisOptions.cols);
  let rows = optionRows;
  let cols = optionCols;
  if (rows && !cols && points.length % rows === 0) cols = points.length / rows;
  if (cols && !rows && points.length % cols === 0) rows = points.length / cols;
  if (!rows || !cols) {
    const inferred = inferSurfaceMatrixShape(points);
    if (!inferred) return null;
    rows = inferred.rows;
    cols = inferred.cols;
  }
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2 || rows * cols > points.length) return null;
  const grid = [];
  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    grid.push(points.slice(rowIndex * cols, rowIndex * cols + cols));
  }
  return { rows, cols, points: grid };
}

function surfaceMeshDimension(value) {
  if (value === undefined || value === null || value === true || value === "") return null;
  const parsed = Math.round(axisNumber(value, NaN));
  return Number.isInteger(parsed) && parsed > 1 ? parsed : null;
}

function inferSurfaceMatrixShape(points) {
  const uniqueX = uniqueAxisValues(points.map((point) => point.x));
  const uniqueY = uniqueAxisValues(points.map((point) => point.y));
  if (uniqueX.length > 1 && uniqueY.length > 1 && uniqueX.length * uniqueY.length === points.length) {
    return { rows: uniqueY.length, cols: uniqueX.length };
  }
  const firstY = points[0].y;
  let firstRowLength = 1;
  while (firstRowLength < points.length && sameAxisValue(points[firstRowLength].y, firstY)) firstRowLength += 1;
  if (firstRowLength > 1 && points.length % firstRowLength === 0) {
    return { rows: points.length / firstRowLength, cols: firstRowLength };
  }
  const side = Math.round(Math.sqrt(points.length));
  if (side > 1 && side * side === points.length) return { rows: side, cols: side };
  return null;
}

function sameAxisValue(left, right) {
  return Math.abs(Number(left) - Number(right)) < 1e-9;
}

function renderAxisSurfacePlot(plot, axisOptions, ranges, geometry, options, plotIndex = 0) {
  const xDomain = parseDomain(plot.options.domain || axisOptions.domain || `${ranges.xMin}:${ranges.xMax}`);
  const yDomain = parseDomain(plot.options["y domain"] || axisOptions["y domain"] || axisOptions.domain || `${ranges.yMin}:${ranges.yMax}`);
  const visibleXDomain = clipDomainToAxisRange(xDomain, ranges);
  const visibleYDomain = clipDomainToRange(yDomain, ranges.yMin, ranges.yMax);
  if (!visibleXDomain || !visibleYDomain) return [];
  const xSamples = axisSamples(plot.options.samples || axisOptions.samples || options.pgfplotsSurfaceSamples || 25, 80);
  const ySamples = axisSamples(plot.options["samples y"] || axisOptions["samples y"] || plot.options.samples || axisOptions.samples || options.pgfplotsSurfaceSamples || 25, 80);
  const zRestriction = parseZRestriction(plot.options, axisOptions);
  const grid = [];
  for (let yIndex = 0; yIndex < ySamples; yIndex += 1) {
    const row = [];
    const yT = ySamples === 1 ? 0 : yIndex / (ySamples - 1);
    const y = visibleYDomain.start + (visibleYDomain.end - visibleYDomain.start) * yT;
    for (let xIndex = 0; xIndex < xSamples; xIndex += 1) {
      const xT = xSamples === 1 ? 0 : xIndex / (xSamples - 1);
      const x = visibleXDomain.start + (visibleXDomain.end - visibleXDomain.start) * xT;
      const z = restrictSurfaceZ(evaluateAxisExpression(plot.expression, x, axisOptions, { y }), zRestriction);
      if (!Number.isFinite(z)) {
        row.push(null);
        continue;
      }
      row.push({ x, y, z, projected: geometry.mapPoint3d({ x, y, z }) });
    }
    grid.push(row);
  }
  const patches = [];
  for (let yIndex = 0; yIndex < ySamples - 1; yIndex += 1) {
    for (let xIndex = 0; xIndex < xSamples - 1; xIndex += 1) {
      const corners = [grid[yIndex][xIndex], grid[yIndex][xIndex + 1], grid[yIndex + 1][xIndex + 1], grid[yIndex + 1][xIndex]];
      if (corners.some((corner) => !corner)) continue;
      const zMean = corners.reduce((sum, corner) => sum + corner.z, 0) / corners.length;
      const xMean = corners.reduce((sum, corner) => sum + corner.x, 0) / corners.length;
      const yMean = corners.reduce((sum, corner) => sum + corner.y, 0) / corners.length;
      patches.push({
        corners,
        zMean,
        depth: surfaceDepth(xMean, yMean, zMean, ranges)
      });
    }
  }
  patches.sort((a, b) => a.depth - b.depth);
  const opacity = axisOpacity(plot.options.opacity ?? axisOptions.opacity ?? 0.5);
  return patches.map((patch) => {
    const fill = pgfplotsSurfacePatchColor(plot.options, patch.zMean, ranges, plotIndex);
    const points = patch.corners.map((corner) => formatAxisPoint(corner.projected)).join(" -- ");
    return `\\draw[axis surface, draw=${fill}, fill=${fill}, opacity=${opacity}, line width=0.08pt] ${points} -- cycle;`;
  });
}

function clipDomainToRange(domain, min, max) {
  const start = Math.max(domain.start, min);
  const end = Math.min(domain.end, max);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return null;
  return { start, end };
}

function clipAxisDataPointsToRanges(points, ranges) {
  if (points.length < 2) return points.filter((point) => axisPointInRange(point, ranges));
  const clipped = [];
  for (let index = 1; index < points.length; index += 1) {
    const segment = clipAxisSegment(points[index - 1], points[index], ranges);
    if (!segment) continue;
    appendAxisPoint(clipped, segment[0]);
    appendAxisPoint(clipped, segment[1]);
  }
  return clipped;
}

function axisPointInRange(point, ranges) {
  if (Number.isFinite(ranges.xMin) && point.x < ranges.xMin) return false;
  if (Number.isFinite(ranges.xMax) && point.x > ranges.xMax) return false;
  if (Number.isFinite(ranges.yMin) && point.y < ranges.yMin) return false;
  if (Number.isFinite(ranges.yMax) && point.y > ranges.yMax) return false;
  return true;
}

function clipAxisCombDataPoints(points, ranges) {
  return points
    .filter((point) => {
      if (Number.isFinite(ranges.xMin) && point.x < ranges.xMin) return false;
      if (Number.isFinite(ranges.xMax) && point.x > ranges.xMax) return false;
      return true;
    })
    .map((point) => ({ ...point, y: clipAxisValue(point.y, ranges.yMin, ranges.yMax) }));
}

function clipAxisValue(value, min, max) {
  let clipped = value;
  if (Number.isFinite(min)) clipped = Math.max(clipped, min);
  if (Number.isFinite(max)) clipped = Math.min(clipped, max);
  return clipped;
}

function clipAxisSegment(start, end, ranges) {
  let t0 = 0;
  let t1 = 1;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const constraints = [];
  if (Number.isFinite(ranges.xMin)) constraints.push([-dx, start.x - ranges.xMin]);
  if (Number.isFinite(ranges.xMax)) constraints.push([dx, ranges.xMax - start.x]);
  if (Number.isFinite(ranges.yMin)) constraints.push([-dy, start.y - ranges.yMin]);
  if (Number.isFinite(ranges.yMax)) constraints.push([dy, ranges.yMax - start.y]);

  for (const [p, q] of constraints) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }

  return [
    { x: start.x + dx * t0, y: start.y + dy * t0 },
    { x: start.x + dx * t1, y: start.y + dy * t1 }
  ];
}

function appendAxisPoint(points, point) {
  const previous = points[points.length - 1];
  if (previous && Math.abs(previous.x - point.x) < 1e-9 && Math.abs(previous.y - point.y) < 1e-9) return;
  points.push(point);
}

function parseZRestriction(plotOptions = {}, axisOptions = {}) {
  const raw =
    plotOptions["restrict z to domain*"] ??
    plotOptions["restrict z to domain"] ??
    axisOptions["restrict z to domain*"] ??
    axisOptions["restrict z to domain"];
  if (!raw) return null;
  const domain = parseDomain(raw);
  return {
    ...domain,
    clamp: plotOptions["restrict z to domain*"] !== undefined || axisOptions["restrict z to domain*"] !== undefined
  };
}

function restrictSurfaceZ(value, restriction) {
  if (!Number.isFinite(value)) return NaN;
  if (!restriction) return value;
  if (value < restriction.start) return restriction.clamp ? restriction.start : NaN;
  if (value > restriction.end) return restriction.clamp ? restriction.end : NaN;
  return value;
}

function surfaceDepth(x, y, z, ranges) {
  const xSpan = ranges.xMax - ranges.xMin || 1;
  const ySpan = ranges.yMax - ranges.yMin || 1;
  const zSpan = ranges.zMax - ranges.zMin || 1;
  const nx = (x - ranges.xMin) / xSpan;
  const ny = (y - ranges.yMin) / ySpan;
  const nz = (z - ranges.zMin) / zSpan;
  return nx + ny - nz * 0.35;
}

function pgfplotsSurfacePatchColor(options = {}, z, ranges, plotIndex = 0) {
  if (options.fill && options.fill !== true) return plotColorValue(options.fill);
  const explicit = explicitPlotColor(options);
  if (explicit) return plotColorValue(explicit);
  return pgfplotsSurfaceColor(z, ranges, plotIndex);
}

function pgfplotsSurfaceColor(z, ranges, plotIndex = 0) {
  const zSpan = ranges.zMax - ranges.zMin || 1;
  const t = Math.max(0, Math.min(1, (z - ranges.zMin) / zSpan));
  const stops = [
    { t: 0, color: [38, 64, 190] },
    { t: 0.42, color: [70, 120, 255] },
    { t: 0.68, color: [255, 218, 60] },
    { t: 1, color: [240, 45, 20] }
  ];
  for (let index = 1; index < stops.length; index += 1) {
    if (t <= stops[index].t) {
      const previous = stops[index - 1];
      const next = stops[index];
      const local = (t - previous.t) / (next.t - previous.t || 1);
      const rgb = previous.color.map((channel, channelIndex) => Math.round(channel + (next.color[channelIndex] - channel) * local));
      return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    }
  }
  return selectPlotColor({}, plotIndex);
}

function axisOpacity(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
}

function clipDomainToAxisRange(domain, ranges) {
  const start = Math.max(domain.start, ranges.xMin);
  const end = Math.min(domain.end, ranges.xMax);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return null;
  return { start, end };
}

function axisPlotPointChain(points, axisOptions, plotOptions) {
  if (points.length < 2) return points.map(formatAxisPoint).join(" -- ");
  if (!isConstPlot(axisOptions, plotOptions) && isSmoothAxisPlot(plotOptions, axisOptions) && points.length >= 3) {
    return smoothAxisPlotPointChain(points, plotOptions);
  }
  if (!isConstPlot(axisOptions, plotOptions)) return points.map(formatAxisPoint).join(" -- ");
  const stepped = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    stepped.push({ x: current.x, y: previous.y }, current);
  }
  return stepped.map(formatAxisPoint).join(" -- ");
}

function isSmoothAxisPlot(plotOptions = {}, axisOptions = {}) {
  const value = plotOptions.smooth ?? axisOptions.smooth;
  if (value === undefined || value === null || value === false) return false;
  const text = String(value).trim().toLowerCase();
  return text !== "false" && text !== "0";
}

function smoothAxisPlotPointChain(points, plotOptions = {}) {
  const rawTension = evaluateMath(plotOptions.tension ?? 0.5, {});
  const tension = Number.isFinite(rawTension) && rawTension > 0 ? Math.min(rawTension, 3) : 1;
  const factor = tension * 0.2775;
  const parts = [formatAxisPoint(points[0])];
  let first = points[0];
  let second = points[1];
  let firstSupport = { ...first };
  for (let index = 2; index < points.length; index += 1) {
    const current = points[index];
    const support = {
      x: (current.x - first.x) * factor,
      y: (current.y - first.y) * factor
    };
    const secondSupport = {
      x: second.x - support.x,
      y: second.y - support.y
    };
    parts.push(`.. controls ${formatAxisPoint(firstSupport)} and ${formatAxisPoint(secondSupport)} .. ${formatAxisPoint(second)}`);
    firstSupport = {
      x: second.x + support.x,
      y: second.y + support.y
    };
    first = second;
    second = current;
  }
  parts.push(`.. controls ${formatAxisPoint(firstSupport)} and ${formatAxisPoint(second)} .. ${formatAxisPoint(second)}`);
  return parts.join(" ");
}

function isConstPlot(axisOptions, plotOptions) {
  return Boolean(axisOptions["const plot"] || plotOptions["const plot"]);
}

function isAxisBarPlot(axisOptions, plotOptions, axis) {
  const key = axis === "x" ? "xbar" : "ybar";
  return Boolean(axisOptions[key] || plotOptions[key]);
}

function isAxisCombPlot(axisOptions, plotOptions, axis) {
  const key = axis === "x" ? "xcomb" : "ycomb";
  return Boolean(axisOptions[key] || plotOptions[key]);
}

function renderAxisComb(points, axisOptions, ranges, geometry, plotOptions, plotIndex, orientation) {
  const commands = [];
  const style = joinOptions(["axis comb", selectPlotStyle(plotOptions, plotIndex)]);
  const xBaseline = ranges.xMin <= 0 && ranges.xMax >= 0 ? 0 : ranges.xMin;
  const yBaseline = ranges.yMin <= 0 && ranges.yMax >= 0 ? 0 : ranges.yMin;
  for (const point of points) {
    const from = orientation === "x" ? geometry.mapPoint({ x: xBaseline, y: point.y }) : geometry.mapPoint({ x: point.x, y: yBaseline });
    const to = geometry.mapPoint(point);
    commands.push(`\\draw[${style}] ${formatAxisPoint(from)} -- ${formatAxisPoint(to)};`);
  }
  return commands;
}

function shouldRenderPlotMarks(options = {}) {
  if (options["no markers"] || String(options.mark || "").trim().toLowerCase() === "none") return false;
  return Boolean(options["only marks"] || options.scatter || options.mark);
}

function renderAxisBars(points, axisOptions, geometry, plotOptions, plotIndex, orientation) {
  const commands = [];
  const width = axisNumber(axisOptions["bar width"] || plotOptions["bar width"], 0.2);
  const style = joinOptions(["axis bar", selectPlotFillStyle(plotOptions, plotIndex), "draw=none"]);
  for (const point of points) {
    if (orientation === "y") {
      const baseline = axisNumber(axisOptions["ybar interval"] ? axisOptions.ymin : 0, 0);
      const corners = [
        geometry.mapPoint({ x: point.x - width / 2, y: baseline }),
        geometry.mapPoint({ x: point.x + width / 2, y: baseline }),
        geometry.mapPoint({ x: point.x + width / 2, y: point.y }),
        geometry.mapPoint({ x: point.x - width / 2, y: point.y })
      ];
      commands.push(`\\draw[${style}] ${corners.map(formatAxisPoint).join(" -- ")} -- cycle;`);
    } else {
      const baseline = axisNumber(axisOptions["xbar interval"] ? axisOptions.xmin : 0, 0);
      const corners = [
        geometry.mapPoint({ x: baseline, y: point.y - width / 2 }),
        geometry.mapPoint({ x: point.x, y: point.y - width / 2 }),
        geometry.mapPoint({ x: point.x, y: point.y + width / 2 }),
        geometry.mapPoint({ x: baseline, y: point.y + width / 2 })
      ];
      commands.push(`\\draw[${style}] ${corners.map(formatAxisPoint).join(" -- ")} -- cycle;`);
    }
  }
  return commands;
}

function renderPlotMark(point, options, plotIndex) {
  const mark = String(options.mark || (options.scatter ? "*" : "*")).trim().toLowerCase();
  const stroke = plotColorValue(selectPlotColor(options, plotIndex));
  const fill = plotColorValue(selectPlotMarkFillColor(options, plotIndex));
  const style = joinOptions(["axis mark", `draw=${stroke}`, `fill=${fill}`, "fill opacity=1", plotLineWidthOption(options)]);
  const size = axisMarkRadius(options);
  if (mark === "x" || mark === "+") {
    return `\\draw[${joinOptions(["axis mark", `draw=${stroke}`, plotLineWidthOption(options)])}] ${formatAxisPoint(offsetPoint(point, -size, -size))} -- ${formatAxisPoint(offsetPoint(point, size, size))} ${formatAxisPoint(offsetPoint(point, -size, size))} -- ${formatAxisPoint(offsetPoint(point, size, -size))};`;
  }
  if (mark === "square" || mark === "square*") {
    return `\\draw[${style}] ${formatAxisPoint(offsetPoint(point, -size, -size))} -- ${formatAxisPoint(offsetPoint(point, size, -size))} -- ${formatAxisPoint(offsetPoint(point, size, size))} -- ${formatAxisPoint(offsetPoint(point, -size, size))} -- cycle;`;
  }
  return `\\draw[${style}] ${formatAxisPoint(point)} circle(${formatAxisNumber(size)});`;
}

function axisMarkRadius(options = {}) {
  const raw = options["mark size"] ?? options.markSize ?? "2pt";
  const text = String(raw ?? "").trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  const value = /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(text) ? parseDimension(`${text}pt`, {}) : parseDimension(text, {});
  return Number.isFinite(value) && value > 0 ? value : parseDimension("2pt", {});
}

function plotLineWidthOption(options = {}) {
  if (options["line width"]) return `line width=${options["line width"]}`;
  if (options["ultra thick"]) return "ultra thick";
  if (options["very thick"]) return "very thick";
  if (options.thick) return "thick";
  if (options.semithick) return "semithick";
  if (options.thin) return "thin";
  if (options["very thin"]) return "very thin";
  if (options["ultra thin"]) return "ultra thin";
  return "";
}

function renderNodesNearCoords(plot, axisOptions, geometry) {
  if (!axisOptions["nodes near coords"] && !plot.options["nodes near coords"]) return [];
  return (plot.points || []).map((point) => {
    const mapped = geometry.mapPoint(point);
    return `\\node[axis near coord, anchor=south, font=\\scriptsize] at ${formatAxisPoint(offsetPoint(mapped, 0, 0.08))} {${formatAxisNumber(point.y)}};`;
  });
}

function renderAxisPlotInlineNodes(nodes = [], mappedPoints = [], plotColor = "") {
  if (!nodes.length || !mappedPoints.length) return [];
  const commands = [];
  for (const node of nodes) {
    const base = interpolatePolylinePoint(mappedPoints, axisNumber(node.options?.pos, node.options?.pos === undefined ? 1 : 0.5));
    if (!base) continue;
    const shift = {
      x: parseDimension(String(node.options?.xshift || "0"), {}),
      y: parseDimension(String(node.options?.yshift || "0"), {})
    };
    const point = offsetPoint(base, Number.isFinite(shift.x) ? shift.x : 0, Number.isFinite(shift.y) ? shift.y : 0);
    const anchor = inlineAxisNodeAnchor(node.options || {});
    const inheritedTextColor = axisInlineNodeTextColor(node.options || {}, plotColor);
    const style = joinOptions([
      "axis plot node",
      `anchor=${anchor}`,
      node.options?.font ? `font=${node.options.font}` : "",
      inheritedTextColor ? `text=${inheritedTextColor}` : "",
      axisInlineNodeOption("pin", node.options?.pin),
      axisInlineNodeOption("label", node.options?.label),
      axisInlineNodeOption("pin distance", node.options?.["pin distance"]),
      axisInlineNodeOption("pin edge", node.options?.["pin edge"]),
      node.options?.fill && node.options.fill !== true ? `fill=${node.options.fill}` : "",
      node.options?.draw && node.options.draw !== true ? `draw=${node.options.draw}` : node.options?.draw === true ? "draw" : ""
    ]);
    if (Math.hypot(point.x - base.x, point.y - base.y) > 1e-6 && (node.options?.["append after command"] || anchor.includes("west") || anchor.includes("east"))) {
      commands.push(`\\draw[axis plot node connector, gray, thin] ${formatAxisPoint(base)} -- ${formatAxisPoint(point)};`);
    }
    commands.push(`\\node[${style}] at ${formatAxisPoint(point)} {${node.text}};`);
  }
  return commands;
}

function axisInlineNodeTextColor(options = {}, plotColor = "") {
  if (options.text && options.text !== true) return "";
  if (options.color && options.color !== true) return "";
  const color = plotColorValue(plotColor);
  return color && color !== "black" ? color : "";
}

function axisInlineNodeOption(key, value) {
  if (value === undefined || value === null || value === false || value === "") return "";
  if (Array.isArray(value)) return value.map((item) => axisInlineNodeOption(key, item)).filter(Boolean).join(", ");
  if (value === true) return key;
  return `${key}={${value}}`;
}

function interpolatePolylinePoint(points, rawPos) {
  if (!points.length) return null;
  if (points.length === 1) return points[0];
  const pos = Math.max(0, Math.min(1, Number.isFinite(rawPos) ? rawPos : 0.5));
  const lengths = [];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const length = Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
    lengths.push(length);
    total += length;
  }
  if (total <= 1e-9) return points[0];
  let target = total * pos;
  for (let index = 1; index < points.length; index += 1) {
    const length = lengths[index - 1];
    if (target <= length || index === points.length - 1) {
      const t = length <= 1e-9 ? 0 : target / length;
      return {
        x: points[index - 1].x + (points[index].x - points[index - 1].x) * t,
        y: points[index - 1].y + (points[index].y - points[index - 1].y) * t
      };
    }
    target -= length;
  }
  return points[points.length - 1];
}

function inlineAxisNodeAnchor(options = {}) {
  const explicit = String(options.anchor || "").trim();
  if (explicit) return explicit;
  if (options.above) return "south";
  if (options.below) return "north";
  if (options.left) return "east";
  if (options.right) return "west";
  return "center";
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
      ? offsetPoint(geometry.mapPoint({ x: ranges.xMax, y: yAxis }), Math.min(0.08, xOffset * 0.25), 0)
      : offsetPoint(geometry.mapPoint({ x: (ranges.xMin + ranges.xMax) / 2, y: ranges.yMin }), 0, -yOffset);
    const placement = applyAxisLabelStyle(point, middleAxis ? "south east" : "north", axisOptions["xlabel style"] || axisOptions["x label style"], {
      xOffset,
      yOffset,
      defaultHorizontal: middleAxis ? "right" : "center",
      defaultVertical: middleAxis ? "above" : "below"
    });
    commands.push(`\\node[axis label, anchor=${placement.anchor}] at ${formatAxisPoint(placement.point)} {${axisOptions.xlabel}};`);
  }
  if (axisOptions.ylabel) {
    const ylabelStyle = axisOptions["ylabel style"] || axisOptions["y label style"];
    const ylabelXOffset = middleAxis ? xOffset * 0.2 : Math.max(xOffset * 2.6, 1.1);
    const point = middleAxis
      ? offsetPoint(geometry.mapPoint({ x: xAxis, y: ranges.yMax }), ylabelXOffset, -yOffset * 0.2)
      : offsetPoint(geometry.mapPoint({ x: ranges.xMin, y: (ranges.yMin + ranges.yMax) / 2 }), -ylabelXOffset, 0);
    const placement = applyAxisLabelStyle(point, middleAxis ? "west" : "east", ylabelStyle, {
      xOffset,
      yOffset,
      defaultHorizontal: middleAxis ? "right" : "left",
      defaultVertical: middleAxis ? "below" : "center"
    });
    const rotation = axisLabelRotation(ylabelStyle, middleAxis ? null : 90);
    const labelOptions = ["axis label", `anchor=${placement.anchor}`];
    if (rotation !== null) labelOptions.push(`rotate=${rotation}`);
    commands.push(`\\node[${joinTikzOptions(labelOptions)}] at ${formatAxisPoint(placement.point)} {${axisOptions.ylabel}};`);
  }
  if (axisOptions.title) {
    const point = offsetPoint(geometry.mapPoint({ x: (ranges.xMin + ranges.xMax) / 2, y: ranges.yMax }), 0, yOffset);
    commands.push(`\\node[axis label, anchor=south] at ${formatAxisPoint(point)} {${axisOptions.title}};`);
  }
  return commands;
}

function axisLabelRotation(rawStyle, fallback) {
  const match = String(rawStyle || "").match(/\brotate\s*=\s*([-+]?\d+(?:\.\d+)?)/);
  if (!match) return fallback;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : fallback;
}

function applyAxisLabelStyle(point, anchor, rawStyle, placement) {
  const style = String(rawStyle || "").toLowerCase();
  const next = { point: { ...point }, anchor };
  if (!style.trim()) return next;
  let horizontal = anchor.includes("east") ? "east" : anchor.includes("west") ? "west" : "";
  let vertical = anchor.includes("north") ? "north" : anchor.includes("south") ? "south" : "";
  if (/\bleft\b/.test(style) && placement.defaultHorizontal !== "left") {
    next.point.x -= placement.xOffset * 1.2;
    horizontal = "east";
  }
  if (/\bright\b/.test(style) && placement.defaultHorizontal !== "right") {
    next.point.x += placement.xOffset * 1.2;
    horizontal = "west";
  }
  if (/\bbelow\b/.test(style) && placement.defaultVertical !== "below") {
    next.point.y -= placement.yOffset * 0.6;
    vertical = "north";
  }
  if (/\babove\b/.test(style) && placement.defaultVertical !== "above") {
    next.point.y += placement.yOffset * 0.6;
    vertical = "south";
  }
  next.anchor = [vertical, horizontal].filter(Boolean).join(" ") || anchor;
  return next;
}

function renderAxis3DBox(_axisOptions, ranges, geometry) {
  const corners = axis3DBoxCorners(ranges, geometry);
  const style = "axis line, gray!70, line width=0.28pt";
  return [
    `\\draw[${style}] ${formatAxisPoint(corners.c000)} -- ${formatAxisPoint(corners.c100)} -- ${formatAxisPoint(corners.c110)} -- ${formatAxisPoint(corners.c010)} -- cycle;`,
    `\\draw[${style}] ${formatAxisPoint(corners.c001)} -- ${formatAxisPoint(corners.c101)} -- ${formatAxisPoint(corners.c111)} -- ${formatAxisPoint(corners.c011)} -- cycle;`,
    `\\draw[${style}] ${formatAxisPoint(corners.c000)} -- ${formatAxisPoint(corners.c001)};`,
    `\\draw[${style}] ${formatAxisPoint(corners.c100)} -- ${formatAxisPoint(corners.c101)};`,
    `\\draw[${style}] ${formatAxisPoint(corners.c010)} -- ${formatAxisPoint(corners.c011)};`,
    `\\draw[${style}] ${formatAxisPoint(corners.c110)} -- ${formatAxisPoint(corners.c111)};`
  ];
}

function renderAxis3DTicks(axisOptions, ranges, geometry) {
  const commands = [];
  const tickStyle = "axis tick, gray!70, line width=0.22pt";
  const labelStyle = "axis tick label, anchor=north, font=\\scriptsize";
  const xTicks = axisTickValues(axisOptions.xtick, "x", []);
  const yTicks = axisTickValues(axisOptions.ytick, "y", []);
  const zTicks = axisTickValues(axisOptions.ztick, "z", []);
  const xDistanceTicks = axisTickDistanceValues(axisOptions, "x", ranges.xMin, ranges.xMax);
  const yDistanceTicks = axisTickDistanceValues(axisOptions, "y", ranges.yMin, ranges.yMax);
  const zDistanceTicks = axisTickDistanceValues(axisOptions, "z", ranges.zMin, ranges.zMax);
  const resolvedXTicks = xTicks.length ? xTicks : xDistanceTicks.length ? xDistanceTicks : axisMajorTickValues(ranges.xMin, ranges.xMax, 5);
  const resolvedYTicks = yTicks.length ? yTicks : yDistanceTicks.length ? yDistanceTicks : axisMajorTickValues(ranges.yMin, ranges.yMax, 5);
  const resolvedZTicks = zTicks.length ? zTicks : zDistanceTicks.length ? zDistanceTicks : axisMajorTickValues(ranges.zMin, ranges.zMax, 4);
  for (const x of resolvedXTicks) {
    const base = geometry.mapPoint3d({ x, y: ranges.yMin, z: ranges.zMin });
    const to = offsetPoint(base, 0, -0.08);
    commands.push(`\\draw[${tickStyle}] ${formatAxisPoint(base)} -- ${formatAxisPoint(to)};`);
    commands.push(`\\node[${labelStyle}] at ${formatAxisPoint(offsetPoint(to, 0, -0.05))} {${formatAxisNumber(x)}};`);
  }
  for (const y of resolvedYTicks) {
    const base = geometry.mapPoint3d({ x: ranges.xMax, y, z: ranges.zMin });
    const to = offsetPoint(base, 0.08, 0);
    commands.push(`\\draw[${tickStyle}] ${formatAxisPoint(base)} -- ${formatAxisPoint(to)};`);
    commands.push(`\\node[axis tick label, anchor=west, font=\\scriptsize] at ${formatAxisPoint(offsetPoint(to, 0.05, 0))} {${formatAxisNumber(y)}};`);
  }
  for (const z of resolvedZTicks) {
    const base = geometry.mapPoint3d({ x: ranges.xMin, y: ranges.yMin, z });
    const to = offsetPoint(base, -0.08, 0);
    commands.push(`\\draw[${tickStyle}] ${formatAxisPoint(base)} -- ${formatAxisPoint(to)};`);
    commands.push(`\\node[axis tick label, anchor=east, font=\\scriptsize] at ${formatAxisPoint(offsetPoint(to, -0.05, 0))} {${formatAxisNumber(z)}};`);
  }
  return commands;
}

function renderAxisLabels3D(axisOptions, ranges, geometry) {
  const commands = [];
  const xLabelPoint = geometry.mapPoint3d({ x: (ranges.xMin + ranges.xMax) / 2, y: ranges.yMin, z: ranges.zMin });
  const yLabelPoint = geometry.mapPoint3d({ x: ranges.xMax, y: (ranges.yMin + ranges.yMax) / 2, z: ranges.zMin });
  const zLabelPoint = geometry.mapPoint3d({ x: ranges.xMin, y: ranges.yMin, z: (ranges.zMin + ranges.zMax) / 2 });
  if (axisOptions.xlabel) {
    commands.push(`\\node[axis label, anchor=north] at ${formatAxisPoint(offsetPoint(xLabelPoint, 0, -0.36))} {${axisOptions.xlabel}};`);
  }
  if (axisOptions.ylabel) {
    commands.push(`\\node[axis label, anchor=west] at ${formatAxisPoint(offsetPoint(yLabelPoint, 0.42, -0.02))} {${axisOptions.ylabel}};`);
  }
  if (axisOptions.zlabel) {
    commands.push(`\\node[axis label, anchor=south, rotate=90] at ${formatAxisPoint(offsetPoint(zLabelPoint, -0.48, 0))} {${axisOptions.zlabel}};`);
  }
  if (axisOptions.title) {
    const titlePoint = geometry.mapPoint3d({ x: (ranges.xMin + ranges.xMax) / 2, y: (ranges.yMin + ranges.yMax) / 2, z: ranges.zMax });
    commands.push(`\\node[axis label, anchor=south] at ${formatAxisPoint(offsetPoint(titlePoint, 0, 0.25))} {${axisOptions.title}};`);
  }
  return commands;
}

function axis3DBoxCorners(ranges, geometry) {
  return {
    c000: geometry.mapPoint3d({ x: ranges.xMin, y: ranges.yMin, z: ranges.zMin }),
    c100: geometry.mapPoint3d({ x: ranges.xMax, y: ranges.yMin, z: ranges.zMin }),
    c010: geometry.mapPoint3d({ x: ranges.xMin, y: ranges.yMax, z: ranges.zMin }),
    c110: geometry.mapPoint3d({ x: ranges.xMax, y: ranges.yMax, z: ranges.zMin }),
    c001: geometry.mapPoint3d({ x: ranges.xMin, y: ranges.yMin, z: ranges.zMax }),
    c101: geometry.mapPoint3d({ x: ranges.xMax, y: ranges.yMin, z: ranges.zMax }),
    c011: geometry.mapPoint3d({ x: ranges.xMin, y: ranges.yMax, z: ranges.zMax }),
    c111: geometry.mapPoint3d({ x: ranges.xMax, y: ranges.yMax, z: ranges.zMax })
  };
}

function renderLegendEntries(axisOptions, ranges, geometry, bodyEntries = [], addplots = []) {
  const raw = axisOptions["legend entries"];
  const entries = raw ? splitLegendEntries(raw) : bodyEntries;
  if (!entries.length) return [];
  const font = legendFontOption(axisOptions);
  const fontScale = fontScaleFromTikzFont(font);
  const placement = legendPlacement(axisOptions["legend pos"], geometry);
  const rowHeight = Math.max(0.19, 0.31 * fontScale / 0.7);
  const imageWidth = Math.max(0.28, 0.38 * fontScale / 0.7);
  const horizontalPadding = Math.max(0.12, 0.26 * fontScale / 0.7);
  const verticalPadding = Math.max(0.08, 0.16 * fontScale / 0.7);
  const boxWidth = Math.max(0.85, horizontalPadding * 2 + imageWidth + 0.12 + Math.max(...entries.map((entry) => estimateLegendEntryWidth(entry, fontScale))));
  const boxHeight = Math.max(0.28, verticalPadding + entries.length * rowHeight);
  const box = legendBoxFromAnchor(placement.point, placement.anchor, boxWidth, boxHeight);
  const commands = [
    `\\draw[axis legend box, draw=black, fill=white, line width=0.2pt] ${formatAxisPoint({ x: box.left, y: box.top })} -- ${formatAxisPoint({
      x: box.right,
      y: box.top
    })} -- ${formatAxisPoint({ x: box.right, y: box.bottom })} -- ${formatAxisPoint({ x: box.left, y: box.bottom })} -- cycle;`
  ];
  entries.forEach((entry, index) => {
    const y = box.top - verticalPadding / 2 - rowHeight * (index + 0.5);
    const x0 = box.left + horizontalPadding * 0.55;
    const x1 = x0 + imageWidth;
    const textX = x1 + Math.max(0.08, 0.12 * fontScale / 0.7);
    const plot = addplots[index];
    const imageStyle = joinOptions(["axis legend image", selectPlotStyle(plot?.options || {}, index), axisOptions.thick ? "thick" : ""]);
    commands.push(`\\draw[${imageStyle}] ${formatAxisPoint({ x: x0, y })} -- ${formatAxisPoint({ x: x1, y })};`);
    commands.push(`\\node[axis legend, anchor=west, ${font}] at ${formatAxisPoint({ x: textX, y })} {${entry.trim()}};`);
  });
  return commands;
}

function legendFontOption(axisOptions = {}) {
  const style = parseOptions(axisOptions["legend style"] || "");
  const font = style.font ? String(style.font).trim() : "";
  return font ? `font=${font}` : "font=\\scriptsize";
}

function legendPlacement(rawPosition, geometry) {
  const value = String(rawPosition || "north east").trim().toLowerCase();
  const presets = {
    "south west": { x: 0.03, y: 0.03, anchor: "south west" },
    "south east": { x: 0.97, y: 0.03, anchor: "south east" },
    "north west": { x: 0.03, y: 0.97, anchor: "north west" },
    "north east": { x: 0.97, y: 0.97, anchor: "north east" },
    "outer north east": { x: 1.03, y: 1, anchor: "north west" }
  };
  const preset = presets[value] || presets["north east"];
  return {
    anchor: preset.anchor,
    point: {
      x: geometry.origin.x + geometry.width * preset.x,
      y: geometry.origin.y + geometry.height * preset.y
    }
  };
}

function legendBoxFromAnchor(point, anchor, width, height) {
  const horizontal = anchor.includes("east") ? "east" : "west";
  const vertical = anchor.includes("south") ? "south" : "north";
  const left = horizontal === "east" ? point.x - width : point.x;
  const right = left + width;
  const bottom = vertical === "north" ? point.y - height : point.y;
  const top = bottom + height;
  return { left, right, top, bottom };
}

function estimateLegendEntryWidth(entry, fontScale = 0.7) {
  return Math.max(0.28, stripTexForLength(entry).length * 0.075 * (fontScale / 0.7));
}

function splitLegendEntries(raw) {
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

function stripTexForLength(value) {
  return String(value || "")
    .replace(/\\[a-zA-Z]+\s*/g, "")
    .replace(/[{}$]/g, "")
    .trim();
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

function axisMajorTickValues(min, max, maxTicks = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [];
  const span = max - min;
  const rawStep = Math.abs(span) / Math.max(1, maxTicks - 1);
  const exponent = Math.floor(Math.log10(rawStep));
  const base = 10 ** exponent;
  const fraction = rawStep / base;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  const step = niceFraction * base;
  const start = Math.ceil(min / step) * step;
  const values = [];
  for (let value = start; value <= max + step * 0.2; value += step) {
    const rounded = roundAxis(value);
    if (rounded >= min - step * 0.2 && rounded <= max + step * 0.2) values.push(rounded);
    if (values.length >= maxTicks + 2) break;
  }
  return values;
}

function axisSamples(raw, maxSamples) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 25;
  return Math.max(2, Math.min(maxSamples, Math.round(parsed)));
}

function evaluateAxisExpression(expression, x, axisOptions = {}, variables = {}) {
  const trigFormat = String(axisOptions["trig format"] || "").trim().toLowerCase();
  const radianTrig = trigFormat === "rad" || trigFormat === "radians";
  const withDeclaredFunctions = expandDeclaredPgfFunctions(expression, axisOptions["pgfplots declared functions"] || []);
  const withHelpers = expandPgfMathHelpers(withDeclaredFunctions);
  let substituted = String(withHelpers).replace(/\\x\b/g, `(${x})`).replace(/\bx\b/g, `(${x})`);
  for (const [name, value] of Object.entries(variables || {})) {
    substituted = substituted.replace(new RegExp(`\\\\${name}\\b`, "g"), `(${value})`).replace(new RegExp(`\\b${name}\\b`, "g"), `(${value})`);
  }
  const normalized = normalizeAxisExpression(substituted, radianTrig);
  if (!normalized) return NaN;
  if (!/^[0-9+\-*/%().,\sA-Za-z<>=!?:&|]+$/.test(normalized)) {
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : NaN;
  }
  try {
    const value = Function(`"use strict"; const deg = (value) => value * 180 / Math.PI; return (${normalized});`)();
    return Number.isFinite(value) ? value : NaN;
  } catch {
    return NaN;
  }
}

function evaluateAxisExpressionAtSample(expression, x, axisOptions = {}, context = {}) {
  const value = evaluateAxisExpression(expression, x, axisOptions, context.variables);
  if (Number.isFinite(value)) return value;

  const { domain, index, samples } = context;
  if (!domain || samples < 2 || (index !== 0 && index !== samples - 1)) return value;
  const span = domain.end - domain.start;
  if (!Number.isFinite(span) || span === 0) return value;

  const direction = index === 0 ? Math.sign(span) || 1 : -(Math.sign(span) || 1);
  const step = Math.abs(span) / Math.max(1, samples - 1);
  const epsilon = Math.min(Math.max(Math.abs(span), 1) * 1e-7, step * 1e-4);
  const probe = evaluateAxisExpression(expression, x + direction * epsilon, axisOptions, context.variables);
  if (!Number.isFinite(probe) || Math.abs(probe) > 1e4) return value;
  return Math.abs(probe) < 1e-4 ? 0 : probe;
}

function parsePgfplotsDeclaredFunctions(raw) {
  if (raw === undefined || raw === null || raw === true) return [];
  return optionValues(raw)
    .flatMap((value) => splitTopLevel(String(value), ";"))
    .map((part) => parsePgfplotsDeclaredFunction(part))
    .filter(Boolean);
}

function parsePgfplotsDeclaredFunction(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  const match = text.match(/^\\?([A-Za-z@][A-Za-z0-9@]*)\s*\(([\s\S]*?)\)\s*=\s*([\s\S]+)$/);
  if (!match) return null;
  return {
    name: match[1],
    params: splitTopLevel(match[2]).map((param) => param.trim().replace(/^\\/, "")).filter(Boolean),
    body: match[3].trim()
  };
}

function expandDeclaredPgfFunctions(expression, declarations = []) {
  if (!declarations.length) return expression;
  let expanded = String(expression || "");
  for (let iteration = 0; iteration < 12; iteration += 1) {
    let next = expanded;
    for (const declaration of declarations) {
      next = replaceDeclaredFunctionCalls(next, declaration);
    }
    if (next === expanded) break;
    expanded = next;
  }
  return expanded;
}

function replaceDeclaredFunctionCalls(input, declaration) {
  let output = "";
  let cursor = 0;
  while (cursor < input.length) {
    const call = findDeclaredFunctionCall(input, declaration, cursor);
    if (!call) {
      output += input.slice(cursor);
      break;
    }
    output += input.slice(cursor, call.start);
    output += `(${instantiateDeclaredFunction(declaration, splitTopLevel(call.args))})`;
    cursor = call.end;
  }
  return output;
}

function findDeclaredFunctionCall(input, declaration, start) {
  let cursor = start;
  while (cursor < input.length) {
    const index = input.indexOf(declaration.name, cursor);
    if (index === -1) return null;
    const before = input[index - 1] || "";
    if (/[A-Za-z0-9_\\]/.test(before)) {
      cursor = index + declaration.name.length;
      continue;
    }
    let paren = skipWhitespace(input, index + declaration.name.length);
    if (input[paren] !== "(") {
      cursor = index + declaration.name.length;
      continue;
    }
    const balanced = extractBalanced(input, paren, "(", ")");
    if (!balanced) return null;
    return { start: index, args: balanced.content, end: balanced.end };
  }
  return null;
}

function instantiateDeclaredFunction(declaration, args) {
  let body = declaration.body;
  declaration.params.forEach((param, index) => {
    const value = args[index] ?? "0";
    const escaped = escapeRegExp(param);
    body = body.replace(new RegExp(`\\\\${escaped}\\b`, "g"), `(${value})`).replace(new RegExp(`\\b${escaped}\\b`, "g"), `(${value})`);
  });
  return body;
}

function expandPgfMathHelpers(expression) {
  return String(expression || "").replace(/\bgauss\s*\(\s*([^,()]+)\s*,\s*([^()]+)\)/g, (_match, mean, sigma) => {
    const mu = mean.trim();
    const sd = sigma.trim();
    return `(1/((${sd})*sqrt(2*pi))*exp(-((x-(${mu}))^2)/(2*(${sd})^2)))`;
  });
}

function normalizeAxisExpression(input, radianTrig) {
  const trigPrefix = radianTrig ? "Math.$1(" : "Math.$1((Math.PI/180)*";
  const normalized = String(input)
    .trim()
    .replace(/^\{([\s\S]*)\}$/, "$1")
    .replace(/\bpi\b/g, "Math.PI")
    .replace(/\be\b/g, "Math.E")
    .replace(/\^/g, "**")
    .replace(/-\s*(\([^()]+\)|[A-Za-z0-9.]+)\s*\*\*\s*(\([^()]+\)|[A-Za-z0-9.]+)/g, "-($1**$2)")
    .replace(/\bdeg\s*\(([^()]*)\)/g, "(($1)*180/Math.PI)")
    .replace(/\bsqrt\s*\(/g, "Math.sqrt(")
    .replace(/\babs\s*\(/g, "Math.abs(")
    .replace(/\bexp\s*\(/g, "Math.exp(")
    .replace(/\bmax\s*\(/g, "Math.max(")
    .replace(/\bmin\s*\(/g, "Math.min(")
    .replace(/\btanh\s*\(/g, "Math.tanh(")
    .replace(/\blog10\s*\(/g, "Math.log10(")
    .replace(/\bln\s*\(/g, "Math.log(")
    .replace(/(^|[^.A-Za-z0-9_])log\s*\(/g, "$1Math.log(")
    .replace(/\b(sin|cos|tan)\s*\(/g, trigPrefix);
  return disambiguateUnaryExponentiation(normalized);
}

function disambiguateUnaryExponentiation(input) {
  let output = "";
  let cursor = 0;
  while (cursor < input.length) {
    const char = input[cursor];
    if (char !== "-" || !isUnaryMinusContext(input, cursor)) {
      output += char;
      cursor += 1;
      continue;
    }
    const operandStart = skipWhitespace(input, cursor + 1);
    if (input[operandStart] !== "(") {
      output += char;
      cursor += 1;
      continue;
    }
    const operand = extractBalanced(input, operandStart, "(", ")");
    if (!operand) {
      output += char;
      cursor += 1;
      continue;
    }
    const afterOperand = skipWhitespace(input, operand.end);
    if (!input.startsWith("**", afterOperand)) {
      output += char;
      cursor += 1;
      continue;
    }
    const exponentStart = afterOperand + 2;
    const exponent = readExponentOperand(input, exponentStart);
    if (!exponent) {
      output += char;
      cursor += 1;
      continue;
    }
    output += `(-1*${input.slice(operandStart, operand.end)}**${input.slice(exponent.start, exponent.end)})`;
    cursor = exponent.end;
  }
  return output;
}

function isUnaryMinusContext(input, index) {
  let cursor = index - 1;
  while (cursor >= 0 && /\s/.test(input[cursor])) cursor -= 1;
  if (cursor < 0) return true;
  return "([{:,+-*/".includes(input[cursor]);
}

function readExponentOperand(input, start) {
  const cursor = skipWhitespace(input, start);
  if (input[cursor] === "(") return extractBalanced(input, cursor, "(", ")");
  const match = input.slice(cursor).match(/^[A-Za-z0-9_.]+/);
  if (!match) return null;
  return { start: cursor, end: cursor + match[0].length };
}

const PGFPLOTS_DEFAULT_COLORS = ["blue", "red", "brown!80!black", "black!60!green", "orange", "violet", "cyan", "magenta"];

function selectPlotColor(options, plotIndex = 0) {
  const explicit = explicitPlotColor(options);
  if (explicit) return explicit;
  return plotUsesCycleColor(options) ? PGFPLOTS_DEFAULT_COLORS[plotIndex % PGFPLOTS_DEFAULT_COLORS.length] : "black";
}

function selectPlotMarkFillColor(options, plotIndex = 0) {
  const explicit = explicitPlotColor(options);
  const cycle = PGFPLOTS_DEFAULT_COLORS[plotIndex % PGFPLOTS_DEFAULT_COLORS.length];
  if (options["pgfplots plus"]) {
    if (!explicit || explicit === "black") return pgfplotsMarkFillColor(cycle);
    return pgfplotsMarkFillColor(explicit);
  }
  return explicit || (plotUsesCycleColor(options) ? cycle : "black");
}

function pgfplotsMarkFillColor(color) {
  const text = String(color || "").trim();
  const equals = text.indexOf("=");
  if (equals !== -1) {
    const key = text.slice(0, equals);
    const value = text.slice(equals + 1);
    return `${key}=${pgfplotsMarkFillColor(value)}`;
  }
  if (!text || text.includes("!") || text.startsWith("#") || /^rgb\s*\(/i.test(text)) return text;
  return `${text}!80!black`;
}

function explicitPlotColor(options) {
  for (const [key, value] of Object.entries(options || {})) {
    if (key.startsWith("pgfplots ")) continue;
    if (value === true && isPlotColorToken(key)) {
      return key;
    }
    if (key === "color" || key === "draw") return `${key}=${value}`;
  }
  return "";
}

function plotColorValue(color) {
  const text = String(color || "").trim();
  if (text.startsWith("draw=") || text.startsWith("color=") || text.startsWith("fill=")) return text.split("=").slice(1).join("=");
  return text;
}

function plotUsesCycleColor(options = {}) {
  return Boolean(options["pgfplots plus"] || !options["pgfplots explicit options"]);
}

function isPlotColorToken(value) {
  const text = String(value || "").trim();
  return (
    /^(black|white|red|green|blue|cyan|magenta|yellow|gray|grey|orange|purple|brown|pink|violet|lime|teal|olive|lightgray|darkgray)$/i.test(text) ||
    text.includes("!") ||
    /^#[0-9a-f]{6}$/i.test(text) ||
    /^rgb\s*\(/i.test(text)
  );
}

function selectPlotStyle(options, plotIndex = 0) {
  const parts = [selectPlotColor(options, plotIndex)];
  if (options["very thick"]) parts.push("very thick");
  else if (options.thick) parts.push("thick");
  else if (options["line width"]) parts.push(`line width=${options["line width"]}`);
  if (options.dashed) parts.push("dashed");
  if (options.dotted) parts.push("dotted");
  return joinOptions(parts);
}

function selectPlotFillStyle(options, plotIndex = 0) {
  if (options.fill && options.fill !== true) return `fill=${options.fill}`;
  const color = selectPlotColor(options, plotIndex);
  if (color.startsWith("draw=") || color.startsWith("color=")) return `fill=${color.split("=").slice(1).join("=")}`;
  return `fill=${color || PGFPLOTS_DEFAULT_COLORS[plotIndex % PGFPLOTS_DEFAULT_COLORS.length]}`;
}

function plotFillOpacityOption(options = {}) {
  const raw = options["fill opacity"] ?? options.opacity;
  if (raw === undefined || raw === null || raw === true) return "";
  const value = Number(raw);
  if (!Number.isFinite(value)) return "";
  const opacity = value > 1 ? value / 100 : value;
  return `fill opacity=${Math.max(0, Math.min(1, opacity))}`;
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
