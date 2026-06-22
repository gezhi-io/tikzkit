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
  assert.match(result.svg, /V_th|V_\{th\}/);
});

test("matches native tikzquads Case 120 geometry and label keys", () => {
  const source = String.raw`
\documentclass[crop,tikz]{standalone}
\usepackage{circuitikz}
\usepackage{tikzquads}
\begin{document}
\begin{tikzpicture}
  \node[Quad,I1=$I_a$,V2=$V_b$,label top center=$Q_a$] (Qa) at (0,0) {$Q_a$};
  \node[Quad,I1=$I_b$,V2=$V_o$,label bottom center=$Q_b$] (Qb) at (0,-2) {$Q_b$};
  \QuadParConnect[right,down,spacing=.15]{Qa}{Qb}
  \node[Black Box,I1=$I_L$,V1=$V_L$,label top center=Load] (Load) at (3.3,-1) {};
  \draw[->] (Qa.2+) -- (Load.1+);
  \draw[->] (Load.1-) -- (Qa.2-);
\end{tikzpicture}
\end{document}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const boxes = Object.fromEntries(result.ir.items.filter((item) => item.type === "nodeBox" && item.id).map((item) => [item.id, item]));
  const arrows = result.ir.items.filter((item) => item.type === "path" && item.style?.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.abs(boxes.Qa.width - 6.6) < 0.01, `expected native Quad outer width, got ${boxes.Qa.width}`);
  assert.ok(Math.abs(boxes.Qa.height - 2.8) < 0.01, `expected native Quad height, got ${boxes.Qa.height}`);
  assert.ok(Math.abs(boxes.Load.width - 3.8) < 0.01, `expected native Black Box outer width, got ${boxes.Load.width}`);
  assert.ok(Math.abs(boxes.Load.height - 2.8) < 0.01, `expected native Black Box height, got ${boxes.Load.height}`);
  assert.equal(boxes.Qa.tikzquadsOptions["label top center"], "$Q_a$");
  assert.equal(boxes.Qb.tikzquadsOptions["label bottom center"], "$Q_b$");
  assert.equal(boxes.Load.tikzquadsOptions["label top center"], "Load");
  assert.ok(Math.abs(arrows[0].commands[0].x - 3.3) < 0.01, `expected arrow to start at Qa.2+, got ${arrows[0].commands[0].x}`);
  assert.ok(Math.abs(arrows[0].commands.at(-1).x - 1.4) < 0.01, `expected arrow to end at Load.1+, got ${arrows[0].commands.at(-1).x}`);
  assert.ok(Math.abs(arrows[1].commands[0].x - 1.4) < 0.01, `expected return arrow to start at Load.1-, got ${arrows[1].commands[0].x}`);
  assert.ok(Math.abs(arrows[1].commands.at(-1).x - 3.3) < 0.01, `expected return arrow to end at Qa.2-, got ${arrows[1].commands.at(-1).x}`);
  assert.ok(Math.abs(arrows[1].commands[0].y + 2) < 0.01, `expected return arrow to start at Load.1-, got ${arrows[1].commands[0].y}`);
  assert.ok(Math.abs(arrows[1].commands.at(-1).y + 1) < 0.01, `expected return arrow to end at Qa.2-, got ${arrows[1].commands.at(-1).y}`);
});

test("renders tikzquads shape labels through the shared math text fallback", () => {
  const source = String.raw`
\documentclass[crop,tikz]{standalone}
\usepackage{tikzquads}
\begin{document}
\begin{tikzpicture}
  \node[Quad,I1=$I_a$,V2=$V_b$,label top center=$Q_a$] (Qa) at (0,0) {$Q_a$};
  \node[PG load line,x axis=$V$,y axis=$I$,x val=$V_{th}$,y val=$I_N$] at (4,0) {};
\end{tikzpicture}
\end{document}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.doesNotMatch(result.svg, />I_a</);
  assert.doesNotMatch(result.svg, />V_\{th\}</);
  assert.match(result.svg, /<tspan>I<\/tspan><tspan[^>]+baseline-shift="sub">a<\/tspan>/);
  assert.match(result.svg, /<tspan>V<\/tspan><tspan[^>]+baseline-shift="sub">th<\/tspan>/);
});
