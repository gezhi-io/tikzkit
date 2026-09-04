import {
  createArrowTip,
  legacyLatexArrowGeometryFromLineWidth,
  latexArrowGeometryFromLineWidth,
  latexSlimArrowGeometryFromLineWidth,
  lineWidthFromPt,
  stealthArrowHalfWidthFromLength,
  stealthArrowLengthFromLineWidth,
  stealthMetaArrowGeometryFromLineWidth,
  stealthPrimeArrowDimensions,
  stealthArrowShortenFromLength
} from "../../tikz/metrics.js";
import { blurShadowFilterId } from "./defs.js";
import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { renderUnitScale, scaleStyleForRenderUnit } from "./layout.js";
import { svgPathData as pathData } from "./pathData.js";
import { styleAttributes } from "./style.js";
import { includePathCommandBounds } from "../../scene/index.js";
import { curvedArrowPaint, curvedArrowTransformAttribute } from "./arrowBending.js";
import {
  legacyCircleArrowMetrics,
  legacyCapArrowMetrics,
  legacyDelimiterArrowMetrics,
  legacyDiamondArrowMetrics,
  legacyHookArrowMetrics,
  legacySerifCmArrowMetrics,
  legacySideToArrowMetrics,
  legacySquareArrowMetrics,
  legacyTriangleArrowMetrics
} from "../../tikz/libraries/arrows.js";
import {
  spacedAngleArrowMetrics,
  spacedCapArrowMetrics,
  spacedDelimiterArrowMetrics,
  spacedHookArrowMetrics,
  spacedImpliesArrowMetrics,
  spacedLegacyArrowMetrics,
  spacedSerifCmArrowMetrics,
  spacedSideToArrowMetrics,
  spacedShapeArrowMetrics,
  spacedTriangleArrowMetrics
} from "../../tikz/libraries/arrows.spaced.js";

export function renderPathWithShadows(item, unit) {
  const shadows = Array.isArray(item.shadows) ? item.shadows : [];
  if (!shadows.length) return renderPathElement(item, unit);
  return `${shadows.map((shadow) => renderPathShadow(item, shadow, unit)).join("")}${renderPathElement(item, unit)}`;
}

export function renderPathShadow(item, shadow, unit) {
  const bounds = pathCommandBounds(item.commands || [], item.tightBezierBounds);
  if (!bounds) return "";
  const scale = Number(shadow?.scale) > 0 ? Number(shadow.scale) : 1;
  const centerX = ((bounds.minX + bounds.maxX) / 2) * unit;
  const centerY = -((bounds.minY + bounds.maxY) / 2) * unit;
  const xshift = (Number(shadow?.xshift) || 0) * unit;
  const yshift = -(Number(shadow?.yshift) || 0) * unit;
  const shadowStyle = {
    ...(item.style || {}),
    ...scaleStyleForRenderUnit(shadow?.style || {}, renderUnitScale(unit)),
    filter: shadow?.blur ? `url(#${blurShadowFilterId(shadow)})` : shadow?.style?.filter,
    markerStart: undefined,
    markerEnd: undefined
  };
  const shadowItem = { ...item, style: shadowStyle, shadows: undefined };
  const transform = `translate(${format(xshift)} ${format(yshift)}) translate(${format(centerX)} ${format(centerY)}) scale(${format(scale)}) translate(${format(-centerX)} ${format(-centerY)})`;
  return `<g class="tikz-path-shadow" transform="${transform}">${renderPathElement(shadowItem, unit)}</g>`;
}

export function renderPathElement(item, unit) {
  if (!item.style?.markerStart && !item.style?.markerEnd) {
    if (item.style?.doubleColor !== undefined) {
      if (usesCompactDashedDoubleStroke(item.style)) {
        return renderCompactDashedDoublePath(item.commands || [], item.style, unit);
      }
      return renderDoublePath(item.commands || [], item.style, unit);
    }
    if (item.subtype === "bagua-line") {
      return `<path d="${pathData(item.commands, unit)}"${styleAttributes(item.style, { lineCap: "butt", lineJoin: "miter" })} />`;
    }
    return `<path d="${pathData(item.commands, unit)}"${styleAttributes(item.style)} />`;
  }
  return renderArrowedPath(item, unit);
}

function pathCommandBounds(commands = [], tightBezierBounds = false) {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  includePathCommandBounds(commands, (x, y) => {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
  }, { tightBezierBounds });
  return Number.isFinite(bounds.minX) ? bounds : null;
}

export function renderArrowedPath(item, unit) {
  const style = item.style || {};
  const terminal = pathTerminalSegments(item.commands || []);
  const startTips = style.markerStart ? resolveInlineArrowTipSequence(style.markerStart, style, "start") : [];
  const endTips = style.markerEnd ? resolveInlineArrowTipSequence(style.markerEnd, style, "end") : [];
  const startTip = startTips.at(-1);
  const endTip = endTips.at(-1);
  const explicitCommands = shortenPathTerminals(
    item.commands || [],
    terminal,
    (Number(style.shortenStart) || 0) / unit,
    (Number(style.shortenEnd) || 0) / unit
  );
  const placedTerminal = pathTerminalSegments(explicitCommands);
  const startShorten = startTip && placedTerminal.first?.shortenable
    ? ((startTip.geometry.terminalPlacement ?? startTip.geometry.shorten) + startTip.separation) / unit
    : 0;
  const endShorten = endTip && placedTerminal.last?.shortenable
    ? ((endTip.geometry.terminalPlacement ?? endTip.geometry.shorten) + endTip.separation) / unit
    : 0;
  const commands = shortenPathTerminals(explicitCommands, placedTerminal, startShorten, endShorten);
  const pathStyle = { ...style, markerStart: undefined, markerEnd: undefined };
  const pieces = [
    pathStyle.doubleColor !== undefined
      ? renderDoublePath(commands, pathStyle, unit, { omitWrapper: true })
      : `<path d="${pathData(commands, unit)}"${styleAttributes(pathStyle, { omitMarkers: true })} />`
  ];

  if (startTips.length && placedTerminal.first) {
    for (const placed of placeResolvedInlineArrowTips(
      startTips,
      placedTerminal.first.start,
      placedTerminal.first.startUx,
      placedTerminal.first.startUy,
      unit
    )) {
      pieces.push(renderInlineArrowTip(placed.tip, placed.point, placedTerminal.first.angle + 180, unit, {
        placed,
        terminal: placedTerminal.first,
        side: "start"
      }));
    }
  }
  if (endTips.length && placedTerminal.last) {
    for (const placed of placeResolvedInlineArrowTips(
      endTips,
      placedTerminal.last.end,
      -(placedTerminal.last.endUx ?? placedTerminal.last.ux),
      -(placedTerminal.last.endUy ?? placedTerminal.last.uy),
      unit
    )) {
      pieces.push(renderInlineArrowTip(placed.tip, placed.point, placedTerminal.last.angle, unit, {
        placed,
        terminal: placedTerminal.last,
        side: "end"
      }));
    }
  }
  return `<g class="tikz-arrowed-path${pathStyle.doubleColor !== undefined ? " tikz-double-path" : ""}">${pieces.join("")}</g>`;
}

export function resolveInlineArrowTipSequence(rawTip, style = {}, side = "end") {
  const rawTips = rawTip?.kind === "sequence" && Array.isArray(rawTip.tips) ? rawTip.tips : [rawTip];
  const ordered = side === "start" ? [...rawTips].reverse() : rawTips;
  const resolved = ordered.filter(Boolean).map((tip) => resolveInlineArrowTip(tip, style));
  if (!resolved.some((tip) => tip.bending)) return resolved;
  return resolved.map((tip) => tip.bending ? tip : { ...tip, bending: { mode: "flex", factor: 1 } });
}

