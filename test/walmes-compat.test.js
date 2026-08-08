import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";

function convert(body) {
  return tikzToSvg(String.raw`
\documentclass[tikz,border=4mm]{standalone}
\usepackage{tikz}
\usepackage{pgfplots}
\usetikzlibrary{calc,intersections,patterns,calendar,decorations.pathreplacing}
\begin{document}
${body}
\end{document}`, { mathRenderer: "svg-text" });
}

test("accepts Walmes-style local definecolor statements inside foreach loops", () => {
  const { diagnostics, ir } = convert(String.raw`
\begin{tikzpicture}
  \foreach \x/\col in {1/67001F,2/2166AC} {
    \definecolor{tempcolor}{HTML}{\col}
    \draw[fill=tempcolor] (\x,0) circle (2pt);
  }
\end{tikzpicture}`);

  assert.deepEqual(diagnostics, []);
  assert.equal(ir.items.filter((item) => item.type === "path").length, 2);
});

test("evaluates pgfmathtruncatemacro variables used by Walmes color gradients", () => {
  const { diagnostics, ir } = convert(String.raw`
\begin{tikzpicture}
  \foreach \z in {0,0.5,1} {
    \pgfmathtruncatemacro{\pct}{\z*100}
    \fill[red!\pct!blue] (\z,0) rectangle ++(0.3,0.3);
  }
\end{tikzpicture}`);

  assert.deepEqual(diagnostics, []);
  assert.equal(ir.items.filter((item) => item.type === "path").length, 3);
  assert.ok(ir.items.some((item) => item.style?.fill === "rgb(128 0 128)"));
});

test("expands Walmes ifthenelse length tests inside foreach bodies", () => {
  const { diagnostics, ir } = convert(String.raw`
\begin{tikzpicture}
  \foreach \x in {1.0, 3.5, 6}{
    \ifthenelse{\lengthtest{\x pt=1 pt}}{
      \draw[align=center] (\x,0) edge[->] +(0,1)
        node[above] {90\% \\ quantile};
    }{
    }
  }
\end{tikzpicture}`);
  const paths = ir.items.filter((item) => item.type === "path");
  const labels = ir.items.filter((item) => item.type === "textNode" && item.text.includes("quantile"));

  assert.deepEqual(diagnostics, []);
  assert.equal(paths.length, 1);
  assert.equal(labels.length, 1);
  assert.ok(Math.abs(paths[0].commands[0].x - 1) < 1e-9);
});

