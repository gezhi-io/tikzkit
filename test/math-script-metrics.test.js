import assert from "node:assert/strict";
import test from "node:test";

import { estimateFormulaBox } from "../src/tikz/textMetrics.js";

test("measures a one-letter math subscript with the math-italic base advance", () => {
  const q0 = estimateFormulaBox("q_0", { texTextMetrics: true, widthPadding: 0, minWidth: 0 });
  const ptPerCm = 28.45274;

  // Values are measured directly from local pdfTeX with
  // \setbox0=\hbox{$q_0$}; the script uses cmr7 plus TeX scriptspace.
  assert.ok(Math.abs(q0.width * ptPerCm - 8.95026) < 0.02, `unexpected q_0 width: ${q0.width * ptPerCm}pt`);
  assert.ok(Math.abs(q0.height * ptPerCm - 4.3056) < 0.02, `unexpected q_0 height: ${q0.height * ptPerCm}pt`);
  assert.ok(Math.abs(q0.depth * ptPerCm - 1.94444) < 0.02, `unexpected q_0 depth: ${q0.depth * ptPerCm}pt`);
});

test("matches local TeX boxes for superscript and combined scripts", () => {
  const ptPerCm = 28.45274;
  const superscript = estimateFormulaBox("b^2", { texTextMetrics: true, widthPadding: 0, minWidth: 0 });
  const combined = estimateFormulaBox("c_3^n", { texTextMetrics: true, widthPadding: 0, minWidth: 0 });

  assert.ok(Math.abs(superscript.width * ptPerCm - 8.77779) < 0.02);
  assert.ok(Math.abs(superscript.height * ptPerCm - 8.14003) < 0.02);
  assert.ok(Math.abs(superscript.depth * ptPerCm) < 0.02);

  assert.ok(Math.abs(combined.width * ptPerCm - 9.77089) < 0.02);
  assert.ok(Math.abs(combined.height * ptPerCm - 6.6428) < 0.02);
  assert.ok(Math.abs(combined.depth * ptPerCm - 2.4821) < 0.02);
});

test("uses TeX sequence spacing for subscript lists ending in dots", () => {
  const sequence = estimateFormulaBox(String.raw`a_1,a_2,\ldots`, {
    texTextMetrics: true,
    widthPadding: 0,
    minWidth: 0
  });
  const ptPerCm = 28.45274;

  assert.ok(
    Math.abs(sequence.width * ptPerCm - 40.09947) < 0.02,
    `unexpected sequence width: ${sequence.width * ptPerCm}pt`
  );
  assert.ok(Math.abs(sequence.height * ptPerCm - 4.3056) < 0.02);
  assert.ok(Math.abs(sequence.depth * ptPerCm - 1.9444) < 0.02);
});
