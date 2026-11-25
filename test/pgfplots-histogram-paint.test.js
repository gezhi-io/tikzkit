import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { renderAddplot } from "../src/pgfplots/addplotLowering.js";
import { renderAxisTicks } from "../src/pgfplots/ticks.js";

// PGFPlots manual, statistics, hist/handler examples (MacTeX 2025).
const samples = String.raw`table[row sep=\\,y index=0]{data\\1\\2\\1\\5\\4\\10\\7\\10\\9\\8\\9\\9\\}`;
const tuples = [[1,3], [4,2], [7,7], [10,7]];
const pts = tuples.map(([x,y]) => ({x,y}));
const bounds = { xMin: 0, xMax: 12, yMin: -2, yMax: 8 };
const frame = { lineRanges: bounds, mapPoint: ({x,y}) => ({x,y}) };
const role = (scene, subtype) => scene.filter(p => p.subtype === subtype);
const xy = p => [p.x,p.y];
const ink = p => [p.style.stroke,p.style.fill];
const near = (a, b) => assert.ok(Math.abs(a - b) < .00001, `${a} != ${b}`);
const commands = p => p.commands.map(c => c.type === "closePath" ? ["Z"] : [c.type === "moveTo" ? "M" : "L", c.x,c.y]);

function scene(source) {
  const { ir, diagnostics } = tikzToSvg(source, { margin: 0 });
  assert.deepEqual(diagnostics, []);
  return ir.items;
}

function lower(handler, extra = {}, points = pts, axis = {}, geometry = frame) {
  const options = { [handler]: true, "pgfplots histogram": true, ...extra };
  const plot = { type: "coordinates", histogram: { handler }, options, points };
  const marks = [];
  const paint = renderAddplot(plot, axis, bounds, geometry, {}, 0, marks);
  return scene(`\\begin{tikzpicture}\n${[...paint, ...marks].join("\n")}\n\\end{tikzpicture}`);
}

function chart(axis, plots) {
  return scene(String.raw`\usepackage{pgfplots}\pgfplotsset{compat=1.18}
    \begin{tikzpicture}\begin{axis}[${axis}]${plots}\end{axis}\end{tikzpicture}`);
}

function rectangles(path) {
  const rects = [];
  for (const cmd of path.commands) {
    if (cmd.type === "moveTo") rects.push([]);
    if (cmd.type !== "closePath") rects.at(-1).push(xy(cmd));
  }
  return rects;
}

test("manual default: one unfilled interval path, three closed outlines, four line-cycle marks, no axis grid", () => {
  const items = chart("x=1cm,y=1cm", String.raw`\addplot+[hist={bins=3}] ${samples};`);
  assert.equal(role(items,"axis-grid-line").length, 0);
  const bars = role(items,"axis-bar");
  assert.equal(bars.length, 1);
  assert.deepEqual(ink(bars[0]), ["blue","none"]);
  assert.deepEqual(rectangles(bars[0]), [
    [[.9,0],[3.9,0],[3.9,1.5],[.9,1.5]], [[3.9,0],[6.9,0],[6.9,.5],[3.9,.5]],
    [[6.9,0],[9.9,0],[9.9,5.5],[6.9,5.5]]
  ]);
  assert.deepEqual(bars[0].clipRect, {minX:0,minY:0,maxX:10.8,maxY:6});
  const marks = role(items,"axis-mark");
  assert.deepEqual(marks.map(p => [p.cx,p.cy]), [[.9,1.5],[3.9,.5],[6.9,5.5],[9.9,5.5]]);
  assert.ok(marks.every(p => !p.clipRect && p.style.fill === "rgb(0 0 204)"));
  assert.ok(items.indexOf(bars[0]) < items.indexOf(marks[0]));
});

