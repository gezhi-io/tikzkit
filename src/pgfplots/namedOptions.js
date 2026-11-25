import { applyStyleDeclarations, parseOptions } from "../engine/options.js";

// Some PGFPlots keys are shorthand for appending to a named style, e.g.
// "legend image post style". Respect replacements interspersed with appends.
export function resolvePgfplotsScopedStyle(layers, name, appendKey, inherited = {}) {
  const declarations = [];
  for (const layer of layers) {
    for (const [raw, value] of Object.entries(layer || {})) {
      const key = raw.replace(/^\/pgfplots\//, "");
      const mode = key === appendKey ? "append style" : key.startsWith(name + "/.") && key.slice(name.length + 2);
      if (!["style", "append style", "prefix style"].includes(mode)) continue;
      for (const entry of optionValues(value)) declarations.push({ name, mode, options: parseOptions(entry) });
    }
  }
  return applyStyleDeclarations(declarations, { [name]: inherited })[name] ?? inherited;
}

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
  for (const [raw, value] of Object.entries(source || {})) {
    const key = raw === "/tikz/mark" ? "mark" : raw;
    if (isAccumulatingPgfplotsOption(key) && Object.hasOwn(merged, key)) {
      merged[key] = [...optionValues(merged[key]), ...optionValues(value)];
      continue;
    }
    // An author option overriding a cycle/style key executes after that style.
    if (Object.hasOwn(merged, key)) delete merged[key];
    if (key === "mark") {
      // The shared parser retains repeated decoration marks. A plot has one
      // marker register; its last assignment (even an empty one) wins.
      const last = Array.isArray(value) ? value.at(-1) : value;
      merged[key] = String(last ?? "").trim() ? last : "none";
    } else {
      merged[key] = value;
    }
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
