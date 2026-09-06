import assert from "node:assert/strict";
import test from "node:test";
import { parseTikz, interpretTikz, tikzToSvg } from "../src/index.js";
import { tikzBaguaExtension, tikzThreeDPlotExtension } from "../src/internal.js";
import { parseDimension } from "../src/math.js";
import { preprocessTikzSource } from "../src/preprocess.js";
import { lineWidthFromPt } from "../src/tikz-metrics.js";

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

test("keeps circuitikz labels on the surrounding TikZ font contract", () => {
  const source = String.raw`
\usepackage{circuitikz}
\begin{tikzpicture}[font=\large]
  \draw (0,0) to[R={$R$}] (2,0);
\end{tikzpicture}`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const label = result.ir.items.find((item) => item.type === "textNode" && item.text === "$R$");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(label?.font?.sizePt, 12);
  assert.equal(label?.font?.baselineSkipPt, 14);
  assert.equal(label?.font?.source, "scope");
});

test("expands custom timeline Task environments into drawable TikZ", () => {
  const source = String.raw`
\documentclass[tikz]{standalone}
\usepackage{tikz}
\definecolor{arrowcolor}{RGB}{201,216,232}
\definecolor{circlecolor}{RGB}{79,129,189}
\colorlet{textcolor}{white}
\colorlet{bordercolor}{white}
\newlength\taskwidth
\newlength\taskvsep
\setlength\taskwidth{2.5cm}
\setlength\taskvsep{17pt}
\newenvironment{timeline}[1][node distance=.75\taskwidth]
  {\begin{tikzpicture}[start chain,#1]}
  {\end{tikzpicture}}
\begin{document}
\begin{timeline}
  \Task{Alpha\\One}
  \Task[B]{Beta}
\end{timeline}
\end{document}`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path");
  const boxes = result.ir.items.filter((item) => item.type === "nodeBox");
  const texts = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(paths.some((item) => item.style.fill === "rgb(201 216 232)"), "expected timeline arrow fill");
  assert.ok(boxes.some((item) => item.shape === "circle" && item.style.fill === "rgb(79 129 189)"), "expected timeline circle node");
  assert.ok(texts.some((text) => text.includes("Alpha")), "expected expanded task text");
  assert.ok(texts.includes("B"), "expected optional task label");
});

test("expands chronology package timelines from beamer frames", () => {
  const source = String.raw`
\documentclass[10pt]{beamer}
\usetheme[progressbar=frametitle]{metropolis}
\usepackage{appendixnumberbeamer}
\usepackage{chronology}
\begin{document}
\begin{frame}{Timeline}
\begin{chronology}[50]{1800}{2020}{.9\linewidth}{1ex}
  \event{\decimaldate{}{}{1812}}{\small Beginnings of Gerrymandering}
  \event[\decimaldate{}{}{1960}]{\decimaldate{}{}{2020}}{}
\end{chronology}
\par
\begin{chronology}[10]{1960}{2020}{.9\linewidth}{1ex}
  \event{\decimaldate{26}{3}{1962}}{\small Baker v. Carr}
  \event{\decimaldate{}{}{2018}}{\small Gill v. Whitford}
\end{chronology}
\end{frame}
\end{document}`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const texts = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ast.pictures.length, 1);
  assert.ok(paths.length > 6, "expected generated timeline paths");
  assert.ok(texts.includes("Timeline"), "expected beamer frame title");
  assert.ok(texts.includes("1800"), "expected first chronology tick label");
  assert.ok(texts.some((text) => text.includes("Baker")), "expected event label");
  assert.ok(texts.some((text) => text.includes("Gill")), "expected second chronology event label");
});

test("expands event-period timeline set-command macros into named month coordinates", () => {
  const source = String.raw`
\PassOptionsToPackage{table,dvipsnames,svgnames}{xcolor}
\documentclass[tikz,margin=1cm]{standalone}
\usetikzlibrary{arrows.meta,calc,positioning}
\colorlet{A}{gray}
\colorlet{B}{lightgray}
\tikzset{
  period/.style={solid,line width=\timelinewidth,line cap=square},
  eventline/.style={draw,red,thick,line cap=round,line join=round},
  eventboxa/.style={rectangle,text width=#1,draw=A,fill=none}
}
\newcommand*{\drawtimeline}[5][]{\def\fromyear{#2}}
\newcommand{\period}[5]{}
\newcommand{\vevent}[7]{}
\begin{document}
\begin{tikzpicture}
  \drawtimeline[minor tick step=0.083333]{2017}{2019}{50cm}{2cm};
  \period{A}{2017-0}{2017-2}{2017\\J-F}{}
  \period{B}{2017-2}{2017-4}{M-A}{}
  \vevent{A}{2017-0}{90:2.5cm}{45:0.5cm}{eventboxa=5cm,anchor=west}{H}{Start of ZoW consortium\\10 Jan}
  \node[draw=none,rectangle,fill=cyan,text width=10cm,minimum height=1cm,text=black,align=center,font=\Large] (AA) at ([yshift=-5cm]Y-2018-5) {Internship};
\end{tikzpicture}
\end{document}`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const texts = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.coordinates["Y-2017-0"], "expected generated first month coordinate");
  assert.ok(result.ir.coordinates["Y-2018-5"], "expected generated referenced month coordinate");
  assert.ok(texts.some((text) => text.includes("2017")), "expected period year label");
  assert.ok(texts.some((text) => text.includes("Start of ZoW")), "expected event label");
  assert.ok(texts.includes("Internship"), "expected downstream node using generated coordinate");
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

test("uses coordinate data range instead of default function domain for coordinate-only axes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[scale only axis,width=5cm,height=3cm,ticks=none]
    \addplot[mark=none] coordinates {(-1.570796,-1) (4,-0.756802)};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plot = result.ir.items.find((item) => item.subtype === "axis-plot");
  const drawnSpan = plot.commands.at(-1).x - plot.commands[0].x;

  assert.deepEqual(result.diagnostics, []);
  assert.ok(drawnSpan > 4, `expected coordinate-only plot to use most of the 5cm axis width, got span ${drawnSpan}`);
});

test("renders PGFPlots default ticks and \\legend command entries", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[domain=0:2.7,xlabel=$x$,smooth,thick,axis lines=center,legend pos=north west]
    \addplot[color=blue]{x*ln(x)};
    \addplot[color=red]{x-1};
    \legend{$x \, \ln(x)$,$x-1$}
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const texts = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.items.filter((item) => item.subtype === "axis-tick").length >= 8);
  assert.equal(texts.includes("3"), false);
  assert.ok(texts.includes(String.raw`$x \, \ln(x)$`));
  assert.ok(texts.includes("$x-1$"));
});

test("samples PGFPlots removable endpoint singularities such as -x*ln(x)", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[domain=0:1,smooth,thick,axis lines=left]
    \addplot[color=blue]{x};
    \addplot[color=red]{-x*ln(x)};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const blue = result.ir.items.find((item) => item.subtype === "axis-plot" && item.style.stroke === "blue");
  const red = result.ir.items.find((item) => item.subtype === "axis-plot" && item.style.stroke === "red");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(blue, "expected blue y=x plot");
  assert.ok(red, "expected red -x*ln(x) plot");
  assert.equal(red.commands.length, blue.commands.length);
  assert.ok(Math.abs(red.commands[0].x - blue.commands[0].x) < 1e-9);
  assert.ok(Math.abs(red.commands[0].y - blue.commands[0].y) < 1e-9);
});

test("clips PGFPlots auto ticks to explicit ymax and applies tiny legend font", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[domain=0:1.1,ymax=2.8,axis lines=center,legend style={font=\tiny}]
    \addplot[color=blue,samples=75]{sqrt(3)*(1/x - 1)^(1/2)};
    \addplot[color=red]{sqrt(3)*(x/1)^(3/2)};
    \legend{$a$,$b$}
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const textNodes = result.ir.items.filter((item) => item.type === "textNode");
  const labels = textNodes.map((item) => item.text);
  const legendNode = textNodes.find((item) => item.text === "$a$");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(labels.includes("3"), false);
  assert.ok(legendNode, "expected legend text node");
  assert.ok(legendNode.style.fontScale < 0.7, `expected tiny legend font, got ${legendNode.style.fontScale}`);
});

test("does not render PGFPlots axis lines when axis lines is none", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[width=2cm,height=1cm,axis lines=none,xtick=\empty,ytick=\empty,domain=0:1]
    \addplot[blue,samples=3] {x};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ir.items.filter((item) => item.subtype === "axis-line").length, 0);
  assert.equal(result.ir.items.filter((item) => item.subtype === "axis-plot").length, 1);
});

test("expands datavisualization function data into pgfplots-compatible lines, scatter, pin, and legend", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [scientific axes=clean]
[
  visualize as smooth line=Gaussian,
  Gaussian={pin in data={text={$e^{-x^2}$},when=x is 1}}
]
data [format=function] {
  var x : interval [-7:7] samples 51;
  func y = exp(-\value x*\value x);
}
[
  visualize as scatter,
  legend={south east outside},
  scatter={
    style={mark=*,mark size=1.4pt},
    label in legend={text={
        $\sum_{i=1}^{10} x_i$, where $x_i \sim U(-1,1) $}}}
]
data [format=function] {
  var i : interval [0:1] samples 20;
  func y = 0;
  func x = (rand + rand + rand + rand + rand +
rand + rand + rand + rand + rand);
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plots = result.ir.items.filter((item) => item.subtype === "axis-plot");
  const marks = result.ir.items.filter((item) => item.subtype === "axis-mark" || item.shape === "plot-mark");
  const legendExample = result.ir.items.find((item) => item.subtype === "axis-legend-example");
  const sumLegend = result.ir.items.find((item) => item.type === "textNode" && item.text.includes(String.raw`\sum`));
  const cleanAxes = result.ir.items.filter((item) => item.subtype === "axis-clean-line");
  const cleanBoundaries = result.ir.items.filter((item) => item.subtype === "axis-clean-boundary");
  const pinEdge = result.ir.items.find((item) => item.subtype === "axis-pin-edge");
  const pinLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === String.raw`$e^{-x^2}$`);
  const [pinFrom, pinTo] = pinEdge?.commands || [];
  const pinLength = Math.hypot((pinTo?.x || 0) - (pinFrom?.x || 0), (pinTo?.y || 0) - (pinFrom?.y || 0));
  const texts = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  const legendXs = legendExample?.commands.filter((command) => "x" in command).map((command) => command.x) || [];
  const legendYs = legendExample?.commands.filter((command) => "y" in command).map((command) => command.y) || [];
  const legendX = legendXs.length ? (Math.min(...legendXs) + Math.max(...legendXs)) / 2 : NaN;
  const legendY = legendYs.length ? (Math.min(...legendYs) + Math.max(...legendYs)) / 2 : NaN;

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ast.libraries.find((library) => library.name === "datavisualization.formats.functions")?.status, "partial");
  assert.equal(plots.length, 1);
  assert.equal(marks.length, 20);
  assert.ok(legendExample, "expected an outside scatter legend example");
  assert.ok(sumLegend, "expected an outside scatter legend label");
  assert.ok(legendX < 5.7, `expected explicit south east outside legend marker near native x position, got x=${legendX}`);
  assert.ok(legendY < 0.35, `expected explicit south east outside legend near the lower axis edge, got y=${legendY}`);
  assert.ok(sumLegend.y < 0.35, `expected explicit south east outside legend label near the lower axis edge, got y=${sumLegend.y}`);
  assert.ok(sumLegend.x > 7.45 && sumLegend.x < 7.75, `expected explicit outside legend text center near native position, got x=${sumLegend.x}`);
  assert.equal(cleanAxes.length, 2, "expected scientific axes=clean to render offset left/bottom axes");
  assert.equal(cleanBoundaries.length, 4, "expected scientific axes=clean to render light min/max boundaries");
  assert.ok(Math.abs((pinFrom?.x || 0) - 2.9) < 0.03, `expected Gaussian pin edge to start at the first sample after x=1, got x=${pinFrom?.x}`);
  assert.ok(Math.abs((pinFrom?.y || 0) - 0.881) < 0.03, `expected Gaussian pin edge to start at exp(-1.12^2), got y=${pinFrom?.y}`);
  assert.ok(pinLength > 0.42 && pinLength < 0.58, `expected steep Gaussian pin edge to stay near native length, got ${pinLength}`);
  assert.ok(Math.abs((pinTo?.x || 0) - 3.347) < 0.03, `expected Gaussian pin edge to meet the west label border, got x=${pinTo?.x}`);
  assert.ok(Math.abs((pinTo?.y || 0) - 1.051) < 0.035, `expected Gaussian pin edge to follow the native auto-label angle, got y=${pinTo?.y}`);
  assert.ok(pinLabel?.x > 3.7 && pinLabel.x < 3.85, `expected Gaussian pin text center to include TeX node width and padding, got x=${pinLabel?.x}`);
  assert.ok(pinLabel?.y > 1.12 && pinLabel.y < 1.3, `expected Gaussian pin text center above its clipped leader edge, got y=${pinLabel?.y}`);
  assert.ok(cleanAxes.every((axis) => axis.style.stroke === "rgb(128 128 128)"));
  assert.ok(cleanBoundaries.every((axis) => axis.style.stroke === "rgb(191 191 191)"));
  assert.ok(cleanBoundaries.every((axis) => axis.style.lineCap === "square"), "expected native clean boundaries to use rect line caps");
  assert.ok(texts.includes(String.raw`$e^{-x^2}$`), "expected pin label");
  assert.ok(
    texts.includes(String.raw`$\sum_{i=1}^{10} x_i$, where $x_i \sim U{(}-1,1{)} $`),
    "expected scatter legend label"
  );
});

test("supports datavisualization function step, group variables, Cartesian product, pin edge, and legend example", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [scientific axes=clean]
[
  visualize as smooth line=curve,
  curve={pin in data={text={$p$},when=x is 0.5}}
]
data [format=function] {
  var x : interval [0:1] step 0.5;
  func y = \value x;
}
[
  visualize as scatter,
  legend={south east outside},
  scatter={style={mark=*,mark size=1pt},label in legend={text={$S$}}}
]
data [format=function] {
  var x : interval [0:1] step 0.5;
  var y : {1,2};
  func x = \value x;
  func y = \value y;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plots = result.ir.items.filter((item) => item.subtype === "axis-plot");
  const marks = result.ir.items.filter((item) => item.subtype === "axis-mark" || item.shape === "plot-mark");
  const legendExamples = result.ir.items.filter((item) => item.subtype === "axis-legend-example");
  const pinEdges = result.ir.items.filter((item) => item.subtype === "axis-pin-edge");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(plots.length, 1);
  assert.equal(plots[0].commands.length, 3);
  assert.equal(marks.length, 6);
  assert.ok(pinEdges.length >= 1, "expected a pin leader edge");
  assert.ok(legendExamples.length >= 1, "expected a rendered legend visualizer example");
});

test("uses native datavisualization default line visualizer stroke width", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as smooth line=curve,
  curve={label in legend={text=curve}},
  legend={south east outside},
  data/format=function]
data {
  var x : interval [0:1] samples 3;
  func y = \value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plot = result.ir.items.find((item) => item.subtype === "axis-plot");
  const legendExample = result.ir.items.find((item) => item.subtype === "axis-legend-example");
  const nativeLineWidth = parseDimension("0.6pt", {}) * 100;

  assert.deepEqual(result.diagnostics, []);
  assert.ok(plot, "expected datavisualization line plot");
  assert.ok(legendExample, "expected datavisualization line legend example");
  assert.ok(Math.abs(plot.style.lineWidth - nativeLineWidth) < 0.01, `expected native 0.6pt plot stroke, got ${plot.style.lineWidth}`);
  assert.ok(
    Math.abs(legendExample.style.lineWidth - nativeLineWidth) < 0.01,
    `expected native 0.6pt legend stroke, got ${legendExample.style.lineWidth}`
  );
});

test("supports datavisualization sparklines as compact tickless line plots", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.sparklines}
\tikz \datavisualization
 [spark line]
data {
  x, y
  0, 0
  1, 1
  2, .2
  3, .8
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plot = result.ir.items.find((item) => item.subtype === "axis-plot");
  const axisTicks = result.ir.items.filter((item) => item.type === "textNode" && /^-?\d/.test(item.text));
  const pointCommands = plot?.commands.filter((command) => Number.isFinite(command.x) && Number.isFinite(command.y)) || [];
  const xSpan = pointCommands.at(-1)?.x - pointCommands[0]?.x;
  const yValues = pointCommands.map((command) => command.y);
  const ySpan = Math.max(...yValues) - Math.min(...yValues);
  const nativeSparkLineWidth = parseDimension("0.4pt", {}) * 100;

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ast.libraries.find((library) => library.name === "datavisualization.sparklines")?.status, "partial");
  assert.ok(plot, "expected spark line plot");
  assert.equal(pointCommands.length, 4);
  assert.equal(plot.commands.some((command) => command.type === "curveTo"), false, "expected sparkline to use straight line segments");
  assert.ok(xSpan > 0.1 && xSpan < 0.11, `expected sparkline x axis to use 1pt per unit, got span ${xSpan}`);
  assert.ok(ySpan > 0.32 && ySpan < 0.36, `expected sparkline y axis to fit the native 1em vertical band, got span ${ySpan}`);
  assert.ok(Math.abs(plot.style.lineWidth - nativeSparkLineWidth) < 0.01, `expected native 0.4pt sparkline stroke, got ${plot.style.lineWidth}`);
  assert.equal(plot.style.lineCap, "round");
  assert.equal(plot.style.lineJoin, "round");
  assert.equal(axisTicks.length, 0, "expected sparkline to suppress tick labels");
});

test("supports datavisualization closed line visualizers", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as smooth line=polygon,
  polygon={straight cycle,style={blue},label in legend={text=polygon}},
  data/format=function]
data [set=polygon] {
  var t : interval [0:2*pi] samples 9;
  func x = cos(\value t r);
  func y = sin(\value t r);
}
[
  visualize as smooth cycle=loop,
  loop={style={red},label in legend={text=loop}}]
data [set=loop, format=function] {
  var t : interval [0:2*pi] samples 17;
  func x = 0.72*cos(\value t r);
  func y = 0.72*sin(\value t r);
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plots = result.ir.items.filter((item) => item.subtype === "axis-plot");
  const polygon = plots.find((item) => item.style.stroke === "blue");
  const loop = plots.find((item) => item.style.stroke === "red");
  const legendExamples = result.ir.items.filter((item) => item.subtype === "axis-legend-example");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(polygon, "expected straight cycle visualizer plot");
  assert.ok(loop, "expected smooth cycle visualizer plot");
  assert.equal(polygon.commands.at(-1)?.type, "closePath", "expected straight cycle to close the polygon outline");
  assert.equal(loop.commands.at(-1)?.type, "closePath", "expected smooth cycle to close the curve outline");
  assert.ok(loop.commands.some((command) => command.type === "curveTo"), "expected smooth cycle to use cubic smoothing");
  assert.equal(legendExamples.length, 2, "expected a legend example for each closed visualizer");
  assert.ok(
    legendExamples.every((item) => item.commands.at(-1)?.type === "closePath"),
    "expected closed visualizers to use closed legend examples"
  );
});

test("supports datavisualization gap line handlers by shortening each segment", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as smooth line=my data,
  my data={gap line},
  data/format=function]
data {
  var x : interval [0:2] samples 3;
  func y = \value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plot = result.ir.items.find((item) => item.subtype === "axis-plot");
  const moveCount = (plot?.commands || []).filter((command) => command.type === "moveTo").length;

  assert.deepEqual(result.diagnostics, []);
  assert.ok(plot, "expected gap line visualizer plot");
  assert.equal(moveCount, 2, "expected each gapped segment to start a new subpath");
  assert.ok(plot.commands[0].x > 0, `expected first gapped segment to start after first data point, got x=${plot.commands[0].x}`);
  assert.ok(plot.commands[1].x < plot.commands[2].x, "expected a visible gap around the middle data point");
});

test("supports datavisualization gap cycle handlers without closing through points", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as smooth line=my data,
  my data={gap cycle},
  data/format=function]
data {
  var t : interval [0:4] samples 5;
  func x = cos(\value t r);
  func y = sin(\value t r);
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plot = result.ir.items.find((item) => item.subtype === "axis-plot");
  const moveCount = (plot?.commands || []).filter((command) => command.type === "moveTo").length;

  assert.deepEqual(result.diagnostics, []);
  assert.ok(plot, "expected gap cycle visualizer plot");
  assert.equal(moveCount, 5, "expected one shortened subpath for each cycle edge");
  assert.notEqual(plot.commands.at(-1)?.type, "closePath", "expected gap cycle to connect with a shortened segment, not closePath");
});

test("uses native-like half-step ticks for datavisualization ticks=few over unit ranges", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  all axes={ticks=few},
  visualize as smooth line=polygon,
  polygon={straight cycle,style={blue},label in legend={text=polygon}},
  data/format=function]
data [set=polygon] {
  var t : interval [0:2*pi] samples 9;
  func x = cos(\value t r);
  func y = sin(\value t r);
}
[
  visualize as smooth cycle=loop,
  loop={style={red},label in legend={text=loop}}]
data [set=loop, format=function] {
  var t : interval [0:2*pi] samples 17;
  func x = 0.72*cos(\value t r);
  func y = 0.72*sin(\value t r);
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const texts = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(texts.includes("−1"), `expected native few ticks to include −1, got ${texts.join(", ")}`);
  assert.ok(texts.includes("−0.5"), `expected native few ticks to include −0.5, got ${texts.join(", ")}`);
  assert.ok(texts.includes("0.5"), `expected native few ticks to include 0.5, got ${texts.join(", ")}`);
  assert.ok(texts.includes("1"), `expected native few ticks to include 1, got ${texts.join(", ")}`);
});

test("supports scientific polar axes with function-format angle and radius data", () => {
  const source = String.raw`
\usetikzlibrary { datavisualization.formats.functions, datavisualization.polar }
\tikz \datavisualization [
  scientific polar axes={0 to pi, clean},
  all axes=grid,
  style sheet=vary hue,
  legend=below
  ]
  [visualize as smooth line=sin,
   sin={label in legend={text=$1+\sin \alpha$}}]
  data [format=function] {
    var  angle : interval [0:pi] samples 13;
    func radius = sin(\value{angle}r) + 1;
  }
  [visualize as smooth line=cos,
   cos={label in legend={text=$1+\cos\alpha$}}]
  data [format=function] {
    var  angle : interval [0:pi] samples 13;
    func radius = cos(\value{angle}r) + 1;
  };`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plots = result.ir.items.filter((item) => item.subtype === "axis-plot");
  const gridItems = result.ir.items.filter((item) => item.subtype === "axis-grid-line");
  const outerBoundary = result.ir.items.find((item) => item.subtype === "axis-clean-boundary" && item.shape === "arc");
  const maxRadiusGridArc = gridItems.find(
    (item) => item.shape === "arc" && item.style.stroke === "rgb(191 191 191)" && Math.abs(item.commands[0]?.x - 3.25) < 0.02
  );
  const legendExamples = result.ir.items.filter((item) => item.subtype === "axis-legend-example");
  const plotCommands = plots.flatMap((plot) => plot.commands.filter((command) => Number.isFinite(command.x) && Number.isFinite(command.y)));
  const texts = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  const halfPiLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "$\\frac{1}{2}\\pi$");
  const library = result.ast.libraries.find((item) => item.name === "datavisualization.polar");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(library?.status, "partial");
  assert.equal(plots.length, 2, "expected one polar line plot per visualizer");
  assert.ok(gridItems.some((item) => item.shape === "arc"), "expected polar radius grid arcs");
  assert.ok(gridItems.some((item) => item.shape !== "arc"), "expected polar angle grid rays");
  assert.equal(outerBoundary?.style.stroke, "rgb(128 128 128)", "expected polar outer angle axis arc to use native black!50 axis style");
  assert.ok(maxRadiusGridArc, "expected clean polar axes to retain the black!25 max-radius axis arc below the padded boundary");
  assert.ok(
    outerBoundary?.commands?.[0]?.x > 3.39 && outerBoundary.commands[0].x < 3.47,
    `expected clean polar outer boundary at padded max radius like native .5em padding, got ${outerBoundary?.commands?.[0]?.x}`
  );
  assert.ok(texts.includes("$\\frac{1}{2}\\pi$"), "expected polar angle tick labels");
  assert.ok(
    halfPiLabel?.y > 3.62 && halfPiLabel.y < 3.76,
    `expected clean half-plane polar angle tick labels to sit near the tikztosvg glyph bbox, got y=${halfPiLabel?.y}`
  );
  assert.ok(texts.includes("2"), "expected polar radius tick labels");
  assert.ok(Math.max(...plotCommands.map((command) => command.y)) > 2.5, "expected polar projection to move radius data upward");
  assert.ok(Math.min(...plotCommands.map((command) => command.x)) < -2, "expected 0 to pi polar projection to use the left half-plane");
  assert.equal(legendExamples.length, 2, "expected one legend example per polar visualizer");
  assert.ok(
    legendExamples.every((item) => item.commands.some((command) => command.type === "curveTo")),
    "expected polar smooth-line legends to use native curved sample paths instead of straight line segments"
  );
  assert.ok(
    legendExamples.every((item) => {
      const ys = item.commands.filter((command) => Number.isFinite(command.y)).map((command) => command.y);
      return Math.max(...ys) - Math.min(...ys) > 0.02;
    }),
    "expected polar smooth-line legend samples to visibly wiggle like tikztosvg"
  );
  const legendCenters = legendExamples.map((item) => {
    const xs = item.commands.filter((command) => Number.isFinite(command.x)).map((command) => command.x);
    const ys = item.commands.filter((command) => Number.isFinite(command.y)).map((command) => command.y);
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2
    };
  });
  assert.ok(Math.abs(legendCenters[0].y - legendCenters[1].y) < 0.05, "expected legend=below to use one visual row for polar legends");
  assert.ok(legendCenters[1].x - legendCenters[0].x > 1.1, "expected polar legend entries to use horizontal columns");
  assert.ok(
    legendCenters.every((center) => center.y < -1.18 && center.y > -1.42),
    `expected polar below legends to sit on the native south-outside row like tikztosvg, got ${legendCenters.map((center) => center.y).join(", ")}`
  );
});

test("typesets scientific polar degree tick suffixes as math labels", () => {
  const result = tikzToSvg(
    String.raw`
\usetikzlibrary { datavisualization.formats.functions, datavisualization.polar }
\tikz \datavisualization [
  scientific polar axes={clean, 0 to 90},
  angle axis={ticks={step=30}},
  radius axis={length=2cm, ticks={step=1}},
  all axes=grid,
  visualize as smooth line=arc,
  data/format=function]
data {
  var angle : interval [0:90] samples 10;
  func radius = 1 + \value angle/90;
};`,
    { mathRenderer: "svg-text" }
  );

  const texts = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(texts.includes("$30^\\circ$"), `expected degree tick suffix to be wrapped as math text, got ${texts.join(", ")}`);
  assert.ok(texts.includes("$90^\\circ$"), `expected endpoint degree tick suffix to be wrapped as math text, got ${texts.join(", ")}`);
});

test("renders scientific polar explicit data point scatter marks", () => {
  const result = tikzToSvg(
    String.raw`
\usetikzlibrary { datavisualization.formats.functions, datavisualization.polar }
\tikz \datavisualization [
  scientific polar axes={clean, 0 to 90},
  angle axis={ticks={step=30}},
  radius axis={length=1cm, ticks={step=1}},
  visualize as scatter]
data point [angle=20, radius=0.5]
data point [angle=30, radius=1]
data point [angle=40, radius=1.5];`,
    { mathRenderer: "svg-text" }
  );

  const marks = result.ir.items.filter((item) => item.subtype === "axis-mark" || item.shape === "plot-mark");
  const connectedPlots = result.ir.items.filter((item) => item.subtype === "axis-plot" && item.shape !== "plot-mark");
  const arc = result.ir.items.find((item) => item.subtype === "axis-clean-boundary" && item.shape === "arc");
  const cleanAxisLines = result.ir.items.filter((item) => item.subtype === "axis-clean-boundary" && item.shape !== "arc");
  const gridAxisLines = result.ir.items.filter((item) => item.subtype === "axis-grid-line" && item.shape !== "arc");
  const horizontalGridAxis = gridAxisLines.find((item) => {
    const [from, to] = item.commands || [];
    return Math.abs(from?.x || 0) < 0.03 && Math.abs(from?.y || 0) < 0.03 && to?.x > 0.95 && Math.abs(to?.y || 0) < 0.03;
  });
  const verticalGridAxis = gridAxisLines.find((item) => {
    const [from, to] = item.commands || [];
    return Math.abs(from?.x || 0) < 0.03 && Math.abs(from?.y || 0) < 0.03 && Math.abs(to?.x || 0) < 0.03 && to?.y > 0.95;
  });
  const horizontalBoundaryAxis = cleanAxisLines.find((item) => {
    const [from, to] = item.commands || [];
    return from?.y < -0.14 && to?.y < -0.14 && Math.abs(from?.x || 0) < 0.03 && to?.x > 0.95;
  });
  const verticalBoundaryAxis = cleanAxisLines.find((item) => {
    const [from, to] = item.commands || [];
    return from?.x < -0.14 && to?.x < -0.14 && Math.abs(from?.y || 0) < 0.03 && to?.y > 0.95;
  });
  const verticalRadiusLabel = result.ir.items.find(
    (item) => item.type === "textNode" && item.text === "1" && item.y > 0.55 && item.y < 0.8 && item.x < -0.05
  );
  const centers = marks.map((mark) => {
    const xs = mark.commands.filter((command) => Number.isFinite(command.x)).map((command) => command.x);
    const ys = mark.commands.filter((command) => Number.isFinite(command.y)).map((command) => command.y);
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2
    };
  });
  const farthest = centers.reduce((max, point) => Math.max(max, Math.hypot(point.x, point.y)), 0);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(marks.length, 3, "expected one polar scatter mark for each explicit angle/radius data point");
  assert.equal(connectedPlots.length, 0, "expected polar scatter to render marks only, without connecting lines");
  assert.ok(arc, "expected scientific polar scatter to draw the radius=1 quadrant arc like tikztosvg");
  assert.ok(horizontalGridAxis, "expected clean scientific polar quadrant to draw the pale 0-degree radius axis like tikztosvg");
  assert.ok(verticalGridAxis, "expected clean scientific polar quadrant to draw the pale 90-degree radius axis like tikztosvg");
  assert.ok(horizontalBoundaryAxis, "expected clean scientific polar quadrant to draw the outward-offset 0-degree boundary axis like tikztosvg");
  assert.ok(verticalBoundaryAxis, "expected clean scientific polar quadrant to draw the outward-offset 90-degree boundary axis like tikztosvg");
  assert.ok(verticalRadiusLabel, "expected clean scientific polar quadrant to label radius ticks on the 90-degree axis like tikztosvg");
  assert.ok(
    farthest > 0.95 && farthest < 1.05,
    `expected source radius=1.5 to map to the 1cm radius-axis length like tikztosvg, got ${farthest}`
  );
});