test("without a terminal copy the last height is surveyed and marked but does not start a rectangle", () => {
  const items = chart("x=1cm,y=1cm", String.raw`\addplot+[hist={bins=3,intervals=false}] ${samples};`);
  const [bars] = role(items,"axis-bar");
  assert.deepEqual(rectangles(bars), [
    [[.6,0],[3.6,0],[3.6,1.5],[.6,1.5]], [[3.6,0],[6.6,0],[6.6,.5],[3.6,.5]]
  ]);
  assert.deepEqual(role(items,"axis-mark").map(p => [p.cx,p.cy]), [[.6,1.5],[3.6,.5],[6.6,5.5]]);
  near(bars.clipRect.maxX,7.2);
  near(bars.clipRect.maxY,6);
});

test("a narrow density range retains its projected bar height and its visible zero level", () => {
  const items = chart("scale only axis,width=6cm,height=4cm,enlargelimits=false",
    String.raw`\addplot[hist={bins=2,data min=0,data max=20000,density}] coordinates {(0,1)(0,2)(0,15000)};`);
  const [bars] = role(items,"axis-bar");
  assert.deepEqual(rectangles(bars), [
    [[0,0],[3,0],[3,4],[0,4]], [[3,0],[6,0],[6,0],[3,0]]
  ]);
});

test("all manual line examples paint only their emitted tuples, including the optional repeated terminal height", () => {
  const all = [[.9,1.5],[3.9,.5],[6.9,5.5],[9.9,5.5]];
  const short = [[.6,1.5],[3.6,.5],[6.6,5.5]];
  const examples = [
    ["const plot", "", all, [[.9,1.5],[3.9,1.5],[3.9,.5],[6.9,.5],[6.9,5.5],[9.9,5.5],[9.9,5.5]]],
    ["sharp plot", "", all, all],
    ["sharp plot", ",intervals=false", short, short]
  ];
  for (const [handler, extra, expectedMarks, expectedPath] of examples) {
    const items = chart("x=1cm,y=1cm", String.raw`\addplot+[hist={bins=3,handler/.style={${handler}}${extra}}] ${samples};`);
    const [line] = role(items,"axis-plot");
    const marks = role(items,"axis-mark");
    assert.deepEqual(ink(line),["blue","none"]);
    assert.deepEqual(line.commands.map(xy),expectedPath);
    assert.deepEqual(marks.map(p => [p.cx,p.cy]),expectedMarks);
    near(line.clipRect.maxX,extra ? 7.2 : 10.8);
    assert.deepEqual([line.clipRect.minX,line.clipRect.minY,line.clipRect.maxY],[0,0,6]);
    assert.equal(role(items,"axis-bar").length,0);
  }
});

test("interval width and shift operate on signed, projected edge spacing; zero is not an explicit negative ymin", () => {
  const geometry = { ...frame, mapPoint: ({x,y}) => ({x:12-x,y}) };
  const items = lower("ybar interval", { "bar interval width": ".5", "bar interval shift": ".25",
    draw:"red", fill:"white", "draw opacity":".4", "fill opacity":".25" }, pts, {}, geometry);
  const [bars] = role(items,"axis-bar");
  assert.deepEqual(rectangles(bars), [
    [[11,0],[9.5,0],[9.5,3],[11,3]], [[8,0],[6.5,0],[6.5,2],[8,2]],
    [[5,0],[3.5,0],[3.5,7],[5,7]]
  ]);
  assert.deepEqual(ink(bars), ["red","white"]);
  assert.equal(bars.style.strokeOpacity,.4);
  assert.equal(bars.style.fillOpacity,.25);
});

test("fixed-width ybar paints even the terminal tuple; marks stay on the unshifted bin coordinates", () => {
  const items = lower("ybar", { "bar width":"8pt", "bar shift":"2pt", mark:"*" });
  const rects = rectangles(role(items,"axis-bar")[0]);
  assert.equal(rects.length,4);
  for (const [i, rect] of rects.entries()) {
    near(rect[0][0], tuples[i][0] - 2 * 2.54/72.27);
    near(rect[1][0], tuples[i][0] + 6 * 2.54/72.27);
    near(rect[0][1],0); near(rect[2][1],tuples[i][1]);
  }
  assert.deepEqual(role(items,"axis-mark").map(p => [p.cx,p.cy]), tuples);
});

