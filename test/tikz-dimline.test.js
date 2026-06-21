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
  assert.ok(result.ir.items.filter((item) => item.subtype === "dimline-tick").length >= 6);
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "$2.0$"));
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "custom"));
});
