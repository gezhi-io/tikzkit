import { blurShadowFilterId } from "./defs.js";
import { renderBpmnIcon, renderBpmnMarker } from "./bpmnNodes.js";
import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { LIBRARY_NODE_SHAPES, diamondNodePolygonPoints, nodeShapeCommands } from "./nodeShapes.js";
import { svgPathData as pathData } from "./pathData.js";
import { styleAttributes } from "./style.js";
import { wrapNodeRotation } from "./transforms.js";

export function renderNodeBoxWithOverlay(item, baseSvg, unit) {
  const shadows = renderNodeBoxShadows(item, unit);
  const overlay = renderNodeBoxOverlay(item, unit);
  const grouped = shadows || overlay ? `<g>${shadows}${baseSvg}${overlay}</g>` : baseSvg;
  return wrapNodeRotation(grouped, item, unit);
}

export function renderNodeBoxShadows(item, unit) {
  if (!Array.isArray(item.shadows) || !item.shadows.length) return "";
  return item.shadows.map((shadow) => renderNodeBoxShadow(item, shadow, unit)).join("");
}

export function renderNodeBoxShadow(item, shadow, unit) {
  const scale = Number(shadow.scale) > 0 ? Number(shadow.scale) : 1;
  const shadowStyle = {
    ...(shadow.style || item.style || {}),
    filter: shadow.blur ? `url(#${blurShadowFilterId(shadow)})` : shadow.style?.filter
  };
  const shadowItem = {
    ...item,
    x: item.x + (Number(shadow.xshift) || 0),
    y: item.y + (Number(shadow.yshift) || 0),
    width: item.width * scale,
    height: item.height * scale,
    rx: (item.rx || 0) * scale,
    style: shadowStyle
  };
  if (shadowItem.shape === "circle" || shadowItem.shape === "circleSplit" || shadowItem.shape === "circleSolidus" || shadowItem.shape === "ellipse" || shadowItem.shape === "ellipseSplit") {
    return `<ellipse class="tikz-node-shadow" cx="${format(shadowItem.x * unit)}" cy="${format(-shadowItem.y * unit)}" rx="${format(
      (shadowItem.width / 2) * unit
    )}" ry="${format((shadowItem.height / 2) * unit)}"${styleAttributes(shadowItem.style)} />`;
  }
  if (shadowItem.shape === "diamond" || shadowItem.shape === "diamondSplit") {
    const cx = shadowItem.x * unit;
    const cy = -shadowItem.y * unit;
    const hw = (shadowItem.width / 2) * unit;
    const hh = (shadowItem.height / 2) * unit;
    const points = diamondNodePolygonPoints(cx, cy, hw, hh)
      .map(([x, y]) => `${format(x)},${format(y)}`)
      .join(" ");
    return `<polygon class="tikz-node-shadow" points="${points}"${styleAttributes(shadowItem.style)} />`;
  }
  if (LIBRARY_NODE_SHAPES.includes(shadowItem.shape)) {
    return `<path class="tikz-node-shadow" d="${pathData(nodeShapeCommands(shadowItem), unit)}"${styleAttributes(shadowItem.style)} />`;
  }
  return `<rect class="tikz-node-shadow" x="${format((shadowItem.x - shadowItem.width / 2) * unit)}" y="${format(
    -(shadowItem.y + shadowItem.height / 2) * unit
  )}" width="${format(shadowItem.width * unit)}" height="${format(shadowItem.height * unit)}" rx="${format(
    (shadowItem.rx || 0) * unit
  )}"${styleAttributes(shadowItem.style)} />`;
}

export function renderNodeBoxOverlay(item, unit) {
  const overlays = [];
  if (item.doubleColor !== undefined) overlays.push(renderDoubleNodeOutline(item, unit));
  if (String(item.pathPicture || "").includes("path picture bounding box")) overlays.push(renderPathPictureOverlay(item, unit));
  if (item.appendAfterCommand) overlays.push(renderAppendAfterCommandOverlay(item, unit));
  if (item.bpmnIcon) overlays.push(renderBpmnIcon(item, unit));
  if (item.bpmnMarker) overlays.push(renderBpmnMarker(item, unit));
  return overlays.filter(Boolean).join("");
}

