import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { layoutNativeMath } from "../src/tex/mathBox.js";
import { tikzToSvg } from "../src/index.js";

const reference = JSON.parse(readFileSync(new URL("./fixtures/font-visual-gates/native-math-alignments.json", import.meta.url)));

test("384 MacTeX hboxes cover aligned, cases, and all standard LaTeX sizes", () => {
  assert.equal(reference.probes.length, 384);
  for (const p of reference.probes) {
    const box = layoutNativeMath(p.tex, { fontSizePt: p.sizePt, baselineSkipPt: p.baselineSkipPt,
      mathVersion: p.mathVersion, mathExtension: reference.mathExtension });
    assert.ok(box, `${p.sizePt}pt ${p.tex}`);
    for (const field of ["width", "height", "depth"]) {
      assert.ok(Math.abs(box[field] - p.native[field]) < 0.003,
        `${p.sizePt}pt ${p.mathVersion} ${p.tex}: ${field} ${box[field]} != ${p.native[field]}`);
    }
  }
});

test("aligned uses display fractions, common equals columns, and explicit baseline alignment", () => {
  const body = String.raw`x&=\frac{1}{2}\\y_i&=2`;
  const boxes = ["c", "t", "b"].map(pos => layoutNativeMath(`\\begin{aligned}[${pos}]${body}\\end{aligned}`, {mathExtension:"ams"}));
  for (const box of boxes) {
    assert.ok(box);
    const equals = box.items.filter(i => i.text === "=");
    assert.equal(equals.length, 2);
    assert.equal(equals[0].x, equals[1].x);
    assert.equal(box.items.find(i => i.text === "1").size, 10);
  }
  assert.equal(boxes[1].items.find(i => i.text === "x").y, 0);
  assert.equal(boxes[2].items.find(i => i.text === "y").y, 0);
});

test("cases keeps text roman under boldmath and uses text-style fractions", () => {
  const box = layoutNativeMath(String.raw`\begin{cases}\frac{1}{x_i}&\text{if }x>0\\0&\text{otherwise}\end{cases}`,
    { mathVersion:"bold", mathExtension:"ams" });
  assert.ok(box);
  assert.equal(box.items.find(i => i.text === "1").size, 7);
  assert.equal(box.items.find(i => i.text === "o").family, "TikZKitCMR10");
});

test("alignment and size fixtures use the same native layout in the browser and exported SVG", () => {
  for (const [id, count] of [["aligned",6], ["cases",6], ["common-math-sizes",10]]) {
    const source = readFileSync(new URL(`./fixtures/font-visual-gates/${id}.tex`, import.meta.url), "utf8");
    for (const options of [{}, {mathRenderer:"svg-text"}]) {
      const result = tikzToSvg(source, options);
      assert.deepEqual(result.diagnostics, [], id);
      assert.equal((result.svg.match(/data-math-layout="cm-tex-box"/g) || []).length, count, id);
      assert.equal((result.svg.match(/text-rendering="geometricPrecision"/g) || []).length, count, id);
      assert.ok(!result.svg.includes("foreignObject"), id);
    }
  }
});
