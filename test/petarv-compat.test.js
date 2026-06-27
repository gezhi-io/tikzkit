import assert from "node:assert/strict";
import test from "node:test";
import { interpretTikz, parseTikz, renderSvg, tikzToSvg } from "../src/index.js";
import { parseDimension } from "../src/math.js";
import { lineWidthFromPt } from "../src/tikz-metrics.js";

function formatted(value) {
  const rounded = Math.round((value + Number.EPSILON) * 1e6) / 1e6;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function expectClose(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) < epsilon, `expected ${actual} to be close to ${expected}`);
}

test("resolves TikZ node anchor coordinates on named nodes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw, minimum width=2cm, minimum height=1cm] (A) at (1,2) {A};
  \draw (A.north) -- (A.south east) -- (A.180);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  const path = ir.items.find((item) => item.type === "path");
  const outerSep = parseDimension("0.2pt");
  assert.ok(Math.abs(path.commands[0].x - 1) < 1e-9);
  assert.ok(Math.abs(path.commands[0].y - (2.5 + outerSep)) < 1e-9);
  assert.ok(Math.abs(path.commands[1].x - (2 + outerSep)) < 1e-9);
  assert.ok(Math.abs(path.commands[1].y - (1.5 - outerSep)) < 1e-9);
  assert.ok(Math.abs(path.commands[2].x - (0 - outerSep)) < 1e-9);
  assert.ok(Math.abs(path.commands[2].y - 2) < 1e-9);
});

test("resolves signed numeric node anchors without losing the minus sign", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, draw, minimum size=1cm] (A) at (0,0) {};
  \draw (A.-15) -- (A.15);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");

  assert.equal(diagnostics.length, 0);
  assert.ok(path.commands[0].y < 0, `expected -15 anchor below center, got ${path.commands[0].y}`);
  assert.ok(path.commands[1].y > 0, `expected 15 anchor above center, got ${path.commands[1].y}`);
  assert.ok(Math.abs(path.commands[0].x - path.commands[1].x) < 1e-6, "expected symmetric signed angle anchors");
});

test("resolves multi-word node anchors before coordinate projections", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw, minimum width=2cm, minimum height=1cm] (A) at (1,2) {A};
  \draw (A.north west) rectangle (A.south east);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");
  const outerSep = parseDimension("0.2pt");

  assert.equal(diagnostics.length, 0);
  expectClose(path.commands[0].x, 0 - outerSep);
  expectClose(path.commands[0].y, 2.5 + outerSep);
  expectClose(path.commands[1].x, 2 + outerSep);
  expectClose(path.commands[1].y, 2.5 + outerSep);
  expectClose(path.commands[2].x, 2 + outerSep);
  expectClose(path.commands[2].y, 1.5 - outerSep);
  expectClose(path.commands[3].x, 0 - outerSep);
  expectClose(path.commands[3].y, 1.5 - outerSep);
  assert.deepEqual(path.commands[4], { type: "closePath" });
});

test("does not reapply scope transforms when constructing rectangles from named anchors", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{scope}[shift={(2,3)}]
    \node[minimum width=2cm, minimum height=1cm] (A) at (0,0) {};
    \node[minimum width=2cm, minimum height=1cm] (B) at (3,-1) {};
    \fill (A.north west) rectangle (B.south east);
  \end{scope}
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");
  const outerSep = parseDimension("0.2pt");

  assert.equal(diagnostics.length, 0);
  expectClose(path.commands[0].x, 1 - outerSep);
  expectClose(path.commands[0].y, 3.5 + outerSep);
  expectClose(path.commands[1].x, 6 + outerSep);
  expectClose(path.commands[1].y, 3.5 + outerSep);
  expectClose(path.commands[2].x, 6 + outerSep);
  expectClose(path.commands[2].y, 1.5 - outerSep);
  expectClose(path.commands[3].x, 1 - outerSep);
  expectClose(path.commands[3].y, 1.5 - outerSep);
  assert.deepEqual(path.commands[4], { type: "closePath" });
});

test("applies transform canvas scale to scoped node geometry and text", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{scope}[shift={(1,1)},transform canvas={scale=0.5}]
    \node[draw, very thick, minimum width=2cm, minimum height=1cm] (A) at (2,0) {A};
  \end{scope}
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "A");
  const text = ir.items.find((item) => item.type === "textNode" && item.text === "A");

  assert.equal(diagnostics.length, 0);
  assert.equal(box.x, 1.5);
  assert.equal(box.y, 0.5);
  assert.equal(box.width, 1);
  assert.equal(box.height, 0.5);
  assert.ok(Math.abs(box.style.lineWidth - lineWidthFromPt(1.2) * 0.5) < 1e-6);
  assert.equal(text.style.fontScale, 0.5);
});

test("applies coordinate-level shifts before node anchor references", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[minimum width=2cm, minimum height=1cm] (A) at (0,0) {};
  \draw ([xshift=1em,yshift=-2pt]A.north west) -- ([shift={(0.5,0.25)}]A.south);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  const path = ir.items.find((item) => item.type === "path");
  assert.ok(path.commands[0].x > -1 && path.commands[0].x < -0.5);
  assert.ok(path.commands[0].y < 0.5 && path.commands[0].y > 0.3);
  expectClose(path.commands[1].x, 0.5);
  expectClose(path.commands[1].y, -0.25 - parseDimension("0.2pt"));
});

test("substitutes foreach variables in node names and anchor references", () => {
  const source = String.raw`
\begin{tikzpicture}
  \foreach \x in {1,...,3} { \node[minimum width=0.5cm, inner sep=0] (h\x) at (\x,0) {}; }
  \draw (h1.east) -- (h3.west);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  const path = ir.items.find((item) => item.type === "path");
  const outerSep = parseDimension("0.2pt");
  expectClose(path.commands[0].x, 1.25 + outerSep);
  expectClose(path.commands[0].y, 0);
  expectClose(path.commands[1].x, 2.75 - outerSep);
  expectClose(path.commands[1].y, 0);
});

test("registers node names declared through the name option", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[name=n, shape=diamond, minimum width=4cm, minimum height=2cm] {diamond};
  \draw (n.north) -- (n.east);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");

  assert.equal(diagnostics.length, 0);
  assert.equal(path.commands[0].type, "moveTo");
  assert.equal(path.commands[0].x, 0);
  assert.ok(path.commands[0].y > 1, `expected named diamond north anchor above center, got ${path.commands[0].y}`);
  assert.equal(path.commands[1].type, "lineTo");
  assert.ok(path.commands[1].x > 2, `expected named diamond east anchor right of center, got ${path.commands[1].x}`);
  assert.equal(path.commands[1].y, 0);
});

test("clips default node-to-node paths to shape borders", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw, minimum width=2cm, minimum height=1cm, inner sep=0] (A) at (0,0) {};
  \node[circle, draw, minimum size=1cm, inner sep=0] (B) at (4,0) {};
  \draw (A) -- (B);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");
  const outerSep = parseDimension("0.2pt");

  assert.equal(diagnostics.length, 0);
  expectClose(path.commands[0].x, 1 + outerSep);
  expectClose(path.commands[0].y, 0);
  expectClose(path.commands[1].x, 3.5 - outerSep);
  expectClose(path.commands[1].y, 0);
});

test("keeps unbraced foreach bodies attached to the foreach statement", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (s1) at (0,0) {};
  \node (s2) at (0,-1) {};
  \node (s3) at (0,-2) {};
  \foreach \x in {1,...,3}
    \node[right=1em of s\x] (h\x) {};
  \draw (h1) -- (h3);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  assert.ok(ir.coordinates.h1.x > ir.coordinates.s1.x);
  assert.ok(ir.coordinates.h3.x > ir.coordinates.s3.x);
  const path = ir.items.find((item) => item.type === "path");
  assert.equal(path.commands[0].x, ir.coordinates.h1.x);
  assert.equal(path.commands[1].x, ir.coordinates.h3.x);
});

test("supports braced foreach tuples and path node at coordinates", () => {
  const source = String.raw`
\begin{tikzpicture}
  \foreach \pos/\name in {{(0,2)/a}, {(2,1)/b}}
    \node[draw] (\name) at \pos {};
  \path node[draw] at (a) {A};
  \path node[draw] at (b) {B};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(ir.coordinates.a, { x: 0, y: 2 });
  assert.deepEqual(ir.coordinates.b, { x: 2, y: 1 });
  assert.equal(ir.items.filter((item) => item.type === "textNode" && ["A", "B"].includes(item.text)).length, 2);
});

test("ignores trailing TeX comments between TikZ statements", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw (0,0) -- (1,0); % Consumption edge
  \draw (0,1) -- (1,1); % another comment
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  assert.equal(ir.items.filter((item) => item.type === "path").length, 2);
});

test("does not report definecolor as a failed TeX macro definition", () => {
  const source = String.raw`
\definecolor{mynavy}{HTML}{000080}
\begin{tikzpicture}
  \draw[mynavy] (0,0) -- (1,0);
\end{tikzpicture}`;

  const { diagnostics } = parseTikz(source);

  assert.equal(diagnostics.some((diagnostic) => diagnostic.message.includes("Could not parse TeX macro")), false);
});

