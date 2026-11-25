import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

const nativeLibrary = String.raw`\usetikzlibrary{backgrounds}`;
function render(keys, body) {
  const source = nativeLibrary + String.raw`\begin{tikzpicture}[${keys}]${body}\end{tikzpicture}`;
  const { ir, diagnostics } = tikzToSvg(source);
  assert.deepEqual(diagnostics, []);
  return ir.items.filter(item => item.type === "path");
}

test("picture end hooks expand at their source positions, including repeated frame aliases", () => {
  const keys = String.raw`tight background, framed,
    execute at end picture={\fill[blue] (4,0) rectangle (5,1);},
    gridded,framed,execute at end picture={\fill[red] (7,0) rectangle (8,1);}`;
  const paths = render(keys, String.raw`\fill[green] (0,0) rectangle (2,1);`);
  // The second frame still encloses the original two-centimeter figure.
  const grid = paths.slice(1, -4);
  assert.ok(grid.length > 0 && grid.every(p => p.subtype === "grid-line"));
  assert.deepEqual(paths.slice(-3).map(p => p.style.fill), ["rgb(0 255 0)", "blue", "red"]);
  assert.deepEqual(paths[0].commands, paths.at(-4).commands);
  assert.equal(Math.max(...paths[0].commands.map(c => c.x ?? -Infinity)), 2);
});

test("an earlier end hook can extend the frozen box; its paint remains above the background", () => {
  const paths = render(String.raw`execute at end picture={\fill[red] (3,0) rectangle (4,1);},
    tight background,framed`, String.raw`\path (0,0) -- (2,1);`);
  assert.equal(paths[0].style.stroke, "black");
  assert.equal(Math.max(...paths[0].commands.map(c => c.x ?? -Infinity)), 4);
  assert.equal(Math.min(...paths[0].commands.map(c => c.x ?? Infinity)), 0);
  assert.equal(paths[1].style.fill, "red");
});

test("an unpainted circle still contributes its PGF construction bounds to a tight frame", () => {
  const [frame, ...extra] = render("tight background,framed", String.raw`\path (1,1) circle (2cm);`);
  assert.deepEqual(extra, []);
  assert.deepEqual([Math.min, Math.max].flatMap(fn => ["x", "y"].map(key =>
    fn(...frame.commands.map(c => c[key]).filter(Number.isFinite)))), [-1, -1, 3, 3]);
});

test("a late picture hook sees earlier invisible paths and keeps the picture grid step", () => {
  const paths = render("step=3pt", String.raw`\path (0pt,0pt) rectangle (10pt,10pt);
    \tikzset{tight background,gridded}`);
  const grid = paths.filter(p => p.subtype === "grid-line");
  assert.equal(grid.length, 8); // Four horizontal and four vertical native lines.
  const ys = grid.filter(p => p.commands[0].y === p.commands[1].y)
    .map(p => Math.round(p.commands[0].y * 72.27 / 2.54));
  assert.deepEqual(ys, [0, 3, 6, 9]);
});

test("a frame hook cannot leak out of the picture that registered it", () => {
  const { ir, diagnostics } = tikzToSvg(nativeLibrary + String.raw`
    \tikzset{framed}
    \begin{tikzpicture}\fill[red] (0,0) rectangle (1,1);\end{tikzpicture}
    \begin{tikzpicture}\tikzset{framed}\fill[blue] (0,0) rectangle (1,1);\end{tikzpicture}
    \begin{tikzpicture}\fill[black] (0,0) rectangle (1,1);\end{tikzpicture}`);
  assert.deepEqual(diagnostics, []);
  const paths = ir.items.filter(p => p.type === "path");
  assert.deepEqual(paths.map(p => p.style.fill), ["red", "none", "blue", "black"]);
});
