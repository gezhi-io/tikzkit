import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { renderMatrixPlot } from "../src/pgfplots/matrixPaint.js";

const ranges = { xMin: -.5, xMax: 2.5, yMin: -.5, yMax: 1.5 };
const geometry = { lineRanges: ranges, mapPoint: ({ x, y }) => ({ x: x + .5, y: 1.5 - y }) };
const pt = 100 * 2.54 / 72.27;
const cellInk = p => [p.style.fill, p.style.stroke];
const byRole = (items, subtype) => items.filter(p => p.subtype === subtype);
const near = (value, expected) => assert.ok(Math.abs(value - expected) < 1e-5, value + " != " + expected);

function matrix(values, options = {}, explicit = false) {
  const cells = values.map((value, index) => {
    const x = index % 3, y = Math.floor(index / 3);
    const corners = [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([dx,dy]) => ({ x:x + dx, y:y + dy }));
    return { index, point:{x,y}, corners, meta:explicit ? null : value, color:explicit ? value : null };
  });
  return { options:{ "matrix plot":true, ...(explicit && { "mesh/color input":"explicit" }), ...options },
    matrixSurvey:{ cells, scanlineLength:3 } };
}

function scene(commands) {
  const { ir, diagnostics } = tikzToSvg("\\begin{tikzpicture}\n" + commands.join("\n") + "\n\\end{tikzpicture}", { margin:0 });
  assert.deepEqual(diagnostics, []);
  return ir.items;
}

test("flat corner paints the supplied quadrilaterals in the native scanline sweep with a physical same-ink pen", () => {
  const plot = matrix(["red","blue","yellow","black",null,"magenta"], {}, true);
  // A surveyed corner is not generally recoverable from an axis-aligned rectangle.
  plot.matrixSurvey.cells[0].corners[2] = { x:.375, y:.625 };
  const cells = byRole(scene(renderMatrixPlot(plot, {}, ranges, geometry)), "axis-matrix-cell");
  assert.deepEqual(cells.map(cellInk), [["red","red"],["black","black"],["blue","blue"],
    ["rgb(255 255 0)","rgb(255 255 0)"],["rgb(255 0 255)","rgb(255 0 255)"]]);
  assert.deepEqual(cells[0].commands, [
    {type:"moveTo",x:0,y:2}, {type:"lineTo",x:1,y:2}, {type:"lineTo",x:.875,y:.875},
    {type:"lineTo",x:0,y:1}, {type:"closePath"}
  ]);
  for (const p of cells) {
    near(p.style.lineWidth,.4 * pt);
    assert.equal(p.includeStrokeBounds,false);
    assert.deepEqual(p.clipRect,{minX:0,minY:0,maxX:3,maxY:2});
  }
});

const rb = "{rb}{rgb(0cm)=(1,0,0);rgb(1cm)=(0,0,1)}";
function rgb(p) {
  const match = /^rgb\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(p.style.fill);
  assert.ok(match, p.style.fill);
  return match.slice(1).map(Number).map(Math.round);
}
function faces(plot, axis = {}, frame = geometry) {
  return byRole(scene(renderMatrixPlot(plot, axis, ranges, frame)), "axis-matrix-cell");
}

test("MacTeX flat-corner inks use one numeric meta per cell and the selected meta limits", () => {
  const axis = { "point meta min":0, "point meta max":20, colormap:rb };
  const plot = matrix([0,5,10,15,20,30], { "point meta min":10, "point meta max":15 });
  // 0,15,5,20,10,30: MacTeX's mesh image sweep with the custom red/blue map.
  assert.deepEqual(faces(plot, axis).map(rgb), [
    [255,0,0],[62,0,193],[191,0,64],[0,0,255],[127,0,128],[0,0,255]
  ]);
  plot.options["point meta rel"] = "per plot";
  assert.deepEqual(faces(plot, axis).map(rgb), [[255,0,0],[0,0,255],[255,0,0],[0,0,255],[255,0,0],[0,0,255]]);
  // The survey has already merged the limits of other plots for axis-wide mode.
  delete plot.options["point meta rel"];
  plot.matrixSurvey.metaRange = { min:0, max:20 };
  assert.deepEqual(faces(plot, { "pgfplots matrix meta range":{min:0,max:40}, colormap:rb })[4].style.fill,
    faces(plot, axis)[4].style.fill);
});

test("direct colormap access truncates the index, clamps to actual stops, and does not normalize it", () => {
  const plot = matrix([-1.2,.8,1.7,2,2.9,15], { "colormap access":"direct",
    colormap:"{three}{rgb(0cm)=(1,0,0);rgb(1cm)=(0,1,0);rgb(2cm)=(0,0,1)}" });
  plot.matrixSurvey.metaRange = { min:30, max:60 };
  assert.deepEqual(faces(plot).map(rgb), [[255,0,0],[0,0,255],[255,0,0],[0,0,255],[0,255,0],[0,0,255]]);
});

