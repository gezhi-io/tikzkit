import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

const SOURCE = readFileSync(
  new URL("./fixtures/examples/circuitikz/dc-sources.tex", import.meta.url),
  "utf8"
);

test("renders circuitikz DC voltage and current source symbols", () => {
  const result = tikzToSvg(SOURCE, { margin: 0, mathRenderer: "svg-text" });
  const voltageOutlines = result.ir.items.filter((item) => item.subtype === "circuitikz-dc-voltage-source");
  const voltagePlates = result.ir.items.filter((item) => item.subtype === "circuitikz-dc-voltage-source-plate");
  const currentFills = result.ir.items.filter((item) => item.subtype === "circuitikz-dc-current-source-fill");
  const currentOutlines = result.ir.items.filter((item) => item.subtype === "circuitikz-dc-current-source");
  const currentArrows = result.ir.items.filter((item) => item.subtype === "circuitikz-dc-current-source-arrow");
  const currentArrowHeads = result.ir.items.filter((item) => item.subtype === "circuitikz-dc-current-source-arrow-head");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(voltageOutlines.length, 2);
  assert.equal(voltagePlates.length, 4, "expected two parallel plates in each DC voltage source");
  assert.equal(currentFills.length, 2, "expected one filled body below each DC current-source outline");
  assert.equal(currentOutlines.length, 2);
  assert.equal(currentArrows.length, 2);
  assert.equal(currentArrowHeads.length, 2, "expected a circuitikz currarrow head in each DC current source");
  assert.deepEqual(currentFills.map((item) => item.style.fill), ["yellow", "yellow"]);
  assert.ok(currentOutlines.every((item) => item.style.fill === "none"));
  assert.ok(currentArrows.every((item) => item.style.markerEnd === undefined));
  assert.ok(currentArrowHeads.every((item) => item.style.fill === item.style.stroke));
  assert.ok(currentOutlines.every((item) => item.sourceShape === "open"));
  assert.deepEqual(currentOutlines.map((item) => item.sourceAngle), [80, 45]);
  assert.ok(currentOutlines.every((item) => item.commands.filter((command) => command.type === "moveTo").length === 2));
  assert.ok(
    currentOutlines[1].commands.length < currentOutlines[0].commands.length,
    "a smaller dcisource angle should use fewer arc pieces"
  );
});
