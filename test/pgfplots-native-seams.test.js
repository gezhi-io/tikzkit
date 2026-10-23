import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg, tikzToSvgAsync } from "../src/index.js";

const texPtPerCm = 72.27 / 2.54;
const fixture = name => readFileSync(new URL(`fixtures/pgfplots-native-seams/${name}.tex`, import.meta.url), "utf8");
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 0.06,
  `${label}: ${actual} TeX pt differs from MacTeX ${expected} TeX pt`);
const canvas = result => {
  const size = result.svg.match(/width="([\d.]+)pt" height="([\d.]+)pt"/);
  assert.ok(size, "expected physical SVG dimensions");
  return { width: Number(size[1]) * 72.27 / 72, height: Number(size[2]) * 72.27 / 72 };
};

test("native explicit-size tickless middle axes have only the painted stroke extent", async () => {
  // MacTeX metrics.tex: frame (410.24170,182.62024), bbox (-.2,-.2)
  // to (410.44170,182.82024). No description gutter is present.
  for (const source of [fixture("tickless"), fixture("tickless-empty")]) {
    for (const result of [tikzToSvg(source, { margin: 0 }), await tikzToSvgAsync(source, { margin: 0 })]) {
      assert.deepEqual(result.diagnostics, []);
      assert.equal(result.ir.items.filter(item => item.type === "textNode").length, 0);
      const size = canvas(result);
      close(size.width, 410.64170, "tickless canvas width");
      close(size.height, 183.02024, "tickless canvas height");
    }
  }
});

test("native two-centimeter boxed bounds come from the actual tick node boxes", () => {
  const result = tikzToSvg(fixture("box"), { margin: 0 });
  assert.deepEqual(result.diagnostics, []);
  // Named current-bounding-box corners, not the old synthetic margin string.
  const size = canvas(result);
  close(size.width, 62.73605 + 27.42155, "boxed canvas width");
  close(size.height, 63.45827 + 14.14372, "boxed canvas height");
  assert.equal(result.ir.items.filter(item => item.type === "textNode").length, 10);
});

test("native x-square canvas matches the reference crop, not the retired fitted gutter", () => {
  const source = readFileSync(new URL("fixtures/examples/latex-examples/2d-x-square-with-circle.tex", import.meta.url), "utf8");
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  assert.deepEqual(result.diagnostics, []);
  const size = canvas(result);
  // Local tikztosvg SVG is 198.653bp by 170.529bp including the source's
  // 2pt standalone border on each side. margin:0 explicitly removes it.
  close(size.width, 198.653 * 72.27 / 72 - 4, "x-square canvas width");
  close(size.height, 170.529 * 72.27 / 72 - 4, "x-square canvas height");
  // This is a canvas regression, not acceptance of the remaining minor ticks.
});

test("native legacy middle descriptions use endpoint anchors without fitted offsets", () => {
  for (const [name, expected] of [
    ["middle", { x: [188.63594, 21.88817], y: [34.02554, 155.36385] }],
    ["enlarged", { x: [188.64934, 32.68889], y: [45.63423, 155.36429] }]
  ]) {
    const result = tikzToSvg(fixture(name));
    assert.deepEqual(result.diagnostics, []);
    for (const axis of ["x", "y"]) {
      const node = result.ir.items.find(item => item.type === "textNode" && item.text === `$${axis}$`);
      assert.ok(node, `${name} ${axis} label`);
      close(node.x * texPtPerCm, expected[axis][0], `${name} ${axis} center x`);
      close(node.y * texPtPerCm, expected[axis][1], `${name} ${axis} center y`);
    }
  }
});

test("native unaligned footnotesize line breaks do not create a two-line tick", () => {
  const result = tikzToSvg(fixture("unaligned"));
  assert.deepEqual(result.diagnostics, []);
  const node = result.ir.items.find(item => item.type === "textNode" && item.text === "20122956");
  assert.ok(node, "TeX ignores the unaligned line break inside the tick hbox");
  assert.equal(node.font.sizePt, 8);
  close(node.x * texPtPerCm, 0, "unaligned tick center x");
  close(node.y * texPtPerCm, -6.11075, "unaligned tick center y");
  // This guards line-break semantics only. The retained legacy crop padding
  // and SVG width fitting are separate visual defects, not accepted here.
});
