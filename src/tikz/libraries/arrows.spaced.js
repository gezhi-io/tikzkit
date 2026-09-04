import { lineWidthFromPt } from "../metrics.js";
import {
  legacyCapArrowMetrics,
  legacyCircleArrowMetrics,
  legacyDelimiterArrowMetrics,
  legacyDiamondArrowMetrics,
  legacyHookArrowMetrics,
  legacyImpliesArrowMetrics,
  legacySerifCmArrowMetrics,
  legacySideToArrowMetrics,
  legacySquareArrowMetrics,
  legacyTriangleArrowMetrics
} from "./arrows.js";

export const tikzLibrary = {
  name: "arrows.spaced",
  status: "builtin",
  implementedBy: "src/tikz/libraries/arrows.spaced.js:legacySpacedArrowSpace/spacedCapArrowMetrics/spacedLegacyArrowMetrics/spacedImpliesArrowMetrics/spacedTriangleArrowMetrics/spacedAngleArrowMetrics/spacedHookArrowMetrics/spacedSideToArrowMetrics/spacedSerifCmArrowMetrics/spacedDelimiterArrowMetrics/spacedShapeArrowMetrics + src/tikz/libraries/arrows.js:legacyDelimiterArrowMetrics/legacyCircleArrowMetrics/legacyDiamondArrowMetrics/legacySquareArrowMetrics/legacySideToArrowMetrics/legacyImpliesArrowMetrics/legacySerifCmArrowMetrics + src/engine/options.js:parseArrowOption + src/tikz/metrics.js:createArrowTip/legacyArrowTipBase/normalizeArrowKind + src/renderers/svg/paths.js:inlineArrowGeometry/legacyDelimiterInlineGeometry/legacyTriangleInlineGeometry/legacyHookInlineGeometry/legacySideToInlineGeometry/legacyImpliesArrowInlineGeometry/legacySerifCmInlineGeometry/legacyCapInlineGeometry/legacyCircleInlineGeometry/legacyDiamondInlineGeometry/legacySquareInlineGeometry/spacedLegacyArrowInlineGeometry/renderInlineArrowTip",
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.spaced.code.tex",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-arrows.tex",
  localSourceReviewed: true,
  features: [
    "spaced round cap",
    "spaced butt cap",
    "spaced triangle 90 cap and reversed form",
    "spaced fast cap and reversed form",
    "spaced to and spaced to reversed",
    "spaced latex and latex prime with reversed forms",
    "spaced stealth and stealth prime with reversed forms",
    "spaced implies with outer and inner line-width metrics",
    "spaced triangle 90, 60, and 45 with reversed forms",
    "spaced open triangle 90, 60, and 45 with reversed forms",
    "spaced angle 90, 60, and 45 with reversed forms",
    "spaced left hook, right hook, and hooks with reversed forms",
    "spaced left to and right to with reversed forms",
    "spaced serif cm with source fill-only silhouette",
    "spaced square brackets, round brackets, and vertical bars",
    "spaced filled/open circles, diamonds, and squares",
    "source backend and tip-end metrics for common legacy arrows",
    "legacy space arrow width 0.88pt plus 0.3 line widths",
    "shared cap geometry with additional endpoint shortening"
  ],
  implements: [
    "spaced round cap",
    "spaced butt cap",
    "spaced triangle 90 cap and reversed form",
    "spaced fast cap and reversed form",
    "spaced to and spaced to reversed",
    "spaced latex and latex prime with reversed forms",
    "spaced stealth and stealth prime with reversed forms",
    "spaced implies with outer and inner line-width metrics",
    "spaced triangle 90, 60, and 45 with reversed forms",
    "spaced open triangle 90, 60, and 45 with reversed forms",
    "spaced angle 90, 60, and 45 with reversed forms",
    "spaced left hook, right hook, and hooks with reversed forms",
    "spaced left to and right to with reversed forms",
    "spaced serif cm with source fill-only silhouette",
    "spaced square brackets, round brackets, and vertical bars",
    "spaced filled/open circles, diamonds, and squares",
    "source backend and tip-end metrics for common legacy arrows",
    "legacy space arrow width 0.88pt plus 0.3 line widths",
    "shared cap geometry with additional endpoint shortening"
  ],
  notes: "Reviewed locally on 2026-09-04. pgflibraryarrows.spaced.code.tex declares each spaced arrow with the starred combine form `original[sep=0pt].space`. The dot fixes the line end after the visible tip; the invisible `space` arrow from pgfcorearrows.code.tex has backend 0 and tip end 0.88pt+0.3*linewidth. TikZKit first implemented the six cap aliases by reusing their source paths and adding this width to terminal placement, shaft shortening, and assembly length. A second source review added spaced to, latex, latex prime, stealth, and stealth prime plus all reversed forms. A third source review added spaced implies from pgflibraryarrows.code.tex. A fourth added all twelve spaced triangle and spaced open triangle 90/60/45 aliases. A fifth added the six spaced angle aliases. A sixth added spaced left hook, spaced right hook, spaced hooks, and reversed forms. A seventh review added `spaced [`, `spaced ]`, `spaced (`, `spaced )`, and `spaced |`, including all five paired shorthand specifications. Square and round bracket geometry reuses the source active-line-width formulas. The bar now follows `@bar`: backend -0.25 line widths, tip end 0.75 line widths, vertical path at 0.25 line widths, half-height 2pt+1.5 line widths, and a square cap. An eighth review added `spaced o`, `spaced *`, `spaced diamond`, `spaced open diamond`, `spaced square`, and `spaced open square`: each reuses the exact base geometry, fill/stroke semantics, cap/join, and line-width-dependent extents, while only the invisible space increases placement and assembly length. A ninth review added `spaced left to`, `spaced right to`, and reversed variants. They reuse the exact reflected half-arrow and multi-part reversed paint from arrows, then add only the invisible space to placement and assembly length. Flowchart, mathematical-map, and physical-vector fixtures cover straight, orthogonal, diagonal, bidirectional, and curved terminal tangents with MacTeX and tikztosvg references. Spaced serif-cm remains unsupported."
};

