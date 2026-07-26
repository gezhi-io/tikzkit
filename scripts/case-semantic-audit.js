#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { findTopLevel, splitTopLevel } from "../src/engine/options.js";
import { collectTexPackages } from "../src/packages/declarations.js";
import { collectPgfplotsLibraries } from "../src/pgfplots/axisOptions.js";
import { collectTikzLibraries } from "../src/tikz/libraries/declarations.js";

const THIS_FILE = fileURLToPath(import.meta.url);
const AUDIT_SCHEMA_VERSION = 1;

const COMMAND_OWNERS = {
  addlegendentry: owner("src/pgfplots/legend.js", "partial", "pgfplots.code.tex"),
  addlegendentryexpanded: owner("src/pgfplots/legend.js", "partial", "pgfplots.code.tex"),
  addplot: owner("src/pgfplots/addplotParser.js", "partial", "pgfplots.code.tex"),
  addplot3: owner("src/pgfplots/addplotParser.js", "partial", "pgfplots.code.tex"),
  begin: owner("src/frontend/parser.js", "stable", "latex.ltx"),
  bcbar: owner("src/packages/bchart.js", "partial"),
  coordinate: owner("src/tikz/commands/coordinate.js", "partial", "tikz.code.tex"),
  ctikzset: owner("src/packages/circuitikz.js", "partial"),
  datavisualization: owner("src/tikz/libraries/datavisualization.js", "partial"),
  def: owner("src/frontend/latex-shell.js", "partial"),
  definecolor: owner("src/packages/xcolor.js", "partial", "xcolor.sty"),
  documentclass: owner("src/frontend/latex-shell.js", "stable", "latex.ltx"),
  draw: owner("src/tikz/commands/draw.js", "partial", "tikz.code.tex"),
  edge: owner("src/engine/pathBuilder.js", "partial", "tikz.code.tex"),
  end: owner("src/frontend/parser.js", "stable", "latex.ltx"),
  fill: owner("src/tikz/commands/fill.js", "partial", "tikz.code.tex"),
  filldraw: owner("src/tikz/commands/fill.js", "partial", "tikz.code.tex"),
  foreach: owner("src/tikz/commands/foreach.js", "partial", "pgffor.code.tex"),
  legend: owner("src/pgfplots/legend.js", "partial"),
  matrix: owner("src/tikz/libraries/matrix.js", "partial"),
  newcommand: owner("src/frontend/latex-shell.js", "partial", "latex.ltx"),
  newenvironment: owner("src/frontend/latex-shell.js", "partial", "latex.ltx"),
  node: owner("src/tikz/commands/node.js", "partial", "tikz.code.tex"),
  nodepart: owner("src/tikz/libraries/shapes.multipart.js", "partial", "tikzlibraryshapes.multipart.code.tex"),
  path: owner("src/tikz/commands/path.js", "partial", "tikz.code.tex"),
  pgfmathparse: owner("src/engine/math.js", "partial"),
  pgfmathsetmacro: owner("src/frontend/latex-shell.js", "partial"),
  pgfmathtruncatemacro: owner("src/frontend/latex-shell.js", "partial"),
  pgfplotscreateplotcyclelist: owner("src/pgfplots/axisOptions.js", "partial", "pgfplots.code.tex"),
  pgfplotsset: owner("src/pgfplots/axisOptions.js", "partial", "pgfplots.code.tex"),
  pgfsetlayers: owner("src/frontend/latex-shell.js", "partial"),
  pgfsetseed: owner("src/engine/math.js", "partial"),
  pgfmathsetseed: owner("src/engine/math.js", "partial"),
  shade: owner("src/tikz/commands/fill.js", "partial"),
  tikz: owner("src/packages/tikz.js", "partial"),
  tikzset: owner("src/engine/options.js", "partial", "tikz.code.tex"),
  tikzstyle: owner("src/frontend/latex-shell.js", "partial", "tikz.code.tex"),
  usepackage: owner("src/packages/declarations.js", "stable", "latex.ltx"),
  usepgfplotslibrary: owner("src/pgfplots/axisOptions.js", "stable", "pgfplots.code.tex"),
  usetikzlibrary: owner("src/tikz/libraries/declarations.js", "stable", "tikz.code.tex")
};

const OPTION_COMMANDS = new Set([
  "addplot",
  "addplot3",
  "coordinate",
  "datavisualization",
  "draw",
  "edge",
  "fill",
  "filldraw",
  "foreach",
  "matrix",
  "node",
  "path",
  "shade",
  "tikz"
]);

const OPTION_MAP_COMMANDS = new Set(["ctikzset", "pgfplotsset", "tikzset"]);
const OPTION_ENVIRONMENTS = new Set([
  "axis",
  "bchart",
  "circuitikz",
  "groupplot",
  "scope",
  "tikzpicture"
]);

