import {
  createArrowTip,
  latexArrowGeometryFromLineWidth,
  lineWidthFromPt,
  stealthArrowHalfWidthFromLength,
  stealthArrowLengthFromLineWidth,
  stealthPrimeArrowDimensions,
  stealthArrowShortenFromLength
} from "../../tikz/metrics.js";
import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { svgPathData as pathData } from "./pathData.js";
import { styleAttributes } from "./style.js";

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

export function renderArrowedPath(item, unit) {
  const style = item.style || {};
  const terminal = pathTerminalSegments(item.commands || []);
  const startTip = style.markerStart ? resolveInlineArrowTip(style.markerStart, style) : null;
  const endTip = style.markerEnd ? resolveInlineArrowTip(style.markerEnd, style) : null;
  const explicitCommands = shortenPathTerminals(
    item.commands || [],
    terminal,
    (Number(style.shortenStart) || 0) / unit,
    (Number(style.shortenEnd) || 0) / unit
  );
  const placedTerminal = pathTerminalSegments(explicitCommands);
  const startShorten = startTip && placedTerminal.first?.shortenable ? startTip.geometry.shorten / unit : 0;
  const endShorten = endTip && placedTerminal.last?.shortenable ? endTip.geometry.shorten / unit : 0;
  const commands = shortenPathTerminals(explicitCommands, placedTerminal, startShorten, endShorten);
  const pathStyle = { ...style, markerStart: undefined, markerEnd: undefined };
  const pieces = [
    pathStyle.doubleColor !== undefined
      ? renderDoublePath(commands, pathStyle, unit, { lineCap: "butt", lineJoin: "miter", omitWrapper: true })
      : `<path d="${pathData(commands, unit)}"${styleAttributes(pathStyle, { omitMarkers: true, lineCap: "butt", lineJoin: "miter" })} />`
  ];

  if (startTip && placedTerminal.first) {
    pieces.push(renderInlineArrowTip(
      startTip,
      placedArrowTipPoint(placedTerminal.first.start, placedTerminal.first.startUx, placedTerminal.first.startUy, startTip.geometry.placement, unit),
      placedTerminal.first.angle + 180,
      unit
    ));
  }
  if (endTip && placedTerminal.last) {
    pieces.push(renderInlineArrowTip(
      endTip,
      placedArrowTipPoint(placedTerminal.last.end, -(placedTerminal.last.endUx ?? placedTerminal.last.ux), -(placedTerminal.last.endUy ?? placedTerminal.last.uy), endTip.geometry.placement, unit),
      placedTerminal.last.angle,
      unit
    ));
  }
  return `<g class="tikz-arrowed-path${pathStyle.doubleColor !== undefined ? " tikz-double-path" : ""}">${pieces.join("")}</g>`;
}

function placedArrowTipPoint(point, ux, uy, placement = 0, unit = 1) {
  const amount = Number(placement) || 0;
  if (!amount) return point;
  return {
    x: point.x + (Number(ux) || 0) * amount / unit,
    y: point.y + (Number(uy) || 0) * amount / unit
  };
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
  ].includes(raw.kind);
  const barTip = raw.kind === "bar";
  const filledCircleTip = raw.kind === "circle";
  const legacyStealthPrime = raw.kind === "stealth-prime";
  const filledStrokedTip = legacyStealthPrime || raw.kind === "dimline" || raw.kind === "dimline reverse";
  const declaredPaint = raw.declaredArrow?.paint;
  return {
    kind: raw.kind,
    geometry,
    // PGF's default Latex tip is filled and stroked with its normal mitered
    // outline. Round joins are only used when the TikZ arrow option asks for
    // them; applying them globally makes small scaled tips visibly bulbous.
    lineCap: raw.kind === "latex" ? "butt" : "round",
    lineJoin: raw.kind === "latex" ? "miter" : "round",
    stroke:
      declaredPaint === "stroke" || declaredPaint === "fillstroke"
        ? baseStroke
        : openTip || barTip || filledCircleTip || filledStrokedTip || raw.kind === "latex" || explicitStroke
        ? raw.stroke === "context-stroke"
          ? baseStroke
          : raw.stroke || baseStroke
        : "none",
    fill: declaredPaint === "stroke" || openTip || barTip ? "none" : fill,
    strokeWidth: declaredPaint === "stroke" || declaredPaint === "fillstroke"
      ? style.lineWidth ?? 1
      : barTip
      ? raw.lineWidth || style.lineWidth || 1
      : openTip
      ? style.lineWidth ?? 1
      : filledCircleTip
        ? style.lineWidth ?? 1
      : filledStrokedTip
        ? legacyStealthPrime
          ? style.lineWidth ?? 1
          : Math.max(0.2, (style.lineWidth ?? 1) * 0.5)
        : raw.kind === "latex"
          ? geometry.lineWidth
        : explicitStroke
          ? Math.max(0.8, (style.lineWidth ?? 1) * 0.45)
          : 0
  };
}

