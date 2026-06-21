import assert from "node:assert/strict";
import test from "node:test";
import { tikzExtExtension, tikzToSvg } from "../src/index.js";

test("exposes tikz-ext as a built-in extension module", () => {
  assert.equal(tikzExtExtension.name, "tikz-ext");
  assert.ok(tikzExtExtension.libraries.includes("ext.paths.ortho"));
});

test("supports core tikz-ext path operations and mirror transforms", () => {
  const source = String.raw`\documentclass[tikz,border=10pt]{standalone}
\usetikzlibrary{ext.paths.ortho,ext.paths.arcto,ext.topaths.arcthrough,ext.transformations.mirror}
\begin{document}
\begin{tikzpicture}[very thick]
  \coordinate (A) at (0,0);
  \coordinate (B) at (3,2);
  \coordinate (C) at (1,2.5);
  \draw[blue] (A) -|- node[pos=.5,above] {hvh} (B);
  \draw[red] (0,-.5) |-| node[pos=.5,right] {vhv} (3,1.5);
  \draw[green!60!black] (A) r-ud node[pos=.5,above] {ud} (B);
  \draw[purple] (A) arc to[radius=2.5,clockwise] node[midway] {arc to} (B);
  \draw[orange] (A) to[ext/arc through={clockwise,(C)}] (B) -- (arc through center) -- cycle;
  \node[draw,shape=superellipse,minimum width=1.4cm,minimum height=.7cm] at (4,1.5) {S};
  \node[draw,shape=circle cross split,minimum size=.9cm] at (4,0) {};
  \begin{scope}[ext/xmirror=1.5]
    \draw[dashed] (0,.25) -- (1,.75);
  \end{scope}
\end{tikzpicture}
\end{document>`;

  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text.includes("hvh")));
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text.includes("arc to")));
  assert.ok(result.ir.items.some((item) => item.type === "path" && item.subtype === "tikz-ext-ortho"));
  assert.ok(result.ir.items.some((item) => item.type === "path" && item.subtype === "tikz-ext-arc"));
  assert.ok(result.ir.items.some((item) => item.type === "nodeBox" && item.shape === "superellipse"));
  assert.ok(result.ir.items.some((item) => item.type === "nodeBox" && item.shape === "circleCrossSplit"));
  assert.ok(result.ir.items.some((item) => item.type === "path" && item.commands?.some((command) => command.type === "closePath")));
});
