import assert from "node:assert/strict";
import test from "node:test";
import { parseTikz } from "../src/index.js";

test("parses tikzpicture commands, options, coordinates, foreach, and nodes", () => {
  const source = String.raw`
\begin{tikzpicture}[scale=2]
  \coordinate (A) at (0,0);
  \foreach \x in {0,1,2} { \draw[red, thick] (\x,0) -- (\x,1); }
  \node at (1,0.5) {Hello};
\end{tikzpicture}`;

  const result = parseTikz(source);

  assert.equal(result.diagnostics.length, 0);
  assert.equal(result.ast.type, "document");
  assert.equal(result.ast.pictures.length, 1);
  assert.equal(result.ast.pictures[0].options.scale, "2");
  assert.equal(result.ast.pictures[0].statements.length, 3);
  assert.equal(result.ast.pictures[0].statements[1].type, "foreach");
  assert.equal(result.ast.pictures[0].statements[2].type, "node");
});

test("parses calc expressions without splitting path coordinates", () => {
  const source = String.raw`
\begin{tikzpicture}
  \coordinate (A) at (0,0);
  \coordinate (B) at (2,0);
  \draw ($(A)!0.5!(B)$) -- ($(A)+(0,1)$) -- (30:2);
\end{tikzpicture}`;

  const result = parseTikz(source);

  assert.equal(result.diagnostics.length, 0);
  const draw = result.ast.pictures[0].statements[2];
  assert.equal(draw.type, "path");
  assert.equal(draw.path.segments.length, 5);
  assert.equal(draw.path.segments[0].kind, "coordinate");
  assert.match(draw.path.segments[0].raw, /\$\(A\)!0\.5!\(B\)\$/);
});

test("parses TikZ to path options placed before the to keyword", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw (0,0) [bend left] to (1,0);
\end{tikzpicture}`;

  const result = parseTikz(source);
  const draw = result.ast.pictures[0].statements[0];
  const toSegment = draw.path.segments.find((segment) => segment.kind === "to");

  assert.equal(result.diagnostics.length, 0);
  assert.ok(toSegment);
  assert.equal(toSegment.options["bend left"], true);
});

test("parses compact TikZ arc angle-radius syntax", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw (1,0) arc (0:60:1) node at ($(60/2:0.7)$) {$\alpha$};
\end{tikzpicture}`;

  const result = parseTikz(source);
  const draw = result.ast.pictures[0].statements[0];
  const arc = draw.path.segments.find((segment) => segment.kind === "arc");

  assert.equal(result.diagnostics.length, 0);
  assert.ok(arc);
  assert.deepEqual(arc.options, { "start angle": "0", "end angle": "60", radius: "1" });
});

test("parses compact relative coordinates after path operators", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw (-2,-2) --++ (1,0) -- ++(0,1) --++(1,0);
\end{tikzpicture}`;

  const result = parseTikz(source);
  const draw = result.ast.pictures[0].statements[0];
  const coordinates = draw.path.segments.filter((segment) => segment.kind === "coordinate");

  assert.equal(result.diagnostics.length, 0);
  assert.equal(coordinates.length, 4);
  assert.deepEqual(coordinates.map((segment) => segment.relative || "absolute"), ["absolute", "update", "update", "update"]);
});

test("parses TikZ sine and cosine path operators", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw (0,0) sin (1,1) cos (2,0);
\end{tikzpicture}`;

  const result = parseTikz(source);
  const draw = result.ast.pictures[0].statements[0];

  assert.equal(result.diagnostics.length, 0);
  assert.deepEqual(draw.path.segments, [
    { kind: "coordinate", raw: "0,0" },
    { kind: "sineCosine", op: "sin", to: "1,1" },
    { kind: "sineCosine", op: "cos", to: "2,0" }
  ]);
});

test("parses TikZ child tree syntax attached to node statements", () => {
  const source = String.raw`
\begin{tikzpicture}[grow=up, level 1/.style={sibling distance=30mm}]
  \node[align=center](root){root}
    child{node{right leaf}}
    child{node[align=center]{left\\branch}
      child{node{deep}}
    };
\end{tikzpicture}`;

  const result = parseTikz(source);
  const root = result.ast.pictures[0].statements[0];

  assert.equal(result.diagnostics.length, 0);
  assert.equal(root.type, "node");
  assert.equal(root.children.length, 2);
  assert.equal(root.children[0].node.text, "right leaf");
  assert.equal(root.children[1].node.options.align, "center");
  assert.equal(root.children[1].children[0].node.text, "deep");
});

test("parses TikZ tree options between node text and child branches", () => {
  const source = String.raw`
\begin{tikzpicture}[mindmap]
  \node[concept] {Root}
    [clockwise from=45]
    child { node[concept] (a) {A} }
    child { node[concept] (b) {B} };
\end{tikzpicture}`;

  const result = parseTikz(source);
  const root = result.ast.pictures[0].statements[0];

  assert.equal(result.diagnostics.length, 0);
  assert.equal(root.type, "node");
  assert.deepEqual(root.treeOptions, { "clockwise from": "45" });
  assert.equal(root.children.length, 2);
  assert.equal(root.children[0].node.name, "a");
  assert.equal(root.children[1].node.text, "B");
});