test("renders non-clean scientific polar axes with inner and outer angle ticks", () => {
  const sourceFor = (placement) => String.raw`
\usetikzlibrary { datavisualization.formats.functions, datavisualization.polar }
\tikz \datavisualization [
  scientific polar axes={${placement}, 0 to 180},
  visualize as smooth line,
  data/format=function]
data {
  var angle : interval [0:100] samples 5;
  func radius = \value{angle};
};`;
  const render = (placement) => tikzToSvg(sourceFor(placement), { mathRenderer: "svg-text" });
  const outer = render("outer ticks");
  const inner = render("inner ticks");
  const expandedOuter = preprocessTikzSource(sourceFor("outer ticks")).source;
  const expandedInner = preprocessTikzSource(sourceFor("inner ticks")).source;
  const zeroDegreeTick = (result) =>
    result.ir.items
      .filter((item) => item.subtype === "axis-tick")
      .find((item) => {
        const [from, to] = item.commands || [];
        return (
          from?.type === "moveTo" &&
          to?.type === "lineTo" &&
          Math.abs(from.y) < 0.04 &&
          Math.abs(to.y) < 0.04 &&
          Math.max(from.x, to.x) > 3.2
        );
      });
  const verticalRadiusAxis = (result) =>
    result.ir.items
      .filter((item) => item.subtype === "axis-clean-boundary")
      .find((item) => {
        const [from, to] = item.commands || [];
        return (
          from?.type === "moveTo" &&
          to?.type === "lineTo" &&
          Math.abs(from.x) < 0.03 &&
          Math.abs(from.y) < 0.03 &&
          Math.abs(to.x) < 0.03 &&
          to.y > 3.2
        );
      });
  const symmetricRadiusTick = (result, x, y) =>
    result.ir.items
      .filter((item) => item.subtype === "axis-tick")
      .find((item) => {
        const [from, to] = item.commands || [];
        const verticalTick =
          Math.abs((from?.x || 0) - x) < 0.04 &&
          Math.abs((to?.x || 0) - x) < 0.04 &&
          Math.min(from.y, to.y) < y - 0.04 &&
          Math.max(from.y, to.y) > y + 0.04;
        const horizontalTick =
          Math.abs((from?.y || 0) - y) < 0.04 &&
          Math.abs((to?.y || 0) - y) < 0.04 &&
          Math.min(from.x, to.x) < x - 0.04 &&
          Math.max(from.x, to.x) > x + 0.04;
        return verticalTick || horizontalTick;
      });

  const outerZeroTick = zeroDegreeTick(outer);
  const innerZeroTick = zeroDegreeTick(inner);
  const outerPositiveRadiusTick = symmetricRadiusTick(outer, 3.25, 0);
  const outerVerticalRadiusTick = symmetricRadiusTick(outer, 0, 3.25);
  const outerLabels = outer.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  const innerLabels = inner.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  const verticalRadiusLabel = outer.ir.items.find((item) => item.type === "textNode" && item.text === "75" && item.y > 2.3 && Math.abs(item.x) < 0.5);
  const innerRadiusLabel25Count = inner.ir.items.filter((item) => item.type === "textNode" && item.text === "25").length;
  const outerRadiusLabel25Count = outer.ir.items.filter((item) => item.type === "textNode" && item.text === "25").length;
  const ninetyDegreeAngleLabel = expandedOuter.match(
    /\\node\[axis tick label,[^\]]*\]\s+at\s+\(([-\d.]+),([-\d.]+)\)\s+\{\$90\^\\circ\$\}/
  );
  const innerNinetyDegreeAngleLabel = expandedInner.match(
    /\\node\[axis tick label,[^\]]*\]\s+at\s+\(([-\d.]+),([-\d.]+)\)\s+\{\$90\^\\circ\$\}/
  );

  assert.deepEqual(outer.diagnostics, []);
  assert.deepEqual(inner.diagnostics, []);
  assert.ok(outer.ir.items.some((item) => item.subtype === "axis-clean-boundary" && item.shape === "arc"), "expected outer-tick polar axes to draw the outer angle-axis arc");
  assert.ok(verticalRadiusAxis(outer), "expected 0 to 180 polar axes to draw the 90-degree radius axis");
  assert.ok(outerZeroTick, "expected outer-tick polar axes to draw a 0-degree tick");
  assert.ok(innerZeroTick, "expected inner-tick polar axes to draw a 0-degree tick");
  assert.ok(
    outerZeroTick.commands[1].x > outerZeroTick.commands[0].x,
    `expected outer polar tick to extend outside the ring, got ${JSON.stringify(outerZeroTick.commands)}`
  );
  assert.ok(
    innerZeroTick.commands[1].x < innerZeroTick.commands[0].x,
    `expected inner polar tick to extend inside the ring, got ${JSON.stringify(innerZeroTick.commands)}`
  );
  assert.ok(outerPositiveRadiusTick, "expected non-clean polar radius tick on the 0-degree axis to straddle the axis like tikztosvg");
  assert.ok(outerVerticalRadiusTick, "expected non-clean polar radius tick on the 90-degree axis to straddle the axis like tikztosvg");
  assert.ok(outerLabels.includes("$0^\\circ$"), `expected outer-tick polar angle labels, got ${outerLabels.join(", ")}`);
  assert.ok(innerLabels.includes("$0^\\circ$"), `expected inner-tick polar angle labels, got ${innerLabels.join(", ")}`);
  assert.ok(verticalRadiusLabel, "expected radius tick labels along the 90-degree radius axis like native datavisualization.polar");
  assert.equal(innerRadiusLabel25Count, 4, "expected non-clean inner polar radius tick text at 0, 90, 180 degrees plus the 0-degree high-side duplicate like tikztosvg");
  assert.equal(outerRadiusLabel25Count, 4, "expected non-clean outer polar radius tick text at 0, 90, 180 degrees plus the 0-degree high-side duplicate like tikztosvg");
  assert.ok(ninetyDegreeAngleLabel, "expected generated outer-tick 90-degree label");
  assert.ok(
    Math.abs(Number(ninetyDegreeAngleLabel[2]) - 3.37) < 0.03,
    `expected outer-tick angle labels near the tick tip instead of far outside the arc, got y=${ninetyDegreeAngleLabel[2]}`
  );
  assert.ok(innerNinetyDegreeAngleLabel, "expected generated inner-tick 90-degree label");
  assert.ok(
    Math.abs(Number(innerNinetyDegreeAngleLabel[2]) - 3.37) < 0.03,
    `expected inner-tick angle labels to use the same high-side tick-text radius as outer ticks, got y=${innerNinetyDegreeAngleLabel[2]}`
  );
});

test("scales small scientific polar tick label padding like the native axis object", () => {
  const source = String.raw`
\usetikzlibrary { datavisualization.formats.functions, datavisualization.polar }
\tikz \datavisualization [
  scientific polar axes={outer ticks, 0 to 180},
  angle axis={ticks={step=30}},
  radius axis={length=1cm, ticks={step=1}},
  visualize as scatter]
data point [angle=20, radius=0.5]
data point [angle=30, radius=1]
data point [angle=40, radius=1.5];`;
  const expanded = preprocessTikzSource(source).source;
  const nodeMatches = [...expanded.matchAll(/\\node\[axis tick label,[^\]]*\]\s+at\s+\(([-\d.]+),([-\d.]+)\)\s+\{([^}]*)\}/g)];
  const nodeFor = (text) => nodeMatches.find((match) => match[3] === text);
  const topAngleLabel = nodeFor("$90^\\circ$");
  const bottomRadiusLabel = nodeMatches.find((match) => match[3] === "1" && Math.abs(Number(match[1]) - 0.6667) < 0.02);

  assert.ok(topAngleLabel, "expected 90-degree polar tick label");
  assert.ok(
    Math.abs(Number(topAngleLabel[2]) - 1.05) < 0.03,
    `expected small polar angle label close to padded tick high, got y=${topAngleLabel[2]}`
  );
  assert.ok(bottomRadiusLabel, "expected bottom radius tick label");
  assert.ok(
    Math.abs(Number(bottomRadiusLabel[2]) + 0.16) < 0.03,
    `expected small polar radius label to use compact tick-text padding, got y=${bottomRadiusLabel[2]}`
  );
});

test("draws clean polar angle ticks outward from the padded boundary", () => {
  const result = tikzToSvg(
    String.raw`
\usetikzlibrary { datavisualization.formats.functions, datavisualization.polar }
\tikz \datavisualization [
  scientific polar axes={clean, 0 to 90},
  angle axis={ticks={step=30}},
  radius axis={length=1cm, ticks={step=1}},
  visualize as scatter]
data point [angle=20, radius=0.5]
data point [angle=30, radius=1]
data point [angle=40, radius=1.5];`,
    { mathRenderer: "svg-text" }
  );
  const zeroDegreeTick = result.ir.items
    .filter((item) => item.subtype === "axis-tick")
    .find((item) => {
      const [from, to] = item.commands || [];
      return Math.abs(from?.y || 0) < 0.02 && Math.abs(to?.y || 0) < 0.02 && Math.max(from?.x || 0, to?.x || 0) > 1.2;
    });

  assert.deepEqual(result.diagnostics, []);
  assert.ok(zeroDegreeTick, "expected clean polar 0-degree angle tick");
  assert.ok(
    Math.abs(zeroDegreeTick.commands[0].x - 1.1757) < 0.015,
    `expected clean polar tick to start on padded boundary like tikztosvg, got ${JSON.stringify(zeroDegreeTick.commands)}`
  );
  assert.ok(
    Math.abs(zeroDegreeTick.commands[1].x - 1.246) < 0.02,
    `expected clean polar tick to extend outward by about 2pt like tikztosvg, got ${JSON.stringify(zeroDegreeTick.commands)}`
  );
});

test("uses compact axis tick label metrics for degree math labels", () => {
  const source = String.raw`
\usetikzlibrary { datavisualization.formats.functions, datavisualization.polar }
\tikz \datavisualization [
  scientific polar axes={clean, 0 to 90},
  angle axis={ticks={step=30}},
  radius axis={length=1cm, ticks={step=1}},
  visualize as scatter]
data point [angle=20, radius=0.5]
data point [angle=30, radius=1]
data point [angle=40, radius=1.5];`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const topAngleLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "$90^\\circ$");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(topAngleLabel, "expected generated 90-degree polar tick label");
  assert.ok(
    topAngleLabel.y > 1.28 && topAngleLabel.y < 1.37,
    `expected compact math tick label center near tikztosvg, got y=${topAngleLabel.y}`
  );
  const shallowAngleLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "$30^\\circ$");
  assert.ok(shallowAngleLabel, "expected generated 30-degree polar tick label");
  assert.ok(
    shallowAngleLabel.x > 1.18,
    `expected shallow clean polar labels to sit on the high-side/right of the tick like tikztosvg, got x=${shallowAngleLabel.x}`
  );
});

test("renders numeric degree math labels with a real superscript in svg-text fallback", () => {
  const source = String.raw`
\usetikzlibrary { datavisualization.formats.functions, datavisualization.polar }
\tikz \datavisualization [
  scientific polar axes={clean, 0 to 90},
  angle axis={ticks={step=30}},
  radius axis={length=1cm, ticks={step=1}},
  visualize as scatter]
data point [angle=20, radius=0.5]
data point [angle=30, radius=1]
data point [angle=40, radius=1.5];`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, /<tspan>30<\/tspan><tspan[^>]+baseline-shift="super"[^>]*>°<\/tspan>/);
  assert.doesNotMatch(result.svg, /<tspan[^>]+baseline-shift="super"[^>]+dy="-[^"]+"[^>]*>°<\/tspan>/);
  assert.doesNotMatch(result.svg, />30°<\/text>/);
});

test("clips datavisualization minor grid lines from visualize grid low and high", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization}
\tikz \datavisualization [
    xy Cartesian,
    all axes={visualize axis={low=0, style=->},
              grid={some, minor steps between steps}},
    x axis={visualize grid={
                direction axis=y axis,
                minor={low=0.25, high=1.75, style=red!50}}},
    visualize as scatter]
  data {
    x, y
    0, 0
    3, 3
  };`;

  const expanded = preprocessTikzSource(source).source;
  const minorGridLines = expanded
    .split(/\n/)
    .filter((line) => line.includes("axis minor grid"));
  const styledMinorGridLines = minorGridLines.filter((line) => line.includes("red!50"));

  assert.ok(minorGridLines.length > 0, "expected grid={minor steps between steps} to emit minor grid lines");
  assert.ok(styledMinorGridLines.length > 0, `expected x-axis minor visualize grid style red!50, got:\n${minorGridLines.join("\n")}`);
  assert.ok(
    styledMinorGridLines.every((line) => /\([-\d.]+,0\.25\) -- \([-\d.]+,1\.75\)/.test(line)),
    `expected x minor grid lines clipped to y=0.25..1.75 data values, got:\n${styledMinorGridLines.join("\n")}`
  );
  assert.ok(
    styledMinorGridLines.every((line) => line.includes("line width=0.2pt")),
    `expected minor grid lines to use native help-lines half width, got:\n${styledMinorGridLines.join("\n")}`
  );
  assert.doesNotMatch(expanded, /axis tick label/, "xy Cartesian should not draw tick labels without visualize ticks");
  const majorGridLines = expanded
    .split(/\n/)
    .filter((line) => line.includes("axis grid") && !line.includes("axis minor grid"));
  const horizontalMajorGridLines = majorGridLines.filter((line) => {
    const match = line.match(/\(([-\d.]+),([-\d.]+)\) -- \(([-\d.]+),([-\d.]+)\)/);
    return match && Math.abs(Number(match[2]) - Number(match[4])) < 1e-9;
  });
  assert.deepEqual(horizontalMajorGridLines, [], "xy Cartesian should not draw y-grid lines without y axis visualize grid");
});

test("uses datavisualization visualize ticks low high and style", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization}
\tikz \datavisualization [
    xy Cartesian,
    all axes={visualize axis={low=0, style=->},
              ticks={some}},
    x axis={visualize ticks={
                direction axis=y axis,
                major={low=-4pt, high=4pt, style=red!50}}},
    visualize as scatter]
  data {
    x, y
    0, 0
    3, 3
  };`;

  const expanded = preprocessTikzSource(source).source;
  const tickLines = expanded
    .split(/\n/)
    .filter((line) => line.includes("axis tick"));
  const redTickLines = tickLines.filter((line) => line.includes("red!50"));
  const expectedHalfLength = parseDimension("4pt", {});

  assert.ok(redTickLines.length > 0, `expected x visualize ticks major style red!50, got:\n${tickLines.join("\n")}`);
  assert.ok(
    redTickLines.some((line) => {
      const match = line.match(/\(([-\d.]+),([-\d.]+)\) -- \(([-\d.]+),([-\d.]+)\)/);
      return (
        match &&
        Math.abs(Number(match[1]) - Number(match[3])) < 1e-9 &&
        Math.abs(Number(match[2]) + expectedHalfLength) < 0.001 &&
        Math.abs(Number(match[4]) - expectedHalfLength) < 0.001
      );
    }),
    `expected visualize ticks to use physical low/high offsets around y=0, got:\n${redTickLines.join("\n")}`
  );
  assert.doesNotMatch(expanded, /axis tick label/, "explicit visualize ticks without tick text keys should only draw tick marks");
});

test("places datavisualization visualize ticks labels at requested high endpoint", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization}
\tikz \datavisualization [
    xy Cartesian,
    all axes={visualize axis={low=0, style=->},
              ticks={some}},
    x axis={visualize ticks={
                direction axis=y axis,
                major={low=0pt, high=4pt, tick text at high}}},
    visualize as scatter]
  data {
    x, y
    0, 0
    2, 2
  };`;

  const expanded = preprocessTikzSource(source).source;
  const labelLines = expanded
    .split(/\n/)
    .filter((line) => line.includes("axis tick label"));
  const high = parseDimension("4pt", {});

  assert.ok(labelLines.length > 0, `expected tick text at high labels, got:\n${expanded}`);
  assert.ok(
    labelLines.some((line) => {
      const match = line.match(/anchor=south[^\n]* at \(([-\d.]+),([-\d.]+)\)/);
      return match && Math.abs(Number(match[1])) < 1e-9 && Math.abs(Number(match[2]) - high) < 0.001;
    }),
    `expected first x tick label anchored at the high endpoint y=4pt, got:\n${labelLines.join("\n")}`
  );
  assert.ok(
    labelLines.every((line) => !/anchor=north[^\n]*\(0,-/.test(line)),
    `expected visualize tick labels not to use the default below-axis placement, got:\n${labelLines.join("\n")}`
  );
});

test("maps datavisualization scientific polar right half clockwise ranges", () => {
  const result = tikzToSvg(
    String.raw`
\usetikzlibrary { datavisualization.formats.functions, datavisualization.polar }
\tikz \datavisualization [
  scientific polar axes={right half clockwise, clean},
  all axes=grid,
  visualize as smooth line=arc,
  arc={label in legend={text=$r$}},
  data/format=function]
data {
  var angle : interval [0:100] samples 5;
  func radius = 1;
};`,
    { mathRenderer: "svg-text" }
  );

  const plot = result.ir.items.find((item) => item.subtype === "axis-plot");
  const points = plot?.commands?.filter((command) => Number.isFinite(command.x) && Number.isFinite(command.y)) || [];
  const textNodes = result.ir.items.filter((item) => item.type === "textNode");
  const labels = textNodes.map((item) => item.text);
  const legend = textNodes.find((item) => item.text === "$r$");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(plot, "expected polar plot path");
  assert.ok(points.length >= 5, `expected sampled polar path coordinates, got ${points.length}`);
  assert.ok(points.every((point) => point.x >= -0.001), "expected right half clockwise data to stay in right half-plane");
  assert.ok(points[0].y > 0.8, `expected min angle to map near the top of the right half-plane, got y=${points[0].y}`);
  assert.ok(points.at(-1).y < -0.8, `expected max angle to map near the bottom of the right half-plane, got y=${points.at(-1)?.y}`);
  assert.ok(labels.includes("20"), `expected mapped data-axis tick label 20, got ${labels.join(", ")}`);
  assert.ok(labels.includes("100"), `expected mapped data-axis tick label 100, got ${labels.join(", ")}`);
  assert.ok(!labels.some((label) => /\\circ/.test(label)), `expected mapped polar ticks without degree symbols, got ${labels.join(", ")}`);
  assert.ok(labels.includes("0.25"), `expected clean polar radius tick label 0.25, got ${labels.join(", ")}`);
  assert.ok(!labels.includes("0.2"), `expected clean polar radius ticks to use quarters, got ${labels.join(", ")}`);
  assert.ok(legend && legend.x > 3.8, `expected right-half polar legend outside the right edge, got ${legend?.x}`);
});

test("maps scientific polar logarithmic angle axes before projecting points", () => {
  const result = tikzToSvg(
    String.raw`
\usetikzlibrary { datavisualization.formats.functions, datavisualization.polar }
\tikz \datavisualization [
  scientific polar axes={right half clockwise, clean},
  angle axis={logarithmic, ticks={major also at/.list={2,3,4,5,15,20}}},
  radius axis={length=1cm, max value=1, ticks=none},
  visualize as scatter]
data point [angle=0.04978706837, radius=1]
data point [angle=1, radius=1]
data point [angle=20.0855369232, radius=1];`,
    { mathRenderer: "svg-text" }
  );

  const marks = result.ir.items.filter((item) => item.subtype === "axis-mark" || item.shape === "plot-mark");
  const labels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  const centers = marks.map((mark) => {
    const xs = mark.commands.filter((command) => Number.isFinite(command.x)).map((command) => command.x);
    const ys = mark.commands.filter((command) => Number.isFinite(command.y)).map((command) => command.y);
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2
    };
  });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(centers.length, 3, "expected one scatter mark for each logarithmic angle sample");
  assert.ok(Math.abs(centers[0].x) < 0.08 && centers[0].y > 0.9, `expected smallest positive angle at the top of the right half, got ${JSON.stringify(centers[0])}`);
  assert.ok(centers[1].x > 0.9 && Math.abs(centers[1].y) < 0.08, `expected angle=1 to land at the logarithmic midpoint/east radius, got ${JSON.stringify(centers[1])}`);
  assert.ok(Math.abs(centers[2].x) < 0.08 && centers[2].y < -0.9, `expected largest angle at the bottom of the right half, got ${JSON.stringify(centers[2])}`);
  assert.ok(labels.includes("2"), `expected major also at/.list tick label 2, got ${labels.join(", ")}`);
  assert.ok(labels.includes("20"), `expected major also at/.list tick label 20, got ${labels.join(", ")}`);
});

test("uses native polar radius about ticks and tick-label style", () => {
  const result = tikzToSvg(
    String.raw`
\usetikzlibrary { datavisualization.formats.functions, datavisualization.polar }
\tikz \datavisualization [
  scientific polar axes={right half clockwise, clean},
  angle axis={logarithmic, ticks={minor steps between steps=8}},
  radius axis={ticks={some, style=red!80!black}},
  all axes=grid,
  visualize as smooth line=sin,
  data/format=function]
data {
  var t : interval [-3:3] samples 7;
  func angle = exp(\value t);
  func radius = \value{t}*\value{t};
};`,
    { mathRenderer: "svg-text" }
  );

  const labels = result.ir.items.filter((item) => item.type === "textNode" && item.style?.fontScale === 0.8);
  const redRadiusLabels = labels.filter((item) => /^(?:0|2|4|6|8)$/.test(item.text));
  const eastAngleLabel = labels.find((item) => item.text === "1" && item.x > 0.5);
  const texts = labels.map((item) => item.text);
  const angleGridRays = result.ir.items.filter((item) => {
    if (item.subtype !== "axis-grid-line" && item.subtype !== "axis-minor-grid-line") return false;
    const points = item.commands.filter((command) => Number.isFinite(command.x) && Number.isFinite(command.y));
    if (points.length < 2) return false;
    const start = points[0];
    const end = points.at(-1);
    return Math.hypot(start.x, start.y) < 0.03 && Math.hypot(end.x, end.y) > 0.7;
  });
  const outerAngleTicks = result.ir.items.filter((item) => {
    if (item.subtype !== "axis-tick" && item.subtype !== "axis-minor-tick") return false;
    const points = item.commands.filter((command) => Number.isFinite(command.x) && Number.isFinite(command.y));
    if (points.length < 2) return false;
    const start = points[0];
    const end = points.at(-1);
    const length = Math.hypot(start.x - end.x, start.y - end.y);
    const radius = Math.max(Math.hypot(start.x, start.y), Math.hypot(end.x, end.y));
    return length > 0.03 && length < 0.22 && radius > 3;
  });

  assert.deepEqual(result.diagnostics, []);
  assert.ok(texts.includes("8"), `expected polar radius ticks={some} to include native about tick 8, got ${texts.join(", ")}`);
  assert.equal(texts.includes("6.75"), false, `expected polar radius ticks={some} not to fall back to quarter ticks, got ${texts.join(", ")}`);
  assert.ok(redRadiusLabels.length >= 5, `expected red polar radius labels 0,2,4,6,8, got ${texts.join(", ")}`);
  assert.ok(
    redRadiusLabels.every((item) => item.style.fill === "rgb(204 0 0)"),
    `expected radius axis tick label style to propagate, got ${redRadiusLabels.map((item) => item.style.fill).join(",")}`
  );
  assert.ok(eastAngleLabel, `expected logarithmic angle label 1 on the east side, got ${texts.join(", ")}`);
  assert.notEqual(
    eastAngleLabel.style.fill,
    "rgb(204 0 0)",
    `expected radius axis tick style not to recolor angle labels, got ${eastAngleLabel.style.fill}`
  );
  assert.ok(angleGridRays.length >= 20, `expected logarithmic minor angle grid rays, got ${angleGridRays.length}`);
  assert.ok(outerAngleTicks.length >= 20, `expected major and minor angle ticks on the outer polar boundary, got ${outerAngleTicks.length}`);
});

test("supports low-level new polar axes with custom angle and radius axis names", () => {
  const result = tikzToSvg(
    String.raw`
\usetikzlibrary { datavisualization.formats.functions, datavisualization.polar }
\tikz \datavisualization [
  new polar axes={theta axis}{rho axis},
  theta axis={attribute=theta,min value=0,max value=90,ticks={step=45},grid},
  rho axis={attribute=rho,min value=0,max value=2,length=2cm,ticks={step=1},grid},
  visualize as smooth line=ray,
  ray={label in legend={text=$\rho(\theta)$}},
  data/format=function]
data {
  var theta : interval [0:90] samples 4;
  func rho = 1 + \value theta/90;
};`,
    { mathRenderer: "svg-text" }
  );

  const plot = result.ir.items.find((item) => item.subtype === "axis-plot");
  const points = plot?.commands?.filter((command) => Number.isFinite(command.x) && Number.isFinite(command.y)) || [];
  const gridItems = result.ir.items.filter((item) => item.subtype === "axis-grid-line");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(plot, "expected custom-axis polar data to render a plot");
  assert.ok(points.length >= 4, `expected custom theta/rho samples to survive polar projection, got ${points.length}`);
  assert.ok(points[0].x > 0.9 && Math.abs(points[0].y) < 0.1, `expected theta=0 to start on the positive x radius, got ${JSON.stringify(points[0])}`);
  assert.ok(points.at(-1).y > 1.9, `expected theta=90 and rho=2 to project near the positive y radius, got ${JSON.stringify(points.at(-1))}`);
  assert.ok(gridItems.some((item) => item.shape === "arc"), "expected custom rho axis grid to draw radius arcs");
  assert.ok(gridItems.some((item) => item.shape !== "arc"), "expected custom theta axis grid to draw radial grid lines");
});

test("supports official named-format data for low-level polar axes", () => {
  const result = tikzToSvg(
    String.raw`
\usetikzlibrary { datavisualization.polar }
\tikz \datavisualization
    [new polar axes={angle axis}{radius axis},
     radius axis={length=2cm},
     visualize as scatter]
  data [format=named] {
    angle={0,20,...,160}, radius={0,...,5}
  };`,
    { mathRenderer: "svg-text" }
  );

  const marks = result.ir.items.filter((item) => item.subtype === "axis-mark" || item.shape === "plot-mark");
  const connectedPlots = result.ir.items.filter((item) => item.subtype === "axis-plot" && item.shape !== "plot-mark");
  const centers = marks.map((mark) => {
    const xs = mark.commands.filter((command) => Number.isFinite(command.x)).map((command) => command.x);
    const ys = mark.commands.filter((command) => Number.isFinite(command.y)).map((command) => command.y);
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2
    };
  });
  const farthest = centers.reduce((max, point) => Math.max(max, Math.hypot(point.x, point.y)), 0);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(marks.length, 54, "expected named-format lists to expand as cartesian products");
  assert.equal(connectedPlots.length, 0, "expected polar scatter to render marks only, without connecting lines");
  assert.equal(result.ir.items.filter((item) => item.type === "textNode").length, 0, "expected low-level polar axes without explicit ticks/grid to avoid automatic tick labels");
  assert.equal(
    result.ir.items.filter((item) => item.subtype === "axis-clean-boundary" || item.subtype === "axis-grid-line").length,
    0,
    "expected low-level polar axes without explicit ticks/grid to avoid automatic axes"
  );
  assert.ok(farthest > 1.95 && farthest < 2.08, `expected radius=5 to map to the 2cm polar radius, got ${farthest}`);
});

test("applies low-level polar angle axis unit vectors", () => {
  const result = tikzToSvg(
    String.raw`
\usetikzlibrary { datavisualization.polar }
\tikz \datavisualization
    [new polar axes={angle axis}{radius axis},
     radius axis={unit length=1cm},
     angle axis={unit vectors={(10:1pt)}{(60:1pt)}},
     visualize as scatter]
  data [format=named] {
    angle={0,90}, radius={1}
  };`,
    { mathRenderer: "svg-text" }
  );

  const marks = result.ir.items.filter((item) => item.subtype === "axis-mark" || item.shape === "plot-mark");
  const centers = marks.map((mark) => {
    const xs = mark.commands.filter((command) => Number.isFinite(command.x)).map((command) => command.x);
    const ys = mark.commands.filter((command) => Number.isFinite(command.y)).map((command) => command.y);
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2
    };
  });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(marks.length, 2, "expected one mark for each low-level polar point");
  assert.ok(
    Math.abs(centers[0].x - Math.cos((10 * Math.PI) / 180)) < 0.03 && Math.abs(centers[0].y - Math.sin((10 * Math.PI) / 180)) < 0.03,
    `expected angle=0 to follow the custom 10 degree unit vector, got ${JSON.stringify(centers[0])}`
  );
  assert.ok(
    Math.abs(centers[1].x - Math.cos((60 * Math.PI) / 180)) < 0.03 && Math.abs(centers[1].y - Math.sin((60 * Math.PI) / 180)) < 0.03,
    `expected angle=90 to follow the custom 60 degree unit vector, got ${JSON.stringify(centers[1])}`
  );
});

test("maps low-level polar radius axis unit length as one physical unit per source unit", () => {
  const result = tikzToSvg(
    String.raw`
\usetikzlibrary { datavisualization.polar }
\tikz \datavisualization
    [new polar axes={angle axis}{radius axis},
     radius axis={unit length=1cm},
     angle axis={degrees},
     visualize as scatter]
  data [format=named] {
    angle={0}, radius={0.25,0.5,...,2}
  };`,
    { mathRenderer: "svg-text" }
  );

  const marks = result.ir.items.filter((item) => item.subtype === "axis-mark" || item.shape === "plot-mark");
  const centers = marks.map((mark) => {
    const xs = mark.commands.filter((command) => Number.isFinite(command.x)).map((command) => command.x);
    const ys = mark.commands.filter((command) => Number.isFinite(command.y)).map((command) => command.y);
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2
    };
  });
  const farthest = centers.reduce((max, point) => Math.max(max, Math.hypot(point.x, point.y)), 0);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(marks.length, 8, "expected one mark per radius sample");
  assert.ok(farthest > 1.95 && farthest < 2.08, `expected radius=2 with unit length=1cm to land near 2cm, got ${farthest}`);
});

test("renders clean full-circle datavisualization polar axes with padded outer boundary", () => {
  const result = tikzToSvg(
    String.raw`
\usetikzlibrary { datavisualization.formats.functions, datavisualization.polar }
\tikz \datavisualization [
  scientific polar axes={clean},
  all axes=grid,
  visualize as smooth line=circle,
  circle={label in legend={text={$r=1$}}},
  data/format=function]
