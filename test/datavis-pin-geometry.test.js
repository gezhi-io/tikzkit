import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

test("a datavis pin uses one sampled canvas point for normal and leader geometry", () => {
  const source = readFileSync(new URL("./fixtures/datavis-failure-audit/school-book-pin.tex", import.meta.url), "utf8");
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  const edge = result.ir.items.find(item => item.subtype === "axis-pin-edge");
  assert.ok(edge);
  // MacTeX's label visualizer records the first sample reaching the threshold,
  // shifts its auto-anchored node along the screen normal, then clips the edge
  // to that node. Native PDF coordinates divided by 72/2.54 give these cm.
  const [start, end] = edge.commands;
  assert.ok(Math.abs(start.x - 1.625) < 0.002);
  assert.ok(Math.abs(start.y - 0.425) < 0.002);
  assert.ok(Math.abs(end.x - 1.80757) < 0.005, `pin endpoint x=${end.x}`);
  assert.ok(Math.abs(end.y - 0.87023) < 0.005, `pin endpoint y=${end.y}`);
  assert.equal(edge.style.stroke, "gray");
});
