import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

function renderAxis(body, options = {}) {
  return tikzToSvg(String.raw`
\documentclass[tikz,border=10pt]{standalone}
\usepackage{pgfplots}
\pgfplotsset{compat=1.18}
\begin{document}
\begin{tikzpicture}
${body}
\end{tikzpicture}
\end{document}`, options);
}

function paths(ir) {
  return ir.items.filter((item) => item.type === "path");
}

function textNodes(ir) {
  return ir.items.filter((item) => item.type === "textNode");
}

function firstPlotPath(ir) {
  return paths(ir).find((item) => item.subtype === "axis-plot" || item.semanticRole === "axis-plot" || item.style?.semanticRole === "axis-plot");
}

function role(item) {
  return item.subtype || item.semanticRole || item.style?.semanticRole;
}

test("pgfplots docsrc: supports semilogxaxis environment", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{semilogxaxis}[xmin=1,xmax=100,ymin=0,ymax=2]
  \addplot coordinates {(1,0) (10,1) (100,2)};
\end{semilogxaxis}`);

  assert.equal(diagnostics.length, 0);
  const line = firstPlotPath(ir);
  const xs = line.commands.filter((command) => command.type === "lineTo").map((command) => command.x);
  assert.ok(xs[1] - xs[0] > 0.9);
});

test("pgfplots docsrc: supports semilogyaxis environment", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{semilogyaxis}[xmin=0,xmax=2,ymin=1,ymax=100]
  \addplot coordinates {(0,1) (1,10) (2,100)};
\end{semilogyaxis}`);

  assert.equal(diagnostics.length, 0);
  const line = firstPlotPath(ir);
  const ys = line.commands.filter((command) => command.type === "lineTo").map((command) => command.y);
  assert.ok(ys[1] - ys[0] > 0.9);
});

