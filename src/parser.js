import { createToken, Lexer } from "chevrotain";
import { codeDefinitionsFromOptions, isBareDelimiterOptionBracket, parseOptions, parseTikzset, splitTopLevel } from "./options.js";
import { preprocessTikzSource } from "./preprocess.js";

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

  const pictures = extractTikzPictures(preprocessed.source).map((picture) => {
    const prePictureSource = preprocessed.source.slice(0, picture.beginIndex);
    const globalStyles = collectStyleDefinitions(prePictureSource);
    const globalCodeHandlers = collectCodeDefinitions(prePictureSource);
    const globalPics = collectPicDefinitions(prePictureSource);
    const globalPgfMath = collectPgfMathMacros(prePictureSource);
    const globalCoordinateSystems = collectCoordinateSystemDefinitions(prePictureSource);
    const statements = parseStatements(picture.body, diagnostics);
    return {
      type: "tikzpicture",
      beginIndex: picture.beginIndex,
      bodyEndIndex: picture.bodyEndIndex,
      endIndex: picture.endIndex,
      options: parseOptions(picture.optionsRaw),
      styles: globalStyles,
      codeHandlers: globalCodeHandlers,
      pics: globalPics,
      coordinateSystems: globalCoordinateSystems,
      pgfMathMacros: globalPgfMath,
      randomLists,
      libraries,
      packages,
      pgfplotsLibraries,
      pgfplotsOptions,
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
      shadings: shadingDefinitions,
      coordinateSystems,
      pictures
    },
    diagnostics
  };
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
  if (text.startsWith("\\coordinate")) return parseCoordinateStatement(text, diagnostics);
  if (text.startsWith("\\pgfmathsetlengthmacro")) return parsePgfMathSetLength(text, diagnostics);
  if (text.startsWith("\\pgfmathsetmacro")) return parsePgfMath(text, diagnostics);
  if (text.startsWith("\\pgfmathtruncatemacro")) return parsePgfMathTruncate(text, diagnostics);
  if (text.startsWith("\\pgfmathdeclarerandomlist")) return parsePgfMathDeclareRandomList(text, diagnostics);
  if (text.startsWith("\\pgfmathrandomitem")) return parsePgfMathRandomItem(text, diagnostics);
  if (text.startsWith("\\ifnum")) return parseIfNum(text, diagnostics);
  if (text.startsWith("\\pgftransformcm")) return parsePgfTransformCm(text);
  if (text.startsWith("\\pgftransformreset")) return { type: "pgftransformreset", raw: text };
  if (text.startsWith("\\tikzset")) return parseTikzsetStatement(text, diagnostics);
  if (text.startsWith("\\tikzstyle")) return parseTikzstyleStatement(text);
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
  if (text.startsWith("{[")) return parseScope(text, diagnostics);
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

function parseForeach(text, diagnostics) {
  const header = parseForeachHeader(text);
  if (!header) {
    return unsupported("foreach", text, "Malformed \\foreach statement");
  }
  let index = header.end;
  const list = extractBalanced(text, index, "{", "}");
  if (!list) return unsupported("foreach", text, "Malformed \\foreach value list");
  index = list.end;
  index = skipWhitespace(text, index);
  const body = extractBalanced(text, index, "{", "}");
  if (!body) {
    return {
      type: "foreach",
      variables: header.variables,
      options: header.options,
      values: splitTopLevel(list.content, ","),
      body: parseStatements(text.slice(index), diagnostics),
      bodySource: text.slice(index),
      raw: text
    };
  }
  return {
    type: "foreach",
    variables: header.variables,
    options: header.options,
    values: splitTopLevel(list.content, ","),
    body: parseStatements(body.content, diagnostics),
    bodySource: body.content,
    raw: text
  };
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

function parseCoordinateStatement(text) {
  let index = "\\coordinate".length;
  const parsedOptions = parseOptionalOptions(text, index);
  const options = parsedOptions.options;
  index = skipWhitespace(text, parsedOptions.end);
  const name = extractBalanced(text, index, "(", ")");
  if (!name) return unsupported("coordinate", text, "Malformed \\coordinate statement");
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

  if (text[index] === "(") {
    const parsedName = extractBalanced(text, index, "(", ")");
    name = parsedName?.content.trim() || name;
    index = skipWhitespace(text, parsedName?.end || index);
  }

  const beforeLabelOptions = parseOptionalOptions(text, index);
  options = { ...options, ...beforeLabelOptions.options };
  index = skipWhitespace(text, beforeLabelOptions.end);
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
    const child = parseNodeTreeChild(text, index, diagnostics);
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
  const options = extractBalanced(text, 1, "[", "]");
  if (!options) return unsupported("scope", text, "Malformed scope options");
  const end = text.lastIndexOf("}");
  if (end === -1) return unsupported("scope", text, "Malformed scope body");
  return {
    type: "scope",
    options: parseOptions(options.content),
    body: parseStatements(text.slice(options.end, end), diagnostics),
    raw: text
  };
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

function parsePathCommand(command, text) {
  const parsedOptions = parseOptionalOptions(text, 0);
  const pathText = text.slice(parsedOptions.end).trim();
  if (pathText.startsWith("\\foreach")) {
    const foreach = parseForeachPathCommand(command, parsedOptions.options, pathText);
    if (foreach) return foreach;
  }
  return {
    type: "path",
    command,
    options: parsedOptions.options,
    path: {
      raw: pathText,
      segments: parsePathSegments(pathText)
    },
    raw: `\\${command}${text}`
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

function parsePathSegments(pathText) {
  const segments = [];
  let index = 0;
  while (index < pathText.length) {
    index = skipWhitespace(pathText, index);
    if (index >= pathText.length) break;

    const extOperator = parseExtendedPathOperator(pathText, index);
    if (extOperator) {
      segments.push(extOperator.segment);
      index = extOperator.end;
      continue;
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
  const c1 = extractBalanced(pathText, cursor, "(", ")");
  if (!c1) return null;
  cursor = skipWhitespace(pathText, c1.end);
  if (!startsKeyword(pathText, cursor, "and")) return null;
  cursor += "and".length;
  cursor = skipWhitespace(pathText, cursor);
  const c2 = extractBalanced(pathText, cursor, "(", ")");
  if (!c2) return null;
  cursor = skipWhitespace(pathText, c2.end);
  if (!pathText.startsWith("..", cursor)) return null;
  cursor += 2;
  cursor = skipWhitespace(pathText, cursor);
  const to = extractBalanced(pathText, cursor, "(", ")");
  if (!to) return null;
  return {
    segment: {
      kind: "curveTo",
      c1: c1.content.trim(),
      c2: c2.content.trim(),
      to: to.content.trim()
    },
    end: to.end
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
  if (!label) return null;
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
      (nextNonWhitespace(body, i + 1)?.startsWith("\\") || nextNonWhitespace(body, i + 1)?.startsWith("{["))
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
    text.startsWith("\\pgfplotsset") ||
    text.startsWith("\\ctikzset") ||
    text.startsWith("\\pgfplotstableread") ||
    text.startsWith("\\pgfplotstabletypeset") ||
    text.startsWith("\\tikzset") ||
    text.startsWith("{")
  );
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
  "itshape"
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
  const match = text.match(/^\\foreach\s+(.+?)\s+in\s*/);
  if (!match) return false;
  let cursor = match[0].length;
  const values = extractBalanced(text, cursor, "{", "}");
  if (!values) return false;
  cursor = skipWhitespace(text, values.end);
  if (text[cursor] !== "{") return false;
  const body = extractBalanced(text, cursor, "{", "}");
  if (!body) return false;
  return text.slice(body.end).trim() === "";
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
      beginIndex,
      bodyEndIndex: endIndex,
      endIndex: endIndex + end.length,
      optionsRaw: options.raw,
      body: source.slice(cursor, endIndex)
    });
    index = endIndex + end.length;
  }
  if (pictures.length === 0 && source.trim()) {
    pictures.push({ beginIndex: 0, bodyEndIndex: source.length, endIndex: source.length, optionsRaw: "", body: source });
  }
  return pictures;
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
  const candidates = ["--", "..", "(", ";", " grid ", " circle", " ellipse", " arc", " node", " edge", " to", " plot"]
    .map((needle) => text.indexOf(needle, index + 1))
    .filter((value) => value !== -1);
  return candidates.length ? Math.min(...candidates) : text.length;
}
