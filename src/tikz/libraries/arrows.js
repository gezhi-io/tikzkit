import { evaluateMath, parseDimension } from "../../engine/math.js";
import { splitTopLevel } from "../../engine/options.js";
import { lineWidthFromPt, TIKZ_UNIT } from "../metrics.js";

export const tikzLibrary = {
  "name": "arrows",
  "status": "partial",
  "implementedBy": "src/tikz/libraries/arrows.js:lowerDeclaredArrowTips/parseLegacyArrowExtents/legacyDelimiterArrowMetrics/legacyTriangleArrowMetrics/legacyDiamondArrowMetrics/legacySquareArrowMetrics/legacyCircleArrowMetrics/legacyHookArrowMetrics/legacySideToArrowMetrics/legacyImpliesArrowMetrics/legacySerifCmArrowMetrics/legacyCapArrowMetrics + src/engine/options.js:parseArrowOption + src/tikz/metrics.js:createArrowTip/legacyArrowTipBase/legacyLatexArrowGeometryFromLineWidth/normalizeArrowKind + src/renderers/svg/paths.js:inlineArrowGeometry/legacyDelimiterInlineGeometry/legacyTriangleInlineGeometry/legacyDiamondInlineGeometry/legacySquareInlineGeometry/legacyCircleInlineGeometry/legacyHookInlineGeometry/legacySideToInlineGeometry/legacyImpliesArrowInlineGeometry/legacySerifCmInlineGeometry/renderInlineArrowTip + src/frontend/latex-shell.js:expandTheoreticalComputerScienceLogoMacros + src/engine/evaluate.js:curveArrowTerminalBorderPadding/nodeBorderPoint/polygonBorderPointWithPadding/regularPolygonOuterRadiusExtension",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-arrows.tex",
  "localSourceReviewed": true,
  "features": [
    "->",
    "<-",
    "<->",
    "-stealth",
    "-latex",
    "core latex distinct from arrows.meta Latex",
    "-latex'",
    "legacy delimiter tips: square bracket, round bracket, [, ], (, and )",
    "legacy angle 90, angle 60, and angle 45 tips with reversed forms",
    "legacy triangle 90, triangle 60, triangle 45, and open triangle tips with reversed forms",
    "legacy triangle fillstroke versus open-triangle stroke paint semantics",
    "legacy diamond and open diamond tips at path starts and ends",
    "legacy diamond fillstroke versus open-diamond stroke paint semantics",
    "legacy square, open square, filled dot *, and open dot o tips at path starts and ends",
    "legacy square/dot fillstroke versus open-tip stroke paint semantics",
    "legacy left hook, left hook reversed, right hook, right hook reversed, hooks, and hooks reversed tips at path starts and ends",
    "legacy hook active-line-width cubic geometry, asymmetric shortening, stroke-only paint, and round caps",
    "legacy left to, right to, and reversed half-arrow tips with source multi-part paint",
    "legacy implies open cubic with outer/inner line-width geometry",
    "legacy serif cm fill-only silhouette with source active-line-width dimensions",
    "legacy round cap, butt cap, triangle 90 cap, triangle 90 cap reversed, fast cap, and fast cap reversed tips at path starts and ends",
    "legacy cap active-line-width geometry, source paint semantics, and backend/tip-end shortening",
    "active-line-width legacy tip geometry and backend/tipend shaft shortening",
    "user-declared arrow tips with pgfpoint move/line/cubic/arc paths",
    "focused \\pgfarrowsdeclare{leaf}{leaf} TCS logo expansion",
    "curved terminal arrow crops on circular, elliptical, regular-polygon, rectangle, diamond, star, and trapezium nodes, including focused convex polygon-corner miters"
  ],
  "implements": [
    "->",
    "<-",
    "<->",
    "-stealth",
    "-latex",
    "core latex distinct from arrows.meta Latex",
    "-latex'",
    "legacy delimiter tips: square bracket, round bracket, [, ], (, and )",
    "legacy angle 90, angle 60, and angle 45 tips with reversed forms",
    "legacy triangle 90, triangle 60, triangle 45, and open triangle tips with reversed forms",
    "legacy triangle fillstroke versus open-triangle stroke paint semantics",
    "legacy diamond and open diamond tips at path starts and ends",
    "legacy diamond fillstroke versus open-diamond stroke paint semantics",
    "legacy square, open square, filled dot *, and open dot o tips at path starts and ends",
    "legacy square/dot fillstroke versus open-tip stroke paint semantics",
    "legacy left hook, left hook reversed, right hook, right hook reversed, hooks, and hooks reversed tips at path starts and ends",
    "legacy hook active-line-width cubic geometry, asymmetric shortening, stroke-only paint, and round caps",
    "legacy left to, right to, and reversed half-arrow tips with source multi-part paint",
    "legacy implies open cubic with outer/inner line-width geometry",
    "legacy serif cm fill-only silhouette with source active-line-width dimensions",
    "legacy round cap, butt cap, triangle 90 cap, triangle 90 cap reversed, fast cap, and fast cap reversed tips at path starts and ends",
    "legacy cap active-line-width geometry, source paint semantics, and backend/tip-end shortening",
    "active-line-width legacy tip geometry and backend/tipend shaft shortening",
    "user-declared arrow tips with pgfpoint move/line/cubic/arc paths",
    "focused \\pgfarrowsdeclare{leaf}{leaf} TCS logo expansion",
    "curved terminal arrow crops on circular, elliptical, regular-polygon, rectangle, diamond, star, and trapezium nodes, including focused convex polygon-corner miters"
  ],
  "notes": "Reviewed locally on 2026-08-06: pgfcorearrows declares lower-case latex as a filled core tip with d=.28pt+.3*linewidth, a 9d tip extent, and no arrows.meta scale key. TikZKit preserves this separately from arrows.meta Latex. It also supports a renderer-neutral subset of \\pgfarrowsdeclare: constant pgfpoint move/line/cubic/arc commands plus qfill, qstroke, or qfillstroke. Literal legacy \\pgfarrowsleftextend/\\pgfarrowsrightextend and \\pgfarrowssetlineend values control stem shortening without inflating the PGF picture box. Setup-code expressions, clipping, arrow hulls, arbitrary TeX macros, and declaration-time line-width arithmetic remain deferred. On 2026-08-07, curved to/edge arrows with terminal tips gained a half-active-line-width extension outside circular and elliptical endpoint crops. The same border-padding path now supports regular polygons using the local PGF outer-separation mitre rule and the target side normal. The focused 2026-08-07 trapezium slice intersects the fully mitered offset convex polygon contour, avoiding the prior arbitrary adjacent-side choice at a shared corner. `arrows-shape-curved-terminal-miters` is the permanent visual driver. On 2026-09-04, built-in arrows.meta sequences gained source-derived per-tip separation; the arrows.meta registry records that shared capability. Also on 2026-09-04, pgflibraryarrows.code.tex and pgfcorearrows.code.tex were reviewed for the legacy delimiter slice: square/round brackets and angle 90/60/45, including reversed spellings, now use the source formulas for active-line-width aperture, backend, tip end, cap/join, and shaft shortening. The flowchart, number-line, and force-vector fixtures are strict semantic and three-reference visual drivers. A second 2026-09-04 source review covered the filled and open triangle 90/60/45 families. TikZKit now applies d=.5pt+.25*linewidth, source-specific aperture and backend/tipend formulas, fillstroke for filled tips, stroke-only rendering for open tips, and the independently declared reversed open-tip extents. The repair-flow, mathematical-map, and free-body fixtures are strict semantic and MacTeX/tikztosvg visual drivers. A third 2026-09-04 review covered the public legacy diamond and open diamond declarations. TikZKit now preserves lower-case diamond separately from arrows.meta Diamond, applies d=.4pt+.275*linewidth, source-specific backend/tipend shortening, round joins with butt caps, fillstroke for diamond, and stroke-only rendering for open diamond at either path end. The validation-flow, mathematical-map, and vector fixtures are strict semantic and MacTeX/tikztosvg visual drivers. A fourth 2026-09-04 review covered square, open square, filled dot `*`, and open dot `o`. TikZKit now applies the source formulas d=.4pt+.275*linewidth for squares and d=.4pt+.2*linewidth for dots, keeps lower-case legacy names distinct from arrows.meta Square/Circle, and uses each declaration's backend/tipend, paint, cap, join, and local reference origin. The release-flow, quotient-map, and vector-field fixtures are strict semantic and MacTeX/tikztosvg visual drivers. A fifth 2026-09-04 review covered left hook, right hook, hooks, and their reversed declarations. TikZKit now applies d=.4pt+.2*linewidth, the exact 0.75/2.415/3.75 and 1.665/3/4.665/6 cubic factors, asymmetric backend/tipend placement, x-only reversal, stroke-only paint, round caps, and miter joins. The validation-flow, mathematical-map, and vector fixtures are strict semantic and MacTeX/tikztosvg visual drivers. A sixth 2026-09-04 review covered round cap, butt cap, triangle 90 cap and reversed, and fast cap and reversed. TikZKit now applies the declaration's active-line-width-only dimensions, distinct stroke-only versus fill-only paint, round versus butt caps, exact reversed polygons, and backend/tip-end shaft shortening. The flowchart, mathematical-map, and force-vector fixtures are strict semantic and MacTeX/tikztosvg visual drivers. A seventh source review on 2026-09-04 added left to, right to, and both reversed forms. Their d=.28pt+.3*linewidth geometry, 0.8-line-width round cubic paint, reflected half planes, declaration extents, and reversed full-width butt-cap stem now match local PGF. The SVG renderer supports declaration-specific multi-part arrow paint. Legacy implies, serif cm, concave/custom shape miters, and full declared-arrow hulls remain partial."
};

