import { formatAxisPoint, joinOptions } from "./format.js";
import { selectPlotStyle } from "./plotStyle.js";

export function isAxisCombPlot(axisOptions = {}, plotOptions = {}, axis = "y") {
  const key = axis === "x" ? "xcomb" : "ycomb";
  return Boolean(axisOptions[key] || plotOptions[key]);
}

export function renderAxisComb(points, axisOptions = {}, ranges, geometry, plotOptions = {}, plotIndex = 0, orientation = "y") {
  const commands = [];
  const style = joinOptions(["axis comb", selectPlotStyle(plotOptions, plotIndex)]);
  const xBaseline = ranges.xMin <= 0 && ranges.xMax >= 0 ? 0 : ranges.xMin;
  const yBaseline = ranges.yMin <= 0 && ranges.yMax >= 0 ? 0 : ranges.yMin;
  for (const point of points) {
    const from = orientation === "x" ? geometry.mapPoint({ x: xBaseline, y: point.y }) : geometry.mapPoint({ x: point.x, y: yBaseline });
    const to = geometry.mapPoint(point);
    commands.push(`\\draw[${style}] ${formatAxisPoint(from)} -- ${formatAxisPoint(to)};`);
  }
  return commands;
}
