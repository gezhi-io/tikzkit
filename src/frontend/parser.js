import { createToken, Lexer } from "chevrotain";
import { codeDefinitionsFromOptions, isBareDelimiterOptionBracket, parseOptions, parseTikzset, splitTopLevel } from "../engine/options.js";
import { preprocessTikzSource } from "./latex-shell.js";

const WhiteSpace = createToken({ name: "WhiteSpace", pattern: /\s+/, group: Lexer.SKIPPED });
const Command = createToken({ name: "Command", pattern: /\\[A-Za-z@]+|\\./ });
const NumberLiteral = createToken({ name: "NumberLiteral", pattern: /-?\d+(?:\.\d+)?/ });
const Arrow = createToken({ name: "Arrow", pattern: /<->|->|<-/ });
const DashDash = createToken({ name: "DashDash", pattern: /--/ });
const DotDot = createToken({ name: "DotDot", pattern: /\.\./ });
const Identifier = createToken({ name: "Identifier", pattern: /[A-Za-z_][A-Za-z0-9_./-]*/ });
const SymbolToken = createToken({ name: "SymbolToken", pattern: /[()[\]{},;=:$!+*/-]/ });
const Other = createToken({ name: "Other", pattern: /./ });

const TikzLexer = new Lexer([
  WhiteSpace,
  Command,
  Arrow,
  DashDash,
  DotDot,
  NumberLiteral,
  Identifier,
  SymbolToken,
  Other
]);

export function parseTikz(source, options = {}) {
  const preprocessed = preprocessTikzSource(source, options);
  const diagnostics = [...preprocessed.diagnostics];
  const libraries = preprocessed.libraries || [];
  const packages = preprocessed.packages || [];
  const pgfplotsLibraries = preprocessed.pgfplotsLibraries || [];
  const pgfplotsOptions = preprocessed.pgfplotsOptions || {};
  const previewBorder = preprocessed.previewBorder;
  const randomLists = collectPgfMathRandomLists(preprocessed.source);
  const shadingDefinitions = collectShadingDefinitions(preprocessed.source);
  const coordinateSystems = collectCoordinateSystemDefinitions(preprocessed.source);
  const lexed = TikzLexer.tokenize(preprocessed.source);
  for (const error of lexed.errors) {
    diagnostics.push({
      severity: "error",
      message: error.message,
      offset: error.offset
    });
  }

  const scannedPictures = extractTikzPictures(preprocessed.source);
  const tabularLayouts = extractTabularPictureLayouts(preprocessed.source, scannedPictures);
  if (scannedPictures.length === 0 && tabularLayouts.length === 0 && preprocessed.source.trim()) {
    scannedPictures.push({ index: 0, beginIndex: 0, bodyEndIndex: preprocessed.source.length, endIndex: preprocessed.source.length, optionsRaw: "", body: preprocessed.source });
  }
  const figures = scannedPictures.map((picture, index) => createFigureInventoryItem(picture, index));
  const activeFigureIndex = resolveActiveFigureIndex(options.activeFigureId, scannedPictures.length);
  const picturesToParse = activeFigureIndex == null ? scannedPictures : [scannedPictures[activeFigureIndex]].filter(Boolean);
  const activePictureIndices = new Set(picturesToParse.map((picture) => picture.index));
  const activeTabularLayouts = activeFigureIndex == null
    ? tabularLayouts
    : tabularLayouts.filter((layout) => layout.rows.every((row) => row.cells.every((cell) =>
      cell.pictureIndices.every((pictureIndex) => activePictureIndices.has(pictureIndex))
    )));
  const tabularLayoutsByPicture = new Map();
  for (const layout of activeTabularLayouts) {
    for (const row of layout.rows) {
      for (const cell of row.cells) {
        for (const pictureIndex of cell.pictureIndices) {
          tabularLayoutsByPicture.set(pictureIndex, {
            layoutId: layout.id,
            row: row.index,
            column: cell.column
          });
        }
      }
    }
  }
  const pictures = picturesToParse.map((picture) => {
    const prePictureSource = preprocessed.source.slice(0, picture.beginIndex);
    const globalStyles = collectStyleDefinitions(prePictureSource);
    const globalOptions = collectTikzsetDirectOptions(prePictureSource);
    const globalCodeHandlers = collectCodeDefinitions(prePictureSource);
    const globalPics = collectPicDefinitions(prePictureSource);
    const globalStoredVariables = collectTikzsetStoredVariables(prePictureSource);
    const globalPatternDeclarations = collectPgfFormOnlyPatternDeclarations(prePictureSource);
    const globalPgfMath = collectPgfMathMacros(prePictureSource);
    const globalCoordinateSystems = collectCoordinateSystemDefinitions(prePictureSource);
    const statements = parseStatements(picture.body, diagnostics);
    return {
      type: "tikzpicture",
      beginIndex: picture.beginIndex,
      bodyEndIndex: picture.bodyEndIndex,
      endIndex: picture.endIndex,
      figureId: `figure:${picture.index}`,
      figureIndex: picture.index,
      graphicxResize: picture.graphicxResize,
      tabularLayout: tabularLayoutsByPicture.get(picture.index) || null,
      options: { ...globalOptions, ...parseOptions(picture.optionsRaw) },
      styles: globalStyles,
      codeHandlers: globalCodeHandlers,
      pics: globalPics,
      storedVariables: globalStoredVariables,
      patternDeclarations: globalPatternDeclarations,
      coordinateSystems: globalCoordinateSystems,
      pgfMathMacros: globalPgfMath,
      randomLists,
      libraries,
      packages,
      pgfplotsLibraries,
      pgfplotsOptions,
      previewBorder,
      shadings: shadingDefinitions,
      body: picture.body,
      statements
    };
  });

  return {
    ast: {
      type: "document",
      source: preprocessed.source,
      originalSource: source,
      tokenCount: lexed.tokens.length,
      libraries,
      packages,
      pgfplotsLibraries,
      pgfplotsOptions,
      previewBorder,
      shadings: shadingDefinitions,
      coordinateSystems,
      tabularLayouts: activeTabularLayouts,
      figures,
      activeFigureId: activeFigureIndex == null ? null : `figure:${activeFigureIndex}`,
      pictures
    },
    diagnostics
  };
}

function createFigureInventoryItem(picture, index) {
  return {
    id: `figure:${index}`,
    index,
    beginIndex: picture.beginIndex,
    bodyEndIndex: picture.bodyEndIndex,
    endIndex: picture.endIndex
  };
}

function resolveActiveFigureIndex(activeFigureId, count) {
  if (!activeFigureId) return null;
  if (count <= 0) return null;
  const match = /^figure:(\d+)(?::|$)/.exec(String(activeFigureId).trim());
  if (!match) return 0;
  const index = Number.parseInt(match[1], 10);
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(count - 1, index));
}

export function parseStatements(body, diagnostics = []) {
  const statements = [];
  for (const statement of splitStatements(body)) {
    const parsed = parseStatement(statement, diagnostics);
    if (parsed) statements.push(parsed);
  }
  return statements;
}

function parseStatement(statement, diagnostics) {
  const text = statement.trim().replace(/;$/, "").trim();
  if (!text) return null;
  // The imported LaTeX-examples CFB source contains a bare TODO marker inside
  // the picture. TeX leaves it out of the graphic, so it must not become a
  // visible or diagnostic TikZ statement in the browser renderer.
  if (text === "TODO") return { type: "noop", raw: text };
  const fontPrefix = parseLeadingFontSwitches(text);
  if (fontPrefix) {
    if (!fontPrefix.rest) {
      return { type: "font", font: fontPrefix.font, raw: text };
    }
    const parsed = parseStatement(fontPrefix.rest, diagnostics);
    if (parsed) {
      parsed.leadingFont = [fontPrefix.font, parsed.leadingFont].filter(Boolean).join(" ");
      parsed.raw = text;
    }
    return parsed;
  }
  if (text.startsWith("\\foreach")) return parseForeach(text, diagnostics);
  if (text.startsWith("\\chainin")) return parseChaininStatement(text, diagnostics);
  if (text.startsWith("\\coordinate")) return parseCoordinateStatement(text, diagnostics);
  if (text.startsWith("\\pgfmathsetlengthmacro")) return parsePgfMathSetLength(text, diagnostics);
  if (text.startsWith("\\pgfmathsetmacro")) return parsePgfMath(text, diagnostics);
  if (text.startsWith("\\pgfmathtruncatemacro")) return parsePgfMathTruncate(text, diagnostics);
  if (text.startsWith("\\pgfmathdeclarerandomlist")) return parsePgfMathDeclareRandomList(text, diagnostics);
  if (text.startsWith("\\pgfmathrandomitem")) return parsePgfMathRandomItem(text, diagnostics);
  if (text.startsWith("\\pgfdeclarepatternformonly")) return parsePgfDeclarePatternFormOnly(text, diagnostics);
  if (text.startsWith("\\ifthenelse")) return parseIfThenElse(text, diagnostics);
  if (text === "\\breakforeach") return { type: "breakforeach", raw: text };
  if (text.startsWith("\\ifnum")) return parseIfNum(text, diagnostics);
  if (text.startsWith("\\pgftransformcm")) return parsePgfTransformCm(text);
  if (text.startsWith("\\pgftransformreset")) return { type: "pgftransformreset", raw: text };
  if (text.startsWith("\\pgfresetboundingbox")) return { type: "pgfresetboundingbox", raw: text };
  if (text.startsWith("\\useasboundingbox")) {
    return parsePathCommand(
      "path",
      `[use as bounding box] ${text.slice("\\useasboundingbox".length).trim()}`,
      diagnostics
    );
  }
  if (text.startsWith("\\tikzset")) return parseTikzsetStatement(text, diagnostics);
  if (text.startsWith("\\tikzstyle")) return parseTikzstyleStatement(text);
  if (text.startsWith("\\color")) {
    const color = parseColorDeclaration(text);
    if (color) return { type: "color", color, raw: text };
  }
  if (text.startsWith("\\calendar")) return { type: "calendar", raw: text };
  if (text.startsWith("\\matrix")) return parseMatrix(text);
  if (text.startsWith("\\pic")) return parsePic(text);
  if (text.startsWith("\\spy")) return parseSpy(text);
  if (
    text.startsWith("\\toggletrue") ||
    text.startsWith("\\togglefalse") ||
    text.startsWith("\\newtoggle") ||
    text.startsWith("\\color") ||
    text.startsWith("\\linespread") ||
    text.startsWith("\\definecolor") ||
    text.startsWith("\\ctikzset") ||
    text.startsWith("\\clip") ||
    text.startsWith("\\pgfplotsset") ||
    text.startsWith("\\pgfplotstableread") ||
    text.startsWith("\\pgfplotstabletypeset") ||
    text.startsWith("\\def") ||
    text.startsWith("\\braid")
  ) {
    return { type: "noop", raw: text };
  }
  if (text.startsWith("\\node")) return parseNode(text, diagnostics);
  if (isBracedScopeShorthand(text)) return parseScope(text, diagnostics);
  if (text.startsWith("{")) return parseBareScope(text, diagnostics);

  const command = text.match(/^\\([A-Za-z@]+)/)?.[1];
  if (["draw", "path", "fill", "filldraw", "shade"].includes(command)) {
    return parsePathCommand(command, text.slice(command.length + 1).trim(), diagnostics);
  }

  if (command) {
    return {
      type: "unsupported",
      command,
      raw: text,
      diagnostic: {
        severity: "warning",
        message: `Unsupported command \\${command}`
      }
    };
  }
  return {
    type: "unsupported",
    command: null,
    raw: text,
    diagnostic: {
      severity: "warning",
      message: `Unsupported TikZ statement: ${text.slice(0, 40)}`
    }
  };
}

function parseColorDeclaration(text) {
  const match = String(text || "").trim().match(/^\\color\s*\{([^{}]+)\}\s*$/);
  return match?.[1]?.trim() || null;
}

