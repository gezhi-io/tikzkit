import { cmRoman10GlyphPath } from "../../fonts/cmRoman10Outlines.js";
import { svgDefinitionId } from "./definitionScope.js";
import { escapeAttribute, escapeText } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { renderNativeBoxItems } from "./nativeMath.js";
import { svgPaint } from "./style.js";

// PGF attaches the midpoint of the baseline, not the middle of the ink, to
// the path. A group rotates once; its kerns, scripts and rules do not bend.
export function renderDecorationBox(glyph, x, y, angle, fontSize, color, item, defs) {
  const box = glyph.nativeBox;
  if (!box.items.length) return "";
  const unit = fontSize * glyph.fontScale / glyph.nativeSizePt;
  const cls = glyph.kind === "math-box" ? "tikz-decoration-math-box"
    : glyph.kind === "group" ? "tikz-decoration-group" : "tikz-decoration-glyph";
  const part = box.items[0];
  const fill = glyph.color || color;
  if (box.items.length === 1 && part.type === "glyph") {
    const dx = (part.x - box.width / 2) * unit;
    const dy = part.y * unit, paint = escapeAttribute(svgPaint(part.color || fill));
    const rotate = `rotate(${format(-angle)} ${format(x)} ${format(y)})`;
    const text = (attrs = "") => `<text class="${cls}" x="${format(x)}" y="${format(y)}" dx="${format(dx)}" dy="${format(dy)}"${attrs} fill="${paint}" text-anchor="start" dominant-baseline="alphabetic" text-rendering="geometricPrecision" font-size="${format(part.size * unit)}" font-family="${escapeAttribute(part.family)}" font-style="${part.style}" font-weight="${part.weight || 400}" transform="${rotate}">${escapeText(part.text)}</text>`;
    return paintAtBaseline(part, paint, text, x + dx, y + dy, part.size * unit, rotate, item, defs);
  }
  const transform = `translate(${format(x)} ${format(y)}) rotate(${format(-angle)}) scale(${format(unit)}) translate(${format(-box.width / 2)} 0)`;
  const children = renderNativeBoxItems(box, fill, "", (p, paint, text) =>
    paintAtBaseline(p, paint, text, p.x, p.y, p.size, "", item, defs));
  return `<g class="${cls}" transform="${transform}" text-anchor="start" dominant-baseline="alphabetic" text-rendering="geometricPrecision">${children}</g>`;
}

function paintAtBaseline(part, fill, text, x, y, size, rotation, item, defs) {
  const d = defs && part.family === "TikZKitCMR10" && cmRoman10GlyphPath(part.text);
  if (!d) return text();
  const id = svgDefinitionId(`tikzkit-cmr10-${part.text.codePointAt(0).toString(16)}`, item);
  if (!defs.has(id)) defs.set(id, `<path id="${id}" d="${d}" />`);
  // Paint the original Type 1 contours once per distinct letter, without
  // browser font hinting. Keep a nonpainting text layer for selection and AT.
  const scale = size / 1000;
  const transform = `${rotation ? rotation + " " : ""}translate(${format(x)} ${format(y)}) scale(${format(scale)} ${format(-scale)})`;
  return text(' data-native-outline-text="" fill-opacity="0"') +
    `<use href="#${id}" xlink:href="#${id}" transform="${transform}" fill="${fill}" aria-hidden="true" pointer-events="none" />`;
}
