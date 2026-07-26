import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { styleAttributes } from "./style.js";

// PGF's circle split reuses the ordinary circular border and adds one
// horizontal separator through the center. The interpreter owns the two text
// baselines; this renderer stays limited to the shape geometry.
export function renderCircleSplitNodeBox(item, unit) {
  const cx = item.x * unit;
  const cy = -item.y * unit;
  const radius = Math.min(item.width, item.height) * unit / 2;
  const stroke = escapeAttribute(item.style?.stroke || "black");
  const lineWidth = Math.max(0, Number(item.style?.lineWidth) || 0);
  return `<g class="tikz-node-shape tikz-node-circle-split"><circle cx="${format(cx)}" cy="${format(cy)}" r="${format(
    radius
  )}"${styleAttributes(item.style)} /><path d="M ${format(cx - radius)} ${format(cy)} L ${format(
    cx + radius
  )} ${format(cy)}" fill="none" stroke="${stroke}" stroke-width="${format(lineWidth)}" /></g>`;
}