function parseForeach(text, diagnostics) {
  const header = parseForeachHeader(text);
  if (!header) {
    return unsupported("foreach", text, "Malformed \\foreach statement");
  }
  const parsed = parseForeachListAndBody(text, header.end);
  if (!parsed) return unsupported("foreach", text, "Malformed \\foreach value list");
  if (!parsed.body) {
    return {
      type: "foreach",
      variables: header.variables,
      options: header.options,
      values: splitTopLevel(parsed.listContent, ","),
      body: parseStatements(text.slice(parsed.bodyStart), diagnostics),
      bodySource: text.slice(parsed.bodyStart),
      raw: text
    };
  }
  return {
    type: "foreach",
    variables: header.variables,
    options: header.options,
    values: splitTopLevel(parsed.listContent, ","),
    body: parseStatements(parsed.body.content, diagnostics),
    bodySource: parsed.body.content,
    raw: text
  };
}

function parseForeachListAndBody(text, start) {
  let index = skipWhitespace(text, start);
  const first = extractBalanced(text, index, "{", "}");
  if (!first) {
    const variableList = parseForeachVariableList(text, index);
    if (!variableList) return null;
    return variableList;
  }
  let listContent = first.content;
  index = skipWhitespace(text, first.end);
  if (text[index] !== ",") {
    const bodyStart = index;
    const body = extractBalanced(text, bodyStart, "{", "}");
    return { listContent, body, bodyStart };
  }

  listContent = `{${first.content}}`;
  while (text[index] === ",") {
    const separator = index;
    index = skipWhitespace(text, index + 1);
    const next = extractBalanced(text, index, "{", "}");
    if (!next) {
      return { listContent, body: null, bodyStart: separator };
    }
    if (isForeachBodyCandidate(next.content)) {
      return { listContent, body: next, bodyStart: index };
    }
    listContent += `,{${next.content}}`;
    index = skipWhitespace(text, next.end);
  }

  const bodyStart = index;
  const body = extractBalanced(text, bodyStart, "{", "}");
  return { listContent, body, bodyStart };
}

function parseForeachVariableList(text, index) {
  if (text[index] !== "\\") return null;
  let cursor = index + 1;
  while (cursor < text.length && /[A-Za-z@]/.test(text[cursor])) cursor += 1;
  if (cursor === index + 1) return null;
  const listContent = text.slice(index, cursor);
  const bodyStart = skipWhitespace(text, cursor);
  const body = extractBalanced(text, bodyStart, "{", "}");
  return { listContent, body, bodyStart };
}

function isForeachBodyCandidate(content) {
  const text = String(content || "").trim();
  if (!text) return false;
  if (text.startsWith("\\foreach")) return true;
  if (text.startsWith("\\draw") || text.startsWith("\\path") || text.startsWith("\\node") || text.startsWith("\\fill")) return true;
  if (text.startsWith("\\coordinate") || text.startsWith("\\chainin") || text.startsWith("\\begin{scope}") || text.startsWith("{[")) return true;
  return /;\s*(?:$|\\|[{[])/.test(text);
}

function parseForeachHeader(text) {
  if (!text.startsWith("\\foreach")) return null;
  let index = skipWhitespace(text, "\\foreach".length);
  const inIndex = findForeachInKeyword(text, index);
  if (inIndex < 0) return null;
  const header = parseForeachVariablesAndOptions(text.slice(index, inIndex).trim());
  if (!header.variables.length) return null;
  return {
    ...header,
    end: skipWhitespace(text, inIndex + "in".length)
  };
}

function findForeachInKeyword(text, index) {
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  for (let cursor = index; cursor < text.length; cursor += 1) {
    const char = text[cursor];
    if (char === "(") paren += 1;
    if (char === ")") paren = Math.max(0, paren - 1);
    if (char === "[") bracket += 1;
    if (char === "]") bracket = Math.max(0, bracket - 1);
    if (char === "{") brace += 1;
    if (char === "}") brace = Math.max(0, brace - 1);
    if (paren || bracket || brace) continue;
    if (startsKeyword(text, cursor, "in")) return cursor;
  }
  return -1;
}

function parseForeachVariablesAndOptions(header) {
  let variablesRaw = header;
  let options = {};
  for (let index = 0; index < header.length; index += 1) {
    if (header[index] !== "[") continue;
    const parsed = extractBalanced(header, index, "[", "]");
    if (!parsed) break;
    variablesRaw = `${header.slice(0, index)} ${header.slice(parsed.end)}`.trim();
    options = parseOptions(parsed.content);
    break;
  }
  return {
    variables: variablesRaw
      .split("/")
      .map((part) => part.trim().replace(/^\\/, ""))
      .filter(Boolean),
    options
  };
}

function parseIfNum(text, diagnostics) {
  let index = skipWhitespace(text, "\\ifnum".length);
  const condition = parseIfNumCondition(text, index);
  if (!condition) return unsupported("ifnum", text, "Malformed \\ifnum conditional");
  index = condition.end;
  const branches = splitIfNumBranches(text.slice(index));
  if (!branches) return unsupported("ifnum", text, "Malformed \\ifnum branches");
  return {
    type: "ifnum",
    left: condition.left,
    operator: condition.operator,
    right: condition.right,
    thenBody: parseStatements(branches.thenSource, diagnostics),
    elseBody: parseStatements(branches.elseSource, diagnostics),
    raw: text
  };
}

function parseIfThenElse(text, diagnostics) {
  const parsed = parseIfThenElseArguments(text);
  if (!parsed || text.slice(parsed.end).trim()) {
    return unsupported("ifthenelse", text, "Malformed \\ifthenelse conditional");
  }
  return {
    type: "ifthenelse",
    condition: parsed.condition,
    thenBody: parseStatements(parsed.thenSource, diagnostics),
    elseBody: parseStatements(parsed.elseSource, diagnostics),
    raw: text
  };
}

function parseIfThenElseArguments(text) {
  let index = skipWhitespace(text, "\\ifthenelse".length);
  const condition = extractBalanced(text, index, "{", "}");
  if (!condition) return null;
  index = skipWhitespace(text, condition.end);
  const thenBranch = extractBalanced(text, index, "{", "}");
  if (!thenBranch) return null;
  index = skipWhitespace(text, thenBranch.end);
  const elseBranch = extractBalanced(text, index, "{", "}");
  if (!elseBranch) return null;
  return {
    condition: condition.content.trim(),
    thenSource: thenBranch.content,
    elseSource: elseBranch.content,
    end: elseBranch.end
  };
}

function parseIfNumCondition(text, start) {
  const left = readIfNumOperand(text, start);
  if (!left) return null;
  let index = skipWhitespace(text, left.end);
  const operator = text[index];
  if (!["=", "<", ">"].includes(operator)) return null;
  index = skipWhitespace(text, index + 1);
  const right = readIfNumOperand(text, index);
  if (!right) return null;
  return {
    left: left.value,
    operator,
    right: right.value,
    end: right.end
  };
}

function readIfNumOperand(text, start) {
  let index = skipWhitespace(text, start);
  if (text[index] === "{") {
    const group = extractBalanced(text, index, "{", "}");
    return group ? { value: group.content.trim(), end: group.end } : null;
  }
  if (text[index] === "\\") {
    const command = readCommandName(text, index + 1);
    return command ? { value: text.slice(index, command.end), end: command.end } : null;
  }
  const begin = index;
  while (index < text.length && !/[\s<>=]/.test(text[index])) index += 1;
  if (index === begin) return null;
  return { value: text.slice(begin, index).trim(), end: index };
}

function splitIfNumBranches(text) {
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  let depth = 0;
  let elseIndex = -1;
  let fiIndex = -1;
  let fiEnd = -1;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const topLevel = paren === 0 && bracket === 0 && brace === 0;
    if (topLevel && char === "\\") {
      const command = readCommandName(text, index + 1);
      if (command?.value === "ifnum") {
        depth += 1;
        index = command.end - 1;
        continue;
      }
      if (command?.value === "else" && depth === 0 && elseIndex === -1) {
        elseIndex = index;
        index = command.end - 1;
        continue;
      }
      if (command?.value === "fi") {
        if (depth === 0) {
          fiIndex = index;
          fiEnd = command.end;
          break;
        }
        depth = Math.max(0, depth - 1);
        index = command.end - 1;
        continue;
      }
    }
    if (brace === 0 && char === "(") paren += 1;
    else if (brace === 0 && char === ")") paren = Math.max(0, paren - 1);
    else if (brace === 0 && char === "[") bracket += 1;
    else if (brace === 0 && char === "]") bracket = Math.max(0, bracket - 1);
    else if (char === "{") brace += 1;
    else if (char === "}") brace = Math.max(0, brace - 1);
  }
  if (fiIndex === -1) return null;
  return {
    thenSource: (elseIndex === -1 ? text.slice(0, fiIndex) : text.slice(0, elseIndex)).trim(),
    elseSource: elseIndex === -1 ? "" : text.slice(elseIndex + "\\else".length, fiIndex).trim(),
    end: fiEnd
  };
}

function parseCoordinateStatement(text, diagnostics = []) {
  let index = "\\coordinate".length;
  const parsedOptions = parseOptionalOptions(text, index);
  const options = parsedOptions.options;
  index = skipWhitespace(text, parsedOptions.end);
  const name = extractBalanced(text, index, "(", ")");
  if (!name) {
    const treeChildren = parseNodeTreeChildren(text.slice(index), diagnostics);
    if (!treeChildren.children.length) {
      return unsupported("coordinate", text, "Malformed \\coordinate statement");
    }
    return {
      type: "coordinate",
      name: null,
      options,
      at: null,
      treeOptions: treeChildren.options,
      children: treeChildren.children,
      raw: text
    };
  }
  index = skipWhitespace(text, name.end);
  if (!text.startsWith("at", index)) {
    return {
      type: "coordinate",
      name: name.content.trim(),
      options,
      at: null,
      raw: text
    };
  }
  index = skipWhitespace(text, index + 2);
  const coord = parseCoordinateArgument(text, index);
  if (!coord) return unsupported("coordinate", text, "Malformed coordinate target");
  return {
    type: "coordinate",
    name: name.content.trim(),
    options,
    at: coord.content.trim(),
    raw: text
  };
}

function parseChaininStatement(text, diagnostics = []) {
  let index = "\\chainin".length;
  index = skipWhitespace(text, index);
  const target = extractBalanced(text, index, "(", ")");
  if (!target) return unsupported("chainin", text, "Malformed \\chainin target");
  index = skipWhitespace(text, target.end);
  const parsedOptions = parseOptionalOptions(text, index);
  return {
    type: "chainin",
    target: target.content.trim(),
    options: parsedOptions.options,
    raw: text
  };
}

function parsePgfMath(text) {
  const parsed = parsePgfMathTargetCommand(text, "\\pgfmathsetmacro");
  if (!parsed) return unsupported("pgfmathsetmacro", text, "Malformed \\pgfmathsetmacro statement");
  return {
    type: "pgfmathsetmacro",
    name: parsed.name,
    expression: parsed.expression,
    raw: text
  };
}

function parsePgfMathTruncate(text) {
  const parsed = parsePgfMathTargetCommand(text, "\\pgfmathtruncatemacro");
  if (!parsed) return unsupported("pgfmathtruncatemacro", text, "Malformed \\pgfmathtruncatemacro statement");
  return {
    type: "pgfmathtruncatemacro",
    name: parsed.name,
    expression: parsed.expression,
    raw: text
  };
}

function parsePgfMathSetLength(text) {
  const parsed = parsePgfMathTargetCommand(text, "\\pgfmathsetlengthmacro");
  if (!parsed) return unsupported("pgfmathsetlengthmacro", text, "Malformed \\pgfmathsetlengthmacro statement");
  return {
    type: "pgfmathsetlengthmacro",
    name: parsed.name,
    expression: parsed.expression,
    raw: text
  };
}

function parsePgfMathTargetCommand(text, command) {
  let index = command.length;
  index = skipWhitespace(text, index);
  let name = null;
  if (text[index] === "{") {
    const wrapped = extractBalanced(text, index, "{", "}");
    if (!wrapped) return null;
    name = wrapped.content.trim().replace(/^\\/, "");
    index = wrapped.end;
  } else if (text[index] === "\\") {
    const parsedName = readCommandName(text, index + 1);
    if (!parsedName) return null;
    name = parsedName.value;
    index = parsedName.end;
  }
  if (!name) return null;
  index = skipWhitespace(text, index);
  const expression = extractBalanced(text, index, "{", "}");
  if (!expression) return null;
  return {
    name,
    expression: expression.content.trim(),
    end: expression.end
  };
}

function parsePgfDeclarePatternFormOnly(text, diagnostics = []) {
  let index = skipWhitespace(text, "\\pgfdeclarepatternformonly".length);
  const optional = text[index] === "[" ? extractBalanced(text, index, "[", "]") : null;
  if (optional) index = skipWhitespace(text, optional.end);
  const name = extractBalanced(text, index, "{", "}");
  if (!name) return unsupported("pgfdeclarepatternformonly", text, "Malformed \\pgfdeclarepatternformonly declaration");
  index = skipWhitespace(text, name.end);

  const groups = [];
  for (let count = 0; count < 4; count += 1) {
    const group = extractBalanced(text, index, "{", "}");
    if (!group) {
      return unsupported("pgfdeclarepatternformonly", text, "Malformed \\pgfdeclarepatternformonly declaration");
    }
    groups.push(group.content);
    index = skipWhitespace(text, group.end);
  }
  if (text.slice(index).trim()) {
    return unsupported("pgfdeclarepatternformonly", text, "Malformed \\pgfdeclarepatternformonly declaration");
  }
  return {
    type: "pgfdeclarepatternformonly",
    name: name.content.trim(),
    arguments: optional?.content.trim() || "",
    lowerLeft: groups[0].trim(),
    upperRight: groups[1].trim(),
    tileSize: groups[2].trim(),
    body: groups[3],
    raw: text
  };
}

function collectPgfMathMacros(source) {
  const macros = [];
  let index = 0;
  const commands = [
    ["\\pgfmathsetmacro", "pgfmathsetmacro"],
    ["\\pgfmathsetlengthmacro", "pgfmathsetlengthmacro"],
    ["\\pgfmathtruncatemacro", "pgfmathtruncatemacro"]
  ];
  while (index < source.length) {
    const found = commands
      .map(([command, type]) => ({ command, type, index: source.indexOf(command, index) }))
      .filter((entry) => entry.index >= 0)
      .sort((a, b) => a.index - b.index)[0];
    if (!found) break;
    const parsed = parsePgfMathTargetCommand(source.slice(found.index), found.command);
    if (parsed) {
      macros.push({
        type: found.type,
        name: parsed.name,
        expression: parsed.expression
      });
      index = found.index + parsed.end;
    } else {
      index = found.index + found.command.length;
    }
  }
  return macros;
}

function parsePgfMathDeclareRandomList(text) {
  const parsed = parsePgfMathDeclareRandomListAt(text, 0);
  if (!parsed) return unsupported("pgfmathdeclarerandomlist", text, "Malformed \\pgfmathdeclarerandomlist statement");
  return {
    type: "pgfmathdeclarerandomlist",
    name: parsed.name,
    values: parsed.values,
    raw: text
  };
}

function parsePgfMathRandomItem(text) {
  let index = "\\pgfmathrandomitem".length;
  index = skipWhitespace(text, index);
  const variable = extractBalanced(text, index, "{", "}");
  if (!variable) return unsupported("pgfmathrandomitem", text, "Malformed \\pgfmathrandomitem statement");
  index = skipWhitespace(text, variable.end);
  const listName = extractBalanced(text, index, "{", "}");
  if (!listName) return unsupported("pgfmathrandomitem", text, "Malformed \\pgfmathrandomitem statement");
  return {
    type: "pgfmathrandomitem",
    name: variable.content.trim().replace(/^\\/, ""),
    listName: listName.content.trim(),
    raw: text
  };
}

function collectPgfMathRandomLists(source) {
  const randomLists = {};
  let index = 0;
  while (index < source.length) {
    const found = source.indexOf("\\pgfmathdeclarerandomlist", index);
    if (found < 0) break;
    const parsed = parsePgfMathDeclareRandomListAt(source, found);
    if (parsed) {
      randomLists[parsed.name] = parsed.values;
      index = parsed.end;
    } else {
      index = found + "\\pgfmathdeclarerandomlist".length;
    }
  }
  return randomLists;
}

function collectShadingDefinitions(source) {
  const shadings = {};
  let index = 0;
  while (index < source.length) {
    const found = source.indexOf("\\pgfdeclareradialshading", index);
    if (found < 0) break;
    const parsed = parsePgfDeclareRadialShadingAt(source, found);
    if (parsed) {
      shadings[parsed.name] = parsed.definition;
      index = parsed.end;
    } else {
      index = found + "\\pgfdeclareradialshading".length;
    }
  }
  return shadings;
}

function parsePgfDeclareRadialShadingAt(source, start) {
  let index = start + "\\pgfdeclareradialshading".length;
  index = skipWhitespace(source, index);
  const name = extractBalanced(source, index, "{", "}");
  if (!name) return null;
  index = skipWhitespace(source, name.end);
  const center = extractBalanced(source, index, "{", "}");
  if (!center) return null;
  index = skipWhitespace(source, center.end);
  const body = extractBalanced(source, index, "{", "}");
  if (!body) return null;
  return {
    name: name.content.trim(),
    definition: {
      type: "radial",
      center: center.content.trim(),
      stops: parseRadialShadingStops(body.content)
    },
    end: body.end
  };
}

function parseRadialShadingStops(body) {
  const stops = [];
  const pattern = /color\s*\(\s*([^)]+?)\s*\)\s*=\s*\(\s*([^)]+?)\s*\)/g;
  for (const match of body.matchAll(pattern)) {
    const offset = radialShadingOffset(match[1]);
    const color = radialShadingColor(match[2]);
    if (!color) continue;
    stops.push({ offset, ...color });
  }
  if (!stops.length) return [];
  const maxOffset = Math.max(...stops.map((stop) => stop.offset), 1e-9);
  return stops.map((stop) => ({
    ...stop,
    offset: Math.max(0, Math.min(1, stop.offset / maxOffset))
  }));
}

