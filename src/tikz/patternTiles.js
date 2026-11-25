// Dimensions are TeX points in PGF's y-up tile coordinates. A form-only tile
// takes its ink from "pattern color"; an inherently colored tile never does.
const lines = (width, height, ...segments) => ({ width, height, segments, pen: .4 });
const dots = (...centers) => ({ width: 3, height: 3, centers, radius: .5 });
const band = (color, bottom, top) => ({ width: 100, height: 4, bands: [color+"!"+bottom, color+"!"+top] });

const tiles = new Map(Object.entries({
  "horizontal lines": lines(100,3,[0,.5,100,.5]),
  "vertical lines": lines(3,100,[.5,0,.5,100]),
  "north east lines": lines(3,3,[0,0,3.1,3.1]),
  "north west lines": lines(3,3,[0,3,3.1,-.1]),
  "grid": lines(3,3,[0,0,0,3.1],[0,0,3.1,0]),
  "crosshatch": lines(3,3,[3.1,0,0,3.1],[0,0,3.1,3.1]),
  "dots": dots([0,0]),
  "crosshatch dots": dots([0,0],[1.5,1.5]),
  "horizontal lines light gray": band("black",10,15),
  "horizontal lines gray": band("black",30,35),
  "horizontal lines dark gray": band("black",90,85),
  "horizontal lines light blue": band("blue",10,15),
  "horizontal lines dark blue": band("blue",90,85)
}));

export function stockPatternTile(name) {
  return tiles.get(name);
}

// PDF tiling cells inherit the graphics state. Stroked hatches see /CA;
// filled dots and bands see /ca, even when the outer path is a fill.
export function stockPatternOpacity(style) {
  const tile = !style.patternDefinition && stockPatternTile(style.pattern);
  if (!tile) return undefined;
  const alpha = (tile.segments ? style.strokeOpacity : style.fillOpacity) ?? style.opacity;
  return Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
}
