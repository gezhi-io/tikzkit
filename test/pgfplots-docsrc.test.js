import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { parseDimension } from "../src/math.js";

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

function axisFrameBounds(ir) {
  const frame = paths(ir).find((item) => role(item) === "axis-frame" && item.style?.stroke !== "none");
  assert.ok(frame, "expected visible axis frame");
  const xs = frame.commands.filter((command) => Number.isFinite(command.x)).map((command) => command.x);
  const ys = frame.commands.filter((command) => Number.isFinite(command.y)).map((command) => command.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  };
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

test("pgfplots docsrc: uses default function domain and ternary expressions", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}[mark=none]
  \addplot[red, samples=21] {x^2};
  \addplot[green, samples=21] {x^2 > 4 ? -x^2+8 : x^2};
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  const plotPaths = paths(ir).filter((item) => role(item) === "axis-plot");
  const red = plotPaths.find((item) => item.style?.stroke === "red");
  const green = plotPaths.find((item) => item.style?.stroke === "green");
  const redYValues = (red?.commands || []).map((command) => command.y).filter(Number.isFinite);
  const greenYValues = (green?.commands || []).map((command) => command.y).filter(Number.isFinite);

  assert.equal(plotPaths.length, 2);
  assert.ok(green, "expected ternary addplot to produce a green curve");
  assert.ok(Math.max(...greenYValues) - Math.min(...greenYValues) > 2, "expected segmented curve to have visible curvature instead of collapsing to a line");
  assert.ok(Math.min(...greenYValues) < Math.min(...redYValues), "expected segmented curve to extend below the red parabola vertex");
  assert.ok(textNodes(ir).some((item) => item.text === "-6" || item.text === "6"), "expected default function domain to use native PGFPlots x enlarge limits");
  assert.ok(textNodes(ir).some((item) => item.text === "20" || item.text === "-20"), "expected default function domain to expand y ticks beyond [-1,1]");
});

test("pgfplots docsrc: honors ticks=none for both axes", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}[ticks=none,xmin=0,xmax=2,ymin=0,ymax=2]
  \addplot coordinates {(0,0) (2,2)};
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  assert.equal(paths(ir).filter((item) => role(item) === "axis-tick").length, 0);
  assert.equal(textNodes(ir).filter((item) => item.text === "0" || item.text === "1" || item.text === "2").length, 0);
});

test("pgfplots docsrc: treats empty tick label lists as hidden labels", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}[xtick={0},xticklabels=\empty,ytick={0},yticklabels=\empty]
  \addplot coordinates {(0,0) (1,1)};
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  assert.ok(!textNodes(ir).some((item) => item.text === "\\empty"), "expected raw \\empty tick label to be hidden");
  assert.ok(!textNodes(ir).some((item) => item.text === "0"), "expected empty tick label lists to suppress fallback numeric labels");
});

test("pgfplots docsrc: renders the default boxed axis frame", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}[xmin=0,xmax=2,ymin=0,ymax=2]
  \addplot coordinates {(0,0) (2,2)};
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  const frame = paths(ir).find((item) => role(item) === "axis-frame" && item.style?.stroke !== "none");
  assert.ok(frame, "expected visible default axis frame");
  assert.ok(frame.commands.some((command) => command.x === 0 && command.y === 0));
  assert.ok(frame.commands.some((command) => command.x > 5 && command.y > 4));
});

test("pgfplots docsrc: keeps axis nodes positioned with rel axis cs", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}[xmin=0,xmax=2,ymin=0,ymax=2]
  \node[anchor=south west] at (rel axis cs:0.25,0.75) {Q};
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  const node = textNodes(ir).find((item) => item.text === "Q");
  assert.ok(node, "expected axis node to survive PGFPlots expansion");
  const frame = paths(ir).find((item) => role(item) === "axis-frame" && item.style?.stroke !== "none");
  const xs = frame.commands.filter((command) => Number.isFinite(command.x)).map((command) => command.x);
  const ys = frame.commands.filter((command) => Number.isFinite(command.y)).map((command) => command.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  assert.ok(node.x > minX && node.x < (minX + maxX) / 2, `expected x in left half of plot area, got ${node.x}`);
  assert.ok(node.y > (minY + maxY) / 2 && node.y < maxY, `expected y in upper half of plot area, got ${node.y}`);
});