export function placeResolvedInlineArrowTips(tips, endpoint, inwardUx, inwardUy, unit = 1) {
  const placements = new Array(tips.length);
  let outerAdvance = 0;
  for (let index = tips.length - 1; index >= 0; index -= 1) {
    const tip = tips[index];
    const offset = outerAdvance + tip.separation + (Number(tip.geometry.placement) || 0);
    placements[index] = {
      tip,
      curveDistance: outerAdvance + tip.separation,
      point: {
        x: endpoint.x + (Number(inwardUx) || 0) * offset / unit,
        y: endpoint.y + (Number(inwardUy) || 0) * offset / unit
      }
    };
    outerAdvance += tip.separation + tip.assemblyLength;
  }
  return placements;
}

export function renderDoublePath(commands, style = {}, unit, options = {}) {
  const { outerStyle, innerStyle } = doubleStrokeStyles(style);
  const data = pathData(commands, unit);
  const strokeOptions = { omitMarkers: true, lineCap: options.lineCap, lineJoin: options.lineJoin };
  const paths = [
    `<path class="tikz-double-outer" d="${data}"${styleAttributes(outerStyle, strokeOptions)} />`,
    `<path class="tikz-double-inner" d="${data}"${styleAttributes(innerStyle, strokeOptions)} />`
  ].join("");
  if (options.omitWrapper) return paths;
  return `<g class="tikz-double-path">${paths}</g>`;
}

export function renderCompactDashedDoublePath(commands, style = {}, unit) {
  const compactStyle = {
    ...style,
    fill: "none",
    markerStart: undefined,
    markerEnd: undefined,
    doubleColor: undefined,
    doubleDistance: undefined
  };
  return `<path class="tikz-compact-dashed-double" d="${pathData(commands, unit)}"${styleAttributes(compactStyle, {
    omitMarkers: true,
    lineCap: "butt",
    lineJoin: "miter"
  })} />`;
}

export function usesCompactDashedDoubleStroke(style = {}) {
  if (!Array.isArray(style.dashArray) || !style.dashArray.length) return false;
  const stroke = String(style.stroke || "").trim().toLowerCase();
  return stroke === "gray" || stroke === "grey" || stroke === "#808080" || stroke === "rgb(128 128 128)" || stroke === "rgb(50% 50% 50%)";
}

export function doubleStrokeStyles(style = {}) {
  const lineWidth = Number(style.lineWidth) || 1;
  const innerWidth = Number.isFinite(style.doubleDistance) ? style.doubleDistance : lineWidthFromPt(0.6);
  return {
    outerStyle: {
      ...style,
      fill: "none",
      markerStart: undefined,
      markerEnd: undefined,
      lineWidth: lineWidth * 2 + innerWidth
    },
    innerStyle: {
      ...style,
      stroke: style.doubleColor || "white",
      fill: "none",
      markerStart: undefined,
      markerEnd: undefined,
      lineWidth: innerWidth
    }
  };
}

export function pathTerminalSegments(commands) {
  let current = null;
  let currentIndex = -1;
  let first = null;
  let last = null;
  commands.forEach((command, index) => {
    if (command.type === "moveTo") {
      current = { x: command.x, y: command.y };
      currentIndex = index;
      return;
    }
    if (!current) return;
    if (command.type === "lineTo") {
      const end = { x: command.x, y: command.y };
      const segment = terminalSegment(current, end, currentIndex, index, true);
      if (segment) {
        first ||= segment;
        last = segment;
      }
      current = end;
      currentIndex = index;
      return;
    }
    if (command.type === "quadTo") {
      const end = { x: command.x, y: command.y };
      const control = { x: command.x1, y: command.y1 };
      const segment = terminalSegment(current, end, currentIndex, index, true, control, control);
      if (segment) {
        first ||= segment;
        last = segment;
      }
      current = end;
      currentIndex = index;
      return;
    }
    if (command.type === "curveTo") {
      const end = { x: command.x, y: command.y };
      const segment = terminalSegment(current, end, currentIndex, index, true, { x: command.x1, y: command.y1 }, { x: command.x2, y: command.y2 });
      if (segment) {
        first ||= segment;
        last = segment;
      }
      current = end;
      currentIndex = index;
    }
  });
  return { first, last };
}

function terminalSegment(start, end, startIndex, commandIndex, shortenable, startControl = end, endControl = start) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!length) return null;
  const tangentStart = Math.hypot(startControl.x - start.x, startControl.y - start.y)
    ? { x: startControl.x - start.x, y: startControl.y - start.y }
    : { x: dx, y: dy };
  const tangentEnd = Math.hypot(end.x - endControl.x, end.y - endControl.y)
    ? { x: end.x - endControl.x, y: end.y - endControl.y }
    : { x: dx, y: dy };
  const startLength = Math.hypot(tangentStart.x, tangentStart.y) || length;
  const endLength = Math.hypot(tangentEnd.x, tangentEnd.y) || length;
  return {
    start,
    end,
    startIndex,
    commandIndex,
    shortenable,
    startControl,
    endControl,
    ux: dx / length,
    uy: dy / length,
    startUx: tangentStart.x / startLength,
    startUy: tangentStart.y / startLength,
    endUx: tangentEnd.x / endLength,
    endUy: tangentEnd.y / endLength,
    angle: svgAngle(tangentEnd)
  };
}

export function shortenPathTerminals(commands, terminal, startAmount, endAmount) {
  if (!startAmount && !endAmount) return commands;
  const adjusted = commands.map((command) => ({ ...command }));
  if (startAmount && terminal.first) {
    const command = adjusted[terminal.first.startIndex];
    if (command && Number.isFinite(command.x) && Number.isFinite(command.y)) {
      command.x += (terminal.first.startUx ?? terminal.first.ux) * startAmount;
      command.y += (terminal.first.startUy ?? terminal.first.uy) * startAmount;
    }
  }
  if (endAmount && terminal.last) {
    const command = adjusted[terminal.last.commandIndex];
    if (command && Number.isFinite(command.x) && Number.isFinite(command.y)) {
      command.x -= (terminal.last.endUx ?? terminal.last.ux) * endAmount;
      command.y -= (terminal.last.endUy ?? terminal.last.uy) * endAmount;
    }
  }
  return adjusted;
}

export function svgAngle(vector) {
  return (Math.atan2(-vector.y, vector.x) * 180) / Math.PI;
}