data {
  var angle : interval [0:360] samples 25;
  func radius = 1;
};`,
    { mathRenderer: "svg-text" }
  );

  const gridCircles = result.ir.items.filter((item) => item.subtype === "axis-grid-line" && item.shape === "circle");
  const cleanBoundary = result.ir.items.find((item) => item.subtype === "axis-clean-boundary" && item.shape === "circle");
  const angleLabels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  const legend = result.ir.items.find((item) => item.type === "textNode" && item.text === "$r=1$");
  const legendExample = result.ir.items.find((item) => item.subtype === "axis-legend-example");
  const plot = result.ir.items.find((item) => item.subtype === "axis-plot");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(plot, "expected full-circle polar plot");
  assert.ok(gridCircles.length >= 4, `expected clean full-circle polar radius grid circles, got ${gridCircles.length}`);
  assert.ok(cleanBoundary, "expected clean full-circle polar axes to draw a padded outer boundary circle");
  assert.ok(
    Math.abs((cleanBoundary.commands?.[0]?.x || 0) - 3.4528) < 0.06,
    `expected full-circle clean boundary at radius plus .5em padding, got ${cleanBoundary.commands?.[0]?.x}`
  );
  assert.ok(angleLabels.includes("$90^\\circ$"), `expected full-circle polar angle labels, got ${angleLabels.join(", ")}`);
  assert.ok(legend && legend.x > 4, `expected default full-circle polar legend outside the right edge, got x=${legend?.x}`);
  assert.ok(
    legend && Math.abs(legend.y) < 0.12,
    `expected default full-circle polar legend to align with the 0 degree radius line, got y=${legend?.y}`
  );
  assert.ok(
    !angleLabels.includes("360^\\circ"),
    `expected full-circle polar labels to avoid duplicate 360 degree endpoint, got ${angleLabels.join(", ")}`
  );
  assert.ok(
    legendExample?.commands?.[0]?.x > 4.4,
    `expected full-circle polar legend sample to clear the 0 degree label like tikztosvg, got x=${legendExample?.commands?.[0]?.x}`
  );
  assert.ok(
    legend && legend.x > 5.2,
    `expected full-circle polar legend text to sit near tikztosvg's outside-right label column, got x=${legend?.x}`
  );
});

test("honors datavisualization polar radius ticks=none", () => {
  const result = tikzToSvg(
    String.raw`
\usetikzlibrary { datavisualization.formats.functions, datavisualization.polar }
\tikz \datavisualization [
  scientific polar axes={clean},
  all axes=grid,
  radius axis={ticks=none},
  visualize as smooth line=circle,
  data/format=function]
data {
  var angle : interval [0:360] samples 17;
  func radius = 1;
};`,
    { mathRenderer: "svg-text" }
  );

  const labels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  const radiusGridCircles = result.ir.items.filter((item) => item.subtype === "axis-grid-line" && item.shape === "circle");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(!labels.includes("0"), `expected ticks=none to suppress the plain radius zero label, got ${labels.join(", ")}`);
  assert.ok(!labels.includes("0.25"), `expected ticks=none to suppress quarter-radius labels, got ${labels.join(", ")}`);
  assert.ok(!labels.includes("0.5"), `expected ticks=none to suppress half-radius labels, got ${labels.join(", ")}`);
  assert.ok(!labels.includes("0.75"), `expected ticks=none to suppress three-quarter-radius labels, got ${labels.join(", ")}`);
  assert.equal(radiusGridCircles.length, 0, `expected ticks=none to suppress default radius grid circles, got ${radiusGridCircles.length}`);
});

test("supports datavisualization smooth line list visualizers with function sets", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\begin{tikzpicture}[baseline]
  \datavisualization [ scientific axes=clean,
                       y axis=grid,
                       visualize as smooth line/.list={sin,cos,tan},
                       style sheet=strong colors,
                       style sheet=vary dashing,
                       sin={label in legend={text=$\sin x$}},
                       cos={label in legend={text=$\cos x$}},
                       tan={label in legend={text=$\tan x$}},
                       data/format=function ]
  data [set=sin] {
    var x : interval [-0.5*pi:4];
    func y = sin(\value x r);
  }
  data [set=cos] {
    var x : interval [-0.5*pi:4];
    func y = cos(\value x r);
  }
  data [set=tan] {
    var x : interval [-0.3*pi:.3*pi];
    func y = tan(\value x r);
  };
\end{tikzpicture}`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plots = result.ir.items.filter((item) => item.subtype === "axis-plot");
  const gridLines = result.ir.items.filter((item) => item.subtype === "axis-grid-line");
  const axisLines = result.ir.items.filter((item) => item.subtype === "axis-line");
  const cleanAxes = result.ir.items.filter((item) => item.subtype === "axis-clean-line");
  const cleanBoundaries = result.ir.items.filter((item) => item.subtype === "axis-clean-boundary");
  const frame = result.ir.items.find((item) => item.subtype === "axis-frame");
  const legendExamples = result.ir.items.filter((item) => item.subtype === "axis-legend-example");
  const textNodes = result.ir.items.filter((item) => item.type === "textNode");
  const texts = textNodes.map((item) => item.text);
  const frameYs = frame?.commands.filter((command) => "y" in command).map((command) => command.y) || [];
  const boundaryYs = cleanBoundaries.flatMap((item) => item.commands.filter((command) => "y" in command).map((command) => command.y));

  assert.deepEqual(result.diagnostics, []);
  assert.equal(plots.length, 3);
  assert.ok(plots.every((plot) => plot.commands.length >= 20), "expected sampled smooth line paths");
  assert.equal(plots[0].style.stroke, "black");
  assert.equal(plots[1].style.stroke, "rgb(204 0 0)");
  assert.equal(plots[2].style.stroke, "rgb(0 0 204)");
  assert.equal(plots[0].style.dashArray, undefined);
  assert.ok(plots[1].style.dashArray?.length >= 2, "expected strong/vary dashing cos plot to be dashed");
  assert.ok(plots[2].style.dashArray?.length >= 2, "expected strong/vary dashing tan plot to be dotted");
  assert.equal(gridLines.length, 5, "expected y axis=grid to render only y-grid lines");
  assert.ok(
    gridLines.every((line) => Math.abs(line.commands[0].y - line.commands[1].y) < 1e-6),
    "expected y axis=grid lines to be horizontal"
  );
  assert.equal(axisLines.length, 0, "expected scientific axes=clean / axis lines=box to avoid middle-axis cross lines");
  assert.equal(cleanAxes.length, 2, "expected clean axes to use offset left/bottom axes");
  assert.equal(cleanBoundaries.length, 4, "expected clean axes to use light plot boundaries");
  assert.ok(frame, "expected datavis clean axes to keep an invisible frame for bbox control");
  assert.ok(Math.abs(Math.max(...frameYs) - Math.max(...boundaryYs)) < 0.01, "expected datavis clean axis frame not to add extra top padding");
  assert.ok(Math.abs(Math.min(...frameYs) - Math.min(...boundaryYs)) < 0.01, "expected datavis clean axis frame not to add extra bottom padding");
  assert.ok(gridLines.every((line) => line.style.stroke === "rgb(191 191 191)"), "expected clean grid color to match black!25");
  assert.equal(legendExamples.length, 3, "expected datavis line legends to render as unboxed visualizer examples");
  assert.ok(
    legendExamples.every((item) => item.commands.length >= 4),
    "expected datavis line legend examples to use the native zig-zag sample path"
  );
  const firstLegendXs = legendExamples[0].commands.filter((command) => "x" in command).map((command) => command.x);
  const firstLegendMinX = Math.min(...firstLegendXs);
  const firstLegendMaxX = Math.max(...firstLegendXs);
  const legendRows = legendExamples.map((item) => {
    const ys = item.commands.filter((command) => "y" in command).map((command) => command.y);
    return (Math.min(...ys) + Math.max(...ys)) / 2;
  });
  assert.ok(Math.abs(legendRows[0] - 1.591) < 0.04, `expected default three-row legend to start near native y, got ${legendRows[0]}`);
  assert.ok(Math.abs(legendRows[1] - 1.205) < 0.04, `expected default three-row legend middle row near native y, got ${legendRows[1]}`);
  assert.ok(Math.abs(legendRows[2] - 0.819) < 0.04, `expected default three-row legend last row near native y, got ${legendRows[2]}`);
  assert.ok(
    Math.abs(firstLegendMinX - 5.526) < 0.03,
    `expected outside datavis legend sample to start about 0.526cm after axis, got ${firstLegendMinX}`
  );
  assert.ok(
    Math.abs(firstLegendMaxX - 6.229) < 0.03,
    `expected outside datavis legend sample to match native width, got ${firstLegendMaxX}`
  );
  const sinLegend = textNodes.find((item) => item.text === String.raw`$\sin x$`);
  assert.ok(sinLegend && sinLegend.x > 6.75, `expected native outside legend text spacing, got ${sinLegend?.x}`);
  assert.ok(texts.includes(String.raw`$\sin x$`));
  assert.ok(texts.includes(String.raw`$\cos x$`));
  assert.ok(texts.includes(String.raw`$\tan x$`));
  assert.equal(textNodes.find((item) => item.text === "0")?.style.fontScale, 0.8, "expected datavis tick labels to use footnotesize");
  assert.equal(
    textNodes.find((item) => item.text === String.raw`$\sin x$`)?.style.fontScale,
    0.9,
    "expected datavis outside legend labels to inherit every data set label small font"
  );

  const rendered = result.svg;
  assert.match(
    rendered,
    /<text x="64\d(?:\.\d+)?"[^>]*text-anchor="start"[^>]*>\s*<tspan[^>]*font-style="normal">sin<\/tspan> x<\/text>/,
    "expected math legend label to keep TikZ west anchor instead of falling back to centered math text"
  );
});

test("applies custom datavisualization style sheets to data point sets", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization}
\pgfkeys{
  /pgf/data visualization/style sheets/traffic light/.cd,
  1/.style={green!50!black},
  2/.style={yellow!90!black},
  3/.style={red!80!black},
  default style/.style={black}
}
\tikz \datavisualization [
  school book axes,
  visualize as line=1,
  visualize as line=2,
  visualize as line=3,
  style sheet=traffic light]
data point [x=0, y=0, set=1]
data point [x=2, y=2, set=1]
data point [x=0, y=1, set=2]
data point [x=2, y=1, set=2]
data point [x=0.5, y=1.5, set=3]
data point [x=2.25, y=1.75, set=3];`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plots = result.ir.items.filter((item) => item.subtype === "axis-plot");
  const strokes = plots.map((plot) => plot.style.stroke);
  const tickTexts = result.ir.items
    .filter((item) => item.type === "textNode")
    .map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(plots.length, 3, `expected three line visualizers from data point sets, got ${plots.length}`);
  assert.deepEqual(strokes, ["rgb(0 128 0)", "rgb(230 230 0)", "rgb(204 0 0)"]);
  assert.ok(
    plots.every((plot) => plot.commands.filter((command) => Number.isFinite(command.x) && Number.isFinite(command.y)).length === 2),
    "expected each traffic-light line visualizer to use the two points assigned to its set"
  );
  const greenPoints = plots[0].commands.filter((command) => Number.isFinite(command.x) && Number.isFinite(command.y));
  assert.ok(
    Math.abs((greenPoints[1]?.x || 0) - (greenPoints[0]?.x || 0) - 2) < 0.05,
    `expected school-book axes to use native 1cm unit x scaling, got green line points ${JSON.stringify(greenPoints)}`
  );
  assert.ok(
    Math.abs((greenPoints[1]?.y || 0) - (greenPoints[0]?.y || 0) - 2) < 0.05,
    `expected school-book axes to use native 1cm unit y scaling, got green line points ${JSON.stringify(greenPoints)}`
  );
  assert.ok(!tickTexts.includes("0.25"), `expected school-book axes to avoid dense quarter ticks, got ${tickTexts.join(", ")}`);
  assert.ok(!tickTexts.includes("0.5"), `expected school-book axes to avoid dense half ticks, got ${tickTexts.join(", ")}`);
  assert.ok(!tickTexts.includes("1.75"), `expected school-book axes to avoid dense quarter ticks, got ${tickTexts.join(", ")}`);
  assert.ok(tickTexts.includes("0"), `expected school-book axes to include origin tick, got ${tickTexts.join(", ")}`);
  assert.ok(tickTexts.includes("1"), `expected school-book axes to include unit tick, got ${tickTexts.join(", ")}`);
  assert.ok(tickTexts.includes("2"), `expected school-book axes to include upper unit tick, got ${tickTexts.join(", ")}`);
});

test("supports datavisualization style sheet key handlers on data point attributes", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization}
\pgfkeys{
  /pgf/data visualization/style sheets/traffic light/.cd,
  1/.style={green!50!black},
  2/.style={yellow!90!black},
  3/.style={red!80!black},
  default style/.style={black}
}
\tikz \datavisualization [
  school book axes,
  visualize as line=1,
  visualize as line=2,
  visualize as line=3,
  /data point/set/.style sheet=traffic light]
data point [x=0, y=0, set=1]
data point [x=2, y=2, set=1]
data point [x=0, y=1, set=2]
data point [x=2, y=1, set=2]
data point [x=0.5, y=1.5, set=3]
data point [x=2.25, y=1.75, set=3];`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plots = result.ir.items.filter((item) => item.subtype === "axis-plot");
  const strokes = plots.map((plot) => plot.style.stroke);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(plots.length, 3, `expected three line visualizers from style-sheet key handler, got ${plots.length}`);
  assert.deepEqual(strokes, ["rgb(0 128 0)", "rgb(230 230 0)", "rgb(204 0 0)"]);
});

test("supports pgfdvdeclarestylesheet for datavisualization style sheets", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization}
\pgfdvdeclarestylesheet{traffic light}{
  1/.style={green!50!black},
  2/.style={yellow!90!black},
  3/.style={red!80!black},
  default style/.style={black}
}
\tikz \datavisualization [
  school book axes,
  visualize as line=1,
  visualize as line=2,
  visualize as line=3,
  style sheet=traffic light]
data point [x=0, y=0, set=1]
data point [x=2, y=2, set=1]
data point [x=0, y=1, set=2]
data point [x=2, y=1, set=2]
data point [x=0.5, y=1.5, set=3]
data point [x=2.25, y=1.75, set=3];`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plots = result.ir.items.filter((item) => item.subtype === "axis-plot");
  const strokes = plots.map((plot) => plot.style.stroke);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(plots.length, 3, `expected three line visualizers from declared stylesheet, got ${plots.length}`);
  assert.deepEqual(strokes, ["rgb(0 128 0)", "rgb(230 230 0)", "rgb(204 0 0)"]);
});

test("applies datavisualization set initial remapping before style sheet lookup", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization}
\pgfdvdeclarestylesheet{traffic light}{
  1/.style={green!50!black},
  2/.style={yellow!90!black},
  3/.style={red!80!black},
  default style/.style={black}
}
\tikz \datavisualization [
  school book axes,
  visualize as line=normal,
  visualize as line=heated,
  visualize as line=critical,
  /data point/set/critical/.initial=1,
  style sheet=traffic light]
data point [x=0, y=0, set=normal]
data point [x=2, y=2, set=normal]
data point [x=0, y=1, set=heated]
data point [x=2, y=1, set=heated]
data point [x=0.5, y=1.5, set=critical]
data point [x=2.25, y=1.75, set=critical];`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plots = result.ir.items.filter((item) => item.subtype === "axis-plot");
  const strokes = plots.map((plot) => plot.style.stroke);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(plots.length, 3, `expected three named visualizers from remapped sets, got ${plots.length}`);
  assert.deepEqual(strokes, ["rgb(0 128 0)", "rgb(230 230 0)", "rgb(0 128 0)"]);
});

test("expands datavisualization data groups containing data point streams", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization}
\pgfdvdeclarestylesheet{traffic light}{
  1/.style={green!50!black},
  2/.style={yellow!90!black},
  3/.style={red!80!black},
  default style/.style={black}
}
\begin{tikzpicture}
  \datavisualization data group {lines} = {
    data point [x=0, y=0,       set=normal]
    data point [x=2, y=2,       set=normal]
    data point [x=0, y=1,       set=heated]
    data point [x=2, y=1,       set=heated]
    data point [x=0.5, y=1.5,   set=critical]
    data point [x=2.25, y=1.75, set=critical]
  };
  \datavisualization [
    school book axes,
    visualize as line=normal,
    visualize as line=heated,
    visualize as line=critical,
    /data point/set/critical/.initial=1,
    style sheet=traffic light]
  data group {lines};
\end{tikzpicture}`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plots = result.ir.items.filter((item) => item.subtype === "axis-plot");
  const strokes = plots.map((plot) => plot.style.stroke);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(plots.length, 3, `expected three plots from data point data group, got ${plots.length}`);
  assert.deepEqual(strokes, ["rgb(0 128 0)", "rgb(230 230 0)", "rgb(0 128 0)"]);
});

test("evaluates parameterized default styles in datavisualization style sheets", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization}
\pgfdvdeclarestylesheet{my dashings}{
  default style/.style={dash pattern={on #1pt off 1pt}}
}
\tikz \datavisualization [
  school book axes,
  visualize as line=normal,
  visualize as line=heated,
  visualize as line=critical,
  style sheet=my dashings]
data point [x=0, y=0, set=normal]
data point [x=2, y=2, set=normal]
data point [x=0, y=1, set=heated]
data point [x=2, y=1, set=heated]
data point [x=0.5, y=1.5, set=critical]
data point [x=2.25, y=1.75, set=critical];`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plots = result.ir.items.filter((item) => item.subtype === "axis-plot");
  const dashArrays = plots.map((plot) => plot.style.dashArray || []);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(plots.length, 3, `expected three dashed plots from parameterized default style, got ${plots.length}`);
  assert.ok(dashArrays.every((dashArray) => dashArray.length === 2), `expected every plot to be dashed, got ${JSON.stringify(dashArrays)}`);
  assert.ok(dashArrays[0][0] < dashArrays[1][0], `expected second dash to be longer than first, got ${JSON.stringify(dashArrays)}`);
  assert.ok(dashArrays[1][0] < dashArrays[2][0], `expected third dash to be longer than second, got ${JSON.stringify(dashArrays)}`);
});

test("supports datavisualization color-series style sheet declarations", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization}
\tikzdvdeclarestylesheetcolorseries{greens}{hsb}{0.3,1.3,0.8}{0,-.4,-.1}
\tikz \datavisualization [
  school book axes,
  visualize as line=normal,
  visualize as line=heated,
  visualize as line=critical,
  style sheet=greens]
data point [x=0, y=0, set=normal]
data point [x=2, y=2, set=normal]
data point [x=0, y=1, set=heated]
data point [x=2, y=1, set=heated]
data point [x=0.5, y=1.5, set=critical]
data point [x=2.25, y=1.75, set=critical];`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plots = result.ir.items.filter((item) => item.subtype === "axis-plot");
  const strokes = plots.map((plot) => plot.style.stroke);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(plots.length, 3, `expected three line visualizers from color-series stylesheet, got ${plots.length}`);
  assert.equal(new Set(strokes).size, 3, `expected a different color-series stroke per plot, got ${strokes.join(", ")}`);
  assert.deepEqual(strokes, ["rgb(50 179 18)", "rgb(92 153 77)", "rgb(117 128 115)"]);
});

test("expands datavisualization data groups into later visualizations", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization data group {function classes} = {
  data [set=log, format=function] {
    var x : interval [0.2:2.5] samples 8;
    func y = ln(\value x);
  }
  data [set=lin, format=function] {
    var x : interval [-2:2.5] samples 8;
    func y = 0.5*\value x;
  }
  data [set=squared, format=function] {
    var x : interval [-1.5:1.5] samples 8;
    func y = \value x*\value x;
  }
  data [set=exp, format=function] {
    var x : interval [-2.5:1] samples 8;
    func y = exp(\value x);
  }
};
\tikz \datavisualization [
  school book axes, all axes={unit length=7.5mm},
  visualize as smooth line/.list={log,lin,squared,exp},
  log={label in legend={text=$\log x$}},
  lin={label in legend={text=$x/2$}},
  squared={label in legend={text=$x^2$}},
  exp={label in legend={text=$e^x$}},
  style sheet=vary dashing]
data group {function classes};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plots = result.ir.items.filter((item) => item.subtype === "axis-plot");
  const legendLabels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(plots.length, 4, `expected four plots from the named data group, got ${plots.length}`);
  assert.ok(legendLabels.includes("$\\log x$"), `expected log legend label, got ${legendLabels.join(", ")}`);
  assert.ok(legendLabels.includes("$x/2$"), `expected linear legend label, got ${legendLabels.join(", ")}`);
  assert.ok(legendLabels.includes("$x^2$"), `expected squared legend label, got ${legendLabels.join(", ")}`);
  assert.ok(legendLabels.includes("$e^x$"), `expected exp legend label, got ${legendLabels.join(", ")}`);
  assert.ok(plots.every((plot) => plot.commands.filter((command) => Number.isFinite(command.x) && Number.isFinite(command.y)).length >= 6));
});

test("expands tikzdatavisualizationset named styles inside datavisualization options", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikzdatavisualizationset{
  legend example/.style={
    scientific axes,
    all axes={length=1cm,ticks=none},
    a={label in legend={text=a}},
    b={label in legend={text=b}}
  }
}
\tikz \datavisualization [
  visualize as smooth line/.list={a,b},
  legend example,
  style sheet=strong colors,
  data/format=function]
data [set=a] { var x : interval [0:1] samples 3; func y = \value x; }
data [set=b] { var x : interval [0:1] samples 3; func y = 1-\value x; };`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const labels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  const plotFrame = result.ir.items
    .filter((item) => item.subtype === "axis-frame")
    .find((item) => item.commands?.some((command) => command.x === 1 && command.y === 1));

  assert.deepEqual(result.diagnostics, []);
  assert.ok(labels.includes("a"), `expected named style to install legend label a, got ${labels.join(", ")}`);
  assert.ok(labels.includes("b"), `expected named style to install legend label b, got ${labels.join(", ")}`);
  assert.ok(plotFrame, "expected axis plot frame from named style");
  assert.ok(plotFrame.commands[1].x - plotFrame.commands[0].x < 1.3, "expected all axes={length=1cm} from named style to shrink the plot width");
});

test("routes datavisualization entries to named legends", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization data group {function classes} = {
  data [set=log, format=function] {
    var x : interval [0.2:2.5] samples 8;
    func y = ln(\value x);
  }
  data [set=lin, format=function] {
    var x : interval [-2:2.5] samples 8;
    func y = 0.5*\value x;
  }
  data [set=squared, format=function] {
    var x : interval [-1.5:1.5] samples 8;
    func y = \value x*\value x;
  }
  data [set=exp, format=function] {
    var x : interval [-2.5:1] samples 8;
    func y = exp(\value x);
  }
};
\tikz \datavisualization [
  school book axes, all axes={unit length=7.5mm},
  visualize as smooth line/.list={log,lin,squared,exp},
  new legend={upper legend},
  new legend={lower legend},
  upper legend=above,
  lower legend=below,
  log={label in legend={text=$\log x$, legend=upper legend}},
  lin={label in legend={text=$x/2$, legend=upper legend}},
  squared={label in legend={text=$x^2$, legend=lower legend}},
  exp={label in legend={text=$e^x$, legend=lower legend}},
  style sheet=vary dashing]
data group {function classes};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const frame = result.ir.items.find((item) => item.subtype === "axis-frame");
  const frameCommands = frame?.commands || [];
  const top = Math.max(...frameCommands.filter((command) => "y" in command).map((command) => command.y));
  const bottom = Math.min(...frameCommands.filter((command) => "y" in command).map((command) => command.y));
  const labelFor = (text) => result.ir.items.find((item) => item.type === "textNode" && item.text === text);
  const upperLabels = [labelFor(String.raw`$\log x$`), labelFor(String.raw`$x/2$`)];
  const lowerLabels = [labelFor(String.raw`$x^2$`), labelFor(String.raw`$e^x$`)];
  const upperYs = upperLabels.map((label) => label?.y || 0);
  const lowerYs = lowerLabels.map((label) => label?.y || 0);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(upperLabels.every(Boolean), "expected both upper legend labels");
  assert.ok(lowerLabels.every(Boolean), "expected both lower legend labels");
  assert.ok(upperLabels.every((label) => label.y > top + 0.12), `expected upper legend labels above frame top ${top}, got ${upperYs.join(", ")}`);
  assert.ok(lowerLabels.every((label) => label.y < bottom - 0.12), `expected lower legend labels below frame bottom ${bottom}, got ${lowerYs.join(", ")}`);
  assert.ok(Math.max(...upperYs) - Math.min(...upperYs) < 0.08, `expected upper named legend to have its own row layout, got ${upperYs.join(", ")}`);
  assert.ok(Math.max(...lowerYs) - Math.min(...lowerYs) < 0.08, `expected lower named legend to have its own row layout, got ${lowerYs.join(", ")}`);
  assert.ok(
    Math.abs(Math.min(...upperYs) - top - 0.43) < 0.08,
    `expected upper named legend baseline near tikztosvg .8em north-outside offset, top=${top}, got ${upperYs.join(", ")}`
  );
  assert.ok(
    Math.abs(bottom - Math.max(...lowerYs) - 0.6) < 0.1,
    `expected lower named legend baseline near tikztosvg south-outside matrix offset, bottom=${bottom}, got ${lowerYs.join(", ")}`
  );
});

test("places datavisualization below legends using requested row count", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\begin{tikzpicture}[baseline]
  \datavisualization [ scientific axes=clean,
                       visualize as smooth line/.list={sin,cos,sin 2,cos 2},
                       legend={below, rows=2},
                       style sheet=strong colors,
                       sin={label in legend={text=$\sin x$}},
                       cos={label in legend={text=$\cos x$}},
                       sin 2={label in legend={text=$\sin 2x$}},
                       cos 2={label in legend={text=$\cos 2x$}},
                       data/format=function ]
  data [set=sin] {
    var x : interval [-0.5*pi:4] samples 9;
    func y = sin(\value x r);
  }
  data [set=cos] {
    var x : interval [-0.5*pi:4] samples 9;
    func y = cos(\value x r);
  }
  data [set=sin 2] {
    var x : interval [-0.5*pi:4] samples 9;
    func y = sin(2*\value x r);
  }
  data [set=cos 2] {
    var x : interval [-0.5*pi:4] samples 9;
    func y = cos(2*\value x r);
  };
\end{tikzpicture}`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const frame = result.ir.items.find((item) => item.subtype === "axis-frame");
  const frameCommands = frame?.commands || [];
  const left = Math.min(...(frameCommands.filter((command) => "x" in command).map((command) => command.x) || [0]));
  const frameBottom = Math.min(...(frameCommands.filter((command) => "y" in command).map((command) => command.y) || [0]));
  const labels = [String.raw`$\sin x$`, String.raw`$\cos x$`, String.raw`$\sin 2x$`, String.raw`$\cos 2x$`].map((text) =>
    result.ir.items.find((item) => item.type === "textNode" && item.text === text)
  );
  const legendExamples = result.ir.items.filter((item) => item.subtype === "axis-legend-example");
  const yTickTexts = result.ir.items
    .filter((item) => item.type === "textNode" && item.style?.fontScale === 0.8 && item.x < left - 0.05)
    .map((item) => item.text);
  const xTickY = Math.min(
    ...result.ir.items
      .filter((item) => item.type === "textNode" && item.style?.fontScale === 0.8 && item.y < frameBottom && /^[−\-\d.]+$/.test(item.text))
      .map((item) => item.y)
  );
  const rowCenters = [...new Set(labels.map((label) => Math.round((label?.y || 0) * 10) / 10))];
  const xs = labels.map((label) => label?.x || 0);
  const legendBounds = legendExamples.map((item) => {
    const commandXs = item.commands.filter((command) => "x" in command).map((command) => command.x);
    const commandYs = item.commands.filter((command) => "y" in command).map((command) => command.y);
    return {
      minX: Math.min(...commandXs),
      maxX: Math.max(...commandXs),
      midY: (Math.min(...commandYs) + Math.max(...commandYs)) / 2
    };
  });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(legendExamples.length, 4);
  assert.ok(labels.every(Boolean), "expected all four legend labels");
  assert.ok(labels.every((label) => label.y < frameBottom - 0.15), "expected legend labels below the plot frame");
  assert.ok(labels.every((label) => label.y < xTickY - 0.25), "expected below legend labels to clear x tick labels like native TikZ");
  assert.equal(rowCenters.length, 2, `expected legend={rows=2} to produce two visual rows, got ${rowCenters.join(", ")}`);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 1.8, "expected below legend to use multiple horizontal columns");
  assert.ok(Math.abs(legendBounds[0].minX - 0.21) < 0.04, `expected first below legend sample to start near native x=0.21cm, got ${legendBounds[0].minX}`);
  assert.ok(Math.abs(legendBounds[0].maxX - 0.92) < 0.04, `expected first below legend sample to end near native x=0.92cm, got ${legendBounds[0].maxX}`);
  assert.ok(Math.abs(legendBounds[2].minX - 2.06) < 0.04, `expected second below legend column to start near native x=2.06cm, got ${legendBounds[2].minX}`);
  assert.ok(Math.abs(legendBounds[2].maxX - 2.76) < 0.04, `expected second below legend column to end near native x=2.76cm, got ${legendBounds[2].maxX}`);
  assert.ok(Math.abs(legendBounds[0].midY + 1.08) < 0.04, `expected first below legend row near native y=-1.08cm, got ${legendBounds[0].midY}`);
  assert.ok(Math.abs(legendBounds[1].midY + 1.47) < 0.04, `expected second below legend row near native y=-1.47cm, got ${legendBounds[1].midY}`);
  assert.ok(yTickTexts.includes("0.25"), "expected native scientific axes to add quarter y ticks for the default -1:1 range");
  assert.ok(yTickTexts.includes("−0.75"), "expected native scientific axes to add negative quarter y ticks for the default -1:1 range");
});

test("places datavisualization north outside legends above the data frame", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  visualize as smooth line/.list={a,b,c},
  legend=north outside,
  a={label in legend={text=$a$}},
  b={label in legend={text=$b$}},
  c={label in legend={text=$c$}},
  data/format=function]
data [set=a] {
  var x : interval [0:1] samples 3;
  func y = \value x;
}
data [set=b] {
  var x : interval [0:1] samples 3;
  func y = 0.5*\value x;
}
data [set=c] {
  var x : interval [0:1] samples 3;
  func y = 0.25*\value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const frame = result.ir.items.find((item) => item.subtype === "axis-frame");
  const top = Math.max(...(frame?.commands || []).filter((command) => "y" in command).map((command) => command.y));
  const labels = [String.raw`$a$`, String.raw`$b$`, String.raw`$c$`].map((text) =>
    result.ir.items.find((item) => item.type === "textNode" && item.text === text)
  );
  const labelYs = labels.map((label) => label?.y || 0);
  const labelXs = labels.map((label) => label?.x || 0);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(labels.every(Boolean), "expected all three north-outside legend labels");
  assert.ok(labels.every((label) => label.y > top + 0.15), `expected north outside labels above frame top ${top}, got ${labelYs.join(", ")}`);
  assert.ok(Math.max(...labelYs) - Math.min(...labelYs) < 0.08, `expected north outside default rows=1 to use one visual row, got ${labelYs.join(", ")}`);
  assert.ok(Math.max(...labelXs) - Math.min(...labelXs) > 1.2, `expected north outside legend entries to spread into columns, got ${labelXs.join(", ")}`);
});

