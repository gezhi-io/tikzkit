import { parseOptions } from "../engine/options.js";
import { parseCoordinateList } from "./coordinates.js";

export function createAddplotModel(plot = {}, index = 0) {
  return {
    type: "Plot",
    index,
    plotType: plot.type || "unknown",
    options: plot.options || {},
    points: plot.points || [],
    expression: plot.expression || "",
    closedCycle: Boolean(plot.closedCycle),
    nodes: plot.nodes || []
  };
}

export function parseCoordinateAddplot(statement) {
  const text = String(statement || "");
  const optionsMatch = text.match(/\\addplot\+?\s*(?:\[(.*?)\])?\s*coordinates\s*\{([\s\S]*?)\}/);
  if (!optionsMatch) return null;
  return createAddplotModel({
    type: "coordinates",
    options: parseOptions(optionsMatch[1] || ""),
    points: parseCoordinateList(optionsMatch[2])
  });
}
