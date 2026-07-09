export function withQaGrid(svg, options = {}) {
  if (options.enabled === false) return svg;

  const unit = Number(options.unitPerCm) || 100;
  const originX = Number(options.originX) || 0;
  const originY = Number(options.originY) || 0;
  const source = String(svg);
  const match = source.match(/viewBox="([^"]+)"/);
  if (!match) return source;

  const [x, y, width, height] = match[1].trim().split(/\s+/).map(Number);
  if (![x, y, width, height].every(Number.isFinite)) return source;

  const grid = `<rect id="tikzkit-qa-grid-layer" x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#tikzkit-qa-grid)" pointer-events="none"/><defs><pattern id="tikzkit-qa-grid" width="${unit}" height="${unit}" patternUnits="userSpaceOnUse" patternTransform="translate(${originX} ${originY})"><path d="M ${unit} 0 L 0 0 0 ${unit}" fill="none" stroke="#64748b" stroke-opacity="0.48" stroke-width="0.45" stroke-dasharray="3.5 3.5" vector-effect="non-scaling-stroke"/></pattern></defs>`;
  return source.replace(/(<svg\b[^>]*>)/, `$1${grid}`);
}
