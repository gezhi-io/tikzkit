import assert from "node:assert/strict";
import test from "node:test";
import { compareTubeStrokes } from "../scripts/browser-tube-metrics.js";

const stroke = points => ({points, stroke: "rgb(0, 0, 0)", cap: "butt", join: "miter", width: .8, dash: []});
const a = {x: 0, y: 0}, b = {x: 1, y: 0}, c = {x: 2, y: 0};

test("tube browser comparison permits only path regrouping, not missing geometry", () => {
  const native = [stroke([a, b, c])];
  assert.equal(compareTubeStrokes([stroke([a, b]), stroke([b, c])], native).accepted, true);
  assert.equal(compareTubeStrokes([stroke([a, b])], native).accepted, false);
  assert.equal(compareTubeStrokes([stroke([a, b, {x: 2, y: .2}])], native).accepted, false);
  assert.equal(compareTubeStrokes([], []).accepted, false);
});

test("tube browser comparison rejects incorrect pen width and border dashes", () => {
  const native = [stroke([a, b])];
  assert.equal(compareTubeStrokes([{...native[0], width: .4}], native).accepted, false);
  assert.equal(compareTubeStrokes([{...native[0], dash: [1, 1]}], native).accepted, false);
});