export function renderAppendAfterCommandOverlay(item, unit) {
  const raw = String(item.appendAfterCommand || "");
  const edgePattern = /\(\\tikzlastnode\.([^)]+)\)\s+edge(?:\s*\[[^\]]*\])?\s*\(\\tikzlastnode\.([^)]+)\)/g;
  const segments = [];
  let match;
  while ((match = edgePattern.exec(raw))) {
    let from = nodeOverlayAnchorPoint(item, match[1], unit);
    let to = nodeOverlayAnchorPoint(item, match[2], unit);
    if (!from || !to) continue;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length > 1e-9) {
      const ux = dx / length;
      const uy = dy / length;
      if (/shorten\s*>=\s*\\pgflinewidth/.test(raw)) from = { x: from.x + ux * (Number(item.style?.lineWidth) || 0), y: from.y + uy * (Number(item.style?.lineWidth) || 0) };
      if (/shorten\s*<=\s*\\pgflinewidth/.test(raw)) to = { x: to.x - ux * (Number(item.style?.lineWidth) || 0), y: to.y - uy * (Number(item.style?.lineWidth) || 0) };
    }
    segments.push(`M ${format(from.x)} ${format(from.y)} L ${format(to.x)} ${format(to.y)}`);
  }
  if (!segments.length) return "";
  return `<path class="tikz-append-after-command" d="${segments.join(" ")}"${styleAttributes({
    ...item.style,
    fill: "none",
    markerStart: undefined,
    markerEnd: undefined
  })} />`;
}

function nodeOverlayAnchorPoint(item, rawAnchor, unit) {
  const anchor = String(rawAnchor || "").trim().toLowerCase().replace(/\s+/g, " ");
  const cx = item.x * unit;
  const cy = -item.y * unit;
  const halfWidth = (item.width * unit) / 2;
  const halfHeight = (item.height * unit) / 2;
  const points = {
    center: { x: cx, y: cy },
    north: { x: cx, y: cy - halfHeight },
    south: { x: cx, y: cy + halfHeight },
    east: { x: cx + halfWidth, y: cy },
    west: { x: cx - halfWidth, y: cy },
    "north east": { x: cx + halfWidth, y: cy - halfHeight },
    "north west": { x: cx - halfWidth, y: cy - halfHeight },
    "south east": { x: cx + halfWidth, y: cy + halfHeight },
    "south west": { x: cx - halfWidth, y: cy + halfHeight }
  };
  return points[anchor] || null;
}

export function renderPathPictureOverlay(item, unit) {
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

export function renderMiscOutNodeBox(item, unit) {
  const outerX = Math.max(0, Number(item.foregroundOuterSep?.x) || 0);
  const outerY = Math.max(0, Number(item.foregroundOuterSep?.y) || 0);
  const x1 = (item.x - item.width / 2 - outerX) * unit;
  const x2 = (item.x + item.width / 2 + outerX) * unit;
  const y1 = -(item.y + item.height / 2 + outerY) * unit;
  const y2 = -(item.y - item.height / 2 - outerY) * unit;
  const secondDiagonal = item.shape === "crossOut" ? ` M ${format(x1)} ${format(y1)} L ${format(x2)} ${format(y2)}` : "";
  return `<path class="tikz-shape-${item.shape === "crossOut" ? "cross-out" : "strike-out"}" d="M ${format(x1)} ${format(
    y2
  )} L ${format(x2)} ${format(y1)}${secondDiagonal}"${styleAttributes({ ...item.style, fill: "none", markerStart: undefined, markerEnd: undefined })} />`;
}

export function renderDoubleNodeOutline(item, unit) {
  const stroke = escapeAttribute(item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black");
  const width = Math.max(1, item.style?.lineWidth ?? 1);
  const inset = Math.max(width * 1.8, 2.2);
  const cx = item.x * unit;
  const cy = -item.y * unit;
  const halfWidth = (item.width * unit) / 2;
  const halfHeight = (item.height * unit) / 2;
  if (item.shape === "circle" || item.shape === "circleSplit" || item.shape === "circleSolidus" || item.shape === "ellipse" || item.shape === "ellipseSplit") {
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
