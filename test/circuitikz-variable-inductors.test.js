import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

const SOURCE = readFileSync(
  new URL("./fixtures/examples/circuitikz/inductors.tex", import.meta.url),
  "utf8"
);

test("renders Circuitikz European vL arrows with native tip, direction, and thickness", () => {
  const result = tikzToSvg(SOURCE, { margin: 0, mathRenderer: "svg-text" });
  const inductors = result.ir.items.filter((item) => item.subtype === "circuitikz-inductor");
  const arrows = result.ir.items.filter((item) => item.subtype === "circuitikz-inductor-tunable-arrow");
  const labels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(inductors.length, 5);
  assert.equal(arrows.length, 2);
  assert.ok(arrows.every((arrow) => arrow.style.markerEnd.kind === "latexslim"));
  assert.deepEqual(arrows.map((arrow) => arrow.direction), [
    "bottom-left-to-top-right",
    "top-left-to-bottom-right"
  ]);
  assert.ok(arrows[0].commands[1].y > arrows[0].commands[0].y, "the default European arrow should ascend");
  assert.ok(arrows[1].commands[1].y < arrows[1].commands[0].y, "the legacy European arrow should descend");
  assert.ok(arrows[1].style.lineWidth < arrows[0].style.lineWidth, "inductors/modifier thickness should reduce the control arrow");
  for (const label of ["$L_{\\mathrm{variable}}$", "$L_{\\mathrm{legacy}}$"]) {
    assert.ok(labels.includes(label), `expected ${label} label`);
  }
});

test("keeps cute vL's intrinsic direction while American vL honors the global switch", () => {
  const source = String.raw`\begin{tikzpicture}
  \ctikzset{inductor=american,bipoles/fix tunable direction=false}
  \draw (0,0) to[vL] (3,0);
  \ctikzset{inductor=cute}
  \draw (0,-2) to[vL] (3,-2);
\end{tikzpicture}`;
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  const arrows = result.ir.items.filter((item) => item.subtype === "circuitikz-inductor-tunable-arrow");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(arrows.length, 2);
  assert.ok(arrows.every((arrow) => arrow.style.markerEnd.kind === "latexslim"));
  assert.deepEqual(arrows.map((arrow) => arrow.direction), [
    "top-left-to-bottom-right",
    "bottom-left-to-top-right"
  ]);
});
