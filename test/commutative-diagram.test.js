import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { nativeMathGroups } from "./helpers/native-math-svg.js";

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
  const glyphLabels = nativeMathGroups(result.svg).filter(group => group.text.startsWith("Θ"));
  assert.equal(glyphLabels.length, 4);
  assert.equal(glyphLabels.filter(group => group.text === "ΘB").length, 2);
  assert.equal(glyphLabels.filter(group => group.text === "ΘB\u2032").length, 2);
  for (const group of glyphLabels) {
    assert.equal(group.glyphs[0].family, "TikZKitCMR10");
    assert.equal(group.glyphs[1].size, 7);
    assert.ok(group.glyphs[1].y > group.glyphs[0].y);
    if (group.glyphs[2]) {
      assert.equal(group.glyphs[2].family, "TikZKitCMSY5");
      assert.ok(group.glyphs[2].y < group.glyphs[1].y);
    }
  }
  assert.doesNotMatch(result.svg, />Theta<\/tspan>/);
});
