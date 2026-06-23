import assert from "node:assert/strict";
import test from "node:test";
import { jsCompareScale } from "../web/gallery-compare-scale.js";

test("uses diff-normalized JS scale for gallery compare panes", () => {
  assert.equal(jsCompareScale({ jsScale: 0.5736677115987461 }), 0.5736677115987461);
});

test("falls back to unit scale when a diff row has no crop metadata", () => {
  const scale = jsCompareScale({
    unit: {
      jsSvgPxPerXUnit: 100,
      nativeRasterPxPerXUnit: 56.69291338582677
    }
  });

  assert.ok(Math.abs(scale - 0.5669291338582677) < 1e-12);
});

test("ignores unsafe gallery compare scales", () => {
  assert.equal(jsCompareScale({ jsScale: 0 }), null);
  assert.equal(jsCompareScale({ jsScale: 4 }), null);
  assert.equal(jsCompareScale({ unit: { jsSvgPxPerXUnit: 0, nativeRasterPxPerXUnit: 56 } }), null);
});
