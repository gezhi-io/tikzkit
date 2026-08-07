import { includePathCommandBounds } from "../../scene/index.js";
import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { svgPaint } from "./style.js";

const MAX_PATTERN_TILES = 4096;

export function hasRenderableFormOnlyPattern(item) {
  const definition = item?.style?.patternDefinition;
  if (!item?.style?.pattern || !definition) return false;
  const operations = Array.isArray(definition.operations) && definition.operations.length
    ? definition.operations
    : Array.isArray(definition.commands) && definition.commands.length
      ? [{ kind: "path", commands: definition.commands, stroke: true, fill: false }]
      : [];
  return operations.some((operation) => Array.isArray(operation.commands) && operation.commands.length);
}

export function renderFormOnlyPatternFill(item, unit, clipId, pageOrigin = { x: 0, y: 0 }) {
  if (!hasRenderableFormOnlyPattern(item)) return "";
  const definition = item.style.patternDefinition;
  const tileWidth = Number(definition.tileSize?.x);
  const tileHeight = Number(definition.tileSize?.y);
  if (!(tileWidth > 0) || !(tileHeight > 0)) return "";

  const pathBounds = boundsForCommands(item.commands || []);
  if (!pathBounds) return "";
  const lowerLeft = definition.lowerLeft || { x: 0, y: 0 };
  const upperRight = definition.upperRight || lowerLeft;
  const lowerX = Number(lowerLeft.x) || 0;
  const lowerY = Number(lowerLeft.y) || 0;
  const upperX = Number(upperRight.x) || lowerX;
  const upperY = Number(upperRight.y) || lowerY;
  const startX = Math.floor((pathBounds.minX - upperX) / tileWidth) - 1;
  const endX = Math.ceil((pathBounds.maxX - lowerX) / tileWidth) + 1;
  const startY = Math.floor((pathBounds.minY - upperY) / tileHeight) - 1;
  const endY = Math.ceil((pathBounds.maxY - lowerY) / tileHeight) + 1;
  const tileCount = Math.max(0, endX - startX + 1) * Math.max(0, endY - startY + 1);
  if (!tileCount || tileCount > MAX_PATTERN_TILES) return "";

  const operations = declaredOperations(definition);
  const color = svgPaint(item.style.patternColor || item.style.stroke || "black");
  const lineWidth = Math.max(0, Number(definition.lineWidth) || 0.7) * unit;
  const pageX = Number(pageOrigin.x) || 0;
  const pageY = Number(pageOrigin.y) || 0;
  const body = [];
  for (let tileY = startY; tileY <= endY; tileY += 1) {
    for (let tileX = startX; tileX <= endX; tileX += 1) {
      const offsetX = tileX * tileWidth;
      const offsetY = tileY * tileHeight;
      for (const operation of operations) {
        body.push(renderPatternOperation(operation, offsetX, offsetY, color, lineWidth, unit, pageX, pageY));
      }
    }
  }
  if (!body.length) return "";
  const opacity = Number.isFinite(Number(item.style.opacity)) ? ` opacity="${format(Number(item.style.opacity))}"` : "";
  const fillOpacity = Number.isFinite(Number(item.style.fillOpacity)) ? ` fill-opacity="${format(Number(item.style.fillOpacity))}"` : "";
  return `<g class="tikz-form-only-pattern" clip-path="url(#${escapeAttribute(clipId)})"${opacity}${fillOpacity}>${body.join("")}</g>`;
}

function declaredOperations(definition) {
  if (Array.isArray(definition.operations) && definition.operations.length) return definition.operations;
  if (Array.isArray(definition.commands) && definition.commands.length) {
    return [{ kind: "path", commands: definition.commands, stroke: true, fill: false }];
  }
  return [];
}

function boundsForCommands(commands) {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  includePathCommandBounds(commands, (x, y) => {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
  });
  return Number.isFinite(bounds.minX) ? bounds : null;
}

function renderPatternOperation(operation, offsetX, offsetY, color, lineWidth, unit, pageX, pageY) {
  const commands = Array.isArray(operation.commands) ? operation.commands : [];
  const paths = commands.filter((command) => ["move", "line", "close"].includes(command.kind));
  const circles = commands.filter((command) => command.kind === "circle");
  const rectangles = commands.filter((command) => command.kind === "rectangle");
  const paint = paintAttributes(operation, color, lineWidth);
  const output = [];
  if (paths.length) {
    const d = paths.map((command) => {
      if (command.kind === "close") return "Z";
      const x = pageX + ((Number(command.x) || 0) + offsetX) * unit;
      const y = pageY - ((Number(command.y) || 0) + offsetY) * unit;
      return `${command.kind === "move" ? "M" : "L"} ${format(x)} ${format(y)}`;
    }).join(" ");
    output.push(`<path d="${d}"${paint} />`);
  }
  for (const circle of circles) {
    const x = pageX + ((Number(circle.x) || 0) + offsetX) * unit;
    const y = pageY - ((Number(circle.y) || 0) + offsetY) * unit;
    const radius = Math.max(0, Number(circle.radius) || 0) * unit;
    output.push(`<circle cx="${format(x)}" cy="${format(y)}" r="${format(radius)}"${paint} />`);
  }
  for (const rectangle of rectangles) {
    const width = Math.max(0, Number(rectangle.width) || 0) * unit;
    const height = Math.max(0, Number(rectangle.height) || 0) * unit;
    const x = pageX + ((Number(rectangle.x) || 0) + offsetX) * unit;
    const y = pageY - ((Number(rectangle.y) || 0) + (Number(rectangle.height) || 0) + offsetY) * unit;
    output.push(`<rect x="${format(x)}" y="${format(y)}" width="${format(width)}" height="${format(height)}"${paint} />`);
  }
  return output.join("");
}

function paintAttributes(operation, color, lineWidth) {
  const fill = operation.fill ? color : "none";
  const stroke = operation.stroke ? color : "none";
  const strokeWidth = operation.stroke ? ` stroke-width="${format(lineWidth)}"` : "";
  return ` fill="${escapeAttribute(fill)}" stroke="${escapeAttribute(stroke)}"${strokeWidth}`;
}