test("stock step and jump handlers visit native corners and subpath breaks, never marking generated corners", () => {
  const variants = [
    ["sharp plot", [["M",1,3],["L",4,2]]],
    ["const plot", [["M",1,3],["L",4,3],["L",4,2]]],
    ["const plot mark left", [["M",1,3],["L",4,3],["L",4,2]]],
    ["const plot mark right", [["M",1,3],["L",1,2],["L",4,2]]],
    ["const plot mark mid", [["M",1,3],["L",2.5,3],["L",2.5,2],["L",4,2]]],
    ["jump mark left", [["M",1,3],["L",4,3],["M",4,2]]],
    ["jump mark right", [["M",1,3],["M",1,2],["L",4,2]]],
    ["jump mark mid", [["M",1,3],["L",2.5,3],["M",2.5,2],["L",4,2]]]
  ];
  for (const [handler, expected] of variants) {
    const items = lower(handler, { mark:"*", draw:"red", dashed:true, opacity:".4" }, pts.slice(0,2), { "const plot":true });
    const path = role(items,"axis-plot")[0];
    assert.deepEqual(commands(path),expected,handler);
    assert.equal(path.style.strokeOpacity,.4,handler);
    assert.deepEqual(ink(path),["red","none"]);
    assert.ok(path.style.dashArray?.length);
    assert.deepEqual(role(items,"axis-mark").map(p => [p.cx,p.cy]),tuples.slice(0,2));
  }
});

test("an open filled histogram line uses its own contour, not baseline bars or a forced stroke", () => {
  const items = lower("sharp plot", { draw:"none", fill:"red", "fill opacity":".35" }, pts.slice(0,3));
  const [path] = role(items,"axis-plot");
  assert.deepEqual(ink(path),["none","red"]);
  assert.deepEqual(commands(path), [["M",1,3],["L",4,2],["L",7,7]]);
  assert.equal(path.style.fillOpacity,.35);
});

test("the selected histogram handler replaces an earlier bar flag and closes a filled step against zero", () => {
  const items = chart("x=1cm,y=1cm,xmin=0,xmax=12,ymin=-2,ymax=8",
    String.raw`\addplot+[ybar,hist={bins=3,data min=1,data max=10,handler/.style={/tikz/const plot}},draw=red,fill=green,mark=none] ${samples} \closedcycle;`);
  assert.equal(role(items,"axis-bar").length,0);
  const [path] = role(items,"axis-closed-cycle");
  assert.deepEqual(ink(path),["red","rgb(0 255 0)"]);
  assert.deepEqual(commands(path), [
    ["M",1,5],["L",4,5],["L",4,4],["L",7,4],["L",7,9],["L",10,9],["L",10,9],
    ["L",10,2],["L",1,2],["Z"]
  ]);
});

test("clipping uses emitted mark centers and preserves global versus individual marker order", () => {
  const intervalPlot = String.raw`\addplot+[hist={bins=3,data min=1,data max=10}] ${samples};`;
  const linePlot = String.raw`\addplot+[hist={bins=3,data min=1,data max=10,handler/.style={const plot}}] ${samples};`;
  const kinds = items => items.map(p => p.subtype).filter(s => ["axis-mark","axis-bar","axis-plot"].includes(s));
  for (const [clip, expected] of [
    ["", ["axis-bar","axis-plot","axis-mark","axis-mark","axis-mark","axis-mark"]],
    ["clip marker paths=true", ["axis-bar","axis-mark","axis-mark","axis-plot","axis-mark","axis-mark"]]
  ]) {
    const items = chart("x=1cm,y=1cm,xmin=1.02,xmax=9.98,ymin=0,ymax=8," + clip, intervalPlot + linePlot);
    assert.deepEqual(kinds(items),expected);
    const rect = role(items,"axis-bar")[0].clipRect;
    assert.ok(rect);
    assert.deepEqual(role(items,"axis-plot")[0].clipRect, rect);
    assert.ok(role(items,"axis-mark").every(p => clip ? p.clipRect?.maxX === rect.maxX : !p.clipRect));
  }
  const off = chart("x=1cm,y=1cm,xmin=1.02,xmax=9.98,ymin=0,ymax=8,clip=false", intervalPlot);
  assert.equal(role(off,"axis-mark").length,4);
  assert.ok(!role(off,"axis-bar")[0].clipRect);
});

