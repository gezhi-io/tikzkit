import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { TIKZ_UNIT } from "../src/tikz/metrics.js";

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

test("matches Circuitikz coil linewidth expansion and choke core baseline", () => {
  const source = String.raw`\begin{tikzpicture}
  \draw[thick] (0,0) to[cute inductor] (3,0);
  \draw[thick] (0,-1) to[cute choke, twolineschoke] (3,-1);
\end{tikzpicture}`;
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  const [inductor] = result.ir.items.filter((item) => item.subtype === "circuitikz-inductor");
  const [choke] = result.ir.items.filter((item) => item.subtype === "circuitikz-choke");
  const cores = result.ir.items.filter((item) => item.subtype === "circuitikz-choke-core");
  const coilXs = inductor.commands.flatMap((command) => [command.x, command.x1, command.x2]).filter(Number.isFinite);
  const firstCoilPoint = inductor.commands[0];
  const firstChokePoint = choke.commands[0];

  assert.deepEqual(result.diagnostics, []);
  assert.equal(cores.length, 2);
  assert.ok(
    Math.abs((Math.max(...coilXs) - Math.min(...coilXs)) - (inductor.bodyLength + inductor.style.lineWidth / TIKZ_UNIT)) < 1e-6,
    "Circuitikz expands the coil extent by one complete bipole line width"
  );
  assert.ok(
    Math.abs(firstCoilPoint.y + 0.2 * inductor.style.lineWidth / TIKZ_UNIT) < 1e-6,
    "Circuitikz offsets the coil baseline by 0.4 of the incoming line width"
  );
  assert.ok(cores.every((core, index) => {
    const expectedOffset = (1.3 + index * 0.3) * 0.15 * 1.4;
    return Math.abs((core.commands[0].y - firstChokePoint.y) - expectedOffset) < 1e-6;
  }), "the choke core shares the coil baseline correction before its cdist offset");
});
