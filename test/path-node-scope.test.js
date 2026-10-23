import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

const pointStyle = String.raw`\tikzset{point/.style={draw=gray,cross out,
  thick,inner sep=0pt,minimum width=4pt,minimum height=4pt}}`;

function render(body, preamble = pointStyle) {
  const result = tikzToSvg(`${preamble}\\begin{tikzpicture}${body}\\end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  return result;
}

test("node-only paths retain their path options and all node segments", () => {
  const result = render(String.raw`\path[every node/.style={point}]
    node at (0,0) {} node at (1,2) {} node at (2,1) {} node at (3,3) {};`);
  const statement = result.ast.pictures[0].statements[0];
  assert.equal(statement.type, "path");
  assert.equal(statement.options["every node/.style"], "point");
  assert.equal(statement.path.segments.length, 4);
  const crosses = result.ir.items.filter((item) => item.shape === "crossOut");
  assert.deepEqual(crosses.map(({ x, y }) => [x, y]), [[0, 0], [1, 2], [2, 1], [3, 3]]);
  assert.equal((result.svg.match(/class="tikz-shape-cross-out"/g) || []).length, 4);
});

test("path every-node definitions stay local and individual node options win", () => {
  const result = render(String.raw`
    \path[every node/.style={point}]
      node at (0,0) {} node[shape=rectangle,draw=red] at (1,0) {};
    \node[draw=blue] at (2,0) {};
    \path node at (3,0) {};
  `);
  const boxes = result.ir.items.filter((item) => item.type === "nodeBox");
  assert.deepEqual(boxes.map(({ shape, style }) => [shape, style.stroke]), [
    ["crossOut", "gray"], ["rectangle", "red"], ["rectangle", "blue"]
  ]);
});

test("a node-only path appends to every-node styles without changing the enclosing scope", () => {
  const result = render(String.raw`
    \begin{scope}[xshift=1cm,every node/.style={draw,rectangle,minimum size=6pt}]
      \path[every node/.append style={cross out,red}] node (a) at (0,0) {} node (b) at (1,0) {};
      \node (c) at (2,0) {};
    \end{scope}
  `);
  const boxes = result.ir.items.filter((item) => item.type === "nodeBox");
  assert.deepEqual(boxes.map(({ x, y, shape, style }) => [x, y, shape, style.stroke]), [
    [1, 0, "crossOut", "red"], [2, 0, "crossOut", "red"], [3, 0, "rectangle", "black"]
  ]);
});

test("paths with actual children retain the node-tree AST and connections", () => {
  const result = render(String.raw`\path node[draw] {root} child {node[draw] {leaf}};`, "");
  const statement = result.ast.pictures[0].statements[0];
  assert.equal(statement.type, "node");
  assert.equal(statement.children.length, 1);
  assert.equal(result.ir.items.filter((item) => item.type === "nodeBox").length, 2);
  assert.equal(result.ir.items.filter((item) => item.type === "path").length, 1);
});
