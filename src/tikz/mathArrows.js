const EXTENSIBLE_ARROW_COMMANDS = Object.freeze({
  xleftarrow: "left",
  xrightarrow: "right"
});

export function parseExtensibleMathArrow(tex) {
  const source = String(tex || "");
  let depth = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\") {
      const command = source.slice(index + 1).match(/^[A-Za-z]+/)?.[0] || "";
      const direction = EXTENSIBLE_ARROW_COMMANDS[command];
      if (depth === 0 && direction) {
        const parsed = readExtensibleArrowArguments(source, index + command.length + 1);
        if (!parsed) return null;
        return {
          command,
          direction,
          prefix: source.slice(0, index),
          suffix: source.slice(parsed.end),
          above: parsed.above,
          below: parsed.below
        };
      }
      index += command.length;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") depth = Math.max(0, depth - 1);
  }

  return null;
}

export function replaceExtensibleMathArrowsWithGlyphs(tex) {
  let source = String(tex || "");
  let output = "";

  while (source) {
    const parsed = parseExtensibleMathArrow(source);
    if (!parsed) return output + source;
    output += `${parsed.prefix}${parsed.direction === "left" ? "←" : "→"}`;
    source = parsed.suffix;
  }

  return output;
}

function readExtensibleArrowArguments(source, start) {
  let cursor = skipWhitespace(source, start);
  let below = "";

  if (source[cursor] === "[") {
    const optional = readBalanced(source, cursor, "[", "]");
    if (!optional) return null;
    below = optional.content;
    cursor = skipWhitespace(source, optional.end);
  }

  const above = readMathArgument(source, cursor);
  if (!above) return null;
  return { above: above.content, below, end: above.end };
}

function readMathArgument(source, start) {
  if (source[start] === "{") return readBalanced(source, start, "{", "}");
  if (!source[start]) return null;
  if (source[start] !== "\\") return { content: source[start], end: start + 1 };

  const command = source.slice(start + 1).match(/^[A-Za-z]+/)?.[0];
  if (!command) return { content: source.slice(start, start + 2), end: start + 2 };
  return { content: `\\${command}`, end: start + command.length + 1 };
}

function readBalanced(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "\\") {
      index += 1;
      continue;
    }
    if (source[index] === open) depth += 1;
    else if (source[index] === close) {
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
