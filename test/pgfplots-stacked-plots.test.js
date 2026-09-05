import assert from "node:assert/strict";
import test from "node:test";

import { parseAddplots } from "../src/pgfplots/addplotParser.js";
import { renderAddplot } from "../src/pgfplots/addplotLowering.js";
import { createAxisGeometry } from "../src/pgfplots/geometry.js";
import { renderLegendEntries } from "../src/pgfplots/legend.js";
import { renderAxisBars } from "../src/pgfplots/bars.js";
import { renderNodesNearCoords } from "../src/pgfplots/plotNodes.js";
import { computeAxisRanges } from "../src/pgfplots/rangeResolver.js";
import { normalizePgfplotsAreaOptions, stackedClosedCyclePointChain } from "../src/pgfplots/areaPlots.js";
import { applyPgfplotsCycleStyles } from "../src/pgfplots/axisTikzLowering.js";
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

function horizontalCoordinatePlot(values, options = {}) {
  return {
    type: "coordinates",
    is3d: false,
    options,
    points: values.map((x, y) => ({ x, y }))
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

test("stack plots=x records each previous zero level and cumulative top", () => {
  const prepared = preparePgfplotsStackedPlots(
    { "stack plots": "x" },
    [horizontalCoordinatePlot([1, 2]), horizontalCoordinatePlot([3, 4]), horizontalCoordinatePlot([5, 6])]
  );

  assert.equal(prepared.supported, true);
  assert.deepEqual(
    prepared.addplots.map((plot) => plot.points.map(({ x, stackBaseX, stackDeltaX }) => ({ x, stackBaseX, stackDeltaX }))),
    [
      [{ x: 1, stackBaseX: 0, stackDeltaX: 1 }, { x: 2, stackBaseX: 0, stackDeltaX: 2 }],
      [{ x: 4, stackBaseX: 1, stackDeltaX: 3 }, { x: 6, stackBaseX: 2, stackDeltaX: 4 }],
      [{ x: 9, stackBaseX: 4, stackDeltaX: 5 }, { x: 12, stackBaseX: 6, stackDeltaX: 6 }]
    ]
  );
});

test("modern xbar stacked keeps positive and negative zero levels separate", () => {
  const prepared = preparePgfplotsStackedPlots(
    { "xbar stacked": true },
    [horizontalCoordinatePlot([3, -2]), horizontalCoordinatePlot([-1, 4]), horizontalCoordinatePlot([2, -3])],
    { compat: "1.18" }
  );

  assert.equal(prepared.axisOptions.xbar, true);
  assert.equal(prepared.axisOptions["stack plots"], "x");
  assert.equal(prepared.axisOptions["stack negative"], "separate");
  assert.deepEqual(
    prepared.addplots.map((plot) => plot.points.map(({ x, stackBaseX }) => ({ x, stackBaseX }))),
    [
      [{ x: 3, stackBaseX: 0 }, { x: -2, stackBaseX: 0 }],
      [{ x: -1, stackBaseX: 0 }, { x: 4, stackBaseX: 0 }],
      [{ x: 5, stackBaseX: 3 }, { x: -5, stackBaseX: -2 }]
    ]
  );
});

test("xbar stacked bars use their per-coordinate x zero level", () => {
  const geometry = createAxisGeometry(
    { "scale only axis": true, width: "6cm", height: "4cm" },
    { xMin: 0, xMax: 6, yMin: -1, yMax: 3 }
  );
  const commands = renderAxisBars(
    [{ x: 5, y: 1, stackBaseX: 2, stackDeltaX: 3, stackIgnored: false }],
    { xbar: true },
    geometry,
    { fill: "orange" },
    1,
    "x",
    { xMin: 0, xMax: 6, yMin: -1, yMax: 3 }
  );

  assert.equal(commands.length, 1);
  assert.match(commands[0], /\(2,1\.9\).*\(5,2\.1\)/);
});

test("xbar stacked near-coordinate nodes show the x delta at the bar midpoint", () => {
  const commands = renderNodesNearCoords(
    {
      options: {},
      points: [{ x: 5, y: 1, stackBaseX: 3, stackDeltaX: 2, stackIgnored: false }]
    },
    { "xbar stacked": true, "nodes near coords": true },
    { mapPoint: (point) => point }
  );

  assert.deepEqual(commands, [
    String.raw`\node[axis near coord, anchor=center, font=\scriptsize, text=blue] at (4,1) {2};`
  ]);
});

test("x stacking rejects a mismatched y grid without mutating input", () => {
  const addplots = [horizontalCoordinatePlot([1, 2]), {
    ...horizontalCoordinatePlot([3, 4]),
    points: [{ x: 3, y: 0 }, { x: 4, y: 2 }]
  }];
  const prepared = preparePgfplotsStackedPlots({ "stack plots": "x" }, addplots);

  assert.equal(prepared.supported, false);
  assert.strictEqual(prepared.addplots, addplots);
});

test("xbar stacked=minus subtracts horizontal layers on the previous stream", () => {
  const prepared = preparePgfplotsStackedPlots(
    { "xbar stacked": "minus", "stack negative": "on previous" },
    [horizontalCoordinatePlot([2]), horizontalCoordinatePlot([3])]
  );

  assert.deepEqual(
    prepared.addplots.map((plot) => plot.points[0]),
    [
      { x: -2, y: 0, stackBaseX: 0, stackDeltaX: 2, stackIgnored: false },
      { x: -5, y: 0, stackBaseX: -2, stackDeltaX: 3, stackIgnored: false }
    ]
  );
});

test("table plots enter the same equal-grid horizontal stack", () => {
  const plots = parseAddplots(String.raw`
    \addplot table {x y
      1 0
      2 1
    };
    \addplot table {x y
      3 0
      4 1
    };
  `);
  const prepared = preparePgfplotsStackedPlots({ "stack plots": "x" }, plots);

  assert.equal(plots.every((plot) => plot.source === "table"), true);
  assert.deepEqual(
    prepared.addplots[1].points.map(({ x, y, stackBaseX }) => ({ x, y, stackBaseX })),
    [{ x: 4, y: 0, stackBaseX: 1 }, { x: 6, y: 1, stackBaseX: 2 }]
  );
});

test("ybar interval stacked expands to interval bars and cumulative y levels", () => {
  const first = {
    ...coordinatePlot([2, 3, 4, 0]),
    points: [{ x: 0, y: 2 }, { x: 1, y: 3 }, { x: 3, y: 4 }, { x: 5, y: 0 }]
  };
  const second = {
    ...coordinatePlot([1, 2, 3, 0]),
    points: [{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 3, y: 3 }, { x: 5, y: 0 }]
  };
  const prepared = preparePgfplotsStackedPlots(
    { "ybar interval stacked": true },
    [first, second],
    { compat: "1.18" }
  );

  assert.equal(prepared.supported, true);
  assert.equal(prepared.axisOptions["ybar interval"], true);
  assert.equal(prepared.axisOptions.ybar, undefined);
  assert.equal(prepared.axisOptions["stack plots"], "y");
  assert.equal(prepared.axisOptions["stacked ignores zero"], false);
  assert.deepEqual(
    prepared.addplots[1].points.map(({ x, y, stackBaseY }) => ({ x, y, stackBaseY })),
    [
      { x: 0, y: 3, stackBaseY: 2 },
      { x: 1, y: 5, stackBaseY: 3 },
      { x: 3, y: 7, stackBaseY: 4 },
      { x: 5, y: 0, stackBaseY: 0 }
    ]
  );
});

test("xbar interval stacked=minus keeps interval endpoints and subtracts x levels", () => {
  const first = {
    ...horizontalCoordinatePlot([2, 3, 0]),
    points: [{ x: 2, y: 0 }, { x: 3, y: 1 }, { x: 0, y: 3 }]
  };
  const second = {
    ...horizontalCoordinatePlot([1, 4, 0]),
    points: [{ x: 1, y: 0 }, { x: 4, y: 1 }, { x: 0, y: 3 }]
  };
  const prepared = preparePgfplotsStackedPlots(
    { "xbar interval stacked": "minus", "stack negative": "on previous" },
    [first, second]
  );

  assert.equal(prepared.supported, true);
  assert.equal(prepared.axisOptions["xbar interval"], true);
  assert.equal(prepared.axisOptions.xbar, undefined);
  assert.deepEqual(
    prepared.addplots[1].points.map(({ x, y, stackBaseX }) => ({ x, y, stackBaseX })),
    [
      { x: -3, y: 0, stackBaseX: -2 },
      { x: -7, y: 1, stackBaseX: -3 },
      { x: 0, y: 3, stackBaseX: 0 }
    ]
  );
});

test("interval stacking rejects unequal boundary grids", () => {
  const first = {
    ...coordinatePlot([2, 3, 0]),
    points: [{ x: 0, y: 2 }, { x: 1, y: 3 }, { x: 2, y: 0 }]
  };
  const second = {
    ...coordinatePlot([1, 4, 0]),
    points: [{ x: 0, y: 1 }, { x: 1.5, y: 4 }, { x: 2, y: 0 }]
  };
  const prepared = preparePgfplotsStackedPlots(
    { "ybar interval stacked": true },
    [first, second]
  );

  assert.equal(prepared.supported, false);
  assert.deepEqual(prepared.addplots, [first, second]);
});

test("stacked interval bars use the next boundary zero level exposed by the native handler", () => {
  const geometry = {
    mapPoint: (point) => point
  };
  const vertical = renderAxisBars(
    [
      { x: 0, y: 7, stackBaseY: 4, stackDeltaY: 3, stackIgnored: false },
      { x: 2, y: 9, stackBaseY: 6, stackDeltaY: 3, stackIgnored: false }
    ],
    { "ybar interval": true, ymin: -10 },
    geometry,
    {},
    1,
    "y",
    { xMin: 0, xMax: 2, yMin: -10, yMax: 8 }
  );
  const horizontal = renderAxisBars(
    [
      { x: -6, y: 0, stackBaseX: -2, stackDeltaX: 4, stackIgnored: false },
      { x: -8, y: 3, stackBaseX: -4, stackDeltaX: 4, stackIgnored: false }
    ],
    { "xbar interval": true, xmin: -10 },
    geometry,
    {},
    1,
    "x",
    { xMin: -10, xMax: 0, yMin: 0, yMax: 3 }
  );

  assert.match(vertical[0], /\(0,6\).*\(2,7\)/);
  assert.match(horizontal[0], /\(-4,0\).*\(-6,3\)/);
});

test("stacked interval terminal coordinates affect survey and nodes but not bars", () => {
  const first = {
    ...coordinatePlot([1, 2, 100]),
    points: [{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 100 }]
  };
  const second = {
    ...coordinatePlot([10, 20, 3]),
    points: [{ x: 0, y: 10 }, { x: 1, y: 20 }, { x: 2, y: 3 }]
  };
  const prepared = preparePgfplotsStackedPlots(
    { "ybar interval stacked": true, "nodes near coords": true, enlargelimits: false },
    [first, second],
    { compat: "1.18" }
  );
  const ranges = computeAxisRanges(prepared.axisOptions, prepared.addplots);
  const bars = renderAxisBars(
    prepared.addplots[1].points,
    prepared.axisOptions,
    { mapPoint: (point) => point },
    prepared.addplots[1].options,
    1,
    "y",
    ranges
  );
  const nodes = renderNodesNearCoords(
    prepared.addplots[1],
    prepared.axisOptions,
    { mapPoint: (point) => point },
    1
  );

  assert.equal(ranges.yMax, 103);
  assert.equal(bars.length, 2);
  assert.equal(nodes.length, 3);
  assert.ok(nodes.some((command) => command.includes("(2,103.08) {103}")));
});

test("interval stacked legends use the native single-bar image instead of a line sample", () => {
  const geometry = {
    origin: { x: 0, y: 0 },
    width: 10,
    height: 6,
    mapAxisDescriptionPoint: ({ x, y }) => ({ x: x * 10, y: y * 6 })
  };
  const commands = renderLegendEntries(
    { "xbar interval stacked": true },
    {},
    geometry,
    ["layer"],
    [{ options: { blue: true, fill: "blue!30" } }]
  );
  const sample = commands.find((command) => command.includes("axis legend image"));

  assert.match(sample, /fill=blue!30/);
  assert.match(sample, /\([^)]*\) -- \([^)]*\) -- \([^)]*\) -- \([^)]*\) -- cycle;/);
});

