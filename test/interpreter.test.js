import assert from "node:assert/strict";
import test from "node:test";
import { parseTikz, interpretTikz, tikzToSvg } from "../src/index.js";
import { TIKZ_LINE_WIDTHS, TIKZ_UNIT, lineWidthFromTikzDimension } from "../src/tikz-metrics.js";

test("interprets draw, foreach, pgfmath, named coordinates, and calc expressions", () => {
  const source = String.raw`
\begin{tikzpicture}[scale=10]
  \pgfmathsetmacro{\r}{2}
  \coordinate (A) at (0,0);
  \coordinate (B) at (\r,0);
  \foreach \y in {0,1} { \draw[blue, thick] ($(A)+(0,\y)$) -- ($(B)+(0,\y)$); }
\end{tikzpicture}`;

  const parsed = parseTikz(source);
  const interpreted = interpretTikz(parsed.ast);

  assert.equal(interpreted.diagnostics.length, 0);
  assert.equal(interpreted.ir.items.length, 2);
  assert.deepEqual(interpreted.ir.items[0].commands, [
    { type: "moveTo", x: 0, y: 0 },
    { type: "lineTo", x: 20, y: 0 }
  ]);
  assert.deepEqual(interpreted.ir.items[1].commands, [
    { type: "moveTo", x: 0, y: 10 },
    { type: "lineTo", x: 20, y: 10 }
  ]);
  assert.equal(interpreted.ir.items[0].style.stroke, "blue");
  assert.equal(interpreted.ir.items[0].style.lineWidth, TIKZ_LINE_WIDTHS.thick);
});

test("maps TikZ stroke presets and explicit dimensions into SVG stroke units", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw (0,0) -- (1,0);
  \draw[ultra thin] (0,1) -- (1,1);
  \draw[very thick] (0,2) -- (1,2);
  \draw[line width=1mm] (0,3) -- (1,3);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const widths = ir.items.map((item) => item.style.lineWidth);

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(widths, [
    TIKZ_LINE_WIDTHS.default,
    TIKZ_LINE_WIDTHS.ultraThin,
    TIKZ_LINE_WIDTHS.veryThick,
    lineWidthFromTikzDimension("1mm", TIKZ_LINE_WIDTHS.default)
  ]);
});

test("maps TikZ dash pattern presets into SVG dash arrays", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[dotted] (0,0) -- (1,0);
  \draw[densely dotted, thick] (0,1) -- (1,1);
  \draw[thick, densely dotted] (0,2) -- (1,2);
  \draw[loosely dashed] (0,3) -- (1,3);
  \draw[dash dot] (0,4) -- (1,4);
  \draw[dash pattern=on 2pt off 1pt on 0.5pt off 1pt] (0,5) -- (1,5);
  \draw[dotted, very thick] (0,6) -- (1,6);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const dashArrays = ir.items.map((item) => item.style.dashArray);

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(dashArrays, [
    [TIKZ_LINE_WIDTHS.default, lineWidthFromTikzDimension("2pt")],
    [TIKZ_LINE_WIDTHS.thick, lineWidthFromTikzDimension("1pt")],
    [TIKZ_LINE_WIDTHS.thick, lineWidthFromTikzDimension("1pt")],
    [lineWidthFromTikzDimension("3pt"), lineWidthFromTikzDimension("6pt")],
    [
      lineWidthFromTikzDimension("3pt"),
      lineWidthFromTikzDimension("2pt"),
      TIKZ_LINE_WIDTHS.default,
      lineWidthFromTikzDimension("2pt")
    ],
    [
      lineWidthFromTikzDimension("2pt"),
      lineWidthFromTikzDimension("1pt"),
      lineWidthFromTikzDimension("0.5pt"),
      lineWidthFromTikzDimension("1pt")
    ],
    [TIKZ_LINE_WIDTHS.veryThick, lineWidthFromTikzDimension("2pt")]
  ]);
  assert.equal(ir.items[1].style.lineWidth, TIKZ_LINE_WIDTHS.thick);
});

