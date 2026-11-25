import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

function paths(source) {
  const result = tikzToSvg(String.raw`\usetikzlibrary{decorations.pathmorphing}\begin{tikzpicture}${source}\end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  return result.ir.items.filter(item => item.type === "path");
}

for (const edgeOptions of ["red", "blue,->,dashed,very thick,opacity=.3", "draw=none", "green,bend left", "red,decorate,decoration=zigzag"]) {
  test(`edge local options do not change enclosing draw: ${edgeOptions}`, () => {
    const [parent, edge] = paths(String.raw`\draw[black] (0,0) edge[${edgeOptions}] (1,1) -- (2,0);`);
    const [control] = paths(String.raw`\draw[black] (0,0) -- (2,0);`);
    assert.equal(edge.subtype, "edge");
    assert.deepEqual(parent.commands, control.commands);
    assert.deepEqual(parent.style, control.style);
  });
}

test("an edge draws inside an otherwise invisible path without inventing a parent stroke", () => {
  const items = paths(String.raw`\path (0,0) edge[red] (1,1) -- (2,0);`);
  assert.equal(items.find(p => p.subtype === "edge")?.style.stroke, "red");
  assert.ok(items.filter(p => p.subtype !== "edge").every(p => p.style.stroke === "none" && p.style.fill === "none"));
});

test("later edges retain parent style rather than the previous edge's decoration", () => {
  const items = paths(String.raw`\draw[black] (0,0) edge[red,decorate,decoration=zigzag] (1,1) edge (2,0);`);
  const edges = items.filter(p => p.subtype === "edge");
  assert.equal(edges.length, 2);
  assert.equal(edges[1].style.stroke, "black");
  assert.equal(edges[1].commands.length, 2);
});

test("to options still affect the enclosing path rather than becoming independent edges", () => {
  const [path] = paths(String.raw`\draw[black] (0,0) to[red] (1,1) -- (2,0);`);
  assert.equal(path.style.stroke, "red");
  assert.equal(path.commands.length, 3);
});
