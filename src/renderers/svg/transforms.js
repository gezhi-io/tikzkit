import { formatSvgNumber as format } from "./format.js";

export function wrapNodeRotation(svg, item, unit) {
  if (!item.rotation) return svg;
  const cx = format(item.x * unit);
  const cy = format(-item.y * unit);
  return `<g transform="rotate(${format(-item.rotation)} ${cx} ${cy})">${svg}</g>`;
}
