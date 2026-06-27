import { circleToPath, ellipseToPath, flattenPath, pathIntersections, pointAtLength } from "./geometry.js";
import { resolveCalcExpression, resolveCalcOffsetExpression } from "./libraries/calc.js";
import {
  addMatrixDelimiters as addMatrixLibraryDelimiters,
  isMatrixNodeOptions as isMatrixLibraryNodeOptions,
  matrixCellText as matrixLibraryCellText,
  matrixInheritedNodeOptions as matrixLibraryInheritedNodeOptions,
  matrixRowNodeOptions as matrixLibraryRowNodeOptions
} from "./libraries/matrix.js";
import {
  defaultPositioningDistance as positioningLibraryDefaultDistance,
  positioningDelta as positioningLibraryDelta,
  resolveExplicitAtPositioningOffsetPoint,
  resolvePositioningPoint,
  scalePositioningDistance as scalePositioningLibraryDistance
} from "./libraries/positioning.js";
import { evaluateMath, parseDimension, roundNumber, roundPoint, substituteTextVariables, substituteVariables } from "./math.js";
import { estimateFormulaBox, formulaTotalHeight, mathTextMetricUnits, parseMathText, texTextWidthCm } from "./math-metrics.js";
import { parseStatements } from "./parser.js";
import {
  codeDefinitionsFromOptions,
  edgeStyleHintsFromOptions,
  normalizeColor,
  normalizeOptions,
  parseOptions,
  splitTopLevel,
  styleDefinitionsFromOptions,
  stripOuterBraces
} from "./options.js";
import { fontScaleFromTikzFont, mathFallbackText, normalizeTikzText } from "./tex-text.js";
import {
  TIKZ_FONT_FAMILY,
  TIKZ_MONOSPACE_FONT_FAMILY,
  TIKZ_SANS_SERIF_FONT_FAMILY,
  TIKZ_UNIT,
  createArrowTip,
  lineWidthFromPt
} from "./tikz-metrics.js";

const TIKZ_DEFAULT_INNER_SEP = ".3333em";
const PGF_DEFAULT_Z_VECTOR = { x: -0.385, y: -0.385 };
const DEFAULT_TEX_VARIABLES = {
  textwidth: parseDimension("345pt", {})
};

const BUILTIN_STYLES = {
  "every state": {},
  "state without output": { circle: true, draw: true, "minimum size": "2.5em", "every state": true },
  state: { "state without output": true },
  "every concept": {},
  concept: { circle: true, "tikzkit concept": true, "every concept": true },
  "extra concept": { "concept color": "black!50", "level 2 concept": true, concept: true, "every extra concept": true },
  "every extra concept": {},
  "concept connection": { "line width": "1mm", "shorten <=": "2mm", "shorten >=": "2mm", "line cap": "round", draw: "black!50" },
  mindmap: {
    "tikzkit mindmap": true,
    "grow cyclic": true,
    "very thick": true,
    "outer sep": "0pt",
    "inner sep": "1pt",
    "root concept": true,
    "text centered": true,
    "segment angle": "20",
    "every mindmap": true
  },
  "every mindmap": {},
  "root concept": { "minimum size": "4cm", "text width": "3.5cm", font: "\\large" },
  "level 1 concept": {
    "minimum size": "2.25cm",
    "level distance": "5cm",
    "text width": "2cm",
    "sibling angle": "60",
    font: "\\small"
  },
  "level 2 concept": {
    "minimum size": "1.75cm",
    "level distance": "2.9cm",
    "text width": "1.5cm",
    "sibling angle": "60",
    font: "\\footnotesize"
  },
  "level 3 concept": {
    "minimum size": "1.15cm",
    "level distance": "2.4cm",
    "text width": "1cm",
    "sibling angle": "30",
    font: "\\tiny"
  },
  "level 4 concept": {
    "minimum size": "0.9cm",
    "level distance": "1.85cm",
    "text width": "0.7cm",
    "sibling angle": "30",
    font: "\\tiny"
  },
  normalLine: { "line width": "1pt" },
  axisarrow: { ">": "open triangle 45", normalLine: true },
  "help lines": { draw: "gray", "line width": "0.2pt" },
  circ: { circle: true, draw: "black", fill: "black", "minimum size": "2.2pt", "inner sep": "0pt" }
};

export function interpretTikz(ast, options = {}) {
  const diagnostics = [];
  const ir = { type: "drawing", items: [], backgroundItems: [], coordinates: {} };
  const pictures = ast.pictures || [];
  const inlinePictureLayout = pictures.length > 1 && options.multiPictureLayout !== false;
  let inlineCursorX = 0;
  let lastPictureBounds = null;

  for (let pictureIndex = 0; pictureIndex < pictures.length; pictureIndex += 1) {
    const picture = pictures[pictureIndex];
    const targetIr = inlinePictureLayout ? { type: "drawing", items: [], backgroundItems: [], coordinates: {} } : ir;
    const pictureCoordinates = inlinePictureLayout ? targetIr.coordinates : ir.coordinates;
    const baseStyles = { ...BUILTIN_STYLES, ...(picture.styles || {}) };
    const styles = { ...baseStyles, ...styleDefinitionsFromOptions(picture.options || {}, baseStyles) };
    const baseVariables = evaluatePicturePgfMathMacros(picture.pgfMathMacros || [], DEFAULT_TEX_VARIABLES);
    const pictureOptions = stripStyleDefinitionOptions(normalizeOptions("path", picture.options || {}, { variables: baseVariables, styles }).options);
    const pictureBasis = parsePictureBasis(pictureOptions, baseVariables);
    const pictureTransformEnv = {
      variables: { ...baseVariables },
      coordinates: pictureCoordinates,
      nodes: {},
      coordinateSystems: { ...(picture.coordinateSystems || {}) },
      basis: pictureBasis,
      transform: identityTransform()
    };
    const env = {
      variables: { ...baseVariables },
      coordinates: pictureCoordinates,
      nodes: {},
      coordinateSystems: { ...(picture.coordinateSystems || {}) },
      styles,
      codeHandlers: { ...(picture.codeHandlers || {}) },
      pics: { ...(picture.pics || {}) },
      circuitikz: circuitikzPackageSettings(picture.packages || ast.packages || []),
      randomLists: { ...(picture.randomLists || {}) },
      randomListCounters: {},
      shadings: { ...(picture.shadings || ast.shadings || {}) },
      namedPaths: {},
      chains: initialChains(pictureOptions),
      activeChain: initialActiveChain(pictureOptions),
      toggles: {},
      transform: composeTransform(identityTransform(), pictureOptions, pictureTransformEnv),
      canvasScale: transformCanvasScale(pictureOptions, pictureTransformEnv),
      basis: pictureBasis,
      pictureOptions
    };
    const pictureStart = { itemCount: targetIr.items.length, backgroundItemCount: targetIr.backgroundItems.length };
    for (const statement of picture.statements || []) {
      interpretStatement(statement, env, targetIr, diagnostics, options);
    }
    if (tikzBoolean(pictureOptions.framed)) {
      addFramedPicture(targetIr, pictureStart, env);
    }
    if (inlinePictureLayout) {
      const layout = appendInlinePicture(ir, targetIr, {
        ast,
        picture,
        pictureIndex,
        pictures,
        cursorX: inlineCursorX,
        previousBounds: lastPictureBounds
      });
      inlineCursorX = layout.cursorX;
      lastPictureBounds = layout.bounds;
    }
  }

  if (ir.backgroundItems.length) {
    ir.items = [...ir.backgroundItems, ...ir.items];
  }
  delete ir.backgroundItems;
  return { ir, diagnostics };
}

function appendInlinePicture(documentIr, pictureIr, context) {
  const allPictureItems = [...(pictureIr.backgroundItems || []), ...(pictureIr.items || [])];
  const bounds = computeItemsBoundingBox(allPictureItems, null);
  let cursorX = context.cursorX;
  if (context.pictureIndex > 0) {
    cursorX = appendInterPictureText(documentIr, context, cursorX);
  }
  if (!bounds) {
    return { cursorX, bounds: context.previousBounds };
  }
  const dx = context.pictureIndex === 0 ? 0 : cursorX - bounds.minX;
  const dy = 0;
  translateItems(pictureIr.backgroundItems || [], dx, dy);
  translateItems(pictureIr.items || [], dx, dy);
  mergeTranslatedCoordinates(documentIr.coordinates, pictureIr.coordinates || {}, context.pictureIndex, dx, dy);
  documentIr.backgroundItems.push(...(pictureIr.backgroundItems || []));
  documentIr.items.push(...(pictureIr.items || []));
  const translatedBounds = translateBounds(bounds, dx, dy);
  return {
    cursorX: translatedBounds.maxX,
    bounds: translatedBounds
  };
}

function appendInterPictureText(documentIr, context, cursorX) {
  const text = cleanInterPictureText(interPictureRawText(context));
  const gapBefore = 0.45;
  if (!text) return cursorX + gapBefore;
  const width = Math.max(0.2, texTextWidthCm(text));
  const vspace = interPictureVspace(interPictureRawText(context));
  const y = roundNumber((context.previousBounds?.minY ?? 0) - Math.max(0.35, vspace));
  documentIr.items.push({
    type: "textNode",
    text,
    x: roundNumber(cursorX + gapBefore + width / 2),
    y,
    style: {
      stroke: "none",
      fill: "black",
      textFill: "black",
      lineWidth: lineWidthFromPt(0.4),
      fontScale: 1,
      fontSizeBaseScale: 1,
      fontFamily: TIKZ_FONT_FAMILY
    }
  });
  return roundNumber(cursorX + gapBefore + width + 0.45);
}

function interPictureRawText(context) {
  const previous = context.pictures?.[context.pictureIndex - 1];
  const current = context.picture;
  const start = Number.isFinite(previous?.endIndex) ? previous.endIndex : previous?.bodyEndIndex;
  const end = Number.isFinite(current?.beginIndex) ? current.beginIndex : start;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "";
  return String(context.ast?.source || "").slice(start, end);
}

function cleanInterPictureText(raw = "") {
  const withoutCommands = String(raw)
    .replace(/%[^\n]*/g, "")
    .replace(/\\vspace\*?\s*\{[^}]*\}/g, "")
    .replace(/\\(?:smallskip|medskip|bigskip|par)\b/g, " ")
    .replace(/\\\\(?:\[[^\]]*\])?/g, " ");
  const text = withoutCommands.replace(/\s+/g, " ").trim();
  if (!/[A-Za-z0-9\u00A0-\uFFFF]/.test(text)) return "";
  return text;
}

function interPictureVspace(raw = "") {
  const match = String(raw).match(/\\vspace\*?\s*\{([^}]*)\}/);
  if (!match) return 0.35;
  const value = parseDimension(match[1], {});
  return Number.isFinite(value) ? Math.max(0, value) : 0.35;
}

function translateBounds(bounds, dx, dy) {
  return {
    minX: roundNumber(bounds.minX + dx),
    minY: roundNumber(bounds.minY + dy),
    maxX: roundNumber(bounds.maxX + dx),
    maxY: roundNumber(bounds.maxY + dy)
  };
}

function translateItems(items = [], dx = 0, dy = 0) {
  for (const item of items) translateItem(item, dx, dy);
}

function translateItem(item, dx, dy) {
  translatePointFields(item, dx, dy);
  if (Array.isArray(item.commands)) {
    for (const command of item.commands) translatePointFields(command, dx, dy);
  }
}

function translatePointFields(object, dx, dy) {
  if (!object || (!dx && !dy)) return;
  for (const [xKey, yKey] of [["x", "y"], ["cx", "cy"], ["x1", "y1"], ["x2", "y2"]]) {
    if (Number.isFinite(object[xKey])) object[xKey] = roundNumber(object[xKey] + dx);
    if (Number.isFinite(object[yKey])) object[yKey] = roundNumber(object[yKey] + dy);
  }
}

function mergeTranslatedCoordinates(target, coordinates, pictureIndex, dx, dy) {
  for (const [name, point] of Object.entries(coordinates || {})) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const translated = roundPoint({ x: point.x + dx, y: point.y + dy });
    target[name] = translated;
    target[`picture${pictureIndex + 1}:${name}`] = translated;
  }
}

function evaluatePicturePgfMathMacros(macros = [], defaults = {}) {
  const variables = { ...(defaults || {}) };
  for (const macro of macros || []) {
    if (!macro?.name) continue;
    const value = evaluateMath(macro.expression, variables);
    variables[macro.name] = macro.type === "pgfmathtruncatemacro" ? Math.trunc(value) : value;
  }
  return variables;
}

function addFramedPicture(ir, pictureStart, env) {
  const items = [
    ...(ir.backgroundItems || []).slice(pictureStart.backgroundItemCount),
    ...(ir.items || []).slice(pictureStart.itemCount)
  ];
  const bounds = computeItemsBoundingBox(items, null);
  if (!bounds) return;
  const style = scaleCanvasStyle({ stroke: "black", fill: "none", lineWidth: lineWidthFromPt(0.4) }, env);
  ir.items.push({
    type: "path",
    subtype: "tikz-framed",
    style,
    commands: [
      { type: "moveTo", x: bounds.minX, y: bounds.minY },
      { type: "lineTo", x: bounds.maxX, y: bounds.minY },
      { type: "lineTo", x: bounds.maxX, y: bounds.maxY },
      { type: "lineTo", x: bounds.minX, y: bounds.maxY },
      { type: "closePath" }
    ]
  });
}

function interpretStatement(statement, env, ir, diagnostics, options) {
  env.currentBoundingBox ||= () => computeCurrentBoundingBox(ir);
  if (statement.leadingFont) {
    applyFontSwitch(statement.leadingFont, env);
  }
  if (statement.type === "font") {
    applyFontSwitch(statement.font, env);
    return;
  }
  if (statement.type === "unsupported") {
    diagnostics.push(statement.diagnostic);
    return;
  }
  if (statement.type === "noop") {
    applyNoopSideEffects(statement, env);
    return;
  }
  if (statement.type === "foreach") {
    let foreachIndex = 0;
    for (const values of expandForeachValues(statement.values, env)) {
      const childVariables = { ...env.variables };
      const valueText = stripOuterBraces(values.trim());
      const rawParts = splitTopLevel(valueText, "/").map((part) => stripOuterBraces(part.trim()));
      statement.variables.forEach((name, index) => {
        childVariables[name] = rawParts[index] ?? values.trim();
      });
      applyForeachOptions(childVariables, statement.options || {}, foreachIndex, env);
      const childEnv = { ...env, variables: childVariables };
      const children = statement.bodySource && String(statement.bodySource).includes("\\ifcase")
        ? parseStatements(expandIfCaseConditionals(substituteTextVariables(statement.bodySource, childVariables)), diagnostics)
        : statement.body;
      for (const child of children) interpretStatement(child, childEnv, ir, diagnostics, options);
      foreachIndex += 1;
    }
    return;
  }
  if (statement.type === "pgfmathsetmacro") {
    env.variables[statement.name] = evaluateMath(statement.expression, env.variables);
    return;
  }
  if (statement.type === "pgfmathsetlengthmacro") {
    env.variables[statement.name] = evaluateMath(statement.expression, env.variables);
    return;
  }
  if (statement.type === "pgfmathtruncatemacro") {
    env.variables[statement.name] = Math.trunc(evaluateMath(statement.expression, env.variables));
    return;
  }
  if (statement.type === "pgfmathdeclarerandomlist") {
    env.randomLists ||= {};
    env.randomListCounters ||= {};
    env.randomLists[statement.name] = statement.values || [];
    env.randomListCounters[statement.name] = 0;
    return;
  }
  if (statement.type === "pgfmathrandomitem") {
    env.randomLists ||= {};
    env.randomListCounters ||= {};
    const listName = resolveDynamicName(statement.listName, env);
    const values = env.randomLists[listName] || [];
    if (!values.length) {
      diagnostics.push({
        severity: "warning",
        message: `Unknown PGF random list ${listName}`
      });
      env.variables[statement.name] = "";
      return;
    }
    const index = env.randomListCounters[listName] || 0;
    env.variables[statement.name] = values[index % values.length];
    env.randomListCounters[listName] = index + 1;
    return;
  }
  if (statement.type === "pgftransformcm") {
    env.transform = composePgfTransform(env.transform, statement, env);
    return;
  }
  if (statement.type === "pgftransformreset") {
    env.transform = identityTransform();
    return;
  }
  if (statement.type === "coordinate") {
    if (coordinateRendersAsNode(statement.options || {}, env)) {
      createNode({ ...statement, text: "" }, env, ir, diagnostics);
      return;
    }
    const point = statement.at
      ? resolveCoordinate(statement.at, env, diagnostics)
      : resolvePositioning(statement.options || {}, env) || applyTransform({ x: 0, y: 0 }, env.transform);
    const name = resolveDynamicName(statement.name, env);
    env.coordinates[name] = point;
    addCoordinateLabels(statement.options || {}, point, env, ir);
    return;
  }
  if (statement.type === "tikzset") {
    env.styles = {
      ...env.styles,
      ...(statement.styleOptions ? styleDefinitionsFromOptions(statement.styleOptions, env.styles) : statement.styles)
    };
    env.codeHandlers = codeDefinitionsFromOptions(statement.styleOptions || {}, env.codeHandlers || {});
    env.pics = {
      ...(env.pics || {}),
      ...(statement.pics || picDefinitionsFromOptions(statement.styleOptions || {}))
    };
    return;
  }
  if (statement.type === "calendar") {
    createCalendar(statement, env, ir, diagnostics);
    return;
  }
  if (statement.type === "matrix") {
    createMatrix(statement, env, ir, diagnostics);
    return;
  }
  if (statement.type === "pic") {
    createPic(statement, env, ir, diagnostics);
    return;
  }
  if (statement.type === "spy") {
    createSpy(statement, env, ir, diagnostics);
    return;
  }
  if (statement.type === "node") {
    const node = createNode(statement, env, ir, diagnostics);
    if (node && statement.children?.length) {
      createNodeTreeChildren(node, statement.children, env, ir, diagnostics, 1, statement.treeOptions || {});
    }
    return;
  }
  if (statement.type === "ifnum") {
    const selected = evaluateIfNum(statement, env) ? statement.thenBody : statement.elseBody;
    for (const child of selected || []) interpretStatement(child, env, ir, diagnostics, options);
    return;
  }
  if (statement.type === "scope") {
    const scopedVariables = { ...env.variables };
    const codeEnv = { ...env, variables: scopedVariables };
    applyOptionCodeHandlers(statement.options || {}, codeEnv);
    const scopedEnv = {
      ...env,
      variables: scopedVariables,
      transform: composeTransform(env.transform, statement.options, codeEnv),
      canvasScale: env.canvasScale * transformCanvasScale(statement.options || {}, codeEnv),
      basis: composeBasis(env.basis, statement.options, codeEnv),
      pictureOptions: mergeScopePictureOptions(env.pictureOptions || {}, statement.options || {}),
      styles: { ...env.styles, ...styleDefinitionsFromOptions(statement.options || {}, env.styles) }
    };
    if (isBackgroundScope(statement.options || {})) {
      const backgroundIr = { ...ir, items: [], backgroundItems: [] };
      for (const child of statement.body) interpretStatement(child, scopedEnv, backgroundIr, diagnostics, options);
      ir.backgroundItems.push(...backgroundIr.backgroundItems, ...backgroundIr.items);
      return;
    }
    for (const child of statement.body) interpretStatement(child, scopedEnv, ir, diagnostics, options);
    return;
  }
  if (statement.type === "path") {
    interpretPathStatement(statement, env, ir, diagnostics);
  }
}

function expandIfCaseConditionals(source) {
  let output = "";
  let cursor = 0;
  const marker = "\\ifcase";
  while (cursor < source.length) {
    const start = source.indexOf(marker, cursor);
    if (start === -1) {
      output += source.slice(cursor);
      break;
    }
    output += source.slice(cursor, start);
    const parsed = parseIfCaseConditional(source, start);
    if (!parsed) {
      output += marker;
      cursor = start + marker.length;
      continue;
    }
    output += parsed.selected;
    cursor = parsed.end;
  }
  return output;
}

function parseIfCaseConditional(source, start) {
  let cursor = skipLocalWhitespace(source, start + "\\ifcase".length);
  const valueMatch = source.slice(cursor).match(/^-?\d+(?:\.\d+)?/);
  if (!valueMatch) return null;
  const caseIndex = Math.trunc(Number(valueMatch[0]));
  if (!Number.isFinite(caseIndex)) return null;
  cursor += valueMatch[0].length;
  const end = findMatchingIfCaseEnd(source, cursor);
  if (!end) return null;
  const branches = splitIfCaseBranches(source.slice(cursor, end.fiStart));
  return { selected: branches[caseIndex] ?? branches.elseBranch ?? "", end: end.fiEnd };
}

function findMatchingIfCaseEnd(source, start) {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source.startsWith("\\ifcase", index)) {
      depth += 1;
      index += "\\ifcase".length - 1;
      continue;
    }
    if (source.startsWith("\\fi", index)) {
      if (depth === 0) return { fiStart: index, fiEnd: index + "\\fi".length };
      depth -= 1;
      index += "\\fi".length - 1;
    }
  }
  return null;
}

function splitIfCaseBranches(content) {
  const branches = [""];
  let active = 0;
  let elseMode = false;
  let depth = 0;
  for (let index = 0; index < content.length; index += 1) {
    if (content.startsWith("\\ifcase", index)) {
      appendIfCaseBranch(branches, active, elseMode, "\\ifcase");
      depth += 1;
      index += "\\ifcase".length - 1;
      continue;
    }
    if (content.startsWith("\\fi", index)) {
      appendIfCaseBranch(branches, active, elseMode, "\\fi");
      depth = Math.max(0, depth - 1);
      index += "\\fi".length - 1;
      continue;
    }
    if (depth === 0 && content.startsWith("\\or", index)) {
      active += 1;
      branches[active] ||= "";
      index += "\\or".length - 1;
      continue;
    }
    if (depth === 0 && content.startsWith("\\else", index)) {
      elseMode = true;
      branches.elseBranch = "";
      index += "\\else".length - 1;
      continue;
    }
    appendIfCaseBranch(branches, active, elseMode, content[index]);
  }
  return branches;
}

function appendIfCaseBranch(branches, active, elseMode, text) {
  if (elseMode) {
    branches.elseBranch = (branches.elseBranch || "") + text;
  } else {
    branches[active] = (branches[active] || "") + text;
  }
}

function skipLocalWhitespace(source, index) {
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return index;
}

function isBackgroundScope(options = {}) {
  return String(options.layer || "").trim() === "background" || options["on background layer"] === true;
}

function evaluateIfNum(statement, env) {
  const left = Math.trunc(evaluateMath(statement.left, env.variables));
  const right = Math.trunc(evaluateMath(statement.right, env.variables));
  if (statement.operator === "<") return left < right;
  if (statement.operator === ">") return left > right;
  return left === right;
}

function applyOptionCodeHandlers(rawOptions = {}, env) {
  for (const [key, value] of Object.entries(rawOptions || {})) {
    const handler = env.codeHandlers?.[key];
    if (!handler) continue;
    const args = matchCodeArguments(handler.pattern, value === true ? "" : String(value));
    applyCodeHandlerBody(handler.body, args, env);
  }
}

function matchCodeArguments(pattern, rawArgument) {
  const tokens = [];
  const regexText = String(pattern || "")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/#(\d+)/g, (_match, index) => {
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

function applyCodeHandlerBody(body, args, env) {
  let index = 0;
  while (index < String(body || "").length) {
    const defIndex = String(body || "").indexOf("\\def\\", index);
    if (defIndex === -1) break;
    let cursor = defIndex + "\\def\\".length;
    const nameMatch = String(body).slice(cursor).match(/^[A-Za-z@]+/);
    if (!nameMatch) {
      index = cursor;
      continue;
    }
    const name = nameMatch[0];
    cursor += name.length;
    cursor = skipLocalWhitespace(body, cursor);
    const value = extractLocalBalanced(body, cursor, "{", "}");
    if (!value) {
      index = cursor;
      continue;
    }
    env.variables[name] = substituteCodeArguments(value.content, args);
    index = value.end;
  }
}

function substituteCodeArguments(value, args = []) {
  return String(value).replace(/#(\d+)/g, (_match, index) => {
    const arg = args[Number(index) - 1];
    return arg === undefined || arg === true ? "" : String(arg);
  });
}

function extractLocalBalanced(text, start, open, close) {
  if (String(text)[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < String(text).length; index += 1) {
    const char = String(text)[index];
    if (char === open) depth += 1;
    if (char === close) depth -= 1;
    if (depth === 0) {
      return {
        content: String(text).slice(start + 1, index),
        end: index + 1
      };
    }
  }
  return null;
}

function mergeScopePictureOptions(parentOptions = {}, scopeOptions = {}) {
  const merged = { ...parentOptions };
  for (const [key, value] of Object.entries(scopeOptions || {})) {
    if (isScopeTransformOption(key) || isScopeDefinitionOption(key)) continue;
    merged[key] = value;
  }
  return merged;
}

function isScopeTransformOption(key) {
  return [
    "shift",
    "xshift",
    "yshift",
    "scale",
    "rotate",
    "xslant",
    "yslant",
    "transform canvas",
    "x",
    "y",
    "z",
    "layer",
    "on background layer"
  ].includes(String(key).trim());
}

function isScopeDefinitionOption(key) {
  return /\/\.(?:style|code|append style|prefix style)$/.test(String(key).trim());
}

function stripStyleDefinitionOptions(options = {}) {
  const stripped = {};
  for (const [key, value] of Object.entries(options || {})) {
    if (isScopeDefinitionOption(key)) continue;
    stripped[key] = value;
  }
  return stripped;
}

function interpretPathStatement(statement, env, ir, diagnostics) {
  const rawOptions = resolveDynamicOptions({ ...(env.pictureOptions || {}), ...(statement.options || {}) }, env);
  const normalized = normalizeOptions(statement.command, rawOptions, env);
  const style = scaleCanvasStyle(normalized.style, env);
  const { semantic, options } = normalized;
  const pathOptions = { ...options, ...semantic };
  const pathEnv = {
    ...env,
    transform: shouldApplyStatementTransformToPath(statement) ? composeTransform(env.transform, statement.options || {}, env) : env.transform,
    basis: composeBasis(env.basis, options, env)
  };
  const subtype = semanticSubtype(pathOptions);

  if (semantic["name intersections"]) {
    for (const raw of repeatedSemanticValues(semantic["name intersections"])) {
      materializeIntersections(raw, pathEnv, diagnostics);
    }
  }

  const built = buildPath(statement.path.segments, pathEnv, diagnostics, pathOptions, style);
  if (semantic["name path"]) {
    pathEnv.namedPaths[String(semantic["name path"]).trim()] = built.commands.length
      ? built.commands
      : built.shapes.flatMap((shape) => shape.commands || []);
  }

  const visible = isVisiblePath(statement.command, style, semantic, built.styleHints);
  addDecorationTextItems(built, pathOptions, style, ir, pathEnv);
  if (visible) {
    const doubleStyle = doublePathStyle(semantic, env);
    const shadingStyle = pathShadingStyle(style, semantic, pathEnv);
    const styledShapes = built.shapes.map((shape) => ({
      ...shape,
      subtype: shape.subtype || subtype,
      style: { ...style, ...shadingStyle, ...doubleStyle, ...(shape.style || {}) }
    }));
    const compoundShape = compoundFillRuleShape(styledShapes, pathOptions, subtype);
    const shapesToRender = compoundShape ? [compoundShape] : styledShapes;
    for (const shape of shapesToRender) {
      ir.items.push(shape);
    }
    if (hasDrawableCommands(built.commands, built.shapes)) {
      const pathStyle = drawablePathStyle(style, { ...shadingStyle, ...built.styleHints, ...doubleStyle });
      const item = {
        type: "path",
        subtype: built.styleHints.subtype || subtype,
        tightBezierBounds: tikzBoolean(pathOptions["bezier bounding box"]),
        style: pathStyle,
        commands: applyArrowEndpointShortening(built.commands, pathStyle, built.endpointRefs)
      };
      ir.items.push(item);
      addDecorationMarkers(item, options, ir);
    }
    for (const shape of shapesToRender) {
      addDecorationMarkers(shape, options, ir);
    }
  }
  for (const node of built.nodes) {
    addNodeItems(node, ir, pathEnv);
  }
}

function shouldApplyStatementTransformToPath(statement) {
  if (!isCoordinateNodePlacementPath(statement.path?.segments || [])) return true;
  const options = statement.options || {};
  return !(Object.hasOwn(options, "xshift") || Object.hasOwn(options, "yshift") || Object.hasOwn(options, "shift"));
}

function isCoordinateNodePlacementPath(segments = []) {
  if (segments.length !== 2) return false;
  const [coordinate, node] = segments;
  if (coordinate?.kind !== "coordinate" || node?.kind !== "node" || node.at) return false;
  const raw = String(coordinate.raw || "").trim();
  return Boolean(raw && !raw.includes(",") && !raw.includes(":") && !raw.includes("$"));
}

function buildPath(segments, env, diagnostics, pathOptions = {}, pathStyle = {}) {
  const commands = [];
  const shapes = [];
  const nodes = [];
  const styleHints = {};
  const effectivePathOptions = { ...pathOptions };
  let current = null;
  let currentLocal = null;
  let currentBase = null;
  let currentNodeRef = null;
  let start = null;
  let startNodeRef = null;
  let endNodeRef = null;
  let pending = null;
  let pendingInlineNodes = [];
  let lastSegment = null;
  let pendingPlotMark = null;

  for (const segment of segments) {
    if (segment.kind === "unknown") {
      const mark = String(segment.raw || "").match(/\bplot\s*\[[^\]]*\bmark\s*=\s*([^\],\s]+)[^\]]*\]/);
      if (mark) pendingPlotMark = mark[1];
      continue;
    }
    if (segment.kind === "operator") {
      pending = { value: segment.value, options: segment.options || {} };
      continue;
    }
    if (segment.kind === "coordinate") {
      const pendingValue = pending?.value ?? pending;
      const pendingOptions = pending?.options || {};
      const point = segment.relative ? resolveRelativeCoordinate(segment.raw, current, env, diagnostics) : resolveCoordinate(segment.raw, env, diagnostics);
      if (pendingPlotMark) {
        shapes.push(buildPlotMark(point, pendingPlotMark, pathStyle, effectivePathOptions, env));
        pendingPlotMark = null;
      }
      const localPoint = segment.relative || !shouldResolveAsLocalRectangleCorner(segment.raw)
        ? null
        : resolveLocalCoordinate(segment.raw, env, diagnostics);
      const nodeRef = segment.relative ? null : defaultPathNodeReference(segment.raw, env);
      // Claude: 形如 \draw rectangle (8,8) / \draw grid (4,4)（没有显式起点）时，TikZ 以局部原点
      // (0,0) 作为第一个角。原代码因 current 为空直接走下面的 moveTo 分支、把矩形/网格丢掉了
      // （只剩一个 moveTo）。这里在遇到这类挂起操作且尚无当前点时，先把经过当前变换的局部原点
      // 设为起点，让后面的 rectangle/grid 分支正常生成图形（变换会把它剪成平行四边形，见 case 047）。
      if (!current && (pendingValue === "rectangle" || pendingValue === "grid")) {
        const origin = applyTransform({ x: 0, y: 0 }, env.transform);
        commands.push({ type: "moveTo", x: origin.x, y: origin.y });
        current = origin;
        currentLocal = { x: 0, y: 0 };
        currentBase = origin;
        start = origin;
        startNodeRef = null;
      }
      if (!current) {
        commands.push({ type: "moveTo", x: point.x, y: point.y });
        current = point;
        currentLocal = localPoint || point;
        currentBase = point;
        currentNodeRef = nodeRef;
        start = point;
        startNodeRef = nodeRef;
        endNodeRef = nodeRef;
      } else if (pendingValue === "grid") {
        shapes.push(...buildGrid(current, point, effectivePathOptions, env));
        current = point;
        currentLocal = localPoint || point;
        currentBase = point;
        currentNodeRef = nodeRef;
        endNodeRef = nodeRef;
      } else if (pendingValue === "rectangle") {
        const corners =
          currentLocal && localPoint
            ? transformedRectangleCorners(currentLocal, localPoint, env.transform)
            : [
                { x: point.x, y: current.y },
                point,
                { x: current.x, y: point.y }
              ];
        commands.push({ type: "lineTo", x: corners[0].x, y: corners[0].y });
        commands.push({ type: "lineTo", x: corners[1].x, y: corners[1].y });
        commands.push({ type: "lineTo", x: corners[2].x, y: corners[2].y });
        commands.push({ type: "closePath" });
        lastSegment = { from: current, to: point };
        current = point;
        currentLocal = localPoint || point;
        currentBase = point;
        currentNodeRef = nodeRef;
        endNodeRef = nodeRef;
      } else if (pendingValue === "--") {
        const clipped = clipNodeLineEndpoints(currentBase || current, currentNodeRef, point, nodeRef, env);
        if (shouldBreakAtNodeExit(currentNodeRef)) moveToNodeExit(commands, clipped.from);
        commands.push({ type: "lineTo", x: clipped.to.x, y: clipped.to.y });
        flushInlinePathNodes(pendingInlineNodes, clipped.from, clipped.to, nodes, env, pathStyle);
        lastSegment = { from: clipped.from, to: clipped.to };
        pendingInlineNodes = [];
        current = clipped.to;
        currentLocal = localPoint || point;
        currentBase = point;
        currentNodeRef = nodeRef;
        endNodeRef = nodeRef;
      } else if (pendingValue === "|-" || pendingValue === "-|") {
        const elbow = pendingValue === "|-"
          ? { x: (currentBase || current).x, y: point.y }
          : { x: point.x, y: (currentBase || current).y };
        const first = clipNodeLineEndpoints(currentBase || current, currentNodeRef, elbow, null, env);
        const second = clipNodeLineEndpoints(elbow, null, point, nodeRef, env);
        if (shouldBreakAtNodeExit(currentNodeRef)) moveToNodeExit(commands, first.from);
        commands.push({ type: "lineTo", x: first.to.x, y: first.to.y });
        commands.push({ type: "lineTo", x: second.to.x, y: second.to.y });
        flushInlinePathNodes(pendingInlineNodes, first.from, first.to, nodes, env, pathStyle);
        lastSegment = { from: first.from, to: first.to };
        pendingInlineNodes = [];
        current = second.to;
        currentLocal = localPoint || point;
        currentBase = point;
        currentNodeRef = nodeRef;
        endNodeRef = nodeRef;
      } else if (isTikzExtOrthoOperator(pendingValue)) {
        styleHints.subtype = "tikz-ext-ortho";
        const polyline = tikzExtOrthoPolyline(pendingValue, currentBase || current, point, pendingOptions, env);
        const drawn = drawPolyline(commands, polyline, currentNodeRef, nodeRef, env);
        flushInlinePathNodes(pendingInlineNodes, drawn.from, drawn.to, nodes, env, pathStyle);
        lastSegment = { from: drawn.from, to: drawn.to };
        pendingInlineNodes = [];
        current = drawn.to;
        currentLocal = localPoint || point;
        currentBase = point;
        currentNodeRef = nodeRef;
        endNodeRef = nodeRef;
      } else {
        flushInlinePathNodes(pendingInlineNodes, current, current, nodes, env, pathStyle);
        pendingInlineNodes = [];
        commands.push({ type: "moveTo", x: point.x, y: point.y });
        current = point;
        currentLocal = localPoint || point;
        currentBase = point;
        currentNodeRef = nodeRef;
        start = point;
        endNodeRef = nodeRef;
        lastSegment = null;
      }
      pending = null;
      continue;
    }
    if (segment.kind === "coordinateName" && current) {
      const name = resolveDynamicName(segment.name, env);
      env.coordinates[name] = roundPoint(current);
      continue;
    }
    if ((segment.kind === "edge" || segment.kind === "to") && current) {
      const to = segment.relative
        ? resolveRelativeCoordinate(segment.to, currentBase || current, env, diagnostics)
        : resolveCoordinate(segment.to, env, diagnostics);
      const toNodeRef = segment.relative ? null : defaultPathNodeReference(segment.to, env);
      if (segment.nodes?.length) {
        for (const labelNode of segment.nodes) {
          pendingInlineNodes.push({
            ...labelNode,
            text: substituteTextVariables(labelNode.text, env.variables)
          });
        }
      }
      const combinedEdgeOptions = { ...effectivePathOptions, ...(segment.options || {}) };
      const circuitikz = appendCircuitikzToSegment({
        commands,
        shapes,
        nodes,
        from: currentBase || current,
        to,
        options: combinedEdgeOptions,
        env,
        pathStyle,
        styleHints
      });
      if (circuitikz) {
        flushInlinePathNodes(pendingInlineNodes, circuitikz.from, circuitikz.to, nodes, env, pathStyle);
        lastSegment = { from: circuitikz.from, to: circuitikz.to };
        pendingInlineNodes = [];
        current = circuitikz.drawnTo;
        currentLocal = null;
        currentBase = to;
        currentNodeRef = toNodeRef;
        endNodeRef = toNodeRef;
        pending = null;
        continue;
      }
      Object.assign(styleHints, edgeStyleHintsFromOptions(combinedEdgeOptions, env));
      Object.assign(effectivePathOptions, edgePathOptions(combinedEdgeOptions));
      const loopDirection = loopDirectionFromOptions(combinedEdgeOptions);
      const arcThrough = parseTikzExtArcThrough(combinedEdgeOptions);
      if (arcThrough) {
        styleHints.subtype = "tikz-ext-arc";
        const through = resolveCoordinate(arcThrough.through, env, diagnostics);
        const arc = tikzExtArcThroughCommands(currentBase || current, through, to, arcThrough, env);
        if (arc.center) env.coordinates[`arc through center${arcThrough.suffix || ""}`] = arc.center;
        commands.push(...arc.commands);
        flushInlinePathNodes(pendingInlineNodes, currentBase || current, to, nodes, env, pathStyle);
        lastSegment = { from: currentBase || current, to };
        pendingInlineNodes = [];
        current = to;
        currentLocal = null;
        currentBase = to;
        currentNodeRef = toNodeRef;
        endNodeRef = toNodeRef;
        pending = null;
        continue;
      }
      if (loopDirection && pointsAlmostEqual(currentBase || current, to)) {
        const loop = buildSelfLoop(currentBase || current, currentNodeRef, loopDirection, combinedEdgeOptions, env);
        if (shouldBreakAtNodeExit(currentNodeRef)) moveToNodeExit(commands, loop.start);
        commands.push(...loop.commands);
        flushInlinePathNodesAt(pendingInlineNodes, loop.labelPoint, nodes, env, pathStyle);
        lastSegment = { from: loop.start, to: loop.end };
        pendingInlineNodes = [];
        current = loop.end;
        currentBase = to;
        currentNodeRef = toNodeRef;
        endNodeRef = toNodeRef;
        pending = null;
        continue;
      }
      const edgeFrom = currentBase || current;
      // Claude: 先按"直线弦"裁一次得到端点角度基准，再判断有没有弯（bend/out-in）。
      // 有弯时端点要沿曲线"切线方向"重新裁到节点边框，否则箭头会挂在角上（见 case 020 的两条 bend 弧）。
      const straightClipped = clipNodeLineEndpoints(edgeFrom, currentNodeRef, to, toNodeRef, env);
      const curve = edgeCurveSpec(combinedEdgeOptions, straightClipped.from, straightClipped.to, env, currentNodeRef, toNodeRef);
      const clipped = curve
        ? clipNodeCurveEndpoints(edgeFrom, currentNodeRef, to, toNodeRef, curve, env)
        : straightClipped;
      if (curve) {
        if (shouldBreakAtNodeExit(currentNodeRef)) moveToNodeExit(commands, clipped.from);
        const distance = tikzCurveControlDistance(clipped.from, clipped.to);
        const c1 = polarOffset(clipped.from, curve.out, distance * curve.outLooseness);
        const c2 = polarOffset(clipped.to, curve.in, distance * curve.inLooseness);
        commands.push({ type: "curveTo", x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y, x: clipped.to.x, y: clipped.to.y });
        const labelGeometry = cubicLabelGeometry(clipped.from, c1, c2, clipped.to);
        flushInlinePathNodesAt(pendingInlineNodes, labelGeometry.point, nodes, env, pathStyle, labelGeometry.segment);
        lastSegment = { from: clipped.from, to: clipped.to };
      } else {
        if (shouldBreakAtNodeExit(currentNodeRef)) moveToNodeExit(commands, clipped.from);
        commands.push({ type: "lineTo", x: clipped.to.x, y: clipped.to.y });
        flushInlinePathNodes(pendingInlineNodes, clipped.from, clipped.to, nodes, env, pathStyle);
        lastSegment = { from: clipped.from, to: clipped.to };
      }
      pendingInlineNodes = [];
      current = clipped.to;
      currentLocal = null;
      currentBase = to;
      currentNodeRef = toNodeRef;
      endNodeRef = toNodeRef;
      pending = null;
      continue;
    }
    if (segment.kind === "arcTo" && current) {
      styleHints.subtype = "tikz-ext-arc";
      if (segment.nodes?.length) {
        for (const labelNode of segment.nodes) {
          pendingInlineNodes.push({
            ...labelNode,
            text: substituteTextVariables(labelNode.text, env.variables)
          });
        }
      }
      const to = resolveCoordinate(segment.to, env, diagnostics);
      const arc = tikzExtArcToCommands(currentBase || current, to, { ...pathOptions, ...segment.options }, env);
      commands.push(...arc.commands);
      flushInlinePathNodes(pendingInlineNodes, currentBase || current, to, nodes, env, pathStyle);
      lastSegment = { from: currentBase || current, to };
      pendingInlineNodes = [];
      current = to;
      currentLocal = null;
      currentBase = to;
      currentNodeRef = null;
      pending = null;
      continue;
    }
    if (segment.kind === "curveTo" && current) {
      const c1 = resolveControlPoint(segment.c1, current, env, diagnostics);
      const c2 = resolveControlPoint(segment.c2, current, env, diagnostics);
      const to = resolveCoordinate(segment.to, env, diagnostics);
      commands.push({
        type: "curveTo",
        x1: c1.x,
        y1: c1.y,
        x2: c2.x,
        y2: c2.y,
        x: to.x,
        y: to.y
      });
      lastSegment = { from: current, to };
      current = to;
      currentLocal = null;
      currentBase = to;
      currentNodeRef = null;
      continue;
    }
    if (segment.kind === "sineCosine" && current) {
      const to = resolveCoordinate(segment.to, env, diagnostics);
      commands.push(sineCosineCurveCommand(current, to, segment.op));
      lastSegment = { from: current, to };
      current = to;
      currentLocal = null;
      currentBase = to;
      currentNodeRef = null;
      endNodeRef = null;
      pending = null;
      continue;
    }
    if (segment.kind === "circle") {
      const center = current || applyTransform({ x: 0, y: 0 }, env.transform);
      const r = parseDimension(segment.radius, env.variables);
      const commands = circleCommands(center, r, env);
      shapes.push(
        decoratedShape(
          {
            type: "path",
            shape: "circle",
            projected: usesProjectedLocalGeometry(env),
            subtype: semanticSubtype(pathOptions),
            cx: center.x,
            cy: center.y,
            r,
            commands,
            style: {}
          },
          effectivePathOptions,
          env
        )
      );
      continue;
    }
    if (segment.kind === "ellipse" && current) {
      const [rxRaw, ryRaw] = segment.radius.split(/\s+and\s+/);
      const rx = parseDimension(segment.options?.["x radius"] || rxRaw, env.variables);
      const ry = parseDimension(segment.options?.["y radius"] || ryRaw || rxRaw, env.variables);
      const commands = ellipseCommands(current, rx, ry, env);
      shapes.push(
        decoratedShape(
          {
            type: "path",
            shape: "ellipse",
            projected: usesProjectedLocalGeometry(env),
            cx: current.x,
            cy: current.y,
            rx,
            ry,
            commands
          },
          effectivePathOptions,
          env
        )
      );
      continue;
    }
    if (segment.kind === "arc" && current) {
      const arc = buildArc(current, segment.options, env);
      shapes.push(arc);
      current = arc.endPoint;
      currentLocal = null;
      continue;
    }
    if (segment.kind === "plot") {
      const plot = buildPlot(segment.coordinate, env, { ...pathOptions, ...(segment.options || {}) });
      for (const command of plot) commands.push(command);
      current = plot.at(-1) ? { x: plot.at(-1).x, y: plot.at(-1).y } : current;
      currentLocal = null;
      currentBase = current;
      currentNodeRef = null;
      continue;
    }
    if (segment.kind === "plotFunction") {
      const plot = buildPlotFunction(segment.expression, env, { ...pathOptions, ...(segment.options || {}) });
      for (const command of plot.commands) commands.push(command);
      if (plot.points.length) {
        current = plot.points.at(-1);
        currentLocal = null;
        currentBase = current;
        currentNodeRef = null;
        endNodeRef = null;
        if (!start) {
          start = plot.points[0];
          startNodeRef = null;
        }
      }
      continue;
    }
    if (segment.kind === "plotCoordinates") {
      const plot = buildPlotCoordinates(segment.coordinates || [], env, diagnostics, { ...pathOptions, ...(segment.options || {}) });
      const mark = segment.options?.mark ?? pathOptions.mark;
      if (mark && String(mark).trim().toLowerCase() !== "none") {
        const markOptions = { ...pathOptions, ...(segment.options || {}) };
        shapes.push(...plot.points.map((point) => buildPlotMark(point, mark, pathStyle, markOptions, env)));
      }
      for (const command of plot.commands) commands.push(command);
      if (plot.points.length) {
        current = plot.points.at(-1);
        currentLocal = null;
        currentBase = current;
        currentNodeRef = null;
        endNodeRef = null;
        if (!start) {
          start = plot.points[0];
          startNodeRef = null;
        }
      }
      continue;
    }
    if (segment.kind === "node") {
      const text = substituteTextVariables(segment.text, env.variables);
      if (!segment.at && current && pending) {
        pendingInlineNodes.push({ ...segment, text });
        continue;
      }
      const point = segment.at
        ? resolveCoordinate(segment.at, env, diagnostics)
        : inlineNodePathPoint(segment.options, lastSegment) || current || applyTransform({ x: 0, y: 0 }, env.transform);
      addInlinePathNode(segment, text, point, nodes, env, pathStyle, lastSegment);
      continue;
    }
    if (segment.kind === "close" && start) {
      commands.push({ type: "closePath" });
      if (current) lastSegment = { from: current, to: start };
      current = start;
      endNodeRef = startNodeRef;
    }
  }

  flushInlinePathNodes(pendingInlineNodes, current, current, nodes, env, pathStyle);
  return {
    commands: applyPathMorphing(commands, effectivePathOptions, env, pathStyle),
    shapes,
    nodes,
    styleHints,
    endpointRefs: { start: startNodeRef, end: endNodeRef }
  };
}

function inlineNodePathPoint(options = {}, lastSegment) {
  if (!lastSegment) return null;
  let pos = null;
  if (Object.hasOwn(options, "pos")) pos = Number(options.pos);
  else if (Object.hasOwn(options, "midway")) pos = 0.5;
  else if (Object.hasOwn(options, "near start")) pos = 0.25;
  else if (Object.hasOwn(options, "near end")) pos = 0.75;
  if (!Number.isFinite(pos)) return null;
  const t = Math.max(0, Math.min(1, pos));
  return roundPoint({
    x: lastSegment.from.x + (lastSegment.to.x - lastSegment.from.x) * t,
    y: lastSegment.from.y + (lastSegment.to.y - lastSegment.from.y) * t
  });
}

function isTikzExtOrthoOperator(value) {
  return ["|-|", "-|-", "r-ud", "r-du", "r-lr", "r-rl"].includes(value);
}

function tikzExtOrthoPolyline(operator, from, to, options = {}, env) {
  const distance = tikzExtOrthoDistance(operator, options, env);
  if (operator === "-|-") {
    const midX = tikzExtMiddleCoordinate(from.x, to.x, options["hvh distance"] ?? options["distance"], options["hvh ratio"] ?? options["ratio"], env);
    return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to].map(roundPoint);
  }
  if (operator === "|-|") {
    const midY = tikzExtMiddleCoordinate(from.y, to.y, options["vhv distance"] ?? options["distance"], options["vhv ratio"] ?? options["ratio"], env);
    return [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to].map(roundPoint);
  }
  if (operator === "r-ud") return [from, { x: from.x, y: from.y + distance }, { x: to.x, y: from.y + distance }, to].map(roundPoint);
  if (operator === "r-du") return [from, { x: from.x, y: from.y - distance }, { x: to.x, y: from.y - distance }, to].map(roundPoint);
  if (operator === "r-lr") return [from, { x: from.x - distance, y: from.y }, { x: from.x - distance, y: to.y }, to].map(roundPoint);
  if (operator === "r-rl") return [from, { x: from.x + distance, y: from.y }, { x: from.x + distance, y: to.y }, to].map(roundPoint);
  return [from, to].map(roundPoint);
}

function tikzExtMiddleCoordinate(start, end, distanceRaw, ratioRaw, env) {
  if (distanceRaw !== undefined && distanceRaw !== null && distanceRaw !== true && distanceRaw !== "") {
    const text = String(distanceRaw).replace(/\s+/g, "");
    const parsed = parseDimension(text.replace(/^\+\-/, "-").replace(/^\+/, ""), env.variables);
    if (Number.isFinite(parsed)) return parsed < 0 ? end + parsed : start + parsed;
  }
  const ratio = evaluateMath(ratioRaw ?? 0.5, env.variables);
  const t = Number.isFinite(ratio) ? ratio : 0.5;
  return start + (end - start) * t;
}

function tikzExtOrthoDistance(operator, options = {}, env) {
  const key = operator === "r-ud" ? "ud distance" : operator === "r-du" ? "du distance" : operator === "r-lr" ? "lr distance" : "rl distance";
  const raw = options[key] ?? options["udlr distance"] ?? options["distance"] ?? ".5cm";
  const parsed = parseDimension(String(raw).replace(/\s+/g, ""), env.variables);
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0.5;
}

function drawPolyline(commands, points, startNodeRef, endNodeRef, env) {
  let firstFrom = points[0];
  let lastTo = points.at(-1);
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const clipped = clipNodeLineEndpoints(from, index === 1 ? startNodeRef : null, to, index === points.length - 1 ? endNodeRef : null, env);
    if (index === 1) {
      firstFrom = clipped.from;
      if (shouldBreakAtNodeExit(startNodeRef)) moveToNodeExit(commands, clipped.from);
    }
    commands.push({ type: "lineTo", x: clipped.to.x, y: clipped.to.y });
    lastTo = clipped.to;
  }
  return { from: firstFrom, to: lastTo };
}

function appendCircuitikzToSegment({ commands, shapes, nodes, from, to, options = {}, env, pathStyle = {}, styleHints = null }) {
  const spec = circuitikzBipoleSpec(options);
  if (!spec || !from || !to) return null;
  const geometry = circuitikzSegmentGeometry(from, to);
  if (!geometry) return null;

  if (spec.kind === "short") {
    commands.push({ type: "lineTo", x: to.x, y: to.y });
  } else if (spec.kind === "resistor") {
    const split = appendCircuitikzSplitWire(
      commands,
      from,
      to,
      geometry,
      circuitikzBodyLength("resistor", geometry.length, env),
      pathStyle,
      styleHints,
      options,
      env
    );
    shapes.push(circuitikzResistorItem(from, to, geometry, pathStyle, env));
    if (split.postLead) shapes.push(split.postLead);
  } else if (spec.kind === "capacitor") {
    const split = appendCircuitikzSplitWire(
      commands,
      from,
      to,
      geometry,
      circuitikzBodyLength("capacitor", geometry.length, env),
      pathStyle,
      styleHints,
      options,
      env
    );
    shapes.push(circuitikzCapacitorItem(from, to, geometry, pathStyle, env));
    if (split.postLead) shapes.push(split.postLead);
  } else if (spec.kind === "voltageSource") {
    const split = appendCircuitikzSplitWire(
      commands,
      from,
      to,
      geometry,
      circuitikzBodyLength("voltageSource", geometry.length, env),
      pathStyle,
      styleHints,
      options,
      env
    );
    shapes.push(...circuitikzVoltageSourceItems(from, to, geometry, spec, pathStyle, env));
    if (split.postLead) shapes.push(split.postLead);
  } else if (spec.kind === "isource") {
    const split = appendCircuitikzSplitWire(
      commands,
      from,
      to,
      geometry,
      circuitikzBodyLength("isource", geometry.length, env),
      pathStyle,
      styleHints,
      options,
      env
    );
    shapes.push(...circuitikzCurrentSourceItems(from, to, geometry, pathStyle, env));
    if (split.postLead) shapes.push(split.postLead);
  } else if (spec.kind === "mosfet") {
    commands.push({ type: "moveTo", x: to.x, y: to.y });
    shapes.push(...circuitikzMosfetItems(from, to, geometry, spec, pathStyle, env));
    registerCircuitikzMosfetNode(spec, from, to, geometry, env);
  }

  for (const terminal of circuitikzTerminals(options, from, to)) {
    shapes.push(circuitikzTerminalItem(terminal, pathStyle, env));
  }
  appendCircuitikzComponentLabel(nodes, spec, from, to, geometry, env);
  appendCircuitikzCurrentLabel(nodes, shapes, spec, from, to, geometry, options, pathStyle, env);
  appendCircuitikzFlowLabel(nodes, shapes, spec, from, to, geometry, options, pathStyle, env);
  appendCircuitikzVoltageLabel(nodes, shapes, spec, from, to, geometry, options, pathStyle, env);

  return { from: roundPoint(from), to: roundPoint(to), drawnTo: roundPoint(to) };
}

function circuitikzPackageSettings(packages = []) {
  const circuitikzPackage = (packages || []).find((pkg) => pkg?.name === "circuitikz");
  const options = circuitikzPackage?.options || {};
  const optionKeys = Object.keys(options).map((key) => key.toLowerCase());
  const hasOption = (name) => optionKeys.includes(String(name).toLowerCase());
  return {
    packageOptions: { ...options },
    siunitx: hasOption("siunitx"),
    RPvoltages: hasOption("RPvoltages"),
    voltageMode: hasOption("RPvoltages") ? "RPvoltages" : null
  };
}

function circuitikzBipoleSpec(options = {}) {
  const resistorLabel = circuitikzFirstLabel(options, ["R", "resistor", "american resistor", "european resistor"]);
  if (resistorLabel !== null) return { kind: "resistor", label: resistorLabel };
  const capacitorLabel = circuitikzFirstLabel(options, ["C", "capacitor"]);
  if (capacitorLabel !== null) return { kind: "capacitor", label: capacitorLabel };
  const sinusoidalVoltage = circuitikzFirstMatchingOption(options, /^sV[<>_^]*$/);
  if (sinusoidalVoltage) {
    return { kind: "voltageSource", sourceKind: "sinusoidal", label: sinusoidalVoltage.label, voltageKey: sinusoidalVoltage.key };
  }
  const voltage = circuitikzFirstMatchingOption(options, /^V[<>_^]*$/);
  if (voltage) return { kind: "voltageSource", sourceKind: "plain", label: voltage.label, voltageKey: voltage.key };
  const sourceLabel = circuitikzFirstLabel(options, ["isource", "I", "current source", "american current source", "european current source"]);
  if (sourceLabel !== null) return { kind: "isource", label: circuitikzLabelValue(options.l) || sourceLabel };
  const pmosLabel = circuitikzFirstLabel(options, ["Tpmos", "pmos", "tpmos"]);
  if (pmosLabel !== null) return { kind: "mosfet", mosfetKind: "pmos", label: pmosLabel, name: circuitikzComponentName(options, pmosLabel) };
  const nmosLabel = circuitikzFirstLabel(options, ["Tnmos", "nmos", "tnmos"]);
  if (nmosLabel !== null) return { kind: "mosfet", mosfetKind: "nmos", label: nmosLabel, name: circuitikzComponentName(options, nmosLabel) };
  if (options.short !== undefined) return { kind: "short", label: circuitikzLabelValue(options.l) };
  return null;
}

function circuitikzComponentName(options = {}, fallback = "") {
  for (const key of ["n", "name"]) {
    if (options[key] === undefined) continue;
    const value = circuitikzLabelValue(options[key]);
    return value || fallback || "";
  }
  return fallback || "";
}

function circuitikzFirstLabel(options = {}, keys = []) {
  for (const key of keys) {
    if (options[key] === undefined) continue;
    return circuitikzLabelValue(options[key]) || "";
  }
  return null;
}

function circuitikzFirstMatchingLabel(options = {}, pattern) {
  return circuitikzFirstMatchingOption(options, pattern)?.label ?? null;
}

function circuitikzFirstMatchingOption(options = {}, pattern) {
  for (const [key, value] of Object.entries(options || {})) {
    pattern.lastIndex = 0;
    if (!pattern.test(key)) continue;
    return { key, label: circuitikzLabelValue(value) || "" };
  }
  return null;
}

function circuitikzLabelValue(value) {
  if (value === undefined || value === null || value === true || value === false) return "";
  return String(value).trim();
}

const CIRCUITIKZ_UNIT_SYMBOLS = {
  ohm: "Ω",
  volt: "V",
  ampere: "A",
  amp: "A",
  farad: "F",
  henry: "H",
  siemens: "S",
  watt: "W",
  second: "s",
  hertz: "Hz"
};

function circuitikzTextLabel(value, env = {}) {
  const text = circuitikzLabelValue(value);
  if (!text) return "";
  return circuitikzFormatSiunitxLabel(text, env);
}

function circuitikzFormatSiunitxLabel(text, env = {}) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  if (!env.circuitikz?.siunitx && !/<\\[A-Za-z]+>/.test(raw) && !/\\SI\b|\\(?:ohm|volt|ampere|farad|henry|siemens|watt)\b/.test(raw)) {
    return raw;
  }
  return raw
    .replace(/\\SI\{([^{}]+)\}\{\\([A-Za-z]+)\}/g, (_match, value, unit) => `${value.trim()} ${circuitikzUnitSymbol(unit)}`)
    .replace(/([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?)\s*<\\([A-Za-z]+)>/g, (_match, value, unit) => {
      return `${value.trim()} ${circuitikzUnitSymbol(unit)}`;
    })
    .replace(/\\([A-Za-z]+)\b/g, (match, unit) => CIRCUITIKZ_UNIT_SYMBOLS[unit] || match)
    .replace(/\s+/g, " ")
    .trim();
}

function circuitikzUnitSymbol(unit) {
  return CIRCUITIKZ_UNIT_SYMBOLS[String(unit || "").trim()] || String(unit || "").trim();
}

function circuitikzSegmentGeometry(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return null;
  const ux = dx / length;
  const uy = dy / length;
  return {
    length,
    u: { x: ux, y: uy },
    n: { x: -uy, y: ux },
    mid: roundPoint({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 })
  };
}

function circuitikzLengthScale(env = {}) {
  const scale = canvasLengthScale(env);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function circuitikzOpAmpSize(env = {}) {
  return { width: 1.7, height: 1.4 };
}

function circuitikzGroundSize(env = {}) {
  const scale = circuitikzLengthScale(env);
  return { width: roundNumber(0.44 * scale), height: roundNumber(0.36 * scale) };
}

function circuitikzTransistorSize(env = {}) {
  const scale = circuitikzLengthScale(env);
  return { width: roundNumber(1.75 * scale), height: roundNumber(1.55 * scale) };
}

function circuitikzTubeSize(env = {}, options = {}) {
  const scale = circuitikzLengthScale(env);
  const rlenScale = 1.4;
  return {
    width: roundNumber(circuitikzTubeNumber("width", options, env, 1) * rlenScale * scale),
    height: roundNumber(circuitikzTubeNumber("height", options, env, 1.4) * rlenScale * scale)
  };
}

function circuitikzQuadpoleSize(env = {}, options = {}) {
  const kind = circuitikzQuadpoleKind(options) || "transformer";
  const scale = circuitikzLengthScale(env);
  const rlenScale = 1.4;
  return {
    width: roundNumber(circuitikzQuadpoleNumber(kind, "width", options, env, 1.5) * rlenScale * scale),
    height: roundNumber(circuitikzQuadpoleNumber(kind, "height", options, env, 1.5) * rlenScale * scale)
  };
}

function circuitikzQuadpoleRawOption(kind, key, options = {}, env = {}) {
  const names = [`circuitikz/quadpoles/${kind}/${key}`, `quadpoles/${kind}/${key}`];
  for (const name of names) {
    if (options[name] !== undefined) return options[name];
  }
  for (const name of names) {
    if (env.pictureOptions?.[name] !== undefined) return env.pictureOptions[name];
  }
  for (const name of names) {
    if (env.circuitikz?.[name] !== undefined) return env.circuitikz[name];
  }
  return undefined;
}

function circuitikzQuadpoleNumber(kind, key, options = {}, env = {}, fallback = 0) {
  const raw = circuitikzQuadpoleRawOption(kind, key, options, env);
  if (raw === undefined || raw === null || raw === true || raw === "") return fallback;
  const parsed = evaluateMath(String(raw), env.variables);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function circuitikzQuadpoleSettings(options = {}, env = {}) {
  const kind = circuitikzQuadpoleKind(options) || "transformer";
  return {
    kind,
    inner: circuitikzQuadpoleNumber(kind, "inner", options, env, 0.4),
    width: circuitikzQuadpoleNumber(kind, "width", options, env, 1.5),
    height: circuitikzQuadpoleNumber(kind, "height", options, env, 1.5),
    coils: {
      L1: circuitikzTransformerCoilStyle("L1", options, env),
      L2: circuitikzTransformerCoilStyle("L2", options, env)
    },
    inductorKind: env.circuitikz?.["inductors/kind"] || null
  };
}

function circuitikzTransformerCoilStyle(coil, options = {}, env = {}) {
  const merged = {};
  const keys = [`transformer ${coil}/.style`, `transformer ${coil}`, `circuitikz/transformer ${coil}/.style`, `circuitikz/transformer ${coil}`];
  for (const source of [env.pictureOptions || {}, env.circuitikz || {}, options || {}]) {
    for (const key of keys) {
      if (source[key] === undefined) continue;
      Object.assign(merged, parseCtikzStyleValue(source[key]));
    }
  }
  if (!merged["inductors/kind"] && env.circuitikz?.["inductors/kind"]) merged["inductors/kind"] = env.circuitikz["inductors/kind"];
  return merged;
}

function parseCtikzStyleValue(value) {
  if (!value || value === true) return {};
  if (typeof value === "object") return { ...value };
  return parseOptions(stripOuterBraces(String(value)));
}

function circuitikzTubeRawOption(key, options = {}, env = {}) {
  const names = [`circuitikz/tubes/${key}`, `tubes/${key}`];
  for (const name of names) {
    if (options[name] !== undefined) return options[name];
  }
  for (const name of names) {
    if (env.pictureOptions?.[name] !== undefined) return env.pictureOptions[name];
  }
  for (const name of names) {
    if (env.circuitikz?.[name] !== undefined) return env.circuitikz[name];
  }
  return undefined;
}

function circuitikzTubeNumber(key, options = {}, env = {}, fallback = 0) {
  const raw = circuitikzTubeRawOption(key, options, env);
  if (raw === undefined || raw === null || raw === true || raw === "") return fallback;
  const parsed = evaluateMath(String(raw), env.variables);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function circuitikzTubePartialBorders(options = {}, env = {}) {
  const raw = circuitikzTubeRawOption("partial borders", options, env);
  if (raw === undefined || raw === null || raw === true) return "none";
  const value = String(raw).trim();
  return /^[012]{6}$/.test(value) ? value : "none";
}

function circuitikzTubeFill(options = {}, style = {}, env = {}) {
  if (style.fill && style.fill !== "none") return style.fill;
  const raw = circuitikzTubeRawOption("fill", options, env);
  if (raw === undefined || raw === null || raw === true || raw === "") return "none";
  return normalizeColor(String(raw));
}

function circuitikzTubeKind(options = {}) {
  const shape = normalizeShapeName(options.shape);
  if (options.pentode || shape === "pentode") return "pentode";
  if (options.tetrode || shape === "tetrode") return "tetrode";
  if (options.triode || shape === "triode") return "triode";
  if (options.diodetube || shape === "diodetube") return "diodetube";
  return null;
}

function circuitikzQuadpoleKind(options = {}) {
  const shape = normalizeShapeName(options.shape);
  if (options["transformer core"] || shape === "transformer core") return "transformer core";
  if (options.transformer || shape === "transformer") return "transformer";
  if (options.gyrator || shape === "gyrator") return "gyrator";
  return null;
}

function circuitikzTubeShape(kind) {
  if (kind === "pentode") return "circuitikzPentode";
  if (kind === "tetrode") return "circuitikzTetrode";
  if (kind === "diodetube") return "circuitikzDiodeTube";
  return "circuitikzTriode";
}

function circuitikzBodyLength(kind, segmentLength, env = {}) {
  const scale = circuitikzLengthScale(env);
  const desired = (kind === "resistor" ? 1.12 : kind === "capacitor" ? 0.28 : 0.84) * scale;
  return Math.min(desired, Math.max(0, segmentLength * 0.78));
}

function appendCircuitikzSplitWire(commands, from, to, geometry, bodyLength, pathStyle = {}, styleHints = null, options = {}, env = {}) {
  const half = bodyLength / 2;
  const start = pointAlong(geometry.mid, geometry.u, -half);
  const end = pointAlong(geometry.mid, geometry.u, half);
  const postLead = circuitikzPostLeadEndpoints(end, to, geometry, options, env);
  commands.push({ type: "lineTo", x: start.x, y: start.y });
  if (circuitikzPathHasMarkers(pathStyle)) {
    suppressCircuitikzPathMarkers(styleHints);
    commands.push({ type: "moveTo", x: postLead.to.x, y: postLead.to.y });
    return {
      start,
      end,
      postLead: circuitikzLeadItem(postLead.from, postLead.to, pathStyle)
    };
  }
  commands.push({ type: "moveTo", x: postLead.from.x, y: postLead.from.y });
  commands.push({ type: "lineTo", x: postLead.to.x, y: postLead.to.y });
  return { start, end, postLead: null };
}

function circuitikzPostLeadEndpoints(from, to, geometry, options = {}, env = {}) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length < 1e-9) return { from, to };
  const startShorten = Math.min(circuitikzShortenLength(options["shorten <="] ?? options["shorten <"], env), length);
  const endShorten = Math.min(circuitikzShortenLength(options["shorten >="] ?? options["shorten >"], env), Math.max(0, length - startShorten));
  return {
    from: pointAlong(from, geometry.u, startShorten),
    to: pointAlong(to, geometry.u, -endShorten)
  };
}

function circuitikzShortenLength(value, env = {}) {
  if (value === undefined || value === null || value === true || value === "") return 0;
  const parsed = parseDimension(String(value), env.variables || {});
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function circuitikzPathHasMarkers(pathStyle = {}) {
  return Boolean(pathStyle.markerStart || pathStyle.markerEnd);
}

function suppressCircuitikzPathMarkers(styleHints) {
  if (!styleHints) return;
  styleHints.markerStart = undefined;
  styleHints.markerEnd = undefined;
}

function circuitikzLeadItem(from, to, pathStyle = {}) {
  if (pointsAlmostEqual(from, to)) return null;
  return {
    type: "path",
    subtype: "circuitikz-post-lead",
    style: {
      ...pathStyle,
      fill: "none"
    },
    commands: [
      { type: "moveTo", x: from.x, y: from.y },
      { type: "lineTo", x: to.x, y: to.y }
    ]
  };
}

function circuitikzResistorItem(from, to, geometry, pathStyle = {}, env = {}) {
  const bodyLength = circuitikzBodyLength("resistor", geometry.length, env);
  const amplitude = 0.21 * circuitikzLengthScale(env);
  const start = pointAlong(geometry.mid, geometry.u, -bodyLength / 2);
  const end = pointAlong(geometry.mid, geometry.u, bodyLength / 2);
  const commands = [{ type: "moveTo", x: start.x, y: start.y }];
  for (let index = 1; index <= 7; index += 1) {
    const along = -bodyLength / 2 + (bodyLength * index) / 8;
    const side = index % 2 === 1 ? 1 : -1;
    commands.push({
      type: "lineTo",
      ...roundPoint({
        x: geometry.mid.x + geometry.u.x * along + geometry.n.x * amplitude * side,
        y: geometry.mid.y + geometry.u.y * along + geometry.n.y * amplitude * side
      })
    });
  }
  commands.push({ type: "lineTo", x: end.x, y: end.y });
  return {
    type: "path",
    subtype: "circuitikz-resistor",
    style: circuitikzComponentStyle(pathStyle),
    commands
  };
}

function circuitikzCapacitorItem(from, to, geometry, pathStyle = {}, env = {}) {
  const scale = circuitikzLengthScale(env);
  const plateHalf = 0.3 * scale;
  const gap = circuitikzBodyLength("capacitor", geometry.length, env) / 2;
  const leftCenter = pointAlong(geometry.mid, geometry.u, -gap / 2);
  const rightCenter = pointAlong(geometry.mid, geometry.u, gap / 2);
  const plate = (center) => [
    pointNormal(center, geometry.n, plateHalf),
    pointNormal(center, geometry.n, -plateHalf)
  ];
  const [l1, l2] = plate(leftCenter);
  const [r1, r2] = plate(rightCenter);
  return {
    type: "path",
    subtype: "circuitikz-capacitor",
    style: circuitikzComponentStyle(pathStyle),
    commands: [
      { type: "moveTo", x: l1.x, y: l1.y },
      { type: "lineTo", x: l2.x, y: l2.y },
      { type: "moveTo", x: r1.x, y: r1.y },
      { type: "lineTo", x: r2.x, y: r2.y }
    ]
  };
}

function circuitikzCurrentSourceItems(from, to, geometry, pathStyle = {}, env = {}) {
  const scale = circuitikzLengthScale(env);
  const radius = 0.42 * scale;
  const arrowHalf = 0.28 * scale;
  const arrowStart = pointAlong(geometry.mid, geometry.u, -arrowHalf);
  const arrowEnd = pointAlong(geometry.mid, geometry.u, arrowHalf);
  return [
    {
      type: "path",
      subtype: "circuitikz-isource",
      shape: "circle",
      cx: geometry.mid.x,
      cy: geometry.mid.y,
      r: radius,
      style: circuitikzComponentStyle(pathStyle),
      commands: circleToPath(geometry.mid.x, geometry.mid.y, radius)
    },
    {
      type: "path",
      subtype: "circuitikz-isource-arrow",
      style: circuitikzArrowStyle(pathStyle),
      commands: [
        { type: "moveTo", x: arrowStart.x, y: arrowStart.y },
        { type: "lineTo", x: arrowEnd.x, y: arrowEnd.y }
      ]
    }
  ];
}

function circuitikzVoltageSourceItems(from, to, geometry, spec, pathStyle = {}, env = {}) {
  const scale = circuitikzLengthScale(env);
  const radius = 0.42 * scale;
  const style = circuitikzComponentStyle(pathStyle);
  const items = [
    {
      type: "path",
      subtype: "circuitikz-voltage-source",
      sourceKind: spec.sourceKind,
      shape: "circle",
      cx: geometry.mid.x,
      cy: geometry.mid.y,
      r: radius,
      style,
      commands: circleToPath(geometry.mid.x, geometry.mid.y, radius)
    }
  ];
  if (spec.sourceKind === "sinusoidal") {
    const waveHalf = 0.24 * scale;
    const start = pointAlong(geometry.mid, geometry.n, -waveHalf);
    const c1 = pointAlong(pointAlong(geometry.mid, geometry.n, -waveHalf * 0.5), geometry.u, waveHalf * 0.7);
    const mid = geometry.mid;
    const c2 = pointAlong(pointAlong(geometry.mid, geometry.n, waveHalf * 0.5), geometry.u, -waveHalf * 0.7);
    const end = pointAlong(geometry.mid, geometry.n, waveHalf);
    items.push({
      type: "path",
      subtype: "circuitikz-voltage-source-wave",
      style,
      commands: [
        { type: "moveTo", x: start.x, y: start.y },
        { type: "curveTo", x1: c1.x, y1: c1.y, x2: mid.x, y2: mid.y, x: mid.x, y: mid.y },
        { type: "curveTo", x1: mid.x, y1: mid.y, x2: c2.x, y2: c2.y, x: end.x, y: end.y }
      ]
    });
  } else {
    const lineHalf = 0.24 * scale;
    const start = pointAlong(geometry.mid, geometry.u, -lineHalf);
    const end = pointAlong(geometry.mid, geometry.u, lineHalf);
    items.push({
      type: "path",
      subtype: "circuitikz-voltage-source-line",
      style,
      commands: [
        { type: "moveTo", x: start.x, y: start.y },
        { type: "lineTo", x: end.x, y: end.y }
      ]
    });
  }
  return items;
}

function circuitikzMosfetItems(from, to, geometry, spec, pathStyle = {}, env = {}) {
  const scale = circuitikzLengthScale(env);
  const leadInset = Math.min(0.08 * scale, geometry.length * 0.08);
  const channelOffset = Math.min(0.49 * scale, geometry.length * 0.34);
  const gateOffset = Math.min(0.61 * scale, geometry.length * 0.42);
  const gateEndOffset = Math.min(0.99 * scale, geometry.length * 0.68);
  const channelTop = pointAlong(from, geometry.u, Math.max(leadInset, geometry.length * 0.34));
  const channelBottom = pointAlong(from, geometry.u, Math.min(geometry.length - leadInset, geometry.length * 0.67));
  const channelTopInner = pointNormal(channelTop, geometry.n, channelOffset);
  const channelBottomInner = pointNormal(channelBottom, geometry.n, channelOffset);
  const gateTop = pointNormal(channelTop, geometry.n, gateOffset);
  const gateBottom = pointNormal(channelBottom, geometry.n, gateOffset);
  const gateMid = pointNormal(geometry.mid, geometry.n, gateOffset);
  const gateEnd = pointNormal(geometry.mid, geometry.n, gateEndOffset);
  const sourceLeadEnd = pointAlong(from, geometry.u, leadInset);
  const drainLeadStart = pointAlong(to, geometry.u, -leadInset);
  const stroke = pathStyle.stroke || "black";
  const baseStyle = circuitikzComponentStyle(pathStyle);
  const channelStyle = {
    ...baseStyle,
    lineWidth: roundNumber(Math.max(Number(baseStyle.lineWidth) || 1, (Number(pathStyle.lineWidth) || 1) * 2))
  };
  const bodyCommands = [
    { type: "moveTo", x: from.x, y: from.y },
    { type: "lineTo", x: sourceLeadEnd.x, y: sourceLeadEnd.y },
    { type: "moveTo", x: to.x, y: to.y },
    { type: "lineTo", x: drainLeadStart.x, y: drainLeadStart.y },
    { type: "moveTo", x: sourceLeadEnd.x, y: sourceLeadEnd.y },
    { type: "lineTo", x: channelTop.x, y: channelTop.y },
    { type: "lineTo", x: channelTopInner.x, y: channelTopInner.y },
    { type: "moveTo", x: channelBottomInner.x, y: channelBottomInner.y },
    { type: "lineTo", x: channelBottom.x, y: channelBottom.y },
    { type: "lineTo", x: drainLeadStart.x, y: drainLeadStart.y },
    { type: "moveTo", x: gateMid.x, y: gateMid.y },
    { type: "lineTo", x: gateEnd.x, y: gateEnd.y }
  ];
  const channelCommands = [
    { type: "moveTo", x: channelTopInner.x, y: channelTopInner.y },
    { type: "lineTo", x: channelBottomInner.x, y: channelBottomInner.y },
    { type: "moveTo", x: gateTop.x, y: gateTop.y },
    { type: "lineTo", x: gateBottom.x, y: gateBottom.y }
  ];
  const items = [
    {
      type: "path",
      subtype: "circuitikz-mosfet",
      mosfetKind: spec.mosfetKind,
      style: baseStyle,
      commands: bodyCommands.map(roundPathCommand)
    },
    {
      type: "path",
      subtype: "circuitikz-mosfet-channel",
      mosfetKind: spec.mosfetKind,
      style: channelStyle,
      commands: channelCommands.map(roundPathCommand)
    }
  ];
  if (spec.mosfetKind === "pmos") {
    items.push(circuitikzTerminalItem({ point: gateMid, kind: "filled" }, { ...pathStyle, stroke }, env));
  }
  addCircuitikzTextNode(items, pointNormal(geometry.mid, geometry.n, -0.38 * scale), spec.label);
  return items;
}

function roundPathCommand(command) {
  if (!Number.isFinite(command.x) || !Number.isFinite(command.y)) return command;
  return { ...command, x: roundNumber(command.x), y: roundNumber(command.y) };
}

function registerCircuitikzMosfetNode(spec, from, to, geometry, env) {
  const name = spec.name ? resolveDynamicName(spec.name, env) : "";
  if (!name) return;
  const scale = circuitikzLengthScale(env);
  const gateDistance = Math.min(0.99 * scale, geometry.length * 0.68);
  const rotation = (Math.atan2(geometry.n.y, geometry.n.x) * 180) / Math.PI;
  env.nodes[name] = {
    point: roundPoint(geometry.mid),
    width: roundNumber(gateDistance * 2),
    height: roundNumber(geometry.length),
    layoutWidth: roundNumber(gateDistance * 2),
    layoutHeight: roundNumber(geometry.length),
    shape: "circuitikzMosfet",
    shapeData: {
      mosfetKind: spec.mosfetKind,
      gateDistance
    },
    rotation
  };
  env.coordinates[name] = roundPoint(geometry.mid);
}

function circuitikzComponentStyle(pathStyle = {}) {
  const lineWidth = Number(pathStyle.lineWidth) || 1;
  return {
    stroke: pathStyle.stroke || "black",
    fill: "none",
    lineWidth: roundNumber(lineWidth * 2),
    markerStart: undefined,
    markerEnd: undefined,
    lineJoin: "bevel"
  };
}

function circuitikzOpAmpNodeStyle(style = {}, env = {}) {
  const configuredFill = env.circuitikz?.["amplifiers/fill"];
  const fill = style.fill && style.fill !== "none"
    ? style.fill
    : configuredFill && configuredFill !== true
      ? normalizeColor(configuredFill)
      : "none";
  return {
    stroke: style.stroke && style.stroke !== "none" ? style.stroke : "black",
    fill,
    lineWidth: Math.max(0.8, Number(style.lineWidth) || 1),
    lineJoin: "miter"
  };
}

function circuitikzTransistorNodeStyle(style = {}, env = {}) {
  return {
    stroke: style.stroke && style.stroke !== "none" ? style.stroke : "black",
    fill: "none",
    lineWidth: Math.max(0.8, Number(style.lineWidth) || 1),
    lineCap: "butt",
    lineJoin: "miter"
  };
}

function circuitikzTubeNodeStyle(style = {}, options = {}, env = {}) {
  return {
    stroke: style.stroke && style.stroke !== "none" ? style.stroke : "black",
    fill: circuitikzTubeFill(options, style, env),
    lineWidth: Math.max(0.8, Number(style.lineWidth) || 1),
    lineCap: "butt",
    lineJoin: "round"
  };
}

function circuitikzTransistorTerminalY(kind, terminal, halfHeight) {
  const y = halfHeight;
  if (terminal === "C") return kind === "pnp" ? -y : y;
  if (terminal === "E") return kind === "pnp" ? y : -y;
  return 0;
}

function circuitikzTransistorLocalAnchor(anchorRaw, size = {}) {
  const anchor = String(anchorRaw || "").trim().toUpperCase();
  const halfWidth = (Number(size.width) || 0) / 2;
  const halfHeight = (Number(size.height) || 0) / 2;
  const kind = size.shapeData?.transistorKind || "npn";
  const xSign = size.shapeData?.transistorXScale < 0 ? -1 : 1;
  const scale = halfHeight > 0 ? halfHeight / 0.775 : 1;
  const baseLeadDistance = Math.min(halfWidth, 0.844 * scale);
  if (anchor === "B" || anchor === "BASE") return { x: -xSign * baseLeadDistance, y: 0 };
  if (anchor === "C" || anchor === "COLLECTOR") {
    return { x: 0, y: circuitikzTransistorTerminalY(kind, "C", halfHeight) };
  }
  if (anchor === "E" || anchor === "EMITTER") {
    return { x: 0, y: circuitikzTransistorTerminalY(kind, "E", halfHeight) };
  }
  return null;
}

function circuitikzMosfetLocalAnchor(anchorRaw, size = {}) {
  const anchor = String(anchorRaw || "").trim().toUpperCase();
  const halfWidth = (Number(size.width) || 0) / 2;
  const halfHeight = (Number(size.height) || 0) / 2;
  const gateDistance = Number(size.shapeData?.gateDistance) || halfWidth;
  if (anchor === "G" || anchor === "GATE") return { x: gateDistance, y: 0 };
  if (anchor === "S" || anchor === "SOURCE") return { x: 0, y: halfHeight };
  if (anchor === "D" || anchor === "DRAIN") return { x: 0, y: -halfHeight };
  return null;
}

function circuitikzTriodeLocalAnchor(anchorRaw, size = {}) {
  const anchor = String(anchorRaw || "").trim().toLowerCase().replace(/-/g, " ");
  const halfWidth = (Number(size.width) || 0) / 2;
  const halfHeight = (Number(size.height) || 0) / 2;
  const cathodeX = halfWidth * 0.4;
  const anchors = {
    anode: { x: 0, y: halfHeight },
    plate: { x: 0, y: halfHeight },
    cathode: { x: cathodeX, y: -halfHeight },
    "cathode 1": { x: cathodeX, y: -halfHeight },
    control: { x: -halfWidth, y: 0 },
    grid: { x: -halfWidth, y: 0 },
    east: { x: halfWidth, y: 0 },
    west: { x: -halfWidth, y: 0 },
    north: { x: 0, y: halfHeight },
    south: { x: 0, y: -halfHeight },
    "north east": { x: halfWidth, y: halfHeight },
    "north west": { x: -halfWidth, y: halfHeight },
    "south east": { x: halfWidth, y: -halfHeight },
    "south west": { x: -halfWidth, y: -halfHeight }
  };
  return anchors[anchor] || null;
}

function circuitikzTubeLocalAnchor(anchorRaw, size = {}) {
  const anchor = String(anchorRaw || "").trim().toLowerCase().replace(/-/g, " ");
  const halfWidth = (Number(size.width) || 0) / 2;
  const halfHeight = (Number(size.height) || 0) / 2;
  const gridShift = 0;
  const gridSeparation = 0.2;
  const cathodeX = -halfWidth * 0.4;
  const geo = {
    n: { x: 0, y: halfHeight },
    north: { x: 0, y: halfHeight },
    s: { x: 0, y: -halfHeight },
    south: { x: 0, y: -halfHeight },
    e: { x: halfWidth, y: 0 },
    east: { x: halfWidth, y: 0 },
    w: { x: -halfWidth, y: 0 },
    west: { x: -halfWidth, y: 0 },
    ne: { x: halfWidth, y: halfHeight },
    "north east": { x: halfWidth, y: halfHeight },
    nw: { x: -halfWidth, y: halfHeight },
    "north west": { x: -halfWidth, y: halfHeight },
    se: { x: halfWidth, y: -halfHeight },
    "south east": { x: halfWidth, y: -halfHeight },
    sw: { x: -halfWidth, y: -halfHeight },
    "south west": { x: -halfWidth, y: -halfHeight }
  };
  const component = {
    anode: { x: 0, y: halfHeight },
    plate: { x: 0, y: halfHeight },
    cathode: { x: cathodeX, y: -halfHeight },
    "cathode 1": { x: cathodeX, y: -halfHeight },
    "cathode 2": { x: -cathodeX, y: -halfHeight },
    control: { x: -halfWidth, y: (-gridSeparation + gridShift) * halfHeight },
    grid: { x: -halfWidth, y: (-gridSeparation + gridShift) * halfHeight },
    screen: { x: -halfWidth, y: gridShift * halfHeight },
    suppressor: { x: -halfWidth, y: (gridSeparation + gridShift) * halfHeight },
    "tube top": { x: 0, y: halfHeight * 0.8 },
    "tube bottom": { x: 0, y: -halfHeight * 0.8 },
    "tube right": { x: halfWidth * 0.8, y: 0 },
    "tube left": { x: -halfWidth * 0.8, y: 0 }
  };
  return geo[anchor] || component[anchor] || null;
}

function circuitikzQuadpoleLocalAnchor(anchorRaw, size = {}) {
  const anchor = String(anchorRaw || "").trim().toLowerCase().replace(/-/g, " ");
  const halfWidth = (Number(size.width) || 0) / 2;
  const halfHeight = (Number(size.height) || 0) / 2;
  const terminalY = halfHeight * 0.56;
  const innerX = halfWidth * circuitikzQuadpoleInnerRatio(size);
  const outerX = halfWidth * 0.72;
  const dotY = halfHeight * 0.42;
  const anchors = {
    a1: { x: -halfWidth, y: terminalY },
    a2: { x: -halfWidth, y: -terminalY },
    b1: { x: halfWidth, y: terminalY },
    b2: { x: halfWidth, y: -terminalY },
    base: { x: 0, y: 0 },
    "inner dot a1": { x: -innerX, y: dotY },
    "inner dot a2": { x: -innerX, y: -dotY },
    "inner dot b1": { x: innerX, y: dotY },
    "inner dot b2": { x: innerX, y: -dotY },
    "outer dot a1": { x: -outerX, y: dotY },
    "outer dot a2": { x: -outerX, y: -dotY },
    "outer dot b1": { x: outerX, y: dotY },
    "outer dot b2": { x: outerX, y: -dotY },
    north: { x: 0, y: halfHeight },
    south: { x: 0, y: -halfHeight },
    east: { x: halfWidth, y: 0 },
    west: { x: -halfWidth, y: 0 },
    "north east": { x: halfWidth, y: halfHeight },
    "north west": { x: -halfWidth, y: halfHeight },
    "south east": { x: halfWidth, y: -halfHeight },
    "south west": { x: -halfWidth, y: -halfHeight }
  };
  return anchors[anchor] || null;
}

function circuitikzQuadpoleInnerRatio(size = {}) {
  const raw = Number(size.shapeData?.quadpoleSettings?.inner);
  return Number.isFinite(raw) ? Math.max(0.12, Math.min(1.1, raw)) : 0.4;
}

function circuitikzTransformerCoilLocalAnchor(coilRaw, anchorRaw, size = {}) {
  const coil = String(coilRaw || "").trim().toUpperCase();
  const anchor = String(anchorRaw || "").trim().toLowerCase();
  if (!["L1", "L2"].includes(coil) || !["a", "b"].includes(anchor)) return null;
  const halfWidth = (Number(size.width) || 0) / 2;
  const coilX = halfWidth * circuitikzQuadpoleInnerRatio(size) * (coil === "L1" ? -1 : 1);
  const topAnchor = coil === "L1" ? "b" : "a";
  const y = anchor === topAnchor ? circuitikzTransformerCoilHalfSpan(size, coil) : -circuitikzTransformerCoilHalfSpan(size, coil);
  return { x: coilX, y };
}

function circuitikzTransformerCoilHalfSpan(size = {}, coil = "L1") {
  const halfHeight = (Number(size.height) || 0) / 2;
  const terminalY = halfHeight * 0.56;
  const spec = size.shapeData?.quadpoleSettings?.coils?.[coil] || {};
  const rawWidth = Number(spec["inductors/width"] ?? spec.width ?? 0.8);
  const ratio = Number.isFinite(rawWidth) ? Math.max(0.14, Math.min(0.7, rawWidth * 0.68)) : 0.54;
  return terminalY * ratio;
}

function circuitikzTransistorTextPoint(point, size = {}, shapeData = {}) {
  const xSign = shapeData.transistorXScale < 0 ? -1 : 1;
  return roundPoint({ x: point.x + xSign * 0.18, y: point.y - 0.08 });
}

function materializeCircuitikzNodeAnchors(name, env) {
  const node = env.nodes?.[name];
  if (!node) return;
  const anchorsByShape = {
    circuitikzTriode: ["anode", "plate", "cathode", "control", "grid", "east", "west", "north west", "south east"],
    circuitikzPentode: ["anode", "cathode", "control", "screen", "suppressor", "n", "e", "s", "w", "ne", "se", "sw", "nw"],
    circuitikzTetrode: ["anode", "cathode", "control", "screen", "n", "e", "s", "w", "ne", "se", "sw", "nw"],
    circuitikzDiodeTube: ["anode", "cathode", "n", "e", "s", "w", "ne", "se", "sw", "nw"],
    circuitikzQuadpole: [
      "A1",
      "A2",
      "B1",
      "B2",
      "base",
      "inner dot A1",
      "inner dot A2",
      "inner dot B1",
      "inner dot B2",
      "outer dot A1",
      "outer dot A2",
      "outer dot B1",
      "outer dot B2"
    ]
  };
  const anchors = anchorsByShape[node.shape] || [];
  for (const anchor of anchors) {
    env.coordinates[`${name}.${anchor}`] = nodeAnchorCoordinate(node, anchor);
  }
  materializeCircuitikzTransformerCoilAnchors(name, node, env);
}

function materializeCircuitikzTransformerCoilAnchors(name, node, env) {
  if (node.shape !== "circuitikzQuadpole") return;
  const kind = String(node.shapeData?.quadpoleKind || "").trim().toLowerCase();
  if (!kind.startsWith("transformer")) return;
  const rotation = Number(node.rotation) || 0;
  const size = { width: node.width, height: node.height, shapeData: node.shapeData };
  for (const coil of ["L1", "L2"]) {
    const centerLocal = { x: (node.width / 2) * circuitikzQuadpoleInnerRatio(size) * (coil === "L1" ? -1 : 1), y: 0 };
    const centerRotated = rotateVector(centerLocal.x, centerLocal.y, rotation);
    const center = roundPoint({ x: node.point.x + centerRotated.x, y: node.point.y + centerRotated.y });
    env.coordinates[`${name}-${coil}`] = center;
    env.nodes[`${name}-${coil}`] = {
      point: center,
      width: Math.max(0.001, node.width * 0.12),
      height: Math.max(0.001, node.height * 0.76),
      shape: "rectangle",
      shapeData: {}
    };
    for (const anchor of ["a", "b"]) {
      const local = circuitikzTransformerCoilLocalAnchor(coil, anchor, size);
      if (!local) continue;
      const rotated = rotateVector(local.x, local.y, rotation);
      env.coordinates[`${name}-${coil}.${anchor}`] = roundPoint({ x: node.point.x + rotated.x, y: node.point.y + rotated.y });
    }
  }
}

function circuitikzArrowStyle(pathStyle = {}) {
  const stroke = pathStyle.stroke || "black";
  return {
    stroke,
    fill: "none",
    lineWidth: roundNumber((Number(pathStyle.lineWidth) || 1) * 2),
    markerEnd: createArrowTip("latex", { fill: stroke, stroke })
  };
}

function circuitikzTerminals(options, from, to) {
  const terminals = [];
  for (const key of Object.keys(options || {})) {
    const match = String(key).trim().match(/^([*oOdD])?-(?:([*oOdD]))?$/);
    if (!match) continue;
    if (match[1]) terminals.push({ point: roundPoint(from), kind: circuitikzTerminalKind(match[1]) });
    if (match[2]) terminals.push({ point: roundPoint(to), kind: circuitikzTerminalKind(match[2]) });
  }
  return terminals;
}

function circuitikzTerminalKind(raw) {
  if (raw === "o") return "open";
  if (raw === "d") return "diamond";
  if (raw === "D") return "openDiamond";
  return "filled";
}

function circuitikzTerminalItem(terminal, pathStyle = {}, env = {}) {
  const stroke = pathStyle.stroke || "black";
  const open = terminal.kind === "open";
  const point = terminal.point;
  if (terminal.kind === "diamond" || terminal.kind === "openDiamond") {
    const half = 0.08 * circuitikzLengthScale(env);
    const commands = [
      { type: "moveTo", x: point.x, y: roundNumber(point.y + half) },
      { type: "lineTo", x: roundNumber(point.x - half), y: point.y },
      { type: "lineTo", x: point.x, y: roundNumber(point.y - half) },
      { type: "lineTo", x: roundNumber(point.x + half), y: point.y },
      { type: "closePath" }
    ];
    return {
      type: "path",
      subtype: terminal.kind === "openDiamond" ? "circuitikz-terminal-open-diamond" : "circuitikz-terminal-diamond",
      shape: "diamond",
      cx: point.x,
      cy: point.y,
      r: half,
      style: {
        stroke,
        fill: terminal.kind === "openDiamond" ? "white" : stroke,
        lineWidth: Number(pathStyle.lineWidth) || 1,
        markerStart: undefined,
        markerEnd: undefined
      },
      commands
    };
  }
  const radius = (open ? 0.07 : 0.056) * circuitikzLengthScale(env);
  return {
    type: "path",
    subtype: open ? "circuitikz-terminal-open" : "circuitikz-terminal-dot",
    shape: "circle",
    cx: point.x,
    cy: point.y,
    r: radius,
    style: {
      stroke,
      fill: open ? "white" : stroke,
      lineWidth: Number(pathStyle.lineWidth) || 1,
      markerStart: undefined,
      markerEnd: undefined
    },
    commands: circleToPath(point.x, point.y, radius)
  };
}

function circuitikzGroundItem(point, style = {}, env = {}) {
  const scale = circuitikzLengthScale(env);
  const stroke = style.stroke && style.stroke !== "none" ? style.stroke : "black";
  const top = point;
  const stem = pointAlong(top, { x: 0, y: -1 }, 0.12 * scale);
  const y1 = stem.y;
  const y2 = stem.y - 0.09 * scale;
  const y3 = stem.y - 0.17 * scale;
  const w1 = 0.32 * scale;
  const w2 = 0.22 * scale;
  const w3 = 0.12 * scale;
  return {
    type: "path",
    subtype: "circuitikz-ground",
    style: {
      stroke,
      fill: "none",
      lineWidth: Math.max(0.8, Number(style.lineWidth) || 1),
      lineCap: "butt"
    },
    commands: [
      { type: "moveTo", x: top.x, y: top.y },
      { type: "lineTo", x: stem.x, y: stem.y },
      { type: "moveTo", x: top.x - w1 / 2, y: y1 },
      { type: "lineTo", x: top.x + w1 / 2, y: y1 },
      { type: "moveTo", x: top.x - w2 / 2, y: y2 },
      { type: "lineTo", x: top.x + w2 / 2, y: y2 },
      { type: "moveTo", x: top.x - w3 / 2, y: y3 },
      { type: "lineTo", x: top.x + w3 / 2, y: y3 }
    ]
  };
}

function appendCircuitikzComponentLabel(nodes, spec, from, to, geometry, env = {}) {
  if (spec.kind === "voltageSource" && circuitikzVoltageSpec({}, spec, env)) return;
  const label = circuitikzTextLabel(spec.label, env);
  if (!label) return;
  const scale = circuitikzLengthScale(env);
  const offset = (spec.kind === "isource" ? 0.7 : 0.46) * scale;
  addCircuitikzTextNode(nodes, pointNormal(geometry.mid, geometry.n, offset), label);
}

function appendCircuitikzCurrentLabel(nodes, shapes, spec, from, to, geometry, options = {}, pathStyle = {}, env = {}) {
  const current = circuitikzCurrentSpec(options, env);
  if (!current) return;
  const scale = circuitikzLengthScale(env);
  const bodyLength = spec.kind === "short" ? 0 : circuitikzBodyLength(spec.kind, geometry.length, env);
  const leadLength = Math.max(0, (geometry.length - bodyLength) / 2);
  let center = geometry.mid;
  if (spec.kind !== "short" && leadLength > 0.02) {
    const before = current.key.includes(">_") || current.key.includes(">^") || current.key.includes("^>") || current.key.includes("_>");
    if (before) {
      center = pointAlong(from, geometry.u, Math.min(leadLength * 0.65, leadLength - 0.08 * scale));
    } else if (current.key === "i") {
      center = pointAlong(geometry.mid, geometry.u, bodyLength / 2 + Math.min(leadLength * 0.42, 0.18 * scale));
    } else {
      center = pointAlong(geometry.mid, geometry.u, 0);
    }
  }
  const arrowHalf = 0.18 * scale;
  shapes.push(circuitikzCurrentTriangleItem(pointAlong(center, geometry.u, arrowHalf * 0.25), geometry, pathStyle, env));
  const side = current.key.includes("_") ? -1 : 1;
  const labelCenter = current.key === "i" && spec.kind !== "short" ? pointAlong(center, geometry.u, 0.2 * scale) : center;
  addCircuitikzTextNode(nodes, pointNormal(labelCenter, geometry.n, side * 0.34 * scale), current.label);
}

function appendCircuitikzFlowLabel(nodes, shapes, spec, from, to, geometry, options = {}, pathStyle = {}, env = {}) {
  const flow = circuitikzFlowSpec(options, env);
  if (!flow) return;
  const scale = circuitikzLengthScale(env);
  const bodyLength = spec.kind === "short" ? 0 : circuitikzBodyLength(spec.kind, geometry.length, env);
  const leadLength = Math.max(0, (geometry.length - bodyLength) / 2);
  const segmentStart = spec.kind !== "short" && flow.before
    ? from
    : spec.kind !== "short"
      ? pointAlong(geometry.mid, geometry.u, bodyLength / 2)
      : from;
  const segmentLength = spec.kind === "short" ? geometry.length : leadLength;
  const baseCenter = pointAlong(segmentStart, geometry.u, Math.max(0, segmentLength) * 0.5);
  const offset = 0.2 * scale;
  const arrowCenter = pointNormal(baseCenter, geometry.n, flow.side * offset);
  shapes.push(circuitikzFlowArrowItem(arrowCenter, geometry, flow, pathStyle, env));
  addCircuitikzTextNode(nodes, pointNormal(baseCenter, geometry.n, flow.side * (offset + 0.22 * scale)), flow.label);
}

function circuitikzCurrentTriangleItem(center, geometry, pathStyle = {}, env = {}) {
  const scale = circuitikzLengthScale(env);
  const stroke = pathStyle.stroke || "black";
  const length = 0.15 * scale;
  const width = 0.14 * scale;
  const tip = pointAlong(center, geometry.u, length / 2);
  const base = pointAlong(center, geometry.u, -length / 2);
  const left = pointNormal(base, geometry.n, width / 2);
  const right = pointNormal(base, geometry.n, -width / 2);
  return {
    type: "path",
    subtype: "circuitikz-current-arrow",
    style: {
      stroke,
      fill: stroke,
      lineWidth: Number(pathStyle.lineWidth) || 1,
      lineJoin: "miter"
    },
    commands: [
      { type: "moveTo", x: left.x, y: left.y },
      { type: "lineTo", x: tip.x, y: tip.y },
      { type: "lineTo", x: right.x, y: right.y },
      { type: "closePath" }
    ]
  };
}

function circuitikzFlowArrowItem(center, geometry, flow, pathStyle = {}, env = {}) {
  const direction = flow.backward ? { x: -geometry.u.x, y: -geometry.u.y } : geometry.u;
  const orientedGeometry = { ...geometry, u: direction, n: { x: -direction.y, y: direction.x } };
  return {
    ...circuitikzCurrentTriangleItem(center, orientedGeometry, pathStyle, env),
    subtype: "circuitikz-flow-arrow"
  };
}

function circuitikzCurrentSpec(options = {}, env = {}) {
  for (const [key, value] of Object.entries(options)) {
    if (!/^i(?:[<>_^]*)?$/.test(key)) continue;
    const label = circuitikzTextLabel(value, env);
    if (label) return { key, label };
  }
  return null;
}

function circuitikzFlowSpec(options = {}, env = {}) {
  for (const [key, value] of Object.entries(options)) {
    if (!/^f(?:[<>_^]*)?$/.test(key)) continue;
    const label = circuitikzTextLabel(value, env);
    if (!label) continue;
    return {
      key,
      label,
      backward: key.includes("<"),
      before: /[<>][_^]/.test(key),
      side: key.includes("_") ? -1 : 1
    };
  }
  return null;
}

function appendCircuitikzVoltageLabel(nodes, shapes, spec, from, to, geometry, options = {}, pathStyle = {}, env = {}) {
  const voltage = circuitikzVoltageSpec(options, spec, env);
  if (!voltage) return;
  const { label } = voltage;
  const scale = circuitikzLengthScale(env);
  const normal = circuitikzVoltageNormal(geometry);
  if (circuitikzUsesRPVoltages(env)) {
    shapes.push(circuitikzRpVoltageArrowItem(spec, geometry, voltage, normal, pathStyle, env));
    const labelOffset = (spec.kind === "voltageSource" ? 0.78 : 0.78) * scale;
    addCircuitikzTextNode(nodes, pointNormal(geometry.mid, normal, labelOffset), label);
    return;
  }
  const signOffset = (spec.kind === "isource" ? 0.28 : 0.38) * scale;
  const labelOffset = (spec.kind === "isource" ? 0.72 : 0.62) * scale;
  const along = 0.55 * scale;
  addCircuitikzTextNode(nodes, pointNormal(pointAlong(geometry.mid, geometry.u, along), normal, signOffset), "+", { "inner sep": "0pt" });
  addCircuitikzTextNode(nodes, pointNormal(pointAlong(geometry.mid, geometry.u, -along), normal, signOffset), "-", { "inner sep": "0pt" });
  addCircuitikzTextNode(nodes, pointNormal(geometry.mid, normal, labelOffset), label);
}

function circuitikzVoltageSpec(options = {}, spec = {}, env = {}) {
  for (const [key, value] of Object.entries(options || {})) {
    if (!/^v(?:[<>_^]*)?$/.test(key)) continue;
    const label = circuitikzTextLabel(value, env);
    if (label) return { key, label };
  }
  if (spec.kind === "voltageSource" && spec.label) {
    const label = circuitikzTextLabel(spec.label, env);
    if (label) return { key: spec.voltageKey || "V", label };
  }
  return null;
}

function circuitikzUsesRPVoltages(env = {}) {
  const settings = env.circuitikz || {};
  return Boolean(settings.RPvoltages || /^RPvoltages$/i.test(String(settings.voltageMode || settings.voltage || "")));
}

function circuitikzVoltageNormal(geometry) {
  let normal = { x: -geometry.n.x, y: -geometry.n.y };
  if (Math.abs(normal.y) >= Math.abs(normal.x) && normal.y > 0) {
    normal = { x: -normal.x, y: -normal.y };
  }
  return normal;
}

function circuitikzRpVoltageArrowItem(spec, geometry, voltage, normal, pathStyle = {}, env = {}) {
  const scale = circuitikzLengthScale(env);
  const direction = voltage.key.includes(">") ? geometry.u : { x: -geometry.u.x, y: -geometry.u.y };
  const offset = (spec.kind === "voltageSource" ? 0.56 : 0.42) * scale;
  const center = pointNormal(geometry.mid, normal, offset);
  const half = (spec.kind === "voltageSource" ? 0.32 : 0.74) * scale;
  const start = pointAlong(center, direction, -half);
  const end = pointAlong(center, direction, half);
  const commands = spec.kind === "voltageSource"
    ? [
        { type: "moveTo", x: start.x, y: start.y },
        { type: "lineTo", x: end.x, y: end.y }
      ]
    : circuitikzCurvedVoltageArrowCommands(start, end, normal, scale);
  const stroke = pathStyle.stroke || "black";
  return {
    type: "path",
    subtype: "circuitikz-voltage-arrow",
    style: {
      stroke,
      fill: "none",
      lineWidth: Math.max(0.8, Number(pathStyle.lineWidth) || 1),
      lineCap: "butt",
      lineJoin: "miter",
      markerEnd: createArrowTip("latex", { fill: stroke, stroke })
    },
    commands
  };
}

function circuitikzCurvedVoltageArrowCommands(start, end, normal, scale) {
  const sag = 0.26 * scale;
  const c1 = pointNormal(start, normal, sag);
  const c2 = pointNormal(end, normal, sag);
  return [
    { type: "moveTo", x: start.x, y: start.y },
    { type: "curveTo", x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y, x: end.x, y: end.y }
  ];
}

function addCircuitikzTextNode(nodes, point, text, options = {}) {
  nodes.push({
    at: point,
    displayPoint: point,
    text,
    options: {
      "inner sep": "1pt",
      ...options
    }
  });
}

function pointAlong(point, direction, distance) {
  return roundPoint({
    x: point.x + direction.x * distance,
    y: point.y + direction.y * distance
  });
}

function pointNormal(point, normal, distance) {
  return roundPoint({
    x: point.x + normal.x * distance,
    y: point.y + normal.y * distance
  });
}

function parseTikzExtArcThrough(options = {}) {
  const value = options["ext/arc through"] ?? options["arc through"];
  if (value === undefined || value === null || value === false) return null;
  const text = stripOuterBraces(value === true ? "" : String(value)).trim();
  const parts = splitTopLevel(text);
  let through = "";
  let clockwise = false;
  let suffix = "";
  for (const part of parts.length ? parts : [text]) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (/^clockwise$/i.test(trimmed)) {
      clockwise = true;
      continue;
    }
    if (/^counter clockwise$/i.test(trimmed)) {
      clockwise = false;
      continue;
    }
    const suffixMatch = trimmed.match(/^center suffix\s*=\s*(.+)$/);
    if (suffixMatch) {
      suffix = suffixMatch[1].trim();
      continue;
    }
    const throughMatch = trimmed.match(/^through\s*=\s*(.+)$/);
    through = throughMatch ? throughMatch[1].trim() : trimmed;
  }
  return { through: through || "(0,0)", clockwise, suffix };
}

function tikzExtArcToCommands(from, to, options = {}, env) {
  const chord = Math.hypot(to.x - from.x, to.y - from.y);
  if (chord < 1e-9) return { commands: [], center: from };
  let radius = parseDimension(options.radius ?? options["x radius"] ?? options["y radius"] ?? "1cm", env.variables);
  if (!Number.isFinite(radius) || radius <= 0) radius = 1;
  radius = Math.max(radius, chord / 2 + 1e-6);
  const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const h = Math.sqrt(Math.max(0, radius * radius - (chord * chord) / 4));
  const nx = -(to.y - from.y) / chord;
  const ny = (to.x - from.x) / chord;
  const clockwise = tikzBoolean(options.clockwise);
  const large = tikzBoolean(options.large);
  const sign = clockwise === large ? -1 : 1;
  const center = { x: midpoint.x + nx * h * sign, y: midpoint.y + ny * h * sign };
  return { commands: arcSampleCommands(center, from, to, clockwise, large), center: roundPoint(center) };
}

function tikzExtArcThroughCommands(from, through, to, options = {}, env) {
  const center = circleCenterThroughPoints(from, through, to);
  if (!center) return { commands: [{ type: "lineTo", x: to.x, y: to.y }], center: null };
  const clockwise = options.clockwise;
  return { commands: arcSampleCommands(center, from, to, clockwise, false, through), center: roundPoint(center) };
}

function circleCenterThroughPoints(a, b, c) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-9) return null;
  const ax = a.x * a.x + a.y * a.y;
  const bx = b.x * b.x + b.y * b.y;
  const cx = c.x * c.x + c.y * c.y;
  return {
    x: (ax * (b.y - c.y) + bx * (c.y - a.y) + cx * (a.y - b.y)) / d,
    y: (ax * (c.x - b.x) + bx * (a.x - c.x) + cx * (b.x - a.x)) / d
  };
}

function arcSampleCommands(center, from, to, clockwise = false, large = false, through = null) {
  const start = Math.atan2(from.y - center.y, from.x - center.x);
  let end = Math.atan2(to.y - center.y, to.x - center.x);
  if (through) {
    const throughAngle = Math.atan2(through.y - center.y, through.x - center.x);
    const ccwContains = angleBetweenCcw(throughAngle, start, end);
    clockwise = !ccwContains;
  }
  let delta = end - start;
  if (clockwise && delta > 0) delta -= Math.PI * 2;
  if (!clockwise && delta < 0) delta += Math.PI * 2;
  if (large && Math.abs(delta) < Math.PI) delta += (clockwise ? -1 : 1) * Math.PI * 2;
  if (!large && Math.abs(delta) > Math.PI) delta -= (clockwise ? -1 : 1) * Math.PI * 2;
  const radius = Math.hypot(from.x - center.x, from.y - center.y);
  const steps = Math.max(8, Math.ceil(Math.abs(delta) / (Math.PI / 16)));
  const commands = [];
  for (let index = 1; index <= steps; index += 1) {
    const angle = start + (delta * index) / steps;
    commands.push({
      type: "lineTo",
      x: roundNumber(center.x + Math.cos(angle) * radius),
      y: roundNumber(center.y + Math.sin(angle) * radius)
    });
  }
  if (commands.length) commands[commands.length - 1] = { type: "lineTo", x: to.x, y: to.y };
  return commands;
}

function angleBetweenCcw(angle, start, end) {
  const tau = Math.PI * 2;
  const normalize = (value) => ((value % tau) + tau) % tau;
  const a = normalize(angle - start);
  const b = normalize(end - start);
  return a <= b;
}

function resolveLocalCoordinate(raw, env, diagnostics) {
  return resolveCoordinate(raw, { ...env, transform: identityTransform() }, diagnostics);
}

function shouldResolveAsLocalRectangleCorner(raw) {
  let text = String(raw || "").trim();
  if (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1).trim();
  if (text.startsWith("[")) return false;
  return text.startsWith("$") || looksLikeExplicitCoordinate(text);
}

function transformedRectangleCorners(fromLocal, toLocal, transform) {
  return [
    applyTransform({ x: toLocal.x, y: fromLocal.y }, transform),
    applyTransform({ x: toLocal.x, y: toLocal.y }, transform),
    applyTransform({ x: fromLocal.x, y: toLocal.y }, transform)
  ];
}

function decoratedShape(shape, pathOptions, env) {
  if (!pathOptions.decorate || !shape.commands?.length) return shape;
  return {
    ...shape,
    shape: "decoratedPath",
    commands: applyPathMorphing(shape.commands, pathOptions, env)
  };
}

function circleCommands(center, r, env) {
  return usesProjectedLocalGeometry(env) ? projectLocalPathCommands(circleToPath(0, 0, r), center, env) : circleToPath(center.x, center.y, r);
}

function ellipseCommands(center, rx, ry, env) {
  return usesProjectedLocalGeometry(env)
    ? projectLocalPathCommands(ellipseToPath(0, 0, rx, ry), center, env)
    : ellipseToPath(center.x, center.y, rx, ry);
}

function projectLocalPathCommands(commands, center, env) {
  return commands.map((command) => {
    if (command.type === "closePath") return command;
    if (command.type === "curveTo") {
      const p1 = projectLocalOffset(command.x1, command.y1, env);
      const p2 = projectLocalOffset(command.x2, command.y2, env);
      const p = projectLocalOffset(command.x, command.y, env);
      return {
        ...command,
        x1: roundNumber(center.x + p1.x),
        y1: roundNumber(center.y + p1.y),
        x2: roundNumber(center.x + p2.x),
        y2: roundNumber(center.y + p2.y),
        x: roundNumber(center.x + p.x),
        y: roundNumber(center.y + p.y)
      };
    }
    if ("x" in command && "y" in command) {
      const p = projectLocalOffset(command.x, command.y, env);
      return { ...command, x: roundNumber(center.x + p.x), y: roundNumber(center.y + p.y) };
    }
    return command;
  });
}

function projectLocalOffset(x, y, env) {
  const projected = projectBasisPoint(x, y, 0, env.basis);
  const transform = normalizeTransform(env.transform);
  return roundPoint({
    x: projected.x * transform.a + projected.y * transform.c,
    y: projected.x * transform.b + projected.y * transform.d
  });
}

function usesCustomBasis(basis = parsePictureBasis()) {
  return (
    Math.abs((basis.x?.x ?? 1) - 1) > 1e-9 ||
    Math.abs(basis.x?.y ?? 0) > 1e-9 ||
    Math.abs(basis.y?.x ?? 0) > 1e-9 ||
    Math.abs((basis.y?.y ?? 1) - 1) > 1e-9 ||
    Math.abs(basis.z?.x ?? 0) > 1e-9 ||
    Math.abs(basis.z?.y ?? 0) > 1e-9
  );
}

function usesProjectedLocalGeometry(env = {}) {
  if (usesCustomBasis(env.basis)) return true;
  const transform = normalizeTransform(env.transform);
  return (
    Math.abs(transform.a - 1) > 1e-9 ||
    Math.abs(transform.b) > 1e-9 ||
    Math.abs(transform.c) > 1e-9 ||
    Math.abs(transform.d - 1) > 1e-9
  );
}

function flushInlinePathNodes(pendingInlineNodes, from, to, nodes, env, pathStyle = {}) {
  if (!pendingInlineNodes.length || !from || !to) return;
  const pathSegment = { from, to };
  for (const segment of pendingInlineNodes) {
    const point = inlineNodePathPoint(segment.options, pathSegment) || roundPoint({
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2
    });
    addInlinePathNode(segment, segment.text, point, nodes, env, pathStyle, pathSegment);
  }
}

function flushInlinePathNodesAt(pendingInlineNodes, point, nodes, env, pathStyle = {}, pathSegment = null) {
  if (!pendingInlineNodes.length || !point) return;
  for (const segment of pendingInlineNodes) {
    addInlinePathNode(segment, segment.text, point, nodes, env, pathStyle, pathSegment);
  }
}

function addInlinePathNode(segment, text, point, nodes, env, pathStyle = {}, pathSegment = null) {
  text = resolveTextContent(text, env);
  const rawOptions = resolveDynamicOptions(segment.options || {}, env);
  const normalizedOptions = normalizeOptions("node", {
    ...inlineNodeInheritedOptions(env, rawOptions),
    ...inlineNodeOptions(rawOptions, pathStyle)
  }, env);
  const expandedOptions = applyInlineBareFillCurrentColor(normalizedOptions.options, normalizedOptions.semantic, pathStyle);
  const nodeEnv = nodeCanvasEnv(env, expandedOptions);
  if (inlinePathLabelNeedsTexMetrics(text, rawOptions, expandedOptions)) {
    expandedOptions["tikzkit inline math label metrics"] = true;
  }
  const size = estimateNodeLayoutSize(text, expandedOptions, nodeEnv);
  const anchorSize = estimateNodeAnchorSize(text, expandedOptions, nodeEnv, size);
  const positioningSize = estimatePositioningSelfSize(text, expandedOptions, nodeEnv, anchorSize);
  const scaledSize = scaleSize(size, nodeEnv.canvasScale);
  const scaledAnchorSize = scaleSize(anchorSize, nodeEnv.canvasScale);
  const scaledPositioningSize = scaleSize(positioningSize, nodeEnv.canvasScale);
  const slopedRotation = slopedInlineNodeRotation(expandedOptions, pathSegment, nodeEnv);
  const recordRotation = slopedRotation ?? nodeRotation(expandedOptions, nodeEnv);
  const positioningPoint = resolvePositioning(expandedOptions, nodeEnv, scaledPositioningSize);
  const basePoint = positioningPoint || point;
  const anchoredPoint = expandedOptions.anchor
    ? resolveNodeAnchorPoint(basePoint, expandedOptions, text, nodeEnv, scaledSize)
    : null;
  const displayPoint =
    anchoredPoint ||
    positioningPoint ||
    (slopedRotation === null
      ? resolveAutoInlineNodePoint(basePoint, expandedOptions, scaledSize, nodeEnv, pathSegment)
      : resolveSlopedInlineNodePoint(basePoint, expandedOptions, scaledSize, nodeEnv, slopedRotation));
  const nodePoint = displayPoint || resolveNodeAnchorPoint(basePoint, expandedOptions, text, nodeEnv, scaledSize);
  let nodeName = null;
  if (segment.name) {
    nodeName = resolveDynamicName(segment.name, env);
    env.nodes[nodeName] = {
      point: nodePoint,
      width: scaledSize.width,
      height: scaledSize.height,
      layoutWidth: scaledAnchorSize.width,
      layoutHeight: scaledAnchorSize.height,
      shape: nodeShape(expandedOptions),
      shapeData: nodeShapeData(expandedOptions, nodeEnv),
      rotation: recordRotation
    };
    env.coordinates[nodeName] = nodePoint;
    materializeCircuitikzNodeAnchors(nodeName, env);
  }
  nodes.push({
    at: point,
    displayPoint: nodePoint,
    text,
    options: expandedOptions,
    name: nodeName,
    size: scaledSize,
    anchorSize: scaledAnchorSize,
    canvasScale: nodeEnv.canvasScale,
    rotation: slopedRotation ?? undefined,
    fitTextToBox: shouldFitTextToNodeBox(expandedOptions)
  });
}

function inlinePathLabelNeedsTexMetrics(text, rawOptions = {}, expandedOptions = {}) {
  if (!/\$[^$]+\$/.test(String(text || ""))) return false;
  if (!Object.hasOwn(rawOptions, "fill")) return false;
  const fill = expandedOptions.fill ?? rawOptions.fill;
  if (fill === undefined || fill === null || fill === false) return false;
  return !/^(none|transparent)$/i.test(String(fill).trim());
}

function resolveAutoInlineNodePoint(point, options = {}, size, env, pathSegment = null) {
  if (!pathSegment?.from || !pathSegment?.to || !isTruthyTikzOption(options.auto) || nodeDirection(options) || options.anchor) return null;
  const dx = pathSegment.to.x - pathSegment.from.x;
  const dy = pathSegment.to.y - pathSegment.from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return null;
  const side = String(options.auto === true ? "left" : options.auto || "left").trim().toLowerCase();
  const normalSign = side === "right" || options.swap ? -1 : 1;
  const nx = (-dy / length) * normalSign;
  const ny = (dx / length) * normalSign;
  const halfProjectedExtent = Math.abs(nx) * (size.width / 2) + Math.abs(ny) * (size.height / 2);
  const explicitShift = nodeExplicitShift(options, env);
  return roundPoint({
    x: point.x + nx * halfProjectedExtent + explicitShift.x,
    y: point.y + ny * halfProjectedExtent + explicitShift.y
  });
}

function slopedInlineNodeRotation(options = {}, pathSegment = null, env) {
  if (!isTruthyTikzOption(options.sloped) || !pathSegment?.from || !pathSegment?.to) return null;
  const dx = pathSegment.to.x - pathSegment.from.x;
  const dy = pathSegment.to.y - pathSegment.from.y;
  if (Math.hypot(dx, dy) < 1e-9) return null;
  const base = (Math.atan2(dy, dx) * 180) / Math.PI;
  const upright = isTruthyTikzOption(options["allow upside down"]) ? base : keepTextAngleUpright(base);
  return roundNumber(upright + nodeRotation(options, env));
}

function keepTextAngleUpright(angle) {
  let normalized = ((angle % 360) + 360) % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized > 90) normalized -= 180;
  if (normalized < -90) normalized += 180;
  return normalized;
}

function resolveSlopedInlineNodePoint(point, options = {}, size, env, rotation) {
  const direction = nodeDirection(options);
  const explicitShift = nodeExplicitShift(options, env);
  if (!direction) {
    return roundPoint({
      x: point.x + explicitShift.x,
      y: point.y + explicitShift.y
    });
  }
  const sep = parseNodeLengthDimension(options["inner sep"] ?? options["outer sep"] ?? "0.08cm", env);
  const distance =
    (options[direction] === true ? 0 : nodeDirectionDistance(options[direction], sep, env)) *
    nodeDirectionSingleDistanceScale(direction, options[direction]);
  const local = {
    x: direction.includes("right") ? distance + size.width / 2 : direction.includes("left") ? -(distance + size.width / 2) : 0,
    y: direction.includes("above") ? distance + size.height / 2 : direction.includes("below") ? -(distance + size.height / 2) : 0
  };
  const rotated = rotateVector(local.x, local.y, rotation);
  return roundPoint({
    x: point.x + rotated.x + explicitShift.x,
    y: point.y + rotated.y + explicitShift.y
  });
}

function isTruthyTikzOption(value) {
  if (value === undefined || value === null || value === false) return false;
  if (value === true || value === "") return true;
  return !/^(false|0|no)$/i.test(String(value).trim());
}

function inlineNodeOptions(options = {}, pathStyle = {}) {
  if (hasExplicitTextColor(options)) return options;
  const inheritedText = inheritedInlinePathTextColor(pathStyle);
  if (!inheritedText) return options;
  return {
    text: inheritedText,
    "tikzkit inherited path text": inheritedText,
    ...options
  };
}

function applyInlineBareFillCurrentColor(options = {}, semantic = {}, pathStyle = {}) {
  if (!semantic["tikzkit bare fill"]) return options;
  const inheritedFill = inheritedInlinePathTextColor(pathStyle);
  if (!inheritedFill) return options;
  return {
    ...options,
    fill: inheritedFill
  };
}

function inlineNodeInheritedOptions(env = {}, rawOptions = {}) {
  const options = inheritedNodeOptions(env);
  if (!Object.hasOwn(rawOptions, "draw")) delete options.draw;
  if (!Object.hasOwn(rawOptions, "fill")) delete options.fill;
  return options;
}

function inheritedInlinePathTextColor(pathStyle = {}) {
  return [pathStyle.textFill, pathStyle.stroke, pathStyle.fill]
    .find((value) => value && value !== "none" && value !== "transparent");
}

function hasExplicitTextColor(options = {}) {
  return Object.hasOwn(options, "text") || Object.hasOwn(options, "color");
}

function createNode(statement, env, ir, diagnostics) {
  const textMarks = extractTikzmarkNodes(resolveTextContent(statement.text, env));
  const text = textMarks.text;
  let expandedOptions = normalizeOptions("node", {
    ...inheritedNodeOptions(env),
    ...resolveDynamicOptions(statement.options || {}, env)
  }, env).options;
  expandedOptions = applyConceptNodeOptions(expandedOptions, env);
  if (isMatrixNodeOptions(expandedOptions)) {
    const name = statement.name
      ? resolvePicScopedName(resolveDynamicName(statement.name, env), env)
      : expandedOptions.name && expandedOptions.name !== true
        ? resolvePicScopedName(resolveDynamicName(String(expandedOptions.name), env), env)
        : null;
    createMatrix(
      {
        type: "matrix",
        name,
        at: statement.at,
        options: expandedOptions,
        body: text,
        raw: statement.raw
      },
      env,
      ir,
      diagnostics
    );
    const record = name ? env.nodes[name] : null;
    return {
      name,
      text,
      point: record?.point || null,
      width: record?.width || 0,
      height: record?.height || 0,
      shape: record?.shape || "rectangle",
      shapeData: record?.shapeData || {},
      options: expandedOptions
    };
  }
  const nodeEnv = nodeCanvasEnv(env, expandedOptions);
  const rawSize = estimateNodeLayoutSize(text, expandedOptions, nodeEnv);
  const rawAnchorSize = estimateNodeAnchorSize(text, expandedOptions, nodeEnv, rawSize);
  const rawPositioningSize = estimatePositioningSelfSize(text, expandedOptions, nodeEnv, rawAnchorSize);
  const size = scaleSize(rawSize, nodeEnv.canvasScale);
  const anchorSize = scaleSize(rawAnchorSize, nodeEnv.canvasScale);
  const positioningSize = scaleSize(rawPositioningSize, nodeEnv.canvasScale);
  const point = resolveNodePoint({ ...statement, options: expandedOptions }, env, diagnostics, positioningSize);
  const displayPoint = resolveNodeAnchorPoint(point, expandedOptions, text, nodeEnv, size);
  const name = statement.name
    ? resolvePicScopedName(resolveDynamicName(statement.name, env), env)
    : expandedOptions.name && expandedOptions.name !== true
      ? resolvePicScopedName(resolveDynamicName(String(expandedOptions.name), env), env)
      : null;
  const node = {
    at: point,
    text,
    options: expandedOptions,
    name,
    size,
    anchorSize,
    canvasScale: nodeEnv.canvasScale,
    displayPoint,
    fitTextToBox: shouldFitTextToNodeBox(expandedOptions)
  };
  const nodeRecord = {
    point: displayPoint,
    width: size.width,
    height: size.height,
    layoutWidth: anchorSize.width,
    layoutHeight: anchorSize.height,
    shape: nodeShape(expandedOptions),
    shapeData: nodeShapeData(expandedOptions, nodeEnv),
    rotation: nodeRotation(expandedOptions, nodeEnv)
  };
  if (name) {
    registerNodeRecord(name, nodeRecord, env);
  }
  registerTikzmarkNodeAnchors(textMarks.marks, {
    text,
    point: displayPoint,
    size,
    options: expandedOptions
  }, env);
  const chainUpdate = updateChainState(expandedOptions, env, displayPoint, positioningSize, { name, nodeRecord });
  addNodeItems(node, ir, nodeEnv);
  addChainJoinPath(chainUpdate, expandedOptions, env, ir, diagnostics);
  if (name && statement.path?.segments?.length) {
    addNodeAttachedPath(name, statement.path.segments, expandedOptions, env, ir, diagnostics);
  }
  return {
    name,
    text,
    point: displayPoint,
    width: size.width,
    height: size.height,
    shape: nodeShape(expandedOptions),
    shapeData: nodeShapeData(expandedOptions, nodeEnv),
    options: expandedOptions
  };
}

function isMatrixNodeOptions(options = {}) {
  return isMatrixLibraryNodeOptions(options);
}

function registerNodeRecord(name, record, env) {
  if (!name) return;
  env.nodes[name] = { ...record };
  env.coordinates[name] = record.point;
  materializeCircuitikzNodeAnchors(name, env);
}

function extractTikzmarkNodes(rawText) {
  const input = String(rawText ?? "");
  const marks = [];
  let text = "";
  let cursor = 0;
  while (cursor < input.length) {
    const index = input.indexOf("\\tikzmarknode", cursor);
    if (index < 0) {
      text += input.slice(cursor);
      break;
    }
    text += input.slice(cursor, index);
    const outputIndex = text.length;
    let readIndex = index + "\\tikzmarknode".length;
    readIndex = skipWhitespace(input, readIndex);
    if (input[readIndex] === "[") {
      const optional = readBalancedPrefix(input.slice(readIndex), "[", "]");
      if (!optional) {
        text += input.slice(index);
        break;
      }
      readIndex += optional.end;
      readIndex = skipWhitespace(input, readIndex);
    }
    const name = readBalancedPrefix(input.slice(readIndex), "{", "}");
    if (!name) {
      text += input.slice(index);
      break;
    }
    readIndex += name.end;
    readIndex = skipWhitespace(input, readIndex);
    const body = readBalancedPrefix(input.slice(readIndex), "{", "}");
    if (!body) {
      text += input.slice(index);
      break;
    }
    const content = body.content;
    marks.push({
      name: name.content.trim(),
      content,
      outputIndex,
      verticalRole: tikzmarkNodeVerticalRole(input, index)
    });
    text += content;
    cursor = readIndex + body.end;
  }
  return { text, marks: marks.filter((mark) => mark.name) };
}

function tikzmarkNodeVerticalRole(input, index) {
  let cursor = index - 1;
  while (cursor >= 0 && /[\s{]/.test(input[cursor])) cursor -= 1;
  if (input[cursor] === "_") return "subscript";
  if (input[cursor] === "^") return "superscript";
  return "baseline";
}

function skipWhitespace(text, index) {
  let cursor = index;
  while (cursor < text.length && /\s/.test(text[cursor])) cursor += 1;
  return cursor;
}

function registerTikzmarkNodeAnchors(marks, node, env) {
  if (!marks?.length) return;
  const textLength = Math.max(1, String(node.text || "").length);
  for (const mark of marks) {
    const contentLength = Math.max(1, String(mark.content || "").length);
    const fraction = Math.max(0, Math.min(1, (mark.outputIndex + contentLength / 2) / textLength));
    const yOffset = tikzmarkNodeYOffset(mark.verticalRole, node.size.height);
    const point = roundPoint({
      x: node.point.x + (fraction - 0.5) * node.size.width * 0.86,
      y: node.point.y + yOffset
    });
    const markSize = scaleSize(estimateNodeLayoutSize(mark.content, { "inner sep": "0pt" }, env), env.canvasScale);
    const width = Math.max(0.06, markSize.width);
    const height = Math.max(0.12, markSize.height);
    env.nodes[mark.name] = {
      point,
      width,
      height,
      layoutWidth: width,
      layoutHeight: height,
      shape: "rectangle",
      shapeData: {},
      rotation: 0
    };
    env.coordinates[mark.name] = point;
  }
}

function tikzmarkNodeYOffset(role, height) {
  if (role === "subscript") return -Math.max(0.08, height * 0.22);
  if (role === "superscript") return Math.max(0.08, height * 0.22);
  return 0;
}

function resolvePicScopedName(name, env = {}) {
  if (!name || !env.picNamePrefix || !String(name).startsWith("-")) return name;
  return `${env.picNamePrefix}${name}`;
}

function coordinateRendersAsNode(options = {}, env = {}) {
  let expandedOptions = normalizeOptions("node", {
    ...inheritedNodeOptions(env),
    ...resolveDynamicOptions(options || {}, env)
  }, env).options;
  expandedOptions = applyConceptNodeOptions(expandedOptions, env);
  return nodeUsesBoxSizing(expandedOptions, env);
}

function applyConceptNodeOptions(options = {}, env = {}) {
  if (!isConceptNodeOptions(options)) return options;
  const conceptColor = options["concept color"] ?? env.pictureOptions?.["concept color"] ?? "black";
  const withConcept = { ...options, circle: true };
  if (withConcept.fill === undefined || withConcept.fill === true) withConcept.fill = conceptColor;
  if (withConcept.draw === undefined || withConcept.draw === true) withConcept.draw = conceptColor;
  return withConcept;
}

function isConceptNodeOptions(options = {}) {
  return Boolean(options["tikzkit concept"] || options.concept);
}

function createNodeTreeChildren(parentNode, children = [], env, ir, diagnostics, level = 1, treeOptions = {}) {
  if (!parentNode || !children.length) return;
  const resolvedTreeOptions = resolveDynamicOptions(treeOptions || {}, env);
  const levelOptions = treeLevelOptions(level, env);
  for (const [index, child] of children.entries()) {
    const childTreeOptions = resolveDynamicOptions(child.options || {}, env);
    const childEdgeOptions = resolveDynamicOptions(child.edgeOptions || {}, env);
    const layoutOptions = { ...levelOptions, ...resolvedTreeOptions, ...childTreeOptions };
    const grow = treeGrowDirection(env, layoutOptions);
    const siblingDistance = treeSiblingDistance(level, env, layoutOptions);
    const levelDistance = treeLevelDistance(level, env, layoutOptions);
    const offset = treeChildOffset(index, children.length, siblingDistance, levelDistance, grow, layoutOptions, env);
    const projected = projectLocalOffset(offset.x, offset.y, env);
    const point = roundPoint({
      x: parentNode.point.x + projected.x,
      y: parentNode.point.y + projected.y
    });
    const childEnv = {
      ...env,
      pictureOptions: {
        ...(env.pictureOptions || {}),
        ...levelOptions,
        ...childTreeOptions
      }
    };
    const childNode = createNode(
      {
        ...child.node,
        options: {
          ...(child.node.options || {})
        },
        at: null,
        absolutePoint: point,
        path: null
      },
      childEnv,
      ir,
      diagnostics
    );
    if (!childNode) continue;
    addTreeEdge(parentNode, childNode, { ...layoutOptions, ...childEdgeOptions }, childEnv, ir);
    createNodeTreeChildren(childNode, child.children || child.node.children || [], childEnv, ir, diagnostics, level + 1, child.node.treeOptions || {});
  }
}

function treeGrowDirection(env, options = {}) {
  if (options["grow cyclic"] || env.pictureOptions?.["grow cyclic"] || options["tikzkit mindmap"] || env.pictureOptions?.["tikzkit mindmap"]) {
    return "cyclic";
  }
  const grow = String(options.grow ?? env.pictureOptions?.grow ?? "down").trim().toLowerCase();
  if (["up", "down", "left", "right"].includes(grow)) return grow;
  const angle = evaluateMath(grow, env.variables);
  if (Number.isFinite(angle)) return angle;
  return "down";
}

function treeLevelOptions(level, env) {
  const options = {
    ...(env.styles?.level || {}),
    ...(env.styles?.[`level ${level}`] || {})
  };
  if (isMindmapOptions(env.pictureOptions || {})) {
    Object.assign(options, env.styles?.[`level ${level} concept`] || {});
  }
  return options;
}

function treeLevelDistance(level, env, overrides = {}) {
  const options = { ...treeLevelOptions(level, env), ...overrides };
  return parseTreeDimension(options["level distance"] ?? env.pictureOptions?.["level distance"], "15mm", env);
}

function treeSiblingDistance(level, env, overrides = {}) {
  const options = { ...treeLevelOptions(level, env), ...overrides };
  return parseTreeDimension(options["sibling distance"] ?? env.pictureOptions?.["sibling distance"], "15mm", env);
}

function parseTreeDimension(value, fallback, env) {
  const parsed = parseDimension(value ?? fallback, env.variables);
  if (Number.isFinite(parsed)) return parsed;
  return parseDimension(fallback, env.variables);
}

function treeChildOffset(index, count, siblingDistance, levelDistance, grow, options = {}, env = { variables: {} }) {
  if (grow === "cyclic") {
    const angle = cyclicTreeChildAngle(index, count, options, env);
    const radians = (angle * Math.PI) / 180;
    return {
      x: Math.cos(radians) * levelDistance,
      y: Math.sin(radians) * levelDistance
    };
  }
  if (typeof grow === "number") {
    const radians = (grow * Math.PI) / 180;
    return {
      x: Math.cos(radians) * levelDistance,
      y: Math.sin(radians) * levelDistance
    };
  }
  const siblingOffset = ((count - 1) / 2 - index) * siblingDistance;
  if (grow === "up") return { x: siblingOffset, y: levelDistance };
  if (grow === "left") return { x: -levelDistance, y: siblingOffset };
  if (grow === "right") return { x: levelDistance, y: siblingOffset };
  return { x: -siblingOffset, y: -levelDistance };
}

function cyclicTreeChildAngle(index, count, options = {}, env = { variables: {} }) {
  const siblingAngle = parseTreeAngle(options["sibling angle"] ?? env.pictureOptions?.["sibling angle"], 360 / Math.max(1, count), env);
  if (options["clockwise from"] !== undefined || env.pictureOptions?.["clockwise from"] !== undefined) {
    return parseTreeAngle(options["clockwise from"] ?? env.pictureOptions?.["clockwise from"], 90, env) - index * siblingAngle;
  }
  if (options["counterclockwise from"] !== undefined || env.pictureOptions?.["counterclockwise from"] !== undefined) {
    return parseTreeAngle(options["counterclockwise from"] ?? env.pictureOptions?.["counterclockwise from"], 90, env) + index * siblingAngle;
  }
  return 90 - (index - (count - 1) / 2) * siblingAngle;
}

function parseTreeAngle(value, fallback, env) {
  if (value === undefined || value === null || value === true || value === "") return fallback;
  const angle = evaluateMath(value, env.variables);
  return Number.isFinite(angle) ? angle : fallback;
}

function isMindmapOptions(options = {}) {
  return Boolean(options.mindmap || options["tikzkit mindmap"] || options["grow cyclic"]);
}

function addTreeEdge(parentNode, childNode, options, env, ir) {
  const normalized = normalizeOptions("draw", options || {}, env);
  const style = scaleCanvasStyle(normalized.style, env);
  if (isMindmapOptions(env.pictureOptions || {}) || isMindmapOptions(options || {})) {
    const conceptColor = options?.["concept color"] ?? env.pictureOptions?.["concept color"];
    if (conceptColor) style.stroke = normalizeColor(String(conceptColor));
    style.lineWidth = Math.max(Number(style.lineWidth) || 0, 0.1 * TIKZ_UNIT * canvasLengthScale(env));
    style.lineCap = "round";
  }
  const parentClipNode = treeEdgeClipNode(parentNode, env);
  const childClipNode = treeEdgeClipNode(childNode, env);
  const clipped = clipNodeLineEndpoints(
    parentNode.point,
    { node: parentClipNode, mode: "center" },
    childNode.point,
    { node: childClipNode, mode: "center" },
    env
  );
  ir.items.push({
    type: "path",
    subtype: "tree-edge",
    style,
    commands: [
      { type: "moveTo", x: clipped.from.x, y: clipped.from.y },
      { type: "lineTo", x: clipped.to.x, y: clipped.to.y }
    ]
  });
}

function treeEdgeClipNode(node, env) {
  if (!nodeUsesMonospaceFont(node.text, node.options, env)) return node;
  const normalized = normalizeTikzText(node.text);
  const textBox = scaleTextMetricBox(estimateTextMetricBox(normalized, {
    widthFactor: 0.184,
    lineHeight: 0.32,
    minHeight: 0.18,
    formulaMinWidth: 0.08,
    formulaWidthPadding: 0
  }), nodeFontScaleForText(normalized, node.options || {}, env));
  const innerSep = parseNodeLengthDimension(node.options?.["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env);
  return {
    ...node,
    width: roundNumber(Math.max(Number(node.width) || 0, textBox.width + innerSep * 2)),
    height: roundNumber(Math.max(Number(node.height) || 0, textBox.height + innerSep * 2))
  };
}

function addNodeAttachedPath(name, segments, nodeOptions, env, ir, diagnostics) {
  const rawOptions = { ...(env.pictureOptions || {}), ...(nodeOptions || {}) };
  const normalized = normalizeOptions("path", rawOptions, env);
  const style = scaleCanvasStyle(normalized.style, env);
  const { semantic, options } = normalized;
  const pathOptions = { ...options, ...semantic };
  for (const segment of splitAttachedPathSegments(segments)) {
    const built = buildPath([{ kind: "coordinate", raw: name }, ...segment], env, diagnostics, pathOptions, style);
    const visible = isVisiblePath("path", style, semantic, built.styleHints);
    if (visible && hasDrawableCommands(built.commands, built.shapes)) {
      const pathStyle = drawablePathStyle(style, built.styleHints);
      const item = {
        type: "path",
        subtype: semanticSubtype(pathOptions),
        style: pathStyle,
        commands: applyArrowEndpointShortening(built.commands, pathStyle, built.endpointRefs)
      };
      ir.items.push(item);
      addDecorationMarkers(item, options, ir);
    }
    for (const node of built.nodes) {
      addNodeItems(node, ir, env);
    }
  }
}

function resolveTextContent(raw, env = {}) {
  const substituted = substituteTextVariables(String(raw ?? ""), env.variables || {});
  return expandInlinePgfMathResults(substituted, env.variables || {});
}

function expandInlinePgfMathResults(text, variables = {}) {
  return String(text ?? "").replace(/\\pgfmathparse\s*\{([^{}]*)\}\s*\\pgfmathresult/g, (_match, expression) => {
    const value = evaluateMath(expression, variables);
    if (!Number.isFinite(value)) return "0";
    const rounded = roundNumber(value, 8);
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  });
}

function splitAttachedPathSegments(segments = []) {
  if (!segments.every((segment) => segment.kind === "edge" || segment.kind === "to")) return [segments];
  return segments.map((segment) => [segment]);
}

function createCalendar(statement, env, ir, diagnostics = []) {
  const spec = parseCalendarSpec(statement.raw || "");
  if (!spec) {
    diagnostics.push({ severity: "warning", message: "Malformed \\calendar statement" });
    return;
  }
  const origin = spec.at
    ? resolveCoordinate(spec.at, env, diagnostics)
    : resolvePositioning(spec.options || {}, env) || applyTransform({ x: 0, y: 0 }, env.transform);
  createCalendarItems(spec, origin, env, ir, diagnostics);
}

function createCalendarItems(spec, center, env, ir, diagnostics = []) {
  const layout = calendarLayout(spec, env);
  if (!layout) {
    diagnostics.push({ severity: "warning", message: `Unsupported \\calendar dates ${spec.options?.dates || ""}`.trim() });
    return;
  }
  const start = roundPoint({
    x: center.x - (layout.columns - 1) * layout.dayX / 2,
    y: center.y + (layout.rowCount - 1) * layout.dayY / 2
  });

  if (layout.options["month label above centered"] || layout.options["month label above left"] || layout.options["month label above right"]) {
    const monthPoint = roundPoint({
      x: start.x + ((layout.columns - 1) * layout.dayX) / 2 - parseDimension("1.5ex", env.variables),
      y: start.y + layout.dayY * 1.25
    });
    addCalendarNode({
      point: monthPoint,
      text: calendarMonthText(layout),
      options: calendarTextNodeOptions(layout.options, { "every month": true }, env)
    }, ir, env);
  }

  for (const date of layout.dates) {
    const point = roundPoint({
      x: start.x + date.weekdaySunday * layout.dayX,
      y: start.y - date.row * layout.dayY
    });
    const name = spec.name ? `${resolveDynamicName(spec.name, env)}-${date.iso}` : date.iso;
    const options = calendarDayOptions(layout, date, env);
    addCalendarNode({ point, text: calendarDayText(layout, date), options, name }, ir, env);
  }
}

function addCalendarNode(node, ir, env) {
  const text = substituteTextVariables(String(node.text ?? ""), env.variables);
  const expandedOptions = normalizeOptions("node", {
    ...inheritedNodeOptions(env),
    ...resolveDynamicOptions(node.options || {}, env)
  }, env).options;
  const size = scaleSize(estimateNodeLayoutSize(text, expandedOptions, env), env.canvasScale);
  const displayPoint = resolveNodeAnchorPoint(node.point, expandedOptions, text, env, size);
  if (node.name) {
    env.nodes[node.name] = {
      point: displayPoint,
      width: size.width,
      height: size.height,
      layoutWidth: size.width,
      layoutHeight: size.height,
      shape: nodeShape(expandedOptions),
      shapeData: nodeShapeData(expandedOptions, env)
    };
    env.coordinates[node.name] = displayPoint;
  }
  addNodeItems({ at: node.point, displayPoint, text, options: expandedOptions, name: node.name || null, size }, ir, env);
}

function estimateCalendarSize(spec, env) {
  const layout = calendarLayout(spec, env);
  if (!layout) return { width: 1, height: 1 };
  return {
    width: roundNumber(layout.columns * layout.dayX + 0.35),
    height: roundNumber(layout.rowCount * layout.dayY + layout.dayY * 1.45)
  };
}

function calendarLayout(spec, env) {
  const options = calendarEffectiveOptions(spec, env);
  const dates = calendarDateRange(options.dates || spec.options?.dates);
  if (!dates.length) return null;
  const dayX = parseFiniteDimension(options["day xshift"], env, parseDimension("3.5ex", env.variables));
  const dayY = parseFiniteDimension(options["day yshift"], env, parseDimension("3ex", env.variables));
  const first = dates[0];
  const positioned = dates.map((date) => {
    const absolute = calendarOrdinal(date.date);
    const firstAbsolute = calendarOrdinal(first.date);
    const weekdaySunday = date.date.getUTCDay();
    const row = Math.floor((first.date.getUTCDay() + (absolute - firstAbsolute)) / 7);
    return { ...date, weekdaySunday, row };
  });
  return {
    options,
    conditions: [...calendarConditionsFromOptions(options), ...(spec.conditions || [])],
    dates: positioned,
    columns: 7,
    dayX,
    dayY,
    rowCount: Math.max(...positioned.map((date) => date.row)) + 1
  };
}

function calendarEffectiveOptions(spec, env) {
  const normalized = normalizeOptions("node", { "every calendar": true, ...(spec.options || {}) }, env).options;
  return normalized;
}

function calendarTextNodeOptions(calendarOptions, extraOptions = {}, env) {
  const options = { ...calendarOptions, ...extraOptions };
  for (const key of calendarOnlyOptionKeys()) delete options[key];
  return options;
}

function calendarDayOptions(layout, date, env) {
  let options = calendarTextNodeOptions(layout.options, { "every day": true }, env);
  for (const condition of layout.conditions) {
    if (calendarConditionMatches(condition.condition, date)) {
      options = { ...options, ...(condition.options || {}) };
    }
  }
  return options;
}

function calendarOnlyOptionKeys() {
  return [
    "dates",
    "if",
    "day xshift",
    "day yshift",
    "month xshift",
    "month yshift",
    "month text",
    "month label above centered",
    "month label above left",
    "month label above right",
    "month label left vertical",
    "month label right vertical",
    "week list",
    "week list sunday",
    "month list",
    "tikz@lib@cal@width",
    "execute before day scope",
    "execute at begin day scope",
    "execute after day scope"
  ];
}

function calendarConditionsFromOptions(options = {}) {
  if (options.if === undefined) return [];
  return optionValueList(options.if).map(parseCalendarIfValue).filter(Boolean);
}

function parseCalendarIfValue(value) {
  const text = String(value || "").trim();
  const condition = extractBalanced(text, 0, "(", ")");
  if (!condition) return null;
  let index = calendarSkipWhitespace(text, condition.end);
  let options = {};
  if (text[index] === "[") {
    const parsedOptions = extractBalanced(text, index, "[", "]");
    if (parsedOptions) options = parseOptions(parsedOptions.content);
  }
  return { condition: condition.content.trim(), options };
}

function calendarConditionMatches(condition, date) {
  const text = stripOuterBraces(String(condition || "").trim());
  const lower = text.toLowerCase();
  if (lower === "sunday" || lower === "monday" || lower === "tuesday" || lower === "wednesday" || lower === "thursday" || lower === "friday" || lower === "saturday") {
    return lower === date.weekdayName.toLowerCase();
  }
  const equals = text.match(/^equals\s*=\s*(.+)$/i);
  if (equals) return calendarDateSelectorMatches(equals[1], date);
  const between = text.match(/^between\s*=\s*(.+?)\s+and\s+(.+)$/i);
  if (between) {
    const current = calendarComparableDate(date.iso);
    const start = calendarComparableSelector(between[1], date.iso.slice(0, 4));
    const end = calendarComparableSelector(between[2], date.iso.slice(0, 4));
    return start !== null && end !== null && current >= start && current <= end;
  }
  const dayOfMonth = text.match(/^day of month\s*=\s*(\d+)$/i);
  if (dayOfMonth) return date.day === Number(dayOfMonth[1]);
  return false;
}

function calendarDateSelectorMatches(selector, date) {
  const wanted = String(selector || "").trim();
  return wanted === date.iso || wanted === date.monthDay || `${date.year}-${wanted}` === date.iso;
}

function calendarComparableSelector(selector, fallbackYear) {
  const text = String(selector || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return calendarComparableDate(text);
  if (/^\d{2}-\d{2}$/.test(text)) return calendarComparableDate(`${fallbackYear}-${text}`);
  return null;
}

function calendarComparableDate(iso) {
  return Number(String(iso).replace(/-/g, ""));
}

function calendarDayText(layout, date) {
  const template = layout.options["day text"];
  if (!template || template === true) return String(date.day);
  return calendarTemplateText(template, date);
}

function calendarMonthText(layout) {
  const first = layout.dates[0];
  const template = layout.options["month text"] || "\\%mt";
  return calendarTemplateText(template, first);
}

function calendarTemplateText(template, date) {
  let text = stripOuterBraces(String(template || ""));
  text = text.replace(/\\textit\{([^{}]*)\}/g, "$1");
  text = text.replace(/\\%mt/g, calendarMonthAbbrev(date.month));
  text = text.replace(/\\%m0/g, String(date.month).padStart(2, "0"));
  text = text.replace(/\\%m-/g, String(date.month));
  text = text.replace(/\\%d0/g, String(date.day).padStart(2, "0"));
  text = text.replace(/\\%d-/g, String(date.day));
  text = text.replace(/\\%y0/g, String(date.year));
  return text.trim() || String(date.day);
}

function calendarMonthAbbrev(month) {
  return ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][month - 1] || String(month);
}

function calendarDateRange(rawDates) {
  const text = String(rawDates || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})\s+to\s+(\d{4})-(\d{2})-(\d{2}|last)$/i);
  if (!match) return [];
  const startYear = Number(match[1]);
  const startMonth = Number(match[2]);
  const startDay = Number(match[3]);
  const endYear = Number(match[4]);
  const endMonth = Number(match[5]);
  const endDay = match[6].toLowerCase() === "last" ? daysInMonth(endYear, endMonth) : Number(match[6]);
  const dates = [];
  let current = Date.UTC(startYear, startMonth - 1, startDay);
  const end = Date.UTC(endYear, endMonth - 1, endDay);
  while (current <= end) {
    const date = new Date(current);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const monthText = String(month).padStart(2, "0");
    const dayText = String(day).padStart(2, "0");
    dates.push({
      date,
      year,
      month,
      day,
      iso: `${year}-${monthText}-${dayText}`,
      monthDay: `${monthText}-${dayText}`,
      weekdayName: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getUTCDay()]
    });
    current += 24 * 60 * 60 * 1000;
  }
  return dates;
}

function calendarOrdinal(date) {
  return Math.floor(date.getTime() / (24 * 60 * 60 * 1000));
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseCalendarSpec(raw) {
  const text = String(raw || "").trim().replace(/;\s*$/, "");
  if (!text.startsWith("\\calendar")) return null;
  let index = "\\calendar".length;
  let name = null;
  let at = null;
  let options = {};
  const conditions = [];
  while (index < text.length) {
    index = calendarSkipWhitespace(text, index);
    if (text[index] === "(") {
      const parsedName = extractBalanced(text, index, "(", ")");
      if (!parsedName) return null;
      name = parsedName.content.trim();
      index = parsedName.end;
      continue;
    }
    if (text[index] === "[") {
      const parsedOptions = extractBalanced(text, index, "[", "]");
      if (!parsedOptions) return null;
      options = { ...options, ...parseOptions(parsedOptions.content) };
      index = parsedOptions.end;
      continue;
    }
    if (calendarStartsWord(text, index, "at")) {
      index = calendarSkipWhitespace(text, index + 2);
      if (text[index] !== "(") return null;
      const parsedAt = extractBalanced(text, index, "(", ")");
      if (!parsedAt) return null;
      at = `(${parsedAt.content.trim()})`;
      index = parsedAt.end;
      continue;
    }
    if (calendarStartsWord(text, index, "if")) {
      const parsedIf = parseCalendarStatementIf(text, index);
      if (!parsedIf) return null;
      conditions.push(parsedIf.condition);
      index = parsedIf.end;
      continue;
    }
    break;
  }
  return { name, at, options, conditions, raw: text };
}

function parseCalendarStatementIf(text, start) {
  let index = calendarSkipWhitespace(text, start + 2);
  if (text[index] !== "(") return null;
  const condition = extractBalanced(text, index, "(", ")");
  if (!condition) return null;
  index = calendarSkipWhitespace(text, condition.end);
  let options = {};
  if (text[index] === "[") {
    const parsedOptions = extractBalanced(text, index, "[", "]");
    if (!parsedOptions) return null;
    options = parseOptions(parsedOptions.content);
    index = parsedOptions.end;
  }
  return {
    condition: { condition: condition.content.trim(), options },
    end: index
  };
}

function calendarStartsWord(text, index, word) {
  if (!text.startsWith(word, index)) return false;
  const before = index > 0 ? text[index - 1] : "";
  const after = text[index + word.length] || "";
  return !/[A-Za-z]/.test(before) && !/[A-Za-z]/.test(after);
}

function calendarSkipWhitespace(text, index) {
  let cursor = index;
  while (/\s/.test(text[cursor] || "")) cursor += 1;
  return cursor;
}

function createMatrix(statement, env, ir, diagnostics = []) {
  const name = statement.name ? resolveDynamicName(statement.name, env) : null;
  const matrixOptions = normalizeOptions("node", statement.options || {}, env).options;
  const matrixNodeOptions = matrixOptions.nodes ? parseOptions(matrixOptions.nodes) : {};
  const inheritedNodeOptions = matrixInheritedNodeOptions(matrixOptions);
  const cellBaseOptions = { ...inheritedNodeOptions, ...matrixNodeOptions };
  const keepEmptyCells = Boolean(matrixOptions["nodes in empty cells"]);
  const rows = splitMatrixRows(statement.body)
    .map((row) =>
      splitMatrixCells(row)
        .map(parseMatrixCell)
        .filter((cell) => keepEmptyCells || cell.calendar || cell.text.length || Object.keys(cell.options).length)
    )
    .filter((row) => row.length);
  if (!rows.length) return;

  let baseCellWidth = 0.02;
  let baseCellHeight = 0.02;
	  for (const row of rows) {
	    for (const cell of row) {
	      const cellText = matrixCellText(cell.text, matrixOptions);
	      const size = cell.calendar
	        ? estimateCalendarSize(cell.calendar, env)
	        : estimateMatrixCellSize(cellText, { ...cellBaseOptions, ...cell.options }, env);
	      baseCellWidth = Math.max(baseCellWidth, size.width);
	      baseCellHeight = Math.max(baseCellHeight, size.height);
	    }
  }

  const matrixScale = parseMatrixScale(matrixOptions, env);
  const cellWidth = roundNumber(baseCellWidth * matrixScale);
  const cellHeight = roundNumber(baseCellHeight * matrixScale);
  const colSep = parseFiniteDimension(matrixOptions["column sep"], env, 0) * matrixScale;
  const rowSep = parseFiniteDimension(matrixOptions["row sep"], env, 0) * matrixScale;
  const stepX = Math.max(Math.max(0.02, cellWidth * 0.25), cellWidth + colSep);
  const stepY = Math.max(Math.max(0.02, cellHeight * 0.25), cellHeight + rowSep);
  const cols = Math.max(...rows.map((row) => row.length));
  const totalWidth = cellWidth + (cols - 1) * stepX;
  const totalHeight = cellHeight + (rows.length - 1) * stepY;
  const visibleInnerXSep = matrixInnerSepForAxis(matrixOptions, "x", env, matrixScale, 0);
  const visibleInnerYSep = matrixInnerSepForAxis(matrixOptions, "y", env, matrixScale, 0);
  const layoutInnerXSep = matrixInnerSepForAxis(matrixOptions, "x", env, matrixScale, parseDimension(TIKZ_DEFAULT_INNER_SEP, env.variables));
  const layoutInnerYSep = matrixInnerSepForAxis(matrixOptions, "y", env, matrixScale, parseDimension(TIKZ_DEFAULT_INNER_SEP, env.variables));
  const boundsWidth = roundNumber(totalWidth + visibleInnerXSep * 2);
  const boundsHeight = roundNumber(totalHeight + visibleInnerYSep * 2);
  const layoutWidth = roundNumber(totalWidth + layoutInnerXSep * 2);
  const layoutHeight = roundNumber(totalHeight + layoutInnerYSep * 2);
  const origin =
    (statement.at ? resolveCoordinate(statement.at, env, diagnostics) : null) ||
    resolvePositioning(matrixOptions || {}, env, { width: layoutWidth, height: layoutHeight }) ||
    applyTransform({ x: 0, y: 0 }, env.transform);
  const startX = origin.x - ((cols - 1) * stepX) / 2;
  const startY = origin.y + ((rows.length - 1) * stepY) / 2;

  if (name) {
    env.nodes[name] = {
      point: origin,
      width: boundsWidth,
      height: boundsHeight,
      layoutWidth,
      layoutHeight,
      shape: "rectangle"
    };
    env.coordinates[name] = origin;
  }

  const { style: rawMatrixStyle, semantic: matrixSemantic } = normalizeOptions("node", matrixOptions, env);
  const matrixStyle = scaleCanvasStyle(rawMatrixStyle, env);
  const matrixShape = nodeShape(matrixOptions);
  const matrixFrameStyle = {
    lineWidth: matrixStyle.lineWidth || 1,
    dashArray: matrixStyle.dashArray,
    opacity: matrixStyle.opacity,
    fillOpacity: matrixStyle.fillOpacity,
    strokeOpacity: matrixStyle.strokeOpacity
  };
  const matrixFrameItem = (style) => ({
    type: "nodeBox",
    shape: matrixShape,
    x: origin.x,
    y: origin.y,
    width: boundsWidth,
    height: boundsHeight,
    rx: nodeCornerRadius(matrixShape, matrixSemantic, { width: boundsWidth, height: boundsHeight }),
    style: { ...matrixFrameStyle, ...style }
  });
  const matrixFill = matrixStyle.fill || "none";
  const matrixStroke = matrixSemantic.draw || matrixStyle.stroke !== "none" ? matrixStyle.stroke || "black" : "none";
  if (matrixFill !== "none") {
    ir.items.push(matrixFrameItem({ stroke: "none", fill: matrixFill }));
  }

	  rows.forEach((row, rowIndex) => {
	    const rowOptions = matrixRowNodeOptions(matrixOptions, rowIndex + 1);
    row.forEach((cell, columnIndex) => {
      const cellName = name ? `${name}-${rowIndex + 1}-${columnIndex + 1}` : null;
      const point = roundPoint({
        x: startX + columnIndex * stepX,
        y: startY - rowIndex * stepY
      });
      const options = {
        ...cellBaseOptions,
        ...rowOptions,
        ...cell.options,
        "minimum width": `${cellWidth}`,
        "minimum height": `${cellHeight}`
      };
      if (cellName) {
        env.nodes[cellName] = {
          point,
          width: cellWidth,
          height: cellHeight,
          shape: nodeShape(options),
          shapeData: nodeShapeData(options, env)
        };
        env.coordinates[cellName] = point;
      }
      if (cell.explicitName) {
        const explicitName = resolveDynamicName(cell.explicitName, env);
        env.nodes[explicitName] = {
          point,
          width: cellWidth,
          height: cellHeight,
          shape: nodeShape(options),
          shapeData: nodeShapeData(options, env)
        };
        env.coordinates[explicitName] = point;
      }
	      if (cell.calendar) {
	        createCalendarItems(cell.calendar, point, env, ir, diagnostics);
	        return;
	      }
	      const cellText = matrixCellText(cell.text, matrixOptions);
	      addNodeItems(
	        {
	          at: point,
	          text: cellText,
	          options,
	          name: cellName,
	          size: { width: cellWidth, height: cellHeight },
          fitTextToBox: true
        },
        ir,
        env
      );
	    });
	  });

	  addMatrixDelimiters(ir, matrixOptions, origin, boundsWidth, boundsHeight, matrixStyle, env);

	  if (matrixStroke !== "none") {
	    ir.items.push(matrixFrameItem({ stroke: matrixStroke, fill: "none" }));
	  }
	}

function matrixCellText(text, matrixOptions = {}) {
  return matrixLibraryCellText(text, matrixOptions);
}

function addMatrixDelimiters(ir, options = {}, origin, width, height, matrixStyle = {}, env = {}) {
  addMatrixLibraryDelimiters(ir, options, origin, width, height, matrixStyle, env, parseFiniteDimension);
}

function matrixRowNodeOptions(matrixOptions = {}, rowNumber) {
  return matrixLibraryRowNodeOptions(matrixOptions, rowNumber);
}

function matrixInheritedNodeOptions(options = {}) {
  return matrixLibraryInheritedNodeOptions(options);
}

function parseMatrixScale(options = {}, env) {
  if (!tikzBoolean(options["transform shape"])) return 1;
  if (options.scale === undefined || options.scale === true || options.scale === "") return 1;
  const scale = evaluateMath(options.scale, env.variables);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function matrixInnerSepForAxis(options = {}, axis, env, scale, fallback) {
  const axisKey = axis === "x" ? "inner xsep" : "inner ysep";
  const raw = Object.hasOwn(options, axisKey) ? options[axisKey] : options["inner sep"];
  return parseFiniteDimension(raw, env, fallback) * scale;
}

function createPic(statement, env, ir, diagnostics = []) {
  const name = picName(statement, env);
  const origin = picOrigin(statement, env, diagnostics);
  if (createCustomPic(statement, env, ir, diagnostics, name, origin)) return;
  if (createTqftPic(statement, env, ir, diagnostics, name, origin)) return;
  if (createAnglePic(statement, env, ir)) return;
  const cube = statement.body.match(/cube\s*=\s*\{([^}]*)\}/);
  if (!cube) return;
  const [widthRaw = "1", heightRaw = "1", depthRaw = "0.5", lineWidthRaw = ""] = cube[1].split("/").map((part) => part.trim());
  const width = parseDimension(widthRaw, env.variables);
  const height = parseDimension(heightRaw, env.variables);
  const depth = parseDimension(depthRaw, env.variables);
  const cubeBasis = picCubeBasis(env);
  const point = (x, y, z = 0) => {
    const projected = projectBasisPoint(x, y, z, cubeBasis);
    return { x: origin.x + projected.x, y: origin.y + projected.y };
  };
  const points = {
    A: roundPoint(point(-width - depth * 0.5, 0, -depth * 0.5)),
    B: roundPoint(point(width - depth * 0.5, 0, -depth * 0.5)),
    V: roundPoint(point(width, height, 0)),
    W: roundPoint(point(width, -height, 0))
  };
  if (name) {
    for (const [suffix, point] of Object.entries(points)) {
      const coordinateName = `${name}-${suffix}`;
      env.coordinates[coordinateName] = point;
      env.nodes[coordinateName] = { point, width: 0.1, height: 0.1, shape: "rectangle" };
    }
    env.coordinates[name] = origin;
    env.nodes[name] = {
      point: origin,
      width: roundNumber(width * 2 + depth),
      height: roundNumber(height * 2 + depth),
      shape: "rectangle"
    };
  }

  const { style: rawStyle } = normalizeOptions("filldraw", statement.options || {}, env);
  const style = scaleCanvasStyle(rawStyle, env);
  const picLineWidth = parsePicCubeLineWidth(lineWidthRaw, env);
  if (Number.isFinite(picLineWidth)) style.lineWidth = roundNumber(picLineWidth * TIKZ_UNIT * env.canvasScale);
  if (isInvisiblePicCube(statement.options || {})) return;
  const leftTop = point(-width, height, 0);
  const rightTop = point(width, height, 0);
  const rightBottom = point(width, -height, 0);
  const leftBottom = point(-width, -height, 0);
  const backLeftBottom = point(-width - depth, -height, -depth);
  const backLeftTop = point(-width - depth, height, -depth);
  const backRightTop = point(width - depth, height, -depth);
  const commands = [
    { type: "moveTo", x: leftBottom.x, y: leftBottom.y },
    { type: "lineTo", x: rightBottom.x, y: rightBottom.y },
    { type: "lineTo", x: rightTop.x, y: rightTop.y },
    { type: "lineTo", x: leftTop.x, y: leftTop.y },
    { type: "closePath" }
  ];
  if (!env.toggles?.redraw) {
    commands.push(
      { type: "moveTo", x: leftBottom.x, y: leftBottom.y },
      { type: "lineTo", x: backLeftBottom.x, y: backLeftBottom.y },
      { type: "lineTo", x: backLeftTop.x, y: backLeftTop.y },
      { type: "lineTo", x: leftTop.x, y: leftTop.y },
      { type: "closePath" }
    );
  }
  if (!env.toggles?.redraw2) {
    commands.push(
      { type: "moveTo", x: leftTop.x, y: leftTop.y },
      { type: "lineTo", x: backLeftTop.x, y: backLeftTop.y },
      { type: "lineTo", x: backRightTop.x, y: backRightTop.y },
      { type: "lineTo", x: rightTop.x, y: rightTop.y },
      { type: "closePath" }
    );
  }
  ir.items.push({
    type: "path",
    shape: "pic-cube",
    style,
    commands: commands.map((command) => ("x" in command ? { ...command, x: roundNumber(command.x), y: roundNumber(command.y) } : command))
  });
}

function picName(statement, env) {
  return statement.name
    ? resolveDynamicName(statement.name, env)
    : statement.options?.name
      ? resolveDynamicName(statement.options.name, env)
      : null;
}

function picOrigin(options = {}, env, diagnostics = []) {
  const at = options.at ?? options.options?.at;
  if (at !== undefined && at !== null && at !== true && at !== "") {
    return resolveCoordinate(stripOuterBraces(String(at)), env, diagnostics);
  }
  return resolvePositioning(options.options || options || {}, env) || applyTransform({ x: 0, y: 0 }, env.transform);
}

function createCustomPic(statement, env, ir, diagnostics = [], name = null, origin = { x: 0, y: 0 }) {
  const picBody = env.pics?.[statement.body];
  if (!picBody) return false;
  if (name) {
    env.coordinates[name] = origin;
    env.nodes[name] = { point: origin, width: 0, height: 0, shape: "rectangle" };
  }
  const localStatements = parseStatements(picBody, diagnostics);
  const parentTransform = normalizeTransform(env.transform);
  const childEnv = {
    ...env,
    transform: { ...parentTransform, x: origin.x, y: origin.y },
    styles: {
      ...(env.styles || {}),
      "pic actions": statement.options || {}
    },
    picNamePrefix: name || env.picNamePrefix || null
  };
  for (const child of localStatements) interpretStatement(child, childEnv, ir, diagnostics);
  return true;
}

function createTqftPic(statement, env, ir, diagnostics, name, origin) {
  const spec = tqftPicSpec(statement, env);
  if (!spec) return false;
  const local = tqftLocalGeometry(spec);
  const anchor = tqftLocalAnchor(local, spec.anchor);
  const transform = (point) => tqftTransformPoint(point, origin, anchor, spec.rotate);
  const style = tqftPathStyle(spec, env);

  ir.items.push({
    type: "path",
    subtype: "tqft-cobordism",
    style,
    commands: tqftTransformCommands(tqftBodyPath(local, spec), transform)
  });

  for (const boundary of [...local.incoming, ...local.outgoing]) {
    ir.items.push({
      type: "path",
      subtype: `tqft-${boundary.kind}-boundary`,
      shape: "ellipse",
      style,
      commands: tqftTransformCommands(tqftBoundaryPath(boundary, spec), transform)
    });
  }

  if (name) registerTqftCoordinates(name, local, spec, transform, env);
  return true;
}

function tqftPicSpec(statement, env) {
  const options = tqftMergedOptions(statement.options || {}, env);
  const body = String(statement.body || "").trim();
  if (!tqftOptionPresent(options, body)) return null;

  let incoming = 5;
  let outgoing = 4;
  let offset = 0;
  if (options["tqft/cylinder to prior"] || options["cylinder to prior"]) {
    incoming = 1;
    outgoing = 1;
    offset = -0.5;
  } else if (options["tqft/cylinder to next"] || options["cylinder to next"]) {
    incoming = 1;
    outgoing = 1;
    offset = 0.5;
  } else if (options["tqft/cylinder"] || options.cylinder) {
    incoming = 1;
    outgoing = 1;
  } else if (options["tqft/cup"] || options.cup) {
    incoming = 1;
    outgoing = 0;
  } else if (options["tqft/cap"] || options.cap) {
    incoming = 0;
    outgoing = 1;
  } else if (options["tqft/pair of pants"] || options["pair of pants"]) {
    incoming = 1;
    outgoing = 2;
    offset = -0.5;
  } else if (options["tqft/reverse pair of pants"] || options["reverse pair of pants"]) {
    incoming = 2;
    outgoing = 1;
    offset = 0.5;
  }

  incoming = tqftIntegerOption(options, ["tqft/incoming boundary components", "incoming boundary components"], incoming, env);
  outgoing = tqftIntegerOption(options, ["tqft/outgoing boundary components", "outgoing boundary components"], outgoing, env);
  offset = tqftNumberOption(options, ["tqft/offset", "offset"], offset, env);
  return {
    incoming: Math.max(0, incoming),
    outgoing: Math.max(0, outgoing),
    offset,
    height: tqftDimensionOption(options, ["tqft/cobordism height", "cobordism height"], "2cm", env),
    separation: tqftDimensionOption(options, ["tqft/boundary separation", "boundary separation"], "2cm", env),
    rx: tqftDimensionOption(options, ["tqft/circle x radius", "circle x radius"], "10pt", env),
    ry: tqftDimensionOption(options, ["tqft/circle y radius", "circle y radius"], "5pt", env),
    rotate: tqftNumberOption(options, ["rotate"], 0, env),
    viewFrom: String(options["tqft/view from"] || options["view from"] || "outgoing").trim(),
    anchor: String(options.anchor || "none").trim(),
    options
  };
}

function tqftMergedOptions(options = {}, env = {}) {
  const everyTqftStyle = env.styles?.["every tqft"] || {};
  const everyTqft = parseOptions(env.pictureOptions?.["every tqft/.append style"] || env.pictureOptions?.["every tqft/.style"] || "");
  return {
    ...everyTqftStyle,
    ...everyTqft,
    ...resolveDynamicOptions(options || {}, env)
  };
}

function tqftOptionPresent(options = {}, body = "") {
  return body === "tqft" ||
    body === "cobordism" ||
    Object.keys(options).some((key) =>
      key === "tqft" ||
      key.startsWith("tqft/") ||
      key === "incoming boundary components" ||
      key === "outgoing boundary components" ||
      key === "cobordism edge/.style"
    );
}

function tqftIntegerOption(options, keys, fallback, env) {
  const value = tqftRawOption(options, keys);
  if (value === undefined) return fallback;
  const parsed = Math.round(evaluateMath(value, env.variables));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function tqftNumberOption(options, keys, fallback, env) {
  const value = tqftRawOption(options, keys);
  if (value === undefined || value === true || value === "") return fallback;
  const parsed = evaluateMath(value, env.variables);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function tqftDimensionOption(options, keys, fallback, env) {
  const value = tqftRawOption(options, keys) ?? fallback;
  const parsed = parseDimension(value, env.variables);
  return Number.isFinite(parsed) ? parsed : parseDimension(fallback, env.variables);
}

function tqftRawOption(options, keys) {
  for (const key of keys) {
    if (Object.hasOwn(options, key)) return options[key];
  }
  return undefined;
}

function tqftLocalGeometry(spec) {
  const incoming = Array.from({ length: spec.incoming }, (_item, index) => ({
    kind: "incoming",
    index: index + 1,
    x: index * spec.separation,
    y: 0
  }));
  const outgoing = Array.from({ length: spec.outgoing }, (_item, index) => ({
    kind: "outgoing",
    index: index + 1,
    x: (index + spec.offset) * spec.separation,
    y: -spec.height
  }));
  return {
    incoming,
    outgoing,
    height: spec.height,
    separation: spec.separation,
    offset: spec.offset,
    rx: spec.rx,
    ry: spec.ry
  };
}

function tqftBodyPath(local, spec) {
  const all = [...local.incoming, ...local.outgoing];
  if (!all.length) return [];
  if (!local.incoming.length || !local.outgoing.length) {
    const centers = local.incoming.length ? local.incoming : local.outgoing;
    const minX = Math.min(...centers.map((point) => point.x)) - spec.rx;
    const maxX = Math.max(...centers.map((point) => point.x)) + spec.rx;
    const y = centers[0].y;
    const bulge = spec.height * 0.42 * (local.incoming.length ? -1 : 1);
    return [
      { type: "moveTo", x: minX, y },
      { type: "curveTo", x1: minX, y1: y + bulge, x2: maxX, y2: y + bulge, x: maxX, y },
      { type: "curveTo", x1: maxX, y1: y - bulge * 0.35, x2: minX, y2: y - bulge * 0.35, x: minX, y },
      { type: "closePath" }
    ];
  }
  const minIn = Math.min(...local.incoming.map((point) => point.x)) - spec.rx;
  const maxIn = Math.max(...local.incoming.map((point) => point.x)) + spec.rx;
  const minOut = Math.min(...local.outgoing.map((point) => point.x)) - spec.rx;
  const maxOut = Math.max(...local.outgoing.map((point) => point.x)) + spec.rx;
  const topY = 0;
  const bottomY = -spec.height;
  const leftControl = Math.max(0.35, Math.abs(minOut - minIn) + 0.35) * spec.height / 2;
  const rightControl = Math.max(0.35, Math.abs(maxOut - maxIn) + 0.35) * spec.height / 2;
  return [
    { type: "moveTo", x: minIn, y: topY },
    { type: "curveTo", x1: minIn, y1: topY - leftControl, x2: minOut, y2: bottomY + leftControl, x: minOut, y: bottomY },
    { type: "moveTo", x: maxOut, y: bottomY },
    { type: "curveTo", x1: maxOut, y1: bottomY + rightControl, x2: maxIn, y2: topY - rightControl, x: maxIn, y: topY }
  ];
}

function tqftBoundaryPath(boundary, spec) {
  const side = spec.viewFrom === "incoming" ? "upper" : "lower";
  return halfEllipseToPath(boundary.x, boundary.y, spec.rx, spec.ry, side);
}

function halfEllipseToPath(cx, cy, rx, ry, side = "upper") {
  const k = 0.5522847498307936;
  if (side === "lower") {
    return [
      { type: "moveTo", x: cx - rx, y: cy },
      { type: "curveTo", x1: cx - rx, y1: cy - k * ry, x2: cx - k * rx, y2: cy - ry, x: cx, y: cy - ry },
      { type: "curveTo", x1: cx + k * rx, y1: cy - ry, x2: cx + rx, y2: cy - k * ry, x: cx + rx, y: cy }
    ];
  }
  return [
    { type: "moveTo", x: cx - rx, y: cy },
    { type: "curveTo", x1: cx - rx, y1: cy + k * ry, x2: cx - k * rx, y2: cy + ry, x: cx, y: cy + ry },
    { type: "curveTo", x1: cx + k * rx, y1: cy + ry, x2: cx + rx, y2: cy + k * ry, x: cx + rx, y: cy }
  ];
}

function tqftLocalAnchor(local, anchor) {
  const normalized = String(anchor || "none").trim();
  if (!normalized || normalized === "none") return { x: 0, y: 0 };
  const boundary = tqftBoundaryByName(local, normalized);
  if (boundary) return { x: boundary.x, y: boundary.y };
  const between = tqftBetweenAnchor(local, normalized);
  return between || { x: 0, y: 0 };
}

function tqftBoundaryByName(local, anchor) {
  const boundary = anchor.match(/^(incoming|outgoing) boundary(?:\s+(\d+))?$/);
  if (!boundary) return null;
  const list = boundary[1] === "incoming" ? local.incoming : local.outgoing;
  const index = boundary[2] ? Number(boundary[2]) : 1;
  return list[index - 1] || null;
}

function tqftBetweenAnchor(local, anchor) {
  const two = anchor.match(/^between\s+(incoming|outgoing)\s+(\d+)\s+and\s+(\d+)$/);
  if (two) {
    const list = two[1] === "incoming" ? local.incoming : local.outgoing;
    const first = list[Number(two[2]) - 1];
    const second = list[Number(two[3]) - 1];
    if (!first || !second) return null;
    return {
      x: (first.x + second.x) / 2,
      y: two[1] === "incoming" ? -local.height / 4 : -local.height * 3 / 4
    };
  }
  if (anchor === "between first incoming and first outgoing") return midpoint(local.incoming[0], local.outgoing[0]);
  if (anchor === "between last incoming and last outgoing") return midpoint(local.incoming.at(-1), local.outgoing.at(-1));
  if (anchor === "between first and last incoming" || anchor === "between first incoming and last incoming") {
    return midpoint(local.incoming[0], local.incoming.at(-1));
  }
  if (anchor === "between first and last outgoing" || anchor === "between first outgoing and last outgoing") {
    return midpoint(local.outgoing[0], local.outgoing.at(-1));
  }
  return null;
}

function midpoint(a, b) {
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function tqftTransformPoint(point, origin, anchor, rotate) {
  const rotated = rotateVector(point.x - anchor.x, point.y - anchor.y, rotate);
  return roundPoint({ x: origin.x + rotated.x, y: origin.y + rotated.y });
}

function tqftTransformCommands(commands, transform) {
  return commands.map((command) => {
    if (command.type === "closePath") return command;
    if (command.type === "moveTo" || command.type === "lineTo") {
      const point = transform(command);
      return { ...command, x: point.x, y: point.y };
    }
    if (command.type === "curveTo") {
      const p1 = transform({ x: command.x1, y: command.y1 });
      const p2 = transform({ x: command.x2, y: command.y2 });
      const p = transform({ x: command.x, y: command.y });
      return { ...command, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, x: p.x, y: p.y };
    }
    return command;
  });
}

function tqftPathStyle(spec, env) {
  const { style: rawStyle } = normalizeOptions("path", { draw: true, ...spec.options }, env);
  const style = scaleCanvasStyle(rawStyle, env);
  return {
    ...style,
    stroke: style.stroke && style.stroke !== "none" ? style.stroke : "black",
    fill: "none"
  };
}

function registerTqftCoordinates(name, local, spec, transform, env) {
  for (const boundary of [...local.incoming, ...local.outgoing]) {
    const base = `${name}-${boundary.kind} boundary ${boundary.index}`;
    const center = transform(boundary);
    registerTqftNode(base, center, boundary, spec, transform, env);
    if (boundary.index === 1) registerTqftNode(`${name}-${boundary.kind} boundary`, center, boundary, spec, transform, env);
  }
  registerTqftCoordinate(`${name}-between first incoming and first outgoing`, tqftBetweenAnchor(local, "between first incoming and first outgoing"), transform, env);
  registerTqftCoordinate(`${name}-between last incoming and last outgoing`, tqftBetweenAnchor(local, "between last incoming and last outgoing"), transform, env);
  registerTqftCoordinate(`${name}-between first and last incoming`, tqftBetweenAnchor(local, "between first and last incoming"), transform, env);
  registerTqftCoordinate(`${name}-between first incoming and last incoming`, tqftBetweenAnchor(local, "between first incoming and last incoming"), transform, env);
  registerTqftCoordinate(`${name}-between first and last outgoing`, tqftBetweenAnchor(local, "between first and last outgoing"), transform, env);
  registerTqftCoordinate(`${name}-between first outgoing and last outgoing`, tqftBetweenAnchor(local, "between first outgoing and last outgoing"), transform, env);
  for (let index = 1; index < local.incoming.length; index += 1) {
    registerTqftCoordinate(`${name}-between incoming ${index} and ${index + 1}`, tqftBetweenAnchor(local, `between incoming ${index} and ${index + 1}`), transform, env);
  }
  for (let index = 1; index < local.outgoing.length; index += 1) {
    registerTqftCoordinate(`${name}-between outgoing ${index} and ${index + 1}`, tqftBetweenAnchor(local, `between outgoing ${index} and ${index + 1}`), transform, env);
  }
  if (local.incoming.length || local.outgoing.length) {
    const all = [...local.incoming, ...local.outgoing];
    const xs = all.map((point) => point.x);
    const ys = all.map((point) => point.y);
    const center = transform({ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 });
    env.coordinates[name] = center;
    env.nodes[name] = { point: center, width: 0, height: 0, shape: "coordinate" };
  }
}

function registerTqftNode(name, center, boundary, spec, transform, env) {
  const east = transform({ x: boundary.x + spec.rx, y: boundary.y });
  const west = transform({ x: boundary.x - spec.rx, y: boundary.y });
  const north = transform({ x: boundary.x, y: boundary.y + spec.ry });
  const south = transform({ x: boundary.x, y: boundary.y - spec.ry });
  const width = Math.max(Math.abs(east.x - west.x), Math.abs(north.x - south.x), 0.01);
  const height = Math.max(Math.abs(east.y - west.y), Math.abs(north.y - south.y), 0.01);
  env.coordinates[name] = center;
  env.nodes[name] = {
    point: center,
    width: roundNumber(width),
    height: roundNumber(height),
    shape: "ellipse"
  };
}

function registerTqftCoordinate(name, point, transform, env) {
  if (!point) return;
  const global = transform(point);
  env.coordinates[name] = global;
  env.nodes[name] = { point: global, width: 0, height: 0, shape: "coordinate" };
}

function createAnglePic(statement, env, ir) {
  const body = String(statement.body || "").trim();
  const angleMatch = body.match(/^angle\s*=\s*([\s\S]+)$/);
  if (!angleMatch) return false;
  const parts = angleMatch[1].split(/\s*--\s*/).map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 3) return false;
  const [fromRaw, vertexRaw, toRaw] = parts;
  const from = resolveCoordinate(fromRaw, env, []);
  const vertex = resolveCoordinate(vertexRaw, env, []);
  const to = resolveCoordinate(toRaw, env, []);
  const fromAngle = Math.atan2(from.y - vertex.y, from.x - vertex.x);
  const toAngle = Math.atan2(to.y - vertex.y, to.x - vertex.x);
  let delta = toAngle - fromAngle;
  while (delta <= -Math.PI) delta += Math.PI * 2;
  while (delta > Math.PI) delta -= Math.PI * 2;
  const radius = parseDimension(statement.options?.["angle radius"] || "5mm", env.variables);
  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 0.5;
  const start = {
    x: vertex.x + Math.cos(fromAngle) * safeRadius,
    y: vertex.y + Math.sin(fromAngle) * safeRadius
  };
  const end = {
    x: vertex.x + Math.cos(fromAngle + delta) * safeRadius,
    y: vertex.y + Math.sin(fromAngle + delta) * safeRadius
  };
  const steps = Math.max(6, Math.ceil(Math.abs(delta) / (Math.PI / 18)));
  const commands = [{ type: "moveTo", x: roundNumber(start.x), y: roundNumber(start.y) }];
  for (let index = 1; index <= steps; index += 1) {
    const angle = fromAngle + (delta * index) / steps;
    commands.push({
      type: "lineTo",
      x: roundNumber(vertex.x + Math.cos(angle) * safeRadius),
      y: roundNumber(vertex.y + Math.sin(angle) * safeRadius)
    });
  }
  commands[commands.length - 1] = { type: "lineTo", x: roundNumber(end.x), y: roundNumber(end.y) };

  const { style: rawStyle } = normalizeOptions("path", statement.options || {}, env);
  const style = { ...scaleCanvasStyle(rawStyle, env), fill: "none" };
  ir.items.push({
    type: "path",
    subtype: "angle-pic",
    shape: "arc",
    style,
    commands
  });

  const quote = anglePicQuote(statement.options || {});
  if (quote) {
    const eccentricity = evaluateMath(statement.options?.["angle eccentricity"] ?? "0.65", env.variables);
    const labelRadius = safeRadius * (Number.isFinite(eccentricity) && eccentricity > 0 ? eccentricity : 0.65);
    const midAngle = fromAngle + delta / 2;
    const textColor = normalizeColor(statement.options?.text || rawStyle.stroke || "black");
    ir.items.push({
      type: "textNode",
      text: quote,
      x: roundNumber(vertex.x + Math.cos(midAngle) * labelRadius),
      y: roundNumber(vertex.y + Math.sin(midAngle) * labelRadius),
      style: {
        stroke: "none",
        fill: textColor,
        lineWidth: style.lineWidth,
        textFill: textColor,
        fontScale: roundNumber(env.canvasScale * fontScaleFromTikzFont(statement.options?.font ?? env.pictureOptions?.font)),
        fontSizeBaseScale: 1,
        fontFamily: resolveFontFamily(statement.options?.font || env.pictureOptions?.font)
      }
    });
  }
  return true;
}

function anglePicQuote(options = {}) {
  for (const [key, value] of Object.entries(options)) {
    if (value !== true) continue;
    const text = String(key).trim();
    if (text.length >= 2 && text.startsWith("\"") && text.endsWith("\"")) return text.slice(1, -1);
  }
  return "";
}

function picCubeBasis(env) {
  const basis = env.basis || parsePictureBasis();
  const z = basis.z || { x: 0, y: 0 };
  const hasZ = Math.abs(Number(z.x) || 0) > 1e-9 || Math.abs(Number(z.y) || 0) > 1e-9;
  return hasZ ? basis : { ...basis, z: PGF_DEFAULT_Z_VECTOR };
}

function parsePicCubeLineWidth(value, env) {
  const text = String(value || "").trim();
  if (!text) return NaN;
  const dimension = /[A-Za-z]/.test(text) ? text : `${text}mm`;
  const parsed = parseDimension(dimension, env.variables);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
}

function isInvisiblePicCube(options = {}) {
  return isZeroPercentColor(options.draw) && isZeroPercentColor(options.fill);
}

function isZeroPercentColor(value) {
  const text = String(value ?? "").trim();
  const parts = text.split("!").map((part) => part.trim()).filter(Boolean);
  return parts.length === 2 && Number(parts[1]) === 0;
}

function createSpy(statement, env, ir, diagnostics) {
  const onPoint = resolveCoordinate(statement.on, env, diagnostics);
  const spyOptions = spyScopeOptions(statement, env);
  const magnification = spyMagnification(spyOptions, env);
  const targetSize = spyTargetSize(spyOptions, env);
  const sourceSize = {
    width: roundNumber(targetSize.width / magnification),
    height: roundNumber(targetSize.height / magnification)
  };
  const atPoint = statement.at ? resolveCoordinate(statement.at, env, diagnostics) : onPoint;
  const inCenter = spyInNodeCenter(atPoint, statement.inOptions || {}, targetSize, env);
  const shape = nodeShape(spyOptions);
  const radius = Math.max(targetSize.width, targetSize.height) / 2;
  const sourceRadius = Math.max(sourceSize.width, sourceSize.height) / 2;
  const existingItems = [...ir.items];
  ir.items.push(...spyMagnifiedPathItems(existingItems, onPoint, inCenter, magnification, radius, shape));

  const connectionStyle = spyPathStyle({ thin: true, draw: true, ...statement.options }, env);
  if (tikzBoolean(spyOptions["connect spies"])) {
    const clipped = clipNodeLineEndpoints(
      onPoint,
      { node: { point: onPoint, width: sourceSize.width, height: sourceSize.height, shape }, mode: "center" },
      inCenter,
      { node: { point: inCenter, width: targetSize.width, height: targetSize.height, shape }, mode: "center" },
      env
    );
    ir.items.push({
      type: "path",
      subtype: "spy-connection",
      style: connectionStyle,
      commands: [
        { type: "moveTo", x: clipped.from.x, y: clipped.from.y },
        { type: "lineTo", x: clipped.to.x, y: clipped.to.y }
      ]
    });
  }

  ir.items.push(
    spyOutlineItem("spy-on", onPoint, sourceSize, shape, spyPathStyle({ "very thin": true, draw: true, ...statement.options }, env), env),
    spyOutlineItem("spy-in", inCenter, targetSize, shape, spyPathStyle({ thick: true, draw: true, ...statement.options }, env), env)
  );
}

function spyScopeOptions(statement, env) {
  const pictureOptions = env.pictureOptions || {};
  const rawScope = pictureOptions["spy using outlines"] ?? pictureOptions["spy using overlays"] ?? "";
  const scope = rawScope && rawScope !== true ? parseOptions(rawScope) : {};
  if (scope.size && !scope["minimum size"]) scope["minimum size"] = scope.size;
  if (scope.width && !scope["minimum width"]) scope["minimum width"] = scope.width;
  if (scope.height && !scope["minimum height"]) scope["minimum height"] = scope.height;
  return normalizeOptions("node", { circle: true, ...scope, ...(statement.inOptions || {}) }, env).options;
}

function spyMagnification(options = {}, env) {
  const raw = options.magnification ?? "1";
  const parsed = evaluateMath(raw, env.variables);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function spyTargetSize(options = {}, env) {
  const size = parseFiniteDimension(options.size ?? options["minimum size"], env, 1);
  const width = parseFiniteDimension(options.width ?? options["minimum width"], env, size);
  const height = parseFiniteDimension(options.height ?? options["minimum height"], env, size);
  return {
    width: roundNumber(width * env.canvasScale),
    height: roundNumber(height * env.canvasScale)
  };
}

function spyInNodeCenter(atPoint, options = {}, size = {}, env) {
  const offset = { x: 0, y: 0 };
  const direction = spyPlacementDirection(options);
  const distance = spyPlacementDistance(options, env);
  if (direction.includes("left")) offset.x -= (Number(size.width) || 0) / 2 + distance.x;
  if (direction.includes("right")) offset.x += (Number(size.width) || 0) / 2 + distance.x;
  if (direction.includes("below")) offset.y -= (Number(size.height) || 0) / 2 + distance.y;
  if (direction.includes("above")) offset.y += (Number(size.height) || 0) / 2 + distance.y;
  return roundPoint({ x: atPoint.x + offset.x, y: atPoint.y + offset.y });
}

function spyPlacementDirection(options = {}) {
  return Object.keys(options)
    .filter((key) => options[key] === true || options[key] === "")
    .join(" ")
    .toLowerCase();
}

function spyPlacementDistance(options = {}, env) {
  let x = 0;
  let y = 0;
  for (const [key, value] of Object.entries(options || {})) {
    const lower = key.toLowerCase();
    if (!/(?:left|right|above|below)/.test(lower)) continue;
    if (value === true || value === "") continue;
    const parsed = parseDimension(value, env.variables);
    if (!Number.isFinite(parsed)) continue;
    if (lower.includes("left") || lower.includes("right")) x = parsed;
    if (lower.includes("above") || lower.includes("below")) y = parsed;
  }
  return { x, y };
}

function spyPathStyle(options = {}, env) {
  return scaleCanvasStyle(normalizeOptions("draw", options, env).style, env);
}

function spyOutlineItem(subtype, center, size, shape, style, env) {
  if (shape === "circle" || shape === "circleCrossSplit") {
    const r = roundNumber(Math.max(size.width, size.height) / 2);
    return {
      type: "path",
      subtype,
      shape: "circle",
      cx: center.x,
      cy: center.y,
      r,
      style,
      commands: circleCommands(center, r, env)
    };
  }
  const width = Number(size.width) || 0;
  const height = Number(size.height) || 0;
  return {
    type: "path",
    subtype,
    shape: "rectangle",
    x: roundNumber(center.x - width / 2),
    y: roundNumber(center.y - height / 2),
    width,
    height,
    style,
    commands: rectangleCommands(center, width, height)
  };
}

function rectangleCommands(center, width, height) {
  const left = center.x - width / 2;
  const right = center.x + width / 2;
  const bottom = center.y - height / 2;
  const top = center.y + height / 2;
  return [
    { type: "moveTo", x: roundNumber(left), y: roundNumber(bottom) },
    { type: "lineTo", x: roundNumber(right), y: roundNumber(bottom) },
    { type: "lineTo", x: roundNumber(right), y: roundNumber(top) },
    { type: "lineTo", x: roundNumber(left), y: roundNumber(top) },
    { type: "closePath" }
  ];
}

function spyMagnifiedPathItems(items, onPoint, inCenter, magnification, radius, shape) {
  const magnified = [];
  for (const item of items) {
    if (item.type !== "path" || !Array.isArray(item.commands) || item.subtype?.startsWith?.("spy-")) continue;
    const points = flattenPath(item.commands, 0.035);
    for (let index = 1; index < points.length; index += 1) {
      const from = spyTransformPoint(points[index - 1], onPoint, inCenter, magnification);
      const to = spyTransformPoint(points[index], onPoint, inCenter, magnification);
      const clipped = shape === "circle" || shape === "circleCrossSplit" ? clipSegmentToCircle(from, to, inCenter, radius) : { from, to };
      if (!clipped) continue;
      magnified.push({
        type: "path",
        subtype: "spy-magnified",
        style: spyMagnifiedStyle(item.style || {}, magnification),
        commands: [
          { type: "moveTo", x: clipped.from.x, y: clipped.from.y },
          { type: "lineTo", x: clipped.to.x, y: clipped.to.y }
        ]
      });
    }
  }
  return magnified;
}

function spyTransformPoint(point, onPoint, inCenter, magnification) {
  return roundPoint({
    x: inCenter.x + (point.x - onPoint.x) * magnification,
    y: inCenter.y + (point.y - onPoint.y) * magnification
  });
}

function spyMagnifiedStyle(style, magnification) {
  const scaled = { ...style };
  if (Number.isFinite(Number(scaled.lineWidth))) scaled.lineWidth = roundNumber(Number(scaled.lineWidth) * magnification);
  delete scaled.markerStart;
  delete scaled.markerEnd;
  return scaled;
}

function clipSegmentToCircle(from, to, center, radius) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const fx = from.x - center.x;
  const fy = from.y - center.y;
  const a = dx * dx + dy * dy;
  if (a < 1e-12) return pointInsideCircle(from, center, radius) ? { from: roundPoint(from), to: roundPoint(to) } : null;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const discriminant = b * b - 4 * a * c;
  const values = [0, 1];
  if (discriminant >= -1e-12) {
    const root = Math.sqrt(Math.max(0, discriminant));
    values.push((-b - root) / (2 * a), (-b + root) / (2 * a));
  }
  const sorted = values
    .filter((value) => value >= -1e-9 && value <= 1 + 1e-9)
    .map((value) => Math.max(0, Math.min(1, value)))
    .sort((aValue, bValue) => aValue - bValue);
  for (let index = 1; index < sorted.length; index += 1) {
    const start = sorted[index - 1];
    const end = sorted[index];
    if (end - start < 1e-9) continue;
    const mid = (start + end) / 2;
    const midPoint = { x: from.x + dx * mid, y: from.y + dy * mid };
    if (!pointInsideCircle(midPoint, center, radius)) continue;
    return {
      from: roundPoint({ x: from.x + dx * start, y: from.y + dy * start }),
      to: roundPoint({ x: from.x + dx * end, y: from.y + dy * end })
    };
  }
  return null;
}

function pointInsideCircle(point, center, radius) {
  return Math.hypot(point.x - center.x, point.y - center.y) <= radius + 1e-9;
}

function applyNoopSideEffects(statement, env) {
  const raw = String(statement.raw || "").trim();
  const ctikz = raw.match(/^\\ctikzset\s*\{([\s\S]*)\}\s*$/);
  if (ctikz) {
    env.circuitikz = {
      ...(env.circuitikz || {}),
      ...normalizeCtikzSetOptions(parseOptions(ctikz[1]))
    };
    return;
  }
  const toggle = raw.match(/^\\toggle(true|false)\s*\{([^{}]+)\}/);
  if (!toggle) return;
  env.toggles ||= {};
  env.toggles[toggle[2].trim()] = toggle[1] === "true";
}

function applyFontSwitch(font, env) {
  const next = String(font || "").trim();
  if (!next) return;
  const current = String(env.pictureOptions?.font || "").trim();
  env.pictureOptions = {
    ...(env.pictureOptions || {}),
    font: [current, next].filter(Boolean).join(" ")
  };
}

function normalizeCtikzSetOptions(rawOptions = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(rawOptions || {})) {
    const normalizedKey = String(key).trim();
    const normalizedValue = value === true ? true : stripOuterBraces(String(value));
    const lowerKey = normalizedKey.toLowerCase();
    const lowerValue = String(normalizedValue).trim().toLowerCase();
    if (lowerKey === "quadpoles style" && lowerValue === "inline") {
      Object.assign(normalized, {
        "quadpoles/transformer/inner": "1",
        "quadpoles/transformer/width": "0.6",
        "quadpoles/transformer core/inner": "1",
        "quadpoles/transformer core/width": "0.6",
        "quadpoles/gyrator/inner": "1",
        "quadpoles/gyrator/width": "0.6"
      });
    }
    if (lowerKey === "cute inductors") normalized["inductors/kind"] = "cute";
    if (lowerKey === "american inductors") normalized["inductors/kind"] = "american";
    const styleMatch = normalizedKey.match(/^(?:circuitikz\/)?transformer\s+(L[12])\/\.style$/i);
    if (styleMatch) {
      const coil = styleMatch[1].toUpperCase();
      normalized[`transformer ${coil}`] = parseCtikzStyleValue(normalizedValue);
    }
    normalized[normalizedKey] = normalizedValue;
  }
  return normalized;
}

function picDefinitionsFromOptions(rawOptions = {}) {
  const pics = {};
  for (const [key, value] of Object.entries(rawOptions || {})) {
    const match = String(key).match(/^(.+?)\/\.pic$/);
    if (match) pics[match[1].trim()] = String(value === true ? "" : value).trim();
  }
  return pics;
}

// Claude: 读取节点自身的 rotate 选项（如 \node[rotate=90]{...}），转成角度。
// 用于把文字竖排/斜排，见 case 047 的 self-awareness / immunisation 标签。
function nodeRotation(options = {}, env) {
  const raw = options.rotate;
  if (raw === undefined || raw === true || raw === "") return 0;
  const angle = evaluateMath(raw, env.variables);
  return Number.isFinite(angle) ? angle : 0;
}

function addNodeItems(node, ir, env) {
  const nodeEnv = Number.isFinite(Number(node.canvasScale)) && Number(node.canvasScale) > 0
    ? { ...env, canvasScale: Number(node.canvasScale) }
    : nodeCanvasEnv(env, node.options || {});
  const { style: rawStyle, semantic } = normalizeOptions("node", node.options || {}, nodeEnv);
  const style = scaleCanvasStyle(rawStyle, nodeEnv);
  const rotation = node.rotation ?? nodeRotation(node.options || {}, nodeEnv);
  const point = node.displayPoint || resolveNodeAnchorPoint(node.at, node.options, node.text, nodeEnv, node.size);
  const shape = nodeShape(node.options || {});
  const shapeData = nodeShapeData(node.options || {}, nodeEnv);
  const size = node.size || scaleSize(estimateNodeLayoutSize(node.text, node.options, nodeEnv), nodeEnv.canvasScale);
  const shadingStyle = pathShadingStyle(style, semantic, nodeEnv);
  const shadedFill = shadingStyle.fill || null;
  const textStyle = {
    ...style,
    fill: style.textFill || semantic.text || "black",
    fontScale: roundNumber(nodeEnv.canvasScale * (node.textFontScale || nodeFontScale(node.options || {}, nodeEnv))),
    fontSizeBaseScale: roundNumber(nodeEnv.canvasScale * nodeOptionScale(node.options || {}, nodeEnv)),
    fontFamily: resolveFontFamily(node.text) || resolveFontFamily(node.options?.font || nodeEnv.pictureOptions?.font)
  };
  if (shape === "opAmp") {
    textStyle.fontScale = roundNumber((Number(textStyle.fontScale) || 1) * 0.75);
    textStyle.fontSizeBaseScale = roundNumber((Number(textStyle.fontSizeBaseScale) || 1) * 0.75);
  }
  const textPoint = shape === "opAmp"
    ? roundPoint({ x: point.x - size.width * 0.08, y: point.y - size.height * 0.02 })
    : shape === "circuitikzTransistor"
      ? circuitikzTransistorTextPoint(point, size, shapeData)
      : point;
  if (shape === "ground") {
    ir.items.push(circuitikzGroundItem(point, style, nodeEnv));
    return;
  }
  if (shape === "opAmp") {
    ir.items.push({
      type: "nodeBox",
      id: node.name,
      subtype: "circuitikz-op-amp",
      shape,
      shapeData,
      x: point.x,
      y: point.y,
      width: size.width,
      height: size.height,
      style: circuitikzOpAmpNodeStyle(style, nodeEnv)
    });
  } else if (shape === "circuitikzTransistor") {
    ir.items.push({
      type: "nodeBox",
      id: node.name,
      subtype: "circuitikz-transistor",
      shape,
      shapeData,
      x: point.x,
      y: point.y,
      width: size.width,
      height: size.height,
      style: circuitikzTransistorNodeStyle(style, nodeEnv)
    });
  } else if (shape === "circuitikzTriode") {
    ir.items.push({
      type: "nodeBox",
      id: node.name,
      subtype: "circuitikz-triode",
      shape,
      shapeData,
      x: point.x,
      y: point.y,
      width: size.width,
      height: size.height,
      style: circuitikzTransistorNodeStyle(style, nodeEnv)
    });
  } else if (shape === "circuitikzPentode" || shape === "circuitikzTetrode" || shape === "circuitikzDiodeTube") {
    const tubeKind = shapeData.tubeKind || (shape === "circuitikzPentode" ? "pentode" : shape === "circuitikzTetrode" ? "tetrode" : "diodetube");
    ir.items.push({
      type: "nodeBox",
      id: node.name,
      subtype: `circuitikz-${tubeKind}`,
      shape,
      shapeData: {
        ...shapeData,
        tubeKind,
        partialBorders: circuitikzTubePartialBorders(node.options || {}, nodeEnv)
      },
      x: point.x,
      y: point.y,
      width: size.width,
      height: size.height,
      style: circuitikzTubeNodeStyle(style, node.options || {}, nodeEnv)
    });
  } else if (shape === "circuitikzQuadpole") {
    const quadpoleKind = shapeData.quadpoleKind || "transformer";
    ir.items.push({
      type: "nodeBox",
      id: node.name,
      subtype: `circuitikz-quadpole-${quadpoleKind.replace(/\s+/g, "-")}`,
      shape,
      shapeData: {
        ...shapeData,
        quadpoleKind
      },
      x: point.x,
      y: point.y,
      width: size.width,
      height: size.height,
      style: circuitikzTransistorNodeStyle(style, nodeEnv)
    });
  } else if (style.fill !== "none" || style.stroke !== "none" || semantic.draw || shadedFill) {
    ir.items.push({
      type: "nodeBox",
      id: node.name,
      subtype: semanticSubtype({ ...node.options, ...semantic }),
      shape,
      shapeData,
      x: point.x,
      y: point.y,
      width: size.width,
      height: size.height,
      rx: nodeCornerRadius(shape, semantic, size),
      pathPicture: semantic["path picture"],
      bpmnIcon: semantic["bpmn icon"],
      bpmnMarker: semantic["bpmn marker"],
      tikzquadsKind: semantic["tikzquads kind"],
      tikzquadsOptions: tikzquadsNodeOptions(semantic),
      doubleColor: semantic.double === undefined ? undefined : semantic.double || "white",
      shadows: nodeGeneralShadows({ ...node.options, ...semantic }, nodeEnv),
      parts: shape === "rectangleSplit" ? rectangleSplitParts(semantic) : undefined,
      partFills: shape === "rectangleSplit" ? rectangleSplitPartFills(semantic) : undefined,
      rotation: rotation || undefined,
      style: {
        stroke: semantic.draw || style.stroke !== "none" ? style.stroke || "black" : "none",
        fill: shadedFill || style.fill,
        lineWidth: style.lineWidth || 1,
        dashArray: style.dashArray,
        opacity: style.opacity,
        fillOpacity: style.fillOpacity,
        strokeOpacity: style.strokeOpacity,
        pattern: style.pattern,
        patternColor: style.patternColor,
        shading: shadingStyle.shading,
        ballColor: shadingStyle.ballColor,
        topColor: shadingStyle.topColor,
        bottomColor: shadingStyle.bottomColor,
        shadingName: shadingStyle.shadingName,
        radialStops: shadingStyle.radialStops
      }
    });
  }
  ir.items.push({
    type: "textNode",
    x: textPoint.x,
    y: textPoint.y,
    text: node.text,
    style: textStyle,
    rotation: rotation || undefined,
    textAlign: normalizedNodeTextAlign(node.options?.align),
    wrapWidth: node.options?.["text width"] ? parseDimension(node.options["text width"], nodeEnv.variables) : undefined,
    fitBox: node.fitTextToBox ? { width: size.width, height: size.height } : undefined
  });
  for (const label of nodeLabels(node.options || {}, point, size, nodeEnv, textStyle)) {
    ir.items.push(label);
  }
  for (const pinItem of nodePins(node.options || {}, point, size, nodeEnv, textStyle)) {
    ir.items.push(pinItem);
  }
}

function normalizedNodeTextAlign(value) {
  const align = String(value || "").trim().toLowerCase();
  if (["left", "flush left", "ragged right", "raggedright"].includes(align)) return "left";
  if (["right", "flush right", "ragged left", "raggedleft"].includes(align)) return "right";
  if (["center", "centering", "centered"].includes(align)) return "center";
  return undefined;
}

function nodeGeneralShadows(semantic = {}, env) {
  const shadows = [];
  if (semantic["general shadow"] !== undefined) {
    shadows.push(...optionValueList(semantic["general shadow"]).map((value) => parseGeneralShadow(value, env)).filter(Boolean));
  }
  if (semantic["blur shadow"] !== undefined) {
    shadows.push(...optionValueList(semantic["blur shadow"]).map((value) => parseBlurShadow(value, env)).filter(Boolean));
  }
  return shadows.length ? shadows : undefined;
}

function parseGeneralShadow(value, env) {
  const shadowOptions = parseOptions(String(value === true ? "" : value));
  return parseShadowFromOptions(shadowOptions, env);
}

function parseBlurShadow(value, env) {
  const shadowOptions = {
    "shadow scale": 1,
    "shadow xshift": ".5ex",
    "shadow yshift": "-.5ex",
    "shadow blur radius": ".4ex",
    "shadow opacity": 40,
    ...parseOptions(String(value === true ? "" : value))
  };
  const shadow = parseShadowFromOptions(shadowOptions, env, { blur: true });
  if (!shadow) return null;
  const opacity = shadowOpacity(shadowOptions["shadow opacity"], 0.4, env);
  const fill = normalizeColor(shadowOptions["shadow color"] || "black", env);
  const blurRadius = parseDimension(shadowOptions["shadow blur radius"] || ".4ex", env.variables) * env.canvasScale;
  return {
    ...shadow,
    blur: true,
    blurRadius: Number.isFinite(blurRadius) && blurRadius > 0 ? roundNumber(blurRadius) : 0.06,
    style: {
      ...shadow.style,
      stroke: "none",
      fill,
      opacity
    }
  };
}

function parseShadowFromOptions(shadowOptions, env) {
  const xshift = parseDimension(shadowOptions["shadow xshift"] || "0", env.variables) * env.canvasScale;
  const yshift = parseDimension(shadowOptions["shadow yshift"] || "0", env.variables) * env.canvasScale;
  const scale = evaluateMath(shadowOptions["shadow scale"] || 1, env.variables);
  const { style: rawStyle, semantic } = normalizeOptions("node", shadowOptions, env);
  const style = scaleCanvasStyle(rawStyle, env);
  if (!Number.isFinite(xshift) || !Number.isFinite(yshift)) return null;
  return {
    xshift: roundNumber(xshift),
    yshift: roundNumber(yshift),
    scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
    style: {
      stroke: semantic.draw || style.stroke !== "none" ? style.stroke || "black" : "none",
      fill: style.fill,
      lineWidth: style.lineWidth || 1,
      dashArray: style.dashArray,
      opacity: style.opacity,
      fillOpacity: style.fillOpacity,
      strokeOpacity: style.strokeOpacity
    }
  };
}

function shadowOpacity(value, fallback, env) {
  const opacity = evaluateMath(value ?? fallback, env.variables);
  if (!Number.isFinite(opacity)) return fallback;
  if (opacity > 1) return Math.max(0, Math.min(1, opacity / 100));
  return Math.max(0, Math.min(1, opacity));
}

function nodeLabels(options = {}, point, size, env, textStyle = {}) {
  if (options.label === undefined || options.label === true || options.label === "") return [];
  const sep = parseDimension(options["label distance"] || "0pt", env.variables);
  const labels = [];
  for (const value of optionValueList(options.label)) {
    const label = parseNodeLabel(value);
    if (!label.text) continue;
    const labelSize = labelPlacementSize(label, env, options);
    const labelPoint = labelPointForDirection(label.direction, point, size, sep, labelSize);
    labels.push({
      type: "textNode",
      x: labelPoint.x,
      y: labelPoint.y,
      text: label.text,
      style: labelTextStyle(label, env, textStyle, options)
    });
  }
  return labels;
}

function nodePins(options = {}, point, size, env, textStyle = {}) {
  if (options.pin === undefined || options.pin === true || options.pin === "") return [];
  const items = [];
  for (const value of optionValueList(options.pin)) {
    const pin = parseNodeLabel(value);
    if (!pin.text) continue;
    const { options: normalizedPinOptions } = resolveLabelOptions(pin, env, options, "pin");
    const pinDistance = parseDimension(pin.options?.["pin distance"] ?? options["pin distance"] ?? "3ex", env.variables);
    const pinScale = nodeOptionScale(normalizedPinOptions, env);
    const sep = Number.isFinite(pinDistance) ? pinDistance * pinScale : parseDimension("3ex", env.variables) * pinScale;
    const labelSize = labelPlacementSize(pin, env, options, "pin");
    const labelPoint = labelPointForDirection(pin.direction, point, size, sep, labelSize);
    const edge = pinEdgePoints(pin.direction, point, size, labelPoint, labelSize);
    items.push({
      type: "path",
      subtype: "pin-edge",
      style: nodePinEdgeStyle(pin, env, options),
      commands: [
        { type: "moveTo", x: edge.from.x, y: edge.from.y },
        { type: "lineTo", x: edge.to.x, y: edge.to.y }
      ]
    });
    items.push({
      type: "textNode",
      x: labelPoint.x,
      y: labelPoint.y,
      text: pin.text,
      style: labelTextStyle(pin, env, textStyle, options, "pin")
    });
  }
  return items;
}

function nodePinEdgeStyle(pin, env, parentOptions = {}) {
  const rawOptions = { "help lines": true };
  Object.assign(rawOptions, parsePinEdgeOptions(parentOptions["pin edge"]));
  Object.assign(rawOptions, parsePinEdgeOptions(pin.options?.["pin edge"]));
  const { style: rawStyle } = normalizeOptions("draw", rawOptions, env);
  return {
    ...scaleCanvasStyle(rawStyle, env),
    fill: "none"
  };
}

function parsePinEdgeOptions(value) {
  if (value === undefined || value === null || value === true || value === "") return {};
  return parseOptions(String(value));
}

function optionValueList(value) {
  return Array.isArray(value) ? value : [value];
}

function resolveLabelOptions(label, env, parentOptions = {}, kind = "label") {
  const inheritedPathText =
    parentOptions["tikzkit inherited path text"] || (kind === "pin" ? parentOptions.text || parentOptions.color : undefined);
  const labelOptions = label.options || {};
  const pathTextOptions = inheritedPathText && !hasExplicitTextColor(labelOptions)
    ? { text: inheritedPathText }
    : {};
  return normalizeOptions("node", {
    ...inheritedNodeOptions(env),
    [kind === "pin" ? "every pin" : "every label"]: true,
    ...pathTextOptions,
    ...labelOptions
  }, env);
}

function labelPlacementSize(label, env, parentOptions = {}, kind = "label") {
  const { options: normalizedOptions } = resolveLabelOptions(label, env, parentOptions, kind);
  return estimateNodeAnchorSize(label.text, normalizedOptions, env, estimateNodeSize(label.text, normalizedOptions, env));
}

function labelTextStyle(label, env, fallbackStyle = {}, parentOptions = {}, kind = "label") {
  const { style: rawStyle, semantic, options: normalizedLabelOptions } = resolveLabelOptions(label, env, parentOptions, kind);
  const style = scaleCanvasStyle(rawStyle, env);
  return {
    ...style,
    fill: style.textFill || semantic.text || "black",
    fontScale: roundNumber(env.canvasScale * nodeFontScale(normalizedLabelOptions, env)),
    fontSizeBaseScale: roundNumber(env.canvasScale * nodeOptionScale(normalizedLabelOptions, env)),
    fontFamily: resolveFontFamily(label.text) || resolveFontFamily(normalizedLabelOptions.font || env.pictureOptions?.font) || fallbackStyle.fontFamily
  };
}

function addCoordinateLabels(options = {}, point, env, ir) {
  if (options.label === undefined || options.label === true || options.label === "") return;
  const expandedOptions = normalizeOptions("node", {
    ...inheritedNodeOptions(env),
    ...resolveDynamicOptions(options, env)
  }, env).options;
  const { style: rawStyle, semantic } = normalizeOptions("node", expandedOptions, env);
  const style = scaleCanvasStyle(rawStyle, env);
  const textStyle = {
    ...style,
    fill: style.textFill || semantic.text || "black",
    fontScale: roundNumber(env.canvasScale * nodeFontScale(expandedOptions, env)),
    fontSizeBaseScale: roundNumber(env.canvasScale * nodeOptionScale(expandedOptions, env)),
    fontFamily: resolveFontFamily(String(expandedOptions.label || "")) || resolveFontFamily(expandedOptions.font || env.pictureOptions?.font)
  };
  for (const label of nodeLabels(expandedOptions, point, { width: 0, height: 0 }, env, textStyle)) {
    ir.items.push(label);
  }
}

function parseNodeLabel(value) {
  let text = String(value || "").trim();
  text = text.replace(/^\{([\s\S]*)\}$/, "$1").trim();
  let options = {};
  if (text.startsWith("[")) {
    const parsedOptions = extractBalanced(text, 0, "[", "]");
    if (parsedOptions) {
      options = parseOptions(parsedOptions.content);
      text = text.slice(parsedOptions.end).trim();
    }
  }
  const colon = findLabelDirectionColon(text);
  if (colon === -1) return { direction: "above", text, options };
  return {
    direction: text.slice(0, colon).trim() || "above",
    text: text.slice(colon + 1).trim(),
    options
  };
}

function extractBalanced(text, start, open, close) {
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

function findLabelDirectionColon(text) {
  let brace = 0;
  let bracket = 0;
  let paren = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") brace += 1;
    if (char === "}") brace = Math.max(0, brace - 1);
    if (char === "[") bracket += 1;
    if (char === "]") bracket = Math.max(0, bracket - 1);
    if (char === "(") paren += 1;
    if (char === ")") paren = Math.max(0, paren - 1);
    if (char === ":" && brace === 0 && bracket === 0 && paren === 0) return index;
  }
  return -1;
}

function labelPointForDirection(direction, point, size, sep, labelSize = { width: 0, height: 0 }) {
  const normalized = String(direction || "above").toLowerCase().replace(/-/g, " ");
  const angle = /^[+\-*/().\d\s]+$/.test(normalized) ? evaluateMath(normalized, {}) : Number.NaN;
  if (Number.isFinite(angle)) {
    const radians = (angle * Math.PI) / 180;
    const radius = radialBoxExtent(size, radians) + radialBoxExtent(labelSize, radians) + sep;
    return roundPoint({
      x: point.x + Math.cos(radians) * radius,
      y: point.y + Math.sin(radians) * radius
    });
  }
  if (normalized === "center" || normalized === "centre") return roundPoint(point);
  let x = point.x;
  let y = point.y;
  const horizontalGap = (Number(size.width) || 0) / 2 + (Number(labelSize.width) || 0) / 2 + sep;
  const verticalGap = (Number(size.height) || 0) / 2 + (Number(labelSize.height) || 0) / 2 + sep;
  if (normalized.includes("right") || normalized.includes("east")) x += horizontalGap;
  if (normalized.includes("left") || normalized.includes("west")) x -= horizontalGap;
  if (normalized.includes("above") || normalized.includes("north")) y += verticalGap;
  if (normalized.includes("below") || normalized.includes("south")) y -= verticalGap;
  if (x === point.x && y === point.y) y += verticalGap;
  return roundPoint({ x, y });
}

function pinEdgePoints(direction, fromCenter, fromSize, toCenter, toSize) {
  const vector = pinDirectionVector(direction, fromCenter, toCenter);
  const length = Math.hypot(vector.x, vector.y);
  if (!Number.isFinite(length) || length <= 1e-9) {
    return { from: roundPoint(fromCenter), to: roundPoint(toCenter) };
  }
  const unit = { x: vector.x / length, y: vector.y / length };
  const radians = Math.atan2(unit.y, unit.x);
  const fromOffset = radialBoxExtent(fromSize, radians);
  const toOffset = radialBoxExtent(toSize, radians);
  return {
    from: roundPoint({
      x: fromCenter.x + unit.x * fromOffset,
      y: fromCenter.y + unit.y * fromOffset
    }),
    to: roundPoint({
      x: toCenter.x - unit.x * toOffset,
      y: toCenter.y - unit.y * toOffset
    })
  };
}

function pinDirectionVector(direction, fromCenter, toCenter) {
  const normalized = String(direction || "").toLowerCase().replace(/-/g, " ");
  const angle = /^[+\-*/().\d\s]+$/.test(normalized) ? evaluateMath(normalized, {}) : Number.NaN;
  if (Number.isFinite(angle)) {
    const radians = (angle * Math.PI) / 180;
    return { x: Math.cos(radians), y: Math.sin(radians) };
  }
  let x = 0;
  let y = 0;
  if (normalized.includes("right") || normalized.includes("east")) x += 1;
  if (normalized.includes("left") || normalized.includes("west")) x -= 1;
  if (normalized.includes("above") || normalized.includes("north")) y += 1;
  if (normalized.includes("below") || normalized.includes("south")) y -= 1;
  if (x || y) return { x, y };
  return {
    x: (Number(toCenter.x) || 0) - (Number(fromCenter.x) || 0),
    y: (Number(toCenter.y) || 0) - (Number(fromCenter.y) || 0)
  };
}

function radialBoxExtent(size = {}, radians = 0) {
  const halfWidth = (Number(size.width) || 0) / 2;
  const halfHeight = (Number(size.height) || 0) / 2;
  return Math.abs(Math.cos(radians)) * halfWidth + Math.abs(Math.sin(radians)) * halfHeight;
}

function resolveNodePoint(statement, env, diagnostics, selfSize) {
  if (statement.absolutePoint) return roundPoint(statement.absolutePoint);
  if (statement.at) {
    const point = resolveCoordinate(statement.at, env, diagnostics);
    const positioningOffset = resolveExplicitAtPositioningOffset(statement.options || {}, env, selfSize);
    if (!positioningOffset) return point;
    return roundPoint({
      x: point.x + positioningOffset.x,
      y: point.y + positioningOffset.y
    });
  }
  const chainPoint = resolveChainPosition(statement.options || {}, env, selfSize);
  if (chainPoint) return chainPoint;
  const positioning = resolvePositioning(statement.options || {}, env, selfSize);
  if (positioning) return positioning;
  return applyTransform({ x: 0, y: 0 }, env.transform);
}

function initialChains(pictureOptions = {}) {
  const chains = {};
  const parsed = parseStartChainSpec(pictureOptions["start chain"]);
  if (parsed) chains[parsed.name] = { direction: parsed.direction, last: null };
  return chains;
}

function initialActiveChain(pictureOptions = {}) {
  return parseStartChainSpec(pictureOptions["start chain"])?.name || null;
}

function parseStartChainSpec(value) {
  if (value === undefined || value === null || value === false) return null;
  const text = String(value === true ? "" : value).trim();
  if (!text) return { name: "default", direction: "right" };
  const match = text.match(/^(?:(.+?)\s+)?going\s+(.+)$/);
  if (match) {
    return {
      name: normalizeChainName(match[1] || "default"),
      direction: normalizeChainDirection(match[2])
    };
  }
  return { name: normalizeChainName(text), direction: "right" };
}

function chainNameFromOptions(options = {}, env = {}) {
  if (!Object.hasOwn(options, "on chain")) return null;
  const value = options["on chain"];
  if (value === false || value === null) return null;
  if (value === true || value === "") return env.activeChain || "default";
  return normalizeChainName(value);
}

function normalizeChainName(value) {
  return String(value ?? "default").trim() || "default";
}

function normalizeChainDirection(value) {
  return String(value || "right").trim().toLowerCase().replace(/-/g, " ") || "right";
}

function ensureChain(name, env) {
  env.chains ||= {};
  if (!env.chains[name]) env.chains[name] = { direction: "right", last: null, count: 0 };
  if (!Number.isFinite(Number(env.chains[name].count))) env.chains[name].count = 0;
  env.activeChain ||= name;
  return env.chains[name];
}

function resolveChainPosition(options = {}, env, selfSize = { width: 0, height: 0 }) {
  const name = chainNameFromOptions(options, env);
  if (!name) return null;
  const chain = ensureChain(name, env);
  if (!chain.last) return applyTransform({ x: 0, y: 0 }, env.transform);
  const distance = scalePositioningLibraryDistance(positioningLibraryDefaultDistance(env), env, positioningLibraryHelpers());
  const direction = chain.direction || "right";
  return roundPoint({
    x: chain.last.point.x + positioningLibraryDelta(direction, "x", distance, chain.last, selfSize),
    y: chain.last.point.y + positioningLibraryDelta(direction, "y", distance, chain.last, selfSize)
  });
}

function updateChainState(options = {}, env, point, size = { width: 0, height: 0 }, node = {}) {
  const name = chainNameFromOptions(options, env);
  if (!name) return null;
  const chain = ensureChain(name, env);
  const previous = chain.last ? { ...chain.last } : null;
  const count = (Number(chain.count) || 0) + 1;
  const alias = `${name}-${count}`;
  if (node.nodeRecord) registerNodeRecord(alias, node.nodeRecord, env);
  chain.count = count;
  chain.last = {
    point,
    width: Number(size?.width) || 0,
    height: Number(size?.height) || 0,
    name: alias,
    explicitName: node.name || null
  };
  return {
    chainName: name,
    previousName: previous?.name || previous?.explicitName || null,
    currentName: alias,
    previous,
    current: { ...chain.last }
  };
}

function addChainJoinPath(chainUpdate, options = {}, env, ir, diagnostics) {
  const join = parseChainJoinSpec(options.join);
  if (!join || !chainUpdate?.currentName) return;
  const fromName = join.from || chainUpdate.previousName;
  if (!fromName) return;
  const rawOptions = {
    "every join": true,
    ...parseOptions(join.style || "")
  };
  const normalized = normalizeOptions("draw", rawOptions, env);
  const style = scaleCanvasStyle(normalized.style, env);
  const { semantic, options: pathOptionsOnly } = normalized;
  const pathOptions = { ...pathOptionsOnly, ...semantic };
  const built = buildPath(
    [
      { kind: "coordinate", raw: fromName },
      { kind: "operator", value: "--", options: {} },
      { kind: "coordinate", raw: chainUpdate.currentName }
    ],
    env,
    diagnostics,
    pathOptions,
    style
  );
  const visible = isVisiblePath("draw", style, semantic, built.styleHints);
  if (!visible) return;
  for (const shape of built.shapes || []) {
    ir.items.push({ ...shape, style: { ...style, ...(shape.style || {}) } });
  }
  if (hasDrawableCommands(built.commands, built.shapes)) {
    const pathStyle = drawablePathStyle(style, built.styleHints);
    const item = {
      type: "path",
      subtype: semanticSubtype(pathOptions),
      style: pathStyle,
      commands: applyArrowEndpointShortening(built.commands, pathStyle, built.endpointRefs)
    };
    ir.items.push(item);
    addDecorationMarkers(item, pathOptionsOnly, ir);
  }
  for (const node of built.nodes || []) {
    addNodeItems(node, ir, env);
  }
}

function parseChainJoinSpec(value) {
  if (value === undefined || value === null || value === false) return null;
  const text = String(value === true ? "" : value).trim();
  if (!text) return { style: "" };
  const withMatch = text.match(/^with\s+(.+?)(?:\s+by\s+([\s\S]*))?$/);
  if (withMatch) {
    return {
      from: stripOuterBraces(withMatch[1].trim()),
      style: (withMatch[2] || "").trim()
    };
  }
  const byMatch = text.match(/^by(?:\s+([\s\S]*))?$/);
  if (byMatch) return { style: (byMatch[1] || "").trim() };
  return { style: text };
}

function resolvePositioning(options, env, selfSize = { width: 0, height: 0 }) {
  return resolvePositioningPoint(options, env, selfSize, positioningLibraryHelpers());
}

function resolveExplicitAtPositioningOffset(options, env, selfSize = { width: 0, height: 0 }) {
  return resolveExplicitAtPositioningOffsetPoint(options, env, selfSize, positioningLibraryHelpers());
}

function positioningLibraryHelpers() {
  return {
    canvasLengthScale,
    resolveDynamicName,
    resolveAnchoredNodeCoordinate,
    resolveCoordinate
  };
}

function resolveNodeAnchorPoint(point, options = {}, text = "", env = { variables: {} }, sizeOverride = null) {
  const size = sizeOverride || estimateNodeLayoutSize(text, options, env);
  const sep = parseNodeLengthDimension(options["inner sep"] ?? options["outer sep"] ?? "0.08cm", env);
  const shift = nodeAnchorShift(options, size, sep, env, nodeRotation(options, env));
  const explicitShift = nodeExplicitShift(options, env);
  return roundPoint({
    x: point.x + shift.x + explicitShift.x,
    y: point.y + shift.y + explicitShift.y
  });
}

// Claude: 把向量按角度(度, 数学坐标系逆时针为正)旋转。
function rotateVector(x, y, degrees) {
  if (!degrees) return { x, y };
  const r = (degrees * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function nodeAnchorShift(options = {}, size, sep, env, rotation = 0) {
  const direction = nodeDirection(options);
  const scaledSep = sep * canvasLengthScale(env);
  if (direction) {
    const distance =
      nodeDirectionDistance(options[direction], sep, env) *
      nodeDirectionSingleDistanceScale(direction, options[direction]) *
      canvasLengthScale(env);
    // Claude: above=d 等价于 anchor=south + 沿页面方向移动 d。把它拆成两部分：
    //   ① gap：间距 d，沿页面方向（不随节点旋转）；
    //   ② anchor→center 的半尺寸偏移：随节点 rotate 一起旋转。
    // 否则 \node[above=1em,rotate=90]{...} 的文字会以锚点为中心、旋转后压在路径线上（见 case 047）。
    // rotation=0 时与原公式逐项相同，保持向后兼容。
    const gapX = direction.includes("right") ? distance : direction.includes("left") ? -distance : 0;
    const gapY = direction.includes("above") ? distance : direction.includes("below") ? -distance : 0;
    if (explicitAnchorOverridesDirection(options, direction)) {
      const explicit = explicitNodeAnchorShift(options, size, env, rotation);
      return { x: gapX + explicit.x, y: gapY + explicit.y };
    }
    const anchorX = direction.includes("right") ? size.width / 2 : direction.includes("left") ? -size.width / 2 : 0;
    const anchorY = direction.includes("above") ? size.height / 2 : direction.includes("below") ? -size.height / 2 : 0;
    const rotated = rotateVector(anchorX, anchorY, rotation);
    return { x: gapX + rotated.x, y: gapY + rotated.y };
  }

  return explicitNodeAnchorShift(options, size, env, rotation);
}

function explicitAnchorOverridesDirection(options = {}, direction) {
  if (!options.anchor) return false;
  const keys = Object.keys(options);
  return keys.indexOf("anchor") > keys.indexOf(direction);
}

function explicitNodeAnchorShift(options = {}, size, env, rotation = 0) {
  const anchor = String(options.anchor || "").trim();
  if (!anchor) return { x: 0, y: 0 };
  const customAnchor = customNodeLocalAnchor(nodeShape(options), anchor, { ...size, shapeData: nodeShapeData(options, env) });
  if (customAnchor) {
    const rotated = rotateVector(customAnchor.x, customAnchor.y, rotation);
    return { x: -rotated.x, y: -rotated.y };
  }
  const outerSep = nodeOuterSep(options, env);
  const scaledOuterX = outerSep.x * canvasLengthScale(env);
  const scaledOuterY = outerSep.y * canvasLengthScale(env);
  const local = {
    x: anchor.includes("east") ? size.width / 2 + scaledOuterX : anchor.includes("west") ? -(size.width / 2 + scaledOuterX) : 0,
    y: anchor.includes("north") ? size.height / 2 + scaledOuterY : anchor.includes("south") ? -(size.height / 2 + scaledOuterY) : 0
  };
  const rotated = rotateVector(local.x, local.y, rotation);
  return { x: -rotated.x, y: -rotated.y };
}

function nodeDirection(options = {}) {
  const directions = ["above right", "above left", "below right", "below left", "right", "left", "above", "below"];
  return directions.find((direction) => {
    if (!Object.hasOwn(options, direction)) return false;
    const value = options[direction];
    return value === true || !String(value).includes("of");
  });
}

function nodeDirectionDistance(value, fallback, env) {
  if (value === true || value === undefined || value === null || value === "") return 0;
  const parsed = parseDimension(normalizeNodeDirectionDistance(value), env.variables);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nodeDirectionSingleDistanceScale(direction, value) {
  const diagonal =
    (String(direction).includes("right") || String(direction).includes("left")) &&
    (String(direction).includes("above") || String(direction).includes("below"));
  if (!diagonal) return 1;
  if (/\band\b/.test(String(value || ""))) return 1;
  return Math.SQRT1_2;
}

function normalizeNodeDirectionDistance(value) {
  const text = String(value).trim();
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return `${text}pt`;
  return text;
}

function nodeExplicitShift(options = {}, env) {
  let x = options.xshift ? parseDimension(options.xshift, env.variables) : 0;
  let y = options.yshift ? parseDimension(options.yshift, env.variables) : 0;
  if (options.shift) {
    const shifted = parseShift(options.shift, env);
    x += shifted.x;
    y += shifted.y;
  }
  return { x, y };
}

function resolveDynamicName(name, env) {
  return substituteTextVariables(String(name || "").trim(), env.variables).trim();
}

function resolveDynamicOptions(options = {}, env) {
  const resolved = {};
  for (const [key, value] of Object.entries(options || {})) {
    const resolvedKey = substituteTextVariables(String(key), env.variables).trim();
    const resolvedValue = typeof value === "string" ? substituteTextVariables(value, env.variables) : value;
    resolved[resolvedKey] = resolvedValue;
  }
  return resolved;
}

function defaultPathNodeReference(raw, env) {
  let text = substituteTextVariables(String(raw || "").trim(), env.variables);
  text = text.replace(/^\{([\s\S]*)\}$/, "$1").trim();
  if (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1).trim();
  const shifted = parseCoordinateOptionPrefix(text, env);
  if (shifted) text = shifted.coordinate;
  if (!text || text.startsWith("$") || text.includes(",")) return null;
  const anchored = text.match(/^(.+)\.([^.]+)$/);
  if (anchored) {
    const name = resolveDynamicName(anchored[1], env);
    const node = env.nodes[name];
    return node ? { name, node, mode: "anchor", anchor: anchored[2].trim() } : null;
  }
  const name = resolveDynamicName(text, env);
  const node = env.nodes[name];
  return node ? { name, node, mode: "center" } : null;
}

function clipNodeLineEndpoints(from, fromRef, to, toRef, env) {
  return {
    from: fromRef ? clipNodeReferencePoint(fromRef, from, to, env) : roundPoint(from),
    to: toRef ? clipNodeReferencePoint(toRef, to, from, env) : roundPoint(to)
  };
}

function clipNodeReferencePoint(ref, point, toward, env) {
  if (ref.mode === "anchor") return roundPoint(point);
  return nodeBorderPoint(ref.node, point, toward, env);
}

// Claude: 曲线边的端点应落在"离开/进入"切线方向上的边框点，而不是两节点中心连线上的点。
// out = 从起点离开的角度；in = 进入终点的切线角度（指向控制点 c2 的方向），与控制点计算保持一致。
function clipNodeCurveEndpoints(from, fromRef, to, toRef, curve, env) {
  return {
    from: fromRef ? clipNodeReferenceAlongAngle(fromRef, from, curve.out, env) : roundPoint(from),
    to: toRef ? clipNodeReferenceAlongAngle(toRef, to, curve.in, env) : roundPoint(to)
  };
}

function clipNodeReferenceAlongAngle(ref, center, angleDegrees, env) {
  if (ref.mode === "anchor") return roundPoint(center);
  const radians = (angleDegrees * Math.PI) / 180;
  const toward = { x: center.x + Math.cos(radians), y: center.y + Math.sin(radians) };
  return nodeBorderPoint(ref.node, center, toward, env);
}

function updateCurrentMoveTo(commands, point) {
  const command = commands.at(-1);
  if (command?.type === "moveTo") {
    command.x = point.x;
    command.y = point.y;
  }
}

function moveToNodeExit(commands, point) {
  const command = commands.at(-1);
  if (command?.type === "moveTo") {
    updateCurrentMoveTo(commands, point);
    return;
  }
  commands.push({ type: "moveTo", x: point.x, y: point.y });
}

function shouldBreakAtNodeExit(ref) {
  return Boolean(ref && ref.mode !== "anchor");
}

function edgePathOptions(options = {}) {
  const picked = {};
  if (Object.hasOwn(options, "decorate")) picked.decorate = options.decorate;
  if (Object.hasOwn(options, "decoration")) picked.decoration = options.decoration;
  return picked;
}

function loopDirectionFromOptions(options = {}) {
  for (const direction of ["above", "below", "left", "right"]) {
    if (Object.hasOwn(options, `loop ${direction}`)) return direction;
  }
  if (Object.hasOwn(options, "loop")) return "above";
  return null;
}

const PGF_LOOP_SPECS = {
  above: { out: 105, in: 75 },
  right: { out: 15, in: -15 },
  left: { out: 195, in: 165 },
  below: { out: 285, in: 255 }
};

function buildSelfLoop(point, nodeRef, direction, options, env) {
  const node = nodeRef?.node || null;
  const spec = PGF_LOOP_SPECS[direction] || PGF_LOOP_SPECS.above;
  const out = parseAngleOption(options.out, spec.out, env);
  const inAngle = parseAngleOption(options.in, spec.in, env);
  const start = node ? nodeAnchorCoordinate(node, out) : roundPoint(point);
  const end = node ? nodeAnchorCoordinate(node, inAngle) : roundPoint(point);
  const looseness = parseLoosenessOption(options.looseness, 8, env);
  const explicitDistance = explicitLoopDistance(options, env);
  const minDistance = explicitDistance ?? parseLoopMinDistance(options["min distance"], env);
  const chord = Math.hypot(end.x - start.x, end.y - start.y);
  const distance = explicitDistance ?? Math.max(chord * 0.3915 * looseness, minDistance);
  const c1 = polarOffset(start, out, distance);
  const c2 = polarOffset(end, inAngle, distance);
  return {
    start,
    end,
    labelPoint: cubicPointAt(start, c1, c2, end, 0.5),
    commands: [{ type: "curveTo", x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y, x: end.x, y: end.y }]
  };
}

function explicitLoopDistance(options, env) {
  const raw = options.distance ?? options["min distance"];
  if (raw === undefined || raw === null || raw === true || raw === "") return null;
  const distance = parseDimension(raw, env.variables) * canvasLengthScale(env);
  return Number.isFinite(distance) && distance >= 0 ? distance : null;
}

function parseLoopMinDistance(value, env) {
  const raw = value === undefined || value === null || value === true || value === "" ? "5mm" : value;
  const distance = parseDimension(raw, env.variables) * canvasLengthScale(env);
  return Number.isFinite(distance) && distance >= 0 ? distance : parseDimension("5mm", env.variables) * canvasLengthScale(env);
}

function edgeCurveSpec(options = {}, from, to, env, fromRef = null, toRef = null) {
  const looseness = parseLoosenessOption(options.looseness, 1, env);
  const outLooseness = parseLoosenessOption(options["out looseness"], looseness, env);
  const inLooseness = parseLoosenessOption(options["in looseness"], looseness, env);
  if (Object.hasOwn(options, "out") || Object.hasOwn(options, "in")) {
    return {
      out: parseAngleOption(options.out, 0, env),
      in: parseAngleOption(options.in, 180, env),
      outLooseness,
      inLooseness
    };
  }
  if (Object.hasOwn(options, "bend left")) return bendCurveSpec(options["bend left"], 1, from, to, env, { outLooseness, inLooseness });
  if (Object.hasOwn(options, "bend right")) return bendCurveSpec(options["bend right"], -1, from, to, env, { outLooseness, inLooseness });
  if (Object.hasOwn(options, "looseness")) return sameNodeAnchorLoosenessCurveSpec(fromRef, toRef, from, to, { outLooseness, inLooseness });
  return null;
}

function sameNodeAnchorLoosenessCurveSpec(fromRef, toRef, from, to, looseness = { outLooseness: 1, inLooseness: 1 }) {
  if (!fromRef || !toRef || fromRef.mode !== "anchor" || toRef.mode !== "anchor" || fromRef.name !== toRef.name) return null;
  // TikZ's plain `to[looseness=...]` curve keeps the default to-path
  // directions, even when both endpoints are explicit anchors on the same node.
  // Case 026 depends on this for the three flower-petal self loops.
  return {
    out: 45,
    in: 135,
    outLooseness: looseness.outLooseness,
    inLooseness: looseness.inLooseness
  };
}

function cubicLabelGeometry(from, c1, c2, to) {
  const point = cubicPointAt(from, c1, c2, to, 0.5);
  const tangent = cubicTangentAt(from, c1, c2, to, 0.5);
  return {
    point: roundPoint(point),
    segment: {
      from: roundPoint({ x: point.x - tangent.x / 2, y: point.y - tangent.y / 2 }),
      to: roundPoint({ x: point.x + tangent.x / 2, y: point.y + tangent.y / 2 })
    }
  };
}

function cubicPointAt(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
    y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y
  };
}

function cubicTangentAt(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const x = 3 * mt * mt * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x);
  const y = 3 * mt * mt * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y);
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function bendCurveSpec(value, direction, from, to, env, looseness = { outLooseness: 1, inLooseness: 1 }) {
  const angle = parseAngleOption(value, 30, env);
  const base = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  return {
    out: base + direction * angle,
    in: base + 180 - direction * angle,
    outLooseness: looseness.outLooseness,
    inLooseness: looseness.inLooseness
  };
}

function parseAngleOption(value, fallback, env) {
  if (value === true || value === undefined || value === null || value === "") return fallback;
  const angle = evaluateMath(value, env.variables);
  return Number.isFinite(angle) ? angle : fallback;
}

function parseLoosenessOption(value, fallback, env) {
  if (value === true || value === undefined || value === null || value === "") return fallback;
  const looseness = evaluateMath(value, env.variables);
  return Number.isFinite(looseness) && looseness > 0 ? looseness : fallback;
}

function tikzCurveControlDistance(from, to) {
  const chord = Math.hypot(to.x - from.x, to.y - from.y);
  return (chord || 1) * 0.3915;
}

function applyArrowEndpointShortening(commands, style = {}, endpointRefs = {}) {
  if (!commands.length || (!style.markerStart && !style.markerEnd)) return commands;
  if (!endpointRefs.start && !endpointRefs.end) return commands;
  return commands;
}

function pointsAlmostEqual(a, b, epsilon = 1e-9) {
  return Boolean(a && b && Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon);
}

function nodeBorderPoint(node, center, toward, env) {
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-12) return roundPoint(center);
  const halfWidth = (Number(node.layoutWidth) || Number(node.width) || 0) / 2;
  const halfHeight = (Number(node.layoutHeight) || Number(node.height) || 0) / 2;
  if (halfWidth <= 0 || halfHeight <= 0) return roundPoint(center);
  if (node.shape === "circle" || node.shape === "circleCrossSplit") {
    const radius = Math.max(halfWidth, halfHeight);
    return roundPoint({ x: center.x + (dx / distance) * radius, y: center.y + (dy / distance) * radius });
  }
  if (node.shape === "ellipse") {
    const factor = 1 / Math.sqrt((dx * dx) / (halfWidth * halfWidth) + (dy * dy) / (halfHeight * halfHeight));
    return roundPoint({ x: center.x + dx * factor, y: center.y + dy * factor });
  }
  if (node.shape === "diamond") {
    const factor = distance / (Math.abs(dx) / halfWidth + Math.abs(dy) / halfHeight);
    return roundPoint({ x: center.x + (dx / distance) * factor, y: center.y + (dy / distance) * factor });
  }
  if (node.shape === "cloud") {
    const factor = 1 / Math.sqrt((dx * dx) / (halfWidth * halfWidth) + (dy * dy) / (halfHeight * halfHeight));
    return roundPoint({ x: center.x + dx * factor, y: center.y + dy * factor });
  }
  if (polygonNodeShape(node.shape)) {
    return polygonBorderPoint(center, toward, nodePolygonPoints(node, center, halfWidth, halfHeight));
  }
  const xScale = Math.abs(dx) > 1e-12 ? halfWidth / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const yScale = Math.abs(dy) > 1e-12 ? halfHeight / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const factor = Math.min(xScale, yScale);
  if (!Number.isFinite(factor)) return roundPoint(center);
  return roundPoint({ x: center.x + dx * factor, y: center.y + dy * factor });
}

function nodeShape(options = {}) {
  const shape = normalizeShapeName(options.shape);
  const tubeKind = circuitikzTubeKind(options);
  const quadpoleKind = circuitikzQuadpoleKind(options);
  if (options["op amp"] || shape === "op amp" || shape === "opamp") return "opAmp";
  if (options.ground || shape === "ground") return "ground";
  if (circuitikzTransistorKind(options)) return "circuitikzTransistor";
  if (tubeKind) return circuitikzTubeShape(tubeKind);
  if (quadpoleKind) return "circuitikzQuadpole";
  if (shape === "tikzquads quad") return "tikzquadsQuad";
  if (shape === "tikzquads black box") return "tikzquadsBlackBox";
  if (shape === "tikzquads pg load line") return "tikzquadsPgLoadLine";
  if (options["rectangle split"]) return "rectangleSplit";
  if (options["single arrow"] || shape === "single arrow") return "singleArrow";
  if (options["double arrow"] || shape === "double arrow") return "doubleArrow";
  if (options.circle || shape === "circle") return "circle";
  if (options["circle cross split"] || shape === "circle cross split") return "circleCrossSplit";
  if (options.ellipse || shape === "ellipse") return "ellipse";
  if (options.diamond || shape === "diamond") return "diamond";
  if (options["rounded rectangle"] || shape === "rounded rectangle" || shape === "rectangle with rounded corners") return "roundedRectangle";
  if (options.superellipse || shape === "superellipse") return "superellipse";
  if (options["regular polygon"] || shape === "regular polygon") return "regularPolygon";
  if (options.star || shape === "star") return "star";
  if (options.trapezium || shape === "trapezium") return "trapezium";
  if (options["isosceles triangle"] || shape === "isosceles triangle") return "isoscelesTriangle";
  if (options.cloud || shape === "cloud") return "cloud";
  return "rectangle";
}

function nodeShapeData(options = {}, env = {}) {
  return {
    transistorKind: circuitikzTransistorKind(options),
    tubeKind: circuitikzTubeKind(options),
    quadpoleKind: circuitikzQuadpoleKind(options),
    quadpoleSettings: circuitikzQuadpoleKind(options) ? circuitikzQuadpoleSettings(options, env) : null,
    transistorXScale: Math.sign(numberOption(options.xscale, 1)) || 1,
    transistorYScale: Math.sign(numberOption(options.yscale, 1)) || 1,
    opAmpNoInvInputUp: Boolean(options["noinv input up"]),
    regularPolygonSides: Math.max(3, Math.round(numberOption(options["regular polygon sides"], 5))),
    starPoints: Math.max(3, Math.round(numberOption(options["star points"], 5))),
    starPointRatio: Math.max(1.05, numberOption(options["star point ratio"], 1.5)),
    trapeziumLeftAngle: numberOption(options["trapezium left angle"] ?? options["trapezium angle"], 60),
    trapeziumRightAngle: numberOption(options["trapezium right angle"] ?? options["trapezium angle"], 60),
    isoscelesTriangleApexAngle: numberOption(options["isosceles triangle apex angle"], 45),
    arrowTipAngle: numberOption(options["single arrow tip angle"] ?? options["double arrow tip angle"], 90),
    arrowHeadExtend: parseFiniteDimension(options["single arrow head extend"] ?? options["double arrow head extend"], env, 0.25),
    arrowHeadIndent: parseFiniteDimension(options["single arrow head indent"] ?? options["double arrow head indent"], env, 0),
    shapeBorderRotate: numberOption(options["shape border rotate"], 0)
  };
}

function circuitikzTransistorKind(options = {}) {
  const shape = normalizeShapeName(options.shape);
  if (options.npn || shape === "npn") return "npn";
  if (options.pnp || shape === "pnp") return "pnp";
  return null;
}

function tikzquadsNodeOptions(semantic = {}) {
  const keys = [
    "Z11",
    "Z12",
    "Z21",
    "Z22",
    "Y11",
    "Y12",
    "Y21",
    "Y22",
    "G11",
    "G12",
    "G21",
    "G22",
    "H11",
    "H12",
    "H21",
    "H22",
    "I1",
    "I2",
    "V1",
    "V2",
    "In",
    "Yn",
    "Vth",
    "Zth",
    "x axis",
    "y axis",
    "x val",
    "y val",
    "label top left",
    "label top center",
    "label top right",
    "label inner top left",
    "label inner top center",
    "label inner top right",
    "label bottom left",
    "label bottom center",
    "label bottom right",
    "label inner bottom left",
    "label inner bottom center",
    "label inner bottom right"
  ];
  const result = {};
  for (const key of keys) {
    if (semantic[key] !== undefined) result[key] = semantic[key];
  }
  return result;
}

function normalizeShapeName(value) {
  return String(value || "").trim().toLowerCase().replace(/-/g, " ");
}

function numberOption(value, fallback) {
  if (value === undefined || value === null || value === true || value === "") return fallback;
  const parsed = evaluateMath(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nodeCornerRadius(shape, semantic, size) {
  if (shape === "roundedRectangle") return roundNumber(Math.min(size.width, size.height) * 0.5);
  if (shape === "superellipse") return roundNumber(Math.min(size.width, size.height) * 0.28);
  if (semantic["rounded corners"]) return 0.08;
  return 0;
}

function resolveFontFamily(raw) {
  const text = String(raw || "").trim();
  if (!text) return undefined;
  if (/\\(?:tt|ttfamily|texttt)\b|monospace/i.test(text)) {
    return TIKZ_MONOSPACE_FONT_FAMILY;
  }
  if (/\\(?:sf|sffamily|textsf)\b|sans/i.test(text)) {
    return TIKZ_SANS_SERIF_FONT_FAMILY;
  }
  if (/\\(?:rm|rmfamily|textrm)\b|serif/i.test(text)) {
    return TIKZ_FONT_FAMILY;
  }
  return undefined;
}

function rectangleSplitParts(semantic = {}) {
  const parts = Number(semantic["rectangle split parts"] || 1);
  return Number.isFinite(parts) && parts > 0 ? Math.round(parts) : 1;
}

function rectangleSplitPartFills(semantic = {}) {
  if (!semantic["rectangle split part fill"]) return [];
  return splitTopLevel(String(semantic["rectangle split part fill"])).map((color) => normalizeColor(color));
}

function rectangleSplitHorizontalMinPartWidth(env = { variables: {} }) {
  return parseDimension("1.14em", env.variables);
}

function roundedRectangleTextExtraXSep(env = { variables: {} }) {
  return parseDimension("0.54em", env.variables);
}

function splitMatrixRows(body) {
  const rows = [];
  let current = "";
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char === "(") paren += 1;
    if (char === ")") paren = Math.max(0, paren - 1);
    if (char === "[") bracket += 1;
    if (char === "]") bracket = Math.max(0, bracket - 1);
    if (char === "{") brace += 1;
    if (char === "}") brace = Math.max(0, brace - 1);
    if (char === "\\" && body[index + 1] === "\\" && paren === 0 && bracket === 0 && brace === 0) {
      if (current.trim()) rows.push(current.trim());
      current = "";
      index += 1;
      continue;
    }
    current += char;
  }
  if (current.trim()) rows.push(current.trim());
  return rows;
}

function splitMatrixCells(row) {
  const cells = [];
  let current = "";
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    if (char === "(") paren += 1;
    if (char === ")") paren = Math.max(0, paren - 1);
    if (char === "[") bracket += 1;
    if (char === "]") bracket = Math.max(0, bracket - 1);
    if (char === "{") brace += 1;
    if (char === "}") brace = Math.max(0, brace - 1);

    if (char === "\\" && row[index + 1] === "&" && paren === 0 && bracket === 0 && brace === 0) {
      cells.push(current.trim());
      current = "";
      index += 1;
      continue;
    }

    if (char === "&" && paren === 0 && bracket === 0 && brace === 0) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseMatrixCell(raw) {
  let text = String(raw).trim();
  let options = {};
  const optionMatch = text.match(/^\|\s*\[([\s\S]*?)\]\s*\|\s*([\s\S]*)$/);
  if (optionMatch) {
    options = parseOptions(optionMatch[1]);
    text = optionMatch[2].trim();
  }
  const nodeMatch = text.match(/^\\node\s*(?:\[([^\]]*)\])?\s*(?:\(([^)]*)\)\s*)?\{([\s\S]*)\}\s*;?$/);
  if (nodeMatch) {
    return {
      text: stripOuterBraces(nodeMatch[3]),
      options: { ...options, ...(nodeMatch[1] ? parseOptions(nodeMatch[1]) : {}) },
      explicitName: nodeMatch[2]?.trim() || null
    };
  }
  const calendar = parseCalendarSpec(text);
  if (calendar) return { text: "", options, explicitName: null, calendar };
  return { text: stripOuterBraces(text), options, explicitName: null };
}

function parseFiniteDimension(value, env, fallback) {
  if (value === undefined || value === null || value === true || value === "") return fallback;
  const parsed = parseDimension(value, env.variables);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseFinitePgfLength(value, env, fallback) {
  if (value === undefined || value === null || value === true || value === "") return fallback;
  const substituted = substituteVariables(value, env.variables).replace(/\{\}/g, "").trim();
  const text = stripOuterBraces(substituted);
  const hasExplicitUnit = /(?:cm|mm|pt|em|ex|in)\s*$/.test(text);
  const length = !hasExplicitUnit && /^[+\-*/().\d\s]+$/.test(text) ? `${text}pt` : value;
  const parsed = parseDimension(length, env.variables);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function scaleSize(size, scale = 1) {
  const factor = Number.isFinite(scale) && scale > 0 ? scale : 1;
  if (Math.abs(factor - 1) < 1e-9) return size;
  return {
    width: roundNumber((Number(size?.width) || 0) * factor),
    height: roundNumber((Number(size?.height) || 0) * factor)
  };
}

function canvasLengthScale(env = {}) {
  const scale = Number(env.canvasScale);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function nodeCanvasEnv(env = {}, options = {}) {
  const scale = nodeCanvasScale(options, env);
  if (Math.abs(scale - canvasLengthScale(env)) < 1e-9) return env;
  return { ...env, canvasScale: scale };
}

function nodeCanvasScale(options = {}, env = {}) {
  const base = canvasLengthScale(env);
  if (!tikzBoolean(options["transform shape"])) return base;
  const transformScale = Number(env.transform?.scale);
  return base * (Number.isFinite(transformScale) && transformScale > 0 ? transformScale : 1);
}

function scaleCanvasStyle(style = {}, env = {}) {
  const scale = canvasLengthScale(env);
  if (Math.abs(scale - 1) < 1e-9) return style;
  const scaled = { ...style };
  if (Number.isFinite(Number(scaled.lineWidth))) scaled.lineWidth = Number(scaled.lineWidth) * scale;
  if (Array.isArray(scaled.dashArray)) scaled.dashArray = scaled.dashArray.map((value) => value * scale);
  if (scaled.markerStart) scaled.markerStart = scaleArrowTipMetrics(scaled.markerStart, scale);
  if (scaled.markerEnd) scaled.markerEnd = scaleArrowTipMetrics(scaled.markerEnd, scale);
  return scaled;
}

function scaleArrowTipMetrics(tip, scale) {
  return {
    ...tip,
    length: Number.isFinite(Number(tip.length)) ? Number(tip.length) * scale : tip.length,
    width: Number.isFinite(Number(tip.width)) ? Number(tip.width) * scale : tip.width
  };
}

function nodeFontScale(options = {}, env = {}) {
  return fontScaleFromTikzFont(options.font ?? env.pictureOptions?.font) * nodeOptionScale(options, env);
}

function nodeFontScaleForText(normalized, options = {}, env = {}) {
  return normalized?.explicitFontSize ? nodeOptionScale(options, env) : nodeFontScale(options, env);
}

function nodeOptionScale(options = {}, env = { variables: {} }) {
  if (options.scale === undefined || options.scale === null || options.scale === true || options.scale === "") return 1;
  const scale = evaluateMath(options.scale, env.variables);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function inheritedNodeOptions(env = {}) {
  const options = { ...(env.pictureOptions || {}) };
  const nodesOptions = parseInheritedNodesOption(options.nodes);
  delete options.nodes;
  delete options.scale;
  delete options.rotate;
  delete options.xshift;
  delete options.yshift;
  delete options.shift;
  if (env.styles?.["every node"]) options["every node"] = true;
  return resolveDynamicOptions({ ...options, ...nodesOptions }, env);
}

function parseInheritedNodesOption(rawNodes) {
  const parsed = {};
  if (rawNodes === undefined || rawNodes === null || rawNodes === true) return parsed;
  const values = Array.isArray(rawNodes) ? rawNodes : [rawNodes];
  for (const value of values) {
    Object.assign(parsed, parseOptions(String(value)));
  }
  return parsed;
}

function scaleTextMetricBox(box, scale = 1) {
  const factor = Number.isFinite(scale) && scale > 0 ? scale : 1;
  if (Math.abs(factor - 1) < 1e-9) return box;
  return {
    ...box,
    width: box.width * factor,
    height: box.height * factor
  };
}

function estimateMatrixCellSize(text, options = {}, env = { variables: {} }) {
  if (options.circle || options.shape === "circle") return estimateNodeSize(text, options, env);

  const normalized = normalizeTikzText(text);
  if (normalized.kind === "image") return estimateNodeSize(text, options, env);

  const textBox = scaleTextMetricBox(estimateTextMetricBox(normalized, {
    widthFactor: 0.12,
    lineHeight: 0.24,
    minHeight: 0.24,
    formulaMinWidth: 0.08,
    formulaWidthPadding: 0
  }), nodeFontScaleForText(normalized, options, env));
  const innerSep = parseNodeLengthDimension(options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env);
  const textWidth = options["text width"] ? parseDimension(options["text width"], env.variables) : null;
  const textHeight = options["text height"] ? parseDimension(options["text height"], env.variables) : null;
  const textDepth = options["text depth"] ? parseDimension(options["text depth"], env.variables) : 0;
  const isEmptyText = normalized.kind === "text" && String(normalized.text || "").trim().length === 0;
  if (isEmptyText) {
    let width = Number.isFinite(textWidth) ? textWidth + innerSep * 2 : innerSep * 2;
    let height = Number.isFinite(textHeight) ? textHeight + textDepth + innerSep * 2 : innerSep * 2;
    width = Math.max(0.02, width);
    height = Math.max(0.02, height);
    if (options["minimum width"]) width = Math.max(width, parseDimension(options["minimum width"], env.variables));
    if (options["minimum height"]) height = Math.max(height, parseDimension(options["minimum height"], env.variables));
    if (options["minimum size"]) {
      const size = parseDimension(options["minimum size"], env.variables);
      width = Math.max(width, size);
      height = Math.max(height, size);
    }
    return { width: roundNumber(width), height: roundNumber(height) };
  }
  let width = Math.max(0.22, textBox.width + 0.06 + innerSep * 2);
  let height = Math.max(0.24, textBox.height + innerSep * 2);

  if (Number.isFinite(textWidth)) width = Math.max(0.22, textWidth + innerSep * 2);
  if (Number.isFinite(textHeight)) height = Math.max(0.22, textHeight + textDepth + innerSep * 2);
  if (options["minimum width"]) width = Math.max(width, parseDimension(options["minimum width"], env.variables));
  if (options["minimum height"]) height = Math.max(height, parseDimension(options["minimum height"], env.variables));
  if (options["minimum size"]) {
    const size = parseDimension(options["minimum size"], env.variables);
    width = Math.max(width, size);
    height = Math.max(height, size);
  }

  return { width: roundNumber(width), height: roundNumber(height) };
}

function estimateNodeLayoutSize(text, options = {}, env = { variables: {} }) {
  if (options["op amp"]) return circuitikzOpAmpSize(env);
  if (options.ground) return circuitikzGroundSize(env);
  if (circuitikzTransistorKind(options)) return circuitikzTransistorSize(env);
  if (circuitikzTubeKind(options)) return circuitikzTubeSize(env, options);
  if (circuitikzQuadpoleKind(options)) return circuitikzQuadpoleSize(env, options);
  if (nodeUsesBoxSizing(options, env)) return estimateNodeSize(text, options, env);
  return estimateCompactTextSize(text, options, env);
}

function estimateNodeAnchorSize(text, options = {}, env = { variables: {} }, visibleSize = null) {
  const size = visibleSize || estimateNodeLayoutSize(text, options, env);
  const outerSep = nodeOuterSep(options, env);
  return {
    width: roundNumber((Number(size.width) || 0) + outerSep.x * 2),
    height: roundNumber((Number(size.height) || 0) + outerSep.y * 2)
  };
}

function nodeOuterSep(options = {}, env = { variables: {} }) {
  if (!nodeUsesBoxSizing(options, env)) return { x: 0, y: 0 };
  const { style } = normalizeOptions("node", options, env);
  const defaultSep = Math.max(0, (Number(style.lineWidth) || 0) / TIKZ_UNIT / 2);
  return {
    x: parseOuterSepDimension(options["outer xsep"] ?? options["outer sep"], defaultSep, env),
    y: parseOuterSepDimension(options["outer ysep"] ?? options["outer sep"], defaultSep, env)
  };
}

function parseOuterSepDimension(value, fallback, env) {
  if (value === undefined || value === null || value === true || value === "" || String(value).trim() === "auto") {
    return fallback;
  }
  const parsed = parseNodeLengthDimension(value, env);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseNodeLengthDimension(value, env = { variables: {} }) {
  const substituted = substituteVariables(value ?? "", env.variables || {}).trim();
  if (/^\{?\s*[-+]?(?:\d+\.?\d*|\.\d+)\s*\}?$/.test(substituted)) {
    return parseDimension(`${substituted.replace(/[{}]/g, "").trim()}pt`, env.variables);
  }
  return parseDimension(value, env.variables);
}

function nodeUsesBoxSizing(options = {}, env = { variables: {} }) {
  const { style, semantic } = normalizeOptions("node", options, env);
  return Boolean(
    style.stroke !== "none" ||
      style.fill !== "none" ||
      semantic.draw ||
      semantic.shading ||
      options.circle ||
      options.ellipse ||
      options["op amp"] ||
      options.ground ||
      options.shape ||
      options["minimum width"] ||
      options["minimum height"] ||
      options["minimum size"] ||
      options["text width"]
  );
}

function shouldFitTextToNodeBox(options = {}) {
  return Boolean((options.circle || options.shape === "circle") && options["minimum size"]);
}

function estimateCompactTextSize(text, options = {}, env = { variables: {} }) {
  const normalized = normalizeTikzText(text);
  if (normalized.kind === "image") return estimateNodeSize(text, options, env);
  if (isEmptyNormalizedText(normalized)) return estimateEmptyTextNodeSize(options, env);
  const typewriter = nodeUsesTypewriterFont(normalized, options, env);

  const textBox = scaleTextMetricBox(estimateTextMetricBox(normalized, {
    widthFactor: typewriter ? 0.187 : 0.13,
    fixedCharWidth: typewriter ? 0.187 : undefined,
    lineHeight: typewriter ? 0.236 : 0.18,
    lineGap: typewriter ? 0.187 : undefined,
    minHeight: 0.18,
    formulaMinWidth: 0.08,
    formulaWidthPadding: 0.08
  }), nodeFontScaleForText(normalized, options, env));
  const innerSep = parseNodeLengthDimension(options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env);
  const width = Math.max(0.08, textBox.width + innerSep * 2);
  const height = Math.max(0.08, textBox.height + innerSep * 2);

  return { width: roundNumber(width), height: roundNumber(height) };
}

function nodeUsesMonospaceFont(text, options = {}, env = {}) {
  return Boolean(resolveFontFamily(options.font || env.pictureOptions?.font) || resolveFontFamily(text));
}

function nodeUsesTypewriterFont(normalizedOrText, options = {}, env = {}) {
  const textFont =
    typeof normalizedOrText === "object" && normalizedOrText
      ? normalizedOrText.fontFamily || resolveFontFamily(normalizedOrText.raw || normalizedOrText.text)
      : resolveFontFamily(normalizedOrText);
  const optionFont = resolveFontFamily(options.font || env.pictureOptions?.font);
  return fontFamilyUsesTypewriter(`${textFont || ""} ${optionFont || ""}`);
}

function fontFamilyUsesTypewriter(fontFamily) {
  return /(?:Typewriter|mono|Menlo|Monaco|Consolas|Courier)/i.test(String(fontFamily || ""));
}

function estimatePositioningSelfSize(text, options = {}, env = { variables: {} }, fallback = null) {
  if (!hasPositioningOfOption(options) || nodeUsesBoxSizing(options, env)) return fallback || estimateNodeAnchorSize(text, options, env);
  const normalized = normalizeTikzText(text);
  if (normalized.kind !== "text") {
    return fallback || estimateNodeAnchorSize(text, options, env);
  }
  const positioningMath = parseMathText(String(normalized.text || "").trim());
  if (positioningMath) {
    const useTexFormulaWidth = positioningFormulaNeedsTexMetrics(positioningMath.tex);
    if (!useTexFormulaWidth) return fallback || estimateNodeAnchorSize(text, options, env);
    const textBox = scaleTextMetricBox(estimateTextMetricBox(normalized, {
      widthFactor: 0.187,
      lineHeight: 0.18,
      minHeight: 0.18,
      formulaMinWidth: 0.08,
      formulaWidthPadding: 0,
      formulaTexTextMetrics: true
    }), nodeFontScaleForText(normalized, options, env));
    const innerSep = parseNodeLengthDimension(options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env);
    return {
      width: roundNumber(Math.max(fallback?.width || 0.08, textBox.width + innerSep * 2)),
      height: roundNumber(Math.max(fallback?.height || 0.08, textBox.height + innerSep * 2))
    };
  }
  if (isEmptyNormalizedText(normalized)) return estimateEmptyTextNodeSize(options, env);
  const textBox = scaleTextMetricBox(estimateTextMetricBox(normalized, {
    widthFactor: 0.187,
    lineHeight: 0.18,
    minHeight: 0.18,
    formulaMinWidth: 0.08,
    formulaWidthPadding: 0
  }), nodeFontScaleForText(normalized, options, env));
  const innerSep = parseNodeLengthDimension(options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env);
  return {
    width: roundNumber(Math.max(fallback?.width || 0.08, textBox.width + innerSep * 2)),
    height: roundNumber(Math.max(fallback?.height || 0.08, textBox.height + innerSep * 2))
  };
}

function positioningFormulaNeedsTexMetrics(tex) {
  const fallback = mathFallbackText(tex);
  return /[(),;]/.test(fallback) || mathTextMetricUnits(fallback) >= 4.5;
}

function isEmptyNormalizedText(normalized) {
  return normalized?.kind === "text" && String(normalized.text || "").trim().length === 0;
}

function estimateEmptyTextNodeSize(options = {}, env = { variables: {} }) {
  const innerXSep = parseNodeLengthDimension(options["inner xsep"] ?? options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env);
  const innerYSep = parseNodeLengthDimension(options["inner ysep"] ?? options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env);
  const textWidth = options["text width"] ? parseDimension(options["text width"], env.variables) : NaN;
  const textHeight = options["text height"] ? parseDimension(options["text height"], env.variables) : NaN;
  const textDepth = options["text depth"] ? parseDimension(options["text depth"], env.variables) : 0;
  return {
    width: roundNumber(Math.max(0.02, (Number.isFinite(textWidth) ? textWidth : 0) + innerXSep * 2)),
    height: roundNumber(Math.max(0.02, (Number.isFinite(textHeight) ? textHeight + textDepth : 0) + innerYSep * 2))
  };
}

function hasPositioningOfOption(options = {}) {
  for (const direction of ["right", "left", "above", "below", "above right", "above left", "below right", "below left"]) {
    const value = options[direction];
    if (value !== undefined && value !== true && /\bof\b/.test(String(value))) return true;
  }
  return false;
}

function estimateNodeSize(text, options = {}, env = { variables: {} }) {
  if (options["tikzcd label"]) return estimateTikzCdLabelSize(text, options, env);
  const normalized = normalizeTikzText(text);
  const shapeScale = nodeOptionScale(options, env);
  const unscaledTextMetricScale = nodeFontScaleForText(normalized, options, env) / shapeScale;
  if (normalized.kind === "image") {
    const contentScale = nodeFontScale(options, env) / shapeScale;
    const innerSep = parseNodeLengthDimension(options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env);
    let width = normalized.width * contentScale + innerSep * 2;
    let height = normalized.height * contentScale + innerSep * 2;
    if (options["minimum width"]) width = Math.max(width, parseDimension(options["minimum width"], env.variables));
    if (options["minimum height"]) height = Math.max(height, parseDimension(options["minimum height"], env.variables));
    if (options["minimum size"]) {
      const size = parseDimension(options["minimum size"], env.variables);
      width = Math.max(width, size);
      height = Math.max(height, size);
    }
    return scaleSize({
      width: roundNumber(width),
      height: roundNumber(height)
    }, shapeScale);
  }
  const lines = textMetricLines(normalized);
  const isCircleShape = options.circle || options.shape === "circle";
  const shape = nodeShape(options);
  const typewriter = nodeUsesTypewriterFont(normalized, options, env);
  const inlineMathLabelMetrics = Boolean(options["tikzkit inline math label metrics"]);
  const multilineFormulaCircle = isCircleShape && nodeHasMultipleMathLines(normalized);
  const textBox = scaleTextMetricBox(estimateTextMetricBox(
    normalized,
    isCircleShape
      ? {
          texTextMetrics: !typewriter,
          fixedCharWidth: typewriter ? 0.187 : undefined,
          widthFactor: 0.09,
          formulaWidthFactor: 0.09,
          formulaMinWidth: 0.32,
          lineHeight: typewriter ? 0.236 : 0.32,
          minHeight: typewriter ? 0.236 : 0.28,
          widthPadding: 0,
          formulaTexTextMetrics: true,
          formulaWidthPadding: multilineFormulaCircle ? 0.38 : 0.08,
          shortFormulaWidthPadding: 0.02,
          shortFormulaMaxUnits: 1.6
        }
      : {
          texTextMetrics: !typewriter,
          fixedCharWidth: typewriter ? 0.187 : undefined,
          widthFactor: 0.16,
          formulaWidthFactor: 0.17,
          formulaMinWidth: 0.08,
          formulaMinHeight: 0.36,
          lineHeight: typewriter ? 0.236 : 0.32,
          minHeight: typewriter ? 0.236 : 0.28,
          widthPadding: 0,
          formulaTexTextMetrics: shape === "roundedRectangle" || inlineMathLabelMetrics,
          formulaWidthPadding: inlineMathLabelMetrics ? 0.35 : shape === "roundedRectangle" ? 0 : 0.14,
          shortFormulaWidthPadding: 0.08,
          shortFormulaMaxUnits: 3
        }
  ), unscaledTextMetricScale);
  textBox.width += explicitHspaceWidth(text, env);
  const innerXSep = parseNodeLengthDimension(options["inner xsep"] ?? options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env);
  const innerYSep = parseNodeLengthDimension(options["inner ysep"] ?? options["inner sep"] ?? TIKZ_DEFAULT_INNER_SEP, env);
  const isEmptyText = lines.every((line) => !line.trim());
  const isEmptyCircle = isCircleShape && isEmptyText;
  const fixedCircleSize = fixedCircularMinimumSize(options, env);
  const textWidth = options["text width"] ? parseDimension(options["text width"], env.variables) : null;
  if (Number.isFinite(textWidth) && textWidth > 0 && !isCircleShape) {
    const wrappedLines = wrapTextMetricLines(lines, textWidth, options, env);
    if (wrappedLines.length > lines.length) {
      const contentScale = unscaledTextMetricScale;
      textBox.height = Math.max(textBox.height, (wrappedLines.length * 0.32 + Math.max(0, wrappedLines.length - 1) * 0.08) * contentScale);
    }
    textBox.width = Math.min(textBox.width, textWidth);
  }
  // Claude: 空圆里带 cross（⊗ 乘法器/混频符号，如 case 037）若按 inner sep 撑，会小到几乎看不见。
  // 给它一个合理的默认直径，让 ⊗ 有正常大小；普通空圆（如 dropout 节点）仍保持小。
  const pgfCircleDiameter = 2 * Math.hypot(textBox.width / 2 + innerXSep, textBox.height / 2 + innerYSep);
  const emptyCircleDiameter = Math.max(parseDimension("1pt", env.variables), 2 * Math.hypot(innerXSep, innerYSep));
  const emptyCircleSize = options.cross ? Math.max(0.42, emptyCircleDiameter) : emptyCircleDiameter;
  const textHeight = options["text height"] ? parseDimension(options["text height"], env.variables) : NaN;
  const textDepth = options["text depth"] ? parseDimension(options["text depth"], env.variables) : 0;
  const emptyNodeShape = nodeShape(options);
  if (
    isEmptyText &&
    !isCircleShape &&
    !["roundedRectangle", "rectangleSplit"].includes(emptyNodeShape) &&
    (options["minimum width"] || options["minimum height"] || options["minimum size"] || options["text width"] || options["text height"])
  ) {
    let emptyWidth = Number.isFinite(textWidth) && textWidth > 0 ? textWidth + innerXSep * 2 : innerXSep * 2;
    let emptyHeight = Number.isFinite(textHeight) ? textHeight + textDepth + innerYSep * 2 : innerYSep * 2;
    if (arrowNodeShape(emptyNodeShape)) return scaleSize(arrowNodeLayoutSize(emptyWidth, emptyHeight, options, env), shapeScale);
    if (options["minimum width"]) emptyWidth = Math.max(emptyWidth, parseDimension(options["minimum width"], env.variables));
    if (options["minimum height"]) emptyHeight = Math.max(emptyHeight, parseDimension(options["minimum height"], env.variables));
    if (options["minimum size"]) {
      const size = parseDimension(options["minimum size"], env.variables);
      emptyWidth = Math.max(emptyWidth, size);
      emptyHeight = Math.max(emptyHeight, size);
    }
    return scaleSize({
      width: roundNumber(Math.max(0.02, emptyWidth)),
      height: roundNumber(Math.max(0.02, emptyHeight))
    }, shapeScale);
  }
  let width = fixedCircleSize ?? (isEmptyCircle
    ? emptyCircleSize
    : textWidth
      ? textWidth + innerXSep * 2
      : Math.max(0.22, textBox.width + innerXSep * 2));
  let height = fixedCircleSize ?? (isEmptyCircle ? width : Math.max(0.35, textBox.height + innerYSep * 2));
  if (arrowNodeShape(shape)) return scaleSize(arrowNodeLayoutSize(width, height, options, env), shapeScale);
  if (options["minimum width"]) width = Math.max(width, parseDimension(options["minimum width"], env.variables));
  if (options["minimum height"]) height = Math.max(height, parseDimension(options["minimum height"], env.variables));
  if (options["minimum size"]) {
    const size = parseDimension(options["minimum size"], env.variables);
    width = Math.max(width, size);
    height = Math.max(height, size);
  }
  if (options["rectangle split"] && options["rectangle split horizontal"]) {
    const parts = Number(options["rectangle split parts"] || 1);
    const count = Number.isFinite(parts) && parts > 0 ? Math.round(parts) : 1;
    width = Math.max(width, rectangleSplitHorizontalMinPartWidth(env) * count);
  }
  if (isCircleShape) {
    const shouldCircumscribe = circleNeedsDiagonalFit(normalized, textBox, isEmptyCircle, null);
    const circumscribed = shouldCircumscribe ? pgfCircleDiameter : 0;
    const diameter = Math.max(width, height, circumscribed, compactMathCircleMinimumDiameter(normalized));
    width = diameter;
    height = diameter;
  }
  if (shape === "ellipse") {
    width *= Math.SQRT2;
    height *= Math.SQRT2;
  }
  if (options.diamond || options.shape === "diamond") {
    if (options["bpmn gateway"]) {
      const diameter = Math.max(width, height);
      width = diameter;
      height = diameter;
    } else {
      const contentWidth = width;
      const contentHeight = height;
      width = contentWidth + contentHeight;
      height = Math.max(contentHeight + contentWidth * 0.72, contentHeight * 2);
    }
  }
  if (shape === "roundedRectangle") {
    if (isEmptyText && options["minimum width"]) {
      width = Math.max(parseDimension("1pt", env.variables), parseDimension(options["minimum width"], env.variables) - innerXSep * 2);
    } else if (!isEmptyText) {
      width += roundedRectangleTextExtraXSep(env) * 2;
    }
  }
  if (shape === "regularPolygon") {
    const diameter = Math.max(width, height) * 1.12;
    width = diameter;
    height = diameter;
  }
  if (shape === "star") {
    const diameter = Math.max(width, height) * 1.35;
    width = diameter;
    height = diameter;
  }
  if (shape === "trapezium") {
    width += Math.max(0.25, height * 0.45);
  }
  if (shape === "isoscelesTriangle") {
    const apexAngle = Math.max(1, Math.min(170, nodeShapeData(options, env).isoscelesTriangleApexAngle || 45));
    const halfApex = (apexAngle * Math.PI) / 360;
    width = Math.max(width, 2 * height * Math.tan(halfApex));
  }
  if (shape === "cloud") {
    width *= 1.28;
    height *= 1.18;
  }
  if (shape === "tikzquadsQuad") {
    width = Math.max(width, parseFiniteDimension(options["base width"], env, 6.6));
    height = Math.max(height, parseFiniteDimension(options["base height"], env, 2.8));
  }
  if (shape === "tikzquadsBlackBox") {
    width = Math.max(width, parseFiniteDimension(options["base width"], env, 3.8));
    height = Math.max(height, parseFiniteDimension(options["base height"], env, 2.8));
  }
  if (shape === "tikzquadsPgLoadLine") {
    width = Math.max(width, parseFiniteDimension(options["base width"], env, 1.8));
    height = Math.max(height, parseFiniteDimension(options["base height"], env, 1.8));
  }
  return scaleSize({ width: roundNumber(width), height: roundNumber(height) }, shapeScale);
}

function nodeHasMultipleMathLines(normalized) {
  const rawLines = normalized?.lines?.length ? normalized.lines : String(normalized?.text || "").split(/\\\\|\n/);
  const nonEmptyLines = rawLines.filter((line) => String(line || "").trim().length);
  if (nonEmptyLines.length <= 1) return false;
  return nonEmptyLines.some((line) => Boolean(parseMathText(String(line || "").trim())));
}

function circleNeedsDiagonalFit(normalized, textBox, isEmptyCircle, fixedCircleSize) {
  if (isEmptyCircle || fixedCircleSize !== null) return false;
  if (normalized?.kind === "text" && !parseMathText(String(normalized.text || "").trim())) return true;
  const lines = normalized?.lines?.length ? normalized.lines : String(normalized?.text || "").split(/\\\\|\n/);
  const nonEmptyLines = lines.filter((line) => String(line || "").trim().length);
  if (nonEmptyLines.length > 1) return true;
  const math = parseMathText(String(nonEmptyLines[0] || "").trim());
  if (math && isCompactAccentFormula(math.tex)) return false;
  const raw = String(normalized?.raw || normalized?.text || "");
  if (/\\(?:vec|overrightarrow|hat|bar|overline)\b|[_^]/.test(raw)) return true;
  const width = Number(textBox?.width) || 0;
  const height = Number(textBox?.height) || 0;
  return height > 0.34 && width > 0 && height / width > 0.72;
}

function isCompactAccentFormula(tex) {
  const text = String(tex || "").trim();
  return /^\\(?:vec|hat|bar|overline)\s*\{\s*[A-Za-z]\s*\}$/.test(text);
}

function compactMathCircleMinimumDiameter(normalized) {
  const lines = normalized?.lines?.length ? normalized.lines : String(normalized?.text || "").split(/\\\\|\n/);
  const nonEmptyLines = lines.filter((line) => String(line || "").trim().length);
  if (nonEmptyLines.length !== 1) return 0;
  const math = parseMathText(String(nonEmptyLines[0] || "").trim());
  if (!math || /[_^]/.test(math.tex)) return 0;
  return 0.64 * (math.scale || 1);
}

function arrowNodeShape(shape) {
  return shape === "singleArrow" || shape === "doubleArrow";
}

function arrowNodeLayoutSize(contentWidth, contentHeight, options = {}, env = { variables: {} }) {
  const shape = nodeShape(options);
  const data = nodeShapeData(options, env);
  const tipAngle = Math.max(5, Math.min(175, Number(data.arrowTipAngle) || 90));
  const halfTip = (tipAngle * Math.PI) / 360;
  const cotHalfTip = Math.cos(halfTip) / Math.max(1e-6, Math.sin(halfTip));
  const headExtend = Math.max(0, Number(data.arrowHeadExtend) || 0);
  const minLength = options["minimum height"] ? parseDimension(options["minimum height"], env.variables) : 0;
  const minThickness = options["minimum width"] ? parseDimension(options["minimum width"], env.variables) : 0;
  const bodyThickness = Math.max(0.08, Number(contentHeight) || 0.08);
  const visualThickness = Math.max(minThickness, bodyThickness + headExtend * 2);
  const headLength = Math.max(visualThickness * 0.5 * cotHalfTip, headExtend * cotHalfTip, 0.12);
  const headCount = shape === "doubleArrow" ? 2 : 1;
  const visualLength = Math.max(minLength, Number(contentWidth) + headLength * headCount, 0.18);
  return {
    width: roundNumber(visualLength),
    height: roundNumber(visualThickness)
  };
}

function estimateTikzCdLabelSize(text, options = {}, env = { variables: {} }) {
  const normalized = normalizeTikzText(text);
  const textBox = scaleTextMetricBox(estimateTextMetricBox(normalized, {
    widthFactor: 0.1,
    lineHeight: 0.16,
    minHeight: 0.13,
    formulaMinWidth: 0.04,
    formulaWidthPadding: 0
  }), nodeFontScaleForText(normalized, options, env));
  const innerXSep = parseNodeLengthDimension(options["inner xsep"] ?? options["inner sep"] ?? "0.015", env);
  const innerYSep = parseNodeLengthDimension(options["inner ysep"] ?? options["inner sep"] ?? "0.015", env);
  const width = Math.max(0.08, textBox.width + innerXSep * 2);
  const height = Math.max(0.08, textBox.height + innerYSep * 2);
  return { width: roundNumber(width), height: roundNumber(height) };
}

function explicitHspaceWidth(text, env = { variables: {} }) {
  let width = 0;
  const pattern = /\\hspace\s*\{([^{}]+)\}/g;
  let match;
  while ((match = pattern.exec(String(text || "")))) {
    width += parseDimension(match[1], env.variables);
  }
  return Number.isFinite(width) ? width : 0;
}

function fixedCircularMinimumSize(options = {}, env = { variables: {} }) {
  if (!(options.circle || options.shape === "circle") || !options["minimum size"]) return null;
  const size = parseDimension(options["minimum size"], env.variables);
  return Number.isFinite(size) && size > 0 ? size : null;
}

function estimateTextMetricBox(normalized, options = {}) {
  const rawLines = normalized.lines.length ? normalized.lines : String(normalized.text || "").split(/\\\\|\n/);
  const scale = normalized.scale || 1;
  const widthFactor = options.widthFactor ?? 0.16;
  const lineHeight = options.lineHeight ?? 0.35;
  const lineGap = options.lineGap ?? 0.1;
  const minHeight = options.minHeight ?? lineHeight;
  const widthPadding = options.widthPadding ?? 0;
  const lineStyles = Array.isArray(normalized.lineStyles) ? normalized.lineStyles : [];
  const boxes = rawLines.map((line, index) => {
    const text = String(line).trim();
    const lineScale = scale * (Number(lineStyles[index]?.scale) || 1);
    const math = parseMathText(text);
    if (math) {
      const formulaScale = lineScale * (math.scale || 1);
      const formula = estimateFormulaBox(math.tex, {
        displayMode: math.displayMode,
        scale: formulaScale,
        minWidth: options.formulaMinWidth,
        widthFactor: options.formulaWidthFactor ?? widthFactor,
        widthPadding: formulaWidthPaddingFor(math.tex, options, widthPadding),
        texTextMetrics: Boolean(options.formulaTexTextMetrics)
      });
      const formulaMinHeight = compactMathSymbolUsesNativeHeight(math.tex) ? 0 : (options.formulaMinHeight ?? minHeight);
      return {
        width: formula.width,
        height: Math.max(formulaMinHeight * formulaScale, formulaTotalHeight(formula))
      };
    }
    const fallback = text.replace(/\$([^$]+)\$/g, (_match, tex) => mathFallbackText(tex));
    const fixedCharWidth = Number(options.fixedCharWidth);
    const textWidth =
      Number.isFinite(fixedCharWidth) && fixedCharWidth > 0
        ? [...fallback].length * fixedCharWidth * lineScale
        : options.texTextMetrics
          ? texTextWidthCm(fallback, lineScale)
          : mathTextMetricUnits(fallback) * widthFactor * lineScale;
    return {
      width: textWidth + widthPadding,
      height: Math.max(minHeight * lineScale, lineHeight * lineScale)
    };
  });
  const maxLineScale = Math.max(scale, ...lineStyles.map((style) => scale * (Number(style?.scale) || 1)));
  return {
    width: Math.max(...boxes.map((box) => box.width), 0),
    height: boxes.reduce((sum, box) => sum + box.height, 0) + Math.max(0, boxes.length - 1) * lineGap * maxLineScale
  };
}

function compactMathSymbolUsesNativeHeight(tex) {
  return /^\\(?:clubsuit|diamondsuit|heartsuit|spadesuit)(?![A-Za-z])$/.test(String(tex || "").trim());
}

function formulaWidthPaddingFor(tex, options, fallback) {
  const regular = options.formulaWidthPadding ?? fallback;
  const short = options.shortFormulaWidthPadding;
  if (!Number.isFinite(short)) return regular;
  const units = mathTextMetricUnits(mathFallbackText(tex));
  const maxUnits = Number.isFinite(options.shortFormulaMaxUnits) ? options.shortFormulaMaxUnits : 3;
  return units <= maxUnits ? short : regular;
}

function textMetricLines(normalized) {
  const rawLines = normalized.lines.length ? normalized.lines : String(normalized.text || "").split(/\\\\|\n/);
  return rawLines.map((line) => {
    const text = String(line).trim();
    if (/^\$[\s\S]*\$$/.test(text) || /^\\\([\s\S]*\\\)$/.test(text)) return mathFallbackText(text);
    return text.replace(/\$([^$]+)\$/g, (_match, tex) => mathFallbackText(tex));
  });
}

function wrapTextMetricLines(lines, textWidth, options = {}, env = { variables: {} }) {
  const maxChars = textWidthMaxChars(textWidth, options, env);
  return lines.flatMap((line) => wrapTextMetricLine(line, maxChars));
}

function textWidthMaxChars(textWidth, options = {}, env = { variables: {} }) {
  const emWidth = parseDimension("1em", env.variables) * nodeFontScale(options, env) * 0.49;
  if (!Number.isFinite(textWidth) || !Number.isFinite(emWidth) || emWidth <= 0) return Infinity;
  return Math.max(1, Math.floor(textWidth / emWidth));
}

function wrapTextMetricLine(line, maxChars) {
  const text = String(line || "").trim();
  if (!text || !Number.isFinite(maxChars) || text.length <= maxChars || !/\s/.test(text)) return [text];
  const output = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars || !current) {
      current = next;
    } else {
      output.push(current);
      current = word;
    }
  }
  if (current) output.push(current);
  return output.length ? output : [text];
}

function maxTextMetricUnits(lines) {
  return Math.max(...lines.map((line) => textMetricUnits(line)), 0);
}

function textMetricUnits(line) {
  return mathTextMetricUnits(line);
}

function expandForeachValues(values, env) {
  const expanded = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index].trim();
    if (value === "..." && expanded.length > 0 && index < values.length - 1) {
      const previous = Number(expanded.at(-1));
      const beforePrevious = Number(expanded.at(-2));
      const end = evaluateMath(values[index + 1], env.variables);
      const step = Number.isFinite(beforePrevious) ? previous - beforePrevious : 1;
      for (let current = previous + step; step >= 0 ? current <= end : current >= end; current += step) {
        expanded.push(String(roundNumber(current)));
      }
      index += 1;
    } else {
      expanded.push(value);
    }
  }
  return expanded;
}

function applyForeachOptions(variables, options = {}, foreachIndex = 0, env = { variables: {} }) {
  applyForeachCountOption(variables, options.count, foreachIndex, env);
  const evaluateOptions = Array.isArray(options.evaluate) ? options.evaluate : options.evaluate !== undefined ? [options.evaluate] : [];
  for (const spec of evaluateOptions) applyForeachEvaluateOption(variables, spec, env);
}

function applyForeachCountOption(variables, spec, foreachIndex, env) {
  if (spec === undefined || spec === null || spec === false) return;
  const text = stripOuterBraces(String(spec === true ? "" : spec)).trim();
  const match = text.match(/^\\?([A-Za-z@]+)(?:\s+(?:starting\s+from|from)\s+([\s\S]+))?$/);
  if (!match) return;
  const start = match[2] ? evaluateMath(match[2], { ...env.variables, ...variables }) : 1;
  variables[match[1]] = roundNumber((Number.isFinite(start) ? start : 1) + foreachIndex);
}

function applyForeachEvaluateOption(variables, spec, env) {
  if (spec === undefined || spec === null || spec === false) return;
  const text = stripOuterBraces(String(spec === true ? "" : spec)).trim();
  const match = text.match(/^\\?([A-Za-z@]+)\s+as\s+\\?([A-Za-z@]+)\s+using\s+\{?([\s\S]*?)\}?$/);
  if (!match) return;
  const expression = match[3].trim();
  variables[match[2]] = roundNumber(evaluateMath(expression, { ...env.variables, ...variables }));
}

function buildGrid(from, to, pathOptions, env = {}) {
  const step = parseDimension(pathOptions.step || 1) * gridStepScale(env);
  if (!Number.isFinite(step) || step <= 0) return [];
  const lines = [];
  const subtype = semanticSubtype(pathOptions) || "grid-line";
  const minX = Math.min(from.x, to.x);
  const maxX = Math.max(from.x, to.x);
  const minY = Math.min(from.y, to.y);
  const maxY = Math.max(from.y, to.y);
  const tolerance = Math.max(1e-9, step * 0.05);
  const addHorizontal = (y) => {
    lines.push({
      type: "path",
      subtype,
      commands: [
        { type: "moveTo", x: minX, y: roundNumber(y) },
        { type: "lineTo", x: maxX, y: roundNumber(y) }
      ]
    });
  };
  for (let x = Math.ceil((minX - tolerance) / step) * step; x <= maxX + tolerance; x += step) {
    lines.push({
      type: "path",
      subtype,
      commands: [
        { type: "moveTo", x: roundNumber(x), y: minY },
        { type: "lineTo", x: roundNumber(x), y: maxY }
      ]
    });
  }
  let horizontalCount = 0;
  for (let y = Math.ceil((minY - tolerance) / step) * step; y <= maxY + tolerance; y += step) {
    addHorizontal(y);
    horizontalCount += 1;
  }
  const transformedCap = transformedGridUpperCap(minY, maxY, step, tolerance, env);
  if (horizontalCount === 0 && transformedCap !== null) {
    addHorizontal(transformedCap);
  }
  return lines;
}

function gridStepScale(env = {}) {
  const scale = normalizeTransform(env.transform).scale;
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function transformedGridUpperCap(minY, maxY, step, tolerance, env = {}) {
  if (!usesCustomBasis(env.basis) || maxY <= 0 || minY < 0) return null;
  const upper = Math.ceil((maxY - tolerance) / step) * step;
  if (upper <= maxY + tolerance) return null;
  if (upper > maxY + step + tolerance) return null;
  return roundNumber(upper);
}

function buildArc(current, options, env) {
  const start = evaluateMath(options["start angle"] || 0, env.variables);
  const end = evaluateMath(options["end angle"] || 360, env.variables);
  const { rx, ry } = parseArcRadii(options, env);
  const startRad = (start * Math.PI) / 180;
  const projected = usesProjectedLocalGeometry(env);
  const radialPoint = (angle) => {
    const x = rx * Math.cos(angle);
    const y = ry * Math.sin(angle);
    return projected ? projectLocalOffset(x, y, env) : { x, y };
  };
  const startOffset = radialPoint(startRad);
  const center = {
    x: current.x - startOffset.x,
    y: current.y - startOffset.y
  };
  const steps = Math.max(8, Math.ceil(Math.abs(end - start) / 12));
  const commands = [{ type: "moveTo", x: current.x, y: current.y }];
  for (let i = 1; i <= steps; i += 1) {
    const angle = ((start + ((end - start) * i) / steps) * Math.PI) / 180;
    const offset = radialPoint(angle);
    commands.push({
      type: "lineTo",
      x: roundNumber(center.x + offset.x),
      y: roundNumber(center.y + offset.y)
    });
  }
  return {
    type: "path",
    shape: "arc",
    commands,
    endPoint: { x: commands.at(-1).x, y: commands.at(-1).y }
  };
}

function parseArcRadii(options = {}, env = {}) {
  const variables = env.variables || {};
  const rawRadius = stripOuterBraces(String(options.radius ?? "1")).trim();
  const elliptical = rawRadius.match(/^([\s\S]+?)\s+and\s+([\s\S]+)$/);
  const defaultX = elliptical ? elliptical[1].trim() : rawRadius;
  const defaultY = elliptical ? elliptical[2].trim() : defaultX;
  const rx = parseDimension(options["x radius"] ?? defaultX, variables);
  const ry = parseDimension(options["y radius"] ?? defaultY, variables);
  return { rx, ry };
}

function applyPathMorphing(commands, pathOptions, env, pathStyle = {}) {
  const decoration = parseOptions(String(pathOptions.decoration || ""));
  if (pathOptions.decorate && decoration.brace) return applyBraceDecoration(commands, decoration, env);
  const mode = decoration.snake ? "snake" : decoration.zigzag ? "zigzag" : null;
  if (!pathOptions.decorate || !mode) return commands;
  const defaultAmplitude = parseDimension("2.5pt", env.variables);
  const defaultSegmentLength = parseDimension("10pt", env.variables);
  const minimumSegmentLength = parseDimension("1pt", env.variables);
  const amplitude = Math.max(0, parseFinitePgfLength(decoration.amplitude ?? "2.5pt", env, defaultAmplitude));
  const segmentLength = Math.max(
    minimumSegmentLength,
    parseFinitePgfLength(decoration["segment length"] ?? "10pt", env, defaultSegmentLength)
  );
  const arrowReserved = decorationArrowEndpointShortening(pathStyle);
  const preLength = Math.max(0, parseFinitePgfLength(decoration["pre length"] ?? "0", env, 0) + arrowReserved.start);
  const postLength = Math.max(0, parseFinitePgfLength(decoration["post length"] ?? "0", env, 0) + arrowReserved.end);
  const morphed = [];
  let current = null;
  let start = null;
  for (const command of commands) {
    if (command.type === "moveTo") {
      current = { x: command.x, y: command.y };
      start = current;
      morphed.push(command);
      continue;
    }
    if (command.type === "lineTo" && current) {
      appendMorphedLine(morphed, current, { x: command.x, y: command.y }, amplitude, segmentLength, mode, preLength, postLength);
      current = { x: command.x, y: command.y };
      continue;
    }
    if (command.type === "curveTo" && current) {
      appendMorphedCurve(morphed, current, command, amplitude, segmentLength, mode, preLength, postLength);
      current = { x: command.x, y: command.y };
      continue;
    }
    if (command.type === "closePath" && current && start) {
      appendMorphedLine(morphed, current, start, amplitude, segmentLength, mode, preLength, postLength);
      morphed.push(command);
      current = start;
      continue;
    }
    morphed.push(command);
    if ("x" in command) current = { x: command.x, y: command.y };
  }
  return morphed;
}

function decorationArrowEndpointShortening(style = {}) {
  return {
    start: arrowTipShortenCoordinateLength(style.markerStart, style),
    end: arrowTipShortenCoordinateLength(style.markerEnd, style)
  };
}

function arrowTipShortenCoordinateLength(tip, style = {}) {
  if (!tip) return 0;
  const source = typeof tip === "string" ? {} : tip || {};
  const raw = typeof tip === "string" ? createArrowTip(tip === "arrow" ? "to" : tip) : createArrowTip(tip?.kind, source);
  const lineWidth = Math.max(0.01, style.lineWidth ?? 1);
  const lineWidthPt = lineWidth / lineWidthFromPt(1);
  const customLength = usesCustomArrowDimension(source, raw, "length");
  const customWidth = usesCustomArrowDimension(source, raw, "width");
  let shorten;
  if (raw.kind === "stealth") {
    const length = customLength ? raw.length : lineWidthFromPt(3 + 1.25 * lineWidthPt);
    shorten = length * 0.625;
  } else if (raw.kind === "latex") {
    const length = customLength ? raw.length : lineWidthFromPt(3.2 + 2.4 * lineWidthPt);
    shorten = length * 0.9;
  } else if (raw.kind === "two-heads") {
    shorten = lineWidth;
  } else if (raw.kind === "hook") {
    shorten = 0;
  } else if (raw.kind === "open-circle") {
    shorten = raw.width / 2;
  } else if (raw.kind === "open-triangle") {
    shorten = raw.length;
  } else if (raw.kind === "dimline" || raw.kind === "dimline reverse") {
    shorten = lineWidth * 0.2;
  } else {
    shorten = lineWidth;
    if (customLength || customWidth) shorten = lineWidth;
  }
  return Number.isFinite(shorten) ? shorten / TIKZ_UNIT : 0;
}

function usesCustomArrowDimension(source = {}, raw = {}, key) {
  if (source[`custom${key[0].toUpperCase()}${key.slice(1)}`] || source[`${key}Explicit`]) return true;
  if (!Number.isFinite(source[key])) return false;
  const defaultTip = createArrowTip(raw.kind || source.kind || "to");
  return Math.abs(source[key] - defaultTip[key]) > 1e-6;
}

function applyBraceDecoration(commands, decoration, env) {
  const replaced = [];
  let current = null;
  for (const command of commands) {
    if (command.type === "moveTo") {
      current = { x: command.x, y: command.y };
      continue;
    }
    if (command.type === "lineTo" && current) {
      appendBraceLine(replaced, current, { x: command.x, y: command.y }, decoration, env);
      current = { x: command.x, y: command.y };
      continue;
    }
    if (!replaced.length && current) replaced.push({ type: "moveTo", x: current.x, y: current.y });
    replaced.push(command);
    if ("x" in command) current = { x: command.x, y: command.y };
  }
  return replaced.length ? replaced : commands;
}

function appendBraceLine(commands, from, to, decoration, env) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-12) {
    commands.push({ type: "moveTo", x: from.x, y: from.y });
    return;
  }
  const raise = parseFinitePgfLength(decoration.raise || "0", env, 0);
  const mirrored = decoration.mirror === true || String(decoration.mirror).trim() === "true";
  const side = mirrored ? -1 : 1;
  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy * side;
  const ny = ux * side;
  const amplitude = Math.max(
    0,
    parseFinitePgfLength(decoration.amplitude ?? "2.5pt", env, parseDimension("2.5pt", env.variables))
  );
  if (amplitude <= 1e-12) {
    const p0 = bracePoint(from, ux, uy, nx, ny, 0, raise);
    const p1 = bracePoint(from, ux, uy, nx, ny, length, raise);
    commands.push({ type: "moveTo", x: p0.x, y: p0.y });
    commands.push({ type: "lineTo", x: p1.x, y: p1.y });
    return;
  }

  const aspectRaw = evaluateMath(decoration.aspect ?? "0.5", env.variables);
  const aspect = Number.isFinite(aspectRaw) ? Math.min(0.95, Math.max(0.05, aspectRaw)) : 0.5;
  const apexDistance = length * aspect;
  const beforeCurl = Math.min(amplitude, Math.max(0, apexDistance / 2));
  const afterCurl = Math.min(amplitude, Math.max(0, (length - apexDistance) / 2));
  const point = (distance, normalOffset) => bracePoint(from, ux, uy, nx, ny, distance, raise + normalOffset);
  const pushLineTo = (distance, normalOffset) => {
    const previous = commands.at(-1);
    const p = point(distance, normalOffset);
    if (previous && Math.hypot((previous.x ?? 0) - p.x, (previous.y ?? 0) - p.y) < 1e-9) return;
    commands.push({ type: "lineTo", x: p.x, y: p.y });
  };
  const pushCurveTo = (c1Distance, c1Normal, c2Distance, c2Normal, endDistance, endNormal) => {
    const c1 = point(c1Distance, c1Normal);
    const c2 = point(c2Distance, c2Normal);
    const end = point(endDistance, endNormal);
    commands.push({
      type: "curveTo",
      x1: c1.x,
      y1: c1.y,
      x2: c2.x,
      y2: c2.y,
      x: end.x,
      y: end.y
    });
  };

  const start = point(0, 0);
  commands.push({ type: "moveTo", x: start.x, y: start.y });
  pushCurveTo(
    beforeCurl * 0.15,
    amplitude * 0.3,
    beforeCurl * 0.5,
    amplitude * 0.5,
    beforeCurl,
    amplitude * 0.5
  );
  pushLineTo(apexDistance - beforeCurl, amplitude * 0.5);
  pushCurveTo(
    apexDistance - beforeCurl * 0.5,
    amplitude * 0.5,
    apexDistance - beforeCurl * 0.15,
    amplitude * 0.7,
    apexDistance,
    amplitude
  );
  pushCurveTo(
    apexDistance + afterCurl * 0.15,
    amplitude * 0.7,
    apexDistance + afterCurl * 0.5,
    amplitude * 0.5,
    apexDistance + afterCurl,
    amplitude * 0.5
  );
  pushLineTo(length - afterCurl, amplitude * 0.5);
  pushCurveTo(
    length - afterCurl * 0.5,
    amplitude * 0.5,
    length - afterCurl * 0.15,
    amplitude * 0.3,
    length,
    0
  );
}

function bracePoint(origin, ux, uy, nx, ny, distance, normalDistance) {
  return roundPoint({
    x: origin.x + ux * distance + nx * normalDistance,
    y: origin.y + uy * distance + ny * normalDistance
  });
}

function addDecorationTextItems(built, pathOptions, style, ir, env) {
  const decoration = textAlongPathDecorationFromOptions(pathOptions);
  if (!decoration) return;
  const targets = [];
  if (hasDrawableCommands(built.commands || [], built.shapes || [])) {
    targets.push({ commands: built.commands, style });
  }
  for (const shape of built.shapes || []) {
    if (shape.commands?.length) targets.push({ commands: shape.commands, style: { ...style, ...(shape.style || {}) } });
  }
  for (const target of targets) addDecorationTextItem(target, decoration, pathOptions, ir, env);
}

function textAlongPathDecorationFromOptions(options = {}) {
  if (!tikzBoolean(options.decorate)) return null;
  const decoration = parseOptions(String(options.decoration || ""));
  return decoration["text along path"] ? decoration : null;
}

function addDecorationTextItem(item, decoration, pathOptions, ir, env) {
  const flat = flattenPath(item.commands || [], 0.02);
  if (flat.length < 2) return;
  const payload = decorationTextPayload(decoration.text, pathOptions, env);
  if (!payload.text) return;
  const point = pointAtLength(flat, 0.5);
  const angle = Number(point.angle) || 0;
  const raise = parseFiniteDimension(decoration.raise || "0", env, 0);
  const radians = (angle * Math.PI) / 180;
  const nx = -Math.sin(radians);
  const ny = Math.cos(radians);
  ir.items.push({
    type: "textNode",
    subtype: "decoration-text",
    text: payload.text,
    x: roundNumber(point.x + nx * raise),
    y: roundNumber(point.y + ny * raise),
    rotation: roundNumber(angle),
    style: {
      ...item.style,
      ...payload.style,
      fill: visibleTextFill(payload.style.fill, item.style?.textFill, item.style?.stroke, item.style?.fill),
      fontFamily: payload.style.fontFamily || resolveFontFamily(pathOptions.font || env.pictureOptions?.font),
      fontScale: roundNumber(env.canvasScale * (payload.fontScale || fontScaleFromTikzFont(pathOptions.font || env.pictureOptions?.font)))
    }
  });
}

function decorationTextPayload(raw, pathOptions = {}, env = {}) {
  let text = substituteTextVariables(stripOuterBraces(String(raw ?? "")).trim(), env.variables || {});
  let styleRaw = "";
  if (text.startsWith("|")) {
    const end = text.indexOf("|", 1);
    if (end !== -1) {
      styleRaw = text.slice(1, end).trim();
      text = text.slice(end + 1).trim();
    }
  }
  const style = {};
  const color = decorationTextColor(styleRaw);
  if (color) style.fill = normalizeColor(color);
  const fontFamily = resolveFontFamily(`${styleRaw} ${pathOptions.font || ""}`);
  if (fontFamily) style.fontFamily = fontFamily;
  const fontPrefix = decorationTextFontPrefix(styleRaw);
  return {
    text: `${fontPrefix}${text}`.trim(),
    style,
    fontScale: fontScaleFromTikzFont(styleRaw)
  };
}

function decorationTextColor(styleRaw) {
  const match = String(styleRaw || "").match(/\\color\s*\{([^{}]+)\}/);
  return match?.[1]?.trim() || null;
}

function decorationTextFontPrefix(styleRaw) {
  const commands = [];
  const raw = String(styleRaw || "");
  for (const match of raw.matchAll(/\\(Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny|bf|bfseries|itshape|slshape|sffamily|rmfamily|ttfamily)\b/g)) {
    commands.push(`\\${match[1]}`);
  }
  return commands.length ? `${commands.join("")} ` : "";
}

function visibleTextFill(...candidates) {
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === false) continue;
    const text = String(candidate).trim();
    if (!text || text === "none") continue;
    return candidate;
  }
  return "black";
}

function appendMorphedLine(commands, from, to, amplitude, segmentLength, mode, preLength = 0, postLength = 0) {
  appendMorphedPolyline(commands, [from, to], amplitude, segmentLength, mode, preLength, postLength);
}

function appendMorphedCurve(commands, from, curve, amplitude, segmentLength, mode, preLength = 0, postLength = 0) {
  const flat = flattenPath([{ type: "moveTo", x: from.x, y: from.y }, curve], 0.04);
  appendMorphedPolyline(commands, flat, amplitude, segmentLength, mode, preLength, postLength);
}

function appendMorphedPolyline(commands, points, amplitude, segmentLength, mode, preLength = 0, postLength = 0) {
  const length = polylineLength(points);
  const to = points.at(-1);
  if (!to) return;
  if (length < 1e-12 || amplitude <= 0) {
    commands.push({ type: "lineTo", x: to.x, y: to.y });
    return;
  }
  const activeStart = Math.min(Math.max(0, preLength), length);
  const activeEnd = Math.max(activeStart, length - Math.min(Math.max(0, postLength), Math.max(0, length - activeStart)));
  const activeLength = activeEnd - activeStart;
  if (activeStart > 1e-12) {
    const startPoint = pointOnPolyline(points, activeStart);
    commands.push({ type: "lineTo", x: roundNumber(startPoint.x), y: roundNumber(startPoint.y) });
  }
  if (activeLength < 1e-12) {
    commands.push({ type: "lineTo", x: to.x, y: to.y });
    return;
  }
  const activeOrigin = pointOnPolyline(points, activeStart);
  if (mode === "zigzag") {
    const halfSegment = Math.max(segmentLength / 2, 1e-12);
    const steps = Math.max(1, Math.ceil(activeLength / halfSegment));
    for (let index = 1; index <= steps; index += 1) {
      const walked = Math.min(activeLength, index * halfSegment);
      const sample = pointOnPolyline(points, activeStart + walked);
      const atEnd = activeLength - walked <= 1e-9;
      const offset = atEnd ? 0 : amplitude * (index % 2 === 1 ? 1 : -1);
      commands.push({
        type: "lineTo",
        x: roundNumber(sample.x + sample.normal.x * offset),
        y: roundNumber(sample.y + sample.normal.y * offset)
      });
    }
    if (postLength > 1e-12) commands.push({ type: "lineTo", x: to.x, y: to.y });
    return;
  }
  const cycles = Math.max(1, Math.round(activeLength / segmentLength));
  const steps = Math.max(4, cycles * 8);
  const morphedPoints = [];
  for (let index = 1; index <= steps; index += 1) {
    const sample = pointOnPolyline(points, activeStart + (activeLength * index) / steps);
    const walked = sample.walked - activeStart;
    const offset =
      index === steps
        ? 0
        : mode === "zigzag"
          ? amplitude * (Math.floor((walked / segmentLength) * 2) % 2 === 0 ? 1 : -1)
          : amplitude * Math.sin((walked / segmentLength) * Math.PI * 2);
    morphedPoints.push({
      x: roundNumber(sample.x + sample.normal.x * offset),
      y: roundNumber(sample.y + sample.normal.y * offset)
    });
  }
  if (mode === "snake") {
    appendSmoothCurveThroughPoints(commands, [{ x: activeOrigin.x, y: activeOrigin.y }, ...morphedPoints]);
  } else {
    for (const point of morphedPoints) commands.push({ type: "lineTo", x: point.x, y: point.y });
  }
  if (postLength > 1e-12) commands.push({ type: "lineTo", x: to.x, y: to.y });
}

function appendSmoothCurveThroughPoints(commands, points) {
  if (points.length < 2) return;
  for (let index = 1; index < points.length; index += 1) {
    const p0 = points[index - 2] || points[index - 1];
    const p1 = points[index - 1];
    const p2 = points[index];
    const p3 = points[index + 1] || p2;
    commands.push({
      type: "curveTo",
      x1: roundNumber(p1.x + (p2.x - p0.x) / 6),
      y1: roundNumber(p1.y + (p2.y - p0.y) / 6),
      x2: roundNumber(p2.x - (p3.x - p1.x) / 6),
      y2: roundNumber(p2.y - (p3.y - p1.y) / 6),
      x: p2.x,
      y: p2.y
    });
  }
}

function polylineLength(points) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return total;
}

function pointOnPolyline(points, distance) {
  let walked = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    const segmentLength = Math.hypot(dx, dy);
    if (segmentLength < 1e-12) continue;
    if (walked + segmentLength >= distance - 1e-12) {
      const local = Math.max(0, Math.min(1, (distance - walked) / segmentLength));
      return {
        x: previous.x + dx * local,
        y: previous.y + dy * local,
        walked: walked + segmentLength * local,
        normal: { x: -dy / segmentLength, y: dx / segmentLength }
      };
    }
    walked += segmentLength;
  }
  const last = points.at(-1) || { x: 0, y: 0 };
  const previous = points.at(-2) || last;
  const dx = last.x - previous.x;
  const dy = last.y - previous.y;
  const segmentLength = Math.hypot(dx, dy) || 1;
  return {
    x: last.x,
    y: last.y,
    walked,
    normal: { x: -dy / segmentLength, y: dx / segmentLength }
  };
}

function buildPlot(coordinate, env, pathOptions) {
  const domain = String(pathOptions.domain || "-1:1").split(":");
  const start = evaluateMath(domain[0], env.variables);
  const end = evaluateMath(domain[1], env.variables);
  const samples = Math.max(2, Math.min(200, Math.round(evaluateMath(pathOptions.samples || 25, env.variables))));
  const variable = String(pathOptions.variable || "\\x").replace(/^\\/, "");
  const commands = [];
  for (let i = 0; i < samples; i += 1) {
    const t = samples === 1 ? 0 : i / (samples - 1);
    const value = start + (end - start) * t;
    const point = resolveCoordinate(coordinate, { ...env, variables: { ...env.variables, [variable]: value }, transform: identityTransform() }, []);
    commands.push({ type: i === 0 ? "moveTo" : "lineTo", x: point.x, y: point.y });
  }
  return commands;
}

function buildPlotFunction(expression, env, pathOptions = {}) {
  const domain = parsePlotFunctionDomain(pathOptions.domain, env);
  const samples = Math.max(2, Math.min(500, Math.round(evaluateMath(pathOptions.samples || 25, env.variables))));
  const variable = String(pathOptions.variable || "x").trim().replace(/^\\/, "") || "x";
  const points = [];
  for (let i = 0; i < samples; i += 1) {
    const t = samples === 1 ? 0 : i / (samples - 1);
    const value = domain.start + (domain.end - domain.start) * t;
    const y = evaluatePlotFunctionExpression(expression, value, variable, env.variables);
    if (!Number.isFinite(y)) continue;
    const local = roundPoint(projectBasisPoint(value, y, 0, env.basis));
    points.push({ ...applyTransform(local, env.transform), sourceX: value, sourceY: y });
  }
  if (!points.length) return { commands: [], points };
  if (tikzBoolean(pathOptions.ycomb) || tikzBoolean(pathOptions.xcomb)) {
    const isXComb = tikzBoolean(pathOptions.xcomb);
    const commands = [];
    for (const point of points) {
      const baselineLocal = isXComb
        ? roundPoint(projectBasisPoint(0, point.sourceY, 0, env.basis))
        : roundPoint(projectBasisPoint(point.sourceX, 0, 0, env.basis));
      const baseline = applyTransform(baselineLocal, env.transform);
      commands.push({ type: "moveTo", x: baseline.x, y: baseline.y });
      commands.push({ type: "lineTo", x: point.x, y: point.y });
    }
    return { commands, points };
  }
  if (tikzBoolean(pathOptions.smooth) && points.length >= 3) {
    return { commands: smoothPlotCoordinateCommands(points, pathOptions, env), points };
  }
  return {
    commands: points.map((point, index) => ({
      type: index === 0 ? "moveTo" : "lineTo",
      x: point.x,
      y: point.y
    })),
    points
  };
}

function parsePlotFunctionDomain(raw, env) {
  const text = stripOuterBraces(String(raw || "-1:1").trim());
  const split = splitTopLevelDomain(text);
  const start = evaluateMath(split.start, env.variables);
  const end = evaluateMath(split.end, env.variables);
  return {
    start: Number.isFinite(start) ? start : -1,
    end: Number.isFinite(end) ? end : 1
  };
}

function splitTopLevelDomain(text) {
  let brace = 0;
  let bracket = 0;
  let paren = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") brace += 1;
    else if (char === "}") brace = Math.max(0, brace - 1);
    else if (char === "[") bracket += 1;
    else if (char === "]") bracket = Math.max(0, bracket - 1);
    else if (char === "(") paren += 1;
    else if (char === ")") paren = Math.max(0, paren - 1);
    else if (char === ":" && brace === 0 && bracket === 0 && paren === 0) {
      return { start: text.slice(0, index).trim(), end: text.slice(index + 1).trim() };
    }
  }
  return { start: "-1", end: "1" };
}

function evaluatePlotFunctionExpression(expression, xValue, variable, variables = {}) {
  const substituted = substitutePlotFunctionVariable(expression, variable, xValue);
  return evaluateMath(substituted, { ...variables, x: xValue, [variable]: xValue });
}

function substitutePlotFunctionVariable(expression, variable, value) {
  const name = String(variable || "x").replace(/^\\/, "") || "x";
  const escaped = escapeRegExp(name);
  const replacement = `(${value})`;
  return String(expression || "")
    .replace(new RegExp(`\\\\${escaped}\\b`, "g"), replacement)
    .replace(new RegExp(`\\b${escaped}\\b`, "g"), replacement);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPlotCoordinates(coordinates, env, diagnostics, pathOptions = {}) {
  const points = [];
  for (const coordinate of coordinates) {
    const point = resolveCoordinate(coordinate, env, diagnostics);
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) points.push(point);
  }
  if (!points.length) return { commands: [], points };
  if (tikzBoolean(pathOptions.smooth) && points.length >= 3) {
    return { commands: smoothPlotCoordinateCommands(points, pathOptions, env), points };
  }
  return {
    commands: points.map((point, index) => ({
      type: index === 0 ? "moveTo" : "lineTo",
      x: point.x,
      y: point.y
    })),
    points
  };
}

function smoothPlotCoordinateCommands(points, pathOptions, env) {
  const rawTension = evaluateMath(pathOptions.tension ?? 0.5, env.variables);
  const tension = Number.isFinite(rawTension) && rawTension > 0 ? Math.min(rawTension, 3) : 1;
  const factor = tension * 0.2775;
  const commands = [{ type: "moveTo", x: points[0].x, y: points[0].y }];

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
    commands.push({
      type: "curveTo",
      x1: roundNumber(firstSupport.x),
      y1: roundNumber(firstSupport.y),
      x2: roundNumber(secondSupport.x),
      y2: roundNumber(secondSupport.y),
      x: roundNumber(second.x),
      y: roundNumber(second.y)
    });
    firstSupport = {
      x: second.x + support.x,
      y: second.y + support.y
    };
    first = second;
    second = current;
  }
  commands.push({
    type: "curveTo",
    x1: roundNumber(firstSupport.x),
    y1: roundNumber(firstSupport.y),
    x2: roundNumber(second.x),
    y2: roundNumber(second.y),
    x: roundNumber(second.x),
    y: roundNumber(second.y)
  });
  return commands;
}

function sineCosineCurveCommand(from, to, op) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const controls =
    op === "sin"
      ? [
          { x: 0.326, y: 0.512 },
          { x: 0.638, y: 1 }
        ]
      : [
          { x: 0.362, y: 0 },
          { x: 0.674, y: 0.488 }
        ];
  return {
    type: "curveTo",
    x1: roundNumber(from.x + dx * controls[0].x),
    y1: roundNumber(from.y + dy * controls[0].y),
    x2: roundNumber(from.x + dx * controls[1].x),
    y2: roundNumber(from.y + dy * controls[1].y),
    x: roundNumber(to.x),
    y: roundNumber(to.y)
  };
}

function buildPlotMark(point, mark, pathStyle = {}, markOptions = {}, env = {}) {
  const kind = stripOuterBraces(String(mark || "*")).trim();
  const size = plotMarkSize(markOptions, env);
  const markColor = markOptions["mark color"] && markOptions["mark color"] !== true
    ? normalizeColor(String(markOptions["mark color"]))
    : pathStyle.stroke || "black";
  const lineStyle = {
    stroke: markColor,
    fill: "none",
    lineWidth: pathStyle.lineWidth || 1
  };
  const filledStyle = {
    ...lineStyle,
    fill: markColor
  };

  if (kind === "*" || kind === "." || kind === "o") {
    return {
      type: "path",
      shape: "plot-mark",
      mark: kind,
      commands: circleToPath(point.x, point.y, size),
      style: kind === "o" ? lineStyle : filledStyle
    };
  }
  if (kind === "+" || kind === "|") {
    const commands = [
      { type: "moveTo", x: roundNumber(point.x), y: roundNumber(point.y - size) },
      { type: "lineTo", x: roundNumber(point.x), y: roundNumber(point.y + size) }
    ];
    if (kind === "+") {
      commands.push(
        { type: "moveTo", x: roundNumber(point.x - size), y: roundNumber(point.y) },
        { type: "lineTo", x: roundNumber(point.x + size), y: roundNumber(point.y) }
      );
    }
    return {
      type: "path",
      shape: "plot-mark",
      mark: kind,
      commands,
      style: lineStyle
    };
  }
  if (kind === "-") {
    return {
      type: "path",
      shape: "plot-mark",
      mark: kind,
      commands: [
        { type: "moveTo", x: roundNumber(point.x - size), y: roundNumber(point.y) },
        { type: "lineTo", x: roundNumber(point.x + size), y: roundNumber(point.y) }
      ],
      style: lineStyle
    };
  }
  if (kind === "square" || kind === "square*") {
    return {
      type: "path",
      shape: "plot-mark",
      mark: kind,
      commands: [
        { type: "moveTo", x: roundNumber(point.x - size), y: roundNumber(point.y - size) },
        { type: "lineTo", x: roundNumber(point.x + size), y: roundNumber(point.y - size) },
        { type: "lineTo", x: roundNumber(point.x + size), y: roundNumber(point.y + size) },
        { type: "lineTo", x: roundNumber(point.x - size), y: roundNumber(point.y + size) },
        { type: "closePath" }
      ],
      style: kind.endsWith("*") ? filledStyle : lineStyle
    };
  }
  if (kind === "triangle" || kind === "triangle*") {
    const top = polarOffset(point, 90, size);
    const right = polarOffset(point, -30, size);
    const left = polarOffset(point, -150, size);
    return {
      type: "path",
      shape: "plot-mark",
      mark: kind,
      commands: [
        { type: "moveTo", x: top.x, y: top.y },
        { type: "lineTo", x: right.x, y: right.y },
        { type: "lineTo", x: left.x, y: left.y },
        { type: "closePath" }
      ],
      style: kind.endsWith("*") ? filledStyle : lineStyle
    };
  }
  return {
    type: "path",
    shape: "plot-mark",
    mark: kind,
    commands: [
      { type: "moveTo", x: roundNumber(point.x - size), y: roundNumber(point.y - size) },
      { type: "lineTo", x: roundNumber(point.x + size), y: roundNumber(point.y + size) },
      { type: "moveTo", x: roundNumber(point.x - size), y: roundNumber(point.y + size) },
      { type: "lineTo", x: roundNumber(point.x + size), y: roundNumber(point.y - size) }
    ],
    style: lineStyle
  };
}

function plotMarkSize(markOptions = {}, env = {}) {
  const parsed = parseDimension(markOptions["mark size"] || "2pt", env.variables || {});
  return Number.isFinite(parsed) && parsed > 0 ? parsed : parseDimension("2pt", env.variables || {});
}

function resolveControlPoint(raw, current, env, diagnostics) {
  const text = String(raw).trim();
  const relative = text.match(/^\+\((.+)\)$/);
  if (!relative) return resolveCoordinate(text, env, diagnostics);
  const offset = resolveCoordinate(relative[1], { ...env, transform: identityTransform() }, diagnostics);
  return roundPoint({ x: current.x + offset.x, y: current.y + offset.y });
}

function resolveRelativeCoordinate(raw, current, env, diagnostics) {
  const base = current || applyTransform({ x: 0, y: 0 }, env.transform);
  const offset = resolveCoordinate(raw, { ...env, transform: scaleOnlyTransform(env.transform) }, diagnostics);
  return roundPoint({
    x: base.x + offset.x,
    y: base.y + offset.y
  });
}

function semanticSubtype(options = {}) {
  if (options["tikzquads parallel path"]) return "tikzquads-parallel-connect";
  if (options["tikzquads kind"]) return `tikzquads-${String(options["tikzquads kind"]).trim().replace(/\s+/g, "-")}`;
  if (options["axis mark"]) return "axis-mark";
  if (options["axis bar"]) return "axis-bar";
  if (options["axis comb"]) return "axis-comb";
  if (options["axis closed cycle"]) return "axis-closed-cycle";
  if (options["axis surface"]) return "axis-surface";
  if (options["axis tick"]) return "axis-tick";
  if (options["axis bounds"]) return "axis-frame";
  if (options["axis frame"]) return "axis-frame";
  if (options["axis grid"]) return "axis-grid-line";
  if (options["axis line"]) return "axis-line";
  if (options["axis plot"]) return "axis-plot";
  if (options["axis legend"]) return "axis-legend";
  if (options["ternary patch"]) return "ternary-patch";
  if (options["ternary grid"]) return "ternary-grid";
  if (options["ternary frame"]) return "ternary-frame";
  if (options["ternary colorbar"]) return "ternary-colorbar";
  if (options["ternary colorbar frame"]) return "ternary-colorbar-frame";
  if (options["stanli support hatch"]) return "stanli-support-hatch";
  if (options["stanli dspring"]) return "stanli-dspring";
  if (options["stanli lineload arrow"]) return "stanli-lineload-arrow";
  if (options["stanli lineload outline"]) return "stanli-lineload-outline";
  if (options["stanli lineload endpoint"]) return "stanli-lineload-endpoint";
  if (options["bagua line"]) return "bagua-line";
  if (options["bagua taiji fill"]) return "bagua-taiji-fill";
  if (options["bagua taiji outline"]) return "bagua-taiji-outline";
  if (options["bagua taiji eye"]) return "bagua-taiji-eye";
  if (options["decofonts pixl"]) return "decofonts-pixl";
  if (options["decofonts surround"]) return "decofonts-surround";
  if (options["decofonts underline"]) return "decofonts-underline";
  if (options["decofonts fit arrow"]) return "decofonts-fit-arrow";
  if (options["decofonts brush"]) return "decofonts-brush";
  if (options["decofonts ink"]) return "decofonts-ink";
  if (options["dimline line"]) return "dimline-line";
  if (options["dimline extension"]) return "dimline-extension";
  if (options["dimline tick"]) return "dimline-tick";
  if (options["tikz-cnn-edge"]) return "tikz-cnn-edge";
  if (options["tikz-cnn-face"]) return "tikz-cnn-face";
  if (options["tikz-cnn-connection"]) return "tikz-cnn-connection";
  if (options["feynhand particle"]) return "feynhand-particle";
  if (options["feynhand dot"]) return "feynhand-dot";
  if (options["feynhand blob"]) return "feynhand-blob";
  if (options["feynhand fermion"]) return "feynhand-fermion";
  if (options["feynhand gluon"]) return "feynhand-gluon";
  if (options["feynhand boson"]) return "feynhand-boson";
  if (options["feynhand scalar"]) return "feynhand-scalar";
  if (options["feynhand ghost"]) return "feynhand-ghost";
  if (options["feynhand majorana"]) return "feynhand-majorana";
  if (options["feynman particle"]) return "feynman-particle";
  if (options["feynman dot"]) return "feynman-dot";
  if (options["feynman blob"]) return "feynman-blob";
  if (options["feynman plain"]) return "feynman-plain";
  if (options["feynman fermion"]) return "feynman-fermion";
  if (options["feynman gluon"]) return "feynman-gluon";
  if (options["feynman boson"]) return "feynman-boson";
  if (options["feynman scalar"]) return "feynman-scalar";
  if (options["feynman ghost"]) return "feynman-ghost";
  if (options["feynman majorana"]) return "feynman-majorana";
  if (options["forest node"] || options["tikzkit forest node"]) return "forest-node";
  if (options["forest edge"] || options["tikzkit forest edge"]) return "forest-edge";
  for (const key of Object.keys(options)) {
    if (key.startsWith("palattice ")) return `palattice-${key.slice("palattice ".length).trim().replace(/\s+/g, "-")}`;
  }
  if (options["qtree roof"]) return "qtree-roof";
  if (options["qtree edge"]) return "qtree-edge";
  return undefined;
}

function tikzBoolean(value) {
  if (value === undefined || value === null || value === false) return false;
  if (value === true || value === "") return true;
  return !/^(?:false|0|no|off)$/i.test(String(value).trim());
}

function hasDrawableCommands(commands, shapes) {
  if (commands.length === 0) return false;
  if (commands.length === 1 && commands[0].type === "moveTo" && shapes.length > 0) return false;
  return true;
}

function compoundFillRuleShape(shapes = [], pathOptions = {}, subtype) {
  if (shapes.length < 2) return null;
  if (!shapes[0]?.style?.fillRule) return null;
  if (!shapes.every((shape) => shape?.type === "path" && shape.commands?.length && isClosedPath(shape.commands))) return null;
  if (!shapes.every((shape) => compatibleCompoundShapeStyle(shapes[0].style || {}, shape.style || {}))) return null;
  return {
    type: "path",
    subtype: shapes[0].subtype || subtype,
    tightBezierBounds: tikzBoolean(pathOptions["bezier bounding box"]),
    style: { ...(shapes[0].style || {}) },
    commands: shapes.flatMap((shape) => shape.commands || [])
  };
}

function isClosedPath(commands = []) {
  return commands.some((command) => command.type === "closePath");
}

function compatibleCompoundShapeStyle(base = {}, candidate = {}) {
  const keys = ["fill", "stroke", "lineWidth", "fillRule", "fillOpacity", "strokeOpacity", "opacity", "dashArray"];
  return keys.every((key) => JSON.stringify(base[key] ?? null) === JSON.stringify(candidate[key] ?? null));
}

function polarOffset(point, angle, distance) {
  const radians = (angle * Math.PI) / 180;
  return roundPoint({
    x: point.x + Math.cos(radians) * distance,
    y: point.y + Math.sin(radians) * distance
  });
}

function composeTransform(parent, options = {}, env) {
  const local = coordinateLocalTransform(options, env);
  const canvasScale = transformCanvasScale(options, env);
  const canvas = canvasScale === 1 ? identityTransform() : { a: canvasScale, b: 0, c: 0, d: canvasScale, x: 0, y: 0, scale: canvasScale };
  return multiplyTransforms(parent, multiplyTransforms(canvas, local));
}

function coordinateLocalTransform(options = {}, env) {
  const coordinateScale = evaluateMath(options.scale || 1, env.variables);
  const scale = Number.isFinite(coordinateScale) ? coordinateScale : 1;
  const coordinateXScale = evaluateMath(options.xscale ?? 1, env.variables);
  const coordinateYScale = evaluateMath(options.yscale ?? 1, env.variables);
  const xscale = Number.isFinite(coordinateXScale) ? coordinateXScale : 1;
  const yscale = Number.isFinite(coordinateYScale) ? coordinateYScale : 1;
  const rotate = evaluateMath(options.rotate || 0, env.variables);
  const radians = (Number.isFinite(rotate) ? rotate : 0) * (Math.PI / 180);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const shift = parseTransformShift(options, env);
  // Claude: 原版完全没处理 TikZ 的 xslant/yslant 斜切变换（多层网络/伪三维图常用）。
  // xslant=s: (x,y)->(x+s·y, y)；yslant=s: (x,y)->(x, s·x+y)。把斜切折进线性部分(R∘slant)，
  // 平移仍只用 shift。这样矩形/圆/路径才会被剪成平行四边形，而不是保持轴对齐。
  const rotateScale = {
    a: scale * xscale * cos,
    b: scale * xscale * sin,
    c: -scale * yscale * sin,
    d: scale * yscale * cos,
    x: 0,
    y: 0,
    scale: Math.sqrt(Math.abs(scale * scale * xscale * yscale)) || 1
  };
  const linear = multiplyTransforms(rotateScale, slantTransform(options, env));
  const base = {
    a: linear.a,
    b: linear.b,
    c: linear.c,
    d: linear.d,
    x: shift.x,
    y: shift.y,
    scale
  };
  const local = multiplyTransforms(base, tikzExtMirrorTransform(options, env));
  return local;
}

// Claude: 构造 xslant/yslant 的合成斜切矩阵。按该文件里 yslant,xslant 的书写顺序，
// 等价于 current = yslant_T ∘ xslant_T。无 slant 选项时返回单位阵（不影响既有行为）。
function slantTransform(options = {}, env) {
  const xslant = evaluateMath(options.xslant ?? 0, env.variables);
  const yslant = evaluateMath(options.yslant ?? 0, env.variables);
  const xs = Number.isFinite(xslant) ? xslant : 0;
  const ys = Number.isFinite(yslant) ? yslant : 0;
  if (xs === 0 && ys === 0) return identityTransform();
  return multiplyTransforms(
    { a: 1, b: ys, c: 0, d: 1, x: 0, y: 0, scale: 1 },
    { a: 1, b: 0, c: xs, d: 1, x: 0, y: 0, scale: 1 }
  );
}

function transformCanvasScale(options = {}, env) {
  const raw = options["transform canvas"];
  if (raw === undefined || raw === null || raw === true || raw === "") return 1;
  const parsed = parseOptions(String(raw));
  const value = parsed.scale ?? parsed["scale around"] ?? 1;
  const scale = evaluateMath(value, env.variables);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function parseTransformShift(options = {}, env) {
  let x = options.xshift ? parseShiftDimension(options.xshift, env.variables) : 0;
  let y = options.yshift ? parseShiftDimension(options.yshift, env.variables) : 0;
  if (options.shift) {
    const shifted = parseShift(options.shift, env);
    x += shifted.x;
    y += shifted.y;
  }
  return { x, y };
}

// Claude: TikZ 的 xshift/yshift 是「维度」，无单位的裸数字默认是 pt（例如 yshift=-120 即 -120pt，
// 约 -4.22cm），而项目的 parseDimension 对裸数字默认按 cm。这会让 yshift=-120 被当成 -120cm、
// 把内容抛到极远处。这里：裸数字补上 pt 再解析；带单位(cm/mm/pt..)或含表达式的保持原样。
function parseShiftDimension(value, variables) {
  const text = String(value).trim();
  if (/^[-+]?[\d.]+$/.test(text)) return parseDimension(`${text}pt`, variables);
  return parseDimension(value, variables);
}

function tikzExtMirrorTransform(options = {}, env) {
  const xMirror = options["ext/xmirror"] ?? options["ext/xMirror"] ?? options["ext/mirror x"] ?? options["ext/Mirror x"];
  const yMirror = options["ext/ymirror"] ?? options["ext/yMirror"] ?? options["ext/mirror y"] ?? options["ext/Mirror y"];
  const lineMirror = options["ext/mirror"] ?? options["ext/Mirror"];
  if (lineMirror !== undefined && lineMirror !== true && lineMirror !== "") {
    const parsed = parseMirrorLine(lineMirror, env);
    if (parsed) return mirrorLineTransform(parsed.a, parsed.b);
  }
  if (xMirror !== undefined) {
    const point = mirrorReferencePoint(xMirror, env);
    return { a: -1, b: 0, c: 0, d: 1, x: 2 * point.x, y: 0, scale: 1 };
  }
  if (yMirror !== undefined) {
    const point = mirrorReferencePoint(yMirror, env);
    return { a: 1, b: 0, c: 0, d: -1, x: 0, y: 2 * point.y, scale: 1 };
  }
  return identityTransform();
}

function mirrorReferencePoint(value, env) {
  if (value === true || value === "") return { x: 0, y: 0 };
  const text = String(value).trim();
  if (text.startsWith("(")) return resolveCoordinate(text, { ...env, transform: identityTransform() }, []);
  const scalar = parseDimension(text, env.variables);
  return Number.isFinite(scalar) ? { x: scalar, y: scalar } : { x: 0, y: 0 };
}

function parseMirrorLine(value, env) {
  const text = stripOuterBraces(String(value || "").trim());
  const parts = text.split(/\s*--\s*/);
  const a = mirrorReferencePoint(parts[0] || "(0,0)", env);
  const b = parts[1] ? mirrorReferencePoint(parts[1], env) : { x: 0, y: 0 };
  if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-9) return null;
  return { a, b };
}

function mirrorLineTransform(a, b) {
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const cos = Math.cos(2 * angle);
  const sin = Math.sin(2 * angle);
  return multiplyTransforms(
    { a: 1, b: 0, c: 0, d: 1, x: a.x, y: a.y, scale: 1 },
    multiplyTransforms(
      { a: cos, b: sin, c: sin, d: -cos, x: 0, y: 0, scale: 1 },
      { a: 1, b: 0, c: 0, d: 1, x: -a.x, y: -a.y, scale: 1 }
    )
  );
}

function composePgfTransform(parent, statement, env) {
  return multiplyTransforms(parent, {
    a: evaluateMath(statement.a, env.variables),
    b: evaluateMath(statement.b, env.variables),
    c: evaluateMath(statement.c, env.variables),
    d: evaluateMath(statement.d, env.variables),
    x: parseDimension(statement.x, env.variables),
    y: parseDimension(statement.y, env.variables),
    scale: 1
  });
}

function identityTransform() {
  return { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0, scale: 1 };
}

function normalizeTransform(transform = identityTransform()) {
  if (Number.isFinite(transform.a)) return transform;
  const scale = Number.isFinite(transform.scale) ? transform.scale : 1;
  return {
    a: scale,
    b: 0,
    c: 0,
    d: scale,
    x: transform.x || 0,
    y: transform.y || 0,
    scale
  };
}

function scaleOnlyTransform(transform = identityTransform()) {
  const normalized = normalizeTransform(transform);
  const scale = Number.isFinite(normalized.scale) ? normalized.scale : Math.sqrt(Math.abs(normalized.a * normalized.d - normalized.b * normalized.c)) || 1;
  return { a: normalized.a, b: normalized.b, c: normalized.c, d: normalized.d, x: 0, y: 0, scale };
}

function multiplyTransforms(parent, child) {
  const first = normalizeTransform(parent);
  const second = normalizeTransform(child);
  const a = first.a * second.a + first.c * second.b;
  const b = first.b * second.a + first.d * second.b;
  const c = first.a * second.c + first.c * second.d;
  const d = first.b * second.c + first.d * second.d;
  return {
    a,
    b,
    c,
    d,
    x: first.a * second.x + first.c * second.y + first.x,
    y: first.b * second.x + first.d * second.y + first.y,
    scale: Math.sqrt(Math.abs(a * d - b * c)) || 1
  };
}

function parsePictureBasis(options = {}, variables = {}) {
  const basis = {
    x: { x: 1, y: 0 },
    y: { x: 0, y: 1 },
    z: { x: 0, y: 0 }
  };
  for (const key of ["x", "y", "z"]) {
    if (options[key]) basis[key] = parseBasisVector(options[key], variables, key) || basis[key];
  }
  return basis;
}

function composeBasis(parent, options = {}, env) {
  const next = {
    x: { ...parent.x },
    y: { ...parent.y },
    z: { ...parent.z }
  };
  for (const key of ["x", "y", "z"]) {
    if (options[key]) next[key] = parseBasisVector(options[key], env.variables, key) || next[key];
  }
  return next;
}

function parseBasisVector(value, variables = {}, axis = "x") {
  let text = String(value).trim();
  text = text.replace(/^\{([\s\S]*)\}$/, "$1").trim();
  if (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1).trim();
  const polar = text.match(/^(.+):(.+)$/);
  if (polar) {
    const angle = (evaluateMath(polar[1], variables) * Math.PI) / 180;
    const radius = parseDimension(polar[2], variables);
    return roundPoint({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    }, 6);
  }
  const parts = splitTopLevel(text, ",");
  if (parts.length < 2) {
    const scalar = parseDimension(text, variables);
    if (!Number.isFinite(scalar)) return null;
    if (axis === "y") return { x: 0, y: scalar };
    if (axis === "z") return { x: 0, y: 0 };
    return { x: scalar, y: 0 };
  }
  return roundPoint({
    x: parseDimension(parts[0], variables),
    y: parseDimension(parts[1], variables)
  });
}

function parseShift(value, env) {
  if (!value) return { x: 0, y: 0 };
  if (typeof value === "string" && value.startsWith("(")) {
    const point = resolveCoordinate(value, { ...env, transform: identityTransform() }, []);
    return point;
  }
  return { x: parseDimension(value, env.variables), y: parseDimension(value, env.variables) };
}

function applyTransform(point, transform = identityTransform()) {
  const normalized = normalizeTransform(transform);
  return roundPoint({
    x: point.x * normalized.a + point.y * normalized.c + normalized.x,
    y: point.x * normalized.b + point.y * normalized.d + normalized.y
  });
}

function applyTransformVector(point, transform = identityTransform()) {
  const normalized = normalizeTransform(transform);
  return roundPoint({
    x: point.x * normalized.a + point.y * normalized.c,
    y: point.x * normalized.b + point.y * normalized.d
  });
}

export function resolveCoordinate(raw, env, diagnostics = []) {
  let text = substituteTextVariables(String(raw).trim(), env.variables);
  text = stripOuterBraces(text);
  if (/^\+\(.+\)$/.test(text)) text = text.slice(1);
  if (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1).trim();
  text = stripOuterBraces(text);

  const shifted = parseCoordinateOptionPrefix(text, env);
  if (shifted) {
    const point = resolveCoordinate(shifted.coordinate, env, diagnostics);
    return roundPoint({
      x: point.x + shifted.shift.x,
      y: point.y + shifted.shift.y
    });
  }

  if (text.startsWith("$") && text.endsWith("$")) {
    return resolveCalc(text.slice(1, -1).trim(), env, diagnostics);
  }
  const projection = splitCoordinateProjection(text);
  if (projection) {
    const left = resolveCoordinate(projection.left, env, diagnostics);
    const right = resolveCoordinate(projection.right, env, diagnostics);
    const projected = projection.operator === "|-" ? { x: left.x, y: right.y } : { x: right.x, y: left.y };
    return roundPoint(projected);
  }
  if (Object.hasOwn(env.coordinates, text)) {
    return roundPoint(env.coordinates[text]);
  }
  const currentBoundingBoxPoint = resolveCurrentBoundingBoxCoordinate(text, env);
  if (currentBoundingBoxPoint) {
    return roundPoint(currentBoundingBoxPoint);
  }
  if (Object.hasOwn(env.nodes, text)) {
    return roundPoint(env.nodes[text].point);
  }
  const anchored = resolveAnchoredNodeCoordinate(text, env);
  if (anchored) {
    return roundPoint(anchored);
  }
  const declaredCoordinate = resolveDeclaredCoordinateSystem(text, env);
  if (declaredCoordinate) {
    return applyTransform(declaredCoordinate, env.transform);
  }
  const polar = text.match(/^(.+):(.+)$/);
  if (polar) {
    const angle = (evaluateMath(polar[1], env.variables) * Math.PI) / 180;
    const radius = parseDimension(polar[2], env.variables);
    return applyTransform(roundPoint({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }), env.transform);
  }
  const comma = splitTopLevel(text, ",");
  if (comma.length >= 2) {
    if (comma.length >= 3) {
      const projected = projectBasisPoint(
        parseDimension(comma[0], env.variables),
        parseDimension(comma[1], env.variables),
        parseDimension(comma[2], env.variables),
        env.basis
      );
      return applyTransform(projected, env.transform);
    }
    return applyTransform(roundPoint({
      ...projectBasisPoint(
        parseDimension(comma[0], env.variables),
        parseDimension(comma[1], env.variables),
        0,
        env.basis
      )
    }), env.transform);
  }
  diagnostics.push({ severity: "warning", message: `Unknown coordinate ${raw}` });
  return { x: 0, y: 0 };
}

function resolveDeclaredCoordinateSystem(text, env) {
  const match = String(text || "").match(/^(.+?)\s+cs\s*:\s*([\s\S]+)$/);
  if (!match) return null;
  const name = match[1].trim();
  const definition = env.coordinateSystems?.[name];
  if (!definition?.point) return null;
  const argument = stripOuterBraces(match[2].trim());
  const variables = { ...(env.variables || {}) };
  for (const macro of definition.macros || []) {
    variables[macro.name] = evaluateMath(substituteCoordinateSystemArgument(macro.expression, argument), variables);
  }
  const xRaw = substituteCoordinateSystemArgument(definition.point.x, argument);
  const yRaw = substituteCoordinateSystemArgument(definition.point.y, argument);
  const x = parseDimension(xRaw, variables);
  const y = parseDimension(yRaw, variables);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return roundPoint(projectBasisPoint(x, y, 0, env.basis));
}

function substituteCoordinateSystemArgument(text, argument) {
  return String(text || "").replace(/#1/g, `(${argument})`);
}

function splitCoordinateProjection(text) {
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  for (let index = 0; index < text.length - 1; index += 1) {
    const char = text[index];
    if (char === "(") paren += 1;
    if (char === ")") paren = Math.max(0, paren - 1);
    if (char === "{") brace += 1;
    if (char === "}") brace = Math.max(0, brace - 1);
    if (char === "[") bracket += 1;
    if (char === "]") bracket = Math.max(0, bracket - 1);
    if (paren || brace || bracket) continue;
    const operator = text.slice(index, index + 2);
    if (operator === "|-" || operator === "-|") {
      return {
        operator,
        left: text.slice(0, index).trim(),
        right: text.slice(index + 2).trim()
      };
    }
  }
  return null;
}

function parseCoordinateOptionPrefix(text, env) {
  if (!text.startsWith("[")) return null;
  const options = readBalancedPrefix(text, "[", "]");
  if (!options) return null;
  const coordinate = text.slice(options.end).trim();
  if (!coordinate) return null;
  const parsed = parseOptions(options.content);
  const shift = coordinateOptionShift(parsed, env);
  return { coordinate, shift };
}

function coordinateOptionShift(options, env) {
  const expanded = normalizeOptions("path", options, env).options;
  let x = expanded.xshift ? parseDimension(expanded.xshift, env.variables) : 0;
  let y = expanded.yshift ? parseDimension(expanded.yshift, env.variables) : 0;
  if (expanded.shift) {
    const shifted = parseShift(expanded.shift, env);
    x += shifted.x;
    y += shifted.y;
  }
  return { x, y };
}

function readBalancedPrefix(text, open, close) {
  if (text[0] !== open) return null;
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === open) depth += 1;
    if (text[index] === close) depth -= 1;
    if (depth === 0) {
      return { content: text.slice(1, index), end: index + 1 };
    }
  }
  return null;
}

function resolveAnchoredNodeCoordinate(text, env) {
  if (looksLikeExplicitCoordinate(text)) return null;
  const dot = text.lastIndexOf(".");
  if (dot <= 0 || dot === text.length - 1) return null;
  const name = text.slice(0, dot).trim();
  const anchor = text.slice(dot + 1).trim();
  const node = env.nodes[name];
  if (node) return nodeAnchorCoordinate(node, anchor);
  if (Object.hasOwn(env.coordinates, name)) return env.coordinates[name];
  return null;
}

function looksLikeExplicitCoordinate(text) {
  const value = String(text || "").trim();
  return value.includes(",") || /^[-+]?(?:\d+\.?\d*|\.\d+)\s*:/.test(value);
}

function nodeAnchorCoordinate(node, anchorRaw) {
  const rawAnchor = String(anchorRaw ?? "center").trim().toLowerCase();
  const visibleWidth = Number(node.width) || 0;
  const visibleHeight = Number(node.height) || 0;
  const width = Number(node.layoutWidth) || visibleWidth;
  const height = Number(node.layoutHeight) || visibleHeight;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const angle = Number(rawAnchor);
  if (Number.isFinite(angle)) {
    return angleAnchor(node, angle, halfWidth, halfHeight);
  }
  const anchor = rawAnchor.replace(/-/g, " ");
  if (!anchor || anchor === "center") return roundPoint(node.point);
  if (anchor === "text") return roundPoint({ x: node.point.x - visibleWidth * 0.18, y: node.point.y - visibleHeight * 0.04 });
  if (anchor === "base") return roundPoint({ x: node.point.x, y: node.point.y - visibleHeight * 0.08 });
  if (anchor === "mid") return roundPoint(node.point);
  const customAnchor = customNodeLocalAnchor(node.shape, rawAnchor, { width, height, shapeData: node.shapeData });
  if (customAnchor) {
    const rotated = rotateVector(customAnchor.x, customAnchor.y, Number(node.rotation) || 0);
    return roundPoint({ x: node.point.x + rotated.x, y: node.point.y + rotated.y });
  }
  if (node.shape === "diamond") {
    return diamondAnchorCoordinate(node, anchor, halfWidth, halfHeight);
  }
  const local = {
    x: anchor.includes("east") ? halfWidth : anchor.includes("west") ? -halfWidth : 0,
    y: anchor.includes("north") ? halfHeight : anchor.includes("south") ? -halfHeight : 0
  };
  const rotated = rotateVector(local.x, local.y, Number(node.rotation) || 0);
  return roundPoint({ x: node.point.x + rotated.x, y: node.point.y + rotated.y });
}

function customNodeLocalAnchor(shape, anchorRaw, size) {
  const rawAnchor = String(anchorRaw || "").trim().toLowerCase();
  const anchor = rawAnchor.replace(/-/g, " ");
  const halfWidth = (Number(size.width) || 0) / 2;
  const halfHeight = (Number(size.height) || 0) / 2;
  const shapeAnchor = shapeCompassLocalAnchor(shape, anchor, halfWidth, halfHeight);
  if (shapeAnchor) return shapeAnchor;
  if (shape === "isoscelesTriangle") {
    const anchors = {
      apex: { x: halfWidth, y: 0 },
      "left corner": { x: -halfWidth, y: halfHeight },
      "right corner": { x: -halfWidth, y: -halfHeight },
      "lower side": { x: -halfWidth, y: 0 },
      "left side": { x: 0, y: halfHeight / 2 },
      "right side": { x: 0, y: -halfHeight / 2 }
    };
    return anchors[anchor] || anchors[rawAnchor] || null;
  }
  if (arrowNodeShape(shape)) {
    return arrowNodeLocalAnchor(shape, anchor, { ...size, width: halfWidth * 2, height: halfHeight * 2 });
  }
  if (shape === "opAmp") {
    const inputY = halfHeight * 0.5;
    const noInvUp = size.shapeData?.opAmpNoInvInputUp !== false;
    const plusY = noInvUp ? inputY : -inputY;
    const minusY = -plusY;
    const anchors = {
      "+": { x: -halfWidth, y: plusY },
      plus: { x: -halfWidth, y: plusY },
      "-": { x: -halfWidth, y: minusY },
      minus: { x: -halfWidth, y: minusY },
      out: { x: halfWidth, y: 0 },
      output: { x: halfWidth, y: 0 },
      up: { x: 0, y: halfHeight },
      down: { x: 0, y: -halfHeight }
    };
    return anchors[rawAnchor] || anchors[anchor] || null;
  }
  if (shape === "circuitikzTransistor") {
    return circuitikzTransistorLocalAnchor(rawAnchor, size);
  }
  if (shape === "circuitikzMosfet") {
    return circuitikzMosfetLocalAnchor(rawAnchor, size);
  }
  if (shape === "circuitikzTriode") {
    return circuitikzTriodeLocalAnchor(rawAnchor, size);
  }
  if (shape === "circuitikzPentode" || shape === "circuitikzTetrode" || shape === "circuitikzDiodeTube") {
    return circuitikzTubeLocalAnchor(rawAnchor, size);
  }
  if (shape === "circuitikzQuadpole") {
    return circuitikzQuadpoleLocalAnchor(rawAnchor, size);
  }
  if (shape === "tikzquadsQuad") {
    const portY = tikzquadsPortY(halfHeight);
    const innerX = halfWidth - tikzquadsOuterExt(halfWidth, "quad") - tikzquadsInnerExt(halfWidth);
    const textY = halfHeight - tikzquadsInnerExt(halfHeight);
    const anchors = {
      "1+": { x: -halfWidth, y: portY },
      "1-": { x: -halfWidth, y: -portY },
      "2+": { x: halfWidth, y: portY },
      "2-": { x: halfWidth, y: -portY },
      "inner 1+": { x: -innerX, y: portY },
      "inner 1-": { x: -innerX, y: -portY },
      "inner 2+": { x: innerX, y: portY },
      "inner 2-": { x: innerX, y: -portY },
      "top left": { x: -innerX, y: textY },
      "top center": { x: 0, y: textY },
      "top right": { x: innerX, y: textY },
      "bottom left": { x: -innerX, y: -textY },
      "bottom center": { x: 0, y: -textY },
      "bottom right": { x: innerX, y: -textY },
      "inner top left": { x: -innerX, y: portY + halfHeight * 0.12 },
      "inner top center": { x: 0, y: portY + halfHeight * 0.12 },
      "inner top right": { x: innerX, y: portY + halfHeight * 0.12 },
      "inner bottom left": { x: -innerX, y: -portY - halfHeight * 0.12 },
      "inner bottom center": { x: 0, y: -portY - halfHeight * 0.12 },
      "inner bottom right": { x: innerX, y: -portY - halfHeight * 0.12 }
    };
    return anchors[rawAnchor] || anchors[anchor] || null;
  }
  if (shape === "tikzquadsBlackBox") {
    const portY = tikzquadsPortY(halfHeight);
    const innerX = halfWidth - tikzquadsOuterExt(halfWidth, "black box") - tikzquadsInnerExt(halfWidth);
    const textY = halfHeight - tikzquadsInnerExt(halfHeight);
    const anchors = {
      "1+": { x: -halfWidth, y: portY },
      "1-": { x: -halfWidth, y: -portY },
      "inner 1+": { x: -innerX, y: portY },
      "inner 1-": { x: -innerX, y: -portY },
      "top left": { x: -innerX, y: textY },
      "top center": { x: 0, y: textY },
      "top right": { x: innerX, y: textY },
      "bottom left": { x: -innerX, y: -textY },
      "bottom center": { x: 0, y: -textY },
      "bottom right": { x: innerX, y: -textY },
      "inner top left": { x: -innerX, y: portY + halfHeight * 0.12 },
      "inner top center": { x: 0, y: portY + halfHeight * 0.12 },
      "inner top right": { x: innerX, y: portY + halfHeight * 0.12 },
      "inner bottom left": { x: -innerX, y: -portY - halfHeight * 0.12 },
      "inner bottom center": { x: 0, y: -portY - halfHeight * 0.12 },
      "inner bottom right": { x: innerX, y: -portY - halfHeight * 0.12 }
    };
    return anchors[rawAnchor] || anchors[anchor] || null;
  }
  return null;
}

function tikzquadsPortY(halfHeight) {
  return halfHeight * (5 / 7);
}

function tikzquadsOuterExt(halfWidth, kind) {
  return kind === "black box" ? halfWidth * (5 / 19) : halfWidth * (5 / 33);
}

function tikzquadsInnerExt(halfSize) {
  return halfSize / 7;
}

function shapeCompassLocalAnchor(shape, anchor, halfWidth, halfHeight) {
  if (shape !== "circle" && shape !== "circleCrossSplit" && shape !== "ellipse") return null;
  if (halfWidth <= 0 || halfHeight <= 0) return null;
  const dx = anchor.includes("east") ? 1 : anchor.includes("west") ? -1 : 0;
  const dy = anchor.includes("north") ? 1 : anchor.includes("south") ? -1 : 0;
  if (!dx && !dy) return null;
  if (shape === "circle" || shape === "circleCrossSplit") {
    const radius = Math.max(halfWidth, halfHeight);
    const length = Math.hypot(dx, dy) || 1;
    return { x: (dx / length) * radius, y: (dy / length) * radius };
  }
  const scale = 1 / Math.sqrt((dx * dx) / (halfWidth * halfWidth) + (dy * dy) / (halfHeight * halfHeight));
  return { x: dx * scale, y: dy * scale };
}

function arrowNodeLocalAnchor(shape, anchor, size) {
  const points = arrowNodeLocalPoints(shape, size);
  const byName = Object.fromEntries(points.map((point) => [point.name, { x: point.x, y: point.y }]));
  const aliases = {
    tip: "tip",
    "tip 1": "tip 1",
    "tip 2": "tip 2",
    tail: "tail",
    "before tail": "before tail",
    "after tail": "after tail",
    "before head": "before head",
    "after head": "after head",
    "before head 1": "before head 1",
    "after head 1": "after head 1",
    "before head 2": "before head 2",
    "after head 2": "after head 2",
    "before tip": "before tip",
    "after tip": "after tip",
    "before tip 1": "before tip 1",
    "after tip 1": "after tip 1",
    "before tip 2": "before tip 2",
    "after tip 2": "after tip 2"
  };
  const named = byName[aliases[anchor] || anchor];
  if (named) return named;
  if (anchor === "east") return byName.tip || byName["tip 1"] || null;
  if (anchor === "west") return byName.tail || byName["tip 2"] || null;
  if (anchor === "north") return topmostPoint(points);
  if (anchor === "south") return bottommostPoint(points);
  if (anchor === "north east") return cornerPoint(points, 1, 1);
  if (anchor === "south east") return cornerPoint(points, 1, -1);
  if (anchor === "north west") return cornerPoint(points, -1, 1);
  if (anchor === "south west") return cornerPoint(points, -1, -1);
  return null;
}

function arrowNodeLocalPoints(shape, size = {}) {
  const halfWidth = (Number(size.width) || 0) / 2;
  const halfHeight = (Number(size.height) || 0) / 2;
  const data = size.shapeData || {};
  const headExtend = Math.max(0, Number(data.arrowHeadExtend) || 0.25);
  const headIndent = Math.max(0, Number(data.arrowHeadIndent) || 0);
  const headLength = Math.min(halfWidth * 0.82, Math.max(halfHeight * 0.82, headExtend * 1.15, 0.12));
  const bodyHalf = Math.max(0.02, Math.min(halfHeight * 0.72, halfHeight - Math.min(headExtend, halfHeight * 0.48)));
  const indent = Math.min(Math.max(0, headIndent), headLength * 0.7);
  const rotate = Number(data.shapeBorderRotate) || 0;
  const rightBase = halfWidth - headLength;
  const rightNeck = rightBase + indent;
  let points;
  if (shape === "doubleArrow") {
    const leftBase = -rightBase;
    const leftNeck = -rightNeck;
    points = [
      { name: "tip 1", x: halfWidth, y: 0 },
      { name: "before tip 1", x: rightBase, y: halfHeight },
      { name: "before head 1", x: rightNeck, y: bodyHalf },
      { name: "after head 2", x: leftNeck, y: bodyHalf },
      { name: "after tip 2", x: leftBase, y: halfHeight },
      { name: "tip 2", x: -halfWidth, y: 0 },
      { name: "before tip 2", x: leftBase, y: -halfHeight },
      { name: "before head 2", x: leftNeck, y: -bodyHalf },
      { name: "after head 1", x: rightNeck, y: -bodyHalf },
      { name: "after tip 1", x: rightBase, y: -halfHeight }
    ];
  } else {
    points = [
      { name: "tip", x: halfWidth, y: 0 },
      { name: "before tip", x: rightBase, y: halfHeight },
      { name: "before head", x: rightNeck, y: bodyHalf },
      { name: "after tail", x: -halfWidth, y: bodyHalf },
      { name: "tail", x: -halfWidth, y: 0 },
      { name: "before tail", x: -halfWidth, y: -bodyHalf },
      { name: "after head", x: rightNeck, y: -bodyHalf },
      { name: "after tip", x: rightBase, y: -halfHeight }
    ];
  }
  return rotate ? points.map((point) => ({ ...point, ...rotateVector(point.x, point.y, rotate) })) : points;
}

function topmostPoint(points) {
  return points.reduce((best, point) => (point.y > best.y ? point : best), points[0] || { x: 0, y: 0 });
}

function bottommostPoint(points) {
  return points.reduce((best, point) => (point.y < best.y ? point : best), points[0] || { x: 0, y: 0 });
}

function cornerPoint(points, xSign, ySign) {
  return points.reduce((best, point) => {
    const score = point.x * xSign + point.y * ySign;
    return score > best.score ? { point, score } : best;
  }, { point: points[0] || { x: 0, y: 0 }, score: -Infinity }).point;
}

function angleAnchor(node, angle, halfWidth, halfHeight) {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  if (node.shape === "circle" || node.shape === "circleCrossSplit") {
    const radius = Math.max(halfWidth, halfHeight);
    return roundPoint({ x: node.point.x + cos * radius, y: node.point.y + sin * radius });
  }
  if (node.shape === "ellipse") {
    const scale = 1 / Math.sqrt((cos * cos) / (halfWidth * halfWidth) + (sin * sin) / (halfHeight * halfHeight));
    return roundPoint({ x: node.point.x + cos * scale, y: node.point.y + sin * scale });
  }
  if (node.shape === "diamond") {
    const scale = 1 / (Math.abs(cos) / halfWidth + Math.abs(sin) / halfHeight);
    return roundPoint({ x: node.point.x + cos * scale, y: node.point.y + sin * scale });
  }
  if (node.shape === "cloud") {
    const scale = 1 / Math.sqrt((cos * cos) / (halfWidth * halfWidth) + (sin * sin) / (halfHeight * halfHeight));
    return roundPoint({ x: node.point.x + cos * scale, y: node.point.y + sin * scale });
  }
  if (polygonNodeShape(node.shape)) {
    const toward = { x: node.point.x + cos, y: node.point.y + sin };
    return polygonBorderPoint(node.point, toward, nodePolygonPoints(node, node.point, halfWidth, halfHeight));
  }
  const xScale = Math.abs(cos) > 1e-12 ? halfWidth / Math.abs(cos) : Number.POSITIVE_INFINITY;
  const yScale = Math.abs(sin) > 1e-12 ? halfHeight / Math.abs(sin) : Number.POSITIVE_INFINITY;
  const scale = Math.min(xScale, yScale);
  if (!Number.isFinite(scale)) return roundPoint(node.point);
  return roundPoint({ x: node.point.x + cos * scale, y: node.point.y + sin * scale });
}

function diamondAnchorCoordinate(node, anchor, halfWidth, halfHeight) {
  if (anchor === "north") return roundPoint({ x: node.point.x, y: node.point.y + halfHeight });
  if (anchor === "south") return roundPoint({ x: node.point.x, y: node.point.y - halfHeight });
  if (anchor === "east") return roundPoint({ x: node.point.x + halfWidth, y: node.point.y });
  if (anchor === "west") return roundPoint({ x: node.point.x - halfWidth, y: node.point.y });
  if (anchor === "north east") return roundPoint({ x: node.point.x + halfWidth / 2, y: node.point.y + halfHeight / 2 });
  if (anchor === "north west") return roundPoint({ x: node.point.x - halfWidth / 2, y: node.point.y + halfHeight / 2 });
  if (anchor === "south east") return roundPoint({ x: node.point.x + halfWidth / 2, y: node.point.y - halfHeight / 2 });
  if (anchor === "south west") return roundPoint({ x: node.point.x - halfWidth / 2, y: node.point.y - halfHeight / 2 });
  return roundPoint(node.point);
}

function resolveCurrentBoundingBoxCoordinate(text, env) {
  const match = String(text || "").trim().toLowerCase().match(/^current bounding box(?:\.(.+))?$/);
  if (!match || typeof env.currentBoundingBox !== "function") return null;
  const bounds = env.currentBoundingBox();
  if (!bounds) return null;
  const anchor = (match[1] || "center").replace(/-/g, " ").trim();
  const xCenter = (bounds.minX + bounds.maxX) / 2;
  const yCenter = (bounds.minY + bounds.maxY) / 2;
  let x = xCenter;
  let y = yCenter;
  if (anchor.includes("west")) x = bounds.minX;
  if (anchor.includes("east")) x = bounds.maxX;
  if (anchor.includes("south")) y = bounds.minY;
  if (anchor.includes("north")) y = bounds.maxY;
  return roundPoint({ x, y });
}

function computeCurrentBoundingBox(ir) {
  return computeItemsBoundingBox([...(ir.backgroundItems || []), ...(ir.items || [])]);
}

function computeItemsBoundingBox(items = [], fallback = { minX: 0, minY: 0, maxX: 0, maxY: 0 }) {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const include = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
  };
  for (const item of items) {
    includeItemBounds(item, include);
  }
  if (!Number.isFinite(bounds.minX)) return fallback;
  return bounds;
}

function includeItemBounds(item, include) {
  if (item.type === "nodeBox") {
    include(item.x - item.width / 2, item.y - item.height / 2);
    include(item.x + item.width / 2, item.y + item.height / 2);
    return;
  }
  if (item.projected && item.type === "path") {
    includePathItemBounds(item, include);
    return;
  }
  if (item.shape === "circle") {
    include(item.cx - item.r, item.cy - item.r);
    include(item.cx + item.r, item.cy + item.r);
    return;
  }
  if (item.shape === "ellipse") {
    include(item.cx - item.rx, item.cy - item.ry);
    include(item.cx + item.rx, item.cy + item.ry);
    return;
  }
  if (item.type === "path") {
    includePathItemBounds(item, include);
    return;
  }
  if (item.type === "textNode") {
    includeTextNodeItemBounds(item, include);
    return;
  }
  if (item.type === "marker") {
    include(item.x, item.y);
  }
}

function includeTextNodeItemBounds(item, include) {
  const normalized = normalizeTikzText(item.text);
  if (normalized.invisible) return;
  const scale = Number(item.style?.fontScale) || 1;
  let width = 0;
  let height = 0;
  if (normalized.kind === "image") {
    width = normalized.width * scale;
    height = normalized.height * scale;
  } else {
    const typewriter = fontFamilyUsesTypewriter(item.style?.fontFamily || normalized.fontFamily);
    const wrapWidth = Number(item.wrapWidth);
    const usesWrappedWidth = Number.isFinite(wrapWidth) && wrapWidth > 0;
    const metricNormalized = usesWrappedWidth ? wrappedTextMetricNormalized(normalized, wrapWidth) : normalized;
    const textBox = scaleTextMetricBox(estimateTextMetricBox(metricNormalized, {
      widthFactor: typewriter ? 0.187 : 0.13,
      fixedCharWidth: typewriter ? 0.187 : undefined,
      lineHeight: typewriter ? 0.236 : usesWrappedWidth ? 0.32 : 0.18,
      lineGap: typewriter ? 0.187 : usesWrappedWidth ? 0.08 : undefined,
      minHeight: 0.18,
      formulaMinWidth: 0.08,
      formulaWidthPadding: 0
    }), normalized.explicitFontSize ? Number(item.style?.fontSizeBaseScale) || 1 : scale);
    width = Math.max(0.08, usesWrappedWidth ? Math.min(textBox.width, wrapWidth) : textBox.width);
    height = Math.max(0.08, textBox.height);
  }
  include(item.x - width / 2, item.y - height / 2);
  include(item.x + width / 2, item.y + height / 2);
}

function wrappedTextMetricNormalized(normalized, wrapWidth) {
  const sourceLines = normalized.lines.length ? normalized.lines : String(normalized.text || "").split(/\\\\|\n/);
  const metricLines = textMetricLines(normalized);
  const maxChars = textWidthMaxChars(wrapWidth, {}, { variables: {} });
  const lineStyles = Array.isArray(normalized.lineStyles) ? normalized.lineStyles : [];
  const wrappedLines = [];
  const wrappedStyles = [];
  metricLines.forEach((line, index) => {
    const wrapped = wrapTextMetricLine(line, maxChars);
    for (const wrappedLine of wrapped) {
      wrappedLines.push(wrappedLine);
      wrappedStyles.push(lineStyles[index] || {});
    }
  });
  return {
    ...normalized,
    text: wrappedLines.join(String.raw`\\`),
    raw: sourceLines.join(String.raw`\\`),
    lines: wrappedLines,
    lineStyles: wrappedStyles
  };
}

function includePathItemBounds(item, include) {
  let current = null;
  let start = null;
  for (const command of item.commands || []) {
    if (command.type === "moveTo") {
      current = { x: command.x, y: command.y };
      start = current;
      include(command.x, command.y);
      continue;
    }
    if (command.type === "lineTo") {
      current = { x: command.x, y: command.y };
      include(command.x, command.y);
      continue;
    }
    if (command.type === "curveTo") {
      if (current && item.tightBezierBounds) includeCubicBounds(current, command, include);
      else {
        include(command.x1, command.y1);
        include(command.x2, command.y2);
        include(command.x, command.y);
      }
      current = { x: command.x, y: command.y };
      continue;
    }
    if (command.type === "closePath" && start) {
      include(start.x, start.y);
      current = start;
      continue;
    }
    if ("x" in command && "y" in command) {
      include(command.x, command.y);
      current = { x: command.x, y: command.y };
    }
  }
}

function includeCubicBounds(from, curve, include) {
  const p0 = from;
  const p1 = { x: curve.x1, y: curve.y1 };
  const p2 = { x: curve.x2, y: curve.y2 };
  const p3 = { x: curve.x, y: curve.y };
  include(p0.x, p0.y);
  include(p3.x, p3.y);
  for (const t of cubicExtrema(p0.x, p1.x, p2.x, p3.x)) {
    const point = cubicPoint(p0, p1, p2, p3, t);
    include(point.x, point.y);
  }
  for (const t of cubicExtrema(p0.y, p1.y, p2.y, p3.y)) {
    const point = cubicPoint(p0, p1, p2, p3, t);
    include(point.x, point.y);
  }
}

function cubicExtrema(p0, p1, p2, p3) {
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  const roots = [];
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) >= 1e-12) roots.push(-c / b);
  } else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= -1e-12) {
      const sqrt = Math.sqrt(Math.max(0, discriminant));
      roots.push((-b - sqrt) / (2 * a), (-b + sqrt) / (2 * a));
    }
  }
  return roots.filter((t) => t > 1e-9 && t < 1 - 1e-9);
}

function cubicPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: p0.x * a + p1.x * b + p2.x * c + p3.x * d,
    y: p0.y * a + p1.y * b + p2.y * c + p3.y * d
  };
}

function polygonNodeShape(shape) {
  return shape === "regularPolygon" || shape === "star" || shape === "trapezium" || shape === "isoscelesTriangle" || arrowNodeShape(shape);
}

function nodePolygonPoints(node, center, halfWidth, halfHeight) {
  const data = node.shapeData || {};
  if (node.shape === "regularPolygon") {
    return regularPolygonPoints(center, halfWidth, halfHeight, data.regularPolygonSides || 5, 90);
  }
  if (node.shape === "star") {
    return starPolygonPoints(center, halfWidth, halfHeight, data.starPoints || 5, data.starPointRatio || 1.5);
  }
  if (node.shape === "trapezium") {
    return trapeziumPoints(center, halfWidth, halfHeight, data);
  }
  if (node.shape === "isoscelesTriangle") {
    return isoscelesTrianglePoints(center, halfWidth, halfHeight);
  }
  if (arrowNodeShape(node.shape)) {
    return arrowNodeLocalPoints(node.shape, { width: halfWidth * 2, height: halfHeight * 2, shapeData: data }).map((point) => ({
      x: center.x + point.x,
      y: center.y + point.y
    }));
  }
  return rectanglePoints(center, halfWidth, halfHeight);
}

function regularPolygonPoints(center, halfWidth, halfHeight, sides, startAngle = 90) {
  return Array.from({ length: sides }, (_unused, index) => {
    const angle = ((startAngle + (360 * index) / sides) * Math.PI) / 180;
    return {
      x: center.x + Math.cos(angle) * halfWidth,
      y: center.y + Math.sin(angle) * halfHeight
    };
  });
}

function starPolygonPoints(center, halfWidth, halfHeight, points, ratio) {
  const total = points * 2;
  const innerRatio = 1 / ratio;
  return Array.from({ length: total }, (_unused, index) => {
    const outer = index % 2 === 0;
    const angle = ((90 + (360 * index) / total) * Math.PI) / 180;
    const scale = outer ? 1 : innerRatio;
    return {
      x: center.x + Math.cos(angle) * halfWidth * scale,
      y: center.y + Math.sin(angle) * halfHeight * scale
    };
  });
}

function trapeziumPoints(center, halfWidth, halfHeight, data = {}) {
  const left = Math.max(10, Math.min(170, data.trapeziumLeftAngle || 60));
  const right = Math.max(10, Math.min(170, data.trapeziumRightAngle || 60));
  const leftInset = Math.cos((left * Math.PI) / 180) * halfHeight * 0.7;
  const rightInset = Math.cos((right * Math.PI) / 180) * halfHeight * 0.7;
  return [
    { x: center.x - halfWidth + leftInset, y: center.y + halfHeight },
    { x: center.x + halfWidth - rightInset, y: center.y + halfHeight },
    { x: center.x + halfWidth + rightInset, y: center.y - halfHeight },
    { x: center.x - halfWidth - leftInset, y: center.y - halfHeight }
  ];
}

function isoscelesTrianglePoints(center, halfWidth, halfHeight) {
  return [
    { x: center.x + halfWidth, y: center.y },
    { x: center.x - halfWidth, y: center.y + halfHeight },
    { x: center.x - halfWidth, y: center.y - halfHeight }
  ];
}

function rectanglePoints(center, halfWidth, halfHeight) {
  return [
    { x: center.x - halfWidth, y: center.y + halfHeight },
    { x: center.x + halfWidth, y: center.y + halfHeight },
    { x: center.x + halfWidth, y: center.y - halfHeight },
    { x: center.x - halfWidth, y: center.y - halfHeight }
  ];
}

function polygonBorderPoint(center, toward, points) {
  const direction = { x: toward.x - center.x, y: toward.y - center.y };
  const candidates = [];
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const hit = raySegmentIntersection(center, direction, a, b);
    if (hit && hit.t >= -1e-9) candidates.push(hit);
  }
  candidates.sort((a, b) => a.t - b.t);
  return candidates[0] ? roundPoint(candidates[0].point) : roundPoint(center);
}

function raySegmentIntersection(origin, direction, a, b) {
  const edge = { x: b.x - a.x, y: b.y - a.y };
  const denom = cross(direction, edge);
  if (Math.abs(denom) < 1e-12) return null;
  const delta = { x: a.x - origin.x, y: a.y - origin.y };
  const t = cross(delta, edge) / denom;
  const u = cross(delta, direction) / denom;
  if (t < -1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  return {
    t,
    point: {
      x: origin.x + direction.x * t,
      y: origin.y + direction.y * t
    }
  };
}

function cross(a, b) {
  return a.x * b.y - a.y * b.x;
}

function projectBasisPoint(x, y, z, basis = parsePictureBasis()) {
  return roundPoint({
    x: x * basis.x.x + y * basis.y.x + z * basis.z.x,
    y: x * basis.x.y + y * basis.y.y + z * basis.z.y
  });
}

function resolveCalc(text, env, diagnostics) {
  return resolveCalcExpression(text, env, diagnostics, calcLibraryHelpers());
}

function resolveCalcOffset(text, env, diagnostics) {
  return resolveCalcOffsetExpression(text, env, diagnostics, calcLibraryHelpers());
}

function calcLibraryHelpers() {
  return {
    resolveCoordinate,
    applyTransformVector,
    projectBasisPoint
  };
}

function materializeIntersections(raw, env, diagnostics) {
  const parsed = parseOptions(raw);
  const of = parsed.of || "";
  const by = parsed.by || "";
  const [first, second] = String(of)
    .split(/\s+and\s+/)
    .map((part) => part.trim());
  const names = stripOuterBraces(by)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const pathA = env.namedPaths[first];
  const pathB = env.namedPaths[second];
  if (!pathA || !pathB) {
    diagnostics.push({ severity: "warning", message: `Cannot resolve named paths for intersection: ${of}` });
    return;
  }
  const intersections = pathIntersections(pathA, pathB);
  intersections.forEach((point, index) => {
    const baseName = parsed.name ? String(parsed.name).trim() : "intersection";
    const name = names[index] || `${baseName}-${index + 1}`;
    env.coordinates[name] = roundPoint(point);
  });
  if (parsed.total) {
    env.variables[String(parsed.total).replace(/^\\/, "").trim()] = intersections.length;
  }
}

function repeatedSemanticValues(value) {
  return Array.isArray(value) ? value : [value];
}

function addDecorationMarkers(item, options, ir) {
  const decoration = markingsDecorationFromOptions(options);
  if (!decoration) return;
  const mark = String(decoration).match(/mark\s*=\s*at\s+position\s+([0-9.]+)\s+with\s*\{([\s\S]+)\}/);
  const flat = flattenPath(item.commands || []);
  if (mark) {
    addArrowMarkerAt(Number(mark[1]), mark[2], flat, item, ir);
    return;
  }
  const between = String(decoration).match(
    /mark\s*=\s*between\s+positions\s+([0-9.]+)\s+and\s+([0-9.]+)\s+step\s+([0-9.]+)\s+with\s*\{([\s\S]+)\}/
  );
  if (!between) return;
  const start = Number(between[1]);
  const end = Number(between[2]);
  const step = Number(between[3]);
  for (let position = start; position <= end + 1e-9; position += step) {
    addArrowMarkerAt(position, between[4], flat, item, ir);
  }
}

function markingsDecorationFromOptions(options = {}) {
  const topLevelDecoration = options.decoration === undefined ? "" : String(options.decoration);
  if (topLevelDecoration.includes("markings")) return topLevelDecoration;
  const postaction = options.postaction === undefined ? "" : String(options.postaction);
  if (!postaction.includes("decorate")) return "";
  const postOptions = parseOptions(postaction);
  const nestedDecoration = postOptions.decoration === undefined ? "" : String(postOptions.decoration);
  return nestedDecoration.includes("markings") ? nestedDecoration : "";
}

function addArrowMarkerAt(position, body, flat, item, ir) {
  const arrow = String(body).match(/\\arrow\s*\{([^}]*)\}/);
  if (!arrow) return;
  const tip = createArrowTip(arrow[1].trim() || "to");
  const point = pointAtLength(flat, position);
  ir.items.push({
    type: "marker",
    subtype: /feynman momentum/.test(String(body))
      ? "feynman-momentum"
      : /feynhand momentum/.test(String(body))
        ? "feynhand-momentum"
        : undefined,
    kind: tip.kind,
    tip,
    x: roundNumber(point.x),
    y: roundNumber(point.y),
    angle: roundNumber(point.angle),
    style: {
      stroke: item.style.stroke === "none" ? "black" : item.style.stroke,
      fill: item.style.stroke === "none" ? "black" : item.style.stroke
    }
  });
}

function drawablePathStyle(style, styleHints = {}) {
  const merged = { ...style, ...styleHints };
  if ((merged.markerStart || merged.markerEnd) && merged.stroke === "none") merged.stroke = "black";
  return merged;
}

function pathShadingStyle(style = {}, semantic = {}, env = {}) {
  const topColor = semantic["top color"];
  const bottomColor = semantic["bottom color"];
  if (topColor || bottomColor) {
    const top = normalizeColor(String(topColor || "white"));
    const bottom = normalizeColor(String(bottomColor || style.fill || "black"));
    return {
      shading: "axis",
      topColor: top,
      bottomColor: bottom,
      fill: bottom
    };
  }
  const shadingName = String(semantic.shading || "").trim();
  const declared = shadingName ? env.shadings?.[shadingName] : null;
  if (declared?.type === "radial") {
    const stops = (declared.stops || []).map((stop) => ({
      offset: Math.max(0, Math.min(1, Number(stop.offset) || 0)),
      color: normalizeColor(String(stop.color || style.fill || "black")),
      opacity: Math.max(0, Math.min(1, Number(stop.opacity ?? 1)))
    }));
    return {
      shading: "radial",
      shadingName,
      radialStops: stops.length ? stops : [
        { offset: 0, color: "white", opacity: 1 },
        { offset: 1, color: normalizeColor(String(style.fill || "black")), opacity: 1 }
      ],
      fill: normalizeColor(String(style.fill === "none" ? "black" : style.fill || "black"))
    };
  }
  if (shadingName !== "ball") return {};
  const color = normalizeColor(String(semantic["ball color"] || style.fill || "gray!30"));
  return {
    shading: "ball",
    ballColor: color,
    fill: color
  };
}

function doublePathStyle(semantic = {}, env = { variables: {} }) {
  if (semantic.double === undefined) return {};
  const rawColor = semantic.double;
  if (rawColor === false || String(rawColor).trim().toLowerCase() === "none") return {};
  const style = {
    doubleColor: rawColor === true || rawColor === "" ? "white" : normalizeColor(String(rawColor))
  };
  if (semantic["double distance"] !== undefined) {
    const distance = parseDimension(semantic["double distance"], env.variables) * TIKZ_UNIT * canvasLengthScale(env);
    if (Number.isFinite(distance) && distance >= 0) style.doubleDistance = distance;
  }
  return style;
}

function isVisiblePath(command, style, semantic, styleHints = {}) {
  if (command === "draw" || command === "fill") return true;
  if (style.markerStart || style.markerEnd || styleHints.markerStart || styleHints.markerEnd) return true;
  if (semantic["name path"] && style.stroke === "none" && style.fill === "none") return false;
  return style.stroke !== "none" || style.fill !== "none";
}