test("names paths and materializes intersections as coordinates", () => {
  const source = String.raw`
\begin{tikzpicture}
  \path[name path=h] (0,0) -- (2,0);
  \path[name path=v] (1,-1) -- (1,1);
  \path[name intersections={of=h and v, by=I}];
  \draw (I) circle (0.1);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(ir.coordinates.I, { x: 1, y: 0 });
  const circle = ir.items.find((item) => item.shape === "circle");
  assert.equal(circle.cx, 1);
  assert.equal(circle.cy, 0);
  assert.equal(circle.r, 0.1);
});

test("creates marking arrows along a decorated path", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[postaction={decorate}, decoration={markings, mark=at position 0.5 with {\arrow{>}}}] (0,0) -- (2,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  const marker = ir.items.find((item) => item.type === "marker");
  assert.ok(marker);
  assert.equal(marker.kind, "to");
  assert.equal(marker.x, 1);
  assert.equal(marker.y, 0);
  assert.equal(Math.round(marker.angle), 0);
});

test("uses parent path style for marking arrows on arc shapes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[-stealth, postaction=decorate,
    decoration={markings, mark=between positions 0.1 and 1 step 0.1 with {\arrow{stealth}}}]
    (0,0) arc(180:0:1) arc(-180:0:1);
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const markers = result.ir.items.filter((item) => item.type === "marker");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(markers.length > 4, `expected repeated arc markers, got ${markers.length}`);
  assert.equal(markers.every((marker) => marker.style.stroke === "black"), true);
});

test("supports coordinate-system projection, path rotation, midway labels, and node labels", () => {
  const source = String.raw`
\definecolor{olivegreen}{rgb}{0,0.6,0}
\begin{tikzpicture}
  \draw[ultra thick,red] (0,0) -- (60:2.5cm |- 0,0) node[midway,below] {$x$};
  \draw (1,0) arc (0:60:1) node at ($(60/2:0.7)$) {$\alpha$};
  \draw[ultra thick, blue] (60:2.5cm) -- (60:2.5cm |- 0,0) node[midway,right] {$y$};
  \draw[ultra thick,olivegreen,rotate=60] (0,0) -- node[midway,left] {$r$} (2.5,0) coordinate (B);
  \draw[xshift=-1cm] (B) node[circle,fill,inner sep=1pt,label=above:$P$](e){};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const xProjectionLabel = ir.items.find((item) => item.type === "textNode" && item.text === "$x$" && item.x < 1);
  const rLabel = ir.items.find((item) => item.type === "textNode" && item.text.includes("$r$"));
  const yLabel = ir.items.find((item) => item.type === "textNode" && item.text.includes("$y$"));
  const pLabel = ir.items.find((item) => item.type === "textNode" && item.text.includes("$P$"));
  const arc = ir.items.find((item) => item.type === "path" && item.shape === "arc");
  const rotated = ir.items.find((item) => item.type === "path" && item.style.stroke === "rgb(0 153 0)");

  assert.equal(diagnostics.length, 0);
  assert.ok(Math.abs(ir.coordinates.B.x - 1.25) < 0.02, `expected rotated B.x around 1.25, got ${ir.coordinates.B?.x}`);
  assert.ok(Math.abs(ir.coordinates.B.y - 2.165) < 0.02, `expected rotated B.y around 2.165, got ${ir.coordinates.B?.y}`);
  assert.ok(arc);
  assert.ok(arc.commands.some((command) => command.type === "lineTo"), `expected angle arc to draw line segments, got ${JSON.stringify(arc.commands)}`);
  assert.equal(xProjectionLabel.style.fill, "red");
  assert.equal(yLabel.style.fill, "blue");
  assert.equal(rLabel.style.fill, "rgb(0 153 0)");
  assert.ok(rLabel.x > 0.3 && rLabel.x < 0.9, `expected midway r label near rotated segment, got ${rLabel?.x}`);
  assert.ok(rLabel.y > 0.8 && rLabel.y < 1.4, `expected midway r label near rotated segment, got ${rLabel?.y}`);
  assert.ok(yLabel.x > 1.3 && yLabel.y > 0.8 && yLabel.y < 1.4, `expected y label midway on vertical projection, got ${yLabel?.x},${yLabel?.y}`);
  assert.ok(Math.abs(ir.coordinates.e.x - ir.coordinates.B.x) < 1e-6, `expected P marker to stay on B.x, got ${ir.coordinates.e?.x}`);
  assert.ok(Math.abs(ir.coordinates.e.y - ir.coordinates.B.y) < 1e-6, `expected P marker to stay on B.y, got ${ir.coordinates.e?.y}`);
  assert.ok(pLabel && Math.abs(pLabel.x - ir.coordinates.B.x) < 1e-6 && pLabel.y > 2.1, `expected label=above:$P$ above B, got ${pLabel?.x},${pLabel?.y}`);
  assert.equal(rotated.commands.at(-1).type, "lineTo");
  assert.ok(Math.abs(rotated.commands.at(-1).x - 1.25) < 0.0001);
  assert.ok(Math.abs(rotated.commands.at(-1).y - 2.16506) < 0.0001);
});

test("supports TikZ orthogonal path operators with inline labels", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle,fill,inner sep=0,minimum size=0.2cm] (start) at (0,0) {};
  \node (target) at (1,1) {};
  \draw (start) |- node[pos=0.2,right] {START} (target);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "START");

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 0, y: 0.1 },
    { type: "lineTo", x: 0, y: 1 },
    { type: "lineTo", x: 0.92, y: 1 }
  ]);
  assert.ok(label);
  assert.ok(label.x > 0.45 && label.x < 0.55 && label.y > 0.25 && label.y < 0.3, `expected label near first orthogonal segment, got ${label?.x},${label?.y}`);
});

