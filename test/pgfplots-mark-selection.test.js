import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { parseOptions } from "../src/engine/options.js";
import { renderLegendEntries } from "../src/pgfplots/legend.js";

const frame = "hide axis,scale only axis,width=5cm,height=2cm,xmin=0,xmax=5,ymin=0,ymax=2,enlargelimits=false";
const run = "coordinates {(0,1)(1,1)(2,1)(3,1)(4,1)(5,1)}";
const gap = "coordinates {(-1,1)(0,1)(1,1)(2,1)(nan,nan)(7,1)(3,1)(4,1)(5,1)}";
const add = (opts, data = run, tail = "") => "\\addplot[" + opts + "] " + data + " " + tail + ";";
function render(body, axis = "", preamble = "") {
  const { ir, diagnostics } = tikzToSvg("\\pgfplotsset{compat=1.18}" + preamble + "\\begin{tikzpicture}\\begin{axis}[" +
    frame + "," + axis + "]" + body + "\\end{axis}\\end{tikzpicture}", { margin: 0 });
  assert.deepEqual(diagnostics, []);
  return ir.items;
}
const byRole = (items, role) => items.filter(p => p.subtype === role);
const marks = items => byRole(items, "axis-mark").map(p => p.cx);
const labels = items => items.filter(p => p.type === "textNode").map(p => p.text);
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.00001, a + " != " + b);

// TeX Live 2025, compat=1.18: a probe in \pgfdeclareplotmark logged the
// selected \coordindex values. The jump entry itself has no coordindex.
test("clipping precedes selection; only a jump restarts the marker stream", () => {
  for (const [axis, expected] of [
    ["unbounded coords=jump", [0,2,3,5]],
    ["unbounded coords=jump,clip mode=individual", [0,2,3,5]],
    ["unbounded coords=jump,clip marker paths", [0,2,3,5]],
    ["unbounded coords=discard", [0,2,4]],
    ["unbounded coords=jump,clip=false", [-1,1,7,4]],
    ["unbounded coords=discard,clip=false", [-1,1,7,4]]
  ]) {
    const items = render(add("smooth,mark=*,mark repeat=2", gap), axis);
    assert.deepEqual(marks(items), expected, axis);
    assert.ok(byRole(items, "axis-mark").every(p => Boolean(p.clipRect) === axis.includes("clip marker paths")));
    const [path] = byRole(items, "axis-plot");
    assert.deepEqual(path.commands, byRole(render(add("smooth,mark=none", gap), axis), "axis-plot")[0].commands);
  }
  const blank = "coordinates {(0,1)(1,1)(2,1)\\par (3,1)(4,1)(5,1)}";
  assert.deepEqual(marks(render(add("only marks,mark indices={2}", blank))), [1,4]);
  assert.deepEqual(marks(render(add("only marks,mark indices={2},empty line=none", blank))), [1]);
});

test("each plot gets a fresh selector in both paint orders; paths, inline nodes and endpoints survive", () => {
  const body = add("red,mark=*") + add("blue,mark=*,/tikz/mark phase=2", run, "node[pos=1]{End}");
  for (const [mode, order] of [
    ["global", ["axis-plot","axis-plot","axis-mark","axis-mark","axis-mark","axis-mark"]],
    ["individual", ["axis-plot","axis-mark","axis-mark","axis-plot","axis-mark","axis-mark"]]
  ]) {
    const items = render(body, "mark repeat=3,clip mode=" + mode);
    assert.deepEqual(items.map(p => p.subtype).filter(role => order.includes(role)), order);
    assert.deepEqual(marks(items), [0,3,1,4]);
    assert.deepEqual(byRole(items, "axis-plot").map(p => p.commands.at(-1).x), [5,5]);
    assert.deepEqual(labels(items), ["End"]);
  }
});

