import { parseDimension } from "../engine/math.js";
import { axisNumber } from "./coordinates.js";
import { formatAxisNumber, formatAxisPoint, joinOptions } from "./format.js";
import { plotColorValue } from "./plotStyle.js";

export function renderNodesNearCoords(plot = {}, axisOptions = {}, geometry = {}) {
  if (!axisOptions["nodes near coords"] && !plot.options?.["nodes near coords"]) return [];
  return (plot.points || []).map((point) => {
    const mapped = geometry.mapPoint(point);
    return `\\node[axis near coord, anchor=south, font=\\scriptsize] at ${formatAxisPoint(offsetPoint(mapped, 0, 0.08))} {${formatAxisNumber(point.y)}};`;
  });
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
