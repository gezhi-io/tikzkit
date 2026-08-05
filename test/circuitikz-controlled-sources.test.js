import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

const SOURCE = readFileSync(
  new URL("./fixtures/examples/circuitikz/controlled-sources.tex", import.meta.url),
  "utf8"
);

test("renders circuitikz controlled sources as scaled diamond symbols", () => {
  const result = tikzToSvg(SOURCE, { margin: 0, mathRenderer: "svg-text" });
  const controlled = result.ir.items.filter((item) => item.subtype?.startsWith("circuitikz-controlled-"));
  const diamonds = controlled.filter((item) => item.shape === "diamond");
  const americanVoltage = diamonds.find((item) => item.subtype === "circuitikz-controlled-voltage-source");
  const left = americanVoltage?.commands?.[0];
  const right = americanVoltage?.commands?.[2];

  assert.deepEqual(result.diagnostics, []);
  assert.equal(diamonds.length, 4);
  assert.equal(controlled.filter((item) => item.subtype === "circuitikz-controlled-voltage-source-line").length, 1);
  assert.equal(controlled.filter((item) => item.subtype === "circuitikz-controlled-current-source-line").length, 1);
  assert.equal(controlled.filter((item) => item.subtype === "circuitikz-controlled-current-source-arrow").length, 1);
  assert.ok(left && right, "expected controlled-voltage diamond path");
  assert.ok(Math.abs(right.y - left.y) > 1.15, `expected csources/scale=1.2 span, got ${JSON.stringify({ left, right })}`);
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "+"));
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "-"));
  assert.equal(result.ir.items.filter((item) => item.subtype === "circuitikz-current-arrow").length, 1);

  const voltageLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "$g v_x$");
  const componentLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "$\\mu v_x$");
  const currentLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "$g i_x$");
  assert.ok(voltageLabel?.x < -0.7, `expected cV label outside the source, got ${JSON.stringify(voltageLabel)}`);
  assert.ok(componentLabel?.x < 4.3, `expected l= label outside the source, got ${JSON.stringify(componentLabel)}`);
  assert.ok(currentLabel?.y > 2, `expected cI value on the post-source current arrow, got ${JSON.stringify(currentLabel)}`);
});