export function usesCustomArrowDimension(source = {}, raw = {}, key) {
  if (source[`custom${key[0].toUpperCase()}${key.slice(1)}`] || source[`${key}Explicit`]) return true;
  if (!Number.isFinite(source[key])) return false;
  const defaultTip = createArrowTip(raw.kind || source.kind || "to");
  return Math.abs(source[key] - defaultTip[key]) > 1e-6;
}

export function inlineArrowGeometry(tip, style = {}, flags = {}) {
  const lineWidth = Math.max(0.01, style.lineWidth ?? 1);
  const lineWidthPt = lineWidth / lineWidthFromPt(1);
  if (tip.kind === "stealth") {
    const length = flags.customLength ? tip.length : stealthArrowLengthFromLineWidth(lineWidth);
    const halfWidth = flags.customWidth ? tip.width / 2 : stealthArrowHalfWidthFromLength(length);
    const inset = stealthArrowShortenFromLength(length);
    return {
      path: `M 0 0 L ${format(-length)} ${format(-halfWidth)} L ${format(-inset)} 0 L ${format(-length)} ${format(halfWidth)} Z`,
      shorten: inset,
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
  if (tip.kind === "latex") {
    const native = latexArrowGeometryFromLineWidth(lineWidth, tip.scale);
    const length = flags.customLength ? tip.length : native.length;
    const halfWidth = flags.customWidth ? tip.width / 2 : native.halfWidth;
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
      shorten: flags.customLength ? length * 0.9 : native.shorten,
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
  return {
    path: [
      `M ${format(-back)} ${format(halfWidth)}`,
      `C ${format(-back * 0.817)} ${format(halfWidth * 0.4)} ${format(-back * 0.409)} ${format(halfWidth * 0.116)} 0 0`,
      `C ${format(-back * 0.409)} ${format(-halfWidth * 0.116)} ${format(-back * 0.817)} ${format(-halfWidth * 0.4)} ${format(-back)} ${format(
        -halfWidth
      )}`
    ].join(" "),
    shorten: lineWidth,
    bounds: { minX: -back, maxX: 0, minY: -halfWidth, maxY: halfWidth }
  };
}

export function renderInlineArrowTip(tip, point, angle, unit) {
  const strokePart = tip.strokeWidth > 0 ? ` stroke="${escapeAttribute(tip.stroke)}" stroke-width="${format(tip.strokeWidth)}"` : ` stroke="none"`;
  const lineStyle = tip.strokeWidth > 0 ? ` stroke-linecap="${escapeAttribute(tip.lineCap || "round")}" stroke-linejoin="${escapeAttribute(tip.lineJoin || "round")}"` : "";
  return `<path class="tikz-arrow-tip tikz-arrow-${escapeAttribute(tip.kind)}" d="${tip.geometry.path}" fill="${escapeAttribute(
    tip.fill
  )}"${strokePart}${lineStyle} transform="translate(${format(point.x * unit)} ${format(-point.y * unit)}) rotate(${format(angle)})" />`;
}
