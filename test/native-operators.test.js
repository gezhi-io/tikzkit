import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { layoutNativeMath } from "../src/tex/mathBox.js";
import { tikzToSvg } from "../src/index.js";
import { nativeMathGroups } from "./helpers/native-math-svg.js";

// Independent pdfTeX hboxes from fixtures/native-operator-metrics.tex.
for (const [tex, options, width, height, depth] of [
  [String.raw`\operatorname{round}(-2.5)`, {}, 53.91682, 7.5, 2.5],
  [String.raw`\operatorname{mod}(-5,3)`, {}, 49.16678, 7.5, 2.5],
  [String.raw`a\operatorname{rank} A`, {}, 35.86922, 6.94444, 0],
  [String.raw`\operatorname{Var}(X)`, {}, 32.43059, 7.5, 2.5],
  [String.raw`\operatorname{f}x`, {}, 11.21526, 6.94444, 0],
  [String.raw`\operatorname{arg\,min} x`, {}, 39.77081, 6.67859, 1.94444],
  [String.raw`\operatorname{a-b*c:d/e.f}x`, {}, 58.43748, 7.5, 2.5],
  [String.raw`\operatorname{rank}_k A`, {}, 33.83687, 6.94444, 1.49998],
  [String.raw`\operatorname{rank}^2_k A`, {}, 33.83687, 8.98335, 2.47217],
  [String.raw`\sin^2 x`, {}, 24.14583, 8.7175, 0],
  [String.raw`\scriptstyle\operatorname{round}(-2.5)`, {}, 43.20851, 5.25, 1.75],
  [String.raw`\operatorname{round}(-2.5)`, { fontSizePt: 7 }, 43.20851, 5.25, 1.75],
  [String.raw`\operatorname{round}(-2.5)`, { fontSizePt: 14.4 }, 76.21587, 10.79999, 3.59999],
  [String.raw`\operatorname{round}(-2.5)`, { mathVersion: "bold" }, 62.2358, 7.5, 2.5],
  [String.raw`\frac{\operatorname{Var}(X)}{\operatorname{rank} A}`, {}, 28.12025, 10.09998, 3.44841],
  [String.raw`\operatorname{diff}(x)`, {}, 28.43758, 7.5, 2.5],
  [String.raw`\operatorname{fi}x`, {}, 12.93747, 6.94444, 0],
  [String.raw`\operatorname{Re}(p_0)`, {}, 29.10074, 7.5, 2.5]
]) {
  test(`native operator hbox: ${tex} ${JSON.stringify(options)}`, () => {
    const box = layoutNativeMath(tex, options);
    assert.ok(box, "operator formula must not fall back to flattened text");
    for (const [key, expected] of Object.entries({ width, height, depth }))
      assert.ok(Math.abs(box[key] - expected) < .001, `${key}: ${box[key]} != ${expected} TeX pt`);
  });
}

test("operator atoms retain roman nuclei, true minus signs and punct spacing", () => {
  const box = layoutNativeMath(String.raw`\operatorname{mod}(-5,3)`);
  assert.ok(box);
  assert.deepEqual(box.items.slice(0, 3).map(g => g.family), Array(3).fill("TikZKitCMR10"));
  assert.equal(box.items.find(g => g.text === "\u2212")?.family, "TikZKitCMSY10");
  assert.equal(box.items.find(g => g.text === ",")?.family, "TikZKitCMMI10");
  const hyphen = layoutNativeMath(String.raw`\operatorname{a-b}x`);
  assert.equal(hyphen.items.find(g => g.text === "-")?.family, "TikZKitCMR10");
  assert.equal(hyphen.items.at(-1).family, "TikZKitCMMI10");
});

test("operator names share native measurement and paint in default and export modes", () => {
  const source = readFileSync(new URL("fixtures/operator-edge/operator-names.tex", import.meta.url), "utf8");
  const standard = tikzToSvg(source);
  const exported = tikzToSvg(source, { mathRenderer: "svg-text" });
  assert.deepEqual(standard.diagnostics, []);
  assert.deepEqual(exported.diagnostics, []);
  const groups = nativeMathGroups(standard.svg);
  assert.equal(groups.length, 11);
  assert.deepEqual(nativeMathGroups(exported.svg), groups);
  assert.ok(!standard.svg.includes("foreignObject") && !exported.svg.includes("foreignObject"));
});

test("named limits share native placement while large-symbol operators retain fallback", () => {
  const named = layoutNativeMath(String.raw`\operatorname*{lim}_{x\to0}`, { displayMode: true });
  const builtin = layoutNativeMath(String.raw`\lim_{x\to0}`, { displayMode: true });
  assert.ok(named && builtin);
  assert.deepEqual(named.items, builtin.items);
  assert.ok(Math.abs(named.depth - 7.17776) < .001);
  for (const tex of [String.raw`\sum_i x_i`, String.raw`\int_0^1 x`, String.raw`\mathop{a+b}\limits_x`])
    assert.equal(layoutNativeMath(tex, { displayMode: true }), null, tex);
});
