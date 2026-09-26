import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { parseDimension } from "../src/engine/units.js";

function box(options, pictureOptions = "") {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}[${pictureOptions}]
    \node[draw,minimum width=2cm,minimum height=1cm,${options}] {Test};
  \end{tikzpicture}`, { mathRenderer: "svg-text" });
  assert.deepEqual(result.diagnostics, []);
  return result.ir.items.find((item) => item.type === "nodeBox");
}

test("bare node rounded corners use TikZ's 4pt default, not boolean-as-length", () => {
  for (const scale of [1, 2]) {
    assert.ok(Math.abs(box("rounded corners", `scale=${scale}`).rx - parseDimension("4pt")) < 1e-6);
  }
});

test("explicit node corner dimensions and the rounded rectangle shape stay distinct", () => {
  assert.equal(box("rounded corners=0pt").rx, 0);
  assert.ok(Math.abs(box("rounded corners=2pt").rx - parseDimension("2pt")) < 1e-6);
  const capsule = box("rounded rectangle");
  assert.equal(capsule.shape, "roundedRectangle");
  assert.ok(Math.abs(capsule.rx - Math.min(capsule.width, capsule.height) / 2) < 1e-6);
});

test("physics graph node defaults produce rounded boxes rather than capsules", () => {
  const source = readFileSync(new URL("./fixtures/examples/graphs/node-text-physics.tex", import.meta.url), "utf8");
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  assert.deepEqual(result.diagnostics, []);
  const nodes = result.ir.items.filter((item) => item.type === "nodeBox");
  assert.equal(nodes.length, 4);
  assert.ok(nodes.every((item) => Math.abs(item.rx - parseDimension("4pt")) < 1e-6));
});
