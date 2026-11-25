// PGF declares the tile in TeX points, in y-up coordinates. Stencils take
// their ink from the path; a colored layer supplies its own ink instead.
const MM = 72.27 / 25.4;
const lines = (width, height, segments, pen = .4) => ({ width, height, segments, pen });
const filled = (width, height, ...layers) => ({ width, height, layers });
const rects = (boxes, color) => ({ boxes, color });
const circles = (centers, radius, color) => ({ centers, radius, color });
const dots = (...centers) => filled(3, 3, circles(centers, .5));
const bands = (color, bottom, top) => filled(100, 4,
  rects([[0, 0, 100, 2.5]], color + "!" + bottom),
  rects([[0, 2, 100, 2.5]], color + "!" + top));

function star(...contours) {
  // Both stars use a 1mm radius about (1mm,1mm). Keep PGF's winding:
  // one self-crossing pentagram or two CCW triangles in a single fill.
  const points = contours.map(angles => angles.map(angle => {
    const t = angle * Math.PI / 180;
    return [MM * (1 + Math.cos(t)), MM * (1 + Math.sin(t))];
  }));
  return filled(3 * MM, 3 * MM, { contours: points });
}

const checker = [[0, 0, 2 * MM, 2 * MM], [2 * MM, 2 * MM, 2 * MM, 2 * MM]];
const brick = [[0, 1, 4, 1], [0, 3, 4, 3], [1, 0, 1, 1], [3, 1, 3, 3], [1, 3, 1, 4]];
const raisedDots = (ground, light, dark) => filled(8, 8,
  rects([[0, 0, 8, 8]], ground),
  circles([[2, 1.75], [6, 5.75]], 1, light),
  circles([[2, 2.25], [6, 6.25]], 1, dark));
const steel = [.6875, .765625, .8671875];
const rgb = values => `rgb(${values.map(v => Math.round(255 * v)).join(" ")})`;
// The dot ink is black!50!lightsteelblue, mixed with white at 10% and 70%.
const steelInk = fraction => rgb(steel.map(v => 1 - fraction + fraction * .5 * v));

const tiles = new Map(Object.entries({
  "horizontal lines": lines(100, 3, [[0, .5, 100, .5]]),
  "vertical lines": lines(3, 100, [[.5, 0, .5, 100]]),
  "north east lines": lines(3, 3, [[0, 0, 3.1, 3.1]]),
  "north west lines": lines(3, 3, [[0, 3, 3.1, -.1]]),
  "grid": lines(3, 3, [[0, 0, 0, 3.1], [0, 0, 3.1, 0]]),
  "crosshatch": lines(3, 3, [[3.1, 0, 0, 3.1], [0, 0, 3.1, 3.1]]),
  "dots": dots([0, 0]),
  "crosshatch dots": dots([0, 0], [1.5, 1.5]),
  "fivepointed stars": star([18, 162, 306, 90, 234]),
  "sixpointed stars": star([30, 150, 270], [-30, -270, -150]),
  "bricks": lines(4 * MM, 4 * MM, brick.map(s => s.map(v => v * MM)), .8),
  "checkerboard": filled(4 * MM, 4 * MM, rects(checker)),
  // In the installed classic library the ground has no explicit fill color:
  // the PDF tile starts in black. The top checker squares are black!20.
  "checkerboard light gray": filled(4 * MM, 4 * MM,
    rects([[0, 0, 4.1 * MM, 4.1 * MM]], "black"), rects(checker, "black!20")),
  "horizontal lines light gray": bands("black", 10, 15),
  "horizontal lines gray": bands("black", 30, 35),
  "horizontal lines dark gray": bands("black", 90, 85),
  "horizontal lines light blue": bands("blue", 10, 15),
  "horizontal lines dark blue": bands("blue", 90, 85),
  "crosshatch dots gray": raisedDots("black!20", "black!10", "black!70"),
  "crosshatch dots light steel blue": raisedDots(rgb(steel), steelInk(.1), steelInk(.7))
}));

export function stockPatternTile(name) {
  return tiles.get(name);
}

// PDF tiling cells inherit the graphics state. Stroked hatches see /CA;
// filled shapes and backgrounds see /ca, even when the outer path is a fill.
export function stockPatternOpacity(style) {
  const tile = !style.patternDefinition && stockPatternTile(style.pattern);
  if (!tile) return undefined;
  const alpha = (tile.segments ? style.strokeOpacity : style.fillOpacity) ?? style.opacity;
  return Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
}