test("pgfplots docsrc: preserves axis coordinate statements for later TikZ references", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}[xmin=0,xmax=2,ymin=0,ymax=2]
  \coordinate (p0) at (axis cs:1,1);
  \node (z) at (axis cs:1.5,1.5) {Z};
\end{axis}
\draw (p0) -- (z);`);

  assert.equal(diagnostics.length, 0);
  assert.ok(ir.coordinates.p0, "expected axis coordinate p0 to survive PGFPlots expansion");
  assert.ok(ir.coordinates.z, "expected axis node z to survive PGFPlots expansion");
  const bounds = axisFrameBounds(ir);
  const connector = paths(ir).at(-1);
  assert.ok(Math.abs(connector.commands[0].x - (bounds.minX + bounds.maxX) / 2) < 0.02, `expected p0 x at plot center, got ${connector.commands[0].x}`);
  assert.ok(Math.abs(connector.commands[0].y - (bounds.minY + bounds.maxY) / 2) < 0.02, `expected p0 y at plot center, got ${connector.commands[0].y}`);
});

test("pgfplots docsrc: samples tikzpicture declare function expressions", () => {
  const { ir, diagnostics } = tikzToSvg(String.raw`
\begin{tikzpicture}[
  declare function={
    normalpdf(\x,\mu,\sigma)=(2*pi*\sigma^2)^(-0.5)*exp(-(\x-\mu)^2/(2*\sigma^2));
  }]
  \begin{axis}[domain=-4:4,xmin=-4,xmax=4,samples=9]
    \addplot[domain=0:1,draw=none,fill=cyan!50] {normalpdf(x,0,1)} \closedcycle;
    \addplot[thick] {normalpdf(x,0,1)};
  \end{axis}
\end{tikzpicture}`, { mathRenderer: "svg-text" });

  assert.deepEqual(diagnostics, []);
  const plots = paths(ir).filter((item) => role(item) === "axis-plot");
  const filled = paths(ir).find((item) => role(item) === "axis-closed-cycle" && item.style?.fill === "rgb(128 255 255)");
  assert.ok(plots.length >= 1, "expected declared normalpdf function to render an axis plot");
  assert.ok(filled, "expected declared normalpdf function to render filled closed cycle");
  const labels = textNodes(ir).map((item) => item.text);
  assert.ok(labels.includes("0.4"), "expected declared normalpdf range to stay in probability density scale");
  assert.ok(!labels.includes("1000"), "expected normalpdf exponent sign to stay negative");
});

test("pgfplots docsrc: applies tikzset declared functions and pgfplotsset axis styles", () => {
  const { ir, diagnostics } = tikzToSvg(String.raw`
\begin{tikzpicture}
\tikzset{
  Red/.style={draw=none, fill=red!70!blue, fill opacity=0.75},
  toright/.style={
    anchor=mid west, xshift=2em,
    append after command={(\tikzlastnode.west) edge[thin, gray] +(-2em,0)}
  },
  declare function={
    gamma(\z)=(2.506628274631*sqrt(1/\z))*exp((-ln(1/\z)-1)*\z);
  },
  declare function={
    chisquare(\x,\nu)=((1/2)^(\nu/2))*\x^((\nu/2)-1)*exp(-(1/2)*\x)/gamma(\nu/2);
  }
}
\pgfplotsset{
  myplot/.style={
    width=12cm, height=6cm,
    xlabel=$x$, ylabel=$f(x)$,
    samples=30
  }
}
\begin{axis}[myplot]
  \addplot[Red, domain=7.82:15] {chisquare(x,3)} \closedcycle;
  \addplot[thick, smooth, domain=0.2:15] {chisquare(x,3)}
    node[toright, pos=0.2] {$\nu=4-1$};
  \node at (axis description cs:0.9,0.8) {formula};
  \coordinate (A) at (axis cs:0.5,\pgfkeysvalueof{/pgfplots/ymin});
  \coordinate (B) at (axis cs:0.5,\pgfkeysvalueof{/pgfplots/ymax});
  \draw (A) -- (B);
