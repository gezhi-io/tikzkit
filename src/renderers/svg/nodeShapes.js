import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { svgPathData as pathData } from "./pathData.js";
import { styleAttributes } from "./style.js";

export const LIBRARY_NODE_SHAPES = [
  "regularPolygon",
  "star",
  "trapezium",
  "isoscelesTriangle",
  "cloud",
  "superellipse",
  "singleArrow",
  "doubleArrow"
];

export function renderCircleCrossSplitNodeBox(item, unit) {
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

export function renderDiamondNodeBox(item, unit) {
  const cx = item.x * unit;
  const cy = -item.y * unit;
  const hw = (item.width / 2) * unit;
  const hh = (item.height / 2) * unit;
  const points = diamondNodePolygonPoints(cx, cy, hw, hh)
    .map(([x, y]) => `${format(x)},${format(y)}`)
    .join(" ");
  return `<polygon points="${points}"${styleAttributes(item.style)} />`;
}

export function diamondNodePolygonPoints(cx, cy, halfWidth, halfHeight) {
  return [
    [cx, cy - halfHeight],
    [cx + halfWidth, cy],
    [cx, cy + halfHeight],
    [cx - halfWidth, cy]
  ];
}

export function renderLibraryShapeNodeBox(item, unit) {
  const commands = nodeShapeCommands(item);
  return `<path class="tikz-node-shape tikz-node-${escapeAttribute(item.shape)}" d="${pathData(commands, unit)}"${styleAttributes(
    item.style
  )} />`;
}

export function nodeShapeCommands(item) {
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
  if (item.shape === "isoscelesTriangle") {
    return closedPolygonCommands(isoscelesTriangleNodePoints(center, halfWidth, halfHeight));
  }
  if (item.shape === "cloud") {
    return cloudNodeCommands(center, halfWidth, halfHeight);
  }
  if (item.shape === "superellipse") {
    return superellipseNodeCommands(center, halfWidth, halfHeight);
  }
  if (item.shape === "singleArrow" || item.shape === "doubleArrow") {
    return closedPolygonCommands(arrowNodePoints(center, halfWidth, halfHeight, item.shape, item.shapeData || {}));
  }
  return closedPolygonCommands(rectangleNodePoints(center, halfWidth, halfHeight));
}

export function superellipseNodeCommands(center, halfWidth, halfHeight) {
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

export function closedPolygonCommands(points) {
  if (!points.length) return [];
  return [
    { type: "moveTo", x: points[0].x, y: points[0].y },
    ...points.slice(1).map((point) => ({ type: "lineTo", x: point.x, y: point.y })),
    { type: "closePath" }
  ];
}

export function regularPolygonNodePoints(center, halfWidth, halfHeight, sides, startAngle) {
  const count = Math.max(3, Math.round(sides));
  return Array.from({ length: count }, (_unused, index) => {
    const angle = ((startAngle + (360 * index) / count) * Math.PI) / 180;
    return {
      x: center.x + Math.cos(angle) * halfWidth,
      y: center.y + Math.sin(angle) * halfHeight
    };
  });
}

export function starNodePoints(center, halfWidth, halfHeight, points, ratio) {
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

export function trapeziumNodePoints(center, halfWidth, halfHeight, data = {}) {
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

export function isoscelesTriangleNodePoints(center, halfWidth, halfHeight) {
  return [
    { x: center.x + halfWidth, y: center.y },
    { x: center.x - halfWidth, y: center.y + halfHeight },
    { x: center.x - halfWidth, y: center.y - halfHeight }
  ];
}

export function rectangleNodePoints(center, halfWidth, halfHeight) {
  return [
    { x: center.x - halfWidth, y: center.y + halfHeight },
    { x: center.x + halfWidth, y: center.y + halfHeight },
    { x: center.x + halfWidth, y: center.y - halfHeight },
    { x: center.x - halfWidth, y: center.y - halfHeight }
  ];
}

export function arrowNodePoints(center, halfWidth, halfHeight, shape, data = {}) {
  const headExtend = Math.max(0, Number(data.arrowHeadExtend) || 0.25);
  const headIndent = Math.max(0, Number(data.arrowHeadIndent) || 0);
  const headLength = Math.min(halfWidth * 0.82, Math.max(halfHeight * 0.82, headExtend * 1.15, 0.12));
  const bodyHalf = Math.max(0.02, Math.min(halfHeight * 0.72, halfHeight - Math.min(headExtend, halfHeight * 0.48)));
  const indent = Math.min(headIndent, headLength * 0.7);
  const rightBase = halfWidth - headLength;
  const rightNeck = rightBase + indent;
  const local = shape === "doubleArrow"
    ? (() => {
        const leftBase = -rightBase;
        const leftNeck = -rightNeck;
        return [
          { x: halfWidth, y: 0 },
          { x: rightBase, y: halfHeight },
          { x: rightNeck, y: bodyHalf },
          { x: leftNeck, y: bodyHalf },
          { x: leftBase, y: halfHeight },
          { x: -halfWidth, y: 0 },
          { x: leftBase, y: -halfHeight },
          { x: leftNeck, y: -bodyHalf },
          { x: rightNeck, y: -bodyHalf },
          { x: rightBase, y: -halfHeight }
        ];
      })()
    : [
        { x: halfWidth, y: 0 },
        { x: rightBase, y: halfHeight },
        { x: rightNeck, y: bodyHalf },
        { x: -halfWidth, y: bodyHalf },
        { x: -halfWidth, y: -bodyHalf },
        { x: rightNeck, y: -bodyHalf },
        { x: rightBase, y: -halfHeight }
      ];
  const rotate = Number(data.shapeBorderRotate) || 0;
  return local.map((point) => {
    const rotated = rotate ? rotatePoint(point, rotate) : point;
    return { x: center.x + rotated.x, y: center.y + rotated.y };
  });
}

export function rotatePoint(point, degrees) {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos
  };
}

export function cloudNodeCommands(center, halfWidth, halfHeight) {
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
