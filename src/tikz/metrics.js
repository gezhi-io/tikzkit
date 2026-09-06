import { parseDimension } from "../engine/math.js";

export const TIKZ_UNIT = 100;
export const TIKZ_MARGIN = 10;

export const TIKZ_FONT_FAMILY = "TikZKitCMUSerif, 'CMU Serif', serif";
export const TIKZ_SMALL_CAPS_FONT_FAMILY = "TikZKitCMSC10, TikZKitCMUSerif, serif";
export const TIKZ_MATH_MAIN_FONT_FAMILY = "TikZKitMath_Main, TikZKitCMUSerif, serif";
export const TIKZ_MATH_ITALIC_FONT_FAMILY = "TikZKitMath_Math, TikZKitMath_Main, TikZKitCMUSerif, serif";
export const TIKZ_MATH_CALLIGRAPHIC_FONT_FAMILY =
  "TikZKitMath_Caligraphic, TikZKitMath_Main, TikZKitCMUSerif, serif";
export const TIKZ_MONOSPACE_FONT_FAMILY =
  "TikZKitCMUMono, monospace";
export const TIKZ_SANS_SERIF_FONT_FAMILY = "TikZKitCMUSans, 'CMU Sans Serif', sans-serif";
// MacTeX's TeX Gyre Heros provides the portable PSNFSS-compatible sans face.
export const TIKZ_HELVETICA_FONT_FAMILY = "TikZKitHeros, sans-serif";
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
  latexslim: {
    kind: "latexslim",
    // Circuitikz declares this classic arrow tip itself. Its painted size is
    // derived from the current stroke width in the SVG renderer below.
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
  const sourceKind = String(kind || "to").trim().replace(/^>$/, "to");
  const normalizedKind = overrides.meta === true && sourceKind === "square"
    ? "square"
    : normalizeArrowKind(sourceKind);
  const base = TIKZ_ARROW_TIPS[normalizedKind] || legacyArrowTipBase(normalizedKind) || TIKZ_ARROW_TIPS.to;
  const legacy = normalizedKind === "latex"
    ? Object.hasOwn(overrides, "legacy")
      ? overrides.legacy === true
      : sourceKind === "latex"
    : undefined;
  // PGF's arrows.meta uses capitalized names. Retaining this distinction lets
  // the renderer apply arrows.meta-only keys without changing the classic
  // core `latex` and `stealth` tips.
  const meta = ["latex", "stealth"].includes(normalizedKind)
    ? Object.hasOwn(overrides, "meta")
      ? overrides.meta === true
      : normalizedKind === "latex"
        ? !legacy
        : sourceKind === "Stealth"
    : normalizedKind === "square"
      ? Object.hasOwn(overrides, "meta")
        ? overrides.meta === true
        : sourceKind === "Square" || sourceKind === "Rectangle"
      : ["straight-barb", "arc-barb", "tee-barb"].includes(normalizedKind)
        ? Object.hasOwn(overrides, "meta")
          ? overrides.meta === true
          : true
      : undefined;
  return {
    ...base,
    ...overrides,
    kind: normalizedKind,
    // PGF's core `latex` and arrows.meta's `Latex` are distinct tips. Keep
    // the source spelling so their geometry can stay distinct downstream.
    ...(normalizedKind === "latex" ? { legacy } : {}),
    ...(["latex", "stealth", "square", "straight-barb", "arc-barb", "tee-barb"].includes(normalizedKind) ? { meta } : {})
  };
}