tikzLibrary.notes = tikzLibrary.notes.replace(
  "Legacy implies, serif cm, concave/custom shape miters, and full declared-arrow hulls remain partial.",
  "An eighth review implemented `serif cm`: d=.4pt+.45*linewidth, backend=-.75d, tip end and x shift=.04*linewidth, and the exact closed fill-only cubic silhouette. Ordinary and spaced serif-cm tips share that geometry; the spaced form adds only the core space arrow. Flowchart, quotient-map, and force-vector fixtures provide strict semantic and MacTeX/tikztosvg visual evidence. Legacy implies, concave/custom shape miters, and full declared-arrow hulls remain partial."
);

tikzLibrary.notes = tikzLibrary.notes.replace(
  "Setup-code expressions, clipping, arrow hulls, arbitrary TeX macros, and declaration-time line-width arithmetic remain deferred.",
  "Clipping, arrow hulls, saved-register callbacks, and arbitrary TeX control flow inside declaration programs remain deferred."
);

tikzLibrary.notes = tikzLibrary.notes.replace(
  "Legacy implies, concave/custom shape miters, and full declared-arrow hulls remain partial.",
  "A ninth source review implemented ordinary `implies`. Its dima=.25*(outer linewidth+inner linewidth), dimb=.5*(outer linewidth-inner linewidth), backend=-1.36*dima-.5*dimb, tip end=2.06*dima+.5*dimb, and symmetric two-cubic open stroke now share one source-derived metrics path with `spaced implies`; only the latter adds the core invisible space. Flowchart, proposition, and physical-feedback fixtures cover straight, orthogonal, curved, start, end, and bidirectional terminals against MacTeX and tikztosvg. Concave/custom shape miters and full declared-arrow hulls remain partial."
);

tikzLibrary.implementedBy += " + src/tikz/libraries/arrows.js:legacyPrimeArrowMetrics + src/tikz/metrics.js:normalizeArrowKind + src/renderers/svg/paths.js:legacyPrimeArrowInlineGeometry + src/engine/evaluate.js:arrowTipShortenCoordinateLength";
tikzLibrary.features.push(
  "legacy latex prime and latex prime reversed source cubic geometry and fill-only paint",
  "legacy stealth prime and stealth prime reversed source cubic geometry and fillstroke paint",
  "legacy prime backend/tip-end shaft shortening at path starts and ends"
);
tikzLibrary.implements.push(
  "legacy latex prime and latex prime reversed source cubic geometry and fill-only paint",
  "legacy stealth prime and stealth prime reversed source cubic geometry and fillstroke paint",
  "legacy prime backend/tip-end shaft shortening at path starts and ends"
);
tikzLibrary.notes += " A tenth source review on 2026-09-05 covered ordinary `latex'`, `latex' reversed`, `stealth'`, and `stealth' reversed`. TikZKit now preserves all four names, applies d=.28pt+.3*linewidth, reflects reversed cubic paths, uses fill-only paint for latex prime and active-line-width fillstroke with round joins for stealth prime, and shortens each shaft by the declaration's terminal tip end. Flowchart, mathematical-map, and physical-vector fixtures cover straight, orthogonal, curved, start, end, and bidirectional terminals against MacTeX and tikztosvg. Concave/custom shape miters and full declared-arrow hulls remain partial.";

tikzLibrary.implementedBy += " + src/tikz/libraries/arrows.js:resolveDeclaredArrowGeometry/evaluateDeclaredDimensionProgram/evaluateDeclaredDimension/declaredArrowDrawingStyle + src/renderers/svg/paths.js:resolveInlineArrowTip/renderInlineArrowTip";
tikzLibrary.features.push(
  "user-declared arrow dimension registers, assignment, and advance with active pgflinewidth",
  "user-declared dynamic backend, line-end, and tip-end dimensions",
  "user-declared pgfpoint and pgfqpoint paths with declaration cap, join, and paint semantics"
);
tikzLibrary.implements.push(
  "user-declared arrow dimension registers, assignment, and advance with active pgflinewidth",
  "user-declared dynamic backend, line-end, and tip-end dimensions",
  "user-declared pgfpoint and pgfqpoint paths with declaration cap, join, and paint semantics"
);
tikzLibrary.notes += " An eleventh source review on 2026-09-05 generalized user-declared arrows beyond literal dimensions. Setup and drawing programs now evaluate `\\pgfutil@tempdima`/`tempdimb` assignments and `\\advance`, substitute the active `\\pgflinewidth`, and resolve `\\pgfpoint`/`\\pgfqpoint` coordinates at render time. Dynamic backend, line-end, and tip-end dimensions shorten the shaft; qfill, qstroke, qfillstroke, butt/round caps, and miter/round joins retain declaration paint semantics. The adaptive process, open-map, and force fixtures are strict semantic and MacTeX/tikztosvg visual drivers. Arbitrary TeX branches/macros, hull and clipping commands, saved-register callbacks, point addition, and polar point expressions remain partial.";

tikzLibrary.implementedBy += " + src/tikz/libraries/arrows.js:parsePgfPoint/readPgfCommandArguments/splitPolarRadii";
tikzLibrary.features.push(
  "user-declared recursive pgfpointadd vector expressions",
  "user-declared pgfqpointpolar degree-angle points",
  "user-declared pgfpointpolar circular and elliptical radii"
);
tikzLibrary.implements.push(
  "user-declared recursive pgfpointadd vector expressions",
  "user-declared pgfqpointpolar degree-angle points",
  "user-declared pgfpointpolar circular and elliptical radii"
);
tikzLibrary.notes = tikzLibrary.notes.replace(
  "Arbitrary TeX branches/macros, hull and clipping commands, saved-register callbacks, point addition, and polar point expressions remain partial.",
  "A twelfth source review on 2026-09-05 implemented recursive `\\pgfpointadd`, quick `\\pgfqpointpolar`, and ordinary `\\pgfpointpolar` with one radius or independent `x radius and y radius`. Angles use PGF's degree convention, nested points share the declaration's active-line-width dimension registers, and the resulting local paths retain declaration paint and terminal shortening. Flowchart, inclusion-map, and force-vector fixtures are strict semantic and MacTeX/tikztosvg visual drivers. Arbitrary TeX branches/macros, transformed/intersection/scaled points, hull and clipping commands, and saved-register callbacks remain partial."
);

tikzLibrary.implementedBy += " + src/tikz/libraries/arrows.js:resolveDeclaredArrowAliases/reverseDeclaredArrowGeometry/reflectDeclaredArrowPath + src/engine/options.js:parseDeclaredArrowPayload";
tikzLibrary.features.push(
  "user-declared legacy pgfarrowsdeclarealias geometry reuse and alias chains",
  "user-declared legacy pgfarrowsdeclarereversed x reflection and longitudinal extent exchange"
);
tikzLibrary.implements.push(
  "user-declared legacy pgfarrowsdeclarealias geometry reuse and alias chains",
  "user-declared legacy pgfarrowsdeclarereversed x reflection and longitudinal extent exchange"
);
tikzLibrary.notes += " A thirteenth source review on 2026-09-05 covered the legacy compatibility macros `\\pgfarrowsdeclarealias` and `\\pgfarrowsdeclarereversed` in pgfcorearrows.code.tex and the reversed-arrow algorithm in the base arrows manual. TikZKit now resolves alias chains onto an existing declaration, preserves the public arrow name, evaluates the source program at the active line width, reflects only local x coordinates, flips SVG arc sweep, maps bounds to [-maxX,-minX], exchanges and negates backend/tip end, and negates line end. The process flowchart, inclusion/projection map, and TCS leaf tree are strict semantic and MacTeX/tikztosvg visual drivers. Declaration combine/double/triple helpers, arbitrary TeX branches/macros, transformed/intersection/scaled points, hull and clipping commands, and saved-register callbacks remain partial.";

