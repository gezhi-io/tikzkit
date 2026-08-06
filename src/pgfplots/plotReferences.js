import { selectPlotStyle } from "./plotStyle.js";
import { createPlotReferenceSample } from "../tikz/plotReferenceSamples.js";

// PGFPlots replaces `\label` immediately after `\addplot` with a reference
// to the current legend image. The full TeX implementation serializes that
// image through the aux file; the SVG interpreter retains the same direct
// in-axis semantics as a compact renderer-neutral marker.
export function lowerPgfplotsPlotReferences(body, addplots = []) {
  const bindings = collectPgfplotsPlotReferences(body, addplots);
  if (!bindings.size) return String(body || "");
  return String(body || "").replace(/\\ref\s*\{([^{}]+)\}/g, (match, name) => {
    const style = bindings.get(String(name || "").trim());
    return style ? createPlotReferenceSample(style) : match;
  });
}

export function collectPgfplotsPlotReferences(body, addplots = []) {
  const source = String(body || "");
  const bindings = new Map();
  let searchStart = 0;
  let plotIndex = 0;
  while (searchStart < source.length) {
    const addplotStart = findNextAddplot(source, searchStart);
    if (addplotStart === -1) break;
    const statementEnd = findStatementEnd(source, addplotStart);
    if (statementEnd === -1) break;
    const plot = addplots[plotIndex];
    plotIndex += 1;
    const label = readFollowingLabel(source, statementEnd + 1);
    if (label && plot) bindings.set(label.name, selectPlotStyle(plot.options || {}, plotIndex - 1));
    searchStart = statementEnd + 1;
  }
  return bindings;
}

function findNextAddplot(source, start) {
  let cursor = start;
  while (cursor < source.length) {
    const index = source.indexOf("\\addplot", cursor);
    if (index === -1) return -1;
    const boundary = source[index + "\\addplot".length];
    if (!/[A-Za-z]/.test(boundary || "") || boundary === "3") return index;
    cursor = index + "\\addplot".length;
  }
  return -1;
}

function readFollowingLabel(source, start) {
  let cursor = skipWhitespace(source, start);
  if (!source.startsWith("\\label", cursor)) return null;
  cursor = skipWhitespace(source, cursor + "\\label".length);
  if (source[cursor] === "[") {
    const optional = readBalanced(source, cursor, "[", "]");
    if (!optional) return null;
    cursor = skipWhitespace(source, optional.end);
  }
  const name = readBalanced(source, cursor, "{", "}");
  if (!name || !name.content.trim()) return null;
  return { name: name.content.trim(), end: name.end };
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

function readBalanced(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\" && index + 1 < source.length) {
      index += 1;
      continue;
    }
    if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return { content: source.slice(start + 1, index), end: index + 1 };
    }
  }
  return null;
}

function skipWhitespace(source, start) {
  let cursor = start;
  while (/\s/.test(source[cursor] || "")) cursor += 1;
  return cursor;
}