export function resolveInlineArrowTip(tip, style = {}) {
  const source = typeof tip === "string" ? {} : tip || {};
  const raw = typeof tip === "string" ? createArrowTip(tip === "arrow" ? "to" : tip) : createArrowTip(tip?.kind, source);
  const baseStroke = style.stroke === "none" ? "black" : style.stroke || "black";
  const explicitStroke = source.stroke && source.stroke !== "context-stroke";
  const fill = raw.fill && raw.fill !== "context-stroke" ? raw.fill : baseStroke;
  const geometry = raw.declaredArrow
    ? {
        path: raw.declaredArrow.path,
        shorten: raw.declaredArrow.usesLegacyExtents
          ? raw.declaredArrow.tipEnd - raw.declaredArrow.lineEnd
          : 0,
        placement: 0,
        bounds: raw.declaredArrow.bounds,
        includeBounds: !raw.declaredArrow.usesLegacyExtents
      }
    : inlineArrowGeometry(raw, style, {
    customLength: usesCustomArrowDimension(source, raw, "length"),
    customWidth: usesCustomArrowDimension(source, raw, "width")
  });
  geometry.bounds ||= {
    minX: -Math.max(Number(raw.length) || 0, Number(geometry.shorten) || 0),
    maxX: 0,
    minY: -(Number(raw.width) || 0) / 2,
    maxY: (Number(raw.width) || 0) / 2
  };
  const spacedLegacyTo = isLegacySpacedToTip(raw.kind);
  const spacedLegacyImplies = isLegacySpacedImpliesTip(raw.kind);
  const spacedLegacyStealthPrime = isLegacySpacedStealthPrimeTip(raw.kind);
  const legacySideTo = isLegacySideToTip(raw.kind);
  const openTip = [
    "to",
    "hook",
    "two-heads",
    "open-circle",
    "open-triangle",
    "straight-barb",
    "arc-barb",
    "tee-barb",
    "rays"
  ].includes(raw.kind)
    || spacedLegacyTo
    || spacedLegacyImplies
    || isLegacyDelimiterTip(raw.kind)
    || isLegacyOpenTriangleTip(raw.kind)
    || isLegacyOpenDiamondTip(raw.kind)
    || isLegacyOpenSquareTip(raw.kind)
    || isLegacyOpenCircleTip(raw.kind)
    || isLegacyHookTip(raw.kind)
    || legacySideTo
    || isLegacyOpenCapTip(raw.kind);
  const legacyBarTip = isLegacyBarTip(raw.kind);
  const barTip = raw.kind === "bar" || legacyBarTip;
  const filledCircleTip = raw.kind === "circle";
  const legacyStealthPrime = raw.kind === "stealth-prime";
  const metaStealthTip = raw.kind === "stealth" && raw.meta;
  const legacyFilledTriangleTip = isLegacyFilledTriangleTip(raw.kind);
  const legacyFilledDiamondTip = isLegacyFilledDiamondTip(raw.kind);
  const legacyFilledSquareTip = isLegacyFilledSquareTip(raw.kind);
  const legacyFilledCircleTip = isLegacyFilledCircleTip(raw.kind);
  const legacyFilledShapeTip = legacyFilledTriangleTip || legacyFilledDiamondTip || legacyFilledSquareTip || legacyFilledCircleTip;
  const filledStrokedTip = metaStealthTip || legacyStealthPrime || spacedLegacyStealthPrime || legacyFilledShapeTip || raw.kind === "dimline" || raw.kind === "dimline reverse";
  const declaredPaint = raw.declaredArrow?.paint;
  const separation = arrowTipSeparation(raw.separation, style);
  return {
    kind: raw.kind,
    geometry,
    bending: raw.bending,
    separation,
    assemblyLength: Number(geometry.assemblyLength) || Number(raw.length) || Math.max(0, (geometry.bounds?.maxX || 0) - (geometry.bounds?.minX || 0)),
    // PGF's default Latex tip is filled and stroked with its normal mitered
    // outline. Round joins are only used when the TikZ arrow option asks for
    // them; applying them globally makes small scaled tips visibly bulbous.
    lineCap: legacyBarTip ? "square" : /^legacy-(?:spaced-)?round-cap$/u.test(raw.kind) ? "round" : isLegacyCapTip(raw.kind) || isLegacyTriangleTip(raw.kind) || isLegacyDiamondTip(raw.kind) || isLegacySquareTip(raw.kind) || isLegacyCircleTip(raw.kind) || isSquareBracketTip(raw.kind) || spacedLegacyStealthPrime || (raw.kind === "latex" && !raw.legacy) || metaStealthTip ? "butt" : "round",
    lineJoin: isLegacyCapTip(raw.kind) || isLegacyTriangleTip(raw.kind) || isLegacyCircleTip(raw.kind) || isLegacyDelimiterTip(raw.kind) || isLegacyHookTip(raw.kind) || (raw.kind === "latex" && !raw.legacy) || metaStealthTip ? "miter" : "round",
    stroke:
      declaredPaint === "stroke" || declaredPaint === "fillstroke"
        ? baseStroke
        : openTip || barTip || filledCircleTip || filledStrokedTip || (raw.kind === "latex" && !raw.legacy) || explicitStroke
        ? raw.stroke === "context-stroke"
          ? baseStroke
          : raw.stroke || baseStroke
        : "none",
    fill: declaredPaint === "stroke" || openTip || barTip || raw.open ? "none" : fill,
    strokeWidth: declaredPaint === "stroke" || declaredPaint === "fillstroke"
      ? style.lineWidth ?? 1
      : barTip
      ? legacyBarTip
        ? style.lineWidth ?? raw.lineWidth ?? 1
        : raw.lineWidth || style.lineWidth || 1
      : openTip
      ? spacedLegacyTo || spacedLegacyImplies || legacySideTo ? geometry.lineWidth : style.lineWidth ?? 1
      : filledCircleTip
        ? style.lineWidth ?? 1
      : filledStrokedTip
        ? legacyFilledShapeTip
          ? style.lineWidth ?? 1
          : metaStealthTip
          ? geometry.lineWidth
          : legacyStealthPrime || spacedLegacyStealthPrime
          ? style.lineWidth ?? 1
          : Math.max(0.2, (style.lineWidth ?? 1) * 0.5)
        : raw.kind === "latex" && !raw.legacy
          ? geometry.lineWidth
        : explicitStroke
          ? Math.max(0.8, (style.lineWidth ?? 1) * 0.45)
          : 0
  };
}

function arrowTipSeparation(separation, style = {}) {
  if (!separation || !Number.isFinite(Number(separation.dimension))) return 0;
  const lineWidth = Math.max(0, Number(style.lineWidth) || 0);
  const innerLineWidth = Number.isFinite(style.doubleDistance) ? Math.max(0, Number(style.doubleDistance)) : lineWidthFromPt(0.6);
  const fullLineWidth = style.doubleColor !== undefined ? 2 * lineWidth + innerLineWidth : lineWidth;
  const outerFactor = Number.isFinite(Number(separation.outerFactor)) ? Number(separation.outerFactor) : 0;
  const effectiveLineWidth = style.doubleColor !== undefined
    ? fullLineWidth - outerFactor * (fullLineWidth + innerLineWidth) / 2
    : lineWidth;
  return Number(separation.dimension) + (Number(separation.lineWidthFactor) || 0) * effectiveLineWidth;
}

export function usesCustomArrowDimension(source = {}, raw = {}, key) {
  if (source[`custom${key[0].toUpperCase()}${key.slice(1)}`] || source[`${key}Explicit`]) return true;
  // Default arrows.meta tips keep a scaled preview dimension in the IR for
  // callers that inspect it. PGF still calculates the painted dimensions from
  // the current stroke width, so that preview must not become `length=...`.
  if (source.meta && !source[`custom${key[0].toUpperCase()}${key.slice(1)}`]) return false;
  if (!Number.isFinite(source[key])) return false;
  const defaultTip = createArrowTip(raw.kind || source.kind || "to");
  return Math.abs(source[key] - defaultTip[key]) > 1e-6;
}

