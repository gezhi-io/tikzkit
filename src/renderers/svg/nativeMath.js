import { escapeAttribute, escapeText } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { svgTextAnchorPoint } from "./textLayout.js";
import { svgPaint } from "./style.js";
import { readContourColor } from "./textContour.js";

const TEX_PT_PER_CM = 28.4527559;

export function renderNativeMath(item, box, unit, color) {
  const anchor = svgTextAnchorPoint(item, unit);
  const factor = unit / TEX_PT_PER_CM;
  const x = anchor.x - (anchor.anchor === "start" ? 0 : anchor.anchor === "end" ? box.width : box.width / 2) * factor;
  const baseline = anchor.y + (box.height - box.depth) * factor / 2;
  const contour = readContourColor(item.text);
  const outline = contour ? ` stroke="${escapeAttribute(svgPaint(contour))}" stroke-width="${format(1.4 / factor)}" paint-order="stroke fill" stroke-linejoin="round"` : "";
  const children = box.items.map(part => {
    const fill = escapeAttribute(svgPaint(part.color || color || "black"));
    const position = `x="${format(part.x)}" y="${format(part.y)}"`;
    if (part.type === "rule") return `<rect ${position} width="${format(part.width)}" height="${format(part.height)}" fill="${fill}" />`;
    return `<text${outline} ${position} fill="${fill}" font-family="${escapeAttribute(part.family)}" font-size="${format(part.size)}" font-style="${part.style}" font-weight="${part.weight || 400}">${escapeText(part.text)}</text>`;
  }).join("");
  // Preserve CM outlines instead of browser small-text stem darkening/hinting.
  return `<g class="tikz-math-native" data-math-layout="cm-tex-box" transform="translate(${format(x)} ${format(baseline)}) scale(${format(factor)})" text-anchor="start" dominant-baseline="alphabetic" text-rendering="geometricPrecision">${children}</g>`;
}