test("approximates snake path morphing on decorated straight segments", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[decorate, decoration={snake, segment length=2mm, amplitude=0.3mm}] (0,0) -- (2,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");

  assert.equal(diagnostics.length, 0);
  assert.ok(path.commands.length > 4, `expected snake to add intermediate commands, got ${path.commands.length}`);
  assert.deepEqual(path.commands[0], { type: "moveTo", x: 0, y: 0 });
  assert.deepEqual(path.commands.at(-1), { type: "lineTo", x: 2, y: 0 });
  assert.ok(path.commands.some((command) => command.type === "lineTo" && Math.abs(command.y) > 0.001));
});

test("approximates snakes brace path replacement decorations", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[decorate, decoration={brace, mirror, raise=0.5cm}] (0,0) -- (1,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");
  const curveCommands = path.commands.filter((command) => command.type === "curveTo");

  assert.equal(diagnostics.length, 0);
  assert.ok(curveCommands.length >= 2, `expected brace to use curved replacement path, got ${JSON.stringify(path.commands)}`);
  assert.deepEqual(path.commands[0], { type: "moveTo", x: 0, y: -0.5 });
  assert.equal(path.commands.at(-1).x, 1);
  assert.equal(path.commands.at(-1).y, -0.5);
  assert.ok(path.commands.some((command) => command.y < -0.55), "expected mirrored brace cusp below the raised baseline");
});

test("offsets inline node labels away from path endpoints", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[->] (0,0) -- (3,0) node[right] {$x$};
  \draw[->] (0,0) -- (0,2) node[above] {$y$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  const xLabel = ir.items.find((item) => item.type === "textNode" && item.text === "$x$");
  const yLabel = ir.items.find((item) => item.type === "textNode" && item.text === "$y$");
  assert.ok(xLabel.x > 3);
  assert.equal(xLabel.y, 0);
  assert.equal(yLabel.x, 0);
  assert.ok(yLabel.y > 2);
});

test("places inline labels between path coordinates", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw (0,0) -- node[above] {$m$} (2,0);
  \draw (0,0) -- node[left] {$n$} (0,-2);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const mLabel = ir.items.find((item) => item.type === "textNode" && item.text === "$m$");
  const nLabel = ir.items.find((item) => item.type === "textNode" && item.text === "$n$");

  assert.equal(diagnostics.length, 0);
  assert.equal(mLabel.x, 1);
  assert.ok(mLabel.y > 0);
  assert.ok(nLabel.x < 0);
  assert.equal(nLabel.y, -1);
});