const OPTION_CONTEXT_OWNERS = {
  axis: "src/pgfplots/axisOptions.js",
  addplot: "src/pgfplots/addplotParser.js",
  addplot3: "src/pgfplots/addplotParser.js",
  bchart: "src/packages/bchart.js",
  circuitikz: "src/packages/circuitikz.js",
  ctikzset: "src/packages/circuitikz.js",
  datavisualization: "src/tikz/libraries/datavisualization.js",
  groupplot: "src/pgfplots/axisOptions.js",
  pgfplotsset: "src/pgfplots/axisOptions.js",
  tikzset: "src/engine/options.js"
};

const ENVIRONMENT_OWNERS = {
  axis: owner("src/pgfplots/axisEnvironment.js", "partial"),
  bchart: owner("src/packages/bchart.js", "partial"),
  circuitikz: owner("src/packages/circuitikz.js", "partial"),
  document: owner("src/frontend/latex-shell.js", "stable"),
  groupplot: owner("src/pgfplots/axisEnvironment.js", "partial"),
  preview: owner("src/packages/preview.js", "stable"),
  scope: owner("src/engine/evaluate.js", "partial"),
  tikzpicture: owner("src/frontend/parser.js", "stable")
};

const NESTED_OPTION_HINT = /(?:style|ticks?|axis|legend|label|grid|scatter|visualizer|decoration|arrow|font|mark|colorbar|node|every |\/\.|=)/i;
const DIMENSION_UNITS = "pt|pc|in|bp|cm|mm|dd|cc|sp|em|ex|mu";

function owner(module, implementationStatus, localLookup = null) {
  return { module, implementationStatus, localLookup };
}

export function auditTikzSource(source, options = {}) {
  const cleanSource = stripTexCommentsPreserveLines(String(source || ""));
  const lineStarts = collectLineStarts(cleanSource);
  const sourcePath = options.sourcePath ? path.resolve(options.sourcePath) : null;
  const review = options.review || {};
  const localSourceResolver = options.localSourceResolver || resolveWithKpsewhich;

  const declarations = collectDeclarations(cleanSource, lineStarts).map((entry) => applyReview(entry, review));
  const dependencies = collectDependencies(cleanSource, localSourceResolver, review);
  const commands = collectCommands(cleanSource, lineStarts, declarations, review, localSourceResolver);
  const environments = collectEnvironments(cleanSource, lineStarts, review);
  const optionGroups = collectOptionGroups(cleanSource, lineStarts);
  const optionFeatures = collectOptionFeatures(optionGroups, review);
  const expressions = collectPlotExpressions(cleanSource, lineStarts, review);
  const numbers = collectNumbers(cleanSource, lineStarts, expressions, optionGroups, review);
  const features = [...commands, ...environments, ...optionFeatures, ...declarations, ...numbers, ...expressions];
  const gate = buildGate({ dependencies, features, review });

  return {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    sourcePath,
    summary: {
      packages: dependencies.filter((entry) => entry.kind === "package").length,
      libraries: dependencies.filter((entry) => entry.kind !== "package").length,
      commands: commands.length,
      environments: environments.length,
      options: optionFeatures.length,
      declarations: declarations.length,
      numbers: numbers.length,
      expressions: expressions.length,
      reviewTodos: gate.todos.length,
      blockers: gate.blockers.length
    },
    dependencies,
    environments,
    commands,
    options: optionFeatures,
    declarations,
    numbers,
    expressions,
    gate
  };
}

function collectDependencies(source, resolver, review) {
  const packages = collectTexPackages(source).map((entry) => ({
    kind: "package",
    ...entry,
    lookup: `${entry.name}.sty`
  }));
  const tikzLibraries = collectTikzLibraries(source).map((entry) => ({
    kind: "tikz-library",
    ...entry,
    implementationStatus: entry.status,
    localSource: null,
    localSourceReviewed: null,
    lookup: `tikzlibrary${entry.name}.code.tex`
  }));
  const pgfplotsLibraries = collectPgfplotsLibraries(source).map((entry) => ({
    kind: "pgfplots-library",
    ...entry,
    localSource: entry.localSourceReviewed || null,
    lookup: `tikzlibrarypgfplots.${entry.name}.code.tex`
  }));

  return [...packages, ...tikzLibraries, ...pgfplotsLibraries].map((entry) => {
    const resolved = resolver(entry.lookup, entry) || entry.localSource || null;
    const id = `dependency:${entry.kind}:${entry.name}`;
    const reviewed = localSourceWasReviewed({
      id,
      localSource: resolved,
      localLookup: entry.lookup
    }, review);
    return {
      id,
      kind: entry.kind,
      name: entry.name,
      options: entry.options || {},
      implementationStatus: entry.implementationStatus || entry.status || "unsupported",
      implementedBy: entry.implementedBy || null,
      localSource: resolved,
      localSourceFound: Boolean(resolved),
      localSourceReviewed: reviewed,
      lookup: entry.lookup,
      features: entry.features || [],
      notes: entry.notes || ""
    };
  });
}

