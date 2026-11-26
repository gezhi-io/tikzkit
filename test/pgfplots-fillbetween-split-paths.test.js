import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { splitFillBetweenBoundaries, splitFillBetweenRegions, splitXMonotoneFillBetweenPaths } from "../src/pgfplots/fillBetweenSplit.js";
import { joinFillBetweenPaths } from "../src/pgfplots/fillBetweenAssembly.js";

const move = (x, y) => ({ type: "moveTo", x, y });
const line = (x, y) => ({ type: "lineTo", x, y });
const curve = (x1, y1, x2, y2, x, y) => ({ type: "curveTo", x1, y1, x2, y2, x, y });
const path = (...points) => points.map(([x,y], i) => i ? line(x,y) : move(x,y));
const xy = commands => commands.map(({ x,y }) => [x,y]);
const near = (a,b) => assert.ok(Math.abs(a-b) < 1e-11, a + " != " + b);
function expectCubic(actual, expected) {
  assert.equal(actual.type, "curveTo");
  ["x1","y1","x2","y2","x","y"].forEach((key,i) => near(actual[key], expected[i]));
}

test("unequal original extents and original vertices survive on both sides of three crossings", () => {
  const a = path([-2,0],[0,0],[1,2],[2,0],[3,2],[5,2]);
  const b = path([-1,1],[4,1]);
  const regions = splitFillBetweenBoundaries(a,b,true);
  assert.deepEqual(regions.map(r => xy(r.first)), [
    [[-2,0],[0,0],[.5,1]], [[.5,1],[1,2],[1.5,1]],
    [[1.5,1],[2,0],[2.5,1]], [[2.5,1],[3,2],[5,2]]
  ]);
  assert.deepEqual(regions.map(r => xy(r.second)), [
    [[-1,1],[.5,1]], [[.5,1],[1.5,1]], [[1.5,1],[2.5,1]], [[2.5,1],[4,1]]
  ]);
  assert.ok(regions.every(r => r.reverse === true));
});

test("MacTeX descending stream order keeps the last one-sided tail and alternation starts at the right", () => {
  const a = path([5,0],[4,2],[3,0],[2,2],[0,0]), b = path([1,1],[6,1]);
  const regions = splitFillBetweenBoundaries(a,b,false);
  const polygons = regions.map(({ first, second, reverse }) => {
    const result = joinFillBetweenPaths(first,second,reverse);
    assert.deepEqual(result.at(-1), { type: "closePath" });
    return xy(result.slice(0,-1));
  });
  // PGFPlots compat=1.18 PDF pen order, apart from PGF's intersection rounding.
  assert.deepEqual(polygons, [
    [[5,0],[4.5,1],[4.5,1],[6,1]],
    [[4.5,1],[4,2],[3.5,1],[3.5,1],[4.5,1]],
    [[3.5,1],[3,0],[2.5,1],[2.5,1],[3.5,1]],
    [[2.5,1],[2,2],[1,1],[1,1],[2.5,1]],
    [[1,1],[0,0],[1,1]]
  ]);
  const points = commands => commands.map(({ x,y }) => ({ x,y }));
  assert.deepEqual(splitXMonotoneFillBetweenPaths(points(a), points(b)),
    regions.map(r => ({ first: points(r.first), second: points(r.second) })));
});

test("an explicit reverse override pairs the nth piece of each normalized stream", () => {
  const a = path([0,0],[1,2],[2,0]), b = path([0,1],[2,1]);
  const regions = splitFillBetweenBoundaries(a,b,false);
  assert.deepEqual(regions.map(r => xy(r.first).map(p => p[0])), [[0,.5],[.5,1,1.5],[1.5,2]]);
  assert.deepEqual(regions.map(r => xy(r.second).map(p => p[0])), [[2,1.5],[1.5,.5],[.5,0]]);
  assert.deepEqual(regions.map(r => r.reverse), [true,true,true]);
});

