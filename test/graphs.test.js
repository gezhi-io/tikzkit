import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { expandTikzGraphs, tikzLibrary } from "../src/tikz/libraries/graphs.js";

const FIXTURE = new URL("./fixtures/examples/graphs/basic-chain-group.tex", import.meta.url);

test("lowers a graph chain group into ordinary named nodes and edges", () => {
  const diagnostics = [];
  const lowered = expandTikzGraphs(String.raw`\begin{tikzpicture}
\graph[grow right=1.4cm,branch down=1cm,nodes={draw,circle},edges={thick}] {
  a -> {b,c} -> d;
};
\end{tikzpicture}`, diagnostics);

  assert.deepEqual(diagnostics, []);
  assert.doesNotMatch(lowered, /\\graph\b/);
  assert.match(lowered, /\\node\[draw,circle\] \(a\) at \(0cm,0cm\) \{a\};/);
  assert.match(lowered, /\\node\[draw,circle\] \(b\) at \(1\.4cm,0cm\) \{b\};/);
  assert.match(lowered, /\\node\[draw,circle\] \(c\) at \(1\.4cm,-1cm\) \{c\};/);
  assert.match(lowered, /\\node\[draw,circle\] \(d\) at \(2\.8cm,0cm\) \{d\};/);
  assert.equal((lowered.match(/\\draw\[thick,->\]/g) || []).length, 4);
});

test("renders the TeX Live graphs chain/group fixture with the expected fan-out", () => {
  const result = tikzToSvg(readFileSync(FIXTURE, "utf8"), { mathRenderer: "svg-text" });
  const nodeBoxes = result.ir.items.filter((item) => item.type === "nodeBox");
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(tikzLibrary.status, "partial");
  assert.deepEqual(nodeBoxes.map((item) => item.id), ["a", "b", "c", "d"]);
  assert.deepEqual(
    nodeBoxes.map((item) => [Number(item.x.toFixed(3)), Number(item.y.toFixed(3))]),
    [[0, 0], [1.4, 0], [1.4, -1], [2.8, 0]]
  );
  assert.equal(paths.length, 4);
  assert.ok(paths.every((item) => item.style.markerEnd?.kind === "to"));
});

test("supports inline tikz graph wrappers and reverse or bidirectional edges", () => {
  const result = tikzToSvg(String.raw`\tikz \graph[nodes={draw},grow left=5mm] {q <- p <-> r -- s};`, {
    mathRenderer: "svg-text"
  });
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ir.items.filter((item) => item.type === "nodeBox").length, 4);
  assert.equal(paths.length, 3);
  assert.equal(paths[0].style.markerStart?.kind, "to");
  assert.equal(paths[1].style.markerStart?.kind, "to");
  assert.equal(paths[1].style.markerEnd?.kind, "to");
  assert.equal(paths[2].style.markerStart, undefined);
  assert.equal(paths[2].style.markerEnd, undefined);
});
