import assert from "node:assert/strict";
import test from "node:test";
import { parseDimension } from "../src/engine/math.js";
import { tikzToSvg } from "../src/index.js";
import { forbiddenSignGeometry } from "../src/tikz/libraries/shapes.symbols.js";

function close(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}

test("forbidden-sign geometry follows the two PGF diagonal directions", () => {
  const forbidden = forbiddenSignGeometry({ width: 2, height: 2 }, {
    outerXSep: 0.1,
    outerYSep: 0.2
  });
  const correct = forbiddenSignGeometry({ width: 2, height: 2 }, {
    correct: true,
    outerXSep: 0.1,
    outerYSep: 0.2
  });

  close(forbidden.paintedRadius, 1);
  close(forbidden.savedRadius, 1.2);
  close(forbidden.diagonalRadius, 0.707107);
  close(forbidden.commands[0].x, -0.707107);
  close(forbidden.commands[0].y, -0.707107);
  close(forbidden.commands[1].x, 0.707107);
  close(forbidden.commands[1].y, 0.707107);
  close(correct.commands[0].x, 0.707107);
  close(correct.commands[0].y, -0.707107);
  close(correct.commands[1].x, -0.707107);
  close(correct.commands[1].y, 0.707107);
});

test("forbidden-sign nodes inherit circle sizing, anchors, and border clipping", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.symbols,arrows.meta}
\begin{tikzpicture}[>=Stealth]
  \node[forbidden sign,draw,line width=2pt,minimum size=18mm,
    outer xsep=2pt,outer ysep=5pt] (stop) {STOP};
  \draw[->] (-2,0) -- (stop);
  \draw (stop.north east) -- ++(4mm,4mm);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const stop = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "stop");
  const foreground = result.ir.items.find((item) => item.subtype === "forbidden-sign-foreground");
  const connector = result.ir.items.find((item) => item.type === "path" && item.style?.markerEnd);
  const anchorPath = result.ir.items.find((item) => item.type === "path" && item !== connector && item !== foreground);
  const textIndex = result.ir.items.findIndex((item) => item.type === "textNode" && item.text === "STOP");
  const foregroundIndex = result.ir.items.indexOf(foreground);
  const outerRadius = stop.width / 2 + parseDimension("5pt");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(stop?.shape, "forbiddenSign");
  close(stop.width, stop.height);
  assert.ok(stop.width >= 1.8);
  close(connector.commands.at(-1).x, stop.x - outerRadius, 0.04);
  close(anchorPath.commands[0].x, stop.x + outerRadius * Math.SQRT1_2, 0.04);
  close(anchorPath.commands[0].y, stop.y + outerRadius * Math.SQRT1_2, 0.04);
  assert.ok(foregroundIndex > textIndex, "foreground diagonal must paint after node text");
  assert.equal(foreground.style.markerStart, undefined);
  assert.equal(foreground.style.markerEnd, undefined);
  assert.match(result.svg, /tikz-node-forbiddenSign/);
});

test("correct forbidden sign crosses math text from upper-left to lower-right", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.symbols}
\begin{tikzpicture}
  \node[shape=correct forbidden sign,draw=orange,fill=orange!10,
    minimum size=20mm] (zero) {$B=0$};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const zero = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "zero");
  const foreground = result.ir.items.find((item) => item.subtype === "forbidden-sign-foreground");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(zero?.shape, "correctForbiddenSign");
  assert.ok(foreground.commands[0].x > zero.x);
  assert.ok(foreground.commands[0].y < zero.y);
  assert.ok(foreground.commands[1].x < zero.x);
  assert.ok(foreground.commands[1].y > zero.y);
  assert.match(result.svg, /tikz-node-correctForbiddenSign/);
});

test("fill-only forbidden signs do not stroke a foreground diagonal", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.symbols}
\begin{tikzpicture}
  \node[forbidden sign,fill=red!10,minimum size=12mm] {open};
\end{tikzpicture}
`, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ir.items.some((item) => item.subtype === "forbidden-sign-foreground"), false);
});
