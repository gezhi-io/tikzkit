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

test("renders labels attached to coordinate statements", () => {
  const source = String.raw`
\begin{tikzpicture}
  \coordinate[label=above:$p$] (p) at (2,9);
  \coordinate[label=left:$u$] (u) at (0,3);
  \coordinate[label=right:$x$] (x) at (7,2);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const label = (text) => ir.items.find((item) => item.type === "textNode" && item.text === text);
  const p = label("$p$");
  const u = label("$u$");
  const x = label("$x$");

  assert.deepEqual(diagnostics, []);
  assert.ok(p && Math.abs(p.x - 2) < 1e-6 && p.y > 9, `expected p above coordinate, got ${JSON.stringify(p)}`);
  assert.ok(u && u.x < 0 && Math.abs(u.y - 3) < 1e-6, `expected u left of coordinate, got ${JSON.stringify(u)}`);
  assert.ok(x && x.x > 7 && Math.abs(x.y - 2) < 1e-6, `expected x right of coordinate, got ${JSON.stringify(x)}`);
});

test("uses color option as the current fill color on fill paths", () => {
  const source = String.raw`
\begin{tikzpicture}
  \fill[color=green,opacity=0.2] (0,0) -- (1,0) -- (0,1) -- cycle;
  \fill[color=blue] (2,0) -- (3,0) -- (2,1) -- cycle;
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const paths = ir.items.filter((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.equal(paths[0].style.fill, "green");
  assert.equal(paths[0].style.stroke, "none");
  assert.equal(paths[0].style.opacity, 0.2);
  assert.equal(paths[1].style.fill, "blue");
  assert.equal(paths[1].style.stroke, "none");
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

test("preserves ball shading on path circle and ellipse shapes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[shading=ball,ball color=yellow] (0,0) circle [radius=2];
  \draw[shading=ball,ball color=black] (1,0) ellipse [x radius=0.2, y radius=0.4];
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const circle = ir.items.find((item) => item.type === "path" && item.shape === "circle");
  const ellipse = ir.items.find((item) => item.type === "path" && item.shape === "ellipse");

  assert.deepEqual(diagnostics, []);
  assert.equal(circle.style.shading, "ball");
  assert.equal(circle.style.ballColor, "yellow");
  assert.equal(circle.style.fill, "yellow");
  assert.equal(ellipse.style.shading, "ball");
  assert.equal(ellipse.style.ballColor, "black");
  assert.equal(ellipse.style.fill, "black");
});

test("does not promote circle operation fill option to draw path fill", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw circle [fill, radius=2pt] node [anchor=south] {text};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const circle = ir.items.find((item) => item.type === "path" && item.shape === "circle");

  assert.deepEqual(diagnostics, []);
  assert.equal(circle.style.stroke, "black");
  assert.equal(circle.style.fill, "none");
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

test("lays out TikZ node child trees with grow and sibling distances", () => {
  const source = String.raw`
\begin{tikzpicture}[font=\tt\scriptsize, grow=up, level 1/.style={sibling distance=30mm}, level 2/.style={sibling distance=20mm}]
  \node[align=center](root){root}
    child{node{right}
      child{node{right leaf}}
      child{node{left leaf}}
    }
    child{node{left}};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const labels = ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  const edges = ir.items.filter((item) => item.type === "path" && item.subtype === "tree-edge");

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(labels, ["root", "right", "right leaf", "left leaf", "left"]);
  assert.equal(edges.length, 4);
  assert.ok(ir.items.find((item) => item.type === "textNode" && item.text === "right" && item.x > 1.4 && item.y > 1.4));
  assert.ok(ir.items.find((item) => item.type === "textNode" && item.text === "left" && item.x < -1.4 && item.y > 1.4));
  assert.ok(labels.every((label) => typeof label === "string"));
});

test("uses monospace text metrics when clipping TikZ child tree edges", () => {
  const source = String.raw`
\begin{tikzpicture}[font=\tt\scriptsize, grow=up, level 1/.style={sibling distance=30mm}]
  \node[align=center](root){AC{-}{-}A\\CC{-}{-}A\\ACG-A\\A-GTA\\A-G-A}
    child{node{AGTA\\AG-A}}
    child{node{ACGA}};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const edge = ir.items.find((item) => item.type === "path" && item.subtype === "tree-edge");

  assert.deepEqual(diagnostics, []);
  assert.ok(edge.commands[0].x > 0.4, `expected tree edge to start outside the monospace root text, got ${edge.commands[0].x}`);
  assert.ok(edge.commands[1].x < 1.2, `expected tree edge to stop before the monospace child text, got ${edge.commands[1].x}`);
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
  assert.equal(path.commands.length, 3);
  assert.deepEqual(path.commands[0], { type: "moveTo", x: 0, y: 0.1 });
  assert.deepEqual(path.commands[1], { type: "lineTo", x: 0, y: 1 });
  assert.equal(path.commands[2].type, "lineTo");
  assert.ok(path.commands[2].x > 0.84 && path.commands[2].x < 1, `expected final segment to stop at target node border, got ${path.commands[2].x}`);
  assert.equal(path.commands[2].y, 1);
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
  const last = path.commands.at(-1);
  assert.equal(last.type, "curveTo");
  assert.equal(last.x, 2);
  assert.equal(last.y, 0);
  assert.ok(
    path.commands.some(
      (command) =>
        command.type === "lineTo" && Math.abs(command.y) > 0.001 ||
        command.type === "curveTo" && (Math.abs(command.y) > 0.001 || Math.abs(command.y1) > 0.001 || Math.abs(command.y2) > 0.001),
    ),
  );
  assert.ok(path.commands.some((command) => command.type === "curveTo"), "expected snake decoration to use smooth cubic segments like native PGF");
});

test("interprets smooth plot coordinate lists as continuous curves", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[-stealth] plot [smooth, tension=1] coordinates { (0,0) (1,1) (2,0) (3,1) };
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.equal(path.commands[0].type, "moveTo");
  assert.equal(path.commands[0].x, 0);
  assert.equal(path.commands[0].y, 0);
  assert.ok(path.commands.some((command) => command.type === "curveTo"), `expected smooth plot to emit curves, got ${JSON.stringify(path.commands)}`);
  assert.equal(path.commands.at(-1).type, "curveTo");
  assert.equal(path.commands.at(-1).x, 3);
  assert.equal(path.commands.at(-1).y, 1);
});

test("matches PGF smooth plot tension control points", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw plot [smooth, tension=1] coordinates { (0,0) (1,1) (2,0) (3,1) };
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");
  const curves = path.commands.filter((command) => command.type === "curveTo");

  assert.deepEqual(diagnostics, []);
  assert.equal(curves.length, 3);
  assert.deepEqual(curves[0], { type: "curveTo", x1: 0, y1: 0, x2: 0.445, y2: 1, x: 1, y: 1 });
  assert.deepEqual(curves[1], { type: "curveTo", x1: 1.555, y1: 1, x2: 1.445, y2: 0, x: 2, y: 0 });
  assert.deepEqual(curves[2], { type: "curveTo", x1: 2.555, y1: 0, x2: 3, y2: 1, x: 3, y: 1 });
});

test("interprets TikZ sine and cosine path operators as PGF cubic curves", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw (0,0) sin (2,1) cos (4,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 0, y: 0 },
    { type: "curveTo", x1: 0.652, y1: 0.512, x2: 1.276, y2: 1, x: 2, y: 1 },
    { type: "curveTo", x1: 2.724, y1: 1, x2: 3.348, y2: 0.512, x: 4, y: 0 }
  ]);
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

test("uses TikZ auto placement for inline path nodes without explicit side", () => {
  const source = String.raw`
\begin{tikzpicture}[auto]
  \path (8,-6) -- node[pos=0.5] (v) {VBlank} (0,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const pathPoint = { x: 4, y: -3 };

  assert.deepEqual(diagnostics, []);
  assert.ok(ir.coordinates.v.x < pathPoint.x - 0.25, `expected auto node to move left of the path point, got ${ir.coordinates.v.x}`);
  assert.ok(ir.coordinates.v.y < pathPoint.y - 0.25, `expected auto node to move below the path point, got ${ir.coordinates.v.y}`);
});

test("uses path text color for inline edge labels instead of stroke color", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[color=red,text=black] (0,0) -- node[above] {$\omega$} (2,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const label = ir.items.find((item) => item.type === "textNode" && item.text === String.raw`$\omega$`);

  assert.deepEqual(diagnostics, []);
  assert.equal(label.style.fill, "black");
});

test("rotates sloped inline labels along their path segment", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw (0,0) -- node[sloped, above] {$a$} (2,2);
  \draw (0,0) -- node[above] {$b$} (2,2);
  \draw (0,0) -- node[sloped, above] {$c$} (-2,2);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const a = ir.items.find((item) => item.type === "textNode" && item.text === "$a$");
  const b = ir.items.find((item) => item.type === "textNode" && item.text === "$b$");
  const c = ir.items.find((item) => item.type === "textNode" && item.text === "$c$");

  assert.deepEqual(diagnostics, []);
  assert.ok(Math.abs(a.rotation - 45) < 1e-6, `expected sloped label to rotate 45 degrees, got ${a.rotation}`);
  assert.equal(b.rotation, undefined);
  assert.ok(Math.abs(c.rotation + 45) < 1e-6, `expected upside-left label to stay upright at -45 degrees, got ${c.rotation}`);
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

test("sizes playing-card suit math nodes from glyph width instead of macro names", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[rectangle,draw,inner sep=0.1em] (c) {$\clubsuit$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "c");

  assert.deepEqual(diagnostics, []);
  assert.ok(box.width > 0.3 && box.width < 0.4, `expected suit box width near native TikZ, got ${box.width}`);
  assert.ok(box.height > 0.33 && box.height < 0.4, `expected suit box height near native TikZ, got ${box.height}`);
});

test("keeps vector object math nodes close to native TikZ height", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[rectangle,draw,minimum width=7em,thick] (o) {$\vec{o}_\clubsuit$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "o");

  assert.deepEqual(diagnostics, []);
  assert.equal(box.width, 2.45);
  assert.ok(box.height > 0.54 && box.height < 0.6, `expected vector object height near native TikZ, got ${box.height}`);
});

test("keeps TeX subscript formula node widths close to native TikZ metrics", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[rectangle,draw,fill=white] (f) {$f_\psi$};
  \node[rectangle,draw,ultra thick] (a) at (2,0) {\large $a_\phi$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const f = ir.items.find((item) => item.type === "nodeBox" && item.id === "f");
  const a = ir.items.find((item) => item.type === "nodeBox" && item.id === "a");

  assert.deepEqual(diagnostics, []);
  assert.ok(f.width > 0.56 && f.width < 0.7, `expected f_psi box width near native TikZ, got ${f.width}`);
  assert.ok(a.width > 0.58 && a.width < 0.74, `expected large a_phi box width near native TikZ, got ${a.width}`);
});

test("keeps single-symbol math circle nodes compact like native TikZ", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle,draw] (times) {$\times$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "times");

  assert.deepEqual(diagnostics, []);
  assert.ok(box.width > 0.58 && box.width < 0.75, `expected compact times circle diameter, got ${box.width}`);
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

test("matches native TikZ shape extents and anchors for text nodes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (r) at (0,1)   [draw, rectangle] {rectangle};
  \node (c) at (1.5,0) [draw, circle]    {circle};
  \node (e) at (3,1)   [draw, ellipse]   {ellipse};
  \draw[->] (r.east)  -- (e.west);
  \draw[->] (r.south) -- (c.north west);
  \draw[->] (e.south) -- (c.north east);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const boxes = Object.fromEntries(ir.items.filter((item) => item.type === "nodeBox").map((item) => [item.id, item]));
  const paths = ir.items.filter((item) => item.type === "path" && item.style?.markerEnd);

  assert.deepEqual(diagnostics, []);
  assert.ok(Math.abs(boxes.r.width - 1.62) < 0.04, `expected rectangle width near native TikZ, got ${boxes.r.width}`);
  assert.ok(Math.abs(boxes.r.height - 0.55) < 0.03, `expected rectangle height near native TikZ, got ${boxes.r.height}`);
  assert.ok(Math.abs(boxes.c.width - 1.14) < 0.05, `expected circle diameter near native TikZ, got ${boxes.c.width}`);
  assert.ok(Math.abs(boxes.e.width - 1.66) < 0.06, `expected ellipse width near native TikZ, got ${boxes.e.width}`);
  assert.ok(Math.abs(boxes.e.height - 0.77) < 0.05, `expected ellipse height near native TikZ, got ${boxes.e.height}`);

  assert.ok(Math.abs(paths[0].commands[0].x - boxes.r.width / 2) < 0.02, "expected arrow to start at rectangle east anchor");
  assert.ok(Math.abs(paths[0].commands[1].x - (boxes.e.x - boxes.e.width / 2)) < 0.02, "expected arrow to end at ellipse west anchor");

  const circleRadius = boxes.c.width / 2;
  const diag = circleRadius / Math.SQRT2;
  assert.ok(Math.abs(paths[1].commands[1].x - (boxes.c.x - diag)) < 0.02, "expected circle north west anchor on circular border");
  assert.ok(Math.abs(paths[1].commands[1].y - (boxes.c.y + diag)) < 0.02, "expected circle north west anchor on circular border");
  assert.ok(Math.abs(paths[2].commands[1].x - (boxes.c.x + diag)) < 0.02, "expected circle north east anchor on circular border");
  assert.ok(Math.abs(paths[2].commands[1].y - (boxes.c.y + diag)) < 0.02, "expected circle north east anchor on circular border");
});

test("uses PGF outer sep when placing nodes by explicit anchors", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[fill=red] (4,2) circle[radius=0.1];
  \node at (4,2) [draw, rectangle, anchor=south west] {rectangle};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.shape === "rectangle");
  const lineWidth = box.style.lineWidth / TIKZ_UNIT;
  const left = box.x - box.width / 2;
  const bottom = box.y - box.height / 2;

  assert.deepEqual(diagnostics, []);
  assert.ok(Math.abs(left - (4 + lineWidth / 2)) < 0.01, `expected west border at outer sep from anchor, got ${left}`);
  assert.ok(Math.abs(bottom - (2 + lineWidth / 2)) < 0.01, `expected south border at outer sep from anchor, got ${bottom}`);
});

test("renders repeated TikZ node labels with every label style", () => {
  const source = String.raw`
\begin{tikzpicture}[every label/.style={scale=0.5}]
  \node[
    label=above:Graphics,
    label=left:Design,
    label=below:Typography,
    label=right:Coding,
    circle, shading=ball, ball color=blue!60,
    text=white] {TikZ};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const ball = ir.items.find((item) => item.type === "nodeBox" && item.shape === "circle");
  const labels = Object.fromEntries(
    ir.items
      .filter((item) => item.type === "textNode" && item.text !== "TikZ")
      .map((item) => [item.text, item])
  );

  assert.deepEqual(diagnostics, []);
  assert.equal(ball.style.shading, "ball");
  assert.equal(ball.style.ballColor, "rgb(102 102 255)");
  assert.deepEqual(Object.keys(labels).sort(), ["Coding", "Design", "Graphics", "Typography"]);
  assert.ok(labels.Graphics.y > 0.6, `expected Graphics above the circle, got ${labels.Graphics.y}`);
  assert.ok(labels.Typography.y < -0.6, `expected Typography below the circle, got ${labels.Typography.y}`);
  assert.ok(labels.Design.x < -0.6, `expected Design left of the circle, got ${labels.Design.x}`);
  assert.ok(labels.Coding.x > 0.6, `expected Coding right of the circle, got ${labels.Coding.x}`);
  assert.equal(labels.Graphics.style.fill, "black");
  assert.ok(Math.abs(labels.Graphics.style.fontScale - 0.5) < 1e-6, `expected every label scale, got ${labels.Graphics.style.fontScale}`);
});

test("inherits path color into labels attached to inline path nodes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[red,dashed] (0,0) -- (1,1) node[circle,fill,inner sep=1pt,label=above:{$P$}]{};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "{$P$}");

  assert.deepEqual(diagnostics, []);
  assert.ok(label, "expected attached label text");
  assert.equal(label.style.fill, "red");
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

test("resolves braced polar coordinates in shift prefixes and calc offsets", () => {
  const source = String.raw`
\begin{tikzpicture}
  \coordinate (h) at (1,2);
  \node[circle,draw] (a) at ([shift=({0:2em})]h) {};
  \draw (h) -- ($(h) + ({90:2em})$);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "a");
  const path = ir.items.find((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.ok(Math.abs(box.x - 1.7) < 0.0001, `expected shifted node x=1.7, got ${box.x}`);
  assert.ok(Math.abs(box.y - 2) < 0.0001, `expected shifted node y=2, got ${box.y}`);
  assert.deepEqual(path.commands.at(-1), { type: "lineTo", x: 1, y: 2.7 });
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

test("accepts compact positioning syntax without whitespace before of", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, draw] (base) {};
  \node[circle, draw, above right=0.1em and 2emof base] (n) {};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.deepEqual(diagnostics, []);
  assert.ok(ir.coordinates.n.x > ir.coordinates.base.x + 0.7, `expected compact 2emof syntax to position right of base, got ${ir.coordinates.n.x}`);
  assert.ok(ir.coordinates.n.y > ir.coordinates.base.y, `expected compact 2emof syntax to position above base, got ${ir.coordinates.n.y}`);
});

test("uses compact empty node boxes for positioning library spacing", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (top) {};
  \node[below=1cm of top] (next) {};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const gap = Math.abs(ir.coordinates.top.y - ir.coordinates.next.y);

  assert.deepEqual(diagnostics, []);
  assert.ok(gap > 1.22 && gap < 1.27, `expected native-like empty node center gap near 1.24cm, got ${gap}`);
});

test("uses TeX-like mixed text metrics for drawn rectangle node positioning", () => {
  const source = String.raw`
\begin{tikzpicture}[node distance=1.5cm]
  \node[rectangle, very thick, draw] (learning) {Learning algorithm, $L$};
  \node[rectangle, very thick, draw, below=of learning] (inference) {Labelling function, $h$};
  \node[left=of learning] (train) {Training data, $\vec{s}$};
  \node[right=of inference] (lab) {Label, $y$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const boxes = Object.fromEntries(ir.items.filter((item) => item.type === "nodeBox").map((item) => [item.id, item]));

  assert.deepEqual(diagnostics, []);
  assert.ok(boxes.learning.width > 3.35, `expected Learning box to contain mixed text, got ${boxes.learning.width}`);
  assert.ok(boxes.inference.width > 3.3, `expected inference box to contain mixed text, got ${boxes.inference.width}`);
  assert.ok(ir.coordinates.train.x < -4.65, `expected wider left gap from Learning box, got ${ir.coordinates.train.x}`);
  assert.ok(ir.coordinates.lab.x > 4, `expected wider right gap from inference box, got ${ir.coordinates.lab.x}`);
});

test("uses TikZ text node boxes for positioning math label chains", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (X1) {$\vec{e}_{1}$};
  \node[rectangle,right=0.5em of X1] (x_dots_1) {$\dots$};
  \node[right=0.5em of x_dots_1] (Xj) {$\vec{e}_{j}$};
  \node[rectangle,right=1em of Xj] (x_dots_2) {$\dots$};
  \node[right=1em of x_dots_2] (Xn) {$\vec{e}_{n}$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.deepEqual(diagnostics, []);
  assert.ok(ir.coordinates.Xj.x > 1.45 && ir.coordinates.Xj.x < 1.7, `expected Xj near native TikZ placement, got ${ir.coordinates.Xj.x}`);
  assert.ok(ir.coordinates.Xn.x > 3.35 && ir.coordinates.Xn.x < 3.65, `expected Xn near native TikZ placement, got ${ir.coordinates.Xn.x}`);
});

test("keeps TikZ positioning shifts when an explicit at coordinate follows the options", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw] (ref) at (0,0) {A};
  \node[draw, above=1cm of ref] at (2,0) (top) {B};
  \node[draw, right=1cm of ref] at (0,-2) (side) {C};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.deepEqual(diagnostics, []);
  assert.equal(ir.coordinates.top.x, 2);
  assert.ok(ir.coordinates.top.y > 1.1, `expected above=... shift to raise explicit at coordinate, got ${ir.coordinates.top.y}`);
  assert.ok(ir.coordinates.side.x > 1.1, `expected right=... shift to move explicit at coordinate, got ${ir.coordinates.side.x}`);
  assert.equal(ir.coordinates.side.y, -2);
});

test("places nodes on named chains instead of leaving them at the origin", () => {
  const source = String.raw`
\begin{tikzpicture}[start chain=1 going right, start chain=2 going right]
  \node[state,on chain=1] (a) {$a$};
  \node[state,on chain=1] (b) {$b$};
  \node[on chain=1] (dots) {\dots};
  \node[state,on chain=2] (c) at (0,-2) {$c$};
  \node[state,on chain=2] (d) {$d$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.deepEqual(diagnostics, []);
  assert.ok(ir.coordinates.b.x > ir.coordinates.a.x + 1, `expected chain 1 to advance right, got ${JSON.stringify(ir.coordinates)}`);
  assert.ok(ir.coordinates.d.x > ir.coordinates.c.x + 1, `expected chain 2 to advance right, got ${JSON.stringify(ir.coordinates)}`);
  assert.equal(ir.coordinates.c.y, -2);
  assert.equal(ir.coordinates.d.y, -2);
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
  const pull = labels.find((label) => label.text === String.raw`\tt git pull`);
  const push = labels.find((label) => label.text === String.raw`\tt git push`);
  assert.ok(pull && push, "expected both git labels");
  assert.equal(pull.x, 3);
  assert.equal(push.x, 3);
  assert.ok(pull.y > 0.24 && pull.y < 0.32, `expected pull label above path, got ${pull.y}`);
  assert.ok(push.y < -0.24 && push.y > -0.32, `expected push label below path, got ${push.y}`);
  assert.ok(Math.abs(pull.y + push.y) < 1e-6, `expected labels to be symmetric around path, got ${pull.y}, ${push.y}`);
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

test("curves looseness-only to paths between anchors on the same node", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, draw, thick] (h1) {$\vec{h}_1$};
  \draw[-stealth] (h1.30) to[looseness=7] node[sloped, above] {$a$} (h1.105);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path" && item.style.markerEnd);
  const curve = path.commands.at(-1);
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "$a$");

  assert.deepEqual(diagnostics, []);
  assert.equal(curve.type, "curveTo");
  assert.ok(curve.y1 > path.commands[0].y, `expected first control point outside the node, got ${curve.y1}`);
  assert.ok(curve.y2 > curve.y, `expected second control point outside the target anchor, got ${curve.y2}`);
  assert.ok(label.y > curve.y, `expected sloped label to sit on the outer loop, got ${label.y}`);
  assert.ok(label.rotation !== undefined, "expected curved sloped label to carry a rotation");
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
  const drawCommands = arrow.commands.filter((command) => command.type === "lineTo" || command.type === "curveTo");

  assert.deepEqual(diagnostics, []);
  assert.ok(drawCommands.length > 8, `expected snake to create many smooth edge segments, got ${drawCommands.length}`);
  assert.ok(
    drawCommands.some(
      (command) =>
        Math.abs(command.y) > 0.05 ||
        (Number.isFinite(command.y1) && Math.abs(command.y1) > 0.05) ||
        (Number.isFinite(command.y2) && Math.abs(command.y2) > 0.05),
    ),
  );
});

test("applies snake decoration to ellipse outlines", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[ultra thick, decorate, decoration={snake, segment length=1mm, amplitude=0.3mm}] (0,0) ellipse (0.23 and 3.05);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const outline = ir.items.find((item) => item.type === "path");
  const drawCommands = outline.commands.filter((command) => command.type === "lineTo" || command.type === "curveTo");

  assert.deepEqual(diagnostics, []);
  assert.ok(drawCommands.length > 80, `expected decorated ellipse to become many snake segments, got ${drawCommands.length}`);
  assert.ok(
    drawCommands.some(
      (command) =>
        Math.abs(Math.abs(command.x) - 0.23) > 0.005 ||
        (Number.isFinite(command.x1) && Math.abs(Math.abs(command.x1) - 0.23) > 0.005) ||
        (Number.isFinite(command.x2) && Math.abs(Math.abs(command.x2) - 0.23) > 0.005),
    ),
  );
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

test("scales path circle radii with the TikZ coordinate transform", () => {
  const source = String.raw`
\begin{tikzpicture}[scale=0.85]
  \draw (0,0) circle (2.5cm);
  \draw[rotate=60] (0,0) -- (2.5,0) coordinate (B);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const circle = ir.items.find((item) => item.type === "path" && item.shape === "circle");
  const start = circle.commands.find((command) => command.type === "moveTo");
  const b = ir.coordinates.B;

  assert.deepEqual(diagnostics, []);
  assert.ok(Math.abs(start.x - 2.125) < 1e-6, `expected scaled circle radius 2.125, got ${start.x}`);
  assert.ok(Math.abs(Math.hypot(b.x, b.y) - 2.125) < 1e-6, `expected B to sit on the scaled circle, got ${JSON.stringify(b)}`);
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

test("scales TikZ grid step with picture coordinate scale", () => {
  const source = String.raw`
\begin{tikzpicture}[scale=3]
  \draw[step=1cm] (-1.2,0.2) grid (1.2,1.2);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const gridLines = ir.items.filter((item) => item.subtype === "grid-line");
  const verticals = gridLines.filter((item) => item.commands[0].x === item.commands[1].x);
  const horizontals = gridLines.filter((item) => item.commands[0].y === item.commands[1].y);

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(verticals.map((line) => line.commands[0].x), [-3, 0, 3]);
  assert.deepEqual(horizontals.map((line) => line.commands[0].y), [3]);
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

test("samples PGF plot expressions with radian trig suffixes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[samples=9,variable=\t] plot[domain=0:6.28318530718] ({cos(3*\t r)*cos(\t r)},{cos(3*\t r)*sin(\t r)});
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const plot = ir.items.find((item) => item.type === "path");
  const ys = plot.commands.map((command) => Math.abs(command.y || 0));

  assert.deepEqual(diagnostics, []);
  assert.equal(plot.commands.length, 9);
  assert.ok(Math.max(...ys) > 0.45, `expected radian polar plot to produce petals, got ${JSON.stringify(plot.commands)}`);
});

test("treats bare directional node offsets as TeX points", () => {
  const source = String.raw`
\begin{tikzpicture}
  \coordinate (A) at (0,0);
  \path (A) node[right=5] {pt};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "pt");

  assert.deepEqual(diagnostics, []);
  assert.ok(label.x > 0.1 && label.x < 0.7, `expected right=5 to be a small pt offset, got ${label.x}`);
});
