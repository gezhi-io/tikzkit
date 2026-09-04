import { parseDimension } from "../engine/math.js";
import { parseOptions, splitTopLevel } from "../engine/options.js";
import { formatAxisNumber, formatAxisPoint, joinOptions } from "./format.js";
import { plotColorValue, plotLineWidthOption, selectPlotColor, selectPlotMarkFillColor } from "./plotStyle.js";
import {
  basicPlotMarkGeometry,
  placePlotMarkGeometry,
  plotMarkGeometryCommands,
  plotMarkLocalOptions,
  splitFillPlotMarkGeometry,
  textPlotMarkModel,
  textPlotMarkNodeOptions,
  transformPlotMarkCommands
} from "../tikz/libraries/plotmarks.js";

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
  const localOptions = plotMarkLocalOptions(options);
  const effectiveOptions = { ...options, ...localOptions };
  const mappedColor = String(options["pgfplots scatter mapped color"] || "").trim();
  const defaultStroke = mappedColor ? `${mappedColor}!80!black` : plotColorValue(selectPlotColor(options, plotIndex));
  const defaultFill = mappedColor || plotColorValue(selectPlotMarkFillColor(options, plotIndex));
  const stroke = localMarkColor(localOptions, "draw", defaultStroke);
  const fill = localMarkColor(localOptions, "fill", defaultFill);
  const localPaint = plotMarkPaintOptions(localOptions);
  const lineWidth = plotLineWidthOption(localOptions) || plotLineWidthOption(options);
  const filledStyle = joinOptions(["axis mark", `draw=${stroke}`, `fill=${fill}`, "fill opacity=1", lineWidth, ...localPaint]);
  const strokedStyle = joinOptions(["axis mark", `draw=${stroke}`, lineWidth, ...localPaint.filter((option) => !option.startsWith("fill="))]);
  const size = axisMarkRadius(effectiveOptions);
  if (mark === "text") {
    return renderTextPlotMark(point, options, stroke);
  }
  if (mark === "x") {
    const diagonal = size / Math.SQRT2;
    return `\\draw[${strokedStyle}] ${formatPlotMarkCommands(transformPlotMarkCommands([
      markMove(point, -diagonal, -diagonal), markLine(point, diagonal, diagonal),
      markMove(point, -diagonal, diagonal), markLine(point, diagonal, -diagonal)
    ], point, localOptions))};`;
  }
  if (mark === "+") {
    return `\\draw[${strokedStyle}] ${formatPlotMarkCommands(transformPlotMarkCommands([
      markMove(point, -size, 0), markLine(point, size, 0),
      markMove(point, 0, -size), markLine(point, 0, size)
    ], point, localOptions))};`;
  }
  if (mark === "halfcircle") {
    return renderHalfCircleMark(point, effectiveOptions, size, strokedStyle, fill, false);
  }
  if (mark === "halfcircle*") {
    return renderHalfCircleMark(point, effectiveOptions, size, strokedStyle, fill, true);
  }
  const splitGeometry = splitFillPlotMarkGeometry(mark, size);
  if (splitGeometry) {
    return renderSplitFillMark(point, effectiveOptions, splitGeometry, strokedStyle, fill, localOptions);
  }
  if (datavisualizationIsMercedesMark(mark)) {
    return datavisualizationAxisMercedesMark(point, strokedStyle, mark, size, localOptions);
  }
  const basicGeometry = basicPlotMarkGeometry(mark, size);
  if (basicGeometry) {
    const style = basicGeometry.filled ? filledStyle : strokedStyle;
    return `\\draw[${style}] ${formatPlotMarkGeometry(basicGeometry, point, localOptions)};`;
  }
  const circleGeometry = { primitives: [{ type: "circle", radius: size }], filled: mark !== "o" };
  return `\\draw[${mark === "o" ? strokedStyle : filledStyle}] ${formatPlotMarkGeometry(circleGeometry, point, localOptions)};`;
}

function renderTextPlotMark(point, options, color) {
  const model = textPlotMarkModel(options);
  const nodeOptions = textPlotMarkNodeOptions(model);
  if (!Object.hasOwn(nodeOptions, "text") && !Object.hasOwn(nodeOptions, "color")) {
    nodeOptions.text = color;
  }
  const style = joinOptions(Object.entries(nodeOptions).map(formatTikzOption));
  return `\\node[${style}] at ${formatAxisPoint(point)} {${model.text}};`;
}

