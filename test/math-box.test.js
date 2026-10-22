import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { layoutNativeMath } from "../src/tex/mathBox.js";
import { measureMathBoxPt } from "../src/renderers/svg/mathNode.js";
import { tikzToSvg } from "../src/index.js";

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.015, `${actual} != ${expected} pt`);

test("MacTeX hboxes: Greek subscript, compound fraction, and combined scripts", () => {
  for (const [tex, width, height, depth] of [
    [String.raw`\Theta_B`, 14.6608, 6.83331, 1.49998],
    [String.raw`\frac{1}{1+e^{-x}}`, 26.19424, 8.44843, 4.28175],
    ["q_0", 8.95026, 4.3056, 1.94444],
    ["b^2", 8.77779, 8.14003, 0],
    ["c_3^n", 9.77089, 6.6428, 2.4821]
  ]) {
    const box = layoutNativeMath(tex);
    assert.ok(box, tex);
    close(box.width, width); close(box.height, height); close(box.depth, depth);
    const measured = measureMathBoxPt(tex);
    close(measured.widthPt, width); close(measured.heightPt, height); close(measured.depthPt, depth);
  }
});

test("nested math uses 10/7/5pt optical fonts, not repeatedly scaled 10pt glyphs", () => {
  const box = layoutNativeMath("x_{i_j}");
  assert.deepEqual(box.items.filter(i => i.type === "glyph").map(i => [i.text, i.size, i.family]), [
    ["x", 10, "TikZKitCMMI10"], ["i", 7, "TikZKitCMMI7"], ["j", 5, "TikZKitCMMI5"]
  ]);
  assert.deepEqual(layoutNativeMath("x_{i_j}", { fontSizePt: 7 }).items.map(i => i.size), [7, 5, 5]);
});

test("math styles are scoped and unsupported syntax keeps the complete old renderer", () => {
  const box = layoutNativeMath(String.raw`x_i+{\scriptstyle y_j}+z_k`);
  assert.equal(box.items.find(i => i.text === "z").size, 10);
  assert.equal(layoutNativeMath(String.raw`\frac{1}{\hat{x}}`), null);
  assert.equal(layoutNativeMath("x_i", { mathVersion: "sans" }), null);
  assert.equal(layoutNativeMath("x_i", { fontSizePt: 13 }), null);
});

test("default browser and export share baseline-positioned CM formula glyphs", () => {
  const source = String.raw`\begin{tikzpicture}\node[anchor=base,draw] {$\Theta_B+\frac{1}{1+e^{-x}}$};\end{tikzpicture}`;
  for (const options of [{}, { mathRenderer: "svg-text" }]) {
    const result = tikzToSvg(source, options);
    assert.deepEqual(result.diagnostics, []);
    assert.ok(result.svg.includes('data-math-layout="cm-tex-box"'));
    assert.ok(result.svg.includes("TikZKitCMMI5"));
    assert.ok(!result.svg.includes("foreignObject"));
  }
});

test("native MacTeX hbox corpus covers nested fractions and scripts at every supported size", () => {
  const reference = JSON.parse(readFileSync(new URL("./fixtures/font-visual-gates/native-math-boxes.json", import.meta.url), "utf8"));
  assert.equal(reference.probes.length, 57);
  for (const probe of reference.probes) {
    const box = layoutNativeMath(probe.tex, { fontSizePt: probe.sizePt, mathExtension: "ams" });
    assert.ok(box, probe.tex);
    for (const field of ["width", "height", "depth"]) {
      close(box[field], probe.native[`${field}Pt`]);
    }
  }
});

test("AMS optical extension fonts and cmex10 select distinct small-font fraction rules", () => {
  for (const [packages, profile, thickness] of [
    ["", "fixed", 0.39999],
    [String.raw`\usepackage{amsmath}`, "ams", 0.33999],
    [String.raw`\usepackage[cmex10]{amsmath}`, "fixed", 0.39999]
  ]) {
    const result = tikzToSvg(packages + String.raw`\begin{tikzpicture}\node[font=\scriptsize] {$\frac{1}{1+x_i}$};\end{tikzpicture}`);
    const item = result.ir.items.find(item => item.type === "textNode");
    assert.equal(item.font.mathExtension ?? "fixed", profile);
    const box = layoutNativeMath(String.raw`\frac{1}{1+x_i}`, { fontSizePt: 7, mathExtension: profile });
    close(box.items.find(item => item.type === "rule").height, thickness);
    assert.ok(result.svg.includes(`height="${profile === "ams" ? "0.339994" : "0.39999"}"`));
  }
});

test("native formula nodes honor zero padding, baselines, and stroke centerlines", () => {
  const source = String.raw`\begin{tikzpicture}\node[anchor=base west,draw,inner sep=0pt] (N) at (2,3) {$x_i$};\end{tikzpicture}`;
  const result = tikzToSvg(source);
  const box = layoutNativeMath("x_i");
  const shape = result.ir.items.find(item => item.type === "nodeBox");
  close(shape.height * 28.4527559, box.height + box.depth);
  close(shape.width * 28.4527559, box.width);
  assert.equal(shape.strokeBoundsIncluded, false);
  const transform = result.svg.match(/data-math-layout="cm-tex-box" transform="translate\(([-\d.]+) ([-\d.]+)\)/);
  assert.ok(transform);
  assert.ok(Math.abs(Number(transform[2]) + 300) < 0.001, "base anchor must preserve y=3cm");
});