export function inlineArrowGeometry(tip, style = {}, flags = {}) {
  const lineWidth = Math.max(0.01, style.lineWidth ?? 1);
  const lineWidthPt = lineWidth / lineWidthFromPt(1);
  const arrowMetaScale = (key) => {
    if (!tip.meta) return 1;
    const scale = Number(tip[key]);
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  };
  const lengthScale = arrowMetaScale("scale") * arrowMetaScale("lengthScale");
  const widthScale = arrowMetaScale("scale") * arrowMetaScale("widthScale");
  const delimiter = legacyDelimiterArrowMetrics(tip.kind, lineWidth);
  if (delimiter) return legacyDelimiterInlineGeometry(delimiter);
  const spacedDelimiter = spacedDelimiterArrowMetrics(tip.kind, lineWidth);
  if (spacedDelimiter) return legacyDelimiterInlineGeometry(spacedDelimiter);
  const spacedAngle = spacedAngleArrowMetrics(tip.kind, lineWidth);
  if (spacedAngle) return legacyDelimiterInlineGeometry(spacedAngle);
  const legacyTriangle = legacyTriangleArrowMetrics(tip.kind, lineWidth);
  if (legacyTriangle) return legacyTriangleInlineGeometry(legacyTriangle);
  const spacedTriangle = spacedTriangleArrowMetrics(tip.kind, lineWidth);
  if (spacedTriangle) return legacyTriangleInlineGeometry(spacedTriangle);
  const legacyDiamond = legacyDiamondArrowMetrics(tip.kind, lineWidth);
  if (legacyDiamond) return legacyDiamondInlineGeometry(legacyDiamond);
  const spacedShape = spacedShapeArrowMetrics(tip.kind, lineWidth);
  if (spacedShape?.shape === "diamond") return legacyDiamondInlineGeometry(spacedShape);
  const legacySquare = legacySquareArrowMetrics(tip.kind, lineWidth);
  if (legacySquare) return legacySquareInlineGeometry(legacySquare);
  if (spacedShape?.shape === "square") return legacySquareInlineGeometry(spacedShape);
  const legacyCircle = legacyCircleArrowMetrics(tip.kind, lineWidth);
  if (legacyCircle) return legacyCircleInlineGeometry(legacyCircle);
  if (spacedShape?.shape === "circle") return legacyCircleInlineGeometry(spacedShape);
  const legacyHook = legacyHookArrowMetrics(tip.kind, lineWidth);
  if (legacyHook) return legacyHookInlineGeometry(legacyHook);
  const spacedHook = spacedHookArrowMetrics(tip.kind, lineWidth);
  if (spacedHook) return legacyHookInlineGeometry(spacedHook);
  const legacySideTo = legacySideToArrowMetrics(tip.kind, lineWidth);
  if (legacySideTo) return legacySideToInlineGeometry(legacySideTo);
  const spacedSideTo = spacedSideToArrowMetrics(tip.kind, lineWidth);
  if (spacedSideTo) return legacySideToInlineGeometry(spacedSideTo);
  const serifCm = legacySerifCmArrowMetrics(tip.kind, lineWidth)
    || spacedSerifCmArrowMetrics(tip.kind, lineWidth);
  if (serifCm) return legacySerifCmInlineGeometry(serifCm);
  const legacyCap = legacyCapArrowMetrics(tip.kind, lineWidth) || spacedCapArrowMetrics(tip.kind, lineWidth);
  if (legacyCap) return legacyCapInlineGeometry(legacyCap);
  const spacedLegacy = spacedLegacyArrowMetrics(tip.kind, lineWidth);
  if (spacedLegacy) return spacedLegacyArrowInlineGeometry(spacedLegacy);
  const spacedImplies = spacedImpliesArrowMetrics(
    tip.kind,
    lineWidth,
    style.doubleDistance,
    style.doubleColor !== undefined
  );
  if (spacedImplies) return spacedImpliesArrowInlineGeometry(spacedImplies);
  if (tip.kind === "stealth") {
    if (tip.meta) {
      const native = stealthMetaArrowGeometryFromLineWidth(lineWidth, {
        lengthScale,
        widthScale,
        harpoon: tip.harpoon,
        reversed: tip.reversed,
        swap: tip.swap,
        ...(flags.customLength ? { lengthPt: tip.length / lineWidthFromPt(1) } : {}),
        ...(flags.customWidth ? { widthPt: tip.width / lineWidthFromPt(1) } : {})
      });
      const horizontal = native.reversed ? 1 : -1;
      const vertical = native.swap ? -1 : 1;
      return {
        path: [
          "M 0 0",
          `L ${format(horizontal * native.length)} ${format(-vertical * native.halfWidth)}`,
          `L ${format(horizontal * native.insetDistance)} 0`,
          ...(native.harpoon ? [] : [`L ${format(horizontal * native.length)} ${format(vertical * native.halfWidth)}`]),
          "Z"
        ].join(" "),
        shorten: native.shorten,
        assemblyLength: native.assemblyLength,
        terminalPlacement: native.terminalPlacement,
        placement: native.placement,
        lineWidth: native.lineWidth,
        bounds: {
          minX: native.reversed ? 0 : -native.length,
          maxX: native.reversed ? native.length : 0,
          minY: -native.halfWidth,
          maxY: native.halfWidth
        }
      };
    }
    const baseLength = flags.customLength ? tip.length : stealthArrowLengthFromLineWidth(lineWidth);
    const baseHalfWidth = flags.customWidth ? tip.width / 2 : stealthArrowHalfWidthFromLength(baseLength);
    const length = baseLength * lengthScale;
    const halfWidth = baseHalfWidth * widthScale;
    const inset = stealthArrowShortenFromLength(length);
    return {
      path: `M 0 0 L ${format(-length)} ${format(-halfWidth)} L ${format(-inset)} 0 L ${format(-length)} ${format(halfWidth)} Z`,
      shorten: inset,
      assemblyLength: length,
      bounds: {
        minX: -length,
        maxX: 0,
        minY: -halfWidth,
        maxY: halfWidth
      }
    };
  }
  if (tip.kind === "stealth-prime") {
    const dimensions = stealthPrimeArrowDimensions(lineWidth);
    const arrowUnit = dimensions.arrowUnit;
    return {
      path: [
        `M ${format(2 * arrowUnit)} 0`,
        `C ${format(-0.5 * arrowUnit)} ${format(0.5 * arrowUnit)} ${format(-3 * arrowUnit)} ${format(1.5 * arrowUnit)} ${format(-6 * arrowUnit)} ${format(3.25 * arrowUnit)}`,
        `C ${format(-3 * arrowUnit)} ${format(arrowUnit)} ${format(-3 * arrowUnit)} ${format(-arrowUnit)} ${format(-6 * arrowUnit)} ${format(-3.25 * arrowUnit)}`,
        `C ${format(-3 * arrowUnit)} ${format(-1.5 * arrowUnit)} ${format(-0.5 * arrowUnit)} ${format(-0.5 * arrowUnit)} ${format(2 * arrowUnit)} 0 Z`
      ].join(" "),
      shorten: dimensions.rightExtent,
      placement: dimensions.rightExtent,
      bounds: {
        minX: -dimensions.leftExtent,
        maxX: dimensions.rightExtent,
        minY: -dimensions.halfHeight,
        maxY: dimensions.halfHeight
      }
    };
  }
  if (tip.kind === "latexslim") {
    const slim = latexSlimArrowGeometryFromLineWidth(lineWidth);
    const unit = slim.unit;
    return {
      path: [
        "M 0 0",
        `C ${format(-2.5 * unit)} ${format(-0.5 * unit)} ${format(-7 * unit)} ${format(-1.5 * unit)} ${format(-10 * unit)} ${format(-3.75 * unit)}`,
        `C ${format(-7.5 * unit)} ${format(-unit)} ${format(-7.5 * unit)} ${format(unit)} ${format(-10 * unit)} ${format(3.75 * unit)}`,
        `C ${format(-7 * unit)} ${format(1.5 * unit)} ${format(-2.5 * unit)} ${format(0.5 * unit)} 0 0 Z`
      ].join(" "),
      shorten: slim.shorten,
      bounds: {
        minX: -slim.back,
        maxX: 0,
        minY: -slim.halfWidth,
        maxY: slim.halfWidth
      }
    };
  }
  if (tip.kind === "latex") {
    if (tip.legacy) {
      const classic = legacyLatexArrowGeometryFromLineWidth(lineWidth);
      const unit = classic.unit;
      return {
        path: [
          "M 0 0",
          `C ${format(-2.6667 * unit)} ${format(-0.5 * unit)} ${format(-7 * unit)} ${format(-2 * unit)} ${format(-10 * unit)} ${format(-3.75 * unit)}`,
          `L ${format(-10 * unit)} ${format(3.75 * unit)}`,
          `C ${format(-7 * unit)} ${format(2 * unit)} ${format(-2.6667 * unit)} ${format(0.5 * unit)} 0 0 Z`
        ].join(" "),
        shorten: classic.shorten,
        bounds: {
          minX: -classic.back,
          maxX: 0,
          minY: -classic.halfWidth,
          maxY: classic.halfWidth
        }
      };
    }
    const native = latexArrowGeometryFromLineWidth(lineWidth, {
      lengthScale,
      widthScale,
      ...(flags.customLength ? { lengthPt: tip.length / lineWidthFromPt(1) } : {}),
      ...(flags.customWidth ? { widthPt: tip.width / lineWidthFromPt(1) } : {})
    });
    const length = native.length;
    const halfWidth = native.halfWidth;
    return {
      path: [
        `M 0 0`,
        // PGF's Latex tip leaves the point almost tangentially, then rounds
        // out towards its base. Keeping this control-point order is visible
        // on small scaled tips such as Latex[scale=0.5].
        `C ${format(-length * 0.124)} ${format(-halfWidth * 0.077)} ${format(-length * 0.664)} ${format(-halfWidth * 0.519)} ${format(-length)} ${format(-halfWidth)}`,
        `L ${format(-length)} ${format(halfWidth)}`,
        `C ${format(-length * 0.664)} ${format(halfWidth * 0.519)} ${format(-length * 0.124)} ${format(halfWidth * 0.077)} 0 0 Z`
      ].join(" "),
      shorten: native.shorten,
      assemblyLength: native.assemblyLength,
      placement: native.tipPlacement,
      terminalPlacement: native.terminalPlacement,
      lineWidth: native.lineWidth
    };
  }
  if (tip.kind === "two-heads") {
    const length = tip.length;
    const halfWidth = tip.width / 2;
    return {
      path: `M 0 0 L ${format(-length * 0.56)} ${format(-halfWidth)} M 0 0 L ${format(-length * 0.56)} ${format(halfWidth)} M ${format(
        -length * 0.44
      )} 0 L ${format(-length)} ${format(-halfWidth)} M ${format(-length * 0.44)} 0 L ${format(-length)} ${format(halfWidth)}`,
      shorten: lineWidth
    };
  }
  if (tip.kind === "hook") {
    const length = tip.length;
    const halfWidth = tip.width / 2;
    const curl = length * 0.34;
    return {
      path: `M 0 ${format(halfWidth)} C ${format(curl * 0.55)} ${format(halfWidth)} ${format(curl)} ${format(halfWidth * 0.52)} ${format(
        curl
      )} ${format(halfWidth * 0.25)} C ${format(curl)} ${format(halfWidth * 0.05)} ${format(curl * 0.45)} 0 0 0`,
      shorten: 0
    };
  }
  if (tip.kind === "open-circle") {
    const radius = tip.width / 2;
    return {
      path: `M ${format(-radius)} 0 A ${format(radius)} ${format(radius)} 0 1 0 ${format(radius)} 0 A ${format(radius)} ${format(radius)} 0 1 0 ${format(
        -radius
      )} 0`,
      shorten: radius
    };
  }
  if (tip.kind === "circle") {
    // pgflibraryarrows.code.tex defines `*` from the current line width:
    // temp = .4pt + .2*linewidth, center = -3*temp, radius = 4.5*temp.
    // Its reference point is the right arrow extent, not the circle center.
    const temp = lineWidthFromPt(0.4 + 0.2 * lineWidthPt);
    const radius = temp * 4.5;
    const centerX = -temp * 3;
    const rightExtent = temp * 1.5 + lineWidth / 2;
    return {
      path: `M ${format(centerX - radius)} 0 A ${format(radius)} ${format(radius)} 0 1 0 ${format(centerX + radius)} 0 A ${format(radius)} ${format(radius)} 0 1 0 ${format(
        centerX - radius
      )} 0`,
      shorten: rightExtent,
      placement: rightExtent,
      centerX,
      radius
    };
  }
  if (tip.kind === "open-triangle") {
    const length = tip.length;
    const halfWidth = tip.width / 2;
    return {
      path: `M 0 0 L ${format(-length)} ${format(-halfWidth)} L ${format(-length)} ${format(halfWidth)} Z`,
      shorten: length
    };
  }
  if (tip.kind === "straight-barb") {
    const length = flags.customLength ? tip.length : lineWidthFromPt(1.5 + 2.15 * lineWidthPt);
    const halfWidth = flags.customWidth ? tip.width / 2 : lineWidthFromPt(1.35 + 1.9 * lineWidthPt);
    return {
      path: `M 0 0 L ${format(-length)} ${format(-halfWidth)} M 0 0 L ${format(-length)} ${format(halfWidth)}`,
      shorten: 0
    };
  }
  if (tip.kind === "arc-barb") {
    const length = flags.customLength ? tip.length : lineWidthFromPt(1.65 + 2.3 * lineWidthPt);
    const halfWidth = flags.customWidth ? tip.width / 2 : lineWidthFromPt(1.45 + 2.0 * lineWidthPt);
    return {
      path: [
        `M 0 0`,
        `C ${format(-length * 0.34)} ${format(-halfWidth * 0.14)} ${format(-length * 0.72)} ${format(-halfWidth * 0.62)} ${format(-length)} ${format(-halfWidth)}`,
        `M 0 0`,
        `C ${format(-length * 0.34)} ${format(halfWidth * 0.14)} ${format(-length * 0.72)} ${format(halfWidth * 0.62)} ${format(-length)} ${format(halfWidth)}`
      ].join(" "),
      shorten: 0
    };
  }
  if (tip.kind === "tee-barb") {
    const length = flags.customLength ? tip.length : lineWidthFromPt(1.5 + 2.15 * lineWidthPt);
    const halfWidth = flags.customWidth ? tip.width / 2 : lineWidthFromPt(1.35 + 1.9 * lineWidthPt);
    return {
      path: [
        `M 0 ${format(-halfWidth)}`,
        `L 0 ${format(halfWidth)}`,
        `M 0 0`,
        `L ${format(-length)} ${format(-halfWidth)}`,
        `M 0 0`,
        `L ${format(-length)} ${format(halfWidth)}`
      ].join(" "),
      shorten: 0
    };
  }
  if (tip.kind === "kite") {
    const length = flags.customLength ? tip.length : lineWidthFromPt(2.2 + 3.6 * lineWidthPt);
    const halfWidth = flags.customWidth ? tip.width / 2 : lineWidthFromPt(1.1 + 2.6 * lineWidthPt);
    return {
      path: `M 0 0 L ${format(-length * 0.55)} ${format(-halfWidth)} L ${format(-length)} 0 L ${format(-length * 0.55)} ${format(halfWidth)} Z`,
      shorten: length * 0.82
    };
  }
  if (tip.kind === "square") {
    const side = flags.customWidth ? tip.width : lineWidthFromPt(1.4 + 2.8 * lineWidthPt);
    const length = flags.customLength ? tip.length : side;
    const halfWidth = side / 2;
    return {
      path: `M 0 ${format(-halfWidth)} L ${format(-length)} ${format(-halfWidth)} L ${format(-length)} ${format(halfWidth)} L 0 ${format(
        halfWidth
      )} Z`,
      shorten: length
    };
  }
  if (tip.kind === "rays") {
    const length = flags.customLength ? tip.length : lineWidthFromPt(1.8 + 2.7 * lineWidthPt);
    const halfWidth = flags.customWidth ? tip.width / 2 : lineWidthFromPt(1.7 + 2.4 * lineWidthPt);
    return {
      path: [
        `M 0 0`,
        `L ${format(-length)} ${format(-halfWidth)}`,
        `M 0 0`,
        `L ${format(-length * 0.82)} 0`,
        `M 0 0`,
        `L ${format(-length)} ${format(halfWidth)}`
      ].join(" "),
      shorten: 0
    };
  }
  if (tip.kind === "bar") {
    const halfWidth = tip.width / 2;
    return {
      path: `M 0 ${format(-halfWidth)} L 0 ${format(halfWidth)}`,
      shorten: 0
    };
  }
  if (tip.kind === "dimline" || tip.kind === "dimline reverse") {
    const scale = lineWidth;
    const sign = tip.kind === "dimline reverse" ? 1 : -1;
    return {
      path: [
        `M 0 ${format(3 * scale)}`,
        `L 0 ${format(-3 * scale)}`,
        `M 0 0`,
        `L ${format(sign * 7.5 * scale)} ${format(2 * scale)}`,
        `L ${format(sign * 7.5 * scale)} ${format(-2 * scale)}`,
        "Z"
      ].join(" "),
      shorten: lineWidth * 0.2
    };
  }
  const back = flags.customLength ? tip.length : lineWidthFromPt(0.280535 + 2.289088 * lineWidthPt);
  const halfWidth = flags.customWidth ? tip.width / 2 : lineWidthFromPt(0.474889 + 2.796962 * lineWidthPt);
  const assemblyLength = flags.customLength ? tip.length : lineWidthFromPt(1.6 + 2.2 * lineWidthPt);
  return {
    path: [
      `M ${format(-back)} ${format(halfWidth)}`,
      `C ${format(-back * 0.817)} ${format(halfWidth * 0.4)} ${format(-back * 0.409)} ${format(halfWidth * 0.116)} 0 0`,
      `C ${format(-back * 0.409)} ${format(-halfWidth * 0.116)} ${format(-back * 0.817)} ${format(-halfWidth * 0.4)} ${format(-back)} ${format(
        -halfWidth
      )}`
    ].join(" "),
    shorten: lineWidth,
    terminalPlacement: lineWidth,
    placement: lineWidth / 2,
    assemblyLength,
    bounds: { minX: -back, maxX: 0, minY: -halfWidth, maxY: halfWidth }
  };
}