test("axis, plot, and the effective every mark style supply distinct option layers", () => {
  const axis = "/tikz/mark repeat=3,/tikz/every mark/.style={mark phase=2}";
  assert.deepEqual(marks(render(add("only marks,mark repeat=2,mark phase=1"), axis)), [1,3,5]);
  assert.deepEqual(marks(render(add("only marks,mark options={mark repeat=2}"), axis)), [0,2,4]);
  assert.deepEqual(marks(render(add("only marks,every mark/.append style={/tikz/mark repeat=2}"), axis)), [1,3,5]);
  assert.deepEqual(marks(render(add("only marks,every mark/.style={mark indices={1,3}}"),
    "every axis plot/.append style={mark indices={2}},every axis plot post/.style={mark indices={5}}")), [0,2]);
  assert.deepEqual(marks(render(add("only marks"), "every mark/.style={mark indices={2}}")), [0,1,2,3,4,5],
    "an unqualified axis style declaration belongs to /pgfplots, not /tikz");
});

test("plot-only axis styles do not leak into legends; later cycle, plot and mark styles keep their order", () => {
  const axis = "every axis plot/.style={mark indices={2}},every axis plot except legend/.style={mark indices={1,3}}";
  const items = render(add("mark=*") + "\\addlegendentry{$L$}", axis);
  const [line] = byRole(items, "axis-plot");
  assert.deepEqual(line.commands.map(p => p.x), [0,1,2,3,4,5]);
  assert.deepEqual(marks(items).slice(0,-1), [0,2]);
  assert.deepEqual(marks(render(add("mark=*,mark indices={4}"), axis)), [3]);
  const preamble = "\\pgfplotscreateplotcyclelist{sample}{{mark=*,every mark/.append style={mark indices={2,4}}}\\\\}";
  const cycled = render("\\addplot+[every mark/.append style={mark size=2pt}] " + run + ";",
    "cycle list name=sample", preamble);
  assert.deepEqual(marks(cycled), [1,3]);
});

test("scatter classes and nodes near coords share selection but keep the original coordinate index", () => {
  const data = "coordinates {(-1,1)[a](0,1)[b](1,1)[a](2,1)[a](nan,nan)(7,1)[a](3,1)[a](4,1)[b](5,1)[b]}";
  const axis = "unbounded coords=jump,nodes near coords={\\coordindex},clip marker paths";
  const items = render(add("scatter,only marks,mark=*,scatter src=explicit symbolic,point meta=explicit symbolic," +
    "scatter/classes={a={red},b={blue}},mark indices={1,3}", data), axis);
  assert.deepEqual(marks(items), [0,2,3,5]);
  assert.deepEqual(byRole(items, "axis-mark").map(p => p.style.stroke), ["blue","red","red","blue"]);
  const overlay = items.filter(p => p.type === "textNode" || p.subtype === "axis-mark");
  assert.deepEqual(overlay.map(p => p.text ?? p.cx), [0,"1",2,"3",3,"5",5,"7"]);
  assert.ok(overlay.every(p => p.clipRect));
  const nodeOnly = render(add("mark=none,mark indices={2}", data), axis);
  assert.deepEqual(marks(nodeOnly), []);
  assert.deepEqual(labels(nodeOnly), ["2","6"]);
});

test("sampled lines, parametric curves, combs and bars select observations, not clipped path vertices", () => {
  const axis = "domain=-1:5,samples=7,nodes near coords={\\coordindex}";
  for (const [handler, data, role] of [
    ["sharp plot", "{x/2}", "axis-plot"],
    ["sharp plot", "({x},{x/2})", "axis-plot"],
    ["ycomb", "{x/2}", "axis-comb"],
    ["ycomb", "coordinates {(-1,-.5)(0,0)(1,.5)(2,1)(3,1.5)(4,2)(5,2.5)}", "axis-comb"],
    ["ybar", "coordinates {(-1,-.5)(0,0)(1,.5)(2,1)(3,1.5)(4,2)(5,2.5)}", "axis-bar"]
  ]) {
    const items = render(add(handler + ",mark=*,mark indices={2,4}", data), axis);
    assert.deepEqual(marks(items), [1,3], handler + " " + data);
    assert.deepEqual(labels(items), ["2","4"]);
    assert.deepEqual(byRole(items, role).map(p => p.commands),
      byRole(render(add(handler + ",mark=none", data), axis), role).map(p => p.commands));
  }
});

