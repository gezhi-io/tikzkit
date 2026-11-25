import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { parseDimension } from "../src/engine/units.js";
import { computeSvgBounds } from "../src/renderers/svg/bounds.js";

function picture(body, options = "") {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}[${options}]${body}\end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  return result.ir.items;
}

const paint = items => items.filter(item => item.type === "path");
const curves = path => path.commands.filter(cmd => cmd.type === "curveTo");
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < .00005, `${actual} != ${expected} cm`);

test("a move breaks corner lookahead and keeps two independently rounded strokes", () => {
  const [path] = paint(picture(String.raw`\draw[rounded corners=5pt] (0,0)--(1,0)--(1,1) (3,0)--(4,0)--(4,1);`));
  assert.deepEqual(path.commands.map(c => c.type),
    ["moveTo", "lineTo", "curveTo", "lineTo", "moveTo", "lineTo", "curveTo", "lineTo"]);
  near(curves(path)[0].y, parseDimension("5pt"));
});

test("PGF reads the corner setting on the incoming operation; groups restore it without moving the pen", () => {
  const [path] = paint(picture(String.raw`\draw (0,0) [rc] -- (1,0)
    {[sharp corners] -- (1,1) {[rounded corners=2pt] -- (2,1)} -- (2,2)}
    -- (3,2) [sharp corners] -- (3,3) -- (4,3);`, "rc/.style={rounded corners=7pt}"));
  const c = curves(path);
  assert.equal(c.length, 3);
  near(c[0].x, 1); near(c[0].y, parseDimension("7pt"));
  near(c[1].x, 2); near(c[1].y, 1 + parseDimension("2pt"));
  near(c[2].x, 3); near(c[2].y, 2 + parseDimension("7pt"));
});

test("a corner switch at cycle is independent of the other vertices", () => {
  const [path] = paint(picture(String.raw`\draw (0,0) [rounded corners=10pt] -- (0,2) -- (2,2)
    [sharp corners] -- (2,0) [/tikz/rounded corners=5pt] -- cycle;`));
  assert.equal(curves(path).length, 3);
  near(path.commands[0].x, 0);
  near(path.commands[0].y, parseDimension("5pt"));
  assert.equal(path.commands.at(-1).type, "closePath");
});

test("a multi-piece arc only marks its final endpoint, not an internal support join", () => {
  const [path] = paint(picture(String.raw`\draw[rounded corners=2pt] (0,-1) -- (0,0) arc(0:180:1) -- (-3,0);`));
  assert.equal(curves(path).length, 4, "two arc cubics and two real corners");
  near(curves(path).at(-1).x, -2 - parseDimension("2pt"));
});

test("a rectangle interrupts a line and resumes at its opposite corner", () => {
  const [path] = paint(picture(String.raw`\draw[rounded corners=4pt] (-2,0)--(0,0) rectangle (2,1) -- (3,1) -- (3,2);`));
  assert.deepEqual(path.commands.filter(c => c.type === "moveTo").length, 3);
  near(path.commands[1].x, 0); near(path.commands[1].y, 0);
  const resumed = path.commands[path.commands.findIndex(c => c.type === "closePath") + 1];
  near(resumed.x, 2); near(resumed.y, 1);
  assert.equal(curves(path).length, 5);
});

test("local path paint does not leak out of a corner group", () => {
  const [path] = paint(picture(String.raw`\draw[blue] (0,0) {[red,rounded corners] -- (1,0)} -- (1,1);`));
  assert.equal(path.style.stroke, "blue");
  assert.equal(curves(path).length, 1);
});

test("a circle's internal quarter joins bypass the corner register", () => {
  const [path] = paint(picture(String.raw`\draw[rounded corners] (0,0) circle (1cm) (2,0)--(3,0)--(3,1);`));
  assert.equal(curves(path).length, 5, "four native quarters and one polyline corner");
});

test("coordinate scaling changes the legs but not the physical inset; apply the last corner key", () => {
  const [path] = paint(picture(String.raw`\draw[sharp corners,rounded corners=5pt] (0,0)--(1,0)--(1,1);`, "scale=2"));
  assert.equal(curves(path).length, 1);
  near(path.commands[1].x, 2 - parseDimension("5pt"));
  near(curves(path)[0].y, parseDimension("5pt"));
});

test("picture and nested drawing scopes restore the same corner register", () => {
  const paths = paint(picture(String.raw`
    \begin{scope}[sharp corners]
      \begin{scope}[rounded corners=7pt] \draw (0,0)--(1,0)--(1,1); \end{scope}
      \draw (2,0)--(3,0)--(3,1);
    \end{scope}
    \draw (4,0)--(5,0)--(5,1);`, "rounded corners=1pt"));
  assert.deepEqual(paths.map(path => curves(path).length), [1, 0, 1]);
  near(curves(paths[0])[0].y, parseDimension("7pt"));
  near(curves(paths[2])[0].y, parseDimension("1pt"));
});

test("the page tracks the constructed corner, not protruding ink from an oversized inset", () => {
  const rounded = picture(String.raw`\draw[rounded corners=20pt] (0,0)--(2pt,0)--(2pt,2pt);`);
  const sharp = picture(String.raw`\draw (0,0)--(2pt,0)--(2pt,2pt);`);
  const [path] = paint(rounded);
  near(path.commands[1].x, -parseDimension("18pt"));
  near(curves(path)[0].y, parseDimension("20pt"));
  assert.deepEqual(computeSvgBounds(rounded), computeSvgBounds(sharp));
});