function isLegacyDelimiterTip(kind) {
  return /^(?:(?:square-bracket|round-bracket|angle-(?:90|60|45))(?:-reversed)?|legacy-bar|legacy-spaced-(?:(?:square|round)-bracket(?:-reversed)?|bar|angle-(?:90|60|45)(?:-reversed)?))$/u.test(String(kind || ""));
}

function isSquareBracketTip(kind) {
  return /^(?:legacy-spaced-)?square-bracket(?:-reversed)?$/u.test(String(kind || ""));
}

function isLegacyBarTip(kind) {
  return /^(?:legacy-bar|legacy-spaced-bar)$/u.test(String(kind || ""));
}

function isLegacyTriangleTip(kind) {
  return /^(?:legacy-spaced-)?(?:open-)?triangle-(?:90|60|45)(?:-reversed)?$/u.test(String(kind || ""));
}

function isLegacyOpenTriangleTip(kind) {
  return /^(?:legacy-spaced-)?open-triangle-(?:90|60|45)(?:-reversed)?$/u.test(String(kind || ""));
}

function isLegacyFilledTriangleTip(kind) {
  return /^(?:legacy-spaced-)?triangle-(?:90|60|45)(?:-reversed)?$/u.test(String(kind || ""));
}

function isLegacyDiamondTip(kind) {
  return /^legacy-(?:spaced-)?(?:open-)?diamond$/u.test(String(kind || ""));
}

