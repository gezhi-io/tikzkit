export function withQaGrid(svg, options = {}) {
  if (options.enabled === false) return svg;

  const requestedUnit = Number(options.unitPerCm);
  const unit = Number.isFinite(requestedUnit) && requestedUnit > 0 ? requestedUnit : 100;
  const requestedOriginX = Number(options.originX);
  const originX = Number.isFinite(requestedOriginX) ? requestedOriginX : 0;
  const requestedOriginY = Number(options.originY);
  const originY = Number.isFinite(requestedOriginY) ? requestedOriginY : 0;
  const source = String(svg);
  const match = source.match(/viewBox="([^"]+)"/);
  if (!match) return source;

  const [x, y, width, height] = match[1].trim().split(/\s+/).map(Number);
  if (![x, y, width, height].every(Number.isFinite)) return source;

  const grid = `<defs><pattern id="tikzkit-qa-grid" width="${unit}" height="${unit}" patternUnits="userSpaceOnUse" patternTransform="translate(${originX} ${originY})"><path d="M ${unit} 0 L 0 0 0 ${unit}" fill="none" stroke="#64748b" stroke-opacity="0.48" stroke-width="0.45" stroke-dasharray="3.5 3.5" vector-effect="non-scaling-stroke"/></pattern></defs><rect id="tikzkit-qa-grid-layer" x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#tikzkit-qa-grid)" pointer-events="none"/>`;
  const background = source.match(/<rect\b[^>]*\bclass="[^"]*\btikz-background\b[^"]*"[^>]*>/i);
  if (!background) return source.replace(/(<svg\b[^>]*>)/, `$1${grid}`);

  const openingEnd = background.index + background[0].length;
  if (/\/\s*>$/.test(background[0])) {
    return source.slice(0, openingEnd) + grid + source.slice(openingEnd);
  }

  const closingIndex = source.indexOf("</rect>", openingEnd);
  const insertionIndex = closingIndex === -1 ? openingEnd : closingIndex + "</rect>".length;
  return source.slice(0, insertionIndex) + grid + source.slice(insertionIndex);
}
