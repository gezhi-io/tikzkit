import assert from "node:assert/strict";
import test from "node:test";

import { estimateFormulaBox } from "../src/tikz/textMetrics.js";

test("measures a one-letter math subscript with the math-italic base advance", () => {
  const q0 = estimateFormulaBox("q_0", { texTextMetrics: true, widthPadding: 0, minWidth: 0 });
  const ptPerCm = 28.45274;

  // `q` is taken from cmmi10 while the subscript digit comes from cmr7.
  // This matches the TeX box consumed by PGF's geometric diamond shape.
  assert.ok(Math.abs(q0.width * ptPerCm - 7.9641) < 0.02, `unexpected q_0 width: ${q0.width * ptPerCm}pt`);
  assert.ok(Math.abs(q0.height * ptPerCm - 4.3056) < 0.02, `unexpected q_0 height: ${q0.height * ptPerCm}pt`);
  assert.ok(Math.abs(q0.depth * ptPerCm - 2.96108) < 0.02, `unexpected q_0 depth: ${q0.depth * ptPerCm}pt`);
});
