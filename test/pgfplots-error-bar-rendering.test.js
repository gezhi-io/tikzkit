import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { computeAxisRanges } from "../src/pgfplots/rangeResolver.js";

const cmPerPt = 2.54 / 72.27;
const fixedBox = "xmin=0,xmax=4,ymin=0,ymax=4";

function picture(plot, options = fixedBox) {
  const { ir, diagnostics } = tikzToSvg(String.raw`\begin{tikzpicture}
    \begin{axis}[hide axis,scale only axis,width=4cm,height=4cm,enlargelimits=false,${options}]
    ${plot}\end{axis}\end{tikzpicture}`);
  assert.deepEqual(diagnostics, []);
  return ir.items;
}

const named = (items, subtype) => items.filter(item => item.subtype === subtype);
const vertices = item => item.commands.map(({ x, y }) => [x, y]);
const near = (actual, expected, tolerance = 0.00001) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test("measurement tuples do not join the line or receive ordinary markers", () => {
  const items = picture(String.raw`\addplot+[error bars/.cd,y dir=both,y explicit]
    coordinates {(1,2) +- (0,.5) (3,1) +- (0,.25)};`);
  assert.deepEqual(vertices(named(items, "axis-plot")[0]), [[1,2], [3,1]]);
  assert.deepEqual(named(items, "axis-mark").map(({cx, cy}) => [cx, cy]), [[1,2], [3,1]]);
  const stems = named(items, "axis-error-bar"), caps = named(items, "axis-error-cap");
  assert.deepEqual(stems.map(vertices), [
    [[1,2],[1,2.5]], [[1,2],[1,1.5]], [[3,1],[3,1.25]], [[3,1],[3,.75]]
  ]);
  assert.equal(caps.length, 4);
  for (const [i, cap] of caps.entries()) {
    const [[x1,y1],[x2,y2]] = vertices(cap);
    const [x,y] = vertices(stems[i])[1];
    near((x1+x2)/2, x); near(y1, y); near(y2, y);
    near(Math.abs(x1-x2), 4*cmPerPt);
    assert.equal(cap.style.stroke, "blue");
    assert.deepEqual(cap.clipRect, stems[i].clipRect);
  }
  assert.ok(items.indexOf(stems[0]) > items.indexOf(named(items, "axis-plot")[0]));
  assert.ok(items.indexOf(caps.at(-1)) < items.indexOf(named(items, "axis-mark")[0]));
});

test("absolute errors participate in the survey without changing explicit bounds", () => {
  const series = {type:"coordinates", options:{"error bars/.cd":true, "y dir":"both", "y explicit":true},
    points:[{x:1,y:4,errors:{y:{plus:3,minus:.5}}}, {x:2,y:2,errors:{y:{minus:4}}}]};
  const automatic = computeAxisRanges({enlargelimits:false}, [series]);
  assert.deepEqual([automatic.xMin,automatic.xMax,automatic.yMin,automatic.yMax], [1,2,-2,7]);
  const limited = computeAxisRanges({enlargelimits:false,ymin:0}, [series]);
  assert.deepEqual([limited.yMin,limited.yMax], [0,7]);
  const tiny = computeAxisRanges({enlargelimits:false}, [{...series,
    points:[{x:1,y:1,errors:{y:{plus:.00032,minus:.00018}}}, {x:2,y:1}]}]);
  assert.deepEqual([tiny.yMin,tiny.yMax], [.99982,1.00032]);
});

test("grouped bars shift the shaft and both caps with each bar's physical center", () => {
  const items = picture(String.raw`\addplot[draw=blue,fill=blue!30,error bars/.cd,y dir=both,y explicit]
    coordinates {(2,2) += (0,1) -= (0,.5)};
    \addplot[draw=red,fill=red!30,error bars/.cd,y dir=both,y explicit]
    coordinates {(2,1) += (0,.25) -= (0,.75)};`, fixedBox + ",ybar=2pt,bar width=8pt");
  const bars = named(items, "axis-bar"), stems = named(items, "axis-error-bar"), caps = named(items, "axis-error-cap");
  assert.deepEqual([bars.length, stems.length, caps.length], [2,4,4]);
  for (const [i, endY] of [3,1.5,1.25,.25].entries()) {
    const leftSeries = i < 2, center = 2 + (leftSeries ? -5 : 5) * cmPerPt;
    const [left,right] = vertices(bars[leftSeries ? 0 : 1]);
    near((left[0] + right[0]) / 2, center);
    for (const [x] of vertices(stems[i])) near(x, center);
    assert.equal(stems[i].style.stroke, leftSeries ? "blue" : "red");
    const [[x1,y1],[x2,y2]] = vertices(caps[i]);
    near((x1+x2)/2, center); near(y1, endY); near(y2, endY);
    assert.equal(caps[i].style.stroke, "black");
  }
});

