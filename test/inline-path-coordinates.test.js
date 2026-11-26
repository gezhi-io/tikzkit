import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

function picture(body) {
  const { ir, diagnostics } = tikzToSvg("\\begin{tikzpicture}" + body + "\\end{tikzpicture}");
  assert.deepEqual(diagnostics, []);
  return ir;
}

test("inline coordinates sample a path without changing its endpoints or drawing boxes", () => {
  const ir = picture(String.raw`
    \draw (0,0) -- coordinate (middle) coordinate[pos=.25,draw,minimum size=2cm] (quarter)
      (4,0) coordinate (end) coordinate (off) at (1,2) -- ++(0,1);
    \draw (quarter) -- (off);`);
  for (const [name, x, y] of [["middle",2,0],["quarter",1,0],["end",4,0],["off",1,2]]) {
    assert.deepEqual(ir.coordinates[name], { x, y }, name);
  }
  assert.deepEqual(ir.items.filter(item => item.type === "path").map(item =>
    item.commands.map(({ x, y }) => [x, y])), [[[0,0],[4,0],[4,1]], [[1,0],[1,2]]]);
});

test("to, edge and orthogonal paths place coordinates using their own segment timers", () => {
  const ir = picture(String.raw`
    \draw (0,0) to coordinate[pos=.75] (t) (4,0)
      edge coordinate (e) (4,2) |- coordinate (corner) (6,3);`);
  assert.deepEqual(ir.coordinates.t, { x: 3, y: 0 });
  assert.deepEqual(ir.coordinates.e, { x: 4, y: 1 });
  assert.deepEqual(ir.coordinates.corner, { x: 4, y: 3 });
});

test("a shape override on a coordinate paints and registers its anchors like an empty node", () => {
  const coord = picture(String.raw`\draw[blue] (0,0) -- (2,1) coordinate[pground] (G);
    \draw (G.south) -- +(0,-1);`);
  const node = picture(String.raw`\draw[blue] (0,0) -- (2,1) node[pground] (G) {};
    \draw (G.south) -- +(0,-1);`);
  assert.deepEqual(coord.coordinates, node.coordinates);
  assert.deepEqual(coord.items, node.items);
});

test("the curve timer uses the cubic parameter, not distance along the chord", () => {
  const ir = picture(String.raw`\draw (0,0) .. controls (0,4) and (4,4) ..
    coordinate[pos=.25] (before) (4,0) coordinate[pos=.75] (after);
    \draw (0,0) to[out control={(0,4)},in control={(4,4)}]
      coordinate[pos=.25] (route) (4,0);`);
  assert.deepEqual(ir.coordinates.before, { x: .625, y: 2.25 });
  assert.deepEqual(ir.coordinates.after, { x: 3.375, y: 2.25 });
  assert.deepEqual(ir.coordinates.route, ir.coordinates.before);
});

test("a relative to target advances the next reference point, unlike a separate edge", () => {
  const ir = picture(String.raw`\draw (1,3) -- ++(0,-1) to[R] ++(0,-2)
    coordinate[pground] (PE) -- ++(1,0) coordinate (ret);
    \draw (2,2) to +(1,0) to ++(0,1) edge ++(3,0) -- ++(0,1) coordinate (tip);`);
  assert.deepEqual(ir.coordinates.PE, { x: 1, y: 0 });
  assert.deepEqual(ir.coordinates.ret, { x: 2, y: 0 });
  assert.deepEqual(ir.coordinates.tip, { x: 2, y: 4 });
});
