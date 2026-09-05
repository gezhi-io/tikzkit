import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { createAxisGeometry } from "../src/pgfplots/geometry.js";
import { renderAxisTicks } from "../src/pgfplots/ticks.js";

function renderTicks(axisOptions, ranges = { xMin: 0, xMax: 4, yMin: 0, yMax: 1 }) {
  const options = {
    width: "8cm",
    height: "5cm",
    xtick: "{0,4}",
    ytick: "{0,1}",
    ...axisOptions
  };
  return renderAxisTicks(options, [], ranges, createAxisGeometry(options, ranges));
}

test("pgfplots renders independent numeric extra x and y ticks", () => {
  const commands = renderTicks({
    "extra x ticks": "{2.5}",
    "extra y ticks": "{0.507297}"
  });

  assert.ok(commands.some((command) => command.endsWith("{2.5};")), commands.join("\n"));
  assert.ok(commands.some((command) => command.endsWith("{0.51};")), commands.join("\n"));
});

test("pgfplots extra ticks do not reuse position-bound ordinary label lists", () => {
  const commands = renderTicks({
    xticklabels: "{left,right}",
    "extra x ticks": "{2.5}"
  });

  assert.ok(commands.some((command) => command.endsWith("{left};")), commands.join("\n"));
  assert.ok(commands.some((command) => command.endsWith("{right};")), commands.join("\n"));
  assert.ok(commands.some((command) => command.endsWith("{2.5};")), commands.join("\n"));
});

test("pgfplots extra tick styles control labels, tick strokes, and their own major grid", () => {
  const commands = renderTicks({
    grid: "none",
    "extra x ticks": "{1,3}",
    "extra x tick labels": "{start,stop}",
    "extra x tick style": "grid=major,tick style={red,line width=0.8pt},tick label style={rotate=90,anchor=east,yshift=-2pt}"
  });

  const start = commands.find((command) => command.endsWith("{start};"));
  const stop = commands.find((command) => command.endsWith("{stop};"));
  assert.match(start || "", /anchor=east/);
  assert.match(start || "", /rotate=90/);
  assert.match(start || "", /yshift=-2pt/);
  assert.match(stop || "", /rotate=90/);
  assert.ok(commands.some((command) => /\\draw\[axis tick[^\]]*red[^\]]*line width=0\.8pt/.test(command)), commands.join("\n"));
  assert.equal(commands.filter((command) => command.includes("\\draw[axis grid")).length, 2);
});

test("pgfplots extra tick templates retain math wrappers and local number formatting", () => {
  const commands = renderTicks({
    "extra y ticks": "{0.125,0.875}",
    "extra y tick label": String.raw`{$\pgfmathprintnumber[fixed,fixed zerofill,precision=2]{\tick}\,\mathrm{V}$}`,
    "extra tick style": String.raw`tick label style={font=\scriptsize,text=blue}`
  });

  const labels = commands.filter((command) => command.includes("\\mathrm{V}"));
  assert.equal(labels.length, 2, commands.join("\n"));
  assert.ok(labels.some((command) => command.endsWith(String.raw`{$0.13\,\mathrm{V}$};`)));
  assert.ok(labels.some((command) => command.endsWith(String.raw`{$0.88\,\mathrm{V}$};`)));
  assert.ok(labels.every((command) => command.includes(String.raw`font=\scriptsize`)));
  assert.ok(labels.every((command) => command.includes("text=blue")));
});

test("pgfplotsset every extra axis tick styles reach the browser renderer", () => {
  const result = tikzToSvg(String.raw`\documentclass[tikz]{standalone}
\usepackage{pgfplots}
\pgfplotsset{every extra x tick/.style={tick label style={text=red}}}
\begin{document}
\begin{tikzpicture}
  \begin{axis}[xmin=0,xmax=4,ymin=0,ymax=1,extra x ticks={2.5}]
    \addplot coordinates {(0,0) (4,1)};
  \end{axis}
\end{tikzpicture}
\end{document}`, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, /<text[^>]*fill="(?:red|rgb\(255,0,0\))"[^>]*>2\.5<\/text>/);
});

test("pgfplots extra ticks remain visible where middle axes cross", () => {
  const commands = renderTicks({
    "axis lines": "middle",
    xtick: "{-1,1}",
    ytick: "{-1,1}",
    "extra x ticks": "{0}",
    "extra x tick labels": "{origin}"
  }, { xMin: -1, xMax: 1, yMin: -1, yMax: 1 });

  assert.ok(commands.some((command) => command.endsWith("{origin};")), commands.join("\n"));
});

test("pgfplots extra passes do not repeat explicitly configured minor ticks", () => {
  const commands = renderTicks({
    "x minor tick values": "{0.5}",
    "y minor tick values": "{0.5}",
    "extra x ticks": "{2.5}"
  });

  assert.equal(commands.filter((command) => command.includes("\\draw[axis minor tick")).length, 2);
});

test("pgfplots tick style applies symmetrically to x and y minor ticks", () => {
  const commands = renderTicks({
    "minor tick num": 1,
    "tick style": "red"
  });
  const minorTicks = commands.filter((command) => command.includes("\\draw[axis minor tick"));

  assert.ok(minorTicks.length > 0, commands.join("\n"));
  assert.ok(minorTicks.every((command) => command.includes("red")), minorTicks.join("\n"));
});

test("pgfplots composes global and local nested extra tick label styles", () => {
  const result = tikzToSvg(String.raw`\documentclass[tikz]{standalone}
\usepackage{pgfplots}
\pgfplotsset{every extra x tick/.style={tick label style={text=red,font=\scriptsize}}}
\begin{document}
\begin{tikzpicture}
  \begin{axis}[xmin=0,xmax=4,ymin=0,ymax=1,extra x ticks={2.5},extra x tick style={tick label style={rotate=90}}]
    \addplot coordinates {(0,0) (4,1)};
  \end{axis}
\end{tikzpicture}
\end{document}`, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  const extraLabel = result.svg.match(/<g transform="rotate\(-90 [^"]+\)">[\s\S]*?<text[^>]*>2\.5<\/text>/)?.[0] || "";
  assert.match(extraLabel, /fill="(?:red|rgb\(255,0,0\))"/);
  assert.match(extraLabel, /font-family="TikZKitCMR7,/);
});
