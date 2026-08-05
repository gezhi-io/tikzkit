import { parseOptions, splitTopLevel } from "../engine/options.js";
import { axisNumber, parseCoordinateList } from "./coordinates.js";
import { parsePgfplotsDateCoordinate } from "./dateCoordinates.js";
import { sampleRawGnuplotAddplot } from "./gnuplot.js";
import { expandPgfplotsNamedOptions } from "./namedOptions.js";

export function parseAddplots(body, options = {}, diagnostics = []) {
  body = expandPgfplotsAddplotForeach(body);
  const plots = [];
  let index = 0;
  while (index < body.length) {
    const start = body.indexOf("\\addplot", index);
    if (start === -1) break;
    let cursor = start + "\\addplot".length;
    let is3d = false;
    if (body[cursor] === "3") {
      is3d = true;
      cursor += 1;
    }
    cursor = skipWhitespace(body, cursor);
    if (body[cursor] === "+") cursor += 1;
    const appendCycle = body[cursor - 1] === "+";
    cursor = skipWhitespace(body, cursor);
    if (body.startsWith("expression", cursor)) {
      cursor += "expression".length;
      cursor = skipWhitespace(body, cursor);
    }
    const parsedOptions = parseOptionalOptions(body, cursor);
    const plotOptions = expandPgfplotsNamedOptions(parseOptions(parsedOptions.raw), options.pgfplotsStyleDefinitions || {});
    // PGFPlots uses an empty mark declaration as an explicit request for no
    // marks. Keeping it as an empty string lets downstream truthy fallbacks
    // select a circle for legend images.
    if (Object.hasOwn(plotOptions, "mark") && String(plotOptions.mark ?? "").trim() === "") {
      plotOptions.mark = "none";
    }
    if (appendCycle) plotOptions["pgfplots plus"] = true;
    if (String(parsedOptions.raw || "").trim()) plotOptions["pgfplots explicit options"] = true;
    cursor = parsedOptions.end;
    cursor = skipWhitespace(body, cursor);
    const statementEnd = findStatementEnd(body, cursor);
    const statement = body.slice(start, statementEnd === -1 ? body.length : statementEnd);
    const closedCycle = /\\closedcycle\b/.test(statement);
    if (body.startsWith("coordinates", cursor)) {
      cursor += "coordinates".length;
      cursor = skipWhitespace(body, cursor);
      const coords = extractBalanced(body, cursor, "{", "}");
      if (coords) {
        const points = parseCoordinateList(coords.content);
        plots.push({
          type: "coordinates",
          is3d,
          options: plotOptions,
          points,
          coordinateRows: points.rows || [points],
          nodes: parseAddplotInlineNodes(body.slice(coords.end, statementEnd === -1 ? body.length : statementEnd), options),
          closedCycle
        });
        cursor = coords.end;
      }
    } else if (body.startsWith("table", cursor)) {
      cursor += "table".length;
      cursor = skipWhitespace(body, cursor);
      const tableOptions = parseOptionalOptions(body, cursor);
      const parsedTableOptions = parseOptions(tableOptions.raw);
      cursor = tableOptions.end;
      cursor = skipWhitespace(body, cursor);
      const table = extractBalanced(body, cursor, "{", "}");
      if (table) {
        const tableText = resolvePgfplotsTableContent(table.content, options, diagnostics);
        plots.push({
          type: "coordinates",
          source: "table",
          is3d,
          options: plotOptions,
          tableOptions: parsedTableOptions,
          points: parsePgfplotsTablePoints(tableText, parsedTableOptions, diagnostics, plotOptions, options),
          nodes: parseAddplotInlineNodes(body.slice(table.end, statementEnd === -1 ? body.length : statementEnd), options),
          closedCycle
        });
        cursor = table.end;
      }
    } else if (body.startsWith("gnuplot", cursor)) {
      cursor += "gnuplot".length;
      const gnuplotOptions = parseOptionalOptions(body, cursor);
      cursor = gnuplotOptions.end;
      cursor = skipWhitespace(body, cursor);
      const gnuplot = extractBalanced(body, cursor, "{", "}");
      if (gnuplot) {
        plots.push({
          type: "coordinates",
          source: "gnuplot",
          is3d,
          options: plotOptions,
          gnuplotOptions: parseOptions(gnuplotOptions.raw),
          points: sampleRawGnuplotAddplot(gnuplot.content, diagnostics),
          nodes: parseAddplotInlineNodes(body.slice(gnuplot.end, statementEnd === -1 ? body.length : statementEnd), options),
          closedCycle
        });
        cursor = gnuplot.end;
      }
    } else if (body[cursor] === "(") {
      const parametric = parseParametricAddplot(body, cursor, statement, statementEnd, options);
      if (parametric) {
        plots.push({
          type: "parametric",
          is3d,
          options: plotOptions,
          xExpression: parametric.xExpression,
          yExpression: parametric.yExpression,
          zExpression: parametric.zExpression,
          fillAnchor: parametric.fillAnchor,
          nodes: parametric.nodes,
          closedCycle
        });
        cursor = parametric.end;
      }
    } else if (body[cursor] === "{") {
      const expression = extractBalanced(body, cursor, "{", "}");
      if (expression) {
        plots.push({
          type: "function",
          is3d,
          options: plotOptions,
          expression: expression.content.trim(),
          nodes: parseAddplotInlineNodes(body.slice(expression.end, statementEnd === -1 ? body.length : statementEnd), options),
          closedCycle
        });
        cursor = expression.end;
      }
    }
    const semicolon = findStatementEnd(body, cursor);
    index = semicolon === -1 ? cursor : semicolon + 1;
  }
  return plots;
}

