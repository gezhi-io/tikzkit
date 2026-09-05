import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

const SOURCE = readFileSync(
  new URL("./fixtures/examples/circuitikz/controlled-source-variants.tex", import.meta.url),
  "utf8"
);

function lineLength(item) {
  const [start, end] = item.commands;
  return Math.hypot(end.x - start.x, end.y - start.y);
}

function diamondDiameter(item) {
  const start = item.commands[0];
  const end = item.commands[2];
  return Math.hypot(end.x - start.x, end.y - start.y);
}

test("renders empty and cute controlled circuitikz source variants", () => {
  const result = tikzToSvg(SOURCE, { margin: 0, mathRenderer: "svg-text" });
  const empty = result.ir.items.filter((item) => item.subtype === "circuitikz-empty-controlled-source");
  const cuteVoltage = result.ir.items.filter((item) => item.subtype === "circuitikz-cute-controlled-voltage-source");
  const cuteCurrent = result.ir.items.filter((item) => item.subtype === "circuitikz-cute-controlled-current-source");
  const voltageSymbols = result.ir.items.filter((item) => item.subtype === "circuitikz-cute-controlled-voltage-source-line");
  const currentSymbols = result.ir.items.filter((item) => item.subtype === "circuitikz-cute-controlled-current-source-line");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(empty.length, 2, "expected both ecsource aliases to render empty diamonds");
  assert.equal(cuteVoltage.length, 2, "expected both cute controlled voltage aliases");
  assert.equal(cuteCurrent.length, 2, "expected both cute controlled current aliases");
  assert.equal(voltageSymbols.length, 2);
  assert.equal(currentSymbols.length, 2);
  assert.ok([...empty, ...cuteVoltage, ...cuteCurrent].every((item) => item.shape === "diamond"));
  assert.ok(voltageSymbols.every((item) => item.style.lineCap === "round"));
  assert.ok(currentSymbols.every((item) => item.style.lineCap === "round"));
  assert.ok(voltageSymbols.every((item) => item.style.lineJoin === "miter"));
  assert.ok(currentSymbols.every((item) => item.style.lineJoin === "miter"));
  assert.ok(voltageSymbols.every((item) => Math.abs(item.style.lineWidth / cuteVoltage[0].style.lineWidth - 3) < 1e-6));
  assert.ok(currentSymbols.every((item) => Math.abs(item.style.lineWidth / cuteCurrent[0].style.lineWidth - 3) < 1e-6));
  assert.ok(Math.abs(lineLength(voltageSymbols[0]) / diamondDiameter(cuteVoltage[0]) - 0.6) < 1e-6);
  assert.ok(Math.abs(lineLength(currentSymbols[0]) / diamondDiameter(cuteCurrent[0]) - 0.6) < 1e-6);
  assert.equal(empty[0].style.stroke, "blue");
  assert.equal(cuteVoltage[0].style.fill, "rgb(255 230 230)");
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "$e$"));
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "$v_c$"));
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "$i_c$"));
  assert.equal(
    result.ir.items.filter((item) => item.subtype === "circuitikz-controlled-current-source-arrow").length,
    0,
    "cute current sources use a thick round line rather than an American arrow"
  );
});
