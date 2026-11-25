import { normalizeColor } from "../../engine/colors.js";
import { stockPatternTile } from "../../tikz/patternTiles.js";
import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { svgPaint } from "./style.js";

const CM_PER_TEX_PT = 2.54 / 72.27;

export function renderStockPattern(def, unit, origin = { x: 0, y: 0 }) {
  const tile = stockPatternTile(def.kind);
  if (!tile) return "";
  const {width, height} = tile;
  const ink = escapeAttribute(svgPaint(def.color));
  const channel = tile.segments ? "stroke" : "fill";
  const alpha = Number.isFinite(def.opacity) && def.opacity !== 1 ? ` ${channel}-opacity="${format(def.opacity)}"` : "";
  let content;
  if (tile.bands) {
    const [base, top] = tile.bands.map(color => escapeAttribute(svgPaint(normalizeColor(color))));
    // Keep the half-point overlap: with translucent ink it paints twice.
    content = `<rect width="${width}" height="2.5" fill="${base}"${alpha}/><rect y="2" width="${width}" height="2.5" fill="${top}"${alpha}/>`;
  } else {
    // PGF's paint box can extend beyond its repeat step. Include the parts
    // of neighbouring tiles which enter this SVG pattern's clipped viewport.
    const paths = [], circles = [];
    for (const dx of [-width,0,width]) for (const dy of [-height,0,height]) {
      for (const [ax,ay,bx,by] of tile.segments || []) {
        const r = tile.pen/2;
        if (Math.max(ax,bx)+dx+r < 0 || Math.min(ax,bx)+dx-r > width ||
            Math.max(ay,by)+dy+r < 0 || Math.min(ay,by)+dy-r > height) continue;
        paths.push(`M ${format(ax+dx)} ${format(ay+dy)} L ${format(bx+dx)} ${format(by+dy)}`);
      }
      for (const [cx,cy] of tile.centers || []) {
        const x = cx+dx, y = cy+dy, r = tile.radius;
        if (x+r < 0 || x-r > width || y+r < 0 || y-r > height) continue;
        circles.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${ink}"${alpha}/>`);
      }
    }
    content = paths.length ? `<path d="${paths.join(" ")}" fill="none" stroke="${ink}" stroke-width="${tile.pen}"${alpha}/>` : circles.join("");
  }
  const s = format(unit * CM_PER_TEX_PT);
  const transform = `matrix(${s} 0 0 -${s} ${format(origin.x)} ${format(origin.y)})`;
  return `<pattern id="${escapeAttribute(def.id)}" patternUnits="userSpaceOnUse" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" patternTransform="${transform}">${content}</pattern>`;
}