test("the native quick fillstroke uses independent ink, opacity and width without expanding the cell", () => {
  const plot = matrix([0,1,2,3,4,5], { fill:"white", draw:"red", "draw opacity":".4", "fill opacity":".2", "line width":"1pt" });
  const inked = faces(plot, {clip:false});
  for (const p of inked) {
    assert.deepEqual(cellInk(p),["white","red"]);
    assert.equal(p.style.strokeOpacity,.4);
    assert.equal(p.style.fillOpacity,.2);
    near(p.style.lineWidth,pt);
    assert.ok(!p.clipRect);
    assert.equal(p.includeStrokeBounds,false);
  }
  Object.assign(plot.options, { draw:"none", fill:"none" });
  const flat = faces(plot);
  assert.notEqual(flat[0].style.fill,flat[1].style.fill);
  assert.ok(flat.every(p => p.style.stroke === p.style.fill));
  const layered = matrix([0,1,2,3,4,5], { color:"red", fill:"blue" });
  assert.deepEqual(cellInk(faces(layered)[0]),["blue","red"]);
  assert.deepEqual(cellInk(faces(matrix([0,1,2,3,4,5], { fill:"blue", color:"red" }))[0]),["red","red"]);
});

test("holes skip only a face; centers visit source order, each mark immediately followed by its coordindex", () => {
  const plot = matrix([0,1,2,3,NaN,5], { mark:"*", "nodes near coords":"\\coordindex" });
  const after = [];
  const faces = scene(renderMatrixPlot(plot, {}, ranges, geometry, after));
  assert.equal(byRole(faces, "axis-matrix-cell").length, 5);
  assert.equal(byRole(faces, "axis-mark").length, 0);
  const overlay = scene(after);
  assert.deepEqual(overlay.map(p => p.type === "textNode" ? p.text : p.subtype),
    ["axis-mark","0","axis-mark","1","axis-mark","2","axis-mark","3","axis-mark","4","axis-mark","5"]);
  for (const [i, mark] of byRole(overlay,"axis-mark").entries()) {
    assert.deepEqual([mark.cx,mark.cy], [i % 3 + .5, 1.5 - Math.floor(i / 3)]);
    assert.deepEqual(cellInk(mark),["black","black"]);
    assert.ok(!mark.clipRect);
    const node = overlay[2 * i + 1];
    assert.equal(node.font.sizePt,10);
    near(node.x,mark.cx);
    // Native baseline above the center is 3.533pt; the CMR10 digit's half
    // height is 3.222pt. Scene text nodes store the center of the text box.
    assert.ok(Math.abs((node.y - mark.cy) * 100 / pt - 6.755) < .005);
  }
});

test("the visible hole keeps its original index and its marker and label share the requested clip", () => {
  const narrow = { ...geometry, lineRanges:{ xMin:.99, xMax:1.01, yMin:.5, yMax:1 } };
  const plot = matrix([0,1,2,3,Infinity,5], { mark:"o", "mark options":"draw=orange", "nodes near coords":"\\coordindex" });
  const items = scene(renderMatrixPlot(plot, { "clip marker paths":true }, ranges, narrow));
  const cells = byRole(items,"axis-matrix-cell");
  const [mark] = byRole(items,"axis-mark"), [node] = items.filter(p => p.type === "textNode");
  assert.equal(cells.length,5);
  assert.equal(byRole(items,"axis-mark").length,1);
  assert.deepEqual([mark.cx,mark.cy,node.text],[1.5,.5,"4"]);
  assert.deepEqual(cellInk(mark),["none","rgb(255 128 0)"]);
  assert.deepEqual(mark.clipRect,{minX:1.49,minY:.5,maxX:1.51,maxY:1});
  assert.deepEqual(node.clipRect,mark.clipRect);
  assert.ok(items.indexOf(cells.at(-1)) < items.indexOf(mark));
  assert.ok(items.indexOf(mark) < items.indexOf(node));
});

test("an unstarred addplot with qualified keys draws the grid below its foreground ticks and interleaved labels", () => {
  const { ir, diagnostics } = tikzToSvg(String.raw`\usepackage{pgfplots}\pgfplotsset{compat=1.18}
    \begin{tikzpicture}\begin{axis}[xtick={0,1},ytick=\empty,enlargelimits=false]
    \addplot[/pgfplots/matrix plot,mesh/cols=2,/pgfplots/mesh/color input=explicit,
      /tikz/mark=*,/pgfplots/nodes near coords=\coordindex] coordinates {
      (0,0)[color=red] (1,0)[] (0,1)[color=yellow] (1,1)[color=blue]};
    \end{axis}\end{tikzpicture}`, { margin:0 });
  assert.deepEqual(diagnostics,[]);
  const items = ir.items, cells = byRole(items,"axis-matrix-cell"), ticks = byRole(items,"axis-tick");
  assert.deepEqual(cells.map(p => p.style.fill), ["red","rgb(255 255 0)","blue"]);
  assert.ok(items.indexOf(cells.at(-1)) < items.indexOf(ticks[0]));
  const marks = byRole(items,"axis-mark");
  assert.ok(items.indexOf(ticks.at(-1)) < items.indexOf(marks[0]));
  assert.deepEqual(marks.map(mark => items[items.indexOf(mark) + 1].text),["0","1","2","3"]);
});