function isLegacyOpenDiamondTip(kind) {
  return /^legacy-(?:spaced-)?open-diamond$/u.test(String(kind || ""));
}

function isLegacyFilledDiamondTip(kind) {
  return /^legacy-(?:spaced-)?diamond$/u.test(String(kind || ""));
}

function isLegacySquareTip(kind) {
  return /^legacy-(?:spaced-)?(?:open-)?square$/u.test(String(kind || ""));
}

function isLegacyOpenSquareTip(kind) {
  return /^legacy-(?:spaced-)?open-square$/u.test(String(kind || ""));
}

function isLegacyFilledSquareTip(kind) {
  return /^legacy-(?:spaced-)?square$/u.test(String(kind || ""));
}

function isLegacyCircleTip(kind) {
  return /^legacy-(?:spaced-)?(?:filled|open)-circle$/u.test(String(kind || ""));
}

function isLegacyOpenCircleTip(kind) {
  return /^legacy-(?:spaced-)?open-circle$/u.test(String(kind || ""));
}

function isLegacyFilledCircleTip(kind) {
  return /^legacy-(?:spaced-)?filled-circle$/u.test(String(kind || ""));
}

function isLegacyHookTip(kind) {
  return /^legacy-(?:spaced-)?(?:(?:left|right)-hook|hooks)(?:-reversed)?$/u.test(String(kind || ""));
}

function isLegacySideToTip(kind) {
  return /^legacy-(?:spaced-)?(?:left|right)-to(?:-reversed)?$/u.test(String(kind || ""));
}

function isLegacyCapTip(kind) {
  return /^legacy-(?:spaced-)?(?:(?:round|butt)-cap|(?:triangle-90|fast)-cap(?:-reversed)?)$/u.test(String(kind || ""));
}

function isLegacyOpenCapTip(kind) {
  return /^legacy-(?:spaced-)?(?:round|butt)-cap$/u.test(String(kind || ""));
}

function isLegacySpacedToTip(kind) {
  return /^legacy-spaced-to(?:-reversed)?$/u.test(String(kind || ""));
}

function isLegacySpacedImpliesTip(kind) {
  return String(kind || "") === "legacy-spaced-implies";
}

function isLegacySpacedStealthPrimeTip(kind) {
  return /^legacy-spaced-stealth-prime(?:-reversed)?$/u.test(String(kind || ""));
}

function legacySquareInlineGeometry(metrics) {
  return {
    path: [
      `M ${format(metrics.frontX)} ${format(-metrics.halfHeight)}`,
      `L ${format(metrics.backX)} ${format(-metrics.halfHeight)}`,
      `L ${format(metrics.backX)} ${format(metrics.halfHeight)}`,
      `L ${format(metrics.frontX)} ${format(metrics.halfHeight)}`,
      "Z"
    ].join(" "),
    shorten: metrics.placement,
    terminalPlacement: metrics.placement,
    placement: metrics.placement,
    assemblyLength: metrics.assemblyLength,
    bounds: {
      minX: Math.min(metrics.backX, metrics.frontX),
      maxX: Math.max(metrics.backX, metrics.frontX),
      minY: -metrics.halfHeight,
      maxY: metrics.halfHeight
    }
  };
}

function legacyCircleInlineGeometry(metrics) {
  const left = metrics.centerX - metrics.radius;
  const right = metrics.centerX + metrics.radius;
  return {
    path: [
      `M ${format(left)} 0`,
      `A ${format(metrics.radius)} ${format(metrics.radius)} 0 1 0 ${format(right)} 0`,
      `A ${format(metrics.radius)} ${format(metrics.radius)} 0 1 0 ${format(left)} 0`,
      "Z"
    ].join(" "),
    shorten: metrics.placement,
    terminalPlacement: metrics.placement,
    placement: metrics.placement,
    assemblyLength: metrics.assemblyLength,
    centerX: metrics.centerX,
    radius: metrics.radius,
    bounds: {
      minX: left,
      maxX: right,
      minY: -metrics.radius,
      maxY: metrics.radius
    }
  };
}

function legacyHookInlineGeometry(metrics) {
  const horizontal = metrics.reversed ? -1 : 1;
  const hookPath = (vertical, includeStem) => [
    includeStem
      ? `M 0 0 L ${format(horizontal * 0.75 * metrics.unit)} 0`
      : `M ${format(horizontal * 0.75 * metrics.unit)} 0`,
    `C ${format(horizontal * 2.415 * metrics.unit)} 0 ${format(horizontal * 3.75 * metrics.unit)} ${format(vertical * 1.665 * metrics.unit)} ${format(horizontal * 3.75 * metrics.unit)} ${format(vertical * 3 * metrics.unit)}`,
    `C ${format(horizontal * 3.75 * metrics.unit)} ${format(vertical * 4.665 * metrics.unit)} ${format(horizontal * 2.415 * metrics.unit)} ${format(vertical * 6 * metrics.unit)} ${format(horizontal * 0.75 * metrics.unit)} ${format(vertical * 6 * metrics.unit)}`
  ].join(" ");
  const paths = [];
  if (metrics.side === "left" || metrics.side === "both") paths.push(hookPath(-1, true));
  if (metrics.side === "right" || metrics.side === "both") paths.push(hookPath(1, paths.length === 0));

  return {
    path: paths.join(" "),
    shorten: metrics.placement,
    terminalPlacement: metrics.placement,
    placement: metrics.placement,
    assemblyLength: metrics.assemblyLength,
    bounds: {
      minX: metrics.minX,
      maxX: metrics.maxX,
      minY: -metrics.maxY,
      maxY: -metrics.minY
    }
  };
}

