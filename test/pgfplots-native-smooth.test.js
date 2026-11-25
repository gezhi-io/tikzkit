import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { axisPlotPointChain, smoothAxisCyclePointChain, smoothAxisPlotPointChain } from "../src/pgfplots/plotPath.js";

const coords = "coordinates {(1,1)(2,4)(4,2)}";
const frame = "hide axis,scale only axis,width=5cm,height=5cm,xmin=0,xmax=5,ymin=0,ymax=5,clip=false";
function render(body, axis = "", preamble = "", picture = "") {
  const { diagnostics, ir } = tikzToSvg(String.raw`\pgfplotsset{compat=1.18}` + preamble +
    String.raw`\begin{tikzpicture}[` + picture + String.raw`]\begin{axis}[` + frame + "," + axis + "]" +
    body + String.raw`\end{axis}\end{tikzpicture}`);
  assert.deepEqual(diagnostics, []);
  const paths = (...roles) => ir.items.filter(item => item.type === "path" && roles.includes(item.subtype));
  return { plots: paths("axis-plot", "axis-closed-cycle"), paths, coordinates: ir.coordinates };
}
const add = (options, data = coords, tail = "") => `\\addplot[${options}] ${data} ${tail};`;
const types = path => path.commands.map(c => ({ moveTo: "M", lineTo: "L", curveTo: "C", closePath: "Z" })[c.type]).join("");
const ends = path => path.commands.filter(c => c.type !== "closePath").map(c => [c.x, c.y]);
const points = [{ x: 1, y: 1 }, { x: 2, y: 4 }, { x: 4, y: 2 }];

// PDF path operands from TeX Live 2025, PGFPlots compat=1.18, with the
// explicit 5cm frame above. One projected data unit in that PDF is 28.3456bp.
// Normalizing by that measured unit isolates the handler from axis rounding.
function pdfCurves(path, native) {
  const curves = path.commands.filter(c => c.type === "curveTo");
  assert.equal(curves.length, native.length);
  for (const [i, c] of curves.entries()) {
    const actual = [c.x1, c.y1, c.x2, c.y2, c.x, c.y];
    for (const [j, expected] of native[i].entries()) {
      assert.ok(Math.abs(actual[j] - expected / 28.3456) < 0.000004,
        `curve ${i}, operand ${j}: ${actual[j]}cm vs ${expected}bp`);
    }
  }
}

test("open and cyclic addplots reproduce all native PDF Beziers in stream order", () => {
  const { plots: [open, cycle], coordinates } = render(add("smooth") + add("smooth cycle,dashed"));
  assert.equal(types(open), "MCC");
  assert.deepEqual(ends(open), [[1,1], [2,4], [4,2]]);
  pdfCurves(open, [
    [28.3456,28.3456,44.89252,109.44954,56.69121,113.38243],
    [68.48991,117.31532,113.38243,56.69121,113.38243,56.69121]
  ]);
  assert.equal(types(cycle), "MCCCZ");
  assert.deepEqual(ends(cycle), [[2,4], [4,2], [1,1], [2,4]]);
  pdfCurves(cycle, [
    [68.48991,117.31532,117.31532,68.48991,113.38243,56.69121],
    [109.44954,44.89252,36.2114,20.47981,28.3456,28.3456],
    [20.47981,36.2114,44.89252,109.44954,56.69121,113.38243]
  ]);
  assert.deepEqual(coordinates["current plot begin"], points[0]);
  assert.deepEqual(coordinates["current plot end"], points[2]);
});

test("axis tension is inherited, plot tension overrides it, and neither sign nor magnitude is clamped", () => {
  const { plots: [negative, zero, large, cyclic] } = render(add("") + add("tension=0") +
    add("/tikz/tension=4") + add("smooth cycle,tension=4"), "/tikz/smooth,/tikz/tension=-1");
  pdfCurves(negative, [
    [28.3456,28.3456,80.28862,121.24821,56.69121,113.38243],
    [33.0938,105.51663,113.38243,56.69121,113.38243,56.69121]
  ]);
  pdfCurves(zero, [
    [28.3456,28.3456,56.69121,113.38243,56.69121,113.38243],
    [56.69121,113.38243,113.38243,56.69121,113.38243,56.69121]
  ]);
  pdfCurves(large, [
    [28.3456,28.3456,-37.69841,81.91924,56.69121,113.38243],
    [151.08084,144.84563,113.38243,56.69121,113.38243,56.69121]
  ]);
  pdfCurves(cyclic, [
    [151.08084,144.84563,144.84563,151.08084,113.38243,56.69121],
    [81.91924,-37.69841,91.27202,-34.5808,28.3456,28.3456],
    [-34.5808,91.27202,-37.69841,81.91924,56.69121,113.38243]
  ]);
});