test("substitutes foreach variables inside inline node labels", () => {
  const source = String.raw`
\begin{tikzpicture}
  \foreach \x in {1,2}
    \draw (0,\x) -- node[above] {$I_{\x}$} (1,\x);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const labels = ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(labels, ["$I_{1}$", "$I_{2}$"]);
});

test("does not draw a node border unless draw or fill is requested", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node at (0,0) {$x^2$};
  \node[draw] at (1,0) {$y^2$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  assert.equal(ir.items.filter((item) => item.type === "textNode").length, 2);
  assert.equal(ir.items.filter((item) => item.type === "nodeBox").length, 1);
});

test("keeps multiline math circle nodes close to TikZ text metrics", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[align=center, circle, draw, thick] (s) at (0,0) {$s_1$\\{\scriptsize$\alpha_{t-1}(s_1)$}};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "s");

  assert.deepEqual(diagnostics, []);
  assert.ok(box, "expected circular node box");
  // Claude: 圆形节点按内容框对角线外接(circumscribe) + 留白，比旧的 max(w,h) 略大，
  // 保证公式四角不戳出圆外、周边有透气空间（用户明确要求）。上限相应放宽。
  assert.ok(box.width >= 0.8, `expected circle to keep enough room for formula text, got ${box.width}`);
  assert.ok(box.width <= 1.55, `expected formula circle to stay reasonable, got ${box.width}`);
});

test("supports common node anchor and shift positioning controls", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[anchor=west, xshift=0.2] at (1,1) {$a$};
  \node[anchor=north, yshift=-0.1] at (2,2) {$b$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  const a = ir.items.find((item) => item.type === "textNode" && item.text === "$a$");
  const b = ir.items.find((item) => item.type === "textNode" && item.text === "$b$");
  assert.ok(a.x > 1.35);
  assert.equal(a.y, 1);
  assert.equal(b.x, 2);
  assert.ok(b.y < 1.7);
});

test("inherits picture-level font size into inline path labels", () => {
  const normal = interpretTikz(parseTikz(String.raw`
\begin{tikzpicture}
  \draw (0,0) -- (3,0) node[right] {to};
\end{tikzpicture}`).ast).ir.items.find((item) => item.type === "textNode" && item.text === "to");
  const scripted = interpretTikz(parseTikz(String.raw`
\begin{tikzpicture}[font=\scriptsize]
  \draw (0,0) -- (3,0) node[right] {to};
\end{tikzpicture}`).ast).ir.items.find((item) => item.type === "textNode" && item.text === "to");

  assert.equal(scripted.style.fontScale, 0.7);
  assert.ok(scripted.x < normal.x, `expected scriptsize label to sit closer to path end, got ${scripted.x} >= ${normal.x}`);
});

test("uses TikZ positioning node distance pairs as vertical and horizontal edge gaps", () => {
  const source = String.raw`
\begin{tikzpicture}[node distance=1.1cm and 1.6cm,box/.style={draw,minimum width=1.4cm,minimum height=.65cm,align=center}]
  \node[box] (input) {Input\\$x$};
  \node[box,right=of input] (encode) {Encode\\$f(x)$};
  \node[box,right=of encode] (latent) {Latent\\$z$};
  \node[box,below=of encode] (loss) {Loss\\$\mathcal L$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.deepEqual(diagnostics, []);
  const boxes = Object.fromEntries(ir.items.filter((item) => item.type === "nodeBox").map((item) => [item.id, item]));
  const defaultOuterSep = TIKZ_LINE_WIDTHS.default / TIKZ_UNIT / 2;
  const horizontalGap = ir.coordinates.encode.x - ir.coordinates.input.x - (boxes.input.width + boxes.encode.width) / 2;
  const verticalGap = ir.coordinates.encode.y - ir.coordinates.loss.y - (boxes.encode.height + boxes.loss.height) / 2;

  assert.equal(ir.coordinates.input.x, 0);
  assert.ok(Math.abs(horizontalGap - (1.6 + defaultOuterSep * 2)) < 1e-6, `expected right=of visible gap to include outer sep, got ${horizontalGap}`);
  assert.ok(Math.abs(verticalGap - (1.1 + defaultOuterSep * 2)) < 1e-6, `expected below=of visible gap to include outer sep, got ${verticalGap}`);
  assert.equal(ir.coordinates.loss.x, ir.coordinates.encode.x);
  assert.equal(ir.coordinates.latent.x, ir.coordinates.encode.x * 2);
});

test("supports diamond node shape and compass anchors", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[shape=diamond, draw, minimum width=4cm, minimum height=2cm, inner sep=0] (n) at (0,0) {diamond node};
  \draw (n.north) -- (n.east) -- (n.south west) -- (n.30);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "n");
  const path = ir.items.find((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.equal(box.shape, "diamond");
  assert.equal(path.commands[0].type, "moveTo");
  assert.equal(path.commands[0].x, 0);
  assert.ok(path.commands[0].y > 1, `expected north anchor above center, got ${path.commands[0].y}`);
  assert.equal(path.commands[1].type, "lineTo");
  assert.ok(path.commands[1].x > 2, `expected east anchor right of center, got ${path.commands[1].x}`);
  assert.equal(path.commands[1].y, 0);
  assert.equal(path.commands[2].type, "lineTo");
  assert.ok(path.commands[2].x < 0 && path.commands[2].y < 0, `expected south west anchor in lower-left quadrant, got ${path.commands[2].x},${path.commands[2].y}`);
  assert.ok(path.commands.at(-1).x > 0 && path.commands.at(-1).x < path.commands[1].x);
  assert.ok(path.commands.at(-1).y > 0 && path.commands.at(-1).y < path.commands[0].y);
});

test("supports built-in TikZ shapes library geometric and symbol nodes", () => {
  const source = String.raw`
\usetikzlibrary{shapes}
\begin{tikzpicture}
  \node[regular polygon, regular polygon sides=5, draw, minimum size=1cm] (p) at (0,0) {P};
  \node[star, star points=6, draw, right=1.8cm of p] (s) {S};
  \node[trapezium, trapezium left angle=70, trapezium right angle=110, draw, right=1.8cm of s] (t) {T};
  \node[cloud, draw, right=1.8cm of t] (c) {C};
  \draw (p.east) -- (s.west) -- (t.north) -- (c.180);
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const boxes = result.ir.items.filter((item) => item.type === "nodeBox");
  const shapes = boxes.map((item) => item.shape);
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(shapes, ["regularPolygon", "star", "trapezium", "cloud"]);
  assert.equal(path.commands.length, 4);
  assert.ok(path.commands[0].x > boxes[0].x, `expected regular polygon east anchor on right border`);
  assert.ok(path.commands[1].x < boxes[1].x, `expected star west anchor on left border`);
  assert.ok(path.commands[2].y > boxes[2].y, `expected trapezium north anchor above center`);
  assert.match(result.svg, /class="tikz-node-shape tikz-node-regularPolygon"/);
  assert.match(result.svg, /class="tikz-node-shape tikz-node-star"/);
  assert.match(result.svg, /class="tikz-node-shape tikz-node-trapezium"/);
  assert.match(result.svg, /class="tikz-node-shape tikz-node-cloud"/);
});

test("treats usetikzlibrary declarations as built-in library imports", () => {
  const source = String.raw`
\begin{tikzpicture}
  \usetikzlibrary{shapes}
  \node[star, draw] (s) at (0,0) {S};
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const box = result.ir.items.find((item) => item.type === "nodeBox");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(box.shape, "star");
});

test("keeps text, mid, and base anchors distinct inside nodes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[shape=diamond, minimum width=4cm, minimum height=2cm] (n) {diamond\hspace{2cm}node};
  \draw (n.text) -- (n.mid) -- (n.base);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.ok(path.commands[0].x < path.commands[1].x, `expected text anchor left of mid, got ${JSON.stringify(path.commands)}`);
  assert.ok(path.commands[2].y < path.commands[1].y, `expected base anchor below mid, got ${JSON.stringify(path.commands)}`);
});