test("the point-array helper retains its unsplit band, without trimming its ends to the common range", () => {
  const first = [{ x: -2, y: 1 }, { x: 3, y: 1 }], second = [{ x: 4, y: 0 }, { x: 0, y: 0 }];
  assert.deepEqual(splitXMonotoneFillBetweenPaths(first, second), [{ first, second: [...second].reverse() }]);
  assert.deepEqual(splitXMonotoneFillBetweenPaths(first, [{ x: 4, y: 0 }, { x: 5, y: 1 }]), []);
});

test("no intersections and unsupported contours request fallback even when small segments are retained", () => {
  const a = path([0,0],[2,.04]);
  for (const b of [path([0,.01],[2,.05]), path([3,-1],[4,1]), path([1,-1],[1,1]), a]) {
    assert.equal(splitFillBetweenRegions(a,b,true), null);
    assert.equal(splitFillBetweenRegions(a,b,true,{ "omit empty segments": false }), null);
    assert.deepEqual(splitFillBetweenBoundaries(a,b,true), []);
  }
});

test("MacTeX emits zero regions for a shallow crossing by default and two when empty segments are retained", () => {
  const a = path([0,0],[2,.04]), b = path([0,.04],[2,0]);
  const key = "/pgf/fill between/omit empty segments";
  const kept = [
    { first: path([0,0],[1,.02]), second: path([0,.04],[1,.02]), reverse: true },
    { first: path([1,.02],[2,.04]), second: path([1,.02],[2,0]), reverse: true }
  ];
  assert.deepEqual(splitFillBetweenRegions(a,b,true), []);
  assert.deepEqual(splitFillBetweenRegions(a,b,true,{ [key]: "true" }), []);
  assert.deepEqual(splitFillBetweenRegions(a,b,true,{ [key]: "false" }), kept);
  assert.deepEqual(splitFillBetweenRegions(a,b,true,{ [key]: "false", "omit empty segments": true }), []);
  assert.deepEqual(splitFillBetweenRegions(a,b,true,{ "omit empty segments": true, [key]: false }), kept);
});

test("a vertex hit is one cut; PGF drops a pair only when both pieces are empty", () => {
  const b = path([0,0],[2,0]);
  const vertex = splitFillBetweenBoundaries(path([0,1],[1,0],[2,1]), b, true);
  assert.deepEqual(vertex.map(r => xy(r.first)), [[[0,1],[1,0]], [[1,0],[2,1]]]);
  // This tiny lobe is below PGF's 1pt width tolerance. The outer pieces
  // remain nonempty despite the other boundary having zero height throughout.
  const a = path([0,-1],[1,0],[1.01,1],[1.02,0],[2,-1]);
  const tiny = splitFillBetweenRegions(a,b,true);
  assert.deepEqual(tiny.map(r => xy(r.first)), [[[0,-1],[1,0]], [[1.02,0],[2,-1]]]);
  const kept = splitFillBetweenRegions(a,b,true,{ "omit empty segments": "false" });
  assert.deepEqual(kept, [tiny[0], {
    first: path([1,0],[1.01,1],[1.02,0]), second: path([1,0],[1.02,0]), reverse: true
  }, tiny[1]]);
});

test("one cubic crosses a line three times although its endpoint chord crosses only once", () => {
  const a = [move(0,-9),curve(4/3,13,8/3,-13,4,9)];
  const b = path([-1,0],[5,0]);
  const regions = splitFillBetweenBoundaries(a,b,true);
  assert.equal(regions.length, 4);
  for (const [i, r] of regions.entries()) {
    assert.deepEqual(r.first.map(c => c.type), ["moveTo","curveTo"]);
    near(r.first[0].x, i); near(r.first[1].x, i+1);
    if (i < 3) near(r.first[1].y, 0);
  }
  expectCubic(regions[0].first[1], [1/3,-3.5,2/3,-1,1,0]);
  // Exact subcurves for t in [1/4,1/2] and [1/2,3/4] of the original cubic.
  expectCubic(regions[1].first[1], [4/3,1,5/3,.5,2,0]);
  expectCubic(regions[2].first[1], [7/3,-.5,8/3,-1,3,0]);
  expectCubic(regions.at(-1).first[1], [10/3,1,11/3,3.5,4,9]);
  assert.deepEqual(regions[0].second[0], move(-1,0));
  assert.deepEqual(regions.at(-1).second.at(-1), line(5,0));
});