test("expands Walmes newif boolean branches before parsing TikZ statements", () => {
  const { diagnostics, ir } = convert(String.raw`
\newif\ifopacity
\newif\ifshow
\begin{tikzpicture}
\ifopacity
  \draw (0,0) -- (1,0);
\else
  \draw (0,1) -- (1,1);
\fi
\opacitytrue
\ifopacity
  \draw (0,2) -- (1,2);
\else
  \draw (0,3) -- (1,3);
\fi
\showtrue
\ifshow
  \draw (0,4) -- (1,4);
\fi
\end{tikzpicture}`);
  const paths = ir.items.filter((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.equal(paths.length, 3);
  assert.deepEqual(paths.map((path) => path.commands[0].y), [1, 2, 4]);
});

test("registers Walmes NANN inline anchors inside code text nodes", () => {
  const { diagnostics, ir } = convert(String.raw`
\newcommand{\NANN}[2]{%
  \tikz[baseline] {\node[anchor=base,inner sep=0pt,outer sep=0pt] (#1) {#2};}%
}
\begin{tikzpicture}
  \node (code) at (0,0) {value\NANN{pr1}{\phantom{1}}};
  \draw (pr1) -- ($(pr1)+(1,0)$);
\end{tikzpicture}`);

  assert.deepEqual(diagnostics, []);
  assert.ok(ir.coordinates.pr1);
  assert.equal(ir.items.filter((item) => item.type === "path").length, 1);
});

test("registers Walmes tm and tmc math anchors with local shifts", () => {
  const { diagnostics, ir } = convert(String.raw`
\newcommand{\tm}[1]{\tikz[remember picture, overlay]\node (#1) {};}
\newcommand{\tmc}[2]{\tikz[remember picture, overlay]\node[xshift=#2 ex] (#1) {};}
\begin{tikzpicture}
  \node (eq) {$\tmc{pipe1}{0.3}|\tm{x}x$};
  \draw (pipe1) -- +(0,1);
  \draw (x) -- +(1,0);
\end{tikzpicture}`);

  assert.deepEqual(diagnostics, []);
  assert.ok(ir.coordinates.pipe1);
  assert.ok(ir.coordinates.x);
  assert.equal(ir.items.filter((item) => item.type === "path").length, 2);
});

test("expands Walmes pgfplotsinvokeforeach macro wrappers from list macros", () => {
  const { diagnostics, ir } = convert(String.raw`
\newcommand*{\ListXYvalues}{0.5, 1, 1.5}
\newcommand*\pgfplotsinvokeforeachmacro[1]{%
  \expandafter\pgfplotsinvokeforeach\expandafter{#1}}
\begin{tikzpicture}
  \pgfplotsinvokeforeachmacro\ListXYvalues{
    \draw (#1,0) -- (#1,1);
  }
\end{tikzpicture}`);

  const paths = ir.items.filter((item) => item.type === "path");
  assert.deepEqual(diagnostics, []);
  assert.equal(paths.length, 3);
  assert.deepEqual(paths.map((path) => path.commands[0].x), [0.5, 1, 1.5]);
});

test("parses clip as a legal non-drawing TikZ path command", () => {
  const { diagnostics, ir } = convert(String.raw`
\begin{tikzpicture}
  \fill[green!20] (0,0) circle (1cm);
  \begin{scope}
    \clip (0,0) circle (1cm);
    \fill[green!70] (0.4,0) circle (1cm);
  \end{scope}
\end{tikzpicture}`);

  assert.deepEqual(diagnostics, []);
  assert.equal(ir.items.filter((item) => item.type === "path").length, 2);
});

test("treats Walmes pgfplots and pgfplotstable setup statements as harmless", () => {
  const { diagnostics, svg } = convert(String.raw`
\pgfplotsset{every axis/.append style={font=\small}}
\usepgfplotslibrary{groupplots}
\pgfplotstableread{
x y
1 2
2 4
}\loadedtable
\pgfplotstabletypeset[columns={x,y}]\loadedtable
\begin{tikzpicture}
  \draw (0,0) -- (1,1);
\end{tikzpicture}`);

  assert.deepEqual(diagnostics, []);
  assert.match(svg, /<svg/);
});

test("expands PGFPlots groupplots into positioned axis drawings", () => {
  const { diagnostics, ir } = convert(String.raw`
\usepgfplotslibrary{groupplots}
\begin{tikzpicture}
  \begin{groupplot}[
    group style={group size=2 by 1, horizontal sep=0.8cm},
    width=3cm,
    height=2cm,
    xmin=0,xmax=1,ymin=0,ymax=1
  ]
    \nextgroupplot[title={A}]
      \addplot coordinates {(0,0) (1,1)};
    \nextgroupplot[title={B}]
      \addplot coordinates {(0,1) (1,0)};
  \end{groupplot}
\end{tikzpicture}`);

  assert.deepEqual(diagnostics, []);
  assert.equal(ir.items.filter((item) => item.type === "path" && item.style?.stroke === "blue").length, 2);
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === "A"));
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === "B"));
});