\end{axis}
\end{tikzpicture}`, { mathRenderer: "svg-text" });

  assert.deepEqual(diagnostics, []);
  const plots = paths(ir).filter((item) => role(item) === "axis-plot");
  const filled = paths(ir).find((item) => role(item) === "axis-closed-cycle");
  assert.ok(plots.some((item) => item.commands.length > 10), "expected chisquare line to be sampled");
  assert.equal(plots.length, 1, "expected draw=none closedcycle fill to avoid an extra open plot path");
  assert.ok(filled, "expected right-tail closedcycle fill");
  assert.equal(filled.style?.fill, "rgb(179 0 77)");
  assert.equal(filled.style?.fillOpacity, 0.75);
  assert.ok(textNodes(ir).some((item) => item.text === "$x$"), "expected xlabel from myplot style");
  const ylabel = textNodes(ir).find((item) => item.text === "$f(x)$");
  assert.equal(ylabel?.rotation, 90, "expected default pgfplots ylabel to be rotated like native TikZ");
  assert.ok(ylabel?.x < -1, `expected rotated ylabel to sit outside tick labels, got x=${ylabel?.x}`);
  const curveLabel = textNodes(ir).find((item) => item.text === "$\\nu=4-1$");
  assert.ok(curveLabel && curveLabel.x > 3 && curveLabel.y > 2, "expected inline addplot node to sit along the sampled curve");
  const formula = textNodes(ir).find((item) => item.text === "formula");
  const bounds = axisFrameBounds(ir);
  assert.ok(
    formula && formula.x > bounds.minX + (bounds.maxX - bounds.minX) * 0.85 && formula.y > bounds.minY + (bounds.maxY - bounds.minY) * 0.75,
    "expected axis description cs node near the upper right of the axis"
  );
  assert.ok(ir.coordinates.A?.x > 0 && ir.coordinates.A?.y < 0.1, "expected pgfkeysvalueof ymin coordinate to map to axis bottom");
  assert.ok(ir.coordinates.B?.x > 0 && Math.abs(ir.coordinates.B.y - bounds.maxY) < 0.02, "expected pgfkeysvalueof ymax coordinate to map to axis top");
});

test("pgfplots docsrc: preserves addplot inline node pin labels", () => {
  const { ir, diagnostics } = tikzToSvg(String.raw`
\begin{tikzpicture}[
  declare function={
    normalpdf(\x,\mu,\sigma)=(2*3.1415*\sigma^2)^(-0.5)*exp(-(\x-\mu)^2/(2*\sigma^2));
  }]
  \begin{axis}[width=8cm,height=6cm,ymax=0.6,domain=-6:6,samples=25,ticks=none]
    \addplot[smooth,thick,orange] {normalpdf(x,0,1)}
      node[pos=0.55,pin={right:$\hat{\theta}_1$}] {};
    \addplot[smooth,thick,blue] {normalpdf(x,0,2)}
      node[pos=0.7,pin={45:$\hat{\theta}_2$}] {};
  \end{axis}
\end{tikzpicture}`, { mathRenderer: "svg-text" });

  assert.deepEqual(diagnostics, []);
  const labelNodes = textNodes(ir);
  const first = labelNodes.find((item) => item.text === "$\\hat{\\theta}_1$");
  const second = labelNodes.find((item) => item.text === "$\\hat{\\theta}_2$");
  assert.ok(first, "expected first addplot pin label");
  assert.ok(second, "expected second addplot pin label");
  assert.equal(first.style?.fill, "orange");
  assert.equal(second.style?.fill, "blue");
  assert.ok(paths(ir).filter((item) => item.subtype === "pin-edge").length >= 2, "expected pin connector edges");
});

test("pgfplots docsrc: places addplot inline nodes without pos at the path end", () => {
  const { ir, diagnostics } = tikzToSvg(String.raw`
