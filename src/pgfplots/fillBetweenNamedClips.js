import { parseOptions, splitTopLevel, stripTexComments } from "../engine/options.js";
import { extractBalanced } from "../shared/balanced.js";
import { parseOptionalOptions } from "./addplotParser.js";
import { fillBetweenPathPaint, readFillBetweenPathOptions } from "./fillBetweenBoundaries.js";
import { explicitFillBetweenClipBox } from "./fillBetweenClipSelectors.js";

const nameKey = /^(?:\/tikz\/)?name path(?: (?:global|local))?$/;

function pathNames(spec, semantic) {
  const names = new Set();
  function add(key, value) {
    if (!nameKey.test(key) || typeof value !== "string" || /[\\#{}]/.test(value)) return;
    const name = value.trim();
    if (name) names.add(name);
  }
  for (const [key, value] of Object.entries(semantic)) add(key, value);
  // Name writes are actions: two occurrences of the same key can bind two names.
  for (const part of splitTopLevel(spec.rawOptions)) {
    if (/^(?:\/tikz\/)?name path(?: (?:global|local))?\s*=/.test(part)) {
      for (const [key, value] of Object.entries(parseOptions(part))) add(key, value);
    }
  }
  return names;
}

function withInlineOptions(spec) {
  if (!spec.path.includes("[")) return spec;
  const keys = [spec.rawOptions], pieces = [];
  let last = 0;
  for (let i = 0; i < spec.path.length;) {
    const c = spec.path[i];
    if (c === "\\") { i += 2; continue; }
    if (c === "(" || c === "{") {
      const group = extractBalanced(spec.path, i, c, c === "(" ? ")" : "}");
      if (!group) return spec;
      i = group.end;
    } else if (c === "[") {
      const group = parseOptionalOptions(spec.path, i);
      if (group.end === i) return spec;
      pieces.push(spec.path.slice(last, i));
      keys.push(group.raw);
      i = last = group.end;
    } else i++;
  }
  if (!pieces.length) return spec;
  const rawOptions = keys.join(",");
  return { rawOptions, options: parseOptions(rawOptions), path: [...pieces, spec.path.slice(last)].join(" ") };
}

// Return the bindings visible at the END of this source prefix. A fill must not
// see a name defined later, or a stale rectangle replaced by some other path.
export function namedFillBetweenClipBoxes(body, ranges, geometry, axisOptions = {}, options = {}) {
  const boxes = new Map();
  if (!geometry || geometry.is3d || axisOptions["pgfplots 3d surface"]) return boxes;

  // PGFPlots patches name path (including the local alias) to name path global.
  // Only inherited geometry, not the binding itself, is scoped inside an axis.
  const safeScopes = [true];
  function enter(spec, known) {
    safeScopes.push(safeScopes.at(-1) && known && fillBetweenPathPaint("path", spec.options, options).onlyPaint);
  }
  function visit(source) {
    for (let statement of splitTopLevel(source, ";")) {
      // Scope boundaries have no semicolon; they can share a fragment with a path.
      while (statement) {
        const group = extractBalanced(statement, 0, "{", "}");
        if (group) {
          const depth = safeScopes.length;
          const inner = readFillBetweenPathOptions(group.content, 0);
          enter(inner, true);
          visit(inner.path);
          safeScopes.length = depth;
          statement = statement.slice(group.end).trimStart();
          continue;
        }
        const open = /^\\(?:begin\s*\{([^{}]+)\}|(scope)\b)/.exec(statement);
        if (open) {
          const inner = readFillBetweenPathOptions(statement, open[0].length);
          enter(inner, (open[1] || open[2]) === "scope");
          statement = inner.path;
          continue;
        }
        const end = /^\\(?:end\s*\{[^{}]+\}|endscope\b)/.exec(statement);
        if (end) {
          if (safeScopes.length > 1) safeScopes.pop();
          statement = statement.slice(end[0].length).trimStart();
          continue;
        }
        const match = /^\\(addplot3?|[A-Za-z@]+)(?![A-Za-z@])(?:\s*\+)?/.exec(statement);
        if (!match) break;
        const command = match[1], plainPath = command === "path" || command === "draw";
        const leading = readFillBetweenPathOptions(statement, match[0].length);
        const spec = plainPath ? withInlineOptions(leading) : leading;
        const { onlyPaint, semantic } = fillBetweenPathPaint(command, spec.options, options);
        const names = pathNames(spec, semantic);
        if (names.size) {
          const box = safeScopes.at(-1) && onlyPaint && plainPath
            ? explicitFillBetweenClipBox(spec.path, ranges, geometry, axisOptions) : null;
          for (const name of names) {
            if (box) boxes.set(name, box);
            else boxes.delete(name);
          }
        }
        break;
      }
    }
  }
  visit(stripTexComments(body || ""));
  return boxes;
}
