import { lineWidthFromPt } from "../metrics.js";
import { legacyCapArrowMetrics } from "./arrows.js";

export const tikzLibrary = {
  name: "arrows.spaced",
  status: "partial",
  implementedBy: "src/tikz/libraries/arrows.spaced.js:legacySpacedArrowSpace/spacedCapArrowMetrics/spacedLegacyArrowMetrics + src/engine/options.js:parseArrowOption + src/tikz/metrics.js:createArrowTip/legacyArrowTipBase/normalizeArrowKind + src/renderers/svg/paths.js:inlineArrowGeometry/legacyCapInlineGeometry/spacedLegacyArrowInlineGeometry",
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
    "source backend and tip-end metrics for common legacy arrows",
    "legacy space arrow width 0.88pt plus 0.3 line widths",
    "shared cap geometry with additional endpoint shortening"
  ],
  notes: "Reviewed locally on 2026-09-04. pgflibraryarrows.spaced.code.tex declares each spaced arrow with the starred combine form `original[sep=0pt].space`. The dot fixes the line end after the visible tip; the invisible `space` arrow from pgfcorearrows.code.tex has backend 0 and tip end 0.88pt+0.3*linewidth. TikZKit first implemented the six cap aliases by reusing their source paths and adding this width to terminal placement, shaft shortening, and assembly length. A second source review added spaced to, latex, latex prime, stealth, and stealth prime plus all reversed forms. The common-arrow geometry preserves the exact PGF backend/tip-end formulas, the independent to-reversed cubic, generic x-reflection for the other reversed tips, fill/stroke behavior, and the active arrow line width. Flowchart, mathematical-map, and physical-vector fixtures cover straight, orthogonal, diagonal, bidirectional, and curved terminal tangents with MacTeX and tikztosvg references. Spaced implies, triangle/open-triangle, hooks, shapes, brackets, and serif-cm aliases remain unsupported."
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