test("axis ybar interval style groups matching series and labels the left values halfway between tick marks", () => {
  const plot = String.raw`\addplot+[hist={bins=3,data min=1,data max=10}] ${samples};`;
  const items = chart("scale only axis,width=12cm,height=8cm,xmin=0,xmax=12,ymin=0,ymax=8,enlargelimits=false,ybar interval",
    plot + plot);
  const bars = role(items,"axis-bar");
  assert.deepEqual(bars.map(ink), [["blue","rgb(179 179 255)"],["red","rgb(255 179 179)"]]);
  assert.deepEqual(rectangles(bars[0])[0], [[1,0],[2.5,0],[2.5,3],[1,3]]);
  assert.deepEqual(rectangles(bars[1])[0], [[2.5,0],[4,0],[4,3],[2.5,3]]);
  assert.equal(role(items,"axis-mark").length,0);
  assert.deepEqual(role(items,"axis-grid-line").map(p => p.commands[0].x),[1,4,7,10]);
  assert.deepEqual(items.filter(p => p.type === "textNode" && p.y < 0).map(p => [p.x,p.text]), [[2.5,"1"],[5.5,"4"],[8.5,"7"]]);
});

test("a raw TikZ interval handler overlays complete intervals and keeps the ordinary two-series cycle", () => {
  const plot = String.raw`\addplot+[hist={bins=3,data min=1,data max=10}] ${samples};`;
  const items = chart("x=1cm,y=1cm,xmin=0,xmax=12,ymin=0,ymax=8,/tikz/ybar interval", plot + plot);
  const bars = role(items,"axis-bar");
  assert.deepEqual(bars.map(ink),[["blue","none"],["red","none"]]);
  assert.deepEqual(rectangles(bars[0]),rectangles(bars[1]));
  assert.deepEqual(rectangles(bars[0])[0],[[1,0],[4,0],[4,3],[1,3]]);
  assert.equal(role(items,"axis-mark").length,8);
  assert.equal(role(items,"axis-grid-line").length,0);
});

test("interval labels use the next tick only on request and leave both end ticks on the frame", () => {
  const axis = { xtick:"1,4,7,10", ytick:"none", "x tick label as interval":true };
  const marksAndLabels = options => {
    const paint = renderAxisTicks({ ...axis, ...options }, [], bounds, frame);
    const items = scene("\\begin{tikzpicture}\n" + paint.join("\n") + "\n\\end{tikzpicture}");
    const labels = items.filter(p => p.type === "textNode");
    const ticks = role(items,"axis-tick").map(p => p.commands[0].x);
    return { labels:labels.map(p => [p.x,p.text]), ticks:[...new Set(ticks)] };
  };
  assert.deepEqual(marksAndLabels({}), {
    labels:[[2.5,"1"],[5.5,"4"],[8.5,"7"]], ticks:[1,4,7,10]
  });
  const formatted = marksAndLabels({ xticklabel: String.raw`(\pgfmathprintnumber{\tick},\pgfmathprintnumber\nexttick)` });
  assert.deepEqual(formatted.labels,[[2.5,"(1,4)"],[5.5,"(4,7)"],[8.5,"(7,10)"]]);
  const overrides = marksAndLabels({ "x tick label as interval":"false", xticklabels:"a,b,c,d" });
  assert.deepEqual(overrides.labels,[[1,"a"],[4,"b"],[7,"c"],[10,"d"]]);
});

test("histogram nodes near coords visit every emitted tuple, including the terminal edge", () => {
  const items = lower("ybar interval", { "nodes near coords":true });
  assert.deepEqual(items.filter(p => p.type === "textNode").map(p => p.text), ["3","2","7","7"]);
});
