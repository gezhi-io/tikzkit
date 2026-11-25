import { splitTopLevel, stripOuterBraces, stripTexComments, tikzBoolean } from "../engine/options.js";
import { axisNumber, parsePgfplotsPointMeta } from "./coordinates.js";
import { pgfplotsEmptyLineBreaks } from "./compat.js";

export function parsePlotFilePoints(text, globalOptions, plotOptions, fileOptions) {
  const { skipFirst, pointMeta, breakOnEmpty, commentChars } = plotFileSettings(globalOptions, plotOptions, fileOptions);
  const explicitMeta = pointMeta === "explicit" || pointMeta === "explicit symbolic";
  const metaOptions = { "point meta": pointMeta };
  const points = [];
  let skipNextRow = skipFirst;
  let pendingBreak = false;
  for (const line of text.split(/\r\n?|\n/)) {
    const read = stripTexComments(line);
    const start = read.trimStart();
    if (!start || start[0] === "$") {
      pendingBreak = breakOnEmpty && points.length > 0;
      continue;
    }
    if (start[0] === "#" || commentChars.includes(start[0])) continue;
    if (skipNextRow) {
      skipNextRow = false;
      continue;
    }
    // PGF appends literal zero fields to each TeX input line. A trailing %
    // suppresses the end-of-line space, so even "13%comment" reads as 130.
    const padded = start + (read === line ? " " : "") + "0 0 0";
    const [x, y, meta] = plotFileFields(padded, explicitMeta ? 3 : 2);
    const point = { x: axisNumber(x, NaN), y: axisNumber(y, NaN), raw: `(${x},${y})` };
    if (explicitMeta) point.meta = parsePgfplotsPointMeta(meta, metaOptions);
    if (pendingBreak) point.breakBefore = true;
    points.push(point);
    pendingBreak = false;
  }
  return points;
}

// Native fields are space-delimited macro arguments: only braces protect
// internal spaces, and fields after the requested arguments are ignored.
function plotFileFields(line, count) {
  const text = line.replace(/[ \t]+/g, " ");
  const fields = [];
  let start = 0, depth = 0;
  for (let i = 0; i <= text.length && fields.length < count; i++) {
    if (text[i] === "\\") i++;
    else if (text[i] === "{") depth++;
    else if (text[i] === "}") depth--;
    else if (i === text.length || (text[i] === " " && depth === 0)) {
      fields.push(stripOuterBraces(text.slice(start, i)));
      start = i + 1;
    }
  }
  return fields;
}

function plotFileSettings(globalOptions, plotOptions, fileOptions) {
  let skipFirst = false, pointMeta = "", emptyLine = "auto", compat = "default", commentChars = [];
  for (const options of [globalOptions, plotOptions, fileOptions]) {
    for (const [rawKey, value] of Object.entries(options || {})) {
      const key = rawKey.replace(/^\/pgfplots\//, "");
      if (key === "plot file/skip first" || key === "plot file/ignore first" ||
          (options === fileOptions && (key === "skip first" || key === "ignore first"))) skipFirst = tikzBoolean(value);
      else if (key === "point meta" || key === "scatter src") pointMeta = value;
      else if (key.startsWith("point meta/") && key !== "point meta/expand") pointMeta = key.slice("point meta/".length);
      else if (key === "empty line") emptyLine = value;
      else if (key === "compat" || key === "compat/empty line") compat = value;
      else if (key === "table/comment chars") commentChars = splitTopLevel(String(value));
    }
  }
  const breakOnEmpty = pgfplotsEmptyLineBreaks(emptyLine, compat);
  return { skipFirst, pointMeta, breakOnEmpty, commentChars };
}
