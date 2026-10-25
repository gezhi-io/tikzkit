import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

const pt = 72.27 / 2.54;
const source = name => fs.readFileSync(new URL(`./fixtures/datavis-text-only-legend/${name}.tex`, import.meta.url), "utf8");
const render = name => {
  const result = tikzToSvg(source(name));
  assert.deepEqual(result.diagnostics, []);
  return result.ir;
};
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < .03,
  `${actual}pt != native ${expected}pt`);

test("inside text-only legend measures native row and column boxes", () => {
  const ir = render("function-classes");
  const background = ir.items.find(item => item.subtype === "axis-legend-background");
  // metrics.ltx probes the installed PGF matrix anchors. Remove the .5ex
  // outer separation to compare the painted rectangle, not its anchors.
  close(background.width * pt, 36.99961);
  close(background.height * pt, 24.18253);
  close((background.x + background.width / 2) * pt, 137.10718);
  close((background.y - background.height / 2) * pt, 2.15277);
  assert.equal(ir.items.filter(item => item.subtype === "axis-legend-example").length, 0);
});

test("inside legend follows data bounds and packs a fraction in its own row", () => {
  const ir = render("mixed-cells");
  const texts = ["long gyjp", String.raw`$\displaystyle\frac{1+x_i}{1+x_i^2}$`, "small", "$x^2$", "values at $x_i$"];
  const labels = ir.items.filter(item => item.type === "textNode" && texts.includes(item.text));
  assert.equal(labels.length, 5);
  const label = text => labels.find(item => item.text === text);
  assert.ok(label("long gyjp").x < label("small").x, "right then down fills three columns");
  assert.ok(label("long gyjp").y > label("$x^2$").y, "the fourth entry starts the second row");
  assert.ok(label("small").y > label("values at $x_i$").y);
  const box = ir.items.find(item => item.subtype === "axis-legend-background");
  // Data reaches 7, although the y axis continues to 10. The matrix's
  // north anchor is 0.5ex above the paint, at the actual data boundary.
  close((box.y + box.height / 2) * pt, 3.09 * .7 * pt - 2.15277);
  assert.ok(box.width > 3.5, "native unequal columns must not collapse to a vertical list");
});

test("left then up reverses occupied cells and retains the empty first cell", () => {
  const ir = render("reversed-rows");
  const labels = ir.items.filter(item => item.type === "textNode" && /^(First|Second|Third|Fourth|Fifth)$/.test(item.text));
  assert.deepEqual(labels.map(item => item.text), ["Fifth", "Fourth", "Third", "Second", "First"]);
  assert.ok(labels[0].x < labels[1].x);
  assert.ok(labels[2].x < labels[3].x && labels[3].x < labels[4].x);
  assert.ok(labels[0].y > labels[3].y);
  const box = ir.items.find(item => item.subtype === "axis-legend-background");
  close(box.x * pt, 4 * pt);
  close((box.y + box.height / 2) * pt, 3.09 * 5 / 6 * pt - 2.15277);
});

test("inside legend freezes the data label box before axes are painted", () => {
  const ir = render("pin-boundary");
  const box = ir.items.find(item => item.subtype === "axis-legend-background");
  // metrics.ltx with legendfixture=pin-boundary: the pin's text raises the
  // frozen data bound to 85.06313pt; the plotted endpoint is only 61.54pt.
  close((box.y + box.height / 2) * pt, 85.06313 - 2.15277);
});

for (const [strategy, expected] of [
  ["down then right", ["First", "Third", "Fifth", "Second", "Fourth"]],
  ["up then right", ["Second", "Fourth", "First", "Third", "Fifth"]],
  ["right then down", ["First", "Second", "Third", "Fourth", "Fifth"]],
  ["right then up", ["Fourth", "Fifth", "First", "Second", "Third"]],
  ["left then down", ["Third", "Second", "First", "Fifth", "Fourth"]],
  ["up then left", ["Fourth", "Second", "Fifth", "Third", "First"]],
  // The installed PGF updater uses the number of columns as its row limit;
  // its third entry falls outside this rectangular matrix. Do not silently
  // replace this native behavior with the symmetric-looking algorithm.
  ["down then left", ["Fourth", "First", "Fifth", "Second"]]
]) {
  test(`text-only legend follows PGF's ${strategy} cell order`, () => {
    const result = tikzToSvg(source("reversed-rows").replace("left then up", strategy));
    assert.deepEqual(result.diagnostics, []);
    const labels = result.ir.items.filter(item => item.type === "textNode" && /^(First|Second|Third|Fourth|Fifth)$/.test(item.text));
    assert.deepEqual(labels.map(item => item.text), expected);
  });
}

test("legend placement and maximum keys retain source-order row/column semantics", () => {
  const result = tikzToSvg(source("reversed-rows").replace("north inside,rows=2,max columns=3,left then up",
    "rows=2,north inside,max columns=3,right then down"));
  assert.deepEqual(result.diagnostics, []);
  // north inside resets the ideal to one row, then max columns caps it at
  // three entries. Five labels therefore require two rows and three columns.
  const labels = result.ir.items.filter(item => item.type === "textNode" && /^(First|Second|Third|Fourth|Fifth)$/.test(item.text));
  assert.ok(labels[0].x < labels[1].x && labels[1].x < labels[2].x);
  assert.ok(labels[0].y > labels[3].y);
});