test("aligns datavisualization east corner outside legends to data frame top and bottom", () => {
  const render = (placement) =>
    tikzToSvg(
      String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  visualize as smooth line/.list={a,b,c},
  legend=${placement},
  a={label in legend={text=a}},
  b={label in legend={text=b}},
  c={label in legend={text=c}},
  data/format=function]
data [set=a] { var x : interval [0:1] samples 3; func y = \value x; }
data [set=b] { var x : interval [0:1] samples 3; func y = 0.5*\value x; }
data [set=c] { var x : interval [0:1] samples 3; func y = 0.25*\value x; };`,
      { mathRenderer: "svg-text" }
    );
  const frameBounds = (result) => {
    const frame = result.ir.items.find((item) => item.subtype === "axis-frame");
    const xs = (frame?.commands || []).filter((command) => "x" in command).map((command) => command.x);
    const ys = (frame?.commands || []).filter((command) => "y" in command).map((command) => command.y);
    return { right: Math.max(...xs), top: Math.max(...ys), bottom: Math.min(...ys) };
  };
  const labelsFor = (result) =>
    ["a", "b", "c"].map((text) => result.ir.items.find((item) => item.type === "textNode" && item.text === text));

  const northEast = render("north east outside");
  const southEast = render("south east outside");
  const northBounds = frameBounds(northEast);
  const southBounds = frameBounds(southEast);
  const northLabels = labelsFor(northEast);
  const southLabels = labelsFor(southEast);

  assert.deepEqual(northEast.diagnostics, []);
  assert.deepEqual(southEast.diagnostics, []);
  assert.ok(northLabels.every(Boolean), "expected all north-east legend labels");
  assert.ok(southLabels.every(Boolean), "expected all south-east legend labels");
  assert.ok(northLabels.every((label) => label.x > northBounds.right + 0.2), "expected north-east legend to sit to the right of the data frame");
  assert.ok(southLabels.every((label) => label.x > southBounds.right + 0.2), "expected south-east legend to sit to the right of the data frame");
  assert.ok(northLabels[0].y > northBounds.top - 0.15, `expected north-east legend to start near frame top ${northBounds.top}, got ${northLabels[0].y}`);
  assert.ok(southLabels.at(-1).y < southBounds.bottom + 0.35, `expected south-east legend to end near frame bottom ${southBounds.bottom}, got ${southLabels.at(-1).y}`);
  assert.ok(northLabels[0].y > southLabels[0].y + 1.2, `expected north-east legend to be vertically above south-east legend, got ${northLabels[0].y} vs ${southLabels[0].y}`);
});

test("lays out datavisualization east-outside legends using right-then-down columns", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  all axes={length=2cm},
  visualize as smooth line/.list={a,b,c,d},
  legend={right then down, columns=2},
  style sheet=strong colors,
  a={label in legend={text=a}},
  b={label in legend={text=b}},
  c={label in legend={text=c}},
  d={label in legend={text=d}},
  data/format=function]
data [set=a] { var x : interval [0:1] samples 3; func y = .1*\value x; }
data [set=b] { var x : interval [0:1] samples 3; func y = .2*\value x; }
data [set=c] { var x : interval [0:1] samples 3; func y = .3*\value x; }
data [set=d] { var x : interval [0:1] samples 3; func y = .4*\value x; };`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const labels = Object.fromEntries(
    ["a", "b", "c", "d"].map((text) => [text, result.ir.items.find((item) => item.type === "textNode" && item.text === text)])
  );

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Object.values(labels).every(Boolean), `expected all legend labels, got ${Object.values(labels).map((label) => label?.text).join(", ")}`);
  assert.ok(Math.abs(labels.a.y - labels.b.y) < 0.04, `expected a and b in the first matrix row, got y=${labels.a.y}, ${labels.b.y}`);
  assert.ok(Math.abs(labels.c.y - labels.d.y) < 0.04, `expected c and d in the second matrix row, got y=${labels.c.y}, ${labels.d.y}`);
  assert.ok(labels.a.y > labels.c.y + 0.08, `expected first row above second row, got y=${labels.a.y}, ${labels.c.y}`);
  assert.ok(Math.abs(labels.a.y - 0.975) < 0.04, `expected native matrix first row near 0.975cm, got y=${labels.a.y}`);
  assert.ok(Math.abs(labels.c.y - 0.588) < 0.04, `expected native matrix second row near 0.588cm, got y=${labels.c.y}`);
  assert.ok(labels.b.x > labels.a.x + 0.45, `expected b to be in a second legend column, got x=${labels.a.x}, ${labels.b.x}`);
  assert.ok(
    labels.b.x > labels.a.x + 1.3,
    `expected matrix column spacing to include TeX legend entry width plus .8em column sep, got x=${labels.a.x}, ${labels.b.x}`
  );
  assert.ok(Math.abs(labels.a.x - labels.c.x) < 0.08, `expected a and c in the first legend column, got x=${labels.a.x}, ${labels.c.x}`);
  assert.ok(Math.abs(labels.b.x - labels.d.x) < 0.08, `expected b and d in the second legend column, got x=${labels.b.x}, ${labels.d.x}`);
  const tickTexts = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  assert.ok(tickTexts.includes("0.1"), `expected compact 0..0.4 clean y axis to include native 0.1 tick, got ${tickTexts.join(", ")}`);
  assert.ok(tickTexts.includes("0.3"), `expected compact 0..0.4 clean y axis to include native 0.3 tick, got ${tickTexts.join(", ")}`);
});

test("limits datavisualization east-outside legends with max columns", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  all axes={length=2cm},
  visualize as smooth line/.list={a,b,c,d,e},
  legend={right then down, max columns=2},
  style sheet=strong colors,
  a={label in legend={text=a}},
  b={label in legend={text=b}},
  c={label in legend={text=c}},
  d={label in legend={text=d}},
  e={label in legend={text=e}},
  data/format=function]
data [set=a] { var x : interval [0:1] samples 3; func y = .1*\value x; }
data [set=b] { var x : interval [0:1] samples 3; func y = .2*\value x; }
data [set=c] { var x : interval [0:1] samples 3; func y = .3*\value x; }
data [set=d] { var x : interval [0:1] samples 3; func y = .4*\value x; }
data [set=e] { var x : interval [0:1] samples 3; func y = .5*\value x; };`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const labels = Object.fromEntries(
    ["a", "b", "c", "d", "e"].map((text) => [text, result.ir.items.find((item) => item.type === "textNode" && item.text === text)])
  );

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Object.values(labels).every(Boolean), `expected all legend labels, got ${Object.values(labels).map((label) => label?.text).join(", ")}`);
  assert.ok(Math.abs(labels.a.y - labels.b.y) < 0.04, `expected a and b in the first matrix row, got y=${labels.a.y}, ${labels.b.y}`);
  assert.ok(Math.abs(labels.c.y - labels.d.y) < 0.04, `expected c and d in the second matrix row, got y=${labels.c.y}, ${labels.d.y}`);
  assert.ok(labels.e.y < labels.c.y - 0.08, `expected e to wrap into a third row, got c=${labels.c.y}, e=${labels.e.y}`);
  assert.ok(Math.abs(labels.a.y - 1.168) < 0.04, `expected native max-columns first row near 1.168cm, got y=${labels.a.y}`);
  assert.ok(Math.abs(labels.c.y - 0.782) < 0.04, `expected native max-columns second row near 0.782cm, got y=${labels.c.y}`);
  assert.ok(Math.abs(labels.e.y - 0.395) < 0.04, `expected native max-columns third row near 0.395cm, got y=${labels.e.y}`);
  assert.ok(labels.b.x > labels.a.x + 0.45, `expected max columns=2 to keep b in a second column, got x=${labels.a.x}, ${labels.b.x}`);
  assert.ok(
    labels.b.x > labels.a.x + 1.3,
    `expected max-column matrix spacing to include TeX legend entry width plus .8em column sep, got x=${labels.a.x}, ${labels.b.x}`
  );
  assert.ok(Math.abs(labels.a.x - labels.c.x) < 0.08, `expected a and c in first column, got x=${labels.a.x}, ${labels.c.x}`);
  assert.ok(Math.abs(labels.b.x - labels.d.x) < 0.08, `expected b and d in second column, got x=${labels.b.x}, ${labels.d.x}`);
  assert.ok(Math.abs(labels.e.x - labels.a.x) < 0.08, `expected e to wrap back to first column, got x=${labels.e.x}, ${labels.a.x}`);
  const tickTexts = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  assert.ok(tickTexts.includes("0.1"), `expected compact 0..0.5 clean y axis to include native 0.1 tick, got ${tickTexts.join(", ")}`);
  assert.ok(tickTexts.includes("0.5"), `expected compact 0..0.5 clean y axis to include native 0.5 tick, got ${tickTexts.join(", ")}`);
});

test("honors datavisualization main legend max rows layout", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  all axes={length=2cm},
  visualize as smooth line/.list={a,b,c,d,e},
  main legend={max rows=2},
  style sheet=strong colors,
  a={label in legend={text=a}},
  b={label in legend={text=b}},
  c={label in legend={text=c}},
  d={label in legend={text=d}},
  e={label in legend={text=e}},
  data/format=function]
data [set=a] { var x : interval [0:1] samples 3; func y = .1*\value x; }
data [set=b] { var x : interval [0:1] samples 3; func y = .2*\value x; }
data [set=c] { var x : interval [0:1] samples 3; func y = .3*\value x; }
data [set=d] { var x : interval [0:1] samples 3; func y = .4*\value x; }
data [set=e] { var x : interval [0:1] samples 3; func y = .5*\value x; };`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const labels = Object.fromEntries(
    ["a", "b", "c", "d", "e"].map((text) => [text, result.ir.items.find((item) => item.type === "textNode" && item.text === text)])
  );

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Object.values(labels).every(Boolean), `expected all legend labels, got ${Object.values(labels).map((label) => label?.text).join(", ")}`);
  assert.ok(Math.abs(labels.a.x - labels.b.x) < 0.08, `expected a and b in the first legend column, got x=${labels.a.x}, ${labels.b.x}`);
  assert.ok(Math.abs(labels.c.x - labels.d.x) < 0.08, `expected c and d in the second legend column, got x=${labels.c.x}, ${labels.d.x}`);
  assert.ok(labels.c.x > labels.a.x + 1.3, `expected c to start a second legend column after max rows=2, got x=${labels.a.x}, ${labels.c.x}`);
  assert.ok(labels.e.x > labels.c.x + 1.3, `expected e to start a third legend column after max rows=2, got x=${labels.c.x}, ${labels.e.x}`);
  assert.ok(labels.a.y > labels.b.y + 0.08, `expected down-then-right fill in first column, got y=${labels.a.y}, ${labels.b.y}`);
  assert.ok(Math.abs(labels.a.y - 0.975) < 0.04, `expected native max-rows first row near 0.975cm, got y=${labels.a.y}`);
  assert.ok(Math.abs(labels.b.y - 0.588) < 0.04, `expected native max-rows second row near 0.588cm, got y=${labels.b.y}`);
  assert.ok(Math.abs(labels.a.y - labels.c.y) < 0.04, `expected a and c on the first visual row, got y=${labels.a.y}, ${labels.c.y}`);
  assert.ok(Math.abs(labels.b.y - labels.d.y) < 0.04, `expected b and d on the second visual row, got y=${labels.b.y}, ${labels.d.y}`);
  assert.ok(Math.abs(labels.e.y - labels.a.y) < 0.04, `expected e to return to the first visual row, got y=${labels.e.y}, ${labels.a.y}`);
});

test("maps Cartesian datavisualization axes to configured point attributes", () => {
  const source = String.raw`
\usetikzlibrary { datavisualization.formats.functions }
\tikz[baseline] \datavisualization [
  scientific axes={clean},
  x axis={attribute=angle, ticks={minor steps between steps=4}},
  y axis={attribute=radius, ticks={some, style=red!80!black}},
  all axes=grid,
  visualize as line=curve]
data [format=function] {
  var t : interval [-3:3] samples 3;
  func angle = exp(\value t);
  func radius = \value{t}*\value{t};
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plot = result.ir.items.find((item) => item.subtype === "axis-plot");
  const coordinates = (plot?.commands || [])
    .filter((command) => Number.isFinite(command.x) && Number.isFinite(command.y))
    .map((command) => ({ x: command.x, y: command.y }));

  assert.deepEqual(result.diagnostics, []);
  assert.equal(coordinates.length, 3);
  assert.ok(coordinates[0].y > 2.9, `expected first point to use radius=(-3)^2 and map near the top of the y axis, got y=${coordinates[0].y}`);
  assert.ok(coordinates[1].y < 0.1, `expected middle point to use radius=0 and map near the bottom of the y axis, got y=${coordinates[1].y}`);
  assert.ok(coordinates[2].y > 2.9, `expected last point to use radius=9 and map near the top of the y axis, got y=${coordinates[2].y}`);
  assert.ok(coordinates[1].x > 0.15 && coordinates[1].x < 0.35, `expected angle=exp(0) to map near the left of the exponential x range, got x=${coordinates[1].x}`);
  const tickLabels = result.ir.items
    .filter((item) => item.type === "textNode" && item.style?.fontScale === 0.8)
    .map((item) => item.text);
  assert.ok(tickLabels.includes("20"), `expected mapped x axis to use native positive major ticks through 20, got ${tickLabels.join(",")}`);
  assert.equal(tickLabels.includes("−5"), false, `expected mapped x axis not to reuse generic negative ticks, got ${tickLabels.join(",")}`);
  const verticalGridLines = result.ir.items.filter((item) => {
    if (item.subtype !== "axis-grid-line" && item.subtype !== "axis-minor-grid-line") return false;
    const xs = item.commands.filter((command) => Number.isFinite(command.x)).map((command) => command.x);
    return xs.length >= 2 && Math.abs(xs[0] - xs.at(-1)) < 1e-6;
  });
  assert.ok(verticalGridLines.length >= 18, `expected minor steps between major x ticks to add dense vertical grid lines, got ${verticalGridLines.length}`);
  const yTickLabels = result.ir.items.filter(
    (item) => item.type === "textNode" && item.style?.fontScale === 0.8 && item.x < -0.25 && /^(?:0|2|4|6|8)$/.test(item.text)
  );
  assert.ok(yTickLabels.length >= 5, "expected y tick labels for 0,2,4,6,8");
  assert.ok(
    yTickLabels.every((item) => item.style.fill === "rgb(204 0 0)"),
    `expected y axis tick style red!80!black to color tick labels, got ${yTickLabels.map((item) => item.style.fill).join(",")}`
  );
});

test("uses global straight default label in legend path for datavisualization line legends", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization}
\tikz \datavisualization [
  school book axes,
  visualize as line/.list={a,b},
  legend entry options/default label in legend path/.style=straight label in legend line,
  style sheet=vary dashing,
  a={label in legend={text=a}},
  b={label in legend={text=b}}]
data point [x=-1, y=-1, set=a] data point [x=1, y=0, set=a]
data point [x=-1, y=1, set=b] data point [x=1, y=0.5, set=b];`;

  const expanded = preprocessTikzSource(source).source;
  const legendExamples = expanded.split("\n").filter((line) => line.includes("axis legend example"));
  const legendSegments = legendExamples.map((line) => {
    const match = line.match(/\(([-\d.]+),([-\d.]+)\)\s+--\s+\(([-\d.]+),([-\d.]+)\)/);
    return match
      ? {
          x0: Number(match[1]),
          y0: Number(match[2]),
          x1: Number(match[3]),
          y1: Number(match[4])
        }
      : null;
  });

  assert.equal(legendExamples.length, 2, `expected two legend line examples, got ${legendExamples.join("\n")}`);
  assert.ok(
    legendExamples.every((line) => line.includes(" -- ") && !line.includes(".. controls")),
    `expected global default label in legend path to use straight samples, got:\n${legendExamples.join("\n")}`
  );
  assert.ok(legendSegments.every(Boolean), `expected straight legend segments, got:\n${legendExamples.join("\n")}`);
  assert.ok(Math.abs(legendSegments[0].x0 - 2.68) < 0.04, `expected school-book straight legend to start right of the arrow like tikztosvg, got ${legendSegments[0].x0}`);
  assert.ok(Math.abs(legendSegments[0].x1 - 3.38) < 0.04, `expected school-book straight legend sample width to match native 2em, got ${legendSegments[0].x1}`);
  assert.ok(Math.abs(legendSegments[0].y0 - 1.19) < 0.04, `expected first school-book legend row near tikztosvg y=1.19cm, got ${legendSegments[0].y0}`);
  assert.ok(Math.abs(legendSegments[1].y0 - 0.8) < 0.04, `expected second school-book legend row near tikztosvg y=0.80cm, got ${legendSegments[1].y0}`);
});

test("renders manual datavisualization new legend entries with custom legend visualizers", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization}
\tikz \datavisualization [
  school book axes, visualize as line/.list={a,b},
  style sheet=vary dashing,
  a={label in legend={text=a}},
  new legend entry={
    text=spacer,
    visualizer in legend={\draw[solid] (0,0) circle[radius=2pt];}
  },
  b={label in legend={text=b}}]
data point [x=-1, y=-1, set=a]   data point [x=1, y=0, set=a]
data point [x=-1, y=1,  set=b]   data point [x=1, y=0.5, set=b];`;

  const expanded = preprocessTikzSource(source).source;
  const labels = Object.fromEntries(
    ["a", "spacer", "b"].map((text) => {
      const match = expanded.match(new RegExp(`\\\\node\\[axis legend, anchor=west[^\\]]*\\]\\s+at\\s+\\(([-\\d.]+),([-\\d.]+)\\)\\s+\\{${text}\\}`));
      return [text, match ? { x: Number(match[1]), y: Number(match[2]) } : null];
    })
  );
  const customGlyph = expanded.match(/\\draw\[axis legend example,solid[^\]]*\]\s+\(([-\d.]+),([-\d.]+)\)\s+circle\[radius=2pt\]/);

  assert.ok(labels.a, "expected automatic first legend entry");
  assert.ok(labels.spacer, "expected manual new legend entry label");
  assert.ok(labels.b, "expected automatic second legend entry after manual entry");
  assert.ok(customGlyph, "expected manual visualizer in legend circle glyph");
  assert.ok(labels.a.y > labels.spacer.y && labels.spacer.y > labels.b.y, `expected spacer entry between a and b, got ${JSON.stringify(labels)}`);
  assert.ok(Math.abs(labels.spacer.x - labels.a.x) < 0.08, `expected manual entry label to share legend text column, got ${labels.a.x}, ${labels.spacer.x}`);
});

test("places datavisualization inside legends within the data frame", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization data group {function classes} = {
  data [set=log] {
    var x : interval [0.01:3];
    func y = ln(\value x);
  }
  data [set=lin] {
    var x : interval [0:3];
    func y = \value x;
  }
  data [set=squared] {
    var x : interval [0:3];
    func y = \value x * \value x;
  }
  data [set=exp] {
    var x : interval [0:3];
    func y = exp(\value x);
  }
};

\tikz \datavisualization [
  scientific axes,
  visualize as smooth line/.list=
    {log, lin, squared, exp},
  legend={south east inside, rows=2, label style=text only},
  log=    {label in legend={text=$\log x$}},
  lin=    {label in legend={text=$x/2$}},
  squared={label in legend={text=$x^2$}},
  exp=    {label in legend={text=$e^x$}},
  style sheet=strong colors]
data group {function classes};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const frame = result.ir.items.find((item) => item.subtype === "axis-frame");
  const frameXs = frame?.commands.filter((command) => "x" in command).map((command) => command.x) || [];
  const frameYs = frame?.commands.filter((command) => "y" in command).map((command) => command.y) || [];
  const left = Math.min(...frameXs);
  const right = Math.max(...frameXs);
  const bottom = Math.min(...frameYs);
  const top = Math.max(...frameYs);
  const labels = [String.raw`$\log x$`, String.raw`$x/2$`, String.raw`$x^2$`, String.raw`$e^x$`].map((text) =>
    result.ir.items.find((item) => item.type === "textNode" && item.text === text)
  );
  const examples = result.ir.items.filter((item) => item.subtype === "axis-legend-example");
  const legendBackgrounds = result.ir.items.filter((item) => item.type === "nodeBox" && item.subtype === "axis-legend-background");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(labels.every(Boolean), "expected all inside legend labels");
  assert.equal(examples.length, 0, "expected label style=text only to suppress visualizer samples");
  assert.equal(legendBackgrounds.length, 1, "expected inside text-only legend to use one opaque legend matrix background");
  assert.ok(legendBackgrounds[0].width > 1.1, `expected matrix background to cover both legend columns, got ${legendBackgrounds[0].width}`);
  assert.ok(legendBackgrounds[0].height > 0.45, `expected matrix background to cover both legend rows, got ${legendBackgrounds[0].height}`);
  assert.ok(labels.every((label) => label.x > left && label.x < right), "expected inside legend labels to be horizontally inside the frame");
  assert.ok(labels.every((label) => label.y > bottom && label.y < top), "expected inside legend labels to be vertically inside the frame");
  assert.ok(labels.every((label) => label.style?.fontScale <= 0.8), "expected inside legend labels to use footnotesize or smaller text");
  assert.ok(new Set(labels.map((label) => label.style?.fill || label.style?.stroke).filter(Boolean)).size > 1, "expected text-only inside legend labels to inherit visualizer colors");
  const topLegendY = Math.max(labels[0].y, labels[2].y);
  const bottomLegendY = Math.max(labels[1].y, labels[3].y);
  const legendRowGap = topLegendY - bottomLegendY;
  assert.ok(topLegendY > 0.55 && topLegendY < 0.62, `expected native text-only inside top row near 0.58cm, got ${topLegendY}`);
  assert.ok(bottomLegendY > 0.20 && bottomLegendY < 0.27, `expected native text-only inside bottom row near 0.23cm, got ${bottomLegendY}`);
  assert.ok(legendRowGap > 0.33 && legendRowGap < 0.38, `expected native text-only inside row gap near 0.35cm, got ${legendRowGap}`);
  assert.ok(
    legendBackgrounds[0].y > 0.44 && legendBackgrounds[0].y < 0.54,
    `expected text-only legend background center near native y=0.49cm, got ${legendBackgrounds[0].y}`
  );
  assert.ok(
    legendBackgrounds[0].height > 0.78 && legendBackgrounds[0].height < 0.88,
    `expected text-only legend background height near native 0.82cm, got ${legendBackgrounds[0].height}`
  );
  assert.ok(
    legendBackgrounds[0].x > 4.12 && legendBackgrounds[0].x < 4.19,
    `expected text-only legend background center x near native 4.15cm, got ${legendBackgrounds[0].x}`
  );
  assert.ok(
    legendBackgrounds[0].width > 1.24 && legendBackgrounds[0].width < 1.34,
    `expected text-only legend background width near native 1.30cm, got ${legendBackgrounds[0].width}`
  );
});

test("renders datavisualization legend matrix node style background", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes,
  visualize as smooth line/.list={log, lin},
  legend={matrix node style={fill=black!25}},
  log={label in legend={text=$\log x$}},
  lin={label in legend={text=$x/2$}},
  style sheet=vary dashing,
  data/format=function]
data [set=log] {
  var x : interval [0.2:2.5] samples 8;
  func y = ln(\value x);
}
data [set=lin] {
  var x : interval [-2:2.5] samples 8;
  func y = 0.5*\value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const labels = [String.raw`$\log x$`, String.raw`$x/2$`].map((text) =>
    result.ir.items.find((item) => item.type === "textNode" && item.text === text)
  );
  const legendBackgrounds = result.ir.items.filter((item) => item.type === "nodeBox" && item.subtype === "axis-legend-background");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(labels.every(Boolean), "expected legend labels before checking the matrix background");
  assert.equal(legendBackgrounds.length, 1, "expected legend matrix node style to create one background node");
  assert.equal(legendBackgrounds[0].style.fill, "rgb(191 191 191)");
  assert.ok(
    legendBackgrounds[0].width > 1.72 && legendBackgrounds[0].width < 1.85,
    `expected background width near local tikztosvg 50.5pt/1.78cm, got ${legendBackgrounds[0].width}`
  );
  assert.ok(legendBackgrounds[0].height > 0.5, `expected background height to cover both legend rows, got ${legendBackgrounds[0].height}`);
  assert.ok(labels.every((label) => label.x > legendBackgrounds[0].x), "expected east-outside legend text inside the matrix background");
});

test("honors datavisualization inside legend opaque and transparent styles", () => {
  const render = (legendOptions) =>
    tikzToSvg(String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  visualize as smooth line/.list={log, lin},
  legend={south east inside, label style=text only, ${legendOptions}},
  log={label in legend={text=$\log x$}},
  lin={label in legend={text=$x/2$}},
  style sheet=strong colors,
  data/format=function]
data [set=log] {
  var x : interval [0.2:2.5] samples 8;
  func y = ln(\value x);
}
data [set=lin] {
  var x : interval [-2:2.5] samples 8;
  func y = 0.5*\value x;
};`, { mathRenderer: "svg-text" });

  const opaque = render("opaque=yellow!30");
  const transparent = render("transparent");
  const opaqueBackground = opaque.ir.items.find((item) => item.type === "nodeBox" && item.subtype === "axis-legend-background");
  const transparentBackgrounds = transparent.ir.items.filter((item) => item.type === "nodeBox" && item.subtype === "axis-legend-background");
  const transparentLabels = [String.raw`$\log x$`, String.raw`$x/2$`].map((text) =>
    transparent.ir.items.find((item) => item.type === "textNode" && item.text === text)
  );

  assert.deepEqual(opaque.diagnostics, []);
  assert.deepEqual(transparent.diagnostics, []);
  assert.ok(opaqueBackground, "expected opaque inside legend to render a matrix background");
  assert.equal(opaqueBackground.style.fill, "rgb(255 255 179)");
  assert.ok(transparentLabels.every(Boolean), "expected transparent inside legend to keep labels");
  assert.ok(
    transparentBackgrounds.every((background) => background.style.fill === "none"),
    `expected transparent legend not to render a white matrix fill, got ${transparentBackgrounds.map((background) => background.style.fill).join(", ")}`
  );
});

test("uses native half-step y ticks for non-clean scientific axes with negative logarithmic range", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes,
  visualize as smooth line/.list={log, lin},
  legend={matrix node style={fill=black!25}},
  log={label in legend={text=$\log x$}},
  lin={label in legend={text=$x/2$}},
  style sheet=vary dashing,
  data/format=function]
data [set=log] {
  var x : interval [0.2:2.5] samples 8;
  func y = ln(\value x);
}
data [set=lin] {
  var x : interval [-2:2.5] samples 8;
  func y = 0.5*\value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const visibleFrame = result.ir.items.find((item) => item.subtype === "axis-frame" && item.style?.stroke && item.style.stroke !== "none");
  const left = Math.min(...(visibleFrame?.commands.filter((command) => "x" in command).map((command) => command.x) || []));
  const yTickTexts = result.ir.items
    .filter((item) => item.type === "textNode" && item.style?.fontScale === 0.8 && item.x < left - 0.05)
    .map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(yTickTexts.includes("−1.5"), `expected lower native half-step y tick −1.5, got ${yTickTexts.join(", ")}`);
  assert.ok(yTickTexts.includes("−0.5"), `expected negative half-step y tick −0.5, got ${yTickTexts.join(", ")}`);
  assert.ok(yTickTexts.includes("0.5"), `expected positive half-step y tick 0.5, got ${yTickTexts.join(", ")}`);
  assert.ok(yTickTexts.includes("1"), `expected upper integer y tick 1, got ${yTickTexts.join(", ")}`);
});

test("keeps non-clean datavisualization hidden bounds tight to visible boxed axes", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes,
  visualize as smooth line/.list={log, lin},
  legend={matrix node style={fill=black!25}},
  log={label in legend={text=$\log x$}},
  lin={label in legend={text=$x/2$}},
  style sheet=vary dashing,
  data/format=function]
data [set=log] {
  var x : interval [0.2:2.5] samples 8;
  func y = ln(\value x);
}
data [set=lin] {
  var x : interval [-2:2.5] samples 8;
  func y = 0.5*\value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const invisibleBounds = result.ir.items.find((item) => item.subtype === "axis-frame" && item.style?.stroke === "none" && item.style?.fill === "none");
  const visibleFrame = result.ir.items.find((item) => item.subtype === "axis-frame" && item.style?.stroke && item.style.stroke !== "none");
  const boundsYs = invisibleBounds?.commands.filter((command) => "y" in command).map((command) => command.y) || [];
  const frameYs = visibleFrame?.commands.filter((command) => "y" in command).map((command) => command.y) || [];

  assert.deepEqual(result.diagnostics, []);
  assert.ok(invisibleBounds, "expected invisible axis bounds path");
  assert.ok(visibleFrame, "expected visible non-clean scientific frame");
  assert.ok(Math.min(...frameYs) - Math.min(...boundsYs) <= 0.12, `expected lower hidden bounds not to add PGFPlots-scale padding, got ${Math.min(...boundsYs)}`);
  assert.ok(Math.max(...boundsYs) - Math.max(...frameYs) <= 0.12, `expected upper hidden bounds not to add PGFPlots-scale padding, got ${Math.max(...boundsYs)}`);
});

test("renders non-clean scientific datavisualization axes as a boxed frame", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes,
  visualize as smooth line=line,
  line={label in legend={text=$x$}},
  data/format=function]
data {
  var x : interval [0:3] samples 4;
  func y = \value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const axisLines = result.ir.items.filter((item) => item.subtype === "axis-line");
  const visibleFrames = result.ir.items.filter((item) => item.subtype === "axis-frame" && item.style?.stroke && item.style.stroke !== "none");
  const visibleFrame = visibleFrames[0];
  const frameXs = visibleFrame?.commands.filter((command) => "x" in command).map((command) => command.x) || [];
  const frameYs = visibleFrame?.commands.filter((command) => "y" in command).map((command) => command.y) || [];
  const right = Math.max(...frameXs);
  const top = Math.max(...frameYs);
  const ticks = result.ir.items.filter((item) => item.subtype === "axis-tick");
  const topTicks = ticks.filter((tick) => Math.abs(tick.commands[0]?.y - top) < 0.01 && tick.commands[1]?.y > top);
  const rightTicks = ticks.filter((tick) => Math.abs(tick.commands[0]?.x - right) < 0.01 && tick.commands[1]?.x > right);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(axisLines.length, 0, "expected non-clean scientific axes to avoid middle-axis arrow lines");
  assert.ok(visibleFrames.length >= 1, "expected non-clean scientific axes to render a visible boxed frame");
  assert.equal(visibleFrame.style.stroke, "rgb(128 128 128)", "expected scientific axes frame to inherit TeX Live draw=black!50");
  assert.ok(topTicks.length >= 2, "expected boxed scientific axes to render unlabeled ticks on the top frame edge");
  assert.ok(rightTicks.length >= 2, "expected boxed scientific axes to render unlabeled ticks on the right frame edge");
});