test("a trailing straight close or PGFPlots zero-level close does not select the cyclic handler", () => {
  const { plots: [straight, baseline, both, polygon] } = render(add("smooth", coords, "-- cycle") +
    add("smooth", coords, "\\closedcycle") + add("smooth cycle", coords, "\\closedcycle") + add("sharp cycle"));
  assert.equal(types(straight), "MCCZ");
  assert.equal(types(baseline), "MCCLLZ");
  assert.deepEqual(baseline.commands.slice(0,3), straight.commands.slice(0,3));
  assert.deepEqual(ends(baseline).slice(-2), [[4,0],[1,0]]);
  assert.equal(types(both), "MCCCZLLZ");
  assert.deepEqual(ends(both), [[2,4],[4,2],[1,1],[2,4],[4,0],[1,0]]);
  assert.equal(types(polygon), "MLLZ");
});

test("empty, single and two-point streams obey the handler even without a visible stroke", () => {
  for (const [n, open, cycle] of [[0,"",""], [1,"(1,1)",""],
    [2,"(1,1) .. controls (1,1) and (2,4) .. (2,4)","(2,4)"]]) {
    const run = points.slice(0,n);
    assert.equal(smoothAxisPlotPointChain(run), open);
    assert.equal(smoothAxisCyclePointChain(run), cycle);
    assert.equal(axisPlotPointChain(run, {"smooth cycle": true}), cycle);
    assert.equal(axisPlotPointChain(run, {}, {smooth: true, "axis plot cycle": true}), cycle);
  }
  const empty = render(add("smooth cycle", "coordinates {}") +
    add("smooth cycle,mark=+", "coordinates {(1,1)}"));
  assert.equal(empty.plots.length, 0);
  assert.equal(empty.paths("axis-mark").length, 1);
  const { plots: [open, cycle] } = render(add("smooth", "coordinates {(1,1)(2,4)}") +
    add("smooth cycle", "coordinates {(1,1)(2,4)}"));
  assert.equal(types(open), "MC");
  assert.equal(types(cycle), "M");
  assert.deepEqual(ends(cycle), [[2,4]]);
});

test("a jump flushes each spline; a trailing baseline close runs only once", () => {
  const rows = "coordinates {(1,1)(2,4)(3,2)(nan,nan)(4,3)(5,2)(6,2)}";
  const { plots: [open, cycle, discarded] } = render(add("smooth", rows, "\\closedcycle") +
    add("smooth cycle", rows, "\\closedcycle") + add("smooth,unbounded coords=discard", rows),
    "unbounded coords=jump");
  assert.equal(types(open), "MCCMCCLLZ");
  assert.equal(types(cycle), "MCCCZMCCCZLLZ");
  assert.deepEqual(ends(cycle), [[2,4],[3,2],[1,1],[2,4],[5,2],[6,2],[4,3],[5,2],[6,0],[1,0]]);
  assert.equal(types(discarded), "MCCCCC");
  const blank = "coordinates {(1,1)(2,4)\\par (3,3)(4,4)(5,1)}";
  const { plots: [shortRun, joined] } = render(add("smooth cycle", blank) + add("smooth cycle,empty line=none", blank));
  assert.equal(types(shortRun), "MMCCCZ");
  assert.deepEqual(ends(shortRun), [[2,4],[4,4],[5,1],[3,3],[4,4]]);
  assert.equal(types(joined), "MCCCCCZ");
});

test("last handler wins across axis, plot, repeat assignments, Step/Bar/Comb and only marks", () => {
  for (const [axis, opts, shape] of [
    ["smooth cycle","smooth=false","MCC"], ["smooth","/tikz/smooth cycle=false","MCCCZ"],
    ["smooth","smooth cycle,sharp plot","MLL"], ["smooth cycle","const plot","MLLLL"],
    ["","smooth,smooth cycle,smooth","MCC"], ["/tikz/ybar interval","smooth cycle","MCCCZ"],
    ["smooth","ybar,smooth cycle","MCCCZ"], ["ycomb","smooth cycle","MCCCZ"],
    ["","only marks,smooth cycle","MCCCZ"], ["only marks","smooth","MCC"]
  ]) {
    const result = render(add(opts), axis);
    assert.deepEqual(result.plots.map(types), [shape], axis + "; " + opts);
    assert.equal(result.paths("axis-bar","axis-comb","axis-mark").length, 0);
  }
  const marks = render(add("smooth cycle,only marks"));
  assert.equal(marks.plots.length, 0);
  assert.equal(marks.paths("axis-mark").length, 3);
  assert.equal(render(add("smooth cycle,ybar")).paths("axis-bar").length, 3);
});