test("applies definecolor values and fill opacity to rendered paths", () => {
  const source = String.raw`
\definecolor{olivegreen}{rgb}{0,0.6,0}
\begin{tikzpicture}
  \path[rounded corners, fill=olivegreen, fill opacity=0.2] (0,0) -- (1,0) -- (1,1) -- cycle;
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");
  const svg = renderSvg(ir);

  assert.equal(diagnostics.length, 0);
  assert.equal(path.style.fill, "rgb(0 153 0)");
  assert.equal(path.style.fillOpacity, 0.2);
  assert.match(svg, /fill-opacity="0\.2"/);
});

test("applies global tikzstyle definitions to PetarV fetch-decode-execute nodes and paths", () => {
  const source = String.raw`
\usetikzlibrary{arrows, positioning}
\tikzstyle{block} = [rectangle, draw, fill=blue!20,
    text width=5em, text centered, rounded corners, minimum height=4em]
\tikzstyle{line} = [draw, -latex']
\definecolor{mygreen}{rgb}{0,0.6,0}
\definecolor{echodrk}{HTML}{0099cc}
\begin{tikzpicture}[node distance=4cm, auto]
  \node [block, color=red, fill=white, text width=6.5em] (if) {{\huge \bf IF}\\{\scriptsize Instruction fetch}};
  \node [block, color=mygreen, fill=white, text width=6.5em, right of=if] (dc) {{\huge \bf DC}\\{\scriptsize Decode}};
  \node [block, color=echodrk, fill=white, text width=6.5em, right of=dc] (ex) {{\huge \bf EX}\\{\scriptsize Execute}};
  \node [block, color=black, fill=white, text width=6.5em, below = 0.5cm of dc] (intr) {{\huge \bf IRQ}\\{\scriptsize Handle interrupts}};
  \path [line] (if) -- (dc);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const boxes = ir.items.filter((item) => item.type === "nodeBox");
  const arrow = ir.items.find((item) => item.type === "path" && item.style.markerEnd);

  assert.equal(diagnostics.length, 0);
  assert.equal(boxes.length, 4);
  assert.equal(boxes[0].style.stroke, "red");
  assert.equal(boxes[1].style.stroke, "rgb(0 153 0)");
  assert.equal(boxes[2].style.stroke, "#0099cc");
  assert.equal(boxes[0].style.fill, "white");
  assert.ok(boxes[0].rx > 0);
  assert.ok(boxes[0].height >= parseDimension("4em", {}));
  assert.ok(boxes.every((box) => Math.abs(box.width - boxes[0].width) < 1e-6));
  assert.ok(boxes[0].width < 2.8, `expected text width to constrain block width, got ${boxes[0].width}`);
  assert.equal(arrow.style.stroke, "black");
  assert.equal(arrow.style.markerEnd.kind, "latex");
  const outerSep = parseDimension("0.2pt");
  assert.ok(Math.abs(arrow.commands[0].x - (boxes[0].x + boxes[0].width / 2 + outerSep)) < 1e-6);
  assert.ok(Math.abs(arrow.commands.at(-1).x - (boxes[1].x - boxes[1].width / 2 - outerSep)) < 1e-6);
});

test("falls back to default black when custom colors are not defined", () => {
  const source = String.raw`
\usetikzlibrary{arrows, positioning}
\begin{tikzpicture}
  \node[color=mygreen] (a) at (0,0) {A};
  \draw[draw=echodrk, -latex'] (a) -- (1,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "A");
  const arrow = ir.items.find((item) => item.type === "path" && item.style.markerEnd);

  assert.equal(diagnostics.length, 0);
  assert.equal(label.style.fill, "black");
  assert.equal(arrow.style.stroke, "black");
  assert.equal(arrow.style.markerEnd.kind, "latex");
});

test("renders grouped TeX font declarations as line-level SVG text styling", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node at (0,0) {{\huge \bf IF}\\{\scriptsize Instruction fetch}};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const svg = renderSvg(ir);

  assert.equal(diagnostics.length, 0);
  assert.match(svg, /font-weight="700"/);
  assert.match(svg, new RegExp(`font-size="${formatted(lineWidthFromPt(20.7))}"`));
  assert.match(svg, new RegExp(`font-size="${formatted(lineWidthFromPt(7))}"`));
  const dyValues = [...svg.matchAll(/dy="([^"]+)"/g)].map((match) => Number(match[1]));
  assert.ok(dyValues[1] > 45 && dyValues[1] < 55, `expected TeX-like mixed-size line gap, got ${dyValues[1]}`);
  assert.match(svg, />IF</);
  assert.match(svg, />Instruction fetch</);
});

test("applies pgftransformcm and pgftransformreset inside scopes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{scope}
    \pgftransformcm{1}{0}{0.5}{0.25}{\pgfpoint{2cm}{3cm}};
    \node (A) at (1,4) {};
    \pgftransformreset;
    \node (B) at (1,4) {};
  \end{scope}
  \draw (A) -- (B);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(ir.coordinates.A, { x: 5, y: 4 });
  assert.deepEqual(ir.coordinates.B, { x: 1, y: 4 });
  const path = ir.items.find((item) => item.type === "path");
  assert.equal(path.commands.length, 2);
  assert.equal(path.commands[0].type, "moveTo");
  assert.equal(path.commands[1].type, "lineTo");
  assert.ok(path.commands[0].x > 4.8 && path.commands[0].x < 5, `expected path to leave A border, got ${path.commands[0].x}`);
  assert.ok(path.commands[1].x > 1 && path.commands[1].x < 1.2, `expected path to reach B border, got ${path.commands[1].x}`);
  assert.equal(path.commands[0].y, 4);
  assert.equal(path.commands[1].y, 4);
});

test("applies pgftransformcm to rectangle corners before constructing the path", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{scope}
    \pgftransformcm{1}{0}{0.5}{0.25}{\pgfpoint{0cm}{0cm}};
    \draw (-1,0) rectangle (9,8);
  \end{scope}
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: -1, y: 0 },
    { type: "lineTo", x: 9, y: 0 },
    { type: "lineTo", x: 13, y: 2 },
    { type: "lineTo", x: 3, y: 2 },
    { type: "closePath" }
  ]);
});

test("does not reapply current transforms to named node path references", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{scope}
    \pgftransformcm{1}{0}{0.5}{0.25}{\pgfpoint{0cm}{0cm}}
    \node[circle, inner sep=0pt, minimum size=0.2cm] (N1) at (1,1) {};
    \node[circle, inner sep=0pt, minimum size=0.2cm] (N5) at (4,1) {};
    \draw (N1) -- (N5);
  \end{scope}
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");
  const outerSep = parseDimension("0.2pt");

  assert.equal(diagnostics.length, 0);
  expectClose(path.commands[0].x, 1.6 + outerSep);
  expectClose(path.commands[0].y, 0.25);
  expectClose(path.commands[1].x, 4.4 - outerSep);
  expectClose(path.commands[1].y, 0.25);
});

test("expands nested TikZ scope environments without leaking begin or end commands", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{scope}
    \node (A) at (0,0) {};
    \begin{scope}
      \pgftransformreset
      \node (B) at (1,0) {};
      \pgftransformcm{1}{0}{0}{1}{\pgfpoint{1cm}{0cm}}
      \node (C) at (1,0) {};
    \end{scope}
  \end{scope}
  \draw (A) -- (B) -- (C);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(ir.coordinates.B, { x: 1, y: 0 });
  assert.deepEqual(ir.coordinates.C, { x: 2, y: 0 });
});

test("parses bare TeX groups as transparent TikZ scopes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (A) at (0,0) {};
  {
    \pgftransformreset;
    \draw (A) -- ++(1,0);
  }
  \node (B) at (2,0) {};
  \draw (A) -- (B);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(ir.coordinates.B, { x: 2, y: 0 });
});

test("extracts outer tikzpicture when a node label contains a nested tikzpicture", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (A) at (0,0) {\begin{tikzpicture}\draw (0,0) -- (1,0);\end{tikzpicture}};
  \node (B) at (1,0) {};
  \draw (A) -- (B);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  assert.ok(ir.coordinates.A);
  assert.ok(ir.coordinates.B);
});

test("parses node options after coordinates before empty text", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (N2) at (1,3) [circle,white,fill=red] {};
  \draw (N2.north) -- (N2.south);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(ir.coordinates.N2, { x: 1, y: 3 });
  const path = ir.items.find((item) => item.type === "path");
  assert.equal(path.commands[0].x, 1);
  assert.equal(path.commands[1].x, 1);
});

test("parses node names placed after at coordinates", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[rectangle, draw] at (1,2) (box) {};
  \draw (box.north) -- (box.south);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(ir.coordinates.box, { x: 1, y: 2 });
});

test("treats pgfonlayer environment as a transparent drawing block", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw,circle,minimum size=20pt] (a) at (0,0) {A};
  \begin{pgfonlayer}{background}
    \draw[line width=5pt,red!50] (a.center) -- (1,0);
  \end{pgfonlayer}
  \node (b) at (2,0) {};
  \draw (a) -- (b);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const backgroundPathIndex = ir.items.findIndex((item) => item.type === "path" && item.style.lineWidth > 10);
  const nodeBoxIndex = ir.items.findIndex((item) => item.type === "nodeBox");

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(ir.coordinates.b, { x: 2, y: 0 });
  assert.equal(ir.items.filter((item) => item.type === "path").length, 2);
  assert.ok(backgroundPathIndex !== -1 && backgroundPathIndex < nodeBoxIndex, "background layer should render behind node boxes");
});

test("creates matrix-of-nodes cell anchors and matrix bounding node", () => {
  const source = String.raw`
\begin{tikzpicture}
  \matrix (m) [matrix of nodes, nodes={draw}] {
    A & B \\
    C & D \\
  };
  \draw (m-1-1.north west) rectangle (m-2-2.south east);
  \node[right=0.2em of m] (r) {};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  assert.ok(ir.coordinates["m-1-1"]);
  assert.ok(ir.coordinates["m-2-2"]);
  assert.ok(ir.coordinates.r.x > ir.coordinates.m.x);
  const path = ir.items.find((item) => item.type === "path");
  assert.equal(path.commands.at(-1).type, "closePath");
});

test("uses TikZ default node padding for matrix-of-nodes digit cells", () => {
  const source = String.raw`
\begin{tikzpicture}
  \matrix (m) [matrix of nodes,row sep=-\pgflinewidth,nodes={draw}] {
    0 & 1 \\
  };
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "m-1-1");

  assert.equal(diagnostics.length, 0);
  assert.ok(box.width > 0.38 && box.width < 0.45, `expected native-sized matrix digit width, got ${box.width}`);
  assert.ok(box.height > 0.43 && box.height < 0.5, `expected native-sized matrix digit height, got ${box.height}`);
});

test("applies scope-local matrix styles and row node overrides", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{scope}[array/.style={matrix of nodes,nodes={draw, minimum size=7mm, fill=green!30},column sep=-\pgflinewidth,row sep=0.5mm,nodes in empty cells,row 2/.style={nodes={draw=none, fill=none, minimum size=5mm}}}]
    \matrix[array,ampersand replacement=\&] (array) {
      6 \& 12 \\
      {\tiny \dots} \& 9 \\
    };
  \end{scope}
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const topCells = ir.items.filter((item) => item.type === "nodeBox" && ["array-1-1", "array-1-2"].includes(item.id));
  const bottomCells = ir.items.filter((item) => item.type === "nodeBox" && ["array-2-1", "array-2-2"].includes(item.id));
  const texts = ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.equal(diagnostics.length, 0);
  assert.equal(topCells.length, 2);
  assert.ok(topCells.every((cell) => cell.style.stroke === "black" && cell.style.fill === "rgb(179 255 179)"));
  assert.equal(bottomCells.length, 0);
  assert.ok(ir.coordinates["array-2-2"], "expected row-2 address cell anchors to remain available");
  assert.ok(texts.includes("6") && texts.includes("12"));
  assert.ok(texts.every((text) => !String(text).endsWith("\\")), `expected ampersand replacement not to leak into text, got ${texts.join(" | ")}`);
});

test("expands picture-local cross path picture styles on nodes", () => {
  const source = String.raw`
\begin{tikzpicture}[cross/.style={path picture={\draw[black] (path picture bounding box.south east) -- (path picture bounding box.north west) (path picture bounding box.south west) -- (path picture bounding box.north east);}}]
  \node[circle, draw, cross, thick] (mul) at (0,0) {};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const svg = renderSvg(ir, { mathRenderer: "svg-text" });

  assert.equal(diagnostics.length, 0);
  assert.match(svg, /<ellipse /);
  assert.match(svg, /<path d="M [^"]+ L [^"]+ M [^"]+ L [^"]+"/);
});

test("treats on background layer scopes as background drawing order", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node at (0,0) {front};
  \begin{scope}[on background layer]
    \fill[green!10] (-1,-1) rectangle (1,1);
  \end{scope}
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const backgroundIndex = ir.items.findIndex((item) => item.type === "path" && item.style.fill === "rgb(230 255 230)");
  const textIndex = ir.items.findIndex((item) => item.type === "textNode" && item.text === "front");

  assert.equal(diagnostics.length, 0);
  assert.ok(backgroundIndex !== -1 && textIndex !== -1);
  assert.ok(backgroundIndex < textIndex, `expected background before text, got ${backgroundIndex} and ${textIndex}`);
});

