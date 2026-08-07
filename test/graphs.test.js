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
  assert.equal((lowered.match(/\\path\[thick,->\]/g) || []).length, 4);
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

test("lowers graphs quote labels and local edge styles through native edge paths", () => {
  const diagnostics = [];
  const lowered = expandTikzGraphs(String.raw`\tikz \graph[edges={thick}] {
    a ->[red, "start"] b --["middle"'] c ->[blue,bend left, "return"] a;
  };`, diagnostics);

  assert.deepEqual(diagnostics, []);
  assert.match(lowered, /\\path\[thick,->\] \(a\) edge\[red\] node\[auto\] \{start\} \(b\);/);
  assert.match(lowered, /\\path\[thick\] \(b\) edge node\[auto,swap\] \{middle\} \(c\);/);
  assert.match(lowered, /\\path\[thick,->\] \(c\) edge\[blue,bend left\] node\[auto\] \{return\} \(a\);/);
});

test("renders graph edge labels and bend styles from the TeX Live manual fixture", () => {
  const fixture = new URL("./fixtures/examples/graphs/edge-labels-and-styles.tex", import.meta.url);
  const result = tikzToSvg(readFileSync(fixture, "utf8"), { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path");
  const labels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(labels.includes("start"));
  assert.ok(labels.includes("middle"));
  assert.ok(labels.includes("return"));
  assert.equal(paths.length, 3);
  assert.equal(paths.filter((item) => item.commands.at(-1)?.type === "curveTo").length, 1);
  assert.equal(paths.filter((item) => item.style.markerEnd?.kind === "to").length, 2);
  const labelNodes = result.ir.items.filter((item) => item.type === "textNode");
  assert.ok(labelNodes.find((item) => item.text === "start")?.y > 0, "default quotes label is above a left-to-right edge");
  assert.ok(labelNodes.find((item) => item.text === "middle")?.y < 0, "apostrophe quote swaps the label below its edge");
});
