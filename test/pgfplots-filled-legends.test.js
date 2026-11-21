import assert from "node:assert/strict";
import test from "node:test";
import { filledLegendImage } from "../src/pgfplots/legendImages.js";
import { renderLegendEntries } from "../src/pgfplots/legend.js";
import { applyPgfplotsCycleStyles } from "../src/pgfplots/axisTikzLowering.js";
import { selectPlotStyle } from "../src/pgfplots/plotStyle.js";

// Physical bounds (TeX pt, including the pen) reported by the local PGF probe.
const pt = 72.27 / 2.54;
for (const [handler, count, expected] of [
  ["area legend", 1, [-.2, -3.04544, 17.27182, 3.04544]],
  ["ybar", 2, [-1.7, -2.19997, 7.7, 6.20006]],
  ["xbar", 2, [-.2, -3.69997, 8.20003, 5.70003]],
  ["ybar stacked", 1, [-3.2, -2.19997, 3.2, 6.20006]],
  ["xbar stacked", 1, [-.2, -2.33891, 8.20003, 4.06108]],
  ["ybar interval", 2, [.55002, -2.19997, 9.45, 6.20006]],
  ["xbar interval", 2, [-.2, 3.8001, 5.2, 5.90005]],
  ["xbar interval stacked", 0, [0, 0, 0, 0]],
  ["ybar interval stacked", 0, [0, 0, 0, 0]]
]) {
  test(`PGF picture bounds and rectangles for ${handler}`, () => {
    const image = filledLegendImage({ [handler]: true }, {});
    assert.equal(image.rects.length, count);
    ["minX", "minY", "maxX", "maxY"].forEach((key, i) =>
      assert.ok(Math.abs(image.bounds[key] * pt - expected[i]) < .002, key));
  });
}

test("grouped bar legend draws the two native widths and heights, not the data bar width", () => {
  const axis = { ybar: "5pt", "bar width": "9pt", "legend style": "font=\\small" };
  const [p] = applyPgfplotsCycleStyles([{ options: {} }], axis);
  assert.equal(p.options.fill, "blue!30!white");
  const output = renderLegendEntries(axis, {}, { origin: {x:0,y:0}, width:6, height:4 }, ["Far"], [p]);
  const samples = output.filter(c => c.includes("axis legend image"));
  assert.equal(samples.length, 2);
  for (const [i, sample] of samples.entries()) {
    assert.match(sample, /fill=blue!30!white/);
    const points = [...sample.matchAll(/\(([-\d.]+),([-\d.]+)\)/g)].map(m => m.slice(1).map(Number));
    assert.ok(Math.abs((points[1][0]-points[0][0])*pt-3) < .002);
    assert.ok(Math.abs((points[2][1]-points[0][1])*pt-(i ? 6 : 8)) < .002);
  }
  assert.equal(filledLegendImage(axis, { "line legend": true, "sharp plot": true }), null);
});

test("an explicit bar replaces the cycle; addplot+ can replace its pen without losing the fill", () => {
  const axis = { xbar: true };
  const [outline, plus] = applyPgfplotsCycleStyles([
    { options: { "pgfplots explicit options": true, black: true } },
    { options: { "pgfplots explicit options": true, "pgfplots plus": true, orange: true } }
  ], axis);
  assert.equal(outline.options.fill, undefined);
  assert.equal(selectPlotStyle(plus.options, 1), "orange");
  assert.equal(plus.options.fill, "red!30!white");
});
