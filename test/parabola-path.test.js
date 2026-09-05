import assert from "node:assert/strict";
import test from "node:test";
import { parsePathSegments } from "../src/frontend/parser.js";
import { tikzToSvg } from "../src/index.js";
import { pgfParabolaCommands } from "../src/tikz/pathOperations/parabola.js";

function pathFrom(source) {
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  assert.deepEqual(result.diagnostics, []);
  return result.ir.items.find((item) => item.type === "path");
}

test("parses explicit and option-driven parabola path operations", () => {
  const segments = parsePathSegments("(0,4) parabola[bend pos=.25] bend (2,0) (5,9)");
  assert.deepEqual(segments[1], {
    kind: "parabola",
    options: { "bend pos": ".25" },
    bend: "(2,0)",
    to: "(5,9)"
  });
});

test("uses PGF's two source cubic coefficient sets around an explicit bend", () => {
  assert.deepEqual(
    pgfParabolaCommands({ x: 0, y: 4 }, { x: 2, y: 0 }, { x: 5, y: 9 }),
    [
      { type: "curveTo", x1: 0.225, y1: 3.1, x2: 1, y2: 0, x: 2, y: 0 },
      { type: "curveTo", x1: 3.5, y1: 0, x2: 4.6625, y2: 6.975, x: 5, y: 9 }
    ]
  );
});

test("renders a default half parabola with its bend at the start", () => {
  const path = pathFrom(String.raw`\begin{tikzpicture}\draw (0,0) parabola (2,2);\end{tikzpicture}`);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 0, y: 0 },
    { type: "curveTo", x1: 1, y1: 0, x2: 1.775, y2: 1.55, x: 2, y: 2 }
  ]);
});

test("expands a local style before applying bend pos", () => {
  const path = pathFrom(String.raw`
\tikzset{quarter bend/.style={bend pos=.25}}
\begin{tikzpicture}\draw (0,0) parabola[quarter bend] (4,4);\end{tikzpicture}`);
  assert.deepEqual(path.commands.slice(1), [
    { type: "curveTo", x1: 0.1125, y1: 0.225, x2: 0.5, y2: 1, x: 1, y: 1 },
    { type: "curveTo", x1: 2.5, y1: 1, x2: 3.6625, y2: 3.325, x: 4, y: 4 }
  ]);
});

test("accepts a braced bend option that protects the coordinate comma", () => {
  const path = pathFrom(String.raw`\begin{tikzpicture}\draw (0,0) parabola[bend={(1,2)}] (4,0);\end{tikzpicture}`);
  assert.deepEqual(path.commands.slice(1), [
    { type: "curveTo", x1: 0.1125, y1: 0.45, x2: 0.5, y2: 2, x: 1, y: 2 },
    { type: "curveTo", x1: 2.5, y1: 2, x2: 3.6625, y2: 0.45, x: 4, y: 0 }
  ]);
});

test("transforms parabola height as a local canvas vector", () => {
  const path = pathFrom(String.raw`\begin{tikzpicture}\draw[rotate=90] (0,0) parabola[parabola height=2] (4,0);\end{tikzpicture}`);
  assert.deepEqual(path.commands.slice(1), [
    { type: "curveTo", x1: -0.45, y1: 0.225, x2: -2, y2: 1, x: -2, y: 2 },
    { type: "curveTo", x1: -2, y1: 3, x2: -0.45, y2: 3.775, x: 0, y: 4 }
  ]);
});