\begin{tikzpicture}
  \begin{axis}[width=8cm,height=6cm,ymin=0,ymax=0.6,xmin=-1,xmax=1,ticks=none]
    \addplot+[mark=none] coordinates {(0,0) (0,0.5)} node[above] {$\theta$};
  \end{axis}
\end{tikzpicture}`, { mathRenderer: "svg-text" });

  assert.deepEqual(diagnostics, []);
  const label = textNodes(ir).find((item) => item.text === "$\\theta$");
  assert.ok(label?.y > 3.8, `expected no-pos addplot node near the path end, got y=${label?.y}`);
  assert.equal(label.style?.fill, "blue");
});

test("pgfplots docsrc: subtracts native label reservation from boxed axis dimensions", () => {
  const { ir, diagnostics } = tikzToSvg(String.raw`
\begin{tikzpicture}
  \begin{axis}[width=8cm,height=6cm,xmin=-6,xmax=6,ymin=0,ymax=0.6,ticks=none]
    \addplot[domain=-6:6,samples=3] {0.1};
  \end{axis}
\end{tikzpicture}`, { mathRenderer: "svg-text" });

  assert.deepEqual(diagnostics, []);
  const frame = paths(ir).find((item) => item.subtype === "axis-frame" && item.style?.stroke !== "none");
  const xs = frame.commands.map((command) => command.x).filter(Number.isFinite);
  const ys = frame.commands.map((command) => command.y).filter(Number.isFinite);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  assert.ok(width > 6.3 && width < 6.5, `expected PGFPlots boxed width near 8cm - 45pt, got ${width}`);
  assert.ok(height > 4.3 && height < 4.5, `expected PGFPlots boxed height near 6cm - 45pt, got ${height}`);
});

test("pgfplots docsrc: expands addplot styles declared on tikzpicture options", () => {
  const { ir, diagnostics } = tikzToSvg(String.raw`
\begin{tikzpicture}[
  Red/.style={draw=none, fill=red!70!blue, fill opacity=0.75},
  declare function={linear(\x)=\x;}
]
\begin{axis}[xmin=0,xmax=1,ymin=0,ymax=1,samples=4]
  \addplot[Red, domain=0:1] {linear(x)} \closedcycle;
\end{axis}
\end{tikzpicture}`, { mathRenderer: "svg-text" });

  assert.deepEqual(diagnostics, []);
  const filled = paths(ir).find((item) => role(item) === "axis-closed-cycle");
  assert.equal(filled?.style?.fill, "rgb(179 0 77)");
  assert.equal(filled?.style?.fillOpacity, 0.75);
  assert.equal(paths(ir).filter((item) => role(item) === "axis-plot").length, 0);
  assert.ok(!paths(ir).some((item) => item.style?.fill === "Red"), "expected named color placeholder not to leak into SVG fill");
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

test("pgfplots docsrc: uses filecontents tables as addplot table files", () => {
  const { ir, diagnostics } = tikzToSvg(String.raw`
\documentclass{standalone}
\usepackage{pgfplots}
\begin{filecontents*}{galton.dat}
x y
1 2
2 3
3 2
\end{filecontents*}
\begin{document}
\begin{tikzpicture}
  \begin{axis}[xmin=0,xmax=4,ymin=0,ymax=4]
    \addplot[only marks,mark=*] table {galton.dat};
  \end{axis}