function expandPgfplotsAddplotForeach(source) {
  const text = String(source || "");
  let output = "";
  let index = 0;
  const command = "\\foreach";
  while (index < text.length) {
    if (!text.startsWith(command, index) || !isCommandBoundary(text, index + command.length)) {
      output += text[index] || "";
      index += 1;
      continue;
    }
    const parsed = parseSimpleForeach(text, index);
    if (!parsed) {
      output += text[index] || "";
      index += 1;
      continue;
    }
    output += parsed.values
      .map((value) => replaceForeachVariable(parsed.body, parsed.variable, value))
      .join("\n");
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
  if (!source.startsWith("in", cursor) || !isCommandBoundary(source, cursor + "in".length)) return null;
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

function isCommandBoundary(source, index) {
  return !/[A-Za-z@]/.test(source[index] || "");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parsePgfplotsTablePoints(content, tableOptions = {}, diagnostics = [], plotOptions = {}, parserOptions = {}) {
  const rows = normalizePgfplotsTableRows(content, tableOptions);
  if (rows.length < 2) return [];
  const headers = rows[0].map((cell) => cell.trim());
  const xColumn = String(tableOptions.x || "x").trim();
  const yColumn = String(tableOptions.y || "y").trim();
  const zColumn = String(tableOptions.z || "z").trim();
  const xIndex = pgfplotsHeaderIndex(headers, xColumn, 0);
  const yIndex = pgfplotsHeaderIndex(headers, yColumn, Math.min(1, Math.max(0, headers.length - 1)));
  const zIndex = pgfplotsHeaderIndex(headers, zColumn, headers.length > 2 ? 2 : -1);
  const metaColumn = pgfplotsPointMetaColumn(plotOptions, tableOptions);
  const metaIndex = metaColumn ? pgfplotsHeaderIndex(headers, metaColumn, -1) : -1;
  const points = [];
  for (const row of rows.slice(1)) {
    if (!row.length || row.every((cell) => !String(cell).trim())) continue;
    const rawX = String(row[xIndex] ?? "").trim();
    const rawY = String(row[yIndex] ?? "").trim();
    const dateX = parsePgfplotsDateCoordinate(rawX, "x", parserOptions.pgfplotsDateContext);
    const dateY = parsePgfplotsDateCoordinate(rawY, "y", parserOptions.pgfplotsDateContext);
    const x = dateX === null ? axisNumber(rawX) : dateX;
    const y = dateY === null ? axisNumber(rawY) : dateY;
    if (Number.isFinite(x) && Number.isFinite(y)) {
      const columns = {};
      headers.forEach((header, index) => {
        if (header) columns[header] = row[index];
      });
      const point = { x, y, raw: `(${row[xIndex]},${row[yIndex]})`, columns };
      if (dateX !== null || dateY !== null) {
        point.dateCoordinates = {};
        if (dateX !== null) point.dateCoordinates.x = rawX;
        if (dateY !== null) point.dateCoordinates.y = rawY;
      }
      if (zIndex >= 0) {
        const z = axisNumber(row[zIndex], NaN);
        if (Number.isFinite(z)) {
          point.z = z;
          point.raw = `(${row[xIndex]},${row[yIndex]},${row[zIndex]})`;
        }
      }
      if (metaIndex >= 0) {
        const rawMeta = String(row[metaIndex] ?? "").trim();
        const numericMeta = axisNumber(rawMeta, NaN);
        point.meta = Number.isFinite(numericMeta) && !pgfplotsUsesSymbolicPointMeta(plotOptions)
          ? numericMeta
          : rawMeta;
      }
      points.push(point);
    } else {
      diagnostics.push({ severity: "warning", message: "Skipped non-numeric pgfplots table row" });
    }
  }
  return points;
}

function parseParametricAddplot(body, cursor, _statement, statementEnd, options = {}) {
  const tuple = extractBalanced(body, cursor, "(", ")");
  if (!tuple) return null;
  const parts = splitTopLevel(tuple.content, ",");
  if (parts.length < 2) return null;
  const tail = body.slice(tuple.end, statementEnd === -1 ? body.length : statementEnd);
  return {
    xExpression: stripOuterBracesText(parts[0].trim()),
    yExpression: stripOuterBracesText(parts[1].trim()),
    zExpression: parts.length >= 3 ? stripOuterBracesText(parts.slice(2).join(",").trim()) : undefined,
    fillAnchor: parseAddplotAxisCsTailAnchor(tail),
    nodes: parseAddplotInlineNodes(tail, options),
    end: tuple.end
  };
}

function parseAddplotAxisCsTailAnchor(tail) {
  const match = String(tail || "").match(/--\s*\(\s*(?:axis\s+cs\s*:\s*)?([^,(){}]+)\s*,\s*([^(){}]+?)\s*\)/i);
  if (!match) return null;
  const x = axisNumber(match[1], NaN);
  const y = axisNumber(match[2], NaN);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function parseAddplotInlineNodes(tail, options = {}) {
  const nodes = [];
  const source = String(tail || "");
  let index = 0;
  while (index < source.length) {
    const start = source.indexOf("node", index);
    if (start === -1) break;
    const before = source[start - 1] || "";
    const after = source[start + "node".length] || "";
    if (/[A-Za-z@\\]/.test(before) || /[A-Za-z@]/.test(after)) {
      index = start + "node".length;
      continue;
    }
    let cursor = skipWhitespace(source, start + "node".length);
    const parsedOptions = parseOptionalOptions(source, cursor);
    cursor = parsedOptions.end;
    cursor = skipWhitespace(source, cursor);
    const content = extractBalanced(source, cursor, "{", "}");
    if (!content) {
      index = start + "node".length;
      continue;
    }
    nodes.push({
      options: expandPgfplotsNamedOptions(parseOptions(parsedOptions.raw), options.pgfplotsStyleDefinitions || {}),
      text: content.content.trim()
    });
    index = content.end;
  }
  return nodes;
}

function resolvePgfplotsTableContent(content, options = {}, diagnostics = []) {
  const text = String(content || "").trim();
  const looksLikeFile = text && !/[\r\n]/.test(text) && !/\s/.test(text) && /\.[A-Za-z0-9]+$/.test(text);
  if (!looksLikeFile) return content;
  if (typeof options.pgfplotsTableResolver === "function") {
    const resolved = options.pgfplotsTableResolver(text);
    if (resolved !== undefined && resolved !== null) return String(resolved);
  }
  diagnostics.push({ severity: "warning", message: `Could not resolve pgfplots table file '${text}'` });
  return "";
}

function pgfplotsHeaderIndex(headers, column, fallback) {
  const normalizedColumn = String(column || "").trim();
  if (!normalizedColumn) return fallback;
  const exact = headers.indexOf(normalizedColumn);
  if (exact !== -1) return exact;
  const lower = normalizedColumn.toLowerCase();
  const insensitive = headers.findIndex((header) => header.toLowerCase() === lower);
  return insensitive !== -1 ? insensitive : fallback;
}

function pgfplotsPointMetaColumn(plotOptions = {}, tableOptions = {}) {
  const raw = tableOptions.meta ?? tableOptions["point meta"] ?? plotOptions["point meta"];
  if (raw === undefined || raw === null || raw === true) return "";
  const text = String(raw).trim();
  const thisRow = text.match(/\\thisrow\s*\{([^{}]+)\}/);
  if (thisRow) return thisRow[1].trim();
  const directColumn = text.match(/^\s*([A-Za-z_][A-Za-z0-9_. -]*)\s*$/);
  return directColumn ? directColumn[1].trim() : "";
}

function pgfplotsUsesSymbolicPointMeta(plotOptions = {}) {
  return /\bsymbolic\b/i.test(String(plotOptions["point meta"] || ""));
}

function normalizePgfplotsTableRows(content, tableOptions = {}) {
  let text = String(content || "").trim();
  if (String(tableOptions["row sep"] || "").trim() === "\\\\") {
    text = text.replace(/\\\\/g, "\n");
  }
  const separator = pgfplotsTableColumnSeparator(tableOptions["col sep"]);
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => separator ? splitDelimitedTableRow(line, separator) : line.split(/\s+/));
}

function pgfplotsTableColumnSeparator(raw) {
  const value = String(raw || "space").trim().toLowerCase();
  if (!value || value === "space" || value === "whitespace") return "";
  if (value === "comma") return ",";
  if (value === "semicolon") return ";";
  if (value === "tab") return "\t";
  return value.length === 1 ? value : "";
}

function splitDelimitedTableRow(line, separator) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === separator && !quoted) {
      cells.push(cell.trim());
      cell = "";
      continue;
    }
    cell += char;
  }
  cells.push(cell.trim());
  return cells;
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

function parseOptionalOptions(text, start) {
  let cursor = skipWhitespace(text, start);
  if (text[cursor] !== "[") return { raw: "", end: cursor };
  const balanced = extractBalanced(text, cursor, "[", "]");
  if (!balanced) return { raw: "", end: cursor };
  return { raw: balanced.content, end: balanced.end };
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

function stripOuterBracesText(value) {
  const text = String(value ?? "").trim();
  if (!text.startsWith("{") || !text.endsWith("}")) return text;
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0 && index < text.length - 1) return text;
    }
    if (depth < 0) return text;
  }
  return depth === 0 ? text.slice(1, -1).trim() : text;
}