test("pgfplots docsrc: supports loglogaxis environment", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{loglogaxis}[xmin=1,xmax=100,ymin=1,ymax=100]
  \addplot coordinates {(1,1) (10,10) (100,100)};
\end{loglogaxis}`);

  assert.equal(diagnostics.length, 0);
  assert.ok(firstPlotPath(ir));
});

test("pgfplots docsrc: renders explicit xtick and ytick labels", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}[xmin=0,xmax=2,ymin=0,ymax=2,xtick={0,1,2},ytick={0,1,2}]
  \addplot coordinates {(0,0) (2,2)};
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  for (const label of ["0", "1", "2"]) {
    assert.ok(textNodes(ir).some((item) => item.text === label));
  }
});

test("pgfplots docsrc: renders xticklabels and yticklabels", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}[xmin=0,xmax=2,ymin=0,ymax=2,xtick={0,1,2},xticklabels={A,B,C},ytick={0,2},yticklabels={low,high}]
  \addplot coordinates {(0,0) (2,2)};
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  for (const label of ["A", "B", "C", "low", "high"]) {
    assert.ok(textNodes(ir).some((item) => item.text === label));
  }
});

test("pgfplots docsrc: supports xtick=data", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}[xtick=data]
  \addplot coordinates {(0,0) (2,1) (5,2)};
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  for (const label of ["0", "2", "5"]) {
    assert.ok(textNodes(ir).some((item) => item.text === label));
  }
});

test("pgfplots docsrc: respects explicit xmin xmax ymin ymax ranges", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}[xmin=-10,xmax=10,ymin=-5,ymax=5]
  \addplot coordinates {(-10,-5) (10,5)};
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  const line = firstPlotPath(ir);
  assert.ok(line.commands.some((command) => command.x === 0 && command.y === 0));
});

test("pgfplots docsrc: renders ybar coordinate plots as filled bars", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}[ybar,bar width=0.2,xmin=0,xmax=3,ymin=0,ymax=3]
  \addplot coordinates {(1,1) (2,2)};
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  assert.ok(paths(ir).filter((item) => role(item) === "axis-bar").length >= 2);
});

test("pgfplots docsrc: renders xbar coordinate plots as filled bars", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}[xbar,bar width=0.2,xmin=0,xmax=3,ymin=0,ymax=3]
  \addplot coordinates {(1,1) (2,2)};
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  assert.ok(paths(ir).filter((item) => role(item) === "axis-bar").length >= 2);
});

test("pgfplots docsrc: renders plot-level ybar option", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}[xmin=0,xmax=3,ymin=0,ymax=3]
  \addplot+[ybar,fill=blue] coordinates {(1,1) (2,2)};
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  assert.ok(paths(ir).some((item) => role(item) === "axis-bar" && item.style.fill === "blue"));
});

test("pgfplots docsrc: supports const plot step paths", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}[const plot]
  \addplot coordinates {(0,0) (1,2) (2,1)};
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  const line = firstPlotPath(ir);
  assert.ok(line.commands.filter((command) => command.type === "lineTo").length >= 4);
});

test("pgfplots docsrc: supports plot-level const plot option", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}
  \addplot+[const plot] coordinates {(0,0) (1,2) (2,1)};
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  assert.ok(firstPlotPath(ir).commands.filter((command) => command.type === "lineTo").length >= 4);
});

test("pgfplots docsrc: supports closedcycle filled coordinate plots", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}[xmin=0,xmax=2,ymin=0,ymax=2]
  \addplot+[fill=red] coordinates {(0,0) (1,1) (2,0)} \closedcycle;
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  assert.ok(paths(ir).some((item) => role(item) === "axis-closed-cycle" && item.style.fill === "red"));
});

test("pgfplots docsrc: parses inline addplot table with x y columns", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}
  \addplot table {
    x y
    0 0
    1 2
    2 1
  };
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  assert.equal(firstPlotPath(ir).commands.filter((command) => command.type === "lineTo").length, 2);
});

test("pgfplots docsrc: parses addplot table with x and y column options", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}
  \addplot table[x=t,y=value] {
    t value other
    0 0 9
    1 3 8
  };
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  assert.ok(firstPlotPath(ir));
});

test("pgfplots docsrc: parses table rows separated by TeX row separators", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}
  \addplot table[row sep=\\] {x y\\0 0\\1 1\\2 4\\};
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  assert.ok(firstPlotPath(ir));
});

test("pgfplots docsrc: loads addplot table files through resolver", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}
  \addplot table {plotdata/example.dat};
\end{axis}`, {
    pgfplotsTableResolver(file) {
      return file === "plotdata/example.dat" ? "x y\n0 0\n1 1\n2 4\n" : "";
    }
  });

  assert.equal(diagnostics.length, 0);
  assert.ok(firstPlotPath(ir));
});

test("pgfplots docsrc: renders square plot marks", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}
  \addplot+[only marks,mark=square*,blue] coordinates {(0,0) (1,1)};
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  assert.ok(paths(ir).some((item) => role(item) === "axis-mark"));
});

test("pgfplots docsrc: renders x plot marks", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}
  \addplot+[only marks,mark=x,red] coordinates {(0,0) (1,1)};
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  assert.ok(paths(ir).some((item) => role(item) === "axis-mark"));
});

test("pgfplots docsrc: treats scatter as mark plot", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}
  \addplot+[scatter,only marks] coordinates {(0,0) (1,1) (2,0)};
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  assert.ok(paths(ir).filter((item) => role(item) === "axis-mark").length >= 3);
});

test("pgfplots docsrc: supports nodes near coords", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}[nodes near coords]
  \addplot coordinates {(0,2) (1,3)};
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  assert.ok(textNodes(ir).some((item) => item.text === "2"));
  assert.ok(textNodes(ir).some((item) => item.text === "3"));
});

test("pgfplots docsrc: assigns default cycle colors to multiple plots", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}
  \addplot coordinates {(0,0) (1,1)};
  \addplot coordinates {(0,1) (1,0)};
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  const plotStyles = paths(ir).filter((item) => role(item) === "axis-plot").map((item) => item.style.stroke);
  assert.deepEqual(plotStyles.slice(0, 2), ["blue", "red"]);
});
