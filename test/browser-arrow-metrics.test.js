import assert from "node:assert/strict";
import test from "node:test";
import { compareArrowPaint } from "../scripts/browser-arrow-metrics.js";

test("browser arrow gate rejects missing paint, wrong curves, strokes, directions and crops", () => {
  const ref = { width: 100, height: 20, paths: [{ points: [{ x: 0, y: 1 }, { x: 99, y: 1 }],
    strokeWidth: 1, penWidths: [1, 1, 1, 1], cap: "round", join: "round", dash: [] }] };
  assert.equal(compareArrowPaint(ref, ref).accepted, true);
  for (const change of [a => a.paths.pop(), a => a.paths[0].points[0].y++, a => a.paths[0].points.reverse(),
    a => a.paths[0].strokeWidth++, a => a.paths[0].penWidths[1]++,
    a => a.paths[0].cap = "butt", a => a.width++, a => a.paths[0].dash.push(1)]) {
    const actual = structuredClone(ref);
    change(actual);
    assert.equal(compareArrowPaint(actual, ref).accepted, false);
  }
  assert.equal(compareArrowPaint({ ...ref, paths: [] }, { ...ref, paths: [] }).accepted, false);
});
