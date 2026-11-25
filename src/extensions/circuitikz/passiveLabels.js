/**
 * Default straight label on an untransformed, cardinal passive bipole. All
 * lengths are cm. halfNormal is the body half-size before the border margin;
 * u is the directed unit tangent and +1 selects its left normal (TikZ y up).
 * textBox is the native single-line box, measured WITHOUT CircuitikZ's strut.
 * ex is the surrounding dimension font's x-height; baselineSkip is the
 * label font's baseline skip at the strut. labelDistance adds to .75ex;
 * negative effective padding is out of scope.
 * The returned point is the center of the text baseline, not the paint center.
 */
export function passiveLabelLayout({
  mid, u, halfNormal, side, ex, baselineSkip, textBox, borderMargin = 1.1, labelDistance = 0
} = {}) {
  if (![mid?.x, mid?.y, u?.x, u?.y].every(Number.isFinite) || (side !== 1 && side !== -1)) return null;
  if (!(u.x === 0 && Math.abs(u.y) === 1) && !(u.y === 0 && Math.abs(u.x) === 1)) return null;
  const { width, height, depth } = textBox ?? {};
  if (![halfNormal, borderMargin, width, height, depth, ex, baselineSkip].every(n => Number.isFinite(n) && n >= 0) ||
      ex === 0 || baselineSkip === 0 || !Number.isFinite(labelDistance)) return null;

  const border = halfNormal * borderMargin; // pgfcirc.defines: saved numeric border anchor
  const space = 0.75 * ex + labelDistance;
  if (!Number.isFinite(space) || space < 0) return null;
  const innerSep = space / 2;
  const boxHeight = Math.max(height, 0.7 * baselineSkip);
  const boxDepth = Math.max(depth, 0.3 * baselineSkip);
  const nx = -side * u.y;
  const ny = side * u.x;

  // pgfcirclabel: base above gets the full space; north below attaches the
  // padded, strutted box to the border. Mid east/west is half an ex above base.
  const baseline = ny > 0 ? border + space : ny < 0 ? -border - innerSep - boxHeight : -ex / 2;
  return {
    point: { x: mid.x + nx * (border + innerSep + width / 2), y: mid.y + baseline },
    options: {
      anchor: "base",
      "inner sep": `${innerSep}cm`,
      "outer sep": "0pt",
      "tikzkit native math": true,
      "tikzkit tex node anchors": true,
      // The engine paints the natural box about its center. The zero-width
      // strut enlarges the layout bounds without moving that box's baseline.
      "tikzkit layout bbox": true,
      "tikzkit layout bbox top padding": `${boxHeight - height}cm`,
      "tikzkit layout bbox bottom padding": `${boxDepth - depth}cm`
    }
  };
}