test("closed coordinate plots participate in the equal-grid y stack", () => {
  const first = { ...coordinatePlot([1, 2, 1]), closedCycle: true };
  const second = { ...coordinatePlot([2, 1, 3]), closedCycle: true };
  const prepared = preparePgfplotsStackedPlots(
    { "stack plots": "y" },
    [first, second]
  );

  assert.equal(prepared.supported, true);
  assert.deepEqual(
    prepared.addplots[1].points.map(({ x, y, stackBaseY }) => ({ x, y, stackBaseY })),
    [
      { x: 0, y: 3, stackBaseY: 1 },
      { x: 1, y: 3, stackBaseY: 2 },
      { x: 2, y: 4, stackBaseY: 1 }
    ]
  );
});

test("area style enables the native area cycle, legend, and foreground axes", () => {
  const axisOptions = normalizePgfplotsAreaOptions({ "area style": true });
  const [plot] = applyPgfplotsCycleStyles(
    [{ ...coordinatePlot([1, 2]), closedCycle: true }],
    axisOptions
  );

  assert.equal(axisOptions["area cycle list"], true);
  assert.equal(axisOptions["area legend"], true);
  assert.equal(axisOptions["axis on top"], true);
  assert.equal(plot.options.draw, "blue");
  assert.equal(plot.options.fill, "blue!30!white");
  assert.equal(plot.options.mark, "none");
});

