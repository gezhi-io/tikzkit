import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

const FIXTURE = new URL("./fixtures/examples/automata/initial-accepting-states.tex", import.meta.url);

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
