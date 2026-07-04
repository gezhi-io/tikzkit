export const TIKZ_SOURCE_GRID = String.raw`\draw[overlay, step=1cm, line width=0.12pt, dash pattern=on 0.7pt off 0.7pt, black!45] (-50,-50) grid (50,50);`;

export function addTikzSourceUnitGrid(source) {
  const text = String(source || "");
  const withEnvironmentGrid = text.replace(/\\begin\s*\{\s*tikzpicture\s*\}(?:\s*\[[^\]]*\])?/, (match) => `${match}\n  ${TIKZ_SOURCE_GRID}`);
  if (withEnvironmentGrid !== text) return withEnvironmentGrid;
  return addTikzCommandGrid(text);
}

function addTikzCommandGrid(source) {
  let searchStart = 0;
  while (searchStart < source.length) {
    const start = findNextTikzCommand(source, searchStart);
    if (start === -1) return source;
    const afterCommand = start + "\\tikz".length;
    const tikzOptions = parseTikzCommandOptions(source, afterCommand);
    const end = findTopLevelSemicolon(source, afterCommand);
    if (end === -1) return source;
    const body = source.slice(tikzOptions.end, end).trim();
    if (isDatavisualizationDataGroupDeclaration(body)) {
      searchStart = end + 1;
      continue;
    }
    const before = source.slice(0, start);
    const after = source.slice(end + 1);
    const wrapperOptions = tikzCommandGridWrapperOptions(tikzOptions.raw, body);
    return `${before}\\begin{tikzpicture}${wrapperOptions ? `[${wrapperOptions}]` : ""}\n  ${TIKZ_SOURCE_GRID}\n  ${body};\n\\end{tikzpicture}${after}`;
  }
  return source;
}

function findNextTikzCommand(source, start) {
  let index = source.indexOf("\\tikz", start);
  while (index !== -1) {
    const next = source[index + "\\tikz".length] || "";
    if (!/[A-Za-z@]/.test(next)) return index;
    index = source.indexOf("\\tikz", index + "\\tikz".length);
  }
  return -1;
}

function tikzCommandGridWrapperOptions(rawOptions, body) {
  const raw = String(rawOptions || "").trim();
  if (!raw) return "";
  if (!isDatavisualizationInvocation(body)) return raw;
  const kept = splitTopLevelOptions(raw).filter((option) => !isTikzGeometryTransformOption(option));
  return kept.join(",");
}

function isDatavisualizationInvocation(body) {
  return /^\\datavisualization\b/.test(String(body || "").trim());
}

function splitTopLevelOptions(raw) {
  const parts = [];
  let current = "";
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;
  const text = String(raw || "");
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\\" && index + 1 < text.length) {
      current += char + text[index + 1];
      index += 1;
      continue;
    }
    if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
    else if (char === "[") bracketDepth += 1;
    else if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === "(") parenDepth += 1;
    else if (char === ")") parenDepth = Math.max(0, parenDepth - 1);
    if (char === "," && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function isTikzGeometryTransformOption(option) {
  const key = String(option || "").split("=")[0].trim();
  return new Set([
    "scale",
    "xscale",
    "yscale",
    "rotate",
    "xshift",
    "yshift",
    "shift",
    "transform canvas",
    "x",
    "y",
    "z",
    "xslant",
    "yslant"
  ]).has(key);
}

function parseTikzCommandOptions(source, start) {
  let cursor = skipWhitespace(source, start);
  if (source[cursor] !== "[") return { raw: "", end: start };
  let depth = 0;
  for (let index = cursor; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "[") depth += 1;
    else if (char === "]") {
      depth -= 1;
      if (depth === 0) return { raw: source.slice(cursor + 1, index), end: index + 1 };
    }
  }
  return { raw: "", end: start };
}

function skipWhitespace(source, start) {
  let cursor = start;
  while (/\s/.test(source[cursor] || "")) cursor += 1;
  return cursor;
}

function isDatavisualizationDataGroupDeclaration(body) {
  return /^\\datavisualization\s+data\s+group\s*\{[\s\S]*?\}\s*=/.test(String(body || "").trim());
}

function findTopLevelSemicolon(source, start) {
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