function legacyArrowTipBase(kind) {
  if (/^latex-prime(?:-reversed)?$/u.test(kind)) {
    return { ...TIKZ_ARROW_TIPS.latex, fill: "context-stroke" };
  }
  if (/^stealth-prime(?:-reversed)?$/u.test(kind)) {
    return { ...TIKZ_ARROW_TIPS["stealth-prime"], fill: "context-stroke", stroke: "context-stroke" };
  }
  if (kind === "legacy-implies") {
    return { ...TIKZ_ARROW_TIPS.to, fill: "none", stroke: "context-stroke" };
  }
  if (/^triangle-(?:90|60|45)(?:-reversed)?$/u.test(kind)) {
    return { ...TIKZ_ARROW_TIPS.to, fill: "context-stroke", stroke: "context-stroke" };
  }
  if (/^open-triangle-(?:90|60|45)(?:-reversed)?$/u.test(kind)) {
    return TIKZ_ARROW_TIPS["open-triangle"];
  }
  if (/^legacy-spaced-triangle-(?:90|60|45)(?:-reversed)?$/u.test(kind)) {
    return { ...TIKZ_ARROW_TIPS.to, fill: "context-stroke", stroke: "context-stroke" };
  }
  if (/^legacy-spaced-open-triangle-(?:90|60|45)(?:-reversed)?$/u.test(kind)) {
    return TIKZ_ARROW_TIPS["open-triangle"];
  }
  if (/^legacy-spaced-angle-(?:90|60|45)(?:-reversed)?$/u.test(kind)) {
    return { ...TIKZ_ARROW_TIPS.to, fill: "none", stroke: "context-stroke" };
  }
  if (/^legacy-spaced-(?:(?:left|right)-hook|hooks)(?:-reversed)?$/u.test(kind)) {
    return { ...TIKZ_ARROW_TIPS.hook, fill: "none", stroke: "context-stroke" };
  }
  if (/^legacy-spaced-(?:left|right)-to(?:-reversed)?$/u.test(kind)) {
    return { ...TIKZ_ARROW_TIPS.to, fill: "none", stroke: "context-stroke" };
  }
  if (kind === "legacy-spaced-serif-cm") {
    return { ...TIKZ_ARROW_TIPS.to, fill: "context-stroke" };
  }
  if (/^legacy-spaced-(?:(?:square|round)-bracket(?:-reversed)?|bar)$/u.test(kind)) {
    return { ...TIKZ_ARROW_TIPS.bar, fill: "none", stroke: "context-stroke" };
  }
  if (/^legacy-spaced-(?:diamond|square|filled-circle)$/u.test(kind)) {
    const base = kind.endsWith("diamond") ? TIKZ_ARROW_TIPS.kite : kind.endsWith("square") ? TIKZ_ARROW_TIPS.square : TIKZ_ARROW_TIPS.circle;
    return { ...base, fill: "context-stroke", stroke: "context-stroke" };
  }
  if (/^legacy-spaced-(?:open-diamond|open-square|open-circle)$/u.test(kind)) {
    const base = kind.endsWith("diamond") ? TIKZ_ARROW_TIPS.kite : kind.endsWith("square") ? TIKZ_ARROW_TIPS.square : TIKZ_ARROW_TIPS["open-circle"];
    return { ...base, fill: "none", stroke: "context-stroke" };
  }
  if (kind === "legacy-bar") {
    return { ...TIKZ_ARROW_TIPS.bar, fill: "none", stroke: "context-stroke" };
  }
  if (kind === "legacy-diamond") {
    return { ...TIKZ_ARROW_TIPS.kite, fill: "context-stroke", stroke: "context-stroke" };
  }
  if (kind === "legacy-open-diamond") {
    return { ...TIKZ_ARROW_TIPS.kite, fill: "none", stroke: "context-stroke" };
  }
  if (kind === "legacy-square") {
    return { ...TIKZ_ARROW_TIPS.square, fill: "context-stroke", stroke: "context-stroke" };
  }
  if (kind === "legacy-open-square") {
    return { ...TIKZ_ARROW_TIPS.square, fill: "none", stroke: "context-stroke" };
  }
  if (kind === "legacy-filled-circle") {
    return { ...TIKZ_ARROW_TIPS.circle, fill: "context-stroke", stroke: "context-stroke" };
  }
  if (kind === "legacy-open-circle") {
    return { ...TIKZ_ARROW_TIPS["open-circle"], fill: "none", stroke: "context-stroke" };
  }
  if (/^legacy-(?:(?:left|right)-hook|hooks)(?:-reversed)?$/u.test(kind)) {
    return { ...TIKZ_ARROW_TIPS.hook, fill: "none", stroke: "context-stroke" };
  }
  if (/^legacy-(?:left|right)-to(?:-reversed)?$/u.test(kind)) {
    return { ...TIKZ_ARROW_TIPS.to, fill: "none", stroke: "context-stroke" };
  }
  if (kind === "legacy-serif-cm") {
    return { ...TIKZ_ARROW_TIPS.to, fill: "context-stroke" };
  }
  if (/^legacy-(?:round|butt)-cap$/u.test(kind)) {
    return { ...TIKZ_ARROW_TIPS.to, fill: "none", stroke: "context-stroke" };
  }
  if (/^legacy-(?:triangle-90|fast)-cap(?:-reversed)?$/u.test(kind)) {
    return { ...TIKZ_ARROW_TIPS.to, fill: "context-stroke" };
  }
  if (/^legacy-spaced-(?:round|butt)-cap$/u.test(kind)) {
    return { ...TIKZ_ARROW_TIPS.to, fill: "none", stroke: "context-stroke" };
  }
  if (/^legacy-spaced-(?:triangle-90|fast)-cap(?:-reversed)?$/u.test(kind)) {
    return { ...TIKZ_ARROW_TIPS.to, fill: "context-stroke" };
  }
  if (/^legacy-spaced-to(?:-reversed)?$/u.test(kind)) {
    return { ...TIKZ_ARROW_TIPS.to, fill: "none", stroke: "context-stroke" };
  }
  if (/^legacy-spaced-(?:latex(?:-prime)?|stealth)(?:-reversed)?$/u.test(kind)) {
    return { ...TIKZ_ARROW_TIPS.to, fill: "context-stroke" };
  }
  if (/^legacy-spaced-stealth-prime(?:-reversed)?$/u.test(kind)) {
    return { ...TIKZ_ARROW_TIPS.to, fill: "context-stroke", stroke: "context-stroke" };
  }
  if (kind === "legacy-spaced-implies") {
    return { ...TIKZ_ARROW_TIPS.to, fill: "none", stroke: "context-stroke" };
  }
  return undefined;
}

export function legacyLatexArrowGeometryFromLineWidth(lineWidth) {
  const unitsPerPt = lineWidthFromPt(1);
  const lineWidthPt = Math.max(0.01, Number(lineWidth) || TIKZ_LINE_WIDTHS.default) / unitsPerPt;
  // pgfcorearrows.code.tex: \pgfarrowsdeclare{latex}{latex}. The classic
  // arrow has one unit d = .28pt + .3 * linewidth, extends to 9d at its tip,
  // and reaches back to -d. Unlike arrows.meta's `Latex`, it has no scale key.
  const unit = lineWidthFromPt(0.28 + 0.3 * lineWidthPt);
  return {
    unit,
    back: 10 * unit,
    halfWidth: 3.75 * unit,
    shorten: 9 * unit
  };
}

export function latexSlimArrowGeometryFromLineWidth(lineWidth) {
  const unitsPerPt = lineWidthFromPt(1);
  const lineWidthPt = Math.max(0.01, Number(lineWidth) || TIKZ_LINE_WIDTHS.default) / unitsPerPt;
  // circuitikz/pgfcirc.defines.tex: \pgfarrowsdeclare{latexslim}{latexslim}.
  // The declaration has a pinched waist, reaches back to -4d, and extends
  // 6d past the path endpoint. It is qfill-only: no outline is painted.
  const unit = lineWidthFromPt(0.28 + 0.3 * lineWidthPt);
  return {
    unit,
    back: 10 * unit,
    halfWidth: 3.75 * unit,
    shorten: 6 * unit
  };
}

