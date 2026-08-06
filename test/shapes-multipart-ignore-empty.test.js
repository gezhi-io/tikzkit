import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

test("omits empty rectangle split parts and aliases their bare anchors", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \node[rectangle split,rectangle split horizontal,rectangle split parts=4,
    rectangle split ignore empty parts,rectangle split part fill={red,green,blue,purple},draw] (A)
    {left\nodepart{two}\nodepart{three}right\nodepart{four}};
  \draw (A.two) -- (A.three);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const box = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "A");
  const path = result.ir.items.find((item) => item.type === "path");
  const layout = box.shapeData.rectangleSplit;

  assert.deepEqual(result.diagnostics, []);
  assert.equal(box.parts, 2);
  assert.deepEqual(box.partFills, ["red", "blue"]);
  assert.equal(layout.logicalParts[1].visibleIndex, 0);
  assert.equal(layout.logicalParts[3].visibleIndex, 1);
  assert.ok(Math.abs(path.commands[0].x - (box.x + layout.parts[0].originX)) < 0.01, JSON.stringify(path.commands));
  assert.ok(Math.abs(path.commands[1].x - (box.x + layout.parts[1].originX)) < 0.01, JSON.stringify(path.commands));
});

test("uses the first visible part text origin for rectangle split text anchors", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[every node/.style={draw,anchor=text,rectangle split,rectangle split horizontal,rectangle split parts=3}]
  \node (A) {text \nodepart{two} \nodepart{three}third};
  \node[rectangle split ignore empty parts] (B) at (3,0)
    {text \nodepart{two} \nodepart{three}third};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const [first, second] = result.ir.items.filter((item) => item.type === "nodeBox");
  const firstOrigin = first.shapeData.rectangleSplit.parts[0];
  const secondOrigin = second.shapeData.rectangleSplit.parts[0];

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.abs(first.x + firstOrigin.originX) < 0.01, JSON.stringify(first));
  assert.ok(Math.abs(first.y + firstOrigin.originY) < 0.01, JSON.stringify(first));
  assert.ok(Math.abs(second.x + secondOrigin.originX - 3) < 0.01, JSON.stringify(second));
  assert.ok(Math.abs(second.y + secondOrigin.originY) < 0.01, JSON.stringify(second));
});
