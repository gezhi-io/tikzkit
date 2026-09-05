import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import {
  parseGrowViaThreePoints,
  threePointChildOffset
} from "../src/tikz/libraries/trees.js";

function textNodes(source) {
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  assert.deepEqual(result.diagnostics, []);
  return Object.fromEntries(
    result.ir.items
      .filter((item) => item.type === "textNode")
      .map((item) => [item.text, item])
  );
}

test("parses the trees library three-point growth declaration", () => {
  assert.deepEqual(
    parseGrowViaThreePoints("{one child at (0,-1) and two children at (-.5,-1.5) and (.5,-1.5)}"),
    {
      one: "(0,-1)",
      left: "(-.5,-1.5)",
      right: "(.5,-1.5)"
    }
  );
});

test("uses the installed PGF three-point extrapolation formula", () => {
  const one = { x: 0, y: -1 };
  const left = { x: -0.5, y: -1.5 };
  const right = { x: 0.5, y: -1.5 };

  assert.deepEqual(threePointChildOffset(one, left, right, 0, 1), one);
  assert.deepEqual(threePointChildOffset(one, left, right, 0, 2), left);
  assert.deepEqual(threePointChildOffset(one, left, right, 1, 2), right);
  assert.deepEqual(
    [0, 1, 2].map((index) => threePointChildOffset(one, left, right, index, 3)),
    [
      { x: -1, y: -2 },
      { x: 0, y: -2 },
      { x: 1, y: -2 }
    ]
  );
});

test("lays out styled tree children through three points", () => {
  const nodes = textNodes(String.raw`
\tikzset{fan/.style={grow via three points={one child at (0,-1) and two children at (-.5,-1.5) and (.5,-1.5)}}}
\begin{tikzpicture}[fan]
  \node {R}
    child {node {A}}
    child {node {B}}
    child {node {C}};
\end{tikzpicture}`);

  assert.deepEqual(
    [nodes.A, nodes.B, nodes.C].map(({ x, y }) => ({ x, y })),
    [
      { x: -1, y: -2 },
      { x: 0, y: -2 },
      { x: 1, y: -2 }
    ]
  );
});

test("applies the active canvas transform to three-point growth vectors", () => {
  const nodes = textNodes(String.raw`
\begin{tikzpicture}[
  rotate=90,
  grow via three points={one child at (0,-1cm) and two children at (-5mm,-1cm) and (5mm,-1cm)}
]
  \node {R}
    child {node {A}}
    child {node {B}};
\end{tikzpicture}`);

  assert.ok(Math.abs(nodes.A.x - 1) < 1e-6 && Math.abs(nodes.A.y + 0.5) < 1e-6);
  assert.ok(Math.abs(nodes.B.x - 1) < 1e-6 && Math.abs(nodes.B.y - 0.5) < 1e-6);
});

test("resolves unitless three-point coordinates through the picture basis", () => {
  const nodes = textNodes(String.raw`
\begin{tikzpicture}[
  x=2cm,
  y=1cm,
  grow via three points={one child at (0,-1) and two children at (-.5,-1) and (.5,-1)}
]
  \node {R}
    child {node {A}}
    child {node {B}};
\end{tikzpicture}`);

  assert.deepEqual(
    [nodes.A, nodes.B].map(({ x, y }) => ({ x, y })),
    [
      { x: -1, y: -1 },
      { x: 1, y: -1 }
    ]
  );
});
