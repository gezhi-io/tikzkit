// pgfpathellipse records the supports of four cubics, not a rotated enclosing
// rectangle or the analytic extrema. Its first support's y register is assigned
// immediately before \pgf@protocolsizes (without \relax): if x sets no new
// limit, TeX starts the y comparison with the old register, the center's y.
export function pgfEllipseBounds(rx, ry, rotation = 0) {
  if (!rotation) return { minX: -rx, maxX: rx, minY: -ry, maxY: ry };
  const a = rotation * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  let ux = rx * c, uy = rx * s, vx = -ry * s, vy = ry * c;
  const k = .55228475;
  let minX = ux, maxX = ux, minY = uy, maxY = uy;
  const include = (x, y) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  };
  for (let i = 0; i < 4; i++) {
    const x = ux + k * vx, y = uy + k * vy;
    if (x < minX || x > maxX) include(x, y);
    else if (minY > 0) { minY = y; maxY = Math.max(maxY, y); }
    else if (maxY < 0) maxY = y;
    include(k * ux + vx, k * uy + vy);
    include(vx, vy);
    [ux, uy, vx, vy] = [vx, vy, -ux, -uy];
  }
  include(0, 0);
  return { minX, maxX, minY, maxY };
}
