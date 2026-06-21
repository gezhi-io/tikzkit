import assert from "node:assert/strict";
import test from "node:test";
import { parseTikz, interpretTikz, tikzToSvg } from "../src/index.js";

test("allows user-supplied preprocess extensions", () => {
  const source = String.raw`
\begin{tikzpicture}
  \MyDot{A}{1}{2}
\end{tikzpicture}`;
  const myExtension = {
    name: "my-dot",
    preprocess(input) {
      return input.replace(/\\MyDot\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}/g, String.raw`\node[circle, draw] ($1) at ($2,$3) {$1};`);
    }
  };

  const { ir, diagnostics } = tikzToSvg(source, { extensions: [myExtension] });

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(ir.coordinates.A, { x: 1, y: 2 });
  assert.ok(ir.items.some((item) => item.type === "nodeBox" && item.id === "A"));
});

test("renders common PGFPlots axis addplot coordinates, functions, and legends", () => {
  const source = String.raw`
\documentclass[tikz,border=10pt]{standalone}
\usepackage{pgfplots}
\begin{document}
\begin{tikzpicture}
  \begin{axis}[axis lines=center, grid, domain=-2:2, legend entries={$x^2$, $x^3-x$}]
    \addplot[only marks, red] coordinates { (-1,1) (0,0) (1,1) };
    \addplot[blue, samples=9, mark=none] {x^3 - x};
  \end{axis}
\end{tikzpicture}
\end{document}`;

  const result = tikzToSvg(source);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ir.items.filter((item) => item.subtype === "axis-line").length, 2);
  assert.equal(result.ir.items.filter((item) => item.subtype === "axis-grid-line").length > 0, true);
  assert.equal(result.ir.items.filter((item) => item.subtype === "axis-mark").length, 3);
  assert.equal(result.ir.items.some((item) => item.subtype === "axis-plot"), true);
  assert.equal(result.ir.items.filter((item) => item.type === "textNode" && /\$x/.test(item.text)).length, 2);
});

