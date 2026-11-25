import { evaluateMath } from "../engine/math.js";
import { splitTopLevel, stripOuterBraces, stripTexComments } from "../engine/options.js";
import { isLogAxis } from "./ranges.js";

export function parseCoordinateList(input, plotOptions = {}, diagnostics = []) {
  const rows = parseCoordinateRows(input, plotOptions, diagnostics);
  const points = rows.flat();
  Object.defineProperty(points, "rows", {
    value: rows,
    enumerable: false,
    configurable: true
  });
  return points;
}

export function parseCoordinateRows(input, plotOptions = {}, diagnostics = []) {
  const rows = [];
  // PGF's coordinate stream ends at a bad suffix, even if more scanlines follow.
  for (const text of String(input ?? "").trim().split(/\n\s*\n+/)) {
    const row = [];
    const ok = parseCoordinateRow(stripTexComments(text), row, plotOptions, diagnostics);
    if (row.length) rows.push(row);
    if (!ok) break;
  }
  return rows;
}

function parseCoordinateRow(text, row, plotOptions, diagnostics) {
  const suffix = /(?:\+\s*([-=])|-=)\s*\(/y;
  const mathParser = String(plotOptions["plot coordinates/math parser"] ?? plotOptions["/pgfplots/plot coordinates/math parser"]) !== "false";
  const invalid = index => {
    diagnostics.push({ severity: "warning", message: `Could not read pgfplots coordinate suffix near '${text.slice(index, index + 24)}'` });
    return false;
  };
  let i = 0;
  while (i < text.length) {
    if (text[i] === "+" || text[i] === "-" || text[i] === "[") return invalid(i);
    if (text[i] !== "(") { i++; continue; }
    const tuple = readPointArgument(text, i);
    if (!tuple) return invalid(i);
    i = tuple.end;
    const fields = tuple.fields.filter(Boolean);
    if (fields.length < 2) continue;
    const point = coordinatePoint(fields);
    let errors;
    for (;;) {
      while (i < text.length && /\s/.test(text[i])) i++;
      if (text[i] !== "+" && text[i] !== "-") break;
      suffix.lastIndex = i;
      const op = suffix.exec(text);
      if (!op) return invalid(i);
      const vector = readPointArgument(text, suffix.lastIndex - 1);
      if (!vector || vector.fields.length !== (fields.length >= 3 ? 3 : 2)) return invalid(i);
      errors ??= {};
      if (op[1]) errors.plus = vector.fields;          // += and +-
      if (op[1] !== "=") errors.minus = vector.fields; // -= and +-
      i = vector.end;
    }
    if (errors) {
      for (const [side, [x, y]] of Object.entries(errors)) {
        setExplicitPointError(point, "x", side, x, mathParser);
        setExplicitPointError(point, "y", side, y, mathParser);
      }
    }
    if (text[i] === "[") {
      const meta = readPointArgument(text, i);
      if (!meta) return invalid(i);
      const raw = stripOuterBraces(meta.fields[0]);
      if (raw !== "") point.meta = parsePgfplotsPointMeta(raw, plotOptions);
      i = meta.end;
    }
    row.push(point);
  }
  return true;
}

// TeX braces protect delimiters, including a literal ']' in point meta.
// Keep empty tuple fields: (,2) assigns a y error without inventing an x error.
function readPointArgument(text, start) {
  const tuple = text[start] === "(", end = tuple ? ")" : "]";
  const fields = [], nested = [];
  let from = start + 1;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (c === "\\") { i++; continue; }
    if (c === nested.at(-1)) { nested.pop(); continue; }
    if (c === "{") { nested.push("}"); continue; }
    if (nested.at(-1) === "}") continue;
    if (tuple && (c === "(" || c === "[")) { nested.push(c === "(" ? ")" : "]"); continue; }
    if (!nested.length && (c === end || (tuple && c === ","))) {
      fields.push(text.slice(from, i).trim());
      if (c === end) return { fields, end: i + 1 };
      from = i + 1;
    }
  }
  return null;
}

function coordinatePoint([rawX, rawY, rawZ]) {
  const point = { x: axisNumber(rawX, NaN), y: axisNumber(rawY, NaN), raw: `(${rawX},${rawY})` };
  Object.defineProperties(point, {
    rawX: { value: rawX, configurable: true }, rawY: { value: rawY, configurable: true }
  });
  if (rawZ !== undefined) {
    point.z = axisNumber(rawZ);
    point.raw = `(${rawX},${rawY},${rawZ})`;
    Object.defineProperty(point, "rawZ", { value: rawZ, configurable: true });
  }
  return point;
}

export function setExplicitPointError(point, axis, side, raw, mathParser = false) {
  const text = stripOuterBraces(raw ?? "");
  const value = mathParser ? axisNumber(text, NaN)
    : /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text) ? Number(text) : NaN;
  if (!Number.isFinite(value)) return;
  point.errors ??= {};
  (point.errors[axis] ??= {})[side] = value;
}

export function parsePgfplotsPointMeta(raw, plotOptions) {
  if (/\bsymbolic\b/i.test(String(plotOptions["point meta"] || ""))) return raw;
  const value = axisNumber(raw, NaN);
  return Number.isFinite(value) ? value : raw;
}