test("preserves repeated general shadow styles for cascaded PetarV nodes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \tikzset{cascaded/.style={
    general shadow={shadow scale=1, shadow xshift=-2ex, shadow yshift=2ex, draw=black, thick, fill=white},
    general shadow={shadow scale=1, shadow xshift=-.5ex, shadow yshift=.5ex, draw=black, thick, fill=white},
    fill=white, draw, thick}}
  \node[cascaded, minimum width=2em, minimum height=1em] (n) {};
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const box = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "n");

  assert.equal(result.diagnostics.length, 0);
  assert.equal(box.shadows.length, 2);
  assert.ok(box.shadows[0].xshift < box.shadows[1].xshift);
  assert.ok(box.shadows[0].yshift > box.shadows[1].yshift);
  assert.match(result.svg, /class="tikz-node-shadow"/);
});

test("uses TikZ-sized boxes for simple matrix-of-nodes cells", () => {
  const source = String.raw`
\begin{tikzpicture}
  \matrix (m) [matrix of nodes, row sep=-\pgflinewidth, nodes={draw}] {
    0 & 1 \\
    1 & 0 \\
  };
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const boxes = ir.items.filter((item) => item.type === "nodeBox");

  assert.equal(diagnostics.length, 0);
  assert.equal(boxes.length, 4);
  assert.ok(boxes.every((box) => box.width > 0.38 && box.width < 0.45), `expected native-sized widths, got ${boxes.map((box) => box.width)}`);
  assert.ok(boxes.every((box) => box.height > 0.43 && box.height < 0.5), `expected native-sized heights, got ${boxes.map((box) => box.height)}`);
});

test("renders matrix-of-nodes text at the normal TikZ text size", () => {
  const source = String.raw`
\begin{tikzpicture}
  \matrix (m) [matrix of nodes, row sep=-\pgflinewidth, nodes={draw}] {
    0 & 1 \\
    1 & 0 \\
  };
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox");
  const text = ir.items.find((item) => item.type === "textNode");
  const svg = renderSvg(ir, { mathRenderer: "svg-text" });
  const fontSize = Number(svg.match(/<text[^>]*font-size="([^"]+)"/)?.[1]);

  assert.equal(diagnostics.length, 0);
  assert.equal(text.x, box.x);
  assert.equal(text.y, box.y);
  assert.ok(Math.abs(fontSize - lineWidthFromPt(10)) < 0.01, `expected native TikZ matrix text size, got ${fontSize}`);
});

test("renders matrix annotation math fallback with TikZ-like bold and symbol styling", () => {
  const source = String.raw`
\begin{tikzpicture}
  \matrix (m) [matrix of nodes,row sep=-\pgflinewidth,nodes={draw}] {
    1 & 0 \\
  };
  \node [below= of m-1-1.south] (label) {$\bf I$};
  \node[anchor=south east, inner sep=0.01em, blue] at (m-1-1.south east) (ann) {\scalebox{.5}{$\times 1$}};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const svg = renderSvg(ir, { mathRenderer: "svg-text" });
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "$\\bf I$");
  const annotation = ir.items.find((item) => item.type === "textNode" && item.text.includes("\\scalebox"));
  const cell = ir.items.find((item) => item.type === "nodeBox" && item.id === "m-1-1");

  assert.equal(diagnostics.length, 0);
  assert.match(svg, />I</);
  assert.match(svg, /font-weight="700"[^>]*>I</);
  assert.doesNotMatch(svg, /font-style="italic"[^>]*>I</);
  assert.match(svg, />× 1</);
  assert.doesNotMatch(svg, /font-style="italic"[^>]*>× 1</);
  assert.ok(annotation.x > cell.x, `expected scaled annotation near the cell east edge, got ${annotation.x} <= ${cell.x}`);
  assert.ok(annotation.y < cell.y, `expected scaled annotation near the cell south edge, got ${annotation.y} >= ${cell.y}`);
  assert.ok(label.y < cell.y - 0.7, `expected below=of label below the cell with TikZ node distance, got ${label.y}`);
});

test("renders Case 003 style inline I/O labels with TeX-like numeric subscripts", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, fill, inner sep=0.2em] (s1) {};
  \node[circle, left=2em of s1] (i1) {};
  \node[circle, right=2em of s1] (o1) {};
  \draw[-stealth, thick] (i1) --node[above] {$I_{1}$} (s1);
  \draw[-stealth, thick] (s1) --node[above] {$O_{1}$} (o1);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const svg = renderSvg(ir, { mathRenderer: "svg-text" });
  const labels = ir.items.filter((item) => item.type === "textNode" && /^\$[IO]_/.test(item.text));

  assert.equal(diagnostics.length, 0);
  assert.equal(labels.length, 2);
  assert.ok(labels.every((label) => label.y > ir.coordinates.s1.y), `expected above labels over the horizontal edges, got ${JSON.stringify(labels)}`);
  assert.match(svg, /<tspan>I<\/tspan><tspan[^>]+baseline-shift="sub">1<\/tspan>/);
  assert.match(svg, /<tspan>O<\/tspan><tspan[^>]+baseline-shift="sub">1<\/tspan>/);
  assert.doesNotMatch(svg, /I₁|O₁/);
});

test("positions matrices edge-to-edge with TikZ positioning syntax", () => {
  const source = String.raw`
\begin{tikzpicture}
  \matrix (m) [matrix of nodes, nodes={draw}] {0 & 1 & 1 \\ 0 & 0 & 1 \\};
  \node[right=0.2em of m] (star) {$*$};
  \matrix (k) [right=0.2em of star, matrix of nodes, nodes={draw}] {1 & 0 \\ 0 & 1 \\};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  assert.ok(ir.coordinates.star.x > ir.coordinates.m.x + 0.5, `star should sit outside m, got ${ir.coordinates.star.x}`);
  assert.ok(ir.coordinates.k.x > ir.coordinates.star.x + 0.4, `k should sit outside star, got ${ir.coordinates.k.x}`);
  assert.ok(ir.coordinates.k.x < 1.95, `matrix positioning should stay near native TikZ spacing, got ${ir.coordinates.k.x}`);
});

test("sizes empty circular nodes from inner sep instead of text defaults", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, draw, fill=gray!40, inner sep=0.2em] (a) at (0,0) {};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox");

  assert.equal(diagnostics.length, 0);
  assert.ok(box.width < 0.2, `expected small empty circle, got ${box.width}`);
  assert.equal(box.width, box.height);
});

test("uses PGF default sep for empty circle positioning chains", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, draw, thick] (A1) {};
  \node[circle, draw, thick, right=0.5em of A1] (A2) {};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const boxes = Object.fromEntries(ir.items.filter((item) => item.type === "nodeBox").map((item) => [item.id, item]));
  const gap = ir.coordinates.A2.x - ir.coordinates.A1.x;
  const expectedVisibleDiameter = 2 * Math.hypot(parseDimension(".3333em"), parseDimension(".3333em"));

  assert.equal(diagnostics.length, 0);
  assert.ok(Math.abs(boxes.A1.width - expectedVisibleDiameter) < 0.01, `expected PGF empty circle diameter, got ${boxes.A1.width}`);
  assert.ok(gap > 0.52 && gap < 0.55, `expected TikZ edge-to-edge positioning gap, got ${gap}`);
});

