import assert from "node:assert/strict";
import test from "node:test";
import { parseTikz, preprocessTikzSource } from "../src/frontend/index.js";
import { tikzToSvg } from "../src/index.js";

test("preserves every tikzpicture from consecutive beamer frames", () => {
  const source = String.raw`\documentclass{beamer}
\usepackage{tikz}
\begin{document}
\begin{frame}{First}
  \begin{tikzpicture}\draw (0,0) -- (1,0);\end{tikzpicture}
\end{frame}
\begin{frame}{Second}
  \begin{tikzpicture}\draw (0,0) -- (0,1);\end{tikzpicture}
\end{frame}
\end{document}`;

  const result = parseTikz(source);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ast.figures.length, 2);
  assert.equal(result.ast.pictures.length, 2);
  assert.deepEqual(result.ast.pictures.map((picture) => picture.figureId), ["figure:0", "figure:1"]);
});

test("unwraps beamer frame overlays and options while retaining shared styles", () => {
  const source = String.raw`\documentclass{beamer}
\usepackage{tikz}
\tikzset{dot/.style={circle,draw,fill=blue!20}}
\begin{document}
\begin{frame}<1->[fragile]{First}
  \begin{figure}
    \begin{tikzpicture}
      \node[dot] (same) at (0,0) {A};
    \end{tikzpicture}
  \end{figure}
\end{frame}
\begin{frame}<2>{Second}
  \begin{tikzpicture}
    \node[dot] (same) at (0,0) {B};
  \end{tikzpicture}
\end{frame}
\end{document}`;

  const preprocessed = preprocessTikzSource(source);
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const boxes = result.ir.items.filter((item) => item.type === "nodeBox");

  assert.deepEqual(result.diagnostics, []);
  assert.doesNotMatch(preprocessed.source, /\\(?:begin|end)\{(?:frame|figure)\}/);
  assert.match(preprocessed.source, /shared|dot\/\.style/);
  assert.deepEqual(boxes.map((box) => box.id), ["same", "same"]);
  assert.ok(boxes[1].x > boxes[0].x + 0.5, "expected inline layout to keep repeated local pictures separate");
  assert.ok(boxes.every((box) => box.style.fill === "rgb(204 204 255)"));
});

test("expands foreach-bound node and edge names independently in each frame", () => {
  const source = String.raw`\documentclass{beamer}
\usepackage{tikz}
\begin{document}
\begin{frame}
  \begin{tikzpicture}
    \foreach \x/\name in {0/a,1/b} {\node (\name) at (\x,0) {};}
    \foreach \source/\dest in {a/b} {\draw[->] (\source) -- (\dest);}
  \end{tikzpicture}
\end{frame}
\begin{frame}
  \begin{tikzpicture}
    \foreach \x/\name in {0/a,1/b} {\node (\name) at (\x,1) {};}
    \foreach \source/\dest in {a/b} {\draw[->] (\source) -- (\dest);}
  \end{tikzpicture}
\end{frame}
\end{document}`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const arrows = result.ir.items.filter((item) => item.type === "path" && item.style.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ast.pictures.length, 2);
  assert.equal(arrows.length, 2);
  assert.ok(arrows[1].commands[0].x > arrows[0].commands[0].x + 0.5);
});

test("applies delayed foreach values and shifts in node label styles", () => {
  const source = String.raw`\begin{tikzpicture}
\tikzset{
  vertex/.style={circle,draw,label={[left label]center:\value},label={[right label]center:\pred}},
  left label/.style={font=\tiny,xshift=-0.3em,yshift=-0.8ex},
  right label/.style={font=\tiny,xshift=0.3em,yshift=-0.8ex}
}
\foreach \name/\value/\pred in {a/$0$/-,b/$\infty$/a}
  \node[vertex] (\name) at (0,0) {\name};
\end{tikzpicture}`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const labels = result.ir.items.filter((item) => item.type === "textNode");
  const firstCenter = labels.find((item) => item.text === "a");
  const firstValue = labels.find((item) => item.text === "$0$");
  const firstPred = labels.find((item) => item.text === "-");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(firstValue.x < firstCenter.x && firstPred.x > firstCenter.x);
  assert.ok(firstValue.y < firstCenter.y && firstPred.y < firstCenter.y);
  assert.equal(labels.some((item) => item.text === "\\value" || item.text === "\\pred"), false);
});

test("replays preceding pictures when rendering one dependent beamer frame", () => {
  const source = String.raw`\documentclass{beamer}
\usepackage{tikz}
\begin{document}
\begin{frame}
  \begin{tikzpicture}[scale=2]
    \node[circle,draw] (source) at (0,2) {S};
  \end{tikzpicture}
\end{frame}
\begin{frame}
  \begin{tikzpicture}[scale=2]
    \node[circle,draw] (target) at (1,2) {T};
    \draw[->] (source) -- (target);
  \end{tikzpicture}
\end{frame}
\end{document}`;

  const result = tikzToSvg(source, {
    activeFigureId: "figure:1",
    mathRenderer: "svg-text"
  });
  const boxes = result.ir.items.filter((item) => item.type === "nodeBox");
  const arrows = result.ir.items.filter((item) => item.type === "path" && item.style.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ast.activeFigureId, "figure:1");
  assert.equal(result.ast.pictures.length, 1);
  assert.equal(boxes.length, 1, "preceding pictures provide semantics without being painted");
  assert.equal(arrows.length, 1);
  assert.ok(arrows[0].commands[0].y > 3.5, "edge should start at the earlier frame's transformed node");
});

test("resolves foreach variables in edge options and edge labels together", () => {
  const source = String.raw`\begin{tikzpicture}
  \node[circle,draw] (a) at (0,0) {A};
  \node[circle,draw] (b) at (2,0) {B};
  \foreach \source/\dest/\curve/\weight in {
    a/b/bend right/$3$, b/a/bend right/$-1$
  }
    \path (\source) edge[->,\curve,thick] node {\weight} (\dest);
\end{tikzpicture}`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const edges = result.ir.items.filter((item) => item.type === "path" && item.subtype === "edge");
  const labels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(edges.length, 2);
  assert.equal(edges.filter((item) => item.commands.some((command) => command.type === "curveTo")).length, 2);
  assert.ok(labels.includes("$3$") && labels.includes("$-1$"));
  assert.equal(labels.includes("\\weight"), false);
});