test("sizes diamond nodes from hspace and directional inner sep", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[shape=diamond, draw, inner xsep=0.5cm, inner ysep=0.5cm] (n) {\Huge diamond\hspace{2.6cm}node};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "n");

  assert.deepEqual(diagnostics, []);
  assert.equal(box.shape, "diamond");
  assert.ok(box.width > 7, `expected diamond width to include hspace and xsep, got ${box.width}`);
  assert.ok(box.height > 4, `expected diamond height to expand around wide text, got ${box.height}`);
});

test("tikzToSvg emits svg path, inline arrow tip, y-axis flip, and diagnostics for unsupported syntax", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[red, dashed, ->] (0,0) -- (1,1);
  \unknownthing (0,0);
\end{tikzpicture}`;

  const result = tikzToSvg(source);

  assert.match(result.svg, /<svg[^>]+viewBox=/);
  assert.match(result.svg, /<path[^>]+stroke="red"/);
  assert.match(result.svg, /stroke-dasharray=/);
  assert.doesNotMatch(result.svg, /marker-end=/);
  assert.match(result.svg, /class="tikz-arrow-tip tikz-arrow-to"/);
  assert.match(result.svg, /L 99\.[0-9]+ -99\.[0-9]+/);
  assert.equal(result.diagnostics.some((d) => d.severity === "warning"), true);
});

test("keeps common TikZ arrow tip styles distinct in the drawing IR", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[->] (0,0) -- (1,0);
  \draw[<-] (0,1) -- (1,1);
  \draw[<->] (0,2) -- (1,2);
  \draw[-stealth] (0,3) -- (1,3);
  \draw[stealth-] (0,4) -- (1,4);
  \draw[-latex'] (0,5) -- (1,5);
  \draw[very thick, draw=red, -{Stealth[color=orange, fill=red, width=8pt, length=10pt]}] (0,5) -- (1,5);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const paths = ir.items.filter((item) => item.type === "path");
  const customTip = paths[6].style.markerEnd;

  assert.deepEqual(diagnostics, []);
  assert.equal(paths[0].style.markerEnd.kind, "to");
  assert.equal(paths[1].style.markerStart.kind, "to");
  assert.equal(paths[2].style.markerStart.kind, "to");
  assert.equal(paths[2].style.markerEnd.kind, "to");
  assert.equal(paths[3].style.markerEnd.kind, "stealth");
  assert.equal(paths[4].style.markerStart.kind, "stealth");
  assert.equal(paths[5].style.markerEnd.kind, "latex");
  assert.equal(customTip.kind, "stealth");
  assert.equal(customTip.stroke, "orange");
  assert.equal(customTip.fill, "red");
  assert.equal(Math.round(customTip.width), Math.round(lineWidthFromTikzDimension("8pt")));
  assert.equal(Math.round(customTip.length), Math.round(lineWidthFromTikzDimension("10pt")));
});

test("draws plot mark x coordinates as small cross paths", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[shift={(1,2)}] plot[mark=x] coordinates{(0,0)};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const mark = ir.items.find((item) => item.shape === "plot-mark");

  assert.deepEqual(diagnostics, []);
  assert.ok(mark, "expected plot[mark=x] to create a plot-mark path");
  assert.equal(mark.commands.length, 4);
  assert.ok(mark.commands.every((command) => Math.abs(command.x - 1) < 0.1 && Math.abs(command.y - 2) < 0.1));
});

test("substitutes foreach variables used as node option keys", () => {
  const source = String.raw`
\begin{tikzpicture}
  \foreach \placement in {above,below}
    \draw (0,0) node[\placement,inner sep=0.1] {\placement};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const above = ir.items.find((item) => item.type === "textNode" && item.text === "above");
  const below = ir.items.find((item) => item.type === "textNode" && item.text === "below");

  assert.deepEqual(diagnostics, []);
  assert.ok(above.y > 0, `expected above label to move up, got ${above?.y}`);
  assert.ok(below.y < 0, `expected below label to move down, got ${below?.y}`);
});

