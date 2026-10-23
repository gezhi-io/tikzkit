import assert from "node:assert/strict";
import test from "node:test";
import { compareCrossOuts } from "../scripts/browser-cross-out-metrics.js";

const cross = { x: 20, y: 40, width: 8, height: 8, strokeWidth: 2, rgb: [128, 128, 128] };
const reference = { width: 100, height: 100, crosses: [cross, cross] };

test("browser cross gate retains coincident endpoint multiplicity", () => {
  assert.equal(compareCrossOuts(reference, reference).accepted, true);
  assert.equal(compareCrossOuts({ ...reference, crosses: [cross] }, reference).accepted, false);
  assert.equal(compareCrossOuts({ ...reference, crosses: [] }, reference).accepted, false);
});

test("browser cross gate rejects displaced, resized, recolored or restroked markers", () => {
  for (const override of [{ x: 21 }, { y: 41 }, { width: 9 }, { height: 9 },
    { strokeWidth: 3 }, { rgb: [0, 0, 0] }]) {
    const actual = { ...reference, crosses: [cross, { ...cross, ...override }] };
    assert.equal(compareCrossOuts(actual, reference).accepted, false, JSON.stringify(override));
  }
});

test("browser cross gate checks the entire canvas without fitting or translation", () => {
  assert.equal(compareCrossOuts({ ...reference, height: 101 }, reference).accepted, false);
  const actual = { ...reference, crosses: reference.crosses.map(c => ({ ...c, x: c.x + 0.03 })) };
  assert.equal(compareCrossOuts(actual, reference).accepted, true);
});
