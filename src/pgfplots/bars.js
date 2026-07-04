import { axisNumber } from "./coordinates.js";
import { formatAxisPoint, joinOptions } from "./format.js";
import { selectPlotFillStyle } from "./plotStyle.js";

export function isAxisBarPlot(axisOptions = {}, plotOptions = {}, axis = "y") {
  const key = axis === "x" ? "xbar" : "ybar";
  return Boolean(axisOptions[key] || plotOptions[key]);
}

export function renderAxisBars(points, axisOptions = {}, geometry, plotOptions = {}, plotIndex = 0, orientation = "y") {
  const commands = [];
  const width = axisNumber(axisOptions["bar width"] || plotOptions["bar width"], 0.2);
  const style = joinOptions(["axis bar", selectPlotFillStyle(plotOptions, plotIndex), "draw=none"]);
  for (const point of points) {
    if (orientation === "y") {
      const baseline = axisNumber(axisOptions["ybar interval"] ? axisOptions.ymin : 0, 0);
      const corners = [
        geometry.mapPoint({ x: point.x - width / 2, y: baseline }),
        geometry.mapPoint({ x: point.x + width / 2, y: baseline }),
        geometry.mapPoint({ x: point.x + width / 2, y: point.y }),
        geometry.mapPoint({ x: point.x - width / 2, y: point.y })
      ];
      commands.push(`\\draw[${style}] ${corners.map(formatAxisPoint).join(" -- ")} -- cycle;`);
    } else {
      const baseline = axisNumber(axisOptions["xbar interval"] ? axisOptions.xmin : 0, 0);
      const corners = [
        geometry.mapPoint({ x: baseline, y: point.y - width / 2 }),
        geometry.mapPoint({ x: point.x, y: point.y - width / 2 }),
        geometry.mapPoint({ x: point.x, y: point.y + width / 2 }),
        geometry.mapPoint({ x: baseline, y: point.y + width / 2 })
      ];
      commands.push(`\\draw[${style}] ${corners.map(formatAxisPoint).join(" -- ")} -- cycle;`);
    }
  }
  return commands;
}
