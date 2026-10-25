import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { pgfCurvilinearTime } from "../src/renderers/svg/arrowBending.js";
import { pgfFixedDivide } from "../src/engine/pgf-fixed-math.js";

const ptPerCm = 72.27 / 2.54;
const closePt = (actual, expected, tolerance = .003) =>
  assert.ok(Math.abs(actual * ptPerCm - expected) < tolerance, `${actual * ptPerCm}pt != ${expected}pt`);
const paths = source => {
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  return result.ir.items.filter(item => item.type === "path");
};

test("automatic curve distances follow the native scaled-point normalization", () => {
  // Captured by topaths-native-metrics.tex, without a PDF/SVG rescaling step.
  const samples = [["4cm", "0cm", 44.38303], ["0cm", "4cm", 44.38303],
    ["3cm", "4cm", 55.64108], ["4cm", "3cm", 55.64108], ["1cm", "1cm", 15.7547],
    ["4cm", ".001pt", 44.38303], ["0cm", "0cm", 0], [".01pt", ".02pt", .0087]];
  for (const [x, y, expected] of samples) {
    const [path] = paths(`\\draw (0,0) to[out=90,in=180] (${x},${y});`);
    closePt(path.commands.at(-1).y1, expected);
  }
});

test("curved arrow distance interpolation preserves native fixed-point quotients", () => {
  assert.equal(pgfFixedDivide(.00839, 1.07906), Math.round(.0077 * 65536) / 65536);
  const curve = [[113.81097, 0], [72.10446, 15.1801], [41.70651, 15.1801], [0, 0]]
    .map(([x, y]) => ({ x: x / ptPerCm, y: y / ptPerCm }));
  for (const [distance, expected] of [[-1, -.0075], [1, .0075], [3, .0227], [6.6, .0504], [10, .0769]]) {
    const actual = pgfCurvilinearTime(curve, distance / ptPerCm);
    assert.ok(Math.abs(actual - expected) < 2 / 65536, `${distance}pt: ${actual} != ${expected}`);
  }
});

test("curved node endpoints do not grow with the connecting arrow pen", () => {
  const result = paths(String.raw`\begin{tikzpicture}
    \node[draw,minimum width=.5cm,minimum height=.3cm] (a) at (0,0) {A};
    \node[draw,minimum width=.5cm,minimum height=.3cm] (b) at (2,0) {B};
    \draw (a) to[out=20,in=160] (b);
    \draw[-stealth] (a) to[out=20,in=160] (b);
    \draw[<->,line width=4pt] (a) to[out=20,in=160] (b);
  \end{tikzpicture}`);
  assert.equal(result.length, 3);
  for (const path of result) {
    const [start, curve] = path.commands;
    closePt(start.x, 7.31317);
    closePt(start.y, 2.6612);
    closePt(curve.x1, 22.80652);
    closePt(curve.y1, 8.30093);
    closePt(curve.x2, 34.09897);
    closePt(curve.y2, 8.30093);
    closePt(curve.x, 49.59232);
    closePt(curve.y, 2.6612);
  }
});

test("nonrelative curves intersect the node border toward the final control point", () => {
  const [path] = paths(String.raw`\usetikzlibrary{shapes.geometric}
    \begin{tikzpicture}
      \node[draw,circle,minimum size=1cm,inner sep=0pt] (c) at (0,-2) {};
      \node[draw,ellipse,minimum width=2cm,minimum height=1cm,inner sep=0pt] (d) at (4,-2) {};
      \draw[line width=4pt,-stealth] (c) to[out=25,in=145] (d);
    \end{tikzpicture}`);
  const [start, curve] = path.commands;
  closePt(start.x, 13.07454);
  closePt(start.y, -50.8088);
  closePt(curve.x1, 42.88234);
  closePt(curve.y1, -36.90944);
  closePt(curve.x2, 70.14246);
  closePt(curve.y2, -26.32921);
  closePt(curve.x, 97.08348);
  closePt(curve.y, -45.19376);
});

test("fractional node angles use integer anchors then recrop toward the controls", () => {
  for (const sign of [1, -1]) {
    const [path] = paths(String.raw`\begin{tikzpicture}
      \node[draw,minimum size=1cm,inner sep=0pt] (a) at (0,0) {};
      \node[draw,minimum size=1cm,inner sep=0pt] (b) at (4,0) {};
      \draw (a) to[out=${sign * 20.75},in=${sign * 158.5}] (b);
    \end{tikzpicture}`);
    const [start, curve] = path.commands;
    closePt(start.x, 14.42636);
    closePt(start.y, sign * 5.39557);
    closePt(curve.x1, 45.52858);
    closePt(curve.y1, sign * 17.03375);
    closePt(curve.x2, 68.43973);
    closePt(curve.y2, sign * 18.01834);
    closePt(curve.x, 99.38461);
    closePt(curve.y, sign * 5.72731);
  }
});

test("each self-loop edge in one path owns its own arrow paint", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
    \node[circle,draw,minimum size=1cm,inner sep=0pt] (c) at (0,0) {};
    \node[circle,draw,minimum size=1cm,inner sep=0pt] (d) at (3,0) {};
    \path[->,thick] (c) edge[loop above,looseness=5] (c)
      (d) edge[loop above] (d);
  \end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  const loops = result.ir.items.filter(item => item.type === "path" && item.subtype === "edge");
  assert.equal(loops.length, 2);
  for (const loop of loops) {
    assert.ok(loop.style.markerEnd);
    assert.deepEqual(loop.commands.map(c => c.type), ["moveTo", "curveTo"]);
  }
  assert.equal((result.svg.match(/class="tikz-arrow-tip /g) || []).length, 2);
});
