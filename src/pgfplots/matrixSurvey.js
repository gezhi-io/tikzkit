import { convertColorSpec, resolveColorSpec } from "../engine/colors.js";
import { splitTopLevel, stripOuterBraces } from "../engine/options.js";
import { dimensionDecimal, pgfFixedMultiply } from "../engine/pgf-fixed-math.js";
import { colormapColorCss } from "./colormap.js";
import { scalarSurveyNumber } from "./scalarSurvey.js";
import { texAdd, texMultiply } from "./surveyFloat.js";

function* optionEntries(...layers) {
  for (const layer of layers) {
    for (const [raw, value] of Object.entries(layer ?? {})) {
      const key = raw.replace(/^\/pgfplots\//, "");
      yield [key, value];
      if (/^(?:matrix plot|imagesc)\*?$/.test(key)) {
        yield ["surf", true];
        yield ["mesh input", "image"];
        yield ["shader", "flat corner"];
        yield ["z buffer", "none"];
      }
    }
  }
}

export function matrixPlotSettings(axisOptions, plotOptions) {
  const entries = new Map();
  for (const [key, value] of optionEntries(axisOptions, plotOptions)) {
    entries.delete(key);
    entries.set(key, value);
  }
  if (entries.get("mesh input") === "image") {
    if (!entries.has("shader")) entries.set("shader", "faceted");
    // pgfplotscoordprocessing's z-buffer default expands to none for images.
    if (!entries.has("z buffer") || entries.get("z buffer") === "default") entries.set("z buffer", "none");
  }
  return Object.fromEntries(entries);
}

export function matrixPlotKind(axisOptions, plotOptions) {
  let surf = false, image = false, reverse = false;
  for (const [key, value] of optionEntries(axisOptions, plotOptions)) {
    // The unstarred style appends late *axis* options; a star never clears them.
    if (key === "matrix plot" || key === "imagesc") reverse = true;
    else if (key === "surf") surf = String(value) !== "false";
    else if (key === "mesh" || key === "patch") surf = false;
    else if (key === "mesh input") image = value === "image";
  }
  return surf && image ? (reverse ? "matrix" : "matrix*") : null;
}

function problem(diagnostics, code, message, severity = "error") {
  diagnostics.push({ severity, code: "PGFPLOTS_MATRIX_" + code, message: "PGFPlots matrix plot: " + message });
  return null;
}

function meshShape(plot, settings, diagnostics) {
  const n = plot.points.length;
  const order = settings["mesh/ordering"] ?? "x varies";
  const colwise = order === "y varies" || order === "colwise";
  const dimError = message => problem(diagnostics, "DIMENSIONS", message);
  if (!colwise && order !== "x varies" && order !== "rowwise") return dimError("unknown mesh/ordering: " + order);
  const dimension = key => {
    const value = settings["mesh/" + key];
    return value == null || value === "" ? null : /^\+?\d+$/.test(String(value).trim()) ? Number(value) : NaN;
  };
  const rows = dimension("rows"), cols = dimension("cols");
  if ([rows, cols].some(v => v !== null && !(Number.isSafeInteger(v) && v >= 2 && v <= n))) {
    return dimError("mesh/rows and mesh/cols must be integers of at least 2 that fit the input.");
  }
  const width = colwise ? rows : cols, height = colwise ? cols : rows;
  const sourceRows = plot.coordinateRows ?? plot.points.rows ?? [plot.points];
  if (!Array.isArray(sourceRows) || !sourceRows.every(Array.isArray)) return dimError("invalid coordinate scanlines.");
  const lengths = sourceRows.map(row => row.length).filter(Boolean);
  if (lengths.reduce((a, b) => a + b, 0) !== n) return dimError("scanline lengths do not match the coordinate count.");
  const empty = settings["empty line"] ?? "auto";
  const scan = empty === "auto" || empty === "scanline";
  if (!scan && !["none", "no op", "jump", "nan"].includes(empty)) return dimError("unknown empty line setting: " + empty);
  if ((empty === "jump" || empty === "nan") && lengths.length > 1) {
    return problem(diagnostics, "SOURCE", "coordinate jumps are not supported; use unbounded point meta for a hole.");
  }
  // Real paragraph ends and the running width counter can *both* close
  // lines. These notifications affect limits even if explicit dimensions
  // later take precedence when the visualizer reconstructs the lattice.
  const scanLengths = [];
  if (scan) {
    for (const k of lengths) {
      const step = width ?? k;
      for (let offset = 0; offset < k; offset += step) scanLengths.push(Math.min(step, k - offset));
    }
  }
  const uniform = scanLengths.length > 0 && scanLengths.every(k => k === scanLengths[0]);
  const guess = width === null && height === null && !uniform;
  const length = width ?? (height !== null ? n / height : uniform ? scanLengths[0] : Math.sqrt(n));
  if (!Number.isInteger(length) || length < 2 || n % length || n / length < 2 ||
      (height !== null && n / length !== height)) {
    return dimError(`${n} coordinates do not form a complete mesh of at least 2 rows and 2 columns; specify mesh/rows or mesh/cols.`);
  }
  if (guess) problem(diagnostics, "DIMENSIONS", `no unique scanline length; assuming a ${length} by ${length} mesh.`, "warning");
  if (scanLengths.length < 2) {
    problem(diagnostics, "LIMITS", `automatic axis limits are incomplete; use mesh/${colwise ? "rows" : "cols"}=${length} and empty line=scanline.`, "warning");
  }
  return { length, colwise, scanLengths };
}

function cornerGrid(points, width) {
  const height = points.length / width;
  const v = Array.from({ length: height + 1 }, () => Array(width + 1));
  const p = (r, c) => points[r * width + c];
  const reflect = (a, b, q) => ({ x: (a.x - q.x) + b.x, y: (a.y - q.y) + b.y });
  // pgfplotsmeshplotimage: interior vertices are shared four-center means.
  // Reflect each interior vertex across the boundary pair's midpoint, then
  // close the four outer parallelograms. No sorting or axis reversal here.
  for (let r = 1; r < height; r++) {
    for (let c = 1; c < width; c++) {
      const a = p(r-1,c-1), b = p(r-1,c), d = p(r,c-1), e = p(r,c);
      v[r][c] = { x: .25*a.x + .25*b.x + .25*e.x + .25*d.x, y: .25*a.y + .25*b.y + .25*e.y + .25*d.y };
    }
    v[r][0] = reflect(p(r,0), p(r-1,0), v[r][1]);
    v[r][width] = reflect(p(r-1,width-1), p(r,width-1), v[r][width-1]);
  }
  for (let c = 1; c < width; c++) {
    v[0][c] = reflect(p(0,c), p(0,c-1), v[1][c]);
    v[height][c] = reflect(p(height-1,c-1), p(height-1,c), v[height-1][c]);
  }
  for (const [r, ri] of [[0,1], [height,height-1]]) {
    for (const [c, ci] of [[0,1], [width,width-1]]) v[r][c] = reflect(v[r][ci], v[ri][c], v[ri][ci]);
  }
  return v;
}

function surveyLimits(points, { colwise, scanLengths }) {
  const out = points.map(({ x, y }) => ({ x, y }));
  const a = colwise ? "y" : "x", b = colwise ? "x" : "y";
  const add = (av, bv) => out.push({ [a]: av, [b]: bv });
  const extend = (u, v) => texAdd(u, texMultiply(.5, texAdd(u, -v)));
  // Native updates B from the *previous line's last* B, not its first.
  // The survey never goes back to correct limits after it learns the shape.
  let i = 0;
  for (const step of scanLengths.length ? scanLengths : [points.length]) {
    const first = points[i], end = i + step - 1;
    if (step > 1) add(extend(first[a], points[i+1][a]), points[i+1][b]);
    if (i) {
      const previous = points[i-1];
      add(first[a], extend(previous[b], first[b]));
      add(first[a], extend(first[b], previous[b]));
    }
    if (step > 1 && scanLengths.length) add(extend(points[end][a], points[end-1][a]), points[end][b]);
    i += step;
  }
  return out;
}

function number(raw, point, settings, index) {
  if (typeof raw === "number") return raw;
  const text = stripOuterBraces(String(raw ?? "").trim());
  if (!text || /^[+-]?nan$/i.test(text)) return NaN;
  if (/^[+-]?inf(?:inity)?$/i.test(text)) return text[0] === "-" ? -Infinity : Infinity;
  return scalarSurveyNumber(text, point, { axis: settings }, index);
}

function numericMeta(point, index, settings, tableExpr) {
  const meta = settings["point meta"] ?? "f(x)";
  if (meta === "f(x)" || meta === "y") return point.y;
  if (meta === "x") return point.x;
  if (meta === "none" || meta === "z") return NaN;
  const raw = meta === "explicit" ? (tableExpr || point.meta) : meta;
  return number(raw, point, settings, index);
}

function explicitColor(raw, settings, point, index) {
  const text = stripOuterBraces(String(raw ?? "").trim());
  if (!text) return null;
  const equals = text.indexOf("=");
  const model = equals < 0 ? settings["mesh/colorspace explicit color input"] ?? "rgb" : text.slice(0, equals).trim();
  const value = stripOuterBraces(text.slice(equals + 1).trim());
  const output = settings["mesh/colorspace explicit color output"] ?? "rgb";
  if (!["rgb", "cmyk", "gray"].includes(output)) return undefined;
  let spec;
  if (model === "color") {
    // Keep document-defined named colors and mixtures for the paint resolver.
    if (output === "rgb") return value || undefined;
    spec = resolveColorSpec(value);
  } else if (model === "HTML" && /^[\da-f]{6}$/i.test(value)) {
    spec = { model: "rgb", channels: value.match(/../g).map(s => parseInt(s, 16) / 255) };
  } else {
    const count = { gray: 1, rgb: 3, rgb255: 3, cmy: 3, cmyk: 4, cmyk255: 4, hsb: 3, Hsb: 3 }[model];
    const math = settings["mesh/color input"] === "explicit mathparse";
    const parts = splitTopLevel(value, ",");
    if (parts.length !== count || parts.some(s => !s.trim())) return undefined;
    const channels = parts.map(s => math ? number(s, point, settings, index) : Number(s));
    const scaled = model.endsWith("255");
    if (channels.some((v, i) => !Number.isFinite(v) || v < 0 || v > (scaled ? 255 : model === "Hsb" && !i ? 360 : 1))) return undefined;
    if (scaled) {
      spec = { model: model.slice(0,-3), channels: channels.map(v => Number(dimensionDecimal(pgfFixedMultiply(.003921568, v)))) };
    } else if (model === "cmy") {
      spec = { model: "rgb", channels: channels.map(v => 1 - v) };
    } else if (model === "hsb" || model === "Hsb") {
      const [h,s,b] = channels, hue = 6 * h / (model === "Hsb" ? 360 : 1);
      spec = { model: "rgb", channels: [5,3,1].map(n => {
        const k = (n + hue) % 6;
        return b * (1 - s * Math.max(0, Math.min(k, 4-k, 1)));
      }) };
    } else spec = { model, channels };
  }
  return spec ? colormapColorCss(convertColorSpec(spec, output)) : undefined;
}

export function surveyMatrixPlot(plot, axisOptions = {}, diagnostics = []) {
  if (!matrixPlotKind(axisOptions, plot?.options)) return null;
  if (plot?.type !== "coordinates" || plot.is3d || plot.invalidCoordinateSource ||
      (plot.source && plot.source !== "table" && plot.source !== "coordinates") || !Array.isArray(plot.points) || !plot.points.length) {
    return problem(diagnostics, "SOURCE", "expected a complete two-dimensional coordinate list or table.");
  }
  const points = plot.points;
  const bad = points.findIndex(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.breakBefore ||
    (plot.source !== "table" && p.z !== undefined));
  if (bad >= 0) return problem(diagnostics, "SOURCE", `invalid 2D center at index ${bad}; use point meta, not missing coordinates, for holes.`);
  const settings = matrixPlotSettings(axisOptions, plot.options);
  const shape = meshShape(plot, settings, diagnostics);
  if (!shape) return null;
  const colorInput = settings["mesh/color input"] ?? "colormap";
  const explicit = colorInput === "explicit" || colorInput === "explicit mathparse";
  if (!explicit && colorInput !== "colormap") return problem(diagnostics, "COLOR", "unknown mesh/color input: " + colorInput);
  const tableExpr = plot.tableOptions?.["meta expr"] ?? settings["table/meta expr"];
  const width = shape.length, vertices = cornerGrid(points, width), cells = [];
  for (const [index, point] of points.entries()) {
    const r = Math.floor(index / width), c = index % width;
    const corners = [vertices[r][c], vertices[r][c+1], vertices[r+1][c+1], vertices[r+1][c]];
    const color = explicit ? explicitColor(point.meta, settings, point, index) : undefined;
    if (explicit && color === undefined) return problem(diagnostics, "COLOR", `invalid explicit color at index ${index}: ${point.meta}`);
    cells.push({ corners, point, index, meta: explicit ? null : numericMeta(point, index, settings, tableExpr), color });
  }
  return { cells, rangePoints: surveyLimits(points, shape), scanlineLength: width };
}
