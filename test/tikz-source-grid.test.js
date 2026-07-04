import test from "node:test";
import assert from "node:assert/strict";
import { tikzToSvg } from "../src/index.js";
import { TIKZ_SOURCE_GRID, addTikzSourceUnitGrid } from "../web/tikz-source-grid.js";

test("injects overlay unit grid after tikzpicture options", () => {
  const source = String.raw`\usetikzlibrary {angles,calc,quotes}
\begin{tikzpicture}[angle radius=.75cm]
\node at (0,0) {A};
\end{tikzpicture}`;

  const withGrid = addTikzSourceUnitGrid(source);

  assert.match(withGrid, /\[angle radius=\.75cm\]\n  \\draw\[overlay,/);
  assert.ok(withGrid.indexOf(TIKZ_SOURCE_GRID) < withGrid.indexOf("\\node"));
  assert.match(withGrid, /grid \(50,50\);/);
});

test("leaves source unchanged when there is no tikzpicture", () => {
  assert.equal(addTikzSourceUnitGrid("\\draw (0,0)--(1,1);"), "\\draw (0,0)--(1,1);");
});

test("wraps tikz command shorthand so source grid is in the same coordinate system", () => {
  const source = String.raw`\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [scientific axes=clean] data [format=function] {
  var x : interval [0:1] samples 2;
  func y = x;
};`;

  const withGrid = addTikzSourceUnitGrid(source);

  assert.match(withGrid, /\\begin\{tikzpicture\}\n  \\draw\[overlay,/);
  assert.ok(withGrid.indexOf(TIKZ_SOURCE_GRID) < withGrid.indexOf("\\datavisualization"));
  assert.match(withGrid, /\\end\{tikzpicture\}/);
});

test("wraps tikz command shorthand with options without leaving options in the body", () => {
  const source = String.raw`\usetikzlibrary {datavisualization.formats.functions}
\tikz[baseline] \datavisualization [scientific axes=clean] data [format=function] {
  var x : interval [0:1] samples 2;
  func y = x;
};`;

  const withGrid = addTikzSourceUnitGrid(source);
  const rendered = tikzToSvg(withGrid, { mathRenderer: "svg-text" });

  assert.match(withGrid, /\\begin\{tikzpicture\}\[baseline\]\n  \\draw\[overlay,/);
  assert.doesNotMatch(withGrid, /\n\s+\[baseline\]\s+\\datavisualization/);
  assert.deepEqual(rendered.diagnostics, []);
});

test("does not scale datavisualization axes when adding a source unit grid", () => {
  const source = String.raw`\usetikzlibrary {datavisualization.formats.functions}
\tikz [scale=.55] \datavisualization [scientific axes=clean] data [format=function] {
  var x : interval [0:1] samples 2;
  func y = x;
};`;

  const withGrid = addTikzSourceUnitGrid(source);
  const rendered = tikzToSvg(withGrid, { mathRenderer: "svg-text" });
  const frame = rendered.ir.items.find((item) => item.subtype === "axis-frame");
  const xs = (frame?.commands || []).filter((command) => Number.isFinite(command.x)).map((command) => command.x);
  const width = Math.max(...xs) - Math.min(...xs);

  assert.match(withGrid, /\\begin\{tikzpicture\}\n  \\draw\[overlay,/);
  assert.doesNotMatch(withGrid, /\\begin\{tikzpicture\}\[scale=\.55\]/);
  assert.deepEqual(rendered.diagnostics, []);
  assert.ok(width > 5, `expected datavisualization frame to keep native physical width, got ${width}`);
});

test("skips datavisualization data group declarations when injecting source grid", () => {
  const source = String.raw`\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization data group {function classes} = {
  data [set=log, format=function] {
    var x : interval [0.2:2.5] samples 4;
    func y = ln(\value x);
  }
};
\tikz \datavisualization [scientific axes=clean] data group {function classes};`;

  const withGrid = addTikzSourceUnitGrid(source);
  const gridIndex = withGrid.indexOf(TIKZ_SOURCE_GRID);
  const declarationIndex = withGrid.indexOf("data group {function classes} =");
  const usageIndex = withGrid.lastIndexOf("data group {function classes}");

  assert.ok(gridIndex > declarationIndex, "expected grid to skip the data group declaration");
  assert.ok(gridIndex < usageIndex, "expected grid to wrap the visualization that uses the data group");
  assert.match(withGrid, /\\begin\{tikzpicture\}\n  \\draw\[overlay,/);
});

test("does not treat longer tikz-prefixed control words as tikz shorthand", () => {
  const source = String.raw`\usetikzlibrary {datavisualization}
\tikzdvdeclarestylesheetcolorseries{greens}{hsb}{0.3,1.3,0.8}{0,-.4,-.1}
\tikz \datavisualization [school book axes, visualize as line=normal, style sheet=greens]
data point [x=0, y=0, set=normal]
data point [x=1, y=1, set=normal];`;

  const withGrid = addTikzSourceUnitGrid(source);
  const rendered = tikzToSvg(withGrid, { mathRenderer: "svg-text" });

  assert.match(withGrid, /\\tikzdvdeclarestylesheetcolorseries/);
  assert.doesNotMatch(withGrid, /\n\s+dvdeclarestylesheetcolorseries/);
  assert.deepEqual(rendered.diagnostics, []);
});

test("source overlay grid renders without changing the TikZKit viewBox", () => {
  const source = String.raw`\begin{tikzpicture}
  \draw (0,0) -- (1,0);
\end{tikzpicture}`;

  const plain = tikzToSvg(source);
  const withGrid = tikzToSvg(addTikzSourceUnitGrid(source));
  const plainViewBox = plain.svg.match(/\sviewBox="([^"]+)"/)?.[1];
  const gridViewBox = withGrid.svg.match(/\sviewBox="([^"]+)"/)?.[1];

  assert.deepEqual(withGrid.diagnostics, []);
  assert.equal(gridViewBox, plainViewBox);
  assert.match(withGrid.svg, /class="tikz-render-svg"/);
  assert.match(withGrid.svg, /stroke-dasharray=/);
  assert.match(withGrid.svg, /M -5000 5000 L 5000 5000/);
});

test("keeps source overlay grid when TCS logo macro is expanded", () => {
  const source = String.raw`
\pgfarrowsdeclare{leaf}{leaf}{\pgfarrowsleftextend{-2pt}}{\pgfpathmoveto{\pgfpoint{-2pt}{0pt}}\pgfusepathqfill}
\newcommand{\logo}[5]{
  \begin{tikzpicture}
    \node {\textcolor{border}{T}heoretical Computer Science};
  \end{tikzpicture}
}
\begin{minipage}{3cm}
  \logo{green!80!black}{green!25!black}{green}{green!80}{leaf}
\end{minipage}`;

  const withGrid = tikzToSvg(addTikzSourceUnitGrid(source), { mathRenderer: "svg-text" });

  assert.deepEqual(withGrid.diagnostics, []);
  assert.match(withGrid.svg, /stroke-dasharray=/);
  assert.match(withGrid.svg, /M -5000 5000 L 5000 5000/);
});
