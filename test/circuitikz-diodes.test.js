import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

const SOURCE = readFileSync(
  new URL("./fixtures/examples/circuitikz/diodes.tex", import.meta.url),
  "utf8"
);

test("renders the circuitikz diode, Schottky, and LED bipole slice", () => {
  const result = tikzToSvg(SOURCE, { margin: 0, mathRenderer: "svg-text" });
  const diodes = result.ir.items.filter((item) => item.subtype === "circuitikz-diode");
  const cathodes = result.ir.items.filter((item) => item.subtype === "circuitikz-diode-cathode");
  const ledArrows = result.ir.items.filter((item) => item.subtype === "circuitikz-led-arrow");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(diodes.length, 5);
  assert.equal(cathodes.length, 5);
  assert.equal(ledArrows.length, 2);
  assert.equal(diodes.filter((item) => item.diodeKind === "schottky").length, 1);
  assert.ok(diodes.some((item) => item.variant === "empty" && item.fill !== "none"));
  assert.ok(
    diodes.some((item) => item.diodeKind === "led" && item.orientation === "vertical"),
    "expected the LED body to share the bipole rotation model"
  );
  assert.ok(
    diodes.some((item) => item.label === "$D_{\\mathrm{small}}$" && item.bodyLength < 0.5),
    "expected the local diodes/scale option to reduce the diode body"
  );
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "$D_{\\mathrm{Schottky}}$"));
});
