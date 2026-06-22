import { evaluateMath, parseDimension } from "./math.js";
import { applyPreprocessExtensions } from "./extensions/index.js";
import { parseOptions, splitTopLevel } from "./options.js";
import { collectTikzLibraries, stripTikzLibraryDeclarations } from "./tikz-libraries.js";
import {
  TIKZ_AXIS_CONTAINER_MARGIN,
  TIKZ_HIDDEN_AXIS_CONTAINER_MARGIN,
  TIKZ_PGFPLOTS_MIDDLE_AXIS_RESERVED_X,
  TIKZ_PGFPLOTS_MIDDLE_AXIS_RESERVED_Y
} from "./tikz-metrics.js";

const BUILTIN_MACROS = new Set(["draw", "path", "fill", "filldraw", "node", "coordinate", "foreach"]);

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
  const libraries = collectTikzLibraries(expanded);
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
    options
  });
  expanded = expandTkzGraphMacros(expanded);
  expanded = expandTikzScopeEnvironments(expanded, diagnostics);
  expanded = expandTransparentEnvironment(expanded, "pgfonlayer", diagnostics);
  expanded = expandPgfplotsAxes(expanded, diagnostics, options);
  expanded = normalizeTikzPictureAliases(expanded);
  expanded = stripTexDocumentShell(expanded);
  return { source: expanded, diagnostics, libraries };
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
  const base = ["draw", "circle", "minimum size=18pt", "inner sep=2pt", "line width=0.5pt", "fill=white", "text=black"];
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

