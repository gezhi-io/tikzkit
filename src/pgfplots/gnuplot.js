import { createRawGnuplotRuntime, parseRawGnuplotProgram } from "./rawGnuplotRuntime.js";

export function sampleRawGnuplotAddplot(rawSource, diagnostics = []) {
  const program = parseRawGnuplotProgram(rawSource);
  if (!program.ok) {
    diagnostics.push({ severity: "warning", message: program.reason });
    return [];
  }
  try {
    const runtime = createRawGnuplotRuntime(program);
    const xRange = evaluateRawGnuplotRange(program.plot.xRange || program.xRange, runtime) || { start: 0, end: 1 };
    const yRange = evaluateRawGnuplotRange(program.yRange, runtime);
    const samples = evaluateRawGnuplotSamples(program.samples, runtime);
    const points = [];
    for (let index = 0; index < samples; index += 1) {
      const t = samples === 1 ? 0 : index / (samples - 1);
      const x = xRange.start + (xRange.end - xRange.start) * t;
      const y = runtime.evaluate(program.plot.expression, { x });
      if (!Number.isFinite(y)) continue;
      if (yRange && (y < yRange.start || y > yRange.end)) continue;
      points.push({ x: roundPlotNumber(x), y: roundPlotNumber(y), raw: `(${roundPlotNumber(x)},${roundPlotNumber(y)})` });
    }
    return points;
  } catch (error) {
    diagnostics.push({ severity: "warning", message: `Unsupported raw gnuplot addplot: ${error.message}` });
    return [];
  }
}

export function lowerRawGnuplotAddplotsToCoordinates(source, diagnostics = []) {
  const expanded = expandRawGnuplotForeach(source);
  let output = "";
  let index = 0;
  while (index < expanded.length) {
    const start = expanded.indexOf("\\addplot", index);
    if (start === -1) {
      output += expanded.slice(index);
      break;
    }
    output += expanded.slice(index, start);
    const lowered = parseRawGnuplotAddplotStatement(expanded, start, diagnostics);
    if (!lowered) {
      output += expanded.slice(start, start + "\\addplot".length);
      index = start + "\\addplot".length;
      continue;
    }
    output += lowered.replacement;
    index = lowered.end;
  }
  return output;
}

function parseRawGnuplotAddplotStatement(source, start, diagnostics) {
  let cursor = start + "\\addplot".length;
  let suffix = "";
  if (source[cursor] === "3") {
    suffix = "3";
    cursor += 1;
  }
  cursor = skipWhitespace(source, cursor);
  if (source[cursor] === "+") {
    suffix += "+";
    cursor += 1;
  }
  const optionsStart = cursor;
  const options = parseOptionalOptions(source, cursor);
  cursor = skipWhitespace(source, options.end);
  if (!source.startsWith("gnuplot", cursor) || !isBoundary(source, cursor + "gnuplot".length)) return null;
  cursor += "gnuplot".length;
  const gnuplotOptions = parseOptionalOptions(source, cursor);
  cursor = skipWhitespace(source, gnuplotOptions.end);
  const raw = extractBalanced(source, cursor, "{", "}");
  if (!raw) return null;
  const points = sampleRawGnuplotAddplot(raw.content, diagnostics);
  if (!points.length) return null;
  const rawOptions = source.slice(optionsStart, options.end);
  const coordinates = points.map((point) => `(${formatPointNumber(point.x)},${formatPointNumber(point.y)})`).join(" ");
  return {
    replacement: `\\addplot${suffix}${rawOptions} coordinates {${coordinates}}`,
    end: raw.end
  };
}

