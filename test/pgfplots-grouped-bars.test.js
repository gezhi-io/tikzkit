import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseTikz } from "../src/internal.js";
import { createBarLayout, withBarCategoryTicks, withBarGroups } from "../src/pgfplots/bars.js";
import { normalizedTickAlignment } from "../src/pgfplots/ticks.js";

const pt = 72.27 / 2.54;
const source = file => readFileSync(new URL(file, import.meta.url), "utf8");
function readPlot(tex) {
  const { ast, diagnostics } = parseTikz(tex);
  assert.deepEqual(diagnostics, []);
  const lines = ast.pictures[0].body.split("\n");
  const coords = s => [...s.matchAll(/\(([-\d.]+),([-\d.]+)\)/g)].map(m => m.slice(1).map(Number));
  return { lines, bars:lines.filter(l => l.includes("\\draw[axis bar")).map(coords),
    nodes:lines.filter(l => l.includes("\\node[axis near coord")).map(line => ({line, at:coords(line).at(-1)})) };
}
const near = (a,b,eps=.001) => assert.ok(Math.abs(a-b) <= eps, `${a} != ${b}`);
const centerX = p => (p[0][0]+p[1][0])/2;

test("manual population: 9pt bars clear a 5pt gap, start at the enlarged box, and label survey meta", () => {
  const {bars,nodes,lines} = readPlot(source("./fixtures/pgfplots-filled-legends/manual-grouped.tex"));
  assert.equal(bars.length, 10);
  assert.ok(lines.some(l => l.includes("axis tick label") && l.includes("anchor=east") && /\{\$?3\$?\};$/.test(l)),
    "the enlarged value axis includes the 30-million tick");
  for (let i=0; i<5; i++) {
    near((bars[i+5][0][0]-bars[i][1][0])*pt, 5, .03);
    near((bars[i][1][0]-bars[i][0][0])*pt, 9, .03);
  }
  const labels = ["5","3.3","4","5","7","3.8","4.2","4.3","4.5","6.5"];
  for (const [i,p] of bars.entries()) {
    near(p[0][1], 0);
    near(nodes[i].at[0], centerX(p));
    near(nodes[i].at[1], p[2][1]);
    assert.ok(nodes[i].line.endsWith(`{$${labels[i]}$};`), nodes[i].line);
  }
});

test("horizontal participants: the 10pt default and the x-meta labels belong to the bar tips", () => {
  const {bars,nodes} = readPlot(source("./fixtures/pgfplots-grouped-bars/manual-participants.tex"));
  assert.equal(bars.length, 2);
  for (const [i,p] of bars.entries()) {
    near((p[2][1]-p[1][1])*pt, 10, .03);
    near(nodes[i].at[1], (p[0][1]+p[2][1])/2);
    near(nodes[i].at[0], p[1][0]);
    assert.match(nodes[i].line, /anchor=west/);
    assert.ok(nodes[i].line.endsWith(`{$${i ? 7 : 3}$};`));
  }
});

test("modern data-unit horizontal bars touch at zero gap; a line series takes no group slot", () => {
  const {bars:h} = readPlot(source("./fixtures/pgfplots-grouped-bars/manual-data-units.tex"));
  assert.equal(h.length, 10);
  for (let i=0; i<5; i++) near(h[i][2][1], h[i+5][0][1]);
  const {bars,nodes} = readPlot(source("./fixtures/pgfplots-grouped-bars/mixed-sign-groups.tex"));
  assert.equal(bars.length, 6);
  near((centerX(bars[3])-centerX(bars[0]))*pt, 10, .03);
  assert.match(nodes[1].line, /anchor=north/);
  assert.match(nodes[0].line, /anchor=south/);
});

test("bar widths and explicit shifts switch from TeX points to category units in 1.7", () => {
  const geometry = { mapPoint: ({x,y}) => ({ x: 3*x, y: 4*y }) };
  for (const [compat, unit] of [["1.6", 1/pt], ["1.7", 4]]) {
    const layout = createBarLayout({ compat, xbar:true }, { "bar width":2, "bar shift":-0.5 },
      geometry, "x", {}, { count:2, index:1 });
    const {halfWidth, shift} = layout({x:1, y:2});
    near(halfWidth, unit);
    near(shift, -unit/2);
  }
  const plots = [{options:{}}, {options:{}}];
  assert.equal(withBarGroups(plots, { "/tikz/ybar":true }), plots);
  assert.equal(withBarGroups(plots, { ybar:true, "stack plots":"false" })[0].barGroup?.count, 2);
});

test("an enlarged boxed xbar puts the description below the frame, not below the first data row", () => {
  const tex = source("./fixtures/pgfplots-grouped-bars/manual-participants.tex");
  const { lines } = readPlot(tex);
  const label = lines.find(line => line.includes("axis label,") && line.includes("participants"));
  const [,x,y] = label.match(/ at \(([-\d.]+),([-\d.]+)\)/);
  assert.ok(Number(x) > 0);
  near(Number(y)*pt, -(6.4444+2*3.333+.2), .04);
});

test("the PGFPlots style changes only category ticks and honors later explicit choices", () => {
  const alignment = (axis, options) => normalizedTickAlignment(withBarCategoryTicks(options), axis);
  assert.equal(alignment("x", { ybar:true }), "outside");
  assert.equal(alignment("y", { ybar:true }), "inside");
  assert.equal(alignment("y", { xbar:true, "tick align":"center" }), "center");
  assert.equal(alignment("y", { "ytick align":"inside", xbar:true }), "outside");
  assert.equal(alignment("x", { "/tikz/ybar":true }), "inside");
});

test("automatic label side follows metadata, and an explicit label font survives", () => {
  const tex = String.raw`\begin{tikzpicture}\begin{axis}[xbar,nodes near coords={\scriptsize\pgfplotspointmeta},
    point meta=-x] \addplot coordinates {(2,1) (-1,2)}; \end{axis}\end{tikzpicture}`;
  const {nodes} = readPlot(tex);
  assert.match(nodes[0].line, /anchor=north.*font=\\scriptsize.*\{-2\};/);
  assert.match(nodes[1].line, /anchor=south.*font=\\scriptsize.*\{1\};/);
});
