import { joinOptions } from "./format.js";

export const PGFPLOTS_DEFAULT_COLORS = ["blue", "red", "brown!80!black", "black!60!green", "orange", "violet", "cyan", "magenta"];

export function selectPlotColor(options, plotIndex = 0) {
  const explicit = explicitPlotColor(options);
  if (explicit) return explicit;
  return plotUsesCycleColor(options) ? PGFPLOTS_DEFAULT_COLORS[plotIndex % PGFPLOTS_DEFAULT_COLORS.length] : "black";
}

export function selectPlotMarkFillColor(options, plotIndex = 0) {
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
  if (options["line width"]) parts.push(`line width=${options["line width"]}`);
  else if (options["very thick"]) parts.push("very thick");
  else if (options.thick) parts.push("thick");
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
