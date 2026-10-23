import assert from "node:assert/strict";
import test from "node:test";
import { layoutNativeMath } from "../src/tex/mathBox.js";
import { tikzToSvg } from "../src/index.js";
import { nativeMathGroups } from "./helpers/native-math-svg.js";
import { relativeMathParseOptions } from "../src/tex/relativeMath.js";

const larger = (text, count) => count ? larger(`\\mathlarger{${text}}`, count - 1) : text;

test("relsize steps math styles before increasing the NFSS text size", () => {
  for (const [count, expected] of [[1,10],[2,12],[3,14.4],[4,17.28],[5,20.74]]) {
    const box = layoutNativeMath(larger("\\times", count));
    assert.ok(box, `missing native relative math box at depth ${count}`);
    assert.equal(box.items.find(item => item.type === "glyph").size, expected);
  }
});

test("relative math sizes affect only the wrapped atom", () => {
  const box = layoutNativeMath(`a+${larger("\\bm{\\times}", 5)}+b`);
  assert.ok(box);
  const glyphs = box.items.filter(item => item.type === "glyph");
  assert.deepEqual(glyphs.map(item => item.size), [10,10,20.74,10,10]);
  assert.ok(glyphs[2].family.includes("CMBSY"));
});

test("relative math sizes respect script style and the scriptscript floor", () => {
  for (const [source, expected] of [
    ["\\scriptstyle \\mathlarger{x}",10],
    ["\\scriptscriptstyle \\mathlarger{x}",7],
    ["\\mathsmaller{x}",7],
    ["\\mathsmaller{\\mathsmaller{x}}",5],
    ["\\mathsmaller{\\mathsmaller{\\mathsmaller{x}}}",5]
  ]) {
    const box = layoutNativeMath(source);
    assert.ok(box, source);
    assert.equal(box.items.find(item => item.type === "glyph").size, expected, source);
  }
});

test("nested larger bold markers use the same native box in browser and SVG-text modes", () => {
  const source = String.raw`\begin{tikzpicture}\node {$` + larger("\\bm{\\times}",5) + String.raw`$};\end{tikzpicture}`;
  const standard = tikzToSvg(source);
  const exported = tikzToSvg(source, { mathRenderer: "svg-text" });
  assert.deepEqual(standard.diagnostics, []);
  assert.deepEqual(exported.diagnostics, []);
  const [group] = nativeMathGroups(standard.svg);
  assert.ok(group);
  assert.equal(group.glyphs[0].size, 20.74);
  assert.deepEqual(nativeMathGroups(exported.svg), [group]);
});

test("relative-size parsing trusts only its two inert math wrappers", () => {
  const { trust } = relativeMathParseOptions;
  assert.equal(trust({ command: "\\htmlClass", class: "tikzkit-mathlarger" }), true);
  assert.equal(trust({ command: "\\htmlClass", class: "tikzkit-mathsmaller" }), true);
  for (const name of ["constructor", "__proto__", "unrelated", "tikzkit-mathlarger other"]) {
    assert.equal(trust({ command: "\\htmlClass", class: name }), false);
  }
  assert.equal(trust({ command: "\\href", class: "tikzkit-mathlarger" }), false);
});

test("unpainted baseline side anchors retain PGF outer xsep", () => {
  for (const anchor of ["base west", "base east", "mid west", "mid east"]) {
    for (const [options, separation] of [["", .2], ["line width=2pt,", 1], ["outer sep=0pt,", 0]]) {
      const result = tikzToSvg("\\begin{tikzpicture}\\node[" + options + "anchor=" + anchor +
        ",inner sep=0pt] at (0,0) {$\\mathlarger{x}$};\\end{tikzpicture}");
      assert.deepEqual(result.diagnostics, []);
      const node = result.ir.items.find(item => item.type === "textNode");
      const offset = Math.abs(node.x) - node.nodeLayoutWidth / 2;
      assert.ok(Math.abs(offset * 28.4527559 - separation) < .00001, anchor + "/" + options + ": " + offset);
    }
  }
});
