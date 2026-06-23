import assert from "node:assert/strict";
import test from "node:test";
import { tikzFeynhandExtension, tikzToSvg } from "../src/index.js";

test("exposes tikz-feynhand as a built-in extension module", () => {
  assert.equal(tikzFeynhandExtension.name, "tikz-feynhand");
  assert.ok(tikzFeynhandExtension.commands.includes("propag"));
});

test("expands common tikz-feynhand vertices and propagators", () => {
  const source = String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-feynhand}
\begin{document}
\begin{tikzpicture}
  \begin{feynhand}
    \vertex [particle] (e1) at (0,1.2) {$e^-$};
    \vertex [particle] (e2) at (0,-1.2) {$e^+$};
    \vertex [dot] (v1) at (1,0) {};
    \vertex [ringdot] (v2) at (2.4,0) {};
    \vertex [blob] (b) at (3.5,1) {};
    \vertex [crossdot] (x) at (3.5,-1) {};
    \propag [fer, Blue, mom={$p$}] (e1) to [edge label=$k$] (v1);
    \propag [antfer, Red] (e2) to (v1);
    \propag [pho, Orange] (v1) to [out=20,in=160] (v2);
    \propag [glu, Green] (v2) to (b);
    \propag [sca, Purple, edge label'=$m$] (v2) to (x);
    \propag [chabos, top] (b) to (x);
  \end{feynhand}
\end{tikzpicture}
\end{document}`;

  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text.includes("$e^-$")));
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text.includes("$k$")));
  assert.ok(result.ir.items.some((item) => item.type === "nodeBox" && item.subtype === "feynhand-dot"));
  assert.ok(result.ir.items.some((item) => item.type === "nodeBox" && item.subtype === "feynhand-blob"));
  assert.ok(result.ir.items.some((item) => item.type === "path" && item.subtype === "feynhand-fermion"));
  assert.ok(result.ir.items.some((item) => item.type === "path" && item.subtype === "feynhand-gluon"));
  assert.ok(result.ir.items.some((item) => item.type === "path" && item.subtype === "feynhand-boson"));
  assert.ok(result.ir.items.some((item) => item.type === "path" && item.subtype === "feynhand-scalar"));
  assert.ok(result.ir.items.some((item) => item.type === "marker" && item.subtype === "feynhand-momentum"));
});

test("keeps feynhand snake propagators wavy when arrow markings are also present", () => {
  const result = tikzToSvg(String.raw`
\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-feynhand}
\begin{document}
\begin{tikzpicture}
\begin{feynhand}
  \vertex [blob] (b) at (0,1) {};
  \vertex [crossdot] (x) at (0,-1) {};
  \propag [chabos, top] (b) to (x);
\end{feynhand}
\end{tikzpicture}
\end{document}`);
  const boson = result.ir.items.find((item) => item.type === "path" && item.subtype === "feynhand-boson");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(boson, "expected charged boson path");
  assert.ok(boson.commands.length > 8, `expected charged boson to keep snake decoration, got ${boson.commands.length} commands`);
  assert.ok(result.ir.items.some((item) => item.type === "marker" && item.subtype === "feynhand-momentum"), "expected marking arrow on charged boson");
});
