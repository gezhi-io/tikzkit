import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { createAxisGeometry } from "../src/pgfplots/geometry.js";
import { formatAxisPoint } from "../src/pgfplots/format.js";
import { renderAxisBox } from "../src/pgfplots/axisLines.js";

const fixture = name => readFileSync(new URL(`./fixtures/pgfplots-box-paint/${name}.tex`, import.meta.url), "utf8");

for (const [name, foreground] of [["box-behind-plots", false], ["box-on-top", true]]) {
  test(`boxed axis paint order follows native axis on top: ${foreground}`, () => {
    const result = tikzToSvg(fixture(name));
    assert.deepEqual(result.diagnostics, []);
    const paths = [...result.svg.matchAll(/<path\b[^>]*>/g)].map(m => m[0]);
    const frame = paths.findIndex(p => p.includes('stroke="black"') && /\bZ/.test(p));
    const red = paths.findIndex(p => p.includes('stroke="red"'));
    assert.ok(frame >= 0 && red >= 0);
    assert.equal(frame > red, foreground);
  });
}

test("boxed axis starts southwest and travels north before east, preserving dash phase", () => {
  // pgfplots@drawaxis@outerlines@cycledpath uses this order even for a solid box.
  const command = renderAxisBox({}, { origin: { x: 1, y: 2 }, width: 3, height: 4 });
  assert.ok(command.endsWith("(1,2) -- (1,6) -- (4,6) -- (4,2) -- cycle;"));
});

test("physical axis coordinates retain sub-millipoint geometry through lowering", () => {
  const geometry = createAxisGeometry({ width: "8cm", height: "5cm", enlargelimits: false },
    { xMin: 0, xMax: 1, yMin: 0, yMax: 4 });
  for (const value of [0, 1, 2, 3, 4, 10 / 3]) {
    const point = geometry.mapPoint({ x: .5, y: value });
    const parsed = formatAxisPoint(point).slice(1, -1).split(",").map(Number);
    for (const [i, key] of ["x", "y"].entries()) {
      assert.ok(Math.abs(parsed[i] - point[key]) * 72.27 / 2.54 < .0001,
        `Lost physical precision for ${key} at ${value}: ${parsed[i]} vs ${point[key]}`);
    }
  }
});
