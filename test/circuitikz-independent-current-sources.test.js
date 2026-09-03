import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

const SOURCE = readFileSync(
  new URL("./fixtures/examples/circuitikz/independent-current-arrows.tex", import.meta.url),
  "utf8"
);

function commandSpan(item, axis) {
  const values = item?.commands
    ?.filter((command) => Number.isFinite(command[axis]))
    .map((command) => command[axis]) || [];
  return Math.max(...values) - Math.min(...values);
}

test("selects the European or American independent current-source interior", () => {
  const result = tikzToSvg(SOURCE, { margin: 0, mathRenderer: "svg-text" });
  const europeanLines = result.ir.items.filter((item) => item.subtype === "circuitikz-isource-line");
  const americanShafts = result.ir.items.filter((item) => item.subtype === "circuitikz-isource-arrow-shaft");
  const americanHeads = result.ir.items.filter((item) => item.subtype === "circuitikz-isource-arrow-head");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(europeanLines.length, 1, "default European current source should contain one diameter line");
  assert.equal(americanShafts.length, 2, "explicit American sources should contain arrow shafts");
  assert.equal(americanHeads.length, 2, "explicit American sources should contain currarrow heads");
  assert.ok(europeanLines[0].commands.every((command) => command.x === 1));
  assert.ok(americanShafts.every((item) => item.style.markerEnd === undefined));
  assert.ok(americanHeads.every((item) => item.style.fill === item.style.stroke));
  assert.ok(americanHeads.every((item) => item.commands.at(-1).type === "closePath"));
});

test("uses Rlen/current arrow scale for independent and DC currarrow geometry", () => {
  const result = tikzToSvg(SOURCE, { margin: 0, mathRenderer: "svg-text" });
  const americanHeads = result.ir.items.filter((item) => item.subtype === "circuitikz-isource-arrow-head");
  const dcHead = result.ir.items.find((item) => item.subtype === "circuitikz-dc-current-source-arrow-head");

  const defaultSpan = commandSpan(americanHeads[0], "x");
  const enlargedSpan = commandSpan(americanHeads[1], "x");
  const reducedSpan = commandSpan(dcHead, "x");

  assert.ok(Math.abs(defaultSpan - 0.14875) < 0.0001, `expected scale=16 currarrow span, got ${defaultSpan}`);
  assert.ok(Math.abs(enlargedSpan - 0.2975) < 0.0001, `expected scale=8 currarrow span, got ${enlargedSpan}`);
  assert.ok(Math.abs(reducedSpan - 0.099167) < 0.0001, `expected scale=24 currarrow span, got ${reducedSpan}`);
});

test("supports current-source aliases and explicit style overrides", () => {
  const result = tikzToSvg(String.raw`
    \begin{circuitikz}[american]
      \draw (0,0) to[I] (2,0);
      \draw (0,-1) to[isourceEU] (2,-1);
      \draw (0,-2) to[isourceAM] (2,-2);
    \end{circuitikz}
  `, { margin: 0, mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ir.items.filter((item) => item.subtype === "circuitikz-isource-arrow-head").length, 2);
  assert.equal(result.ir.items.filter((item) => item.subtype === "circuitikz-isource-line").length, 1);
});
