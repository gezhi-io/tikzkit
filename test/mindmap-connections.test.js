import assert from "node:assert/strict";
import test from "node:test";

import { parseTikz } from "../src/parser.js";
import { interpretTikz } from "../src/interpreter.js";
import { wrapTeXTextLineByWidth } from "../src/tikz/textMetrics.js";

test("mindmap concept-color children retain parent and child colors on generated connections", () => {
  const source = String.raw`
\begin{tikzpicture}
  \path[mindmap,concept color=black,text=white]
    node[concept] {Root}
    [clockwise from=0]
    child[concept color=blue] { node[concept] {Blue} }
    child[concept color=red] { node[concept] {Red} };
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const edges = ir.items.filter((item) => item.type === "path" && item.subtype === "tree-edge");

  assert.deepEqual(diagnostics, []);
  assert.equal(edges.length, 2);
  assert.deepEqual(
    edges.map((edge) => ({ from: edge.style.mindmapConnection?.from, to: edge.style.mindmapConnection?.to })),
    [
      { from: "black", to: "blue" },
      { from: "black", to: "red" }
    ]
  );
  assert.ok(edges.every((edge) => edge.style.mindmapConnection?.paint === "fill"));
  assert.ok(edges.every((edge) => edge.style.stroke === "none"));
  assert.ok(edges.every((edge) => edge.commands.at(-1)?.type === "closePath"));

});

test("nested mindmaps consume clockwise-from for one child generation", () => {
  const source = String.raw`
\begin{tikzpicture}
  \path[mindmap,concept color=black]
    node[concept] {Root}
    child[concept color=blue] {
      node[concept] {Branch}
      [clockwise from=90]
      child { node[concept] {Top} }
      child { node[concept] {Right} }
    };
\end{tikzpicture}`;
  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const labels = Object.fromEntries(
    ir.items
      .filter((item) => item.type === "textNode")
      .map((item) => [item.text, { x: item.x, y: item.y }])
  );

  assert.deepEqual(diagnostics, []);
  assert.equal(labels.Top.x, labels.Branch.x);
  assert.ok(labels.Top.y > labels.Branch.y);
  assert.ok(labels.Right.x > labels.Branch.x);
});

test("manual TeX discretionary hyphens only appear when a concept paragraph needs them", () => {
  assert.deepEqual(
    wrapTeXTextLineByWidth("pro\u00adgramming languages", 1.5, 0.8, { lineBreakMode: "center" }),
    ["pro-", "gramming", "languages"]
  );
  assert.deepEqual(
    wrapTeXTextLineByWidth("pro\u00adgramming", 3, 0.8, { lineBreakMode: "center" }),
    ["programming"]
  );
});
