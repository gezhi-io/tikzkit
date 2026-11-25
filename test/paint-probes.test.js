import assert from "node:assert/strict";
import test from "node:test";
import { comparePaintProbes } from "../scripts/compare-native-paint-probes.mjs";

test("paint probes reject empty references, double ink, shifted paint and wrong page size", () => {
  const spec = { referenceSize: [4, 3], probes: {
    crossing: { uv: [0.65, 0.5], rgb: "#9999ff" }, hole: { px: [0, 1], rgb: "#ffffff" }
  } };
  function paper(width, x, color = [153, 153, 255]) {
    const data = Buffer.alloc(width * 3 * 4, 255);
    if (x !== null) data.set(color, (width + x) * 4);
    return { width, height: 3, data };
  }
  const native = paper(4, 2), blank = paper(4, null);
  const compare = candidate => comparePaintProbes(native, candidate, spec);
  assert.equal(compare(paper(4, 2)).passed, true);
  assert.equal(comparePaintProbes(blank, blank, spec).passed, false);
  assert.equal(compare(paper(4, 2, [92, 92, 255])).passed, false);
  assert.equal(compare(paper(4, 3)).passed, false);
  const wider = compare(paper(8, 2));
  assert.ok(wider.checks.every(c => c.passed)); // Same physical pixels, wrong page.
  assert.equal(wider.passed, false);
  assert.equal(compare(paper(8, 5)).checks[0].actual, "#ffffff"); // Never rescale into the wider page.
});
