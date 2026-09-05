import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import {
  trapeziumBorderPoint,
  trapeziumGeometry,
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

test("trapezium incircle layout preserves an exact border rotation", () => {
  const layout = trapeziumLayoutSize(1, 0.5, {
    leftAngle: 60,
    rightAngle: 60,
    shapeBorderRotate: 30,
    shapeBorderUsesIncircle: true
  });
  const incircleRadius = Math.SQRT2 / 2;

  close(layout.trapeziumBodyHalfWidth, incircleRadius);
  close(layout.trapeziumHalfHeight, incircleRadius);
  close(layout.trapeziumLeftExtension, 2 * incircleRadius / Math.sqrt(3));
  close(layout.trapeziumRightExtension, 2 * incircleRadius / Math.sqrt(3));
  close(layout.trapeziumShapeBorderRotate, 30);
  assert.equal(layout.trapeziumShapeBorderUsesIncircle, true);

  const geometry = trapeziumGeometry(layout, {
    ...layout,
    trapeziumOuterSep: 0.1
  });
  assert.ok(geometry.visibleBoundaryPoints[0].y < -incircleRadius);
  assert.ok(geometry.visibleBoundaryPoints[2].y > incircleRadius);
  assert.ok(geometry.anchors["bottom left corner"].x < geometry.visibleBoundaryPoints[0].x);
  assert.ok(trapeziumBorderPoint(geometry, { x: 1, y: 0 }).x > 0);
});

test("TikZ trapezium rotation reaches paint, named anchors, and automatic clipping", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{arrows.meta,shapes.geometric}
\begin{tikzpicture}
  \node[trapezium,draw,inner sep=2mm,trapezium angle=65,
    shape border rotate=61] (quarter) at (0,0) {Q};
  \node[trapezium,draw,inner sep=2mm,trapezium left angle=75,
    trapezium right angle=55,shape border uses incircle,
    shape border rotate=31] (exact) at (4,0) {sensor};
  \draw[blue] (exact.top side) -- ++(120:5mm);
  \draw[-{Latex[length=3mm]},red] (1.5,-1) -- (exact);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const nodes = result.ir.items.filter((item) => item.type === "nodeBox" && item.shape === "trapezium");
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(nodes.length, 2);
  close(nodes[0].shapeData.trapeziumShapeBorderRotate, 90);
  close(nodes[1].shapeData.trapeziumShapeBorderRotate, 31);
  assert.equal(nodes[1].shapeData.trapeziumShapeBorderUsesIncircle, true);

  const exactGeometry = trapeziumGeometry(nodes[1], nodes[1].shapeData);
  const topSide = exactGeometry.anchors["top side"];
  close(paths[0].commands[0].x, nodes[1].x + topSide.x, 0.02);
  close(paths[0].commands[0].y, nodes[1].y + topSide.y, 0.02);
  const clippedEnd = paths[1].commands.at(-1);
  assert.ok(clippedEnd.x < nodes[1].x, "expected the incoming arrow to stop on the rotated left flank");
  assert.ok(clippedEnd.y < nodes[1].y, "expected the incoming arrow to retain its upward approach");
  assert.match(result.svg, /tikz-node-trapezium/);
});