test("MacTeX traces all four ycomb stems but only paints marks whose sampled centers pass the clip", {
  skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" && "set TIKZKIT_TEST_PDFLATEX=1 to replay"
}, () => {
  // Use the exact default-compat function, options and frame from extensions.test.js.
  const cases = [
    ["default", "", [0,1,2]], ["individual", ",clip mode=individual", [0,1,2]],
    ["paths", ",clip marker paths", [0,1,2]], ["off", ",clip=false", [0,1,2,3]],
    ["last", ",mark indices={4}", []], ["last-off", ",clip=false,mark indices={4}", [3]]
  ];
  const picture = extra => String.raw`\begin{tikzpicture}
    \begin{axis}[width=4cm,height=2cm,xmin=0,xmax=3,ymin=-1,ymax=1,axis lines=middle,domain=0:3${extra}]
    \addplot+[ycomb,mark=*,samples=4,black,thick] {x-1};
    \end{axis}\end{tikzpicture}`;
  const tex = String.raw`\documentclass{article}\usepackage{pgfplots}\makeatletter
\let\oldstem\pgf@plot@ycomb@handler
\def\pgf@plot@ycomb@handler#1{\typeout{COMB:\caseid:stem:\coordindex}\oldstem{#1}}
\let\oldcenter\pgfplots@markers@mark@handler
\def\pgfplots@markers@mark@handler#1{\typeout{COMB:\caseid:center:\coordindex}\oldcenter{#1}}
\let\oldmark\pgfuseplotmark
\def\pgfuseplotmark#1{\typeout{COMB:\caseid:paint:\coordindex}\oldmark{#1}}
\begin{document}` + cases.map(([id, extra]) => "\\def\\caseid{" + id + "}" + picture(extra)).join("\n") + "\\end{document}";
  const cwd = mkdtempSync(join(tmpdir(), "pgfplots-ycomb-mark-trace-"));
  try {
    writeFileSync(join(cwd, "probe.tex"), tex);
    execFileSync("pdflatex", ["-no-shell-escape", "-draftmode", "-halt-on-error", "-interaction=nonstopmode", "probe.tex"],
      { cwd, timeout: 30000 });
    const log = readFileSync(join(cwd, "probe.log"), "utf8");
    const trace = (id, stage) => [...log.matchAll(new RegExp("^COMB:" + id + ":" + stage + ":(\\d+)$", "gm"))]
      .map(m => Number(m[1]));
    for (const [id, extra, expected] of cases) {
      assert.deepEqual(trace(id, "stem"), [0,1,2,3], id);
      assert.deepEqual(trace(id, "center"), [0,1,2,3], id);
      const painted = trace(id, "paint");
      assert.deepEqual(painted, expected, id);
      const { ir, diagnostics } = tikzToSvg(picture(extra));
      assert.deepEqual(diagnostics, []);
      const xs = byRole(ir.items, "axis-comb").map(p => p.commands[0].x);
      assert.equal(xs.length, 4);
      assert.deepEqual(marks(ir.items).map(x => xs.indexOf(x)), painted, id);
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("3D line marks reject out-of-range z before selection, including in a top view", () => {
  const data = "coordinates {(0,1,-1)(1,1,1)(2,1,1)(3,1,3)(4,1,1)(5,1,1)}";
  for (const view of ["{0}{90}", "{35}{30}"]) {
    const axis = "zmin=0,zmax=2,view=" + view + ",clip marker paths=true";
    const items = render("\\addplot3[mark=*,mark indices={2,4},nodes near coords={\\coordindex}] " + data + ";", axis);
    assert.equal(marks(items).length, 2);
    assert.deepEqual(labels(items).filter(text => /^[0-9]$/.test(text)).slice(-2), ["2","5"]);
  }
});

test("3D global and individual marker passes keep separate counters and the native series order", () => {
  const d = "coordinates {(0,0,1)(1,1,1)(2,0,1)};";
  const body = "\\addplot3[mark=*,mark indices={2}] " + d + "\\addplot3[mark=*,mark indices={1}] " + d;
  for (const view of ["{0}{90}", "{35}{30}"]) {
    for (const [mode, expected] of [["global", ["axis-plot","axis-plot","axis-mark","axis-mark"]],
      ["individual", ["axis-plot","axis-mark","axis-plot","axis-mark"]]]) {
      const items = render(body, "zmin=0,zmax=2,view=" + view + ",clip mode=" + mode);
      assert.deepEqual(items.map(p => p.subtype).filter(r => expected.includes(r)), expected, view + " " + mode);
    }
  }
});

function legend(plot, axis = "") {
  return renderLegendEntries(parseOptions(axis), {}, { origin: { x:0, y:0 }, width:5, height:2 }, ["$L$"],
    [{ options: parseOptions("mark=*," + plot) }]);
}
const coords = s => [...s.matchAll(/\(([-\d.]+),([-\d.]+)\)/g)].map(m => m.slice(1).map(Number));
function lineLegendFractions(commands) {
  const [[x0], [x1]] = coords(commands.find(c => c.includes("axis legend image")));
  return commands.filter(c => c.includes("axis mark")).map(c => Math.round(2 * (coords(c)[0][0] - x0) / (x1 - x0)) / 2);
}

test("line legend runs a fresh three-point stream with path-local 2/2 defaults and later every mark", () => {
  for (const [plot, axis, expected] of [
    ["", "", [.5]], ["mark repeat=5,mark phase=4", "", [.5]],
    ["mark indices={1,3}", "", [0,1]], ["mark indices={7}", "", []],
    ["mark repeat=3,mark phase=1,mark indices={3}", "", [1]],
    ["", "/tikz/mark indices={1,3}", [0,1]],
    ["", "legend image post style={mark indices={1,3}}", [0,1]],
    ["", "legend image post style={mark repeat=1,mark phase=1}", [.5]],
    ["mark indices={2}", "legend image post style={mark options={mark indices={3}}}", [1]],
    ["mark options={mark repeat=1,mark phase=1}", "", [0,.5,1]]
  ]) {
    assert.deepEqual(lineLegendFractions(legend(plot, axis)), expected, plot + "; " + axis);
  }
  const width = cmds => { const [[x0], [x1]] = coords(cmds[0]); return x1 - x0; };
  const only = "only marks,mark size=3pt";
  near(width(legend(only + ",mark indices={1,3}")) - width(legend(only)), .6);
  near(width(legend(only)) - width(legend(only + ",mark indices={7}")), 6 * 2.54 / 72.27);
});

test("bar legend markers use the bar sample coordinates without the line legend's repeat/phase", () => {
  const ordinary = legend("mark indices={2}", "ybar"), control = legend("", "ybar");
  assert.equal(control.filter(c => c.includes("axis mark")).length, 2);
  assert.equal(ordinary.filter(c => c.includes("axis mark")).length, 1);
  assert.equal(ordinary.filter(c => c.includes("axis legend image")).length, 2);
  assert.equal(legend("mark indices={1,2}", "area legend").filter(c => c.includes("axis mark")).length, 0);
});

test("matrix holes remain marker observations in source order, independent of face paint order", () => {
  const data = "coordinates {(0,0)[0](1,0)[1](2,0)[2](0,1)[3](1,1)[nan](2,1)[5]}";
  const items = render(add("matrix plot*,mesh/cols=3,point meta=explicit,mark=*,mark indices={2,4},nodes near coords={\\coordindex}", data),
    "xmax=1");
  assert.equal(byRole(items, "axis-matrix-cell").length, 5);
  assert.deepEqual(labels(items), ["1","4"]);
  assert.equal(marks(items).length, 2);
});

test("boxplot outliers participate, but the directly painted average is not a stream point", () => {
  const data = "coordinates {(0,1.5)(0,1.6)(0,1.7)(0,1.8)}";
  const items = render(add("boxplot prepared={draw direction=y,draw position=2,lower whisker=0,upper whisker=1," +
    "lower quartile=.25,upper quartile=.75,median=.5,average=.5},mark=*,mark options={mark indices={2,3}}", data),
    "", "\\usepgfplotslibrary{statistics}");
  assert.equal(byRole(items, "axis-boxplot-average").length, 1);
  assert.deepEqual(byRole(items, "axis-boxplot-outlier").map(p => p.cy), [1.6,1.7]);
});
