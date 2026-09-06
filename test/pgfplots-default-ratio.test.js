import test from "node:test";
import assert from "node:assert/strict";
import { createAxisGeometry } from "../src/pgfplots/geometry.js";

test("an explicit default plot box ratio leaves 3D sizing unchanged", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 };
  for (const width of ["5cm", "8cm"]) {
    const options = { width, "pgfplots 3d surface": true, view: "{25}{30}" };
    const implicit = createAxisGeometry(options, ranges);
    for (const ratio of ["1 1 1", "{1}{1}{1}", "{sqrt(4)/2}{1}{1}", "2 2 2"]) {
      const explicit = createAxisGeometry({ ...options, "plot box ratio": ratio }, ranges);
      assert.equal(implicit.width, explicit.width);
      assert.equal(implicit.height, explicit.height);
      const point = { x: 0.5, y: 0.25, z: 0.75 };
      assert.deepEqual(implicit.mapPoint3d(point), explicit.mapPoint3d(point));
    }
  }
});
