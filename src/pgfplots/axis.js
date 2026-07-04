import { createAddplotModel } from "./addplot.js";
import { createAxisGridModel } from "./grid.js";
import { createAxisLabelModel } from "./labels.js";
import { createPlotMarkModel } from "./marks.js";
import { createAxisRanges } from "./ranges.js";
import { createAxisTickModel } from "./ticks.js";
import { createDataToCanvasTransform } from "./transformDataToCanvas.js";

export function createAxisModel({ axisOptions = {}, addplots = [], ranges = {}, geometry = {}, legendEntries = [] } = {}) {
  const normalizedRanges = createAxisRanges(ranges);
  const dataToCanvas = createDataToCanvasTransform({ ranges: normalizedRanges, geometry, axisOptions });
  const plots = addplots.map((plot, index) => ({
    ...createAddplotModel(plot, index),
    mark: createPlotMarkModel(plot.options || {})
  }));

  return {
    type: "Axis",
    options: axisOptions,
    ranges: normalizedRanges,
    geometry: {
      ...geometry,
      mapPoint: geometry.mapPoint || dataToCanvas.mapPoint
    },
    ticks: createAxisTickModel(axisOptions, normalizedRanges, addplots),
    grid: createAxisGridModel(axisOptions),
    labels: createAxisLabelModel(axisOptions),
    plots,
    legendEntries,
    dataToCanvas
  };
}

export function axisModelToSceneGraphPlan(axisModel) {
  return [
    "bounds",
    axisModel.grid.x || axisModel.grid.y ? "grid" : "",
    "axis-lines",
    "ticks",
    axisModel.plots.length ? "plots" : "",
    axisModel.labels.title || axisModel.labels.x || axisModel.labels.y ? "labels" : "",
    axisModel.legendEntries.length ? "legend" : ""
  ].filter(Boolean);
}
