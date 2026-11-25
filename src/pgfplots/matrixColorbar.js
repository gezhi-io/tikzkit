import { parseDimension } from "../engine/math.js";
import { parseOptions } from "../engine/options.js";
import { renderColorbarInBounds } from "./axis3d.js";
import { pgfplotsAxisHidden } from "./axisOptions.js";
import { axisNumber } from "./coordinates.js";
import { formatAxisPoint } from "./format.js";
import { createTickAxisModel } from "./ticks.js";

// An optional TikZ local bounding box isolates this axis from earlier pictures
// or plots. Otherwise the caller must have installed the parent outer anchors.
export function renderMatrixColorbar(axisOptions = {}, ranges, geometry, parentBox) {
  const meta = axisOptions["pgfplots matrix meta range"];
  if (!meta || !Number.isFinite(meta.min) || !Number.isFinite(meta.max) || meta.min >= meta.max) return [];
  if (!geometry?.origin || !(geometry.width > 0) || !(geometry.height > 0)) return [];
  const { origin, width, height } = geometry;
  const bounds = { minX: origin.x, maxX: origin.x + width, minY: origin.y, maxY: origin.y + height, width, height };
  const colors = { ...axisOptions, "point meta min": meta.min, "point meta max": meta.max, "tikzkit explicit surface point meta": true };
  let edge;
  const commands = renderColorbarInBounds(colors, { zMin: meta.min, zMax: meta.max }, bounds, bounds, {
    outerBounds(style, orientation) {
      edge = style.at ? (String(style.at).includes("parent axis.above north") ? "maxY" : null)
        : { horizontal: "minY", left: "minX", right: "maxX" }[orientation];
      return edge ? { ...bounds, [edge]: 0 } : bounds;
    },
    planTicks(style, orientation, width, height) {
      const axis = orientation === "horizontal" ? "x" : "y";
      if (style[axis + "tick"] || style[axis + "mode"] === "log") return undefined;
      // PGF chooses a step in data-scaled units. Keep small but distinct meta
      // ticks out of the ordinary planner's fixed three-decimal rounding.
      const unit = 10 ** (Math.floor(Math.log10(meta.max - meta.min)) - 3);
      if (!Number.isFinite(unit) || unit <= 0) return undefined;
      const normalized = n => Number((n / unit).toPrecision(14));
      const distance = style[axis + "tick distance"] ?? style[axis + " tick distance"];
      const options = { ...style, "scaled ticks": false, ["scaled " + axis + " ticks"]: false };
      if (distance !== undefined) options[axis + "tick distance"] = normalized(axisNumber(distance, NaN));
      const scaled = { [axis + "Min"]: normalized(meta.min), [axis + "Max"]: normalized(meta.max) };
      return createTickAxisModel(axis, options, scaled, [], { width, height }).values.map(v => Number((v * unit).toPrecision(14)));
    }
  });
  if (!edge) return commands;

  // PGF combines the painted frame (including half its stroke) with the
  // parent descriptions. The bar's length is still the inner axis length.
  const box = "tikzkit matrix colorbar parent";
  const side = { minX: "west", maxX: "east", minY: "south", maxY: "north" }[edge];
  const anchor = box + "." + side;
  const shift = edge.endsWith("X") ? anchor + " |- 0,0" : "0,0 |- " + anchor;
  const line = parseOptions(String(axisOptions["axis line style"] || ""));
  const hidden = pgfplotsAxisHidden(axisOptions, "x") && pgfplotsAxisHidden(axisOptions, "y");
  const half = hidden ? 0 : parseDimension(String(line["line width"] ?? axisOptions["axis line width"] ?? axisOptions["line width"] ?? ".4pt"), {}) / 2;
  const sw = formatAxisPoint({ x: bounds.minX - half, y: bounds.minY - half });
  const ne = formatAxisPoint({ x: bounds.maxX + half, y: bounds.maxY + half });
  const parentSW = parentBox ? parentBox + ".south west" : "current axis.outer south west";
  const parentNE = parentBox ? parentBox + ".north east" : "current axis.outer east |- current axis.outer north";
  return [`{[local bounding box=${box}]`,
    `\\path[draw=none,fill=none] (${parentSW}) -- (${parentNE}) -- ${sw} -- ${ne};`,
    "}", `{[shift={(${shift})}]`, ...commands, "}"];
}
