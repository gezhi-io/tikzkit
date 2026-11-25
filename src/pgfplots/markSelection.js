import { applyStyleDeclarations } from "../engine/options.js";
import { createPlotMarkSelector } from "../pgf/plotMarkSelection.js";
import { plotMarkLocalOptions } from "../tikz/libraries/plotmarks.js";
import { pgfplotsOptionEnabled } from "./axisOptions.js";

// The axis key family is /pgfplots; an axis declaration of "every mark/.style"
// needs /tikz/ to define TikZ's style. "mark options" itself forwards to TikZ.
export function pgfplotsMarkSelectionLayers(axis, plot, legendPath) {
  const layers = [axis, ...(Array.isArray(plot) ? plot : [plot])];
  const declarations = [];
  for (const [i, layer] of layers.entries()) {
    for (const [raw, value] of Object.entries(layer || {})) {
      const key = raw.replace(/^\/tikz\//, "");
      const match = key.match(/^(every (?:mark|plot))\/\.(style|append style|prefix style)$/);
      if (key !== "mark options" && (!match || (i === 0 && raw === key))) continue;
      for (const entry of Array.isArray(value) ? value : [value]) {
        declarations.push({ name: match?.[1] ?? "every mark", mode: match?.[2] ?? "style",
          options: plotMarkLocalOptions({ "mark options": entry }) });
      }
    }
  }
  const { "every mark": everyMark, "every plot": everyPlot } = applyStyleDeclarations(declarations);
  // TikZ's legend plot runs "every plot" after its path options, then
  // "every mark". PGFPlots re-applies "every plot" on stored-coordinate replay
  // (pgfplotscoordprocessing.code.tex), after installing its marker handler.
  return legendPath ? [...layers, legendPath, everyPlot, everyMark] : [...layers, everyMark, everyPlot];
}

// Indices here remain indices into the surveyed data, not into a filtered
// array: scatter's \coordindex includes finite points outside the viewport.
export function* selectedPlotMarkIndices(plot, points, axis, limits, variables) {
  const layers = pgfplotsMarkSelectionLayers(axis, plot.markScopes?.series ?? plot.options);
  const clip = pgfplotsOptionEnabled(plot.options.clip ?? axis.clip ?? true);
  let next;
  for (const [index, p] of points.entries()) {
    if (p.breakBefore) next = undefined;
    if (clip && (p.x < limits.xMin || p.x > limits.xMax || p.y < limits.yMin || p.y > limits.yMax ||
      (plot.is3d && (p.z < limits.zMin || p.z > limits.zMax)))) continue;
    next ??= createPlotMarkSelector(layers, variables);
    if (next()) yield index;
  }
}
