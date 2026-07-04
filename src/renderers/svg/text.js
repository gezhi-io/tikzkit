import { escapeAttribute, escapeText } from "./escape.js";

export function renderSvgText({ text, x = 0, y = 0, fill = "black", fontSize = 12 } = {}) {
  return `<text x="${format(x)}" y="${format(y)}" fill="${escapeAttribute(fill)}" font-size="${format(fontSize)}">${escapeText(
    text
  )}</text>`;
}

function format(value) {
  const rounded = Math.round((Number(value) + Number.EPSILON) * 1e6) / 1e6;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}
