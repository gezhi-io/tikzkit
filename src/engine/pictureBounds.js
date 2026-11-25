import { pgfEllipseBounds } from "../pgf/ellipseBounds.js";
import { includePathCommandBounds } from "../scene/index.js";
import { strokePadding } from "../tikz/doubleStroke.js";
import { isRoundNode } from "../tikz/roundNodeGeometry.js";

// PGF's picture registers track construction (including invisible paths),
// then the stroke. They are not a raster ink box or a padded SVG viewport.
export function includePictureItemBounds(item, include, includeLayout) {
  if (item.overlay || item.excludeFromBounds) return;
  const path = item.type === "path" || item.type === "bbox";
  const stroked = path ? (item.includeStrokeBounds ?? item.type === "path")
    : item.type === "nodeBox" && !item.strokeBoundsIncluded;
  const pen = stroked ? strokePadding(item.style, undefined, item.boundsLineWidth) : 0;
  const record = pen ? (x, y) => {
    include(x - pen, y - pen);
    include(x + pen, y + pen);
  } : include;
  const commands = item.constructionCommands ?? item.commands;
  if (path && commands?.length) {
    includePathCommandBounds(commands, record, { tightBezierBounds: item.tightBezierBounds });
  } else if (item.type === "rasterImage") {
    record(item.x, item.y);
    record(item.x + item.width, item.y + item.height);
  } else if ((item.type === "nodeBox" && isRoundNode(item.shape)) ||
             (item.type === "textNode" && isRoundNode(item.nodeLayoutShape))) {
    const w = item.type === "nodeBox" ? item.width : item.nodeLayoutWidth;
    const h = item.type === "nodeBox" ? item.height : item.nodeLayoutHeight;
    const b = pgfEllipseBounds(w / 2, h / 2, item.rotation);
    record(item.x + b.minX, item.y + b.minY);
    record(item.x + b.maxX, item.y + b.maxY);
  } else {
    includeLayout(item, record);
  }
}
