import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

const FIXTURE = new URL("./fixtures/examples/automata/initial-accepting-states.tex", import.meta.url);
const OUTPUT_FIXTURE = new URL("./fixtures/examples/automata/state-with-output.tex", import.meta.url);
const ACCEPTING_FIXTURE = new URL("./fixtures/examples/automata/accepting-arrows.tex", import.meta.url);
const DIAMOND_FIXTURE = new URL("./fixtures/examples/automata/initial-by-diamond.tex", import.meta.url);

test("renders automata state, accepting double outline, and directional initial arrows", () => {
  const result = tikzToSvg(readFileSync(FIXTURE, "utf8"), { mathRenderer: "svg-text" });
  const initialArrows = result.ir.items.filter((item) => item.type === "path" && item.subtype === "automata-initial");
  const initialLabels = result.ir.items.filter((item) => item.type === "textNode" && item.subtype === "automata-initial-text");
  const accepting = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "q1");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(accepting?.shape, "circle");
  assert.equal(accepting?.doubleColor, true);
  assert.equal(initialArrows.length, 4);
  assert.equal(initialLabels.length, 4);
  assert.deepEqual(initialLabels.map((item) => item.text), ["start", "entry", "start", "start"]);
  assert.ok(initialArrows.every((item) => item.style.markerEnd?.kind === "stealth"));

  const [left, right, above, below] = initialArrows.map((item) => item.commands);
  assert.ok(left[0].x < left[1].x);
  assert.ok(right[0].x > right[1].x);
  assert.ok(above[0].y > above[1].y);
  assert.ok(below[0].y < below[1].y);
  assert.ok(Math.abs(below[0].y - below[1].y) > Math.abs(above[0].y - above[1].y));
  assert.match(result.svg, /class="tikz-bpmn-double"/);
  assert.match(result.svg, />entry<\/text>/);
  assert.match(result.svg, /class="tikz-arrowed-path"/);

  const browserResult = tikzToSvg(readFileSync(FIXTURE, "utf8"));
  assert.match(browserResult.svg, /text-anchor="end"[^>]*>start<\/text>/);
  assert.match(browserResult.svg, /text-anchor="start"[^>]*>entry<\/text>/);

  const withoutDefaultLabel = tikzToSvg(String.raw`
    \begin{tikzpicture}
      \node[state,initial,initial text=] at (0,0) {};
    \end{tikzpicture}
  `, { mathRenderer: "svg-text" });
  assert.deepEqual(withoutDefaultLabel.diagnostics, []);
  assert.equal(withoutDefaultLabel.ir.items.filter((item) => item.subtype === "automata-initial-text").length, 0);
});

test("renders automata state with output as a circle split with a lower anchor", () => {
  const result = tikzToSvg(readFileSync(OUTPUT_FIXTURE, "utf8"), { mathRenderer: "svg-text" });
  const states = result.ir.items.filter((item) => item.type === "nodeBox" && item.shape === "circleSplit");
  const labels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  const lowerGuide = result.ir.items.at(-1);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(states.map((item) => item.id), ["idle", "ready", "done"]);
  assert.ok(states.every((item) => item.shapeData?.circleSplit?.parts?.length === 2));
  assert.ok(states.every((item) => item.width === item.height));
  assert.ok(labels.includes("idle") && labels.includes("ready") && labels.includes("done"));
  assert.ok(!labels.some((item) => /nodepart/.test(item)));
  assert.ok(lowerGuide.commands[0].y < 0 && lowerGuide.commands[1].y < 0);
  assert.match(result.svg, /tikz-node-circle-split/);
  assert.match(result.svg, /tikz-bpmn-double/);
});

test("renders directional automata accepting arrows with text and distance", () => {
  const result = tikzToSvg(readFileSync(ACCEPTING_FIXTURE, "utf8"), { mathRenderer: "svg-text" });
  const arrows = result.ir.items.filter((item) => item.type === "path" && item.subtype === "automata-accepting");
  const labels = result.ir.items.filter((item) => item.type === "textNode" && item.subtype === "automata-accepting-text");
  const byId = Object.fromEntries(arrows.map((item) => [item.nodeId, item]));

  assert.deepEqual(result.diagnostics, []);
  assert.equal(arrows.length, 4);
  assert.deepEqual(labels.map((item) => item.text), ["finish", "halt", "done"]);
  assert.ok(byId.top.commands[1].y > byId.top.commands[0].y);
  assert.ok(byId.right.commands[1].x > byId.right.commands[0].x);
  assert.ok(byId.bottom.commands[1].y < byId.bottom.commands[0].y);
  assert.ok(byId.left.commands[1].x < byId.left.commands[0].x);
  assert.ok(byId.right.commands[1].x - byId.right.commands[0].x > 0.6);
  assert.ok(arrows.every((item) => item.style.markerEnd));
});

test("lets automata initial by diamond override the state circle", () => {
  const result = tikzToSvg(readFileSync(DIAMOND_FIXTURE, "utf8"), { mathRenderer: "svg-text" });
  const nodes = result.ir.items.filter((item) => item.type === "nodeBox");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(nodes.map((item) => item.shape), ["diamond", "diamond"]);
  assert.equal(result.ir.items.filter((item) => item.subtype === "automata-initial").length, 0);
  assert.ok(nodes[1].width > nodes[0].width);
  assert.ok(nodes[0].width > 0.99 && nodes[0].width < 1.02, `unexpected natural diamond width: ${nodes[0].width}`);
  assert.ok(nodes[1].width > 1.19 && nodes[1].width < 1.21, `unexpected minimum-size diamond width: ${nodes[1].width}`);
  assert.match(result.svg, /<polygon points=/);
});
