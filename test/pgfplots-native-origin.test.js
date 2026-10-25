import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

const ptPerCm = 72.27 / 2.54;
const fixture = path => readFileSync(new URL(`fixtures/${path}.tex`, import.meta.url), "utf8");
const positive = fixture("pgfplots-native-seams/positive");
const render = source => {
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  return result.ir.items;
};
const closePt = (actualCm, expectedPt, label) => assert.ok(Math.abs(actualCm * ptPerCm - expectedPt) < 0.06,
  `${label}: ${actualCm * ptPerCm} TeX pt differs from native ${expectedPt} TeX pt`);
const paths = (items, subtype) => items.filter(item => item.subtype === subtype).map(item => item.commands);

test("native positive-only middle axes clamp zero to the enlarged lower limits", () => {
  const lines = paths(render(positive), "axis-line");
  assert.equal(lines.length, 2);
  for (const point of lines[0]) closePt(point.y, 0, "horizontal axis y");
  for (const point of lines[1]) closePt(point.x, 0, "vertical axis x");
});

test("native positive-only descriptions follow the clamped axis endpoints", () => {
  // Native named-node centers from pgfplots-native-seams/metrics.tex.
  const items = render(positive);
  for (const [text, x, y] of [["$x$", 188.60951, 5.68575], ["$y$", 6.16377, 155.34256]]) {
    const label = items.find(item => item.type === "textNode" && item.text === text);
    assert.ok(label, text);
    closePt(label.x, x, `${text} center x`);
    closePt(label.y, y, `${text} center y`);
  }
});

test("native positive-only first major ticks are not obscured by the enlarged origin", () => {
  const items = render(positive);
  const ticks = paths(items, "axis-tick");
  assert.equal(ticks.length, 12);
  assert.deepEqual(items.filter(item => item.type === "textNode").map(item => item.text),
    ["1", "1.2", "1.4", "1.6", "1.8", "2", "3", "3.2", "3.4", "3.6", "3.8", "4", "$x$", "$y$"]);
  for (const [from, to] of ticks) {
    if (from.x === to.x) closePt((from.y + to.y) / 2, 0, "x tick base");
    else closePt((from.x + to.x) / 2, 0, "y tick base");
  }
});

test("native negative-only middle axes clamp zero to the upper limits", () => {
  const lines = paths(render(fixture("pgfplots-native-origin/negative")), "axis-line");
  for (const point of lines[0]) closePt(point.y, 162.00052, "negative horizontal axis y");
  for (const point of lines[1]) closePt(point.x, 195.00012, "negative vertical axis x");
});

test("negative left axes remain at the lower frame instead of following logical zero", () => {
  const source = fixture("pgfplots-native-origin/negative")
    .replace("axis x line=middle,axis y line=middle", "axis lines=left");
  const lines = paths(render(source), "axis-line");
  assert.equal(lines.length, 2);
  for (const point of lines[0]) closePt(point.y, 0, "left horizontal axis y");
  for (const point of lines[1]) closePt(point.x, 0, "left vertical axis x");
});

test("native circle minors include enlarged endpoint intervals and the axis crossing", () => {
  const ticks = paths(render(fixture("examples/latex-examples/2d-x-square-with-circle")), "axis-minor-tick");
  const vertical = ticks.filter(([from, to]) => from.x === to.x).sort((a, b) => a[0].x - b[0].x);
  const horizontal = ticks.filter(([from, to]) => from.y === to.y).sort((a, b) => a[0].y - b[0].y);
  // Native PGF's descending foreach for minor tick num=-3 paints some paths
  // twice. These are the 25 distinct minor segments, not the paint count.
  assert.equal(vertical.length, 15);
  assert.equal(horizontal.length, 10);
  vertical.forEach(([from, to], index) => {
    const dataX = -1.75 + index * 0.25;
    closePt(from.x, (dataX + 1.8) / 3.6 * 195, `minor x=${dataX}`);
    closePt(to.y, 0.225 / 2.7 * 162, "x minor baseline");
  });
  horizontal.forEach(([from, to], index) => {
    const dataY = index * 0.25;
    closePt(from.y, (dataY + 0.225) / 2.7 * 162, `minor y=${dataY}`);
    closePt(to.x, 195 / 2, "y minor baseline");
  });
});

test("native explicit minor ticks at zero do not use the major obscured-tick filter", () => {
  const items = render(fixture("pgfplots-native-origin/zero-minors"));
  assert.equal(paths(items, "axis-minor-tick").length, 2);
  assert.equal(paths(items, "axis-tick").length, 4);
});

test("explicit hide obscured=false still retains major zero ticks", () => {
  const source = fixture("pgfplots-native-origin/zero-minors")
    .replace("minor xtick={0}", "hide obscured x ticks=false,hide obscured y ticks=false,minor xtick={0}");
  const items = render(source);
  assert.equal(paths(items, "axis-minor-tick").length, 2);
  assert.equal(paths(items, "axis-tick").length, 6);
});

test("native enlarged major grids share the clamped obscured-tick boundary", () => {
  const items = render(positive.replace("enlargelimits=true", "enlargelimits=true,grid=major"));
  assert.equal(paths(items, "axis-grid-line").length, 12);
});