test("uses pgfplotstableread data in addplot table commands", () => {
  const { diagnostics, ir } = convert(String.raw`
\pgfplotstableread{
x y
0 0
1 2
2 1
}\loadedtable
\begin{tikzpicture}
  \begin{axis}[xmin=0,xmax=2,ymin=0,ymax=2]
    \addplot table[x=x,y=y] {\loadedtable};
  \end{axis}
\end{tikzpicture}`);

  assert.deepEqual(diagnostics, []);
  assert.ok(ir.items.some((item) => item.type === "path" && item.style?.stroke === "blue" && item.commands?.length === 3));
});

test("expands basic pgfgantt charts into TikZ bars and labels", () => {
  const { diagnostics, ir } = tikzToSvg(String.raw`
\documentclass{standalone}
\usepackage{pgfgantt}
\begin{document}
\begin{ganttchart}[x unit=0.5cm,y unit chart=0.45cm]{1}{4}
  \gantttitle{Plan}{4}\\
  \ganttbar{Task A}{1}{2}\\
  \ganttbar{Task B}{3}{4}
\end{ganttchart}
\end{document}`, { mathRenderer: "svg-text" });

  assert.deepEqual(diagnostics, []);
  assert.ok(ir.items.filter((item) => item.type === "path").length >= 3);
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === "Plan"));
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === "Task A"));
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === "Task B"));
});

test("keeps adjacent pgfgantt titles on one row and leaves grids disabled by default", () => {
  const { diagnostics, ir } = tikzToSvg(String.raw`
\documentclass{standalone}
\usepackage{pgfgantt}
\begin{document}
\begin{ganttchart}[x unit=0.2cm,y unit title=0.5cm,y unit chart=0.7cm,title height=1]{1}{8}
  \gantttitle{Years}{8}\\
  \gantttitle[]{2003}{4}
  \gantttitle[]{2004}{4}\\
  \ganttbar{Task}{1}{8}
\end{ganttchart}
\end{document}`, { mathRenderer: "svg-text" });

  assert.deepEqual(diagnostics, []);
  const year2003 = ir.items.find((item) => item.type === "textNode" && item.text === "2003");
  const year2004 = ir.items.find((item) => item.type === "textNode" && item.text === "2004");
  assert.ok(year2003 && year2004);
  assert.equal(year2003.y, year2004.y);
  assert.ok(year2004.x > year2003.x);
  assert.equal(ir.items.filter((item) => item.type === "path" && item.style?.stroke === "rgb(179 179 179)").length, 0);
  assert.equal(
    ir.items.filter((item) => item.type === "path" && item.style?.fill === "none" && item.style?.lineWidth < 0.8).length,
    0,
    "pgfgantt must not add grid paths until hgrid or vgrid is explicitly enabled"
  );
});

test("honors pgfgantt inline labels and bar append fill styles", () => {
  const { diagnostics, ir } = tikzToSvg(String.raw`
\documentclass{standalone}
\usepackage{pgfgantt}
\begin{document}
\begin{ganttchart}[x unit=0.2cm,y unit chart=0.7cm,inline]{1}{4}
  \ganttbar[bar/.append style={fill=orange!60!red}]{Task}{1}{4}
\end{ganttchart}
\end{document}`, { mathRenderer: "svg-text" });

  assert.deepEqual(diagnostics, []);
  assert.ok(ir.items.some((item) => item.type === "path" && item.style?.fill === "rgb(255 77 0)"));
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "Task");
  assert.ok(label);
  assert.ok(label.x > 0.2, `expected inline label to sit inside the bar, got x=${label.x}`);
});