tikzLibrary.notes = tikzLibrary.notes.replace(
  "Spaced serif-cm remains unsupported.",
  "A tenth review added `spaced serif cm`, reusing the base d=.4pt+.45*linewidth closed cubic silhouette and adding only the invisible space to placement and assembly length. The 55 declarations in the installed arrows.spaced source are now represented. Flowchart, mathematical-map, and physical-vector fixtures provide strict semantic and MacTeX/tikztosvg visual evidence."
);

export function legacySpacedArrowSpace(lineWidth) {
  const unitsPerPt = lineWidthFromPt(1);
  const lineWidthPt = Math.max(0.01, Number(lineWidth) || lineWidthFromPt(0.4)) / unitsPerPt;
  return lineWidthFromPt(0.88 + 0.3 * lineWidthPt);
}

export function spacedCapArrowMetrics(kind, lineWidth) {
  const source = String(kind || "").trim().toLowerCase();
  const match = source.match(/^legacy-spaced-(round|butt|triangle-90|fast)-cap(-reversed)?$/u);
  if (!match) return null;

  const baseKind = `legacy-${match[1]}-cap${match[2] || ""}`;
  const base = legacyCapArrowMetrics(baseKind, lineWidth);
  if (!base) return null;

  const space = legacySpacedArrowSpace(lineWidth);
  return {
    ...base,
    spaced: true,
    space,
    placement: base.placement + space,
    terminalPlacement: base.terminalPlacement + space,
    assemblyLength: base.assemblyLength + space
  };
}

export function spacedTriangleArrowMetrics(kind, lineWidth) {
  const source = String(kind || "").trim().toLowerCase();
  const match = source.match(/^legacy-spaced-(open-)?triangle-(90|60|45)(-reversed)?$/u);
  if (!match) return null;

  const baseKind = `${match[1] || ""}triangle-${match[2]}${match[3] || ""}`;
  const base = legacyTriangleArrowMetrics(baseKind, lineWidth);
  if (!base) return null;

  const space = legacySpacedArrowSpace(lineWidth);
  return {
    ...base,
    spaced: true,
    space,
    placement: base.placement + space,
    terminalPlacement: base.placement + space,
    assemblyLength: base.assemblyLength + space
  };
}

