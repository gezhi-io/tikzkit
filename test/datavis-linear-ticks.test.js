import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseTikz, tikzToSvg } from "../src/index.js";

const fixture = name => readFileSync(new URL(`fixtures/datavis-linear-ticks/${name}.tex`, import.meta.url), "utf8");
const render = source => ({ ...tikzToSvg(source), ast: parseTikz(source).ast });
const tickTexts = result => result.ast.pictures.flatMap(picture => picture.statements)
  .filter(item => item.type === "node" && item.options["axis tick label"]);
const texts = (result, anchor) => tickTexts(result).filter(item => item.options.anchor === anchor).map(item => item.text);

test("datavis Cartesian explicit tick visualizers keep the origin", () => {
  const result = render(fixture("cartesian-high"));
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(texts(result, "south"), ["0", "0.5", "1", "1.5", "2"]);
});

test("datavis scientific tick planning follows the surveyed positive range", () => {
  const result = render(fixture("positive-range"));
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(texts(result, "north"), ["10", "12", "14", "16", "18", "20"]);
  assert.deepEqual(texts(result, "east"), ["20", "21", "22", "23", "24", "25"]);
});

test("datavis single-point ticks preserve the data value rather than zero", () => {
  const result = render(fixture("single-offset"));
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(texts(result, "north"), ["7"]);
  assert.deepEqual(texts(result, "east"), ["3"]);
});

test("datavis linear ticks use phase before finding the first step", () => {
  const result = render(fixture("tick-phase"));
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(texts(result, "north"), ["−0.75", "−0.25", "0.25", "0.75"]);
  assert.deepEqual(texts(result, "east"), ["−0.75", "−0.25", "0.25", "0.75"]);
});

test("datavis tick boundary tolerance retains the native near-endpoint labels", () => {
  const result = render(fixture("tick-epsilon"));
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(texts(result, "north"), ["0", "0.5", "1"]);
  assert.deepEqual(texts(result, "east"), ["0", "0.5", "1"]);
});

test("datavis boundary tolerance does not admit genuinely out-of-range ticks", () => {
  const result = render(fixture("tick-epsilon").replaceAll(".0005", ".002").replaceAll(".9995", ".998"));
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(texts(result, "north"), ["0.5"]);
  assert.deepEqual(texts(result, "east"), ["0.5"]);
});

test("datavis minor ticks include the partial interval before the first major tick", () => {
  const result = render(fixture("minor-partial"));
  const verticalGrids = result.ir.items.filter(item => ["axis-grid-line", "axis-minor-grid-line"].includes(item.subtype) &&
    Math.abs(item.commands[0].x - item.commands.at(-1).x) < 1e-6);
  const lo = Math.exp(-3), hi = Math.exp(3);
  const values = verticalGrids.map(item => lo + item.commands[0].x / 5 * (hi - lo)).sort((a, b) => a - b);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(values.length, 20);
  values.forEach((value, i) => assert.ok(Math.abs(value - (i + 1)) < .003, `native grid at ${i + 1}, got ${value}`));
});

test("datavis native tick boxes use CMR8 and endpoint padding, not fitted text", () => {
  // Independent MacTeX centers: test/fixtures/datavis-linear-tick-metrics.tex.
  const result = render(fixture("positive-range"));
  const ptPerCm = 72.27 / 2.54;
  const labels = result.ir.items.filter(item => item.type === "textNode");
  const xLabels = labels.filter(item => item.y < 0);
  const yLabels = labels.filter(item => item.x < 0);
  assert.equal(xLabels.length, 6);
  assert.equal(yLabels.length, 6);
  for (const label of xLabels) assert.ok(Math.abs(label.y * ptPerCm + 12.24373) < .02);
  for (const label of yLabels) assert.ok(Math.abs(label.x * ptPerCm + 13.91602) < .02);
  assert.ok(labels.every(item => item.style.fontScale === .8));
  assert.ok(tickTexts(result).every(node => node.options["tikzkit native math"] &&
    node.options["tikzkit tex node anchors"] && node.options["tikzkit text width scale"] === "1"));
});

test("datavis minor ticks use the native 1.4pt length and round caps", () => {
  const result = render(fixture("minor-partial"));
  const ticks = result.ir.items.filter(item => item.subtype === "axis-minor-tick");
  assert.equal(ticks.length, 16);
  for (const tick of ticks) {
    const [a, b] = tick.commands;
    assert.ok(Math.abs(Math.hypot(b.x - a.x, b.y - a.y) * 72.27 / 2.54 - 1.4) < .02);
    assert.equal(tick.style.lineCap, "round");
  }
});