export function latexArrowGeometryFromLineWidth(lineWidth, scales = 1) {
  const unitsPerPt = lineWidthFromPt(1);
  const lineWidthPt = Math.max(0.01, Number(lineWidth) || TIKZ_LINE_WIDTHS.default) / unitsPerPt;
  const options = typeof scales === "object" && scales !== null ? scales : { scale: scales };
  const scaleFactor = (value) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 1;
  // pgfcorearrows.code.tex applies `scale` to both dimension lists. The
  // individual scale keys then act independently on the longitudinal length
  // (and inset) or on the width. An explicit width' is still based on the
  // final logical length unless a user replaces it with `width=...`.
  const generalScale = scaleFactor(options.scale);
  const lengthScale = generalScale * scaleFactor(options.lengthScale);
  const widthScale = generalScale * scaleFactor(options.widthScale);
  const explicitLengthPt = Number.isFinite(Number(options.lengthPt)) && Number(options.lengthPt) > 0
    ? Number(options.lengthPt)
    : null;
  const explicitWidthPt = Number.isFinite(Number(options.widthPt)) && Number(options.widthPt) > 0
    ? Number(options.widthPt)
    : null;
  const baseLengthPt = explicitLengthPt ?? (3 + 4.5 * lineWidthPt);
  const arrowLengthPt = baseLengthPt * lengthScale;
  const arrowWidthPt = (explicitWidthPt ?? (0.75 * baseLengthPt)) * widthScale;
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
    assemblyLength: lineWidthFromPt(arrowLengthPt),
    halfWidth: lineWidthFromPt(halfWidthPt),
    lineWidth: lineWidthFromPt(arrowLineWidthPt),
    shorten: length,
    // `Latex` is drawn relative to PGF's arrow assembly point, rather than
    // directly at the raw path terminal. The painted line stops at that base;
    // its visible point is one inner-tip length nearer the raw terminal. See
    // pgflibraryarrows.meta.code.tex's Latex setup and drawing code.
    terminalPlacement: lineWidthFromPt(arrowLengthPt - 0.5 * arrowLineWidthPt),
    tipPlacement: lineWidthFromPt(arrowLengthPt - 0.5 * arrowLineWidthPt - visibleLengthPt)
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

export function stealthMetaArrowGeometryFromLineWidth(lineWidth, scales = {}) {
  const unitsPerPt = lineWidthFromPt(1);
  const pathLineWidthPt = Math.max(0.01, Number(lineWidth) || TIKZ_LINE_WIDTHS.default) / unitsPerPt;
  const options = typeof scales === "object" && scales !== null ? scales : { scale: scales };
  const scaleFactor = (value) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 1;
  const generalScale = scaleFactor(options.scale);
  const lengthScale = generalScale * scaleFactor(options.lengthScale);
  const widthScale = generalScale * scaleFactor(options.widthScale);
  const explicitLengthPt = Number.isFinite(Number(options.lengthPt)) && Number(options.lengthPt) > 0
    ? Number(options.lengthPt)
    : null;
  const explicitWidthPt = Number.isFinite(Number(options.widthPt)) && Number(options.widthPt) > 0
    ? Number(options.widthPt)
    : null;
  const harpoon = options.harpoon === true;
  const reversed = options.reversed === true;
  const swap = options.swap === true;

  // pgflibraryarrows.meta.code.tex: Stealth defaults to
  // length=+3pt 4.5, width'=+0pt .75, inset'=+0pt .325. PGF applies the
  // longitudinal and transverse scale lists only after resolving width' and
  // inset' from the unscaled arrow length.
  const baseLengthPt = explicitLengthPt ?? (3 + 4.5 * pathLineWidthPt);
  const lengthPt = baseLengthPt * lengthScale;
  const widthPt = (explicitWidthPt ?? (0.75 * baseLengthPt)) * widthScale;
  const insetPt = 0.325 * baseLengthPt * lengthScale;
  const arrowLineWidthPt = Math.min(pathLineWidthPt, 0.25 * Math.max(0.01, lengthPt - insetPt));
  const halfWidthBeforeMiterPt = widthPt / 2;
  const safeWidthPt = Math.max(0.01, widthPt);
  const safeHalfWidthPt = Math.max(0.01, halfWidthBeforeMiterPt);

  const frontMiterPt = 0.5 * Math.hypot(2 * (lengthPt - insetPt) / safeWidthPt, 1) * arrowLineWidthPt;
  const outerAngle = Math.atan2(lengthPt, safeHalfWidthPt);
  const insetAngle = Math.atan2(insetPt, safeHalfWidthPt);
  const halfAngleDelta = (outerAngle - insetAngle) / 2;
  const backMiterRadiusPt = 0.5 * (1 / Math.max(1e-9, Math.tan(halfAngleDelta))) * arrowLineWidthPt;
  const backMiterAngle = insetAngle + halfAngleDelta;
  const backMiterPt = Math.sin(backMiterAngle) * backMiterRadiusPt;
  const topMiterPt = Math.cos(backMiterAngle) * backMiterRadiusPt;
  const insetMiterPt = 0.5 * Math.hypot(2 * insetPt / safeWidthPt, 1) * arrowLineWidthPt;
  const innerLengthPt = Math.max(0, lengthPt - frontMiterPt - backMiterPt);
  const halfWidthPt = Math.max(0, halfWidthBeforeMiterPt - topMiterPt);
  const adjustedInsetPt = insetPt + insetMiterPt;
  const insetDistancePt = Math.max(0, lengthPt - frontMiterPt - adjustedInsetPt);
  const harpoonMiterPt = (lengthPt / safeWidthPt) * arrowLineWidthPt;
  // The local Stealth setup code uses three different line ends. A harpoon
  // joins at the exposed half tip; a reversed tip joins at its other end.
  const lineEndPt = harpoon
    ? adjustedInsetPt + 0.5 * arrowLineWidthPt
    : reversed
      ? innerLengthPt + backMiterPt - 0.25 * arrowLineWidthPt
      : adjustedInsetPt - 0.25 * arrowLineWidthPt;
  const tipEndPt = lengthPt + (harpoon ? harpoonMiterPt : 0);
  const shortenPt = Math.max(0, tipEndPt - lineEndPt);

  return {
    length: lineWidthFromPt(innerLengthPt),
    assemblyLength: lineWidthFromPt(lengthPt),
    halfWidth: lineWidthFromPt(halfWidthPt),
    insetDistance: lineWidthFromPt(insetDistancePt),
    lineWidth: lineWidthFromPt(arrowLineWidthPt),
    shorten: lineWidthFromPt(shortenPt),
    terminalPlacement: lineWidthFromPt(shortenPt),
    // PGF draws the arrow in a local coordinate system shifted by -tipend.
    // The visible point is therefore one front miter behind the raw terminal.
    placement: lineWidthFromPt(reversed ? lengthPt - frontMiterPt : frontMiterPt),
    visualSpan: lineWidthFromPt(lengthPt - insetPt),
    harpoon,
    reversed,
    swap
  };
}

export function straightBarbArrowGeometryFromLineWidth(lineWidth, arrowOptions = {}) {
  const unitsPerPt = lineWidthFromPt(1);
  const pathLineWidth = Math.max(0.01, Number(lineWidth) || TIKZ_LINE_WIDTHS.default);
  const pathLineWidthPt = pathLineWidth / unitsPerPt;
  const innerLineWidthPt = Math.max(0, Number(arrowOptions.innerLineWidth) || 0) / unitsPerPt;
  const scaleFactor = (value) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 1;
  const lengthScale = scaleFactor(arrowOptions.scale) * scaleFactor(arrowOptions.lengthScale);
  const widthScale = scaleFactor(arrowOptions.scale) * scaleFactor(arrowOptions.widthScale);

  // pgfcorearrows.code.tex resolves the two trailing parameters against the
  // current full stroke. The third parameter only changes double lines.
  const lineWidthDependent = (spec, fallback) => {
    const resolved = spec || fallback;
    const dimensionPt = (Number(resolved.dimension) || 0) / unitsPerPt;
    const factor = Number(resolved.lineWidthFactor) || 0;
    const outerFactor = Number(resolved.outerFactor) || 0;
    const effectiveLineWidthPt = innerLineWidthPt > 0
      ? pathLineWidthPt * (1 - outerFactor / 2) - innerLineWidthPt * outerFactor / 2
      : pathLineWidthPt;
    return dimensionPt + factor * effectiveLineWidthPt;
  };
  const lengthDependent = (spec, fallback, lengthPt) => {
    const resolved = spec || fallback;
    return (Number(resolved.dimension) || 0) / unitsPerPt
      + (Number(resolved.lineWidthFactor) || 0) * lengthPt
      + (Number(resolved.outerFactor) || 0) * pathLineWidthPt;
  };

  // pgflibraryarrows.meta.code.tex, Straight Barb defaults:
  // length=+1.5pt 2, width'=+0pt 2, line width=+0pt 1 1.
  const baseLengthPt = lineWidthDependent(arrowOptions.lengthSpec, {
    dimension: lineWidthFromPt(1.5),
    lineWidthFactor: 2,
    outerFactor: 0
  });
  const baseWidthPt = arrowOptions.widthPrimeSpec
    ? lengthDependent(arrowOptions.widthPrimeSpec, null, baseLengthPt)
    : arrowOptions.widthSpec
      ? lineWidthDependent(arrowOptions.widthSpec, null)
      : 2 * baseLengthPt;
  const arrowLineWidthPt = arrowOptions.lineWidthPrimeSpec
    ? lengthDependent(arrowOptions.lineWidthPrimeSpec, null, baseLengthPt)
    : lineWidthDependent(arrowOptions.lineWidthSpec, {
        dimension: 0,
        lineWidthFactor: 1,
        outerFactor: 1
      });
  const lengthPt = Math.max(0.01, baseLengthPt * lengthScale);
  const widthPt = Math.max(0.01, baseWidthPt * widthScale);
  const tipLineWidthPt = Math.max(0.01, arrowLineWidthPt);
  const harpoon = arrowOptions.harpoon === true;
  const reversed = arrowOptions.reversed === true;
  const swap = arrowOptions.swap === true;
  const roundCap = arrowOptions.roundCap === true;
  const roundJoin = arrowOptions.roundJoin === true;
  const slant = Number.isFinite(Number(arrowOptions.slant)) ? Number(arrowOptions.slant) : 0;
  const quotient = lengthPt / widthPt;
  const frontMiterPt = 0.5 * tipLineWidthPt * Math.sqrt(1 + 4 * quotient * quotient);
  const harpoonMiterPt = quotient * tipLineWidthPt;

  const forwardTipEndPt = roundJoin
    ? lengthPt + tipLineWidthPt / 2
    : lengthPt + frontMiterPt + (harpoon ? harpoonMiterPt : 0);
  const forwardBackEndPt = -tipLineWidthPt / 2;
  const forwardVisualTipEndPt = forwardTipEndPt;
  const forwardVisualBackEndPt = lengthPt + tipLineWidthPt / 2;
  const forwardLineEndPt = reversed
    ? lengthPt + (harpoon ? tipLineWidthPt / 2 : 0)
    : lengthPt - tipLineWidthPt / 2;
  const tipEndPt = reversed ? -forwardBackEndPt : forwardTipEndPt;
  const backEndPt = reversed ? -forwardTipEndPt : forwardBackEndPt;
  const visualTipEndPt = reversed ? -forwardVisualBackEndPt : forwardVisualTipEndPt;
  const visualBackEndPt = reversed ? -forwardVisualTipEndPt : forwardVisualBackEndPt;
  const visualSpanPt = visualTipEndPt - visualBackEndPt;
  const lineEndPt = reversed ? -forwardLineEndPt : forwardLineEndPt;

  const transformPoint = ({ x, y }) => {
    let transformedX = reversed ? -x : x;
    let transformedY = swap ? -y : y;
    transformedX += slant * transformedY;
    return {
      x: lineWidthFromPt(transformedX),
      y: lineWidthFromPt(transformedY)
    };
  };
  const finalHarpoonXPt = lengthPt + (reversed ? tipLineWidthPt : -tipLineWidthPt);
  const points = [
    { x: 0, y: widthPt / 2 },
    { x: lengthPt, y: 0 },
    harpoon ? { x: finalHarpoonXPt, y: 0 } : { x: 0, y: -widthPt / 2 }
  ].map(transformPoint);

  const hullFirstXPt = roundJoin
    ? lengthPt + tipLineWidthPt / 2
    : lengthPt + frontMiterPt + harpoonMiterPt;
  const upperHull = [
    { x: hullFirstXPt, y: harpoon ? -tipLineWidthPt / 2 : 0 },
    { x: tipLineWidthPt / 2, y: widthPt / 2 + tipLineWidthPt / 2 },
    { x: -tipLineWidthPt / 2, y: widthPt / 2 + tipLineWidthPt / 2 }
  ];
  const hull = [...upperHull];
  if (!harpoon) hull.push(...upperHull.map(({ x, y }) => ({ x, y: -y })));
  if (harpoon) hull.push({ x: -tipLineWidthPt / 2, y: -tipLineWidthPt / 2 });
  const transformedHull = hull.map(transformPoint);
  const bounds = transformedHull.reduce((result, point) => ({
    minX: Math.min(result.minX, point.x),
    minY: Math.min(result.minY, -point.y),
    maxX: Math.max(result.maxX, point.x),
    maxY: Math.max(result.maxY, -point.y)
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

  const tipEnd = lineWidthFromPt(tipEndPt);
  const backEnd = lineWidthFromPt(backEndPt);
  const lineEnd = lineWidthFromPt(lineEndPt);
  return {
    length: lineWidthFromPt(lengthPt),
    width: lineWidthFromPt(widthPt),
    lineWidth: lineWidthFromPt(tipLineWidthPt),
    tipEnd,
    backEnd,
    visualTipEnd: lineWidthFromPt(visualTipEndPt),
    visualBackEnd: lineWidthFromPt(visualBackEndPt),
    visualSpan: lineWidthFromPt(visualSpanPt),
    lineEnd,
    terminalPlacement: tipEnd - lineEnd,
    placement: tipEnd,
    assemblyLength: tipEnd - backEnd,
    points,
    bounds,
    strokeBoundsIncluded: true,
    lineCap: roundCap ? "round" : "butt",
    lineJoin: roundJoin ? "round" : "miter",
    harpoon,
    reversed,
    swap,
    slant
  };
}

export function arcBarbArrowGeometryFromLineWidth(lineWidth, arrowOptions = {}) {
  const unitsPerPt = lineWidthFromPt(1);
  const pathLineWidth = Math.max(0.01, Number(lineWidth) || TIKZ_LINE_WIDTHS.default);
  const pathLineWidthPt = pathLineWidth / unitsPerPt;
  const innerLineWidthPt = Math.max(0, Number(arrowOptions.innerLineWidth) || 0) / unitsPerPt;
  const scaleFactor = (value) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 1;
  const lengthScale = scaleFactor(arrowOptions.scale) * scaleFactor(arrowOptions.lengthScale);
  const widthScale = scaleFactor(arrowOptions.scale) * scaleFactor(arrowOptions.widthScale);
  const lineWidthDependent = (spec, fallback) => {
    const resolved = spec || fallback;
    const dimensionPt = (Number(resolved.dimension) || 0) / unitsPerPt;
    const factor = Number(resolved.lineWidthFactor) || 0;
    const outerFactor = Number(resolved.outerFactor) || 0;
    const effectiveLineWidthPt = innerLineWidthPt > 0
      ? pathLineWidthPt * (1 - outerFactor / 2) - innerLineWidthPt * outerFactor / 2
      : pathLineWidthPt;
    return dimensionPt + factor * effectiveLineWidthPt;
  };
  const lengthDependent = (spec, fallback, lengthPt) => {
    const resolved = spec || fallback;
    return (Number(resolved.dimension) || 0) / unitsPerPt
      + (Number(resolved.lineWidthFactor) || 0) * lengthPt
      + (Number(resolved.outerFactor) || 0) * pathLineWidthPt;
  };

  // pgflibraryarrows.meta.code.tex: Arc Barb uses the same dependent defaults
  // as Straight Barb, then subtracts half a tip stroke from each drawing
  // radius after its logical ends and convex hull have been recorded.
  const baseLengthPt = lineWidthDependent(arrowOptions.lengthSpec, {
    dimension: lineWidthFromPt(1.5),
    lineWidthFactor: 2,
    outerFactor: 0
  });
  const baseWidthPt = arrowOptions.widthPrimeSpec
    ? lengthDependent(arrowOptions.widthPrimeSpec, null, baseLengthPt)
    : arrowOptions.widthSpec
      ? lineWidthDependent(arrowOptions.widthSpec, null)
      : 2 * baseLengthPt;
  const arrowLineWidthPt = arrowOptions.lineWidthPrimeSpec
    ? lengthDependent(arrowOptions.lineWidthPrimeSpec, null, baseLengthPt)
    : lineWidthDependent(arrowOptions.lineWidthSpec, {
        dimension: 0,
        lineWidthFactor: 1,
        outerFactor: 1
      });
  const lengthPt = Math.max(0.01, baseLengthPt * lengthScale);
  const widthPt = Math.max(0.01, baseWidthPt * widthScale);
  const tipLineWidthPt = Math.max(0.01, arrowLineWidthPt);
  const arc = Number.isFinite(Number(arrowOptions.arc)) ? Number(arrowOptions.arc) : 180;
  const halfArc = arc / 2;
  const halfArcRadians = halfArc * Math.PI / 180;
  const cosine = Math.cos(halfArcRadians);
  const sine = Math.sin(halfArcRadians);
  const harpoon = arrowOptions.harpoon === true;
  const reversed = arrowOptions.reversed === true;
  const swap = arrowOptions.swap === true;
  const roundCap = arrowOptions.roundCap === true;
  const roundJoin = arrowOptions.roundJoin === true;
  const slant = Number.isFinite(Number(arrowOptions.slant)) ? Number(arrowOptions.slant) : 0;

  const forwardTipEndPt = lengthPt;
  const forwardVisualTipEndPt = lengthPt;
  const forwardVisualBackEndPt = lengthPt;
  const forwardLineEndPt = lengthPt - tipLineWidthPt / 2;
  const forwardBackEndPt = roundCap
    ? cosine * (lengthPt - tipLineWidthPt / 2) - tipLineWidthPt / 2
    : cosine * (lengthPt - (halfArc < 90 ? tipLineWidthPt : 0));
  const tipEndPt = reversed ? -forwardBackEndPt : forwardTipEndPt;
  const backEndPt = reversed ? -forwardTipEndPt : forwardBackEndPt;
  const visualTipEndPt = reversed ? -forwardVisualBackEndPt : forwardVisualTipEndPt;
  const visualBackEndPt = reversed ? -forwardVisualTipEndPt : forwardVisualBackEndPt;
  const lineEndPt = reversed ? -forwardLineEndPt : forwardLineEndPt;

  const transformPointPt = ({ x, y }) => {
    let transformedX = reversed ? -x : x;
    let transformedY = swap ? -y : y;
    transformedX += slant * transformedY;
    return { x: lineWidthFromPt(transformedX), y: lineWidthFromPt(transformedY) };
  };
  const hull = [];
  const addHullPoint = (x, y) => hull.push({ x, y });
  const addUpperHullPoint = (x, y) => {
    addHullPoint(x, y);
    if (y > 0 && !harpoon) addHullPoint(x, -y);
  };
  addUpperHullPoint(lengthPt, widthPt / 4);
  if (harpoon) addHullPoint(lengthPt, -pathLineWidthPt / 2);
  addUpperHullPoint(cosine * lengthPt, sine * widthPt / 2);
  if (halfArc > 60) {
    addUpperHullPoint(lengthPt / 2, halfArc < 90 ? sine * widthPt / 2 : widthPt / 2);
  }
  if (halfArc > 90) {
    if (halfArc < 120) {
      addUpperHullPoint(cosine * lengthPt, widthPt / 2);
    } else {
      addUpperHullPoint(-lengthPt / 2, widthPt / 2);
      if (halfArc > 150) addUpperHullPoint(-lengthPt, widthPt / 4);
    }
  }
  if (halfArc < 90 || harpoon) {
    addUpperHullPoint(
      cosine * (lengthPt - tipLineWidthPt),
      sine * (widthPt / 2 - tipLineWidthPt)
    );
  }
  const transformedHull = hull.map(transformPointPt);
  const bounds = transformedHull.reduce((result, point) => ({
    minX: Math.min(result.minX, point.x),
    minY: Math.min(result.minY, -point.y),
    maxX: Math.max(result.maxX, point.x),
    maxY: Math.max(result.maxY, -point.y)
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

  const drawRadiusXPt = Math.max(0.005, lengthPt - tipLineWidthPt / 2);
  const drawRadiusYPt = Math.max(0.005, (widthPt - tipLineWidthPt) / 2);
  const startAngle = halfArcRadians;
  const endAngle = harpoon ? 0 : -halfArcRadians;
  const ellipsePoint = (angle) => ({ x: drawRadiusXPt * Math.cos(angle), y: drawRadiusYPt * Math.sin(angle) });
  const ellipseDerivative = (angle) => ({ x: -drawRadiusXPt * Math.sin(angle), y: drawRadiusYPt * Math.cos(angle) });
  const segments = [];
  let angle0 = startAngle;
  while (Math.abs(endAngle - angle0) > 1e-12 || segments.length === 0) {
    const remaining = endAngle - angle0;
    const absoluteDegrees = Math.abs(remaining) * 180 / Math.PI;
    const stepDegrees = absoluteDegrees > 90
      ? absoluteDegrees > 115 ? 90 : 60
      : absoluteDegrees;
    const angleStep = Math.sign(remaining || -1) * stepDegrees * Math.PI / 180;
    const angle1 = angle0 + angleStep;
    const point0 = ellipsePoint(angle0);
    const point1 = ellipsePoint(angle1);
    const derivative0 = ellipseDerivative(angle0);
    const derivative1 = ellipseDerivative(angle1);
    const factorMagnitude = Math.abs(stepDegrees - 90) < 1e-9
      ? 0.55228475
      : 1.333333333 * Math.tan(stepDegrees * Math.PI / 720);
    const factor = Math.sign(angleStep || -1) * factorMagnitude;
    segments.push({
      start: transformPointPt(point0),
      control1: transformPointPt({ x: point0.x + factor * derivative0.x, y: point0.y + factor * derivative0.y }),
      control2: transformPointPt({ x: point1.x - factor * derivative1.x, y: point1.y - factor * derivative1.y }),
      end: transformPointPt(point1)
    });
    angle0 = angle1;
  }
  const axialPoint = harpoon
    ? transformPointPt({
        x: drawRadiusXPt + (reversed ? tipLineWidthPt / 2 : -tipLineWidthPt / 2),
        y: 0
      })
    : null;

  const tipEnd = lineWidthFromPt(tipEndPt);
  const backEnd = lineWidthFromPt(backEndPt);
  const lineEnd = lineWidthFromPt(lineEndPt);
  return {
    length: lineWidthFromPt(lengthPt),
    width: lineWidthFromPt(widthPt),
    lineWidth: lineWidthFromPt(tipLineWidthPt),
    arc,
    halfArc,
    tipEnd,
    backEnd,
    visualTipEnd: lineWidthFromPt(visualTipEndPt),
    visualBackEnd: lineWidthFromPt(visualBackEndPt),
    visualSpan: lineWidthFromPt(visualTipEndPt - visualBackEndPt),
    lineEnd,
    terminalPlacement: tipEnd - lineEnd,
    placement: tipEnd,
    assemblyLength: tipEnd - backEnd,
    segments,
    axialPoint,
    bounds,
    strokeBoundsIncluded: true,
    lineCap: roundCap ? "round" : "butt",
    lineJoin: roundJoin ? "round" : "miter",
    harpoon,
    reversed,
    swap,
    slant
  };
}

export function teeBarbArrowGeometryFromLineWidth(lineWidth, arrowOptions = {}) {
  const unitsPerPt = lineWidthFromPt(1);
  const pathLineWidth = Math.max(0.01, Number(lineWidth) || TIKZ_LINE_WIDTHS.default);
  const pathLineWidthPt = pathLineWidth / unitsPerPt;
  const innerLineWidthPt = Math.max(0, Number(arrowOptions.innerLineWidth) || 0) / unitsPerPt;
  const scaleFactor = (value) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 1;
  const lengthScale = scaleFactor(arrowOptions.scale) * scaleFactor(arrowOptions.lengthScale);
  const widthScale = scaleFactor(arrowOptions.scale) * scaleFactor(arrowOptions.widthScale);
  const lineWidthDependent = (spec, fallback) => {
    const resolved = spec || fallback;
    const dimensionPt = (Number(resolved.dimension) || 0) / unitsPerPt;
    const factor = Number(resolved.lineWidthFactor) || 0;
    const outerFactor = Number(resolved.outerFactor) || 0;
    const effectiveLineWidthPt = innerLineWidthPt > 0
      ? pathLineWidthPt * (1 - outerFactor / 2) - innerLineWidthPt * outerFactor / 2
      : pathLineWidthPt;
    return dimensionPt + factor * effectiveLineWidthPt;
  };
  const lengthDependent = (spec, fallback, lengthPt) => {
    const resolved = spec || fallback;
    return (Number(resolved.dimension) || 0) / unitsPerPt
      + (Number(resolved.lineWidthFactor) || 0) * lengthPt
      + (Number(resolved.outerFactor) || 0) * pathLineWidthPt;
  };

  const baseLengthPt = lineWidthDependent(arrowOptions.lengthSpec, {
    dimension: lineWidthFromPt(1.5),
    lineWidthFactor: 2,
    outerFactor: 0
  });
  const baseWidthPt = arrowOptions.widthPrimeSpec
    ? lengthDependent(arrowOptions.widthPrimeSpec, null, baseLengthPt)
    : lineWidthDependent(arrowOptions.widthSpec, {
        dimension: lineWidthFromPt(3),
        lineWidthFactor: 4,
        outerFactor: 0
      });
  const baseInsetPt = arrowOptions.insetPrimeSpec
    ? lengthDependent(arrowOptions.insetPrimeSpec, null, baseLengthPt)
    : arrowOptions.insetSpec
      ? lineWidthDependent(arrowOptions.insetSpec, null)
      : 0.5 * baseLengthPt;
  const arrowLineWidthPt = arrowOptions.lineWidthPrimeSpec
    ? lengthDependent(arrowOptions.lineWidthPrimeSpec, null, baseLengthPt)
    : lineWidthDependent(arrowOptions.lineWidthSpec, {
        dimension: 0,
        lineWidthFactor: 1,
        outerFactor: 1
      });
  const lengthPt = Math.max(0, baseLengthPt * lengthScale);
  const widthPt = Math.max(0.01, baseWidthPt * widthScale);
  const insetPt = baseInsetPt * lengthScale;
  const tipLineWidthPt = Math.max(0.01, arrowLineWidthPt);
  const harpoon = arrowOptions.harpoon === true;
  const reversed = arrowOptions.reversed === true;
  const swap = arrowOptions.swap === true;
  const roundCap = arrowOptions.roundCap === true;
  const roundJoin = arrowOptions.roundJoin === true;
  const slant = Number.isFinite(Number(arrowOptions.slant)) ? Number(arrowOptions.slant) : 0;

  const rawFrontPt = lengthPt - insetPt;
  const rawBackPt = -insetPt;
  const frontClamped = rawFrontPt < tipLineWidthPt / 2;
  const backClamped = rawBackPt > -tipLineWidthPt / 2;
  const frontPt = frontClamped ? tipLineWidthPt / 2 : rawFrontPt;
  const backPt = backClamped ? -tipLineWidthPt / 2 : rawBackPt;
  const forwardTipEndPt = frontPt + (roundCap && !frontClamped ? tipLineWidthPt / 2 : 0);
  const forwardBackEndPt = backPt - (roundCap && !backClamped ? tipLineWidthPt / 2 : 0);
  const forwardVisualTipEndPt = forwardTipEndPt;
  const forwardVisualBackEndPt = tipLineWidthPt / 2;
  const tipEndPt = reversed ? -forwardBackEndPt : forwardTipEndPt;
  const backEndPt = reversed ? -forwardTipEndPt : forwardBackEndPt;
  const visualTipEndPt = reversed ? -forwardVisualBackEndPt : forwardVisualTipEndPt;
  const visualBackEndPt = reversed ? -forwardVisualTipEndPt : forwardVisualBackEndPt;
  // Setup compensates for core reversal, leaving the final line end at -t/4.
  const lineEndPt = -tipLineWidthPt / 4;

  const transformPointPt = ({ x, y }) => {
    let transformedX = reversed ? -x : x;
    let transformedY = swap ? -y : y;
    transformedX += slant * transformedY;
    return { x: lineWidthFromPt(transformedX), y: lineWidthFromPt(transformedY) };
  };
  const hull = [
    { x: forwardTipEndPt, y: widthPt / 2 },
    { x: forwardBackEndPt, y: widthPt / 2 }
  ];
  if (harpoon) {
    hull.push({ x: tipLineWidthPt / 2, y: -pathLineWidthPt / 2 });
  } else {
    hull.push(
      { x: forwardTipEndPt, y: -widthPt / 2 },
      { x: forwardBackEndPt, y: -widthPt / 2 }
    );
  }
  const transformedHull = hull.map(transformPointPt);
  const bounds = transformedHull.reduce((result, point) => ({
    minX: Math.min(result.minX, point.x),
    minY: Math.min(result.minY, -point.y),
    maxX: Math.max(result.maxX, point.x),
    maxY: Math.max(result.maxY, -point.y)
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

  const topPt = widthPt / 2 - tipLineWidthPt / 2;
  const bottomPt = harpoon ? -pathLineWidthPt / 2 : -widthPt / 2 + tipLineWidthPt / 2;
  const pathsPt = [];
  if (Math.abs((frontPt - tipLineWidthPt / 2) - (backPt + tipLineWidthPt / 2)) < 1e-9) {
    pathsPt.push([{ x: 0, y: widthPt / 2 }, { x: 0, y: harpoon ? -pathLineWidthPt / 2 : -widthPt / 2 }]);
  } else if (frontClamped) {
    const path = [{ x: backPt, y: topPt }, { x: 0, y: topPt }, { x: 0, y: bottomPt }];
    if (!harpoon) path.push({ x: backPt, y: -widthPt / 2 + tipLineWidthPt / 2 });
    pathsPt.push(path);
  } else {
    pathsPt.push([{ x: backPt, y: topPt }, { x: frontPt, y: topPt }]);
    pathsPt.push([{ x: 0, y: topPt }, { x: 0, y: bottomPt }]);
    if (!harpoon) pathsPt.push([{ x: backPt, y: -widthPt / 2 + tipLineWidthPt / 2 }, { x: frontPt, y: -widthPt / 2 + tipLineWidthPt / 2 }]);
  }
  const paths = pathsPt.map((path) => path.map(transformPointPt));

  const tipEnd = lineWidthFromPt(tipEndPt);
  const backEnd = lineWidthFromPt(backEndPt);
  const lineEnd = lineWidthFromPt(lineEndPt);
  return {
    length: lineWidthFromPt(lengthPt),
    width: lineWidthFromPt(widthPt),
    inset: lineWidthFromPt(insetPt),
    lineWidth: lineWidthFromPt(tipLineWidthPt),
    front: lineWidthFromPt(frontPt),
    back: lineWidthFromPt(backPt),
    frontClamped,
    backClamped,
    tipEnd,
    backEnd,
    visualTipEnd: lineWidthFromPt(visualTipEndPt),
    visualBackEnd: lineWidthFromPt(visualBackEndPt),
    visualSpan: lineWidthFromPt(visualTipEndPt - visualBackEndPt),
    lineEnd,
    terminalPlacement: tipEnd - lineEnd,
    placement: tipEnd,
    assemblyLength: tipEnd - backEnd,
    paths,
    bounds,
    strokeBoundsIncluded: true,
    lineCap: roundCap ? "round" : "butt",
    lineJoin: roundJoin ? "round" : "miter",
    harpoon,
    reversed,
    swap,
    slant
  };
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
  const normalizedPrime = source.match(/^(latex|stealth)-prime(-reversed)?$/iu);
  if (normalizedPrime) {
    return `${normalizedPrime[1].toLowerCase()}-prime${normalizedPrime[2] ? "-reversed" : ""}`;
  }
  if (/^implies$/iu.test(source)) return "legacy-implies";
  if (/^spaced\s+implies$/iu.test(source)) return "legacy-spaced-implies";
  const spacedLegacy = source.match(/^spaced (to|latex'?|stealth'?)( reversed)?$/u);
  if (spacedLegacy) {
    const prime = spacedLegacy[1].endsWith("'") ? "-prime" : "";
    const family = spacedLegacy[1].replace("'", "");
    return `legacy-spaced-${family}${prime}${spacedLegacy[2] ? "-reversed" : ""}`;
  }
  const ordinaryPrime = source.match(/^(latex|stealth)\s*'(?:\s+(reversed))?$/iu);
  if (ordinaryPrime) {
    return `${ordinaryPrime[1].toLowerCase()}-prime${ordinaryPrime[2] ? "-reversed" : ""}`;
  }
  const text = source.replace(/'/g, "").toLowerCase();
  if (text === "legacy-implies") return text;
  if (/^legacy-(?:(?:left|right)-hook|hooks)(?:-reversed)?$/u.test(text)) return text;
  if (/^legacy-(?:left|right)-to(?:-reversed)?$/u.test(text)) return text;
  if (text === "legacy-serif-cm") return text;
  if (/^legacy-(?:(?:round|butt)-cap|(?:triangle-90|fast)-cap(?:-reversed)?)$/u.test(text)) return text;
  if (/^legacy-spaced-(?:(?:round|butt)-cap|(?:triangle-90|fast)-cap(?:-reversed)?)$/u.test(text)) return text;
  if (/^legacy-spaced-(?:to|latex(?:-prime)?|stealth(?:-prime)?)(?:-reversed)?$/u.test(text)) return text;
  if (/^legacy-spaced-(?:open-)?triangle-(?:90|60|45)(?:-reversed)?$/u.test(text)) return text;
  if (/^legacy-spaced-angle-(?:90|60|45)(?:-reversed)?$/u.test(text)) return text;
  if (/^legacy-spaced-(?:(?:left|right)-hook|hooks)(?:-reversed)?$/u.test(text)) return text;
  if (/^legacy-spaced-(?:left|right)-to(?:-reversed)?$/u.test(text)) return text;
  if (text === "legacy-spaced-serif-cm") return text;
  if (/^legacy-spaced-(?:(?:square|round)-bracket(?:-reversed)?|bar)$/u.test(text)) return text;
  if (text === "legacy-bar") return text;
  if (/^legacy-spaced-(?:open-circle|filled-circle|diamond|open-diamond|square|open-square)$/u.test(text)) return text;
  if (text === "legacy-spaced-implies") return text;
  if (source === "Round Cap") return "round-cap";
  if (source === "Butt Cap") return "butt-cap";
  if (source === "Triangle Cap") return "triangle-cap";
  if (source === "Fast Triangle") return "fast-triangle";
  if (source === "Fast Round") return "fast-round";
  if (text === "square bracket" || text === "[") return "square-bracket";
  if (text === "square bracket reversed" || text === "]") return "square-bracket-reversed";
  if (text === "(" || text === "round bracket reversed") return "round-bracket-reversed";
  if (text === ")" || text === "round bracket") return "round-bracket";
  if (text === "|") return "legacy-bar";
  if (text === "spaced [") return "legacy-spaced-square-bracket";
  if (text === "spaced ]") return "legacy-spaced-square-bracket-reversed";
  if (text === "spaced (") return "legacy-spaced-round-bracket-reversed";
  if (text === "spaced )") return "legacy-spaced-round-bracket";
  if (text === "spaced |") return "legacy-spaced-bar";
  if (text === "spaced o") return "legacy-spaced-open-circle";
  if (text === "spaced *") return "legacy-spaced-filled-circle";
  if (text === "spaced diamond") return "legacy-spaced-diamond";
  if (text === "spaced open diamond") return "legacy-spaced-open-diamond";
  if (text === "spaced square") return "legacy-spaced-square";
  if (text === "spaced open square") return "legacy-spaced-open-square";
  if (text === "spaced serif cm") return "legacy-spaced-serif-cm";
  const legacyAngle = text.match(/^angle\s+(90|60|45)(\s+reversed)?$/);
  if (legacyAngle) return `angle-${legacyAngle[1]}${legacyAngle[2] ? "-reversed" : ""}`;
  const legacyTriangle = text.match(/^(open\s+)?triangle\s+(90|60|45)(\s+reversed)?$/);
  if (legacyTriangle) {
    return `${legacyTriangle[1] ? "open-" : ""}triangle-${legacyTriangle[2]}${legacyTriangle[3] ? "-reversed" : ""}`;
  }
  const spacedTriangle = text.match(/^spaced\s+(open\s+)?triangle\s+(90|60|45)(\s+reversed)?$/u);
  if (spacedTriangle) {
    return `legacy-spaced-${spacedTriangle[1] ? "open-" : ""}triangle-${spacedTriangle[2]}${spacedTriangle[3] ? "-reversed" : ""}`;
  }
  const spacedAngle = text.match(/^spaced\s+angle\s+(90|60|45)(\s+reversed)?$/u);
  if (spacedAngle) {
    return `legacy-spaced-angle-${spacedAngle[1]}${spacedAngle[2] ? "-reversed" : ""}`;
  }
  const spacedHook = text.match(/^spaced\s+(?:(left|right)\s+hook|hooks)(\s+reversed)?$/u);
  if (spacedHook) {
    const base = spacedHook[1] ? `${spacedHook[1]}-hook` : "hooks";
    return `legacy-spaced-${base}${spacedHook[2] ? "-reversed" : ""}`;
  }
  const spacedSideTo = text.match(/^spaced\s+(left|right)\s+to(\s+reversed)?$/u);
  if (spacedSideTo) {
    return `legacy-spaced-${spacedSideTo[1]}-to${spacedSideTo[2] ? "-reversed" : ""}`;
  }
  if (source === "Diamond") return "kite";
  if (text === "diamond") return "legacy-diamond";
  if (text === "open diamond") return "legacy-open-diamond";
  if (source === "Square" || source === "Rectangle") return "square";
  if (text === "square") return "legacy-square";
  if (text === "open square") return "legacy-open-square";
  if (source === "Circle") return "circle";
  if (source === "Open Circle") return "open-circle";
  if (source === "*") return "legacy-filled-circle";
  if (source === "o") return "legacy-open-circle";
  if (source === "Hook" || source === "Hooks") return "hook";
  const legacyHook = text.match(/^(?:(left|right)\s+hook|hooks)(\s+reversed)?$/u);
  if (legacyHook) {
    const base = legacyHook[1] ? `${legacyHook[1]}-hook` : "hooks";
    return `legacy-${base}${legacyHook[2] ? "-reversed" : ""}`;
  }
  const legacySideTo = text.match(/^(left|right)\s+to(\s+reversed)?$/u);
  if (legacySideTo) {
    return `legacy-${legacySideTo[1]}-to${legacySideTo[2] ? "-reversed" : ""}`;
  }
  if (text === "serif cm") return "legacy-serif-cm";
  const legacyCap = source.match(/^(round cap|butt cap|triangle 90 cap(?: reversed)?|fast cap(?: reversed)?)$/u);
  if (legacyCap) return `legacy-${legacyCap[1].replaceAll(" ", "-")}`;
  const spacedCap = source.match(/^spaced (round cap|butt cap|triangle 90 cap(?: reversed)?|fast cap(?: reversed)?)$/u);
  if (spacedCap) return `legacy-spaced-${spacedCap[1].replaceAll(" ", "-")}`;
  if (text === "dimline reverse" || text === "dimline-reverse") return "dimline reverse";
  if (text === "dimline") return "dimline";
  if (text === "stealth-prime") return "stealth-prime";
  if (text === "latexslim" || text === "latex slim") return "latexslim";
  if (text === "straight barb" || text === "straight-barb") return "straight-barb";
  if (text === "arc barb" || text === "arc-barb" || text === "parenthesis") return "arc-barb";
  if (text === "tee barb" || text === "tee-barb" || source === "Bar" || source === "Bracket") return "tee-barb";
  if (text === "kite") return "kite";
  if (text === "rectangle") return "square";
  if (text === "rays" || text === "ray") return "rays";
  if (text.includes("two heads") || text.includes("two-heads") || text.includes("double")) return "two-heads";
  if (text.includes("open circle")) return "open-circle";
  if (text === "circle") return "circle";
  if (text.includes("open triangle")) return "open-triangle";
  if (text.includes("bar")) return "bar";
  if (text.includes("hook")) return "hook";
  if (text.includes("stealth")) return "stealth";
  if (text.includes("latex")) return "latex";
  if (text.includes("to")) return "to";
  return text === ">" ? "to" : text || "to";
}
