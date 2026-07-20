import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { normalizeTikzText } from "../src/tikz/text.js";

const SOURCE = readFileSync(new URL("fixtures/examples/latex-examples/class-tree.tex", import.meta.url), "utf8");

const DIMENSIONS = {
  "road.jpg": [43, 43],
  "water.jpg": [320, 240],
  "child.jpg": [58, 100],
  "adult.jpg": [64, 144],
  "bike.jpg": [181, 215],
  "motorcycle.jpg": [247, 213],
  "car.jpg": [320, 236],
  "lkw.jpg": [320, 240],
  "danger.png": [546, 480],
  "danger-right.png": [546, 480],
  "slippery.png": [546, 480],
  "bike-sign.png": [480, 480],
  "bike-sign-french.png": [300, 300],
  "bike-sign-ove.png": [300, 300]
};

function imageResolver(fileName) {
  const dimensions = DIMENSIONS[fileName];
  if (!dimensions) return undefined;
  return {
    href: `data:image/mock;base64,${fileName}`,
    naturalWidth: dimensions[0],
    naturalHeight: dimensions[1]
  };
}

test("class tree expands the shared level distance and embeds all image nodes at natural aspect ratios", () => {
  const result = tikzToSvg(SOURCE, { mathRenderer: "svg-text", imageResolver });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ir.coordinates.ped.y, -1.9);
  assert.equal(result.ir.coordinates.adult.y, -3.04);
  assert.equal(result.ir.coordinates.speed120.y, -5.32);
  assert.equal((result.svg.match(/class="tikz-raster-image tikz-included-graphic"/g) || []).length, 14);
  assert.doesNotMatch(result.svg, /tikz-image-placeholder/);

  const road = normalizeTikzText(String.raw`\includegraphics[height=0.8cm]{road.jpg}`, { imageResolver });
  const water = normalizeTikzText(String.raw`\includegraphics[height=0.8cm]{water.jpg}`, { imageResolver });
  assert.ok(Math.abs(road.width - 0.8) < 0.001);
  assert.ok(Math.abs(road.height - 0.8) < 0.001);
  assert.ok(Math.abs(water.width - 0.8 * 4 / 3) < 0.001);
  assert.ok(Math.abs(water.height - 0.8) < 0.001);
});