test("maps pgfgantt hgrid and repeated vgrid styles onto consecutive grid lines", () => {
  const { diagnostics, ir } = tikzToSvg(String.raw`
\documentclass{standalone}
\usepackage{pgfgantt}
\begin{document}
\begin{ganttchart}[
  x unit=0.4cm,
  y unit title=0.5cm,
  y unit chart=0.7cm,
  hgrid=true,
  vgrid={*2{red}, *1{green}, *{10}{blue, dashed}}
]{1}{6}
  \gantttitle{Title}{6} \\
  \ganttbar{One}{1}{3} \\
  \ganttbar{Two}{4}{6}
\end{ganttchart}
\end{document}`, { mathRenderer: "svg-text" });

  assert.deepEqual(diagnostics, []);
  const gridPaths = ir.items.filter((item) => item.type === "path" && item.style?.fill === "none"
    && ["red", "rgb(0 255 0)", "blue", "black"].includes(item.style?.stroke));
  assert.ok(gridPaths.some((item) => item.style?.stroke === "red"));
  assert.ok(gridPaths.some((item) => item.style?.stroke === "rgb(0 255 0)"));
  assert.ok(gridPaths.some((item) => item.style?.stroke === "blue" && item.style?.dashArray));
  const hgridPaths = gridPaths.filter((item) => item.style?.dashArray && item.style?.stroke === "black");
  assert.ok(hgridPaths.length, "hgrid=true should lower to PGF's dotted default");
  assert.ok(hgridPaths.every((item) => Math.abs(item.style.lineWidth - lineWidthFromPt(0.4)) < 1e-9),
    "pgfgantt's default dotted hgrid must retain TikZ's normal .4pt line width");
});

test("keeps pgfgantt default hgrid and vgrid at TikZ's normal dotted width", () => {
  const { diagnostics, ir } = tikzToSvg(String.raw`
\documentclass{standalone}
\usepackage{pgfgantt}
\begin{document}
\begin{ganttchart}[x unit=.4cm,y unit title=.5cm,y unit chart=.7cm,hgrid,vgrid]{1}{4}
  \gantttitle{Plan}{4}\\
  \ganttbar{Task}{1}{4}
\end{ganttchart}
\end{document}`, { mathRenderer: "svg-text" });
  const dottedGridPaths = ir.items.filter((item) => item.type === "path"
    && item.style?.fill === "none"
    && item.style?.stroke === "black"
    && item.style?.dashArray);

  assert.deepEqual(diagnostics, []);
  assert.ok(dottedGridPaths.length >= 4, `expected horizontal plus vertical grids, got ${dottedGridPaths.length}`);
  assert.ok(dottedGridPaths.every((item) => Math.abs(item.style.lineWidth - lineWidthFromPt(0.4)) < 1e-9),
    "default hgrid/vgrid must not be thinned below TikZ's .4pt default");
});

test("uses pgfgantt title and element geometry defaults with local overrides", () => {
  const { diagnostics, ir } = tikzToSvg(String.raw`
\documentclass{standalone}
\usepackage{pgfgantt}
\begin{document}
\begin{ganttchart}[
  x unit=1cm,
  y unit title=1cm,
  y unit chart=1cm
]{1}{4}
  \gantttitle[title left shift=.25,title right shift=-.25,title top shift=.1,title height=.5]{Title}{4} \\
  \ganttgroup{Group}{1}{4} \\
  \ganttbar[bar left shift=.1,bar right shift=-.2,bar top shift=.2,bar height=.3]{Task}{2}{3}
\end{ganttchart}
\end{document}`, { mathRenderer: "svg-text" });

  assert.deepEqual(diagnostics, []);
  const rects = ir.items.filter((item) => item.type === "path" && item.commands?.length === 5);
  const title = rects.find((item) => (
    item.style?.fill === "white"
    && item.commands?.[0]?.x === 0.25
    && item.commands?.[0]?.y === -0.1
  ));
  const group = ir.items.find((item) => item.type === "path" && item.style?.fill === "black" && item.commands?.length === 9);
  const task = rects.find((item) => item.commands?.[0]?.x === 1.1);
  assert.deepEqual(title?.commands?.slice(0, 4).map(({ x, y }) => [x, y]), [[0.25, -0.1], [3.75, -0.1], [3.75, -0.6], [0.25, -0.6]]);
  assert.deepEqual(group?.commands?.slice(0, 8).map(({ x, y }) => [x, y]), [[-0.1, -1.4], [4.1, -1.4], [4.1, -1.6], [3.9, -1.7], [3.7, -1.6], [0.3, -1.6], [0.1, -1.7], [-0.1, -1.6]]);
  assert.deepEqual(task?.commands?.slice(0, 4).map(({ x, y }) => [x, y]), [[1.1, -2.2], [2.8, -2.2], [2.8, -2.5], [1.1, -2.5]]);

  const titleLabel = ir.items.find((item) => item.type === "textNode" && item.text === "Title");
  const groupLabel = ir.items.find((item) => item.type === "textNode" && item.text === "Group");
  const taskLabel = ir.items.find((item) => item.type === "textNode" && item.text === "Task");
  assert.equal(titleLabel?.font?.sizePt, 9);
  assert.equal(groupLabel?.font?.sizePt, 10);
  assert.equal(groupLabel?.font?.weight, 700);
  assert.equal(taskLabel?.font?.sizePt, 10);
});

