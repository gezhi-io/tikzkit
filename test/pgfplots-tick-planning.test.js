import assert from "node:assert/strict";
import test from "node:test";
import { parseStatements } from "../src/frontend/parser.js";
import { parseDimension } from "../src/engine/math.js";
import { createAxisGeometry } from "../src/pgfplots/geometry.js";
import { renderAxisGrid } from "../src/pgfplots/grid.js";
import { createAxisTickModel, renderAxisTicks } from "../src/pgfplots/ticks.js";
import { tikzToSvg } from "../src/index.js";

function scene(min, max, options = {}) {
  const ranges = { xMin: min, xMax: max, yMin: min, yMax: max };
  const axisOptions = { width: "4cm", height: "4cm", enlargelimits: false,
    "axis lines": "middle", "scaled ticks": false, ...options };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const nodes = parseStatements(renderAxisTicks(axisOptions, [], ranges, geometry).join("\n"))
    .filter(node => node.type === "node" && node.options["axis tick label"]);
  const labels = anchor => nodes.filter(node => node.options.anchor === anchor)
    .map(node => Number(node.text.replaceAll("\u2212", "-")));
  return { ranges, axisOptions, geometry, x: labels("north"), y: labels("east") };
}

// Expected values come from pgfplots-tick-planning-metrics.tex, not JS snapshots.
test("compact 2D axes use PGF's default try min ticks=4 before rounding", () => {
  const result = scene(-1, 1);
  assert.deepEqual(result.x, [-1, -0.5, 0.5, 1]);
  assert.deepEqual(result.y, [-1, -0.5, 0.5, 1]);
});

test("linear 2D axes retry an interval that would leave only the origin", () => {
  const result = scene(-4.4, 4.4, { "max space between ticks": 100, "try min ticks": 2 });
  assert.deepEqual(result.x, [-4, -2, 2, 4]);
  assert.deepEqual(result.y, [-4, -2, 2, 4]);
});

test("2D retry follows PGF's signed truncation, not a symmetric tick-count heuristic", () => {
  const options = { "axis lines": "box", "scale only axis": true,
    "max space between ticks": 100, "try min ticks": 2 };
  assert.deepEqual(scene(-2.99, -1.01, options).x, [-2.5, -2, -1.5]);
  assert.deepEqual(scene(1.01, 2.99, options).x, [2]);
});

test("unitless max space between ticks is in TeX points", () => {
  const options = { width: "16cm", height: "16cm", "scale only axis": true };
  assert.deepEqual(scene(-100, 100, { ...options, "max space between ticks": 35 }).x,
    scene(-100, 100, { ...options, "max space between ticks": "35pt" }).x);
});

test("2D grids share explicit distances and derived minor ticks with the labels", () => {
  const { axisOptions, ranges, geometry, x } = scene(0, 6, {
    width: "9cm", height: "6cm", grid: "both", "minor tick num": 1,
    "xtick distance": 2, "ytick distance": 2
  });
  assert.deepEqual(x, [2, 4, 6]);
  assert.deepEqual(renderAxisGrid(axisOptions, [], ranges, geometry), renderAxisGrid({
    ...axisOptions, xtick: "{0,2,4,6}", ytick: "{0,2,4,6}"
  }, [], ranges, geometry));
});

test("axis model and rendering use the same geometry-dependent automatic ticks", () => {
  const { axisOptions, ranges, geometry } = scene(-1, 1);
  const model = createAxisTickModel(axisOptions, ranges, [], geometry);
  assert.deepEqual(model.x.values, [-1, -0.5, 0, 0.5, 1]);
  assert.deepEqual(model.y.values, model.x.values);
});

test("explicit single ticks, empty distances and disabled ticks do not trigger retries", () => {
  assert.deepEqual(scene(-1, 1, { xtick: "{0}", "hide obscured x ticks": false }).x, [0]);
  assert.deepEqual(scene(1.01, 2.99, { "xtick distance": 5 }).x, []);
  assert.deepEqual(scene(-1, 1, { xtick: "\\empty" }).x, []);
});

test("grid preparation honors hide obscured ticks for explicit tick lists too", () => {
  const { axisOptions, ranges, geometry } = scene(-1, 1, {
    grid: "major", xtick: "{-1,0,1}", ytick: "{-1,0,1}"
  });
  assert.equal(renderAxisGrid(axisOptions, [], ranges, geometry).length, 4);
  assert.equal(renderAxisGrid({ ...axisOptions, "hide obscured x ticks": false,
    "hide obscured y ticks": false }, [], ranges, geometry).length, 6);
});

test("ticks=none disables tick paint without discarding the grid plan", () => {
  const { axisOptions, ranges, geometry } = scene(-1, 1, { grid: "major", ticks: "none" });
  assert.deepEqual(renderAxisTicks(axisOptions, [], ranges, geometry), []);
  assert.equal(createAxisTickModel(axisOptions, ranges, [], geometry).x.disabled, true);
  assert.equal(renderAxisGrid(axisOptions, [], ranges, geometry).length, 8);
  assert.equal(renderAxisGrid({ ...axisOptions, xtick: "\\empty", ytick: "\\empty" }, [], ranges, geometry).length, 0);
});

test("minor grids inherit every axis grid before their more specific style", () => {
  const { axisOptions, ranges, geometry } = scene(0, 6, { grid: "both",
    "minor tick num": 1, "grid style": "gray!35,dashed", "minor grid style": "red" });
  const commands = renderAxisGrid(axisOptions, [], ranges, geometry);
  assert.ok(commands.some(command => command.startsWith("\\draw[axis minor grid, black!25, line width=0.4pt, gray!35,dashed, red]")));
});

test("short explicit y ranges do not impose an extra four-tick cap", () => {
  const options = { "axis lines": "middle", xmin: -1, xmax: 6, ymin: -0.25, ymax: 2.25 };
  const ranges = { xMin: -1, xMax: 6, yMin: -0.25, yMax: 2.25 };
  const geometry = createAxisGeometry(options, ranges);
  assert.deepEqual(createAxisTickModel(options, ranges, [], geometry).y.values, [0, 0.5, 1, 1.5, 2]);
});

test("default 2D middle axes subtract the native 45pt description reserve", () => {
  const geometry = createAxisGeometry({ "axis lines": "middle" },
    { xMin: -1, xMax: 6, yMin: -0.25, yMax: 2.25 });
  assert.ok(Math.abs(geometry.width - parseDimension("195pt")) < 1e-6);
  assert.ok(Math.abs(geometry.height - parseDimension("162pt")) < 1e-6);
});

test("normalizing separate middle-axis keys does not reset a later tick alignment", () => {
  const options = [
    ["tick align=outside,axis x line=middle,axis y line=middle", -0.075],
    ["axis x line=middle,axis y line=middle,tick align=outside", -0.15]
  ];
  for (const [keys, offset] of options) {
    const result = tikzToSvg(String.raw`\begin{tikzpicture}
      \begin{axis}[width=4cm,height=4cm,xmin=-1,xmax=1,ymin=-1,ymax=1,
        xtick={1},ytick={1},${keys}]
        \addplot[blue] coordinates {(-1,-1)(1,1)};
      \end{axis}\end{tikzpicture}`);
    assert.deepEqual(result.diagnostics, []);
    const ticks = result.ir.items.filter(item => item.subtype === "axis-tick");
    assert.equal(ticks.length, 2);
    const center = (4 - parseDimension("45pt")) / 2;
    assert.ok(Math.abs(ticks[0].commands[0].y - center - offset) < 0.001);
    assert.ok(Math.abs(ticks[1].commands[0].x - center - offset) < 0.001);
  }
});
