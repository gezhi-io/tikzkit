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
