import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg, tikzquadsExtension } from "../src/index.js";

test("exposes tikzquads as a built-in extension module", () => {
  assert.equal(tikzquadsExtension.name, "tikzquads");
  assert.equal(tikzquadsExtension.phase, "preprocess");
  assert.ok(tikzquadsExtension.commands.includes("QuadParConnect"));
});

test("renders quadripole nodes with electrical ports and anchors", () => {
  const source = String.raw`
\documentclass[crop,tikz]{standalone}
\usepackage{circuitikz}
\usepackage{tikzquads}
\begin{document}
\begin{tikzpicture}
  \draw (0,0) node[Quad Z, Z11=$Z_a$, Z12=$Z_b$, I1=$I_a$, V2=$V_b$](Q){two port};
  \draw[->] (Q.1+) -- ++(-1,0);
  \draw[->] (Q.2-) -- ++(1,0);
\end{tikzpicture}
\end{document}`;
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.items.some((item) => item.type === "nodeBox" && item.shape === "tikzquadsQuad"));
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text.includes("two port")));
  assert.match(result.svg, /tikz-node-tikzquadsQuad/);
  assert.match(result.svg, /Z_a/);
});

test("expands QuadParConnect and PG load line into drawable TikZ", () => {
  const source = String.raw`
\documentclass[crop,tikz]{standalone}
\usepackage{tikzquads}
\begin{document}
\begin{tikzpicture}
  \node[Quad](A) at (0,0) {$Q_A$};
  \node[Quad H](B) at (0,-2) {$Q_B$};
  \QuadParConnect[right,down,spacing=.2](A)(B)
  \node[PG load line, x axis=$V$, y axis=$I$, x val=$V_{th}$, y val=$I_N$] at (4,-1) {};
\end{tikzpicture}
\end{document}`;
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.items.filter((item) => item.type === "path" && item.subtype === "tikzquads-parallel-connect").length >= 2);
  assert.ok(result.ir.items.some((item) => item.type === "nodeBox" && item.shape === "tikzquadsPgLoadLine"));
  assert.match(result.svg, /V_\{th\}/);
});
