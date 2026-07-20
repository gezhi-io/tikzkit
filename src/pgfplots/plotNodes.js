import { evaluateMath, parseDimension } from "../engine/math.js";
import { parseOptions } from "../engine/options.js";
import { axisNumber } from "./coordinates.js";
import { formatAxisNumber, formatAxisPoint, joinOptions } from "./format.js";
import { isPgfplotsIntervalPlot, pgfplotsIntervalDataPoints } from "./histogram.js";
import { plotColorValue, selectPlotColor } from "./plotStyle.js";

export function renderNodesNearCoords(plot = {}, axisOptions = {}, geometry = {}, plotIndex = 0) {
  if (!axisOptions["nodes near coords"] && !plot.options?.["nodes near coords"]) return [];
  const orientation = isPgfplotsIntervalPlot(axisOptions, plot.options || {}, "y") ? "y" : "x";
  const points = isPgfplotsIntervalPlot(axisOptions, plot.options || {}, orientation)
    ? pgfplotsIntervalDataPoints(plot, axisOptions, orientation)
    : plot.points || [];
  const style = joinOptions([
    "axis near coord",
    "anchor=south",
    "font=\\scriptsize",
    nodeNearCoordTextColor(plot.options || {}, plotIndex),
    ...nodeNearCoordStyles(axisOptions),
    ...nodeNearCoordStyles(plot.options || {})
  ]);
  const offset = nodeNearCoordOffset(axisOptions, plot.options || {});
  return points.map((point, pointIndex) => {
    const mapped = plot.is3d && typeof geometry.mapPoint3d === "function"
      ? geometry.mapPoint3d(point)
      : geometry.mapPoint(point);
    const label = nodeNearCoordLabel(point, plot, axisOptions, pointIndex);
    return `\\node[${style}] at ${formatAxisPoint(offsetPoint(mapped, 0, offset))} {${label}};`;
  });
}

function nodeNearCoordLabel(point, plot = {}, axisOptions = {}, pointIndex = 0) {
  const rawTemplate = plot.options?.["nodes near coords"] ?? axisOptions["nodes near coords"];
  const fallback = point.meta ?? (plot.is3d ? point.z : point.y);
  if (rawTemplate === true || rawTemplate === undefined || rawTemplate === null || String(rawTemplate).trim() === "") {
    return formatAxisNumber(fallback);
  }

  const bindings = visualizationDependencyBindings(axisOptions, plot.options || {}, point);
  let label = String(rawTemplate);
  label = label.replace(/\\pgfplotspointmeta\b/g, formatAxisNumber(fallback));
  label = label.replace(/\\coordindex\b/g, String(pointIndex));
  label = label.replace(/\\thisrow\s*\{([^{}]+)\}/g, (_match, column) => String(point.columns?.[String(column).trim()] ?? ""));
  for (const [macro, value] of bindings) {
    label = label.replace(new RegExp(`\\\\${escapeRegExp(macro)}(?![A-Za-z@])`, "g"), value);
  }
  label = label.replace(/\\pgfmathparse\s*\{([^{}]*)\}\s*\\pgfmathresult/g, (_match, expression) => {
    const value = evaluateMath(expression);
    return Number.isFinite(value) ? formatAxisNumber(value) : "0";
  });
  return label;
}

function nodeNearCoordOffset(axisOptions = {}, plotOptions = {}) {
  const merged = {};
  for (const rawStyle of [...nodeNearCoordStyles(axisOptions), ...nodeNearCoordStyles(plotOptions)]) {
    Object.assign(merged, parseOptions(rawStyle));
  }
  const anchor = String(merged.anchor || "").trim().replace(/^\{([\s\S]*)\}$/, "$1").trim().toLowerCase();
  return anchor === "center" ? 0 : 0.08;
}

function visualizationDependencyBindings(axisOptions, plotOptions, point) {
  const declarations = [axisOptions["visualization depends on"], plotOptions["visualization depends on"]]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value) => value !== undefined && value !== null && value !== true);
  const bindings = new Map();
  for (const declaration of declarations) {
    const match = String(declaration).match(/(?:\bvalue\s+)?\\thisrow\s*\{([^{}]+)\}\s*\\as\s*\\([A-Za-z@]+)/);
    if (!match) continue;
    bindings.set(match[2], String(point.columns?.[match[1].trim()] ?? ""));
  }
  return bindings;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nodeNearCoordTextColor(plotOptions, plotIndex) {
  if (!plotOptions["pgfplots explicit options"]) return "";
  const color = plotColorValue(selectPlotColor(plotOptions, plotIndex));
  return color && color !== "black" ? `text=${color}` : "";
}

