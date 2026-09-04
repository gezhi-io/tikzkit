import { joinOptions } from "./format.js";

export const PGFPLOTS_DEFAULT_COLORS = ["blue", "red", "brown!80!black", "black!60!green", "orange", "violet", "cyan", "magenta"];
export const PGFPLOTS_DEFAULT_MARKS = ["*", "square*", "otimes*", "star", "diamond*", "*", "square*", "otimes*", "star", "diamond*"];
export const PGFPLOTS_DEFAULT_MARK_FILLS = [
  "blue!80!black",
  "red!80!black",
  "brown!80!black",
  "",
  "blue!80!black",
  "red!80!black",
  "brown!80!black",
  "gray",
  "",
  "red!80!black"
];
export const PGFPLOTS_DEFAULT_BAR_STYLES = [
  { draw: "blue", fill: "blue!30!white", mark: "none" },
  { draw: "red", fill: "red!30!white", mark: "none" },
  { draw: "brown!60!black", fill: "brown!30!white", mark: "none" },
  { draw: "black", fill: "gray", mark: "none" },
  { draw: "violet!80!black", fill: "violet", mark: "none" },
  { draw: "green", fill: "green!80!black", mark: "none" }
];

export function defaultPgfplotsCycleMarkStyle(plotIndex = 0) {
  const index = ((Number(plotIndex) || 0) % PGFPLOTS_DEFAULT_MARKS.length + PGFPLOTS_DEFAULT_MARKS.length) % PGFPLOTS_DEFAULT_MARKS.length;
  const style = { mark: PGFPLOTS_DEFAULT_MARKS[index] };
  if (PGFPLOTS_DEFAULT_MARK_FILLS[index]) style["mark fill"] = PGFPLOTS_DEFAULT_MARK_FILLS[index];
  return style;
}

export function defaultPgfplotsBarCycleStyle(plotIndex = 0) {
  const index = ((Number(plotIndex) || 0) % PGFPLOTS_DEFAULT_BAR_STYLES.length + PGFPLOTS_DEFAULT_BAR_STYLES.length) % PGFPLOTS_DEFAULT_BAR_STYLES.length;
  return { ...PGFPLOTS_DEFAULT_BAR_STYLES[index] };
}

export function selectPlotColor(options, plotIndex = 0) {
  const explicit = explicitPlotColor(options);
  if (explicit) return explicit;
  return plotUsesCycleColor(options) ? PGFPLOTS_DEFAULT_COLORS[plotIndex % PGFPLOTS_DEFAULT_COLORS.length] : "black";
}

export function selectPlotMarkFillColor(options, plotIndex = 0) {
  if (options["mark fill"] && options["mark fill"] !== true) return plotColorValue(options["mark fill"]);
  if (options.fill && options.fill !== true) return plotColorValue(options.fill);
  const explicit = explicitPlotColor(options);
  const cycle = PGFPLOTS_DEFAULT_COLORS[plotIndex % PGFPLOTS_DEFAULT_COLORS.length];
  if (options["pgfplots plus"]) {
    if (!explicit || explicit === "black") return pgfplotsMarkFillColor(cycle);
    return pgfplotsMarkFillColor(explicit);
  }
  return explicit || (plotUsesCycleColor(options) ? cycle : "black");
}

export function plotColorValue(color) {
  const text = String(color || "").trim();
  if (text.startsWith("draw=") || text.startsWith("color=") || text.startsWith("fill=")) return text.split("=").slice(1).join("=");
  return text;
}

export function plotUsesCycleColor(options = {}) {
  return Boolean(options["pgfplots plus"] || !options["pgfplots explicit options"]);
}

export function isPlotColorToken(value) {
  const text = String(value || "").trim();
  return (
    /^(black|white|red|green|blue|cyan|magenta|yellow|gray|grey|orange|purple|brown|pink|violet|lime|teal|olive|lightgray|darkgray)$/i.test(text) ||
    text.includes("!") ||
    /^#[0-9a-f]{6}$/i.test(text) ||
    /^rgb\s*\(/i.test(text)
  );
}

export function selectPlotStyle(options, plotIndex = 0) {
  const parts = [selectPlotColor(options, plotIndex)];
  const lineWidth = plotLineWidthOption(options);
  if (lineWidth) parts.push(lineWidth);
  if (options["line cap"]) parts.push(`line cap=${options["line cap"]}`);
  if (options["line join"]) parts.push(`line join=${options["line join"]}`);
  if (options.dashed) parts.push("dashed");
  if (options["densely dashed"]) parts.push("densely dashed");
  if (options["loosely dashed"]) parts.push("loosely dashed");
  if (options.dotted) parts.push("dotted");
  if (options["densely dotted"]) parts.push("densely dotted");
  if (options["loosely dotted"]) parts.push("loosely dotted");
  if (options["dash pattern"]) parts.push(`dash pattern=${options["dash pattern"]}`);
  return joinOptions(parts);
}

export function selectPlotFillStyle(options, plotIndex = 0) {
  if (options.fill && options.fill !== true) return `fill=${options.fill}`;
  const color = selectPlotColor(options, plotIndex);
  if (color.startsWith("draw=") || color.startsWith("color=")) return `fill=${color.split("=").slice(1).join("=")}`;
  return `fill=${color || PGFPLOTS_DEFAULT_COLORS[plotIndex % PGFPLOTS_DEFAULT_COLORS.length]}`;
}

export function plotFillOpacityOption(options = {}) {
  const raw = options["fill opacity"] ?? options.opacity;
  if (raw === undefined || raw === null || raw === true) return "";
  const value = Number(raw);
  if (!Number.isFinite(value)) return "";
  const opacity = value > 1 ? value / 100 : value;
  return `fill opacity=${Math.max(0, Math.min(1, opacity))}`;
}

export function plotLineWidthOption(options = {}) {
  if (options["line width"]) return `line width=${options["line width"]}`;
  if (options["ultra thick"]) return "ultra thick";
  if (options["very thick"]) return "very thick";
  if (options.thick) return "thick";
  if (options.semithick) return "semithick";
  if (options.thin) return "thin";
  if (options["very thin"]) return "very thin";
  if (options["ultra thin"]) return "ultra thin";
  return "";
}

function pgfplotsMarkFillColor(color) {
  const text = String(color || "").trim();
  const equals = text.indexOf("=");
  if (equals !== -1) {
    const key = text.slice(0, equals);
    const value = text.slice(equals + 1);
    return `${key}=${pgfplotsMarkFillColor(value)}`;
  }
  if (!text || text.includes("!") || text.startsWith("#") || /^rgb\s*\(/i.test(text)) return text;
  return `${text}!80!black`;
}

function explicitPlotColor(options) {
  for (const [key, value] of Object.entries(options || {})) {
    if (key.startsWith("pgfplots ")) continue;
    if (value === true && isPlotColorToken(key)) {
      return key;
    }
    if (key === "color" || key === "draw") return `${key}=${value}`;
  }
  return "";
}
