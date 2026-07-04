import assert from "node:assert/strict";
import test from "node:test";
import {
  axisModelToSceneGraphPlan,
  axisTickValues,
  createAxisGeometry,
  createAxisGridModel,
  createAxisModel,
  createAxisTickModel,
  createDataToCanvasTransform,
  parseCoordinateAddplot,
  parseAxisAt,
  parseAxisDimension,
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

test("pgfplots geometry owns axis sizing, origin, margins, and mapping", () => {
  const geometry = createAxisGeometry(
    { "scale only axis": true, width: "4cm", height: "2cm", at: "(1cm,2cm)" },
    { xMin: 0, xMax: 5, yMin: 0, yMax: 5 }
  );

  assert.equal(geometry.width, 4);
  assert.equal(geometry.height, 2);
  assert.deepEqual(geometry.origin, { x: 1, y: 2 });
  assert.deepEqual(geometry.mapPoint({ x: 5, y: 5 }), { x: 5, y: 4 });
  assert.equal(parseAxisDimension("1cm", 0), 1);
  assert.deepEqual(parseAxisAt("{(2cm,3cm)}"), { x: 2, y: 3 });
});

test("pgfplots geometry preserves log-axis and 3D projection metadata", () => {
  const geometry = createAxisGeometry(
    { "scale only axis": true, width: "3cm", height: "3cm", xmode: "log", "pgfplots 3d surface": true },
    { xMin: 1, xMax: 100, yMin: 0, yMax: 10, zMin: 0, zMax: 5 }
  );

  assert.equal(geometry.xLog, true);
  assert.deepEqual(geometry.mapPoint({ x: 10, y: 5 }), { x: 1.5, y: 1.5 });
  assert.ok(Number.isFinite(geometry.mapPoint3d({ x: 10, y: 5, z: 2 }).x));
});

test("pgfplots ticks and coordinate parsing preserve preprocess behavior", () => {
  assert.deepEqual(parsePgfplotsCoordinateList("(pi,2) (5,2,3)"), [
    { x: Math.PI, y: 2, raw: "(pi,2)" },
    { x: 5, y: 2, z: 3, raw: "(5,2,3)" }
  ]);
  assert.deepEqual(
    axisTickValues("data", "x", [
      { points: [{ x: 2 }, { x: 2 }, { x: 5 }] }
    ]),
    [2, 5]
  );
  assert.deepEqual(createAxisTickModel({ "xtick distance": "pi/2" }, { xMin: 0, xMax: Math.PI, yMin: 0, yMax: 1 }).x.values, [
    0,
    1.571,
    3.142
  ]);
});
