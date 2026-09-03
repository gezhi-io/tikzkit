import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { magnifyingGlassGeometry } from "../src/tikz/libraries/shapes.symbols.js";
import { mathFallbackText } from "../src/tikz/text.js";

function close(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}

test("magnifying-glass geometry follows the inherited PGF circle and radial handle", () => {
  const geometry = magnifyingGlassGeometry({ width: 2, height: 2 }, {
    magnifyingGlassHandleAngle: -45,
    magnifyingGlassHandleAspect: 1.5,
    magnifyingGlassOuterSep: 0.1
  });

  close(geometry.paintedRadius, 1);
  close(geometry.anchorRadius, 1.1);
  close(geometry.handleStart.x, Math.SQRT1_2);
  close(geometry.handleStart.y, -Math.SQRT1_2);
  close(geometry.handleEnd.x, 2.5 * Math.SQRT1_2);
  close(geometry.handleEnd.y, -2.5 * Math.SQRT1_2);
  close(Math.hypot(
    geometry.handleEnd.x - geometry.handleStart.x,
    geometry.handleEnd.y - geometry.handleStart.y
  ), 1.5);
  close(geometry.anchors.east.x, 1.1);
  close(geometry.anchors.north.y, 1.1);
});

test("magnifying-glass outer separation changes anchors but not painted handle geometry", () => {
  const compact = magnifyingGlassGeometry({ width: 2, height: 2 }, {
    magnifyingGlassHandleAngle: 20,
    magnifyingGlassHandleAspect: 0.75,
    magnifyingGlassOuterSep: 0
  });
  const separated = magnifyingGlassGeometry({ width: 2, height: 2 }, {
    magnifyingGlassHandleAngle: 20,
    magnifyingGlassHandleAspect: 0.75,
    magnifyingGlassOuterSep: 0.2
  });

  assert.deepEqual(separated.handleStart, compact.handleStart);
  assert.deepEqual(separated.handleEnd, compact.handleEnd);
  close(separated.anchorRadius - compact.anchorRadius, 0.2);
});

test("TikZ magnifying-glass nodes paint the handle after text and clip edges to the circle", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{arrows.meta,shapes.symbols}
\begin{tikzpicture}[>=Stealth]
  \node[magnifying glass,minimum size=20mm,outer sep=2pt,
    magnifying glass handle angle=0,magnifying glass handle aspect=2,
    draw,fill=blue!10] (lens) {$q$};
  \draw[->] (-3,0) -- (lens);
  \draw[->] (lens) -- (3,0);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const lens = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "lens");
  const foreground = result.ir.items.find((item) => item.subtype === "magnifying-glass-foreground");
  const text = result.ir.items.find((item) => item.type === "textNode" && item.text === "$q$");
  const arrows = result.ir.items.filter((item) => item.type === "path" && item.style?.markerEnd);
  const geometry = magnifyingGlassGeometry(lens, lens.shapeData);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(lens.shape, "magnifyingGlass");
  assert.ok(lens.width >= 2 && lens.height >= 2);
  close(lens.width, lens.height);
  assert.ok(foreground);
  assert.ok(result.ir.items.indexOf(foreground) > result.ir.items.indexOf(text));
  assert.equal(foreground.style.markerStart, undefined);
  assert.equal(foreground.style.markerEnd, undefined);
  close(foreground.commands[0].x, lens.x + geometry.paintedRadius);
  close(foreground.commands[1].x, lens.x + 3 * geometry.paintedRadius);
  close(arrows[0].commands.at(-1).x, lens.x - geometry.anchorRadius, 0.04);
  close(arrows[1].commands[0].x, lens.x + geometry.anchorRadius, 0.04);
  assert.match(result.svg, /tikz-node-magnifyingGlass/);
});

test("explicit magnifying-glass shape syntax and numeric anchors use the circle border", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.symbols}
\begin{tikzpicture}
  \node[shape=magnifying glass,minimum size=18mm,outer sep=1pt,
    magnifying glass handle angle=135,magnifying glass handle aspect=.8,draw] (lens) {};
  \fill (lens.35) circle (1pt);
\end{tikzpicture}`);
  const lens = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "lens");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(lens.shape, "magnifyingGlass");
  assert.ok(result.ir.items.some((item) => item.subtype === "magnifying-glass-foreground"));
});

test("magnifying-glass foreground follows transform-shape rotation", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.symbols}
\begin{tikzpicture}
  \node[magnifying glass,minimum size=20mm,draw,rotate=90,transform shape,
    magnifying glass handle angle=0,magnifying glass handle aspect=1] (lens) {};
\end{tikzpicture}`);
  const lens = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "lens");
  const foreground = result.ir.items.find((item) => item.subtype === "magnifying-glass-foreground");
  const geometry = magnifyingGlassGeometry(lens, lens.shapeData);

  assert.deepEqual(result.diagnostics, []);
  close(foreground.commands[0].x, lens.x);
  close(foreground.commands[0].y, lens.y + geometry.paintedRadius);
  close(foreground.commands[1].x, lens.x);
  close(foreground.commands[1].y, lens.y + 2 * geometry.paintedRadius);
});

test("math fallback renders the gradient operator without leaking its command name", () => {
  assert.equal(mathFallbackText(String.raw`\nabla f(x_0)=0`), "∇ f(x₀) = 0");
});
