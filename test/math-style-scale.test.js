import assert from "node:assert/strict";
import test from "node:test";

import { mathStyleScale, scopedMathForeignObjectBox } from "../src/renderers/svg/mathNode.js";
import { measureScopedMathExtents } from "../src/renderers/svg/mathHtml.js";

test("uses LaTeX's distinct normal, script, and scriptscript math sizes", () => {
  assert.equal(mathStyleScale("x"), 1);
  assert.equal(mathStyleScale(String.raw`\displaystyle x`), 1);
  assert.equal(mathStyleScale(String.raw`\displaystyle x`, 12), 1);
  assert.equal(mathStyleScale(String.raw`\scriptstyle x`), 0.7);
  assert.equal(mathStyleScale(String.raw`\scriptscriptstyle x`), 0.5);
  assert.equal(mathStyleScale(String.raw`\scriptscriptstyle x`, 5), 1);
});

test("display operator limits fit the math foreignObject without enlarging the text font", () => {
  const tex = String.raw`\displaystyle\sum_{i=1}^n x_i + \int_0^1 x\,dx`;
  const extents = measureScopedMathExtents(tex);
  assert.ok(extents.height + extents.depth > 2.8);
  const box = scopedMathForeignObjectBox({ width: 100, height: 20, fontSize: 10 }, false, tex);
  assert.ok(box.height >= (extents.height + extents.depth) * 10);
});
