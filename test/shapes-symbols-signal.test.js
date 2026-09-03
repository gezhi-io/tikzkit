import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { parseDimension } from "../src/engine/math.js";
import {
  parseSignalDirections,
  signalBorderPoint,
  signalGeometry,
  signalLayoutSize
} from "../src/tikz/libraries/shapes.symbols.js";

function close(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}

test("signal directions follow PGF from-then-to precedence", () => {
  assert.deepEqual(parseSignalDirections("west", "east"), {
    north: "nowhere",
    east: "to",
    south: "nowhere",
    west: "from"
  });
  assert.deepEqual(parseSignalDirections("north", "east"), {
    north: "nowhere",
    east: "to",
    south: "nowhere",
    west: "nowhere"
  });
  assert.deepEqual(parseSignalDirections("nowhere", "east and north"), {
    north: "to",
    east: "nowhere",
    south: "nowhere",
    west: "nowhere"
  });
});

test("signal layout preserves pointer angle while enforcing minimum size", () => {
  const directions = parseSignalDirections("west", "east");
  const size = signalLayoutSize(1, 0.5, {
    directions,
    pointerAngle: 90,
    minimumWidth: 2,
    minimumHeight: 1
  });
  const geometry = signalGeometry(size, { directions, pointerAngle: 90 });

  close(size.width, 2);
  close(size.height, 1);
  close(geometry.pointerX, 0.5);
  close(geometry.anchors.east.x, 1);
  close(geometry.anchors.west.x, -0.5);
  close(geometry.anchors["north west"].x, -1);
  close(signalBorderPoint(geometry, { x: 10, y: 0 }).x, 1);
  close(signalBorderPoint(geometry, { x: -10, y: 0 }).x, -0.5);
});

test("TikZ signal nodes render pointed paths and clip edges to signal borders", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.symbols,positioning,arrows.meta}
\begin{tikzpicture}[node distance=8mm]
  \node[signal,signal from=west,signal to=east,signal pointer angle=90,
    minimum width=2cm,minimum height=1cm,draw,fill=blue!10] (input) {Input};
  \node[signal,signal from=west,signal to=east,minimum width=2cm,minimum height=1cm,
    draw,right=of input] (output) {Output};
  \draw[->] (-2,0) -- (input);
  \draw[->] (input) -- (output);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const input = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "input");
  const output = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "output");
  const paths = result.ir.items.filter((item) => item.type === "path");
  const inputGeometry = signalGeometry(input, input.shapeData);
  const outputGeometry = signalGeometry(output, output.shapeData);
  const namedAnchorGap =
    output.x + outputGeometry.anchors.west.x -
    (input.x + inputGeometry.anchors.east.x);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(input?.shape, "signal");
  assert.equal(output?.shape, "signal");
  assert.match(result.svg, /tikz-node-signal/);
  assert.ok(inputGeometry.points.some((point) => point.x > inputGeometry.halfWidth));
  assert.ok(outputGeometry.bounds.minX < outputGeometry.anchors.west.x);
  assert.ok(output.x > input.x + inputGeometry.bounds.maxX);
  close(namedAnchorGap, 0.8 + parseDimension("0.2pt") * 2);
  assert.ok(paths.length >= 2);
  close(paths[0].commands.at(-1).x, input.x + inputGeometry.anchors.west.x, 0.04);
  close(paths[1].commands[0].x, input.x + inputGeometry.anchors.east.x, 0.04);
  close(paths[1].commands.at(-1).x, output.x + outputGeometry.anchors.west.x, 0.04);
});
