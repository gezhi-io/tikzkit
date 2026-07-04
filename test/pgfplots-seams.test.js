import assert from "node:assert/strict";
import test from "node:test";
import {
  axisModelToSceneGraphPlan,
  axisPlotPointChain,
  axisTickValues,
  createAxisGeometry,
  createAxisGridModel,
  createAxisModel,
  createAxisTickModel,
  createDataToCanvasTransform,
  isAxisBarPlot,
  isAxisCombPlot,
  parseCoordinateAddplot,
  parseAxisAt,
  parseAxisDimension,
  parsePgfplotsCoordinateList,
  renderAxisBounds,
  renderAxisBox,
  renderAxisBars,
  renderAxisComb,
  renderAxisGrid,
  renderAxisLabels,
  renderAxisLines,
  renderAxisPlotInlineNodes,
  renderAxisTicks,
  renderDatavisualizationCleanAxes,
  renderLegendEntries,
  renderNodesNearCoords,
  renderPlotMark,
  selectPlotStyle,
  shouldRenderAxisPlotPath,
  shouldRenderPlotMarks,
  splitLegendEntries,
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

test("pgfplots grid lowering emits TikZ draw primitives from axis geometry", () => {
  const ranges = { xMin: 0, xMax: 2, yMin: 0, yMax: 1 };
  const geometry = createAxisGeometry({ "scale only axis": true, width: "2cm", height: "1cm" }, ranges);
  const commands = renderAxisGrid({ grid: "major", "axis grid color": "gray!30" }, [], ranges, geometry);

  assert.deepEqual(commands, [
    String.raw`\draw[axis grid, gray!30, line width=0.2pt] (0,0) -- (0,1);`,
    String.raw`\draw[axis grid, gray!30, line width=0.2pt] (1,0) -- (1,1);`,
    String.raw`\draw[axis grid, gray!30, line width=0.2pt] (2,0) -- (2,1);`,
    String.raw`\draw[axis grid, gray!30, line width=0.2pt] (0,0) -- (2,0);`,
    String.raw`\draw[axis grid, gray!30, line width=0.2pt] (0,1) -- (2,1);`
  ]);
});

test("pgfplots axis line lowering emits bounds, box, middle lines, and clean axes", () => {
  const ranges = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
  const geometry = createAxisGeometry({ "scale only axis": true, width: "2cm", height: "2cm" }, ranges);

  assert.equal(
    renderAxisBounds(geometry),
    String.raw`\draw[axis bounds, draw=none, fill=none] (-0.3,-0.32) -- (2.55,-0.32) -- (2.55,2.32) -- (-0.3,2.32) -- cycle;`
  );
  assert.equal(
    renderAxisBox({ "axis lines": "box", "axis frame color": "gray" }, geometry),
    String.raw`\draw[axis frame, gray, line width=0.35pt] (0,0) -- (2,0) -- (2,2) -- (0,2) -- cycle;`
  );
  assert.deepEqual(renderAxisLines({ "axis lines": "middle" }, ranges, geometry), [
    String.raw`\draw[axis line, black, line width=0.35pt, ->] (0,1) -- (2,1);`,
    String.raw`\draw[axis line, black, line width=0.35pt, ->] (1,0) -- (1,2);`
  ]);
  assert.deepEqual(renderDatavisualizationCleanAxes({ "datavis clean padding": "0.1cm" }, ranges, geometry), [
    String.raw`\draw[axis clean line, black!50, line width=0.12pt] (0,-0.1) -- (2,-0.1);`,
    String.raw`\draw[axis clean line, black!50, line width=0.12pt] (-0.1,0) -- (-0.1,2);`,
    String.raw`\draw[axis clean boundary, black!25, line width=0.12pt, line cap=rect] (0,0) -- (2,0);`,
    String.raw`\draw[axis clean boundary, black!25, line width=0.12pt, line cap=rect] (0,2) -- (2,2);`,
    String.raw`\draw[axis clean boundary, black!25, line width=0.12pt, line cap=rect] (0,0) -- (0,2);`,
    String.raw`\draw[axis clean boundary, black!25, line width=0.12pt, line cap=rect] (2,0) -- (2,2);`
  ]);
});

test("pgfplots tick lowering emits TikZ tick and label primitives from axis geometry", () => {
  const ranges = { xMin: 0, xMax: 2, yMin: 0, yMax: 1 };
  const geometry = createAxisGeometry({ "scale only axis": true, width: "2cm", height: "1cm" }, ranges);
  const commands = renderAxisTicks({ xtick: "{0,2}", ytick: "{0,1}", "axis tick label font": "\\scriptsize" }, [], ranges, geometry);

  assert.ok(commands.some((command) => command === String.raw`\draw[axis tick, black, line width=0.25pt] (0,0) -- (0,-0.15);`));
  assert.ok(commands.some((command) => command === String.raw`\draw[axis tick, black, line width=0.25pt] (2,0) -- (2,-0.15);`));
  assert.ok(commands.some((command) => command.includes(String.raw`\node[axis tick label, anchor=north, font=\scriptsize]`) && command.endsWith("{0};")));
  assert.ok(commands.some((command) => command.includes(String.raw`\node[axis tick label, anchor=east, font=\scriptsize]`) && command.endsWith("{1};")));
  assert.deepEqual(renderAxisTicks({ ticks: "none" }, [], ranges, geometry), []);
});

test("pgfplots label lowering emits TikZ nodes from axis geometry", () => {
  const ranges = { xMin: 0, xMax: 2, yMin: 0, yMax: 1 };
  const geometry = createAxisGeometry({ "scale only axis": true, width: "2cm", height: "1cm" }, ranges);
  const commands = renderAxisLabels(
    { xlabel: "$x$", ylabel: "$y$", title: "Title", "axis label font": "\\small" },
    ranges,
    geometry
  );

  assert.ok(commands.includes(String.raw`\node[axis label, anchor=north, font=\small] at (1,-0.22) {$x$};`));
  assert.ok(commands.includes(String.raw`\node[axis label, anchor=east, font=\small, rotate=90] at (-1.1,0.5) {$y$};`));
  assert.ok(commands.includes(String.raw`\node[axis label, anchor=south] at (1,1.22) {Title};`));
});

test("pgfplots legend lowering owns legend box, samples, labels, and entry splitting", () => {
  const ranges = { xMin: 0, xMax: 2, yMin: 0, yMax: 1 };
  const geometry = createAxisGeometry({ "scale only axis": true, width: "2cm", height: "1cm" }, ranges);
  const commands = renderLegendEntries(
    { "legend entries": "{$x$,{two, words}}", "legend pos": "south east", "legend style": "font=\\tiny" },
    ranges,
    geometry,
    [],
    [{ options: { blue: true, thick: true } }, { options: { dashed: true } }]
  );

  assert.deepEqual(splitLegendEntries("{$x$,{two, words}}"), ["$x$", "{two, words}"]);
  assert.ok(commands[0].startsWith(String.raw`\draw[axis legend box, draw=black, fill=white`));
  assert.ok(commands.some((command) => command.includes(String.raw`\draw[axis legend image, blue, thick]`)));
  assert.ok(commands.some((command) => command.includes(String.raw`\draw[axis legend image, red, dashed]`)));
  assert.ok(commands.some((command) => command.includes(String.raw`\node[axis legend, anchor=west, font=\tiny]`) && command.endsWith("{$x$};")));
});

test("pgfplots plot style helper preserves cycle colors and explicit style options", () => {
  assert.equal(selectPlotStyle({ "pgfplots plus": true, dashed: true }, 1), "red, dashed");
  assert.equal(selectPlotStyle({ draw: "black", "line width": "1pt", dotted: true }, 0), "draw=black, line width=1pt, dotted");
});

test("pgfplots marks lowering owns mark decisions and TikZ mark primitives", () => {
  assert.equal(shouldRenderPlotMarks({ mark: "none" }), false);
  assert.equal(shouldRenderPlotMarks({ "only marks": true }), true);
  assert.equal(
    renderPlotMark({ x: 1, y: 2 }, { mark: "square*", red: true, "mark size": "2pt" }, 0),
    String.raw`\draw[axis mark, draw=red, fill=red, fill opacity=1] (0.93,1.93) -- (1.07,1.93) -- (1.07,2.07) -- (0.93,2.07) -- cycle;`
  );
  assert.match(renderPlotMark({ x: 1, y: 2 }, { mark: "x", blue: true, "mark size": "1pt" }, 0), /axis mark, draw=blue/);
});

test("pgfplots plot path lowering owns straight, const, smooth, gap, and draw decisions", () => {
  const points = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }];

  assert.equal(axisPlotPointChain(points, {}, {}), "(0,0) -- (1,1) -- (2,0)");
  assert.equal(axisPlotPointChain(points, { "const plot": true }, {}), "(0,0) -- (1,0) -- (1,1) -- (2,1) -- (2,0)");
  assert.match(axisPlotPointChain(points, {}, { smooth: true }), /\.\. controls/);
  assert.equal(axisPlotPointChain(points, {}, { "axis plot gap": "1pt" }), "(0.025,0.025) -- (0.975,0.975) (1.025,0.975) -- (1.975,0.025)");
  assert.equal(shouldRenderAxisPlotPath({ "only marks": true }), false);
  assert.equal(shouldRenderAxisPlotPath({ draw: "none" }), false);
  assert.equal(shouldRenderAxisPlotPath({ draw: "none", "name path": "curve" }), true);
});

