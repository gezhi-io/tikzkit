import { escapeAttribute, escapeText } from "./escape.js";
import { parseDimension } from "../../engine/math.js";
import { replaceTikzHspaceMarkers, tikzHspaceText } from "../../tikz/text.js";
import { TIKZ_UNIT } from "../../tikz/metrics.js";
import { formatSvgNumber as format } from "./format.js";

export function renderSvgText({ text, x = 0, y = 0, fill = "black", fontSize = 12 } = {}) {
  return `<text x="${format(x)}" y="${format(y)}" fill="${escapeAttribute(fill)}" font-size="${format(fontSize)}">${escapeText(
    text
  )}</text>`;
}

export function formatPlainTexText(value) {
  return String(value ?? "")
    .replace(/\\strut(?![A-Za-z])\s*/g, "")
    .replace(/\\\$\s*/g, "$")
    .replace(/\\([%#&_{}])/g, "$1")
    .replace(/\\,(?![A-Za-z])\s*/g, () => tikzHspaceText("0.166667em"))
    .replace(/\\:(?![A-Za-z])\s*/g, () => tikzHspaceText("0.222222em"))
    .replace(/\\;(?![A-Za-z])\s*/g, () => tikzHspaceText("0.277778em"))
    .replace(/\\!(?![A-Za-z])\s*/g, () => tikzHspaceText("-0.166667em"));
}

export function renderPlainSvgTextContent(value, unit = TIKZ_UNIT) {
  const text = String(value ?? "");
  if (!text.includes("\uE100")) return escapeText(text);
  let output = "";
  let cursor = 0;
  let openTspan = false;
  replaceTikzHspaceMarkers(text, (dimension) => {
    const marker = `${"\uE100"}${encodeURIComponent(dimension)}${"\uE101"}`;
    const index = text.indexOf(marker, cursor);
    if (index >= cursor) {
      output += escapeText(text.slice(cursor, index));
      if (openTspan) output += "</tspan>";
      const relative = String(dimension || "").trim().match(/^[-+]?[0-9.]+\s*(?:em|ex)$/);
      const width = relative ? NaN : parseDimension(dimension, {});
      const dx = relative ? relative[0].replace(/\s+/g, "") : format(Number.isFinite(width) ? width * unit : 0);
      output += `<tspan dx="${dx}">`;
      openTspan = true;
      cursor = index + marker.length;
    }
    return "";
  });
  output += escapeText(text.slice(cursor));
  if (openTspan) output += "</tspan>";
  return output;
}
