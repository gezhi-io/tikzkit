import assert from "node:assert/strict";
import test from "node:test";
import { tikzBpmnExtension, tikzToSvg } from "../src/index.js";
import { parseDimension } from "../src/math.js";
import { TIKZ_LINE_WIDTHS } from "../src/tikz-metrics.js";

function convert(body) {
  return tikzToSvg(String.raw`
\documentclass{standalone}
\usepackage{tikz}
\usetikzlibrary{bpmn}
\begin{document}
\begin{tikzpicture}
${body}
\end{tikzpicture}
\end{document}`);
}

function nodeBox(ir, id) {
  return ir.items.find((item) => item.type === "nodeBox" && item.id === id);
}

test("exposes tikz-bpmn as a built-in extension module", () => {
  assert.equal(tikzBpmnExtension.name, "tikz-bpmn");
  assert.equal(tikzBpmnExtension.phase, "preprocess");
  assert.ok(tikzBpmnExtension.commands.includes("task"));
  assert.equal(typeof tikzBpmnExtension.preprocess, "function");
});

test("provides core tikz-bpmn task, event, gateway, and connector styles", () => {
  const { ir, diagnostics } = convert(String.raw`
\node[task] (task) at (0,0) {Task};
\node[start event] (start) at (-2,0) {};
\node[end event] (end) at (2,0) {};
\node[exclusive gateway] (xor) at (0,-1.5) {};
\node[parallel gateway] (and) at (2,-1.5) {};
\draw[sequence] (start) -- (task);
\draw[message] (task) -- (end);
\draw[association] (xor) -- (and);`);

  assert.deepEqual(diagnostics, []);
  assert.equal(nodeBox(ir, "task").shape, "rectangle");
  assert.equal(nodeBox(ir, "task").style.stroke, "black");
  assert.ok(Math.abs(nodeBox(ir, "task").width - parseDimension("4em")) < 1e-6);
  assert.ok(Math.abs(nodeBox(ir, "task").height - parseDimension("2em")) < 1e-6);
  assert.equal(nodeBox(ir, "start").shape, "circle");
  assert.ok(Math.abs(nodeBox(ir, "start").width - parseDimension("1.5em")) < 1e-6);
  assert.equal(nodeBox(ir, "end").style.lineWidth, TIKZ_LINE_WIDTHS.ultraThick);
  assert.equal(nodeBox(ir, "xor").shape, "diamond");
  assert.equal(nodeBox(ir, "and").shape, "diamond");
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text.includes("\\texttimes")));
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text.includes("+")));

  const paths = ir.items.filter((item) => item.type === "path");
  assert.equal(paths[0].style.markerEnd.kind, "to");
  assert.equal(paths[1].style.markerEnd.kind, "to");
  assert.ok(paths[1].style.dashArray.length > 0);
  assert.ok(paths[2].style.dashArray.length > 0);
});

test("renders common tikz-bpmn event and task icons as node overlays", () => {
  const { ir, svg, diagnostics } = convert(String.raw`
\node[message start event] (msg) at (0,0) {};
\node[timer intermediate event] (timer) at (1,0) {};
\node[signal end event] (signal) at (2,0) {};
\node[subprocess] (sub) at (0,-1.5) {Sub};
\node[loop task] (loop) at (2,-1.5) {Loop};
\node[data object] (data) at (4,-1.5) {};`);

  assert.deepEqual(diagnostics, []);
  assert.equal(nodeBox(ir, "msg").bpmnIcon, "message");
  assert.equal(nodeBox(ir, "timer").bpmnIcon, "timer");
  assert.equal(nodeBox(ir, "timer").doubleColor, "white");
  assert.equal(nodeBox(ir, "signal").bpmnIcon, "signal-fill");
  assert.equal(nodeBox(ir, "sub").bpmnMarker, "subprocess");
  assert.equal(nodeBox(ir, "loop").bpmnMarker, "loop");
  assert.equal(nodeBox(ir, "data").bpmnIcon, "data-object");
  assert.match(svg, /tikz-bpmn-icon tikz-bpmn-message/);
  assert.match(svg, /tikz-bpmn-icon tikz-bpmn-timer/);
  assert.match(svg, /tikz-bpmn-marker tikz-bpmn-subprocess/);
});
