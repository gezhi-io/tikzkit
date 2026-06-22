import katex from "katex";
import { estimateFormulaBox, formulaTotalHeight, parseMathText } from "./math-metrics.js";
import { mathFallbackText, normalizeTikzText } from "./tex-text.js";
import {
  TIKZ_ARROW,
  TIKZ_DISPLAY_MATH_FONT_SIZE,
  TIKZ_FONT_FAMILY,
  TIKZ_MARGIN,
  TIKZ_TEXT_FONT_SIZE,
  TIKZ_TYPEWRITER_WIDTH_SCALE,
  TIKZ_UNIT,
  createArrowTip,
  lineWidthFromPt
} from "./tikz-metrics.js";

// Claude: 交给 KaTeX 原生渲染的「带标签花括号」宏（替代文档里 \overmat/\undermat 的 \makebox
// 盒子展开，见 preprocess.js 的 KATEX_DELEGATED_MACROS）。\overmat{标签}{矩阵}{颜色} 语义就是
// 在矩阵上方画一个带标签的 \overbrace；这正好是 KaTeX 原生支持的 \overbrace{..}^{..}。
const KATEX_MACROS = {
  "\\overmat": "\\overbrace{#2}^{\\color{#3}\\text{#1}}",
  "\\undermat": "\\underbrace{#2}_{\\color{#3}\\text{#1}}"
};

export function renderSvg(ir, options = {}) {
  const unit = options.unit || TIKZ_UNIT;
  const margin = options.margin ?? TIKZ_MARGIN;
  const bounds = computeBounds(ir.items || []);
  const view = {
    x: bounds.minX * unit - margin,
    y: -bounds.maxY * unit - margin,
    width: (bounds.maxX - bounds.minX) * unit + margin * 2,
    height: (bounds.maxY - bounds.minY) * unit + margin * 2
  };
  const viewBox = [format(view.x), format(view.y), format(view.width), format(view.height)].join(" ");

  const body = [];
  const patternDefs = collectPatternDefs(ir.items || []);
  const ballGradientDefs = collectBallGradientDefs(ir.items || []);
  const axisGradientDefs = collectAxisGradientDefs(ir.items || []);
  const defs = [
    ...patternDefs.map(renderPatternDef),
    ...ballGradientDefs.map(renderBallGradientDef),
    ...axisGradientDefs.map(renderAxisGradientDef)
  ];
  if (defs.length) body.push(`<defs>${defs.join("")}</defs>`);
  const background = options.background === undefined ? "white" : options.background;
  if (background && background !== "none") {
    body.push(
      `<rect class="tikz-background" x="${format(view.x)}" y="${format(view.y)}" width="${format(
        view.width
      )}" height="${format(view.height)}" fill="${escapeAttribute(String(background))}" />`
    );
  }
  for (const item of ir.items || []) {
    body.push(renderItem(item, unit, options));
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">\n${body
    .filter(Boolean)
    .map((line) => `  ${line}`)
    .join("\n")}\n</svg>\n`;
}

function renderItem(item, unit, options = {}) {
  if (item.type === "marker") return renderMarker(item, unit);
  if (item.type === "nodeBox") {
    if (item.shape === "circle" || item.shape === "ellipse") {
      return renderNodeBoxWithOverlay(item, `<ellipse cx="${format(item.x * unit)}" cy="${format(-item.y * unit)}" rx="${format(
        (item.width / 2) * unit
      )}" ry="${format((item.height / 2) * unit)}"${styleAttributes(item.style)} />`, unit);
    }
    if (item.shape === "circleCrossSplit") return renderNodeBoxWithOverlay(item, renderCircleCrossSplitNodeBox(item, unit), unit);
    if (item.shape === "diamond") return renderNodeBoxWithOverlay(item, renderDiamondNodeBox(item, unit), unit);
    if (["regularPolygon", "star", "trapezium", "cloud", "superellipse"].includes(item.shape)) {
      return renderNodeBoxWithOverlay(item, renderLibraryShapeNodeBox(item, unit), unit);
    }
    if (["tikzquadsQuad", "tikzquadsBlackBox", "tikzquadsPgLoadLine"].includes(item.shape)) return renderTikzquadsNodeBox(item, unit, options);
    if (item.shape === "rectangleSplit") return renderRectangleSplit(item, unit);
    return renderNodeBoxWithOverlay(item, `<rect x="${format((item.x - item.width / 2) * unit)}" y="${format(
      -(item.y + item.height / 2) * unit
    )}" width="${format(item.width * unit)}" height="${format(item.height * unit)}" rx="${format(
      (item.rx || 0) * unit
    )}"${styleAttributes(item.style)} />`, unit);
  }
  if (item.type === "textNode") {
    const normalized = normalizeTikzText(item.text);
    if (normalized.invisible) return "";
    if (normalized.kind === "image") return renderImagePlaceholder(item, normalized, unit);
    const math = parseMathText(normalized.text);
    let rendered;
    if (math) rendered = renderMathNode(
      item,
      { ...math, scale: normalized.scale || 1, color: normalized.color, explicitFontSize: normalized.explicitFontSize },
      unit,
      options
    );
    else if (options.mathRenderer !== "svg-text" && hasInlineMath(normalized)) rendered = renderRichTextNode(item, normalized, unit);
    else rendered = renderPlainTextNode(item, normalized, unit);
    // Claude: 把节点的 rotate 作用到最终文本上（见 interpreter 的 nodeRotation）。
    return wrapNodeRotation(rendered, item, unit);
  }
  if (item.projected && item.type === "path") return renderPathElement(item, unit);
  if (item.shape === "circle") {
    return `<circle cx="${format(item.cx * unit)}" cy="${format(-item.cy * unit)}" r="${format(
      item.r * unit
    )}"${styleAttributes(item.style)} />`;
  }
  if (item.shape === "ellipse") {
    return `<ellipse cx="${format(item.cx * unit)}" cy="${format(-item.cy * unit)}" rx="${format(
      item.rx * unit
    )}" ry="${format(item.ry * unit)}"${styleAttributes(item.style)} />`;
  }
  if (item.type === "path") return renderPathElement(item, unit);
  return "";
}

function renderCircleCrossSplitNodeBox(item, unit) {
  const cx = item.x * unit;
  const cy = -item.y * unit;
  const rx = (item.width / 2) * unit;
  const ry = (item.height / 2) * unit;
  const stroke = item.style?.stroke || "black";
  const width = item.style?.lineWidth || 1;
  return `<g class="tikz-node-shape tikz-node-circleCrossSplit"><ellipse cx="${format(cx)}" cy="${format(cy)}" rx="${format(rx)}" ry="${format(
    ry
  )}"${styleAttributes(item.style)} /><path d="M ${format(cx - rx)} ${format(cy)} L ${format(cx + rx)} ${format(cy)} M ${format(
    cx
  )} ${format(cy - ry)} L ${format(cx)} ${format(cy + ry)}" fill="none" stroke="${escapeAttribute(stroke)}" stroke-width="${format(
    width
  )}" /></g>`;
}

function renderDiamondNodeBox(item, unit) {
  const cx = item.x * unit;
  const cy = -item.y * unit;
  const hw = (item.width / 2) * unit;
  const hh = (item.height / 2) * unit;
  const points = [
    [cx, cy - hh],
    [cx + hw, cy],
    [cx, cy + hh],
    [cx - hw, cy]
  ]
    .map(([x, y]) => `${format(x)},${format(y)}`)
    .join(" ");
  return `<polygon points="${points}"${styleAttributes(item.style)} />`;
}

function renderLibraryShapeNodeBox(item, unit) {
  const commands = nodeShapeCommands(item);
  return `<path class="tikz-node-shape tikz-node-${escapeAttribute(item.shape)}" d="${pathData(commands, unit)}"${styleAttributes(
    item.style
  )} />`;
}

function nodeShapeCommands(item) {
  const center = { x: item.x, y: item.y };
  const halfWidth = item.width / 2;
  const halfHeight = item.height / 2;
  if (item.shape === "regularPolygon") {
    return closedPolygonCommands(regularPolygonNodePoints(center, halfWidth, halfHeight, item.shapeData?.regularPolygonSides || 5, 90));
  }
  if (item.shape === "star") {
    return closedPolygonCommands(starNodePoints(center, halfWidth, halfHeight, item.shapeData?.starPoints || 5, item.shapeData?.starPointRatio || 1.5));
  }
  if (item.shape === "trapezium") {
    return closedPolygonCommands(trapeziumNodePoints(center, halfWidth, halfHeight, item.shapeData || {}));
  }
  if (item.shape === "cloud") {
    return cloudNodeCommands(center, halfWidth, halfHeight);
  }
  if (item.shape === "superellipse") {
    return superellipseNodeCommands(center, halfWidth, halfHeight);
  }
  return closedPolygonCommands(rectangleNodePoints(center, halfWidth, halfHeight));
}

function superellipseNodeCommands(center, halfWidth, halfHeight) {
  const k = 0.42;
  return [
    { type: "moveTo", x: center.x, y: center.y + halfHeight },
    { type: "curveTo", x1: center.x + halfWidth * k, y1: center.y + halfHeight, x2: center.x + halfWidth, y2: center.y + halfHeight * k, x: center.x + halfWidth, y: center.y },
    { type: "curveTo", x1: center.x + halfWidth, y1: center.y - halfHeight * k, x2: center.x + halfWidth * k, y2: center.y - halfHeight, x: center.x, y: center.y - halfHeight },
    { type: "curveTo", x1: center.x - halfWidth * k, y1: center.y - halfHeight, x2: center.x - halfWidth, y2: center.y - halfHeight * k, x: center.x - halfWidth, y: center.y },
    { type: "curveTo", x1: center.x - halfWidth, y1: center.y + halfHeight * k, x2: center.x - halfWidth * k, y2: center.y + halfHeight, x: center.x, y: center.y + halfHeight },
    { type: "closePath" }
  ];
}

function closedPolygonCommands(points) {
  if (!points.length) return [];
  return [
    { type: "moveTo", x: points[0].x, y: points[0].y },
    ...points.slice(1).map((point) => ({ type: "lineTo", x: point.x, y: point.y })),
    { type: "closePath" }
  ];
}

function regularPolygonNodePoints(center, halfWidth, halfHeight, sides, startAngle) {
  const count = Math.max(3, Math.round(sides));
  return Array.from({ length: count }, (_unused, index) => {
    const angle = ((startAngle + (360 * index) / count) * Math.PI) / 180;
    return {
      x: center.x + Math.cos(angle) * halfWidth,
      y: center.y + Math.sin(angle) * halfHeight
    };
  });
}

function starNodePoints(center, halfWidth, halfHeight, points, ratio) {
  const count = Math.max(3, Math.round(points));
  const innerRatio = 1 / Math.max(1.05, Number(ratio) || 1.5);
  return Array.from({ length: count * 2 }, (_unused, index) => {
    const angle = ((90 + (360 * index) / (count * 2)) * Math.PI) / 180;
    const scale = index % 2 === 0 ? 1 : innerRatio;
    return {
      x: center.x + Math.cos(angle) * halfWidth * scale,
      y: center.y + Math.sin(angle) * halfHeight * scale
    };
  });
}

function trapeziumNodePoints(center, halfWidth, halfHeight, data = {}) {
  const left = Math.max(10, Math.min(170, data.trapeziumLeftAngle || 60));
  const right = Math.max(10, Math.min(170, data.trapeziumRightAngle || 60));
  const leftInset = Math.cos((left * Math.PI) / 180) * halfHeight * 0.7;
  const rightInset = Math.cos((right * Math.PI) / 180) * halfHeight * 0.7;
  return [
    { x: center.x - halfWidth + leftInset, y: center.y + halfHeight },
    { x: center.x + halfWidth - rightInset, y: center.y + halfHeight },
    { x: center.x + halfWidth + rightInset, y: center.y - halfHeight },
    { x: center.x - halfWidth - leftInset, y: center.y - halfHeight }
  ];
}

function rectangleNodePoints(center, halfWidth, halfHeight) {
  return [
    { x: center.x - halfWidth, y: center.y + halfHeight },
    { x: center.x + halfWidth, y: center.y + halfHeight },
    { x: center.x + halfWidth, y: center.y - halfHeight },
    { x: center.x - halfWidth, y: center.y - halfHeight }
  ];
}

function cloudNodeCommands(center, halfWidth, halfHeight) {
  const steps = 24;
  const commands = [];
  for (let index = 0; index <= steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2;
    const ripple = 1 + 0.11 * Math.sin(angle * 7);
    const point = {
      x: center.x + Math.cos(angle) * halfWidth * ripple,
      y: center.y + Math.sin(angle) * halfHeight * ripple
    };
    commands.push(index === 0 ? { type: "moveTo", ...point } : { type: "lineTo", ...point });
  }
  commands.push({ type: "closePath" });
  return commands;
}

function renderNodeBoxWithOverlay(item, baseSvg, unit) {
  const shadows = renderNodeBoxShadows(item, unit);
  const overlay = renderNodeBoxOverlay(item, unit);
  const grouped = shadows || overlay ? `<g>${shadows}${baseSvg}${overlay}</g>` : baseSvg;
  return wrapNodeRotation(grouped, item, unit);
}

function renderNodeBoxShadows(item, unit) {
  if (!Array.isArray(item.shadows) || !item.shadows.length) return "";
  return item.shadows.map((shadow) => renderNodeBoxShadow(item, shadow, unit)).join("");
}

function renderNodeBoxShadow(item, shadow, unit) {
  const scale = Number(shadow.scale) > 0 ? Number(shadow.scale) : 1;
  const shadowItem = {
    ...item,
    x: item.x + (Number(shadow.xshift) || 0),
    y: item.y + (Number(shadow.yshift) || 0),
    width: item.width * scale,
    height: item.height * scale,
    rx: (item.rx || 0) * scale,
    style: shadow.style || item.style || {}
  };
  if (shadowItem.shape === "circle" || shadowItem.shape === "ellipse") {
    return `<ellipse class="tikz-node-shadow" cx="${format(shadowItem.x * unit)}" cy="${format(-shadowItem.y * unit)}" rx="${format(
      (shadowItem.width / 2) * unit
    )}" ry="${format((shadowItem.height / 2) * unit)}"${styleAttributes(shadowItem.style)} />`;
  }
  if (shadowItem.shape === "diamond") {
    const cx = shadowItem.x * unit;
    const cy = -shadowItem.y * unit;
    const hw = (shadowItem.width / 2) * unit;
    const hh = (shadowItem.height / 2) * unit;
    const points = [
      [cx, cy - hh],
      [cx + hw, cy],
      [cx, cy + hh],
      [cx - hw, cy]
    ]
      .map(([x, y]) => `${format(x)},${format(y)}`)
      .join(" ");
    return `<polygon class="tikz-node-shadow" points="${points}"${styleAttributes(shadowItem.style)} />`;
  }
  if (["regularPolygon", "star", "trapezium", "cloud", "superellipse"].includes(shadowItem.shape)) {
    return `<path class="tikz-node-shadow" d="${pathData(nodeShapeCommands(shadowItem), unit)}"${styleAttributes(shadowItem.style)} />`;
  }
  return `<rect class="tikz-node-shadow" x="${format((shadowItem.x - shadowItem.width / 2) * unit)}" y="${format(
    -(shadowItem.y + shadowItem.height / 2) * unit
  )}" width="${format(shadowItem.width * unit)}" height="${format(shadowItem.height * unit)}" rx="${format(
    (shadowItem.rx || 0) * unit
  )}"${styleAttributes(shadowItem.style)} />`;
}

function renderNodeBoxOverlay(item, unit) {
  const overlays = [];
  if (item.doubleColor !== undefined) overlays.push(renderDoubleNodeOutline(item, unit));
  if (String(item.pathPicture || "").includes("path picture bounding box")) overlays.push(renderPathPictureOverlay(item, unit));
  if (item.bpmnIcon) overlays.push(renderBpmnIcon(item, unit));
  if (item.bpmnMarker) overlays.push(renderBpmnMarker(item, unit));
  return overlays.filter(Boolean).join("");
}

