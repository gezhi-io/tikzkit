import { parseDimension } from "../engine/math.js";

// PGFPlots' default `line legend` paints three points from 0cm through
// 0.6cm. A plot reference exports that legend image into `\ref`, so retain
// the physical legend width rather than inventing a text-glyph substitute.
export const PGFPLOTS_REFERENCE_SAMPLE_LENGTH_CM = 0.6;
export const TIKZKIT_PLOT_REFERENCE_SAMPLE_COMMAND = "tikzkitplotsample";
export const TIKZKIT_MATRIX_PHANTOM_COMMAND = "tikzkitmatrixphantom";

export function createPlotReferenceSample(style) {
  return `\\${TIKZKIT_PLOT_REFERENCE_SAMPLE_COMMAND}{${String(style || "black").trim() || "black"}}`;
}

export function createMatrixPhantom(content) {
  return `\\${TIKZKIT_MATRIX_PHANTOM_COMMAND}{${String(content || "")}}`;
}

export function parseInlinePlotReferenceSample(value) {
  const source = String(value || "").trim();
  const command = readCommand(source, 0, TIKZKIT_PLOT_REFERENCE_SAMPLE_COMMAND);
  if (!command) return null;

  let cursor = skipWhitespace(source, command.end);
  if (source[cursor] === ";") cursor = skipWhitespace(source, cursor + 1);
  let reservedWidthCm = PGFPLOTS_REFERENCE_SAMPLE_LENGTH_CM;
  while (cursor < source.length) {
    const phantom = readCommand(source, cursor, TIKZKIT_MATRIX_PHANTOM_COMMAND) || readCommand(source, cursor, "phantom");
    if (!phantom) return null;
    const width = parseDimension(phantom.content, {});
    if (Number.isFinite(width) && width > 0) reservedWidthCm = Math.max(reservedWidthCm, width);
    cursor = skipWhitespace(source, phantom.end);
  }

  return {
    style: command.content.trim() || "black",
    lineLengthCm: PGFPLOTS_REFERENCE_SAMPLE_LENGTH_CM,
    reservedWidthCm
  };
}

function readCommand(source, start, name) {
  if (!source.startsWith(`\\${name}`, start)) return null;
  const boundary = source[start + name.length + 1];
  if (/[A-Za-z]/.test(boundary || "")) return null;
  const argumentStart = skipWhitespace(source, start + name.length + 1);
  const argument = readBalanced(source, argumentStart);
  if (!argument) return null;
  return { content: argument.content, end: argument.end };
}

function readBalanced(source, start) {
  if (source[start] !== "{") return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\" && index + 1 < source.length) {
      index += 1;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
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