tikzLibrary.implementedBy += " + src/tikz/libraries/arrows.js:parseDeclaredArrowHull/evaluateDeclaredCoordinateDimension + src/renderers/svg/paths.js:resolveInlineArrowTip + src/renderers/svg/bounds.js:includeResolvedArrowTipBounds + src/engine/evaluate.js:interpretPathStatement";
tikzLibrary.features.push(
  "user-declared pgfarrowshullpoint and symmetric pgfarrowsupperhullpoint picture bounds",
  "active-line-width hull dimensions with inline pgf@x and pgf@y advance",
  "reversed declared-arrow hull x reflection",
  "TikZ clip action suppression of arrow tips and endpoint shortening"
);
tikzLibrary.implements.push(
  "user-declared pgfarrowshullpoint and symmetric pgfarrowsupperhullpoint picture bounds",
  "active-line-width hull dimensions with inline pgf@x and pgf@y advance",
  "reversed declared-arrow hull x reflection",
  "TikZ clip action suppression of arrow tips and endpoint shortening"
);
tikzLibrary.notes = tikzLibrary.notes.replace(
  "Declaration combine/double/triple helpers, arbitrary TeX branches/macros, transformed/intersection/scaled points, hull and clipping commands, and saved-register callbacks remain partial.",
  "A fourteenth source review on 2026-09-05 covered `\\pgfarrowshullpoint`, `\\pgfarrowsupperhullpoint`, transformed hull picture bounds, and the PGF path-action clip branch. TikZKit now evaluates explicit hull coordinates at the active line width, applies inline `\\advance\\pgf@x` and `\\advance\\pgf@y`, mirrors positive upper-hull y coordinates, reflects hull x for reversed aliases, treats the declared hull as already stroke-inclusive, and preserves it even when an inline path node disables ordinary arrow normal bounds. Paths carrying `clip` suppress their arrow tips and keep unshortened endpoints. The hull-aware control network is the strict semantic and MacTeX/tikztosvg visual driver. Declaration combine/double/triple helpers, arbitrary TeX branches/macros, transformed/intersection/scaled points, harpoon-specific one-sided upper hulls, complete clip-region rendering, and saved-register callbacks remain partial."
);
tikzLibrary.notes = tikzLibrary.notes
  .replaceAll(
    "Clipping, arrow hulls, saved-register callbacks, and arbitrary TeX control flow inside declaration programs remain deferred.",
    "Saved-register callbacks and arbitrary TeX control flow inside declaration programs remain deferred."
  )
  .replaceAll(
    "Concave/custom shape miters and full declared-arrow hulls remain partial.",
    "Concave/custom shape miters remain partial."
  )
  .replaceAll(
    "Arbitrary TeX branches/macros, transformed/intersection/scaled points, hull and clipping commands, and saved-register callbacks remain partial.",
    "Arbitrary TeX branches/macros, transformed/intersection/scaled points, and saved-register callbacks remain partial."
  );

export function legacyPrimeArrowMetrics(kind, lineWidth) {
  const match = String(kind || "").trim().toLowerCase()
    .match(/^(latex|stealth)-prime(-reversed)?$/u);
  if (!match) return null;

  const family = `${match[1]}-prime`;
  const reversed = Boolean(match[2]);
  const unitsPerPt = lineWidthFromPt(1);
  const lineWidthPt = Math.max(0.01, Number(lineWidth) || lineWidthFromPt(0.4)) / unitsPerPt;
  const unitPt = 0.28 + 0.3 * lineWidthPt;
  const source = family === "latex-prime"
    ? { back: 4, tip: 6, halfHeight: 3.75, extentStrokePt: 0, arrowLineWidthPt: 0 }
    : { back: 6, tip: 2, halfHeight: 3.25, extentStrokePt: 0.5 * lineWidthPt, arrowLineWidthPt: lineWidthPt };
  const backPt = source.back * unitPt + source.extentStrokePt;
  const tipPt = source.tip * unitPt + source.extentStrokePt;
  const backEndPt = -(reversed ? tipPt : backPt);
  const tipEndPt = reversed ? backPt : tipPt;
  const pt = (value) => lineWidthFromPt(value);

  return {
    family,
    reversed,
    unit: pt(unitPt),
    lineWidth: pt(lineWidthPt),
    arrowLineWidth: pt(source.arrowLineWidthPt),
    backEnd: pt(backEndPt),
    tipEnd: pt(tipEndPt),
    halfHeight: pt(source.halfHeight * unitPt + source.extentStrokePt),
    placement: pt(tipEndPt),
    terminalPlacement: pt(tipEndPt),
    assemblyLength: pt(tipEndPt - backEndPt)
  };
}

export function legacyDelimiterArrowMetrics(kind, lineWidth) {
  const source = String(kind || "").trim().toLowerCase();
  const reversed = source.endsWith("-reversed");
  const baseKind = reversed ? source.slice(0, -"-reversed".length) : source;
  const unitsPerPt = lineWidthFromPt(1);
  const lineWidthPt = Math.max(0.01, Number(lineWidth) || lineWidthFromPt(0.4)) / unitsPerPt;
  const pt = (value) => lineWidthFromPt(value);

  if (baseKind === "square-bracket") {
    const halfHeightPt = 2 + 1.5 * lineWidthPt;
    const armPt = 0.5 * (halfHeightPt + lineWidthPt);
    const backEndPt = -(1 + 1.25 * lineWidthPt);
    const tipEndPt = 0.5 * lineWidthPt;
    return delimiterMetrics("square-bracket", reversed, pt, {
      halfHeightPt,
      armPt,
      backEndPt,
      tipEndPt
    });
  }

  if (baseKind === "round-bracket") {
    const halfHeightPt = 2 + 1.5 * lineWidthPt;
    const backEndPt = -0.5 * halfHeightPt - 0.5 * lineWidthPt;
    const tipEndPt = 0.0625 * halfHeightPt + 0.5 * lineWidthPt;
    return delimiterMetrics("round-bracket", reversed, pt, {
      halfHeightPt,
      backEndPt,
      tipEndPt
    });
  }

  if (baseKind === "legacy-bar" && !reversed) {
    const halfHeightPt = 2 + 1.5 * lineWidthPt;
    return delimiterMetrics("bar", false, pt, {
      halfHeightPt,
      barXPt: 0.25 * lineWidthPt,
      backEndPt: -0.25 * lineWidthPt,
      tipEndPt: 0.75 * lineWidthPt
    });
  }

  const angle = Number(baseKind.match(/^angle-(90|60|45)$/)?.[1]);
  if (!angle) return null;
  const unitPt = 0.3 + 0.25 * lineWidthPt;
  const geometry = angle === 90
    ? { backFactor: 5.5, tipLineFactor: 0.707, halfHeightFactor: 6 }
    : angle === 60
      ? { backFactor: 7.29, tipLineFactor: 1, halfHeightFactor: 4.5 }
      : { backFactor: 8.705, tipLineFactor: 1.28, halfHeightFactor: Math.sin((23 * Math.PI) / 180) * 10 };
  return delimiterMetrics(`angle-${angle}`, reversed, pt, {
    angle,
    unitPt,
    backEndPt: -geometry.backFactor * unitPt - 0.5 * lineWidthPt,
    tipEndPt: 0.5 * unitPt + geometry.tipLineFactor * lineWidthPt,
    backXPt: -geometry.backFactor * unitPt,
    tipXPt: 0.5 * unitPt,
    halfHeightPt: geometry.halfHeightFactor * unitPt
  });
}

