import { createToken, Lexer } from "chevrotain";
import { parseOptions, parseTikzset, splitTopLevel } from "./options.js";
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
  const lexed = TikzLexer.tokenize(preprocessed.source);
  for (const error of lexed.errors) {
    diagnostics.push({
      severity: "error",
      message: error.message,
      offset: error.offset
    });
  }

  const pictures = extractTikzPictures(preprocessed.source).map((picture) => {
    const globalStyles = collectStyleDefinitions(preprocessed.source.slice(0, picture.beginIndex));
    const statements = parseStatements(picture.body, diagnostics);
    return {
      type: "tikzpicture",
      options: parseOptions(picture.optionsRaw),
      styles: globalStyles,
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
  if (text.startsWith("\\foreach")) return parseForeach(text, diagnostics);
  if (text.startsWith("\\coordinate")) return parseCoordinateStatement(text, diagnostics);
  if (text.startsWith("\\pgfmathsetmacro")) return parsePgfMath(text, diagnostics);
  if (text.startsWith("\\pgftransformcm")) return parsePgfTransformCm(text);
  if (text.startsWith("\\pgftransformreset")) return { type: "pgftransformreset", raw: text };
  if (text.startsWith("\\tikzset")) return parseTikzsetStatement(text, diagnostics);
  if (text.startsWith("\\tikzstyle")) return parseTikzstyleStatement(text);
  if (text.startsWith("\\matrix")) return parseMatrix(text);
  if (text.startsWith("\\pic")) return parsePic(text);
  if (text.startsWith("\\toggletrue") || text.startsWith("\\togglefalse") || text.startsWith("\\newtoggle") || text.startsWith("\\color") || text.startsWith("\\braid")) {
    return { type: "noop", raw: text };
  }
  if (text.startsWith("\\node")) return parseNode(text, diagnostics);
  if (text.startsWith("{[")) return parseScope(text, diagnostics);
  if (text.startsWith("{")) return parseBareScope(text, diagnostics);

  const command = text.match(/^\\([A-Za-z@]+)/)?.[1];
  if (["draw", "path", "fill", "filldraw"].includes(command)) {
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
  const match = text.match(/^\\foreach\s+(.+?)\s+in\s*/);
  if (!match) {
    return unsupported("foreach", text, "Malformed \\foreach statement");
  }
  let index = match[0].length;
  const list = extractBalanced(text, index, "{", "}");
  if (!list) return unsupported("foreach", text, "Malformed \\foreach value list");
  index = list.end;
  index = skipWhitespace(text, index);
  const body = extractBalanced(text, index, "{", "}");
  if (!body) {
    return {
      type: "foreach",
      variables: match[1]
        .split("/")
        .map((part) => part.trim().replace(/^\\/, ""))
        .filter(Boolean),
      values: splitTopLevel(list.content, ","),
      body: parseStatements(text.slice(index), diagnostics),
      raw: text
    };
  }
  return {
    type: "foreach",
    variables: match[1]
      .split("/")
      .map((part) => part.trim().replace(/^\\/, ""))
      .filter(Boolean),
    values: splitTopLevel(list.content, ","),
    body: parseStatements(body.content, diagnostics),
    raw: text
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
  const match = text.match(/^\\pgfmathsetmacro\s*\{\\?([^}]+)\}\s*\{([^}]*)\}/);
  if (!match) return unsupported("pgfmathsetmacro", text, "Malformed \\pgfmathsetmacro statement");
  return {
    type: "pgfmathsetmacro",
    name: match[1].trim(),
    expression: match[2].trim(),
    raw: text
  };
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

  const body = extractBalanced(text, index, "{", "}");
  if (!body) return unsupported("matrix", text, "Malformed \\matrix statement");
  return {
    type: "matrix",
    name,
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
  const body = extractBalanced(text, index, "{", "}");
  if (!body) return unsupported("pic", text, "Malformed \\pic statement");
  return {
    type: "pic",
    name,
    options,
    body: body.content.trim(),
    raw: text
  };
}

function parseNode(text) {
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
  return {
    type: "node",
    name,
    options,
    at,
    text: label.content,
    path: trailingPath ? {
      raw: trailingPath,
      segments: parsePathSegments(trailingPath)
    } : null,
    raw: text
  };
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

    if (pathText.startsWith("--", index)) {
      segments.push({ kind: "operator", value: "--" });
      index += 2;
      continue;
    }
    if (pathText.startsWith("|-", index) || pathText.startsWith("-|", index)) {
      segments.push({ kind: "operator", value: pathText.slice(index, index + 2) });
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
    if (pathText.startsWith("++(", index) || pathText.startsWith("+(", index)) {
      const plusLength = pathText.startsWith("++(", index) ? 2 : 1;
      const coord = extractBalanced(pathText, index + plusLength, "(", ")");
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
    const next = nextDelimiter(pathText, index);
    segments.push({ kind: "unknown", raw: pathText.slice(index, next).trim() });
    index = next;
  }
  return segments.filter((segment) => segment.kind !== "unknown" || segment.raw);
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
  const target = extractBalanced(pathText, cursor, "(", ")");
  if (!target) return null;
  return {
    segment: { kind, options: { ...leadingOptions, ...options.options }, to: target.content.trim(), nodes },
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
  cursor = skipWhitespace(pathText, cursor);
  const target = extractBalanced(pathText, cursor, "(", ")");
  if (!target) return null;
  return {
    segment: { kind: "plot", coordinate: target.content.trim() },
    end: target.end
  };
}

function parseInlineNodeSegment(pathText, index) {
  let cursor = index + "node".length;
  const options = parseOptionalOptions(pathText, cursor);
  cursor = options.end;
  cursor = skipWhitespace(pathText, cursor);
  let at = null;
  let name = null;
  if (startsKeyword(pathText, cursor, "at")) {
    cursor += "at".length;
    cursor = skipWhitespace(pathText, cursor);
    const coord = parseCoordinateArgument(pathText, cursor);
    if (!coord) return null;
    at = coord.content.trim();
    cursor = skipWhitespace(pathText, coord.end);
  }
  if (pathText[cursor] === "(") {
    const parsedName = extractBalanced(pathText, cursor, "(", ")");
    name = parsedName?.content.trim() || null;
    cursor = skipWhitespace(pathText, parsedName?.end || cursor);
  }
  const label = extractBalanced(pathText, cursor, "{", "}");
  if (!label) return null;
  return {
    segment: { kind: "node", options: options.options, at, name, text: label.content },
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
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    if (char === "(") paren += 1;
    if (char === ")") paren = Math.max(0, paren - 1);
    if (char === "[") bracket += 1;
    if (char === "]") bracket = Math.max(0, bracket - 1);
    if (char === "{") brace += 1;
    if (char === "}") brace = Math.max(0, brace - 1);
    current += char;
    if (char === ";" && paren === 0 && bracket === 0 && brace === 0) {
      statements.push(current);
      current = "";
    } else if (
      char === "}" &&
      paren === 0 &&
      bracket === 0 &&
      brace === 0 &&
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
  const text = statement.trim();
  if (text.startsWith("\\foreach")) return hasCompleteBracedForeachBody(text);
  return (
    text.startsWith("\\toggletrue") ||
    text.startsWith("\\togglefalse") ||
    text.startsWith("\\newtoggle") ||
    text.startsWith("\\color") ||
    text.startsWith("\\pgfmathsetmacro") ||
    text.startsWith("\\tikzset") ||
    text.startsWith("{")
  );
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
      optionsRaw: options.raw,
      body: source.slice(cursor, endIndex)
    });
    index = endIndex + end.length;
  }
  if (pictures.length === 0 && source.trim()) {
    pictures.push({ beginIndex: 0, optionsRaw: "", body: source });
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

function parseTikzsetDefinition(source, start) {
  let index = start + "\\tikzset".length;
  index = skipWhitespace(source, index);
  const body = extractBalanced(source, index, "{", "}");
  if (!body) return null;
  return {
    styles: parseTikzset(body.content),
    end: body.end
  };
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
  const parsed = extractBalanced(text, index, "[", "]");
  if (!parsed) return { raw: "", options: {}, end: index };
  return {
    raw: parsed.content,
    options: parseOptions(parsed.content),
    end: parsed.end
  };
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

function startsKeyword(text, index, keyword) {
  if (!text.startsWith(keyword, index)) return false;
  const before = text[index - 1];
  const after = text[index + keyword.length];
  return !/[A-Za-z]/.test(before || "") && !/[A-Za-z]/.test(after || "");
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
