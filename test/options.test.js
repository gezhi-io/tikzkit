import assert from "node:assert/strict";
import test from "node:test";
import { cmykToRgb, normalizeColor, normalizeOptions, parseOptions } from "../src/options.js";

test("resolves TikZ color mixes to concrete SVG colors", () => {
  assert.equal(normalizeColor("red!30"), "rgb(255 179 179)");
  assert.equal(normalizeColor("green!50"), "rgb(128 255 128)");
  assert.equal(normalizeColor("gray!40"), "rgb(204 204 204)");
  assert.equal(normalizeColor("teal!30"), "rgb(179 217 217)");
  assert.equal(normalizeColor("DarkRed!10"), "rgb(243 230 230)");
  assert.equal(normalizeColor("DarkBlue!10"), "rgb(230 230 243)");
  assert.equal(normalizeColor("LightSteelBlue"), "LightSteelBlue");
  assert.equal(normalizeColor("DimGray"), "DimGray");
  assert.equal(normalizeColor("SpringGreen"), "SpringGreen");
  assert.equal(normalizeColor("brown"), "rgb(191 128 64)");
  assert.equal(normalizeColor("lime"), "rgb(191 255 0)");
  assert.equal(normalizeColor("cyan"), "cyan");
  assert.equal(normalizeColor("magenta"), "magenta");
  assert.equal(normalizeColor("yellow"), "yellow");
  assert.equal(normalizeColor("cyan!50!black"), "rgb(0 128 128)");
  assert.doesNotMatch(normalizeColor("blue!60"), /color-mix/);
});

test("matches Poppler DeviceCMYK conversion used by local tikztosvg", () => {
  const rgb = cmykToRgb([0.5, 0, 0, 0.5]);
  assert.deepEqual(rgb.map((channel) => Number(channel.toFixed(6))), [0.284325, 0.4647, 0.551]);
});

test("keeps repeated name intersections options in order", () => {
  const options = parseOptions("name intersections={of=a and b, name=i}, name intersections={of=c and d, name=j}");
  assert.deepEqual(options["name intersections"], ["of=a and b, name=i", "of=c and d, name=j"]);
});

test("keeps repeated pgfplots axis line styles and resolves pgflinewidth shortening", () => {
  const options = parseOptions(String.raw`axis line style={very thick,shorten <=-0.5\pgflinewidth},axis lines=middle,axis line style=very thick`);
  assert.deepEqual(options["axis line style"], [
    String.raw`very thick,shorten <=-0.5\pgflinewidth`,
    "very thick"
  ]);

  const normalized = normalizeOptions(
    "draw",
    parseOptions(String.raw`very thick,shorten <=-0.5\pgflinewidth,-stealth`),
    { styles: {}, variables: {} }
  );
  assert.ok(Math.abs(normalized.style.shortenStart + normalized.style.lineWidth * 0.5) < 1e-12);
});

test("strips TeX comments while parsing option lists", () => {
  const options = parseOptions(String.raw`xmin=-2,
    % start the diagram at this x-coordinate
    xmax=2,
    label={100\% correct},
    ymin=-1,
    % start the diagram at this y-coordinate
    ymax=2`);

  assert.equal(options.xmin, "-2");
  assert.equal(options.xmax, "2");
  assert.equal(options.ymin, "-1");
  assert.equal(options.ymax, "2");
  assert.equal(options.label, String.raw`100\% correct`);
});