test("renders scientific axes inner ticks toward the plot area", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes={inner ticks},
  visualize as line=line,
  data/format=function]
data {
  var x : interval [0:2] samples 3;
  func y = \value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const visibleFrame = result.ir.items.find((item) => item.subtype === "axis-frame" && item.style?.stroke && item.style.stroke !== "none");
  const frameXs = visibleFrame?.commands.filter((command) => "x" in command).map((command) => command.x) || [];
  const frameYs = visibleFrame?.commands.filter((command) => "y" in command).map((command) => command.y) || [];
  const left = Math.min(...frameXs);
  const right = Math.max(...frameXs);
  const bottom = Math.min(...frameYs);
  const top = Math.max(...frameYs);
  const ticks = result.ir.items.filter((item) => item.subtype === "axis-tick");
  const yTickTexts = result.ir.items
    .filter((item) => item.type === "textNode" && item.style?.fontScale === 0.8 && item.x < left - 0.05)
    .map((item) => item.text);
  const bottomTick = ticks.find((tick) => Math.abs(tick.commands[0]?.y - bottom) < 0.01);
  const topTick = ticks.find((tick) => Math.abs(tick.commands[0]?.y - top) < 0.01);
  const leftTick = ticks.find(
    (tick) => Math.abs(tick.commands[0]?.x - left) < 0.01 && Math.abs((tick.commands[1]?.x || 0) - (tick.commands[0]?.x || 0)) > 0.01
  );
  const rightTick = ticks.find(
    (tick) => Math.abs(tick.commands[0]?.x - right) < 0.01 && Math.abs((tick.commands[1]?.x || 0) - (tick.commands[0]?.x || 0)) > 0.01
  );

  assert.deepEqual(result.diagnostics, []);
  assert.ok(bottomTick?.commands[1]?.y > bottomTick?.commands[0]?.y, "expected bottom inner ticks to point upward");
  assert.ok(topTick?.commands[1]?.y < topTick?.commands[0]?.y, "expected top inner ticks to point downward");
  assert.ok(leftTick?.commands[1]?.x > leftTick?.commands[0]?.x, "expected left inner ticks to point rightward");
  assert.ok(rightTick?.commands[1]?.x < rightTick?.commands[0]?.x, "expected right inner ticks to point leftward");
  assert.ok(!yTickTexts.includes("0.25"), `expected non-clean scientific 0..2 y ticks to avoid clean-axis quarter density, got ${yTickTexts.join(", ")}`);
  assert.ok(yTickTexts.includes("0.5"), `expected non-clean scientific 0..2 y ticks to use half steps, got ${yTickTexts.join(", ")}`);
  assert.ok(yTickTexts.includes("1.5"), `expected non-clean scientific 0..2 y ticks to use half steps, got ${yTickTexts.join(", ")}`);
});

test("places datavisualization legend text on the left when requested", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes,
  visualize as line=line,
  legend={label style=text left},
  line={label in legend={text=$f$}},
  data/format=function]
data {
  var x : interval [0:2] samples 3;
  func y = \value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const label = result.ir.items.find((item) => item.type === "textNode" && item.text === "$f$");
  const example = result.ir.items.find((item) => item.subtype === "axis-legend-example");
  const exampleXs = example?.commands.filter((command) => "x" in command).map((command) => command.x) || [];
  const exampleMinX = Math.min(...exampleXs);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(label, "expected legend label");
  assert.ok(example, "expected legend visualizer sample");
  assert.ok(label.x < exampleMinX - 0.05, `expected text-left legend label before sample, got label x=${label.x}, sample min=${exampleMinX}`);
});

test("colors datavisualization legend text when label style is text colored", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes,
  visualize as smooth line/.list={a,b},
  legend={label style=text colored},
  a={label in legend={text=$a$}},
  b={label in legend={text=$b$}},
  style sheet=strong colors,
  data/format=function]
data [set=a] {
  var x : interval [0:2] samples 3;
  func y = \value x;
}
data [set=b] {
  var x : interval [0:2] samples 3;
  func y = 2-\value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const labels = ["$a$", "$b$"].map((text) => result.ir.items.find((item) => item.type === "textNode" && item.text === text));
  const examples = result.ir.items.filter((item) => item.subtype === "axis-legend-example");
  const labelColors = labels.map((label) => label?.style?.fill || label?.style?.stroke || label?.style?.text).filter(Boolean);
  const exampleColors = examples.map((example) => example.style?.stroke || example.style?.draw || example.style?.color).filter(Boolean);
  const tickTexts = result.ir.items.filter((item) => item.type === "textNode" && item.style?.fontScale === 0.8).map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(examples.length, 2, "expected text-colored legend to keep visualizer samples");
  assert.ok(labels.every(Boolean), "expected both colored legend labels");
  assert.equal(labelColors.length, 2, `expected colored legend label styles, got ${JSON.stringify(labels)}`);
  assert.deepEqual(labelColors, exampleColors, `expected legend text to inherit visualizer colors ${exampleColors.join(", ")}, got ${labelColors.join(", ")}`);
  assert.ok(labelColors.some((color) => color !== "black" && color !== "rgb(0 0 0)"), `expected at least one colored legend text, got ${labelColors.join(", ")}`);
  assert.ok(tickTexts.includes("0.25"), `expected native-like quarter x ticks, got ${tickTexts.join(", ")}`);
  assert.ok(tickTexts.includes("1.75"), `expected native-like upper quarter x ticks, got ${tickTexts.join(", ")}`);
});

test("applies datavisualization legend label node style to legend text nodes", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes,
  visualize as smooth line/.list={log, lin},
  legend={label style={node style=draw}},
  log={label in legend={text=$\log x$}},
  lin={label in legend={text=$x/2$, node style={circle, draw=red}}},
  style sheet=strong colors,
  data/format=function]
data [set=log] {
  var x : interval [0.2:2.5] samples 10;
  func y = ln(\value x);
}
data [set=lin] {
  var x : interval [-2:2.5] samples 10;
  func y = 0.5*\value x;
};`;

  const expanded = preprocessTikzSource(source).source;
  const logLabel = expanded.match(/\\node\[([^\]]*)\]\s+at\s+\([^)]+\)\s+\{\$\\log x\$\}/);
  const linLabel = expanded.match(/\\node\[([^\]]*)\]\s+at\s+\([^)]+\)\s+\{\$x\/2\$\}/);

  assert.ok(logLabel, `expected log legend label node in lowered source:\n${expanded}`);
  assert.ok(linLabel, `expected lin legend label node in lowered source:\n${expanded}`);
  assert.match(logLabel[1], /(?:^|,)\s*draw(?:,|$)/, "global legend label node style should draw label boxes");
  assert.match(linLabel[1], /(?:^|,)\s*draw=red(?:,|$)/, "entry legend label node style should override draw color");
  assert.match(linLabel[1], /(?:^|,)\s*circle(?:,|$)/, "entry legend label node style should preserve the circle shape");
});

test("applies datavisualization visualizer in legend style only to legend samples", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  visualize as smooth line=series,
  series={style={blue}, label in legend={text=series,
    visualizer in legend style={red, line width=1.5pt}}},
  data/format=function]
data [set=series] {
  var x : interval [0:1] samples 3;
  func y = \value x;
};`;

  const expanded = preprocessTikzSource(source).source;
  const legendSample = expanded.match(/\\draw\[([^\]]*axis legend example[^\]]*)\]/);
  const rendered = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plotPath = rendered.ir.items.find((item) => item.subtype === "axis-plot");
  const legendPath = rendered.ir.items.find((item) => item.subtype === "axis-legend-example");

  assert.ok(legendSample, `expected a legend sample draw command, got:\n${expanded}`);
  assert.match(legendSample[1], /(?:^|,)\s*color=red(?:,|$)/, "legend sample should receive visualizer in legend style color");
  assert.match(legendSample[1], /(?:^|,)\s*line width=1\.5pt(?:,|$)/, "legend sample should receive visualizer in legend style line width");
  assert.ok(plotPath, "expected rendered data plot path");
  assert.ok(legendPath, "expected rendered legend sample path");
  assert.match(String(plotPath.style.stroke), /0 0 255|blue/, "data plot should keep its own blue style");
  assert.match(String(legendPath.style.stroke), /255 0 0|red/, "legend sample should use the legend-only red style");
  assert.ok(legendPath.style.lineWidth > plotPath.style.lineWidth, "legend-only line width should not thicken the data plot");
});

test("uses compact datavisualization legend math metrics for styled label nodes", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes,
  visualize as smooth line/.list={log, lin},
  legend={label style={node style=draw}},
  log={label in legend={text=$\log x$}},
  lin={label in legend={text=$x/2$, node style={circle, draw=red}}},
  style sheet=strong colors,
  data/format=function]
data [set=log] {
  var x : interval [0.2:2.5] samples 10;
  func y = ln(\value x);
}
data [set=lin] {
  var x : interval [-2:2.5] samples 10;
  func y = 0.5*\value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const legendBoxes = result.ir.items.filter((item) => item.type === "nodeBox" && item.subtype === "axis-legend");
  const rectangle = legendBoxes.find((item) => item.shape === "rectangle");
  const circle = legendBoxes.find((item) => item.shape === "circle");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(rectangle, "expected the global legend label node style to draw a rectangle around $\\log x$");
  assert.ok(circle, "expected the entry legend label node style to draw a circle around $x/2$");
  assert.ok(
    rectangle.width > 0.45 && rectangle.width < 0.7,
    `expected compact native-like \\log x legend box width, got ${rectangle.width}cm`
  );
  assert.ok(
    circle.width > 0.55 && circle.width < 0.72,
    `expected compact native-like x/2 legend circle diameter, got ${circle.width}cm`
  );
});

test("anchors datavisualization legends at data values", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  x axis={min value=0,max value=2},
  y axis={min value=0,max value=2},
  visualize as smooth line/.list={a,b},
  legend={at values={x=1,y=1}},
  a={label in legend={text=a}},
  b={label in legend={text=b}},
  style sheet=strong colors,
  data/format=function]
data [set=a] {
  var x : interval [0:2] samples 5;
  func y = \value x;
}
data [set=b] {
  var x : interval [0:2] samples 5;
  func y = 2-\value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const labels = ["a", "b"].map((text) => result.ir.items.find((item) => item.type === "textNode" && item.text === text));
  const labelCenterX = labels.reduce((sum, label) => sum + (label?.x || 0), 0) / labels.length;
  const labelCenterY = labels.reduce((sum, label) => sum + (label?.y || 0), 0) / labels.length;

  assert.deepEqual(result.diagnostics, []);
  assert.ok(labels.every(Boolean), "expected both at-values legend labels");
  assert.ok(labelCenterX > 2.1 && labelCenterX < 3.3, `expected legend text to be centered near data x=1, got x=${labelCenterX}`);
  assert.ok(labelCenterY > 1.3 && labelCenterY < 1.9, `expected legend text to be centered near data y=1, got y=${labelCenterY}`);
  assert.ok(Math.abs(labels[0].x - labels[1].x) < 0.08, `expected at-values legend to keep a vertical column, got x=${labels[0].x}, ${labels[1].x}`);
});

test("places datavisualization legends right of data values", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  x axis={min value=0,max value=2},
  y axis={min value=0,max value=2},
  visualize as smooth line/.list={a,b},
  legend={right of={x=1,y=1}},
  a={label in legend={text=a}},
  b={label in legend={text=b}},
  style sheet=strong colors,
  data/format=function]
data [set=a] {
  var x : interval [0:2] samples 5;
  func y = \value x;
}
data [set=b] {
  var x : interval [0:2] samples 5;
  func y = 2-\value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const labels = ["a", "b"].map((text) => result.ir.items.find((item) => item.type === "textNode" && item.text === text));
  const labelCenterX = labels.reduce((sum, label) => sum + (label?.x || 0), 0) / labels.length;
  const labelCenterY = labels.reduce((sum, label) => sum + (label?.y || 0), 0) / labels.length;

  assert.deepEqual(result.diagnostics, []);
  assert.ok(labels.every(Boolean), "expected both right-of legend labels");
  assert.ok(labelCenterX > 3.0, `expected right-of legend labels to sit right of data x=1, got x=${labelCenterX}`);
  assert.ok(labelCenterY > 1.3 && labelCenterY < 1.9, `expected right-of legend text to stay near data y=1, got y=${labelCenterY}`);
  assert.ok(Math.abs(labels[0].x - labels[1].x) < 0.08, `expected right-of legend to keep a vertical column, got x=${labels[0].x}, ${labels[1].x}`);
});

test("applies datavisualization vary thickness style sheet to line visualizers", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as smooth line/.list={a,b,c},
  style sheet=strong colors,
  style sheet=vary thickness,
  data/format=function]
data [set=a] {
  var x : interval [0:2] samples 5;
  func y = \value x;
}
data [set=b] {
  var x : interval [0:2] samples 5;
  func y = \value x + 0.5;
}
data [set=c] {
  var x : interval [0:2] samples 5;
  func y = \value x + 1;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plots = result.ir.items.filter((item) => item.subtype === "axis-plot");
  const lineWidths = plots.map((item) => item.style.lineWidth);
  const strokeColors = new Set(plots.map((item) => item.style.stroke));

  assert.deepEqual(result.diagnostics, []);
  assert.equal(lineWidths.length, 3);
  assert.ok(strokeColors.size > 1, "expected duplicate style sheet options to preserve strong colors");
  assert.ok(lineWidths[0] < lineWidths[1], `expected second visualizer thicker than first, got ${lineWidths.join(",")}`);
  assert.ok(lineWidths[1] < lineWidths[2], `expected third visualizer thicker than second, got ${lineWidths.join(",")}`);
});

test("ignores datavisualization style sheets without consuming style sequence slots", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as smooth line/.list={a,b,c},
  style sheet=strong colors,
  style sheet=vary dashing,
  a={label in legend={text=a}},
  b={ignore style sheets, style={line width=1pt}, label in legend={text=b}},
  c={label in legend={text=c}},
  data/format=function]
data [set=a] {
  var x : interval [0:1] samples 3;
  func y = \value x;
}
data [set=b] {
  var x : interval [0:1] samples 3;
  func y = \value x + 1;
}
data [set=c] {
  var x : interval [0:1] samples 3;
  func y = \value x + 2;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plots = result.ir.items.filter((item) => item.subtype === "axis-plot");
  const legendExamples = result.ir.items.filter((item) => item.subtype === "axis-legend-example");
  const tickTexts = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(plots.length, 3);
  assert.equal(legendExamples.length, 3);
  assert.equal(plots[0].style.stroke, "black");
  assert.equal(plots[0].style.dashArray, undefined);
  assert.equal(plots[1].style.stroke, "black");
  assert.ok(plots[1].style.lineWidth > 3 && plots[1].style.lineWidth < 4, `expected explicit 1pt line width, got ${plots[1].style.lineWidth}`);
  assert.equal(plots[1].style.dashArray, undefined);
  assert.match(String(plots[2].style.stroke), /rgb|red/);
  assert.ok(Array.isArray(plots[2].style.dashArray), "expected the third plot to use the second style-sheet dash slot");
  assert.match(String(legendExamples[1].style.stroke), /204 0 0|red/, "expected ignored plot's native legend sample to keep visualizer style-sheet color");
  assert.ok(Array.isArray(legendExamples[1].style.dashArray), "expected ignored plot's native legend sample to keep visualizer style-sheet dashing");
  assert.ok(tickTexts.includes("0.5"), `expected clean 0..3 y axis to include native half-step tick 0.5, got ${tickTexts.join(", ")}`);
  assert.ok(tickTexts.includes("2.5"), `expected clean 0..3 y axis to include native half-step tick 2.5, got ${tickTexts.join(", ")}`);
});

test("applies datavisualization vary thickness and dashing as a native paired sequence", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as smooth line/.list={a,b,c,d},
  style sheet=vary thickness and dashing,
  data/format=function]
data [set=a] {
  var x : interval [0:1] samples 3;
  func y = \value x;
}
data [set=b] {
  var x : interval [0:1] samples 3;
  func y = \value x + 1;
}
data [set=c] {
  var x : interval [0:1] samples 3;
  func y = \value x + 2;
}
data [set=d] {
  var x : interval [0:1] samples 3;
  func y = \value x + 3;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plots = result.ir.items.filter((item) => item.subtype === "axis-plot");
  const lineWidths = plots.map((item) => item.style.lineWidth);
  const dashArrays = plots.map((item) => item.style.dashArray || []);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(plots.length, 4);
  assert.ok(lineWidths[0] < lineWidths[1], `expected native thin/thick pair for first two lines, got ${lineWidths.join(",")}`);
  assert.ok(Math.abs(lineWidths[0] - lineWidths[2]) < 0.01, `expected third line to return to thin, got ${lineWidths.join(",")}`);
  assert.ok(Math.abs(lineWidths[1] - lineWidths[3]) < 0.01, `expected fourth line to return to thick, got ${lineWidths.join(",")}`);
  assert.deepEqual(dashArrays[0], [], "expected first native paired style to be solid thin");
  assert.deepEqual(dashArrays[1], [], "expected second native paired style to be solid thick");
  assert.equal(dashArrays[2].length, 2, "expected third native paired style to be dashed thin");
  assert.equal(dashArrays[3].length, 2, "expected fourth native paired style to be dashed thick");
  assert.ok(dashArrays[2][0] < dashArrays[3][0], "expected dash length to scale with thin/thick line width");
});

test("applies datavisualization vary hue style sheet to line visualizers", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  legend={south east outside},
  visualize as smooth line/.list={a,b,c,d},
  style sheet=vary hue,
  a={label in legend={text=a}},
  b={label in legend={text=b}},
  c={label in legend={text=c}},
  d={label in legend={text=d}},
  data/format=function]
data [set=a] {
  var x : interval [0:1] samples 3;
  func y = \value x;
}
data [set=b] {
  var x : interval [0:1] samples 3;
  func y = \value x + 1;
}
data [set=c] {
  var x : interval [0:1] samples 3;
  func y = \value x + 2;
}
data [set=d] {
  var x : interval [0:1] samples 3;
  func y = \value x + 3;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plots = result.ir.items.filter((item) => item.subtype === "axis-plot");
  const legendExamples = result.ir.items.filter((item) => item.subtype === "axis-legend-example");
  const strokeColors = plots.map((item) => item.style.stroke);
  const legendBounds = legendExamples.map((item) => {
    const xs = item.commands.filter((command) => "x" in command).map((command) => command.x);
    const ys = item.commands.filter((command) => "y" in command).map((command) => command.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      centerY: (Math.min(...ys) + Math.max(...ys)) / 2
    };
  });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(plots.length, 4);
  assert.deepEqual(strokeColors, ["rgb(20 80 204)", "rgb(196 20 204)", "rgb(204 63 20)", "rgb(110 204 20)"]);
  assert.equal(legendExamples.length, 4);
  assert.ok(Math.abs(legendBounds[0].minX - 5.526) < 0.03, `expected native line legend sample start, got ${legendBounds[0].minX}`);
  assert.ok(Math.abs(legendBounds[0].maxX - 6.229) < 0.03, `expected native line legend sample end, got ${legendBounds[0].maxX}`);
  assert.ok(
    legendExamples.every((item) => item.commands.some((command) => command.type === "curveTo")),
    "expected line legend examples to use smooth cubic sample paths like native datavisualization"
  );
  assert.deepEqual(
    legendBounds.map((item) => Math.round(item.centerY * 10) / 10),
    [1.5, 1.1, 0.7, 0.3]
  );
});

test("applies datavisualization gray scale style sheet to line visualizers", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  legend={south east outside},
  visualize as smooth line/.list={a,b,c,d},
  style sheet=gray scale,
  a={label in legend={text=a}},
  b={label in legend={text=b}},
  c={label in legend={text=c}},
  d={label in legend={text=d}},
  data/format=function]
data [set=a] {
  var x : interval [0:2] samples 5;
  func y = \value x;
}
data [set=b] {
  var x : interval [0:2] samples 5;
  func y = \value x + 0.2;
}
data [set=c] {
  var x : interval [0:2] samples 5;
  func y = \value x + 0.4;
}
data [set=d] {
  var x : interval [0:2] samples 5;
  func y = \value x + 0.6;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plotStrokes = result.ir.items.filter((item) => item.subtype === "axis-plot").map((item) => item.style.stroke);
  const legendStrokes = result.ir.items.filter((item) => item.subtype === "axis-legend-example").map((item) => item.style.stroke);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(plotStrokes, ["rgb(0 0 0)", "rgb(87 87 87)", "rgb(173 173 173)", "rgb(5 5 5)"]);
  assert.deepEqual(legendStrokes, plotStrokes);
});

test("continues datavisualization color-series style sheets beyond four visualizers", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as smooth line/.list={a,b,c,d,e,f,g,h},
  style sheet=vary hue,
  a={label in legend={text=a}},
  b={label in legend={text=b}},
  c={label in legend={text=c}},
  d={label in legend={text=d}},
  e={label in legend={text=e}},
  f={label in legend={text=f}},
  g={label in legend={text=g}},
  h={label in legend={text=h}},
  data/format=function]
data [set=a] { var x : interval [0:1] samples 3; func y = \value x; }
data [set=b] { var x : interval [0:1] samples 3; func y = \value x + 1; }
data [set=c] { var x : interval [0:1] samples 3; func y = \value x + 2; }
data [set=d] { var x : interval [0:1] samples 3; func y = \value x + 3; }
data [set=e] { var x : interval [0:1] samples 3; func y = \value x + 4; }
data [set=f] { var x : interval [0:1] samples 3; func y = \value x + 5; }
data [set=g] { var x : interval [0:1] samples 3; func y = \value x + 6; }
data [set=h] { var x : interval [0:1] samples 3; func y = \value x + 7; };`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plotStrokes = result.ir.items.filter((item) => item.subtype === "axis-plot").map((item) => item.style.stroke);
  const legendStrokes = result.ir.items.filter((item) => item.subtype === "axis-legend-example").map((item) => item.style.stroke);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(plotStrokes, [
    "rgb(20 80 204)",
    "rgb(196 20 204)",
    "rgb(204 63 20)",
    "rgb(110 204 20)",
    "rgb(20 204 165)",
    "rgb(33 20 204)",
    "rgb(204 20 140)",
    "rgb(204 135 20)"
  ]);
  assert.deepEqual(legendStrokes, plotStrokes);
});

test("applies datavisualization blue and red shade color-series style sheets", () => {
  const renderStrokes = (styleSheet) => {
    const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as smooth line/.list={a,b,c,d,e,f},
  style sheet=${styleSheet},
  a={label in legend={text=a}},
  b={label in legend={text=b}},
  c={label in legend={text=c}},
  d={label in legend={text=d}},
  e={label in legend={text=e}},
  f={label in legend={text=f}},
  data/format=function]
data [set=a] { var x : interval [0:1] samples 3; func y = \value x; }
data [set=b] { var x : interval [0:1] samples 3; func y = \value x + 1; }
data [set=c] { var x : interval [0:1] samples 3; func y = \value x + 2; }
data [set=d] { var x : interval [0:1] samples 3; func y = \value x + 3; }
data [set=e] { var x : interval [0:1] samples 3; func y = \value x + 4; }
data [set=f] { var x : interval [0:1] samples 3; func y = \value x + 5; };`;

    const result = tikzToSvg(source, { mathRenderer: "svg-text" });
    assert.deepEqual(result.diagnostics, []);
    return {
      plots: result.ir.items.filter((item) => item.subtype === "axis-plot").map((item) => item.style.stroke),
      legends: result.ir.items.filter((item) => item.subtype === "axis-legend-example").map((item) => item.style.stroke)
    };
  };

  const blue = renderStrokes("shades of blue");
  const red = renderStrokes("shades of red");

  assert.deepEqual(blue.plots, ["rgb(0 26 255)", "rgb(102 117 255)", "rgb(204 209 255)", "rgb(51 71 255)", "rgb(153 163 255)", "rgb(255 255 255)"]);
  assert.deepEqual(blue.legends, blue.plots);
  assert.deepEqual(red.plots, ["rgb(255 0 0)", "rgb(255 102 102)", "rgb(255 204 204)", "rgb(255 51 51)", "rgb(255 153 153)", "rgb(255 255 255)"]);
  assert.deepEqual(red.legends, red.plots);
});

test("uses native-like quarter y ticks for datavisualization clean axes over a 0 to 2 range", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as smooth line/.list={a,b,c},
  style sheet=strong colors,
  style sheet=vary thickness,
  data/format=function]
data [set=a] {
  var x : interval [0:4] samples 5;
  func y = 0.25*\value x;
}
data [set=b] {
  var x : interval [0:4] samples 5;
  func y = 0.25*\value x + 0.5;
}
data [set=c] {
  var x : interval [0:4] samples 5;
  func y = 0.25*\value x + 1;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const tickTexts = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(tickTexts.includes("0.25"), `expected native-like quarter tick labels, got ${tickTexts.join(", ")}`);
  assert.ok(tickTexts.includes("1.75"), `expected native-like upper quarter tick labels, got ${tickTexts.join(", ")}`);
});

test("keeps datavisualization clean y ticks inside the visible range for non-integer maxima", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as smooth line/.list={a,b,c,d,e,f},
  style sheet=vary thickness and dashing,
  data/format=function]
data [set=a] {
  var x : interval [0:6] samples 3;
  func y = 0.12*\value x;
}
data [set=b] {
  var x : interval [0:6] samples 3;
  func y = 0.12*\value x + 0.35;
}
data [set=c] {
  var x : interval [0:6] samples 3;
  func y = 0.12*\value x + 0.7;
}
data [set=d] {
  var x : interval [0:6] samples 3;
  func y = 0.12*\value x + 1.05;
}
data [set=e] {
  var x : interval [0:6] samples 3;
  func y = 0.12*\value x + 1.4;
}
data [set=f] {
  var x : interval [0:6] samples 3;
  func y = 0.12*\value x + 1.75;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const yTickTexts = result.ir.items
    .filter((item) => item.type === "textNode" && item.x < -0.2)
    .map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(yTickTexts.includes("2"), `expected clean y ticks to include 2 like native datavisualization, got ${yTickTexts.join(",")}`);
  assert.ok(!yTickTexts.includes("2.5"), `expected native clean axes to leave the top boundary tick unlabeled, got ${yTickTexts.join(",")}`);
});

test("keeps datavisualization top boundary tick mark but hides its label", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as smooth line/.list={a,b,c,d,e,f},
  style sheet=vary thickness and dashing,
  data/format=function]
data [set=a] { var x : interval [0:6] samples 3; func y = 0.12*\value x; }
data [set=b] { var x : interval [0:6] samples 3; func y = 0.12*\value x + 0.35; }
data [set=c] { var x : interval [0:6] samples 3; func y = 0.12*\value x + 0.7; }
data [set=d] { var x : interval [0:6] samples 3; func y = 0.12*\value x + 1.05; }
data [set=e] { var x : interval [0:6] samples 3; func y = 0.12*\value x + 1.4; }
data [set=f] { var x : interval [0:6] samples 3; func y = 0.12*\value x + 1.75; };`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const yTickTexts = result.ir.items
    .filter((item) => item.type === "textNode" && item.x < -0.2)
    .map((item) => item.text);
  const topTick = result.ir.items.find(
    (item) =>
      item.subtype === "axis-tick" &&
      item.commands?.some((command) => "y" in command && command.y > 3.0)
  );

  assert.deepEqual(result.diagnostics, []);
  assert.ok(topTick, "expected native clean axes to keep the top boundary tick/grid position");
  assert.ok(yTickTexts.includes("2"), `expected the last interior y tick label to remain visible, got ${yTickTexts.join(",")}`);
  assert.ok(!yTickTexts.includes("2.5"), `expected the top boundary tick label to be omitted, got ${yTickTexts.join(",")}`);
});

test("uses native-like unit y ticks for datavisualization clean axes over a 0 to 6 range", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as smooth line/.list={a,b,c,d,e,f},
  style sheet=shades of blue,
  data/format=function]
data [set=a] { var x : interval [0:1] samples 3; func y = \value x; }
data [set=b] { var x : interval [0:1] samples 3; func y = \value x + 1; }
data [set=c] { var x : interval [0:1] samples 3; func y = \value x + 2; }
data [set=d] { var x : interval [0:1] samples 3; func y = \value x + 3; }
data [set=e] { var x : interval [0:1] samples 3; func y = \value x + 4; }
data [set=f] { var x : interval [0:1] samples 3; func y = \value x + 5; };`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const yTickTexts = result.ir.items
    .filter((item) => item.type === "textNode" && item.x < -0.2)
    .map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(yTickTexts.includes("1"), `expected clean y ticks to include unit tick 1 like tikztosvg, got ${yTickTexts.join(",")}`);
  assert.ok(yTickTexts.includes("3"), `expected clean y ticks to include unit tick 3 like tikztosvg, got ${yTickTexts.join(",")}`);
  assert.ok(yTickTexts.includes("5"), `expected clean y ticks to include unit tick 5 like tikztosvg, got ${yTickTexts.join(",")}`);
});

test("supports datavisualization logarithmic axis mapping and exponential ticks", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={logarithmic,min value=1,max value=1000,ticks={some},grid},
  y axis={min value=0,max value=3,ticks={step=1},grid},
  visualize as line=series,
  series={style={blue, thick},label in legend={text={log axis}}}]
data {
  x, y, set
  1, 0, series
  10, 1, series
  100, 2, series
  1000, 3, series
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plot = result.ir.items.find((item) => item.subtype === "axis-plot");
  const pointCommands = plot?.commands.filter((command) => "x" in command && "y" in command) || [];
  const xs = pointCommands.map((command) => command.x);
  const tickTexts = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(pointCommands.length, 4);
  assert.ok(Math.abs((xs[1] - xs[0]) - (xs[2] - xs[1])) < 0.02, `expected log x decades to be equally spaced, got ${xs.join(",")}`);
  assert.ok(Math.abs((xs[2] - xs[1]) - (xs[3] - xs[2])) < 0.02, `expected log x decades to be equally spaced, got ${xs.join(",")}`);
  assert.ok(tickTexts.includes("10"), "expected logarithmic major tick at 10");
  assert.ok(tickTexts.includes("100"), "expected logarithmic major tick at 100");
  assert.ok(tickTexts.includes("1,000"), "expected logarithmic major tick at 1,000 with native comma grouping");
  assert.ok(!tickTexts.includes("200"), "expected logarithmic ticks, not linear 200-style ticks");
  assert.ok(!tickTexts.includes("1000"), "expected native grouped tick text, not bare 1000");
});

test("supports datavisualization power unit length for logarithmic axes", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={logarithmic,power unit length=1cm,min value=1,max value=1000,ticks={some},grid},
  y axis={min value=0,max value=3,ticks={step=1},grid},
  visualize as line=series]
