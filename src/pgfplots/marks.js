import { parseDimension } from "../engine/math.js";
import { parseOptions, splitTopLevel } from "../engine/options.js";
import { formatAxisNumber, formatAxisPoint, joinOptions } from "./format.js";
import { plotColorValue, plotLineWidthOption, selectPlotColor, selectPlotMarkFillColor } from "./plotStyle.js";
import { basicPlotMarkGeometry, placePlotMarkGeometry } from "../tikz/libraries/plotmarks.js";

export function createPlotMarkModel(plotOptions = {}) {
  const raw = plotOptions.mark ?? (plotOptions["only marks"] ? "*" : "none");
  return {
    mark: raw === true ? "*" : String(raw || "none"),
    onlyMarks: Boolean(plotOptions["only marks"]),
    size: plotOptions["mark size"] || "2pt"
  };
}

export function shouldRenderPlotMarks(options = {}) {
  if (options["no markers"] || String(options.mark || "").trim().toLowerCase() === "none") return false;
  // `\addplot+` only says that the active cycle-list style is appended to
  // this plot. It does not itself request a marker. A custom cycle list may
  // contain only color/dash entries, and `mark={}` explicitly disables one.
  return Boolean(options["only marks"] || options.scatter || options.mark);
}

export function scatterClassOptionsForPoint(options = {}, point = {}) {
  const rawClasses = options["scatter/classes"];
  const meta = String(point.meta ?? "").trim();
  if (!rawClasses || rawClasses === true || !meta) return options;

  for (const entry of splitTopLevel(String(rawClasses), ",")) {
    const match = entry.trim().match(/^([^=]+?)\s*=\s*\{([\s\S]*)\}$/);
    if (!match || match[1].trim() !== meta) continue;
    return { ...options, ...parseOptions(match[2]) };
  }
  return options;
}

export function renderPlotMark(point, options = {}, plotIndex = 0) {
  const mark = String(options.mark || (options.scatter ? "*" : "*")).trim().toLowerCase();
  const mappedColor = String(options["pgfplots scatter mapped color"] || "").trim();
  const stroke = mappedColor ? `${mappedColor}!80!black` : plotColorValue(selectPlotColor(options, plotIndex));
  const fill = mappedColor || plotColorValue(selectPlotMarkFillColor(options, plotIndex));
  const filledStyle = joinOptions(["axis mark", `draw=${stroke}`, `fill=${fill}`, "fill opacity=1", plotLineWidthOption(options)]);
  const strokedStyle = joinOptions(["axis mark", `draw=${stroke}`, plotLineWidthOption(options)]);
  const size = axisMarkRadius(options);
  if (mark === "x") {
    const diagonal = size / Math.SQRT2;
    return `\\draw[${strokedStyle}] ${formatAxisPoint(offsetPoint(point, -diagonal, -diagonal))} -- ${formatAxisPoint(offsetPoint(point, diagonal, diagonal))} ${formatAxisPoint(offsetPoint(point, -diagonal, diagonal))} -- ${formatAxisPoint(offsetPoint(point, diagonal, -diagonal))};`;
  }
  if (mark === "+") {
    return `\\draw[${strokedStyle}] ${formatAxisPoint(offsetPoint(point, -size, 0))} -- ${formatAxisPoint(offsetPoint(point, size, 0))} ${formatAxisPoint(offsetPoint(point, 0, -size))} -- ${formatAxisPoint(offsetPoint(point, 0, size))};`;
  }
  if (mark === "halfcircle") {
    return renderHalfCircleMark(point, options, size, strokedStyle, fill, false);
  }
  if (mark === "halfcircle*") {
    return renderHalfCircleMark(point, options, size, strokedStyle, fill, true);
  }
  if (datavisualizationIsMercedesMark(mark)) {
    return datavisualizationAxisMercedesMark(point, strokedStyle, mark, size);
  }
  const basicGeometry = basicPlotMarkGeometry(mark, size);
  if (basicGeometry) {
    const style = basicGeometry.filled ? filledStyle : strokedStyle;
    return `\\draw[${style}] ${formatPlotMarkGeometry(basicGeometry, point, plotMarkRotation(options))};`;
  }
  return `\\draw[${mark === "o" ? strokedStyle : filledStyle}] ${formatAxisPoint(point)} circle(${formatAxisNumber(size)});`;
}

