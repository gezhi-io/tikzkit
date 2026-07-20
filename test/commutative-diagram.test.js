import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

const SOURCE = readFileSync(
  new URL("fixtures/examples/latex-examples/commutative-diagram.tex", import.meta.url),
  "utf8"
);

test("commutative diagram positions nodes, renders math edge labels, and fits both ellipses", () => {
  const result = tikzToSvg(SOURCE, { mathRenderer: "svg-text" });
  const edgeLabels = result.ir.items.filter(
    (item) => item.type === "textNode" && item.text.startsWith("$\\Theta")
  );
  const fitEllipses = result.ir.items.filter(
    (item) => item.type === "nodeBox" && item.shape === "ellipse"
  );

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    [result.ir.coordinates.Phi, result.ir.coordinates.W, result.ir.coordinates.Kn, result.ir.coordinates.Km]
      .map(({ x, y }) => [x, y]),
    [[0, 0], [2, 0], [0, -2], [2, -2]]
  );
  assert.equal(edgeLabels.length, 4);
  assert.equal(fitEllipses.length, 2);
  assert.match(result.svg, />Θ<\/tspan>/);
  assert.doesNotMatch(result.svg, />Theta<\/tspan>/);
});
