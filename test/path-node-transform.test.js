import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";

function centers(body) {
  const result = tikzToSvg(`\\begin{tikzpicture}${body}\\end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  return result.ir.items.filter(item => item.type === "nodeBox").map(({ x, y }) => [x, y]);
}

test("inline nodes do not replay the enclosing path translation", () => {
  assert.deepEqual(centers(String.raw`\draw[xshift=1cm,yshift=2cm]
    (0,0) -- node[draw] {} (2,0);`), [[2, 2]]);
});

test("a named canvas coordinate ignores translation on its referencing path", () => {
  assert.deepEqual(centers(String.raw`\coordinate (p) at (3,1);
    \path[xshift=-1cm] (p) node[draw] {};`), [[3, 1]]);
});

test("explicit inline-node translations remain local and apply once", () => {
  assert.deepEqual(centers(String.raw`\draw[shift={(1,2)}]
    (0,0) -- node[draw,xshift=2mm,yshift=-1mm] {} (2,0);`), [[2.2, 1.9]]);
});

test("an untransformed node resets rotation before its own translation", () => {
  assert.deepEqual(centers(String.raw`\begin{scope}[rotate=90]
    \draw[xshift=1cm] (0,0) -- node[draw,yshift=2mm] {} (2,0);
    \end{scope}`), [[0, 2.2]]);
});

test("inline node borders inherit the path pen, with every-node and local overrides", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}[ultra thick]
    \draw[thick] (0,0) -- node[draw,circle] {} (2,0);
    \draw[thick,every node/.style={thin}] (0,1) -- node[draw,circle] {} (2,1);
    \draw[thick,every node/.style={thin}] (0,2) -- node[draw,circle,line width=2pt] {} (2,2);
    \draw[thick] (0,3) -- node[draw,circle,very thin] {} (2,3);
  \end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  const widths = result.ir.items.filter(item => item.type === "nodeBox").map(item => item.style.lineWidth);
  for (const [i, pt] of [0.8, 0.4, 2, 0.2].entries()) {
    assert.ok(Math.abs(widths[i] - lineWidthFromPt(pt)) < 1e-9, `node ${i}: ${widths[i]}`);
  }
});