function formatTikzOption([key, value]) {
  if (value === false || value === undefined || value === null) return "";
  if (value === true || value === "") return key;
  return `${key}=${value}`;
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
  const lowerFill = splitPlotMarkColor(options);
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

function renderSplitFillMark(point, options, geometry, strokedStyle, fill, localOptions) {
  const secondaryFill = splitPlotMarkColor(options);
  const fillStyle = (color) => joinOptions([
    "axis mark",
    "draw=none",
    `fill=${color}`,
    "fill opacity=1"
  ]);
  const items = [
    `\\fill[${fillStyle(fill)}] ${formatPlotMarkGeometry(geometry.primary, point, localOptions)};`
  ];
  if (secondaryFill) {
    items.push(`\\fill[${fillStyle(secondaryFill)}] ${formatPlotMarkGeometry(geometry.secondary, point, localOptions)};`);
  }
  items.push(`\\draw[${strokedStyle}] ${formatPlotMarkGeometry(geometry.outline, point, localOptions)};`);
  return items.join("");
}

function splitPlotMarkColor(options = {}) {
  const raw = options["mark color"] ?? options.markColor;
  if (raw !== undefined && raw !== null && raw !== true) {
    const color = plotColorValue(raw);
    return String(color).trim().toLowerCase() === "none" ? null : color;
  }
  // pgflibraryplotmarks.code.tex uses white when /pgf/mark color is unset.
  return "white";
}

function plotMarkRotation(options = {}) {
  const direct = Number(options.rotate);
  if (Number.isFinite(direct)) return direct;
  const raw = options["mark options"];
  if (!raw || raw === true) return 0;
  const value = Number(parseOptions(stripOptionBraces(raw)).rotate);
  return Number.isFinite(value) ? value : 0;
}

function formatPlotMarkGeometry(geometry, point, localOptions = {}) {
  if (!plotMarkHasAffineTransform(localOptions)) {
    return formatPlacedPlotMarkGeometry(placePlotMarkGeometry(geometry, point, plotMarkRotation(localOptions)));
  }
  const commands = plotMarkGeometryCommands(geometry, point);
  return formatPlotMarkCommands(transformPlotMarkCommands(commands, point, localOptions));
}

function formatPlacedPlotMarkGeometry(placed) {
  return placed.primitives.map((primitive) => {
    if (primitive.type === "circle") {
      return `${formatAxisPoint(primitive.center)} circle(${formatAxisNumber(primitive.radius)})`;
    }
    if (primitive.type === "cubicPath") {
      const curves = primitive.curves.map((curve) =>
        ` .. controls ${formatAxisPoint(curve.c1)} and ${formatAxisPoint(curve.c2)} .. ${formatAxisPoint(curve.to)}`
      ).join("");
      return `${formatAxisPoint(primitive.start)}${curves}${primitive.closed ? " -- cycle" : ""}`;
    }
    const [first, ...rest] = primitive.points;
    const path = [formatAxisPoint(first), ...rest.map((item) => formatAxisPoint(item))].join(" -- ");
    return primitive.closed ? `${path} -- cycle` : path;
  }).join(" ");
}

function plotMarkHasAffineTransform(options = {}) {
  return ["scale", "xscale", "yscale", "xslant", "yslant", "xshift", "yshift"]
    .some((key) => options[key] !== undefined);
}

function formatPlotMarkCommands(commands) {
  return commands.map((command) => {
    if (command.type === "moveTo") return formatAxisPoint(command);
    if (command.type === "lineTo") return `-- ${formatAxisPoint(command)}`;
    if (command.type === "curveTo") {
      return `.. controls ${formatAxisPoint({ x: command.x1, y: command.y1 })} and ${formatAxisPoint({ x: command.x2, y: command.y2 })} .. ${formatAxisPoint(command)}`;
    }
    if (command.type === "closePath") return "-- cycle";
    return "";
  }).filter(Boolean).join(" ");
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

function datavisualizationAxisMercedesMark(point, style, mark, size, localOptions = {}) {
  const flipped = String(mark || "").toLowerCase().includes("flipped");
  const angles = flipped ? [-90, 30, 150] : [90, 210, 330];
  const commands = angles.flatMap((angle) => [
    { type: "moveTo", x: point.x, y: point.y },
    markLine(point, Math.cos((angle * Math.PI) / 180) * size, Math.sin((angle * Math.PI) / 180) * size)
  ]);
  const spokes = formatPlotMarkCommands(transformPlotMarkCommands(commands, point, localOptions));
  return `\\draw[${style}] ${spokes};`;
}

function markMove(point, x, y) {
  return { type: "moveTo", ...offsetPoint(point, x, y) };
}

function markLine(point, x, y) {
  return { type: "lineTo", ...offsetPoint(point, x, y) };
}

function localMarkColor(options, key, fallback) {
  const raw = options[key] ?? options.color;
  return raw === undefined || raw === null || raw === true ? fallback : plotColorValue(raw);
}

function plotMarkPaintOptions(options = {}) {
  const supported = [
    "opacity", "draw opacity", "fill opacity", "line cap", "line join",
    "dash pattern", "dashed", "densely dashed", "loosely dashed",
    "dotted", "densely dotted", "loosely dotted"
  ];
  return supported.flatMap((key) => {
    const value = options[key];
    if (value === undefined || value === null || value === false) return [];
    return [value === true ? key : `${key}=${value}`];
  });
}

function offsetPoint(point, x, y) {
  return { x: point.x + x, y: point.y + y };
}
