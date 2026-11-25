import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { layoutNativeMath } from "../src/tex/mathBox.js";
import { preprocessTikzSource } from "../src/frontend/latex-shell.js";
import { tikzToSvg } from "../src/index.js";
import { nativeMathGroups } from "./helpers/native-math-svg.js";

// Width/height/depth measured independently by native-operator-limits-metrics.tex.
for (const [tex, options, width, height, depth] of [
  [String.raw`\operatorname*{arg\,min}_{x\in A}f(x)`, {}, 69.95842, 7.5, 2.97415],
  [String.raw`\displaystyle\operatorname*{arg\,min}_{x\in A}f(x)`, {}, 53.52087, 7.5, 9.92416],
  [String.raw`\displaystyle\operatorname*{Lim}_{n\to\infty}x_n`, {}, 33.71304, 6.83331, 7],
  [String.raw`\displaystyle\operatorname*{rank}^2_k A`, {}, 28.9167, 14.45554, 7.52776],
  [String.raw`\displaystyle\operatorname*{rank}^{n+1} A`, {}, 28.9167, 14.45554, 0],
  [String.raw`\displaystyle\operatorname*{rank}_{n=0} A`, {}, 28.9167, 6.94444, 7.17776],
  [String.raw`\displaystyle\operatorname*{f}^{i+j+k}_{a+b+c}x`, {}, 31.08778, 15.27776, 8.3611],
  [String.raw`\operatorname*{rank}\limits^2_k A`, {}, 28.9167, 14.45554, 7.52776],
  [String.raw`\displaystyle\operatorname*{rank}\nolimits^2_k A`, {}, 33.83687, 8.98335, 2.47217],
  [String.raw`\displaystyle\operatorname{rank}\limits^2_k A`, {}, 33.83687, 8.98335, 2.47217],
  [String.raw`\displaystyle\lim_{x\to0}f(x)`, {}, 37.62506, 7.5, 7.17776],
  [String.raw`\lim_{x\to0}f(x)`, {}, 52.01399, 7.5, 2.5],
  [String.raw`\lim\limits_{x\to0}f(x)`, {}, 37.62506, 7.5, 7.17776],
  [String.raw`\displaystyle\lim\nolimits_{x\to0}f(x)`, {}, 52.01399, 7.5, 2.5],
  [String.raw`\displaystyle\max_{x\in A}f(x)`, {}, 39.74313, 7.5, 7.97972],
  [String.raw`\displaystyle\min^{n+1}_{n=0}x_n`, {}, 29.49194, 14.18968, 7.17776],
  [String.raw`\displaystyle\operatorname*{rank}^2_k A`, { fontSizePt: 7 }, 23.1089, 10.48329, 5.63887],
  [String.raw`\displaystyle\operatorname*{rank}^2_k A`, { fontSizePt: 14.4 }, 40.77785, 20.76442, 10.78444],
  [String.raw`\displaystyle\operatorname*{rank}^2_k A`, { mathVersion: "bold" }, 33.39565, 14.45554, 7.52776],
  [String.raw`\scriptstyle\operatorname*{rank}\limits^2_k A`, {}, 23.1089, 10.48329, 5.63887],
  [String.raw`\scriptscriptstyle\operatorname*{rank}\limits^2_k A`, {}, 19.84517, 8.40869, 5.01982],
  [String.raw`\frac{\operatorname*{rank}\limits^2_k A}{2}`, {}, 25.5089, 19.22214, 3.44841],
  [String.raw`\displaystyle\operatorname*{rank}^{}_{} A`, {}, 28.9167, 9.94443, 7],
  [String.raw`\displaystyle\operatorname*{rank} A`, {}, 28.9167, 6.94444, 0],
  [String.raw`\displaystyle\operatorname*{rank}\limits\nolimits_k A`, {}, 33.83687, 6.94444, 1.49998],
  [String.raw`\operatorname*{rank}\nolimits\limits_k A`, {}, 28.9167, 6.94444, 7.52776]
]) {
  test(`native named limits: ${tex} ${JSON.stringify(options)}`, () => {
    const box = layoutNativeMath(tex, { mathExtension: "ams", ...options });
    assert.ok(box, "named limits must use the shared native box");
    for (const [key, expected] of Object.entries({ width, height, depth }))
      assert.ok(Math.abs(box[key] - expected) < .001, `${key}: ${box[key]} != ${expected} TeX pt`);
  });
}

test("DeclareMathOperator preserves starred versus ordinary semantics through expansion", () => {
  const result = preprocessTikzSource(String.raw`
\DeclareMathOperator*{\Lim}{Lim}
\DeclareMathOperator{\rank}{rank}
\begin{tikzpicture}\node {$\displaystyle\Lim_{n\to\infty}x_n+\rank_k A$};\end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  assert.match(result.source, /\\operatorname\*\{Lim\}/);
  assert.match(result.source, /\\operatorname\{rank\}/);
  assert.doesNotMatch(result.source, /\\DeclareMathOperator|\\Lim|\\rank/);
});

test("display mode and an explicit displaystyle choose the same named limits", () => {
  const tex = String.raw`\operatorname*{rank}^2_k A`;
  const implicit = layoutNativeMath(tex, { displayMode: true, mathExtension: "ams" });
  const explicit = layoutNativeMath(String.raw`\displaystyle ${tex}`, { mathExtension: "ams" });
  assert.ok(implicit && explicit);
  assert.deepEqual(implicit.items, explicit.items);
});

test("named limits paint in native vertical-list order: upper, nucleus, lower", () => {
  const box = layoutNativeMath(String.raw`\displaystyle\operatorname*{rank}^2_k A`, { mathExtension: "ams" });
  assert.ok(box);
  assert.equal(box.items.map(item => item.text).join(""), "2rankkA");
  assert.ok(box.items[0].y < 0 && box.items[5].y > 0);
  assert.ok(box.items.slice(1, 5).every(item => item.y === 0));
});

for (const [fixture, count] of [["operator-limits-modes", 12], ["operator-limits-sizes", 6]]) {
  test(`named limits use the same glyphs in default browser and SVG-text: ${fixture}`, () => {
    const source = readFileSync(new URL(`fixtures/operator-limits/${fixture}.tex`, import.meta.url), "utf8");
    const standard = tikzToSvg(source);
    const exported = tikzToSvg(source, { mathRenderer: "svg-text" });
    assert.deepEqual(standard.diagnostics, []);
    assert.deepEqual(exported.diagnostics, []);
    const groups = nativeMathGroups(standard.svg);
    assert.equal(groups.length, count);
    assert.deepEqual(nativeMathGroups(exported.svg), groups);
    assert.doesNotMatch(standard.svg + exported.svg, /foreignObject/);
  });
}
