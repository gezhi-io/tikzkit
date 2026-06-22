import assert from "node:assert/strict";
import test from "node:test";
import { normalizeColor } from "../src/options.js";

test("resolves TikZ color mixes to concrete SVG colors", () => {
  assert.equal(normalizeColor("red!30"), "rgb(255 179 179)");
  assert.equal(normalizeColor("green!50"), "rgb(128 255 128)");
  assert.equal(normalizeColor("gray!40"), "rgb(204 204 204)");
  assert.doesNotMatch(normalizeColor("blue!60"), /color-mix/);
});
