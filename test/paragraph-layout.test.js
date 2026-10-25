import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { tikzToSvg, tikzToSvgAsync } from "../src/index.js";
import { normalizeTikzText } from "../src/tikz/text.js";
import { nativePlainTextBox } from "../src/renderers/svg/plainTextNode.js";
import { wrapRichTextLines } from "../src/renderers/svg/richText.js";
import { layoutNativeParagraph, nativeParagraphLines } from "../src/tex/paragraphBox.js";
import { englishHyphenationPoints } from "../src/tex/hyphenation.js";
import { nativeMathFont } from "../src/tex/mathFonts.js";

const paragraph = String.raw`When $\alpha = \gamma$, keep the relation with its explanatory sentence so the block wraps naturally.`;
const expected = ["When $\\alpha = \\gamma$, keep the re-", "lation with its explanatory", "sentence so the block wraps", "naturally."];
const widthCm = 345 * 0.35 / 28.4527559;

test("CM metrics keep the first matching TFM kern instruction", () => {
  // Local tftopl: v/k match a at -.055555 before the shared w program
  // offers the same right character at -.027779. TeX stops at the first.
  for (const letter of ["v", "k"]) {
    assert.ok(Math.abs(nativeMathFont("CMR", 10).kern[letter].a + 0.055555) < 0.000001);
  }
});

test("paragraph breaks follow native optical metrics and English language-zero patterns", () => {
  assert.deepEqual(englishHyphenationPoints("explanatory"), [2, 7]);
  assert.deepEqual(englishHyphenationPoints("naturally"), [3, 4]);
  assert.deepEqual(englishHyphenationPoints("projects"), []);
  const lines = [
    [9, ["When $\\alpha = \\gamma$, keep the relation", "with its explanatory sentence", "so the block wraps naturally."]],
    [10, expected],
    [12, ["When $\\alpha = \\gamma$, keep", "the relation with its ex-", "planatory sentence so", "the block wraps natu-", "rally."]]
  ];
  for (const [sizePt, expectedLines] of lines) {
    assert.deepEqual(nativeParagraphLines(paragraph, { sizePt }, 4.25 * 28.4527559), expectedLines);
  }
});

test("browser rich paragraphs receive the same minipage line-breaking options as SVG-text", () => {
  const normalized = normalizeTikzText(paragraph);
  const lines = wrapRichTextLines([paragraph], widthCm, 28.4527559, 10, normalized.lineStyles, { lineBreakMode: "flush" });
  assert.deepEqual(lines.map(line => line.text), expected);
});

test("native paragraph boxes retain CM glyphs, 12pt baselines and justified nonfinal lines", () => {
  const box = nativePlainTextBox({ wrapWidth: widthCm, textWrapMode: "flush",
    font: { sizePt: 10, baselineSkipPt: 12, family: "serif" } }, normalizeTikzText(paragraph));
  assert.ok(box, "expected a native paragraph box instead of unrelated HTML line boxes");
  assert.ok(Math.abs(box.width - 120.75) < 1e-6);
  assert.deepEqual(box.rows.map(row => row.baseline), [0, 12, 24, 36]);
  assert.ok(box.rows.slice(0, -1).every(row => Math.abs(row.width - box.width) < 1e-6));
  assert.ok(box.rows.at(-1).width < box.width);
  assert.ok(box.items.filter(item => item.type === "glyph").every(item => /^TikZKitCM/.test(item.family)));
  assert.equal(box.items.filter(item => item.type === "glyph").map(item => item.text).join(""),
    "Whenα=γ,keepthere-lationwithitsexplanatorysentencesotheblockwrapsnaturally.");
});

test("badly centered paragraphs shrink ordinary glue before positioning an overwide line", () => {
  const box = layoutNativeParagraph(["a intersect"], { sizePt: 10 }, 45, "center");
  assert.ok(Math.abs(box.rows[0].width - 45) < 1e-6);
  assert.ok(Math.abs(box.items[0].x) < 1e-6);
  // Native hbox: 5.00002pt 'a', then 3.33333pt glue shrunk by 0.36124pt.
  assert.ok(Math.abs(box.items[1].x - 7.97211) < 0.0001);
  const overfull = layoutNativeParagraph(["unbreakable"], { sizePt: 10 }, 10, "center");
  assert.equal(overfull.items[0].x, 0, "overfull ink extends right; flush glue does not become negative");
});

test("paragraph line-breaking scores natural widths before word and math glue are packed", () => {
  const source = String.raw`Take $x_i^2 + y_i^2 = r^2$ and compare these values with $\frac{1}{1+x}$ in the next calculation.`;
  assert.deepEqual(nativeParagraphLines(source, { sizePt: 10 }, 4.25 * 28.4527559), [
    String.raw`Take $x_i^2 + y_i^2 = r^2$ and com-`,
    String.raw`pare these values with $\frac{1}{1+x}$`,
    "in the next calculation."
  ]);
});

test("real minipage uses identical native paragraph paint in browser, SVG-text and async output", async () => {
  const source = readFileSync(new URL("./fixtures/implementation-examples/real-world/minipage-text-width.tex", import.meta.url), "utf8");
  const results = [tikzToSvg(source), tikzToSvg(source, { mathRenderer: "svg-text" }), await tikzToSvgAsync(source)];
  for (const result of results) {
    assert.deepEqual(result.diagnostics, []);
    assert.ok(/class="tikz-text-native"/.test(result.svg), "expected native paragraph paint");
    assert.ok(!/<foreignObject\b/.test(result.svg), "supported paragraphs must not use a different HTML layout");
  }
  assert.ok(results[0].svg === results[1].svg, "browser and SVG-text paint must agree");
  assert.ok(results[0].svg === results[2].svg, "sync and async paint must agree");
});

for (const fixture of ["sizes", "formulas"]) {
  test(`minipage ${fixture} node dimensions use the same logical paragraph box as painting`, () => {
    const source = readFileSync(new URL(`./fixtures/paragraph-native/${fixture}.tex`, import.meta.url), "utf8");
    const result = tikzToSvg(source);
    assert.deepEqual(result.diagnostics, []);
    const nodes = result.ir.items.filter(item => item.type === "textNode");
    assert.equal(nodes.length, fixture === "sizes" ? 3 : 2);
    for (const node of nodes) {
      const box = nativePlainTextBox(node, normalizeTikzText(node.text));
      assert.ok(box);
      const expectedHeight = (box.height + box.depth + 2 * 4.30554) / 28.4527559;
      assert.ok(Math.abs(node.nodeLayoutHeight - expectedHeight) < 0.0001,
        `paragraph at ${node.font.sizePt}pt: node ${node.nodeLayoutHeight}, packed box ${expectedHeight}`);
    }
  });
}
