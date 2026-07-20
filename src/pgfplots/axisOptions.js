import { parseOptions, splitTopLevel } from "../engine/options.js";

export const PGFPLOTS_LIBRARY_SUPPORT = {
  groupplots: {
    status: "builtin",
    implementedBy: "src/frontend/latex-shell.js:expandPgfplotsGroupplots",
    features: ["groupplot environment", "\\nextgroupplot", "group size", "horizontal/vertical sep"]
  }
};

export function createAxisOptions(rawOptions = {}) {
  const normalized = Object.fromEntries(
    Object.entries(rawOptions).map(([key, value]) => [key.replace(/^\/pgfplots\//, ""), value])
  );
  const starredAxisLines = normalized["axis lines*"];
  if (starredAxisLines !== undefined && starredAxisLines !== null && starredAxisLines !== "") {
    if (normalized["axis x line"] === undefined && normalized["axis x line*"] === undefined) {
      normalized["axis x line*"] = normalizeStarredAxisLine("x", starredAxisLines);
    }
    if (normalized["axis y line"] === undefined && normalized["axis y line*"] === undefined) {
      normalized["axis y line*"] = normalizeStarredAxisLine("y", starredAxisLines);
    }
    if (normalized["axis z line"] === undefined && normalized["axis z line*"] === undefined) {
      normalized["axis z line*"] = normalizeStarredAxisLine("z", starredAxisLines);
    }
  }
  return {
    ...normalized,
    axisLines: normalized["axis lines"] ?? normalized["axis lines*"] ?? normalized.axis ?? "box",
    width: normalized.width,
    height: normalized.height
  };
}

function normalizeStarredAxisLine(axis, raw) {
  const value = String(raw).trim().toLowerCase();
  if (axis === "x" && value === "left") return "bottom";
  if (axis === "x" && value === "right") return "top";
  return value;
}

export function pgfplotsOptionEnabled(value) {
  if (value === undefined || value === null || value === false) return false;
  const text = String(value).trim().toLowerCase();
  return text !== "false" && text !== "0" && text !== "none" && text !== "off" && text !== "no";
}

export function pgfplotsAxisHidden(axisOptions = {}, axis) {
  if (pgfplotsOptionEnabled(axisOptions["hide axis"]) || pgfplotsOptionEnabled(axisOptions.hide)) return true;
  return pgfplotsOptionEnabled(axisOptions[`hide ${axis} axis`]);
}

export function stripPgfLibraryDeclarations(source) {
  return String(source)
    .replace(/\\usepgflibrary(?:\[[^\]]*\])?\{[^{}]*\}\s*;?/g, "")
    .replace(/\\usepgfplotslibrary(?:\[[^\]]*\])?\{[^{}]*\}\s*;?/g, "");
}

export function collectPgfplotsLibraries(source) {
  const libraries = [];
  const pattern = /\\usepgfplotslibrary(?:\[[^\]]*\])?\{([^{}]*)\}/g;
  let match;
  while ((match = pattern.exec(String(source)))) {
    for (const rawName of splitTopLevel(match[1], ",")) {
      const name = rawName.trim();
      if (!name || libraries.some((library) => library.name === name)) continue;
      const support = PGFPLOTS_LIBRARY_SUPPORT[name];
      libraries.push({
        name,
        status: support?.status || "unsupported",
        implementedBy: support?.implementedBy || null,
        features: support ? [...support.features] : []
      });
    }
  }
  return libraries;
}

export function collectPgfplotsSetOptions(source) {
  const options = {};
  let output = "";
  let index = 0;
  const text = String(source || "");
  while (index < text.length) {
    if (!text.startsWith("\\pgfplotsset", index)) {
      output += text[index];
      index += 1;
      continue;
    }
    const cursor = skipWhitespace(text, index + "\\pgfplotsset".length);
    const body = extractBalanced(text, cursor, "{", "}");
    if (!body) {
      output += text[index];
      index += 1;
      continue;
    }
    Object.assign(options, parseOptions(body.content));
    index = body.end;
    if (text[index] === ";") index += 1;
  }
  return { source: output, options };
}

