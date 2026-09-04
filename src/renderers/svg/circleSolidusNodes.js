import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { styleAttributes } from "./style.js";

export function renderCircleSolidusNodeBox(item, unit) {
  const cx = item.x * unit;
  const cy = -item.y * unit;
  const radius = Math.min(item.width, item.height) * unit / 2;
  const layout = item.shapeData?.circleSolidus;
  const layoutWidth = Math.max(Number(layout?.size?.width) || 0, 1e-9);
  const separatorComponent = layout
    ? Number(layout.separatorComponent) * (item.width / layoutWidth) * unit
    : radius * 0.437;
  const stroke = escapeAttribute(item.style?.stroke || "black");
  const lineWidth = Math.max(0, Number(item.style?.lineWidth) || 0);
  return `<g class="tikz-node-shape tikz-node-circle-solidus"><circle cx="${format(cx)}" cy="${format(cy)}" r="${format(
    radius
  )}"${styleAttributes(item.style)} /><path d="M ${format(cx - separatorComponent)} ${format(
    cy + separatorComponent
  )} L ${format(cx + separatorComponent)} ${format(cy - separatorComponent)}" fill="none" stroke="${stroke}" stroke-width="${format(
    lineWidth
  )}" /></g>`;
}