test("projects common TikZ 3D coordinates using x/y/z picture basis vectors", () => {
  const source = String.raw`
\begin{tikzpicture}[y={(-0.86cm,0.5cm)},x={(0.86cm,0.5cm)}, z={(0cm,1cm)}]
  \draw[very thick, blue] (-2,-2,0) -- (-2,2,0) -- (2,2,0) -- (2,-2,0) -- cycle;
  \draw[->] (0,0,0) -- (0,0,2.5) node[above] {z};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.deepEqual(diagnostics, []);
  const blue = ir.items.find((item) => item.type === "path" && item.style.stroke === "blue");
  assert.deepEqual(blue.commands[0], { type: "moveTo", x: 0, y: -2 });
  assert.deepEqual(blue.commands[1], { type: "lineTo", x: -3.44, y: 0 });
  const zAxis = ir.items.find((item) => item.style.markerEnd?.kind === "to");
  assert.deepEqual(zAxis.commands.at(-1), { type: "lineTo", x: 0, y: 2.5 });
});

test("expands common TeX-lite def and newcommand macros before TikZ parsing", () => {
  const source = String.raw`
\def\R{0.3}
\def\pair#1#2{(#1,#2)}
\newcommand{\dotat}[2]{\fill \pair{#1}{#2} circle(\R);}
\newcommand{\segment}[4]{\draw[red, thick] (#1,#2) -- (#3,#4);}
\begin{tikzpicture}
  \dotat{0}{0}
  \dotat{1}{1}
  \segment{0}{0}{1}{1}
\end{tikzpicture}`;

  const result = tikzToSvg(source);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ir.items.filter((item) => item.shape === "circle").length, 2);
  assert.equal(result.ir.items.some((item) => item.type === "path" && item.style.stroke === "red"), true);
});

test("supports common PGFPlots addplot+ labels and addlegendentry", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[axis lines=left, grid=major, xlabel={$x$}, ylabel={$y$}, title={Curve}]
    \addplot+[green, mark=none, domain=0:2, samples=5] {x^2};
    \addlegendentry{$x^2$}
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ir.items.some((item) => item.subtype === "axis-plot" && item.style.stroke === "green"), true);
  assert.equal(result.ir.items.filter((item) => item.type === "textNode" && ["$x$", "$y$", "Curve", "$x^2$"].includes(item.text)).length, 4);
});

test("maps PGFPlots data coordinates into axis width, height, and at position", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[width=4cm,height=2cm,xmin=0,xmax=10,ymin=0,ymax=10,at={(1cm,-2cm)}]
    \addplot[blue, mark=none] coordinates {(0,0) (10,10)};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const plot = result.ir.items.find((item) => item.subtype === "axis-plot");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(plot.commands, [
    { type: "moveTo", x: 1, y: -2 },
    { type: "lineTo", x: 5, y: 0 }
  ]);
});

test("evaluates PGFPlots trig format rad before sampling function plots", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[width=6cm,height=2cm,xmin=0,xmax=2*pi,ymin=-1,ymax=1,domain=0:2*pi,trig format=rad]
    \addplot[blue, samples=5, mark=none] {sin(x)};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const plot = result.ir.items.find((item) => item.subtype === "axis-plot");
  const ys = plot.commands.map((command) => Math.round(command.y * 1000) / 1000);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(ys, [1, 2, 1, 0, 1]);
});

test("supports PGFPlots addplot expression keyword before plot options", () => {
  const source = String.raw`
\definecolor{olivegreen}{rgb}{0,0.6,0}
\begin{tikzpicture}
  \begin{axis}[width=6cm,height=2cm,xmin=0,xmax=1,ymin=-1,ymax=1,domain=0:1,trig format=rad]
    \addplot expression [no markers, olivegreen, samples=5] {sin(6*pi*x)};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const plot = result.ir.items.find((item) => item.subtype === "axis-plot");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(plot, "expected addplot expression to generate an axis plot");
  assert.equal(plot.style.stroke, "rgb(0 153 0)");
  assert.equal(plot.commands.length, 5);
});

test("uses arrowed middle axis lines for PGFPlots middle axes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[axis lines=middle,xmin=0,xmax=1,ymin=0,ymax=1]
    \addplot coordinates {(0,0) (1,1)};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const axisLines = result.ir.items.filter((item) => item.subtype === "axis-line");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(axisLines.length, 2);
  assert.equal(axisLines.every((item) => item.style.markerEnd?.kind === "to"), true);
});

test("keeps stacked PGFPlots middle axes separated when using at offsets", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[width=4cm,height=2cm,xmin=0,xmax=1,ymin=-1,ymax=1,axis lines=middle]
    \addplot coordinates {(0,0) (1,1)};
  \end{axis}
  \begin{axis}[at={(0,-1.5cm)},width=4cm,height=2cm,xmin=0,xmax=1,ymin=-1,ymax=1,axis lines=middle]
    \addplot coordinates {(0,0) (1,-1)};
  \end{axis}
  \begin{axis}[at={(0,-3cm)},width=4cm,height=2cm,xmin=0,xmax=1,ymin=-1,ymax=1,axis lines=middle]
    \addplot coordinates {(0,1) (1,0)};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const yAxes = result.ir.items
    .filter((item) => item.subtype === "axis-line")
    .filter((item) => item.commands[0].x === item.commands[1].x)
    .map((item) => {
      const ys = item.commands.map((command) => command.y);
      return { min: Math.min(...ys), max: Math.max(...ys) };
    });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(yAxes.length, 3);
  for (let index = 1; index < yAxes.length; index += 1) {
    assert.ok(
      yAxes[index].max < yAxes[index - 1].min - 0.2,
      `expected separated y axes, got ${JSON.stringify(yAxes)}`
    );
  }
});

test("keeps generated PGFPlots axis label text available for TeX font macro handling", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[axis lines=middle,xlabel={\large $t$},ylabel={\textcolor{blue}{carrier wave}}]
    \addplot coordinates {(0,0) (1,1)};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const labels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(labels.includes(String.raw`\large $t$`));
  assert.ok(labels.includes(String.raw`\textcolor{blue}{carrier wave}`));
});

test("adds invisible PGFPlots axis container bounds around plotted content", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[width=4cm,height=2cm,xmin=0,xmax=1,ymin=0,ymax=1,axis lines=middle]
    \addplot coordinates {(0,0) (1,1)};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const frame = result.ir.items.find((item) => item.subtype === "axis-frame");
  const axisLines = result.ir.items.filter((item) => item.subtype === "axis-line");
  const frameXs = frame.commands.filter((command) => "x" in command).map((command) => command.x);
  const frameYs = frame.commands.filter((command) => "y" in command).map((command) => command.y);
  const axisXs = axisLines.flatMap((item) => item.commands.map((command) => command.x));
  const axisYs = axisLines.flatMap((item) => item.commands.map((command) => command.y));

  assert.deepEqual(result.diagnostics, []);
  assert.ok(frame);
  assert.ok(Math.min(...frameXs) < Math.min(...axisXs));
  assert.ok(Math.max(...frameXs) > Math.max(...axisXs));
  assert.ok(Math.min(...frameYs) < Math.min(...axisYs));
  assert.ok(Math.max(...frameYs) > Math.max(...axisYs));
});

test("expands newcommand optional default arguments", () => {
  const source = String.raw`
\newcommand{\ray}[2][red]{\draw[#1] (0,0) -- (#2,#2);}
\begin{tikzpicture}
  \ray{1}
  \ray[blue]{2}
\end{tikzpicture}`;

  const result = tikzToSvg(source);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ir.items.some((item) => item.type === "path" && item.style.stroke === "red"), true);
  assert.equal(result.ir.items.some((item) => item.type === "path" && item.style.stroke === "blue"), true);
});

test("supports scope environments and common relative coordinates", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{scope}[shift={(1,1)}, scale=2]
    \draw (0,0) -- ++(1,0) -- +(0,1);
  \end{scope}
\end{tikzpicture}`;

  const result = tikzToSvg(source);

  assert.deepEqual(result.diagnostics, []);
  const path = result.ir.items.find((item) => item.type === "path");
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 1, y: 1 },
    { type: "lineTo", x: 3, y: 1 },
    { type: "lineTo", x: 3, y: 3 }
  ]);
});