export function collectPgfplotsCycleLists(source, colorDefinitions = new Map()) {
  const lists = {};
  const text = String(source || "");
  let index = 0;
  while (index < text.length) {
    const start = text.indexOf("\\pgfplotscreateplotcyclelist", index);
    if (start === -1) break;
    let cursor = skipWhitespace(text, start + "\\pgfplotscreateplotcyclelist".length);
    const name = extractBalanced(text, cursor, "{", "}");
    if (!name) {
      index = start + "\\pgfplotscreateplotcyclelist".length;
      continue;
    }
    cursor = skipWhitespace(text, name.end);
    const body = extractBalanced(text, cursor, "{", "}");
    if (!body) {
      index = name.end;
      continue;
    }
    const entries = splitCycleListEntries(stripTexLineComments(body.content))
      .map((entry) => parseCycleListEntry(entry, colorDefinitions))
      .filter((entry) => Object.keys(entry).length);
    if (name.content.trim() && entries.length) lists[name.content.trim()] = entries;
    index = body.end;
  }
  return lists;
}

function parseCycleListEntry(raw, colorDefinitions = new Map()) {
  const text = stripBalancedOuterBraces(raw);
  const options = parseOptions(text);
  const firstPart = splitTopLevel(text, ",")[0]?.trim();
  if (firstPart && options[firstPart] === true && shouldTreatAsCustomCycleColor(firstPart)) {
    delete options[firstPart];
    options.draw = colorDefinitions.get(firstPart) || firstPart;
  }
  return options;
}

function shouldTreatAsCustomCycleColor(value) {
  const text = String(value || "").trim();
  if (!text || text.includes("=") || text.includes("/")) return false;
  if (/^(black|white|red|green|blue|cyan|magenta|yellow|gray|grey|orange|purple|brown|pink|violet|lime|teal|olive|lightgray|darkgray)$/i.test(text)) return false;
  if (/^(solid|dashed|dotted|densely dashed|loosely dashed|densely dotted|loosely dotted|mark|only marks|smooth|sharp plot|const plot)$/i.test(text)) return false;
  return /^[A-Za-z][A-Za-z0-9_-]*$/.test(text);
}

export function parsePgfplotsColormaps(rawColormapOption) {
  const rawValues = Array.isArray(rawColormapOption) ? rawColormapOption : [rawColormapOption];
  const colormaps = {};
  for (const rawValue of rawValues) {
    if (rawValue === undefined || rawValue === null || rawValue === true) continue;
    const parsed = parsePgfplotsColormap(String(rawValue));
    if (!parsed) continue;
    colormaps[parsed.name] = parsed.stops;
  }
  return colormaps;
}

function parsePgfplotsColormap(rawValue) {
  const text = rawValue.trim();
  const match = text.match(/^\{([^{}]+)\}\s*\{([\s\S]*)\}$/);
  if (!match) return null;
  const stops = [];
  const stopPattern = /color\s*\(\s*([-+]?\d*\.?\d+)(?:\s*cm)?\s*\)\s*=\s*\(([^)]+)\)/g;
  let stopMatch;
  while ((stopMatch = stopPattern.exec(match[2]))) {
    stops.push({
      position: Number(stopMatch[1]),
      color: stopMatch[2].trim()
    });
  }
  return stops.length ? { name: match[1].trim(), stops } : null;
}

function skipWhitespace(text, index) {
  let cursor = index;
  while (cursor < text.length && /\s/.test(text[cursor])) cursor += 1;
  return cursor;
}

function extractBalanced(text, start, open, close) {
  if (text[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\\" && index + 1 < text.length) {
      index += 1;
      continue;
    }
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

function splitCycleListEntries(raw) {
  const text = String(raw || "").trim();
  const slashSeparated = splitCycleListByDoubleBackslash(text);
  if (slashSeparated.length > 1) return slashSeparated;
  return splitTopLevel(text, ",").map((entry) => entry.trim()).filter(Boolean);
}

function stripTexLineComments(source) {
  let output = "";
  let inComment = false;
  const text = String(source || "");
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inComment) {
      if (char === "\n" || char === "\r") {
        inComment = false;
        output += char;
      }
      continue;
    }
    if (char === "%" && text[index - 1] !== "\\") {
      inComment = true;
      continue;
    }
    output += char;
  }
  return output;
}

function splitCycleListByDoubleBackslash(text) {
  const entries = [];
  let start = 0;
  let braceDepth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
    else if (char === "\\" && text[index + 1] === "\\" && braceDepth === 0) {
      const entry = text.slice(start, index).trim();
      if (entry) entries.push(entry);
      index += 1;
      start = index + 1;
    }
  }
  const tail = text.slice(start).trim();
  if (tail) entries.push(tail);
  return entries;
}

function stripBalancedOuterBraces(raw) {
  const text = String(raw || "").trim();
  if (!text.startsWith("{") || !text.endsWith("}")) return text;
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0 && index < text.length - 1) return text;
    }
  }
  return depth === 0 ? text.slice(1, -1).trim() : text;
}
