import assert from "node:assert/strict";
import test from "node:test";
import { parseTikz, tikzToSvg } from "../src/index.js";

function render(source) {
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  assert.deepEqual(result.diagnostics, []);
  return result;
}

test("parses labels following an explicit edge from parent operation", () => {
  const result = parseTikz(String.raw`
\begin{tikzpicture}
  \node {root} child {
    node {child}
    edge from parent[dashed] node[left] {$a$} node[right] {$b$}
  };
\end{tikzpicture}`);
  const child = result.ast.pictures[0].statements[0].children[0];

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(child.edgeOptions, { dashed: true });
  assert.deepEqual(
    child.edgeNodes.map((node) => ({ text: node.text, options: node.options })),
    [
      { text: "$a$", options: { left: true } },
      { text: "$b$", options: { right: true } }
    ]
  );
});

test("lowers a curved edge-from-parent template through the shared path builder", () => {
  const result = render(String.raw`
\begin{tikzpicture}[
  grow=down,
  level distance=2cm,
  edge from parent/.style={draw,red,thick,-stealth},
  edge from parent path={(\tikzparentnode.south) .. controls +(0,-6mm) and +(0,6mm) .. (\tikzchildnode.north)}
]
  \node[draw] {root} child {node[draw] {child}};
\end{tikzpicture}`);
  const edge = result.ir.items.find((item) => item.subtype === "tree-edge");

  assert.deepEqual(edge.commands.map((command) => command.type), ["moveTo", "curveTo"]);
  assert.equal(edge.style.stroke, "red");
  assert.equal(edge.style.markerEnd?.kind, "stealth");
});

test("expands tikzleveldistance in a relative orthogonal tree route", () => {
  const result = render(String.raw`
\begin{tikzpicture}[
  grow=down,
  level distance=2cm,
  edge from parent path={(\tikzparentnode.south) -- +(0,-.35\tikzleveldistance) -| (\tikzchildnode.north)}
]
  \node[draw] {root}
    child {node[draw] {left}}
    child {node[draw] {right}};
\end{tikzpicture}`);
  const edges = result.ir.items.filter((item) => item.subtype === "tree-edge");

  assert.equal(edges.length, 2);
  for (const edge of edges) {
    assert.deepEqual(edge.commands.map((command) => command.type), ["moveTo", "lineTo", "lineTo", "lineTo"]);
    assert.equal(edge.commands[0].x, edge.commands[1].x);
    assert.equal(edge.commands[1].y, edge.commands[2].y);
    assert.equal(edge.commands[2].x, edge.commands[3].x);
    assert.ok(Math.abs(edge.commands[1].y - edge.commands[0].y + 0.7) < 1e-9);
  }
});

test("places edge-from-parent labels on the final path operation", () => {
  const result = render(String.raw`
\begin{tikzpicture}[
  grow=down,
  sibling distance=3cm,
  edge from parent path={(\tikzparentnode.south) .. controls +(0,-7mm) and +(0,7mm) .. (\tikzchildnode.north)}
]
  \node[draw] {root}
    child {node[draw] {left} edge from parent node[left] {$\gamma$}}
    child {node[draw] {right} edge from parent node[right,near end] {$\hbar\omega$}};
\end{tikzpicture}`);
  const labels = Object.fromEntries(
    result.ir.items
      .filter((item) => item.type === "textNode")
      .map((item) => [item.text, item])
  );

  assert.ok(labels["$\\gamma$"]);
  assert.ok(labels["$\\hbar\\omega$"]);
  assert.ok(labels["$\\gamma$"].x < 0);
  assert.ok(labels["$\\hbar\\omega$"].x > 0);
  assert.ok(labels["$\\hbar\\omega$"].y < labels["$\\gamma$"].y);
});
