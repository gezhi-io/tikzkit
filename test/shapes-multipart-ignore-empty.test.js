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
