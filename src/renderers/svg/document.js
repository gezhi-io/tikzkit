import { createSvgDefs } from "./defs.js";
import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";

export function createSvgView(bounds, unit, margin) {
  return {
    x: bounds.minX * unit - margin,
    y: -bounds.maxY * unit - margin,
    width: (bounds.maxX - bounds.minX) * unit + margin * 2,
    height: (bounds.maxY - bounds.minY) * unit + margin * 2
  };
}

export function svgViewBox(view) {
  return [format(view.x), format(view.y), format(view.width), format(view.height)].join(" ");
}

export function renderSvgBackground(view, background) {
  if (!background || background === "none") return "";
  return `<rect class="tikz-background" x="${format(view.x)}" y="${format(view.y)}" width="${format(view.width)}" height="${format(
    view.height
  )}" fill="${escapeAttribute(String(background))}" />`;
}

export function renderSvgDocument(viewBox, body = [], defs = [], size = null) {
  const content = [];
  if (defs.length) content.push(createSvgDefs(defs));
  content.push(...body);
  const sizeAttributes = size
    ? ` width="${formatSvgPointDimension(size.widthPt)}pt" height="${formatSvgPointDimension(size.heightPt)}pt"`
    : "";
  return `<svg class="tikz-render-svg" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"${sizeAttributes} viewBox="${viewBox}">\n${content
    .filter(Boolean)
    .map((line) => `  ${line}`)
    .join("\n")}\n</svg>\n`;
}

function formatSvgPointDimension(value) {
  const rounded = Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? "0" : rounded.toFixed(2).replace(/\.?0+$/, "");
}
