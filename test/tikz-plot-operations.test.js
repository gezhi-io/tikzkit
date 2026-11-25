import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

function paths(body, options = "") {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}[${options}]${body}\end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  return result.ir.items.filter(item => item.type === "path").map(item => item.commands);
}

test("an inline plot style overrides every plot, without leaking to the next plot", () => {
  const [loop, sharp, repeated] = paths(String.raw`
    \draw plot[loop] coordinates {(0,1)(1,0)(0,-1)(-1,0)};
    \draw plot coordinates {(0,1)(1,0)(0,-1)};
    \draw plot[smooth,sharp plot,smooth] coordinates {(0,0)(1,0)};`,
    "every plot/.style={sharp plot},loop/.style={smooth cycle,tension=1}");
  assert.deepEqual(loop.map(c => c.type), ["moveTo", ...Array(4).fill("curveTo"), "closePath"]);
  assert.deepEqual(loop[0], { type: "moveTo", x: 1, y: 0 });
  assert.deepEqual(sharp.map(c => c.type), ["moveTo", "lineTo", "lineTo"]);
  assert.equal(repeated[1].type, "curveTo");
});

test("sampled curves honor the plot variable, nonuniform samples, tension and picture transform", () => {
  const [sampled, literal] = paths(String.raw`
    \draw plot[smooth,tension=0,variable=\t,samples at={0,.5,2}] (\t,{\t*\t});
    \draw plot[smooth,tension=0] coordinates {(0,0)(.5,.25)(2,4)};`, "xshift=1cm,yscale=2");
  assert.deepEqual(sampled, literal);
  assert.deepEqual(sampled, [
    { type: "moveTo", x: 1, y: 0 },
    { type: "curveTo", x1: 1, y1: 0, x2: 1.5, y2: .5, x: 1.5, y: .5 },
    { type: "curveTo", x1: 1.5, y1: .5, x2: 3, y2: 8, x: 3, y: 8 }
  ]);
});

test("a preceding -- joins open plots but never draws a connector into a periodic contour", () => {
  const [open, closed] = paths(String.raw`
    \draw (-2,0) -- plot[smooth] coordinates {(0,0)(1,2)(2,0)} -- ++(1,1);
    \draw (-2,0) -- plot[smooth cycle] coordinates {(0,0)(1,2)(2,0)} -- ++(1,1);`);
  assert.equal(open[1].type, "lineTo");
  assert.deepEqual(closed[1], { type: "moveTo", x: 1, y: 2 });
  for (const commands of [open, closed]) assert.deepEqual(commands.at(-1), { type: "lineTo", x: 3, y: 1 });
});