test("stacked closed cycles follow the previous zero-level curve in reverse", () => {
  const plot = {
    ...coordinatePlot([3, 3, 4], { draw: "red", fill: "red!30" }),
    closedCycle: true,
    pgfplotsStacked: true,
    points: [
      { x: 0, y: 3, stackBaseY: 1 },
      { x: 1, y: 3, stackBaseY: 2 },
      { x: 2, y: 4, stackBaseY: 1 }
    ]
  };
  const geometry = { mapPoint: (point) => point };
  const chain = stackedClosedCyclePointChain(
    plot,
    plot.points,
    plot.points,
    { "stack plots": "y" },
    geometry
  );

  assert.equal(
    chain,
    "(0,3) -- (1,3) -- (2,4) -- (2,1) -- (1,2) -- (0,1) -- cycle"
  );
});

test("stacked const areas mirror the reversed zero-level step handler", () => {
  const plot = {
    ...coordinatePlot([3, 3, 4]),
    closedCycle: true,
    pgfplotsStacked: true,
    options: { "const plot": true },
    points: [
      { x: 0, y: 3, stackBaseY: 1 },
      { x: 1, y: 3, stackBaseY: 2 },
      { x: 2, y: 4, stackBaseY: 1 }
    ]
  };
  const chain = stackedClosedCyclePointChain(
    plot,
    plot.points,
    plot.points,
    { "stack plots": "y", "const plot": true },
    { mapPoint: (point) => point }
  );

  assert.match(chain, /\(2,4\) -- \(2,1\) -- \(2,2\) -- \(1,2\) -- \(1,1\) -- \(0,1\) -- cycle$/);
});