\end{tikzpicture}
\end{document}`);

  assert.deepEqual(diagnostics, []);
  assert.equal(paths(ir).filter((item) => role(item) === "axis-mark").length, 3);
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

test("pgfplots docsrc: renders addplot3 surf function patches and z labels", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}[xlabel=$x$, ylabel=$y$, zlabel=$z$, shader=flat]
  \addplot3[surf, domain=-1:1, y domain=-1:1, samples=5] {e^x + cos(deg(y))};
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  const surfaces = paths(ir).filter((item) => role(item) === "axis-surface");
  assert.ok(surfaces.length >= 12);
  assert.ok(surfaces.some((item) => item.style.fill && item.style.fill !== "none"));
  assert.ok(new Set(surfaces.map((item) => item.style.fill)).size > 1);
  assert.ok(textNodes(ir).some((item) => item.text === "$z$"));
});

test("pgfplots docsrc: renders 3D surf mesh strokes and rotated text z labels", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}[xlabel=$\Re(p_0)$, ylabel=$\Im(p_0)$, zlabel=$n_\text{B}(p_0)$, shader=flat]
  \addplot3[surf, opacity=0.5, domain=1:2, y domain=-1:1, samples=5] {e^x + cos(deg(y))};
\end{axis}`, { mathRenderer: "svg-text" });

  assert.equal(diagnostics.length, 0);
  const surfaces = paths(ir).filter((item) => role(item) === "axis-surface");
  assert.ok(surfaces.length > 0);
  assert.ok(surfaces.every((item) => item.style.stroke && item.style.stroke !== "none"));
  const zLabel = textNodes(ir).find((item) => item.text === "$n_\\text{B}(p_0)$");
  assert.ok(zLabel);
  assert.equal(zLabel.rotation, 90);
});

test("pgfplots docsrc: honors 3D axis tick distance options", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}[
  xlabel=$\Re(p_0)$,
  ylabel=$\Im(p_0)$,
  zlabel=$s(p_0)$,
  xmin=-1,xmax=1,ymin=-1,ymax=1,zmin=-1,zmax=1,
  surf,
  shader=flat,
  xtick distance=1,
  ytick distance=1,
  ztick distance=1,
]
  \addplot3[blue!30] coordinates {
    (-1, 1, -1) (0, 1, -1)
    (-1, 0, -1) (0, 0, -1)
  };
\end{axis}`, { mathRenderer: "svg-text" });

  assert.equal(diagnostics.length, 0);
  const labels = textNodes(ir).map((item) => item.text);
  assert.ok(labels.includes("$\\Re(p_0)$"));
  assert.ok(labels.includes("$\\Im(p_0)$"));
  assert.ok(labels.includes("$s(p_0)$"));
  assert.equal(labels.filter((label) => label === "-1").length, 3);
  assert.equal(labels.filter((label) => label === "0").length, 3);
  assert.equal(labels.filter((label) => label === "1").length, 3);
  assert.ok(!labels.includes("-0.5"));
  assert.ok(!labels.includes("0.5"));
});

test("pgfplots docsrc: treats axis-level surf addplot3 coordinates as filled 3D patches", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}[xlabel=$x$, ylabel=$y$, zlabel=$z$, surf, shader=flat]
  \addplot3[blue!30] coordinates {
    (-1, 1, -1) (0, 1, -1)
    (-1, 0, -1) (0, 0, -1)
  };
  \addplot3[orange!80] coordinates {
    (0, 0, 1) (1, 0, 1)
    (0, 1, 1) (1, 1, 1)
  };
\end{axis}`);

  assert.equal(diagnostics.length, 0);
  const surfaces = paths(ir).filter((item) => role(item) === "axis-surface");
  assert.equal(surfaces.length, 2);
  assert.ok(surfaces.every((item) => item.commands?.some((command) => command.type === "lineTo")));
  assert.ok(surfaces.some((item) => item.style.fill && item.style.fill !== "none"));
  assert.ok(textNodes(ir).some((item) => item.text === "$z$"));
});

test("pgfplots docsrc: renders ternaryaxis patch tables with grid labels and colorbar", () => {
  const { ir, diagnostics } = tikzToSvg(String.raw`
\documentclass[tikz,border=10pt]{standalone}
\usepackage{pgfplots}
\usepgfplotslibrary{ternary}
\begin{document}
\begin{tikzpicture}
\begin{ternaryaxis}[axis on top,xlabel=x,ylabel=y,zlabel=z,colorbar]
  \addplot3 [patch, shader=interp, point meta=\thisrow{C}]
  table{
    X Y Z C
    0 0 1 100
    1 0 0 0
    0.5 0.5 0 0
    0.5 0.5 0 0
    0 1 0 20
    0 0 1 100
  };
\end{ternaryaxis}
\end{tikzpicture}
\end{document}`);

  assert.deepEqual(diagnostics, []);
  assert.ok(paths(ir).filter((item) => role(item) === "ternary-patch").length >= 2);
  assert.ok(paths(ir).filter((item) => role(item) === "ternary-grid").length >= 6);
  assert.ok(paths(ir).some((item) => role(item) === "ternary-frame"));
  assert.ok(paths(ir).filter((item) => role(item) === "ternary-colorbar").length >= 8);
  for (const label of ["x", "y", "z", "100"]) {
    assert.ok(textNodes(ir).some((item) => item.text === label), `expected ternary label ${label}`);
  }
});

