import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

const points = "(0,0)[0] (2,0)[1] (0,4)[2] (2,4)[3]";
function chart(key, axisOptions = "", overlay = "", plotOptions = "") {
  const source = String.raw`\usepackage{pgfplots}\pgfplotsset{compat=1.18}
\begin{tikzpicture}\begin{axis}[scale only axis,width=4cm,height=8cm,
  enlargelimits=false,xtick={0,2},ytick={0,4},${axisOptions}]
  \addplot[${key},mesh/cols=2,point meta=explicit,${plotOptions}] coordinates {${points}};
  ${overlay}
\end{axis}\end{tikzpicture}`;
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  return result.ir.items;
}
const cells = items => items.filter(p => p.subtype === "axis-matrix-cell");
const xy = path => path.commands.filter(p => Number.isFinite(p.x)).map(p => [p.x, p.y]);
function bounds(path) {
  const points = xy(path), xx = points.map(([x]) => x), yy = points.map(([,y]) => y);
  return [Math.min(...xx), Math.min(...yy), Math.max(...xx), Math.max(...yy)];
}

test("matrix cells extend half a spacing on each side; switching style reverses the whole axis", () => {
  const overlay = String.raw`\addplot[black,mark=none] coordinates {(0,0) (2,4)};`;
  for (const [key, reverse] of [["matrix plot", true], ["matrix plot*", false],
    ["imagesc", true], ["imagesc*", false]]) {
    const items = chart(key, "grid=major,y dir=normal,axis on top=false", overlay);
    assert.equal(cells(items).length, 4, key);
    assert.deepEqual(bounds(cells(items)[0]), reverse ? [0,4,2,8] : [0,0,2,4], key);
    assert.deepEqual(xy(items.find(p => p.subtype === "axis-plot")), reverse
      ? [[1,6],[3,2]] : [[1,2],[3,6]], key);
    const grid = items.findIndex(p => p.subtype === "axis-grid-line");
    assert.ok(grid >= 0);
    assert.equal(grid > items.indexOf(cells(items)[0]), reverse, key);
  }
});

test("starred heatmaps retain explicit axis directions and source limits clip the cells", () => {
  const items = chart("matrix plot*", "xmin=0,xmax=2,ymin=0,ymax=4,y dir=reverse");
  const first = cells(items)[0];
  assert.ok(first);
  assert.deepEqual(bounds(first), [-2,4,2,12]);
  assert.deepEqual(first.clipRect, { minX: 0, minY: 0, maxX: 4, maxY: 8 });
});

test("multiple heatmaps normally share one color scale, even across disjoint numeric ranges", () => {
  const second = String.raw`\addplot[matrix plot*,point meta=explicit,mesh/cols=2]
    coordinates {(4,0)[10] (6,0)[11] (4,4)[12] (6,4)[13]};`;
  const global = cells(chart("matrix plot*", "", second)).map(p => p.style.fill);
  const local = cells(chart("matrix plot*", "point meta rel=per plot", second)).map(p => p.style.fill);
  assert.equal(global.length, 8);
  assert.equal(local.length, 8);
  assert.notEqual(global[0], global[4]);
  assert.notEqual(global[3], global[7]);
  assert.deepEqual(local.slice(0, 4), local.slice(4));
  assert.equal(global[0], local[0]);
  assert.equal(global[7], local[7]);
});

test("an unsupported matrix shader is reported rather than silently connected as a line", () => {
  const picture = keys => tikzToSvg(String.raw`\usepackage{pgfplots}\begin{tikzpicture}
    \begin{axis}[hide axis]\addplot[${keys},mesh/cols=2,point meta=explicit]
    coordinates {${points}};\end{axis}\end{tikzpicture}`);
  const unsupported = picture("matrix plot*,shader=interp");
  assert.ok(unsupported.diagnostics.some(d => /matrix plot.*shader.*interp/i.test(d.message)));
  assert.ok(!unsupported.ir.items.some(p => ["axis-matrix-cell","axis-plot"].includes(p.subtype)));
  const reset = picture("shader=interp,matrix plot*");
  assert.deepEqual(reset.diagnostics, []);
  assert.equal(cells(reset.ir.items).length, 4);
});

test("matrix plot styles run before surveying the mesh, not just before painting", () => {
  const defaults = "/pgfplots/matrix plot*,/pgfplots/mesh/cols=2,/pgfplots/point meta=explicit";
  for (const [global, local] of [
    ["", "every axis plot/.append style={" + defaults + "}"],
    ["\\pgfplotsset{every axis plot/.append style={" + defaults + "}}", ""]
  ]) {
    const result = tikzToSvg(String.raw`\usepackage{pgfplots}${global}\begin{tikzpicture}
      \begin{axis}[hide axis,${local}]\addplot[mark=none] coordinates {${points}};
      \end{axis}\end{tikzpicture}`);
    assert.deepEqual(result.diagnostics, []);
    const faces = cells(result.ir.items);
    assert.equal(faces.length, 4);
    assert.equal(new Set(faces.map(p => p.style.fill)).size, 4);
  }
});

test("the skewed manual heatmap prints ticks in the enlarged margins", () => {
  const source = readFileSync(new URL("./fixtures/native-pgfplots-matrix-plots/matrix-manual-skewed.tex", import.meta.url), "utf8");
  const { ir, diagnostics } = tikzToSvg(source);
  assert.deepEqual(diagnostics, []);
  const labels = ir.items.filter(item => item.type === "textNode");
  const nums = items => items.map(p => Number(p.text.replace("−", "-")));
  assert.deepEqual(nums(labels.filter(p => p.y < 0)), [-1,0,1,2,3]);
  assert.deepEqual(nums(labels.filter(p => p.x < 0)), [0,1,2,3]);
});
