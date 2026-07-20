import { parseOptions } from "../engine/options.js";

export function expandPgfplotsNamedOptions(rawOptions = {}, styles = {}, depth = 0) {
  if (!styles || depth > 8) return { ...rawOptions };
  let expanded = {};
  for (const [key, value] of Object.entries(rawOptions || {})) {
    const style = styles[key];
    if (style && !String(key).startsWith("__")) {
      expanded = mergePgfplotsOptionMaps(expanded, expandPgfplotsNamedOptions(style, styles, depth + 1));
      const replayOptions = pgfplotsAxisReplayOptions(style);
      if (replayOptions) expanded["__pgfplots axis replay options"] = replayOptions;
      if (value !== true && value !== undefined && value !== null && value !== "") {
        expanded[key] = value;
      }
      continue;
    }
    expanded = mergePgfplotsOptionMaps(expanded, { [key]: value });
  }
  return expanded;
}

function pgfplotsAxisReplayOptions(style = {}) {
  const codeEntry = Object.entries(style).find(([key]) => /^after end axis\/\.(?:append )?code$/i.test(String(key).trim()));
  if (!codeEntry) return null;
  const code = String(codeEntry[1] || "");
  if (!/\\pgfplots(?:drawaxis|@draw@axis)\b/.test(code)) return null;
  const commandIndex = code.indexOf("\\pgfplotsset");
  if (commandIndex < 0) return {};
  const group = extractBalancedGroup(code, commandIndex + "\\pgfplotsset".length);
  return group ? parseOptions(group.content) : {};
}

function extractBalancedGroup(source, start) {
  let cursor = start;
  while (/\s/.test(source[cursor] || "")) cursor += 1;
  if (source[cursor] !== "{") return null;
  let depth = 0;
  for (let index = cursor; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return { content: source.slice(cursor + 1, index) };
    }
  }
  return null;
}

export function mergePgfplotsOptionMaps(target = {}, source = {}) {
  const merged = { ...target };
  for (const [key, value] of Object.entries(source || {})) {
    if (isAccumulatingPgfplotsOption(key) && Object.hasOwn(merged, key)) {
      merged[key] = [...optionValues(merged[key]), ...optionValues(value)];
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

function isAccumulatingPgfplotsOption(key) {
  return (
    key === "declare function" ||
    key === "label in data" ||
    key === "pin in data" ||
    key === "axis line style" ||
    key === "x axis line style" ||
    key === "y axis line style" ||
    key === "z axis line style" ||
    key === "inner axis line style" ||
    key === "outer axis line style"
  );
}

function optionValues(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}
