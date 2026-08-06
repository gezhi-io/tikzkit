import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

const SOURCE = readFileSync(
  new URL("./fixtures/examples/circuitikz/opto-diodes.tex", import.meta.url),
  "utf8"
);

test("renders circuitikz photodiode and laser-diode optical arrows", () => {
  const result = tikzToSvg(SOURCE, { margin: 0, mathRenderer: "svg-text" });
  const diodes = result.ir.items.filter((item) => item.subtype === "circuitikz-diode");
  const opticalArrows = result.ir.items.filter((item) => item.subtype === "circuitikz-opto-arrow");
  const laserBars = result.ir.items.filter((item) => item.subtype === "circuitikz-laser-cathode");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(diodes.filter((item) => item.diodeKind === "photodiode").length, 4);
  assert.equal(diodes.filter((item) => item.diodeKind === "laser").length, 2);
  assert.equal(opticalArrows.length, 12);
  assert.equal(laserBars.length, 2);
  assert.ok(opticalArrows.some((item) => item.diodeKind === "photodiode" && item.direction === "inward"));
  assert.ok(opticalArrows.some((item) => item.diodeKind === "photodiode" && item.direction === "outward"));
  assert.ok(opticalArrows.some((item) => item.style.stroke === "red"));
  assert.ok(opticalArrows.some((item) => item.style.stroke === "red" && item.style.lineWidth > 2));
  assert.ok(diodes.some((item) => item.diodeKind === "photodiode" && item.bodyLength < 0.5));
  assert.ok(diodes.some((item) => item.diodeKind === "photodiode" && item.variant === "stroke"));
});