test("lowers named pgfgantt links through source anchors with auto and finish-to-start routes", () => {
  const { diagnostics, ir } = tikzToSvg(String.raw`
\documentclass{standalone}
\usepackage{pgfgantt}
\begin{document}
\begin{ganttchart}[x unit=.5cm,y unit chart=.7cm,link/.append style={blue,very thick}]{1}{12}
  \ganttbar[name=research]{Research}{2}{3} \\
  \ganttbar[name=prototype]{Prototype}{5}{7} \\
  \ganttbar[name=release]{Release}{9}{11}
  \ganttlink{research}{prototype}
  \ganttlink[link type=f-s,link label=F--S]{prototype}{release}
\end{ganttchart}
\end{document}`, { mathRenderer: "svg-text" });

  assert.deepEqual(diagnostics, []);
  const links = ir.items.filter((item) => item.type === "path" && item.style?.stroke === "blue" && item.style?.markerEnd?.kind === "latex");
  assert.equal(links.length, 2);
  assert.ok(links.some((item) => item.commands.length >= 4), "expected auto link to route with a rounded RDR polyline");
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === "F--S"));
});

test("expands pgfgantt linked elements into the preceding element dependency", () => {
  const { diagnostics, ir } = tikzToSvg(String.raw`
\documentclass{standalone}
\usepackage{pgfgantt}
\begin{document}
\begin{ganttchart}[x unit=.5cm,y unit chart=.7cm,link/.append style={red,thick}]{1}{8}
  \ganttbar{First}{1}{2} \\
  \ganttlinkedbar{Second}{4}{5} \\
  \ganttlinkedmilestone{Done}{6}
\end{ganttchart}
\end{document}`, { mathRenderer: "svg-text" });

  assert.deepEqual(diagnostics, []);
  const links = ir.items.filter((item) => item.type === "path" && item.style?.stroke === "red" && item.style?.markerEnd?.kind === "latex");
  assert.equal(links.length, 2);
  assert.ok(ir.items.some((item) => item.type === "path" && item.style?.fill === "black"), "expected the linked milestone to retain pgfgantt's black diamond default");
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === "Second"));
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === "Done"));
});

test("renders pgfgantt group peaks and carries them through ganttlinkedgroup", () => {
  const { diagnostics, ir } = tikzToSvg(String.raw`
\documentclass{standalone}
\usepackage{pgfgantt}
\begin{document}
\begin{ganttchart}[
  x unit=1cm,
  y unit chart=1cm,
  group left peak tip position=.25,
  group left peak width=.6,
  group left peak height=.2,
  group right peak tip position=.75,
  group right peak width=.4,
  group right peak height=.15,
  link/.append style={blue,thick}
]{1}{8}
  \ganttgroup{Design}{1}{4} \\
  \ganttlinkedgroup{Delivery}{5}{8}
\end{ganttchart}
\end{document}`, { mathRenderer: "svg-text" });

  assert.deepEqual(diagnostics, []);
  const groups = ir.items.filter((item) => item.type === "path" && item.style?.fill === "black" && item.commands?.length === 9);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].commands.slice(0, 8).map(({ x, y }) => [x, y]), [[-0.1, -0.4], [4.1, -0.4], [4.1, -0.6], [3.8, -0.75], [3.7, -0.6], [0.5, -0.6], [0.05, -0.8], [-0.1, -0.6]]);
  assert.ok(ir.items.some((item) => item.type === "path" && item.style?.stroke === "blue" && item.style?.markerEnd?.kind === "latex"));
});

