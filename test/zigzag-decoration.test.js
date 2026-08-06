import assert from "node:assert/strict";
import test from "node:test";

import { parseTikz } from "../src/frontend/parser.js";
import { interpretTikz } from "../src/engine/evaluate.js";
import { parseDimension } from "../src/math.js";

function decoratedPath(source) {
  const { ast, diagnostics: parseDiagnostics } = parseTikz(source);
  const { ir, diagnostics } = interpretTikz(ast);
  assert.deepEqual([...parseDiagnostics, ...diagnostics], []);
  return ir.items.find((item) => item.type === "path");
}

function expectClose(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to equal ${expected} within ${tolerance}`);
}

test("matches PGF zigzag's quarter-segment apex and center-finish state", () => {
  const segment = parseDimension("8mm");
  const amplitude = parseDimension("1.5mm");
  const path = decoratedPath(String.raw`
\begin{tikzpicture}
  \draw[decorate, decoration={zigzag,segment length=8mm,amplitude=1.5mm}] (0,0) -- (4.1,0);
\end{tikzpicture}`);
  const lineTo = path.commands.filter((command) => command.type === "lineTo");

  assert.ok(lineTo.length > 4);
  expectClose(lineTo[0].x, segment / 4);
  expectClose(lineTo[0].y, amplitude);
  expectClose(lineTo[1].x, (3 * segment) / 4);
  expectClose(lineTo[1].y, -amplitude);
  expectClose(lineTo[2].x, (5 * segment) / 4);
  expectClose(lineTo[2].y, amplitude);
  assert.deepEqual(lineTo.at(-1), { type: "lineTo", x: 4.1, y: 0 });
  assert.equal(lineTo.at(-2).y, 0, "PGF center finish returns to the state origin before the endpoint");
});

test("does not restart zigzag phase at a polyline corner", () => {
  const segment = parseDimension("8mm");
  const path = decoratedPath(String.raw`
\begin{tikzpicture}
  \draw[decorate, decoration={zigzag,segment length=8mm,amplitude=1.5mm}] (0,0) -- (2.15,0) -- (2.15,1.25) -- (5.5,1.25);
\end{tikzpicture}`);
  const lineTo = path.commands.filter((command) => command.type === "lineTo");
  const firstPointAfterCorner = lineTo.find((command) => command.x > 2.2 && command.y > 0 && command.y < segment / 4);

  assert.ok(firstPointAfterCorner, "expected an apex on the vertical leg");
  // A restarted decoration would put its first vertical apex at segment / 4
  // after the corner. The PGF state continues from the complete subpath.
  expectClose(firstPointAfterCorner.y, 0.05);
});
