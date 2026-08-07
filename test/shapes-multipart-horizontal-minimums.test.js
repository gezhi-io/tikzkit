import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

test("ignores horizontal split minimum width while preserving minimum height", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \node[
    rectangle split,
    rectangle split horizontal,
    rectangle split parts=3,
    draw,
    minimum width=8cm,
    minimum height=2cm,
    minimum size=3cm
  ] (parts) {a\nodepart{two}b\nodepart{three}c};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const box = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "parts");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(box.width < 1.5, `expected intrinsic horizontal width, got ${box.width}cm`);
  assert.ok(Math.abs(box.height - 3) < 1e-9, `expected the minimum-size height, got ${box.height}cm`);
});
