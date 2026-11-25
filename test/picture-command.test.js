import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { parseTikz } from "../src/frontend/index.js";
import { findPictureCommands, findTopLevelPictures } from "../src/frontend/picture-command.js";
import { selectActiveFigureSource } from "../scripts/render-example-fixtures.js";

const compile = (tex, options) => tikzToSvg(tex, { mathRenderer: "svg-text", ...options });
const read = name => readFileSync(new URL(`./fixtures/picture-command/${name}.tex`, import.meta.url), "utf8");

test("the manual's one-path and braced pictures draw real paths with their own colors", () => {
  const single = compile(read("manual-rectangle"));
  assert.deepEqual(single.diagnostics, []);
  assert.equal(single.ir.items.length, 1);
  const multi = compile(read("manual-three-paths"));
  assert.deepEqual(multi.diagnostics, []);
  assert.deepEqual(multi.ir.items.map(i => i.style.stroke), ["black", "red", "blue"]);
});

test("short picture options and unprotected foreach use normal picture interpretation", () => {
  const grid = compile(read("manual-rotated-grid"));
  assert.deepEqual(grid.diagnostics, []);
  assert.equal(grid.ast.pictures[0].options.rotate, "30");
  assert.equal(grid.ir.items.filter(i => i.subtype === "grid-line").length, 42);
  const circles = compile(read("manual-circles"));
  assert.deepEqual(circles.diagnostics, []);
  assert.deepEqual(circles.ir.items.map(i => [i.shape, i.cx, i.cy, i.r]),
    Array.from({ length: 10 }, (_, n) => ["circle", n + 1, 0, .4]));
  const pattern = compile(read("scoped-pattern"));
  assert.deepEqual(pattern.diagnostics, []);
  assert.equal(pattern.ir.items[0].style.pattern, "sixpointed stars");
});

test("an inline function plot preserves the picture x scale and the two internal data semicolons", () => {
  const source = read("function-options");
  const control = source.replace(String.raw`\tikz[xscale`, String.raw`\begin{tikzpicture}[xscale`)
    .replace(String.raw`\end{document}`, String.raw`\end{tikzpicture}\end{document}`);
  const r = compile(source), explicit = compile(control);
  assert.deepEqual(r.diagnostics, []);
  assert.equal(r.ast.pictures[0].options.xscale, "1.35");
  assert.deepEqual(r.ir.items, explicit.ir.items);
  assert.equal(r.svg, explicit.svg);
});

test("a closing brace can finish the last path; text, escaped controls and options do not end pictures", () => {
  const source = String.raw`\tikz[label/.style={text=blue}] \node[label] {A;B};
% ignore \tikz \draw (0,0)--(99,99);
\tikz{\draw (0,0) -- (2,0)}`;
  const r = compile(source);
  assert.deepEqual(r.diagnostics, []);
  assert.equal(r.ast.figures.length, 2);
  assert.equal(r.ast.pictures[0].statements[0].text, "A;B");
  assert.deepEqual(r.ast.pictures.map(p => p.statements.length), [1,1]);
  const later = compile(source, { activeFigureId: "figure:1" });
  assert.equal(later.ir.items.length, 1);
  assert.equal(later.ir.items[0].commands.at(-1).x, 2);
});

test("picture commands in node contents never become independent figures", () => {
  const r = parseTikz(String.raw`\begin{tikzpicture}\node{A\tikz[baseline]{\node{B};}};\end{tikzpicture}
\tikz \draw (0,0)--(1,0);`);
  assert.equal(r.ast.figures.length, 2);
  assert.equal(r.ast.pictures[1].statements[0].command, "draw");
});

test("selecting native comparisons uses the same figure order for shorthand and environments", () => {
  const text = read("mixed-selection");
  const selected = compile(text, { activeFigureId: "figure:2" });
  assert.deepEqual(selected.diagnostics, []);
  assert.equal(selected.ast.activeFigureId, "figure:2");
  assert.equal(selected.ir.items[0].commands[0].x, 2);
  const ref = selectActiveFigureSource(text, "figure:2");
  assert.match(ref, /reset cm,overlay,opacity=0,scale=2/);
  assert.match(ref, /\\end\{scope\}[\s\S]*\\draw\[blue,very thick\]/);
});

test("only executable standalone picture commands are selected from raw native reference input", () => {
  const source = String.raw`\newcommand{\sample}{\tikz \draw (0,0)--(1,1);}
\verb|\tikz \draw (0,0);| \verb*+% \tikz{}+
\begin{filecontents*}{data.txt}
\tikz \fill (0,0) circle(7pt);
\end{filecontents*}
\\tikz \tikzset{tile/.style={draw}}
% \tikz \coordinate (not-a-picture) at (0,0);
\tikz % comment with ] and ;
  [tag/.style={label={A]B}}] \node {A\;B; \{C\}};`;
  const ranges = findPictureCommands(source);
  assert.equal(ranges.length, 1);
  assert.equal(ranges[0].options, "[tag/.style={label={A]B}}]");
  assert.equal(ranges[0].body, String.raw`\node {A\;B; \{C\}};`);
});

test("a missing path terminator reports a warning without consuming the following picture", () => {
  const r = parseTikz(String.raw`\tikz \draw (0,0) -- (1,0)
\tikz{\fill[red] (1,1) circle(1pt);}`);
  assert.ok(r.diagnostics.some(d => /Incomplete \\tikz picture/.test(d.message)));
  assert.equal(r.ast.figures.length, 1);
  assert.equal(r.ast.pictures[0].statements[0].command, "fill");
});

test("native selection ignores nested pictures, commented environments and preamble examples", () => {
  const source = String.raw`\newcommand{\example}{\begin{tikzpicture}\fill (0,0) circle(1pt);\end{tikzpicture}}
\begin{document}
% \begin{tikzpicture}\fill[red] (0,0) circle(1pt);\end{tikzpicture}
\tikz{\node{\begin{tikzpicture}\draw (0,0)--(1,1);\end{tikzpicture}};}
\begin{tikzpicture}\draw[blue] (0,0)--(2,0);\end{tikzpicture}
\end{document}`;
  const pictures = findTopLevelPictures(source).map(r => source.slice(r.beginIndex, r.endIndex));
  assert.equal(pictures.length, 2);
  assert.match(pictures[0], /^\\tikz\{\\node/);
  assert.equal(pictures[1], String.raw`\begin{tikzpicture}\draw[blue] (0,0)--(2,0);\end{tikzpicture}`);
  const selected = selectActiveFigureSource(source, "figure:1");
  assert.ok(selected.includes(String.raw`\newcommand{\example}{\begin{tikzpicture}`));
  assert.match(selected, /\\scoped\[[^\]]*opacity=0\][\s\S]*\\draw\[blue\]/);
});

test("TeX-lite macro calls expand before discovering inline figures; unused definitions are not figures", () => {
  const r = compile(String.raw`\newcommand{\barpic}[1]{\tikz \fill (0,0) rectangle (#1,1);}
\newcommand{\unused}{\tikz \draw (0,0)--(99,99);}
\barpic{2} \barpic{3}`);
  assert.deepEqual(r.diagnostics, []);
  assert.equal(r.ast.figures.length, 2);
  assert.deepEqual(r.ast.pictures.map(p => p.body.trim()), [
    String.raw`\fill (0,0) rectangle (2,1);`, String.raw`\fill (0,0) rectangle (3,1);`]);
});