function collectCommands(source, lineStarts, declarations, review, localSourceResolver) {
  const declaredNames = new Set(declarations.map((entry) => entry.name).filter(Boolean));
  const found = new Map();
  const pattern = /\\([A-Za-z@]+|.)/g;
  let match;
  while ((match = pattern.exec(source))) {
    const name = match[1];
    if (name.length === 1 && !/[A-Za-z@]/.test(name)) continue;
    const line = lineAt(lineStarts, match.index);
    const id = `command:\\${name}`;
    if (!found.has(id)) {
      const commandOwner = declaredNames.has(name)
        ? owner("source declaration", "source-local")
        : COMMAND_OWNERS[name] || null;
      found.set(id, {
        id,
        kind: "command",
        name: `\\${name}`,
        count: 0,
        lines: [],
        mathOnly: true,
        implementedBy: commandOwner?.module || null,
        implementationStatus: commandOwner?.implementationStatus || "unmapped",
        localLookup: commandOwner?.localLookup || null,
        localSource: commandOwner?.localLookup ? localSourceResolver(commandOwner.localLookup, {}) : null
      });
    }
    const entry = found.get(id);
    entry.count += 1;
    entry.mathOnly = entry.mathOnly && isMathPosition(source, match.index);
    if (!entry.lines.includes(line)) entry.lines.push(line);
  }
  return [...found.values()]
    .map((entry) => {
      if (entry.implementationStatus === "unmapped" && entry.mathOnly) {
        entry.implementedBy = "src/renderers/svg/mathNode.js";
        entry.implementationStatus = "partial";
      }
      entry.localSourceReviewed = localSourceWasReviewed(entry, review);
      return applyReview(entry, review);
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function collectEnvironments(source, lineStarts, review) {
  const found = new Map();
  const pattern = /\\begin\s*\{([^{}]+)\}/g;
  let match;
  while ((match = pattern.exec(source))) {
    const name = match[1].trim();
    const id = `environment:${name}`;
    if (!found.has(id)) {
      const environmentOwner = ENVIRONMENT_OWNERS[name] || null;
      found.set(id, {
        id,
        kind: "environment",
        name,
        count: 0,
        lines: [],
        implementedBy: environmentOwner?.module || null,
        implementationStatus: environmentOwner?.implementationStatus || "unmapped"
      });
    }
    const entry = found.get(id);
    entry.count += 1;
    entry.lines.push(lineAt(lineStarts, match.index));
  }
  return [...found.values()].map((entry) => applyReview(entry, review));
}

function collectDeclarations(source, lineStarts) {
  const declarations = [];
  const seen = new Set();

  collectNamedBalancedDeclarations(source, lineStarts, /\\(?:def|gdef|edef|xdef)\s*\\([A-Za-z@]+)/g, "macro", declarations, seen);
  collectNamedBalancedDeclarations(source, lineStarts, /\\(?:newcommand|renewcommand|providecommand)\s*\{?\s*\\([A-Za-z@]+)/g, "macro", declarations, seen);
  collectNamedBalancedDeclarations(source, lineStarts, /\\pgfmath(?:setmacro|truncatemacro)\s*\{?\s*\\([A-Za-z@]+)/g, "math-variable", declarations, seen);
  collectTwoGroupDeclarations(source, lineStarts, "\\pgfplotscreateplotcyclelist", "cycle-list", declarations, seen);
  collectTwoGroupDeclarations(source, lineStarts, "\\colorlet", "color-alias", declarations, seen);

  const foreachPattern = /\\foreach\s+\\([A-Za-z@]+)(?:\s*\[[^\]]*\])?\s+in\s*/g;
  let foreachMatch;
  while ((foreachMatch = foreachPattern.exec(source))) {
    const start = skipWhitespace(source, foreachPattern.lastIndex);
    const values = readBalanced(source, start, "{", "}");
    addDeclaration({
      kind: "foreach-variable",
      name: foreachMatch[1],
      value: values?.content ?? null,
      line: lineAt(lineStarts, foreachMatch.index)
    }, declarations, seen);
  }

  const colorPattern = /\\definecolor\s*\{([^{}]+)\}\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g;
  let colorMatch;
  while ((colorMatch = colorPattern.exec(source))) {
    addDeclaration({
      kind: "color",
      name: colorMatch[1].trim(),
      value: `${colorMatch[2].trim()}:${colorMatch[3].trim()}`,
      line: lineAt(lineStarts, colorMatch.index)
    }, declarations, seen);
  }

  const tikzStylePattern = /\\tikzstyle\s*\{([^{}]+)\}\s*=\s*/g;
  let styleMatch;
  while ((styleMatch = tikzStylePattern.exec(source))) {
    const cursor = skipWhitespace(source, tikzStylePattern.lastIndex);
    const body = readBalanced(source, cursor, "[", "]");
    addDeclaration({
      kind: "tikz-style",
      name: styleMatch[1].trim(),
      value: body?.content ?? null,
      line: lineAt(lineStarts, styleMatch.index)
    }, declarations, seen);
  }

  const booleanPattern = /\\newif\s*\\if([A-Za-z@]+)/g;
  let booleanMatch;
  while ((booleanMatch = booleanPattern.exec(source))) {
    addDeclaration({
      kind: "boolean",
      name: booleanMatch[1],
      value: "false",
      line: lineAt(lineStarts, booleanMatch.index)
    }, declarations, seen);
  }

  return attachDeclarationReferences(source, lineStarts, declarations);
}

function collectNamedBalancedDeclarations(source, lineStarts, pattern, kind, declarations, seen) {
  let match;
  while ((match = pattern.exec(source))) {
    let cursor = skipWhitespace(source, pattern.lastIndex);
    if (source[cursor] === "}") cursor = skipWhitespace(source, cursor + 1);
    while (source[cursor] === "[") {
      const optional = readBalanced(source, cursor, "[", "]");
      if (!optional) break;
      cursor = skipWhitespace(source, optional.end);
    }
    if (kind === "macro" && source[cursor] !== "{") {
      const bodyStart = source.indexOf("{", cursor);
      const lineEnd = source.indexOf("\n", cursor);
      if (bodyStart !== -1 && (lineEnd === -1 || bodyStart < lineEnd)) cursor = bodyStart;
    }
    cursor = skipWhitespace(source, cursor);
    const value = source[cursor] === "{" ? readBalanced(source, cursor, "{", "}") : null;
    addDeclaration({
      kind,
      name: match[1],
      value: value?.content ?? null,
      line: lineAt(lineStarts, match.index)
    }, declarations, seen);
  }
}

function collectTwoGroupDeclarations(source, lineStarts, command, kind, declarations, seen) {
  let index = 0;
  while ((index = source.indexOf(command, index)) !== -1) {
    let cursor = skipWhitespace(source, index + command.length);
    const name = readBalanced(source, cursor, "{", "}");
    if (!name) {
      index += command.length;
      continue;
    }
    cursor = skipWhitespace(source, name.end);
    const value = readBalanced(source, cursor, "{", "}");
    addDeclaration({
      kind,
      name: name.content.trim(),
      value: value?.content?.trim() ?? null,
      line: lineAt(lineStarts, index)
    }, declarations, seen);
    index = value?.end || name.end;
  }
}

function addDeclaration(entry, declarations, seen) {
  const commandLike = ["macro", "math-variable", "foreach-variable", "boolean"].includes(entry.kind);
  const id = `declaration:${entry.kind}:${commandLike ? "\\" : ""}${entry.name}`;
  if (seen.has(id)) return;
  seen.add(id);
  declarations.push({
    id,
    ...entry,
    referenceCount: 0,
    referenceLines: [],
    reviewStatus: "todo",
    evidence: []
  });
}

function attachDeclarationReferences(source, lineStarts, declarations) {
  for (const declaration of declarations) {
    const commandLike = ["macro", "math-variable", "foreach-variable", "boolean"].includes(declaration.kind);
    const escaped = escapeRegExp(declaration.name);
    const pattern = commandLike
      ? new RegExp(`\\\\${escaped}(?![A-Za-z@])`, "g")
      : new RegExp(`(?<![A-Za-z@])${escaped}(?![A-Za-z@])`, "g");
    let match;
    while ((match = pattern.exec(source))) {
      const line = lineAt(lineStarts, match.index);
      if (line === declaration.line) continue;
      declaration.referenceCount += 1;
      if (!declaration.referenceLines.includes(line)) declaration.referenceLines.push(line);
    }
  }
  return declarations;
}

function collectOptionGroups(source, lineStarts) {
  const groups = [];
  const commandPattern = /\\([A-Za-z@]+)/g;
  let match;
  while ((match = commandPattern.exec(source))) {
    const name = match[1];
    let cursor = skipWhitespace(source, commandPattern.lastIndex);

    if (name === "begin") {
      const environment = readBalanced(source, cursor, "{", "}");
      if (!environment) continue;
      const environmentName = environment.content.trim();
      cursor = skipWhitespace(source, environment.end);
      if (!OPTION_ENVIRONMENTS.has(environmentName) || source[cursor] !== "[") continue;
      const group = readBalanced(source, cursor, "[", "]");
      if (group) groups.push(optionGroup(environmentName, group, match.index, lineStarts));
      continue;
    }

    if (OPTION_MAP_COMMANDS.has(name)) {
      const group = readBalanced(source, cursor, "{", "}");
      if (group) groups.push(optionGroup(name, group, match.index, lineStarts));
      continue;
    }

    if (name === "usepackage") {
      if (source[cursor] !== "[") continue;
      const group = readBalanced(source, cursor, "[", "]");
      if (!group) continue;
      cursor = skipWhitespace(source, group.end);
      const packageNames = readBalanced(source, cursor, "{", "}");
      const names = packageNames ? splitTopLevel(packageNames.content, ",") : ["unknown"];
      for (const packageName of names) {
        groups.push(optionGroup(`package:${packageName.trim()}`, group, match.index, lineStarts));
      }
      continue;
    }

    if (name === "documentclass") {
      if (source[cursor] !== "[") continue;
      const group = readBalanced(source, cursor, "[", "]");
      if (group) groups.push(optionGroup(name, group, match.index, lineStarts));
      continue;
    }

    if (!OPTION_COMMANDS.has(name)) continue;
    if (name === "addplot" && source[cursor] === "+") cursor = skipWhitespace(source, cursor + 1);
    if (source[cursor] !== "[") continue;
    const group = readBalanced(source, cursor, "[", "]");
    if (group) groups.push(optionGroup(name, group, match.index, lineStarts));
  }
  return groups;
}

function optionGroup(context, balancedGroup, index, lineStarts) {
  return {
    context,
    content: balancedGroup.content,
    sourceRange: {
      start: balancedGroup.start + 1,
      end: balancedGroup.end - 1
    },
    line: lineAt(lineStarts, index)
  };
}

function collectOptionFeatures(groups, review) {
  const features = new Map();
  for (const group of groups) {
    walkOptionMap(group.content, group, [], features, review);
  }
  return [...features.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function walkOptionMap(raw, group, parentKeys, features, review) {
  for (const part of splitTopLevel(raw, ",")) {
    const equals = findTopLevel(part, "=");
    const key = (equals === -1 ? part : part.slice(0, equals)).trim();
    if (!key) continue;
    const rawValue = equals === -1 ? true : part.slice(equals + 1).trim();
    const keys = [...parentKeys, key];
    const id = `option:${group.context}:${keys.join("/")}`;
    if (!features.has(id)) {
      features.set(id, applyReview({
        id,
        kind: "option",
        context: group.context,
        key,
        keyPath: keys,
        rawValues: [],
        lines: [],
        implementedBy: optionOwner(group.context),
        implementationStatus: "requires-case-verification"
      }, review));
    }
    const feature = features.get(id);
    const valueText = rawValue === true ? "true" : rawValue;
    if (!feature.rawValues.includes(valueText)) feature.rawValues.push(valueText);
    if (!feature.lines.includes(group.line)) feature.lines.push(group.line);

    if (rawValue !== true) {
      const nested = stripSingleOuterBraces(rawValue);
      if (nested !== rawValue && NESTED_OPTION_HINT.test(`${key} ${nested}`) && (nested.includes(",") || findTopLevel(nested, "=") !== -1)) {
        walkOptionMap(nested, group, keys, features, review);
      }
    }
  }
}

function optionOwner(context) {
  if (context.startsWith("package:")) return "src/packages/declarations.js";
  return OPTION_CONTEXT_OWNERS[context] || "src/engine/options.js";
}

function collectNumbers(source, lineStarts, expressions, optionGroups, review) {
  const features = new Map();
  const pattern = new RegExp(`(?<![A-Za-z@])[-+]?(?:\\d+\\.\\d*|\\.\\d+|\\d+)(?:[eE][-+]?\\d+)?\\s*(?:${DIMENSION_UNITS})?`, "g");
  let match;
  while ((match = pattern.exec(source))) {
    if (lineSourceAt(source, lineStarts, match.index).includes("\\definecolor")) continue;
    const literal = match[0].trim();
    const line = lineAt(lineStarts, match.index);
    const expression = expressions.find((entry) => match.index >= entry.sourceRange.start && match.index < entry.sourceRange.end);
    const optionGroup = optionGroups.find((entry) => match.index >= entry.sourceRange.start && match.index < entry.sourceRange.end);
    const context = expression?.id || (optionGroup ? `option:${optionGroup.context}` : commandContextForLine(source, lineStarts, match.index));
    const id = `number:${context}:${literal}`;
    if (!features.has(id)) {
      features.set(id, applyReview({
        id,
        kind: "number",
        literal,
        context,
        count: 0,
        lines: [],
        implementationStatus: "requires-case-verification",
        implementedBy: expression?.implementedBy || (optionGroup ? optionOwner(optionGroup.context) : numericOwner(context))
      }, review));
    }
    const entry = features.get(id);
    entry.count += 1;
    if (!entry.lines.includes(line)) entry.lines.push(line);
  }
  return [...features.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function numericOwner(context) {
  if (/^(?:alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|phi|chi|omega)$/.test(context)) {
    return "src/renderers/svg/mathNode.js";
  }
  if (/axis|addplot|pgfplots/.test(context)) return "src/pgfplots/axisOptions.js";
  if (/pgfmath|foreach/.test(context)) return "src/engine/math.js";
  return "src/engine/units.js";
}

function commandContextForLine(source, lineStarts, index) {
  const line = lineAt(lineStarts, index);
  const start = lineStarts[line - 1] || 0;
  const prefix = source.slice(start, index);
  const commands = [...prefix.matchAll(/\\([A-Za-z@]+)/g)];
  return commands.at(-1)?.[1] || "literal";
}

function collectPlotExpressions(source, lineStarts, review) {
  const expressions = [];
  const pattern = /\\addplot3?\+?/g;
  let match;
  let serial = 0;
  while ((match = pattern.exec(source))) {
    let cursor = skipWhitespace(source, pattern.lastIndex);
    if (source[cursor] === "[") {
      const options = readBalanced(source, cursor, "[", "]");
      if (options) cursor = skipWhitespace(source, options.end);
    }
    if (source.startsWith("gnuplot", cursor)) {
      cursor = skipWhitespace(source, cursor + "gnuplot".length);
      if (source[cursor] === "[") {
        const options = readBalanced(source, cursor, "[", "]");
        if (options) cursor = skipWhitespace(source, options.end);
      }
    }
    const body = readBalanced(source, cursor, "{", "}");
    if (!body) continue;
    serial += 1;
    expressions.push(applyReview({
      id: `expression:addplot:${serial}`,
      kind: "expression",
      expression: body.content.trim(),
      line: lineAt(lineStarts, match.index),
      sourceRange: { start: body.start + 1, end: body.end - 1 },
      implementationStatus: "requires-case-verification",
      implementedBy: "src/pgfplots/expressions.js"
    }, review));
  }
  return expressions;
}

function applyReview(feature, review) {
  const reviewed = review.features?.[feature.id] || matchingReviewRule(feature.id, review.rules) || {};
  return {
    ...feature,
    reviewStatus: reviewed.status || "todo",
    evidence: Array.isArray(reviewed.evidence) ? reviewed.evidence : [],
    notes: reviewed.notes || "",
    implementedBy: reviewed.implementedBy || feature.implementedBy || null
  };
}

function matchingReviewRule(featureId, rules = []) {
  for (const rule of rules || []) {
    const match = String(rule?.match || "");
    if (!match) continue;
    if (match.endsWith("*") && featureId.startsWith(match.slice(0, -1))) return rule;
    if (match === featureId) return rule;
  }
  return null;
}

function buildGate({ dependencies, features, review }) {
  const blockers = [];
  const todos = [];

  for (const dependency of dependencies) {
    if (dependency.implementationStatus === "unsupported") {
      blockers.push(`${dependency.id}: unsupported`);
    }
    if (!dependency.localSourceFound) {
      blockers.push(`${dependency.id}: local MacTeX source not found (${dependency.lookup})`);
    } else if (!dependency.localSourceReviewed) {
      todos.push(`${dependency.id}: local source not reviewed`);
    }
  }

  for (const feature of features) {
    if (feature.localLookup && !feature.localSource) {
      blockers.push(`${feature.id}: local MacTeX source not found (${feature.localLookup})`);
    } else if (feature.localSource && !feature.localSourceReviewed) {
      todos.push(`${feature.id}: local source not reviewed`);
    }
    if (feature.implementationStatus === "unmapped") {
      blockers.push(`${feature.id}: no implementation owner`);
      continue;
    }
    if (feature.reviewStatus === "unsupported" || feature.reviewStatus === "blocked") {
      blockers.push(`${feature.id}: ${feature.reviewStatus}`);
      continue;
    }
    if (!["implemented", "verified", "native-noop", "not-applicable"].includes(feature.reviewStatus)) {
      todos.push(`${feature.id}: review required`);
    }
    if (["implemented", "verified"].includes(feature.reviewStatus) && feature.evidence.length === 0) {
      blockers.push(`${feature.id}: implementation has no test/artifact evidence`);
    }
  }

  if (review.caseStatus !== "accepted") {
    todos.push("case: explicit caseStatus=accepted is required");
  }

  return {
    accepted: blockers.length === 0 && todos.length === 0,
    status: blockers.length ? "blocked" : todos.length ? "incomplete" : "accepted",
    blockers,
    todos
  };
}

function localSourceWasReviewed(entry, review) {
  const reviewedSources = new Set(review.localSources || []);
  const keys = [entry.localSource, entry.localLookup, entry.id].filter(Boolean);
  const matchedKey = keys.find((key) => reviewedSources.has(key));
  if (!entry.localSource || !matchedKey) return false;
  const note = keys.map((key) => review.localSourceNotes?.[key]).find(Boolean);
  if (typeof note === "string") return note.trim().length > 0;
  return Boolean(
    note &&
      ((Array.isArray(note.symbols) && note.symbols.length > 0) ||
        String(note.findings || note.notes || "").trim().length > 0)
  );
}

export function renderAuditMarkdown(report) {
  const lines = [
    `# Semantic Audit: ${report.sourcePath ? path.basename(report.sourcePath) : "inline source"}`,
    "",
    `Status: **${report.gate.status}**`,
    "",
    "## Summary",
    "",
    "| Packages | Libraries | Commands | Options | Declarations | Numbers | Expressions | Todos | Blockers |",
    "| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    `| ${report.summary.packages} | ${report.summary.libraries} | ${report.summary.commands} | ${report.summary.options} | ${report.summary.declarations} | ${report.summary.numbers} | ${report.summary.expressions} | ${report.summary.reviewTodos} | ${report.summary.blockers} |`,
    "",
    "## Local Dependencies",
    "",
    "| Kind | Name | JS status/owner | Local MacTeX source | Reviewed |",
    "| --- | --- | --- | --- | --- |"
  ];

  for (const dependency of report.dependencies) {
    lines.push(`| ${dependency.kind} | \`${dependency.name}\` | ${dependency.implementationStatus} / ${escapeCell(dependency.implementedBy || "-")} | ${escapeCell(dependency.localSource || `NOT FOUND: ${dependency.lookup}`)} | ${dependency.localSourceReviewed ? "yes" : "no"} |`);
  }

  lines.push("", "## Commands", "", "| Command | Count | Lines | Owner | Local MacTeX source | Status | Review |", "| --- | ---: | --- | --- | --- | --- | --- |");
  for (const command of report.commands) {
    lines.push(`| \`${command.name}\` | ${command.count} | ${command.lines.join(", ")} | ${escapeCell(command.implementedBy || "-")} | ${escapeCell(command.localSource || "-")} | ${command.implementationStatus} | ${command.reviewStatus} |`);
  }

  lines.push("", "## Environments", "", "| Environment | Count | Lines | Owner | Status | Review |", "| --- | ---: | --- | --- | --- | --- |");
  for (const environment of report.environments) {
    lines.push(`| \`${environment.name}\` | ${environment.count} | ${environment.lines.join(", ")} | ${escapeCell(environment.implementedBy || "-")} | ${environment.implementationStatus} | ${environment.reviewStatus} |`);
  }

  lines.push("", "## Option Tree", "", "| Context | Parameter path | Values | Lines | Owner | Review |", "| --- | --- | --- | --- | --- | --- |");
  for (const option of report.options) {
    lines.push(`| ${option.context} | \`${option.keyPath.join(" / ")}\` | ${escapeCell(option.rawValues.map((value) => `\`${value}\``).join("<br>"))} | ${option.lines.join(", ")} | ${escapeCell(option.implementedBy || "-")} | ${option.reviewStatus} |`);
  }

  lines.push("", "## Variables And Definitions", "", "| Kind | Name | Value/domain | Line | References | Review |", "| --- | --- | --- | ---: | --- | --- |");
  for (const declaration of report.declarations) {
    lines.push(`| ${declaration.kind} | \`${declarationDisplayName(declaration)}\` | ${escapeCell(declaration.value ?? "-")} | ${declaration.line} | ${declaration.referenceCount} (${declaration.referenceLines.join(", ") || "-"}) | ${declaration.reviewStatus} |`);
  }

  lines.push("", "## Numeric Semantics", "", "| Context | Literal | Count | Lines | Owner | Review |", "| --- | --- | ---: | --- | --- | --- |");
  for (const number of report.numbers) {
    lines.push(`| ${number.context} | \`${number.literal}\` | ${number.count} | ${number.lines.join(", ")} | ${escapeCell(number.implementedBy || "-")} | ${number.reviewStatus} |`);
  }

  lines.push("", "## Plot Expressions", "", "| Line | Expression | Owner | Review |", "| ---: | --- | --- | --- |");
  for (const expression of report.expressions) {
    lines.push(`| ${expression.line} | \`${escapeCell(expression.expression)}\` | ${escapeCell(expression.implementedBy)} | ${expression.reviewStatus} |`);
  }

  lines.push("", "## Acceptance Gate", "");
  if (report.gate.blockers.length) {
    lines.push("### Blockers", "", ...report.gate.blockers.map((entry) => `- ${entry}`), "");
  }
  if (report.gate.todos.length) {
    lines.push("### Required Reviews", "", ...report.gate.todos.map((entry) => `- ${entry}`), "");
  }
  if (report.gate.accepted) lines.push("All semantic items are reviewed and backed by evidence.", "");
  return `${lines.join("\n")}\n`;
}

function resolveWithKpsewhich(lookup, dependency = {}) {
  if (dependency.localSource && existsSync(dependency.localSource)) return dependency.localSource;
  const executables = ["/Library/TeX/texbin/kpsewhich", "kpsewhich"];
  for (const executable of executables) {
    const result = spawnSync(executable, [lookup], { encoding: "utf8" });
    const resolved = result.status === 0 ? result.stdout.trim() : "";
    if (resolved) return resolved;
  }
  return null;
}

function stripTexCommentsPreserveLines(source) {
  return source
    .split("\n")
    .map((line) => {
      for (let index = 0; index < line.length; index += 1) {
        if (line[index] !== "%") continue;
        let backslashes = 0;
        for (let cursor = index - 1; cursor >= 0 && line[cursor] === "\\"; cursor -= 1) backslashes += 1;
        if (backslashes % 2 === 0) return line.slice(0, index);
      }
      return line;
    })
    .join("\n");
}

function collectLineStarts(source) {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") starts.push(index + 1);
  }
  return starts;
}

function lineAt(starts, index) {
  let low = 0;
  let high = starts.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (starts[middle] <= index) low = middle + 1;
    else high = middle;
  }
  return Math.max(1, low);
}

function lineSourceAt(source, starts, index) {
  const line = lineAt(starts, index);
  const start = starts[line - 1] || 0;
  const end = source.indexOf("\n", start);
  return source.slice(start, end === -1 ? source.length : end);
}

function isMathPosition(source, index) {
  let inlineMath = false;
  let parenMath = false;
  let bracketMath = false;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source[cursor] === "\\" && source[cursor + 1] === "(") {
      parenMath = true;
      cursor += 1;
      continue;
    }
    if (source[cursor] === "\\" && source[cursor + 1] === ")") {
      parenMath = false;
      cursor += 1;
      continue;
    }
    if (source[cursor] === "\\" && source[cursor + 1] === "[") {
      bracketMath = true;
      cursor += 1;
      continue;
    }
    if (source[cursor] === "\\" && source[cursor + 1] === "]") {
      bracketMath = false;
      cursor += 1;
      continue;
    }
    if (source[cursor] !== "$") continue;
    let backslashes = 0;
    for (let previous = cursor - 1; previous >= 0 && source[previous] === "\\"; previous -= 1) backslashes += 1;
    if (backslashes % 2 === 0) inlineMath = !inlineMath;
  }
  return inlineMath || parenMath || bracketMath;
}

function skipWhitespace(source, index) {
  let cursor = index;
  while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
  return cursor;
}

function readBalanced(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "\\" && index + 1 < source.length) {
      index += 1;
      continue;
    }
    if (source[index] === open) depth += 1;
    if (source[index] === close) {
      depth -= 1;
      if (depth === 0) {
        return {
          content: source.slice(start + 1, index),
          start,
          end: index + 1
        };
      }
    }
  }
  return null;
}