export function legacyTriangleArrowMetrics(kind, lineWidth) {
  const match = String(kind || "").trim().toLowerCase()
    .match(/^(open-)?triangle-(90|60|45)(-reversed)?$/u);
  if (!match) return null;

  const open = Boolean(match[1]);
  const angle = Number(match[2]);
  const reversed = Boolean(match[3]);
  const unitsPerPt = lineWidthFromPt(1);
  const lineWidthPt = Math.max(0.01, Number(lineWidth) || lineWidthFromPt(0.4)) / unitsPerPt;
  const unitPt = 0.5 + 0.25 * lineWidthPt;
  const source = legacyTriangleAngleSource(angle);

  let backEndPt;
  let tipEndPt;
  let backXPt;
  let tipXPt;

  if (open) {
    backEndPt = -(reversed ? source.tipLineFactor : 0.5) * lineWidthPt;
    tipEndPt = source.openLengthFactor * unitPt
      + (reversed ? 0.5 : source.tipLineFactor) * lineWidthPt;
    backXPt = reversed ? source.openLengthFactor * unitPt : 0;
    tipXPt = reversed ? 0 : source.openLengthFactor * unitPt;
  } else {
    backEndPt = -source.backExtentFactor * unitPt - 0.5 * lineWidthPt;
    tipEndPt = 0.5 * unitPt + source.tipLineFactor * lineWidthPt;
    backXPt = (reversed ? 1 : -1) * source.pathBackFactor * unitPt;
    tipXPt = (reversed ? -1 : 1) * 0.5 * unitPt;
  }

  const placementPt = open
    ? tipEndPt
    : reversed
      ? -backEndPt
      : tipEndPt;
  const pt = (value) => lineWidthFromPt(value);
  return {
    shape: "triangle",
    open,
    reversed,
    angle,
    unit: pt(unitPt),
    lineWidth: pt(lineWidthPt),
    backEnd: pt(backEndPt),
    tipEnd: pt(tipEndPt),
    placement: pt(placementPt),
    assemblyLength: pt(tipEndPt - backEndPt),
    backX: pt(backXPt),
    tipX: pt(tipXPt),
    halfHeight: pt(source.halfHeightFactor * unitPt)
  };
}

export function legacyDiamondArrowMetrics(kind, lineWidth) {
  const source = String(kind || "").trim().toLowerCase();
  if (source !== "legacy-diamond" && source !== "legacy-open-diamond") return null;

  const open = source === "legacy-open-diamond";
  const unitsPerPt = lineWidthFromPt(1);
  const lineWidthPt = Math.max(0.01, Number(lineWidth) || lineWidthFromPt(0.4)) / unitsPerPt;
  const unitPt = 0.4 + 0.275 * lineWidthPt;
  const backEndPt = open ? -0.5 * lineWidthPt : -13 * unitPt - 0.5 * lineWidthPt;
  const tipEndPt = (open ? 14 : 1) * unitPt + 0.5 * lineWidthPt;
  const pt = (value) => lineWidthFromPt(value);

  return {
    shape: "diamond",
    open,
    unit: pt(unitPt),
    lineWidth: pt(lineWidthPt),
    backEnd: pt(backEndPt),
    tipEnd: pt(tipEndPt),
    placement: pt(tipEndPt),
    assemblyLength: pt(tipEndPt - backEndPt),
    backX: pt(open ? 0 : -13 * unitPt),
    middleX: pt(open ? 7 * unitPt : -6 * unitPt),
    frontX: pt(open ? 14 * unitPt : unitPt),
    halfHeight: pt(4 * unitPt)
  };
}

export function legacySquareArrowMetrics(kind, lineWidth) {
  const source = String(kind || "").trim().toLowerCase();
  if (source !== "legacy-square" && source !== "legacy-open-square") return null;

  const open = source === "legacy-open-square";
  const unitsPerPt = lineWidthFromPt(1);
  const lineWidthPt = Math.max(0.01, Number(lineWidth) || lineWidthFromPt(0.4)) / unitsPerPt;
  const unitPt = 0.4 + 0.275 * lineWidthPt;
  const backEndPt = open ? -0.5 * lineWidthPt : -7 * unitPt - 0.5 * lineWidthPt;
  const tipEndPt = (open ? 8 : 1) * unitPt + 0.5 * lineWidthPt;
  const pt = (value) => lineWidthFromPt(value);

  return {
    shape: "square",
    open,
    unit: pt(unitPt),
    lineWidth: pt(lineWidthPt),
    backEnd: pt(backEndPt),
    tipEnd: pt(tipEndPt),
    placement: pt(tipEndPt),
    assemblyLength: pt(tipEndPt - backEndPt),
    backX: pt(open ? 0 : -7 * unitPt),
    frontX: pt(open ? 8 * unitPt : unitPt),
    halfHeight: pt(4 * unitPt)
  };
}

export function legacyCircleArrowMetrics(kind, lineWidth) {
  const source = String(kind || "").trim().toLowerCase();
  if (source !== "legacy-filled-circle" && source !== "legacy-open-circle") return null;

  const open = source === "legacy-open-circle";
  const unitsPerPt = lineWidthFromPt(1);
  const lineWidthPt = Math.max(0.01, Number(lineWidth) || lineWidthFromPt(0.4)) / unitsPerPt;
  const unitPt = 0.4 + 0.2 * lineWidthPt;
  const centerPt = (open ? 4.5 : -3) * unitPt;
  const radiusPt = 4.5 * unitPt;
  const backEndPt = open ? -0.5 * lineWidthPt : -7.5 * unitPt - 0.5 * lineWidthPt;
  const tipEndPt = (open ? 9 : 1.5) * unitPt + 0.5 * lineWidthPt;
  const pt = (value) => lineWidthFromPt(value);

  return {
    shape: "circle",
    open,
    unit: pt(unitPt),
    lineWidth: pt(lineWidthPt),
    backEnd: pt(backEndPt),
    tipEnd: pt(tipEndPt),
    placement: pt(tipEndPt),
    assemblyLength: pt(tipEndPt - backEndPt),
    centerX: pt(centerPt),
    radius: pt(radiusPt)
  };
}

export function legacyHookArrowMetrics(kind, lineWidth) {
  const source = String(kind || "").trim().toLowerCase();
  const match = source.match(/^legacy-(?:(left|right)-hook|hooks)(-reversed)?$/u);
  if (!match) return null;

  const side = match[1] || "both";
  const reversed = Boolean(match[2]);
  const unitsPerPt = lineWidthFromPt(1);
  const lineWidthPt = Math.max(0.01, Number(lineWidth) || lineWidthFromPt(0.4)) / unitsPerPt;
  const unitPt = 0.4 + 0.2 * lineWidthPt;
  const backEndPt = -0.5 * lineWidthPt;
  const tipEndPt = 3.75 * unitPt + 0.5 * lineWidthPt;
  const pt = (value) => lineWidthFromPt(value);
  const minYFactor = side === "right" || side === "both" ? -6 : 0;
  const maxYFactor = side === "left" || side === "both" ? 6 : 0;

  return {
    shape: "hook",
    side,
    reversed,
    unit: pt(unitPt),
    lineWidth: pt(lineWidthPt),
    backEnd: pt(backEndPt),
    tipEnd: pt(tipEndPt),
    placement: pt(reversed ? -backEndPt : tipEndPt),
    assemblyLength: pt(tipEndPt - backEndPt),
    minX: pt(reversed ? -3.75 * unitPt : 0),
    maxX: pt(reversed ? 0 : 3.75 * unitPt),
    minY: pt(minYFactor * unitPt),
    maxY: pt(maxYFactor * unitPt)
  };
}

export function legacySideToArrowMetrics(kind, lineWidth) {
  const source = String(kind || "").trim().toLowerCase();
  const match = source.match(/^legacy-(left|right)-to(-reversed)?$/u);
  if (!match) return null;

  const side = match[1];
  const reversed = Boolean(match[2]);
  const unitsPerPt = lineWidthFromPt(1);
  const lineWidthPt = Math.max(0.01, Number(lineWidth) || lineWidthFromPt(0.4)) / unitsPerPt;
  const unitPt = 0.28 + 0.3 * lineWidthPt;
  const backEndPt = reversed ? -0.1 * lineWidthPt : -0.84 - 1.3 * lineWidthPt;
  const tipEndPt = reversed ? 3.75 * unitPt + 0.9 * lineWidthPt : 0.21 + 0.625 * lineWidthPt;
  const xShiftPt = reversed ? 0.625 * lineWidthPt : 0;
  const minXPt = reversed ? -0.1 * lineWidthPt : -3 * unitPt;
  const maxXPt = reversed ? 3.75 * unitPt + xShiftPt : 0.75 * unitPt;
  const halfHeightPt = 4 * unitPt + 0.4 * lineWidthPt;
  const pt = (value) => lineWidthFromPt(value);

  return {
    shape: "side-to",
    side,
    reversed,
    unit: pt(unitPt),
    lineWidth: pt(lineWidthPt),
    arrowLineWidth: pt(0.8 * lineWidthPt),
    xShift: pt(xShiftPt),
    backEnd: pt(backEndPt),
    tipEnd: pt(tipEndPt),
    placement: pt(tipEndPt),
    terminalPlacement: pt(tipEndPt),
    assemblyLength: pt(tipEndPt - backEndPt),
    minX: pt(minXPt),
    maxX: pt(maxXPt),
    minY: side === "left" ? pt(-halfHeightPt) : 0,
    maxY: side === "right" ? pt(halfHeightPt) : 0
  };
}