test("keeps empty rounded-rectangle minimum widths close to PGF shape sizing", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw, minimum width=15em, minimum height=2em, very thick, rounded rectangle] (box) {};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "box");
  const expectedWidth = parseDimension("15em") - 2 * parseDimension(".3333em");

  assert.equal(diagnostics.length, 0);
  assert.ok(Math.abs(box.width - expectedWidth) < 0.01, `expected rounded rectangle width near ${expectedWidth}, got ${box.width}`);
  expectClose(box.height, parseDimension("2em"));
});

test("uses PGF-like capsule radius for empty rounded-rectangle layer boxes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw, minimum width=15em, minimum height=2em, very thick, rounded rectangle] (box) {};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "box");

  assert.equal(diagnostics.length, 0);
  assert.ok(Math.abs(box.rx - box.height / 2) < parseDimension("0.1pt"), `expected capsule radius near half-height, got rx=${box.rx}, height=${box.height}`);
});

test("keeps A3C-style rounded math nodes compact and rounded", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[rounded rectangle, draw, thick, align=center] (A1) {Agent 1\\$(\theta_1', \psi_1')$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox");

  assert.equal(diagnostics.length, 0);
  assert.ok(Math.abs(box.width - 1.8) < 0.08, `expected native-like rounded node width near 1.80cm, got ${box.width}`);
  assert.ok(Math.abs(box.height - 1.0) < 0.08, `expected native-like rounded node height near 1.00cm, got ${box.height}`);
  assert.ok(box.rx > 0.15, `expected rounded rectangle radius, got ${box.rx}`);
});

test("matches native A3C environment and queue node sizing", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[rounded rectangle, draw, thick, align=center] (AN) {Agent $n$\\$(\theta_n', \psi_n')$};
  \node[rounded rectangle, draw, thick, yshift=8em, xshift=11.9em, align=center] (G) {Global state\\$(\theta, \psi)$};
  \node[rounded rectangle, draw, thick, align=center] (E1) {Env. 1\\$(\mathcal{T}, \mathcal{R})$};
  \node[rectangle split, minimum height=0.7cm, rectangle split horizontal, rectangle split parts=8, draw,
    rectangle split part fill={white, white, white, white, white, white, white, gray}] (q1) {};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const boxes = Object.fromEntries(ir.items.filter((item) => item.type === "nodeBox").map((item) => [item.id, item]));

  assert.equal(diagnostics.length, 0);
  assert.ok(Math.abs(boxes.AN.width - 1.86) < 0.06, `expected native Agent n node width near 1.86cm, got ${boxes.AN.width}`);
  assert.ok(Math.abs(boxes.G.width - 2.49) < 0.06, `expected native Global state node width near 2.49cm, got ${boxes.G.width}`);
  assert.ok(Math.abs(boxes.E1.width - 1.65) < 0.06, `expected native Env node width near 1.65cm, got ${boxes.E1.width}`);
  assert.ok(Math.abs(boxes.E1.height - 1.01) < 0.06, `expected native Env node height near 1.01cm, got ${boxes.E1.height}`);
  assert.ok(Math.abs(boxes.q1.width - 3.2) < 0.08, `expected native queue width near 3.20cm, got ${boxes.q1.width}`);
  assert.ok(Math.abs(boxes.q1.height - 0.714) < 0.04, `expected native queue height near 0.714cm, got ${boxes.q1.height}`);
});

test("keeps mixed LSTM math labels from inflating positioning boxes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[rectangle, draw, minimum height=1cm, minimum width=1cm] (RNN) {LSTM$_\leftarrow$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox");

  assert.equal(diagnostics.length, 0);
  assert.ok(box.width < 1.6, `expected compact LSTM box, got ${box.width}`);
});

test("sizes drawn formula nodes from math width, height, and depth", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw] (F) at (0,0) {$\frac{a+b}{c+d}$};
  \node[draw] (S) at (3,0) {$\sum_{i=1}^n x_i$};
  \node[circle, draw] (V) at (6,0) {$\vec{h}^{\ell+1}_4$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const boxes = Object.fromEntries(ir.items.filter((item) => item.type === "nodeBox").map((item) => [item.id, item]));

  assert.equal(diagnostics.length, 0);
  assert.ok(boxes.F.height > 0.75, `expected fraction node to reserve vertical formula space, got ${boxes.F.height}`);
  assert.ok(boxes.S.height > 0.65, `expected sum node to reserve script vertical space, got ${boxes.S.height}`);
  assert.ok(boxes.V.width < 1.15, `expected vector circle to stay compact, got ${boxes.V.width}`);
  assert.equal(boxes.V.width, boxes.V.height);
});

test("clips arrows against compact plain text node extents", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (T) at (0,0) {ACAACG};
  \node (B) at (2.7,0) {AACGAC};
  \draw[-stealth, very thick] (T) -- (B);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");

  assert.equal(diagnostics.length, 0);
  assert.ok(path.commands[0].x > 0.42, `expected arrow to start outside source text, got ${path.commands[0].x}`);
  assert.ok(path.commands.at(-1).x < 2.28, `expected arrow to end before target text, got ${path.commands.at(-1).x}`);
});

test("propagates tikzpicture monospace font option to text nodes", () => {
  const source = String.raw`
\begin{tikzpicture}[font=\tt]
  \node (T) at (0,0) {ACAACG};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const text = ir.items.find((item) => item.type === "textNode");
  const svg = renderSvg(ir);

  assert.equal(diagnostics.length, 0);
  assert.match(text.style.fontFamily, /mono/i);
  assert.match(svg, /monospace/);
});

test("clips arrows against TeX typewriter text extents", () => {
  const source = String.raw`
\begin{tikzpicture}[font=\tt]
  \node (T) at (0,0) {ACAACG};
  \node[align=center] (tbl1) at (2.7,0) {\textcolor{red}{AACG}AC\\\textcolor{red}{ACAACG}};
  \node[align=left] (BWT) at (8.6,0) {(CGAAAC, 2)};
  \draw[-stealth, very thick] (T) -- (tbl1);
  \draw[-stealth, very thick] (tbl1) -- (BWT);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const paths = ir.items.filter((item) => item.type === "path");

  assert.equal(diagnostics.length, 0);
  assert.ok(Math.abs(paths[0].commands[0].x - 0.6777) < 0.02, `expected TeX \\tt source east, got ${paths[0].commands[0].x}`);
  assert.ok(Math.abs(paths[0].commands[1].x - 2.0223) < 0.02, `expected TeX \\tt target west, got ${paths[0].commands[1].x}`);
  assert.ok(Math.abs(paths[1].commands.at(-1).x - 7.461) < 0.03, `expected wide BWT node west edge, got ${paths[1].commands.at(-1).x}`);
});

test("propagates scope font options to child nodes, matrices, and inline path labels", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{scope}[font=\ttfamily]
    \node (A) at (0,0) {A};
    \matrix (m) [matrix of nodes] { 1 \\ };
    \draw (0,0) -- node[above] {Edge} (1,0);
  \end{scope}
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const labels = ir.items.filter((item) => item.type === "textNode" && ["A", "1", "Edge"].includes(item.text));

  assert.equal(diagnostics.length, 0);
  assert.equal(labels.length, 3);
  assert.ok(labels.every((label) => /KaTeX_Typewriter/.test(label.style.fontFamily || "")));
});

test("preserves dashed translucent node backgrounds", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw, dashed, fill=red, fill opacity=0.2, draw opacity=0.8, rectangle, rounded corners] (bg) at (0,0) {};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox");
  const svg = renderSvg(ir);

  assert.equal(diagnostics.length, 0);
  assert.equal(box.style.fillOpacity, 0.2);
  assert.equal(box.style.strokeOpacity, 0.8);
  assert.ok(box.style.dashArray?.length > 0);
  assert.match(svg, /fill-opacity="0\.2"/);
  assert.match(svg, /stroke-opacity="0\.8"/);
  assert.match(svg, /stroke-dasharray=/);
});

test("renders horizontal rectangle split queue nodes as compartments", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[rectangle split, minimum height=0.7cm, rectangle split horizontal, rectangle split parts=4, draw,
    rectangle split part fill={white,gray,white,gray}] (q) {};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox");
  const svg = renderSvg(ir);

  assert.equal(diagnostics.length, 0);
  assert.equal(box.shape, "rectangleSplit");
  assert.equal(box.parts, 4);
  assert.ok(box.width > box.height * 1.5, `expected horizontal split box, got ${box.width}x${box.height}`);
  assert.equal((svg.match(/class="tikz-split-part"/g) || []).length, 4);
});

test("preserves explicit node names inside matrix cells", () => {
  const source = String.raw`
\begin{tikzpicture}
  \matrix (m) [matrix of nodes] {
    \node(00){A}; & \node (01) {B}; \\
  };
  \draw (00) -- (01);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  assert.ok(ir.coordinates["00"]);
  assert.ok(ir.coordinates["01"]);
  assert.notDeepEqual(ir.coordinates["00"], ir.coordinates["01"]);
});

test("expands matrix styles and keeps nodes in empty cells for GameBoy tile grids", () => {
  const source = String.raw`
\tikzset{
  table/.style={
    matrix of nodes,
    row sep=-\pgflinewidth,
    column sep=-\pgflinewidth,
    nodes={rectangle,draw=black,text width=0.05ex,align=center},
    nodes in empty cells
  }
}
\begin{tikzpicture}
  \matrix[table] (t) {
    & & & & & & & \\
    & & & |[fill=gray]| & |[fill=gray]| & |[fill=gray]| & |[fill=gray]| & |[fill=gray]| \\
  };
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const boxes = ir.items.filter((item) => item.type === "nodeBox");
  const filled = boxes.filter((box) => box.style.fill === "gray");

  assert.equal(diagnostics.length, 0);
  assert.equal(boxes.length, 16);
  assert.equal(filled.length, 5);
  assert.ok(boxes.every((box) => box.style.stroke === "black"), "expected every empty and filled cell to keep grid borders");
});

