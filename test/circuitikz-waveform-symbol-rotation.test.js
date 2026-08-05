import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

const SOURCE = readFileSync(
  new URL("./fixtures/examples/circuitikz/waveform-symbol-rotation.tex", import.meta.url),
  "utf8"
);

function waveformDirection(commands) {
  const start = commands[0];
  const end = commands.at(-1);
  return {
    x: Math.abs(end.x - start.x),
    y: Math.abs(end.y - start.y)
  };
}

test("renders circuitikz waveform symbols in their configured local rotation", () => {
  const result = tikzToSvg(SOURCE, { margin: 0, mathRenderer: "svg-text" });
  const squares = result.ir.items.filter((item) => item.subtype === "circuitikz-square-source-wave");
  const triangles = result.ir.items.filter((item) => item.subtype === "circuitikz-triangular-source-wave");
  const sines = result.ir.items.filter((item) => item.subtype === "circuitikz-sinusoidal-source-wave");
  const controlledSines = result.ir.items.filter((item) => item.subtype === "circuitikz-controlled-sinusoidal-source-wave");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(squares.length, 4, "expected square sources to produce their internal five-segment symbol");
  assert.equal(triangles.length, 2, "expected triangle sources to produce their internal triangular symbol");
  assert.equal(sines.length, 1);
  assert.equal(controlledSines.length, 1);
  assert.equal(squares[0].commands.filter((command) => command.type === "lineTo").length, 5);
  assert.equal(triangles[0].commands.filter((command) => command.type === "lineTo").length, 3);

  const defaultHorizontal = waveformDirection(squares[0].commands);
  const defaultVertical = waveformDirection(squares[1].commands);
  const autoHorizontal = waveformDirection(squares[2].commands);
  const autoVertical = waveformDirection(squares[3].commands);
  assert.ok(defaultHorizontal.y > defaultHorizontal.x, "default 90-degree waveform rotates with a horizontal component");
  assert.ok(defaultVertical.x > defaultVertical.y, "default 90-degree waveform rotates with a vertical component");
  assert.ok(autoHorizontal.x > autoHorizontal.y, "auto waveform keeps a horizontal global orientation");
  assert.ok(autoVertical.x > autoVertical.y, "auto waveform cancels the vertical component angle");
  assert.ok(Math.abs(sines[0].rotation - 45) < 1e-9, "expected numeric sources/symbol/rotate to reach the sine wave");
  const controlledAuto = waveformDirection(controlledSines[0].commands);
  assert.ok(controlledAuto.x > controlledAuto.y, "expected csources/symbol/rotate=auto to retain its global orientation");
  assert.ok(Math.abs(controlledSines[0].rotation - 90) < 1e-9, "expected auto to counter-rotate the vertical controlled source");
});