export function legacyImpliesArrowMetrics(kind, lineWidth, innerLineWidth = 0, doubled = false) {
  if (String(kind || "").trim().toLowerCase() !== "legacy-implies") return null;

  const unitsPerPt = lineWidthFromPt(1);
  const requestedLineWidth = Math.max(0.01, Number(lineWidth) || lineWidthFromPt(0.4));
  const inner = doubled
    ? Math.max(0, Number.isFinite(Number(innerLineWidth)) ? Number(innerLineWidth) : lineWidthFromPt(0.6))
    : 0;
  const outer = doubled ? 2 * requestedLineWidth + inner : requestedLineWidth;
  const outerPt = outer / unitsPerPt;
  const innerPt = inner / unitsPerPt;
  const dimaPt = 0.25 * (outerPt + innerPt);
  const dimbPt = 0.5 * (outerPt - innerPt);
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
    space: 0,
    placement: pt(tipEndPt),
    terminalPlacement: pt(tipEndPt),
    assemblyLength: pt(tipEndPt - backEndPt)
  };
}

export function legacySerifCmArrowMetrics(kind, lineWidth) {
  if (String(kind || "").trim().toLowerCase() !== "legacy-serif-cm") return null;

  const unitsPerPt = lineWidthFromPt(1);
  const lineWidthPt = Math.max(0.01, Number(lineWidth) || lineWidthFromPt(0.4)) / unitsPerPt;
  const unitPt = 0.4 + 0.45 * lineWidthPt;
  const backEndPt = -0.75 * unitPt;
  const tipEndPt = 0.04 * lineWidthPt;
  const halfHeightPt = 1.95 * unitPt;
  const pt = (value) => lineWidthFromPt(value);

  return {
    shape: "serif-cm",
    unit: pt(unitPt),
    lineWidth: pt(lineWidthPt),
    xShift: pt(tipEndPt),
    backEnd: pt(backEndPt),
    tipEnd: pt(tipEndPt),
    placement: pt(tipEndPt),
    terminalPlacement: pt(tipEndPt),
    assemblyLength: pt(tipEndPt - backEndPt),
    minX: pt(backEndPt),
    maxX: pt(tipEndPt),
    halfHeight: pt(halfHeightPt)
  };
}

export function legacyCapArrowMetrics(kind, lineWidth) {
  const source = String(kind || "").trim().toLowerCase();
  const match = source.match(/^legacy-(round|butt|triangle-90|fast)-cap(-reversed)?$/u);
  if (!match) return null;

  const variant = match[1];
  const reversed = Boolean(match[2]);
  if ((variant === "round" || variant === "butt") && reversed) return null;

  const unitsPerPt = lineWidthFromPt(1);
  const lineWidthPt = Math.max(0.01, Number(lineWidth) || lineWidthFromPt(0.4)) / unitsPerPt;
  const backEndPt = variant === "round" ? 0 : -0.1 * lineWidthPt;
  const tipEndPt = (variant === "butt" ? 0.5 : variant === "fast" ? 2 : 1) * lineWidthPt;
  const minXPt = variant === "round" ? 0 : -0.1 * lineWidthPt;
  const maxXPt = (variant === "round" || variant === "butt" ? 0.5 : variant === "fast" ? 2 : 1) * lineWidthPt;
  const halfHeightPt = variant === "round" || variant === "butt" ? 0 : 0.5 * lineWidthPt;
  const pt = (value) => lineWidthFromPt(value);

  return {
    shape: "cap",
    variant,
    reversed,
    paint: variant === "round" || variant === "butt" ? "stroke" : "fill",
    lineCap: variant === "round" ? "round" : "butt",
    lineWidth: pt(lineWidthPt),
    backEnd: pt(backEndPt),
    tipEnd: pt(tipEndPt),
    placement: pt(tipEndPt),
    assemblyLength: pt(tipEndPt - backEndPt),
    minX: pt(minXPt),
    maxX: pt(maxXPt),
    halfHeight: pt(halfHeightPt)
  };
}

function legacyTriangleAngleSource(angle) {
  if (angle === 90) {
    return {
      backExtentFactor: 5.5,
      pathBackFactor: 5.5,
      openLengthFactor: 6,
      halfHeightFactor: 6,
      tipLineFactor: 0.707
    };
  }
  if (angle === 60) {
    return {
      backExtentFactor: 7.29,
      pathBackFactor: 9 * Math.cos(Math.PI / 6) - 0.5,
      openLengthFactor: 7.794,
      halfHeightFactor: 4.5,
      tipLineFactor: 1
    };
  }
  return {
    backExtentFactor: 8.705,
    pathBackFactor: 10 * Math.cos((23 * Math.PI) / 180) - 0.5,
    openLengthFactor: 9.205,
    halfHeightFactor: 10 * Math.sin((23 * Math.PI) / 180),
    tipLineFactor: 1.28
  };
}

function delimiterMetrics(shape, reversed, pt, values) {
  const backEnd = pt(values.backEndPt);
  const tipEnd = pt(values.tipEndPt);
  return {
    shape,
    reversed,
    backEnd,
    tipEnd,
    placement: reversed ? -backEnd : tipEnd,
    assemblyLength: tipEnd - backEnd,
    ...Object.fromEntries(
      Object.entries(values)
        .filter(([key]) => key.endsWith("Pt"))
        .map(([key, value]) => [key.slice(0, -2), pt(value)])
    ),
    ...(values.angle ? { angle: values.angle } : {})
  };
}

// PGF's arrow declarations store a local path plus placement extents. We lower
// the self-contained drawing subset into a compact SVG-path payload, leaving
// the normal arrow renderer responsible for endpoint placement and rotation.
export function lowerDeclaredArrowTips(source, diagnostics = []) {
  const text = String(source || "");
  if (!/\\pgfarrowsdeclare(?:alias|reversed)?\b/.test(text)) return text;
  const declarations = new Map();
  const withoutDeclarations = collectDeclarations(text, declarations, diagnostics);
  return declarations.size ? rewriteArrowOptions(withoutDeclarations, declarations) : withoutDeclarations;
}

function collectDeclarations(source, declarations, diagnostics) {
  const commandPattern = /\\pgfarrowsdeclare(?:alias|reversed)?\b/g;
  const aliases = [];
  let output = "";
  let index = 0;
  let match;
  while ((match = commandPattern.exec(source))) {
    const command = match[0];
    const start = match.index;
    output += source.slice(index, start);
    let cursor = skipWhitespace(source, start + command.length);
    const forward = readBalanced(source, cursor, "{", "}");
    cursor = forward ? skipWhitespace(source, forward.end) : cursor;
    const backward = forward && readBalanced(source, cursor, "{", "}");
    cursor = backward ? skipWhitespace(source, backward.end) : cursor;
    const setup = backward && readBalanced(source, cursor, "{", "}");
    cursor = setup ? skipWhitespace(source, setup.end) : cursor;
    const drawing = setup && readBalanced(source, cursor, "{", "}");
    if (!forward || !backward || !setup || !drawing) {
      output += command;
      index = start + command.length;
      continue;
    }
    if (command !== "\\pgfarrowsdeclare") {
      aliases.push({
        forward: forward.content.trim(),
        backward: backward.content.trim(),
        targetForward: setup.content.trim(),
        targetBackward: drawing.content.trim(),
        reversed: command === "\\pgfarrowsdeclarereversed"
      });
    } else {
      const declared = parseDeclaredArrow(setup.content, drawing.content, lineWidthFromPt(0.4));
      if (!declared) {
        diagnostics.push({ severity: "warning", message: "Unsupported pgfarrowsdeclare drawing program" });
        output += source.slice(start, drawing.end);
      } else {
        for (const name of [forward.content.trim(), backward.content.trim()]) {
          if (name) {
            declarations.set(name, {
              ...declared,
              name,
              program: { setup: setup.content, drawing: drawing.content }
            });
          }
        }
      }
    }
    index = drawing.end;
    commandPattern.lastIndex = index;
  }
  output += source.slice(index);
  resolveDeclaredArrowAliases(aliases, declarations, diagnostics);
  return output;
}