test("keeps arrow endpoints clear of target node interiors", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, draw, fill, inner sep=0.2em] (a) at (0,0) {};
  \node[circle, draw, fill, inner sep=0.2em] (b) at (1,0) {};
  \draw[-stealth, thick] (a) -- (b);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const targetBox = ir.items.filter((item) => item.type === "nodeBox").at(1);
  const arrow = ir.items.find((item) => item.type === "path" && item.style.markerEnd);
  const endpoint = arrow.commands.at(-1);
  const targetWest = targetBox.x - targetBox.width / 2;

  assert.deepEqual(diagnostics, []);
  assert.ok(Math.abs(endpoint.x - targetWest) < 1e-6, `expected arrow tip on target border, got ${endpoint.x} vs ${targetWest}`);
});

test("renders dashed double arrows as paired strokes with the label preserved", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw[-stealth, double, dashed, thick] (5.5,0) -- node[above] {dropout} (8.6, 0);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const path = result.ir.items.find((item) => item.type === "path" && item.style.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(path.style.doubleColor, "white");
  assert.match(result.svg, /class="tikz-arrowed-path tikz-double-path"/);
  assert.match(result.svg, /class="tikz-double-outer"/);
  assert.match(result.svg, /class="tikz-double-inner"/);
  assert.match(result.svg, /stroke-dasharray=/);
  assert.match(result.svg, /class="tikz-arrow-tip tikz-arrow-stealth"/);
  assert.match(result.svg, />dropout</);
});

test("breaks paths around intermediate text node borders", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (a) at (0,0) {};
  \node (label) at (2,0) {Line 1};
  \node (b) at (4,0) {};
  \draw (a) -- (label) -- (b);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");

  assert.equal(diagnostics.length, 0);
  assert.equal(path.commands.length, 4);
  assert.equal(path.commands[2].type, "moveTo");
  assert.ok(path.commands[1].x < ir.coordinates.label.x);
  assert.ok(path.commands[2].x > ir.coordinates.label.x);
});

test("keeps decimal coordinates distinct from numeric node anchors", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (1) at (6,-3.25) {};
  \draw[very thick, stealth-stealth] (1.5, 0) -- node[above] {\tt git pull} node[below] {\tt git push} (4.5, 0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const arrow = ir.items.find((item) => item.type === "path" && item.style.markerStart && item.style.markerEnd);
  const labels = ir.items.filter((item) => item.type === "textNode" && item.text.includes("git"));

  assert.deepEqual(diagnostics, []);
  assert.equal(arrow.commands[0].x, 1.5);
  assert.equal(arrow.commands[0].y, 0);
  assert.equal(arrow.commands.at(-1).x, 4.5);
  assert.equal(arrow.commands.at(-1).y, 0);
  assert.deepEqual(
    labels.map((label) => [label.text, label.x, label.y]),
    [
      [String.raw`\tt git pull`, 3, 0.25],
      [String.raw`\tt git push`, 3, -0.25]
    ]
  );
});

test("clips curved to-path arrows against node borders", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw, minimum width=0.5cm, minimum height=0.3cm] (a) at (0,0) {A};
  \node[draw, minimum width=0.5cm, minimum height=0.3cm] (b) at (2,0) {B};
  \draw[-stealth] (a) to[out=20,in=160] (b);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const [sourceBox, targetBox] = ir.items.filter((item) => item.type === "nodeBox");
  const arrow = ir.items.find((item) => item.type === "path" && item.style.markerEnd);
  const start = arrow.commands[0];
  const end = arrow.commands.at(-1);

  assert.deepEqual(diagnostics, []);
  assert.equal(end.type, "curveTo");
  assert.ok(start.x >= sourceBox.x + sourceBox.width / 2 - 1e-6, `expected curve to start at source border, got ${start.x}`);
  assert.ok(Math.abs(end.x - (targetBox.x - targetBox.width / 2)) < 1e-6, `expected curve to end at target border, got ${end.x}`);
});

test("approximates TikZ bend left and bend right edge arrows as curves", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw] (a) at (0,0) {A};
  \node[draw] (b) at (2,0) {B};
  \draw[-stealth] (a) edge[bend left=40] (b);
  \draw[-stealth] (a) edge[bend right=40] (b);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const arrows = ir.items.filter((item) => item.type === "path" && item.style.markerEnd);

  assert.deepEqual(diagnostics, []);
  assert.equal(arrows.length, 2);
  assert.equal(arrows[0].commands.at(-1).type, "curveTo");
  assert.equal(arrows[1].commands.at(-1).type, "curveTo");
  assert.notEqual(Math.sign(arrows[0].commands.at(-1).y1), Math.sign(arrows[1].commands.at(-1).y1));
});

