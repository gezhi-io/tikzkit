import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { parseDimension } from "../src/math.js";

test("matches native circle sizing for real multi-line units nicefrac nodes", () => {
  const source = readFileSync(
    new URL("./fixtures/examples/latex-examples/hidden-markov-model-abc-2.tex", import.meta.url),
    "utf8"
  );
  const { ir, diagnostics } = tikzToSvg(source);
  const circles = ir.items.filter(
    (item) => item.type === "nodeBox" && ["x", "y", "z"].includes(item.id)
  );
  const nativeDiameter = parseDimension("42.93pt");

  assert.deepEqual(diagnostics, []);
  assert.equal(circles.length, 3);
  for (const circle of circles) {
    // TikZ's circle shape uses the diagonal of the actual TeX text box.
    // TeX Live 2025/tikztosvg emits a 21.465pt radius for this fixture.
    assert.ok(
      Math.abs(circle.width - nativeDiameter) < 0.025,
      `${circle.id}: expected ${circle.width} to match ${nativeDiameter}`
    );
    assert.equal(circle.width, circle.height);
  }
});
