import { inferSvgGridOrigin, inferSvgGridStep, svgPhysicalWidthPx } from "./svg-display-scale.js";

const DEFAULT_PIXELS_PER_CM = 86;
const DEFAULT_PADDING = 40;
const DEFAULT_TITLE_HEIGHT = 36;
const DEFAULT_PANE_GAP = 28;

export function createPhysicalScaleSheetSvg(entries, options = {}) {
  const pixelsPerCm = positiveNumber(options.pixelsPerCm, DEFAULT_PIXELS_PER_CM);
  const padding = positiveNumber(options.padding, DEFAULT_PADDING);
  const titleHeight = positiveNumber(options.titleHeight, DEFAULT_TITLE_HEIGHT);
  const paneGap = positiveNumber(options.paneGap, DEFAULT_PANE_GAP);
  const panes = alignPaneOrigins(entries.map((entry) => createPane(entry, pixelsPerCm)));
  const maxWidth = Math.max(...panes.map((pane) => pane.alignedWidth), 1);
  const sheetWidth = Math.ceil(maxWidth + padding * 2);

  let y = padding;
  const body = [];
  for (const pane of panes) {
    const contentY = y + titleHeight;
    body.push(`<text x="${round(padding)}" y="${round(y + 23)}" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700" fill="#475569">${escapeXml(pane.title)}</text>`);
    body.push(`<svg x="${round(padding + pane.alignX)}" y="${round(contentY + pane.alignY)}" width="${round(pane.width)}" height="${round(pane.height)}" viewBox="${escapeXml(pane.viewBox)}">${pane.body}</svg>`);
    y = contentY + pane.alignedHeight + paneGap;
  }
  const sheetHeight = Math.ceil(y - paneGap + padding);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${sheetWidth}" height="${sheetHeight}" viewBox="0 0 ${sheetWidth} ${sheetHeight}">`,
    `<rect width="100%" height="100%" fill="white"/>`,
    ...body,
    `</svg>`
  ].join("");
}

export function createPhysicalScaleSvg(entry, options = {}) {
  const pixelsPerCm = positiveNumber(options.pixelsPerCm, DEFAULT_PIXELS_PER_CM);
  const pane = createPane(entry, pixelsPerCm);
  const width = Math.ceil(pane.width);
  const height = Math.ceil(pane.height);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="white"/>`,
    `<svg x="0" y="0" width="${round(pane.width)}" height="${round(pane.height)}" viewBox="${escapeXml(pane.viewBox)}">${pane.body}</svg>`,
    `</svg>`
  ].join("");
}

function createPane(entry, pixelsPerCm) {
  const parsed = parseSvg(entry.svg);
  const gridStep = inferSvgGridStep(entry.svg);
  const origin = inferSvgGridOrigin(entry.svg) || { x: 0, y: 0 };
  if (!gridStep) {
    throw new Error(`Cannot infer physical grid step for ${entry.title || "SVG pane"}`);
  }
  const width = svgPhysicalWidthPx(parsed.width, gridStep, pixelsPerCm);
  const height = svgPhysicalWidthPx(parsed.height, gridStep, pixelsPerCm);
  if (!width || !height) {
    throw new Error(`Cannot compute physical size for ${entry.title || "SVG pane"}`);
  }
  return {
    title: entry.title || "SVG",
    viewBox: parsed.viewBox,
    body: parsed.body,
    width,
    height,
    originOffsetX: physicalOriginOffset(parsed.x, origin.x, gridStep, pixelsPerCm),
    originOffsetY: physicalOriginOffset(parsed.y, origin.y, gridStep, pixelsPerCm),
    alignX: 0,
    alignY: 0,
    alignedWidth: width,
    alignedHeight: height
  };
}

function alignPaneOrigins(panes) {
  const maxOriginX = Math.max(...panes.map((pane) => pane.originOffsetX).filter(Number.isFinite), 0);
  const maxOriginY = Math.max(...panes.map((pane) => pane.originOffsetY).filter(Number.isFinite), 0);
  return panes.map((pane) => {
    const alignX = Math.max(0, maxOriginX - pane.originOffsetX);
    const alignY = Math.max(0, maxOriginY - pane.originOffsetY);
    return {
      ...pane,
      alignX,
      alignY,
      alignedWidth: pane.width + alignX,
      alignedHeight: pane.height + alignY
    };
  });
}

function physicalOriginOffset(viewBoxOrigin, gridOrigin, gridStep, pixelsPerCm) {
  const offset = ((Number(gridOrigin) - Number(viewBoxOrigin)) / Number(gridStep)) * Number(pixelsPerCm);
  return Number.isFinite(offset) ? offset : 0;
}

function parseSvg(svg) {
  const match = String(svg || "").match(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/i);
  if (!match) throw new Error("Expected an SVG root element");
  const viewBoxMatch = match[1].match(/\bviewBox=(["'])([^"']+)\1/i);
  if (!viewBoxMatch) throw new Error("Expected SVG viewBox");
  const parts = viewBoxMatch[2].trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value)) || parts[2] <= 0 || parts[3] <= 0) {
    throw new Error(`Invalid SVG viewBox: ${viewBoxMatch[2]}`);
  }
  return {
    viewBox: viewBoxMatch[2],
    x: parts[0],
    y: parts[1],
    width: parts[2],
    height: parts[3],
    body: match[2]
  };
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function round(value) {
  return String(Number(value).toFixed(3)).replace(/\.?0+$/, "");
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&apos;";
      default:
        return char;
    }
  });
}
