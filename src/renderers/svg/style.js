import { colorToRgb, normalizeColor } from "../../engine/options.js";
import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { arrowMarkerId } from "./markers.js";
import { svgDefinitionId } from "./definitionScope.js";

export function styleAttributes(style = {}, options = {}) {
  const mindmapPaint = style.mindmapConnection?.paint;
  const fill = mindmapPaint === "fill"
    ? `url(#${mindmapConnectionGradientId(style)})`
    : style.pattern
    ? `url(#${patternId(style)})`
    : style.shading === "ball"
      ? `url(#${ballGradientId(style)})`
      : style.shading === "axis"
        ? `url(#${axisGradientId(style)})`
        : style.shading === "radial"
          ? `url(#${radialGradientId(style)})`
          : svgPaint(style.fill || "none");
  const attrs = [
    ["stroke", mindmapPaint === "stroke" ? `url(#${mindmapConnectionGradientId(style)})` : svgPaint(style.stroke || "none")],
    ["fill", fill],
    ["stroke-width", style.lineWidth ?? 1]
  ];
  if (style.dashArray) attrs.push(["stroke-dasharray", style.dashArray.join(" ")]);
  if ((style.stroke || "none") !== "none") {
    attrs.push(["stroke-linecap", options.lineCap || style.lineCap || (style.dashArray ? style.dashLineCap || "butt" : "butt")]);
    attrs.push(["stroke-linejoin", options.lineJoin || style.lineJoin || "miter"]);
  }
  if (Number.isFinite(style.opacity)) attrs.push(["opacity", style.opacity]);
  if (Number.isFinite(style.fillOpacity)) attrs.push(["fill-opacity", style.fillOpacity]);
  if (Number.isFinite(style.strokeOpacity)) attrs.push(["stroke-opacity", style.strokeOpacity]);
  if (style.fillRule) attrs.push(["fill-rule", style.fillRule]);
  if (style.filter) attrs.push(["filter", style.filter]);
  if (pathFadingName(style.pathFading)) attrs.push(["mask", `url(#${pathFadingMaskId(style.pathFading, style)})`]);
  if (!options.omitMarkers && style.markerStart) attrs.push(["marker-start", `url(#${arrowMarkerId(style.markerStart, style)})`]);
  if (!options.omitMarkers && style.markerEnd) attrs.push(["marker-end", `url(#${arrowMarkerId(style.markerEnd, style)})`]);
  return attrs.map(([key, value]) => ` ${key}="${escapeAttribute(String(value))}"`).join("");
}

export function mindmapConnectionGradientId(style = {}) {
  const id = String(style.mindmapConnection?.id || "connection")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-|-$/g, "") || "connection";
  return svgDefinitionId(`tikz-mindmap-connection-${id}`, style);
}

export function svgPaint(value) {
  const text = String(value ?? "").trim();
  if (
    !text ||
    text === "none" ||
    text.startsWith("url(") ||
    text.startsWith("color-mix(") ||
    text.startsWith("var(") ||
    text === "currentColor" ||
    text === "transparent" ||
    text === "inherit"
  ) {
    return text;
  }
  const normalized = normalizeColor(text);
  if (normalized !== text || text.includes("!")) return normalized;
  return text;
}

export function pathFadingName(value) {
  const name = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (
    [
      "west",
      "east",
      "north",
      "south",
      "circle with fuzzy edge 10 percent",
      "circle with fuzzy edge 15 percent",
      "circle with fuzzy edge 20 percent",
      "fuzzy ring 15 percent"
    ].includes(name)
  ) return name;
  return "";
}

export function pathFadingKey(name) {
  return (pathFadingName(name) || "custom")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function pathFadingGradientId(name, context = {}) {
  return svgDefinitionId(`tikz-fading-gradient-${pathFadingKey(name)}-${pathFadingIsRadial(name) ? "radial" : "linear"}`, context);
}

export function pathFadingMaskId(name, context = {}) {
  return svgDefinitionId(`tikz-fading-${pathFadingKey(name)}-mask`, context);
}

export function pathFadingIsRadial(name) {
  return [
    "circle with fuzzy edge 10 percent",
    "circle with fuzzy edge 15 percent",
    "circle with fuzzy edge 20 percent",
    "fuzzy ring 15 percent"
  ].includes(pathFadingName(name));
}

export function axisGradientId(style = {}) {
  const top = String(style.topColor || "white").trim();
  const middle = String(style.middleColor || "gray").trim();
  const bottom = String(style.bottomColor || style.fill || "black").trim();
  const angle = String(style.shadingAngle ?? 0).trim();
  const stops = Array.isArray(style.linearStops)
    ? style.linearStops.map((stop) => `${stop.offset}:${stop.color}`).join("-")
    : "";
  if (stops) return svgDefinitionId(`tikz-axis-stops-${stablePaintHash(`${angle}-${stops}`)}`, style);
  const key = `${top}-${middle}-${bottom}-${angle}-${stops}`
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "axis";
  return svgDefinitionId(`tikz-axis-${key}`, style);
}

function stablePaintHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function ballGradientId(style = {}) {
  const color = String(style.ballColor || style.fill || "gray")
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "gray";
  return svgDefinitionId(`tikz-ball-${color}`, style);
}

export function radialGradientId(style = {}) {
  const name = String(style.shadingName || style.fill || "radial")
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "radial";
  return svgDefinitionId(`tikz-radial-${name}`, style);
}

export function mixPaint(color, target, baseAmount) {
  const rgb = paintToRgb(color);
  const targetRgb = paintToRgb(target);
  if (rgb && targetRgb) return rgbToCss(mixRgb(rgb, targetRgb, baseAmount));
  const percent = format(Math.max(0, Math.min(1, Number(baseAmount) || 0)) * 100);
  return `color-mix(in srgb, ${svgPaint(color)} ${percent}%, ${target})`;
}

export function patternPathData(kind) {
  const normalized = String(kind || "").toLowerCase().replace(/-/g, " ").trim();
  if (normalized === "north west lines") return "M 0 -4 L 12 8 M -4 0 L 8 12";
  return "M -4 8 L 8 -4 M 0 12 L 12 0";
}

export function patternId(style = {}) {
  const kind = String(style.pattern || "lines").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "lines";
  const color = String(style.patternColor || style.stroke || "black").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "black";
  return svgDefinitionId(`tikz-pattern-${kind}-${color}`, style);
}

function paintToRgb(color) {
  const text = svgPaint(color).trim().toLowerCase();
  const named = {
    black: [0, 0, 0],
    white: [255, 255, 255],
    red: [255, 0, 0],
    green: [0, 255, 0],
    blue: [0, 0, 255],
    yellow: [255, 255, 0],
    orange: [255, 128, 0],
    gray: [128, 128, 128],
    grey: [128, 128, 128]
  };
  if (named[text]) return named[text];
  const rgb = text.match(/^rgb\((\d+)\s+(\d+)\s+(\d+)\)$/);
  if (rgb) return rgb.slice(1).map(Number);
  const hex = text.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    return [hex[1].slice(0, 2), hex[1].slice(2, 4), hex[1].slice(4, 6)].map((part) => Number.parseInt(part, 16));
  }
  return null;
}

function mixRgb(base, target, amount) {
  const clamped = Math.max(0, Math.min(1, amount));
  return base.map((channel, index) => Math.round(channel * clamped + target[index] * (1 - clamped)));
}

function rgbToCss(rgb) {
  return `rgb(${rgb.map((channel) => Math.max(0, Math.min(255, Math.round(channel)))).join(" ")})`;
}
