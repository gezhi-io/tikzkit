import assert from "node:assert/strict";
import test from "node:test";
import { interpretTikz, parseTikz } from "../src/index.js";

test("brace decoration reaches PGF's final state after its first input segment", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[decorate, decoration={brace, mirror, raise=4pt, amplitude=8pt, aspect=.32}]
    (0,0) -- (3,0) -- (3,2);
\end{tikzpicture}`;
  const result = interpretTikz(parseTikz(source).ast);
  const path = result.ir.items.find((item) => item.type === "path");
  const end = path.commands.at(-1);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(path.commands.filter((command) => command.type === "moveTo").length, 1);
  assert.ok(path.commands.some((command) => command.type === "curveTo"));
  assert.ok(Math.abs(end.x - 3) < 1e-9, `expected brace to finish at the first segment end, got ${JSON.stringify(end)}`);
  assert.ok(Math.abs(end.y + 4 / 28.4527559) < 1e-9, `expected brace to end on its raised baseline, got ${JSON.stringify(end)}`);
});
