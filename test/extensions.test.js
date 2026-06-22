import assert from "node:assert/strict";
import test from "node:test";
import { parseTikz, interpretTikz, tikzBaguaExtension, tikzToSvg, tikzThreeDPlotExtension } from "../src/index.js";

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

test("treats circuitikz environments as TikZ picture aliases", () => {
  const source = String.raw`
\documentclass[border=4mm]{standalone}
\usepackage{circuitikz}
\begin{document}
\begin{circuitikz}[american]
  \draw (0,0) -- (2,0);
\end{circuitikz}
\end{document}`;

  const result = tikzToSvg(source);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ast.pictures.length, 1);
  assert.equal(result.ast.pictures[0].options.american, true);
  assert.equal(result.ir.items.some((item) => item.type === "path"), true);
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

test("treats PGFPlots \\empty tick lists as no ticks", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[axis lines=middle, xtick=\empty, ytick=\empty, xmin=0, xmax=1, ymin=0, ymax=1]
    \addplot {x};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ir.items.filter((item) => item.subtype === "axis-tick").length, 0);
  assert.equal(result.ir.items.filter((item) => item.type === "textNode" && item.text === "0").length, 0);
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

test("exposes tikz-3dplot as a built-in extension module", () => {
  assert.equal(tikzThreeDPlotExtension.name, "tikz-3dplot");
  assert.equal(tikzThreeDPlotExtension.phase, "preprocess");
  assert.ok(tikzThreeDPlotExtension.commands.includes("tdplotsetmaincoords"));
  assert.equal(typeof tikzThreeDPlotExtension.preprocess, "function");
});

test("exposes tikz-bagua as a built-in extension module", () => {
  assert.equal(tikzBaguaExtension.name, "tikz-bagua");
  assert.equal(tikzBaguaExtension.phase, "preprocess");
  assert.ok(tikzBaguaExtension.commands.includes("Bagua"));
  assert.equal(typeof tikzBaguaExtension.preprocess, "function");
});

test("expands tikz-bagua line symbols into ordinary TikZ strokes", () => {
  const source = String.raw`
\usepackage{tikz-bagua}
\begin{tikzpicture}
  \node at (0,0) {\liangyi{1}[1.5]};
  \node at (1,0) {\sixiang*{2}};
  \node at (2,0) {\bagua{101}};
  \node at (3,0) {\Bagua[8]{56}[1.2]};
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const baguaLines = result.ir.items.filter((item) => item.subtype === "bagua-line");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(baguaLines.length, 12);
  assert.equal(baguaLines.filter((item) => item.commands.length === 2).length > 0, true);
  assert.equal(baguaLines.filter((item) => item.commands.length === 4).length > 0, true);
});

test("centers tikz-bagua node symbols and emits visible TikZ line widths", () => {
  const source = String.raw`
\usepackage{tikz-bagua}
\begin{tikzpicture}
  \node at (0,1.55) {\bagua*{7}[1.4]};
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const baguaLines = result.ir.items.filter((item) => item.subtype === "bagua-line");
  const first = baguaLines[0];

  assert.deepEqual(result.diagnostics, []);
  assert.equal(baguaLines.length, 3);
  assert.ok(first.style.lineWidth > 2, `expected visible line width, got ${first.style.lineWidth}`);
  assert.ok(first.commands[0].x < 0, `expected line to start left of node center, got ${first.commands[0].x}`);
  assert.ok(first.commands[1].x > 0, `expected line to end right of node center, got ${first.commands[1].x}`);
  assert.match(result.svg, /stroke-linecap="butt"/);
});

test("keeps tikz-bagua stroke width independent from symbol scale", () => {
  const source = String.raw`
\usepackage{tikz-bagua}
\begin{tikzpicture}
  \node at (0,0) {\bagua*{7}[1.4]};
  \node at (1,0) {\Bagua[8]{56}[1.1]};
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const widths = result.ir.items.filter((item) => item.subtype === "bagua-line").map((item) => item.style.lineWidth);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(widths.length > 3);
  assert.equal(new Set(widths.map((width) => width.toFixed(6))).size, 1);
});

test("expands tikz-bagua taiji symbols into filled circular motifs", () => {
  const source = String.raw`
\usepackage{tikz-bagua}
\begin{tikzpicture}
  \node at (0,0) {\taiji*[2]};
  \node at (1,0) {\xtaiji*[2]};
\end{tikzpicture}`;

  const result = tikzToSvg(source);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ir.items.filter((item) => item.subtype === "bagua-taiji-outline").length, 2);
  assert.equal(result.ir.items.filter((item) => item.subtype === "bagua-taiji-eye").length, 4);
});

test("expands tikz-3dplot main coordinates into TikZ basis vectors", () => {
  const source = String.raw`
\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-3dplot}
\tdplotsetmaincoords{70}{110}
\begin{tikzpicture}[tdplot_main_coords]
  \draw[thick,->] (0,0,0) -- (1,0,0) node[anchor=north east]{$x$};
  \draw[thick,->] (0,0,0) -- (0,1,0) node[anchor=north west]{$y$};
  \draw[thick,->] (0,0,0) -- (0,0,1) node[anchor=south]{$z$};
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const axes = result.ir.items.filter((item) => item.type === "path" && item.style.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.abs(axes[0].commands.at(-1).x - -0.342) < 0.01);
  assert.ok(Math.abs(axes[0].commands.at(-1).y - -0.321) < 0.01);
  assert.ok(Math.abs(axes[2].commands.at(-1).y - 0.94) < 0.01);
});