test("pgfplots bar and comb visualizers lower data points through axis geometry", () => {
  const ranges = { xMin: 0, xMax: 2, yMin: 0, yMax: 2 };
  const geometry = createAxisGeometry({ "scale only axis": true, width: "2cm", height: "2cm" }, ranges);

  assert.equal(isAxisBarPlot({ ybar: true }, {}, "y"), true);
  assert.equal(isAxisCombPlot({}, { ycomb: true }, "y"), true);
  assert.deepEqual(renderAxisBars([{ x: 1, y: 2 }], { "bar width": 0.2 }, geometry, { blue: true }, 0, "y"), [
    String.raw`\draw[axis bar, fill=blue, draw=none] (0.9,0) -- (1.1,0) -- (1.1,2) -- (0.9,2) -- cycle;`
  ]);
  assert.deepEqual(renderAxisComb([{ x: 1, y: 2 }], {}, ranges, geometry, { red: true, thick: true }, 0, "y"), [
    String.raw`\draw[axis comb, red, thick] (1,0) -- (1,2);`
  ]);
});

test("pgfplots plot node lowering owns nodes near coords and inline plot labels", () => {
  const ranges = { xMin: 0, xMax: 2, yMin: 0, yMax: 2 };
  const geometry = createAxisGeometry({ "scale only axis": true, width: "2cm", height: "2cm" }, ranges);

  assert.deepEqual(renderNodesNearCoords({ options: {}, points: [{ x: 1, y: 2 }] }, { "nodes near coords": true }, geometry), [
    String.raw`\node[axis near coord, anchor=south, font=\scriptsize] at (1,2.08) {2};`
  ]);
  assert.deepEqual(
    renderAxisPlotInlineNodes(
      [{ options: { pos: 0.5, right: true, xshift: "2pt", pin: "north:{peak}" }, text: "$f(x)$" }],
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 }
      ],
      "blue"
    ),
    [
      String.raw`\draw[axis plot node connector, gray, thin] (1,0) -- (1.07,0);`,
      String.raw`\node[axis plot node, anchor=west, text=blue, pin={north:{peak}}] at (1.07,0) {$f(x)$};`
    ]
  );
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
