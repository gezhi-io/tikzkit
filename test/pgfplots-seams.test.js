import assert from "node:assert/strict";
import test from "node:test";
import {
  axisModelToSceneGraphPlan,
  createAxisGridModel,
  createAxisModel,
  createAxisTickModel,
  createDataToCanvasTransform,
  parseCoordinateAddplot,
  parsePgfplotsCoordinateList,
  transformDataToCanvas
} from "../src/index.js";

test("pgfplots axis model owns ranges, ticks, grid, plots, and labels", () => {
  const axis = createAxisModel({
    axisOptions: {
      xmin: 0,
      xmax: 5,
      ymin: 0,
      ymax: 5,
      grid: "major",
      xlabel: "$x$"
    },
    ranges: { xMin: 0, xMax: 5, yMin: 0, yMax: 5 },
    geometry: { origin: { x: 10, y: 20 }, width: 100, height: 50 },
    addplots: [{ type: "coordinates", options: { mark: "o" }, points: [{ x: 0, y: 2 }, { x: 5, y: 2 }] }]
  });

  assert.equal(axis.type, "Axis");
  assert.equal(axis.grid.x, true);
  assert.equal(axis.labels.x, "$x$");
  assert.deepEqual(axis.dataToCanvas.mapPoint({ x: 5, y: 5 }), { x: 110, y: 70 });
  assert.deepEqual(axisModelToSceneGraphPlan(axis), ["bounds", "grid", "axis-lines", "ticks", "plots", "labels"]);
});

test("pgfplots coordinate and addplot modules parse data without renderer knowledge", () => {
  assert.deepEqual(parsePgfplotsCoordinateList("(0,2) (5,2)"), [
    { x: 0, y: 2, raw: "(0,2)" },
    { x: 5, y: 2, raw: "(5,2)" }
  ]);

  const plot = parseCoordinateAddplot(String.raw`\addplot[mark=o] coordinates {(0,2) (5,2)};`);

  assert.equal(plot.type, "Plot");
  assert.equal(plot.plotType, "coordinates");
  assert.equal(plot.options.mark, "o");
  assert.equal(plot.points.length, 2);
});

test("pgfplots transform, ticks, and grid are isolated semantics", () => {
  const ranges = { xMin: 0, xMax: 10, yMin: -1, yMax: 1 };
  const transform = createDataToCanvasTransform({
    ranges,
    geometry: { origin: { x: 1, y: 2 }, width: 20, height: 10 }
  });

  assert.deepEqual(transformDataToCanvas({ x: 5, y: 0 }, transform), { x: 11, y: 7 });
  assert.deepEqual(createAxisTickModel({ "xtick distance": 5 }, ranges).x.values, [0, 5, 10]);
  assert.equal(createAxisGridModel({ "y grid": true }).y, true);
});
