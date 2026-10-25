import assert from "node:assert/strict";
import test from "node:test";
import { compareSurfacePaint } from "../scripts/browser-surface-paint-metrics.js";

const faces = [{ x: 10, y: 20, width: 4, height: 8, rgb: [64,128,200] },
  { x: 20, y: 20, width: 4, height: 8, rgb: [128,64,100] }];
test("surface paint comparison pairs geometry rather than searching for a matching color elsewhere", () => {
  assert.ok(compareSurfacePaint([...faces].reverse(), faces).accepted);
  const swapped = faces.map((face, i) => ({ ...face, rgb: faces[1 - i].rgb }));
  assert.equal(compareSurfacePaint(swapped, faces).accepted, false);
  assert.equal(compareSurfacePaint(faces.slice(1), faces).accepted, false);
  assert.equal(compareSurfacePaint([], []).accepted, false);
  assert.equal(compareSurfacePaint(faces.map(face => ({ ...face, x: face.x + 2 })), faces).accepted, false);
});
