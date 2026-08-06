import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

const SOURCE = readFileSync(
  new URL("./fixtures/examples/circuitikz/variable-capacitors.tex", import.meta.url),
  "utf8"
);

test("renders circuitikz vC variable capacitors with native tunable geometry", () => {
  const result = tikzToSvg(SOURCE, { margin: 0, mathRenderer: "svg-text" });
  const capacitors = result.ir.items.filter((item) => item.subtype === "circuitikz-variable-capacitor");
  const arrows = result.ir.items.filter((item) => item.subtype === "circuitikz-variable-capacitor-arrow");
  const labels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(capacitors.length, 4);
  assert.equal(arrows.length, 4);
  assert.equal(arrows[0].direction, "bottom-left-to-top-right");
  assert.equal(arrows[2].direction, "top-left-to-bottom-right");
  assert.ok(arrows[1].style.lineWidth < arrows[0].style.lineWidth, "modifier thickness should reduce the control arrow");
  assert.ok(capacitors[1].plateSpan < capacitors[0].plateSpan, "capacitors/height should shorten plates");
  assert.ok(capacitors[3].plateGap < capacitors[0].plateGap, "capacitors/width should narrow the plate gap");
  assert.ok(result.ir.coordinates["default.wiper"]);
  assert.deepEqual(result.ir.coordinates["default.W"], result.ir.coordinates["default.wiper"]);
  assert.ok(result.ir.coordinates["default.tip"]);
  for (const label of ["$C_{\\mathrm{default}}$", "$C_{\\mathrm{compact}}$", "$C_{\\mathrm{legacy}}$", "$C_{\\mathrm{narrow}}$"]) {
    assert.ok(labels.includes(label), `expected ${label} to retain its l= label`);
  }
});