test("area legends use the native 0.6cm by 0.2cm filled rectangle", () => {
  const geometry = {
    origin: { x: 0, y: 0 },
    width: 10,
    height: 6,
    mapAxisDescriptionPoint: ({ x, y }) => ({ x: x * 10, y: y * 6 })
  };
  const commands = renderLegendEntries(
    { "area legend": true },
    {},
    geometry,
    ["layer"],
    [{ options: { blue: true, fill: "blue!30" } }]
  );
  const sample = commands.find((command) => command.includes("axis legend image"));

  assert.match(sample, /fill=blue!30/);
  assert.match(sample, /\([^)]*\) -- \([^)]*\) -- \([^)]*\) -- \([^)]*\) -- cycle;/);
});

test("a plot-level stack plots=false leaves the zero-level stream unchanged", () => {
  const prepared = preparePgfplotsStackedPlots(
    { "stack plots": "y" },
    [
      coordinatePlot([1]),
      coordinatePlot([100], { "stack plots": false }),
      coordinatePlot([2])
    ]
  );

  assert.equal(prepared.supported, true);
  assert.equal(prepared.addplots[0].points[0].y, 1);
  assert.equal(prepared.addplots[1].points[0].y, 100);
  assert.equal(prepared.addplots[1].pgfplotsStacked, undefined);
  assert.deepEqual(
    prepared.addplots[2].points[0],
    { x: 0, y: 3, stackBaseY: 1, stackDeltaY: 2, stackIgnored: false }
  );
});