export function spacedAngleArrowMetrics(kind, lineWidth) {
  const source = String(kind || "").trim().toLowerCase();
  const match = source.match(/^legacy-spaced-angle-(90|60|45)(-reversed)?$/u);
  if (!match) return null;

  const baseKind = `angle-${match[1]}${match[2] || ""}`;
  const base = legacyDelimiterArrowMetrics(baseKind, lineWidth);
  if (!base) return null;

  const space = legacySpacedArrowSpace(lineWidth);
  return {
    ...base,
    spaced: true,
    space,
    placement: base.placement + space,
    terminalPlacement: base.placement + space,
    assemblyLength: base.assemblyLength + space
  };
}

export function spacedHookArrowMetrics(kind, lineWidth) {
  const source = String(kind || "").trim().toLowerCase();
  const match = source.match(/^legacy-spaced-((?:left|right)-hook|hooks)(-reversed)?$/u);
  if (!match) return null;

  const baseKind = `legacy-${match[1]}${match[2] || ""}`;
  const base = legacyHookArrowMetrics(baseKind, lineWidth);
  if (!base) return null;

  const space = legacySpacedArrowSpace(lineWidth);
  return {
    ...base,
    spaced: true,
    space,
    placement: base.placement + space,
    terminalPlacement: base.placement + space,
    assemblyLength: base.assemblyLength + space
  };
}

export function spacedSideToArrowMetrics(kind, lineWidth) {
  const source = String(kind || "").trim().toLowerCase();
  const match = source.match(/^legacy-spaced-(left|right)-to(-reversed)?$/u);
  if (!match) return null;

  const base = legacySideToArrowMetrics(`legacy-${match[1]}-to${match[2] || ""}`, lineWidth);
  if (!base) return null;

  const space = legacySpacedArrowSpace(lineWidth);
  return {
    ...base,
    spaced: true,
    space,
    placement: base.placement + space,
    terminalPlacement: base.terminalPlacement + space,
    assemblyLength: base.assemblyLength + space
  };
}

export function spacedSerifCmArrowMetrics(kind, lineWidth) {
  if (String(kind || "").trim().toLowerCase() !== "legacy-spaced-serif-cm") return null;

  const base = legacySerifCmArrowMetrics("legacy-serif-cm", lineWidth);
  const space = legacySpacedArrowSpace(lineWidth);
  return {
    ...base,
    spaced: true,
    space,
    placement: base.placement + space,
    terminalPlacement: base.terminalPlacement + space,
    assemblyLength: base.assemblyLength + space
  };
}

export function spacedDelimiterArrowMetrics(kind, lineWidth) {
  const source = String(kind || "").trim().toLowerCase();
  const match = source.match(/^legacy-spaced-((?:square|round)-bracket)(-reversed)?$/u);
  const baseKind = match ? `${match[1]}${match[2] || ""}` : source === "legacy-spaced-bar" ? "legacy-bar" : "";
  if (!baseKind) return null;

  const base = legacyDelimiterArrowMetrics(baseKind, lineWidth);
  if (!base) return null;

  const space = legacySpacedArrowSpace(lineWidth);
  return {
    ...base,
    spaced: true,
    space,
    placement: base.placement + space,
    terminalPlacement: base.placement + space,
    assemblyLength: base.assemblyLength + space
  };
}

export function spacedShapeArrowMetrics(kind, lineWidth) {
  const source = String(kind || "").trim().toLowerCase();
  const match = source.match(/^legacy-spaced-(open-circle|filled-circle|diamond|open-diamond|square|open-square)$/u);
  if (!match) return null;

  const baseKind = `legacy-${match[1]}`;
  const base = match[1].endsWith("circle")
    ? legacyCircleArrowMetrics(baseKind, lineWidth)
    : match[1].endsWith("diamond")
      ? legacyDiamondArrowMetrics(baseKind, lineWidth)
      : legacySquareArrowMetrics(baseKind, lineWidth);
  if (!base) return null;

  const space = legacySpacedArrowSpace(lineWidth);
  return {
    ...base,
    spaced: true,
    space,
    placement: base.placement + space,
    terminalPlacement: base.placement + space,
    assemblyLength: base.assemblyLength + space
  };
}

