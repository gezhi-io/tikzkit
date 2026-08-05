import { parseDimension } from "../engine/math.js";

export const TIKZ_UNIT = 100;
export const TIKZ_MARGIN = 10;

export const TIKZ_FONT_FAMILY = "TikZKitCMUSerif, 'CMU Serif', serif";
export const TIKZ_MATH_MAIN_FONT_FAMILY = "TikZKitMath_Main, TikZKitCMUSerif, serif";
export const TIKZ_MATH_ITALIC_FONT_FAMILY = "TikZKitMath_Math, TikZKitMath_Main, TikZKitCMUSerif, serif";
export const TIKZ_MATH_CALLIGRAPHIC_FONT_FAMILY =
  "TikZKitMath_Caligraphic, TikZKitMath_Main, TikZKitCMUSerif, serif";
export const TIKZ_MONOSPACE_FONT_FAMILY =
  "KaTeX_Typewriter, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace";
export const TIKZ_SANS_SERIF_FONT_FAMILY = "TikZKitCMUSans, 'CMU Sans Serif', sans-serif";
// helvet.sty selects the PSNFSS `phv` family. macOS ships Helvetica, which is
// its closest browser-native counterpart and avoids changing generic sans text.
export const TIKZ_HELVETICA_FONT_FAMILY = "Helvetica, Arial, sans-serif";
export const TIKZ_TEXT_FONT_SIZE = lineWidthFromPt(10);
export const TIKZ_DISPLAY_MATH_FONT_SIZE = lineWidthFromPt(10);
// cmtt10.tfm: every glyph advances by 0.524996em. The SVG typewriter font
// starts from a 0.6em advance, so scale it to the native TeX metric.
export const TIKZ_TYPEWRITER_WIDTH_SCALE = 0.524996 / 0.6;

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
  "stealth-prime": {
    kind: "stealth-prime",
    length: lineWidthFromPt(4.2),
    width: lineWidthFromPt(3.4),
    fill: "context-stroke",
    stroke: "context-stroke"
  },
  latex: {
    kind: "latex",
    length: lineWidthFromPt(3.0),
    width: lineWidthFromPt(3.0),
    fill: "context-stroke"
  },
  "two-heads": {
    kind: "two-heads",
    length: lineWidthFromPt(4.1),
    width: lineWidthFromPt(2.45),
    fill: "none"
  },
  hook: {
    kind: "hook",
    length: lineWidthFromPt(3.6),
    width: lineWidthFromPt(4.2),
    fill: "none"
  },
  "open-circle": {
    kind: "open-circle",
    length: lineWidthFromPt(2.5),
    width: lineWidthFromPt(2.5),
    fill: "none"
  },
  circle: {
    kind: "circle",
    // PGF's classic `*` arrow spans about 5pt at the default/thick line
    // widths (the reference path is 5.02pt across), not the 2.5pt radius.
    length: lineWidthFromPt(5),
    width: lineWidthFromPt(5),
    fill: "context-stroke"
  },
  "open-triangle": {
    kind: "open-triangle",
    length: lineWidthFromPt(6.88),
    width: lineWidthFromPt(5.84),
    fill: "none"
  },
  "straight-barb": {
    kind: "straight-barb",
    length: lineWidthFromPt(3.4),
    width: lineWidthFromPt(4.2),
    fill: "none",
    stroke: "context-stroke"
  },
  "arc-barb": {
    kind: "arc-barb",
    length: lineWidthFromPt(3.8),
    width: lineWidthFromPt(4.4),
    fill: "none",
    stroke: "context-stroke"
  },
  "tee-barb": {
    kind: "tee-barb",
    length: lineWidthFromPt(3.4),
    width: lineWidthFromPt(4.2),
    fill: "none",
    stroke: "context-stroke"
  },
  kite: {
    kind: "kite",
    length: lineWidthFromPt(4.8),
    width: lineWidthFromPt(4.2),
    fill: "context-stroke"
  },
  square: {
    kind: "square",
    length: lineWidthFromPt(3.2),
    width: lineWidthFromPt(3.2),
    fill: "context-stroke"
  },
  rays: {
    kind: "rays",
    length: lineWidthFromPt(4.2),
    width: lineWidthFromPt(5.2),
    fill: "none",
    stroke: "context-stroke"
  },
  bar: {
    kind: "bar",
    length: 0,
    width: lineWidthFromPt(4),
    fill: "none",
    stroke: "context-stroke",
    lineWidth: lineWidthFromPt(0.4)
  },
  dimline: {
    kind: "dimline",
    length: lineWidthFromPt(5),
    width: lineWidthFromPt(6),
    fill: "context-stroke"
  },
  "dimline reverse": {
    kind: "dimline reverse",
    length: lineWidthFromPt(5),
    width: lineWidthFromPt(6),
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

export function latexArrowGeometryFromLineWidth(lineWidth, scale = 1) {
  const unitsPerPt = lineWidthFromPt(1);
  const lineWidthPt = Math.max(0.01, Number(lineWidth) || TIKZ_LINE_WIDTHS.default) / unitsPerPt;
  // PGF applies `scale` to Latex's computed arrow length, then derives its
  // width and capped outline from that scaled length. It does not simply
  // scale the generic 3pt fallback dimensions.
  const arrowScale = Number.isFinite(Number(scale)) && Number(scale) > 0 ? Number(scale) : 1;
  const arrowLengthPt = (3 + 4.5 * lineWidthPt) * arrowScale;
  const arrowWidthPt = 0.75 * arrowLengthPt;
  const arrowLineWidthPt = Math.min(lineWidthPt, 0.2 * arrowLengthPt);

  const lengthToWidth = arrowLengthPt / arrowWidthPt;
  const frontMiterPt = Math.sqrt(9 * lengthToWidth * lengthToWidth + 1) * arrowLineWidthPt;
  const visibleLengthPt = arrowLengthPt - 0.5 * frontMiterPt - 0.5 * arrowLineWidthPt;

  const normalX = 0.3 * arrowLengthPt;
  const normalY = 0.2333333 * arrowWidthPt;
  const normalLength = Math.hypot(normalX, normalY) || 1;
  const backMiterRatio = (normalY / normalLength + 1) / (normalX / normalLength);
  const halfWidthPt = 0.5 * arrowWidthPt - 0.5 * backMiterRatio * arrowLineWidthPt;

  const length = lineWidthFromPt(visibleLengthPt);
  return {
    length,
    halfWidth: lineWidthFromPt(halfWidthPt),
    lineWidth: lineWidthFromPt(arrowLineWidthPt),
    shorten: length
  };
}

export const TIKZ_AXIS_CONTAINER_MARGIN = {
  left: 0.3,
  right: 0.207,
  top: 0.225,
  bottom: 0.32
};

export const TIKZ_MIDDLE_AXIS_CONTAINER_MARGIN = {
  left: 0.34,
  right: 0.232,
  top: 0.253,
  bottom: 0.244
};

const TIKZ_PGFPLOTS_DEFAULT_ENLARGED_MIDDLE_AXIS_RESERVE = parseDimension("45pt", {});
const TIKZ_PGFPLOTS_ENLARGED_MIDDLE_AXIS_MARGIN = parseDimension("0.2pt", {});

export const TIKZ_ENLARGED_MIDDLE_AXIS_CONTAINER_MARGIN = {
  left: TIKZ_PGFPLOTS_ENLARGED_MIDDLE_AXIS_MARGIN,
  right: TIKZ_PGFPLOTS_ENLARGED_MIDDLE_AXIS_MARGIN,
  top: TIKZ_PGFPLOTS_ENLARGED_MIDDLE_AXIS_MARGIN,
  bottom: TIKZ_PGFPLOTS_ENLARGED_MIDDLE_AXIS_MARGIN
};

export const TIKZ_EXPLICIT_MIDDLE_AXIS_CONTAINER_MARGIN = {
  left: 0.48,
  right: 0.41,
  top: 0.3,
  bottom: 0.24
};

export const TIKZ_EXPLICIT_MIDDLE_AXIS_NO_ENLARGE_CONTAINER_MARGIN = {
  left: 0.48,
  right: 0.34,
  top: 0.236,
  bottom: 0.24
};

export const TIKZ_EXPLICIT_MIDDLE_AXIS_TOP_DESCRIPTION_LABEL_MARGIN = {
  left: 0.48,
  right: 0.492,
  top: 0.23,
  bottom: 0.618
};

export const TIKZ_HIDDEN_AXIS_CONTAINER_MARGIN = {
  left: 0.06,
  right: 0.06,
  top: 0.06,
  bottom: 0.06
};

export const TIKZ_PGFPLOTS_MIDDLE_AXIS_RESERVED_X = 1.72;
export const TIKZ_PGFPLOTS_MIDDLE_AXIS_RESERVED_Y = 1.7;
export const TIKZ_PGFPLOTS_DEFAULT_MIDDLE_AXIS_RESERVED_X = 1.607;
export const TIKZ_PGFPLOTS_DEFAULT_MIDDLE_AXIS_RESERVED_Y = 1.603;
export const TIKZ_PGFPLOTS_DEFAULT_ENLARGED_MIDDLE_AXIS_RESERVED_X = TIKZ_PGFPLOTS_DEFAULT_ENLARGED_MIDDLE_AXIS_RESERVE;
export const TIKZ_PGFPLOTS_DEFAULT_ENLARGED_MIDDLE_AXIS_RESERVED_Y = TIKZ_PGFPLOTS_DEFAULT_ENLARGED_MIDDLE_AXIS_RESERVE;
export const TIKZ_PGFPLOTS_EXPLICIT_MIDDLE_AXIS_RESERVED_X = 2.457;
export const TIKZ_PGFPLOTS_EXPLICIT_MIDDLE_AXIS_RESERVED_Y = 1.933;
export const TIKZ_PGFPLOTS_MIDDLE_AXIS_STACK_SHIFT = 0.45;
export const TIKZ_PGFPLOTS_MIDDLE_AXIS_STACK_GAP = 0.35;

export function lineWidthFromPt(pt) {
  return (Number(pt) / 28.4527559) * TIKZ_UNIT;
}

const TIKZTOSVG_STEALTH_THICK_LENGTH_PT = 4.144532;
const TIKZTOSVG_STEALTH_THICK_HALF_WIDTH_PT = 2.074219;
const PGF_CLASSIC_STEALTH_BASE_PT = 0.28;
const PGF_CLASSIC_STEALTH_LINE_WIDTH_FACTOR = 0.3;
const PGF_CLASSIC_STEALTH_BACK_FACTOR = 8;
const TIKZTOSVG_STEALTH_SOURCE_THICK_LENGTH_PT =
  PGF_CLASSIC_STEALTH_BACK_FACTOR * (PGF_CLASSIC_STEALTH_BASE_PT + PGF_CLASSIC_STEALTH_LINE_WIDTH_FACTOR * 0.8);
const TIKZTOSVG_STEALTH_LENGTH_SCALE =
  TIKZTOSVG_STEALTH_THICK_LENGTH_PT / TIKZTOSVG_STEALTH_SOURCE_THICK_LENGTH_PT;
const TIKZTOSVG_STEALTH_HALF_WIDTH_RATIO = TIKZTOSVG_STEALTH_THICK_HALF_WIDTH_PT / TIKZTOSVG_STEALTH_THICK_LENGTH_PT;

export function stealthArrowLengthFromLineWidth(lineWidth) {
  const lineWidthPt = Math.max(0.01, lineWidth ?? TIKZ_LINE_WIDTHS.default) / lineWidthFromPt(1);
  const pgfUnit = PGF_CLASSIC_STEALTH_BASE_PT + PGF_CLASSIC_STEALTH_LINE_WIDTH_FACTOR * lineWidthPt;
  return lineWidthFromPt(PGF_CLASSIC_STEALTH_BACK_FACTOR * pgfUnit * TIKZTOSVG_STEALTH_LENGTH_SCALE);
}

export function stealthArrowHalfWidthFromLength(length) {
  return length * TIKZTOSVG_STEALTH_HALF_WIDTH_RATIO;
}

export function stealthArrowShortenFromLength(length) {
  return length * 0.625;
}

export function stealthPrimeArrowDimensions(lineWidth) {
  const unitsPerPt = lineWidthFromPt(1);
  const lineWidthPt = Math.max(0.01, Number(lineWidth) || TIKZ_LINE_WIDTHS.default) / unitsPerPt;
  const arrowUnit = lineWidthFromPt(0.28 + 0.3 * lineWidthPt);
  const halfStroke = Math.max(0.01, Number(lineWidth) || TIKZ_LINE_WIDTHS.default) / 2;
  return {
    arrowUnit,
    leftExtent: 6 * arrowUnit + halfStroke,
    rightExtent: 2 * arrowUnit + halfStroke,
    halfHeight: 3.25 * arrowUnit + halfStroke
  };
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
  const source = String(kind || "to").trim().replace(/^>$/, "to");
  if (/^stealth\s*'$/i.test(source)) return "stealth-prime";
  const text = source.replace(/'/g, "").toLowerCase();
  if (text === "dimline reverse" || text === "dimline-reverse") return "dimline reverse";
  if (text === "dimline") return "dimline";
  if (text === "stealth-prime") return "stealth-prime";
  if (text === "straight barb" || text === "straight-barb") return "straight-barb";
  if (text === "arc barb" || text === "arc-barb" || text === "parenthesis") return "arc-barb";
  if (text === "tee barb" || text === "tee-barb" || text === "bracket") return "tee-barb";
  if (text === "kite" || text === "diamond") return "kite";
  if (text === "square" || text === "rectangle") return "square";
  if (text === "rays" || text === "ray") return "rays";
  if (text.includes("two heads") || text.includes("two-heads") || text.includes("double")) return "two-heads";
  if (text.includes("open circle") || text === "o") return "open-circle";
  if (text === "*" || text === "circle") return "circle";
  if (text.includes("open triangle")) return "open-triangle";
  if (text.includes("bar")) return "bar";
  if (text.includes("hook")) return "hook";
  if (text.includes("stealth")) return "stealth";
  if (text.includes("latex")) return "latex";
  if (text.includes("to")) return "to";
  return text === ">" ? "to" : text || "to";
}
