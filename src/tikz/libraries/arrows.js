import { evaluateMath, parseDimension } from "../../engine/math.js";
import { splitTopLevel } from "../../engine/options.js";
import { lineWidthFromPt, TIKZ_UNIT } from "../metrics.js";

export const tikzLibrary = {
  "name": "arrows",
  "status": "partial",
  "implementedBy": "src/tikz/libraries/arrows.js:lowerDeclaredArrowTips/parseLegacyArrowExtents/legacyDelimiterArrowMetrics/legacyTriangleArrowMetrics/legacyDiamondArrowMetrics/legacySquareArrowMetrics/legacyCircleArrowMetrics/legacyHookArrowMetrics/legacyCapArrowMetrics + src/engine/options.js:parseArrowOption + src/tikz/metrics.js:createArrowTip/legacyArrowTipBase/legacyLatexArrowGeometryFromLineWidth/normalizeArrowKind + src/renderers/svg/paths.js:inlineArrowGeometry/legacyDelimiterInlineGeometry/legacyTriangleInlineGeometry/legacyDiamondInlineGeometry/legacySquareInlineGeometry/legacyCircleInlineGeometry/legacyHookInlineGeometry/legacyCapInlineGeometry + src/frontend/latex-shell.js:expandTheoreticalComputerScienceLogoMacros + src/engine/evaluate.js:curveArrowTerminalBorderPadding/nodeBorderPoint/polygonBorderPointWithPadding/regularPolygonOuterRadiusExtension",
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
    "legacy round cap, butt cap, triangle 90 cap, triangle 90 cap reversed, fast cap, and fast cap reversed tips at path starts and ends",
    "legacy cap active-line-width geometry, source paint semantics, and backend/tip-end shortening",
    "active-line-width legacy tip geometry and backend/tipend shaft shortening",
    "user-declared arrow tips with pgfpoint move/line/cubic/arc paths",
    "focused \\pgfarrowsdeclare{leaf}{leaf} TCS logo expansion",
    "curved terminal arrow crops on circular, elliptical, regular-polygon, rectangle, diamond, star, and trapezium nodes, including focused convex polygon-corner miters"
  ],
  "notes": "Reviewed locally on 2026-08-06: pgfcorearrows declares lower-case latex as a filled core tip with d=.28pt+.3*linewidth, a 9d tip extent, and no arrows.meta scale key. TikZKit preserves this separately from arrows.meta Latex. It also supports a renderer-neutral subset of \\pgfarrowsdeclare: constant pgfpoint move/line/cubic/arc commands plus qfill, qstroke, or qfillstroke. Literal legacy \\pgfarrowsleftextend/\\pgfarrowsrightextend and \\pgfarrowssetlineend values control stem shortening without inflating the PGF picture box. Setup-code expressions, clipping, arrow hulls, arbitrary TeX macros, and declaration-time line-width arithmetic remain deferred. On 2026-08-07, curved to/edge arrows with terminal tips gained a half-active-line-width extension outside circular and elliptical endpoint crops. The same border-padding path now supports regular polygons using the local PGF outer-separation mitre rule and the target side normal. The focused 2026-08-07 trapezium slice intersects the fully mitered offset convex polygon contour, avoiding the prior arbitrary adjacent-side choice at a shared corner. `arrows-shape-curved-terminal-miters` is the permanent visual driver. On 2026-09-04, built-in arrows.meta sequences gained source-derived per-tip separation; the arrows.meta registry records that shared capability. Also on 2026-09-04, pgflibraryarrows.code.tex and pgfcorearrows.code.tex were reviewed for the legacy delimiter slice: square/round brackets and angle 90/60/45, including reversed spellings, now use the source formulas for active-line-width aperture, backend, tip end, cap/join, and shaft shortening. The flowchart, number-line, and force-vector fixtures are strict semantic and three-reference visual drivers. A second 2026-09-04 source review covered the filled and open triangle 90/60/45 families. TikZKit now applies d=.5pt+.25*linewidth, source-specific aperture and backend/tipend formulas, fillstroke for filled tips, stroke-only rendering for open tips, and the independently declared reversed open-tip extents. The repair-flow, mathematical-map, and free-body fixtures are strict semantic and MacTeX/tikztosvg visual drivers. A third 2026-09-04 review covered the public legacy diamond and open diamond declarations. TikZKit now preserves lower-case diamond separately from arrows.meta Diamond, applies d=.4pt+.275*linewidth, source-specific backend/tipend shortening, round joins with butt caps, fillstroke for diamond, and stroke-only rendering for open diamond at either path end. The validation-flow, mathematical-map, and vector fixtures are strict semantic and MacTeX/tikztosvg visual drivers. A fourth 2026-09-04 review covered square, open square, filled dot `*`, and open dot `o`. TikZKit now applies the source formulas d=.4pt+.275*linewidth for squares and d=.4pt+.2*linewidth for dots, keeps lower-case legacy names distinct from arrows.meta Square/Circle, and uses each declaration's backend/tipend, paint, cap, join, and local reference origin. The release-flow, quotient-map, and vector-field fixtures are strict semantic and MacTeX/tikztosvg visual drivers. A fifth 2026-09-04 review covered left hook, right hook, hooks, and their reversed declarations. TikZKit now applies d=.4pt+.2*linewidth, the exact 0.75/2.415/3.75 and 1.665/3/4.665/6 cubic factors, asymmetric backend/tipend placement, x-only reversal, stroke-only paint, round caps, and miter joins. The validation-flow, mathematical-map, and vector fixtures are strict semantic and MacTeX/tikztosvg visual drivers. A sixth 2026-09-04 review covered round cap, butt cap, triangle 90 cap and reversed, and fast cap and reversed. TikZKit now applies the declaration's active-line-width-only dimensions, distinct stroke-only versus fill-only paint, round versus butt caps, exact reversed polygons, and backend/tip-end shaft shortening. The flowchart, mathematical-map, and force-vector fixtures are strict semantic and MacTeX/tikztosvg visual drivers. Legacy implies and spaced-arrow families, concave/custom shape miters, and full declared-arrow hulls remain partial."
};

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
  if (!/\\pgfarrowsdeclare\b/.test(text)) return text;
  const declarations = new Map();
  const withoutDeclarations = collectDeclarations(text, declarations, diagnostics);
  return declarations.size ? rewriteArrowOptions(withoutDeclarations, declarations) : withoutDeclarations;
}