export function spacedLegacyArrowMetrics(kind, lineWidth) {
  const match = String(kind || "").trim().toLowerCase()
    .match(/^legacy-spaced-(to|latex(?:-prime)?|stealth(?:-prime)?)(-reversed)?$/u);
  if (!match) return null;

  const family = match[1];
  const reversed = Boolean(match[2]);
  const unitsPerPt = lineWidthFromPt(1);
  const lineWidthPt = Math.max(0.01, Number(lineWidth) || lineWidthFromPt(0.4)) / unitsPerPt;
  const unitPt = 0.28 + 0.3 * lineWidthPt;
  const spacePt = 0.88 + 0.3 * lineWidthPt;
  const source = legacyArrowSourceMetrics(family, reversed, lineWidthPt, unitPt);
  if (!source) return null;

  const pt = (value) => lineWidthFromPt(value);
  return {
    family,
    reversed,
    unit: pt(unitPt),
    lineWidth: pt(lineWidthPt),
    arrowLineWidth: pt(source.arrowLineWidthPt),
    backEnd: pt(source.backEndPt),
    tipEnd: pt(source.tipEndPt),
    halfHeight: pt(source.halfHeightPt),
    space: pt(spacePt),
    placement: pt(source.tipEndPt + spacePt),
    terminalPlacement: pt(source.tipEndPt + spacePt),
    assemblyLength: pt(source.tipEndPt - source.backEndPt + spacePt)
  };
}

export function spacedImpliesArrowMetrics(kind, lineWidth, innerLineWidth = 0, doubled = false) {
  if (String(kind || "").trim().toLowerCase() !== "legacy-spaced-implies") return null;
  const base = legacyImpliesArrowMetrics("legacy-implies", lineWidth, innerLineWidth, doubled);
  const unitsPerPt = lineWidthFromPt(1);
  const space = lineWidthFromPt(0.88 + 0.3 * (base.outerLineWidth / unitsPerPt));

  return {
    ...base,
    space,
    placement: base.tipEnd + space,
    terminalPlacement: base.tipEnd + space,
    assemblyLength: base.tipEnd - base.backEnd + space
  };
}

function legacyArrowSourceMetrics(family, reversed, lineWidthPt, unitPt) {
  if (family === "to") {
    return reversed
      ? {
          backEndPt: -0.21 - 0.475 * lineWidthPt,
          tipEndPt: 0.98 + 1.45 * lineWidthPt,
          halfHeightPt: 4 * unitPt + 0.4 * lineWidthPt,
          arrowLineWidthPt: 0.8 * lineWidthPt
        }
      : {
          backEndPt: -0.84 - 1.3 * lineWidthPt,
          tipEndPt: 0.21 + 0.625 * lineWidthPt,
          halfHeightPt: 4 * unitPt + 0.4 * lineWidthPt,
          arrowLineWidthPt: 0.8 * lineWidthPt
        };
  }

  const source = family === "latex"
    ? { back: 1, tip: 9, halfHeight: 3.75, arrowLineWidthPt: 0 }
    : family === "latex-prime"
      ? { back: 4, tip: 6, halfHeight: 3.75, arrowLineWidthPt: 0 }
      : family === "stealth"
        ? { back: 3, tip: 5, halfHeight: 4, arrowLineWidthPt: 0 }
        : family === "stealth-prime"
          ? {
              back: 6,
              tip: 2,
              halfHeight: 3.25,
              extentStrokePt: 0.5 * lineWidthPt,
              arrowLineWidthPt: lineWidthPt
            }
          : null;
  if (!source) return null;

  const extentStrokePt = source.extentStrokePt || 0;
  const backPt = source.back * unitPt + extentStrokePt;
  const tipPt = source.tip * unitPt + extentStrokePt;
  return {
    backEndPt: -(reversed ? tipPt : backPt),
    tipEndPt: reversed ? backPt : tipPt,
    halfHeightPt: source.halfHeight * unitPt + extentStrokePt,
    arrowLineWidthPt: source.arrowLineWidthPt
  };
}
