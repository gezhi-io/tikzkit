import { createSvgDefs } from "./defs.js";
import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";

export function createSvgView(bounds, unit, margin) {
  const margins = normalizeSvgMargins(margin);
  return {
    x: bounds.minX * unit - margins.left,
    y: -bounds.maxY * unit - margins.top,
    width: (bounds.maxX - bounds.minX) * unit + margins.left + margins.right,
    height: (bounds.maxY - bounds.minY) * unit + margins.top + margins.bottom
  };
}

function normalizeSvgMargins(value) {
  if (value && typeof value === "object") {
    return {
      left: finiteMargin(value.left),
      bottom: finiteMargin(value.bottom),
      right: finiteMargin(value.right),
      top: finiteMargin(value.top)
    };
  }
  const margin = finiteMargin(value);
  return { left: margin, bottom: margin, right: margin, top: margin };
}

function finiteMargin(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
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
    // Keep physical dimensions as precise as the viewBox: two-decimal pt
    // rounding changes its aspect ratio and rescales text at browser zoom.
    ? ` width="${format(size.widthPt)}pt" height="${format(size.heightPt)}pt"`
    : "";
  return `<svg class="tikz-render-svg" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"${sizeAttributes} viewBox="${viewBox}">\n${content
    .filter(Boolean)
    .map((line) => `  ${line}`)
    .join("\n")}\n</svg>\n`;
}
