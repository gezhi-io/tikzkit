import assert from "node:assert/strict";
import test from "node:test";
import { parseOptions } from "../src/engine/options.js";
import { tikzToSvg } from "../src/index.js";
import { parseAddplots } from "../src/pgfplots/addplotParser.js";
import { renderAddplot } from "../src/pgfplots/addplotLowering.js";
import { namedFillBetweenBoundaries } from "../src/pgfplots/fillBetweenBoundaries.js";
import { formatAxisPathCommands } from "../src/pgfplots/format.js";
import { createAxisGeometry } from "../src/pgfplots/geometry.js";

const limits = { xMin: 0, xMax: 4, yMin: 0, yMax: 4 };
const frame = "hide axis,scale only axis,enlargelimits=false,width=4cm,height=4cm";
const M = (x, y) => ({ type: "moveTo", x, y });
const L = (x, y) => ({ type: "lineTo", x, y });
const C = (x1, y1, x2, y2, x, y) => ({ type: "curveTo", x1, y1, x2, y2, x, y });

function extract(body, extra = "", ranges = limits) {
  const keys = `${frame},xmin=${ranges.xMin},xmax=${ranges.xMax},ymin=${ranges.yMin},ymax=${ranges.yMax},${extra}`;
  const axis = parseOptions(keys);
  const paths = namedFillBetweenBoundaries(body, parseAddplots(body), axis, ranges, createAxisGeometry(axis, ranges));
  return { paths, source: String.raw`\pgfplotsset{compat=1.18}\begin{tikzpicture}\begin{axis}[${keys}]${body}\end{axis}\end{tikzpicture}` };
}

function paintedOutline(source) {
  const { ir, diagnostics } = tikzToSvg(source);
  assert.deepEqual(diagnostics, []);
  return ir.items.find(item => item.subtype === "axis-plot").commands;
}

test("a reversed logarithmic named staircase retains the outline's projected midpoint corners", () => {
  const { paths, source } = extract(String.raw`\addplot[name path=A,const plot mark mid,mark=*]
    coordinates {(1,1) (4,3) (16,2)};`, "xmode=log,log basis x=2,x dir=reverse", { ...limits, xMin: 1, xMax: 16 });
  assert.deepEqual(paths.get("A"), [M(4,1),L(3,1),L(3,3),L(2,3),L(1,3),L(1,2),L(0,2)]);
  assert.deepEqual(paths.get("A"), paintedOutline(source));
});

test("a named smooth parametric function uses the exact cubic supports of its painted outline", () => {
  const { paths, source } = extract(String.raw`\addplot[name path global=wave,smooth,/tikz/tension=.9,samples at={0,1,3,4}]
    ({x},{2+cos(90*x)});`);
  const curve = paths.get("wave");
  assert.deepEqual(curve.map(p => p.type), ["moveTo", "curveTo", "curveTo", "curveTo"]);
  assert.notEqual(curve[1].x2, curve[1].x);
  assert.equal(formatAxisPathCommands(curve), formatAxisPathCommands(paintedOutline(source)));
});

test("jump handlers and unbounded observations preserve moves between runs, not connecting lines", () => {
  const body = String.raw`\addplot[name path=J,jump mark left,unbounded coords=jump]
    coordinates {(0,1) (1,2) (2,nan) (3,3) (4,1)};`;
  const { paths, source } = extract(body);
  assert.deepEqual(paths.get("J"), [M(0,1),L(1,1),M(1,2),M(3,3),L(4,3),M(4,1)]);
  assert.deepEqual(paths.get("J"), paintedOutline(source));
});

test("a named sampled line keeps off-frame endpoints for later reversal and clipping", () => {
  const { paths, source } = extract(String.raw`
    \addplot[name path=A,draw=none,domain=-1:5,samples=3] {2};
    \addplot[/tikz/name path=B,draw=none,samples at={0,1,2}] ({5-3*x},{1});`);
  assert.deepEqual(paths.get("A"), [M(-1,2),L(2,2),L(5,2)]);
  assert.deepEqual(paths.get("B"), [M(5,1),L(2,1),L(-1,1)]);
  const { ir, diagnostics } = tikzToSvg(source);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(ir.items.filter(item => item.subtype === "axis-plot").map(item => item.commands),
    [[M(0,2),L(2,2),L(4,2)], [M(4,1),L(2,1),L(0,1)]]);
});

test("two entirely off-frame named functions enclose a visible, frame-clipped band", () => {
  const { source } = extract(String.raw`
    \addplot[name path=hi,draw=none,domain=-1:5,samples=2] {5};
    \addplot[name path=lo,draw=none,domain=-1:5,samples=2] {-1};
    \addplot[fill=red] fill between[of=hi and lo];`);
  const { ir, diagnostics } = tikzToSvg(source);
  assert.deepEqual(diagnostics, []);
  const band = ir.items.find(item => item.style?.fill === "red");
  assert.deepEqual(band?.commands, [M(-1,5),L(5,5),L(5,-1),L(-1,-1),{ type: "closePath" }]);
  assert.deepEqual(band.clipRect, { minX: 0, minY: 0, maxX: 4, maxY: 4 });
});

test("boundary extraction and painting reuse the same sampled expression stream", () => {
  const [plot] = parseAddplots(String.raw`\addplot[name path=F,domain=0:4,samples=3] {2*x};`);
  let reads = 0;
  Object.defineProperty(plot, "expression", { get() { reads++; return "2*x"; } });
  const axis = parseOptions(frame), geometry = createAxisGeometry(axis, limits), options = {};
  const paths = namedFillBetweenBoundaries("", [plot], axis, limits, geometry, options);
  assert.equal(paths.get("F").length, 3);
  renderAddplot(plot, axis, limits, geometry, options);
  assert.equal(reads, 1);
});

test("explicit axis-overlay controls stay controls; straight segments and second subpaths stay distinct", () => {
  const { paths } = extract(String.raw`
    % \draw[name path=comment] (0,0) -- (1,1);
    \path[draw=none,name path global=arched] (axis cs:10,0)
      .. controls (axis cs:11,3) and (axis cs:13,4) .. (axis cs:14,2)
      -- (rel axis cs:.75,.25) (axis cs:10,4) -- (axis cs:12,0);
    \draw[blue,name path=base] (axis cs:\pgfkeysvalueof{/pgfplots/xmin},1)
      -- (axis cs:\pgfkeysvalueof{/pgfplots/xmax},1);`, "", { ...limits, xMin: 10, xMax: 14 });
  assert.deepEqual([...paths.keys()], ["arched", "base"]);
  assert.deepEqual(paths.get("arched"), [M(0,0),C(1,3,3,4,4,2),L(3,1),M(0,4),L(2,0)]);
  assert.deepEqual(paths.get("base"), [M(0,1),L(4,1)]);
});

test("unsupported construction invalidates the whole boundary instead of fabricating a chord", () => {
  const { paths } = extract(String.raw`
    \addplot[name path=marks,only marks] coordinates {(0,0) (2,1)};
    \addplot[name path=bars,ybar] coordinates {(1,1) (2,1)};
    \path[name path=arc] (0,0) -- (1,0) arc[start angle=0,end angle=90,radius=1] -- (4,3);
    \path[name path=bent] (0,0) to[bend left] (3,2);
    \path[name path=missing] (0,0) .. controls (1,2) and (unknown) .. (3,1);
    \path[name path=closed] (0,0) -- (1,1) -- cycle;
    \path[name path=point] (0,0);
    \path[name path=ok] (1,1) -- (3,2);`);
  assert.deepEqual([...paths], [["ok", [M(1,1),L(3,2)]]]);
});
