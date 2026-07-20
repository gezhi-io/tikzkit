import { evaluateMath } from "../engine/math.js";
import { splitTopLevel } from "../engine/options.js";

export function parseCoordinateList(input) {
  const rows = parseCoordinateRows(input);
  const points = rows.flat();
  Object.defineProperty(points, "rows", {
    value: rows,
    enumerable: false,
    configurable: true
  });
  return points;
}

export function parseCoordinateRows(input) {
  const text = String(input || "");
  return text
    .trim()
    .split(/\n\s*\n+/)
    .map((rowText) => parseCoordinateRow(rowText))
    .filter((row) => row.length > 0);
}

function parseCoordinateRow(text) {
  const points = [];
  const pattern = /\(([^)]*)\)/g;
  let match = pattern.exec(text);
  while (match) {
    const parts = splitTopLevel(match[1], ",");
    if (parts.length >= 2) {
      const point = {
        x: axisNumber(parts[0]),
        y: axisNumber(parts[1]),
        raw: `(${parts[0].trim()},${parts[1].trim()})`
      };
      Object.defineProperties(point, {
        rawX: { value: parts[0].trim(), enumerable: false, configurable: true },
        rawY: { value: parts[1].trim(), enumerable: false, configurable: true }
      });
      if (parts.length >= 3) {
        point.z = axisNumber(parts[2]);
        Object.defineProperty(point, "rawZ", { value: parts[2].trim(), enumerable: false, configurable: true });
        point.raw = `(${parts[0].trim()},${parts[1].trim()},${parts[2].trim()})`;
      }
      points.push(point);
    }
    match = pattern.exec(text);
  }
  return points;
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
