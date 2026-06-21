import katex from "katex";
import { estimateFormulaBox, formulaTotalHeight, parseMathText } from "./math-metrics.js";
import { mathFallbackText, normalizeTikzText } from "./tex-text.js";
import {
  TIKZ_ARROW,
  TIKZ_DISPLAY_MATH_FONT_SIZE,
  TIKZ_FONT_FAMILY,
  TIKZ_MARGIN,
  TIKZ_TEXT_FONT_SIZE,
  TIKZ_UNIT,
  createArrowTip
} from "./tikz-metrics.js";

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

  const arrowMarkerDefs = collectArrowMarkerDefs(ir.items || []);
  const body = [];
  if (arrowMarkerDefs.length) {
    body.push(`<defs>${arrowMarkerDefs.map(renderArrowMarkerDef).join("")}</defs>`);
  }
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
    if (item.shape === "diamond") return renderNodeBoxWithOverlay(item, renderDiamondNodeBox(item, unit), unit);
    if (["regularPolygon", "star", "trapezium", "cloud"].includes(item.shape)) {
      return renderNodeBoxWithOverlay(item, renderLibraryShapeNodeBox(item, unit), unit);
    }
    if (item.shape === "rectangleSplit") return renderRectangleSplit(item, unit);
    return renderNodeBoxWithOverlay(item, `<rect x="${format((item.x - item.width / 2) * unit)}" y="${format(
      -(item.y + item.height / 2) * unit
    )}" width="${format(item.width * unit)}" height="${format(item.height * unit)}" rx="${format(
      (item.rx || 0) * unit
    )}"${styleAttributes(item.style)} />`, unit);
  }
  if (item.type === "textNode") {
    const normalized = normalizeTikzText(item.text);
    if (normalized.kind === "image") return renderImagePlaceholder(item, normalized, unit);
    const math = parseMathText(normalized.text);
    if (math) return renderMathNode(item, { ...math, scale: normalized.scale || 1, color: normalized.color }, unit, options);
    if (options.mathRenderer !== "svg-text" && hasInlineMath(normalized)) return renderRichTextNode(item, normalized, unit);
    return renderPlainTextNode(item, normalized, unit);
  }
  if (item.projected && item.type === "path") {
    return `<path d="${pathData(item.commands, unit)}"${styleAttributes(item.style)} />`;
  }
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
  if (item.type === "path") {
    return `<path d="${pathData(item.commands, unit)}"${styleAttributes(item.style)} />`;
  }
  return "";
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
  return closedPolygonCommands(rectangleNodePoints(center, halfWidth, halfHeight));
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
  const overlay = renderNodeBoxOverlay(item, unit);
  return overlay ? `<g>${baseSvg}${overlay}</g>` : baseSvg;
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
  const text = glyph === "adhoc" ? "~" : glyph === "script" ? "S" : glyph === "service" ? "G" : glyph === "user" ? "U" : glyph === "manual" ? "M" : "|";
  const x = glyph === "pool-label" ? box.x1 + box.width * 0.12 : box.x1 + box.width * 0.18;
  const y = glyph === "pool-label" ? box.cy : box.y1 + box.height * 0.25;
  return `<text class="${className}" x="${format(x)}" y="${format(y)}" fill="${stroke}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    Math.max(8, Math.min(box.width, box.height) * 0.24)
  )}" font-family="${escapeAttribute(TIKZ_FONT_FAMILY)}">${escapeText(text)}</text>`;
}

function renderPlainTextNode(item, normalized, unit) {
  if (!normalized.color && hasTextColorSegments(normalized.raw)) return renderSegmentedTextNode(item, normalized, unit);
  const lines = (normalized.lines.length ? normalized.lines : [normalized.text]).map(formatTextLine);
  const color = escapeAttribute(normalized.color || item.style?.fill || "black");
  const fontFamily = escapeAttribute(item.style?.fontFamily || normalized.fontFamily || TIKZ_FONT_FAMILY);
  const baseFontSize = TIKZ_TEXT_FONT_SIZE * (normalized.scale || 1) * textFontScale(item);
  const fontSize = fitFontSizeToBox(baseFontSize, item.fitBox, unit, lines);
  const lineStyles = textLineStyles(normalized, lines.length);
  const x = format(item.x * unit);
  const y = format(-item.y * unit);
  if (lines.length <= 1) {
    const lineStyle = lineStyles[0] || {};
    return `<text x="${x}" y="${y}" fill="${color}" text-anchor="middle" dominant-baseline="middle" xml:space="preserve" font-size="${format(
      fontSize * (lineStyle.scale || 1)
    )}"${fontWeightAttribute(lineStyle)} font-family="${fontFamily}">${escapeText(lines[0] || "")}</text>`;
  }
  const lineOffsets = baselineOffsets(fontSize, lineStyles);
  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? lineOffsets[0] : lineOffsets[index] - lineOffsets[index - 1];
      const lineStyle = lineStyles[index] || {};
      return `<tspan x="${x}" dy="${format(dy)}"${lineFontAttributes(lineStyle, fontSize)}>${escapeText(line)}</tspan>`;
    })
    .join("");
  return `<text x="${x}" y="${y}" fill="${color}" text-anchor="middle" dominant-baseline="middle" xml:space="preserve" font-size="${format(
    fontSize
  )}" font-family="${fontFamily}">${tspans}</text>`;
}

