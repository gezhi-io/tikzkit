import assert from "node:assert/strict";
import test from "node:test";
import {
  circleCircleIntersections,
  lineCircleIntersections,
  lineLineIntersection,
  pointAtLength,
  flattenPath
} from "../src/geometry.js";

test("computes analytic line-line, line-circle, and circle-circle intersections", () => {
  assert.deepEqual(
    lineLineIntersection({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: -1 }, { x: 1, y: 1 }),
    { x: 1, y: 0 }
  );

  assert.deepEqual(
    lineCircleIntersections({ x: -2, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 0 }, 1),
    [{ x: -1, y: 0 }, { x: 1, y: 0 }]
  );

  const cc = circleCircleIntersections({ x: 0, y: 0 }, 1, { x: 1, y: 0 }, 1);
  assert.equal(cc.length, 2);
  assert.equal(Number(cc[0].x.toFixed(6)), 0.5);
  assert.equal(Math.abs(Number(cc[0].y.toFixed(6))), 0.866025);
});

test("flattens paths and resolves points by path length", () => {
  const commands = [
    { type: "moveTo", x: 0, y: 0 },
    { type: "curveTo", x1: 0, y1: 1, x2: 1, y2: 1, x: 1, y: 0 }
  ];

  const flat = flattenPath(commands, 0.05);
  const midpoint = pointAtLength(flat, 0.5);

  assert.ok(flat.length > 4);
  assert.ok(midpoint.x > 0.4 && midpoint.x < 0.6);
  assert.ok(midpoint.y > 0.6);
});