data {
  x, y, set
  1, 0, series
  10, 1, series
  100, 2, series
  1000, 3, series
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plot = result.ir.items.find((item) => item.subtype === "axis-plot");
  const pointCommands = plot?.commands.filter((command) => "x" in command && "y" in command) || [];
  const xs = pointCommands.map((command) => command.x);
  const span = xs.at(-1) - xs[0];

  assert.deepEqual(result.diagnostics, []);
  assert.equal(pointCommands.length, 4);
  assert.ok(span > 2.95 && span < 3.05, `expected three logarithmic decades at 1cm each to span 3cm, got ${span}`);
});

test("applies datavisualization all axes unit length to linear plot scale", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [school book axes,
  all axes={unit length=7.5mm},
  visualize as line=series]
data [format=function] {
  var x : interval [-2.5:2.5] samples 2;
  func y = 0;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plot = result.ir.items.find((item) => item.subtype === "axis-plot");
  const pointCommands = plot?.commands.filter((command) => "x" in command && "y" in command) || [];
  const span = pointCommands.at(-1).x - pointCommands[0].x;

  assert.deepEqual(result.diagnostics, []);
  assert.equal(pointCommands.length, 2);
  assert.ok(span > 3.72 && span < 3.78, `expected five units at 7.5mm each to span 3.75cm, got ${span}`);
});

test("maps datavisualization axis scaling targets to physical axis coordinates", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization}
\tikz \datavisualization
 [scientific axes,
  x axis={attribute=people, length=2.5cm, ticks=few},
  y axis={attribute=year, scaling=1900 at 0cm and 2000 at 5cm},
  visualize as scatter]
data {
  year, people
  1900, 100
  1910, 200
  1950, 200
  1960, 250
  2000, 150
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const marks = result.ir.items.filter((item) => item.subtype === "axis-mark");
  const centers = marks.map((item) => {
    const points = (item.commands || []).filter((command) => Number.isFinite(command.x) && Number.isFinite(command.y));
    return {
      x: (Math.min(...points.map((point) => point.x)) + Math.max(...points.map((point) => point.x))) / 2,
      y: (Math.min(...points.map((point) => point.y)) + Math.max(...points.map((point) => point.y))) / 2
    };
  });
  const yValues = centers.map((item) => item.y).filter(Number.isFinite);
  const ySpan = Math.max(...yValues) - Math.min(...yValues);
  const tickTexts = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(marks.length, 5);
  assert.ok(ySpan > 4.95 && ySpan < 5.05, `expected 1900..2000 to occupy the requested 5cm y scaling span, got ${ySpan}`);
  assert.ok(tickTexts.includes("1,900"), `expected y tick labels to preserve source year values, got ${tickTexts.join(", ")}`);
  assert.ok(tickTexts.includes("2,000"), `expected y tick labels to preserve source year values, got ${tickTexts.join(", ")}`);
});

test("uses native em-based datavisualization legend sample spacing", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [school book axes,
  all axes={unit length=7.5mm},
  visualize as smooth line=curve,
  curve={label in legend={text=$x$}}]
data [format=function] {
  var x : interval [-2.5:2.5] samples 8;
  func y = \value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const legendExample = result.ir.items.find((item) => item.subtype === "axis-legend-example");
  const legendText = result.ir.items.find((item) => item.type === "textNode" && item.text === "$x$");
  const commands = legendExample?.commands.filter((command) => Number.isFinite(command.x) && Number.isFinite(command.y)) || [];
  const xValues = commands.map((command) => command.x);
  const sampleWidth = Math.max(...xValues) - Math.min(...xValues);
  const textAnchorX = Number.isFinite(legendText?.svgTextX) ? legendText.svgTextX : legendText?.x;
  const sampleTextGap = textAnchorX - Math.max(...xValues);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(legendExample, "expected line visualizer legend example");
  assert.ok(legendText, "expected legend label");
  assert.ok(sampleWidth > 0.68 && sampleWidth < 0.73, `expected native 2em legend sample width, got ${sampleWidth}`);
  assert.ok(sampleTextGap > 0.16 && sampleTextGap < 0.19, `expected native 0.5em legend label gap, got ${sampleTextGap}`);
});

test("supports datavisualization straight label in legend line with plot marks", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as line=line,
  line={style={mark=x}, label in legend={text=example, straight label in legend line}},
  data/format=function]
data {
  var x : interval [0:1] samples 2;
  func y = \value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const legendExamples = result.ir.items.filter((item) => item.subtype === "axis-legend-example");
  const straightLine = legendExamples.find((item) => {
    const commands = item.commands || [];
    return commands.length === 2 && commands[0]?.type === "moveTo" && commands[1]?.type === "lineTo";
  });
  const markExamples = legendExamples.filter((item) => (item.commands || []).length === 4);
  const lineYs = (straightLine?.commands || []).filter((command) => "y" in command).map((command) => command.y);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(straightLine, "expected straight label in legend line to render a straight sample line");
  assert.ok(Math.max(...lineYs) - Math.min(...lineYs) < 1e-6, "expected straight legend sample to stay horizontal");
  assert.equal(markExamples.length, 2, "expected straight legend sample to include two plot marks");
});

test("uses circular legend samples for closed datavisualization visualizers", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes={clean}, all axes={length=3cm},
  visualize as line/.list={a,b,c},
  style sheet=cross marks,
  a={polygon,label in legend={text=polygon}},
  b={smooth cycle,label in legend={text=circle}},
  c={label in legend={text=line}}]
data [format=function, set=a] {
  var t : {0,72,...,359};
  func x = cos(\value t);
  func y = sin(\value t);
}
data [format=function, set=b] {
  var t : interval [0:2*pi] samples 20;
  func x = .8*cos(\value t r);
  func y = .8*sin(\value t r);
}
data point [x=-1, y=0.5, set=c]
data point [x=1, y=0.25, set=c];`;

  const expanded = preprocessTikzSource(source).source;
  const beforePolygonLabel = expanded.slice(0, expanded.indexOf("{polygon}"));
  const betweenClosedLabels = expanded.slice(expanded.indexOf("{polygon}"), expanded.indexOf("{circle}"));
  const polygonLegendExamples = beforePolygonLabel.match(/\\(?:draw|path)\[axis legend example[^\n]*/g) || [];
  const circleLegendExamples = betweenClosedLabels.match(/\\(?:draw|path)\[axis legend example[^\n]*/g) || [];
  const circularLineSamples = [...polygonLegendExamples, ...circleLegendExamples].filter((line) => line.includes("-- cycle")).length;
  const circularMarkExamples = polygonLegendExamples.length + circleLegendExamples.length - circularLineSamples;

  assert.ok(circularLineSamples >= 2, `expected closed visualizers to render circular legend line samples, got ${circularLineSamples}`);
  assert.ok(circularMarkExamples >= 4, `expected closed circular legend samples to include two mark coordinates each, got ${circularMarkExamples}`);
});

test("keeps default datavisualization outside legends at native physical offset for short axes", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes={clean}, all axes={length=3cm},
  visualize as line/.list={a,b,c},
  style sheet=cross marks,
  a={polygon,label in legend={text=polygon}},
  b={smooth cycle,label in legend={text=circle}},
  c={label in legend={text=line}}]
data [format=function, set=a] {
  var t : {0,72,...,359};
  func x = cos(\value t);
  func y = sin(\value t);
}
data [format=function, set=b] {
  var t : interval [0:2*pi] samples 20;
  func x = .8*cos(\value t r);
  func y = .8*sin(\value t r);
}
data point [x=-1, y=0.5, set=c]
data point [x=1, y=0.25, set=c];`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const legendExamples = result.ir.items.filter((item) => item.subtype === "axis-legend-example");
  const firstLegend = legendExamples[0];
  const xValues = (firstLegend?.commands || []).flatMap((command) => ["x", "x1", "x2"].map((key) => command[key]).filter(Number.isFinite));
  const minX = Math.min(...xValues);
  const polygonLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "polygon");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(firstLegend, "expected first closed legend sample");
  assert.ok(minX > 3.45 && minX < 3.6, `expected first outside legend sample to start about 0.53cm after the 3cm data area, got ${minX}`);
  assert.ok(
    polygonLabel && polygonLabel.svgTextX > 4.35 && polygonLabel.svgTextX < 4.55,
    `expected label anchor to stay near native text offset, got ${polygonLabel?.svgTextX}`
  );
});

test("uses gap circular legend samples for datavisualization gap cycles", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes={clean}, all axes={length=3cm},
  visualize as line/.list={a,b,c},
  style sheet=cross marks,
  a={gap cycle,label in legend={text=gap}},
  b={smooth cycle,label in legend={text=circle}},
  c={gap line,label in legend={text=line}}]
data [format=function, set=a] {
  var t : {0,72,...,359};
  func x = cos(\value t);
  func y = sin(\value t);
}
data [format=function, set=b] {
  var t : interval [0:2*pi] samples 20;
  func x = .8*cos(\value t r);
  func y = .8*sin(\value t r);
}
data point [x=-1, y=0.5, set=c]
data point [x=1, y=0.25, set=c];`;

  const expanded = preprocessTikzSource(source).source;
  const beforeGapLabel = expanded.slice(0, expanded.indexOf("{gap}"));
  const gapLineSegments = beforeGapLabel.match(/\\(?:draw|path)\[axis legend example[^\n]*/g) || [];

  assert.ok(gapLineSegments.length >= 6, `expected gap circular legend sample to render five gap points plus line glyph, got ${gapLineSegments.length}`);
});

test("uses zig-zag legend mark coordinates for default datavisualization line legends", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes={clean}, all axes={length=3cm},
  visualize as line=line,
  style sheet=cross marks,
  line={label in legend={text=line}}]
data point [x=-1, y=0.5, set=line]
data point [x=1, y=0.25, set=line];`;

  const expanded = preprocessTikzSource(source).source;
  const beforeLabel = expanded.slice(0, expanded.indexOf("{line}"));
  const legendExamples = beforeLabel.match(/\\(?:draw|path)\[axis legend example[^\n]*/g) || [];
  const markExamples = legendExamples.filter((line) => line.includes(" -- ") && !line.includes(".. controls"));

  assert.ok(legendExamples.length >= 3, `expected zig-zag line legend to include line plus two marks, got ${legendExamples.length}`);
  assert.equal(markExamples.length, 2, `expected two native zig-zag legend mark coordinates, got ${markExamples.length}`);
});

test("expands ellipsis grouped variables and evaluates datavis trig in degrees by default", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes={clean}, all axes={length=3cm},
  visualize as line=cycle,
  cycle={straight cycle}]
data [format=function, set=cycle] {
  var t : {0,90,...,270};
  func x = cos(\value t);
  func y = sin(\value t);
};`;

  const expanded = preprocessTikzSource(source).source;
  const axisPlot = expanded.match(/\\draw\[axis plot[^\]]*\]\s+([^;]+);/);
  const coordinates = axisPlot?.[1]?.match(/\([^)]+\)/g) || [];

  assert.equal(coordinates.length, 4, `expected ellipsis group to expand to four degree samples, got ${coordinates.join(" ")}`);
  assert.match(coordinates.join(" "), /\(3,1\.5\)/);
  assert.match(coordinates.join(" "), /\(1\.5,3\)/);
  assert.match(coordinates.join(" "), /\(0,1\.5\)/);
  assert.match(coordinates.join(" "), /\(1\.5,0\)/);
});

test("supports datavisualization visualizer set routing from table data", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as line=sin,
  visualize as line=cos,
  visualize as scatter=tan,
  sin={style={red, densely dotted},label in legend={text=$s$}},
  cos={style={blue},label in legend={text=$c$}},
  tan={style={mark=x, mark size=2pt},label in legend={text=$t$}}]
data {
  x, y, set
  0, 0, sin
  1, 1, sin
  2, 0, sin
  0, 1, cos
  1, 0, cos
  2, -1, cos
  0, 0, tan
  1, 1, tan
  2, 2, tan
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plots = result.ir.items.filter((item) => item.subtype === "axis-plot");
  const marks = result.ir.items.filter((item) => item.subtype === "axis-mark");
  const legendExamples = result.ir.items.filter((item) => item.subtype === "axis-legend-example");
  const texts = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ast.libraries.find((library) => library.name === "datavisualization")?.status, "partial");
  assert.equal(plots.length, 2);
  assert.equal(marks.length, 3);
  assert.equal(plots[0].style.stroke, "red");
  assert.ok(plots[0].style.dashArray?.length >= 2, "expected visualizer style densely dotted to apply");
  assert.equal(plots[1].style.stroke, "blue");
  assert.ok(marks.every((mark) => mark.style.stroke === "black" || mark.style.stroke === "blue" || mark.style.stroke === "red"));
  assert.equal(legendExamples.length, 3);
  assert.equal(legendExamples[2].commands.length, 4, "expected scatter legend example to use mark=x cross strokes");
  assert.ok(texts.includes("$s$"));
  assert.ok(texts.includes("$c$"));
  assert.ok(texts.includes("$t$"));
});

test("places datavisualization legends at explicit data visualization bbox anchors", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes, x axis={label=$x$},
  visualize as smooth line/.list={log, lin},
  legend={anchor=north west, at=(data visualization bounding box.north east)},
  log={label in legend={text=$\log x$}},
  lin={label in legend={text=$x/2$}},
  style sheet=vary dashing,
  data/format=function]
data [set=log] { var x : interval [0.2:2.5] samples 10; func y = ln(\value x); }
data [set=lin] { var x : interval [-2:2.5] samples 10; func y = 0.5*\value x; };`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const logLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "$\\log x$");
  const linLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "$x/2$");
  const legendExamples = result.ir.items.filter((item) => item.subtype === "axis-legend-example");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(logLabel, "expected log legend label");
  assert.ok(linLabel, "expected lin legend label");
  assert.ok(legendExamples.length >= 2, "expected legend examples");
  assert.ok(logLabel.y > 2.65, `expected anchor=north west at bbox north east to place first legend row near the top, got y=${logLabel.y}`);
  assert.ok(logLabel.x < 6.45, `expected explicit bbox legend to start at the data frame east edge, got x=${logLabel.x}`);
  assert.ok(logLabel.y > linLabel.y, "expected second legend row below the first");
});

test("places datavisualization legends at shifted projection bbox coordinates", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes,
  visualize as smooth line/.list={a,b},
  legend={anchor=north west, at={([xshift=.8em]data visualization bounding box.north east|- data bounding box.north)}},
  a={label in legend={text=a}},
  b={label in legend={text=b}},
  data/format=function]
data [set=a] { var x : interval [0:1] samples 3; func y = \value x; }
data [set=b] { var x : interval [0:1] samples 3; func y = 0.5*\value x; };`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const labelA = result.ir.items.find((item) => item.type === "textNode" && item.text === "a");
  const labelB = result.ir.items.find((item) => item.type === "textNode" && item.text === "b");
  const firstExample = result.ir.items.find((item) => item.subtype === "axis-legend-example");
  const exampleXs = (firstExample?.commands || []).filter((command) => "x" in command).map((command) => command.x);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(labelA, "expected first legend label");
  assert.ok(labelB, "expected second legend label");
  assert.ok(firstExample, "expected legend example");
  assert.ok(labelA.y > 2.75, `expected projected legend to align with data area top, got ${labelA.y}`);
  assert.ok(labelA.y > labelB.y, "expected second projected legend row below the first");
  assert.ok(Math.min(...exampleXs) > 5.2, `expected xshifted projection sample to start outside data area right, got ${exampleXs.join(",")}`);
});

test("keeps datavisualization scatter visualizer style color off native plot marks", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as line=trend,
  visualize as scatter=samples,
  trend={style={blue},label in legend={text=trend}},
  samples={style={red, mark=x, mark size=2pt},label in legend={text=measurements}}]
data {
  x, y, set
  0, 0, trend
  1, 0.5, trend
  2, 0.8, trend
  0, 0.1, samples
  1, 0.6, samples
  2, 0.7, samples
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const expanded = preprocessTikzSource(source).source;
  const marks = result.ir.items.filter((item) => item.subtype === "axis-mark");
  const legendExamples = result.ir.items.filter((item) => item.subtype === "axis-legend-example");
  const legendExample = legendExamples.at(-1);
  const legendRows = legendExamples.map((item) => {
    const ys = item.commands.filter((command) => "y" in command).map((command) => command.y);
    return (Math.min(...ys) + Math.max(...ys)) / 2;
  });
  const trendAnchor = expanded.match(/at \(([-\d.]+),[-\d.]+\) \{trend\}/);
  const measurementsAnchor = expanded.match(/at \(([-\d.]+),[-\d.]+\) \{measurements\}/);
  const scatterExample = expanded.match(
    /axis legend example\] \(([-\d.]+),[-\d.]+\) -- \(([-\d.]+),[-\d.]+\) \(([-\d.]+),[-\d.]+\) -- \(([-\d.]+),[-\d.]+\);/
  );

  assert.deepEqual(result.diagnostics, []);
  assert.equal(marks.length, 3);
  assert.equal(legendExamples.length, 2);
  assert.ok(Math.abs(legendRows[0] - 1.398) < 0.04, `expected first default legend row near native y, got ${legendRows[0]}`);
  assert.ok(Math.abs(legendRows[1] - 1.012) < 0.04, `expected scatter legend to use second default legend row, got ${legendRows[1]}`);
  assert.ok(trendAnchor, "expected trend legend label anchor");
  assert.ok(measurementsAnchor, "expected measurements legend label anchor");
  assert.ok(scatterExample, "expected scatter x legend example");
  assert.ok(
    Math.abs(Number(trendAnchor?.[1]) - Number(measurementsAnchor?.[1])) < 0.02,
    `expected mixed line/scatter legend labels to align like native TikZ, got ${trendAnchor?.[1]} and ${measurementsAnchor?.[1]}`
  );
  assert.ok(
    Math.abs((Number(scatterExample?.[1]) + Number(scatterExample?.[2])) / 2 - 6.23) < 0.06,
    `expected mixed scatter legend mark near the line example endpoint, got ${scatterExample?.[1]}..${scatterExample?.[2]}`
  );
  assert.ok(
    Math.abs(Number(scatterExample?.[2]) - Number(scatterExample?.[1]) - 0.1) < 0.03,
    `expected native-sized mark=x legend sample width near 0.10cm, got ${Number(scatterExample?.[2]) - Number(scatterExample?.[1])}`
  );
  assert.ok(marks.every((mark) => mark.style.stroke === "black"), "expected native scatter mark color to remain black");
  assert.equal(legendExample?.style.stroke, "black", "expected scatter legend example to remain black");
});

test("applies datavisualization cross marks style sheet to scatter visualizers", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as scatter/.list={a,b},
  style sheet=cross marks,
  a={label in legend={text=a}},
  b={label in legend={text=b}}]
data {
  x, y, set
  0, 0, a
  1, 1, b
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const expanded = preprocessTikzSource(source).source;
  const marks = result.ir.items.filter((item) => item.subtype === "axis-mark");
  const second = marks[1];
  const [firstMove, firstLine, secondMove, secondLine] = second?.commands || [];

  assert.deepEqual(result.diagnostics, []);
  assert.equal(marks.length, 2);
  assert.match(expanded, /mark=x/);
  assert.match(expanded, /mark=\+/);
  assert.ok(Math.abs(firstMove.y - firstLine.y) < 1e-9, "expected mark=+ first stroke to be horizontal");
  assert.ok(Math.abs(secondMove.x - secondLine.x) < 1e-9, "expected mark=+ second stroke to be vertical");
});

test("applies datavisualization built-in circle mark style sheets", () => {
  const renderMarks = (styleSheet) => {
    const source = String.raw`
\usetikzlibrary {datavisualization}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as scatter=samples,
  style sheet=${styleSheet}]
data {
  x, y, set
  0, 0, samples
  1, 1, samples
};`;

    const result = tikzToSvg(source, { mathRenderer: "svg-text" });
    assert.deepEqual(result.diagnostics, []);
    return result.ir.items.filter((item) => item.subtype === "axis-mark");
  };

  const starMarks = renderMarks("* mark");
  const dotMarks = renderMarks("dot mark");
  const openMarks = renderMarks("o mark");

  assert.equal(starMarks.length, 2);
  assert.equal(dotMarks.length, 2);
  assert.equal(openMarks.length, 2);
  assert.ok(starMarks.every((mark) => mark.shape === "circle"), "expected * mark to render filled circles");
  assert.ok(dotMarks.every((mark) => mark.shape === "circle"), "expected dot mark to render filled circles");
  assert.ok(openMarks.every((mark) => mark.shape === "circle"), "expected o mark to render open circles");
  assert.ok(starMarks.every((mark) => mark.style.fill !== "none"), "expected * mark to be filled");
  assert.ok(dotMarks.every((mark) => mark.style.fill !== "none"), "expected dot mark to be filled");
  assert.ok(openMarks.every((mark) => mark.style.fill === "none"), "expected o mark to be unfilled");
  assert.ok(starMarks[0].r > 0.045 && starMarks[0].r < 0.055, `expected * mark radius near 1.4pt, got ${starMarks[0].r}`);
  assert.ok(dotMarks[0].r > 0.018 && dotMarks[0].r < 0.024, `expected dot mark radius near 0.6pt, got ${dotMarks[0].r}`);
  assert.ok(openMarks[0].r > 0.045 && openMarks[0].r < 0.055, `expected o mark radius near 1.4pt, got ${openMarks[0].r}`);
});

test("supports datavisualization line visualizer no lines with marks", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as smooth line=my data,
  my data={no lines, style={mark=x, mark size=2pt}}]
data [format=function] {
  var x : interval [0:pi] samples 5;
  func y = sin(\value x r);
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plots = result.ir.items.filter((item) => item.subtype === "axis-plot");
  const marks = result.ir.items.filter((item) => item.subtype === "axis-mark");
  const texts = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(plots.length, 0);
  assert.equal(marks.length, 5);
  assert.ok(texts.includes("0.5"), "expected datavisualization clean x axis to use half-step ticks for a 0:pi range");
});

test("supports datavisualization manual tick labels with major also at", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
  [scientific axes,
   visualize as smooth line,
   all axes={grid, unit length=1.25cm},
   y axis={ticks=few},
   x axis={ticks=many, ticks and grid={major also at={(pi/2) as $\frac{\pi}{2}$}}}]
  data [format=function] {
    var x : interval [-pi/2:3*pi] samples 20;
    func y = sin(\value x r);
  };`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const texts = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  const xTicks = result.ir.items.filter((item) => item.subtype === "axis-tick" && Math.abs(item.commands[0].x - item.commands.at(-1).x) < 1e-6);
  const xTickXs = xTicks.map((tick) => tick.commands[0].x);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(texts.includes("$\\frac{\\pi}{2}$"), "expected custom pi/2 tick label from major also at");
  assert.ok(
    xTickXs.some((x) => Math.abs(x - Math.PI * 1.25) < 0.03),
    `expected manual pi/2 x tick near pi*1.25cm after unit-length scaling, got ${xTickXs.join(", ")}`
  );
});

test("supports datavisualization no tick text at shorthand with custom also-at label", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes,
  visualize as smooth line,
  x axis={ticks={major={
    no tick text at = 3,
    also at = (pi) as [{tick text padding=1ex}] $\pi$}}},
  data/format=function]
data {
  var x : interval [0:2*pi] samples 20;
  func y = sin(\value x r);
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const texts = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  const yTickTexts = result.ir.items
    .filter((item) => item.type === "textNode" && item.x < -0.2)
    .map((item) => item.text);
  const xTicks = result.ir.items.filter((item) => item.subtype === "axis-tick" && Math.abs(item.commands[0].x - item.commands.at(-1).x) < 1e-6);
  const xTickXs = xTicks.map((tick) => tick.commands[0].x);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(texts.includes("$\\pi$"), "expected custom pi tick label from also at");
  assert.equal(texts.includes("3"), false, "expected no tick text at=3 to hide the generated 3 label");
  assert.ok(yTickTexts.includes("1"), `expected the top y tick label 1 to remain visible like tikztosvg, got ${yTickTexts.join(",")}`);
  assert.ok(
    xTickXs.some((x) => Math.abs(x - (3 / (2 * Math.PI)) * 5) < 0.03),
    `expected the source tick at x=3 to remain visible while its label is hidden, got ${xTickXs.join(", ")}`
  );
});

test("places small clean polar angle tick labels outside the padded boundary", () => {
  const source = String.raw`
\usetikzlibrary { datavisualization.formats.functions, datavisualization.polar }
\tikz \datavisualization [
  scientific polar axes={clean, 0 to 90},
  angle axis={ticks={step=30}},
  radius axis={length=1cm, ticks={step=1}},
  visualize as scatter]
data point [angle=20, radius=0.5]
data point [angle=30, radius=1]
data point [angle=40, radius=1.5];`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const angleLabel = (label) => result.ir.items.find((item) => item.type === "textNode" && item.text === label);
  const thirty = angleLabel("$30^\\circ$");
  const sixty = angleLabel("$60^\\circ$");
  const ninety = angleLabel("$90^\\circ$");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(thirty, "expected 30 degree polar tick label");
  assert.ok(sixty, "expected 60 degree polar tick label");
  assert.ok(ninety, "expected 90 degree polar tick label");
  assert.ok(
    thirty.x > 1.25 && thirty.y > 0.67,
    `expected 30 degree label outside the padded quadrant boundary, got (${thirty.x}, ${thirty.y})`
  );
  assert.ok(
    sixty.y > 1.26,
    `expected 60 degree label outside the padded quadrant boundary, got y=${sixty.y}`
  );
  assert.ok(
    ninety.y > 1.28 && ninety.y < 1.37,
    `expected 90 degree endpoint label close to the native tick-text high side, got y=${ninety.y}`
  );
});

test("supports datavisualization school book axes, explicit axis bounds, and step ticks", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [school book axes,
  x axis={min value=-2,max value=4,ticks={step=1},grid,length=6cm},
  y axis={include value={-1,1},ticks={step=.5},grid,length=3cm},
  visualize as smooth line=curve,
  curve={label in legend={text=$x^2/4$}},
  data/format=function]
data {
  var x : interval [-1:3] samples 9;
  func y = \value x*\value x/4;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const axisLines = result.ir.items.filter((item) => item.subtype === "axis-line");
  const gridLines = result.ir.items.filter((item) => item.subtype === "axis-grid-line");
  const ticks = result.ir.items.filter((item) => item.subtype === "axis-tick");
  const texts = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  const xAxis = axisLines.find((item) => Math.abs(item.commands[0].y - item.commands.at(-1).y) < 1e-6);
  const yAxis = axisLines.find((item) => Math.abs(item.commands[0].x - item.commands.at(-1).x) < 1e-6);
  const schoolBookPadding = parseDimension("7.5pt", {});

  assert.deepEqual(result.diagnostics, []);
  assert.equal(axisLines.length, 2, "expected school book axes to render crossing x/y axes");
  assert.ok(
    Math.abs(xAxis.commands.at(-1).x - xAxis.commands[0].x - 2 * schoolBookPadding - 6) < 0.02,
    "expected x axis length=6cm plus native school-book padding"
  );
  assert.ok(
    Math.abs(yAxis.commands.at(-1).y - yAxis.commands[0].y - 2 * schoolBookPadding - 3) < 0.02,
    "expected y axis length=3cm plus native school-book padding"
  );
  assert.ok(gridLines.length >= 12, "expected explicit x/y grid lines from step ticks");
  assert.ok(ticks.length >= 14, "expected school book axes to draw major tick marks on the crossing axes");
  assert.ok(
    gridLines.every((line) => line.style.lineWidth > 1),
    "expected datavis major grid lines to use TikZ thin/default width rather than the old hairline width"
  );
  assert.ok(
    ticks.every((tick) => tick.style.stroke === "black" && tick.style.lineWidth > 1),
    "expected school book major ticks to use native black TikZ thin/default strokes"
  );
  assert.ok(texts.includes("−2"), "expected explicit x min tick");
  assert.ok(texts.includes("4"), "expected explicit x max tick");
  assert.ok(texts.includes("−1"), "expected included y min tick");
  assert.ok(texts.includes("1"), "expected included y max tick");
  assert.ok(texts.includes("$x^2/4$"), "expected legend label");
});

test("extends datavisualization school book grid and axes beyond the data box", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [school book axes,
  x axis={min value=-2,max value=4,ticks={step=1},grid,length=6cm},
  y axis={include value={-1,1},ticks={step=.5},grid,length=3cm},
  visualize as smooth line=curve,
  data/format=function]
data {
  var x : interval [-1:3] samples 5;
  func y = \value x*\value x/4;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const axisLines = result.ir.items.filter((item) => item.subtype === "axis-line");
  const gridLines = result.ir.items.filter((item) => item.subtype === "axis-grid-line");
  const axisLineWidth = parseDimension("0.4pt", {}) * 100;
  const padding = parseDimension("7.5pt", {});
  const gridXs = gridLines.flatMap((item) => item.commands.map((command) => command.x)).filter(Number.isFinite);
  const gridYs = gridLines.flatMap((item) => item.commands.map((command) => command.y)).filter(Number.isFinite);
  const xAxis = axisLines.find((item) => Math.abs(item.commands[0].y - item.commands.at(-1).y) < 1e-6);
  const yAxis = axisLines.find((item) => Math.abs(item.commands[0].x - item.commands.at(-1).x) < 1e-6);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.abs(Math.min(...gridXs) + padding) < 0.02, "expected horizontal grid lines to extend left by native school-book padding");
  assert.ok(Math.abs(Math.max(...gridXs) - (6 + padding)) < 0.02, "expected horizontal grid lines to extend right by native school-book padding");
  assert.ok(Math.abs(Math.min(...gridYs) + padding) < 0.02, "expected vertical grid lines to extend below by native school-book padding");
  assert.ok(Math.abs(Math.max(...gridYs) - (3 + padding)) < 0.02, "expected vertical grid lines to extend above by native school-book padding");
  assert.ok(axisLines.every((item) => Math.abs(item.style.lineWidth - axisLineWidth) < 0.01), "expected school-book axes to use native thin/default stroke width");
  assert.ok(xAxis.commands[0].x < -0.25 && xAxis.commands.at(-1).x > 6.25, "expected x axis to extend past the plot box");
  assert.ok(yAxis.commands[0].y < -0.25 && yAxis.commands.at(-1).y > 3.25, "expected y axis to extend past the plot box");
});

