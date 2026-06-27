import assert from "node:assert/strict";
import test from "node:test";
import { normalizeColor, parseOptions } from "../src/options.js";

test("resolves TikZ color mixes to concrete SVG colors", () => {
  assert.equal(normalizeColor("red!30"), "rgb(255 179 179)");
  assert.equal(normalizeColor("green!50"), "rgb(128 255 128)");
  assert.equal(normalizeColor("gray!40"), "rgb(204 204 204)");
  assert.equal(normalizeColor("teal!30"), "rgb(179 217 217)");
  assert.equal(normalizeColor("DarkRed!10"), "rgb(243 230 230)");
  assert.equal(normalizeColor("DarkBlue!10"), "rgb(230 230 243)");
  assert.equal(normalizeColor("LightSteelBlue"), "LightSteelBlue");
  assert.equal(normalizeColor("DimGray"), "DimGray");
  assert.doesNotMatch(normalizeColor("blue!60"), /color-mix/);
});

test("keeps repeated name intersections options in order", () => {
  const options = parseOptions("name intersections={of=a and b, name=i}, name intersections={of=c and d, name=j}");
  assert.deepEqual(options["name intersections"], ["of=a and b, name=i", "of=c and d, name=j"]);
});