function renderPathPictureOverlay(item, unit) {
  const x1 = (item.x - item.width / 2) * unit;
  const x2 = (item.x + item.width / 2) * unit;
  const y1 = -(item.y + item.height / 2) * unit;
  const y2 = -(item.y - item.height / 2) * unit;
  const stroke = escapeAttribute(item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black");
  const width = format(Math.max(1, item.style?.lineWidth ?? 1));
  return `<path d="M ${format(x1)} ${format(y2)} L ${format(x2)} ${format(y1)} M ${format(x1)} ${format(y1)} L ${format(
    x2
  )} ${format(y2)}" stroke="${stroke}" fill="none" stroke-width="${width}" />`;
}

function renderPathElement(item, unit) {
  if (!item.style?.markerStart && !item.style?.markerEnd) {
    if (item.style?.doubleColor !== undefined) return renderDoublePath(item.commands || [], item.style, unit);
    if (item.subtype === "bagua-line") {
      return `<path d="${pathData(item.commands, unit)}"${styleAttributes(item.style, { lineCap: "butt", lineJoin: "miter" })} />`;
    }
    return `<path d="${pathData(item.commands, unit)}"${styleAttributes(item.style)} />`;
  }
  return renderArrowedPath(item, unit);
}

function renderArrowedPath(item, unit) {
  const style = item.style || {};
  const terminal = pathTerminalSegments(item.commands || []);
  const startTip = style.markerStart ? resolveInlineArrowTip(style.markerStart, style) : null;
  const endTip = style.markerEnd ? resolveInlineArrowTip(style.markerEnd, style) : null;
  const startShorten = startTip && terminal.first?.shortenable ? startTip.geometry.shorten / unit : 0;
  const endShorten = endTip && terminal.last?.shortenable ? endTip.geometry.shorten / unit : 0;
  const commands = shortenPathTerminals(item.commands || [], terminal, startShorten, endShorten);
  const pathStyle = { ...style, markerStart: undefined, markerEnd: undefined };
  const pieces = [
    pathStyle.doubleColor !== undefined
      ? renderDoublePath(commands, pathStyle, unit, { lineCap: "butt", lineJoin: "miter", omitWrapper: true })
      : `<path d="${pathData(commands, unit)}"${styleAttributes(pathStyle, { omitMarkers: true, lineCap: "butt", lineJoin: "miter" })} />`
  ];

  if (startTip && terminal.first) {
    pieces.push(renderInlineArrowTip(startTip, terminal.first.start, terminal.first.angle + 180, unit));
  }
  if (endTip && terminal.last) {
    pieces.push(renderInlineArrowTip(endTip, terminal.last.end, terminal.last.angle, unit));
  }
  return `<g class="tikz-arrowed-path${pathStyle.doubleColor !== undefined ? " tikz-double-path" : ""}">${pieces.join("")}</g>`;
}

function renderDoublePath(commands, style = {}, unit, options = {}) {
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

function doubleStrokeStyles(style = {}) {
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

function pathTerminalSegments(commands) {
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

function shortenPathTerminals(commands, terminal, startAmount, endAmount) {
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

function svgAngle(vector) {
  return (Math.atan2(-vector.y, vector.x) * 180) / Math.PI;
}

function resolveInlineArrowTip(tip, style = {}) {
  const source = typeof tip === "string" ? {} : tip || {};
  const raw = typeof tip === "string" ? createArrowTip(tip === "arrow" ? "to" : tip) : createArrowTip(tip?.kind, source);
  const baseStroke = style.stroke === "none" ? "black" : style.stroke || "black";
  const explicitStroke = source.stroke && source.stroke !== "context-stroke";
  const fill = raw.fill && raw.fill !== "context-stroke" ? raw.fill : baseStroke;
  const geometry = inlineArrowGeometry(raw, style, {
    customLength: usesCustomArrowDimension(source, raw, "length"),
    customWidth: usesCustomArrowDimension(source, raw, "width")
  });
  const openTip = raw.kind === "to" || raw.kind === "hook" || raw.kind === "two-heads" || raw.kind === "open-circle" || raw.kind === "open-triangle";
  const filledStrokedTip = raw.kind === "dimline" || raw.kind === "dimline reverse";
  return {
    kind: raw.kind,
    geometry,
    stroke: openTip || filledStrokedTip || explicitStroke ? raw.stroke || baseStroke : "none",
    fill: openTip ? "none" : fill,
    strokeWidth: openTip
      ? style.lineWidth ?? 1
      : filledStrokedTip
        ? Math.max(0.2, (style.lineWidth ?? 1) * 0.5)
        : explicitStroke
          ? Math.max(0.8, (style.lineWidth ?? 1) * 0.45)
          : 0
  };
}

function usesCustomArrowDimension(source = {}, raw = {}, key) {
  if (source[`custom${key[0].toUpperCase()}${key.slice(1)}`] || source[`${key}Explicit`]) return true;
  if (!Number.isFinite(source[key])) return false;
  const defaultTip = createArrowTip(raw.kind || source.kind || "to");
  return Math.abs(source[key] - defaultTip[key]) > 1e-6;
}

function inlineArrowGeometry(tip, style = {}, flags = {}) {
  const lineWidth = Math.max(0.01, style.lineWidth ?? 1);
  const lineWidthPt = lineWidth / lineWidthFromPt(1);
  if (tip.kind === "stealth") {
    const length = flags.customLength ? tip.length : lineWidthFromPt(3 + 1.25 * lineWidthPt);
    const halfWidth = flags.customWidth ? tip.width / 2 : length * 0.5;
    return {
      path: `M 0 0 L ${format(-length)} ${format(-halfWidth)} L ${format(-length * 0.625)} 0 L ${format(-length)} ${format(halfWidth)} Z`,
      shorten: length * 0.625
    };
  }
  if (tip.kind === "latex") {
    const length = flags.customLength ? tip.length : lineWidthFromPt(3.2 + 2.4 * lineWidthPt);
    const halfWidth = flags.customWidth ? tip.width / 2 : lineWidthFromPt(1.2 + 0.9 * lineWidthPt);
    return {
      path: [
        `M 0 0`,
        `C ${format(-length * 0.266)} ${format(-halfWidth * 0.132)} ${format(-length * 0.7)} ${format(-halfWidth * 0.533)} ${format(-length)} ${format(-halfWidth)}`,
        `L ${format(-length)} ${format(halfWidth)}`,
        `C ${format(-length * 0.7)} ${format(halfWidth * 0.533)} ${format(-length * 0.266)} ${format(halfWidth * 0.132)} 0 0 Z`
      ].join(" "),
      shorten: length * 0.9
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
  if (tip.kind === "open-triangle") {
    const length = tip.length;
    const halfWidth = tip.width / 2;
    return {
      path: `M 0 0 L ${format(-length)} ${format(-halfWidth)} L ${format(-length)} ${format(halfWidth)} Z`,
      shorten: length * 0.72
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
    shorten: lineWidth
  };
}

function renderInlineArrowTip(tip, point, angle, unit) {
  const strokePart = tip.strokeWidth > 0 ? ` stroke="${escapeAttribute(tip.stroke)}" stroke-width="${format(tip.strokeWidth)}"` : ` stroke="none"`;
  const lineStyle = tip.strokeWidth > 0 ? ` stroke-linecap="round" stroke-linejoin="round"` : "";
  return `<path class="tikz-arrow-tip tikz-arrow-${escapeAttribute(tip.kind)}" d="${tip.geometry.path}" fill="${escapeAttribute(
    tip.fill
  )}"${strokePart}${lineStyle} transform="translate(${format(point.x * unit)} ${format(-point.y * unit)}) rotate(${format(angle)})" />`;
}

function renderTikzquadsNodeBox(item, unit, options = {}) {
  if (item.shape === "tikzquadsPgLoadLine") return renderTikzquadsPgLoadLine(item, unit, options);
  const cx = item.x * unit;
  const cy = -item.y * unit;
  const hw = (item.width / 2) * unit;
  const hh = (item.height / 2) * unit;
  const terminal = Math.max(5, hw * (item.shape === "tikzquadsBlackBox" ? 5 / 19 : 5 / 33));
  const left = cx - hw + terminal;
  const right = cx + hw - terminal;
  const top = cy - hh;
  const bottom = cy + hh;
  const portY = hh * (5 / 7);
  const stroke = escapeAttribute(item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black");
  const fill = escapeAttribute(item.style?.fill || "none");
  const lineWidth = format(item.style?.lineWidth || 1);
  const group = [`<g class="tikz-node-shape tikz-node-${escapeAttribute(item.shape)}">`];
  group.push(
    `<rect x="${format(left)}" y="${format(top)}" width="${format(right - left)}" height="${format(
      bottom - top
    )}" fill="${fill}" stroke="${stroke}" stroke-width="${lineWidth}" />`
  );
  group.push(renderTikzquadsPorts(item, { cx, cy, hw, hh, left, right, portY, terminal, stroke, lineWidth }));
  group.push(renderTikzquadsInternals(item, { cx, cy, hw, hh, left, right, portY, stroke, lineWidth }));
  group.push(renderTikzquadsLabels(item, { cx, cy, hw, hh, left, right, portY, stroke }, unit, options));
  group.push("</g>");
  return group.filter(Boolean).join("");
}

function renderTikzquadsPorts(item, box) {
  const { cx, cy, hw, left, right, portY, stroke, lineWidth } = box;
  const leftOuter = cx - hw;
  const pieces = [
    `<path d="M ${format(leftOuter)} ${format(cy - portY)} L ${format(left)} ${format(cy - portY)} M ${format(leftOuter)} ${format(
      cy + portY
    )} L ${format(left)} ${format(cy + portY)}" fill="none" stroke="${stroke}" stroke-width="${lineWidth}" />`,
    renderTikzquadsPolarity(leftOuter + (left - leftOuter) * 0.55, cy - portY + 6, stroke, 1),
    renderTikzquadsPolarity(leftOuter + (left - leftOuter) * 0.55, cy + portY - 6, stroke, -1),
    renderTikzquadsArrow(leftOuter + (left - leftOuter) * 0.55, cy - portY, -1, stroke)
  ];
  if (item.shape === "tikzquadsQuad") {
    const rightOuter = cx + hw;
    pieces.push(
      `<path d="M ${format(right)} ${format(cy - portY)} L ${format(rightOuter)} ${format(cy - portY)} M ${format(right)} ${format(
        cy + portY
      )} L ${format(rightOuter)} ${format(cy + portY)}" fill="none" stroke="${stroke}" stroke-width="${lineWidth}" />`,
      renderTikzquadsPolarity(rightOuter - (rightOuter - right) * 0.55, cy - portY + 6, stroke, 1),
      renderTikzquadsPolarity(rightOuter - (rightOuter - right) * 0.55, cy + portY - 6, stroke, -1),
      renderTikzquadsArrow(rightOuter - (rightOuter - right) * 0.55, cy - portY, 1, stroke),
      `<path d="M ${format(left)} ${format(cy + portY)} L ${format(right)} ${format(cy + portY)}" fill="none" stroke="${stroke}" stroke-width="${format(
        Math.max(0.5, Number(lineWidth) * 0.55)
      )}" stroke-dasharray="1.1 1.4" />`
    );
  }
  return pieces.join("");
}

function renderTikzquadsPolarity(x, y, stroke, sign) {
  const size = 3.2;
  const horizontal = `M ${format(x - size)} ${format(y)} L ${format(x + size)} ${format(y)}`;
  const vertical = sign > 0 ? ` M ${format(x)} ${format(y - size)} L ${format(x)} ${format(y + size)}` : "";
  return `<path d="${horizontal}${vertical}" fill="none" stroke="${stroke}" stroke-width="0.8" />`;
}

function renderTikzquadsArrow(x, y, direction, stroke) {
  const tip = direction > 0 ? x + 6 : x - 6;
  const tail = direction > 0 ? x - 5 : x + 5;
  const wing = direction > 0 ? -1 : 1;
  return `<path d="M ${format(tail)} ${format(y)} L ${format(tip)} ${format(y)} M ${format(tip)} ${format(y)} L ${format(
    tip + wing * 4
  )} ${format(y - 3)} M ${format(tip)} ${format(y)} L ${format(tip + wing * 4)} ${format(y + 3)}" fill="none" stroke="${stroke}" stroke-width="0.8" />`;
}

function renderTikzquadsInternals(item, box) {
  const kind = String(item.tikzquadsKind || "").toLowerCase();
  const { cx, cy, hw, hh, left, right, portY, stroke, lineWidth } = box;
  if (kind === "quad" || kind === "black box") return "";
  if (kind === "thevenin") {
    const x = (left + right) / 2;
    return [
      renderTikzquadsResistor(x, cy - portY * 0.52, hw * 0.18, stroke, lineWidth),
      renderTikzquadsVoltageSource(x, cy + portY * 0.52, Math.min(hw, hh) * 0.15, stroke, lineWidth)
    ].join("");
  }
  if (kind === "norton") {
    const x = (left + right) / 2;
    return [
      renderTikzquadsResistor(x - hw * 0.12, cy, hw * 0.16, stroke, lineWidth, true),
      renderTikzquadsCurrentSource(x + hw * 0.14, cy, Math.min(hw, hh) * 0.15, stroke, lineWidth)
    ].join("");
  }
  if (!kind.startsWith("quad ")) return "";
  const leftX = left + (right - left) * 0.32;
  const rightX = right - (right - left) * 0.32;
  const mode = kind.replace(/^quad\s+/, "");
  const leftBlock = mode === "y" || mode === "g" ? renderTikzquadsShunt(leftX, cy, portY, stroke, lineWidth) : renderTikzquadsSeries(leftX, cy, portY, stroke, lineWidth);
  const rightBlock = mode === "z" || mode === "h" ? renderTikzquadsSeries(rightX, cy, portY, stroke, lineWidth) : renderTikzquadsShunt(rightX, cy, portY, stroke, lineWidth);
  return `${leftBlock}${rightBlock}`;
}

function renderTikzquadsSeries(x, cy, portY, stroke, lineWidth) {
  return [
    renderTikzquadsResistor(x, cy - portY * 0.52, 9, stroke, lineWidth),
    renderTikzquadsVoltageSource(x, cy + portY * 0.52, 6, stroke, lineWidth)
  ].join("");
}

function renderTikzquadsShunt(x, cy, portY, stroke, lineWidth) {
  return [
    renderTikzquadsResistor(x - 5, cy, 8, stroke, lineWidth, true),
    renderTikzquadsCurrentSource(x + 8, cy, 6, stroke, lineWidth)
  ].join("");
}

function renderTikzquadsResistor(x, y, size, stroke, lineWidth, vertical = false) {
  if (vertical) {
    return `<rect x="${format(x - size * 0.35)}" y="${format(y - size)}" width="${format(size * 0.7)}" height="${format(
      size * 2
    )}" fill="white" stroke="${stroke}" stroke-width="${lineWidth}" />`;
  }
  return `<rect x="${format(x - size)}" y="${format(y - size * 0.35)}" width="${format(size * 2)}" height="${format(
    size * 0.7
  )}" fill="white" stroke="${stroke}" stroke-width="${lineWidth}" />`;
}

function renderTikzquadsVoltageSource(x, y, radius, stroke, lineWidth) {
  return `<g><circle cx="${format(x)}" cy="${format(y)}" r="${format(radius)}" fill="white" stroke="${stroke}" stroke-width="${lineWidth}" />${renderTikzquadsPolarity(
    x,
    y - radius * 0.35,
    stroke,
    1
  )}${renderTikzquadsPolarity(x, y + radius * 0.45, stroke, -1)}</g>`;
}

function renderTikzquadsCurrentSource(x, y, radius, stroke, lineWidth) {
  return `<g><circle cx="${format(x)}" cy="${format(y)}" r="${format(radius)}" fill="white" stroke="${stroke}" stroke-width="${lineWidth}" />${renderTikzquadsArrow(
    x,
    y + radius * 0.1,
    1,
    stroke
  )}</g>`;
}

function renderTikzquadsLabels(item, box, unit, options = {}) {
  const labels = tikzquadsLabelPositions(item, box);
  return labels
    .filter((label) => label.text !== undefined && label.text !== null && label.text !== "")
    .map((label) => renderTikzquadsText(label.text, label.x, label.y, label.anchor || "middle", label.size || TIKZ_TEXT_FONT_SIZE, box.stroke, unit, options))
    .join("");
}

function tikzquadsLabelPositions(item, box) {
  const o = item.tikzquadsOptions || {};
  const kind = String(item.tikzquadsKind || "").toLowerCase();
  const { cx, cy, hw, hh, left, right, portY } = box;
  const labels = tikzquadsTextAnchorLabels(o, { cx, cy, hw, hh, left, right });
  if (item.shape === "tikzquadsBlackBox") {
    labels.push(
      { text: o.I1 ?? "$I_1$", x: left - 4, y: cy - portY - 10, anchor: "end" },
      { text: o.V1 ?? "$V_1$", x: left - 6, y: cy, anchor: "end" }
    );
    if (kind === "thevenin") labels.push({ text: o.Zth ?? "$Z_{th}$", x: cx, y: cy - portY * 0.52 - 8 }, { text: o.Vth ?? "$V_{th}$", x: cx, y: cy + portY * 0.52 + 12 });
    if (kind === "norton") labels.push({ text: o.Yn ?? "$Y_N$", x: cx - hw * 0.1, y: cy - 14 }, { text: o.In ?? "$I_N$", x: cx + hw * 0.16, y: cy + 14 });
    return labels;
  }
  labels.push(
    { text: o.I1 ?? "$I_1$", x: left - 4, y: cy - portY - 10, anchor: "end" },
    { text: o.V1 ?? "$V_1$", x: left - 6, y: cy, anchor: "end" },
    { text: o.I2 ?? "$I_2$", x: right + 4, y: cy - portY - 10, anchor: "start" },
    { text: o.V2 ?? "$V_2$", x: right + 6, y: cy, anchor: "start" }
  );
  const prefix = kind.endsWith(" y") ? "Y" : kind.endsWith(" g") ? "G" : kind.endsWith(" h") ? "H" : kind.endsWith(" z") ? "Z" : "";
  if (prefix) {
    labels.push(
      { text: o[`${prefix}11`] ?? `$${prefix}_{11}$`, x: left + (right - left) * 0.28, y: cy - hh * 0.18 },
      { text: o[`${prefix}12`] ?? `$${prefix}_{12}$`, x: left + (right - left) * 0.43, y: cy + hh * 0.18 },
      { text: o[`${prefix}21`] ?? `$${prefix}_{21}$`, x: right - (right - left) * 0.43, y: cy - hh * 0.18 },
      { text: o[`${prefix}22`] ?? `$${prefix}_{22}$`, x: right - (right - left) * 0.28, y: cy + hh * 0.18 }
    );
  }
  return labels;
}

function tikzquadsTextAnchorLabels(options, box) {
  const { cx, cy, hw, hh, left, right } = box;
  const innerLeft = left + hw / 16;
  const innerRight = right - hw / 16;
  const top = cy - hh;
  const bottom = cy + hh;
  const topY = top + Math.max(9, hh * 0.14);
  const bottomY = bottom - Math.max(9, hh * 0.14);
  const positions = {
    "label top left": { x: innerLeft, y: topY, anchor: "start" },
    "label top center": { x: cx, y: topY, anchor: "middle" },
    "label top right": { x: innerRight, y: topY, anchor: "end" },
    "label inner top left": { x: innerLeft, y: cy - hh * 0.36, anchor: "start" },
    "label inner top center": { x: cx, y: cy - hh * 0.36, anchor: "middle" },
    "label inner top right": { x: innerRight, y: cy - hh * 0.36, anchor: "end" },
    "label bottom left": { x: innerLeft, y: bottomY, anchor: "start" },
    "label bottom center": { x: cx, y: bottomY, anchor: "middle" },
    "label bottom right": { x: innerRight, y: bottomY, anchor: "end" },
    "label inner bottom left": { x: innerLeft, y: cy + hh * 0.36, anchor: "start" },
    "label inner bottom center": { x: cx, y: cy + hh * 0.36, anchor: "middle" },
    "label inner bottom right": { x: innerRight, y: cy + hh * 0.36, anchor: "end" }
  };
  return Object.entries(positions)
    .filter(([key]) => options[key] !== undefined && options[key] !== "")
    .map(([key, position]) => ({ text: options[key], ...position }));
}

function renderTikzquadsPgLoadLine(item, unit, options = {}) {
  const cx = item.x * unit;
  const cy = -item.y * unit;
  const hw = (item.width / 2) * unit;
  const hh = (item.height / 2) * unit;
  const stroke = escapeAttribute(item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black");
  const lineWidth = format(item.style?.lineWidth || 1);
  const left = cx - hw * 0.78;
  const right = cx + hw * 0.78;
  const bottom = cy + hh * 0.72;
  const top = cy - hh * 0.72;
  const o = item.tikzquadsOptions || {};
  return [
    `<g class="tikz-node-shape tikz-node-${escapeAttribute(item.shape)}">`,
    `<path d="M ${format(left)} ${format(bottom)} L ${format(right)} ${format(bottom)} M ${format(left)} ${format(bottom)} L ${format(
      left
    )} ${format(top)} M ${format(left)} ${format(top)} L ${format(left - 3)} ${format(top + 7)} M ${format(left)} ${format(top)} L ${format(
      left + 3
    )} ${format(top + 7)} M ${format(right)} ${format(bottom)} L ${format(right - 7)} ${format(bottom - 3)} M ${format(right)} ${format(
      bottom
    )} L ${format(right - 7)} ${format(bottom + 3)} M ${format(left)} ${format(top + hh * 0.2)} L ${format(right - hw * 0.18)} ${format(
      bottom
    )}" fill="none" stroke="${stroke}" stroke-width="${lineWidth}" stroke-linecap="round" />`,
    renderTikzquadsText(o["x axis"] ?? "$V$", right + 9, bottom + 2, "start", TIKZ_TEXT_FONT_SIZE, stroke, unit, options),
    renderTikzquadsText(o["y axis"] ?? "$I$", left - 3, top - 7, "end", TIKZ_TEXT_FONT_SIZE, stroke, unit, options),
    renderTikzquadsText(o["x val"] ?? "$V_{th}$", right - 5, bottom - 8, "end", TIKZ_TEXT_FONT_SIZE, stroke, unit, options),
    renderTikzquadsText(o["y val"] ?? "$I_N$", left + 5, top + 9, "start", TIKZ_TEXT_FONT_SIZE, stroke, unit, options),
    "</g>"
  ].join("");
}

function renderTikzquadsText(text, x, y, anchor, size = TIKZ_TEXT_FONT_SIZE, fill, unit = TIKZ_UNIT, options = {}) {
  const normalized = normalizeTikzText(text);
  const scale = size / TIKZ_TEXT_FONT_SIZE;
  const math = parseMathText(normalized.text);
  const color = fill || normalized.color || "black";
  if (math) {
    const mathScale = (normalized.scale || 1) * scale;
    const box = estimateMathBox(normalizeKatexTex(math.tex), math.displayMode, unit, mathScale);
    const centeredX = textCenterForAnchor(x, anchor, box.width);
    return renderMathNode(
      { x: centeredX / unit, y: -y / unit, style: { fill: color, fontScale: scale } },
      { ...math, scale: normalized.scale || 1, color: normalized.color || color },
      unit,
      options
    );
  }
  const lines = normalized.lines.length ? normalized.lines : [normalized.text];
  const width = estimateTikzquadsTextWidth(lines, size * (normalized.scale || 1));
  const centeredX = textCenterForAnchor(x, anchor, width);
  return renderPlainTextNode(
    {
      x: centeredX / unit,
      y: -y / unit,
      style: { fill: color, fontScale: scale }
    },
    normalized,
    unit
  );
}

function textCenterForAnchor(x, anchor, width) {
  if (anchor === "end") return x - width / 2;
  if (anchor === "start") return x + width / 2;
  return x;
}

function estimateTikzquadsTextWidth(lines, fontSize) {
  const longest = Math.max(0, ...lines.map((line) => formatTextLine(line).length));
  return Math.max(fontSize, longest * fontSize * 0.52);
}

function renderDoubleNodeOutline(item, unit) {
  const stroke = escapeAttribute(item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black");
  const width = Math.max(1, item.style?.lineWidth ?? 1);
  const inset = Math.max(width * 1.8, 2.2);
  const cx = item.x * unit;
  const cy = -item.y * unit;
  const halfWidth = (item.width * unit) / 2;
  const halfHeight = (item.height * unit) / 2;
  if (item.shape === "circle" || item.shape === "ellipse") {
    return `<ellipse class="tikz-bpmn-double" cx="${format(cx)}" cy="${format(cy)}" rx="${format(
      Math.max(0, halfWidth - inset)
    )}" ry="${format(Math.max(0, halfHeight - inset))}" stroke="${stroke}" fill="none" stroke-width="${format(width)}" />`;
  }
  const x = cx - halfWidth + inset;
  const y = cy - halfHeight + inset;
  return `<rect class="tikz-bpmn-double" x="${format(x)}" y="${format(y)}" width="${format(
    Math.max(0, item.width * unit - inset * 2)
  )}" height="${format(Math.max(0, item.height * unit - inset * 2))}" rx="${format(
    Math.max(0, (item.rx || 0) * unit - inset)
  )}" stroke="${stroke}" fill="none" stroke-width="${format(width)}" />`;
}

function renderBpmnIcon(item, unit) {
  const icon = String(item.bpmnIcon || "").trim();
  const box = nodePixelBox(item, unit);
  const stroke = escapeAttribute(item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black");
  const fill = icon.endsWith("-fill") || icon === "terminate" ? stroke : "none";
  const width = format(Math.max(1, (item.style?.lineWidth ?? 1) * 0.85));
  const className = `tikz-bpmn-icon tikz-bpmn-${escapeAttribute(icon.replace(/-fill$/, ""))}`;
  if (icon.startsWith("message")) return renderBpmnMessageIcon(box, stroke, fill, width, className);
  if (icon === "timer") return renderBpmnTimerIcon(box, stroke, width, className);
  if (icon.startsWith("signal")) return renderBpmnSignalIcon(box, stroke, fill, width, className);
  if (icon === "xor") return renderBpmnXorIcon(box, stroke, width, className);
  if (icon === "inclusive") return renderBpmnInclusiveIcon(box, stroke, width, className);
  if (icon === "eventbased") return renderBpmnEventBasedIcon(box, stroke, width, className);
  if (icon.startsWith("compensation")) return renderBpmnCompensationIcon(box, stroke, fill, width, className);
  if (icon === "error") return renderBpmnErrorIcon(box, stroke, width, className);
  if (icon === "terminate") return `<circle class="${className}" cx="${format(box.cx)}" cy="${format(box.cy)}" r="${format(
    Math.min(box.width, box.height) * 0.24
  )}" stroke="${stroke}" fill="${fill}" stroke-width="${width}" />`;
  if (icon === "data-object") return renderBpmnDataObjectIcon(box, stroke, width, className);
  if (icon === "data-store") return renderBpmnDataStoreIcon(box, stroke, width, className);
  if (["manual", "script", "service", "user", "pool-label"].includes(icon)) {
    return renderBpmnSmallGlyph(box, stroke, icon, className);
  }
  return "";
}

function renderBpmnMarker(item, unit) {
  const marker = String(item.bpmnMarker || "").trim();
  const box = nodePixelBox(item, unit);
  const stroke = escapeAttribute(item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black");
  const width = format(Math.max(1, (item.style?.lineWidth ?? 1) * 0.75));
  const size = Math.min(box.width, box.height) * 0.2;
  const cx = box.cx;
  const cy = box.y2 - Math.max(size * 0.8, 8);
  const className = `tikz-bpmn-marker tikz-bpmn-${escapeAttribute(marker)}`;
  if (marker === "subprocess") {
    return `<g class="${className}" stroke="${stroke}" fill="none" stroke-width="${width}"><rect x="${format(
      cx - size / 2
    )}" y="${format(cy - size / 2)}" width="${format(size)}" height="${format(size)}"/><path d="M ${format(
      cx - size * 0.3
    )} ${format(cy)} H ${format(cx + size * 0.3)} M ${format(cx)} ${format(cy - size * 0.3)} V ${format(
      cy + size * 0.3
    )}"/></g>`;
  }
  if (marker === "multiinstance") {
    return `<g class="${className}" stroke="${stroke}" fill="none" stroke-width="${width}"><path d="M ${format(
      cx - size * 0.35
    )} ${format(cy - size / 2)} V ${format(cy + size / 2)} M ${format(cx)} ${format(cy - size / 2)} V ${format(
      cy + size / 2
    )} M ${format(cx + size * 0.35)} ${format(cy - size / 2)} V ${format(cy + size / 2)}"/></g>`;
  }
  if (marker === "loop") {
    return `<path class="${className}" d="M ${format(cx + size * 0.45)} ${format(cy)} A ${format(size * 0.45)} ${format(
      size * 0.45
    )} 0 1 1 ${format(cx - size * 0.3)} ${format(cy - size * 0.28)} M ${format(cx - size * 0.3)} ${format(
      cy - size * 0.28
    )} L ${format(cx - size * 0.08)} ${format(cy - size * 0.32)} L ${format(cx - size * 0.18)} ${format(
      cy - size * 0.08
    )}" stroke="${stroke}" fill="none" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" />`;
  }
  if (marker === "compensation") return renderBpmnCompensationIcon({ ...box, cx, cy, width: size * 2, height: size * 1.1 }, stroke, "none", width, className);
  if (marker === "adhoc") return renderBpmnSmallGlyph({ ...box, cx, cy, width: size * 2, height: size }, stroke, "adhoc", className);
  return "";
}

function nodePixelBox(item, unit) {
  const width = item.width * unit;
  const height = item.height * unit;
  const cx = item.x * unit;
  const cy = -item.y * unit;
  return {
    cx,
    cy,
    width,
    height,
    x1: cx - width / 2,
    x2: cx + width / 2,
    y1: cy - height / 2,
    y2: cy + height / 2
  };
}

function renderBpmnMessageIcon(box, stroke, fill, width, className) {
  const w = box.width * 0.45;
  const h = box.height * 0.3;
  const x = box.cx - w / 2;
  const y = box.cy - h / 2;
  return `<g class="${className}" stroke="${stroke}" fill="${fill}" stroke-width="${width}" stroke-linejoin="round"><rect x="${format(
    x
  )}" y="${format(y)}" width="${format(w)}" height="${format(h)}"/><path d="M ${format(x)} ${format(y)} L ${format(
    box.cx
  )} ${format(y + h * 0.58)} L ${format(x + w)} ${format(y)} M ${format(x)} ${format(y + h)} L ${format(
    box.cx
  )} ${format(y + h * 0.42)} L ${format(x + w)} ${format(y + h)}"/></g>`;
}

function renderBpmnTimerIcon(box, stroke, width, className) {
  const r = Math.min(box.width, box.height) * 0.27;
  const ticks = [];
  for (let angle = 0; angle < 360; angle += 30) {
    const rad = (angle * Math.PI) / 180;
    ticks.push(`M ${format(box.cx + Math.cos(rad) * r * 0.78)} ${format(box.cy + Math.sin(rad) * r * 0.78)} L ${format(
      box.cx + Math.cos(rad) * r
    )} ${format(box.cy + Math.sin(rad) * r)}`);
  }
  return `<g class="${className}" stroke="${stroke}" fill="none" stroke-width="${width}" stroke-linecap="round"><circle cx="${format(
    box.cx
  )}" cy="${format(box.cy)}" r="${format(r)}"/><path d="${ticks.join(" ")} M ${format(box.cx)} ${format(box.cy)} L ${format(
    box.cx
  )} ${format(box.cy - r * 0.55)} M ${format(box.cx)} ${format(box.cy)} L ${format(box.cx + r * 0.5)} ${format(
    box.cy
  )}"/></g>`;
}

function renderBpmnSignalIcon(box, stroke, fill, width, className) {
  const r = Math.min(box.width, box.height) * 0.33;
  const points = [
    [box.cx, box.cy - r],
    [box.cx - r * 0.87, box.cy + r * 0.5],
    [box.cx + r * 0.87, box.cy + r * 0.5]
  ];
  return `<polygon class="${className}" points="${points.map(([x, y]) => `${format(x)},${format(y)}`).join(" ")}" stroke="${stroke}" fill="${fill}" stroke-width="${width}" stroke-linejoin="round" />`;
}

function renderBpmnInclusiveIcon(box, stroke, width, className) {
  const r = Math.min(box.width, box.height) * 0.24;
  return `<circle class="${className}" cx="${format(box.cx)}" cy="${format(box.cy)}" r="${format(r)}" stroke="${stroke}" fill="none" stroke-width="${width}" />`;
}

function renderBpmnXorIcon(box, stroke, width, className) {
  const r = Math.min(box.width, box.height) * 0.18;
  return `<path class="${className}" d="M ${format(box.cx - r)} ${format(box.cy - r)} L ${format(box.cx + r)} ${format(box.cy + r)} M ${format(
    box.cx - r
  )} ${format(box.cy + r)} L ${format(box.cx + r)} ${format(box.cy - r)}" stroke="${stroke}" fill="none" stroke-width="${width}" stroke-linecap="round" />`;
}

function renderBpmnEventBasedIcon(box, stroke, width, className) {
  const r = Math.min(box.width, box.height) * 0.29;
  const pentagon = Array.from({ length: 5 }, (_unused, index) => {
    const a = (-90 + index * 72) * Math.PI / 180;
    return `${format(box.cx + Math.cos(a) * r * 0.58)},${format(box.cy + Math.sin(a) * r * 0.58)}`;
  }).join(" ");
  return `<g class="${className}" stroke="${stroke}" fill="none" stroke-width="${width}"><circle cx="${format(box.cx)}" cy="${format(
    box.cy
  )}" r="${format(r)}"/><circle cx="${format(box.cx)}" cy="${format(box.cy)}" r="${format(r * 0.78)}"/><polygon points="${pentagon}"/></g>`;
}

function renderBpmnCompensationIcon(box, stroke, fill, width, className) {
  const w = Math.min(box.width, box.height) * 0.34;
  const h = w * 0.78;
  const left = `M ${format(box.cx - w * 0.75)} ${format(box.cy)} L ${format(box.cx - w * 0.05)} ${format(
    box.cy - h / 2
  )} L ${format(box.cx - w * 0.05)} ${format(box.cy + h / 2)} Z`;
  const right = `M ${format(box.cx - w * 0.05)} ${format(box.cy)} L ${format(box.cx + w * 0.65)} ${format(
    box.cy - h / 2
  )} L ${format(box.cx + w * 0.65)} ${format(box.cy + h / 2)} Z`;
  return `<g class="${className}" stroke="${stroke}" fill="${fill}" stroke-width="${width}" stroke-linejoin="round"><path d="${left}"/><path d="${right}"/></g>`;
}

function renderBpmnErrorIcon(box, stroke, width, className) {
  const r = Math.min(box.width, box.height) * 0.3;
  return `<path class="${className}" d="M ${format(box.cx - r * 0.55)} ${format(box.cy - r)} L ${format(
    box.cx + r * 0.05
  )} ${format(box.cy - r * 0.15)} L ${format(box.cx - r * 0.25)} ${format(box.cy - r * 0.15)} L ${format(
    box.cx + r * 0.55
  )} ${format(box.cy + r)} L ${format(box.cx - r * 0.05)} ${format(box.cy + r * 0.15)} L ${format(
    box.cx + r * 0.25
  )} ${format(box.cy + r * 0.15)} Z" stroke="${stroke}" fill="none" stroke-width="${width}" stroke-linejoin="round" />`;
}

function renderBpmnDataObjectIcon(box, stroke, width, className) {
  const fold = Math.min(box.width, box.height) * 0.22;
  return `<path class="${className}" d="M ${format(box.x1)} ${format(box.y1)} V ${format(box.y2)} H ${format(
    box.x2
  )} V ${format(box.y1 + fold)} L ${format(box.x2 - fold)} ${format(box.y1)} Z M ${format(box.x2 - fold)} ${format(
    box.y1
  )} V ${format(box.y1 + fold)} H ${format(box.x2)}" stroke="${stroke}" fill="none" stroke-width="${width}" stroke-linejoin="round" />`;
}

function renderBpmnDataStoreIcon(box, stroke, width, className) {
  const rx = box.width * 0.38;
  const ry = box.height * 0.12;
  return `<g class="${className}" stroke="${stroke}" fill="none" stroke-width="${width}"><ellipse cx="${format(box.cx)}" cy="${format(
    box.y1 + ry
  )}" rx="${format(rx)}" ry="${format(ry)}"/><path d="M ${format(box.cx - rx)} ${format(box.y1 + ry)} V ${format(
    box.y2 - ry
  )} A ${format(rx)} ${format(ry)} 0 0 0 ${format(box.cx + rx)} ${format(box.y2 - ry)} V ${format(
    box.y1 + ry
  )} M ${format(box.cx - rx)} ${format(box.cy)} A ${format(rx)} ${format(ry)} 0 0 0 ${format(box.cx + rx)} ${format(
    box.cy
  )}"/></g>`;
}

function renderBpmnSmallGlyph(box, stroke, glyph, className) {
  if (glyph === "manual") return renderBpmnManualGlyph(box, stroke, className);
  const text = glyph === "adhoc" ? "~" : glyph === "script" ? "S" : glyph === "service" ? "G" : glyph === "user" ? "U" : glyph === "manual" ? "M" : "|";
  const x = glyph === "pool-label" ? box.x1 + box.width * 0.12 : box.x1 + box.width * 0.18;
  const y = glyph === "pool-label" ? box.cy : box.y1 + box.height * 0.25;
  return `<text class="${className}" x="${format(x)}" y="${format(y)}" fill="${stroke}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    Math.max(8, Math.min(box.width, box.height) * 0.24)
  )}" font-family="${escapeAttribute(TIKZ_FONT_FAMILY)}">${escapeText(text)}</text>`;
}

function renderBpmnManualGlyph(box, stroke, className) {
  const scale = Math.min(box.width, box.height) * 0.11;
  const x = box.x1 + box.width * 0.14;
  const y = box.y1 + box.height * 0.14;
  const fingers = [0, 0.28, 0.56, 0.84]
    .map((offset) => `M ${format(x + scale * offset)} ${format(y + scale * 0.95)} V ${format(y)}`)
    .join(" ");
  const palm = [
    `M ${format(x - scale * 0.12)} ${format(y + scale * 0.92)}`,
    `L ${format(x + scale * 1.12)} ${format(y + scale * 0.92)}`,
    `L ${format(x + scale * 1.02)} ${format(y + scale * 1.35)}`,
    `L ${format(x + scale * 0.12)} ${format(y + scale * 1.35)}`,
    `Z`
  ].join(" ");
  return `<g class="${className}" stroke="${stroke}" fill="none" stroke-width="${format(Math.max(0.65, scale * 0.12))}" stroke-linecap="round" stroke-linejoin="round"><path d="${fingers}"/><path d="${palm}"/></g>`;
}

// Claude: 用一个 <g transform="rotate(...)"> 包住文本，实现 \node[rotate=θ]{...} 的文字旋转。
// TikZ 的 rotate 是数学坐标系下逆时针为正；而 SVG 的 y 轴向下、rotate 顺时针为正，故取负号。
// 旋转中心取节点锚点 (item.x, -item.y)，与文本的定位中心一致。
function wrapNodeRotation(svg, item, unit) {
  if (!item.rotation) return svg;
  const cx = format(item.x * unit);
  const cy = format(-item.y * unit);
  return `<g transform="rotate(${format(-item.rotation)} ${cx} ${cy})">${svg}</g>`;
}

function renderPlainTextNode(item, normalized, unit) {
  if (!normalized.color && hasTextColorSegments(normalized.raw)) return renderSegmentedTextNode(item, normalized, unit);
  const color = escapeAttribute(normalized.color || item.style?.fill || "black");
  const rawFontFamily = item.style?.fontFamily || normalized.fontFamily || TIKZ_FONT_FAMILY;
  const fontFamily = escapeAttribute(rawFontFamily);
  const baseFontSize = TIKZ_TEXT_FONT_SIZE * (normalized.scale || 1) * textFontScale(item, normalized);
  const sourceLines = normalized.lines.length ? normalized.lines : [normalized.text];
  const formattedLines = sourceLines.map(formatTextLine);
  const lines = wrapSvgTextLines(formattedLines, item.wrapWidth, unit, baseFontSize);
  const contentLines = lines.length === formattedLines.length ? sourceLines : lines;
  const fontSize = fitFontSizeToBox(baseFontSize, item.fitBox, unit, lines);
  const lineStyles = textLineStyles(normalized, lines.length);
  const x = format(item.x * unit);
  const y = format(-item.y * unit);
  const widthScale = typewriterWidthScale(rawFontFamily);
  if (lines.length <= 1) {
    const lineStyle = lineStyles[0] || {};
    const lineFontSize = fontSize * (lineStyle.scale || 1);
    const content = renderSvgTextLineContent(contentLines[0], lines[0] || "", lineFontSize);
    const text = `<text x="${x}" y="${y}" fill="${color}" text-anchor="middle" dominant-baseline="middle" xml:space="preserve" font-size="${format(
      lineFontSize
    )}"${fontWeightAttribute(lineStyle)}${fontStyleAttribute(lineStyle)} font-family="${fontFamily}">${content}</text>`;
    return wrapTypewriterWidth(text, item, unit, widthScale);
  }
  const lineOffsets = baselineOffsets(fontSize, lineStyles);
  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? lineOffsets[0] : lineOffsets[index] - lineOffsets[index - 1];
      const lineStyle = lineStyles[index] || {};
      const lineFontSize = fontSize * (lineStyle.scale || 1);
      return `<tspan x="${x}" dy="${format(dy)}"${lineFontAttributes(lineStyle, fontSize)}>${renderSvgTextLineContent(
        contentLines[index],
        line,
        lineFontSize
      )}</tspan>`;
    })
    .join("");
  const text = `<text x="${x}" y="${y}" fill="${color}" text-anchor="middle" dominant-baseline="middle" xml:space="preserve" font-size="${format(
    fontSize
  )}" font-family="${fontFamily}">${tspans}</text>`;
  return wrapTypewriterWidth(text, item, unit, widthScale);
}

function textLineStyles(normalized, count) {
  const styles = Array.isArray(normalized.lineStyles) ? normalized.lineStyles : [];
  return Array.from({ length: count }, (_unused, index) => ({
    scale: Number(styles[index]?.scale) || 1,
    fontWeight: styles[index]?.fontWeight || null,
    fontStyle: styles[index]?.fontStyle || normalized.fontStyle || null
  }));
}

function baselineOffsets(baseFontSize, lineStyles) {
  if (lineStyles.length <= 1) return [0];
  const gaps = [];
  for (let index = 0; index < lineStyles.length - 1; index += 1) {
    gaps.push(lineBaselineGap(baseFontSize, lineStyles[index], lineStyles[index + 1]));
  }
  const total = gaps.reduce((sum, gap) => sum + gap, 0);
  const offsets = [-total / 2];
  for (const gap of gaps) offsets.push(offsets.at(-1) + gap);
  return offsets;
}

function lineBaselineGap(baseFontSize, first = {}, second = {}) {
  const firstScale = Number(first.scale) || 1;
  const secondScale = Number(second.scale) || 1;
  if (Math.abs(firstScale - secondScale) < 0.05) {
    return baseFontSize * Math.max(firstScale, secondScale) * 1.15;
  }
  return baseFontSize * (firstScale + secondScale) * 0.5;
}

function lineFontAttributes(lineStyle, baseFontSize) {
  return `${lineStyle.scale && lineStyle.scale !== 1 ? ` font-size="${format(baseFontSize * lineStyle.scale)}"` : ""}${fontWeightAttribute(
    lineStyle
  )}${fontStyleAttribute(lineStyle)}`;
}

function fontWeightAttribute(lineStyle) {
  return lineStyle.fontWeight ? ` font-weight="${escapeAttribute(String(lineStyle.fontWeight))}"` : "";
}

function fontStyleAttribute(lineStyle) {
  return lineStyle.fontStyle ? ` font-style="${escapeAttribute(String(lineStyle.fontStyle))}"` : "";
}

function textFontScale(item, normalized = null) {
  const key = normalized?.explicitFontSize ? item.style?.fontSizeBaseScale : item.style?.fontScale;
  const scale = Number(key);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function wrapSvgTextLines(lines, wrapWidth, unit, fontSize) {
  const width = Number(wrapWidth) * unit;
  if (!Number.isFinite(width) || width <= 0) return lines;
  const maxChars = Math.max(1, Math.floor(width / Math.max(1, fontSize * 0.49)));
  return lines.flatMap((line) => wrapSvgTextLine(line, maxChars));
}

function wrapSvgTextLine(line, maxChars) {
  const text = String(line || "").trim();
  if (!text || text.length <= maxChars || !/\s/.test(text)) return [text];
  const output = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars || !current) {
      current = next;
    } else {
      output.push(current);
      current = word;
    }
  }
  if (current) output.push(current);
  return output.length ? output : [text];
}

function renderSegmentedTextNode(item, normalized, unit) {
  const lines = splitTextLines(normalized.raw || normalized.text);
  const fallbackLines = (normalized.lines.length ? normalized.lines : lines).map(formatTextLine);
  const color = escapeAttribute(item.style?.fill || "black");
  const rawFontFamily = item.style?.fontFamily || normalized.fontFamily || TIKZ_FONT_FAMILY;
  const fontFamily = escapeAttribute(rawFontFamily);
  const baseFontSize = TIKZ_TEXT_FONT_SIZE * (normalized.scale || 1) * textFontScale(item, normalized);
  const fontSize = fitFontSizeToBox(baseFontSize, item.fitBox, unit, fallbackLines);
  const x = format(item.x * unit);
  const y = format(-item.y * unit);
  const widthScale = typewriterWidthScale(rawFontFamily);
  const lineHeight = fontSize * 1.15;
  const startDy = -((lines.length - 1) * lineHeight) / 2;
  const rects = [];
  let baseline = 0;
  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? startDy : lineHeight;
      baseline += dy;
      const parsedSegments = parseTextColorSegments(line);
      rects.push(...inlineBoxRects(parsedSegments, item.x * unit, -item.y * unit + baseline, fontSize));
      const segments = parsedSegments
        .map((segment) => {
          const text = escapeText(formatTextLine(segment.text));
          if (!text) return "";
          const fill = segment.background ? "white" : segment.color;
          return fill ? `<tspan fill="${escapeAttribute(fill)}">${text}</tspan>` : text;
        })
        .join("");
      return `<tspan x="${x}" dy="${format(dy)}">${segments}</tspan>`;
    })
    .join("");
  const text = `<text x="${x}" y="${y}" fill="${color}" text-anchor="middle" dominant-baseline="middle" xml:space="preserve" font-size="${format(
    fontSize
  )}" font-family="${fontFamily}">${tspans}</text>`;
  return wrapTypewriterWidth(rects.length ? `<g>${rects.join("")}${text}</g>` : text, item, unit, widthScale);
}

function typewriterWidthScale(fontFamily) {
  const text = String(fontFamily || "");
  return /(?:Typewriter|mono|Menlo|Monaco|Consolas|Courier)/i.test(text) ? TIKZ_TYPEWRITER_WIDTH_SCALE : 1;
}

function wrapTypewriterWidth(svg, item, unit, scale) {
  if (!Number.isFinite(scale) || Math.abs(scale - 1) < 1e-6) return svg;
  const cx = format(item.x * unit);
  return `<g class="tikz-typewriter-text" transform="translate(${cx} 0) scale(${format(scale)} 1) translate(${format(-item.x * unit)} 0)">${svg}</g>`;
}

function hasTextColorSegments(source) {
  return /\\(?:textcolor|tikzinlinebox)\s*\{[^{}]+\}\s*\{[^{}]*\}/.test(String(source || ""));
}

function splitTextLines(source) {
  return String(source || "")
    .trim()
    .replace(/\\(?:Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b/g, "")
    .replace(/\\(?:tt|rm|sf|bf|bfseries|itshape|slshape|scshape)\b/g, "")
    .split(/\\\\|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length);
}

function parseTextColorSegments(line) {
  const segments = [];
  const pattern = /\\(textcolor|tikzinlinebox)\s*\{([^{}]+)\}\s*\{([^{}]*)\}/g;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(line))) {
    if (match.index > cursor) segments.push({ text: line.slice(cursor, match.index) });
    const kind = match[1];
    const color = match[2].trim();
    const text = match[3];
    if (kind === "tikzinlinebox") segments.push({ background: color, text });
    else segments.push({ color, text });
    cursor = match.index + match[0].length;
  }
  if (cursor < line.length) segments.push({ text: line.slice(cursor) });
  return segments.length ? segments : [{ text: line }];
}

function inlineBoxRects(segments, centerX, baselineY, fontSize) {
  const charWidth = fontSize * 0.55;
  const widths = segments.map((segment) => Math.max(segment.text.length * charWidth, segment.background ? fontSize * 0.9 : 0));
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  const rects = [];
  let cursor = centerX - totalWidth / 2;
  segments.forEach((segment, index) => {
    const width = widths[index];
    if (segment.background) {
      const padX = fontSize * 0.12;
      const height = fontSize * 0.92;
      rects.push(
        `<rect x="${format(cursor - padX)}" y="${format(baselineY - height * 0.55)}" width="${format(
          width + padX * 2
        )}" height="${format(height)}" fill="${escapeAttribute(segment.background)}" />`
      );
    }
    cursor += width;
  });
  return rects;
}

function formatTextLine(line) {
  const math = parseMathText(line);
  if (math) return mathFallbackText(math.tex);
  return String(line).replace(/\$([^$]+)\$/g, (_match, tex) => mathFallbackText(tex));
}

function renderSvgTextLineContent(sourceLine, formattedLine, fontSize) {
  const source = String(sourceLine ?? formattedLine ?? "").trim();
  const math = parseMathText(source);
  if (math) return renderSvgMathFallbackContent(normalizeKatexTex(math.tex), fontSize);
  if (/\$[^$]+\$/.test(source)) return renderInlineSvgMathContent(source, formattedLine, fontSize);
  return escapeText(formattedLine ?? source);
}

function renderInlineSvgMathContent(source, formattedLine, fontSize) {
  const parts = [];
  const pattern = /\$([^$]+)\$/g;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(source))) {
    if (match.index > cursor) parts.push(escapeText(formatTextLine(source.slice(cursor, match.index))));
    parts.push(renderSvgMathFallbackContent(normalizeKatexTex(match[1].trim()), fontSize));
    cursor = match.index + match[0].length;
  }
  if (!parts.length) return escapeText(formattedLine ?? source);
  if (cursor < source.length) parts.push(escapeText(formatTextLine(source.slice(cursor))));
  return parts.join("");
}

function renderSvgMathFallbackContent(tex, fontSize) {
  const simple = simpleNumericSubscriptFallback(tex);
  if (simple) return renderSimpleSubscriptContent(simple, fontSize);
  const scripted = scriptedMathFallback(tex, { allowSimpleScripts: true });
  if (scripted) return renderScriptedSegmentsContent(scripted, fontSize);
  const mixed = mixedAlphabeticSubscriptFallback(tex);
  if (mixed) return renderMixedSubscriptContent(mixed, fontSize);
  return escapeText(mathFallbackText(tex));
}

function hasInlineMath(normalized) {
  const source = String(normalized.raw || normalized.text || "");
  return /\$[^$]+\$/.test(source);
}

function renderRichTextNode(item, normalized, unit) {
  const source = cleanRichTextSource(normalized.text || normalized.raw || "");
  const rawLines = source.split(/\\\\|\n/).map((line) => line.trim()).filter((line) => line.length);
  const lines = rawLines.length ? rawLines : normalized.lines.length ? normalized.lines : [normalized.text];
  const fallback = renderPlainTextNode(item, normalized, unit);
  const color = escapeAttribute(normalized.color || item.style?.fill || "black");
  const fontFamily = escapeAttribute(item.style?.fontFamily || normalized.fontFamily || TIKZ_FONT_FAMILY);
  const baseFontSize = TIKZ_TEXT_FONT_SIZE * (normalized.scale || 1) * textFontScale(item, normalized);
  const lineStyles = textLineStyles(normalized, lines.length);
  const fontSize = fitRichFontSizeToBox(baseFontSize, item.fitBox, unit, lines, lineStyles);
  const box = estimateRichTextBox(lines, fontSize, lineStyles);
  const x = item.x * unit - box.width / 2;
  const y = -item.y * unit - box.height / 2;
  const htmlLines = lines
    .map((line, index) => {
      const lineStyle = lineStyles[index] || {};
      const lineFontSize = fontSize * (lineStyle.scale || 1);
      return `<div class="tikz-rich-line"${fontWeightAttribute(lineStyle)} style="font-size:${format(
        lineFontSize
      )}px;">${renderInlineMathHtml(line)}</div>`;
    })
    .join("");
  const foreignObject = `<foreignObject x="${format(x)}" y="${format(
    y
  )}" width="${format(box.width)}" height="${format(
    box.height
  )}"><div xmlns="http://www.w3.org/1999/xhtml" class="tikz-rich-text" style="width:${format(
    box.width
  )}px;height:${format(
    box.height
  )}px;color:${color};font-size:${format(
    fontSize
  )}px;line-height:1.05;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;white-space:nowrap;overflow:visible;font-family:${escapeAttribute(
    fontFamily
  )};">${htmlLines}</div></foreignObject>`;
  return `<switch>${foreignObject}${fallback}</switch>`;
}

function cleanRichTextSource(source) {
  return String(source)
    .trim()
    .replace(/\\(?:Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b/g, "")
    .replace(/\\(?:tt|rm|sf|bfseries|itshape|slshape|scshape)\b/g, "")
    .replace(/\\dots/g, "...")
    .replace(/[ \t]+/g, " ");
}

function renderInlineMathHtml(line) {
  const parts = [];
  const pattern = /\$([^$]+)\$/g;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(line))) {
    if (match.index > cursor) parts.push(escapeHtml(line.slice(cursor, match.index)));
    parts.push(
      katex.renderToString(normalizeKatexTex(match[1].trim()), {
        displayMode: false,
        output: "html",
        throwOnError: false,
        strict: "ignore",
        trust: false,
        macros: KATEX_MACROS
      })
    );
    cursor = match.index + match[0].length;
  }
  if (cursor < line.length) parts.push(escapeHtml(line.slice(cursor)));
  return parts.join("");
}

function estimateRichTextBox(lines, fontSize, lineStyles = []) {
  const fallbackLines = lines.map(formatTextLine);
  const width = Math.max(
    42,
    Math.max(
      ...fallbackLines.map((line, index) => {
        const scale = Number(lineStyles[index]?.scale) || 1;
        return String(line).length * fontSize * scale * 0.52 + 18;
      }),
      0
    )
  );
  const height = Math.max(
    fontSize * 1.15,
    lineStyles.reduce((sum, style) => sum + fontSize * (Number(style?.scale) || 1) * 1.12, 0) || lines.length * fontSize * 1.12
  );
  return { width, height };
}

function renderRectangleSplit(item, unit) {
  const parts = Math.max(1, Math.round(item.parts || 1));
  const x = (item.x - item.width / 2) * unit;
  const y = -(item.y + item.height / 2) * unit;
  const width = item.width * unit;
  const height = item.height * unit;
  const partWidth = width / parts;
  const lineWidth = item.style?.lineWidth ?? 1;
  const stroke = escapeAttribute(item.style?.stroke || "black");
  const fills = item.partFills || [];
  const partRects = Array.from({ length: parts }, (_, index) => {
    const fill = escapeAttribute(fills[index] || "none");
    return `<rect class="tikz-split-part" x="${format(x + index * partWidth)}" y="${format(y)}" width="${format(
      partWidth
    )}" height="${format(height)}" stroke="none" fill="${fill}" />`;
  }).join("");
  const separators = Array.from({ length: parts - 1 }, (_, index) => {
    const lineX = x + (index + 1) * partWidth;
    return `<path d="M ${format(lineX)} ${format(y)} L ${format(lineX)} ${format(
      y + height
    )}" stroke="${stroke}" fill="none" stroke-width="${format(lineWidth)}" />`;
  }).join("");
  const outer = `<rect x="${format(x)}" y="${format(y)}" width="${format(width)}" height="${format(
    height
  )}" rx="${format((item.rx || 0) * unit)}" stroke="${stroke}" fill="none" stroke-width="${format(lineWidth)}" />`;
  return `<g class="tikz-rectangle-split">${partRects}${separators}${outer}</g>`;
}

function renderImagePlaceholder(item, image, unit) {
  const scale = imagePlaceholderScale(item, image);
  const width = image.width * unit * scale;
  const height = image.height * unit * scale;
  const x = item.x * unit - width / 2;
  const y = -item.y * unit - height / 2;
  // Claude: 真实折线（如 case 038 的 ReLU 形状）。把归一化坐标映射回框内、按比例绘制；
  // y 轴翻转(1-y)对应 SVG 向下为正。节点边框由 nodeBox 单独画，这里只画线。
  if (image.plot === "polyline") {
    const stroke = escapeAttribute(item.style?.fill || "black");
    const data = (image.polylines || [])
      .map((line) =>
        line
          .map((point, index) => `${index === 0 ? "M" : "L"} ${format(x + point.x * width)} ${format(y + (1 - point.y) * height)}`)
          .join(" ")
      )
      .join(" ");
    const labelHeight = Number(image.labelHeight || 0) * unit;
    const label = image.label
      ? `<text x="${format(item.x * unit)}" y="${format(y + height - labelHeight / 2)}" fill="${stroke}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
          Math.max(10, labelHeight * 0.9)
        )}" font-family="${escapeAttribute(TIKZ_FONT_FAMILY)}">${escapeText(image.label)}</text>`
      : "";
    return `<g class="tikz-image-placeholder tikz-inline-polyline"><path d="${data}" stroke="${stroke}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />${label}</g>`;
  }
  if (image.plot === "boxed-text") {
    const stroke = escapeAttribute(item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black");
    const fill = escapeAttribute(item.style?.fill && item.style.fill !== "black" ? item.style.fill : "none");
    const cx = item.x * unit;
    const cy = -item.y * unit;
    const rotate = Number(image.rotate) || 0;
    const labelRotate = rotate ? ` transform="rotate(${format(-rotate)} ${format(cx)} ${format(cy)})"` : "";
    const label = image.label
      ? `<text x="${format(cx)}" y="${format(cy)}" fill="${escapeAttribute(
          item.style?.fill || "black"
        )}" text-anchor="middle" dominant-baseline="middle" font-size="${format(TIKZ_TEXT_FONT_SIZE)}" font-family="${escapeAttribute(
          TIKZ_FONT_FAMILY
        )}"${labelRotate}>${escapeText(image.label)}</text>`
      : "";
    return `<g class="tikz-image-placeholder tikz-boxed-text"><rect x="${format(x)}" y="${format(y)}" width="${format(
      width
    )}" height="${format(height)}" stroke="${stroke}" fill="${fill}" stroke-width="${format(lineWidthFromPt(0.4))}" />${label}</g>`;
  }
  if (image.plot === "gaussian") {
    const samples = 44;
    const points = Array.from({ length: samples }, (_unused, index) => {
      const t = index / (samples - 1);
      const domain = -3 + t * 6;
      const value = Math.exp(-domain * domain);
      return {
        x: x + width * (0.08 + t * 0.84),
        y: y + height * (0.82 - value * 0.64)
      };
    });
    const data = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${format(point.x)} ${format(point.y)}`)
      .join(" ");
    const grid = image.grid ? renderAxisPlaceholderGrid(x, y, width, height, unit) : "";
    const axisLeft = x + width * 0.08;
    const axisRight = x + width * 0.92;
    const axisTop = y + height * 0.08;
    const axisBase = y + height * 0.82;
    const fillData = `M ${format(points[0].x)} ${format(axisBase)} ${data} L ${format(points.at(-1).x)} ${format(axisBase)} Z`;
    const fill = gaussianPlaceholderFill(image.raw);
    const axisData = `M ${format(axisLeft)} ${format(axisBase)} L ${format(axisRight)} ${format(axisBase)} M ${format(axisLeft)} ${format(
      axisBase
    )} L ${format(axisLeft)} ${format(axisTop)}`;
    const axisArrows = [
      `M ${format(axisRight)} ${format(axisBase)} l ${format(-width * 0.035)} ${format(-height * 0.018)} l 0 ${format(height * 0.036)} Z`,
      `M ${format(axisLeft)} ${format(axisTop)} l ${format(-width * 0.018)} ${format(height * 0.035)} l ${format(width * 0.036)} 0 Z`
    ].join(" ");
    return `<g class="tikz-axis-placeholder tikz-gaussian">${grid}<path class="tikz-gaussian-fill" d="${fillData}" fill="${fill}" stroke="none" /><path d="${data}" stroke="black" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /><path class="tikz-gaussian-axis" d="${axisData}" stroke="black" fill="none" stroke-width="1" stroke-linecap="butt" stroke-linejoin="miter" /><path class="tikz-gaussian-axis-arrows" d="${axisArrows}" fill="black" stroke="none" /></g>`;
  }
  if (image.plot === "fm-wave") {
    const labelHeight = image.label ? Math.max(14, height * 0.28) : 0;
    const waveHeight = Math.max(18, height - labelHeight);
    const samples = 120;
    const points = Array.from({ length: samples }, (_unused, index) => {
      const t = index / (samples - 1);
      const carrier = Math.sin(t * Math.PI * 2 * 16 - 2.5 * Math.cos(t * Math.PI * 2));
      const envelope = 0.35 + 0.65 * Math.sin(t * Math.PI * 2) ** 2;
      return {
        x: x + width * (0.04 + t * 0.92),
        y: y + waveHeight * 0.5 - carrier * envelope * waveHeight * 0.34
      };
    });
    const data = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${format(point.x)} ${format(point.y)}`)
      .join(" ");
    const label = image.label
      ? `<text x="${format(item.x * unit)}" y="${format(y + waveHeight + labelHeight * 0.72)}" fill="${escapeAttribute(
          item.style?.fill || "black"
        )}" text-anchor="middle" dominant-baseline="middle" font-size="${format(labelHeight * 0.72)}" font-family="${escapeAttribute(
          TIKZ_FONT_FAMILY
        )}">${escapeText(image.label)}</text>`
      : "";
    return `<g class="tikz-axis-placeholder tikz-fm-wave"><path d="${data}" stroke="black" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />${label}</g>`;
  }
  if (image.plot === "wave") {
    const labelHeight = image.label ? Math.max(12, height * 0.32) : 0;
    const waveHeight = Math.max(8, height - labelHeight);
    const waveCount = Math.max(1, Math.round(image.waveCount || 1));
    const samples = 40;
    const waves = Array.from({ length: waveCount }, (_unused, waveIndex) => {
      const bandTop = y + (waveHeight * waveIndex) / waveCount;
      const bandHeight = waveHeight / waveCount;
      const waveY = bandTop + bandHeight * 0.5;
      const points = Array.from({ length: samples }, (_unused2, index) => {
        const t = index / (samples - 1);
        return {
          x: x + width * (0.06 + t * 0.88),
          y: waveY - Math.sin(t * Math.PI * 4) * bandHeight * 0.28
        };
      });
      const data = points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${format(point.x)} ${format(point.y)}`)
        .join(" ");
      return `<path d="${data}" stroke="black" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`;
    }).join("");
    const label = image.label
      ? `<text x="${format(item.x * unit)}" y="${format(y + waveHeight + labelHeight * 0.72)}" fill="${escapeAttribute(
          item.style?.fill || "black"
        )}" text-anchor="middle" dominant-baseline="middle" font-size="${format(labelHeight * 0.75)}" font-family="${escapeAttribute(
          TIKZ_FONT_FAMILY
        )}">${escapeText(image.label)}</text>`
      : "";
    return `<g class="tikz-image-placeholder tikz-inline-wave">${waves}${label}</g>`;
  }
  const label = image.fileName.replace(/\.[^.]+$/, "");
  return `<g class="tikz-image-placeholder"><rect x="${format(x)}" y="${format(y)}" width="${format(width)}" height="${format(
    height
  )}" rx="${format(Math.min(width, height) * 0.08)}" stroke="#335c85" fill="#edf5ff" stroke-width="1.2" /><text x="${format(
    item.x * unit
  )}" y="${format(-item.y * unit)}" fill="#254b73" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    Math.max(10, Math.min(16, height * 0.22))
  )}" font-family="${escapeAttribute(TIKZ_FONT_FAMILY)}">${escapeText(label)}</text></g>`;
}

function imagePlaceholderScale(item, image = {}) {
  const imageScale = Number(image.scale);
  const nodeScale = Number(item?.style?.fontScale);
  const scale = (Number.isFinite(imageScale) && imageScale > 0 ? imageScale : 1) * (Number.isFinite(nodeScale) && nodeScale > 0 ? nodeScale : 1);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function renderAxisPlaceholderGrid(x, y, width, height, unit) {
  const step = Math.max(6, unit * 0.2);
  const stroke = "rgb(140 140 140)";
  const lines = [];
  for (let gx = x + step; gx < x + width - 1e-6; gx += step) {
    lines.push(`M ${format(gx)} ${format(y)} L ${format(gx)} ${format(y + height)}`);
  }
  for (let gy = y + step; gy < y + height - 1e-6; gy += step) {
    lines.push(`M ${format(x)} ${format(gy)} L ${format(x + width)} ${format(gy)}`);
  }
  if (!lines.length) return "";
  return `<path class="tikz-axis-grid" d="${lines.join(" ")}" stroke="${stroke}" fill="none" stroke-width="0.45" stroke-dasharray="1 1.2" />`;
}

function gaussianPlaceholderFill(raw) {
  const text = String(raw || "");
  if (/fill\s*=\s*red\b/i.test(text)) return "rgb(255 230 230)";
  if (/fill\s*=\s*(?:blue|echodrk)\b/i.test(text)) return "rgb(230 246 250)";
  return "rgb(238 238 238)";
}

function renderMathNode(item, math, unit, options = {}) {
  const tex = normalizeKatexTex(math.tex);
  const box = estimateMathBox(tex, math.displayMode, unit, (math.scale || 1) * textFontScale(item, math));
  box.fontSize = fitFontSizeToBox(box.fontSize, item.fitBox, unit, [mathFallbackText(tex)]);
  const x = item.x * unit - box.width / 2;
  const y = -item.y * unit - box.height / 2;
  const color = escapeAttribute(math.color || item.style?.fill || "black");
  const fontStyle = mathFallbackFontStyle(tex);
  const fontWeight = mathFallbackFontWeight(tex);
  const fractionFallback = simpleFractionFallback(tex);
  if (fractionFallback && options.mathRenderer === "svg-text") {
    return renderFractionMathFallback(item, fractionFallback, box.fontSize * 0.9, unit, color, fontStyle, fontWeight);
  }
  const subscriptFallback = simpleNumericSubscriptFallback(tex);
  if (subscriptFallback && options.mathRenderer === "svg-text") {
    return renderSimpleSubscriptMathFallback(item, subscriptFallback, box.fontSize * 0.9, unit, color, fontStyle, fontWeight);
  }
  const scriptedFallback = scriptedMathFallback(tex);
  if (scriptedFallback && options.mathRenderer === "svg-text") {
    return renderScriptedMathFallback(item, scriptedFallback, box.fontSize * 0.9, unit, color, fontStyle, fontWeight);
  }
  const mixedSubscriptFallback = mixedAlphabeticSubscriptFallback(tex);
  if (mixedSubscriptFallback && options.mathRenderer === "svg-text") {
    return renderMixedSubscriptMathFallback(item, mixedSubscriptFallback, box.fontSize * 0.9, unit, color, fontStyle, fontWeight);
  }
  const styledScriptFallback = styledScriptedMathFallback(tex);
  if (styledScriptFallback && options.mathRenderer === "svg-text") {
    return renderScriptedMathFallback(item, styledScriptFallback, box.fontSize * 0.9, unit, color, fontStyle, fontWeight);
  }
  const tensorMatrixFallback = tensorMatrixFallbackParts(tex);
  if (tensorMatrixFallback && options.mathRenderer === "svg-text") {
    return renderTensorMatrixFallback(item, tensorMatrixFallback, box.fontSize * 0.82, unit, color);
  }
  const fallback = `<text x="${format(item.x * unit)}" y="${format(-item.y * unit)}" fill="${color}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    box.fontSize * 0.9
  )}"${fontStyle ? ` font-style="${fontStyle}"` : ""}${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(TIKZ_FONT_FAMILY)}">${escapeText(
    mathFallbackText(tex)
  )}</text>`;
  if (options.mathRenderer === "svg-text") return fallback;

  const html = katex.renderToString(tex, {
    displayMode: math.displayMode,
    output: "html",
    throwOnError: false,
    strict: "ignore",
    trust: false,
    macros: KATEX_MACROS
  });
  const foreignObject = `<foreignObject x="${format(x)}" y="${format(
    y
  )}" width="${format(box.width)}" height="${format(
    box.height
  )}"><div xmlns="http://www.w3.org/1999/xhtml" class="tikz-math${
    math.displayMode ? " display" : ""
  }" style="width:${format(box.width)}px;height:${format(
    box.height
  )}px;color:${color};font-size:${format(
    box.fontSize
  )}px;line-height:1;display:flex;align-items:center;justify-content:center;overflow:visible;font-family:${escapeAttribute(
    TIKZ_FONT_FAMILY
  )};">${html}</div></foreignObject>`;
  return `<switch>${foreignObject}${fallback}</switch>`;
}

function tensorMatrixFallbackParts(tex) {
  const source = String(tex || "");
  if (!/\\(?:overmat|undermat)\b/.test(source) || !/\\begin\{matrix\}/.test(source)) return null;
  const blocks = [];
  const pattern = /\\(overmat|undermat)\s*\{([\s\S]*?)\}\s*\{([\s\S]*?\\end\{matrix\})\s*\}\s*\{([^{}]*)\}/g;
  let match;
  while ((match = pattern.exec(source))) {
    const matrix = parseSmallMatrixBody(match[3]);
    if (!matrix.length) continue;
    blocks.push({
      labelPosition: match[1] === "overmat" ? "top" : "bottom",
      label: formatTextLine(match[2]).replace(/\$/g, "").trim(),
      color: tensorMatrixColor(match[4]),
      matrix
    });
  }
  return blocks.length >= 2 ? blocks.slice(0, 4) : null;
}

function parseSmallMatrixBody(source) {
  const match = String(source || "").match(/\\begin\{matrix\}([\s\S]*?)\\end\{matrix\}/);
  if (!match) return [];
  return match[1]
    .split(/\\\\/)
    .map((row) =>
      row
        .split("&")
        .map((cell) => mathFallbackText(cell).trim())
        .filter(Boolean)
    )
    .filter((row) => row.length);
}

function tensorMatrixColor(value) {
  const raw = String(value || "").trim();
  if (/^#?[0-9a-f]{6}$/i.test(raw)) return raw.startsWith("#") ? raw : `#${raw}`;
  if (/echodrk/i.test(raw)) return "#0099cc";
  if (/red/i.test(raw)) return "red";
  if (/gray|grey/i.test(raw)) return "gray";
  return "black";
}

function renderTensorMatrixFallback(item, blocks, baseFontSize, unit, color) {
  const cx = item.x * unit;
  const cy = -item.y * unit;
  const fontSize = Math.max(6, Math.min(14, baseFontSize));
  const cell = fontSize * 0.82;
  const labelHeight = fontSize * 1.05;
  const matrixWidth = cell * 3.25;
  const matrixHeight = cell * 3.05;
  const blockWidth = matrixWidth + fontSize * 0.9;
  const blockHeight = matrixHeight + labelHeight + fontSize * 0.35;
  const gapX = fontSize * 1.1;
  const gapY = fontSize * 0.75;
  const prefixWidth = fontSize * 2.1;
  const gridWidth = blockWidth * 2 + gapX;
  const gridHeight = blockHeight * 2 + gapY;
  const totalWidth = prefixWidth + gridWidth + fontSize * 0.8;
  const startX = cx - totalWidth / 2;
  const startY = cy - gridHeight / 2;
  const parts = [
    `<g class="tikz-tensor-matrix" font-family="${escapeAttribute(TIKZ_FONT_FAMILY)}" fill="${color}">`,
    `<text x="${format(startX)}" y="${format(cy)}" text-anchor="start" dominant-baseline="middle" font-size="${format(
      fontSize * 1.2
    )}">M =</text>`,
    `<path d="M ${format(startX + prefixWidth - fontSize * 0.2)} ${format(startY - fontSize * 0.1)} L ${format(
      startX + prefixWidth - fontSize * 0.55
    )} ${format(startY - fontSize * 0.1)} L ${format(startX + prefixWidth - fontSize * 0.55)} ${format(startY + gridHeight + fontSize * 0.1)} L ${format(
      startX + prefixWidth - fontSize * 0.2
    )} ${format(startY + gridHeight + fontSize * 0.1)} M ${format(startX + totalWidth - fontSize * 0.45)} ${format(startY - fontSize * 0.1)} L ${format(
      startX + totalWidth - fontSize * 0.1
    )} ${format(startY - fontSize * 0.1)} L ${format(startX + totalWidth - fontSize * 0.1)} ${format(
      startY + gridHeight + fontSize * 0.1
    )} L ${format(startX + totalWidth - fontSize * 0.45)} ${format(startY + gridHeight + fontSize * 0.1)}" stroke="${color}" fill="none" stroke-width="${format(
      Math.max(0.55, fontSize * 0.08)
    )}" />`
  ];
  blocks.forEach((block, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = startX + prefixWidth + col * (blockWidth + gapX);
    const y = startY + row * (blockHeight + gapY);
    parts.push(renderTensorMatrixBlock(block, x, y, { fontSize, cell, matrixWidth, matrixHeight, blockWidth, labelHeight }));
  });
  parts.push("</g>");
  return parts.join("");
}

function renderTensorMatrixBlock(block, x, y, metrics) {
  const { fontSize, cell, matrixWidth, matrixHeight, blockWidth, labelHeight } = metrics;
  const matrixX = x + (blockWidth - matrixWidth) / 2;
  const matrixY = y + (block.labelPosition === "top" ? labelHeight : 0);
  const labelY = block.labelPosition === "top" ? y + labelHeight * 0.42 : matrixY + matrixHeight + labelHeight * 0.55;
  const stroke = escapeAttribute(block.color || "black");
  const parts = [
    `<text x="${format(x + blockWidth / 2)}" y="${format(labelY)}" fill="${stroke}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
      fontSize * 0.72
    )}">${escapeText(block.label)}</text>`,
    `<rect x="${format(matrixX)}" y="${format(matrixY)}" width="${format(matrixWidth)}" height="${format(matrixHeight)}" fill="none" stroke="${stroke}" stroke-width="${format(
      Math.max(0.45, fontSize * 0.055)
    )}" />`
  ];
  const rows = block.matrix;
  rows.forEach((row, rowIndex) => {
    row.forEach((cellText, colIndex) => {
      parts.push(
        `<text x="${format(matrixX + cell * (0.58 + colIndex))}" y="${format(matrixY + cell * (0.62 + rowIndex))}" fill="black" text-anchor="middle" dominant-baseline="middle" font-size="${format(
          fontSize * 0.78
        )}">${escapeText(cellText)}</text>`
      );
    });
  });
  return `<g class="tikz-tensor-matrix-block">${parts.join("")}</g>`;
}

function renderSimpleSubscriptMathFallback(item, parts, baseFontSize, unit, color, fontStyle, fontWeight) {
  const subFontSize = baseFontSize * 0.7;
  const x = format(item.x * unit);
  const y = format(-item.y * unit);
  return `<text x="${x}" y="${y}" fill="${color}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    baseFontSize
  )}"${fontStyle ? ` font-style="${fontStyle}"` : ""}${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(
    TIKZ_FONT_FAMILY
  )}"><tspan>${escapeText(parts.base)}</tspan><tspan font-size="${format(
    subFontSize
  )}" font-style="normal" baseline-shift="sub">${escapeText(parts.subscript)}</tspan></text>`;
}

function renderFractionMathFallback(item, parts, baseFontSize, unit, color, fontStyle, fontWeight) {
  const fractionFontSize = baseFontSize * 0.78;
  const x = item.x * unit;
  const y = -item.y * unit;
  const numerator = renderFractionPartContent(parts.numerator, fractionFontSize);
  const denominator = renderFractionPartContent(parts.denominator, fractionFontSize);
  const width = Math.max(
    fractionTextWidth(parts.numerator, fractionFontSize),
    fractionTextWidth(parts.denominator, fractionFontSize),
    fractionFontSize * 0.9
  );
  const commonTextAttrs = `fill="${color}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    fractionFontSize
  )}"${fontStyle ? ` font-style="${fontStyle}"` : ""}${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(
    TIKZ_FONT_FAMILY
  )}"`;
  return `<g class="tikz-fraction"><text x="${format(x)}" y="${format(y - fractionFontSize * 0.42)}" ${commonTextAttrs}>${numerator}</text><line x1="${format(
    x - width / 2
  )}" y1="${format(y + fractionFontSize * 0.08)}" x2="${format(x + width / 2)}" y2="${format(
    y + fractionFontSize * 0.08
  )}" stroke="${color}" stroke-width="${format(Math.max(0.45, fractionFontSize * 0.055))}" /><text x="${format(
    x
  )}" y="${format(y + fractionFontSize * 0.58)}" ${commonTextAttrs}>${denominator}</text></g>`;
}

function renderFractionPartContent(tex, fontSize) {
  const mixed = mixedAlphabeticSubscriptFallback(tex);
  if (mixed) {
    const subFontSize = fontSize * 0.7;
    return mixed
      .map((segment) => {
        if (segment.kind === "text") return `<tspan>${escapeText(segment.text)}</tspan>`;
        return `<tspan>${escapeText(segment.base)}</tspan><tspan font-size="${format(
          subFontSize
        )}" font-style="normal" baseline-shift="sub">${escapeText(segment.subscript)}</tspan>`;
      })
      .join("");
  }
  const scripted = scriptedMathFallback(tex);
  if (scripted) {
    const scriptFontSize = fontSize * 0.66;
    return scripted
      .map((segment) => {
        if (segment.kind === "text") return `<tspan>${escapeText(segment.text)}</tspan>`;
        return `<tspan>${escapeText(segment.base)}</tspan>${
          segment.superscript
            ? `<tspan font-size="${format(scriptFontSize)}" font-style="normal" baseline-shift="super">${renderNestedScriptText(
                segment.superscript,
                scriptFontSize
              )}</tspan>`
            : ""
        }${
          segment.subscript
            ? `<tspan font-size="${format(scriptFontSize)}" font-style="normal" baseline-shift="sub">${renderNestedScriptText(
                segment.subscript,
                scriptFontSize
              )}</tspan>`
            : ""
        }`;
      })
      .join("");
  }
  return `<tspan>${escapeText(mathFallbackText(tex))}</tspan>`;
}

function fractionTextWidth(tex, fontSize) {
  return Math.max(1, mathFallbackText(tex).length) * fontSize * 0.56;
}

function renderMixedSubscriptMathFallback(item, segments, baseFontSize, unit, color, fontStyle, fontWeight) {
  const x = format(item.x * unit);
  const y = format(-item.y * unit);
  const content = renderMixedSubscriptContent(segments, baseFontSize);
  return `<text x="${x}" y="${y}" fill="${color}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    baseFontSize
  )}"${fontStyle ? ` font-style="${fontStyle}"` : ""}${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(
    TIKZ_FONT_FAMILY
  )}">${content}</text>`;
}

function renderScriptedMathFallback(item, segments, baseFontSize, unit, color, fontStyle, fontWeight) {
  const x = format(item.x * unit);
  const y = format(-item.y * unit);
  const content = renderScriptedSegmentsContent(segments, baseFontSize);
  return `<text x="${x}" y="${y}" fill="${color}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    baseFontSize
  )}"${fontStyle ? ` font-style="${fontStyle}"` : ""}${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(
    TIKZ_FONT_FAMILY
  )}">${content}</text>`;
}

function renderSimpleSubscriptContent(parts, baseFontSize) {
  const subFontSize = baseFontSize * 0.7;
  return `<tspan>${escapeText(parts.base)}</tspan><tspan font-size="${format(
    subFontSize
  )}" font-style="normal" baseline-shift="sub">${escapeText(parts.subscript)}</tspan>`;
}

function renderMixedSubscriptContent(segments, baseFontSize) {
  const subFontSize = baseFontSize * 0.7;
  return segments
    .map((segment) => {
      if (segment.kind === "text") return escapeText(segment.text);
      return `<tspan>${escapeText(segment.base)}</tspan><tspan font-size="${format(
        subFontSize
      )}" font-style="normal" baseline-shift="sub">${escapeText(segment.subscript)}</tspan>`;
    })
    .join("");
}

function renderScriptedSegmentsContent(segments, baseFontSize) {
  const scriptFontSize = baseFontSize * 0.66;
  return segments
    .map((segment) => {
      if (segment.kind === "text") return escapeText(segment.text);
      if (segment.kind === "bold") return `<tspan font-weight="700" font-style="normal">${escapeText(segment.text)}</tspan>`;
      const base = `<tspan>${escapeText(segment.base)}</tspan>`;
      if (segment.superscript && segment.subscript) {
        const backtrack = Math.max(0, estimateScriptTextWidth(segment.superscript, scriptFontSize));
        return `${base}<tspan font-size="${format(scriptFontSize)}" font-style="normal" baseline-shift="super">${renderNestedScriptText(
          segment.superscript,
          scriptFontSize
        )}</tspan><tspan dx="${format(-backtrack)}" font-size="${format(
          scriptFontSize
        )}" font-style="normal" baseline-shift="sub">${renderNestedScriptText(segment.subscript, scriptFontSize)}</tspan>`;
      }
      if (segment.superscript) {
        return `${base}<tspan font-size="${format(scriptFontSize)}" font-style="normal" baseline-shift="super">${renderNestedScriptText(
          segment.superscript,
          scriptFontSize
        )}</tspan>`;
      }
      return `${base}<tspan font-size="${format(scriptFontSize)}" font-style="normal" baseline-shift="sub">${renderNestedScriptText(
        segment.subscript,
        scriptFontSize
      )}</tspan>`;
    })
    .join("");
}

function estimateScriptTextWidth(text, fontSize) {
  return String(text || "").length * fontSize * 0.52;
}

function simpleFractionFallback(tex) {
  const raw = String(tex || "")
    .trim()
    .replace(/^\\(?:bf|bfseries)\b\s*/, "");
  const command = raw.match(/^\\(?:frac|dfrac|tfrac)\b/);
  if (!command) return null;
  let cursor = skipInlineWhitespace(raw, command[0].length);
  const numerator = readBalancedGroup(raw, cursor);
  if (!numerator) return null;
  cursor = skipInlineWhitespace(raw, numerator.end);
  const denominator = readBalancedGroup(raw, cursor);
  if (!denominator) return null;
  cursor = skipInlineWhitespace(raw, denominator.end);
  if (cursor !== raw.length) return null;
  return { numerator: numerator.content, denominator: denominator.content };
}

function renderNestedScriptText(text, fontSize) {
  const raw = String(text || "");
  const nestedFontSize = fontSize * 0.74;
  let output = "";
  let cursor = 0;
  const pattern = /_([A-Za-z0-9+\-=()]+)/g;
  let match;
  while ((match = pattern.exec(raw))) {
    output += escapeText(raw.slice(cursor, match.index));
    output += `<tspan font-size="${format(nestedFontSize)}" baseline-shift="sub">${escapeText(match[1])}</tspan>`;
    cursor = pattern.lastIndex;
  }
  output += escapeText(raw.slice(cursor));
  return output;
}

function simpleNumericSubscriptFallback(tex) {
  const raw = String(tex || "")
    .trim()
    .replace(/^\\(?:bf|bfseries)\b\s*/, "");
  const match = raw.match(/^((?:\\[A-Za-z]+(?:\s*\{[^{}]*\})?)|[A-Za-z])\s*_\s*(?:\{([A-Za-z0-9]+)\}|([A-Za-z0-9]+))$/);
  if (!match) return null;
  const base = mathFallbackText(match[1]);
  const subscript = match[2] || match[3];
  if (!base || !subscript) return null;
  return { base, subscript };
}

function mixedAlphabeticSubscriptFallback(tex) {
  const raw = String(tex || "")
    .trim()
    .replace(/^\\(?:bf|bfseries)\b\s*/, "");
  const pattern = /((?:\\[A-Za-z]+(?:\s*\{[^{}]*\})?)|[A-Za-z])\s*_\s*(?:\{([A-Za-z])\}|([A-Za-z]))|([A-Za-z])\s*_\s*\{([A-Za-z]{2,})\}/g;
  const segments = [];
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(raw))) {
    const before = raw.slice(lastIndex, match.index);
    const beforeText = mathFallbackText(before);
    if (beforeText) segments.push({ kind: "text", text: beforeText });
    const base = mathFallbackText(match[1] || match[4]);
    const subscript = match[2] || match[3] || match[5];
    if (!base || !subscript) return null;
    segments.push({ kind: "subscript", base, subscript });
    lastIndex = pattern.lastIndex;
  }
  if (!segments.some((segment) => segment.kind === "subscript")) return null;
  const afterText = mathFallbackText(raw.slice(lastIndex));
  if (afterText) segments.push({ kind: "text", text: afterText });
  return segments;
}

function scriptedMathFallback(tex, options = {}) {
  const raw = String(tex || "")
    .trim()
    .replace(/^\\(?:bf|bfseries)\b\s*/, "");
  const segments = [];
  let cursor = 0;
  let lastIndex = 0;
  let hasScript = false;
  let hasSuperscript = false;
  let hasCommandScriptValue = false;
  let hasAccentBaseScript = false;
  while (cursor < raw.length) {
    const atom = readMathScriptAtom(raw, cursor);
    if (!atom) {
      cursor += 1;
      continue;
    }
    let next = atom.end;
    let subscript = null;
    let superscript = null;
    for (let i = 0; i < 2; i += 1) {
      next = skipInlineWhitespace(raw, next);
      const marker = raw[next];
      if (marker !== "_" && marker !== "^") break;
      const script = readMathScriptValue(raw, next + 1);
      if (!script) break;
      if (marker === "_") subscript = script.value;
      else {
        superscript = script.value;
        hasSuperscript = true;
      }
      if (/^\\[A-Za-z]+/.test(script.value)) hasCommandScriptValue = true;
      next = script.end;
    }
    if (!subscript && !superscript) {
      cursor = atom.end;
      continue;
    }
    const before = mathFallbackText(raw.slice(lastIndex, cursor));
    if (before) segments.push({ kind: "text", text: before });
    const base = mathFallbackText(atom.source);
    if (!base) return null;
    if (subscript && isAccentMathAtom(atom.source)) hasAccentBaseScript = true;
    segments.push({
      kind: "script",
      base,
      subscript: subscript ? mathScriptFallbackText(subscript) : null,
      superscript: superscript ? mathScriptFallbackText(superscript) : null
    });
    hasScript = true;
    lastIndex = next;
    cursor = next;
  }
  if (!hasScript || (!options.allowSimpleScripts && !hasSuperscript && !hasCommandScriptValue && !hasAccentBaseScript)) return null;
  const after = mathFallbackText(raw.slice(lastIndex));
  if (after) segments.push({ kind: "text", text: after });
  return segments;
}

function styledScriptedMathFallback(tex) {
  const raw = String(tex || "")
    .trim()
    .replace(/^\\(?:bf|bfseries)\b\s*/, "");
  const segments = [];
  let cursor = 0;
  let lastIndex = 0;
  let matched = false;
  while (cursor < raw.length) {
    const bold = readScopedBoldSegment(raw, cursor);
    if (bold) {
      const before = mathFallbackSegmentText(raw.slice(lastIndex, cursor));
      if (before) segments.push({ kind: "text", text: before });
      if (bold.text) segments.push({ kind: "bold", text: bold.text });
      lastIndex = bold.end;
      cursor = bold.end;
      matched = true;
      continue;
    }
    const atom = readMathScriptAtom(raw, cursor);
    if (!atom) {
      cursor += 1;
      continue;
    }
    let next = atom.end;
    let subscript = null;
    let superscript = null;
    for (let i = 0; i < 2; i += 1) {
      next = skipInlineWhitespace(raw, next);
      const marker = raw[next];
      if (marker !== "_" && marker !== "^") break;
      const script = readMathScriptValue(raw, next + 1);
      if (!script) break;
      if (marker === "_") subscript = script.value;
      else superscript = script.value;
      next = script.end;
    }
    if (!subscript && !superscript) {
      cursor = atom.end;
      continue;
    }
    const before = mathFallbackSegmentText(raw.slice(lastIndex, cursor));
    if (before) segments.push({ kind: "text", text: before });
    const base = mathFallbackText(atom.source);
    if (!base) return null;
    segments.push({
      kind: "script",
      base,
      subscript: subscript ? mathScriptFallbackText(subscript) : null,
      superscript: superscript ? mathScriptFallbackText(superscript) : null
    });
    lastIndex = next;
    cursor = next;
    matched = true;
  }
  if (!matched) return null;
  const after = mathFallbackSegmentText(raw.slice(lastIndex));
  if (after) segments.push({ kind: "text", text: after });
  return segments;
}

function mathFallbackSegmentText(source) {
  const raw = String(source || "");
  const fallback = mathFallbackText(raw);
  if (!fallback) return "";
  const leading = /^\s/.test(raw) ? " " : "";
  const trailing = /\s$/.test(raw) ? " " : "";
  return `${leading}${fallback}${trailing}`;
}

function readScopedBoldSegment(raw, start) {
  if (raw[start] === "{") {
    const group = readBalancedGroup(raw, start);
    const content = group?.content.trim() || "";
    if (!/^\\(?:bf|bfseries)\b/.test(content)) return null;
    const text = mathFallbackText(group.content);
    return text ? { text, end: group.end } : null;
  }
  const command = raw.slice(start).match(/^\\(?:mathbf|boldsymbol|textbf)\b\s*/);
  if (!command) return null;
  const group = readBalancedGroup(raw, start + command[0].length);
  if (!group) return null;
  const text = mathFallbackText(group.content);
  return text ? { text, end: group.end } : null;
}

function readMathScriptAtom(raw, start) {
  const char = raw[start];
  if (!char || /\s/.test(char)) return null;
  if (char === "{") {
    const group = readBalancedGroup(raw, start);
    if (!group || !/^\\(?:bf|bfseries|mathbf|boldsymbol)\b/.test(group.content.trim())) return null;
    return { source: raw.slice(start, group.end), end: group.end };
  }
  const command = raw.slice(start).match(/^\\[A-Za-z]+/);
  if (command) {
    let end = start + command[0].length;
    if (mathAtomCommandTakesGroup(command[0]) && raw[end] === "{") {
      const group = readBalancedGroup(raw, end);
      if (group) end = group.end;
    }
    return { source: raw.slice(start, end), end };
  }
  if (/[A-Za-z]/.test(char)) {
    let end = start + 1;
    if (raw[end] === "'") end += 1;
    return { source: raw.slice(start, end), end };
  }
  return null;
}

function mathAtomCommandTakesGroup(command) {
  return /^\\(?:vec|overrightarrow|mathbf|boldsymbol|mathcal|mathrm|textrm|texttt|textbf|emph)$/.test(command);
}

function isAccentMathAtom(source) {
  return /^\\(?:vec|overrightarrow|widetilde|tilde)\b/.test(String(source || "").trim());
}

function readMathScriptValue(raw, start) {
  let cursor = skipInlineWhitespace(raw, start);
  if (raw[cursor] === "{") {
    const group = readBalancedGroup(raw, cursor);
    if (!group) return null;
    return { value: group.content, end: group.end };
  }
  const command = raw.slice(cursor).match(/^\\[A-Za-z]+/);
  if (command) return { value: command[0], end: cursor + command[0].length };
  if (!raw[cursor]) return null;
  return { value: raw[cursor], end: cursor + 1 };
}

function readBalancedGroup(raw, start) {
  if (raw[start] !== "{") return null;
  let depth = 0;
  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return { content: raw.slice(start + 1, index), end: index + 1 };
    }
  }
  return null;
}

function skipInlineWhitespace(raw, start) {
  let cursor = start;
  while (/\s/.test(raw[cursor] || "")) cursor += 1;
  return cursor;
}

function mathScriptFallbackText(value) {
  return mathFallbackText(value).replace(/^_/, "");
}

function mathFallbackFontStyle(tex) {
  const raw = String(tex || "");
  if (/\\(?:text|mathrm|operatorname|mathsf|mathtt)\b/.test(raw) || hasWholeMathBoldCommand(raw)) return "";
  const fallback = mathFallbackText(raw);
  if (!/[A-Za-z]/.test(fallback)) return "";
  return "italic";
}

function mathFallbackFontWeight(tex) {
  return hasWholeMathBoldCommand(tex) ? "700" : "";
}

function hasWholeMathBoldCommand(tex) {
  const raw = String(tex || "")
    .trim()
    .replace(/^\$\$([\s\S]*)\$\$$/, "$1")
    .replace(/^\$([\s\S]*)\$$/, "$1")
    .trim();
  return /^(?:\\(?:bf|bfseries)\b|\\(?:mathbf|boldsymbol|textbf)\s*\{[\s\S]*\}\s*$)/.test(raw);
}

function normalizeKatexTex(tex) {
  return String(tex || "").replace(/\\mathcal\s*([A-Za-z])/g, String.raw`\mathcal{$1}`);
}

function renderMarker(item, unit) {
  const x = item.x * unit;
  const y = -item.y * unit;
  const angle = -item.angle;
  const fill = escapeAttribute(item.style?.fill || "black");
  return `<path d="${TIKZ_ARROW.standalonePath}" fill="${fill}" transform="translate(${format(x)} ${format(y)}) rotate(${format(angle)})" />`;
}

function pathData(commands, unit) {
  return commands
    .map((command) => {
      if (command.type === "moveTo") return `M ${format(command.x * unit)} ${format(-command.y * unit)}`;
      if (command.type === "lineTo") return `L ${format(command.x * unit)} ${format(-command.y * unit)}`;
      if (command.type === "quadTo") {
        return `Q ${format(command.x1 * unit)} ${format(-command.y1 * unit)} ${format(command.x * unit)} ${format(
          -command.y * unit
        )}`;
      }
      if (command.type === "curveTo") {
        return `C ${format(command.x1 * unit)} ${format(-command.y1 * unit)} ${format(command.x2 * unit)} ${format(
          -command.y2 * unit
        )} ${format(command.x * unit)} ${format(-command.y * unit)}`;
      }
      if (command.type === "closePath") return "Z";
      return "";
    })
    .filter(Boolean)
    .join(" ");
}

function estimateMathBox(tex, displayMode, unit, scale = 1) {
  const fontSize = (displayMode ? TIKZ_DISPLAY_MATH_FONT_SIZE : TIKZ_TEXT_FONT_SIZE) * scale;
  const box = estimateFormulaBox(tex, { displayMode, scale });
  const width = Math.max(displayMode ? 72 : 42, box.width * unit + 12 * scale);
  const height = Math.max((displayMode ? 46 : 30) * scale, formulaTotalHeight(box) * unit + 8 * scale);
  return {
    fontSize,
    width: Math.min(unit * 8, width),
    height
  };
}

function fitFontSizeToBox(baseFontSize, fitBox, unit, lines = [""]) {
  if (!fitBox) return baseFontSize;
  const boxWidth = Number(fitBox.width) * unit;
  const boxHeight = Number(fitBox.height) * unit;
  if (!Number.isFinite(boxWidth) || !Number.isFinite(boxHeight) || boxWidth <= 0 || boxHeight <= 0) return baseFontSize;

  const lineCount = Math.max(1, lines.length);
  const maxLineLength = Math.max(1, ...lines.map((line) => String(line || "").trim().length));
  const heightLimit = (boxHeight * 0.78) / lineCount;
  const widthLimit = boxWidth / (maxLineLength * 0.62);
  return Math.max(6, Math.min(baseFontSize, heightLimit, widthLimit));
}

function fitRichFontSizeToBox(baseFontSize, fitBox, unit, lines = [""], lineStyles = []) {
  if (!fitBox) return baseFontSize;
  const boxWidth = Number(fitBox.width) * unit;
  const boxHeight = Number(fitBox.height) * unit;
  if (!Number.isFinite(boxWidth) || !Number.isFinite(boxHeight) || boxWidth <= 0 || boxHeight <= 0) return baseFontSize;

  const weightedHeight = Math.max(
    1,
    lineStyles.reduce((sum, style) => sum + (Number(style?.scale) || 1), 0) || lines.length
  );
  const widthDemand = Math.max(
    1,
    ...lines.map((line, index) => {
      const scale = Number(lineStyles[index]?.scale) || 1;
      return String(formatTextLine(line) || "").trim().length * scale;
    })
  );
  const heightLimit = (boxHeight * 0.82) / weightedHeight;
  const widthLimit = boxWidth / (widthDemand * 0.58);
  return Math.max(6, Math.min(baseFontSize, heightLimit, widthLimit));
}

function styleAttributes(style = {}, options = {}) {
  const fill = style.pattern
    ? `url(#${patternId(style)})`
    : style.shading === "ball"
      ? `url(#${ballGradientId(style)})`
      : style.shading === "axis"
        ? `url(#${axisGradientId(style)})`
      : svgPaint(style.fill || "none");
  const attrs = [
    ["stroke", svgPaint(style.stroke || "none")],
    ["fill", fill],
    ["stroke-width", style.lineWidth ?? 1]
  ];
  if (style.dashArray) attrs.push(["stroke-dasharray", style.dashArray.join(" ")]);
  if ((style.stroke || "none") !== "none") {
    attrs.push(["stroke-linecap", options.lineCap || style.lineCap || (style.dashArray ? style.dashLineCap || "butt" : "butt")]);
    attrs.push(["stroke-linejoin", options.lineJoin || style.lineJoin || "miter"]);
  }
  if (Number.isFinite(style.opacity)) attrs.push(["opacity", style.opacity]);
  if (Number.isFinite(style.fillOpacity)) attrs.push(["fill-opacity", style.fillOpacity]);
  if (Number.isFinite(style.strokeOpacity)) attrs.push(["stroke-opacity", style.strokeOpacity]);
  if (!options.omitMarkers && style.markerStart) attrs.push(["marker-start", `url(#${arrowMarkerId(style.markerStart, style)})`]);
  if (!options.omitMarkers && style.markerEnd) attrs.push(["marker-end", `url(#${arrowMarkerId(style.markerEnd, style)})`]);
  return attrs.map(([key, value]) => ` ${key}="${escapeAttribute(String(value))}"`).join("");
}

function svgPaint(value) {
  const text = String(value ?? "").trim();
  if (text.toLowerCase() === "green") return "rgb(0 255 0)";
  return text;
}

function collectPatternDefs(items) {
  const defs = new Map();
  for (const item of items || []) {
    if (!item.style?.pattern) continue;
    const id = patternId(item.style);
    defs.set(id, {
      id,
      kind: String(item.style.pattern).trim(),
      color: item.style.patternColor || item.style.stroke || "black"
    });
  }
  return [...defs.values()];
}

function renderPatternDef(def) {
  const color = escapeAttribute(svgPaint(def.color || "black"));
  const path = patternPathData(def.kind);
  return `<pattern id="${escapeAttribute(def.id)}" patternUnits="userSpaceOnUse" width="8" height="8"><path d="${path}" stroke="${color}" stroke-width="0.7" fill="none" /></pattern>`;
}

function collectBallGradientDefs(items) {
  const defs = new Map();
  for (const item of items || []) {
    if (item.style?.shading !== "ball") continue;
    const id = ballGradientId(item.style);
    defs.set(id, {
      id,
      color: item.style.ballColor || item.style.fill || "gray"
    });
  }
  return [...defs.values()];
}

function renderBallGradientDef(def) {
  const base = svgPaint(def.color || "gray");
  const mid = ballMidColor(base);
  const dark = ballDarkColor(base);
  return `<radialGradient id="${escapeAttribute(def.id)}" cx="30%" cy="29%" r="62%" fx="25%" fy="23%"><stop offset="0%" stop-color="white" /><stop offset="14%" stop-color="${escapeAttribute(
    mid
  )}" /><stop offset="58%" stop-color="${escapeAttribute(base)}" /><stop offset="100%" stop-color="${escapeAttribute(dark)}" /></radialGradient>`;
}

function collectAxisGradientDefs(items) {
  const defs = new Map();
  for (const item of items || []) {
    if (item.style?.shading !== "axis") continue;
    const id = axisGradientId(item.style);
    defs.set(id, {
      id,
      topColor: item.style.topColor || "white",
      bottomColor: item.style.bottomColor || item.style.fill || "black"
    });
  }
  return [...defs.values()];
}

function renderAxisGradientDef(def) {
  const top = svgPaint(def.topColor || "white");
  const bottom = svgPaint(def.bottomColor || "black");
  return `<linearGradient id="${escapeAttribute(def.id)}" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="${escapeAttribute(
    top
  )}" /><stop offset="100%" stop-color="${escapeAttribute(bottom)}" /></linearGradient>`;
}

function axisGradientId(style = {}) {
  const top = String(style.topColor || "white").trim();
  const bottom = String(style.bottomColor || style.fill || "black").trim();
  const key = `${top}-${bottom}`
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "axis";
  return `tikz-axis-${key}`;
}

function ballGradientId(style = {}) {
  const color = String(style.ballColor || style.fill || "gray")
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "gray";
  return `tikz-ball-${color}`;
}

function ballMidColor(color) {
  const rgb = paintToRgb(color);
  if (!rgb) return color;
  return rgbToCss(mixRgb(rgb, [255, 255, 255], 0.45));
}

function ballDarkColor(color) {
  const rgb = paintToRgb(color);
  if (!rgb) return color;
  return rgbToCss(mixRgb(rgb, [0, 0, 0], 0.48));
}

function paintToRgb(color) {
  const text = svgPaint(color).trim().toLowerCase();
  const named = {
    black: [0, 0, 0],
    white: [255, 255, 255],
    red: [255, 0, 0],
    green: [0, 255, 0],
    blue: [0, 0, 255],
    yellow: [255, 255, 0],
    orange: [255, 165, 0],
    gray: [128, 128, 128],
    grey: [128, 128, 128]
  };
  if (named[text]) return named[text];
  const rgb = text.match(/^rgb\((\d+)\s+(\d+)\s+(\d+)\)$/);
  if (rgb) return rgb.slice(1).map(Number);
  const hex = text.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    return [hex[1].slice(0, 2), hex[1].slice(2, 4), hex[1].slice(4, 6)].map((part) => Number.parseInt(part, 16));
  }
  return null;
}

function mixRgb(base, target, amount) {
  const clamped = Math.max(0, Math.min(1, amount));
  return base.map((channel, index) => Math.round(channel * clamped + target[index] * (1 - clamped)));
}

function rgbToCss(rgb) {
  return `rgb(${rgb.map((channel) => Math.max(0, Math.min(255, Math.round(channel)))).join(" ")})`;
}

function patternPathData(kind) {
  const normalized = String(kind || "").toLowerCase().replace(/-/g, " ").trim();
  if (normalized === "north west lines") return "M 0 -4 L 12 8 M -4 0 L 8 12";
  return "M -4 8 L 8 -4 M 0 12 L 12 0";
}

function patternId(style = {}) {
  const kind = String(style.pattern || "lines").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "lines";
  const color = String(style.patternColor || style.stroke || "black").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "black";
  return `tikz-pattern-${kind}-${color}`;
}

function collectArrowMarkerDefs(items) {
  const defs = new Map();
  for (const item of items) {
    for (const key of ["markerStart", "markerEnd"]) {
      if (!item.style?.[key]) continue;
      const marker = resolvedArrowMarker(item.style[key], item.style);
      defs.set(marker.id, marker);
    }
  }
  return [...defs.values()];
}

function renderArrowMarkerDef(marker) {
  const halfWidth = marker.width / 2;
  const path =
    marker.kind === "stealth"
      ? `M 0 0 L ${format(marker.length)} ${format(halfWidth)} L 0 ${format(marker.width)} C ${format(
          marker.length * 0.22
        )} ${format(marker.width * 0.62)} ${format(marker.length * 0.22)} ${format(marker.width * 0.38)} 0 0 Z`
      : marker.kind === "two-heads"
        ? `M 0 0 L ${format(marker.length * 0.48)} ${format(halfWidth)} L 0 ${format(marker.width)} M ${format(
            marker.length * 0.44
          )} 0 L ${format(marker.length)} ${format(halfWidth)} L ${format(marker.length * 0.44)} ${format(marker.width)}`
      : marker.kind === "hook"
        ? `M ${format(marker.length)} ${format(halfWidth)} C ${format(marker.length * 0.45)} ${format(
            halfWidth
          )} ${format(marker.length * 0.55)} ${format(marker.width)} ${format(marker.length * 0.12)} ${format(
            marker.width
          )} C ${format(-marker.length * 0.18)} ${format(marker.width)} ${format(-marker.length * 0.18)} 0 ${format(
            marker.length * 0.12
          )} 0`
      : marker.kind === "latex"
        ? `M ${format(marker.length)} ${format(halfWidth)} C ${format(marker.length * 0.62)} ${format(
            marker.width * 0.56
          )} ${format(marker.length * 0.18)} ${format(marker.width * 0.82)} 0 ${format(marker.width)} C ${format(
            marker.length * 0.3
          )} ${format(marker.width * 0.57)} ${format(marker.length * 0.3)} ${format(marker.width * 0.43)} 0 0 C ${format(
            marker.length * 0.18
          )} ${format(marker.width * 0.18)} ${format(marker.length * 0.62)} ${format(
            marker.width * 0.44
          )} ${format(marker.length)} ${format(halfWidth)} Z`
      : `M 0 0 L ${format(marker.length)} ${format(halfWidth)} L 0 ${format(marker.width)}`;
  const openTip = marker.kind === "to" || marker.kind === "hook" || marker.kind === "two-heads";
  const fill = openTip ? "none" : marker.fill;
  const strokeWidth =
    openTip ? Math.max(1, marker.lineWidth * 0.85) : Math.max(0.8, marker.lineWidth * 0.45);
  return `<marker id="${escapeAttribute(marker.id)}" markerWidth="${format(marker.length)}" markerHeight="${format(
    marker.width
  )}" refX="${format(marker.length)}" refY="${format(halfWidth)}" orient="auto-start-reverse" markerUnits="userSpaceOnUse" viewBox="0 0 ${format(
    marker.length
  )} ${format(marker.width)}"><path d="${path}" stroke="${escapeAttribute(marker.stroke)}" fill="${escapeAttribute(
    fill
  )}" stroke-width="${format(strokeWidth)}" stroke-linejoin="round" stroke-linecap="round"/></marker>`;
}

function arrowMarkerId(tip, style = {}) {
  return resolvedArrowMarker(tip, style).id;
}

function resolvedArrowMarker(tip, style = {}) {
  const raw = typeof tip === "string" ? createArrowTip(tip === "arrow" ? "to" : tip) : createArrowTip(tip?.kind, tip || {});
  const stroke = raw.stroke || (style.stroke === "none" ? "black" : style.stroke) || "black";
  const fill = raw.fill && raw.fill !== "context-stroke" ? raw.fill : stroke;
  const marker = {
    kind: raw.kind,
    length: raw.length,
    width: raw.width,
    lineWidth: style.lineWidth ?? 1,
    stroke,
    fill
  };
  marker.id = [
    "arrow",
    marker.kind,
    format(marker.length),
    format(marker.width),
    markerColorId(marker.stroke),
    markerColorId(marker.fill)
  ].join("-");
  return marker;
}

function markerColorId(value) {
  return String(value || "none")
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function computeBounds(items) {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const include = (x, y) => {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
  };

  for (const item of items) {
    if (item.type === "nodeBox") {
      include(item.x - item.width / 2, item.y - item.height / 2);
      include(item.x + item.width / 2, item.y + item.height / 2);
    } else if (item.projected && item.type === "path") {
      includePathBounds(item, include);
    } else if (item.shape === "circle") {
      include(item.cx - item.r, item.cy - item.r);
      include(item.cx + item.r, item.cy + item.r);
    } else if (item.shape === "ellipse") {
      include(item.cx - item.rx, item.cy - item.ry);
      include(item.cx + item.rx, item.cy + item.ry);
    } else if (item.type === "textNode") {
      const normalized = normalizeTikzText(item.text);
      if (normalized.invisible) continue;
      if (normalized.kind === "image") {
        const scale = imagePlaceholderScale(item, normalized);
        include(item.x - (normalized.width * scale) / 2, item.y - (normalized.height * scale) / 2);
        include(item.x + (normalized.width * scale) / 2, item.y + (normalized.height * scale) / 2);
        continue;
      }
      const math = parseMathText(normalized.text);
      if (math) {
        const scale = (normalized.scale || 1) * textFontScale(item, normalized);
        const box = estimateFormulaBox(math.tex, { displayMode: math.displayMode, scale });
        const width = box.width + 0.12 * scale;
        const height = formulaTotalHeight(box) + 0.08 * scale;
        include(item.x - width / 2, item.y - height / 2);
        include(item.x + width / 2, item.y + height / 2);
      } else {
        const lines = (normalized.lines.length ? normalized.lines : [normalized.text]).map(formatTextLine);
        const scale = (normalized.scale || 1) * textFontScale(item, normalized);
        const width = Math.max(...lines.map((line) => line.length), 0) * 0.15 * scale;
        const height = lines.length * 0.35 * scale;
        include(item.x - width / 2, item.y - height / 2);
        include(item.x + width / 2, item.y + height / 2);
      }
    } else if (item.type === "marker") {
      include(item.x, item.y);
    } else if (item.type === "path") {
      includePathBounds(item, include);
    }
  }

  if (!Number.isFinite(bounds.minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  if (bounds.minX === bounds.maxX) bounds.maxX += 1;
  if (bounds.minY === bounds.maxY) bounds.maxY += 1;
  return bounds;
}

function includePathBounds(item, include) {
  let current = null;
  let start = null;
  for (const command of item.commands || []) {
    if (command.type === "moveTo") {
      current = { x: command.x, y: command.y };
      start = current;
      include(command.x, command.y);
      continue;
    }
    if (command.type === "lineTo") {
      current = { x: command.x, y: command.y };
      include(command.x, command.y);
      continue;
    }
    if (command.type === "curveTo") {
      if (current && item.tightBezierBounds) {
        includeCubicBezierBounds(current, command, include);
      } else {
        if ("x1" in command && "y1" in command) include(command.x1, command.y1);
        if ("x2" in command && "y2" in command) include(command.x2, command.y2);
        if ("x" in command && "y" in command) include(command.x, command.y);
      }
      current = { x: command.x, y: command.y };
      continue;
    }
    if (command.type === "quadTo") {
      if ("x1" in command && "y1" in command) include(command.x1, command.y1);
      if ("x" in command && "y" in command) include(command.x, command.y);
      current = { x: command.x, y: command.y };
      continue;
    }
    if (command.type === "closePath" && start) {
      include(start.x, start.y);
      current = start;
      continue;
    }
    if ("x" in command && "y" in command) {
      include(command.x, command.y);
      current = { x: command.x, y: command.y };
    }
  }
}

function includeCubicBezierBounds(from, curve, include) {
  const p0 = from;
  const p1 = { x: curve.x1, y: curve.y1 };
  const p2 = { x: curve.x2, y: curve.y2 };
  const p3 = { x: curve.x, y: curve.y };
  include(p0.x, p0.y);
  include(p3.x, p3.y);
  for (const t of cubicExtremaParameters(p0.x, p1.x, p2.x, p3.x)) {
    const point = cubicBezierPoint(p0, p1, p2, p3, t);
    include(point.x, point.y);
  }
  for (const t of cubicExtremaParameters(p0.y, p1.y, p2.y, p3.y)) {
    const point = cubicBezierPoint(p0, p1, p2, p3, t);
    include(point.x, point.y);
  }
}

function cubicExtremaParameters(p0, p1, p2, p3) {
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  const roots = [];
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) >= 1e-12) roots.push(-c / b);
  } else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= -1e-12) {
      const sqrt = Math.sqrt(Math.max(0, discriminant));
      roots.push((-b - sqrt) / (2 * a), (-b + sqrt) / (2 * a));
    }
  }
  return roots.filter((t) => t > 1e-9 && t < 1 - 1e-9);
}

function cubicBezierPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: p0.x * a + p1.x * b + p2.x * c + p3.x * d,
    y: p0.y * a + p1.y * b + p2.y * c + p3.y * d
  };
}

function format(value) {
  const rounded = Math.round((value + Number.EPSILON) * 1e6) / 1e6;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function escapeAttribute(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeText(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtml(value) {
  return escapeText(value).replace(/"/g, "&quot;");
}
