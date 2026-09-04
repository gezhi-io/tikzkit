import assert from "node:assert/strict";
import test from "node:test";

import { parseAddplots } from "../src/pgfplots/addplotParser.js";
import { createAxisGeometry } from "../src/pgfplots/geometry.js";
import { renderAxisBars } from "../src/pgfplots/bars.js";
import { renderNodesNearCoords } from "../src/pgfplots/plotNodes.js";
import {
  pgfplotsStackedRenderEntries,
  preparePgfplotsStackedPlots
} from "../src/pgfplots/stackedPlots.js";

function coordinatePlot(values, options = {}) {
  return {
    type: "coordinates",
    is3d: false,
    options,
    points: values.map((y, x) => ({ x, y }))
  };
}

test("stack plots=y records each previous zero level and cumulative top", () => {
  const prepared = preparePgfplotsStackedPlots(
    { "stack plots": "y" },
    [coordinatePlot([1, 2]), coordinatePlot([3, 4]), coordinatePlot([5, 6])]
  );

  assert.equal(prepared.supported, true);
  assert.deepEqual(
    prepared.addplots.map((plot) => plot.points.map(({ y, stackBaseY, stackDeltaY }) => ({ y, stackBaseY, stackDeltaY }))),
    [
      [{ y: 1, stackBaseY: 0, stackDeltaY: 1 }, { y: 2, stackBaseY: 0, stackDeltaY: 2 }],
      [{ y: 4, stackBaseY: 1, stackDeltaY: 3 }, { y: 6, stackBaseY: 2, stackDeltaY: 4 }],
      [{ y: 9, stackBaseY: 4, stackDeltaY: 5 }, { y: 12, stackBaseY: 6, stackDeltaY: 6 }]
    ]
  );
});

test("modern ybar stacked keeps positive and negative zero levels separate", () => {
  const prepared = preparePgfplotsStackedPlots(
    { "ybar stacked": true },
    [coordinatePlot([3, -2]), coordinatePlot([-1, 4]), coordinatePlot([2, -3])],
    { compat: "1.18" }
  );

  assert.equal(prepared.axisOptions.ybar, true);
  assert.equal(prepared.axisOptions["stack plots"], "y");
  assert.equal(prepared.axisOptions["stack negative"], "separate");
  assert.deepEqual(
    prepared.addplots.map((plot) => plot.points.map(({ y, stackBaseY }) => ({ y, stackBaseY }))),
    [
      [{ y: 3, stackBaseY: 0 }, { y: -2, stackBaseY: 0 }],
      [{ y: -1, stackBaseY: 0 }, { y: 4, stackBaseY: 0 }],
      [{ y: 5, stackBaseY: 3 }, { y: -5, stackBaseY: -2 }]
    ]
  );
});

test("legacy ybar stacked keeps negative values on the previous level", () => {
  const prepared = preparePgfplotsStackedPlots(
    { "ybar stacked": true },
    [coordinatePlot([3]), coordinatePlot([-1])],
    { compat: "1.12" }
  );

  assert.equal(prepared.axisOptions["stack negative"], "on previous");
  assert.deepEqual(
    prepared.addplots.map((plot) => plot.points[0]),
    [
      { x: 0, y: 3, stackBaseY: 0, stackDeltaY: 3, stackIgnored: false },
      { x: 0, y: 2, stackBaseY: 3, stackDeltaY: -1, stackIgnored: false }
    ]
  );
});

test("stack dir=minus subtracts every layer from its zero level", () => {
  const prepared = preparePgfplotsStackedPlots(
    { "stack plots": "y", "stack dir": "minus", "stack negative": "on previous" },
    [coordinatePlot([2]), coordinatePlot([3])]
  );

  assert.deepEqual(
    prepared.addplots.map((plot) => plot.points[0]),
    [
      { x: 0, y: -2, stackBaseY: 0, stackDeltaY: 2, stackIgnored: false },
      { x: 0, y: -5, stackBaseY: -2, stackDeltaY: 3, stackIgnored: false }
    ]
  );
});

test("stacked bars use per-coordinate zero levels instead of the axis baseline", () => {
  const geometry = createAxisGeometry(
    { "scale only axis": true, width: "4cm", height: "6cm" },
    { xMin: -1, xMax: 3, yMin: 0, yMax: 6 }
  );
  const commands = renderAxisBars(
    [{ x: 1, y: 5, stackBaseY: 2, stackDeltaY: 3, stackIgnored: false }],
    { ybar: true },
    geometry,
    { fill: "orange" },
    1,
    "y",
    { xMin: -1, xMax: 3, yMin: 0, yMax: 6 }
  );

  assert.equal(commands.length, 1);
  assert.match(commands[0], /\(1\.9,2\).*\(2\.1,5\)/);
});

test("ybar stacked near-coordinate nodes show the layer delta at the bar midpoint", () => {
  const geometry = {
    mapPoint: (point) => point
  };
  const commands = renderNodesNearCoords(
    {
      options: {},
      points: [{ x: 1, y: 5, stackBaseY: 3, stackDeltaY: 2, stackIgnored: false }]
    },
    { "ybar stacked": true, "nodes near coords": true },
    geometry
  );

  assert.deepEqual(commands, [
    String.raw`\node[axis near coord, anchor=center, font=\scriptsize, text=blue] at (1,4) {2};`
  ]);
});

test("zero increments are suppressed and stacked plots render in reverse source order", () => {
  const prepared = preparePgfplotsStackedPlots(
    { "stack plots": "y", "stacked ignores zero": true },
    [coordinatePlot([1], { draw: "red" }), coordinatePlot([0], { draw: "blue" })]
  );
  const entries = pgfplotsStackedRenderEntries(prepared.addplots, prepared.axisOptions);

  assert.equal(prepared.addplots[1].points[0].stackIgnored, true);
  assert.deepEqual(entries.map(({ plotIndex }) => plotIndex), [1, 0]);
  assert.equal(entries[0].plot.options.draw, "blue");
});

test("stack switches can retain zero increments and source paint order", () => {
  const prepared = preparePgfplotsStackedPlots(
    {
      "stack plots": "y",
      "stacked ignores zero": false,
      "reverse stacked plots": false
    },
    [coordinatePlot([1]), coordinatePlot([0])]
  );
  const entries = pgfplotsStackedRenderEntries(prepared.addplots, prepared.axisOptions);

  assert.equal(prepared.addplots[1].points[0].stackIgnored, false);
  assert.deepEqual(entries.map(({ plotIndex }) => plotIndex), [0, 1]);
});

test("unsupported mismatched coordinate grids are left unchanged", () => {
  const addplots = [coordinatePlot([1, 2]), coordinatePlot([3])];
  const prepared = preparePgfplotsStackedPlots({ "stack plots": "y" }, addplots);

  assert.equal(prepared.supported, false);
  assert.strictEqual(prepared.addplots, addplots);
});

test("table plots enter the same equal-grid vertical stack", () => {
  const plots = parseAddplots(String.raw`
    \addplot table {x y
      0 1
      1 2
    };
    \addplot table {x y
      0 3
      1 4
    };
  `);
  const prepared = preparePgfplotsStackedPlots({ "stack plots": "y" }, plots);

  assert.equal(plots.every((plot) => plot.source === "table"), true);
  assert.deepEqual(
    prepared.addplots[1].points.map(({ x, y, stackBaseY }) => ({ x, y, stackBaseY })),
    [{ x: 0, y: 4, stackBaseY: 1 }, { x: 1, y: 6, stackBaseY: 2 }]
  );
});
