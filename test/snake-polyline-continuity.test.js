import assert from "node:assert/strict";
import test from "node:test";
import { parseTikz, interpretTikz } from "../src/index.js";

function expectClose(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) < epsilon, `expected ${actual} to be close to ${expected}`);
}

test("runs snake decoration once across a polyline subpath", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[-stealth, decorate,
    decoration={snake, pre length=1mm, segment length=4mm, amplitude=.7mm, post length=2mm}]
    (0,0) -- (3,0) -- (3,2) -- (6,2);
\end{tikzpicture}`;
  const result = interpretTikz(parseTikz(source).ast);
  const path = result.ir.items.find((item) => item.type === "path");
  const lineSegments = path.commands.filter((command) => command.type === "lineTo");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(path.commands.filter((command) => command.type === "moveTo").length, 1);
  // One pre-length line, one finalization line, and one post-length line. A
  // restart at either corner would add another pair of straight segments.
  assert.equal(lineSegments.length, 3);
  expectClose(lineSegments[0].x, 0.1);
  expectClose(lineSegments[0].y, 0);
  expectClose(lineSegments.at(-1).x, 6);
  expectClose(lineSegments.at(-1).y, 2);
  assert.ok(lineSegments.at(-2).x < 6, "post length should only be emitted at the final endpoint");
});

test("keeps a snake Bezier state in its entry tangent frame when it crosses a sharp corner", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[decorate, decoration={snake, pre length=1mm, segment length=4mm, amplitude=.7mm, post length=2mm}]
    (0,0) -- (3,0) -- (3,2) -- (6,2);
\end{tikzpicture}`;
  const result = interpretTikz(parseTikz(source).ast);
  const path = result.ir.items.find((item) => item.type === "path");
  const crossingStateEnd = path.commands.find((command) =>
    command.type === "curveTo" && Math.abs(command.x - 3.025) < 1e-9 && Math.abs(command.y - 0.07) < 1e-9
  );

  assert.deepEqual(result.diagnostics, []);
  assert.ok(crossingStateEnd, "expected the state that starts before the corner to retain its incoming horizontal frame");
});