test("formats generated datavisualization negative tick labels with TeX-like minus glyphs", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\begin{tikzpicture}
  \datavisualization [ scientific axes=clean,
                       visualize as smooth line/.list={up,down},
                       data/format=function ]
  data [set=up] {
    var x : interval [-1:1] samples 3;
    func y = \value x;
  }
  data [set=down] {
    var x : interval [-1:1] samples 3;
    func y = -\value x;
  };
\end{tikzpicture}`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const tickLabels = result.ir.items
    .filter((item) => item.type === "textNode" && item.style?.fontScale === 0.8)
    .map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(tickLabels.includes("−1"), "expected datavis negative tick label to use the TeX minus glyph");
  assert.equal(tickLabels.includes("-1"), false, "expected generated datavis tick labels not to use ASCII hyphen-minus");
});

test("uses screen-space pin distance for datavisualization pin in data", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=0,max value=6,ticks={some}},
  y axis={include value={-1,1},ticks={step=.5},grid},
  visualize as smooth line=damped,
  damped={style={orange, thick},pin in data={text={$e^{-x/2}\sin x$},when=x is 2}},
  data/format=function]
data {
  var x : interval [0:6] samples 61;
  func y = exp(-\value x/2)*sin(\value x r);
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const pinEdge = result.ir.items.find((item) => item.subtype === "axis-pin-edge");
  const pinLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === String.raw`$e^{-x/2}\sin x$`);
  const [from, to] = pinEdge?.commands || [];
  const length = Math.hypot((to?.x || 0) - (from?.x || 0), (to?.y || 0) - (from?.y || 0));

  assert.deepEqual(result.diagnostics, []);
  assert.ok(pinEdge, "expected pin in data to render a leader edge");
  assert.ok(pinLabel, "expected pin in data to render the label text");
  assert.equal(pinLabel?.style.fontScale, 1, "expected datavis pin labels to use the native label visualizer font size");
  assert.ok(
    length > 0.7 && length < 0.85,
    `expected native pin edge to include the node[auto] side offset in addition to 3ex, got ${length}`
  );
  assert.ok(Math.abs((to?.x || 0) - 2.41) < 0.04, `expected damped sine pin leader endpoint near native x=2.41cm, got ${to?.x}`);
  assert.ok(Math.abs((to?.y || 0) - 2.4) < 0.02, `expected damped sine pin leader endpoint near native y=2.40cm, got ${to?.y}`);
  assert.ok(Math.abs((from?.x || 0) - 1.75) < 0.03, `expected native pin edge to start near the post-shifted data point x=1.75cm, got ${from?.x}`);
  assert.ok(Math.abs((from?.y || 0) - 2.01) < 0.03, `expected native pin edge to start near the post-shifted data point y=2.01cm, got ${from?.y}`);
  assert.ok(
    (pinLabel?.x || 0) - (to?.x || 0) > 0.25 && (pinLabel?.x || 0) - (to?.x || 0) < 0.38,
    `expected native node[auto, at end] pin label to sit to the right of the leader endpoint, got label x=${pinLabel?.x} and endpoint x=${to?.x}`
  );
  assert.ok(
    (pinLabel?.y || 0) - (to?.y || 0) > 0.05 && (pinLabel?.y || 0) - (to?.y || 0) < 0.11,
    `expected native node[auto, at end] pin label to sit above the leader endpoint, got label y=${pinLabel?.y} and endpoint y=${to?.y}`
  );
  const operatorSpacing = result.svg.match(/<tspan dx="([\d.]+)"[^>]*font-style="normal">sin<\/tspan>/);
  assert.ok(operatorSpacing, "expected SVG math fallback to preserve spacing before named operator sin");
  assert.ok(
    Number(operatorSpacing[1]) > 5 && Number(operatorSpacing[1]) < 7,
    `expected TeX-like spacing before \\sin after a scripted atom, got dx=${operatorSpacing?.[1]}`
  );
  assert.ok((to?.x || 0) - (from?.x || 0) > 0.6, "expected the damped sine pin label to sit farther to the right of the data point");
  assert.ok((to?.y || 0) > (from?.y || 0), "expected the damped sine pin label to sit above the data point");
});

test("supports datavisualization pin in data text prime as swapped pin side", () => {
  const renderPin = (textKey) =>
    tikzToSvg(
      String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=0,max value=6,ticks={some}},
  y axis={include value={-1,1},ticks={step=.5},grid},
  visualize as smooth line=damped,
  damped={style={orange, thick},pin in data={${textKey}={$p$},when=x is 2}},
  data/format=function]
data {
  var x : interval [0:6] samples 61;
  func y = exp(-\value x/2)*sin(\value x r);
};`,
      { mathRenderer: "svg-text" }
    );

  const normal = renderPin("text");
  const swapped = renderPin("text'");
  const normalEdge = normal.ir.items.find((item) => item.subtype === "axis-pin-edge");
  const swappedEdge = swapped.ir.items.find((item) => item.subtype === "axis-pin-edge");
  const swappedLabel = swapped.ir.items.find((item) => item.type === "textNode" && item.text === "$p$");
  const [normalFrom, normalTo] = normalEdge?.commands || [];
  const [swappedFrom, swappedTo] = swappedEdge?.commands || [];

  assert.deepEqual(normal.diagnostics, []);
  assert.deepEqual(swapped.diagnostics, []);
  assert.ok(normalEdge, "expected text pin in data to render a leader edge");
  assert.ok(swappedEdge, "expected text' pin in data to render a leader edge");
  assert.ok(swappedLabel, "expected text' pin in data to keep the label text");
  assert.ok((normalTo?.y || 0) > (normalFrom?.y || 0), "expected normal pin to sit above the data point");
  assert.ok((swappedTo?.y || 0) < (swappedFrom?.y || 0), "expected text' pin to sit below the data point");
  assert.ok(Math.abs((swappedTo?.x || 0) - 1.09) < 0.04, `expected text' pin endpoint near tikztosvg x=1.09cm, got ${swappedTo?.x}`);
  assert.ok(Math.abs((swappedTo?.y || 0) - 1.62) < 0.04, `expected text' pin endpoint near tikztosvg y=1.62cm, got ${swappedTo?.y}`);
  assert.ok(
    Math.abs((normalFrom?.x || 0) - (swappedFrom?.x || 0)) < 0.01 && Math.abs((normalFrom?.y || 0) - (swappedFrom?.y || 0)) < 0.01,
    "expected text and text' pins to use the same label visualizer coordinate"
  );
});

test("places datavisualization text-prime pin formula below the leader endpoint like native TikZ", () => {
  const result = tikzToSvg(
    String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=0,max value=6,ticks={some}},
  y axis={include value={-1,1},ticks={step=.5},grid},
  visualize as smooth line=damped,
  damped={style={orange, thick},pin in data={text'={$e^{-x/2}\sin x$},when=x is 2}},
  data/format=function]
data {
  var x : interval [0:6] samples 61;
  func y = exp(-\value x/2)*sin(\value x r);
};`,
    { mathRenderer: "svg-text" }
  );

  const edge = result.ir.items.find((item) => item.subtype === "axis-pin-edge");
  const formula = result.ir.items.find((item) => item.type === "textNode" && item.text === "$e^{-x/2}\\sin x$");
  const endpoint = edge?.commands?.[1];

  assert.deepEqual(result.diagnostics, []);
  assert.ok(edge, "expected text' pin leader edge");
  assert.ok(formula, "expected text' pin formula label");
  assert.ok(endpoint, "expected text' pin leader endpoint");
  assert.ok(
    (endpoint.y || 0) - (formula.y || 0) > 0.14,
    `expected text' pin formula center to sit visibly below the leader endpoint, got endpoint y=${endpoint?.y} label y=${formula?.y}`
  );
  assert.ok(
    (formula.y || 0) > 1.31 && (formula.y || 0) < 1.38,
    `expected text' pin formula center near native y position, got ${formula?.y}`
  );
});

test("honors pgfmathsetseed for datavisualization rand expressions", () => {
  const source = String.raw`
\pgfmathsetseed{100}
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=-1.5,max value=1.5},
  visualize as scatter,
  scatter={label in legend={text=$S$}}]
data [format=function] {
  var i : interval [0:1] samples 2;
  func y = 0;
  func x = rand + rand;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const markCenters = result.ir.items
    .filter((item) => item.subtype === "axis-mark")
    .map((item) => {
      const xs = item.commands.filter((command) => "x" in command).map((command) => command.x);
      return (Math.min(...xs) + Math.max(...xs)) / 2;
    });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(markCenters.length, 2);
  assert.ok(Math.abs(markCenters[0] - 2.4348) < 0.02, `expected first seeded rand visualization-pass point near -0.03915 data units, got ${markCenters[0]}`);
  assert.ok(Math.abs(markCenters[1] - 0.9405) < 0.02, `expected second seeded rand visualization-pass point near -0.9357 data units, got ${markCenters[1]}`);
});

test("evaluates datavisualization function declarations in source order", () => {
  const source = String.raw`
\pgfmathsetseed{100}
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=-1,max value=1},
  y axis={min value=-1,max value=1},
  visualize as scatter]
data [format=function] {
  var i : interval [0:1] samples 2;
  func y = rand;
  func x = rand;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const markCenters = result.ir.items
    .filter((item) => item.subtype === "axis-mark")
    .map((item) => {
      const xs = item.commands.filter((command) => "x" in command).map((command) => command.x);
      return (Math.min(...xs) + Math.max(...xs)) / 2;
    });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(markCenters.length, 2);
  assert.ok(Math.abs(markCenters[0] - 1.1084) < 0.02, `expected func y to consume the first visualization rand before x, got ${markCenters[0]}`);
  assert.ok(Math.abs(markCenters[1] - 0.3938) < 0.02, `expected second source-order x value near -0.84248 data units, got ${markCenters[1]}`);
});

test("evaluates common pgfmath basic functions in datavisualization function data", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as smooth line=curve,
  data/format=function]
data {
  var x : interval [0:2] samples 3;
  func y = pow(\value x,2)+floor(1.9)+ceil(.1)+round(.49)+sign(-3)+mod(5,2);
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plot = result.ir.items.find((item) => item.subtype === "axis-plot");
  const plotPoints = plot?.commands.filter((command) => Number.isFinite(command.x) && Number.isFinite(command.y)) || [];
  const texts = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(plot, "expected PGF basic math functions to produce a rendered datavis plot");
  assert.ok(Math.abs((plotPoints[0]?.x || 0) - 0) < 0.02, "expected x=0 sample to map to the left axis edge");
  assert.ok(Math.abs((plotPoints[0]?.y || 0) - 0) < 0.02, "expected y=2 sample to map to the lower axis edge");
  assert.ok(Math.abs((plotPoints.at(-1)?.x || 0) - 5) < 0.02, "expected x=2 sample to map to the right axis edge");
  assert.ok(Math.abs((plotPoints.at(-1)?.y || 0) - 3.09) < 0.03, "expected y=6 sample to map to the upper axis edge");
  assert.ok(texts.includes("2"));
  assert.ok(texts.includes("6"));
});

test("evaluates PGF math vector length, conditionals, and hyperbolic functions in datavisualization function data", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=0,max value=2,ticks={step=1},grid},
  y axis={min value=2,max value=4,ticks={step=1},grid},
  visualize as smooth line=curve,
  data/format=function]
data {
  var x : interval [0:2] samples 3;
  func y = veclen(\value x,2)+ifthenelse(\value x>1,1,0)+sinh(0)+cosh(0)-1;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plot = result.ir.items.find((item) => item.subtype === "axis-plot");
  const plotPoints = plot?.commands.filter((command) => "x" in command && "y" in command) || [];

  assert.deepEqual(result.diagnostics, []);
  assert.ok(plot, "expected extended PGF math functions to produce a rendered datavis plot");
  assert.equal(plotPoints.length, 3);
  assert.ok(Math.abs(plotPoints[0].y - 0) < 0.03, `expected veclen(0,2)=2 to map to lower axis edge, got ${plotPoints[0].y}`);
  assert.ok(plotPoints.at(-1).y > 2.8, `expected final conditional/vector sample to sit near the top of the axis, got ${plotPoints.at(-1).y}`);
});

test("evaluates PGF angle conversion and inverse trig in datavisualization function data", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=0,max value=2,ticks={step=1},grid},
  y axis={min value=0,max value=3,ticks={step=1},grid},
  visualize as line,
  data/format=function]
data {
  var x : interval [0:2] samples 3;
  func y = rad(180)/pi + atan(1)/90 + acos(0)/180 + asin(1)/90;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const plot = result.ir.items.find((item) => item.subtype === "axis-plot");
  const plotPoints = plot?.commands.filter((command) => "x" in command && "y" in command) || [];

  assert.deepEqual(result.diagnostics, []);
  assert.ok(plot, "expected PGF angle functions to produce a rendered datavis plot");
  assert.equal(plotPoints.length, 3);
  assert.ok(plotPoints.every((point) => Math.abs(point.y - 3.09) < 0.03), `expected y=3 to map to top axis edge, got ${plotPoints.map((point) => point.y).join(",")}`);
});

test("renders datavisualization plain label in data without a pin edge", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=0,max value=4,ticks={step=1},grid},
  y axis={min value=0,max value=4,ticks={step=1},grid},
  visualize as smooth line=curve,
  curve={label in data={text={$p$},when=x is 2}},
  data/format=function]
data {
  var x : interval [0:4] samples 5;
  func y = \value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const dataLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "$p$");
  const pinEdges = result.ir.items.filter((item) => item.subtype === "axis-pin-edge");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(dataLabel, "expected plain label in data to render a text node");
  assert.equal(pinEdges.length, 0, "plain label in data should not render a pin leader edge");
  assert.ok(dataLabel.x > 2.25 && dataLabel.x < 2.5, `expected native auto label to sit left of the x=2 data point, got x=${dataLabel.x}`);
  assert.ok(dataLabel.y > 1.65 && dataLabel.y < 1.9, `expected native auto label to sit above the y=2 data point, got y=${dataLabel.y}`);
});

test("renders repeated datavisualization label in data entries for one visualizer", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=0,max value=4,ticks={step=1},grid},
  y axis={min value=0,max value=4,ticks={step=1},grid},
  visualize as smooth line=curve,
  curve={
    label in data={text={$a$},when=x is 1},
    label in data={text={$b$},when=x is 3}
  },
  data/format=function]
data {
  var x : interval [0:4] samples 9;
  func y = \value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const labels = [String.raw`$a$`, String.raw`$b$`].map((text) =>
    result.ir.items.find((item) => item.type === "textNode" && item.text === text)
  );
  const pinEdges = result.ir.items.filter((item) => item.subtype === "axis-pin-edge");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(labels.every(Boolean), "expected both repeated label in data entries to render");
  assert.ok(
    labels[1].x > labels[0].x + 1,
    `expected repeated labels to use different curve positions, got ${labels.map((label) => label.x).join(", ")}`
  );
  assert.equal(pinEdges.length, 0, "plain repeated label in data entries should not render pin leader edges");
});

test("renders repeated datavisualization pin in data entries for one visualizer", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=0,max value=4,ticks={step=1},grid},
  y axis={min value=0,max value=4,ticks={step=1},grid},
  visualize as smooth line=curve,
  curve={
    pin in data={text={$a$},when=x is 1},
    pin in data={text={$b$},when=x is 3}
  },
  data/format=function]
data {
  var x : interval [0:4] samples 9;
  func y = \value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const labels = [String.raw`$a$`, String.raw`$b$`].map((text) =>
    result.ir.items.find((item) => item.type === "textNode" && item.text === text)
  );
  const pinEdges = result.ir.items.filter((item) => item.subtype === "axis-pin-edge");
  const firstEdge = pinEdges[0]?.commands || [];
  const secondEdge = pinEdges[1]?.commands || [];

  assert.deepEqual(result.diagnostics, []);
  assert.ok(labels.every(Boolean), "expected both repeated pin in data labels to render");
  assert.equal(pinEdges.length, 2, "expected one leader edge for each repeated pin in data entry");
  assert.ok(Math.abs((firstEdge[0]?.x || 0) - 1.25) < 0.03, `expected exact-hit first pin edge to start at x=1, got ${firstEdge[0]?.x}`);
  assert.ok(Math.abs((firstEdge[0]?.y || 0) - 0.773) < 0.03, `expected exact-hit first pin edge to start at y=1, got ${firstEdge[0]?.y}`);
  assert.ok(Math.abs((firstEdge[1]?.x || 0) - 0.96) < 0.08, `expected first pin leader endpoint near tikztosvg x=0.96cm, got ${firstEdge[1]?.x}`);
  assert.ok(Math.abs((firstEdge[1]?.y || 0) - 1.16) < 0.08, `expected first pin leader endpoint near tikztosvg y=1.16cm, got ${firstEdge[1]?.y}`);
  assert.ok(Math.abs((secondEdge[0]?.x || 0) - 3.75) < 0.03, `expected exact-hit second pin edge to start at x=3, got ${secondEdge[0]?.x}`);
  assert.ok(Math.abs((secondEdge[0]?.y || 0) - 2.318) < 0.03, `expected exact-hit second pin edge to start at y=3, got ${secondEdge[0]?.y}`);
  assert.ok(Math.abs((secondEdge[1]?.x || 0) - 3.49) < 0.08, `expected second pin leader endpoint near tikztosvg x=3.49cm, got ${secondEdge[1]?.x}`);
  assert.ok(Math.abs((secondEdge[1]?.y || 0) - 2.70) < 0.08, `expected second pin leader endpoint near tikztosvg y=2.70cm, got ${secondEdge[1]?.y}`);
  assert.ok(
    labels[1].x > labels[0].x + 1,
    `expected repeated pins to use different curve positions, got ${labels.map((label) => label?.x).join(", ")}`
  );
});

test("selects datavisualization labels by data index and relative position", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=0,max value=5,ticks={step=1},grid},
  y axis={min value=0,max value=5,ticks={step=1},grid},
  visualize as smooth line/.list={idx,late},
  idx={label in data={text={$i$},index=3}},
  late={style={red},label in data={text={$p$},pos=.8}},
  data/format=function]
data [set=idx] {
  var x : interval [0:5] samples 6;
  func y = \value x;
}
data [set=late] {
  var x : interval [0:5] samples 6;
  func y = \value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const indexLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "$i$");
  const posLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "$p$");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(indexLabel, "expected label in data with index=3 to render");
  assert.ok(posLabel, "expected label in data with pos=.8 to render");
  assert.ok(indexLabel.x > 1.5 && indexLabel.x < 2.4, `expected index=3 to select the third sampled point near x=2, got ${indexLabel.x}`);
  assert.ok(posLabel.x > 3.5 && posLabel.x < 4.4, `expected pos=.8 to select a late sampled point near x=4, got ${posLabel.x}`);
  assert.ok(posLabel.x > indexLabel.x + 1.5, "expected pos=.8 label to be visibly later than index=3");
});

test("places default datavisualization data labels automatically by visualizer order", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=0,max value=4,ticks={step=1},grid},
  y axis={min value=0,max value=16,ticks={step=4},grid},
  visualize as smooth line/.list={linear,squared,cubed},
  linear={label in data={text={$2x$}}},
  squared={label in data={text={$x^2$}}},
  cubed={label in data={text={$x^3$}}},
  data/format=function]
data [set=linear] {
  var x : interval [0:4] samples 9;
  func y = 2*\value x;
}
data [set=squared] {
  var x : interval [0:4] samples 9;
  func y = \value x*\value x;
}
data [set=cubed] {
  var x : interval [0:2.5] samples 9;
  func y = \value x*\value x*\value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const linear = result.ir.items.find((item) => item.type === "textNode" && item.text === "$2x$");
  const squared = result.ir.items.find((item) => item.type === "textNode" && item.text === "$x^2$");
  const cubed = result.ir.items.find((item) => item.type === "textNode" && item.text === "$x^3$");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(linear, "expected the first visualizer's default auto label");
  assert.ok(squared, "expected the second visualizer's default auto label");
  assert.ok(cubed, "expected the third visualizer's default auto label");
  assert.ok(linear.x < squared.x, `expected first auto label before second, got ${linear.x} and ${squared.x}`);
  assert.ok(squared.x <= cubed.x + 0.4, `expected later auto labels to sit near the later data region, got ${squared.x} and ${cubed.x}`);
  assert.ok(linear.x < 1.4, `expected first auto label near the first sixth of the data stream, got ${linear.x}`);
  assert.ok(squared.x > 1.6 && squared.x < 2.7, `expected second auto label near the middle, got ${squared.x}`);
  assert.ok(cubed.x > 1.8 && cubed.x < 2.8, `expected third auto label late in its data stream, got ${cubed.x}`);
  assert.ok(linear.x < 0.52, `expected first auto label center to match tikztosvg's auto anchor, got ${linear.x}`);
  assert.ok(squared.x < 2.35, `expected second auto label center to match tikztosvg's auto anchor, got ${squared.x}`);
  assert.ok(cubed.x < 2.55, `expected third auto label center to match tikztosvg's auto anchor, got ${cubed.x}`);
  assert.equal(linear.style.fontScale, 0.9, "expected default label in data to inherit every data set label small font");
  assert.equal(squared.style.fontScale, 0.9, "expected default label in data to inherit every data set label small font");
  assert.equal(cubed.style.fontScale, 0.9, "expected default label in data to inherit every data set label small font");
  assert.ok(linear.y > 0.24 && linear.y < 0.38, `expected first auto label y near the tikztosvg reference, got ${linear.y}`);
  assert.ok(squared.y > 0.78 && squared.y < 0.96, `expected second auto label y near the tikztosvg reference, got ${squared.y}`);
  assert.ok(cubed.y > 2.02 && cubed.y < 2.18, `expected third auto label y near the tikztosvg reference, got ${cubed.y}`);
});

test("honors datavisualization label in data node style sloped", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=0,max value=4,ticks={step=1},grid},
  y axis={min value=0,max value=4,ticks={step=1},grid},
  visualize as smooth line=curve,
  curve={label in data={text={$p$},node style=sloped,when=x is 2}},
  data/format=function]
data {
  var x : interval [0:4] samples 5;
  func y = \value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const dataLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "$p$");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(dataLabel, "expected sloped label in data to render a text node");
  assert.ok(dataLabel.rotation > 25 && dataLabel.rotation < 40, `expected sloped label to follow the screen-space curve tangent, got ${dataLabel.rotation}`);
});

test("colors datavisualization data labels with visualizer color", () => {
  const render = (labelOptions, globalLabelStyle = "") =>
    tikzToSvg(
      String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  ${globalLabelStyle}
  visualize as smooth line=curve,
  curve={style={red, thick},label in data={text={$p$},when=x is 2${labelOptions}}},
  data/format=function]
data {
  var x : interval [0:4] samples 5;
  func y = \value x;
};`,
      { mathRenderer: "svg-text" }
    );

  const global = render("", "every data set label/.append style={text colored},");
  const local = render(",text colored");

  const globalLabel = global.ir.items.find((item) => item.type === "textNode" && item.text === "$p$");
  const localLabel = local.ir.items.find((item) => item.type === "textNode" && item.text === "$p$");

  assert.deepEqual(global.diagnostics, []);
  assert.deepEqual(local.diagnostics, []);
  assert.ok(globalLabel, "expected globally colored data label");
  assert.ok(localLabel, "expected locally colored data label");
  assert.equal(globalLabel?.style.fill, "red", "global every data set label text colored should inherit visualizer color");
  assert.equal(localLabel?.style.fill, "red", "local label in data text colored should inherit visualizer color");
});

test("colors datavisualization pin labels with visualizer color", () => {
  const render = (pinOptions, globalLabelStyle = "") =>
    tikzToSvg(
      String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  ${globalLabelStyle}
  visualize as smooth line=curve,
  curve={style={blue, thick},pin in data={text={$q$},when=x is 2${pinOptions}}},
  data/format=function]
data {
  var x : interval [0:4] samples 5;
  func y = \value x;
};`,
      { mathRenderer: "svg-text" }
    );

  const global = render("", "every data set label/.append style={text colored},");
  const local = render(",text colored");
  const globalLabel = global.ir.items.find((item) => item.type === "textNode" && item.text === "$q$");
  const localLabel = local.ir.items.find((item) => item.type === "textNode" && item.text === "$q$");
  const globalPinEdge = global.ir.items.find((item) => item.subtype === "axis-pin-edge");

  assert.deepEqual(global.diagnostics, []);
  assert.deepEqual(local.diagnostics, []);
  assert.ok(globalLabel, "expected globally colored pin label");
  assert.ok(localLabel, "expected locally colored pin label");
  assert.equal(globalLabel?.style.fill, "blue", "global every data set label text colored should color pin label");
  assert.equal(localLabel?.style.fill, "blue", "local pin in data text colored should color pin label");
  assert.equal(globalPinEdge?.style.stroke, "black", "text colored should not recolor the pin leader edge");
});

test("keeps school-book datavisualization pin leaders on the label-visualizer coordinate", () => {
  const result = tikzToSvg(
    String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  school book axes,
  all axes={unit length=7.5mm},
  every data set label/.append style={text colored},
  visualize as smooth line/.list={rise,fall},
  rise={label in data={text=$r$, when=x is 2}},
  fall={pin in data={text=$f$, when=x is 2}},
  style sheet=strong colors,
  data/format=function]
data [set=rise] {
  var x : interval [0:4] samples 25;
  func y = .25*\value x;
}
data [set=fall] {
  var x : interval [0:4] samples 25;
  func y = 1-.2*\value x;
};`,
    { mathRenderer: "svg-text" }
  );

  const pinEdge = result.ir.items.find((item) => item.subtype === "axis-pin-edge");
  const pinLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "$f$");
  const [from, to] = pinEdge?.commands || [];

  assert.deepEqual(result.diagnostics, []);
  assert.ok(pinEdge, "expected school-book pin to render a leader edge");
  assert.ok(pinLabel, "expected school-book pin to render a label");
  assert.ok(Math.abs((from?.x || 0) - 1.625) < 0.02, `expected pin edge to start at the sampled data point, got x=${from?.x}`);
  assert.ok(Math.abs((from?.y || 0) - 0.425) < 0.02, `expected pin edge to start at the sampled data point, got y=${from?.y}`);
  assert.ok(Math.abs((to?.x || 0) - 1.8) < 0.06, `expected school-book pin leader endpoint near tikztosvg x=1.80cm, got ${to?.x}`);
  assert.ok(Math.abs((to?.y || 0) - 0.87) < 0.04, `expected school-book pin leader endpoint to overflow above y=1 like tikztosvg, got ${to?.y}`);
  assert.equal(pinLabel?.style.fill, "rgb(204 0 0)", "expected global text colored to color the pin label with the fall visualizer color");
});

test("renders datavisualization rectangle visualizer from table subattributes", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=0,max value=3,ticks={step=1},grid},
  y axis={min value=0,max value=3,ticks={step=1},grid},
  visualize as rectangles,
  rectangles={style={fill=blue!20},label in legend={text={bins}}}]
data {
  x/min x/max y/min y/max
  0     1     0     1
  1     2     0     2
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const rectangles = result.ir.items.filter((item) => item.subtype === "axis-rectangle");
  const legendExample = result.ir.items.find((item) => item.subtype === "axis-legend-example");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(rectangles.length, 2, "expected one rectangle visualizer path per table row");
  assert.ok(rectangles.every((item) => item.style.fill !== "none"), "expected rectangle visualizer fill style to be preserved");
  assert.ok(legendExample, "expected rectangle visualizer legend example");
  assert.ok(rectangles[0].commands.some((command) => Math.abs((command.x || 0) - 1.6667) < 0.03), "expected first rectangle to span one x data unit");
  assert.ok(rectangles[1].commands.some((command) => Math.abs((command.y || 0) - 2.06) < 0.03), "expected second rectangle to span two y data units");
});

test("renders datavisualization rectangle visualizer lists with remapped attributes", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={attribute=temp,min value=0,max value=4,ticks={step=1},grid},
  y axis={attribute=load,min value=0,max value=3,ticks={step=1},grid},
  visualize as rectangles/.list={cold,hot},
  cold={attribute 1=temp,attribute 2=load,style=blue,label in legend={text={cold}}},
  hot={attribute 1=temp,attribute 2=load,style=red,label in legend={text={hot}}}]
data {
  set,  temp/min, temp/max, load/min, load/max
  cold, 0,        1,        0,        1
  hot,  1,        3,        0,        2
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const rectangles = result.ir.items.filter((item) => item.subtype === "axis-rectangle");
  const legendExamples = result.ir.items.filter((item) => item.subtype === "axis-legend-example");
  const labels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(rectangles.length, 2, "expected rectangle list to render one rectangle per matching set row");
  assert.ok(labels.includes("cold"), "expected cold rectangle visualizer to create a legend row");
  assert.ok(labels.includes("hot"), "expected hot rectangle visualizer to create a legend row");
  assert.notEqual(rectangles[0].style.stroke, rectangles[1].style.stroke, "expected per-visualizer rectangle styles to be applied");
  assert.ok(rectangles[0].commands.some((command) => Math.abs((command.x || 0) - 1.25) < 0.04), "expected cold rectangle to use temp/max=1");
  assert.ok(rectangles[1].commands.some((command) => Math.abs((command.x || 0) - 3.75) < 0.04), "expected hot rectangle to use temp/max=3");
  assert.ok(rectangles[1].commands.some((command) => Math.abs((command.y || 0) - 2.06) < 0.04), "expected hot rectangle to use load/max=2");
  const legendXs = legendExamples[0].commands.map((command) => command.x).filter(Number.isFinite);
  assert.ok(Math.max(...legendXs) - Math.min(...legendXs) < 0.2, "expected rectangle legend example to use native 1ex-sized sample");
  const coldLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "cold");
  assert.ok(coldLabel.x - Math.max(...legendXs) > 0.08, "expected native gap between rectangle legend sample and text");
});

test("renders datavisualization barcharts candle stick plot", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.barcharts}
\tikz \datavisualization
 [scientific axes=clean,
  candle stick plot,
  index/source=dax]
data {
  day, dax/low, dax/high, dax/entry, dax/exit
  1,   10,      40,       18,        32
  2,   12,      42,       35,        20
  3,   18,      55,       30,        48
  4,   25,      80,       74,        42
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const wicks = result.ir.items.filter((item) => item.subtype === "axis-candlestick-wick");
  const bodies = result.ir.items.filter((item) => item.subtype === "axis-candlestick-body");
  const horizontalBoundaries = result.ir.items
    .filter((item) => item.subtype === "axis-clean-boundary")
    .filter((item) => {
      const ys = item.commands.filter((command) => "y" in command).map((command) => command.y);
      return ys.length > 1 && Math.max(...ys) - Math.min(...ys) < 1e-6;
    });
  const cleanLines = result.ir.items.filter((item) => item.subtype === "axis-clean-line");
  const axisFrame = result.ir.items.find((item) => item.subtype === "axis-frame");
  const xCleanLine = cleanLines.find((item) => item.commands.every((command) => Math.abs(command.y) < 1e-6));
  const yCleanLine = cleanLines.find((item) => item.commands.every((command) => Math.abs(command.x) < 1e-6));
  const axisTicks = result.ir.items.filter((item) => item.subtype === "axis-tick");
  const yTick20 = result.ir.items.find((item) => item.type === "textNode" && item.text === "20" && item.y > 0.15 && item.y < 0.25);
  const yTick100 = result.ir.items.find((item) => item.type === "textNode" && item.text === "100");
  const rightBoundary = Math.max(
    ...horizontalBoundaries.flatMap((item) => item.commands.filter((command) => "x" in command).map((command) => command.x))
  );
  const xTickLabels = result.ir.items
    .filter((item) => item.type === "textNode" && item.y < -0.04 && item.x >= -0.01 && item.x <= 1.21)
    .map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(wicks.length, 4, "expected one wick per candle row");
  assert.equal(bodies.length, 4, "expected one body per candle row");
  assert.equal(bodies.filter((item) => item.style.fill === "white").length, 2, "entry < exit candles should be white");
  assert.equal(bodies.filter((item) => item.style.fill === "black").length, 2, "entry >= exit candles should be black");
  assert.deepEqual(xTickLabels, ["0", "1", "2", "3", "4"], "expected native candle baseline tick plus discrete candle days");
  assert.ok(axisFrame, "expected invisible candle axis bounds for source-grid alignment");
  const frameXs = axisFrame.commands.filter((command) => "x" in command).map((command) => command.x);
  assert.ok(
    Math.abs(Math.max(...frameXs) - 1.5) < 0.03,
    `expected candle invisible bounds right edge near tikztosvg bbox x=1.5cm, got ${Math.max(...frameXs)}`
  );
  assert.ok(yTick20, "expected candle y tick label 20");
  assert.ok(yTick20.x > -0.21 && yTick20.x < -0.17, `expected y tick label 20 center near tikztosvg x=-0.19cm, got ${yTick20.x}`);
  assert.ok(yTick100, "expected candle y tick label 100");
  assert.ok(
    yTick100.x > -0.28 && yTick100.x < -0.24,
    `expected y tick label 100 center near tikztosvg x=-0.26cm, got ${yTick100.x}`
  );
  assert.ok(Math.abs(rightBoundary - 1.2) < 0.01, `expected day=4 clean boundary at native 4*3mm position, got ${rightBoundary}`);
  assert.ok(xCleanLine, "expected candle clean x axis line");
  assert.ok(yCleanLine, "expected candle clean y axis line");
  assert.ok(Math.abs(xCleanLine.commands.at(-1).x - 1.38) < 0.01, `expected candle x axis to extend to reference xEnd=1.38cm, got ${xCleanLine.commands.at(-1).x}`);
  assert.ok(Math.abs(yCleanLine.commands.at(-1).y - 1.08) < 0.01, `expected candle y axis to extend to reference yEnd=1.08cm, got ${yCleanLine.commands.at(-1).y}`);
  assert.ok(axisTicks.length >= 10, "expected candle ticks");
  const firstTick = axisTicks[0];
  assert.ok(
    Math.abs(firstTick.commands[0].y - firstTick.commands.at(-1).y) < 0.03,
    `expected candle clean ticks to use the native short 0.025cm visual length, got ${Math.abs(firstTick.commands[0].y - firstTick.commands.at(-1).y)}`
  );
  assert.ok(firstTick.style.lineWidth < 1, `expected candle clean ticks to use native 0.25pt stroke, got ${firstTick.style.lineWidth}`);
  assert.ok(horizontalBoundaries[0].style.lineWidth < 1, `expected candle clean boundary to use native 0.25pt stroke, got ${horizontalBoundaries[0].style.lineWidth}`);
  assert.ok(
    new Set(bodies.map((item) => Math.round((item.commands[0]?.x || 0) * 100) / 100)).size >= 3,
    "expected day line transformer to separate candle bodies along x"
  );
  const rightmostBodyX = Math.max(
    ...bodies.flatMap((item) => item.commands.filter((command) => "x" in command).map((command) => command.x))
  );
  assert.ok(
    rightmostBodyX > 1.25 && rightmostBodyX < 1.29,
    `expected candle body canvas-width offset to extend beyond the x=4 boundary like native PGF, got ${rightmostBodyX}`
  );
});

test("keeps scatter legend marker close to its label", () => {
  const source = String.raw`
\pgfmathsetseed{100}
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=-1,max value=1,ticks={step=.5},grid},
  y axis={min value=-1,max value=1,ticks={step=.5},grid},
  visualize as scatter,
  scatter={style={mark=*,mark size=1.5pt},label in legend={text={source ordered rand}}}]
