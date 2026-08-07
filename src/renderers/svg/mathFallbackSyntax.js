import { mathFallbackText, normalizeBrowserMathMacros } from "../../tikz/text.js";

export function readMathScriptAtom(raw, start) {
  const char = raw[start];
  if (!char || /\s/.test(char)) return null;
  if (char === "{") {
    const group = readBalancedGroup(raw, start);
    const next = group ? skipInlineWhitespace(raw, group.end) : null;
    // A TeX group can be the nucleus of a script, such as
    // `{\left(HPH^\top\right)}^{-1}`. Retain the group body so the SVG
    // fallback can recursively lay out its inner scripts.
    if (!group || (raw[next] !== "_" && raw[next] !== "^")) return null;
    return {
      source: raw.slice(start, group.end),
      end: group.end,
      groupContent: group.content
    };
  }
  if (char === "(") {
    const end = readBalancedParenthesis(raw, start);
    const next = end ? skipInlineWhitespace(raw, end) : null;
    if (end && (raw[next] === "_" || raw[next] === "^")) return { source: raw.slice(start, end), end, parenthesized: true };
  }
  const command = raw.slice(start).match(/^\\[A-Za-z]+/);
  if (command) {
    let end = start + command[0].length;
    if (mathAtomCommandTakesGroup(command[0])) {
      const argumentStart = skipInlineWhitespace(raw, end);
      if (raw[argumentStart] === "{") {
        const group = readBalancedGroup(raw, argumentStart);
        if (group) end = group.end;
      } else {
        const argument = readUnbracedMathCommandArgument(raw, argumentStart);
        if (argument) end = argument.end;
      }
    }
    return { source: raw.slice(start, end), end };
  }
  if (/[A-Za-z]/.test(char)) {
    let end = start + 1;
    if (raw[end] === "'") end += 1;
    return { source: raw.slice(start, end), end };
  }
  const number = raw.slice(start).match(/^(?:\d+(?:\.\d+)?|\.\d+)/);
  if (number) return { source: number[0], end: start + number[0].length };
  return null;
}

function readUnbracedMathCommandArgument(raw, start) {
  const char = raw[start];
  if (!char || char === "_" || char === "^" || char === "}" || /\s/.test(char)) return null;
  const command = raw.slice(start).match(/^\\[A-Za-z]+/);
  if (!command) return { end: start + 1 };

  let end = start + command[0].length;
  if (mathAtomCommandTakesGroup(command[0])) {
    const nestedStart = skipInlineWhitespace(raw, end);
    if (raw[nestedStart] === "{") {
      const group = readBalancedGroup(raw, nestedStart);
      if (group) end = group.end;
    }
  }
  return { end };
}

export function readBalancedParenthesis(raw, start) {
  let depth = 0;
  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return null;
}

export function mathAtomCommandTakesGroup(command) {
  return /^\\(?:bar|overline|hat|check|vec|overrightarrow|sqrt|mathbf|boldsymbol|mathcal|mathbb|mathsf|mathtt|text|textnormal|mathrm|textrm|texttt|textbf|emph)$/.test(
    command
  );
}

export function isAccentMathAtom(source) {
  return /^\\(?:bar|overline|hat|check|vec|overrightarrow|widetilde|tilde)\b/.test(String(source || "").trim());
}

export function readMathScriptValue(raw, start) {
  let cursor = skipInlineWhitespace(raw, start);
  if (raw[cursor] === "{") {
    const group = readBalancedGroup(raw, cursor);
    if (!group) return null;
    return { value: group.content, end: group.end };
  }
  const command = raw.slice(cursor).match(/^\\[A-Za-z]+/);
  if (command) {
    let end = cursor + command[0].length;
    if (mathAtomCommandTakesGroup(command[0]) && raw[end] === "{") {
      const group = readBalancedGroup(raw, end);
      if (group) end = group.end;
    }
    return { value: raw.slice(cursor, end), end };
  }
  if (!raw[cursor]) return null;
  return { value: raw[cursor], end: cursor + 1 };
}

export function readBalancedGroup(raw, start) {
  if (raw[start] !== "{") return null;
  let depth = 0;
  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return { content: raw.slice(start + 1, index), end: index + 1 };
    }
  }
  return null;
}

export function skipInlineWhitespace(raw, start) {
  let cursor = start;
  while (/\s/.test(raw[cursor] || "")) cursor += 1;
  return cursor;
}

export function mathScriptFallbackText(value) {
  return mathFallbackText(value).replace(/^_/, "").replace(/-/g, "−");
}

export function mathFallbackFontStyle(tex) {
  const raw = normalizeBrowserMathMacros(String(tex || ""));
  if (hasWholeMathBoldCommand(raw)) return "";
  // Commands such as \mathrm are local math alphabets. Looking for the
  // command anywhere used to make `$d=\unit[12]{m}$` fully upright, even
  // though only the unit is upright in TeX. Remove those scopes before
  // deciding the style inherited by the enclosing SVG text element.
  const fallback = mathFallbackText(withoutUprightMathScopes(raw));
  if (!/[A-Za-z]/.test(fallback)) return "";
  return "italic";
}

function withoutUprightMathScopes(value) {
  const source = String(value || "");
  let output = "";
  let cursor = 0;
  const commandPattern = /\\(?:text|mathrm|operatorname|mathsf|mathtt|textrm|textnormal)\b/g;
  let match;
  while ((match = commandPattern.exec(source))) {
    output += source.slice(cursor, match.index);
    const argumentStart = skipInlineWhitespace(source, match.index + match[0].length);
    const group = readBalancedGroup(source, argumentStart);
    if (!group) {
      output += match[0];
      cursor = match.index + match[0].length;
      continue;
    }
    cursor = group.end;
    commandPattern.lastIndex = cursor;
  }
  return output + source.slice(cursor);
}

export function mathFallbackFontWeight(tex) {
  return hasWholeMathBoldCommand(tex) ? "700" : "";
}

export function hasWholeMathBoldCommand(tex) {
  const raw = String(tex || "")
    .trim()
    .replace(/^\$\$([\s\S]*)\$\$$/, "$1")
    .replace(/^\$([\s\S]*)\$$/, "$1")
    .trim();
  return /^(?:\\(?:bf|bfseries)\b|\\(?:mathbf|boldsymbol|textbf)\s*(?:\{[\s\S]*\}|\\[A-Za-z]+|[A-Za-z])\s*$)/.test(raw);
}

export function normalizeKatexTex(tex) {
  return String(tex || "").replace(/\\mathcal\s*([A-Za-z])/g, String.raw`\mathcal{$1}`);
}