function expandRawGnuplotForeach(source) {
  const text = String(source || "");
  let output = "";
  let index = 0;
  while (index < text.length) {
    if (!text.startsWith("\\foreach", index) || !isBoundary(text, index + "\\foreach".length)) {
      output += text[index] || "";
      index += 1;
      continue;
    }
    const parsed = parseSimpleForeach(text, index);
    if (!parsed || !/gnuplot\s*\[?/.test(parsed.body)) {
      output += text[index] || "";
      index += 1;
      continue;
    }
    output += parsed.values.map((value) => replaceForeachVariable(parsed.body, parsed.variable, value)).join("\n");
    index = parsed.end;
  }
  return output;
}

function parseSimpleForeach(source, start) {
  let cursor = skipWhitespace(source, start + "\\foreach".length);
  if (source[cursor] !== "\\") return null;
  const variable = readCommandName(source, cursor + 1);
  if (!variable?.value) return null;
  cursor = skipWhitespace(source, variable.end);
  if (!source.startsWith("in", cursor) || !isBoundary(source, cursor + "in".length)) return null;
  cursor = skipWhitespace(source, cursor + "in".length);
  const values = extractBalanced(source, cursor, "{", "}");
  if (!values) return null;
  cursor = skipWhitespace(source, values.end);
  const body = extractBalanced(source, cursor, "{", "}");
  if (!body) return null;
  return {
    variable: variable.value,
    values: expandForeachValues(values.content),
    body: body.content,
    end: body.end
  };
}

function expandForeachValues(raw) {
  const parts = splitTopLevel(String(raw || ""), ",").map((part) => part.trim()).filter(Boolean);
  const values = [];
  for (let index = 0; index < parts.length; index += 1) {
    if (parts[index] === "..." && values.length && index + 1 < parts.length) {
      values.push(...numericRangeValues(Number(values.at(-1)), Number(parts[index + 1]), { skipFirst: true }));
      index += 1;
      continue;
    }
    values.push(parts[index]);
  }
  return values;
}

function numericRangeValues(start, end, options = {}) {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
  const step = start <= end ? 1 : -1;
  const values = [];
  for (let value = start + (options.skipFirst ? step : 0); step > 0 ? value <= end : value >= end; value += step) {
    values.push(String(value));
  }
  return values;
}

function replaceForeachVariable(body, variable, value) {
  return String(body || "").replace(new RegExp(`\\\\${escapeRegExp(variable)}(?![A-Za-z@])`, "g"), String(value));
}

function readCommandName(source, start) {
  const match = source.slice(start).match(/^[A-Za-z@]+/);
  if (!match) return null;
  return { value: match[0], end: start + match[0].length };
}

function parseOptionalOptions(source, start) {
  let cursor = skipWhitespace(source, start);
  if (source[cursor] !== "[") return { raw: "", end: cursor };
  const balanced = extractBalanced(source, cursor, "[", "]");
  return balanced ? { raw: source.slice(cursor, balanced.end), content: balanced.content, end: balanced.end } : { raw: "", end: cursor };
}

function extractBalanced(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\" && index + 1 < source.length) {
      index += 1;
      continue;
    }
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return { content: source.slice(start + 1, index), end: index + 1 };
      }
    }
  }
  return null;
}

function skipWhitespace(source, index) {
  let cursor = index;
  while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
  return cursor;
}

function splitTopLevel(source, separator) {
  const parts = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\" && index + 1 < source.length) {
      index += 1;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") depth = Math.max(0, depth - 1);
    else if (char === separator && depth === 0) {
      parts.push(source.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(source.slice(start));
  return parts;
}

function isBoundary(source, index) {
  return !/[A-Za-z@]/.test(source[index] || "");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatPointNumber(value) {
  return String(roundPlotNumber(value));
}

function evaluateRawGnuplotRange(range, runtime) {
  if (!range) return null;
  const start = Number(runtime.evaluate(range.start));
  const end = Number(runtime.evaluate(range.end));
  return Number.isFinite(start) && Number.isFinite(end) ? { start, end } : null;
}

function evaluateRawGnuplotSamples(expression, runtime) {
  const value = expression ? Number(runtime.evaluate(expression)) : 25;
  return Math.max(2, Math.min(2000, Math.round(Number.isFinite(value) ? value : 25)));
}

function roundPlotNumber(value) {
  return Number(Number(value).toFixed(6));
}
