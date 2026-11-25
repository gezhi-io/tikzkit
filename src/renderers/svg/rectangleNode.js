import { roundedRectangleOutline } from "../../tikz/pathOperations/roundedCorners.js";
import { formatSvgNumber as format } from "./format.js";
import { svgPathData } from "./pathData.js";
import { paintNodeOutline } from "./nodeOutline.js";

export function renderRectangleNodeBox(item, unit) {
  return paintNodeOutline(rectangleGeometry(item, unit), item.style);
}

function rectangleGeometry(item, unit) {
  const inset = nodeBoxStrokeInset(item);
  const x = (item.x - item.width / 2) * unit + inset;
  const y = -(item.y + item.height / 2) * unit + inset;
  const width = Math.max(0, item.width * unit - inset * 2);
  const height = Math.max(0, item.height * unit - inset * 2);
  const radius = Number(item.rx) || 0;
  if (!radius) {
    return `<rect x="${format(x)}" y="${format(y)}" width="${format(width)}" height="${format(height)}"`;
  }
  const commands = roundedRectangleOutline(x/unit, -(y + height)/unit, (x + width)/unit, -y/unit, radius);
  const d = svgPathData(commands, unit);
  return `<path class="tikz-node-box tikz-rounded-rectangle" d="${d}"`;
}

function nodeBoxStrokeInset(item) {
  const style = item.style || {};
  if (style.stroke === "none" || item.strokeBoundsIncluded === false) return 0;
  const lineWidth = Number(style.lineWidth);
  return Number.isFinite(lineWidth) && lineWidth > 0 ? lineWidth / 2 : 0;
}