test("parses TikZ spy statements with source and target nodes", () => {
  const source = String.raw`
\begin{tikzpicture}[spy using outlines={circle, magnification=8, size=2cm, connect spies}]
  \spy [black] on (3,3) in node [left] at (6,5.5);
\end{tikzpicture}`;

  const result = parseTikz(source);
  const spy = result.ast.pictures[0].statements[0];

  assert.equal(result.diagnostics.length, 0);
  assert.equal(spy.type, "spy");
  assert.deepEqual(spy.options, { black: true });
  assert.equal(spy.on, "3,3");
  assert.deepEqual(spy.inOptions, { left: true });
  assert.equal(spy.at, "6,5.5");
});

test("preserves repeated node label options instead of overwriting them", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[label=above:Graphics,label=left:Design,label=below:Typography,label=right:Coding] {TikZ};
\end{tikzpicture}`;

  const result = parseTikz(source);
  const node = result.ast.pictures[0].statements[0];

  assert.equal(result.diagnostics.length, 0);
  assert.deepEqual(node.options.label, ["above:Graphics", "left:Design", "below:Typography", "right:Coding"]);
});

test("splits node statements with bracket-like math text before following draw commands", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[blue] at (2.5,.68) {$(-1,2]$};
  \draw[red] (2,-.35) -- (5,-.35);
\end{tikzpicture}`;

  const result = parseTikz(source);
  const statements = result.ast.pictures[0].statements;

  assert.equal(result.diagnostics.length, 0);
  assert.equal(statements.length, 2);
  assert.equal(statements[0].type, "node");
  assert.equal(statements[1].type, "path");
  assert.equal(statements[1].command, "draw");
});

test("parses plot smooth coordinates as a single plot segment", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (A) at (0,0) {};
  \node (B) at (2,0) {};
  \draw[-stealth] plot [smooth, tension=1] coordinates { (A.east) ([xshift=1em,yshift=1em]A.east) (B.west) };
\end{tikzpicture}`;

  const result = parseTikz(source);
  const draw = result.ast.pictures[0].statements[2];

  assert.equal(result.diagnostics.length, 0);
  assert.equal(draw.path.segments.length, 1);
  assert.equal(draw.path.segments[0].kind, "plotCoordinates");
  assert.deepEqual(draw.path.segments[0].coordinates, ["A.east", "[xshift=1em,yshift=1em]A.east", "B.west"]);
  assert.equal(draw.path.segments[0].options.smooth, true);
  assert.equal(draw.path.segments[0].options.tension, "1");
});

test("records preamble TikZ libraries and style definitions for matrix/positioning cases", () => {
  const source = String.raw`
\documentclass[crop,tikz]{standalone}
\usepackage{tikz}
\usetikzlibrary{positioning, matrix}
\tikzset{
  tablet/.style={
    matrix of nodes,
    row sep=-\pgflinewidth,
    column sep=-\pgflinewidth,
    nodes={rectangle,draw=black,text width=1.25ex,align=center},
    text height=1.25ex,
    nodes in empty cells
  },
  texto/.style={font=\footnotesize\sffamily},
  title/.style={font=\small\sffamily}
}
\definecolor{dgry}{HTML}{555555}
\definecolor{lgry}{HTML}{aaaaaa}
\begin{document}
\begin{tikzpicture}[node distance=0.4cm and 0.7cm]
  \matrix[tablet] (mp) { |[fill=dgry]| & |[fill=lgry]| \\ };
  \node[texto, right=of mp] {Palette};
\end{tikzpicture}
\end{document}`;

  const result = parseTikz(source);
  const picture = result.ast.pictures[0];

  assert.equal(result.diagnostics.length, 0);
  assert.deepEqual(result.ast.libraries.map((library) => library.name), ["positioning", "matrix"]);
  assert.deepEqual(picture.libraries.map((library) => library.name), ["positioning", "matrix"]);
  assert.equal(result.ast.libraries[0].status, "builtin");
  assert.match(result.ast.libraries[0].implementedBy, /resolvePositioning/);
  assert.equal(picture.styles.tablet["matrix of nodes"], true);
  assert.equal(picture.styles.tablet["row sep"], "-\\pgflinewidth");
  assert.equal(picture.styles.tablet.nodes, "rectangle,draw=black,text width=1.25ex,align=center");
  assert.equal(picture.styles.texto.font, "\\footnotesize\\sffamily");
  assert.equal(picture.styles.title.font, "\\small\\sffamily");
  assert.doesNotMatch(result.ast.source, /\\documentclass|\\begin\{document\}|\\usetikzlibrary|\\definecolor/);
  assert.match(result.ast.source, /fill=#555555/);
  assert.match(result.ast.source, /fill=#aaaaaa/);
});
