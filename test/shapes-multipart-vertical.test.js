import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

test("matches PGF vertical rectangle split center, left, and right part alignment", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \def\parts{one \nodepart{two} 2 \nodepart{three} three \nodepart{four} 4}
  \node[rectangle split, rectangle split parts=4, draw,
    rectangle split part align={center,left,right}] (mixed) at (0,0) {\parts};
  \node[rectangle split, rectangle split parts=4, draw,
    rectangle split part align={center,left}] (left) at (2.25,0) {\parts};
  \node[rectangle split, rectangle split parts=4, draw,
    rectangle split part align={center}] (center) at (4.5,0) {\parts};
  \draw (mixed.two) -- (mixed.four);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const boxes = result.ir.items.filter((item) => item.type === "nodeBox" && item.shape === "rectangleSplit");
  const labels = result.ir.items.filter((item) => item.type === "textNode");
  const anchorPath = result.ir.items.find((item) => item.type === "path");
  const mixed = boxes[0];
  const left = boxes[1];
  const center = boxes[2];
  const mixedParts = mixed.shapeData.rectangleSplit.parts;

  assert.deepEqual(result.diagnostics, []);
  assert.equal(mixed.rectangleSplitHorizontal, false);
  assert.deepEqual(mixedParts.map((part) => part.alignment), ["center", "left", "right", "right"]);
  assert.ok(mixedParts[1].centerX < -0.05, JSON.stringify(mixedParts));
  // `three` is the widest part, so right alignment leaves its visual center
  // at the node center. The final narrow part makes the right shift visible.
  assert.ok(Math.abs(mixedParts[2].centerX) < 1e-6, JSON.stringify(mixedParts));
  assert.ok(mixedParts[3].centerX > 0.05, JSON.stringify(mixedParts));
  assert.ok(mixedParts[0].centerY > mixedParts[1].centerY);
  assert.ok(mixedParts[1].centerY > mixedParts[2].centerY);
  assert.ok(mixedParts[2].centerY > mixedParts[3].centerY);
  assert.deepEqual(left.shapeData.rectangleSplit.parts.map((part) => part.alignment), ["center", "left", "left", "left"]);
  assert.ok(left.shapeData.rectangleSplit.parts[3].centerX < -0.05);
  for (const part of center.shapeData.rectangleSplit.parts) assert.ok(Math.abs(part.centerX) < 1e-6);
  assert.ok(anchorPath.commands[0].x < -0.05, JSON.stringify(anchorPath.commands));
  assert.ok(anchorPath.commands[1].x > 0.05, JSON.stringify(anchorPath.commands));
  assert.equal(labels.length, 12);
});
