import { TIKZ_UNIT } from "../src/tikz-metrics.js";

const PT_PER_CM = 72 / 2.54;

export function addSvgUnitGrid(svg, options = {}) {
  const source = String(svg || "");
  const viewBox = parseViewBox(source);
  if (!viewBox) return source;

  const step = options.unit === "pt" ? PT_PER_CM : TIKZ_UNIT;
  const id = sanitizeId(options.id || "tikzkit-unit-grid");
  const strokeWidth = options.unit === "pt" ? 0.28 : 0.34;
  const dash = options.unit === "pt" ? "1.4 1.2" : "1.8 1.6";
  const pattern = `<pattern id="${id}" x="0" y="0" width="${round(step)}" height="${round(step)}" patternUnits="userSpaceOnUse"><path d="M ${round(step)} 0 H 0 V ${round(step)}" fill="none" stroke="rgba(0,0,0,0.55)" stroke-width="${strokeWidth}" stroke-dasharray="${dash}" vector-effect="non-scaling-stroke"/></pattern>`;
  const gridRect = `<rect class="tikzkit-unit-grid" x="${round(viewBox.x)}" y="${round(viewBox.y)}" width="${round(viewBox.width)}" height="${round(viewBox.height)}" fill="url(#${id})" pointer-events="none"/>`;

  const withPattern = insertPatternDef(source, pattern);
  return insertGridRect(withPattern, gridRect);
}

function insertPatternDef(source, pattern) {
  const defsEnd = source.indexOf("</defs>");
  if (defsEnd !== -1) return `${source.slice(0, defsEnd)}${pattern}${source.slice(defsEnd)}`;

  const openEnd = source.indexOf(">");
  if (openEnd === -1) return source;
  return `${source.slice(0, openEnd + 1)}<defs>${pattern}</defs>${source.slice(openEnd + 1)}`;
}

function insertGridRect(source, gridRect) {
  const backgroundEnd = findBackgroundEnd(source);
  if (backgroundEnd !== -1) return `${source.slice(0, backgroundEnd)}${gridRect}${source.slice(backgroundEnd)}`;

  const defsEnd = source.indexOf("</defs>");
  if (defsEnd !== -1) {
    const insertAt = defsEnd + "</defs>".length;
    return `${source.slice(0, insertAt)}${gridRect}${source.slice(insertAt)}`;
  }

  const openEnd = source.indexOf(">");
  if (openEnd === -1) return source;
  return `${source.slice(0, openEnd + 1)}${gridRect}${source.slice(openEnd + 1)}`;
}

function findBackgroundEnd(source) {
  const match = String(source || "").match(/<rect\b(?=[^>]*\bclass=(["'])tikz-background\1)[^>]*\/?>/i);
  return match ? match.index + match[0].length : -1;
}

function parseViewBox(svg) {
  const match = String(svg || "").match(/\sviewBox=(["'])([^"']+)\1/i);
  if (!match) return null;
  const parts = match[2].trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) return null;
  return {
    x: parts[0],
    y: parts[1],
    width: parts[2],
    height: parts[3]
  };
}

function round(value) {
  return String(Number(value).toFixed(6)).replace(/\.?0+$/, "");
}

function sanitizeId(value) {
  return String(value || "tikzkit-unit-grid").replace(/[^A-Za-z0-9_-]/g, "-");
}
