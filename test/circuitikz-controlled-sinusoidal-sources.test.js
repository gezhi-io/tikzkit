import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

const SOURCE = readFileSync(
  new URL("./fixtures/examples/circuitikz/controlled-sinusoidal-sources.tex", import.meta.url),
  "utf8"
);

test("renders scaled circuitikz controlled sinusoidal sources", () => {
  const result = tikzToSvg(SOURCE, { margin: 0, mathRenderer: "svg-text" });
  const outlines = result.ir.items.filter((item) => item.subtype === "circuitikz-controlled-sinusoidal-source");
  const waves = result.ir.items.filter((item) => item.subtype === "circuitikz-controlled-sinusoidal-source-wave");
  const currentLabelArrow = result.ir.items.find((item) => item.subtype === "circuitikz-current-arrow");
  const currentInnerArrow = result.ir.items.find((item) => item.subtype === "circuitikz-controlled-current-source-arrow");
  const sourceLine = result.ir.items.find((item) => item.subtype === "circuitikz-controlled-voltage-source-line");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(outlines.length, 3, "expected a diamond for every controlled sinusoidal source");
  assert.ok(outlines.every((item) => item.shape === "diamond"));
  assert.ok(outlines.every((item) => item.sourceKind === "sinusoidal"));
  assert.ok(outlines.every((item) => {
    const left = item.commands[0];
    const right = item.commands[2];
    return Math.hypot(right.x - left.x, right.y - left.y) > 1.15;
  }));
  assert.equal(waves.length, 3, "expected one waveform inside every controlled diamond");
  assert.ok(waves.every((item) => item.commands.filter((command) => command.type === "curveTo").length === 4));
  assert.ok(
    Math.abs(waves[0].style.lineWidth - outlines[0].style.lineWidth * 1.5) < 1e-9,
    "expected csources/symbol/thickness to affect the waveform only"
  );
  assert.ok(currentLabelArrow, "expected csI=$...$ to retain its external current annotation");
  assert.equal(currentInnerArrow, undefined, "controlled sinusoidal current sources contain a wave, not the plain-source arrow");
  assert.equal(sourceLine, undefined, "controlled sinusoidal voltage sources contain a wave, not the plain-source line");
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "$g v_x$"));
  assert.equal(
    result.ir.items.filter((item) => item.type === "textNode" && item.text === "$g i_x$").length,
    1,
    "expected csI=$...$ to render once beside its external arrow"
  );
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "$\\mu v_x$"));
});

test("accepts circuitikz controlled sinusoidal source aliases", () => {
  const result = tikzToSvg(String.raw`\begin{circuitikz}
  \draw (0,0) to[cvsourcesin] (2,0);
  \draw (0,1) to[controlled vsourcesin] (2,1);
  \draw (0,2) to[cisourcesin] (2,2);
  \draw (0,3) to[controlled isourcesin] (2,3);
  \draw (0,4) to[controlled sinusoidal current source] (2,4);
  \draw (0,5) to[csV_>=$U$] (2,5);
  \draw (0,6) to[csI_<=$J$] (2,6);
\end{circuitikz}`, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ir.items.filter((item) => item.subtype === "circuitikz-controlled-sinusoidal-source").length, 7);
  assert.equal(result.ir.items.filter((item) => item.subtype === "circuitikz-controlled-sinusoidal-source-wave").length, 7);
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "$U$"));
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "$J$"));
});