function resolveDeclaredArrowAliases(aliases, declarations, diagnostics) {
  let pending = aliases;
  while (pending.length) {
    const unresolved = [];
    let progress = false;
    for (const alias of pending) {
      const pairs = [
        [alias.forward, alias.targetBackward],
        [alias.backward, alias.targetBackward]
      ];
      if (pairs.every(([, target]) => declarations.has(target))) {
        for (const [name, target] of pairs) {
          if (!name) continue;
          const declaration = declarations.get(target);
          declarations.set(name, {
            ...declaration,
            name,
            reversed: alias.reversed ? !declaration.reversed : declaration.reversed === true
          });
        }
        progress = true;
      } else {
        unresolved.push(alias);
      }
    }
    if (!progress) {
      for (const alias of unresolved) {
        diagnostics.push({
          severity: "warning",
          message: `Unknown declared arrow target: ${alias.targetBackward}`
        });
      }
      return;
    }
    pending = unresolved;
  }
}

function parseDeclaredArrow(setup, drawing, lineWidth) {
  const setupProgram = evaluateDeclaredDimensionProgram(setup, lineWidth);
  const drawingProgram = evaluateDeclaredDimensionProgram(drawing, lineWidth);
  const drawingStyle = declaredArrowDrawingStyle(drawingProgram.remainder);
  const drawingSource = stripDeclaredArrowDrawingStyle(drawingProgram.remainder);
  const commands = [];
  const bounds = createBounds();
  let current = null;
  let paint = null;
  const commandPattern = /\\(pgfpathmoveto|pgfpathlineto|pgfpathcurveto|pgfpatharc|pgfpathclose|pgfusepathqfillstroke|pgfusepathqfill|pgfusepathqstroke)\b/g;
  let cursor = 0;
  let match;
  while ((match = commandPattern.exec(drawingSource))) {
    if (drawingSource.slice(cursor, match.index).replace(/[\s%]/g, "").length) return null;
    cursor = commandPattern.lastIndex;
    const name = match[1];
    if (name === "pgfpathclose") {
      commands.push("Z");
      continue;
    }
    if (name.startsWith("pgfusepath")) {
      paint = name === "pgfusepathqstroke" ? "stroke" : name === "pgfusepathqfill" ? "fill" : "fillstroke";
      continue;
    }
    if (name === "pgfpatharc") {
      const first = readBalanced(drawingSource, skipWhitespace(drawingSource, cursor), "{", "}");
      const second = first && readBalanced(drawingSource, skipWhitespace(drawingSource, first.end), "{", "}");
      const third = second && readBalanced(drawingSource, skipWhitespace(drawingSource, second.end), "{", "}");
      if (!first || !second || !third || !current) return null;
      const start = evaluateMath(first.content);
      const end = evaluateMath(second.content);
      const radius = parseRadius(third.content, drawingProgram.variables, lineWidth);
      if (![start, end, radius.x, radius.y].every(Number.isFinite) || radius.x <= 0 || radius.y <= 0) return null;
      const arc = arcSegments(current, start, end, radius, bounds);
      if (!arc) return null;
      commands.push(...arc.commands);
      current = arc.end;
      cursor = third.end;
      commandPattern.lastIndex = cursor;
      continue;
    }
    const points = [];
    const count = name === "pgfpathcurveto" ? 3 : 1;
    for (let pointIndex = 0; pointIndex < count; pointIndex += 1) {
      const argument = readBalanced(drawingSource, skipWhitespace(drawingSource, cursor), "{", "}");
      const point = argument && parsePgfPoint(argument.content, drawingProgram.variables, lineWidth);
      if (!argument || !point) return null;
      points.push(point);
      cursor = argument.end;
    }
    commandPattern.lastIndex = cursor;
    if (name === "pgfpathmoveto") {
      current = points[0];
      includePoint(bounds, current);
      commands.push(`M ${format(current.x)} ${format(-current.y)}`);
    } else if (name === "pgfpathlineto") {
      if (!current) return null;
      current = points[0];
      includePoint(bounds, current);
      commands.push(`L ${format(current.x)} ${format(-current.y)}`);
    } else {
      if (!current) return null;
      for (const point of points) includePoint(bounds, point);
      includeCubicBounds(bounds, current, points[0], points[1], points[2]);
      current = points[2];
      commands.push(`C ${format(points[0].x)} ${format(-points[0].y)} ${format(points[1].x)} ${format(-points[1].y)} ${format(points[2].x)} ${format(-points[2].y)}`);
    }
  }
  if (drawingSource.slice(cursor).replace(/[\s%]/g, "").length || !commands.length || !paint || !isFiniteBounds(bounds)) return null;
  const legacyExtents = parseLegacyArrowExtents(setup, setupProgram.variables, lineWidth);
  const explicitHull = parseDeclaredArrowHull(setup, setupProgram.variables, lineWidth);
  const pictureBounds = explicitHull?.bounds || {
    minX: bounds.minX,
    maxX: bounds.maxX,
    minY: -bounds.maxY,
    maxY: -bounds.minY
  };
  return {
    path: commands.join(" "),
    paint,
    bounds: pictureBounds,
    ...(explicitHull
      ? { hasExplicitHull: true, strokeBoundsIncluded: true }
      : {}),
    ...(legacyExtents || {}),
    ...drawingStyle
  };
}

export function resolveDeclaredArrowGeometry(declaration, lineWidth = lineWidthFromPt(0.4)) {
  const program = declaration?.program;
  const resolved = program && typeof program.setup === "string" && typeof program.drawing === "string"
    ? parseDeclaredArrow(program.setup, program.drawing, lineWidth)
    : null;
  const geometry = resolved
    ? { ...resolved, name: declaration.name, program, reversed: declaration.reversed === true }
    : declaration;
  return declaration?.reversed === true ? reverseDeclaredArrowGeometry(geometry) : geometry;
}

function reverseDeclaredArrowGeometry(geometry) {
  if (!geometry?.bounds || typeof geometry.path !== "string") return geometry;
  const bounds = geometry.bounds;
  return {
    ...geometry,
    path: reflectDeclaredArrowPath(geometry.path),
    bounds: {
      minX: -bounds.maxX,
      maxX: -bounds.minX,
      minY: bounds.minY,
      maxY: bounds.maxY
    },
    ...(Number.isFinite(geometry.backEnd) && Number.isFinite(geometry.tipEnd)
      ? { backEnd: -geometry.tipEnd, tipEnd: -geometry.backEnd }
      : {}),
    ...(Number.isFinite(geometry.lineEnd) ? { lineEnd: -geometry.lineEnd } : {})
  };
}

function reflectDeclaredArrowPath(path) {
  const tokens = String(path).match(/[MLCAZ]|-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/gi) || [];
  const reflected = [];
  let index = 0;
  while (index < tokens.length) {
    const command = tokens[index++].toUpperCase();
    reflected.push(command);
    if (command === "Z") continue;
    const count = command === "C" ? 6 : command === "A" ? 7 : 2;
    const values = tokens.slice(index, index + count).map(Number);
    if (values.length !== count || values.some((value) => !Number.isFinite(value))) return path;
    if (command === "M" || command === "L") {
      values[0] = -values[0];
    } else if (command === "C") {
      values[0] = -values[0];
      values[2] = -values[2];
      values[4] = -values[4];
    } else if (command === "A") {
      values[2] = -values[2];
      values[4] = values[4] ? 0 : 1;
      values[5] = -values[5];
    } else {
      return path;
    }
    reflected.push(...values.map(format));
    index += count;
  }
  return reflected.join(" ");
}