test("splits numeric pgfgantt bar progress into completed and incomplete styles", () => {
  const { diagnostics, ir } = tikzToSvg(String.raw`
\documentclass{standalone}
\usepackage{pgfgantt}
\begin{document}
\begin{ganttchart}[
  x unit=1cm,
  y unit chart=1cm,
  bar/.append style={fill=blue},
  bar incomplete/.append style={fill=red}
]{1}{4}
  \ganttbar[progress=37]{Task}{1}{4}
\end{ganttchart}
\end{document}`, { mathRenderer: "svg-text" });

  assert.deepEqual(diagnostics, []);
  assert.ok(ir.items.some((item) => item.type === "path" && item.style?.fill === "blue"));
  assert.ok(ir.items.some((item) => item.type === "path" && item.style?.fill === "red"));
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === "37\\% complete"));
});

test("honors pgfgantt numeric progress label text and font overrides", () => {
  const { diagnostics, ir } = tikzToSvg(String.raw`
\documentclass{standalone}
\usepackage{pgfgantt}
\begin{document}
\begin{ganttchart}[progress label text={#1~pct}]{1}{2}
  \ganttbar[progress=50,bar progress label font=\tiny]{Task}{1}{2}
\end{ganttchart}
\end{document}`, { mathRenderer: "svg-text" });

  assert.deepEqual(diagnostics, []);
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "50~pct");
  assert.equal(label?.font?.sizePt, 5);
});

test("expands numeric and comma-list pgfgantt title lists into adjacent title cells", () => {
  const { diagnostics, ir } = tikzToSvg(String.raw`
\documentclass{standalone}
\usepackage{pgfgantt}
\begin{document}
\begin{ganttchart}[x unit=1cm,y unit title=1cm]{1}{7}
  \gantttitlelist{1,3,...,7}{1} \\
  \gantttitlelist{Mon,Wed,Fri}{1}
\end{ganttchart}
\end{document}`, { mathRenderer: "svg-text" });

  assert.deepEqual(diagnostics, []);
  const labels = ir.items.filter((item) => item.type === "textNode").filter((item) => ["1", "3", "5", "7", "Mon", "Wed", "Fri"].includes(item.text));
  assert.equal(labels.length, 7);
  const numberLabels = labels.filter((item) => ["1", "3", "5", "7"].includes(item.text));
  assert.ok(numberLabels[1].x > numberLabels[0].x);
  assert.equal(numberLabels[0].y, numberLabels[1].y);
  const dayLabels = labels.filter((item) => ["Mon", "Wed", "Fri"].includes(item.text));
  assert.equal(dayLabels[0].y, dayLabels[1].y);
  assert.ok(dayLabels[0].y < numberLabels[0].y);
});

test("uses TeX control-word boundaries for dynamic coordinate names", () => {
  const { diagnostics, ir } = convert(String.raw`
\begin{tikzpicture}
  \foreach \x in {0,1} {
    \foreach \z in {0,1} {
      \coordinate (v\x0\z) at (\x,0,\z);
    }
  }
  \draw (v000) -- (v101);
\end{tikzpicture}`);

  assert.deepEqual(diagnostics, []);
  assert.ok(ir.coordinates.v000);
  assert.ok(ir.coordinates.v101);
});

