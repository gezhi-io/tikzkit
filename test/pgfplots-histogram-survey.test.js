import assert from "node:assert/strict";
import test from "node:test";
import { parseAddplots } from "../src/pgfplots/addplotParser.js";
import { preparePgfplotsHistogram } from "../src/pgfplots/histogram.js";
import { parseOptions } from "../src/engine/options.js";
import { parsePgfplotsDeclaredFunctions } from "../src/pgfplots/expressions.js";
import { computeAxisRanges } from "../src/pgfplots/rangeResolver.js";
import { expandPgfplotsAxes } from "../src/pgfplots/axisEnvironment.js";

function survey(source, axis = {}, options = {}) {
  const diagnostics = [];
  const parsed = parseAddplots(source, options, diagnostics);
  const { addplots, axisOptions } = preparePgfplotsHistogram(axis, parsed, options, diagnostics);
  return { plot: addplots[0], axisOptions, diagnostics };
}

test("hist surveys only the selected component and inherits explicit axis bounds", () => {
  const result = survey(String.raw`\addplot[hist={data=x,bins=2,cumulative,density}]
    coordinates {(-1,nan) (1,90) (2,70) (4,10) (5,20)};`, { xmin: 0, xmax: 4 });
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.plot.points.map(({ x, y }) => [x, y]), [[0, 0.4], [2, 1], [4, 1]]);
  // A raw /tikz/ybar interval handler on one plot does not configure the axis.
  assert.equal(result.axisOptions.xtick, undefined);
  assert.equal(result.axisOptions.xmajorgrids, undefined);
});

test("hist replays prefixed and inline keys in scope order, including empty bound resets", () => {
  const axis = parseOptions("xmin=-100,xmax=10,hist/data min=0,hist/bins=2,hist/data=y");
  const { plot } = survey(String.raw`\addplot[/pgfplots/hist={data min=,data value=0,bins=3},hist/data=x]
    coordinates {(1,10) (4,10) (5,10) (10,10)};`, axis);
  assert.deepEqual(plot.histogram.edges, [1, 4, 7, 10]);
  assert.deepEqual(plot.histogram.counts, [1, 2, 1]);
});

test("a histogram input expression can use a named table column and the row index", () => {
  const { plot, diagnostics } = survey(String.raw`\addplot[hist={bins=2,data min=0,data max=8,
    data={\thisrow{volume}+\coordindex}}] table[col sep=comma,x=t,y=signal] {volumes.csv};`, {},
    { pgfplotsTableResolver: () => "t,signal,volume\n9,12,1\n9,8,2\n9,0,4\n9,0,7" });
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(plot.histogram.counts, [2, 2]);
});

test("hist samples a declared function before binning; intervals=false omits the right endpoint", () => {
  const axis = { "pgfplots declared functions": parsePgfplotsDeclaredFunctions(String.raw`twice(\t)=2*\t;`) };
  const { plot, diagnostics } = survey(String.raw`\addplot[hist={bins=2,intervals=false,handler/.style={sharp plot}},
    domain=0:4,samples=5] {twice(x)};`, axis);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(plot.points.map(({ x, y }) => [x, y]), [[0, 2], [4, 3]]);
  assert.equal(plot.type, "coordinates");
  assert.equal(plot.options["ybar interval"], undefined);
  assert.equal(plot.histogram.handler, "sharp plot");
});

test("hist settings only select the handler when hist itself is activated", () => {
  const { plot } = survey(String.raw`\addplot[hist/bins=7] coordinates {(2,3) (4,7)};`);
  assert.equal(plot.histogram, undefined);
  assert.deepEqual(plot.points.map(p => p.y), [3, 7]);
});

test("small physical densities remain distinct until they are mapped onto the axis", () => {
  const { plot } = survey(String.raw`\addplot[hist={bins=2,data min=0,data max=20000,density}]
    coordinates {(0,1) (0,2) (0,15000)};`);
  const bounds = computeAxisRanges({ enlargelimits: false }, [plot]);
  assert.ok(plot.histogram.counts[0] < 0.0001 && plot.histogram.counts[1] > 0);
  assert.equal(bounds.yMin, Math.min(...plot.histogram.counts));
  assert.equal(bounds.yMax, Math.max(...plot.histogram.counts));
});

test("braced half-open labels do not swallow axis options or their closing bracket", () => {
  const template = String.raw`$[\pgfmathprintnumber\tick,\pgfmathprintnumber\nexttick)$`;
  const source = String.raw`\begin{axis}[ybar interval,xticklabel={${template}},xtick=,width=7cm]
    \addplot coordinates {(1,2) (2,3)};\end{axis}`;
  let axis, body;
  expandPgfplotsAxes(source, [], {}, {}, (options, contents) => { axis = options; body = contents; return ""; });
  assert.equal(axis.xticklabel, template);
  assert.equal(axis.xtick, "");
  assert.equal(axis.width, "7cm");
  assert.equal(body.trim(), String.raw`\addplot coordinates {(1,2) (2,3)};`);
});

test("hist/data filter expressions receive the selected row value before binning", () => {
  const result = survey(String.raw`\addplot[hist={bins=2,data=x,data min=0,data max=4,
    data filter/.expression={2*\pgfmathresult}}] coordinates {(0,99) (1.1,99) (1.4,99) (2,99)};`);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.plot.histogram.counts, [1, 3]);
});

test("an unsupported histogram TeX hook reports the problem without painting unrelated raw rows", () => {
  const { plot, diagnostics } = survey(String.raw`\addplot[hist={data filter/.code={\relax}}]
    coordinates {(1,44) (3,55)};`);
  assert.deepEqual(plot.points, []);
  assert.match(diagnostics.map(d => d.message).join("\n"), /histogram.*data filter/i);
});