function textLineStyles(normalized, count) {
  const styles = Array.isArray(normalized.lineStyles) ? normalized.lineStyles : [];
  return Array.from({ length: count }, (_unused, index) => ({
    scale: Number(styles[index]?.scale) || 1,
    fontWeight: styles[index]?.fontWeight || null
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
  return `${lineStyle.scale && lineStyle.scale !== 1 ? ` font-size="${format(baseFontSize * lineStyle.scale)}"` : ""}${fontWeightAttribute(lineStyle)}`;
}

function fontWeightAttribute(lineStyle) {
  return lineStyle.fontWeight ? ` font-weight="${escapeAttribute(String(lineStyle.fontWeight))}"` : "";
}

function textFontScale(item) {
  const scale = Number(item.style?.fontScale);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function renderSegmentedTextNode(item, normalized, unit) {
  const lines = splitTextLines(normalized.raw || normalized.text);
  const fallbackLines = (normalized.lines.length ? normalized.lines : lines).map(formatTextLine);
  const color = escapeAttribute(item.style?.fill || "black");
  const fontFamily = escapeAttribute(item.style?.fontFamily || normalized.fontFamily || TIKZ_FONT_FAMILY);
  const baseFontSize = TIKZ_TEXT_FONT_SIZE * (normalized.scale || 1) * textFontScale(item);
  const fontSize = fitFontSizeToBox(baseFontSize, item.fitBox, unit, fallbackLines);
  const x = format(item.x * unit);
  const y = format(-item.y * unit);
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
  return rects.length ? `<g>${rects.join("")}${text}</g>` : text;
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
  const baseFontSize = TIKZ_TEXT_FONT_SIZE * (normalized.scale || 1) * textFontScale(item);
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
        trust: false
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
  const width = image.width * unit;
  const height = image.height * unit;
  const x = item.x * unit - width / 2;
  const y = -item.y * unit - height / 2;
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
    return `<g class="tikz-axis-placeholder"><rect x="${format(x)}" y="${format(y)}" width="${format(width)}" height="${format(
      height
    )}" rx="${format(Math.min(width, height) * 0.05)}" stroke="#111" fill="white" stroke-width="1.2" /><path d="${data}" stroke="black" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></g>`;
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

function renderMathNode(item, math, unit, options = {}) {
  const tex = normalizeKatexTex(math.tex);
  const box = estimateMathBox(tex, math.displayMode, unit, (math.scale || 1) * textFontScale(item));
  box.fontSize = fitFontSizeToBox(box.fontSize, item.fitBox, unit, [mathFallbackText(tex)]);
  const x = item.x * unit - box.width / 2;
  const y = -item.y * unit - box.height / 2;
  const color = escapeAttribute(math.color || item.style?.fill || "black");
  const fallback = `<text x="${format(item.x * unit)}" y="${format(-item.y * unit)}" fill="${color}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    box.fontSize * 0.9
  )}" font-family="${escapeAttribute(TIKZ_FONT_FAMILY)}">${escapeText(mathFallbackText(tex))}</text>`;
  if (options.mathRenderer === "svg-text") return fallback;

  const html = katex.renderToString(tex, {
    displayMode: math.displayMode,
    output: "html",
    throwOnError: false,
    strict: "ignore",
    trust: false
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

function normalizeKatexTex(tex) {
  return String(tex || "").replace(/\\mathcal\s*([A-Za-z])/g, String.raw`\mathcal{$1}`);
}

function renderMarker(item, unit) {
  const x = item.x * unit;
  const y = -item.y * unit;
  const angle = -item.angle;
  const fill = escapeAttribute(item.style?.fill || "black");
  return `<path d="${TIKZ_ARROW.standalonePath}" fill="${fill}" transform="translate(${format(x)} ${format(
    y
  )}) rotate(${format(angle)} ${format(x)} ${format(y)})" />`;
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

function styleAttributes(style = {}) {
  const attrs = [
    ["stroke", style.stroke || "none"],
    ["fill", style.fill || "none"],
    ["stroke-width", style.lineWidth ?? 1]
  ];
  if (style.dashArray) attrs.push(["stroke-dasharray", style.dashArray.join(" ")]);
  if ((style.stroke || "none") !== "none") {
    attrs.push(["stroke-linecap", "round"]);
    attrs.push(["stroke-linejoin", "round"]);
  }
  if (Number.isFinite(style.opacity)) attrs.push(["opacity", style.opacity]);
  if (Number.isFinite(style.fillOpacity)) attrs.push(["fill-opacity", style.fillOpacity]);
  if (Number.isFinite(style.strokeOpacity)) attrs.push(["stroke-opacity", style.strokeOpacity]);
  if (style.markerStart) attrs.push(["marker-start", `url(#${arrowMarkerId(style.markerStart, style)})`]);
  if (style.markerEnd) attrs.push(["marker-end", `url(#${arrowMarkerId(style.markerEnd, style)})`]);
  return attrs.map(([key, value]) => ` ${key}="${escapeAttribute(String(value))}"`).join("");
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
  const fill = marker.kind === "to" ? "none" : marker.fill;
  const strokeWidth = marker.kind === "to" ? Math.max(1, marker.lineWidth * 0.85) : Math.max(0.8, marker.lineWidth * 0.45);
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
      if (normalized.kind === "image") {
        include(item.x - normalized.width / 2, item.y - normalized.height / 2);
        include(item.x + normalized.width / 2, item.y + normalized.height / 2);
        continue;
      }
      const math = parseMathText(normalized.text);
      if (math) {
        const scale = normalized.scale || 1;
        const box = estimateFormulaBox(math.tex, { displayMode: math.displayMode, scale });
        const width = box.width + 0.12 * scale;
        const height = formulaTotalHeight(box) + 0.08 * scale;
        include(item.x - width / 2, item.y - height / 2);
        include(item.x + width / 2, item.y + height / 2);
      } else {
        const lines = (normalized.lines.length ? normalized.lines : [normalized.text]).map(formatTextLine);
        const width = Math.max(...lines.map((line) => line.length), 0) * 0.15 * (normalized.scale || 1);
        const height = lines.length * 0.35 * (normalized.scale || 1);
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