test("supports tikz-3dplot rotated coordinates on picture options", () => {
  const source = String.raw`
\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-3dplot}
\tdplotsetmaincoords{60}{125}
\tdplotsetrotatedcoords{0}{0}{0}
\begin{tikzpicture}[scale=5,tdplot_rotated_coords]
  \draw (0,0,0) -- (1,0,0);
\end{tikzpicture}`;

  const result = tikzToSvg(source);

  assert.deepEqual(result.diagnostics, []);
  const path = result.ir.items.find((item) => item.type === "path");
  assert.ok(path);
  assert.equal(path.commands.at(-1).type, "lineTo");
});

test("expands tikz-3dplot spherical coordinate projection helpers", () => {
  const source = String.raw`
\usepackage{tikz-3dplot}
\tdplotsetmaincoords{60}{130}
\begin{tikzpicture}[tdplot_main_coords]
  \coordinate (O) at (0,0,0);
  \tdplotsetcoord{P}{.8}{55}{60}
  \draw[-stealth,color=red] (O) -- (P);
  \draw[dashed,color=red] (Pxy) -- (P);
\end{tikzpicture}`;

  const result = tikzToSvg(source);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.coordinates.P);
  assert.ok(result.ir.coordinates.Pxy);
  assert.notDeepEqual(result.ir.coordinates.P, result.ir.coordinates.Pxy);
  assert.equal(result.ir.items.filter((item) => item.type === "path").length, 2);
});

test("expands tikz-3dplot drawarc commands into ordinary paths and labels", () => {
  const source = String.raw`
\usepackage{tikz-3dplot}
\tdplotsetmaincoords{60}{110}
\begin{tikzpicture}[tdplot_main_coords]
  \coordinate (O) at (0,0,0);
  \tdplotdrawarc{(O)}{0.2}{0}{60}{anchor=north}{$\phi$}
\end{tikzpicture}`;

  const result = tikzToSvg(source);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.items.some((item) => item.type === "path" && item.shape === "arc"));
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "$\\phi$"));
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

test("evaluates PGFPlots exp expressions with exponent syntax", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[width=6cm,height=2cm,xmin=-3,xmax=3,ymin=0,ymax=1,domain=-3:3]
    \addplot[black, samples=5, mark=none] {exp(-x^2)};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const plot = result.ir.items.find((item) => item.subtype === "axis-plot");
  const ys = plot.commands.map((command) => Math.round(command.y * 1000) / 1000);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.max(...ys) > Math.min(...ys), `expected exp(-x^2) to produce a curve, got ${ys.join(",")}`);
  assert.ok(ys[2] > ys[0], `expected gaussian peak near x=0, got ${ys.join(",")}`);
});

test("evaluates PGFPlots gauss helper used by GMHMM gallery nodes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[width=4cm,height=3cm,xmin=-2,xmax=2,ymin=0,ymax=1,domain=-2:2]
    \addplot[fill=red!10, samples=5, mark=none] {gauss(0,0.5)} \closedcycle;
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const plot = result.ir.items.find((item) => item.subtype === "axis-plot");
  const ys = plot.commands.map((command) => Math.round(command.y * 1000) / 1000);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.max(...ys) > Math.min(...ys), `expected gauss(0,0.5) to produce a curve, got ${ys.join(",")}`);
  assert.ok(ys[2] > ys[0], `expected gaussian peak near x=0, got ${ys.join(",")}`);
});

test("applies PGFPlots axis scale to generated geometry", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[scale=0.25,xmin=-2,xmax=2,ymin=0,ymax=1,domain=-2:2]
    \addplot[black, samples=5, mark=none] {gauss(0,0.5)};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const plot = result.ir.items.find((item) => item.subtype === "axis-plot");
  const xs = plot.commands.map((command) => command.x);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.max(...xs) - Math.min(...xs) < 1.2, `expected scaled axis span near 1cm, got ${Math.max(...xs) - Math.min(...xs)}`);
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

test("evaluates PGFPlots max/min and tanh expressions used by activation glyphs", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[width=4cm,height=2cm,xmin=-2,xmax=2,ymin=-1,ymax=1,domain=-2:2,trig format=rad]
    \addplot expression [samples=7, mark=none] {max(0, min(1, x*0.6 + 0.5))};
    \addplot expression [samples=7, mark=none] {tanh(\x)};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const plots = result.ir.items.filter((item) => item.subtype === "axis-plot");
  const ySeries = plots.map((plot) => plot.commands.filter((command) => command.type !== "moveTo").map((command) => command.y));

  assert.deepEqual(result.diagnostics, []);
  assert.equal(plots.length, 2);
  for (const ys of ySeries) {
    const spread = Math.max(...ys) - Math.min(...ys);
    assert.ok(spread > 0.5, `expected activation curve to vary vertically, got ${ys.join(",")}`);
  }
});