test("applies Case 024 preamble matrix styles, HTML colors, and positioning libraries", () => {
  const source = String.raw`
\documentclass[crop, tikz]{standalone}
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
  \matrix[tablet] (mp) {
    |[fill=dgry]| & |[fill=lgry]| & \\
    & |[fill=lgry]| & |[fill=dgry]| \\
  };
  \node[texto, right=of mp] (label) {Palette};
\end{tikzpicture}
\end{document}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const boxes = ir.items.filter((item) => item.type === "nodeBox");
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "Palette");

  assert.equal(diagnostics.length, 0);
  assert.ok(boxes.filter((box) => box.style.stroke === "black").length >= 6, "expected matrix cells to inherit tablet node borders");
  assert.ok(boxes.some((box) => box.style.fill === "#555555"), "expected dgry HTML color to reach filled cells");
  assert.ok(boxes.some((box) => box.style.fill === "#aaaaaa"), "expected lgry HTML color to reach filled cells");
  assert.ok(label);
  assert.ok(label.x > ir.coordinates.mp.x, "expected positioning library right=of to place label to the right of matrix");
  assert.ok(Math.abs(label.style.fontScale - 0.8) < 0.001, `expected \\footnotesize style on texto label, got ${label.style.fontScale}`);
});

test("keeps Case 024 right-of matrix labels at TikZ text-box distance", () => {
  const source = String.raw`
\documentclass[crop, tikz]{standalone}
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
  }
}
\begin{document}
\begin{tikzpicture}
  \matrix[tablet] (mp) {
    {\tt 0} & {\tt 1} & {\tt 0} & {\tt 0} & {\tt 1} & {\tt 1} & {\tt 1} & {\tt 0}\\
    \node (00){\tt 1}; & \node(01){\tt 0}; & \node(02){\tt 0}; & \node(03){\tt 0}; & \node(04){\tt 1}; & \node(05){\tt 0}; & \node(06){\tt 1}; & \node(07){\tt 1};\\
  };
  \matrix[tablet, below = of mp] (pt) {
    \node (10){\tt 2}; & \node(11){\tt 1}; & \node(12){\tt 0}; & \node(13){\tt 0}; & \node(14){\tt 3}; & \node(15){\tt 1}; & \node(16){\tt 3}; & \node(17){\tt 2};\\
  };
  \matrix[tablet, draw=black, inner sep=0ex, nodes={draw=white,inner sep=0.8ex}, below = of pt] (clr) {
    |[fill=black]| & |[fill=white]| & |[fill=white]| & |[fill=white]| & |[fill=black]| & |[fill=white]| & |[fill=black]| & |[fill=black]|\\
  };
  \node [align=center, right = 0.05cm of mp] (c1) {Byte 1 \\ Byte 2};
  \node [align=center, right = 0.05cm of pt] (c2) {Colour indices};
  \node [align=center, right = 0.05cm of clr] (c3) {Tile row};
  \draw [-stealth, double, thick] (13.south east) -- node[right] {\emph{palette}} (clr);
\end{tikzpicture}
\end{document}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const labels = Object.fromEntries(
    ir.items.filter((item) => item.type === "textNode").map((item) => [item.text.replace(/\s+/g, " ").trim(), item])
  );
  const doubleArrow = ir.items.find((item) => item.type === "path" && item.style?.doubleColor !== undefined);
  const palette = ir.items.find((item) => item.type === "textNode" && /palette/.test(item.text));

  assert.equal(diagnostics.length, 0);
  assert.ok(labels["Byte 1 \\\\ Byte 2"].x > 2.28, `expected Byte label to sit after the matrix edge, got ${labels["Byte 1 \\\\ Byte 2"].x}`);
  assert.ok(labels["Colour indices"].x > 2.95, `expected Colour indices label to use its full text box width, got ${labels["Colour indices"].x}`);
  assert.ok(labels["Tile row"].x > 2.16, `expected Tile row label to use its full text box width, got ${labels["Tile row"].x}`);
  assert.ok(doubleArrow, "expected double arrow style to be preserved");
  assert.ok(palette);
  assert.ok(palette.x > doubleArrow.commands[0].x, "expected node[right] palette label to be placed to the right of the arrow");
  const arrowStart = doubleArrow.commands.find((command) => command.type === "moveTo");
  const arrowEnd = doubleArrow.commands.findLast((command) => command.type === "lineTo");
  const arrowHeight = Math.abs((arrowEnd?.y ?? 0) - (arrowStart?.y ?? 0));
  assert.ok(
    arrowHeight > 1.1,
    `expected palette arrow to span TikZ matrix-node spacing instead of only the visible grid gap, got ${arrowHeight}`
  );
  assert.ok(ir.coordinates.clr.y < -3.15, `expected Tile row matrix to sit below pt using matrix node padding, got ${ir.coordinates.clr.y}`);
  const clrCellIndexes = ir.items
    .map((item, index) => (item.type === "nodeBox" && String(item.id || "").startsWith("clr-") ? index : -1))
    .filter((index) => index >= 0);
  const clrFrameIndex = ir.items.findIndex(
    (item) =>
      item.type === "nodeBox" &&
      item.style?.stroke === "black" &&
      Math.abs(item.x - ir.coordinates.clr.x) < 1e-6 &&
      Math.abs(item.y - ir.coordinates.clr.y) < 1e-6
  );
  assert.ok(clrFrameIndex > Math.max(...clrCellIndexes), "expected drawn matrix frame to render on top of white cell borders");
});

test("applies matrix-local scale and draw container for scaled GameBoy background tiles", () => {
  const source = String.raw`
\tikzset{
  tablett/.style={
    matrix of nodes,
    row sep=-\pgflinewidth,
    column sep=-\pgflinewidth,
    nodes={rectangle,text width=0.05ex,align=center},
    nodes in empty cells
  }
}
\begin{tikzpicture}
  \matrix[tablett, rectangle, draw, scale=0.2, inner sep=0ex, nodes={inner sep=0.4ex}] (bg) {
    & & & & & & & \\
    & & & & & & & \\
    & & & & & & & \\
    & & & |[fill=gray]| & |[fill=gray]| & |[fill=gray]| & |[fill=gray]| & |[fill=gray]| \\
    & & & |[fill=gray]| & |[fill=gray]| & |[fill=gray]| & |[fill=gray]| & |[fill=gray]| \\
    & & & |[fill=gray]| & |[fill=gray]| & & & \\
    & & & |[fill=gray]| & |[fill=gray]| & & & \\
    & & & |[fill=gray]| & |[fill=gray]| & & & \\
  };
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const boxes = ir.items.filter((item) => item.type === "nodeBox");

  assert.equal(diagnostics.length, 0);
  assert.ok(ir.coordinates.bg);
  assert.ok(boxes.length >= 6);
  const container = boxes.find((box) => box.style.stroke === "black" && Math.abs(box.x - ir.coordinates.bg.x) < 1e-6);
  const filledCell = boxes.find((box) => box.style.fill === "gray");
  assert.ok(container, "expected scaled matrix draw container");
  assert.ok(filledCell, "expected scaled filled cells");
  assert.ok(container.width > 0.7, `expected Case 025 background tile to keep native matrix-node width, got ${container.width}`);
  assert.ok(container.height > 0.65, `expected Case 025 background tile to keep native matrix-node height, got ${container.height}`);
  assert.ok(
    Math.abs(filledCell.width - filledCell.height) < 0.03,
    `expected Case 025 scaled background cells to stay close to square, got ${filledCell.width}x${filledCell.height}`
  );
});

test("normalizes GameBoy matrix and edge label TeX macros", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node at (0,0) {$\bm{\rightarrow}$};
  \node at (1,0) {\tiny $\bm{\downarrow}$};
  \node at (0,-1) {\vdots};
  \node at (0,-2) {$\ddots$};
  \node at (0,-3) {\emph{palette}};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const svg = renderSvg(ir, { mathRenderer: "svg-text" });

  assert.equal(diagnostics.length, 0);
  assert.doesNotMatch(svg, /\\bm|\\vdots|\\ddots|\\emph/);
  assert.match(svg, />→</);
  assert.match(svg, />⋮</);
  assert.match(svg, />⋱</);
  assert.match(svg, />palette</);
  const tinyFontSize = Number(svg.match(/>↓<\/text>[\s\S]*?/) ? svg.match(/<text[^>]*>↓<\/text>/)?.[0].match(/font-size="([^"]+)"/)?.[1] : NaN);
  assert.ok(Math.abs(tinyFontSize - lineWidthFromPt(10) * 0.42 * 0.9) < 0.01, `expected TikZ tiny arrow labels to stay compact, got ${tinyFontSize}`);
});

test("normalizes Gene expression inline TikZ labels and xcolor token text", () => {
  const source = String.raw`
\definecolor{mygreen}{HTML}{006400}
\begin{tikzpicture}
  \node at (0,0) {\tt \textcolor{blue}{GUG}\textcolor{mygreen}{CAU}\tikz[baseline]{\node[rectangle, fill=red,inner sep=0.3mm,anchor=base] (X) {\textcolor{white}{UAG}};}};
  \node at (0,-1) {\tt \textcolor{blue}V};
  \node at (0,-2) {\tikz[baseline]{\node[rectangle, fill=red,inner sep=0.3mm,anchor=base] (X) {\textcolor{white}{\tt STOP}};}};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const svg = renderSvg(ir, { mathRenderer: "svg-text" });

  assert.equal(diagnostics.length, 0);
  assert.doesNotMatch(svg, /\\tikz|\\node|inner sep|anchor=base|textcolorblueV/);
  assert.match(svg, />UAG</);
  assert.match(svg, />STOP</);
  assert.match(svg, /fill="blue"[^>]*>V</);
  assert.match(svg, /fill="#006400"[^>]*>CAU</);
  assert.match(svg, /monospace/);
});

