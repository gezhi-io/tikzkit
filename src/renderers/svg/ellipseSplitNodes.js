import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { styleAttributes } from "./style.js";

export function renderEllipseSplitNodeBox(item, unit) {
  const cx = item.x * unit;
  const cy = -item.y * unit;
  const radiusX = item.width * unit / 2;
  const radiusY = item.height * unit / 2;
  const stroke = escapeAttribute(item.style?.stroke || "black");
  const lineWidth = Math.max(0, Number(item.style?.lineWidth) || 0);
  return `<g class="tikz-node-shape tikz-node-ellipse-split"><ellipse cx="${format(cx)}" cy="${format(cy)}" rx="${format(
    radiusX
  )}" ry="${format(radiusY)}"${styleAttributes(item.style)} /><path d="M ${format(cx - radiusX)} ${format(cy)} L ${format(
    cx + radiusX
  )} ${format(cy)}" fill="none" stroke="${stroke}" stroke-width="${format(lineWidth)}" /></g>`;
}