test("every-axis-plot, cycle-list, explicit plot options, and post style execute in order", () => {
  const preamble = String.raw`\pgfplotscreateplotcyclelist{loops}{{smooth cycle,blue,mark=none}\\}`;
  const body = `\\addplot ${coords};\\addplot[] ${coords};\\addplot+[sharp plot] ${coords};`;
  const axis = "cycle list name=loops,every axis plot/.append style={smooth,tension=0}";
  assert.deepEqual(render(body, axis, preamble).plots.map(types), ["MCCCZ","MCC","MLL"]);
  assert.deepEqual(render(body, axis + ",every axis plot post/.style={smooth cycle}", preamble).plots.map(types),
    ["MCCCZ","MCCCZ","MCCCZ"]);
});

test("logarithmic and reversed coordinates are mapped before Bezier handles are constructed", () => {
  const { plots: [plot] } = render(add("smooth", "coordinates {(1,1)(10,4)(1000,2)}"),
    "xmode=log,x dir=reverse,xmin=1,xmax=1000,width=6cm");
  assert.deepEqual(ends(plot), [[6,1],[4,4],[0,2]]);
  const c = plot.commands[1];
  assert.ok(Math.abs(c.x2 - 4.83249) < 0.00001);
  assert.ok(Math.abs(c.y2 - 3.86125) < 0.00001);
});

test("sampled expression and parametric inputs keep off-screen points as spline neighbors", () => {
  const axis = "clip=true,domain=-1:2,samples=4";
  const { plots: [fn, param] } = render(add("smooth", "{x^2+1}") + add("smooth", "({x},{x^2+1})"), axis);
  assert.deepEqual(types(fn), "MCCC");
  assert.deepEqual(ends(fn), [[-1,2],[0,1],[1,2],[2,5]]);
  assert.deepEqual(fn.commands, param.commands);
  assert.deepEqual(fn.clipRect, { minX: 0, minY: 0, maxX: 5, maxY: 5 });
  const discontinuity = "{1/(x-1)}";
  const { plots: [broken] } = render(add("smooth,unbounded coords=jump", "({x}," + discontinuity + ")"),
    "domain=-1:3,samples=5");
  assert.equal(types(broken), "MCMC");
});

test("plot-local transforms include controls, markers, anchors and baseline, but not the viewport or next plot", () => {
  const data = "coordinates {(3,2)(4,5)(6,3)}";
  const first = add("xscale=2,yshift=1cm,smooth cycle,mark=+", data, "\\closedcycle");
  const axis = "clip=true,at={(3cm,2cm)},anchor=south west,xmin=2,xmax=7,ymin=1,ymax=6";
  const { plots: [curve], paths, coordinates } = render(first, axis);
  assert.deepEqual(ends(curve), [[7,7],[11,5],[5,4],[7,7],[11,3],[5,3]]);
  assert.ok(Math.abs(curve.commands[1].x1 - 7.83249) < 0.00001);
  assert.ok(Math.abs(curve.commands[1].y1 - 7.13875) < 0.00001);
  assert.deepEqual(curve.clipRect, { minX: 3, minY: 2, maxX: 8, maxY: 7 });
  assert.deepEqual(coordinates["current plot begin"], { x: 5, y: 4 });
  assert.deepEqual(coordinates["current plot end"], { x: 11, y: 5 });
  assert.deepEqual(paths("axis-mark").map(p => p.commands[0].y), [4,7,5]);
  const second = render(first + add("smooth", data), axis).plots[1];
  assert.deepEqual(ends(second), [[4,3],[5,6],[7,4]]);
});

test("sharp parametric area tails preserve the requested paint and clip only after a local shift", () => {
  const tuple = "({x+1},{x+2})";
  const { plots: [stroke, fill, shifted] } = render(add("red", tuple, "-- (axis cs:4,1)") +
    add("blue,fill=green", tuple) +
    add("orange,fill=green,xshift=-6cm", "({x+7},{x+2})", "-- (axis cs:10,1) -- cycle") +
    add("draw=none", tuple, "-- (axis cs:4,1)"), "domain=0:2,samples=3,clip=true");
  assert.equal(types(stroke), "MLLL");
  assert.equal(stroke.style.fill, "none");
  assert.equal(types(fill), "MLL");
  assert.notEqual(fill.style.fill, "none");
  assert.equal(types(shifted), "MLLLZ");
  assert.deepEqual(ends(shifted), [[1,2],[2,3],[3,4],[4,1]]);
  assert.deepEqual(shifted.clipRect, fill.clipRect);
});