test("renders Gene expression emph path labels as italic text", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (a) at (0,0) {A};
  \node (b) at (0,-2) {B};
  \draw[-stealth, thick] (a) -- node[right] {\emph{transcription}} (b);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const svg = renderSvg(ir, { mathRenderer: "svg-text" });

  assert.equal(diagnostics.length, 0);
  assert.match(svg, /font-style="italic"[^>]*>transcription/);
  assert.doesNotMatch(svg, /\\emph/);
});

test("renders Gene expression typewriter labels with TeX-like horizontal advance", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node at (0,0) {\tt GTGCATCTGACTCCTGAGGAGTAG};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const svg = renderSvg(ir, { mathRenderer: "svg-text" });

  assert.equal(diagnostics.length, 0);
  assert.match(svg, /class="tikz-typewriter-text"/);
  assert.match(svg, /scale\(0\.88 1\)/);
});

test("creates PetarV cube pic coordinates while tracking toggle statements", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (i1) at (0,0) {};
  \togglefalse{redraw}
  \pic[right=8em of i1, fill=red!10] (X) {cube={1.8/1.2/1/1}};
  \draw (i1) -- (X-A) -- (X-B) -- (X-V) -- (X-W);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  assert.ok(ir.coordinates["X-A"].x > ir.coordinates.i1.x);
  assert.ok(ir.coordinates["X-B"].x > ir.coordinates["X-A"].x);
  assert.ok(ir.coordinates["X-V"].y > ir.coordinates["X-W"].y);
  assert.ok(ir.items.some((item) => item.type === "path" && item.shape === "pic-cube"));
});

test("renders PetarV cube pics with native face toggles and line width", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (i1) at (0,0) {};
  \togglefalse{redraw}
  \togglefalse{redraw2}
  \pic[right=8em of i1, fill=red!10] (X) {cube={1.8/1.2/1/1}};
  \toggletrue{redraw}
  \toggletrue{redraw2}
  \pic[right=8em of i1, fill=blue!10] (Y) {cube={1.8/1.2/1/1}};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const cubes = ir.items.filter((item) => item.type === "path" && item.shape === "pic-cube");
  const faceCounts = cubes.map((cube) => cube.commands.filter((command) => command.type === "closePath").length);

  assert.equal(diagnostics.length, 0);
  assert.equal(cubes.length, 2);
  assert.deepEqual(faceCounts, [3, 1]);
  assert.ok(Math.abs(cubes[0].style.lineWidth - parseDimension("1mm") * 100) < 0.001);
});

test("projects PetarV cube pic anchors with PGF default z vector", () => {
  const source = String.raw`
\begin{tikzpicture}
  \pic (X) {cube={1.8/1.2/1/1}};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const cube = ir.items.find((item) => item.type === "path" && item.shape === "pic-cube");
  const leftFaceStart = cube.commands[6];

  assert.equal(diagnostics.length, 0);
  assert.ok(Math.abs(ir.coordinates["X-A"].x - -2.1075) < 0.0001);
  assert.ok(Math.abs(ir.coordinates["X-A"].y - 0.1925) < 0.0001);
  assert.ok(Math.abs(ir.coordinates["X-B"].x - 1.4925) < 0.0001);
  assert.ok(Math.abs(leftFaceStart.x - -2.415) < 0.0001);
  assert.ok(Math.abs(leftFaceStart.y - -0.815) < 0.0001);
});

test("keeps zero-color PetarV cube pics as coordinate helpers only", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (i1) at (0,0) {};
  \pic[right=8em of i1, draw=echoreg!0, fill=echoreg!0] (Ghost) {cube={0.9/0.9/2/1}};
  \draw (i1) -- (Ghost-A) -- (Ghost-B);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  assert.ok(ir.coordinates["Ghost-A"], "expected helper pic to register anchor A");
  assert.ok(ir.coordinates["Ghost-B"], "expected helper pic to register anchor B");
  assert.equal(ir.items.filter((item) => item.type === "path" && item.shape === "pic-cube").length, 0);
});

test("expands tkz-graph vertex and edge macros into TikZ nodes and paths", () => {
  const source = String.raw`
\begin{tikzpicture}
  \SetGraphUnit{2}
  \Vertex{AT}
  \EA(AT){TG}
  \SO(TG){GG}
  \NOEA(AT){NE}
  \SOEA(TG){SE}
  \Edge[label=ATG](AT)(TG)
  \draw (TG) -- (GG);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const edgeLabel = ir.items.find((item) => item.type === "textNode" && item.text === "ATG");

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(ir.coordinates.AT, { x: 0, y: 0 });
  assert.deepEqual(ir.coordinates.TG, { x: 2, y: 0 });
  assert.deepEqual(ir.coordinates.GG, { x: 2, y: -2 });
  assert.deepEqual(ir.coordinates.NE, { x: 2, y: 2 });
  assert.deepEqual(ir.coordinates.SE, { x: 4, y: -2 });
  assert.ok(ir.items.filter((item) => item.type === "path").length >= 2);
  assert.ok(edgeLabel, "expected tkz-graph Edge[label=...] to create a text node");
  assert.ok(edgeLabel.x > 0.7 && edgeLabel.x < 1.3, `expected edge label midway, got ${edgeLabel?.x}`);
});

test("applies nested TikZ styles to inline path nodes", () => {
  const source = String.raw`
\tikzstyle{vertex}=[circle,fill=black!25,minimum size=20pt,inner sep=0pt]
\tikzstyle{selected vertex}=[vertex, fill=red!24]
\begin{tikzpicture}
  \path node[selected vertex] at (0,0) {$\vec{h}_b$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox");

  assert.equal(diagnostics.length, 0);
  assert.equal(box.shape, "circle");
  assert.equal(box.style.fill, "rgb(255 194 194)");
  assert.ok(box.width <= parseDimension("20pt") + 0.02, `expected TikZ minimum-size circle, got ${box.width}`);
});

test("applies automata state defaults and picture-level arrow options", () => {
  const source = String.raw`
\begin{tikzpicture}[-stealth,very thick,node distance=4cm,auto]
  \node[state] (x) {$x$};
  \node[state] (y) [above right of=x] {$y$};
  \draw (x) to node[above left] {$1$} (y);
  \draw[loop above] (y) to node {$0.5$} (y);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const stateBoxes = ir.items.filter((item) => item.type === "nodeBox" && item.shape === "circle");
  const paths = ir.items.filter((item) => item.type === "path");
  const loop = paths.find((item) => item.commands.some((command) => command.type === "curveTo"));

  assert.equal(diagnostics.length, 0);
  assert.equal(stateBoxes.length, 2);
  assert.ok(stateBoxes.every((box) => box.width >= parseDimension("2.5em") - 0.02));
  assert.ok(stateBoxes[1].x > 2 && stateBoxes[1].y > 2, `expected above-right state position, got ${stateBoxes[1].x},${stateBoxes[1].y}`);
  assert.ok(paths.every((path) => path.style.markerEnd), "picture-level -stealth should apply to automata edges");
  assert.ok(loop, "loop above should create a visible self-loop curve");
});

