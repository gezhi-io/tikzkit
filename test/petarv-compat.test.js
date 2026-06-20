import assert from "node:assert/strict";
import test from "node:test";
import { interpretTikz, parseTikz, renderSvg } from "../src/index.js";
import { parseDimension } from "../src/math.js";

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
  \node (a) at (0,0) {};
  \begin{pgfonlayer}{background}
    \draw (a.center) -- (1,0);
  \end{pgfonlayer}
  \node (b) at (2,0) {};
  \draw (a) -- (b);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(ir.coordinates.b, { x: 2, y: 0 });
  assert.equal(ir.items.filter((item) => item.type === "path").length, 2);
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

test("uses compact boxes for simple matrix-of-nodes cells", () => {
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
  assert.ok(boxes.every((box) => box.width < 0.4), `expected compact widths, got ${boxes.map((box) => box.width)}`);
  assert.ok(boxes.every((box) => box.height < 0.4), `expected compact heights, got ${boxes.map((box) => box.height)}`);
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
  assert.ok(fontSize > 18, `expected readable matrix text, got ${fontSize}`);
  assert.ok(fontSize < box.height * 100, `expected text to fit within ${box.height * 100}px cell height, got ${fontSize}`);
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
  assert.ok(ir.coordinates.k.x < 1.35, `unboxed text nodes should not create excessive spacing, got ${ir.coordinates.k.x}`);
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

test("keeps A3C-style rounded math nodes compact and rounded", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[rounded rectangle, draw, thick, align=center] (A1) {Agent 1\\$(\theta_1', \psi_1')$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox");

  assert.equal(diagnostics.length, 0);
  assert.ok(box.width < 2.2, `expected compact rounded node width, got ${box.width}`);
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

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(ir.coordinates.AT, { x: 0, y: 0 });
  assert.deepEqual(ir.coordinates.TG, { x: 2, y: 0 });
  assert.deepEqual(ir.coordinates.GG, { x: 2, y: -2 });
  assert.deepEqual(ir.coordinates.NE, { x: 2, y: 2 });
  assert.deepEqual(ir.coordinates.SE, { x: 4, y: -2 });
  assert.ok(ir.items.filter((item) => item.type === "path").length >= 2);
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