function radialShadingOffset(value) {
  const match = String(value || "").match(/[-+]?\d*\.?\d+/);
  const number = match ? Number(match[0]) : 0;
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function radialShadingColor(value) {
  const text = String(value || "").trim();
  const transparent = text.match(/^pgftransparent(?:!(\d+(?:\.\d+)?))?$/i);
  if (transparent) {
    const opacity = Math.max(0, Math.min(1, Number(transparent[1] ?? 100) / 100));
    return { color: "black", opacity };
  }
  return { color: text, opacity: 1 };
}

function parsePgfMathDeclareRandomListAt(source, start) {
  let index = start + "\\pgfmathdeclarerandomlist".length;
  index = skipWhitespace(source, index);
  const name = extractBalanced(source, index, "{", "}");
  if (!name) return null;
  index = skipWhitespace(source, name.end);
  const body = extractBalanced(source, index, "{", "}");
  if (!body) return null;
  return {
    name: name.content.trim(),
    values: parsePgfMathRandomListValues(body.content),
    end: body.end
  };
}

function parsePgfMathRandomListValues(body) {
  const values = [];
  let index = 0;
  while (index < body.length) {
    index = skipWhitespace(body, index);
    if (index >= body.length) break;
    if (body[index] === "{") {
      const value = extractBalanced(body, index, "{", "}");
      if (!value) break;
      values.push(value.content.trim());
      index = value.end;
      continue;
    }
    const next = body.indexOf(",", index);
    const end = next < 0 ? body.length : next;
    const value = body.slice(index, end).trim();
    if (value) values.push(value);
    index = end + 1;
  }
  return values;
}

function parsePgfTransformCm(text) {
  let index = "\\pgftransformcm".length;
  const args = [];
  for (let argIndex = 0; argIndex < 5; argIndex += 1) {
    index = skipWhitespace(text, index);
    const arg = extractBalanced(text, index, "{", "}");
    if (!arg) return unsupported("pgftransformcm", text, "Malformed \\pgftransformcm statement");
    args.push(arg.content.trim());
    index = arg.end;
  }
  const point = args[4].match(/^\\pgfpoint\s*\{([\s\S]*)\}\s*\{([\s\S]*)\}$/);
  return {
    type: "pgftransformcm",
    a: args[0],
    b: args[1],
    c: args[2],
    d: args[3],
    x: point ? point[1].trim() : "0",
    y: point ? point[2].trim() : "0",
    raw: text
  };
}

function parseTikzsetStatement(text) {
  const start = text.indexOf("{");
  const body = start >= 0 ? extractBalanced(text, start, "{", "}") : null;
  if (!body) return unsupported("tikzset", text, "Malformed \\tikzset statement");
  return {
    type: "tikzset",
    styles: parseTikzset(body.content),
    pics: parseTikzPics(body.content),
    styleOptions: parseOptions(body.content),
    raw: text
  };
}

function parseTikzstyleStatement(text) {
  const parsed = parseTikzstyleDefinition(text, 0);
  if (!parsed) return unsupported("tikzstyle", text, "Malformed \\tikzstyle statement");
  return {
    type: "tikzset",
    styles: {
      [parsed.name]: parseOptions(parsed.options)
    },
    raw: text
  };
}

function parseMatrix(text) {
  let index = "\\matrix".length;
  let options = {};
  let name = null;
  let at = null;

  const beforeNameOptions = parseOptionalOptions(text, index);
  options = { ...options, ...beforeNameOptions.options };
  index = beforeNameOptions.end;
  index = skipWhitespace(text, index);

  if (text[index] === "(") {
    const parsedName = extractBalanced(text, index, "(", ")");
    name = parsedName?.content.trim() || null;
    index = parsedName?.end || index;
  }

  const afterNameOptions = parseOptionalOptions(text, index);
  options = { ...options, ...afterNameOptions.options };
  index = skipWhitespace(text, afterNameOptions.end);

  if (text.startsWith("at", index)) {
    index = skipWhitespace(text, index + 2);
    const coord = parseCoordinateArgument(text, index);
    if (!coord) return unsupported("matrix", text, "Malformed \\matrix coordinate");
    at = coord.content.trim();
    index = skipWhitespace(text, coord.end);
  }

  const afterAtOptions = parseOptionalOptions(text, index);
  options = { ...options, ...afterAtOptions.options };
  index = skipWhitespace(text, afterAtOptions.end);

  const body = extractBalanced(text, index, "{", "}");
  if (!body) return unsupported("matrix", text, "Malformed \\matrix statement");
  return {
    type: "matrix",
    name,
    at,
    options,
    body: body.content,
    raw: text
  };
}

function parsePic(text) {
  let index = "\\pic".length;
  const parsedOptions = parseOptionalOptions(text, index);
  let options = parsedOptions.options;
  index = parsedOptions.end;
  index = skipWhitespace(text, index);
  let name = null;
  if (text[index] === "(") {
    const parsedName = extractBalanced(text, index, "(", ")");
    name = parsedName?.content.trim() || null;
    index = parsedName?.end || index;
  }
  const afterNameOptions = parseOptionalOptions(text, index);
  options = { ...options, ...afterNameOptions.options };
  index = skipWhitespace(text, afterNameOptions.end);

  let at = null;
  if (text.startsWith("at", index)) {
    index = skipWhitespace(text, index + 2);
    const coord = parseCoordinateArgument(text, index);
    if (!coord) return unsupported("pic", text, "Malformed \\pic coordinate");
    at = coord.content.trim();
    index = skipWhitespace(text, coord.end);
  }

  const afterAtOptions = parseOptionalOptions(text, index);
  options = { ...options, ...afterAtOptions.options };
  index = skipWhitespace(text, afterAtOptions.end);

  const body = extractBalanced(text, index, "{", "}");
  if (!body) {
    if (skipWhitespace(text, index) >= text.length) {
      return {
        type: "pic",
        name,
        at,
        options,
        body: "",
        raw: text
      };
    }
    return unsupported("pic", text, "Malformed \\pic statement");
  }
  return {
    type: "pic",
    name,
    at,
    options,
    body: body.content.trim(),
    raw: text
  };
}

function parseSpy(text) {
  let index = "\\spy".length;
  const parsedOptions = parseOptionalOptions(text, index);
  const options = parsedOptions.options;
  index = skipWhitespace(text, parsedOptions.end);
  if (!startsKeyword(text, index, "on")) return unsupported("spy", text, "Malformed \\spy statement");
  index = skipWhitespace(text, index + "on".length);
  const on = parseCoordinateArgument(text, index);
  if (!on) return unsupported("spy", text, "Malformed \\spy source coordinate");
  index = skipWhitespace(text, on.end);
  if (!startsKeyword(text, index, "in")) return unsupported("spy", text, "Malformed \\spy target node");
  index = skipWhitespace(text, index + "in".length);
  if (!startsKeyword(text, index, "node")) return unsupported("spy", text, "Malformed \\spy target node");
  index = skipWhitespace(text, index + "node".length);
  const parsedInOptions = parseOptionalOptions(text, index);
  const inOptions = parsedInOptions.options;
  index = skipWhitespace(text, parsedInOptions.end);
  let at = null;
  if (startsKeyword(text, index, "at")) {
    index = skipWhitespace(text, index + "at".length);
    const target = parseCoordinateArgument(text, index);
    if (!target) return unsupported("spy", text, "Malformed \\spy target coordinate");
    at = target.content.trim();
    index = skipWhitespace(text, target.end);
  }
  return {
    type: "spy",
    options,
    on: on.content.trim(),
    inOptions,
    at,
    raw: text
  };
}

function parseNode(text, diagnostics = []) {
  let index = "\\node".length;
  const parsedOptions = parseOptionalOptions(text, index);
  index = parsedOptions.end;
  let options = parsedOptions.options;
  let name = null;
  let at = null;

  index = skipWhitespace(text, index);
  if (text[index] === "(") {
    const parsedName = extractBalanced(text, index, "(", ")");
    name = parsedName?.content.trim() || null;
    index = parsedName?.end || index;
    const afterNameOptions = parseOptionalOptions(text, index);
    options = { ...options, ...afterNameOptions.options };
    index = afterNameOptions.end;
  }

  index = skipWhitespace(text, index);
  if (text.startsWith("at", index)) {
    index = skipWhitespace(text, index + 2);
    const coord = parseCoordinateArgument(text, index);
    if (!coord) return unsupported("node", text, "Malformed node coordinate");
    at = coord.content.trim();
    index = skipWhitespace(text, coord.end);
  }

  // TikZ keeps scanning optional node options and a node name after `at`.
  // Both `at (...) [options] (name)` and `at (...) (name) [options]` are valid.
  while (true) {
    if (text[index] === "[") {
      const afterCoordinateOptions = parseOptionalOptions(text, index);
      options = { ...options, ...afterCoordinateOptions.options };
      index = skipWhitespace(text, afterCoordinateOptions.end);
      continue;
    }
    if (text[index] === "(") {
      const parsedName = extractBalanced(text, index, "(", ")");
      if (!parsedName) break;
      name = parsedName.content.trim() || name;
      index = skipWhitespace(text, parsedName.end);
      continue;
    }
    break;
  }
  const label = extractBalanced(text, index, "{", "}");
  if (!label) return unsupported("node", text, "Malformed node text");
  const trailingPath = text.slice(label.end).trim();
  const treeChildren = parseNodeTreeChildren(trailingPath, diagnostics);
  const hasTreeSyntax = treeChildren.children.length || Object.keys(treeChildren.edgeOptions || {}).length;
  return {
    type: "node",
    name,
    options,
    at,
    text: label.content,
    edgeFromParentOptions: treeChildren.edgeOptions,
    treeOptions: treeChildren.options,
    children: treeChildren.children,
    path: hasTreeSyntax && !treeChildren.rest
      ? null
      : trailingPath
        ? {
            raw: treeChildren.rest || trailingPath,
            segments: parsePathSegments(treeChildren.rest || trailingPath)
          }
        : null,
    raw: text
  };
}

function parseNodeTreeChildren(text, diagnostics = []) {
  const children = [];
  let options = {};
  let edgeOptions = {};
  let index = 0;
  let guard = 0;
  while (true) {
    guard += 1;
    if (guard > 1000) {
      diagnostics.push({
        severity: "warning",
        message: `Stopped parsing TikZ node tree children after too many iterations near: ${text.slice(index, index + 60)}`
      });
      break;
    }
    index = skipWhitespace(text, index);
    if (!Number.isFinite(index) || index >= text.length) break;
    const edgeFromParent = parseTreeEdgeFromParent(text, index);
    if (edgeFromParent) {
      edgeOptions = { ...edgeOptions, ...edgeFromParent.options };
      if (!Number.isFinite(edgeFromParent.end) || edgeFromParent.end <= index) {
        diagnostics.push({
          severity: "warning",
          message: `Malformed edge from parent tree clause near: ${text.slice(index, index + 60)}`
        });
        break;
      }
      index = edgeFromParent.end;
      continue;
    }
    if (text[index] === "[") {
      const beforeOptions = index;
      const parsedOptions = parseOptionalOptions(text, index);
      const afterOptions = skipWhitespace(text, parsedOptions.end);
      if (parsedOptions.raw && text.startsWith("child", afterOptions)) {
        options = { ...options, ...parsedOptions.options };
        index = afterOptions;
        continue;
      }
      index = beforeOptions;
    }
    if (!text.startsWith("child", index)) break;
    const child = parseNodeTreeChild(text, index, diagnostics) || parseNodeTreeCoordinateChild(text, index, diagnostics);
    if (!child) break;
    children.push(child.child);
    if (!Number.isFinite(child.end) || child.end <= index) break;
    index = child.end;
  }
  return {
    options,
    edgeOptions,
    children,
    rest: text.slice(index).trim()
  };
}

function parseNodeTreeCoordinateChild(text, start, diagnostics = []) {
  let index = start + "child".length;
  const parsedOptions = parseOptionalOptions(text, index);
  index = skipWhitespace(text, parsedOptions.end);
  if (text[index] === "{") return null;

  let treeOptions = {};
  while (text[index] === "[") {
    const parsed = extractBalanced(text, index, "[", "]");
    if (!parsed) return null;
    treeOptions = { ...treeOptions, ...parseOptions(parsed.content) };
    index = skipWhitespace(text, parsed.end);
  }
  const nested = parseNodeTreeChildren(text.slice(index), diagnostics);
  if (!nested.children.length) return null;
  return {
    child: {
      options: parsedOptions.options,
      edgeOptions: {},
      node: {
        type: "coordinate",
        name: null,
        options: {},
        at: null,
        treeOptions: { ...treeOptions, ...nested.options },
        children: nested.children,
        raw: text.slice(start)
      },
      children: nested.children
    },
    end: text.length
  };
}

function parseTreeEdgeFromParent(text, start) {
  const token = "edge from parent";
  if (!text.startsWith(token, start)) return null;
  let index = skipWhitespace(text, start + token.length);
  let options = {};
  if (text[index] === "[") {
    const parsedOptions = extractBalanced(text, index, "[", "]");
    if (parsedOptions) {
      options = parseOptions(parsedOptions.content);
      index = skipWhitespace(text, parsedOptions.end);
    }
  }
  return {
    options,
    end: index
  };
}

function parseNodeTreeChild(text, start, diagnostics = []) {
  let index = start + "child".length;
  const parsedOptions = parseOptionalOptions(text, index);
  index = skipWhitespace(text, parsedOptions.end);
  const body = extractBalanced(text, index, "{", "}");
  if (!body) return null;
  const childNode = parseNodeTreeChildBody(body.content, diagnostics);
  if (!childNode) return null;
  return {
    child: {
      options: parsedOptions.options,
      edgeOptions: childNode.edgeFromParentOptions || {},
      node: childNode,
      children: childNode.children || []
    },
    end: body.end
  };
}

function parseNodeTreeChildBody(body, diagnostics = []) {
  const text = body.trim();
  if (text.startsWith("\\node")) return parseNode(text, diagnostics);
  if (text.startsWith("node")) return parseNode(`\\${text}`, diagnostics);
  return null;
}

function parseScope(text, diagnostics) {
  const opening = skipWhitespace(text, 1);
  const options = extractBalanced(text, opening, "[", "]");
  if (!options) return unsupported("scope", text, "Malformed scope options");
  const body = extractBalanced(text, 0, "{", "}");
  if (!body || text.slice(body.end).trim()) return unsupported("scope", text, "Malformed scope body");
  return {
    type: "scope",
    options: parseOptions(options.content),
    body: parseStatements(text.slice(options.end, body.end - 1), diagnostics),
    raw: text
  };
}

function isBracedScopeShorthand(text) {
  const source = String(text || "");
  return source.startsWith("{") && source[skipWhitespace(source, 1)] === "[";
}

function parseBareScope(text, diagnostics) {
  const body = extractBalanced(text, 0, "{", "}");
  if (!body) return unsupported("scope", text, "Malformed scope body");
  return {
    type: "scope",
    options: {},
    body: parseStatements(body.content, diagnostics),
    raw: text
  };
}

function parsePathCommand(command, text, diagnostics = []) {
  let optionEnd = 0;
  const optionParts = [];
  while (true) {
    const optionStart = skipWhitespace(text, optionEnd);
    if (text[optionStart] !== "[") break;
    const parsedOptions = parseOptionalOptions(text, optionStart);
    if (parsedOptions.end <= optionStart) break;
    optionParts.push(parsedOptions.raw);
    optionEnd = parsedOptions.end;
  }
  const options = parseOptions(optionParts.filter(Boolean).join(","));
  const pathText = text.slice(optionEnd).trim();
  const treeNode = parsePathNodeTree(command, options, pathText, diagnostics);
  if (treeNode) return treeNode;
  if (pathText.startsWith("\\foreach")) {
    const foreach = parseForeachPathCommand(command, options, pathText);
    if (foreach) return foreach;
  }
  return {
    type: "path",
    command,
    options,
    path: {
      raw: pathText,
      segments: parsePathSegments(pathText)
    },
    raw: `\\${command}${text}`
  };
}

// `\path[<options>] node ... child ...` is the documented mindmap spelling.
// It does not paint the path itself: the node tree owns the visible concepts
// and connection bars. Lower it to the existing node-tree AST while retaining
// the path options as the context inherited by its descendants.
function parsePathNodeTree(command, pathOptions, pathText, diagnostics = []) {
  if (!/^(?:node\b)/.test(pathText)) return null;
  const node = parseNode(`\\${pathText}`, diagnostics);
  if (node?.type !== "node") return null;
  return {
    ...node,
    options: { ...pathOptions, ...(node.options || {}) },
    treeOptions: { ...pathOptions, ...(node.treeOptions || {}) },
    treeInheritedOptions: pathOptions,
    pathCommand: command,
    raw: `\\${command}${pathText}`
  };
}

function parseForeachPathCommand(command, options, pathText) {
  const match = pathText.match(/^\\foreach\s+(.+?)\s+in\s*/);
  if (!match) return null;
  let index = match[0].length;
  const list = extractBalanced(pathText, index, "{", "}");
  if (!list) return null;
  index = skipWhitespace(pathText, list.end);
  const body = extractBalanced(pathText, index, "{", "}");
  if (!body) return null;
  return {
    type: "foreach",
    variables: match[1]
      .split("/")
      .map((part) => part.trim().replace(/^\\/, ""))
      .filter(Boolean),
    values: splitTopLevel(list.content, ","),
    body: [
      {
        type: "path",
        command,
        options,
        path: {
          raw: body.content,
          segments: parsePathSegments(body.content)
        },
        raw: `\\${command} ${body.content}`
      }
    ],
    raw: `\\${command} ${pathText}`
  };
}

export function parsePathSegments(pathText) {
  const segments = [];
  let index = 0;
  while (index < pathText.length) {
    index = skipWhitespace(pathText, index);
    if (index >= pathText.length) break;

    if (startsKeyword(pathText, index, "decorate")) {
      const parsed = parseDecoratePathSegment(pathText, index);
      if (parsed) {
        segments.push(parsed.segment);
        index = parsed.end;
        continue;
      }
    }

    if (startsKeyword(pathText, index, "let")) {
      const parsed = parsePathLetSegment(pathText, index);
      if (parsed) {
        segments.push(parsed.segment);
        index = parsed.end;
        continue;
      }
    }

    if (pathText.startsWith("\\foreach", index)) {
      const parsed = parseInlinePathForeachSegment(pathText, index);
      if (parsed) {
        segments.push(parsed.segment);
        index = parsed.end;
        continue;
      }
    }

    const extOperator = parseExtendedPathOperator(pathText, index);
    if (extOperator) {
      segments.push(extOperator.segment);
      index = extOperator.end;
      continue;
    }
    if (pathText.startsWith("pic", index)) {
      const parsed = parsePathPicSegment(pathText, index);
      if (parsed) {
        segments.push(parsed.segment);
        index = parsed.end;
        continue;
      }
    }
    if (pathText.startsWith("--", index)) {
      segments.push({ kind: "operator", value: "--", options: {} });
      index += 2;
      continue;
    }
    if (pathText.startsWith("|-", index) || pathText.startsWith("-|", index)) {
      segments.push({ kind: "operator", value: pathText.slice(index, index + 2), options: {} });
      index += 2;
      continue;
    }
    if (pathText.startsWith("..", index)) {
      const curve = parseCurveSegment(pathText, index);
      if (curve) {
        segments.push(curve.segment);
        index = curve.end;
      } else {
        segments.push({ kind: "operator", value: ".." });
        index += 2;
      }
      continue;
    }
    if (startsKeyword(pathText, index, "rectangle")) {
      segments.push({ kind: "operator", value: "rectangle" });
      index += "rectangle".length;
      continue;
    }
    if (startsKeyword(pathText, index, "coordinate")) {
      const parsed = parsePathCoordinateName(pathText, index);
      if (parsed) {
        segments.push(parsed.segment);
        index = parsed.end;
        continue;
      }
    }
    if (startsKeyword(pathText, index, "grid")) {
      segments.push({ kind: "operator", value: "grid" });
      index += "grid".length;
      continue;
    }
    if (startsKeyword(pathText, index, "edge")) {
      const parsed = parsePathTargetOperation(pathText, index, "edge");
      if (parsed) {
        segments.push(parsed.segment);
        index = parsed.end;
        continue;
      }
      const next = nextDelimiter(pathText, index);
      segments.push({ kind: "unknown", raw: pathText.slice(index, next).trim() });
      index = next > index ? next : index + 1;
      continue;
    }
    if (pathText[index] === "[") {
      const options = parseOptionalOptions(pathText, index);
      const cursor = skipWhitespace(pathText, options.end);
      if (options.raw && startsKeyword(pathText, cursor, "to")) {
        const parsed = parsePathTargetOperation(pathText, cursor, "to", options.options);
        if (parsed) {
          segments.push(parsed.segment);
          index = parsed.end;
          continue;
        }
      }
      if (options.raw && startsKeyword(pathText, cursor, "edge")) {
        const parsed = parsePathTargetOperation(pathText, cursor, "edge", options.options);
        if (parsed) {
          segments.push(parsed.segment);
          index = parsed.end;
          continue;
        }
      }
      if (options.raw) {
        segments.push({ kind: "options", options: options.options });
        index = options.end;
        continue;
      }
    }
    if (startsKeyword(pathText, index, "to")) {
      const parsed = parsePathTargetOperation(pathText, index, "to");
      if (parsed) {
        segments.push(parsed.segment);
        index = parsed.end;
        continue;
      }
    }
    if (startsKeyword(pathText, index, "plot")) {
      const parsed = parsePlotSegment(pathText, index);
      if (parsed) {
        segments.push(parsed.segment);
        index = parsed.end;
        continue;
      }
    }
    if (startsKeyword(pathText, index, "sin") || startsKeyword(pathText, index, "cos")) {
      const parsed = parseSineCosineSegment(pathText, index);
      if (parsed) {
        segments.push(parsed.segment);
        index = parsed.end;
        continue;
      }
    }
    if (startsKeyword(pathText, index, "node")) {
      const parsed = parseInlineNodeSegment(pathText, index);
      if (parsed) {
        segments.push(parsed.segment);
        index = parsed.end;
        continue;
      }
    }
    if (startsKeyword(pathText, index, "cycle")) {
      segments.push({ kind: "close" });
      index += "cycle".length;
      continue;
    }
    if (startsKeyword(pathText, index, "circle")) {
      index += "circle".length;
      index = skipWhitespace(pathText, index);
      const circleOptions = parseOptionalOptions(pathText, index);
      if (circleOptions.raw) {
        segments.push({ kind: "circle", radius: circleOptions.options.radius || "1", options: circleOptions.options });
        index = circleOptions.end;
        continue;
      }
      const radius = extractBalanced(pathText, index, "(", ")");
      if (radius) {
        segments.push({ kind: "circle", radius: radius.content.trim(), options: {} });
        index = radius.end;
      }
      continue;
    }
    if (startsKeyword(pathText, index, "ellipse")) {
      index += "ellipse".length;
      index = skipWhitespace(pathText, index);
      const ellipseOptions = parseOptionalOptions(pathText, index);
      if (ellipseOptions.raw) {
        segments.push({ kind: "ellipse", radius: "", options: ellipseOptions.options });
        index = ellipseOptions.end;
        continue;
      }
      const radius = extractBalanced(pathText, index, "(", ")");
      if (radius) {
        segments.push({ kind: "ellipse", radius: radius.content.trim(), options: {} });
        index = radius.end;
      }
      continue;
    }
    if (pathText.startsWith("arc to", index) && isTokenBoundary(pathText[index + "arc to".length] || "")) {
      const parsed = parseArcToSegment(pathText, index);
      if (parsed) {
        segments.push(parsed.segment);
        index = parsed.end;
        continue;
      }
    }
    if (startsKeyword(pathText, index, "arc")) {
      index += "arc".length;
      index = skipWhitespace(pathText, index);
      const arcOptions = parseOptionalOptions(pathText, index);
      if (arcOptions.raw) {
        segments.push({ kind: "arc", options: arcOptions.options });
        index = arcOptions.end;
        continue;
      }
      const compact = extractBalanced(pathText, index, "(", ")");
      if (compact) {
        const parts = splitTopLevel(compact.content, ":").map((part) => part.trim());
        if (parts.length >= 3) {
          segments.push({
            kind: "arc",
            options: {
              "start angle": parts[0],
              "end angle": parts[1],
              radius: parts.slice(2).join(":")
            }
          });
          index = compact.end;
        }
      }
      continue;
    }
    if (pathText.startsWith("++", index) || pathText.startsWith("+", index)) {
      const plusLength = pathText.startsWith("++", index) ? 2 : 1;
      const coordStart = skipWhitespace(pathText, index + plusLength);
      const coord = extractBalanced(pathText, coordStart, "(", ")");
      if (coord) {
        segments.push({
          kind: "coordinate",
          raw: coord.content.trim(),
          relative: plusLength === 2 ? "update" : "temporary"
        });
        index = coord.end;
        continue;
      }
    }
    if (pathText[index] === "(") {
      const coord = extractBalanced(pathText, index, "(", ")");
      if (coord) {
        segments.push({ kind: "coordinate", raw: coord.content.trim() });
        index = coord.end;
        continue;
      }
    }
    const macroCoordinate = parseMacroCoordinateSegment(pathText, index);
    if (macroCoordinate) {
      segments.push(macroCoordinate.segment);
      index = macroCoordinate.end;
      continue;
    }
    const next = nextDelimiter(pathText, index);
    segments.push({ kind: "unknown", raw: pathText.slice(index, next).trim() });
    index = next > index ? next : index + 1;
  }
  return segments.filter((segment) => segment.kind !== "unknown" || segment.raw);
}

function parseDecoratePathSegment(pathText, start) {
  let cursor = skipWhitespace(pathText, start + "decorate".length);
  const parsedOptions = parseOptionalOptions(pathText, cursor);
  if (parsedOptions.raw) cursor = skipWhitespace(pathText, parsedOptions.end);
  const body = extractBalanced(pathText, cursor, "{", "}");
  if (!body) return null;
  return {
    segment: {
      kind: "decorate",
      options: parsedOptions.options || {},
      segments: parsePathSegments(body.content),
      raw: pathText.slice(start, body.end)
    },
    end: body.end
  };
}

function parsePathLetSegment(pathText, start) {
  let cursor = skipWhitespace(pathText, start + "let".length);
  const bindings = [];

  while (cursor < pathText.length) {
    cursor = skipWhitespace(pathText, cursor);
    if (startsKeyword(pathText, cursor, "in")) {
      return { segment: { kind: "let", bindings }, end: cursor + "in".length };
    }
    if (pathText[cursor] !== "\\" || !["p", "n"].includes(pathText[cursor + 1])) return null;

    const kind = pathText[cursor + 1] === "p" ? "point" : "number";
    cursor += 2;
    const name = parsePathLetBindingName(pathText, cursor);
    if (!name) return null;
    cursor = skipWhitespace(pathText, name.end);
    if (pathText[cursor] !== "=") return null;
    cursor = skipWhitespace(pathText, cursor + 1);

    if (kind === "point") {
      const coordinate = parseCoordinateArgument(pathText, cursor);
      if (!coordinate) return null;
      bindings.push({ kind, name: name.value, value: coordinate.content.trim() });
      cursor = coordinate.end;
    } else {
      const number = parsePathLetNumber(pathText, cursor);
      if (!number) return null;
      bindings.push({ kind, name: name.value, value: number.value });
      cursor = number.end;
    }

    cursor = skipWhitespace(pathText, cursor);
    if (pathText[cursor] === ",") {
      cursor += 1;
      continue;
    }
    if (!startsKeyword(pathText, cursor, "in")) return null;
  }
  return null;
}

function parsePathLetBindingName(pathText, start) {
  const cursor = skipWhitespace(pathText, start);
  if (pathText[cursor] === "{") {
    const balanced = extractBalanced(pathText, cursor, "{", "}");
    if (!balanced?.content.trim()) return null;
    return { value: balanced.content.trim(), end: balanced.end };
  }
  const match = pathText.slice(cursor).match(/^[A-Za-z0-9@:_-]+/);
  return match ? { value: match[0], end: cursor + match[0].length } : null;
}

function parsePathLetNumber(pathText, start) {
  let cursor = start;
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  while (cursor < pathText.length) {
    const char = pathText[cursor];
    if (char === "(") paren += 1;
    else if (char === ")") paren = Math.max(0, paren - 1);
    else if (char === "{") brace += 1;
    else if (char === "}") brace = Math.max(0, brace - 1);
    else if (char === "[") bracket += 1;
    else if (char === "]") bracket = Math.max(0, bracket - 1);
    if (!paren && !brace && !bracket) {
      if (char === ",") break;
      if (startsKeyword(pathText, cursor, "in")) break;
    }
    cursor += 1;
  }
  const value = pathText.slice(start, cursor).trim();
  return value ? { value, end: cursor } : null;
}

function parseInlinePathForeachSegment(pathText, index) {
  const source = pathText.slice(index);
  const header = parseForeachHeader(source);
  if (!header) return null;
  const parsed = parseForeachListAndBody(source, header.end);
  if (!parsed?.body) return null;
  return {
    segment: {
      kind: "foreach",
      variables: header.variables,
      options: header.options,
      values: splitTopLevel(parsed.listContent, ","),
      bodyRaw: parsed.body.content,
      body: parsePathSegments(parsed.body.content)
    },
    end: index + parsed.body.end
  };
}

function parseMacroCoordinateSegment(pathText, index) {
  const match = pathText.slice(index).match(/^\\[A-Za-z@]+/);
  if (!match) return null;
  const raw = match[0];
  if (!isCoordinateMacroFollower(pathText, index + raw.length, raw)) return null;
  return {
    segment: { kind: "coordinate", raw },
    end: index + raw.length
  };
}

function isCoordinateMacroFollower(pathText, index, raw) {
  const cursor = skipWhitespace(pathText, index);
  if (cursor >= pathText.length) return /^\\[A-Za-z]$/.test(raw);
  if (
    pathText.startsWith("--", cursor) ||
    pathText.startsWith("|-", cursor) ||
    pathText.startsWith("-|", cursor) ||
    pathText.startsWith("..", cursor)
  ) {
    return true;
  }
  return [
    "rectangle",
    "grid",
    "edge",
    "to",
    "plot",
    "sin",
    "cos",
    "node",
    "cycle",
    "circle",
    "ellipse",
    "arc"
  ].some((keyword) => startsKeyword(pathText, cursor, keyword));
}

function parseSineCosineSegment(pathText, index) {
  const op = startsKeyword(pathText, index, "sin") ? "sin" : startsKeyword(pathText, index, "cos") ? "cos" : null;
  if (!op) return null;
  let cursor = skipWhitespace(pathText, index + op.length);
  const target = extractBalanced(pathText, cursor, "(", ")");
  if (!target) return null;
  return {
    segment: {
      kind: "sineCosine",
      op,
      to: target.content.trim()
    },
    end: target.end
  };
}

function parseExtendedPathOperator(pathText, index) {
  for (const value of ["|-|", "-|-", "r-ud", "r-du", "r-lr", "r-rl"]) {
    if (!pathText.startsWith(value, index)) continue;
    let cursor = skipWhitespace(pathText, index + value.length);
    const options = parseOptionalOptions(pathText, cursor);
    if (options.raw) cursor = options.end;
    return {
      segment: { kind: "operator", value, options: options.options || {} },
      end: cursor
    };
  }
  return null;
}

function parseArcToSegment(pathText, index) {
  let cursor = index + "arc to".length;
  cursor = skipWhitespace(pathText, cursor);
  const options = parseOptionalOptions(pathText, cursor);
  cursor = skipWhitespace(pathText, options.end);
  const nodes = [];
  while (startsKeyword(pathText, cursor, "node")) {
    const node = parseInlineNodeSegment(pathText, cursor);
    if (!node) break;
    nodes.push(node.segment);
    cursor = skipWhitespace(pathText, node.end);
  }
  const to = extractBalanced(pathText, cursor, "(", ")");
  if (!to) return null;
  return {
    segment: {
      kind: "arcTo",
      options: options.options || {},
      nodes,
      to: to.content.trim()
    },
    end: to.end
  };
}

function parseCurveSegment(pathText, index) {
  let cursor = index + 2;
  cursor = skipWhitespace(pathText, cursor);
  if (!startsKeyword(pathText, cursor, "controls")) return null;
  cursor += "controls".length;
  cursor = skipWhitespace(pathText, cursor);
  const c1 = parseCurveCoordinate(pathText, cursor);
  if (!c1) return null;
  cursor = skipWhitespace(pathText, c1.end);
  if (!startsKeyword(pathText, cursor, "and")) return null;
  cursor += "and".length;
  cursor = skipWhitespace(pathText, cursor);
  const c2 = parseCurveCoordinate(pathText, cursor);
  if (!c2) return null;
  cursor = skipWhitespace(pathText, c2.end);
  if (!pathText.startsWith("..", cursor)) return null;
  cursor += 2;
  cursor = skipWhitespace(pathText, cursor);
  const to = parseCurveCoordinate(pathText, cursor);
  if (!to) return null;
  return {
    segment: {
      kind: "curveTo",
      c1: c1.raw,
      c2: c2.raw,
      to: to.raw
    },
    end: to.end
  };
}

function parseCurveCoordinate(pathText, index) {
  let cursor = skipWhitespace(pathText, index);
  let prefix = "";
  if (pathText.startsWith("++", cursor)) {
    prefix = "++";
    cursor = skipWhitespace(pathText, cursor + 2);
  } else if (pathText.startsWith("+", cursor)) {
    prefix = "+";
    cursor = skipWhitespace(pathText, cursor + 1);
  }
  const coordinate = extractBalanced(pathText, cursor, "(", ")");
  if (!coordinate) return null;
  return {
    raw: `${prefix}(${coordinate.content.trim()})`,
    end: coordinate.end
  };
}

function parsePathTargetOperation(pathText, index, kind, leadingOptions = {}) {
  let cursor = index + kind.length;
  const options = parseOptionalOptions(pathText, cursor);
  cursor = options.end;
  cursor = skipWhitespace(pathText, cursor);
  const nodes = [];
  while (startsKeyword(pathText, cursor, "node")) {
    const parsedNode = parseInlineNodeSegment(pathText, cursor);
    if (!parsedNode) break;
    nodes.push(parsedNode.segment);
    cursor = skipWhitespace(pathText, parsedNode.end);
  }
  let relative = null;
  if (pathText.startsWith("++", cursor) || pathText.startsWith("+", cursor)) {
    const plusLength = pathText.startsWith("++", cursor) ? 2 : 1;
    relative = plusLength === 2 ? "update" : "temporary";
    cursor = skipWhitespace(pathText, cursor + plusLength);
  }
  const target = extractBalanced(pathText, cursor, "(", ")");
  if (!target) return null;
  return {
    segment: {
      kind,
      options: { ...leadingOptions, ...options.options },
      to: target.content.trim(),
      nodes,
      ...(relative ? { relative } : {})
    },
    end: target.end
  };
}

function parsePathPicSegment(pathText, index) {
  let cursor = skipWhitespace(pathText, index + "pic".length);
  const options = parseOptionalOptions(pathText, cursor);
  cursor = skipWhitespace(pathText, options.end);
  const body = extractBalanced(pathText, cursor, "{", "}");
  if (!body) return null;
  return {
    segment: {
      kind: "pic",
      options: options.options,
      body: body.content.trim(),
      raw: pathText.slice(index, body.end)
    },
    end: body.end
  };
}

function parsePathCoordinateName(pathText, index) {
  let cursor = index + "coordinate".length;
  cursor = skipWhitespace(pathText, cursor);
  const name = extractBalanced(pathText, cursor, "(", ")");
  if (!name) return null;
  return {
    segment: { kind: "coordinateName", name: name.content.trim() },
    end: name.end
  };
}

function parsePlotSegment(pathText, index) {
  let cursor = index + "plot".length;
  const options = parseOptionalOptions(pathText, cursor);
  cursor = options.end;
  cursor = skipWhitespace(pathText, cursor);
  if (startsKeyword(pathText, cursor, "coordinates")) {
    cursor += "coordinates".length;
    cursor = skipWhitespace(pathText, cursor);
    const body = extractBalanced(pathText, cursor, "{", "}");
    if (!body) return null;
    return {
      segment: { kind: "plotCoordinates", coordinates: parsePlotCoordinateList(body.content), options: options.options },
      end: body.end
    };
  }
  if (startsKeyword(pathText, cursor, "function")) {
    cursor += "function".length;
    cursor = skipWhitespace(pathText, cursor);
    const body = extractBalanced(pathText, cursor, "{", "}");
    if (!body) return null;
    return {
      segment: { kind: "plotFunction", expression: body.content.trim(), options: options.options },
      end: body.end
    };
  }
  const target = extractBalanced(pathText, cursor, "(", ")");
  if (!target) return null;
  return {
    segment: { kind: "plot", coordinate: target.content.trim(), options: options.options },
    end: target.end
  };
}

function parsePlotCoordinateList(text) {
  const coordinates = [];
  let cursor = 0;
  while (cursor < text.length) {
    cursor = skipWhitespace(text, cursor);
    if (text[cursor] !== "(") {
      cursor += 1;
      continue;
    }
    const coordinate = extractBalanced(text, cursor, "(", ")");
    if (!coordinate) break;
    coordinates.push(coordinate.content.trim());
    cursor = coordinate.end;
  }
  return coordinates;
}

function parseInlineNodeSegment(pathText, index) {
  let cursor = index + "node".length;
  let options = {};
  let at = null;
  let name = null;

  while (cursor < pathText.length) {
    cursor = skipWhitespace(pathText, cursor);
    if (pathText[cursor] === "[") {
      const parsedOptions = parseOptionalOptions(pathText, cursor);
      if (parsedOptions.end === cursor) break;
      options = { ...options, ...parsedOptions.options };
      cursor = parsedOptions.end;
      continue;
    }
    if (startsKeyword(pathText, cursor, "at")) {
      cursor += "at".length;
      cursor = skipWhitespace(pathText, cursor);
      const coord = parseCoordinateArgument(pathText, cursor);
      if (!coord) return null;
      at = coord.content.trim();
      cursor = coord.end;
      continue;
    }
    if (pathText[cursor] === "(" && !name) {
      const parsedName = extractBalanced(pathText, cursor, "(", ")");
      if (!parsedName) return null;
      name = parsedName.content.trim() || null;
      cursor = parsedName.end;
      continue;
    }
    break;
  }

  const label = extractBalanced(pathText, cursor, "{", "}");
  if (!label) {
    return {
      segment: { kind: "node", options, at, name, text: "" },
      end: cursor
    };
  }
  return {
    segment: { kind: "node", options, at, name, text: label.content },
    end: label.end
  };
}

function parseCoordinateArgument(text, index) {
  let cursor = skipWhitespace(text, index);
  if (text[cursor] === "(") return extractBalanced(text, cursor, "(", ")");
  if (text[cursor] === "$") {
    const end = text.indexOf("$", cursor + 1);
    if (end !== -1) return { content: text.slice(cursor, end + 1), start: cursor, end: end + 1 };
  }
  if (text[cursor] === "\\") {
    const match = text.slice(cursor).match(/^\\[A-Za-z@]\w*/);
    if (match) return { content: match[0], start: cursor, end: cursor + match[0].length };
  }
  const end = nextTokenEnd(text, cursor);
  if (end > cursor) return { content: text.slice(cursor, end), start: cursor, end };
  return null;
}

function splitStatements(body) {
  body = String(body || "").replace(/^[ \t]*\\[ \t]*$/gm, "");
  const statements = [];
  let current = "";
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  let ifnumDepth = 0;
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    const insideBrace = brace > 0;
    if (!insideBrace && char === "\\") {
      const command = readCommandName(body, i + 1);
      if (
        paren === 0 &&
        bracket === 0 &&
        brace === 0 &&
        ifnumDepth === 0 &&
        (current.trim() === "\\pgfresetboundingbox" || current.trim() === "\\breakforeach")
      ) {
        statements.push(current);
        current = "";
      }
      if (
        paren === 0 &&
        bracket === 0 &&
        brace === 0 &&
        ifnumDepth === 0 &&
        current.trim() &&
        !current.trimStart().startsWith("\\") &&
        !current.trimStart().startsWith("{")
      ) {
        statements.push(current);
        current = "";
      }
      if (command?.value === "ifnum") {
        ifnumDepth += 1;
      } else if (command?.value === "fi") {
        ifnumDepth = Math.max(0, ifnumDepth - 1);
      }
    }
    if (!insideBrace && char === "(") paren += 1;
    if (!insideBrace && char === ")") paren = Math.max(0, paren - 1);
    if (!insideBrace && char === "[" && paren === 0 && isBareDelimiterOptionBracket(current)) {
      current += char;
      continue;
    }
    if (!insideBrace && char === "[") bracket += 1;
    if (!insideBrace && char === "]") bracket = Math.max(0, bracket - 1);
    if (char === "{") brace += 1;
    if (char === "}") brace = Math.max(0, brace - 1);
    current += char;
    if (char === ";" && paren === 0 && bracket === 0 && brace === 0 && ifnumDepth === 0) {
      statements.push(current);
      current = "";
    } else if (
      char === "}" &&
      paren === 0 &&
      bracket === 0 &&
      brace === 0 &&
      ifnumDepth === 0 &&
      isBraceTerminatedStatement(current) &&
      (nextNonWhitespace(body, i + 1)?.startsWith("\\") || isBracedScopeShorthand(nextNonWhitespace(body, i + 1)))
    ) {
      statements.push(current);
      current = "";
    } else if (
      char === "]" &&
      paren === 0 &&
      bracket === 0 &&
      brace === 0 &&
      ifnumDepth === 0 &&
      isBracketTerminatedStatement(current) &&
      nextNonWhitespace(body, i + 1)?.startsWith("\\")
    ) {
      statements.push(current);
      current = "";
    }
  }
  if (current.trim()) statements.push(current);
  return statements;
}

