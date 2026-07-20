import { parseDimension } from "../engine/math.js";
import { parseOptions, splitTopLevel } from "../engine/options.js";
import { formatAxisNumber, formatAxisPoint, joinOptions } from "./format.js";
import { plotColorValue, plotLineWidthOption, selectPlotColor, selectPlotMarkFillColor } from "./plotStyle.js";

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
  return Boolean(options["only marks"] || options.scatter || options.mark || options["pgfplots plus"]);
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
    return `\\draw[${strokedStyle}] ${formatAxisPoint(offsetPoint(point, -size, 0))} -- ${formatAxisPoint(offsetPoint(point, size, 0))} ${formatAxisPoint(point)} circle(${formatAxisNumber(size)});`;
  }
  if (mark === "halfcircle*") {
    const left = formatAxisPoint(offsetPoint(point, -size, 0));
    const right = formatAxisPoint(offsetPoint(point, size, 0));
    return `\\draw[${filledStyle}] ${left} arc (180:360:${formatAxisNumber(size)}) -- cycle;\\draw[${strokedStyle}] ${left} -- ${right} ${formatAxisPoint(point)} circle(${formatAxisNumber(size)});`;
  }
  if (datavisualizationIsMercedesMark(mark)) {
    return datavisualizationAxisMercedesMark(point, strokedStyle, mark, size);
  }
  if (mark === "square" || mark === "square*") {
    const style = mark.endsWith("*") ? filledStyle : strokedStyle;
    return `\\draw[${style}] ${formatAxisPoint(offsetPoint(point, -size, -size))} -- ${formatAxisPoint(offsetPoint(point, size, -size))} -- ${formatAxisPoint(offsetPoint(point, size, size))} -- ${formatAxisPoint(offsetPoint(point, -size, size))} -- cycle;`;
  }
  if (mark === "triangle" || mark === "triangle*") {
    const style = mark.endsWith("*") ? filledStyle : strokedStyle;
    const halfBase = size * Math.cos(Math.PI / 6);
    const baseY = -size / 2;
    return `\\draw[${style}] ${formatAxisPoint(offsetPoint(point, 0, size))} -- ${formatAxisPoint(offsetPoint(point, halfBase, baseY))} -- ${formatAxisPoint(offsetPoint(point, -halfBase, baseY))} -- cycle;`;
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