test("plain stack plots uses compatibility defaults for negative and zero streams", () => {
  const modern = preparePgfplotsStackedPlots(
    { "stack plots": "y" },
    [coordinatePlot([3]), coordinatePlot([-1])],
    { compat: "1.18" }
  );
  const legacy = preparePgfplotsStackedPlots(
    { "stack plots": "y" },
    [coordinatePlot([3]), coordinatePlot([-1])],
    { compat: "1.12" }
  );

  assert.equal(modern.axisOptions["stack negative"], "separate");
  assert.equal(modern.axisOptions["stacked ignores zero"], true);
  assert.equal(modern.addplots[1].points[0].stackBaseY, 0);
  assert.equal(legacy.axisOptions["stack negative"], "on previous");
  assert.equal(legacy.addplots[1].points[0].stackBaseY, 3);
});

test("the first stacked area clamps its logical zero level to the visible y range", () => {
  const plot = {
    ...coordinatePlot([3, 4], { fill: "blue!30" }),
    closedCycle: true,
    pgfplotsStacked: true,
    points: [
      { x: 0, y: 3, stackBaseY: 0 },
      { x: 1, y: 4, stackBaseY: 0 }
    ]
  };
  const chain = stackedClosedCyclePointChain(
    plot,
    plot.points,
    plot.points,
    { "stack plots": "y" },
    { mapPoint: (point) => point },
    { yMin: 2, yMax: 5 }
  );

  assert.equal(chain, "(0,3) -- (1,4) -- (1,2) -- (0,2) -- cycle");
});

test("a coordinate closed cycle uses one stroked and clipped plot path", () => {
  const plot = {
    ...coordinatePlot([1, 2], { draw: "red", fill: "red!30", mark: "none" }),
    closedCycle: true,
    pgfplotsStacked: true,
    points: [
      { x: 0, y: 1, stackBaseY: 0 },
      { x: 1, y: 2, stackBaseY: 0 }
    ]
  };
  const commands = renderAddplot(
    plot,
    { "stack plots": "y" },
    { xMin: 0, xMax: 1, yMin: 0, yMax: 2 },
    { origin: { x: 0, y: 0 }, width: 1, height: 2, mapPoint: (point) => point },
    {}
  );

  assert.equal(commands.filter((command) => command.includes("axis plot")).length, 1);
  assert.match(commands[0], /axis closed cycle/);
  assert.match(commands[0], /red/);
  assert.match(commands[0], /fill=red!30/);
  assert.match(commands[0], /tikzkit clip rect=\{0,0,1,2\}/);
  assert.match(commands[0], /-- cycle;/);
  assert.doesNotMatch(commands[0], /draw=none/);
});

test("area legend preserves missing fill and explicit fill opacity", () => {
  const geometry = {
    origin: { x: 0, y: 0 },
    width: 10,
    height: 6,
    mapAxisDescriptionPoint: ({ x, y }) => ({ x: x * 10, y: y * 6 })
  };
  const unfilled = renderLegendEntries(
    { "area legend": true },
    {},
    geometry,
    ["line"],
    [{ options: { draw: "blue" } }]
  ).find((command) => command.includes("axis legend image"));
  const translucent = renderLegendEntries(
    { "area legend": true },
    {},
    geometry,
    ["area"],
    [{ options: { draw: "red", fill: "red!30", "fill opacity": 0.4 } }]
  ).find((command) => command.includes("axis legend image"));

  assert.doesNotMatch(unfilled, /fill=/);
  assert.match(translucent, /fill=red!30/);
  assert.match(translucent, /fill opacity=0\.4/);
});
