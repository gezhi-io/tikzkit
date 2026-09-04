import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { diamondNodePolygonPoints } from "./nodeShapes.js";
import { styleAttributes } from "./style.js";

export function renderDiamondSplitNodeBox(item, unit) {
  const cx = item.x * unit;
  const cy = -item.y * unit;
  const halfWidth = item.width * unit / 2;
  const halfHeight = item.height * unit / 2;
  const points = diamondNodePolygonPoints(cx, cy, halfWidth, halfHeight)
    .map(([x, y]) => `${format(x)},${format(y)}`)
    .join(" ");
  const layout = item.shapeData?.diamondSplit;
  const layoutWidth = Math.max(Number(layout?.size?.width) || 0, 1e-9);
  const separatorRadius = layout
    ? Number(layout.separatorRadiusX) * (item.width / layoutWidth) * unit
    : halfWidth;
  const stroke = escapeAttribute(item.style?.stroke || "black");
  const lineWidth = Math.max(0, Number(item.style?.lineWidth) || 0);
  return `<g class="tikz-node-shape tikz-node-diamond-split"><polygon points="${points}"${styleAttributes(
    item.style
  )} /><path d="M ${format(cx - separatorRadius)} ${format(cy)} L ${format(cx + separatorRadius)} ${format(
    cy
  )}" fill="none" stroke="${stroke}" stroke-width="${format(lineWidth)}" /></g>`;
}