function isBraceTerminatedStatement(statement) {
  const prefixed = parseLeadingFontSwitches(statement.trim());
  const text = prefixed ? prefixed.rest : statement.trim();
  if (!text) return false;
  if (text.startsWith("\\foreach")) return hasCompleteBracedForeachBody(text);
  if (text.startsWith("\\ifthenelse")) {
    const parsed = parseIfThenElseArguments(text);
    return Boolean(parsed && text.slice(parsed.end).trim() === "");
  }
  return (
    text.startsWith("\\toggletrue") ||
    text.startsWith("\\togglefalse") ||
    text.startsWith("\\newtoggle") ||
    text.startsWith("\\color") ||
    text.startsWith("\\definecolor") ||
    text.startsWith("\\linespread") ||
    text.startsWith("\\pgfmathsetlengthmacro") ||
    text.startsWith("\\pgfmathsetmacro") ||
    text.startsWith("\\pgfmathtruncatemacro") ||
    text.startsWith("\\pgfmathdeclarerandomlist") ||
    text.startsWith("\\pgfmathrandomitem") ||
    text.startsWith("\\pgfdeclarepatternformonly") ||
    text.startsWith("\\pgfplotsset") ||
    text.startsWith("\\ctikzset") ||
    text.startsWith("\\pgfplotstableread") ||
    text.startsWith("\\pgfplotstabletypeset") ||
    text.startsWith("\\tikzset") ||
    text.startsWith("{")
  );
}