test("applies every-node transform shape to automata node geometry and labels", () => {
  const source = String.raw`
\begin{tikzpicture}[scale=1.3,every node/.style={transform shape}]
  \node[state] (s) {$s_0$};
  \draw (s) -- node[above] {$\omega$} ++(1,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const stateBox = ir.items.find((item) => item.type === "nodeBox" && item.id === "s");
  const textNodes = ir.items.filter((item) => item.type === "textNode");

  assert.equal(diagnostics.length, 0);
  expectClose(stateBox.width, parseDimension("2.5em") * 1.3, 1e-6);
  assert.ok(textNodes.every((item) => Math.abs((item.style?.fontScale || 0) - 1.3) < 1e-6));
});

test("uses PGF default loop geometry for self edges", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, thick, fill=red, draw] (n) {};
  \path[-stealth, very thick] (n) edge[loop above] (n);
  \path[-stealth, very thick] (n) edge[loop right] (n);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "n");
  const [loop, rightLoop] = ir.items.filter((item) => item.type === "path" && item.commands.some((command) => command.type === "curveTo"));
  const start = loop.commands[0];
  const curve = loop.commands.at(-1);
  const rightStart = rightLoop.commands[0];
  const rightCurve = rightLoop.commands.at(-1);
  const radius = box.width / 2 + parseDimension("0.4pt");
  const expectedStart = {
    x: box.x + Math.cos((105 * Math.PI) / 180) * radius,
    y: box.y + Math.sin((105 * Math.PI) / 180) * radius
  };
  const expectedEnd = {
    x: box.x + Math.cos((75 * Math.PI) / 180) * radius,
    y: box.y + Math.sin((75 * Math.PI) / 180) * radius
  };
  const outArm = Math.hypot(curve.x1 - start.x, curve.y1 - start.y);
  const inArm = Math.hypot(curve.x2 - curve.x, curve.y2 - curve.y);
  const rightOutArm = Math.hypot(rightCurve.x1 - rightStart.x, rightCurve.y1 - rightStart.y);

  assert.equal(diagnostics.length, 0);
  assert.ok(Math.abs(start.x - expectedStart.x) < 0.01, `expected loop to leave 105-degree anchor, got ${start.x}`);
  assert.ok(Math.abs(start.y - expectedStart.y) < 0.01, `expected loop to leave 105-degree anchor, got ${start.y}`);
  assert.ok(Math.abs(curve.x - expectedEnd.x) < 0.01, `expected loop to enter 75-degree anchor, got ${curve.x}`);
  assert.ok(Math.abs(curve.y - expectedEnd.y) < 0.01, `expected loop to enter 75-degree anchor, got ${curve.y}`);
  assert.ok(Math.abs(outArm - parseDimension("5mm")) < 0.02, `expected PGF min distance arm, got ${outArm}`);
  assert.ok(Math.abs(inArm - parseDimension("5mm")) < 0.02, `expected PGF min distance arm, got ${inArm}`);
  assert.ok(rightCurve.y < rightStart.y, `expected loop right to enter through a negative angle anchor, got ${rightCurve.y}`);
  assert.ok(Math.abs(rightOutArm - parseDimension("5mm")) < 0.02, `expected loop right PGF min distance arm, got ${rightOutArm}`);
});

test("honors PGF loop distance option for self edges", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, thick, fill=red, draw] (n) {};
  \path[-stealth, very thick] (n) edge[loop,out=135,in=45,distance=8mm] (n);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const loop = ir.items.find((item) => item.type === "path" && item.commands.some((command) => command.type === "curveTo"));
  const start = loop.commands[0];
  const curve = loop.commands.at(-1);
  const outArm = Math.hypot(curve.x1 - start.x, curve.y1 - start.y);

  assert.equal(diagnostics.length, 0);
  assert.ok(Math.abs(outArm - parseDimension("8mm")) < 0.02, `expected loop distance=8mm arm, got ${outArm}`);
});

test("keeps nested pgfplots-in-node content compact instead of inflating the SVG bounds", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[rectangle, draw, scale=0.2, minimum size=20em] (ga) {\begin{tikzpicture}
    \begin{axis}[axis lines=none, ticks=none,xmax=3, xmin=-3,ymax=1.1]
      \addplot[ultra thick,black, no markers,samples=200] {exp(-x^2)};
    \end{axis}
  \end{tikzpicture}};
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const viewBox = result.svg.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);

  assert.equal(result.diagnostics.length, 0);
  assert.ok(viewBox[2] < 500, `expected compact nested plot bounds, got ${viewBox?.join(" ")}`);
  assert.doesNotMatch(result.svg, /\\begin\{tikzpicture\}|axis plot|addplot/);
});

test("respects PGFPlots x/y unit dimensions for Case 065 activation nodes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[rectangle, draw] at (-2.5, -0.8) (s1) {\begin{tikzpicture} \begin{axis}[
    samples=1000, domain=-2.6:2.6,
    hide axis,
    xtick=\empty,
    ytick=\empty,
    xlabel=\empty,
    ylabel=\empty,
    xmin=-2.1, xmax=2.1,
    ymin=-0.1, ymax=1.1,
    x=0.5em, y=0.5em,
    trig format = rad
  ]
    \addplot expression [no markers, smooth, thick, black] {max(0, min(1, x*0.6 + 0.5))};
  \end{axis}\end{tikzpicture}};
  \node[rectangle, draw, right=1em of s1] (s2) {\begin{tikzpicture} \begin{axis}[
    samples=1000, domain=-2.6:2.6,
    hide axis,
    xmin=-2.1, xmax=2.1,
    ymin=-1.1, ymax=1.1,
    x=0.5em, y=0.5em,
    trig format = rad
  ]
    \addplot expression [no markers, smooth, thick, black] {tanh(\x)};
  \end{axis}\end{tikzpicture}};
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const boxes = result.ir.items.filter((item) => item.type === "nodeBox");
  const s1 = boxes.find((item) => item.id === "s1");
  const s2 = boxes.find((item) => item.id === "s2");

  assert.equal(result.diagnostics.length, 0);
  assert.ok(s1.width > 1 && s1.width < 1.2, `expected compact sigmoid node width, got ${s1.width}`);
  assert.ok(s1.height > 0.5 && s1.height < 0.7, `expected compact sigmoid node height, got ${s1.height}`);
  assert.ok(s2.width > 1 && s2.width < 1.2, `expected compact tanh node width, got ${s2.width}`);
  assert.ok(s2.height > 0.65 && s2.height < 0.85, `expected compact tanh node height, got ${s2.height}`);
  assert.ok(s2.x - s1.x < 1.6, `expected positioning to use compact node bounds, got delta ${s2.x - s1.x}`);
});

test("normalizes larger bold math labels used as graph markers", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, draw, thick] (S) {$\boldsymbol\Sigma$};
  \node[red] at (1,0) {$\mathlarger{\mathlarger{\mathlarger{\mathlarger{\mathlarger{\bm{\times}}}}}}$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const svg = renderSvg(ir, { mathRenderer: "svg-text" });
  const sigma = ir.items.find((item) => item.type === "nodeBox");
  const crossFontSize = Number(svg.match(/font-size="([^"]+)"[^>]*>×</)?.[1]);

  assert.equal(diagnostics.length, 0);
  assert.ok(sigma.width < 1.2, `expected compact sigma node, got ${sigma.width}`);
  assert.ok(crossFontSize > 72, `expected nested \\mathlarger marker to be visibly enlarged, got ${crossFontSize}`);
  assert.match(svg, /font-weight="700"[^>]*>×</);
  assert.match(svg, />Σ</);
  assert.match(svg, />×</);
  assert.doesNotMatch(svg, /mathlarger|boldsymbol|\\bm/);
});

test("keeps message passing math circle nodes compact for positioning", () => {
  const source = String.raw`
\definecolor{echodrk}{HTML}{0099cc}
\definecolor{olivegreen}{rgb}{0,0.6,0}
\begin{tikzpicture}
  \node[circle, gray, draw, very thick] (1) {$\vec{h}^\ell_1$};
  \node[circle, draw, olivegreen, right=7em of 1, ultra thick] (4) {$\vec{h}^{\ell+1}_4$};
  \node[circle, draw, echodrk, above right=3em and 4em of 1, very thick] (3) {$\vec{h}^\ell_3$};
  \draw[red, ultra thick, -stealth] (3) -- node[above,xshift=1em, inner sep=0em] (l1) {$\vec{h}_{3\rightarrow 4}^\ell$} (4);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const svg = renderSvg(ir, { mathRenderer: "svg-text" });
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);
  const circles = ir.items.filter((item) => item.type === "nodeBox" && item.shape === "circle");
  const label = ir.items.find((item) => item.type === "textNode" && item.text.includes("3\\rightarrow 4"));

  assert.equal(diagnostics.length, 0);
  assert.ok(circles.every((box) => box.width < 1.25), `expected compact math circles, got ${circles.map((box) => box.width).join(", ")}`);
  assert.ok(ir.coordinates["4"].x < 4, `expected positioning not to be inflated by math width, got ${ir.coordinates["4"].x}`);
  assert.ok(viewBox[2] < 800, `expected Case 042 viewBox to stay compact, got ${viewBox?.join(" ")}`);
  assert.ok(label, "expected inline message label node to remain present");
});

test("uses diagonal TikZ positioning distance for GAT layer neighbors", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, draw, thick] (h1) {$\vec{h}_1$};
  \node[circle, draw, thick, above left=of h1] (h4) {$\vec{h}_2$};
  \node[circle, draw, thick, right=10em of h1] (hp) {$\vec{h}_1'$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const diagonalOffset = Math.abs(ir.coordinates.h4.x - ir.coordinates.h1.x);

  assert.equal(diagnostics.length, 0);
  assert.ok(diagonalOffset > 1.61 && diagonalOffset < 1.65, `expected native TikZ diagonal offset near 1.63cm, got ${diagonalOffset}`);
  assert.ok(ir.coordinates.hp.x > 4.35 && ir.coordinates.hp.x < 4.5, `expected horizontal positioning to remain unchanged, got ${ir.coordinates.hp.x}`);
});

test("keeps Case 026 sloped alpha labels close to their edges", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, draw, thick] (h1) {$\vec{h}_1$};
  \node[circle, draw, thick, below right=of h1] (h8) {$\vec{h}_6$};
  \draw[-stealth, thick] (h8.120) -- node[sloped, above, black] {$\vec{\alpha}_{16}$} (h1.-30);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const label = ir.items.find((item) => item.type === "textNode" && item.text.includes("\\alpha"));
  const edge = ir.items.find((item) => item.type === "path");
  const start = edge.commands[0];
  const end = edge.commands.at(-1);
  const distance =
    Math.abs((end.y - start.y) * label.x - (end.x - start.x) * label.y + end.x * start.y - end.y * start.x) /
    Math.hypot(end.y - start.y, end.x - start.x);

  assert.equal(diagnostics.length, 0);
  assert.ok(label.rotation < -35 && label.rotation > -55, `expected sloped label to follow edge angle, got ${label.rotation}`);
  assert.ok(distance > 0.12, `expected label to stay visibly above the edge, got distance ${distance}`);
  assert.ok(distance < 0.3, `expected TikZ-like compact sloped label offset, got distance ${distance}`);
});

test("keeps Deep Graph Infomax wide-tilde vector nodes compact and positioned", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, thick, draw] (01) {$\vec{\widetilde{x}}_j$};
  \node[circle, thick, draw, above right=0.1em and 2emof 01] (02) {};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const center = ir.items.find((item) => item.type === "nodeBox" && item.id === "01");

  assert.equal(diagnostics.length, 0);
  assert.ok(center.width < 1.05, `expected wide-tilde vector circle to stay compact, got ${center.width}`);
  assert.ok(ir.coordinates["02"].x > ir.coordinates["01"].x + 0.7, `expected compact 2emof positioning to keep neighbor near graph, got ${ir.coordinates["02"].x}`);
  assert.ok(ir.coordinates["02"].y > ir.coordinates["01"].y, `expected neighbor above source node, got ${ir.coordinates["02"].y}`);
});