test("clips PGFPlots function sampling to explicit axis bounds", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[width=4cm,height=2cm,xmin=-1,xmax=1,ymin=0,ymax=1,domain=-2:2]
    \addplot expression [samples=9, mark=none] {x*x};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const plot = result.ir.items.find((item) => item.subtype === "axis-plot");
  const xs = plot.commands.map((command) => command.x);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.min(...xs) >= -0.001, `expected plot to start inside axis, got ${xs.join(",")}`);
  assert.ok(Math.max(...xs) <= 4.001, `expected plot to end inside axis, got ${xs.join(",")}`);
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

test("uses PGFPlots middle-axis plot area inside declared width and height", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[width=11cm,height=3.5cm,xmin=0,xmax=11*pi,ymin=-0.5,ymax=7.5,axis lines=middle,xtick=\empty,ytick=\empty]
    \addplot coordinates {(0,0) (11*pi,7.5)};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const axisLines = result.ir.items.filter((item) => item.subtype === "axis-line");
  const xAxis = axisLines.find((item) => item.commands[0].y === item.commands[1].y);
  const yAxis = axisLines.find((item) => item.commands[0].x === item.commands[1].x);
  const xLength = Math.abs(xAxis.commands[1].x - xAxis.commands[0].x);
  const yLength = Math.abs(yAxis.commands[1].y - yAxis.commands[0].y);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.abs(xLength - 9.28) < 0.01, `expected native-like PGFPlots x-axis length, got ${xLength}`);
  assert.ok(Math.abs(yLength - 1.8) < 0.01, `expected native-like PGFPlots y-axis length, got ${yLength}`);
});

test("places PGFPlots middle-axis x tick labels next to the middle x-axis", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[width=4cm,height=4cm,xmin=0,xmax=4,ymin=-1,ymax=1,axis lines=middle,xtick={1},xticklabels={A}]
    \addplot coordinates {(0,0) (4,0)};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const label = result.ir.items.find((item) => item.type === "textNode" && item.text === "A");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(label, "expected generated tick label");
  assert.ok(label.y > 0.65 && label.y < 1.05, `expected x tick label below the middle axis, got y=${label.y}`);
});

test("renders PGFPlots ycomb function plots as vertical stems with marks", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[width=4cm,height=2cm,xmin=0,xmax=3,ymin=-1,ymax=1,axis lines=middle,domain=0:3]
    \addplot+[ycomb,mark=*,samples=4,black,thick] {x-1};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const stems = result.ir.items.filter((item) => item.subtype === "axis-comb");
  const marks = result.ir.items.filter((item) => item.subtype === "axis-mark");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(stems.length, 4);
  assert.equal(marks.length, 4);
  assert.ok(stems.every((stem) => stem.commands.length === 2 && stem.commands[0].x === stem.commands[1].x));
});

test("respects PGFPlots addplot versus addplot+ cycle color semantics for sampling plots", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[width=4cm,height=2cm,xmin=0,xmax=3,ymin=-1,ymax=1,axis lines=middle,domain=0:3]
    \addplot[no markers,thick] {x-1};
    \addplot+[ycomb,mark=*,samples=4,black,thick] {x-1};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const curve = result.ir.items.find((item) => item.subtype === "axis-plot");
  const stem = result.ir.items.find((item) => item.subtype === "axis-comb");
  const mark = result.ir.items.find((item) => item.subtype === "axis-mark");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(curve.style.stroke, "black");
  assert.equal(stem.style.stroke, "black");
  assert.equal(mark.style.stroke, "black");
  assert.equal(mark.style.fill, "rgb(204 0 0)");
});

test("uses PGFPlots native-ish smooth function plots and mark metrics", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[width=12.5cm,height=8cm,xmin=0,xmax=16,ymin=-1.1,ymax=1.5,axis lines=middle,domain=0:15]
    \addplot[no markers,samples=12,smooth,thick] {sin(2*180*x/13)};
    \addplot+[ycomb,mark=*,samples=4,black,thick] {sin(2*180*x/13)};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const curve = result.ir.items.find((item) => item.subtype === "axis-plot");
  const mark = result.ir.items.find((item) => item.subtype === "axis-mark");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(curve.commands.some((command) => command.type === "curveTo"), "expected smooth PGFPlots function to emit cubic segments");
  assert.ok(mark.r > 0.065 && mark.r < 0.073, `expected default mark size near 2pt, got ${mark.r}`);
  assert.equal(mark.style.lineWidth, curve.style.lineWidth);
});

test("respects explicit PGFPlots middle-axis at offsets without extra stack shifting", () => {
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
  assert.deepEqual(
    yAxes.map((axis) => ({ min: Number(axis.min.toFixed(3)), max: Number(axis.max.toFixed(3)) })),
    [
      { min: 0, max: 1 },
      { min: -1.5, max: -0.5 },
      { min: -3, max: -2 }
    ]
  );
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