function isBracketTerminatedStatement(statement) {
  const text = statement.trim();
  if (!text.startsWith("\\tikzstyle")) return false;
  const parsed = parseTikzstyleDefinition(text, 0);
  return Boolean(parsed && parsed.end === text.length);
}

const FONT_SWITCH_COMMANDS = new Set([
  "tiny",
  "scriptsize",
  "footnotesize",
  "small",
  "normalsize",
  "large",
  "Large",
  "LARGE",
  "huge",
  "Huge",
  "sf",
  "sffamily",
  "rm",
  "rmfamily",
  "tt",
  "ttfamily",
  "bf",
  "bfseries",
  "it",
  "itshape",
  "sl",
  "slshape",
  "sc",
  "scshape",
  "normalfont"
]);

function parseLeadingFontSwitches(text) {
  let cursor = skipWhitespace(String(text || ""), 0);
  const commands = [];
  while (String(text || "")[cursor] === "\\") {
    const command = readCommandName(text, cursor + 1);
    if (!command || !FONT_SWITCH_COMMANDS.has(command.value)) break;
    commands.push(text.slice(cursor, command.end));
    cursor = skipWhitespace(text, command.end);
  }
  if (!commands.length) return null;
  return {
    font: commands.join(" "),
    rest: String(text || "").slice(cursor).trim()
  };
}