function legacyCapInlineGeometry(metrics) {
  const w = metrics.lineWidth;
  const point = (x, y) => `${format(x * w)} ${format(-y * w)}`;
  let paths;

  if (metrics.variant === "round") {
    paths = [`M ${point(0, 0)} L ${point(0.5, 0)}`];
  } else if (metrics.variant === "butt") {
    paths = [`M ${point(-0.1, 0)} L ${point(0.5, 0)}`];
  } else if (metrics.variant === "triangle-90" && !metrics.reversed) {
    paths = [`M ${point(-0.1, 0.5)} L ${point(0.5, 0.5)} L ${point(1, 0)} L ${point(0.5, -0.5)} L ${point(-0.1, -0.5)} Z`];
  } else if (metrics.variant === "triangle-90") {
    paths = [`M ${point(1, 0.5)} L ${point(-0.1, 0.5)} L ${point(-0.1, -0.5)} L ${point(1, -0.5)} L ${point(0.5, 0)} Z`];
  } else if (!metrics.reversed) {
    paths = [
      `M ${point(-0.1, 0.5)} L ${point(0.5, 0.5)} L ${point(1, 0)} L ${point(0.5, -0.5)} L ${point(-0.1, -0.5)} Z`,
      `M ${point(1, 0.5)} L ${point(1.5, 0.5)} L ${point(2, 0)} L ${point(1.5, -0.5)} L ${point(1, -0.5)} L ${point(1.5, 0)} Z`
    ];
  } else {
    paths = [
      `M ${point(-0.1, 0.5)} L ${point(1, 0.5)} L ${point(0.5, 0)} L ${point(1, -0.5)} L ${point(-0.1, -0.5)} Z`,
      `M ${point(1.5, 0.5)} L ${point(2, 0.5)} L ${point(1.5, 0)} L ${point(2, -0.5)} L ${point(1.5, -0.5)} L ${point(1, 0)} Z`
    ];
  }

  return {
    path: paths.join(" "),
    shorten: metrics.placement,
    terminalPlacement: metrics.placement,
    placement: metrics.placement,
    assemblyLength: metrics.assemblyLength,
    bounds: {
      minX: metrics.minX,
      maxX: metrics.maxX,
      minY: -metrics.halfHeight,
      maxY: metrics.halfHeight
    }
  };
}

function spacedLegacyArrowInlineGeometry(metrics) {
  const u = metrics.unit;
  const reflect = metrics.reversed ? -1 : 1;
  const point = (x, y) => `${format(reflect * x * u)} ${format(-y * u)}`;
  const sourcePoint = (x, y) => `${format(x * u)} ${format(-y * u)}`;
  let path;

  if (metrics.family === "to") {
    path = metrics.reversed
      ? [
          `M ${sourcePoint(3.5, 4)}`,
          `C ${sourcePoint(3.25, 2.5)} ${sourcePoint(0.5, 0.25)} ${sourcePoint(-0.25, 0)}`,
          `C ${sourcePoint(0.5, -0.25)} ${sourcePoint(3.25, -2.5)} ${sourcePoint(3.5, -4)}`
        ].join(" ")
      : [
          `M ${sourcePoint(-3, 4)}`,
          `C ${sourcePoint(-2.75, 2.5)} ${sourcePoint(0, 0.25)} ${sourcePoint(0.75, 0)}`,
          `C ${sourcePoint(0, -0.25)} ${sourcePoint(-2.75, -2.5)} ${sourcePoint(-3, -4)}`
        ].join(" ");
  } else if (metrics.family === "latex") {
    path = [
      `M ${point(9, 0)}`,
      `C ${point(6.3333, 0.5)} ${point(2, 2)} ${point(-1, 3.75)}`,
      `L ${point(-1, -3.75)}`,
      `C ${point(2, -2)} ${point(6.3333, -0.5)} ${point(9, 0)} Z`
    ].join(" ");
  } else if (metrics.family === "latex-prime") {
    path = [
      `M ${point(6, 0)}`,
      `C ${point(3.5, 0.5)} ${point(-1, 1.5)} ${point(-4, 3.75)}`,
      `C ${point(-1.5, 1)} ${point(-1.5, -1)} ${point(-4, -3.75)}`,
      `C ${point(-1, -1.5)} ${point(3.5, -0.5)} ${point(6, 0)} Z`
    ].join(" ");
  } else if (metrics.family === "stealth") {
    path = [
      `M ${point(5, 0)}`,
      `L ${point(-3, 4)}`,
      `L ${point(0, 0)}`,
      `L ${point(-3, -4)} Z`
    ].join(" ");
  } else {
    path = [
      `M ${point(2, 0)}`,
      `C ${point(-0.5, 0.5)} ${point(-3, 1.5)} ${point(-6, 3.25)}`,
      `C ${point(-3, 1)} ${point(-3, -1)} ${point(-6, -3.25)}`,
      `C ${point(-3, -1.5)} ${point(-0.5, -0.5)} ${point(2, 0)} Z`
    ].join(" ");
  }

  return {
    path,
    shorten: metrics.terminalPlacement,
    terminalPlacement: metrics.terminalPlacement,
    placement: metrics.placement,
    assemblyLength: metrics.assemblyLength,
    lineWidth: metrics.arrowLineWidth,
    bounds: {
      minX: metrics.backEnd,
      maxX: metrics.tipEnd,
      minY: -metrics.halfHeight,
      maxY: metrics.halfHeight
    }
  };
}

function legacySideToInlineGeometry(metrics) {
  const u = metrics.unit;
  const lineWidth = metrics.lineWidth;
  const sign = metrics.side === "left" ? 1 : -1;
  const point = (x, y) => `${format(x)} ${format(-sign * y)}`;
  let path;
  let parts;

  if (metrics.reversed) {
    const stem = `M ${format(0.5 * lineWidth)} 0 L ${format(-0.1 * lineWidth)} 0`;
    const curve = [
      `M ${point(3.75 * u + metrics.xShift, 4 * u)}`,
      `C ${point(3.5 * u + metrics.xShift, 2.5 * u)} ${point(0.75 * u + metrics.xShift, 0.25 * u)} ${point(metrics.xShift, 0.125 * lineWidth)}`,
      `M ${point(3.75 * u + metrics.xShift, 4 * u)}`,
      `C ${point(3.5 * u + metrics.xShift, 2.5 * u)} ${point(0.75 * u + metrics.xShift, 0.25 * u)} ${point(metrics.xShift, -0.125 * lineWidth)}`
    ].join(" ");
    parts = [
      { name: "stem", path: stem, strokeWidth: lineWidth, lineCap: "butt", lineJoin: "round" },
      { name: "curve", path: curve, strokeWidth: metrics.arrowLineWidth, lineCap: "round", lineJoin: "round" }
    ];
    path = `${stem} ${curve}`;
  } else {
    path = [
      `M ${point(-3 * u, 4 * u)}`,
      `C ${point(-2.75 * u, 2.5 * u)} ${point(0, 0.25 * u)} ${point(0.75 * u, 0)}`,
      `C ${point(0.55 * u, -0.125 * lineWidth)} ${point(0.5 * u, -0.125 * lineWidth)} ${point(0.5 * u, -0.125 * lineWidth)}`,
      `L ${point(0, -0.125 * lineWidth)}`
    ].join(" ");
  }

  return {
    path,
    ...(parts ? { parts } : {}),
    shorten: metrics.terminalPlacement,
    terminalPlacement: metrics.terminalPlacement,
    placement: metrics.placement,
    assemblyLength: metrics.assemblyLength,
    lineWidth: metrics.arrowLineWidth,
    bounds: {
      minX: metrics.minX,
      maxX: metrics.maxX,
      minY: metrics.minY,
      maxY: metrics.maxY
    }
  };
}