test("uses PGF to-path looseness control distance", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw (0,0) to[out=0,in=180] (2,0);
  \draw (0,1) to[out=0,in=180,looseness=2] (2,1);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const [normal, loose] = ir.items.filter((item) => item.type === "path");
  const normalCurve = normal.commands.at(-1);
  const looseCurve = loose.commands.at(-1);

  assert.deepEqual(diagnostics, []);
  assert.equal(normalCurve.type, "curveTo");
  assert.ok(Math.abs(normalCurve.x1 - 0.783) < 1e-6, `expected PGF 0.3915 control arm, got ${normalCurve.x1}`);
  assert.ok(Math.abs(normalCurve.x2 - 1.217) < 1e-6, `expected mirrored PGF control arm, got ${normalCurve.x2}`);
  assert.ok(Math.abs(looseCurve.x1 - 1.566) < 1e-6, `expected looseness=2 to double out arm, got ${looseCurve.x1}`);
  assert.ok(Math.abs(looseCurve.x2 - 0.434) < 1e-6, `expected looseness=2 to double in arm, got ${looseCurve.x2}`);
});

test("attaches bend edges to the border along the curve tangent, not the chord", () => {
  // Regression for gallery case 020: with a vertical chord, a bend must move the
  // departure point onto the bottom edge off the centre line. Chord-based clipping
  // would leave the arrow on the centre line (start.x == 0) and hook into the corner.
  const source = String.raw`
\begin{tikzpicture}
  \node[draw, minimum width=2cm, minimum height=1cm] (a) at (0,0) {A};
  \node[draw, minimum width=2cm, minimum height=1cm] (b) at (0,-3) {B};
  \draw[-stealth] (a) edge[bend left=45] (b);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const [aBox] = ir.items.filter((item) => item.type === "nodeBox");
  const arrow = ir.items.find((item) => item.type === "path" && item.style.markerEnd);
  const start = arrow.commands[0];
  const aBottom = aBox.y - aBox.height / 2;

  assert.deepEqual(diagnostics, []);
  assert.ok(Math.abs(start.y - aBottom) < 1e-6, `expected bend to depart from bottom border, got y=${start.y} vs ${aBottom}`);
  assert.ok(Math.abs(start.x) > 1e-3, `expected bend tangent to shift departure off the chord centre, got x=${start.x}`);
});

test("applies edge-local snake decoration along bent arrows", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw] (a) at (0,0) {A};
  \node[draw] (b) at (2,0) {B};
  \draw[-stealth] (a) edge[bend left=40, decorate, decoration={snake, segment length=2mm, amplitude=0.3mm}] (b);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const arrow = ir.items.find((item) => item.type === "path" && item.style.markerEnd);
  const lineCommands = arrow.commands.filter((command) => command.type === "lineTo");

  assert.deepEqual(diagnostics, []);
  assert.ok(lineCommands.length > 8, `expected snake to flatten the bent edge, got ${lineCommands.length} segments`);
  assert.ok(lineCommands.some((command) => Math.abs(command.y) > 0.05));
});

test("applies snake decoration to ellipse outlines", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[ultra thick, decorate, decoration={snake, segment length=1mm, amplitude=0.3mm}] (0,0) ellipse (0.23 and 3.05);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const outline = ir.items.find((item) => item.type === "path");
  const lineCommands = outline.commands.filter((command) => command.type === "lineTo");

  assert.deepEqual(diagnostics, []);
  assert.ok(lineCommands.length > 80, `expected decorated ellipse to be flattened into many snake segments, got ${lineCommands.length}`);
  assert.ok(lineCommands.some((command) => Math.abs(Math.abs(command.x) - 0.23) > 0.005));
});

test("projects path circles through TikZ picture basis vectors", () => {
  const source = String.raw`
\begin{tikzpicture}[y={(-0.86cm,0.5cm)},x={(0.86cm,0.5cm)}, z={(0cm,1cm)}]
  \draw circle (2);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const circle = ir.items.find((item) => item.type === "path" && item.shape === "circle");
  const points = circle.commands.filter((command) => command.type === "moveTo" || command.type === "curveTo");
  const xs = points.map((command) => command.x);
  const ys = points.map((command) => command.y);

  assert.deepEqual(diagnostics, []);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 3.3, `expected projected circle width to follow x/y basis, got ${xs}`);
  assert.ok(Math.max(...ys) - Math.min(...ys) < 2.2, `expected projected circle height to be compressed, got ${ys}`);
});