function hasCompleteBracedForeachBody(text) {
  const header = parseForeachHeader(text);
  if (!header) return false;
  const parsed = parseForeachListAndBody(text, header.end);
  if (!parsed?.body) return false;
  return text.slice(parsed.body.end).trim() === "";
}

function nextNonWhitespace(text, index) {
  let cursor = index;
  while (/\s/.test(text[cursor] || "")) cursor += 1;
  return text.slice(cursor);
}

function extractTikzPictures(source) {
  const pictures = [];
  const begin = "\\begin{tikzpicture}";
  const end = "\\end{tikzpicture}";
  let index = 0;
  while (index < source.length) {
    const beginIndex = source.indexOf(begin, index);
    if (beginIndex === -1) break;
    let cursor = beginIndex + begin.length;
    const options = parseOptionalOptions(source, cursor);
    cursor = options.end;
    const endIndex = findMatchingEnvironmentEnd(source, cursor, begin, end);
    if (endIndex === -1) break;
    pictures.push({
      index: pictures.length,
      beginIndex,
      bodyEndIndex: endIndex,
      endIndex: endIndex + end.length,
      optionsRaw: options.raw,
      graphicxResize: findWrappingGraphicxResizebox(source, beginIndex, endIndex + end.length),
      body: source.slice(cursor, endIndex)
    });
    index = endIndex + end.length;
  }
  return pictures;
}

