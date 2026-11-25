import { stockPatternTile } from "../../tikz/patternTiles.js";
import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { svgPaint } from "./style.js";

const CM_PER_TEX_PT = 2.54 / 72.27;
const paint = color => escapeAttribute(svgPaint(color));
const xy = (x, y) => `${format(x)} ${format(y)}`;

// PGF's paint bounds can extend outside one repeat. Only the neighbouring
// strokes or dots entering this SVG tile's clipped viewport need copies.
function* visibleCopies(tile, left, bottom, right, top) {
  for (const dx of [-tile.width, 0, tile.width]) {
    for (const dy of [-tile.height, 0, tile.height]) {
      if (right + dx < 0 || left + dx > tile.width || top + dy < 0 || bottom + dy > tile.height) continue;
      yield [dx, dy];
    }
  }
}

function strokeTile(tile, ink, alpha) {
  const paths = [], r = tile.pen / 2;
  for (const [ax, ay, bx, by] of tile.segments) {
    for (const [dx, dy] of visibleCopies(tile, Math.min(ax, bx) - r, Math.min(ay, by) - r,
      Math.max(ax, bx) + r, Math.max(ay, by) + r)) {
      paths.push(`M ${xy(ax + dx, ay + dy)} L ${xy(bx + dx, by + dy)}`);
    }
  }
  return `<path d="${paths.join(" ")}" fill="none" stroke="${ink}" stroke-width="${tile.pen}"${alpha}/>`;
}

function fillLayer(tile, layer, stencilInk, alpha) {
  const ink = layer.color === undefined ? stencilInk : paint(layer.color);
  if (layer.boxes) {
    return layer.boxes.map(([x, y, w, h]) =>
      `<rect x="${format(x)}" y="${format(y)}" width="${format(w)}" height="${format(h)}" fill="${ink}"${alpha}/>`).join("");
  }
  if (layer.contours) {
    // A single nonzero fill keeps the star's center solid and applies alpha
    // once even where the polygons overlap, independent of the host path.
    const d = layer.contours.map(points => "M " + points.map(([x, y]) => xy(x, y)).join(" L ") + " Z").join(" ");
    return `<path d="${d}" fill="${ink}" fill-rule="nonzero"${alpha}/>`;
  }
  const r = layer.radius, dots = [];
  for (const [cx, cy] of layer.centers) {
    for (const [dx, dy] of visibleCopies(tile, cx - r, cy - r, cx + r, cy + r)) {
      dots.push(`<circle cx="${format(cx + dx)}" cy="${format(cy + dy)}" r="${r}" fill="${ink}"${alpha}/>`);
    }
  }
  return dots.join("");
}

export function renderStockPattern(def, unit, origin = { x: 0, y: 0 }) {
  const tile = stockPatternTile(def.kind);
  if (!tile) return "";
  const width = format(tile.width), height = format(tile.height), ink = paint(def.color);
  const channel = tile.segments ? "stroke" : "fill";
  const alpha = Number.isFinite(def.opacity) && def.opacity !== 1 ? ` ${channel}-opacity="${format(def.opacity)}"` : "";
  const content = tile.segments ? strokeTile(tile, ink, alpha)
    : tile.layers.map(layer => fillLayer(tile, layer, ink, alpha)).join("");
  const s = format(unit * CM_PER_TEX_PT);
  const transform = `matrix(${s} 0 0 -${s} ${format(origin.x)} ${format(origin.y)})`;
  return `<pattern id="${escapeAttribute(def.id)}" patternUnits="userSpaceOnUse" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" patternTransform="${transform}">${content}</pattern>`;
}
