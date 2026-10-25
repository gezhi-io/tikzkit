import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { layoutNativeMath } from "../src/tex/mathBox.js";
import { tikzToSvg } from "../src/index.js";
import { normalizeTikzText } from "../src/tikz/text.js";
import { nativePlainTextBox } from "../src/renderers/svg/plainTextNode.js";

test("CMSY double bars preserve ordinary, binary and relation spacing", () => {
  const boxes = [String.raw`A\|B`, String.raw`A\mathbin{\|}B`, String.raw`A\parallel B`]
    .map(tex => layoutNativeMath(tex));
  assert.ok(boxes.every(Boolean));
  assert.ok(boxes.every(box => box.items[1].text === "\u2016" && box.items[1].family === "TikZKitCMSY10"));
  assert.ok(Math.abs(boxes[1].width - boxes[0].width - 40 / 9) < .0001);
  assert.ok(Math.abs(boxes[2].width - boxes[0].width - 50 / 9) < .0001);
});

test("mixed paragraphs break after a binary noad without changing its native spacing", () => {
  const source = readFileSync(new URL("./fixtures/remaining-layout-failures/html-spacing.tex", import.meta.url), "utf8");
  for (const options of [{}, { mathRenderer: "svg-text" }]) {
    const result = tikzToSvg(source, options);
    assert.deepEqual(result.diagnostics, []);
    assert.ok(!result.svg.includes("<foreignObject"));
    const node = result.ir.items.find(item => item.type === "textNode");
    const box = nativePlainTextBox(node, normalizeTikzText(node.text));
    assert.ok(box);
    assert.equal(box.rows.length, 2);
    const first = box.items.filter(item => item.y === box.items[0].y).map(item => item.text).join("");
    assert.equal(first, "WhenABandCDareparallel,i.e.,AB\u2016");
    assert.equal(box.items.slice(-3).map(item => item.text).join(""), "CD.");
  }
});

test("colored parallel prose retains MacTeX's three lines in both rendering modes", () => {
  const source = readFileSync(new URL("./fixtures/visual-followups/colored-parallel-paragraph.tex", import.meta.url), "utf8");
  for (const options of [{}, { mathRenderer: "svg-text" }]) {
    const result = tikzToSvg(source, options);
    assert.deepEqual(result.diagnostics, []);
    assert.ok(!result.svg.includes("<foreignObject"));
    const node = result.ir.items.find(item => item.type === "textNode");
    const box = nativePlainTextBox(node, normalizeTikzText(node.text));
    assert.deepEqual([...new Set(box.items.map(item => item.y))].map(y => ({
      y, text: box.items.filter(item => item.y === y).map(item => item.text).join("")
    })), [
      { y: 0, text: "WhenweassumethatABandCD" },
      { y: 12, text: "areparallel,i.e.,AB\u2016CD,then\u03b1=\u03b3" },
      { y: 24, text: "and\u03b2=\u03b4." }
    ]);
  }
});