test("pgfplots docsrc: preserves addplot name paths for intersections and clips explicit y bounds", () => {
  const { ir, diagnostics } = renderAxis(String.raw`
\begin{axis}[domain=0:2, ymin=0, ymax=5, axis lines=left, width=8cm, height=7cm]
  \def\nB#1{1/(e^(x/#1) - 1) + 1/2}
  \addplot[name path=curve, color=red] {\nB{1}};
  \addplot[draw=none, name path=aux] {3*x};
\end{axis}
\path[name intersections={of=curve and aux, name=int}];
\draw (int-1) -- +(0.2,0.2);`);

  assert.deepEqual(diagnostics, []);
  assert.ok(ir.coordinates["int-1"], "expected named PGFPlots paths to create int-1");
  const curve = paths(ir).find((item) => role(item) === "axis-plot");
  const start = curve?.commands?.find((command) => command.type === "moveTo");
  const expectedTop = 7 - parseDimension("45pt", {});
  assert.ok(Math.abs(start?.y - expectedTop) < 0.02, `expected singular function plot to enter through ymax, got ${JSON.stringify(start)}`);
  const plotYs = paths(ir)
    .filter((item) => role(item) === "axis-plot")
    .flatMap((item) => item.commands || [])
    .filter((command) => typeof command.y === "number")
    .map((command) => command.y);
  assert.ok(Math.max(...plotYs) <= expectedTop + 0.02, `expected function plot to be clipped to ymax, got ${Math.max(...plotYs)}`);
});

test("pgfplots docsrc: expands pgfplotsinvokeforeach and samples parametric coordinate plots", () => {
  const { ir, diagnostics } = tikzToSvg(String.raw`
\begin{tikzpicture}[
  declare function={
    normal(\m,\s)=1/(2*\s*sqrt(pi))*exp(-(x-\m)^2/(2*\s^2));
  }]
\begin{axis}[width=8cm,height=5cm,samples=9,domain=-0:4,ymin=-2,ymax=6,xmin=-1,xmax=5]
  \pgfplotsinvokeforeach{1,2,3}{
    \addplot[domain=-1:1] ({#1+normal(0,0.5)}, x+#1);
    \addplot[draw=none, fill=green!50, domain=-1:0]
      ({#1+normal(0,0.5)}, x+#1) -- (axis cs:#1,#1);
    \node at (axis cs:#1,#1) {$x_{#1}$};
  }
\end{axis}
\end{tikzpicture}`, { mathRenderer: "svg-text" });

  assert.deepEqual(diagnostics, []);
  const plotPaths = paths(ir).filter((item) => role(item) === "axis-plot");
  const filled = paths(ir).filter((item) => role(item) === "axis-closed-cycle" && item.style?.fill === "rgb(128 255 128)");
  const labels = textNodes(ir).map((item) => item.text);

  assert.ok(plotPaths.length >= 3, "expected one sampled parametric curve for each foreach value");
  assert.ok(plotPaths.every((item) => item.commands.length >= 8), "expected parametric curves to be sampled, not reduced to a segment");
  assert.ok(filled.length >= 3, "expected filled parametric half-curves to close against their axis cs anchor");
  assert.ok(labels.includes("$x_{1}$") && labels.includes("$x_{2}$") && labels.includes("$x_{3}$"), "expected #1 placeholders to be expanded inside axis nodes");
  assert.ok(labels.every((label) => !String(label).includes("#1")), "expected no raw #1 placeholders in rendered labels");
});
