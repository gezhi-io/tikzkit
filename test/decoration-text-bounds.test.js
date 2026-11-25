import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { extractBalanced } from "../src/frontend/parser.js";
import { computeSvgBounds } from "../src/renderers/svg/bounds.js";

const nativeSource = readFileSync(new URL("fixtures/native-decoration-text-bounds.tex", import.meta.url), "utf8");
const ptPerCm = 72.27 / 2.54;
function probeSource(id) {
  const prefix = `\\Probe{${id}}`;
  const offset = nativeSource.indexOf(prefix);
  assert.ok(offset >= 0);
  const body = extractBalanced(nativeSource, offset + prefix.length, "{", "}").content;
  return String.raw`\usetikzlibrary{decorations.text}\begin{tikzpicture}${body}\end{tikzpicture}`;
}

// Measured independently by native-decoration-text-bounds.tex using the
// picture registers, not by reading JS SVG dimensions or glyph extents.
for (const [id, minX, minY, maxX, maxY] of [
  ["base", 0, -5.2774, 56.90549, 10.16629],
  ["center", 0, -6.74963, 56.90549, 6.74963],
  ["sloped", -6.8191, -4.47131, 56.90549, 28.45274],
  ["raised", 0, -13.81322, 56.90549, 1.63048],
  ["spaces", 0, -6.66595, 56.90549, 6.66595],
  ["reverse", 0, -10.16629, 56.90549, 5.2774],
  ["group", 0, -5.2774, 56.90549, 10.16629],
  ["quick", 0, 0, 56.90549, 28.45274],
  ["overlay", -.2, -.2, 28.65274, 28.65274],
  ["replacement-fill", 0, 0, 4, 4],
  ["replacement-stroke", 0, -2.5, 5, 2.5],
  ["replacement-sloped", -.78105, -.78105, 3.60948, 3.60948]
]) {
  test(`text decoration picture bounds match MacTeX: ${id}`, () => {
    const result = tikzToSvg(probeSource(id));
    assert.deepEqual(result.diagnostics, []);
    const actual = computeSvgBounds(result.ir.items);
    for (const [key, expected] of Object.entries({ minX, minY, maxX, maxY })) {
      assert.ok(Math.abs(actual[key] * ptPerCm - expected) < .001,
        `${key}: ${actual[key] * ptPerCm} != ${expected} TeX pt`);
    }
  });
}

test("text-effect bounds use the same physical size in both SVG modes and render units", () => {
  const source = probeSource("sloped");
  for (const unit of [30, 96 / 2.54]) {
    const normal = tikzToSvg(source, { unit, margin: 0 });
    const exported = tikzToSvg(source, { unit, margin: 0, mathRenderer: "svg-text" });
    assert.deepEqual(normal.diagnostics, []);
    assert.equal(normal.svg.match(/viewBox="([^"]+)"/)[1], exported.svg.match(/viewBox="([^"]+)"/)[1]);
    const [x, y, width, height] = normal.svg.match(/viewBox="([^"]+)"/)[1].split(" ").map(Number);
    assert.ok(x < -.23 * unit && y <= -unit, "rotated character bounds must extend outside the input path");
    assert.ok(width > 2.23 * unit && height > 1.15 * unit);
  }
});
