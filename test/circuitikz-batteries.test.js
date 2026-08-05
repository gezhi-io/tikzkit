import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

const SOURCE = readFileSync(
  new URL("./fixtures/examples/circuitikz/batteries.tex", import.meta.url),
  "utf8"
);

test("renders scaled circuitikz battery plate families and labels", () => {
  const result = tikzToSvg(SOURCE, { margin: 0, mathRenderer: "svg-text" });
  const plates = result.ir.items.filter((item) => item.subtype === "circuitikz-battery-plate");
  const connectors = result.ir.items.filter((item) => item.subtype === "circuitikz-battery-connector");
  const longPlate = plates.find((item) => item.batteryKind === "battery" && item.plate === "long");
  const battery2Short = plates.find((item) => item.batteryKind === "battery2" && item.plate === "short");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(new Set(plates.map((item) => item.batteryKind)), new Set(["battery", "battery1", "battery2"]));
  assert.equal(plates.filter((item) => item.batteryKind === "battery").length, 4);
  assert.equal(plates.filter((item) => item.batteryKind === "battery1").length, 2);
  assert.equal(plates.filter((item) => item.batteryKind === "battery2").length, 2);
  assert.equal(connectors.length, 4);
  assert.ok(longPlate, "expected the conventional battery's full plates");
  assert.ok(Math.abs(longPlate.commands[1].x - longPlate.commands[0].x) > 0.95, "expected batteries/scale to enlarge the plate span");
  assert.ok(battery2Short, "expected the battery2 short plate");
  assert.ok(Math.abs(battery2Short.style.lineWidth - longPlate.style.lineWidth * 3) < 1e-9);

  for (const label of ["$B$", "$B_1$", "$B_2$"]) {
    const node = result.ir.items.find((item) => item.type === "textNode" && item.text === label);
    assert.ok(node, `expected ${label} label`);
    assert.ok(node.x < 4.5, `expected ${label} to sit outside its source body`);
  }
});
