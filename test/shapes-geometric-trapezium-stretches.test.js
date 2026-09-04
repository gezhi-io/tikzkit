import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import {
  trapeziumLayoutSize,
  trapeziumNodePoints
} from "../src/tikz/libraries/shapes.geometric.js";

function close(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}

test("trapezium minimum height distinguishes proportional and independent stretching", () => {
  const naturalExtension = 0.5 / Math.sqrt(3);
  const proportional = trapeziumLayoutSize(1, 0.5, {
    minimumHeight: 2,
    leftAngle: 60,
    rightAngle: 60
  });
  const stretched = trapeziumLayoutSize(1, 0.5, {
    minimumHeight: 2,
    leftAngle: 60,
    rightAngle: 60,
    stretches: true
  });

  close(proportional.height, 2);
  close(proportional.width, 4 + 4 / Math.sqrt(3));
  close(stretched.height, 2);
  close(stretched.width, 1 + naturalExtension * 2);
  close(stretched.trapeziumBodyHalfWidth, 0.5);
  close(stretched.trapeziumLeftExtension, naturalExtension);
  close(stretched.trapeziumRightExtension, naturalExtension);
});

test("trapezium stretches body changes only its body for a minimum width", () => {
  const stretched = trapeziumLayoutSize(1, 0.5, {
    minimumWidth: 3,
    leftAngle: 60,
    rightAngle: 60,
    stretches: true
  });
  const body = trapeziumLayoutSize(1, 0.5, {
    minimumWidth: 3,
    leftAngle: 60,
    rightAngle: 60,
    stretchesBody: true
  });

  close(stretched.width, 3);
  close(stretched.height, 0.5);
  close(body.width, 3);
  close(body.height, 0.5);
  assert.ok(body.trapeziumBodyHalfWidth > stretched.trapeziumBodyHalfWidth);
  assert.ok(body.trapeziumLeftExtension < stretched.trapeziumLeftExtension);
  close(body.trapeziumLeftExtension, 0.5 / Math.sqrt(3));
  close(body.trapeziumRightExtension, 0.5 / Math.sqrt(3));

  const points = trapeziumNodePoints({ x: 0, y: 0 }, body.width / 2, body.height / 2, {
    trapeziumLeftAngle: 60,
    trapeziumRightAngle: 60,
    ...body
  });
  close(points[0].x, -1.5);
  close(points[1].x, -1.5 + 0.5 / Math.sqrt(3));
  close(points[2].x, 1.5 - 0.5 / Math.sqrt(3));
  close(points[3].x, 1.5);
});

test("TikZ trapezium stretch keys reach paint, side anchors, and border clipping", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.geometric,arrows.meta}
\begin{tikzpicture}
  \node[trapezium,draw,inner sep=0pt,minimum width=3cm,minimum height=1.6cm,
    trapezium left angle=60,trapezium right angle=60,trapezium stretches body] (io) at (0,0) {};
  \draw[blue] (io.top side) -- ++(0,5mm);
  \draw[red,->] (-3,0) -- (io);
  \draw[green] (io.bottom left corner) -- ++(-3mm,-3mm);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const node = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "io");
  const paths = result.ir.items.filter((item) => item.type === "path");
  const points = trapeziumNodePoints(
    { x: node.x, y: node.y },
    node.width / 2,
    node.height / 2,
    node.shapeData
  );

  assert.deepEqual(result.diagnostics, []);
  assert.equal(node.shape, "trapezium");
  assert.equal(node.shapeData.trapeziumStretchesBody, true);
  close(paths[0].commands[0].x, (points[1].x + points[2].x) / 2, 0.02);
  close(paths[0].commands[0].y, points[1].y, 0.02);
  assert.ok(paths[1].commands.at(-1).x < node.x - node.width * 0.2);
  close(paths[2].commands[0].x, points[0].x, 0.02);
  close(paths[2].commands[0].y, points[0].y, 0.02);
});