data [format=function] {
  var i : interval [0:1] samples 2;
  func y = rand;
  func x = rand;
};`;

  const expanded = preprocessTikzSource(source).source;
  const markMatch = expanded.match(/axis legend example[^\n]*\(([-\d.]+),([-\d.]+)\)\s+circle/);
  const labelMatch = expanded.match(/\\node\[axis legend,[^\]]*\]\s+at\s+\(([-\d.]+),([-\d.]+)\)\s+\{source ordered rand\}/);
  assert.ok(markMatch, "expected datavis scatter legend marker to be generated");
  assert.ok(labelMatch, "expected datavis scatter legend label to be generated");

  const markX = Number(markMatch[1]);
  const labelX = Number(labelMatch[1]);
  assert.ok(Math.abs(markX - 6.14) < 0.06, `expected native default scatter legend marker near x=6.14cm, got ${markX}`);
  assert.ok(Math.abs(labelX - 6.315) < 0.06, `expected native default scatter legend label anchor near x=6.315cm, got ${labelX}`);
  assert.ok(labelX - markX > 0.12, `expected label to remain to the right of marker, got gap ${labelX - markX}`);
  assert.ok(labelX - markX < 0.23, `expected native-like compact marker-label gap, got ${labelX - markX}`);

  const rendered = tikzToSvg(source, { mathRenderer: "svg-text" }).svg;
  const svgLabelMatch = rendered.match(/<text x="([-\d.]+)"[^>]*text-anchor="start"[^>]*>source ordered rand<\/text>/);
  assert.ok(svgLabelMatch, "expected west-anchored legend text to render with SVG text-anchor=start");
  assert.ok(Math.abs(Number(svgLabelMatch[1]) - 631.5) < 3, `expected rendered legend text to start at native west anchor, got x=${svgLabelMatch?.[1]}`);
});

test("renders three scatter marks in datavisualization legend when requested", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  visualize as scatter/.list={a,b},
  style sheet=cross marks,
  a={label in legend={text=example a, label in legend three marks}},
  b={label in legend={text=example b}}]
data point [x=0,y=0,set=a]
data point [x=1,y=1,set=b];`;

  const expanded = preprocessTikzSource(source).source;
  const beforeFirstLabel = expanded.slice(0, expanded.indexOf("{example a}"));
  const betweenLabels = expanded.slice(expanded.indexOf("{example a}"), expanded.indexOf("{example b}"));
  const firstLegendMarks = beforeFirstLabel.match(/axis legend example/g) || [];
  const secondLegendMarks = betweenLabels.match(/axis legend example/g) || [];

  assert.equal(firstLegendMarks.length, 3, `expected label in legend three marks to render three legend marks, got ${firstLegendMarks.length}`);
  assert.equal(secondLegendMarks.length, 1, `expected default scatter legend to keep one mark, got ${secondLegendMarks.length}`);
});

test("uses explicit datavisualization legend mark coordinates", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  visualize as scatter=samples,
  samples={style={mark=*,mark size=1.5pt}, label in legend={text=custom marks,
    label in legend mark coordinates={(-2em,0),(0,0)}}}]
data point [x=0,y=0,set=samples];`;

  const expanded = preprocessTikzSource(source).source;
  const beforeLabel = expanded.slice(0, expanded.indexOf("{custom marks}"));
  const legendCircles = [...beforeLabel.matchAll(/axis legend example[^\n]*\(([-\d.]+),([-\d.]+)\)\s+circle/g)];
  const xs = legendCircles.map((match) => Number(match[1]));

  assert.equal(legendCircles.length, 2, `expected explicit legend mark coordinates to render two marks, got ${legendCircles.length}`);
  assert.ok(Math.abs(xs[0] - 5.437) < 0.06, `expected -2em legend-local offset near native explicit scatter legend position, got ${xs[0]}`);
  assert.ok(Math.abs(xs[1] - 6.14) < 0.06, `expected (0,0) legend-local coordinate near native scatter sample center, got ${xs[1]}`);
  assert.ok(xs[0] > 5.2, `expected explicit mark coordinate outside the data frame, got ${xs.join(", ")}`);
});

test("uses explicit datavisualization legend line coordinates", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization}
\tikz \datavisualization [
  school book axes,
  visualize as line=line,
  style sheet=vary dashing,
  line={label in legend={text=line,
    label in legend line coordinates={(-2em,-.25ex),(0,0)}}}]
data point [x=-1, y=-1, set=line]
data point [x=1, y=0, set=line];`;

  const expanded = preprocessTikzSource(source).source;
  const beforeLabel = expanded.slice(0, expanded.indexOf("{line}"));
  const legendPath = beforeLabel.match(/\\draw\[axis legend example[^\]]*\]\s+\(([-\d.]+),([-\d.]+)\)\s+--\s+\(([-\d.]+),([-\d.]+)\)/);

  assert.ok(legendPath, "expected explicit legend line coordinates to render a two-point line sample");
  const [, x0Raw, y0Raw, x1Raw, y1Raw] = legendPath;
  const x0 = Number(x0Raw);
  const y0 = Number(y0Raw);
  const x1 = Number(x1Raw);
  const y1 = Number(y1Raw);
  assert.ok(x0 < x1, `expected -2em legend-local coordinate to start left of the text origin, got ${x0}, ${x1}`);
  assert.ok(y0 < y1, `expected -.25ex legend-local coordinate to sit below the origin, got ${y0}, ${y1}`);
  assert.ok(beforeLabel.indexOf(".. controls") === -1, "expected explicit line coordinates to replace the default zig-zag curve");
});

test("mirrors scatter legend samples for west outside text-left legends", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  legend=west outside,
  visualize as scatter=samples,
  samples={style={mark=*,mark size=1.5pt}, label in legend={text=left scatter,
    label in legend mark coordinates={(-2em,0),(0,0)}}}]
data point [x=0,y=0,set=samples];`;

  const expanded = preprocessTikzSource(source).source;
  const beforeLabel = expanded.slice(0, expanded.indexOf("{left scatter}"));
  const legendCircles = [...beforeLabel.matchAll(/axis legend example[^\n]*\(([-\d.]+),([-\d.]+)\)\s+circle/g)];
  const labelMatch = expanded.match(/\\node\[axis legend, anchor=east[^\]]*\]\s+at\s+\(([-\d.]+),([-\d.]+)\)\s+\{left scatter\}/);
  const xs = legendCircles.map((match) => Number(match[1]));
  const labelX = Number(labelMatch?.[1]);

  assert.equal(legendCircles.length, 2, `expected explicit west legend mark coordinates to render two marks, got ${legendCircles.length}`);
  assert.ok(labelMatch, "expected west outside legend text to use east anchor");
  assert.ok(xs.every((x) => x > labelX), `expected text-left scatter samples to mirror to the right of the label, label=${labelX}, marks=${xs.join(",")}`);
  assert.ok(Math.abs(xs[0] + 0.98) < 0.08, `expected mirrored -2em mark near native west-outside x=-0.98cm, got ${xs[0]}`);
  assert.ok(Math.abs(xs[1] + 1.69) < 0.08, `expected legend origin mark near native west-outside x=-1.69cm, got ${xs[1]}`);
  assert.ok(Math.abs(labelX + 1.82) < 0.1, `expected text-left label anchor near native west-outside x=-1.82cm, got ${labelX}`);
});

test("uses sparse native-like ticks for single-point datavisualization scatter", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  visualize as scatter=samples,
  samples={label in legend={text=single point}}]
data point [x=0,y=0,set=samples];`;

  const expanded = preprocessTikzSource(source).source;
  const yTickLabels = [...expanded.matchAll(/\\node\[axis tick label, anchor=east[^\]]*\]\s+at\s+\([^)]*\)\s+\{([^{}]+)\}/g)]
    .map((match) => match[1]);
  const xTickLabels = [...expanded.matchAll(/\\node\[axis tick label, anchor=north[^\]]*\]\s+at\s+\([^)]*\)\s+\{([^{}]+)\}/g)]
    .map((match) => match[1]);

  assert.deepEqual(yTickLabels, ["0"], `expected native single-point scatter y axis to only label 0, got ${yTickLabels.join(",")}`);
  assert.deepEqual(xTickLabels, ["0"], `expected native single-point scatter x axis to only label 0, got ${xTickLabels.join(",")}`);
});

test("renders datavisualization cross marks Mercedes star as a three-spoke mark", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  visualize as scatter/.list={a,b,c},
  style sheet=cross marks,
  a={label in legend={text=example a}},
  b={label in legend={text=example b}},
  c={label in legend={text=example c}}]
data point [x=0,y=0,set=a]
data point [x=0.5,y=1,set=b]
data point [x=1,y=0.5,set=c];`;

  const expanded = preprocessTikzSource(source).source;
  const mercedesMarkCommands = expanded
    .split(/\n/)
    .filter((line) => line.includes("axis mark") || line.includes("axis legend example"));

  assert.ok(mercedesMarkCommands.some((line) => line.includes("--") && line.match(/--/g)?.length >= 3), `expected Mercedes star data mark to emit three spokes, got ${mercedesMarkCommands.join("\n")}`);
  assert.ok(mercedesMarkCommands.some((line) => line.includes("axis legend example") && line.match(/--/g)?.length >= 3), `expected Mercedes star legend mark to emit three spokes, got ${mercedesMarkCommands.join("\n")}`);
});

test("includes west-anchored datavisualization legend text in the SVG viewBox", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={logarithmic,power unit length=1cm,min value=1,max value=1000,ticks={some},grid},
  y axis={min value=0,max value=3,ticks={step=1},grid},
  visualize as line=series,
  series={style={blue, thick},label in legend={text={1 cm per decade}}}]
data {
  x, y, set
  1, 0, series
  10, 1, series
  100, 2, series
  1000, 3, series
};`;

  const svg = tikzToSvg(source, { mathRenderer: "svg-text" }).svg;
  const viewBoxMatch = svg.match(/\bviewBox="([^"]+)"/);
  const textMatch = svg.match(/<text x="([-\d.]+)"[^>]*text-anchor="start"[^>]*>1 cm per decade<\/text>/);

  assert.ok(viewBoxMatch, "expected rendered SVG to include a viewBox");
  assert.ok(textMatch, "expected west-anchored datavis legend text");

  const [viewX, , viewWidth] = viewBoxMatch[1].split(/\s+/).map(Number);
  const viewRight = viewX + viewWidth;
  const textX = Number(textMatch[1]);

  assert.ok(
    viewRight > textX + 220,
    `expected viewBox right edge to include west-anchored legend text, got right=${viewRight} and text x=${textX}`
  );
});

test("uses datavisualization native scatter defaults for mark x and 2pt size", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as scatter,
  scatter={label in legend={text=$S$}},
  data/format=function]
data {
  var x : interval [0:1] samples 2;
  func y = \value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const marks = result.ir.items.filter((item) => item.subtype === "axis-mark");
  const legendExample = result.ir.items.find((item) => item.subtype === "axis-legend-example");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(marks.length, 2);
  assert.ok(marks.every((mark) => mark.commands.length === 4), "expected scatter default x marks");
  assert.equal(legendExample?.commands.length, 4, "expected legend default x mark");
  const firstMark = marks[0];
  const halfDiagonal = Math.abs(firstMark.commands[1].x - firstMark.commands[0].x) / 2;
  assert.ok(
    halfDiagonal > 0.049 && halfDiagonal < 0.051,
    `expected native x mark half diagonal near 2pt/sqrt(2), got ${halfDiagonal}`
  );
});

test("lowers datavisualization axis labels from x and y axis options", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={label=$x$,min value=0,max value=4,ticks={step=1},grid},
  y axis={label=$f(x)$,min value=0,max value=4,ticks={step=1},grid},
  visualize as smooth line=curve,
  curve={label in legend={text=$x^2$}},
  data/format=function]
data {
  var x : interval [0:2] samples 5;
  func y = \value x*\value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const labels = result.ir.items.filter((item) => item.type === "textNode" && (item.text === "$x$" || item.text === "$f(x)$"));
  const xLabel = labels.find((item) => item.text === "$x$");
  const yLabel = labels.find((item) => item.text === "$f(x)$");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(xLabel, "expected x axis label from datavis x axis={label=...}");
  assert.ok(yLabel, "expected y axis label from datavis y axis={label=...}");
  assert.equal(xLabel.style.fontScale, 0.9, "expected datavis axis labels to use TeX small font");
  assert.equal(yLabel.style.fontScale, 0.9, "expected datavis axis labels to use TeX small font");
  assert.ok(xLabel.y < -0.65, `expected x label below the clean axis tick labels, got y=${xLabel.y}`);
  assert.ok(yLabel.x <= -1.05, `expected y label left of the clean y axis, got x=${yLabel.x}`);
});

test("carries native datavisualization role sizes into text IR", () => {
  const source = String.raw`
\usetikzlibrary{datavisualization.formats.functions}
\tikz \datavisualization[
  scientific axes=clean,
  x axis={label=$x$,min value=0,max value=1,ticks={step=.5}},
  visualize as line=a,
  a={label in legend={text=$a$}},
  legend={north east inside},
  data/format=function
] data {
  var x : interval [0:1] samples 3;
  func y = \value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const labels = result.ir.items.filter((item) => item.type === "textNode");
  const axisLabel = labels.find((item) => item.text === "$x$");
  const legendLabel = labels.find((item) => item.text === "$a$");
  const tickLabel = labels.find((item) => item.text === "0.5");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(axisLabel?.font?.sizePt, 9);
  assert.equal(legendLabel?.font?.sizePt, 8);
  assert.equal(tickLabel?.font?.sizePt, 8);
});

test("places datavisualization end labels at the positive axis ends", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes={clean,end labels},
  x axis={label=$x$,min value=0,max value=4,ticks={step=1},grid},
  y axis={label=$f(x)$,min value=0,max value=4,ticks={step=1},grid},
  visualize as smooth line=curve,
  data/format=function]
data {
  var x : interval [0:2] samples 5;
  func y = \value x*\value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const xLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "$x$");
  const yLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "$f(x)$");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(xLabel, "expected x end label");
  assert.ok(yLabel, "expected y end label");
  assert.ok(
    xLabel.x > 5.15 && xLabel.x < 5.3 && xLabel.y < -0.1,
    `expected x label at the right end of the clean x axis without excessive right offset, got (${xLabel.x},${xLabel.y})`
  );
  assert.ok(yLabel.y > 3.2 && yLabel.x < 0.4, `expected y label above the clean y axis end, got (${yLabel.x},${yLabel.y})`);
});

test("places datavisualization upright y labels close to the west data bounding box", () => {
  const source = String.raw`
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes={clean,upright labels},
  x axis={label=$x$,min value=0,max value=4,ticks={step=1},grid},
  y axis={label=$f(x)$,min value=0,max value=4,ticks={step=1},grid},
  visualize as smooth line=curve,
  data/format=function]
data {
  var x : interval [0:2] samples 5;
  func y = \value x*\value x;
};`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const yLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "$f(x)$");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(yLabel, "expected y upright label");
  assert.equal(yLabel.style.rotate || 0, 0, "expected upright y label not to rotate");
  assert.ok(
    yLabel.x > -1.25 && yLabel.x < -0.9,
    `expected upright y label left of tick labels but not far from the west data bounding box, got x=${yLabel.x}`
  );
});

test("expands neuralnetwork layers into ordinary TikZ nodes and links", () => {
  const source = String.raw`
\documentclass[tikz]{standalone}
\usepackage{neuralnetwork}
\newcommand{\xin}[2]{$x_#2$}
\newcommand{\xout}[2]{$\hat x_#2$}
\begin{document}
\begin{neuralnetwork}[height=2,layerspacing=2cm,nodespacing=1cm]
  \inputlayer[count=2, bias=false, title=Input, text=\xin]
  \hiddenlayer[count=1, bias=false]
  \linklayers
  \outputlayer[count=2, title=Output, text=\xout]
  \linklayers
\end{neuralnetwork}
\end{document}`;

  const result = tikzToSvg(source);
  const nodeIds = result.ir.items.filter((item) => item.type === "nodeBox").map((item) => item.id);
  const links = result.ir.items.filter((item) => item.type === "path" && item.style.markerEnd);
  const firstInput = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "L0-1");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(nodeIds.filter(Boolean).sort(), ["L0-1", "L0-2", "L1-1", "L2-1", "L2-2"].sort());
  assert.equal(links.length, 4);
  assert.ok(Math.abs(firstInput.y - -0.875) < 1e-6);
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "$x_1$"));
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === String.raw`$\hat x_2$`));
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
  assert.ok(
    result.ir.items.some(
      (item) =>
        item.type === "path" &&
        item.commands?.length > 8 &&
        item.commands.some((command) => command.type === "lineTo"),
    ),
    "expected tdplotdrawarc to expand into a sampled path",
  );
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
  \begin{axis}[scale only axis,width=4cm,height=2cm,xmin=0,xmax=10,ymin=0,ymax=10,at={(1cm,-2cm)}]
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

test("keeps PGFPlots unit vector ratio star axes square when spans match", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[unit vector ratio*=1 1 1,width=9cm,xmin=0,xmax=3,ymin=0,ymax=3,ticks=none]
    \addplot[mark=none] coordinates {(0,0) (3,3)};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const frame = result.ir.items.find((item) => item.subtype === "axis-frame" && item.style?.stroke !== "none");
  const plot = result.ir.items.find((item) => item.subtype === "axis-plot");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(frame, "expected axis frame");
  const pgfplotsDefaultAspect = parseDimension("240pt", {}) / parseDimension("207pt", {});
  const expectedPlotSize = 9 / pgfplotsDefaultAspect - parseDimension("45pt", {});
  assert.ok(Math.abs(frame.commands[1].x - expectedPlotSize) < 0.05, `expected PGFPlots boxed axis size near ${expectedPlotSize}, got ${frame.commands[1].x}`);
  assert.ok(Math.abs(frame.commands[2].y - expectedPlotSize) < 0.05, `expected square axis frame, got ${JSON.stringify(frame.commands)}`);
  assert.ok(Math.abs(plot.commands.at(-1).x - expectedPlotSize) < 0.05);
  assert.ok(Math.abs(plot.commands.at(-1).y - expectedPlotSize) < 0.05);
});

test("evaluates PGFPlots trig format rad before sampling function plots", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[scale only axis,width=6cm,height=2cm,xmin=0,xmax=2*pi,ymin=-1,ymax=1,domain=0:2*pi,trig format=rad]
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
  assert.ok(
    Math.max(...xs) - Math.min(...xs) > 1.65 && Math.max(...xs) - Math.min(...xs) < 1.75,
    `expected scaled PGFPlots default plot area near (240pt - 45pt) * 0.25, got ${Math.max(...xs) - Math.min(...xs)}`
  );
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
  \begin{axis}[scale only axis,width=4cm,height=2cm,xmin=-2,xmax=2,ymin=-1,ymax=1,domain=-2:2,trig format=rad]
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
  assert.equal(axisLines.every((item) => item.style.markerEnd?.kind === "stealth"), true);
  assert.equal(axisLines.every((item) => Math.abs(item.style.lineWidth - lineWidthFromPt(0.4)) < 1e-9), true);

  const explicit = tikzToSvg(String.raw`\begin{tikzpicture}
\begin{axis}[axis lines=middle,axis line width=1pt,xmin=0,xmax=1,ymin=0,ymax=1]
\addplot coordinates {(0,0) (1,1)};
\end{axis}\end{tikzpicture}`);
  const explicitAxes = explicit.ir.items.filter((item) => item.subtype === "axis-line");

  assert.deepEqual(explicit.diagnostics, []);
  assert.equal(explicitAxes.length, 2);
  assert.equal(explicitAxes.every((item) => Math.abs(item.style.lineWidth - lineWidthFromPt(1)) < 1e-9), true);
  assert.equal(explicitAxes.every((item) => item.style.markerEnd?.kind === "stealth"), true);
});

test("uses arrowed left axis lines for PGFPlots left axes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[axis lines=left,xmin=0,xmax=1,ymin=0,ymax=1]
    \addplot coordinates {(0,0) (1,1)};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const axisLines = result.ir.items.filter((item) => item.subtype === "axis-line");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(axisLines.length, 2);
  assert.equal(axisLines.every((item) => item.style.markerEnd?.kind === "stealth"), true);
  assert.equal(axisLines.every((item) => Math.abs(item.style.lineWidth - lineWidthFromPt(0.4)) < 1e-9), true);
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
  // pgfplots.scaling.code.tex computes an explicit plot box as the requested
  // width/height less its fixed 45pt description reserve. The axis arrow
  // contributes its own final 0.2pt painted extension.
  const descriptionReserve = parseDimension("45pt", {});
  const arrowPaintReserve = parseDimension("0.2pt", {});
  const expectedXLength = 11 - descriptionReserve + arrowPaintReserve;
  const expectedYLength = 3.5 - descriptionReserve + arrowPaintReserve;

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.abs(xLength - expectedXLength) < 0.01, `expected PGFPlots 45pt x description reserve, got ${xLength}`);
  assert.ok(Math.abs(yLength - expectedYLength) < 0.01, `expected PGFPlots 45pt y description reserve, got ${yLength}`);
});

test("keeps PGFPlots middle-axis container bounds tight for compare grids", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[width=11cm,height=3.5cm,xmin=0,xmax=11*pi,ymin=-0.5,ymax=7.5,axis lines=middle,xtick=\empty,ytick=\empty]
    \addplot coordinates {(0,0) (11*pi,7.5)};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const bounds = result.ir.items.find(
    (item) => item.type === "path" && item.style?.stroke === "none" && item.style?.fill === "none"
  );
  const axisLines = result.ir.items.filter((item) => item.subtype === "axis-line");
  const axisXs = axisLines.flatMap((item) => item.commands.map((command) => command.x));
  const axisYs = axisLines.flatMap((item) => item.commands.map((command) => command.y));
  const boundsXs = bounds.commands.filter((command) => "x" in command).map((command) => command.x);
  const boundsYs = bounds.commands.filter((command) => "y" in command).map((command) => command.y);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(bounds, "expected invisible axis bounds path");
  assert.ok(Math.min(...axisXs) - Math.min(...boundsXs) <= 0.08, `expected tight left bound, got ${Math.min(...boundsXs)}`);
  assert.ok(Math.max(...boundsXs) - Math.max(...axisXs) <= 0.14, `expected tight right bound, got ${Math.max(...boundsXs)}`);
  assert.ok(Math.min(...axisYs) - Math.min(...boundsYs) <= 0.08, `expected tight lower bound, got ${Math.min(...boundsYs)}`);
  assert.ok(Math.max(...boundsYs) - Math.max(...axisYs) <= 0.08, `expected tight upper bound, got ${Math.max(...boundsYs)}`);
});

test("places PGFPlots middle-axis xlabel at the axis tip instead of inflating the bbox", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[width=11cm,height=3.5cm,xmin=0,xmax=11*pi,ymin=-0.5,ymax=7.5,axis lines=middle,xtick=\empty,ytick=\empty,xlabel={\large $t$}]
    \addplot coordinates {(0,0) (11*pi,7.5)};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const xAxis = result.ir.items
    .filter((item) => item.subtype === "axis-line")
    .find((item) => item.commands[0].y === item.commands[1].y);
  const label = result.ir.items.find((item) => item.type === "textNode" && item.text === String.raw`\large $t$`);
  const xEnd = Math.max(...xAxis.commands.map((command) => command.x));

  assert.deepEqual(result.diagnostics, []);
  assert.ok(label, "expected generated x label");
  assert.ok(label.x <= xEnd + 0.25, `expected x label to stay close to axis tip ${xEnd}, got ${label.x}`);
});

test("uses PGFPlots native default axis dimensions when width and height are omitted", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[xmin=0,xmax=10,ymin=-1,ymax=1,axis lines=middle,ticks=none]
    \addplot[domain=1:9] {1/(sqrt(x)+2)};
    \addplot[domain=1:9] {-1/(sqrt(x)+2)};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const axisLines = result.ir.items.filter((item) => item.subtype === "axis-line");
  const xAxis = axisLines.find((item) => item.commands[0].y === item.commands[1].y);
  const yAxis = axisLines.find((item) => item.commands[0].x === item.commands[1].x);
  const xLength = Math.abs(xAxis.commands[1].x - xAxis.commands[0].x);
  const yLength = Math.abs(yAxis.commands[1].y - yAxis.commands[0].y);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.abs(xLength - 6.828) < 0.01, `expected PGFPlots default middle-axis width near tikztosvg baseline, got ${xLength}`);
  assert.ok(yLength > 5, `expected PGFPlots default height near 207pt after axis reservations, got ${yLength}`);
});

test("maps draw edge annotations inside PGFPlots axis coordinates", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[width=6cm,height=4cm,xmin=0,xmax=10,ymin=-1,ymax=1,axis lines=middle,ticks=none]
    \addplot[domain=1:9] {1/(sqrt(x)+2)};
    \draw[dashed,shorten >=3,shorten <=3] (4,0.5) edge [->,bend right=5] node[near end,right] {$k \to 0$} (3.5,0);
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const label = result.ir.items.find((item) => item.type === "textNode" && item.text === String.raw`$k \to 0$`);
  const edge = result.ir.items.find((item) => item.type === "path" && item.style.markerEnd && item.style.dashArray?.length);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(label, "expected the axis-local draw edge label to be preserved");
  assert.ok(edge, "expected the axis-local dashed arrow to be preserved");
  assert.ok(edge.commands[0].x > 1 && edge.commands[0].x < 2.5, `expected start point to be mapped through the axis transform, got ${edge.commands[0].x}`);
});

test("keeps PGFPlots non-boxed middle axes tight unless enlargelimits is explicit", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[xmin=0,xmax=10,axis lines=middle,ticks=none]
    \addplot[color=red,domain=1:9]{1/(sqrt(x)+2)};
    \addplot[color=blue,domain=1:9]{-1/(sqrt(x)+2)};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const yAxis = result.ir.items.find((item) => item.subtype === "axis-line" && item.commands[0].x === item.commands[1].x);
  const plots = result.ir.items.filter((item) => item.subtype === "axis-plot");
  const yValues = plots.flatMap((plot) => plot.commands.flatMap((command) => ("y" in command ? [command.y] : [])));
  const yAxisMin = Math.min(...yAxis.commands.map((command) => command.y));
  const yAxisMax = Math.max(...yAxis.commands.map((command) => command.y));

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.min(...yValues) <= yAxisMin + 0.05, `expected lower plot to reach native non-boxed y bound, got ${Math.min(...yValues)} at ${yAxisMin}`);
  assert.ok(Math.max(...yValues) >= yAxisMax - 0.05, `expected upper plot to reach native non-boxed y bound, got ${Math.max(...yValues)} at ${yAxisMax}`);
});

test("honors simple PGFPlots axis label positioning styles", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[xmin=0,xmax=10,axis lines=middle,ticks=none,xlabel={$x$},ylabel={$y$},xlabel style=right,ylabel style=below left]
    \addplot[domain=1:9]{1/(sqrt(x)+2)};
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const xLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "$x$");
  const yLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "$y$");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(xLabel.x > 6.5, `expected xlabel style=right to keep x label beyond the axis end, got ${xLabel.x}`);
  assert.ok(yLabel.x < 0, `expected ylabel style=below left to place y label left of the y-axis, got ${yLabel.x}`);
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
