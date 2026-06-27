import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

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
  assert.ok(ir.items.some((item) => item.type === "path" && item.style?.fill === "rgb(255 99 0)"));
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "Task");
  assert.ok(label);
  assert.ok(label.x > 0.2, `expected inline label to sit inside the bar, got x=${label.x}`);
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
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === "29" && item.style?.fill === "orange"));
  assert.ok(ir.items.some((item) => item.type === "path" && item.commands?.length >= 2));
});