test("a fixed error on sampled data is not attached to interpolated clip points", () => {
  const plot = String.raw`\addplot[blue,mark=none,domain=-1:5,samples=3,error bars/.cd,x dir=plus,x fixed=.5] {2};`;
  const items = picture(plot);
  const stems = named(items, "axis-error-bar");
  assert.deepEqual(stems.map(vertices), [[[-1,2],[-.5,2]],[[2,2],[2.5,2]],[[5,2],[5.5,2]]]);
  for (const path of [...stems, ...named(items, "axis-error-cap")]) assert.ok(path.clipRect);
  const unclipped = picture(plot, fixedBox + ",clip=false");
  assert.equal(named(unclipped, "axis-error-bar").length, 3);
  assert.ok(named(unclipped, "axis-error-bar").every(path => !path.clipRect));
});

test("only unclipped error marks reserve the enclosing TikZ node's padding on the page", () => {
  const tex = readFileSync(new URL("./fixtures/native-pgfplots-error-bars/auto-extents.tex", import.meta.url), "utf8");
  for (const [clip, paddingPt] of [[false, .3333 * 10], [true, .4 / 2]]) {
    const { svg, diagnostics } = tikzToSvg(tex.replace("clip=false", `clip=${clip}`));
    assert.deepEqual(diagnostics, []);
    const [, , width, height] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
    // The standalone border is two more points on every side.
    const margin = 2 * (2 + paddingPt) * cmPerPt;
    near(width / 100, 5.6 + margin);
    near(height / 100, 3.5 + margin);
  }
});

test("the nested cap inherits the resolved dash and opacity, not the shaft's pen or stroke-only ink", () => {
  const read = (extra = "") => picture(String.raw`\addplot[blue,very thick,mark size=7pt,only marks,mark=none,
    error bars/.cd,y dir=plus,y fixed=1,error bar style={draw=red,mark size=5pt,line width=1.8pt,loosely dotted,opacity=.65}${extra}]
    coordinates {(2,2)};`);
  const first = read();
  const [stem] = named(first, "axis-error-bar"), [cap] = named(first, "axis-error-cap");
  assert.equal(stem.style.stroke,"red"); assert.equal(cap.style.stroke,"blue");
  near(stem.style.lineWidth, 1.8*cmPerPt*100); near(cap.style.lineWidth, .4*cmPerPt*100);
  assert.equal(cap.style.strokeOpacity,.65); assert.deepEqual(cap.style.dashArray,stem.style.dashArray);
  near(Math.abs(vertices(cap)[0][0] - vertices(cap)[1][0]), 10*cmPerPt);
  const [custom] = named(read(",error mark options={draw=green,mark size=3pt,line width=.9pt,densely dashed,opacity=.8}"), "axis-error-cap");
  assert.equal(custom.style.stroke, "rgb(0 255 0)"); assert.equal(custom.style.strokeOpacity,.8);
  near(custom.style.lineWidth,.9*cmPerPt*100);
  near(custom.style.dashArray[0],3*cmPerPt*100); near(custom.style.dashArray[1],2*cmPerPt*100);
  near(Math.abs(vertices(custom)[0][1] - vertices(custom)[1][1]),6*cmPerPt);
  assert.ok(custom.style.opacity === undefined || custom.style.opacity === 1, "opacity must not multiply the inherited .65");
});

test("explicit zeros paint four coincident horizontal caps; an absent error paints none", () => {
  const items = picture(String.raw`\addplot[only marks,mark=none,error bars/.cd,x dir=both,x explicit,y dir=both,y explicit]
    coordinates {(1,2) +- (0,0) (3,3)};`);
  const caps = named(items, "axis-error-cap");
  assert.equal(caps.length,4);
  assert.equal(named(items,"axis-mark").length,0);
  for (const cap of caps) {
    const [[x1,y1],[x2,y2]] = vertices(cap);
    near((x1+x2)/2,1); near(y1,2); near(y2,2); near(Math.abs(x2-x1),4*cmPerPt);
  }
});