function collectDeclarations(source, declarations, diagnostics) {
  const command = "\\pgfarrowsdeclare";
  let output = "";
  let index = 0;
  while (index < source.length) {
    const start = source.indexOf(command, index);
    if (start < 0) return output + source.slice(index);
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
    const declared = parseDeclaredArrow(setup.content, drawing.content);
    if (!declared) {
      diagnostics.push({ severity: "warning", message: "Unsupported pgfarrowsdeclare drawing program" });
      output += source.slice(start, drawing.end);
    } else {
      for (const name of [forward.content.trim(), backward.content.trim()]) {
        if (name) declarations.set(name, { ...declared, name });
      }
    }
    index = drawing.end;
  }
  return output;
}

function parseDeclaredArrow(setup, drawing) {
  const commands = [];
  const bounds = createBounds();
  let current = null;
  let paint = null;
  const commandPattern = /\\(pgfpathmoveto|pgfpathlineto|pgfpathcurveto|pgfpatharc|pgfpathclose|pgfusepathqfillstroke|pgfusepathqfill|pgfusepathqstroke)\b/g;
  let cursor = 0;
  let match;
  while ((match = commandPattern.exec(drawing))) {
    if (drawing.slice(cursor, match.index).replace(/[\s%]/g, "").length) return null;
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
      const first = readBalanced(drawing, skipWhitespace(drawing, cursor), "{", "}");
      const second = first && readBalanced(drawing, skipWhitespace(drawing, first.end), "{", "}");
      const third = second && readBalanced(drawing, skipWhitespace(drawing, second.end), "{", "}");
      if (!first || !second || !third || !current) return null;
      const start = evaluateMath(first.content);
      const end = evaluateMath(second.content);
      const radius = parseRadius(third.content);
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
      const argument = readBalanced(drawing, skipWhitespace(drawing, cursor), "{", "}");
      const point = argument && parsePgfPoint(argument.content);
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
  if (drawing.slice(cursor).replace(/[\s%]/g, "").length || !commands.length || !paint || !isFiniteBounds(bounds)) return null;
  const legacyExtents = parseLegacyArrowExtents(setup);
  return {
    path: commands.join(" "),
    paint,
    bounds: {
      minX: bounds.minX,
      maxX: bounds.maxX,
      minY: -bounds.maxY,
      maxY: -bounds.minY
    },
    ...(legacyExtents || {})
  };
}

function parseLegacyArrowExtents(setup) {
  const backEnd = setupDimension(setup, "pgfarrowsleftextend", "pgfarrowssetbackend");
  const tipEnd = setupDimension(setup, "pgfarrowsrightextend", "pgfarrowssettipend");
  const lineEnd = setupDimension(setup, "pgfarrowssetlineend");
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

function setupDimension(setup, ...commands) {
  for (const command of commands) {
    const match = String(setup || "").match(new RegExp(`\\\\${command}\\s*\\{([^{}]+)\\}`));
    if (!match) continue;
    const dimension = String(match[1]).trim().replace(/^\+/, "");
    const value = parseDimension(dimension) * TIKZ_UNIT;
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

function parsePgfPoint(text) {
  const source = String(text || "").trim();
  if (!source.startsWith("\\pgfpoint")) return null;
  let cursor = skipWhitespace(source, "\\pgfpoint".length);
  const x = readBalanced(source, cursor, "{", "}");
  cursor = x ? skipWhitespace(source, x.end) : cursor;
  const y = x && readBalanced(source, cursor, "{", "}");
  if (!x || !y || source.slice(y.end).trim()) return null;
  const xValue = parseDimension(x.content) * TIKZ_UNIT;
  const yValue = parseDimension(y.content) * TIKZ_UNIT;
  return Number.isFinite(xValue) && Number.isFinite(yValue) ? { x: xValue, y: yValue } : null;
}

function parseRadius(text) {
  const point = parsePgfPoint(text);
  if (point) return { x: Math.abs(point.x), y: Math.abs(point.y) };
  const value = parseDimension(String(text || "")) * TIKZ_UNIT;
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
