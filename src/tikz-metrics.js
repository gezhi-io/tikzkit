import { parseDimension } from "./math.js";

export const TIKZ_UNIT = 100;
export const TIKZ_MARGIN = 10;

export const TIKZ_FONT_FAMILY = "KaTeX_Main, 'Times New Roman', Times, serif";
export const TIKZ_MONOSPACE_FONT_FAMILY =
  "KaTeX_Typewriter, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace";
export const TIKZ_TEXT_FONT_SIZE = 30;
export const TIKZ_DISPLAY_MATH_FONT_SIZE = 34;

export const TIKZ_LINE_WIDTHS = {
  ultraThin: lineWidthFromPt(0.1),
  veryThin: lineWidthFromPt(0.2),
  thin: lineWidthFromPt(0.4),
  default: lineWidthFromPt(0.4),
  semithick: lineWidthFromPt(0.6),
  thick: lineWidthFromPt(0.8),
  veryThick: lineWidthFromPt(1.2),
  ultraThick: lineWidthFromPt(1.6)
};

export const TIKZ_DASH_PATTERN_STYLES = {
  solid: "",
  dotted: String.raw`on \pgflinewidth off 2pt`,
  "densely dotted": String.raw`on \pgflinewidth off 1pt`,
  "loosely dotted": String.raw`on \pgflinewidth off 4pt`,
  dashed: "on 3pt off 3pt",
  "densely dashed": "on 3pt off 2pt",
  "loosely dashed": "on 3pt off 6pt",
  dashdotted: String.raw`on 3pt off 2pt on \the\pgflinewidth off 2pt`,
  "dash dot": String.raw`on 3pt off 2pt on \the\pgflinewidth off 2pt`,
  "densely dashdotted": String.raw`on 3pt off 1pt on \the\pgflinewidth off 1pt`,
  "densely dash dot": String.raw`on 3pt off 1pt on \the\pgflinewidth off 1pt`,
  "loosely dashdotted": String.raw`on 3pt off 4pt on \the\pgflinewidth off 4pt`,
  "loosely dash dot": String.raw`on 3pt off 4pt on \the\pgflinewidth off 4pt`,
  dashdotdotted: String.raw`on 3pt off 2pt on \the\pgflinewidth off 2pt on \the\pgflinewidth off 2pt`,
  "dash dot dot": String.raw`on 3pt off 2pt on \the\pgflinewidth off 2pt on \the\pgflinewidth off 2pt`,
  "densely dashdotdotted": String.raw`on 3pt off 1pt on \the\pgflinewidth off 1pt on \the\pgflinewidth off 1pt`,
  "densely dash dot dot": String.raw`on 3pt off 1pt on \the\pgflinewidth off 1pt on \the\pgflinewidth off 1pt`,
  "loosely dashdotdotted": String.raw`on 3pt off 4pt on \the\pgflinewidth off 4pt on \the\pgflinewidth off 4pt`,
  "loosely dash dot dot": String.raw`on 3pt off 4pt on \the\pgflinewidth off 4pt on \the\pgflinewidth off 4pt`
};

export const TIKZ_ARROW = {
  markerWidth: 10,
  markerHeight: 10,
  refX: 9,
  refY: 5,
  markerPath: "M 0 0 L 10 5 L 0 10 z",
  standalonePath: "M -6 -5 L 6 0 L -6 5 z"
};

export const TIKZ_ARROW_TIPS = {
  to: {
    kind: "to",
    length: lineWidthFromPt(3.2),
    width: lineWidthFromPt(2.4),
    fill: "none"
  },
  stealth: {
    kind: "stealth",
    length: lineWidthFromPt(4.2),
    width: lineWidthFromPt(3.2),
    fill: "context-stroke"
  },
  latex: {
    kind: "latex",
    length: lineWidthFromPt(3.0),
    width: lineWidthFromPt(3.0),
    fill: "context-stroke"
  }
};

export function createArrowTip(kind = "to", overrides = {}) {
  const normalizedKind = normalizeArrowKind(kind);
  const base = TIKZ_ARROW_TIPS[normalizedKind] || TIKZ_ARROW_TIPS.to;
  return {
    ...base,
    ...overrides,
    kind: normalizedKind
  };
}

export const TIKZ_AXIS_CONTAINER_MARGIN = {
  left: 0.3,
  right: 0.55,
  top: 0.32,
  bottom: 0.32
};

export const TIKZ_HIDDEN_AXIS_CONTAINER_MARGIN = {
  left: 0.06,
  right: 0.06,
  top: 0.06,
  bottom: 0.06
};

export const TIKZ_PGFPLOTS_MIDDLE_AXIS_STACK_SHIFT = 0.45;
export const TIKZ_PGFPLOTS_MIDDLE_AXIS_STACK_GAP = 0.35;

export function lineWidthFromPt(pt) {
  return (Number(pt) / 28.4527559) * TIKZ_UNIT;
}

export function lineWidthFromTikzDimension(value, fallback = TIKZ_LINE_WIDTHS.default) {
  const text = String(value ?? "").trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  if (!text) return fallback;
  if (!/[A-Za-z]/.test(text)) {
    const numeric = Number(text);
    return Number.isFinite(numeric) ? numeric : fallback;
  }
  const cm = parseDimension(text, {});
  return Number.isFinite(cm) ? cm * TIKZ_UNIT : fallback;
}

function normalizeArrowKind(kind) {
  const text = String(kind || "to").trim().replace(/^>$/, "to").replace(/'/g, "").toLowerCase();
  if (text.includes("stealth")) return "stealth";
  if (text.includes("latex")) return "latex";
  if (text.includes("to")) return "to";
  return text === ">" ? "to" : text || "to";
}
