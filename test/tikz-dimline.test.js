import assert from "node:assert/strict";
import test from "node:test";
import { tikzDimlineExtension, tikzToSvg } from "../src/index.js";

test("exposes tikz-dimline as a built-in extension module", () => {
  assert.equal(tikzDimlineExtension.name, "tikz-dimline");
  assert.equal(tikzDimlineExtension.phase, "preprocess");
  assert.ok(tikzDimlineExtension.commands.includes("dimline"));
  assert.equal(typeof tikzDimlineExtension.preprocess, "function");
});

test("expands tikz-dimline commands into dimension paths, extensions, ticks, and labels", () => {
  const result = tikzToSvg(String.raw`
\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-dimline}
\begin{document}
\begin{tikzpicture}
  \draw (0,0) rectangle (2,1);
  \dimline[color=blue,line style={line width=0.7},extension start length=0.4,extension end length=0.4]{(0,1.4)}{(2,1.4)}{$2.0$};
  \dimline[color=red,line style={arrows=dimline reverse-dimline reverse},label style={above=0.5ex,font=\tiny}]{(0,-0.4)}{(0.4,-0.4)}{0.4};
  \dimline[label style={above=0.5ex,fill=blue!10},extension start path={(0,2) (0,1.7) (0.3,1.4)},extension end path={(2,2) (2,1.7) (1.7,1.4)}]{(0,2)}{(2,2)}{custom};
\end{tikzpicture}
\end{document}`);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ir.items.filter((item) => item.subtype === "dimline-line").length, 3);
  assert.ok(result.ir.items.filter((item) => item.subtype === "dimline-extension").length >= 6);
  assert.equal(result.ir.items.filter((item) => item.subtype === "dimline-tick").length, 0);
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "$2.0$"));
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "custom"));
});

test("matches tikz-dimline default sloped labels and custom dimline arrows", () => {
  const result = tikzToSvg(String.raw`
\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-dimline}
\begin{document}
\begin{tikzpicture}
  \dimline[color=blue,line style={line width=.7pt},label style={right=0.5ex,font=\small},extension start length=.35,extension end length=.35]{(2.7,0)}{(2.7,4)}{$4.0$}
\end{tikzpicture}
\end{document}`);

  assert.deepEqual(result.diagnostics, []);
  const line = result.ir.items.find((item) => item.subtype === "dimline-line");
  assert.equal(line?.style.markerStart?.kind, "dimline");
  assert.equal(line?.style.markerEnd?.kind, "dimline");
  assert.equal(result.ir.items.filter((item) => item.subtype === "dimline-tick").length, 0);

  const label = result.ir.items.find((item) => item.type === "textNode" && item.text === "$4.0$");
  assert.ok(label, "expected dimension label text node");
  assert.ok(Math.abs(Math.abs(label.rotation) - 90) < 1e-6, `expected vertical dimline label to be sloped, got ${label.rotation}`);
  assert.ok(label.x < 3, `expected right-side label to stay near the vertical dimension line, got x=${label.x}`);

  const labelBox = result.ir.items.find((item) => item.type === "nodeBox" && item.x === label.x && item.y === label.y);
  assert.equal(labelBox?.rotation, label.rotation);
});
