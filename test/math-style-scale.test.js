import assert from "node:assert/strict";
import test from "node:test";

import { mathStyleScale } from "../src/renderers/svg/mathNode.js";

test("uses LaTeX's distinct normal, script, and scriptscript math sizes", () => {
  assert.equal(mathStyleScale("x"), 1);
  assert.equal(mathStyleScale(String.raw`\scriptstyle x`), 0.7);
  assert.equal(mathStyleScale(String.raw`\scriptscriptstyle x`), 0.5);
  assert.equal(mathStyleScale(String.raw`\scriptscriptstyle x`, 5), 1);
});