function renderAxisAsTikz(axisOptions, body, options, diagnostics = []) {
  const addplots = parseAddplots(body, options, diagnostics);
  const legendEntries = parseLegendEntries(body);
  const ranges = computeAxisRanges(axisOptions, addplots);
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = [renderAxisFrame(geometry)];
  if (axisOptions.grid || String(axisOptions.grid || "").includes("major")) {
    commands.push(...renderAxisGrid(ranges, geometry));
  }
  if (axisOptions["axis lines"] || axisOptions.axis) {
    commands.push(...renderAxisLines(axisOptions, ranges, geometry));
  }
  commands.push(...renderAxisTicks(axisOptions, addplots, ranges, geometry));
  addplots.forEach((plot, plotIndex) => {
    commands.push(...renderAddplot(plot, axisOptions, ranges, geometry, options, plotIndex));
  });
  commands.push(...renderAxisLabels(axisOptions, ranges, geometry));
  commands.push(...renderLegendEntries(axisOptions, ranges, geometry, legendEntries));
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
    const plotOptions = parseOptions(parsedOptions.raw);
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
          points: parsePgfplotsTablePoints(tableText, parseOptions(tableOptions.raw), diagnostics),
          closedCycle
        });
        cursor = table.end;
      }
    } else if (body[cursor] === "{") {
      const expression = extractBalanced(body, cursor, "{", "}");
      if (expression) {
        plots.push({
          type: "function",
          is3d,
          options: plotOptions,
          expression: expression.content.trim(),
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

function parsePgfplotsTablePoints(content, tableOptions = {}, diagnostics = []) {
  const rows = normalizePgfplotsTableRows(content, tableOptions);
  if (rows.length < 2) return [];
  const headers = rows[0].map((cell) => cell.trim());
  const xColumn = String(tableOptions.x || "x").trim();
  const yColumn = String(tableOptions.y || "y").trim();
  const xIndex = headers.includes(xColumn) ? headers.indexOf(xColumn) : 0;
  const yIndex = headers.includes(yColumn) ? headers.indexOf(yColumn) : Math.min(1, Math.max(0, headers.length - 1));
  const points = [];
  for (const row of rows.slice(1)) {
    if (!row.length || row.every((cell) => !String(cell).trim())) continue;
    const x = axisNumber(row[xIndex]);
    const y = axisNumber(row[yIndex]);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      points.push({ x, y, raw: `(${row[xIndex]},${row[yIndex]})` });
    } else {
      diagnostics.push({ severity: "warning", message: "Skipped non-numeric pgfplots table row" });
    }
  }
  return points;
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
  const domain = parseDomain(axisOptions.domain || "-1:1");
  const xLog = isLogAxis(axisOptions, "x");
  const yLog = isLogAxis(axisOptions, "y");
  const hasExplicitXMin = hasAxisBound(axisOptions.xmin);
  const hasExplicitXMax = hasAxisBound(axisOptions.xmax);
  const hasExplicitYMin = hasAxisBound(axisOptions.ymin);
  const hasExplicitYMax = hasAxisBound(axisOptions.ymax);
  let xMin = axisNumber(axisOptions.xmin, xLog ? 1 : domain.start);
  let xMax = axisNumber(axisOptions.xmax, xLog ? 10 : domain.end);
  let yMin = hasExplicitYMin ? axisNumber(axisOptions.ymin) : Infinity;
  let yMax = hasExplicitYMax ? axisNumber(axisOptions.ymax) : -Infinity;
  for (const plot of addplots) {
    if (plot.type === "coordinates") {
      for (const point of plot.points) {
        if (!hasExplicitXMin) xMin = Math.min(xMin, point.x);
        if (!hasExplicitXMax) xMax = Math.max(xMax, point.x);
        if (!hasExplicitYMin) yMin = Math.min(yMin, point.y);
        if (!hasExplicitYMax) yMax = Math.max(yMax, point.y);
      }
    }
    if (plot.type === "function") {
      const plotDomain = parseDomain(plot.options.domain || axisOptions.domain || "-1:1");
      if (!hasExplicitXMin) xMin = Math.min(xMin, plotDomain.start);
      if (!hasExplicitXMax) xMax = Math.max(xMax, plotDomain.end);
      const samples = axisSamples(plot.options.samples || axisOptions.samples || 25, 80);
      for (let index = 0; index < samples; index += 1) {
        const t = samples === 1 ? 0 : index / (samples - 1);
        const x = plotDomain.start + (plotDomain.end - plotDomain.start) * t;
        const y = evaluateAxisExpression(plot.expression, x, axisOptions);
        if (Number.isFinite(y)) {
          if (!hasExplicitYMin) yMin = Math.min(yMin, y);
          if (!hasExplicitYMax) yMax = Math.max(yMax, y);
        }
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
  if (xLog) {
    xMin = Math.max(1e-9, xMin);
    xMax = Math.max(xMin * 10, xMax);
  }
  if (yLog) {
    yMin = Math.max(1e-9, yMin);
    yMax = Math.max(yMin * 10, yMax);
  }
  return {
    xMin: roundAxis(xMin),
    xMax: roundAxis(xMax),
    yMin: roundAxis(yMin),
    yMax: roundAxis(yMax)
  };
}

function hasAxisBound(value) {
  return value !== undefined && value !== null && value !== true && String(value).trim() !== "";
}

function createAxisGeometry(axisOptions, ranges) {
  const scale = axisScaleFactor(axisOptions.scale);
  const fallbackWidth = Math.max(4, Math.min(12, Math.abs(ranges.xMax - ranges.xMin) || 6));
  const fallbackHeight = Math.max(3, Math.min(8, Math.abs(ranges.yMax - ranges.yMin) || 4));
  const xUnitWidth = axisOptions["pgfplots explicit x unit"] ? axisUnitDimension(axisOptions.x, ranges.xMax - ranges.xMin) : null;
  const yUnitHeight = axisOptions["pgfplots explicit y unit"] ? axisUnitDimension(axisOptions.y, ranges.yMax - ranges.yMin) : null;
  const requestedWidth = parseAxisDimension(axisOptions.width, xUnitWidth ?? fallbackWidth) * scale;
  const requestedHeight = parseAxisDimension(axisOptions.height, yUnitHeight ?? fallbackHeight) * scale;
  const { width, height } = axisPlotAreaSize(axisOptions, requestedWidth, requestedHeight);
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
  return { width, height, origin, margin, mapPoint, xLog, yLog };
}

function axisScaleFactor(raw) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function scaleAxisMargin(margin, scale) {
  return Object.fromEntries(Object.entries(margin).map(([key, value]) => [key, value * scale]));
}

function axisPlotAreaSize(axisOptions, requestedWidth, requestedHeight) {
  if (!isMiddleAxis(axisOptions)) return { width: requestedWidth, height: requestedHeight };
  return {
    width: Math.max(requestedWidth * 0.5, requestedWidth - TIKZ_PGFPLOTS_MIDDLE_AXIS_RESERVED_X),
    height: Math.max(requestedHeight * 0.5, requestedHeight - TIKZ_PGFPLOTS_MIDDLE_AXIS_RESERVED_Y)
  };
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

function renderAxisTicks(axisOptions, addplots, ranges, geometry) {
  const commands = [];
  const xTicks = axisTickValues(axisOptions.xtick, "x", addplots);
  const yTicks = axisTickValues(axisOptions.ytick, "y", addplots);
  const xLabels = axisTickLabels(axisOptions.xticklabels, xTicks);
  const yLabels = axisTickLabels(axisOptions.yticklabels, yTicks);
  const tickLength = 0.07;
  const middleAxis = isMiddleAxis(axisOptions);
  const yAxis = middleAxis && ranges.yMin <= 0 && ranges.yMax >= 0 ? 0 : ranges.yMin;
  const xAxis = middleAxis && ranges.xMin <= 0 && ranges.xMax >= 0 ? 0 : ranges.xMin;
  xTicks.forEach((x, index) => {
    const base = geometry.mapPoint({ x, y: yAxis });
    commands.push(`\\draw[axis tick, black, line width=0.25pt] ${formatAxisPoint(base)} -- ${formatAxisPoint(offsetPoint(base, 0, -tickLength))};`);
    commands.push(`\\node[axis tick label, anchor=north, font=\\scriptsize] at ${formatAxisPoint(offsetPoint(base, 0, -tickLength * 1.8))} {${xLabels[index]}};`);
  });
  yTicks.forEach((y, index) => {
    const base = geometry.mapPoint({ x: xAxis, y });
    commands.push(`\\draw[axis tick, black, line width=0.25pt] ${formatAxisPoint(base)} -- ${formatAxisPoint(offsetPoint(base, -tickLength, 0))};`);
    commands.push(`\\node[axis tick label, anchor=east, font=\\scriptsize] at ${formatAxisPoint(offsetPoint(base, -tickLength * 1.8, 0))} {${yLabels[index]}};`);
  });
  return commands;
}

function axisTickValues(raw, axis, addplots) {
  const text = String(raw || "").trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  if (!text) return [];
  if (text === "\\empty" || text === "empty") return [];
  if (text === "data") return uniqueAxisValues(addplots.flatMap((plot) => plot.points || []).map((point) => point[axis]));
  return splitBracedList(text).map((part) => axisNumber(part, NaN)).filter(Number.isFinite);
}

function axisTickLabels(raw, ticks) {
  const labels = splitBracedList(raw);
  if (labels.length) return ticks.map((_, index) => labels[index] ?? "");
  return ticks.map((tick) => formatAxisNumber(tick));
}

function splitBracedList(raw) {
  const text = String(raw || "").trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  if (!text) return [];
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

function renderAddplot(plot, axisOptions, ranges, geometry, options, plotIndex = 0) {
  if (plot.type === "coordinates") {
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
      const style = joinOptions(["axis closed cycle", selectPlotFillStyle(plot.options, plotIndex), "draw=none"]);
      commands.push(`\\draw[${style}] ${mappedPoints.map(formatAxisPoint).join(" -- ")} -- cycle;`);
    }
    if (isAxisCombPlot(axisOptions, plot.options, "y")) {
      commands.push(...renderAxisComb(plot.points, axisOptions, ranges, geometry, plot.options, plotIndex, "y"));
      if (shouldRenderPlotMarks(plot.options)) commands.push(...mappedPoints.map((point) => renderPlotMark(point, plot.options, plotIndex)));
      commands.push(...renderNodesNearCoords(plot, axisOptions, geometry));
      return commands;
    }
    if (!plot.options["only marks"] && mappedPoints.length) {
      const style = joinOptions(["axis plot", selectPlotStyle(plot.options, plotIndex)]);
      commands.push(`\\draw[${style}] ${axisPlotPointChain(mappedPoints, axisOptions, plot.options)};`);
    }
    if (plot.options["only marks"] || plot.options.scatter || (mark && mark !== "none")) {
      commands.push(...mappedPoints.map((point) => renderPlotMark(point, plot.options, plotIndex)));
    }
    commands.push(...renderNodesNearCoords(plot, axisOptions, geometry));
    return commands;
  }
  if (plot.type === "function") {
    const plotDomain = parseDomain(plot.options.domain || axisOptions.domain || `${ranges.xMin}:${ranges.xMax}`);
    const visibleDomain = clipDomainToAxisRange(plotDomain, ranges);
    if (!visibleDomain) return [];
    const samples = axisSamples(plot.options.samples || axisOptions.samples || options.pgfplotsSamples || 25, 1200);
    const dataPoints = [];
    for (let index = 0; index < samples; index += 1) {
      const t = samples === 1 ? 0 : index / (samples - 1);
      const x = visibleDomain.start + (visibleDomain.end - visibleDomain.start) * t;
      const y = evaluateAxisExpression(plot.expression, x, axisOptions);
      if (Number.isFinite(y)) dataPoints.push({ x, y });
    }
    const points = dataPoints.map((point) => geometry.mapPoint(point));
    if (isAxisCombPlot(axisOptions, plot.options, "y")) {
      const commands = renderAxisComb(dataPoints, axisOptions, ranges, geometry, plot.options, plotIndex, "y");
      if (shouldRenderPlotMarks(plot.options)) commands.push(...points.map((point) => renderPlotMark(point, plot.options, plotIndex)));
      return commands;
    }
    const style = joinOptions(["axis plot", selectPlotStyle(plot.options, plotIndex)]);
    return points.length ? [`\\draw[${style}] ${axisPlotPointChain(points, axisOptions, plot.options)};`] : [];
  }
  return [];
}

function clipDomainToAxisRange(domain, ranges) {
  const start = Math.max(domain.start, ranges.xMin);
  const end = Math.min(domain.end, ranges.xMax);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return null;
  return { start, end };
}

function axisPlotPointChain(points, axisOptions, plotOptions) {
  if (points.length < 2) return points.map(formatAxisPoint).join(" -- ");
  if (!isConstPlot(axisOptions, plotOptions) && isSmoothAxisPlot(plotOptions) && points.length >= 3) {
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

function isSmoothAxisPlot(plotOptions = {}) {
  const value = plotOptions.smooth;
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
  const withHelpers = expandPgfMathHelpers(expression);
  const substituted = String(withHelpers).replace(/\\x\b/g, `(${x})`).replace(/\bx\b/g, `(${x})`);
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

function expandPgfMathHelpers(expression) {
  return String(expression || "").replace(/\bgauss\s*\(\s*([^,()]+)\s*,\s*([^()]+)\)/g, (_match, mean, sigma) => {
    const mu = mean.trim();
    const sd = sigma.trim();
    return `(1/((${sd})*sqrt(2*pi))*exp(-((x-(${mu}))^2)/(2*(${sd})^2)))`;
  });
}

function normalizeAxisExpression(input, radianTrig) {
  const trigPrefix = radianTrig ? "Math.$1(" : "Math.$1((Math.PI/180)*";
  return String(input)
    .trim()
    .replace(/^\{([\s\S]*)\}$/, "$1")
    .replace(/\bpi\b/g, "Math.PI")
    .replace(/\^/g, "**")
    .replace(/-\s*(\([^()]+\)|[A-Za-z0-9.]+)\s*\*\*\s*(\([^()]+\)|[A-Za-z0-9.]+)/g, "-($1**$2)")
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
