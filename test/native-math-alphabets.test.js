import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { layoutNativeMath } from "../src/tex/mathBox.js";
import { normalizeTikzText } from "../src/tikz/text.js";
import { layoutMultilineTeXText } from "../src/tikz/textMetrics.js";
import { tikzToSvg } from "../src/index.js";
import { layoutNativeText } from "../src/tex/textBox.js";

const close = (value, expected) => assert.ok(Math.abs(value - expected) < .001,
  `${value} != MacTeX ${expected}pt`);

test("literal node hboxes preserve native sentence and abbreviation spacing", () => {
  close(layoutNativeText("Env. 1").width, 29.5834);
  const word = layoutNativeText("E.").width;
  const rest = layoutNativeText(" 1").width;
  close(layoutNativeText("E. 1").width, word + rest);
  const closed = layoutNativeText("(Env.)").width;
  close(layoutNativeText("(Env.) 1").width, closed + rest + 1.11111);
});

test("CMSY primes and calligraphic letters retain native TeX hboxes", () => {
  // Measured by native-math-alphabet-metrics.tex, not browser glyph bounds.
  for (const [tex, options, width, height, depth] of [
    [String.raw`(\theta_1',\psi_1')`, {}, 32.40283, 7.51782, 2.5],
    [String.raw`(\mathcal{T},\mathcal{R})`, {}, 28.68536, 7.5, 2.5],
    [String.raw`\mathcal{T}_i`, {}, 8.77573, 6.83331, 1.49998],
    [String.raw`\mathcal{R}'`, {}, 11.2806, 7.51782, 0],
    ["f'+f''+f'''", {}, 57.6944, 7.51782, 1.94444],
    [String.raw`\theta_1'+\mathcal{T}_i+\mathcal{R}'`, { fontSizePt: 7 }, 44.5483, 5.79558, 1.99998],
    [String.raw`\theta_1'+\mathcal{T}_i+\mathcal{R}'`, { mathVersion: "bold" }, 62.08467, 7.51782, 3.0922]
  ]) {
    const box = layoutNativeMath(tex, options);
    assert.ok(box, tex);
    close(box.width, width); close(box.height, height); close(box.depth, depth);
  }
});

test("calligraphic selection is scoped and primes use the optical symbols face", () => {
  const box = layoutNativeMath(String.raw`\mathcal{T}_i+R+\mathcal{R}'`);
  assert.ok(box);
  const glyphs = box.items.filter(item => item.type === "glyph");
  assert.equal(glyphs[0].family, "TikZKitCMSY10");
  assert.equal(glyphs[1].family, "TikZKitCMMI7");
  assert.equal(glyphs.find(item => item.text === "R").family, "TikZKitCMMI10");
  assert.equal(glyphs.at(-1).text, "\u2032");
  assert.equal(glyphs.at(-1).family, "TikZKitCMSY7");
  assert.equal(glyphs.at(-1).size, 7);
  assert.equal(layoutNativeMath(String.raw`\mathcal{T_i}`), null,
    "unmapped non-capital symbols must retain the whole fallback");
});

test("mixed A3C rows use native text and math widths on the same baseline grid", () => {
  for (const [text, width, height] of [
    [String.raw`Agent 1\\$(\theta_1', \psi_1')$`, 34.4445, 18.83331],
    [String.raw`Agent $n$\\$(\theta_n', \psi_n')$`, 35.44684, 18.83331],
    [String.raw`Global state\\$(\theta, \psi)$`, 53.45844, 18.94444],
    [String.raw`Env. 1\\$(\mathcal{T}, \mathcal{R})$`, 29.5834, 18.83331]
  ]) {
    const box = layoutMultilineTeXText(normalizeTikzText(text), { sizePt: 10 });
    assert.ok(box, text);
    close(box.width, width); close(box.height, height); close(box.depth, 2.5);
  }
});

test("browser and SVG-text share multiline node geometry and native glyph paint", () => {
  const source = readFileSync(new URL("./fixtures/native-math-alphabets/rounded-agents.tex", import.meta.url), "utf8");
  const outputs = [{}, { mathRenderer: "svg-text" }].map(options => tikzToSvg(source, options));
  for (const result of outputs) {
    assert.deepEqual(result.diagnostics, []);
    const boxes = Object.fromEntries(result.ir.items.filter(item => item.type === "nodeBox").map(item => [item.id, item]));
    // Native cardinal anchors include .4pt outer sep on each side.
    for (const [id, east, north] of [["A1", 25.88829, 14.39963], ["AN", 26.38947, 14.39963],
      ["G", 35.43028, 14.45518], ["E1", 23.45775, 14.39963]]) {
      assert.ok(Math.abs(boxes[id].width * 72.27 / 2.54 - (2 * east - .8)) < .02, id);
      assert.ok(Math.abs(boxes[id].height * 72.27 / 2.54 - (2 * north - .8)) < .02, id);
    }
    assert.ok(!result.svg.includes("foreignObject"));
    assert.match(result.svg, /TikZKitCMSY7/);
    assert.match(result.svg, /TikZKitCMSY10/);
  }
  assert.deepEqual(outputs[0].ir.items, outputs[1].ir.items);
});