function nodeNearCoordStyles(options = {}) {
  return [
    options["every node near coord/.style"],
    options["every node near coord/.append style"]
  ].flatMap((value) => Array.isArray(value) ? value : [value]).filter((value) => value && value !== true).map(String);
}

export function renderAxisPlotInlineNodes(nodes = [], mappedPoints = [], plotColor = "") {
  if (!nodes.length || !mappedPoints.length) return [];
  const commands = [];
  for (const node of nodes) {
    const base = interpolatePolylinePoint(mappedPoints, axisNumber(node.options?.pos, node.options?.pos === undefined ? 1 : 0.5));
    if (!base) continue;
    const shift = {
      x: parseDimension(String(node.options?.xshift || "0"), {}),
      y: parseDimension(String(node.options?.yshift || "0"), {})
    };
    const point = offsetPoint(base, Number.isFinite(shift.x) ? shift.x : 0, Number.isFinite(shift.y) ? shift.y : 0);
    const anchor = inlineAxisNodeAnchor(node.options || {});
    const inheritedTextColor = axisInlineNodeTextColor(node.options || {}, plotColor);
    const style = joinOptions([
      "axis plot node",
      `anchor=${anchor}`,
      node.options?.font ? `font=${node.options.font}` : "",
      inheritedTextColor ? `text=${inheritedTextColor}` : "",
      axisInlineNodeOption("pin", node.options?.pin),
      axisInlineNodeOption("label", node.options?.label),
      axisInlineNodeOption("pin distance", node.options?.["pin distance"]),
      axisInlineNodeOption("pin edge", node.options?.["pin edge"]),
      node.options?.fill && node.options.fill !== true ? `fill=${node.options.fill}` : "",
      node.options?.draw && node.options.draw !== true ? `draw=${node.options.draw}` : node.options?.draw === true ? "draw" : ""
    ]);
    if (Math.hypot(point.x - base.x, point.y - base.y) > 1e-6 && (node.options?.["append after command"] || anchor.includes("west") || anchor.includes("east"))) {
      commands.push(`\\draw[axis plot node connector, gray, thin] ${formatAxisPoint(base)} -- ${formatAxisPoint(point)};`);
    }
    commands.push(`\\node[${style}] at ${formatAxisPoint(point)} {${node.text}};`);
  }
  return commands;
}

function axisInlineNodeTextColor(options = {}, plotColor = "") {
  if (options.text && options.text !== true) return "";
  if (options.color && options.color !== true) return "";
  const color = plotColorValue(plotColor);
  return color && color !== "black" ? color : "";
}

function axisInlineNodeOption(key, value) {
  if (value === undefined || value === null || value === false || value === "") return "";
  if (Array.isArray(value)) return value.map((item) => axisInlineNodeOption(key, item)).filter(Boolean).join(", ");
  if (value === true) return key;
  return `${key}={${value}}`;
}

function interpolatePolylinePoint(points, rawPos) {
  if (!points.length) return null;
  if (points.length === 1) return points[0];
  const pos = Math.max(0, Math.min(1, Number.isFinite(rawPos) ? rawPos : 0.5));
  const lengths = [];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const length = Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
    lengths.push(length);
    total += length;
  }
  if (total <= 1e-9) return points[0];
  let target = total * pos;
  for (let index = 1; index < points.length; index += 1) {
    const length = lengths[index - 1];
    if (target <= length || index === points.length - 1) {
      const t = length <= 1e-9 ? 0 : target / length;
      return {
        x: points[index - 1].x + (points[index].x - points[index - 1].x) * t,
        y: points[index - 1].y + (points[index].y - points[index - 1].y) * t
      };
    }
    target -= length;
  }
  return points[points.length - 1];
}

function inlineAxisNodeAnchor(options = {}) {
  const explicit = String(options.anchor || "").trim();
  if (explicit) return explicit;
  if (options.above) return "south";
  if (options.below) return "north";
  if (options.left) return "east";
  if (options.right) return "west";
  return "center";
}

function offsetPoint(point, x, y) {
  return { x: point.x + x, y: point.y + y };
}
