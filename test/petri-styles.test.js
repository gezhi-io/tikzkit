import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

function render(body, pictureOptions = "", preamble = "\\usetikzlibrary{petri}") {
  const result = tikzToSvg(`${preamble}\\begin{tikzpicture}[${pictureOptions}]${body}\\end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  return result.ir.items;
}

test("Petri node styles use the same physical boxes and paint as their native TikZ definitions", () => {
  const nodes = String.raw`\node[place] (p) at (0,0) {}; \node[transition] (t) at (1,0) {}; \node[token] (n) at (2,0) {3};`;
  const explicit = String.raw`\node[circle,draw,inner sep=0pt,minimum size=5ex] (p) at (0,0) {};
    \node[rectangle,draw,inner sep=0pt,minimum size=4mm] (t) at (1,0) {};
    \node[fill=black,draw=none,circle,inner sep=0.5pt,minimum size=1ex,text=white,font=\tiny] (n) at (2,0) {3};`;
  const items = render(nodes);
  assert.deepEqual(items.filter(i => i.type === "nodeBox").map(i => i.shape), ["circle", "rectangle", "circle"]);
  const geometry = items => items.map(i => [i.type, i.id, i.x, i.y, i.width, i.height, i.style]);
  assert.deepEqual(geometry(items), geometry(render(explicit, "", "")));
});

test("every-place, transition and token hooks stay local and later node options win", () => {
  const nodes = String.raw`\node[place] (p) at (0,0) {}; \node[transition] (t) at (1,0) {};
    \begin{scope}[every token/.append style={fill=blue}] \node[token] (n) at (2,0) {}; \end{scope}
    \node[token] (m) at (3,0) {}; \node[place,fill=black] (q) at (4,0) {};`;
  const options = "every place/.style={fill=red,minimum size=9mm},every transition/.style={fill=blue},every token/.style={fill=red}";
  const nodesById = Object.fromEntries(render(nodes, options).filter(i => i.type === "nodeBox").map(i => [i.id, i]));
  assert.deepEqual(Object.keys(nodesById), ["p", "t", "n", "m", "q"]);
  assert.ok(Math.abs(nodesById.p.width - 0.9) < 1e-6);
  assert.deepEqual(Object.values(nodesById).map(i => i.style.fill), ["red", "blue", "blue", "red", "black"]);
  const userStyle = render(String.raw`\node[place] (p) {};`, "place/.style={draw,rectangle}", "");
  assert.equal(userStyle.find(i => i.type === "nodeBox").shape, "rectangle");
  assert.ok(!render(String.raw`\node[place] (p) {};`, "", "").some(i => i.type === "nodeBox"));
});

test("pre and post shorten exactly the tip-bearing ends, including the bidirectional relation", () => {
  const paths = render(String.raw`\draw[pre] (0,0)--(1,0); \draw[post] (0,1)--(1,1); \draw[pre and post] (0,2)--(1,2);`);
  const explicit = render(String.raw`\draw[<-,shorten <=1pt] (0,0)--(1,0);
    \draw[->,shorten >=1pt] (0,1)--(1,1); \draw[<->,shorten >=1pt,shorten <=1pt] (0,2)--(1,2);`, "", "");
  assert.deepEqual(paths.map(p => [!!p.style.markerStart, !!p.style.markerEnd]), [[true, false], [false, true], [true, true]]);
  assert.deepEqual(paths.map(p => p.style), explicit.map(p => p.style));
});

test("preamble style extensions preserve library geometry; a later replacement discards it", () => {
  const body = String.raw`\node[place] (p) {}; \node[transition] (t) at (2,0) {};`;
  const preamble = String.raw`\usetikzlibrary{petri}
    \tikzset{place/.prefix style={draw=blue},place/.append style={fill=blue},place/.append style={minimum size=8mm}}
    \tikzset{transition/.append style={fill=green}}
    \tikzstyle{transition}=[draw=red,circle,minimum size=3mm]`;
  const [p, t] = render(body, "", preamble).filter(i => i.type === "nodeBox");
  assert.deepEqual([p.shape, p.style.stroke, p.style.fill], ["circle", "blue", "blue"]);
  assert.ok(Math.abs(p.width - .8) < 1e-5);
  assert.deepEqual([t.shape, t.style.stroke, t.style.fill], ["circle", "red", "none"]);
});

test("a style change inside one Petri picture does not recolor the next picture", () => {
  const { ir } = tikzToSvg(String.raw`\usetikzlibrary{petri}
    \begin{tikzpicture}\tikzset{every place/.style={fill=blue}}\node[place] (first) {};\end{tikzpicture}
    \begin{tikzpicture}\node[place] (second) {};\end{tikzpicture}`);
  assert.deepEqual(ir.items.filter(i => i.type === "nodeBox").map(i => i.style.fill), ["blue", "none"]);
});

test("an edge following a marked place starts at the place border, not at its last token", () => {
  const body = count => String.raw`\node[transition] (t) at (2,0) {};\node[place,tokens=${count}] (p) {} edge[post] (t);`;
  const edge = items => items.find(i => i.type === "path" && i.style.markerEnd);
  // In MacTeX, probing \tikztostart inside the trailing edge returns p.
  const marked = edge(render(body(3))), empty = edge(render(body(0)));
  assert.ok(marked.commands[0].x > .37);
  assert.deepEqual(marked.commands, empty.commands);
});
