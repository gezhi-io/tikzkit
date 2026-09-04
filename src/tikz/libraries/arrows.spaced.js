import { lineWidthFromPt } from "../metrics.js";
import {
  legacyCapArrowMetrics,
  legacyDelimiterArrowMetrics,
  legacyHookArrowMetrics,
  legacyTriangleArrowMetrics
} from "./arrows.js";

export const tikzLibrary = {
  name: "arrows.spaced",
  status: "partial",
  implementedBy: "src/tikz/libraries/arrows.spaced.js:legacySpacedArrowSpace/spacedCapArrowMetrics/spacedLegacyArrowMetrics/spacedImpliesArrowMetrics/spacedTriangleArrowMetrics/spacedAngleArrowMetrics/spacedHookArrowMetrics + src/engine/options.js:parseArrowOption + src/tikz/metrics.js:createArrowTip/legacyArrowTipBase/normalizeArrowKind + src/renderers/svg/paths.js:inlineArrowGeometry/legacyDelimiterInlineGeometry/legacyTriangleInlineGeometry/legacyHookInlineGeometry/legacyCapInlineGeometry/spacedLegacyArrowInlineGeometry/spacedImpliesArrowInlineGeometry",
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
    "source backend and tip-end metrics for common legacy arrows",
    "legacy space arrow width 0.88pt plus 0.3 line widths",
    "shared cap geometry with additional endpoint shortening"
  ],
  notes: "Reviewed locally on 2026-09-04. pgflibraryarrows.spaced.code.tex declares each spaced arrow with the starred combine form `original[sep=0pt].space`. The dot fixes the line end after the visible tip; the invisible `space` arrow from pgfcorearrows.code.tex has backend 0 and tip end 0.88pt+0.3*linewidth. TikZKit first implemented the six cap aliases by reusing their source paths and adding this width to terminal placement, shaft shortening, and assembly length. A second source review added spaced to, latex, latex prime, stealth, and stealth prime plus all reversed forms. A third review added spaced implies from pgflibraryarrows.code.tex: its open cubic uses both pgflinewidth and pgfinnerlinewidth, so double paths derive the effective outer width as twice the requested line width plus double distance while preserving the inner gap. A fourth review added all twelve spaced triangle and spaced open triangle 90/60/45 aliases. Their visible geometry, source-specific reversed extents, fillstroke versus stroke-only paint, miter joins, and butt caps reuse the reviewed legacy declarations, while terminal placement and assembly length include the invisible space component at the active line width. A fifth review added the six spaced angle 90/60/45 aliases and their reversed forms. They reuse the source angle aperture and active-line-width stroke geometry with round caps and miter joins, then append the same invisible space component. A sixth review added spaced left hook, spaced right hook, spaced hooks, and all reversed forms. Their exact source Bezier controls, one-sided or double-sided aperture, x-only reversal, stroke-only paint, round caps, and miter joins are preserved while endpoint placement includes the invisible space. Flowchart, mathematical-map, and physical-vector fixtures cover straight, orthogonal, diagonal, bidirectional, and curved terminal tangents with MacTeX and tikztosvg references. Spaced shapes, brackets, and serif-cm aliases remain unsupported."
};

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

  const unitsPerPt = lineWidthFromPt(1);
  const requestedLineWidth = Math.max(0.01, Number(lineWidth) || lineWidthFromPt(0.4));
  const inner = doubled
    ? Math.max(0, Number.isFinite(Number(innerLineWidth)) ? Number(innerLineWidth) : lineWidthFromPt(0.6))
    : 0;
  const outer = doubled ? 2 * requestedLineWidth + inner : requestedLineWidth;
  const outerPt = outer / unitsPerPt;
  const innerPt = inner / unitsPerPt;

  // pgflibraryarrows.code.tex defines the implies unit and paint width from
  // both the outer and inner strokes. This is why a double shaft produces a
  // larger outline while its arrow stroke stays at the requested line width.
  const dimaPt = 0.25 * (outerPt + innerPt);
  const dimbPt = 0.5 * (outerPt - innerPt);
  const spacePt = 0.88 + 0.3 * outerPt;
  const backEndPt = -1.36 * dimaPt - 0.5 * dimbPt;
  const tipEndPt = 2.06 * dimaPt + 0.5 * dimbPt;
  const halfHeightPt = 2.65 * dimaPt + 0.5 * dimbPt;
  const pt = (value) => lineWidthFromPt(value);

  return {
    family: "implies",
    dima: pt(dimaPt),
    dimb: pt(dimbPt),
    outerLineWidth: outer,
    innerLineWidth: inner,
    arrowLineWidth: pt(dimbPt),
    backEnd: pt(backEndPt),
    tipEnd: pt(tipEndPt),
    halfHeight: pt(halfHeightPt),
    space: pt(spacePt),
    placement: pt(tipEndPt + spacePt),
    terminalPlacement: pt(tipEndPt + spacePt),
    assemblyLength: pt(tipEndPt - backEndPt + spacePt)
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