function parseLegacyArrowExtents(setup, variables, lineWidth) {
  const backEnd = setupDimension(setup, variables, lineWidth, "pgfarrowsleftextend", "pgfarrowssetbackend");
  const tipEnd = setupDimension(setup, variables, lineWidth, "pgfarrowsrightextend", "pgfarrowssettipend");
  const lineEnd = setupDimension(setup, variables, lineWidth, "pgfarrowssetlineend");
  if (![backEnd, tipEnd, lineEnd].some(Number.isFinite)) return null;
  // The old compatibility declaration only exposes the arrow's longitudinal
  // ends; it does not register a PGF arrow hull. PGF therefore keeps the
  // original path's picture bounds rather than expanding them around paint.
  return {
    usesLegacyExtents: true,
    backEnd: Number.isFinite(backEnd) ? backEnd : 0,
    tipEnd: Number.isFinite(tipEnd) ? tipEnd : 0,
    lineEnd: Number.isFinite(lineEnd) ? lineEnd : 0
  };
}

function parseDeclaredArrowHull(setup, variables, lineWidth) {
  const source = String(setup || "");
  const commandPattern = /\\(pgfarrowshullpoint|pgfarrowsupperhullpoint)\b/g;
  const points = [];
  let match;
  while ((match = commandPattern.exec(source))) {
    const xArgument = readBalanced(source, skipWhitespace(source, commandPattern.lastIndex), "{", "}");
    const yArgument = xArgument && readBalanced(source, skipWhitespace(source, xArgument.end), "{", "}");
    if (!xArgument || !yArgument) continue;
    const x = evaluateDeclaredCoordinateDimension(xArgument.content, "pgf@x", variables, lineWidth);
    const y = evaluateDeclaredCoordinateDimension(yArgument.content, "pgf@y", variables, lineWidth);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      points.push({ x, y });
      if (match[1] === "pgfarrowsupperhullpoint" && y > 0) points.push({ x, y: -y });
    }
    commandPattern.lastIndex = yArgument.end;
  }
  if (!points.length) return null;
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  return {
    bounds: { minX, maxX, minY: -maxY, maxY: -minY }
  };
}

function evaluateDeclaredCoordinateDimension(input, registerName, variables, lineWidth) {
  const source = String(input || "").trim();
  const advancePattern = /\\advance\s*\\([A-Za-z@]+)\s+by\s*/g;
  const first = advancePattern.exec(source);
  let value = evaluateDeclaredDimension(source.slice(0, first?.index ?? source.length), variables, lineWidth);
  if (!Number.isFinite(value) || !first) return value;

  let current = first;
  while (current) {
    const operandStart = advancePattern.lastIndex;
    const next = advancePattern.exec(source);
    const operandEnd = next?.index ?? source.length;
    const delta = evaluateDeclaredDimension(source.slice(operandStart, operandEnd), variables, lineWidth);
    if (!Number.isFinite(delta)) return NaN;
    if (current[1] === registerName) value += delta;
    current = next;
  }
  return value;
}