function findWrappingGraphicxResizebox(source, beginIndex, pictureEnd) {
  const command = String.raw`\resizebox`;
  const wrapperStart = source.lastIndexOf(command, beginIndex);
  if (wrapperStart === -1) return null;

  let cursor = skipWhitespace(source, wrapperStart + command.length);
  let starred = false;
  if (source[cursor] === "*") {
    starred = true;
    cursor = skipWhitespace(source, cursor + 1);
  }
  const width = extractBalanced(source, cursor, "{", "}");
  if (!width) return null;
  const height = extractBalanced(source, skipWhitespace(source, width.end), "{", "}");
  if (!height) return null;
  const content = extractBalanced(source, skipWhitespace(source, height.end), "{", "}");
  if (!content) return null;

  if (skipWhitespace(source, content.start + 1) !== beginIndex) return null;
  let contentEnd = content.end - 1;
  while (contentEnd > content.start && /\s/.test(source[contentEnd - 1])) contentEnd -= 1;
  if (contentEnd !== pictureEnd) return null;

  return {
    width: width.content.trim(),
    height: height.content.trim(),
    starred
  };
}

// TeX lays a tabular by measuring every cell first, then centering each cell
// within its column box. Keep that structural information in the AST so the
// evaluator can arrange multiple independently interpreted tikzpictures
// without making the parser SVG-aware.
function extractTabularPictureLayouts(source, pictures) {
  const text = String(source || "");
  const layouts = [];
  const beginToken = "\\begin{tabular}";
  const endToken = "\\end{tabular}";
  let cursor = 0;

  while (cursor < text.length) {
    const begin = text.indexOf(beginToken, cursor);
    if (begin === -1) break;
    let headerCursor = skipWhitespace(text, begin + beginToken.length);
    const columns = extractBalanced(text, headerCursor, "{", "}");
    if (!columns) {
      cursor = begin + beginToken.length;
      continue;
    }
    const end = findMatchingEnvironmentEnd(text, columns.end, beginToken, endToken);
    if (end === -1) {
      cursor = columns.end;
      continue;
    }

    const included = pictures.filter((picture) => picture.beginIndex >= columns.end && picture.endIndex <= end);
    const layout = parseTabularPictureLayout(text, {
      id: `tabular:${layouts.length}`,
      bodyStart: columns.end,
      bodyEnd: end,
      columnSpec: columns.content,
      pictures: included
    });
    if (layout) layouts.push(layout);
    cursor = end + endToken.length;
  }
  return layouts;
}

function parseTabularPictureLayout(source, definition) {
  const { pictures, bodyStart, bodyEnd } = definition;
  let body = "";
  let cursor = bodyStart;
  for (const picture of pictures) {
    body += source.slice(cursor, picture.beginIndex);
    body += `@@tikzkit-picture-${picture.index}@@`;
    cursor = picture.endIndex;
  }
  body += source.slice(cursor, bodyEnd);

  const columns = parseTabularColumnSpec(definition.columnSpec);
  if (!columns.length) return null;
  const rows = [];
  let pendingRules = 0;
  for (const rawRow of splitTabularRows(body)) {
    const hlines = (rawRow.match(/\\hline\b/g) || []).length;
    const rawCells = splitTabularCells(rawRow.replace(/\\hline\b/g, ""));
    const cells = rawCells.map((rawCell, column) => parseTabularCell(rawCell, column));
    const hasContent = cells.some((cell) => cell.pictureIndices.length || cell.text);
    if (!hasContent && hlines) {
      // `\hline` followed by an explicit `\\` has a real, short strut row
      // in LaTeX. Preserve it so the next picture does not collapse upward.
      if (rows.length) rows.push(createTabularRow(rows.length, columns.length, pendingRules + hlines, true));
      else pendingRules += hlines;
      pendingRules = 0;
      continue;
    }
    if (!hasContent && !rawRow.trim()) {
      if (rows.length) rows.push(createTabularRow(rows.length, columns.length, pendingRules));
      pendingRules = 0;
      continue;
    }
    if (!hasContent) continue;
    const normalizedCells = Array.from({ length: columns.length }, (_unused, column) => cells[column] || emptyTabularCell(column));
    rows.push({
      index: rows.length,
      cells: normalizedCells,
      // A \hline can share the source row with the following text cell.
      // In that form it is still a rule *before* the cell, not after it.
      rulesBefore: pendingRules + hlines
    });
    pendingRules = 0;
  }
  if (pendingRules && rows.length) rows[rows.length - 1].rulesAfter = pendingRules;
  if (!rows.length) return null;
  return {
    id: definition.id,
    columns,
    rows
  };
}

function parseTabularColumnSpec(raw) {
  const columns = [];
  let pendingLeftRule = false;
  for (const char of String(raw || "")) {
    if (char === "|") {
      if (columns.length) columns[columns.length - 1].rightRule = true;
      else pendingLeftRule = true;
      continue;
    }
    if (!/[lcr]/.test(char)) continue;
    columns.push({ align: char, leftRule: pendingLeftRule, rightRule: false });
    pendingLeftRule = false;
  }
  if (pendingLeftRule && columns.length) columns.at(-1).rightRule = true;
  return columns;
}

function splitTabularRows(raw) {
  const rows = [];
  let current = "";
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;
  const text = String(raw || "");
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
    else if (char === "[") bracketDepth += 1;
    else if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === "(") parenDepth += 1;
    else if (char === ")") parenDepth = Math.max(0, parenDepth - 1);
    if (char === "\\" && text[index + 1] === "\\" && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
      rows.push(current);
      current = "";
      index += 1;
      continue;
    }
    current += char;
  }
  if (current.trim() || rows.length) rows.push(current);
  return rows;
}

