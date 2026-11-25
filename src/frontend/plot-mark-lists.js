import { findTopLevel, splitTopLevel } from "../engine/options.js";

const macroValue = /\bmark indices\s*=\s*\\/;

function protectListOptions(raw, depth = 0) {
  if (depth >= 64 || !macroValue.test(raw)) return raw;
  let changed = false;
  const parts = splitTopLevel(raw).map(part => {
    const equal = findTopLevel(part, "=");
    if (equal < 0) return part;
    const key = part.slice(0, equal).trim().replace(/^\/tikz\//, "");
    const value = part.slice(equal + 1).trim();
    if (key === "mark indices" && value.startsWith("\\")) {
      changed = true;
      return part.slice(0, equal + 1) + "{" + value + "}";
    }
    if ((key === "mark options" || /\/\.(?:(?:append|prefix) )?style$/.test(key)) &&
        value.startsWith("{") && value.endsWith("}")) {
      const body = value.slice(1, -1);
      const nested = protectListOptions(body, depth + 1);
      if (nested !== body) {
        changed = true;
        return part.slice(0, equal + 1) + "{" + nested + "}";
      }
    }
    return part;
  });
  return changed ? parts.join(",") : raw;
}

// pgfkeys splits the option list before a list-valued macro is expanded.
// Preserve that boundary through TeX-lite without changing label/text bodies.
export function protectPlotMarkLists(source, readGroup) {
  if (!macroValue.test(source)) return source;
  const opener = /\\(?:tikzset|pgfplotsset)\s*\{|(?:\\(?:draw|fill|filldraw|path|clip|shade|shadedraw|pattern|tikz|addplot3?\+?|begin\s*\{(?:tikzpicture|scope|axis|loglogaxis|semilogxaxis|semilogyaxis)\}|tikzstyle\s*\{[^{}]+\}\s*=?)|\bplot)\s*\[/g;
  let output = "", start = 0, match;
  while ((match = opener.exec(source))) {
    const i = opener.lastIndex - 1;
    const group = readGroup(source, i, source[i], source[i] === "[" ? "]" : "}");
    if (!group) continue;
    const content = protectListOptions(group.content);
    if (content !== group.content) {
      output += source.slice(start, i + 1) + content;
      start = group.end - 1;
    }
    opener.lastIndex = group.end;
  }
  return start ? output + source.slice(start) : source;
}