test("parses Walmes matrix name-at-options ordering and cell anchors", () => {
  const { diagnostics, ir } = convert(String.raw`
\begin{tikzpicture}
  \tikzset{mtx/.style={matrix of math nodes,left delimiter={[},right delimiter={]}}}
  \matrix (X) at (2,2) [mtx,nodes={anchor=east}] {
    1 & 0 & 1 \\
    1 & 1 & -1 \\
  };
  \node[above] at (X-1-2.north) {$A$};
\end{tikzpicture}`);

  assert.deepEqual(diagnostics, []);
  assert.ok(ir.coordinates["X-1-2"]);
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === "$A$"));
});

test("interprets Walmes node matrices with bare bracket delimiters and anchors", () => {
  const { diagnostics, ir, svg } = convert(String.raw`
\begin{tikzpicture}[>=latex]
  \node (m1) [matrix of math nodes, left delimiter=[, right delimiter={]}] { \theta_0 \\ \theta_1 \\ };
  \node (m2) [right of=m1, node distance=2.5cm, matrix of math nodes, left delimiter=[, right delimiter={]}] { \vartheta \\ \theta_p \\ };
  \path[->] (m1.south) edge[bend right=70] node[midway, below] {reparametriza\c{c}\~{a}o} (m2.south);
\end{tikzpicture}`);

  assert.deepEqual(diagnostics, []);
  assert.ok(ir.coordinates.m1);
  assert.ok(ir.coordinates.m2);
  assert.ok(ir.coordinates["m1-1-1"]);
  assert.ok(ir.coordinates["m2-2-1"]);
  assert.ok(ir.items.some((item) => item.type === "path" && item.commands?.some((command) => command.type === "curveTo")));
  assert.ok(ir.items.some((item) => item.type === "textNode" && /reparametriza/.test(item.text)));
  assert.doesNotMatch(svg, /\\(?:theta|vartheta)/);
  assert.match(svg, /ϑ/);
});

test("expands Walmes zero-use macro arguments without requiring a following braced argument", () => {
  const { diagnostics, ir } = convert(String.raw`
\newcommand{\target}[1]{%
  \foreach \r in {1,0.5} {
    \draw (0,0) circle (\r cm);
  }
}
\begin{tikzpicture}
  \target
  \draw (0,0) -- (1,0);
\end{tikzpicture}`);

  assert.deepEqual(diagnostics, []);
  assert.equal(ir.items.filter((item) => item.type === "path").length, 3);
});

test("expands Walmes delimited def macros with parenthesized arguments", () => {
  const { diagnostics, ir } = convert(String.raw`
\def\ellipseman(#1, #2);{%
  \draw [thick] (#1, #2) ellipse [x radius = 0.3cm, y radius = 0.6cm];
}
\begin{tikzpicture}
  \foreach \x in {0,1} {
    \ellipseman(\x, 7.2);
  }
\end{tikzpicture}`);

  assert.deepEqual(diagnostics, []);
  assert.equal(ir.items.filter((item) => item.shape === "ellipse").length, 2);
});

test("expands TikZ calendar days into visible date nodes and anchors", () => {
  const { diagnostics, ir } = convert(String.raw`
\begin{tikzpicture}[
  every calendar/.style={week list sunday,month label above centered,day xshift=1em,day yshift=1em,
    if={(Sunday) [blue!75]}, if={(Saturday) [black!50]}}
]
  \calendar (Feb) [dates=2016-02-01 to 2016-02-last] if (equals=02-29) [orange];
  \draw (Feb-2016-02-29) -- +(1,0);
\end{tikzpicture}`);

  assert.deepEqual(diagnostics, []);
  assert.ok(ir.coordinates["Feb-2016-02-29"], "expected leap-day coordinate anchor");
  assert.ok(
    ir.items.some(
      (item) => item.type === "textNode" && item.text === "29" && ["orange", "rgb(255 128 0)"].includes(item.style?.fill)
    )
  );
  assert.ok(ir.items.some((item) => item.type === "path" && item.commands?.length >= 2));
});
