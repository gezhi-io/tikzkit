import assert from "node:assert/strict";
import test from "node:test";
import { compareDecorationBounds } from "../scripts/browser-decoration-bounds-metrics.js";

const reference = { width: 400, height: 390, glyphs: 150, overflowPx: 0 };
test("decoration browser gate accepts matching physical canvas dimensions", () => {
  assert.equal(compareDecorationBounds({ ...reference, height: 390.03 }, reference).accepted, true);
});
test("decoration browser gate rejects clipped paint even on a matching canvas", () => {
  assert.equal(compareDecorationBounds({ ...reference, overflowPx: 1 }, reference).accepted, false);
});
test("decoration browser gate rejects resized or empty output", () => {
  assert.equal(compareDecorationBounds({ ...reference, width: 380 }, reference).accepted, false);
  assert.equal(compareDecorationBounds({ ...reference, glyphs: 0 }, reference).accepted, false);
  assert.equal(compareDecorationBounds({ ...reference, width: NaN }, reference).accepted, false);
});
test("space-only controls still require native canvas dimensions", () => {
  const empty = { ...reference, glyphs: 0 };
  assert.equal(compareDecorationBounds(empty, empty, { allowEmpty: true }).accepted, true);
  assert.equal(compareDecorationBounds({ ...empty, height: 1 }, empty, { allowEmpty: true }).accepted, false);
});
