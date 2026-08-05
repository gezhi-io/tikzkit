import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

test("parses node options and a name after an at coordinate in either order", () => {
  const result = tikzToSvg(String.raw`
    \begin{tikzpicture}
      \node at (0,2) [above,draw] (b) {$b$};
      \node at (2,2) (c) [below,draw] {$c$};
      \draw (0,0) -- (b) -- (c);
    \end{tikzpicture}
  `, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  const nodes = result.ir.items.filter((item) => item.type === "nodeBox");
  assert.deepEqual(nodes.map((node) => node.id), ["b", "c"]);
  assert.equal(nodes[0].x, 0);
  assert.equal(nodes[1].x, 2);
  assert.ok(nodes[0].y > 2, "above should attach the node's south anchor at the requested coordinate");
  assert.ok(nodes[1].y < 2, "below should attach the node's north anchor at the requested coordinate");
  const [path] = result.ir.items.filter((item) => item.type === "path");
  assert.deepEqual(path.commands.slice(0, 2).map(({ type, x, y }) => ({ type, x, y })), [
    { type: "moveTo", x: 0, y: 0 },
    { type: "lineTo", x: 0, y: path.commands[1].y }
  ]);
  assert.ok(Math.abs(path.commands[1].y - 2) < 0.02, "the named node should resolve near its requested anchor");
});