test("two curving boundaries with matching nonlinear x(t) retain both Bezier contours", () => {
  const a = [move(0,-8), curve(0,11,4,-11,4,10)];
  const b = [move(4,1), curve(4,2,0,-2,0,1)];
  const regions = splitFillBetweenBoundaries(a,b,false);
  assert.equal(regions.length,4);
  for (const [i,x] of [.625,2,3.375].entries()) {
    const p = regions[i].first.at(-1), q = regions[i].second.at(-1);
    near(p.x,x); near(q.x,x); near(p.y,q.y);
  }
  expectCubic(regions[0].second[1], [0,.25,.25,-.0625,.625,-.125]);
});

test("integration: a native smooth addplot crossing a differently sampled smooth constant keeps cubic fills", () => {
  const { ir, diagnostics } = tikzToSvg(String.raw`\usepgfplotslibrary{fillbetween}
    \begin{tikzpicture}\begin{axis}[hide axis,xmin=0,xmax=4,ymin=-2,ymax=2,scale only axis,width=4cm,height=4cm]
      \addplot[name path=A,smooth,draw=none] coordinates {(0,-1)(1,1)(3,-1)(4,1)};
      \addplot[name path=B,smooth,draw=none] coordinates {(0,0)(2,0)(4,0)};
      \addplot[red] fill between[of=A and B,split,every odd segment/.style={blue}];
    \end{axis}\end{tikzpicture}`);
  assert.deepEqual(diagnostics, []);
  const areas = ir.items.filter(i => i.type === "path" && ["red","blue"].includes(i.style.fill) && i.style.stroke === "none");
  assert.deepEqual(areas.map(a => a.style.fill), ["red","blue","red","blue"]);
  for (const area of areas) {
    assert.ok(area.commands.filter(c => c.type === "curveTo").length >= 2);
    assert.equal(area.commands.at(-1).type, "closePath");
  }
});

test("vertical, folded, closed, multiple-subpath and unresolved cubic pairs request the original unsplit contours", () => {
  const b = path([0,0],[4,0]);
  for (const a of [
    path([1,-1],[1,2],[3,-1]), path([0,-1],[2,2],[1,-1]),
    [move(0,-1),curve(-1,2,4,-2,4,1)],
    [...path([0,-1],[2,2]), { type: "closePath" }],
    [move(0,-1),line(1,1),move(2,1),line(4,-1)]
  ]) assert.deepEqual(splitFillBetweenBoundaries(a,b,true), []);
  const a = [move(0,-1),curve(1,2,3,-2,4,1)];
  const other = [move(0,1),curve(.5,-2,3.5,2,4,-1)];
  assert.deepEqual(splitFillBetweenBoundaries(a,other,true), []);
  assert.deepEqual(splitFillBetweenBoundaries(a, path([0,8],[4,8]), true), []);
});

test("long independently sampled polylines retain their survey vertices without repeated path scans", () => {
  const n = 24000;
  const a = Array.from({ length: n+1 }, (_, i) => (i ? line : move)(i/1000, i/1000-12));
  const b = Array.from({ length: n }, (_, i) => (i ? line : move)((i+.25)/1000, 0));
  const [left,right,...extra] = splitFillBetweenBoundaries(Object.freeze(a),Object.freeze(b),true);
  assert.deepEqual(extra, []);
  assert.equal(left.first.length + right.first.length, a.length+1);
  assert.equal(left.second.length + right.second.length, b.length+2);
  assert.deepEqual(left.first.at(-1), line(12,0));
  assert.deepEqual(right.first[0], move(12,0));
  assert.deepEqual(right.second.at(-1), b.at(-1));
});
