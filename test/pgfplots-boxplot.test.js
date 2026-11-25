import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { collectPgfplotsLibraries, computeAxisRanges, createAxisGeometry, parseAddplots } from "../src/pgfplots/index.js";
import { preparePgfplotsBoxplots } from "../src/pgfplots/boxplots.js";

const source = (axis, body) => String.raw`\usepackage{pgfplots}\usepgfplotslibrary{statistics}
\pgfplotsset{compat=1.18}\begin{tikzpicture}
\begin{axis}[hide axis,scale only axis,enlargelimits=false,width=10cm,height=4cm,${axis}]
${body}\end{axis}\end{tikzpicture}`;
const selected = (result, role) => result.ir.items.filter(item => item.subtype === role);

test("physical x and y units set the data scale, not the space including tick labels", () => {
  const ranges = { xMin: 0.1, xMax: 10.9, yMin: 0.52, yMax: 1.48 };
  const y = createAxisGeometry({ width: "7cm", y: "1cm", "pgfplots explicit y unit": true }, ranges);
  assert.ok(Math.abs(y.height - 0.96) < 1e-7);
  assert.ok(y.width > 5 && y.width < 6);
  const x = createAxisGeometry({ height: "5cm", x: "2mm", "pgfplots explicit x unit": true }, ranges);
  assert.ok(Math.abs(x.width - 2.16) < 1e-7);
  assert.ok(x.height > 3 && x.height < 4);
});

test("the statistics library renders the five-number summary even without outliers", () => {
  const result = tikzToSvg(source("xmin=0,xmax=10,ymin=0,ymax=4",
    String.raw`\addplot[boxplot prepared={lower whisker=1,lower quartile=2,median=4,
      upper quartile=7,upper whisker=9,draw position=2},draw=blue] coordinates {};`));
  assert.deepEqual(result.diagnostics, []);
  const [median] = selected(result, "axis-boxplot-median");
  assert.ok(median, "the median is a real stroke, not a connected source tuple");
  assert.deepEqual(median.commands.map(p => [p.x,p.y]), [[4,1.6],[4,2.4]]);
  assert.equal(selected(result, "axis-boxplot-box").length, 1);
  assert.equal(selected(result, "axis-plot").length, 0);
  const [library] = collectPgfplotsLibraries(String.raw`\usepgfplotslibrary{statistics}`);
  assert.equal(library.implementationStatus, "partial");
});

test("raw boxplot input is a scalar stream, not connected points or a two-column extent", () => {
  const result = tikzToSvg(source("boxplot/draw direction=y,xmin=0,xmax=10,ymin=0,ymax=20",
    String.raw`\addplot+[boxplot={draw position=3,average=auto}] table[row sep=\\,y index=0] {
      sample\\ 1\\ 2\\ 4\\ 6\\ 7\\ 18\\
    };`));
  assert.deepEqual(result.diagnostics, []);
  const [median] = selected(result, "axis-boxplot-median");
  assert.ok(median);
  assert.deepEqual(median.commands.map(p => [p.x,p.y]), [[2.6,1],[3.4,1]]);
  assert.equal(selected(result, "axis-plot").length, 0);
});

test("prepared table outliers use their own row's draw position; the summary uses the last row", () => {
  const body = String.raw`\addplot[boxplot prepared={data=\thisrow{value}*2,draw position=\thisrow{lane},median=3}]
    table[row sep=\\] {x y lane value\\900 0 2 4\\999 1 5 7\\};`;
  const [plot] = preparePgfplotsBoxplots({}, parseAddplots(body));
  assert.equal(plot.boxplot.position, 5);
  assert.deepEqual(plot.points.map(p => [p.x,p.y]), [[8,2],[14,5]]);
  assert.equal(plot.boxplot.median, 3);
});

test("computed function series honors declared domain, sample count, and data expression", () => {
  const [plot] = preparePgfplotsBoxplots({ compat: "newest" }, parseAddplots(
    String.raw`\addplot[domain=0:4,samples=5,boxplot={data=y+x,average=auto}] {x*x};`));
  assert.deepEqual([plot.boxplot.sampleSize, plot.boxplot.median, plot.boxplot.average], [5, 6, 8]);
});

test("unsupported boxplot programs are reported and never drawn as ordinary lines", () => {
  const result = tikzToSvg(source("xmin=0,xmax=5,ymin=0,ymax=5",
    String.raw`\addplot[boxplot={draw/median/.code={}}] coordinates {(1,2) (2,3)};`));
  assert.ok(result.diagnostics.some(d => /custom TeX hook.*median/.test(d.message)));
  assert.equal(selected(result, "axis-plot").length, 0);
});

test("rounding the viewport must not collapse a sub-milliscale distribution", () => {
  const axis = { compat: "1.18", enlargelimits: "false" };
  const plots = preparePgfplotsBoxplots(axis, parseAddplots(
    String.raw`\addplot[boxplot] coordinates {(0,.0001) (1,.0002) (2,.0003)};`));
  const { xMin, xMax } = computeAxisRanges(axis, plots);
  assert.deepEqual([xMin, xMax], [0.0001, 0.0003]);
});

test("tick=data comes from the first sampled function, not a later boxplot's outliers", () => {
  const result = tikzToSvg(String.raw`\usepackage{pgfplots}\usepgfplotslibrary{statistics}
    \pgfplotsset{compat=1.18}\begin{tikzpicture}\begin{axis}[scale only axis,
      width=6cm,height=3cm,xmin=0,xmax=7,ymin=0,ymax=7,xtick=data,ytick=\empty]
    \addplot[domain=1:5,samples=3] {x};
    \addplot[boxplot prepared={median=3}] coordinates {(0,6)};
    \end{axis}\end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.items.filter(p => p.type === "textNode" && p.y < 0).map(p => p.text), ["1", "3", "5"]);
});

test("a repeated mark assignment after a boxplot overrides its default outlier mark", () => {
  const chart = keys => tikzToSvg(source("xmin=0,xmax=8,ymin=0,ymax=2",
    "\\addplot[" + keys + "] coordinates {(0,7)};"));
  const before = chart("mark=+,mark=none,boxplot prepared={median=3}");
  const after = chart("mark=+,boxplot prepared={median=3},mark=none");
  assert.equal(selected(before, "axis-boxplot-outlier").length, 1);
  assert.equal(selected(after, "axis-boxplot-outlier").length, 0);
  assert.equal(selected(after, "axis-boxplot-median").length, 1);
});