function splitTabularCells(raw) {
  const cells = [];
  let current = "";
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;
  const text = String(raw || "");
  for (const char of text) {
    if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
    else if (char === "[") bracketDepth += 1;
    else if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === "(") parenDepth += 1;
    else if (char === ")") parenDepth = Math.max(0, parenDepth - 1);
    if (char === "&" && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function parseTabularCell(raw, column) {
  const pictureIndices = [...String(raw || "").matchAll(/@@tikzkit-picture-(\d+)@@/g)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
  const text = String(raw || "")
    .replace(/@@tikzkit-picture-\d+@@/g, "")
    .replace(/%[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { column, pictureIndices, text };
}

function emptyTabularCell(column) {
  return { column, pictureIndices: [], text: "" };
}

function createTabularRow(index, columnCount, rulesBefore = 0, blank = false) {
  return {
    index,
    cells: Array.from({ length: columnCount }, (_unused, column) => emptyTabularCell(column)),
    rulesBefore,
    blank
  };
}

function collectStyleDefinitions(source) {
  const styles = {};
  let index = 0;
  while (index < source.length) {
    if (source.startsWith("\\tikzset", index)) {
      const parsed = parseTikzsetDefinition(source, index);
      if (parsed) {
        Object.assign(styles, parsed.styles);
        index = parsed.end;
        continue;
      }
    }
    if (source.startsWith("\\tikzstyle", index)) {
      const parsed = parseTikzstyleDefinition(source, index);
      if (parsed) {
        styles[parsed.name] = parseOptions(parsed.options);
        index = parsed.end;
        continue;
      }
    }
    index += 1;
  }
  return styles;
}

function collectTikzsetDirectOptions(source) {
  const options = {};
  let index = 0;
  while (index < source.length) {
    if (source.startsWith("\\tikzset", index)) {
      const parsed = parseTikzsetDefinition(source, index);
      if (parsed) {
        Object.assign(options, tikzsetDirectOptions(parsed.styleOptions));
        index = parsed.end;
        continue;
      }
    }
    index += 1;
  }
  return options;
}

function collectTikzsetStoredVariables(source) {
  const variables = {};
  const stores = new Map();
  let index = 0;
  while (index < source.length) {
    if (!source.startsWith("\\tikzset", index)) {
      index += 1;
      continue;
    }
    const parsed = parseTikzsetDefinition(source, index);
    if (!parsed) {
      index += "\\tikzset".length;
      continue;
    }
    for (const [rawKey, rawValue] of Object.entries(parsed.styleOptions || {})) {
      const key = String(rawKey).trim();
      const storeMatch = key.match(/^(.+?)\s*\/\.store\s+in$/);
      if (storeMatch && typeof rawValue === "string") {
        const macro = rawValue.trim().match(/^\\([A-Za-z@]+)$/);
        if (macro) stores.set(storeMatch[1].trim(), macro[1]);
        continue;
      }
      const macro = stores.get(key);
      if (macro && rawValue !== undefined && rawValue !== null && rawValue !== true) {
        variables[macro] = String(rawValue).trim();
      }
    }
    index = parsed.end;
  }
  return variables;
}

function collectPgfFormOnlyPatternDeclarations(source) {
  const declarations = [];
  let index = 0;
  while (index < source.length) {
    const start = source.indexOf("\\pgfdeclarepatternformonly", index);
    if (start < 0) break;
    const parsed = parsePgfDeclarePatternFormOnlyAt(source, start);
    if (parsed) {
      declarations.push(parsed.statement);
      index = parsed.end;
    } else {
      index = start + "\\pgfdeclarepatternformonly".length;
    }
  }
  return declarations;
}

function parsePgfDeclarePatternFormOnlyAt(source, start) {
  let index = skipWhitespace(source, start + "\\pgfdeclarepatternformonly".length);
  const optional = source[index] === "[" ? extractBalanced(source, index, "[", "]") : null;
  if (optional) index = skipWhitespace(source, optional.end);
  const name = extractBalanced(source, index, "{", "}");
  if (!name) return null;
  index = skipWhitespace(source, name.end);
  const groups = [];
  for (let count = 0; count < 4; count += 1) {
    const group = extractBalanced(source, index, "{", "}");
    if (!group) return null;
    groups.push(group.content);
    index = skipWhitespace(source, group.end);
  }
  return {
    statement: {
      type: "pgfdeclarepatternformonly",
      name: name.content.trim(),
      arguments: optional?.content.trim() || "",
      lowerLeft: groups[0].trim(),
      upperRight: groups[1].trim(),
      tileSize: groups[2].trim(),
      body: groups[3],
      raw: source.slice(start, index)
    },
    end: index
  };
}

function tikzsetDirectOptions(options = {}) {
  return Object.fromEntries(Object.entries(options).filter(([key]) => !/\/\./.test(String(key))));
}

function collectCodeDefinitions(source) {
  let handlers = {};
  let index = 0;
  while (index < source.length) {
    if (source.startsWith("\\tikzset", index)) {
      const parsed = parseTikzsetDefinition(source, index);
      if (parsed) {
        handlers = codeDefinitionsFromOptions(parsed.styleOptions || {}, handlers);
        index = parsed.end;
        continue;
      }
    }
    index += 1;
  }
  return handlers;
}

function collectPicDefinitions(source) {
  const pics = {};
  let index = 0;
  while (index < source.length) {
    if (source.startsWith("\\tikzset", index)) {
      const parsed = parseTikzsetDefinition(source, index);
      if (parsed) {
        Object.assign(pics, parsed.pics);
        index = parsed.end;
        continue;
      }
    }
    index += 1;
  }
  return pics;
}

function collectCoordinateSystemDefinitions(source) {
  const systems = {};
  let index = 0;
  while (index < source.length) {
    const start = source.indexOf("\\tikzdeclarecoordinatesystem", index);
    if (start === -1) break;
    const parsed = parseCoordinateSystemDefinition(source, start);
    if (parsed) {
      systems[parsed.name] = parsed.definition;
      index = parsed.end;
      continue;
    }
    index = start + "\\tikzdeclarecoordinatesystem".length;
  }
  return systems;
}

function parseCoordinateSystemDefinition(source, start) {
  let index = start + "\\tikzdeclarecoordinatesystem".length;
  index = skipWhitespace(source, index);
  const name = extractBalanced(source, index, "{", "}");
  if (!name) return null;
  index = skipWhitespace(source, name.end);
  const body = extractBalanced(source, index, "{", "}");
  if (!body) return null;
  const point = parseCoordinateSystemPoint(body.content);
  if (!point) return null;
  return {
    name: name.content.trim(),
    definition: {
      macros: parseCoordinateSystemMathMacros(body.content),
      point
    },
    end: body.end
  };
}

function parseCoordinateSystemMathMacros(body) {
  const macros = [];
  const pattern = /\\pgfmathsetmacro\s*(?:\\([A-Za-z@]+)|\{\\?([A-Za-z@]+)\})\s*\{([^{}]*)\}/g;
  for (const match of body.matchAll(pattern)) {
    macros.push({
      name: (match[1] || match[2] || "").trim(),
      expression: match[3].trim()
    });
  }
  return macros.filter((macro) => macro.name);
}

function parseCoordinateSystemPoint(body) {
  const pointxy = body.match(/\\pgfpointxy\s*\{([^{}]*)\}\s*\{([^{}]*)\}/);
  if (pointxy) {
    return { kind: "xy", x: pointxy[1].trim(), y: pointxy[2].trim() };
  }
  const point = body.match(/\\pgfpoint\s*\{([^{}]*)\}\s*\{([^{}]*)\}/);
  if (point) {
    return { kind: "point", x: point[1].trim(), y: point[2].trim() };
  }
  return null;
}

function parseTikzsetDefinition(source, start) {
  let index = start + "\\tikzset".length;
  index = skipWhitespace(source, index);
  const body = extractBalanced(source, index, "{", "}");
  if (!body) return null;
  return {
    styles: parseTikzset(body.content),
    styleOptions: parseOptions(body.content),
    pics: parseTikzPics(body.content),
    end: body.end
  };
}

function parseTikzPics(input = "") {
  const pics = {};
  for (const part of splitTopLevel(input, ",")) {
    const match = part.match(/^(.+?)\/\.pic\s*=\s*\{([\s\S]*)\}$/);
    if (match) pics[match[1].trim()] = match[2].trim();
  }
  return pics;
}

function parseTikzstyleDefinition(source, start) {
  let index = start + "\\tikzstyle".length;
  index = skipWhitespace(source, index);
  let name = null;
  if (source[index] === "{") {
    const parsedName = extractBalanced(source, index, "{", "}");
    if (!parsedName) return null;
    name = parsedName.content.trim();
    index = parsedName.end;
  } else {
    const match = source.slice(index).match(/^([A-Za-z0-9_./ -]+)/);
    if (!match) return null;
    name = match[1].trim();
    index += match[0].length;
  }
  index = skipWhitespace(source, index);
  if (source[index] !== "=") return null;
  index = skipWhitespace(source, index + 1);
  const options = extractBalanced(source, index, "[", "]");
  if (!name || !options) return null;
  return {
    name,
    options: options.content,
    end: options.end
  };
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

function parseOptionalOptions(text, start) {
  let index = skipWhitespace(text, start);
  if (text[index] !== "[") return { raw: "", options: {}, end: index };
  const parsed = extractOptionalOptionList(text, index);
  if (!parsed) return { raw: "", options: {}, end: index };
  return {
    raw: parsed.content,
    options: parseOptions(parsed.content),
    end: parsed.end
  };
}

function extractOptionalOptionList(text, start) {
  if (text[start] !== "[") return null;
  let paren = 0;
  let brace = 0;
  let bracket = 1;
  let optionPart = "";
  for (let i = start + 1; i < text.length; i += 1) {
    const char = text[i];
    if (brace === 0 && char === "(") paren += 1;
    if (brace === 0 && char === ")") paren = Math.max(0, paren - 1);
    if (char === "{") brace += 1;
    if (char === "}") brace = Math.max(0, brace - 1);

    if (brace === 0 && paren === 0 && char === "[" && isBareDelimiterOptionBracket(optionPart)) {
      optionPart += char;
      continue;
    }
    if (brace === 0 && paren === 0 && char === "[") {
      bracket += 1;
      optionPart += char;
      continue;
    }
    if (brace === 0 && paren === 0 && char === "]") {
      bracket -= 1;
      if (bracket === 0) {
        return {
          content: text.slice(start + 1, i),
          start,
          end: i + 1
        };
      }
      optionPart += char;
      continue;
    }
    if (brace === 0 && paren === 0 && bracket === 1 && char === ",") {
      optionPart = "";
    } else {
      optionPart += char;
    }
  }
  return null;
}

export function extractBalanced(text, start, open, close) {
  if (text[start] !== open) return null;
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (char === open) depth += 1;
    if (char === close) depth -= 1;
    if (depth === 0) {
      return {
        content: text.slice(start + 1, i),
        start,
        end: i + 1
      };
    }
  }
  return null;
}

function unsupported(command, raw, message) {
  return {
    type: "unsupported",
    command,
    raw,
    diagnostic: { severity: "warning", message }
  };
}

function skipWhitespace(text, index) {
  let cursor = index;
  while (/\s/.test(text[cursor] || "")) cursor += 1;
  return cursor;
}

function readCommandName(text, start) {
  const match = String(text).slice(start).match(/^[A-Za-z@]+/);
  if (!match) return null;
  return {
    value: match[0],
    end: start + match[0].length
  };
}

function startsKeyword(text, index, keyword) {
  if (!text.startsWith(keyword, index)) return false;
  const before = text[index - 1];
  const after = text[index + keyword.length];
  return !/[A-Za-z]/.test(before || "") && !/[A-Za-z]/.test(after || "");
}

function isTokenBoundary(char) {
  return !/[A-Za-z]/.test(char || "");
}

function nextTokenEnd(text, index) {
  let cursor = index;
  while (cursor < text.length && !/[\s;{}\[\]]/.test(text[cursor])) cursor += 1;
  return cursor;
}

function nextDelimiter(text, index) {
  const candidates = ["--", "..", "(", ";", " grid ", " circle", " ellipse", " arc", " node", " edge", " to", " plot", " pic"]
    .map((needle) => text.indexOf(needle, index + 1))
    .filter((value) => value !== -1);
  return candidates.length ? Math.min(...candidates) : text.length;
}