test("approximates zigzag path morphing on decorated edges", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (a) at (0,0) {};
  \node (b) at (2,0) {};
  \path[-stealth, decorate, decoration={zigzag, segment length=2mm, amplitude=0.3mm}] (a) edge[bend left] (b);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path" && item.style.markerEnd);
  const lineCommands = path.commands.filter((command) => command.type === "lineTo");

  assert.deepEqual(diagnostics, []);
  assert.ok(lineCommands.length > 8, `expected zigzag edge to be flattened, got ${lineCommands.length}`);
  assert.ok(lineCommands.some((command) => Math.abs(command.y) > 0.03));
});

test("draws arrowed edge operations inside path statements", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw] (a) at (0,0) {A};
  \node[draw] (b) at (2,0) {B};
  \path[-stealth, thick] (a) edge[bend left=45] (b);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const edge = ir.items.find((item) => item.type === "path" && item.style.markerEnd);

  assert.deepEqual(diagnostics, []);
  assert.ok(edge, "expected path edge to produce a visible arrow");
  assert.equal(edge.commands.at(-1).type, "curveTo");
  assert.equal(edge.style.stroke, "black");
});

test("applies inline edge style options to the generated path", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (a) at (0,0) {A};
  \node (b) at (1,0) {B};
  \draw (a) edge[very thick, draw=red, -{Stealth[color=orange, fill=red, width=8pt, length=10pt]}] (b);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const edge = ir.items.find((item) => item.type === "path" && item.style.markerEnd);

  assert.deepEqual(diagnostics, []);
  assert.equal(edge.style.stroke, "red");
  assert.equal(edge.style.lineWidth, TIKZ_LINE_WIDTHS.veryThick);
  assert.equal(edge.style.markerEnd.stroke, "orange");
  assert.equal(edge.style.markerEnd.fill, "red");
});

test("renders edge operations attached to node statements", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, draw, minimum size=1cm, inner sep=0] (a) at (0,0) {$a$};
  \node[circle, draw, minimum size=1cm, inner sep=0] (b) at (2,0) {$b$}
    edge[gray, thin, stealth-] (a);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const edge = ir.items.find((item) => item.type === "path" && item.style.stroke === "gray");

  assert.deepEqual(diagnostics, []);
  assert.ok(edge, "expected node-attached edge to produce a path");
  assert.equal(edge.style.markerStart.kind, "stealth");
  assert.deepEqual(edge.commands, [
    { type: "moveTo", x: 1.5, y: 0 },
    { type: "lineTo", x: 0.5, y: 0 }
  ]);
});

test("keeps repeated node-attached edges rooted at the source node", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, draw, minimum size=1cm, inner sep=0] (a) at (0,0) {$a$};
  \node[circle, draw, minimum size=1cm, inner sep=0] (c) at (2,2) {$c$};
  \node[circle, draw, minimum size=1cm, inner sep=0] (b) at (2,0) {$b$}
    edge[gray, thin, stealth-] (a)
    edge[gray, thin, stealth-] (c);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const edges = ir.items.filter((item) => item.type === "path" && item.style.stroke === "gray");

  assert.deepEqual(diagnostics, []);
  assert.equal(edges.length, 2);
  assert.deepEqual(edges.map((edge) => edge.commands[0]), [
    { type: "moveTo", x: 1.5, y: 0 },
    { type: "moveTo", x: 2, y: 0.5 }
  ]);
});

test("applies xslant/yslant shear and pt-based yshift in scope transforms", () => {
  // Claude: 锁定 yslant/xslant 斜切与 yshift 的裸数字按 pt 解析（修复多层网络伪三维图，如 case 043）。
  const source = String.raw`
\begin{tikzpicture}
  \begin{scope}[yslant=0.5,xslant=-0.6]
    \draw (1,0) -- (0,1);
  \end{scope}
  \begin{scope}[yshift=28.4527559]
    \draw (0,0) -- (1,0);
  \end{scope}
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  assert.equal(diagnostics.length, 0);
  // xslant=-0.6 / yslant=0.5 把 (x,y) 剪成 (x-0.6y, 0.5x+y)
  assert.deepEqual(ir.items[0].commands, [
    { type: "moveTo", x: 1, y: 0.5 },
    { type: "lineTo", x: -0.6, y: 0.7 }
  ]);
  // yshift=28.4527559(裸数字)= 28.45pt = 1cm, 而不是 28.45cm
  assert.deepEqual(ir.items[1].commands, [
    { type: "moveTo", x: 0, y: 1 },
    { type: "lineTo", x: 1, y: 1 }
  ]);
});

test("supports per-plot options and polar basis vectors for calibration cases", () => {
  const source = String.raw`
\begin{tikzpicture}[x=(30:1),y=(90:1)]
  \draw[samples=3,variable=\t] plot[domain=0:2] (\t,{\t});
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const plot = ir.items.find((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.equal(plot.commands.length, 3);
  assert.deepEqual(plot.commands[0], { type: "moveTo", x: 0, y: 0 });
  assert.deepEqual(plot.commands[2], { type: "lineTo", x: 1.73205, y: 3 });
});
