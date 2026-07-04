export const CSS_PIXELS_PER_CM = 96 / 2.54;

export function parseViewBoxWidth(viewBox) {
  const parts = String(viewBox || "").trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) return null;
  return parts[2] > 0 ? parts[2] : null;
}

export function svgPhysicalWidthPx(viewBoxWidth, gridStep, pixelsPerCm = CSS_PIXELS_PER_CM) {
  const width = Number(viewBoxWidth);
  const step = Number(gridStep);
  const pxPerCm = Number(pixelsPerCm);
  if (!Number.isFinite(width) || width <= 0) return null;
  if (!Number.isFinite(step) || step <= 0) return null;
  if (!Number.isFinite(pxPerCm) || pxPerCm <= 0) return null;
  return (width / step) * pxPerCm;
}

export function inferSvgGridStep(svgText) {
  const source = String(svgText || "");
  const patternStep = inferPatternGridStep(source);
  if (patternStep) return patternStep;
  return inferDashedSourceGridStep(source);
}

export function inferSvgGridOrigin(svgText) {
  const source = String(svgText || "");
  const patternOrigin = inferPatternGridOrigin(source);
  if (patternOrigin) return patternOrigin;
  const dashedOrigin = inferDashedSourceGridOrigin(source);
  if (dashedOrigin) return dashedOrigin;
  return null;
}

function inferPatternGridStep(source) {
  const patternMatch = source.match(/<pattern\b(?=[^>]*\bid=(["'])[^"']*grid[^"']*\1)[^>]*\bwidth=(["'])([^"']+)\2/i);
  if (!patternMatch) return null;
  const width = Number(patternMatch[3]);
  return Number.isFinite(width) && width > 0 ? width : null;
}

function inferPatternGridOrigin(source) {
  const patternMatch = source.match(/<pattern\b(?=[^>]*\bid=(["'])[^"']*grid[^"']*\1)[^>]*>/i);
  if (!patternMatch) return null;
  return {
    x: numericAttribute(patternMatch[0], "x", 0),
    y: numericAttribute(patternMatch[0], "y", 0)
  };
}

function inferDashedSourceGridStep(source) {
  const values = [];
  const pathPattern = /<path\b(?=[^>]*\bstroke-dasharray=)[^>]*\bd=(["'])([\s\S]*?)\1[^>]*>/gi;
  let pathMatch;
  while ((pathMatch = pathPattern.exec(source))) {
    collectLongAxisLineValues(pathMatch[2], values);
  }
  const deltas = sortedPositiveDeltas(values);
  if (!deltas.length) return null;
  return median(deltas);
}

function inferDashedSourceGridOrigin(source) {
  const pathMatch = source.match(/<path\b(?=[^>]*\bstroke-dasharray=)[^>]*>/i);
  if (!pathMatch) return null;
  const matrix = pathMatch[0].match(/\btransform=(["'])matrix\(([^)]*)\)\1/i);
  if (!matrix) return { x: 0, y: 0 };
  const values = matrix[2].split(/[\s,]+/).map(Number).filter(Number.isFinite);
  if (values.length !== 6) return { x: 0, y: 0 };
  return {
    x: values[4],
    y: values[5]
  };
}

function numericAttribute(tag, name, fallback) {
  const pattern = new RegExp(`\\b${name}=(["'])([^"']+)\\1`, "i");
  const match = String(tag || "").match(pattern);
  if (!match) return fallback;
  const value = Number(match[2]);
  return Number.isFinite(value) ? value : fallback;
}

function collectLongAxisLineValues(pathData, values) {
  const commandPattern =
    /M\s*([+-]?(?:\d+\.?\d*|\.\d+))\s+([+-]?(?:\d+\.?\d*|\.\d+))\s+L\s*([+-]?(?:\d+\.?\d*|\.\d+))\s+([+-]?(?:\d+\.?\d*|\.\d+))/gi;
  let commandMatch;
  while ((commandMatch = commandPattern.exec(String(pathData || "")))) {
    const x1 = Number(commandMatch[1]);
    const y1 = Number(commandMatch[2]);
    const x2 = Number(commandMatch[3]);
    const y2 = Number(commandMatch[4]);
    if (![x1, y1, x2, y2].every(Number.isFinite)) continue;
    if (Math.abs(x1 - x2) < 1e-6 && Math.abs(y1 - y2) > 20) values.push(x1);
    if (Math.abs(y1 - y2) < 1e-6 && Math.abs(x1 - x2) > 20) values.push(y1);
  }
}

function sortedPositiveDeltas(values) {
  const unique = [...new Set(values.map((value) => Number(value.toFixed(3))))].sort((a, b) => a - b);
  const deltas = [];
  for (let index = 1; index < unique.length; index += 1) {
    const delta = unique[index] - unique[index - 1];
    if (delta > 1) deltas.push(delta);
  }
  return deltas.sort((a, b) => a - b);
}

function median(values) {
  const index = Math.floor(values.length / 2);
  return values.length % 2 ? values[index] : (values[index - 1] + values[index]) / 2;
}
