import assert from "node:assert/strict";
import test from "node:test";
import { interpretTikz, parseTikz, renderSvg, tikzToSvg } from "../src/index.js";
import { parseDimension } from "../src/math.js";
import { lineWidthFromPt } from "../src/tikz-metrics.js";

function formatted(value) {
  const rounded = Math.round((value + Number.EPSILON) * 1e6) / 1e6;
  return String(Object.is(rounded, -0) ? 0 : rounded);
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
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 1, y: 2.5 },
    { type: "lineTo", x: 2, y: 1.5 },
    { type: "lineTo", x: 0, y: 2 }
  ]);
});

test("resolves multi-word node anchors before coordinate projections", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw, minimum width=2cm, minimum height=1cm] (A) at (1,2) {A};
  \draw (A.north west) rectangle (A.south east);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 0, y: 2.5 },
    { type: "lineTo", x: 2, y: 2.5 },
    { type: "lineTo", x: 2, y: 1.5 },
    { type: "lineTo", x: 0, y: 1.5 },
    { type: "closePath" }
  ]);
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

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 1, y: 3.5 },
    { type: "lineTo", x: 6, y: 3.5 },
    { type: "lineTo", x: 6, y: 1.5 },
    { type: "lineTo", x: 1, y: 1.5 },
    { type: "closePath" }
  ]);
});

test("applies transform canvas scale to scoped node geometry and text", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{scope}[shift={(1,1)},transform canvas={scale=0.5}]
    \node[draw, minimum width=2cm, minimum height=1cm] (A) at (2,0) {A};
  \end{scope}
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "A");
  const text = ir.items.find((item) => item.type === "textNode" && item.text === "A");

  assert.equal(diagnostics.length, 0);
  assert.equal(box.x, 2);
  assert.equal(box.y, 1);
  assert.equal(box.width, 1);
  assert.equal(box.height, 0.5);
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
  assert.deepEqual(path.commands[1], { type: "lineTo", x: 0.5, y: -0.25 });
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
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 1.25, y: 0 },
    { type: "lineTo", x: 2.75, y: 0 }
  ]);
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

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 1, y: 0 },
    { type: "lineTo", x: 3.5, y: 0 }
  ]);
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
  assert.ok(Math.abs(arrow.commands[0].x - (boxes[0].x + boxes[0].width / 2)) < 1e-6);
  assert.ok(Math.abs(arrow.commands.at(-1).x - (boxes[1].x - boxes[1].width / 2)) < 1e-6);
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
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 4.92, y: 4 },
    { type: "lineTo", x: 1.08, y: 4 }
  ]);
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

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 1.6, y: 0.25 },
    { type: "lineTo", x: 4.4, y: 0.25 }
  ]);
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
  assert.ok(topCells.every((cell) => cell.style.stroke === "black" && cell.style.fill === "rgb(179 217 179)"));
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
  const backgroundIndex = ir.items.findIndex((item) => item.type === "path" && item.style.fill === "rgb(230 242 230)");
  const textIndex = ir.items.findIndex((item) => item.type === "textNode" && item.text === "front");

  assert.equal(diagnostics.length, 0);
  assert.ok(backgroundIndex !== -1 && textIndex !== -1);
  assert.ok(backgroundIndex < textIndex, `expected background before text, got ${backgroundIndex} and ${textIndex}`);
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

test("fits matrix-of-nodes text inside compact drawn cells", () => {
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
  assert.ok(Math.abs(fontSize - lineWidthFromPt(10) * 0.72) < 0.01, `expected TikZ-like matrix text size, got ${fontSize}`);
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
  assert.ok(ir.coordinates.k.x < 1.55, `unboxed text nodes should not create excessive spacing, got ${ir.coordinates.k.x}`);
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
  assert.equal(box.height, parseDimension("2em"));
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
    & & & |[fill=gray]| & |[fill=gray]| & |[fill=gray]| & |[fill=gray]| & |[fill=gray]| \\
  };
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const boxes = ir.items.filter((item) => item.type === "nodeBox");

  assert.equal(diagnostics.length, 0);
  assert.ok(ir.coordinates.bg);
  assert.ok(boxes.length >= 6);
  assert.ok(boxes.some((box) => box.style.stroke === "black" && box.width < 1), "expected scaled matrix draw container");
  assert.ok(boxes.some((box) => box.style.fill === "gray" && box.width < 0.08), "expected scaled filled cells");
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

test("creates PetarV cube pic coordinates and treats toggles as no-ops", () => {
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

test("normalizes larger bold math labels used as graph markers", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, draw, thick] (S) {$\boldsymbol\Sigma$};
  \node[red] at (1,0) {$\mathlarger{\mathlarger{\mathlarger{\mathlarger{\mathlarger{\bm{\times}}}}}}$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const svg = renderSvg(ir, { mathRenderer: "svg-text" });
  const sigma = ir.items.find((item) => item.type === "nodeBox");

  assert.equal(diagnostics.length, 0);
  assert.ok(sigma.width < 1.2, `expected compact sigma node, got ${sigma.width}`);
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

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 0.5, y: 0 },
    { type: "lineTo", x: 3.5, y: 0 }
  ]);
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

test("keeps tkz-graph normal vertices at TikZ library size", () => {
  const source = String.raw`
\begin{tikzpicture}[scale=0.8,every node/.style={scale=0.7},font=\tt]
  \GraphInit[vstyle=Normal]
  \SetGraphUnit{2.5}
  \tikzset{VertexStyle/.append  style={fill}}
  \Vertex{ATG}
  \EA(ATG){TGG}
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "ATG");
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "ATG");

  assert.equal(diagnostics.length, 0);
  assert.ok(ir.coordinates.TGG.x > 1.98 && ir.coordinates.TGG.x < 2.02, `expected picture scale to affect tkz coordinates, got ${ir.coordinates.TGG.x}`);
  assert.equal(box.style.fill, "white");
  assert.equal(label.style.fill, "black");
  assert.ok(label.style.fontScale > 0.68 && label.style.fontScale < 0.72, `expected every node scale on label, got ${label.style.fontScale}`);
  assert.ok(box.width <= parseDimension("18pt") + 0.03, `expected tkz normal vertex size, got ${box.width}`);
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

test("parses em and ex dimensions used by TikZ positioning snippets", () => {
  assert.equal(parseDimension("1em"), 0.35);
  assert.equal(parseDimension("2ex"), 0.3);
});
