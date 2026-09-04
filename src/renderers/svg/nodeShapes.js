import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { svgPathData as pathData } from "./pathData.js";
import { styleAttributes } from "./style.js";
import {
  cylinderGeometry,
  dartGeometry,
  kiteGeometry,
  semicircleGeometry,
  starNodePoints as geometricStarNodePoints,
  trapeziumNodePoints as geometricTrapeziumNodePoints
} from "../../tikz/libraries/shapes.geometric.js";
import { cloudGeometry, magneticTapeGeometry, signalGeometry, starburstGeometry, tapeGeometry } from "../../tikz/libraries/shapes.symbols.js";

export const LIBRARY_NODE_SHAPES = [
  "regularPolygon",
  "star",
  "trapezium",
  "cylinder",
  "dart",
  "kite",
  "semicircle",
  "signal",
  "tape",
  "magneticTape",
  "isoscelesTriangle",
  "cloud",
  "starburst",
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
  if (item.shape === "cylinder") return renderCylinderNodeBox(item, unit);
  const commands = nodeShapeCommands(item);
  return `<path class="tikz-node-shape tikz-node-${escapeAttribute(item.shape)}" d="${pathData(commands, unit)}"${styleAttributes(
    item.style
  )} />`;
}

export function renderCylinderNodeBox(item, unit) {
  const geometry = cylinderGeometry(item, item.shapeData || {});
  const translate = (commands) => translateCommands(commands, item.x, item.y);
  const customFill = item.shapeData?.cylinderUsesCustomFill;
  const layers = [];
  if (customFill) {
    layers.push(`<path class="tikz-node-cylinder-body" d="${pathData(translate(geometry.bodyCommands), unit)}"${styleAttributes({
      ...item.style,
      stroke: "none",
      fill: item.shapeData?.cylinderBodyFill || "white"
    })} />`);
    layers.push(`<path class="tikz-node-cylinder-end" d="${pathData(translate(geometry.endCommands), unit)}"${styleAttributes({
      ...item.style,
      stroke: "none",
      fill: item.shapeData?.cylinderEndFill || "white"
    })} />`);
  }
  layers.push(`<path class="tikz-node-cylinder-outline" d="${pathData(translate(geometry.outlineCommands), unit)}"${styleAttributes({
    ...item.style,
    fill: customFill ? "none" : item.style?.fill
  })} />`);
  return `<g class="tikz-node-shape tikz-node-cylinder">${layers.join("")}</g>`;
}

export function nodeShapeCommands(item) {
  const center = { x: item.x, y: item.y };
  const halfWidth = item.width / 2;
  const halfHeight = item.height / 2;
  if (item.shape === "cylinder") {
    return translateCommands(cylinderGeometry(item, item.shapeData || {}).outlineCommands, item.x, item.y);
  }
  if (item.shape === "semicircle") {
    return translateCommands(semicircleGeometry(item, item.shapeData || {}).outlineCommands, item.x, item.y);
  }
  if (item.shape === "kite") {
    return translateCommands(kiteGeometry(item, item.shapeData || {}).outlineCommands, item.x, item.y);
  }
  if (item.shape === "dart") {
    return translateCommands(dartGeometry(item, item.shapeData || {}).outlineCommands, item.x, item.y);
  }
  if (item.shape === "signal") {
    return translateCommands(signalGeometry(item, item.shapeData || {}).commands, item.x, item.y);
  }
  if (item.shape === "magneticTape") {
    return translateCommands(magneticTapeGeometry(item, item.shapeData || {}).outlineCommands, item.x, item.y);
  }
  if (item.shape === "tape") {
    return translateCommands(tapeGeometry(item, item.shapeData || {}).outlineCommands, item.x, item.y);
  }
  if (item.shape === "cloud") {
    return translateCommands(cloudGeometry(item, item.shapeData || {}).outlineCommands, item.x, item.y);
  }
  if (item.shape === "starburst") {
    return translateCommands(starburstGeometry(item, item.shapeData || {}).outlineCommands, item.x, item.y);
  }
  if (item.shape === "regularPolygon") {
    const sides = item.shapeData?.regularPolygonSides || 5;
    return closedPolygonCommands(
      regularPolygonNodePoints(
        center,
        halfWidth,
        halfHeight,
        sides,
        item.shapeData?.regularPolygonStartAngle ?? regularPolygonStartAngle(sides, item.shapeData?.shapeBorderRotate)
      )
    );
  }
  if (item.shape === "star") {
    return closedPolygonCommands(starNodePoints(center, Math.max(halfWidth, halfHeight), item.shapeData || {}));
  }
  if (item.shape === "trapezium") {
    return closedPolygonCommands(trapeziumNodePoints(center, halfWidth, halfHeight, item.shapeData || {}));
  }
  if (item.shape === "isoscelesTriangle") {
    return closedPolygonCommands(isoscelesTriangleNodePoints(center, halfWidth, halfHeight));
  }
  if (item.shape === "superellipse") {
    return superellipseNodeCommands(center, halfWidth, halfHeight);
  }
  if (item.shape === "singleArrow" || item.shape === "doubleArrow") {
    return closedPolygonCommands(arrowNodePoints(center, halfWidth, halfHeight, item.shape, item.shapeData || {}));
  }
  return closedPolygonCommands(rectangleNodePoints(center, halfWidth, halfHeight));
}

function translateCommands(commands, x, y) {
  return commands.map((command) => {
    if (command.type === "closePath") return command;
    if (command.type === "curveTo") {
      return {
        ...command,
        x: command.x + x,
        y: command.y + y,
        x1: command.x1 + x,
        y1: command.y1 + y,
        x2: command.x2 + x,
        y2: command.y2 + y
      };
    }
    return { ...command, x: command.x + x, y: command.y + y };
  });
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

function regularPolygonStartAngle(sides, rotate = 0) {
  const count = Math.max(3, Math.round(Number(sides) || 5));
  return (count % 2 ? 90 : 90 - 180 / count) + (Number(rotate) || 0);
}

export function starNodePoints(center, outerRadius, data = {}) {
  return geometricStarNodePoints(center, outerRadius, data);
}

export function trapeziumNodePoints(center, halfWidth, halfHeight, data = {}) {
  return geometricTrapeziumNodePoints(center, halfWidth, halfHeight, data);
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
  const sourcePoints = Array.isArray(data.arrowGeometry?.points) && data.arrowGeometry.points.length
    ? data.arrowGeometry.points.map((point) => ({ x: Number(point.x) || 0, y: Number(point.y) || 0 }))
    : null;
  if (sourcePoints) {
    const rotate = Number(data.shapeBorderRotate) || 0;
    return sourcePoints.map((point) => {
      const rotated = rotate ? rotatePoint(point, rotate) : point;
      return { x: center.x + rotated.x, y: center.y + rotated.y };
    });
  }
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