export function normalizePgfplotsSymbolicCoordinates(addplots = [], axisOptions = {}) {
  const xLabels = symbolicCoordinateLabels(axisOptions["symbolic x coords"]);
  const yLabels = symbolicCoordinateLabels(axisOptions["symbolic y coords"]);
  if (!xLabels.length && !yLabels.length) return { addplots, axisOptions };

  const xMap = symbolicCoordinateMap(xLabels);
  const yMap = symbolicCoordinateMap(yLabels);
  const normalizedPlots = addplots.map((plot) => {
    if (plot.type !== "coordinates" || !Array.isArray(plot.points)) return plot;
    const pointMap = new Map();
    const points = plot.points.map((point) => {
      const normalized = normalizeSymbolicPoint(point, xMap, yMap);
      pointMap.set(point, normalized);
      return normalized;
    });
    Object.defineProperty(points, "rows", {
      value: (plot.coordinateRows || plot.points.rows || [plot.points]).map((row) =>
        row.map((point) => pointMap.get(point) || normalizeSymbolicPoint(point, xMap, yMap))
      ),
      enumerable: false,
      configurable: true
    });
    return {
      ...plot,
      points,
      coordinateRows: points.rows
    };
  });
  const normalizedOptions = { ...axisOptions };
  if (xLabels.length) {
    normalizedOptions["pgfplots symbolic x labels"] = xLabels;
    normalizedOptions["pgfplots symbolic x positions"] = xLabels.map((_label, index) => index);
  }
  if (yLabels.length) {
    normalizedOptions["pgfplots symbolic y labels"] = yLabels;
    normalizedOptions["pgfplots symbolic y positions"] = yLabels.map((_label, index) => index);
  }
  return { addplots: normalizedPlots, axisOptions: normalizedOptions };
}

export function symbolicCoordinateLabels(raw) {
  const text = stripAxisListBraces(String(raw || "").trim());
  if (!text) return [];
  return splitTopLevel(text, ",")
    .map((part) => stripAxisListBraces(part.trim()))
    .filter(Boolean);
}

// Resolve symbolic/date coordinates first. A rejected point contributes to
// neither axis limit; "jump" additionally interrupts the next line segment.
export function filterUnboundedCoordinates(plots, axisOptions) {
  // Like pgfplotsaxisdatapointsurveyed, reject the whole measurement before
  // updating either limit if any component cannot be transformed.
  const logX = isLogAxis(axisOptions, "x"), logY = isLogAxis(axisOptions, "y");
  const valid = ({ x, y }) => Number.isFinite(x) && Number.isFinite(y)
    && (!logX || x > 0) && (!logY || y > 0);
  return plots.map((plot) => {
    if (plot.type !== "coordinates" || plot.is3d || plot.points.every(valid)) return plot;
    const jump = (plot.options["unbounded coords"] ?? axisOptions["unbounded coords"]) === "jump";
    let interrupted = false;
    let hasPoint = false;
    const rows = (plot.coordinateRows || plot.points.rows || [plot.points]).map((row) => {
      const kept = [];
      for (const point of row) {
        if (!valid(point)) {
          interrupted = true;
          continue;
        }
        kept.push(jump && hasPoint && interrupted ? { ...point, breakBefore: true } : point);
        interrupted = false;
        hasPoint = true;
      }
      return kept;
    });
    return { ...plot, points: rows.flat(), coordinateRows: rows };
  });
}

function symbolicCoordinateMap(labels) {
  return new Map(labels.map((label, index) => [symbolicCoordinateKey(label), index]));
}

function normalizeSymbolicPoint(point, xMap, yMap) {
  const rawX = point.rawX ?? coordinateComponent(point.raw, 0);
  const rawY = point.rawY ?? coordinateComponent(point.raw, 1);
  const x = xMap.size ? xMap.get(symbolicCoordinateKey(rawX)) : undefined;
  const y = yMap.size ? yMap.get(symbolicCoordinateKey(rawY)) : undefined;
  return {
    ...point,
    x: Number.isFinite(x) ? x : point.x,
    y: Number.isFinite(y) ? y : point.y
  };
}

function coordinateComponent(raw, index) {
  const text = String(raw || "").trim();
  if (!text.startsWith("(") || !text.endsWith(")")) return "";
  return splitTopLevel(text.slice(1, -1), ",")[index]?.trim() || "";
}

function symbolicCoordinateKey(raw) {
  return String(raw || "").replace(/\s+/g, "").trim();
}

export function axisNumber(raw, fallback = 0) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const value = evaluateMath(String(raw), {});
  return Number.isFinite(value) ? value : fallback;
}

export function axisNumberList(raw) {
  const text = stripAxisListBraces(String(raw || "").trim());
  if (!text) return [];
  const parts = splitTopLevel(text, ",").map((part) => stripAxisListBraces(part.trim()));
  const ellipsis = parts.findIndex((part) => part === "..." || part === "\\dots");
  if (ellipsis >= 1 && ellipsis + 1 < parts.length) {
    const prefix = parts.slice(0, ellipsis).map((part) => axisNumber(part, NaN));
    const end = axisNumber(parts[ellipsis + 1], NaN);
    if (prefix.every(Number.isFinite) && Number.isFinite(end)) {
      const start = prefix[0];
      const step = prefix.length >= 2 ? prefix.at(-1) - prefix.at(-2) : start <= end ? 1 : -1;
      if (Number.isFinite(step) && Math.abs(step) > 1e-12) {
        const values = [...prefix];
        let value = prefix.at(-1) + step;
        const within = step > 0 ? () => value <= end + Math.abs(step) * 1e-9 : () => value >= end - Math.abs(step) * 1e-9;
        while (within() && values.length < 1000) {
          values.push(value);
          value += step;
        }
        return values;
      }
    }
  }
  return parts.map((part) => axisNumber(part, NaN)).filter(Number.isFinite);
}

function stripAxisListBraces(raw) {
  const text = String(raw || "").trim();
  return /^\{[\s\S]*\}$/.test(text) ? text.slice(1, -1).trim() : text;
}