export function datavisualizationIsMercedesMark(mark) {
  return String(mark || "").trim().toLowerCase().startsWith("mercedes star");
}

export function axisMarkRadius(options = {}) {
  const raw = options["mark size"] ?? options.markSize ?? "2pt";
  const text = String(raw ?? "").trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  const value = /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(text) ? parseDimension(`${text}pt`, {}) : parseDimension(text, {});
  return Number.isFinite(value) && value > 0 ? value : parseDimension("2pt", {});
}

function renderHalfCircleMark(point, options, size, strokedStyle, fill, starred) {
  const rotation = plotMarkRotation(options);
  const left = rotatePointAround(point, -size, 0, rotation);
  const right = rotatePointAround(point, size, 0, rotation);
  const lowerFill = halfCircleMarkColor(options);
  const fillStyle = (color) => joinOptions([
    "axis mark",
    "draw=none",
    `fill=${color}`,
    "fill opacity=1"
  ]);
  const radius = formatAxisNumber(size);
  const lower = `${formatAxisPoint(left)} arc (${formatAxisNumber(180 + rotation)}:${formatAxisNumber(360 + rotation)}:${radius}) -- cycle;`;
  const items = [];

  if (starred) {
    const upper = `${formatAxisPoint(right)} arc (${formatAxisNumber(rotation)}:${formatAxisNumber(180 + rotation)}:${radius}) -- cycle;`;
    items.push(`\\fill[${fillStyle(fill)}] ${upper}`);
  }
  if (lowerFill) items.push(`\\fill[${fillStyle(lowerFill)}] ${lower}`);

  const divider = starred ? "" : `${formatAxisPoint(left)} -- ${formatAxisPoint(right)} `;
  items.push(`\\draw[${strokedStyle}] ${divider}${formatAxisPoint(point)} circle(${radius});`);
  return items.join("");
}

function halfCircleMarkColor(options = {}) {
  const raw = options["mark color"] ?? options.markColor;
  if (raw !== undefined && raw !== null && raw !== true) {
    const color = plotColorValue(raw);
    return String(color).trim().toLowerCase() === "none" ? null : color;
  }
  // pgflibraryplotmarks.code.tex uses white when /pgf/mark color is unset.
  return "white";
}

function plotMarkRotation(options = {}) {
  const raw = options["mark options"];
  if (!raw || raw === true) return 0;
  const value = Number(parseOptions(stripOptionBraces(raw)).rotate);
  return Number.isFinite(value) ? value : 0;
}

function formatPlotMarkGeometry(geometry, point, rotation) {
  const placed = placePlotMarkGeometry(geometry, point, rotation);
  return placed.primitives.map((primitive) => {
    if (primitive.type === "circle") {
      return `${formatAxisPoint(primitive.center)} circle(${formatAxisNumber(primitive.radius)})`;
    }
    const [first, ...rest] = primitive.points;
    const path = [formatAxisPoint(first), ...rest.map((item) => formatAxisPoint(item))].join(" -- ");
    return primitive.closed ? `${path} -- cycle` : path;
  }).join(" ");
}

function stripOptionBraces(value) {
  const text = String(value || "").trim();
  return text.startsWith("{") && text.endsWith("}") ? text.slice(1, -1).trim() : text;
}

function rotatePointAround(point, x, y, degrees) {
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: point.x + x * cosine - y * sine,
    y: point.y + x * sine + y * cosine
  };
}

function datavisualizationAxisMercedesMark(point, style, mark, size) {
  const flipped = String(mark || "").toLowerCase().includes("flipped");
  const angles = flipped ? [-90, 30, 150] : [90, 210, 330];
  const center = formatAxisPoint(point);
  const spokes = angles
    .map((angle) => {
      const end = offsetPoint(point, Math.cos((angle * Math.PI) / 180) * size, Math.sin((angle * Math.PI) / 180) * size);
      return `${center} -- ${formatAxisPoint(end)}`;
    })
    .join(" ");
  return `\\draw[${style}] ${spokes};`;
}

function offsetPoint(point, x, y) {
  return { x: point.x + x, y: point.y + y };
}
