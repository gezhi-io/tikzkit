import assert from "node:assert/strict";
import test from "node:test";
import { parseTikz, interpretTikz, tikzToSvg } from "../src/index.js";
import { TIKZ_LINE_WIDTHS, lineWidthFromTikzDimension } from "../src/tikz-metrics.js";

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
    { type: "lineTo", x: 2, y: 0 }
  ]);
  assert.deepEqual(interpreted.ir.items[1].commands, [
    { type: "moveTo", x: 0, y: 1 },
    { type: "lineTo", x: 2, y: 1 }
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
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const dashArrays = ir.items.map((item) => item.style.dashArray);

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(dashArrays, [
    [TIKZ_LINE_WIDTHS.default, lineWidthFromTikzDimension("2pt")],
    [TIKZ_LINE_WIDTHS.default, lineWidthFromTikzDimension("1pt")],
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
    ]
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

test("tikzToSvg emits svg path, marker, y-axis flip, and diagnostics for unsupported syntax", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[red, dashed, ->] (0,0) -- (1,1);
  \unknownthing (0,0);
\end{tikzpicture}`;

  const result = tikzToSvg(source);

  assert.match(result.svg, /<svg[^>]+viewBox=/);
  assert.match(result.svg, /<path[^>]+stroke="red"/);
  assert.match(result.svg, /stroke-dasharray=/);
  assert.match(result.svg, /marker-end="url\(#arrow-to-/);
  assert.match(result.svg, /L 100 -100/);
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
  \draw[very thick, draw=red, -{Stealth[color=orange, fill=red, width=8pt, length=10pt]}] (0,5) -- (1,5);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const paths = ir.items.filter((item) => item.type === "path");
  const customTip = paths[5].style.markerEnd;

  assert.deepEqual(diagnostics, []);
  assert.equal(paths[0].style.markerEnd.kind, "to");
  assert.equal(paths[1].style.markerStart.kind, "to");
  assert.equal(paths[2].style.markerStart.kind, "to");
  assert.equal(paths[2].style.markerEnd.kind, "to");
  assert.equal(paths[3].style.markerEnd.kind, "stealth");
  assert.equal(paths[4].style.markerStart.kind, "stealth");
  assert.equal(customTip.kind, "stealth");
  assert.equal(customTip.stroke, "orange");
  assert.equal(customTip.fill, "red");
  assert.equal(Math.round(customTip.width), Math.round(lineWidthFromTikzDimension("8pt")));
  assert.equal(Math.round(customTip.length), Math.round(lineWidthFromTikzDimension("10pt")));
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
  assert.ok(endpoint.x < targetWest - 0.02, `expected arrow tip before target interior, got ${endpoint.x} vs ${targetWest}`);
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
  assert.ok(end.x < targetBox.x - targetBox.width / 2, `expected curve to end before target border, got ${end.x}`);
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
