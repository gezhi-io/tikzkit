import assert from "node:assert/strict";
import test from "node:test";

import { computeSvgBounds } from "../src/renderers/svg/bounds.js";
import { blurShadowBoundsPadding, blurShadowStdDeviation } from "../src/renderers/svg/defs.js";

test("maps pgf-blur radius to a 2r canvas margin and 2r/3 SVG sigma", () => {
  assert.equal(blurShadowBoundsPadding(0.1), 0.2);
  assert.ok(Math.abs(blurShadowStdDeviation(0.1, 100) - (20 / 3)) < 1e-12);

  const bounds = computeSvgBounds([
    {
      type: "nodeBox",
      x: 0,
      y: 0,
      width: 2,
      height: 1,
      style: {},
      shadows: [{ blur: true, blurRadius: 0.1, scale: 1, xshift: 0, yshift: 0 }]
    }
  ]);

  assert.ok(Math.abs(bounds.minX + 1.2) < 1e-12);
  assert.ok(Math.abs(bounds.maxX - 1.2) < 1e-12);
  assert.ok(Math.abs(bounds.minY + 0.7) < 1e-12);
  assert.ok(Math.abs(bounds.maxY - 0.7) < 1e-12);
});