function legacySerifCmInlineGeometry(metrics) {
  const d = metrics.unit;
  const w = metrics.lineWidth;
  const shift = metrics.xShift;
  const point = (x, y) => `${format(x + shift)} ${format(-y)}`;
  return {
    path: [
      `M ${point(-0.75 * d, 0.5 * w)}`,
      `C ${point(-0.375 * d, 0.5 * w)} ${point(-0.375 * d, 0.7 * w)} ${point(-0.375 * d, 1.95 * d)}`,
      `L ${point(0, 1.95 * d)}`,
      `C ${point(-0.04 * w, 0.5 * d)} ${point(-0.04 * w, -0.5 * d)} ${point(0, -1.95 * d)}`,
      `L ${point(-0.375 * d, -1.95 * d)}`,
      `C ${point(-0.375 * d, -0.7 * w)} ${point(-0.375 * d, -0.5 * w)} ${point(-0.75 * d, -0.5 * w)}`,
      "Z"
    ].join(" "),
    shorten: metrics.terminalPlacement,
    terminalPlacement: metrics.terminalPlacement,
    placement: metrics.placement,
    assemblyLength: metrics.assemblyLength,
    bounds: {
      minX: metrics.minX,
      maxX: metrics.maxX,
      minY: -metrics.halfHeight,
      maxY: metrics.halfHeight
    }
  };
}

function spacedImpliesArrowInlineGeometry(metrics) {
  const dima = metrics.dima;
  const xshift = 0.06 * dima;
  const point = (x, y) => `${format(x + xshift)} ${format(-y)}`;
  return {
    path: [
      `M ${point(-1.4 * dima, 2.65 * dima)}`,
      `C ${point(-0.75 * dima, 1.25 * dima)} ${point(dima, 0.05 * dima)} ${point(2 * dima, 0)}`,
      `C ${point(dima, -0.05 * dima)} ${point(-0.75 * dima, -1.25 * dima)} ${point(-1.4 * dima, -2.65 * dima)}`
    ].join(" "),
    shorten: metrics.terminalPlacement,
    terminalPlacement: metrics.terminalPlacement,
    placement: metrics.placement,
    assemblyLength: metrics.assemblyLength,
    lineWidth: metrics.arrowLineWidth,
    bounds: {
      minX: metrics.backEnd,
      maxX: metrics.tipEnd,
      minY: -metrics.halfHeight,
      maxY: metrics.halfHeight
    }
  };
}

function legacyDiamondInlineGeometry(metrics) {
  return {
    path: [
      `M ${format(metrics.frontX)} 0`,
      `L ${format(metrics.middleX)} ${format(-metrics.halfHeight)}`,
      `L ${format(metrics.backX)} 0`,
      `L ${format(metrics.middleX)} ${format(metrics.halfHeight)}`,
      "Z"
    ].join(" "),
    shorten: metrics.placement,
    terminalPlacement: metrics.placement,
    placement: metrics.placement,
    assemblyLength: metrics.assemblyLength,
    bounds: {
      minX: Math.min(metrics.backX, metrics.frontX),
      maxX: Math.max(metrics.backX, metrics.frontX),
      minY: -metrics.halfHeight,
      maxY: metrics.halfHeight
    }
  };
}

function legacyTriangleInlineGeometry(metrics) {
  return {
    path: [
      `M ${format(metrics.backX)} ${format(-metrics.halfHeight)}`,
      `L ${format(metrics.tipX)} 0`,
      `L ${format(metrics.backX)} ${format(metrics.halfHeight)}`,
      "Z"
    ].join(" "),
    shorten: metrics.placement,
    terminalPlacement: metrics.placement,
    placement: metrics.placement,
    assemblyLength: metrics.assemblyLength,
    bounds: {
      minX: Math.min(metrics.backX, metrics.tipX),
      maxX: Math.max(metrics.backX, metrics.tipX),
      minY: -metrics.halfHeight,
      maxY: metrics.halfHeight
    }
  };
}

function legacyDelimiterInlineGeometry(metrics) {
  const direction = metrics.reversed ? -1 : 1;
  let path;
  let bounds;

  if (metrics.shape === "bar") {
    path = `M ${format(metrics.barX)} ${format(-metrics.halfHeight)} L ${format(metrics.barX)} ${format(metrics.halfHeight)}`;
    bounds = {
      minX: metrics.barX,
      maxX: metrics.barX,
      minY: -metrics.halfHeight,
      maxY: metrics.halfHeight
    };
  } else if (metrics.shape === "square-bracket") {
    const innerX = direction * -metrics.arm;
    path = [
      `M ${format(innerX)} ${format(-metrics.halfHeight)}`,
      `L 0 ${format(-metrics.halfHeight)}`,
      `L 0 ${format(metrics.halfHeight)}`,
      `L ${format(innerX)} ${format(metrics.halfHeight)}`
    ].join(" ");
    bounds = {
      minX: Math.min(0, innerX),
      maxX: Math.max(0, innerX),
      minY: -metrics.halfHeight,
      maxY: metrics.halfHeight
    };
  } else if (metrics.shape === "round-bracket") {
    const endX = direction * -0.5 * metrics.halfHeight;
    const controlX = direction * 0.25 * metrics.halfHeight;
    path = [
      `M ${format(endX)} ${format(-metrics.halfHeight)}`,
      `C ${format(controlX)} ${format(-0.5 * metrics.halfHeight)} ${format(controlX)} ${format(0.5 * metrics.halfHeight)} ${format(endX)} ${format(metrics.halfHeight)}`
    ].join(" ");
    bounds = {
      minX: Math.min(endX, controlX),
      maxX: Math.max(endX, controlX),
      minY: -metrics.halfHeight,
      maxY: metrics.halfHeight
    };
  } else {
    const backX = direction * metrics.backX;
    const tipX = direction * metrics.tipX;
    path = `M ${format(backX)} ${format(-metrics.halfHeight)} L ${format(tipX)} 0 L ${format(backX)} ${format(metrics.halfHeight)}`;
    bounds = {
      minX: Math.min(backX, tipX),
      maxX: Math.max(backX, tipX),
      minY: -metrics.halfHeight,
      maxY: metrics.halfHeight
    };
  }

  return {
    path,
    shorten: metrics.placement,
    terminalPlacement: metrics.placement,
    placement: metrics.placement,
    assemblyLength: metrics.assemblyLength,
    bounds
  };
}

export function renderInlineArrowTip(tip, point, angle, unit, curveContext = {}) {
  const parts = Array.isArray(tip.geometry.parts) && tip.geometry.parts.length
    ? tip.geometry.parts
    : [{ path: tip.geometry.path }];
  return parts.map((part) => {
    const partTip = part.path === tip.geometry.path
      ? tip
      : { ...tip, geometry: { ...tip.geometry, path: part.path } };
    const curved = curvedArrowPaint(partTip, curveContext.placed, curveContext.terminal, curveContext.side, unit);
    const strokeWidth = Number.isFinite(Number(part.strokeWidth)) ? Number(part.strokeWidth) : tip.strokeWidth;
    const stroke = part.stroke || tip.stroke;
    const fill = part.fill || tip.fill;
    const strokePart = strokeWidth > 0
      ? ` stroke="${escapeAttribute(stroke)}" stroke-width="${format(strokeWidth)}"`
      : ` stroke="none"`;
    const lineStyle = strokeWidth > 0
      ? ` stroke-linecap="${escapeAttribute(part.lineCap || tip.lineCap || "round")}" stroke-linejoin="${escapeAttribute(part.lineJoin || tip.lineJoin || "round")}"`
      : "";
    const modeClass = curved ? ` tikz-arrow-${escapeAttribute(curved.mode)}` : "";
    const partClass = part.name ? ` tikz-arrow-part-${escapeAttribute(part.name)}` : "";
    const path = curved?.path || part.path;
    const transform = curved
      ? curvedArrowTransformAttribute(curved)
      : ` transform="translate(${format(point.x * unit)} ${format(-point.y * unit)}) rotate(${format(angle)})"`;
    return `<path class="tikz-arrow-tip tikz-arrow-${escapeAttribute(tip.kind)}${modeClass}${partClass}" d="${path}" fill="${escapeAttribute(fill)}"${strokePart}${lineStyle}${transform} />`;
  }).join("");
}