function stripSingleOuterBraces(value) {
  const text = String(value).trim();
  const balanced = readBalanced(text, 0, "{", "}");
  return balanced && balanced.end === text.length ? balanced.content : text;
}

function escapeCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function declarationDisplayName(declaration) {
  return ["macro", "math-variable", "foreach-variable", "boolean"].includes(declaration.kind)
    ? `\\${declaration.name}`
    : declaration.name;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseCliArgs(argv) {
  const args = { sourcePath: null, reviewPath: null, outputPath: null, initReviewPath: null, json: false, strict: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--review") args.reviewPath = argv[++index];
    else if (arg === "--output") args.outputPath = argv[++index];
    else if (arg === "--init-review") args.initReviewPath = argv[++index];
    else if (arg === "--json") args.json = true;
    else if (arg === "--strict") args.strict = true;
    else if (!args.sourcePath) args.sourcePath = arg;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return args;
}

export function createReviewTemplate(report) {
  const features = {};
  for (const feature of [
    ...report.commands,
    ...report.environments,
    ...report.options,
    ...report.declarations,
    ...report.numbers,
    ...report.expressions
  ]) {
    features[feature.id] = {
      status: "todo",
      implementedBy: feature.implementedBy || null,
      evidence: [],
      notes: ""
    };
  }
  return {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    caseStatus: "incomplete",
    localSources: [],
    localSourceNotes: {},
    localSourceCandidates: [...new Set([
      ...report.dependencies.map((entry) => entry.localSource || entry.lookup),
      ...report.commands.map((entry) => entry.localSource || entry.localLookup).filter(Boolean)
    ])],
    features,
    rules: []
  };
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (!args.sourcePath) {
    console.error("Usage: npm run case:audit -- <case.tex> [--review review.json] [--init-review review.json] [--output audit.md] [--json] [--strict]");
    process.exitCode = 2;
    return;
  }
  const sourcePath = path.resolve(args.sourcePath);
  const source = readFileSync(sourcePath, "utf8");
  const review = args.reviewPath ? JSON.parse(readFileSync(path.resolve(args.reviewPath), "utf8")) : {};
  const report = auditTikzSource(source, { sourcePath, review });
  if (args.initReviewPath) {
    const templatePath = path.resolve(args.initReviewPath);
    if (existsSync(templatePath)) throw new Error(`Refusing to overwrite existing review: ${templatePath}`);
    writeFileSync(templatePath, `${JSON.stringify(createReviewTemplate(report), null, 2)}\n`);
  }
  const output = args.json ? `${JSON.stringify(report, null, 2)}\n` : renderAuditMarkdown(report);
  if (args.outputPath) writeFileSync(path.resolve(args.outputPath), output);
  else process.stdout.write(output);
  if (args.strict && !report.gate.accepted) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === THIS_FILE) main();
