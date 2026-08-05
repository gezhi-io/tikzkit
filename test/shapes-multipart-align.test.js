import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

function closeTo(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be close to ${expected}`);
}

test("matches PGF horizontal rectangle split center, top, bottom, and base alignments", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \def\parts{\Large w\nodepart{two}x\nodepart{three}\Huge y\nodepart{four}\tiny z}
  \node[rectangle split, rectangle split parts=4, draw, rectangle split horizontal,
    rectangle split part align={center,top,bottom}] (mixed) {\parts};
  \node[rectangle split, rectangle split parts=4, draw, rectangle split horizontal,
    rectangle split part align=base] (baseline) at (0,-1.25) {\parts};
  \draw (mixed.two) -- (mixed.three);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const boxes = result.ir.items.filter((item) => item.type === "nodeBox" && item.shape === "rectangleSplit");
  const labels = result.ir.items.filter((item) => item.type === "textNode");
  const anchorPath = result.ir.items.find((item) => item.type === "path");
  const mixed = boxes[0];
  const baseline = boxes[1];
  const mixedParts = mixed.shapeData.rectangleSplit.parts;
  const baselineParts = baseline.shapeData.rectangleSplit.parts;

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(mixedParts.map((part) => part.alignment), ["center", "top", "bottom", "bottom"]);
  assert.ok(mixedParts[1].centerY > 0.15, JSON.stringify(mixedParts));
  assert.ok(mixedParts[2].centerY < -0.1, JSON.stringify(mixedParts));
  assert.ok(mixedParts[3].centerY < -0.15, JSON.stringify(mixedParts));
  assert.ok(labels[1].y > labels[0].y, JSON.stringify(labels.slice(0, 4)));
  assert.ok(labels[2].y < labels[0].y, JSON.stringify(labels.slice(0, 4)));
  assert.ok(anchorPath.commands[0].y > 0, JSON.stringify(anchorPath.commands));
  assert.ok(anchorPath.commands[1].y < 0, JSON.stringify(anchorPath.commands));
  assert.ok(Math.abs(anchorPath.commands[0].y - anchorPath.commands[1].y) > 0.2, JSON.stringify(anchorPath.commands));
  assert.deepEqual(baselineParts.map((part) => part.alignment), ["base", "base", "base", "base"]);
  for (const part of baselineParts.slice(1)) closeTo(part.originY, baselineParts[0].originY);
  assert.ok(Math.abs(baselineParts[0].centerY - baselineParts[2].centerY) > 0.02, JSON.stringify(baselineParts));
});