function setupDimension(setup, variables, lineWidth, ...commands) {
  for (const command of commands) {
    const start = String(setup || "").search(new RegExp(`\\\\${command}\\b`));
    if (start < 0) continue;
    const open = skipWhitespace(setup, start + command.length + 1);
    const argument = readBalanced(setup, open, "{", "}");
    if (!argument) continue;
    const value = evaluateDeclaredDimension(argument.content, variables, lineWidth);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function rewriteArrowOptions(source, declarations) {
  let output = "";
  let index = 0;
  while (index < source.length) {
    const open = source.indexOf("[", index);
    if (open < 0) return output + source.slice(index);
    const group = readBalanced(source, open, "[", "]");
    if (!group) return output + source.slice(index);
    output += source.slice(index, open);
    output += `[${rewriteArrowOptionList(group.content, declarations)}]`;
    index = group.end;
  }
  return output;
}

function rewriteArrowOptionList(content, declarations) {
  return splitTopLevel(content, ",").map((part) => rewriteArrowOption(part, declarations)).join(",");
}

function rewriteArrowOption(part, declarations) {
  const text = part.trim();
  if (!text || text.includes("=")) return part;
  const names = [...declarations.keys()].sort((left, right) => right.length - left.length);
  for (const first of names) {
    for (const second of names) {
      if (text === `${first}-${second}` || text === `{${first}}-{${second}}`) {
        return `{${encodedArrow(first, declarations)} }-{${encodedArrow(second, declarations)} }`.replace(/ \}/g, "}");
      }
    }
    if (text === `-${first}` || text === `-{${first}}`) return `-{${encodedArrow(first, declarations)}}`;
    if (text === `${first}-` || text === `{${first}}-`) return `{${encodedArrow(first, declarations)}}-`;
  }
  return part;
}

function encodedArrow(name, declarations) {
  const declaration = declarations.get(name);
  return `${name}[tikzkit declared arrow=${encodeArrowPayload(declaration)}]`;
}

function encodeArrowPayload(declaration) {
  // `%` starts a TeX comment, so URL encoding cannot safely travel through a
  // TikZ option list. URI-encode first, then represent the ASCII bytes as hex.
  return [...encodeURIComponent(JSON.stringify(declaration))]
    .map((character) => character.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
}

function evaluateDeclaredDimensionProgram(source, lineWidth) {
  const variables = { pgflinewidth: lineWidth };
  const ranges = [];
  const text = String(source || "");
  const statementPattern = /\\advance\b|\\[A-Za-z@]+\s*=/g;
  let match;
  while ((match = statementPattern.exec(text))) {
    const tail = text.slice(match.index);
    const advance = tail.match(/^\\advance\s*\\([A-Za-z@]+)\s+by\s*/);
    const assignment = advance ? null : tail.match(/^\\([A-Za-z@]+)\s*=\s*/);
    if (!advance && !assignment) continue;
    const name = (advance || assignment)[1];
    const operandStart = match.index + (advance || assignment)[0].length;
    const operandEnd = declaredDimensionOperandEnd(text, operandStart);
    const value = evaluateDeclaredDimension(text.slice(operandStart, operandEnd), variables, lineWidth);
    if (!Number.isFinite(value)) continue;
    variables[name] = advance ? (Number(variables[name]) || 0) + value : value;
    ranges.push([match.index, operandEnd]);
    statementPattern.lastIndex = operandEnd;
  }
  return { variables, remainder: removeSourceRanges(text, ranges) };
}

function declaredDimensionOperandEnd(source, start) {
  const boundaryCommands = new Set([
    "advance",
    "pgfarrowsleftextend",
    "pgfarrowsrightextend",
    "pgfarrowssetbackend",
    "pgfarrowssetlineend",
    "pgfarrowssettipend",
    "pgfpathclose",
    "pgfpathcurveto",
    "pgfpathlineto",
    "pgfpathmoveto",
    "pgfsetbuttcap",
    "pgfsetmiterjoin",
    "pgfsetroundcap",
    "pgfsetroundjoin",
    "pgfusepathqfill",
    "pgfusepathqfillstroke",
    "pgfusepathqstroke"
  ]);
  let cursor = start;
  while (cursor < source.length) {
    const character = source[cursor];
    if (character === "%" || character === "\n" || character === "\r") break;
    if (character === "\\") {
      const command = source.slice(cursor + 1).match(/^([A-Za-z@]+)/)?.[1];
      if (command && boundaryCommands.has(command)) break;
      if (command && /^\s*=/.test(source.slice(cursor + command.length + 1))) break;
    }
    cursor += 1;
  }
  return cursor;
}

function removeSourceRanges(source, ranges) {
  if (!ranges.length) return source;
  let output = "";
  let cursor = 0;
  for (const [start, end] of ranges) {
    output += source.slice(cursor, start);
    output += " ";
    cursor = end;
  }
  return output + source.slice(cursor);
}

function evaluateDeclaredDimension(input, variables = {}, lineWidth = lineWidthFromPt(0.4)) {
  let expression = String(input || "")
    .trim()
    .replace(/\\the\s*/g, "")
    .replace(/\{\}/g, "")
    .replace(/\{([^{}]+)\}/g, "($1)")
    .replace(/((?:\d+(?:\.\d*)?|\.\d+))\s*(?=\\[A-Za-z@]+)/g, "$1*")
    .replace(/((?:\d+(?:\.\d*)?|\.\d+))\s*(pt|bp|cm|mm|in|pc|dd|cc|sp|em|ex)\b/g, (match) => {
      const value = parseDimension(match) * TIKZ_UNIT;
      return Number.isFinite(value) ? `(${value})` : "NaN";
    })
    .replace(/\\([A-Za-z@]+)/g, (_match, name) => {
      if (name === "pgflinewidth") return `(${lineWidth})`;
      return Object.hasOwn(variables, name) ? `(${variables[name]})` : "NaN";
    })
    .replace(/\s+/g, "");
  for (let pass = 0; pass < 3; pass += 1) {
    expression = expression.replace(/\+\+/g, "+").replace(/\+-/g, "-").replace(/-\+/g, "-").replace(/--/g, "+");
  }
  if (!expression || !/^[0-9Na()+\-*/.]+$/.test(expression)) return NaN;
  try {
    const value = Function(`"use strict"; return (${expression});`)();
    return Number.isFinite(value) ? value : NaN;
  } catch {
    return NaN;
  }
}

function declaredArrowDrawingStyle(source) {
  const text = String(source || "");
  let lineCap;
  let lineJoin;
  if (/\\pgfsetbuttcap\b/.test(text)) lineCap = "butt";
  else if (/\\pgfsetroundcap\b/.test(text)) lineCap = "round";
  if (/\\pgfsetmiterjoin\b/.test(text)) lineJoin = "miter";
  else if (/\\pgfsetroundjoin\b/.test(text)) lineJoin = "round";
  return { ...(lineCap ? { lineCap } : {}), ...(lineJoin ? { lineJoin } : {}) };
}

function stripDeclaredArrowDrawingStyle(source) {
  return String(source || "")
    .replace(/%[^\n\r]*/g, "")
    .replace(/\\pgfset(?:butt|round)cap\b/g, "")
    .replace(/\\pgfset(?:miter|round)join\b/g, "");
}

function parsePgfPoint(text, variables = {}, lineWidth = lineWidthFromPt(0.4), depth = 0) {
  const source = String(text || "").trim();
  if (depth > 12) return null;
  if (source === "\\pgfpointorigin") return { x: 0, y: 0 };

  const pointAddArguments = readPgfCommandArguments(source, "\\pgfpointadd", 2);
  if (pointAddArguments) {
    const first = parsePgfPoint(pointAddArguments[0], variables, lineWidth, depth + 1);
    const second = parsePgfPoint(pointAddArguments[1], variables, lineWidth, depth + 1);
    return first && second ? { x: first.x + second.x, y: first.y + second.y } : null;
  }

  for (const command of ["\\pgfqpointpolar", "\\pgfpointpolar"]) {
    const arguments_ = readPgfCommandArguments(source, command, 2);
    if (!arguments_) continue;
    const angle = evaluateDeclaredDimension(arguments_[0], variables, lineWidth);
    const radiusParts = splitPolarRadii(arguments_[1]);
    if (!Number.isFinite(angle) || (command === "\\pgfqpointpolar" && radiusParts.length !== 1)) return null;
    const xRadius = evaluateDeclaredDimension(radiusParts[0], variables, lineWidth);
    const yRadius = evaluateDeclaredDimension(radiusParts[1] ?? radiusParts[0], variables, lineWidth);
    if (!Number.isFinite(xRadius) || !Number.isFinite(yRadius)) return null;
    const radians = (angle * Math.PI) / 180;
    return { x: xRadius * Math.cos(radians), y: yRadius * Math.sin(radians) };
  }

  const pointCommand = source.startsWith("\\pgfqpoint") ? "\\pgfqpoint" : source.startsWith("\\pgfpoint") ? "\\pgfpoint" : null;
  if (!pointCommand) return null;
  const arguments_ = readPgfCommandArguments(source, pointCommand, 2);
  if (!arguments_) return null;
  const xValue = evaluateDeclaredDimension(arguments_[0], variables, lineWidth);
  const yValue = evaluateDeclaredDimension(arguments_[1], variables, lineWidth);
  return Number.isFinite(xValue) && Number.isFinite(yValue) ? { x: xValue, y: yValue } : null;
}

function readPgfCommandArguments(source, command, count) {
  if (!source.startsWith(command)) return null;
  let cursor = command.length;
  const arguments_ = [];
  for (let index = 0; index < count; index += 1) {
    cursor = skipWhitespace(source, cursor);
    const argument = readBalanced(source, cursor, "{", "}");
    if (!argument) return null;
    arguments_.push(argument.content);
    cursor = argument.end;
  }
  return source.slice(cursor).trim() ? null : arguments_;
}

function splitPolarRadii(source) {
  const text = String(source || "").trim();
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenthesisDepth = 0;
  for (let index = 0; index <= text.length - 3; index += 1) {
    const character = text[index];
    if (character === "{") braceDepth += 1;
    else if (character === "}") braceDepth = Math.max(0, braceDepth - 1);
    else if (character === "[") bracketDepth += 1;
    else if (character === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    else if (character === "(") parenthesisDepth += 1;
    else if (character === ")") parenthesisDepth = Math.max(0, parenthesisDepth - 1);
    if (braceDepth || bracketDepth || parenthesisDepth || text.slice(index, index + 3) !== "and") continue;
    const before = text[index - 1] || " ";
    const after = text[index + 3] || " ";
    if (!/\s/u.test(before) || !/\s/u.test(after)) continue;
    const first = text.slice(0, index).trim();
    const second = text.slice(index + 3).trim();
    return first && second ? [first, second] : [text];
  }
  return [text];
}

function parseRadius(text, variables = {}, lineWidth = lineWidthFromPt(0.4)) {
  const point = parsePgfPoint(text, variables, lineWidth);
  if (point) return { x: Math.abs(point.x), y: Math.abs(point.y) };
  const value = evaluateDeclaredDimension(String(text || ""), variables, lineWidth);
  return { x: value, y: value };
}

function arcSegments(current, startDegrees, endDegrees, radius, bounds) {
  const startRadians = (startDegrees * Math.PI) / 180;
  const deltaDegrees = normalizeArcDelta(startDegrees, endDegrees);
  const count = Math.max(1, Math.ceil(Math.abs(deltaDegrees) / 90));
  const deltaRadians = ((deltaDegrees / count) * Math.PI) / 180;
  const center = {
    x: current.x - radius.x * Math.cos(startRadians),
    y: current.y - radius.y * Math.sin(startRadians)
  };
  let angle = startRadians;
  let point = current;
  const commands = [];
  for (let index = 0; index < count; index += 1) {
    const nextAngle = angle + deltaRadians;
    const control = (4 / 3) * Math.tan((nextAngle - angle) / 4);
    const controlOne = {
      x: point.x - control * radius.x * Math.sin(angle),
      y: point.y + control * radius.y * Math.cos(angle)
    };
    const end = {
      x: center.x + radius.x * Math.cos(nextAngle),
      y: center.y + radius.y * Math.sin(nextAngle)
    };
    const controlTwo = {
      x: end.x + control * radius.x * Math.sin(nextAngle),
      y: end.y - control * radius.y * Math.cos(nextAngle)
    };
    includeCubicBounds(bounds, point, controlOne, controlTwo, end);
    commands.push(`C ${format(controlOne.x)} ${format(-controlOne.y)} ${format(controlTwo.x)} ${format(-controlTwo.y)} ${format(end.x)} ${format(-end.y)}`);
    point = end;
    angle = nextAngle;
  }
  return { commands, end: point };
}

function normalizeArcDelta(start, end) {
  let delta = end - start;
  if (delta === 0) return 360;
  while (delta <= -360) delta += 360;
  while (delta > 360) delta -= 360;
  return delta;
}

function createBounds() {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

function includePoint(bounds, point) {
  bounds.minX = Math.min(bounds.minX, point.x);
  bounds.minY = Math.min(bounds.minY, point.y);
  bounds.maxX = Math.max(bounds.maxX, point.x);
  bounds.maxY = Math.max(bounds.maxY, point.y);
}

function includeCubicBounds(bounds, start, controlOne, controlTwo, end) {
  for (let step = 0; step <= 24; step += 1) {
    const t = step / 24;
    const inverse = 1 - t;
    includePoint(bounds, {
      x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * controlOne.x + 3 * inverse * t ** 2 * controlTwo.x + t ** 3 * end.x,
      y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * controlOne.y + 3 * inverse * t ** 2 * controlTwo.y + t ** 3 * end.y
    });
  }
}

function isFiniteBounds(bounds) {
  return [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(Number.isFinite);
}

function readBalanced(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === open) depth += 1;
    else if (source[index] === close) {
      depth -= 1;
      if (depth === 0) return { content: source.slice(start + 1, index), end: index + 1 };
    }
  }
  return null;
}

function skipWhitespace(source, index) {
  let cursor = index;
  while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
  return cursor;
}

function format(value) {
  return Number(value.toFixed(6)).toString();
}
