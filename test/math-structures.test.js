import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { layoutNativeMath } from "../src/tex/mathBox.js";
import { tikzToSvg } from "../src/index.js";

test("radicals select native CM pieces and share fraction/script layout", () => {
  for (const tex of [String.raw`\sqrt{x}`, String.raw`\sqrt[3]{1+x_i^2}`, String.raw`\sqrt{\frac{1}{x}}`]) {
    assert.ok(layoutNativeMath(tex), tex);
  }
});

test("matrix rows, columns, and delimiters have native hboxes", () => {
  const box = layoutNativeMath(String.raw`A=\begin{pmatrix}2&1\\0&3\end{pmatrix}`);
  assert.ok(box);
  assert.equal(box.items.filter(i => ["2", "1", "0", "3"].includes(i.text)).length, 4);
});

test("bold math selects native bold glyphs instead of synthetic CSS bold", () => {
  const box = layoutNativeMath(String.raw`\mathbf{A}_i+\boldsymbol{\alpha}`);
  assert.ok(box);
  assert.equal(box.items.find(i => i.text === "A").family, "TikZKitCMBX10");
  assert.equal(box.items.find(i => i.text === "i").family, "TikZKitCMMI7");
  assert.equal(box.items.find(i => i.text === "α").family, "TikZKitCMMIB10");
});

test("escaped matrix braces do not consume later nodes or the picture", () => {
  const source = String.raw`\begin{tikzpicture}
    \node {$\left\{\begin{array}{lr}a&1\\b&2\end{array}\right.$};
    \node at (2,0) {$\sqrt{x}$};
  \end{tikzpicture}`;
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  assert.equal((result.svg.match(/data-math-layout="cm-tex-box"/g) || []).length, 2);
});

test("126 local MacTeX hboxes match roots, matrices, and bold math at 10/7/5pt", () => {
  const reference = JSON.parse(readFileSync(new URL("./fixtures/font-visual-gates/native-math-structures.json", import.meta.url)));
  assert.equal(reference.probes.length, 126);
  for (const probe of reference.probes) {
    const box = layoutNativeMath(probe.tex, {
      fontSizePt: probe.sizePt, mathVersion: probe.mathVersion, mathExtension: reference.mathExtension
    });
    assert.ok(box, probe.tex);
    for (const field of ["width", "height", "depth"]) {
      assert.ok(Math.abs(box[field] - probe.native[field]) < 0.001,
        `${probe.sizePt}pt ${probe.mathVersion} ${probe.tex}: ${field} ${box[field]} != ${probe.native[field]}`);
    }
  }
});

test("tall roots use native CMEX assembly instead of stretching a glyph", () => {
  const box = layoutNativeMath(String.raw`\sqrt{\dfrac{1}{\dfrac{1}{x_i}}}`, { mathExtension: "ams" });
  const pieces = box.items.filter(i => i.family === "TikZKitCMEX10");
  assert.ok(pieces.length > 2);
  assert.ok(pieces.every(p => p.size === 10 && p.weight === 400));
  assert.equal(new Set(pieces.map(p => p.x)).size, 1);
  assert.ok(pieces.every((p, i) => !i || p.y > pieces[i - 1].y));
});

test("matrix row struts honor the surrounding baseline skip", () => {
  const tex = String.raw`\begin{matrix}1&2\\3&4\end{matrix}`;
  const ordinary = layoutNativeMath(tex, { baselineSkipPt: 12 });
  const spacious = layoutNativeMath(tex, { baselineSkipPt: 18 });
  assert.ok(Math.abs(ordinary.height + ordinary.depth - 24) < 1e-10);
  assert.ok(Math.abs(spacious.height + spacious.depth - 36) < 1e-10);
  assert.equal(spacious.width, ordinary.width);
  assert.ok(Math.abs((spacious.height - spacious.depth) / 2 - 2.5) < 0.001);
});

test("mathbf alphabet, boldsymbol group, and bold math version stay distinct", () => {
  const tex = String.raw`\mathbf{\alpha+\Theta}+\boldsymbol{x}_i+y_j`;
  const normal = layoutNativeMath(tex);
  assert.equal(normal.items.find(i => i.text === "α").family, "TikZKitCMMI10");
  assert.equal(normal.items.find(i => i.text === "Θ").family, "TikZKitCMBX10");
  assert.equal(normal.items.find(i => i.text === "x").family, "TikZKitCMMIB10");
  assert.equal(normal.items.find(i => i.text === "i").family, "TikZKitCMMI7");
  assert.equal(normal.items.find(i => i.text === "y").weight, 400);
  const bold = layoutNativeMath(tex, { mathVersion: "bold" });
  assert.ok(bold.items.every(i => i.weight === 700));
  assert.equal(bold.items.find(i => i.text === "j").family, "TikZKitCMMIB7");
});

test("default browser and SVG-text export share the complete native structure layout", () => {
  for (const [id, count] of [["radicals", 8], ["matrices", 8], ["bold-math", 8]]) {
    const source = readFileSync(new URL(`./fixtures/font-visual-gates/${id}.tex`, import.meta.url), "utf8");
    for (const options of [{}, { mathRenderer: "svg-text" }]) {
      const result = tikzToSvg(source, options);
      assert.deepEqual(result.diagnostics, [], id);
      assert.equal((result.svg.match(/data-math-layout="cm-tex-box"/g) || []).length, count, id);
      assert.ok(!result.svg.includes("foreignObject"), id);
      assert.ok(result.svg.includes("data:font/woff;base64,"), id);
    }
  }
});

test("specialized alignments keep whole-formula fallback rather than losing cells", () => {
  for (const tex of [String.raw`\begin{aligned}x&=\widehat y\\y&=2\end{aligned}`,
    String.raw`\begin{cases}\widehat x&x>0\\0&x<0\end{cases}`,
    String.raw`\begin{array}{c|r}x&1\\y&2\end{array}`]) {
    assert.equal(layoutNativeMath(tex), null, tex);
  }
});
