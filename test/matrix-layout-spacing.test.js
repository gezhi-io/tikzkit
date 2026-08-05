import assert from "node:assert/strict";
import test from "node:test";
import { interpretTikz } from "../src/engine/index.js";
import { parseTikz } from "../src/frontend/index.js";
import { parseDimension } from "../src/engine/math.js";

test("matrix between-borders spacing includes drawn cell outer separation", () => {
  const source = String.raw`
\begin{tikzpicture}
  \tikzset{record/.style={ellipse,thick,draw,inner sep=0pt,text width=3cm,align=center}}
  \matrix[row sep=0.5cm] {
    \node[record] (top) {Top}; \\
    \node[record] (bottom) {Bottom}; \\
  };
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const boxes = ir.items.filter((item) => item.type === "nodeBox");
  const [top, bottom] = boxes;
  const outerSep = parseDimension("0.4pt", {});
  const expectedDistance = (top.height + bottom.height) / 2 + parseDimension("0.5cm", {}) + outerSep * 2;

  assert.deepEqual(diagnostics, []);
  assert.equal(boxes.length, 2);
  assert.ok(Math.abs((top.y - bottom.y) - expectedDistance) < 1e-6);
});
