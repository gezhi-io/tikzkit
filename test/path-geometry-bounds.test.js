import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

function picture(body, options = "") {
  const result = tikzToSvg("\\begin{tikzpicture}[" + options + "]" + body + "\\end{tikzpicture}", { unit: 100, margin: 0 });
  assert.deepEqual(result.diagnostics, []);
  return result;
}
const box = (result) => result.svg.match(/viewBox="([^"]+)"/)[1].split(" ").map(Number);

test("physical radii use canvas units while numeric radii use the coordinate basis", () => {
  const dimensions = (shape, options) => box(picture("\\fill (0,0) " + shape + ";", options)).slice(2);
  assert.deepEqual(dimensions("circle (1cm)", "x=2cm,y=1cm"), [200, 200]);
  assert.deepEqual(dimensions("circle (1)", "x=2cm,y=1cm"), [400, 200]);
  assert.deepEqual(dimensions("ellipse (1cm and .5cm)", "x=2cm,y=1cm,scale=2"), [400, 200]);
  assert.deepEqual(dimensions("ellipse (1 and .5)", "x=2cm,y=1cm,scale=2"), [800, 200]);
});

test("a declared picture box preserves earlier paint, ignores later paint for size, and is scoped", () => {
  const declare = "\\useasboundingbox (0,0) rectangle (2,1);";
  const blue = "\\fill[blue](8,0)rectangle(9,1);";
  const clippedSize = picture(declare + blue);
  assert.deepEqual(box(clippedSize), [0, -100, 200, 100]);
  const bluePath = clippedSize.svg.match(/<path d="([^"]+)"[^>]*fill="blue"/)?.[1];
  const corners = [...(bluePath || "").matchAll(/[ML] ([-\d.]+ [-\d.]+)/g)].map((match) => match[1]).sort();
  assert.deepEqual(corners, ["800 -100", "800 0", "900 -100", "900 0"]);
  assert.doesNotMatch(clippedSize.svg, /clip-path=/);
  const prior = "\\fill(-1,0) rectangle (0,1);";
  const after = "\\fill(3,0) rectangle (4,1);";
  assert.deepEqual(box(picture(prior + "\\begin{scope}" + declare + blue + "\\end{scope}" + after)),
    [-100, -100, 500, 100]);
  assert.deepEqual(box(picture("\\useasboundingbox (0,0) circle (1cm);" + blue)), [-100, -100, 200, 200]);
});
