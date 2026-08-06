import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

const SOURCE = readFileSync(
  new URL("./fixtures/examples/circuitikz/varcap-diodes.tex", import.meta.url),
  "utf8"
);

test("renders circuitikz varcap diode plate geometry and variants", () => {
  const result = tikzToSvg(SOURCE, { margin: 0, mathRenderer: "svg-text" });
  const varcaps = result.ir.items.filter((item) => item.subtype === "circuitikz-varcap");
  const plates = result.ir.items.filter((item) => item.subtype === "circuitikz-varcap-plates");
  const strokes = result.ir.items.filter((item) => item.subtype === "circuitikz-diode-stroke");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(varcaps.length, 6);
  assert.equal(plates.length, 6);
  assert.equal(strokes.filter((item) => item.diodeKind === "varcap").length, 2);
  assert.ok(varcaps.some((item) => item.variant === "empty" && item.fill === "none"));
  assert.ok(varcaps.some((item) => item.variant === "full" && item.fill === "black"));
  assert.ok(varcaps.some((item) => item.variant === "empty" && item.fill === "rgb(255 217 179)"));
  assert.ok(varcaps.some((item) => item.variant === "empty" && item.fill === "rgb(204 255 204)"));
  assert.ok(varcaps.some((item) => item.variant === "stroke"));
  assert.ok(varcaps.some((item) => item.bodyLength < 0.6));
});

test("uses circuitikz's global diode style for automatic VC symbols", () => {
  const source = String.raw`\documentclass{standalone}
\usepackage{circuitikz}
\begin{document}
\begin{circuitikz}
  \ctikzset{diode=full}
  \draw (0,0) to[VC] (3,0);
  \ctikzset{diode=stroke}
  \draw (0,-2) to[VC] (3,-2);
  \ctikzset{diode=empty}
  \draw (0,-4) to[VC] (3,-4);
\end{circuitikz}
\end{document}`;
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  const varcaps = result.ir.items.filter((item) => item.subtype === "circuitikz-varcap");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(varcaps.map((item) => item.variant), ["full", "stroke", "empty"]);
  assert.equal(varcaps[0].fill, "black");
  assert.equal(varcaps[1].fill, "none");
  assert.equal(varcaps[2].fill, "none");
});