test("matches Case 016 vector and wide-tilde circle sizing", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, thick, draw] (x) {$\vec{x}_i$};
  \node[circle, thick, draw] (xt) at (2,0) {$\vec{\widetilde{x}}_j$};
  \node[circle, thick, draw] (h) at (4,0) {$\vec{h}_i$};
  \node[circle, thick, draw] (ht) at (6,0) {$\vec{\widetilde{h}}_j$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const boxes = Object.fromEntries(ir.items.filter((item) => item.type === "nodeBox").map((item) => [item.id, item]));

  assert.equal(diagnostics.length, 0);
  assert.ok(boxes.x.width > 0.76 && boxes.x.width < 0.83, `expected native-like x vector circle near 0.80cm, got ${boxes.x.width}`);
  assert.ok(boxes.xt.width > 0.88 && boxes.xt.width < 0.96, `expected native-like x wide-tilde circle near 0.93cm, got ${boxes.xt.width}`);
  assert.ok(boxes.h.width > 0.83 && boxes.h.width < 0.91, `expected native-like h vector circle near 0.86cm, got ${boxes.h.width}`);
  assert.ok(boxes.ht.width > 0.95 && boxes.ht.width < 1.04, `expected native-like h wide-tilde circle near 1.00cm, got ${boxes.ht.width}`);
});

test("keeps current color when a bare draw option follows a color token", () => {
  const source = String.raw`
\definecolor{echodrk}{HTML}{0099cc}
\begin{tikzpicture}
  \node[circle, echodrk, draw, very thick] (A) {$\vec{h}^\ell_2$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox");
  const label = ir.items.find((item) => item.type === "textNode");

  assert.equal(diagnostics.length, 0);
  assert.equal(box.style.stroke, "#0099cc");
  assert.equal(label.style.fill, "#0099cc");
});

test("clips paths between numeric node names to node borders", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, draw, minimum size=1cm, inner sep=0] (1) at (0,0) {};
  \node[circle, draw, minimum size=1cm, inner sep=0] (4) at (4,0) {};
  \draw[-stealth] (1) -- (4);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");
  const outerSep = parseDimension("0.2pt");

  assert.equal(diagnostics.length, 0);
  expectClose(path.commands[0].x, 0.5 + outerSep);
  expectClose(path.commands[0].y, 0);
  expectClose(path.commands[1].x, 3.5 - outerSep);
  expectClose(path.commands[1].y, 0);
});

test("applies tkz EdgeStyle updates to expanded Edge commands", () => {
  const source = String.raw`
\begin{tikzpicture}
  \SetGraphUnit{2}
  \Vertex{ATG}
  \EA(ATG){TGG}
  \tikzset{EdgeStyle/.style={-stealth, color=black}}
  \Edge(ATG)(TGG)
  \tikzset{EdgeStyle/.style={-stealth, color=black, bend right}}
  \Edge(TGG)(ATG)
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const paths = ir.items.filter((item) => item.type === "path" && item.style.markerEnd);

  assert.equal(diagnostics.length, 0);
  assert.equal(paths[0].style.stroke, "black");
  assert.equal(paths[0].commands.at(-1).type, "lineTo");
  assert.equal(paths[1].commands.at(-1).type, "curveTo");
});

test("applies tkz SetUpEdge labeltext updates to edge labels", () => {
  const source = String.raw`
\begin{tikzpicture}[font=\tt]
  \SetUpEdge[lw=0.75pt,color=red,labelcolor=white]
  \SetGraphUnit{2}
  \Vertex{A}
  \EA(A){B}
  \SO(B){C}
  \SetUpEdge[labeltext=blue]
  \tikzset{EdgeStyle/.style={-stealth, color=blue}}
  \Edge[label=AB](A)(B)
  \SetUpEdge[labeltext=gray]
  \tikzset{EdgeStyle/.style={-stealth, color=gray}}
  \Edge[label=BC](B)(C)
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const labels = Object.fromEntries(ir.items.filter((item) => item.type === "textNode").map((item) => [item.text, item]));

  assert.equal(diagnostics.length, 0);
  assert.equal(labels.AB.style.fill, "blue");
  assert.equal(labels.BC.style.fill, "gray");
  assert.ok(ir.items.some((item) => item.type === "nodeBox" && item.style.fill === "white"), "expected labelcolor to keep white label backgrounds");
});

test("keeps tkz-graph edge label backgrounds compact so they do not hide edges", () => {
  const source = String.raw`
\begin{tikzpicture}[scale=0.8,every node/.style={scale=0.7},font=\tt]
  \SetUpEdge[lw=1.5pt,color=black,labelcolor=white]
  \SetGraphUnit{2.5}
  \GraphInit[vstyle=Normal]
  \Vertex{AT}
  \EA(AT){TG}
  \tikzset{EdgeStyle/.style={-stealth}}
  \Edge[label=ATG](AT)(TG)
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "ATG");
  const labelBox = ir.items.find((item) => item.type === "nodeBox" && !item.id && Math.abs(item.x - label.x) < 1e-6);

  assert.equal(diagnostics.length, 0);
  assert.ok(label, "expected tkz edge label text");
  assert.ok(labelBox, "expected white label background");
  assert.ok(labelBox.width < 0.68, `expected compact edge label background, got ${labelBox.width}`);
  assert.ok(labelBox.height < 0.4, `expected compact edge label background height, got ${labelBox.height}`);
});

test("scales tkz-graph normal vertex shape like TikZ node scale", () => {
  const source = String.raw`
\begin{tikzpicture}[scale=0.8,every node/.style={scale=0.7},font=\tt]
  \GraphInit[vstyle=Normal]
  \SetGraphUnit{2.5}
  \tikzset{VertexStyle/.append  style={fill}}
  \Vertex{AT}
  \EA(AT){TG}
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "AT");
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "AT");

  assert.equal(diagnostics.length, 0);
  assert.ok(ir.coordinates.TG.x > 1.98 && ir.coordinates.TG.x < 2.02, `expected picture scale to affect tkz coordinates, got ${ir.coordinates.TG.x}`);
  assert.equal(box.style.fill, "white");
  assert.equal(label.style.fill, "black");
  assert.ok(label.style.fontScale > 0.68 && label.style.fontScale < 0.72, `expected every node scale on label, got ${label.style.fontScale}`);
  assert.ok(box.width > parseDimension("15.2pt"), `expected scaled tkz normal vertex width near native TikZ, got ${box.width}`);
  assert.ok(box.width < parseDimension("15.6pt"), `expected scaled tkz normal vertex width near native TikZ, got ${box.width}`);
  assert.deepEqual(label.fitBox, { width: box.width, height: box.height });
});

test("stores coordinates declared inside a path", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (A) at (0,0) {};
  \draw (A) ++(0:1) coordinate(A1) arc (0:90:1) coordinate(A2);
  \draw (A1) -- (A2);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  assert.ok(ir.coordinates.A1);
  assert.ok(ir.coordinates.A2);
  assert.ok(ir.items.filter((item) => item.type === "path").length >= 2);
});

test("supports legacy right-of positioning and named inline path nodes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (A) at (0,0) {};
  \node[right of=A] (B) {};
  \path (B) -- node[pos=0.5] (mid) {M} (A);
  \draw (mid) -- (B);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  assert.ok(ir.coordinates.B.x > ir.coordinates.A.x);
  assert.ok(ir.coordinates.mid);
});

test("supports positioned coordinate statements and harmless color/braid commands", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (h1) at (0,0) {};
  \coordinate[right=5em of h1] (A);
  \color{red}
  \braid (b) at (0,0) s_1;
  \draw (h1) -- (A);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  assert.ok(ir.coordinates.A.x > ir.coordinates.h1.x);
});

test("expands simple two-strand braid commands into colored cubic paths", () => {
  const source = String.raw`
\documentclass[crop, tikz]{standalone}
\usepackage{tikz}
\usepackage{braids}
\begin{document}
\begin{tikzpicture}
  \braid[rotate=90,style strands={1}{red, very thick},style strands={2}{blue, very thick}] (dna) at (0,0) s_1 s_1 s_1;
\end{tikzpicture}
\end{document}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const braidPaths = ir.items.filter((item) => item.type === "path" && item.commands.some((command) => command.type === "curveTo"));

  assert.equal(diagnostics.length, 0);
  assert.equal(braidPaths.length, 2);
  assert.ok(braidPaths.some((item) => item.style.stroke === "red"), "expected red strand path");
  assert.ok(braidPaths.some((item) => item.style.stroke === "blue"), "expected blue strand path");
  assert.ok(braidPaths.every((item) => item.commands.filter((command) => command.type === "curveTo").length >= 3));
  assert.ok(braidPaths.every((item) => item.commands.some((command) => command.type === "lineTo")));
  assert.ok(braidPaths.every((item) => item.commands.at(-1).x > 3.2));
});

test("parses em and ex dimensions used by TikZ positioning snippets", () => {
  expectClose(parseDimension("1em"), 10 / 28.4527559);
  expectClose(parseDimension("2ex"), (2 * 4.30554) / 28.4527559);
});

test("keeps Case 038 compact math labels from inflating narrow network boxes", () => {
  const source = String.raw`\begin{tikzpicture}
    \node[rectangle, draw, minimum width=0.5cm,minimum height=2.5cm] (X) at (-2, 0) {$\vec{x}$};
    \node[rectangle, draw, right=1.5em of X, text depth=0em, minimum width=1.5cm,minimum height=2.5cm] (W1) {\${\bf W_1}\times$};
    \node[rectangle, draw, right=1.5em of W1, text depth=0em, minimum width=0.5cm,minimum height=2.5cm] (B1) {$+ \vec{b}_1$};
  \end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  assert.equal(diagnostics.length, 0);

  const boxes = Object.fromEntries(ir.items.filter((item) => item.type === "nodeBox").map((item) => [item.id, item]));
  assert.ok(boxes.X.width <= 0.52, `expected vector input frame to stay near 0.5cm, got ${boxes.X.width}`);
  assert.ok(boxes.B1.width > 0.75 && boxes.B1.width < 0.85, `expected bias frame near native width, got ${boxes.B1.width}`);
  assert.ok(ir.coordinates.B1.x > 1.2 && ir.coordinates.B1.x < 1.28, `expected native-like B1 position, got ${ir.coordinates.B1.x}`);
});
